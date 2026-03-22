'use client'

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Play, CheckCircle, XCircle, ArrowRight, Trophy, Flame,
  BookOpen, PenTool, Mic, Volume2, Pencil, Home, Volume,
} from 'lucide-react'
import { getCurrentUser, updateUserProgress } from '@/lib/db/localStorage'
import { User, InterfaceLanguage, LearningObjective } from '@/types'
import {
  getVocabulary, getGrammarRules, getExercisesForRule,
  getReadingTexts, getSpeakingExercises, getWritingExercises,
  speakText, isCloseEnough, addToPersonalVocab,
} from '@/lib/db/bankHelpers'
import type { VocabWord, GrammarExercise, ReadingText, SpeakingExercise, WritingExercise } from '@/lib/db/bankTypes'

// ==========================================
// TYPES
// ==========================================

type SessionPhase = 'intro' | 'lessonMap' | 'exercise' | 'summary'

interface SessionExercise {
  type: 'vocab_translate' | 'vocab_listen' | 'grammar_qcm' | 'reading_comprehension' | 'speaking_repeat' | 'writing_fill'
  module: LearningObjective
  data: any
  question: string
  answer: string
  options?: string[]
  hint?: string
  readingText?: string
  comprehensionQuestion?: string
  comprehensionAnswer?: string
  comprehensionOptions?: string[]
  lessonIndex?: number
}

interface SessionLesson {
  id: string
  title: { fr: string; en: string }
  module: string
  icon: string
  exercises: number[] // indices into the exercises array
  completed: boolean
  score?: number
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
  // BUG-43: For fill_blank exercises without options, generate QCM options
  const allAnswers = exercises.map(e => e.answer)
  const fallbacks = ['am', 'is', 'are', 'be', 'do', 'does', 'have', 'has', 'was', 'were', 'the', 'a', 'an']
  return shuffled.map(ex => {
    let options = ex.options
    if (!options || options.length === 0) {
      // Auto-generate 4 options including correct answer
      const distractors = Array.from(new Set(
        [...allAnswers, ...fallbacks].filter(a => a !== ex.answer)
      )).slice(0, 3)
      options = [ex.answer, ...distractors].sort(() => Math.random() - 0.5)
    }
    return {
      type: 'grammar_qcm',
      module: 'grammaire',
      data: ex,
      question: ex.question,
      answer: ex.answer,
      options,
    }
  })
}

