// ==========================================
// LINGUALEARN - LocalStorage DB (DEV)
// CDC V2.1 Section 3.3 - Environnement DEV
// CORRIGÉ: Support languageConfigs PAR LANGUE
// ==========================================

import { User, UserSettings, UserProgress, LearningLanguage } from '@/types';

const STORAGE_KEYS = {
  USERS: 'lingualearn_users',
  CURRENT_USER: 'lingualearn_current_user',
  PROPOSED_WORDS: 'lingualearn_proposed_words',
} as const;

// --- Utility: Check if localStorage is available (Safari iOS private browsing) ---
function isLocalStorageAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const test = '__storage_test__';
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    return true;
  } catch (e) {
    console.warn('localStorage not available:', e);
    return false;
  }
}

// --- Helpers ---
function getUsers(): User[] {
  if (typeof window === 'undefined') return [];
  if (!isLocalStorageAvailable()) return [];
  try {
    const data = localStorage.getItem(STORAGE_KEYS.USERS);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.warn('localStorage getItem failed:', e);
    return [];
  }
}

function saveUsers(users: User[]): void {
  if (!isLocalStorageAvailable()) return;
  try {
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
  } catch (e) {
    console.warn('localStorage setItem failed:', e);
  }
}

// --- Auth ---
export function registerUser(
  firstName: string,
  email: string,
  password: string,
  role: 'user' | 'admin'
): { success: boolean; error?: string; user?: User } {
  // BUG-28: Check localStorage availability before proceeding
  if (!isLocalStorageAvailable()) {
    return { success: false, error: 'storageUnavailable' };
  }

  const users = getUsers();
  const existingUser = users.find(u => u.email === email);

  // AD-02: Allow dual role - upgrade existing user to admin if needed
  if (existingUser) {
    // If registering as admin and user exists, add admin role
    if (role === 'admin' && existingUser.role === 'user') {
      existingUser.role = 'admin';
      saveUsers(users);
      setCurrentUser(existingUser);
      return { success: true, user: existingUser };
    }
    // Otherwise reject duplicate email
    return { success: false, error: 'emailExists' };
  }

  const newUser: User = {
    id: crypto.randomUUID(),
    firstName,
    email,
    role,
    status: role === 'admin' ? 'active' : 'pending',
    settings: {
      interfaceLang: 'fr',
      learningLangs: [],
      languageConfigs: {},
      schedule: { days: [], duration: 20 },
    },
    progress: {},
    onboardingCompleted: false,
    createdAt: new Date().toISOString(),
  };

  // Store password separately (DEV only - not for PROD)
  try {
    const usersWithPwd = JSON.parse(localStorage.getItem('lingualearn_passwords') || '{}');
    usersWithPwd[email] = password;
    localStorage.setItem('lingualearn_passwords', JSON.stringify(usersWithPwd));
  } catch (e) {
    console.warn('localStorage password storage failed:', e);
  }

  users.push(newUser);
  saveUsers(users);
  setCurrentUser(newUser);

  return { success: true, user: newUser };
}

export function loginUser(email: string, password: string): { success: boolean; error?: string; user?: User } {
  // BUG-28: Check localStorage availability before proceeding
  if (!isLocalStorageAvailable()) {
    return { success: false, error: 'storageUnavailable' };
  }

  const users = getUsers();
  const user = users.find(u => u.email === email);

  if (!user) {
    return { success: false, error: 'credentials' };
  }

  let passwords: Record<string, string> = {};
  try {
    passwords = JSON.parse(localStorage.getItem('lingualearn_passwords') || '{}');
  } catch (e) {
    console.warn('localStorage password retrieval failed:', e);
  }
  if (passwords[email] !== password) {
    return { success: false, error: 'credentials' };
  }

  // AR-02: Data integrity — if user has learning languages, onboarding is done
  if (user.settings.learningLangs && user.settings.learningLangs.length > 0 && !user.onboardingCompleted) {
    user.onboardingCompleted = true;
    const idx = users.findIndex(u => u.id === user.id);
    if (idx !== -1) {
      users[idx] = user;
      saveUsers(users);
    }
  }

  // Fix status for old accounts — if no status and user exists, set to active
  if (!user.status) {
    user.status = 'active';
    // Save the fix
    const idx = users.findIndex(u => u.id === user.id);
    if (idx !== -1) {
      users[idx] = user;
      saveUsers(users);
    }
  }

  // Check if user is pending approval
  if (user.status === 'pending') {
    return { success: false, error: 'pending' };
  }

  setCurrentUser(user);
  return { success: true, user };
}

