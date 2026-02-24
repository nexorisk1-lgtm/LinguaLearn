// ==========================================
// LINGUALEARN - Types TypeScript
// CDC V2.1 - Types centraux
// ==========================================

// --- Langues ---
export type LearningLanguage = 'en' | 'es' | 'ko' | 'ar' | 'zh' | 'ja' | 'fr';
export type InterfaceLanguage = 'fr' | 'en';

export const LEARNING_LANGUAGES: { code: LearningLanguage; nameEn: string; nameFr: string; flag: string }[] = [
  { code: 'en', nameEn: 'English', nameFr: 'Anglais', flag: '🇬🇧' },
  { code: 'es', nameEn: 'Spanish', nameFr: 'Espagnol', flag: '🇪🇸' },
  { code: 'ko', nameEn: 'Korean', nameFr: 'Coréen', flag: '🇰🇷' },
  { code: 'ar', nameEn: 'Arabic', nameFr: 'Arabe', flag: '🇸🇦' },
  { code: 'zh', nameEn: 'Chinese (Mandarin)', nameFr: 'Chinois (Mandarin)', flag: '🇨🇳' },
  { code: 'ja', nameEn: 'Japanese', nameFr: 'Japonais', flag: '🇯🇵' },
  { code: 'fr', nameEn: 'French', nameFr: 'Français', flag: '🇫🇷' },
];

// --- Niveaux ---
export type LevelCECRL = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
export type LevelGRC = 'Junior' | 'Intermédiaire' | 'Senior' | 'Expert';

// --- Rôles ---
export type UserRole = 'user' | 'admin';

// --- Objectifs pédagogiques (Section 8) ---
export type LearningObjective = 'grammaire' | 'vocabulaire' | 'lecture' | 'ecrit' | 'oral';

export const LEARNING_OBJECTIVES: { id: LearningObjective; nameEn: string; nameFr: string; icon: string }[] = [
  { id: 'grammaire', nameEn: 'Grammar', nameFr: 'Grammaire', icon: '📝' },
  { id: 'vocabulaire', nameEn: 'Vocabulary', nameFr: 'Vocabulaire', icon: '📚' },
  { id: 'lecture', nameEn: 'Reading', nameFr: 'Lecture', icon: '📖' },
  { id: 'ecrit', nameEn: 'Writing', nameFr: 'Écrit', icon: '✍️' },
  { id: 'oral', nameEn: 'Speaking', nameFr: 'Oral', icon: '🎤' },
];

// --- Thèmes (Section 7) ---
export interface Theme {
  id: string;
  nameEn: string;
  nameFr: string;
  type: 'personal' | 'professional';
}

export const PROFESSIONAL_THEMES: Theme[] = [
  { id: 'meetings', nameEn: 'Meetings', nameFr: 'Réunions', type: 'professional' },
  { id: 'risk', nameEn: 'Risk Management', nameFr: 'Gestion des risques', type: 'professional' },
  { id: 'audit', nameEn: 'Audit', nameFr: 'Audit', type: 'professional' },
  { id: 'compliance', nameEn: 'Compliance', nameFr: 'Conformité', type: 'professional' },
  { id: 'control', nameEn: 'Internal Control', nameFr: 'Contrôle interne', type: 'professional' },
  { id: 'consulting', nameEn: 'Consulting', nameFr: 'Consulting', type: 'professional' },
  { id: 'governance', nameEn: 'Governance', nameFr: 'Gouvernance', type: 'professional' },
  { id: 'cybersecurity', nameEn: 'Cybersecurity', nameFr: 'Cybersécurité', type: 'professional' },
];

export const PERSONAL_THEMES: Theme[] = [
  { id: 'travel', nameEn: 'Travel', nameFr: 'Voyage', type: 'personal' },
  { id: 'restaurant', nameEn: 'Restaurant', nameFr: 'Restaurant', type: 'personal' },
  { id: 'colours', nameEn: 'Colours', nameFr: 'Couleurs', type: 'personal' },
  { id: 'animals', nameEn: 'Animals', nameFr: 'Animaux', type: 'personal' },
  { id: 'family', nameEn: 'Family', nameFr: 'Famille', type: 'personal' },
  { id: 'fruits', nameEn: 'Fruits', nameFr: 'Fruits', type: 'personal' },
  { id: 'sports', nameEn: 'Sports', nameFr: 'Sports', type: 'personal' },
  { id: 'music', nameEn: 'Music', nameFr: 'Musique', type: 'personal' },
  { id: 'weather', nameEn: 'Weather', nameFr: 'Météo', type: 'personal' },
  { id: 'clothes', nameEn: 'Clothes', nameFr: 'Vêtements', type: 'personal' },
  { id: 'house', nameEn: 'House', nameFr: 'Maison', type: 'personal' },
  { id: 'body', nameEn: 'Body', nameFr: 'Corps', type: 'personal' },
  { id: 'school', nameEn: 'School', nameFr: 'École', type: 'personal' },
  { id: 'work', nameEn: 'Work', nameFr: 'Travail', type: 'personal' },
  { id: 'food', nameEn: 'Food', nameFr: 'Nourriture', type: 'personal' },
  { id: 'numbers', nameEn: 'Numbers', nameFr: 'Nombres', type: 'personal' },
  { id: 'time', nameEn: 'Time', nameFr: 'Heure', type: 'personal' },
  { id: 'emotions', nameEn: 'Emotions', nameFr: 'Émotions', type: 'personal' },
  { id: 'hobbies', nameEn: 'Hobbies', nameFr: 'Loisirs', type: 'personal' },
];

