'use client'

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { getCurrentUser } from '@/lib/db/localStorage'
import { User, InterfaceLanguage } from '@/types'
import PageHeader from '@/components/PageHeader'
import BottomNav from '@/components/BottomNav'
import { Send, Mic, MicOff } from 'lucide-react'
import { getA1CourseVocabulary } from '@/lib/db/bankA1Courses'

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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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

    // P0-5/P0-8: Load learnt vocabulary ONLY from completed A1 courses (not legacy)
    const aLang = currentUser.activeLang || currentUser.settings.learningLangs[0] || 'en'
    const scoreKey = `lingualearn_course_scores_${currentUser.id}_${aLang}`
    const scores: Record<string, any> = (() => { try { return JSON.parse(localStorage.getItem(scoreKey) || '{}') } catch { return {} } })()
    const completedCourseIds = Object.keys(scores).filter(id => scores[id]?.score >= 60)
    const learnedWordPairs: { word: string; trad: string }[] = []
    completedCourseIds.forEach(cid => {
      const vocab = getA1CourseVocabulary(cid)
      vocab.forEach(v => learnedWordPairs.push({ word: v.word_target, trad: v.word_fr }))
    })
    setLearntVocab(learnedWordPairs.map(p => p.word))
    // Store word pairs for answer validation
    try { localStorage.setItem('_coach_word_pairs', JSON.stringify(learnedWordPairs)) } catch {}

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

    // P0-5: Coach proactive first question based on learned vocab (deterministic)
    let firstQuestion = ''
    if (learnedWordPairs.length > 0) {
      const firstPair = learnedWordPairs[0]
      firstQuestion = interfaceLang === 'fr'
        ? `On a appris "${firstPair.trad}". Comment dit-on ce mot en anglais ? 🤔`
        : `We learned "${firstPair.trad}". How do you say this word in English? 🤔`
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

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const getLearnedVocabForContext = (): string[] => {
    const learned = learntVocab.slice(0, 10)
    return learned.length > 0 ? learned : ['hello', 'goodbye', 'thank you']
  }

  // P0-5: Track current expected word for validation
  const [expectedWord, setExpectedWord] = useState<{ word: string; trad: string } | null>(null)
  // P0-5: Deterministic word index (cycles through words)
  const wordIdxRef = useRef(0)

  // P0-5: Get word pairs from localStorage
  const getWordPairs = (): { word: string; trad: string }[] => {
    try {
      const raw = localStorage.getItem('_coach_word_pairs')
      return raw ? JSON.parse(raw) : learntVocab.map(w => ({ word: w, trad: '' }))
    } catch { return learntVocab.map(w => ({ word: w, trad: '' })) }
  }

  // P0-5: Get next word deterministically (cycles through learned words)
  const getNextWordPair = (): { word: string; trad: string } => {
    const pairs = getWordPairs()
    if (pairs.length === 0) return { word: 'hello', trad: 'bonjour' }
    const idx = wordIdxRef.current % pairs.length
    wordIdxRef.current++
    return pairs[idx]
  }

  // P0-5: Validate user answer against expected word
  const validateAnswer = (userText: string, expected: { word: string; trad: string }): boolean => {
    const lower = userText.toLowerCase().trim()
    return lower === expected.word.toLowerCase() || lower === expected.trad.toLowerCase()
  }

  // P0-5/P0-6: Generate coach response based on mode with answer validation
  const generateResponse = (userText: string): string => {
    // P0-6: REVISION MODE = drill on weak words, always validates answer
    if (mode === 'revision') {
      if (isUnknownPhrase(userText)) {
        if (expectedWord) {
          const nextPair = getNextWordPair()
          setExpectedWord(nextPair)
          return lang === 'fr'
            ? `La réponse était : **${expectedWord.word}** (${expectedWord.trad}). Répète : "${expectedWord.word}". 🎤\n\nMaintenant, comment dit-on "${nextPair.trad}" en anglais ? 🤔`
            : `The answer was: **${expectedWord.word}** (${expectedWord.trad}). Repeat: "${expectedWord.word}". 🎤\n\nNow, how do you say "${nextPair.trad}" in English? 🤔`
        }
        const pair = getNextWordPair()
        setExpectedWord(pair)
        return lang === 'fr'
          ? `Comment dit-on "${pair.trad}" en anglais ? 🤔`
          : `How do you say "${pair.trad}" in English? 🤔`
      }

      // P0-5: Validate against SPECIFIC expected word
      if (expectedWord) {
        const isCorrect = validateAnswer(userText, expectedWord)
        const nextPair = getNextWordPair()
        setExpectedWord(nextPair)
        if (isCorrect) {
          return lang === 'fr'
            ? `Correct ! "${expectedWord.word}" = ${expectedWord.trad}. 🎉\n\nSuivant : comment dit-on "${nextPair.trad}" en anglais ? 🤔`
            : `Correct! "${expectedWord.word}" = ${expectedWord.trad}. 🎉\n\nNext: how do you say "${nextPair.trad}" in English? 🤔`
        } else {
          return lang === 'fr'
            ? `Pas tout à fait. La bonne réponse est **${expectedWord.word}** (${expectedWord.trad}). Répète : "${expectedWord.word}". 🎤\n\nContinuons : comment dit-on "${nextPair.trad}" en anglais ? 🤔`
            : `Not quite. The correct answer is **${expectedWord.word}** (${expectedWord.trad}). Repeat: "${expectedWord.word}". 🎤\n\nLet's continue: how do you say "${nextPair.trad}" in English? 🤔`
        }
      }

      // No expected word yet — start drilling
      const pair = getNextWordPair()
      setExpectedWord(pair)
      return lang === 'fr'
        ? `Mode révision activé ! Comment dit-on "${pair.trad}" en anglais ? 🤔`
        : `Revision mode on! How do you say "${pair.trad}" in English? 🤔`
    }

    // P0-6: DISCUSSION MODE = situational questions about learned words in context
    if (mode === 'discussion') {
      if (isUnknownPhrase(userText)) {
        const pair = getNextWordPair()
        setExpectedWord(pair)
        return lang === 'fr'
          ? `Pas de souci ! Essaie avec "${pair.trad}". Comment dit-on ça en anglais ? 🤔`
          : `No worries! Try "${pair.trad}". How do you say that in English? 🤔`
      }

      // P0-5: Validate if there's an expected answer
      if (expectedWord) {
        const isCorrect = validateAnswer(userText, expectedWord)
        const nextPair = getNextWordPair()
        if (isCorrect) {
          setExpectedWord(nextPair)
          return lang === 'fr'
            ? `Bravo ! "${expectedWord.word}" est correct. 🎉 Imagine que tu es dans un café. Comment utiliserais-tu "${nextPair.word}" dans une phrase ? 🎤`
            : `Well done! "${expectedWord.word}" is correct. 🎉 Imagine you're in a café. How would you use "${nextPair.word}" in a sentence? 🎤`
        } else {
          setExpectedWord(nextPair)
          return lang === 'fr'
            ? `On cherchait **${expectedWord.word}** (${expectedWord.trad}). 📖\n\nEssaie maintenant : comment dit-on "${nextPair.trad}" en anglais ? 🤔`
            : `We were looking for **${expectedWord.word}** (${expectedWord.trad}). 📖\n\nNow try: how do you say "${nextPair.trad}" in English? 🤔`
        }
      }

      // Start discussion with situational context
      const pair = getNextWordPair()
      setExpectedWord(pair)
      return lang === 'fr'
        ? `Imagine que tu rencontres quelqu'un. Comment dit-on "${pair.trad}" en anglais ? 🤔`
        : `Imagine you're meeting someone. How do you say "${pair.trad}" in English? 🤔`
    }

    // P0-6: PROFESSIONAL MODE — hidden for A1/B, provides business context phrases
    if (mode === 'professional') {
      const lower = userText.toLowerCase()
      if (isUnknownPhrase(userText)) {
        return lang === 'fr'
          ? `Dis-moi un contexte pro : réunion, email, ou présentation ? Je te donnerai les phrases clés. 😊`
          : `Tell me a pro context: meeting, email, or presentation? I'll give you key phrases. 😊`
      }
      if (lower.includes('réunion') || lower.includes('meeting')) {
        return lang === 'fr'
          ? `Pour une réunion :\n• "Let's start." = Commençons.\n• "I have a question." = J'ai une question.\n• "Can we continue?" = On continue ?\n\nEssaie d'utiliser une de ces phrases ! 🎤`
          : `For meetings:\n• "Let's start."\n• "I have a question."\n• "Can we continue?"\n\nTry using one! 🎤`
      }
      if (lower.includes('email') || lower.includes('mail')) {
        return lang === 'fr'
          ? `Pour un email pro :\n• "Dear [Name]," = Cher [Nom],\n• "I am writing to..." = Je vous écris pour...\n• "Kind regards," = Cordialement,\n\nÉcris un début d'email en anglais ! 📧`
          : `For emails:\n• "Dear [Name],"\n• "I am writing to..."\n• "Kind regards,"\n\nWrite an email start! 📧`
      }
      return lang === 'fr'
        ? 'Choisis un contexte : réunion, email, ou présentation ? 💼'
        : 'Choose a context: meeting, email, or presentation? 💼'
    }

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

  // P0-6: Only show modes appropriate for user level (hide 'professional' for A1/Path B)
  const userLevel = user?.progress?.[user?.activeLang || 'en']?.levelCecrl || 'A1'
  const langConfig = user?.settings?.languageConfigs?.[user?.activeLang || 'en']
  const learningPaths = langConfig?.learningPath
    ? (Array.isArray(langConfig.learningPath) ? langConfig.learningPath : [langConfig.learningPath])
    : []
  const isPathB = learningPaths.includes('B') && !learningPaths.includes('A')
  const showPro = userLevel !== 'A1' && !isPathB
  const modes: { id: CoachMode; labelFr: string; labelEn: string; icon: string }[] = [
    { id: 'discussion', labelFr: 'Discussion', labelEn: 'Discussion', icon: '💬' },
    { id: 'revision', labelFr: 'Révision ciblée', labelEn: 'Targeted review', icon: '🎯' },
    ...(showPro ? [{ id: 'professional' as CoachMode, labelFr: 'Mode pro', labelEn: 'Professional', icon: '💼' }] : []),
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
