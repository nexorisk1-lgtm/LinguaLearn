'use client'

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { getCurrentUser } from '@/lib/db/localStorage'
import { getA1CourseVocabulary } from '@/lib/db/bankA1Courses'
import { User, InterfaceLanguage } from '@/types'
import PageHeader from '@/components/PageHeader'
import BottomNav from '@/components/BottomNav'

interface Pair {
  id: string
  french: string
  english: string
  matched: boolean
}

interface Card {
  pairId: string
  type: 'fr' | 'en'
  text: string
  index: number
}

export default function AssociationPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [lang, setLang] = useState<InterfaceLanguage>('fr')
  const [loading, setLoading] = useState(true)
  const [pairs, setPairs] = useState<Pair[]>([])
  const [cards, setCards] = useState<Card[]>([])
  const [selectedCards, setSelectedCards] = useState<string[]>([])
  const [matchedPairs, setMatchedPairs] = useState<Set<string>>(new Set())
  const [startTime, setStartTime] = useState(Date.now())
  const [gameEnded, setGameEnded] = useState(false)
  const [score, setScore] = useState(0)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const [elapsedTime, setElapsedTime] = useState(0)

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

    // Gather all vocabulary
    const allVocab: any[] = []
    for (const courseId of completedCourseIds) {
      const vocab = getA1CourseVocabulary(courseId)
      allVocab.push(...vocab)
    }

    if (allVocab.length < 4) {
      router.push('/module/jeux')
      return
    }

    // Build 4 pairs
    const shuffledVocab = shuffleArray(allVocab).slice(0, 4)
    const newPairs: Pair[] = shuffledVocab.map((word, idx) => ({
      id: `pair${idx}`,
      french: word.word_fr,
      english: word.word_target,
      matched: false,
    }))
    setPairs(newPairs)

    // Shuffle cards
    const allCards: Card[] = []
    newPairs.forEach(pair => {
      allCards.push({ pairId: pair.id, type: 'fr', text: pair.french, index: 0 })
      allCards.push({ pairId: pair.id, type: 'en', text: pair.english, index: 0 })
    })
    const shuffledCards = shuffleArray(allCards)
    setCards(shuffledCards)
    setStartTime(Date.now())
    setLoading(false)
  }, [router])

  // Timer for elapsed time
  useEffect(() => {
    if (gameEnded) return
    timerRef.current = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTime) / 1000))
    }, 100)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [gameEnded, startTime])

  // Check for match
  useEffect(() => {
    if (selectedCards.length !== 2) return

    const [card1Idx, card2Idx] = selectedCards.map(idx => parseInt(idx, 10))
    const card1 = cards[card1Idx]
    const card2 = cards[card2Idx]

    if (card1.pairId === card2.pairId && card1.type !== card2.type) {
      // Correct match
      setMatchedPairs(prev => new Set(prev).add(card1.pairId))
      setSelectedCards([])

      // Check if game ended
      if (matchedPairs.size === pairs.length - 1) {
        const baseScore = 50
        const speedBonus = Math.max(0, 50 - elapsedTime * 2)
        const totalScore = baseScore + speedBonus
        setScore(totalScore)
        setGameEnded(true)

        // Save score
        if (user) {
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
              source: 'association',
            }),
          }).catch(() => {})
        }
      }
    } else {
      // Wrong match - flash red
      setTimeout(() => {
        setSelectedCards([])
      }, 600)
    }
  }, [selectedCards, cards, matchedPairs, pairs.length, gameEnded, user, elapsedTime])

  const handleCardClick = (index: number) => {
    if (matchedPairs.has(cards[index].pairId)) return
    if (selectedCards.includes(index.toString())) return
    if (selectedCards.length >= 2) return

    setSelectedCards([...selectedCards, index.toString()])
  }

  if (loading || !user || cards.length === 0) {
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
          title={lang === 'fr' ? 'Association - Résultats' : 'Association - Results'}
          backHref="/module/jeux"
        />

        <main className="flex-1 flex items-center justify-center px-4 pb-20">
          <div className="text-center max-w-sm">
            <div className="text-6xl mb-4">🎉</div>
            <p className="text-3xl font-bold text-[#002844] mb-2">
              {score.toFixed(0)} {lang === 'fr' ? 'points' : 'points'}
            </p>
            <p className="text-sm text-gray-600 mb-2">
              {lang === 'fr' ? 'Temps' : 'Time'}: {elapsedTime}s
            </p>
            <p className="text-lg font-bold text-[#002844] mb-6">
              {lang === 'fr' ? 'Toutes les paires trouvées !' : 'All pairs matched!'}
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

  return (
    <div className="flex flex-col h-screen bg-[#F0F0F0]">
      <PageHeader
        title={lang === 'fr' ? 'Association' : 'Association'}
        backHref="/module/jeux"
      />

      {/* Status bar */}
      <div className="bg-white px-4 py-3 border-b">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-gray-600">
            {matchedPairs.size}/{pairs.length} {lang === 'fr' ? 'paires' : 'pairs'}
          </span>
          <span className="text-xs font-bold text-[#D9B438]">
            {lang === 'fr' ? 'Temps' : 'Time'}: {elapsedTime}s
          </span>
        </div>
      </div>

      <main className="flex-1 flex items-center justify-center px-4 pb-20">
        <div className="max-w-2xl w-full">
          <div className="grid grid-cols-2 gap-3">
            {cards.map((card, idx) => {
              const isMatched = matchedPairs.has(card.pairId)
              const isSelected = selectedCards.includes(idx.toString())
              const isWrong = selectedCards.length === 2 && selectedCards.includes(idx.toString())
                ? cards[parseInt(selectedCards[0], 10)].pairId !== card.pairId
                : false

              let bgClass = 'bg-white'
              let borderClass = 'border-2 border-gray-200'
              let textClass = 'text-[#002844]'

              if (isMatched) {
                bgClass = 'bg-green-100'
                borderClass = 'border-2 border-green-500'
                textClass = 'text-green-700'
              } else if (isWrong) {
                bgClass = 'bg-red-100 animate-pulse'
                borderClass = 'border-2 border-red-500'
                textClass = 'text-red-700'
              } else if (isSelected) {
                bgClass = 'bg-[#002844]'
                borderClass = 'border-2 border-[#002844]'
                textClass = 'text-white'
              }

              return (
                <button
                  key={idx}
                  onClick={() => handleCardClick(idx)}
                  disabled={isMatched}
                  className={`py-6 px-3 rounded-xl font-bold transition-all min-h-[120px] flex items-center justify-center text-center text-sm ${bgClass} ${borderClass} ${textClass} disabled:cursor-not-allowed hover:shadow-md`}
                >
                  {isMatched ? '✓' : card.text}
                </button>
              )
            })}
          </div>

          <p className="text-xs text-center text-gray-600 mt-4">
            {lang === 'fr' ? 'Appuie sur deux cartes pour les associer' : 'Tap two cards to match them'}
          </p>
        </div>
      </main>

      <BottomNav lang={lang} />
    </div>
  )
}
