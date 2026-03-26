// ==========================================
// A1 COURSE BANK — 40 courses from LinguaLearn_A1_FINAL_V4
// ==========================================

import bankData from './bankA1Courses.json';
import { VocabWord, GrammarExercise } from './bankTypes';

export interface A1CourseVocabWord {
  word: string;
  trad_fr: string;
  phonetic_fr: string;
  definition_en: string;
  definition_fr: string;
  example_en: string;
  example_fr: string;
  image: string;
}

export interface A1CourseData {
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
  examples: { en: string; fr: string }[];
  vocabulary: A1CourseVocabWord[];
}

export const BANK_A1_COURSES: A1CourseData[] = bankData as unknown as A1CourseData[];

/**
 * Get course data by courseId (e.g. 'a1_c1' → 'a1_c40')
 */
export function getA1CourseData(courseId: string): A1CourseData | null {
  return BANK_A1_COURSES.find(c => c.id === courseId) || null;
}

/**
 * Get vocabulary for a specific A1 course, converted to VocabWord-compatible format.
 * word_fr = trad_fr (the French translation), phonetic from V4 data.
 */
// BUG-74: FR synonyms for words with multiple valid translations
const FR_SYNONYMS: Record<string, string[]> = {
  'please': ["s'il vous plaît", "s'il te plaît", "s'il vous plait", "s'il te plait", "svp"],
  'hello': ['bonjour', 'salut', 'coucou'],
  'hi': ['salut', 'bonjour', 'coucou'],
  'goodbye': ['au revoir', 'salut', 'à bientôt', 'a bientot'],
  'see you': ['à bientôt', 'a bientot', 'à plus', 'salut'],
  'thank you': ['merci', 'merci beaucoup'],
  'thanks': ['merci', 'merci beaucoup'],
  'sorry': ['pardon', 'désolé', 'desole', 'excusez-moi'],
  'excuse me': ['excusez-moi', 'pardon', 'désolé'],
  'yes': ['oui', 'ouais'],
  'no': ['non'],
  'welcome': ['bienvenue', 'de rien'],
  'good morning': ['bonjour', 'bon matin'],
  'good evening': ['bonsoir'],
  'bathroom': ['salle de bain', 'toilettes', 'wc'],
  'shop': ['magasin', 'boutique'],
  'car': ['voiture', 'auto', 'automobile'],
  'phone': ['téléphone', 'portable', 'telephone'],
  'happy': ['content', 'heureux', 'joyeux'],
  'big': ['grand', 'gros', 'grande'],
  'small': ['petit', 'petite'],
  'nice': ['gentil', 'agréable', 'sympathique'],
  'food': ['nourriture', 'repas', 'alimentation'],
  'pretty': ['joli', 'jolie', 'beau', 'belle'],
  'fast': ['rapide', 'vite'],
  'movie': ['film', 'cinéma'],
};

export function getA1CourseVocabulary(courseId: string): VocabWord[] {
  const course = getA1CourseData(courseId);
  if (!course) return [];
  return course.vocabulary.map((v, idx) => {
    const key = v.word.toLowerCase();
    const frSynonyms = FR_SYNONYMS[key] || [];
    // Build accepted_answers: target word + FR trad + FR synonyms (deduplicated)
    const acceptedFr = new Set([v.trad_fr.toLowerCase(), ...frSynonyms.map(s => s.toLowerCase())]);
    return {
      id: `${courseId}_v${idx}`,
      language: 'en',
      word_target: v.word,
      word_fr: v.trad_fr,
      definition_en: v.definition_en,
      definition_fr: v.trad_fr,
      definition_lang: v.trad_fr,
      example_en: v.example_en,
      example_fr: v.example_fr,
      theme: 'A1-course',
      level: 'A1',
      type: 'word',
      phonetic: v.phonetic_fr,
      is_grc: false,
      accepted_answers: [v.word, ...Array.from(acceptedFr)],
      image: v.image || '',
    };
  });
}

/**
 * Generate grammar exercises from a course's rule + vocabulary.
 * Produces QCM + fill-blank exercises using course data.
 * Difficulty labels: Facile / Intermédiaire / Difficile
 */
export function getA1CourseGrammarExercises(courseId: string): GrammarExercise[] {
  const course = getA1CourseData(courseId);
  if (!course) return [];
  const exercises: GrammarExercise[] = [];

  // 1. Vocabulary-based QCM: "What does X mean?" (⭐⭐ Intermédiaire)
  const vocabSlice = course.vocabulary.slice(0, Math.min(6, course.vocabulary.length));
  vocabSlice.forEach((v, idx) => {
    const correctDef = v.trad_fr;
    const distractorPool = course.vocabulary
      .filter((_, i) => i !== idx)
      .map(d => d.trad_fr)
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

  // 2. Sentence completion from example_en (fill blank with target word) (⭐⭐ Intermédiaire)
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

  // 3. Translation QCM: example_fr → example_en (⭐⭐ Intermédiaire)
  course.vocabulary.slice(0, 3).forEach((v, idx) => {
    const distractors = course.vocabulary
      .filter((_, i) => i !== idx)
      .map(d => d.example_en)
      .sort(() => Math.random() - 0.5)
      .slice(0, 3);
    exercises.push({
      id: `${courseId}_gtq_${idx}`,
      grammar_rule_id: courseId,
      type: 'multiple_choice',
      question: `Traduisez : "${v.example_fr}"`,
      answer: v.example_en,
      options: [v.example_en, ...distractors].sort(() => Math.random() - 0.5),
    });
  });

  return exercises;
}
