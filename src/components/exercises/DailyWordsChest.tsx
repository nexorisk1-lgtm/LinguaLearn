'use client'

import { useState, useEffect } from 'react'
import { InterfaceLanguage, User } from '@/types'
import { getVocabulary } from '@/lib/db/bankHelpers'
import { X } from 'lucide-react'

interface DailyWordsChestProps {
  user: User
  activeLang: string
  lang: InterfaceLanguage
}

export default function DailyWordsChest({ user, activeLang, lang }: DailyWordsChestProps) {
  const [showModal, setShowModal] = useState(false)
  const [words, setWords] = useState<{word_target: string; word_fr: string; definition_en?: string}[]>([])
  const [isOpenedToday, setIsOpenedToday] = useState(false)

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

    // Mark chest as opened today
    localStorage.setItem(storageKey, 'true')
    setIsOpenedToday(true)
  }

  const handleCloseModal = () => {
    setShowModal(false)
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

            {/* Words grid */}
            <div className="grid gap-3 mb-6">
              {words.map((word, idx) => (
                <div key={idx} className="p-4 bg-[#F0F0F0] rounded-lg border border-[#D9D9D9]">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <p className="text-base font-bold text-[#002844]">{word.word_target}</p>
                      <p className="text-sm text-[#555555] mt-1">{word.word_fr}</p>
                      {word.definition_en && (
                        <p className="text-xs text-[#999999] mt-2 italic">{word.definition_en}</p>
                      )}
                    </div>
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#D9B438]/20 flex items-center justify-center">
                      <span className="text-lg">{idx + 1}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Close button */}
            <button
              onClick={handleCloseModal}
              className="w-full py-3 bg-[#002844] text-white font-bold rounded-lg hover:bg-[#003a5c] active:scale-95 transition-all"
            >
              {lang === 'fr' ? 'Fermer' : 'Close'}
            </button>
          </div>
        </div>
      )}
    </>
  )
}
