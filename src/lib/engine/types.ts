// ==========================================
// LINGUALEARN ENGINE — Types V2.1.1
// Architecture cible : 7 couches
// ==========================================

import type { LearningLanguage, LevelCECRL, LearningObjective } from '@/types';

// --- Identifiants ---
export type LangueId = LearningLanguage;
export type PathId = 'A' | 'B' | 'C' | 'A+C' | 'B+C';
export type ContentRegister = 'general' | 'daily_life' | 'professional' | 'business' | 'grc' | 'travel' | 'interview' | 'meeting' | 'email';

// --- États de progression (V.4 — cycles formalisés) ---
export type LearningState = 'locked' | 'unlocked' | 'in_progress' | 'completed' | 'mastered' | 'review_due';
export type WordLearningState = 'new' | 'seen' | 'in_progress' | 'learned' | 'fragile' | 'review_due' | 'mastered' | 'favorite';

// --- Modules par parcours (déterministe) ---
export const PATH_MODULES: Record<PathId, LearningObjective[]> = {
  'A':   ['vocabulaire', 'grammaire', 'oral', 'lecture', 'ecrit'],
  'B':   ['vocabulaire', 'grammaire', 'oral', 'lecture'],
  'C':   ['vocabulaire', 'grammaire', 'oral', 'lecture', 'ecrit'],
  'A+C': ['vocabulaire', 'grammaire', 'oral', 'lecture', 'ecrit'],
  'B+C': ['vocabulaire', 'grammaire', 'oral', 'lecture'],
};

// --- Niveau d'exposition contenu (optimisation 2) ---
export type ContentExposure = 'guided_only' | 'revision_only' | 'free_mode_allowed' | 'coach_allowed';

// --- Priorité pédagogique (optimisation 3) ---
export type PedagogicalPriority = 1 | 2 | 3; // 1=haute, 2=moyenne, 3=basse

// --- Tag obligatoire sur tout contenu (V.7 — publication) ---
export interface ContentTag {
  langueId: LangueId;
  pathId: PathId[];
  blockId: string;
  courseId: string;
  register?: ContentRegister;
  exposure?: ContentExposure;
  pedagogicalPriority?: PedagogicalPriority;
}

// --- Vocabulaire tagué ---
export interface TaggedVocabWord extends ContentTag {
  id: string;
  word_target: string;
  word_native: string;         // traduction dans nativeLangue
  definition_target: string;
  definition_native: string;
  example_target: string;
  example_native: string;
  phonetic: string;
  imageUrl?: string;           // obligatoire jusqu'à B1
  audioUrl?: string;           // obligatoire tous niveaux
  type: string;
  level: LevelCECRL;
  accepted_answers: string[];
  is_grc: boolean;
}

// --- Règle de grammaire taguée ---
export interface TaggedGrammarRule extends ContentTag {
  id: string;
  rule_name: string;
  definition_native: string;   // explication en nativeLangue
  definition_target: string;
  examples: { target: string; native: string }[];
  level: LevelCECRL;
  attention_points?: string;
}

// --- Exercice de grammaire ---
export interface TaggedGrammarExercise extends ContentTag {
  id: string;
  grammar_rule_id: string;
  type: 'multiple_choice' | 'fill_blank' | 'word_order' | 'error_correction' | 'transformation';
  question: string;
  answer: string;
  options: string[];
  level: LevelCECRL;
}

// --- Texte de lecture ---
export interface TaggedReadingText extends ContentTag {
  id: string;
  title: string;
  body_text: string;
  level: LevelCECRL;
  questions: { question: string; options: string[]; correctAnswer: number }[];
}

// --- Exercice oral ---
export interface TaggedSpeakingExercise extends ContentTag {
  id: string;
  type: 'repetition' | 'read_aloud' | 'word_pronunciation' | 'imitation' | 'mini_dialogue';
  prompt: string;
  expected: string;
  level: LevelCECRL;
}

// --- Exercice écrit ---
export interface TaggedWritingExercise extends ContentTag {
  id: string;
  type: 'word_isolated' | 'guided_sentence' | 'short_answer' | 'reformulation';
  prompt: string;
  level: LevelCECRL;
}

// --- Cours (référentiel) ---
export interface CourseDefinition {
  courseId: string;
  langueId: LangueId;
  pathId: PathId[];
  level: LevelCECRL;
  blockId: string;
  order: number;
  title: Record<string, string>;  // { fr: "Salutations", en: "Greetings" }
  prerequisite: string | null;
  unlockScore: number;
  scenario?: string;
  objectif?: string[];
}

// --- CourseContentMap entry ---
export interface CourseContent {
  courseId: string;
  langueId: LangueId;
  vocabularyIds: string[];
  grammarRuleId: string | null;
  grammarExerciseIds: string[];
  oralExerciseIds: string[];
  readingTextIds: string[];
  writingExerciseIds: string[];
  microReussite: Record<string, string>;
}

// --- Complétion de cours ---
export interface CourseCompletion {
  courseId: string;
  score: number;
  stars: number;
  completedAt: string;
}

// --- Review item (SM-2) ---
export interface ReviewItem {
  itemId: string;
  itemType: 'word' | 'grammar' | 'oral';
  langueId: LangueId;
  courseId: string;
  lastScore: number;
  nextReviewDate: string;
  reviewCount: number;
  consecutiveSuccesses: number;
}

// --- Résultats du moteur ---
export interface AvailableContent {
  vocabulary: TaggedVocabWord[];
  grammar: TaggedGrammarRule[];
  grammarExercises: TaggedGrammarExercise[];
  reading: TaggedReadingText[];
  speaking: TaggedSpeakingExercise[];
  writing: TaggedWritingExercise[];
  empty: boolean;
  reason?: 'no_course_completed' | 'no_content_for_language' | 'localization_pending';
  action?: 'complete_course' | 'select_language' | 'wait_localization';
}

export interface TrainingContent {
  words: TaggedVocabWord[];
  rules: TaggedGrammarRule[];
  exercises: TaggedGrammarExercise[];
  modeLabel: string;
  empty: boolean;
  reason?: string;
}

export interface ModuleBlock {
  id: LearningObjective;
  state: LearningState;
  percent: number;
  masteryPercent: number;
}

export interface UnlockedModules {
  modules: ModuleBlock[];
  progressBars: ModuleBlock[];
}

export interface RecommendedStep {
  type: 'revision' | 'course' | 'coach' | 'practice';
  courseId?: string;
  reason: string;
  priority: PedagogicalPriority;
}

// --- Event log (Aj. 5) ---
export type EventType =
  | 'word_seen' | 'word_correct' | 'word_failed'
  | 'rule_seen' | 'oral_attempt'
  | 'course_started' | 'course_completed'
  | 'coach_session_start' | 'revision_due'
  | 'exercise_abandoned';

export interface EventLogEntry {
  userId: string;
  langueId: LangueId;
  event: EventType;
  itemId?: string;
  courseId?: string;
  timestamp: string;
}
