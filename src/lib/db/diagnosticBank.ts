import { LearningLanguage, LearningObjective } from '@/types';

export interface DiagnosticQuestion {
  id: string;
  type: 'cecrl' | 'grc';
  objective: LearningObjective | 'ecoute';
  level: 'A1' | 'A2' | 'B1' | 'B2';
  questionFr: string;
  question: string;
  options: string[];
  correctAnswer: number; // 0-3 index
  language: LearningLanguage;
  theme?: string; // Optional, for GRC questions
}

const DIAGNOSTIC_QUESTIONS: DiagnosticQuestion[] = [
  // CECRL - Grammaire (5 questions)
  {
    id: 'gram_001',
    type: 'cecrl',
    objective: 'grammaire',
    level: 'A1',
    questionFr: 'Complétez : "Je ___ un étudiant."',
    question: 'Complete: "I ___ a student."',
    options: ['am', 'is', 'are', 'be'],
    correctAnswer: 0,
    language: 'en',
  },
  {
    id: 'gram_002',
    type: 'cecrl',
    objective: 'grammaire',
    level: 'A1',
    questionFr: 'Quel est le pluriel de "child" ?',
    question: 'What is the plural of "child"?',
    options: ['childs', 'children', 'childes', 'child'],
    correctAnswer: 1,
    language: 'en',
  },
  {
    id: 'gram_003',
    type: 'cecrl',
    objective: 'grammaire',
    level: 'A2',
    questionFr: 'Complétez : "Si je ___ riche, je voyagerais."',
    question: 'Complete: "If I ___ rich, I would travel."',
    options: ['am', 'was', 'were', 'have been'],
    correctAnswer: 2,
    language: 'en',
  },
  {
    id: 'gram_004',
    type: 'cecrl',
    objective: 'grammaire',
    level: 'B1',
    questionFr: 'Laquelle est correcte ? "Je suis allé" en anglais :',
    question: 'Which is correct? "I went" in past perfect:',
    options: ['I have gone', 'I have went', 'I am gone', 'I did go'],
    correctAnswer: 0,
    language: 'en',
  },
  {
    id: 'gram_005',
    type: 'cecrl',
    objective: 'grammaire',
    level: 'B2',
    questionFr: 'Complétez : "Bien qu\'il ___ occupé, il a accepté."',
    question: 'Complete: "Although he ___ busy, he accepted."',
    options: ['is', 'was', 'were', 'had been'],
    correctAnswer: 1,
    language: 'en',
  },

  // CECRL - Vocabulaire (5 questions)
  {
    id: 'vocab_001',
    type: 'cecrl',
    objective: 'vocabulaire',
    level: 'A1',
    questionFr: 'Quel est le contraire de "hot" ?',
    question: 'What is the opposite of "hot"?',
    options: ['warm', 'cold', 'cool', 'freezing'],
    correctAnswer: 1,
    language: 'en',
  },
  {
    id: 'vocab_002',
    type: 'cecrl',
    objective: 'vocabulaire',
    level: 'A1',
    questionFr: 'Quel mot signifie "maison" ?',
    question: 'Which word means "a place where you live"?',
    options: ['hospital', 'school', 'house', 'park'],
    correctAnswer: 2,
    language: 'en',
  },
  {
    id: 'vocab_003',
    type: 'cecrl',
    objective: 'vocabulaire',
    level: 'A2',
    questionFr: 'Que signifie "exhausted" ?',
    question: 'What does "exhausted" mean?',
    options: ['excited', 'very tired', 'confused', 'angry'],
    correctAnswer: 1,
    language: 'en',
  },
  {
    id: 'vocab_004',
    type: 'cecrl',
    objective: 'vocabulaire',
    level: 'B1',
    questionFr: 'Que signifie "persévérer" en anglais ?',
    question: 'What is the English word for "continue despite difficulties"?',
    options: ['persist', 'hesitate', 'abandon', 'postpone'],
    correctAnswer: 0,
    language: 'en',
  },
  {
    id: 'vocab_005',
    type: 'cecrl',
    objective: 'vocabulaire',
    level: 'B2',
    questionFr: 'Que signifie "ambiguous" ?',
    question: 'What does "ambiguous" mean?',
    options: ['clear', 'uncertain or having multiple meanings', 'obvious', 'detailed'],
    correctAnswer: 1,
    language: 'en',
  },

  // CECRL - Lecture (5 questions)
  {
    id: 'lecture_001',
    type: 'cecrl',
    objective: 'lecture',
    level: 'A1',
    questionFr: 'Lis : "My name is John." Quel est le nom de la personne ?',
    question: 'Read: "My name is John." What is the person\'s name?',
    options: ['Mary', 'John', 'Sarah', 'Tom'],
    correctAnswer: 1,
    language: 'en',
  },
  {
    id: 'lecture_002',
    type: 'cecrl',
    objective: 'lecture',
    level: 'A2',
    questionFr: 'Lis : "The cat is black and white." De quelle couleur est le chat ?',
    question: 'Read: "The cat is black and white." What color is the cat?',
    options: ['black', 'white', 'black and white', 'gray'],
    correctAnswer: 2,
    language: 'en',
  },
  {
    id: 'lecture_003',
    type: 'cecrl',
    objective: 'lecture',
    level: 'B1',
    questionFr: 'Lis : "Elle a travaillé dur, donc elle a réussi." Pourquoi a-t-elle réussi ?',
    question: 'Read: "She worked hard, so she succeeded." Why did she succeed?',
    options: ['she was lucky', 'she worked hard', 'she had help', 'she was talented'],
    correctAnswer: 1,
    language: 'en',
  },
  {
    id: 'lecture_004',
    type: 'cecrl',
    objective: 'lecture',
    level: 'B1',
    questionFr: 'Lis le texte : "The conference was postponed due to unforeseen circumstances." Pourquoi a-t-elle été reportée ?',
    question: 'Read: "The conference was postponed due to unforeseen circumstances." Why was it postponed?',
    options: ['lack of interest', 'unexpected events', 'bad weather', 'insufficient budget'],
    correctAnswer: 1,
    language: 'en',
  },
  {
    id: 'lecture_005',
    type: 'cecrl',
    objective: 'lecture',
    level: 'B2',
    questionFr: 'Lis : "Despite the initial skepticism, the innovative approach ultimately proved beneficial." Quel était le sentiment initial ?',
    question: 'Read: "Despite the initial skepticism, the innovative approach ultimately proved beneficial." What was the initial feeling?',
    options: ['enthusiasm', 'doubt', 'indifference', 'excitement'],
    correctAnswer: 1,
    language: 'en',
  },

  // CECRL - Écrit (5 questions)
  {
    id: 'ecrit_001',
    type: 'cecrl',
    objective: 'ecrit',
    level: 'A1',
    questionFr: 'Écrivez le présent : "I ___ like pizza."',
    question: 'Choose the correct form: "I ___ like pizza."',
    options: ['are', 'am', 'is', 'do'],
    correctAnswer: 1,
    language: 'en',
  },
  {
    id: 'ecrit_002',
    type: 'cecrl',
    objective: 'ecrit',
    level: 'A2',
    questionFr: 'Complétez : "Yesterday, I ___ to the cinema."',
    question: 'Complete: "Yesterday, I ___ to the cinema."',
    options: ['go', 'went', 'gone', 'going'],
    correctAnswer: 1,
    language: 'en',
  },
  {
    id: 'ecrit_003',
    type: 'cecrl',
    objective: 'ecrit',
    level: 'B1',
    questionFr: 'Quelle phrase est correcte ?',
    question: 'Which sentence is correct?',
    options: ['I have not went there', 'I have not been there', 'I am not been there', 'I have not go there'],
    correctAnswer: 1,
    language: 'en',
  },
  {
    id: 'ecrit_004',
    type: 'cecrl',
    objective: 'ecrit',
    level: 'B1',
    questionFr: 'Choisissez la phrase bien écrite :',
    question: 'Choose the well-written sentence:',
    options: ['She said me that she was happy', 'She told me that she was happy', 'She said to me that she happy', 'She told me that she is happy'],
    correctAnswer: 1,
    language: 'en',
  },
  {
    id: 'ecrit_005',
    type: 'cecrl',
    objective: 'ecrit',
    level: 'B2',
    questionFr: 'Quelle phrase respecte la grammaire avancée ?',
    question: 'Which sentence has correct advanced grammar?',
    options: ['I would have liked to have gone', 'I would have like to go', 'I would liked to have went', 'I would like to have gone'],
    correctAnswer: 0,
    language: 'en',
  },

  // CECRL - Oral (5 questions)
  {
    id: 'oral_001',
    type: 'cecrl',
    objective: 'oral',
    level: 'A1',
    questionFr: 'Comment dit-on "Bonjour" en anglais ?',
    question: 'How do you say "Bonjour" in English?',
    options: ['Goodbye', 'Hello', 'Sorry', 'Thank you'],
    correctAnswer: 1,
    language: 'en',
  },
  {
    id: 'oral_002',
    type: 'cecrl',
    objective: 'oral',
    level: 'A2',
    questionFr: 'Quelle est la prononciation correcte pour "water" ?',
    question: 'What is the correct pronunciation of "water"?',
    options: ['/wɒtər/', '/wɔːtər/', '/weɪtər/', '/wɪtər/'],
    correctAnswer: 0,
    language: 'en',
  },
  {
    id: 'oral_003',
    type: 'cecrl',
    objective: 'oral',
    level: 'B1',
    questionFr: 'Quelle est la bonne accentuation pour "SUSject" ?',
    question: 'Where is the stress in "SUBject"?',
    options: ['on the second syllable', 'on the first syllable', 'equal on both', 'no stress pattern'],
    correctAnswer: 1,
    language: 'en',
  },
  {
    id: 'oral_004',
    type: 'cecrl',
    objective: 'oral',
    level: 'B1',
    questionFr: 'Comment répondriez-vous à "How are you ?" ?',
    question: 'How would you answer "How are you?"',
    options: ['I am fine, thank you', 'I am good, and you?', 'I am okay', 'All of the above are acceptable'],
    correctAnswer: 3,
    language: 'en',
  },
  {
    id: 'oral_005',
    type: 'cecrl',
    objective: 'oral',
    level: 'B2',
    questionFr: 'Complétez le dialogue : "Puis-je vous aider ?" "___"',
    question: 'Complete the dialogue: "Can I help you?" "___"',
    options: ['Yes, I can', 'I help you too', 'Yes, that would be helpful', 'No, I cannot'],
    correctAnswer: 2,
    language: 'en',
  },

  // CECRL - Écoute (5 questions for "oral" objective activation)
  {
    id: 'ecoute_001',
    type: 'cecrl',
    objective: 'ecoute',
    level: 'A1',
    questionFr: 'Vous entendez : "My name is Sarah." Quel est le nom ?',
    question: 'You hear: "My name is Sarah." What is the name?',
    options: ['Mary', 'Sarah', 'Susan', 'Sandra'],
    correctAnswer: 1,
    language: 'en',
  },
  {
    id: 'ecoute_002',
    type: 'cecrl',
    objective: 'ecoute',
    level: 'A2',
    questionFr: 'Vous entendez : "I live in London." Où habite cette personne ?',
    question: 'You hear: "I live in London." Where does this person live?',
    options: ['Paris', 'London', 'Dublin', 'Berlin'],
    correctAnswer: 1,
    language: 'en',
  },
  {
    id: 'ecoute_003',
    type: 'cecrl',
    objective: 'ecoute',
    level: 'B1',
    questionFr: 'Vous entendez : "The meeting was scheduled for Monday at 10 AM." À quelle heure est la réunion ?',
    question: 'You hear: "The meeting was scheduled for Monday at 10 AM." What time is the meeting?',
    options: ['9 AM', '10 AM', '11 AM', '10 PM'],
    correctAnswer: 1,
    language: 'en',
  },
  {
    id: 'ecoute_004',
    type: 'cecrl',
    objective: 'ecoute',
    level: 'B1',
    questionFr: 'Vous entendez un dialogue sur un restaurant. Quel est le sentiment du client ?',
    question: 'You hear a dialogue about a restaurant. What is the customer\'s feeling?',
    options: ['disappointed', 'satisfied', 'angry', 'confused'],
    correctAnswer: 1,
    language: 'en',
  },
  {
    id: 'ecoute_005',
    type: 'cecrl',
    objective: 'ecoute',
    level: 'B2',
    questionFr: 'Vous écoutez une présentation professionnelle. Quel est le sujet principal ?',
    question: 'You listen to a professional presentation. What is the main subject?',
    options: ['sales strategy', 'market analysis', 'company culture', 'financial results'],
    correctAnswer: 1,
    language: 'en',
  },

  // GRC - Questions (10 questions covering professional themes)
  {
    id: 'grc_001',
    type: 'grc',
    objective: 'vocabulaire',
    level: 'B1',
    questionFr: 'En contexte professionnel, que signifie "meeting" ?',
    question: 'In a professional context, what does a "meeting" involve?',
    options: ['casual lunch', 'scheduled gathering for discussion', 'surprise party', 'informal chat'],
    correctAnswer: 1,
    language: 'en',
    theme: 'meetings',
  },
  {
    id: 'grc_002',
    type: 'grc',
    objective: 'vocabulaire',
    level: 'B1',
    questionFr: 'Qu\'est-ce qu\'un "risk assessment" ?',
    question: 'What is a "risk assessment"?',
    options: ['a financial report', 'evaluation of potential dangers or negative outcomes', 'a marketing strategy', 'a team building activity'],
    correctAnswer: 1,
    language: 'en',
    theme: 'risk',
  },
  {
    id: 'grc_003',
    type: 'grc',
    objective: 'vocabulaire',
    level: 'B2',
    questionFr: 'Quel est le rôle principal d\'un audit ?',
    question: 'What is the primary role of an audit?',
    options: ['to increase sales', 'to verify financial records and ensure compliance', 'to hire employees', 'to design products'],
    correctAnswer: 1,
    language: 'en',
    theme: 'audit',
  },
  {
    id: 'grc_004',
    type: 'grc',
    objective: 'vocabulaire',
    level: 'B1',
    questionFr: 'Que signifie "compliance" dans une entreprise ?',
    question: 'What does "compliance" mean in a business context?',
    options: ['complaining about rules', 'adhering to rules and regulations', 'being friendly', 'making profits'],
    correctAnswer: 1,
    language: 'en',
    theme: 'compliance',
  },
  {
    id: 'grc_005',
    type: 'grc',
    objective: 'vocabulaire',
    level: 'B2',
    questionFr: 'Qu\'est-ce qu\'un "control" en environnement professionnel ?',
    question: 'What is a "control" in a professional environment?',
    options: ['managing people with authority', 'a measure to ensure processes work correctly', 'controlling emotions', 'monitoring the weather'],
    correctAnswer: 1,
    language: 'en',
    theme: 'control',
  },
  {
    id: 'grc_006',
    type: 'grc',
    objective: 'vocabulaire',
    level: 'B1',
    questionFr: 'Quel service fournit du "consulting" ?',
    question: 'What does a consulting firm provide?',
    options: ['food and beverages', 'expert advice on business matters', 'entertainment', 'transportation'],
    correctAnswer: 1,
    language: 'en',
    theme: 'consulting',
  },
  {
    id: 'grc_007',
    type: 'grc',
    objective: 'vocabulaire',
    level: 'B2',
    questionFr: 'Que signifie "governance" ?',
    question: 'What does "governance" mean?',
    options: ['government only', 'system of directing and controlling an organization', 'making laws', 'managing a country'],
    correctAnswer: 1,
    language: 'en',
    theme: 'governance',
  },
  {
    id: 'grc_008',
    type: 'grc',
    objective: 'vocabulaire',
    level: 'B2',
    questionFr: 'Qu\'est-ce que la "cybersecurity" protège ?',
    question: 'What does "cybersecurity" protect?',
    options: ['physical buildings', 'digital systems and data from unauthorized access', 'employees only', 'products'],
    correctAnswer: 1,
    language: 'en',
    theme: 'cybersecurity',
  },
  {
    id: 'grc_009',
    type: 'grc',
    objective: 'ecrit',
    level: 'B1',
    questionFr: 'Phrase correcte pour une réunion professionnel : "Can we _____ this meeting ?"',
    question: 'Complete the professional sentence: "Can we ___ this meeting?"',
    options: ['discuss', 'have', 'reschedule', 'all of the above'],
    correctAnswer: 3,
    language: 'en',
    theme: 'meetings',
  },
  {
    id: 'grc_010',
    type: 'grc',
    objective: 'lecture',
    level: 'B2',
    questionFr: 'Lisez : "To mitigate cybersecurity risks, companies must implement robust security protocols." Que doivent faire les entreprises ?',
    question: 'Read: "To mitigate cybersecurity risks, companies must implement robust security protocols." What must companies do?',
    options: ['ignore threats', 'implement security protocols', 'buy new software', 'hire more IT staff'],
    correctAnswer: 1,
    language: 'en',
    theme: 'cybersecurity',
  },
];

/**
 * Get diagnostic questions filtered by language and selected objectives
 * For "oral" objective, both "oral" and "ecoute" questions are included
 *
 * @param language - Language code (e.g., 'en')
 * @param objectives - Array of selected learning objectives
 * @param hasGrcThemes - Whether to include GRC theme questions
 * @returns Array of filtered diagnostic questions
 */
export function getDiagnosticQuestions(
  language: LearningLanguage,
  objectives: LearningObjective[],
  hasGrcThemes: boolean = false
): DiagnosticQuestion[] {
  return DIAGNOSTIC_QUESTIONS.filter((question) => {
    // Filter by language
    if (question.language !== language) {
      return false;
    }

    // Filter by GRC themes
    if (hasGrcThemes && question.type === 'grc') {
      return true;
    }

    // For CECRL questions, filter by selected objectives
    // CDC Section 14.4: Mapping objectifs → sections d'évaluation
    // Special: "oral" objective activates both "oral" AND "ecoute" sections
    if (question.type === 'cecrl') {
      if (question.objective === 'ecoute') {
        return objectives.includes('oral');
      }
      return objectives.includes(question.objective as LearningObjective);
    }

    return false;
  });
}

export default DIAGNOSTIC_QUESTIONS;
