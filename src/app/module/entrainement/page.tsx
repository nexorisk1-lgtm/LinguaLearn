'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { RotateCcw, Volume2, Check, Trophy, Zap, Brain } from 'lucide-react'
import PageHeader from '@/components/PageHeader'
import { getCurrentUser } from '@/lib/db/localStorage'
import { User } from '@/types'
import BottomNav from '@/components/BottomNav'
import { getVocabulary, speakText, isCloseEnough } from '@/lib/db/bankHelpers'
import { VocabWord } from '@/lib/db/bankTypes'

type FlashcardState = 'front' | 'correct' | 'incorrect' | 'flipped'
type TrainingTab = 'flashcards' | 'quiz' | 'jeux'

interface FlashCard {
  word: VocabWord
  state: FlashcardState
  attempts: number
}

export default function EntrainementPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TrainingTab>('flashcards')

  // Flashcard state
  const [cards, setCards] = useState<FlashCard[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answer, setAnswer] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [sessionDone, setSessionDone] = useState(false)
  const [correctCount, setCorrectCount] = useState(0)
  const [, setFailedWords] = useState<string[]>([])

  useEffect(() => {
    const u = getCurrentUser()
    if (!u) { router.push('/auth'); return }
    setUser(u)
    
    const activeLang = u.activeLang || u.settings.learningLangs[0] || 'en'
    const themes = u.settings.languageConfigs?.[activeLang]?.themes || ['travel']
    const level = u.progress?.[activeLang]?.levelCecrl || 'A1'
    const vocab = getVocabulary(activeLang, themes, level)
    
    // Pick 5 random words
    const shuffled = [...vocab].sort(() => Math.random() - 0.5).slice(0, 5)
    setCards(shuffled.map(w => ({ word: w, state: 'front', attempts: 0 })))
    setLoading(false)
  }, [router])

  if (loading || !user) {
    return <div className="flex h-screen items-center justify-center"><div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-[#002844]" /></div>
  }

  const activeLang = user.activeLang || user.settings.learningLangs[0] || 'en'
  const lang = user.settings.interfaceLang || 'fr'

  const currentCard = cards[currentIndex]
  const remainingCards = cards.filter(c => c.state !== 'correct')

  const handleSubmit = () => {
    if (!currentCard || submitted) return
    setSubmitted(true)
    
    const target = currentCard.word.word_target
    const isCorrect = answer.toLowerCase().trim() === target.toLowerCase().trim() || isCloseEnough(answer, target)
    
    const updated = [...cards]
    if (isCorrect) {
      updated[currentIndex] = { ...updated[currentIndex], state: 'correct' }
      setCorrectCount(prev => prev + 1)
    } else {
      updated[currentIndex] = { ...updated[currentIndex], state: 'flipped', attempts: updated[currentIndex].attempts + 1 }
      speakText(target, activeLang)
    }
    setCards(updated)
  }

  const handleNext = () => {
    const updated = [...cards]
    
    // If incorrect, move to end of pile
    if (updated[currentIndex].state === 'flipped') {
      updated[currentIndex] = { ...updated[currentIndex], state: 'front' }
      const card = updated.splice(currentIndex, 1)[0]
      updated.push(card)
      setCards(updated)
    }
    
    // Find next non-correct card
    const remaining = updated.filter(c => c.state !== 'correct')
    if (remaining.length === 0) {
      setSessionDone(true)
      // Track failed words
      setFailedWords(updated.filter(c => c.attempts > 1).map(c => c.word.word_target))
    } else {
      const nextIdx = updated.findIndex(c => c.state !== 'correct')
      setCurrentIndex(nextIdx >= 0 ? nextIdx : 0)
    }
    
    setAnswer('')
    setSubmitted(false)
  }

  const restartSession = () => {
    const activeLangLocal = user.activeLang || user.settings.learningLangs[0] || 'en'
    const themes = user.settings.languageConfigs?.[activeLangLocal]?.themes || ['travel']
    const level = user.progress?.[activeLangLocal]?.levelCecrl || 'A1'
    const vocab = getVocabulary(activeLangLocal, themes, level)
    const shuffled = [...vocab].sort(() => Math.random() - 0.5).slice(0, 5)
    setCards(shuffled.map(w => ({ word: w, state: 'front', attempts: 0 })))
    setCurrentIndex(0)
    setAnswer('')
    setSubmitted(false)
    setSessionDone(false)
    setCorrectCount(0)
    setFailedWords([])
  }

  const tabs = [
    { id: 'flashcards' as TrainingTab, label: 'Flashcards', icon: Brain },
    { id: 'quiz' as TrainingTab, label: 'Quiz', icon: Zap },
    { id: 'jeux' as TrainingTab, label: lang === 'fr' ? 'Jeux' : 'Games', icon: Trophy },
  ]

  return (
    <div className="min-h-screen bg-[#F0F0F0] pb-20">
      {/* Header */}
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
        {/* FLASHCARDS TAB */}
        {activeTab === 'flashcards' && (
          <div className="max-w-md mx-auto">
            {sessionDone ? (
              /* Summary */
              <div className="rounded-2xl bg-white p-6 shadow-sm text-center">
                <Trophy className="h-12 w-12 mx-auto mb-3" style={{ color: correctCount >= 3 ? '#D9B438' : '#555555' }} />
                <h2 className="text-xl font-bold text-[#002844] mb-2">
                  {correctCount >= 3 ? (lang === 'fr' ? 'Session réussie !' : 'Session passed!') : (lang === 'fr' ? 'Continue tes efforts !' : 'Keep trying!')}
                </h2>
                <p className="text-sm text-[#555555] mb-4">{correctCount}/5 {lang === 'fr' ? 'correct' : 'correct'}</p>
                
                {/* Card results */}
                <div className="space-y-2 mb-6">
                  {cards.map((card, i) => (
                    <div key={i} className={`flex items-center justify-between p-3 rounded-lg ${card.attempts === 0 ? 'bg-green-100' : card.attempts === 1 ? 'bg-gray-100' : 'bg-red-100'}`}>
                      <span className="text-sm font-medium text-[#002844]">{card.word.word_fr}</span>
                      <span className="text-sm font-bold" style={{ color: card.attempts === 0 ? '#2e7d32' : card.attempts === 1 ? '#555555' : '#d32f2f' }}>
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
              /* Active card */
              <div>
                {/* Progress */}
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm font-semibold text-[#555555]">
                    {remainingCards.length} {lang === 'fr' ? 'carte(s) restante(s)' : 'card(s) remaining'}
                  </span>
                  <span className="text-sm font-bold text-[#D9B438]">{correctCount}/5</span>
                </div>

                {/* Card */}
                <div className={`rounded-2xl p-6 shadow-lg mb-4 transition-all ${
                  submitted && currentCard.state === 'correct' ? 'bg-green-50 border-2 border-green-400' :
                  submitted && currentCard.state === 'flipped' ? 'bg-red-50 border-2 border-red-300' :
                  'bg-white border-2 border-[#D9B438]'
                }`}>
                  {/* French word */}
                  <p className="text-center text-lg font-bold text-[#002844] mb-1">{currentCard.word.word_fr}</p>
                  <p className="text-center text-xs text-[#555555] mb-4">{lang === 'fr' ? 'Traduisez en' : 'Translate to'} {activeLang.toUpperCase()}</p>

                  {/* Flipped: show answer */}
                  {submitted && currentCard.state === 'flipped' && (
                    <div className="text-center mb-4 p-3 rounded-lg bg-white/80">
                      <p className="text-xl font-bold text-[#002844]">{currentCard.word.word_target}</p>
                      {currentCard.word.phonetic && <p className="text-xs italic text-[#D9B438]">/{currentCard.word.phonetic}/</p>}
                      <button onClick={() => speakText(currentCard.word.word_target, activeLang)}
                        className="mt-2 p-2 rounded-lg bg-[#D9B438] inline-flex">
                        <Volume2 className="h-4 w-4 text-[#002844]" />
                      </button>
                    </div>
                  )}

                  {submitted && currentCard.state === 'correct' && (
                    <div className="text-center mb-4">
                      <Check className="h-10 w-10 mx-auto text-green-600 mb-1" />
                      <p className="text-lg font-bold text-green-700">{lang === 'fr' ? 'Correct !' : 'Correct!'}</p>
                    </div>
                  )}

                  {/* Input */}
                  {!submitted && (
                    <input type="text" value={answer} onChange={e => setAnswer(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleSubmit() }}
                      className="w-full px-4 py-3 rounded-xl border-2 text-center text-lg font-medium"
                      style={{ borderColor: '#D9B438', color: '#002844' }}
                      placeholder={lang === 'fr' ? 'Votre réponse...' : 'Your answer...'}
                      autoFocus
                    />
                  )}
                </div>

                {/* Buttons */}
                {!submitted ? (
                  <button onClick={handleSubmit} disabled={!answer.trim()}
                    className="w-full py-3 rounded-xl font-bold text-sm disabled:opacity-50"
                    style={{ backgroundColor: '#D9B438', color: '#002844' }}>
                    {lang === 'fr' ? 'Valider' : 'Submit'}
                  </button>
                ) : (
                  <button onClick={handleNext}
                    className="w-full py-3 rounded-xl font-bold text-sm"
                    style={{ backgroundColor: '#002844', color: '#FFFFFF' }}>
                    {lang === 'fr' ? 'Continuer' : 'Continue'}
                  </button>
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
