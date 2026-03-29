'use client'

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { getCurrentUser } from '@/lib/db/localStorage'
import { User, InterfaceLanguage } from '@/types'
import PageHeader from '@/components/PageHeader'
import BottomNav from '@/components/BottomNav'
import { Send, Mic, MicOff } from 'lucide-react'

type CoachMode = 'discussion' | 'revision' | 'professional'

interface Message {
  role: 'coach' | 'user'
  text: string
  timestamp: Date
}

interface WeakWord {
  word: string
  word_native: string
  score: number
}

declare global {
  interface Window {
    webkitSpeechRecognition?: any
  }
}

export default function CoachPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [lang, setLang] = useState<InterfaceLanguage>('fr')
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState<CoachMode>('discussion')
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isListening, setIsListening] = useState(false)
  const [speechSupported, setSpeechSupported] = useState(false)
  const [learntVocab, setLearntVocab] = useState<string[]>([])
  const [weakWords, setWeakWords] = useState<WeakWord[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const recognitionRef = useRef<any>(null)

  // Initialize speech recognition
  useEffect(() => {
    const SpeechRecognition = window.webkitSpeechRecognition || (window as any).SpeechRecognition
    if (SpeechRecognition) {
      setSpeechSupported(true)
      recognitionRef.current = new SpeechRecognition()
      recognitionRef.current.continuous = false
      recognitionRef.current.interimResults = false
      recognitionRef.current.lang = lang === 'fr' ? 'fr-FR' : 'en-US'

      recognitionRef.current.onstart = () => setIsListening(true)
      recognitionRef.current.onend = () => setIsListening(false)
      recognitionRef.current.onerror = () => setIsListening(false)

      recognitionRef.current.onresult = (event: any) => {
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript
          if (event.results[i].isFinal) {
            setInput(prev => prev + (prev ? ' ' : '') + transcript)
          }
        }
      }
    }
  }, [lang])

  useEffect(() => {
    const currentUser = getCurrentUser()
    if (!currentUser) {
      router.push('/auth')
      return
    }
    setUser(currentUser)
    const interfaceLang = currentUser.settings.interfaceLang || 'fr'
    setLang(interfaceLang)

    // Load learnt vocabulary from completed courses
    const completedCourses = JSON.parse(localStorage.getItem('completedCourses') || '[]')
    const learnedWords = new Set<string>()
    completedCourses.forEach((course: any) => {
      if (course.words && Array.isArray(course.words)) {
        course.words.forEach((word: any) => {
          if (typeof word === 'string') learnedWords.add(word)
          else if (word.word) learnedWords.add(word.word)
        })
      }
    })
    setLearntVocab(Array.from(learnedWords))

    // Load weak words from review items
    const reviewItems = JSON.parse(localStorage.getItem('reviewItems') || '[]')
    const weak = reviewItems
      .filter((item: any) => item.score < 0.6)
      .sort((a: any, b: any) => a.score - b.score)
      .slice(0, 20)
    setWeakWords(weak)

    // Initial coach greeting with proactive first question
    const greeting = interfaceLang === 'fr'
      ? `Salut ${currentUser.firstName || 'apprenant'} ! On s'entraîne ensemble ?`
      : `Hi ${currentUser.firstName || 'learner'}! Let's practice together?`

    // Coach proactive first question based on learned vocab
    let firstQuestion = ''
    if (learnedWords.size > 0) {
      const wordsArr = Array.from(learnedWords)
      const randomWord = wordsArr[Math.floor(Math.random() * Math.min(5, wordsArr.length))]
      firstQuestion = interfaceLang === 'fr'
        ? `On vient de voir "${randomWord}". Comment dit-on ce mot en anglais ? 🤔`
        : `We just learned "${randomWord}". How do you say this word? 🤔`
    } else {
      firstQuestion = interfaceLang === 'fr'
        ? `Commençons simplement : comment dit-on "bonjour" en anglais ? 🤔`
        : `Let's start simple: how do you say "hello" in English? 🤔`
    }

    setMessages([
      { role: 'coach', text: greeting, timestamp: new Date() },
      { role: 'coach', text: firstQuestion, timestamp: new Date() },
    ])
    setLoading(false)
  }, [router])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Check if user said "I don't know"
  const isUnknownPhrase = (text: string): boolean => {
    const lower = text.toLowerCase().trim()
    return (
      lower === 'je ne sais pas' ||
      lower === 'i don\'t know' ||
      lower === 'i dont know' ||
      lower === 'dunno' ||
      lower === 'no idea' ||
      lower === 'idk'
    )
  }

  // Get learnt vocabulary for discussion mode
  const getLearnedVocabForContext = (): string[] => {
    const learned = learntVocab.slice(0, 10) // Use first 10 for variety
    return learned.length > 0 ? learned : ['hello', 'goodbye', 'thank you']
  }

  // Generate coach response based on mode
  const generateResponse = (userText: string): string => {
    const lower = userText.toLowerCase()

    // REVISION MODE: Coach asks about weak words - ALWAYS ends with new question
    if (mode === 'revision') {
      if (isUnknownPhrase(userText)) {
        // User doesn't know - give answer, example, ask to repeat then ask next word
        if (weakWords.length > 0) {
          const word = weakWords[Math.floor(Math.random() * Math.min(5, weakWords.length))]
          const answer = word.word
          const nativeWord = word.word_native

          // Get next word for follow-up question
          const nextWord = weakWords[Math.floor(Math.random() * Math.min(5, weakWords.length))]

          // Coach gives answer and example in pedagogical language, then asks next question
          const response = lang === 'fr'
            ? `Pas de souci ! "${nativeWord}" se dit **${answer}** en anglais. Par exemple : "I like apples." Répète après moi : "${answer}". 🎤\n\nMaintenant, comment dit-on "${nextWord.word_native}" en anglais ? 🤔`
            : `No worries! "${nativeWord}" is **${answer}** in English. For example: "I like apples." Repeat after me: "${answer}". 🎤\n\nNow, how do you say "${nextWord.word_native}" in English? 🤔`
          return response
        }
        return lang === 'fr'
          ? 'Complète un premier cours pour débloquer les révisions !'
          : 'Complete your first course to unlock revisions!'
      }

      // Normal revision: ask about a weak word
      if (weakWords.length > 0) {
        const word = weakWords[Math.floor(Math.random() * Math.min(5, weakWords.length))]
        return lang === 'fr'
          ? `Comment dit-on "${word.word_native}" en anglais ? 🤔`
          : `How do you say "${word.word_native}" in English? 🤔`
      }

      return lang === 'fr'
        ? 'Termine ton premier cours pour débloquer les révisions avec le coach !'
        : 'Complete your first course to unlock coach revisions!'
    }

    // PROFESSIONAL MODE: GRC/business context - ALWAYS ends with a question/request
    if (mode === 'professional') {
      if (isUnknownPhrase(userText)) {
        return lang === 'fr'
          ? `Pas de souci ! Dis-moi un contexte professionnel : réunion, email, présentation ou négociation ? Je t'aiderai. 😊`
          : `No worries! Tell me a professional context: meeting, email, presentation, or negotiation? I'll help. 😊`
      }

      if (lower.includes('réunion') || lower.includes('meeting')) {
        const examples = lang === 'fr'
          ? `Pour une réunion en anglais, essaie ces phrases simples :
          • "Let's start." = Commençons.
          • "I have a question." = J'ai une question.
          • "Can we continue?" = Pouvons-nous continuer ?

Essaie d'en utiliser une pour une fausse réunion ! 🎤`
          : `For meetings, try these simple sentences:
          • "Let's start."
          • "I have a question."
          • "Can we continue?"

Try using one of these in a mock meeting! 🎤`
        return examples
      }

      if (lower.includes('email') || lower.includes('mail')) {
        const examples = lang === 'fr'
          ? `Pour un email professionnel simple :
          • "Dear [Name]," = Cher [Nom],
          • "I am writing to..." = Je vous écris pour...
          • "Kind regards," = Cordialement,

Maintenant, commence un email en anglais ! 📧`
          : `For professional emails:
          • "Dear [Name],"
          • "I am writing to..."
          • "Kind regards,"

Now, start writing an email in English! 📧`
        return examples
      }

      if (lower.includes('présentation') || lower.includes('presentation')) {
        const examples = lang === 'fr'
          ? `Pour une présentation en anglais :
          • "Good morning." = Bonjour.
          • "Today I will..." = Aujourd'hui, je vais...
          • "Any questions?" = Des questions ?

Essaie de présenter quelque chose en anglais ! 🎤`
          : `For presentations:
          • "Good morning."
          • "Today I will..."
          • "Any questions?"

Try presenting something in English! 🎤`
        return examples
      }

      return lang === 'fr'
        ? 'Dis-moi un contexte : réunion 📞, email 📧, présentation 🎤, ou négociation 🤝 ?'
        : 'Tell me a context: meeting 📞, email 📧, presentation 🎤, or negotiation 🤝?'
    }

    // DISCUSSION MODE: Contextual conversation with learnt vocab - ALWAYS ends with specific question
    if (mode === 'discussion') {
      if (isUnknownPhrase(userText)) {
        const learnedVocab = getLearnedVocabForContext()
        const word = learnedVocab[Math.floor(Math.random() * learnedVocab.length)] || 'hello'
        const nextWord = learnedVocab[Math.floor(Math.random() * learnedVocab.length)] || 'goodbye'
        return lang === 'fr'
          ? `Pas de souci ! Essaie "**${word}**". Répète : "${word}". 🎤\n\nMaintenant, comment dit-on "${nextWord}" en anglais ? 🤔`
          : `No worries! Try "**${word}**". Repeat: "${word}". 🎤\n\nNow, how do you say "${nextWord}" in English? 🤔`
      }

      if (lower.includes('bonjour') || lower.includes('hello') || lower.includes('hi')) {
        const learnedVocab = getLearnedVocabForContext()
        const nextWord = learnedVocab[Math.floor(Math.random() * learnedVocab.length)] || 'goodbye'
        return lang === 'fr'
          ? `Salut ! Ça va ? 👋\n\nMaintenant, comment dit-on "${nextWord}" en anglais ? 🤔`
          : `Hi there! How are you? 👋\n\nNow, how do you say "${nextWord}" in English? 🤔`
      }

      if (lower.includes('comment') || lower.includes('how are')) {
        const learnedVocab = getLearnedVocabForContext()
        const nextWord = learnedVocab[Math.floor(Math.random() * learnedVocab.length)] || 'water'
        return lang === 'fr'
          ? `En anglais, on répond : "I\'m fine, thank you!" ou "I\'m doing well!" 🎤\n\nEssaie de faire une phrase avec "${nextWord}" ! 🎤`
          : `In English you can say: "I\'m fine, thank you!" or "I\'m doing well!" 🎤\n\nNow try making a sentence with "${nextWord}"! 🎤`
      }

      if (lower.includes('merci') || lower.includes('thanks') || lower.includes('thank')) {
        const learnedVocab = getLearnedVocabForContext()
        const nextWord = learnedVocab[Math.floor(Math.random() * learnedVocab.length)] || 'please'
        return lang === 'fr'
          ? `Bonne réponse ! En anglais : "You\'re welcome!" ou "No problem!" 😊\n\nMaintenant, comment dit-on "${nextWord}" en anglais ? 🤔`
          : `Good! In English: "You\'re welcome!" or "No problem!" 😊\n\nNow, how do you say "${nextWord}" in English? 🤔`
      }

      // Default encouraging prompts using learnt vocab - ALWAYS ask a specific question
      const learnedVocab = getLearnedVocabForContext()
      const randomWord = learnedVocab[Math.floor(Math.random() * learnedVocab.length)] || 'water'

      const prompts = lang === 'fr'
        ? [
          `Essaie de faire une phrase avec "${randomWord}" en anglais ! Je t'aiderai. 🎤`,
          `Maintenant, comment dit-on "${randomWord}" en anglais ? 🎤`,
          `Très bien ! Maintenant, fais une phrase avec "${randomWord}" ! 🌟`,
          `Bravo ! Dis-moi : comment dit-on "${randomWord}" en anglais ? 🤔`,
        ]
        : [
          `Try making a sentence with "${randomWord}" in English! I\'ll help. 🎤`,
          `Now, how do you say "${randomWord}" in English? 🎤`,
          `Great! Now make a sentence with "${randomWord}"! 🌟`,
          `Well done! Tell me: how do you say "${randomWord}" in English? 🤔`,
        ]

      return prompts[Math.floor(Math.random() * prompts.length)]
    }

    // Fallback
    return lang === 'fr' ? 'Dis-moi comment je peux t\'aider !' : 'Tell me how I can help!'
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

  const handleMicClick = () => {
    if (!recognitionRef.current) return

    if (isListening) {
      recognitionRef.current.stop()
      setIsListening(false)
    } else {
      setInput('')
      recognitionRef.current.start()
    }
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
            <div className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm whitespace-pre-wrap ${
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

      {/* Input with microphone */}
      <div className="bg-white border-t px-4 py-3 pb-20">
        <div className="flex gap-2 max-w-lg mx-auto items-center">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            placeholder={lang === 'fr' ? 'Écris ton message...' : 'Type your message...'}
            className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-[#002844] focus:outline-none focus:border-[#D9B438]"
          />

          {/* Microphone button */}
          <button
            onClick={handleMicClick}
            disabled={!speechSupported}
            title={speechSupported ? (lang === 'fr' ? 'Parle' : 'Speak') : (lang === 'fr' ? 'Non supporté' : 'Not supported')}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
              speechSupported
                ? isListening
                  ? 'bg-red-500 text-white animate-pulse'
                  : 'bg-blue-500 text-white hover:bg-blue-600'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed opacity-50'
            }`}
          >
            {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </button>

          {/* Send button */}
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
