// ==========================================
// LINGUALEARN ENGINE — GamificationEngine
// Architecture V2.1.1 — 3 scores + anti-farming
// Barème Section 13 du document V2.1.1
// ==========================================

import type { LangueId } from './types';
import type { EngineProgress } from './userProgress';
import { saveEngineProgress } from './userProgress';

// --- Types ---
export type ScoreType = 'learningScore' | 'gameScore' | 'battleScore';
export type ActivityType =
  | 'course_completed'
  | 'word_learned'
  | 'word_mastered'
  | 'exercise_correct'
  | 'streak_bonus'
  | 'revision_completed'
  | 'battle_won'
  | 'battle_participated';

// --- Barème de points ---
const POINT_TABLE: Record<ActivityType, { learningScore: number; gameScore: number; battleScore: number }> = {
  course_completed:     { learningScore: 50, gameScore: 30, battleScore: 0 },
  word_learned:         { learningScore: 5,  gameScore: 3,  battleScore: 0 },
  word_mastered:        { learningScore: 10, gameScore: 5,  battleScore: 0 },
  exercise_correct:     { learningScore: 3,  gameScore: 2,  battleScore: 0 },
  streak_bonus:         { learningScore: 0,  gameScore: 10, battleScore: 0 },
  revision_completed:   { learningScore: 8,  gameScore: 5,  battleScore: 0 },
  battle_won:           { learningScore: 0,  gameScore: 15, battleScore: 25 },
  battle_participated:  { learningScore: 0,  gameScore: 5,  battleScore: 5 },
};

// --- Anti-farming config ---
const ANTI_FARMING = {
  REPEAT_PENALTY_HOURS: 24,
  REPEAT_PENALTY_FACTOR: 0.5, // 50% réduction
  FREE_MODE_SCORING: false,    // Mode libre hors classement
};

// --- Logging ---
function logGamification(action: string, data?: unknown): void {
  console.log(`[Engine:GamificationEngine] ${action}`, data ?? '');
}

// --- Vérifier anti-farming : même exercice dans les 24h ---
function isRecentRepeat(progress: EngineProgress, itemId: string): boolean {
  const cutoff = Date.now() - ANTI_FARMING.REPEAT_PENALTY_HOURS * 60 * 60 * 1000;
  return progress.eventLog.some(
    e =>
      e.itemId === itemId &&
      (e.event === 'word_correct' || e.event === 'course_completed') &&
      new Date(e.timestamp).getTime() > cutoff
  );
}

// --- Attribuer des points ---
export function awardPoints(
  progress: EngineProgress,
  activity: ActivityType,
  itemId?: string,
  isFreeMode: boolean = false
): EngineProgress {
  // Mode libre → pas de scoring
  if (isFreeMode && !ANTI_FARMING.FREE_MODE_SCORING) {
    logGamification('awardPoints:freeMode:skipped', { activity });
    return progress;
  }

  const base = POINT_TABLE[activity];
  if (!base) {
    console.error(`[Engine:GamificationEngine] Unknown activity: ${activity}`);
    return progress;
  }

  // Anti-farming : réduction si répétition récente
  let factor = 1;
  if (itemId && isRecentRepeat(progress, itemId)) {
    factor = ANTI_FARMING.REPEAT_PENALTY_FACTOR;
    logGamification('awardPoints:antifarming', { activity, itemId, factor });
  }

  const updated: EngineProgress = {
    ...progress,
    learningScore: progress.learningScore + Math.round(base.learningScore * factor),
    gameScore: progress.gameScore + Math.round(base.gameScore * factor),
    battleScore: progress.battleScore + Math.round(base.battleScore * factor),
  };

  logGamification('awardPoints', {
    activity,
    added: {
      learning: Math.round(base.learningScore * factor),
      game: Math.round(base.gameScore * factor),
      battle: Math.round(base.battleScore * factor),
    },
    totals: {
      learning: updated.learningScore,
      game: updated.gameScore,
      battle: updated.battleScore,
    },
  });

  saveEngineProgress(updated);
  return updated;
}

// --- Obtenir les scores utilisateur ---
export function getUserScore(progress: EngineProgress): {
  learningScore: number;
  gameScore: number;
  battleScore: number;
} {
  return {
    learningScore: progress.learningScore,
    gameScore: progress.gameScore,
    battleScore: progress.battleScore,
  };
}

// --- Classement (placeholder — multi-user en Phase 12) ---
export interface LeaderboardEntry {
  userId: string;
  firstName: string;
  gameScore: number;
  rank: number;
}

export function getLeaderboard(
  langueId: LangueId,
  scope: 'weekly' | 'all_time' = 'weekly'
): LeaderboardEntry[] {
  logGamification('getLeaderboard', { langueId, scope });
  // Phase 12 : implémenter lecture multi-user depuis localStorage
  // Pour l'instant, retourne un tableau vide
  return [];
}

// --- Battle config (Aj. 13 — Phase 13) ---
export type TimerMode = 'none' | 'soft' | 'competitive';

export interface BattleConfig {
  langueId: LangueId;
  level: string;
  timerMode: TimerMode;
  exerciseTypes: ('vocabulary' | 'qcm' | 'matching')[];
  // Règles absolues V.3
  matchmakingRequired: boolean;
  impactsLearningScore: false;  // JAMAIS
  signalFaibleOnly: true;       // Signal faible uniquement
}

export function getBattleConfig(langueId: LangueId, level: string): BattleConfig {
  return {
    langueId,
    level,
    timerMode: 'soft',
    exerciseTypes: ['vocabulary', 'qcm', 'matching'],
    matchmakingRequired: true,
    impactsLearningScore: false,
    signalFaibleOnly: true,
  };
}
