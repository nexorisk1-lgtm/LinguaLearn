// ==========================================
// LINGUALEARN - LOT 2 : Types banques de données
// Vocabulaire, Grammaire, Lecture, Écrit, Oral
// ==========================================

// --- Vocabulaire ---
export interface VocabWord {
  id: string;
  language: string;
  word_target: string;
  word_fr: string;
  definition_en: string;
  example_en: string;
  theme: string;
  level: string; // A1, A2, B1, B2, C1, C2
  type?: string; // noun, verb, adj, adv...
  phonetic?: string;
  is_grc: boolean;
}

// --- Grammaire ---
export interface GrammarRule {
  id: string;
  language: string;
  rule_name: string;
  definition_fr: string;
  definition_en: string;
  attention_points?: string;
  examples: string[];
  level: string;
}

export interface GrammarExercise {
  id: string;
  grammar_rule_id: string;
  type: 'fill_blank' | 'multiple_choice' | 'reorder';
  question: string;
  options?: string[];
  answer: string;
}

// --- Verbes irréguliers ---
export interface IrregularVerb {
  base: string;
  past: string;
  past_participle: string;
  french: string;
  group: 'AAA' | 'ABB' | 'ABC' | 'ABA';
}

// --- Lecture ---
export interface ReadingText {
  id: string;
  language: string;
  level: string;
  theme: string;
  title: string;
  body_text: string;
}

// --- Écrit ---
export interface WritingExercise {
  id: string;
  language: string;
  level: string;
  theme: string;
  type: 'translation' | 'completion' | 'free_writing';
  instruction_fr: string;
  instruction_en: string;
  prompt: string;
  answer?: string; // expected answer for translation/completion
}

// --- Oral ---
export interface SpeakingExercise {
  id: string;
  language: string;
  level: string;
  theme: string;
  type: 'word' | 'sentence';
  target_text: string;
  instruction_fr: string;
  instruction_en: string;
}

// --- Vocabulaire personnel ---
export interface PersonalVocab {
  wordId: string;
  userId: string;
  addedAt: string;
}

// --- Mot proposé par un utilisateur ---
export interface ProposedWord {
  id: string;
  userId: string;
  language: string;
  word_target: string;
  word_fr: string;
  definition_en: string;
  example_en: string;
  theme: string;
  type?: string;
  is_grc: boolean;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
}
