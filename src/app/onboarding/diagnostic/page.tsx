/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { getCurrentUser, updateUserProgress, completeOnboarding } from '@/lib/db/localStorage'
import { getCECRLQuestions, getGRCQuestions, DiagnosticQuestion } from '@/lib/db/diagnosticBank'
import { User, InterfaceLanguage, LearningLanguage, LearningObjective, LEARNING_LANGUAGES, LEARNING_OBJECTIVES, scoreToCECRL, scoreToGRC, LevelCECRL } from '@/types'
import { CheckCircle, XCircle, ChevronRight, Volume2, Mic, MicOff, Sparkles, BookOpen, Star } from 'lucide-react'
import BottomNav from '@/components/BottomNav'

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

// Encouraging messages
const ENCOURAGEMENTS_FR = ['Bien joué !', 'Super !', 'Bravo !', 'Excellent !', 'Continue comme ça !', 'Tu progresses !']
const ENCOURAGEMENTS_EN = ['Well done!', 'Great!', 'Bravo!', 'Excellent!', 'Keep going!', 'You\'re progressing!']
const WRONG_FR = ['Pas grave, on apprend !', 'Bonne tentative !', 'Tu y arriveras !', 'On continue !']
const WRONG_EN = ['No worries, we learn!', 'Good try!', 'You\'ll get it!', 'Let\'s keep going!']

