// ==========================================
// LINGUALEARN ENGINE — Couche D : ContentStore
// Architecture V2.1.1 — Stockage contenu tagué
// Source de vérité pour contenu canonical/localized
// ==========================================

import type { LevelCECRL } from '@/types';
import type {
  LangueId,
  PathId,
  ContentExposure,
  PedagogicalPriority,
  TaggedVocabWord,
  TaggedGrammarRule,
  TaggedGrammarExercise,
  TaggedReadingText,
  TaggedSpeakingExercise,
  TaggedWritingExercise,
} from './types';

// --- Import du JSON source ---
import bankA1CoursesRaw from '@/lib/db/bankA1Courses.json';

// --- Canonical/Localized model (Aj. 17) ---
export type ContentStatus = 'draft' | 'validated' | 'override' | 'rejected';

export interface CanonicalContent {
  id: string;
  type: 'vocab' | 'grammar_rule' | 'grammar_exercise' | 'reading' | 'speaking' | 'writing';
  langueId: LangueId;
  status: ContentStatus;
  createdAt: string;
  updatedAt: string;
}

export interface LocalizedContent {
  canonicalId: string;
  langueId: LangueId;       // langue cible
  nativeLangueId: LangueId;  // langue de traduction
  status: ContentStatus;
  translatedAt: string;
  validatedBy?: string;       // admin who validated
}

// --- Type pour le JSON brut ---
interface RawVocab {
  word: string;
  trad_fr: string;
  phonetic_fr: string;
  definition_en: string;
  definition_fr: string;
  example_en: string;
  example_fr: string;
  image: string;
}

interface RawCourse {
  id: string;
  bloc: number;
  number: number;
  title: string;
  type: string;
  scenario: string;
  objectif: string[];
  micro_reussite: string;
  rule: { en: string; fr: string };
  examples: unknown[];
  vocabulary: RawVocab[];
}

// --- Logging ---
function logStore(action: string, data?: unknown): void {
  console.log(`[Engine:ContentStore] ${action}`, data ?? '');
}

// --- Helper: admin image bridge (localStorage) ---
function getAdminImage(courseId: string, vocabIndex: number): string | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    const key = `lingualearn_vocab_image_${courseId}_${vocabIndex}`;
    const img = localStorage.getItem(key);
    return img || undefined;
  } catch {
    return undefined;
  }
}

// --- Build vocabulaire tagué depuis JSON (40 cours EN) ---
function buildTaggedVocabulary(): TaggedVocabWord[] {
  const courses = bankA1CoursesRaw as RawCourse[];
  const words: TaggedVocabWord[] = [];

  for (const course of courses) {
    const courseId = `en_${course.id}`;
    const blockId = `bloc_${course.bloc}`;

    course.vocabulary.forEach((v, idx) => {
      const adminImage = getAdminImage(course.id, idx);

      words.push({
        // ContentTag
        langueId: 'en',
        pathId: ['A', 'B', 'C', 'A+C', 'B+C'] as PathId[],
        blockId,
        courseId,
        exposure: 'guided_only' as ContentExposure,
        pedagogicalPriority: 1 as PedagogicalPriority,

        // TaggedVocabWord
        id: `${courseId}_w${idx + 1}`,
        word_target: v.word,
        word_native: v.trad_fr,        // FR comme nativeLangue par défaut
        definition_target: v.definition_en,
        definition_native: v.definition_fr,
        example_target: v.example_en,
        example_native: v.example_fr,
        phonetic: v.phonetic_fr,
        imageUrl: adminImage || v.image || undefined,
        type: 'word',
        level: 'A1' as LevelCECRL,
        accepted_answers: [],
        is_grc: false,
      });
    });
  }

  return words;
}

// --- Build règles de grammaire taguées depuis JSON ---
function buildTaggedGrammarRules(): TaggedGrammarRule[] {
  const courses = bankA1CoursesRaw as RawCourse[];
  const rules: TaggedGrammarRule[] = [];

  for (const course of courses) {
    if (!course.rule?.en) continue;

    const courseId = `en_${course.id}`;
    const blockId = `bloc_${course.bloc}`;

    rules.push({
      langueId: 'en',
      pathId: ['A', 'B', 'C', 'A+C', 'B+C'] as PathId[],
      blockId,
      courseId,

      id: `${courseId}_rule`,
      rule_name: course.title,
      definition_native: course.rule.fr,
      definition_target: course.rule.en,
      examples: [],
      level: 'A1' as LevelCECRL,
    });
  }

  return rules;
}

// --- Singleton stores ---
let _vocabulary: TaggedVocabWord[] | null = null;
let _grammarRules: TaggedGrammarRule[] | null = null;

export function getAllVocabulary(): TaggedVocabWord[] {
  if (!_vocabulary) {
    _vocabulary = buildTaggedVocabulary();
    logStore('vocabulary built', { count: _vocabulary.length });
  }
  return _vocabulary;
}

export function getAllGrammarRules(): TaggedGrammarRule[] {
  if (!_grammarRules) {
    _grammarRules = buildTaggedGrammarRules();
    logStore('grammarRules built', { count: _grammarRules.length });
  }
  return _grammarRules;
}

// --- Placeholder stores pour les types pas encore dans le JSON ---
// Seront populés depuis bankGrammar.ts, bankReading.ts, etc. en Phase 2
export function getAllGrammarExercises(): TaggedGrammarExercise[] {
  logStore('grammarExercises: placeholder (Phase 2)');
  return [];
}

export function getAllReadingTexts(): TaggedReadingText[] {
  logStore('readingTexts: placeholder (Phase 2)');
  return [];
}

export function getAllSpeakingExercises(): TaggedSpeakingExercise[] {
  logStore('speakingExercises: placeholder (Phase 2)');
  return [];
}

export function getAllWritingExercises(): TaggedWritingExercise[] {
  logStore('writingExercises: placeholder (Phase 2)');
  return [];
}

// --- Requêtes filtrées ---

/** Vocabulaire pour un cours spécifique */
export function getVocabularyForCourse(courseId: string): TaggedVocabWord[] {
  return getAllVocabulary().filter(w => w.courseId === courseId);
}

/** Vocabulaire pour une langue */
export function getVocabularyForLangue(langueId: LangueId): TaggedVocabWord[] {
  return getAllVocabulary().filter(w => w.langueId === langueId);
}

/** Règle de grammaire pour un cours */
export function getGrammarRuleForCourse(courseId: string): TaggedGrammarRule | null {
  return getAllGrammarRules().find(r => r.courseId === courseId) || null;
}

/** Vocabulaire par IDs (pour COURSE_CONTENT_MAP) */
export function getVocabularyByIds(ids: string[]): TaggedVocabWord[] {
  const idSet = new Set(ids);
  return getAllVocabulary().filter(w => idSet.has(w.id));
}

/** Recherche dictionnaire (searchDictionary) */
export function searchVocabulary(query: string, langueId: LangueId): TaggedVocabWord[] {
  const q = query.toLowerCase().trim();
  if (!q) return [];

  return getAllVocabulary().filter(w =>
    w.langueId === langueId && (
      w.word_target.toLowerCase().includes(q) ||
      w.word_native.toLowerCase().includes(q) ||
      w.definition_target.toLowerCase().includes(q)
    )
  );
}

// --- Invalidation du cache (après import admin) ---
export function invalidateContentCache(): void {
  _vocabulary = null;
  _grammarRules = null;
  logStore('cache invalidated');
}
