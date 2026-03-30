/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getCurrentUser } from '@/lib/db/localStorage'
import { User, InterfaceLanguage } from '@/types'
import PageHeader from '@/components/PageHeader'
import BottomNav from '@/components/BottomNav'
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'

interface LeaderboardEntry {
  rank: number
  user_id: string
  user_name: string
  total_score: number
  learning_score: number
  game_score: number
  is_current_user: boolean
}

interface LeaderboardResponse {
  week_start: string
  leaderboard: LeaderboardEntry[]
  user_position: LeaderboardEntry | null
}

// Week calculation utility
function getWeekString(date: Date): string {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7))
  const week1 = new Date(d.getFullYear(), 0, 4)
  const weekNum = 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7)
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`
}

// Parse week string to get start date
function getWeekStartDate(weekStr: string): Date {
  const [year, week] = weekStr.split('-W').map(Number)
  const simple = new Date(year, 0, 4)
  const dow = simple.getDay()
  const ISOweekStart = simple.valueOf() - (dow <= 4 ? dow - 1 : dow + 6) * 86400000
  return new Date(ISOweekStart + (week - 1) * 7 * 86400000)
}

// Format week display: "Semaine du X au Y"
function formatWeekDisplay(weekStr: string, lang: InterfaceLanguage): string {
  const startDate = getWeekStartDate(weekStr)
  const endDate = new Date(startDate)
  endDate.setDate(endDate.getDate() + 6)

  const formatter = new Intl.DateTimeFormat(lang === 'fr' ? 'fr-FR' : 'en-US', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })

  if (lang === 'fr') {
    return `Semaine du ${formatter.format(startDate).split(' ').slice(0, 1).join('')} au ${formatter.format(endDate)}`
  } else {
    return `Week ${formatter.format(startDate)} - ${formatter.format(endDate)}`
  }
}

// Get medal emoji for top 3
function getMedalEmoji(rank: number): string {
  if (rank === 1) return '🥇'
  if (rank === 2) return '🥈'
  if (rank === 3) return '🥉'
  return ''
}

// Aggregate local scores from localStorage
function getLocalAggregatedScore(user: User): number {
  const activeLang = user.activeLang || user.settings.learningLangs[0] || 'en'
  const progress = user.progress[activeLang]

  if (!progress) return 0

  // Sum the three score types
  const learningScore = (progress as any)?.learningScore || 0
  const gameScore = (progress as any)?.gameScore || 0
  const battleScore = (progress as any)?.battleScore || 0

  return learningScore + gameScore + battleScore
}

export default function ClassementPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [lang, setLang] = useState<InterfaceLanguage>('fr')
  const [loading, setLoading] = useState(true)
  const [fetching, setFetching] = useState(false)
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [userPosition, setUserPosition] = useState<LeaderboardEntry | null>(null)
  const [currentWeek, setCurrentWeek] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [submittingScore, setSubmittingScore] = useState(false)
  const [localScore, setLocalScore] = useState(0)

  // Init: load user and current week
  useEffect(() => {
    const currentUser = getCurrentUser()
    if (!currentUser) {
      router.push('/auth')
      return
    }
    setUser(currentUser)
    const interfaceLang = currentUser.settings.interfaceLang || 'fr'
    setLang(interfaceLang)

    const now = new Date()
    const week = getWeekString(now)
    setCurrentWeek(week)

    // Calculate local score
    const score = getLocalAggregatedScore(currentUser)
    setLocalScore(score)

    setLoading(false)
  }, [router])

  // Fetch leaderboard when week changes
  useEffect(() => {
    if (!user || !currentWeek) return

    const fetchLeaderboard = async () => {
      setFetching(true)
      setError(null)
      try {
        const response = await fetch(`/api/leaderboard?userId=${user.id}&week=${currentWeek}`)
        if (!response.ok) {
          throw new Error('Failed to fetch leaderboard')
        }
        const data: LeaderboardResponse = await response.json()
        setLeaderboard(data.leaderboard || [])
        setUserPosition(data.user_position || null)
      } catch (err) {
        console.error('Error fetching leaderboard:', err)
        setError(lang === 'fr' ? 'Classement non disponible' : 'Leaderboard unavailable')
        setLeaderboard([])
        setUserPosition(null)
      } finally {
        setFetching(false)
      }
    }

    fetchLeaderboard()
  }, [user, currentWeek, lang])

  // Handle week navigation
  const goToPreviousWeek = () => {
    const [year, week] = currentWeek.split('-W').map(Number)
    let newWeek = week - 1
    let newYear = year

    if (newWeek < 1) {
      newYear -= 1
      newWeek = 53
    }

    setCurrentWeek(`${newYear}-W${String(newWeek).padStart(2, '0')}`)
  }

  const goToNextWeek = () => {
    const [year, week] = currentWeek.split('-W').map(Number)
    let newWeek = week + 1
    let newYear = year

    if (newWeek > 53) {
      newYear += 1
      newWeek = 1
    }

    setCurrentWeek(`${newYear}-W${String(newWeek).padStart(2, '0')}`)
  }

  // Submit local score to API
  const handleSubmitScore = async () => {
    if (!user || localScore === 0) return

    setSubmittingScore(true)
    try {
      const response = await fetch('/api/scores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          user_name: user.firstName || 'Unknown',
          score_type: 'weekly',
          score: localScore,
          week: currentWeek
        })
      })

      if (!response.ok) {
        throw new Error('Failed to submit score')
      }

      // Refresh leaderboard after submitting
      const fetchResponse = await fetch(`/api/leaderboard?userId=${user.id}&week=${currentWeek}`)
      if (fetchResponse.ok) {
        const data: LeaderboardResponse = await fetchResponse.json()
        setLeaderboard(data.leaderboard || [])
        setUserPosition(data.user_position || null)
      }
    } catch (err) {
      console.error('Error submitting score:', err)
    } finally {
      setSubmittingScore(false)
    }
  }

  if (loading || !user) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#F0F0F0]">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-[#002844]" />
      </div>
    )
  }

  const isCurrentWeek = getWeekString(new Date()) === currentWeek

  return (
    <div className="flex flex-col h-screen bg-[#F0F0F0]">
      <PageHeader title={lang === 'fr' ? 'Classement' : 'Rankings'} backHref="/module/pratiquer" />

      {/* Main content */}
      <main className="flex-1 overflow-y-auto px-4 py-4 pb-24">
        {/* Week selector */}
        <div className="bg-white rounded-xl shadow-sm p-4 mb-4">
          <div className="flex items-center justify-between gap-3">
            <button
              onClick={goToPreviousWeek}
              className="w-10 h-10 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
            >
              <ChevronLeft className="h-5 w-5 text-[#002844]" />
            </button>

            <div className="flex-1 text-center">
              <p className="text-sm font-semibold text-[#002844]">
                {formatWeekDisplay(currentWeek, lang)}
              </p>
              {!isCurrentWeek && (
                <p className="text-xs text-gray-500 mt-1">
                  {lang === 'fr' ? 'Semaine passée' : 'Previous week'}
                </p>
              )}
            </div>

            <button
              onClick={goToNextWeek}
              className="w-10 h-10 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
            >
              <ChevronRight className="h-5 w-5 text-[#002844]" />
            </button>
          </div>
        </div>

        {/* User position card */}
        {userPosition && (
          <div className="bg-gradient-to-br from-[#D9B438] to-[#C9A428] rounded-xl shadow-md p-5 mb-6 text-white">
            <div className="text-center">
              <p className="text-sm font-medium opacity-90">
                {lang === 'fr' ? 'Votre position' : 'Your position'}
              </p>
              <div className="flex items-baseline justify-center gap-2 mt-2">
                <span className="text-4xl font-bold">#{userPosition.rank}</span>
                <span className="text-2xl font-semibold">{userPosition.total_score}</span>
              </div>
              <p className="text-xs font-medium opacity-75 mt-2">
                {lang === 'fr' ? 'points cette semaine' : 'points this week'}
              </p>
            </div>
          </div>
        )}

        {/* Loading indicator */}
        {fetching && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-[#002844]" />
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
            <p className="text-sm text-red-700">{error}</p>
            {error.includes('non disponible') || error.includes('unavailable') ? (
              <p className="text-xs text-red-600 mt-1">
                {lang === 'fr' ? 'Connectez Supabase pour voir le classement' : 'Connect Supabase to view rankings'}
              </p>
            ) : null}
          </div>
        )}

        {/* Empty state */}
        {!error && !fetching && leaderboard.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500 text-sm">
              {lang === 'fr' ? 'Pas encore de classement cette semaine' : 'No rankings yet this week'}
            </p>
          </div>
        )}

        {/* Leaderboard list */}
        {!fetching && leaderboard.length > 0 && (
          <div className="space-y-3">
            {leaderboard.map((entry) => {
              const isMedal = entry.rank <= 3
              const isCurrentUser = entry.is_current_user

              return (
                <div
                  key={entry.user_id}
                  className={`rounded-xl p-4 flex items-center gap-4 transition-all ${
                    isCurrentUser
                      ? 'bg-[#D9B438]/10 border-2 border-[#D9B438] shadow-md'
                      : 'bg-white shadow-sm'
                  }`}
                >
                  {/* Rank with medal */}
                  <div className={`flex-shrink-0 w-12 flex items-center justify-center font-bold text-lg ${
                    isMedal ? 'text-2xl' : 'text-[#002844]'
                  }`}>
                    {isMedal ? getMedalEmoji(entry.rank) : entry.rank}
                  </div>

                  {/* Player name */}
                  <div className="flex-1 min-w-0">
                    <p className={`font-semibold truncate ${isCurrentUser ? 'text-[#D9B438]' : 'text-[#002844]'}`}>
                      {entry.user_name}
                    </p>
                    {isMedal && (
                      <p className="text-xs text-gray-500 mt-0.5">
                        {entry.rank === 1 ? (lang === 'fr' ? '1er' : '1st') : `${entry.rank}${lang === 'fr' ? 'e' : ''}`}
                      </p>
                    )}
                  </div>

                  {/* Score */}
                  <div className="flex-shrink-0 text-right">
                    <p className={`text-xl font-bold ${isCurrentUser ? 'text-[#D9B438]' : 'text-[#002844]'}`}>
                      {entry.total_score}
                    </p>
                    <p className="text-xs text-gray-500">
                      {lang === 'fr' ? 'pts' : 'pts'}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* User's position card (if not in top 10) */}
        {!fetching && userPosition && !leaderboard.some(e => e.user_id === userPosition.user_id) && (
          <div className="mt-6 pt-4 border-t border-gray-200">
            <p className="text-xs text-gray-500 mb-3">
              {lang === 'fr' ? 'Votre classement' : 'Your ranking'}
            </p>
            <div className="bg-[#D9B438]/10 border-2 border-[#D9B438] rounded-xl p-4 flex items-center gap-4">
              <div className="flex-shrink-0 w-12 flex items-center justify-center font-bold text-lg text-[#002844]">
                {userPosition.rank}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-[#D9B438] truncate">
                  {userPosition.user_name}
                </p>
              </div>
              <div className="flex-shrink-0 text-right">
                <p className="text-xl font-bold text-[#D9B438]">
                  {userPosition.total_score}
                </p>
                <p className="text-xs text-gray-500">
                  {lang === 'fr' ? 'pts' : 'pts'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Submit score button */}
        {localScore > 0 && !userPosition && isCurrentWeek && (
          <div className="mt-6 bg-blue-50 border border-blue-200 rounded-xl p-4">
            <p className="text-sm text-blue-900 mb-3">
              {lang === 'fr'
                ? `Vous avez ${localScore} points à soumettre`
                : `You have ${localScore} points to submit`}
            </p>
            <button
              onClick={handleSubmitScore}
              disabled={submittingScore}
              className="w-full bg-gradient-to-r from-[#002844] to-[#004a6d] text-white font-semibold py-3 rounded-lg hover:shadow-md transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {submittingScore ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {lang === 'fr' ? 'Soumission...' : 'Submitting...'}
                </>
              ) : (
                lang === 'fr' ? 'Soumettre mon score' : 'Submit my score'
              )}
            </button>
          </div>
        )}
      </main>

      <BottomNav lang={lang} />
    </div>
  )
}
