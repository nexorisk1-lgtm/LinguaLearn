'use client'

/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */

import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { getCurrentUser } from '@/lib/db/localStorage'
import { User, InterfaceLanguage } from '@/types'
import PageHeader from '@/components/PageHeader'
import BottomNav from '@/components/BottomNav'
import { Send, Mic, MicOff, Volume2, VolumeX, Loader2 } from 'lucide-react'
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

  // P0-1: Track which word is currently being asked
  const [currentWordIdx, setCurrentWordIdx] = useState(0)

  // P0-2B: Global sound toggle
  const [soundEnabled, setSoundEnabled] = useState(true)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const recognitionRef = useRef<any>(null)

  // P0-2A: Auto-send timer ref
  const autoSendTimerRef = useRef<NodeJS.Timeout | null>(null)
  const pendingTranscriptRef = useRef<string>('')

  // TTS function — P0-2B: respects global toggle
  const speakText = useCallback((text: string, speechLang: string = 'fr') => {
    if (!soundEnabled) return
    if (typeof window === 'undefined' || !window.speechSynthesis) return
    window.speechSynthesis.cancel()
    const utter = new SpeechSynthesisUtterance(text)
    utter.lang = speechLang === 'en' ? 'en-US' : 'fr-FR'
    utter.rate = 0.9
    window.speechSynthesis.speak(utter)
  }, [soundEnabled])

  // P0-2B: Auto-TTS on coach messages — extract clean text for speech
  const speakCoachMessage = useCallback((text: string) => {
    if (!soundEnabled) return
    if (typeof window === 'undefined' || !window.speechSynthesis) return
    window.speechSynthesis.cancel()
    // Clean emojis and special chars for cleaner TTS
    // Remove emojis for cleaner TTS — keep only ASCII + accented letters
    const clean = text.replace(/[^a-zA-Z0-9\u00C0-\u024F\s.,;:!?'"()-]/g, '').trim()
    if (!clean) return
    const utter = new SpeechSynthesisUtterance(clean)
    utter.lang = 'fr-FR' // Coach speaks French (with English words inline)
    utter.rate = 0.9
    window.speechSynthesis.speak(utter)
  }, [soundEnabled])

  // P0-1: Compute contextual fields for current word
  const getContextualFields = useCallback((wordIdx: number) => {
    if (courseWords.length === 0) return null
    const idx = wordIdx % courseWords.length
    const currentWord = courseWords[idx]
    const isFr = lang === 'fr'

    // Build question string
    const questionAsked = isFr
      ? `comment dit-on "${currentWord.trad}" en anglais ?`
      : `how do you say "${currentWord.trad}" in English?`

    // Find English synonyms: other course words with same French translation
    const acceptableSynonyms = courseWords
      .filter((w, i) => i !== idx && w.trad.toLowerCase() === currentWord.trad.toLowerCase())
      .map(w => w.word)

    return {
      questionAsked,
      expectedWord: currentWord.word,
      expectedTrad: currentWord.trad,
      acceptableSynonyms,
    }
  }, [courseWords, lang])

  // Build the question text for a given word index
  const buildQuestionText = useCallback((wordIdx: number, courseData: any = null) => {
    if (courseWords.length === 0) return ''
    const idx = wordIdx % courseWords.length
    const w = courseWords[idx]
    const isFr = lang === 'fr'

    if (mode === 'revision') {
      return isFr
        ? `Mot ${idx + 1}/${courseWords.length} :\nComment dit-on "${w.trad}" en anglais ?`
        : `Word ${idx + 1}/${courseWords.length}:\nHow do you say "${w.trad}" in English?`
    } else {
      const scenario = courseData?.scenario || ''
      return isFr
        ? `${scenario ? `Imagine : ${scenario}\n` : ''}Comment dit-on "${w.trad}" en anglais ?`
        : `${scenario ? `Imagine: ${scenario}\n` : ''}How do you say "${w.trad}" in English?`
    }
  }, [courseWords, lang, mode])

  // Initialize speech recognition with P0-2A auto-send
  useEffect(() => {
    const SpeechRecognition = window.webkitSpeechRecognition || (window as any).SpeechRecognition
    if (SpeechRecognition) {
      setSpeechSupported(true)
      const recognition = new SpeechRecognition()
      recognition.continuous = false
      recognition.interimResults = false
      recognition.lang = lang === 'fr' ? 'fr-FR' : 'en-US'

      recognition.onstart = () => {
        setIsListening(true)
        pendingTranscriptRef.current = ''
        if (autoSendTimerRef.current) {
          clearTimeout(autoSendTimerRef.current)
          autoSendTimerRef.current = null
        }
      }

      recognition.onresult = (event: any) => {
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript
          if (event.results[i].isFinal) {
            pendingTranscriptRef.current = transcript.trim()
            setInput(transcript.trim())
          }
        }
      }

      // P0-2A: On speech end, auto-send after 1.5s
      recognition.onend = () => {
        setIsListening(false)
        const transcript = pendingTranscriptRef.current
        if (transcript) {
          autoSendTimerRef.current = setTimeout(() => {
            // Trigger auto-send by setting a flag — handled in effect
            setInput(transcript)
            // Use a custom event to trigger send
            window.dispatchEvent(new CustomEvent('coach-auto-send', { detail: transcript }))
          }, 1500)
        }
      }

      recognition.onerror = () => {
        setIsListening(false)
        pendingTranscriptRef.current = ''
      }

      recognitionRef.current = recognition
    }
  }, [lang])

  // P0-2A: Listen for auto-send event
  const handleSendRef = useRef<((text?: string) => void) | null>(null)

  useEffect(() => {
    const handler = (e: any) => {
      const text = e.detail
      if (text && handleSendRef.current) {
        handleSendRef.current(text)
      }
    }
    window.addEventListener('coach-auto-send', handler)
    return () => window.removeEventListener('coach-auto-send', handler)
  }, [])

  useEffect(() => {
    const currentUser = getCurrentUser()
    if (!currentUser) { router.push('/auth'); return }
    setUser(currentUser)
    const interfaceLang = currentUser.settings.interfaceLang || 'fr'
    setLang(interfaceLang)

    const aLang = currentUser.activeLang || currentUser.settings.learningLangs[0] || 'en'
    const scoreKey = `lingualearn_course_scores_${currentUser.id}_${aLang}`
    const scores: Record<string, any> = (() => { try { return JSON.parse(localStorage.getItem(scoreKey) || '{}') } catch { return {} } })()
    const completedCourseIds = Object.keys(scores).filter(id => scores[id]?.score >= 60)

    const latestCourseId = completedCourseIds.length > 0
      ? completedCourseIds.sort((a, b) => {
          const numA = parseInt(a.replace('a1_c', ''))
          const numB = parseInt(b.replace('a1_c', ''))
          return numB - numA
        })[0]
      : 'a1_c1'
    setActiveCourseId(latestCourseId)

    const vocab = getA1CourseVocabulary(latestCourseId)
    const words: CourseWord[] = vocab.map(v => ({
      word: v.word_target,
      trad: v.word_fr,
      example_en: v.example_en,
      phonetic: v.phonetic,
    }))
    setCourseWords(words)

    const courseData = getA1CourseData(latestCourseId)
    const courseTitle = courseData?.title || latestCourseId
    const firstName = currentUser.firstName || 'apprenant'

    const initialMsgs: Message[] = []

    if (words.length > 0) {
      const greeting = interfaceLang === 'fr'
        ? `Salut ${firstName} ! On travaille le cours "${courseTitle}" ensemble. 🎓`
        : `Hi ${firstName}! Let's work on "${courseTitle}" together. 🎓`
      initialMsgs.push({ role: 'coach', text: greeting, timestamp: new Date() })

      // First question — word 0
      const isFr = interfaceLang === 'fr'
      let firstQ = ''
      if (mode === 'revision') {
        firstQ = isFr
          ? `On révise ! Mot 1/${words.length} :\nComment dit-on "${words[0].trad}" en anglais ? 🤔`
          : `Let's review! Word 1/${words.length}:\nHow do you say "${words[0].trad}" in English? 🤔`
      } else {
        const scenario = courseData?.scenario || ''
        firstQ = isFr
          ? `${scenario ? `Imagine : ${scenario}\n` : ''}Comment dit-on "${words[0].trad}" en anglais ? 🤔`
          : `${scenario ? `Imagine: ${scenario}\n` : ''}How do you say "${words[0].trad}" in English? 🤔`
      }
      initialMsgs.push({ role: 'coach', text: firstQ, timestamp: new Date() })
      setCurrentWordIdx(0)
    } else {
      const greeting = interfaceLang === 'fr'
        ? `Salut ${firstName} ! Termine un cours d'abord pour qu'on puisse s'entraîner ensemble.`
        : `Hi ${firstName}! Complete a course first so we can practice together.`
      initialMsgs.push({ role: 'coach', text: greeting, timestamp: new Date() })
    }

    setMessages(initialMsgs)
    setLoading(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router])

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // P0-2B: Auto-TTS when a new coach message is added
  const lastCoachMsgRef = useRef<string>('')
  useEffect(() => {
    if (messages.length === 0) return
    const lastMsg = messages[messages.length - 1]
    if (lastMsg.role === 'coach' && lastMsg.text !== lastCoachMsgRef.current) {
      lastCoachMsgRef.current = lastMsg.text
      // Small delay to let UI render first
      setTimeout(() => speakCoachMessage(lastMsg.text), 300)
    }
  }, [messages, speakCoachMessage])

  // P0-1: Call API with contextual fields + handle isCorrect/nextWordIdx
  const getCoachResponse = useCallback(async (userText: string, currentMessages: Message[]) => {
    const contextFields = getContextualFields(currentWordIdx)

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
          // P0-1: contextual fields
          questionAsked: contextFields?.questionAsked || '',
          expectedWord: contextFields?.expectedWord || '',
          expectedTrad: contextFields?.expectedTrad || '',
          acceptableSynonyms: contextFields?.acceptableSynonyms || [],
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

      // P0-1: Update currentWordIdx based on API response
      if (data.nextWordIdx !== undefined) {
        setCurrentWordIdx(data.nextWordIdx)
      }

      return data.response || 'Continuons !'
    } catch {
      // Fallback: contextual rule-based
      return generateLocalFallback(userText, contextFields)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCourseId, mode, courseWords, user, lang, currentWordIdx, getContextualFields])

  // P0-1: Local fallback now uses contextual fields (same logic as API)
  const generateLocalFallback = useCallback((userText: string, contextFields: ReturnType<typeof getContextualFields>): string => {
    if (!contextFields) return lang === 'fr' ? 'Continuons !' : "Let's continue!"

    const lower = userText.toLowerCase().trim()
    const expected = contextFields.expectedWord.toLowerCase()
    const expectedTrad = contextFields.expectedTrad
    const synonyms = contextFields.acceptableSynonyms.map(s => s.toLowerCase())
    const isFr = lang === 'fr'

    const nextIdx = (currentWordIdx + 1) % courseWords.length
    const nextWord = courseWords[nextIdx]

    // "I don't know"
    const unknowns = ['je ne sais pas', "i don't know", 'idk', 'dunno', 'no idea', 'aucune idée']
    if (unknowns.some(p => lower === p || lower.includes(p))) {
      setCurrentWordIdx(nextIdx)
      return isFr
        ? `Pas de souci ! La réponse était "${contextFields.expectedWord}" (${expectedTrad}). Mot suivant : comment dit-on "${nextWord?.trad}" en anglais ?`
        : `No worries! The answer was "${contextFields.expectedWord}" (${expectedTrad}). Next: how do you say "${nextWord?.trad}" in English?`
    }

    // EXACT match
    if (lower === expected) {
      setCurrentWordIdx(nextIdx)
      const cw = courseWords[currentWordIdx]
      const ex = cw?.example_en ? ` Ex: "${cw.example_en}"` : ''
      return isFr
        ? `Exactement ! ✅ "${contextFields.expectedWord}" = ${expectedTrad}.${ex} Mot suivant : comment dit-on "${nextWord?.trad}" en anglais ?`
        : `Exactly! ✅ "${contextFields.expectedWord}" = ${expectedTrad}.${ex} Next: how do you say "${nextWord?.trad}" in English?`
    }

    // SYNONYM match
    if (synonyms.includes(lower)) {
      setCurrentWordIdx(nextIdx)
      return isFr
        ? `Oui, ça marche aussi ⚠️ "${userText}" est correct pour "${expectedTrad}". La réponse principale est "${contextFields.expectedWord}". Mot suivant : comment dit-on "${nextWord?.trad}" en anglais ?`
        : `Yes, that works too ⚠️ "${userText}" is correct for "${expectedTrad}". The main answer is "${contextFields.expectedWord}". Next: how do you say "${nextWord?.trad}" in English?`
    }

    // WRONG: another course word
    const wrongWord = courseWords.find(w => w.word.toLowerCase() === lower)
    if (wrongWord) {
      // Stay on same word
      return isFr
        ? `Non, "${wrongWord.word}" veut dire "${wrongWord.trad}" ❌. Pour "${expectedTrad}", on dit "${contextFields.expectedWord}". On réessaie : comment dit-on "${expectedTrad}" en anglais ?`
        : `No, "${wrongWord.word}" means "${wrongWord.trad}" ❌. For "${expectedTrad}", we say "${contextFields.expectedWord}". Let's try again: how do you say "${expectedTrad}" in English?`
    }

    // WRONG: outside course
    return isFr
      ? `"${userText}" n'est pas dans notre cours ❌. Pour "${expectedTrad}", on dit "${contextFields.expectedWord}". On réessaie : comment dit-on "${expectedTrad}" en anglais ?`
      : `"${userText}" is not in our course ❌. For "${expectedTrad}", we say "${contextFields.expectedWord}". Let's try again: how do you say "${expectedTrad}" in English?`
  }, [courseWords, lang, currentWordIdx])

  const handleSend = useCallback(async (overrideText?: string) => {
    const text = overrideText || input.trim()
    if (!text || isThinking) return
    const userMsg: Message = { role: 'user', text, timestamp: new Date() }
    const updatedMessages = [...messages, userMsg]
    setMessages(updatedMessages)
    setInput('')
    setIsThinking(true)

    // Cancel any pending auto-send timer
    if (autoSendTimerRef.current) {
      clearTimeout(autoSendTimerRef.current)
      autoSendTimerRef.current = null
    }

    const response = await getCoachResponse(text, updatedMessages)
    setMessages(prev => [...prev, { role: 'coach', text: response, timestamp: new Date() }])
    setIsThinking(false)
  }, [input, isThinking, messages, getCoachResponse])

  // Keep handleSendRef updated for auto-send
  useEffect(() => {
    handleSendRef.current = handleSend
  }, [handleSend])

  const handleMicClick = () => {
    if (!recognitionRef.current) return
    if (isListening) {
      recognitionRef.current.stop()
      setIsListening(false)
      // Cancel auto-send if manually stopping
      if (autoSendTimerRef.current) {
        clearTimeout(autoSendTimerRef.current)
        autoSendTimerRef.current = null
      }
    } else {
      setInput('')
      pendingTranscriptRef.current = ''
      recognitionRef.current.start()
    }
  }

  // Mode change: reset conversation with new first question
  const handleModeChange = (newMode: CoachMode) => {
    setMode(newMode)
    setCurrentWordIdx(0) // Reset to first word
    if (courseWords.length === 0) return
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
        ? `${scenario ? `Imagine : ${scenario}\n` : ''}Comment dit-on "${courseWords[0].trad}" en anglais ?`
        : `${scenario ? `Imagine: ${scenario}\n` : ''}How do you say "${courseWords[0].trad}" in English?`
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

      {/* Mode selector + sound toggle */}
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
        {/* Course context + sound toggle */}
        <div className="flex items-center justify-between mt-1.5">
          {activeCourseId && (
            <p className="text-[10px] text-[#888]">
              📚 {lang === 'fr' ? 'Cours actif :' : 'Active course:'} {getA1CourseData(activeCourseId)?.title || activeCourseId} — {courseWords.length} {lang === 'fr' ? 'mots' : 'words'}
            </p>
          )}
          {/* P0-2B: Sound toggle */}
          <button
            onClick={() => {
              setSoundEnabled(prev => !prev)
              if (soundEnabled) window.speechSynthesis?.cancel()
            }}
            className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium transition-all ${
              soundEnabled ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-gray-100 text-gray-500 border border-gray-200'
            }`}
          >
            {soundEnabled ? <Volume2 className="h-3 w-3" /> : <VolumeX className="h-3 w-3" />}
            {soundEnabled ? (lang === 'fr' ? 'Son ON' : 'Sound ON') : (lang === 'fr' ? 'Son OFF' : 'Sound OFF')}
          </button>
        </div>
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
              {/* Manual TTS replay button on coach messages */}
              {msg.role === 'coach' && (
                <button
                  onClick={() => speakCoachMessage(msg.text)}
                  className="ml-2 inline-flex items-center opacity-50 hover:opacity-100 transition-opacity"
                  title={lang === 'fr' ? 'Réécouter' : 'Replay'}
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

      {/* Input bar */}
      <div className="bg-white border-t px-4 py-3 pb-20">
        {/* P0-2A: Auto-send indicator */}
        {isListening && (
          <p className="text-center text-[10px] text-red-500 mb-1 animate-pulse">
            🎙️ {lang === 'fr' ? 'Écoute en cours... envoi auto après silence' : 'Listening... auto-send after silence'}
          </p>
        )}
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

          <button onClick={() => handleSend()} disabled={!input.trim() || isThinking}
            className="w-10 h-10 rounded-xl bg-[#002844] flex items-center justify-center disabled:opacity-50">
            <Send className="h-4 w-4 text-white" />
          </button>
        </div>
      </div>

      <BottomNav lang={lang} />
    </div>
  )
}
