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

  // AR-02 FIX: DEFENSIVE check - sync with any more recent CURRENT_USER data
  const currentUserData = getCurrentUser();
  if (currentUserData && currentUserData.id === user.id) {
    // If CURRENT_USER exists for this user, use it as it may have more recent state
    // But preserve core identity from USERS array
    const syncedUser: User = {
      ...user,
      ...currentUserData,
      id: user.id,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
    };

    // AR-02 FIX: Data integrity - if user has learning languages but onboarding not marked complete, force it to true
    if (syncedUser.settings.learningLangs && syncedUser.settings.learningLangs.length > 0 && !syncedUser.onboardingCompleted) {
      syncedUser.onboardingCompleted = true;
    }

    setCurrentUser(syncedUser);

    // AR-02 FIX: Sync back to USERS array to ensure persistence
    const userIndex = users.findIndex(u => u.id === user.id);
    if (userIndex !== -1) {
      users[userIndex] = syncedUser;
      saveUsers(users);
    }

    return { success: true, user: syncedUser };
  }

  // AR-02 FIX: Data integrity - if user has learning languages but onboarding not marked complete, force it to true
  if (user.settings.learningLangs && user.settings.learningLangs.length > 0 && !user.onboardingCompleted) {
    user.onboardingCompleted = true;
    const userIndex = users.findIndex(u => u.id === user.id);
    if (userIndex !== -1) {
      users[userIndex] = user;
      saveUsers(users);
    }
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
  const data = localStorage.getItem(STORAGE_KEYS.PROPOSED_WORDS);
  const words: ProposedWord[] = data ? JSON.parse(data) : [];
  words.push(proposed);
  localStorage.setItem(STORAGE_KEYS.PROPOSED_WORDS, JSON.stringify(words));

  return proposed;
}

export function getAllProposedWords(): ProposedWord[] {
  if (typeof window === 'undefined') return [];
  const data = localStorage.getItem(STORAGE_KEYS.PROPOSED_WORDS);
  return data ? JSON.parse(data) : [];
}

export function getPendingProposedWords(): ProposedWord[] {
  return getAllProposedWords().filter(w => w.status === 'pending');
}

export function validateProposedWord(wordId: string): ProposedWord | null {
  if (typeof window === 'undefined') return null;
  const data = localStorage.getItem(STORAGE_KEYS.PROPOSED_WORDS);
  const words: ProposedWord[] = data ? JSON.parse(data) : [];
  const index = words.findIndex(w => w.id === wordId);
  if (index === -1) return null;

  words[index].status = 'validated';
  localStorage.setItem(STORAGE_KEYS.PROPOSED_WORDS, JSON.stringify(words));
  return words[index];
}

export function rejectProposedWord(wordId: string): ProposedWord | null {
  if (typeof window === 'undefined') return null;
  const data = localStorage.getItem(STORAGE_KEYS.PROPOSED_WORDS);
  const words: ProposedWord[] = data ? JSON.parse(data) : [];
  const index = words.findIndex(w => w.id === wordId);
  if (index === -1) return null;

  words[index].status = 'rejected';
  localStorage.setItem(STORAGE_KEYS.PROPOSED_WORDS, JSON.stringify(words));
  return words[index];
}
