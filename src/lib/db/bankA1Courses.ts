// ==========================================
// A1 COURSE BANK — 25 real courses from lingualearn_bank_a1.json
// ==========================================

import bankData from './bankA1Courses.json';
import { VocabWord, GrammarExercise } from './bankTypes';

export interface A1CourseVocabWord {
  word: string;
  definition_en: string;
  definition_fr: string;
  example_en: string;
  example_fr: string;
}

export interface A1CourseData {
  id: string;
  bloc: number;
  title: string;
  type: string;
  rule: { en: string; fr: string };
  examples: { en: string; fr: string }[];
  vocabulary: A1CourseVocabWord[];
}

export const BANK_A1_COURSES: A1CourseData[] = bankData as A1CourseData[];

/**
 * Get course data by courseId (e.g. 'a1_c1' → 'a1_c25')
 */
export function getA1CourseData(courseId: string): A1CourseData | null {
  return BANK_A1_COURSES.find(c => c.id === courseId) || null;
}

/**
 * Get vocabulary for a specific A1 course, converted to VocabWord-compatible format.
 * word_fr = definition_fr (the French definition doubles as the "translation")
 */
export function getA1CourseVocabulary(courseId: string): VocabWord[] {
  const course = getA1CourseData(courseId);
  if (!course) return [];
  return course.vocabulary.map((v, idx) => ({
    id: `${courseId}_v${idx}`,
    language: 'en',
    word_target: v.word,
    word_fr: v.definition_fr,
    definition_en: v.definition_en,
    definition_fr: v.definition_fr,
    definition_lang: v.definition_fr,
    example_en: v.example_en,
    example_fr: v.example_fr,
    theme: 'A1-course',
    level: 'A1',
    type: 'word',
    phonetic: '',
    is_grc: false,
    accepted_answers: [v.word],
  }));
}

/**
 * Generate grammar exercises from a course's rule + examples + vocabulary.
 * Produces fill-the-blank / QCM exercises using course data.
 */
export function getA1CourseGrammarExercises(courseId: string): GrammarExercise[] {
  const course = getA1CourseData(courseId);
  if (!course) return [];
  const exercises: GrammarExercise[] = [];

  // 1. Translation QCM from examples
  course.examples.forEach((ex, idx) => {
    exercises.push({
      id: `${courseId}_gex_${idx}`,
      grammar_rule_id: courseId,
      type: 'multiple_choice',
      question: `Traduisez : "${ex.fr}"`,
      answer: ex.en,
      options: [ex.en, ...generateExampleDistractors(ex.en, course.examples, idx)],
    });
  });

  // 2. Vocabulary-based QCM: "What does X mean?"
  const vocabSlice = course.vocabulary.slice(0, Math.min(6, course.vocabulary.length));
  vocabSlice.forEach((v, idx) => {
    const correctDef = v.definition_fr;
    const distractorPool = course.vocabulary
      .filter((_, i) => i !== idx)
      .map(d => d.definition_fr)
      .sort(() => Math.random() - 0.5)
      .slice(0, 3);
    exercises.push({
      id: `${courseId}_gvq_${idx}`,
      grammar_rule_id: courseId,
      type: 'multiple_choice',
      question: `Que signifie "${v.word}" ?`,
      answer: correctDef,
      options: [correctDef, ...distractorPool].sort(() => Math.random() - 0.5),
    });
  });

  // 3. Sentence completion from example_en (fill blank with target word)
  course.vocabulary.slice(0, 4).forEach((v, idx) => {
    if (v.example_en.toLowerCase().includes(v.word.toLowerCase())) {
      const blanked = v.example_en.replace(
        new RegExp(v.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'),
        '______'
      );
      const distractors = course.vocabulary
        .filter((_, i) => i !== idx)
        .map(d => d.word)
        .sort(() => Math.random() - 0.5)
        .slice(0, 3);
      exercises.push({
        id: `${courseId}_gfb_${idx}`,
        grammar_rule_id: courseId,
        type: 'fill_blank',
        question: blanked,
        answer: v.word,
        options: [v.word, ...distractors].sort(() => Math.random() - 0.5),
      });
    }
  });

  return exercises;
}

function generateExampleDistractors(correct: string, allExamples: { en: string; fr: string }[], skipIdx: number): string[] {
  const others = allExamples.filter((_, i) => i !== skipIdx).map(e => e.en);
  // Add some generic distractors if not enough examples
  const fallbacks = [
    'I am very happy today.',
    'She is a good student.',
    'They are going to school.',
    'We don\'t have any pets.',
  ].filter(f => f !== correct);
  return [...others, ...fallbacks].slice(0, 3);
}
