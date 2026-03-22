'use client';

import React from 'react';
import { InterfaceLanguage } from '@/types';

interface Props {
  xpGained: number;
  timeSeconds: number;
  scorePercent: number;
  onContinue: () => void;
  lang: InterfaceLanguage;
}

export const TransitionScreen: React.FC<Props> = ({
  xpGained,
  timeSeconds,
  scorePercent,
  onContinue,
  lang,
}) => {
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getSpeedLabel = () => {
    if (timeSeconds < 60) {
      return lang === 'fr' ? 'Rapide' : 'Fast';
    } else if (timeSeconds <= 180) {
      return lang === 'fr' ? 'Stable' : 'Stable';
    } else {
      return lang === 'fr' ? 'Lent' : 'Slow';
    }
  };

  const getScoreLabel = () => {
    if (scorePercent >= 80) {
      return lang === 'fr' ? 'Super' : 'Great';
    } else if (scorePercent >= 60) {
      return lang === 'fr' ? 'Bien' : 'Good';
    } else {
      return lang === 'fr' ? 'À retravailler' : 'Keep practicing';
    }
  };

  const continueText = lang === 'fr' ? 'Continuer' : 'Continue';

  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-[#F0F0F0] p-6 gap-8 relative overflow-hidden">
      {/* Confetti Animation */}
      <style>{`
        @keyframes confetti-fall {
          0% {
            opacity: 1;
            transform: translateY(-10vh) rotate(0deg);
          }
          100% {
            opacity: 0;
            transform: translateY(100vh) rotate(720deg);
          }
        }

        .confetti-particle {
          position: fixed;
          pointer-events: none;
          animation: confetti-fall 3s ease-in forwards;
        }
      `}</style>

      {/* Confetti Generator */}
      {typeof window !== 'undefined' &&
        Array.from({ length: 30 }).map((_, idx) => (
          <div
            key={idx}
            className="confetti-particle"
            style={{
              left: `${Math.random() * 100}%`,
              top: '-10px',
              width: '12px',
              height: '12px',
              backgroundColor: Math.random() > 0.5 ? '#D9B438' : '#002844',
              borderRadius: Math.random() > 0.5 ? '50%' : '0',
              animationDelay: `${Math.random() * 0.5}s`,
            }}
          />
        ))}

      {/* Title */}
      <h1 className="text-3xl font-bold text-[#002844] text-center">
        {lang === 'fr' ? 'Exercice terminé!' : 'Exercise completed!'}
      </h1>

      {/* Results Grid */}
      <div className="grid grid-cols-3 gap-6 w-full max-w-2xl">
        {/* XP Gained Block */}
        <div className="flex flex-col items-center gap-3 bg-white rounded-lg p-6 border-2 border-[#002844]">
          <div className="relative">
            <div className="text-5xl font-bold text-[#D9B438]">{xpGained}</div>
            <div className="absolute -top-2 -right-4 w-8 h-8 bg-[#D9B438] rounded-full flex items-center justify-center text-white text-sm font-bold">
              ⭐
            </div>
          </div>
          <p className="text-sm font-semibold text-gray-600">
            {lang === 'fr' ? 'Points XP' : 'XP Points'}
          </p>
        </div>

        {/* Speed Block */}
        <div className="flex flex-col items-center gap-3 bg-white rounded-lg p-6 border-2 border-[#002844]">
          <div className="text-2xl font-bold text-[#002844]">
            {formatTime(timeSeconds)}
          </div>
          <p className="text-sm font-semibold text-[#D9B438]">{getSpeedLabel()}</p>
        </div>

        {/* Score Block */}
        <div className="flex flex-col items-center gap-3 bg-white rounded-lg p-6 border-2 border-[#002844]">
          <div className="text-3xl font-bold text-[#002844]">{scorePercent}%</div>
          <p className="text-sm font-semibold text-[#D9B438]">{getScoreLabel()}</p>
        </div>
      </div>

      {/* Continue Button */}
      <button
        onClick={onContinue}
        className="bg-[#D9B438] hover:bg-[#C4A428] active:scale-95 text-white font-bold py-3 px-12 rounded-lg transition-all text-lg"
      >
        {continueText}
      </button>
    </div>
  );
};
