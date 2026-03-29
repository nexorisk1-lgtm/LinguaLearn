// ==========================================
// LINGUALEARN ENGINE — Couche E : ContentEngine
// Architecture V2.1.1 — Moteur de décision central
// 5 fonctions publiques — source de vérité unique
// ==========================================

import type {
  LangueId,
  AvailableContent,
  TrainingContent,
  ModuleBlock,
  UnlockedModules,
  RecommendedStep,
  LearningState,
  TaggedVocabWord,
} from './types';
import { PATH_MODULES as MODULES } from './types';
import type { UserProfile } from './userProfile';
import type { EngineProgress } from './userProgress';
import {
  getCourseContentMap,
  getCourseDefinitions,
  getCourseById,
} from './courseRegistry';
import {
  getVocabularyByIds,
  getGrammarRuleForCourse,
  getAllGrammarExercises,
  getAllReadingTexts,
  getAllSpeakingExercises,
  getAllWritingExercises,
  searchVocabulary,
} from './contentStore';

// --- Logging ---
function logEngine(fn: string, data?: unknown): void {
  console.log(`[Engine:ContentEngine:${fn}]`, data ?? '');
}

// ===========================================
// FONCTION 1 : getAvailableContent
// Retourne le contenu disponible pour un cours
// Filtre par langueId + courseId + user progress
// ===========================================
export function getAvailableContent(
  profile: UserProfile,
  progress: EngineProgress,
  courseId: string
): AvailableContent {
  logEngine('getAvailableContent', { courseId, langueId: profile.activeLang });

  const contentMap = getCourseContentMap();
  const content = contentMap[courseId];

  // FAIL FAST : cours introuvable
  if (!content) {
    console.error(`[Engine:ContentEngine] Course not found: ${courseId}`);
    return {
      vocabulary: [],
      grammar: [],
      grammarExercises: [],
      reading: [],
      speaking: [],
      writing: [],
      empty: true,
      reason: 'no_content_for_language',
      action: 'select_language',
    };
  }

  // Vérifier que le cours est pour la bonne langue
  if (content.langueId !== profile.activeLang) {
    console.error(`[Engine:ContentEngine] Language mismatch: course=${content.langueId}, active=${profile.activeLang}`);
    return {
      vocabulary: [],
      grammar: [],
      grammarExercises: [],
      reading: [],
      speaking: [],
      writing: [],
      empty: true,
      reason: 'no_content_for_language',
      action: 'select_language',
    };
  }

  // Récupérer vocabulaire par IDs depuis contentStore
  const vocabulary = getVocabularyByIds(content.vocabularyIds);

  // Récupérer grammaire
  const grammarRule = content.grammarRuleId
    ? getGrammarRuleForCourse(courseId)
    : null;
  const grammar = grammarRule ? [grammarRule] : [];

  // Exercices (seront populés en Phase 2)
  const grammarExercises = getAllGrammarExercises().filter(e => e.courseId === courseId);
  const reading = getAllReadingTexts().filter(t => t.courseId === courseId);
  const speaking = getAllSpeakingExercises().filter(e => e.courseId === courseId);
  const writing = getAllWritingExercises().filter(e => e.courseId === courseId);

  const result: AvailableContent = {
    vocabulary,
    grammar,
    grammarExercises,
    reading,
    speaking,
    writing,
    empty: vocabulary.length === 0 && grammar.length === 0,
  };

  if (result.empty) {
    result.reason = 'no_content_for_language';
    result.action = 'select_language';
  }

  logEngine('getAvailableContent:result', {
    courseId,
    vocabCount: vocabulary.length,
    grammarCount: grammar.length,
    empty: result.empty,
  });

  return result;
}

