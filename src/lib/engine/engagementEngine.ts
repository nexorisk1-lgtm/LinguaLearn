// ==========================================
// LINGUALEARN ENGINE — Engagement Loop (BLOC 7)
// Streak system & Daily objectives management
// ==========================================

import type { LangueId } from './types';
import { getEngineProgress, saveEngineProgress } from './userProgress';

// --- STREAK MANAGEMENT ---

/**
 * Engagement milestone thresholds and messages
 */
const MILESTONES: Record<number, { level: number; message_fr: string; message_en: string }> = {
  3: { level: 3, message_fr: '🔥 Bravo ! 3 jours d\'affilée !', message_en: '🔥 Amazing! 3 days in a row!' },
  7: { level: 7, message_fr: '⭐ Une semaine d\'engagement ! Tu es en feu !', message_en: '⭐ One week of streak! You\'re on fire!' },
  30: { level: 30, message_fr: '👑 Champion ! 30 jours d\'engagement sans interruption !', message_en: '👑 Champion! 30 days of non-stop engagement!' },
};

/**
 * Calculate current streak with joker support
 * - Joker: 1 skip per week without losing streak
 * - Resets if 2+ days without activity (and joker used)
 */
export function calculateStreak(userId: string, langueId: LangueId): {
  streak: number;
  jokerUsed: boolean;
  milestone: number | null;
} {
  const progress = getEngineProgress(userId, langueId);
  if (!progress) {
    return { streak: 0, jokerUsed: false, milestone: null };
  }

  const today = new Date().toISOString().split('T')[0];
  const lastActivityDate = progress.lastActivityDate;

  // No activity yet
  if (!lastActivityDate) {
    return { streak: 0, jokerUsed: false, milestone: null };
  }

  // Activity today → streak is current
  if (lastActivityDate === today) {
    const milestone = checkMilestone(progress.streak);
    return {
      streak: progress.streak,
      jokerUsed: getJokerStatus(userId, langueId),
      milestone: milestone?.level ?? null,
    };
  }

  // Check if streak should reset
  const lastDate = new Date(lastActivityDate);
  const todayDate = new Date(today);
  const daysDiff = Math.floor((todayDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));

  // 1 day gap (yesterday) → maintain streak
  if (daysDiff === 1) {
    const streak = progress.streak;
    const milestone = checkMilestone(streak);
    return {
      streak,
      jokerUsed: getJokerStatus(userId, langueId),
      milestone: milestone?.level ?? null,
    };
  }

  // 2+ days gap → check if joker can help
  if (daysDiff >= 2) {
    const jokerUsed = getJokerStatus(userId, langueId);
    if (jokerUsed) {
      // Joker already used this week → reset
      return { streak: 0, jokerUsed: true, milestone: null };
    }
    // Can still use joker → maintain streak but mark joker as used
    const streak = progress.streak;
    const milestone = checkMilestone(streak);
    return {
      streak,
      jokerUsed: true,
      milestone: milestone?.level ?? null,
    };
  }

  return {
    streak: progress.streak,
    jokerUsed: getJokerStatus(userId, langueId),
    milestone: null,
  };
}

/**
 * Check if joker was used this week (Mon-Sun)
 */
