'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getCurrentUser, updateUserProgress } from '@/lib/db/localStorage'
import { InterfaceLanguage, User } from '@/types'
import { t } from '@/lib/i18n'
import {
  getGrammarRules,
  getExercisesForRule,
  getIrregularVerbs,
  speakText,
  BANK_VERB_EXERCISES,
} from '@/lib/db/bankHelpers'
import {
  GrammarRule,
  GrammarExercise,
  IrregularVerb,
} from '@/lib/db/bankTypes'
import { VerbExercise } from '@/lib/db/bankGrammar'
import GrammarCarousel from '@/components/exercises/GrammarCarousel'
import {
  ArrowLeft,
  Volume2,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  XCircle,
  BookOpen,
  Play,
} from 'lucide-react'

type TabType = 'rules' | 'exercises' | 'irregularVerbs'

interface ExerciseState {
  currentIndex: number
  answered: boolean
  isCorrect: boolean | null
  userAnswer: string | string[] | null
  correctCount: number
  totalCount: number
}

export default function GrammairePage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [interfaceLang, setInterfaceLang] = useState<InterfaceLanguage>('fr')

  const [activeTab, setActiveTab] = useState<TabType>('rules')
  const [selectedRuleId, setSelectedRuleId] = useState<string | null>(null)
  const [expandedRuleId, setExpandedRuleId] = useState<string | null>(null)
  const [showingLesson, setShowingLesson] = useState(true)

  const [grammarRules, setGrammarRules] = useState<GrammarRule[]>([])
  const [exercises, setExercises] = useState<GrammarExercise[]>([])
  const [verbExercises, setVerbExercises] = useState<VerbExercise[]>([])
  const [irregularVerbs, setIrregularVerbs] = useState<IrregularVerb[]>([])
  const [verbGroupFilter, setVerbGroupFilter] = useState<string>('all')
  const [verbAssessment, setVerbAssessment] = useState<Record<string, string>>({})

  const [exerciseState, setExerciseState] = useState<ExerciseState>({
    currentIndex: 0,
    answered: false,
    isCorrect: null,
    userAnswer: null,
    correctCount: 0,
    totalCount: 0,
  })

  // Load user and data
  useEffect(() => {
    const loadedUser = getCurrentUser()
    if (!loadedUser) {
      router.push('/auth')
      return
    }

    setUser(loadedUser)
    const lang = loadedUser.settings?.interfaceLang || 'fr'
    setInterfaceLang(lang)

    const activeLang = loadedUser.activeLang || loadedUser.settings.learningLangs[0] || 'en'
    const userLevel = loadedUser.progress?.[activeLang]?.levelCecrl || 'A1'

    // Load grammar rules
    const rules = getGrammarRules(activeLang, userLevel)
    setGrammarRules(rules)

    // Load irregular verbs if English
    if (activeLang === 'en') {
      const verbs = getIrregularVerbs()
      setIrregularVerbs(verbs)
      // Load verb exercises
      setVerbExercises(BANK_VERB_EXERCISES)

      // Load verb assessment from localStorage
      const assessKey = `lingualearn_verb_assessment_${loadedUser?.id}_${activeLang}`
      const stored = localStorage.getItem(assessKey)
      if (stored) {
        try {
          setVerbAssessment(JSON.parse(stored))
        } catch {
          setVerbAssessment({})
        }
      }
    }

    setLoading(false)
  }, [router])

  // Load exercises when rule is selected
  useEffect(() => {
    if (selectedRuleId) {
      const ruleExercises = getExercisesForRule(selectedRuleId)
      setExercises(ruleExercises)
      setShowingLesson(true)
      setExerciseState({
        currentIndex: 0,
        answered: false,
        isCorrect: null,
        userAnswer: null,
        correctCount: 0,
        totalCount: ruleExercises.length,
      })
    }
  }, [selectedRuleId])

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white flex items-center justify-center">
        <div className="text-center">
          <BookOpen className="w-12 h-12 mx-auto mb-4" style={{ color: '#002844' }} />
          <p className="text-gray-500">Chargement...</p>
        </div>
      </div>
    )
  }

  const activeLang = user?.activeLang || user?.settings.learningLangs[0] || 'en'
  const userLevel = user?.progress?.[activeLang]?.levelCecrl || 'A1'

  // Filter grammar rules
  const filteredRules = grammarRules.filter(
    (rule) => rule.language === activeLang && rule.level === userLevel
  )

  // Get current exercise
  const currentExercise =
    exercises.length > 0 ? exercises[exerciseState.currentIndex] : null

  const handleCheckAnswer = () => {
    if (!currentExercise) return

    let isCorrect = false
    let userAnswer: string | string[] | null = null

    if (currentExercise.type === 'fill_blank') {
      const input = (document.getElementById('fill-blank-input') as HTMLInputElement)?.value
      userAnswer = input?.trim().toLowerCase()
      isCorrect =
        userAnswer ===
        (currentExercise.answer as string)?.toLowerCase()
    } else if (currentExercise.type === 'multiple_choice') {
      const selected = document.querySelector('input[name="multiple-choice"]:checked') as HTMLInputElement
      userAnswer = selected?.value
      isCorrect = userAnswer === currentExercise.answer
    } else if (currentExercise.type === 'reorder') {
      const selected = Array.from(
        document.querySelectorAll('input[name="reorder"]:checked') as NodeListOf<HTMLInputElement>
      )
        .map((el) => el.value)
        .join(' ')
      userAnswer = selected
      isCorrect =
        selected.toLowerCase() ===
        (currentExercise.answer as string)?.toLowerCase()
    }

    const newCorrectCount = isCorrect ? exerciseState.correctCount + 1 : exerciseState.correctCount
    setExerciseState((prev) => ({
      ...prev,
      answered: true,
      isCorrect,
      userAnswer,
      correctCount: newCorrectCount,
    }))
  }

  const handleNextExercise = () => {
    if (exerciseState.currentIndex < exercises.length - 1) {
      setExerciseState({
        currentIndex: exerciseState.currentIndex + 1,
        answered: false,
        isCorrect: null,
        userAnswer: null,
        correctCount: exerciseState.correctCount,
        totalCount: exerciseState.totalCount,
      })
    } else {
      // All exercises completed, update progress
      if (user && exercises.length > 0) {
        const grammaireProgress = Math.round((exerciseState.correctCount / exercises.length) * 100)
        updateUserProgress(user.id, activeLang, {
          objectiveProgress: {
            ...user.progress?.[activeLang]?.objectiveProgress,
            grammaire: grammaireProgress,
          },
        })
      }
      // Reset to first exercise
      setExerciseState({
        currentIndex: 0,
        answered: false,
        isCorrect: null,
        userAnswer: null,
        correctCount: 0,
        totalCount: exercises.length,
      })
    }
  }

  const handlePlayExample = (example: string) => {
    speakText(example, activeLang)
  }

  const handleSpeakVerb = (base: string, past?: string, pastParticiple?: string) => {
    if (past && pastParticiple) {
      const allForms = `${base}, ${past}, ${pastParticiple}`
      speakText(allForms, 'en')
    } else {
      speakText(base, 'en')
    }
  }

  const filteredVerbs = irregularVerbs.filter((verb) => {
    if (verbGroupFilter === 'all') return true
    return verb.group === verbGroupFilter
  })

  // AMÉLIORATION P1: Function to assess verb knowledge
  const assessVerb = (verbId: string, status: string) => {
    const updated = { ...verbAssessment, [verbId]: status }
    setVerbAssessment(updated)
    if (user && activeLang) {
      localStorage.setItem(`lingualearn_verb_assessment_${user.id}_${activeLang}`, JSON.stringify(updated))
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/dashboard')}
              className="p-2 hover:bg-gray-100 rounded-lg transition"
              aria-label={t('module.back', interfaceLang)}
            >
              <ArrowLeft className="w-5 h-5" style={{ color: '#002844' }} />
            </button>
            <h1 className="text-3xl font-bold" style={{ color: '#002844' }}>
              {t('grammar.title', interfaceLang)}
            </h1>
          </div>
          <span className="px-3 py-1 bg-blue-100 rounded-full text-sm font-medium" style={{ color: '#002844' }}>
            {activeLang.toUpperCase()} • {userLevel}
          </span>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Tabs */}
        <div className="flex gap-4 mb-8 border-b border-gray-200">
          <button
            onClick={() => setActiveTab('rules')}
            className={`pb-3 px-4 font-medium transition ${
              activeTab === 'rules'
                ? 'border-b-2'
                : 'text-gray-600 hover:text-gray-900'
            }`}
            style={
              activeTab === 'rules'
                ? { color: '#D9B438', borderColor: '#D9B438' }
                : {}
            }
          >
            {t('grammar.rules', interfaceLang)}
          </button>
          <button
            onClick={() => setActiveTab('exercises')}
            className={`pb-3 px-4 font-medium transition ${
              activeTab === 'exercises'
                ? 'border-b-2'
                : 'text-gray-600 hover:text-gray-900'
            }`}
            style={
              activeTab === 'exercises'
                ? { color: '#D9B438', borderColor: '#D9B438' }
                : {}
            }
          >
            {t('grammar.exercises', interfaceLang)}
          </button>
          {activeLang === 'en' && (
            <button
              onClick={() => setActiveTab('irregularVerbs')}
              className={`pb-3 px-4 font-medium transition ${
                activeTab === 'irregularVerbs'
                  ? 'border-b-2'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
              style={
                activeTab === 'irregularVerbs'
                  ? { color: '#D9B438', borderColor: '#D9B438' }
                  : {}
              }
            >
              {t('grammar.irregularVerbs', interfaceLang)}
            </button>
          )}
        </div>

        {/* Rules Tab */}
        {activeTab === 'rules' && (
          <div className="space-y-6">
            {filteredRules.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-lg">
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
            ) : (
              <>
                {/* Grammar Carousel */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <h2 style={{ color: '#002844' }} className="text-lg font-bold mb-4">
                    {interfaceLang === 'fr' ? 'Votre progression' : 'Your progress'}
                  </h2>
                  {user && (
                    <GrammarCarousel
                      rules={filteredRules}
                      user={user}
                      activeLang={activeLang}
                      lang={interfaceLang}
                      onSelectRule={(ruleId) => {
                        setSelectedRuleId(ruleId)
                        setActiveTab('exercises')
                      }}
                    />
                  )}
                </div>

                {/* Rules Details (Accordion) */}
                <div className="space-y-4">
                  <h2 style={{ color: '#002844' }} className="text-lg font-bold">
                    {interfaceLang === 'fr' ? 'Détails des règles' : 'Rule details'}
                  </h2>
                  {filteredRules.map((rule) => (
                <div
                  key={rule.id}
                  className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden"
                >
                  <button
                    onClick={() =>
                      setExpandedRuleId(
                        expandedRuleId === rule.id ? null : rule.id
                      )
                    }
                    className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition"
                  >
                    <div className="flex items-center gap-4">
                      {expandedRuleId === rule.id ? (
                        <ChevronUp
                          className="w-5 h-5"
                          style={{ color: '#D9B438' }}
                        />
                      ) : (
                        <ChevronDown
                          className="w-5 h-5"
                          style={{ color: '#D9B438' }}
                        />
                      )}
                      <div className="text-left">
                        <h3
                          className="font-semibold text-lg"
                          style={{ color: '#002844' }}
                        >
                          {rule.rule_name}
                        </h3>
                      </div>
                    </div>
                    <span
                      className="px-3 py-1 bg-yellow-100 rounded-full text-sm font-medium"
                      style={{ color: '#D9B438' }}
                    >
                      {rule.level}
                    </span>
                  </button>

                  {expandedRuleId === rule.id && (
                    <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 space-y-4">
                      <div>
                        <h4
                          className="font-semibold text-sm mb-2"
                          style={{ color: '#002844' }}
                        >
                          {t('grammar.definition', interfaceLang)}
                        </h4>
                        <p style={{ color: '#555555' }} className="mb-3">
                          {rule.definition_en}
                        </p>
                        {rule.definition_fr && (
                          <p style={{ color: '#555555' }}>
                            <span className="font-medium">FR:</span> {rule.definition_fr}
                          </p>
                        )}
                      </div>

                      {rule.attention_points && rule.attention_points.length > 0 && (
                        <div>
                          <h4
                            className="font-semibold text-sm mb-2"
                            style={{ color: '#002844' }}
                          >
                            {t('grammar.attention', interfaceLang)}
                          </h4>
                          <ul className="space-y-1">
                            {Array.isArray(rule.attention_points) ? (
                              rule.attention_points.map((point, idx) => (
                                <li
                                  key={idx}
                                  style={{ color: '#555555' }}
                                  className="text-sm"
                                >
                                  • {point}
                                </li>
                              ))
                            ) : (
                              <p style={{ color: '#555555' }}>
                                {rule.attention_points}
                              </p>
                            )}
                          </ul>
                        </div>
                      )}

                      {rule.examples && rule.examples.length > 0 && (
                        <div>
                          <h4
                            className="font-semibold text-sm mb-3"
                            style={{ color: '#002844' }}
                          >
                            {t('grammar.examples', interfaceLang)}
                          </h4>
                          <ul className="space-y-2">
                            {rule.examples.map((example, idx) => ( // eslint-disable-line @typescript-eslint/no-unused-vars
                              <li
                                key={idx}
                                className="flex items-center justify-between p-3 bg-white rounded border border-gray-200"
                              >
                                <div className="flex-1">
                                  <p style={{ color: '#002844' }} className="text-sm font-medium">
                                    {example.en}
                                  </p>
                                  <p style={{ color: '#555555' }} className="text-xs mt-1">
                                    {example.fr}
                                  </p>
                                </div>
                                <button
                                  onClick={() => handlePlayExample(example.en)}
                                  className="p-2 hover:bg-gray-100 rounded transition"
                                  aria-label="Écouter"
                                >
                                  <Volume2
                                    className="w-4 h-4"
                                    style={{ color: '#D9B438' }}
                                  />
                                </button>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <button
                        onClick={() => {
                          setSelectedRuleId(rule.id)
                          setActiveTab('exercises')
                        }}
                        className="w-full mt-4 px-4 py-2 rounded-lg font-medium text-white transition hover:opacity-90 flex items-center justify-center gap-2"
                        style={{ backgroundColor: '#002844' }}
                      >
                        <Play className="w-4 h-4" />
                        {t('grammar.exercise.next', interfaceLang) || 'Pratiquer'}
                      </button>
                    </div>
                  )}
                </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Exercises Tab */}
        {activeTab === 'exercises' && (
          <div>
            {!selectedRuleId && exercises.length === 0 && (activeLang !== 'en' || verbExercises.length === 0) ? (
              <div className="text-center py-12 bg-white rounded-lg">
                <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p style={{ color: '#555555' }}>
                  {interfaceLang === 'fr'
                    ? 'Sélectionnez une règle pour voir les exercices'
                    : 'Select a rule to see exercises'}
                </p>
              </div>
            ) : (
              <div className="space-y-8">
                {/* Grammar Rule Lesson Phase */}
                {selectedRuleId && exercises.length > 0 && showingLesson && (() => {
                  const selectedRule = grammarRules.find((r) => r.id === selectedRuleId)
                  if (!selectedRule) return null
                  return (
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                      <div className="mb-6">
                        <h2 className="text-3xl font-bold mb-4" style={{ color: '#002844' }}>
                          {selectedRule.rule_name}
                        </h2>
                        <div className="space-y-4">
                          <div>
                            <h3 className="font-semibold text-lg mb-2" style={{ color: '#D9B438' }}>
                              {interfaceLang === 'fr' ? 'Définition' : 'Definition'}
                            </h3>
                            <p style={{ color: '#555555' }} className="text-base mb-3">
                              {selectedRule.definition_en}
                            </p>
                            {selectedRule.definition_fr && (
                              <p style={{ color: '#555555' }} className="text-base">
                                <span className="font-medium">FR:</span> {selectedRule.definition_fr}
                              </p>
                            )}
                          </div>

                          {selectedRule.attention_points && selectedRule.attention_points.length > 0 && (
                            <div>
                              <h3 className="font-semibold text-lg mb-2" style={{ color: '#D9B438' }}>
                                {interfaceLang === 'fr' ? 'Points importants' : 'Important points'}
                              </h3>
                              <ul className="space-y-2">
                                {Array.isArray(selectedRule.attention_points) ? (
                                  selectedRule.attention_points.map((point, idx) => (
                                    <li key={idx} style={{ color: '#555555' }} className="text-sm">
                                      • {point}
                                    </li>
                                  ))
                                ) : (
                                  <li style={{ color: '#555555' }}>{selectedRule.attention_points}</li>
                                )}
                              </ul>
                            </div>
                          )}

                          {selectedRule.examples && selectedRule.examples.length > 0 && (
                            <div>
                              <h3 className="font-semibold text-lg mb-3" style={{ color: '#D9B438' }}>
                                {interfaceLang === 'fr' ? 'Exemples' : 'Examples'}
                              </h3>
                              <ul className="space-y-3">
                                {selectedRule.examples.map((example, idx) => (
                                  <li key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded border border-gray-200">
                                    <div className="flex-1">
                                      <p style={{ color: '#002844' }} className="text-sm font-medium">
                                        {example.en}
                                      </p>
                                      <p style={{ color: '#555555' }} className="text-xs mt-1">
                                        {example.fr}
                                      </p>
                                    </div>
                                    <button
                                      onClick={() => handlePlayExample(example.en)}
                                      className="p-2 hover:bg-white rounded transition"
                                      aria-label="Écouter"
                                    >
                                      <Volume2 className="w-4 h-4" style={{ color: '#D9B438' }} />
                                    </button>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </div>

                      <button
                        onClick={() => setShowingLesson(false)}
                        className="w-full py-3 rounded-lg font-bold text-white transition hover:opacity-90 flex items-center justify-center gap-2"
                        style={{ backgroundColor: '#002844' }}
                      >
                        <Play className="w-4 h-4" />
                        {interfaceLang === 'fr' ? 'Commencer les exercices' : 'Start exercises'}
                      </button>
                    </div>
                  )
                })()}

                {/* Grammar Rule Exercises */}
                {selectedRuleId && exercises.length > 0 && !showingLesson && (
                  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                {/* Score */}
                <div className="flex justify-between items-center mb-6">
                  <h2
                    className="text-2xl font-bold"
                    style={{ color: '#002844' }}
                  >
                    {exercises[exerciseState.currentIndex]?.question}
                  </h2>
                  <span
                    className="text-lg font-semibold"
                    style={{ color: '#D9B438' }}
                  >
                    {exerciseState.correctCount} / {exerciseState.totalCount}
                  </span>
                </div>

                {/* Exercise Content */}
                <div className="mb-8 p-6 bg-blue-50 rounded-lg">
                  {currentExercise?.type === 'fill_blank' && (
                    <div className="space-y-4">
                      <p style={{ color: '#555555' }} className="text-lg mb-4">
                        {currentExercise.question}
                      </p>
                      <input
                        id="fill-blank-input"
                        type="text"
                        placeholder={
                          interfaceLang === 'fr'
                            ? 'Votre réponse...'
                            : 'Your answer...'
                        }
                        className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-yellow-400"
                        style={{ color: '#555555' }}
                        disabled={exerciseState.answered}
                      />
                    </div>
                  )}

                  {currentExercise?.type === 'multiple_choice' && (
                    <div className="space-y-4">
                      <p style={{ color: '#555555' }} className="text-lg mb-6">
                        {currentExercise.question}
                      </p>
                      <div className="space-y-3">
                        {(
                          currentExercise.options as string[]
                        )?.map((option, idx) => (
                          <label
                            key={idx}
                            className="flex items-center p-4 border-2 border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer transition"
                          >
                            <input
                              type="radio"
                              name="multiple-choice"
                              value={option}
                              disabled={exerciseState.answered}
                              className="w-4 h-4"
                            />
                            <span
                              className="ml-3"
                              style={{ color: '#555555' }}
                            >
                              {option}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  {currentExercise?.type === 'reorder' && (
                    <div className="space-y-4">
                      <p style={{ color: '#555555' }} className="text-lg mb-6">
                        {currentExercise.question}
                      </p>
                      <div className="flex flex-wrap gap-3">
                        {(
                          currentExercise.options as string[]
                        )?.map((word, idx) => (
                          <label
                            key={idx}
                            className="flex items-center px-4 py-2 bg-white border-2 border-gray-300 rounded-lg hover:border-yellow-400 cursor-pointer transition"
                          >
                            <input
                              type="checkbox"
                              name="reorder"
                              value={word}
                              disabled={exerciseState.answered}
                              className="w-4 h-4"
                            />
                            <span
                              className="ml-2"
                              style={{ color: '#555555' }}
                            >
                              {word}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Feedback */}
                {exerciseState.answered && (
                  <div className="space-y-4 mb-6">
                    <div
                      className={`p-4 rounded-lg flex items-center gap-3 ${
                        exerciseState.isCorrect
                          ? 'bg-green-50'
                          : 'bg-red-50'
                      }`}
                    >
                      {exerciseState.isCorrect ? (
                        <>
                          <CheckCircle className="w-6 h-6 text-green-600" />
                          <span
                            className="font-semibold"
                            style={{ color: '#002844' }}
                          >
                            {t('grammar.exercise.correct', interfaceLang) ||
                              'Correct!'}
                          </span>
                        </>
                      ) : (
                        <>
                          <XCircle className="w-6 h-6 text-red-600" />
                          <div className="flex-1">
                            <p
                              className="font-semibold"
                              style={{ color: '#002844' }}
                            >
                              {t('grammar.exercise.incorrect', interfaceLang) ||
                                'Incorrect'}
                            </p>
                            <p style={{ color: '#555555' }} className="text-sm mt-1">
                              {t('grammar.exercise.expected', interfaceLang) ||
                                'Expected'}
                              : {currentExercise?.answer}
                            </p>
                          </div>
                        </>
                      )}
                    </div>

                    {!exerciseState.isCorrect && selectedRuleId && (
                      <div className="bg-yellow-50 border-l-4 rounded-lg p-4" style={{ borderColor: '#D9B438' }}>
                        <p style={{ color: '#555555' }} className="text-sm">
                          <span className="font-semibold">{interfaceLang === 'fr' ? 'Rappel : ' : 'Reminder: '}</span>
                          {grammarRules.find(r => r.id === selectedRuleId)?.[interfaceLang === 'fr' ? 'definition_fr' : 'definition_en'] ||
                            (interfaceLang === 'fr' ? 'Revoir la règle' : 'Review the rule')}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-4">
                  <button
                    onClick={() => {
                      setSelectedRuleId(null)
                      setActiveTab('rules')
                    }}
                    className="px-4 py-3 rounded-lg font-semibold border-2 border-gray-300 text-gray-700 transition hover:border-yellow-400"
                  >
                    {interfaceLang === 'fr' ? 'Retour aux règles' : 'Back to rules'}
                  </button>
                  {!exerciseState.answered ? (
                    <button
                      onClick={handleCheckAnswer}
                      className="flex-1 px-4 py-3 rounded-lg font-semibold text-white transition hover:opacity-90"
                      style={{ backgroundColor: '#002844' }}
                    >
                      {t('grammar.exercise.check', interfaceLang) || 'Vérifier'}
                    </button>
                  ) : (
                    <button
                      onClick={handleNextExercise}
                      className="flex-1 px-4 py-3 rounded-lg font-semibold text-white transition hover:opacity-90 flex items-center justify-center gap-2"
                      style={{ backgroundColor: '#002844' }}
                    >
                      <Play className="w-4 h-4" />
                      {exerciseState.currentIndex < exercises.length - 1
                        ? t('grammar.exercise.next', interfaceLang) || 'Suivant'
                        : interfaceLang === 'fr'
                          ? 'Recommencer'
                          : 'Restart'}
                    </button>
                  )}
                </div>
                  </div>
                )}

              </div>
            )}
          </div>
        )}

        {/* Irregular Verbs Tab */}
        {activeTab === 'irregularVerbs' && activeLang === 'en' && (
          <div className="space-y-8">
            {/* Introduction Block */}
            <div className="bg-blue-50 border-l-4 rounded-lg p-6" style={{ borderColor: '#D9B438' }}>
              <h3 className="font-bold text-lg mb-3" style={{ color: '#002844' }}>
                {interfaceLang === 'fr' ? 'Comment fonctionnent les verbes irréguliers ?' : 'How do irregular verbs work?'}
              </h3>
              <p style={{ color: '#555555' }} className="text-sm mb-3">
                {interfaceLang === 'fr'
                  ? 'Les verbes irréguliers ne suivent pas les règles de conjugaison standard en anglais. Ils ont 3 formes principales:'
                  : 'Irregular verbs do not follow standard English conjugation rules. They have 3 main forms:'}
              </p>
              <ul className="space-y-2 text-sm" style={{ color: '#555555' }}>
                <li className="flex gap-3">
                  <strong style={{ color: '#002844' }}>Base:</strong>
                  <span>{interfaceLang === 'fr' ? 'La forme infinitive (ex: go, eat, be)' : 'The infinitive form (e.g. go, eat, be)'}</span>
                </li>
                <li className="flex gap-3">
                  <strong style={{ color: '#002844' }}>Prétérit:</strong>
                  <span>{interfaceLang === 'fr' ? 'Le passé simple (ex: went, ate, was)' : 'The past tense (e.g. went, ate, was)'}</span>
                </li>
                <li className="flex gap-3">
                  <strong style={{ color: '#002844' }}>Participe passé:</strong>
                  <span>{interfaceLang === 'fr' ? 'Utilisé avec have/be (ex: gone, eaten, been)' : 'Used with have/be (e.g. gone, eaten, been)'}</span>
                </li>
              </ul>
            </div>

            {/* Verb Exercises Section */}
            {verbExercises.length > 0 && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h2 className="text-2xl font-bold mb-6" style={{ color: '#002844' }}>
                  {interfaceLang === 'fr' ? 'Exercices' : 'Exercises'}
                </h2>
                <p className="text-sm mb-6" style={{ color: '#555555' }}>
                  {interfaceLang === 'fr'
                    ? 'Complétez les formes manquantes des verbes irréguliers'
                    : 'Complete the missing forms of irregular verbs'}
                </p>
                <div className="space-y-6">
                  {['AAA', 'ABB', 'ABC', 'ABA'].map((group) => {
                    const groupExercises = verbExercises.filter(e => e.group === group)
                    return groupExercises.length > 0 ? (
                      <div key={group}>
                        <h3 className="font-semibold text-lg mb-4" style={{ color: '#002844' }}>
                          Groupe {group}
                        </h3>
                        <div className="space-y-4">
                          {groupExercises.map((exercise) => (
                            <div key={exercise.id} className="p-4 bg-blue-50 rounded-lg border border-gray-200">
                              <p style={{ color: '#555555' }} className="font-medium mb-2">
                                {exercise.question_type === 'fill_past'
                                  ? (interfaceLang === 'fr' ? 'Forme prétérit :' : 'Past tense form:')
                                  : exercise.question_type === 'fill_participle'
                                    ? (interfaceLang === 'fr' ? 'Participe passé :' : 'Past participle:')
                                    : (interfaceLang === 'fr' ? 'Remplissez les deux formes :' : 'Fill both forms:')}
                              </p>
                              <p style={{ color: '#002844' }} className="text-lg font-semibold">
                                {exercise.verb_base} / ___ / ___
                              </p>
                              <p style={{ color: '#555555' }} className="text-sm mt-2 italic">
                                {interfaceLang === 'fr' ? 'Indice : ' : 'Hint: '}
                                {exercise.hint_fr}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null
                  })}
                </div>
              </div>
            )}

            {/* Filter */}
            <div className="flex gap-3 flex-wrap items-center">
              {['all', 'AAA', 'ABB', 'ABC', 'ABA'].map((group) => (
                <button
                  key={group}
                  onClick={() => setVerbGroupFilter(group)}
                  className={`px-4 py-2 rounded-lg font-medium transition ${
                    verbGroupFilter === group
                      ? 'text-white'
                      : 'bg-white border-2 border-gray-300 text-gray-700 hover:border-yellow-400'
                  }`}
                  style={
                    verbGroupFilter === group
                      ? { backgroundColor: '#002844' }
                      : {}
                  }
                >
                  {group === 'all'
                    ? interfaceLang === 'fr'
                      ? 'Tous'
                      : 'All'
                    : group}
                </button>
              ))}
            </div>

            {/* Exercise button for selected group */}
            {verbGroupFilter !== 'all' && (
              <button
                onClick={() => {
                  const groupExercises = verbExercises.filter(e => e.group === verbGroupFilter)
                  if (groupExercises.length > 0) {
                    setActiveTab('exercises')
                  }
                }}
                className="px-6 py-3 rounded-lg font-semibold text-white flex items-center gap-2 hover:opacity-90 transition-opacity"
                style={{ backgroundColor: '#002844' }}
              >
                <Play className="w-4 h-4" />
                {interfaceLang === 'fr' ? 'Faire un exercice' : 'Do an exercise'}
              </button>
            )}

            {/* Explanation blocks */}
            {verbGroupFilter !== 'all' && (
              <div className="bg-blue-50 border-l-4 rounded-lg p-6" style={{ borderColor: '#D9B438' }}>
                <h4 className="font-bold mb-3" style={{ color: '#002844' }}>
                  {verbGroupFilter === 'AAA' && 'Groupe AAA'}
                  {verbGroupFilter === 'ABB' && 'Groupe ABB'}
                  {verbGroupFilter === 'ABC' && 'Groupe ABC'}
                  {verbGroupFilter === 'ABA' && 'Groupe ABA'}
                </h4>
                <p style={{ color: '#555555' }} className="text-sm mb-3">
                  {verbGroupFilter === 'AAA' &&
                    (interfaceLang === 'fr'
                      ? 'Les trois formes sont identiques. Le verbe ne change jamais. Ce groupe est rare en anglais et concerne surtout des verbes courts et simples.'
                      : 'All three forms are identical. The verb never changes. This group is rare in English and mainly concerns short and simple verbs.')}
                  {verbGroupFilter === 'ABB' &&
                    (interfaceLang === 'fr'
                      ? 'La base change pour le prétérit et le participe passé devient identique au prétérit. C\'est le groupe le plus grand en anglais.'
                      : 'The base changes for the past tense and the past participle becomes identical to the past tense. This is the largest group in English.')}
                  {verbGroupFilter === 'ABC' &&
                    (interfaceLang === 'fr'
                      ? 'Les trois formes sont complètement différentes. Ces verbes sont parmi les plus courants et essentiels à apprendre (go, do, see).'
                      : 'All three forms are completely different. These verbs are among the most common and essential to learn (go, do, see).')}
                  {verbGroupFilter === 'ABA' &&
                    (interfaceLang === 'fr'
                      ? 'La base et le participe passé sont identiques, seul le prétérit change. Ce groupe est moins courant mais important à maîtriser.'
                      : 'The base and past participle are identical, only the past tense changes. This group is less common but important to master.')}
                </p>
                <p style={{ color: '#555555' }} className="text-xs italic">
                  {interfaceLang === 'fr' ? 'Exemples: ' : 'Examples: '}
                  {verbGroupFilter === 'AAA' && 'cut/cut/cut, hit/hit/hit, put/put/put'}
                  {verbGroupFilter === 'ABB' && 'buy/bought/bought, bring/brought/brought, think/thought/thought'}
                  {verbGroupFilter === 'ABC' && 'go/went/gone, do/did/done, see/saw/seen, eat/ate/eaten'}
                  {verbGroupFilter === 'ABA' && 'come/came/come, become/became/become, run/ran/run'}
                </p>
              </div>
            )}

            {/* Table */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ backgroundColor: '#002844' }}>
                    <th className="px-6 py-4 text-left font-semibold text-white">
                      Base
                    </th>
                    <th className="px-6 py-4 text-left font-semibold text-white">
                      Prétérit
                    </th>
                    <th className="px-6 py-4 text-left font-semibold text-white">
                      Participe passé
                    </th>
                    <th className="px-6 py-4 text-left font-semibold text-white">
                      Français
                    </th>
                    <th className="px-6 py-4 text-left font-semibold text-white">
                      {t('grammar.verb.group', interfaceLang)}
                    </th>
                    <th className="px-6 py-4 text-center font-semibold text-white">
                      Audio
                    </th>
                    <th className="px-6 py-4 text-center font-semibold text-white">
                      {interfaceLang === 'fr' ? 'Ma compréhension' : 'My understanding'}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredVerbs.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-6 py-8 text-center"
                      >
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
                      </td>
                    </tr>
                  ) : (
                    filteredVerbs.map((verb, _idx) => { // eslint-disable-line @typescript-eslint/no-unused-vars
                      const verbId = `${verb.base}_${verb.past}_${verb.past_participle}`
                      const currentAssessment = verbAssessment[verbId]
                      return (
                        <tr
                          key={verb.base}
                          className="border-t border-gray-200 hover:bg-blue-50 transition"
                        >
                          <td className="px-6 py-4" style={{ color: '#002844' }}>
                            <button
                              onClick={() => handleSpeakVerb(verb.base, verb.past, verb.past_participle)}
                              className="font-semibold hover:text-yellow-600 transition flex items-center gap-2"
                            >
                              {verb.base}
                              <Volume2 className="w-4 h-4 opacity-0 group-hover:opacity-100" />
                            </button>
                          </td>
                          <td className="px-6 py-4" style={{ color: '#555555' }}>
                            {verb.past}
                          </td>
                          <td className="px-6 py-4" style={{ color: '#555555' }}>
                            {verb.past_participle}
                          </td>
                          <td className="px-6 py-4" style={{ color: '#555555' }}>
                            {verb.french}
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className="px-3 py-1 rounded-full text-sm font-medium"
                              style={{
                                backgroundColor: '#D9B438',
                                color: '#002844',
                              }}
                            >
                              {verb.group}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <button
                              onClick={() => handleSpeakVerb(verb.base, verb.past, verb.past_participle)}
                              className="p-2 hover:bg-blue-100 rounded transition inline-block"
                            >
                              <Volume2
                                className="w-5 h-5"
                                style={{ color: '#D9B438' }}
                              />
                            </button>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex gap-1 justify-center flex-wrap">
                              <button
                                onClick={() => assessVerb(verbId, 'know')}
                                className={`px-2 py-1 rounded text-xs font-semibold transition ${
                                  currentAssessment === 'know'
                                    ? 'bg-green-500 text-white'
                                    : 'bg-gray-200 text-gray-700 hover:bg-green-200'
                                }`}
                                title={interfaceLang === 'fr' ? 'Je connais' : 'I know'}
                              >
                                ✅
                              </button>
                              <button
                                onClick={() => assessVerb(verbId, 'unsure')}
                                className={`px-2 py-1 rounded text-xs font-semibold transition ${
                                  currentAssessment === 'unsure'
                                    ? 'bg-yellow-500 text-white'
                                    : 'bg-gray-200 text-gray-700 hover:bg-yellow-200'
                                }`}
                                title={interfaceLang === 'fr' ? 'J\'hésite' : 'I\'m unsure'}
                              >
                                🔄
                              </button>
                              <button
                                onClick={() => assessVerb(verbId, 'review')}
                                className={`px-2 py-1 rounded text-xs font-semibold transition ${
                                  currentAssessment === 'review'
                                    ? 'bg-red-500 text-white'
                                    : 'bg-gray-200 text-gray-700 hover:bg-red-200'
                                }`}
                                title={interfaceLang === 'fr' ? 'À revoir' : 'To review'}
                              >
                                ❌
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
