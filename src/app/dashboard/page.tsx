'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getCurrentUser, setActiveLang, logoutUser, getAllUsers, getDueReviews } from '@/lib/db/localStorage'
import { User, InterfaceLanguage, LearningLanguage, DayOfWeek, LEARNING_LANGUAGES } from '@/types'
import { t } from '@/lib/i18n'
import { initNotifications, scheduleReminder } from '@/lib/notifications'
import {
  Flame, GraduationCap, Trophy, ChevronDown, ChevronRight, Calendar, Clock,
  BookOpen, PenTool, Languages, Mic, Pencil, LogOut,
} from 'lucide-react'
import BottomNav from '@/components/BottomNav'

export default function DashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [lang, setLang] = useState<InterfaceLanguage>('fr')
  const [loading, setLoading] = useState(true)
  const [isPending, setIsPending] = useState(false)
  const [langSelectorOpen, setLangSelectorOpen] = useState(false)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [tasksOpen, setTasksOpen] = useState(false)

  const loadUser = () => {
    const currentUser = getCurrentUser()
    if (!currentUser) { router.push('/auth'); return }
    if (!currentUser.onboardingCompleted && currentUser.role !== 'admin') { router.push('/onboarding'); return }
    if (currentUser.status === 'pending') {
      setIsPending(true)
      setUser(currentUser)
      setLang(currentUser.settings.interfaceLang || 'fr')
      setLoading(false)
      return
    }
    // If activeLang was removed from learningLangs, reset it
    if (currentUser.activeLang && !currentUser.settings.learningLangs.includes(currentUser.activeLang)) {
      currentUser.activeLang = currentUser.settings.learningLangs[0] || undefined
    }
    if (!currentUser.activeLang && currentUser.settings.learningLangs.length > 0) {
      currentUser.activeLang = currentUser.settings.learningLangs[0]
    }
    setUser(currentUser)
    setLang(currentUser.settings.interfaceLang || 'fr')
    setLoading(false)

    // Initialize notifications
    initNotifications().catch(err => console.error('Failed to initialize notifications:', err))

    // Schedule reminder for active language
    if (currentUser.activeLang) {
      const activeLangConfig = currentUser.settings.schedules?.[currentUser.activeLang] || currentUser.settings.schedule
      if (activeLangConfig?.days) {
        scheduleReminder(activeLangConfig.days, currentUser.activeLang)
      }
    }
  }

  useEffect(() => {
    loadUser()
    // Reload user data when returning to this page (e.g. back from Profile)
    const handleReload = () => loadUser()
    const handleVisibility = () => { if (document.visibilityState === 'visible') loadUser() }
    window.addEventListener('focus', handleReload)
    window.addEventListener('popstate', handleReload)
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      window.removeEventListener('focus', handleReload)
      window.removeEventListener('popstate', handleReload)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router])

  const switchLanguage = (newLang: LearningLanguage) => {
    if (!user) return
    const updated = setActiveLang(user.id, newLang)
    if (updated) { setUser(updated); setLangSelectorOpen(false) }
  }

  if (loading || !user) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#F0F0F0]">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-[#002844]" />
      </div>
    )
  }

  if (isPending) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#F0F0F0] px-6">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#D9B438]/20 flex items-center justify-center">
            <svg className="h-8 w-8 text-[#D9B438]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-[#002844] mb-2">
            {lang === 'fr' ? 'Compte en attente de validation' : 'Account pending approval'}
          </h2>
          <p className="text-sm text-[#555555] mb-6">
            {lang === 'fr'
              ? 'Votre compte a bien été créé. Un administrateur doit valider votre accès avant que vous puissiez utiliser les modules.'
              : 'Your account has been created. An administrator must approve your access before you can use the modules.'}
          </p>
          <button onClick={() => { logoutUser(); router.push('/auth') }}
            className="px-6 py-2 rounded-xl bg-[#002844] text-white text-sm font-bold hover:bg-[#003a5c] transition-colors">
            {lang === 'fr' ? 'Retour à la connexion' : 'Back to login'}
          </button>
        </div>
      </div>
    )
  }

  const activeLang = user.activeLang || user.settings.learningLangs[0]
  const activeLangInfo = LEARNING_LANGUAGES.find(l => l.code === activeLang)
  const rawProgress = user.progress?.[activeLang]

  // BUG-61 (V3.9): Reset daily counters if day has changed
  const progress = (() => {
    if (!rawProgress) return rawProgress
    const todayStr = new Date().toISOString().split('T')[0]
    const lastDay = rawProgress.lastActivityDate?.split('T')[0]
    if (lastDay && lastDay !== todayStr) {
      return { ...rawProgress, dailyWordsCompleted: 0, dailyExercisesCompleted: 0 }
    }
    return rawProgress
  })()
  const langConfig = user.settings.languageConfigs?.[activeLang]
  const hasGrc = langConfig?.hasGrcThemes || false
  const objectives = langConfig?.objectives || []

  // 5 objective blocks (Spec V3 §6) — Entraînement is a mode, not an objective
  const moduleBlocks = [
    { id: 'vocabulaire', label: lang === 'fr' ? 'Vocabulaire' : 'Vocabulary', icon: BookOpen, color: '#1976D2', bgLight: '#E3F2FD', href: '/module/vocabulaire', objective: 'vocabulaire' },
    { id: 'grammaire', label: lang === 'fr' ? 'Grammaire' : 'Grammar', icon: PenTool, color: '#F9A825', bgLight: '#FFF8E1', href: '/module/grammaire', objective: 'grammaire' },
    { id: 'lecture', label: lang === 'fr' ? 'Lecture' : 'Reading', icon: Languages, color: '#2E7D32', bgLight: '#E8F5E9', href: '/module/lecture', objective: 'lecture' },
    { id: 'oral', label: lang === 'fr' ? 'Oral' : 'Speaking', icon: Mic, color: '#7B1FA2', bgLight: '#F3E5F5', href: '/module/oral', objective: 'oral' },
    { id: 'ecrit', label: lang === 'fr' ? 'Écrit' : 'Writing', icon: Pencil, color: '#E65100', bgLight: '#FFF3E0', href: '/module/ecrit', objective: 'ecrit' },
  ]

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const sessionModules = (() => {
    // First: modules matching user's objectives, sorted by lowest progression
    const objectiveModules = moduleBlocks
      .filter(b => (objectives as string[]).includes(b.objective))
      .sort((a, b) => {
        const pctA = progress?.objectiveProgress?.[a.objective as keyof typeof progress.objectiveProgress] || 0
        const pctB = progress?.objectiveProgress?.[b.objective as keyof typeof progress.objectiveProgress] || 0
        return pctA - pctB
      })
    // If less than 2, fill with other modules by lowest progression
    if (objectiveModules.length >= 2) return objectiveModules.slice(0, 2)
    const remaining = moduleBlocks
      .filter(b => !(objectives as string[]).includes(b.objective))
      .sort((a, b) => {
        const pctA = progress?.objectiveProgress?.[a.objective as keyof typeof progress.objectiveProgress] || 0
        const pctB = progress?.objectiveProgress?.[b.objective as keyof typeof progress.objectiveProgress] || 0
        return pctA - pctB
      })
    return [...objectiveModules, ...remaining].slice(0, 2)
  })()
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const sessionDuration = user.settings.schedules?.[activeLang]?.duration || user.settings.schedule?.duration || 10

  // §5 V3.8: Find next uncompleted course with full details
  const nextCourseInfo = (() => {
    try {
      const key = `lingualearn_course_scores_${user.id}_${activeLang}`
      const stored = localStorage.getItem(key)
      const scores: Record<string, { score: number }> = stored ? JSON.parse(stored) : {}

      const paths = langConfig?.learningPath
        ? (Array.isArray(langConfig.learningPath) ? langConfig.learningPath : [langConfig.learningPath])
        : []
      const isPathB = paths.includes('B') && !paths.includes('A')

      // Course catalog with names
      const a1Courses = [
        { id: 'a1_c1', n: 1, fr: 'Verbe To Be', en: 'Verb To Be' }, { id: 'a1_c2', n: 2, fr: 'Le pluriel des noms', en: 'Plural nouns' },
        { id: 'a1_c3', n: 3, fr: 'To Be : interrogation', en: 'To Be: questions' }, { id: 'a1_c4', n: 4, fr: 'Articles A/An/The', en: 'Articles' },
        { id: 'a1_c5', n: 5, fr: 'Adjectifs possessifs', en: 'Possessive adj.' }, { id: 'a1_d1', n: 0, fr: 'Dialogue 1', en: 'Dialogue 1' },
        { id: 'a1_cp1', n: 0, fr: 'Checkpoint 1', en: 'Checkpoint 1' }, { id: 'a1_c6', n: 6, fr: 'Present Simple', en: 'Present Simple' },
        { id: 'a1_c7', n: 7, fr: 'Present Simple : interrogation', en: 'Present Simple: questions' }, { id: 'a1_c8', n: 8, fr: 'Present Simple : négation', en: 'Present Simple: negation' },
        { id: 'a1_c9', n: 9, fr: 'Mots interrogatifs', en: 'Question words' }, { id: 'a1_c10', n: 10, fr: 'Adverbes de fréquence', en: 'Frequency adverbs' },
        { id: 'a1_d2', n: 0, fr: 'Dialogue 2', en: 'Dialogue 2' }, { id: 'a1_cp2', n: 0, fr: 'Checkpoint 2', en: 'Checkpoint 2' },
        { id: 'a1_c11', n: 11, fr: 'Nombres 1 à 100', en: 'Numbers 1-100' }, { id: 'a1_c12', n: 12, fr: 'Couleurs et adjectifs', en: 'Colors & adjectives' },
        { id: 'a1_c13', n: 13, fr: 'Have Got', en: 'Have Got' }, { id: 'a1_c14', n: 14, fr: 'Pronoms sujets/compléments', en: 'Subject/object pronouns' },
        { id: 'a1_c15', n: 15, fr: 'Prépositions de lieu', en: 'Prepositions of place' }, { id: 'a1_d3', n: 0, fr: 'Dialogue 3', en: 'Dialogue 3' },
        { id: 'a1_cp3', n: 0, fr: 'Checkpoint 3', en: 'Checkpoint 3' }, { id: 'a1_c16', n: 16, fr: "L'heure et les jours", en: 'Time and days' },
        { id: 'a1_c17', n: 17, fr: 'Present Progressive', en: 'Present Progressive' }, { id: 'a1_c18', n: 18, fr: 'Simple vs Progressive', en: 'Simple vs Progressive' },
        { id: 'a1_c19', n: 19, fr: 'Réponses courtes', en: 'Short answers' }, { id: 'a1_c20', n: 20, fr: 'Cas possessif', en: 'Possessive case' },
        { id: 'a1_d4', n: 0, fr: 'Dialogue 4', en: 'Dialogue 4' }, { id: 'a1_cp4', n: 0, fr: 'Checkpoint 4', en: 'Checkpoint 4' },
        { id: 'a1_c21', n: 21, fr: 'Mois et saisons', en: 'Months & seasons' }, { id: 'a1_c22', n: 22, fr: 'Météo', en: 'Weather' },
        { id: 'a1_c23', n: 23, fr: 'Can / Can\'t', en: 'Can / Can\'t' }, { id: 'a1_c24', n: 24, fr: 'Les impératifs', en: 'Imperatives' },
        { id: 'a1_c25', n: 25, fr: 'Révision A1', en: 'A1 Revision' }, { id: 'a1_d5', n: 0, fr: 'Dialogue 5', en: 'Dialogue 5' },
        { id: 'a1_cert', n: 0, fr: 'Certification A1', en: 'A1 Certification' },
      ]
      const bCourses = [
        { id: 'b_b1_c1', n: 1, fr: 'Salutations', en: 'Greetings' }, { id: 'b_b1_c2', n: 2, fr: 'To be + Pronoms', en: 'To be + Pronouns' },
        { id: 'b_b1_c3', n: 3, fr: 'Adj. possessifs', en: 'Possessive adj.' }, { id: 'b_b1_d', n: 0, fr: 'Dialogue B1', en: 'Dialogue B1' },
        { id: 'b_b1_cp', n: 0, fr: 'Badge B1', en: 'Badge B1' }, { id: 'b_b2_c1', n: 1, fr: 'Famille', en: 'Family' },
        { id: 'b_b2_c2', n: 2, fr: 'Have got', en: 'Have got' }, { id: 'b_b2_c3', n: 3, fr: 'Questions simples', en: 'Simple questions' },
        { id: 'b_b2_d', n: 0, fr: 'Dialogue B2', en: 'Dialogue B2' }, { id: 'b_b2_cp', n: 0, fr: 'Badge B2', en: 'Badge B2' },
        { id: 'b_b3_c1', n: 1, fr: 'Nourriture', en: 'Food' }, { id: 'b_b3_c2', n: 2, fr: 'Can + Impératifs', en: 'Can + Imperatives' },
        { id: 'b_b3_c3', n: 3, fr: 'Articles', en: 'Articles' }, { id: 'b_b3_d', n: 0, fr: 'Dialogue B3', en: 'Dialogue B3' },
        { id: 'b_b3_cp', n: 0, fr: 'Badge B3', en: 'Badge B3' }, { id: 'b_b4_c1', n: 1, fr: 'Voyage', en: 'Travel' },
        { id: 'b_b4_c2', n: 2, fr: 'Prépositions', en: 'Prepositions' }, { id: 'b_b4_c3', n: 3, fr: 'Where/How', en: 'Where/How' },
        { id: 'b_b4_d', n: 0, fr: 'Dialogue B4', en: 'Dialogue B4' }, { id: 'b_b4_cp', n: 0, fr: 'Badge B4', en: 'Badge B4' },
        { id: 'b_b5_c1', n: 1, fr: 'Vêtements', en: 'Clothes' }, { id: 'b_b5_c2', n: 2, fr: 'Nombres + Adj.', en: 'Numbers + Adj.' },
        { id: 'b_b5_c3', n: 3, fr: 'How much/many', en: 'How much/many' }, { id: 'b_b5_d', n: 0, fr: 'Dialogue B5', en: 'Dialogue B5' },
        { id: 'b_b5_cp', n: 0, fr: 'Badge B5', en: 'Badge B5' }, { id: 'b_b6_c1', n: 1, fr: 'Actions', en: 'Actions' },
        { id: 'b_b6_c2', n: 2, fr: 'Present Progressive', en: 'Present Progressive' }, { id: 'b_b6_c3', n: 3, fr: 'Adverbes de temps', en: 'Time adverbs' },
        { id: 'b_b6_d', n: 0, fr: 'Dialogue B6', en: 'Dialogue B6' }, { id: 'b_b6_cp', n: 0, fr: 'Badge B6', en: 'Badge B6' },
      ]
      const courses = isPathB ? bCourses : a1Courses
      const next = courses.find(c => !scores[c.id] || scores[c.id].score < 60)
      const course = next || courses[0]
      const total = courses.length
      const completedCount = courses.filter(c => scores[c.id] && scores[c.id].score >= 60).length

      return {
        url: `/session?courseId=${course.id}`,
        nameFr: course.n > 0 ? `Cours ${course.n} — ${course.fr}` : course.fr,
        nameEn: course.n > 0 ? `Course ${course.n} — ${course.en}` : course.en,
        progress: `${completedCount}/${total}`,
        isPathB,
      }
    } catch {
      return { url: '/session', nameFr: 'Cours 1', nameEn: 'Course 1', progress: '0/35', isPathB: false }
    }
  })()

  // V3.10: Spaced repetition — compute due reviews
  const dueReviews = getDueReviews(user.id, activeLang)
  const dueWordReviews = dueReviews.filter(r => r.type === 'word').length
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const dueGrammarReviews = dueReviews.filter(r => r.type === 'grammar').length

  return (
    <div className="min-h-screen bg-[#F0F0F0] pb-20">
      {/* TOP BAR — compact: logo + lang selector + logout */}
      <div className="sticky top-0 z-50 bg-[#002844] px-4 py-3 flex items-center justify-between">
        <h1 className="text-lg font-bold text-white">Lingua<span className="text-[#D9B438]">Learn</span></h1>

        <div className="flex items-center gap-2">
          {/* Language selector */}
          <div className="relative">
            <button onClick={() => setLangSelectorOpen(!langSelectorOpen)}
              className="flex items-center gap-2 rounded-lg bg-white/10 px-3 py-1.5 text-sm font-medium text-white">
              <span className="text-lg">{activeLangInfo?.flag}</span>
              <span>{lang === 'fr' ? activeLangInfo?.nameFr : activeLangInfo?.nameEn}</span>
              {user.settings.learningLangs.length > 1 && <ChevronDown className={`h-4 w-4 transition-transform ${langSelectorOpen ? 'rotate-180' : ''}`} />}
            </button>
            {langSelectorOpen && user.settings.learningLangs.length > 1 && (
              <div className="absolute right-0 top-full mt-1 z-50 rounded-xl bg-white shadow-lg border min-w-[180px]">
                {user.settings.learningLangs.map(lc => {
                  const info = LEARNING_LANGUAGES.find(l => l.code === lc)
                  return (
                    <button key={lc} onClick={() => switchLanguage(lc)}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm ${lc === activeLang ? 'bg-[#002844]/5 font-bold' : 'hover:bg-gray-50'}`}>
                      <span className="text-lg">{info?.flag}</span>
                      <span className="text-[#002844]">{lang === 'fr' ? info?.nameFr : info?.nameEn}</span>
                      {lc === activeLang && <span className="ml-auto text-[#D9B438]">✓</span>}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
          {/* Logout button */}
          <button onClick={() => { logoutUser(); router.push('/auth') }}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors" title={lang === 'fr' ? 'Déconnexion' : 'Logout'}>
            <LogOut className="h-4 w-4 text-white/70" />
          </button>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <main className="px-4 pt-4">
        {/* BLOC-01: Greeting + BLOC-04: Streak + Daily objective */}
        {(() => {
          const streak = progress?.streak || 0
          const dailyWords = progress?.dailyWordsCompleted || 0
          const dailyExercises = progress?.dailyExercisesCompleted || 0
          const wordsTarget = user.settings.schedules?.[activeLang]?.wordsPerDay || 8
          // BUG-61 V3.9: dailyTarget = wordsPerDay from profile, no hardcoded addition
          const dailyTotalRaw = dailyWords + dailyExercises
          const dailyTarget = wordsTarget
          // BUG-52: Cap display at target max
          const dailyTotal = Math.min(dailyTotalRaw, dailyTarget)
          const dailyPct = Math.min(100, Math.round((dailyTotalRaw / dailyTarget) * 100))
          const objectiveReached = dailyTotalRaw >= dailyTarget
          const displayName = user.firstName && !user.firstName.includes('@') ? user.firstName : user.firstName?.split('@')[0] || (lang === 'fr' ? 'apprenant' : 'learner')
          return (
            <>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="text-xl font-bold text-[#002844]">{t('dashboard.hello', lang)} {displayName} 👋</h2>
                  <p className="text-xs text-[#555555] mt-0.5">
                    {streak > 0
                      ? (lang === 'fr' ? `Jour ${streak} — Continue comme ça !` : `Day ${streak} — Keep it up!`)
                      : (lang === 'fr' ? 'Commence ta première session !' : 'Start your first session!')}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 rounded-xl bg-white px-3 py-2 shadow-sm">
                  <Flame className="h-5 w-5 text-[#D9B438]" fill="#D9B438" />
                  <span className="text-lg font-bold text-[#002844]">{streak}</span>
                </div>
              </div>
              {/* Daily objective bar */}
              <div className="rounded-xl bg-white p-3 shadow-sm mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-[#002844]">
                    {lang === 'fr' ? "Objectif du jour" : "Today's goal"}
                  </span>
                  <span className={`text-xs font-bold ${objectiveReached ? 'text-green-600' : 'text-[#D9B438]'}`}>
                    {objectiveReached
                      ? (lang === 'fr' ? `${dailyTarget}/${dailyTarget} ✓ Objectif atteint !` : `${dailyTarget}/${dailyTarget} ✓ Goal reached!`)
                      : `${dailyTotal}/${dailyTarget}`}
                  </span>
                </div>
                <div className="h-2.5 w-full rounded-full bg-gray-100">
                  <div className="h-full rounded-full bg-gradient-to-r from-[#D9B438] to-[#f0c84a] transition-all" style={{ width: `${dailyPct}%` }} />
                </div>
                <div className="flex justify-between mt-1.5">
                  <span className="text-[10px] text-[#555555]">{dailyWords} {lang === 'fr' ? 'mots' : 'words'}</span>
                  <span className="text-[10px] text-[#555555]">{dailyExercises} {lang === 'fr' ? 'exercices' : 'exercises'}</span>
                </div>
              </div>
            </>
          )
        })()}

        {/* BLOC 2 — V3.10: Niveau / Certification (1 ligne) */}
        <div className="flex items-center gap-3 rounded-xl bg-white p-3 shadow-sm mb-4">
          <GraduationCap className="h-5 w-5 text-[#002844] flex-shrink-0" />
          <span className="text-sm font-bold text-[#002844]">
            CECRL : {progress?.diagnosticCompleted ? (progress.levelCecrl || 'A1') : (lang === 'fr' ? 'Non évalué' : 'N/A')}
          </span>
          {hasGrc && (
            <>
              <span className="text-[#555555]">|</span>
              <Trophy className="h-5 w-5 text-[#D9B438] flex-shrink-0" />
              <span className="text-sm font-bold text-[#002844]">GRC : {progress?.levelGrc || 'Junior'}</span>
            </>
          )}
        </div>

        {/* Diagnostic banner */}
        {progress && !progress.diagnosticCompleted && (
          <a href="/onboarding/diagnostic"
            className="block mb-4 rounded-xl bg-gradient-to-r from-[#D9B438]/20 to-[#002844]/10 border border-[#D9B438] p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-[#002844]">{lang === 'fr' ? 'Passez votre diagnostic' : 'Take your diagnostic'}</p>
                <p className="text-xs text-[#555555]">{lang === 'fr' ? 'Évaluez votre niveau CECRL' : 'Assess your CECRL level'}</p>
              </div>
              <ChevronRight className="h-5 w-5 text-[#002844]" />
            </div>
          </a>
        )}

        {/* BLOC 3 — V3.10: Pavé "Explorer" (grille 3 colonnes, icônes rondes) */}
        <div className="rounded-2xl bg-white shadow-sm p-4 mb-4">
          <p className="font-bold text-sm text-[#002844] mb-3">{lang === 'fr' ? 'Explorer' : 'Explore'}</p>
          <div className="grid grid-cols-3 gap-3">
            {/* 📦 Mes nouveaux mots */}
            <a href="/module/coffre" className="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-[#FFF8E1] transition-colors active:scale-95">
              <div className="w-14 h-14 rounded-full bg-[#D9B438]/15 flex items-center justify-center">
                <span className="text-2xl">📦</span>
              </div>
              <p className="text-[11px] font-bold text-[#002844] text-center leading-tight">{lang === 'fr' ? 'Mes nouveaux mots' : 'New words'}</p>
            </a>
            {/* 🔄 Mes révisions */}
            <a href="/module/vocabulaire" className="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-[#F3E5F5] transition-colors active:scale-95 relative">
              <div className="w-14 h-14 rounded-full bg-[#7B1FA2]/10 flex items-center justify-center relative">
                <span className="text-2xl">🔄</span>
                {dueWordReviews > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">{dueWordReviews}</span>
                )}
              </div>
              <p className="text-[11px] font-bold text-[#002844] text-center leading-tight">{lang === 'fr' ? 'Mes révisions' : 'Reviews'}</p>
            </a>
            {/* ▶️ Mon cours du jour */}
            <a href={nextCourseInfo.url} className="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-[#E3F2FD] transition-colors active:scale-95">
              <div className="w-14 h-14 rounded-full bg-[#1976D2]/10 flex items-center justify-center">
                <span className="text-2xl">▶️</span>
              </div>
              <p className="text-[11px] font-bold text-[#002844] text-center leading-tight">{lang === 'fr' ? 'Mon cours du jour' : 'Today\'s course'}</p>
            </a>
            {/* 📘 Mon parcours */}
            <a href="/module/cours" className="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-[#E8F5E9] transition-colors active:scale-95">
              <div className="w-14 h-14 rounded-full bg-[#2E7D32]/10 flex items-center justify-center">
                <span className="text-2xl">📘</span>
              </div>
              <p className="text-[11px] font-bold text-[#002844] text-center leading-tight">
                {lang === 'fr'
                  ? (nextCourseInfo.isPathB ? 'Mon parcours B' : 'Mon parcours A1')
                  : (nextCourseInfo.isPathB ? 'Path B' : 'A1 Path')}
              </p>
            </a>
            {/* 🎯 Entraînement */}
            <a href="/module/entrainement" className="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-[#FFF3E0] transition-colors active:scale-95">
              <div className="w-14 h-14 rounded-full bg-[#E65100]/10 flex items-center justify-center">
                <span className="text-2xl">🎯</span>
              </div>
              <p className="text-[11px] font-bold text-[#002844] text-center leading-tight">{lang === 'fr' ? 'Entraînement' : 'Training'}</p>
            </a>
          </div>
        </div>

        {/* BLOC 4 — V3.10: Progression + Planning (gauche 60%) | Classement (droite 40%) */}
        <div className="md:grid md:grid-cols-5 md:gap-4">
          {/* Left column (60%) — Objectifs + Planning */}
          <div className="md:col-span-3 space-y-4 mb-4 md:mb-0">
            {/* Objective blocks */}
            {(() => {
              const visibleBlocks = moduleBlocks.filter(b =>
                b.objective === 'grammaire' || b.objective === 'vocabulaire' || (objectives as string[]).includes(b.objective)
              )
              const gridCols = visibleBlocks.length === 2 ? 'grid-cols-2'
                : visibleBlocks.length === 3 ? 'grid-cols-3'
                : visibleBlocks.length === 4 ? 'grid-cols-2' : 'grid-cols-2'
              return (
                <div className={`grid ${gridCols} gap-3`}>
                  {visibleBlocks.map((block, idx) => {
                    const Icon = block.icon
                    const pct = progress?.objectiveProgress?.[block.objective as keyof typeof progress.objectiveProgress] || 0
                    const isLast = idx === visibleBlocks.length - 1 && visibleBlocks.length % 2 !== 0
                    return (
                      <a key={block.id} href={block.href}
                        className={`rounded-2xl p-3 shadow-sm transition-transform active:scale-95 ${isLast ? 'col-span-2 md:col-span-1' : ''}`}
                        style={{ backgroundColor: block.bgLight }}>
                        <div className="flex items-center gap-2 mb-2">
                          <div className="p-1.5 rounded-lg" style={{ backgroundColor: block.color }}>
                            <Icon className="h-4 w-4 text-white" />
                          </div>
                        </div>
                        <p className="font-bold text-xs mb-1.5" style={{ color: block.color }}>{block.label}</p>
                        <div>
                          <div className="flex justify-between mb-1">
                            <span className="text-[10px] font-bold" style={{ color: block.color }}>{pct}%</span>
                          </div>
                          <div className="h-1.5 w-full rounded-full bg-white/60">
                            <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: block.color }} />
                          </div>
                        </div>
                      </a>
                    )
                  })}
                </div>
              )
            })()}
            {/* BLOC 4 left — V3.10: Planning hebdo (À réviser supprimé, intégré dans Explorer BLOC 3) */}
            {(() => {
              const sched = user.settings.schedules?.[activeLang] || user.settings.schedule
              const today = new Date()
              const todayStr = today.toISOString().split('T')[0]
              const sessionDoneToday = progress?.lastActivityDate === todayStr
              const dayNames = lang === 'fr'
                ? ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']
                : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
              const dayIds = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
              const todayDayId = dayIds[today.getDay()]
              const isScheduledToday = sched?.days?.includes(todayDayId as DayOfWeek) || false
              return (
                <div className="rounded-2xl bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-[#002844]" />
                      <span className="font-bold text-sm text-[#002844]">{lang === 'fr' ? 'Mon planning' : 'My schedule'}</span>
                    </div>
                    <a href="/module/profil" className="text-[10px] font-semibold text-[#D9B438]">{lang === 'fr' ? 'Modifier' : 'Edit'}</a>
                  </div>
                  <div className="flex gap-1 mb-3">
                    {dayNames.map((name, i) => {
                      const isActive = sched?.days?.includes(dayIds[i] as DayOfWeek) || false
                      const isToday = i === today.getDay()
                      return (
                        <div key={i} className={`flex-1 rounded-lg py-1.5 text-center text-[10px] font-bold transition-all ${
                          isToday && isActive && sessionDoneToday ? 'bg-[#1A7A4A] text-white ring-2 ring-[#1A7A4A]/30' :
                          isToday && isActive ? 'bg-[#D9B438] text-[#002844] ring-2 ring-[#D9B438]/30' :
                          isToday ? 'bg-[#002844]/10 text-[#002844] ring-2 ring-[#002844]/20' :
                          isActive ? 'bg-[#002844] text-white' :
                          'bg-[#F0F0F0] text-[#999]'
                        }`}>
                          {isToday && isActive && sessionDoneToday ? '✓' : name}
                        </div>
                      )
                    })}
                  </div>
                  {isScheduledToday && sessionDoneToday ? (
                    <div className="flex items-center gap-2 p-2 rounded-lg bg-[#1A7A4A]/10">
                      <span className="text-xs font-semibold text-[#1A7A4A]">
                        {lang === 'fr' ? 'Session du jour terminée !' : "Today's session complete!"} ✓
                      </span>
                    </div>
                  ) : isScheduledToday ? (
                    <div className="flex items-center gap-2 p-2 rounded-lg bg-[#D9B438]/10">
                      <Clock className="h-3.5 w-3.5 text-[#D9B438]" />
                      <span className="text-xs font-semibold text-[#002844]">
                        {lang === 'fr' ? `Session prévue aujourd'hui · ${sched?.duration || 20} min` : `Session scheduled today · ${sched?.duration || 20} min`}
                      </span>
                    </div>
                  ) : (
                    <p className="text-xs text-[#555555]">{lang === 'fr' ? "Pas de session prévue aujourd'hui" : 'No session scheduled today'}</p>
                  )}
                </div>
              )
            })()}

          </div>

          {/* Right column (40%) — BUG-63 V3.9: Multi-profile leaderboard */}
          <div className="md:col-span-2">
            {(() => {
              // BUG-63: Read ALL users and compute weekly scores
              const allUsers = getAllUsers()
              const sevenDaysAgo = new Date()
              sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
              const sevenDaysStr = sevenDaysAgo.toISOString()

              const rankings = allUsers
                .map(u => {
                  // Check all language progress
                  let totalScore = 0
                  let isActive = false
                  for (const langKey of Object.keys(u.progress || {})) {
                    const p = u.progress[langKey]
                    if (p?.lastActivityDate && p.lastActivityDate >= sevenDaysStr) {
                      isActive = true
                      const stk = p.streak || 0
                      const dw = p.dailyWordsCompleted || 0
                      const de = p.dailyExercisesCompleted || 0
                      totalScore += (stk * 10) + (dw * 2) + (de * 3)
                    }
                  }
                  return { id: u.id, name: u.firstName || u.email?.split('@')[0] || '?', score: totalScore, isActive, isMe: u.id === user.id }
                })
                .filter(r => r.isActive && r.score > 0)
                .sort((a, b) => b.score - a.score)
                .slice(0, 5)

              return (
                <div className="rounded-2xl bg-white p-4 shadow-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <Trophy className="h-4 w-4 text-[#D9B438]" />
                    <span className="font-bold text-sm text-[#002844]">{lang === 'fr' ? 'Classement hebdo' : 'Weekly ranking'}</span>
                  </div>
                  {rankings.length > 0 ? (
                    <div className="space-y-2">
                      {rankings.map((r, idx) => (
                        <div key={r.id} className={`flex items-center gap-3 p-2 rounded-lg ${r.isMe ? 'bg-[#D9B438]/10' : ''}`}>
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                            idx === 0 ? 'bg-[#D9B438]/20' : idx === 1 ? 'bg-gray-200' : idx === 2 ? 'bg-orange-100' : 'bg-gray-100'
                          }`}>
                            <span className={`text-sm font-bold ${idx === 0 ? 'text-[#D9B438]' : 'text-[#555555]'}`}>{idx + 1}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-bold truncate ${r.isMe ? 'text-[#002844]' : 'text-[#555555]'}`}>{r.name}{r.isMe ? ' ⭐' : ''}</p>
                          </div>
                          <span className="text-xs font-bold text-[#002844]">{r.score} pts</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-[#555555]">
                      {lang === 'fr' ? 'Complète des exercices pour apparaître au classement !' : 'Complete exercises to appear in the ranking!'}
                    </p>
                  )}
                </div>
              )
            })()}
          </div>
        </div>
      </main>

      {/* V3.10: Use shared BottomNav component */}
      <BottomNav lang={lang} />
    </div>
  )
}
