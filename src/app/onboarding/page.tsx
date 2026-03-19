'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { t } from '@/lib/i18n';
import { updateUserSettings, updateUserProgress, completeOnboarding } from '@/lib/db/localStorage';
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
  LanguageConfig,
  LevelCECRL,
  DiagnosticChoice,
} from '@/types';

// Diagnostic choices per language
interface LangDiagnosticSetup {
  cecrChoice: DiagnosticChoice;
  cecrManualLevel?: LevelCECRL;
  grcChoice?: DiagnosticChoice;
}

export default function OnboardingPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  const [currentStep, setCurrentStep] = useState(1);
  const [interfaceLang, setInterfaceLang] = useState<InterfaceLanguage>('fr');
  const [learningLangs, setLearningLangs] = useState<LearningLanguage[]>([]);

  // CORRECTION #1: objectifs et thèmes PAR LANGUE
  const [langConfigs, setLangConfigs] = useState<Record<string, { objectives: LearningObjective[]; themes: string[] }>>({});
  const [currentLangIndex, setCurrentLangIndex] = useState(0);

  // CORRECTION v2: schedule PAR LANGUE
  const [langSchedules, setLangSchedules] = useState<Record<string, { days: DayOfWeek[]; duration: SessionDuration }>>({});
  const [currentScheduleLangIndex, setCurrentScheduleLangIndex] = useState(0);

  // CORRECTION #2: Diagnostic optionnel PAR LANGUE
  const [langDiagnostics, setLangDiagnostics] = useState<Record<string, LangDiagnosticSetup>>({});
  const [currentDiagLangIndex, setCurrentDiagLangIndex] = useState(0);
  const [diagStep, setDiagStep] = useState<'knowLevel' | 'selectLevel' | 'whatToDo' | 'grcChoice' | 'done'>('knowLevel');

  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    if (!loading && !user) router.push('/auth');
    if (!loading && user) {
      // NAV-LANG FIX: Initialize with existing languages
      if (user.settings.learningLangs && user.settings.learningLangs.length > 0) {
        setLearningLangs(user.settings.learningLangs);
      }
      // Also init existing configs
      if (user.settings.languageConfigs) {
        const configs: Record<string, { objectives: LearningObjective[]; themes: string[] }> = {};
        for (const [lang, cfg] of Object.entries(user.settings.languageConfigs)) {
          configs[lang] = { objectives: (cfg.objectives || []) as LearningObjective[], themes: cfg.themes || [] };
        }
        setLangConfigs(configs);
      }
      if (user.settings.schedules) {
        setLangSchedules(user.settings.schedules as Record<string, { days: DayOfWeek[]; duration: SessionDuration }>);
      }
      if (user.settings.interfaceLang) {
        setInterfaceLang(user.settings.interfaceLang);
      }
    }
  }, [user, loading, router]);

  if (loading || !user) {
    return <div className="flex items-center justify-center min-h-screen">{t('general.loading', interfaceLang)}</div>;
  }

  // Current language being configured (Screen 2)
  const currentLang = learningLangs[currentLangIndex];
  const currentLangInfo = LEARNING_LANGUAGES.find(l => l.code === currentLang);

  // Current language for schedule (Screen 3)
  const scheduleLang = learningLangs[currentScheduleLangIndex];
  const scheduleLangInfo = LEARNING_LANGUAGES.find(l => l.code === scheduleLang);

  // Current language for diagnostic setup (Screen 4)
  const diagLang = learningLangs[currentDiagLangIndex];
  const diagLangInfo = LEARNING_LANGUAGES.find(l => l.code === diagLang);

  // Get current lang config
  const getCurrentConfig = (lang: string) => langConfigs[lang] || { objectives: [], themes: [] };

  // Get current lang schedule
  const getCurrentSchedule = (lang: string) => langSchedules[lang] || { days: [], duration: 20 };

  // Toggle helpers for per-language config
  const toggleObjective = (obj: LearningObjective) => {
    const cfg = getCurrentConfig(currentLang);
    const newObjs = cfg.objectives.includes(obj) ? cfg.objectives.filter(o => o !== obj) : [...cfg.objectives, obj];
    setLangConfigs(prev => ({ ...prev, [currentLang]: { ...cfg, objectives: newObjs } }));
  };

  const toggleTheme = (themeId: string) => {
    const cfg = getCurrentConfig(currentLang);
    const newThemes = cfg.themes.includes(themeId) ? cfg.themes.filter(t => t !== themeId) : [...cfg.themes, themeId];
    setLangConfigs(prev => ({ ...prev, [currentLang]: { ...cfg, themes: newThemes } }));
  };

  const toggleLearningLang = (lang: LearningLanguage) => {
    setLearningLangs(prev => prev.includes(lang) ? prev.filter(l => l !== lang) : [...prev, lang]);
  };

  // Schedule toggles PER LANGUAGE
  const toggleScheduleDay = (day: DayOfWeek) => {
    const sched = getCurrentSchedule(scheduleLang);
    const newDays = sched.days.includes(day) ? sched.days.filter(d => d !== day) : [...sched.days, day];
    setLangSchedules(prev => ({ ...prev, [scheduleLang]: { ...sched, days: newDays } }));
  };

  const setScheduleDuration = (dur: SessionDuration) => {
    const sched = getCurrentSchedule(scheduleLang);
    setLangSchedules(prev => ({ ...prev, [scheduleLang]: { ...sched, duration: dur } }));
  };

  // hasGrcThemes for a language
  const hasGrcForLang = (lang: string) => {
    const cfg = getCurrentConfig(lang);
    const proIds = PROFESSIONAL_THEMES.map(p => p.id);
    return cfg.themes.some(t => proIds.includes(t));
  };

  // Validation
  const validateStep = (step: number): boolean => {
    setErrors([]);
    const newErrors: string[] = [];
    if (step === 1 && learningLangs.length === 0) {
      newErrors.push(t('onboarding.screen1.selectAtLeast1', interfaceLang));
    }
    if (step === 2) {
      const cfg = getCurrentConfig(currentLang);
      if (cfg.objectives.length === 0) newErrors.push(t('onboarding.screen2.objectives', interfaceLang));
      if (cfg.themes.length === 0) newErrors.push(t('onboarding.screen2.selectAtLeast1Theme', interfaceLang));
    }
    if (step === 3) {
      const sched = getCurrentSchedule(scheduleLang);
      if (sched.days.length === 0) {
        newErrors.push(t('onboarding.screen3.selectAtLeast1Day', interfaceLang));
      }
    }
    setErrors(newErrors);
    return newErrors.length === 0;
  };

  // Navigation
  const handleNext = () => {
    if (!validateStep(currentStep)) return;

    // Screen 2: cycle through languages
    if (currentStep === 2 && currentLangIndex < learningLangs.length - 1) {
      setCurrentLangIndex(currentLangIndex + 1);
      setErrors([]);
      return;
    }

    // Screen 3: cycle through languages for schedule
    if (currentStep === 3 && currentScheduleLangIndex < learningLangs.length - 1) {
      setCurrentScheduleLangIndex(currentScheduleLangIndex + 1);
      setErrors([]);
      return;
    }

    if (currentStep < 4) {
      setCurrentStep(currentStep + 1);
      if (currentStep + 1 === 3) {
        setCurrentScheduleLangIndex(0);
      }
      if (currentStep + 1 === 4) {
        setCurrentDiagLangIndex(0);
        setDiagStep('knowLevel');
      }
    }
  };

  const handlePrevious = () => {
    if (currentStep === 2 && currentLangIndex > 0) {
      setCurrentLangIndex(currentLangIndex - 1);
      return;
    }
    if (currentStep === 3 && currentScheduleLangIndex > 0) {
      setCurrentScheduleLangIndex(currentScheduleLangIndex - 1);
      return;
    }
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      if (currentStep - 1 === 2) setCurrentLangIndex(learningLangs.length - 1);
      if (currentStep - 1 === 3) setCurrentScheduleLangIndex(learningLangs.length - 1);
    }
  };

  // Finish onboarding
  const handleFinishOnboarding = () => {
    // Build languageConfigs
    const languageConfigs: Record<string, LanguageConfig> = {};
    for (const lang of learningLangs) {
      const cfg = getCurrentConfig(lang);
      const proIds = PROFESSIONAL_THEMES.map(p => p.id);
      languageConfigs[lang] = {
        objectives: cfg.objectives,
        themes: cfg.themes,
        hasGrcThemes: cfg.themes.some(t => proIds.includes(t)),
      };
    }

    // Build per-language schedules
    const schedules: Record<string, { days: DayOfWeek[]; duration: SessionDuration }> = {};
    for (const lang of learningLangs) {
      schedules[lang] = getCurrentSchedule(lang);
    }

    // Fallback global schedule = first language's schedule
    const firstSched = schedules[learningLangs[0]] || { days: [], duration: 20 };

    const settings = {
      interfaceLang,
      learningLangs,
      languageConfigs,
      schedule: firstSched,
      schedules,
    };

    const updated = updateUserSettings(user.id, settings);
    if (updated) {
      const langsToTest: string[] = [];
      for (const lang of learningLangs) {
        const diag = langDiagnostics[lang];
        if (diag?.cecrChoice === 'test') langsToTest.push(lang);
        else if (diag?.grcChoice === 'test') langsToTest.push(lang);
      }

      if (langsToTest.length > 0) {
        const diagPlan = learningLangs.map(lang => ({
          lang,
          cecrl: langDiagnostics[lang]?.cecrChoice || 'skip',
          cecrManualLevel: langDiagnostics[lang]?.cecrManualLevel,
          grc: langDiagnostics[lang]?.grcChoice || 'skip',
          hasGrc: hasGrcForLang(lang),
        }));
        sessionStorage.setItem('lingualearn_diag_plan', JSON.stringify(diagPlan));
        router.push('/onboarding/diagnostic');
      } else {
        for (const lg of learningLangs) {
          const diag = langDiagnostics[lg];
          updateUserProgress(user.id, lg, {
            levelCecrl: diag?.cecrManualLevel || 'A1',
            levelGrc: hasGrcForLang(lg) ? 'Junior' : undefined,
            diagnosticCompleted: true,
            grcDiagnosticCompleted: hasGrcForLang(lg),
            objectiveProgress: { grammaire: 0, vocabulaire: 0, lecture: 0, ecrit: 0, oral: 0 },
          });
        }
        completeOnboarding(user.id);
        router.push('/dashboard');
      }
    }
  };

  // Diagnostic setup handlers (Screen 4)
  const setDiagChoice = (field: 'cecrChoice' | 'grcChoice', value: DiagnosticChoice) => {
    setLangDiagnostics(prev => ({
      ...prev,
      [diagLang]: { ...prev[diagLang], [field]: value },
    }));
  };

  const setManualLevel = (level: LevelCECRL) => {
    setLangDiagnostics(prev => ({
      ...prev,
      [diagLang]: { ...prev[diagLang], cecrChoice: 'manual' as DiagnosticChoice, cecrManualLevel: level },
    }));
  };

  const advanceDiagLang = () => {
    if (currentDiagLangIndex < learningLangs.length - 1) {
      setCurrentDiagLangIndex(currentDiagLangIndex + 1);
      setDiagStep('knowLevel');
    }
  };

  // Progress bar
  const ProgressBar = () => (
    <div className="w-full mb-4 sm:mb-6">
      <div className="flex items-center justify-between mb-2 sm:mb-4">
        <h1 className="text-lg sm:text-xl font-bold text-gray-800">
          {t('onboarding.step', interfaceLang)} {currentStep} {t('onboarding.of', interfaceLang)} 4
        </h1>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
        <div className="h-full transition-all duration-300" style={{ width: `${(currentStep / 4) * 100}%`, backgroundColor: '#D9B438' }} />
      </div>
    </div>
  );

  // ============ SCREEN 1 ============
  const Screen1 = () => (
    <div className="space-y-5 sm:space-y-8">
      <h2 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4 text-gray-800">{t('onboarding.screen1.title', interfaceLang)}</h2>
      <div>
        <label className="block text-lg font-semibold mb-4 text-gray-700">{t('onboarding.screen1.interfaceLang', interfaceLang)}</label>
        <div className="flex gap-4">
          {(['fr', 'en'] as const).map(lang => (
            <button key={lang} onClick={() => setInterfaceLang(lang)}
              className={`px-6 py-3 rounded-lg font-semibold transition-all ${interfaceLang === lang ? 'text-white' : 'bg-white border-2 border-gray-300 text-gray-700 hover:border-[#002844]'}`}
              style={interfaceLang === lang ? { backgroundColor: '#002844' } : {}}>
              {lang === 'fr' ? 'Français' : 'English'}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="block text-lg font-semibold mb-4 text-gray-700">{t('onboarding.screen1.learningLangs', interfaceLang)}</label>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {LEARNING_LANGUAGES.map(lang => (
            <button key={lang.code} onClick={() => toggleLearningLang(lang.code)}
              className={`p-4 rounded-lg border-2 transition-all ${learningLangs.includes(lang.code) ? 'text-white' : 'bg-white border-gray-300 text-gray-700 hover:border-[#002844]'}`}
              style={learningLangs.includes(lang.code) ? { backgroundColor: '#002844', borderColor: '#002844' } : {}}>
              <div className="text-2xl mb-2">{lang.flag}</div>
              <div className="text-sm font-semibold">{interfaceLang === 'fr' ? lang.nameFr : lang.nameEn}</div>
            </button>
          ))}
        </div>
      </div>
      {errors.length > 0 && <div className="p-4 bg-red-100 border border-red-400 rounded-lg text-red-700">{errors.map((e, i) => <div key={i}>{e}</div>)}</div>}
    </div>
  );

  // ============ SCREEN 2: PER LANGUAGE (#1) ============
  const Screen2 = () => {
    const cfg = getCurrentConfig(currentLang);
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3 p-4 bg-[#002844]/5 rounded-xl border border-[#002844]/20">
          <span className="text-3xl">{currentLangInfo?.flag}</span>
          <div>
            <p className="text-sm text-[#555555]">{t('onboarding.screen2.configFor', interfaceLang)}</p>
            <p className="text-xl font-bold text-[#002844]">{interfaceLang === 'fr' ? currentLangInfo?.nameFr : currentLangInfo?.nameEn}</p>
          </div>
          <span className="ml-auto text-sm font-medium text-[#555555]">
            {t('onboarding.screen2.langOf', interfaceLang)} {currentLangIndex + 1}/{learningLangs.length}
          </span>
        </div>

        <div>
          <label className="block text-lg font-semibold mb-2 text-gray-700">{t('onboarding.screen2.objectives', interfaceLang)}</label>
          <p className="text-sm text-gray-600 mb-4">{t('onboarding.screen2.objectivesHint', interfaceLang)}</p>
          <div className="flex flex-wrap gap-3">
            {LEARNING_OBJECTIVES.map(obj => (
              <button key={obj.id} onClick={() => toggleObjective(obj.id)}
                className={`px-4 py-2 rounded-full font-semibold transition-all ${cfg.objectives.includes(obj.id) ? 'text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                style={cfg.objectives.includes(obj.id) ? { backgroundColor: '#002844' } : {}}>
                <span className="mr-2">{obj.icon}</span>
                {interfaceLang === 'fr' ? obj.nameFr : obj.nameEn}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-lg font-semibold mb-4 text-gray-700">{t('onboarding.screen2.personalThemes', interfaceLang)}</label>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {PERSONAL_THEMES.map(theme => (
              <button key={theme.id} onClick={() => toggleTheme(theme.id)}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${cfg.themes.includes(theme.id) ? 'text-white' : 'bg-white border border-gray-300 text-gray-700 hover:border-[#002844]'}`}
                style={cfg.themes.includes(theme.id) ? { backgroundColor: '#002844', borderColor: '#002844' } : {}}>
                {interfaceLang === 'fr' ? theme.nameFr : theme.nameEn}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-lg font-semibold mb-4 text-gray-700">
            <span className="mr-2">💼</span>{t('onboarding.screen2.proThemes', interfaceLang)}
          </label>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {PROFESSIONAL_THEMES.map(theme => (
              <button key={theme.id} onClick={() => toggleTheme(theme.id)}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${cfg.themes.includes(theme.id) ? 'text-white' : 'bg-white border border-gray-300 text-gray-700 hover:border-[#002844]'}`}
                style={cfg.themes.includes(theme.id) ? { backgroundColor: '#002844', borderColor: '#002844' } : {}}>
                {interfaceLang === 'fr' ? theme.nameFr : theme.nameEn}
              </button>
            ))}
          </div>
        </div>

        {errors.length > 0 && <div className="p-4 bg-red-100 border border-red-400 rounded-lg text-red-700">{errors.map((e, i) => <div key={i}>{e}</div>)}</div>}
      </div>
    );
  };

  // ============ SCREEN 3: ORGANISATION PAR LANGUE ============
  const Screen3 = () => {
    const sched = getCurrentSchedule(scheduleLang);
    const schLangName = interfaceLang === 'fr' ? scheduleLangInfo?.nameFr : scheduleLangInfo?.nameEn;
    return (
      <div className="space-y-8">
        <h2 className="text-2xl font-bold mb-4 text-gray-800">{t('onboarding.screen3.title', interfaceLang)}</h2>

        {/* Language indicator */}
        <div className="flex items-center gap-3 p-4 bg-[#002844]/5 rounded-xl border border-[#002844]/20">
          <span className="text-3xl">{scheduleLangInfo?.flag}</span>
          <div>
            <p className="text-sm text-[#555555]">{t('onboarding.screen3.scheduleFor', interfaceLang)}</p>
            <p className="text-xl font-bold text-[#002844]">{schLangName}</p>
          </div>
          <span className="ml-auto text-sm font-medium text-[#555555]">
            {t('onboarding.screen2.langOf', interfaceLang)} {currentScheduleLangIndex + 1}/{learningLangs.length}
          </span>
        </div>

        <div>
          <label className="block text-lg font-semibold mb-4 text-gray-700">{t('onboarding.screen3.days', interfaceLang)}</label>
          <div className="flex gap-2 flex-wrap">
            {DAYS_OF_WEEK.map(day => (
              <button key={day.id} onClick={() => toggleScheduleDay(day.id)}
                className={`px-4 py-3 rounded-lg font-bold transition-all ${sched.days.includes(day.id) ? 'text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                style={sched.days.includes(day.id) ? { backgroundColor: '#002844' } : {}}>
                {interfaceLang === 'fr' ? day.shortFr : day.shortEn}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-lg font-semibold mb-4 text-gray-700">{t('onboarding.screen3.duration', interfaceLang)}</label>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {SESSION_DURATIONS.map(dur => (
              <button key={dur.value} onClick={() => setScheduleDuration(dur.value)}
                className={`px-4 py-3 rounded-lg font-semibold transition-all ${sched.duration === dur.value ? 'text-white' : 'bg-white border-2 border-gray-300 text-gray-700 hover:border-[#002844]'}`}
                style={sched.duration === dur.value ? { backgroundColor: '#002844', borderColor: '#002844' } : {}}>
                {interfaceLang === 'fr' ? dur.labelFr : dur.labelEn}
              </button>
            ))}
          </div>
        </div>
        {errors.length > 0 && <div className="p-4 bg-red-100 border border-red-400 rounded-lg text-red-700">{errors.map((e, i) => <div key={i}>{e}</div>)}</div>}
      </div>
    );
  };

  // ============ SCREEN 4: Diagnostic OPTIONNEL per language (#2) ============
  const Screen4 = () => {
    const hasGrc = hasGrcForLang(diagLang);
    const diag = langDiagnostics[diagLang] || {};
    const langName = interfaceLang === 'fr' ? diagLangInfo?.nameFr : diagLangInfo?.nameEn;
    const allLangsDone = currentDiagLangIndex >= learningLangs.length - 1 &&
      (diagStep === 'done' || (diagStep === 'grcChoice' && diag.grcChoice) || (!hasGrc && (diagStep === 'whatToDo' || diagStep === 'selectLevel') && diag.cecrChoice));

    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-800">{t('onboarding.screen4.title', interfaceLang)}</h2>

        <div className="flex items-center gap-3 p-4 bg-[#002844]/5 rounded-xl border border-[#002844]/20">
          <span className="text-3xl">{diagLangInfo?.flag}</span>
          <p className="text-xl font-bold text-[#002844]">{t('onboarding.screen4.cecrSection', interfaceLang)} {langName}</p>
          <span className="ml-auto text-sm font-medium text-[#555555]">
            {currentDiagLangIndex + 1}/{learningLangs.length}
          </span>
        </div>

        {diagStep === 'knowLevel' && (
          <div className="space-y-4">
            <p className="text-lg font-semibold text-[#002844]">
              {t('onboarding.screen4.knowLevel', interfaceLang)} {langName} ?
            </p>
            <div className="grid gap-3">
              <button onClick={() => setDiagStep('selectLevel')}
                className="p-4 rounded-xl border-2 border-gray-200 text-left hover:border-[#002844] transition-all">
                <span className="font-semibold text-[#002844]">{t('onboarding.screen4.yes', interfaceLang)}</span>
              </button>
              <button onClick={() => setDiagStep('whatToDo')}
                className="p-4 rounded-xl border-2 border-gray-200 text-left hover:border-[#002844] transition-all">
                <span className="font-semibold text-[#002844]">{t('onboarding.screen4.no', interfaceLang)}</span>
              </button>
            </div>
          </div>
        )}

        {diagStep === 'selectLevel' && (
          <div className="space-y-4">
            <p className="text-lg font-semibold text-[#002844]">{t('onboarding.screen4.selectLevel', interfaceLang)}</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {(['A1', 'A2', 'B1', 'B2'] as LevelCECRL[]).map(level => (
                <button key={level} onClick={() => {
                  setManualLevel(level);
                  if (hasGrc) setDiagStep('grcChoice');
                  else {
                    setDiagStep('done');
                    if (currentDiagLangIndex < learningLangs.length - 1) {
                      setTimeout(() => advanceDiagLang(), 100);
                    }
                  }
                }}
                  className={`p-4 rounded-xl border-2 text-center font-bold text-xl transition-all ${
                    diag.cecrManualLevel === level ? 'border-[#002844] bg-[#002844] text-white' : 'border-gray-200 text-[#002844] hover:border-[#002844]'
                  }`}>
                  {level}
                </button>
              ))}
            </div>
          </div>
        )}

        {diagStep === 'whatToDo' && (
          <div className="space-y-4">
            <p className="text-lg font-semibold text-[#002844]">{t('onboarding.screen4.whatToDo', interfaceLang)}</p>
            <div className="grid gap-3">
              <button onClick={() => {
                setDiagChoice('cecrChoice', 'test');
                if (hasGrc) setDiagStep('grcChoice');
                else {
                  setDiagStep('done');
                  if (currentDiagLangIndex < learningLangs.length - 1) setTimeout(() => advanceDiagLang(), 100);
                }
              }}
                className="p-4 rounded-xl border-2 border-gray-200 text-left hover:border-[#D9B438] transition-all">
                <span className="font-semibold text-[#002844]">{t('onboarding.screen4.takeTest', interfaceLang)}</span>
              </button>
              <button onClick={() => {
                setDiagChoice('cecrChoice', 'skip');
                if (hasGrc) setDiagStep('grcChoice');
                else {
                  setDiagStep('done');
                  if (currentDiagLangIndex < learningLangs.length - 1) setTimeout(() => advanceDiagLang(), 100);
                }
              }}
                className="p-4 rounded-xl border-2 border-gray-200 text-left hover:border-[#002844] transition-all">
                <span className="font-semibold text-[#002844]">{t('onboarding.screen4.startA1', interfaceLang)}</span>
                <p className="text-sm text-[#555555] mt-1">{t('onboarding.screen4.startA1Note', interfaceLang)}</p>
              </button>
            </div>
          </div>
        )}

        {diagStep === 'grcChoice' && hasGrc && (
          <div className="space-y-4 mt-6">
            <div className="p-4 bg-[#D9B438]/10 rounded-xl border border-[#D9B438]/30">
              <p className="text-lg font-semibold text-[#002844]">{t('onboarding.screen4.grcSection', interfaceLang)} {langName}</p>
            </div>
            <div className="grid gap-3">
              <button onClick={() => {
                setDiagChoice('grcChoice', 'test');
                setDiagStep('done');
                if (currentDiagLangIndex < learningLangs.length - 1) setTimeout(() => advanceDiagLang(), 100);
              }}
                className="p-4 rounded-xl border-2 border-gray-200 text-left hover:border-[#D9B438] transition-all">
                <span className="font-semibold text-[#002844]">{t('onboarding.screen4.grcTest', interfaceLang)}</span>
              </button>
              <button onClick={() => {
                setDiagChoice('grcChoice', 'skip');
                setDiagStep('done');
                if (currentDiagLangIndex < learningLangs.length - 1) setTimeout(() => advanceDiagLang(), 100);
              }}
                className="p-4 rounded-xl border-2 border-gray-200 text-left hover:border-[#002844] transition-all">
                <span className="font-semibold text-[#002844]">{t('onboarding.screen4.startJunior', interfaceLang)}</span>
              </button>
            </div>
          </div>
        )}

        {diagStep === 'done' && currentDiagLangIndex >= learningLangs.length - 1 && (
          <div className="text-center text-green-600 font-semibold py-4">
            ✅ {interfaceLang === 'fr' ? 'Configuration terminée pour toutes les langues' : 'Setup complete for all languages'}
          </div>
        )}

        {(allLangsDone || (diagStep === 'done' && currentDiagLangIndex >= learningLangs.length - 1)) && (
          <button onClick={handleFinishOnboarding}
            className="w-full py-4 px-6 rounded-lg font-bold text-lg transition-all hover:shadow-lg"
            style={{ backgroundColor: '#D9B438', color: '#002844' }}>
            {t('onboarding.startDiagnostic', interfaceLang)}
          </button>
        )}
      </div>
    );
  };

  // ============ MAIN RENDER ============
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white p-3 sm:p-4 md:p-6 lg:p-8">
      <div className="max-w-2xl mx-auto">
        <ProgressBar />
        <div className="bg-white rounded-2xl shadow-lg p-4 sm:p-6 md:p-8 lg:p-10 mb-6 overflow-y-auto max-h-[calc(100vh-180px)]">
          {currentStep === 1 && <Screen1 />}
          {currentStep === 2 && <Screen2 />}
          {currentStep === 3 && <Screen3 />}
          {currentStep === 4 && <Screen4 />}
        </div>

        {currentStep < 4 && (
          <div className="flex gap-4 justify-between">
            <button onClick={handlePrevious}
              disabled={currentStep === 1 && currentLangIndex === 0}
              className={`px-6 py-3 rounded-lg font-semibold transition-all ${
                currentStep === 1 && currentLangIndex === 0 ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-white border-2 border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}>
              {t('onboarding.previous', interfaceLang)}
            </button>
            <button onClick={handleNext}
              className="px-8 py-3 rounded-lg font-semibold transition-all hover:shadow-lg"
              style={{ backgroundColor: '#D9B438', color: '#002844' }}>
              {currentStep === 2 && currentLangIndex < learningLangs.length - 1
                ? t('onboarding.screen2.nextLang', interfaceLang)
                : currentStep === 3 && currentScheduleLangIndex < learningLangs.length - 1
                  ? t('onboarding.screen2.nextLang', interfaceLang)
                  : t('onboarding.next', interfaceLang)}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
