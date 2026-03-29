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