function getJokerStatus(userId: string, langueId: LangueId): boolean {
  const key = `lingualearn_joker_${userId}_${langueId}`;
  const stored = localStorage.getItem(key);
  if (!stored) return false;

  try {
    const data = JSON.parse(stored) as { usedDate: string; weekStart: string };
    const weekStart = getWeekStart(new Date());
    const storedWeekStart = new Date(data.weekStart);

    // If week changed, reset joker
    if (weekStart.getTime() !== storedWeekStart.getTime()) {
      localStorage.removeItem(key);
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Get Monday of current week (00:00 UTC)
 */
function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust to Monday
  return new Date(d.setDate(diff));
}

/**
 * Record an activity for today
 * Updates streak if needed and clears daily counters on new day
 */
export function recordActivity(userId: string, langueId: LangueId): void {
  const progress = getEngineProgress(userId, langueId);
  if (!progress) return;

  const today = new Date().toISOString().split('T')[0];
  const lastDate = progress.lastActivityDate;

  // Already recorded for today
  if (lastDate === today) return;

  // Calculate new streak
  let newStreak = progress.streak;
  if (lastDate) {
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    if (lastDate === yesterday) {
      newStreak += 1;
    } else {
      // 2+ days gap: joker logic
      const jokerUsed = getJokerStatus(userId, langueId);
      if (jokerUsed) {
        newStreak = 1; // Reset
      } else {
        // Mark joker as used and maintain streak
        const weekStart = getWeekStart(new Date());
        const jokerData = {
          usedDate: today,
          weekStart: weekStart.toISOString().split('T')[0],
        };
        localStorage.setItem(
          `lingualearn_joker_${userId}_${langueId}`,
          JSON.stringify(jokerData)
        );
      }
    }
  } else {
    newStreak = 1;
  }

  const updated = {
    ...progress,
    streak: newStreak,
    lastActivityDate: today,
    dailyWordsCompleted: 0,
    dailyExercisesCompleted: 0,
  };

  saveEngineProgress(updated);
}

/**
 * Check if streak has reached a milestone
 */
export function checkMilestone(streak: number): {
  reached: boolean;
  level: number;
  message: string;
} | null {
  // Check milestones in order
  for (const [thresholdStr, milestone] of Object.entries(MILESTONES)) {
    const threshold = parseInt(thresholdStr, 10);
    if (streak === threshold) {
      return {
        reached: true,
        level: milestone.level,
        message: milestone.message_en, // Use English by default, will be localized in component
      };
    }
  }
  return null;
}

// --- DAILY OBJECTIVE MANAGEMENT ---

/**
 * Daily objective targets
 */
const DAILY_OBJECTIVE_TARGETS = {
  courseDone: 1,
  revisionDone: 1,
  targetMinutes: 5,
  bonusPoints: 30,
};

/**
 * Get current daily objective status for a user/language
 */
export function getDailyObjective(userId: string, langueId: LangueId): {
  courseDone: boolean;
  revisionDone: boolean;
  minutesDone: number;
  targetMinutes: number;
  completed: boolean;
  bonusPoints: number;
} {
  const progress = getEngineProgress(userId, langueId);
  if (!progress) {
    return {
      courseDone: false,
      revisionDone: false,
      minutesDone: 0,
      targetMinutes: DAILY_OBJECTIVE_TARGETS.targetMinutes,
      completed: false,
      bonusPoints: DAILY_OBJECTIVE_TARGETS.bonusPoints,
    };
  }

  const today = new Date().toISOString().split('T')[0];
  const lastDate = progress.lastActivityDate;

  // Reset counters if new day
  const isNewDay = lastDate !== today;
  const courseDone = !isNewDay && (progress.dailyWordsCompleted > 0);
  const revisionDone = !isNewDay && (progress.dailyExercisesCompleted > 0);

  // Minutes done: sum of activities
  const minutesDone = !isNewDay
    ? Math.min(
        DAILY_OBJECTIVE_TARGETS.targetMinutes,
        Math.floor((progress.dailyWordsCompleted + progress.dailyExercisesCompleted) / 2)
      )
    : 0;

  // Check if all objectives are met
  const completed =
    courseDone &&
    revisionDone &&
    minutesDone >= DAILY_OBJECTIVE_TARGETS.targetMinutes;

  return {
    courseDone,
    revisionDone,
    minutesDone,
    targetMinutes: DAILY_OBJECTIVE_TARGETS.targetMinutes,
    completed,
    bonusPoints: DAILY_OBJECTIVE_TARGETS.bonusPoints,
  };
}

/**
 * Record progress towards daily objective
 */
export function recordDailyProgress(
  userId: string,
  langueId: LangueId,
  type: 'course' | 'revision' | 'training',
  minutes: number
): void {
  const progress = getEngineProgress(userId, langueId);
  if (!progress) return;

  const today = new Date().toISOString().split('T')[0];
  const lastDate = progress.lastActivityDate;

  // Reset if new day
  let dailyWords = progress.dailyWordsCompleted;
  let dailyExercises = progress.dailyExercisesCompleted;

  if (lastDate !== today) {
    dailyWords = 0;
    dailyExercises = 0;
  }

  // Increment based on type
  if (type === 'course') {
    dailyWords += minutes;
  } else if (type === 'revision' || type === 'training') {
    dailyExercises += minutes;
  }

  const updated = {
    ...progress,
    dailyWordsCompleted: dailyWords,
    dailyExercisesCompleted: dailyExercises,
    lastActivityDate: today,
  };

  saveEngineProgress(updated);
}

/**
 * Get milestone data for locale (FR or EN)
 */
export function getMilestoneMessage(
  streak: number,
  locale: 'fr' | 'en'
): string | null {
  for (const [thresholdStr, milestone] of Object.entries(MILESTONES)) {
    const threshold = parseInt(thresholdStr, 10);
    if (streak === threshold) {
      return locale === 'fr' ? milestone.message_fr : milestone.message_en;
    }
  }
  return null;
}
