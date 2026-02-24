/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { getCurrentUser, updateUserProgress, completeOnboarding } from '@/lib/db/localStorage'
import { getCECRLQuestions, getGRCQuestions, DiagnosticQuestion } from '@/lib/db/diagnosticBank'
import { User, InterfaceLanguage, LearningLanguage, LearningObjective, LEARNING_LANGUAGES, LEARNING_OBJECTIVES, scoreToCECRL, scoreToGRC, LevelCECRL } from '@/types'
import { t } from '@/lib/i18n'
import { CheckCircle, XCircle, ChevronRight, Volume2, Mic, MicOff } from 'lucide-react'

interface DiagPlanItem {
  lang: string
  cecrl: 'test' | 'manual' | 'skip'
  cecrManualLevel?: LevelCECRL
  grc: 'test' | 'skip'
  hasGrc: boolean
}

interface ObjectiveScore {
  correct: number
  total: number
  percent: number
}

export default function DiagnosticPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [lang, setLang] = useState<InterfaceLanguage>('fr')
  const [loading, setLoading] = useState(true)

  // Multi-language diagnostic plan
  const [diagPlan, setDiagPlan] = useState<DiagPlanItem[]>([])
  const [currentPlanIndex, setCurrentPlanIndex] = useState(0)

  // Current phase: cecrl or grc (Correction #3: SEPARATE)
  const [phase, setPhase] = useState<'cecrl' | 'transition' | 'grc' | 'results'>('cecrl')

  const [questions, setQuestions] = useState<DiagnosticQuestion[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null)
  const [showFeedback, setShowFeedback] = useState(false)
  const [lastCorrect, setLastCorrect] = useState(false)

  // Scores tracking per objective (#7)
  const [objectiveScores, setObjectiveScores] = useState<Record<string, ObjectiveScore>>({})
  const [grcCorrect, setGrcCorrect] = useState(0)
  const [grcTotal, setGrcTotal] = useState(0)

  // Results per language
  const [allResults, setAllResults] = useState<Record<string, { cecrlLevel: LevelCECRL; cecrlScore: number; grcLevel?: string; grcScore?: number; objectiveScores: Record<string, ObjectiveScore> }>>({})

  // TTS state (#5)
  const [ttsPlays, setTtsPlays] = useState(0)
  const [ttsAvailable, setTtsAvailable] = useState(true)

  // Microphone state (#6)
  const [micPermission, setMicPermission] = useState<'pending' | 'granted' | 'denied'>('pending')
  const [isRecording, setIsRecording] = useState(false)
  const [speechResult, setSpeechResult] = useState<string>('')
  const recognitionRef = useRef<any>(null)

  // Check TTS availability
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setTtsAvailable('speechSynthesis' in window)
    }
  }, [])

  // Load diagnostic plan
  useEffect(() => {
    const currentUser = getCurrentUser()
    if (!currentUser) { router.push('/auth'); return }
    if (currentUser.onboardingCompleted) { router.push('/dashboard'); return }

    setUser(currentUser)
    setLang(currentUser.settings.interfaceLang || 'fr')

    const planStr = sessionStorage.getItem('lingualearn_diag_plan')
    if (!planStr) { router.push('/onboarding'); return }

    const plan: DiagPlanItem[] = JSON.parse(planStr)
    setDiagPlan(plan)

    // Find first language that needs a test
    const firstTestIdx = plan.findIndex(p => p.cecrl === 'test' || p.grc === 'test')
    if (firstTestIdx === -1) { router.push('/dashboard'); return }

    setCurrentPlanIndex(firstTestIdx)
    loadQuestionsForPlan(plan[firstTestIdx], currentUser)
    setLoading(false)
  }, [router])

  const loadQuestionsForPlan = (planItem: DiagPlanItem, currentUser: User) => {
    const langConfig = currentUser.settings.languageConfigs?.[planItem.lang]
    const objectives = langConfig?.objectives || ['grammaire', 'vocabulaire', 'lecture', 'ecrit', 'oral'] as LearningObjective[]

    if (planItem.cecrl === 'test') {
      const qs = getCECRLQuestions(planItem.lang as LearningLanguage, objectives)
      setQuestions(qs)
      setPhase('cecrl')
    } else if (planItem.grc === 'test' && planItem.hasGrc) {
      const qs = getGRCQuestions(planItem.lang as LearningLanguage)
      setQuestions(qs)
      setPhase('grc')
    }

    setCurrentIndex(0)
    setSelectedAnswer(null)
    setShowFeedback(false)
    setObjectiveScores({})
    setGrcCorrect(0)
    setGrcTotal(0)
    setTtsPlays(0)
  }

  // TTS play function (#5)
  const playTTS = useCallback((text: string, langCode: string) => {
    if (!ttsAvailable || ttsPlays >= 2) return
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = langCode === 'en' ? 'en-US' : langCode
    // Speed based on estimated level
    const currentQ = questions[currentIndex]
    if (currentQ && (currentQ.level === 'A1' || currentQ.level === 'A2')) {
      utterance.rate = 0.75
    } else {
      utterance.rate = 1.0
    }
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(utterance)
    setTtsPlays(prev => prev + 1)
  }, [ttsAvailable, ttsPlays, questions, currentIndex])

  // Microphone functions (#6)
  const requestMic = async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true })
      setMicPermission('granted')
    } catch {
      setMicPermission('denied')
    }
  }

  const startRecording = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) { setMicPermission('denied'); return }

    const recognition = new SpeechRecognition()
    recognition.lang = diagPlan[currentPlanIndex]?.lang === 'en' ? 'en-US' : diagPlan[currentPlanIndex]?.lang || 'en'
    recognition.continuous = false
    recognition.interimResults = false

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript
      setSpeechResult(transcript)
      setIsRecording(false)
    }
    recognition.onerror = () => { setIsRecording(false) }
    recognition.onend = () => { setIsRecording(false) }

    recognitionRef.current = recognition
    recognition.start()
    setIsRecording(true)
    setSpeechResult('')
  }

  const stopRecording = () => {
    if (recognitionRef.current) recognitionRef.current.stop()
    setIsRecording(false)
  }

  // Handle answer validation
  const handleValidate = () => {
    if (selectedAnswer === null || showFeedback) return

    const q = questions[currentIndex]
    const correct = selectedAnswer === q.correctAnswer
    setLastCorrect(correct)
    setShowFeedback(true)

    // Track per-objective scores
    if (phase === 'cecrl') {
      const objKey = q.objective as string
      setObjectiveScores(prev => {
        const existing = prev[objKey] || { correct: 0, total: 0, percent: 0 }
        const newCorrect = existing.correct + (correct ? 1 : 0)
        const newTotal = existing.total + 1
        return { ...prev, [objKey]: { correct: newCorrect, total: newTotal, percent: Math.round((newCorrect / newTotal) * 100) } }
      })
    } else if (phase === 'grc') {
      setGrcTotal(prev => prev + 1)
      if (correct) setGrcCorrect(prev => prev + 1)
    }

    setTimeout(() => {
      if (currentIndex < questions.length - 1) {
        setCurrentIndex(prev => prev + 1)
        setSelectedAnswer(null)
        setShowFeedback(false)
        setTtsPlays(0)
        setSpeechResult('')
      } else {
        finishPhase()
      }
    }, 1500)
  }

  // Handle speaking question "validation" (auto-score based on speech result)
  const handleSpeakingValidate = () => {
    if (showFeedback) return
    // Simple scoring: if speech was captured, count as correct-ish
    const hasResult = speechResult.length > 3
    setLastCorrect(hasResult)
    setShowFeedback(true)
    setSelectedAnswer(hasResult ? 0 : 3)

    const q = questions[currentIndex]
    const objKey = q.objective as string
    setObjectiveScores(prev => {
      const existing = prev[objKey] || { correct: 0, total: 0, percent: 0 }
      const newCorrect = existing.correct + (hasResult ? 1 : 0)
      const newTotal = existing.total + 1
      return { ...prev, [objKey]: { correct: newCorrect, total: newTotal, percent: Math.round((newCorrect / newTotal) * 100) } }
    })

    setTimeout(() => {
      if (currentIndex < questions.length - 1) {
        setCurrentIndex(prev => prev + 1)
        setSelectedAnswer(null)
        setShowFeedback(false)
        setTtsPlays(0)
        setSpeechResult('')
      } else {
        finishPhase()
      }
    }, 1500)
  }

  const finishPhase = () => {
    const planItem = diagPlan[currentPlanIndex]

    if (phase === 'cecrl') {
      // Calculate CECRL result
      let totalCorrect = 0, totalQs = 0
      Object.values(objectiveScores).forEach(s => { totalCorrect += s.correct; totalQs += s.total })
      // Add the last question's score
      const cecrlScore = totalQs > 0 ? Math.round((totalCorrect / totalQs) * 100) : 0
      const cecrlLevel = scoreToCECRL(cecrlScore)

      // Store partial result
      setAllResults(prev => ({
        ...prev,
        [planItem.lang]: { cecrlLevel, cecrlScore, objectiveScores: { ...objectiveScores } },
      }))

      // Apply to user progress immediately
      if (user) {
        updateUserProgress(user.id, planItem.lang, {
          levelCecrl: cecrlLevel,
          diagnosticCompleted: true,
          objectiveProgress: { grammaire: 0, vocabulaire: 0, lecture: 0, ecrit: 0, oral: 0 },
          diagnosticResults: { cecrlScore, cecrlLevel, scoresByObjective: objectiveScores },
        })
      }

      // Check if GRC test needed
      if (planItem.grc === 'test' && planItem.hasGrc) {
        setPhase('transition')
      } else {
        setPhase('results')
      }
    } else if (phase === 'grc') {
      const grcScore = grcTotal > 0 ? Math.round((grcCorrect / grcTotal) * 100) : 0
      const grcLevel = scoreToGRC(grcScore)

      setAllResults(prev => ({
        ...prev,
        [planItem.lang]: { ...prev[planItem.lang], grcLevel, grcScore },
      }))

      if (user) {
        updateUserProgress(user.id, planItem.lang, {
          levelGrc: grcLevel,
          grcDiagnosticCompleted: true,
        })
      }

      setPhase('results')
    }
  }

  const startGRCPhase = () => {
    const planItem = diagPlan[currentPlanIndex]
    const qs = getGRCQuestions(planItem.lang as LearningLanguage)
    setQuestions(qs)
    setCurrentIndex(0)
    setSelectedAnswer(null)
    setShowFeedback(false)
    setGrcCorrect(0)
    setGrcTotal(0)
    setPhase('grc')
  }

  const skipGRC = () => {
    if (user) {
      const planItem = diagPlan[currentPlanIndex]
      updateUserProgress(user.id, planItem.lang, { levelGrc: 'Junior', grcDiagnosticCompleted: true })
    }
    setPhase('results')
  }

  const handleNextLangOrFinish = () => {
    // Find next lang that needs test
    let nextIdx = -1
    for (let i = currentPlanIndex + 1; i < diagPlan.length; i++) {
      if (diagPlan[i].cecrl === 'test' || diagPlan[i].grc === 'test') { nextIdx = i; break }
    }

    if (nextIdx === -1) {
      // All done
      if (user) {
        // Apply skip/manual levels for non-test languages
        for (const plan of diagPlan) {
          if (plan.cecrl !== 'test') {
            updateUserProgress(user.id, plan.lang, {
              levelCecrl: plan.cecrManualLevel || 'A1',
              diagnosticCompleted: true,
              objectiveProgress: { grammaire: 0, vocabulaire: 0, lecture: 0, ecrit: 0, oral: 0 },
            })
          }
          if (plan.grc !== 'test' && plan.hasGrc) {
            updateUserProgress(user.id, plan.lang, { levelGrc: 'Junior', grcDiagnosticCompleted: true })
          }
        }
        completeOnboarding(user.id)
      }
      router.push('/dashboard')
    } else {
      setCurrentPlanIndex(nextIdx)
      if (user) loadQuestionsForPlan(diagPlan[nextIdx], user)
    }
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

  const planItem = diagPlan[currentPlanIndex]
  const planLangInfo = planItem ? LEARNING_LANGUAGES.find(l => l.code === planItem.lang) : null

  // ========= TRANSITION SCREEN (CECRL done → GRC) =========
  if (phase === 'transition') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-blue-50 to-white p-4">
        <div className="w-full max-w-lg rounded-2xl bg-white p-8 shadow-xl text-center">
          <div className="text-5xl mb-4">🎯</div>
          <h2 className="text-2xl font-bold text-[#002844] mb-4">{t('diagnostic.transition', lang)}</h2>
          <div className="flex gap-3 mt-6">
            <button onClick={startGRCPhase}
              className="flex-1 rounded-xl bg-[#D9B438] px-6 py-4 font-semibold text-[#002844] hover:opacity-90">
              {t('diagnostic.continueGrc', lang)}
            </button>
            <button onClick={skipGRC}
              className="flex-1 rounded-xl border-2 border-gray-300 px-6 py-4 font-semibold text-[#555555] hover:bg-gray-50">
              {t('diagnostic.skipGrc', lang)}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ========= RESULTS SCREEN with detailed report (#7) =========
  if (phase === 'results') {
    const result = allResults[planItem?.lang]
    const langName = lang === 'fr' ? planLangInfo?.nameFr : planLangInfo?.nameEn

    const getScoreEmoji = (pct: number) => {
      if (pct >= 75) return '🟢'
      if (pct >= 60) return '🟡'
      if (pct >= 45) return '🟠'
      return '🔴'
    }
    const getScoreLabel = (pct: number) => {
      if (pct >= 75) return t('diagnostic.strengths', lang)
      if (pct >= 60) return t('diagnostic.correct', lang)
      if (pct >= 45) return t('diagnostic.toImprove', lang)
      return t('diagnostic.priority', lang)
    }

    // Build recommendation
    const sortedObjs = Object.entries(result?.objectiveScores || {}).sort((a, b) => a[1].percent - b[1].percent)
    const weakest = sortedObjs.filter(([, s]) => s.percent < 60).map(([k]) => k)
    const strongest = sortedObjs.filter(([, s]) => s.percent >= 75).map(([k]) => k)

    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white p-4">
        <div className="mx-auto max-w-lg">
          <div className="rounded-2xl bg-white p-6 shadow-xl">
            <h1 className="mb-2 text-center text-2xl font-bold text-[#002844]">
              {t('diagnostic.detailedResults', lang)} {t('diagnostic.forLang', lang)} {langName}
            </h1>

            {/* CECRL Level */}
            {result && (
              <div className="mt-4 rounded-xl border-2 border-[#002844] bg-[#002844]/5 p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-[#555555]">{t('diagnostic.cecrl', lang)}</p>
                    <p className="text-lg font-semibold text-[#002844]">{t('diagnostic.yourLevel', lang)}</p>
                  </div>
                  <span className="rounded-full bg-[#002844] px-5 py-2 text-2xl font-bold text-white">{result.cecrlLevel}</span>
                </div>
                <p className="mt-2 text-sm text-[#555555]">Score : {result.cecrlScore}%</p>
              </div>
            )}

            {/* Detail per objective (#7) */}
            {result?.objectiveScores && Object.keys(result.objectiveScores).length > 0 && (
              <div className="mt-4 space-y-2">
                {Object.entries(result.objectiveScores).map(([key, score]) => {
                  const objDef = LEARNING_OBJECTIVES.find(o => o.id === key)
                  const name = lang === 'fr' ? objDef?.nameFr || key : objDef?.nameEn || key
                  return (
                    <div key={key} className="flex items-center gap-3 p-3 rounded-lg bg-gray-50">
                      <span className="text-lg">{getScoreEmoji(score.percent)}</span>
                      <div className="flex-1">
                        <div className="flex justify-between">
                          <span className="font-medium text-[#002844]">{objDef?.icon} {name}</span>
                          <span className="text-sm font-semibold text-[#002844]">{score.percent}%</span>
                        </div>
                        <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-gray-200">
                          <div className="h-full rounded-full transition-all" style={{ width: `${score.percent}%`, backgroundColor: score.percent >= 75 ? '#22c55e' : score.percent >= 60 ? '#D9B438' : score.percent >= 45 ? '#f97316' : '#ef4444' }} />
                        </div>
                      </div>
                      <span className="text-xs font-medium text-[#555555] min-w-[80px] text-right">{getScoreLabel(score.percent)}</span>
                    </div>
                  )
                })}
              </div>
            )}

            {/* GRC Level */}
            {result?.grcLevel && (
              <div className="mt-4 rounded-xl border-2 border-[#D9B438] bg-[#D9B438]/10 p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-[#555555]">{t('diagnostic.grc', lang)}</p>
                    <p className="text-lg font-semibold text-[#002844]">{t('diagnostic.yourLevel', lang)}</p>
                  </div>
                  <span className="rounded-full bg-[#D9B438] px-5 py-2 text-xl font-bold text-[#002844]">{result.grcLevel}</span>
                </div>
                <p className="mt-2 text-sm text-[#555555]">Score : {result.grcScore}%</p>
              </div>
            )}

            {/* Recommendation (#7) */}
            <div className="mt-4 p-4 bg-blue-50 rounded-xl">
              <p className="font-semibold text-[#002844] mb-2">{t('diagnostic.recommendation', lang)}</p>
              <p className="text-sm text-[#002844]">
                {lang === 'fr'
                  ? `Ton niveau global est ${result?.cecrlLevel || 'A1'}.${strongest.length > 0 ? ` Tes points forts sont ${strongest.join(', ')}.` : ''}${weakest.length > 0 ? ` Nous te recommandons de travailler en priorité ${weakest.join(' et ')}.` : ' Continue comme ça !'}`
                  : `Your overall level is ${result?.cecrlLevel || 'A1'}.${strongest.length > 0 ? ` Your strengths are ${strongest.join(', ')}.` : ''}${weakest.length > 0 ? ` We recommend focusing on ${weakest.join(' and ')}.` : ' Keep it up!'}`}
              </p>
            </div>

            <button onClick={handleNextLangOrFinish}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-[#002844] px-6 py-4 text-lg font-semibold text-white hover:opacity-90">
              {t('diagnostic.goToDashboard', lang)}
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    )
  }

  // No questions fallback
  if (questions.length === 0) {
    return (
      <div className="flex h-screen items-center justify-center p-4">
        <div className="text-center">
          <p className="mb-4 text-lg text-[#555555]">
            {lang === 'fr' ? 'Aucune question disponible.' : 'No questions available.'}
          </p>
          <button onClick={handleNextLangOrFinish} className="rounded-xl bg-[#002844] px-6 py-3 font-semibold text-white">
            {t('diagnostic.goToDashboard', lang)}
          </button>
        </div>
      </div>
    )
  }

  // ========= QUESTION SCREEN =========
  const currentQ = questions[currentIndex]
  const progressPercent = ((currentIndex + 1) / questions.length) * 100
  const isListening = currentQ.interactionType === 'listening'
  const isSpeaking = currentQ.interactionType === 'speaking'

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-blue-50 to-white">
      {/* Header */}
      <div className="bg-white px-4 py-5 shadow-sm">
        <div className="mx-auto max-w-2xl">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{planLangInfo?.flag}</span>
              <h1 className="text-lg font-bold text-[#002844]">
                {phase === 'cecrl' ? t('diagnostic.cecrTitle', lang) : t('diagnostic.grcTitle', lang)}
              </h1>
            </div>
            <span className="text-sm font-medium text-[#555555]">
              {currentIndex + 1}/{questions.length}
            </span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-200">
            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${progressPercent}%`, backgroundColor: '#D9B438' }} />
          </div>
        </div>
      </div>

      {/* Question */}
      <div className="flex-1 px-4 py-6">
        <div className="mx-auto max-w-2xl">
          <div className="rounded-2xl bg-white p-6 shadow-lg sm:p-8">
            {/* Type badge */}
            <span className="mb-4 inline-block rounded-full px-4 py-1 text-sm font-semibold text-white"
              style={{ backgroundColor: phase === 'cecrl' ? '#002844' : '#D9B438', color: phase === 'grc' ? '#002844' : '#fff' }}>
              {phase === 'cecrl' ? 'CECRL' : 'GRC / Cyber'}
            </span>

            <h2 className="mb-4 text-lg font-semibold text-[#002844] sm:text-xl">{currentQ.question}</h2>

            {/* TTS Button for listening questions (#5) */}
            {isListening && (
              <div className="mb-4">
                {ttsAvailable ? (
                  <button
                    onClick={() => currentQ.audioText && playTTS(currentQ.audioText, planItem?.lang || 'en')}
                    disabled={ttsPlays >= 2}
                    className={`flex items-center gap-2 rounded-xl px-5 py-3 font-semibold transition-all ${
                      ttsPlays >= 2 ? 'bg-gray-200 text-gray-400' : 'bg-[#002844] text-white hover:opacity-90'
                    }`}>
                    <Volume2 className="h-5 w-5" />
                    {ttsPlays === 0 ? t('diagnostic.listen', lang) : t('diagnostic.listenAgain', lang)}
                    {ttsPlays > 0 && <span className="text-xs ml-1">({2 - ttsPlays} restant{2 - ttsPlays > 1 ? 's' : ''})</span>}
                  </button>
                ) : (
                  <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-700">
                    {t('diagnostic.audioNotAvailable', lang)}
                    {currentQ.audioText && <p className="mt-2 italic">&quot;{currentQ.audioText}&quot;</p>}
                  </div>
                )}
              </div>
            )}

            {/* Microphone for speaking questions (#6) */}
            {isSpeaking && (
              <div className="mb-4">
                {micPermission === 'pending' && (
                  <button onClick={requestMic}
                    className="flex items-center gap-2 rounded-xl bg-[#002844] px-5 py-3 font-semibold text-white hover:opacity-90">
                    <Mic className="h-5 w-5" /> {t('diagnostic.speakNow', lang)}
                  </button>
                )}
                {micPermission === 'granted' && (
                  <div className="space-y-3">
                    {!isRecording ? (
                      <button onClick={startRecording}
                        className="flex items-center gap-2 rounded-xl bg-[#002844] px-5 py-3 font-semibold text-white hover:opacity-90">
                        <Mic className="h-5 w-5" /> {t('diagnostic.speakNow', lang)}
                      </button>
                    ) : (
                      <button onClick={stopRecording}
                        className="flex items-center gap-2 rounded-xl bg-red-500 px-5 py-3 font-semibold text-white animate-pulse">
                        <MicOff className="h-5 w-5" /> {t('diagnostic.recording', lang)}
                      </button>
                    )}
                    {speechResult && (
                      <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                        <p className="text-sm text-green-700 font-medium">&quot;{speechResult}&quot;</p>
                      </div>
                    )}
                  </div>
                )}
                {micPermission === 'denied' && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                    <MicOff className="h-4 w-4 inline mr-1" /> {t('diagnostic.micDenied', lang)}
                  </div>
                )}
              </div>
            )}

            {/* Options (for text and listening) */}
            {!isSpeaking && (
              <div className="space-y-3">
                {currentQ.options.map((option, idx) => {
                  const isSelected = selectedAnswer === idx
                  const isCorrectOption = idx === currentQ.correctAnswer
                  const showCorrectFb = showFeedback && isCorrectOption
                  const showWrongFb = showFeedback && isSelected && !isCorrectOption

                  return (
                    <button key={idx} onClick={() => !showFeedback && setSelectedAnswer(idx)} disabled={showFeedback}
                      className={`flex w-full items-center rounded-xl border-2 p-4 text-left transition-all ${
                        showCorrectFb ? 'border-green-500 bg-green-50'
                          : showWrongFb ? 'border-red-500 bg-red-50'
                            : isSelected ? 'border-[#002844] bg-[#002844]/5'
                              : 'border-gray-200 hover:border-gray-300'
                      }`}>
                      <span className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border-2 text-sm font-semibold ${
                        isSelected && !showFeedback ? 'border-[#002844] bg-[#002844] text-white' : 'border-gray-300 text-gray-500'
                      }`}>{String.fromCharCode(65 + idx)}</span>
                      <span className="ml-3 flex-1 text-[#002844]">{option}</span>
                      {showCorrectFb && <CheckCircle className="h-6 w-6 flex-shrink-0 text-green-500" />}
                      {showWrongFb && <XCircle className="h-6 w-6 flex-shrink-0 text-red-500" />}
                    </button>
                  )
                })}
              </div>
            )}

            {/* Feedback */}
            {showFeedback && (
              <div className={`mt-4 rounded-lg p-3 text-center font-medium ${lastCorrect ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                {lastCorrect ? (lang === 'fr' ? 'Bonne réponse !' : 'Correct!') : (lang === 'fr' ? 'Mauvaise réponse' : 'Wrong answer')}
              </div>
            )}

            {/* Validate button */}
            {!isSpeaking ? (
              <button onClick={handleValidate} disabled={selectedAnswer === null || showFeedback}
                className="mt-6 w-full rounded-xl px-6 py-3.5 text-lg font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
                style={{ backgroundColor: selectedAnswer !== null && !showFeedback ? '#D9B438' : '#E5E7EB', color: selectedAnswer !== null && !showFeedback ? '#002844' : '#9CA3AF' }}>
                {t('diagnostic.submit', lang)}
              </button>
            ) : (
              <button onClick={handleSpeakingValidate}
                disabled={showFeedback || (!speechResult && micPermission !== 'denied')}
                className="mt-6 w-full rounded-xl px-6 py-3.5 text-lg font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
                style={{ backgroundColor: (speechResult || micPermission === 'denied') && !showFeedback ? '#D9B438' : '#E5E7EB', color: (speechResult || micPermission === 'denied') && !showFeedback ? '#002844' : '#9CA3AF' }}>
                {micPermission === 'denied'
                  ? (lang === 'fr' ? 'Passer (micro non autorisé)' : 'Skip (mic not allowed)')
                  : t('diagnostic.submit', lang)}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
