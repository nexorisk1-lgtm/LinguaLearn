// ==========================================
// LINGUALEARN - Banque Vocabulaire V4
// BUG-77: Purge TOTALE des mots mockés legacy
// Source unique: 40 cours V4 (bankA1Courses.json) = 298 mots
// ==========================================

import { VocabWord } from './bankTypes';
import { BANK_A1_COURSES, getA1CourseVocabulary } from './bankA1Courses';

// Build BANK_VOCABULARY dynamically from V4 courses ONLY
// No more legacy mocked words (train, plage, lentement, etc.)
const buildV4Vocabulary = (): VocabWord[] => {
  const allWords: VocabWord[] = [];
  for (const course of BANK_A1_COURSES) {
    allWords.push(...getA1CourseVocabulary(course.id));
  }
  return allWords;
};

export const BANK_VOCABULARY: VocabWord[] = buildV4Vocabulary();
