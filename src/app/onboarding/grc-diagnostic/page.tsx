'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { t } from '@/lib/i18n';
import BottomNav from '@/components/BottomNav';
import { updateUserProgress } from '@/lib/db/localStorage';
import { LevelGRC, InterfaceLanguage } from '@/types';

interface GRCQuestion {
  id: number;
  questionFr: string;
  questionEn: string;
  options: Array<{
    labelFr: string;
    labelEn: string;
    points: number;
  }>;
}

const GRC_QUESTIONS: GRCQuestion[] = [
  {
    id: 1,
    questionFr: 'Quel est votre rôle actuel en GRC ?',
    questionEn: 'What is your current role in GRC?',
    options: [
      { labelFr: 'Étudiant/Débutant', labelEn: 'Student/Beginner', points: 0 },
      { labelFr: 'Analyste/Consultant junior', labelEn: 'Junior Analyst/Consultant', points: 1 },
      { labelFr: 'Manager/Responsable', labelEn: 'Manager/Responsible', points: 2 },
      { labelFr: 'Directeur/Expert', labelEn: 'Director/Expert', points: 3 },
    ],
  },
  {
    id: 2,
    questionFr: 'Combien d\'années d\'expérience avez-vous en GRC ?',
    questionEn: 'How many years of GRC experience do you have?',
    options: [
      { labelFr: '0-1 an', labelEn: '0-1 year', points: 0 },
      { labelFr: '2-4 ans', labelEn: '2-4 years', points: 1 },
      { labelFr: '5-9 ans', labelEn: '5-9 years', points: 2 },
      { labelFr: '10+ ans', labelEn: '10+ years', points: 3 },
    ],
  },
  {
    id: 3,
    questionFr: 'Quel cadre réglementaire connaissez-vous le mieux ?',
    questionEn: 'Which regulatory framework do you know best?',
    options: [
      { labelFr: 'Aucun/basique', labelEn: 'None/Basic', points: 0 },
      { labelFr: 'ISO 27001/SOX', labelEn: 'ISO 27001/SOX', points: 1 },
      { labelFr: 'COSO/COBIT', labelEn: 'COSO/COBIT', points: 2 },
      { labelFr: 'Plusieurs cadres', labelEn: 'Multiple frameworks', points: 3 },
    ],
  },
  {
    id: 4,
    questionFr: 'Comment évaluez-vous votre anglais professionnel GRC ?',
    questionEn: 'How do you evaluate your GRC professional English?',
    options: [
      { labelFr: 'Débutant total', labelEn: 'Complete beginner', points: 0 },
      { labelFr: 'Comprend les basiques', labelEn: 'Understands basics', points: 1 },
      { labelFr: 'Peut participer à un meeting', labelEn: 'Can participate in meetings', points: 2 },
      { labelFr: 'Maîtrise complète', labelEn: 'Complete mastery', points: 3 },
    ],
  },
  {
    id: 5,
    questionFr: 'Quel type de document GRC rédigez-vous ?',
    questionEn: 'What type of GRC document do you write?',
    options: [
      { labelFr: 'Aucun', labelEn: 'None', points: 0 },
      { labelFr: 'Rapports simples', labelEn: 'Simple reports', points: 1 },
      { labelFr: 'Analyses de risques', labelEn: 'Risk analyses', points: 2 },
      { labelFr: 'Rapports d\'audit complets', labelEn: 'Complete audit reports', points: 3 },
    ],
  },
  {
    id: 6,
    questionFr: 'Participez-vous à des comités d\'audit en anglais ?',
    questionEn: 'Do you participate in audit committees in English?',
    options: [
      { labelFr: 'Jamais', labelEn: 'Never', points: 0 },
      { labelFr: 'Observer', labelEn: 'Observer', points: 1 },
      { labelFr: 'Participant', labelEn: 'Participant', points: 2 },
      { labelFr: 'Animateur', labelEn: 'Facilitator', points: 3 },
    ],
  },
];

