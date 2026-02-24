'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { t } from '@/lib/i18n';
import { updateUserSettings } from '@/lib/db/localStorage';
import {
  LEARNING_LANGUAGES,
  LEARNING_OBJECTIVES,
  PERSONAL_THEMES,
  PROFESSIONAL_THEMES,
  SESSION_DURATIONS,
  DAYS_OF_WEEK,
  InterfaceLanguage,
  LearningLanguage,
  LearningObjective,
  DayOfWeek,
  SessionDuration,
} from '@/types';

export default function OnboardingPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  // State management
  const [currentStep, setCurrentStep] = useState(1);
  const [interfaceLang, setInterfaceLang] = useState<InterfaceLanguage>('fr');
  const [learningLangs, setLearningLangs] = useState<LearningLanguage[]>([]);
  const [objectives, setObjectives] = useState<LearningObjective[]>([]);
  const [selectedThemes, setSelectedThemes] = useState<string[]>([]);
  const [selectedDays, setSelectedDays] = useState<DayOfWeek[]>([]);
  const [selectedDuration, setSelectedDuration] = useState<SessionDuration>(20);
  const [errors, setErrors] = useState<string[]>([]);

  // Redirect if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth');
    }
  }, [user, loading, router]);

  if (loading || !user) {
    return <div className="flex items-center justify-center min-h-screen">{t('general.loading', interfaceLang)}</div>;
  }

  // Helper functions
  const toggleLearningLang = (lang: LearningLanguage) => {
    setLearningLangs(prev =>
      prev.includes(lang) ? prev.filter(l => l !== lang) : [...prev, lang]
    );
  };

  const toggleObjective = (obj: LearningObjective) => {
    setObjectives(prev =>
      prev.includes(obj) ? prev.filter(o => o !== obj) : [...prev, obj]
    );
  };

  const toggleTheme = (themeId: string) => {
    setSelectedThemes(prev =>
      prev.includes(themeId) ? prev.filter(t => t !== themeId) : [...prev, themeId]
    );
  };

  const toggleDay = (day: DayOfWeek) => {
    setSelectedDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  // Validation functions
  const validateStep = (step: number): boolean => {
    setErrors([]);
    const newErrors: string[] = [];

    if (step === 1) {
      if (learningLangs.length === 0) {
        newErrors.push(t('onboarding.screen1.selectAtLeast1', interfaceLang));
      }
    } else if (step === 2) {
      if (objectives.length === 0) {
        newErrors.push(t('onboarding.screen2.objectives', interfaceLang));
      }
      if (selectedThemes.length === 0) {
        newErrors.push(t('onboarding.screen2.selectAtLeast1Theme', interfaceLang));
      }
    } else if (step === 3) {
      if (selectedDays.length === 0) {
        newErrors.push(t('onboarding.screen3.selectAtLeast1Day', interfaceLang));
      }
    }

    setErrors(newErrors);
    return newErrors.length === 0;
  };

  // Navigation
  const handleNext = () => {
    if (validateStep(currentStep)) {
      if (currentStep < 4) {
        setCurrentStep(currentStep + 1);
      }
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  // Calculate hasGrcThemes
  const hasGrcThemes = selectedThemes.some(themeId =>
    PROFESSIONAL_THEMES.some(pt => pt.id === themeId)
  );

  // Handle finish onboarding
  const handleStartDiagnostic = async () => {
    if (!validateStep(4)) return;

    const settings = {
      interfaceLang,
      learningLangs,
      selectedThemes,
      objectives,
      schedule: {
        days: selectedDays,
        duration: selectedDuration,
      },
    };

    // Update user settings in localStorage
    const updated = updateUserSettings(user.id, settings);

    if (updated) {
      router.push('/onboarding/diagnostic');
    }
  };

  // Render step indicator with progress bar
  const ProgressBar = () => (
    <div className="w-full mb-8">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-800">
          {t('onboarding.step', interfaceLang)} {currentStep} {t('onboarding.of', interfaceLang)} 4
        </h1>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
        <div
          className="h-full bg-yellow-500 transition-all duration-300"
          style={{ width: `${(currentStep / 4) * 100}%`, backgroundColor: '#D9B438' }}
        />
      </div>
    </div>
  );

  // ============ SCREEN 1: General Settings ============
  const Screen1 = () => (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold mb-4 text-gray-800">{t('onboarding.screen1.title', interfaceLang)}</h2>
      </div>

      {/* Interface Language */}
      <div>
        <label className="block text-lg font-semibold mb-4 text-gray-700">
          {t('onboarding.screen1.interfaceLang', interfaceLang)}
        </label>
        <div className="flex gap-4">
          {['fr', 'en'].map((lang: string) => (
            <button
              key={lang}
              onClick={() => setInterfaceLang(lang as InterfaceLanguage)}
              className={`px-6 py-3 rounded-lg font-semibold transition-all ${
                interfaceLang === lang
                  ? 'bg-blue-900 text-white'
                  : 'bg-white border-2 border-gray-300 text-gray-700 hover:border-blue-900'
              }`}
              style={
                interfaceLang === lang
                  ? { backgroundColor: '#002844' }
                  : {}
              }
            >
              {lang === 'fr' ? 'Français' : 'English'}
            </button>
          ))}
        </div>
      </div>

      {/* Learning Languages */}
      <div>
        <label className="block text-lg font-semibold mb-4 text-gray-700">
          {t('onboarding.screen1.learningLangs', interfaceLang)}
        </label>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {LEARNING_LANGUAGES.map(lang => (
            <button
              key={lang.code}
              onClick={() => toggleLearningLang(lang.code)}
              className={`p-4 rounded-lg border-2 transition-all ${
                learningLangs.includes(lang.code)
                  ? 'bg-blue-900 border-blue-900 text-white'
                  : 'bg-white border-gray-300 text-gray-700 hover:border-blue-900'
              }`}
              style={
                learningLangs.includes(lang.code)
                  ? { backgroundColor: '#002844', borderColor: '#002844' }
                  : {}
              }
            >
              <div className="text-2xl mb-2">{lang.flag}</div>
              <div className="text-sm font-semibold">
                {interfaceLang === 'fr' ? lang.nameFr : lang.nameEn}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Errors */}
      {errors.length > 0 && (
        <div className="p-4 bg-red-100 border border-red-400 rounded-lg text-red-700">
          {errors.map((err, i) => <div key={i}>{err}</div>)}
        </div>
      )}
    </div>
  );

  // ============ SCREEN 2: Objectives & Themes ============
  const Screen2 = () => (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold mb-4 text-gray-800">{t('onboarding.screen2.title', interfaceLang)}</h2>
      </div>

      {/* Objectives */}
      <div>
        <label className="block text-lg font-semibold mb-2 text-gray-700">
          {t('onboarding.screen2.objectives', interfaceLang)}
        </label>
        <p className="text-sm text-gray-600 mb-4">{t('onboarding.screen2.objectivesHint', interfaceLang)}</p>
        <div className="flex flex-wrap gap-3">
          {LEARNING_OBJECTIVES.map(obj => (
            <button
              key={obj.id}
              onClick={() => toggleObjective(obj.id)}
              className={`px-4 py-2 rounded-full font-semibold transition-all ${
                objectives.includes(obj.id)
                  ? 'bg-blue-900 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
              style={
                objectives.includes(obj.id)
                  ? { backgroundColor: '#002844' }
                  : {}
              }
            >
              <span className="mr-2">{obj.icon}</span>
              {interfaceLang === 'fr' ? obj.nameFr : obj.nameEn}
            </button>
          ))}
        </div>
      </div>

      {/* Personal Themes */}
      <div>
        <label className="block text-lg font-semibold mb-4 text-gray-700">
          {t('onboarding.screen2.personalThemes', interfaceLang)}
        </label>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {PERSONAL_THEMES.map(theme => (
            <button
              key={theme.id}
              onClick={() => toggleTheme(theme.id)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                selectedThemes.includes(theme.id)
                  ? 'bg-blue-900 text-white'
                  : 'bg-white border border-gray-300 text-gray-700 hover:border-blue-900'
              }`}
              style={
                selectedThemes.includes(theme.id)
                  ? { backgroundColor: '#002844', borderColor: '#002844' }
                  : {}
              }
            >
              {interfaceLang === 'fr' ? theme.nameFr : theme.nameEn}
            </button>
          ))}
        </div>
      </div>

      {/* Professional Themes */}
      <div>
        <label className="block text-lg font-semibold mb-4 text-gray-700">
          <span className="mr-2">💼</span>
          {t('onboarding.screen2.proThemes', interfaceLang)}
        </label>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {PROFESSIONAL_THEMES.map(theme => (
            <button
              key={theme.id}
              onClick={() => toggleTheme(theme.id)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                selectedThemes.includes(theme.id)
                  ? 'bg-blue-900 text-white'
                  : 'bg-white border border-gray-300 text-gray-700 hover:border-blue-900'
              }`}
              style={
                selectedThemes.includes(theme.id)
                  ? { backgroundColor: '#002844', borderColor: '#002844' }
                  : {}
              }
            >
              {interfaceLang === 'fr' ? theme.nameFr : theme.nameEn}
            </button>
          ))}
        </div>
      </div>

      {/* Errors */}
      {errors.length > 0 && (
        <div className="p-4 bg-red-100 border border-red-400 rounded-lg text-red-700">
          {errors.map((err, i) => <div key={i}>{err}</div>)}
        </div>
      )}
    </div>
  );

  // ============ SCREEN 3: Schedule ============
  const Screen3 = () => (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold mb-4 text-gray-800">{t('onboarding.screen3.title', interfaceLang)}</h2>
      </div>

      {/* Days of Week */}
      <div>
        <label className="block text-lg font-semibold mb-4 text-gray-700">
          {t('onboarding.screen3.days', interfaceLang)}
        </label>
        <div className="flex gap-2 flex-wrap">
          {DAYS_OF_WEEK.map(day => (
            <button
              key={day.id}
              onClick={() => toggleDay(day.id)}
              className={`px-4 py-3 rounded-lg font-bold transition-all ${
                selectedDays.includes(day.id)
                  ? 'bg-blue-900 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
              style={
                selectedDays.includes(day.id)
                  ? { backgroundColor: '#002844' }
                  : {}
              }
            >
              {interfaceLang === 'fr' ? day.shortFr : day.shortEn}
            </button>
          ))}
        </div>
      </div>

      {/* Duration */}
      <div>
        <label className="block text-lg font-semibold mb-4 text-gray-700">
          {t('onboarding.screen3.duration', interfaceLang)}
        </label>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {SESSION_DURATIONS.map(duration => (
            <button
              key={duration.value}
              onClick={() => setSelectedDuration(duration.value)}
              className={`px-4 py-3 rounded-lg font-semibold transition-all ${
                selectedDuration === duration.value
                  ? 'bg-blue-900 text-white'
                  : 'bg-white border-2 border-gray-300 text-gray-700 hover:border-blue-900'
              }`}
              style={
                selectedDuration === duration.value
                  ? { backgroundColor: '#002844', borderColor: '#002844' }
                  : {}
              }
            >
              {interfaceLang === 'fr' ? duration.labelFr : duration.labelEn}
            </button>
          ))}
        </div>
      </div>

      {/* Errors */}
      {errors.length > 0 && (
        <div className="p-4 bg-red-100 border border-red-400 rounded-lg text-red-700">
          {errors.map((err, i) => <div key={i}>{err}</div>)}
        </div>
      )}
    </div>
  );

  // ============ SCREEN 4: Diagnostics Summary ============
  const Screen4 = () => (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold mb-4 text-gray-800">{t('onboarding.screen4.title', interfaceLang)}</h2>
      </div>

      {/* CECRL Diagnostic */}
      <div className="p-6 bg-blue-50 border-2 border-blue-200 rounded-lg">
        <div className="flex justify-between items-start mb-2">
          <h3 className="text-lg font-bold text-gray-800">
            {t('onboarding.screen4.cecrDescription', interfaceLang)}
          </h3>
          <span className="px-3 py-1 bg-yellow-400 text-yellow-900 rounded-full text-sm font-semibold"
            style={{ backgroundColor: '#D9B438' }}>
            {t('onboarding.screen4.cecrMandatory', interfaceLang)}
          </span>
        </div>
        <p className="text-gray-700 text-sm">CEFR Level Assessment (Mandatory)</p>
      </div>

      {/* GRC Diagnostic (conditional) */}
      {hasGrcThemes && (
        <div className="p-6 bg-green-50 border-2 border-green-200 rounded-lg">
          <div className="flex justify-between items-start mb-2">
            <h3 className="text-lg font-bold text-gray-800">
              {t('onboarding.screen4.grcDescription', interfaceLang)}
            </h3>
            <span className="px-3 py-1 bg-green-200 text-green-900 rounded-full text-sm font-semibold">
              {t('onboarding.screen4.grcConditional', interfaceLang)}
            </span>
          </div>
          <p className="text-gray-700 text-sm">GRC & Cybersecurity Level Assessment</p>
        </div>
      )}

      {/* Selected Objectives */}
      <div className="p-6 bg-gray-50 border border-gray-300 rounded-lg">
        <h3 className="text-lg font-bold mb-3 text-gray-800">
          {t('onboarding.screen4.filteredByObjectives', interfaceLang)}
        </h3>
        <div className="flex flex-wrap gap-2">
          {objectives.map(obj => {
            const objDef = LEARNING_OBJECTIVES.find(o => o.id === obj);
            return (
              <span
                key={obj}
                className="px-3 py-2 bg-blue-900 text-white rounded-full text-sm"
                style={{ backgroundColor: '#002844' }}
              >
                {objDef?.icon} {interfaceLang === 'fr' ? objDef?.nameFr : objDef?.nameEn}
              </span>
            );
          })}
        </div>
      </div>

      {/* Errors */}
      {errors.length > 0 && (
        <div className="p-4 bg-red-100 border border-red-400 rounded-lg text-red-700">
          {errors.map((err, i) => <div key={i}>{err}</div>)}
        </div>
      )}

      {/* Start Diagnostic Button */}
      <button
        onClick={handleStartDiagnostic}
        className="w-full py-4 px-6 rounded-lg font-bold text-white text-lg transition-all hover:shadow-lg"
        style={{ backgroundColor: '#D9B438', color: '#002844' }}
      >
        {t('onboarding.startDiagnostic', interfaceLang)}
      </button>
    </div>
  );

  // ============ MAIN RENDER ============
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white p-4 sm:p-6 md:p-8">
      <div className="max-w-2xl mx-auto">
        <ProgressBar />

        <div className="bg-white rounded-2xl shadow-lg p-6 sm:p-8 md:p-10 mb-8">
          {currentStep === 1 && <Screen1 />}
          {currentStep === 2 && <Screen2 />}
          {currentStep === 3 && <Screen3 />}
          {currentStep === 4 && <Screen4 />}
        </div>

        {/* Navigation Buttons */}
        {currentStep < 4 && (
          <div className="flex gap-4 justify-between">
            <button
              onClick={handlePrevious}
              disabled={currentStep === 1}
              className={`px-6 py-3 rounded-lg font-semibold transition-all ${
                currentStep === 1
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  : 'bg-white border-2 border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              {t('onboarding.previous', interfaceLang)}
            </button>
            <button
              onClick={handleNext}
              className="px-8 py-3 rounded-lg font-semibold text-white transition-all hover:shadow-lg"
              style={{ backgroundColor: '#D9B438', color: '#002844' }}
            >
              {t('onboarding.next', interfaceLang)}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
