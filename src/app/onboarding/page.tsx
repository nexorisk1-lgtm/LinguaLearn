'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { t } from '@/lib/i18n';
import { updateUserSettings, updateUserProgress, completeOnboarding } from '@/lib/db/localStorage';
import {
  LEARNING_LANGUAGES,
  PERSONAL_THEMES,
  PROFESSIONAL_THEMES,
  SESSION_DURATIONS,
  DAYS_OF_WEEK,
  THEME_CATEGORIES,
  LEARNING_PATHS,
  InterfaceLanguage,
  LearningLanguage,
  LearningObjective,
  LearningPath,
  DayOfWeek,
  SessionDuration,
  LanguageConfig,
  LevelCECRL,
  GoalType,
} from '@/types';
// lucide-react icons used in subcomponents

// Diagnostic setup per language
interface LangDiagnosticSetup {
  choice: 'lesson' | 'manual' | 'undecided';
  manualLevel?: LevelCECRL;
  grcManual?: boolean;
}

export default function OnboardingPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  const [currentStep, setCurrentStep] = useState(1);
  const [interfaceLang, setInterfaceLang] = useState<InterfaceLanguage>('fr');
  const [learningLangs, setLearningLangs] = useState<LearningLanguage[]>([]);

  // Step 2: Learning Path PER LANGUAGE (Curriculum V1.0)
  const [langPaths, setLangPaths] = useState<Record<string, LearningPath[]>>({});
  const [currentPathLangIndex, setCurrentPathLangIndex] = useState(0);

  // Step 3: Goal + themes PER LANGUAGE
  const [langGoals, setLangGoals] = useState<Record<string, GoalType>>({});
  const [langThemes, setLangThemes] = useState<Record<string, string[]>>({});
  const [langObjectives, setLangObjectives] = useState<Record<string, LearningObjective[]>>({});
  const [currentLangIndex, setCurrentLangIndex] = useState(0);
  const [expandedThemeCategories, setExpandedThemeCategories] = useState<Record<string, boolean>>({});

  // Step 3: Schedule PER LANGUAGE
  const [langSchedules, setLangSchedules] = useState<Record<string, { days: DayOfWeek[]; duration: SessionDuration; wordsPerDay: number }>>({});
  const [currentScheduleLangIndex, setCurrentScheduleLangIndex] = useState(0);

  // Step 4: Diagnostic PER LANGUAGE
  const [langDiagnostics, setLangDiagnostics] = useState<Record<string, LangDiagnosticSetup>>({});
  const [currentDiagLangIndex, setCurrentDiagLangIndex] = useState(0);

  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    if (!loading && !user) router.push('/auth');
    if (!loading && user) {
      if (user.onboardingCompleted) {
        router.push('/dashboard');
        return;
      }
      // Init from existing data
      if (user.settings.learningLangs?.length > 0) {
        setLearningLangs(user.settings.learningLangs);
        // Initialize objectives: grammaire + vocabulaire always active
        const objInit: Record<string, LearningObjective[]> = {};
        for (const lang of user.settings.learningLangs) {
          objInit[lang] = user.settings.languageConfigs?.[lang]?.objectives?.length
            ? user.settings.languageConfigs[lang].objectives
            : ['grammaire', 'vocabulaire'];
        }
        setLangObjectives(objInit);
      }
      if (user.settings.languageConfigs) {
        const goals: Record<string, GoalType> = {};
        const themes: Record<string, string[]> = {};
        for (const [lang, cfg] of Object.entries(user.settings.languageConfigs)) {
          themes[lang] = cfg.themes || [];
          const proIds = PROFESSIONAL_THEMES.map(p => p.id);
          const hasPersonal = cfg.themes?.some(t => !proIds.includes(t));
          const hasPro = cfg.hasGrcThemes;
          goals[lang] = hasPersonal && hasPro ? 'both' : hasPro ? 'professional' : 'personal';
        }
        setLangGoals(goals);
        setLangThemes(themes);
      }
      if (user.settings.schedules) {
        const schedules: Record<string, { days: DayOfWeek[]; duration: SessionDuration; wordsPerDay: number }> = {};
        for (const [lang, sched] of Object.entries(user.settings.schedules)) {
          schedules[lang] = {
            days: (sched.days || []) as DayOfWeek[],
            duration: (sched.duration || 20) as SessionDuration,
            wordsPerDay: sched.wordsPerDay || 8,
          };
        }
        setLangSchedules(schedules);
      }
      if (user.settings.interfaceLang) {
        setInterfaceLang(user.settings.interfaceLang);
      }
    }
  }, [user, loading, router]);

  if (loading || !user) {
    return <div className="flex items-center justify-center min-h-screen">{t('general.loading', interfaceLang)}</div>;
  }

  // Current language helpers
  const currentLang = learningLangs[currentLangIndex];
  const currentLangInfo = LEARNING_LANGUAGES.find(l => l.code === currentLang);
  const scheduleLang = learningLangs[currentScheduleLangIndex];
  const scheduleLangInfo = LEARNING_LANGUAGES.find(l => l.code === scheduleLang);
  const diagLang = learningLangs[currentDiagLangIndex];
  const diagLangInfo = LEARNING_LANGUAGES.find(l => l.code === diagLang);

  // State helpers
  const getGoal = (lang: string): GoalType | undefined => langGoals[lang];
  const getThemes = (lang: string): string[] => langThemes[lang] || [];
  const getSchedule = (lang: string) => langSchedules[lang] || { days: [], duration: 20 as SessionDuration, wordsPerDay: 8 };
  const getDiag = (lang: string): LangDiagnosticSetup => langDiagnostics[lang] || { choice: 'undecided' };

  const hasGrcForLang = (lang: string) => {
    const themes = getThemes(lang);
    const proIds = PROFESSIONAL_THEMES.map(p => p.id);
    return themes.some(t => proIds.includes(t));
  };

  // Toggles
  const toggleLearningLang = (lang: LearningLanguage) => {
    setLearningLangs(prev => prev.includes(lang) ? prev.filter(l => l !== lang) : [...prev, lang]);
  };

  const setGoal = (goal: GoalType) => {
    setLangGoals(prev => ({ ...prev, [currentLang]: goal }));
    // Reset themes when changing goal type
    if (goal === 'personal') {
      // Remove any professional themes
      const proIds = PROFESSIONAL_THEMES.map(p => p.id);
      setLangThemes(prev => ({ ...prev, [currentLang]: (prev[currentLang] || []).filter(t => !proIds.includes(t)) }));
    } else if (goal === 'professional') {
      // Remove any personal themes
      const persIds = PERSONAL_THEMES.map(p => p.id);
      setLangThemes(prev => ({ ...prev, [currentLang]: (prev[currentLang] || []).filter(t => !persIds.includes(t)) }));
    }
    // Expand all categories by default
    const expanded: Record<string, boolean> = {};
    THEME_CATEGORIES.forEach(cat => { expanded[cat.id] = true; });
    setExpandedThemeCategories(expanded);
  };

  const toggleTheme = (themeId: string) => {
    const themes = getThemes(currentLang);
    const newThemes = themes.includes(themeId) ? themes.filter(t => t !== themeId) : [...themes, themeId];
    setLangThemes(prev => ({ ...prev, [currentLang]: newThemes }));
  };

  const selectAllInCategory = (catThemes: string[]) => {
    const themes = getThemes(currentLang);
    const allSelected = catThemes.every(t => themes.includes(t));
    if (allSelected) {
      setLangThemes(prev => ({ ...prev, [currentLang]: themes.filter(t => !catThemes.includes(t)) }));
    } else {
      const newThemes = Array.from(new Set([...themes, ...catThemes]));
      setLangThemes(prev => ({ ...prev, [currentLang]: newThemes }));
    }
  };

  const getObjectives = (lang: string): LearningObjective[] => langObjectives[lang] || [];

  const toggleScheduleDay = (day: DayOfWeek) => {
    const sched = getSchedule(scheduleLang);
    const newDays = sched.days.includes(day) ? sched.days.filter(d => d !== day) : [...sched.days, day];
    setLangSchedules(prev => ({ ...prev, [scheduleLang]: { ...sched, days: newDays } }));
  };

  const setScheduleDuration = (dur: SessionDuration) => {
    const sched = getSchedule(scheduleLang);
    setLangSchedules(prev => ({ ...prev, [scheduleLang]: { ...sched, duration: dur } }));
  };

  const setWordsPerDay = (n: number) => {
    const sched = getSchedule(scheduleLang);
    setLangSchedules(prev => ({ ...prev, [scheduleLang]: { ...sched, wordsPerDay: n } }));
  };

  // Validation
  const validateStep = (step: number): boolean => {
    setErrors([]);
    const newErrors: string[] = [];
    if (step === 1 && learningLangs.length === 0) {
      newErrors.push(interfaceLang === 'fr' ? 'Sélectionnez au moins une langue.' : 'Select at least one language.');
    }
    if (step === 2) {
      const pathLang = learningLangs[currentPathLangIndex];
      const paths = langPaths[pathLang] || [];
      if (paths.length === 0) {
        newErrors.push(interfaceLang === 'fr' ? 'Sélectionnez au moins un parcours.' : 'Select at least one learning path.');
      }
    }
    if (step === 3) {
      // BUG-46/47/48: Parcours A = all-inclusive, auto-pass validation
      const paths = langPaths[currentLang] || [];
      const isAOnly = paths.includes('A') && !paths.includes('C');
      if (isAOnly) {
        // Auto-set all themes and objectives for Parcours A
        const allThemeIds = [...PERSONAL_THEMES.map(t => t.id)];
        setLangThemes(prev => ({ ...prev, [currentLang]: allThemeIds }));
        setLangGoals(prev => ({ ...prev, [currentLang]: 'personal' }));
        setLangObjectives(prev => ({ ...prev, [currentLang]: ['grammaire', 'vocabulaire', 'oral', 'lecture', 'ecrit'] }));
      } else {
        const goal = getGoal(currentLang);
        if (!goal) {
          newErrors.push(interfaceLang === 'fr' ? 'Choisissez un objectif de parcours.' : 'Choose a learning goal.');
        }
        if (getThemes(currentLang).length === 0) {
          newErrors.push(interfaceLang === 'fr' ? 'Sélectionnez au moins un thème.' : 'Select at least one theme.');
        }
        if (getObjectives(currentLang).length === 0) {
          newErrors.push(interfaceLang === 'fr' ? 'Sélectionnez au moins un objectif.' : 'Select at least one objective.');
        }
      }
    }
    if (step === 4) {
      const sched = getSchedule(scheduleLang);
      if (sched.days.length === 0) {
        newErrors.push(interfaceLang === 'fr' ? 'Sélectionnez au moins un jour.' : 'Select at least one day.');
      }
    }
    setErrors(newErrors);
    return newErrors.length === 0;
  };

  // Navigation (5 steps: 1=Languages, 2=Path, 3=Goals+Themes, 4=Schedule, 5=Diagnostic)
  const handleNext = () => {
    if (!validateStep(currentStep)) return;
    if (currentStep === 2 && currentPathLangIndex < learningLangs.length - 1) {
      setCurrentPathLangIndex(currentPathLangIndex + 1);
      setErrors([]);
      return;
    }
    if (currentStep === 3 && currentLangIndex < learningLangs.length - 1) {
      setCurrentLangIndex(currentLangIndex + 1);
      setErrors([]);
      return;
    }
    if (currentStep === 4 && currentScheduleLangIndex < learningLangs.length - 1) {
      setCurrentScheduleLangIndex(currentScheduleLangIndex + 1);
      setErrors([]);
      return;
    }
    if (currentStep < 5) {
      setCurrentStep(currentStep + 1);
      if (currentStep + 1 === 2) setCurrentPathLangIndex(0);
      if (currentStep + 1 === 3) setCurrentLangIndex(0);
      if (currentStep + 1 === 4) setCurrentScheduleLangIndex(0);
      if (currentStep + 1 === 5) setCurrentDiagLangIndex(0);
    }
  };

  const handlePrevious = () => {
    if (currentStep === 2 && currentPathLangIndex > 0) { setCurrentPathLangIndex(currentPathLangIndex - 1); return; }
    if (currentStep === 3 && currentLangIndex > 0) { setCurrentLangIndex(currentLangIndex - 1); return; }
    if (currentStep === 4 && currentScheduleLangIndex > 0) { setCurrentScheduleLangIndex(currentScheduleLangIndex - 1); return; }
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      if (currentStep - 1 === 2) setCurrentPathLangIndex(learningLangs.length - 1);
      if (currentStep - 1 === 3) setCurrentLangIndex(learningLangs.length - 1);
      if (currentStep - 1 === 4) setCurrentScheduleLangIndex(learningLangs.length - 1);
    }
  };

  // Finish
  const handleFinishOnboarding = () => {
    const languageConfigs: Record<string, LanguageConfig> = {};

    for (const lang of learningLangs) {
      const themes = getThemes(lang);
      const objectives = getObjectives(lang);
      const proIds = PROFESSIONAL_THEMES.map(p => p.id);
      const paths = langPaths[lang] || ['A'];
      languageConfigs[lang] = {
        objectives: objectives.length > 0 ? objectives : ['grammaire', 'vocabulaire', 'lecture', 'ecrit', 'oral'],
        themes,
        hasGrcThemes: themes.some(t => proIds.includes(t)) || paths.includes('C'),
        learningPath: paths.length === 1 ? paths[0] : paths,
      };
    }

    const schedules: Record<string, { days: DayOfWeek[]; duration: SessionDuration; wordsPerDay?: number }> = {};
    for (const lang of learningLangs) {
      schedules[lang] = getSchedule(lang);
    }

    const firstSched = schedules[learningLangs[0]] || { days: [], duration: 20 };
    const settings = { interfaceLang, learningLangs, languageConfigs, schedule: firstSched, schedules };

    const updated = updateUserSettings(user.id, settings);
    if (!updated) return;

    // Check if any language needs mini-lesson diagnostic
    const langsToTest: string[] = [];
    for (const lang of learningLangs) {
      const diag = getDiag(lang);
      if (diag.choice === 'lesson') langsToTest.push(lang);
    }

    if (langsToTest.length > 0) {
      const diagPlan = learningLangs.map(lang => {
        const diag = getDiag(lang);
        return {
          lang,
          cecrl: diag.choice === 'lesson' ? 'test' : 'manual',
          cecrManualLevel: diag.manualLevel,
          grc: diag.choice === 'lesson' && hasGrcForLang(lang) ? 'test' : 'skip',
          hasGrc: hasGrcForLang(lang),
        };
      });
      sessionStorage.setItem('lingualearn_diag_plan', JSON.stringify(diagPlan));
      router.push('/onboarding/diagnostic');
    } else {
      // All manual — set levels and complete
      for (const lang of learningLangs) {
        const diag = getDiag(lang);
        updateUserProgress(user.id, lang, {
          levelCecrl: diag.manualLevel || 'A1',
          levelGrc: hasGrcForLang(lang) ? 'Junior' : undefined,
          diagnosticCompleted: true,
          grcDiagnosticCompleted: hasGrcForLang(lang),
          objectiveProgress: { grammaire: 0, vocabulaire: 0, lecture: 0, ecrit: 0, oral: 0 },
        });
      }
      completeOnboarding(user.id);
      router.push('/dashboard');
    }
  };

  // Check if all languages have diagnostic choice
  const allDiagsDone = learningLangs.every(lang => {
    const d = getDiag(lang);
    return d.choice === 'lesson' || (d.choice === 'manual' && d.manualLevel);
  });

  // ==================== PROGRESS BAR ====================
  const ProgressBar = () => (
    <div className="w-full mb-4">
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-base font-bold text-[#002844]">
          {interfaceLang === 'fr' ? 'Étape' : 'Step'} {currentStep}/5
        </h1>
        <span className="text-xs text-[#555555]">
          {currentStep === 1 && (interfaceLang === 'fr' ? 'Paramétrage' : 'Setup')}
          {currentStep === 2 && (interfaceLang === 'fr' ? 'Parcours' : 'Learning Path')}
          {currentStep === 3 && (interfaceLang === 'fr' ? 'Objectifs' : 'Goals')}
          {currentStep === 4 && (interfaceLang === 'fr' ? 'Organisation' : 'Organization')}
          {currentStep === 5 && (interfaceLang === 'fr' ? 'Première leçon' : 'First lesson')}
        </span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
        <div className="h-full transition-all duration-500 rounded-full" style={{ width: `${(currentStep / 5) * 100}%`, backgroundColor: '#D9B438' }} />
      </div>
    </div>
  );

  // Language indicator component
  const LangIndicator = ({ info, index, total }: { info: typeof LEARNING_LANGUAGES[0] | undefined; index: number; total: number }) => (
    <div className="flex items-center gap-3 p-3 bg-[#002844]/5 rounded-xl border border-[#002844]/20 mb-4">
      <span className="text-2xl">{info?.flag}</span>
      <p className="text-lg font-bold text-[#002844]">{interfaceLang === 'fr' ? info?.nameFr : info?.nameEn}</p>
      {total > 1 && <span className="ml-auto text-xs font-medium text-[#555555]">{index + 1}/{total}</span>}
    </div>
  );

  // ==================== SCREEN 1: LANGUAGES ====================
  const Screen1 = () => (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-[#002844]">{t('onboarding.screen1.title', interfaceLang)}</h2>

      <div>
        <label className="block text-sm font-semibold mb-3 text-[#002844]">{t('onboarding.screen1.interfaceLang', interfaceLang)}</label>
        <div className="flex gap-3">
          {(['fr', 'en'] as const).map(lang => (
            <button key={lang} onClick={() => setInterfaceLang(lang)}
              className={`px-5 py-2.5 rounded-lg font-semibold transition-all ${interfaceLang === lang ? 'text-white' : 'bg-white border-2 border-gray-300 text-[#002844] hover:border-[#002844]'}`}
              style={interfaceLang === lang ? { backgroundColor: '#002844' } : {}}>
              {lang === 'fr' ? 'Français' : 'English'}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-semibold mb-3 text-[#002844]">{t('onboarding.screen1.learningLangs', interfaceLang)}</label>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {LEARNING_LANGUAGES.map(lang => (
            <button key={lang.code} onClick={() => toggleLearningLang(lang.code)}
              className={`p-3 rounded-xl border-2 transition-all ${learningLangs.includes(lang.code) ? 'text-white' : 'bg-white border-gray-200 text-[#002844] hover:border-[#002844]'}`}
              style={learningLangs.includes(lang.code) ? { backgroundColor: '#002844', borderColor: '#002844' } : {}}>
              <div className="text-2xl mb-1">{lang.flag}</div>
              <div className="text-xs font-semibold">{interfaceLang === 'fr' ? lang.nameFr : lang.nameEn}</div>
            </button>
          ))}
        </div>
      </div>

      {errors.length > 0 && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{errors.map((e, i) => <div key={i}>{e}</div>)}</div>}
    </div>
  );

  // ==================== SCREEN 2: LEARNING PATH A/B/C ====================
  const Screen2 = () => {
    const pathLang = learningLangs[currentPathLangIndex];
    const pathLangInfo = LEARNING_LANGUAGES.find(l => l.code === pathLang);
    const selectedPaths = langPaths[pathLang] || [];

    const togglePath = (pathId: LearningPath) => {
      const current = selectedPaths;
      if (pathId === 'C') {
        // C is combinable — toggle independently
        const newPaths: LearningPath[] = current.includes('C')
          ? (current.filter(p => p !== 'C') as LearningPath[])
          : [...current, 'C'];
        setLangPaths(prev => ({ ...prev, [pathLang]: newPaths }));
      } else {
        // A and B are mutually exclusive, but keep C if present
        const isAlreadySelected = current.includes(pathId);
        if (isAlreadySelected) {
          const newPaths: LearningPath[] = current.filter(p => p !== pathId) as LearningPath[];
          setLangPaths(prev => ({ ...prev, [pathLang]: newPaths }));
        } else {
          const other: LearningPath = pathId === 'A' ? 'B' : 'A';
          const newPaths: LearningPath[] = current.filter(p => p !== other) as LearningPath[];
          if (!newPaths.includes(pathId)) newPaths.push(pathId);
          setLangPaths(prev => ({ ...prev, [pathLang]: newPaths }));
        }
      }
    };

    return (
      <div className="space-y-5">
        <LangIndicator info={pathLangInfo} index={currentPathLangIndex} total={learningLangs.length} />

        <div>
          <h2 className="text-xl font-bold text-[#002844] mb-2">
            {interfaceLang === 'fr' ? 'Choisis ton parcours' : 'Choose your path'}
          </h2>
          <p className="text-sm text-[#555555] mb-4">
            {interfaceLang === 'fr'
              ? 'A et B sont exclusifs. C est complémentaire (activable en parallèle).'
              : 'A and B are exclusive. C is complementary (can be combined).'}
          </p>
        </div>

        <div className="space-y-3">
          {LEARNING_PATHS.map((path) => {
            const isSelected = selectedPaths.includes(path.id);
            return (
              <button
                key={path.id}
                onClick={() => togglePath(path.id)}
                className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                  isSelected
                    ? 'border-[#D9B438] bg-[#D9B438]/10'
                    : 'border-gray-200 bg-white hover:border-[#002844]/30'
                }`}
              >
                <div className="flex items-start gap-3">
                  <span className="text-3xl">{path.icon}</span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-[#002844]">
                        {interfaceLang === 'fr'
                          ? `Parcours ${path.id} — ${path.nameFr}`
                          : `Path ${path.id} — ${path.nameEn}`}
                      </h3>
                      {isSelected && (
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-[#D9B438] text-[#002844]">
                          {interfaceLang === 'fr' ? 'Sélectionné' : 'Selected'}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-[#555555] mt-1">
                      {interfaceLang === 'fr' ? path.descFr : path.descEn}
                    </p>
                    <p className="text-xs font-semibold text-[#D9B438] mt-2">
                      {interfaceLang === 'fr' ? path.certFr : path.certEn}
                    </p>
                    {path.id === 'C' && (
                      <p className="text-xs text-[#555555] mt-1 italic">
                        {interfaceLang === 'fr'
                          ? 'Combinable avec A ou B en parallèle'
                          : 'Can be combined with A or B'}
                      </p>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {errors.length > 0 && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{errors.map((e, i) => <div key={i}>{e}</div>)}</div>}
      </div>
    );
  };

  // ==================== SCREEN 3: GOAL + THEMES ====================
  const Screen3 = () => {
    const goal = getGoal(currentLang);
    const themes = getThemes(currentLang);
    const showPersonal = goal === 'personal' || goal === 'both';
    const showPro = goal === 'professional' || goal === 'both';

    // BUG-46/47/48: Determine path context for this language
    const selectedPaths = langPaths[currentLang] || [];
    const hasC = selectedPaths.includes('C');
    const isPathAOnly = selectedPaths.includes('A') && !hasC;
    const isPathBOnly = selectedPaths.includes('B') && !hasC;

    return (
      <div className="space-y-5">
        <LangIndicator info={currentLangInfo} index={currentLangIndex} total={learningLangs.length} />

        {/* BUG-46/47/48: Parcours A → all-inclusive, no goal/theme selection needed */}
        {isPathAOnly && (
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
            <p className="font-bold text-[#002844] text-sm mb-1">📘 {interfaceLang === 'fr' ? 'Parcours complet A1→C2' : 'Complete path A1→C2'}</p>
            <p className="text-xs text-[#555555]">
              {interfaceLang === 'fr'
                ? 'Tous les modules et thèmes sont inclus automatiquement. Grammaire, vocabulaire, lecture, écrit, oral — tout est couvert par le parcours complet.'
                : 'All modules and themes are automatically included. Grammar, vocabulary, reading, writing, speaking — everything is covered by the complete path.'}
            </p>
          </div>
        )}

        {/* BUG-46: Goal type selection — hidden for Parcours A only */}
        {!isPathAOnly && (
        <div>
          <label className="block text-sm font-semibold mb-3 text-[#002844]">
            {interfaceLang === 'fr' ? 'Quel est ton objectif ?' : 'What is your goal?'}
          </label>
          <div className="grid gap-3">
            {([
              { type: 'personal' as GoalType, icon: '🎯', labelFr: 'Personnel', labelEn: 'Personal', descFr: 'Voyage, culture, quotidien...', descEn: 'Travel, culture, daily life...' },
              { type: 'professional' as GoalType, icon: '💼', labelFr: 'Professionnel', labelEn: 'Professional', descFr: 'GRC, business, métier...', descEn: 'GRC, business, career...' },
              { type: 'both' as GoalType, icon: '🎯💼', labelFr: 'Les deux', labelEn: 'Both', descFr: 'Personnel + Professionnel', descEn: 'Personal + Professional' },
            ])
            // BUG-46: Hide GRC options if path B only (no C)
            .filter(item => {
              if (isPathBOnly) return item.type === 'personal';
              return true;
            })
            .map(item => (
              <button key={item.type} onClick={() => setGoal(item.type)}
                className={`flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all ${
                  goal === item.type ? 'border-[#D9B438] bg-[#D9B438]/10' : 'border-gray-200 hover:border-[#002844]/30'
                }`}>
                <span className="text-3xl">{item.icon}</span>
                <div>
                  <p className="font-bold text-[#002844]">{interfaceLang === 'fr' ? item.labelFr : item.labelEn}</p>
                  <p className="text-xs text-[#555555]">{interfaceLang === 'fr' ? item.descFr : item.descEn}</p>
                </div>
                {goal === item.type && <span className="ml-auto text-[#D9B438] text-xl">✓</span>}
              </button>
            ))}
          </div>
        </div>
        )}

        {/* Personal themes — category buttons with collapsible details */}
        {/* BUG-47: Hidden for Parcours A (all themes included) */}
        {showPersonal && !isPathAOnly && (
          <div>
            <label className="block text-sm font-semibold mb-3 text-[#002844]">
              {interfaceLang === 'fr' ? 'Thèmes personnels' : 'Personal themes'}
            </label>
            <div className="space-y-3">
              {THEME_CATEGORIES.map(cat => {
                const catThemeIds = cat.themes;
                const selectedCount = catThemeIds.filter(t => themes.includes(t)).length;
                const allSelected = selectedCount === catThemeIds.length;
                const isExpanded = expandedThemeCategories[cat.id] === true;

                return (
                  <div key={cat.id}>
                    {/* Category button */}
                    <button onClick={() => selectAllInCategory(catThemeIds)}
                      className={`w-full flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${
                        allSelected
                          ? 'bg-[#D9B438]/10 border-[#D9B438] text-[#002844]'
                          : 'bg-white border-gray-200 text-[#002844] hover:border-[#002844]/30'
                      }`}>
                      <span className="text-2xl">{cat.icon}</span>
                      <div className="text-left flex-1">
                        <p className="font-bold">{interfaceLang === 'fr' ? cat.nameFr : cat.nameEn}</p>
                      </div>
                      {selectedCount > 0 && selectedCount < catThemeIds.length && (
                        <span className="text-xs font-bold px-2 py-1 rounded-full bg-[#D9B438]/20 text-[#002844]">
                          {selectedCount}/{catThemeIds.length}
                        </span>
                      )}
                      {allSelected && <span className="text-[#D9B438] text-xl">✓</span>}
                    </button>

                    {/* Expandable detail section - only show if selected */}
                    {selectedCount > 0 && (
                      <button onClick={() => setExpandedThemeCategories(prev => ({ ...prev, [cat.id]: !isExpanded }))}
                        className="text-xs font-semibold text-[#D9B438] hover:underline mt-1 ml-1">
                        {isExpanded
                          ? (interfaceLang === 'fr' ? '▼ Personnaliser' : '▼ Customize')
                          : (interfaceLang === 'fr' ? '▶ Personnaliser' : '▶ Customize')}
                      </button>
                    )}

                    {/* Individual themes - only show if expanded */}
                    {isExpanded && selectedCount > 0 && (
                      <div className="mt-2 p-3 bg-gray-50 rounded-lg space-y-2 ml-2">
                        <div className="flex flex-wrap gap-2">
                          {catThemeIds.map(themeId => {
                            const theme = PERSONAL_THEMES.find(t => t.id === themeId);
                            if (!theme) return null;
                            const selected = themes.includes(themeId);
                            return (
                              <button key={themeId} onClick={() => toggleTheme(themeId)}
                                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                                  selected ? 'text-white' : 'bg-white border border-gray-300 text-[#002844] hover:bg-gray-200'
                                }`}
                                style={selected ? { backgroundColor: '#002844' } : {}}>
                                {interfaceLang === 'fr' ? theme.nameFr : theme.nameEn}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Professional GRC themes */}
        {showPro && (
          <div>
            <label className="block text-sm font-semibold mb-3 text-[#002844]">
              <span className="mr-2">💼</span>
              {interfaceLang === 'fr' ? 'Thèmes professionnels GRC' : 'Professional GRC themes'}
            </label>
            <div className="grid grid-cols-2 gap-2">
              {PROFESSIONAL_THEMES.map(theme => {
                const selected = themes.includes(theme.id);
                return (
                  <button key={theme.id} onClick={() => toggleTheme(theme.id)}
                    className={`px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                      selected ? 'text-white' : 'bg-white border border-gray-200 text-[#002844] hover:border-[#002844]'
                    }`}
                    style={selected ? { backgroundColor: '#002844', borderColor: '#002844' } : {}}>
                    {interfaceLang === 'fr' ? theme.nameFr : theme.nameEn}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* BUG-48: Learning intentions — hidden for Parcours A (all modules included) */}
        {!isPathAOnly && (
        <div>
          <label className="block text-sm font-semibold mb-2 text-[#002844]">
            {interfaceLang === 'fr' ? 'Qu\'est-ce que tu veux faire ?' : 'What do you want to do?'}
          </label>
          <p className="text-xs text-[#555555] mb-3">
            {interfaceLang === 'fr'
              ? 'Grammaire et Vocabulaire sont toujours inclus dans ta session.'
              : 'Grammar and Vocabulary are always included in your session.'}
          </p>
          <div className="space-y-2">
            {[
              { intentions: ['oral'] as LearningObjective[], icon: '🗣️', labelFr: 'Apprendre à parler', labelEn: 'Learn to speak' },
              { intentions: ['ecrit', 'grammaire'] as LearningObjective[], icon: '✍️', labelFr: 'Apprendre à écrire', labelEn: 'Learn to write' },
              { intentions: ['lecture'] as LearningObjective[], icon: '📖', labelFr: 'Apprendre à comprendre', labelEn: 'Learn to understand' },
            ].map(intent => {
              const currentObjectives = getObjectives(currentLang);
              // Check if this intention is selected: at least one of its objectives is in the list (beyond the always-active ones)
              const selected = intent.intentions.some(i => currentObjectives.includes(i) && i !== 'grammaire' && i !== 'vocabulaire')
                || (intent.intentions.includes('oral') && currentObjectives.includes('oral'))
                || (intent.intentions.includes('lecture') && currentObjectives.includes('lecture'))
                || (intent.intentions.includes('ecrit') && currentObjectives.includes('ecrit'));
              return (
                <button key={intent.icon} onClick={() => {
                  // Toggle this intention: add/remove its objectives
                  const current = getObjectives(currentLang);
                  const alwaysActive: LearningObjective[] = ['grammaire', 'vocabulaire'];
                  if (selected) {
                    // Remove this intention's specific objectives (keep always-active)
                    const toRemove = intent.intentions.filter(i => !alwaysActive.includes(i));
                    const newObjs = current.filter(o => !toRemove.includes(o));
                    setLangObjectives(prev => ({ ...prev, [currentLang]: newObjs.length > 0 ? newObjs : alwaysActive }));
                  } else {
                    // Add this intention's objectives + ensure always-active
                    const merged = Array.from(new Set([...current, ...intent.intentions, ...alwaysActive]));
                    setLangObjectives(prev => ({ ...prev, [currentLang]: merged }));
                  }
                }}
                  className={`w-full flex items-center gap-3 px-4 py-4 rounded-xl border-2 font-semibold text-sm transition-all ${
                    selected
                      ? 'border-[#D9B438] bg-[#D9B438]/10 text-[#002844]'
                      : 'border-gray-200 text-[#002844] hover:border-[#002844]/30'
                  }`}>
                  <span className="text-2xl">{intent.icon}</span>
                  <span className="flex-1 text-left">{interfaceLang === 'fr' ? intent.labelFr : intent.labelEn}</span>
                  {selected && <span className="text-[#D9B438] text-lg">✓</span>}
                </button>
              );
            })}
          </div>
        </div>
        )}

        {errors.length > 0 && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{errors.map((e, i) => <div key={i}>{e}</div>)}</div>}
      </div>
    );
  };

  // ==================== SCREEN 3: ORGANISATION ====================
  const Screen4 = () => {
    const sched = getSchedule(scheduleLang);
    return (
      <div className="space-y-6">
        <h2 className="text-xl font-bold text-[#002844]">{t('onboarding.screen3.title', interfaceLang)}</h2>
        <LangIndicator info={scheduleLangInfo} index={currentScheduleLangIndex} total={learningLangs.length} />

        {/* Days */}
        <div>
          <label className="block text-sm font-semibold mb-3 text-[#002844]">{t('onboarding.screen3.days', interfaceLang)}</label>
          <div className="flex gap-2">
            {DAYS_OF_WEEK.map(day => (
              <button key={day.id} onClick={() => toggleScheduleDay(day.id)}
                className={`flex-1 py-3 rounded-lg font-bold text-sm transition-all ${sched.days.includes(day.id) ? 'text-white' : 'bg-gray-100 text-[#002844] hover:bg-gray-200'}`}
                style={sched.days.includes(day.id) ? { backgroundColor: '#002844' } : {}}>
                {interfaceLang === 'fr' ? day.shortFr : day.shortEn}
              </button>
            ))}
          </div>
        </div>

        {/* Duration */}
        <div>
          <label className="block text-sm font-semibold mb-3 text-[#002844]">{t('onboarding.screen3.duration', interfaceLang)}</label>
          <div className="grid grid-cols-4 gap-2">
            {SESSION_DURATIONS.map(dur => (
              <button key={dur.value} onClick={() => setScheduleDuration(dur.value)}
                className={`py-2.5 rounded-lg font-semibold text-sm transition-all ${sched.duration === dur.value ? 'text-white' : 'bg-white border border-gray-200 text-[#002844] hover:border-[#002844]'}`}
                style={sched.duration === dur.value ? { backgroundColor: '#002844' } : {}}>
                {interfaceLang === 'fr' ? dur.labelFr : dur.labelEn}
              </button>
            ))}
          </div>
        </div>

        {/* Words per day */}
        <div>
          <label className="block text-sm font-semibold mb-3 text-[#002844]">
            {interfaceLang === 'fr' ? 'Mots par jour' : 'Words per day'}
          </label>
          <div className="flex gap-3">
            {[4, 8, 12].map(n => (
              <button key={n} onClick={() => setWordsPerDay(n)}
                className={`flex-1 py-3 rounded-xl font-bold text-lg transition-all ${sched.wordsPerDay === n ? 'text-white' : 'bg-gray-100 text-[#002844] hover:bg-gray-200'}`}
                style={sched.wordsPerDay === n ? { backgroundColor: '#D9B438', color: '#002844' } : {}}>
                {n}
              </button>
            ))}
          </div>
        </div>

        {errors.length > 0 && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{errors.map((e, i) => <div key={i}>{e}</div>)}</div>}
      </div>
    );
  };

  // ==================== SCREEN 4: MINI-LESSON / LEVEL ====================
  const Screen5 = () => {
    const diag = getDiag(diagLang);
    const langName = interfaceLang === 'fr' ? diagLangInfo?.nameFr : diagLangInfo?.nameEn;

    const setDiagChoice = (choice: 'lesson' | 'manual') => {
      setLangDiagnostics(prev => ({ ...prev, [diagLang]: { ...prev[diagLang], choice } }));
    };

    const setManualLevel = (level: LevelCECRL) => {
      setLangDiagnostics(prev => ({
        ...prev,
        [diagLang]: { choice: 'manual', manualLevel: level },
      }));
      // Auto-advance to next language after a short delay
      if (currentDiagLangIndex < learningLangs.length - 1) {
        setTimeout(() => setCurrentDiagLangIndex(prev => prev + 1), 300);
      }
    };

    return (
      <div className="space-y-5">
        <LangIndicator info={diagLangInfo} index={currentDiagLangIndex} total={learningLangs.length} />

        {diag.choice === 'undecided' && (
          <>
            {/* Welcome message */}
            <div className="text-center py-4">
              <div className="text-5xl mb-3">🎓</div>
              <h2 className="text-xl font-bold text-[#002844] mb-2">
                {interfaceLang === 'fr'
                  ? `Prêt(e) pour ta première leçon en ${langName} ?`
                  : `Ready for your first ${langName} lesson?`}
              </h2>
              <p className="text-sm text-[#555555] max-w-sm mx-auto">
                {interfaceLang === 'fr'
                  ? 'Une mini-leçon pour découvrir ton niveau et personnaliser ton parcours. Tu apprends dès maintenant !'
                  : 'A mini-lesson to discover your level and personalize your path. You start learning right now!'}
              </p>
              {hasGrcForLang(diagLang) && (
                <p className="text-xs text-[#D9B438] mt-2 font-semibold">
                  {interfaceLang === 'fr'
                    ? '+ Exercices professionnels GRC inclus'
                    : '+ Professional GRC exercises included'}
                </p>
              )}
            </div>

            <div className="grid gap-3">
              <button onClick={() => setDiagChoice('lesson')}
                className="p-4 rounded-xl text-left transition-all hover:shadow-md"
                style={{ backgroundColor: '#D9B438', color: '#002844' }}>
                <p className="font-bold text-lg">
                  {interfaceLang === 'fr' ? '🚀 Commencer ma première leçon' : '🚀 Start my first lesson'}
                </p>
                <p className="text-sm opacity-80 mt-1">
                  {interfaceLang === 'fr' ? '~5 min • Vocabulaire, grammaire, écoute, lecture' : '~5 min • Vocabulary, grammar, listening, reading'}
                </p>
              </button>

              <button onClick={() => setDiagChoice('manual')}
                className="p-4 rounded-xl border-2 border-gray-200 text-left transition-all hover:border-[#002844]/30">
                <p className="font-semibold text-[#002844]">
                  {interfaceLang === 'fr' ? 'Je connais déjà mon niveau' : 'I already know my level'}
                </p>
                <p className="text-xs text-[#555555] mt-1">
                  {interfaceLang === 'fr' ? 'Sélectionner manuellement A1 → C2' : 'Manually select A1 → C2'}
                </p>
              </button>
            </div>
          </>
        )}

        {diag.choice === 'lesson' && (
          <div className="text-center py-6">
            <div className="text-4xl mb-2">✅</div>
            <p className="text-lg font-bold text-[#002844]">
              {interfaceLang === 'fr' ? `Mini-leçon prévue pour ${langName}` : `Mini-lesson planned for ${langName}`}
            </p>
            <p className="text-sm text-[#555555] mt-1">
              {interfaceLang === 'fr' ? 'Elle commencera après la configuration.' : 'It will start after setup.'}
            </p>
            <button onClick={() => setLangDiagnostics(prev => ({ ...prev, [diagLang]: { choice: 'undecided' } }))}
              className="mt-3 text-xs text-[#D9B438] font-semibold hover:underline">
              {interfaceLang === 'fr' ? 'Modifier' : 'Change'}
            </button>
          </div>
        )}

        {diag.choice === 'manual' && (
          <div className="space-y-4">
            <p className="text-sm font-semibold text-[#002844]">
              {interfaceLang === 'fr' ? `Quel est ton niveau CECRL en ${langName} ?` : `What is your CECRL level in ${langName}?`}
            </p>
            <div className="grid grid-cols-3 gap-3">
              {(['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as LevelCECRL[]).map(level => (
                <button key={level} onClick={() => setManualLevel(level)}
                  className={`p-3 rounded-xl border-2 text-center font-bold text-lg transition-all ${
                    diag.manualLevel === level ? 'border-[#D9B438] bg-[#D9B438]/10 text-[#002844]' : 'border-gray-200 text-[#002844] hover:border-[#002844]'
                  }`}>
                  {level}
                  <p className="text-xs font-normal text-[#555555] mt-1">
                    {level === 'A1' && (interfaceLang === 'fr' ? 'Débutant' : 'Beginner')}
                    {level === 'A2' && (interfaceLang === 'fr' ? 'Élémentaire' : 'Elementary')}
                    {level === 'B1' && (interfaceLang === 'fr' ? 'Intermédiaire' : 'Intermediate')}
                    {level === 'B2' && (interfaceLang === 'fr' ? 'Avancé' : 'Upper intermediate')}
                    {level === 'C1' && (interfaceLang === 'fr' ? 'Autonome' : 'Proficient')}
                    {level === 'C2' && (interfaceLang === 'fr' ? 'Maîtrise' : 'Mastery')}
                  </p>
                </button>
              ))}
            </div>
            <button onClick={() => setLangDiagnostics(prev => ({ ...prev, [diagLang]: { choice: 'undecided' } }))}
              className="text-xs text-[#D9B438] font-semibold hover:underline">
              {interfaceLang === 'fr' ? '← Revenir au choix' : '← Back to choice'}
            </button>
          </div>
        )}

        {/* Navigation between diagnostic languages */}
        {currentDiagLangIndex < learningLangs.length - 1 && diag.choice !== 'undecided' && (diag.choice === 'lesson' || diag.manualLevel) && (
          <button onClick={() => setCurrentDiagLangIndex(prev => prev + 1)}
            className="w-full py-3 rounded-xl font-semibold text-[#002844] border-2 border-[#002844]/20 hover:bg-[#002844]/5 transition-all">
            {interfaceLang === 'fr' ? 'Langue suivante →' : 'Next language →'}
          </button>
        )}

        {/* Finish button */}
        {allDiagsDone && currentDiagLangIndex >= learningLangs.length - 1 && (
          <button onClick={handleFinishOnboarding}
            className="w-full py-4 rounded-xl font-bold text-lg transition-all hover:shadow-lg"
            style={{ backgroundColor: '#D9B438', color: '#002844' }}>
            {learningLangs.some(l => getDiag(l).choice === 'lesson')
              ? (interfaceLang === 'fr' ? '🚀 Lancer ma première leçon' : '🚀 Start my first lesson')
              : (interfaceLang === 'fr' ? 'Accéder au Dashboard' : 'Go to Dashboard')}
          </button>
        )}
      </div>
    );
  };

  // ==================== MAIN RENDER ====================
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white p-3 sm:p-6">
      <div className="max-w-lg mx-auto">
        <ProgressBar />
        <div className="bg-white rounded-2xl shadow-lg p-4 sm:p-6 mb-4 overflow-y-auto max-h-[calc(100vh-160px)]">
          {currentStep === 1 && <Screen1 />}
          {currentStep === 2 && <Screen2 />}
          {currentStep === 3 && <Screen3 />}
          {currentStep === 4 && <Screen4 />}
          {currentStep === 5 && <Screen5 />}
        </div>

        {currentStep < 5 && (
          <div className="flex gap-3 justify-between">
            <button onClick={handlePrevious}
              disabled={currentStep === 1 && currentLangIndex === 0}
              className={`px-5 py-2.5 rounded-lg font-semibold transition-all ${
                currentStep === 1 && currentLangIndex === 0 ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-white border border-gray-300 text-[#002844] hover:bg-gray-50'
              }`}>
              {interfaceLang === 'fr' ? 'Précédent' : 'Previous'}
            </button>
            <button onClick={handleNext}
              className="px-6 py-2.5 rounded-lg font-semibold transition-all hover:shadow-md"
              style={{ backgroundColor: '#D9B438', color: '#002844' }}>
              {(currentStep === 2 && currentPathLangIndex < learningLangs.length - 1) ||
               (currentStep === 3 && currentLangIndex < learningLangs.length - 1) ||
               (currentStep === 4 && currentScheduleLangIndex < learningLangs.length - 1)
                ? (interfaceLang === 'fr' ? 'Langue suivante →' : 'Next language →')
                : (interfaceLang === 'fr' ? 'Suivant' : 'Next')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
