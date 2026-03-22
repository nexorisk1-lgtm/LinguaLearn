'use client'

import { useState } from 'react'
import { InterfaceLanguage } from '@/types'

interface WordBlock {
  word: string
  role: 'subject' | 'modal' | 'verb' | 'other'
}

interface GrammarDragDropProps {
  rule: string
  sentenceFr: string
  wordsEn: WordBlock[]
  correctOrder: string[]
  onAnswer: (correct: boolean) => void
  lang: InterfaceLanguage
}

const roleColors: Record<string, { bg: string; text: string }> = {
  subject: { bg: '#3B82F6', text: 'white' },
  modal: { bg: '#F59E0B', text: 'white' },
  verb: { bg: '#10B981', text: 'white' },
  other: { bg: '#6B7280', text: 'white' },
}

export default function GrammarDragDrop({
  rule,
  sentenceFr,
  wordsEn,
  correctOrder,
  onAnswer,
  lang,
}: GrammarDragDropProps) {
  const [poolWords, setPoolWords] = useState<WordBlock[]>(wordsEn)
  const [placedWords, setPlacedWords] = useState<WordBlock[]>([])
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | null; message: string }>({
    type: null,
    message: '',
  })

  const handleAddToDropZone = (word: WordBlock) => {
    setPoolWords((prev) => prev.filter((w) => w.word !== word.word || prev.indexOf(w) !== poolWords.indexOf(word)))
    setPlacedWords((prev) => [...prev, word])
    setFeedback({ type: null, message: '' })
  }

  const handleRemoveFromDropZone = (index: number) => {
    const word = placedWords[index]
    setPlacedWords((prev) => prev.filter((_, i) => i !== index))
    setPoolWords((prev) => [...prev, word])
    setFeedback({ type: null, message: '' })
  }

  const handleVerify = () => {
    const userOrder = placedWords.map((w) => w.word)
    const isCorrect = JSON.stringify(userOrder) === JSON.stringify(correctOrder)

    if (isCorrect) {
      setFeedback({
        type: 'success',
        message: lang === 'fr' ? 'Correct ! 🎉' : 'Correct! 🎉',
      })
      onAnswer(true)
    } else {
      setFeedback({
        type: 'error',
        message: lang === 'fr' ? 'Pas correct. Essaie à nouveau.' : 'Not correct. Try again.',
      })
      onAnswer(false)
    }
  }

  return (
    <div className="w-full bg-white rounded-2xl p-6 shadow-sm">
      {/* Rule header */}
      <div className="mb-6">
        <h3 className="text-sm font-bold text-[#002844] uppercase tracking-wide">
          {lang === 'fr' ? 'Règle' : 'Rule'}
        </h3>
        <p className="text-base font-bold text-[#002844] mt-2">{rule}</p>
      </div>

      {/* French sentence */}
      <div className="mb-6 p-4 bg-[#F0F0F0] rounded-lg">
        <p className="text-sm text-[#555555] mb-1">{lang === 'fr' ? 'En français:' : 'In French:'}</p>
        <p className="text-lg font-semibold text-[#002844]">{sentenceFr}</p>
      </div>

      {/* Drop zone */}
      <div className="mb-6">
        <p className="text-sm font-bold text-[#002844] mb-2">
          {lang === 'fr' ? 'Construis ta phrase:' : 'Build your sentence:'}
        </p>
        <div className="min-h-24 p-4 border-2 border-dashed border-[#D9D9D9] rounded-lg bg-[#F9F9F9]">
          {placedWords.length === 0 ? (
            <p className="text-sm text-[#999999] italic">
              {lang === 'fr' ? 'Clique sur les mots ci-dessous pour les ajouter ici' : 'Click words below to add them here'}
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {placedWords.map((word, idx) => (
                <button
                  key={idx}
                  onClick={() => handleRemoveFromDropZone(idx)}
                  className="px-4 py-2 rounded-lg font-semibold text-sm transition-all hover:opacity-80 cursor-pointer"
                  style={{
                    backgroundColor: roleColors[word.role]?.bg || '#6B7280',
                    color: roleColors[word.role]?.text || 'white',
                  }}
                  title={lang === 'fr' ? 'Clique pour retirer' : 'Click to remove'}
                >
                  {word.word}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Word pool */}
      <div className="mb-6">
        <p className="text-sm font-bold text-[#002844] mb-2">
          {lang === 'fr' ? 'Mots disponibles:' : 'Available words:'}
        </p>
        <div className="flex flex-wrap gap-2">
          {poolWords.map((word, idx) => (
            <button
              key={idx}
              onClick={() => handleAddToDropZone(word)}
              className="px-4 py-2 rounded-lg font-semibold text-sm transition-all hover:scale-105 cursor-pointer shadow-sm"
              style={{
                backgroundColor: roleColors[word.role]?.bg || '#6B7280',
                color: roleColors[word.role]?.text || 'white',
              }}
            >
              {word.word}
            </button>
          ))}
        </div>
      </div>

      {/* Verify button */}
      <button
        onClick={handleVerify}
        disabled={placedWords.length === 0}
        className={`w-full py-3 rounded-lg font-bold text-base transition-all ${
          placedWords.length === 0
            ? 'bg-[#D9D9D9] text-[#999999] cursor-not-allowed'
            : 'bg-[#002844] text-white hover:bg-[#003a5c] active:scale-95'
        }`}
      >
        {lang === 'fr' ? 'Vérifier' : 'Check'}
      </button>

      {/* Feedback */}
      {feedback.type && (
        <div
          className={`mt-4 p-4 rounded-lg text-center font-semibold text-base ${
            feedback.type === 'success'
              ? 'bg-[#10B981]/10 text-[#10B981] border border-[#10B981]'
              : 'bg-[#EF4444]/10 text-[#EF4444] border border-[#EF4444]'
          }`}
        >
          {feedback.message}
        </div>
      )}
    </div>
  )
}