function generateReadingExercise(texts: ReadingText[]): SessionExercise | null {
  if (texts.length === 0) return null
  const text = texts[Math.floor(Math.random() * texts.length)]

  // Generate comprehension questions based on text title
  let comprehensionQuestion = ''
  let comprehensionAnswer = ''
  let comprehensionOptions: string[] = []

  switch (text.title) {
    case 'My Family':
      comprehensionQuestion = "What does Emma's mother do?"
      comprehensionAnswer = 'She is a teacher'
      comprehensionOptions = ['She is a teacher', 'She is a doctor', 'She cooks Italian food']
      break
    case 'A Family Dinner':
      comprehensionQuestion = 'What does Grandma make?'
      comprehensionAnswer = 'Pasta and salad'
      comprehensionOptions = ['Pasta and salad', 'Pizza and soup', 'Rice and chicken']
      break
    case 'My Grandparents':
      comprehensionQuestion = 'Where do the grandparents live?'
      comprehensionAnswer = 'Near a small lake'
      comprehensionOptions = ['In the city', 'Near a river', 'Near a small lake']
      break
    default:
      comprehensionQuestion = 'What is the main topic of this text?'
      comprehensionAnswer = text.theme || 'General'
      comprehensionOptions = [text.theme || 'General', 'Other topic 1', 'Other topic 2']
      break
  }

  return {
    type: 'reading_comprehension',
    module: 'lecture',
    data: text,
    question: text.body_text,
    answer: comprehensionAnswer,
    hint: text.title,
    readingText: text.body_text,
    comprehensionQuestion,
    comprehensionAnswer,
    comprehensionOptions,
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
  const [lessons, setLessons] = useState<SessionLesson[]>([])
  const [currentLessonIdx, setCurrentLessonIdx] = useState(0)
  const [showingComprehension, setShowingComprehension] = useState(false)
  const [wordDefinition, setWordDefinition] = useState<{ word: string; definition: string } | null>(null)
  const [defPosition, setDefPosition] = useState<{ x: number; y: number } | null>(null)

  // Speech recognition refs
  const recognitionRef = useRef<any>(null)
  const [isRecording, setIsRecording] = useState(false)
  const [heardText, setHeardText] = useState('')

  // BUG-33: TTS audio + speed control + word highlight
  const [readingSpeed, setReadingSpeed] = useState(1)
  const [highlightWordIndex, setHighlightWordIndex] = useState<number | null>(null)
  const [isReadingAloud, setIsReadingAloud] = useState(false)

  // BUG-34: text spacing + truncation
  const [readingExpanded, setReadingExpanded] = useState(false)

  // BUG-37: "Why am I wrong?" explanation
  const [showWhyWrong, setShowWhyWrong] = useState(false)

  // BUG-38: IPA phonetic transcriptions for common words
  const IPA_MAP: Record<string, string> = {
    'father': '[ˈfɑːðər]',
    'mother': '[ˈmʌðər]',
    'brother': '[ˈbrʌðər]',
    'sister': '[ˈsɪstər]',
    'family': '[ˈfæmɪli]',
    'grandmother': '[ˈɡrænˌmʌðər]',
    'grandfather': '[ˈɡrændˌfɑːðər]',
    'my father is kind': '[maɪ ˈfɑːðər ɪz kaɪnd]',
    'she is my sister': '[ʃiː ɪz maɪ ˈsɪstər]',
    'we are a happy family': '[wiː ɑːr ə ˈhæpi ˈfæmɪli]',
    'i love my mother': '[aɪ lʌv maɪ ˈmʌðər]',
    'he is my brother': '[hiː ɪz maɪ ˈbrʌðər]',
  }

  // Build session exercises with structured 4-step flow
  const buildSession = useCallback((currentUser: User) => {
    const activeLang = currentUser.activeLang || currentUser.settings.learningLangs[0] || 'en'
    const langConfig = currentUser.settings.languageConfigs?.[activeLang]
    const userLevel = currentUser.progress?.[activeLang]?.levelCecrl || 'A1'
    const userThemes = langConfig?.themes || ['travel']
    const objectives = langConfig?.objectives || ['vocabulaire', 'grammaire']
    const allExercises: SessionExercise[] = []
    const usedModules: string[] = []
    const userId = currentUser.id
    const todayStr = new Date().toISOString().split('T')[0]

    // STEP 1: Daily Words
    const chestKey = `lingualearn_chest_${userId}_${todayStr}`
    const chestOpened = localStorage.getItem(chestKey)
    if (!chestOpened) {
      const words = getVocabulary(activeLang, userThemes, userLevel)
      const wordsPerDay = currentUser.settings.schedules?.[activeLang]?.wordsPerDay || 8
      if (words.length > 0) {
        // Generate vocab presentation + matching exercises
        const dailyWords = words.slice(0, wordsPerDay)
        allExercises.push(...generateVocabExercises(dailyWords, Math.min(3, wordsPerDay)))
        usedModules.push('vocabulaire')
      }
      // Mark chest as opened
      localStorage.setItem(chestKey, 'true')
    }

    // STEP 2: Grammar rule of the day
    const grammarStarKey = `lingualearn_grammar_stars_${userId}_${activeLang}`
    const grammarProgressStr = localStorage.getItem(grammarStarKey)
    const grammarProgress = grammarProgressStr ? JSON.parse(grammarProgressStr) : {}

    const rules = getGrammarRules(activeLang, userLevel)
    const uncompleted = rules.find(r => !grammarProgress[r.id])
    if (uncompleted) {
      const gramExercises = getExercisesForRule(uncompleted.id)
      if (gramExercises.length > 0) {
        allExercises.push(...generateGrammarExercises(gramExercises, Math.min(3, gramExercises.length)))
        usedModules.push('grammaire')
      }
    }

    // STEP 3: Objective exercise based on user intentions
    const objectiveSet = new Set<string>(objectives as string[])
    if (objectiveSet.has('oral')) {
      const speakExercises = getSpeakingExercises(activeLang, userThemes, userLevel)
      if (speakExercises.length > 0) {
        allExercises.push(...generateSpeakingExercises(speakExercises, 2))
        usedModules.push('oral')
      }
    }
    if (objectiveSet.has('lecture')) {
      const texts = getReadingTexts(activeLang, userThemes, userLevel)
      const readEx = generateReadingExercise(texts)
      if (readEx) {
        allExercises.push(readEx)
        usedModules.push('lecture')
      }
    }
    if (objectiveSet.has('ecrit')) {
      const writeExercises = getWritingExercises(activeLang, userThemes, userLevel)
      if (writeExercises.length > 0) {
        allExercises.push(...generateWritingExercises(writeExercises, 2))
        usedModules.push('ecrit')
      }
    }

    // If no objective exercises added, default to vocab
    if (!objectiveSet.has('oral') && !objectiveSet.has('lecture') && !objectiveSet.has('ecrit')) {
      const words = getVocabulary(activeLang, userThemes, userLevel)
      if (words.length > 0) {
        allExercises.push(...generateVocabExercises(words, 3))
        if (!usedModules.includes('vocabulaire')) {
          usedModules.push('vocabulaire')
        }
      }
    }

    // STEP 4: Summary (handled separately in UI)

    // Tag exercises with lesson indices and build lesson map
    const sessionLessons: SessionLesson[] = []
    let exIdx = 0

    // Group vocab exercises into Lesson 1
    const vocabIndices: number[] = []
    while (exIdx < allExercises.length && allExercises[exIdx].module === 'vocabulaire') {
      allExercises[exIdx].lessonIndex = 0
      vocabIndices.push(exIdx)
      exIdx++
    }
    if (vocabIndices.length > 0) {
      sessionLessons.push({
        id: 'lesson_vocab',
        title: { fr: 'Vocabulaire du jour', en: 'Daily Vocabulary' },
        module: 'vocabulaire',
        icon: '📚',
        exercises: vocabIndices,
        completed: false,
      })
    }

    // Group grammar exercises into Lesson 2
    const grammarIndices: number[] = []
    while (exIdx < allExercises.length && allExercises[exIdx].module === 'grammaire') {
      allExercises[exIdx].lessonIndex = sessionLessons.length
      grammarIndices.push(exIdx)
      exIdx++
    }
    if (grammarIndices.length > 0) {
      sessionLessons.push({
        id: 'lesson_grammar',
        title: { fr: 'Règle de grammaire', en: 'Grammar Rule' },
        module: 'grammaire',
        icon: '✏️',
        exercises: grammarIndices,
        completed: false,
      })
    }

    // Group remaining exercises by module into Lesson 3+
    const remainingByModule: Record<string, number[]> = {}
    while (exIdx < allExercises.length) {
      const mod = allExercises[exIdx].module
      if (!remainingByModule[mod]) remainingByModule[mod] = []
      remainingByModule[mod].push(exIdx)
      exIdx++
    }
    const objectiveNames: Record<string, { fr: string; en: string; icon: string }> = {
      oral: { fr: 'Exercice oral', en: 'Speaking Exercise', icon: '🎤' },
      lecture: { fr: 'Lecture', en: 'Reading', icon: '📖' },
      ecrit: { fr: 'Expression écrite', en: 'Writing', icon: '✍️' },
      vocabulaire: { fr: 'Vocabulaire bonus', en: 'Bonus Vocabulary', icon: '📚' },
    }
    for (const [mod, indices] of Object.entries(remainingByModule)) {
      const lessonIdx = sessionLessons.length
      indices.forEach(i => { allExercises[i].lessonIndex = lessonIdx })
      sessionLessons.push({
        id: `lesson_${mod}`,
        title: objectiveNames[mod] || { fr: mod, en: mod },
        module: mod,
        icon: objectiveNames[mod]?.icon || '📝',
        exercises: indices,
        completed: false,
      })
    }

    // Add checkpoint at the end
    sessionLessons.push({
      id: 'checkpoint',
      title: { fr: 'Bilan de session', en: 'Session Summary' },
      module: 'checkpoint',
      icon: '🏆',
      exercises: [],
      completed: false,
    })

    // No shuffling — maintain the structured order
    setExercises(allExercises)
    setLessons(sessionLessons)
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
        setPhase('lessonMap')
      } else {
        setPhase('summary')
      }
      return
    }
    const timer = setTimeout(() => setIntroCountdown(prev => prev - 1), 1000)
    return () => clearTimeout(timer)
  }, [phase, introCountdown, exercises.length])

  const currentExercise = exercises[currentIdx]

  // BUG-37: Generate explanation for incorrect answers
  const getWhyWrongExplanation = (exercise: SessionExercise, userAnswer: string): string => {
    if (exercise.type === 'grammar_qcm' || exercise.module === 'grammaire') {
      const rule = exercise.data
      return lang === 'fr'
        ? `La bonne réponse est "${exercise.answer}". ${rule?.definition || rule?.definition_fr || 'Révisez cette règle dans le module Grammaire.'}`
        : `The correct answer is "${exercise.answer}". ${rule?.definition || rule?.definition_en || 'Review this rule in the Grammar module.'}`
    }
    if (exercise.module === 'vocabulaire') {
      return lang === 'fr'
        ? `"${exercise.question}" se traduit par "${exercise.answer}". Votre réponse "${userAnswer}" n'est pas correcte.`
        : `"${exercise.question}" translates to "${exercise.answer}". Your answer "${userAnswer}" is not correct.`
    }
    return lang === 'fr' ? `La réponse correcte est : ${exercise.answer}` : `The correct answer is: ${exercise.answer}`
  }

  const handleSubmitAnswer = (answer?: string) => {
    if (!currentExercise) return

    // For reading comprehension, check if still showing text
    if (currentExercise.type === 'reading_comprehension' && !showingComprehension) {
      setShowingComprehension(true)
      return
    }

    const userAnswer = answer || userInput.trim()
    let correct = false

    if (currentExercise.type === 'grammar_qcm') {
      correct = userAnswer === currentExercise.answer
    } else if (currentExercise.type === 'reading_comprehension') {
      // For comprehension, check against comprehensionAnswer
      correct = userAnswer === currentExercise.comprehensionAnswer
    } else if (currentExercise.type === 'speaking_repeat') {
      const maxDist = Math.max(1, Math.floor(currentExercise.answer.length * 0.2))
      correct = isCloseEnough(userAnswer, currentExercise.answer, maxDist)
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
    setShowingComprehension(false)
    setWordDefinition(null)
    setShowWhyWrong(false)

    const nextIdx = currentIdx + 1
    if (nextIdx < exercises.length) {
      // Check if we're moving to a new lesson
      const currentLessonIndex = exercises[currentIdx]?.lessonIndex ?? 0
      const nextLessonIndex = exercises[nextIdx]?.lessonIndex ?? 0

      if (nextLessonIndex !== currentLessonIndex) {
        // Mark current lesson as completed
        setLessons(prev => prev.map((l, i) => {
          if (i === currentLessonIndex) {
            const lessonResults = results.filter(r => r.exercise.lessonIndex === currentLessonIndex)
            const correct = lessonResults.filter(r => r.correct).length
            const total = lessonResults.length
            return { ...l, completed: true, score: total > 0 ? Math.round((correct / total) * 100) : 100 }
          }
          return l
        }))
        setCurrentLessonIdx(nextLessonIndex)
        // Show lesson map briefly between lessons
        setPhase('lessonMap')
        setCurrentIdx(nextIdx)
        return
      }
      setCurrentIdx(nextIdx)
    } else {
      // Mark final lesson as completed
      const lastLessonIndex = exercises[currentIdx]?.lessonIndex ?? 0
      setLessons(prev => prev.map((l, i) => {
        if (i === lastLessonIndex) {
          const lessonResults = results.filter(r => r.exercise.lessonIndex === lastLessonIndex)
          const correct = lessonResults.filter(r => r.correct).length
          const total = lessonResults.length
          return { ...l, completed: true, score: total > 0 ? Math.round((correct / total) * 100) : 100 }
        }
        return l
      }))
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

    // BUG-23: Update lecture progression for reading exercises
    const correctReadingCount = results.filter(r => r.exercise.module === 'lecture' && r.correct).length
    const currentLecturePct = currentProgress?.objectiveProgress?.lecture || 0
    let newLecturePct = currentLecturePct
    if (correctReadingCount > 0) {
      newLecturePct = Math.min(100, currentLecturePct + correctReadingCount * 5)
    }

    updateUserProgress(user.id, activeLang, {
      streak: newStreak,
      lastActivityDate: todayStr,
      dailyExercisesCompleted: (currentProgress?.dailyExercisesCompleted || 0) + totalCount,
      dailyWordsCompleted: (currentProgress?.dailyWordsCompleted || 0) + results.filter(r => r.exercise.module === 'vocabulaire' && r.correct).length,
      objectiveProgress: {
        ...(currentProgress?.objectiveProgress || {}),
        lecture: newLecturePct,
      },
    })

    // BUG-24: Save vocabulary words seen to personal vocab
    for (const result of results) {
      if (result.exercise.module === 'vocabulaire' && result.exercise.data?.id) {
        addToPersonalVocab(user.id, result.exercise.data.id, result.correct ? 'learned' : 'to_review')
      }
    }
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
      setPhase('lessonMap')
    } else {
      setPhase('summary')
    }
  }

  // BUG lecture standalone: Fetch word definition from dictionaryapi.dev
  const fetchWordDefinition = async (word: string, event: React.MouseEvent) => {
    try {
      const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${word.toLowerCase()}`)
      if (response.ok) {
        const data = await response.json()
        const definition = data[0]?.meanings?.[0]?.definitions?.[0]?.definition || 'No definition found'
        setWordDefinition({ word, definition })
        const rect = (event.target as HTMLElement).getBoundingClientRect()
        setDefPosition({ x: rect.left, y: rect.bottom + 5 })
      } else {
        setWordDefinition({ word, definition: 'Definition not found' })
      }
    } catch {
      setWordDefinition({ word, definition: 'Unable to fetch definition' })
    }
  }

  // BUG-35: Change reading speed function that restarts playback if audio is playing
  const changeReadingSpeed = (speed: number, text?: string) => {
    setReadingSpeed(speed)
    if (isReadingAloud && text) {
      window.speechSynthesis.cancel()
      setTimeout(() => playReadingAloud(text, speed), 100)
    }
  }

  // BUG-33: TTS function with speed control and word highlighting
  const playReadingAloud = (text: string, speed?: number) => {
    if ('speechSynthesis' in window) {
      // Cancel any ongoing speech
      if (isReadingAloud) {
        window.speechSynthesis.cancel()
        setIsReadingAloud(false)
        setHighlightWordIndex(null)
        return
      }

      const utterance = new SpeechSynthesisUtterance(text)
      utterance.rate = speed ?? readingSpeed
      utterance.lang = user?.activeLang === 'fr' ? 'fr-FR' : 'en-US'

      const words = text.split(/\s+/)

      utterance.onboundary = (event: any) => {
        if (event.name === 'word') {
          const charIndex = event.charIndex
          let wordIdx = 0
          let charCount = 0
          for (let i = 0; i < words.length; i++) {
            charCount += words[i].length + 1 // +1 for space
            if (charCount > charIndex) {
              wordIdx = i
              break
            }
          }
          setHighlightWordIndex(wordIdx)
        }
      }

      utterance.onend = () => {
        setIsReadingAloud(false)
        setHighlightWordIndex(null)
      }

      utterance.onerror = () => {
        setIsReadingAloud(false)
        setHighlightWordIndex(null)
      }

      setIsReadingAloud(true)
      window.speechSynthesis.speak(utterance)
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
  // PHASE: LESSON MAP
  // ==========================================
  if (phase === 'lessonMap') {
    return (
      <div className="min-h-screen bg-[#F0F0F0] px-4 py-8">
        <div className="max-w-lg mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-[#002844] mb-2">
              {lang === 'fr' ? 'Parcours de session' : 'Session path'}
            </h1>
            <p className="text-sm text-[#555555]">
              {lang === 'fr'
                ? `${lessons.filter(l => l.completed).length}/${lessons.length} leçons`
                : `${lessons.filter(l => l.completed).length}/${lessons.length} lessons`}
            </p>
          </div>

          {/* Lesson path */}
          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gray-300" />

            <div className="space-y-4">
              {lessons.map((lesson, idx) => {
                const isCurrent = idx === currentLessonIdx
                const isCompleted = lesson.completed
                const isLocked = idx > currentLessonIdx && !lesson.completed
                const isCheckpoint = lesson.module === 'checkpoint'

                return (
                  <div key={lesson.id} className="relative flex items-center gap-4">
                    {/* Circle indicator */}
                    <div className={`relative z-10 flex-shrink-0 w-16 h-16 rounded-full flex items-center justify-center text-2xl border-4 transition-all ${
                      isCompleted
                        ? 'bg-green-100 border-green-500'
                        : isCurrent
                          ? 'bg-[#D9B438]/20 border-[#D9B438] animate-pulse'
                          : isLocked
                            ? 'bg-gray-100 border-gray-300'
                            : 'bg-white border-gray-300'
                    }`}>
                      {isCompleted ? '✅' : lesson.icon}
                    </div>

                    {/* Lesson info */}
                    <div className={`flex-1 p-4 rounded-xl transition-all ${
                      isCurrent
                        ? 'bg-white shadow-md border-2 border-[#D9B438]'
                        : isCompleted
                          ? 'bg-green-50 border border-green-200'
                          : 'bg-white border border-gray-200 opacity-60'
                    }`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className={`font-bold text-sm ${isCurrent ? 'text-[#002844]' : isCompleted ? 'text-green-700' : 'text-gray-500'}`}>
                            {lang === 'fr'
                              ? (isCheckpoint ? lesson.title.fr : `Leçon ${idx + 1} — ${lesson.title.fr}`)
                              : (isCheckpoint ? lesson.title.en : `Lesson ${idx + 1} — ${lesson.title.en}`)}
                          </p>
                          {isCompleted && lesson.score !== undefined && (
                            <p className="text-xs text-green-600 font-semibold mt-1">
                              {lesson.score}% {lang === 'fr' ? 'réussi' : 'correct'}
                            </p>
                          )}
                          {isCurrent && !isCheckpoint && (
                            <p className="text-xs text-[#555555] mt-1">
                              {lesson.exercises.length} {lang === 'fr' ? 'exercices' : 'exercises'}
                            </p>
                          )}
                        </div>
                        {isCurrent && !isCheckpoint && (
                          <button
                            onClick={() => setPhase('exercise')}
                            className="px-4 py-2 rounded-lg bg-[#002844] text-white text-xs font-bold hover:bg-[#003a5c] transition-colors"
                          >
                            {lang === 'fr' ? 'Commencer →' : 'Start →'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
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
              setCurrentLessonIdx(0)
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
        {/* Lesson indicator */}
        {lessons[currentLessonIdx] && (
          <div className="mb-3 flex items-center gap-2">
            <span className="text-lg">{lessons[currentLessonIdx].icon}</span>
            <span className="text-xs font-bold text-[#002844]">
              {lang === 'fr'
                ? `Leçon ${currentLessonIdx + 1} — ${lessons[currentLessonIdx].title.fr}`
                : `Lesson ${currentLessonIdx + 1} — ${lessons[currentLessonIdx].title.en}`}
            </span>
            <button
              onClick={() => setPhase('lessonMap')}
              className="ml-auto text-xs text-[#D9B438] font-semibold hover:underline"
            >
              {lang === 'fr' ? 'Voir parcours' : 'View path'}
            </button>
          </div>
        )}

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
              {!showingComprehension ? (
                // Display reading text with clickable words, TTS, and speed control
                <div>
                  <h2 className="text-sm font-bold text-[#002844] mb-3">
                    {lang === 'fr' ? 'Lisez ce texte attentivement :' : 'Read this text carefully:'}
                  </h2>

                  {/* TTS Controls */}
                  <div className="flex items-center gap-2 mb-4 flex-wrap">
                    <button
                      onClick={() => playReadingAloud(currentExercise.readingText || '')}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm transition-colors ${
                        isReadingAloud
                          ? 'bg-red-500 text-white'
                          : 'bg-[#D9B438] text-[#002844] hover:bg-yellow-400'
                      }`}
                    >
                      <Volume className="h-4 w-4" />
                      {isReadingAloud ? (lang === 'fr' ? 'Arrêter' : 'Stop') : (lang === 'fr' ? 'Écouter' : 'Listen')}
                    </button>

                    {/* Speed buttons */}
                    {[0.5, 1, 1.5].map((speed) => (
                      <button
                        key={speed}
                        onClick={() => changeReadingSpeed(speed, currentExercise.readingText || '')}
                        className={`px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                          readingSpeed === speed
                            ? 'bg-[#002844] text-white'
                            : 'bg-gray-200 text-[#002844] hover:bg-gray-300'
                        }`}
                      >
                        {speed}x
                      </button>
                    ))}
                  </div>

                  {/* Reading text with word highlighting */}
                  <div className="text-sm text-[#555555] leading-[1.8] mb-4 p-6 bg-blue-50 rounded-lg border border-blue-200 relative">
                    {(() => {
                      const fullText = currentExercise.readingText || ''
                      const words = fullText.split(/\s+/)
                      const wordLimit = 100
                      const isLongText = words.length > wordLimit
                      const displayWords = readingExpanded ? words : words.slice(0, wordLimit)

                      return (
                        <>
                          {displayWords.map((word, idx) => (
                            <span
                              key={idx}
                              onClick={(e) => fetchWordDefinition(word.replace(/[.,!?;:]/g, ''), e)}
                              className={`cursor-help hover:underline hover:text-blue-700 transition-colors ${
                                idx === highlightWordIndex ? 'bg-[#D9B438] text-white rounded px-0.5' : ''
                              }`}
                            >
                              {word}{' '}
                            </span>
                          ))}
                          {!readingExpanded && isLongText && <span>...</span>}
                        </>
                      )
                    })()}
                  </div>

                  {/* Expand button for truncated text */}
                  {(() => {
                    const fullText = currentExercise.readingText || ''
                    const words = fullText.split(/\s+/)
                    const isLongText = words.length > 100
                    return (
                      isLongText && !readingExpanded && (
                        <button
                          onClick={() => setReadingExpanded(true)}
                          className="text-sm font-semibold text-[#D9B438] hover:text-yellow-400 mb-3"
                        >
                          {lang === 'fr' ? 'Lire la suite' : 'Read more'}
                        </button>
                      )
                    )
                  })()}

                  {wordDefinition && defPosition && (
                    <div
                      className="fixed bg-gray-900 text-white px-3 py-2 rounded text-xs z-50 max-w-xs"
                      style={{
                        left: `${defPosition.x}px`,
                        top: `${defPosition.y}px`,
                      }}
                    >
                      <p className="font-semibold text-yellow-300">{wordDefinition.word}</p>
                      <p className="mt-1">{wordDefinition.definition}</p>
                      <button
                        onClick={() => setWordDefinition(null)}
                        className="mt-2 bg-gray-700 px-2 py-1 rounded text-xs hover:bg-gray-600"
                      >
                        {lang === 'fr' ? 'Fermer' : 'Close'}
                      </button>
                    </div>
                  )}
                  {currentExercise.hint && (
                    <p className="text-xs text-[#D9B438] font-semibold mb-2">📖 {currentExercise.hint}</p>
                  )}
                </div>
              ) : (
                // Display comprehension question
                <div>
                  <h2 className="text-sm font-bold text-[#002844] mb-4">
                    {lang === 'fr' ? 'Question de compréhension :' : 'Reading comprehension:'}
                  </h2>
                  <p className="text-base font-semibold text-[#002844] mb-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                    {currentExercise.comprehensionQuestion}
                  </p>
                </div>
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
                !showingComprehension ? (
                  <button onClick={() => handleSubmitAnswer('read')}
                    className="w-full py-3 rounded-xl bg-[#002844] text-white font-bold text-sm hover:bg-[#003a5c] transition-colors">
                    {lang === 'fr' ? 'Montrer la question →' : 'Show question →'}
                  </button>
                ) : currentExercise.comprehensionOptions ? (
                  <div className="space-y-2">
                    {currentExercise.comprehensionOptions.map((opt, i) => (
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
                ) : null
              ) : currentExercise.type === 'speaking_repeat' ? (
                <div>
                  {heardText && (
                    <div className="mb-3 p-3 bg-gray-50 rounded-lg">
                      <p className="text-xs font-semibold text-[#002844] mb-1">
                        {lang === 'fr' ? 'Entendu :' : 'Heard:'}
                      </p>
                      <p className="text-sm text-[#555555] mb-2">{heardText}</p>
                      <button onClick={() => speakText(heardText, activeLang)}
                        className="flex items-center gap-1 px-3 py-1 bg-[#D9B438] text-[#002844] rounded text-xs font-semibold hover:bg-[#c9a530]">
                        <Volume className="h-3 w-3" />
                        {lang === 'fr' ? 'Réécouter ma prononciation' : 'Replay my pronunciation'}
                      </button>
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
                    : currentExercise.type === 'speaking_repeat'
                    ? (lang === 'fr' ? 'À retravailler' : 'Need improvement')
                    : (lang === 'fr' ? 'Incorrect' : 'Incorrect')}
                </span>
              </div>

              {/* BUG-25: Show user's answer alongside correct answer */}
              {!isCorrect && currentExercise.type !== 'reading_comprehension' && (
                <div className="space-y-2 mb-3">
                  <p className="text-sm text-[#555555]">
                    {lang === 'fr' ? 'Ta réponse :' : 'Your answer:'}{' '}
                    <span className="font-bold text-red-600">{results[results.length - 1]?.userAnswer || 'N/A'}</span>
                  </p>
                  <p className="text-sm text-[#555555]">
                    {lang === 'fr' ? 'Réponse correcte :' : 'Correct answer:'}{' '}
                    <span className="font-bold text-green-700">{currentExercise.answer}</span>
                  </p>
                </div>
              )}

              {/* BUG-21: Special handling for speaking exercises */}
              {!isCorrect && currentExercise.type === 'speaking_repeat' && (
                <div className="space-y-2 mb-3">
                  <p className="text-sm text-[#555555]">
                    {lang === 'fr' ? 'Vous avez dit :' : 'You said:'}{' '}
                    <span className="font-semibold text-[#002844]">{results[results.length - 1]?.userAnswer || 'N/A'}</span>
                  </p>
                  <p className="text-sm text-[#555555]">
                    {lang === 'fr' ? 'Cible :' : 'Target:'}{' '}
                    <span className="font-semibold text-green-700">{currentExercise.answer}</span>
                  </p>
                  {/* BUG-38: IPA phonetic guide */}
                  {IPA_MAP[currentExercise.answer.toLowerCase()] && (
                    <p className="text-sm text-[#555555] mt-1">
                      <span className="font-mono text-[#7B1FA2]">{IPA_MAP[currentExercise.answer.toLowerCase()]}</span>
                    </p>
                  )}
                </div>
              )}

              {/* BUG-37: "Why am I wrong?" button */}
              {!isCorrect && (
                <button onClick={() => setShowWhyWrong(!showWhyWrong)}
                  className="mt-3 flex items-center gap-1 text-sm font-semibold text-[#D9B438] hover:text-[#c9a530]">
                  ✨ {lang === 'fr' ? 'Pourquoi ai-je faux ?' : 'Why am I wrong?'}
                </button>
              )}
              {showWhyWrong && !isCorrect && (
                <div className="mt-2 p-3 bg-blue-50 rounded-lg text-sm text-[#002844]">
                  {getWhyWrongExplanation(currentExercise, results[results.length - 1]?.userAnswer || userInput)}
                </div>
              )}

              <div className="flex gap-2">
                {currentExercise.type === 'speaking_repeat' && !isCorrect && (
                  <button onClick={() => {
                    setShowFeedback(false)
                    setUserInput('')
                    setSelectedOption(null)
                    setHeardText('')
                    setShowingComprehension(false)
                  }}
                    className="flex-1 py-2.5 rounded-xl bg-[#D9B438] text-[#002844] font-bold text-sm hover:bg-[#c9a530] transition-colors">
                    {lang === 'fr' ? 'Réessayer' : 'Try again'}
                  </button>
                )}
                <button onClick={handleNext}
                  className={`${currentExercise.type === 'speaking_repeat' && !isCorrect ? 'flex-1' : 'w-full'} flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#002844] text-white font-bold text-sm hover:bg-[#003a5c] transition-colors`}>
                  {currentExercise.type === 'speaking_repeat' && !isCorrect
                    ? (lang === 'fr' ? 'Exercice suivant' : 'Next exercise')
                    : currentIdx < exercises.length - 1
                    ? <>{lang === 'fr' ? 'Suivant' : 'Next'} <ArrowRight className="h-4 w-4" /></>
                    : <>{lang === 'fr' ? 'Voir le résumé' : 'See summary'} <Trophy className="h-4 w-4" /></>}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
