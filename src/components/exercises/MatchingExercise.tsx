'use client';

import { useState, useEffect } from 'react';

interface MatchingPair {
  en: string;
  fr: string;
}

interface Props {
  words: MatchingPair[];
  onComplete: (score: number) => void;
}

export const MatchingExercise: React.FC<Props> = ({ words, onComplete }) => {
  const [leftItems, setLeftItems] = useState<{ id: string; text: string; matched: boolean }[]>([]);
  const [rightItems, setRightItems] = useState<{ id: string; text: string; matched: boolean }[]>([]);
  const [selectedLeft, setSelectedLeft] = useState<string | null>(null);
  const [selectedRight, setSelectedRight] = useState<string | null>(null);
  const [correct, setCorrect] = useState(0);
  const [total] = useState(words.length);

  // Shuffle array
  const shuffle = <T,>(arr: T[]): T[] => [...arr].sort(() => Math.random() - 0.5);

  useEffect(() => {
    if (words.length === 0) return;

    const left = words.map((w, idx) => ({
      id: `left-${idx}`,
      text: w.en,
      matched: false,
    }));

    const right = shuffle(
      words.map((w, idx) => ({
        id: `right-${idx}`,
        text: w.fr,
        matched: false,
      }))
    );

    setLeftItems(left);
    setRightItems(right);
  }, [words]);

  const handleLeftClick = (id: string) => {
    if (leftItems.find((item) => item.id === id)?.matched) return;
    setSelectedLeft(selectedLeft === id ? null : id);
  };

  const handleRightClick = (id: string) => {
    if (rightItems.find((item) => item.id === id)?.matched) return;
    setSelectedRight(selectedRight === id ? null : id);
  };

  const checkMatch = () => {
    if (!selectedLeft || !selectedRight) return;

    // Find which English word is selected
    const selectedLeftItem = leftItems.find((item) => item.id === selectedLeft);
    const selectedRightItem = rightItems.find((item) => item.id === selectedRight);

    if (!selectedLeftItem || !selectedRightItem) return;

    // Find the corresponding word pair
    const wordPair = words.find((w) => w.en === selectedLeftItem.text);

    if (wordPair && wordPair.fr === selectedRightItem.text) {
      // Correct match
      setLeftItems(
        leftItems.map((item) => (item.id === selectedLeft ? { ...item, matched: true } : item))
      );
      setRightItems(
        rightItems.map((item) => (item.id === selectedRight ? { ...item, matched: true } : item))
      );

      setTimeout(() => {
        setCorrect((prev) => {
          const newCorrect = prev + 1;
          if (newCorrect === total) {
            setTimeout(() => onComplete(100), 500);
          }
          return newCorrect;
        });
        setSelectedLeft(null);
        setSelectedRight(null);
      }, 500);
    } else {
      // Wrong match - flash red
      // Add visual feedback
      setTimeout(() => {
        setSelectedLeft(null);
        setSelectedRight(null);
      }, 300);
    }
  };

  useEffect(() => {
    if (selectedLeft && selectedRight) {
      checkMatch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLeft, selectedRight]);

  const progressPercent = total > 0 ? (correct / total) * 100 : 0;

  return (
    <div className="w-full h-full flex flex-col bg-[#F0F0F0] p-6 gap-6">
      {/* Progress Bar */}
      <div className="w-full">
        <div className="w-full bg-gray-300 rounded-full h-2">
          <div
            className="bg-[#D9B438] h-2 rounded-full transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <p className="text-sm text-gray-600 mt-2">
          {correct}/{total} paires trouvées
        </p>
      </div>

      {/* Matching Grid */}
      <div className="flex gap-8 flex-1">
        {/* Left Column - EN */}
        <div className="flex-1 flex flex-col gap-3">
          {leftItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleLeftClick(item.id)}
              disabled={item.matched}
              className={`p-4 rounded-lg font-semibold text-left transition-all ${
                item.matched
                  ? 'bg-green-200 text-green-800 cursor-default'
                  : selectedLeft === item.id
                    ? 'bg-[#D9B438] text-white'
                    : 'bg-white text-[#002844] border-2 border-[#002844] hover:border-[#D9B438]'
              }`}
            >
              {item.text}
            </button>
          ))}
        </div>

        {/* Right Column - FR */}
        <div className="flex-1 flex flex-col gap-3">
          {rightItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleRightClick(item.id)}
              disabled={item.matched}
              className={`p-4 rounded-lg font-semibold text-left transition-all ${
                item.matched
                  ? 'bg-green-200 text-green-800 cursor-default'
                  : selectedRight === item.id
                    ? 'bg-[#D9B438] text-white'
                    : 'bg-white text-[#002844] border-2 border-[#002844] hover:border-[#D9B438]'
              }`}
            >
              {item.text}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
