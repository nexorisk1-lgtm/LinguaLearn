'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getCurrentUser, setActiveLang } from '@/lib/db/localStorage'
import { User, InterfaceLanguage, LearningLanguage, LEARNING_LANGUAGES, LEARNING_OBJECTIVES } from '@/types'
import { t } from '@/lib/i18n'
import {
  Flame, GraduationCap, Trophy, ChevronDown, ChevronRight,
  BookOpen, PenTool, Languages, Dumbbell, Home, MessageCircle, User as UserIcon, BarChart3,
} from 'lucide-react'

export default function DashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [lang, setLang] = useState<InterfaceLanguage>('fr')
  const [loading, setLoading] = useState(true)
  const [langSelectorOpen, setLangSelectorOpen] = useState(false)
  const [tasksOpen, setTasksOpen] = useState(false)

  useEffect(() => {
    const currentUser = getCurrentUser()
    if (!currentUser) { router.push('/auth'); return }
    if (!currentUser.onboardingCompleted && currentUser.role !== 'admin') { router.push('/onboarding'); return }
    if (!currentUser.activeLang && currentUser.settings.learningLangs.length > 0) {
      currentUser.activeLang = currentUser.settings.learningLangs[0]
    }
    setUser(currentUser)
    setLang(currentUser.settings.interfaceLang || 'fr')
    setLoading(false)
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

  const activeLang = user.activeLang || user.settings.learningLangs[0]
  const activeLangInfo = LEARNING_LANGUAGES.find(l => l.code === activeLang)
  const progress = user.progress?.[activeLang]
  const langConfig = user.settings.languageConfigs?.[activeLang]
  const hasGrc = langConfig?.hasGrcThemes || false
  const objectives = langConfig?.objectives || []

  // Module blocks config
  const moduleBlocks = [
    { id: 'vocabulaire', label: lang === 'fr' ? 'Vocabulaire' : 'Vocabulary', icon: BookOpen, color: '#1976D2', bgLight: '#E3F2FD', href: '/module/vocabulaire', objective: 'vocabulaire' },
    { id: 'grammaire', label: lang === 'fr' ? 'Grammaire' : 'Grammar', icon: PenTool, color: '#F9A825', bgLight: '#FFF8E1', href: '/module/grammaire', objective: 'grammaire' },
    { id: 'lecture', label: lang === 'fr' ? 'Lecture' : 'Reading', icon: Languages, color: '#2E7D32', bgLight: '#E8F5E9', href: '/module/lecture', objective: 'lecture' },
    { id: 'entrainement', label: lang === 'fr' ? 'Entraînement' : 'Training', icon: Dumbbell, color: '#E65100', bgLight: '#FFF3E0', href: '/module/entrainement', objective: null },
  ]

  // Bottom nav items
  const bottomNav = [
    { id: 'home', label: lang === 'fr' ? 'Accueil' : 'Home', icon: Home, href: '/dashboard', active: true },
    { id: 'dict', label: lang === 'fr' ? 'Dictionnaire' : 'Dictionary', icon: BookOpen, href: '/module/dictionnaire', active: false },
    { id: 'coach', label: 'Coach IA', icon: MessageCircle, href: '/module/coach', active: false },
    { id: 'profil', label: lang === 'fr' ? 'Profil' : 'Profile', icon: UserIcon, href: '/module/profil', active: false },
  ]

  return (
    <div className="min-h-screen bg-[#F0F0F0] pb-20">
      {/* TOP BAR — compact: logo + lang selector */}
      <div className="sticky top-0 z-50 bg-[#002844] px-4 py-3 flex items-center justify-between">
        <h1 className="text-lg font-bold text-white">Lingua<span className="text-[#D9B438]">Learn</span></h1>
        
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
      </div>

      {/* MAIN CONTENT */}
      <main className="px-4 pt-4">
        {/* Greeting + Streak */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-[#002844]">{t('dashboard.hello', lang)} {user.firstName} 👋</h2>
            <p className="text-xs text-[#555555] mt-0.5">
              {lang === 'fr' ? `Jour 1 — Continue comme ça !` : `Day 1 — Keep it up!`}
            </p>
          </div>
          <div className="flex items-center gap-1.5 rounded-xl bg-white px-3 py-2 shadow-sm">
            <Flame className="h-5 w-5 text-[#D9B438]" fill="#D9B438" />
            <span className="text-lg font-bold text-[#002844]">0</span>
          </div>
        </div>

        {/* Level badges */}
        <div className={`grid gap-2 mb-4 ${hasGrc ? 'grid-cols-2' : 'grid-cols-1'}`}>
          <div className="flex items-center gap-2 rounded-xl bg-white p-3 shadow-sm">
            <GraduationCap className="h-6 w-6 text-[#002844]" />
            <div>
              <p className="text-xs text-[#555555]">CECRL</p>
              {progress?.diagnosticCompleted ? (
                <span className="text-sm font-bold text-[#002844]">{progress.levelCecrl || 'A1'}</span>
              ) : (
                <span className="text-xs text-[#D9B438] font-semibold">{lang === 'fr' ? 'Non évalué' : 'Not assessed'}</span>
              )}
            </div>
          </div>
          {hasGrc && (
            <div className="flex items-center gap-2 rounded-xl bg-white p-3 shadow-sm">
              <Trophy className="h-6 w-6 text-[#D9B438]" />
              <div>
                <p className="text-xs text-[#555555]">GRC</p>
                <span className="text-sm font-bold text-[#002844]">{progress?.levelGrc || 'Junior'}</span>
              </div>
            </div>
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

        {/* 4 MODULE BLOCKS — 2x2 grid */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          {moduleBlocks.map(block => {
            const Icon = block.icon
            const pct = block.objective ? (progress?.objectiveProgress?.[block.objective as keyof typeof progress.objectiveProgress] || 0) : 0
            return (
              <a key={block.id} href={block.href}
                className="rounded-2xl p-4 shadow-sm transition-transform active:scale-95"
                style={{ backgroundColor: block.bgLight }}>
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-2 rounded-xl" style={{ backgroundColor: block.color }}>
                    <Icon className="h-5 w-5 text-white" />
                  </div>
                </div>
                <p className="font-bold text-sm mb-2" style={{ color: block.color }}>{block.label}</p>
                {block.objective && (
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-xs text-[#555555]">{lang === 'fr' ? 'Progression' : 'Progress'}</span>
                      <span className="text-xs font-bold" style={{ color: block.color }}>{pct}%</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-white/60">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: block.color }} />
                    </div>
                  </div>
                )}
              </a>
            )
          })}
        </div>

        {/* Accordéon — Tâches supplémentaires */}
        <div className="rounded-2xl bg-white shadow-sm mb-4 overflow-hidden">
          <button onClick={() => setTasksOpen(!tasksOpen)}
            className="w-full flex items-center justify-between p-4">
            <span className="font-bold text-sm text-[#002844]">{lang === 'fr' ? 'Tâches supplémentaires' : 'Extra tasks'}</span>
            <ChevronDown className={`h-4 w-4 text-[#555555] transition-transform ${tasksOpen ? 'rotate-180' : ''}`} />
          </button>
          {tasksOpen && (
            <div className="px-4 pb-4 space-y-2">
              <a href="/module/vocabulaire?tab=write" className="flex items-center gap-3 p-3 rounded-xl bg-[#F0F0F0] hover:bg-[#E0E0E0] transition-colors">
                <PenTool className="h-4 w-4 text-[#002844]" />
                <span className="text-sm font-medium text-[#002844]">{lang === 'fr' ? 'Exercice de traduction' : 'Translation exercise'}</span>
              </a>
              <a href="/module/vocabulaire?tab=write" className="flex items-center gap-3 p-3 rounded-xl bg-[#F0F0F0] hover:bg-[#E0E0E0] transition-colors">
                <PenTool className="h-4 w-4 text-[#002844]" />
                <span className="text-sm font-medium text-[#002844]">{lang === 'fr' ? 'Écrit' : 'Writing'}</span>
              </a>
              <a href="/module/vocabulaire?tab=pronounce" className="flex items-center gap-3 p-3 rounded-xl bg-[#F0F0F0] hover:bg-[#E0E0E0] transition-colors">
                <Languages className="h-4 w-4 text-[#002844]" />
                <span className="text-sm font-medium text-[#002844]">{lang === 'fr' ? 'Oral' : 'Speaking'}</span>
              </a>
            </div>
          )}
        </div>

        {/* Progression par objectifs */}
        {objectives.length > 0 && (
          <div className="rounded-2xl bg-white p-4 shadow-sm mb-4">
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 className="h-4 w-4 text-[#002844]" />
              <span className="font-bold text-sm text-[#002844]">{lang === 'fr' ? 'Progression par sujet' : 'Progress by subject'}</span>
            </div>
            <div className="space-y-3">
              {objectives.map(obj => {
                const objInfo = LEARNING_OBJECTIVES.find(o => o.id === obj)
                const pct = progress?.objectiveProgress?.[obj] || 0
                return (
                  <div key={obj} className="flex items-center gap-3">
                    <span className="text-lg w-6 text-center">{objInfo?.icon}</span>
                    <div className="flex-1">
                      <div className="flex justify-between mb-0.5">
                        <span className="text-xs font-medium text-[#002844]">{lang === 'fr' ? objInfo?.nameFr : objInfo?.nameEn}</span>
                        <span className="text-xs text-[#555555]">{pct}%</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-gray-200">
                        <div className="h-full rounded-full bg-[#D9B438] transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Weekly ranking */}
        <div className="rounded-2xl bg-white p-4 shadow-sm mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-[#D9B438]" />
              <span className="font-bold text-sm text-[#002844]">{lang === 'fr' ? 'Classement hebdo' : 'Weekly ranking'}</span>
            </div>
            <span className="text-sm text-[#555555]">{lang === 'fr' ? 'Pas encore de données' : 'No data yet'}</span>
          </div>
        </div>
      </main>

      {/* ===== BOTTOM NAVIGATION BAR ===== */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 shadow-lg">
        <div className="flex justify-around items-center h-16 max-w-lg mx-auto">
          {bottomNav.map(item => {
            const Icon = item.icon
            return (
              <a key={item.id} href={item.href}
                className="flex flex-col items-center gap-0.5 px-3 py-1 min-w-[60px]">
                <Icon className="h-5 w-5" style={{ color: item.active ? '#D9B438' : '#555555' }} />
                <span className="text-[10px] font-semibold" style={{ color: item.active ? '#D9B438' : '#555555' }}>
                  {item.label}
                </span>
              </a>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
