// ==========================================
// LINGUALEARN ENGINE — CoachEngine
// Architecture V2.1.1 — Coach IA adaptatif
// 6 modes + adaptation nativeLangue + niveau
// ==========================================

import type { LevelCECRL } from '@/types';
import type { LangueId, ContentExposure } from './types';
import type { UserProfile } from './userProfile';
import type { EngineProgress } from './userProgress';

// --- 6 modes coach (Aj. 2) ---
export type CoachMode =
  | 'best_friend'
  | 'teacher'
  | 'tutor'
  | 'conversation'
  | 'revision'
  | 'professional_roleplay';

// --- Configuration coach ---
export interface CoachConfig {
  mode: CoachMode;
  nameFr: string;
  nameEn: string;
  descFr: string;
  descEn: string;
  allowedLevels: LevelCECRL[];
  exposure: ContentExposure;
}

export const COACH_MODES: CoachConfig[] = [
  {
    mode: 'best_friend',
    nameFr: 'Ami(e)',
    nameEn: 'Best Friend',
    descFr: 'Conversation décontractée, encouragements, ton informel',
    descEn: 'Casual conversation, encouragements, informal tone',
    allowedLevels: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'],
    exposure: 'coach_allowed',
  },
  {
    mode: 'teacher',
    nameFr: 'Professeur',
    nameEn: 'Teacher',
    descFr: 'Explications structurées, corrections précises, pédagogie',
    descEn: 'Structured explanations, precise corrections, pedagogy',
    allowedLevels: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'],
    exposure: 'coach_allowed',
  },
  {
    mode: 'tutor',
    nameFr: 'Tuteur',
    nameEn: 'Tutor',
    descFr: 'Accompagnement personnalisé, adaptation au rythme',
    descEn: 'Personalized guidance, pace adaptation',
    allowedLevels: ['A1', 'A2', 'B1', 'B2'],
    exposure: 'coach_allowed',
  },
  {
    mode: 'conversation',
    nameFr: 'Conversation libre',
    nameEn: 'Free Conversation',
    descFr: 'Dialogue naturel sur un thème choisi',
    descEn: 'Natural dialogue on a chosen topic',
    allowedLevels: ['A2', 'B1', 'B2', 'C1', 'C2'],
    exposure: 'coach_allowed',
  },
  {
    mode: 'revision',
    nameFr: 'Révision',
    nameEn: 'Revision',
    descFr: 'Reprise des erreurs fréquentes, renforcement ciblé',
    descEn: 'Frequent errors review, targeted reinforcement',
    allowedLevels: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'],
    exposure: 'revision_only',
  },
  {
    mode: 'professional_roleplay',
    nameFr: 'Jeu de rôle professionnel',
    nameEn: 'Professional Roleplay',
    descFr: 'Simulation de situations GRC : audit, meeting, email',
    descEn: 'GRC situation simulation: audit, meeting, email',
    allowedLevels: ['B1', 'B2', 'C1', 'C2'],
    exposure: 'coach_allowed',
  },
];

// --- Adaptation coach (Aj. 19) ---
export interface CoachAdaptation {
  level: LevelCECRL;
  nativeLangue: LangueId;
  langueId: LangueId;
  // Adapter la complexité du langage
  maxSentenceLength: number;
  useNativeExplanations: boolean;
  correctionStyle: 'gentle' | 'direct' | 'detailed';
}

// --- Logging ---
function logCoach(action: string, data?: unknown): void {
  console.log(`[Engine:CoachEngine] ${action}`, data ?? '');
}

// --- Obtenir les modes disponibles pour un utilisateur ---
export function getAvailableCoachModes(profile: UserProfile): CoachConfig[] {
  const level = profile.levelByLang[profile.activeLang] || 'A1';
  const available = COACH_MODES.filter(m => m.allowedLevels.includes(level));
  logCoach('getAvailableCoachModes', { level, count: available.length });
  return available;
}

// --- Obtenir le contexte coach (Aj. 19) ---
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function getCoachContext(
  profile: UserProfile,
  progress: EngineProgress,
  mode: CoachMode
): CoachAdaptation {
  // progress et mode seront utilisés en Phase 12 pour adapter selon l'historique
  void progress;
  void mode;
  const level = profile.levelByLang[profile.activeLang] || 'A1';
  const nativeLangue = profile.nativeLangue || 'fr';

  // Adapter selon le niveau
  let maxSentenceLength: number;
  let correctionStyle: 'gentle' | 'direct' | 'detailed';
  let useNativeExplanations: boolean;

  switch (level) {
    case 'A1':
      maxSentenceLength = 8;
      correctionStyle = 'gentle';
      useNativeExplanations = true;
      break;
    case 'A2':
      maxSentenceLength = 12;
      correctionStyle = 'gentle';
      useNativeExplanations = true;
      break;
    case 'B1':
      maxSentenceLength = 18;
      correctionStyle = 'direct';
      useNativeExplanations = false;
      break;
    case 'B2':
      maxSentenceLength = 25;
      correctionStyle = 'direct';
      useNativeExplanations = false;
      break;
    default:
      maxSentenceLength = 35;
      correctionStyle = 'detailed';
      useNativeExplanations = false;
  }

  const adaptation: CoachAdaptation = {
    level,
    nativeLangue,
    langueId: profile.activeLang,
    maxSentenceLength,
    useNativeExplanations,
    correctionStyle,
  };

  logCoach('getCoachContext', adaptation);
  return adaptation;
}

// --- Obtenir le contenu autorisé pour le coach ---
export function getCoachAllowedContent(
  profile: UserProfile,
  progress: EngineProgress,
  mode: CoachMode
): { courseIds: string[]; wordIds: string[] } {
  logCoach('getCoachAllowedContent', { mode });

  // Le coach n'a accès qu'aux cours complétés
  const completedCourseIds = progress.completedCourses.map(c => c.courseId);

  // + les mots dont l'état est au moins 'seen'
  const accessibleWordIds = Object.entries(progress.wordStates)
    .filter(([, state]) => state !== 'new')
    .map(([id]) => id);

  return {
    courseIds: completedCourseIds,
    wordIds: accessibleWordIds,
  };
}

// --- Générer le prompt système du coach ---
export function getCoachSessionPrompt(
  profile: UserProfile,
  progress: EngineProgress,
  mode: CoachMode
): string {
  const adaptation = getCoachContext(profile, progress, mode);
  const modeConfig = COACH_MODES.find(m => m.mode === mode);

  if (!modeConfig) {
    console.error(`[Engine:CoachEngine] Unknown mode: ${mode}`);
    return '';
  }

  const nativeLang = adaptation.nativeLangue === 'fr' ? 'French' : adaptation.nativeLangue;
  const targetLang = adaptation.langueId === 'en' ? 'English' : adaptation.langueId;

  let prompt = `You are a language learning coach in "${modeConfig.nameEn}" mode.\n`;
  prompt += `Student level: ${adaptation.level} (CECRL)\n`;
  prompt += `Target language: ${targetLang}\n`;
  prompt += `Student's native language: ${nativeLang}\n`;
  prompt += `Max sentence complexity: ${adaptation.maxSentenceLength} words\n`;
  prompt += `Correction style: ${adaptation.correctionStyle}\n`;

  if (adaptation.useNativeExplanations) {
    prompt += `IMPORTANT: Provide explanations and feedback in ${nativeLang}.\n`;
  }

  prompt += `\nRole: ${modeConfig.descEn}\n`;

  logCoach('getCoachSessionPrompt', { mode, level: adaptation.level });
  return prompt;
}
