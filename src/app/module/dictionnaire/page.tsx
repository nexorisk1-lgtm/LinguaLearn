'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Volume2, Search, BookOpen, Plus, Loader2, ArrowLeft } from 'lucide-react'
import { getCurrentUser } from '@/lib/db/localStorage'
import { User } from '@/types'
import { speakText } from '@/lib/db/bankHelpers'

// Types for Free Dictionary API response
interface DictPhonetic {
  text?: string
  audio?: string
}

interface DictDefinition {
  definition: string
  example?: string
  synonyms?: string[]
}

interface DictMeaning {
  partOfSpeech: string
  definitions: DictDefinition[]
}

interface DictEntry {
  word: string
  phonetic?: string
  phonetics: DictPhonetic[]
  meanings: DictMeaning[]
  sourceUrls?: string[]
}

// MyMemory API response type
interface MyMemoryResponse {
  responseData: {
    translatedText: string
  }
  matches: Array<{
    segment: string
    translation: string
    quality?: string
  }>
}

export default function DictionnairePage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [dictMode, setDictMode] = useState<string>('EN>EN')
  const [searchQuery, setSearchQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [results, setResults] = useState<DictEntry[] | MyMemoryResponse | null>(null)
  const [error, setError] = useState<string>('')
  const [addedWords, setAddedWords] = useState<Set<string>>(new Set())

  useEffect(() => {
    const currentUser = getCurrentUser()
    if (!currentUser) {
      router.push('/auth')
      return
    }
    setUser(currentUser)
    setDictMode('EN>EN')
    setIsLoading(false)
  }, [router])

  const interfaceLang = user?.settings?.interfaceLang || 'fr'

  const getDictModes = () => {
    return ['EN>EN', 'EN>FR', 'FR>EN']
  }

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) return
    setSearching(true)
    setError('')
    setResults(null)

    const query = searchQuery.trim().toLowerCase()

    try {
      if (dictMode === 'EN>EN') {
        // English to English: use dictionaryapi.dev
        const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(query)}`)

        if (!response.ok) {
          if (response.status === 404) {
            setError(interfaceLang === 'fr'
              ? `Le mot "${query}" n'a pas été trouvé. Vérifiez l'orthographe.`
              : `The word "${query}" was not found. Check spelling.`)
          } else {
            setError(interfaceLang === 'fr' ? 'Erreur de connexion au dictionnaire.' : 'Dictionary connection error.')
          }
          setSearching(false)
          return
        }

        const data: DictEntry[] = await response.json()
        setResults(data)
      } else if (dictMode === 'EN>FR') {
        // English to French: use MyMemory API
        const response = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(query)}&langpair=en|fr`)

        if (!response.ok) {
          setError(interfaceLang === 'fr' ? 'Erreur de connexion au dictionnaire.' : 'Dictionary connection error.')
          setSearching(false)
          return
        }

        const data: MyMemoryResponse = await response.json()

        if (!data.responseData?.translatedText) {
          setError(interfaceLang === 'fr'
            ? `Aucun résultat trouvé pour ce mot`
            : `No results found for this word`)
          setSearching(false)
          return
        }

        setResults(data)
      } else if (dictMode === 'FR>EN') {
        // French to English: use MyMemory API
        const response = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(query)}&langpair=fr|en`)

        if (!response.ok) {
          setError(interfaceLang === 'fr' ? 'Erreur de connexion au dictionnaire.' : 'Dictionary connection error.')
          setSearching(false)
          return
        }

        const data: MyMemoryResponse = await response.json()

        if (!data.responseData?.translatedText) {
          setError(interfaceLang === 'fr'
            ? `Aucun résultat trouvé pour ce mot`
            : `No results found for this word`)
          setSearching(false)
          return
        }

        setResults(data)
      }
    } catch {
      setError(interfaceLang === 'fr' ? 'Erreur réseau. Vérifiez votre connexion.' : 'Network error. Check your connection.')
    }
    setSearching(false)
  }, [searchQuery, dictMode, interfaceLang])

  const handleAddToVocab = (word: string) => {
    if (!user) return
    // Simply mark word as added (no bank lookup needed)
    setAddedWords(prev => new Set(prev).add(word.toLowerCase()))
  }

  if (isLoading || !user) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: '#002844' }} />
      </div>
    )
  }

  return (
    <div className="pb-20 px-4 pt-4">
      {/* Back button header */}
      <div className="flex items-center gap-3 mb-6">
        <a href="/dashboard" className="p-2 rounded-lg" style={{ backgroundColor: '#D9B438' }}>
          <ArrowLeft className="h-5 w-5" style={{ color: '#002844' }} />
        </a>
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#002844' }}>
            {interfaceLang === 'fr' ? 'Dictionnaire' : 'Dictionary'}
          </h1>
          <p className="text-sm mt-1" style={{ color: '#555555' }}>
            {interfaceLang === 'fr' ? 'Recherchez n\'importe quel mot' : 'Search any word'}
          </p>
        </div>
      </div>

      {/* Mode Selection - pills */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {getDictModes().map(mode => (
          <button 
            key={mode} 
            onClick={() => { 
              setDictMode(mode)
              setResults(null)
              setError('')
            }}
            className="px-4 py-2 rounded-full text-sm font-semibold transition-all"
            style={{
              backgroundColor: dictMode === mode ? '#002844' : '#F0F0F0',
              color: dictMode === mode ? '#FFFFFF' : '#555555',
            }}>
            {mode}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="flex gap-2 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: '#555555' }} />
          <input 
            type="text" 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={e => { 
              if (e.key === 'Enter') handleSearch() 
            }}
            className="w-full pl-10 pr-4 py-3 rounded-xl border-2 text-sm"
            style={{ borderColor: '#D9B438', color: '#002844' }}
            placeholder={interfaceLang === 'fr' ? 'Tapez un mot...' : 'Type a word...'}
          />
        </div>
        <button 
          onClick={handleSearch} 
          disabled={searching || !searchQuery.trim()}
          className="px-5 py-3 rounded-xl font-semibold text-sm disabled:opacity-50 transition-all"
          style={{ backgroundColor: '#D9B438', color: '#002844' }}>
          {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : (interfaceLang === 'fr' ? 'Chercher' : 'Search')}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 rounded-xl mb-6 text-center" style={{ backgroundColor: '#FFF3E0' }}>
          <p className="text-sm font-medium" style={{ color: '#E65100' }}>{error}</p>
        </div>
      )}

      {/* Results */}
      {results && (
        <div className="space-y-4">
          {dictMode === 'EN>EN' && Array.isArray(results) && results.length > 0 && (
            results.map((entry: DictEntry, idx: number) => (
              <div
                key={idx}
                className="rounded-2xl border-2 p-5 bg-white"
                style={{ borderColor: '#D9B438' }}>

                {/* Word + Phonetic + Audio */}
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h2 className="text-2xl font-bold" style={{ color: '#002844' }}>
                      {entry.word}
                    </h2>
                    {(entry.phonetic || entry.phonetics?.find(p => p.text)?.text) && (
                      <p className="text-sm italic mt-1" style={{ color: '#D9B438' }}>
                        {entry.phonetic || entry.phonetics.find(p => p.text)?.text}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => {
                      const audioUrl = entry.phonetics?.find(p => p.audio)?.audio
                      if (audioUrl) {
                        new Audio(audioUrl).play()
                      } else {
                        speakText(entry.word, 'en')
                      }
                    }}
                    className="p-3 rounded-xl flex-shrink-0 transition-all hover:opacity-80"
                    style={{ backgroundColor: '#D9B438' }}>
                    <Volume2 className="h-5 w-5" style={{ color: '#002844' }} />
                  </button>
                </div>

                {/* Meanings */}
                {entry.meanings && entry.meanings.length > 0 && (
                  <div className="mb-4 space-y-4">
                    {entry.meanings.map((meaning, mIdx) => (
                      <div key={mIdx}>
                        <span
                          className="text-xs font-bold px-3 py-1 rounded-full inline-block mb-3"
                          style={{ backgroundColor: '#F0F0F0', color: '#555555' }}>
                          {meaning.partOfSpeech}
                        </span>
                        <div className="space-y-3">
                          {meaning.definitions && meaning.definitions.length > 0 && (
                            <>
                              <div>
                                <p className="text-xs font-semibold mb-2" style={{ color: '#555555' }}>
                                  {interfaceLang === 'fr' ? 'Définitions' : 'Definitions'}:
                                </p>
                                <div className="space-y-2 ml-2">
                                  {meaning.definitions.slice(0, 3).map((def, dIdx) => (
                                    <div key={dIdx}>
                                      <p className="text-sm" style={{ color: '#002844' }}>
                                        <span className="font-semibold mr-2">{dIdx + 1}.</span>
                                        {def.definition}
                                      </p>
                                      {def.example && (
                                        <p className="text-xs italic ml-6 mt-1" style={{ color: '#555555' }}>
                                          &quot;{def.example}&quot;
                                        </p>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add to vocabulary button */}
                <button
                  onClick={() => handleAddToVocab(entry.word)}
                  disabled={addedWords.has(entry.word.toLowerCase())}
                  className="w-full mt-4 py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-60"
                  style={{
                    backgroundColor: addedWords.has(entry.word.toLowerCase()) ? '#c8e6c9' : '#002844',
                    color: addedWords.has(entry.word.toLowerCase()) ? '#2e7d32' : '#FFFFFF'
                  }}>
                  {addedWords.has(entry.word.toLowerCase()) ? (
                    <>
                      <span>✓</span>
                      {interfaceLang === 'fr' ? 'Ajouté à mon vocabulaire' : 'Added to my vocabulary'}
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4" />
                      {interfaceLang === 'fr' ? 'Ajouter à mon vocabulaire' : 'Add to my vocabulary'}
                    </>
                  )}
                </button>
              </div>
            ))
          )}

          {(dictMode === 'EN>FR' || dictMode === 'FR>EN') && !Array.isArray(results) && (
            <div className="rounded-2xl border-2 p-5 bg-white" style={{ borderColor: '#D9B438' }}>
              <h2 className="text-2xl font-bold mb-4" style={{ color: '#002844' }}>
                {searchQuery}
              </h2>
              <div className="mb-4">
                <span
                  className="text-xs font-bold px-3 py-1 rounded-full inline-block mb-3"
                  style={{ backgroundColor: '#F0F0F0', color: '#555555' }}>
                  {interfaceLang === 'fr' ? 'Traduction' : 'Translation'}
                </span>
                <p className="text-base mt-2" style={{ color: '#002844' }}>
                  {(results as MyMemoryResponse).responseData?.translatedText}
                </p>
              </div>

              {(results as MyMemoryResponse).matches && (results as MyMemoryResponse).matches.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs font-semibold mb-2" style={{ color: '#555555' }}>
                    {interfaceLang === 'fr' ? 'Exemples' : 'Examples'}:
                  </p>
                  <div className="space-y-2 ml-2">
                    {(results as MyMemoryResponse).matches.slice(0, 3).map((match, idx) => (
                      <div key={idx}>
                        <p className="text-sm" style={{ color: '#002844' }}>
                          <span className="font-semibold mr-2">{idx + 1}.</span>
                          {match.segment}
                        </p>
                        <p className="text-xs italic ml-6 mt-1" style={{ color: '#555555' }}>
                          → {match.translation}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button
                onClick={() => handleAddToVocab(searchQuery)}
                disabled={addedWords.has(searchQuery.toLowerCase())}
                className="w-full mt-4 py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-60"
                style={{
                  backgroundColor: addedWords.has(searchQuery.toLowerCase()) ? '#c8e6c9' : '#002844',
                  color: addedWords.has(searchQuery.toLowerCase()) ? '#2e7d32' : '#FFFFFF'
                }}>
                {addedWords.has(searchQuery.toLowerCase()) ? (
                  <>
                    <span>✓</span>
                    {interfaceLang === 'fr' ? 'Ajouté à mon vocabulaire' : 'Added to my vocabulary'}
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" />
                    {interfaceLang === 'fr' ? 'Ajouter à mon vocabulaire' : 'Add to my vocabulary'}
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {!results && !error && !searching && (
        <div className="text-center py-16">
          <BookOpen className="h-12 w-12 mx-auto mb-4" style={{ color: '#D9B438' }} />
          <p className="text-sm" style={{ color: '#555555' }}>
            {interfaceLang === 'fr'
              ? 'Recherchez n\'importe quel mot en anglais ou français'
              : 'Search any word in English or French'}
          </p>
        </div>
      )}
    </div>
  )
}
