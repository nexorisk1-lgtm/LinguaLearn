'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getCurrentUser, logoutUser } from '@/lib/db/localStorage'
import { User, InterfaceLanguage, LEARNING_LANGUAGES, LEARNING_OBJECTIVES, DAYS_OF_WEEK } from '@/types'
import { t } from '@/lib/i18n'
import {
  Flame, GraduationCap, Calendar, Trophy, LogOut, Menu, X,
  BarChart3, Shield, Globe, Clock, Target,
} from 'lucide-react'

export default function DashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [lang, setLang] = useState<InterfaceLanguage>('fr')
  const [loading, setLoading] = useState(true)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    const currentUser = getCurrentUser()
    if (!currentUser) { router.push('/auth'); return }
    if (!currentUser.onboardingCompleted) { router.push('/onboarding'); return }
    setUser(currentUser)
    setLang(currentUser.settings.interfaceLang || 'fr')
    setLoading(false)
  }, [router])

  const handleLogout = () => {
    logoutUser()
    router.push('/auth')
  }

  if (loading || !user) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-[#002844]" />
      </div>
    )
  }

  const activeLang = user.settings.learningLangs[0]
  const activeLangInfo = LEARNING_LANGUAGES.find(l => l.code === activeLang)
  const progress = user.progress[activeLang]
  const hasGrc = user.hasGrcThemes

  const navItems = [
    { label: lang === 'fr' ? 'Accueil' : 'Home', href: '/dashboard', active: true },
    { label: lang === 'fr' ? 'Vocabulaire' : 'Vocabulary', href: '#' },
    { label: lang === 'fr' ? 'Grammaire' : 'Grammar', href: '#' },
    { label: lang === 'fr' ? 'Lecture' : 'Reading', href: '#' },
    { label: lang === 'fr' ? 'Entraînement' : 'Training', href: '#' },
    { label: lang === 'fr' ? 'Coach IA' : 'AI Coach', href: '#' },
    { label: lang === 'fr' ? 'Profil' : 'Profile', href: '#' },
  ]

  return (
    <div className="min-h-screen bg-[#F0F0F0]">
      {/* Navigation fixe - CDC Section 10 */}
      <nav className="sticky top-0 z-50 bg-[#002844] shadow-lg">
        <div className="mx-auto max-w-7xl px-4">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-8">
              <h1 className="text-xl font-bold text-white">
                Lingua<span className="text-[#D9B438]">Learn</span>
              </h1>
              <div className="hidden items-center gap-1 lg:flex">
                {navItems.map(item => (
                  <a
                    key={item.label}
                    href={item.href}
                    className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                      item.active
                        ? 'bg-white/10 text-[#D9B438]'
                        : 'text-white/80 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    {item.label}
                  </a>
                ))}
              </div>
            </div>

            <div className="hidden items-center gap-3 lg:flex">
              {user.role === 'admin' && (
                <button className="flex items-center gap-1 rounded-lg bg-white/10 px-3 py-2 text-sm font-medium text-[#D9B438]">
                  <Shield className="h-4 w-4" /> Admin
                </button>
              )}
              <button
                onClick={handleLogout}
                className="flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-white/80 hover:bg-white/10"
              >
                <LogOut className="h-4 w-4" />
                {t('auth.logout', lang)}
              </button>
            </div>

            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="text-white lg:hidden">
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>

          {/* Mobile menu */}
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
                  <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-[#D9B438]">
                    <Shield className="h-4 w-4" /> Admin
                  </button>
                )}
                <button onClick={handleLogout}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-white/80">
                  <LogOut className="h-4 w-4" /> {t('auth.logout', lang)}
                </button>
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* Main content */}
      <main className="mx-auto max-w-7xl px-4 py-6 sm:py-8">
        {/* Greeting - ALWAYS */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-[#002844]">
            {t('dashboard.hello', lang)} {user.firstName} 👋
          </h2>
        </div>

        <div className="grid gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* Streak - ALWAYS */}
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#555555]">{t('dashboard.streak', lang)}</p>
                <p className="mt-1 text-4xl font-bold text-[#002844]">0</p>
                <p className="text-sm text-[#555555]">{t('dashboard.days', lang)}</p>
              </div>
              <Flame className="h-14 w-14 text-[#D9B438]" fill="#D9B438" />
            </div>
          </div>

          {/* Active language - ALWAYS */}
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm text-[#555555]">{t('dashboard.activeLang', lang)}</p>
              <Globe className="h-5 w-5 text-[#555555]" />
            </div>
            <p className="text-2xl font-bold text-[#002844]">
              {activeLangInfo ? (lang === 'fr' ? activeLangInfo.nameFr : activeLangInfo.nameEn) : activeLang}
            </p>
            <p className="text-3xl">{activeLangInfo?.flag}</p>
          </div>

          {/* CECRL Level - ALWAYS */}
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm text-[#555555]">{t('dashboard.levelCecrl', lang)}</p>
              <GraduationCap className="h-5 w-5 text-[#002844]" />
            </div>
            <span className="inline-block rounded-full bg-[#002844] px-5 py-2 text-2xl font-bold text-white">
              {progress?.levelCecrl || 'A1'}
            </span>
          </div>

          {/* GRC Level - ONLY if hasGrcThemes === true (CDC Section 9.1) */}
          {hasGrc && (
            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm text-[#555555]">{t('dashboard.levelGrc', lang)}</p>
                <Trophy className="h-5 w-5 text-[#D9B438]" />
              </div>
              <span className="inline-block rounded-full bg-[#D9B438] px-5 py-2 text-xl font-bold text-[#002844]">
                {progress?.levelGrc || 'Junior'}
              </span>
            </div>
          )}

          {/* Progress bars - selected objectives ONLY (CDC Section 8.4) */}
          <div className="rounded-2xl bg-white p-6 shadow-sm md:col-span-2">
            <div className="mb-4 flex items-center justify-between">
              <p className="font-semibold text-[#002844]">{t('dashboard.progress', lang)}</p>
              <BarChart3 className="h-5 w-5 text-[#555555]" />
            </div>
            <div className="space-y-4">
              {user.settings.objectives.map(obj => {
                const objInfo = LEARNING_OBJECTIVES.find(o => o.id === obj)
                const pct = progress?.objectiveProgress?.[obj] || 0
                return (
                  <div key={obj}>
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-sm font-medium text-[#002844]">
                        {objInfo?.icon} {lang === 'fr' ? objInfo?.nameFr : objInfo?.nameEn}
                      </span>
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

          {/* Calendar - ALWAYS */}
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <p className="font-semibold text-[#002844]">{t('dashboard.schedule', lang)}</p>
              <Calendar className="h-5 w-5 text-[#555555]" />
            </div>
            <div className="grid grid-cols-7 gap-2">
              {DAYS_OF_WEEK.map(day => {
                const isActive = user.settings.schedule.days.includes(day.id)
                return (
                  <div key={day.id}
                    className={`rounded-lg py-2 text-center text-xs font-semibold ${
                      isActive ? 'bg-[#002844] text-white' : 'bg-gray-100 text-[#555555]'
                    }`}>
                    {lang === 'fr' ? day.shortFr : day.shortEn}
                  </div>
                )
              })}
            </div>
            <p className="mt-3 text-center text-sm text-[#555555]">
              {user.settings.schedule.duration} min / {lang === 'fr' ? 'jour' : 'day'}
            </p>
          </div>

          {/* Today's review - ALWAYS */}
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <p className="font-semibold text-[#002844]">{t('dashboard.todayReview', lang)}</p>
              <Clock className="h-5 w-5 text-[#555555]" />
            </div>
            <p className="text-sm text-[#555555]">
              {lang === 'fr' ? 'Vos activités prévues pour aujourd\'hui' : 'Your planned activities for today'}
            </p>
            <button className="mt-4 w-full rounded-xl bg-[#002844] px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90">
              {lang === 'fr' ? 'Commencer' : 'Start'}
            </button>
          </div>

          {/* CECRL Certification reminder - ALWAYS */}
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <p className="font-semibold text-[#002844]">{t('dashboard.certifReminder', lang)} CECRL</p>
              <Trophy className="h-5 w-5 text-[#D9B438]" />
            </div>
            <p className="text-sm text-[#555555]">
              {lang === 'fr' ? 'Échéance mensuelle — Préparez votre certification' : 'Monthly deadline — Prepare your certification'}
            </p>
          </div>

          {/* GRC Certification reminder - ONLY if hasGrcThemes */}
          {hasGrc && (
            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <p className="font-semibold text-[#002844]">{t('dashboard.certifReminder', lang)} GRC</p>
                <Shield className="h-5 w-5 text-[#D9B438]" />
              </div>
              <p className="text-sm text-[#555555]">
                {lang === 'fr' ? 'Échéance mensuelle — Certification GRC/Cyber' : 'Monthly deadline — GRC/Cyber Certification'}
              </p>
            </div>
          )}

          {/* Active challenges - placeholder */}
          <div className="rounded-2xl bg-white p-6 shadow-sm md:col-span-2 lg:col-span-3">
            <div className="mb-4 flex items-center justify-between">
              <p className="font-semibold text-[#002844]">{t('dashboard.challenges', lang)}</p>
              <Target className="h-5 w-5 text-[#555555]" />
            </div>
            <div className="rounded-xl bg-[#F0F0F0] p-8 text-center">
              <p className="text-sm text-[#555555]">
                {lang === 'fr' ? 'Aucun défi en cours' : 'No active challenges'}
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
