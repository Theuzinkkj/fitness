const express = require('express');
const router = express.Router();
const Groq = require('groq-sdk');
const { requireAuth } = require('../middleware/auth');
const { supabase } = require('../config/supabase');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const TEXT_MODEL = process.env.GROQ_TEXT_MODEL || 'llama-3.3-70b-versatile';
const VISION_MODEL = process.env.GROQ_VISION_MODEL || 'meta-llama/llama-4-scout-17b-16e-instruct';
const MAX_IMAGE_BYTES = 6 * 1024 * 1024;

router.use(requireAuth);

router.post('/chat', async (req, res) => {
  const { message, history = [], image = null } = req.body;
  const text = message?.trim();
  const attachedImage = normalizeImage(image);

  if (!text && !attachedImage) return res.status(400).json({ error: 'Mensagem obrigatoria' });
  if (!process.env.GROQ_API_KEY) return res.status(503).json({ error: 'IA nao configurada. Adicione GROQ_API_KEY.' });
  if (image && !attachedImage) return res.status(400).json({ error: 'Imagem invalida. Envie PNG, JPG ou WebP com ate 6MB.' });

  try {
    const uid = req.user.id;
    const today = new Date().toISOString().split('T')[0];
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();

    const [todos, notes, goals, events, diary, sessions, subjects, links, library] = await Promise.all([
      supabase.from('todos').select('title,priority,done,due_date').eq('user_id', uid).eq('done', false).limit(20),
      supabase.from('notes').select('title,pinned,category').eq('user_id', uid).order('updated_at', { ascending: false }).limit(10),
      supabase.from('goals').select('title,progress,deadline').eq('user_id', uid).eq('completed', false).limit(10),
      supabase.from('events').select('title,date,time').eq('user_id', uid).gte('date', today).order('date').limit(10),
      supabase.from('diary_entries').select('date,mood').eq('user_id', uid).order('date', { ascending: false }).limit(7),
      supabase.from('study_sessions').select('duration,start_time,subject_id').eq('user_id', uid).gte('start_time', weekAgo),
      supabase.from('study_subjects').select('id,name').eq('user_id', uid),
      supabase.from('links').select('title,favorite').eq('user_id', uid).limit(10),
      supabase.from('library_items').select('title,status,progress').eq('user_id', uid).limit(10)
    ]);

    const overdueTodos = (todos.data || []).filter(t => t.due_date && t.due_date < today);
    const highPrio = (todos.data || []).filter(t => t.priority === 'high');
    const weekMins = (sessions.data || []).reduce((a, s) => a + (s.duration || 0), 0);

    const systemPrompt = `Voce e o Atlas Assistant, assistente pessoal integrado ao hub Atlas.
Responda em portugues brasileiro, de forma direta e util.

=== DADOS DO USUARIO - ${new Date().toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} ===
TAREFAS PENDENTES: ${(todos.data || []).length}
${highPrio.length ? `Alta prioridade: ${highPrio.slice(0, 3).map(t => t.title).join(', ')}` : ''}
${overdueTodos.length ? `Atrasadas: ${overdueTodos.slice(0, 3).map(t => `${t.title} (venceu ${t.due_date})`).join('; ')}` : 'Nenhuma atrasada'}
NOTAS: ${(notes.data || []).length}
METAS: ${(goals.data || []).map(g => `${g.title}: ${g.progress}%`).join(', ') || 'Nenhuma'}
EVENTOS: ${(events.data || []).slice(0, 3).map(e => `${e.date}: ${e.title}`).join(', ') || 'Nenhum'}
ESTUDO SEMANA: ${Math.floor(weekMins / 60)}h${weekMins % 60}m
HUMOR: ${(diary.data || []).map(d => `${d.date}:${d.mood || '-'}`).join(' | ') || 'Sem registros'}
LINKS: ${(links.data || []).length} | BIBLIOTECA: ${(library.data || []).filter(i => i.status === 'reading').length} em andamento
===
Quando houver imagem, analise o print com cuidado e relacione com a pergunta do usuario.
Para criar/modificar dados, oriente o usuario a usar os modulos do Atlas. Nao acessa o cofre de senhas.`;

    const userContent = attachedImage
      ? [
          { type: 'text', text: text || 'Analise este print e explique o que aparece.' },
          { type: 'image_url', image_url: { url: attachedImage.dataUrl } }
        ]
      : text;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.slice(-6).map(h => ({ role: h.role, content: String(h.content || '') })),
      { role: 'user', content: userContent }
    ];

    const completion = await groq.chat.completions.create({
      model: attachedImage ? VISION_MODEL : TEXT_MODEL,
      messages,
      max_tokens: 1024,
      temperature: 0.7,
    });

    res.json({ reply: completion.choices[0].message.content ?? '' });
  } catch (err) {
    console.error('AI error:', err.message);
    if (err?.status === 429) return res.status(429).json({ error: 'Limite Groq atingido. Tente em segundos.' });
    res.status(500).json({ error: 'Erro ao processar com IA.' });
  }
});

function normalizeImage(image) {
  if (!image || typeof image !== 'object') return null;
  const dataUrl = String(image.dataUrl || '');
  const match = dataUrl.match(/^data:(image\/(?:png|jpe?g|webp));base64,([A-Za-z0-9+/=]+)$/i);
  if (!match) return null;
  const bytes = Math.ceil((match[2].length * 3) / 4);
  if (bytes > MAX_IMAGE_BYTES) return null;
  return { mime: match[1].toLowerCase(), dataUrl };
}

module.exports = router;
