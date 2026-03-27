'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Volume2, Mic, MicOff, CheckCircle, XCircle, ChevronRight } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import { getCurrentUser, updateUserProgress, saveReviewItem } from '@/lib/db/localStorage';
import { User, InterfaceLanguage, LearningLanguage } from '@/types';
import BottomNav from '@/components/BottomNav';
import { getVocabulary, speakText, isCloseEnough, addToPersonalVocab } from '@/lib/db/bankHelpers';
import { getA1CourseVocabulary } from '@/lib/db/bankA1Courses';
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
type CoffrePhase = 'learning' | 'self_eval' | 'summary'; // V3.15: 'welcome' removed, BUG-84: self_eval added

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

function CoffreContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const courseIdParam = searchParams.get('courseId');
  const [user, setUser] = useState<User | null>(null);
  const [lang, setLang] = useState<InterfaceLanguage>('fr');
  const [activeLang, setActiveLang] = useState<LearningLanguage>('en');
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [isPathB, setIsPathB] = useState(false);
  const [dailyWords, setDailyWords] = useState<VocabWord[]>([]);
  const [exercises, setExercises] = useState<WordExercise[]>([]);
  const [currentExIdx, setCurrentExIdx] = useState(0);
  // V3.15: Skip welcome phase — launch exercises directly
  const [phase, setPhase] = useState<CoffrePhase>('learning');
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
  // BUG-84: Self-evaluation per word
  const [wordRatings, setWordRatings] = useState<Record<string, 'easy' | 'medium' | 'hard'>>({});

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
      setPhase('learning'); // Resume saved session
    } else {
      // V3.20: Use course-specific vocabulary if courseId is a real A1 course
      const isA1Course = courseIdParam && /^a1_c\d+$/.test(courseIdParam);
      const allVocab = isA1Course
        ? getA1CourseVocabulary(courseIdParam)
        : getVocabulary(aLang, config?.themes || [], 'A1');
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
      setPhase('learning'); // V3.15: Direct start, no welcome
    }

    // Init speech recognition
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
    }

    setLoading(false);
  }, [router]);

  const currentExercise = exercises[currentExIdx];

  // V3.16 BUG-61: TTS auto-play on every discovery word display
  useEffect(() => {
    if (!currentExercise || currentExercise.step !== 'discovery') return;
    const timer = setTimeout(() => {
      speakText(currentExercise.word.word_target, activeLang);
    }, 400);
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

  // V3.15: Use refs for reliable save (avoids stale closure issues)
  const correctCountRef = useRef(correctCount);
  const totalCountRef = useRef(totalCount);
  const currentExIdxRef = useRef(currentExIdx);
  correctCountRef.current = correctCount;
  totalCountRef.current = totalCount;
  currentExIdxRef.current = currentExIdx;

  // V3.15: Save coffre position to localStorage after each exercise
  const saveCoffrePosition = (nextIdx: number) => {
    if (!user) return;
    const savedKey = `lingualearn_coffre_progress_${user.id}_${activeLang}`;
    const todayStr = new Date().toISOString().split('T')[0];
    try {
      localStorage.setItem(savedKey, JSON.stringify({
        date: todayStr,
        exerciseIndex: nextIdx,
        dailyWords,
        exercises,
        correctCount: correctCountRef.current,
        totalCount: totalCountRef.current,
      }));
    } catch { /* ignore storage errors */ }
  };

  // V3.14: Clear coffre saved position (on completion)
  const clearCoffrePosition = () => {
    if (!user) return;
    const savedKey = `lingualearn_coffre_progress_${user.id}_${activeLang}`;
    try { localStorage.removeItem(savedKey); } catch { /* ignore */ }
  };

  // V3.18 BUG-70: Read prevWords fresh from localStorage (not stale component state)
  const incrementDailyWords = () => {
    if (!user) return;
    const todayStr = new Date().toISOString().split('T')[0];
    // Read fresh from localStorage to avoid stale closure
    const freshUser = getCurrentUser();
    const freshProgress = freshUser?.progress?.[activeLang];
    const freshLastDay = freshProgress?.lastActivityDate?.split('T')[0];
    const prevWords = (freshLastDay === todayStr ? freshProgress?.dailyWordsCompleted : 0) || 0;
    updateUserProgress(user.id, activeLang, {
      dailyWordsCompleted: prevWords + 1,
      lastActivityDate: new Date().toISOString(),
    });
  };

  const handleNextExercise = () => {
    setSelectedOption(null);
    setShowFeedback(false);
    setWritingInput('');
    setHeardText('');
    setIsRecording(false);

    if (currentExIdx + 1 >= exercises.length) {
      // BUG-84: Go to self-evaluation before summary
      setPhase('self_eval');
    } else {
      const nextIdx = currentExIdx + 1;
      setCurrentExIdx(nextIdx);
      // V3.15: Save position after each advance (uses refs for fresh values)
      saveCoffrePosition(nextIdx);
    }
  };

  // BUG-84: Finalize coffre after self-evaluation
  const finalizeCoffre = () => {
    if (user) {
      const scorePct = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0;
      for (const w of dailyWords) {
        // BUG-84: Adjust spaced repetition based on self-evaluation
        const rating = wordRatings[w.id];
        let adjustedScore = scorePct;
        if (rating === 'easy') adjustedScore = Math.max(adjustedScore, 90); // Push to J+7
        if (rating === 'hard') adjustedScore = Math.min(adjustedScore, 50); // Push to J+1
        addToPersonalVocab(user.id, w.id, 'learned');
        saveReviewItem(user.id, activeLang, w.id, 'word', adjustedScore);
      }
      clearCoffrePosition();

      try {
        const todayStr = new Date().toISOString().split('T')[0];
        localStorage.setItem(`lingualearn_coffre_done_today_${user.id}`, todayStr);
      } catch { /* ignore */ }

      try {
        const freshUser = getCurrentUser();
        const freshProgress = freshUser?.progress?.[activeLang];
        const currentObjProgress = freshProgress?.objectiveProgress || {} as Record<string, number>;
        const currentVocab = (currentObjProgress as Record<string, number>).vocabulaire || 0;
        const increment = dailyWords.length * 5;
        updateUserProgress(user.id, activeLang, {
          objectiveProgress: {
            ...currentObjProgress,
            vocabulaire: Math.min(100, currentVocab + increment),
          },
        });
      } catch { /* ignore */ }
    }
    setPhase('summary');
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

  // V3.15: Welcome phase removed — exercises start directly

  // BUG-84: SELF-EVALUATION PHASE
  if (phase === 'self_eval') {
    const allRated = dailyWords.every(w => wordRatings[w.id]);
    return (
      <div className="min-h-screen bg-[#F0F0F0] px-4 py-6">
        <PageHeader title={lang === 'fr' ? 'Auto-évaluation' : 'Self-evaluation'} backHref="/dashboard" />
        <div className="max-w-lg mx-auto">
          <h2 className="text-xl font-bold text-[#002844] mb-2 text-center">
            {lang === 'fr' ? 'Comment te sens-tu avec ces mots ?' : 'How do you feel about these words?'}
          </h2>
          <p className="text-sm text-[#555555] mb-6 text-center">
            {lang === 'fr' ? 'Évalue chaque mot pour personnaliser tes révisions' : 'Rate each word to personalize your reviews'}
          </p>
          <div className="space-y-3">
            {dailyWords.map(w => (
              <div key={w.id} className="bg-white rounded-xl p-4 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="font-bold text-[#002844]">{w.word_target}</p>
                    <p className="text-xs text-[#555555]">{w.word_fr}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setWordRatings(prev => ({ ...prev, [w.id]: 'easy' }))}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
                      wordRatings[w.id] === 'easy' ? 'bg-green-500 text-white' : 'bg-green-50 text-green-700 border border-green-200'
                    }`}>
                    🟢 {lang === 'fr' ? 'Facile' : 'Easy'}
                  </button>
                  <button onClick={() => setWordRatings(prev => ({ ...prev, [w.id]: 'medium' }))}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
                      wordRatings[w.id] === 'medium' ? 'bg-yellow-500 text-white' : 'bg-yellow-50 text-yellow-700 border border-yellow-200'
                    }`}>
                    🟡 {lang === 'fr' ? 'Moyen' : 'Medium'}
                  </button>
                  <button onClick={() => setWordRatings(prev => ({ ...prev, [w.id]: 'hard' }))}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
                      wordRatings[w.id] === 'hard' ? 'bg-red-500 text-white' : 'bg-red-50 text-red-700 border border-red-200'
                    }`}>
                    🔴 {lang === 'fr' ? 'Difficile' : 'Hard'}
                  </button>
                </div>
              </div>
            ))}
          </div>
          <button onClick={finalizeCoffre} disabled={!allRated}
            className="w-full mt-6 py-3.5 rounded-xl bg-[#002844] text-white font-bold text-sm disabled:opacity-50 transition-all">
            {allRated
              ? (lang === 'fr' ? 'Terminer le coffre' : 'Finish chest')
              : (lang === 'fr' ? `Évalue tous les mots (${Object.keys(wordRatings).length}/${dailyWords.length})` : `Rate all words (${Object.keys(wordRatings).length}/${dailyWords.length})`)}
          </button>
        </div>
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
                <p className="text-4xl font-bold text-[#002844] mb-1">{word.word_target}</p>
                {/* BUG-75: Phonétique visible sous le mot */}
                {word.phonetic && (
                  <p className="text-sm text-[#D9B438] font-semibold mb-4">/{word.phonetic}/</p>
                )}
                {!word.phonetic && <div className="mb-4" />}
                <button onClick={() => speakText(word.word_target, activeLang)}
                  className="mx-auto mb-4 w-14 h-14 rounded-full bg-[#002844]/10 flex items-center justify-center hover:bg-[#002844]/20 transition-colors">
                  <Volume2 className="h-6 w-6 text-[#002844]" />
                </button>
                <div className="border-t border-gray-100 pt-4">
                  <p className="text-lg text-[#555555]">{word.word_fr}</p>
                  {/* BUG-75 + BUG-87: Image du mot ou placeholder */}
                  <div className="mt-3">
                    {word.image ? (
                      <img src={word.image} alt={word.word_target} className="w-24 h-24 object-cover rounded-lg mx-auto" />
                    ) : (
                      <div className="w-24 h-24 rounded-lg mx-auto bg-gray-100 border-2 border-dashed border-gray-300 flex flex-col items-center justify-center">
                        <svg className="h-8 w-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span className="text-[10px] text-gray-400 mt-1">Image</span>
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-[#999] mt-2 uppercase tracking-wide">{word.theme} · {word.level}</p>
                </div>
              </div>
              {/* BUG-79: Bouton Répéter pour prononcer avant de continuer */}
              <div className="flex gap-3">
                <button onClick={() => {
                  if (recognitionRef.current) {
                    setIsRecording(true);
                    setHeardText('');
                    recognitionRef.current.lang = activeLang === 'en' ? 'en-US' : activeLang === 'fr' ? 'fr-FR' : activeLang;
                    recognitionRef.current.onresult = (event: any) => {
                      const transcript = event.results[0][0].transcript;
                      setHeardText(transcript);
                      setIsRecording(false);
                    };
                    recognitionRef.current.onerror = () => setIsRecording(false);
                    recognitionRef.current.onend = () => setIsRecording(false);
                    recognitionRef.current.start();
                  } else {
                    speakText(word.word_target, activeLang);
                  }
                }}
                  className={`flex-1 py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 ${
                    isRecording ? 'bg-red-500 text-white animate-pulse' : 'bg-[#D9B438] text-[#002844]'
                  }`}>
                  {isRecording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                  {isRecording ? (lang === 'fr' ? 'Écoute...' : 'Listening...') : (lang === 'fr' ? 'Répéter' : 'Repeat')}
                </button>
                <button onClick={() => { incrementDailyWords(); handleNextExercise(); }}
                  className="flex-1 py-3.5 rounded-xl bg-[#002844] text-white font-bold text-sm flex items-center justify-center gap-2">
                  {lang === 'fr' ? 'Continuer' : 'Continue'}
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
              {heardText && (
                <p className="mt-3 text-sm text-center text-[#555555]">
                  {lang === 'fr' ? 'Entendu : ' : 'Heard: '}<span className="font-bold text-[#002844]">{heardText}</span>
                </p>
              )}
            </div>
          )}

          {/* STEP 2: RECOGNITION — Listen + QCM */}
          {step === 'recognition' && (() => {
            const distractors = getDistractorsTarget(word, 2);
            const options = shuffleArray([word.word_target, ...distractors]);
            return (
              <div className="text-center">
                {/* V3.16: question 28px bold */}
                <p className="font-bold text-[#002844] mb-4" style={{ fontSize: '28px' }}>
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
                        style={{ fontSize: '20px', minHeight: '52px' }}>
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
                {/* V3.16: question 28px bold */}
                <p className="font-bold text-[#002844] mb-2" style={{ fontSize: '28px' }}>
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
                        style={{ fontSize: '20px', minHeight: '52px' }}>
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
              {/* V3.16: question 28px bold */}
              <p className="font-bold text-[#002844] mb-2" style={{ fontSize: '28px' }}>
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
              {/* V3.16: question 28px bold */}
              <p className="font-bold text-[#002844] mb-2" style={{ fontSize: '28px' }}>
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

// Wrap in Suspense for useSearchParams
export default function CoffrePage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center bg-[#F0F0F0]">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-[#002844]" />
      </div>
    }>
      <CoffreContent />
    </Suspense>
  );
}