export default function DiagnosticPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [lang, setLang] = useState<InterfaceLanguage>('fr')
  const [loading, setLoading] = useState(true)

  const [diagPlan, setDiagPlan] = useState<DiagPlanItem[]>([])
  const [currentPlanIndex, setCurrentPlanIndex] = useState(0)

  const [phase, setPhase] = useState<'cecrl' | 'transition' | 'grc' | 'results'>('cecrl')

  const [questions, setQuestions] = useState<DiagnosticQuestion[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null)
  const [showFeedback, setShowFeedback] = useState(false)
  const [lastCorrect, setLastCorrect] = useState(false)
  const [feedbackMessage, setFeedbackMessage] = useState('')

  const [objectiveScores, setObjectiveScores] = useState<Record<string, ObjectiveScore>>({})
  const [grcCorrect, setGrcCorrect] = useState(0)
  const [grcTotal, setGrcTotal] = useState(0)

  const [allResults, setAllResults] = useState<Record<string, { cecrlLevel: LevelCECRL; cecrlScore: number; grcLevel?: string; grcScore?: number; objectiveScores: Record<string, ObjectiveScore> }>>({})

  const [ttsPlays, setTtsPlays] = useState(0)
  const [ttsAvailable, setTtsAvailable] = useState(true)
  const [micPermission, setMicPermission] = useState<'pending' | 'granted' | 'denied'>('pending')
  const [isRecording, setIsRecording] = useState(false)
  const [speechResult, setSpeechResult] = useState<string>('')
  const recognitionRef = useRef<any>(null)

  useEffect(() => {
    if (typeof window !== 'undefined') setTtsAvailable('speechSynthesis' in window)
  }, [])

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
      setQuestions(getCECRLQuestions(planItem.lang as LearningLanguage, objectives))
      setPhase('cecrl')
    } else if (planItem.grc === 'test' && planItem.hasGrc) {
      setQuestions(getGRCQuestions(planItem.lang as LearningLanguage))
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

  const getRandomMessage = (correct: boolean) => {
    const arr = correct
      ? (lang === 'fr' ? ENCOURAGEMENTS_FR : ENCOURAGEMENTS_EN)
      : (lang === 'fr' ? WRONG_FR : WRONG_EN)
    return arr[Math.floor(Math.random() * arr.length)]
  }

  const playTTS = useCallback((text: string, langCode: string) => {
    if (!ttsAvailable || ttsPlays >= 2) return
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = langCode === 'en' ? 'en-US' : langCode
    const currentQ = questions[currentIndex]
    utterance.rate = currentQ && (currentQ.level === 'A1' || currentQ.level === 'A2') ? 0.75 : 1.0
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(utterance)
    setTtsPlays(prev => prev + 1)
  }, [ttsAvailable, ttsPlays, questions, currentIndex])

  const requestMic = async () => {
    try { await navigator.mediaDevices.getUserMedia({ audio: true }); setMicPermission('granted') }
    catch { setMicPermission('denied') }
  }

  const startRecording = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) { setMicPermission('denied'); return }
    const recognition = new SpeechRecognition()
    recognition.lang = diagPlan[currentPlanIndex]?.lang === 'en' ? 'en-US' : diagPlan[currentPlanIndex]?.lang || 'en'
    recognition.continuous = true
    recognition.interimResults = true
    recognition.onresult = (event: any) => {
      let transcript = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript
      }
      setSpeechResult(transcript)
    }
    recognition.onerror = () => {}
    recognition.onend = () => {}
    recognitionRef.current = recognition
    recognition.start()
    setIsRecording(true)
    setSpeechResult('')
  }

  const stopRecording = () => {
    if (recognitionRef.current) {
      recognitionRef.current.abort()
      setIsRecording(false)
    }
  }

  const processAnswer = (correct: boolean, objKey: string) => {
    setLastCorrect(correct)
    setFeedbackMessage(getRandomMessage(correct))
    setShowFeedback(true)

    if (phase === 'cecrl') {
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
    }, 1800)
  }

  const handleValidate = () => {
    if (selectedAnswer === null || showFeedback) return
    const q = questions[currentIndex]
    processAnswer(selectedAnswer === q.correctAnswer, q.objective as string)
  }

  const handleSpeakingValidate = () => {
    if (showFeedback) return
    const hasResult = speechResult.length > 3
    setSelectedAnswer(hasResult ? 0 : 3)
    processAnswer(hasResult, questions[currentIndex].objective as string)
  }

  const finishPhase = () => {
    const planItem = diagPlan[currentPlanIndex]

    if (phase === 'cecrl') {
      let totalCorrect = 0, totalQs = 0
      Object.values(objectiveScores).forEach(s => { totalCorrect += s.correct; totalQs += s.total })
      const cecrlScore = totalQs > 0 ? Math.round((totalCorrect / totalQs) * 100) : 0
      const cecrlLevel = scoreToCECRL(cecrlScore)

      setAllResults(prev => ({ ...prev, [planItem.lang]: { cecrlLevel, cecrlScore, objectiveScores: { ...objectiveScores } } }))

      if (user) {
        updateUserProgress(user.id, planItem.lang, {
          levelCecrl: cecrlLevel, diagnosticCompleted: true,
          objectiveProgress: { grammaire: 0, vocabulaire: 0, lecture: 0, ecrit: 0, oral: 0 },
          diagnosticResults: { cecrlScore, cecrlLevel, scoresByObjective: objectiveScores },
        })
      }

      if (planItem.grc === 'test' && planItem.hasGrc) setPhase('transition')
      else setPhase('results')
    } else if (phase === 'grc') {
      const grcScore = grcTotal > 0 ? Math.round((grcCorrect / grcTotal) * 100) : 0
      const grcLevel = scoreToGRC(grcScore)
      setAllResults(prev => ({ ...prev, [planItem.lang]: { ...prev[planItem.lang], grcLevel, grcScore } }))
      if (user) updateUserProgress(user.id, planItem.lang, { levelGrc: grcLevel, grcDiagnosticCompleted: true })
      setPhase('results')
    }
  }

  const startGRCPhase = () => {
    const planItem = diagPlan[currentPlanIndex]
    setQuestions(getGRCQuestions(planItem.lang as LearningLanguage))
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
    let nextIdx = -1
    for (let i = currentPlanIndex + 1; i < diagPlan.length; i++) {
      if (diagPlan[i].cecrl === 'test' || diagPlan[i].grc === 'test') { nextIdx = i; break }
    }

    if (nextIdx === -1) {
      if (user) {
        for (const plan of diagPlan) {
          if (plan.cecrl !== 'test') {
            updateUserProgress(user.id, plan.lang, {
              levelCecrl: plan.cecrManualLevel || 'A1', diagnosticCompleted: true,
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
      <div className="flex h-screen items-center justify-center bg-gradient-to-b from-blue-50 to-white">
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-[#002844]" />
          <p className="text-[#555555]">{lang === 'fr' ? 'Préparation de ta leçon...' : 'Preparing your lesson...'}</p>
        </div>
      </div>
    )
  }

  const planItem = diagPlan[currentPlanIndex]
  const planLangInfo = planItem ? LEARNING_LANGUAGES.find(l => l.code === planItem.lang) : null

  // ========= TRANSITION SCREEN =========
  if (phase === 'transition') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-blue-50 to-white p-4">
        <div className="w-full max-w-lg rounded-2xl bg-white p-8 shadow-xl text-center">
          <div className="text-5xl mb-4">💼</div>
          <h2 className="text-xl font-bold text-[#002844] mb-2">
            {lang === 'fr' ? 'Passons aux exercices professionnels !' : 'Let\'s move on to professional exercises!'}
          </h2>
          <p className="text-sm text-[#555555] mb-6">
            {lang === 'fr' ? 'Quelques exercices GRC pour adapter ton parcours métier.' : 'A few GRC exercises to customize your professional path.'}
          </p>
          <div className="flex gap-3">
            <button onClick={startGRCPhase}
              className="flex-1 rounded-xl px-6 py-4 font-semibold hover:opacity-90 transition-all"
              style={{ backgroundColor: '#D9B438', color: '#002844' }}>
              {lang === 'fr' ? 'Continuer' : 'Continue'}
            </button>
            <button onClick={skipGRC}
              className="flex-1 rounded-xl border-2 border-gray-200 px-6 py-4 font-semibold text-[#555555] hover:bg-gray-50 transition-all">
              {lang === 'fr' ? 'Passer' : 'Skip'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ========= RESULTS SCREEN — Lesson Complete =========
  if (phase === 'results') {
    const result = allResults[planItem?.lang]
    const langName = lang === 'fr' ? planLangInfo?.nameFr : planLangInfo?.nameEn

    const getScoreColor = (pct: number) => pct >= 75 ? '#22c55e' : pct >= 60 ? '#D9B438' : pct >= 45 ? '#f97316' : '#ef4444'

    const sortedObjs = Object.entries(result?.objectiveScores || {}).sort((a, b) => a[1].percent - b[1].percent)
    const weakest = sortedObjs.filter(([, s]) => s.percent < 60).map(([k]) => k)
    const strongest = sortedObjs.filter(([, s]) => s.percent >= 75).map(([k]) => k)

    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white p-4">
        <div className="mx-auto max-w-lg">
          <div className="rounded-2xl bg-white p-6 shadow-xl">
            {/* Celebration header */}
            <div className="text-center mb-6">
              <div className="text-5xl mb-2">🎉</div>
              <h1 className="text-2xl font-bold text-[#002844]">
                {lang === 'fr' ? 'Première leçon terminée !' : 'First lesson complete!'}
              </h1>
              <p className="text-sm text-[#555555] mt-1">
                {lang === 'fr' ? `Voici tes résultats en ${langName}` : `Here are your ${langName} results`}
              </p>
            </div>

            {/* CECRL Level — big card */}
            {result && (
              <div className="rounded-xl bg-gradient-to-r from-[#002844] to-[#003d66] p-5 text-white mb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-white/70">{lang === 'fr' ? 'Ton niveau estimé' : 'Your estimated level'}</p>
                    <p className="text-lg font-semibold">CECRL</p>
                  </div>
                  <span className="rounded-full bg-[#D9B438] px-6 py-3 text-3xl font-black text-[#002844]">{result.cecrlLevel}</span>
                </div>
                <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/20">
                  <div className="h-full rounded-full bg-[#D9B438] transition-all" style={{ width: `${result.cecrlScore}%` }} />
                </div>
                <p className="mt-1 text-xs text-white/70">Score : {result.cecrlScore}%</p>
              </div>
            )}

            {/* Score per objective */}
            {result?.objectiveScores && Object.keys(result.objectiveScores).length > 0 && (
              <div className="space-y-2 mb-4">
                <p className="text-sm font-semibold text-[#002844]">{lang === 'fr' ? 'Détail par compétence' : 'Skill breakdown'}</p>
                {Object.entries(result.objectiveScores).map(([key, score]) => {
                  const objDef = LEARNING_OBJECTIVES.find(o => o.id === key)
                  const name = lang === 'fr' ? objDef?.nameFr || key : objDef?.nameEn || key
                  return (
                    <div key={key} className="flex items-center gap-3 p-2.5 rounded-lg bg-gray-50">
                      <span className="text-sm">{objDef?.icon}</span>
                      <div className="flex-1">
                        <div className="flex justify-between text-xs">
                          <span className="font-medium text-[#002844]">{name}</span>
                          <span className="font-bold" style={{ color: getScoreColor(score.percent) }}>{score.percent}%</span>
                        </div>
                        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
                          <div className="h-full rounded-full transition-all" style={{ width: `${score.percent}%`, backgroundColor: getScoreColor(score.percent) }} />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* GRC Level */}
            {result?.grcLevel && (
              <div className="rounded-xl border-2 border-[#D9B438] bg-[#D9B438]/10 p-4 mb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-[#555555]">GRC</p>
                    <p className="text-base font-semibold text-[#002844]">{lang === 'fr' ? 'Niveau professionnel' : 'Professional level'}</p>
                  </div>
                  <span className="rounded-full bg-[#D9B438] px-4 py-2 text-lg font-bold text-[#002844]">{result.grcLevel}</span>
                </div>
              </div>
            )}

            {/* Recommendation */}
            <div className="p-4 bg-blue-50 rounded-xl mb-4">
              <div className="flex items-start gap-2">
                <Sparkles className="h-4 w-4 text-[#002844] mt-0.5 flex-shrink-0" />
                <p className="text-sm text-[#002844]">
                  {lang === 'fr'
                    ? `${strongest.length > 0 ? `Tes points forts : ${strongest.join(', ')}. ` : ''}${weakest.length > 0 ? `Nous te recommandons de travailler ${weakest.join(' et ')}.` : 'Continue comme ça !'}`
                    : `${strongest.length > 0 ? `Your strengths: ${strongest.join(', ')}. ` : ''}${weakest.length > 0 ? `We recommend focusing on ${weakest.join(' and ')}.` : 'Keep it up!'}`}
                </p>
              </div>
            </div>

            <button onClick={handleNextLangOrFinish}
              className="w-full flex items-center justify-center gap-2 rounded-xl px-6 py-4 text-lg font-bold transition-all hover:shadow-lg"
              style={{ backgroundColor: '#D9B438', color: '#002844' }}>
              {lang === 'fr' ? 'Accéder au Dashboard' : 'Go to Dashboard'}
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
            {lang === 'fr' ? 'Aucun exercice disponible.' : 'No exercises available.'}
          </p>
          <button onClick={handleNextLangOrFinish} className="rounded-xl bg-[#002844] px-6 py-3 font-semibold text-white">
            {lang === 'fr' ? 'Continuer' : 'Continue'}
          </button>
        </div>
      </div>
    )
  }

  // ========= EXERCISE SCREEN — Mini-lesson style =========
  const currentQ = questions[currentIndex]
  const progressPercent = ((currentIndex + 1) / questions.length) * 100
  const isListening = currentQ.interactionType === 'listening'
  const isSpeaking = currentQ.interactionType === 'speaking'

  // Exercise type label
  const getExerciseLabel = () => {
    // Show interaction type for oral/listening exercises
    if (currentQ.interactionType === 'listening') return lang === 'fr' ? '🎧 Écoute' : '🎧 Listening'
    if (currentQ.interactionType === 'speaking') return lang === 'fr' ? '🎤 Oral' : '🎤 Speaking'
    // Fallback to objective for text exercises
    const obj = currentQ.objective as string
    if (obj === 'grammaire') return lang === 'fr' ? '📝 Grammaire' : '📝 Grammar'
    if (obj === 'vocabulaire') return lang === 'fr' ? '📚 Vocabulaire' : '📚 Vocabulary'
    if (obj === 'lecture') return lang === 'fr' ? '📖 Lecture' : '📖 Reading'
    if (obj === 'ecrit') return lang === 'fr' ? '✍️ Écrit' : '✍️ Writing'
    if (obj === 'oral' || obj === 'ecoute') return lang === 'fr' ? '🎤 Oral' : '🎤 Speaking'
    return ''
  }

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-blue-50 to-white">
      {/* Header — Lesson style */}
      <div className="bg-white px-4 py-4 shadow-sm">
        <div className="mx-auto max-w-lg">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xl">{planLangInfo?.flag}</span>
              <h1 className="text-sm font-bold text-[#002844]">
                {phase === 'cecrl'
                  ? (lang === 'fr' ? 'Première leçon' : 'First lesson')
                  : (lang === 'fr' ? 'Exercices professionnels' : 'Professional exercises')}
              </h1>
            </div>
            <span className="text-xs px-2 py-1 rounded-full bg-[#002844]/10 text-[#002844] font-semibold">
              {getExerciseLabel()}
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${progressPercent}%`, backgroundColor: '#D9B438' }} />
          </div>
        </div>
      </div>

      {/* Exercise card */}
      <div className="flex-1 px-4 py-5">
        <div className="mx-auto max-w-lg">
          <div className="rounded-2xl bg-white p-5 shadow-lg">
            <h2 className="mb-5 text-lg font-semibold text-[#002844]">{lang === 'fr' && currentQ.questionFr ? currentQ.questionFr : currentQ.question}</h2>

            {/* TTS for listening */}
            {isListening && (
              <div className="mb-4">
                {ttsAvailable ? (
                  <button onClick={() => currentQ.audioText && playTTS(currentQ.audioText, planItem?.lang || 'en')}
                    disabled={ttsPlays >= 2}
                    className={`flex items-center gap-2 rounded-xl px-5 py-3 font-semibold transition-all ${
                      ttsPlays >= 2 ? 'bg-gray-100 text-gray-400' : 'bg-[#002844] text-white hover:opacity-90'
                    }`}>
                    <Volume2 className="h-5 w-5" />
                    {ttsPlays === 0 ? (lang === 'fr' ? 'Écouter' : 'Listen') : (lang === 'fr' ? 'Réécouter' : 'Listen again')}
                    {ttsPlays > 0 && <span className="text-xs ml-1">({2 - ttsPlays})</span>}
                  </button>
                ) : (
                  <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-700">
                    {currentQ.audioText && <p className="italic">&quot;{currentQ.audioText}&quot;</p>}
                  </div>
                )}
              </div>
            )}

            {/* Mic for speaking */}
            {isSpeaking && (
              <div className="mb-4">
                {micPermission === 'pending' && (
                  <button onClick={requestMic} className="flex items-center gap-2 rounded-xl bg-[#002844] px-5 py-3 font-semibold text-white hover:opacity-90">
                    <Mic className="h-5 w-5" /> {lang === 'fr' ? 'Parler' : 'Speak'}
                  </button>
                )}
                {micPermission === 'granted' && (
                  <div className="space-y-3">
                    {!isRecording ? (
                      <button onClick={startRecording} className="flex items-center gap-2 rounded-xl bg-[#002844] px-5 py-3 font-semibold text-white hover:opacity-90">
                        <Mic className="h-5 w-5" /> {lang === 'fr' ? 'Parler' : 'Speak'}
                      </button>
                    ) : (
                      <button onClick={stopRecording} className="flex items-center gap-2 rounded-xl bg-red-500 px-5 py-3 font-semibold text-white animate-pulse">
                        <MicOff className="h-5 w-5" /> {lang === 'fr' ? 'Enregistrement...' : 'Recording...'}
                      </button>
                    )}
                    {speechResult && (
                      <div className="p-2 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700 font-medium">&quot;{speechResult}&quot;</div>
                    )}
                  </div>
                )}
                {micPermission === 'denied' && (
                  <div className="p-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                    <MicOff className="h-3 w-3 inline mr-1" /> {lang === 'fr' ? 'Micro non autorisé' : 'Mic not allowed'}
                  </div>
                )}
              </div>
            )}

            {/* Options */}
            {!isSpeaking && (
              <div className="space-y-2.5">
                {currentQ.options.map((option, idx) => {
                  const isSelected = selectedAnswer === idx
                  const isCorrectOption = idx === currentQ.correctAnswer
                  const showCorrectFb = showFeedback && isCorrectOption
                  const showWrongFb = showFeedback && isSelected && !isCorrectOption

                  return (
                    <button key={idx} onClick={() => !showFeedback && setSelectedAnswer(idx)} disabled={showFeedback}
                      className={`flex w-full items-center rounded-xl border-2 p-3.5 text-left transition-all ${
                        showCorrectFb ? 'border-green-500 bg-green-50'
                          : showWrongFb ? 'border-red-400 bg-red-50'
                            : isSelected ? 'border-[#D9B438] bg-[#D9B438]/5'
                              : 'border-gray-200 hover:border-gray-300'
                      }`}>
                      <span className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold ${
                        isSelected && !showFeedback ? 'border-[#D9B438] bg-[#D9B438] text-[#002844]'
                          : showCorrectFb ? 'border-green-500 bg-green-500 text-white'
                            : 'border-gray-300 text-gray-500'
                      }`}>{String.fromCharCode(65 + idx)}</span>
                      <span className="ml-3 flex-1 text-sm text-[#002844]">{option}</span>
                      {showCorrectFb && <CheckCircle className="h-5 w-5 flex-shrink-0 text-green-500" />}
                      {showWrongFb && <XCircle className="h-5 w-5 flex-shrink-0 text-red-400" />}
                    </button>
                  )
                })}
              </div>
            )}

            {/* Encouraging feedback */}
            {showFeedback && (
              <div className={`mt-4 rounded-xl p-3 text-center font-semibold text-sm ${lastCorrect ? 'bg-green-50 text-green-700' : 'bg-orange-50 text-orange-700'}`}>
                {lastCorrect ? <Star className="h-4 w-4 inline mr-1" /> : <BookOpen className="h-4 w-4 inline mr-1" />}
                {feedbackMessage}
              </div>
            )}

            {/* Validate button */}
            {!isSpeaking ? (
              <button onClick={handleValidate} disabled={selectedAnswer === null || showFeedback}
                className="mt-5 w-full rounded-xl px-6 py-3.5 font-bold transition-all disabled:cursor-not-allowed disabled:opacity-30"
                style={{ backgroundColor: selectedAnswer !== null && !showFeedback ? '#D9B438' : '#E5E7EB', color: selectedAnswer !== null && !showFeedback ? '#002844' : '#9CA3AF' }}>
                {lang === 'fr' ? 'Valider' : 'Validate'}
              </button>
            ) : (
              <button onClick={handleSpeakingValidate}
                disabled={showFeedback || (!speechResult && micPermission !== 'denied')}
                className="mt-5 w-full rounded-xl px-6 py-3.5 font-bold transition-all disabled:cursor-not-allowed disabled:opacity-30"
                style={{ backgroundColor: (speechResult || micPermission === 'denied') && !showFeedback ? '#D9B438' : '#E5E7EB', color: (speechResult || micPermission === 'denied') && !showFeedback ? '#002844' : '#9CA3AF' }}>
                {micPermission === 'denied'
                  ? (lang === 'fr' ? 'Passer' : 'Skip')
                  : (lang === 'fr' ? 'Valider' : 'Validate')}
              </button>
            )}
          </div>
        </div>
      </div>
      {/* V3.10 Règle 1: Menu bas permanent */}
      <BottomNav lang={lang} />
    </div>
  )
}
