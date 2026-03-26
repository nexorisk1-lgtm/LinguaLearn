'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentUser } from '@/lib/db/localStorage';
import { User, InterfaceLanguage, LearningLanguage, LearningPath } from '@/types';
import { Lock, Star, Trophy, MessageCircle } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import BottomNav from '@/components/BottomNav';

// ==========================================
// A1 CURRICULUM DATA (from Curriculum V4 — 40 courses)
// ==========================================

interface CourseItem {
  id: string;
  number: number; // 1-40 for courses, 0 for checkpoint/cert
  type: 'grammar' | 'vocabulary' | 'dialogue' | 'checkpoint' | 'revision' | 'certification' | 'communication';
  titleFr: string;
  titleEn: string;
  subtitleFr: string;
  subtitleEn: string;
  icon: string;
  blockId: number;
}

interface BlockData {
  id: number;
  titleFr: string;
  titleEn: string;
  icon: string;
  courses: CourseItem[];
}

const A1_BLOCKS: BlockData[] = [
  {
    id: 0,
    titleFr: 'Bloc 0 — Les bases de la communication',
    titleEn: 'Block 0 — Communication basics',
    icon: '💬',
    courses: [
      { id: 'a1_c1', number: 1, type: 'communication', titleFr: 'Salutations', titleEn: 'Greetings', subtitleFr: 'Hello! / Hi! / Goodbye!', subtitleEn: 'Hello! / Hi! / Goodbye!', icon: '👋', blockId: 0 },
      { id: 'a1_c2', number: 2, type: 'communication', titleFr: 'Politesse essentielle', titleEn: 'Essential politeness', subtitleFr: 'Thank you! / Sorry! / Please.', subtitleEn: 'Thank you! / Sorry! / Please.', icon: '🙏', blockId: 0 },
      { id: 'a1_c3', number: 3, type: 'communication', titleFr: 'Se présenter', titleEn: 'Introducing yourself', subtitleFr: "I'm Emma. I'm from France.", subtitleEn: "I'm Emma. I'm from France.", icon: '🤝', blockId: 0 },
      { id: 'a1_c4', number: 4, type: 'communication', titleFr: 'Expressions clés du quotidien', titleEn: 'Key daily expressions', subtitleFr: "How are you? — I'm fine!", subtitleEn: "How are you? — I'm fine!", icon: '💬', blockId: 0 },
      { id: 'a1_c5', number: 5, type: 'communication', titleFr: "Comprendre et demander de l'aide", titleEn: 'Understanding and asking for help', subtitleFr: "I don't understand. Repeat please.", subtitleEn: "I don't understand. Repeat please.", icon: '🆘', blockId: 0 },
    ],
  },
  {
    id: 1,
    titleFr: 'Bloc 1 — Je me présente',
    titleEn: 'Block 1 — Introducing myself',
    icon: '👋',
    courses: [
      { id: 'a1_c6', number: 6, type: 'grammar', titleFr: 'Verbe To Be : affirmation', titleEn: 'Verb To Be: affirmative', subtitleFr: "I'm happy. She's a teacher.", subtitleEn: "I'm happy. She's a teacher.", icon: '📐', blockId: 1 },
      { id: 'a1_c7', number: 7, type: 'vocabulary', titleFr: 'Ma famille', titleEn: 'My family', subtitleFr: "This is my family. She's my sister!", subtitleEn: "This is my family. She's my sister!", icon: '👨‍👩‍👧', blockId: 1 },
      { id: 'a1_c8', number: 8, type: 'vocabulary', titleFr: 'Adjectifs personnels', titleEn: 'Personal adjectives', subtitleFr: "She's very tall and beautiful!", subtitleEn: "She's very tall and beautiful!", icon: '📚', blockId: 1 },
      { id: 'a1_c9', number: 9, type: 'grammar', titleFr: 'To Be : interrogation et négation', titleEn: 'To Be: questions and negation', subtitleFr: "Are you a doctor? No, I'm not.", subtitleEn: "Are you a doctor? No, I'm not.", icon: '📐', blockId: 1 },
      { id: 'a1_c10', number: 10, type: 'grammar', titleFr: 'Adjectifs possessifs', titleEn: 'Possessive adjectives', subtitleFr: "My bag's blue. Her book's red.", subtitleEn: "My bag's blue. Her book's red.", icon: '📐', blockId: 1 },
      { id: 'a1_c11', number: 11, type: 'vocabulary', titleFr: 'La famille élargie', titleEn: 'Extended family', subtitleFr: "This is my grandmother. She's wonderful!", subtitleEn: "This is my grandmother. She's wonderful!", icon: '👴', blockId: 1 },
      { id: 'a1_c12', number: 12, type: 'grammar', titleFr: 'Articles A / An / The', titleEn: 'Articles A / An / The', subtitleFr: "I've got a book and an orange.", subtitleEn: "I've got a book and an orange.", icon: '📐', blockId: 1 },
      { id: 'a1_c13', number: 13, type: 'grammar', titleFr: 'Le pluriel des noms', titleEn: 'Plural nouns', subtitleFr: "I've got two books and three bags.", subtitleEn: "I've got two books and three bags.", icon: '📐', blockId: 1 },
      { id: 'a1_cp1', number: 0, type: 'checkpoint', titleFr: 'Checkpoint 1', titleEn: 'Checkpoint 1', subtitleFr: '10 questions · 70% minimum', subtitleEn: '10 questions · 70% minimum', icon: '🏆', blockId: 1 },
    ],
  },
  {
    id: 2,
    titleFr: 'Bloc 2 — Ma vie quotidienne',
    titleEn: 'Block 2 — My daily life',
    icon: '🏠',
    courses: [
      { id: 'a1_c14', number: 14, type: 'vocabulary', titleFr: 'Verbes essentiels du quotidien', titleEn: 'Essential daily verbs', subtitleFr: 'I go to school. I want a coffee.', subtitleEn: 'I go to school. I want a coffee.', icon: '📚', blockId: 2 },
      { id: 'a1_c15', number: 15, type: 'grammar', titleFr: 'Present Simple : affirmation', titleEn: 'Present Simple: affirmative', subtitleFr: 'She works every day. He reads a lot.', subtitleEn: 'She works every day. He reads a lot.', icon: '📐', blockId: 2 },
      { id: 'a1_c16', number: 16, type: 'grammar', titleFr: 'Present Simple : interrogation', titleEn: 'Present Simple: questions', subtitleFr: 'Do you eat bread? Does she drink?', subtitleEn: 'Do you eat bread? Does she drink?', icon: '📐', blockId: 2 },
      { id: 'a1_c17', number: 17, type: 'grammar', titleFr: 'Present Simple : négation', titleEn: 'Present Simple: negation', subtitleFr: "I don't eat meat. She doesn't like music.", subtitleEn: "I don't eat meat. She doesn't like music.", icon: '📐', blockId: 2 },
      { id: 'a1_c18', number: 18, type: 'grammar', titleFr: 'Mots interrogatifs', titleEn: 'Question words', subtitleFr: "Where do you live? What's your number?", subtitleEn: "Where do you live? What's your number?", icon: '📐', blockId: 2 },
      { id: 'a1_c19', number: 19, type: 'grammar', titleFr: 'Adverbes de fréquence', titleEn: 'Frequency adverbs', subtitleFr: 'I always brush my teeth. Never late.', subtitleEn: 'I always brush my teeth. Never late.', icon: '📐', blockId: 2 },
      { id: 'a1_c20', number: 20, type: 'vocabulary', titleFr: 'La nourriture 1', titleEn: 'Food 1', subtitleFr: 'I want some bread and water, please.', subtitleEn: 'I want some bread and water, please.', icon: '🍞', blockId: 2 },
      { id: 'a1_c21', number: 21, type: 'vocabulary', titleFr: 'La nourriture 2 — Commander', titleEn: 'Food 2 — Ordering', subtitleFr: "I'd like a pizza, please. How much?", subtitleEn: "I'd like a pizza, please. How much?", icon: '🍕', blockId: 2 },
      { id: 'a1_cp2', number: 0, type: 'checkpoint', titleFr: 'Checkpoint 2', titleEn: 'Checkpoint 2', subtitleFr: '12 questions · 70% minimum', subtitleEn: '12 questions · 70% minimum', icon: '🏆', blockId: 2 },
    ],
  },
  {
    id: 3,
    titleFr: 'Bloc 3 — Mon monde',
    titleEn: 'Block 3 — My world',
    icon: '🌍',
    courses: [
      { id: 'a1_c22', number: 22, type: 'vocabulary', titleFr: 'Les nombres 1 à 100', titleEn: 'Numbers 1 to 100', subtitleFr: "It costs fifty euros. I'm sixteen.", subtitleEn: "It costs fifty euros. I'm sixteen.", icon: '🔢', blockId: 3 },
      { id: 'a1_c23', number: 23, type: 'vocabulary', titleFr: 'Couleurs et adjectifs', titleEn: 'Colors and adjectives', subtitleFr: "I like the big blue bag. It's beautiful!", subtitleEn: "I like the big blue bag. It's beautiful!", icon: '🎨', blockId: 3 },
      { id: 'a1_c24', number: 24, type: 'grammar', titleFr: 'Verbe Have Got — Animaux', titleEn: 'Have Got — Animals', subtitleFr: "Have you got a dog? I've got a cat.", subtitleEn: "Have you got a dog? I've got a cat.", icon: '🐾', blockId: 3 },
      { id: 'a1_c25', number: 25, type: 'grammar', titleFr: 'Pronoms sujets et compléments', titleEn: 'Subject and object pronouns', subtitleFr: 'She likes him. The teacher helps us.', subtitleEn: 'She likes him. The teacher helps us.', icon: '📐', blockId: 3 },
      { id: 'a1_c26', number: 26, type: 'vocabulary', titleFr: 'La maison — pièces et objets', titleEn: 'The house — rooms and objects', subtitleFr: "This is the kitchen. The sofa's here.", subtitleEn: "This is the kitchen. The sofa's here.", icon: '🏠', blockId: 3 },
      { id: 'a1_c27', number: 27, type: 'grammar', titleFr: 'Prépositions de lieu', titleEn: 'Prepositions of place', subtitleFr: "The cat's under the table. Next to the sofa.", subtitleEn: "The cat's under the table. Next to the sofa.", icon: '📐', blockId: 3 },
      { id: 'a1_c28', number: 28, type: 'vocabulary', titleFr: 'Les lieux du quotidien', titleEn: 'Everyday places', subtitleFr: "I go to school. The shop's on the street.", subtitleEn: "I go to school. The shop's on the street.", icon: '🗺️', blockId: 3 },
      { id: 'a1_cp3', number: 0, type: 'checkpoint', titleFr: 'Checkpoint 3', titleEn: 'Checkpoint 3', subtitleFr: '12 questions · 70% minimum', subtitleEn: '12 questions · 70% minimum', icon: '🏆', blockId: 3 },
    ],
  },
  {
    id: 4,
    titleFr: 'Bloc 4 — Je communique',
    titleEn: 'Block 4 — I communicate',
    icon: '💬',
    courses: [
      { id: 'a1_c29', number: 29, type: 'vocabulary', titleFr: "L'heure et les jours", titleEn: 'Time and days', subtitleFr: "It's quarter past three. See you Monday!", subtitleEn: "It's quarter past three. See you Monday!", icon: '⏰', blockId: 4 },
      { id: 'a1_c30', number: 30, type: 'grammar', titleFr: 'Present Progressive', titleEn: 'Present Progressive', subtitleFr: "She's running. They're playing outside.", subtitleEn: "She's running. They're playing outside.", icon: '📐', blockId: 4 },
      { id: 'a1_c31', number: 31, type: 'grammar', titleFr: 'Simple vs Progressive', titleEn: 'Simple vs Progressive', subtitleFr: "I usually read, but now I'm watching TV.", subtitleEn: "I usually read, but now I'm watching TV.", icon: '📐', blockId: 4 },
      { id: 'a1_c32', number: 32, type: 'grammar', titleFr: 'Réponses courtes', titleEn: 'Short answers', subtitleFr: "Yes, I am. No, she doesn't.", subtitleEn: "Yes, I am. No, she doesn't.", icon: '📐', blockId: 4 },
      { id: 'a1_c33', number: 33, type: 'grammar', titleFr: 'Cas possessif et pronoms possessifs', titleEn: 'Possessive case and pronouns', subtitleFr: "That's Tom's jacket. Is this yours?", subtitleEn: "That's Tom's jacket. Is this yours?", icon: '📐', blockId: 4 },
      { id: 'a1_c34', number: 34, type: 'vocabulary', titleFr: 'Le transport', titleEn: 'Transport', subtitleFr: 'I go to school by bus. She takes the train.', subtitleEn: 'I go to school by bus. She takes the train.', icon: '🚌', blockId: 4 },
      { id: 'a1_c35', number: 35, type: 'vocabulary', titleFr: 'Mois, saisons et prépositions de temps', titleEn: 'Months, seasons and time prepositions', subtitleFr: "My birthday's in July. On Monday at nine.", subtitleEn: "My birthday's in July. On Monday at nine.", icon: '📅', blockId: 4 },
      { id: 'a1_cp4', number: 0, type: 'checkpoint', titleFr: 'Checkpoint 4', titleEn: 'Checkpoint 4', subtitleFr: '15 questions · 70% minimum', subtitleEn: '15 questions · 70% minimum', icon: '🏆', blockId: 4 },
    ],
  },
  {
    id: 5,
    titleFr: 'Bloc 5 — Je voyage et je découvre',
    titleEn: 'Block 5 — I travel and discover',
    icon: '✈️',
    courses: [
      { id: 'a1_c36', number: 36, type: 'vocabulary', titleFr: 'La météo', titleEn: 'The weather', subtitleFr: "It's sunny today! Take your umbrella.", subtitleEn: "It's sunny today! Take your umbrella.", icon: '☀️', blockId: 5 },
      { id: 'a1_c37', number: 37, type: 'grammar', titleFr: "Can / Can't", titleEn: "Can / Can't", subtitleFr: "I can swim. She can't drive. Can you sing?", subtitleEn: "I can swim. She can't drive. Can you sing?", icon: '📐', blockId: 5 },
      { id: 'a1_c38', number: 38, type: 'grammar', titleFr: 'Les impératifs', titleEn: 'Imperatives', subtitleFr: "Turn left! Go straight! Don't run!", subtitleEn: "Turn left! Go straight! Don't run!", icon: '📐', blockId: 5 },
      { id: 'a1_c39', number: 39, type: 'vocabulary', titleFr: 'Le voyage', titleEn: 'Travel', subtitleFr: "Don't forget your passport! Hotel's near.", subtitleEn: "Don't forget your passport! Hotel's near.", icon: '✈️', blockId: 5 },
      { id: 'a1_c40', number: 40, type: 'revision', titleFr: 'Révision consolidée A1', titleEn: 'A1 consolidated revision', subtitleFr: "I'm Emma. I can speak English!", subtitleEn: "I'm Emma. I can speak English!", icon: '📝', blockId: 5 },
      { id: 'a1_cert', number: 0, type: 'certification', titleFr: 'Certification A1', titleEn: 'A1 Certification', subtitleFr: '40 questions · 75% minimum', subtitleEn: '40 questions · 75% minimum', icon: '🎓', blockId: 5 },
    ],
  },
];

