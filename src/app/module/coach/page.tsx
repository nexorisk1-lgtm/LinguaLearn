'use client'

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { getCurrentUser } from '@/lib/db/localStorage'
import { User, InterfaceLanguage } from '@/types'
import PageHeader from '@/components/PageHeader'
import BottomNav from '@/components/BottomNav'
import { Send, Mic, MicOff, Volume2, Loader2 } from 'lucide-react'
import { getA1CourseVocabulary, getA1CourseData } from '@/lib/db/bankA1Courses'

type CoachMode = 'discussion' | 'revision'

interface Message {
  role: 'coach' | 'user'
  text: string
  timestamp: Date
}

interface CourseWord {
  word: string
  trad: string
  example_en?: string
  phonetic?: string
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
  const [isThinking, setIsThinking] = useState(false)
  const [courseWords, setCourseWords] = useState<CourseWord[]>([])
  const [activeCourseId, setActiveCourseId] = useState<string>('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const recognitionRef = useRef<any>(null)

  // TTS function
  const speakText = useCallback((text: string, speechLang: string = 'en') => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return
    window.speechSynthesis.cancel()
    const utter = new SpeechSynthesisUtterance(text)
    utter.lang = speechLang === 'en' ? 'en-US' : 'fr-FR'
    utter.rate = 0.9
    window.speechSynthesis.speak(utter)
  }, [])

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
    if (!currentUser) { router.push('/auth'); return }
    setUser(currentUser)
    const interfaceLang = currentUser.settings.interfaceLang || 'fr'
    setLang(interfaceLang)

    // Load vocabulary from completed courses
    const aLang = currentUser.activeLang || currentUser.settings.learningLangs[0] || 'en'
    const scoreKey = `lingualearn_course_scores_${currentUser.id}_${aLang}`
    const scores: Record<string, any> = (() => { try { return JSON.parse(localStorage.getItem(scoreKey) || '{}') } catch { return {} } })()
    const completedCourseIds = Object.keys(scores).filter(id => scores[id]?.score >= 60)

    // Find latest completed course for context
    const latestCourseId = completedCourseIds.length > 0
      ? completedCourseIds.sort((a, b) => {
          const numA = parseInt(a.replace('a1_c', ''))
          const numB = parseInt(b.replace('a1_c', ''))
          return numB - numA
        })[0]
      : 'a1_c1'
    setActiveCourseId(latestCourseId)

    // Load words from that course
    const vocab = getA1CourseVocabulary(latestCourseId)
    const words: CourseWord[] = vocab.map(v => ({
      word: v.word_target,
      trad: v.word_fr,
      example_en: v.example_en,
      phonetic: v.phonetic,
    }))
    setCourseWords(words)

    // Get course title for greeting
    const courseData = getA1CourseData(latestCourseId)
    const courseTitle = courseData?.title || latestCourseId

    // Initial greeting with proactive first question
    const firstName = currentUser.firstName || 'apprenant'
    let greeting = ''
    let firstQ = ''

    if (words.length > 0) {
      greeting = interfaceLang === 'fr'
        ? `Salut ${firstName} ! On travaille le cours "${courseTitle}" ensemble. 🎓`
        : `Hi ${firstName}! Let's work on "${courseTitle}" together. 🎓`

      if (mode === 'revision') {
        firstQ = interfaceLang === 'fr'
          ? `On révise ! Mot 1/${words.length} :\nComment dit-on "${words[0].trad}" en anglais ? 🤔`
          : `Let's review! Word 1/${words.length}:\nHow do you say "${words[0].trad}" in English? 🤔`
      } else {
        const scenario = courseData?.scenario || ''
        firstQ = interfaceLang === 'fr'
          ? `${scenario ? `Imagine : ${scenario}\n` : ''}Comment dit-on "${words[0].trad}" en anglais ? 🤔`
          : `${scenario ? `Imagine: ${scenario}\n` : ''}How do you say "${words[0].trad}" in English? 🤔`
      }
    } else {
      greeting = interfaceLang === 'fr'
        ? `Salut ${firstName} ! Termine un cours d'abord pour qu'on puisse s'entraîner ensemble.`
        : `Hi ${firstName}! Complete a course first so we can practice together.`
      firstQ = ''
    }

