// ==========================================
// LINGUALEARN - Notifications Module (BLOC 8)
// ==========================================

/**
 * Notification type definitions
 */
export type NotificationType =
  | 'streak_reminder'
  | 'revision_due'
  | 'milestone_celebration'
  | 'daily_objective_almost'
  | 'weekly_summary'
  | 'inactivity_gentle';

/**
 * Notification preferences interface
 */
interface NotificationPreferences {
  streak_reminder: boolean;
  revision_due: boolean;
  milestone_celebration: boolean;
  daily_objective_almost: boolean;
  weekly_summary: boolean;
  inactivity_gentle: boolean;
}

/**
 * Notification data for sending
 */
interface NotificationData {
  type: NotificationType;
  title: string;
  body: string;
  tag?: string;
  icon?: string;
}

/**
 * Daily notification tracking
 */
interface DailyNotificationTracker {
  date: string;
  count: number;
  sentTypes: NotificationType[];
}

/**
 * Request Notification permission from the browser
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if (!('Notification' in window)) return false;

  if (Notification.permission === 'granted') {
    return true;
  }

  if (Notification.permission !== 'denied') {
    try {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return false;
    }
  }

  return false;
}

/**
 * Initialize notifications - request permission and register service worker
 */
export async function initNotifications(): Promise<void> {
  if (typeof window === 'undefined') return;

  // Request notification permission
  const permitted = await requestNotificationPermission();

  if (permitted && 'serviceWorker' in navigator) {
    try {
      await navigator.serviceWorker.register('/sw.js');
    } catch (error) {
      console.error('Service worker registration failed:', error);
    }
  }
}

/**
 * Schedule a reminder notification
 * Checks if today is a scheduled day and shows a notification if conditions are met
 */
export function scheduleReminder(days: string[], lang: string): void {
  if (typeof window === 'undefined') return;
  if (Notification.permission !== 'granted') return;

  const today = new Date();
  const dayOfWeekId = getDayOfWeekId(today.getDay());

  // Check if today is a scheduled day
  if (!days.includes(dayOfWeekId)) {
    return;
  }

  // Get user data from localStorage to check last activity
  try {
    const userStr = localStorage.getItem('currentUser');
    if (!userStr) return;

    const user = JSON.parse(userStr);
    const progress = user.progress?.[lang];
    const lastActivityDate = progress?.lastActivityDate;
    const todayStr = today.toISOString().split('T')[0];

    // Only show reminder if last activity was not today
    if (lastActivityDate !== todayStr) {
      const title = lang === 'fr' ? 'LinguaLearn' : 'LinguaLearn';
      const message = lang === 'fr'
        ? 'N\'oublie pas de faire ta session du jour !'
        : 'Don\'t forget to do your daily session!';

      // Show notification using service worker if available
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: 'SHOW_NOTIFICATION',
          title,
          message,
        });
      } else {
        // Fallback: use standard Notification API
        new Notification(title, {
          body: message,
          icon: '/lingualearn-icon.png',
        });
      }
    }
  } catch (error) {
    console.error('Error scheduling reminder:', error);
  }
}

/**
 * Convert JavaScript day number to day ID
 * 0 = Sunday, 1 = Monday, etc.
 */
function getDayOfWeekId(dayNumber: number): string {
  const dayIds = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  return dayIds[dayNumber];
}

// ==========================================
// BLOC 8: Enhanced Notification System
// ==========================================

/**
 * Get default notification preferences (all enabled)
 */
function getDefaultPreferences(): NotificationPreferences {
  return {
    streak_reminder: true,
    revision_due: true,
    milestone_celebration: true,
    daily_objective_almost: true,
    weekly_summary: true,
    inactivity_gentle: true,
  };
}

/**
 * Get stored notification preferences for a user
 */
export function getNotificationPrefs(userId: string): NotificationPreferences {
  if (typeof window === 'undefined') return getDefaultPreferences();

  try {
    const key = `lingualearn_notif_prefs_${userId}`;
    const stored = localStorage.getItem(key);
    if (!stored) return getDefaultPreferences();

    return JSON.parse(stored) as NotificationPreferences;
  } catch (error) {
    console.error('Error getting notification preferences:', error);
    return getDefaultPreferences();
  }
}

/**
 * Set notification preference for a specific type
 */
export function setNotificationPref(
  userId: string,
  type: NotificationType,
  enabled: boolean
): void {
  if (typeof window === 'undefined') return;

  try {
    const key = `lingualearn_notif_prefs_${userId}`;
    const prefs = getNotificationPrefs(userId);
    prefs[type] = enabled;
    localStorage.setItem(key, JSON.stringify(prefs));
  } catch (error) {
    console.error('Error setting notification preference:', error);
  }
}

/**
 * Get daily notification tracking for today
 */
