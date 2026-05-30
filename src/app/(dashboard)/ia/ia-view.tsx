'use client'

import { useState, useRef, useEffect, useTransition } from 'react'
import { Navbar } from '@/components/layout/navbar'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { AiConversation, AiMessage } from '@/types'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Bot, Send, Plus, Loader2, User, Sparkles, Dumbbell, Utensils, TrendingUp, MessageSquare } from 'lucide-react'

interface IAViewProps {
  userId: string
  profile: { name: string | null; goal: string | null; experience_level: string | null } | null
  conversations: AiConversation[]
}

interface Message { role: 'user' | 'assistant'; content: string }

const QUICK_PROMPTS = [
  { icon: <Dumbbell className="w-4 h-4" />, label: 'Monte um treino ABC', prompt: 'Monte um programa de treino ABC completo para hipertrofia, adaptado ao meu perfil.' },
  { icon: <Utensils className="w-4 h-4" />, label: 'Plano alimentar 2500 kcal', prompt: 'Crie um plano alimentar de 2500 calorias para hipertrofia com refeições detalhadas e macros.' },
  { icon: <TrendingUp className="w-4 h-4" />, label: 'Análise de progresso', prompt: 'Como posso analisar e melhorar meu progresso nos treinos? Quais indicadores devo acompanhar?' },
  { icon: <Sparkles className="w-4 h-4" />, label: 'Dicas de recuperação', prompt: 'Quais as melhores práticas para recuperação muscular após treinos intensos? Inclua alimentação, sono e técnicas.' },
  { icon: <Bot className="w-4 h-4" />, label: 'Levantamento terra correto', prompt: 'Como executar o levantamento terra corretamente? Explique a técnica, músculos trabalhados e erros comuns.' },
  { icon: <Utensils className="w-4 h-4" />, label: 'Alimentos com mais proteína', prompt: 'Quais são os 10 alimentos com mais proteína por 100g? Inclua opções vegetais e animais com quantidade de proteína.' },
]

// --- Markdown renderer ---
function inlineFormat(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g)
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong>
        }
        if (part.startsWith('*') && part.endsWith('*')) {
          return <em key={i}>{part.slice(1, -1)}</em>
        }
        if (part.startsWith('`') && part.endsWith('`')) {
          return <code key={i} className="bg-gray-100 dark:bg-gray-800 px-1 rounded text-xs font-mono">{part.slice(1, -1)}</code>
        }
        return part
      })}
    </>
  )
}

function MarkdownText({ content }: { content: string }) {
  const lines = content.split('\n')
  const result: React.ReactNode[] = []
  let listItems: string[] = []
  let listType: 'ul' | 'ol' | null = null

  function flushList(key: string) {
    if (listItems.length === 0) return
    if (listType === 'ul') {
      result.push(
        <ul key={key} className="list-disc pl-5 my-1 space-y-0.5">
          {listItems.map((item, i) => <li key={i}>{inlineFormat(item)}</li>)}
        </ul>
      )
    } else {
      result.push(
        <ol key={key} className="list-decimal pl-5 my-1 space-y-0.5">
          {listItems.map((item, i) => <li key={i}>{inlineFormat(item)}</li>)}
        </ol>
      )
    }
    listItems = []
    listType = null
  }

  lines.forEach((line, i) => {
    if (line.startsWith('### ')) {
      flushList(`list-${i}`)
      result.push(<h3 key={i} className="font-semibold text-sm mt-3 mb-0.5">{inlineFormat(line.slice(4))}</h3>)
    } else if (line.startsWith('## ')) {
      flushList(`list-${i}`)
      result.push(<h2 key={i} className="font-bold mt-3 mb-1">{inlineFormat(line.slice(3))}</h2>)
    } else if (line.startsWith('# ')) {
      flushList(`list-${i}`)
      result.push(<h1 key={i} className="font-bold text-base mt-3 mb-1">{inlineFormat(line.slice(2))}</h1>)
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      if (listType !== 'ul') { flushList(`list-${i}`); listType = 'ul' }
      listItems.push(line.slice(2))
    } else if (/^\d+\.\s/.test(line)) {
      if (listType !== 'ol') { flushList(`list-${i}`); listType = 'ol' }
      listItems.push(line.replace(/^\d+\.\s/, ''))
    } else if (line.trim() === '' || line === '---') {
      flushList(`list-${i}`)
      if (i < lines.length - 1) result.push(<div key={i} className="h-1" />)
    } else {
      flushList(`list-${i}`)
      result.push(<p key={i}>{inlineFormat(line)}</p>)
    }
  })
  flushList('list-end')

  return <div className="space-y-0.5 text-sm leading-relaxed">{result}</div>
}

