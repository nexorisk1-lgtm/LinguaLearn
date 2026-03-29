'use client'

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useRef, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Play, CheckCircle, XCircle, ArrowRight, Trophy, Flame,
  BookOpen, PenTool, Mic, Volume2, Pencil, Home, Volume, Star,
} from 'lucide-react'
import { getCurrentUser, updateUserProgress, saveReviewItem, addSessionDate } from '@/lib/db/localStorage'
import { User, InterfaceLanguage, LearningObjective } from '@/types'
import BottomNav from '@/components/BottomNav'
import PageHeader from '@/components/PageHeader'
import {
  getVocabulary, getGrammarRules, getExercisesForRule,
  getReadingTexts, getSpeakingExercises, getWritingExercises,
  speakText, isCloseEnough, addToPersonalVocab,
} from '@/lib/db/bankHelpers'
import { getA1CourseData, getA1CourseVocabulary, getA1CourseGrammarExercises, getMicroReussite } from '@/lib/db/bankA1Courses'
import type { VocabWord, GrammarExercise, ReadingText, SpeakingExercise, WritingExercise } from '@/lib/db/bankTypes'
import { useEngine } from '@/lib/engine/useEngine'
import { awardPoints } from '@/lib/engine/gamificationEngine'
import { updateWordState } from '@/lib/engine/userProgress'

// ==========================================
// TYPES
// ==========================================

type SessionPhase = 'intro' | 'objectif' | 'preactivation' | 'rule_display' | 'lessonMap' | 'exercise' | 'summary'

interface SessionExercise {
  type: 'vocab_translate' | 'vocab_listen' | 'grammar_qcm' | 'reading_comprehension' | 'speaking_repeat' | 'writing_fill' | 'word_order'
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
  const engine = useEngine()
  const [user, setUser] = useState<User | null>(null)
  const [lang, setLang] = useState<InterfaceLanguage>('fr')
  const [loading, setLoading] = useState(true)
  const [phase, setPhase] = useState<SessionPhase>('intro')
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [introCountdown, setIntroCountdown] = useState(5)
  const [preactivIdx, setPreactivIdx] = useState(0)
  const [preactivInteracted, setPreactivInteracted] = useState(false)
  const [preactivVoiceDetected, setPreactivVoiceDetected] = useState(false)
  const [exercises, setExercises] = useState<SessionExercise[]>([])
  const [currentIdx, setCurrentIdx] = useState(0)
  const [results, setResults] = useState<SessionResult[]>([])
  // V3.19 BUG-62: Flag to prevent race condition intro→summary before buildSession completes
  const [sessionReady, setSessionReady] = useState(false)
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

  // BUG-83: Word order exercise state
  const [wordOrderSelected, setWordOrderSelected] = useState<string[]>([])
  const [wordOrderPool, setWordOrderPool] = useState<string[]>([])

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

    // V3.20: Check if this is a real A1 course from the bank
    const isA1BankCourse = courseId && /^a1_c\d+$/.test(courseId) && getA1CourseData(courseId)

