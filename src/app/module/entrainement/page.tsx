'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { RotateCcw, Volume2, Trophy, Zap, Brain, Check, X, HelpCircle } from 'lucide-react'
import PageHeader from '@/components/PageHeader'
import { getCurrentUser, saveReviewItem } from '@/lib/db/localStorage'
import { User } from '@/types'
import BottomNav from '@/components/BottomNav'
import { getVocabulary, speakText } from '@/lib/db/bankHelpers'
import { VocabWord } from '@/lib/db/bankTypes'

type TrainingTab = 'flashcards' | 'quiz' | 'jeux'

interface FlashCard {
  word: VocabWord
  flipped: boolean
  result?: 'knew' | 'hard' | 'didnt_know'
}

export default function EntrainementPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TrainingTab>('flashcards')

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
    const themes = u.settings.languageConfigs?.[aLang]?.themes || ['travel']
    const level = u.progress?.[aLang]?.levelCecrl || 'A1'

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
      const vocab = getVocabulary(aLang, themes, level)
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

  const restartSession = () => {
    const themes = user.settings.languageConfigs?.[activeLang]?.themes || ['travel']
    const level = user.progress?.[activeLang]?.levelCecrl || 'A1'
    const vocab = getVocabulary(activeLang, themes, level)
    const shuffled = [...vocab].sort(() => Math.random() - 0.5).slice(0, 8)
    setCards(shuffled.map(w => ({ word: w, flipped: false })))
    setCurrentIndex(0)
    setSessionDone(false)
    clearFlashcardPosition() // V3.14: clear saved position on restart
  }

  const tabs = [
    { id: 'flashcards' as TrainingTab, label: 'Flashcards', icon: Brain },
    { id: 'quiz' as TrainingTab, label: 'Quiz', icon: Zap },
    { id: 'jeux' as TrainingTab, label: lang === 'fr' ? 'Jeux' : 'Games', icon: Trophy },
  ]

  // Session stats
  const knewCount = cards.filter(c => c.result === 'knew').length
  const hardCount = cards.filter(c => c.result === 'hard').length
  const didntKnowCount = cards.filter(c => c.result === 'didnt_know').length

  return (
    <div className="min-h-screen bg-[#F0F0F0] pb-20">
      <PageHeader title={lang === 'fr' ? 'Entraînement' : 'Training'} backHref="/dashboard" />

      {/* Tabs */}
      <div className="flex gap-1 px-4 pt-3 pb-2 bg-white border-b">
        {tabs.map(tab => {
          const Icon = tab.icon
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-semibold transition-all ${activeTab === tab.id ? 'bg-[#002844] text-white' : 'bg-[#F0F0F0] text-[#555555]'}`}>
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          )
        })}
      </div>

      <main className="px-4 pt-4">
        {/* FLASHCARDS TAB — V3.12: Flip recto/verso + 3 boutons auto-évaluation */}
        {activeTab === 'flashcards' && (
          <div className="max-w-md mx-auto">
            {sessionDone ? (
              /* Summary */
              <div className="rounded-2xl bg-white p-6 shadow-sm text-center">
                <Trophy className="h-12 w-12 mx-auto mb-3" style={{ color: knewCount >= 5 ? '#D9B438' : '#555555' }} />
                <h2 className="text-xl font-bold text-[#002844] mb-2">
                  {lang === 'fr' ? 'Session terminée !' : 'Session complete!'}
                </h2>
                <p className="text-sm text-[#555555] mb-6">{cards.length} {lang === 'fr' ? 'cartes revues' : 'cards reviewed'}</p>

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
                    <p className="text-[10px] text-red-500 font-semibold">{lang === 'fr' ? 'Pas su' : "Didn't know"}</p>
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
                  className="w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2"
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
                      <span className="text-red-600">{lang === 'fr' ? 'Pas su' : "Didn't know"}</span>
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
        )}

        {/* QUIZ TAB */}
        {activeTab === 'quiz' && (
          <div className="text-center py-12 rounded-2xl bg-white shadow-sm">
            <Zap className="h-12 w-12 mx-auto mb-3 text-[#D9B438]" />
            <h2 className="text-lg font-bold text-[#002844] mb-2">{lang === 'fr' ? 'Quiz Vocabulaire' : 'Vocabulary Quiz'}</h2>
            <p className="text-sm text-[#555555] mb-1">20 questions — 60 secondes</p>
            <p className="text-xs text-[#555555]">{lang === 'fr' ? 'Bientôt disponible' : 'Coming soon'}</p>
          </div>
        )}

        {/* JEUX TAB */}
        {activeTab === 'jeux' && (
          <div className="text-center py-12 rounded-2xl bg-white shadow-sm">
            <Trophy className="h-12 w-12 mx-auto mb-3 text-[#D9B438]" />
            <h2 className="text-lg font-bold text-[#002844] mb-2">{lang === 'fr' ? 'Jeux' : 'Games'}</h2>
            <p className="text-xs text-[#555555]">{lang === 'fr' ? 'Bientôt disponible' : 'Coming soon'}</p>
          </div>
        )}
      </main>
      <BottomNav lang={lang} />
    </div>
  )
}