export function IAView({ userId, profile, conversations }: IAViewProps) {
  const router = useRouter()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [activeConv, setActiveConv] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function startNewConversation() {
    const supabase = createClient()
    const { data } = await supabase.from('ai_conversations').insert({
      user_id: userId,
      title: 'Nova Conversa',
    }).select().single()
    if (data) {
      setConversationId(data.id)
      setActiveConv(data.id)
      setMessages([])
      startTransition(() => router.refresh())
    }
    return data?.id
  }

  async function loadConversation(conv: AiConversation) {
    setActiveConv(conv.id)
    setConversationId(conv.id)
    const msgs = (conv.ai_messages ?? [])
      .sort((a: AiMessage, b: AiMessage) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      .map((m: AiMessage) => ({ role: m.role, content: m.content }))
    setMessages(msgs)
  }

  async function sendMessage(content?: string) {
    const text = content ?? input.trim()
    if (!text || isLoading) return

    let convId = conversationId
    if (!convId) convId = await startNewConversation() ?? null
    if (!convId) return

    const userMessage: Message = { role: 'user', content: text }
    const updatedMessages = [...messages, userMessage]
    setMessages(updatedMessages)
    setInput('')
    setIsLoading(true)

    if (messages.length === 0) {
      const supabase = createClient()
      await supabase.from('ai_conversations').update({
        title: text.slice(0, 60) + (text.length > 60 ? '...' : ''),
      }).eq('id', convId)
    }

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: updatedMessages, conversationId: convId }),
      })

      const data = await res.json()
      if (data.error) throw new Error(data.error)

      setMessages(prev => [...prev, { role: 'assistant', content: data.message }])
      startTransition(() => router.refresh())
    } catch (error: any) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Erro ao processar. Tente novamente. (${error.message ?? 'desconhecido'})`,
      }])
    } finally {
      setIsLoading(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const firstName = profile?.name?.split(' ')[0] ?? 'Atleta'

  return (
    <div className="flex h-screen flex-col">
      <Navbar title="Assistente IA" />

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="hidden lg:flex flex-col w-64 border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950">
          <div className="p-4 border-b border-gray-200 dark:border-gray-800">
            <Button className="w-full gap-2" onClick={() => { setMessages([]); setConversationId(null); setActiveConv(null) }}>
              <Plus className="w-4 h-4" /> Nova Conversa
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {conversations.map(conv => (
              <button
                key={conv.id}
                onClick={() => loadConversation(conv)}
                className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors mb-1 ${activeConv === conv.id ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
              >
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="truncate">{conv.title || 'Conversa'}</span>
                </div>
              </button>
            ))}
          </div>
        </aside>

        {/* Main Chat */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {messages.length === 0 ? (
            <div className="flex-1 overflow-y-auto p-6">
              <div className="max-w-2xl mx-auto text-center">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center mx-auto mb-4">
                  <Bot className="w-9 h-9 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                  Olá, {firstName}! Sou o FitBot 🤖
                </h2>
                <p className="text-gray-500 dark:text-gray-400 mb-8">
                  Seu personal trainer e nutricionista virtual 24/7. Pergunte sobre treinos, dieta, exercícios ou evolução!
                </p>

                {profile?.goal && (
                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 rounded-full text-sm mb-8">
                    <Sparkles className="w-4 h-4" />
                    Personalizado para: <strong>{profile.goal}</strong> • Nível: {profile.experience_level ?? 'não definido'}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {QUICK_PROMPTS.map(({ icon, label, prompt }) => (
                    <button
                      key={label}
                      onClick={() => sendMessage(prompt)}
                      className="flex items-center gap-3 p-4 text-left rounded-xl border border-gray-200 dark:border-gray-700 hover:border-emerald-300 dark:hover:border-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-900/10 transition-all group"
                    >
                      <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 group-hover:bg-emerald-200 dark:group-hover:bg-emerald-900/50 transition-colors flex-shrink-0">
                        {icon}
                      </div>
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300 group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">
                        {label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-6">
              {messages.map((msg, i) => (
                <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${msg.role === 'user' ? 'bg-emerald-500' : 'bg-gradient-to-br from-emerald-500 to-teal-500'}`}>
                    {msg.role === 'user'
                      ? <User className="w-4 h-4 text-white" />
                      : <Bot className="w-4 h-4 text-white" />
                    }
                  </div>
                  <div className={`max-w-[80%] ${msg.role === 'user' ? 'items-end' : 'items-start'} flex flex-col`}>
                    <div className={`px-4 py-3 rounded-2xl ${
                      msg.role === 'user'
                        ? 'bg-emerald-500 text-white rounded-tr-sm text-sm leading-relaxed'
                        : 'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-gray-100 rounded-tl-sm shadow-sm'
                    }`}>
                      {msg.role === 'user'
                        ? msg.content
                        : <MarkdownText content={msg.content} />
                      }
                    </div>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center flex-shrink-0">
                    <Bot className="w-4 h-4 text-white" />
                  </div>
                  <div className="px-4 py-3 rounded-2xl rounded-tl-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm">
                    <div className="flex gap-1.5 items-center h-5">
                      {[0, 1, 2].map(i => (
                        <div key={i} className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                      ))}
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}

          {/* Input */}
          <div className="border-t border-gray-200 dark:border-gray-800 p-4 bg-white dark:bg-gray-950">
            <div className="max-w-4xl mx-auto flex gap-3 items-end">
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Pergunte sobre treinos, dieta, exercícios... (Enter para enviar)"
                className="flex-1 min-h-[44px] max-h-32 resize-none"
                rows={1}
              />
              <Button
                onClick={() => sendMessage()}
                disabled={!input.trim() || isLoading}
                size="icon"
                className="h-11 w-11 flex-shrink-0"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </Button>
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-600 text-center mt-2">
              FitBot usa IA. Para questões médicas sérias, consulte um profissional de saúde.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
