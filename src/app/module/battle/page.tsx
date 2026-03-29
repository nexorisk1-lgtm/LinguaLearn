'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Swords, Trophy, Zap, Check, X, Timer } from 'lucide-react'
import PageHeader from '@/components/PageHeader'
import BottomNav from '@/components/BottomNav'
import { getCurrentUser } from '@/lib/db/localStorage'
import { User, InterfaceLanguage } from '@/types'
import { getA1CourseVocabulary, BANK_A1_COURSES } from '@/lib/db/bankA1Courses'
import { VocabWord } from '@/lib/db/bankTypes'
import { speakText } from '@/lib/db/bankHelpers'
import { useEngine } from '@/lib/engine/useEngine'
import { awardPoints, getBattleConfig } from '@/lib/engine/gamificationEngine'
import type { TimerMode } from '@/lib/engine/gamificationEngine'

type BattlePhase = 'lobby' | 'countdown' | 'playing' | 'results'

interface BattleExercise {
  type: 'vocabulary' | 'qcm' | 'matching'
  question: string
  answer: string
  options: string[]
  word: VocabWord
}

export default function BattlePage() {
  const router = useRouter()
  const engine = useEngine()
  const [user, setUser] = useState<User | null>(null)
  const [lang, setLang] = useState<InterfaceLanguage>('fr')
  const [loading, setLoading] = useState(true)
  const [phase, setPhase] = useState<BattlePhase>('lobby')
  const [timerMode, setTimerMode] = useState<TimerMode>('soft')
  const [exercises, setExercises] = useState<BattleExercise[]>([])
  const [currentIdx, setCurrentIdx] = useState(0)
  const [score, setScore] = useState(0)
  const [timer, setTimer] = useState(0)
  const [countdown, setCountdown] = useState(3)
  const [answers, setAnswers] = useState<boolean[]>([])

  useEffect(() => {
    const u = getCurrentUser()
    if (!u) { router.push('/auth'); return }
    setUser(u)
    setLang(u.settings.interfaceLang || 'fr')
    setLoading(false)
  }, [router])

  // Generate battle exercises from random courses
  const generateExercises = useCallback((): BattleExercise[] => {
    const allVocab: VocabWord[] = []
    // Pick from first 10 courses for variety
    for (let i = 0; i < Math.min(10, BANK_A1_COURSES.length); i++) {
      allVocab.push(...getA1CourseVocabulary(BANK_A1_COURSES[i].id))
    }
    const shuffled = [...allVocab].sort(() => Math.random() - 0.5).slice(0, 10)

    return shuffled.map(word => {
      const distractors = allVocab
        .filter(w => w.id !== word.id)
        .sort(() => Math.random() - 0.5)
        .slice(0, 3)
        .map(w => w.word_fr)
      const options = [word.word_fr, ...distractors].sort(() => Math.random() - 0.5)

      return {
        type: 'vocabulary' as const,
        question: word.word_target,
        answer: word.word_fr,
        options,
        word,
      }
    })
  }, [])

  // Start battle
  const startBattle = () => {
    const exs = generateExercises()
    setExercises(exs)
    setCurrentIdx(0)
    setScore(0)
    setAnswers([])
    setPhase('countdown')
    setCountdown(3)
  }

  // Countdown effect
  useEffect(() => {
    if (phase !== 'countdown') return
    if (countdown <= 0) {
      setPhase('playing')
      setTimer(timerMode === 'competitive' ? 30 : timerMode === 'soft' ? 60 : 0)
      return
    }
    const t = setTimeout(() => setCountdown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [phase, countdown, timerMode])

  // Timer effect
  useEffect(() => {
    if (phase !== 'playing' || timerMode === 'none' || timer <= 0) return
    const t = setTimeout(() => {
      setTimer(prev => {
        if (prev <= 1) {
          // Time's up
          setPhase('results')
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearTimeout(t)
  }, [phase, timer, timerMode])

  // Handle answer
  const handleAnswer = (selected: string) => {
    const correct = selected === exercises[currentIdx].answer
    if (correct) setScore(s => s + 1)
    setAnswers(prev => [...prev, correct])

    // Play TTS for the word
    const activeLang = user?.activeLang || 'en'
    speakText(exercises[currentIdx].word.word_target, activeLang)

    setTimeout(() => {
      if (currentIdx + 1 >= exercises.length) {
        // Battle complete — award points
        if (engine.progress) {
          engine.updateProgress(prev => {
            let updated = awardPoints(prev, 'battle_participated', `battle_${Date.now()}`)
            if (score + (correct ? 1 : 0) >= exercises.length * 0.7) {
              updated = awardPoints(updated, 'battle_won', `battle_${Date.now()}`)
            }
            return updated
          })
        }
        setPhase('results')
      } else {
        setCurrentIdx(i => i + 1)
      }
    }, 500)
  }

  if (loading || !user) {
    return <div className="flex h-screen items-center justify-center"><div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-[#002844]" /></div>
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const activeLang = user.activeLang || user.settings.learningLangs[0] || 'en'
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const config = getBattleConfig(activeLang, 'A1')

  return (
    <div className="min-h-screen bg-[#F0F0F0] pb-20">
      <PageHeader title={lang === 'fr' ? 'Battle' : 'Battle'} backHref="/dashboard" />

      <main className="px-4 pt-4">
        <div className="max-w-md mx-auto">

          {/* LOBBY */}
          {phase === 'lobby' && (
            <div className="text-center">
              <div className="rounded-2xl bg-white p-8 shadow-sm mb-4">
                <Swords className="h-16 w-16 mx-auto mb-4 text-[#002844]" />
                <h2 className="text-xl font-bold text-[#002844] mb-2">
                  {lang === 'fr' ? 'Battle Vocabulaire' : 'Vocabulary Battle'}
                </h2>
                <p className="text-sm text-[#555] mb-6">
                  {lang === 'fr'
                    ? '10 questions rapides. Choisis la bonne traduction le plus vite possible !'
                    : '10 quick questions. Pick the correct translation as fast as you can!'}
                </p>

                {/* 3 Absolute Rules */}
                <div className="rounded-xl bg-gray-50 p-4 mb-6 text-left">
                  <p className="text-xs font-bold text-[#002844] mb-2">
                    {lang === 'fr' ? 'Règles du Battle' : 'Battle Rules'}
                  </p>
                  <div className="space-y-1.5">
                    <p className="text-[10px] text-[#555]">
                      ✓ {lang === 'fr' ? 'Matchmaking par niveau (A1)' : 'Level-based matchmaking (A1)'}
                    </p>
                    <p className="text-[10px] text-[#555]">
                      ✓ {lang === 'fr' ? "N'impacte PAS le score d'apprentissage" : 'Does NOT impact learning score'}
                    </p>
                    <p className="text-[10px] text-[#555]">
                      ✓ {lang === 'fr' ? 'Signal faible uniquement (encouragement)' : 'Weak signal only (encouragement)'}
                    </p>
                  </div>
                </div>

                {/* Timer mode selector */}
                <div className="mb-6">
                  <p className="text-xs font-bold text-[#002844] mb-2">
                    {lang === 'fr' ? 'Mode timer' : 'Timer mode'}
                  </p>
                  <div className="flex gap-2">
                    {[
                      { mode: 'none' as TimerMode, label: lang === 'fr' ? 'Sans' : 'None', icon: '🧘' },
                      { mode: 'soft' as TimerMode, label: lang === 'fr' ? 'Doux (60s)' : 'Soft (60s)', icon: '⏱️' },
                      { mode: 'competitive' as TimerMode, label: lang === 'fr' ? 'Compétitif (30s)' : 'Competitive (30s)', icon: '🔥' },
                    ].map(t => (
                      <button key={t.mode} onClick={() => setTimerMode(t.mode)}
                        className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${timerMode === t.mode ? 'bg-[#002844] text-white' : 'bg-gray-100 text-[#555]'}`}>
                        {t.icon} {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                <button onClick={startBattle}
                  className="w-full py-3.5 rounded-xl font-bold text-white bg-gradient-to-r from-[#002844] to-[#003a5c] active:scale-95 transition-transform">
                  <Zap className="h-5 w-5 inline mr-2" />
                  {lang === 'fr' ? 'Lancer le Battle !' : 'Start Battle!'}
                </button>
              </div>

              {/* Battle score display */}
              {engine.progress && (
                <div className="rounded-xl bg-white p-4 shadow-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <Trophy className="h-4 w-4 text-[#D9B438]" />
                    <span className="text-sm font-bold text-[#002844]">{lang === 'fr' ? 'Score Battle' : 'Battle Score'}</span>
                  </div>
                  <p className="text-2xl font-bold text-[#E65100]">{engine.progress.battleScore} pts</p>
                </div>
              )}
            </div>
          )}

          {/* COUNTDOWN */}
          {phase === 'countdown' && (
            <div className="text-center py-20">
              <p className="text-8xl font-bold text-[#002844] animate-pulse">{countdown}</p>
              <p className="text-sm text-[#555] mt-4">
                {lang === 'fr' ? 'Prépare-toi...' : 'Get ready...'}
              </p>
            </div>
          )}

          {/* PLAYING */}
          {phase === 'playing' && exercises[currentIdx] && (
            <div>
              {/* Progress + Timer */}
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-bold text-[#002844]">{currentIdx + 1}/{exercises.length}</span>
                <div className="flex gap-1">
                  {answers.map((ok, i) => (
                    <div key={i} className={`w-2.5 h-2.5 rounded-full ${ok ? 'bg-green-500' : 'bg-red-500'}`} />
                  ))}
                </div>
                {timerMode !== 'none' && (
                  <div className={`flex items-center gap-1 px-2 py-1 rounded-lg ${timer <= 10 ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-[#002844]'}`}>
                    <Timer className="h-3.5 w-3.5" />
                    <span className="text-sm font-bold">{timer}s</span>
                  </div>
                )}
              </div>

              {/* Question */}
              <div className="rounded-2xl bg-white p-8 shadow-sm mb-4 text-center">
                <p className="text-xs text-[#999] mb-2">
                  {lang === 'fr' ? 'Quelle est la traduction ?' : "What's the translation?"}
                </p>
                <p className="text-3xl font-bold text-[#002844] mb-2">{exercises[currentIdx].question}</p>
                {exercises[currentIdx].word.phonetic && (
                  <p className="text-sm text-[#D9B438] italic">/{exercises[currentIdx].word.phonetic}/</p>
                )}
              </div>

              {/* Options */}
              <div className="space-y-2">
                {exercises[currentIdx].options.map((opt, i) => (
                  <button key={i} onClick={() => handleAnswer(opt)}
                    className="w-full p-4 rounded-xl text-left font-semibold bg-white border-2 border-gray-200 hover:border-[#002844] active:scale-[0.98] transition-all text-[#002844]">
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* RESULTS */}
          {phase === 'results' && (
            <div className="text-center">
              <div className="rounded-2xl bg-white p-8 shadow-sm mb-4">
                <Trophy className="h-16 w-16 mx-auto mb-4" style={{ color: score >= 7 ? '#D9B438' : '#555' }} />
                <h2 className="text-xl font-bold text-[#002844] mb-2">
                  {lang === 'fr' ? 'Battle terminé !' : 'Battle complete!'}
                </h2>
                <p className="text-3xl font-bold text-[#002844] mb-1">{score}/{exercises.length}</p>
                <p className="text-sm text-[#555] mb-6">
                  {score >= 7
                    ? (lang === 'fr' ? 'Excellent ! Tu as dominé ce battle !' : 'Excellent! You dominated this battle!')
                    : score >= 5
                    ? (lang === 'fr' ? 'Bien joué ! Continue à t\'entraîner.' : 'Well done! Keep practicing.')
                    : (lang === 'fr' ? 'Tu progresseras au prochain battle !' : "You'll improve in the next battle!")}
                </p>

                {/* Results detail */}
                <div className="space-y-2 mb-6 text-left">
                  {exercises.map((ex, i) => (
                    <div key={i} className={`flex items-center gap-3 p-2.5 rounded-lg ${answers[i] ? 'bg-green-50' : 'bg-red-50'}`}>
                      {answers[i] ? <Check className="h-4 w-4 text-green-600 flex-shrink-0" /> : <X className="h-4 w-4 text-red-500 flex-shrink-0" />}
                      <span className="text-sm font-medium text-[#002844]">{ex.question}</span>
                      <span className="text-sm text-[#555] ml-auto">{ex.answer}</span>
                    </div>
                  ))}
                </div>

                <div className="flex gap-3">
                  <button onClick={() => setPhase('lobby')}
                    className="flex-1 py-3 rounded-xl font-bold bg-gray-100 text-[#002844]">
                    {lang === 'fr' ? 'Menu' : 'Menu'}
                  </button>
                  <button onClick={startBattle}
                    className="flex-1 py-3 rounded-xl font-bold text-white bg-[#002844]">
                    <Zap className="h-4 w-4 inline mr-1" />
                    {lang === 'fr' ? 'Rejouer' : 'Play again'}
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      </main>

      <BottomNav lang={lang} />
    </div>
  )
}
