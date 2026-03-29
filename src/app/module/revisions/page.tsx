'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle, XCircle, Clock } from 'lucide-react';
import { getCurrentUser, getDueReviews, getUpcomingReviews, saveReviewItem, ReviewItem } from '@/lib/db/localStorage';
import { User, InterfaceLanguage, LearningLanguage } from '@/types';
import BottomNav from '@/components/BottomNav';
import PageHeader from '@/components/PageHeader';
import { speakText } from '@/lib/db/bankHelpers';
import { VocabWord } from '@/lib/db/bankTypes';
import { BANK_A1_COURSES, getA1CourseVocabulary } from '@/lib/db/bankA1Courses';

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

interface SessionResult {
  word: VocabWord;
  correct: boolean;
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
  // BUG-78: Track upcoming reviews
  const [upcomingCount, setUpcomingCount] = useState(0);
  const [upcomingNextDate, setUpcomingNextDate] = useState<string | null>(null);

  // Session tracking (BLOC 4 enhancements)
  const [, setSessionResults] = useState<SessionResult[]>([]);
  const [sessionStartTime, setSessionStartTime] = useState<Date | null>(null);
  const [sessionElapsed, setSessionElapsed] = useState(0);
  const [weakWords, setWeakWords] = useState<VocabWord[]>([]);
  const MAX_SESSION_WORDS = 10;

  useEffect(() => {
    const currentUser = getCurrentUser();
    if (!currentUser) { router.push('/auth'); return; }
    setUser(currentUser);
    setLang(currentUser.settings.interfaceLang || 'fr');

    const aLang = (currentUser.activeLang || currentUser.settings.learningLangs[0] || 'en') as LearningLanguage;
    setActiveLang(aLang);

    // P0-8: ONLY completed course vocabulary — filter to courses with score >= 60
    const scoreKey = `lingualearn_course_scores_${currentUser.id}_${aLang}`;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const scores: Record<string, any> = (() => { try { return JSON.parse(localStorage.getItem(scoreKey) || '{}'); } catch { return {}; } })();
    const a1Vocab: VocabWord[] = [];
    for (const course of BANK_A1_COURSES) {
      if (scores[course.id] && scores[course.id].score >= 60) {
        a1Vocab.push(...getA1CourseVocabulary(course.id));
      }
    }
    const vocab = a1Vocab; // Only completed course vocabulary
    setAllVocab(vocab);

    // Get due review items
    const due = getDueReviews(currentUser.id, aLang);
    const dueWordItems = due.filter(d => d.type === 'word');
    setDueItems(dueWordItems);

    // Match due items to vocabulary words
    const wordsToReview = dueWordItems
      .map(d => vocab.find(w => w.id === d.itemId))
      .filter((w): w is VocabWord => w !== undefined);

    // BLOC 4: Limit to MAX_SESSION_WORDS for 3-5 min sessions targeting fragile words
    const limitedWords = shuffleArray(wordsToReview).slice(0, MAX_SESSION_WORDS);
    setReviewWords(limitedWords);

    // BUG-78: Get upcoming scheduled reviews
    const upcoming = getUpcomingReviews(currentUser.id, aLang);
    setUpcomingCount(upcoming.count);
    setUpcomingNextDate(upcoming.nextDate);

    // BLOC 4: Initialize session timer
    setSessionStartTime(new Date());

    setLoading(false);
  }, [router]);

  // BLOC 4: Timer update effect
  useEffect(() => {
    if (!sessionStartTime || phase !== 'exercise') return;
    const interval = setInterval(() => {
      const now = new Date();
      const diff = Math.floor((now.getTime() - sessionStartTime.getTime()) / 1000);
      setSessionElapsed(diff);
    }, 1000);
    return () => clearInterval(interval);
  }, [sessionStartTime, phase]);

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

    // BLOC 4: Track session results for enhanced summary
    if (currentWord) {
      setSessionResults(prev => [...prev, { word: currentWord, correct }]);
    }

    // BLOC 4: Track weak words (incorrect answers)
    if (!correct && currentWord) {
      setWeakWords(prev =>
        prev.find(w => w.id === currentWord.id) ? prev : [...prev, currentWord]
      );
    }

