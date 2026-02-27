'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getCurrentUser, logoutUser, setActiveLang } from '@/lib/db/localStorage'
import { User, InterfaceLanguage, LearningLanguage, LEARNING_LANGUAGES, LEARNING_OBJECTIVES, DAYS_OF_WEEK } from '@/types'
import { t } from '@/lib/i18n'
import {
  Flame, GraduationCap, Calendar, Trophy, LogOut, Menu, X,
  BarChart3, Shield, ChevronDown, Target, BookOpen, PenTool,
} from 'lucide-react'

export default function DashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [lang, setLang] = useState<InterfaceLanguage>('fr')
  const [loading, setLoading] = useState(true)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [langSelectorOpen, setLangSelectorOpen] = useState(false)

  useEffect(() => {
    const currentUser = getCurrentUser()
    if (!currentUser) { router.push('/auth'); return }
    // AD-01: Admin users should not be redirected to onboarding
    if (!currentUser.onboardingCompleted && currentUser.role !== 'admin') { router.push('/onboarding'); return }
    if (!currentUser.activeLang && currentUser.settings.learningLangs.length > 0) {
      currentUser.activeLang = currentUser.settings.learningLangs[0]
    }
    setUser(currentUser)
    setLang(currentUser.settings.interfaceLang || 'fr')
    setLoading(false)
  }, [router])

  const handleLogout = () => { logoutUser(); router.push('/auth') }

  const switchLanguage = (newLang: LearningLanguage) => {
    if (!user) return
    const updated = setActiveLang(user.id, newLang)
    if (updated) {
      setUser(updated)
      setLangSelectorOpen(false)
    }
  }

  if (loading || !user) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-[#002844]" />
      </div>
    )
  }

  const activeLang = user.activeLang || user.settings.learningLangs[0]
  const activeLangInfo = LEARNING_LANGUAGES.find(l => l.code === activeLang)
  const progress = user.progress?.[activeLang]
  const langConfig = user.settings.languageConfigs?.[activeLang]
  const hasGrc = langConfig?.hasGrcThemes || false
  const objectives = langConfig?.objectives || []

  // Schedule for active language
  const langSchedule = user.settings.schedules?.[activeLang] || user.settings.schedule

  // Nav items
  const navItems = [
    { label: lang === 'fr' ? 'Accueil' : 'Home', href: '/dashboard', active: true },
    { label: lang === 'fr' ? 'Vocabulaire' : 'Vocabulary', href: '/module/vocabulaire' },
    { label: lang === 'fr' ? 'Grammaire' : 'Grammar', href: '/module/grammaire' },
    { label: lang === 'fr' ? 'Lecture' : 'Reading', href: '/module/lecture' },
    { label: lang === 'fr' ? 'Dictionnaire' : 'Dictionary', href: '/module/dictionnaire' },
    { label: lang === 'fr' ? 'Entraînement' : 'Training', href: '/module/entrainement' },
    { label: lang === 'fr' ? 'Coach' : 'Coach', href: '/module/coach' },
    { label: lang === 'fr' ? 'Profil' : 'Profile', href: '/module/profil' },
  ]

  return (
    <div className="min-h-screen bg-[#F0F0F0]">
      {/* ===== NAVIGATION ===== */}
      <nav className="sticky top-0 z-50 bg-[#002844] shadow-lg">
        <div className="mx-auto max-w-7xl px-4">
          <div className="flex h-14 items-center justify-between">
            <div className="flex items-center gap-6">
              <h1 className="text-lg font-bold text-white">Lingua<span className="text-[#D9B438]">Learn</span></h1>
              <div className="hidden items-center gap-1 lg:flex">
                {navItems.map(item => (
                  <a key={item.label} href={item.href}
                    className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${item.active ? 'bg-white/10 text-[#D9B438]' : 'text-white/80 hover:bg-white/10 hover:text-white'}`}>
                    {item.label}
                  </a>
                ))}
              </div>
            </div>

            {/* RIGHT: Language selector + Logout */}
            <div className="hidden items-center gap-2 lg:flex">
              {/* CORRECTION #3: Sélecteur de langue dans la navbar */}
              <div className="relative">
                <button onClick={() => setLangSelectorOpen(!langSelectorOpen)}
                  className="flex items-center gap-2 rounded-lg bg-white/10 px-3 py-1.5 text-sm font-medium text-white hover:bg-white/20 transition-all">
                  <span className="text-lg">{activeLangInfo?.flag}</span>
                  <span>{lang === 'fr' ? activeLangInfo?.nameFr : activeLangInfo?.nameEn}</span>
                  {user.settings.learningLangs.length > 1 && (
                    <ChevronDown className={`h-4 w-4 transition-transform ${langSelectorOpen ? 'rotate-180' : ''}`} />
                  )}
                </button>
                {langSelectorOpen && user.settings.learningLangs.length > 1 && (
                  <div className="absolute right-0 top-full mt-1 z-50 rounded-xl bg-white shadow-lg border border-gray-200 overflow-hidden min-w-[180px]">
                    {user.settings.learningLangs.map(lc => {
                      const info = LEARNING_LANGUAGES.find(l => l.code === lc)
                      const isActive = lc === activeLang
                      return (
                        <button key={lc} onClick={() => switchLanguage(lc)}
                          className={`w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm transition-all ${isActive ? 'bg-[#002844]/5 font-bold' : 'hover:bg-gray-50'}`}>
                          <span className="text-lg">{info?.flag}</span>
                          <span className="text-[#002844]">{lang === 'fr' ? info?.nameFr : info?.nameEn}</span>
                          {isActive && <span className="ml-auto text-[#D9B438] font-semibold">✓</span>}
                        </button>
                      )
                    })}
                    <div className="border-t border-gray-200"></div>
                    <a href="/onboarding" onClick={() => setLangSelectorOpen(false)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-gray-50 transition-all text-[#D9B438] font-semibold">
                      <span>➕</span>
                      <span>{lang === 'fr' ? 'Ajouter une langue' : 'Add a language'}</span>
                    </a>
                  </div>
                )}
              </div>

              <button onClick={handleLogout} className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium text-white/80 hover:bg-white/10">
                <LogOut className="h-4 w-4" /> {t('auth.logout', lang)}
              </button>
            </div>

            {/* Mobile menu button */}
            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="text-white lg:hidden">
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>

          {/* Mobile menu */}
          {mobileMenuOpen && (
            <div className="border-t border-white/20 py-2 lg:hidden">
              {/* Mobile language selector */}
              <div className="flex items-center gap-2 px-3 py-2 mb-2">
                {user.settings.learningLangs.map(lc => {
                  const info = LEARNING_LANGUAGES.find(l => l.code === lc)
                  const isActive = lc === activeLang
                  return (
                    <button key={lc} onClick={() => switchLanguage(lc)}
                      className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium ${isActive ? 'bg-[#D9B438] text-[#002844]' : 'bg-white/10 text-white'}`}>
                      <span>{info?.flag}</span>
                      <span>{lang === 'fr' ? info?.nameFr : info?.nameEn}</span>
                    </button>
                  )
                })}
              </div>
              {navItems.map(item => (
                <a key={item.label} href={item.href}
                  className={`block rounded-lg px-3 py-2 text-sm font-medium ${item.active ? 'text-[#D9B438]' : 'text-white/80'}`}>
                  {item.label}
                </a>
              ))}
              <div className="mt-2 border-t border-white/20 pt-2">
                {user.role === 'admin' && (
                  <a href="/module/admin" className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-[#D9B438]">
                    <Shield className="h-4 w-4" /> Admin
                  </a>
                )}
                <button onClick={handleLogout} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-white/80">
                  <LogOut className="h-4 w-4" /> {t('auth.logout', lang)}
                </button>
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* ===== MAIN CONTENT ===== */}
      <main className="mx-auto max-w-7xl px-4 py-4 sm:py-6">
        {/* Diagnostic suggestion - AR-05bis */}
        {progress && !progress.diagnosticCompleted && (
          <div className="mb-6 rounded-2xl bg-gradient-to-r from-[#D9B438]/20 to-[#002844]/10 border-2 border-[#D9B438] p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <h3 className="text-lg font-bold text-[#002844] mb-2">
                  {lang === 'fr' ? 'Lancer votre diagnostic CECRL' : 'Take your CECRL diagnostic'}
                </h3>
                <p className="text-sm text-[#555555]">
                  {lang === 'fr'
                    ? 'Évaluez votre niveau de langue avec notre test CECRL pour obtenir des contenus adaptés.'
                    : 'Assess your language level with our CECRL test to get personalized content.'}
                </p>
              </div>
              <a
                href="/onboarding/diagnostic"
                className="ml-4 inline-flex items-center gap-2 rounded-lg px-6 py-3 font-semibold text-white hover:opacity-90 transition-opacity whitespace-nowrap flex-shrink-0"
                style={{ backgroundColor: '#002844' }}
              >
                <GraduationCap className="h-5 w-5" />
                {lang === 'fr' ? 'Démarrer' : 'Start'}
              </a>
            </div>
          </div>
        )}

        {/* LIGNE 1: Greeting + Streak compact */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-[#002844]">{t('dashboard.hello', lang)} {user.firstName} 👋</h2>
          <div className="flex items-center gap-2 rounded-xl bg-white px-4 py-2 shadow-sm">
            <Flame className="h-5 w-5 text-[#D9B438]" fill="#D9B438" />
            <span className="text-xl font-bold text-[#002844]">0</span>
            <span className="text-xs text-[#555555]">{t('dashboard.days', lang)}</span>
          </div>
        </div>

        {/* LIGNE 2: Niveaux compacts (CECRL + GRC conditionnel) */}
        <div className={`grid gap-3 mb-4 ${hasGrc ? 'grid-cols-2' : 'grid-cols-1'}`}>
          {/* CECRL */}
          <div className="flex items-center gap-3 rounded-xl bg-white p-3 shadow-sm">
            <GraduationCap className="h-8 w-8 text-[#002844]" />
            <div className="flex-1">
              <p className="text-xs text-[#555555]">{t('dashboard.levelCecrl', lang)}</p>
              {progress?.diagnosticCompleted ? (
                <span className="inline-block rounded-full bg-[#002844] px-3 py-0.5 text-sm font-bold text-white">
                  {progress.levelCecrl || 'A1'}
                </span>
              ) : (
                <span className="text-sm text-[#555555]">{t('dashboard.notEvaluated', lang)}</span>
              )}
            </div>
          </div>

          {/* GRC (conditionnel) */}
          {hasGrc && (
            <div className="flex items-center gap-3 rounded-xl bg-white p-3 shadow-sm">
              <Trophy className="h-8 w-8 text-[#D9B438]" />
              <div className="flex-1">
                <p className="text-xs text-[#555555]">{t('dashboard.levelGrc', lang)}</p>
                <span className="inline-block rounded-full bg-[#D9B438] px-3 py-0.5 text-sm font-bold text-[#002844]">
                  {progress?.levelGrc || 'Junior'}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* ===== 2 BLOCS PRINCIPAUX ===== */}
        <div className="grid gap-4 lg:grid-cols-2 mb-4">

          {/* BLOC 1: Révision & Évaluation */}
          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <Calendar className="h-5 w-5 text-[#002844]" />
              <p className="font-semibold text-[#002844]">{t('dashboard.blockRevision', lang)}</p>
            </div>

            {/* Mini calendrier compact */}
            <div className="flex gap-1.5 mb-3">
              {DAYS_OF_WEEK.map(day => {
                const isActive = langSchedule?.days?.includes(day.id)
                return (
                  <div key={day.id}
                    className={`flex-1 rounded-lg py-1.5 text-center text-xs font-semibold ${isActive ? 'bg-[#002844] text-white' : 'bg-gray-100 text-[#555555]'}`}>
                    {lang === 'fr' ? day.shortFr : day.shortEn}
                  </div>
                )
              })}
            </div>
            <p className="text-xs text-[#555555] mb-3">
              {langSchedule?.duration || 20} min / {t('dashboard.perDay', lang)}
            </p>

            {/* Prochaines évaluations */}
            <div className="space-y-2 mb-3">
              <div className="flex items-center gap-2 p-2 rounded-lg bg-blue-50">
                <GraduationCap className="h-4 w-4 text-[#002844] flex-shrink-0" />
                <span className="text-xs text-[#002844] font-medium">{t('dashboard.nextCecrl', lang)}</span>
                <span className="ml-auto text-xs text-[#555555]">{t('dashboard.in1month', lang)}</span>
              </div>
              {hasGrc && (
                <div className="flex items-center gap-2 p-2 rounded-lg bg-[#D9B438]/10">
                  <Shield className="h-4 w-4 text-[#D9B438] flex-shrink-0" />
                  <span className="text-xs text-[#002844] font-medium">{t('dashboard.nextGrc', lang)}</span>
                  <span className="ml-auto text-xs text-[#555555]">{t('dashboard.in1month', lang)}</span>
                </div>
              )}
            </div>

            {/* Défis reçus */}
            <div className="border-t border-gray-100 pt-3">
              <div className="flex items-center gap-2 mb-2">
                <Target className="h-4 w-4 text-[#D9B438]" />
                <span className="text-sm font-semibold text-[#002844]">{t('dashboard.challenges', lang)}</span>
              </div>
              {/* Pas de défis pour l'instant - placeholder */}
              <div className="rounded-lg bg-gray-50 p-3 text-center">
                <p className="text-sm font-medium text-[#002844]">
                  {t('dashboard.noChallenges', lang)} — {t('dashboard.challengeFriend', lang)} 🏆
                </p>
                <p className="text-xs text-[#555555] mt-1">{t('dashboard.challengeExplain', lang)}</p>
                <button disabled className="mt-2 rounded-lg bg-[#D9B438]/50 px-4 py-1.5 text-xs font-semibold text-[#002844]/50 cursor-not-allowed">
                  {t('dashboard.launchChallenge', lang)} ({lang === 'fr' ? 'bientôt' : 'soon'})
                </button>
              </div>
            </div>

            {/* Bouton révision */}
            <a href="/module/revision"
              className="mt-3 block w-full rounded-xl bg-[#002844] px-4 py-2.5 text-center text-sm font-semibold text-white hover:opacity-90">
              {t('dashboard.startReview', lang)}
            </a>
          </div>

          {/* BLOC 2: Progression & Révisions à faire */}
          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 className="h-5 w-5 text-[#002844]" />
              <p className="font-semibold text-[#002844]">{t('dashboard.blockProgress', lang)}</p>
            </div>

            {/* Progression par objectif - compact */}
            {objectives.length > 0 && (
              <div className="space-y-2 mb-4">
                {objectives.map(obj => {
                  const objInfo = LEARNING_OBJECTIVES.find(o => o.id === obj)
                  const pct = progress?.objectiveProgress?.[obj] || 0
                  return (
                    <div key={obj}>
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-xs font-medium text-[#002844]">{objInfo?.icon} {lang === 'fr' ? objInfo?.nameFr : objInfo?.nameEn}</span>
                        <span className="text-xs text-[#555555]">{pct}%</span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
                        <div className="h-full rounded-full bg-[#D9B438] transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Révisions à faire */}
            <div className="border-t border-gray-100 pt-3">
              <div className="flex items-center gap-2 mb-2">
                <BookOpen className="h-4 w-4 text-[#002844]" />
                <span className="text-sm font-semibold text-[#002844]">{t('dashboard.wordsToReview', lang)}</span>
              </div>
              <div className="rounded-lg bg-gray-50 p-3 mb-2">
                <p className="text-xs text-[#555555]">{t('dashboard.noReviewYet', lang)}</p>
              </div>

              <div className="flex items-center gap-2 mb-2">
                <PenTool className="h-4 w-4 text-[#002844]" />
                <span className="text-sm font-semibold text-[#002844]">{t('dashboard.rulesToReview', lang)}</span>
              </div>
              <div className="rounded-lg bg-gray-50 p-3">
                <p className="text-xs text-[#555555]">{t('dashboard.noReviewYet', lang)}</p>
              </div>

              <p className="text-xs text-center text-[#555555] mt-2 italic">
                {t('dashboard.startLearning', lang)}
              </p>
            </div>
          </div>
        </div>

        {/* CLASSEMENT HEBDO - en bas, compact */}
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-[#555555]" />
              <p className="font-semibold text-[#002844]">{t('dashboard.ranking', lang)}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold text-[#002844]">#--</span>
              <span className="text-xs text-[#555555]">{lang === 'fr' ? 'Pas encore de données' : 'No data yet'}</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
