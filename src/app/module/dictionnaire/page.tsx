'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  Volume2,
  Search,
  X,
  Plus,
} from 'lucide-react'

import { getCurrentUser } from '@/lib/db/localStorage'
import { User } from '@/types'
import { t } from '@/lib/i18n'
import {
  speakText,
  proposeWord,
} from '@/lib/db/bankHelpers'
import { BANK_VOCABULARY } from '@/lib/db/bankVocabulary'
import { VocabWord } from '@/lib/db/bankTypes'

export default function DictionnairePage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Dictionary state
  const [dictMode, setDictMode] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<VocabWord[]>([])
  const [hasSearched, setHasSearched] = useState(false)

  // Add word modal
  const [showAddWordModal, setShowAddWordModal] = useState(false)
  const [unknownWord, setUnknownWord] = useState('')
  const [addWordLoading, setAddWordLoading] = useState(false)
  const [addWordSuccess, setAddWordSuccess] = useState(false)

  // Initialize user and set dictionary mode
  useEffect(() => {
    const currentUser = getCurrentUser()
    if (!currentUser) {
      router.push('/auth')
      return
    }
    setUser(currentUser)

    const activeLang = currentUser.activeLang || currentUser.settings.learningLangs[0] || 'en'
    const langCode = activeLang.toUpperCase()
    setDictMode(`${langCode}>${langCode}`)

    setIsLoading(false)
  }, [router])

  if (isLoading || !user) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin mb-4 inline-block">
            <Search className="w-8 h-8" style={{ color: '#002844' }} />
          </div>
          <p style={{ color: '#555555' }}>{t('onboarding.loading', user?.settings.interfaceLang || 'fr')}</p>
        </div>
      </div>
    )
  }

  const interfaceLang = user.settings.interfaceLang || 'fr'
  const activeLang = user.activeLang || user.settings.learningLangs[0] || 'en'

  // Generate dictionary modes dynamically based on active language
  const getDictModes = (): string[] => {
    const langCode = activeLang.toUpperCase()
    return [`${langCode}>${langCode}`, `${langCode}>FR`, `FR>${langCode}`]
  }

  // ==========================================
  // SEARCH HANDLER
  // ==========================================

  const handleSearch = () => {
    if (!searchQuery.trim()) {
      setSearchResults([])
      setHasSearched(false)
      return
    }

    const query = searchQuery.toLowerCase()
    let results: VocabWord[] = []

    // Filter by language (search across entire BANK_VOCABULARY)
    const allLanguageVocab = BANK_VOCABULARY.filter((word) => word.language === activeLang)

    if (dictMode === `${activeLang.toUpperCase()}>${activeLang.toUpperCase()}`) {
      // Search in target language words
      results = allLanguageVocab.filter((word) =>
        word.word_target.toLowerCase().includes(query)
      )
    } else if (dictMode === `${activeLang.toUpperCase()}>FR`) {
      // Search in target language words, show French translation
      results = allLanguageVocab.filter((word) =>
        word.word_target.toLowerCase().includes(query)
      )
    } else if (dictMode === `FR>${activeLang.toUpperCase()}`) {
      // Search in French words
      results = allLanguageVocab.filter((word) =>
        word.word_fr.toLowerCase().includes(query)
      )
    }

    setSearchResults(results)
    setHasSearched(true)
  }

  const handleAddWord = async () => {
    if (!unknownWord.trim() || !user) return

    setAddWordLoading(true)
    try {
      proposeWord(user.id, {
        language: activeLang,
        word_target: unknownWord.trim(),
        word_fr: unknownWord.trim(),
        definition_en: '',
        example_en: '',
        theme: '',
        is_grc: false,
      })
      setAddWordSuccess(true)
      setTimeout(() => {
        setShowAddWordModal(false)
        setUnknownWord('')
        setAddWordSuccess(false)
      }, 1500)
    } catch (error) {
      console.error('Error proposing word:', error)
    } finally {
      setAddWordLoading(false)
    }
  }

  // ==========================================
  // RENDER WORD CARD
  // ==========================================

  const WordCard = ({ word }: { word: VocabWord }) => {
    const isLangToLang = dictMode === `${activeLang.toUpperCase()}>${activeLang.toUpperCase()}`
    const isLangToFr = dictMode === `${activeLang.toUpperCase()}>FR`
    const isFrToLang = dictMode === `FR>${activeLang.toUpperCase()}`

    return (
      <div
        className="rounded-lg border-2 p-4 transition-all hover:shadow-md"
        style={{
          borderColor: '#D9B438',
          backgroundColor: '#ffffff',
        }}
      >
        <div className="flex justify-between items-start gap-3">
          <div className="flex-1">
            {/* Target word or French word (depending on mode) */}
            <h3 className="text-lg font-bold mb-2" style={{ color: '#002844' }}>
              {isFrToLang ? word.word_fr : word.word_target}
            </h3>

            {/* Definition or translation */}
            <p className="text-sm mb-3" style={{ color: '#555555' }}>
              {isLangToLang ? word.definition_en : (isLangToFr ? word.word_fr : word.word_target)}
            </p>

            {/* Metadata: Type, Level, Theme */}
            <div className="flex flex-wrap gap-2">
              {word.type && (
                <span
                  className="text-xs font-semibold px-2 py-1 rounded"
                  style={{
                    backgroundColor: '#f0f0f0',
                    color: '#555555',
                  }}
                >
                  {word.type}
                </span>
              )}
              <span
                className="text-xs font-semibold px-2 py-1 rounded"
                style={{
                  backgroundColor: '#D9B438',
                  color: '#002844',
                }}
              >
                {word.level}
              </span>
              {word.theme && (
                <span
                  className="text-xs font-semibold px-2 py-1 rounded"
                  style={{
                    backgroundColor: '#e8f4f8',
                    color: '#002844',
                  }}
                >
                  {word.theme}
                </span>
              )}
            </div>

            {/* Phonetic (if available) */}
            {word.phonetic && (
              <p className="text-xs italic mt-2" style={{ color: '#D9B438' }}>
                /{word.phonetic}/
              </p>
            )}
          </div>

          {/* TTS Button */}
          <button
            onClick={() => speakText(isFrToLang ? word.word_fr : word.word_target, activeLang)}
            className="p-2 rounded-lg hover:opacity-80 transition-opacity flex-shrink-0"
            style={{ backgroundColor: '#D9B438' }}
            title={t('vocab.listen', interfaceLang)}
            aria-label={t('vocab.listen', interfaceLang)}
          >
            <Volume2 className="w-4 h-4" style={{ color: '#002844' }} />
          </button>
        </div>
      </div>
    )
  }

  const dictModes = getDictModes()

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* Header */}
      <header
        className="px-4 md:px-8 py-6 md:py-8"
        style={{
          backgroundColor: '#002844',
          color: '#ffffff',
        }}
      >
        <div className="flex items-center gap-4">
          <Link href="/dashboard">
            <button
              className="p-2 rounded-lg hover:opacity-80 transition-opacity"
              style={{ backgroundColor: '#D9B438' }}
              aria-label={t('module.back', interfaceLang)}
            >
              <ArrowLeft className="w-5 h-5" style={{ color: '#002844' }} />
            </button>
          </Link>
          <h1 className="text-3xl md:text-4xl font-bold">
            {interfaceLang === 'fr' ? 'Dictionnaire' : 'Dictionary'}
          </h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="px-4 md:px-8 py-8">
        {/* Mode Selection */}
        <div className="mb-8 p-6 rounded-lg border-2" style={{ borderColor: '#D9B438', backgroundColor: '#ffffff' }}>
          <p className="text-sm font-semibold mb-3" style={{ color: '#002844' }}>
            {interfaceLang === 'fr' ? 'Mode de traduction' : 'Translation mode'}
          </p>
          <div className="flex gap-4 flex-wrap">
            {dictModes.map((mode) => (
              <label key={mode} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="dictMode"
                  value={mode}
                  checked={dictMode === mode}
                  onChange={(e) => {
                    setDictMode(e.target.value)
                    setSearchQuery('')
                    setSearchResults([])
                    setHasSearched(false)
                  }}
                  className="w-4 h-4"
                  style={{ accentColor: '#D9B438' }}
                />
                <span style={{ color: '#555555', fontWeight: dictMode === mode ? '600' : '400' }}>
                  {mode}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Search Box */}
        <div className="mb-8">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSearch()
                }}
                className="w-full px-4 py-3 rounded-lg border-2"
                style={{
                  borderColor: '#D9B438',
                  color: '#002844',
                }}
                placeholder={interfaceLang === 'fr' ? 'Rechercher un mot...' : 'Search for a word...'}
              />
            </div>
            <button
              onClick={handleSearch}
              className="px-6 py-3 rounded-lg font-semibold flex items-center gap-2 hover:opacity-90 transition-opacity"
              style={{
                backgroundColor: '#D9B438',
                color: '#002844',
              }}
            >
              <Search className="w-4 h-4" />
              {t('general.search', interfaceLang) || 'Search'}
            </button>
            <button
              onClick={() => setShowAddWordModal(true)}
              className="px-6 py-3 rounded-lg font-semibold flex items-center gap-2 hover:opacity-90 transition-opacity"
              style={{
                backgroundColor: '#002844',
                color: '#ffffff',
              }}
              title={interfaceLang === 'fr' ? 'Ajouter un mot' : 'Add a word'}
            >
              <Plus className="w-4 h-4" />
              {interfaceLang === 'fr' ? 'Ajouter' : 'Add'}
            </button>
          </div>
        </div>

        {/* Search Results */}
        {hasSearched ? (
          searchResults.length > 0 ? (
            <>
              <p className="mb-6 font-semibold" style={{ color: '#555555' }}>
                {searchResults.length} {interfaceLang === 'fr' ? 'résultat(s)' : 'result(s)'}
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {searchResults.map((word) => (
                  <WordCard key={word.id} word={word} />
                ))}
              </div>
            </>
          ) : (
            <div className="text-center py-12 rounded-lg p-6" style={{ backgroundColor: '#ffffff', borderColor: '#D9B438', borderWidth: '2px' }}>
              <p style={{ color: '#555555', fontSize: '1.125rem', marginBottom: '1rem' }}>
                {interfaceLang === 'fr' ? 'Aucun résultat trouvé' : 'No results found'}
              </p>
              <button
                onClick={() => setShowAddWordModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg font-semibold hover:opacity-90 transition-opacity"
                style={{
                  backgroundColor: '#002844',
                  color: '#ffffff',
                }}
              >
                <Plus className="w-4 h-4" />
                {interfaceLang === 'fr' ? 'Proposer ce mot' : 'Propose this word'}
              </button>
            </div>
          )
        ) : (
          <div className="text-center py-12">
            <p style={{ color: '#555555', fontSize: '1rem' }}>
              {interfaceLang === 'fr'
                ? 'Commencez par sélectionner un mode et entrez un mot à rechercher'
                : 'Start by selecting a mode and enter a word to search'}
            </p>
          </div>
        )}
      </main>

      {/* Add Word Modal */}
      {showAddWordModal && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => !addWordLoading && setShowAddWordModal(false)}
            style={{ backgroundColor: 'rgba(0, 0, 0, 0.3)' }}
          />

          {/* Modal */}
          <div
            className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 rounded-lg shadow-2xl p-6 max-w-md w-full mx-4 border-2"
            style={{
              borderColor: '#D9B438',
              backgroundColor: '#ffffff',
            }}
          >
            {/* Close Button */}
            <button
              onClick={() => !addWordLoading && setShowAddWordModal(false)}
              className="absolute top-2 right-2 p-1 hover:opacity-80 transition-opacity"
              aria-label="Close"
            >
              <X className="w-5 h-5" style={{ color: '#002844' }} />
            </button>

            {/* Title */}
            <h3 className="text-xl font-bold mb-4" style={{ color: '#002844' }}>
              {interfaceLang === 'fr' ? 'Proposer un mot' : 'Propose a word'}
            </h3>

            {/* Input */}
            <input
              type="text"
              value={unknownWord}
              onChange={(e) => setUnknownWord(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !addWordLoading) handleAddWord()
              }}
              className="w-full px-4 py-3 rounded-lg border-2 mb-4"
              style={{
                borderColor: '#D9B438',
                color: '#002844',
              }}
              placeholder={interfaceLang === 'fr' ? 'Entrez le mot...' : 'Enter the word...'}
              disabled={addWordLoading}
            />

            {/* Buttons */}
            <div className="flex gap-2">
              <button
                onClick={() => setShowAddWordModal(false)}
                className="flex-1 py-2 rounded-lg font-semibold transition-opacity hover:opacity-90"
                style={{
                  backgroundColor: '#f0f0f0',
                  color: '#555555',
                }}
                disabled={addWordLoading}
              >
                {interfaceLang === 'fr' ? 'Annuler' : 'Cancel'}
              </button>
              <button
                onClick={handleAddWord}
                disabled={addWordLoading || !unknownWord.trim() || addWordSuccess}
                className="flex-1 py-2 rounded-lg font-semibold transition-opacity hover:opacity-90 disabled:opacity-60"
                style={{
                  backgroundColor: addWordSuccess ? '#4ade80' : '#002844',
                  color: '#ffffff',
                }}
              >
                {addWordSuccess
                  ? interfaceLang === 'fr'
                    ? '✓ Ajouté'
                    : '✓ Added'
                  : interfaceLang === 'fr'
                  ? 'Proposer'
                  : 'Propose'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
