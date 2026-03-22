'use client'

import { InterfaceLanguage } from '@/types'

interface WhyWrongPanelProps {
  rule: string
  userAnswer: string
  correctAnswer: string
  lang: InterfaceLanguage
  onClose: () => void
}

function generateExplanation(rule: string, correctAnswer: string, lang: InterfaceLanguage): string {
  // Mock AI explanation: combine rule name with pattern-based templates
  // In production, this would call an actual AI API

  if (lang === 'fr') {
    const ruleBase = rule.toLowerCase()

    // Template explanations based on rule keywords
    if (ruleBase.includes('passé') || ruleBase.includes('past')) {
      return `La règle "${rule}" nécessite l'utilisation du temps passé. La bonne réponse "${correctAnswer}" respecte cette conjugaison.`
    }
    if (ruleBase.includes('article')) {
      return `La règle "${rule}" spécifie l'usage des articles. La bonne réponse "${correctAnswer}" utilise l'article approprié.`
    }
    if (ruleBase.includes('verbe') || ruleBase.includes('verb')) {
      return `La règle "${rule}" gouverne la conjugaison du verbe. La bonne réponse "${correctAnswer}" applique correctement cette conjugaison.`
    }
    if (ruleBase.includes('sujet') || ruleBase.includes('subject')) {
      return `La règle "${rule}" accorde le sujet et le verbe. La bonne réponse "${correctAnswer}" respecte cet accord.`
    }
    if (ruleBase.includes('comparatif')) {
      return `La règle "${rule}" enseigne la construction du comparatif. La bonne réponse "${correctAnswer}" suit la structure correcte.`
    }

    return `La règle "${rule}" s'applique ici. La bonne réponse est "${correctAnswer}" car elle respecte les règles de grammaire énoncées.`
  } else {
    const ruleBase = rule.toLowerCase()

    if (ruleBase.includes('past') || ruleBase.includes('passé')) {
      return `The rule "${rule}" requires the use of past tense. The correct answer "${correctAnswer}" applies this conjugation properly.`
    }
    if (ruleBase.includes('article')) {
      return `The rule "${rule}" specifies article usage. The correct answer "${correctAnswer}" uses the appropriate article.`
    }
    if (ruleBase.includes('verb')) {
      return `The rule "${rule}" governs verb conjugation. The correct answer "${correctAnswer}" applies this rule correctly.`
    }
    if (ruleBase.includes('subject')) {
      return `The rule "${rule}" requires subject-verb agreement. The correct answer "${correctAnswer}" respects this agreement.`
    }
    if (ruleBase.includes('comparative')) {
      return `The rule "${rule}" teaches comparative construction. The correct answer "${correctAnswer}" follows the correct structure.`
    }

    return `The rule "${rule}" applies here. The correct answer is "${correctAnswer}" because it respects the grammatical rules stated.`
  }
}

export default function WhyWrongPanel({
  rule,
  userAnswer,
  correctAnswer,
  lang,
  onClose,
}: WhyWrongPanelProps) {
  const explanation = generateExplanation(rule, correctAnswer, lang)

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in fade-in slide-in-from-bottom-4">
        {/* Header */}
        <div className="flex items-center gap-2 mb-5">
          <span className="text-2xl">✨</span>
          <h2 className="text-lg font-bold text-[#002844]">
            {lang === 'fr' ? 'Explication' : 'Explanation'}
          </h2>
        </div>

        {/* Rule */}
        <div className="mb-5 p-4 bg-[#F0F0F0] rounded-lg">
          <p className="text-xs text-[#555555] font-semibold uppercase tracking-wide">
            {lang === 'fr' ? 'Règle appliquée:' : 'Rule applied:'}
          </p>
          <p className="text-sm font-bold text-[#002844] mt-2">{rule}</p>
        </div>

        {/* User answer (red) */}
        <div className="mb-4 p-3 bg-[#FEE2E2] rounded-lg border border-[#FCA5A5]">
          <p className="text-xs text-[#991B1B] font-semibold mb-1">
            {lang === 'fr' ? 'Ta réponse:' : 'Your answer:'}
          </p>
          <p className="text-base font-semibold text-[#991B1B]">{userAnswer}</p>
        </div>

        {/* Correct answer (green) */}
        <div className="mb-5 p-3 bg-[#ECFDF5] rounded-lg border border-[#86EFAC]">
          <p className="text-xs text-[#166534] font-semibold mb-1">
            {lang === 'fr' ? 'Réponse correcte:' : 'Correct answer:'}
          </p>
          <p className="text-base font-semibold text-[#166534]">{correctAnswer}</p>
        </div>

        {/* Explanation */}
        <div className="mb-6 p-4 bg-[#FFF9E6] rounded-lg border border-[#FFD699]">
          <p className="text-xs text-[#78350F] font-semibold uppercase tracking-wide mb-2">
            {lang === 'fr' ? 'Pourquoi?' : 'Why?'}
          </p>
          <p className="text-sm text-[#92400E] leading-relaxed">{explanation}</p>
        </div>

        {/* Close button */}
        <button
          onClick={onClose}
          className="w-full py-3 bg-[#002844] text-white font-bold rounded-lg hover:bg-[#003a5c] active:scale-95 transition-all"
        >
          {lang === 'fr' ? 'Poursuivre la leçon' : 'Continue the lesson'}
        </button>
      </div>
    </div>
  )
}
