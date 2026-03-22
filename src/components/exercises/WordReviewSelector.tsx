'use client';

import { useState } from 'react';
import { InterfaceLanguage } from '@/types';
import { VocabWord } from '@/lib/db/bankTypes';

interface Props {
  words: VocabWord[];
  onSelect: (selectedIds: string[]) => void;
  lang: InterfaceLanguage;
}

export const WordReviewSelector: React.FC<Props> = ({ words, onSelect, lang }) => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleWord = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleConfirm = () => {
    onSelect(Array.from(selectedIds));
  };

  const count = selectedIds.size;
  const headerText = lang === 'fr' ? 'Choisissez les mots à revoir plus tard' : 'Choose words to review later';
  const buttonText = lang === 'fr' ? `Ajouter ${count} mot${count !== 1 ? 's' : ''}` : `Add ${count} word${count !== 1 ? 's' : ''}`;

  return (
    <div className="w-full flex flex-col gap-6 bg-[#F0F0F0] p-6 rounded-lg">
      {/* Header */}
      <div>
        <h2 className="text-lg font-bold text-[#002844]">{headerText}</h2>
      </div>

      {/* Word List */}
      <div className="flex flex-col gap-3 max-h-96 overflow-y-auto">
        {words.map((word) => (
          <label
            key={word.id}
            className="flex items-center gap-3 p-3 bg-white rounded-lg border-2 border-[#002844] hover:border-[#D9B438] cursor-pointer transition-all"
          >
            <input
              type="checkbox"
              checked={selectedIds.has(word.id)}
              onChange={() => toggleWord(word.id)}
              className="w-5 h-5 cursor-pointer accent-[#D9B438]"
            />
            <div className="flex-1">
              <p className="font-semibold text-[#002844]">{word.word_target}</p>
              <p className="text-sm text-gray-600">{word.word_fr}</p>
            </div>
          </label>
        ))}
      </div>

      {/* Confirm Button */}
      <button
        onClick={handleConfirm}
        disabled={count === 0}
        className={`w-full py-3 rounded-lg font-bold text-white transition-all ${
          count === 0
            ? 'bg-gray-400 cursor-not-allowed'
            : 'bg-[#D9B438] hover:bg-[#C4A428] active:scale-95'
        }`}
      >
        {buttonText}
      </button>
    </div>
  );
};
