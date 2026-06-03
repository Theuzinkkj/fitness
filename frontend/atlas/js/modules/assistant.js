/* ===== ATLAS ASSISTANT — IA Real (Groq) + Fallback Local ===== */

const Assistant = (() => {
  let _history = [];
  const MAX_HISTORY = 10;
  const MAX_IMAGE_SIZE = 6 * 1024 * 1024;
  let _aiAvailable = null;
  let _pendingImage = null;

  function init() {
    _aiAvailable = typeof Auth !== 'undefined' && Auth.isLoggedIn() && navigator.onLine;
    updateBadge();
    bindPasteUpload();
  }

  function updateBadge() {
    const el = document.getElementById('aiModeBadge');
    if (!el) return;
    if (_aiAvailable) {
      el.innerHTML = '<span class="ai-mode-badge">Llama 3.3 · Groq ativo</span>';
    } else {
      el.innerHTML = '<span style="font-size:.75rem;color:var(--text-muted)">Modo local — faça login para IA real</span>';
    }
  }

  function send() {
    const input = document.getElementById('assistantInput');
    const msg = input?.value.trim() || '';
    const image = _pendingImage;
    if (!msg && !image) return;
    input.value = '';
    clearImage();
    query(msg || 'Analise este print.', image);
  }

  async function query(text, image = null) {
    addMessage(text, 'user', false, image);
    const typingEl = showTyping();

    if (typeof Auth !== 'undefined' && Auth.isLoggedIn() && navigator.onLine) {
      try {
        const result = await API.post('/ai/chat', { message: text, image, history: _history.slice(-MAX_HISTORY) });
        typingEl.remove();
        if (result.ok) {
          _aiAvailable = true;
          updateBadge();
          _history.push({ role: 'user', content: image ? `${text} [print anexado]` : text });
          _history.push({ role: 'assistant', content: result.data.reply });
          if (_history.length > MAX_HISTORY * 2) _history = _history.slice(-MAX_HISTORY * 2);
          addMessage(result.data.reply, 'bot', true);
          return;
        }
        _aiAvailable = false;
        updateBadge();
        const errMsg = result.data?.error || result.error;
        if (errMsg) AtlasApp.toast(errMsg, 'warning');
      } catch {
        typingEl.remove();
        _aiAvailable = false;
        updateBadge();
      }
      typingEl.remove?.();
    } else {
      setTimeout(() => {
        typingEl.remove();
        addMessage(image ? '<p>Para analisar prints, faca login e use a IA real do Atlas.</p>' : processQuery(text.toLowerCase()), 'bot', true);
      }, 500 + Math.random() * 300);
      return;
    }
    addMessage(image ? '<p>Nao consegui analisar esse print agora. Verifique o modelo de visao configurado no backend e tente novamente.</p>' : processQuery(text.toLowerCase()), 'bot', true);
  }

  function pickImage() {
    document.getElementById('assistantImageInput')?.click();
  }

  async function handleImage(files) {
    const file = files?.[0];
    const input = document.getElementById('assistantImageInput');
    if (input) input.value = '';
    if (!file) return;
    if (!/^image\/(png|jpe?g|webp)$/i.test(file.type)) {
      AtlasApp.toast('Envie um print PNG, JPG ou WebP.', 'warning');
      return;
    }
    if (file.size > MAX_IMAGE_SIZE) {
      AtlasApp.toast('Imagem muito grande. O limite e 6MB.', 'warning');
      return;
    }
    try {
      _pendingImage = await fileToImagePayload(file);
      if ((_pendingImage.size || 0) > MAX_IMAGE_SIZE) {
        _pendingImage = null;
        AtlasApp.toast('Imagem muito grande mesmo apos otimizar. Tente recortar o print.', 'warning');
        return;
      }
      renderImagePreview();
      document.getElementById('assistantInput')?.focus();
    } catch {
      AtlasApp.toast('Nao consegui carregar essa imagem.', 'error');
    }
  }

  function bindPasteUpload() {
    const input = document.getElementById('assistantInput');
    if (!input || input.dataset.pasteBound === '1') return;
    input.dataset.pasteBound = '1';
    input.addEventListener('paste', (event) => {
      const item = Array.from(event.clipboardData?.items || []).find(i => i.type.startsWith('image/'));
      if (!item) return;
      event.preventDefault();
      handleImage([item.getAsFile()]);
    });
  }

  function renderImagePreview() {
    const box = document.getElementById('assistantImagePreview');
    if (!box) return;
    if (!_pendingImage) {
      box.classList.add('hidden');
      box.innerHTML = '';
      return;
    }
    box.classList.remove('hidden');
    box.innerHTML = `
      <div class="assistant-image-chip">
        <img src="${_pendingImage.dataUrl}" alt="Print anexado">
        <div>
          <strong>${esc(_pendingImage.name || 'Print anexado')}</strong>
          <span>${formatBytes(_pendingImage.size || 0)}</span>
        </div>
        <button onclick="Assistant.removeImage()" aria-label="Remover print">x</button>
      </div>`;
  }

  function removeImage() {
    clearImage();
  }

  function clearImage() {
    _pendingImage = null;
    renderImagePreview();
  }

  async function fileToImagePayload(file) {
    const dataUrl = await readFileAsDataUrl(file);
    const resized = await resizeImageDataUrl(dataUrl, file.type);
    return { dataUrl: resized.dataUrl, name: file.name || 'print.png', type: resized.type, size: resized.size };
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function resizeImageDataUrl(dataUrl, type) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const max = 1600;
        const ratio = Math.min(1, max / Math.max(img.width, img.height));
        if (ratio === 1 && dataUrl.length < MAX_IMAGE_SIZE * 1.34) {
          resolve({ dataUrl, type, size: Math.ceil(dataUrl.length * 0.75) });
          return;
        }
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.width * ratio));
        canvas.height = Math.max(1, Math.round(img.height * ratio));
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        const outType = type === 'image/png' ? 'image/png' : 'image/jpeg';
        const out = canvas.toDataURL(outType, 0.85);
        resolve({ dataUrl: out, type: outType, size: Math.ceil(out.length * 0.75) });
      };
      img.onerror = () => resolve({ dataUrl, type, size: Math.ceil(dataUrl.length * 0.75) });
      img.src = dataUrl;
    });
  }

  function showTyping() {
    const chat = document.getElementById('assistantChat');
    const el = document.createElement('div');
    el.className = 'assistant-message bot';
    el.innerHTML = `<div class="bot-avatar"><svg width="24" height="24" viewBox="0 0 36 36" fill="none"><circle cx="18" cy="18" r="17" stroke="currentColor" stroke-width="1.5"/><path d="M18 4 L30 30 L6 30 Z" fill="currentColor" opacity="0.9"/><circle cx="18" cy="14" r="3" fill="white"/></svg></div><div class="message-bubble"><div class="bot-typing"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div></div>`;
    chat?.appendChild(el);
    if (chat) chat.scrollTop = chat.scrollHeight;
    return el;
  }

  function addMessage(text, role, isMarkdown = false, image = null) {
    const chat = document.getElementById('assistantChat');
    if (!chat) return;
    const div = document.createElement('div');
    div.className = `assistant-message ${role}`;
    const content = isMarkdown ? renderMarkdown(text) : esc(text);
    if (role === 'bot') {
      div.innerHTML = `<div class="bot-avatar"><svg width="24" height="24" viewBox="0 0 36 36" fill="none"><circle cx="18" cy="18" r="17" stroke="currentColor" stroke-width="1.5"/><path d="M18 4 L30 30 L6 30 Z" fill="currentColor" opacity="0.9"/><circle cx="18" cy="14" r="3" fill="white"/></svg></div><div class="message-bubble">${content}</div>`;
    } else {
      const imageHtml = image ? `<img class="message-image" src="${image.dataUrl}" alt="Print enviado">` : '';
      div.innerHTML = `<div class="message-bubble">${imageHtml}${esc(text)}</div>`;
    }
    chat.appendChild(div);
    chat.scrollTop = chat.scrollHeight;
  }

  function renderMarkdown(text) {
    return esc(text)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`(.+?)`/g, '<code style="background:var(--surface-2);padding:.1em .3em;border-radius:4px;font-size:.9em">$1</code>')
      .replace(/^#{1,3} (.+)$/gm, '<p><strong>$1</strong></p>')
      .replace(/^- (.+)$/gm, '<li>$1</li>')
      .replace(/(<li>[\s\S]*?<\/li>)+/g, '<ul style="padding-left:1.25rem;margin:.5rem 0">$&</ul>')
      .replace(/\n\n+/g, '</p><p>')
      .replace(/\n/g, '<br>');
  }

  function clear() {
    _history = [];
    const chat = document.getElementById('assistantChat');
    if (!chat) return;
    const online = typeof Auth !== 'undefined' && Auth.isLoggedIn() && navigator.onLine;
    chat.innerHTML = `<div class="assistant-message bot"><div class="bot-avatar"><svg width="24" height="24" viewBox="0 0 36 36" fill="none"><circle cx="18" cy="18" r="17" stroke="currentColor" stroke-width="1.5"/><path d="M18 4 L30 30 L6 30 Z" fill="currentColor" opacity="0.9"/><circle cx="18" cy="14" r="3" fill="white"/></svg></div><div class="message-bubble"><p>Conversa limpa! Como posso ajudar?</p><p style="font-size:.75rem;color:var(--text-muted);margin-top:.35rem">${online ? 'Powered by Llama 3.3 via Groq — dados reais do Supabase.' : 'Modo local ativo. Faça login para IA real.'}</p></div></div>`;
  }

  // ===== FALLBACK LOCAL =====
  function processQuery(q) {
    if (match(q, ['tarefa', 'todo', 'fazer', 'pendente', 'atrasad'])) return queryTodos(q);
    if (match(q, ['nota', 'anotação', 'notas'])) return queryNotes(q);
    if (match(q, ['meta', 'objetivo', 'goal'])) return queryGoals(q);
    if (match(q, ['evento', 'compromisso', 'agenda', 'calendário', 'hoje'])) return queryEvents(q);
    if (match(q, ['estudo', 'estudar', 'matéria', 'sessão'])) return queryStudy(q);
    if (match(q, ['senha', 'cofre', 'vault'])) return '<p>🔐 Acesse o módulo <strong>Cofre de Senhas</strong> para ver suas senhas. Por segurança, não tenho acesso a elas aqui.</p>';
    if (match(q, ['diário', 'humor'])) return queryDiary(q);
    if (match(q, ['link', 'site', 'favorito'])) return queryLinks(q);
    if (match(q, ['resumo', 'overview', 'status'])) return queryOverview();
    if (match(q, ['olá', 'oi', 'hey', 'ajuda'])) return greeting();
    return search(q);
  }

  function match(q, kw) { return kw.some(k => q.includes(k)); }

  function queryTodos(q) {
    const todos = Storage.get('todos') || [];
    const today = new Date().toISOString().split('T')[0];
    const overdue = todos.filter(t => !t.done && (t.dueDate || t.due_date) && (t.dueDate || t.due_date) < today);
    const high = todos.filter(t => !t.done && t.priority === 'high');
    const pending = todos.filter(t => !t.done);
    return `<p>📋 <strong>Tarefas:</strong></p><ul>
      <li>• ${pending.length} pendente(s)</li>
      <li>• ${todos.filter(t=>t.done).length} concluída(s)</li>
      ${overdue.length ? `<li>• ⚠️ ${overdue.length} atrasada(s)</li>` : '<li>• ✅ Nenhuma atrasada</li>'}
      ${high.length ? `<li>• 🔴 ${high.length} de alta prioridade</li>` : ''}</ul>
      ${pending.length ? `<p style="margin-top:.5rem">Próximas: ${pending.slice(0,3).map(t=>`<strong>${esc(t.title)}</strong>`).join(', ')}</p>` : ''}`;
  }

  function queryNotes(q) {
    const notes = Storage.get('notes') || [];
    if (!notes.length) return '<p>Nenhuma nota ainda.</p>';
    return `<p>📝 <strong>${notes.length} nota(s)</strong> — ${notes.filter(n=>n.pinned).length} fixada(s)</p><p>Recentes: ${notes.slice(0,3).map(n=>`<strong>${esc(n.title)}</strong>`).join(', ')}</p>`;
  }

  function queryGoals(q) {
    const goals = Storage.get('goals') || [];
    const active = goals.filter(g => !g.completed);
    if (!active.length) return '<p>Nenhuma meta ativa.</p>';
    return `<p>🎯 <strong>${active.length} meta(s) ativa(s):</strong></p><ul>${active.slice(0,4).map(g=>`<li>• <strong>${esc(g.title)}</strong> — ${g.progress||0}%</li>`).join('')}</ul>`;
  }

  function queryEvents(q) {
    const events = Storage.get('events') || [];
    const today = new Date().toISOString().split('T')[0];
    const upcoming = events.filter(e => e.date >= today).sort((a,b)=>a.date.localeCompare(b.date)).slice(0,5);
    if (!upcoming.length) return '<p>📅 Nenhum evento próximo.</p>';
    return `<p>📅 <strong>Próximos eventos:</strong></p><ul>${upcoming.map(e=>`<li>• <strong>${fmtDate(e.date)}</strong>${e.time?' às '+e.time:''} — ${esc(e.title)}</li>`).join('')}</ul>`;
  }

  function queryStudy(q) {
    const sessions = Storage.get('study.sessions') || [];
    const weekAgo = new Date(Date.now()-7*86400000).toISOString();
    const weekMins = sessions.filter(s=>(s.startTime||s.start_time)>weekAgo).reduce((a,s)=>a+(s.duration||0),0);
    return `<p>📚 <strong>Estudos:</strong></p><ul><li>• Esta semana: <strong>${fmtTime(weekMins)}</strong></li><li>• Total de sessões: ${sessions.length}</li><li>• Matérias: ${(Storage.get('study.subjects')||[]).length}</li></ul>`;
  }

  function queryDiary(q) {
    const entries = Storage.get('diary') || [];
    if (!entries.length) return '<p>Nenhuma entrada no diário ainda.</p>';
    const moods = entries.slice(0,7).map(e=>e.mood).filter(Boolean);
    return `<p>📖 <strong>${entries.length} entrada(s)</strong> — última em ${fmtDate(entries[0]?.date)}${moods.length?`<br>Humores recentes: ${moods.join(' ')}`:''}</p>`;
  }

  function queryLinks(q) {
    const links = Storage.get('links') || [];
    if (!links.length) return '<p>Nenhum link salvo.</p>';
    return `<p>🔗 <strong>${links.length} link(s)</strong> — ${links.filter(l=>l.favorite).length} favorito(s)</p>`;
  }

  function queryOverview() {
    const today = new Date().toISOString().split('T')[0];
    const todos = (Storage.get('todos')||[]).filter(t=>!t.done).length;
    const notes = (Storage.get('notes')||[]).length;
    const goals = (Storage.get('goals')||[]).filter(g=>!g.completed).length;
    const events = (Storage.get('events')||[]).filter(e=>e.date>=today).length;
    const weekMins = (Storage.get('study.sessions')||[]).filter(s=>(s.startTime||s.start_time)>new Date(Date.now()-7*86400000).toISOString()).reduce((a,s)=>a+(s.duration||0),0);
    return `<p>📊 <strong>Resumo do seu hub:</strong></p><ul>
      <li>• ✅ ${todos} tarefa(s) pendente(s)</li>
      <li>• 📝 ${notes} nota(s)</li>
      <li>• 🎯 ${goals} meta(s) ativa(s)</li>
      <li>• 📅 ${events} evento(s) próximo(s)</li>
      <li>• 📚 ${fmtTime(weekMins)} estudado esta semana</li></ul>`;
  }

  function search(q) {
    const results = [];
    const term = q.toLowerCase();
    (Storage.get('notes')||[]).forEach(n=>{ if(n.title?.toLowerCase().includes(term)||n.content?.toLowerCase().includes(term)) results.push({type:'Nota',title:n.title}); });
    (Storage.get('todos')||[]).forEach(t=>{ if(t.title?.toLowerCase().includes(term)) results.push({type:'Tarefa',title:t.title}); });
    (Storage.get('goals')||[]).forEach(g=>{ if(g.title?.toLowerCase().includes(term)) results.push({type:'Meta',title:g.title}); });
    if (!results.length) return `<p>🔍 Não encontrei "<strong>${esc(q)}</strong>". Tente: tarefas, notas, metas, eventos, estudo.</p>`;
    return `<p>🔍 <strong>${results.length}</strong> resultado(s):</p><ul>${results.slice(0,6).map(r=>`<li>• <span class="badge badge-primary" style="font-size:.7rem">${r.type}</span> ${esc(r.title)}</li>`).join('')}</ul>`;
  }

  function greeting() {
    const online = typeof Auth !== 'undefined' && Auth.isLoggedIn() && navigator.onLine;
    return `<p>Olá! Sou o <strong>Atlas Assistant</strong>${online?' — Llama 3.3 via Groq':''}.</p>
      <p style="margin-top:.5rem">Posso ajudar com:</p>
      <ul><li>• 📋 Tarefas e prioridades</li><li>• 📝 Notas e conteúdo</li><li>• 🎯 Progresso de metas</li><li>• 📅 Eventos e agenda</li><li>• 📚 Estatísticas de estudo</li><li>• 📊 Resumo geral</li></ul>`;
  }

  function fmtDate(d) { return d ? new Date(d+'T00:00:00').toLocaleDateString('pt-BR') : ''; }
  function fmtTime(m) { const h=Math.floor(m/60),min=m%60; return h>0?`${h}h${min>0?min+'m':''}`:min+'m'; }
  function esc(s) { return s?String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'):''; }
  function formatBytes(bytes) {
    if (!bytes) return 'Imagem pronta';
    if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  return { init, send, query, clear, pickImage, handleImage, removeImage };
})();
