'use client';

import {
  VocabWord,
  GrammarRule,
  GrammarExercise,
  IrregularVerb,
  ReadingText,
  WritingExercise,
  SpeakingExercise,
  PersonalVocab,
  ProposedWord,
} from './bankTypes';
import { BANK_VOCABULARY } from './bankVocabulary';
import { BANK_GRAMMAR, BANK_GRAMMAR_EXERCISES, BANK_IRREGULAR_VERBS } from './bankGrammar';
import { BANK_READING } from './bankReading';
import { BANK_WRITING } from './bankWriting';
import { BANK_SPEAKING } from './bankSpeaking';

// Re-export BANK_VERB_EXERCISES for convenience
export { BANK_VERB_EXERCISES } from './bankGrammar';

// ==========================================
// LEVEL HELPERS
// ==========================================

export function levelIndex(level: string): number {
  const levelMap: Record<string, number> = {
    A1: 0,
    A2: 1,
    B1: 2,
    B2: 3,
    C1: 4,
    C2: 5,
  };
  return levelMap[level.toUpperCase()] ?? -1;
}

export function isLevelAtMost(level: string, maxLevel: string): boolean {
  const levelNum = levelIndex(level);
  const maxLevelNum = levelIndex(maxLevel);
  return levelNum !== -1 && maxLevelNum !== -1 && levelNum <= maxLevelNum;
}

// ==========================================
// VOCABULARY FILTERING
// ==========================================

export function getVocabulary(language: string, themes: string[], maxLevel: string): VocabWord[] {
  return BANK_VOCABULARY.filter((word) => {
    const languageMatch = word.language === language;
    const themeMatch = themes.length === 0 || themes.includes(word.theme);
    const levelMatch = isLevelAtMost(word.level, maxLevel);
    return languageMatch && themeMatch && levelMatch;
  });
}

// ==========================================
// GRAMMAR FILTERING
// ==========================================

export function getGrammarRules(language: string, maxLevel: string): GrammarRule[] {
  return BANK_GRAMMAR.filter((rule) => {
    const languageMatch = rule.language === language;
    const levelMatch = isLevelAtMost(rule.level, maxLevel);
    return languageMatch && levelMatch;
  });
}

export function getExercisesForRule(ruleId: string): GrammarExercise[] {
  return BANK_GRAMMAR_EXERCISES.filter((exercise) => exercise.grammar_rule_id === ruleId);
}

export function getIrregularVerbs(): IrregularVerb[] {
  return BANK_IRREGULAR_VERBS;
}

// ==========================================
// READING FILTERING
// ==========================================

export function getReadingTexts(language: string, themes: string[], maxLevel: string): ReadingText[] {
  return BANK_READING.filter((text) => {
    const languageMatch = text.language === language;
    const themeMatch = themes.length === 0 || themes.includes(text.theme);
    const levelMatch = isLevelAtMost(text.level, maxLevel);
    return languageMatch && themeMatch && levelMatch;
  });
}

// ==========================================
// WRITING FILTERING
// ==========================================

export function getWritingExercises(language: string, themes: string[], maxLevel: string): WritingExercise[] {
  return BANK_WRITING.filter((exercise) => {
    const languageMatch = exercise.language === language;
    const themeMatch = themes.length === 0 || themes.includes(exercise.theme);
    const levelMatch = isLevelAtMost(exercise.level, maxLevel);
    return languageMatch && themeMatch && levelMatch;
  });
}

// ==========================================
// SPEAKING FILTERING
// ==========================================

export function getSpeakingExercises(language: string, themes: string[], maxLevel: string): SpeakingExercise[] {
  return BANK_SPEAKING.filter((exercise) => {
    const languageMatch = exercise.language === language;
    const themeMatch = themes.length === 0 || themes.includes(exercise.theme);
    const levelMatch = isLevelAtMost(exercise.level, maxLevel);
    return languageMatch && themeMatch && levelMatch;
  });
}

// ==========================================
// PERSONAL VOCABULARY (localStorage)
// ==========================================