function scoreToGRCLevel(score: number): LevelGRC {
  if (score <= 5) return 'Junior';
  if (score <= 10) return 'Intermédiaire';
  if (score <= 14) return 'Senior';
  return 'Expert';
}

interface QuestionAnswers {
  [key: number]: number;
}

export default function GRCDiagnosticPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [interfaceLang, setInterfaceLang] = useState<InterfaceLanguage>('fr');

  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<QuestionAnswers>({});
  const [showResult, setShowResult] = useState(false);
  const [resultLevel, setResultLevel] = useState<LevelGRC>('Junior');
  const [totalScore, setTotalScore] = useState(0);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth');
      return;
    }
    if (!loading && user) {
      setInterfaceLang(user.settings.interfaceLang);
      // Check if GRC diagnostic already completed
      if (user.progress[user.activeLang || 'en']?.grcDiagnosticCompleted) {
        router.push('/dashboard');
      }
    }
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        {t('general.loading', interfaceLang)}
      </div>
    );
  }

  const handleSelectOption = (questionId: number, points: number) => {
    const newAnswers = { ...answers, [questionId]: points };
    setAnswers(newAnswers);

    // Auto-advance to next question if not last
    if (currentQuestion < GRC_QUESTIONS.length - 1) {
      setTimeout(() => setCurrentQuestion(currentQuestion + 1), 300);
    }
  };

  const handleFinishQuestions = () => {
    // Calculate total score
    const score = Object.values(answers).reduce((acc, val) => acc + val, 0);
    const level = scoreToGRCLevel(score);

    setTotalScore(score);
    setResultLevel(level);
    setShowResult(true);
  };

  const handleContinue = () => {
    // Update user progress with GRC level
    const activeLang = user.activeLang || 'en';
    updateUserProgress(user.id, activeLang, {
      levelGrc: resultLevel,
      grcDiagnosticCompleted: true,
    });

    // Navigate to dashboard
    router.push('/dashboard');
  };

  // Progress bar
  const progressPercent = showResult ? 100 : ((currentQuestion) / GRC_QUESTIONS.length) * 100;

  const question = GRC_QUESTIONS[currentQuestion];
  const selectedOption = answers[question?.id];
  const allAnswered = GRC_QUESTIONS.every(q => answers[q.id] !== undefined);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white p-3 sm:p-6">
      <div className="max-w-lg mx-auto">
        {/* Progress bar */}
        <div className="w-full mb-6">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-base font-bold text-[#002844]">
              {interfaceLang === 'fr' ? 'Diagnostic GRC' : 'GRC Diagnostic'}
            </h1>
            {!showResult && (
              <span className="text-xs text-[#555555]">
                {currentQuestion + 1}/{GRC_QUESTIONS.length}
              </span>
            )}
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
            <div
              className="h-full transition-all duration-500 rounded-full"
              style={{
                width: `${progressPercent}%`,
                backgroundColor: '#D9B438',
              }}
            />
          </div>
        </div>

        {/* Main content */}
        <div className="bg-white rounded-2xl shadow-lg p-4 sm:p-6 mb-4">
          {!showResult ? (
            <div className="space-y-6">
              {/* Question */}
              <div>
                <h2 className="text-lg font-bold text-[#002844]">
                  {interfaceLang === 'fr' ? question?.questionFr : question?.questionEn}
                </h2>
              </div>

              {/* Options */}
              <div className="space-y-3">
                {question?.options.map((option, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSelectOption(question.id, option.points)}
                    className={`w-full p-4 rounded-2xl border-2 text-left transition-all font-semibold ${
                      selectedOption === option.points
                        ? 'border-[#D9B438] bg-[#D9B438]/10 text-[#002844]'
                        : 'border-gray-200 bg-white text-[#002844] hover:border-[#002844]/30'
                    }`}
                  >
                    {interfaceLang === 'fr' ? option.labelFr : option.labelEn}
                  </button>
                ))}
              </div>

              {/* Navigation */}
              <div className="flex gap-3 justify-between pt-4">
                <button
                  onClick={() =>
                    setCurrentQuestion(Math.max(0, currentQuestion - 1))
                  }
                  disabled={currentQuestion === 0}
                  className={`px-5 py-2.5 rounded-lg font-semibold transition-all ${
                    currentQuestion === 0
                      ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      : 'bg-white border border-gray-300 text-[#002844] hover:bg-gray-50'
                  }`}
                >
                  {interfaceLang === 'fr' ? '← Précédent' : '← Previous'}
                </button>

                {currentQuestion < GRC_QUESTIONS.length - 1 ? (
                  <button
                    onClick={() => setCurrentQuestion(currentQuestion + 1)}
                    disabled={selectedOption === undefined}
                    className={`px-6 py-2.5 rounded-lg font-semibold transition-all ${
                      selectedOption === undefined
                        ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                        : 'hover:shadow-md'
                    }`}
                    style={{
                      backgroundColor:
                        selectedOption !== undefined ? '#D9B438' : '#ccc',
                      color: '#002844',
                    }}
                  >
                    {interfaceLang === 'fr' ? 'Suivant →' : 'Next →'}
                  </button>
                ) : (
                  <button
                    onClick={handleFinishQuestions}
                    disabled={!allAnswered}
                    className={`px-6 py-2.5 rounded-lg font-semibold transition-all ${
                      !allAnswered
                        ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                        : 'hover:shadow-md'
                    }`}
                    style={{
                      backgroundColor: allAnswered ? '#D9B438' : '#ccc',
                      color: '#002844',
                    }}
                  >
                    {interfaceLang === 'fr' ? 'Terminer' : 'Finish'}
                  </button>
                )}
              </div>
            </div>
          ) : (
            // Result screen
            <div className="text-center space-y-6">
              <div className="text-6xl mb-4">🏆</div>

              <div>
                <h2 className="text-2xl font-bold text-[#002844] mb-2">
                  {interfaceLang === 'fr' ? 'Votre niveau GRC' : 'Your GRC Level'}
                </h2>
                <div className="inline-block px-6 py-3 rounded-full text-xl font-bold text-white"
                  style={{ backgroundColor: '#002844' }}>
                  {resultLevel}
                </div>
              </div>

              <div className="text-sm text-[#555555]">
                <p>
                  {interfaceLang === 'fr'
                    ? `Score : ${totalScore} / 18 points`
                    : `Score: ${totalScore} / 18 points`}
                </p>
                <p className="mt-2">
                  {resultLevel === 'Junior' &&
                    (interfaceLang === 'fr'
                      ? 'Vous commencez votre parcours en GRC. Concentrez-vous sur les fondamentaux !'
                      : 'You are starting your GRC journey. Focus on the fundamentals!')}
                  {resultLevel === 'Intermédiaire' &&
                    (interfaceLang === 'fr'
                      ? 'Vous avez une bonne base en GRC. Développez vos compétences avancées !'
                      : 'You have a solid GRC foundation. Develop advanced skills!')}
                  {resultLevel === 'Senior' &&
                    (interfaceLang === 'fr'
                      ? 'Vous êtes un professionnel GRC confirmé. Affinez votre expertise !'
                      : 'You are an experienced GRC professional. Refine your expertise!')}
                  {resultLevel === 'Expert' &&
                    (interfaceLang === 'fr'
                      ? 'Vous êtes un expert en GRC. Restez à la pointe des dernières tendances !'
                      : 'You are a GRC expert. Stay up-to-date with the latest trends!')}
                </p>
              </div>

              <button
                onClick={handleContinue}
                className="w-full py-4 rounded-xl font-bold text-lg transition-all hover:shadow-lg"
                style={{ backgroundColor: '#D9B438', color: '#002844' }}
              >
                {interfaceLang === 'fr' ? 'Continuer →' : 'Continue →'}
              </button>
            </div>
          )}
        </div>
      </div>
      <BottomNav lang={interfaceLang} />
    </div>
  );
}
