'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getCurrentUser, logoutUser, updateUserSettings } from '@/lib/db/localStorage'
import { User, InterfaceLanguage, LEARNING_LANGUAGES, ALL_THEMES, DAYS_OF_WEEK } from '@/types'
import { getThemeName } from '@/lib/i18n'
import {
  User as UserIcon, Globe, Calendar,
  GraduationCap, Shield, LogOut, ChevronRight, Volume2, Mic,
} from 'lucide-react'

export default function ProfilPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [lang, setLang] = useState<InterfaceLanguage>('fr')
  const [loading, setLoading] = useState(true)
  const [wordsPerDay, setWordsPerDay] = useState(8)
  const [listenEnabled, setListenEnabled] = useState(true)
  const [speakEnabled, setSpeakEnabled] = useState(true)

  useEffect(() => {
    const u = getCurrentUser()
    if (!u) { router.push('/auth'); return }
    setUser(u)
    setLang(u.settings.interfaceLang || 'fr')
    // Load wordsPerDay from schedule
    const activeLang = u.activeLang || u.settings.learningLangs[0] || 'en'
    const schedule = u.settings.schedules?.[activeLang] || u.settings.schedule
    if (schedule && schedule.wordsPerDay) {
      setWordsPerDay(schedule.wordsPerDay)
    }
    setLoading(false)
  }, [router])

  const handleLogout = () => { logoutUser(); router.push('/auth') }

  const handleWordsPerDayChange = (n: number) => {
    setWordsPerDay(n)
    if (user) {
      const activeLang = user.activeLang || user.settings.learningLangs[0] || 'en'
      const schedules = { ...(user.settings.schedules || {}) }
      const currentSched = schedules[activeLang] || user.settings.schedule || { days: [], duration: 20 }
      schedules[activeLang] = { ...currentSched, wordsPerDay: n } as typeof currentSched
      const updated = updateUserSettings(user.id, { schedules })
      if (updated) setUser(updated)
    }
  }

  if (loading || !user) {
    return <div className="flex h-screen items-center justify-center"><div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-[#002844]" /></div>
  }

  const activeLang = user.activeLang || user.settings.learningLangs[0] || 'en'
  const progress = user.progress?.[activeLang]
  const langConfig = user.settings.languageConfigs?.[activeLang]
  const hasGrc = langConfig?.hasGrcThemes || false
  const schedule = user.settings.schedules?.[activeLang] || user.settings.schedule

  return (
    <div className="min-h-screen bg-[#F0F0F0] pb-20">
      {/* Compact header */}
      <div className="bg-[#002844] px-4 py-4 flex items-center gap-3">
        <div className="w-12 h-12 rounded-full bg-[#D9B438] flex items-center justify-center flex-shrink-0">
          <UserIcon className="h-6 w-6 text-[#002844]" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-white truncate">{user.firstName}</h1>
          <p className="text-xs text-white/60 truncate">{user.email}</p>
        </div>
      </div>

      <main className="px-3 pt-3 space-y-3">
        {/* ROW 1: Languages + Level — 2 cards side by side */}
        <div className="grid grid-cols-2 gap-3">
          {/* Languages card */}
          <div className="rounded-xl bg-white p-3 shadow-sm">
            <div className="flex items-center gap-1.5 mb-2">
              <Globe className="h-3.5 w-3.5 text-[#002844]" />
              <span className="text-xs font-bold text-[#002844]">{lang === 'fr' ? 'Langues' : 'Languages'}</span>
            </div>
            <div className="space-y-1.5">
              {user.settings.learningLangs.map(lc => {
                const info = LEARNING_LANGUAGES.find(l => l.code === lc)
                return (
                  <div key={lc} className="flex items-center gap-1.5">
                    <span className="text-sm">{info?.flag}</span>
                    <span className="text-xs text-[#002844] truncate">{lang === 'fr' ? info?.nameFr : info?.nameEn}</span>
                    {lc === activeLang && <span className="ml-auto text-[8px] font-bold text-[#D9B438]">●</span>}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Level card */}
          <div className="rounded-xl bg-white p-3 shadow-sm">
            <div className="flex items-center gap-1.5 mb-2">
              <GraduationCap className="h-3.5 w-3.5 text-[#002844]" />
              <span className="text-xs font-bold text-[#002844]">{lang === 'fr' ? 'Niveau' : 'Level'}</span>
            </div>
            <div className="space-y-2">
              <div className="p-2 rounded-lg bg-[#002844]/5 text-center">
                <p className="text-[10px] text-[#555555]">CECRL</p>
                <p className="text-xl font-black text-[#002844]">{progress?.levelCecrl || 'A1'}</p>
              </div>
              {hasGrc && (
                <div className="p-2 rounded-lg bg-[#D9B438]/10 text-center">
                  <p className="text-[10px] text-[#555555]">GRC</p>
                  <p className="text-base font-bold text-[#D9B438]">{progress?.levelGrc || 'Junior'}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ROW 2: Organization + Settings — 2 cards side by side */}
        <div className="grid grid-cols-2 gap-3">
          {/* Organization card */}
          <div className="rounded-xl bg-white p-3 shadow-sm">
            <div className="flex items-center gap-1.5 mb-2">
              <Calendar className="h-3.5 w-3.5 text-[#002844]" />
              <span className="text-xs font-bold text-[#002844]">{lang === 'fr' ? 'Organisation' : 'Organization'}</span>
            </div>
            <div className="flex gap-0.5 mb-2">
              {DAYS_OF_WEEK.map(day => {
                const isActive = schedule?.days?.includes(day.id)
                return (
                  <div key={day.id} className={`flex-1 rounded py-0.5 text-center text-[9px] font-bold ${isActive ? 'bg-[#002844] text-white' : 'bg-[#F0F0F0] text-[#999]'}`}>
                    {lang === 'fr' ? day.shortFr : day.shortEn}
                  </div>
                )
              })}
            </div>
            <p className="text-[10px] text-[#555555]">{schedule?.duration || 20} min/{lang === 'fr' ? 'jour' : 'day'}</p>
          </div>

          {/* Settings card */}
          <div className="rounded-xl bg-white p-3 shadow-sm">
            <div className="flex items-center gap-1.5 mb-2">
              <span className="text-xs font-bold text-[#002844]">{lang === 'fr' ? 'Paramètres' : 'Settings'}</span>
            </div>
            {/* Words per day */}
            <p className="text-[10px] text-[#555555] mb-1">{lang === 'fr' ? 'Mots/jour' : 'Words/day'}</p>
            <div className="flex gap-1 mb-2">
              {[4, 8, 12].map(n => (
                <button key={n} onClick={() => handleWordsPerDayChange(n)}
                  className={`flex-1 py-1 rounded text-xs font-bold transition-all ${wordsPerDay === n ? 'bg-[#D9B438] text-[#002844]' : 'bg-[#F0F0F0] text-[#555555]'}`}>
                  {n}
                </button>
              ))}
            </div>
            {/* Toggles */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Volume2 className="h-3 w-3 text-[#002844]" />
                <button onClick={() => setListenEnabled(!listenEnabled)}
                  className={`w-8 h-4 rounded-full transition-all ${listenEnabled ? 'bg-[#D9B438]' : 'bg-gray-300'}`}>
                  <div className={`w-3.5 h-3.5 bg-white rounded-full shadow transition-transform ${listenEnabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
                </button>
              </div>
              <div className="flex items-center justify-between">
                <Mic className="h-3 w-3 text-[#002844]" />
                <button onClick={() => setSpeakEnabled(!speakEnabled)}
                  className={`w-8 h-4 rounded-full transition-all ${speakEnabled ? 'bg-[#D9B438]' : 'bg-gray-300'}`}>
                  <div className={`w-3.5 h-3.5 bg-white rounded-full shadow transition-transform ${speakEnabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Themes — full width compact */}
        <div className="rounded-xl bg-white p-3 shadow-sm">
          <span className="text-xs font-bold text-[#002844] block mb-2">{lang === 'fr' ? 'Thèmes actifs' : 'Active themes'}</span>
          <div className="flex flex-wrap gap-1.5">
            {(langConfig?.themes || []).slice(0, 8).map(themeId => (
              <span key={themeId} className="text-[10px] font-semibold px-2 py-1 rounded-full bg-[#D9B438]/15 text-[#002844]">
                {getThemeName(themeId, lang, ALL_THEMES)}
              </span>
            ))}
            {(langConfig?.themes || []).length > 8 && (
              <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-gray-100 text-[#555555]">
                +{(langConfig?.themes || []).length - 8}
              </span>
            )}
          </div>
        </div>

        {/* Compact links row: Evaluation + Admin + Password */}
        <div className="space-y-1.5">
          <a href="/onboarding/diagnostic" className="flex items-center justify-between rounded-xl bg-white p-3 shadow-sm">
            <div className="flex items-center gap-2">
              <GraduationCap className="h-4 w-4 text-[#D9B438]" />
              <span className="text-xs font-bold text-[#002844]">{lang === 'fr' ? 'Évaluation diagnostique' : 'Diagnostic assessment'}</span>
            </div>
            <ChevronRight className="h-4 w-4 text-[#555555]" />
          </a>

          {user.role === 'admin' && (
            <a href="/module/admin" className="flex items-center justify-between rounded-xl bg-white p-3 shadow-sm">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-[#D9B438]" />
                <span className="text-xs font-bold text-[#002844]">Admin</span>
              </div>
              <ChevronRight className="h-4 w-4 text-[#555555]" />
            </a>
          )}

          <div className="rounded-xl bg-white p-3 shadow-sm">
            <p className="text-[10px] text-[#555555]">
              {lang === 'fr' ? 'Mot de passe : contactez votre administrateur pour réinitialiser.' : 'Password: contact your administrator to reset.'}
            </p>
          </div>

          <button onClick={handleLogout}
            className="w-full rounded-xl bg-white p-3 shadow-sm flex items-center gap-2">
            <LogOut className="h-4 w-4 text-red-500" />
            <span className="text-xs font-semibold text-red-500">{lang === 'fr' ? 'Déconnexion' : 'Logout'}</span>
          </button>
        </div>
      </main>
    </div>
  )
}