// ==========================================
// PARCOURS B — Blocs thématiques (Curriculum §4.2)
// ==========================================
const B_BLOCKS: BlockData[] = [
  {
    id: 1,
    titleFr: 'B1 — Se présenter & saluer',
    titleEn: 'B1 — Introducing & greeting',
    icon: '👋',
    courses: [
      { id: 'b_b1_c1', number: 1, type: 'vocabulary', titleFr: 'Salutations et présentations', titleEn: 'Greetings and introductions', subtitleFr: 'Hello, my name is...', subtitleEn: 'Hello, my name is...', icon: '📚', blockId: 1 },
      { id: 'b_b1_c2', number: 2, type: 'grammar', titleFr: 'To be + Pronoms sujets', titleEn: 'To be + Subject pronouns', subtitleFr: 'Grammaire simplifiée', subtitleEn: 'Simplified grammar', icon: '📐', blockId: 1 },
      { id: 'b_b1_c3', number: 3, type: 'grammar', titleFr: 'Adjectifs possessifs', titleEn: 'Possessive adjectives', subtitleFr: 'my, your, his, her', subtitleEn: 'my, your, his, her', icon: '📐', blockId: 1 },
      { id: 'b_b1_d', number: 0, type: 'dialogue', titleFr: 'Dialogue : Première rencontre', titleEn: 'Dialogue: First meeting', subtitleFr: 'Jeu de rôle oral', subtitleEn: 'Oral role play', icon: '🗣️', blockId: 1 },
      { id: 'b_b1_cp', number: 0, type: 'checkpoint', titleFr: 'Badge : Je sais me présenter', titleEn: 'Badge: I can introduce myself', subtitleFr: '70% minimum', subtitleEn: '70% minimum', icon: '✅', blockId: 1 },
    ],
  },
  {
    id: 2,
    titleFr: 'B2 — Ma famille & mes amis',
    titleEn: 'B2 — My family & friends',
    icon: '👨‍👩‍👧‍👦',
    courses: [
      { id: 'b_b2_c1', number: 1, type: 'vocabulary', titleFr: 'Famille et relations', titleEn: 'Family and relationships', subtitleFr: 'mother, father, friend...', subtitleEn: 'mother, father, friend...', icon: '📚', blockId: 2 },
      { id: 'b_b2_c2', number: 2, type: 'grammar', titleFr: 'Have got + Pluriel', titleEn: 'Have got + Plurals', subtitleFr: 'Grammaire simplifiée', subtitleEn: 'Simplified grammar', icon: '📐', blockId: 2 },
      { id: 'b_b2_c3', number: 3, type: 'grammar', titleFr: 'Questions simples', titleEn: 'Simple questions', subtitleFr: 'Have you got...? / Is she...?', subtitleEn: 'Have you got...? / Is she...?', icon: '📐', blockId: 2 },
      { id: 'b_b2_d', number: 0, type: 'dialogue', titleFr: 'Dialogue : Parler de sa famille', titleEn: 'Dialogue: Talking about family', subtitleFr: 'Écoute + oral', subtitleEn: 'Listening + speaking', icon: '🗣️', blockId: 2 },
      { id: 'b_b2_cp', number: 0, type: 'checkpoint', titleFr: 'Badge : Je parle de ma famille', titleEn: 'Badge: I talk about my family', subtitleFr: '70% minimum', subtitleEn: '70% minimum', icon: '✅', blockId: 2 },
    ],
  },
  {
    id: 3,
    titleFr: 'B3 — Commander & manger',
    titleEn: 'B3 — Ordering & eating',
    icon: '🍽️',
    courses: [
      { id: 'b_b3_c1', number: 1, type: 'vocabulary', titleFr: 'Nourriture et boissons', titleEn: 'Food and drinks', subtitleFr: 'coffee, bread, water...', subtitleEn: 'coffee, bread, water...', icon: '📚', blockId: 3 },
      { id: 'b_b3_c2', number: 2, type: 'grammar', titleFr: 'Can + Impératifs', titleEn: 'Can + Imperatives', subtitleFr: 'Can I have...? / Please...', subtitleEn: 'Can I have...? / Please...', icon: '📐', blockId: 3 },
      { id: 'b_b3_c3', number: 3, type: 'grammar', titleFr: 'Articles a/an/the', titleEn: 'Articles a/an/the', subtitleFr: 'En contexte restaurant', subtitleEn: 'In restaurant context', icon: '📐', blockId: 3 },
      { id: 'b_b3_d', number: 0, type: 'dialogue', titleFr: 'Dialogue : Au restaurant', titleEn: 'Dialogue: At the restaurant', subtitleFr: 'Commander un repas', subtitleEn: 'Ordering a meal', icon: '🗣️', blockId: 3 },
      { id: 'b_b3_cp', number: 0, type: 'checkpoint', titleFr: 'Badge : Je commande au restaurant', titleEn: 'Badge: I order at a restaurant', subtitleFr: '70% minimum', subtitleEn: '70% minimum', icon: '✅', blockId: 3 },
    ],
  },
  {
    id: 4,
    titleFr: 'B4 — Voyager & demander sa route',
    titleEn: 'B4 — Traveling & asking directions',
    icon: '🗺️',
    courses: [
      { id: 'b_b4_c1', number: 1, type: 'vocabulary', titleFr: 'Voyage et transport', titleEn: 'Travel and transport', subtitleFr: 'airport, ticket, hotel...', subtitleEn: 'airport, ticket, hotel...', icon: '📚', blockId: 4 },
      { id: 'b_b4_c2', number: 2, type: 'grammar', titleFr: 'Prépositions + Impératifs', titleEn: 'Prepositions + Imperatives', subtitleFr: 'Turn left, go straight', subtitleEn: 'Turn left, go straight', icon: '📐', blockId: 4 },
      { id: 'b_b4_c3', number: 3, type: 'grammar', titleFr: 'Questions avec Where/How', titleEn: 'Questions with Where/How', subtitleFr: 'Where is...? / How do I...?', subtitleEn: 'Where is...? / How do I...?', icon: '📐', blockId: 4 },
      { id: 'b_b4_d', number: 0, type: 'dialogue', titleFr: 'Dialogue : Demander son chemin', titleEn: 'Dialogue: Asking for directions', subtitleFr: 'Écoute + oral', subtitleEn: 'Listening + speaking', icon: '🗣️', blockId: 4 },
      { id: 'b_b4_cp', number: 0, type: 'checkpoint', titleFr: 'Badge : Je me débrouille en voyage', titleEn: 'Badge: I manage when traveling', subtitleFr: '70% minimum', subtitleEn: '70% minimum', icon: '✅', blockId: 4 },
    ],
  },
  {
    id: 5,
    titleFr: 'B5 — Shopping & transactions',
    titleEn: 'B5 — Shopping & transactions',
    icon: '🛍️',
    courses: [
      { id: 'b_b5_c1', number: 1, type: 'vocabulary', titleFr: 'Vêtements et prix', titleEn: 'Clothes and prices', subtitleFr: 'shirt, shoes, How much...?', subtitleEn: 'shirt, shoes, How much...?', icon: '📚', blockId: 5 },
      { id: 'b_b5_c2', number: 2, type: 'grammar', titleFr: 'Nombres + Adjectifs', titleEn: 'Numbers + Adjectives', subtitleFr: 'Adjectif AVANT le nom', subtitleEn: 'Adjective BEFORE the noun', icon: '📐', blockId: 5 },
      { id: 'b_b5_c3', number: 3, type: 'grammar', titleFr: 'Have got + How much/many', titleEn: 'Have got + How much/many', subtitleFr: 'Questions de quantité', subtitleEn: 'Quantity questions', icon: '📐', blockId: 5 },
      { id: 'b_b5_d', number: 0, type: 'dialogue', titleFr: 'Dialogue : Dans un magasin', titleEn: 'Dialogue: In a shop', subtitleFr: 'Acheter des vêtements', subtitleEn: 'Buying clothes', icon: '🗣️', blockId: 5 },
      { id: 'b_b5_cp', number: 0, type: 'checkpoint', titleFr: 'Badge : Je fais du shopping', titleEn: 'Badge: I go shopping', subtitleFr: '70% minimum', subtitleEn: '70% minimum', icon: '✅', blockId: 5 },
    ],
  },
  {
    id: 6,
    titleFr: 'B6 — Décrire ce qui se passe',
    titleEn: 'B6 — Describing what\'s happening',
    icon: '👀',
    courses: [
      { id: 'b_b6_c1', number: 1, type: 'vocabulary', titleFr: 'Actions et situations', titleEn: 'Actions and situations', subtitleFr: 'running, eating, watching...', subtitleEn: 'running, eating, watching...', icon: '📚', blockId: 6 },
      { id: 'b_b6_c2', number: 2, type: 'grammar', titleFr: 'Present Progressive', titleEn: 'Present Progressive', subtitleFr: 'I am + verbe-ing', subtitleEn: 'I am + verb-ing', icon: '📐', blockId: 6 },
      { id: 'b_b6_c3', number: 3, type: 'grammar', titleFr: 'Adverbes de temps', titleEn: 'Time adverbs', subtitleFr: 'now, at the moment, currently', subtitleEn: 'now, at the moment, currently', icon: '📐', blockId: 6 },
      { id: 'b_b6_d', number: 0, type: 'dialogue', titleFr: 'Dialogue : Que se passe-t-il ?', titleEn: 'Dialogue: What\'s happening?', subtitleFr: 'Décrire des scènes', subtitleEn: 'Describing scenes', icon: '🗣️', blockId: 6 },
      { id: 'b_b6_cp', number: 0, type: 'checkpoint', titleFr: 'Badge : Je décris des situations', titleEn: 'Badge: I describe situations', subtitleFr: '70% minimum', subtitleEn: '70% minimum', icon: '✅', blockId: 6 },
    ],
  },
];

