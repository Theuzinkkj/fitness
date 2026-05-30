import { createClient } from '@/lib/supabase/server'
import Groq from 'groq-sdk'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { messages, conversationId } = await req.json()

    const { data: profile } = await supabase
      .from('profiles')
      .select('name, age, sex, height, weight, goal, experience_level, daily_calorie_goal, daily_protein_goal, food_restrictions')
      .eq('id', user.id)
      .single()

    const systemPrompt = `Você é o FitBot, um personal trainer e nutricionista virtual especializado do FitHub, uma plataforma de saúde e fitness brasileira. Você deve responder sempre em português brasileiro de forma clara, prática e motivadora.

${profile ? `
PERFIL DO USUÁRIO:
- Nome: ${profile.name ?? 'Não informado'}
- Idade: ${profile.age ?? 'Não informado'} anos
- Sexo: ${profile.sex ?? 'Não informado'}
- Altura: ${profile.height ?? 'Não informado'} cm
- Peso atual: ${profile.weight ?? 'Não informado'} kg
- Objetivo: ${profile.goal ?? 'Não informado'}
- Nível de experiência: ${profile.experience_level ?? 'Não informado'}
- Meta calórica diária: ${profile.daily_calorie_goal ?? 2000} kcal
- Meta de proteína: ${profile.daily_protein_goal ?? 150}g
- Restrições alimentares: ${profile.food_restrictions?.join(', ') || 'Nenhuma'}
` : ''}

SUAS ESPECIALIDADES:
1. **Treinos**: Criar programas de treino personalizados (ABC, ABCDE, Full Body, HIIT), explicar exercícios com técnica correta, progressão de cargas, volume e intensidade
2. **Nutrição**: Planos alimentares personalizados, cálculo de macros, substituições alimentares, timing nutricional, suplementação
3. **Análise de progresso**: Interpretar dados de evolução, sugerir ajustes, identificar platôs
4. **Saúde e bem-estar**: Sono, recuperação, hidratação, redução de estresse

DIRETRIZES:
- Sempre personalize as respostas com base no perfil do usuário
- Forneça informações práticas e aplicáveis
- Inclua exemplos concretos quando possível
- Para treinos, especifique: exercício, séries x repetições, carga sugerida, descanso
- Para refeições, especifique: alimento, quantidade, macros aproximados
- Seja motivador e positivo
- Se não tiver perfil completo, peça as informações necessárias
- Nunca substitua consulta médica profissional para questões de saúde complexas`

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages.map((m: { role: string; content: string }) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
      ],
      max_tokens: 1500,
      temperature: 0.7,
    })

    const assistantMessage = completion.choices[0].message.content ?? ''

    if (conversationId) {
      const lastUserMessage = messages[messages.length - 1]
      await supabase.from('ai_messages').insert([
        { conversation_id: conversationId, role: 'user', content: lastUserMessage.content },
        { conversation_id: conversationId, role: 'assistant', content: assistantMessage },
      ])
      await supabase.from('ai_conversations').update({ updated_at: new Date().toISOString() }).eq('id', conversationId)
    }

    return NextResponse.json({ message: assistantMessage })
  } catch (error: any) {
    console.error('AI Chat error:', error)
    if (error?.status === 429) {
      return NextResponse.json({ error: 'Limite de requisições atingido. Tente novamente em alguns segundos.' }, { status: 429 })
    }
    return NextResponse.json({ error: 'Erro ao processar sua mensagem.' }, { status: 500 })
  }
}
