// ==========================================
// LINGUALEARN ENGINE — Couche A : UserProfile
// Architecture V2.1.1 — Profil utilisateur
// Source de vérité : localStorage (DEV)
// ==========================================

import type { LevelCECRL, User } from '@/types';
import type { LangueId, PathId } from './types';

// --- UserProfile enrichi (Aj. 4 + Aj. 19A) ---
export interface UserProfile {
  userId: string;
  firstName: string;
  email: string;
  role: 'user' | 'admin';
  // Langue maternelle déclarée (Aj. 19A)
  // Sert pour : feedback, micro-réussite, explications coach
  nativeLangue: LangueId;
  // Langue d'interface (fr/en)
  interfaceLang: 'fr' | 'en';
  // Langues en apprentissage
  learningLangs: LangueId[];
  // Langue active courante
  activeLang: LangueId;
  // Parcours par langue
  pathByLang: Record<string, PathId>;
  // Niveau CECRL par langue
  levelByLang: Record<string, LevelCECRL>;
  // Onboarding complété
  onboardingCompleted: boolean;
  createdAt: string;
}

// --- Storage key ---
const ENGINE_PROFILE_KEY = 'lingualearn_engine_profile';

// --- Logging minimal ---
function logProfile(action: string, data?: unknown): void {
  console.log(`[Engine:UserProfile] ${action}`, data ?? '');
}

// --- Convertir User existant → UserProfile ---
export function userToProfile(user: User): UserProfile {
  const activeLang = user.activeLang || user.settings.learningLangs[0] || 'en';

  // Extraire pathId depuis languageConfigs
  const pathByLang: Record<string, PathId> = {};
  for (const lang of user.settings.learningLangs) {
    const config = user.settings.languageConfigs?.[lang];
    if (config?.learningPath) {
      // learningPath peut être string ou array
      if (Array.isArray(config.learningPath)) {
        pathByLang[lang] = config.learningPath.join('+') as PathId;
      } else {
        pathByLang[lang] = config.learningPath as PathId;
      }
    } else {
      pathByLang[lang] = 'A'; // défaut
    }
  }

  // Extraire niveaux CECRL
  const levelByLang: Record<string, LevelCECRL> = {};
  for (const lang of user.settings.learningLangs) {
    levelByLang[lang] = user.progress[lang]?.levelCecrl || 'A1';
  }

  return {
    userId: user.id,
    firstName: user.firstName,
    email: user.email,
    role: user.role,
    nativeLangue: 'fr', // Défaut — sera mis à jour via onboarding (Aj. 19A)
    interfaceLang: user.settings.interfaceLang || 'fr',
    learningLangs: user.settings.learningLangs as LangueId[],
    activeLang: activeLang as LangueId,
    pathByLang,
    levelByLang,
    onboardingCompleted: user.onboardingCompleted,
    createdAt: user.createdAt,
  };
}

// --- Lire le profil moteur depuis localStorage ---
export function getEngineProfile(userId: string): UserProfile | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(`${ENGINE_PROFILE_KEY}_${userId}`);
    if (!raw) return null;
    const profile = JSON.parse(raw) as UserProfile;
    logProfile('loaded', { userId: profile.userId, activeLang: profile.activeLang });
    return profile;
  } catch (e) {
    console.error('[Engine:UserProfile] Failed to load profile:', e);
    return null;
  }
}

// --- Sauvegarder le profil moteur ---
export function saveEngineProfile(profile: UserProfile): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(`${ENGINE_PROFILE_KEY}_${profile.userId}`, JSON.stringify(profile));
    logProfile('saved', { userId: profile.userId, activeLang: profile.activeLang });
  } catch (e) {
    console.error('[Engine:UserProfile] Failed to save profile:', e);
  }
}

// --- Obtenir ou créer le profil moteur ---
export function getOrCreateProfile(user: User): UserProfile {
  const existing = getEngineProfile(user.id);
  if (existing) {
    // Sync activeLang depuis User si changé
    if (user.activeLang && existing.activeLang !== user.activeLang) {
      existing.activeLang = user.activeLang as LangueId;
      saveEngineProfile(existing);
    }
    return existing;
  }

  // Première utilisation → convertir depuis User
  const profile = userToProfile(user);
  saveEngineProfile(profile);
  logProfile('created from legacy User', { userId: profile.userId });
  return profile;
}

// --- Changer la langue active ---
export function setActiveLangue(profile: UserProfile, langueId: LangueId): UserProfile {
  if (!profile.learningLangs.includes(langueId)) {
    console.error(`[Engine:UserProfile] Langue ${langueId} not in learningLangs`);
    return profile;
  }
  const updated = { ...profile, activeLang: langueId };
  saveEngineProfile(updated);
  logProfile('activeLang changed', { userId: profile.userId, from: profile.activeLang, to: langueId });
  return updated;
}

// --- Ajouter une langue ---
export function addLangue(profile: UserProfile, langueId: LangueId, pathId: PathId, level: LevelCECRL = 'A1'): UserProfile {
  if (profile.learningLangs.includes(langueId)) {
    logProfile('langue already exists', { langueId });
    return profile;
  }
  const updated: UserProfile = {
    ...profile,
    learningLangs: [...profile.learningLangs, langueId],
    pathByLang: { ...profile.pathByLang, [langueId]: pathId },
    levelByLang: { ...profile.levelByLang, [langueId]: level },
    activeLang: langueId, // Nouvelle langue devient active
  };
  saveEngineProfile(updated);
  logProfile('langue added', { langueId, pathId, level });
  return updated;
}

// --- Mettre à jour nativeLangue (Aj. 19A) ---
export function setNativeLangue(profile: UserProfile, nativeLangue: LangueId): UserProfile {
  const updated = { ...profile, nativeLangue };
  saveEngineProfile(updated);
  logProfile('nativeLangue set', { nativeLangue });
  return updated;
}

// --- Mettre à jour le niveau CECRL ---
export function updateLevel(profile: UserProfile, langueId: LangueId, level: LevelCECRL): UserProfile {
  const updated: UserProfile = {
    ...profile,
    levelByLang: { ...profile.levelByLang, [langueId]: level },
  };
  saveEngineProfile(updated);
  logProfile('level updated', { langueId, level });
  return updated;
}
