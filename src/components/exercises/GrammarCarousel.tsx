'use client'

import { useState, useEffect, useCallback } from 'react'
import { InterfaceLanguage, User } from '@/types'
import { GrammarRule } from '@/lib/db/bankTypes'
import { Lock, Star, Trophy } from 'lucide-react'

interface GrammarCarouselProps {
  rules: GrammarRule[]
  user: User
  activeLang: string
  lang: InterfaceLanguage
  onSelectRule: (ruleId: string) => void
}

interface ProgressState {
  stars: number
  bestScore: number
}

const createCheckpointItems = (rules: GrammarRule[]) => {
  const items: Array<{ type: 'rule' | 'checkpoint' | 'certificate'; rule?: GrammarRule; index?: number }> = []

  rules.forEach((rule, idx) => {
    items.push({ type: 'rule', rule, index: idx })

    // Add checkpoint every 3-4 rules
    if ((idx + 1) % 4 === 0) {
      items.push({ type: 'checkpoint', index: idx })
    }
  })

  // Add certificate at the end
  items.push({ type: 'certificate', index: rules.length })

  return items
}

export default function GrammarCarousel({
  rules,
  user,
  activeLang,
  lang,
  onSelectRule,
}: GrammarCarouselProps) {
  const [progress, setProgress] = useState<Record<string, ProgressState>>({})
  const scrollRef = useCallback((node: HTMLDivElement | null) => {
    if (node) { /* ref attached for future scroll features */ }
  }, [])

  useEffect(() => {
    // Load progress from localStorage
    const storageKey = `lingualearn_grammar_stars_${user.id}_${activeLang}`
    const stored = localStorage.getItem(storageKey)
    if (stored) {
      try {
        setProgress(JSON.parse(stored))
      } catch {
        setProgress({})
      }
    }
  }, [user.id, activeLang])

  const items = createCheckpointItems(rules)

  const handleRuleClick = (rule: GrammarRule) => {
    onSelectRule(rule.id)
  }

  return (
    <div className="w-full">
      {/* Carousel scroll container */}
      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto pb-4 px-4 scroll-smooth hide-scrollbar"
        style={{ scrollBehavior: 'smooth' }}
      >
        {items.map((item, idx) => {
          if (item.type === 'rule' && item.rule) {
            const rule = item.rule
            const ruleProgress = progress[rule.id]
            const stars = ruleProgress?.stars || 0
            const ruleIndex = item.index ?? 0
            const prevRule = ruleIndex > 0 ? rules[ruleIndex - 1] : null
            // Rule 0 is always unlocked. For index > 0, check if previous rule has at least 1 star
            const isPrevLocked = ruleIndex > 0 && prevRule && (!progress[prevRule.id] || progress[prevRule.id].stars < 1)

            return (
              <button
                key={rule.id}
                onClick={() => !isPrevLocked && handleRuleClick(rule)}
                disabled={isPrevLocked || false}
                className={`flex-shrink-0 w-28 h-32 rounded-2xl flex flex-col items-center justify-center p-3 text-center transition-all ${
                  isPrevLocked
                    ? 'bg-[#D9D9D9] opacity-50 cursor-not-allowed'
                    : 'bg-white shadow-sm hover:shadow-md active:scale-95 cursor-pointer border border-[#D9D9D9]'
                }`}
              >
                {isPrevLocked && (
                  <Lock className="h-5 w-5 text-[#999999] mb-2" />
                )}
                <p className="text-xs font-bold text-[#002844] line-clamp-2 mb-2">
                  {rule.rule_name}
                </p>
                {!isPrevLocked && (
                  <div className="flex gap-0.5">
                    {[1, 2, 3].map((s) => (
                      <Star
                        key={s}
                        className={`h-4 w-4 ${
                          s <= stars ? 'text-[#D9B438] fill-[#D9B438]' : 'text-[#D9D9D9]'
                        }`}
                      />
                    ))}
                  </div>
                )}
              </button>
            )
          } else if (item.type === 'checkpoint') {
            return (
              <div
                key={`checkpoint_${idx}`}
                className="flex-shrink-0 w-28 h-32 rounded-2xl flex flex-col items-center justify-center p-3 bg-gradient-to-br from-[#F59E0B] to-[#D9B438] shadow-sm"
              >
                <Trophy className="h-6 w-6 text-white mb-2" />
                <p className="text-xs font-bold text-white text-center">
                  {lang === 'fr' ? 'Point de contrôle' : 'Checkpoint'}
                </p>
                <p className="text-[10px] text-white/80 mt-1">60%</p>
              </div>
            )
          } else if (item.type === 'certificate') {
            return (
              <div
                key="certificate"
                className="flex-shrink-0 w-28 h-32 rounded-2xl flex flex-col items-center justify-center p-3 bg-gradient-to-br from-[#10B981] to-[#059669] shadow-sm"
              >
                <Trophy className="h-6 w-6 text-white mb-2" />
                <p className="text-xs font-bold text-white text-center">
                  {lang === 'fr' ? 'Certificat' : 'Certificate'}
                </p>
              </div>
            )
          }
          return null
        })}
      </div>

      {/* Scroll hint */}
      <style>{`
        .hide-scrollbar {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  )
}
