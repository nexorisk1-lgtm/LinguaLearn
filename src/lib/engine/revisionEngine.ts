// ==========================================
// LINGUALEARN ENGINE — RevisionEngine
// Architecture V2.1.1 — Système de révision SM-2
// <70% → J+1, 70-89% → J+3, ≥90% → J+7
// ==========================================

import type { ReviewItem } from './types';
import type { EngineProgress } from './userProgress';
import { saveEngineProgress } from './userProgress';

// --- SM-2 intervals ---
const SM2_INTERVALS = {
  FAIL: 1,       // <70% → revoir dans 1 jour
  PASS: 3,       // 70-89% → revoir dans 3 jours
  EXCELLENT: 7,  // ≥90% → revoir dans 7 jours
} as const;

// --- Logging ---
function logRevision(action: string, data?: unknown): void {
  console.log(`[Engine:RevisionEngine] ${action}`, data ?? '');
}

// --- Calculer la prochaine date de révision ---
function getNextReviewDate(score: number): string {
  let daysToAdd: number;
  if (score < 70) {
    daysToAdd = SM2_INTERVALS.FAIL;
  } else if (score < 90) {
    daysToAdd = SM2_INTERVALS.PASS;
  } else {
    daysToAdd = SM2_INTERVALS.EXCELLENT;
  }

  const next = new Date();
  next.setDate(next.getDate() + daysToAdd);
  return next.toISOString().split('T')[0];
}

// --- Obtenir les révisions dues ---
export function getDueRevisions(progress: EngineProgress): ReviewItem[] {
  const today = new Date().toISOString().split('T')[0];
  const due = progress.reviewItems.filter(r => r.nextReviewDate <= today);

  logRevision('getDueRevisions', {
    langueId: progress.langueId,
    total: progress.reviewItems.length,
    due: due.length,
  });

  return due.sort((a, b) => a.nextReviewDate.localeCompare(b.nextReviewDate));
}

// --- Obtenir la file de révision (triée par priorité) ---
export function getRevisionQueue(
  progress: EngineProgress,
  limit: number = 20
): ReviewItem[] {
  const due = getDueRevisions(progress);

  // Prioriser : plus ancien d'abord, puis plus bas score
  const sorted = due.sort((a, b) => {
    if (a.nextReviewDate !== b.nextReviewDate) {
      return a.nextReviewDate.localeCompare(b.nextReviewDate);
    }
    return a.lastScore - b.lastScore;
  });

  return sorted.slice(0, limit);
}

// --- Résumé des révisions ---
export interface RevisionSummary {
  totalItems: number;
  dueToday: number;
  dueThisWeek: number;
  averageScore: number;
  weakestItems: ReviewItem[];
}

export function getRevisionSummary(progress: EngineProgress): RevisionSummary {
  const today = new Date().toISOString().split('T')[0];
  const weekFromNow = new Date();
  weekFromNow.setDate(weekFromNow.getDate() + 7);
  const weekStr = weekFromNow.toISOString().split('T')[0];

  const dueToday = progress.reviewItems.filter(r => r.nextReviewDate <= today).length;
  const dueThisWeek = progress.reviewItems.filter(r => r.nextReviewDate <= weekStr).length;

  const scores = progress.reviewItems.map(r => r.lastScore);
  const averageScore = scores.length > 0
    ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
    : 0;

  // Top 5 items les plus faibles
  const weakestItems = [...progress.reviewItems]
    .sort((a, b) => a.lastScore - b.lastScore)
    .slice(0, 5);

  const summary: RevisionSummary = {
    totalItems: progress.reviewItems.length,
    dueToday,
    dueThisWeek,
    averageScore,
    weakestItems,
  };

  logRevision('getRevisionSummary', summary);
  return summary;
}

// --- Enregistrer un résultat de révision ---
export function recordRevisionResult(
  progress: EngineProgress,
  itemId: string,
  itemType: 'word' | 'grammar' | 'oral',
  score: number,
  courseId: string
): EngineProgress {
  const nextReviewDate = getNextReviewDate(score);
  const existingIdx = progress.reviewItems.findIndex(r => r.itemId === itemId);

  let updatedItems: ReviewItem[];

  if (existingIdx >= 0) {
    // Mise à jour existant
    const existing = progress.reviewItems[existingIdx];
    const updated: ReviewItem = {
      ...existing,
      lastScore: score,
      nextReviewDate,
      reviewCount: existing.reviewCount + 1,
      consecutiveSuccesses: score >= 70 ? existing.consecutiveSuccesses + 1 : 0,
    };
    updatedItems = [...progress.reviewItems];
    updatedItems[existingIdx] = updated;

    logRevision('recordRevisionResult:updated', {
      itemId,
      score,
      nextReviewDate,
      consecutiveSuccesses: updated.consecutiveSuccesses,
    });
  } else {
    // Nouveau review item
    const newItem: ReviewItem = {
      itemId,
      itemType,
      langueId: progress.langueId,
      courseId,
      lastScore: score,
      nextReviewDate,
      reviewCount: 1,
      consecutiveSuccesses: score >= 70 ? 1 : 0,
    };
    updatedItems = [...progress.reviewItems, newItem];

    logRevision('recordRevisionResult:created', { itemId, score, nextReviewDate });
  }

  const updatedProgress: EngineProgress = {
    ...progress,
    reviewItems: updatedItems,
  };

  saveEngineProgress(updatedProgress);
  return updatedProgress;
}

// --- Supprimer un item maîtrisé (≥90% 3 fois consécutives) ---
export function pruneReviewItems(progress: EngineProgress): EngineProgress {
  const MASTERY_THRESHOLD = 3; // 3 succès consécutifs ≥90%

  const pruned = progress.reviewItems.filter(r => {
    if (r.consecutiveSuccesses >= MASTERY_THRESHOLD && r.lastScore >= 90) {
      logRevision('pruneReviewItems:mastered', { itemId: r.itemId });
      return false; // Retirer
    }
    return true;
  });

  if (pruned.length === progress.reviewItems.length) return progress;

  const updated: EngineProgress = {
    ...progress,
    reviewItems: pruned,
  };

  saveEngineProgress(updated);
  return updated;
}
