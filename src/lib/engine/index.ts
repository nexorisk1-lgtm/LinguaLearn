// ==========================================
// LINGUALEARN ENGINE — Index (barrel export)
// Architecture V2.1.1 — Point d'entrée unique
// ==========================================

// --- Types ---
export type {
  LangueId,
  PathId,
  ContentRegister,
  LearningState,
  WordLearningState,
  ContentExposure,
  PedagogicalPriority,
  ContentTag,
  TaggedVocabWord,
  TaggedGrammarRule,
  TaggedGrammarExercise,
  TaggedReadingText,
  TaggedSpeakingExercise,
  TaggedWritingExercise,
  CourseDefinition,
  CourseContent,
  CourseCompletion,
  ReviewItem,
  AvailableContent,
  TrainingContent,
  ModuleBlock,
  UnlockedModules,
  RecommendedStep,
  EventType,
  EventLogEntry,
} from './types';
export { PATH_MODULES } from './types';

// --- Couche A : UserProfile ---
export type { UserProfile } from './userProfile';
export {
  getOrCreateProfile,
  getEngineProfile,
  saveEngineProfile,
  userToProfile,
  setActiveLangue,
  addLangue,
  setNativeLangue,
  updateLevel,
} from './userProfile';

// --- Couche B : UserProgress ---
export type { EngineProgress } from './userProgress';
export {
  getOrCreateProgress,
  getEngineProgress,
  saveEngineProgress,
  createEmptyProgress,
  updateWordState,
  updateCourseState,
  recordCourseCompletion,
  updateCoffreIndex,
  logEvent,
  getWeakWords,
  updateStreak,
  recalcModulePercents,
} from './userProgress';

// --- Couche C : CourseRegistry ---
export {
  getCourseDefinitions,
  getCourseContentMap,
  getCourseById,
  getCourseContent,
  getCoursesForLangueLevel,
  getCoursesForPath,
  getNextCourse,
  getAllVocabularyIds,
  getTotalWordCount,
} from './courseRegistry';

// --- Couche D : ContentStore ---
export {
  getAllVocabulary,
  getAllGrammarRules,
  getAllGrammarExercises,
  getAllReadingTexts,
  getAllSpeakingExercises,
  getAllWritingExercises,
  getVocabularyForCourse,
  getVocabularyForLangue,
  getGrammarRuleForCourse,
  getVocabularyByIds,
  searchVocabulary,
  invalidateContentCache,
  getLocalizedVocabulary,
  syncContentToCanonical,
} from './contentStore';
export type { ContentStatus, CanonicalContent, LocalizedContent } from './contentStore';

// --- Couche E : ContentEngine (5 fonctions publiques) ---
export {
  getAvailableContent,
  getNextTraining,
  getUnlockedModules,
  getRecommendedNextStep,
  searchDictionary,
} from './contentEngine';

// --- CoachEngine ---
export type { CoachMode, CoachConfig, CoachAdaptation } from './coachEngine';
export {
  COACH_MODES,
  getAvailableCoachModes,
  getCoachContext,
  getCoachAllowedContent,
  getCoachSessionPrompt,
} from './coachEngine';

// --- GamificationEngine ---
export type { ScoreType, ActivityType, LeaderboardEntry, TimerMode, BattleConfig } from './gamificationEngine';
export {
  awardPoints,
  getUserScore,
  getLeaderboard,
  getBattleConfig,
} from './gamificationEngine';

// --- RevisionEngine ---
export type { RevisionSummary } from './revisionEngine';
export {
  getDueRevisions,
  getRevisionQueue,
  getRevisionSummary,
  recordRevisionResult,
  pruneReviewItems,
} from './revisionEngine';

// --- TranslationStore (Phase 14) ---
export type {
  TranslationContentType,
  CanonicalEntry,
  LocalizedEntry,
  TranslationProgress,
} from './translationStore';
export {
  TARGET_LANGUAGES,
  ALL_CONTENT_LANGUAGES,
  getCanonicalEntries,
  registerCanonical,
  syncCanonicalFromContent,
  getLocalizedEntries,
  getLocalizedForLanguage,
  getLocalizedEntry,
  upsertLocalizedEntry,
  validateLocalizedEntry,
  rejectLocalizedEntry,
  getTranslationProgress,
  getValidatedTranslation,
  bulkImportTranslations,
  initializeEmptyLocalizations,
} from './translationStore';

// --- Migration ---
export {
  isMigrated,
  migrateUserData,
  ensureMigrated,
  cleanupLegacyKeys,
} from './migration';

// --- React Hook Bridge ---
export { useEngine } from './useEngine';
export type { EngineState } from './useEngine';
