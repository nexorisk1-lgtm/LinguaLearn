'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Volume2, Mic, MicOff, CheckCircle, XCircle, ChevronRight } from 'lucide-react';
import { getCurrentUser, updateUserProgress } from '@/lib/db/localStorage';
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
type CoffrePhase = 'learning' | 'summary';

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

    // Get vocabulary pool and pick daily words
    const themes = config?.themes || [];
    const allVocab = getVocabulary(aLang, themes, 'A1');
    const shuffled = shuffleArray(allVocab);
    const picked = shuffled.slice(0, Math.min(wordsPerDay, shuffled.length));
    setDailyWords(picked);

    // Build exercise sequence: each word goes through multiple steps
    // Parcours A: 5 steps (discovery, recognition, qcm, oral, writing) = 4-5 repetitions
    // Parcours B: 4 steps (discovery, recognition, qcm, oral) = 3 repetitions (no writing)
    const steps: CoffreStep[] = pathB
      ? ['discovery', 'recognition', 'qcm_translation', 'oral']
      : ['discovery', 'recognition', 'qcm_translation', 'oral', 'writing'];

    const allExercises: WordExercise[] = [];
    // Group by step so user does all words in discovery, then all in recognition, etc.
    for (const step of steps) {
      const stepExercises = picked.map(word => ({
        word,
        step,
        completed: false,
      }));
      allExercises.push(...shuffleArray(stepExercises));
    }
    setExercises(allExercises);

    // Init speech recognition
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
    }

    setLoading(false);
  }, [router]);

  const currentExercise = exercises[currentExIdx];

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

  const handleNextExercise = () => {
    setSelectedOption(null);
    setShowFeedback(false);
    setWritingInput('');
    setHeardText('');
    setIsRecording(false);

    if (currentExIdx + 1 >= exercises.length) {
      // Save progress
      if (user) {
        const progress = user.progress?.[activeLang];
        const todayStr = new Date().toISOString().split('T')[0];
        const lastDay = progress?.lastActivityDate?.split('T')[0];
        const prevWords = (lastDay === todayStr ? progress?.dailyWordsCompleted : 0) || 0;
        updateUserProgress(user.id, activeLang, {
          dailyWordsCompleted: prevWords + correctCount,
          lastActivityDate: new Date().toISOString(),
        });
        // Add all words to personal vocab
        for (const w of dailyWords) {
          addToPersonalVocab(user.id, w.id, 'learned');
        }
      }
      setPhase('summary');
    } else {
      setCurrentExIdx(prev => prev + 1);
    }
  };

  const handleQCMSelect = (option: string, correctAnswer: string) => {
    if (showFeedback) return;
    setSelectedOption(option);
    const correct = option.toLowerCase().trim() === correctAnswer.toLowerCase().trim();
    setIsCorrect(correct);
    setShowFeedback(true);
    setTotalCount(prev => prev + 1);
    if (correct) setCorrectCount(prev => prev + 1);
    setTimeout(handleNextExercise, 1200);
  };

  const handleWritingSubmit = () => {
    if (!currentExercise) return;
    const correct = isCloseEnough(writingInput, currentExercise.word.word_target);
    setIsCorrect(correct);
    setShowFeedback(true);
    setTotalCount(prev => prev + 1);
    if (correct) setCorrectCount(prev => prev + 1);
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
        if (correct) setCorrectCount(prev => prev + 1);
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

  // SUMMARY PHASE
  if (phase === 'summary') {
    const pct = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0;
    return (
      <div className="min-h-screen bg-[#F0F0F0] px-4 py-6">
        <div className="max-w-lg mx-auto text-center">
          <div className="text-6xl mb-4">📦</div>
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

  // Step label
  const stepLabel = (() => {
    const labels: Record<CoffreStep, { fr: string; en: string }> = {
      discovery: { fr: 'Découverte', en: 'Discovery' },
      recognition: { fr: 'Reconnaissance', en: 'Recognition' },
      qcm_translation: { fr: 'Traduction', en: 'Translation' },
      oral: { fr: 'Prononciation', en: 'Pronunciation' },
      writing: { fr: 'Écriture', en: 'Writing' },
    };
    return lang === 'fr' ? labels[step].fr : labels[step].en;
  })();

  return (
    <div className="min-h-screen pb-20 bg-[#F0F0F0]">
      {/* Header */}
      <div className="bg-[#002844] px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <button onClick={() => router.push('/dashboard')} className="text-white/70 hover:text-white">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex-1">
            <p className="text-xs text-white/60">{stepLabel}</p>
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
                <button onClick={() => speakText(word.word_target, activeLang)}
                  className="mx-auto mb-6 w-16 h-16 rounded-full bg-[#002844] flex items-center justify-center hover:bg-[#003a5c] transition-colors shadow-lg">
                  <Volume2 className="h-7 w-7 text-white" />
                </button>
                <div className="space-y-3">
                  {options.map((opt, i) => {
                    const isSelected = selectedOption === opt;
                    const isAnswer = opt === word.word_target;
                    let btnClass = 'w-full py-3.5 rounded-xl text-sm font-bold transition-all ';
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
                      <button key={i} onClick={() => handleQCMSelect(opt, word.word_target)} className={btnClass} disabled={showFeedback}>
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
                <div className="space-y-3">
                  {options.map((opt, i) => {
                    const isSelected = selectedOption === opt;
                    const isAnswer = opt === word.word_fr;
                    let btnClass = 'w-full py-3.5 rounded-xl text-sm font-bold transition-all ';
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
                      <button key={i} onClick={() => handleQCMSelect(opt, word.word_fr)} className={btnClass} disabled={showFeedback}>
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
              <button onClick={() => speakText(word.word_target, activeLang)}
                className="mx-auto mb-6 w-16 h-16 rounded-full bg-[#002844] flex items-center justify-center hover:bg-[#003a5c] transition-colors shadow-lg">
                <Volume2 className="h-7 w-7 text-white" />
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