    if (isA1BankCourse && courseId) {
      // ==========================================
      // P0-A/P1-B: A1 BANK COURSE — STRICT PEDAGOGICAL ORDER
      // Each word = min 3 exercises of DIFFERENT types, INTERLEAVED (not consecutive)
      // P1-C: For Parcours B, 100% words get oral exercise
      // P1-E: Explicit consignes in French
      // ==========================================
      const courseVocab = getA1CourseVocabulary(courseId)
      const courseGrammarEx = getA1CourseGrammarExercises(courseId)
      const cd = getA1CourseData(courseId)

      // ---- ROUND 1: Translation (QCM for Path B, text for Path A) ----
      const round1: SessionExercise[] = []
      for (const w of courseVocab) {
        if (isPathB) {
          const pool = courseVocab.filter(x => x.word_target !== w.word_target).map(x => x.word_target)
          const distractors = pool.sort(() => Math.random() - 0.5).slice(0, 3)
          const options = [w.word_target, ...distractors].sort(() => Math.random() - 0.5)
          round1.push({
            type: 'grammar_qcm' as const, module: 'vocabulaire', data: w,
            question: lang === 'fr' ? `Comment dit-on "${w.word_fr}" en anglais ?` : `How do you say "${w.word_fr}" in English?`,
            answer: w.word_target,
            options: options.length >= 2 ? options : [w.word_target, 'unknown'],
          })
        } else {
          round1.push({
            type: 'vocab_translate' as const, module: 'vocabulaire', data: w,
            question: lang === 'fr' ? `Comment dit-on "${w.word_fr}" en anglais ?` : `How do you say "${w.word_fr}" in English?`,
            answer: w.word_target, hint: w.definition_en,
          })
        }
      }

      // ---- ROUND 2: Reverse translation / association ----
      const round2: SessionExercise[] = []
      for (const w of courseVocab) {
        const pool = courseVocab.filter(x => x.word_fr !== w.word_fr).map(x => x.word_fr)
        const distractors = pool.sort(() => Math.random() - 0.5).slice(0, 3)
        const options = [w.word_fr, ...distractors].sort(() => Math.random() - 0.5)
        round2.push({
          type: 'grammar_qcm' as const, module: 'vocabulaire', data: w,
          question: lang === 'fr' ? `Que signifie "${w.word_target}" en français ?` : `What does "${w.word_target}" mean in French?`,
          answer: w.word_fr,
          options: options.length >= 2 ? options : [w.word_fr, 'inconnu'],
        })
      }

      // ---- ROUND 3: Fill-in / context exercise ----
      const round3: SessionExercise[] = []
      for (const w of courseVocab) {
        if (w.example_en && w.example_en.toLowerCase().includes(w.word_target.toLowerCase())) {
          const blanked = w.example_en.replace(new RegExp(w.word_target, 'i'), '______')
          round3.push({
            type: 'vocab_translate' as const, module: 'vocabulaire', data: w,
            question: lang === 'fr'
              ? `Complétez avec le mot appris : "${blanked}"`
              : `Fill in with the learned word: "${blanked}"`,
            answer: w.word_target, hint: w.word_fr,
          })
        } else {
          // Fallback: listen and type
          round3.push({
            type: 'vocab_translate' as const, module: 'vocabulaire', data: w,
            question: lang === 'fr' ? `Écrivez le mot anglais pour "${w.word_fr}"` : `Write the English word for "${w.word_fr}"`,
            answer: w.word_target, hint: w.definition_en,
          })
        }
      }

      // INTERLEAVE: word1-R1, word2-R1, ..., word1-R2, word2-R2, ..., word1-R3, word2-R3
      // This ensures 3 different exercise types per word, NON-consecutive
      allExercises.push(...round1, ...round2, ...round3)
      usedModules.push('vocabulaire')

      // ---- Grammar exercises ----
      if (courseGrammarEx.length > 0) {
        allExercises.push(...generateGrammarExercises(courseGrammarEx, Math.min(5, courseGrammarEx.length)))
        usedModules.push('grammaire')
      }

      // ---- P1-C: ORAL — 100% words for Parcours B, 2 for Path A ----
      if (courseVocab.length > 0) {
        const oralWords = isPathB ? courseVocab : courseVocab.slice(0, 2)
        const courseSpeak: SessionExercise[] = oralWords.map(w => ({
          type: 'speaking_repeat' as const,
          module: 'oral',
          data: w,
          question: lang === 'fr' ? `Parle maintenant : prononcez "${w.word_target}"` : `Speak now: say "${w.word_target}"`,
          answer: w.word_target,
        }))
        allExercises.push(...courseSpeak)
        usedModules.push('oral')
      }

      // ---- Word ordering (Path A only) ----
      if (!isPathB && cd && courseVocab.length > 0) {
        const orderExercises: SessionExercise[] = cd.vocabulary
          .filter(v => v.example_en.split(' ').length >= 3 && v.example_en.split(' ').length <= 7)
          .slice(0, 2)
          .map((v) => ({
            type: 'word_order' as const, module: 'ecrit',
            data: { ...v, courseId },
            question: lang === 'fr' ? `Remettez les mots dans le bon ordre :` : `Put the words in the correct order:`,
            answer: v.example_en,
            options: v.example_en.split(' ').sort(() => Math.random() - 0.5),
          }))
        if (orderExercises.length > 0) {
          allExercises.push(...orderExercises)
          usedModules.push('ecrit')
        }
      }

    } else {
      // ==========================================
      // LEGACY: generic bank-based session (non-A1 courses, Parcours B, etc.)
      // ==========================================

      // STEP 1: Daily Words
      const chestKey = `lingualearn_chest_${userId}_${todayStr}`
      const chestOpened = localStorage.getItem(chestKey)
      if (!chestOpened) {
        const words = getVocabulary(activeLang, userThemes, userLevel)
        const wordsPerDay = currentUser.settings.schedules?.[activeLang]?.wordsPerDay || 8
        if (words.length > 0) {
          const dailyWords = words.slice(0, wordsPerDay)
          allExercises.push(...generateVocabExercises(dailyWords, Math.min(3, wordsPerDay), isPathB))
          usedModules.push('vocabulaire')
        }
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
      if (objectiveSet.has('ecrit') && !isPathB) {
        const writeExercises = getWritingExercises(activeLang, userThemes, userLevel)
        if (writeExercises.length > 0) {
          allExercises.push(...generateWritingExercises(writeExercises, 2))
          usedModules.push('ecrit')
        }
      }
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
    }

    // V3.16 BUG-62: If no exercises generated, force vocab generation (never show empty session)
    if (allExercises.length === 0) {
      if (isA1BankCourse && courseId) {
        // A1 course fallback: only course vocabulary
        const fallbackVocab = getA1CourseVocabulary(courseId)
        if (fallbackVocab.length > 0) {
          allExercises.push(...generateVocabExercises(fallbackVocab, fallbackVocab.length, isPathB))
          if (!usedModules.includes('vocabulaire')) usedModules.push('vocabulaire')
        }
      } else {
        const words = getVocabulary(activeLang, userThemes, userLevel)
        if (words.length > 0) {
          allExercises.push(...generateVocabExercises(words, Math.min(5, words.length), isPathB))
          if (!usedModules.includes('vocabulaire')) usedModules.push('vocabulaire')
        }
      }
    }

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
    // V3.19 BUG-62: Mark session as ready so intro→lessonMap/summary transition waits
    setSessionReady(true)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId])

  useEffect(() => {
    const currentUser = getCurrentUser()
    if (!currentUser) { router.push('/auth'); return }
    if (!currentUser.onboardingCompleted && currentUser.role !== 'admin') { router.push('/onboarding'); return }
    setUser(currentUser)
    setLang(currentUser.settings.interfaceLang || 'fr')

    // V2.1.1: Robust resume — restore full state INCLUDING exact phase
    let shouldResume = false
    if (courseId) {
      try {
        const resumeKey = `lingualearn_resume_${currentUser.id}_${courseId}`
        const resumeStr = localStorage.getItem(resumeKey)
        if (resumeStr) {
          const resume = JSON.parse(resumeStr)
          const savedAt = new Date(resume.savedAt).getTime()
          if (Date.now() - savedAt < 24 * 60 * 60 * 1000) {
            shouldResume = true
            // Restore full state if available
            if (resume.exercises && resume.exercises.length > 0) {
              setExercises(resume.exercises)
              setLessons(resume.lessons || [])
              setResults(resume.results || [])
            }
            setCurrentIdx(resume.exerciseIndex || 0)
            setCurrentLessonIdx(resume.lessonIndex || 0)
            setSessionReady(true)
            // V2.1.1 FIX: Restore exact phase instead of always jumping to 'exercise'
            const savedPhase = resume.phase || 'exercise'
            setPhase(savedPhase as SessionPhase)
            console.log('[Engine:Session] Resumed at phase:', savedPhase, 'idx:', resume.exerciseIndex)
          }
        }
      } catch { /* ignore */ }
    }

    // Only build fresh session if NOT resuming
    if (!shouldResume) {
      buildSession(currentUser)
    }

    // Init speech recognition
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition()
    }

    setLoading(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, buildSession])

  // V2.1.1: Universal pedagogical flow — ALL courses go through objectif phase
  // Supprimé le bypass isA1 → tous les parcours suivent le même flux
  useEffect(() => {
    if (phase !== 'intro' || !sessionReady) return
    if (exercises.length > 0) {
      // V2.1.1 FIX: Flux universel — tous les cours passent par objectif
      // Le moteur central décide du contenu, pas le pattern courseId
      if (courseId) {
        setPhase('objectif')
      } else {
        // Session générique sans courseId → lessonMap direct
        setPhase('lessonMap')
      }
    } else {
      setPhase('summary')
    }
  }, [phase, exercises.length, sessionReady, courseId])

  // Preactivation: Auto-play audio when word changes (must be top-level, not conditional)
  useEffect(() => {
    if (phase !== 'preactivation') return
    const courseVocab = courseId ? getA1CourseVocabulary(courseId) : []
    const activeLang = user?.activeLang || user?.settings.learningLangs[0] || 'en'
    if (courseVocab.length > 0 && preactivIdx < courseVocab.length) {
      const word = courseVocab[preactivIdx]
      const timer = setTimeout(() => {
        speakText(word.word_target, activeLang)
      }, 300)
      return () => clearTimeout(timer)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, preactivIdx, courseId])

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
    } else if (currentExercise.type === 'word_order') {
      // BUG-83: Word ordering — compare joined words to expected sentence
      correct = userAnswer.toLowerCase().trim() === currentExercise.answer.toLowerCase().trim()
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

    // P0-E: Update vocabularyPercent after each correct vocab exercise
    if (correct && currentExercise.module === 'vocabulaire' && engine.progress) {
      const wordId = currentExercise.data?.id
      if (wordId) {
        engine.updateProgress(prev => {
          const updated = updateWordState(prev, wordId, 'learned')
          const totalA1Words = 40 * 7
          const learnedCount = Object.values(updated.wordStates).filter(s => s === 'learned' || s === 'mastered').length
          return { ...updated, vocabularyPercent: Math.round((learnedCount / totalA1Words) * 100) }
        })
      }
    }
  }

  // V3.19b BUG-72: Auto-save resume position after each exercise advance
  // V3.19b BUG-68: Also save partial progress percentage for dashboard stars
  const autoSaveResume = useCallback((nextExIdx: number, nextLessonIdx: number, currentResults: SessionResult[]) => {
    if (!courseId || !user) return
    try {
      const resumeKey = `lingualearn_resume_${user.id}_${courseId}`
      localStorage.setItem(resumeKey, JSON.stringify({
        lessonIndex: nextLessonIdx,
        exerciseIndex: nextExIdx,
        phase: phase, // V2.1.1: Save current phase for exact resume
        savedAt: new Date().toISOString(),
        exercises,
        lessons,
        results: currentResults,
      }))
      // BUG-68: Save partial progress for dashboard stars
      const totalEx = exercises.length
      const progressPct = totalEx > 0 ? Math.round((nextExIdx / totalEx) * 100) : 0
      const correctCount = currentResults.filter(r => r.correct).length
      const scorePct = currentResults.length > 0 ? Math.round((correctCount / currentResults.length) * 100) : 0
      localStorage.setItem(`lingualearn_course_progress_today_${user.id}`, JSON.stringify({
        courseId,
        progressPct,
        scorePct,
        date: new Date().toISOString().split('T')[0],
      }))
    } catch { /* ignore */ }
  }, [courseId, user, exercises, lessons])

  const handleNext = () => {
    setShowFeedback(false)
    setUserInput('')
    setSelectedOption(null)
    setHeardText('')
    setShowingComprehension(false)
    setWordDefinition(null)
    setShowWhyWrong(false)
    setUserAudioUrl(null) // V3.16: Reset audio to prevent residual oral buttons
    setWordOrderSelected([]) // BUG-83: Reset word order
    setWordOrderPool([])

    // Capture current results (including the one just answered) for auto-save
    const currentResults = [...results]

    const nextIdx = currentIdx + 1
    if (nextIdx < exercises.length) {
      // V3.19b BUG-72: Auto-save after each exercise
      autoSaveResume(nextIdx, currentLessonIdx, currentResults)

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
        // Auto-save with updated lesson index
        autoSaveResume(nextIdx, nextLessonIndex, currentResults)
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

    // V3.11: Persist completed day for planning calendar
    addSessionDate(user.id, activeLang, todayStr)

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

    // V3.16 BUG-66: Mark course done today for planning validation
    if (!isPartialQuit) {
      try {
        const todayKey = `lingualearn_course_done_today_${user.id}`
        localStorage.setItem(todayKey, todayStr)
      } catch { /* ignore */ }
      // V3.19b BUG-72: Clear resume data on full completion
      if (courseId) {
        try {
          localStorage.removeItem(`lingualearn_resume_${user.id}_${courseId}`)
        } catch { /* ignore */ }
      }
    }

    // BUG-59: Save course score ONLY if session is fully completed (not partial quit)
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

      // Phase 12: Award engine gamification points + vocabulary progression
      if (engine.progress) {
        engine.updateProgress(prev => {
          let updated = awardPoints(prev, 'course_completed', courseId)
          // Award points for each correct exercise
          const correctExercises = results.filter(r => r.correct)
          for (const ex of correctExercises) {
            updated = awardPoints(updated, 'exercise_correct', ex.exercise?.data?.id || courseId)
          }
          // Award word_learned + mark vocabulary as 'learned' for progression tracking
          const courseVocab = getA1CourseVocabulary(courseId)
          for (const w of courseVocab) {
            updated = awardPoints(updated, 'word_learned', w.id)
            updated = updateWordState(updated, w.id, 'learned')
          }
          // Recalc vocabulary percent based on total A1 words vs learned
          const totalA1Words = 40 * 7 // 40 courses × ~7 words avg
          const learnedCount = Object.values(updated.wordStates).filter(s => s === 'learned' || s === 'mastered').length
          updated = {
            ...updated,
            vocabularyPercent: Math.round((learnedCount / totalA1Words) * 100),
          }
          return updated
        })
      }
    }
  }

  // BUG-58+59: Quit session — save streak/activity but NEVER mark course as completed
  // V3.19 BUG-72: Save full exercises/lessons/results for exact resume
  const handleQuitSession = () => {
    if (results.length > 0) {
      finishSession(true) // isPartialQuit = true → no course score saved
    }
    // Save resume position AND full session state for this course
    if (courseId && user) {
      try {
        const resumeKey = `lingualearn_resume_${user.id}_${courseId}`
        localStorage.setItem(resumeKey, JSON.stringify({
          lessonIndex: currentLessonIdx,
          exerciseIndex: currentIdx,
          phase: phase, // V2.1.1: Save current phase for exact resume
          savedAt: new Date().toISOString(),
          exercises: exercises,
          lessons: lessons,
          results: results,
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
  // PHASE: OBJECTIF DU COURS (V4 step 0)
  // ==========================================
  if (phase === 'objectif') {
    const courseData = courseId ? getA1CourseData(courseId) : null
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#002844] to-[#003a5c] px-4 py-8">
        <PageHeader title={lang === 'fr' ? 'Objectif du cours' : 'Course objective'} backHref="/dashboard" />
        <div className="max-w-lg mx-auto mt-8">
          {/* Course title */}
          <div className="text-center mb-8">
            <span className="inline-block bg-[#D9B438]/20 text-[#D9B438] text-xs font-bold px-3 py-1 rounded-full mb-3">
              {lang === 'fr' ? `Cours ${courseData?.number || ''}` : `Course ${courseData?.number || ''}`}
            </span>
            <h1 className="text-2xl font-bold text-white mb-2">{courseData?.title}</h1>
            {courseData?.scenario && (
              <p className="text-white/60 text-sm italic">{courseData.scenario}</p>
            )}
          </div>

          {/* Objectifs */}
          <div className="rounded-2xl bg-white/10 backdrop-blur-sm p-6 mb-8">
            <h2 className="text-[#D9B438] font-bold text-base mb-4">
              {lang === 'fr' ? '🎯 À la fin de ce cours, tu sauras :' : '🎯 By the end of this course, you will know how to:'}
            </h2>
            <div className="space-y-3">
              {courseData?.objectif?.map((obj, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span className="text-green-400 mt-0.5">✅</span>
                  <span className="text-white text-sm">{obj}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Phrase clé */}
          {courseData?.phrase_cle && (
            <div className="rounded-2xl bg-white/5 p-4 mb-8 text-center">
              <p className="text-white/40 text-xs mb-1">{lang === 'fr' ? '🔑 Phrase clé' : '🔑 Key phrase'}</p>
              <p className="text-white font-medium text-lg">{courseData.phrase_cle}</p>
            </div>
          )}

          {/* BLOC 3 Étape 1: Stats du cours */}
          <div className="rounded-2xl bg-white/10 p-4 mb-6 flex items-center justify-center gap-6">
            <span className="text-sm text-white/80">📚 {courseData?.vocabulary?.length || 7} {lang === 'fr' ? 'mots' : 'words'}</span>
            {courseData?.rule?.en && <span className="text-sm text-white/80">📖 1 {lang === 'fr' ? 'règle' : 'rule'}</span>}
            <span className="text-sm text-white/80">⏱ {Math.round(((courseData?.vocabulary?.length || 7) * 0.5) + 2)} min</span>
          </div>

          {/* Start button */}
          <button
            onClick={() => setPhase('preactivation')}
            className="w-full py-4 rounded-2xl bg-[#D9B438] text-[#002844] font-bold text-lg shadow-lg hover:bg-[#c9a428] transition-all active:scale-95 transition-transform"
          >
            {lang === 'fr' ? "Commencer →" : "Start →"}
          </button>
        </div>
      </div>
    )
  }

  // ==========================================
  // PHASE: PREACTIVATION (V4 step 1) - Interactive Carousel
  // ==========================================
  if (phase === 'preactivation') {
    const courseVocab = courseId ? getA1CourseVocabulary(courseId) : []
    const activeLang = user?.activeLang || user?.settings.learningLangs[0] || 'en'

    const currentWord = courseVocab[preactivIdx]
    const isLastWord = preactivIdx === courseVocab.length - 1
    const progress = courseVocab.length > 0 ? Math.round(((preactivIdx + 1) / courseVocab.length) * 100) : 0

    return (
      <div className="min-h-screen bg-[#F0F0F0] pb-20">
        <PageHeader title={lang === 'fr' ? 'Pré-activation' : 'Pre-activation'} backHref="/dashboard" />
        <main className="px-4 pt-6 max-w-lg mx-auto">
          {/* Instruction banner */}
          <div className="mb-4 px-4 py-2 rounded-xl bg-blue-50 border border-blue-200">
            <p className="text-sm font-bold text-blue-800 text-center">
              🎧 {lang === 'fr' ? 'Écoute et répète chaque mot' : 'Listen and repeat each word'}
            </p>
          </div>

          {/* Progress bar */}
          <div className="mb-6">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-[#555555]">
                {preactivIdx + 1} / {courseVocab.length}
              </span>
              <span className="text-sm font-bold text-[#002844]">{progress}%</span>
            </div>
            <div className="h-2 w-full rounded-full bg-gray-200">
              <div
                className="h-full rounded-full bg-[#002844] transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {currentWord ? (
            <div className="rounded-2xl bg-white p-8 shadow-sm mb-6 text-center">
              {/* Word image - large */}
              <div className="mb-6 flex justify-center cursor-pointer" onClick={() => { setPreactivInteracted(true); speakText(currentWord.word_target, activeLang); }}>
                {currentWord.image ? (
                  <img
                    src={currentWord.image}
                    alt={currentWord.word_target}
                    className="w-60 h-60 rounded-2xl object-cover shadow-md hover:opacity-90 transition-opacity"
                  />
                ) : (
                  <div className="w-60 h-60 rounded-2xl bg-gradient-to-br from-[#E8F4F8] to-[#D5E8F0] flex flex-col items-center justify-center shadow-md">
                    <span className="text-6xl font-bold text-[#002844]/30">{currentWord.word_target.charAt(0).toUpperCase()}</span>
                    <span className="text-xs text-[#888888] mt-2">{currentWord.word_target}</span>
                  </div>
                )}
              </div>

              {/* Word and phonetics */}
              <h2 className="text-3xl font-bold text-[#002844] mb-2">{currentWord.word_target}</h2>
              {currentWord.phonetic && (
                <p className="text-lg text-[#888888] italic mb-4">/{currentWord.phonetic}/</p>
              )}
              <p className="text-lg text-[#555555] mb-6">{currentWord.word_fr}</p>

              {/* Repeat button */}
              <button
                onClick={() => { setPreactivInteracted(true); speakText(currentWord.word_target, activeLang); }}
                className="flex items-center gap-2 mx-auto px-4 py-3 rounded-lg bg-[#E8F4F8] text-[#002844] text-sm font-semibold hover:opacity-90 transition-opacity mb-6"
              >
                <Volume2 className="h-4 w-4" />
                {lang === 'fr' ? 'Répéter' : 'Repeat'}
              </button>

              {/* Microphone button */}
              <button
                onClick={() => {
                  setPreactivInteracted(true)
                  setPreactivVoiceDetected(false)
                  const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
                  if (SpeechRecognition) {
                    const recognition = new SpeechRecognition()
                    recognition.continuous = false
                    recognition.interimResults = false
                    recognition.lang = activeLang === 'en' ? 'en-US' : 'fr-FR'
                    recognition.onresult = () => setPreactivVoiceDetected(true)
                    recognition.onerror = () => setPreactivVoiceDetected(false)
                    recognition.start()
                  }
                }}
                className="flex items-center gap-2 mx-auto px-4 py-3 rounded-lg bg-blue-500 text-white text-sm font-semibold hover:bg-blue-600 transition-all"
              >
                <Mic className="h-4 w-4" />
                {lang === 'fr' ? 'Parler 🎤' : 'Speak 🎤'}
              </button>
              {preactivVoiceDetected && (
                <p className="text-green-600 text-sm font-bold mt-2 animate-pulse">
                  ✅ {lang === 'fr' ? 'Voix détectée !' : 'Voice detected!'}
                </p>
              )}
            </div>
          ) : (
            <div className="rounded-2xl bg-white p-8 shadow-sm mb-6 text-center">
              <p className="text-[#555555]">
                {lang === 'fr' ? 'Aucun mot à afficher' : 'No words to display'}
              </p>
            </div>
          )}

          {/* Navigation buttons */}
          <div className="flex gap-3">
            {preactivIdx > 0 && (
              <button
                onClick={() => { setPreactivIdx(preactivIdx - 1); setPreactivInteracted(false); }}
                className="flex-1 py-3 rounded-xl bg-gray-200 text-[#002844] font-semibold hover:opacity-90 transition-opacity"
              >
                {lang === 'fr' ? '← Précédent' : '← Previous'}
              </button>
            )}
            {!isLastWord ? (
              <button
                onClick={() => { setPreactivIdx(preactivIdx + 1); setPreactivInteracted(false); }}
                disabled={!preactivInteracted}
                className={`flex-1 py-3 rounded-xl font-semibold transition-opacity ${
                  preactivInteracted
                    ? 'bg-[#002844] text-white hover:opacity-90'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed opacity-50'
                }`}
              >
                {lang === 'fr' ? 'Suivant →' : 'Next →'}
              </button>
            ) : (
              <button
                onClick={() => {
                  setPreactivIdx(0)
                  setPhase('rule_display')
                }}
                disabled={!preactivInteracted}
                className={`flex-1 py-3 rounded-xl font-semibold transition-opacity ${
                  preactivInteracted
                    ? 'bg-[#D9B438] text-[#002844] hover:opacity-90'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed opacity-50'
                }`}
              >
                {lang === 'fr' ? 'Voir la règle →' : 'See rule →'}
              </button>
            )}
          </div>
        </main>
        <BottomNav lang={lang} />
      </div>
    )
  }

  // ==========================================
  // PHASE: RULE DISPLAY (V4 step 2)
  // ==========================================
  if (phase === 'rule_display') {
    const courseData = courseId ? getA1CourseData(courseId) : null
    const activeLang = user?.activeLang || user?.settings.learningLangs[0] || 'en'
    return (
      <div className="min-h-screen bg-[#F0F0F0] pb-20">
        <PageHeader title={lang === 'fr' ? 'Règle de grammaire' : 'Grammar Rule'} backHref="/dashboard" />
        <main className="px-4 pt-6 max-w-lg mx-auto">
          {/* P1-F: Guidage explicite */}
          <div className="mb-4 px-4 py-2 rounded-xl bg-amber-50 border border-amber-200">
            <p className="text-sm font-bold text-amber-800 text-center">
              📖 {lang === 'fr' ? 'Lis la règle, puis écoute les exemples' : 'Read the rule, then listen to the examples'}
            </p>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm mb-6">
            {courseData?.rule ? (
              <>
                {/* P1-A: Format pédagogique — contexte → usage → exemple en situation */}
                <div className="mb-4">
                  <p className="text-xs font-semibold text-[#D9B438] uppercase tracking-wide mb-2">
                    🇫🇷 {lang === 'fr' ? 'Explication en français' : 'French explanation'}
                  </p>
                  <div className="bg-[#F8F6F0] rounded-xl p-4">
                    <p className="text-base text-[#002844] leading-relaxed whitespace-pre-line">
                      {lang === 'fr' ? courseData.rule.fr : courseData.rule.en}
                    </p>
                  </div>
                </div>

                {courseData.examples && courseData.examples.length > 0 && (
                  <div className="mt-5">
                    <p className="text-xs font-semibold text-[#888888] uppercase tracking-wide mb-3">
                      🔊 {lang === 'fr' ? 'Exemples en situation' : 'Examples in context'}
                    </p>
                    <div className="space-y-3">
                      {courseData.examples.map((ex, i) => (
                        <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-[#E8F4F8] border border-[#D5E8F0]">
                          <button
                            onClick={() => speakText(ex.en, activeLang)}
                            className="p-2 rounded-full bg-[#002844] text-white hover:opacity-90 transition-opacity flex-shrink-0"
                          >
                            <Volume2 className="h-4 w-4" />
                          </button>
                          <div className="flex-1">
                            <p className="text-sm font-bold text-[#002844]">&ldquo;{ex.en}&rdquo;</p>
                            <p className="text-xs text-[#555555] mt-0.5">→ {ex.fr}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <p className="text-[#555555]">{lang === 'fr' ? 'Aucune règle disponible pour ce cours.' : 'No rule available for this course.'}</p>
            )}
          </div>
          <button
            onClick={() => setPhase('lessonMap')}
            className="w-full py-3 rounded-xl bg-[#002844] text-white font-semibold text-lg hover:opacity-90 transition-opacity"
          >
            {lang === 'fr' ? 'Commencer les exercices' : 'Start exercises'}
          </button>
        </main>
        <BottomNav lang={lang} />
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
            {/* V3.16 BUG-65: bigger text */}
            <h1 className="font-bold text-[#002844] mb-2" style={{ fontSize: '28px' }}>
              {lang === 'fr' ? 'Session terminée !' : 'Session complete!'}
            </h1>
            <p className="text-base text-[#555555]">
              {lang === 'fr'
                ? `${correctCount}/${totalCount} bonnes réponses (${pct}%)`
                : `${correctCount}/${totalCount} correct answers (${pct}%)`}
            </p>
          </div>

          {/* Stars display */}
          <div className="rounded-2xl bg-white p-6 shadow-sm mb-6 text-center">
            {/* V3.16 BUG-65: bigger stars and text */}
            <div className="flex justify-center gap-3 mb-3">
              {[1, 2, 3].map(i => (
                <Star key={i} className={`h-12 w-12 transition-all ${
                  i <= stars
                    ? 'text-[#D9B438] fill-[#D9B438] scale-110'
                    : 'text-gray-200'
                }`} />
              ))}
            </div>
            <p className={`text-xl font-bold ${
              stars >= 3 ? 'text-green-600' : stars >= 2 ? 'text-[#D9B438]' : stars >= 1 ? 'text-orange-500' : 'text-red-500'
            }`}>
              {starLabel}
            </p>
            <p className="font-bold text-[#002844] mt-2" style={{ fontSize: '36px' }}>{pct}%</p>
            <div className="h-3 w-full rounded-full bg-gray-100 mt-3">
              <div className="h-full rounded-full transition-all"
                style={{
                  width: `${pct}%`,
                  backgroundColor: stars >= 3 ? '#2E7D32' : stars >= 2 ? '#D9B438' : stars >= 1 ? '#E65100' : '#E53935',
                }} />
            </div>

            {/* BLOC 3 Étape 5: Micro-réussite émotionnelle forte */}
            {courseId && /^a1_c\d+$/.test(courseId) && (() => {
              const microText = getMicroReussite(courseId, lang)
              const courseNum = parseInt(courseId.replace('a1_c', ''), 10)
              const remaining = 40 - courseNum
              const streakVal = user?.progress?.[user?.activeLang || 'en']?.streak || 0
              return (
                <div className="mt-4 p-4 rounded-xl bg-gradient-to-r from-[#D9B438]/10 to-[#002844]/10 border border-[#D9B438]/20">
                  {microText && <p className="text-lg font-bold text-[#002844] mb-2">🎉 {microText}</p>}
                  <p className="text-sm text-[#002844]">
                    ⭐ {stars} {lang === 'fr' ? 'étoiles' : 'stars'} · +{pct > 0 ? Math.round(pct * 0.5) : 0} pts · 🔥 Streak : {streakVal} {lang === 'fr' ? 'jours' : 'days'}
                  </p>
                  {remaining > 0 && (
                    <p className="text-xs text-[#555] mt-1">
                      👉 {lang === 'fr' ? `Encore ${remaining} cours pour finir A1` : `${remaining} more courses to finish A1`}
                    </p>
                  )}
                </div>
              )
            })()}

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
            <h3 className="font-bold text-base text-[#002844] mb-2">{lang === 'fr' ? 'Détail' : 'Details'}</h3>
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

          {/* V3.16 BUG-63: Retour à l'accueil + BUG-64: "Session suivante" */}
          <div className="space-y-3">
            {/* Always show "Retour à l'accueil" */}
            <a href="/dashboard"
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-[#002844] text-white font-bold text-base hover:bg-[#003a5c] transition-colors">
              <Home className="h-5 w-5" />
              {lang === 'fr' ? "Retour à l'accueil" : 'Back to home'}
            </a>
            {courseId && (
              <a href="/module/cours"
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-[#002844] text-[#002844] font-bold text-sm hover:bg-[#002844]/5 transition-colors">
                {lang === 'fr' ? 'Retour au parcours' : 'Back to path'}
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
              {lang === 'fr' ? 'Session suivante' : 'Next session'}
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

        {/* BLOC 3: Étape X/N + barre de progression */}
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-bold text-[#002844]">
            {lang === 'fr' ? `Étape ${currentIdx + 1}/${exercises.length}` : `Step ${currentIdx + 1}/${exercises.length}`}
          </span>
          <span className="text-[10px] font-bold text-[#D9B438]">{progressPct}%</span>
        </div>
        <div className="h-2 w-full rounded-full bg-gray-200 mb-3">
          <div className="h-full rounded-full bg-gradient-to-r from-[#002844] to-[#D9B438] transition-all" style={{ width: `${progressPct}%` }} />
        </div>

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

        {/* P1-F: Guidage explicite par type d'exercice */}
        <div className="mb-3 px-3 py-1.5 rounded-lg bg-blue-50 border border-blue-100">
          <p className="text-xs font-bold text-blue-700 text-center">
            {currentExercise.type === 'vocab_translate'
              ? (lang === 'fr' ? '✏️ Écris la traduction' : '✏️ Write the translation')
              : currentExercise.type === 'grammar_qcm'
              ? (lang === 'fr' ? '👆 Choisis la bonne réponse' : '👆 Choose the correct answer')
              : currentExercise.type === 'reading_comprehension'
              ? (lang === 'fr' ? '📖 Lis le texte attentivement' : '📖 Read the text carefully')
              : currentExercise.type === 'speaking_repeat'
              ? (lang === 'fr' ? '🎤 Parle maintenant' : '🎤 Speak now')
              : currentExercise.type === 'word_order'
              ? (lang === 'fr' ? '🔀 Remets les mots dans le bon ordre' : '🔀 Put the words in order')
              : (lang === 'fr' ? '📝 Complète la phrase' : '📝 Complete the sentence')}
          </p>
        </div>

        {/* Exercise card */}
        <div className="rounded-2xl bg-white p-6 shadow-sm mb-6">
          {/* Exercise type badge + difficulty */}
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xs font-bold px-3 py-1 rounded-full bg-[#002844] text-white">
              {currentExercise.type === 'vocab_translate' ? (lang === 'fr' ? 'Traduction' : 'Translation') :
               currentExercise.type === 'grammar_qcm' ? 'QCM' :
               currentExercise.type === 'reading_comprehension' ? (lang === 'fr' ? 'Lecture' : 'Reading') :
               currentExercise.type === 'speaking_repeat' ? (lang === 'fr' ? 'Prononciation' : 'Pronunciation') :
               currentExercise.type === 'writing_fill' ? (lang === 'fr' ? 'Écriture' : 'Writing') :
               currentExercise.type === 'word_order' ? (lang === 'fr' ? 'Ordre des mots' : 'Word Order') : ''}
            </span>
            <span className={`text-xs font-semibold px-3 py-1 rounded-full ${
              currentExercise.type === 'vocab_translate' || currentExercise.type === 'reading_comprehension'
                ? 'bg-green-100 text-green-700'
                : currentExercise.type === 'speaking_repeat'
                  ? 'bg-red-100 text-red-700'
                  : 'bg-yellow-100 text-yellow-700'
            }`}>
              {currentExercise.type === 'vocab_translate' || currentExercise.type === 'reading_comprehension'
                ? '⭐ Facile'
                : currentExercise.type === 'speaking_repeat'
                  ? '⭐⭐⭐ Difficile'
                  : currentExercise.type === 'word_order'
                    ? '⭐ Facile'
                    : '⭐⭐ Intermédiaire'}
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
                // Display comprehension question + BUG-76: text remains visible in accordion
                <div>
                  {/* BUG-76: Reference text in collapsible accordion */}
                  <details className="mb-4 bg-blue-50 rounded-lg border border-blue-200">
                    <summary className="cursor-pointer p-3 text-sm font-semibold text-[#002844] flex items-center gap-2">
                      📖 {lang === 'fr' ? 'Revoir le texte' : 'Review text'}
                    </summary>
                    <div className="px-4 pb-3 text-sm text-[#555555] leading-[1.8] max-h-[30vh] overflow-y-auto">
                      {currentExercise.readingText}
                    </div>
                  </details>
                  {/* V3.16: question 28px bold */}
                  <h2 className="font-bold text-[#002844] mb-4" style={{ fontSize: '28px' }}>
                    {lang === 'fr' ? 'Question de compréhension :' : 'Reading comprehension:'}
                  </h2>
                  <p className="text-base font-semibold text-[#002844] mb-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                    {currentExercise.comprehensionQuestion}
                  </p>
                </div>
              )}
            </div>
          ) : currentExercise.type === 'word_order' ? (
            <div>
              {/* BUG-83: Word ordering exercise */}
              <h2 className="font-bold text-[#002844] mb-2" style={{ fontSize: '28px' }}>
                {lang === 'fr' ? 'Remettez les mots dans le bon ordre :' : 'Put the words in the correct order:'}
              </h2>
              {currentExercise.data?.example_fr && (
                <p className="text-sm text-[#555555] mb-4 italic">💡 {currentExercise.data.example_fr}</p>
              )}
            </div>
          ) : currentExercise.type === 'speaking_repeat' ? (
            <div>
              {/* V3.16: question 28px bold */}
              <h2 className="font-bold text-[#002844] mb-4" style={{ fontSize: '28px' }}>
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
              {/* V3.16: question 28px bold */}
              <h2 className="font-bold text-[#002844] mb-2" style={{ fontSize: '28px' }}>
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
              ) : currentExercise.type === 'word_order' ? (
                // BUG-83: Word ordering — tap words to build sentence
                <div>
                  {/* Selected words (answer zone) */}
                  <div className="min-h-[52px] p-3 mb-3 rounded-xl border-2 border-[#D9B438] bg-[#D9B438]/5 flex flex-wrap gap-2">
                    {wordOrderSelected.length === 0 && (
                      <span className="text-sm text-[#999] italic">{lang === 'fr' ? 'Tapez les mots ci-dessous...' : 'Tap words below...'}</span>
                    )}
                    {wordOrderSelected.map((w, i) => (
                      <button key={`sel-${i}`} onClick={() => {
                        setWordOrderSelected(prev => prev.filter((_, idx) => idx !== i))
                        setWordOrderPool(prev => [...prev, w])
                      }}
                        className="px-3 py-1.5 rounded-lg bg-[#002844] text-white text-sm font-bold hover:bg-red-500 transition-colors">
                        {w}
                      </button>
                    ))}
                  </div>
                  {/* Available words pool */}
                  <div className="flex flex-wrap gap-2 mb-4">
                    {(wordOrderPool.length === 0 && wordOrderSelected.length === 0
                      ? (currentExercise.options || currentExercise.answer.split(' ').sort(() => Math.random() - 0.5))
                      : wordOrderPool
                    ).map((w, i) => {
                      // Init pool on first render
                      if (wordOrderPool.length === 0 && wordOrderSelected.length === 0 && i === 0) {
                        const initPool = currentExercise.options || currentExercise.answer.split(' ').sort(() => Math.random() - 0.5)
                        setTimeout(() => setWordOrderPool(initPool), 0)
                      }
                      return (
                        <button key={`pool-${i}`} onClick={() => {
                          setWordOrderSelected(prev => [...prev, w])
                          setWordOrderPool(prev => prev.filter((_, idx) => idx !== i))
                        }}
                          className="px-3 py-1.5 rounded-lg bg-white border-2 border-gray-200 text-[#002844] text-sm font-bold hover:border-[#D9B438] transition-colors">
                          {w}
                        </button>
                      )
                    })}
                  </div>
                  <button onClick={() => handleSubmitAnswer(wordOrderSelected.join(' '))}
                    disabled={wordOrderSelected.length === 0}
                    className="w-full py-3 rounded-xl bg-[#002844] text-white font-bold text-sm hover:bg-[#003a5c] transition-colors disabled:opacity-50">
                    {lang === 'fr' ? 'Valider' : 'Submit'}
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
              {/* BLOC 3: Micro-feedback immédiat */}
              <div className="flex items-center gap-2 mb-2">
                {isCorrect
                  ? <CheckCircle className="h-5 w-5 text-green-600" />
                  : <XCircle className="h-5 w-5 text-red-500" />}
                <span className="font-bold text-sm" style={{ color: isCorrect ? '#2E7D32' : '#C62828' }}>
                  {isCorrect
                    ? (lang === 'fr' ? '✔️ Bien joué !' : '✔️ Well done!')
                    : currentExercise.type === 'speaking_repeat'
                    ? (lang === 'fr' ? '💡 Presque — réécoute et réessaie' : '💡 Almost — listen again and retry')
                    : (lang === 'fr' ? '❌ On corrige ensemble' : '❌ Let\'s fix this together')}
                </span>
              </div>
              {/* +1% A1 after correct answer */}
              {isCorrect && (
                <p className="text-[10px] font-bold text-[#D9B438] mb-2 animate-pulse">
                  +1% {lang === 'fr' ? 'du niveau A1' : 'of A1 level'} 🎯
                </p>
              )}

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
