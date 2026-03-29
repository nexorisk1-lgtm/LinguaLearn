'use client'

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { getCurrentUser } from '@/lib/db/localStorage'
import { User, InterfaceLanguage } from '@/types'
import PageHeader from '@/components/PageHeader'
import BottomNav from '@/components/BottomNav'
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { Volume2, Search, Filter } from 'lucide-react'
import { getA1CourseVocabulary, getA1CourseData, BANK_A1_COURSES } from '@/lib/db/bankA1Courses'

interface LearnedWord {
  id: string
  word: string
  trad: string
  phonetic: string
  example_en: string
  example_fr: string
  image: string
  courseId: string
  courseTitle: string
  status: 'mastered' | 'learned' | 'fragile' | 'to_review'
  nextReview: string | null
}

function getWordStatus(wordId: string, userId: string, lang: string): { status: LearnedWord['status']; nextReview: string | null } {
  try {
    // Check word states from engine
    const wsKey = `lingualearn_word_states_${userId}_${lang}`
    const wordStates = JSON.parse(localStorage.getItem(wsKey) || '{}')
    const state = wordStates[wordId]

    // Check SRS review data
    const reviewKey = `lingualearn_review_items_${userId}_${lang}`
    const reviews: any[] = JSON.parse(localStorage.getItem(reviewKey) || '[]')
    const reviewItem = reviews.find((r: any) => r.wordId === wordId || r.id === wordId)

    let nextReview: string | null = null
    if (reviewItem?.nextReview) {
      nextReview = new Date(reviewItem.nextReview).toLocaleDateString('fr-FR')
    }

    if (state === 'mastered') return { status: 'mastered', nextReview }
    if (state === 'learned') {
      // Check if fragile (reviewed recently with difficulty)
      if (reviewItem && reviewItem.score !== undefined && reviewItem.score < 0.7) {
        return { status: 'fragile', nextReview }
      }
      return { status: 'learned', nextReview }
    }
    // If we know the word exists in completed courses but no state = to_review
    return { status: 'to_review', nextReview }
  } catch {
    return { status: 'to_review', nextReview: null }
  }
}

