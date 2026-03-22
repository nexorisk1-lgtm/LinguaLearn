'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentUser } from '@/lib/db/localStorage';
import { User, InterfaceLanguage, LearningLanguage } from '@/types';
import { getVocabulary } from '@/lib/db/bankHelpers';
import { MatchingExercise } from '@/components/exercises/MatchingExercise';
import { TransitionScreen } from '@/components/exercises/TransitionScreen';

interface CourseProgress {
  mots: { stars: number; completed: boolean };
  grammaire: { stars: number; completed: boolean };
  pratique: { stars: number; completed: boolean };
}

interface ExerciseSession {
  type: 'mots' | 'grammaire' | 'pratique';
  started: boolean;
  exerciseIndex: number;
  score: number;
  startTime: number;
}

export default function CoursPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [interfaceLang, setInterfaceLang] = useState<InterfaceLanguage>('fr');
  const [learningLang, setLearningLang] = useState<LearningLanguage>('en');
  const [progress, setProgress] = useState<CourseProgress>({
    mots: { stars: 0, completed: false },
    grammaire: { stars: 0, completed: false },
    pratique: { stars: 0, completed: false },
  });
  const [exerciseSession, setExerciseSession] = useState<ExerciseSession | null>(null);
  const [showTransition, setShowTransition] = useState(false);
  const [transitionData, setTransitionData] = useState({
    xpGained: 0,
    timeSeconds: 0,
    scorePercent: 0,
  });
  const [currentExercises, setCurrentExercises] = useState<{en: string; fr: string}[]>([]);

  // Load user and progress from localStorage
  useEffect(() => {
    const currentUser = getCurrentUser();
    if (!currentUser) { router.push('/auth'); return; }
    setUser(currentUser);
    setInterfaceLang(currentUser.settings.interfaceLang || 'fr');
    const activeLang = (currentUser.activeLang || currentUser.settings.learningLangs[0] || 'en') as LearningLanguage;
    setLearningLang(activeLang);

    const storageKey = `lingualearn_course_progress_${currentUser.id}_${activeLang}`;
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) setProgress(JSON.parse(stored));
    } catch { /* ignore */ }
  }, [router]);

  // Save progress to localStorage
  const saveProgress = (newProgress: CourseProgress) => {
    if (!user?.id) return;

    const storageKey = `lingualearn_course_progress_${user.id}_${learningLang}`;
    localStorage.setItem(storageKey, JSON.stringify(newProgress));
    setProgress(newProgress);
  };

  const getStars = (scorePercent: number): number => {
    if (scorePercent < 60) return 0;
    if (scorePercent < 80) return 1;
    if (scorePercent < 100) return 2;
    return 3;
  };

  const startSession = (type: 'mots' | 'grammaire' | 'pratique') => {
    // Load vocabulary data
    const words = getVocabulary(learningLang, [], 'B2');

    // Create 5 exercise pairs
    const exercises = words.slice(0, 5).map((word) => ({
      en: word.word_target,
      fr: word.word_fr,
    }));

    setCurrentExercises(exercises);
    setExerciseSession({
      type,
      started: true,
      exerciseIndex: 0,
      score: 0,
      startTime: Date.now(),
    });
  };

  const handleExerciseComplete = (exerciseScore: number) => {
    if (!exerciseSession) return;

    const newScore = exerciseSession.score + (exerciseScore === 100 ? 1 : 0);

    setExerciseSession({
      ...exerciseSession,
      exerciseIndex: exerciseSession.exerciseIndex + 1,
      score: newScore,
    });

    // Check if all 5 exercises are done
    if (exerciseSession.exerciseIndex + 1 >= 5) {
      const timeSeconds = Math.floor((Date.now() - exerciseSession.startTime) / 1000);
      const scorePercent = (newScore / 5) * 100;
      const xpGained = newScore * 20; // 20 XP per correct answer

      setTransitionData({
        xpGained,
        timeSeconds,
        scorePercent,
      });

      setShowTransition(true);

      // Save progress
      const stars = getStars(scorePercent);
      const updatedProgress = {
        ...progress,
        [exerciseSession.type]: {
          stars,
          completed: true,
        },
      };

      saveProgress(updatedProgress);
    }
  };

  const handleContinue = () => {
    setShowTransition(false);
    setExerciseSession(null);
  };

  const renderStars = (count: number) => {
    return Array.from({ length: 3 }).map((_, idx) => (
      <span key={idx} className={`text-2xl ${idx < count ? 'text-[#D9B438]' : 'text-gray-300'}`}>
        ⭐
      </span>
    ));
  };

  const sectionLabels = {
    mots: interfaceLang === 'fr' ? 'Mots' : 'Vocabulary',
    grammaire: interfaceLang === 'fr' ? 'Grammaire' : 'Grammar',
    pratique: interfaceLang === 'fr' ? 'Pratique' : 'Practice',
  };

  // During exercise
  if (exerciseSession?.started && !showTransition && currentExercises.length > 0) {
    return (
      <div className="w-full h-screen flex flex-col bg-[#F0F0F0] p-6">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => setExerciseSession(null)}
            className="text-[#002844] font-bold hover:text-[#D9B438]"
          >
            ← {interfaceLang === 'fr' ? 'Retour' : 'Back'}
          </button>
          <h1 className="text-2xl font-bold text-[#002844]">
            {sectionLabels[exerciseSession.type]} - Exercice {exerciseSession.exerciseIndex + 1}/5
          </h1>
          <div />
        </div>

        <MatchingExercise
          words={[currentExercises[exerciseSession.exerciseIndex]]}
          onComplete={handleExerciseComplete}
        />
      </div>
    );
  }

  // During transition
  if (showTransition) {
    return (
      <TransitionScreen
        xpGained={transitionData.xpGained}
        timeSeconds={transitionData.timeSeconds}
        scorePercent={transitionData.scorePercent}
        onContinue={handleContinue}
        lang={interfaceLang}
      />
    );
  }

  // Main course view
  return (
    <div className="w-full min-h-screen bg-[#F0F0F0] p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.back()}
            className="text-[#002844] font-bold hover:text-[#D9B438] mb-4"
          >
            ← {interfaceLang === 'fr' ? 'Retour' : 'Back'}
          </button>
          <h1 className="text-4xl font-bold text-[#002844]">
            {interfaceLang === 'fr' ? 'Cours' : 'Course'}
          </h1>
        </div>

        {/* Course Sections */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Mots Section */}
          <button
            onClick={() => startSession('mots')}
            className="group flex flex-col items-center gap-4 p-8 bg-white rounded-lg border-2 border-[#002844] hover:border-[#D9B438] hover:shadow-lg active:scale-95 transition-all"
          >
            <div className="text-5xl">📚</div>
            <h2 className="text-2xl font-bold text-[#002844] group-hover:text-[#D9B438]">
              {sectionLabels.mots}
            </h2>
            <p className="text-sm text-gray-600 text-center">
              {interfaceLang === 'fr'
                ? 'Apprenez et pratiquez le vocabulaire'
                : 'Learn and practice vocabulary'}
            </p>
            <div className="flex gap-2 mt-4">
              {renderStars(progress.mots.stars)}
            </div>
            <p className="text-xs text-gray-500">
              {progress.mots.completed
                ? interfaceLang === 'fr'
                  ? 'Complété'
                  : 'Completed'
                : interfaceLang === 'fr'
                  ? 'Non commencé'
                  : 'Not started'}
            </p>
          </button>

          {/* Grammaire Section */}
          <button
            onClick={() => startSession('grammaire')}
            className="group flex flex-col items-center gap-4 p-8 bg-white rounded-lg border-2 border-[#002844] hover:border-[#D9B438] hover:shadow-lg active:scale-95 transition-all"
          >
            <div className="text-5xl">📝</div>
            <h2 className="text-2xl font-bold text-[#002844] group-hover:text-[#D9B438]">
              {sectionLabels.grammaire}
            </h2>
            <p className="text-sm text-gray-600 text-center">
              {interfaceLang === 'fr'
                ? 'Maîtrisez les règles grammaticales'
                : 'Master grammar rules'}
            </p>
            <div className="flex gap-2 mt-4">
              {renderStars(progress.grammaire.stars)}
            </div>
            <p className="text-xs text-gray-500">
              {progress.grammaire.completed
                ? interfaceLang === 'fr'
                  ? 'Complété'
                  : 'Completed'
                : interfaceLang === 'fr'
                  ? 'Non commencé'
                  : 'Not started'}
            </p>
          </button>

          {/* Pratique Section */}
          <button
            onClick={() => startSession('pratique')}
            className="group flex flex-col items-center gap-4 p-8 bg-white rounded-lg border-2 border-[#002844] hover:border-[#D9B438] hover:shadow-lg active:scale-95 transition-all"
          >
            <div className="text-5xl">🎯</div>
            <h2 className="text-2xl font-bold text-[#002844] group-hover:text-[#D9B438]">
              {sectionLabels.pratique}
            </h2>
            <p className="text-sm text-gray-600 text-center">
              {interfaceLang === 'fr'
                ? 'Exercices variés et amusants'
                : 'Varied and fun exercises'}
            </p>
            <div className="flex gap-2 mt-4">
              {renderStars(progress.pratique.stars)}
            </div>
            <p className="text-xs text-gray-500">
              {progress.pratique.completed
                ? interfaceLang === 'fr'
                  ? 'Complété'
                  : 'Completed'
                : interfaceLang === 'fr'
                  ? 'Non commencé'
                  : 'Not started'}
            </p>
          </button>
        </div>

        {/* Progress Summary */}
        <div className="mt-12 p-6 bg-white rounded-lg border-2 border-[#002844]">
          <h3 className="text-lg font-bold text-[#002844] mb-4">
            {interfaceLang === 'fr' ? 'Résumé du cours' : 'Course Summary'}
          </h3>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-3xl font-bold text-[#D9B438]">
                {progress.mots.stars + progress.grammaire.stars + progress.pratique.stars}
              </p>
              <p className="text-sm text-gray-600">
                {interfaceLang === 'fr' ? 'Étoiles gagnées' : 'Stars earned'}
              </p>
            </div>
            <div>
              <p className="text-3xl font-bold text-[#D9B438]">
                {[progress.mots.completed, progress.grammaire.completed, progress.pratique.completed].filter(Boolean).length}
              </p>
              <p className="text-sm text-gray-600">
                {interfaceLang === 'fr' ? 'Sections complétées' : 'Sections completed'}
              </p>
            </div>
            <div>
              <p className="text-3xl font-bold text-[#D9B438]">
                {Math.round(((progress.mots.stars + progress.grammaire.stars + progress.pratique.stars) / 9) * 100)}%
              </p>
              <p className="text-sm text-gray-600">
                {interfaceLang === 'fr' ? 'Progression' : 'Progress'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
