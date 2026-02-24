// ==========================================
// LINGUALEARN - LocalStorage DB (DEV)
// CDC V2.1 Section 3.3 - Environnement DEV
// ==========================================

import { User, UserSettings, UserProgress, LearningLanguage } from '@/types';

const STORAGE_KEYS = {
  USERS: 'lingualearn_users',
  CURRENT_USER: 'lingualearn_current_user',
} as const;

// --- Helpers ---
function getUsers(): User[] {
  if (typeof window === 'undefined') return [];
  const data = localStorage.getItem(STORAGE_KEYS.USERS);
  return data ? JSON.parse(data) : [];
}

function saveUsers(users: User[]): void {
  localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
}

// --- Auth ---
export function registerUser(
  firstName: string,
  email: string,
  password: string,
  role: 'user' | 'admin'
): { success: boolean; error?: string; user?: User } {
  const users = getUsers();

  if (users.find(u => u.email === email)) {
    return { success: false, error: 'emailExists' };
  }

  const newUser: User = {
    id: crypto.randomUUID(),
    firstName,
    email,
    role,
    settings: {
      interfaceLang: 'fr',
      learningLangs: [],
      selectedThemes: [],
      objectives: [],
      schedule: { days: [], duration: 20 },
    },
    progress: {} as Record<LearningLanguage, UserProgress>,
    hasGrcThemes: false,
    onboardingCompleted: false,
    createdAt: new Date().toISOString(),
  };

  // Store password separately (DEV only - not for PROD)
  const usersWithPwd = JSON.parse(localStorage.getItem('lingualearn_passwords') || '{}');
  usersWithPwd[email] = password;
  localStorage.setItem('lingualearn_passwords', JSON.stringify(usersWithPwd));

  users.push(newUser);
  saveUsers(users);
  setCurrentUser(newUser);

  return { success: true, user: newUser };
}

export function loginUser(email: string, password: string): { success: boolean; error?: string; user?: User } {
  const users = getUsers();
  const user = users.find(u => u.email === email);

  if (!user) {
    return { success: false, error: 'credentials' };
  }

  const passwords = JSON.parse(localStorage.getItem('lingualearn_passwords') || '{}');
  if (passwords[email] !== password) {
    return { success: false, error: 'credentials' };
  }

  setCurrentUser(user);
  return { success: true, user };
}

export function logoutUser(): void {
  localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
}

export function getCurrentUser(): User | null {
  if (typeof window === 'undefined') return null;
  const data = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
  return data ? JSON.parse(data) : null;
}

export function setCurrentUser(user: User): void {
  localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
}

// --- User Settings ---
export function updateUserSettings(userId: string, settings: Partial<UserSettings>): User | null {
  const users = getUsers();
  const index = users.findIndex(u => u.id === userId);
  if (index === -1) return null;

  users[index].settings = { ...users[index].settings, ...settings };

  // Recalcul hasGrcThemes (CDC Section 6 - Écran 2)
  const professionalThemeIds = ['meetings', 'risk', 'audit', 'compliance', 'control', 'consulting', 'governance', 'cybersecurity'];
  users[index].hasGrcThemes = users[index].settings.selectedThemes.some(t => professionalThemeIds.includes(t));

  saveUsers(users);
  setCurrentUser(users[index]);
  return users[index];
}

// --- User Progress ---
export function updateUserProgress(
  userId: string,
  language: LearningLanguage,
  progress: Partial<UserProgress>
): User | null {
  const users = getUsers();
  const index = users.findIndex(u => u.id === userId);
  if (index === -1) return null;

  if (!users[index].progress[language]) {
    users[index].progress[language] = {
      levelCecrl: 'A1',
      objectiveProgress: {
        grammaire: 0,
        vocabulaire: 0,
        lecture: 0,
        ecrit: 0,
        oral: 0,
      },
    };
  }

  users[index].progress[language] = {
    ...users[index].progress[language],
    ...progress,
  };

  saveUsers(users);
  setCurrentUser(users[index]);
  return users[index];
}

// --- Onboarding ---
export function completeOnboarding(userId: string): User | null {
  const users = getUsers();
  const index = users.findIndex(u => u.id === userId);
  if (index === -1) return null;

  users[index].onboardingCompleted = true;
  saveUsers(users);
  setCurrentUser(users[index]);
  return users[index];
}
