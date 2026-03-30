'use client'

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { getCurrentUser } from '@/lib/db/localStorage'
import { getA1CourseVocabulary } from '@/lib/db/bankA1Courses'
import { User, InterfaceLanguage } from '@/types'
import PageHeader from '@/components/PageHeader'
import BottomNav from '@/components/BottomNav'
import { Mic, MicOff } from 'lucide-react'

interface OralWord {
  id: string
  french: string
  english: string
}

interface RoundState {
  word: OralWord
  transcript: string
  isListening: boolean
  isCorrect: boolean | null
  timeLeft: number
}

export default function OralPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [lang, setLang] = useState<InterfaceLanguage>('fr')
  const [loading, setLoading] = useState(true)
  const [words, setWords] = useState<OralWord[]>([])
  const [currentRound, setCurrentRound] = useState(0)
  const [score, setScore] = useState(0)
  const [gameEnded, setGameEnded] = useState(false)
  const [roundState, setRoundState] = useState<RoundState | null>(null)
  const [speechSupported, setSpeechSupported] = useState(false)
  const recognitionRef = useRef<any>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  // Fisher-Yates shuffle
  function shuffleArray<T>(arr: T[]): T[] {
    const shuffled = [...arr]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    return shuffled
  }

  // Initialize speech recognition
  useEffect(() => {
    const SpeechRecognition = window.webkitSpeechRecognition || (window as any).SpeechRecognition
    if (SpeechRecognition) {
      setSpeechSupported(true)
      const recognition = new SpeechRecognition()
      recognition.continuous = false
      recognition.interimResults = true
      recognition.lang = 'en-US'

      recognition.onstart = () => {
        setRoundState(prev => prev ? { ...prev, isListening: true } : null)
      }

      recognition.onresult = (event: any) => {
        let transcript = ''
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript
        }
        setRoundState(prev => prev ? { ...prev, transcript: transcript.trim() } : null)
      }

      recognition.onend = () => {
        setRoundState(prev => prev ? { ...prev, isListening: false } : null)
      }

      recognition.onerror = () => {
        setRoundState(prev => prev ? { ...prev, isListening: false } : null)
      }

      recognitionRef.current = recognition
    }
  }, [])

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

    if (allVocab.length < 5) {
      router.push('/module/jeux')
      return
    }

    // Build 5 words
    const shuffledVocab = shuffleArray(allVocab).slice(0, 5)
    const oralWords: OralWord[] = shuffledVocab.map((word, idx) => ({
      id: `w${idx}`,
      french: word.word_fr,
      english: word.word_target,
    }))

    setWords(oralWords)
    initializeRound(oralWords[0])
    setLoading(false)
  }, [router])

  const initializeRound = (word: OralWord) => {
    setRoundState({
      word,
      transcript: '',
      isListening: false,
      isCorrect: null,
      timeLeft: 5,
    })
  }

  // Timer logic
  useEffect(() => {
    if (!roundState || roundState.isCorrect !== null || gameEnded) return

    timerRef.current = setInterval(() => {
      setRoundState(prev => {
        if (!prev) return null
        const newTimeLeft = prev.timeLeft - 1
        if (newTimeLeft <= 0) {
          if (recognitionRef.current?.abort) {
            recognitionRef.current.abort()
          }
          return { ...prev, timeLeft: 0, isListening: false, isCorrect: false }
        }
        return { ...prev, timeLeft: newTimeLeft }
      })
    }, 1000)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [roundState, gameEnded])

  const handleMicClick = () => {
    if (!roundState || !recognitionRef.current) return

    if (roundState.isListening) {
      recognitionRef.current.stop()
    } else {
      setRoundState(prev => prev ? { ...prev, transcript: '' } : null)
      recognitionRef.current.start()
    }
  }

  const checkAnswer = () => {
    if (!roundState) return

    const transcript = roundState.transcript.trim().toLowerCase()
    const expected = roundState.word.english.toLowerCase()
    const isCorrect = transcript === expected || transcript.includes(expected) || expected.includes(transcript)

    setRoundState(prev => prev ? { ...prev, isCorrect, isListening: false } : null)

    if (isCorrect) {
      setScore(score + 20)
    }

    setTimeout(() => {
      if (currentRound < words.length - 1) {
        setCurrentRound(currentRound + 1)
        initializeRound(words[currentRound + 1])
      } else {
        setGameEnded(true)
        // Save score
        if (user) {
          const gameScoreKey = `lingualearn_game_score_${user.id}`
          const currentScore = parseInt(localStorage.getItem(gameScoreKey) || '0', 10)
          const newScore = currentScore + score + (isCorrect ? 20 : 0)
          localStorage.setItem(gameScoreKey, newScore.toString())

          fetch('/api/scores', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: user.id,
              userName: user.firstName,
              score: score + (isCorrect ? 20 : 0),
              scoreType: 'game',
              source: 'oral',
            }),
          }).catch(() => {})
        }
      }
    }, 1500)
  }

  if (loading || !user || words.length === 0 || !roundState) {
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
          title={lang === 'fr' ? 'Oral Rapide - Résultats' : 'Oral Rapide - Results'}
          backHref="/module/jeux"
        />

        <main className="flex-1 flex items-center justify-center px-4 pb-20">
          <div className="text-center max-w-sm">
            <div className="text-6xl mb-4">🎉</div>
            <p className="text-3xl font-bold text-[#002844] mb-2">
              {score} {lang === 'fr' ? 'points' : 'points'}
            </p>
            <p className="text-lg font-bold text-[#002844] mb-6">
              {Math.floor(score / 20)}/{words.length} {lang === 'fr' ? 'mots corrects' : 'words correct'}
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

  const progressPercent = ((currentRound + 1) / words.length) * 100

  return (
    <div className="flex flex-col h-screen bg-[#F0F0F0]">
      <PageHeader
        title={lang === 'fr' ? 'Oral Rapide' : 'Oral Rapide'}
        backHref="/module/jeux"
      />

      {/* Progress */}
      <div className="bg-white px-4 py-3 border-b">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-gray-600">
            {currentRound + 1}/{words.length}
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
        <div className="max-w-sm w-full text-center">
          {/* Question */}
          <p className="text-lg font-bold text-gray-600 mb-6">
            {lang === 'fr' ? 'Dis le mot en anglais :' : 'Say the word in English:'}
          </p>

          <div className="bg-white rounded-xl p-6 mb-8 border-l-4 border-[#D9B438]">
            <p className="text-4xl font-bold text-[#002844]">{roundState.word.french}</p>
          </div>

          {/* Timer */}
          <div className="relative w-24 h-24 mx-auto mb-8">
            <svg className="w-full h-full transform -rotate-90">
              <circle
                cx="48"
                cy="48"
                r="45"
                fill="none"
                stroke="#e5e7eb"
                strokeWidth="4"
              />
              <circle
                cx="48"
                cy="48"
                r="45"
                fill="none"
                stroke={roundState.timeLeft <= 2 ? '#ef4444' : '#002844'}
                strokeWidth="4"
                strokeDasharray={`${(roundState.timeLeft / 5) * 282.7} 282.7`}
                className="transition-all"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-3xl font-bold text-[#002844]">{roundState.timeLeft}</span>
            </div>
          </div>

          {/* Mic button */}
          {roundState.isCorrect === null && (
            <button
              onClick={handleMicClick}
              disabled={!speechSupported}
              className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 transition-all ${
                roundState.isListening
                  ? 'bg-red-500 text-white animate-pulse'
                  : 'bg-blue-500 text-white hover:bg-blue-600'
              } ${!speechSupported ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {roundState.isListening ? (
                <MicOff className="h-6 w-6" />
              ) : (
                <Mic className="h-6 w-6" />
              )}
            </button>
          )}

          {/* Transcript display */}
          {roundState.transcript && (
            <div className="bg-blue-50 rounded-xl p-4 mb-6 border-2 border-blue-200">
              <p className="text-sm text-gray-600 mb-1">
                {lang === 'fr' ? 'Vous avez dit :' : 'You said:'}
              </p>
              <p className="text-lg font-bold text-blue-700">{roundState.transcript}</p>
            </div>
          )}

          {/* Feedback */}
          {roundState.isCorrect !== null && (
            <div
              className={`rounded-xl p-4 mb-6 text-center ${
                roundState.isCorrect
                  ? 'bg-green-100 border-2 border-green-500'
                  : 'bg-red-100 border-2 border-red-500'
              }`}
            >
              <p className="text-lg font-bold">
                {roundState.isCorrect ? (
                  <>
                    <span className="text-green-700">✓ {lang === 'fr' ? 'Correct !' : 'Correct!'}</span>
                  </>
                ) : (
                  <>
                    <span className="text-red-700">
                      ✗ {lang === 'fr' ? 'La bonne réponse est :' : 'The correct answer is:'}
                    </span>
                    <p className="text-red-700 mt-2">{roundState.word.english}</p>
                  </>
                )}
              </p>
            </div>
          )}

          {/* Action button */}
          {roundState.isCorrect === null && roundState.transcript && !roundState.isListening && (
            <button
              onClick={checkAnswer}
              className="w-full bg-[#D9B438] text-[#002844] py-3 rounded-xl font-bold hover:opacity-90 transition-opacity"
            >
              {lang === 'fr' ? 'Valider' : 'Submit'}
            </button>
          )}
        </div>
      </main>

      <BottomNav lang={lang} />
    </div>
  )
}