    setTimeout(() => {
      // Save review result with spaced repetition (SM-2 via saveReviewItem)
      if (currentWord) {
        saveReviewItem(user.id, activeLang, currentWord.id, 'word', correct ? 100 : 0);
      }

      setSelectedOption(null);
      setShowFeedback(false);
      if (currentIdx + 1 >= reviewWords.length) {
        // V3.16 BUG-66: Mark revisions done today for planning validation
        try {
          const revKey = `lingualearn_revision_done_today_${user.id}`;
          localStorage.setItem(revKey, new Date().toISOString().split('T')[0]);
        } catch { /* ignore */ }
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
            {lang === 'fr' ? 'Rien à réviser aujourd\'hui !' : 'Nothing to review today!'}
          </h2>
          {/* BUG-78: Show upcoming scheduled reviews */}
          {upcomingCount > 0 ? (
            <p className="text-sm text-[#555555] mb-6">
              {lang === 'fr'
                ? `${upcomingCount} mot${upcomingCount > 1 ? 's' : ''} à réviser ${upcomingNextDate === new Date(Date.now() + 86400000).toISOString().split('T')[0] ? 'demain' : `le ${upcomingNextDate}`}.`
                : `${upcomingCount} word${upcomingCount > 1 ? 's' : ''} scheduled for review on ${upcomingNextDate}.`}
            </p>
          ) : (
            <p className="text-sm text-[#555555] mb-6">
              {lang === 'fr'
                ? 'Tous tes mots sont à jour. Continue tes leçons pour alimenter tes révisions.'
                : 'All your words are up to date. Keep doing lessons to build your review list.'}
            </p>
          )}
          <a href="/dashboard"
            className="inline-block px-6 py-3 rounded-xl bg-[#002844] text-white font-bold text-sm">
            {lang === 'fr' ? 'Retour au dashboard' : 'Back to dashboard'}
          </a>
        </div>
        <BottomNav lang={lang} />
      </div>
    );
  }

  // Summary phase — BLOC 4 enhanced with session stats
  if (phase === 'summary') {
    const pct = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0;
    const reprogrammedCount = totalCount - correctCount;
    const gameScore = correctCount * 3; // +3 pts per correct answer
    const nextReviewDate = new Date();
    nextReviewDate.setDate(nextReviewDate.getDate() + 1);

    // Calculate "prochaine révision" info (next session shows "J+1" for rescheduled items)
    const nextReviewDateStr = nextReviewDate.toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });

