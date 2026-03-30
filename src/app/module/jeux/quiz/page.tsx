'use client'

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { getCurrentUser } from '@/lib/db/localStorage'
import { getA1CourseVocabulary } from '@/lib/db/bankA1Courses'
import { User, InterfaceLanguage } from '@/types'
import PageHeader from '@/components/PageHeader'
import BottomNav from '@/components/BottomNav'

interface QuizQuestion {
  id: string
  french: string
  correct: string
  options: string[]
}

interface GameState {
  currentQuestion: number
  score: number
  answered: boolean
  selectedOption: string | null
  isCorrect: boolean | null
}

export default function QuizPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [lang, setLang] = useState<InterfaceLanguage>('fr')
  const [loading, setLoading] = useState(true)
  const [questions, setQuestions] = useState<QuizQuestion[]>([])
  const [gameState, setGameState] = useState<GameState>({
    currentQuestion: 0,
    score: 0,
    answered: false,
    selectedOption: null,
    isCorrect: null,
  })
  const [gameEnded, setGameEnded] = useState(false)
  const [timeLeft, setTimeLeft] = useState(5)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  // Fisher-Yates shuffle
  function shuffleArray<T>(arr: T[]): T[] {
    const shuffled = [...arr]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    return shuffled
  }

  // Initialize game
  useEffect(() => {
    const currentUser = getCurrentUser()
    if (!currentUser) {
      router.push('/auth')
      return
    }
    setUser(currentUser)
    const interfaceLang = currentUser.settings.interfaceLang || 'fr'
    setLang(interfaceLang)

    // Load completed courses and vocabulary
    const aLang = currentUser.activeLang || currentUser.settings.learningLangs[0] || 'en'
    const scoreKey = `lingualearn_course_scores_${currentUser.id}_${aLang}`
    const scores: Record<string, any> = (() => {
      try {
        return JSON.parse(localStorage.getItem(scoreKey) || '{}')
      } catch {
        return {}
      }
    })()
    const completedCourseIds = Object.keys(scores).filter(id => scores[id]?.score >= 60)

    if (completedCourseIds.length === 0) {
      router.push('/module/jeux')
      return
    }

    // Gather all vocabulary from completed courses
    const allVocab: any[] = []
    for (const courseId of completedCourseIds) {
      const vocab = getA1CourseVocabulary(courseId)
      allVocab.push(...vocab)
    }

    if (allVocab.length === 0) {
      router.push('/module/jeux')
      return
    }

    // Build questions
    const shuffledVocab = shuffleArray(allVocab).slice(0, 10)
    const newQuestions: QuizQuestion[] = shuffledVocab.map((word, idx) => {
      const correct = word.word_target
      const distractors = shuffleArray(
        allVocab.filter(w => w.word_target !== correct).map(w => w.word_target)
      ).slice(0, 3)
      const options = shuffleArray([correct, ...distractors])

      return {
        id: `q${idx}`,
        french: word.word_fr,
        correct,
        options,
      }
    })

    setQuestions(newQuestions)
    setLoading(false)
  }, [router])

  // Timer logic
  useEffect(() => {
    if (gameEnded || gameState.answered || questions.length === 0) return

    setTimeLeft(5)

    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          // Time up - mark as wrong
          setGameState(gs => ({
            ...gs,
            answered: true,
            selectedOption: null,
            isCorrect: false,
          }))
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [gameState.currentQuestion, gameEnded, gameState.answered, questions.length])

  const handleSelectOption = (option: string) => {
    if (gameState.answered) return

    const isCorrect = option === questions[gameState.currentQuestion].correct
    setGameState(gs => ({
      ...gs,
      answered: true,
      selectedOption: option,
      isCorrect,
      score: isCorrect ? gs.score + 10 : gs.score,
    }))
  }

  const handleNextQuestion = () => {
    if (gameState.currentQuestion < questions.length - 1) {
      setGameState(gs => ({
        ...gs,
        currentQuestion: gs.currentQuestion + 1,
        answered: false,
        selectedOption: null,
        isCorrect: null,
      }))
    } else {
      setGameEnded(true)
      // Save score
      if (user) {
        const gameScoreKey = `lingualearn_game_score_${user.id}`
        const currentScore = parseInt(localStorage.getItem(gameScoreKey) || '0', 10)
        const newScore = currentScore + gameState.score
        localStorage.setItem(gameScoreKey, newScore.toString())

        // POST to API
        fetch('/api/scores', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: user.id,
            userName: user.firstName,
            score: gameState.score,
            scoreType: 'game',
            source: 'quiz',
          }),
        }).catch(() => {})
      }
    }
  }

  if (loading || !user || questions.length === 0) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#F0F0F0]">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-[#002844]" />
      </div>
    )
  }

  if (gameEnded) {
    return (
      <div className="flex flex-col h-screen bg-[#F0F0F0]">
        <PageHeader
          title={lang === 'fr' ? 'Quiz Rapide - Résultats' : 'Quiz Rapide - Results'}
          backHref="/module/jeux"
        />

        <main className="flex-1 flex items-center justify-center px-4 pb-20">
          <div className="text-center max-w-sm">
            <div className="text-6xl mb-4">🎉</div>
            <p className="text-3xl font-bold text-[#002844] mb-2">
              {gameState.score}/{questions.length * 10}
            </p>
            <p className="text-sm text-gray-600 mb-6">
              {lang === 'fr' ? 'Points gagnés' : 'Points earned'}
            </p>
            <p className="text-lg font-bold text-[#002844] mb-6">
              {gameState.currentQuestion}/{questions.length} {lang === 'fr' ? 'correctes' : 'correct'}
            </p>
            <button
              onClick={() => router.push('/module/jeux')}
              className="w-full bg-[#002844] text-white py-3 rounded-xl font-bold hover:opacity-90 transition-opacity"
            >
              {lang === 'fr' ? 'Retour aux Jeux' : 'Back to Games'}
            </button>
          </div>
        </main>

        <BottomNav lang={lang} />
      </div>
    )
  }

  const currentQ = questions[gameState.currentQuestion]
  const progressPercent = ((gameState.currentQuestion + 1) / questions.length) * 100

  return (
    <div className="flex flex-col h-screen bg-[#F0F0F0]">
      <PageHeader
        title={lang === 'fr' ? 'Quiz Rapide' : 'Quiz Rapide'}
        backHref="/module/jeux"
      />

      {/* Progress bar */}
      <div className="bg-white px-4 py-3 border-b">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-gray-600">
            {gameState.currentQuestion + 1}/{questions.length}
          </span>
          <span className="text-xs font-bold text-[#D9B438]">
            {lang === 'fr' ? 'Score' : 'Score'}: {gameState.score}
          </span>
        </div>
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-[#002844] transition-all"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      <main className="flex-1 flex flex-col items-center justify-center px-4 pb-20">
        <div className="max-w-sm w-full">
          {/* Timer */}
          <div className="mb-6 text-center">
            <div className="relative w-24 h-24 mx-auto mb-4">
              <svg className="w-full h-full transform -rotate-90">
                <circle
                  cx="48"
                  cy="48"
                  r="45"
                  fill="none"
                  stroke="#e5e7eb"
                  strokeWidth="4"
                />
                <circle
                  cx="48"
                  cy="48"
                  r="45"
                  fill="none"
                  stroke={timeLeft <= 2 ? '#ef4444' : '#002844'}
                  strokeWidth="4"
                  strokeDasharray={`${(timeLeft / 5) * 282.7} 282.7`}
                  className="transition-all"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-3xl font-bold text-[#002844]">{timeLeft}</span>
              </div>
            </div>
          </div>

          {/* Question */}
          <h2 className="text-2xl font-bold text-[#002844] mb-6 text-center">
            {lang === 'fr' ? 'Comment dit-on' : 'How do you say'} &quot;<span className="text-[#D9B438]">{currentQ.french}</span>&quot; {lang === 'fr' ? 'en anglais ?' : 'in English?'}
          </h2>

          {/* Options */}
          <div className="space-y-3">
            {currentQ.options.map((option, idx) => {
              const isSelected = gameState.selectedOption === option
              const isCorrectOption = option === currentQ.correct
              let bgClass = 'bg-white hover:bg-gray-50'
              let borderClass = 'border border-gray-200'
              let textClass = 'text-[#002844]'

              if (gameState.answered) {
                if (isCorrectOption) {
                  bgClass = 'bg-green-100'
                  borderClass = 'border-2 border-green-500'
                  textClass = 'text-green-700 font-bold'
                } else if (isSelected && !gameState.isCorrect) {
                  bgClass = 'bg-red-100'
                  borderClass = 'border-2 border-red-500'
                  textClass = 'text-red-700 font-bold'
                } else {
                  bgClass = 'bg-gray-100'
                  borderClass = 'border border-gray-300'
                  textClass = 'text-gray-500'
                }
              } else if (isSelected) {
                bgClass = 'bg-[#002844]'
                borderClass = 'border-2 border-[#002844]'
                textClass = 'text-white font-bold'
              }

              return (
                <button
                  key={idx}
                  onClick={() => handleSelectOption(option)}
                  disabled={gameState.answered}
                  className={`w-full py-3 px-4 rounded-xl font-bold transition-all ${bgClass} ${borderClass} ${textClass} disabled:cursor-not-allowed`}
                >
                  {option}
                </button>
              )
            })}
          </div>

          {/* Next button */}
          {gameState.answered && (
            <button
              onClick={handleNextQuestion}
              className="w-full mt-6 bg-[#D9B438] text-[#002844] py-3 rounded-xl font-bold hover:opacity-90 transition-opacity"
            >
              {gameState.currentQuestion < questions.length - 1
                ? lang === 'fr'
                  ? 'Suivant'
                  : 'Next'
                : lang === 'fr'
                ? 'Voir Résultats'
                : 'See Results'}
            </button>
          )}
        </div>
      </main>

      <BottomNav lang={lang} />
    </div>
  )
}