export function logoutUser(): void {
  // AR-02: Sync current user data back to USERS array before logout
  const currentUser = getCurrentUser();
  if (currentUser) {
    const users = getUsers();
    const index = users.findIndex(u => u.id === currentUser.id);
    if (index !== -1) {
      users[index] = currentUser;
      saveUsers(users);
    }
  }
  if (!isLocalStorageAvailable()) return;
  try {
    localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
  } catch (e) {
    console.warn('localStorage removeItem failed:', e);
  }
}

export function getCurrentUser(): User | null {
  if (typeof window === 'undefined') return null;
  if (!isLocalStorageAvailable()) return null;
  try {
    const data = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
    return data ? JSON.parse(data) : null;
  } catch (e) {
    console.warn('localStorage getItem failed:', e);
    return null;
  }
}

export function setCurrentUser(user: User): void {
  if (!isLocalStorageAvailable()) return;
  try {
    localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
  } catch (e) {
    console.warn('localStorage setItem failed:', e);
  }
  // AR-02: Always sync to USERS array for persistence across logout/login
  const users = getUsers();
  const index = users.findIndex(u => u.id === user.id);
  if (index !== -1) {
    users[index] = user;
    saveUsers(users);
  }
}

// --- User Settings ---
export function updateUserSettings(userId: string, settings: Partial<UserSettings>): User | null {
  const users = getUsers();
  const index = users.findIndex(u => u.id === userId);
  if (index === -1) return null;

  // Deep merge for nested objects to prevent data loss
  const existing = users[index].settings;
  const merged = { ...existing, ...settings };

  // Deep merge languageConfigs to preserve per-language settings
  if (settings.languageConfigs && existing.languageConfigs) {
    merged.languageConfigs = { ...existing.languageConfigs, ...settings.languageConfigs };
  }

  // Deep merge schedules to preserve per-language schedules
  if (settings.schedules && existing.schedules) {
    merged.schedules = { ...existing.schedules, ...settings.schedules };
  }

  users[index].settings = merged;

  saveUsers(users);
  setCurrentUser(users[index]);
  return users[index];
}

// --- Set active language (Correction #4) ---
export function setActiveLang(userId: string, lang: LearningLanguage): User | null {
  const users = getUsers();
  const index = users.findIndex(u => u.id === userId);
  if (index === -1) return null;

  users[index].activeLang = lang;

  saveUsers(users);
  setCurrentUser(users[index]);
  return users[index];
}