export default function MotsApprisPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [lang, setLang] = useState<InterfaceLanguage>('fr')
  const [loading, setLoading] = useState(true)
  const [words, setWords] = useState<LearnedWord[]>([])
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'mastered' | 'learned' | 'fragile' | 'to_review'>('all')

  // TTS
  const speakText = useCallback((text: string, speechLang: string = 'en') => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return
    window.speechSynthesis.cancel()
    const utter = new SpeechSynthesisUtterance(text)
    utter.lang = speechLang === 'en' ? 'en-US' : 'fr-FR'
    utter.rate = 0.85
    window.speechSynthesis.speak(utter)
  }, [])

  useEffect(() => {
    const currentUser = getCurrentUser()
    if (!currentUser) { router.push('/auth'); return }
    setUser(currentUser)
    setLang(currentUser.settings.interfaceLang || 'fr')

    const aLang = currentUser.activeLang || currentUser.settings.learningLangs[0] || 'en'
    const scoreKey = `lingualearn_course_scores_${currentUser.id}_${aLang}`
    const scores: Record<string, any> = (() => { try { return JSON.parse(localStorage.getItem(scoreKey) || '{}') } catch { return {} } })()
    const completedCourseIds = Object.keys(scores).filter(id => scores[id]?.score >= 60)

    const allWords: LearnedWord[] = []
    for (const cid of completedCourseIds) {
      const vocab = getA1CourseVocabulary(cid)
      const courseData = getA1CourseData(cid)
      const courseTitle = courseData?.title || cid

      for (const v of vocab) {
        const { status, nextReview } = getWordStatus(v.id, currentUser.id, aLang)
        allWords.push({
          id: v.id,
          word: v.word_target,
          trad: v.word_fr,
          phonetic: v.phonetic || '',
          example_en: v.example_en || '',
          example_fr: v.example_fr || '',
          image: v.image || '',
          courseId: cid,
          courseTitle,
          status,
          nextReview,
        })
      }
    }

    setWords(allWords)
    setLoading(false)
  }, [router])

  if (loading || !user) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#F0F0F0]">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-[#002844]" />
      </div>
    )
  }

  const statusConfig: Record<string, { label: string; labelEn: string; icon: string; color: string; bg: string }> = {
    mastered: { label: 'Acquis', labelEn: 'Mastered', icon: '✅', color: 'text-green-700', bg: 'bg-green-50 border-green-200' },
    learned: { label: 'Appris', labelEn: 'Learned', icon: '✅', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
    fragile: { label: 'Fragile', labelEn: 'Fragile', icon: '⚠️', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
    to_review: { label: 'À réviser', labelEn: 'To review', icon: '🔄', color: 'text-red-700', bg: 'bg-red-50 border-red-200' },
  }

  // Filter & search
  const filtered = words.filter(w => {
    if (filter !== 'all' && w.status !== filter) return false
    if (search) {
      const s = search.toLowerCase()
      return w.word.toLowerCase().includes(s) || w.trad.toLowerCase().includes(s)
    }
    return true
  })

  // Stats
  const stats = {
    total: words.length,
    mastered: words.filter(w => w.status === 'mastered').length,
    learned: words.filter(w => w.status === 'learned').length,
    fragile: words.filter(w => w.status === 'fragile').length,
    toReview: words.filter(w => w.status === 'to_review').length,
  }

  // Emoji mapping for words without images
  const getWordEmoji = (word: string): string => {
    const w = word.toLowerCase()
    const map: Record<string, string> = {
      'hello': '👋', 'hi': '👋', 'goodbye': '👋', 'good morning': '🌅', 'good evening': '🌇',
      'thank you': '🙏', 'thanks': '🙏', 'please': '🤲', 'sorry': '😔', 'welcome': '🤗',
      'food': '🍽️', 'water': '💧', 'coffee': '☕', 'house': '🏠', 'school': '🏫',
      'car': '🚗', 'phone': '📱', 'book': '📖', 'family': '👨‍👩‍👧‍👦', 'friend': '🤝',
      'happy': '😊', 'sad': '😢', 'hot': '🔥', 'cold': '🥶', 'big': '🐘', 'small': '🐜',
      'dog': '🐕', 'cat': '🐈', 'sun': '☀️', 'rain': '🌧️', 'love': '❤️', 'music': '🎵',
    }
    if (map[w]) return map[w]
    const partial = Object.keys(map).find(k => w.includes(k) || k.includes(w))
    return partial ? map[partial] : '📝'
  }

  return (
    <div className="min-h-screen bg-[#F0F0F0] pb-20">
      <PageHeader title={lang === 'fr' ? 'Mots appris' : 'Learned words'} backHref="/dashboard" />

      <main className="px-4 pt-4 max-w-lg mx-auto">
        {/* Stats bar */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          {[
            { key: 'mastered', count: stats.mastered },
            { key: 'learned', count: stats.learned },
            { key: 'fragile', count: stats.fragile },
            { key: 'to_review', count: stats.toReview },
          ].map(s => {
            const cfg = statusConfig[s.key]
            return (
              <button
                key={s.key}
                onClick={() => setFilter(filter === s.key as any ? 'all' : s.key as any)}
                className={`p-2 rounded-xl border text-center transition-all ${
                  filter === s.key ? `${cfg.bg} border-2` : 'bg-white border-gray-200'
                }`}
              >
                <span className="text-lg block">{cfg.icon}</span>
                <span className="text-lg font-bold block text-[#002844]">{s.count}</span>
                <span className="text-[10px] block text-[#555]">{lang === 'fr' ? cfg.label : cfg.labelEn}</span>
              </button>
            )
          })}
        </div>

        {/* Total */}
        <p className="text-center text-sm text-[#555] mb-3">
          {stats.total} {lang === 'fr' ? 'mots au total' : 'total words'}
          {' — '}
          {BANK_A1_COURSES.length * 7} {lang === 'fr' ? 'mots A1' : 'A1 words'}
        </p>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#888]" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={lang === 'fr' ? 'Rechercher un mot...' : 'Search a word...'}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm text-[#002844] bg-white focus:outline-none focus:border-[#D9B438]"
          />
        </div>

        {/* Word list */}
        {filtered.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl shadow-sm">
            <span className="text-5xl block mb-3">📚</span>
            <p className="text-[#555] text-sm">
              {words.length === 0
                ? (lang === 'fr' ? 'Termine un cours pour voir tes mots ici !' : 'Complete a course to see your words here!')
                : (lang === 'fr' ? 'Aucun mot trouvé' : 'No words found')}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(w => {
              const cfg = statusConfig[w.status]
              return (
                <div key={w.id} className={`rounded-xl border p-3 ${cfg.bg} transition-all`}>
                  <div className="flex items-start gap-3">
                    {/* Image or emoji */}
                    <div className="w-12 h-12 rounded-lg flex items-center justify-center bg-white shadow-sm flex-shrink-0">
                      {w.image && !w.image.startsWith('data:') ? (
                        <span className="text-2xl">{getWordEmoji(w.word)}</span>
                      ) : w.image ? (
                        <img src={w.image} alt={w.word} className="w-12 h-12 rounded-lg object-cover" />
                      ) : (
                        <span className="text-2xl">{getWordEmoji(w.word)}</span>
                      )}
                    </div>

                    {/* Word info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[#002844] text-base">{w.word}</span>
                        <button onClick={() => speakText(w.word, 'en')} className="p-1 rounded-full hover:bg-white/50">
                          <Volume2 className="h-3.5 w-3.5 text-[#002844]" />
                        </button>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${cfg.color} bg-white/60`}>
                          {cfg.icon} {lang === 'fr' ? cfg.label : cfg.labelEn}
                        </span>
                      </div>
                      <p className="text-sm text-[#555]">{w.trad}</p>
                      {w.phonetic && <p className="text-xs text-[#888] italic">/{w.phonetic}/</p>}
                      {w.example_en && (
                        <p className="text-xs text-[#555] mt-1 italic truncate">
                          &ldquo;{w.example_en}&rdquo;
                        </p>
                      )}
                      {w.nextReview && (
                        <p className="text-[10px] text-[#888] mt-1">
                          📅 {lang === 'fr' ? `Prochaine révision : ${w.nextReview}` : `Next review: ${w.nextReview}`}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>

      <BottomNav lang={lang} />
    </div>
  )
}
