'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getCurrentUser } from '@/lib/db/localStorage'
import { User, InterfaceLanguage } from '@/types'
import { BANK_A1_COURSES, getA1CourseData } from '@/lib/db/bankA1Courses'
import BottomNav from '@/components/BottomNav'
import { useEngine } from '@/lib/engine/useEngine'
import { Lock, Star, ChevronRight } from 'lucide-react'

type NodeState = 'completed' | 'in_progress' | 'unlocked' | 'locked'

interface CourseNode {
  id: string
  title: string
  vocabCount: number
  hasRule: boolean
  estimatedMin: number
  state: NodeState
  stars: number
  score: number
  isCheckpoint: boolean
  blockIndex: number
}

// Block definitions (same as cours page)
const BLOCK_NAMES_FR = ['Communication', 'Présentation', 'Vie quotidienne', 'Mon monde', 'Je communique', 'Je voyage']
const BLOCK_NAMES_EN = ['Communication', 'Introduction', 'Daily life', 'My world', 'Communication', 'Travel']

export default function ParcoursPage() {
  const router = useRouter()
  const engine = useEngine()
  const [user, setUser] = useState<User | null>(null)
  const [lang, setLang] = useState<InterfaceLanguage>('fr')
  const [loading, setLoading] = useState(true)
  const [nodes, setNodes] = useState<CourseNode[]>([])
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null)

  useEffect(() => {
    const currentUser = getCurrentUser()
    if (!currentUser) { router.push('/auth'); return }
    setUser(currentUser)
    setLang(currentUser.settings.interfaceLang || 'fr')

    const activeLang = currentUser.activeLang || currentUser.settings.learningLangs[0]

    // Load scores
    let scores: Record<string, { score: number }> = {}
    try {
      const key = `lingualearn_course_scores_${currentUser.id}_${activeLang}`
      const stored = localStorage.getItem(key)
      scores = stored ? JSON.parse(stored) : {}
    } catch { /* ignore */ }

    // Build nodes
    const courseNodes: CourseNode[] = []
    let foundActive = false
    let currentBlock = 0

    for (const course of BANK_A1_COURSES) {
      const data = getA1CourseData(course.id)
      const isCheckpoint = course.id.includes('_cp') || course.id.includes('_cert')
      const vocabCount = data?.vocabulary?.length || 7
      const hasRule = !!data?.rule?.en
      const courseScore = scores[course.id]?.score || 0
      const isCompleted = courseScore >= 60

      // Track block changes
      const blockIdx = data ? Math.floor((BANK_A1_COURSES.indexOf(course)) / 8) : currentBlock
      if (blockIdx !== currentBlock) currentBlock = blockIdx

      let state: NodeState = 'locked'
      let stars = 0
      if (isCompleted) {
        state = 'completed'
        stars = courseScore >= 90 ? 3 : courseScore >= 70 ? 2 : 1
      } else if (!foundActive) {
        state = 'in_progress'
        foundActive = true
      } else if (courseNodes.length > 0 && courseNodes[courseNodes.length - 1].state !== 'locked') {
        state = 'unlocked'
      }

      courseNodes.push({
        id: course.id,
        title: data?.title || course.id,
        vocabCount,
        hasRule,
        estimatedMin: Math.round((vocabCount * 0.5) + (hasRule ? 1 : 0) + 1),
        state,
        stars,
        score: courseScore,
        isCheckpoint,
        blockIndex: Math.min(currentBlock, 5),
      })
    }

    // If no active found, first node is active
    if (!foundActive && courseNodes.length > 0) {
      courseNodes[0].state = 'in_progress'
    }

    setNodes(courseNodes)
    const active = courseNodes.find(n => n.state === 'in_progress')
    setActiveNodeId(active?.id || courseNodes[0]?.id || null)
    setLoading(false)
  }, [router])

  // SYNC rule: active node must match engine recommended step
  useEffect(() => {
    if (engine.progress) {
      const step = engine.getNextStep()
      if (step?.courseId) {
        // Extract courseId without en_ prefix
        const cid = step.courseId.replace(/^en_/, '')
        const matchNode = nodes.find(n => n.id === cid)
        if (matchNode) setActiveNodeId(cid)
      }
    }
  }, [engine, nodes])

  if (loading || !user) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#F0F0F0]">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-[#002844]" />
      </div>
    )
  }

  // Colors by state
  const stateStyles: Record<NodeState, { bg: string; border: string; text: string }> = {
    completed: { bg: 'bg-green-500', border: 'border-green-500', text: 'text-white' },
    in_progress: { bg: 'bg-[#002844]', border: 'border-[#D9B438]', text: 'text-white' },
    unlocked: { bg: 'bg-white', border: 'border-gray-300', text: 'text-[#002844]' },
    locked: { bg: 'bg-gray-200', border: 'border-gray-300', text: 'text-gray-400' },
  }

  // Group nodes by block for block headers
  let lastBlock = -1

  return (
    <div className="min-h-screen bg-[#F0F0F0] pb-20">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-[#002844] px-4 py-3 flex items-center justify-between">
        <button onClick={() => router.push('/dashboard')} className="text-white font-bold text-sm">← {lang === 'fr' ? 'Accueil' : 'Home'}</button>
        <h1 className="text-sm font-bold text-white">{lang === 'fr' ? 'Mon parcours' : 'My path'}</h1>
        <div className="w-12" />
      </div>

      {/* Parcours vertical */}
      <main className="px-6 pt-6 max-w-lg mx-auto">
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-300" />

          {nodes.map((node, idx) => {
            const style = stateStyles[node.state]
            const isActive = node.id === activeNodeId
            const showBlockHeader = node.blockIndex !== lastBlock
            if (showBlockHeader) lastBlock = node.blockIndex

            return (
              <div key={node.id}>
                {/* Block header */}
                {showBlockHeader && (
                  <div className="relative pl-14 mb-2 mt-4">
                    <p className="text-[10px] font-bold text-[#D9B438] uppercase tracking-wider">
                      {lang === 'fr' ? `Bloc ${node.blockIndex}` : `Block ${node.blockIndex}`} — {lang === 'fr' ? BLOCK_NAMES_FR[node.blockIndex] : BLOCK_NAMES_EN[node.blockIndex]}
                    </p>
                  </div>
                )}

                {/* Node */}
                <div className={`relative flex items-start gap-3 mb-4 ${isActive ? 'z-10' : ''}`}>
                  {/* Circle */}
                  <div className={`relative z-10 w-12 h-12 rounded-full flex items-center justify-center border-2 flex-shrink-0 ${style.bg} ${style.border} ${
                    isActive ? 'ring-2 ring-[#D9B438] ring-offset-2 animate-pulse' : ''
                  }`}>
                    {node.state === 'completed' && <Star className="h-5 w-5 text-white" fill="white" />}
                    {node.state === 'in_progress' && <span className="text-lg">▶</span>}
                    {node.state === 'unlocked' && <span className="text-sm font-bold text-[#002844]">{idx + 1}</span>}
                    {node.state === 'locked' && <Lock className="h-4 w-4 text-gray-400" />}
                  </div>

                  {/* Content */}
                  <div className={`flex-1 rounded-xl p-3 ${
                    isActive ? 'bg-white shadow-lg border-2 border-[#D9B438]'
                      : node.state === 'completed' ? 'bg-green-50'
                      : node.state === 'unlocked' ? 'bg-white shadow-sm'
                      : 'bg-gray-100'
                  }`}>
                    <div className="flex items-center justify-between">
                      <p className={`text-sm font-bold ${node.state === 'locked' ? 'text-gray-400' : 'text-[#002844]'}`}>
                        {node.isCheckpoint ? `🏆 ${node.title}` : node.title}
                      </p>
                      {node.state === 'completed' && (
                        <div className="flex gap-0.5">
                          {[1, 2, 3].map(s => (
                            <Star key={s} className={`h-3.5 w-3.5 ${s <= node.stars ? 'text-[#D9B438]' : 'text-gray-300'}`}
                              fill={s <= node.stars ? '#D9B438' : 'none'} />
                          ))}
                        </div>
                      )}
                    </div>

                    {!node.isCheckpoint && node.state !== 'locked' && (
                      <p className="text-[10px] text-[#555] mt-0.5">
                        📚 {node.vocabCount} {lang === 'fr' ? 'mots' : 'words'}
                        {node.hasRule && ` · 1 ${lang === 'fr' ? 'règle' : 'rule'}`}
                        {` · ⏱ ${node.estimatedMin} min`}
                      </p>
                    )}

                    {/* CTA for active node */}
                    {isActive && node.state === 'in_progress' && (
                      <a href={`/session?courseId=${node.id}`}
                        className="mt-2 flex items-center justify-center gap-2 bg-[#002844] text-white py-2 rounded-lg text-xs font-bold active:scale-95 transition-transform">
                        {lang === 'fr' ? 'Commencer' : 'Start'}
                        <ChevronRight className="h-3.5 w-3.5" />
                      </a>
                    )}

                    {node.state === 'completed' && (
                      <p className="text-[10px] text-green-600 font-bold mt-0.5">✓ {node.score}%</p>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </main>

      <BottomNav lang={lang} />
    </div>
  )
}
