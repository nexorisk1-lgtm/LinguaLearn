'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getCurrentUser } from '@/lib/db/localStorage'
import { User, InterfaceLanguage } from '@/types'
import { BANK_A1_COURSES, getA1CourseData } from '@/lib/db/bankA1Courses'
import BottomNav from '@/components/BottomNav'
import { useEngine } from '@/lib/engine/useEngine'
import { Lock, Star, ChevronRight, Check } from 'lucide-react'

type NodeState = 'completed' | 'in_progress' | 'unlocked' | 'locked'
type NodeType = 'course' | 'checkpoint' | 'test_final'

interface CourseNode {
  id: string
  type: NodeType
  title: string
  vocabCount: number
  hasRule: boolean
  estimatedMin: number
  state: NodeState
  stars: number
  score: number
  courseNumber: number // 1-40 for courses, special for checkpoints/test
  blockIndex: number
}

// Block definitions
const BLOCK_NAMES_FR = ['Communication', 'Présentation', 'Vie quotidienne', 'Mon monde', 'Je communique', 'Je voyage']
const BLOCK_NAMES_EN = ['Communication', 'Introduction', 'Daily life', 'My world', 'Communication', 'Travel']

const CHECKPOINT_POSITIONS = [5, 10, 15, 20, 25, 30, 35] // After these course numbers

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
    const allNodes: CourseNode[] = []
    let foundActive = false
    let currentBlock = 0
    let courseCount = 0

    for (const course of BANK_A1_COURSES) {
      courseCount++
      const data = getA1CourseData(course.id)
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
      } else if (allNodes.length > 0) {
        const lastNonCheckpoint = allNodes.filter(n => n.type === 'course').pop()
        if (lastNonCheckpoint && lastNonCheckpoint.state !== 'locked') {
          state = 'unlocked'
        }
      }

      allNodes.push({
        id: course.id,
        type: 'course',
        title: data?.title || course.id,
        vocabCount,
        hasRule,
        estimatedMin: Math.round((vocabCount * 0.5) + (hasRule ? 1 : 0) + 1),
        state,
        stars,
        score: courseScore,
        courseNumber: courseCount,
        blockIndex: Math.min(currentBlock, 5),
      })

      // Add checkpoint after specific courses
      if (CHECKPOINT_POSITIONS.includes(courseCount)) {
        const blockNum = Math.floor((courseCount - 1) / 8) + 1
        const checkpointId = `checkpoint_${courseCount}`

        // Checkpoint is locked until all previous courses are completed
        let cpState: NodeState = 'locked'
        const allPrevCompleted = allNodes.every(n => n.state === 'completed' || n.state === 'in_progress')
        const lastCourseCompleted = allNodes[allNodes.length - 1]?.state === 'completed'

        if (lastCourseCompleted) {
          cpState = 'completed'
        } else if (allPrevCompleted && allNodes[allNodes.length - 1]?.state !== 'locked') {
          cpState = 'unlocked'
        }

        allNodes.push({
          id: checkpointId,
          type: 'checkpoint',
          title: `${lang === 'fr' ? 'Checkpoint' : 'Checkpoint'} ${lang === 'fr' ? 'bloc' : 'block'} ${blockNum}`,
          vocabCount: 0,
          hasRule: false,
          estimatedMin: 10,
          state: cpState,
          stars: 0,
          score: 0,
          courseNumber: courseCount,
          blockIndex: Math.min(blockIdx, 5),
        })
      }
    }

    // Add Test Final A1 after all courses
    const allCoursesCompleted = allNodes
      .filter(n => n.type === 'course')
      .every(n => n.state === 'completed')
    const allCheckpointsCompleted = allNodes
      .filter(n => n.type === 'checkpoint')
      .every(n => n.state === 'completed')

    let testState: NodeState = 'locked'
    if (allCoursesCompleted && allCheckpointsCompleted) {
      testState = 'completed'
    } else if (
      allNodes
        .filter(n => n.type === 'course')
        .some(n => n.state === 'completed') &&
      allNodes
        .filter(n => n.type === 'checkpoint')
        .some(n => n.state !== 'locked')
    ) {
      testState = 'unlocked'
    }

    allNodes.push({
      id: 'test_final_a1',
      type: 'test_final',
      title: 'Test Final A1',
      vocabCount: 0,
      hasRule: false,
      estimatedMin: 45,
      state: testState,
      stars: 0,
      score: 0,
      courseNumber: 41,
      blockIndex: 5,
    })

    // If no active found, first node is active
    if (!foundActive && allNodes.length > 0) {
      allNodes[0].state = 'in_progress'
    }

    setNodes(allNodes)
    const active = allNodes.find(n => n.state === 'in_progress')
    setActiveNodeId(active?.id || allNodes[0]?.id || null)
    setLoading(false)
  }, [router, lang])

  // SYNC rule: active node must match engine recommended step
  useEffect(() => {
    if (engine.progress) {
      const step = engine.getNextStep()
      if (step?.courseId) {
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
  const stateStyles: Record<NodeState, { bg: string; border: string; text: string; ring: string }> = {
    completed: { bg: 'bg-green-500', border: 'border-green-500', text: 'text-white', ring: 'ring-green-500' },
    in_progress: { bg: 'bg-[#002844]', border: 'border-[#002844]', text: 'text-white', ring: 'ring-[#D9B438]' },
    unlocked: { bg: 'bg-white', border: 'border-gray-300', text: 'text-[#002844]', ring: 'ring-gray-300' },
    locked: { bg: 'bg-gray-300', border: 'border-gray-300', text: 'text-gray-500', ring: 'ring-gray-300' },
  }

  let lastBlock = -1
  let position = 'left' // Alternating left/right

  return (
    <div className="min-h-screen bg-[#F0F0F0] pb-20">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-[#002844] px-4 py-3 flex items-center justify-between">
        <button onClick={() => router.push('/dashboard')} className="text-white font-bold text-sm">← {lang === 'fr' ? 'Accueil' : 'Home'}</button>
        <h1 className="text-sm font-bold text-white">{lang === 'fr' ? 'Mon parcours' : 'My path'}</h1>
        <div className="w-12" />
      </div>

      {/* Parcours vertical with zigzag layout */}
      <main className="px-4 pt-6 max-w-4xl mx-auto">
        <div className="relative">
          {/* Vertical connecting line */}
          <div className="absolute left-1/2 top-0 bottom-0 w-1 bg-gradient-to-b from-gray-200 via-gray-300 to-gray-200 transform -translate-x-1/2" />

          {nodes.map((node) => {
            const style = stateStyles[node.state]
            const isActive = node.id === activeNodeId
            const showBlockHeader = node.type === 'course' && node.blockIndex !== lastBlock
            if (node.type === 'course' && showBlockHeader) lastBlock = node.blockIndex

            // Alternate position for visual interest
            const isLeft = position === 'left'
            if (node.type === 'course') {
              position = position === 'left' ? 'right' : 'left'
            }

            return (
              <div key={node.id}>
                {/* Block header */}
                {showBlockHeader && (
                  <div className="relative mb-4 mt-6 flex justify-center">
                    <p className="inline-block px-3 py-1 text-[11px] font-bold text-white bg-[#002844] rounded-full uppercase tracking-widest">
                      {lang === 'fr' ? `Bloc ${node.blockIndex}` : `Block ${node.blockIndex}`} — {lang === 'fr' ? BLOCK_NAMES_FR[node.blockIndex] : BLOCK_NAMES_EN[node.blockIndex]}
                    </p>
                  </div>
                )}

                {/* Node container with zigzag layout */}
                <div className={`relative flex items-center gap-4 mb-8 ${isLeft ? 'flex-row' : 'flex-row-reverse'}`}>
                  {/* Left/Right spacer */}
                  <div className="flex-1" />

                  {/* Circle node */}
                  <div className="relative z-10 flex-shrink-0">
                    {node.type === 'course' && (
                      <CourseNodeCircle
                        node={node}
                        style={style}
                        isActive={isActive}
                      />
                    )}
                    {node.type === 'checkpoint' && (
                      <CheckpointNodeCircle
                        node={node}
                        isActive={isActive}
                      />
                    )}
                    {node.type === 'test_final' && (
                      <TestFinalNodeCircle
                        node={node}
                        isActive={isActive}
                      />
                    )}
                  </div>

                  {/* Right/Left spacer */}
                  <div className="flex-1" />
                </div>

                {/* Content card below node */}
                <div className={`relative mb-6 ${isLeft ? 'ml-0 mr-auto' : 'ml-auto mr-0'} max-w-xs`}>
                  {node.type === 'course' && (
                    <CourseNodeContent
                      node={node}
                      isActive={isActive}
                      lang={lang}
                    />
                  )}
                  {node.type === 'checkpoint' && (
                    <CheckpointNodeContent
                      node={node}
                      isActive={isActive}
                      lang={lang}
                    />
                  )}
                  {node.type === 'test_final' && (
                    <TestFinalNodeContent
                      node={node}
                      isActive={isActive}
                      lang={lang}
                    />
                  )}
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

// Course Node Circle Component
function CourseNodeCircle({
  node,
  style,
  isActive,
}: {
  node: CourseNode
  style: Record<NodeState, { bg: string; border: string; text: string; ring: string }>[NodeState]
  isActive: boolean
}) {
  return (
    <div
      className={`
        relative w-14 h-14 rounded-full flex items-center justify-center font-bold text-lg
        border-2 flex-shrink-0
        ${style.bg} ${style.border} ${style.text}
        ${isActive ? `ring-4 ${style.ring} ring-offset-2 animate-pulse` : ''}
        transition-all duration-300
      `}
    >
      {node.state === 'completed' && (
        <Check className="h-7 w-7 text-white" strokeWidth={3} />
      )}
      {node.state === 'in_progress' && (
        <span className="text-white text-xl">▶</span>
      )}
      {node.state === 'unlocked' && (
        <span className="text-[#002844] font-bold">{node.courseNumber}</span>
      )}
      {node.state === 'locked' && (
        <Lock className="h-5 w-5 text-gray-500" />
      )}
    </div>
  )
}

// Checkpoint Node Circle (Diamond-like shape using rotated square)
function CheckpointNodeCircle({
  node,
  isActive,
}: {
  node: CourseNode
  isActive: boolean
}) {
  const style = {
    completed: 'bg-purple-500 border-purple-500',
    in_progress: 'bg-indigo-600 border-indigo-600',
    unlocked: 'bg-purple-100 border-purple-300',
    locked: 'bg-gray-300 border-gray-300',
  }[node.state]

  const textColor = {
    completed: 'text-white',
    in_progress: 'text-white',
    unlocked: 'text-purple-700',
    locked: 'text-gray-500',
  }[node.state]

  return (
    <div
      className={`
        relative w-16 h-16 flex items-center justify-center font-bold text-lg
        border-2 flex-shrink-0 transform rotate-45
        ${style} ${textColor}
        ${isActive ? 'ring-4 ring-purple-500 ring-offset-2 animate-pulse' : ''}
        transition-all duration-300
      `}
    >
      <div className="transform -rotate-45 text-2xl">
        {node.state === 'completed' && '🏁'}
        {node.state !== 'completed' && '🏁'}
      </div>
    </div>
  )
}

// Test Final A1 Node (Large gold star)
function TestFinalNodeCircle({
  node,
  isActive,
}: {
  node: CourseNode
  isActive: boolean
}) {
  const style = {
    completed: 'bg-yellow-400 border-yellow-500',
    in_progress: 'bg-yellow-500 border-yellow-600',
    unlocked: 'bg-yellow-50 border-yellow-300',
    locked: 'bg-gray-300 border-gray-300',
  }[node.state]

  const textColor = {
    completed: 'text-white',
    in_progress: 'text-white',
    unlocked: 'text-yellow-700',
    locked: 'text-gray-500',
  }[node.state]

  return (
    <div
      className={`
        relative w-20 h-20 rounded-full flex items-center justify-center font-bold text-4xl
        border-3 flex-shrink-0
        ${style} ${textColor}
        shadow-lg
        ${isActive ? 'ring-4 ring-yellow-500 ring-offset-2 animate-pulse' : ''}
        transition-all duration-300
      `}
    >
      {node.state === 'completed' && '👑'}
      {node.state === 'in_progress' && '👑'}
      {node.state === 'unlocked' && '👑'}
      {node.state === 'locked' && '🔒'}
    </div>
  )
}

// Course Node Content Card
function CourseNodeContent({
  node,
  isActive,
  lang,
}: {
  node: CourseNode
  isActive: boolean
  lang: InterfaceLanguage
}) {
  return (
    <div
      className={`
        rounded-xl p-4 border-2
        ${isActive
          ? 'bg-white border-[#D9B438] shadow-xl'
          : node.state === 'completed'
            ? 'bg-green-50 border-green-200'
            : node.state === 'unlocked'
              ? 'bg-white border-gray-200 shadow-sm'
              : 'bg-gray-100 border-gray-200'
        }
        transition-all duration-300
      `}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className={`text-sm font-bold flex-1 ${node.state === 'locked' ? 'text-gray-400' : 'text-[#002844]'}`}>
          {lang === 'fr' ? 'Cours' : 'Course'} {node.courseNumber}
        </p>
        {node.state === 'completed' && (
          <div className="flex gap-1">
            {[1, 2, 3].map(s => (
              <Star
                key={s}
                className={`h-3.5 w-3.5 ${s <= node.stars ? 'text-[#D9B438]' : 'text-gray-300'}`}
                fill={s <= node.stars ? '#D9B438' : 'none'}
              />
            ))}
          </div>
        )}
      </div>

      <p className={`text-xs font-semibold mb-1 ${node.state === 'locked' ? 'text-gray-400' : 'text-[#002844]'}`}>
        {node.title}
      </p>

      {node.state !== 'locked' && (
        <p className="text-[10px] text-gray-600 mb-2">
          📚 {node.vocabCount} {lang === 'fr' ? 'mots' : 'words'}
          {node.hasRule && ` · 1 ${lang === 'fr' ? 'règle' : 'rule'}`}
          {` · ⏱ ${node.estimatedMin} min`}
        </p>
      )}

      {isActive && node.state === 'in_progress' && (
        <a
          href={`/session?courseId=${node.id}`}
          className="mt-3 flex items-center justify-center gap-2 bg-[#002844] text-white py-2 px-3 rounded-lg text-xs font-bold active:scale-95 transition-transform hover:bg-[#003a5a]"
        >
          {lang === 'fr' ? 'Commencer' : 'Start'}
          <ChevronRight className="h-3.5 w-3.5" />
        </a>
      )}

      {node.state === 'completed' && (
        <p className="text-[10px] text-green-600 font-bold">✓ {node.score}%</p>
      )}
    </div>
  )
}

// Checkpoint Node Content Card
function CheckpointNodeContent({
  node,
  isActive,
  lang,
}: {
  node: CourseNode
  isActive: boolean
  lang: InterfaceLanguage
}) {
  return (
    <div
      className={`
        rounded-xl p-4 border-2 bg-purple-50
        ${isActive ? 'border-purple-500 shadow-xl' : 'border-purple-200 shadow-sm'}
        transition-all duration-300
      `}
    >
      <p className={`text-xs font-bold uppercase tracking-wide ${isActive ? 'text-purple-700' : 'text-purple-600'} mb-1`}>
        🏁 {lang === 'fr' ? 'Checkpoint' : 'Checkpoint'}
      </p>
      <p className={`text-sm font-bold ${node.state === 'locked' ? 'text-purple-400' : 'text-purple-800'}`}>
        {node.title}
      </p>
      <p className="text-[10px] text-purple-600 mt-1">
        {node.state === 'locked'
          ? lang === 'fr'
            ? 'Complétez les cours précédents pour accéder'
            : 'Complete previous courses to access'
          : lang === 'fr'
            ? '✓ Débloqué'
            : '✓ Unlocked'}
      </p>
    </div>
  )
}

// Test Final A1 Content Card
function TestFinalNodeContent({
  node,
  isActive,
  lang,
}: {
  node: CourseNode
  isActive: boolean
  lang: InterfaceLanguage
}) {
  return (
    <div
      className={`
        rounded-xl p-4 border-3 bg-yellow-50
        ${isActive ? 'border-yellow-500 shadow-xl' : 'border-yellow-200 shadow-sm'}
        transition-all duration-300
      `}
    >
      <p className={`text-xs font-bold uppercase tracking-wider ${isActive ? 'text-yellow-700' : 'text-yellow-600'} mb-1`}>
        👑 {lang === 'fr' ? 'Certification CECRL' : 'CECRL Certification'}
      </p>
      <p className={`text-sm font-bold ${node.state === 'locked' ? 'text-yellow-500' : 'text-yellow-900'}`}>
        {lang === 'fr' ? 'Test Final A1' : 'Final A1 Test'}
      </p>
      <p className="text-[10px] text-yellow-700 mt-1">
        {node.state === 'locked'
          ? lang === 'fr'
            ? 'Complétez tous les cours et checkpoints'
            : 'Complete all courses and checkpoints'
          : lang === 'fr'
            ? '✓ Prêt pour la certification'
            : '✓ Ready for certification'}
      </p>
      {isActive && node.state === 'in_progress' && (
        <a
          href={`/session?courseId=${node.id}`}
          className="mt-3 flex items-center justify-center gap-2 bg-yellow-600 text-white py-2 px-3 rounded-lg text-xs font-bold active:scale-95 transition-transform hover:bg-yellow-700"
        >
          {lang === 'fr' ? 'Commencer l\'examen' : 'Start Exam'}
          <ChevronRight className="h-3.5 w-3.5" />
        </a>
      )}
    </div>
  )
}
