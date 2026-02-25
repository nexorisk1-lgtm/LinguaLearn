'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  Send,
  CheckCircle,
  XCircle,
  AlertCircle,
  BookOpen,
} from 'lucide-react'
import { getCurrentUser } from '@/lib/db/localStorage'
import { InterfaceLanguage, User } from '@/types'
import { t } from '@/lib/i18n'
import {
  getWritingExercises,
  isCloseEnough,
} from '@/lib/db/bankHelpers'
import { WritingExercise } from '@/lib/db/bankTypes'

type ResultType = 'correct' | 'close' | 'incorrect' | null
type FilterTheme = string | null
type FilterLevel = string | null

export default function WritingModule() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [interfaceLang, setInterfaceLang] = useState<InterfaceLanguage>('en')
  const [exercises, setExercises] = useState<WritingExercise[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [filterTheme, setFilterTheme] = useState<FilterTheme>(null)
  const [filterLevel, setFilterLevel] = useState<FilterLevel>(null)
  const [userAnswer, setUserAnswer] = useState('')
  const [result, setResult] = useState<ResultType>(null)
  const [expectedAnswer, setExpectedAnswer] = useState('')
  const [themes, setThemes] = useState<string[]>([])
  const [levels, setLevels] = useState<string[]>([])

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
    const allExercises = getWritingExercises(activeLang, userThemes, userLevel)
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
    setLoading(false)
  }, [router])

  // Filter exercises based on user's active language and filters
  const filteredExercises = exercises.filter((ex) => {
    const langMatch = ex.language === user?.activeLang
    const themeMatch = !filterTheme || ex.theme === filterTheme
    const levelMatch = !filterLevel || ex.level === filterLevel
    return langMatch && themeMatch && levelMatch
  })

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

  const handleSubmit = () => {
    if (!currentExercise || !userAnswer.trim()) return

    const expectedLower = (currentExercise.answer || '').toLowerCase().trim()
    const userLower = userAnswer.toLowerCase().trim()

    if (currentExercise.type === 'free_writing') {
      setResult('close')
      setExpectedAnswer('')
      return
    }

    if (userLower === expectedLower) {
      setResult('correct')
      setExpectedAnswer('')
    } else if (isCloseEnough(userLower, expectedLower)) {
      setResult('close')
      setExpectedAnswer(currentExercise.answer || '')
    } else {
      setResult('incorrect')
      setExpectedAnswer(currentExercise.answer || '')
    }
  }

  const handleNextExercise = () => {
    if (hasMoreExercises) {
      setCurrentIndex(currentIndex + 1)
      setUserAnswer('')
      setResult(null)
      setExpectedAnswer('')
    }
  }

  const getResultIcon = (resultType: ResultType) => {
    switch (resultType) {
      case 'correct':
        return <CheckCircle className="w-6 h-6 text-green-600" />
      case 'close':
        return <AlertCircle className="w-6 h-6 text-orange-500" />
      case 'incorrect':
        return <XCircle className="w-6 h-6 text-red-600" />
      default:
        return null
    }
  }

  const getResultColor = (resultType: ResultType) => {
    switch (resultType) {
      case 'correct':
        return 'bg-green-50 border-green-200'
      case 'close':
        return 'bg-orange-50 border-orange-200'
      case 'incorrect':
        return 'bg-red-50 border-red-200'
      default:
        return ''
    }
  }

  const getResultMessage = (resultType: ResultType) => {
    switch (resultType) {
      case 'correct':
        return t('writing.result.correct', interfaceLang)
      case 'close':
        return t('writing.result.close', interfaceLang)
      case 'incorrect':
        return t('writing.result.incorrect', interfaceLang)
      default:
        return ''
    }
  }

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
              {t('writing.title', interfaceLang)}
            </h1>
            <p className="text-[#555555] text-lg">
              {t('writing.noExercises', interfaceLang)}
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
              {t('writing.title', interfaceLang)}
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
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-[#002844] mb-2">
                {t('writing.instruction', interfaceLang)}
              </h2>
              <p className="text-[#555555] leading-relaxed">
                {interfaceLang === 'fr'
                  ? currentExercise.instruction_fr
                  : currentExercise.instruction_en}
              </p>
            </div>

            {/* Prompt */}
            <div className="mb-6 p-4 bg-blue-50 rounded-lg border-l-4 border-[#D9B438]">
              <p className="text-[#555555] font-medium">
                {currentExercise.prompt}
              </p>
            </div>

            {/* Answer Input */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-[#002844] mb-3">
                {t('writing.yourAnswer', interfaceLang)}
              </label>
              <textarea
                value={userAnswer}
                onChange={(e) => setUserAnswer(e.target.value)}
                disabled={result !== null && currentExercise.type !== 'free_writing'}
                placeholder={t('writing.yourAnswer', interfaceLang)}
                className="w-full px-4 py-3 border border-[#D9B438] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#D9B438] text-[#555555] resize-none disabled:bg-gray-100 disabled:cursor-not-allowed"
                rows={4}
              />
            </div>

            {/* Result Display */}
            {result && (
              <div
                className={`mb-6 p-4 rounded-lg border-2 flex items-start gap-4 ${getResultColor(
                  result
                )}`}
              >
                <div className="mt-1">{getResultIcon(result)}</div>
                <div className="flex-1">
                  <h3 className="font-bold text-[#002844] mb-2">
                    {getResultMessage(result)}
                  </h3>
                  {currentExercise.type === 'free_writing' && (
                    <p className="text-sm text-[#555555]">
                      {t('writing.result.freeWriting', interfaceLang)}
                    </p>
                  )}
                  {expectedAnswer && (
                    <div>
                      <p className="text-sm text-[#555555] mb-1">
                        {t('writing.result.expected', interfaceLang)}
                      </p>
                      <p className="text-sm font-semibold text-[#002844]">
                        {expectedAnswer}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-4">
              {result === null ? (
                <button
                  onClick={handleSubmit}
                  disabled={!userAnswer.trim()}
                  className="flex items-center gap-2 px-6 py-3 bg-[#D9B438] text-[#002844] font-bold rounded-lg hover:bg-[#c9a530] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Send className="w-5 h-5" />
                  {t('writing.submit', interfaceLang)}
                </button>
              ) : (
                <>
                  <button
                    onClick={() => {
                      setResult(null)
                      setUserAnswer('')
                      setExpectedAnswer('')
                    }}
                    className="px-6 py-3 bg-[#555555] text-white font-bold rounded-lg hover:bg-[#333333] transition-colors"
                  >
                    {t('writing.submit', interfaceLang)}
                  </button>
                  {hasMoreExercises && (
                    <button
                      onClick={handleNextExercise}
                      className="flex items-center gap-2 px-6 py-3 bg-[#002844] text-white font-bold rounded-lg hover:bg-[#001a28] transition-colors"
                    >
                      {t('writing.next', interfaceLang)}
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
