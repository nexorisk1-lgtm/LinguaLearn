'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle, XCircle } from 'lucide-react';
import { getCurrentUser, getDueReviews, saveReviewItem, ReviewItem } from '@/lib/db/localStorage';
import { User, InterfaceLanguage, LearningLanguage } from '@/types';
import BottomNav from '@/components/BottomNav';
import PageHeader from '@/components/PageHeader';
import { getVocabulary, speakText } from '@/lib/db/bankHelpers';
import { VocabWord } from '@/lib/db/bankTypes';

// V3.11: Dedicated revision exercise flow
// QCM format: word displayed + choose correct translation among 2-3 options

function shuffleArray<T>(arr: T[]): T[] {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export default function RevisionsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [lang, setLang] = useState<InterfaceLanguage>('fr');
  const [activeLang, setActiveLang] = useState<LearningLanguage>('en');
  const [loading, setLoading] = useState(true);

  // Exercise state
  const [reviewWords, setReviewWords] = useState<VocabWord[]>([]);
  const [allVocab, setAllVocab] = useState<VocabWord[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [phase, setPhase] = useState<'exercise' | 'summary'>('exercise');
  const [dueItems, setDueItems] = useState<ReviewItem[]>([]);

  useEffect(() => {
    const currentUser = getCurrentUser();
    if (!currentUser) { router.push('/auth'); return; }
    setUser(currentUser);
    setLang(currentUser.settings.interfaceLang || 'fr');

    const aLang = (currentUser.activeLang || currentUser.settings.learningLangs[0] || 'en') as LearningLanguage;
    setActiveLang(aLang);

    const config = currentUser.settings.languageConfigs?.[aLang];
    const themes = config?.themes || [];
    const vocab = getVocabulary(aLang, themes, 'A1');
    setAllVocab(vocab);

    // Get due review items
    const due = getDueReviews(currentUser.id, aLang);
    const dueWordItems = due.filter(d => d.type === 'word');
    setDueItems(dueWordItems);

    // Match due items to vocabulary words
    const wordsToReview = dueWordItems
      .map(d => vocab.find(w => w.id === d.itemId))
      .filter((w): w is VocabWord => w !== undefined);

    setReviewWords(shuffleArray(wordsToReview));
    setLoading(false);
  }, [router]);

  if (loading || !user) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#F0F0F0]">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-[#002844]" />
      </div>
    );
  }

  const currentWord = reviewWords[currentIdx];

  const getDistractors = (correct: VocabWord, count: number): string[] => {
    const pool = allVocab.filter(w => w.id !== correct.id && w.word_fr !== correct.word_fr);
    return shuffleArray(pool).slice(0, count).map(w => w.word_fr);
  };

  const handleSelect = (option: string, correctAnswer: string) => {
    if (showFeedback) return;
    setSelectedOption(option);
    const correct = option.toLowerCase().trim() === correctAnswer.toLowerCase().trim();
    setIsCorrect(correct);
    setShowFeedback(true);
    setTotalCount(prev => prev + 1);
    if (correct) setCorrectCount(prev => prev + 1);

    setTimeout(() => {
      // Save review result with spaced repetition
      if (currentWord) {
        saveReviewItem(user.id, activeLang, currentWord.id, 'word', correct ? 100 : 0);
      }

      setSelectedOption(null);
      setShowFeedback(false);
      if (currentIdx + 1 >= reviewWords.length) {
        setPhase('summary');
      } else {
        setCurrentIdx(prev => prev + 1);
      }
    }, 1200);
  };

  // No words to review
  if (reviewWords.length === 0 && phase === 'exercise') {
    return (
      <div className="min-h-screen pb-20 bg-[#F0F0F0]">
        <PageHeader title={lang === 'fr' ? 'Révisions' : 'Reviews'} backHref="/dashboard" />
        <div className="px-4 py-12 text-center max-w-lg mx-auto">
          <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="h-10 w-10 text-green-500" />
          </div>
          <h2 className="text-xl font-bold text-[#002844] mb-2">
            {lang === 'fr' ? 'Rien à réviser !' : 'Nothing to review!'}
          </h2>
          <p className="text-sm text-[#555555] mb-6">
            {lang === 'fr'
              ? 'Tous tes mots sont à jour. Continue tes leçons pour alimenter tes révisions.'
              : 'All your words are up to date. Keep doing lessons to build your review list.'}
          </p>
          <a href="/dashboard"
            className="inline-block px-6 py-3 rounded-xl bg-[#002844] text-white font-bold text-sm">
            {lang === 'fr' ? 'Retour au dashboard' : 'Back to dashboard'}
          </a>
        </div>
        <BottomNav lang={lang} />
      </div>
    );
  }

  // Summary phase
  if (phase === 'summary') {
    const pct = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0;
    return (
      <div className="min-h-screen pb-20 bg-[#F0F0F0]">
        <PageHeader title={lang === 'fr' ? 'Révisions terminées' : 'Reviews complete'} backHref="/dashboard" />
        <div className="px-4 py-8 max-w-lg mx-auto text-center">
          <div className="w-20 h-20 rounded-full bg-[#D9B438]/20 flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="h-10 w-10 text-[#D9B438]" />
          </div>
          <h2 className="text-2xl font-bold text-[#002844] mb-2">
            {lang === 'fr' ? 'Bravo !' : 'Well done!'}
          </h2>
          <p className="text-sm text-[#555555] mb-6">
            {correctCount}/{totalCount} {lang === 'fr' ? 'bonnes réponses' : 'correct'} ({pct}%)
          </p>
          <div className="flex gap-3 justify-center">
            <a href="/dashboard"
              className="px-6 py-3 rounded-xl bg-[#002844] text-white font-bold text-sm">
              {lang === 'fr' ? 'Retour' : 'Back'}
            </a>
            {dueItems.length > reviewWords.length && (
              <button onClick={() => { setCurrentIdx(0); setCorrectCount(0); setTotalCount(0); setPhase('exercise'); }}
                className="px-6 py-3 rounded-xl bg-[#D9B438] text-[#002844] font-bold text-sm">
                {lang === 'fr' ? 'Répète les mots' : 'Repeat words'}
              </button>
            )}
          </div>
        </div>
        <BottomNav lang={lang} />
      </div>
    );
  }

  // Exercise phase — QCM
  if (!currentWord) return null;

  const correctAnswer = currentWord.word_fr;
  const distractors = getDistractors(currentWord, 2);
  const options = shuffleArray([correctAnswer, ...distractors]);
  const progressPct = Math.round(((currentIdx) / reviewWords.length) * 100);

  return (
    <div className="min-h-screen pb-20 bg-[#F0F0F0]">
      <PageHeader title={lang === 'fr' ? 'Révisions' : 'Reviews'} backHref="/dashboard" />

      {/* Progress bar */}
      <div className="bg-[#002844] px-4 pb-3">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <div className="flex-1">
            <div className="h-1.5 w-full bg-white/20 rounded-full">
              <div className="h-full bg-[#D9B438] rounded-full transition-all" style={{ width: `${progressPct}%` }} />
            </div>
          </div>
          <span className="text-xs text-white/60">{currentIdx + 1}/{reviewWords.length}</span>
        </div>
      </div>

      <div className="px-4 py-6">
        <div className="max-w-lg mx-auto">
          {/* Word display */}
          <div className="bg-white rounded-2xl p-8 shadow-sm mb-6 text-center">
            <p className="text-3xl font-bold text-[#002844] mb-3">{currentWord.word_target}</p>
            <button onClick={() => speakText(currentWord.word_target, activeLang)}
              className="mx-auto mb-2 text-sm text-[#D9B438] font-semibold">
              🔊 {lang === 'fr' ? 'Écouter' : 'Listen'}
            </button>
            <p className="text-xs text-[#999] uppercase tracking-wide">{currentWord.theme} · {currentWord.level}</p>
          </div>

          {/* Question */}
          <p className="text-sm font-bold text-[#002844] mb-3 text-center">
            {lang === 'fr' ? 'Quelle est la traduction ?' : 'What is the translation?'}
          </p>

          {/* QCM options */}
          <div className="space-y-3">
            {options.map((opt, i) => {
              let btnClass = 'w-full py-4 px-5 rounded-xl text-left font-bold text-sm transition-all border-2 ';
              if (showFeedback) {
                if (opt === correctAnswer) {
                  btnClass += 'bg-green-50 border-green-500 text-green-700';
                } else if (opt === selectedOption) {
                  btnClass += 'bg-red-50 border-red-500 text-red-700';
                } else {
                  btnClass += 'bg-white border-gray-200 text-[#555555] opacity-50';
                }
              } else {
                btnClass += opt === selectedOption
                  ? 'bg-[#002844]/5 border-[#002844] text-[#002844]'
                  : 'bg-white border-gray-200 text-[#002844] hover:border-[#D9B438]';
              }
              return (
                <button key={i} onClick={() => handleSelect(opt, correctAnswer)} className={btnClass} disabled={showFeedback}>
                  {opt}
                </button>
              );
            })}
          </div>

          {/* Feedback */}
          {showFeedback && (
            <div className={`mt-4 p-3 rounded-xl flex items-center gap-2 ${isCorrect ? 'bg-green-50' : 'bg-red-50'}`}>
              {isCorrect
                ? <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
                : <XCircle className="h-5 w-5 text-red-500 flex-shrink-0" />}
              <span className={`text-sm font-bold ${isCorrect ? 'text-green-700' : 'text-red-700'}`}>
                {isCorrect
                  ? (lang === 'fr' ? 'Bravo !' : 'Well done!')
                  : (lang === 'fr' ? `La réponse était : ${correctAnswer}` : `The answer was: ${correctAnswer}`)}
              </span>
            </div>
          )}
        </div>
      </div>
      <BottomNav lang={lang} />
    </div>
  );
}
