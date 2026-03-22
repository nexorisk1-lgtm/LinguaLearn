'use client';

import { useState, useEffect } from 'react';
import { InterfaceLanguage } from '@/types';
import { VocabWord } from '@/lib/db/bankTypes';
import { speakText } from '@/lib/db/bankHelpers';

interface Props {
  word: VocabWord;
  wrongOption: string;
  onAnswer: (correct: boolean) => void;
  lang: InterfaceLanguage;
}

export const ListeningExercise: React.FC<Props> = ({
  word,
  wrongOption,
  onAnswer,
  lang,
}) => {
  const [answered, setAnswered] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);

  // Play audio on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      speakText(word.word_target, word.language);
    }, 500);
    return () => clearTimeout(timer);
  }, [word]);

  const correctTranslation = word.word_fr;
  const options = [correctTranslation, wrongOption].sort(() => Math.random() - 0.5);

  const handleAnswer = (selected: string) => {
    const correct = selected === correctTranslation;
    setAnswered(true);
    setIsCorrect(correct);
    setShowFeedback(true);

    setTimeout(() => {
      onAnswer(correct);
    }, 2000);
  };

  const speakerIcon = (
    <svg
      className="w-5 h-5"
      fill="currentColor"
      viewBox="0 0 20 20"
    >
      <path d="M9 4a1 1 0 012 0v12a1 1 0 11-2 0V4zM7 7a1 1 0 011.707 0l1.293 1.293A1 1 0 119.293 9.293L8 8.293 6.707 9.293a1 1 0 01-1.414-1.414L7 7zm6 0a1 1 0 01-1.707 0l-1.293 1.293a1 1 0 111.414 1.414L12 8.293l1.293 1.293a1 1 0 001.414-1.414L13 7z" />
    </svg>
  );

  return (
    <div className="w-full flex flex-col items-center justify-center gap-8 bg-[#F0F0F0] p-6 min-h-96">
      {/* Label */}
      <div className="bg-[#002844] text-white px-6 py-2 rounded-full font-semibold text-sm">
        {lang === 'fr' ? 'PRATIQUEZ LES MOTS DURS' : 'PRACTICE DIFFICULT WORDS'}
      </div>

      {/* Speaker Button */}
      <button
        onClick={() => speakText(word.word_target, word.language)}
        className="flex items-center justify-center w-16 h-16 rounded-full bg-[#D9B438] text-white hover:bg-[#C4A428] active:scale-95 transition-all shadow-lg"
        title="Play audio"
      >
        {speakerIcon}
      </button>

      {/* Question Text */}
      {!answered && (
        <p className="text-lg font-semibold text-[#002844] text-center">
          {lang === 'fr' ? 'Qu\'avez-vous entendu?' : 'What did you hear?'}
        </p>
      )}

      {/* Answer Buttons */}
      <div className="flex flex-col gap-4 w-full max-w-md">
        {options.map((option, idx) => (
          <button
            key={idx}
            onClick={() => handleAnswer(option)}
            disabled={answered}
            className={`py-4 px-6 rounded-lg font-semibold text-lg transition-all ${
              answered
                ? option === correctTranslation
                  ? 'bg-green-200 text-green-800'
                  : 'bg-red-200 text-red-800'
                : 'bg-white text-[#002844] border-2 border-[#002844] hover:border-[#D9B438] hover:bg-yellow-50'
            }`}
          >
            {option}
          </button>
        ))}
      </div>

      {/* Feedback */}
      {showFeedback && (
        <div
          className={`flex flex-col items-center gap-2 p-4 rounded-lg ${
            isCorrect ? 'bg-green-100' : 'bg-red-100'
          }`}
        >
          <p className={`font-bold ${isCorrect ? 'text-green-800' : 'text-red-800'}`}>
            {isCorrect ? (lang === 'fr' ? 'Correct' : 'Correct') : lang === 'fr' ? 'Incorrect' : 'Incorrect'}
          </p>
          {!isCorrect && (
            <p className="text-sm text-gray-700">
              {lang === 'fr' ? 'Bonne réponse: ' : 'Correct answer: '}
              <span className="font-semibold">{correctTranslation}</span>
            </p>
          )}
          {isCorrect && (
            <div className="flex items-center gap-2 text-sm text-green-800">
              <span className="font-semibold">{word.word_target}</span>
              <span>—</span>
              <span className="font-semibold">{word.word_fr}</span>
              <button
                onClick={() => speakText(word.word_target, word.language)}
                className="ml-2 p-1 hover:bg-green-200 rounded"
                title="Play again"
              >
                🔊
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
