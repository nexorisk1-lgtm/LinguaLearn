// ==========================================
// LINGUALEARN ENGINE — Couche C : CourseRegistry
// Architecture V2.1.1 — Registre des cours
// Source de vérité : COURSE_DEFINITIONS
// ==========================================

import type { LevelCECRL } from '@/types';
import type { LangueId, PathId, CourseDefinition, CourseContent } from './types';

// --- Import du JSON source ---
import bankA1CoursesRaw from '@/lib/db/bankA1Courses.json';

// --- Type pour le JSON brut ---
interface RawCourse {
  id: string;
  bloc: number;
  number: number;
  title: string;
  type: string;
  scenario: string;
  phrase_cle: string;
  objectif: string[];
  micro_reussite: string;
  rule: { en: string; fr: string };
  examples: unknown[];
  vocabulary: {
    word: string;
    trad_fr: string;
    phonetic_fr: string;
    definition_en: string;
    definition_fr: string;
    example_en: string;
    example_fr: string;
    image: string;
  }[];
}

// --- Logging ---
function logRegistry(action: string, data?: unknown): void {
  console.log(`[Engine:CourseRegistry] ${action}`, data ?? '');
}

// --- Générer courseId format V2.1.1 : en_a1_c1 ---
function toCourseId(langueId: LangueId, rawId: string): string {
  return `${langueId}_${rawId}`;
}

// --- Générer vocabId : en_a1_c1_w1 ---
function toVocabId(courseId: string, index: number): string {
  return `${courseId}_w${index + 1}`;
}

// --- Build COURSE_DEFINITIONS depuis JSON (40 cours EN A1) ---
function buildCourseDefinitions(): CourseDefinition[] {
  const courses = bankA1CoursesRaw as RawCourse[];
  return courses.map((raw) => ({
    courseId: toCourseId('en', raw.id),
    langueId: 'en' as LangueId,
    pathId: ['A', 'B', 'C', 'A+C', 'B+C'] as PathId[],  // A1 disponible pour tous
    level: 'A1' as LevelCECRL,
    blockId: `bloc_${raw.bloc}`,
    order: raw.number,
    title: { fr: raw.title, en: raw.title },
    prerequisite: raw.number > 1 ? toCourseId('en', `a1_c${raw.number - 1}`) : null,
    unlockScore: raw.number > 1 ? 60 : 0,  // Premier cours déverrouillé par défaut
    scenario: raw.scenario,
    objectif: raw.objectif,
  }));
}

// --- Build COURSE_CONTENT_MAP depuis JSON ---
function buildCourseContentMap(): Record<string, CourseContent> {
  const courses = bankA1CoursesRaw as RawCourse[];
  const map: Record<string, CourseContent> = {};

  for (const raw of courses) {
    const courseId = toCourseId('en', raw.id);
    const vocabularyIds = raw.vocabulary.map((_, idx) => toVocabId(courseId, idx));

    map[courseId] = {
      courseId,
      langueId: 'en',
      vocabularyIds,
      grammarRuleId: `${courseId}_rule`,
      grammarExerciseIds: [],   // Seront populés depuis bankGrammar.ts en Phase 2
      oralExerciseIds: [],       // Seront populés depuis bankSpeaking.ts en Phase 2
      readingTextIds: [],        // Seront populés depuis bankReading.ts en Phase 2
      writingExerciseIds: [],    // Seront populés depuis bankWriting.ts en Phase 2
      microReussite: { fr: raw.micro_reussite, en: raw.micro_reussite },
    };
  }

  return map;
}

// --- Singleton : définitions ---
let _definitions: CourseDefinition[] | null = null;
export function getCourseDefinitions(): CourseDefinition[] {
  if (!_definitions) {
    _definitions = buildCourseDefinitions();
    logRegistry('definitions built', { count: _definitions.length });
  }
  return _definitions;
}

// --- Singleton : content map ---
let _contentMap: Record<string, CourseContent> | null = null;
export function getCourseContentMap(): Record<string, CourseContent> {
  if (!_contentMap) {
    _contentMap = buildCourseContentMap();
    logRegistry('contentMap built', { count: Object.keys(_contentMap).length });
  }
  return _contentMap;
}

// --- Requêtes ---

/** Obtenir un cours par ID */
export function getCourseById(courseId: string): CourseDefinition | null {
  return getCourseDefinitions().find(c => c.courseId === courseId) || null;
}

/** Obtenir le contenu d'un cours */
export function getCourseContent(courseId: string): CourseContent | null {
  return getCourseContentMap()[courseId] || null;
}

/** Obtenir les cours pour une langue + niveau */
export function getCoursesForLangueLevel(langueId: LangueId, level: LevelCECRL): CourseDefinition[] {
  return getCourseDefinitions().filter(
    c => c.langueId === langueId && c.level === level
  );
}

/** Obtenir les cours pour un parcours spécifique */
export function getCoursesForPath(langueId: LangueId, pathId: PathId, level: LevelCECRL): CourseDefinition[] {
  return getCourseDefinitions().filter(
    c => c.langueId === langueId && c.level === level && c.pathId.includes(pathId)
  );
}

/** Obtenir le cours suivant (ordre séquentiel) */
export function getNextCourse(currentCourseId: string): CourseDefinition | null {
  const current = getCourseById(currentCourseId);
  if (!current) return null;

  return getCourseDefinitions().find(
    c => c.langueId === current.langueId &&
         c.level === current.level &&
         c.order === current.order + 1
  ) || null;
}

/** Obtenir tous les vocabularyIds pour une langue */
export function getAllVocabularyIds(langueId: LangueId): string[] {
  const map = getCourseContentMap();
  const ids: string[] = [];
  for (const [, content] of Object.entries(map)) {
    if (content.langueId === langueId) {
      ids.push(...content.vocabularyIds);
    }
  }
  return ids;
}

/** Compter le total de mots pour une langue */
export function getTotalWordCount(langueId: LangueId): number {
  return getAllVocabularyIds(langueId).length;
}