    const initialMsgs: Message[] = [{ role: 'coach', text: greeting, timestamp: new Date() }]
    if (firstQ) initialMsgs.push({ role: 'coach', text: firstQ, timestamp: new Date() })
    setMessages(initialMsgs)
    setLoading(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // P0-1: Call LLM API for coach response
  const getCoachResponse = useCallback(async (userText: string, currentMessages: Message[]): Promise<string> => {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 6000)

      const response = await fetch('/api/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userMessage: userText,
          courseId: activeCourseId,
          mode,
          courseWords,
          conversationHistory: currentMessages.slice(-8).map(m => ({ role: m.role, text: m.text })),
          userName: user?.firstName || 'apprenant',
          interfaceLang: lang,
        }),
        signal: controller.signal,
      })

      clearTimeout(timeout)

      if (!response.ok) throw new Error('API error')
      const data = await response.json()
      return data.response || 'Continuons !'
    } catch {
      // Fallback: simple rule-based response
      return generateLocalFallback(userText)
    }
  }, [activeCourseId, mode, courseWords, user, lang])

  // Local fallback for when API is completely unreachable
  const generateLocalFallback = useCallback((userText: string): string => {
    const lower = userText.toLowerCase().trim()
    const isFr = lang === 'fr'
    const unknowns = ['je ne sais pas', "i don't know", 'idk', 'dunno']
    if (unknowns.some(u => lower.includes(u))) {
      const w = courseWords[0]
      return isFr
        ? `Pas de souci ! La réponse était "${w?.word}" (${w?.trad}). On continue !`
        : `No worries! The answer was "${w?.word}" (${w?.trad}). Let's continue!`
    }

    const exact = courseWords.find(w => w.word.toLowerCase() === lower || w.trad.toLowerCase() === lower)
    if (exact) {
      return isFr
        ? `Exactement ! ✅ "${exact.word}" = ${exact.trad}. ${exact.example_en ? `Ex: "${exact.example_en}"` : ''}`
        : `Exactly! ✅ "${exact.word}" = ${exact.trad}. ${exact.example_en ? `Ex: "${exact.example_en}"` : ''}`
    }

    const partial = courseWords.find(w => lower.includes(w.word.toLowerCase()) || lower.includes(w.trad.toLowerCase()))
    if (partial) {
      return isFr
        ? `Oui, ça marche aussi ⚠️ "${partial.word}" = ${partial.trad}.`
        : `Yes, that works too ⚠️ "${partial.word}" = ${partial.trad}.`
    }

    return isFr
      ? `Hmm, ce n'est pas tout à fait ça ❌. Essaie encore !`
      : `Hmm, not quite ❌. Try again!`
  }, [courseWords, lang])

  const handleSend = async () => {
    if (!input.trim() || isThinking) return
    const userMsg: Message = { role: 'user', text: input.trim(), timestamp: new Date() }
    const updatedMessages = [...messages, userMsg]
    setMessages(updatedMessages)
    setInput('')
    setIsThinking(true)

    const response = await getCoachResponse(userMsg.text, updatedMessages)
    setMessages(prev => [...prev, { role: 'coach', text: response, timestamp: new Date() }])
    setIsThinking(false)
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

  // Mode change: reset conversation with new first question
  const handleModeChange = (newMode: CoachMode) => {
    setMode(newMode)
    if (courseWords.length === 0) return
    const firstName = user?.firstName || 'apprenant'
    const courseData = activeCourseId ? getA1CourseData(activeCourseId) : null
    const isFr = lang === 'fr'

    let modeMsg = ''
    let firstQ = ''

    if (newMode === 'revision') {
      modeMsg = isFr
        ? `Mode révision ciblée activé ! On passe en revue tous les mots. 🎯`
        : `Targeted review mode activated! Let's go through all words. 🎯`
      firstQ = isFr
        ? `On révise ! Mot 1/${courseWords.length} :\nComment dit-on "${courseWords[0].trad}" en anglais ?`
        : `Let's review! Word 1/${courseWords.length}:\nHow do you say "${courseWords[0].trad}" in English?`
    } else {
      const scenario = courseData?.scenario || ''
      modeMsg = isFr
        ? `Mode discussion activé ! On pratique en situation. 💬`
        : `Discussion mode activated! Let's practice in context. 💬`
      firstQ = isFr
        ? `${scenario ? `Imagine : ${scenario}\n` : ''}${firstName}, comment dit-on "${courseWords[0].trad}" en anglais ?`
        : `${scenario ? `Imagine: ${scenario}\n` : ''}${firstName}, how do you say "${courseWords[0].trad}" in English?`
    }

    setMessages([
      { role: 'coach', text: modeMsg, timestamp: new Date() },
      { role: 'coach', text: firstQ, timestamp: new Date() },
    ])
  }

  if (loading || !user) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#F0F0F0]">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-[#002844]" />
      </div>
    )
  }

  // P1-5: Visual differentiation of modes
  const modes: { id: CoachMode; labelFr: string; labelEn: string; icon: string; descFr: string; descEn: string }[] = [
    {
      id: 'discussion',
      labelFr: 'Discussion',
      labelEn: 'Discussion',
      icon: '💬',
      descFr: 'Pratique en situation réelle',
      descEn: 'Real-life practice',
    },
    {
      id: 'revision',
      labelFr: 'Révision ciblée',
      labelEn: 'Targeted review',
      icon: '🎯',
      descFr: 'Mot par mot, validation stricte',
      descEn: 'Word by word, strict validation',
    },
  ]

  return (
    <div className="flex flex-col h-screen bg-[#F0F0F0]">
      <PageHeader title={lang === 'fr' ? 'Coach IA' : 'AI Coach'} backHref="/dashboard" />

      {/* P1-5: Mode selector with visual differentiation */}
      <div className="px-4 py-2 bg-white border-b">
        <div className="flex gap-2">
          {modes.map(m => (
            <button key={m.id} onClick={() => handleModeChange(m.id)}
              className={`flex-1 py-2.5 px-3 rounded-xl text-center transition-all ${
                mode === m.id
                  ? 'bg-[#002844] text-white shadow-md'
                  : 'bg-gray-100 text-[#555] hover:bg-gray-200'
              }`}>
              <span className="text-lg block">{m.icon}</span>
              <span className="text-xs font-bold block">{lang === 'fr' ? m.labelFr : m.labelEn}</span>
              <span className="text-[10px] block opacity-75">{lang === 'fr' ? m.descFr : m.descEn}</span>
            </button>
          ))}
        </div>
        {/* Course context indicator */}
        {activeCourseId && (
          <p className="text-[10px] text-center text-[#888] mt-1.5">
            📚 {lang === 'fr' ? 'Cours actif :' : 'Active course:'} {getA1CourseData(activeCourseId)?.title || activeCourseId} — {courseWords.length} {lang === 'fr' ? 'mots' : 'words'}
          </p>
        )}
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
            <div className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm whitespace-pre-wrap ${
              msg.role === 'user'
                ? 'bg-[#002844] text-white rounded-br-md'
                : 'bg-white text-[#002844] shadow-sm rounded-bl-md'
            }`}>
              {msg.text}
              {/* TTS button on coach messages containing English words */}
              {msg.role === 'coach' && (
                <button
                  onClick={() => {
                    // Extract English word between quotes if present
                    const match = msg.text.match(/"([^"]+)"/)
                    if (match) speakText(match[1], 'en')
                  }}
                  className="ml-2 inline-flex items-center opacity-50 hover:opacity-100 transition-opacity"
                  title={lang === 'fr' ? 'Écouter' : 'Listen'}
                >
                  <Volume2 className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>
        ))}

        {/* Thinking indicator */}
        {isThinking && (
          <div className="flex justify-start">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#7B1FA2] to-[#9C27B0] flex items-center justify-center flex-shrink-0 mr-2">
              <span className="text-sm">🤖</span>
            </div>
            <div className="bg-white text-[#002844] shadow-sm rounded-2xl rounded-bl-md px-4 py-3">
              <Loader2 className="h-4 w-4 animate-spin text-[#7B1FA2]" />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </main>

      {/* Input */}
      <div className="bg-white border-t px-4 py-3 pb-20">
        <div className="flex gap-2 max-w-lg mx-auto items-center">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder={lang === 'fr' ? 'Écris ta réponse...' : 'Type your answer...'}
            className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-[#002844] focus:outline-none focus:border-[#D9B438]"
            disabled={isThinking}
          />

          <button
            onClick={handleMicClick}
            disabled={!speechSupported || isThinking}
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

          <button onClick={handleSend} disabled={!input.trim() || isThinking}
            className="w-10 h-10 rounded-xl bg-[#002844] flex items-center justify-center disabled:opacity-50">
            <Send className="h-4 w-4 text-white" />
          </button>
        </div>
      </div>

      <BottomNav lang={lang} />
    </div>
  )
}
