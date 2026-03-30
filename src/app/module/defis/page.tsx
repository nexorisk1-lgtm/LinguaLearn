/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { getCurrentUser } from '@/lib/db/localStorage'
import { getA1CourseData } from '@/lib/db/bankA1Courses'
import PageHeader from '@/components/PageHeader'
import BottomNav from '@/components/BottomNav'
import { User, InterfaceLanguage } from '@/types'
import { Copy, Check, Loader2, X } from 'lucide-react'

interface SocialChallenge {
  code: string
  type: 'Vocabulaire' | 'Quiz rapide'
  creator: string
  participants: string[]
  durationDays: number
  createdAt: string
  scores: Record<string, number>
}

interface DailyQuizWord {
  word: string
  trad_fr: string
  example_en: string
}

type Section = 'daily' | 'create' | 'join' | 'my-challenges'

export default function DefisPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [lang, setLang] = useState<InterfaceLanguage>('fr')
  const [loading, setLoading] = useState(true)
  const [activeSection, setActiveSection] = useState<Section>('daily')

  // Daily challenge state
  const [dailyCompleted, setDailyCompleted] = useState(false)
  const [dailyScore, setDailyScore] = useState(0)
  const [quizActive, setQuizActive] = useState(false)
  const [quizWords, setQuizWords] = useState<DailyQuizWord[]>([])
  const [currentQuizIdx, setCurrentQuizIdx] = useState(0)
  const [quizStartTime, setQuizStartTime] = useState<number | null>(null)
  const [userAnswers, setUserAnswers] = useState<string[]>([])
  const [quizAnswer, setQuizAnswer] = useState('')
  const [timeLeft, setTimeLeft] = useState(12)
  const [quizResults, setQuizResults] = useState<any>(null)

  // Social challenge state
  const [creatorName, setCreatorName] = useState('')
  const [challengeType, setChallengeType] = useState<'Vocabulaire' | 'Quiz rapide'>('Vocabulaire')
  const [creating, setCreating] = useState(false)
  const [generatedCode, setGeneratedCode] = useState('')
  const [codeCopied, setCodeCopied] = useState(false)

  const [joinCode, setJoinCode] = useState('')
  const [joining, setJoining] = useState(false)
  const [joinedChallenge, setJoinedChallenge] = useState<any>(null)

  const [myChallenges, setMyChallenges] = useState<SocialChallenge[]>([])
  const [loadingChallenges, setLoadingChallenges] = useState(false)

  // Initialize
  useEffect(() => {
    const currentUser = getCurrentUser()
    if (!currentUser) {
      router.push('/auth')
      return
    }
    setUser(currentUser)
    const interfaceLang = currentUser.settings.interfaceLang || 'fr'
    setLang(interfaceLang)
    setCreatorName(currentUser.firstName || '')

    // Check if daily challenge already completed
    const today = new Date().toISOString().split('T')[0]
    const dailyChallengeKey = `dailyChallenge_${today}`
    const storedDaily = localStorage.getItem(dailyChallengeKey)
    if (storedDaily) {
      const parsed = JSON.parse(storedDaily)
      setDailyCompleted(true)
      setDailyScore(parsed.score || 0)
    }

    setLoading(false)
  }, [router])

  // Load my challenges
  const loadMyChallengesCallback = useCallback(async () => {
    if (!user) return
    setLoadingChallenges(true)
    try {
      const response = await fetch(`/api/challenges?userId=${user.id}`)
      if (response.ok) {
        const data = await response.json()
        setMyChallenges(data.challenges || [])
      }
    } catch (error) {
      console.error('Error loading challenges:', error)
    } finally {
      setLoadingChallenges(false)
    }
  }, [user])

  useEffect(() => {
    if (!user) return
    loadMyChallengesCallback()
  }, [user, loadMyChallengesCallback])


  // Daily Challenge Logic
  const finalizeDailyChallenge = useCallback((answers: string[]) => {
    if (quizWords.length === 0) return

    let correctCount = 0
    for (let i = 0; i < quizWords.length; i++) {
      const userAns = answers[i] || ''
      const expected = quizWords[i].word.toLowerCase()
      const expectedTrad = quizWords[i].trad_fr.toLowerCase()

      if (userAns === expected || userAns === expectedTrad) {
        correctCount++
      }
    }

    const score = Math.round((correctCount / quizWords.length) * 100)
    const today = new Date().toISOString().split('T')[0]
    const dailyChallengeKey = `dailyChallenge_${today}`

    localStorage.setItem(dailyChallengeKey, JSON.stringify({ score, date: today, completed: true }))

    setDailyScore(score)
    setDailyCompleted(true)
    setQuizResults({
      score,
      correct: correctCount,
      total: quizWords.length,
    })
  }, [quizWords])

  const generateQuizWords = useCallback(() => {
    let allWords: DailyQuizWord[] = []

    // Get completed courses from localStorage
    const aLang = user?.activeLang || user?.settings.learningLangs[0] || 'en'
    const progressKey = `lingualearn_progress_${aLang}`
    const progress = JSON.parse(typeof window !== 'undefined' ? (localStorage.getItem(progressKey) || '{}') : '{}')
    const completedCourses = progress.completedCourses || []

    for (const completed of completedCourses.slice(0, 5)) {
      const courseData = getA1CourseData(completed.courseId)
      if (courseData && courseData.vocabulary) {
        allWords.push(
          ...courseData.vocabulary.map(v => ({
            word: v.word,
            trad_fr: v.trad_fr,
            example_en: v.example_en,
          }))
        )
      }
    }

    // If no completed courses, use A1_C1 as fallback
    if (allWords.length === 0) {
      const course = getA1CourseData('a1_c1')
      if (course && course.vocabulary) {
        allWords = course.vocabulary.map(v => ({
          word: v.word,
          trad_fr: v.trad_fr,
          example_en: v.example_en,
        }))
      }
    }

    // Shuffle and take 10
    const shuffled = allWords.sort(() => Math.random() - 0.5).slice(0, 10)
    setQuizWords(shuffled)
    return shuffled
  }, [user?.activeLang, user?.settings.learningLangs])

  const handleNextQuizWord = useCallback(() => {
    setCurrentQuizIdx(prev => prev + 1)
    setTimeLeft(12)
  }, [])

  const startDailyChallenge = useCallback(() => {
    const words = generateQuizWords()
    if (words.length === 0) {
      alert(lang === 'fr' ? 'Aucun cours complété.' : 'No completed courses.')
      return
    }
    setQuizActive(true)
    setCurrentQuizIdx(0)
    setUserAnswers([])
    setQuizAnswer('')
    setTimeLeft(12)
    setQuizStartTime(Date.now())
    setQuizResults(null)
  }, [generateQuizWords, lang])

  const handleQuizAnswer = useCallback(() => {
    const newAnswers = [...userAnswers, quizAnswer.trim().toLowerCase()]
    setUserAnswers(newAnswers)
    setQuizAnswer('')
    handleNextQuizWord()
  }, [userAnswers, quizAnswer, handleNextQuizWord])

  // Quiz timer
  useEffect(() => {
    if (!quizActive || quizResults || !quizStartTime) return

    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - quizStartTime) / 1000)
      const remaining = 12 - (elapsed % 12)
      setTimeLeft(remaining <= 0 ? 12 : remaining)

      // Auto-advance after 12 seconds
      if (remaining <= 0 && currentQuizIdx + 1 < quizWords.length) {
        handleNextQuizWord()
      } else if (remaining <= 0 && currentQuizIdx + 1 >= quizWords.length) {
        finalizeDailyChallenge(userAnswers)
      }
    }, 100)

    return () => clearInterval(interval)
  }, [quizActive, quizStartTime, quizResults, currentQuizIdx, quizWords.length, userAnswers, handleNextQuizWord, finalizeDailyChallenge])

  // Social Challenges
  const handleCreateChallenge = async () => {
    if (!creatorName.trim()) {
      alert(lang === 'fr' ? 'Entrez votre nom' : 'Enter your name')
      return
    }

    setCreating(true)
    try {
      const response = await fetch('/api/challenges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creator_name: creatorName,
          challenge_type: challengeType,
          course_id: 'a1_c1',
          duration_days: 7,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setGeneratedCode(data.code || '')
        // Reload challenges
        await loadMyChallengesCallback()
      } else {
        alert(lang === 'fr' ? 'Erreur de création' : 'Creation error')
      }
    } catch (error) {
      console.error('Error creating challenge:', error)
      alert(lang === 'fr' ? 'Erreur de connexion' : 'Connection error')
    } finally {
      setCreating(false)
    }
  }

  const handleJoinChallenge = async () => {
    if (!joinCode.trim()) {
      alert(lang === 'fr' ? 'Entrez un code' : 'Enter a code')
      return
    }

    setJoining(true)
    try {
      const response = await fetch('/api/challenges/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: joinCode.toUpperCase(),
          participant_name: user?.firstName || 'User',
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setJoinedChallenge(data)
        setJoinCode('')
        // Reload challenges
        await loadMyChallengesCallback()
      } else {
        alert(lang === 'fr' ? 'Code invalide' : 'Invalid code')
      }
    } catch (error) {
      console.error('Error joining challenge:', error)
      alert(lang === 'fr' ? 'Erreur de connexion' : 'Connection error')
    } finally {
      setJoining(false)
    }
  }

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code)
    setCodeCopied(true)
    setTimeout(() => setCodeCopied(false), 2000)
  }

  const getTimeRemaining = (createdAt: string, durationDays: number) => {
    const created = new Date(createdAt)
    const deadline = new Date(created.getTime() + durationDays * 24 * 60 * 60 * 1000)
    const now = new Date()
    const diff = deadline.getTime() - now.getTime()

    if (diff <= 0) return lang === 'fr' ? 'Terminé' : 'Finished'

    const days = Math.floor(diff / (24 * 60 * 60 * 1000))
    const hours = Math.floor((diff % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000))

    return `${days}j ${hours}h`
  }

  if (loading || !user) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#F0F0F0]">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-[#002844]" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen bg-[#F0F0F0]">
      <PageHeader title={lang === 'fr' ? 'Défis' : 'Challenges'} backHref="/module/pratiquer" />

      <main className="flex-1 overflow-y-auto px-4 py-4 pb-20">
        {/* Daily Challenge Section */}
        {activeSection === 'daily' && (
          <div className="space-y-4">
            {!quizActive && !quizResults && (
              <div className="bg-gradient-to-br from-[#D9B438] to-[#C9A428] rounded-xl shadow-md p-6 text-white">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-4xl">🔥</span>
                  <div>
                    <h2 className="text-xl font-bold">
                      {lang === 'fr' ? 'Défi du jour' : 'Daily Challenge'}
                    </h2>
                    <p className="text-sm opacity-90">
                      {lang === 'fr' ? 'Révise 10 mots en 2 minutes !' : 'Review 10 words in 2 minutes!'}
                    </p>
                  </div>
                </div>

                {dailyCompleted ? (
                  <div className="space-y-2">
                    <div className="text-center py-4 bg-white/20 rounded-lg">
                      <p className="text-3xl font-bold">{dailyScore}%</p>
                      <p className="text-sm">
                        {lang === 'fr' ? 'Score du jour' : 'Today\'s score'}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <div className="flex-1 bg-white/30 rounded-lg py-2 px-3 text-center text-sm font-semibold">
                        ✅ {lang === 'fr' ? 'Défi du jour' : 'Daily Challenge'}
                      </div>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={startDailyChallenge}
                    className="w-full bg-white text-[#D9B438] font-bold py-3 rounded-lg hover:bg-gray-100 transition-all"
                  >
                    {lang === 'fr' ? 'Commencer' : 'Start'}
                  </button>
                )}
              </div>
            )}

            {quizActive && !quizResults && (
              <div className="bg-white rounded-xl shadow-md p-6 space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-semibold text-[#002844]">
                    {currentQuizIdx + 1} / {quizWords.length}
                  </span>
                  <div className={`text-2xl font-bold ${timeLeft <= 3 ? 'text-red-500 animate-pulse' : 'text-[#002844]'}`}>
                    ⏱️ {timeLeft}s
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                  <p className="text-xs text-gray-600">
                    {lang === 'fr' ? 'Quel est le mot anglais ?' : 'What is the English word?'}
                  </p>
                  <p className="text-lg font-bold text-[#002844]">
                    &ldquo;{quizWords[currentQuizIdx]?.trad_fr}&rdquo;
                  </p>
                  <p className="text-xs text-gray-500 italic">
                    {lang === 'fr' ? 'Exemple :' : 'Example:'} {quizWords[currentQuizIdx]?.example_en}
                  </p>
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={quizAnswer}
                    onChange={e => setQuizAnswer(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleQuizAnswer()}
                    placeholder={lang === 'fr' ? 'Votre réponse...' : 'Your answer...'}
                    autoFocus
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#D9B438]"
                  />
                  <button
                    onClick={handleQuizAnswer}
                    className="bg-[#002844] text-white px-4 py-2 rounded-lg font-semibold hover:bg-[#003d5c] transition-all"
                  >
                    {lang === 'fr' ? 'OK' : 'OK'}
                  </button>
                </div>
              </div>
            )}

            {quizResults && (
              <div className="bg-white rounded-xl shadow-md p-6 space-y-4">
                <div className="text-center py-6 bg-gradient-to-br from-[#D9B438]/10 to-[#002844]/5 rounded-lg space-y-2">
                  <p className="text-4xl">
                    {quizResults.score >= 80 ? '🎉' : quizResults.score >= 60 ? '👍' : '💪'}
                  </p>
                  <p className="text-3xl font-bold text-[#002844]">{quizResults.score}%</p>
                  <p className="text-sm text-gray-600">
                    {quizResults.correct} {lang === 'fr' ? 'sur' : 'out of'} {quizResults.total}
                  </p>
                </div>

                <button
                  onClick={() => {
                    setQuizActive(false)
                    setQuizResults(null)
                    setActiveSection('daily')
                  }}
                  className="w-full bg-[#002844] text-white font-bold py-3 rounded-lg hover:bg-[#003d5c] transition-all"
                >
                  {lang === 'fr' ? 'Retour' : 'Back'}
                </button>
              </div>
            )}

            {/* Social challenges teaser */}
            <div className="grid grid-cols-2 gap-3 mt-6">
              <button
                onClick={() => setActiveSection('create')}
                className="bg-white rounded-lg shadow-sm p-4 text-center hover:shadow-md transition-all"
              >
                <span className="text-3xl block mb-2">➕</span>
                <p className="text-sm font-semibold text-[#002844]">
                  {lang === 'fr' ? 'Créer' : 'Create'}
                </p>
              </button>
              <button
                onClick={() => setActiveSection('join')}
                className="bg-white rounded-lg shadow-sm p-4 text-center hover:shadow-md transition-all"
              >
                <span className="text-3xl block mb-2">🔗</span>
                <p className="text-sm font-semibold text-[#002844]">
                  {lang === 'fr' ? 'Rejoindre' : 'Join'}
                </p>
              </button>
            </div>
          </div>
        )}

        {/* Create Challenge Section */}
        {activeSection === 'create' && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl shadow-md p-6 space-y-4">
              <h2 className="text-lg font-bold text-[#002844] flex items-center gap-2">
                <span>➕</span>
                {lang === 'fr' ? 'Créer un défi' : 'Create a Challenge'}
              </h2>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-[#002844]">
                  {lang === 'fr' ? 'Votre nom' : 'Your name'}
                </label>
                <input
                  type="text"
                  value={creatorName}
                  onChange={e => setCreatorName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#D9B438]"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-[#002844]">
                  {lang === 'fr' ? 'Type de défi' : 'Challenge type'}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(['Vocabulaire', 'Quiz rapide'] as const).map(type => (
                    <button
                      key={type}
                      onClick={() => setChallengeType(type)}
                      className={`py-2 px-3 rounded-lg text-sm font-semibold transition-all ${
                        challengeType === type
                          ? 'bg-[#002844] text-white'
                          : 'bg-gray-100 text-[#002844] hover:bg-gray-200'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={handleCreateChallenge}
                disabled={creating}
                className="w-full bg-gradient-to-br from-[#D9B438] to-[#C9A428] text-white font-bold py-3 rounded-lg hover:shadow-md transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {creating && <Loader2 className="h-4 w-4 animate-spin" />}
                {lang === 'fr' ? 'Créer' : 'Create'}
              </button>

              {generatedCode && (
                <div className="bg-green-50 rounded-lg p-4 space-y-2 border border-green-200">
                  <p className="text-sm font-semibold text-green-700">
                    {lang === 'fr' ? 'Code généré !' : 'Code generated!'}
                  </p>
                  <div className="flex items-center gap-2 bg-white rounded border border-green-200 p-2">
                    <code className="flex-1 text-lg font-mono font-bold text-[#002844]">
                      {generatedCode}
                    </code>
                    <button
                      onClick={() => copyCode(generatedCode)}
                      className="p-2 hover:bg-gray-100 rounded transition-colors"
                    >
                      {codeCopied ? (
                        <Check className="h-4 w-4 text-green-600" />
                      ) : (
                        <Copy className="h-4 w-4 text-gray-600" />
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-gray-600">
                    {lang === 'fr'
                      ? 'Partage ce code avec tes amis pour qu\'ils te rejoignent!'
                      : 'Share this code with friends to join!'}
                  </p>
                </div>
              )}
            </div>

            <button
              onClick={() => setActiveSection('daily')}
              className="w-full bg-white text-[#002844] font-semibold py-3 rounded-lg hover:bg-gray-50 transition-all border border-gray-200"
            >
              {lang === 'fr' ? 'Retour' : 'Back'}
            </button>
          </div>
        )}

        {/* Join Challenge Section */}
        {activeSection === 'join' && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl shadow-md p-6 space-y-4">
              <h2 className="text-lg font-bold text-[#002844] flex items-center gap-2">
                <span>🔗</span>
                {lang === 'fr' ? 'Rejoindre un défi' : 'Join a Challenge'}
              </h2>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-[#002844]">
                  {lang === 'fr' ? 'Code du défi' : 'Challenge code'}
                </label>
                <input
                  type="text"
                  value={joinCode}
                  onChange={e => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="ABC123"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono uppercase focus:outline-none focus:border-[#D9B438]"
                />
              </div>

              <button
                onClick={handleJoinChallenge}
                disabled={joining}
                className="w-full bg-gradient-to-br from-[#D9B438] to-[#C9A428] text-white font-bold py-3 rounded-lg hover:shadow-md transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {joining && <Loader2 className="h-4 w-4 animate-spin" />}
                {lang === 'fr' ? 'Rejoindre' : 'Join'}
              </button>

              {joinedChallenge && (
                <div className="bg-blue-50 rounded-lg p-4 space-y-2 border border-blue-200">
                  <div className="flex items-start gap-2">
                    <span className="text-2xl">✅</span>
                    <div className="flex-1">
                      <p className="font-semibold text-blue-700">
                        {lang === 'fr' ? 'Défi rejoint !' : 'Challenge joined!'}
                      </p>
                      <p className="text-xs text-gray-600 mt-1">
                        {lang === 'fr' ? 'Créé par ' : 'Created by '} {joinedChallenge.creator}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={() => setActiveSection('daily')}
              className="w-full bg-white text-[#002844] font-semibold py-3 rounded-lg hover:bg-gray-50 transition-all border border-gray-200"
            >
              {lang === 'fr' ? 'Retour' : 'Back'}
            </button>
          </div>
        )}

        {/* My Challenges Section */}
        {activeSection === 'my-challenges' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-[#002844]">
                {lang === 'fr' ? 'Mes défis en cours' : 'My Active Challenges'}
              </h2>
              <button
                onClick={() => setActiveSection('daily')}
                className="p-2 hover:bg-white rounded-lg transition-colors"
              >
                <X className="h-5 w-5 text-[#002844]" />
              </button>
            </div>

            {loadingChallenges ? (
              <div className="flex justify-center py-6">
                <Loader2 className="h-6 w-6 animate-spin text-[#002844]" />
              </div>
            ) : myChallenges.length === 0 ? (
              <div className="bg-white rounded-lg p-6 text-center space-y-2">
                <p className="text-gray-600">
                  {lang === 'fr'
                    ? 'Aucun défi en cours. Créez ou rejoignez un défi !'
                    : 'No active challenges. Create or join one!'}
                </p>
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={() => setActiveSection('create')}
                    className="flex-1 bg-[#002844] text-white py-2 rounded-lg text-sm font-semibold hover:bg-[#003d5c] transition-all"
                  >
                    {lang === 'fr' ? 'Créer' : 'Create'}
                  </button>
                  <button
                    onClick={() => setActiveSection('join')}
                    className="flex-1 bg-[#D9B438] text-[#002844] py-2 rounded-lg text-sm font-semibold hover:bg-[#C9A428] transition-all"
                  >
                    {lang === 'fr' ? 'Rejoindre' : 'Join'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {myChallenges.map((challenge, idx) => (
                  <div key={idx} className="bg-white rounded-lg shadow-sm p-4 space-y-2 hover:shadow-md transition-all">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-semibold text-[#002844]">{challenge.type}</p>
                        <p className="text-xs text-gray-600">
                          {lang === 'fr' ? 'Créé par ' : 'Created by '} {challenge.creator}
                        </p>
                      </div>
                      <div className="text-right">
                        <code className="text-sm font-mono font-bold text-[#D9B438]">
                          {challenge.code}
                        </code>
                        <p className="text-xs text-gray-500 mt-1">
                          {getTimeRemaining(challenge.createdAt, challenge.durationDays)}
                        </p>
                      </div>
                    </div>

                    <div className="bg-gray-50 rounded py-2 px-3 text-xs space-y-1">
                      <p className="text-gray-600">
                        <span className="font-semibold">{challenge.participants.length}</span>{' '}
                        {lang === 'fr' ? 'participant(s)' : 'participant(s)'}
                      </p>
                      <div className="flex gap-1 flex-wrap">
                        {challenge.participants.slice(0, 3).map((p, pidx) => (
                          <span key={pidx} className="bg-[#D9B438]/20 text-[#002844] px-2 py-0.5 rounded text-[10px]">
                            {p}
                          </span>
                        ))}
                        {challenge.participants.length > 3 && (
                          <span className="bg-gray-200 text-gray-600 px-2 py-0.5 rounded text-[10px]">
                            +{challenge.participants.length - 3}
                          </span>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => copyCode(challenge.code)}
                      className="w-full text-center bg-[#002844] text-white py-1.5 rounded text-sm font-semibold hover:bg-[#003d5c] transition-all flex items-center justify-center gap-2"
                    >
                      {codeCopied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      {lang === 'fr' ? 'Copier le code' : 'Copy code'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Navigation buttons */}
        {activeSection === 'daily' && (
          <div className="mt-6 grid grid-cols-1 gap-2">
            <button
              onClick={() => setActiveSection('my-challenges')}
              className="bg-white text-[#002844] font-semibold py-3 rounded-lg hover:shadow-md transition-all border border-gray-200 flex items-center justify-center gap-2"
            >
              <span>📋</span>
              {lang === 'fr' ? 'Mes défis en cours' : 'My Challenges'}
            </button>
          </div>
        )}
      </main>

      <BottomNav lang={lang} />
    </div>
  )
}
