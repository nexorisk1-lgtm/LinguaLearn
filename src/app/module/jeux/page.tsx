'use client'

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getCurrentUser } from '@/lib/db/localStorage'
import { User, InterfaceLanguage } from '@/types'
import PageHeader from '@/components/PageHeader'
import BottomNav from '@/components/BottomNav'
import { Brain, Link2, Puzzle, Mic } from 'lucide-react'

interface GameCard {
  id: 'quiz' | 'association' | 'puzzle' | 'oral'
  emoji: string
  titleFr: string
  titleEn: string
  descFr: string
  descEn: string
  icon: typeof Brain
}

const GAME_CARDS: GameCard[] = [
  {
    id: 'quiz',
    emoji: '🧠',
    titleFr: 'Quiz Rapide',
    titleEn: 'Quiz Rapide',
    descFr: 'QCM rapide, 5s par question',
    descEn: 'Fast MCQ, 5s per question',
    icon: Brain,
  },
  {
    id: 'association',
    emoji: '🔗',
    titleFr: 'Association',
    titleEn: 'Association',
    descFr: 'Relie les mots à leur traduction',
    descEn: 'Match words to translations',
    icon: Link2,
  },
  {
    id: 'puzzle',
    emoji: '🧩',
    titleFr: 'Puzzle Phrase',
    titleEn: 'Puzzle Phrase',
    descFr: 'Remets les mots dans l\'ordre',
    descEn: 'Reorder words in sentences',
    icon: Puzzle,
  },
  {
    id: 'oral',
    emoji: '🎤',
    titleFr: 'Oral Rapide',
    titleEn: 'Oral Rapide',
    descFr: 'Dis le mot en anglais',
    descEn: 'Say the word in English',
    icon: Mic,
  },
]

export default function GameHubPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [lang, setLang] = useState<InterfaceLanguage>('fr')
  const [loading, setLoading] = useState(true)
  const [gameScore, setGameScore] = useState(0)
  const [hasCompletedCourses, setHasCompletedCourses] = useState(false)

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
    setHasCompletedCourses(completedCourseIds.length > 0)

    // Load game score
    const gameScoreKey = `lingualearn_game_score_${currentUser.id}`
    const savedScore = localStorage.getItem(gameScoreKey)
    if (savedScore) {
      try {
        setGameScore(parseInt(savedScore, 10))
      } catch {
        setGameScore(0)
      }
    }

    setLoading(false)
  }, [router])

  if (loading || !user) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#F0F0F0]">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-[#002844]" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen bg-[#F0F0F0]">
      <PageHeader title={lang === 'fr' ? 'Jeux' : 'Games'} backHref="/dashboard" />

      {/* Game Score */}
      <div className="px-4 py-3 bg-white border-b">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🏆</span>
          <div>
            <p className="text-xs text-gray-600">{lang === 'fr' ? 'Score aux Jeux' : 'Game Score'}</p>
            <p className="text-xl font-bold text-[#002844]">{gameScore.toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* Unlock message or game cards */}
      {!hasCompletedCourses ? (
        <main className="flex-1 flex items-center justify-center px-4">
          <div className="text-center max-w-sm">
            <p className="text-4xl mb-4">🔒</p>
            <p className="text-lg font-bold text-[#002844] mb-2">
              {lang === 'fr' ? 'Jeux Verrouillés' : 'Games Locked'}
            </p>
            <p className="text-sm text-gray-600">
              {lang === 'fr'
                ? 'Termine au moins un cours pour déverrouiller les jeux et gagner des points !'
                : 'Complete at least one course to unlock games and earn points!'}
            </p>
          </div>
        </main>
      ) : (
        <main className="flex-1 overflow-y-auto px-4 py-6 pb-20">
          <div className="max-w-lg mx-auto grid grid-cols-1 gap-4">
            {GAME_CARDS.map(game => (
              <button
                key={game.id}
                onClick={() => router.push(`/module/jeux/${game.id}`)}
                className="bg-white rounded-2xl p-5 shadow-sm hover:shadow-md transition-all border-l-4 border-[#D9B438] active:scale-95"
              >
                <div className="flex items-start gap-4">
                  <div className="text-4xl">{game.emoji}</div>
                  <div className="flex-1 text-left">
                    <h3 className="font-bold text-lg text-[#002844]">
                      {lang === 'fr' ? game.titleFr : game.titleEn}
                    </h3>
                    <p className="text-xs text-gray-600 mt-1">
                      {lang === 'fr' ? game.descFr : game.descEn}
                    </p>
                  </div>
                  <div className="text-[#D9B438] text-xl">→</div>
                </div>
              </button>
            ))}
          </div>
        </main>
      )}

      <BottomNav lang={lang} />
    </div>
  )
}
