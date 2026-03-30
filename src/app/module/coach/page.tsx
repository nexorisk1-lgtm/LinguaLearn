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
import { getA1CourseVocabulary, getA1CourseData, getEnglishSynonymsForFrench } from '@/lib/db/bankA1Courses'

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
  const [courseScenario, setCourseScenario] = useState('')

  // Revision mode: track which word is being asked
  const [currentWordIdx, setCurrentWordIdx] = useState(0)

  // P0-2B: Global sound toggle
  const [soundEnabled, setSoundEnabled] = useState(true)
  // P0-B: Track if Google TTS is available
  const [googleTtsAvailable, setGoogleTtsAvailable] = useState<boolean | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const recognitionRef = useRef<any>(null)
  const autoSendTimerRef = useRef<NodeJS.Timeout | null>(null)
  const pendingTranscriptRef = useRef<string>('')

  // ============================================================
  // P0-B: TTS — Google Cloud TTS Neural2 with Web Speech API fallback
  // ============================================================

  const playGoogleTts = useCallback(async (text: string, ttsLang: string = 'fr'): Promise<boolean> => {
    try {
      const resp = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, lang: ttsLang }),
      })
      if (!resp.ok) return false
      const data = await resp.json()
      if (!data.audio) return false

      // Decode base64 → play audio
      const binary = atob(data.audio)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
      const blob = new Blob([bytes], { type: 'audio/mp3' })
      const url = URL.createObjectURL(blob)
      const audio = new Audio(url)
      audio.onended = () => URL.revokeObjectURL(url)
      await audio.play()
      return true
    } catch {
      return false
    }
  }, [])

  // Web Speech API fallback with proper language selection
  const speakWebSpeech = useCallback((text: string, speechLang: string = 'fr') => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return
    window.speechSynthesis.cancel()
    const utter = new SpeechSynthesisUtterance(text)
    utter.lang = speechLang === 'en' ? 'en-US' : 'fr-FR'
    utter.rate = 0.9
    window.speechSynthesis.speak(utter)
  }, [])

  // Smart TTS: try Google first, fall back to Web Speech
  const speakText = useCallback(async (text: string, ttsLang: string = 'fr') => {
    if (!soundEnabled) return
    // If we already know Google TTS is unavailable, skip the request
    if (googleTtsAvailable === false) {
      speakWebSpeech(text, ttsLang)
      return
    }
    const success = await playGoogleTts(text, ttsLang)
    if (!success) {
      setGoogleTtsAvailable(false)
      speakWebSpeech(text, ttsLang)
    } else if (googleTtsAvailable === null) {
      setGoogleTtsAvailable(true)
    }
  }, [soundEnabled, googleTtsAvailable, playGoogleTts, speakWebSpeech])

  // P0-B: Auto-TTS on coach messages — detect language segments
  const speakCoachMessage = useCallback(async (text: string) => {
    if (!soundEnabled) return

    // Clean emojis
    const clean = text.replace(/[^a-zA-Z0-9\u00C0-\u024F\s.,;:!?'"()-]/g, '').trim()
    if (!clean) return

    // Extract English words in quotes for native pronunciation
    const englishQuoted = text.match(/"([a-zA-Z\s]+)"/g)
    if (englishQuoted && englishQuoted.length > 0) {
      // Speak the English parts with en-US voice
      for (const match of englishQuoted) {
        const word = match.replace(/"/g, '')
        await speakText(word, 'en')
        // Small pause between words
        await new Promise(r => setTimeout(r, 400))
      }
    }

    // Speak the full message in French
    await speakText(clean, 'fr')
  }, [soundEnabled, speakText])

  // ============================================================
  // P0-D: Compute synonyms using FR_SYNONYMS cross-reference
  // ============================================================

  const getContextualFields = useCallback((wordIdx: number) => {
    if (courseWords.length === 0 || mode !== 'revision') return null
    const idx = wordIdx % courseWords.length
    const currentWord = courseWords[idx]
    const isFr = lang === 'fr'

    const questionAsked = isFr
      ? `comment dit-on "${currentWord.trad}" en anglais ?`
      : `how do you say "${currentWord.trad}" in English?`

    // P0-D: Use FR_SYNONYMS cross-reference for proper synonyms
    const allTranslations = getEnglishSynonymsForFrench(currentWord.trad, activeCourseId)
    const acceptableSynonyms = allTranslations.filter(
      w => w.toLowerCase() !== currentWord.word.toLowerCase()
    )

    return {
      questionAsked,
      expectedWord: currentWord.word,
      expectedTrad: currentWord.trad,
      acceptableSynonyms,
    }
  }, [courseWords, lang, mode, activeCourseId])

  // ============================================================
  // P0-C: Speech recognition with interimResults for short words
  // ============================================================

  useEffect(() => {
    const SpeechRecognition = window.webkitSpeechRecognition || (window as any).SpeechRecognition
    if (SpeechRecognition) {
      setSpeechSupported(true)
      const recognition = new SpeechRecognition()
      recognition.continuous = false
      // P0-C: Enable interim results for short words like "hi"
      recognition.interimResults = true
      // P0-C: Always listen in English (user speaks English to the coach)
      recognition.lang = 'en-US'

      recognition.onstart = () => {
        setIsListening(true)
        pendingTranscriptRef.current = ''
        if (autoSendTimerRef.current) {
          clearTimeout(autoSendTimerRef.current)
          autoSendTimerRef.current = null
        }
      }

      recognition.onresult = (event: any) => {
        let finalTranscript = ''
        let interimTranscript = ''

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript
          if (event.results[i].isFinal) {
            finalTranscript += transcript
          } else {
            interimTranscript += transcript
          }
        }

        // P0-C: Show interim results in input field for visual feedback
        if (finalTranscript) {
          pendingTranscriptRef.current = finalTranscript.trim()
          setInput(finalTranscript.trim())
        } else if (interimTranscript) {
          setInput(interimTranscript.trim())
          // P0-C: For short words, if interim matches a course word, accept it early
          const interim = interimTranscript.trim().toLowerCase()
          if (interim.length <= 8) {
            // Check if it's a valid course word — auto-validate short words
            pendingTranscriptRef.current = interimTranscript.trim()
          }
        }
      }

      // Auto-send after speech ends
      recognition.onend = () => {
        setIsListening(false)
        const transcript = pendingTranscriptRef.current
        if (transcript) {
          autoSendTimerRef.current = setTimeout(() => {
            window.dispatchEvent(new CustomEvent('coach-auto-send', { detail: transcript }))
          }, 1200)
        }
      }

      recognition.onerror = () => {
        setIsListening(false)
        pendingTranscriptRef.current = ''
      }

      recognitionRef.current = recognition
    }
  }, [lang])

  // Auto-send event listener
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

  // ============================================================
  // Init: load user, course, build initial message
  // ============================================================

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
    const scenario = courseData?.scenario || ''
    setCourseScenario(scenario)
    const firstName = currentUser.firstName || 'apprenant'
    const isFr = interfaceLang === 'fr'

    const initialMsgs: Message[] = []

    if (words.length > 0) {
      initialMsgs.push({
        role: 'coach',
        text: isFr
          ? `Salut ${firstName} ! Je suis Lea, ta coach d'anglais. On travaille "${courseTitle}" ensemble. 🎓`
          : `Hi ${firstName}! I'm Lea, your English coach. Let's work on "${courseTitle}" together. 🎓`,
        timestamp: new Date(),
      })

      // P0-A: Discussion mode = situational, NOT drill
      if (mode === 'discussion') {
        initialMsgs.push({
          role: 'coach',
          text: isFr
            ? `${scenario ? `Imagine : ${scenario}.\n` : ''}Tu arrives dans cette situation. Que dis-tu ? Reponds librement en anglais !`
            : `${scenario ? `Imagine: ${scenario}.\n` : ''}You're in this situation. What do you say? Answer freely in English!`,
          timestamp: new Date(),
        })
      } else {
        // Revision mode = drill
        initialMsgs.push({
          role: 'coach',
          text: isFr
            ? `On revise ! Mot 1/${words.length} :\nComment dit-on "${words[0].trad}" en anglais ?`
            : `Let's review! Word 1/${words.length}:\nHow do you say "${words[0].trad}" in English?`,
          timestamp: new Date(),
        })
        setCurrentWordIdx(0)
      }
    } else {
      initialMsgs.push({
        role: 'coach',
        text: isFr
          ? `Salut ${firstName} ! Termine un cours d'abord pour qu'on puisse s'entrainer ensemble.`
          : `Hi ${firstName}! Complete a course first so we can practice together.`,
        timestamp: new Date(),
      })
    }

    setMessages(initialMsgs)
    setLoading(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router])

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // P0-B: Auto-TTS when new coach message arrives
  const lastCoachMsgRef = useRef<string>('')
  useEffect(() => {
    if (messages.length === 0) return
    const lastMsg = messages[messages.length - 1]
    if (lastMsg.role === 'coach' && lastMsg.text !== lastCoachMsgRef.current) {
      lastCoachMsgRef.current = lastMsg.text
      setTimeout(() => speakCoachMessage(lastMsg.text), 300)
    }
  }, [messages, speakCoachMessage])

  // ============================================================
  // API call: mode-aware
  // ============================================================

  const getCoachResponse = useCallback(async (userText: string, currentMessages: Message[]) => {
    const isRevision = mode === 'revision'
    const contextFields = isRevision ? getContextualFields(currentWordIdx) : null

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
          scenario: courseScenario,
          // Revision-only fields
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

      // Revision mode: update word index
      if (isRevision && data.nextWordIdx !== undefined) {
        setCurrentWordIdx(data.nextWordIdx)
      }

      return data.response || 'Continuons !'
    } catch {
      return generateLocalFallback(userText, contextFields)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCourseId, mode, courseWords, user, lang, currentWordIdx, getContextualFields, courseScenario])

  // Local fallback
  const generateLocalFallback = useCallback((userText: string, contextFields: ReturnType<typeof getContextualFields>): string => {
    const isFr = lang === 'fr'

    // Discussion mode: flexible matching
    if (mode === 'discussion') {
      const lower = userText.toLowerCase().trim()
      const matched = courseWords.find(w =>
        lower.includes(w.word.toLowerCase()) || lower.includes(w.trad.toLowerCase())
      )
      if (matched) {
        return isFr
          ? `Bien joue ! "${matched.word}" est correct ici.\nPar exemple : "${matched.example_en || matched.word}"\nContinue, essaie une autre expression !`
          : `Well done! "${matched.word}" works here.\nFor example: "${matched.example_en || matched.word}"\nKeep going!`
      }
      return isFr
        ? `Hmm, essaie d'utiliser des mots du cours comme "${courseWords[0]?.word}" (${courseWords[0]?.trad}).\nQue dirais-tu dans cette situation ?`
        : `Hmm, try using course words like "${courseWords[0]?.word}" (${courseWords[0]?.trad}).\nWhat would you say?`
    }

    // Revision mode: strict contextual validation
    if (!contextFields) return isFr ? 'Continuons !' : "Let's continue!"

    const lower = userText.toLowerCase().trim()
    const expected = contextFields.expectedWord.toLowerCase()
    const synonyms = contextFields.acceptableSynonyms.map(s => s.toLowerCase())
    const nextIdx = (currentWordIdx + 1) % courseWords.length
    const nextWord = courseWords[nextIdx]

    if (lower === expected) {
      setCurrentWordIdx(nextIdx)
      return isFr
        ? `Exactement ! "${contextFields.expectedWord}" = ${contextFields.expectedTrad}.\nAllez, mot suivant !`
        : `Exactly! "${contextFields.expectedWord}" = ${contextFields.expectedTrad}.\nNext!`
    }

    if (synonyms.includes(lower)) {
      setCurrentWordIdx(nextIdx)
      return isFr
        ? `Oui, "${userText}" marche aussi !\n"${contextFields.expectedWord}" est plus courant pour "${contextFields.expectedTrad}", mais "${userText}" est correct.\nOn continue !`
        : `Yes, "${userText}" works too!\n"${contextFields.expectedWord}" is more common for "${contextFields.expectedTrad}", but "${userText}" is fine.\nNext!`
    }

    const wrongWord = courseWords.find(w => w.word.toLowerCase() === lower)
    if (wrongWord) {
      return isFr
        ? `Non, "${wrongWord.word}" veut dire "${wrongWord.trad}".\nPour "${contextFields.expectedTrad}", on dit "${contextFields.expectedWord}".\nEssaie encore !`
        : `No, "${wrongWord.word}" means "${wrongWord.trad}".\nFor "${contextFields.expectedTrad}", we say "${contextFields.expectedWord}".\nTry again!`
    }

    return isFr
      ? `"${userText}" n'est pas le mot attendu.\nPour "${contextFields.expectedTrad}", on dit "${contextFields.expectedWord}".\nEssaie encore !`
      : `"${userText}" is not the expected word.\nFor "${contextFields.expectedTrad}", we say "${contextFields.expectedWord}".\nTry again!`
  }, [courseWords, lang, currentWordIdx, mode])

  // ============================================================
  // Send message
  // ============================================================

  const handleSend = useCallback(async (overrideText?: string) => {
    const text = overrideText || input.trim()
    if (!text || isThinking) return
    const userMsg: Message = { role: 'user', text, timestamp: new Date() }
    const updatedMessages = [...messages, userMsg]
    setMessages(updatedMessages)
    setInput('')
    setIsThinking(true)

    if (autoSendTimerRef.current) {
      clearTimeout(autoSendTimerRef.current)
      autoSendTimerRef.current = null
    }

    const response = await getCoachResponse(text, updatedMessages)
    setMessages(prev => [...prev, { role: 'coach', text: response, timestamp: new Date() }])
    setIsThinking(false)
  }, [input, isThinking, messages, getCoachResponse])

  useEffect(() => {
    handleSendRef.current = handleSend
  }, [handleSend])

  const handleMicClick = () => {
    if (!recognitionRef.current) return
    if (isListening) {
      recognitionRef.current.stop()
      setIsListening(false)
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

  // ============================================================
  // P0-A: Mode change — different initial messages per mode
  // ============================================================

  const handleModeChange = (newMode: CoachMode) => {
    setMode(newMode)
    setCurrentWordIdx(0)
    if (courseWords.length === 0) return
    const courseData = activeCourseId ? getA1CourseData(activeCourseId) : null
    const scenario = courseData?.scenario || ''
    const isFr = lang === 'fr'
    const firstName = user?.firstName || 'apprenant'

    const newMsgs: Message[] = []

    if (newMode === 'revision') {
      newMsgs.push({
        role: 'coach',
        text: isFr
          ? `Mode revision ciblee active ! On passe en revue tous les mots. 🎯`
          : `Targeted review mode! Let's go through all words. 🎯`,
        timestamp: new Date(),
      })
      newMsgs.push({
        role: 'coach',
        text: isFr
          ? `Mot 1/${courseWords.length} :\nComment dit-on "${courseWords[0].trad}" en anglais ?`
          : `Word 1/${courseWords.length}:\nHow do you say "${courseWords[0].trad}" in English?`,
        timestamp: new Date(),
      })
    } else {
      // P0-A: Discussion = conversational, situational
      newMsgs.push({
        role: 'coach',
        text: isFr
          ? `Mode discussion active ! On pratique en situation reelle. 💬`
          : `Discussion mode! Let's practice in real situations. 💬`,
        timestamp: new Date(),
      })
      newMsgs.push({
        role: 'coach',
        text: isFr
          ? `${scenario ? `Imagine : ${scenario}.\n` : ''}${firstName}, tu es dans cette situation. Que dis-tu en anglais ?`
          : `${scenario ? `Imagine: ${scenario}.\n` : ''}${firstName}, you're in this situation. What do you say in English?`,
        timestamp: new Date(),
      })
    }

    setMessages(newMsgs)
  }

  // ============================================================
  // Render
  // ============================================================

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
      descFr: 'Conversation libre en situation',
      descEn: 'Free conversation in context',
    },
    {
      id: 'revision',
      labelFr: 'Revision ciblee',
      labelEn: 'Targeted review',
      icon: '🎯',
      descFr: 'Mot par mot, validation stricte',
      descEn: 'Word by word, strict validation',
    },
  ]

  return (
    <div className="flex flex-col h-screen bg-[#F0F0F0]">
      <PageHeader title={lang === 'fr' ? 'Coach IA — Lea' : 'AI Coach — Lea'} backHref="/dashboard" />

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
        <div className="flex items-center justify-between mt-1.5">
          {activeCourseId && (
            <p className="text-[10px] text-[#888]">
              📚 {getA1CourseData(activeCourseId)?.title || activeCourseId} — {courseWords.length} {lang === 'fr' ? 'mots' : 'words'}
              {googleTtsAvailable === true && <span className="ml-1 text-green-600">🔊 TTS native</span>}
            </p>
          )}
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
                <span className="text-sm">👩‍🏫</span>
              </div>
            )}
            <div className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm whitespace-pre-wrap ${
              msg.role === 'user'
                ? 'bg-[#002844] text-white rounded-br-md'
                : 'bg-white text-[#002844] shadow-sm rounded-bl-md'
            }`}>
              {msg.text}
              {msg.role === 'coach' && (
                <button
                  onClick={() => speakCoachMessage(msg.text)}
                  className="ml-2 inline-flex items-center opacity-50 hover:opacity-100 transition-opacity"
                  title={lang === 'fr' ? 'Reecouter' : 'Replay'}
                >
                  <Volume2 className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>
        ))}

        {isThinking && (
          <div className="flex justify-start">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#7B1FA2] to-[#9C27B0] flex items-center justify-center flex-shrink-0 mr-2">
              <span className="text-sm">👩‍🏫</span>
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
        {isListening && (
          <p className="text-center text-[10px] text-red-500 mb-1 animate-pulse">
            🎙️ {lang === 'fr' ? 'Parle en anglais... envoi auto apres silence' : 'Speak English... auto-send after silence'}
          </p>
        )}
        <div className="flex gap-2 max-w-lg mx-auto items-center">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder={lang === 'fr' ? 'Reponds en anglais...' : 'Answer in English...'}
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
