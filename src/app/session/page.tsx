'use client'

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Play, CheckCircle, XCircle, ArrowRight, Trophy, Flame,
  BookOpen, PenTool, Mic, Volume2, Pencil, Home,
} from 'lucide-react'
import { getCurrentUser, updateUserProgress } from '@/lib/db/localStorage'
import { User, InterfaceLanguage, LearningObjective } from '@/types'
import {
  getVocabulary, getGrammarRules, getExercisesForRule,
  getReadingTexts, getSpeakingExercises, getWritingExercises,
  speakText, isCloseEnough,
} from '@/lib/db/bankHelpers'
import type { VocabWord, GrammarExercise, ReadingText, SpeakingExercise, WritingExercise } from '@/lib/db/bankTypes'

// ==========================================
// TYPES
// ==========================================

type SessionPhase = 'intro' | 'exercise' | 'summary'

interface SessionExercise {
  type: 'vocab_translate' | 'vocab_listen' | 'grammar_qcm' | 'reading_comprehension' | 'speaking_repeat' | 'writing_fill'
  module: LearningObjective
  data: any
  question: string
  answer: string
  options?: string[]
  hint?: string
}

interface SessionResult {
  exercise: SessionExercise
  userAnswer: string
  correct: boolean
}

// ==========================================
// EXERCISE GENERATORS
// ==========================================

function generateVocabExercises(words: VocabWord[], count: number): SessionExercise[] {
  const shuffled = [...words].sort(() => Math.random() - 0.5).slice(0, count)
  return shuffled.map((w, i) => {
    if (i % 2 === 0) {
      // Translate FR → Target
      return {
        type: 'vocab_translate',
        module: 'vocabulaire',
        data: w,
        question: w.word_fr,
        answer: w.word_target,
        hint: w.definition_en,
      }
    } else {
      // Translate Target → FR
      return {
        type: 'vocab_translate',
        module: 'vocabulaire',
        data: w,
        question: w.word_target,
        answer: w.word_fr,
        hint: w.definition_en,
      }
    }
  })
}

function generateGrammarExercises(exercises: GrammarExercise[], count: number): SessionExercise[] {
  const shuffled = [...exercises].sort(() => Math.random() - 0.5).slice(0, count)
  return shuffled.map(ex => ({
    type: 'grammar_qcm',
    module: 'grammaire',
    data: ex,
    question: ex.question,
    answer: ex.answer,
    options: ex.options,
  }))
}

function generateReadingExercise(texts: ReadingText[]): SessionExercise | null {
  if (texts.length === 0) return null
  const text = texts[Math.floor(Math.random() * texts.length)]
  const words = text.body_text.split(/\s+/)
  // Simple comprehension: how many words
  return {
    type: 'reading_comprehension',
    module: 'lecture',
    data: text,
    question: text.body_text,
    answer: String(words.length),
    hint: text.title,
  }
}

function generateSpeakingExercises(exercises: SpeakingExercise[], count: number): SessionExercise[] {
  const shuffled = [...exercises].sort(() => Math.random() - 0.5).slice(0, count)
  return shuffled.map(ex => ({
    type: 'speaking_repeat',
    module: 'oral',
    data: ex,
    question: ex.instruction_fr,
    answer: ex.target_text,
  }))
}

function generateWritingExercises(exercises: WritingExercise[], count: number): SessionExercise[] {
  const shuffled = [...exercises].sort(() => Math.random() - 0.5).slice(0, count)
  return shuffled.map(ex => ({
    type: 'writing_fill',
    module: 'ecrit',
    data: ex,
    question: ex.prompt || ex.instruction_fr || ex.instruction_en || '',
    answer: ex.answer || '',
    hint: ex.instruction_en,
  }))
}

// ==========================================
// COMPONENT
// ==========================================