// ===========================================
// FONCTION 2 : getNextTraining
// Retourne le contenu d'entraînement
// Mode guidé = cours complétés uniquement
// Mode libre = cours 1-3, hors scoring
// ===========================================
export function getNextTraining(
  profile: UserProfile,
  progress: EngineProgress,
  mode: 'guided' | 'free'
): TrainingContent {
  logEngine('getNextTraining', { mode, langueId: profile.activeLang });

  const contentMap = getCourseContentMap();

  if (mode === 'guided') {
    // Mode guidé : seulement les mots des cours complétés
    const completedCourseIds = progress.completedCourses.map(c => c.courseId);

    if (completedCourseIds.length === 0) {
      return {
        words: [],
        rules: [],
        exercises: [],
        modeLabel: 'Mode guidé',
        empty: true,
        reason: 'Termine ton premier cours pour débloquer l\'entraînement guidé.',
      };
    }

    const allWords: TaggedVocabWord[] = [];
    for (const cId of completedCourseIds) {
      const content = contentMap[cId];
      if (content) {
        allWords.push(...getVocabularyByIds(content.vocabularyIds));
      }
    }

    // Prioriser les mots faibles (fragile, review_due, in_progress)
    const prioritized = allWords.sort((a, b) => {
      const stateA = progress.wordStates[a.id] || 'new';
      const stateB = progress.wordStates[b.id] || 'new';
      const priority: Record<string, number> = {
        fragile: 0, review_due: 1, in_progress: 2, seen: 3, new: 4, learned: 5, mastered: 6,
      };
      return (priority[stateA] ?? 4) - (priority[stateB] ?? 4);
    });

    return {
      words: prioritized,
      rules: [],
      exercises: [],
      modeLabel: 'Mode guidé',
      empty: false,
    };
  }

  // Mode libre : cours 1-3 uniquement, hors scoring
  const freeCourseIds = Object.keys(contentMap)
    .filter(cId => {
      const def = getCourseById(cId);
      return def && def.langueId === profile.activeLang && def.order <= 3;
    });

  const freeWords: TaggedVocabWord[] = [];
  for (const cId of freeCourseIds) {
    const content = contentMap[cId];
    if (content) {
      freeWords.push(...getVocabularyByIds(content.vocabularyIds));
    }
  }

  return {
    words: freeWords,
    rules: [],
    exercises: [],
    modeLabel: 'Mode exploration — hors progression',
    empty: freeWords.length === 0,
    reason: freeWords.length === 0 ? 'Aucun contenu disponible pour cette langue.' : undefined,
  };
}

// ===========================================
// FONCTION 3 : getUnlockedModules
// Retourne les modules disponibles selon le parcours
// Parcours B → pas d'écrit
// ===========================================
export function getUnlockedModules(
  profile: UserProfile,
  progress: EngineProgress
): UnlockedModules {
  const pathId = profile.pathByLang[profile.activeLang] || 'A';
  const allowedModules = MODULES[pathId] || MODULES['A'];

  logEngine('getUnlockedModules', { pathId, modules: allowedModules });

  const modules: ModuleBlock[] = allowedModules.map(mod => {
    const percent = progress.modulePercent[mod] || 0;
    const masteryPercent = progress.moduleMasteryPercent[mod] || 0;

    let state: LearningState = 'locked';
    if (masteryPercent >= 90) state = 'mastered';
    else if (percent >= 100) state = 'completed';
    else if (percent > 0) state = 'in_progress';
    else state = 'unlocked'; // Tous déverrouillés au sein d'un parcours

    return {
      id: mod,
      state,
      percent,
      masteryPercent,
    };
  });

  return {
    modules,
    progressBars: modules,
  };
}

// ===========================================
// FONCTION 4 : getRecommendedNextStep
// Retourne la prochaine action recommandée
// Priorité : révision > cours suivant > coach > pratique
// ===========================================
export function getRecommendedNextStep(
  profile: UserProfile,
  progress: EngineProgress
): RecommendedStep {
  logEngine('getRecommendedNextStep', { langueId: profile.activeLang });

  // 1. Révisions dues ?
  const dueRevisions = progress.reviewItems.filter(r => {
    const dueDate = new Date(r.nextReviewDate);
    return dueDate <= new Date();
  });

  if (dueRevisions.length > 0) {
    return {
      type: 'revision',
      reason: `${dueRevisions.length} révision(s) en attente`,
      priority: 1,
    };
  }

  // 2. Prochain cours à faire ?
  const definitions = getCourseDefinitions().filter(
    d => d.langueId === profile.activeLang
  );

  // Trouver le dernier cours complété
  const completedIds = new Set(progress.completedCourses.map(c => c.courseId));
  const nextCourse = definitions
    .sort((a, b) => a.order - b.order)
    .find(d => !completedIds.has(d.courseId));

  if (nextCourse) {
    return {
      type: 'course',
      courseId: nextCourse.courseId,
      reason: `Cours suivant : ${nextCourse.title.fr || nextCourse.title.en}`,
      priority: 1,
    };
  }

  // 3. Pratique
  return {
    type: 'practice',
    reason: 'Tous les cours sont terminés. Continue à t\'entraîner !',
    priority: 3,
  };
}

// ===========================================
// FONCTION 5 : searchDictionary
// Recherche dans le vocabulaire tagué
// ===========================================
export function searchDictionary(
  query: string,
  langueId: LangueId
): TaggedVocabWord[] {
  logEngine('searchDictionary', { query, langueId });
  return searchVocabulary(query, langueId);
}
