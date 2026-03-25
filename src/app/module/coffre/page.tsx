'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Volume2, Mic, MicOff, CheckCircle, XCircle, ChevronRight } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import { getCurrentUser, updateUserProgress, saveReviewItem } from '@/lib/db/localStorage';
import { User, InterfaceLanguage, LearningLanguage } from '@/types';
import BottomNav from '@/components/BottomNav';
import { getVocabulary, speakText, isCloseEnough, addToPersonalVocab } from '@/lib/db/bankHelpers';
import { VocabWord } from '@/lib/db/bankTypes';

// ==========================================
// BUG-62 (V3.9): COFFRE MOTS DU JOUR
// 5-step pedagogical word learning flow
// Step 1: Discovery (word + audio + translation)
// Step 2: Recognition (listen + QCM)
// Step 3: QCM translation
// Step 4: Oral (pronounce)
// Step 5: Writing (Parcours A only)
// ==========================================

type CoffreStep = 'discovery' | 'recognition' | 'qcm_translation' | 'oral' | 'writing';
type CoffrePhase = 'welcome' | 'learning' | 'summary';

interface WordExercise {
  word: VocabWord;
  step: CoffreStep;
  completed: boolean;
  correct?: boolean;
}

function shuffleArray<T>(arr: T[]): T[] {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export default function CoffrePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [lang, setLang] = useState<InterfaceLanguage>('fr');
  const [activeLang, setActiveLang] = useState<LearningLanguage>('en');
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [isPathB, setIsPathB] = useState(false);
  const [dailyWords, setDailyWords] = useState<VocabWord[]>([]);
  const [exercises, setExercises] = useState<WordExercise[]>([]);
  const [currentExIdx, setCurrentExIdx] = useState(0);
  const [phase, setPhase] = useState<CoffrePhase>('welcome');
  const [loading, setLoading] = useState(true);

  // Exercise state
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [writingInput, setWritingInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [heardText, setHeardText] = useState('');
  const recognitionRef = useRef<any>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    const currentUser = getCurrentUser();
    if (!currentUser) { router.push('/auth'); return; }
    if (!currentUser.onboardingCompleted && currentUser.role !== 'admin') { router.push('/onboarding'); return; }
    setUser(currentUser);
    setLang(currentUser.settings.interfaceLang || 'fr');

    const aLang = (currentUser.activeLang || currentUser.settings.learningLangs[0] || 'en') as LearningLanguage;
    setActiveLang(aLang);

    const config = currentUser.settings.languageConfigs?.[aLang];
    const paths = config?.learningPath;
    const pathB = Array.isArray(paths) ? (paths.includes('B') && !paths.includes('A')) : paths === 'B';
    setIsPathB(pathB);

    const wordsPerDay = currentUser.settings.schedules?.[aLang]?.wordsPerDay || 8;

    // V3.14: Check for saved session to resume
    const savedKey = `lingualearn_coffre_progress_${currentUser.id}_${aLang}`;
    const savedSession = (() => { try { const s = localStorage.getItem(savedKey); return s ? JSON.parse(s) : null; } catch { return null; } })();
    const todayStr = new Date().toISOString().split('T')[0];

    if (savedSession && savedSession.date === todayStr && savedSession.exerciseIndex > 0) {
      // Resume from saved position
      setDailyWords(savedSession.dailyWords || []);
      setExercises(savedSession.exercises || []);
      setCurrentExIdx(savedSession.exerciseIndex);
      setCorrectCount(savedSession.correctCount || 0);
      setTotalCount(savedSession.totalCount || 0);
      setPhase('learning'); // Skip welcome, go straight to exercises
    } else {
      // New session: pick words and build exercises
      const themes = config?.themes || [];
      const allVocab = getVocabulary(aLang, themes, 'A1');
      const shuffled = shuffleArray(allVocab);
      const picked = shuffled.slice(0, Math.min(wordsPerDay, shuffled.length));
      setDailyWords(picked);

      const steps: CoffreStep[] = pathB
        ? ['discovery', 'recognition', 'qcm_translation', 'oral']
        : ['discovery', 'recognition', 'qcm_translation', 'oral', 'writing'];

      const allExercises: WordExercise[] = [];
      for (const step of steps) {
        const stepExercises = picked.map(word => ({
          word,
          step,
          completed: false,
        }));
        allExercises.push(...shuffleArray(stepExercises));
      }
      setExercises(allExercises);
    }

    // Init speech recognition
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
    }

    setLoading(false);
  }, [router]);

  const currentExercise = exercises[currentExIdx];

  // V3.11: Auto TTS in Discovery phase — speak word automatically when displayed
  useEffect(() => {
    if (!currentExercise || currentExercise.step !== 'discovery') return;
    const timer = setTimeout(() => {
      speakText(currentExercise.word.word_target, activeLang);
    }, 300); // small delay for smooth transition
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentExIdx, currentExercise?.step]);

  // Generate distractors for QCM
  const getDistractors = (correct: VocabWord, count: number): string[] => {
    const pool = dailyWords.filter(w => w.id !== correct.id);
    const shuffled = shuffleArray(pool);
    return shuffled.slice(0, count).map(w => w.word_fr);
  };

  const getDistractorsTarget = (correct: VocabWord, count: number): string[] => {
    const pool = dailyWords.filter(w => w.id !== correct.id);
    const shuffled = shuffleArray(pool);
    return shuffled.slice(0, count).map(w => w.word_target);
  };

  // V3.14: Save coffre position to localStorage after each exercise
  const saveCoffrePosition = (nextIdx: number, newCorrect: number, newTotal: number) => {
    if (!user) return;
    const savedKey = `lingualearn_coffre_progress_${user.id}_${activeLang}`;
    const todayStr = new Date().toISOString().split('T')[0];
    try {
      localStorage.setItem(savedKey, JSON.stringify({
        date: todayStr,
        exerciseIndex: nextIdx,
        dailyWords,
        exercises,
        correctCount: newCorrect,
        totalCount: newTotal,
      }));
    } catch { /* ignore storage errors */ }
  };

  // V3.14: Clear coffre saved position (on completion)
  const clearCoffrePosition = () => {
    if (!user) return;
    const savedKey = `lingualearn_coffre_progress_${user.id}_${activeLang}`;
    try { localStorage.removeItem(savedKey); } catch { /* ignore */ }
  };

  // V3.14: Increment dailyWordsCompleted in real-time (called after each scored exercise)
  const incrementDailyWords = () => {
    if (!user) return;
    const progress = user.progress?.[activeLang];
    const todayStr = new Date().toISOString().split('T')[0];
    const lastDay = progress?.lastActivityDate?.split('T')[0];
    const prevWords = (lastDay === todayStr ? progress?.dailyWordsCompleted : 0) || 0;
    updateUserProgress(user.id, activeLang, {
      dailyWordsCompleted: prevWords + 1,
      lastActivityDate: new Date().toISOString(),
    });
    // Update local user state to keep in sync
    const refreshed = getCurrentUser();
    if (refreshed) setUser(refreshed);
  };

  const handleNextExercise = () => {
    setSelectedOption(null);
    setShowFeedback(false);
    setWritingInput('');
    setHeardText('');
    setIsRecording(false);

    if (currentExIdx + 1 >= exercises.length) {
      // Session complete — save final progress & clear saved position
      if (user) {
        // Add all words to personal vocab + spaced repetition
        const scorePct = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0;
        for (const w of dailyWords) {
          addToPersonalVocab(user.id, w.id, 'learned');
          saveReviewItem(user.id, activeLang, w.id, 'word', scorePct);
        }
        clearCoffrePosition();
      }
      setPhase('summary');
    } else {
      const nextIdx = currentExIdx + 1;
      setCurrentExIdx(nextIdx);
      // V3.14: Save position after each advance
      saveCoffrePosition(nextIdx, correctCount, totalCount);
    }
  };

  const handleQCMSelect = (option: string, correctAnswer: string) => {
    if (showFeedback) return;
    setSelectedOption(option);
    const correct = option.toLowerCase().trim() === correctAnswer.toLowerCase().trim();
    setIsCorrect(correct);
    setShowFeedback(true);
    setTotalCount(prev => prev + 1);
    if (correct) {
      setCorrectCount(prev => prev + 1);
      incrementDailyWords(); // V3.14: real-time objective
    }
    setTimeout(handleNextExercise, 1200);
  };

  const handleWritingSubmit = () => {
    if (!currentExercise) return;
    const correct = isCloseEnough(writingInput, currentExercise.word.word_target);
    setIsCorrect(correct);
    setShowFeedback(true);
    setTotalCount(prev => prev + 1);
    if (correct) {
      setCorrectCount(prev => prev + 1);
      incrementDailyWords(); // V3.14: real-time objective
    }
    setTimeout(handleNextExercise, 1200);
  };

  const startRecording = () => {
    if (!recognitionRef.current) return;
    setIsRecording(true);
    setHeardText('');
    recognitionRef.current.lang = activeLang === 'en' ? 'en-US' : activeLang === 'fr' ? 'fr-FR' : activeLang;
    recognitionRef.current.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setHeardText(transcript);
      setIsRecording(false);
      // Check pronunciation
      if (currentExercise) {
        const maxDist = Math.max(1, Math.floor(currentExercise.word.word_target.length * 0.2));
        const correct = isCloseEnough(transcript, currentExercise.word.word_target, maxDist);
        setIsCorrect(correct);
        setShowFeedback(true);
        setTotalCount(prev => prev + 1);
        if (correct) {
          setCorrectCount(prev => prev + 1);
          incrementDailyWords(); // V3.14: real-time objective
        }
        setTimeout(handleNextExercise, 1500);
      }
    };
    recognitionRef.current.onerror = () => { setIsRecording(false); };
    recognitionRef.current.onend = () => { setIsRecording(false); };
    recognitionRef.current.start();
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-[#F0F0F0] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#002844]" />
      </div>
    );
  }

  // WELCOME PHASE — V3.12: Coffre illustration + bouton "Ouvrir"
  if (phase === 'welcome') {
    const wordsCount = dailyWords.length || (user.settings.schedules?.[activeLang]?.wordsPerDay || 8);
    return (
      <div className="min-h-screen bg-[#F0F0F0] pb-20">
        <PageHeader title={lang === 'fr' ? 'Coffre du jour' : 'Daily chest'} backHref="/dashboard" />
        <div className="flex flex-col items-center justify-center px-6 pt-12">
          {/* Coffre illustration SVG */}
          <div className="mb-8">
            <svg viewBox="0 0 200 180" width="200" height="180" fill="none" xmlns="http://www.w3.org/2000/svg">
              {/* Chest body */}
              <rect x="30" y="70" width="140" height="90" rx="12" fill="#8B6914" />
              <rect x="30" y="70" width="140" height="90" rx="12" stroke="#6B4F10" strokeWidth="3" />
              {/* Wood grain lines */}
              <line x1="50" y1="100" x2="150" y2="100" stroke="#6B4F10" strokeWidth="1.5" opacity="0.4" />
              <line x1="50" y1="125" x2="150" y2="125" stroke="#6B4F10" strokeWidth="1.5" opacity="0.4" />
              {/* Chest lid */}
              <path d="M25 75 Q100 20 175 75" fill="#D9B438" stroke="#B8960F" strokeWidth="3" />
              <rect x="30" y="60" width="140" height="20" rx="6" fill="#D9B438" />
              <rect x="30" y="60" width="140" height="20" rx="6" stroke="#B8960F" strokeWidth="2" />
              {/* Lock */}
              <rect x="85" y="72" width="30" height="24" rx="5" fill="#6B4F10" />
              <circle cx="100" cy="82" r="5" fill="#D9B438" />
              <rect x="98" y="82" width="4" height="8" rx="1" fill="#D9B438" />
              {/* Metal corners */}
              <rect x="30" y="70" width="20" height="8" rx="2" fill="#B8960F" />
              <rect x="150" y="70" width="20" height="8" rx="2" fill="#B8960F" />
              <rect x="30" y="148" width="20" height="8" rx="2" fill="#B8960F" />
              <rect x="150" y="148" width="20" height="8" rx="2" fill="#B8960F" />
              {/* Sparkles */}
              <circle cx="45" cy="45" r="3" fill="#D9B438" opacity="0.8" />
              <circle cx="160" cy="35" r="2.5" fill="#D9B438" opacity="0.6" />
              <circle cx="80" cy="30" r="2" fill="#D9B438" opacity="0.7" />
              <circle cx="130" cy="25" r="3" fill="#D9B438" opacity="0.5" />
              <path d="M55 38 l3-8 3 8 -8-5 10 0z" fill="#D9B438" opacity="0.6" />
              <path d="M145 42 l2-6 2 6 -6-4 8 0z" fill="#D9B438" opacity="0.5" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-[#002844] mb-3 text-center">
            {lang === 'fr' ? 'Coffre du jour' : 'Daily Chest'}
          </h1>
          <p className="text-[#555555] text-center mb-8 text-sm max-w-xs">
            {lang === 'fr'
              ? `Ouvre le coffre pour découvrir tes ${wordsCount} mots du jour`
              : `Open the chest to discover your ${wordsCount} words of the day`}
          </p>
          <button onClick={() => setPhase('learning')}
            className="px-10 py-4 rounded-2xl font-bold text-lg shadow-lg active:scale-95 transition-transform"
            style={{ backgroundColor: '#D9B438', color: '#002844' }}>
            {lang === 'fr' ? 'Ouvrir' : 'Open'}
          </button>
        </div>
        <BottomNav lang={lang} />
      </div>
    );
  }

  // SUMMARY PHASE
  if (phase === 'summary') {
    const pct = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0;
    return (
      <div className="min-h-screen bg-[#F0F0F0] px-4 py-6">
        <div className="max-w-lg mx-auto text-center">
          <svg viewBox="0 0 80 72" width="80" height="72" fill="none" className="mx-auto mb-4">
            <rect x="12" y="28" width="56" height="36" rx="5" fill="#8B6914" stroke="#6B4F10" strokeWidth="2" />
            <path d="M10 30 Q40 8 70 30" fill="#D9B438" stroke="#B8960F" strokeWidth="2" />
            <rect x="12" y="24" width="56" height="10" rx="3" fill="#D9B438" stroke="#B8960F" strokeWidth="1.5" />
            <rect x="34" y="29" width="12" height="10" rx="2" fill="#6B4F10" />
            <circle cx="40" cy="33" r="2" fill="#D9B438" />
          </svg>
          <h1 className="text-2xl font-bold text-[#002844] mb-2">
            {lang === 'fr' ? 'Coffre terminé !' : 'Chest complete!'}
          </h1>
          <p className="text-[#555555] mb-6">
            {lang === 'fr'
              ? `${dailyWords.length} mots appris · ${pct}% de réussite`
              : `${dailyWords.length} words learned · ${pct}% success`}
          </p>
          <div className="bg-white rounded-2xl p-6 shadow-sm mb-6">
            <div className="grid grid-cols-2 gap-4">
              {dailyWords.map(w => (
                <div key={w.id} className="text-left">
                  <p className="text-sm font-bold text-[#002844]">{w.word_target}</p>
                  <p className="text-xs text-[#555555]">{w.word_fr}</p>
                </div>
              ))}
            </div>
          </div>
          <button onClick={() => router.push('/dashboard')}
            className="w-full py-3.5 rounded-xl bg-[#002844] text-white font-bold text-sm">
            {lang === 'fr' ? 'Retour au tableau de bord' : 'Back to dashboard'}
          </button>
        </div>
      </div>
    );
  }

  if (!currentExercise) return null;

  const progressPct = Math.round(((currentExIdx + 1) / exercises.length) * 100);
  const word = currentExercise.word;
  const step = currentExercise.step;

  // V3.14: Step label removed from UI but kept for accessibility
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _step = step;

  return (
    <div className="min-h-screen pb-20 bg-[#F0F0F0]">
      {/* V3.10: Standard header identique Profil */}
      <PageHeader title={lang === 'fr' ? 'Coffre du jour' : 'Daily chest'} backHref="/dashboard" />
      {/* Progress bar */}
      <div className="bg-[#002844] px-4 pb-3">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <div className="flex-1">
            {/* V3.14: step label removed — progress bar only */}
            <div className="h-1.5 w-full bg-white/20 rounded-full mt-1">
              <div className="h-full bg-[#D9B438] rounded-full transition-all" style={{ width: `${progressPct}%` }} />
            </div>
          </div>
          <span className="text-xs text-white/60">{currentExIdx + 1}/{exercises.length}</span>
        </div>
      </div>

      {/* Exercise content */}
      <div className="px-4 py-6">
        <div className="max-w-lg mx-auto">

          {/* STEP 1: DISCOVERY */}
          {step === 'discovery' && (
            <div className="text-center">
              <div className="bg-white rounded-2xl p-8 shadow-sm mb-6">
                <p className="text-4xl font-bold text-[#002844] mb-4">{word.word_target}</p>
                <button onClick={() => speakText(word.word_target, activeLang)}
                  className="mx-auto mb-4 w-14 h-14 rounded-full bg-[#002844]/10 flex items-center justify-center hover:bg-[#002844]/20 transition-colors">
                  <Volume2 className="h-6 w-6 text-[#002844]" />
                </button>
                <div className="border-t border-gray-100 pt-4">
                  <p className="text-lg text-[#555555]">{word.word_fr}</p>
                  <p className="text-xs text-[#999] mt-2 uppercase tracking-wide">{word.theme} · {word.level}</p>
                </div>
              </div>
              <button onClick={handleNextExercise}
                className="w-full py-3.5 rounded-xl bg-[#002844] text-white font-bold text-sm flex items-center justify-center gap-2">
                {lang === 'fr' ? 'Continuer' : 'Continue'}
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* STEP 2: RECOGNITION — Listen + QCM */}
          {step === 'recognition' && (() => {
            const distractors = getDistractorsTarget(word, 2);
            const options = shuffleArray([word.word_target, ...distractors]);
            return (
              <div className="text-center">
                <p className="text-sm font-bold text-[#002844] mb-4">
                  {lang === 'fr' ? "Qu'as-tu entendu ?" : 'What did you hear?'}
                </p>
                {/* V3.14: speaker 80px */}
                <button onClick={() => speakText(word.word_target, activeLang)}
                  className="mx-auto mb-6 rounded-full bg-[#002844] flex items-center justify-center hover:bg-[#003a5c] transition-colors shadow-lg"
                  style={{ width: '80px', height: '80px' }}>
                  <Volume2 className="h-8 w-8 text-white" />
                </button>
                {/* V3.14: options 24px min font */}
                <div className="space-y-3">
                  {options.map((opt, i) => {
                    const isSelected = selectedOption === opt;
                    const isAnswer = opt === word.word_target;
                    let btnClass = 'w-full py-3.5 rounded-xl font-bold transition-all ';
                    if (showFeedback) {
                      if (isAnswer) btnClass += 'bg-green-100 text-green-800 border-2 border-green-500';
                      else if (isSelected && !isAnswer) btnClass += 'bg-red-100 text-red-800 border-2 border-red-400';
                      else btnClass += 'bg-white text-[#555555] border border-gray-200';
                    } else {
                      btnClass += isSelected
                        ? 'bg-[#002844] text-white'
                        : 'bg-white text-[#002844] border border-gray-200 hover:border-[#002844]';
                    }
                    return (
                      <button key={i} onClick={() => handleQCMSelect(opt, word.word_target)} className={btnClass} disabled={showFeedback}
                        style={{ fontSize: '24px', minHeight: '56px' }}>
                        {opt}
                      </button>
                    );
                  })}
                </div>
                {showFeedback && (
                  <div className={`mt-4 flex items-center justify-center gap-2 text-sm font-bold ${isCorrect ? 'text-green-600' : 'text-red-600'}`}>
                    {isCorrect ? <CheckCircle className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
                    {isCorrect ? (lang === 'fr' ? 'Correct !' : 'Correct!') : (lang === 'fr' ? `Réponse : ${word.word_target}` : `Answer: ${word.word_target}`)}
                  </div>
                )}
              </div>
            );
          })()}

          {/* STEP 3: QCM TRANSLATION */}
          {step === 'qcm_translation' && (() => {
            const distractors = getDistractors(word, 2);
            const options = shuffleArray([word.word_fr, ...distractors]);
            return (
              <div className="text-center">
                <p className="text-sm font-bold text-[#002844] mb-2">
                  {lang === 'fr' ? 'Quelle est la traduction ?' : 'What is the translation?'}
                </p>
                <p className="text-3xl font-bold text-[#002844] mb-6">{word.word_target}</p>
                {/* V3.14: options 24px min font */}
                <div className="space-y-3">
                  {options.map((opt, i) => {
                    const isSelected = selectedOption === opt;
                    const isAnswer = opt === word.word_fr;
                    let btnClass = 'w-full py-3.5 rounded-xl font-bold transition-all ';
                    if (showFeedback) {
                      if (isAnswer) btnClass += 'bg-green-100 text-green-800 border-2 border-green-500';
                      else if (isSelected && !isAnswer) btnClass += 'bg-red-100 text-red-800 border-2 border-red-400';
                      else btnClass += 'bg-white text-[#555555] border border-gray-200';
                    } else {
                      btnClass += isSelected
                        ? 'bg-[#002844] text-white'
                        : 'bg-white text-[#002844] border border-gray-200 hover:border-[#002844]';
                    }
                    return (
                      <button key={i} onClick={() => handleQCMSelect(opt, word.word_fr)} className={btnClass} disabled={showFeedback}
                        style={{ fontSize: '24px', minHeight: '56px' }}>
                        {opt}
                      </button>
                    );
                  })}
                </div>
                {showFeedback && (
                  <div className={`mt-4 flex items-center justify-center gap-2 text-sm font-bold ${isCorrect ? 'text-green-600' : 'text-red-600'}`}>
                    {isCorrect ? <CheckCircle className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
                    {isCorrect ? (lang === 'fr' ? 'Correct !' : 'Correct!') : (lang === 'fr' ? `Réponse : ${word.word_fr}` : `Answer: ${word.word_fr}`)}
                  </div>
                )}
              </div>
            );
          })()}

          {/* STEP 4: ORAL — Pronounce */}
          {step === 'oral' && (
            <div className="text-center">
              <p className="text-sm font-bold text-[#002844] mb-2">
                {lang === 'fr' ? 'Prononcez ce mot :' : 'Pronounce this word:'}
              </p>
              <p className="text-3xl font-bold text-[#002844] mb-2">{word.word_target}</p>
              <button onClick={() => speakText(word.word_target, activeLang)}
                className="mx-auto mb-6 text-xs text-[#002844]/60 flex items-center gap-1 hover:text-[#002844]">
                <Volume2 className="h-3.5 w-3.5" /> {lang === 'fr' ? 'Écouter' : 'Listen'}
              </button>
              <button onClick={startRecording} disabled={isRecording || showFeedback}
                className={`mx-auto w-20 h-20 rounded-full flex items-center justify-center shadow-lg transition-all ${
                  isRecording ? 'bg-red-500 animate-pulse' : showFeedback ? 'bg-gray-300' : 'bg-[#002844] hover:bg-[#003a5c]'
                }`}>
                {isRecording ? <MicOff className="h-8 w-8 text-white" /> : <Mic className="h-8 w-8 text-white" />}
              </button>
              {heardText && (
                <p className="mt-4 text-sm text-[#555555]">
                  {lang === 'fr' ? 'Entendu : ' : 'Heard: '}<span className="font-bold">{heardText}</span>
                </p>
              )}
              {showFeedback && (
                <div className={`mt-4 flex items-center justify-center gap-2 text-sm font-bold ${isCorrect ? 'text-green-600' : 'text-red-600'}`}>
                  {isCorrect ? <CheckCircle className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
                  {isCorrect ? (lang === 'fr' ? 'Bien prononcé !' : 'Well pronounced!') : (lang === 'fr' ? `Attendu : ${word.word_target}` : `Expected: ${word.word_target}`)}
                </div>
              )}
              {!isRecording && !showFeedback && (
                <p className="mt-4 text-xs text-[#999]">
                  {lang === 'fr' ? 'Appuyez sur le micro pour enregistrer' : 'Tap the mic to record'}
                </p>
              )}
            </div>
          )}

          {/* STEP 5: WRITING (Parcours A only) */}
          {step === 'writing' && (
            <div className="text-center">
              <p className="text-sm font-bold text-[#002844] mb-2">
                {lang === 'fr' ? 'Écrivez le mot entendu :' : 'Write the word you hear:'}
              </p>
              {/* V3.14: speaker 80px */}
              <button onClick={() => speakText(word.word_target, activeLang)}
                className="mx-auto mb-6 rounded-full bg-[#002844] flex items-center justify-center hover:bg-[#003a5c] transition-colors shadow-lg"
                style={{ width: '80px', height: '80px' }}>
                <Volume2 className="h-8 w-8 text-white" />
              </button>
              <input
                type="text"
                value={writingInput}
                onChange={e => setWritingInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && writingInput.trim()) handleWritingSubmit(); }}
                placeholder={lang === 'fr' ? 'Tapez le mot ici...' : 'Type the word here...'}
                disabled={showFeedback}
                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 text-center text-lg font-bold text-[#002844] focus:border-[#002844] focus:outline-none mb-4"
                autoFocus
              />
              {!showFeedback && writingInput.trim() && (
                <button onClick={handleWritingSubmit}
                  className="w-full py-3.5 rounded-xl bg-[#002844] text-white font-bold text-sm">
                  {lang === 'fr' ? 'Valider' : 'Submit'}
                </button>
              )}
              {showFeedback && (
                <div className={`mt-2 flex items-center justify-center gap-2 text-sm font-bold ${isCorrect ? 'text-green-600' : 'text-red-600'}`}>
                  {isCorrect ? <CheckCircle className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
                  {isCorrect ? (lang === 'fr' ? 'Correct !' : 'Correct!') : (lang === 'fr' ? `Réponse : ${word.word_target}` : `Answer: ${word.word_target}`)}
                </div>
              )}
            </div>
          )}

        </div>
      </div>
      <BottomNav lang={lang} />
    </div>
  );
}
