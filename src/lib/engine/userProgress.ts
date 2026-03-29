// ==========================================
// LINGUALEARN ENGINE — Couche B : UserProgress
// Architecture V2.1.1 — Progression utilisateur
// Source de vérité unique par langueId
// ==========================================

import type { LearningObjective } from '@/types';
import type {
  LangueId,
  PathId,
  LearningState,
  WordLearningState,
  CourseCompletion,
  ReviewItem,
  EventType,
  EventLogEntry,
} from './types';

// --- EngineProgress : progression par langue ---
export interface EngineProgress {
  userId: string;
  langueId: LangueId;
  pathId: PathId;

  // 3 scores séparés (Aj. 14)
  learningScore: number;   // score certifiant
  gameScore: number;        // gamification
  battleScore: number;      // social

  // Progression par module (0-100)
  modulePercent: Record<LearningObjective, number>;
  moduleMasteryPercent: Record<LearningObjective, number>;

  // Vocabulaire global
  vocabularyPercent: number;
  vocabularyMasteryPercent: number;

  // Coffre
  coffreIndex: Record<string, number>;  // courseId → dernier index vu
  coffreCourseId?: string;               // cours actif dans le coffre

  // Cours complétés
  completedCourses: CourseCompletion[];

  // État des mots (WordLearningState cycle)
  wordStates: Record<string, WordLearningState>;  // wordId → state

  // État des cours (LearningState cycle)
  courseStates: Record<string, LearningState>;  // courseId → state

  // Révisions planifiées (SM-2)
  reviewItems: ReviewItem[];

  // Streak
  streak: number;
  lastActivityDate: string;  // YYYY-MM-DD

  // Daily counters
  dailyWordsCompleted: number;
  dailyExercisesCompleted: number;

  // Event log (Aj. 5 — weakness engine)
  eventLog: EventLogEntry[];

  // Timestamp
  updatedAt: string;
}

// --- Storage key ---
const ENGINE_PROGRESS_KEY = 'lingualearn_engine_progress';

// --- Logging minimal ---
function logProgress(action: string, data?: unknown): void {
  console.log(`[Engine:UserProgress] ${action}`, data ?? '');
}

// --- Créer une progression vide ---
export function createEmptyProgress(userId: string, langueId: LangueId, pathId: PathId): EngineProgress {
  return {
    userId,
    langueId,
    pathId,
    learningScore: 0,
    gameScore: 0,
    battleScore: 0,
    modulePercent: {
      grammaire: 0,
      vocabulaire: 0,
      lecture: 0,
      ecrit: 0,
      oral: 0,
    },
    moduleMasteryPercent: {
      grammaire: 0,
      vocabulaire: 0,
      lecture: 0,
      ecrit: 0,
      oral: 0,
    },
    vocabularyPercent: 0,
    vocabularyMasteryPercent: 0,
    coffreIndex: {},
    completedCourses: [],
    wordStates: {},
    courseStates: {},
    reviewItems: [],
    streak: 0,
    lastActivityDate: '',
    dailyWordsCompleted: 0,
    dailyExercisesCompleted: 0,
    eventLog: [],
    updatedAt: new Date().toISOString(),
  };
}

// --- Clé de stockage composite ---
function storageKey(userId: string, langueId: LangueId): string {
  return `${ENGINE_PROGRESS_KEY}_${userId}_${langueId}`;
}

// --- Lire la progression ---
export function getEngineProgress(userId: string, langueId: LangueId): EngineProgress | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(storageKey(userId, langueId));
    if (!raw) return null;
    const progress = JSON.parse(raw) as EngineProgress;
    logProgress('loaded', { userId, langueId, learningScore: progress.learningScore });
    return progress;
  } catch (e) {
    console.error('[Engine:UserProgress] Failed to load:', e);
    return null;
  }
}

// --- Sauvegarder la progression ---
export function saveEngineProgress(progress: EngineProgress): void {
  if (typeof window === 'undefined') return;
  try {
    progress.updatedAt = new Date().toISOString();
    localStorage.setItem(
      storageKey(progress.userId, progress.langueId),
      JSON.stringify(progress)
    );
    logProgress('saved', { userId: progress.userId, langueId: progress.langueId });
  } catch (e) {
    console.error('[Engine:UserProgress] Failed to save:', e);
  }
}

// --- Obtenir ou créer ---
export function getOrCreateProgress(userId: string, langueId: LangueId, pathId: PathId): EngineProgress {
  const existing = getEngineProgress(userId, langueId);
  if (existing) return existing;

  const progress = createEmptyProgress(userId, langueId, pathId);
  saveEngineProgress(progress);
  logProgress('created', { userId, langueId, pathId });
  return progress;
}

// --- Mettre à jour l'état d'un mot ---
export function updateWordState(
  progress: EngineProgress,
  wordId: string,
  newState: WordLearningState
): EngineProgress {
  const oldState = progress.wordStates[wordId] || 'new';
  if (oldState === newState) return progress;

  logProgress('wordState transition', { wordId, from: oldState, to: newState });

  const updated: EngineProgress = {
    ...progress,
    wordStates: { ...progress.wordStates, [wordId]: newState },
  };

  saveEngineProgress(updated);
  return updated;
}

