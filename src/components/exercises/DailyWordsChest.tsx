'use client'

import { useState, useEffect } from 'react'
import { InterfaceLanguage, User } from '@/types'
import { getVocabulary, speakText } from '@/lib/db/bankHelpers'
import { X, Volume2, ChevronRight, CheckCircle } from 'lucide-react'

interface DailyWordsChestProps {
  user: User
  activeLang: string
  lang: InterfaceLanguage
}

type ChestPhase = 'closed' | 'presenting' | 'quiz' | 'done'

interface WordForChest {
  word_target: string
  word_fr: string
  definition_en?: string
}

interface QuizState {
  currentWordIndex: number
  score: number
  answered: boolean
  selectedOption: string | null
}

export default function DailyWordsChest({ user, activeLang, lang }: DailyWordsChestProps) {
  const [showModal, setShowModal] = useState(false)
  const [phase, setPhase] = useState<ChestPhase>('closed')
  const [words, setWords] = useState<WordForChest[]>([])
  const [isOpenedToday, setIsOpenedToday] = useState(false)
  const [presentingIndex, setPresentingIndex] = useState(0)
  const [quiz, setQuiz] = useState<QuizState>({
    currentWordIndex: 0,
    score: 0,
    answered: false,
    selectedOption: null,
  })

  useEffect(() => {
    // Check if chest was opened today
    const today = new Date().toISOString().split('T')[0]
    const storageKey = `lingualearn_chest_${user.id}_${today}`
    const wasOpenedToday = localStorage.getItem(storageKey) === 'true'
    setIsOpenedToday(wasOpenedToday)
  }, [user.id])

  const handleOpenChest = () => {
    if (isOpenedToday) return

    const today = new Date().toISOString().split('T')[0]
    const storageKey = `lingualearn_chest_${user.id}_${today}`

    // Get user's themes and level
    const langConfig = user.settings.languageConfigs?.[activeLang]
    const themes = langConfig?.themes || []
    const userLevel = user.progress?.[activeLang]?.levelCecrl || 'A1'
    const wordsPerDay = user.settings.schedules?.[activeLang]?.wordsPerDay || 8

    // Fetch vocabulary
    const allWords = getVocabulary(activeLang, themes, userLevel)

    // Randomly select wordsPerDay words
    const shuffled = [...allWords].sort(() => Math.random() - 0.5)
    const selectedWords = shuffled.slice(0, wordsPerDay)

    setWords(selectedWords)
    setShowModal(true)
    setPhase('presenting')
    setPresentingIndex(0)

    // Mark chest as opened today
    localStorage.setItem(storageKey, 'true')
    setIsOpenedToday(true)
  }

  const handleCloseModal = () => {
    setShowModal(false)
    setPhase('closed')
    setPresentingIndex(0)
    setQuiz({ currentWordIndex: 0, score: 0, answered: false, selectedOption: null })
  }

  const handleNextPresenting = () => {
    if (presentingIndex < words.length - 1) {
      setPresentingIndex(presentingIndex + 1)
    } else {
      // Move to quiz phase
      setPhase('quiz')
      setQuiz({ currentWordIndex: 0, score: 0, answered: false, selectedOption: null })
    }
  }

  const generateQuizOptions = (): { options: string[]; correctAnswer: string } => {
    const currentWord = words[quiz.currentWordIndex]
    const correctAnswer = currentWord.word_fr
    const options = [correctAnswer]

    // Get 2 random wrong answers
    const otherWords = words.filter((_, idx) => idx !== quiz.currentWordIndex)
    const shuffled = otherWords.sort(() => Math.random() - 0.5).slice(0, 2)
    options.push(...shuffled.map((w) => w.word_fr))

    // Shuffle options
    const shuffledOptions = options.sort(() => Math.random() - 0.5)
    return { options: shuffledOptions, correctAnswer }
  }

  const handleQuizAnswer = (selectedValue: string) => {
    const currentWord = words[quiz.currentWordIndex]
    const isCorrect = selectedValue === currentWord.word_fr
    const newScore = isCorrect ? quiz.score + 1 : quiz.score

    setQuiz((prev) => ({
      ...prev,
      answered: true,
      selectedOption: selectedValue,
      score: newScore,
    }))
  }

  const handleNextQuiz = () => {
    if (quiz.currentWordIndex < words.length - 1) {
      setQuiz({
        currentWordIndex: quiz.currentWordIndex + 1,
        score: quiz.score,
        answered: false,
        selectedOption: null,
      })
    } else {
      // Move to done phase
      setPhase('done')
    }
  }

  // CSS animation for chest
  const chestAnimationStyle = `
    @keyframes bobbing {
      0%, 100% { transform: translateY(0px); }
      50% { transform: translateY(-8px); }
    }
    .chest-bobbing {
      animation: bobbing 2s ease-in-out infinite;
    }
  `

  if (isOpenedToday) {
    return (
      <div className="rounded-2xl bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xl">🎁</span>
          <span className="font-bold text-sm text-[#002844]">
            {lang === 'fr' ? 'Mots du jour' : "Today's words"}
          </span>
        </div>
        <p className="text-sm text-[#10B981] font-semibold">
          {lang === 'fr' ? 'Coffre ouvert ✓' : 'Chest opened ✓'}
        </p>
      </div>
    )
  }

  return (
    <>
      <style>{chestAnimationStyle}</style>
      <button
        onClick={handleOpenChest}
        className="w-full rounded-2xl bg-gradient-to-br from-[#D9B438]/30 to-[#D9B438]/10 border border-[#D9B438] p-4 shadow-sm hover:shadow-md transition-all active:scale-95"
      >
        <div className="flex items-center gap-3">
          <div className="chest-bobbing text-3xl">📦</div>
          <div className="flex-1 text-left">
            <p className="font-bold text-sm text-[#002844]">
              {lang === 'fr' ? 'Ouvrez le coffre avec les mots du jour' : 'Open the daily words chest'}
            </p>
            <p className="text-xs text-[#555555] mt-0.5">
              {lang === 'fr' ? 'Découvrez vos nouvelles palabras' : 'Discover your new words'}
            </p>
          </div>
        </div>
      </button>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto p-6 animate-in fade-in slide-in-from-bottom-4">
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <span className="text-3xl">📦</span>
                <h2 className="text-xl font-bold text-[#002844]">
                  {lang === 'fr' ? 'Mots du jour' : "Today's words"}
                </h2>
              </div>
              <button
                onClick={handleCloseModal}
                className="p-2 hover:bg-[#F0F0F0] rounded-lg transition-colors"
              >
                <X className="h-5 w-5 text-[#555555]" />
              </button>
            </div>

            {/* PRESENTATION PHASE */}
            {phase === 'presenting' && (
              <div className="space-y-6">
                {/* Progress */}
                <div className="text-sm text-[#555555]">
                  {lang === 'fr' ? 'Découvrez les mots' : 'Discover words'} ({presentingIndex + 1}/{words.length})
                </div>

                {/* Current word */}
                <div className="bg-gradient-to-br from-[#D9B438]/10 to-[#D9B438]/5 rounded-xl p-8 text-center">
                  <p className="text-5xl font-bold text-[#002844] mb-4">
                    {words[presentingIndex].word_target}
                  </p>
                  <p className="text-2xl text-[#D9B438] font-semibold mb-6">
                    {words[presentingIndex].word_fr}
                  </p>
                  {words[presentingIndex].definition_en && (
                    <p className="text-sm text-[#555555] italic mb-6">
                      {words[presentingIndex].definition_en}
                    </p>
                  )}
                  <button
                    onClick={() => speakText(words[presentingIndex].word_target, activeLang)}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-[#D9B438] text-white rounded-lg hover:bg-[#c9a830] transition-colors"
                  >
                    <Volume2 className="h-4 w-4" />
                    {lang === 'fr' ? 'Écouter' : 'Listen'}
                  </button>
                </div>

                {/* Next button */}
                <button
                  onClick={handleNextPresenting}
                  className="w-full py-3 bg-[#002844] text-white font-bold rounded-lg hover:bg-[#003a5c] active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  {presentingIndex < words.length - 1
                    ? lang === 'fr'
                      ? 'Suivant'
                      : 'Next'
                    : lang === 'fr'
                    ? 'Commencer le quiz'
                    : 'Start Quiz'}
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}

            {/* QUIZ PHASE */}
            {phase === 'quiz' && (
              <div className="space-y-6">
                {/* Progress */}
                <div className="text-sm text-[#555555]">
                  {lang === 'fr' ? 'Quiz' : 'Quiz'} ({quiz.currentWordIndex + 1}/{words.length})
                </div>

                {/* Current word question */}
                <div>
                  <p className="text-lg font-semibold text-[#002844] mb-4">
                    {lang === 'fr'
                      ? 'Quel est la traduction de:'
                      : 'What is the translation of:'}
                  </p>
                  <p className="text-3xl font-bold text-[#002844] mb-4">
                    {words[quiz.currentWordIndex].word_target}
                  </p>
                </div>

                {/* Quiz options */}
                <div className="space-y-3">
                  {(() => {
                    const { options } = generateQuizOptions()
                    return options.map((option, idx) => {
                      const isCorrect = option === words[quiz.currentWordIndex].word_fr
                      const isSelected = option === quiz.selectedOption
                      const showFeedback = quiz.answered

                      return (
                        <button
                          key={idx}
                          onClick={() => !quiz.answered && handleQuizAnswer(option)}
                          disabled={quiz.answered}
                          className={`w-full p-4 rounded-lg border-2 text-left font-medium transition-all ${
                            showFeedback
                              ? isCorrect
                                ? 'bg-green-50 border-green-400'
                                : isSelected
                                ? 'bg-red-50 border-red-400'
                                : 'bg-gray-50 border-gray-300'
                              : 'border-[#D9D9D9] hover:border-[#D9B438] cursor-pointer'
                          } ${!quiz.answered ? 'active:scale-95' : ''}`}
                          style={{
                            color: showFeedback
                              ? isCorrect || isSelected
                                ? '#002844'
                                : '#555555'
                              : '#002844',
                          }}
                        >
                          <div className="flex items-center justify-between">
                            <span>{option}</span>
                            {showFeedback && isCorrect && (
                              <CheckCircle className="h-5 w-5 text-green-600" />
                            )}
                          </div>
                        </button>
                      )
                    })
                  })()}
                </div>

                {/* Next button */}
                {quiz.answered && (
                  <button
                    onClick={handleNextQuiz}
                    className="w-full py-3 bg-[#002844] text-white font-bold rounded-lg hover:bg-[#003a5c] active:scale-95 transition-all flex items-center justify-center gap-2"
                  >
                    {quiz.currentWordIndex < words.length - 1
                      ? lang === 'fr'
                        ? 'Suivant'
                        : 'Next'
                      : lang === 'fr'
                      ? 'Voir le résultat'
                      : 'See Results'}
                    <ChevronRight className="h-4 w-4" />
                  </button>
                )}
              </div>
            )}

            {/* DONE PHASE */}
            {phase === 'done' && (
              <div className="space-y-6 text-center">
                <div className="text-6xl mb-4">🎉</div>
                <h3 className="text-2xl font-bold text-[#002844]">
                  {lang === 'fr' ? 'Félicitations!' : 'Congratulations!'}
                </h3>
                <p className="text-4xl font-bold text-[#D9B438]">
                  {quiz.score}/{words.length}
                </p>
                <p className="text-[#555555]">
                  {lang === 'fr'
                    ? 'Vous avez complété le coffre du jour!'
                    : 'You completed today\'s chest!'}
                </p>
                <button
                  onClick={handleCloseModal}
                  className="w-full py-3 bg-[#002844] text-white font-bold rounded-lg hover:bg-[#003a5c] active:scale-95 transition-all"
                >
                  {lang === 'fr' ? 'Fermer' : 'Close'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
