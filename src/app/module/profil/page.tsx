'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getCurrentUser, logoutUser } from '@/lib/db/localStorage'
import { User, InterfaceLanguage, LEARNING_LANGUAGES, ALL_THEMES, DAYS_OF_WEEK } from '@/types'
import { getThemeName } from '@/lib/i18n'
import {
  User as UserIcon, Globe, BookOpen, Calendar, Settings,
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
    setLoading(false)
  }, [router])

  const handleLogout = () => { logoutUser(); router.push('/auth') }

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
      {/* Header */}
      <div className="bg-[#002844] px-4 py-6 text-center">
        <div className="w-16 h-16 rounded-full bg-[#D9B438] mx-auto mb-3 flex items-center justify-center">
          <UserIcon className="h-8 w-8 text-[#002844]" />
        </div>
        <h1 className="text-xl font-bold text-white">{user.firstName}</h1>
        <p className="text-sm text-white/70">{user.email}</p>
      </div>

      <main className="px-4 pt-4 space-y-3">
        {/* Password */}
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold text-[#555555] mb-1">{lang === 'fr' ? 'Mot de passe' : 'Password'}</p>
          <p className="text-sm text-[#002844]">{lang === 'fr' ? 'Pour réinitialiser, contactez votre administrateur.' : 'To reset, contact your administrator.'}</p>
        </div>

        {/* Languages */}
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Globe className="h-4 w-4 text-[#002844]" />
            <span className="text-sm font-bold text-[#002844]">{lang === 'fr' ? 'Langues' : 'Languages'}</span>
          </div>
          <div className="space-y-2">
            {user.settings.learningLangs.map(lc => {
              const info = LEARNING_LANGUAGES.find(l => l.code === lc)
              return (
                <div key={lc} className="flex items-center gap-2 p-2 rounded-lg bg-[#F0F0F0]">
                  <span className="text-lg">{info?.flag}</span>
                  <span className="text-sm font-medium text-[#002844]">{lang === 'fr' ? info?.nameFr : info?.nameEn}</span>
                  {lc === activeLang && <span className="ml-auto text-xs font-bold text-[#D9B438]">{lang === 'fr' ? 'Active' : 'Active'}</span>}
                </div>
              )
            })}
          </div>
          <a href="/onboarding" className="mt-3 block text-center text-sm font-semibold py-2 rounded-lg"
            style={{ color: '#D9B438', backgroundColor: '#002844' }}>
            {lang === 'fr' ? '+ Ajouter une langue' : '+ Add a language'}
          </a>
        </div>

        {/* Themes */}
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <BookOpen className="h-4 w-4 text-[#002844]" />
            <span className="text-sm font-bold text-[#002844]">{lang === 'fr' ? 'Thèmes sélectionnés' : 'Selected themes'}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {(langConfig?.themes || []).map(themeId => (
              <span key={themeId} className="text-xs font-semibold px-3 py-1.5 rounded-full bg-[#D9B438]/20 text-[#002844]">
                {getThemeName(themeId, lang, ALL_THEMES)}
              </span>
            ))}
          </div>
        </div>

        {/* Level */}
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <GraduationCap className="h-4 w-4 text-[#002844]" />
            <span className="text-sm font-bold text-[#002844]">{lang === 'fr' ? 'Niveau' : 'Level'}</span>
          </div>
          <div className="flex gap-3">
            <div className="flex-1 p-3 rounded-lg bg-[#F0F0F0] text-center">
              <p className="text-xs text-[#555555]">CECRL</p>
              <p className="text-lg font-bold text-[#002844]">{progress?.levelCecrl || 'A1'}</p>
            </div>
            {hasGrc && (
              <div className="flex-1 p-3 rounded-lg bg-[#D9B438]/10 text-center">
                <p className="text-xs text-[#555555]">GRC</p>
                <p className="text-lg font-bold text-[#D9B438]">{progress?.levelGrc || 'Junior'}</p>
              </div>
            )}
          </div>
        </div>

        {/* Organization */}
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Calendar className="h-4 w-4 text-[#002844]" />
            <span className="text-sm font-bold text-[#002844]">{lang === 'fr' ? 'Organisation' : 'Organization'}</span>
          </div>
          <div className="flex gap-1 mb-2">
            {DAYS_OF_WEEK.map(day => {
              const isActive = schedule?.days?.includes(day.id)
              return (
                <div key={day.id} className={`flex-1 rounded py-1 text-center text-xs font-semibold ${isActive ? 'bg-[#002844] text-white' : 'bg-[#F0F0F0] text-[#555555]'}`}>
                  {lang === 'fr' ? day.shortFr : day.shortEn}
                </div>
              )
            })}
          </div>
          <p className="text-xs text-[#555555]">{schedule?.duration || 20} min / {lang === 'fr' ? 'jour' : 'day'}</p>
        </div>

        {/* Learning settings */}
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Settings className="h-4 w-4 text-[#002844]" />
            <span className="text-sm font-bold text-[#002844]">{lang === 'fr' ? 'Paramètres' : 'Settings'}</span>
          </div>
          
          {/* Words per day */}
          <div className="mb-4">
            <p className="text-xs text-[#555555] mb-2">{lang === 'fr' ? 'Mots par jour' : 'Words per day'}</p>
            <div className="flex gap-2">
              {[4, 8, 12].map(n => (
                <button key={n} onClick={() => setWordsPerDay(n)}
                  className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${wordsPerDay === n ? 'bg-[#002844] text-white' : 'bg-[#F0F0F0] text-[#555555]'}`}>
                  {n}
                </button>
              ))}
            </div>
          </div>

          {/* Toggles */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Volume2 className="h-4 w-4 text-[#002844]" />
                <span className="text-sm text-[#002844]">{lang === 'fr' ? 'Écoute' : 'Listening'}</span>
              </div>
              <button onClick={() => setListenEnabled(!listenEnabled)}
                className={`w-12 h-6 rounded-full transition-all ${listenEnabled ? 'bg-[#D9B438]' : 'bg-gray-300'}`}>
                <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${listenEnabled ? 'translate-x-6' : 'translate-x-0.5'}`} />
              </button>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Mic className="h-4 w-4 text-[#002844]" />
                <span className="text-sm text-[#002844]">{lang === 'fr' ? 'Pratique Oral' : 'Speaking practice'}</span>
              </div>
              <button onClick={() => setSpeakEnabled(!speakEnabled)}
                className={`w-12 h-6 rounded-full transition-all ${speakEnabled ? 'bg-[#D9B438]' : 'bg-gray-300'}`}>
                <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${speakEnabled ? 'translate-x-6' : 'translate-x-0.5'}`} />
              </button>
            </div>
          </div>
        </div>

        {/* Evaluation */}
        <a href="/onboarding/diagnostic" className="block rounded-xl bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <GraduationCap className="h-4 w-4 text-[#D9B438]" />
              <span className="text-sm font-bold text-[#002844]">{lang === 'fr' ? 'Évaluation' : 'Assessment'}</span>
            </div>
            <ChevronRight className="h-4 w-4 text-[#555555]" />
          </div>
          <p className="text-xs text-[#555555] mt-1">{lang === 'fr' ? 'Diagnostic CECRL ou certification' : 'CECRL diagnostic or certification'}</p>
        </a>

        {/* Admin */}
        {user.role === 'admin' && (
          <a href="/module/admin" className="block rounded-xl bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-[#D9B438]" />
                <span className="text-sm font-bold text-[#002844]">Admin</span>
              </div>
              <ChevronRight className="h-4 w-4 text-[#555555]" />
            </div>
          </a>
        )}

        {/* Logout */}
        <button onClick={handleLogout}
          className="w-full rounded-xl bg-white p-4 shadow-sm flex items-center gap-2">
          <LogOut className="h-4 w-4 text-red-500" />
          <span className="text-sm font-semibold text-red-500">{lang === 'fr' ? 'Déconnexion' : 'Logout'}</span>
        </button>
      </main>
    </div>
  )
}