function getDailyTracker(userId: string): DailyNotificationTracker {
  if (typeof window === 'undefined') {
    return { date: '', count: 0, sentTypes: [] };
  }

  try {
    const key = `lingualearn_notif_tracker_${userId}`;
    const today = new Date().toISOString().split('T')[0];
    const stored = localStorage.getItem(key);

    if (!stored) {
      return { date: today, count: 0, sentTypes: [] };
    }

    const tracker = JSON.parse(stored) as DailyNotificationTracker;

    // Reset if date has changed
    if (tracker.date !== today) {
      return { date: today, count: 0, sentTypes: [] };
    }

    return tracker;
  } catch (error) {
    console.error('Error getting daily tracker:', error);
    return { date: new Date().toISOString().split('T')[0], count: 0, sentTypes: [] };
  }
}

/**
 * Update daily notification tracker
 */
function updateDailyTracker(userId: string, type: NotificationType): void {
  if (typeof window === 'undefined') return;

  try {
    const key = `lingualearn_notif_tracker_${userId}`;
    const tracker = getDailyTracker(userId);
    tracker.count++;
    tracker.sentTypes.push(type);
    localStorage.setItem(key, JSON.stringify(tracker));
  } catch (error) {
    console.error('Error updating daily tracker:', error);
  }
}

/**
 * Check if we can send a notification today (max 2/day rule)
 */
function canSendToday(userId: string): boolean {
  const tracker = getDailyTracker(userId);
  return tracker.count < 2;
}

/**
 * Check if notification type is already sent today
 */
function hasTypeSentToday(userId: string, type: NotificationType): boolean {
  const tracker = getDailyTracker(userId);
  return tracker.sentTypes.includes(type);
}

/**
 * Send a notification if allowed by preferences and daily limit
 */
export function sendNotification(
  type: NotificationType,
  userId: string,
  data: {
    count?: number;
    duration?: number;
    days?: number;
    wordsCount?: number;
    practiceMinutes?: number;
    activitiesRemaining?: number;
  } = {}
): void {
  if (typeof window === 'undefined') return;
  if (Notification.permission !== 'granted') return;

  // Check preferences
  const prefs = getNotificationPrefs(userId);
  if (!prefs[type]) {
    console.log(`Notification type ${type} is disabled for user ${userId}`);
    return;
  }

  // Check if already sent today
  if (hasTypeSentToday(userId, type)) {
    console.log(`Notification type ${type} already sent today`);
    return;
  }

  // Check daily limit
  if (!canSendToday(userId)) {
    console.log('Daily notification limit (2) reached');
    return;
  }

  // Generate notification content based on type
  const notification = generateNotificationContent(type, data);
  if (!notification) return;

  // Send notification
  try {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'SHOW_NOTIFICATION',
        title: notification.title,
        message: notification.body,
        tag: notification.tag,
      });
    } else {
      // Fallback: use standard Notification API
      new Notification(notification.title, {
        body: notification.body,
        tag: notification.tag,
        icon: notification.icon || '/lingualearn-icon.png',
      });
    }

    // Track sent notification
    updateDailyTracker(userId, type);
  } catch (error) {
    console.error(`Error sending ${type} notification:`, error);
  }
}

/**
 * Generate notification content based on type
 */
function generateNotificationContent(
  type: NotificationType,
  data: {
    count?: number;
    duration?: number;
    days?: number;
    wordsCount?: number;
    practiceMinutes?: number;
    activitiesRemaining?: number;
  }
): NotificationData | null {
  switch (type) {
    case 'streak_reminder':
      return {
        type,
        title: 'LinguaLearn',
        body: `N'oublie pas ta session ! 🔥 Streak: ${data.count || 0} jours`,
        tag: 'streak_reminder',
        icon: '/lingualearn-icon.png',
      };

    case 'revision_due':
      return {
        type,
        title: 'LinguaLearn',
        body: `${data.wordsCount || 0} mots vont être oubliés — 3 min suffisent`,
        tag: 'revision_due',
        icon: '/lingualearn-icon.png',
      };

    case 'milestone_celebration':
      return {
        type,
        title: 'LinguaLearn',
        body: `🏆 Bravo ! ${data.days || 0} jours consécutifs`,
        tag: 'milestone_celebration',
        icon: '/lingualearn-icon.png',
      };

    case 'daily_objective_almost':
      return {
        type,
        title: 'LinguaLearn',
        body: `Tu y es presque ! Plus que ${data.activitiesRemaining || 0} activités`,
        tag: 'daily_objective_almost',
        icon: '/lingualearn-icon.png',
      };

    case 'weekly_summary':
      return {
        type,
        title: 'LinguaLearn',
        body: `Cette semaine : ${data.wordsCount || 0} mots appris, ${data.practiceMinutes || 0} min de pratique`,
        tag: 'weekly_summary',
        icon: '/lingualearn-icon.png',
      };

    case 'inactivity_gentle':
      return {
        type,
        title: 'LinguaLearn',
        body: 'On te manque ! Reviens pratiquer 5 min',
        tag: 'inactivity_gentle',
        icon: '/lingualearn-icon.png',
      };

    default:
      return null;
  }
}

/**
 * Get last activity timestamp for user
 */
