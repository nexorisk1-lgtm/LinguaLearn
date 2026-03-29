'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { RotateCcw, Volume2, Trophy, Brain, Check, X, HelpCircle } from 'lucide-react'
import PageHeader from '@/components/PageHeader'
import { getCurrentUser, saveReviewItem } from '@/lib/db/localStorage'
import { User } from '@/types'
import BottomNav from '@/components/BottomNav'
import { speakText } from '@/lib/db/bankHelpers'
import { getA1CourseVocabulary, BANK_A1_COURSES } from '@/lib/db/bankA1Courses'
import { VocabWord } from '@/lib/db/bankTypes'

interface FlashCard {
  word: VocabWord
  flipped: boolean
  result?: 'knew' | 'hard' | 'didnt_know'
}

export default function EntrainementPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [trainingMode, setTrainingMode] = useState<'guided' | 'free'>('guided')

  // Flashcard state
  const [cards, setCards] = useState<FlashCard[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [sessionDone, setSessionDone] = useState(false)
  const [isFlipping, setIsFlipping] = useState(false)

  useEffect(() => {
    const u = getCurrentUser()
    if (!u) { router.push('/auth'); return }
    setUser(u)

    const aLang = u.activeLang || u.settings.learningLangs[0] || 'en'
    // V3.14: Check for saved flashcard session to resume
    const savedKey = `lingualearn_flashcard_progress_${u.id}_${aLang}`
    const todayStr = new Date().toISOString().split('T')[0]
    let resumed = false
    try {
      const saved = localStorage.getItem(savedKey)
      if (saved) {
        const s = JSON.parse(saved)
        if (s.date === todayStr && s.currentIndex > 0 && s.cards?.length > 0) {
          setCards(s.cards)
          setCurrentIndex(s.currentIndex)
          resumed = true
        }
      }
    } catch { /* ignore */ }

    if (!resumed) {
      // V2.1.1: Mode guidé — mots des cours complétés uniquement
      const completedScoresKey = `lingualearn_course_scores_${u.id}_${aLang}`
      let completedCourseIds: string[] = []
      try {
        const scoresStr = localStorage.getItem(completedScoresKey)
        if (scoresStr) completedCourseIds = Object.keys(JSON.parse(scoresStr))
      } catch { /* ignore */ }

      const vocab: VocabWord[] = []
      if (completedCourseIds.length > 0) {
        // Mode guidé : mots des cours complétés
        for (const cId of completedCourseIds) {
          vocab.push(...getA1CourseVocabulary(cId))
        }
      } else {
        // Aucun cours complété → mode libre automatique (cours 1-3)
        setTrainingMode('free')
        for (let i = 1; i <= 3; i++) {
          vocab.push(...getA1CourseVocabulary(`a1_c${i}`))
        }
      }

      if (vocab.length === 0) {
        // Fallback: all vocabulary
        for (const course of BANK_A1_COURSES) {
          vocab.push(...getA1CourseVocabulary(course.id))
        }
      }
      const shuffled = [...vocab].sort(() => Math.random() - 0.5).slice(0, 8)
      setCards(shuffled.map(w => ({ word: w, flipped: false })))
    }
    setLoading(false)
  }, [router])

  if (loading || !user) {
    return <div className="flex h-screen items-center justify-center"><div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-[#002844]" /></div>
  }

  const activeLang = user.activeLang || user.settings.learningLangs[0] || 'en'
  const lang = user.settings.interfaceLang || 'fr'

  const currentCard = cards[currentIndex]

  // Flip the card
  const handleFlip = () => {
    if (!currentCard || currentCard.flipped) return
    setIsFlipping(true)
    setTimeout(() => {
      const updated = [...cards]
      updated[currentIndex] = { ...updated[currentIndex], flipped: true }
      setCards(updated)
      setIsFlipping(false)
      // Auto TTS on flip
      speakText(currentCard.word.word_target, activeLang)
    }, 150)
  }

  // V3.14: Save flashcard position to localStorage
  const saveFlashcardPosition = (updatedCards: FlashCard[], nextIndex: number) => {
    if (!user) return
    const savedKey = `lingualearn_flashcard_progress_${user.id}_${activeLang}`
    const todayStr = new Date().toISOString().split('T')[0]
    try {
      localStorage.setItem(savedKey, JSON.stringify({ date: todayStr, cards: updatedCards, currentIndex: nextIndex }))
    } catch { /* ignore */ }
  }
  const clearFlashcardPosition = () => {
    if (!user) return
    const savedKey = `lingualearn_flashcard_progress_${user.id}_${activeLang}`
    try { localStorage.removeItem(savedKey) } catch { /* ignore */ }
  }

  // Self-assessment buttons
  const handleAssessment = (result: 'knew' | 'hard' | 'didnt_know') => {
    const updated = [...cards]
    updated[currentIndex] = { ...updated[currentIndex], result }
    setCards(updated)

    // Save to spaced repetition
    const scorePct = result === 'knew' ? 95 : result === 'hard' ? 70 : 30
    saveReviewItem(user.id, activeLang, currentCard.word.id, 'word', scorePct)

    // Next card or finish
    setTimeout(() => {
      if (currentIndex + 1 >= cards.length) {
        setSessionDone(true)
        clearFlashcardPosition() // V3.14: clear on completion
      } else {
        const nextIdx = currentIndex + 1
        setCurrentIndex(nextIdx)
        saveFlashcardPosition(updated, nextIdx) // V3.14: save position
      }
    }, 300)
  }

  // Centralized vocab loading based on training mode
  const getTrainingVocab = (mode: 'guided' | 'free'): VocabWord[] => {
    let vocab: VocabWord[] = []
    if (mode === 'guided') {
      // Guided mode: words from completed courses
      try {
        const scoresStr = localStorage.getItem(`lingualearn_course_scores_${user.id}_${activeLang}`)
        if (scoresStr) {
          const completedIds = Object.keys(JSON.parse(scoresStr))
          for (const cId of completedIds) {
            vocab.push(...getA1CourseVocabulary(cId))
          }
        }
      } catch { /* ignore */ }
    }
    if (mode === 'free' || vocab.length === 0) {
      // Free mode: courses 1-3
      vocab = []
      for (let i = 1; i <= 3; i++) {
        vocab.push(...getA1CourseVocabulary(`a1_c${i}`))
      }
    }
    return vocab
  }

  const restartSession = () => {
    const vocab = getTrainingVocab(trainingMode)
    const shuffled = [...vocab].sort(() => Math.random() - 0.5).slice(0, 8)
    setCards(shuffled.map(w => ({ word: w, flipped: false })))
    setCurrentIndex(0)
    setSessionDone(false)
    clearFlashcardPosition()
  }

  const toggleMode = (mode: 'guided' | 'free') => {
    setTrainingMode(mode)
    const vocab = getTrainingVocab(mode)
    const shuffled = [...vocab].sort(() => Math.random() - 0.5).slice(0, 8)
    setCards(shuffled.map(w => ({ word: w, flipped: false })))
    setCurrentIndex(0)
    setSessionDone(false)
    clearFlashcardPosition()
  }

  // Session stats
  const knewCount = cards.filter(c => c.result === 'knew').length
  const hardCount = cards.filter(c => c.result === 'hard').length
  const didntKnowCount = cards.filter(c => c.result === 'didnt_know').length
  const totalPoints = knewCount * 3 + hardCount * 1

  return (
    <div className="min-h-screen bg-[#F0F0F0] pb-20">
      <PageHeader title={lang === 'fr' ? 'Entraînement' : 'Training'} backHref="/dashboard" />

      <main className="px-4 pt-4">
        {/* FLASHCARDS — Main unified exercise flow */}
        <div className="max-w-md mx-auto">
          {/* Empty state if no courses completed in guided mode */}
          {trainingMode === 'guided' && cards.length === 0 && !sessionDone ? (
              <div className="rounded-2xl bg-white p-8 shadow-sm text-center">
                <Brain className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                <h2 className="text-lg font-bold text-[#002844] mb-2">
                  {lang === 'fr' ? 'Termine ton premier cours' : 'Complete your first course'}
                </h2>
                <p className="text-sm text-[#555] mb-6">
                  {lang === 'fr'
                    ? "L'entraînement guidé utilise les mots que tu as déjà appris en cours. Termine un cours pour débloquer !"
                    : 'Guided training uses words you already learned in courses. Complete a course to unlock!'}
                </p>
                <button onClick={() => router.push('/module/cours')}
                  className="w-full py-3 rounded-xl font-bold text-white bg-[#002844] hover:bg-[#003a5c] transition-colors">
                  {lang === 'fr' ? '📚 Aller aux cours' : '📚 Go to courses'}
                </button>
              </div>
          ) : sessionDone ? (
            /* Enhanced summary with points */
            <div className="rounded-2xl bg-white p-6 shadow-sm text-center">
              <Trophy className="h-12 w-12 mx-auto mb-3" style={{ color: knewCount >= 5 ? '#D9B438' : '#555555' }} />
              <h2 className="text-xl font-bold text-[#002844] mb-1">
                {lang === 'fr' ? 'Session terminée !' : 'Session complete!'}
              </h2>
              <p className="text-sm text-[#D9B438] font-bold mb-4">
                +{totalPoints} {lang === 'fr' ? 'pts' : 'pts'}
              </p>

              {/* Stats */}
              <div className="flex gap-3 mb-6">
                <div className="flex-1 rounded-xl p-3 bg-green-50">
                  <Check className="h-5 w-5 mx-auto text-green-600 mb-1" />
                  <p className="text-lg font-bold text-green-700">{knewCount}</p>
                  <p className="text-[10px] text-green-600 font-semibold">{lang === 'fr' ? 'Je savais' : 'I knew'}</p>
                </div>
                <div className="flex-1 rounded-xl p-3 bg-orange-50">
                  <HelpCircle className="h-5 w-5 mx-auto text-orange-500 mb-1" />
                  <p className="text-lg font-bold text-orange-600">{hardCount}</p>
                  <p className="text-[10px] text-orange-500 font-semibold">{lang === 'fr' ? "J'ai hésité" : 'Hard'}</p>
                </div>
                <div className="flex-1 rounded-xl p-3 bg-red-50">
                  <X className="h-5 w-5 mx-auto text-red-500 mb-1" />
                  <p className="text-lg font-bold text-red-600">{didntKnowCount}</p>
                  <p className="text-[10px] text-red-500 font-semibold">{lang === 'fr' ? 'Je ne savais pas' : "Didn't know"}</p>
                </div>
              </div>

              {/* Card results */}
              <div className="space-y-2 mb-6">
                {cards.map((card, i) => (
                  <div key={i} className={`flex items-center justify-between p-3 rounded-lg ${
                    card.result === 'knew' ? 'bg-green-100' : card.result === 'hard' ? 'bg-orange-100' : 'bg-red-100'
                  }`}>
                    <span className="text-sm font-medium text-[#002844]">{card.word.word_fr}</span>
                    <span className="text-sm font-bold" style={{ color: card.result === 'knew' ? '#2e7d32' : card.result === 'hard' ? '#E65100' : '#d32f2f' }}>
                      {card.word.word_target}
                    </span>
                  </div>
                ))}
              </div>

              <button onClick={restartSession}
                className="w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 mb-3"
                style={{ backgroundColor: '#D9B438', color: '#002844' }}>
                <RotateCcw className="h-4 w-4" />
                {lang === 'fr' ? 'Nouvelle session' : 'New session'}
              </button>
            </div>
          ) : currentCard ? (
              /* Active flashcard with flip */
              <div>
                {/* Progress */}
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm font-semibold text-[#555555]">
                    {currentIndex + 1}/{cards.length}
                  </span>
                  <div className="flex gap-1">
                    {cards.map((_, i) => (
                      <div key={i} className="w-2 h-2 rounded-full" style={{
                        backgroundColor: i < currentIndex ? (cards[i].result === 'knew' ? '#2e7d32' : cards[i].result === 'hard' ? '#E65100' : '#d32f2f') :
                          i === currentIndex ? '#002844' : '#D1D5DB'
                      }} />
                    ))}
                  </div>
                </div>

                {/* Flashcard — flip animation */}
                <div
                  onClick={!currentCard.flipped ? handleFlip : undefined}
                  className="relative cursor-pointer mb-6"
                  style={{ perspective: '1000px', minHeight: '280px' }}
                >
                  <div
                    className="w-full rounded-2xl shadow-lg transition-transform duration-500"
                    style={{
                      transformStyle: 'preserve-3d',
                      transform: currentCard.flipped || isFlipping ? 'rotateY(180deg)' : 'rotateY(0deg)',
                      minHeight: '280px',
                    }}
                  >
                    {/* RECTO — Mot en français + audio */}
                    <div
                      className="absolute inset-0 rounded-2xl p-8 flex flex-col items-center justify-center"
                      style={{
                        backfaceVisibility: 'hidden',
                        backgroundColor: '#002844',
                      }}
                    >
                      <p className="text-3xl font-bold text-white mb-4 text-center">{currentCard.word.word_fr}</p>
                      <button onClick={(e) => { e.stopPropagation(); speakText(currentCard.word.word_fr, 'fr') }}
                        className="w-14 h-14 rounded-full bg-white/15 flex items-center justify-center hover:bg-white/25 transition-colors mb-6">
                        <Volume2 className="h-6 w-6 text-white" />
                      </button>
                      <p className="text-sm text-white/50">
                        {lang === 'fr' ? 'Touche pour retourner' : 'Tap to flip'}
                      </p>
                    </div>

                    {/* VERSO — Traduction + phonétique + exemple */}
                    <div
                      className="absolute inset-0 rounded-2xl p-8 flex flex-col items-center justify-center bg-white border-2 border-[#D9B438]"
                      style={{
                        backfaceVisibility: 'hidden',
                        transform: 'rotateY(180deg)',
                      }}
                    >
                      <p className="text-3xl font-bold text-[#002844] mb-2 text-center">{currentCard.word.word_target}</p>
                      {currentCard.word.phonetic && (
                        <p className="text-sm italic text-[#D9B438] mb-3">/{currentCard.word.phonetic}/</p>
                      )}
                      <button onClick={(e) => { e.stopPropagation(); speakText(currentCard.word.word_target, activeLang) }}
                        className="w-12 h-12 rounded-full bg-[#002844]/10 flex items-center justify-center hover:bg-[#002844]/20 transition-colors mb-4">
                        <Volume2 className="h-5 w-5 text-[#002844]" />
                      </button>
                      {currentCard.word.example_en && (
                        <p className="text-xs text-[#555555] text-center italic max-w-[250px]">
                          &ldquo;{currentCard.word.example_en}&rdquo;
                        </p>
                      )}
                      <p className="text-xs text-[#999] mt-3 uppercase tracking-wide">{currentCard.word.theme} · {currentCard.word.level}</p>
                    </div>
                  </div>
                </div>

                {/* 3 boutons auto-évaluation — visibles seulement côté verso */}
                {currentCard.flipped && (
                  <div className="flex gap-3">
                    <button onClick={() => handleAssessment('didnt_know')}
                      className="flex-1 py-3.5 rounded-xl font-bold text-sm flex flex-col items-center gap-1 transition-all active:scale-95 bg-red-50 border-2 border-red-200 hover:border-red-400">
                      <X className="h-5 w-5 text-red-500" />
                      <span className="text-red-600">{lang === 'fr' ? 'Je ne savais pas' : "Didn't know"}</span>
                    </button>
                    <button onClick={() => handleAssessment('hard')}
                      className="flex-1 py-3.5 rounded-xl font-bold text-sm flex flex-col items-center gap-1 transition-all active:scale-95 bg-orange-50 border-2 border-orange-200 hover:border-orange-400">
                      <HelpCircle className="h-5 w-5 text-orange-500" />
                      <span className="text-orange-600">{lang === 'fr' ? "J'ai hésité" : 'Hard'}</span>
                    </button>
                    <button onClick={() => handleAssessment('knew')}
                      className="flex-1 py-3.5 rounded-xl font-bold text-sm flex flex-col items-center gap-1 transition-all active:scale-95 bg-green-50 border-2 border-green-200 hover:border-green-400">
                      <Check className="h-5 w-5 text-green-600" />
                      <span className="text-green-700">{lang === 'fr' ? 'Je savais' : 'I knew'}</span>
                    </button>
                  </div>
                )}

                {/* Instruction si pas encore retourné */}
                {!currentCard.flipped && (
                  <p className="text-center text-xs text-[#999] mt-2">
                    {lang === 'fr' ? 'Réfléchis à la traduction, puis retourne la carte' : 'Think of the translation, then flip the card'}
                  </p>
                )}
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-sm text-[#555555]">{lang === 'fr' ? 'Aucun mot disponible' : 'No words available'}</p>
              </div>
            )}
        </div>

        {/* Discrete mode toggle — at bottom */}
        {!sessionDone && cards.length > 0 && (
          <div className="max-w-md mx-auto mt-6">
            <div className="flex gap-1">
              <button
                onClick={() => toggleMode('guided')}
                className={`flex-1 py-1.5 rounded text-xs font-semibold transition-all ${trainingMode === 'guided' ? 'bg-[#002844] text-white' : 'bg-gray-100 text-[#555]'}`}
              >
                {lang === 'fr' ? 'Guidé' : 'Guided'}
              </button>
              <button
                onClick={() => toggleMode('free')}
                className={`flex-1 py-1.5 rounded text-xs font-semibold transition-all ${trainingMode === 'free' ? 'bg-[#002844] text-white' : 'bg-gray-100 text-[#555]'}`}
              >
                {lang === 'fr' ? 'Libre' : 'Free'}
              </button>
            </div>
            <p className="text-center text-[10px] text-[#999] mt-2">
              {lang === 'fr' ? 'Mode exploration' : 'Exploration mode'}
            </p>
          </div>
        )}
      </main>
      <BottomNav lang={lang} />
    </div>
  )
}