// Flatten all courses for sequential access
const ALL_A_COURSES = A1_BLOCKS.flatMap(b => b.courses);
const ALL_B_COURSES = B_BLOCKS.flatMap(b => b.courses);

// ==========================================
// STAR SYSTEM (Curriculum §1.1)
// ==========================================
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function getStars(scorePercent: number): number {
  if (scorePercent >= 90) return 3;
  if (scorePercent >= 70) return 2;
  if (scorePercent >= 60) return 1;
  return 0;
}

function getStarLabel(stars: number, lang: InterfaceLanguage): string {
  if (lang === 'fr') {
    if (stars === 3) return 'Maîtrisé';
    if (stars === 2) return 'Bien';
    if (stars === 1) return 'À retravailler';
    return 'Bloqué';
  }
  if (stars === 3) return 'Mastered';
  if (stars === 2) return 'Good';
  if (stars === 1) return 'Needs work';
  return 'Locked';
}

// ==========================================
// COURSE SCORE STORAGE
// ==========================================
interface CourseScore {
  score: number;
  stars: number;
  completedAt: string;
}

function getCourseScores(userId: string, lang: string): Record<string, CourseScore> {
  try {
    const key = `lingualearn_course_scores_${userId}_${lang}`;
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : {};
  } catch { return {}; }
}