function getLastActivityTime(userId: string): Date | null {
  if (typeof window === 'undefined') return null;

  try {
    const key = `lingualearn_last_activity_${userId}`;
    const timestamp = localStorage.getItem(key);
    return timestamp ? new Date(timestamp) : null;
  } catch (error) {
    console.error('Error getting last activity time:', error);
    return null;
  }
}

/**
 * Update last activity timestamp
 */
export function updateActivityTime(userId: string): void {
  if (typeof window === 'undefined') return;

  try {
    const key = `lingualearn_last_activity_${userId}`;
    localStorage.setItem(key, new Date().toISOString());
  } catch (error) {
    console.error('Error updating activity time:', error);
  }
}

/**
 * Check if user has due reviews
 */
function hasDueReviews(userId: string, langueId: string): boolean {
  if (typeof window === 'undefined') return false;

  try {
    const userStr = localStorage.getItem('currentUser');
    if (!userStr) return false;

    const user = JSON.parse(userStr);
    const progress = user.progress?.[langueId];

    // Check if there are words with due reviews (lastReviewDate is old)
    if (!progress?.words || progress.words.length === 0) return false;

    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    return progress.words.some((word: Record<string, unknown>) => {
      const lastReview = word.lastReviewDate ? new Date(String(word.lastReviewDate)) : null;
      return !lastReview || lastReview < oneDayAgo;
    });
  } catch (error) {
    console.error('Error checking due reviews:', error);
    return false;
  }
}

/**
 * Get count of words due for review
 */
function getDueWordsCount(userId: string, langueId: string): number {
  if (typeof window === 'undefined') return 0;

  try {
    const userStr = localStorage.getItem('currentUser');
    if (!userStr) return 0;

    const user = JSON.parse(userStr);
    const progress = user.progress?.[langueId];

    if (!progress?.words || progress.words.length === 0) return 0;

    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    return progress.words.filter((word: Record<string, unknown>) => {
      const lastReview = word.lastReviewDate ? new Date(String(word.lastReviewDate)) : null;
      return !lastReview || lastReview < oneDayAgo;
    }).length;
  } catch (error) {
    console.error('Error getting due words count:', error);
    return 0;
  }
}

/**
 * Get streak count for user
 */
function getStreakCount(userId: string, langueId: string): number {
  if (typeof window === 'undefined') return 0;

  try {
    const userStr = localStorage.getItem('currentUser');
    if (!userStr) return 0;

    const user = JSON.parse(userStr);
    const progress = user.progress?.[langueId];
    return progress?.streak || 0;
  } catch (error) {
    console.error('Error getting streak count:', error);
    return 0;
  }
}

/**
 * Check for scheduled notifications and send if conditions are met
 * Call this from the dashboard or main app component
 */
export function checkAndSendScheduled(userId: string, langueId: string): void {
  if (typeof window === 'undefined') return;
  if (Notification.permission !== 'granted') return;

  try {
    const now = new Date();
    const hour = now.getHours();
    const lastActivity = getLastActivityTime(userId);
    const today = now.toISOString().split('T')[0];

    // Get user's last activity date
    const userStr = localStorage.getItem('currentUser');
    const user = userStr ? JSON.parse(userStr) : null;
    const lastActivityDate = user?.progress?.[langueId]?.lastActivityDate;
    const hasActivityToday = lastActivityDate === today;

    // STREAK_REMINDER: Evening (19h) if no activity today
    if (hour >= 19 && !hasActivityToday) {
      const streak = getStreakCount(userId, langueId);
      sendNotification('streak_reminder', userId, { count: streak });
    }

    // REVISION_DUE: Morning (9h) if due reviews exist
    if (hour >= 9 && hour < 10 && hasDueReviews(userId, langueId)) {
      const dueCount = getDueWordsCount(userId, langueId);
      sendNotification('revision_due', userId, { wordsCount: dueCount });
    }

    // INACTIVITY_GENTLE: After 48h of no activity
    if (lastActivity) {
      const hoursSinceActivity = (now.getTime() - lastActivity.getTime()) / (1000 * 60 * 60);
      if (hoursSinceActivity >= 48) {
        sendNotification('inactivity_gentle', userId);
      }
    }

    // Note: milestone_celebration, daily_objective_almost, and weekly_summary
    // are typically triggered from specific user actions rather than scheduled checks
  } catch (error) {
    console.error('Error checking scheduled notifications:', error);
  }
}

/**
 * Send milestone celebration (called when user reaches milestone)
 */
export function sendMilestoneCelebration(
  userId: string,
  days: number
): void {
  sendNotification('milestone_celebration', userId, { days });
}

/**
 * Send daily objective almost there (called when user is close to daily goal)
 */
export function sendDailyObjectiveAlmost(
  userId: string,
  activitiesRemaining: number
): void {
  sendNotification('daily_objective_almost', userId, { activitiesRemaining });
}

/**
 * Send weekly summary (called at end of week)
 */
export function sendWeeklySummary(
  userId: string,
  wordsCount: number,
  practiceMinutes: number
): void {
  sendNotification('weekly_summary', userId, { wordsCount, practiceMinutes });
}
