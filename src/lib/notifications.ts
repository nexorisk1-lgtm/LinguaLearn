// ==========================================
// LINGUALEARN - Notifications Module
// ==========================================

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