export const ALL_THEMES: Theme[] = [...PERSONAL_THEMES, ...PROFESSIONAL_THEMES];

// --- Durées disponibles (Section 6 - Écran 3) ---
export type SessionDuration = 5 | 10 | 20 | 30 | 60 | 120 | 180;

export const SESSION_DURATIONS: { value: SessionDuration; labelFr: string; labelEn: string }[] = [
  { value: 5, labelFr: '5 min', labelEn: '5 min' },
  { value: 10, labelFr: '10 min', labelEn: '10 min' },
  { value: 20, labelFr: '20 min', labelEn: '20 min' },
  { value: 30, labelFr: '30 min', labelEn: '30 min' },
  { value: 60, labelFr: '1h', labelEn: '1h' },
  { value: 120, labelFr: '2h', labelEn: '2h' },
  { value: 180, labelFr: '3h', labelEn: '3h' },
];

// --- Jours de la semaine ---
export type DayOfWeek = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

export const DAYS_OF_WEEK: { id: DayOfWeek; labelFr: string; labelEn: string; shortFr: string; shortEn: string }[] = [
  { id: 'mon', labelFr: 'Lundi', labelEn: 'Monday', shortFr: 'L', shortEn: 'M' },
  { id: 'tue', labelFr: 'Mardi', labelEn: 'Tuesday', shortFr: 'M', shortEn: 'T' },
  { id: 'wed', labelFr: 'Mercredi', labelEn: 'Wednesday', shortFr: 'M', shortEn: 'W' },
  { id: 'thu', labelFr: 'Jeudi', labelEn: 'Thursday', shortFr: 'J', shortEn: 'T' },
  { id: 'fri', labelFr: 'Vendredi', labelEn: 'Friday', shortFr: 'V', shortEn: 'F' },
  { id: 'sat', labelFr: 'Samedi', labelEn: 'Saturday', shortFr: 'S', shortEn: 'S' },
  { id: 'sun', labelFr: 'Dimanche', labelEn: 'Sunday', shortFr: 'D', shortEn: 'S' },
];

// --- User Settings (stockage) ---
export interface UserSettings {
  interfaceLang: InterfaceLanguage;
  learningLangs: LearningLanguage[];
  selectedThemes: string[];
  objectives: LearningObjective[];
  schedule: {
    days: DayOfWeek[];
    duration: SessionDuration;
  };
  coachVoiceGender?: 'male' | 'female';
}

// --- User Progress ---
export interface UserProgress {
  levelCecrl: LevelCECRL;
  levelGrc?: LevelGRC;
  objectiveProgress: Record<LearningObjective, number>; // 0-100%
}

// --- User complet ---
export interface User {
  id: string;
  firstName: string;
  email: string;
  role: UserRole;
  settings: UserSettings;
  progress: Record<LearningLanguage, UserProgress>;
  hasGrcThemes: boolean;
  onboardingCompleted: boolean;
  createdAt: string;
}

// --- Diagnostic ---
export interface DiagnosticQuestion {
  id: string;
  type: 'cecrl' | 'grc';
  objective: LearningObjective;
  level: LevelCECRL | LevelGRC;
  question: string;
  options: string[];
  correctAnswer: number;
  language: LearningLanguage;
  theme?: string;
}

// --- Mapping objectifs → sections évaluation CECRL (Section 14.4) ---
export const OBJECTIVE_EVAL_SECTIONS: Record<LearningObjective, string[]> = {
  grammaire: ['grammaire'],
  vocabulaire: ['vocabulaire'],
  lecture: ['lecture'],
  ecrit: ['ecrit'],
  oral: ['oral', 'ecoute'],
};

// --- Scoring CECRL (Section 14.5) ---
export function scoreToCECRL(scorePercent: number): LevelCECRL {
  if (scorePercent < 40) return 'A1';
  if (scorePercent < 55) return 'A2';
  if (scorePercent < 70) return 'B1';
  return 'B2';
}

// --- Scoring GRC (Section 14.6) ---
export function scoreToGRC(scorePercent: number): LevelGRC {
  if (scorePercent < 40) return 'Junior';
  if (scorePercent < 60) return 'Intermédiaire';
  if (scorePercent < 80) return 'Senior';
  return 'Expert';
}