export default function SessionPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [lang, setLang] = useState<InterfaceLanguage>('fr')
  const [loading, setLoading] = useState(true)
  const [phase, setPhase] = useState<SessionPhase>('intro')
  const [introCountdown, setIntroCountdown] = useState(5)
  const [exercises, setExercises] = useState<SessionExercise[]>([])
  const [currentIdx, setCurrentIdx] = useState(0)
  const [results, setResults] = useState<SessionResult[]>([])
  const [userInput, setUserInput] = useState('')
  const [selectedOption, setSelectedOption] = useState<string | null>(null)
  const [showFeedback, setShowFeedback] = useState(false)
  const [isCorrect, setIsCorrect] = useState(false)
  const [sessionModules, setSessionModules] = useState<string[]>([])

  // Speech recognition refs
  const recognitionRef = useRef<any>(null)
  const [isRecording, setIsRecording] = useState(false)
  const [heardText, setHeardText] = useState('')

  // Build session exercises
  const buildSession = useCallback((currentUser: User) => {
    const activeLang = currentUser.activeLang || currentUser.settings.learningLangs[0] || 'en'
    const langConfig = currentUser.settings.languageConfigs?.[activeLang]
    const userLevel = currentUser.progress?.[activeLang]?.levelCecrl || 'A1'
    const userThemes = langConfig?.themes || ['travel']
    const objectives = langConfig?.objectives || ['vocabulaire', 'grammaire']
    const progress = currentUser.progress?.[activeLang]

    // Determine which modules to include based on objectives, prioritize lowest progress
    const moduleBlocks: { id: LearningObjective; pct: number }[] = [
      { id: 'vocabulaire', pct: progress?.objectiveProgress?.vocabulaire || 0 },
      { id: 'grammaire', pct: progress?.objectiveProgress?.grammaire || 0 },
      { id: 'lecture', pct: progress?.objectiveProgress?.lecture || 0 },
      { id: 'oral', pct: progress?.objectiveProgress?.oral || 0 },
      { id: 'ecrit', pct: progress?.objectiveProgress?.ecrit || 0 },
    ]

    // Prioritize user's objectives, then fill others
    const prioritized = [
      ...moduleBlocks.filter(b => (objectives as string[]).includes(b.id)).sort((a, b) => a.pct - b.pct),
      ...moduleBlocks.filter(b => !(objectives as string[]).includes(b.id)).sort((a, b) => a.pct - b.pct),
    ].slice(0, 3) // Pick top 3 modules for session

    const allExercises: SessionExercise[] = []
    const usedModules: string[] = []

    for (const mod of prioritized) {
      switch (mod.id) {
        case 'vocabulaire': {
          const words = getVocabulary(activeLang, userThemes, userLevel)
          if (words.length > 0) {
            allExercises.push(...generateVocabExercises(words, 3))
            usedModules.push(mod.id)
          }
          break
        }
        case 'grammaire': {
          const rules = getGrammarRules(activeLang, userLevel)
          const gramExercises: GrammarExercise[] = []
          rules.forEach(r => gramExercises.push(...getExercisesForRule(r.id)))
          if (gramExercises.length > 0) {
            allExercises.push(...generateGrammarExercises(gramExercises, 3))
            usedModules.push(mod.id)
          }
          break
        }
        case 'lecture': {
          const texts = getReadingTexts(activeLang, userThemes, userLevel)
          const readEx = generateReadingExercise(texts)
          if (readEx) {
            allExercises.push(readEx)
            usedModules.push(mod.id)
          }
          break
        }
        case 'oral': {
          const speakExercises = getSpeakingExercises(activeLang, userThemes, userLevel)
          if (speakExercises.length > 0) {
            allExercises.push(...generateSpeakingExercises(speakExercises, 2))
            usedModules.push(mod.id)
          }
          break
        }
        case 'ecrit': {
          const writeExercises = getWritingExercises(activeLang, userThemes, userLevel)
          if (writeExercises.length > 0) {
            allExercises.push(...generateWritingExercises(writeExercises, 2))
            usedModules.push(mod.id)
          }
          break
        }
      }
    }

    // Shuffle exercises for variety
    const shuffled = allExercises.sort(() => Math.random() - 0.5)
    setExercises(shuffled)
    setSessionModules(Array.from(new Set(usedModules)))
  }, [])

  useEffect(() => {
    const currentUser = getCurrentUser()
    if (!currentUser) { router.push('/auth'); return }
    if (!currentUser.onboardingCompleted && currentUser.role !== 'admin') { router.push('/onboarding'); return }
    setUser(currentUser)
    setLang(currentUser.settings.interfaceLang || 'fr')
    buildSession(currentUser)

    // Init speech recognition
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition()
    }

    setLoading(false)
  }, [router, buildSession])

  // Intro countdown
  useEffect(() => {
    if (phase !== 'intro') return
    if (introCountdown <= 0) {
      if (exercises.length > 0) {
        setPhase('exercise')
      } else {
        setPhase('summary')
      }
      return
    }
    const timer = setTimeout(() => setIntroCountdown(prev => prev - 1), 1000)
    return () => clearTimeout(timer)
  }, [phase, introCountdown, exercises.length])

  const currentExercise = exercises[currentIdx]

  const handleSubmitAnswer = (answer?: string) => {
    if (!currentExercise) return
    const userAnswer = answer || userInput.trim()
    let correct = false

    if (currentExercise.type === 'grammar_qcm') {
      correct = userAnswer === currentExercise.answer
    } else if (currentExercise.type === 'reading_comprehension') {
      // Auto-correct: reading is about reading, mark as completed
      correct = true
    } else if (currentExercise.type === 'speaking_repeat') {
      correct = isCloseEnough(userAnswer, currentExercise.answer, 3)
    } else {
      correct = isCloseEnough(userAnswer, currentExercise.answer, 2)
    }

    setIsCorrect(correct)
    setShowFeedback(true)
    setResults(prev => [...prev, { exercise: currentExercise, userAnswer, correct }])
  }

  const handleNext = () => {
    setShowFeedback(false)
    setUserInput('')
    setSelectedOption(null)
    setHeardText('')

    if (currentIdx < exercises.length - 1) {
      setCurrentIdx(prev => prev + 1)
    } else {
      // Session complete — update progress
      finishSession()
      setPhase('summary')
    }
  }

  const finishSession = () => {
    if (!user) return
    const activeLang = user.activeLang || user.settings.learningLangs[0] || 'en'
    const todayStr = new Date().toISOString().split('T')[0]
    const currentProgress = user.progress?.[activeLang]

    const totalCount = results.length + 1

    // Update streak
    const lastDate = currentProgress?.lastActivityDate
    let newStreak = currentProgress?.streak || 0
    if (lastDate !== todayStr) {
      // Check if yesterday
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      const yesterdayStr = yesterday.toISOString().split('T')[0]
      newStreak = lastDate === yesterdayStr ? newStreak + 1 : 1
    }

    updateUserProgress(user.id, activeLang, {
      streak: newStreak,
      lastActivityDate: todayStr,
      dailyExercisesCompleted: (currentProgress?.dailyExercisesCompleted || 0) + totalCount,
      dailyWordsCompleted: (currentProgress?.dailyWordsCompleted || 0) + results.filter(r => r.exercise.module === 'vocabulaire' && r.correct).length,
    })
  }

  // Speech recognition for oral exercises
  const startRecording = async () => {
    if (!recognitionRef.current) return
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch { return }

    setIsRecording(true)
    setHeardText('')
    const recognition = recognitionRef.current
    const activeLang = user?.activeLang || 'en'
    const langMap: Record<string, string> = { en: 'en-US', es: 'es-ES', fr: 'fr-FR', de: 'de-DE' }
    recognition.lang = langMap[activeLang] || 'en-US'
    recognition.interimResults = false

    recognition.onresult = (event: any) => {
      let transcript = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript
      }
      setHeardText(transcript)
      setIsRecording(false)
      handleSubmitAnswer(transcript)
    }

    recognition.onerror = () => setIsRecording(false)
    recognition.onend = () => setIsRecording(false)
    try { recognition.start() } catch { setIsRecording(false) }
  }

  const skipIntro = () => {
    if (exercises.length > 0) {
      setPhase('exercise')
    } else {
      setPhase('summary')
    }
  }

  if (loading || !user) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#F0F0F0]">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-[#002844]" />
      </div>
    )
  }

  const activeLang = user.activeLang || user.settings.learningLangs[0] || 'en'
  const sessionDuration = user.settings.schedules?.[activeLang]?.duration || user.settings.schedule?.duration || 10

  const moduleIcons: Record<string, any> = {
    vocabulaire: BookOpen,
    grammaire: PenTool,
    lecture: BookOpen,
    oral: Mic,
    ecrit: Pencil,
  }
  const moduleLabels: Record<string, Record<string, string>> = {
    vocabulaire: { fr: 'Vocabulaire', en: 'Vocabulary' },
    grammaire: { fr: 'Grammaire', en: 'Grammar' },
    lecture: { fr: 'Lecture', en: 'Reading' },
    oral: { fr: 'Oral', en: 'Speaking' },
    ecrit: { fr: 'Écrit', en: 'Writing' },
  }

  // ==========================================
  // PHASE: INTRO (5 seconds)
  // ==========================================
  if (phase === 'intro') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#002844] to-[#003a5c] flex flex-col items-center justify-center px-6 text-center">
        <div className="mb-8">
          <div className="w-20 h-20 rounded-full bg-[#D9B438] flex items-center justify-center mx-auto mb-6 animate-pulse">
            <Play className="h-10 w-10 text-[#002844] ml-1" fill="#002844" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-3">
            {lang === 'fr' ? 'Session du jour' : "Today's Session"}
          </h1>
          <p className="text-white/70 text-sm mb-2">
            ~{sessionDuration} min · {exercises.length} {lang === 'fr' ? 'exercices' : 'exercises'}
          </p>
          <div className="flex gap-2 justify-center flex-wrap mt-4">
            {sessionModules.map(mod => {
              const Icon = moduleIcons[mod] || BookOpen
              return (
                <div key={mod} className="flex items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-full">
                  <Icon className="h-4 w-4 text-[#D9B438]" />
                  <span className="text-xs text-white font-medium">{moduleLabels[mod]?.[lang] || mod}</span>
                </div>
              )
            })}
          </div>
        </div>

        <div className="text-6xl font-bold text-[#D9B438] mb-8 tabular-nums">
          {introCountdown}
        </div>

        <button onClick={skipIntro}
          className="text-white/50 text-sm hover:text-white transition-colors">
          {lang === 'fr' ? 'Commencer maintenant →' : 'Start now →'}
        </button>
      </div>
    )
  }

  // ==========================================
  // PHASE: SUMMARY
  // ==========================================
  if (phase === 'summary') {
    const correctCount = results.filter(r => r.correct).length
    const totalCount = results.length
    const pct = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0

    return (
      <div className="min-h-screen bg-[#F0F0F0] px-4 py-8">
        <div className="max-w-lg mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-20 h-20 rounded-full bg-[#D9B438]/20 flex items-center justify-center mx-auto mb-4">
              <Trophy className="h-10 w-10 text-[#D9B438]" />
            </div>
            <h1 className="text-2xl font-bold text-[#002844] mb-2">
              {lang === 'fr' ? 'Session terminée !' : 'Session complete!'}
            </h1>
            <p className="text-sm text-[#555555]">
              {lang === 'fr'
                ? `${correctCount}/${totalCount} bonnes réponses (${pct}%)`
                : `${correctCount}/${totalCount} correct answers (${pct}%)`}
            </p>
          </div>

          {/* Score visual */}
          <div className="rounded-2xl bg-white p-6 shadow-sm mb-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-bold text-[#002844]">{lang === 'fr' ? 'Score' : 'Score'}</span>
              <span className="text-2xl font-bold text-[#D9B438]">{pct}%</span>
            </div>
            <div className="h-3 w-full rounded-full bg-gray-100">
              <div className="h-full rounded-full transition-all"
                style={{
                  width: `${pct}%`,
                  backgroundColor: pct >= 80 ? '#2E7D32' : pct >= 50 ? '#D9B438' : '#E65100',
                }} />
            </div>
          </div>

          {/* Results detail */}
          <div className="rounded-2xl bg-white p-4 shadow-sm mb-6 space-y-3">
            <h3 className="font-bold text-sm text-[#002844] mb-2">{lang === 'fr' ? 'Détail' : 'Details'}</h3>
            {results.map((r, i) => (
              <div key={i} className="flex items-center gap-3 py-2 border-b border-gray-100 last:border-0">
                {r.correct
                  ? <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
                  : <XCircle className="h-5 w-5 text-red-500 flex-shrink-0" />}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[#002844] truncate">{r.exercise.question.slice(0, 60)}{r.exercise.question.length > 60 ? '...' : ''}</p>
                  {!r.correct && (
                    <p className="text-xs text-[#555555] mt-0.5">
                      {lang === 'fr' ? 'Réponse correcte :' : 'Correct answer:'} <span className="font-semibold text-green-700">{r.exercise.answer}</span>
                    </p>
                  )}
                </div>
                <span className="text-xs font-medium text-[#555555] bg-gray-100 px-2 py-0.5 rounded-full">
                  {moduleLabels[r.exercise.module]?.[lang] || r.exercise.module}
                </span>
              </div>
            ))}
          </div>

          {/* Streak */}
          <div className="rounded-2xl bg-white p-4 shadow-sm mb-6 flex items-center gap-3">
            <Flame className="h-6 w-6 text-[#D9B438]" fill="#D9B438" />
            <div>
              <p className="text-sm font-bold text-[#002844]">
                {lang === 'fr' ? 'Série en cours' : 'Current streak'}
              </p>
              <p className="text-xs text-[#555555]">
                {lang === 'fr' ? 'Continue demain pour garder ta série !' : 'Continue tomorrow to keep your streak!'}
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-3">
            <a href="/dashboard"
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[#002844] text-white font-bold text-sm hover:bg-[#003a5c] transition-colors">
              <Home className="h-4 w-4" />
              {lang === 'fr' ? 'Retour au dashboard' : 'Back to dashboard'}
            </a>
            <button onClick={() => {
              setPhase('intro')
              setIntroCountdown(5)
              setCurrentIdx(0)
              setResults([])
              setShowFeedback(false)
              setUserInput('')
              buildSession(user)
            }}
              className="w-full py-3 rounded-xl bg-[#D9B438] text-[#002844] font-bold text-sm hover:bg-[#c9a530] transition-colors">
              {lang === 'fr' ? 'Nouvelle session' : 'New session'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ==========================================
  // PHASE: EXERCISE
  // ==========================================
  if (!currentExercise) {
    setPhase('summary')
    return null
  }

  const progressPct = Math.round(((currentIdx) / exercises.length) * 100)
  const ModIcon = moduleIcons[currentExercise.module] || BookOpen

  return (
    <div className="min-h-screen bg-[#F0F0F0] px-4 py-6">
      <div className="max-w-lg mx-auto">
        {/* Progress bar */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-[#002844]">{currentIdx + 1}/{exercises.length}</span>
            <div className="flex items-center gap-1.5">
              <ModIcon className="h-4 w-4 text-[#D9B438]" />
              <span className="text-xs font-medium text-[#555555]">{moduleLabels[currentExercise.module]?.[lang]}</span>
            </div>
          </div>
          <div className="h-2 w-full rounded-full bg-gray-200">
            <div className="h-full rounded-full bg-[#D9B438] transition-all" style={{ width: `${progressPct}%` }} />
          </div>
        </div>

        {/* Exercise card */}
        <div className="rounded-2xl bg-white p-6 shadow-sm mb-6">
          {/* Exercise type badge */}
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xs font-bold px-3 py-1 rounded-full bg-[#002844] text-white">
              {currentExercise.type === 'vocab_translate' ? (lang === 'fr' ? 'Traduction' : 'Translation') :
               currentExercise.type === 'grammar_qcm' ? 'QCM' :
               currentExercise.type === 'reading_comprehension' ? (lang === 'fr' ? 'Lecture' : 'Reading') :
               currentExercise.type === 'speaking_repeat' ? (lang === 'fr' ? 'Prononciation' : 'Pronunciation') :
               currentExercise.type === 'writing_fill' ? (lang === 'fr' ? 'Écriture' : 'Writing') : ''}
            </span>
          </div>

          {/* Question */}
          {currentExercise.type === 'reading_comprehension' ? (
            <div>
              <h2 className="text-sm font-bold text-[#002844] mb-3">
                {lang === 'fr' ? 'Lisez ce texte attentivement :' : 'Read this text carefully:'}
              </h2>
              <p className="text-sm text-[#555555] leading-relaxed mb-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                {currentExercise.question.slice(0, 500)}{currentExercise.question.length > 500 ? '...' : ''}
              </p>
              {currentExercise.hint && (
                <p className="text-xs text-[#D9B438] font-semibold mb-2">📖 {currentExercise.hint}</p>
              )}
            </div>
          ) : currentExercise.type === 'speaking_repeat' ? (
            <div>
              <h2 className="text-base font-bold text-[#002844] mb-4">
                {lang === 'fr' ? 'Prononcez :' : 'Say:'}
              </h2>
              <div className="p-6 bg-blue-50 rounded-xl border-2 border-[#D9B438] text-center mb-4">
                <p className="text-2xl font-bold text-[#002844]">{currentExercise.answer}</p>
              </div>
              <button onClick={() => speakText(currentExercise.answer, activeLang)}
                className="flex items-center gap-2 px-4 py-2 bg-[#D9B438] text-[#002844] rounded-lg font-semibold text-sm mb-4">
                <Volume2 className="h-4 w-4" />
                {lang === 'fr' ? 'Écouter' : 'Listen'}
              </button>
            </div>
          ) : (
            <div>
              <h2 className="text-sm font-semibold text-[#555555] mb-2">
                {currentExercise.type === 'vocab_translate'
                  ? (lang === 'fr' ? 'Traduisez ce mot :' : 'Translate this word:')
                  : (lang === 'fr' ? 'Répondez :' : 'Answer:')}
              </h2>
              <p className="text-xl font-bold text-[#002844] mb-4 p-4 bg-gray-50 rounded-xl text-center">
                {currentExercise.question}
              </p>
            </div>
          )}

          {/* Input / Options */}
          {!showFeedback && (
            <>
              {currentExercise.type === 'grammar_qcm' && currentExercise.options ? (
                <div className="space-y-2">
                  {currentExercise.options.map((opt, i) => (
                    <button key={i} onClick={() => { setSelectedOption(opt); handleSubmitAnswer(opt) }}
                      className={`w-full text-left p-3 rounded-xl border-2 transition-all text-sm font-medium ${
                        selectedOption === opt ? 'border-[#D9B438] bg-[#D9B438]/10' : 'border-gray-200 hover:border-[#D9B438]/50'
                      }`}
                      style={{ color: '#002844' }}>
                      <span className="font-bold text-[#555555] mr-2">{String.fromCharCode(65 + i)}.</span>
                      {opt}
                    </button>
                  ))}
                </div>
              ) : currentExercise.type === 'reading_comprehension' ? (
                <button onClick={() => handleSubmitAnswer('read')}
                  className="w-full py-3 rounded-xl bg-[#002844] text-white font-bold text-sm hover:bg-[#003a5c] transition-colors">
                  {lang === 'fr' ? "J'ai lu ce texte ✓" : 'I read this text ✓'}
                </button>
              ) : currentExercise.type === 'speaking_repeat' ? (
                <div>
                  {heardText && (
                    <div className="mb-3 p-3 bg-gray-50 rounded-lg">
                      <p className="text-xs font-semibold text-[#002844] mb-1">
                        {lang === 'fr' ? 'Entendu :' : 'Heard:'}
                      </p>
                      <p className="text-sm text-[#555555]">{heardText}</p>
                    </div>
                  )}
                  <button onClick={startRecording} disabled={isRecording}
                    className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-colors ${
                      isRecording ? 'bg-red-600 text-white animate-pulse' : 'bg-red-600 text-white hover:bg-red-700'
                    }`}>
                    <Mic className="h-4 w-4" />
                    {isRecording ? (lang === 'fr' ? 'Écoute en cours...' : 'Listening...') : (lang === 'fr' ? 'Enregistrer' : 'Record')}
                  </button>
                </div>
              ) : (
                <div>
                  <input type="text" value={userInput} onChange={e => setUserInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && userInput.trim()) handleSubmitAnswer() }}
                    className="w-full px-4 py-3 rounded-xl border-2 border-[#D9B438] text-sm mb-3"
                    style={{ color: '#002844' }}
                    placeholder={lang === 'fr' ? 'Votre réponse...' : 'Your answer...'}
                    autoFocus />
                  <button onClick={() => handleSubmitAnswer()} disabled={!userInput.trim()}
                    className="w-full py-3 rounded-xl bg-[#002844] text-white font-bold text-sm hover:bg-[#003a5c] transition-colors disabled:opacity-50">
                    {lang === 'fr' ? 'Valider' : 'Submit'}
                  </button>
                </div>
              )}
            </>
          )}

          {/* Feedback */}
          {showFeedback && (
            <div className={`mt-4 p-4 rounded-xl border-2 ${isCorrect ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
              <div className="flex items-center gap-2 mb-2">
                {isCorrect
                  ? <CheckCircle className="h-5 w-5 text-green-600" />
                  : <XCircle className="h-5 w-5 text-red-500" />}
                <span className="font-bold text-sm" style={{ color: isCorrect ? '#2E7D32' : '#C62828' }}>
                  {isCorrect
                    ? (lang === 'fr' ? 'Correct !' : 'Correct!')
                    : (lang === 'fr' ? 'Incorrect' : 'Incorrect')}
                </span>
              </div>
              {!isCorrect && currentExercise.type !== 'reading_comprehension' && (
                <p className="text-sm text-[#555555]">
                  {lang === 'fr' ? 'Réponse correcte :' : 'Correct answer:'}{' '}
                  <span className="font-bold text-green-700">{currentExercise.answer}</span>
                </p>
              )}
              <button onClick={handleNext}
                className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#002844] text-white font-bold text-sm hover:bg-[#003a5c] transition-colors">
                {currentIdx < exercises.length - 1
                  ? <>{lang === 'fr' ? 'Suivant' : 'Next'} <ArrowRight className="h-4 w-4" /></>
                  : <>{lang === 'fr' ? 'Voir le résumé' : 'See summary'} <Trophy className="h-4 w-4" /></>}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
