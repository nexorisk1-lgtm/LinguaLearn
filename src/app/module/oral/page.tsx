'use client'

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  Mic,
  MicOff,
  Volume2,
  CheckCircle,
  XCircle,
  BookOpen,
} from 'lucide-react'
import { getCurrentUser } from '@/lib/db/localStorage'
import { InterfaceLanguage } from '@/types'
import { t } from '@/lib/i18n'
import { getSpeakingExercises, speakText, isCloseEnough } from '@/lib/db/bankHelpers'
import { SpeakingExercise } from '@/lib/db/bankTypes'

type ResultType = 'match' | 'mismatch' | null
type FilterTheme = string | null
type FilterLevel = string | null

const LANGUAGE_CODES: Record<string, string> = {
  en: 'en-US',
  es: 'es-ES',
  fr: 'fr-FR',
  de: 'de-DE',
  it: 'it-IT',
  pt: 'pt-BR',
}

export default function OralModule() {
  const router = useRouter()
  const recognitionRef = useRef<any>(null)
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [interfaceLang, setInterfaceLang] = useState<InterfaceLanguage>('en')
  const [exercises, setExercises] = useState<SpeakingExercise[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [filterTheme, setFilterTheme] = useState<FilterTheme>(null)
  const [filterLevel, setFilterLevel] = useState<FilterLevel>(null)
  const [isRecording, setIsRecording] = useState(false)
  const [heardText, setHeardText] = useState('')
  const [result, setResult] = useState<ResultType>(null)
  const [themes, setThemes] = useState<string[]>([])
  const [levels, setLevels] = useState<string[]>([])
  const [micDenied, setMicDenied] = useState(false)
  const [speechApiSupported, setSpeechApiSupported] = useState(true)

  // Initialize user and load exercises
  useEffect(() => {
    const user = getCurrentUser()
    if (!user) {
      router.push('/auth')
      return
    }
    setUser(user)
    setInterfaceLang(user.settings.interfaceLang || 'fr')

    const activeLang = user.activeLang || user.settings.learningLangs[0] || 'en'
    const userThemes = user.settings.languageConfigs?.[activeLang]?.themes || ['travel']
    const userLevel = user.progress?.[activeLang]?.levelCecrl || 'A1'
    const allExercises = getSpeakingExercises(activeLang, userThemes, userLevel)
    setExercises(allExercises)

    // Extract unique themes and levels
    const uniqueThemes = Array.from(
      new Set(allExercises.map((ex) => ex.theme).filter(Boolean))
    ) as string[]
    const uniqueLevels = Array.from(
      new Set(allExercises.map((ex) => ex.level).filter(Boolean))
    ) as string[]

    setThemes(uniqueThemes)
    setLevels(uniqueLevels)

    // Check SpeechRecognition API support
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) {
      setSpeechApiSupported(false)
    } else {
      recognitionRef.current = new SpeechRecognition()
    }

    setLoading(false)
  }, [router])

  // Filter exercises based on filters only (already language-filtered by getSpeakingExercises)
  const filteredExercises = exercises.filter((ex) => {
    const themeMatch = !filterTheme || ex.theme === filterTheme
    const levelMatch = !filterLevel || ex.level === filterLevel
    return themeMatch && levelMatch
  })

  const handlePlayAudio = async () => {
    if (!currentExercise) return
    try {
      await speakText(
        currentExercise.target_text,
        user?.activeLang || 'en'
      )
    } catch (error) {
      console.error('Error playing audio:', error)
    }
  }

  const handleStartRecording = async () => {
    if (!recognitionRef.current || micDenied) return

    try {
      // Request microphone access
      await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch (error: any) {
      if (
        error.name === 'NotAllowedError' ||
        error.name === 'PermissionDeniedError'
      ) {
        setMicDenied(true)
      }
      console.error('Microphone access denied:', error)
      return
    }

    setIsRecording(true)
    setHeardText('')
    setResult(null)

    const recognition = recognitionRef.current
    const langCode =
      LANGUAGE_CODES[user?.activeLang || 'en'] ||
      user?.activeLang ||
      'en-US'

    recognition.lang = langCode
    recognition.interimResults = false
    recognition.maxAlternatives = 1

    recognition.onstart = () => {
      setIsRecording(true)
    }

    recognition.onresult = (event: any) => {
      let transcript = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript
      }
      setHeardText(transcript)
      setIsRecording(false)
      compareResults(transcript)
    }

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error)
      setIsRecording(false)
      if (event.error === 'network') {
        setHeardText('Network error. Please try again.')
      } else if (event.error === 'no-speech') {
        setHeardText('No speech detected. Please try again.')
      }
    }

    recognition.onend = () => {
      setIsRecording(false)
    }

    try {
      recognition.start()
    } catch (error) {
      console.error('Error starting recognition:', error)
      setIsRecording(false)
    }
  }

  const handleStopRecording = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
      setIsRecording(false)
    }
  }

  const compareResults = (heardTranscript: string) => {
    if (!currentExercise) return

    const targetLower = currentExercise.target_text.toLowerCase().trim()
    const heardLower = heardTranscript.toLowerCase().trim()

    const maxDist = Math.max(1, Math.floor(currentExercise.target_text.length * 0.2))
    const isMatch = isCloseEnough(heardLower, targetLower, maxDist)

    if (isMatch) {
      setResult('match')
    } else {
      setResult('mismatch')
    }
  }

  const handleTryAgain = () => {
    setResult(null)
    setHeardText('')
  }

  const handleNextExercise = () => {
    if (currentIndex < filteredExercises.length - 1) {
      setCurrentIndex(currentIndex + 1)
      setHeardText('')
      setResult(null)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex items-center justify-center">
        <div className="text-center">
          <BookOpen className="w-12 h-12 text-[#002844] mx-auto mb-4 animate-pulse" />
          <p className="text-[#555555]">Loading exercises...</p>
        </div>
      </div>
    )
  }

  const currentExercise = filteredExercises[currentIndex]
  const hasMoreExercises = currentIndex < filteredExercises.length - 1

  if (filteredExercises.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 text-[#002844] hover:text-[#D9B438] mb-8 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>{t('module.back', interfaceLang)}</span>
          </Link>

          <div className="text-center py-16">
            <BookOpen className="w-16 h-16 text-[#002844] mx-auto mb-4 opacity-50" />
            <h1 className="text-3xl font-bold text-[#002844] mb-4">
              {t('oral.title', interfaceLang)}
            </h1>
            <div className="max-w-md mx-auto">
              <p style={{ color: '#002844', fontSize: '1.125rem', fontWeight: '600', marginBottom: '1rem' }}>
                {interfaceLang === 'fr'
                  ? 'Aucun contenu disponible pour vos thèmes et votre niveau actuellement'
                  : 'No content available for your themes and level currently'}
              </p>
              <p style={{ color: '#555555', fontSize: '0.95rem', marginBottom: '1.5rem' }}>
                {interfaceLang === 'fr'
                  ? "L'administrateur va enrichir le contenu bientôt. En attendant, explorez les autres modules !"
                  : 'The administrator will add content soon. In the meantime, explore other modules!'}
              </p>
              <a
                href="/dashboard"
                className="mt-4 inline-block px-6 py-2 rounded-xl bg-[#002844] text-white text-sm font-bold hover:bg-[#003a5c] transition-colors"
              >
                {interfaceLang === 'fr' ? 'Retour au dashboard' : 'Back to dashboard'}
              </a>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!speechApiSupported) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 text-[#002844] hover:text-[#D9B438] mb-8 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>{t('module.back', interfaceLang)}</span>
          </Link>

          <div className="bg-red-50 border-2 border-red-200 rounded-lg p-8 text-center">
            <MicOff className="w-12 h-12 text-red-600 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-[#002844] mb-2">
              {t('oral.micRequired', interfaceLang)}
            </h2>
            <p className="text-[#555555]">
              Your browser does not support the Speech Recognition API. Please
              use Chrome, Edge, or Safari.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 text-[#002844] hover:text-[#D9B438] mb-4 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>{t('module.back', interfaceLang)}</span>
            </Link>
            <h1 className="text-4xl font-bold text-[#002844]">
              {t('oral.title', interfaceLang)}
            </h1>
          </div>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <div>
            <label className="block text-sm font-semibold text-[#002844] mb-2">
              Theme
            </label>
            <select
              value={filterTheme || ''}
              onChange={(e) => {
                setFilterTheme(e.target.value || null)
                setCurrentIndex(0)
              }}
              className="w-full px-4 py-2 border border-[#D9B438] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#D9B438] text-[#555555]"
            >
              <option value="">All Themes</option>
              {themes.map((theme) => (
                <option key={theme} value={theme}>
                  {theme}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-[#002844] mb-2">
              Level
            </label>
            <select
              value={filterLevel || ''}
              onChange={(e) => {
                setFilterLevel(e.target.value || null)
                setCurrentIndex(0)
              }}
              className="w-full px-4 py-2 border border-[#D9B438] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#D9B438] text-[#555555]"
            >
              <option value="">All Levels</option>
              {levels.map((level) => (
                <option key={level} value={level}>
                  {level}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Exercise Counter */}
        <div className="text-right text-sm font-semibold text-[#555555] mb-4">
          {currentIndex + 1} / {filteredExercises.length}
        </div>

        {currentExercise && (
          <div className="bg-white rounded-xl shadow-lg p-8 mb-8">
            {/* Type Badge */}
            <div className="flex items-center gap-2 mb-6">
              <span className="inline-block px-3 py-1 rounded-full text-xs font-bold text-white bg-[#002844]">
                {currentExercise.type.toUpperCase()}
              </span>
            </div>

            {/* Instruction */}
            <div className="mb-8">
              <h2 className="text-lg font-semibold text-[#002844] mb-2">
                {t('oral.instruction', interfaceLang)}
              </h2>
              <p className="text-[#555555] leading-relaxed">
                {interfaceLang === 'fr'
                  ? currentExercise.instruction_fr
                  : currentExercise.instruction_en}
              </p>
            </div>

            {/* Target Text */}
            <div className="mb-8">
              <h3 className="text-sm font-semibold text-[#002844] mb-4">
                {t('oral.target_text', interfaceLang)}
              </h3>
              <div className="p-6 bg-blue-50 rounded-lg border-2 border-[#D9B438] text-center">
                <p className="text-3xl font-bold text-[#002844]">
                  {currentExercise.target_text}
                </p>
              </div>
            </div>

            {/* Playback Button */}
            <button
              onClick={handlePlayAudio}
              className="flex items-center gap-2 px-6 py-3 bg-[#D9B438] text-[#002844] font-bold rounded-lg hover:bg-[#c9a530] transition-colors mb-8"
            >
              <Volume2 className="w-5 h-5" />
              {t('oral.record', interfaceLang)}
            </button>

            {/* Recording Status and Heard Text */}
            {heardText && (
              <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-300">
                <p className="text-sm font-semibold text-[#002844] mb-2">
                  What we heard:
                </p>
                <p className="text-[#555555]">{heardText}</p>
              </div>
            )}

            {/* Result Display */}
            {result && (
              <div
                className={`mb-6 p-4 rounded-lg border-2 flex items-start gap-4 ${
                  result === 'match'
                    ? 'bg-green-50 border-green-200'
                    : 'bg-red-50 border-red-200'
                }`}
              >
                <div className="mt-1">
                  {result === 'match' ? (
                    <CheckCircle className="w-6 h-6 text-green-600" />
                  ) : (
                    <XCircle className="w-6 h-6 text-red-600" />
                  )}
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-[#002844] mb-2">
                    {result === 'match'
                      ? t('writing.result.correct', interfaceLang)
                      : t('writing.result.incorrect', interfaceLang)}
                  </h3>
                </div>
              </div>
            )}

            {/* Mic Denied Message */}
            {micDenied && (
              <div className="mb-6 p-4 bg-orange-50 rounded-lg border-2 border-orange-200 flex items-start gap-4">
                <MicOff className="w-6 h-6 text-orange-600 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-bold text-[#002844] mb-1">
                    Microphone Access Denied
                  </h3>
                  <p className="text-sm text-[#555555]">
                    {t('oral.micDenied', interfaceLang)}
                  </p>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-4 flex-wrap">
              {result === null ? (
                <>
                  {!isRecording ? (
                    <button
                      onClick={handleStartRecording}
                      disabled={micDenied}
                      className="flex items-center gap-2 px-6 py-3 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <Mic className="w-5 h-5" />
                      {t('oral.record', interfaceLang)}
                    </button>
                  ) : (
                    <button
                      onClick={handleStopRecording}
                      className="flex items-center gap-2 px-6 py-3 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 transition-colors animate-pulse"
                    >
                      <Mic className="w-5 h-5" />
                      {t('oral.recording', interfaceLang)}
                    </button>
                  )}
                </>
              ) : (
                <>
                  <button
                    onClick={handleTryAgain}
                    className="px-6 py-3 bg-[#555555] text-white font-bold rounded-lg hover:bg-[#333333] transition-colors"
                  >
                    {t('oral.tryAgain', interfaceLang)}
                  </button>
                  {hasMoreExercises && (
                    <button
                      onClick={handleNextExercise}
                      className="flex items-center gap-2 px-6 py-3 bg-[#002844] text-white font-bold rounded-lg hover:bg-[#001a28] transition-colors"
                    >
                      {t('oral.next', interfaceLang)}
                      <ArrowLeft className="w-5 h-5 rotate-180" />
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
