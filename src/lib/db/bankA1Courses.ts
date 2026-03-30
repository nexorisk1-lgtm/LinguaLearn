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
 * P0-D: Given a French word (e.g. "salut"), returns all English words from the course
 * that are valid translations of it (using both trad_fr and FR_SYNONYMS).
 * Used for synonym validation in coach.
 */
export function getEnglishSynonymsForFrench(frenchWord: string, courseId: string): string[] {
  const course = getA1CourseData(courseId)
  if (!course) return []
  const frLower = frenchWord.toLowerCase().trim()
  const results: string[] = []
  for (const v of course.vocabulary) {
    const key = v.word.toLowerCase()
    // Direct match on trad_fr
    if (v.trad_fr.toLowerCase() === frLower) {
      results.push(v.word)
      continue
    }
    // Match via FR_SYNONYMS
    const syns = FR_SYNONYMS[key] || []
    if (syns.some(s => s.toLowerCase() === frLower)) {
      results.push(v.word)
    }
  }
  return results
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
    // BUG-85: Check admin-uploaded image in localStorage first
    let imageUrl = v.image || '';
    if (typeof window !== 'undefined') {
      try {
        const adminImage = localStorage.getItem(`lingualearn_vocab_image_${courseId}_${idx}`);
        if (adminImage) imageUrl = adminImage;
      } catch { /* ignore */ }
    }
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
      image: imageUrl,
    };
  });
}

// BUG-81: French translations of micro_reussite — interface language must match
const MICRO_REUSSITE_FR: Record<string, string> = {
  'a1_c1': 'Tu sais maintenant saluer en anglais ! 🎉',
  'a1_c2': 'Tu sais maintenant être poli en anglais ! 🙏',
  'a1_c3': 'Tu sais maintenant te présenter en anglais ! 🙌',
  'a1_c4': 'Tu sais maintenant faire la conversation en anglais ! 💬',
  'a1_c5': 'Tu sais maintenant demander de l\'aide en anglais ! 🆘',
  'a1_c6': 'Tu sais maintenant dire qui tu es en anglais ! ⭐',
  'a1_c7': 'Tu sais maintenant parler de ta famille en anglais ! 👨‍👩‍👧',
  'a1_c8': 'Tu sais maintenant décrire des personnes en anglais ! 👀',
  'a1_c9': 'Tu sais maintenant poser et répondre à des questions avec "to be" ! ❓',
  'a1_c10': 'Tu sais maintenant dire à qui appartient quoi ! 🎒',
  'a1_c11': 'Tu sais maintenant parler de toute ta famille ! 👴👵',
  'a1_c12': 'Tu sais maintenant utiliser les articles en anglais ! 📚',
  'a1_c13': 'Tu sais maintenant parler de quantités en anglais ! 🔢',
  'a1_c14': 'Tu sais maintenant exprimer tes actions quotidiennes en anglais ! ✅',
  'a1_c15': 'Tu sais maintenant parler de tes habitudes et routines ! 📅',
  'a1_c16': 'Tu sais maintenant poser des questions sur les habitudes ! ❓',
  'a1_c17': 'Tu sais maintenant dire ce que tu n\'aimes pas ! 🚫',
  'a1_c18': 'Tu sais maintenant poser n\'importe quelle question en anglais ! 🔍',
  'a1_c19': 'Tu sais maintenant décrire ta semaine ! 🗓️',
  'a1_c20': 'Tu sais maintenant faire des courses en anglais ! 🛒',
  'a1_c21': 'Tu sais maintenant commander au restaurant ! 🍕',
  'a1_c22': 'Tu sais maintenant utiliser les chiffres dans la vie réelle ! 🔢',
  'a1_c23': 'Tu sais maintenant décrire les objets avec des couleurs ! 🎨',
  'a1_c24': 'Tu sais maintenant parler de ce que tu as ! 🐾',
  'a1_c25': 'Tu sais maintenant utiliser les pronoms comme un natif ! 🔄',
  'a1_c26': 'Tu sais maintenant décrire ta maison en anglais ! 🏠',
  'a1_c27': 'Tu sais maintenant décrire où se trouvent les choses ! 📍',
  'a1_c28': 'Tu sais maintenant te repérer dans une ville ! 🗺️',
  'a1_c29': 'Tu sais maintenant fixer des rendez-vous en anglais ! ⏰',
  'a1_c30': 'Tu sais maintenant décrire des actions en cours ! 👀',
  'a1_c31': 'Tu sais maintenant parler des habitudes ET du moment présent ! 🔄',
  'a1_c32': 'Tu sais maintenant répondre vite et naturellement ! ⚡',
  'a1_c33': 'Tu sais maintenant dire à qui appartient quoi ! 👜',
  'a1_c34': 'Tu sais maintenant parler des transports ! 🚌',
  'a1_c35': 'Tu sais maintenant parler des dates et des saisons ! 📅',
  'a1_c36': 'Tu sais maintenant parler de la météo ! ☀️',
  'a1_c37': 'Tu sais maintenant parler de tes capacités ! 💪',
  'a1_c38': 'Tu sais maintenant donner des instructions et des directions ! 🗺️',
  'a1_c39': 'Tu sais maintenant préparer un voyage à l\'étranger ! ✈️',
  'a1_c40': 'Félicitations ! Tu sais maintenant communiquer en anglais au niveau A1 ! 🏆',
};

/**
 * Get micro-réussite text in the correct interface language
 */
export function getMicroReussite(courseId: string, interfaceLang: string): string | null {
  const course = getA1CourseData(courseId);
  if (!course?.micro_reussite) return null;
  if (interfaceLang === 'fr') {
    return MICRO_REUSSITE_FR[courseId] || course.micro_reussite;
  }
  return course.micro_reussite;
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
