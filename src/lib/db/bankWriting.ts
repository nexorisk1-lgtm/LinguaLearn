// ==========================================
// LINGUALEARN - Writing Exercises Bank
// Exercices d'écriture (Écrit)
// ==========================================

import type { WritingExercise } from './bankTypes';

export const BANK_WRITING: WritingExercise[] = [
  // ============================================
  // ENGLISH - TRAVEL THEME
  // ============================================

  // A1 Travel
  {
    id: 'wr_en_01',
    language: 'en',
    level: 'A1',
    theme: 'travel',
    type: 'translation',
    instruction_fr: 'Traduisez la phrase suivante en anglais.',
    instruction_en: 'Translate the following sentence into English.',
    prompt: 'Je vais à Paris demain.',
    answer: 'I am going to Paris tomorrow.'
  },
  {
    id: 'wr_en_02',
    language: 'en',
    level: 'A1',
    theme: 'travel',
    type: 'completion',
    instruction_fr: 'Complétez la phrase.',
    instruction_en: 'Complete the sentence.',
    prompt: 'I need a _____ to Paris.',
    answer: 'I need a ticket to Paris.'
  },

  // A2 Travel
  {
    id: 'wr_en_03',
    language: 'en',
    level: 'A2',
    theme: 'travel',
    type: 'translation',
    instruction_fr: 'Traduisez la phrase suivante en anglais.',
    instruction_en: 'Translate the following sentence into English.',
    prompt: 'Quel est le meilleur moyen de voyager entre les villes?',
    answer: 'What is the best way to travel between cities?'
  },
  {
    id: 'wr_en_04',
    language: 'en',
    level: 'A2',
    theme: 'travel',
    type: 'completion',
    instruction_fr: 'Complétez la phrase.',
    instruction_en: 'Complete the sentence.',
    prompt: 'When we arrived at the hotel, we _____ our luggage in the room.',
    answer: 'When we arrived at the hotel, we put our luggage in the room.'
  },

  // B1 Travel
  {
    id: 'wr_en_05',
    language: 'en',
    level: 'B1',
    theme: 'travel',
    type: 'translation',
    instruction_fr: 'Traduisez la phrase suivante en anglais.',
    instruction_en: 'Translate the following sentence into English.',
    prompt: 'Bien que le vol soit long, j\'ai apprécié les vues spectaculaires.',
    answer: 'Although the flight was long, I enjoyed the spectacular views.'
  },
  {
    id: 'wr_en_06',
    language: 'en',
    level: 'B1',
    theme: 'travel',
    type: 'free_writing',
    instruction_fr: 'Écrivez un court paragraphe sur votre destination de rêve.',
    instruction_en: 'Write a short paragraph about your dream destination.',
    prompt: 'Describe a place you would like to visit and explain why it interests you (4-5 sentences).'
  },

  // B2 Travel
  {
    id: 'wr_en_07',
    language: 'en',
    level: 'B2',
    theme: 'travel',
    type: 'translation',
    instruction_fr: 'Traduisez la phrase suivante en anglais.',
    instruction_en: 'Translate the following sentence into English.',
    prompt: 'Les voyageurs contemporains cherchent à minimiser leur empreinte écologique tout en explorant le monde.',
    answer: 'Contemporary travelers seek to minimize their ecological footprint while exploring the world.'
  },
  {
    id: 'wr_en_08',
    language: 'en',
    level: 'B2',
    theme: 'travel',
    type: 'completion',
    instruction_fr: 'Complétez la phrase de manière appropriée.',
    instruction_en: 'Complete the sentence appropriately.',
    prompt: 'If I _____ known about the local customs, I would have _____ my behavior accordingly.',
    answer: 'If I had known about the local customs, I would have adjusted my behavior accordingly.'
  },

  // ============================================
  // ENGLISH - MEETINGS THEME (Business/GRC)
  // ============================================

  // B1 Meetings
  {
    id: 'wr_en_09',
    language: 'en',
    level: 'B1',
    theme: 'meetings',
    type: 'completion',
    instruction_fr: 'Complétez le message professionnel.',
    instruction_en: 'Complete the professional message.',
    prompt: 'We need to _____ a meeting to discuss the quarterly results.',
    answer: 'We need to schedule a meeting to discuss the quarterly results.'
  },
  {
    id: 'wr_en_10',
    language: 'en',
    level: 'B1',
    theme: 'meetings',
    type: 'translation',
    instruction_fr: 'Traduisez la phrase suivante en anglais.',
    instruction_en: 'Translate the following sentence into English.',
    prompt: 'Veuillez confirmer votre disponibilité pour la réunion de demain à 14 heures.',
    answer: 'Please confirm your availability for tomorrow\'s meeting at 2 PM.'
  },

  // B2 Meetings
  {
    id: 'wr_en_11',
    language: 'en',
    level: 'B2',
    theme: 'meetings',
    type: 'free_writing',
    instruction_fr: 'Rédigez un résumé court de réunion.',
    instruction_en: 'Write a brief meeting summary.',
    prompt: 'Write a concise meeting summary covering: agenda items discussed, decisions made, and action items assigned.'
  },
  {
    id: 'wr_en_12',
    language: 'en',
    level: 'B2',
    theme: 'meetings',
    type: 'translation',
    instruction_fr: 'Traduisez la phrase suivante en anglais.',
    instruction_en: 'Translate the following sentence into English.',
    prompt: 'Conformément aux directives de gouvernance, nous devons documenter tous les points de décision.',
    answer: 'In accordance with governance guidelines, we must document all decision points.'
  },

  // ============================================
  // ENGLISH - RISK THEME (Business/GRC)
  // ============================================

  // B1 Risk
  {
    id: 'wr_en_13',
    language: 'en',
    level: 'B1',
    theme: 'risk',
    type: 'completion',
    instruction_fr: 'Complétez la phrase sur la gestion des risques.',
    instruction_en: 'Complete the sentence about risk management.',
    prompt: 'It is important to _____ risks before they become serious problems.',
    answer: 'It is important to identify risks before they become serious problems.'
  },
  {
    id: 'wr_en_14',
    language: 'en',
    level: 'B1',
    theme: 'risk',
    type: 'translation',
    instruction_fr: 'Traduisez la phrase suivante en anglais.',
    instruction_en: 'Translate the following sentence into English.',
    prompt: 'L\'analyse des risques doit être effectuée régulièrement.',
    answer: 'Risk analysis must be performed regularly.'
  },

  // B2 Risk
  {
    id: 'wr_en_15',
    language: 'en',
    level: 'B2',
    theme: 'risk',
    type: 'translation',
    instruction_fr: 'Traduisez la phrase suivante en anglais.',
    instruction_en: 'Translate the following sentence into English.',
    prompt: 'Les organisations doivent mettre en place des mécanismes de contrôle interne robustes pour atténuer les risques opérationnels.',
    answer: 'Organizations must implement robust internal control mechanisms to mitigate operational risks.'
  },
  {
    id: 'wr_en_16',
    language: 'en',
    level: 'B2',
    theme: 'risk',
    type: 'free_writing',
    instruction_fr: 'Rédigez un court rapport sur l\'évaluation des risques.',
    instruction_en: 'Write a brief risk assessment report.',
    prompt: 'Develop a concise risk assessment covering: identified risks, impact severity, probability of occurrence, and recommended mitigation strategies.'
  },

  // V2.1.1: Spanish A1 writing exercises removed — Phase 14 will add via CanonicalContent

  // ============================================
  // ENGLISH - FAMILY THEME
  // ============================================

  // A1 Family
  {
    id: 'wr_en_fam_01',
    language: 'en',
    level: 'A1',
    theme: 'family',
    type: 'completion',
    instruction_fr: 'Complète la phrase',
    instruction_en: 'Complete the sentence.',
    prompt: 'My ___ is a teacher.',
    answer: 'mother'
  },
  {
    id: 'wr_en_fam_02',
    language: 'en',
    level: 'A1',
    theme: 'family',
    type: 'completion',
    instruction_fr: 'Complète la phrase',
    instruction_en: 'Complete the sentence.',
    prompt: 'I have two ___ and one sister.',
    answer: 'brothers'
  },
  {
    id: 'wr_en_fam_03',
    language: 'en',
    level: 'A1',
    theme: 'family',
    type: 'translation',
    instruction_fr: 'Traduisez la phrase suivante en anglais.',
    instruction_en: 'Translate the following sentence into English.',
    prompt: 'Mon frère est grand.',
    answer: 'My brother is tall.'
  },
  {
    id: 'wr_en_fam_04',
    language: 'en',
    level: 'A1',
    theme: 'family',
    type: 'completion',
    instruction_fr: 'Complète la phrase',
    instruction_en: 'Complete the sentence.',
    prompt: 'My grandmother likes to ___ in the garden.',
    answer: 'work'
  },
  {
    id: 'wr_en_fam_05',
    language: 'en',
    level: 'A1',
    theme: 'family',
    type: 'free_writing',
    instruction_fr: 'Écris une phrase avec le mot "family"',
    instruction_en: 'Write a sentence with the word "family"',
    prompt: 'Écris une phrase avec le mot "family" / Write a sentence with the word "family"'
  },

  // V2.1.1: Spanish A2 writing exercises removed — Phase 14 will add via CanonicalContent
];