// --- Mettre à jour l'état d'un cours ---
export function updateCourseState(
  progress: EngineProgress,
  courseId: string,
  newState: LearningState
): EngineProgress {
  const oldState = progress.courseStates[courseId] || 'locked';
  logProgress('courseState transition', { courseId, from: oldState, to: newState });

  const updated: EngineProgress = {
    ...progress,
    courseStates: { ...progress.courseStates, [courseId]: newState },
  };

  saveEngineProgress(updated);
  return updated;
}

// --- Enregistrer une complétion de cours ---
export function recordCourseCompletion(
  progress: EngineProgress,
  courseId: string,
  score: number,
  stars: number
): EngineProgress {
  const completion: CourseCompletion = {
    courseId,
    score,
    stars,
    completedAt: new Date().toISOString(),
  };

  const updated: EngineProgress = {
    ...progress,
    completedCourses: [...progress.completedCourses, completion],
    courseStates: { ...progress.courseStates, [courseId]: 'completed' },
  };

  logProgress('course completed', { courseId, score, stars });
  saveEngineProgress(updated);
  return updated;
}

// --- Mettre à jour coffreIndex ---
export function updateCoffreIndex(
  progress: EngineProgress,
  courseId: string,
  index: number
): EngineProgress {
  const updated: EngineProgress = {
    ...progress,
    coffreIndex: { ...progress.coffreIndex, [courseId]: index },
    coffreCourseId: courseId,
  };

  saveEngineProgress(updated);
  return updated;
}

// --- Logger un événement (Aj. 5 — weakness engine) ---
export function logEvent(
  progress: EngineProgress,
  event: EventType,
  itemId?: string,
  courseId?: string
): EngineProgress {
  const entry: EventLogEntry = {
    userId: progress.userId,
    langueId: progress.langueId,
    event,
    itemId,
    courseId,
    timestamp: new Date().toISOString(),
  };

  // Garder les 500 derniers événements max
  const eventLog = [...progress.eventLog, entry].slice(-500);

  const updated: EngineProgress = {
    ...progress,
    eventLog,
    lastActivityDate: new Date().toISOString().split('T')[0],
  };

  logProgress('event logged', { event, itemId, courseId });
  saveEngineProgress(updated);
  return updated;
}

// --- Calculer les mots faibles (weakness engine) ---
export function getWeakWords(progress: EngineProgress): string[] {
  const failCounts: Record<string, number> = {};
  const recentEvents = progress.eventLog.filter(e => {
    const daysDiff = (Date.now() - new Date(e.timestamp).getTime()) / (1000 * 60 * 60 * 24);
    return daysDiff <= 7 && e.event === 'word_failed';
  });

  for (const e of recentEvents) {
    if (e.itemId) {
      failCounts[e.itemId] = (failCounts[e.itemId] || 0) + 1;
    }
  }

  // Mots échoués 2+ fois dans les 7 derniers jours
  return Object.entries(failCounts)
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => id);
}

// --- Mettre à jour le streak ---
export function updateStreak(progress: EngineProgress): EngineProgress {
  const today = new Date().toISOString().split('T')[0];
  const lastDate = progress.lastActivityDate;

  if (lastDate === today) return progress; // Déjà mis à jour aujourd'hui

  let newStreak = progress.streak;
  if (lastDate) {
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    if (lastDate === yesterday) {
      newStreak += 1;
    } else {
      newStreak = 1; // Reset
    }
  } else {
    newStreak = 1;
  }

  const updated: EngineProgress = {
    ...progress,
    streak: newStreak,
    lastActivityDate: today,
    dailyWordsCompleted: lastDate === today ? progress.dailyWordsCompleted : 0,
    dailyExercisesCompleted: lastDate === today ? progress.dailyExercisesCompleted : 0,
  };

  logProgress('streak updated', { streak: newStreak });
  saveEngineProgress(updated);
  return updated;
}

// --- Recalculer les pourcentages de module ---
export function recalcModulePercents(
  progress: EngineProgress,
  totalWordsByModule: Record<LearningObjective, number>,
  completedWordsByModule: Record<LearningObjective, number>,
  masteredWordsByModule: Record<LearningObjective, number>
): EngineProgress {
  const modulePercent = { ...progress.modulePercent };
  const moduleMasteryPercent = { ...progress.moduleMasteryPercent };

  for (const mod of Object.keys(totalWordsByModule) as LearningObjective[]) {
    const total = totalWordsByModule[mod] || 0;
    modulePercent[mod] = total > 0 ? Math.round((completedWordsByModule[mod] || 0) / total * 100) : 0;
    moduleMasteryPercent[mod] = total > 0 ? Math.round((masteredWordsByModule[mod] || 0) / total * 100) : 0;
  }

  // Vocabulaire global
  const totalWords = Object.values(totalWordsByModule).reduce((a, b) => a + b, 0);
  const completedWords = Object.values(completedWordsByModule).reduce((a, b) => a + b, 0);
  const masteredWords = Object.values(masteredWordsByModule).reduce((a, b) => a + b, 0);

  const updated: EngineProgress = {
    ...progress,
    modulePercent,
    moduleMasteryPercent,
    vocabularyPercent: totalWords > 0 ? Math.round(completedWords / totalWords * 100) : 0,
    vocabularyMasteryPercent: totalWords > 0 ? Math.round(masteredWords / totalWords * 100) : 0,
  };

  saveEngineProgress(updated);
  return updated;
}
