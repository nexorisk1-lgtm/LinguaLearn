/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { getCurrentUser } from '@/lib/db/localStorage'
import { User, InterfaceLanguage } from '@/types'
import PageHeader from '@/components/PageHeader'
import BottomNav from '@/components/BottomNav'
import { Send, Mic, MicOff, Volume2, VolumeX, Loader2 } from 'lucide-react'
import { getA1CourseData } from '@/lib/db/bankA1Courses'

type PratiquerTab = 'reviser' | 'discuter' | 'pro'

interface Message {
  role: 'user' | 'coach'
  text: string
  timestamp: Date
}

declare global {
  interface Window {
    webkitSpeechRecognition?: any
  }
}

export default function PratiquerPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [lang, setLang] = useState<InterfaceLanguage>('fr')
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<PratiquerTab>('reviser')
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isListening, setIsListening] = useState(false)
  const [speechSupported, setSpeechSupported] = useState(false)
  const [isThinking, setIsThinking] = useState(false)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [googleTtsAvailable, setGoogleTtsAvailable] = useState<boolean | null>(null)

  // Teacher revision flow state
  const [currentWordIdx, setCurrentWordIdx] = useState(0)
  const [currentCourseId, setCurrentCourseId] = useState<string>('')
  const [revisionWords, setRevisionWords] = useState<any[]>([])
  const [lastQuestionsAsked, setLastQuestionsAsked] = useState<string[]>([])
  const [lastScenariosUsed, setLastScenariosUsed] = useState<string[]>([])
  const [lastTopics, setLastTopics] = useState<string[]>([])

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const recognitionRef = useRef<any>(null)
  const autoSendTimerRef = useRef<NodeJS.Timeout | null>(null)
  const pendingTranscriptRef = useRef<string>('')

  // TTS functions
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

  const speakWebSpeech = useCallback((text: string, speechLang: string = 'fr') => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return
    window.speechSynthesis.cancel()
    const utter = new SpeechSynthesisUtterance(text)
    utter.lang = speechLang === 'en' ? 'en-US' : 'fr-FR'
    utter.rate = 0.9
    window.speechSynthesis.speak(utter)
  }, [])

  const speakText = useCallback(async (text: string, ttsLang: string = 'fr') => {
    if (!soundEnabled) return
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

  // Segment text by language: quoted text is English, rest is French
  const segmentByLanguage = (text: string): { text: string; lang: 'en' | 'fr' }[] => {
    const segments: { text: string; lang: 'en' | 'fr' }[] = []
    const parts = text.split(/("[^"]*"|'[^']*')/)
    for (const part of parts) {
      if (!part.trim()) continue
      if ((part.startsWith('"') && part.endsWith('"')) || (part.startsWith("'") && part.endsWith("'"))) {
        // Quoted = English, strip quotes
        segments.push({ text: part.slice(1, -1), lang: 'en' })
      } else {
        // Unquoted = French
        segments.push({ text: part, lang: 'fr' })
      }
    }
    return segments
  }

  // Segmented TTS for coach messages
  const speakCoachMessageSegmented = useCallback(async (text: string) => {
    if (!soundEnabled) return
    const clean = text.replace(/[^a-zA-Z0-9\u00C0-\u024F\s.,;:!?'"()-]/g, '').trim()
    if (!clean) return
    const segments = segmentByLanguage(clean)
    for (const seg of segments) {
      if (!seg.text.trim()) continue
      await speakText(seg.text, seg.lang)
      // Small pause between segments
      await new Promise(r => setTimeout(r, 200))
    }
  }, [soundEnabled, speakText])

  // Speech recognition setup
  useEffect(() => {
    const SpeechRecognition = window.webkitSpeechRecognition || (window as any).SpeechRecognition
    if (SpeechRecognition) {
      setSpeechSupported(true)
      const recognition = new SpeechRecognition()
      recognition.continuous = false
      recognition.interimResults = true
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

        if (finalTranscript) {
          pendingTranscriptRef.current = finalTranscript.trim()
          setInput(finalTranscript.trim())
        } else if (interimTranscript) {
          setInput(interimTranscript.trim())
          pendingTranscriptRef.current = interimTranscript.trim()
        }
      }

      recognition.onend = () => {
        setIsListening(false)
        const transcript = pendingTranscriptRef.current
        if (transcript) {
          autoSendTimerRef.current = setTimeout(() => {
            window.dispatchEvent(new CustomEvent('pratiquer-auto-send', { detail: transcript }))
          }, 1200)
        }
      }

      recognition.onerror = () => {
        setIsListening(false)
        pendingTranscriptRef.current = ''
      }

      recognitionRef.current = recognition
    }
  }, [])

  // Auto-send event listener
  const handleSendRef = useRef<((text?: string) => void) | null>(null)

  useEffect(() => {
    const handler = (e: any) => {
      const text = e.detail
      if (text && handleSendRef.current) {
        handleSendRef.current(text)
      }
    }
    window.addEventListener('pratiquer-auto-send', handler)
    return () => window.removeEventListener('pratiquer-auto-send', handler)
  }, [])

  // Init: load user and set initial messages
  useEffect(() => {
    const currentUser = getCurrentUser()
    if (!currentUser) {
      router.push('/auth')
      return
    }
    setUser(currentUser)
    const interfaceLang = currentUser.settings.interfaceLang || 'fr'
    setLang(interfaceLang)

    // Initialize teacher revision mode
    initializeTeacherRevision(currentUser)

    // Set initial messages based on active tab
    initializeMessages(currentUser, interfaceLang, 'reviser')
    setLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router])

  // Initialize teacher revision: load course words from localStorage progress
  const initializeTeacherRevision = (currentUser: User) => {
    const aLang = currentUser.activeLang || currentUser.settings.learningLangs[0] || 'en'
    const progressKey = `lingualearn_progress_${aLang}`
    const progress = JSON.parse(localStorage.getItem(progressKey) || '{}')
    const completedCourses = progress.completedCourses || []

    // Pick the latest course or default to 'a1_c1'
    const latestCourse = completedCourses.length > 0
      ? completedCourses[completedCourses.length - 1].courseId
      : 'a1_c1'

    setCurrentCourseId(latestCourse)

    // Load course data
    try {
      const courseData = getA1CourseData(latestCourse)
      if (courseData && courseData.vocabulary) {
        setRevisionWords(courseData.vocabulary)
        setCurrentWordIdx(0)
      }
    } catch {
      // Fallback: use empty list
      setRevisionWords([])
    }
  }

  // Helper: initialize messages based on tab and user
  const initializeMessages = (currentUser: User, interfaceLang: InterfaceLanguage, tab: PratiquerTab) => {
    const firstName = currentUser.firstName || 'apprenant'
    const isFr = interfaceLang === 'fr'
    const initialMsgs: Message[] = []

    if (tab === 'reviser') {
      const currentWord = revisionWords[currentWordIdx]
      if (currentWord) {
        initialMsgs.push({
          role: 'coach',
          text: isFr
            ? `Bonjour ${firstName} ! Je suis Léa, ta prof. On révise ensemble ? Je vais te poser des questions sur les mots que tu as appris. Comment dit-on '${currentWord.trad_fr}' en anglais ?`
            : `Hello ${firstName}! I'm Lea, your teacher. Let's review together! How do you say '${currentWord.trad_fr}' in English?`,
          timestamp: new Date(),
        })
      } else {
        initialMsgs.push({
          role: 'coach',
          text: isFr
            ? `Bonjour ${firstName} ! Aucun mot trouvé pour réviser. Complète d'abord des cours !`
            : `Hello ${firstName}! No words found to review. Complete some courses first!`,
          timestamp: new Date(),
        })
      }
    } else if (tab === 'discuter') {
      initialMsgs.push({
        role: 'coach',
        text: isFr
          ? `Salut ${firstName} ! C'est Alex. Comment tu vas ? Imagine, tu es dans un café à Londres. Qu'est-ce que tu commandes ?`
          : `Hi ${firstName}! It's Alex. How are you? Imagine you're at a café in London. What do you order?`,
        timestamp: new Date(),
      })
    } else if (tab === 'pro') {
      initialMsgs.push({
        role: 'coach',
        text: isFr
          ? `Bienvenue ${firstName}. Je suis Marc, consultant GRC. Aujourd'hui on va pratiquer l'anglais professionnel. Qu'est-ce que tu veux travailler ?`
          : `Welcome ${firstName}. I'm Marc, a GRC consultant. Today we'll practice professional English. What would you like to work on?`,
        timestamp: new Date(),
      })
    }

    setMessages(initialMsgs)
  }

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Auto-TTS when new coach message arrives
  const lastCoachMsgRef = useRef<string>('')
  useEffect(() => {
    if (messages.length === 0) return
    const lastMsg = messages[messages.length - 1]
    if (lastMsg.role === 'coach' && lastMsg.text !== lastCoachMsgRef.current) {
      lastCoachMsgRef.current = lastMsg.text
      setTimeout(() => speakCoachMessageSegmented(lastMsg.text), 300)
    }
  }, [messages, speakCoachMessageSegmented])

  // Handle tab change
  const handleTabChange = (newTab: PratiquerTab) => {
    setActiveTab(newTab)
    if (user) {
      initializeMessages(user, lang, newTab)
    }
  }

  // Handle send message with API integration
  const handleSend = useCallback(async (overrideText?: string) => {
    const text = overrideText || input.trim()
    if (!text || isThinking || !user) return

    const userMsg: Message = { role: 'user', text, timestamp: new Date() }
    const updatedMessages = [...messages, userMsg]
    setMessages(updatedMessages)
    setInput('')
    setIsThinking(true)

    if (autoSendTimerRef.current) {
      clearTimeout(autoSendTimerRef.current)
      autoSendTimerRef.current = null
    }

    try {
      let payload: any = {
        userMessage: text,
        userName: user.firstName,
        interfaceLang: lang,
        conversationHistory: updatedMessages.map(m => ({
          role: m.role === 'coach' ? 'coach' : 'user',
          text: m.text,
        })),
      }

      if (activeTab === 'reviser') {
        const currentWord = revisionWords[currentWordIdx]
        const courseWordsForApi = revisionWords.map((w: any) => ({
          word: w.word,
          trad: w.trad_fr,
          example_en: w.example_en,
          phonetic: w.phonetic_fr,
        }))

        payload = {
          ...payload,
          courseId: currentCourseId,
          agentType: 'teacher',
          questionAsked: `Comment dit-on "${currentWord?.trad_fr}" en anglais ?`,
          expectedWord: currentWord?.word || '',
          expectedTrad: currentWord?.trad_fr || '',
          acceptableSynonyms: [],
          courseWords: courseWordsForApi,
          lastQuestionsAsked,
        }
      } else if (activeTab === 'discuter') {
        const courseWordsForApi = revisionWords.map((w: any) => ({
          word: w.word,
          trad: w.trad_fr,
          example_en: w.example_en,
          phonetic: w.phonetic_fr,
        }))

        payload = {
          ...payload,
          courseId: currentCourseId || '',
          agentType: 'friend',
          courseWords: courseWordsForApi,
          scenario: 'café à Londres',
          lastScenariosUsed,
        }
      } else if (activeTab === 'pro') {
        const aLang = user.activeLang || user.settings.learningLangs[0] || 'en'
        const userProgress = user.progress[aLang]
        const grcThemes = user.settings.languageConfigs[aLang]?.themes || []

        payload = {
          ...payload,
          courseId: '',
          agentType: 'business',
          lastTopics,
          grcLevel: userProgress?.levelGrc || 'Junior',
          grcThemes,
        }
      }

      const response = await fetch('/api/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        throw new Error('API request failed')
      }

      const data = await response.json()
      const coachResponse = data.response || 'I did not understand.'

      // Add coach message
      setMessages(prev => [...prev, { role: 'coach', text: coachResponse, timestamp: new Date() }])

      // Update anti-loop tracking
      if (activeTab === 'reviser') {
        const currentWord = revisionWords[currentWordIdx]
        if (currentWord?.word) {
          setLastQuestionsAsked(prev => {
            const updated = [currentWord.word, ...prev]
            return updated.slice(0, 5)
          })
        }

        // Update word index if next index provided
        if (data.nextWordIdx !== undefined) {
          setCurrentWordIdx(data.nextWordIdx)
        }
      } else if (activeTab === 'discuter') {
        setLastScenariosUsed(prev => {
          const updated = ['café à Londres', ...prev]
          return updated.slice(0, 5)
        })
      } else if (activeTab === 'pro') {
        setLastTopics(prev => {
          const topic = data.topic || 'general'
          const updated = [topic, ...prev]
          return updated.slice(0, 5)
        })
      }

      setIsThinking(false)
    } catch (error) {
      console.error('Error sending message:', error)
      const isFr = lang === 'fr'
      const errorMsg = isFr ? 'Erreur de connexion. Réessaie.' : 'Connection error. Please try again.'
      setMessages(prev => [...prev, { role: 'coach', text: errorMsg, timestamp: new Date() }])
      setIsThinking(false)
    }
  }, [input, isThinking, messages, lang, user, activeTab, currentWordIdx, revisionWords, currentCourseId, lastQuestionsAsked, lastScenariosUsed, lastTopics])

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

  // Check if Pro tab should be visible
  const aLang = user?.activeLang || user?.settings.learningLangs[0] || 'en'
  const userProgress = user?.progress[aLang]
  const hasProAccess = user && user.settings.languageConfigs[aLang]?.hasGrcThemes && userProgress?.grcDiagnosticCompleted

  if (loading || !user) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#F0F0F0]">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-[#002844]" />
      </div>
    )
  }

  const tabs: { id: PratiquerTab; labelFr: string; labelEn: string; icon: string }[] = [
    { id: 'reviser', labelFr: 'Réviser', labelEn: 'Review', icon: '📚' },
    { id: 'discuter', labelFr: 'Discuter', labelEn: 'Discuss', icon: '💬' },
  ]

  if (hasProAccess) {
    tabs.push({ id: 'pro', labelFr: 'Pro', labelEn: 'Pro', icon: '💼' })
  }

  const actionButtons = [
    { icon: '🎮', labelFr: 'Jeux', labelEn: 'Games', href: '/module/jeux' },
    { icon: '🔥', labelFr: 'Défis', labelEn: 'Challenges', href: '/module/defis' },
    { icon: '🏆', labelFr: 'Classement', labelEn: 'Rankings', href: '/module/classement' },
  ]

  return (
    <div className="flex flex-col h-screen bg-[#F0F0F0]">
      <PageHeader title={lang === 'fr' ? 'Pratiquer' : 'Practice'} backHref="/dashboard" />

      {/* Tab selector */}
      <div className="px-4 py-3 bg-white border-b">
        <div className="flex gap-2 mb-3">
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => handleTabChange(tab.id)}
              className={`flex-1 py-2 px-2 rounded-lg text-center transition-all ${
                activeTab === tab.id
                  ? 'bg-[#002844] text-white shadow-md'
                  : 'bg-gray-100 text-[#555] hover:bg-gray-200'
              }`}>
              <span className="text-sm block font-semibold">{lang === 'fr' ? tab.labelFr : tab.labelEn}</span>
              <span className="text-lg">{tab.icon}</span>
            </button>
          ))}
        </div>

        {/* Action buttons */}
        <div className="flex gap-2">
          {actionButtons.map(btn => (
            <a key={btn.labelFr} href={btn.href}
              className="flex-1 py-2 px-2 rounded-lg bg-gradient-to-br from-[#D9B438] to-[#C9A428] text-white text-center font-semibold text-sm hover:shadow-md transition-all">
              <span className="text-lg block">{btn.icon}</span>
              {lang === 'fr' ? btn.labelFr : btn.labelEn}
            </a>
          ))}
        </div>

        {/* Sound toggle */}
        <div className="flex justify-end mt-2">
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
                  onClick={() => speakCoachMessageSegmented(msg.text)}
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
