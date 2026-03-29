// ==========================================
// LINGUALEARN ENGINE — Migration V2.1.1
// Convertit localStorage legacy → format engine
// Garde anciennes clés 30 jours (rétro-compat)
// ==========================================

import type { User } from '@/types';
import type { LangueId, PathId, ReviewItem } from './types';
import type { UserProfile } from './userProfile';
import type { EngineProgress } from './userProgress';
import { getOrCreateProfile } from './userProfile';
import { getOrCreateProgress, saveEngineProgress, createEmptyProgress } from './userProgress';

// --- Migration version ---
const MIGRATION_VERSION = '2.1.1';
const MIGRATION_KEY = 'lingualearn_engine_migration';

// --- Logging ---
function logMigration(action: string, data?: unknown): void {
  console.log(`[Engine:Migration] ${action}`, data ?? '');
}

// --- Check if migration already done ---
export function isMigrated(userId: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const raw = localStorage.getItem(`${MIGRATION_KEY}_${userId}`);
    if (!raw) return false;
    const info = JSON.parse(raw);
    return info.version === MIGRATION_VERSION;
  } catch {
    return false;
  }
}

// --- Mark migration complete ---
function markMigrated(userId: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(`${MIGRATION_KEY}_${userId}`, JSON.stringify({
      version: MIGRATION_VERSION,
      migratedAt: new Date().toISOString(),
      // Anciennes clés conservées 30 jours
      legacyKeysExpireAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    }));
  } catch (e) {
    console.error('[Engine:Migration] Failed to mark migrated:', e);
  }
}

// --- Migrate review items from legacy format ---
function migrateLegacyReviews(userId: string, langueId: LangueId): ReviewItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const key = `lingualearn_reviews_${userId}_${langueId}`;
    const raw = localStorage.getItem(key);
    if (!raw) return [];

    const legacy = JSON.parse(raw) as Array<{
      itemId: string;
      type: 'word' | 'grammar';
      lastScore: number;
      nextReviewDate: string;
      reviewCount: number;
    }>;

    return legacy.map(item => ({
      itemId: item.itemId,
      itemType: item.type === 'grammar' ? 'grammar' as const : 'word' as const,
      langueId,
      courseId: '', // Legacy items don't have courseId
      lastScore: item.lastScore,
      nextReviewDate: item.nextReviewDate,
      reviewCount: item.reviewCount,
      consecutiveSuccesses: item.lastScore >= 70 ? 1 : 0,
    }));
  } catch {
    return [];
  }
}

// --- Migrate coffre index from legacy ---
function migrateLegacyCoffreIndex(userId: string, langueId: LangueId): Record<string, number> {
  if (typeof window === 'undefined') return {};
  try {
    const key = `lingualearn_coffre_progress_${userId}_${langueId}`;
    const raw = localStorage.getItem(key);
    if (!raw) return {};

    const legacy = JSON.parse(raw);
    if (legacy && typeof legacy === 'object' && 'courseId' in legacy && 'index' in legacy) {
      return { [legacy.courseId]: legacy.index };
    }
    return {};
  } catch {
    return {};
  }
}

// --- Migrate completed courses from legacy ---
function migrateLegacyCourseScores(userId: string, langueId: LangueId): { courseId: string; score: number; stars: number; completedAt: string }[] {
  if (typeof window === 'undefined') return [];
  try {
    const key = `lingualearn_course_scores_${userId}_${langueId}`;
    const raw = localStorage.getItem(key);
    if (!raw) return [];

    const scores = JSON.parse(raw) as Record<string, { score: number; stars: number; completedAt?: string }>;
    return Object.entries(scores).map(([courseId, data]) => ({
      courseId: courseId.startsWith('en_') ? courseId : `en_${courseId}`,
      score: data.score || 0,
      stars: data.stars || 0,
      completedAt: data.completedAt || new Date().toISOString(),
    }));
  } catch {
    return [];
  }
}

