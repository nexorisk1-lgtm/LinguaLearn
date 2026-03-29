'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getCurrentUser, setActiveLang, logoutUser, getDueReviews } from '@/lib/db/localStorage'
import { User, InterfaceLanguage, LearningLanguage, LEARNING_LANGUAGES } from '@/types'
import { t } from '@/lib/i18n'
import { initNotifications, scheduleReminder } from '@/lib/notifications'
import {
  Flame, ChevronDown, LogOut,
  BookOpen, PenTool, Languages, Mic, Pencil, Map, X,
} from 'lucide-react'
import BottomNav from '@/components/BottomNav'
import { useEngine } from '@/lib/engine/useEngine'
import { getRevisionSummary } from '@/lib/engine/revisionEngine'
import { BANK_A1_COURSES, getA1CourseData } from '@/lib/db/bankA1Courses'
import { calculateStreak, getDailyObjective, getMilestoneMessage } from '@/lib/engine/engagementEngine'

export default function DashboardPage() {
  const router = useRouter()
  const engine = useEngine()
  const [user, setUser] = useState<User | null>(null)
  const [lang, setLang] = useState<InterfaceLanguage>('fr')
  const [loading, setLoading] = useState(true)
  const [isPending, setIsPending] = useState(false)
  const [langSelectorOpen, setLangSelectorOpen] = useState(false)
  const [milestoneShown, setMilestoneShown] = useState<number | null>(null)

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
    if (currentUser.activeLang && !currentUser.settings.learningLangs.includes(currentUser.activeLang)) {
      currentUser.activeLang = currentUser.settings.learningLangs[0] || undefined
    }
    if (!currentUser.activeLang && currentUser.settings.learningLangs.length > 0) {
      currentUser.activeLang = currentUser.settings.learningLangs[0]
    }
    setUser(currentUser)
    setLang(currentUser.settings.interfaceLang || 'fr')
    setLoading(false)
    initNotifications().catch(err => console.error('Notifications init failed:', err))
    if (currentUser.activeLang) {
      const cfg = currentUser.settings.schedules?.[currentUser.activeLang] || currentUser.settings.schedule
      if (cfg?.days) scheduleReminder(cfg.days, currentUser.activeLang)
    }
  }

  useEffect(() => {
    loadUser()
    const handleReload = () => loadUser()
    const handleVisibility = () => { if (document.visibilityState === 'visible') loadUser() }
    window.addEventListener('focus', handleReload)
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      window.removeEventListener('focus', handleReload)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router])

  const switchLanguage = (newLang: LearningLanguage) => {
    if (!user) return
    const updated = setActiveLang(user.id, newLang)
    if (updated) { setUser(updated); setLangSelectorOpen(false) }
  }

  // Milestone popup effect — must be before early returns per React rules of hooks
  const activeLangPre = user?.activeLang || user?.settings?.learningLangs?.[0] || 'en'
  const streakDataPre = user ? calculateStreak(user.id, activeLangPre) : null
  const milestonePre = streakDataPre?.milestone ?? null

  useEffect(() => {
    if (milestonePre && !milestoneShown) {
      setMilestoneShown(milestonePre)
      const timer = setTimeout(() => {
        setMilestoneShown(null)
      }, 5000)
      return () => clearTimeout(timer)
    }
  }, [milestonePre, milestoneShown])

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
            <Flame className="h-8 w-8 text-[#D9B438]" />
          </div>
          <h2 className="text-xl font-bold text-[#002844] mb-2">
            {lang === 'fr' ? 'Compte en attente' : 'Account pending'}
          </h2>
          <p className="text-sm text-[#555] mb-6">
            {lang === 'fr' ? 'Un admin doit valider votre accès.' : 'An admin must approve your access.'}
          </p>
          <button onClick={() => { logoutUser(); router.push('/auth') }}
            className="px-6 py-2 rounded-xl bg-[#002844] text-white text-sm font-bold">
            {lang === 'fr' ? 'Retour' : 'Back'}
          </button>
        </div>
      </div>
    )
  }

  const activeLang = user.activeLang || user.settings.learningLangs[0]
  const activeLangInfo = LEARNING_LANGUAGES.find(l => l.code === activeLang)
  const progress = user.progress?.[activeLang]
  const displayName = user.firstName && !user.firstName.includes('@')
    ? user.firstName
    : user.firstName?.split('@')[0] || (lang === 'fr' ? 'apprenant' : 'learner')

  // --- Compute next course info ---
  const courseInfo = (() => {
    try {
      const key = `lingualearn_course_scores_${user.id}_${activeLang}`
      const stored = localStorage.getItem(key)
      const scores: Record<string, { score: number }> = stored ? JSON.parse(stored) : {}
      const totalCourses = BANK_A1_COURSES.length
      const completedCount = BANK_A1_COURSES.filter(c => scores[c.id] && scores[c.id].score >= 60).length
      const nextCourse = BANK_A1_COURSES.find(c => !scores[c.id] || scores[c.id].score < 60)
      const courseData = nextCourse ? getA1CourseData(nextCourse.id) : null
      const vocabCount = courseData?.vocabulary?.length || 7
      const hasRule = !!courseData?.rule?.en
      const estimatedMin = Math.round((vocabCount * 0.5) + (hasRule ? 1 : 0) + 1)
      const pctA1 = totalCourses > 0 ? Math.round((completedCount / totalCourses) * 100) : 0
      // Check if session in progress (resume)
      const resumeKey = nextCourse ? `lingualearn_resume_${user.id}_${nextCourse.id}` : null
      let hasResume = false
      if (resumeKey) {
        try {
          const resumeStr = localStorage.getItem(resumeKey)
          if (resumeStr) {
            const r = JSON.parse(resumeStr)
            hasResume = Date.now() - new Date(r.savedAt).getTime() < 24 * 60 * 60 * 1000
          }
        } catch { /* ignore */ }
      }
      return {
        courseId: nextCourse?.id || 'a1_c1',
        title: courseData?.title || (nextCourse?.id || 'Course 1'),
        vocabCount,
        hasRule,
        estimatedMin,
        pctA1,
        completedCount,
        totalCourses,
        remaining: totalCourses - completedCount,
        hasResume,
        isFirstTime: completedCount === 0 && !hasResume,
        sessionUrl: `/session?courseId=${nextCourse?.id || 'a1_c1'}`,
      }
    } catch {
      return {
        courseId: 'a1_c1', title: 'Greetings', vocabCount: 7, hasRule: true,
        estimatedMin: 4, pctA1: 0, completedCount: 0, totalCourses: 40,
        remaining: 40, hasResume: false, isFirstTime: true,
        sessionUrl: '/session?courseId=a1_c1',
      }
    }
  })()

  // --- Revision info ---
  const revisionInfo = (() => {
    if (!engine.progress) {
      const dueReviews = getDueReviews(user.id, activeLang)
      return { dueCount: dueReviews.length, lateCount: 0, estimatedMin: Math.max(2, Math.round(dueReviews.length * 0.5)) }
    }
    const summary = getRevisionSummary(engine.progress)
    return {
      dueCount: summary.dueToday,
      lateCount: summary.weakestItems.length,
      estimatedMin: Math.max(2, Math.round(summary.dueToday * 0.5)),
    }
  })()

  // --- Streak with engagement engine ---
  const streakData = calculateStreak(user.id, activeLang)
  const streak = streakData.streak

  // --- Daily objective with engagement engine ---
  const dailyObjective = getDailyObjective(user.id, activeLang)
  const dailyPct = Math.min(
    100,
    Math.round(
      ((dailyObjective.minutesDone / dailyObjective.targetMinutes) * 100)
    )
  )
  const objectiveReached = dailyObjective.completed

  // --- Engine recommended step (SYNC rule: this determines CTA) ---
  const engineStep = engine.progress ? engine.getNextStep() : null
  const isRevisionPriority = engineStep?.type === 'revision' && revisionInfo.dueCount > 0

  // --- CTA text ---
  const ctaText = (() => {
    if (isRevisionPriority) return lang === 'fr' ? '🧠 Réviser maintenant' : '🧠 Review now'
    if (courseInfo.hasResume) return lang === 'fr' ? '🚀 Reprendre ma leçon' : '🚀 Resume my lesson'
    if (courseInfo.isFirstTime) return lang === 'fr' ? `🎯 Commencer ma leçon (${courseInfo.estimatedMin} min)` : `🎯 Start my lesson (${courseInfo.estimatedMin} min)`
    return lang === 'fr' ? `🎯 Continuer ma leçon (${courseInfo.estimatedMin} min)` : `🎯 Continue my lesson (${courseInfo.estimatedMin} min)`
  })()

  // --- CTA href (SYNC rule: matches parcours node) ---
  const ctaHref = isRevisionPriority ? '/module/revisions' : courseInfo.sessionUrl

  // --- Module blocks for progression section ---
  const moduleBlocks = [
    { id: 'vocabulaire', label: lang === 'fr' ? 'Vocabulaire' : 'Vocabulary', icon: BookOpen, color: '#1976D2' },
    { id: 'grammaire', label: lang === 'fr' ? 'Grammaire' : 'Grammar', icon: PenTool, color: '#F9A825' },
    { id: 'lecture', label: lang === 'fr' ? 'Lecture' : 'Reading', icon: Languages, color: '#2E7D32' },
    { id: 'oral', label: lang === 'fr' ? 'Oral' : 'Speaking', icon: Mic, color: '#7B1FA2' },
    { id: 'ecrit', label: lang === 'fr' ? 'Écrit' : 'Writing', icon: Pencil, color: '#E65100' },
  ]

  const engineModules = engine.progress ? engine.getModules() : null
  const allowedIds = engineModules ? engineModules.modules.map(m => m.id) : moduleBlocks.map(b => b.id)
  const visibleModules = moduleBlocks.filter(b => allowedIds.includes(b.id))

  // P1-7: Coach home wording — personalized with first name + course context
  const firstName = user?.firstName || 'apprenant'
  const coachMessage = (() => {
    if (courseInfo.hasResume) return lang === 'fr'
      ? `Salut ${firstName} ! On reprend ${courseInfo.title} — je t'attends 👋`
      : `Hi ${firstName}! Let's resume ${courseInfo.title} — I'm waiting 👋`
    if (revisionInfo.dueCount > 0) return lang === 'fr'
      ? `Salut ${firstName} ! On révise ${courseInfo.title} — ${revisionInfo.dueCount} mots à revoir 👋`
      : `Hi ${firstName}! Let's review ${courseInfo.title} — ${revisionInfo.dueCount} words to go 👋`
    return lang === 'fr'
      ? `Salut ${firstName} ! On travaille ${courseInfo.title} — je t'attends 👋`
      : `Hi ${firstName}! Let's work on ${courseInfo.title} — I'm waiting 👋`
  })()

  // --- Planning ---
  const sched = user.settings.schedules?.[activeLang] || user.settings.schedule
  const duration = sched?.duration || 10

  return (
    <div className="min-h-screen bg-[#F0F0F0] pb-20">
      {/* TOP BAR */}
      <div className="sticky top-0 z-50 bg-[#002844] px-4 py-3 flex items-center justify-between">
        <h1 className="text-lg font-bold text-white">Lingua<span className="text-[#D9B438]">Learn</span></h1>
        <div className="flex items-center gap-2">
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
          <button onClick={() => { logoutUser(); router.push('/auth') }}
            className="p-2 hover:bg-white/10 rounded-lg" title={lang === 'fr' ? 'Déconnexion' : 'Logout'}>
            <LogOut className="h-4 w-4 text-white/70" />
          </button>
        </div>
      </div>

      <main className="px-4 pt-4 max-w-lg lg:max-w-2xl mx-auto">
        {/* ---- 1. HEADER: Hello + Streak + % A1 ---- */}
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-xl font-bold text-[#002844]">{t('dashboard.hello', lang)} {displayName} 👋</h2>
          <div className="flex items-center gap-1.5 rounded-xl bg-white px-3 py-2 shadow-sm">
            <Flame className="h-5 w-5 text-[#D9B438]" fill="#D9B438" />
            <span className="text-lg font-bold text-[#002844]">{streak}</span>
          </div>
        </div>
        <p className="text-sm font-semibold text-[#002844] mb-4">
          {lang === 'fr' ? `Tu es à ${courseInfo.pctA1}% du niveau A1` : `You're ${courseInfo.pctA1}% through A1`}
          <span className="text-[10px] bg-[#E8F4F8] text-[#002844] font-bold px-2 py-0.5 rounded-full ml-2">
            {lang === 'fr' ? 'Débutant' : 'Beginner'}
          </span>
        </p>

        {/* ---- 2. CTA PRINCIPAL (dominant) ---- */}
        <a href={ctaHref}
          className="block mb-4 rounded-2xl bg-gradient-to-br from-[#002844] to-[#004466] p-5 shadow-lg active:scale-[0.98] transition-transform">
          {!isRevisionPriority ? (
            <>
              <p className="text-xs font-semibold text-[#D9B438] mb-1">
                {lang === 'fr' ? 'Cours suivant' : 'Next course'} : {courseInfo.title}
              </p>
              <p className="text-[11px] text-white/70 mb-3">
                📚 {courseInfo.vocabCount} {lang === 'fr' ? 'mots' : 'words'}
                {courseInfo.hasRule && ` · 1 ${lang === 'fr' ? 'règle' : 'rule'}`}
                {` · ⏱ ${courseInfo.estimatedMin} min`}
              </p>
              <div className="h-2 w-full rounded-full bg-white/10 mb-3">
                <div className="h-full rounded-full bg-[#D9B438] transition-all" style={{ width: `${courseInfo.pctA1}%` }} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-white/50">{courseInfo.pctA1}% {lang === 'fr' ? 'complété' : 'completed'}</span>
                <span className="bg-[#D9B438] text-[#002844] px-5 py-2.5 rounded-xl text-sm font-bold">
                  {ctaText}
                </span>
              </div>
            </>
          ) : (
            <>
              <p className="text-xs font-semibold text-amber-300 mb-2">
                ⚠️ {revisionInfo.dueCount} {lang === 'fr' ? 'mots vont être oubliés' : 'words at risk'}
                {revisionInfo.lateCount > 0 && ` · ${revisionInfo.lateCount} ${lang === 'fr' ? 'en retard' : 'overdue'}`}
              </p>
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-white/70">⏱ {revisionInfo.estimatedMin} min</span>
                <span className="bg-amber-400 text-[#002844] px-5 py-2.5 rounded-xl text-sm font-bold">
                  {ctaText}
                </span>
              </div>
            </>
          )}
        </a>

        {/* ---- 3. COACH IA (personnage contextuel) ---- */}
        <a href="/module/coach" className="block mb-4 rounded-xl bg-white p-4 shadow-sm active:scale-[0.99] transition-transform">
          <div className="flex gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#7B1FA2] to-[#9C27B0] flex items-center justify-center flex-shrink-0">
              <span className="text-lg">🤖</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-[#002844] leading-snug">&ldquo;{coachMessage}&rdquo;</p>
              <p className="text-[10px] font-bold text-[#7B1FA2] mt-1.5">
                {lang === 'fr' ? 'Répondre au coach →' : 'Reply to coach →'}
              </p>
            </div>
          </div>
        </a>

        {/* ---- 4. RÉVISIONS (tension douce — visible si dues, masqué sinon) ---- */}
        {!isRevisionPriority && revisionInfo.dueCount > 0 && (
          <a href="/module/revisions" className="block mb-4 rounded-xl bg-amber-50 border border-amber-200 p-4 active:scale-[0.99] transition-transform">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-amber-800">
                  ⚠️ {revisionInfo.dueCount} {lang === 'fr' ? 'mots vont être oubliés' : 'words at risk'}
                  {revisionInfo.lateCount > 0 && (
                    <span className="text-amber-600"> · {revisionInfo.lateCount} {lang === 'fr' ? 'en retard' : 'overdue'}</span>
                  )}
                </p>
              </div>
              <span className="bg-amber-400 text-amber-900 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap">
                {lang === 'fr' ? `Réviser — ${revisionInfo.estimatedMin} min` : `Review — ${revisionInfo.estimatedMin} min`}
              </span>
            </div>
          </a>
        )}

        {/* ---- 5. ENTRAÎNEMENT ---- */}
        <a href="/module/entrainement" className="block mb-4 rounded-xl bg-gray-50 border border-gray-200 p-4 active:scale-[0.99] transition-transform">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <span className="text-xl">🎮</span>
              <p className="text-sm font-bold text-[#002844]">{lang === 'fr' ? 'Réviser ce que tu sais' : 'Review what you know'}</p>
            </div>
            <span className="bg-[#E65100] text-white px-3 py-1.5 rounded-lg text-xs font-bold">
              {lang === 'fr' ? 'Lancer — 5 min' : 'Start — 5 min'}
            </span>
          </div>
          <p className="text-[10px] text-[#555]">
            💡 {lang === 'fr' ? 'Astuce : le mode Battle précision est recommandé pour ton niveau' : '💡 Tip: Precision Battle mode is recommended for your level'}
          </p>
        </a>

        {/* ---- 5B. VOIR MON PARCOURS ---- */}
        <a href="/module/parcours" className="block mb-4 text-center">
          <span className="text-sm font-semibold text-[#002844] underline underline-offset-2">
            {lang === 'fr' ? 'Voir mon parcours →' : 'View my path →'}
          </span>
        </a>

        {/* ---- 6. PROGRESSION (compact) ---- */}
        <div className="rounded-xl bg-white p-4 shadow-sm mb-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-bold text-[#002844]">{lang === 'fr' ? 'Progression' : 'Progress'}</p>
            <a href="/module/parcours" className="flex items-center gap-1 text-[10px] font-bold text-[#D9B438]">
              <Map className="h-3 w-3" />
              {lang === 'fr' ? 'Voir le parcours' : 'View path'}
            </a>
          </div>
          <div className="space-y-2">
            {visibleModules.map(block => {
              const Icon = block.icon
              const engineMod = engineModules?.modules.find(m => m.id === block.id)
              // P0-1: For vocabulary, read from direct localStorage key as fallback
              let pct = engineMod?.percent
                ?? (progress?.objectiveProgress?.[block.id as keyof typeof progress.objectiveProgress] || 0)
              if (block.id === 'vocabulaire') {
                try {
                  const directPct = localStorage.getItem(`lingualearn_vocab_pct_${user.id}_${activeLang}`)
                  if (directPct && parseInt(directPct, 10) > pct) pct = parseInt(directPct, 10)
                  // Also check engine progress
                  const engineVocPct = engine.progress?.vocabularyPercent || 0
                  if (engineVocPct > pct) pct = engineVocPct
                } catch { /* ignore */ }
              }
              return (
                <div key={block.id} className="flex items-center gap-2">
                  <Icon className="h-3.5 w-3.5 flex-shrink-0" style={{ color: block.color }} />
                  <span className="text-[10px] font-bold w-16 truncate" style={{ color: block.color }}>{block.label}</span>
                  <div className="flex-1 h-1.5 rounded-full bg-gray-100">
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: block.color }} />
                  </div>
                  <span className="text-[10px] font-bold w-7 text-right" style={{ color: block.color }}>{pct}%</span>
                </div>
              )
            })}
          </div>
          {/* Global A1 bar */}
          <div className="mt-3 pt-3 border-t border-gray-100">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-bold text-[#002844]">{lang === 'fr' ? 'Niveau A1 global' : 'Overall A1'}</span>
              <span className="text-xs font-bold text-[#002844]">{courseInfo.pctA1}%</span>
            </div>
            <div className="h-2 w-full rounded-full bg-gray-100">
              <div className="h-full rounded-full bg-gradient-to-r from-[#002844] to-[#D9B438] transition-all" style={{ width: `${courseInfo.pctA1}%` }} />
            </div>
          </div>
        </div>

        {/* ---- 7. PLANNING (compact) ---- */}
        <div className="rounded-xl bg-white p-4 shadow-sm mb-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-bold text-[#002844]">{lang === 'fr' ? 'Planning' : 'Schedule'}</p>
            <a href="/module/profil" className="text-[10px] font-bold text-[#D9B438]">
              {lang === 'fr' ? 'Modifier' : 'Edit'}
            </a>
          </div>
          {/* Days row */}
          <div className="flex gap-1.5 mb-2">
            {(['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim'] as const).map((d, i) => {
              const dayMap: Record<string, string> = { lun: 'mon', mar: 'tue', mer: 'wed', jeu: 'thu', ven: 'fri', sam: 'sat', dim: 'sun' }
              const days = sched?.days || []
              const isPlanned = days.length === 0 || days.includes(dayMap[d] as typeof days[number])
              const isToday = new Date().getDay() === (i === 6 ? 0 : i + 1)
              return (
                <div key={d} className={`flex-1 text-center py-1.5 rounded-lg text-[10px] font-bold ${
                  isToday ? 'bg-[#002844] text-white' : isPlanned ? 'bg-[#D9B438]/20 text-[#002844]' : 'bg-gray-100 text-gray-400'
                }`}>
                  {lang === 'fr' ? d.charAt(0).toUpperCase() : ['M','T','W','T','F','S','S'][i]}
                </div>
              )
            })}
          </div>
          <p className="text-[10px] text-[#555]">⏱ {duration} min/{lang === 'fr' ? 'jour' : 'day'}</p>
        </div>

        {/* ---- OBJECTIF QUOTIDIEN ---- */}
        <div className="rounded-xl bg-white p-4 shadow-sm mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-[#002844]">
              🎯 {lang === 'fr' ? 'Aujourd\'hui' : 'Today'}
            </span>
            <span className={`text-xs font-bold ${objectiveReached ? 'text-green-600' : 'text-[#D9B438]'}`}>
              {objectiveReached
                ? (lang === 'fr' ? '✔️ Objectif atteint → +30 pts' : '✔️ Goal reached → +30 pts')
                : `${dailyObjective.minutesDone}/${dailyObjective.targetMinutes} min`}
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-gray-100">
            <div className="h-full rounded-full bg-gradient-to-r from-[#D9B438] to-[#f0c84a] transition-all" style={{ width: `${dailyPct}%` }} />
          </div>
          {!objectiveReached && (
            <p className="text-[10px] text-[#555] mt-1.5">
              {lang === 'fr'
                ? `1 cours · 1 révision · 5 min`
                : `1 course · 1 review · 5 min`}
            </p>
          )}
        </div>
      </main>

      {/* ---- MILESTONE CELEBRATION POPUP ---- */}
      {milestoneShown && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl p-8 shadow-2xl max-w-sm mx-4 text-center animate-bounce">
            <button
              onClick={() => setMilestoneShown(null)}
              className="absolute top-4 right-4 p-2 hover:bg-gray-100 rounded-lg"
            >
              <X className="h-5 w-5 text-[#555]" />
            </button>
            <div className="text-5xl mb-4">
              {milestoneShown === 3 && '🔥'}
              {milestoneShown === 7 && '⭐'}
              {milestoneShown === 30 && '👑'}
            </div>
            <h3 className="text-xl font-bold text-[#002844] mb-2">
              {getMilestoneMessage(milestoneShown, lang as 'fr' | 'en')}
            </h3>
            <p className="text-sm text-[#555] mb-4">
              {lang === 'fr'
                ? 'Ton engagement crée les meilleures habitudes d\'apprentissage !'
                : 'Your commitment creates the best learning habits!'}
            </p>
            <div className="flex items-center justify-center gap-1 mb-4">
              <Flame className="h-5 w-5 text-[#D9B438]" fill="#D9B438" />
              <span className="text-lg font-bold text-[#002844]">{streak}</span>
              <span className="text-sm text-[#555]">
                {lang === 'fr' ? 'jour(s)' : 'day(s)'}
              </span>
            </div>
            <button
              onClick={() => setMilestoneShown(null)}
              className="w-full py-2.5 rounded-xl bg-[#002844] text-white font-bold text-sm"
            >
              {lang === 'fr' ? 'Continuer' : 'Continue'}
            </button>
          </div>
        </div>
      )}

      <BottomNav lang={lang} />
    </div>
  )
}