function isCourseUnlocked(courseId: string, scores: Record<string, CourseScore>, allCourses: CourseItem[]): boolean {
  const idx = allCourses.findIndex(c => c.id === courseId);
  if (idx === 0) return true; // First course always unlocked

  const prevCourse = allCourses[idx - 1];
  if (!prevCourse) return false;

  const prevScore = scores[prevCourse.id];
  if (!prevScore) return false;

  // Checkpoints/badges need 70%, certification needs 75%, courses need 60%
  if (prevCourse.type === 'checkpoint') return prevScore.score >= 70;
  if (prevCourse.type === 'certification') return prevScore.score >= 75;
  return prevScore.score >= 60;
}

// ==========================================
// COMPONENT
// ==========================================
export default function CoursPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [lang, setLang] = useState<InterfaceLanguage>('fr');
  const [, setActiveLang] = useState<LearningLanguage>('en');
  const [scores, setScores] = useState<Record<string, CourseScore>>({});
  const [selectedCourse, setSelectedCourse] = useState<CourseItem | null>(null);
  const [learningPath, setLearningPath] = useState<LearningPath | LearningPath[] | undefined>();

  useEffect(() => {
    const currentUser = getCurrentUser();
    if (!currentUser) { router.push('/auth'); return; }
    if (!currentUser.onboardingCompleted && currentUser.role !== 'admin') { router.push('/onboarding'); return; }
    setUser(currentUser);
    setLang(currentUser.settings.interfaceLang || 'fr');
    const aLang = (currentUser.activeLang || currentUser.settings.learningLangs[0] || 'en') as LearningLanguage;
    setActiveLang(aLang);
    setScores(getCourseScores(currentUser.id, aLang));
    const config = currentUser.settings.languageConfigs?.[aLang];
    setLearningPath(config?.learningPath);
  }, [router]);

  if (!user) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#F0F0F0]">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-[#002844]" />
      </div>
    );
  }

  // BUG-54: Select blocks and courses based on learning path
  const isPathB = (() => {
    if (!learningPath) return false;
    const paths = Array.isArray(learningPath) ? learningPath : [learningPath];
    return paths.includes('B') && !paths.includes('A');
  })();
  const activeBlocks = isPathB ? B_BLOCKS : A1_BLOCKS;
  const allCourses = isPathB ? ALL_B_COURSES : ALL_A_COURSES;

  // Calculate total stats
  const completedCourses = allCourses.filter(c => scores[c.id]);
  const totalStars = completedCourses.reduce((sum, c) => sum + (scores[c.id]?.stars || 0), 0);
  const maxStars = allCourses.length * 3;

  // Determine path label
  const pathLabel = (() => {
    if (!learningPath) return '';
    const paths = Array.isArray(learningPath) ? learningPath : [learningPath];
    return paths.map(p => {
      if (p === 'A') return lang === 'fr' ? 'Apprentissage complet' : 'Complete Learning';
      if (p === 'B') return lang === 'fr' ? 'Parler & Comprendre' : 'Speak & Understand';
      if (p === 'C') return lang === 'fr' ? 'Professionnel GRC' : 'Professional GRC';
      return '';
    }).join(' + ');
  })();

  const renderStars = (stars: number, size: 'sm' | 'md' = 'sm') => {
    const sizeClass = size === 'md' ? 'h-5 w-5' : 'h-3.5 w-3.5';
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3].map(i => (
          <Star
            key={i}
            className={`${sizeClass} ${i <= stars ? 'text-[#D9B438] fill-[#D9B438]' : 'text-gray-300'}`}
          />
        ))}
      </div>
    );
  };

  const handleCourseClick = (course: CourseItem) => {
    const unlocked = isCourseUnlocked(course.id, scores, allCourses);
    if (!unlocked) return;
    setSelectedCourse(course);
  };

  // BUG-58: Check if a resume exists for the selected course
  const hasResume = (() => {
    if (!selectedCourse || !user) return false;
    try {
      const resumeKey = `lingualearn_resume_${user.id}_${selectedCourse.id}`;
      const resumeStr = localStorage.getItem(resumeKey);
      if (!resumeStr) return false;
      const resume = JSON.parse(resumeStr);
      const savedAt = new Date(resume.savedAt).getTime();
      return Date.now() - savedAt < 24 * 60 * 60 * 1000;
    } catch { return false; }
  })();

  const handleStartCourse = () => {
    if (!selectedCourse) return;
    // Navigate to session with course context
    router.push(`/session?courseId=${selectedCourse.id}`);
  };

  // ==========================================
  // COURSE DETAIL MODAL
  // ==========================================
  if (selectedCourse) {
    const score = scores[selectedCourse.id];
    const unlocked = isCourseUnlocked(selectedCourse.id, scores, allCourses);

    return (
      <div className="min-h-screen bg-[#F0F0F0] px-4 py-6">
        <div className="max-w-lg mx-auto">
          {/* Back */}
          <div onClick={() => setSelectedCourse(null)} className="mb-6">
            <PageHeader title={lang === 'fr' ? 'Retour au parcours' : 'Back to path'} />
          </div>

          {/* Course card */}
          <div className="bg-white rounded-2xl p-6 shadow-sm mb-6">
            <div className="flex items-center gap-4 mb-4">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center text-3xl ${
                selectedCourse.type === 'checkpoint' || selectedCourse.type === 'certification'
                  ? 'bg-[#D9B438]/20'
                  : selectedCourse.type === 'dialogue'
                    ? 'bg-purple-100'
                    : 'bg-blue-50'
              }`}>
                {selectedCourse.icon}
              </div>
              <div className="flex-1">
                {selectedCourse.number > 0 && (
                  <p className="text-xs font-semibold text-[#D9B438] uppercase tracking-wide mb-1">
                    {lang === 'fr' ? `Cours ${selectedCourse.number}` : `Course ${selectedCourse.number}`}
                  </p>
                )}
                <h2 className="text-lg font-bold text-[#002844]">
                  {lang === 'fr' ? selectedCourse.titleFr : selectedCourse.titleEn}
                </h2>
                <p className="text-sm text-[#555555] mt-1">
                  {lang === 'fr' ? selectedCourse.subtitleFr : selectedCourse.subtitleEn}
                </p>
              </div>
            </div>

            {/* Score if completed */}
            {score && (
              <div className="border-t border-gray-100 pt-4 mt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-[#002844]">
                      {lang === 'fr' ? 'Meilleur score' : 'Best score'}
                    </p>
                    <p className="text-2xl font-bold text-[#D9B438]">{score.score}%</p>
                  </div>
                  <div className="text-center">
                    {renderStars(score.stars, 'md')}
                    <p className="text-xs text-[#555555] mt-1">{getStarLabel(score.stars, lang)}</p>
                  </div>
                </div>
                <div className="h-2 w-full rounded-full bg-gray-100 mt-3">
                  <div className="h-full rounded-full transition-all"
                    style={{
                      width: `${score.score}%`,
                      backgroundColor: score.stars >= 3 ? '#2E7D32' : score.stars >= 2 ? '#D9B438' : score.stars >= 1 ? '#E65100' : '#E53935',
                    }} />
                </div>
              </div>
            )}
          </div>

          {/* Structure reminder */}
          <div className="bg-white rounded-2xl p-5 shadow-sm mb-6">
            <h3 className="text-sm font-bold text-[#002844] mb-3">
              {lang === 'fr' ? 'Structure du cours' : 'Course structure'}
            </h3>
            <div className="space-y-2">
              {[
                { step: 1, labelFr: 'Règle', labelEn: 'Rule', icon: '📐' },
                { step: 2, labelFr: 'Vocabulaire', labelEn: 'Vocabulary', icon: '📚' },
                { step: 3, labelFr: 'Exercices', labelEn: 'Exercises', icon: '🎯' },
                { step: 4, labelFr: 'Feedback', labelEn: 'Feedback', icon: '💡' },
                { step: 5, labelFr: 'Résumé', labelEn: 'Summary', icon: '📊' },
              ].map(s => (
                <div key={s.step} className="flex items-center gap-3">
                  <span className="text-lg">{s.icon}</span>
                  <span className="text-sm text-[#555555]">
                    {lang === 'fr' ? `Étape ${s.step} — ${s.labelFr}` : `Step ${s.step} — ${s.labelEn}`}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-3">
            {unlocked && (
              <button onClick={handleStartCourse}
                className="w-full py-3.5 rounded-xl bg-[#002844] text-white font-bold text-sm hover:bg-[#003a5c] transition-colors">
                {hasResume
                  ? (lang === 'fr' ? 'Reprendre le cours' : 'Resume course')
                  : score
                    ? (lang === 'fr' ? 'Refaire le cours' : 'Redo course')
                    : (lang === 'fr' ? 'Commencer le cours' : 'Start course')}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // MAIN CAROUSEL VIEW
  // ==========================================
  return (
    <div className="min-h-screen pb-20 bg-gradient-to-b from-[#002844] via-[#003a5c] to-[#004d73]">
      {/* Header */}
      <PageHeader title={lang === 'fr' ? 'Mon parcours' : 'My path'} backHref="/dashboard" />
      <div className="px-4 pt-2 pb-4">
        <div className="max-w-lg mx-auto">

          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">
                {isPathB
                  ? (lang === 'fr' ? 'Parcours B' : 'Path B')
                  : (lang === 'fr' ? 'Parcours A1' : 'A1 Path')}
              </h1>
              {pathLabel && (
                <p className="text-xs text-[#D9B438] font-semibold mt-1">{pathLabel}</p>
              )}
            </div>
            <div className="text-right">
              <div className="flex items-center gap-1.5 text-[#D9B438]">
                <Star className="h-4 w-4 fill-[#D9B438]" />
                <span className="text-sm font-bold">{totalStars}/{maxStars}</span>
              </div>
              <p className="text-xs text-white/50 mt-0.5">
                {completedCourses.length}/{allCourses.length} {lang === 'fr' ? 'cours' : 'courses'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Course blocks */}
      <div className="px-4 pb-12">
        <div className="max-w-lg mx-auto space-y-8">
          {activeBlocks.map((block) => {
            // Check if block is accessible (first course must be unlocked)
            const firstCourse = block.courses[0];
            const blockUnlocked = isCourseUnlocked(firstCourse.id, scores, allCourses);
            const blockCompleted = block.courses.every(c => scores[c.id] && scores[c.id].score >= 60);

            return (
              <div key={block.id} className={`transition-opacity ${blockUnlocked || block.id === 1 ? 'opacity-100' : 'opacity-40'}`}>
                {/* Block header */}
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${
                    blockCompleted ? 'bg-green-500/20' : 'bg-white/10'
                  }`}>
                    {blockCompleted ? '✅' : block.icon}
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-white">
                      {lang === 'fr' ? block.titleFr : block.titleEn}
                    </h2>
                    <p className="text-xs text-white/50">
                      {block.courses.filter(c => scores[c.id]).length}/{block.courses.length} {lang === 'fr' ? 'terminés' : 'completed'}
                    </p>
                  </div>
                </div>

                {/* Course bubbles - zigzag path */}
                <div className="relative pl-4">
                  {/* Connecting line */}
                  <div className="absolute left-[2.75rem] top-0 bottom-0 w-0.5 bg-white/10" />

                  <div className="space-y-5">
                    {block.courses.map((course, idx) => {
                      const score = scores[course.id];
                      const unlocked = course.id === allCourses[0].id || isCourseUnlocked(course.id, scores, allCourses);
                      const completed = !!score;
                      const stars = score?.stars || 0;
                      const isCheckpoint = course.type === 'checkpoint' || course.type === 'certification';
                      const isDialogue = course.type === 'dialogue';

                      // Zigzag offset
                      const zigzag = idx % 2 === 0 ? 'ml-0' : 'ml-12';

                      // Bubble colors
                      let bubbleBg = 'bg-gray-600/50';
                      let bubbleBorder = 'border-gray-500/30';
                      let textColor = 'text-white/30';

                      if (completed) {
                        if (stars >= 3) {
                          bubbleBg = 'bg-green-500';
                          bubbleBorder = 'border-green-400';
                          textColor = 'text-white';
                        } else if (stars >= 2) {
                          bubbleBg = 'bg-[#D9B438]';
                          bubbleBorder = 'border-[#c9a530]';
                          textColor = 'text-[#002844]';
                        } else if (stars >= 1) {
                          bubbleBg = 'bg-orange-500';
                          bubbleBorder = 'border-orange-400';
                          textColor = 'text-white';
                        } else {
                          bubbleBg = 'bg-red-500';
                          bubbleBorder = 'border-red-400';
                          textColor = 'text-white';
                        }
                      } else if (unlocked) {
                        bubbleBg = 'bg-white/20';
                        bubbleBorder = 'border-white/40';
                        textColor = 'text-white';
                      }

                      // Size for special types
                      const bubbleSize = isCheckpoint ? 'w-16 h-16' : isDialogue ? 'w-14 h-14' : 'w-14 h-14';

                      return (
                        <div key={course.id} className={`relative flex items-center gap-3 ${zigzag}`}>
                          {/* Bubble */}
                          <button
                            onClick={() => handleCourseClick(course)}
                            disabled={!unlocked}
                            className={`relative z-10 flex-shrink-0 ${bubbleSize} rounded-full ${bubbleBg} border-2 ${bubbleBorder} flex items-center justify-center overflow-visible transition-all ${
                              unlocked ? 'hover:scale-110 cursor-pointer active:scale-95' : 'cursor-not-allowed'
                            } ${unlocked && !completed ? 'animate-pulse' : ''}`}
                          >
                            {!unlocked ? (
                              <Lock className="h-4 w-4 text-white/30" />
                            ) : (
                              <span className={`text-xl ${textColor}`}>
                                {course.icon}
                              </span>
                            )}

                            {/* Stars below bubble - BUG-55: visible outside bubble */}
                            {completed && (
                              <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 z-20">
                                <div className="flex gap-0.5 bg-[#002844]/80 rounded-full px-1.5 py-0.5">
                                  {[1, 2, 3].map(i => (
                                    <Star key={i} className={`h-3 w-3 ${i <= stars ? 'text-[#D9B438] fill-[#D9B438]' : 'text-white/30'}`} />
                                  ))}
                                </div>
                              </div>
                            )}
                          </button>

                          {/* Course info */}
                          <div className={`flex-1 min-w-0 ${unlocked ? '' : 'opacity-40'}`}>
                            <div className="flex items-center gap-2">
                              {course.number > 0 && (
                                <span className="text-[10px] font-bold text-[#D9B438] bg-[#D9B438]/10 px-1.5 py-0.5 rounded">
                                  {course.number}
                                </span>
                              )}
                              {isCheckpoint && (
                                <Trophy className="h-3.5 w-3.5 text-[#D9B438]" />
                              )}
                              {isDialogue && (
                                <MessageCircle className="h-3.5 w-3.5 text-purple-400" />
                              )}
                              <p className={`text-sm font-semibold truncate ${unlocked ? 'text-white' : 'text-white/40'}`}>
                                {lang === 'fr' ? course.titleFr : course.titleEn}
                              </p>
                            </div>
                            {completed && score && (
                              <p className="text-[10px] text-white/50 mt-0.5">
                                {score.score}% · {getStarLabel(stars, lang)}
                              </p>
                            )}
                            {unlocked && !completed && (
                              <p className="text-[10px] text-[#D9B438] mt-0.5 font-semibold">
                                {lang === 'fr' ? 'Disponible' : 'Available'}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <BottomNav lang={lang} />
    </div>
  );
}
