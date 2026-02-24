'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getCurrentUser, updateUserProgress, completeOnboarding } from '@/lib/db/localStorage'
import { getDiagnosticQuestions, DiagnosticQuestion } from '@/lib/db/diagnosticBank'
import { User, InterfaceLanguage, scoreToCECRL, scoreToGRC } from '@/types'
import { t } from '@/lib/i18n'
import { CheckCircle, XCircle, ChevronRight } from 'lucide-react'

interface DiagnosticResult {
  cecrlScore: number
  grcScore?: number
  cecrlLevel: string
  grcLevel?: string
}

export default function DiagnosticPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [lang, setLang] = useState<InterfaceLanguage>('fr')
  const [questions, setQuestions] = useState<DiagnosticQuestion[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null)
  const [correctAnswers, setCorrectAnswers] = useState<{ cecrl: number; grc: number }>({ cecrl: 0, grc: 0 })
  const [showFeedback, setShowFeedback] = useState(false)
  const [lastCorrect, setLastCorrect] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const [results, setResults] = useState<DiagnosticResult | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const currentUser = getCurrentUser()
    if (!currentUser) { router.push('/auth'); return }
    if (currentUser.onboardingCompleted) { router.push('/dashboard'); return }

    const learningLang = currentUser.settings?.learningLangs?.[0]
    if (!learningLang) { router.push('/onboarding'); return }

    setLang(currentUser.settings.interfaceLang || 'fr')
    setUser(currentUser)

    const diagnosticQuestions = getDiagnosticQuestions(
      learningLang,
      currentUser.settings.objectives || [],
      currentUser.hasGrcThemes
    )
    setQuestions(diagnosticQuestions)
    setLoading(false)
  }, [router])

  const handleValidate = () => {
    if (selectedAnswer === null || showFeedback) return

    const q = questions[currentIndex]
    const correct = selectedAnswer === q.correctAnswer
    setLastCorrect(correct)
    setShowFeedback(true)

    // Track scores
    const newScores = { ...correctAnswers }
    if (correct) {
      if (q.type === 'cecrl') newScores.cecrl++
      else newScores.grc++
    }
    setCorrectAnswers(newScores)

    setTimeout(() => {
      if (currentIndex < questions.length - 1) {
        setCurrentIndex(prev => prev + 1)
        setSelectedAnswer(null)
        setShowFeedback(false)
      } else {
        // Calculate final results
        const cecrlQs = questions.filter(q => q.type === 'cecrl')
        const grcQs = questions.filter(q => q.type === 'grc')

        // Add current answer to score
        const finalCecrl = q.type === 'cecrl' && correct ? newScores.cecrl : newScores.cecrl
        const finalGrc = q.type === 'grc' && correct ? newScores.grc : newScores.grc

        const cecrlScore = cecrlQs.length > 0 ? (finalCecrl / cecrlQs.length) * 100 : 0
        const cecrlLevel = scoreToCECRL(cecrlScore)

        let grcScore: number | undefined
        let grcLevel: string | undefined
        if (grcQs.length > 0) {
          grcScore = (finalGrc / grcQs.length) * 100
          grcLevel = scoreToGRC(grcScore)
        }

        setResults({ cecrlScore, grcScore, cecrlLevel, grcLevel })
        setShowResults(true)
      }
    }, 1500)
  }

  const handleGoToDashboard = () => {
    if (!user || !results) return

    const learningLang = user.settings.learningLangs[0]

    updateUserProgress(user.id, learningLang, {
      levelCecrl: results.cecrlLevel as 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2',
      levelGrc: results.grcLevel as 'Junior' | 'Intermédiaire' | 'Senior' | 'Expert' | undefined,
      objectiveProgress: {
        grammaire: 0, vocabulaire: 0, lecture: 0, ecrit: 0, oral: 0,
      },
    })

    completeOnboarding(user.id)
    router.push('/dashboard')
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-[#002844]" />
          <p className="text-[#555555]">{t('general.loading', lang)}</p>
        </div>
      </div>
    )
  }

  // Results screen
  if (showResults && results) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-blue-50 to-white p-4">
        <div className="w-full max-w-lg animate-fade-in rounded-2xl bg-white p-8 shadow-xl">
          <h1 className="mb-2 text-center text-3xl font-bold text-[#002844]">
            {t('diagnostic.results', lang)}
          </h1>
          <p className="mb-8 text-center text-[#555555]">
            {lang === 'fr' ? 'Voici vos niveaux déterminés' : 'Here are your determined levels'}
          </p>

          <div className="space-y-4">
            {/* CECRL Result */}
            <div className="rounded-xl border-2 border-[#002844] bg-[#002844]/5 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-[#555555]">{t('diagnostic.cecrl', lang)}</p>
                  <p className="text-lg font-semibold text-[#002844]">{t('diagnostic.yourLevel', lang)}</p>
                </div>
                <span className="rounded-full bg-[#002844] px-6 py-3 text-2xl font-bold text-white">
                  {results.cecrlLevel}
                </span>
              </div>
              <p className="mt-3 text-sm text-[#555555]">Score : {results.cecrlScore.toFixed(0)}%</p>
            </div>

            {/* GRC Result - ONLY if applicable */}
            {results.grcLevel && results.grcScore !== undefined && (
              <div className="rounded-xl border-2 border-[#D9B438] bg-[#D9B438]/10 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-[#555555]">{t('diagnostic.grc', lang)}</p>
                    <p className="text-lg font-semibold text-[#002844]">{t('diagnostic.yourLevel', lang)}</p>
                  </div>
                  <span className="rounded-full bg-[#D9B438] px-6 py-3 text-2xl font-bold text-[#002844]">
                    {results.grcLevel}
                  </span>
                </div>
                <p className="mt-3 text-sm text-[#555555]">Score : {results.grcScore.toFixed(0)}%</p>
              </div>
            )}
          </div>

          <button
            onClick={handleGoToDashboard}
            className="mt-8 flex w-full items-center justify-center gap-2 rounded-xl bg-[#002844] px-6 py-4 text-lg font-semibold text-white transition-all hover:opacity-90 active:scale-[0.98]"
          >
            {t('diagnostic.goToDashboard', lang)}
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>
    )
  }

  // No questions
  if (questions.length === 0) {
    return (
      <div className="flex h-screen items-center justify-center p-4">
        <div className="text-center">
          <p className="mb-4 text-lg text-[#555555]">
            {lang === 'fr' ? 'Aucune question disponible pour vos objectifs.' : 'No questions available for your goals.'}
          </p>
          <button
            onClick={() => { completeOnboarding(user?.id || ''); router.push('/dashboard') }}
            className="btn-primary"
          >
            {t('diagnostic.goToDashboard', lang)}
          </button>
        </div>
      </div>
    )
  }

  // Question screen
  const currentQ = questions[currentIndex]
  const progressPercent = ((currentIndex + 1) / questions.length) * 100

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-blue-50 to-white">
      {/* Header */}
      <div className="bg-white px-4 py-5 shadow-sm">
        <div className="mx-auto max-w-2xl">
          <div className="mb-3 flex items-center justify-between">
            <h1 className="text-xl font-bold text-[#002844]">{t('diagnostic.title', lang)}</h1>
            <span className="text-sm font-medium text-[#555555]">
              {t('diagnostic.question', lang)} {currentIndex + 1} {t('diagnostic.of', lang)} {questions.length}
            </span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-200">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%`, backgroundColor: '#D9B438' }}
            />
          </div>
        </div>
      </div>

      {/* Question */}
      <div className="flex-1 px-4 py-6">
        <div className="mx-auto max-w-2xl">
          <div className="rounded-2xl bg-white p-6 shadow-lg sm:p-8">
            {/* Type badge */}
            <span
              className="mb-4 inline-block rounded-full px-4 py-1 text-sm font-semibold text-white"
              style={{ backgroundColor: currentQ.type === 'cecrl' ? '#002844' : '#D9B438', color: currentQ.type === 'grc' ? '#002844' : '#fff' }}
            >
              {currentQ.type === 'cecrl' ? 'CECRL' : 'GRC / Cyber'}
            </span>

            <h2 className="mb-6 text-lg font-semibold text-[#002844] sm:text-xl">
              {currentQ.question}
            </h2>

            {/* Options */}
            <div className="space-y-3">
              {currentQ.options.map((option, idx) => {
                const isSelected = selectedAnswer === idx
                const isCorrectOption = idx === currentQ.correctAnswer
                const showCorrectFeedback = showFeedback && isCorrectOption
                const showWrongFeedback = showFeedback && isSelected && !isCorrectOption

                return (
                  <button
                    key={idx}
                    onClick={() => !showFeedback && setSelectedAnswer(idx)}
                    disabled={showFeedback}
                    className={`flex w-full items-center rounded-xl border-2 p-4 text-left transition-all ${
                      showCorrectFeedback
                        ? 'border-green-500 bg-green-50'
                        : showWrongFeedback
                          ? 'border-red-500 bg-red-50'
                          : isSelected
                            ? 'border-[#002844] bg-[#002844]/5'
                            : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <span className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border-2 text-sm font-semibold ${
                      isSelected && !showFeedback ? 'border-[#002844] bg-[#002844] text-white' : 'border-gray-300 text-gray-500'
                    }`}>
                      {String.fromCharCode(65 + idx)}
                    </span>
                    <span className="ml-3 flex-1 text-[#002844]">{option}</span>
                    {showCorrectFeedback && <CheckCircle className="h-6 w-6 flex-shrink-0 text-green-500" />}
                    {showWrongFeedback && <XCircle className="h-6 w-6 flex-shrink-0 text-red-500" />}
                  </button>
                )
              })}
            </div>

            {/* Feedback message */}
            {showFeedback && (
              <div className={`mt-4 rounded-lg p-3 text-center font-medium ${lastCorrect ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                {lastCorrect
                  ? (lang === 'fr' ? 'Bonne réponse !' : 'Correct!')
                  : (lang === 'fr' ? 'Mauvaise réponse' : 'Wrong answer')}
              </div>
            )}

            {/* Validate button */}
            <button
              onClick={handleValidate}
              disabled={selectedAnswer === null || showFeedback}
              className="mt-6 w-full rounded-xl px-6 py-3.5 text-lg font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
              style={{
                backgroundColor: selectedAnswer !== null && !showFeedback ? '#D9B438' : '#E5E7EB',
                color: selectedAnswer !== null && !showFeedback ? '#002844' : '#9CA3AF',
              }}
            >
              {t('diagnostic.submit', lang)}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