    return (
      <div className="min-h-screen pb-20 bg-[#F0F0F0]">
        <PageHeader title={lang === 'fr' ? 'Révisions terminées' : 'Reviews complete'} backHref="/dashboard" />
        <div className="px-4 py-8 max-w-lg mx-auto">
          {/* Micro-réussite celebratory section */}
          <div className="text-center mb-8">
            <div className="w-20 h-20 rounded-full bg-[#D9B438]/20 flex items-center justify-center mx-auto mb-4 animate-pulse">
              <CheckCircle className="h-10 w-10 text-[#D9B438]" />
            </div>
            <h2 className="text-3xl font-bold text-[#002844] mb-1">
              {lang === 'fr' ? '✨ Excellent !' : '✨ Excellent!'}
            </h2>
            <p className="text-sm text-[#555555] mb-6 italic">
              {lang === 'fr'
                ? 'Tu renforces ta mémoire à chaque session.'
                : 'You strengthen your memory with every session.'}
            </p>
          </div>

          {/* Session stats grid */}
          <div className="space-y-3 mb-8">
            {/* P1-2: "Mots révisés" instead of "Items réussis" */}
            <div className="bg-white rounded-xl p-4 border-l-4 border-green-500">
              <p className="text-xs text-[#999] font-semibold uppercase tracking-wide mb-1">
                {lang === 'fr' ? 'Mots révisés avec succès' : 'Words reviewed successfully'}
              </p>
              <p className="text-2xl font-bold text-green-600">{correctCount}/{totalCount}</p>
              <p className="text-xs text-[#555] mt-1">
                {lang === 'fr'
                  ? "Ces mots sont renforcés dans ta mémoire."
                  : "These words are reinforced in your memory."}
              </p>
            </div>

            {/* P1-2: Reprogrammed wording */}
            {reprogrammedCount > 0 && (
              <div className="bg-white rounded-xl p-4 border-l-4 border-orange-500">
                <p className="text-xs text-[#999] font-semibold uppercase tracking-wide mb-1">
                  {lang === 'fr' ? 'Mots à retravailler' : 'Words to review again'}
                </p>
                <p className="text-2xl font-bold text-orange-600">{reprogrammedCount}</p>
                <p className="text-xs text-[#555] mt-1">
                  {lang === 'fr'
                    ? `Prochaine révision : ${nextReviewDateStr}`
                    : `Next review: ${nextReviewDateStr}`}
                </p>
              </div>
            )}

            {/* P1-2: Coach encouragement message */}
            <div className="bg-white rounded-xl p-4 border-l-4 border-purple-400">
              <p className="text-xs text-[#999] font-semibold uppercase tracking-wide mb-1">
                🤖 Coach
              </p>
              <p className="text-sm text-[#002844]">
                {pct >= 80
                  ? (lang === 'fr' ? 'Excellent travail ! Ta mémoire se consolide bien.' : 'Excellent work! Your memory is getting stronger.')
                  : pct >= 50
                    ? (lang === 'fr' ? 'Bonne session ! Continue à réviser régulièrement.' : 'Good session! Keep reviewing regularly.')
                    : (lang === 'fr' ? 'Pas de souci, la répétition est la clé. On y retourne demain !' : "No worries, repetition is key. Let's try again tomorrow!")}
              </p>
            </div>

            {/* Faiblesses identifiées */}
            {weakWords.length > 0 && (
              <div className="bg-white rounded-xl p-4 border-l-4 border-red-400">
                <p className="text-xs text-[#999] font-semibold uppercase tracking-wide mb-2">
                  {lang === 'fr' ? 'Faiblesses identifiées' : 'Areas to focus on'}
                </p>
                <div className="flex flex-wrap gap-2">
                  {weakWords.slice(0, 3).map(w => (
                    <span key={w.id} className="text-xs bg-red-50 text-red-700 px-2 py-1 rounded-lg font-medium">
                      {w.word_target}
                    </span>
                  ))}
                  {weakWords.length > 3 && (
                    <span className="text-xs bg-red-50 text-red-700 px-2 py-1 rounded-lg font-medium">
                      +{weakWords.length - 3}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Points earned */}
            <div className="bg-gradient-to-r from-[#002844] to-[#003d66] rounded-xl p-4 text-white">
              <p className="text-xs font-semibold uppercase tracking-wide mb-1 text-white/60">
                {lang === 'fr' ? 'Points gagnés' : 'Points earned'}
              </p>
              <p className="text-3xl font-bold">+{gameScore} pts</p>
            </div>
          </div>

          {/* Prochaine révision info */}
          <div className="bg-blue-50 rounded-xl p-3 mb-8 flex items-start gap-2">
            <Clock className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-700">
              <p className="font-bold">
                {lang === 'fr'
                  ? `Prochaine révision dans ~${Math.max(1, Math.ceil(upcomingCount / 5))} jours`
                  : `Next review in ~${Math.max(1, Math.ceil(upcomingCount / 5))} days`}
              </p>
              {upcomingNextDate && (
                <p className="text-xs text-blue-600 mt-0.5">
                  {lang === 'fr' ? 'Le ' : 'On '}{upcomingNextDate}
                </p>
              )}
            </div>
          </div>

          {/* Score breakdown */}
          <p className="text-center text-sm text-[#555555] mb-6 font-medium">
            {correctCount}/{totalCount} {lang === 'fr' ? 'bonnes réponses' : 'correct'} ({pct}%)
          </p>

          {/* Actions */}
          <div className="flex gap-3 justify-center">
            <a href="/dashboard"
              className="px-6 py-3 rounded-xl bg-[#002844] text-white font-bold text-sm hover:opacity-90 transition">
              {lang === 'fr' ? 'Retour' : 'Back'}
            </a>
            {dueItems.length > reviewWords.length && (
              <button onClick={() => {
                setCurrentIdx(0);
                setCorrectCount(0);
                setTotalCount(0);
                setSessionResults([]);
                setWeakWords([]);
                setSessionStartTime(new Date());
                setSessionElapsed(0);
                setPhase('exercise');
              }}
                className="px-6 py-3 rounded-xl bg-[#D9B438] text-[#002844] font-bold text-sm hover:opacity-90 transition">
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

  // Format timer display (MM:SS)
  const minutes = Math.floor(sessionElapsed / 60);
  const seconds = sessionElapsed % 60;
  const timerDisplay = `${minutes}:${seconds.toString().padStart(2, '0')}`;

  return (
    <div className="min-h-screen pb-20 bg-[#F0F0F0]">
      <PageHeader title={lang === 'fr' ? 'Révisions' : 'Reviews'} backHref="/dashboard" />

      {/* Progress bar and timer section — BLOC 4 enhanced */}
      <div className="bg-[#002844] px-4 pb-4">
        <div className="max-w-lg mx-auto">
          {/* Main progress bar with counter */}
          <div className="flex items-center gap-3 mb-3">
            <div className="flex-1">
              <div className="h-1.5 w-full bg-white/20 rounded-full">
                <div className="h-full bg-[#D9B438] rounded-full transition-all" style={{ width: `${progressPct}%` }} />
              </div>
            </div>
            <span className="text-xs text-white/60 font-medium whitespace-nowrap">{currentIdx + 1}/{reviewWords.length}</span>
          </div>

          {/* Timer display — soft mode with Clock icon */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-[#D9B438]/70" />
              <span className="text-sm font-semibold text-white/80">{timerDisplay}</span>
            </div>
            <p className="text-xs text-white/50">
              {lang === 'fr' ? '3-5 min' : '3-5 min'}
            </p>
          </div>
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
