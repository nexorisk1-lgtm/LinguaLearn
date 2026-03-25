'use client'

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useRef, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Play, CheckCircle, XCircle, ArrowRight, Trophy, Flame,
  BookOpen, PenTool, Mic, Volume2, Pencil, Home, Volume, Star,
} from 'lucide-react'
import { getCurrentUser, updateUserProgress, saveReviewItem } from '@/lib/db/localStorage'
import { User, InterfaceLanguage, LearningObjective } from '@/types'
import BottomNav from '@/components/BottomNav'
import PageHeader from '@/components/PageHeader'
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

function generateVocabExercises(words: VocabWord[], count: number, pathB: boolean = false): SessionExercise[] {
  const shuffled = [...words].sort(() => Math.random() - 0.5).slice(0, count)
  return shuffled.map((w, i) => {
    const isFrToTarget = i % 2 === 0
    const question = isFrToTarget ? w.word_fr : w.word_target
    const answer = isFrToTarget ? w.word_target : w.word_fr

    // BUG-57: For Parcours B, convert vocab_translate to QCM (no text input)
    if (pathB) {
      const pool = isFrToTarget
        ? words.filter(x => x.word_target !== answer).map(x => x.word_target)
        : words.filter(x => x.word_fr !== answer).map(x => x.word_fr)
      const distractors = pool.sort(() => Math.random() - 0.5).slice(0, 3)
      const options = [answer, ...distractors].sort(() => Math.random() - 0.5)
      return {
        type: 'grammar_qcm' as const, // Reuse QCM type for clickable options
        module: 'vocabulaire',
        data: w,
        question,
        answer,
        hint: w.definition_en,
        options: options.length >= 2 ? options : [answer, isFrToTarget ? 'unknown' : 'inconnu'],
      }
    }

    return {
      type: 'vocab_translate' as const,
      module: 'vocabulaire',
      data: w,
      question,
      answer,
      hint: w.definition_en,
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

function generateReadingExercise(texts: ReadingText[], interfaceLang: string): SessionExercise | null {
  if (texts.length === 0) return null
  const text = texts[Math.floor(Math.random() * texts.length)]
  const fr = interfaceLang === 'fr'

  // BUG-53: Generate comprehension questions in interface language
  let comprehensionQuestion = ''
  let comprehensionAnswer = ''
  let comprehensionOptions: string[] = []

  // BUG-53 (V3.7): Questions AND options in interface language
  switch (text.title) {
    case 'My Family':
      comprehensionQuestion = fr ? "Que fait la mère d'Emma ?" : "What does Emma's mother do?"
      comprehensionAnswer = fr ? 'Elle est professeur' : 'She is a teacher'
      comprehensionOptions = fr
        ? ['Elle est professeur', 'Elle est médecin', 'Elle cuisine des plats italiens']
        : ['She is a teacher', 'She is a doctor', 'She cooks Italian food']
      break
    case 'A Family Dinner':
      comprehensionQuestion = fr ? 'Que prépare la grand-mère ?' : 'What does Grandma make?'
      comprehensionAnswer = fr ? 'Des pâtes et une salade' : 'Pasta and salad'
      comprehensionOptions = fr
        ? ['Des pâtes et une salade', 'De la pizza et de la soupe', 'Du riz et du poulet']
        : ['Pasta and salad', 'Pizza and soup', 'Rice and chicken']
      break
    case 'My Grandparents':
      comprehensionQuestion = fr ? 'Où vivent les grands-parents ?' : 'Where do the grandparents live?'
      comprehensionAnswer = fr ? 'Près d\'un petit lac' : 'Near a small lake'
      comprehensionOptions = fr
        ? ['En ville', 'Près d\'une rivière', 'Près d\'un petit lac']
        : ['In the city', 'Near a river', 'Near a small lake']
      break
    default:
      comprehensionQuestion = fr ? 'Quel est le sujet principal de ce texte ?' : 'What is the main topic of this text?'
      comprehensionAnswer = text.theme || (fr ? 'Général' : 'General')
      comprehensionOptions = fr
        ? [text.theme || 'Général', 'Autre sujet', 'Sujet différent']
        : [text.theme || 'General', 'Other topic 1', 'Other topic 2']
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

// Star system (Curriculum §1.1)
function getStarsFromScore(pct: number): number {
  if (pct >= 90) return 3;
  if (pct >= 70) return 2;
  if (pct >= 60) return 1;
  return 0;
}

function getStarLabel(stars: number, lang: string): string {
  if (lang === 'fr') {
    if (stars === 3) return 'Maîtrisé';
    if (stars === 2) return 'Bien';
    if (stars === 1) return 'À retravailler';
    return 'Bloqué';
  }
  if (stars === 3) return 'Mastered';
  if (stars === 2) return 'Good';
  if (stars === 1) return 'Needs work';
  return 'Blocked';
}

function SessionContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const courseId = searchParams.get('courseId')
  const [user, setUser] = useState<User | null>(null)
  const [lang, setLang] = useState<InterfaceLanguage>('fr')
  const [loading, setLoading] = useState(true)
  const [phase, setPhase] = useState<SessionPhase>('intro')
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [introCountdown, setIntroCountdown] = useState(5)
  const [exercises, setExercises] = useState<SessionExercise[]>([])
  const [currentIdx, setCurrentIdx] = useState(0)
  const [results, setResults] = useState<SessionResult[]>([])
  const [userInput, setUserInput] = useState('')
  const [selectedOption, setSelectedOption] = useState<string | null>(null)
  const [showFeedback, setShowFeedback] = useState(false)
  const [isCorrect, setIsCorrect] = useState(false)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [sessionModules, setSessionModules] = useState<string[]>([])
  const [lessons, setLessons] = useState<SessionLesson[]>([])
  const [currentLessonIdx, setCurrentLessonIdx] = useState(0)
  const [showingComprehension, setShowingComprehension] = useState(false)
  const [wordDefinition, setWordDefinition] = useState<{ word: string; definition: string } | null>(null)
  const [defPosition, setDefPosition] = useState<{ x: number; y: number } | null>(null)
  // BUG-58: Quit/Pause confirmation
  const [showQuitConfirm, setShowQuitConfirm] = useState(false)

  // Speech recognition refs
  const recognitionRef = useRef<any>(null)
  const [isRecording, setIsRecording] = useState(false)
  const [heardText, setHeardText] = useState('')

  // BUG-33: TTS audio + speed control + word highlight
  const [readingSpeed, setReadingSpeed] = useState(1)
  const [highlightWordIndex, setHighlightWordIndex] = useState<number | null>(null)
  const [isReadingAloud, setIsReadingAloud] = useState(false)

  // BUG-34: text spacing + truncation
  // BUG-35: Track current reading position for speed change continuity
  const readingCharIndexRef = useRef(0)
  const readingFullTextRef = useRef('')

  // BUG-37: explanation (now always shown per P0-4)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
    // BUG-57: Detect Parcours B to filter out written exercises
    const learningPaths = langConfig?.learningPath
      ? (Array.isArray(langConfig.learningPath) ? langConfig.learningPath : [langConfig.learningPath])
      : []
    const isPathB = learningPaths.includes('B') && !learningPaths.includes('A')
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
        allExercises.push(...generateVocabExercises(dailyWords, Math.min(3, wordsPerDay), isPathB))
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
      const readEx = generateReadingExercise(texts, currentUser.settings.interfaceLang || 'fr')
      if (readEx) {
        allExercises.push(readEx)
        usedModules.push('lecture')
      }
    }
    // BUG-57: Parcours B = NO written exercises, replace with oral/listening
    if (objectiveSet.has('ecrit') && !isPathB) {
      const writeExercises = getWritingExercises(activeLang, userThemes, userLevel)
      if (writeExercises.length > 0) {
        allExercises.push(...generateWritingExercises(writeExercises, 2))
        usedModules.push('ecrit')
      }
    }
    // BUG-57: For Parcours B, add extra oral exercises instead of writing
    if (isPathB && !usedModules.includes('oral')) {
      const speakExercises = getSpeakingExercises(activeLang, userThemes, userLevel)
      if (speakExercises.length > 0) {
        allExercises.push(...generateSpeakingExercises(speakExercises, 2))
        usedModules.push('oral')
      }
    }

    // If no objective exercises added, default to vocab
    if (!objectiveSet.has('oral') && !objectiveSet.has('lecture') && !objectiveSet.has('ecrit')) {
      const words = getVocabulary(activeLang, userThemes, userLevel)
      if (words.length > 0) {
        allExercises.push(...generateVocabExercises(words, 3, isPathB))
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

    // BUG-58 V3.9: Robust resume — read saved position and apply immediately
    let shouldResume = false
    let resumeExIdx = 0
    let resumeLessonIdx = 0
    if (courseId) {
      try {
        const resumeKey = `lingualearn_resume_${currentUser.id}_${courseId}`
        const resumeStr = localStorage.getItem(resumeKey)
        if (resumeStr) {
          const resume = JSON.parse(resumeStr)
          const savedAt = new Date(resume.savedAt).getTime()
          if (Date.now() - savedAt < 24 * 60 * 60 * 1000) {
            shouldResume = true
            resumeExIdx = resume.exerciseIndex || 0
            resumeLessonIdx = resume.lessonIndex || 0
          }
          // Clear resume data after loading
          localStorage.removeItem(resumeKey)
        }
      } catch { /* ignore */ }
    }

    if (shouldResume) {
      // Apply resume position synchronously, then skip intro
      setCurrentIdx(resumeExIdx)
      setCurrentLessonIdx(resumeLessonIdx)
      setPhase('exercise')
    }

    // Init speech recognition
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition()
    }

    setLoading(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, buildSession])

  // V3.11: Skip intro countdown — go directly to lessonMap (no intermediate screen)
  useEffect(() => {
    if (phase !== 'intro') return
    if (exercises.length > 0) {
      setPhase('lessonMap')
    } else {
      setPhase('summary')
    }
  }, [phase, exercises.length])

  const currentExercise = exercises[currentIdx]

  // BUG-37/50: Generate pedagogical explanation for all exercise types
  // BUG-50: Phonetic tips for common words (francophone learners)
  const PHONETIC_TIPS: Record<string, { fr: string; en: string }> = {
    'airport': { fr: 'airport [ˈɛərpɔːrt] — Le "r" est léger, prononcez "air-port" avec le "ai" comme dans "air".', en: 'airport [ˈɛərpɔːrt] — Stress on first syllable, "air" like the word "air".' },
    'father': { fr: 'father [ˈfɑːðər] — Le "th" se prononce en plaçant la langue entre les dents. Le "a" est long.', en: 'father [ˈfɑːðər] — The "th" is voiced, tongue between teeth.' },
    'mother': { fr: 'mother [ˈmʌðər] — Le "th" comme dans "father". Le "o" se prononce "eu" court.', en: 'mother [ˈmʌðər] — Short "u" sound, voiced "th".' },
    'brother': { fr: 'brother [ˈbrʌðər] — Attention au "th" et au "r" anglais (pas roulé).', en: 'brother [ˈbrʌðər] — Voiced "th", short "u" sound.' },
    'sister': { fr: 'sister [ˈsɪstər] — Le "i" est court comme dans "sit". Le "r" final est léger.', en: 'sister [ˈsɪstər] — Short "i" as in "sit".' },
    'family': { fr: 'family [ˈfæmɪli] — Le "a" se prononce comme le "a" de "cat". 3 syllabes.', en: 'family [ˈfæmɪli] — "a" as in "cat", three syllables.' },
    'hello': { fr: 'hello [həˈloʊ] — L\'accent est sur la 2e syllabe. Le "h" est aspiré.', en: 'hello [həˈloʊ] — Stress on second syllable, aspirated "h".' },
    'thank': { fr: 'thank [θæŋk] — Le "th" est sourd (langue entre les dents, sans vibration).', en: 'thank [θæŋk] — Voiceless "th", tongue between teeth.' },
    'the': { fr: 'the [ðə] — Le "th" est sonore (langue entre les dents avec vibration).', en: 'the [ðə] — Voiced "th".' },
    'water': { fr: 'water [ˈwɔːtər] — Le "w" se prononce en arrondissant les lèvres. Pas de "v" !', en: 'water [ˈwɔːtər] — Round your lips for "w".' },
    'hotel': { fr: 'hotel [hoʊˈtɛl] — L\'accent est sur la 2e syllabe. Le "h" est aspiré, le "o" se dit "oh".', en: 'hotel [hoʊˈtɛl] — Stress on second syllable, aspirated "h".' },
    'restaurant': { fr: 'restaurant [ˈrɛstərɒnt] — En anglais, 3 syllabes : "REST-runt". Le "au" disparaît.', en: 'restaurant [ˈrɛstərɒnt] — Three syllables, stress on first.' },
    'ticket': { fr: 'ticket [ˈtɪkɪt] — Le "i" est court. Deux syllabes égales.', en: 'ticket [ˈtɪkɪt] — Short "i" sounds, stress on first syllable.' },
    'coffee': { fr: 'coffee [ˈkɒfi] — Le "o" est ouvert (comme "co" français). Le "ee" final est un "i" court.', en: 'coffee [ˈkɒfi] — Open "o", stress on first syllable.' },
    'breakfast': { fr: 'breakfast [ˈbrɛkfəst] — Se prononce "BREK-fust", pas "break-fast".', en: 'breakfast [ˈbrɛkfəst] — Two syllables, not "break-fast".' },
    'weather': { fr: 'weather [ˈwɛðər] — Le "th" est sonore (langue entre les dents). Le "ea" = "è".', en: 'weather [ˈwɛðər] — Voiced "th", "ea" as in "bed".' },
    'friend': { fr: 'friend [frɛnd] — Le "ie" se prononce "è". Une seule syllabe.', en: 'friend [frɛnd] — One syllable, "ie" as in "end".' },
    'teacher': { fr: 'teacher [ˈtiːtʃər] — Le "ea" est long "ii". Le "ch" = "tch".', en: 'teacher [ˈtiːtʃər] — Long "ee", "ch" as in "church".' },
    'school': { fr: 'school [skuːl] — Le "ch" se prononce "k". Le "oo" est long.', en: 'school [skuːl] — "ch" sounds like "k", long "oo".' },
    'children': { fr: 'children [ˈtʃɪldrən] — Le "ch" = "tch". Le "i" est court.', en: 'children [ˈtʃɪldrən] — "ch" as in "church", short "i".' },
    'beautiful': { fr: 'beautiful [ˈbjuːtɪfəl] — 3 syllabes : "BIOU-ti-ful". Le "eau" = "iou".', en: 'beautiful [ˈbjuːtɪfəl] — Three syllables, stress on first.' },
    'because': { fr: 'because [bɪˈkɒz] — L\'accent est sur la 2e syllabe. Le "au" = "o" ouvert.', en: 'because [bɪˈkɒz] — Stress on second syllable.' },
    'question': { fr: 'question [ˈkwɛstʃən] — Le "qu" = "kw". Le "tion" = "tchenn".', en: 'question [ˈkwɛstʃən] — "qu" as "kw", "tion" as "chun".' },
    'chocolate': { fr: 'chocolate [ˈtʃɒklət] — 3 syllabes en anglais, pas 4 : "TCHOK-lut".', en: 'chocolate [ˈtʃɒklət] — Three syllables, stress on first.' },
    'comfortable': { fr: 'comfortable [ˈkʌmftəbəl] — 3 syllabes : "KUMF-ter-bul". Le "or" disparaît.', en: 'comfortable [ˈkʌmftəbəl] — Three syllables, not four.' },
    'clothes': { fr: 'clothes [kloʊðz] — Une seule syllabe ! Le "th" est très léger, presque "klohz".', en: 'clothes [kloʊðz] — One syllable, "th" is very soft.' },
    'listen': { fr: 'listen [ˈlɪsən] — Le "t" est muet ! Se prononce "LIS-en".', en: 'listen [ˈlɪsən] — Silent "t".' },
    'Wednesday': { fr: 'Wednesday [ˈwɛnzdeɪ] — Le 1er "d" est muet : "WENZ-day".', en: 'Wednesday [ˈwɛnzdeɪ] — Silent first "d".' },
    'often': { fr: 'often [ˈɒfən] — Le "t" peut être muet. "OF-en" ou "OF-ten".', en: 'often [ˈɒfən] — "t" can be silent.' },
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const getWhyWrongExplanation = (exercise: SessionExercise, _userAnswer: string): string => {
    if (exercise.type === 'grammar_qcm' || exercise.module === 'grammaire') {
      const rule = exercise.data
      return lang === 'fr'
        ? `La bonne réponse est "${exercise.answer}". ${rule?.definition || rule?.definition_fr || 'Révisez cette règle dans le module Grammaire.'}`
        : `The correct answer is "${exercise.answer}". ${rule?.definition || rule?.definition_en || 'Review this rule in the Grammar module.'}`
    }
    if (exercise.module === 'vocabulaire') {
      const data = exercise.data
      const extra = data?.definition_fr ? ` (${data.definition_fr})` : ''
      return lang === 'fr'
        ? `"${exercise.question}" se traduit par "${exercise.answer}"${extra}.`
        : `"${exercise.question}" translates to "${exercise.answer}".`
    }
    // BUG-50 (V3.7): Use phonetic_tip field for real advice, never generic "Le mot cible est..."
    if (exercise.type === 'speaking_repeat') {
      const answerLower = exercise.answer.toLowerCase().trim()
      // 1. Exact match in PHONETIC_TIPS
      const tip = PHONETIC_TIPS[answerLower]
      if (tip) return lang === 'fr' ? tip.fr : tip.en

      // 2. Search individual words in the phrase for tips
      const words = answerLower.replace(/[.,!?;:]/g, '').split(/\s+/)
      const wordTips: string[] = []
      for (const w of words) {
        if (PHONETIC_TIPS[w]) {
          wordTips.push(lang === 'fr' ? PHONETIC_TIPS[w].fr : PHONETIC_TIPS[w].en)
        }
      }
      if (wordTips.length > 0) return wordTips.join('\n')

      // 3. IPA map fallback
      const ipa = IPA_MAP[answerLower]
      if (ipa) {
        return lang === 'fr'
          ? `Prononciation : ${exercise.answer} ${ipa}. Écoutez la cible et comparez.`
          : `Pronunciation: ${exercise.answer} ${ipa}. Listen and compare.`
      }

      // 4. Generic but useful advice (never just repeat the target)
      return lang === 'fr'
        ? `Écoutez attentivement la prononciation cible en cliquant "Écouter la cible", puis réessayez en articulant lentement chaque syllabe.`
        : `Listen carefully to the target pronunciation by clicking "Listen to target", then try again, articulating each syllable slowly.`
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
      // Oral: 20% tolerance (speech recognition is less precise)
      const maxDist = Math.max(1, Math.floor(currentExercise.answer.length * 0.2))
      correct = isCloseEnough(userAnswer, currentExercise.answer, maxDist)
    } else {
      // BUG-45 (V3.7): For fill_blank (completion) exercises, extract the MISSING WORD from the answer
      // The prompt contains "___" and the answer is the full sentence.
      // Compare user input against the missing word only, not the full sentence.
      let expectedAnswer = currentExercise.answer
      if (currentExercise.type === 'writing_fill' && currentExercise.question && currentExercise.question.includes('___')) {
        // Extract missing word: find the word(s) in the answer that replace the blank
        const promptParts = currentExercise.question.split(/_{2,}/).map(p => p.trim().toLowerCase())
        const fullAnswer = currentExercise.answer.toLowerCase().trim()
        if (promptParts.length === 2) {
          // Remove the parts before and after the blank to get the missing word
          let missingWord = fullAnswer
          const before = promptParts[0]
          const after = promptParts[1]
          if (before && missingWord.startsWith(before)) {
            missingWord = missingWord.slice(before.length).trim()
          }
          if (after && missingWord.endsWith(after)) {
            missingWord = missingWord.slice(0, missingWord.length - after.length).trim()
          }
          // Remove trailing punctuation from extracted word
          missingWord = missingWord.replace(/[.,!?;:]+$/, '').trim()
          if (missingWord) expectedAnswer = missingWord
        }
      }
      // BUG-64 (V3.9): Check accepted_answers (synonymes valides) first
      const acceptedAnswers: string[] = currentExercise.data?.accepted_answers || []
      if (acceptedAnswers.length > 0) {
        correct = acceptedAnswers.some(aa => isCloseEnough(userAnswer, aa))
        if (!correct) {
          // Also check the main expected answer
          correct = isCloseEnough(userAnswer, expectedAnswer)
        }
      } else {
        // BUG-45b (V3.9): Strict tolerance — no percentage, absolute values only
        // 1-6 chars = exact match, 7-10 chars = Levenshtein ≤ 1, 11+ chars = Levenshtein ≤ 2
        const answerLen = expectedAnswer.length
        const tolerance = answerLen <= 6 ? 0 : answerLen <= 10 ? 1 : 2
        correct = isCloseEnough(userAnswer, expectedAnswer, tolerance)
      }
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

  const finishSession = (isPartialQuit: boolean = false) => {
    if (!user) return
    const activeLang = user.activeLang || user.settings.learningLangs[0] || 'en'
    const todayStr = new Date().toISOString().split('T')[0]
    const currentProgress = user.progress?.[activeLang]

    const totalCount = results.length + 1

    // Update streak
    const lastDate = currentProgress?.lastActivityDate
    let newStreak = currentProgress?.streak || 0
    if (lastDate !== todayStr) {
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      const yesterdayStr = yesterday.toISOString().split('T')[0]
      newStreak = lastDate === yesterdayStr ? newStreak + 1 : 1
    }

    // BUG-60: Update ALL module progression blocks based on session results
    const currentObjProgress = currentProgress?.objectiveProgress || {}
    const newObjProgress = { ...currentObjProgress }

    // Calculate progress increment per module (5% per correct answer in that module)
    const modules = ['vocabulaire', 'grammaire', 'oral', 'lecture', 'ecrit'] as const
    for (const mod of modules) {
      const correctInModule = results.filter(r => r.exercise.module === mod && r.correct).length
      if (correctInModule > 0) {
        const currentPct = newObjProgress[mod] || 0
        newObjProgress[mod] = Math.min(100, currentPct + correctInModule * 5)
      }
    }

    updateUserProgress(user.id, activeLang, {
      streak: newStreak,
      lastActivityDate: todayStr,
      dailyExercisesCompleted: (currentProgress?.dailyExercisesCompleted || 0) + totalCount,
      dailyWordsCompleted: (currentProgress?.dailyWordsCompleted || 0) + results.filter(r => r.exercise.module === 'vocabulaire' && r.correct).length,
      objectiveProgress: newObjProgress,
    })

    // BUG-24: Save vocabulary words seen to personal vocab
    for (const result of results) {
      if (result.exercise.module === 'vocabulaire' && result.exercise.data?.id) {
        addToPersonalVocab(user.id, result.exercise.data.id, result.correct ? 'learned' : 'to_review')
      }
    }

    // V3.10: Spaced repetition — track each exercise result for review scheduling
    for (const result of results) {
      const itemId = result.exercise.data?.id || result.exercise.data?.ruleId
      if (!itemId) continue
      const score = result.correct ? 100 : 0
      const type = result.exercise.module === 'grammaire' ? 'grammar' as const : 'word' as const
      saveReviewItem(user.id, activeLang, itemId, type, score)
    }

    // BUG-59: Save course score ONLY if session is fully completed (not partial quit)
    // A course is "completed" only when ALL questions have been answered and the summary screen shown.
    if (courseId && !isPartialQuit) {
      const correctCount = results.filter(r => r.correct).length
      const totalResults = results.length
      const scorePct = totalResults > 0 ? Math.round((correctCount / totalResults) * 100) : 0
      const stars = getStarsFromScore(scorePct)

      try {
        const key = `lingualearn_course_scores_${user.id}_${activeLang}`
        const stored = localStorage.getItem(key)
        const allScores = stored ? JSON.parse(stored) : {}
        // Only save if better than previous score
        const prev = allScores[courseId]
        if (!prev || scorePct > prev.score) {
          allScores[courseId] = {
            score: scorePct,
            stars,
            completedAt: new Date().toISOString(),
          }
          localStorage.setItem(key, JSON.stringify(allScores))
        }
      } catch { /* ignore storage errors */ }
    }
  }

  // BUG-58+59: Quit session — save streak/activity but NEVER mark course as completed
  const handleQuitSession = () => {
    if (results.length > 0) {
      finishSession(true) // isPartialQuit = true → no course score saved
    }
    // BUG-58: Save resume position for this course
    if (courseId && user) {
      try {
        const resumeKey = `lingualearn_resume_${user.id}_${courseId}`
        localStorage.setItem(resumeKey, JSON.stringify({
          lessonIndex: currentLessonIdx,
          exerciseIndex: currentIdx,
          savedAt: new Date().toISOString(),
        }))
      } catch { /* ignore */ }
    }
    router.push('/dashboard')
  }

  // BUG-49: Store user's recorded audio for playback
  const mediaRecorderRef = useRef<any>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const [userAudioUrl, setUserAudioUrl] = useState<string | null>(null)

  // Speech recognition for oral exercises
  const startRecording = async () => {
    if (!recognitionRef.current) return
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch { return }

    setIsRecording(true)
    setHeardText('')
    setUserAudioUrl(null)

    // BUG-49: Start MediaRecorder to capture audio blob
    try {
      audioChunksRef.current = []
      const recorder = new MediaRecorder(stream)
      mediaRecorderRef.current = recorder
      recorder.ondataavailable = (e: any) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data)
      }
      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        const url = URL.createObjectURL(blob)
        setUserAudioUrl(url)
        stream.getTracks().forEach(t => t.stop())
      }
      recorder.start()
    } catch { /* MediaRecorder not supported, proceed without */ }

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
      // Stop MediaRecorder
      if (mediaRecorderRef.current?.state === 'recording') {
        mediaRecorderRef.current.stop()
      }
      handleSubmitAnswer(transcript)
    }

    recognition.onerror = () => {
      setIsRecording(false)
      if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop()
    }
    recognition.onend = () => {
      setIsRecording(false)
      if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop()
    }
    try { recognition.start() } catch { setIsRecording(false) }
  }

  // BUG-49: Play back user's recorded pronunciation
  const playUserAudio = () => {
    if (userAudioUrl) {
      const audio = new Audio(userAudioUrl)
      audio.play()
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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

  // BUG-35: Change reading speed — resume from current position, not restart
  const changeReadingSpeed = (speed: number) => {
    setReadingSpeed(speed)
    if (isReadingAloud && readingFullTextRef.current) {
      window.speechSynthesis.cancel()
      // Resume from current character position
      const remainingText = readingFullTextRef.current.slice(readingCharIndexRef.current)
      if (remainingText.trim()) {
        setTimeout(() => playReadingAloud(remainingText, speed, readingCharIndexRef.current), 100)
      }
    }
  }

  // BUG-33: TTS function with speed control and word highlighting
  // BUG-35: charOffset tracks position in the full text for speed change continuity
  const playReadingAloud = (text: string, speed?: number, charOffset: number = 0) => {
    if ('speechSynthesis' in window) {
      // Cancel any ongoing speech (toggle off)
      if (isReadingAloud && charOffset === 0) {
        window.speechSynthesis.cancel()
        setIsReadingAloud(false)
        setHighlightWordIndex(null)
        readingCharIndexRef.current = 0
        return
      }

      // Store full text reference (only on fresh play, not resume)
      if (charOffset === 0) {
        readingFullTextRef.current = text
        readingCharIndexRef.current = 0
      }

      const utterance = new SpeechSynthesisUtterance(text)
      utterance.rate = speed ?? readingSpeed
      utterance.lang = user?.activeLang === 'fr' ? 'fr-FR' : 'en-US'

      // For word highlighting, use the full text's words
      const fullWords = readingFullTextRef.current.split(/\s+/)

      utterance.onboundary = (event: any) => {
        if (event.name === 'word') {
          // BUG-35: Track absolute position in full text
          const absoluteCharIdx = charOffset + event.charIndex
          readingCharIndexRef.current = absoluteCharIdx
          // Find word index in full text
          let wordIdx = 0
          let charCount = 0
          for (let i = 0; i < fullWords.length; i++) {
            charCount += fullWords[i].length + 1
            if (charCount > absoluteCharIdx) {
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
        readingCharIndexRef.current = 0
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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
  // V3.11: intro phase skipped — goes directly to lessonMap
  if (phase === 'intro') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#002844] to-[#003a5c]">
        <PageHeader title={lang === 'fr' ? 'Session du jour' : "Today's Session"} backHref="/dashboard" />
        <div className="flex flex-col items-center justify-center px-6 text-center py-12">
          <div className="w-20 h-20 rounded-full bg-[#D9B438] flex items-center justify-center mx-auto mb-6 animate-pulse">
            <Play className="h-10 w-10 text-[#002844] ml-1" fill="#002844" />
          </div>
          <p className="text-white/70 text-sm">{lang === 'fr' ? 'Chargement...' : 'Loading...'}</p>
        </div>
      </div>
    )
  }

  // ==========================================
  // PHASE: LESSON MAP
  // ==========================================
  if (phase === 'lessonMap') {
    return (
      <div className="min-h-screen bg-[#F0F0F0]">
        {/* V3.11: Standard back button → dashboard */}
        <PageHeader title={lang === 'fr' ? 'Parcours de session' : 'Session path'} backHref="/dashboard" />
        <div className="px-4 pt-6 pb-8">
        <div className="max-w-lg mx-auto">
          <div className="text-center mb-8">
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
    const stars = getStarsFromScore(pct)
    const starLabel = getStarLabel(stars, lang)

    // Unlock status for course sessions
    const unlockNextCourse = pct >= 60
    const unlockCheckpoint = pct >= 70
    const unlockCertification = pct >= 75

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

          {/* Stars display */}
          <div className="rounded-2xl bg-white p-6 shadow-sm mb-6 text-center">
            <div className="flex justify-center gap-2 mb-3">
              {[1, 2, 3].map(i => (
                <Star key={i} className={`h-10 w-10 transition-all ${
                  i <= stars
                    ? 'text-[#D9B438] fill-[#D9B438] scale-110'
                    : 'text-gray-200'
                }`} />
              ))}
            </div>
            <p className={`text-lg font-bold ${
              stars >= 3 ? 'text-green-600' : stars >= 2 ? 'text-[#D9B438]' : stars >= 1 ? 'text-orange-500' : 'text-red-500'
            }`}>
              {starLabel}
            </p>
            <p className="text-3xl font-bold text-[#002844] mt-2">{pct}%</p>
            <div className="h-3 w-full rounded-full bg-gray-100 mt-3">
              <div className="h-full rounded-full transition-all"
                style={{
                  width: `${pct}%`,
                  backgroundColor: stars >= 3 ? '#2E7D32' : stars >= 2 ? '#D9B438' : stars >= 1 ? '#E65100' : '#E53935',
                }} />
            </div>

            {/* Unlock indicators (for course sessions) */}
            {courseId && (
              <div className="mt-4 space-y-1.5 text-left">
                <div className="flex items-center gap-2">
                  <span className={`text-sm ${unlockNextCourse ? 'text-green-600' : 'text-red-500'}`}>
                    {unlockNextCourse ? '✅' : '❌'}
                  </span>
                  <span className="text-xs text-[#555555]">
                    {lang === 'fr' ? 'Cours suivant (60% min)' : 'Next course (60% min)'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-sm ${unlockCheckpoint ? 'text-green-600' : 'text-red-500'}`}>
                    {unlockCheckpoint ? '✅' : '❌'}
                  </span>
                  <span className="text-xs text-[#555555]">
                    {lang === 'fr' ? 'Checkpoint (70% min)' : 'Checkpoint (70% min)'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-sm ${unlockCertification ? 'text-green-600' : 'text-red-500'}`}>
                    {unlockCertification ? '✅' : '❌'}
                  </span>
                  <span className="text-xs text-[#555555]">
                    {lang === 'fr' ? 'Certification (75% min)' : 'Certification (75% min)'}
                  </span>
                </div>
              </div>
            )}
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
            {courseId ? (
              <a href="/module/cours"
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[#002844] text-white font-bold text-sm hover:bg-[#003a5c] transition-colors">
                {lang === 'fr' ? 'Retour au parcours' : 'Back to path'}
              </a>
            ) : (
              <a href="/dashboard"
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[#002844] text-white font-bold text-sm hover:bg-[#003a5c] transition-colors">
                <Home className="h-4 w-4" />
                {lang === 'fr' ? 'Retour au dashboard' : 'Back to dashboard'}
              </a>
            )}
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
    <div className="min-h-screen pb-20 bg-[#F0F0F0]">
      {/* V3.10: Standard header identique Profil */}
      <PageHeader
        title={lang === 'fr' ? 'Session en cours' : 'Session in progress'}
        onBack={() => setShowQuitConfirm(true)}
      />

      <div className="px-4 pt-4">
      <div className="max-w-lg mx-auto">
        {/* BUG-58: Quit confirmation overlay */}
        {showQuitConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-6">
            <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl">
              <h3 className="text-lg font-bold text-[#002844] mb-2">
                {lang === 'fr' ? 'Quitter la session ?' : 'Leave session?'}
              </h3>
              <p className="text-sm text-[#555555] mb-5">
                {lang === 'fr'
                  ? 'Ta progression dans ce cours sera sauvegardée.'
                  : 'Your progress in this course will be saved.'}
              </p>
              <div className="flex gap-3">
                <button onClick={() => setShowQuitConfirm(false)}
                  className="flex-1 py-2.5 rounded-xl border-2 border-gray-200 text-[#002844] font-bold text-sm hover:bg-gray-50">
                  {lang === 'fr' ? 'Continuer' : 'Continue'}
                </button>
                <button onClick={handleQuitSession}
                  className="flex-1 py-2.5 rounded-xl bg-red-600 text-white font-bold text-sm hover:bg-red-700">
                  {lang === 'fr' ? 'Quitter' : 'Leave'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Lesson indicator */}
        <div className="mb-3 flex items-center gap-2">
          {lessons[currentLessonIdx] && (
            <>
              <span className="text-lg">{lessons[currentLessonIdx].icon}</span>
              <span className="text-xs font-bold text-[#002844]">
                {lang === 'fr'
                  ? `Leçon ${currentLessonIdx + 1} — ${lessons[currentLessonIdx].title.fr}`
                  : `Lesson ${currentLessonIdx + 1} — ${lessons[currentLessonIdx].title.en}`}
              </span>
            </>
          )}
          {lessons[currentLessonIdx] && (
            <button onClick={() => setPhase('lessonMap')}
              className="ml-auto text-xs text-[#D9B438] font-semibold hover:underline">
              {lang === 'fr' ? 'Voir parcours' : 'View path'}
            </button>
          )}
        </div>

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
                        onClick={() => changeReadingSpeed(speed)}
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

                  {/* BUG-56: Reading text with auto-scroll and dynamic height */}
                  <div className="text-sm text-[#555555] leading-[1.8] mb-4 p-6 bg-blue-50 rounded-lg border border-blue-200 relative max-h-[50vh] overflow-y-auto scroll-smooth" id="reading-text-container">
                    {(() => {
                      const fullText = currentExercise.readingText || ''
                      const words = fullText.split(/\s+/)

                      return (
                        <>
                          {words.map((word, idx) => (
                            <span
                              key={idx}
                              id={`reading-word-${idx}`}
                              onClick={(e) => fetchWordDefinition(word.replace(/[.,!?;:]/g, ''), e)}
                              className={`cursor-help hover:underline hover:text-blue-700 transition-colors ${
                                idx === highlightWordIndex ? 'bg-[#D9B438] text-white rounded px-0.5' : ''
                              }`}
                              ref={(el) => {
                                if (idx === highlightWordIndex && el) {
                                  el.scrollIntoView({ behavior: 'smooth', block: 'center' })
                                }
                              }}
                            >
                              {word}{' '}
                            </span>
                          ))}
                        </>
                      )
                    })()}
                  </div>

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

              {/* P0-4: Full feedback on EVERY answer (Curriculum §1.2 Étape 4) */}
              {/* Always show: Ta réponse / Réponse correcte / Explication */}
              <div className="space-y-2 mb-3">
                {/* Ta réponse */}
                {currentExercise.type !== 'reading_comprehension' && (
                  <p className="text-sm text-[#555555]">
                    {lang === 'fr' ? 'Ta réponse :' : 'Your answer:'}{' '}
                    <span className={`font-bold ${isCorrect ? 'text-green-700' : 'text-red-600'}`}>
                      {results[results.length - 1]?.userAnswer || 'N/A'}
                    </span>
                  </p>
                )}

                {/* Réponse correcte (always shown) */}
                <p className="text-sm text-[#555555]">
                  {lang === 'fr' ? 'Réponse correcte :' : 'Correct answer:'}{' '}
                  <span className="font-bold text-green-700">{currentExercise.answer}</span>
                </p>

                {/* BUG-38: IPA phonetic guide for speaking */}
                {currentExercise.type === 'speaking_repeat' && IPA_MAP[currentExercise.answer.toLowerCase()] && (
                  <p className="text-sm text-[#555555]">
                    <span className="font-mono text-[#7B1FA2]">{IPA_MAP[currentExercise.answer.toLowerCase()]}</span>
                  </p>
                )}
              </div>

              {/* P0-4: Explication de la règle (always shown, both correct and incorrect) */}
              <div className="p-3 bg-blue-50 rounded-lg text-sm text-[#002844]">
                <p className="font-semibold text-xs text-blue-600 mb-1">
                  {lang === 'fr' ? '💡 Explication' : '💡 Explanation'}
                </p>
                {getWhyWrongExplanation(currentExercise, results[results.length - 1]?.userAnswer || userInput)}
              </div>

              {/* BUG-49: Audio comparison buttons for ALL oral exercises */}
              {(currentExercise.type === 'speaking_repeat' || currentExercise.module === 'oral' || userAudioUrl) && (
                <div className="flex gap-2 mb-3">
                  <button onClick={() => speakText(currentExercise.answer, user?.activeLang || 'en')}
                    className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-blue-50 text-blue-700 text-xs font-semibold hover:bg-blue-100 transition-colors">
                    <Volume2 className="h-3.5 w-3.5" />
                    {lang === 'fr' ? 'Écouter la cible' : 'Listen to target'}
                  </button>
                  {userAudioUrl && (
                    <button onClick={playUserAudio}
                      className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-purple-50 text-purple-700 text-xs font-semibold hover:bg-purple-100 transition-colors">
                      <Mic className="h-3.5 w-3.5" />
                      {lang === 'fr' ? 'Ma prononciation' : 'My pronunciation'}
                    </button>
                  )}
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
                    setUserAudioUrl(null)
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
      <BottomNav lang={lang} />
    </div>
  )
}

// Wrap in Suspense for useSearchParams
export default function SessionPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center bg-[#F0F0F0]">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-[#002844]" />
      </div>
    }>
      <SessionContent />
    </Suspense>
  )
}
