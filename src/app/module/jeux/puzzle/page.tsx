'use client'

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getCurrentUser } from '@/lib/db/localStorage'
import { getA1CourseData } from '@/lib/db/bankA1Courses'
import { User, InterfaceLanguage } from '@/types'
import PageHeader from '@/components/PageHeader'
import BottomNav from '@/components/BottomNav'
import { X } from 'lucide-react'

interface Sentence {
  correct: string[]
  example: string
}

interface Round {
  id: string
  words: string[]
  correct: string[]
  example: string
}

export default function PuzzlePage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [lang, setLang] = useState<InterfaceLanguage>('fr')
  const [loading, setLoading] = useState(true)
  const [rounds, setRounds] = useState<Round[]>([])
  const [currentRound, setCurrentRound] = useState(0)
  const [answered, setAnswered] = useState<string[]>([])
  const [score, setScore] = useState(0)
  const [gameEnded, setGameEnded] = useState(false)
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null)

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

    // Load completed courses
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

    // Gather sentences from examples
    const sentences: Sentence[] = []
    for (const courseId of completedCourseIds) {
      const courseData = getA1CourseData(courseId)
      if (courseData && courseData.examples) {
        for (const ex of courseData.examples) {
          if (ex.en) {
            const words = ex.en.split(/\s+/).filter(w => w.length > 0)
            if (words.length > 2) {
              sentences.push({
                correct: words,
                example: ex.en,
              })
            }
          }
        }
      }
    }

    if (sentences.length < 5) {
      router.push('/module/jeux')
      return
    }

    // Build 5 rounds
    const shuffledSentences = shuffleArray(sentences).slice(0, 5)
    const newRounds: Round[] = shuffledSentences.map((sent, idx) => ({
      id: `r${idx}`,
      words: shuffleArray([...sent.correct]),
      correct: sent.correct,
      example: sent.example,
    }))

    setRounds(newRounds)
    setLoading(false)
  }, [router])

  const handleSelectWord = (word: string) => {
    setAnswered([...answered, word])
  }

  const handleRemoveWord = () => {
    if (answered.length > 0) {
      setAnswered(answered.slice(0, -1))
    }
  }

  const handleSubmit = () => {
    const round = rounds[currentRound]
    const isCorrect =
      answered.length === round.correct.length &&
      answered.every((w, idx) => w === round.correct[idx])

    setFeedback(isCorrect ? 'correct' : 'wrong')

    if (isCorrect) {
      setScore(score + 20)

      setTimeout(() => {
        if (currentRound < rounds.length - 1) {
          setCurrentRound(currentRound + 1)
          setAnswered([])
          setFeedback(null)
        } else {
          setGameEnded(true)
          // Save score
          if (user) {
            const totalScore = score + 20
            const gameScoreKey = `lingualearn_game_score_${user.id}`
            const currentScore = parseInt(localStorage.getItem(gameScoreKey) || '0', 10)
            const newScore = currentScore + totalScore
            localStorage.setItem(gameScoreKey, newScore.toString())

            fetch('/api/scores', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                userId: user.id,
                userName: user.firstName,
                score: totalScore,
                scoreType: 'game',
                source: 'puzzle',
              }),
            }).catch(() => {})
          }
        }
      }, 1500)
    }
  }

  if (loading || !user || rounds.length === 0) {
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
          title={lang === 'fr' ? 'Puzzle Phrase - Résultats' : 'Puzzle Phrase - Results'}
          backHref="/module/jeux"
        />

        <main className="flex-1 flex items-center justify-center px-4 pb-20">
          <div className="text-center max-w-sm">
            <div className="text-6xl mb-4">🎉</div>
            <p className="text-3xl font-bold text-[#002844] mb-2">
              {score} {lang === 'fr' ? 'points' : 'points'}
            </p>
            <p className="text-lg font-bold text-[#002844] mb-6">
              {rounds.length}/{rounds.length} {lang === 'fr' ? 'phrases correctes' : 'sentences correct'}
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

  const round = rounds[currentRound]
  const remainingWords = round.words.filter(w => !answered.includes(w))
  const isComplete = answered.length === round.correct.length
  const progressPercent = ((currentRound + 1) / rounds.length) * 100

  return (
    <div className="flex flex-col h-screen bg-[#F0F0F0]">
      <PageHeader
        title={lang === 'fr' ? 'Puzzle Phrase' : 'Puzzle Phrase'}
        backHref="/module/jeux"
      />

      {/* Progress */}
      <div className="bg-white px-4 py-3 border-b">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-gray-600">
            {currentRound + 1}/{rounds.length}
          </span>
          <span className="text-xs font-bold text-[#D9B438]">
            {lang === 'fr' ? 'Score' : 'Score'}: {score}
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
          <p className="text-xs text-center text-gray-600 mb-4">
            {lang === 'fr' ? 'Reconstitue la phrase' : 'Rebuild the sentence'}
          </p>

          {/* Answer area */}
          <div className="bg-white rounded-xl p-4 mb-6 min-h-[100px] border-2 border-[#D9B438]">
            {answered.length === 0 ? (
              <p className="text-gray-400 text-center text-sm">
                {lang === 'fr' ? 'Tapez les mots dans le bon ordre' : 'Tap words in the correct order'}
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {answered.map((word, idx) => (
                  <div
                    key={idx}
                    className={`px-3 py-1 rounded-full text-sm font-bold ${
                      feedback === 'correct'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-[#002844] text-white'
                    }`}
                  >
                    {word}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Feedback */}
          {feedback && (
            <div
              className={`text-center text-sm font-bold mb-4 py-2 rounded-lg ${
                feedback === 'correct'
                  ? 'bg-green-100 text-green-700'
                  : 'bg-red-100 text-red-700'
              }`}
            >
              {feedback === 'correct'
                ? lang === 'fr'
                  ? '✓ Correct !'
                  : '✓ Correct!'
                : lang === 'fr'
                ? '✗ Essaie encore'
                : '✗ Try again'}
            </div>
          )}

          {/* Word chips */}
          <div className="flex flex-wrap gap-2 justify-center mb-6">
            {remainingWords.map((word, idx) => (
              <button
                key={idx}
                onClick={() => handleSelectWord(word)}
                disabled={feedback !== null}
                className="px-3 py-2 rounded-full bg-white border-2 border-gray-300 text-[#002844] font-bold text-sm hover:border-[#002844] transition-all disabled:opacity-50"
              >
                {word}
              </button>
            ))}
          </div>

          {/* Controls */}
          <div className="flex gap-3">
            <button
              onClick={handleRemoveWord}
              disabled={answered.length === 0 || feedback !== null}
              className="flex-1 py-3 px-4 rounded-xl bg-white border-2 border-gray-300 text-gray-600 font-bold hover:border-red-500 transition-all disabled:opacity-50"
            >
              <X className="h-4 w-4 mx-auto" />
            </button>
            <button
              onClick={handleSubmit}
              disabled={!isComplete || feedback !== null}
              className={`flex-1 py-3 px-4 rounded-xl font-bold transition-all disabled:opacity-50 ${
                feedback === 'correct'
                  ? 'bg-green-500 text-white'
                  : isComplete
                  ? 'bg-[#D9B438] text-[#002844] hover:opacity-90'
                  : 'bg-gray-300 text-gray-500'
              }`}
            >
              {lang === 'fr' ? 'Valider' : 'Submit'}
            </button>
          </div>
        </div>
      </main>

      <BottomNav lang={lang} />
    </div>
  )
}
