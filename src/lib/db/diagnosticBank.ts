import { LearningLanguage, LearningObjective } from '@/types';

export interface DiagnosticQuestion {
  id: string;
  type: 'cecrl' | 'grc';
  objective: LearningObjective | 'ecoute';
  level: 'A1' | 'A2' | 'B1' | 'B2';
  questionFr: string;
  question: string;
  options: string[];
  correctAnswer: number;
  language: LearningLanguage;
  theme?: string;
  interactionType: 'text' | 'listening' | 'speaking';
  audioText?: string; // TTS text for listening questions
}

const DIAGNOSTIC_QUESTIONS: DiagnosticQuestion[] = [
  // CECRL - Grammaire (5 questions) - text
  {
    id: 'gram_001', type: 'cecrl', objective: 'grammaire', level: 'A1', interactionType: 'text',
    questionFr: 'Complétez : "Je ___ un étudiant."',
    question: 'Complete: "I ___ a student."',
    options: ['am', 'is', 'are', 'be'], correctAnswer: 0, language: 'en',
  },
  {
    id: 'gram_002', type: 'cecrl', objective: 'grammaire', level: 'A1', interactionType: 'text',
    questionFr: 'Quel est le pluriel de "child" ?',
    question: 'What is the plural of "child"?',
    options: ['childs', 'children', 'childes', 'child'], correctAnswer: 1, language: 'en',
  },
  {
    id: 'gram_003', type: 'cecrl', objective: 'grammaire', level: 'A2', interactionType: 'text',
    questionFr: 'Complétez : "Si je ___ riche, je voyagerais."',
    question: 'Complete: "If I ___ rich, I would travel."',
    options: ['am', 'was', 'were', 'have been'], correctAnswer: 2, language: 'en',
  },
  {
    id: 'gram_004', type: 'cecrl', objective: 'grammaire', level: 'B1', interactionType: 'text',
    questionFr: 'Laquelle est correcte ? "Je suis allé" en anglais :',
    question: 'Which is correct? "I went" in past perfect:',
    options: ['I have gone', 'I have went', 'I am gone', 'I did go'], correctAnswer: 0, language: 'en',
  },
  {
    id: 'gram_005', type: 'cecrl', objective: 'grammaire', level: 'B2', interactionType: 'text',
    questionFr: 'Complétez : "Bien qu\'il ___ occupé, il a accepté."',
    question: 'Complete: "Although he ___ busy, he accepted."',
    options: ['is', 'was', 'were', 'had been'], correctAnswer: 1, language: 'en',
  },

  // CECRL - Vocabulaire (5 questions) - text
  {
    id: 'vocab_001', type: 'cecrl', objective: 'vocabulaire', level: 'A1', interactionType: 'text',
    questionFr: 'Quel est le contraire de "hot" ?',
    question: 'What is the opposite of "hot"?',
    options: ['warm', 'cold', 'cool', 'freezing'], correctAnswer: 1, language: 'en',
  },
  {
    id: 'vocab_002', type: 'cecrl', objective: 'vocabulaire', level: 'A1', interactionType: 'text',
    questionFr: 'Quel mot signifie "maison" ?',
    question: 'Which word means "a place where you live"?',
    options: ['hospital', 'school', 'house', 'park'], correctAnswer: 2, language: 'en',
  },
  {
    id: 'vocab_003', type: 'cecrl', objective: 'vocabulaire', level: 'A2', interactionType: 'text',
    questionFr: 'Que signifie "exhausted" ?',
    question: 'What does "exhausted" mean?',
    options: ['excited', 'very tired', 'confused', 'angry'], correctAnswer: 1, language: 'en',
  },
  {
    id: 'vocab_004', type: 'cecrl', objective: 'vocabulaire', level: 'B1', interactionType: 'text',
    questionFr: 'Que signifie "persévérer" en anglais ?',
    question: 'What is the English word for "continue despite difficulties"?',
    options: ['persist', 'hesitate', 'abandon', 'postpone'], correctAnswer: 0, language: 'en',
  },
  {
    id: 'vocab_005', type: 'cecrl', objective: 'vocabulaire', level: 'B2', interactionType: 'text',
    questionFr: 'Que signifie "ambiguous" ?',
    question: 'What does "ambiguous" mean?',
    options: ['clear', 'uncertain or having multiple meanings', 'obvious', 'detailed'], correctAnswer: 1, language: 'en',
  },

  // CECRL - Lecture (5 questions) - text
  {
    id: 'lecture_001', type: 'cecrl', objective: 'lecture', level: 'A1', interactionType: 'text',
    questionFr: 'Lis : "My name is John." Quel est le nom ?',
    question: 'Read: "My name is John." What is the person\'s name?',
    options: ['Mary', 'John', 'Sarah', 'Tom'], correctAnswer: 1, language: 'en',
  },
  {
    id: 'lecture_002', type: 'cecrl', objective: 'lecture', level: 'A2', interactionType: 'text',
    questionFr: 'Lis : "The cat is black and white." De quelle couleur est le chat ?',
    question: 'Read: "The cat is black and white." What color is the cat?',
    options: ['black', 'white', 'black and white', 'gray'], correctAnswer: 2, language: 'en',
  },
  {
    id: 'lecture_003', type: 'cecrl', objective: 'lecture', level: 'B1', interactionType: 'text',
    questionFr: 'Lis : "Elle a travaillé dur, donc elle a réussi."',
    question: 'Read: "She worked hard, so she succeeded." Why did she succeed?',
    options: ['she was lucky', 'she worked hard', 'she had help', 'she was talented'], correctAnswer: 1, language: 'en',
  },
  {
    id: 'lecture_004', type: 'cecrl', objective: 'lecture', level: 'B1', interactionType: 'text',
    questionFr: 'Lis : "The conference was postponed due to unforeseen circumstances."',
    question: 'Read: "The conference was postponed due to unforeseen circumstances." Why?',
    options: ['lack of interest', 'unexpected events', 'bad weather', 'insufficient budget'], correctAnswer: 1, language: 'en',
  },
  {
    id: 'lecture_005', type: 'cecrl', objective: 'lecture', level: 'B2', interactionType: 'text',
    questionFr: 'Lis : "Despite the initial skepticism..." Sentiment initial ?',
    question: 'Read: "Despite the initial skepticism, the approach proved beneficial." Initial feeling?',
    options: ['enthusiasm', 'doubt', 'indifference', 'excitement'], correctAnswer: 1, language: 'en',
  },

  // CECRL - Écrit (5 questions) - text
  {
    id: 'ecrit_001', type: 'cecrl', objective: 'ecrit', level: 'A1', interactionType: 'text',
    questionFr: 'Écrivez le présent : "I ___ like pizza."',
    question: 'Choose the correct form: "I ___ like pizza."',
    options: ['are', 'am', 'is', 'do'], correctAnswer: 1, language: 'en',
  },
  {
    id: 'ecrit_002', type: 'cecrl', objective: 'ecrit', level: 'A2', interactionType: 'text',
    questionFr: 'Complétez : "Yesterday, I ___ to the cinema."',
    question: 'Complete: "Yesterday, I ___ to the cinema."',
    options: ['go', 'went', 'gone', 'going'], correctAnswer: 1, language: 'en',
  },
  {
    id: 'ecrit_003', type: 'cecrl', objective: 'ecrit', level: 'B1', interactionType: 'text',
    questionFr: 'Quelle phrase est correcte ?',
    question: 'Which sentence is correct?',
    options: ['I have not went there', 'I have not been there', 'I am not been there', 'I have not go there'], correctAnswer: 1, language: 'en',
  },
  {
    id: 'ecrit_004', type: 'cecrl', objective: 'ecrit', level: 'B1', interactionType: 'text',
    questionFr: 'Choisissez la phrase bien écrite :',
    question: 'Choose the well-written sentence:',
    options: ['She said me that she was happy', 'She told me that she was happy', 'She said to me that she happy', 'She told me that she is happy'], correctAnswer: 1, language: 'en',
  },
  {
    id: 'ecrit_005', type: 'cecrl', objective: 'ecrit', level: 'B2', interactionType: 'text',
    questionFr: 'Quelle phrase respecte la grammaire avancée ?',
    question: 'Which sentence has correct advanced grammar?',
    options: ['I would have liked to have gone', 'I would have like to go', 'I would liked to have went', 'I would like to have gone'], correctAnswer: 0, language: 'en',
  },

  // CECRL - Oral / Speaking (5 questions) - SPEAKING type (#6)
  {
    id: 'oral_001', type: 'cecrl', objective: 'oral', level: 'A1', interactionType: 'speaking',
    questionFr: 'Dis "Hello, my name is..." suivi de ton prénom.',
    question: 'Say "Hello, my name is..." followed by your first name.',
    options: ['Correct pronunciation', 'Minor errors', 'Major errors', 'No answer'],
    correctAnswer: 0, language: 'en',
  },
  {
    id: 'oral_002', type: 'cecrl', objective: 'oral', level: 'A2', interactionType: 'speaking',
    questionFr: 'Prononce : "I would like a glass of water, please."',
    question: 'Say: "I would like a glass of water, please."',
    options: ['Correct pronunciation', 'Minor errors', 'Major errors', 'No answer'],
    correctAnswer: 0, language: 'en',
  },
  {
    id: 'oral_003', type: 'cecrl', objective: 'oral', level: 'B1', interactionType: 'speaking',
    questionFr: 'Décris ta journée typique en 2-3 phrases.',
    question: 'Describe your typical day in 2-3 sentences.',
    options: ['Clear and fluent', 'Understandable with some hesitation', 'Difficult to understand', 'No answer'],
    correctAnswer: 0, language: 'en',
  },
  {
    id: 'oral_004', type: 'cecrl', objective: 'oral', level: 'B1', interactionType: 'speaking',
    questionFr: 'Explique pourquoi tu apprends cette langue.',
    question: 'Explain why you are learning this language.',
    options: ['Clear and fluent', 'Understandable with some hesitation', 'Difficult to understand', 'No answer'],
    correctAnswer: 0, language: 'en',
  },
  {
    id: 'oral_005', type: 'cecrl', objective: 'oral', level: 'B2', interactionType: 'speaking',
    questionFr: 'Donne ton opinion sur le travail à distance.',
    question: 'Give your opinion on remote work.',
    options: ['Clear, structured argument', 'Good but lacks structure', 'Basic opinion only', 'No answer'],
    correctAnswer: 0, language: 'en',
  },

  // CECRL - Écoute / Listening (5 questions) - LISTENING type with TTS (#5)
  {
    id: 'ecoute_001', type: 'cecrl', objective: 'ecoute', level: 'A1', interactionType: 'listening',
    questionFr: 'Écoute et réponds : quel est le nom de la personne ?',
    question: 'Listen and answer: what is the person\'s name?',
    audioText: 'My name is Sarah. I am from London.',
    options: ['Mary', 'Sarah', 'Susan', 'Sandra'], correctAnswer: 1, language: 'en',
  },
  {
    id: 'ecoute_002', type: 'cecrl', objective: 'ecoute', level: 'A2', interactionType: 'listening',
    questionFr: 'Écoute et réponds : où habite cette personne ?',
    question: 'Listen and answer: where does this person live?',
    audioText: 'I live in London. I have lived here for five years.',
    options: ['Paris', 'London', 'Dublin', 'Berlin'], correctAnswer: 1, language: 'en',
  },
  {
    id: 'ecoute_003', type: 'cecrl', objective: 'ecoute', level: 'B1', interactionType: 'listening',
    questionFr: 'Écoute et réponds : à quelle heure est la réunion ?',
    question: 'Listen and answer: what time is the meeting?',
    audioText: 'The meeting was scheduled for Monday at ten in the morning. Please be on time.',
    options: ['9 AM', '10 AM', '11 AM', '10 PM'], correctAnswer: 1, language: 'en',
  },
  {
    id: 'ecoute_004', type: 'cecrl', objective: 'ecoute', level: 'B1', interactionType: 'listening',
    questionFr: 'Écoute le dialogue. Quel est le sentiment du client ?',
    question: 'Listen to the dialogue. What is the customer\'s feeling?',
    audioText: 'The food was excellent and the service was wonderful. I will definitely come back to this restaurant.',
    options: ['disappointed', 'satisfied', 'angry', 'confused'], correctAnswer: 1, language: 'en',
  },
  {
    id: 'ecoute_005', type: 'cecrl', objective: 'ecoute', level: 'B2', interactionType: 'listening',
    questionFr: 'Écoute la présentation. Quel est le sujet principal ?',
    question: 'Listen to the presentation. What is the main subject?',
    audioText: 'Today we will analyze the market trends for the second quarter. Our research shows significant growth in the technology sector.',
    options: ['sales strategy', 'market analysis', 'company culture', 'financial results'], correctAnswer: 1, language: 'en',
  },

  // GRC - Questions (10 questions) - text
  {
    id: 'grc_001', type: 'grc', objective: 'vocabulaire', level: 'B1', interactionType: 'text',
    questionFr: 'En contexte professionnel, que signifie "meeting" ?',
    question: 'In a professional context, what does a "meeting" involve?',
    options: ['casual lunch', 'scheduled gathering for discussion', 'surprise party', 'informal chat'],
    correctAnswer: 1, language: 'en', theme: 'meetings',
  },
  {
    id: 'grc_002', type: 'grc', objective: 'vocabulaire', level: 'B1', interactionType: 'text',
    questionFr: 'Qu\'est-ce qu\'un "risk assessment" ?',
    question: 'What is a "risk assessment"?',
    options: ['a financial report', 'evaluation of potential dangers or negative outcomes', 'a marketing strategy', 'a team building activity'],
    correctAnswer: 1, language: 'en', theme: 'risk',
  },
  {
    id: 'grc_003', type: 'grc', objective: 'vocabulaire', level: 'B2', interactionType: 'text',
    questionFr: 'Quel est le rôle principal d\'un audit ?',
    question: 'What is the primary role of an audit?',
    options: ['to increase sales', 'to verify financial records and ensure compliance', 'to hire employees', 'to design products'],
    correctAnswer: 1, language: 'en', theme: 'audit',
  },
  {
    id: 'grc_004', type: 'grc', objective: 'vocabulaire', level: 'B1', interactionType: 'text',
    questionFr: 'Que signifie "compliance" dans une entreprise ?',
    question: 'What does "compliance" mean in a business context?',
    options: ['complaining about rules', 'adhering to rules and regulations', 'being friendly', 'making profits'],
    correctAnswer: 1, language: 'en', theme: 'compliance',
  },
  {
    id: 'grc_005', type: 'grc', objective: 'vocabulaire', level: 'B2', interactionType: 'text',
    questionFr: 'Qu\'est-ce qu\'un "control" en environnement professionnel ?',
    question: 'What is a "control" in a professional environment?',
    options: ['managing people with authority', 'a measure to ensure processes work correctly', 'controlling emotions', 'monitoring the weather'],
    correctAnswer: 1, language: 'en', theme: 'control',
  },
  {
    id: 'grc_006', type: 'grc', objective: 'vocabulaire', level: 'B1', interactionType: 'text',
    questionFr: 'Quel service fournit du "consulting" ?',
    question: 'What does a consulting firm provide?',
    options: ['food and beverages', 'expert advice on business matters', 'entertainment', 'transportation'],
    correctAnswer: 1, language: 'en', theme: 'consulting',
  },
  {
    id: 'grc_007', type: 'grc', objective: 'vocabulaire', level: 'B2', interactionType: 'text',
    questionFr: 'Que signifie "governance" ?',
    question: 'What does "governance" mean?',
    options: ['government only', 'system of directing and controlling an organization', 'making laws', 'managing a country'],
    correctAnswer: 1, language: 'en', theme: 'governance',
  },
  {
    id: 'grc_008', type: 'grc', objective: 'vocabulaire', level: 'B2', interactionType: 'text',
    questionFr: 'Qu\'est-ce que la "cybersecurity" protège ?',
    question: 'What does "cybersecurity" protect?',
    options: ['physical buildings', 'digital systems and data from unauthorized access', 'employees only', 'products'],
    correctAnswer: 1, language: 'en', theme: 'cybersecurity',
  },
  {
    id: 'grc_009', type: 'grc', objective: 'ecrit', level: 'B1', interactionType: 'text',
    questionFr: 'Phrase correcte pour une réunion : "Can we ___ this meeting?"',
    question: 'Complete the professional sentence: "Can we ___ this meeting?"',
    options: ['discuss', 'have', 'reschedule', 'all of the above'],
    correctAnswer: 3, language: 'en', theme: 'meetings',
  },
  {
    id: 'grc_010', type: 'grc', objective: 'lecture', level: 'B2', interactionType: 'text',
    questionFr: 'Lisez : "To mitigate cybersecurity risks..." Que doivent faire les entreprises ?',
    question: 'Read: "To mitigate cybersecurity risks, companies must implement robust security protocols." What must companies do?',
    options: ['ignore threats', 'implement security protocols', 'buy new software', 'hire more IT staff'],
    correctAnswer: 1, language: 'en', theme: 'cybersecurity',
  },
];

// Get CECRL questions only (Correction #3)
export function getCECRLQuestions(
  language: LearningLanguage,
  objectives: LearningObjective[]
): DiagnosticQuestion[] {
  return DIAGNOSTIC_QUESTIONS.filter((q) => {
    if (q.language !== language) return false;
    if (q.type !== 'cecrl') return false;
    if (q.objective === 'ecoute') return objectives.includes('oral');
    return objectives.includes(q.objective as LearningObjective);
  });
}

// Get GRC questions only (Correction #3)
export function getGRCQuestions(language: LearningLanguage): DiagnosticQuestion[] {
  return DIAGNOSTIC_QUESTIONS.filter((q) => {
    if (q.language !== language) return false;
    return q.type === 'grc';
  });
}

// Legacy compatible
export function getDiagnosticQuestions(
  language: LearningLanguage,
  objectives: LearningObjective[],
  hasGrcThemes: boolean = false
): DiagnosticQuestion[] {
  const cecrl = getCECRLQuestions(language, objectives);
  if (hasGrcThemes) {
    return [...cecrl, ...getGRCQuestions(language)];
  }
  return cecrl;
}

export default DIAGNOSTIC_QUESTIONS;