export function getPersonalVocab(userId: string): PersonalVocab[] {
  try {
    const key = `lingualearn_personal_vocab_${userId}`;
    const data = typeof window !== 'undefined' ? localStorage.getItem(key) : null;
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function addToPersonalVocab(userId: string, wordId: string, status?: 'learned' | 'in_progress' | 'to_review'): void {
  if (typeof window === 'undefined') return;

  const key = `lingualearn_personal_vocab_${userId}`;
  const vocab = getPersonalVocab(userId);

  const existing = vocab.find(item => item.wordId === wordId);
  if (existing) {
    // Update status if provided
    if (status) existing.status = status;
    localStorage.setItem(key, JSON.stringify(vocab));
  } else {
    vocab.push({
      wordId,
      userId,
      addedAt: new Date().toISOString(),
      status: status || 'in_progress',
    });
    localStorage.setItem(key, JSON.stringify(vocab));
  }
}

export function removeFromPersonalVocab(userId: string, wordId: string): void {
  if (typeof window === 'undefined') return;

  const key = `lingualearn_personal_vocab_${userId}`;
  const vocab = getPersonalVocab(userId);
  const filtered = vocab.filter((item) => item.wordId !== wordId);
  localStorage.setItem(key, JSON.stringify(filtered));
}

export function isInPersonalVocab(userId: string, wordId: string): boolean {
  const vocab = getPersonalVocab(userId);
  return vocab.some((item) => item.wordId === wordId);
}

// ==========================================
// PROPOSED WORDS (localStorage)
// ==========================================

export function getProposedWords(userId: string): ProposedWord[] {
  try {
    const data = typeof window !== 'undefined' ? localStorage.getItem('lingualearn_proposed_words') : null;
    if (!data) return [];

    const allProposed: ProposedWord[] = JSON.parse(data);
    return allProposed.filter((word) => word.userId === userId);
  } catch {
    return [];
  }
}

export function proposeWord(
  userId: string,
  word: Omit<ProposedWord, 'id' | 'userId' | 'status' | 'createdAt'>
): void {
  if (typeof window === 'undefined') return;

  const allProposed = getAllProposedWords();
  const newWord: ProposedWord = {
    ...word,
    id: `proposed_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    userId,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };

  allProposed.push(newWord);
  localStorage.setItem('lingualearn_proposed_words', JSON.stringify(allProposed));
}

export function getAllProposedWords(): ProposedWord[] {
  try {
    const data = typeof window !== 'undefined' ? localStorage.getItem('lingualearn_proposed_words') : null;
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

// ==========================================
// LEVENSHTEIN DISTANCE (for writing tolerance)
// ==========================================

export function levenshteinDistance(a: string, b: string): number {
  const aStr = a.toLowerCase().trim();
  const bStr = b.toLowerCase().trim();

  if (aStr.length === 0) return bStr.length;
  if (bStr.length === 0) return aStr.length;

  const matrix: number[][] = Array.from({ length: bStr.length + 1 }, () =>
    Array.from({ length: aStr.length + 1 }, () => 0)
  );

  for (let i = 0; i <= aStr.length; i++) {
    matrix[0][i] = i;
  }

  for (let j = 0; j <= bStr.length; j++) {
    matrix[j][0] = j;
  }

  for (let j = 1; j <= bStr.length; j++) {
    for (let i = 1; i <= aStr.length; i++) {
      const cost = aStr[i - 1] === bStr[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1, // deletion
        matrix[j - 1][i] + 1, // insertion
        matrix[j - 1][i - 1] + cost // substitution
      );
    }
  }

  return matrix[bStr.length][aStr.length];
}

// BUG-45b (V3.9): Auto-tolerance based on word length
// 1-6 chars = exact, 7-10 chars = Levenshtein ≤ 1, 11+ chars = Levenshtein ≤ 2
function getAutoTolerance(expectedLength: number): number {
  if (expectedLength <= 6) return 0;
  if (expectedLength <= 10) return 1;
  return 2;
}

export function isCloseEnough(input: string, expected: string, tolerance?: number): boolean {
  // BUG-45: Always normalize to lowercase + trim before comparing
  const normalizedInput = input.trim().toLowerCase();
  const normalizedExpected = expected.trim().toLowerCase();
  if (normalizedInput === normalizedExpected) return true;
  // BUG-45b: If no tolerance specified, use auto-tolerance based on expected word length
  const effectiveTolerance = tolerance !== undefined ? tolerance : getAutoTolerance(normalizedExpected.length);
  if (effectiveTolerance === 0) return false;
  const distance = levenshteinDistance(normalizedInput, normalizedExpected);
  return distance <= effectiveTolerance;
}

// ==========================================
// TEXT-TO-SPEECH HELPER
// ==========================================

export function speakText(text: string, language: string): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

  // Cancel any ongoing speech
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);

  // Map language codes to language URIs
  const languageMap: Record<string, string> = {
    en: 'en-US',
    es: 'es-ES',
    fr: 'fr-FR',
    de: 'de-DE',
    it: 'it-IT',
    pt: 'pt-PT',
    ru: 'ru-RU',
    ja: 'ja-JP',
    zh: 'zh-CN',
  };

  utterance.lang = languageMap[language] || language;
  utterance.rate = 1;
  utterance.pitch = 1;
  utterance.volume = 1;

  window.speechSynthesis.speak(utterance);
}