// --- User Progress ---
export function updateUserProgress(
  userId: string,
  language: string,
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

// --- Admin Role Management (AD-02) ---
export function upgradeToAdmin(email: string): User | null {
  const users = getUsers();
  const index = users.findIndex(u => u.email === email);
  if (index === -1) return null;

  users[index].role = 'admin';
  saveUsers(users);
  setCurrentUser(users[index]);
  return users[index];
}

// --- Proposed Words (Mots à qualifier) (AD-06) ---
export interface ProposedWord {
  id: string;
  word: string;
  language: string;
  definition?: string;
  proposedBy: string; // user email
  createdAt: string;
  status: 'pending' | 'validated' | 'rejected';
}

export function addProposedWord(word: string, language: string, proposedBy: string, definition?: string): ProposedWord {
  const proposed: ProposedWord = {
    id: crypto.randomUUID(),
    word,
    language,
    definition,
    proposedBy,
    createdAt: new Date().toISOString(),
    status: 'pending',
  };

  if (typeof window === 'undefined') return proposed;
  if (!isLocalStorageAvailable()) return proposed;
  try {
    const data = localStorage.getItem(STORAGE_KEYS.PROPOSED_WORDS);
    const words: ProposedWord[] = data ? JSON.parse(data) : [];
    words.push(proposed);
    localStorage.setItem(STORAGE_KEYS.PROPOSED_WORDS, JSON.stringify(words));
  } catch (e) {
    console.warn('localStorage operation failed:', e);
  }

  return proposed;
}

export function getAllProposedWords(): ProposedWord[] {
  if (typeof window === 'undefined') return [];
  if (!isLocalStorageAvailable()) return [];
  try {
    const data = localStorage.getItem(STORAGE_KEYS.PROPOSED_WORDS);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.warn('localStorage getItem failed:', e);
    return [];
  }
}

export function getPendingProposedWords(): ProposedWord[] {
  return getAllProposedWords().filter(w => w.status === 'pending');
}

export function validateProposedWord(wordId: string): ProposedWord | null {
  if (typeof window === 'undefined') return null;
  if (!isLocalStorageAvailable()) return null;
  try {
    const data = localStorage.getItem(STORAGE_KEYS.PROPOSED_WORDS);
    const words: ProposedWord[] = data ? JSON.parse(data) : [];
    const index = words.findIndex(w => w.id === wordId);
    if (index === -1) return null;

    words[index].status = 'validated';
    localStorage.setItem(STORAGE_KEYS.PROPOSED_WORDS, JSON.stringify(words));
    return words[index];
  } catch (e) {
    console.warn('localStorage operation failed:', e);
    return null;
  }
}

export function rejectProposedWord(wordId: string): ProposedWord | null {
  if (typeof window === 'undefined') return null;
  if (!isLocalStorageAvailable()) return null;
  try {
    const data = localStorage.getItem(STORAGE_KEYS.PROPOSED_WORDS);
    const words: ProposedWord[] = data ? JSON.parse(data) : [];
    const index = words.findIndex(w => w.id === wordId);
    if (index === -1) return null;

    words[index].status = 'rejected';
    localStorage.setItem(STORAGE_KEYS.PROPOSED_WORDS, JSON.stringify(words));
    return words[index];
  } catch (e) {
    console.warn('localStorage operation failed:', e);
    return null;
  }
}

// --- Admin: Get all users ---
export function getAllUsers(): User[] {
  const users = getUsers();
  let needsSave = false;
  users.forEach(u => {
    if (!u.status) {
      u.status = 'active';
      needsSave = true;
    }
  });
  if (needsSave) saveUsers(users);
  return users;
}

// --- Admin: Get user passwords (DEV only) ---
export function getUserPasswords(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  if (!isLocalStorageAvailable()) return {};
  try {
    return JSON.parse(localStorage.getItem('lingualearn_passwords') || '{}');
  } catch (e) {
    console.warn('localStorage getItem failed:', e);
    return {};
  }
}

// --- Admin: Approve user ---
export function approveUser(userId: string): User | null {
  const users = getUsers();
  const index = users.findIndex(u => u.id === userId);
  if (index === -1) return null;
  users[index].status = 'active';
  saveUsers(users);
  return users[index];
}

// --- Admin: Delete user ---
export function deleteUser(userId: string): boolean {
  const users = getUsers();
  const index = users.findIndex(u => u.id === userId);
  if (index === -1) return false;
  const email = users[index].email;
  users.splice(index, 1);
  saveUsers(users);
  // Also remove password
  if (!isLocalStorageAvailable()) return true;
  try {
    const passwords = JSON.parse(localStorage.getItem('lingualearn_passwords') || '{}');
    delete passwords[email];
    localStorage.setItem('lingualearn_passwords', JSON.stringify(passwords));
  } catch (e) {
    console.warn('localStorage operation failed:', e);
  }
  return true;
}

// --- Admin: Create user account ---
export function adminCreateUser(
  firstName: string,
  email: string,
  password: string,
  role: 'user' | 'admin'
): { success: boolean; error?: string; user?: User } {
  // BUG-28: Check localStorage availability before proceeding
  if (!isLocalStorageAvailable()) {
    return { success: false, error: 'storageUnavailable' };
  }

  const users = getUsers();
  if (users.find(u => u.email === email)) {
    return { success: false, error: 'emailExists' };
  }
  const newUser: User = {
    id: crypto.randomUUID(),
    firstName,
    email,
    role,
    status: 'active', // Admin-created accounts are immediately active
    settings: {
      interfaceLang: 'fr',
      learningLangs: [],
      languageConfigs: {},
      schedule: { days: [], duration: 20 },
    },
    progress: {},
    onboardingCompleted: false,
    createdAt: new Date().toISOString(),
  };
  try {
    const passwords = JSON.parse(localStorage.getItem('lingualearn_passwords') || '{}');
    passwords[email] = password;
    localStorage.setItem('lingualearn_passwords', JSON.stringify(passwords));
  } catch (e) {
    console.warn('localStorage operation failed:', e);
  }
  users.push(newUser);
  saveUsers(users);
  return { success: true, user: newUser };
}
