'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { getCurrentUser } from '@/lib/db/localStorage'
import { User, InterfaceLanguage } from '@/types'
import { speakText } from '@/lib/db/bankHelpers'
import PageHeader from '@/components/PageHeader'
import BottomNav from '@/components/BottomNav'
import { useEngine } from '@/lib/engine/useEngine'
import { Send } from 'lucide-react'

type CoachMode = 'discussion' | 'revision' | 'professional'

interface Message {
  role: 'coach' | 'user'
  text: string
  timestamp: Date
}

export default function CoachPage() {
  const router = useRouter()
  const engine = useEngine()
  const [user, setUser] = useState<User | null>(null)
  const [lang, setLang] = useState<InterfaceLanguage>('fr')
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState<CoachMode>('discussion')
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const currentUser = getCurrentUser()
    if (!currentUser) { router.push('/auth'); return }
    setUser(currentUser)
    setLang(currentUser.settings.interfaceLang || 'fr')

    // Initial coach greeting
    const greeting = currentUser.settings.interfaceLang === 'fr'
      ? `Salut ${currentUser.firstName || 'apprenant'} ! Je suis ton coach IA. Comment veux-tu t'entraîner aujourd'hui ?`
      : `Hi ${currentUser.firstName || 'learner'}! I'm your AI coach. How would you like to practice today?`

    setMessages([{ role: 'coach', text: greeting, timestamp: new Date() }])
    setLoading(false)
  }, [router])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const activeLang = user?.activeLang || 'en'

  // Generate coach response based on mode
  const generateResponse = (userText: string): string => {
    const lower = userText.toLowerCase()

    if (mode === 'revision') {
      // Revision mode: quiz the user on vocabulary
      const training = engine.progress ? engine.getTraining('guided') : null
      if (training && training.words.length > 0) {
        const randomWord = training.words[Math.floor(Math.random() * training.words.length)]
        return lang === 'fr'
          ? `Comment dit-on "${randomWord.word_native}" en anglais ? 🤔`
          : `How do you say "${randomWord.word_native}" in English? 🤔`
      }
      return lang === 'fr'
        ? 'Termine ton premier cours pour débloquer les révisions avec le coach !'
        : 'Complete your first course to unlock coach revisions!'
    }

    if (mode === 'professional') {
      // Professional mode: GRC/business context
      if (lower.includes('réunion') || lower.includes('meeting')) {
        return lang === 'fr'
          ? 'Pour une réunion en anglais, essaie : "Let\'s start with the agenda." / "I\'d like to raise a point." / "Can we move to the next item?"'
          : 'For meetings, try: "Let\'s start with the agenda." / "I\'d like to raise a point." / "Can we move to the next item?"'
      }
      if (lower.includes('email') || lower.includes('mail')) {
        return lang === 'fr'
          ? 'Structure d\'un email pro : "Dear [Name], I am writing to..." puis "Kind regards, [Your name]"'
          : 'Professional email structure: "Dear [Name], I am writing to..." then "Kind regards, [Your name]"'
      }
      return lang === 'fr'
        ? 'Dis-moi le contexte professionnel : réunion, email, présentation, ou négociation ?'
        : 'Tell me the professional context: meeting, email, presentation, or negotiation?'
    }

    // Discussion mode: respond contextually
    if (lower.includes('bonjour') || lower.includes('hello') || lower.includes('hi')) {
      speakText('Hello! Nice to meet you!', activeLang)
      return 'Hello! Nice to meet you! 👋 How are you doing today?'
    }

    if (lower.includes('comment') || lower.includes('how')) {
      return lang === 'fr'
        ? 'En anglais, on répond "I\'m fine, thank you!" ou "I\'m doing well!" Essaie de me le dire ! 🎤'
        : 'You can answer: "I\'m fine, thank you!" or "I\'m doing well!" Try saying it! 🎤'
    }

    // Default: encourage practice
    const prompts = lang === 'fr'
      ? [
        'Essaie de me dire une phrase en anglais ! Je corrigerai.',
        'Comment dirais-tu ça en anglais ? Je t\'aide.',
        'Répète après moi : "I would like to practice English." 🎤',
        'Bonne réponse ! Continue comme ça. Essaie maintenant de me poser une question en anglais.',
      ]
      : [
        'Try telling me a sentence in English! I\'ll help you improve it.',
        'How would you say that in English? Let me help.',
        'Repeat after me: "I would like to practice English." 🎤',
        'Good job! Keep going. Now try asking me a question in English.',
      ]
    return prompts[Math.floor(Math.random() * prompts.length)]
  }

  const handleSend = () => {
    if (!input.trim()) return
    const userMsg: Message = { role: 'user', text: input.trim(), timestamp: new Date() }
    setMessages(prev => [...prev, userMsg])
    setInput('')

    // Simulate coach response delay
    setTimeout(() => {
      const response = generateResponse(userMsg.text)
      setMessages(prev => [...prev, { role: 'coach', text: response, timestamp: new Date() }])
    }, 600)
  }

  if (loading || !user) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#F0F0F0]">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-[#002844]" />
      </div>
    )
  }

  const modes: { id: CoachMode; labelFr: string; labelEn: string; icon: string }[] = [
    { id: 'discussion', labelFr: 'Discussion', labelEn: 'Discussion', icon: '💬' },
    { id: 'revision', labelFr: 'Révision ciblée', labelEn: 'Targeted review', icon: '🎯' },
    { id: 'professional', labelFr: 'Mode pro', labelEn: 'Professional', icon: '💼' },
  ]

  return (
    <div className="flex flex-col h-screen bg-[#F0F0F0]">
      <PageHeader title={lang === 'fr' ? 'Coach IA' : 'AI Coach'} backHref="/dashboard" />

      {/* Mode selector */}
      <div className="flex gap-2 px-4 py-2 bg-white border-b">
        {modes.map(m => (
          <button key={m.id} onClick={() => setMode(m.id)}
            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
              mode === m.id ? 'bg-[#002844] text-white' : 'bg-gray-100 text-[#555]'
            }`}>
            {m.icon} {lang === 'fr' ? m.labelFr : m.labelEn}
          </button>
        ))}
      </div>

      {/* Messages */}
      <main className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'coach' && (
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#7B1FA2] to-[#9C27B0] flex items-center justify-center flex-shrink-0 mr-2">
                <span className="text-sm">🤖</span>
              </div>
            )}
            <div className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm ${
              msg.role === 'user'
                ? 'bg-[#002844] text-white rounded-br-md'
                : 'bg-white text-[#002844] shadow-sm rounded-bl-md'
            }`}>
              {msg.text}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </main>

      {/* Input */}
      <div className="bg-white border-t px-4 py-3 pb-20">
        <div className="flex gap-2 max-w-lg mx-auto">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            placeholder={lang === 'fr' ? 'Écris ton message...' : 'Type your message...'}
            className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-[#002844] focus:outline-none focus:border-[#D9B438]"
          />
          <button onClick={handleSend} disabled={!input.trim()}
            className="w-10 h-10 rounded-xl bg-[#002844] flex items-center justify-center disabled:opacity-50">
            <Send className="h-4 w-4 text-white" />
          </button>
        </div>
      </div>

      <BottomNav lang={lang} />
    </div>
  )
}
