'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getCurrentUser, logoutUser, setActiveLang } from '@/lib/db/localStorage'
import { User, InterfaceLanguage, LearningLanguage, LEARNING_LANGUAGES, LEARNING_OBJECTIVES, DAYS_OF_WEEK } from '@/types'
import { t } from '@/lib/i18n'
import {
  Flame, GraduationCap, Calendar, Trophy, LogOut, Menu, X,
  BarChart3, Shield, Globe, ChevronDown, Target,
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
    if (!currentUser.onboardingCompleted) { router.push('/onboarding'); return }
    // Set activeLang if not set
    if (!currentUser.activeLang && currentUser.settings.learningLangs.length > 0) {
      currentUser.activeLang = currentUser.settings.learningLangs[0]
    }
    setUser(currentUser)
    setLang(currentUser.settings.interfaceLang || 'fr')
    setLoading(false)
  }, [router])

  const handleLogout = () => { logoutUser(); router.push('/auth') }

  // CORRECTION #4: Switch active language
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

  // Nav items - CORRECTION #9: link to /module/[name]
  const navItems = [
    { label: lang === 'fr' ? 'Accueil' : 'Home', href: '/dashboard', active: true },
    { label: lang === 'fr' ? 'Vocabulaire' : 'Vocabulary', href: '/module/vocabulaire' },
    { label: lang === 'fr' ? 'Grammaire' : 'Grammar', href: '/module/grammaire' },
    { label: lang === 'fr' ? 'Lecture' : 'Reading', href: '/module/lecture' },
    { label: lang === 'fr' ? 'Entraînement' : 'Training', href: '/module/entrainement' },
    { label: lang === 'fr' ? 'Coach IA' : 'AI Coach', href: '/module/coach' },
    { label: lang === 'fr' ? 'Profil' : 'Profile', href: '/module/profil' },
  ]

  return (
    <div className="min-h-screen bg-[#F0F0F0]">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-[#002844] shadow-lg">
        <div className="mx-auto max-w-7xl px-4">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-8">
              <h1 className="text-xl font-bold text-white">Lingua<span className="text-[#D9B438]">Learn</span></h1>
              <div className="hidden items-center gap-1 lg:flex">
                {navItems.map(item => (
                  <a key={item.label} href={item.href}
                    className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${item.active ? 'bg-white/10 text-[#D9B438]' : 'text-white/80 hover:bg-white/10 hover:text-white'}`}>
                    {item.label}
                  </a>
                ))}
              </div>
            </div>
            <div className="hidden items-center gap-3 lg:flex">
              {user.role === 'admin' && (
                <a href="/module/admin" className="flex items-center gap-1 rounded-lg bg-white/10 px-3 py-2 text-sm font-medium text-[#D9B438]">
                  <Shield className="h-4 w-4" /> Admin
                </a>
              )}
              <button onClick={handleLogout} className="flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-white/80 hover:bg-white/10">
                <LogOut className="h-4 w-4" /> {t('auth.logout', lang)}
              </button>
            </div>
            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="text-white lg:hidden">
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
          {mobileMenuOpen && (
            <div className="border-t border-white/20 py-3 lg:hidden">
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

      {/* Main content - CORRECTION #8: Optimized layout */}
      <main className="mx-auto max-w-7xl px-4 py-6 sm:py-8">
        {/* LIGNE 1: Greeting */}
        <div className="mb-6">
          <h2 className="text-3xl font-bold text-[#002844]">{t('dashboard.hello', lang)} {user.firstName} 👋</h2>
        </div>

        {/* LIGNE 2: 3 cards - Streak | Langue active + sélecteur (#4) | CECRL */}
        <div className="grid gap-4 sm:gap-6 md:grid-cols-3 mb-4 sm:mb-6">
          {/* Streak */}
          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#555555]">{t('dashboard.streak', lang)}</p>
                <p className="mt-1 text-4xl font-bold text-[#002844]">0</p>
                <p className="text-sm text-[#555555]">{t('dashboard.days', lang)}</p>
              </div>
              <Flame className="h-12 w-12 text-[#D9B438]" fill="#D9B438" />
            </div>
          </div>

          {/* Langue active + Sélecteur (#4) */}
          <div className="rounded-2xl bg-white p-5 shadow-sm relative">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-[#555555]">{t('dashboard.activeLang', lang)}</p>
              <Globe className="h-5 w-5 text-[#555555]" />
            </div>
            <button onClick={() => setLangSelectorOpen(!langSelectorOpen)}
              className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-gray-50 transition-all">
              <div className="flex items-center gap-3">
                <span className="text-3xl">{activeLangInfo?.flag}</span>
                <span className="text-xl font-bold text-[#002844]">
                  {lang === 'fr' ? activeLangInfo?.nameFr : activeLangInfo?.nameEn}
                </span>
              </div>
              {user.settings.learningLangs.length > 1 && (
                <ChevronDown className={`h-5 w-5 text-[#555555] transition-transform ${langSelectorOpen ? 'rotate-180' : ''}`} />
              )}
            </button>

            {/* Language dropdown */}
            {langSelectorOpen && user.settings.learningLangs.length > 1 && (
              <div className="absolute left-0 right-0 top-full mt-1 z-40 rounded-xl bg-white shadow-lg border border-gray-200 overflow-hidden">
                {user.settings.learningLangs.map(lc => {
                  const info = LEARNING_LANGUAGES.find(l => l.code === lc)
                  const isActive = lc === activeLang
                  return (
                    <button key={lc} onClick={() => switchLanguage(lc)}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-all ${isActive ? 'bg-[#002844]/5 font-bold' : 'hover:bg-gray-50'}`}>
                      <span className="text-2xl">{info?.flag}</span>
                      <span className="text-[#002844]">{lang === 'fr' ? info?.nameFr : info?.nameEn}</span>
                      {isActive && <span className="ml-auto text-[#D9B438] text-sm font-semibold">✓</span>}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* CECRL Level */}
          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm text-[#555555]">{t('dashboard.levelCecrl', lang)}</p>
              <GraduationCap className="h-5 w-5 text-[#002844]" />
            </div>
            {progress?.diagnosticCompleted ? (
              <span className="inline-block rounded-full bg-[#002844] px-5 py-2 text-2xl font-bold text-white">
                {progress.levelCecrl || 'A1'}
              </span>
            ) : (
              <div>
                <p className="text-lg font-semibold text-[#555555]">{t('dashboard.notEvaluated', lang)}</p>
                <button className="mt-2 text-sm font-medium text-[#D9B438] underline">{t('dashboard.takeDiagnostic', lang)}</button>
              </div>
            )}
          </div>
        </div>

        {/* LIGNE 3: 2 cards conditional - GRC | Classement */}
        {(hasGrc) && (
          <div className="grid gap-4 sm:gap-6 md:grid-cols-2 mb-4 sm:mb-6">
            {/* GRC Level */}
            {hasGrc && (
              <div className="rounded-2xl bg-white p-5 shadow-sm">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm text-[#555555]">{t('dashboard.levelGrc', lang)}</p>
                  <Trophy className="h-5 w-5 text-[#D9B438]" />
                </div>
                <span className="inline-block rounded-full bg-[#D9B438] px-5 py-2 text-xl font-bold text-[#002844]">
                  {progress?.levelGrc || 'Junior'}
                </span>
              </div>
            )}

            {/* Classement */}
            <div className="rounded-2xl bg-white p-5 shadow-sm">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm text-[#555555]">{t('dashboard.ranking', lang)}</p>
                <Trophy className="h-5 w-5 text-[#555555]" />
              </div>
              <p className="text-2xl font-bold text-[#002844]">#--</p>
              <p className="text-xs text-[#555555]">{lang === 'fr' ? 'Pas encore de données' : 'No data yet'}</p>
            </div>
          </div>
        )}

        {/* LIGNE 4: Progression (objectifs de cette langue uniquement) */}
        {objectives.length > 0 && (
          <div className="rounded-2xl bg-white p-5 shadow-sm mb-4 sm:mb-6">
            <div className="mb-4 flex items-center justify-between">
              <p className="font-semibold text-[#002844]">{t('dashboard.progress', lang)}</p>
              <BarChart3 className="h-5 w-5 text-[#555555]" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {objectives.map(obj => {
                const objInfo = LEARNING_OBJECTIVES.find(o => o.id === obj)
                const pct = progress?.objectiveProgress?.[obj] || 0
                return (
                  <div key={obj} className="p-3 rounded-xl bg-gray-50">
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-sm font-medium text-[#002844]">{objInfo?.icon} {lang === 'fr' ? objInfo?.nameFr : objInfo?.nameEn}</span>
                      <span className="text-sm text-[#555555]">{pct}%</span>
                    </div>
                    <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-200">
                      <div className="h-full rounded-full bg-[#D9B438] transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* LIGNE 5: Calendrier ENRICHI (#8) - jours + certif + défis */}
        <div className="rounded-2xl bg-white p-5 shadow-sm mb-4 sm:mb-6">
          <div className="mb-4 flex items-center justify-between">
            <p className="font-semibold text-[#002844]">{t('dashboard.schedule', lang)}</p>
            <Calendar className="h-5 w-5 text-[#555555]" />
          </div>
          <div className="grid grid-cols-7 gap-2 mb-4">
            {DAYS_OF_WEEK.map(day => {
              const isActive = user.settings.schedule.days.includes(day.id)
              return (
                <div key={day.id}
                  className={`rounded-lg py-2 text-center text-xs font-semibold ${isActive ? 'bg-[#002844] text-white' : 'bg-gray-100 text-[#555555]'}`}>
                  {lang === 'fr' ? day.shortFr : day.shortEn}
                </div>
              )
            })}
          </div>
          <p className="text-center text-sm text-[#555555] mb-4">
            {user.settings.schedule.duration} min / {lang === 'fr' ? 'jour' : 'day'}
          </p>

          {/* Enriched info */}
          <div className="grid gap-2 sm:grid-cols-3 border-t border-gray-100 pt-4">
            <div className="flex items-center gap-2 p-2 rounded-lg bg-blue-50">
              <GraduationCap className="h-4 w-4 text-[#002844]" />
              <span className="text-xs text-[#002844] font-medium">{t('dashboard.nextCecrl', lang)}: {lang === 'fr' ? 'dans 1 mois' : 'in 1 month'}</span>
            </div>
            {hasGrc && (
              <div className="flex items-center gap-2 p-2 rounded-lg bg-[#D9B438]/10">
                <Shield className="h-4 w-4 text-[#D9B438]" />
                <span className="text-xs text-[#002844] font-medium">{t('dashboard.nextGrc', lang)}: {lang === 'fr' ? 'dans 1 mois' : 'in 1 month'}</span>
              </div>
            )}
            <div className="flex items-center gap-2 p-2 rounded-lg bg-gray-50">
              <Target className="h-4 w-4 text-[#555555]" />
              <span className="text-xs text-[#555555] font-medium">{t('dashboard.pendingChallenges', lang)}: 0</span>
            </div>
          </div>

          {/* Start review button */}
          <a href="/module/revision"
            className="mt-4 block w-full rounded-xl bg-[#002844] px-4 py-3 text-center text-sm font-semibold text-white hover:opacity-90">
            {t('dashboard.startReview', lang)}
          </a>
        </div>

        {/* CORRECTION #10: Défis avec contexte + CTA */}
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <p className="font-semibold text-[#002844]">{t('dashboard.challenges', lang)}</p>
            <Target className="h-5 w-5 text-[#555555]" />
          </div>
          <div className="rounded-xl bg-[#F0F0F0] p-6 text-center">
            <p className="text-lg font-semibold text-[#002844]">
              {t('dashboard.noChallenges', lang)} — {t('dashboard.challengeFriend', lang)} 🏆
            </p>
            <p className="text-sm text-[#555555] mt-2">{t('dashboard.challengeExplain', lang)}</p>
            <button disabled className="mt-4 rounded-xl bg-[#D9B438]/50 px-6 py-2.5 text-sm font-semibold text-[#002844]/50 cursor-not-allowed">
              {t('dashboard.launchChallenge', lang)} ({lang === 'fr' ? 'bientôt' : 'coming soon'})
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}