// --- Main migration function ---
export function migrateUserData(user: User): { profile: UserProfile; progressByLang: Record<string, EngineProgress> } {
  logMigration('starting', { userId: user.id, email: user.email });

  // 1. Create/get engine profile
  const profile = getOrCreateProfile(user);

  // 2. Migrate progress for each learning language
  const progressByLang: Record<string, EngineProgress> = {};

  for (const lang of user.settings.learningLangs) {
    const langueId = lang as LangueId;
    const pathId = (profile.pathByLang[langueId] || 'A') as PathId;

    // Get or create engine progress
    const progress = getOrCreateProgress(user.id, langueId, pathId);

    // Migrate legacy data
    const legacyProgress = user.progress[langueId];
    if (legacyProgress) {
      // Module percents from legacy objectiveProgress
      progress.modulePercent = {
        grammaire: legacyProgress.objectiveProgress?.grammaire || 0,
        vocabulaire: legacyProgress.objectiveProgress?.vocabulaire || 0,
        lecture: legacyProgress.objectiveProgress?.lecture || 0,
        ecrit: legacyProgress.objectiveProgress?.ecrit || 0,
        oral: legacyProgress.objectiveProgress?.oral || 0,
      };

      // Streak
      progress.streak = legacyProgress.streak || 0;
      progress.lastActivityDate = legacyProgress.lastActivityDate || '';
      progress.dailyWordsCompleted = legacyProgress.dailyWordsCompleted || 0;
      progress.dailyExercisesCompleted = legacyProgress.dailyExercisesCompleted || 0;
    }

    // Migrate review items
    const legacyReviews = migrateLegacyReviews(user.id, langueId);
    if (legacyReviews.length > 0) {
      progress.reviewItems = legacyReviews;
      logMigration('reviews migrated', { langueId, count: legacyReviews.length });
    }

    // Migrate coffre index
    const coffreIndex = migrateLegacyCoffreIndex(user.id, langueId);
    if (Object.keys(coffreIndex).length > 0) {
      progress.coffreIndex = coffreIndex;
      logMigration('coffreIndex migrated', { langueId });
    }

    // Migrate completed courses
    const courseScores = migrateLegacyCourseScores(user.id, langueId);
    if (courseScores.length > 0) {
      progress.completedCourses = courseScores;
      for (const cs of courseScores) {
        progress.courseStates[cs.courseId] = 'completed';
      }
      logMigration('courseScores migrated', { langueId, count: courseScores.length });
    }

    saveEngineProgress(progress);
    progressByLang[langueId] = progress;
  }

  // 3. Mark as migrated
  markMigrated(user.id);
  logMigration('completed', { userId: user.id, langs: Object.keys(progressByLang) });

  return { profile, progressByLang };
}

// --- Auto-migrate on login (call from dashboard/session loading) ---
export function ensureMigrated(user: User): { profile: UserProfile; progress: EngineProgress } {
  if (!isMigrated(user.id)) {
    const { profile, progressByLang } = migrateUserData(user);
    const activeLang = (user.activeLang || user.settings.learningLangs[0] || 'en') as LangueId;
    const progress = progressByLang[activeLang] || createEmptyProgress(
      user.id, activeLang, (profile.pathByLang[activeLang] || 'A') as PathId
    );
    return { profile, progress };
  }

  // Already migrated — just load
  const profile = getOrCreateProfile(user);
  const activeLang = profile.activeLang || 'en';
  const progress = getOrCreateProgress(
    user.id, activeLang, (profile.pathByLang[activeLang] || 'A') as PathId
  );
  return { profile, progress };
}

// --- Cleanup expired legacy keys (call periodically) ---
export function cleanupLegacyKeys(userId: string): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(`${MIGRATION_KEY}_${userId}`);
    if (!raw) return;
    const info = JSON.parse(raw);

    if (info.legacyKeysExpireAt && new Date(info.legacyKeysExpireAt) < new Date()) {
      logMigration('cleaning up legacy keys', { userId });
      // Legacy keys to clean
      const prefixes = [
        `lingualearn_reviews_${userId}`,
        `lingualearn_coffre_progress_${userId}`,
        `lingualearn_course_scores_${userId}`,
        `lingualearn_flashcard_progress_${userId}`,
        `lingualearn_course_progress_today_${userId}`,
        `lingualearn_course_done_today_${userId}`,
        `lingualearn_coffre_done_today_${userId}`,
        `lingualearn_revision_done_today_${userId}`,
        `lingualearn_continue_override_${userId}`,
      ];

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && prefixes.some(p => key.startsWith(p))) {
          localStorage.removeItem(key);
          logMigration('removed legacy key', { key });
        }
      }
    }
  } catch (e) {
    console.error('[Engine:Migration] Cleanup failed:', e);
  }
}
