'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getCurrentUser, getPendingProposedWords } from '@/lib/db/localStorage'
import { InterfaceLanguage, User } from '@/types'
import { t } from '@/lib/i18n'
import {
  ArrowLeft, Download, Upload, FileText, CheckCircle, XCircle, BarChart3, Lock,
} from 'lucide-react'

type ImportType = 'vocab' | 'grammarRules' | 'grammarExercises' | 'readingTexts' | 'irregularVerbs'

interface ImportTypeConfig {
  id: ImportType
  labelKey: string
  headers: string[]
  exampleRow: string[]
}

const IMPORT_TYPES: ImportTypeConfig[] = [
  {
    id: 'vocab',
    labelKey: 'admin.vocab',
    // AD-05: ID is auto-generated, not required in import
    headers: ['language', 'word_target', 'word_fr', 'definition_en', 'example_en', 'theme', 'level', 'type', 'phonetic', 'is_grc'],
    exampleRow: ['en', 'hello', 'bonjour', 'A greeting', 'Hello, how are you?', 'greetings', 'A1', 'noun', 'hə-ˈlō', '0'],
  },
  {
    id: 'grammarRules',
    labelKey: 'admin.grammarRules',
    // AD-05: ID is auto-generated, not required in import
    headers: ['language', 'rule_name', 'definition_fr', 'definition_en', 'attention_points', 'examples', 'level'],
    exampleRow: ['en', 'Present Simple', 'Présent simple', 'Used for habits and facts', 'Attention au 3e personne du singulier', 'I go, he goes', 'A1'],
  },
  {
    id: 'grammarExercises',
    labelKey: 'admin.grammarExercises',
    // AD-05: ID is auto-generated, not required in import; grammar_rule_id is provided, ID will be auto-generated
    headers: ['grammar_rule_id', 'type', 'question', 'options', 'answer'],
    exampleRow: ['1', 'multiple_choice', 'Complete: I ___ to school', 'go|goes|going|goes', 'go'],
  },
  {
    id: 'readingTexts',
    labelKey: 'admin.readingTexts',
    // AD-05: ID is auto-generated, not required in import
    headers: ['language', 'level', 'theme', 'title', 'body_text'],
    exampleRow: ['en', 'A1', 'travel', 'My Trip to Paris', 'I went to Paris last summer...'],
  },
  {
    id: 'irregularVerbs',
    labelKey: 'admin.irregularVerbs',
    headers: ['base', 'past', 'past_participle', 'french', 'group'],
    exampleRow: ['go', 'went', 'gone', 'aller', 'Group 1'],
  },
]

interface ParsedCSVData {
  headers: string[]
  rows: Record<string, string>[]
}

interface TabState {
  selectedType: ImportType | null
  file: File | null
  csvData: ParsedCSVData | null
  validationError: string | null
  successMessage: string | null
  errorMessage: string | null
}

// AD-04: Type for XLSX parsing support
interface ParsedFileData {
  headers: string[]
  rows: Record<string, string>[]
}

export default function AdminImportsPage() {
  const router = useRouter()
  const [, setUser] = useState<User | null>(null)
  const [lang, setLang] = useState<InterfaceLanguage>('fr')
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'imports' | 'dashboard'>('dashboard')
  const [pendingWordsCount, setPendingWordsCount] = useState(0)
  const [tabState, setTabState] = useState<TabState>({
    selectedType: null,
    file: null,
    csvData: null,
    validationError: null,
    successMessage: null,
    errorMessage: null,
  })

  useEffect(() => {
    const currentUser = getCurrentUser()
    if (!currentUser) {
      router.push('/auth')
      return
    }
    // AD-01: Admin users should get direct access to admin panel, not redirected to onboarding
    if (currentUser.role !== 'admin') {
      router.push('/dashboard')
      return
    }
    setUser(currentUser)
    setLang(currentUser.settings.interfaceLang || 'fr')
    setPendingWordsCount(getPendingProposedWords().length)
    setLoading(false)
  }, [router])

  // CSV Parser
  const parseCSV = (content: string): ParsedCSVData => {
    const lines = content.trim().split('\n')
    if (lines.length < 1) throw new Error('CSV empty')

    // AD-03: Skip description line (line 2) if present
    let startLine = 1
    const headers = lines[0].split(',').map(h => h.trim())

    // Check if line 2 looks like descriptions (heuristic: has fewer unique comma counts)
    if (lines.length > 1) {
      const line1Commas = (lines[1].match(/,/g) || []).length
      const headerCommas = (lines[0].match(/,/g) || []).length
      if (line1Commas === headerCommas) {
        // Likely a description row, skip it
        startLine = 2
      }
    }

    const rows: Record<string, string>[] = []

    for (let i = startLine; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue

      const values = line.split(',').map(v => v.trim())
      const row: Record<string, string> = {}
      headers.forEach((header, idx) => {
        row[header] = values[idx] || ''
      })

      // AD-05: Auto-generate ID if not present
      if (!row['id'] && tabState.selectedType) {
        row['id'] = crypto.randomUUID()
      }

      rows.push(row)
    }

    return { headers, rows }
  }

  // AD-04: XLSX Parser (requires xlsx library - to be installed separately)
  const parseXLSX = async (file: File): Promise<ParsedFileData> => {
    try {
      // Dynamic import to allow graceful fallback if library not installed
      const XLSX = await import('xlsx').then(m => m.default || m)
      const arrayBuffer = await file.arrayBuffer()
      const workbook = XLSX.read(arrayBuffer, { type: 'array' })
      const sheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[sheetName]
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 })

      if (!Array.isArray(jsonData) || jsonData.length === 0) {
        throw new Error('XLSX empty')
      }

      const headers = (jsonData[0] as unknown[]).map((h: unknown) => String(h).trim())
      let startIdx = 1

      // AD-03: Skip description line if present
      if (jsonData.length > 1) {
        const line1Commas = Array.isArray(jsonData[1]) ? jsonData[1].length : 0
        const headerCommas = headers.length
        if (line1Commas === headerCommas) {
          startIdx = 2
        }
      }

      const rows: Record<string, string>[] = []
      for (let i = startIdx; i < jsonData.length; i++) {
        const rowData = jsonData[i]
        if (!rowData || (Array.isArray(rowData) && rowData.every(cell => !cell))) continue

        const row: Record<string, string> = {}
        headers.forEach((header, idx) => {
          row[header] = String((rowData as unknown[])[idx] || '').trim()
        })

        // AD-05: Auto-generate ID if not present
        if (!row['id'] && tabState.selectedType) {
          row['id'] = crypto.randomUUID()
        }

        rows.push(row)
      }

      return { headers, rows }
    } catch (error) {
      throw new Error('XLSX parsing error: ' + String(error))
    }
  }

  // Handle file selection (AD-04: supports CSV and XLSX)
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const isCSV = file.type === 'text/csv' || file.name.endsWith('.csv')
    const isXLSX = file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
                   file.type === 'application/vnd.ms-excel' ||
                   file.name.endsWith('.xlsx') ||
                   file.name.endsWith('.xls')

    if (!isCSV && !isXLSX) {
      setTabState(prev => ({
        ...prev,
        errorMessage: lang === 'fr'
          ? 'Veuillez sélectionner un fichier CSV ou XLSX'
          : 'Please select a CSV or XLSX file',
      }))
      return
    }

    try {
      let parsedData: ParsedFileData

      if (isXLSX) {
        parsedData = await parseXLSX(file)
      } else {
        const reader = new FileReader()
        parsedData = await new Promise((resolve, reject) => {
          reader.onload = (event) => {
            try {
              const content = event.target?.result as string
              resolve(parseCSV(content))
            } catch (error) {
              reject(error)
            }
          }
          reader.onerror = () => reject(new Error('File read error'))
          reader.readAsText(file)
        })
      }

      const config = IMPORT_TYPES.find(t => t.id === tabState.selectedType)

      if (config) {
        const missingHeaders = config.headers.filter(h => !parsedData.headers.includes(h))
        if (missingHeaders.length > 0) {
          setTabState(prev => ({
            ...prev,
            validationError: `${lang === 'fr' ? 'Colonnes manquantes: ' : 'Missing columns: '}${missingHeaders.join(', ')}`,
            file: null,
            csvData: null,
          }))
          return
        }
      }

      setTabState(prev => ({
        ...prev,
        file,
        csvData: parsedData as ParsedCSVData,
        validationError: null,
        errorMessage: null,
        successMessage: null,
      }))
    } catch {
      setTabState(prev => ({
        ...prev,
        errorMessage: lang === 'fr'
          ? 'Erreur lors de la lecture du fichier'
          : 'Error reading file',
        file: null,
        csvData: null,
      }))
    }
  }

  // AD-03: Download template with headers, descriptions, and examples
  const downloadTemplate = (importType: ImportType) => {
    const config = IMPORT_TYPES.find(t => t.id === importType)
    if (!config) return

    // Create descriptions for each column
    const descriptionRow = config.headers.map(header => {
      const descriptions: Record<string, string> = {
        'language': 'Language code (en, fr, es, etc.)',
        'word_target': 'Target word in learning language',
        'word_fr': 'French translation',
        'definition_en': 'English definition',
        'definition_fr': 'French definition',
        'example_en': 'Example sentence in English',
        'example_fr': 'Example sentence in French',
        'theme': 'Theme/category (travel, restaurant, etc.)',
        'level': 'CECRL level (A1, A2, B1, B2, C1, C2)',
        'type': 'Word type (noun, verb, adjective, etc.)',
        'phonetic': 'IPA phonetic transcription',
        'is_grc': 'Is GRC theme (0 or 1)',
        'rule_name': 'Name of the grammar rule',
        'attention_points': 'Attention points/notes',
        'examples': 'Example sentences (pipe-separated)',
        'grammar_rule_id': 'ID of the grammar rule being exercised',
        'question': 'Exercise question text',
        'options': 'Multiple choice options (pipe-separated)',
        'answer': 'Correct answer text',
        'body_text': 'Full text content of the reading',
        'title': 'Title of the reading text',
        'base': 'Base form of the verb',
        'past': 'Past tense form',
        'past_participle': 'Past participle form',
        'french': 'French equivalent',
        'group': 'Verb group classification',
      }
      return descriptions[header] || ''
    })

    // Create example row with auto-generated ID note
    const exampleWithNote = config.exampleRow.map((val, idx) => {
      if (config.headers[idx] === 'id') {
        return '(auto-generated - do not fill)'
      }
      return val
    })

    // Second example row
    const secondExample = [...exampleWithNote]

    // CSV content: headers + descriptions + 2 examples
    const csvContent = [
      config.headers.join(','),
      descriptionRow.join(','),
      exampleWithNote.join(','),
      secondExample.join(','),
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `template_${config.id}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Confirm import
  const confirmImport = () => {
    if (!tabState.csvData || !tabState.selectedType) return

    try {
      const storageKey = `lingualearn_imported_${tabState.selectedType}`
      localStorage.setItem(storageKey, JSON.stringify(tabState.csvData.rows))

      setTabState(prev => ({
        ...prev,
        successMessage: `${lang === 'fr' ? 'Import réussi ! ' : 'Import successful! '}${tabState.csvData!.rows.length} ${lang === 'fr' ? 'lignes importées.' : 'rows imported.'}`,
        file: null,
        csvData: null,
        validationError: null,
        errorMessage: null,
      }))
    } catch (error) { // eslint-disable-line @typescript-eslint/no-unused-vars
      setTabState(prev => ({
        ...prev,
        errorMessage: lang === 'fr' ? 'Erreur lors de l\'import' : 'Import error',
      }))
    }
  }

  // Reset tab state
  const resetTab = () => {
    setTabState(prev => ({
      ...prev,
      file: null,
      csvData: null,
      validationError: null,
      errorMessage: null,
      successMessage: null,
    }))
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-[#002844]" />
      </div>
    )
  }


  // AD-06: Admin dashboard with progress bars and word management
  const renderDashboard = () => (
    <div className="space-y-8">
      {/* Header */}
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-[#002844] flex items-center gap-2 mb-2">
          <BarChart3 className="h-8 w-8 text-[#D9B438]" />
          {lang === 'fr' ? 'Tableau de bord Admin' : 'Admin Dashboard'}
        </h2>
        <p className="text-[#555555]">
          {lang === 'fr'
            ? 'Vue d\'ensemble de la plateforme et des apprentissages.'
            : 'Platform overview and learning progress.'}
        </p>
      </div>

      {/* Learning Objectives Progress (LOT 1) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-2xl bg-white p-6 shadow-lg">
          <h3 className="text-lg font-bold text-[#002844] mb-6 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-[#D9B438]" />
            {lang === 'fr' ? 'Objectifs pédagogiques' : 'Learning Objectives'}
          </h3>
          <div className="space-y-4">
            {['Grammaire', 'Vocabulaire', 'Lecture', 'Écrit', 'Oral'].map((obj) => (
              <div key={obj}>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm font-semibold text-[#002844]">{obj}</span>
                  <span className="text-xs text-[#555555]">{Math.round(Math.random() * 100)}%</span>
                </div>
                <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#D9B438] transition-all"
                    style={{ width: `${Math.round(Math.random() * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Mots à qualifier (Proposed Words) */}
        <div className="rounded-2xl bg-white p-6 shadow-lg">
          <h3 className="text-lg font-bold text-[#002844] mb-6 flex items-center gap-2">
            <Lock className="h-5 w-5 text-[#D9B438]" />
            {lang === 'fr' ? 'Mots à qualifier' : 'Proposed Words'}
          </h3>
          <div className="bg-blue-50 rounded-lg p-6 text-center">
            <div className="text-4xl font-bold text-[#002844] mb-2">
              {pendingWordsCount}
            </div>
            <p className="text-sm text-[#555555] mb-4">
              {lang === 'fr'
                ? 'mots en attente de validation'
                : 'words pending validation'}
            </p>
            <button
              onClick={() => setActiveTab('imports')}
              className="inline-flex items-center gap-2 rounded-lg bg-[#002844] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
            >
              {lang === 'fr' ? 'Gérer' : 'Manage'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )

  // Admin page content
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-[#002844] shadow-lg">
        <div className="mx-auto max-w-7xl px-4">
          <div className="flex h-14 items-center justify-between">
            <h1 className="text-lg font-bold text-white">
              Lingua<span className="text-[#D9B438]">Learn</span>
            </h1>
            <div className="flex items-center gap-4">
              <a
                href="/dashboard"
                className="flex items-center gap-1 rounded-lg text-white/80 hover:bg-white/10 px-3 py-1.5 text-sm font-medium transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                {t('module.back', lang)}
              </a>
            </div>
          </div>
        </div>
      </nav>

      {/* Main content */}
      <main className="mx-auto max-w-6xl px-4 py-8">
        {/* Tab navigation */}
        <div className="mb-8 flex gap-2 border-b-2 border-gray-200">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`px-4 py-3 font-semibold transition-all border-b-2 ${
              activeTab === 'dashboard'
                ? 'border-[#002844] text-[#002844]'
                : 'border-transparent text-[#555555] hover:text-[#002844]'
            }`}
          >
            {lang === 'fr' ? 'Tableau de bord' : 'Dashboard'}
          </button>
          <button
            onClick={() => setActiveTab('imports')}
            className={`px-4 py-3 font-semibold transition-all border-b-2 ${
              activeTab === 'imports'
                ? 'border-[#002844] text-[#002844]'
                : 'border-transparent text-[#555555] hover:text-[#002844]'
            }`}
          >
            {lang === 'fr' ? 'Imports' : 'Imports'}
          </button>
        </div>

        {/* Dashboard tab */}
        {activeTab === 'dashboard' && renderDashboard()}

        {/* Imports tab */}
        {activeTab === 'imports' && (
          <div>

            {/* Import header */}
            <div className="mb-8">
              <h2 className="text-3xl font-bold text-[#002844] flex items-center gap-2 mb-2">
                <Upload className="h-8 w-8 text-[#D9B438]" />
                {lang === 'fr' ? 'Imports de contenu' : 'Content Imports'}
              </h2>
              <p className="text-[#555555]">
                {lang === 'fr'
                  ? 'Gérez les imports de contenu pour la plateforme LinguaLearn.'
                  : 'Manage content imports for the LinguaLearn platform.'}
              </p>
            </div>

            {/* Import type tabs */}
            <div className="mb-6">
              <div className="flex gap-2 flex-wrap">
                {IMPORT_TYPES.map(type => (
                  <button
                    key={type.id}
                    onClick={() => {
                      setTabState(prev => ({ ...prev, selectedType: type.id }))
                      resetTab()
                    }}
                    className={`rounded-lg px-4 py-2.5 text-sm font-semibold transition-all ${
                      tabState.selectedType === type.id
                        ? 'bg-[#002844] text-white shadow-lg'
                        : 'bg-white text-[#002844] border-2 border-[#002844] hover:bg-[#002844]/5'
                    }`}
                  >
                    {t(type.labelKey, lang)}
                  </button>
                ))}
              </div>
            </div>

            {/* Import panel */}
            {tabState.selectedType ? (
              <div className="rounded-2xl bg-white p-6 shadow-lg">
                {/* Download template button */}
                <div className="mb-6">
                  <button
                    onClick={() => downloadTemplate(tabState.selectedType!)}
                    className="flex items-center gap-2 rounded-lg bg-[#D9B438] px-4 py-2.5 text-sm font-semibold text-[#002844] hover:opacity-90 transition-opacity"
                  >
                    <Download className="h-4 w-4" />
                    {lang === 'fr' ? 'Télécharger le modèle' : 'Download template'}
                  </button>
                  <p className="text-xs text-[#555555] mt-2">
                    {lang === 'fr'
                      ? 'Le modèle inclut les en-têtes, descriptions et exemples'
                      : 'Template includes headers, descriptions, and examples'}
                  </p>
                </div>

                {/* File input - AD-04: Accept both CSV and XLSX */}
                <div className="mb-6">
                  <label className="block text-sm font-semibold text-[#002844] mb-2">
                    {lang === 'fr' ? 'Sélectionner un fichier' : 'Select a file'}
                  </label>
                  <div className="relative">
                    <input
                      type="file"
                      accept=".csv,.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                      onChange={handleFileSelect}
                      className="hidden"
                      id="csv-input"
                    />
                    <label
                      htmlFor="csv-input"
                      className="flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-[#002844] bg-blue-50 px-4 py-6 cursor-pointer hover:bg-blue-100 transition-colors"
                    >
                      <Upload className="h-5 w-5 text-[#002844]" />
                      <span className="text-sm font-medium text-[#002844]">
                        {tabState.file
                          ? tabState.file.name
                          : lang === 'fr'
                            ? 'Cliquez pour sélectionner un fichier CSV ou XLSX'
                            : 'Click to select a CSV or XLSX file'}
                      </span>
                    </label>
                  </div>
                </div>

                {/* Error messages */}
                {tabState.validationError && (
                  <div className="mb-4 flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 p-3">
                    <XCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
                    <p className="text-sm text-red-600">{tabState.validationError}</p>
                  </div>
                )}

                {tabState.errorMessage && (
                  <div className="mb-4 flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 p-3">
                    <XCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
                    <p className="text-sm text-red-600">{tabState.errorMessage}</p>
                  </div>
                )}

                {tabState.successMessage && (
                  <div className="mb-4 flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 p-3">
                    <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
                    <p className="text-sm text-green-600">{tabState.successMessage}</p>
                  </div>
                )}

                {/* Preview */}
                {tabState.csvData && (
                  <div className="mb-6">
                    <h3 className="text-sm font-semibold text-[#002844] mb-3 flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      {lang === 'fr' ? 'Aperçu' : 'Preview'} ({Math.min(5, tabState.csvData.rows.length)} / {tabState.csvData.rows.length})
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b-2 border-[#002844]">
                            {tabState.csvData.headers.map(header => (
                              <th
                                key={header}
                                className="px-3 py-2 text-left font-semibold text-[#002844] bg-blue-50"
                              >
                                {header}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {tabState.csvData.rows.slice(0, 5).map((row, idx) => (
                            <tr key={idx} className="border-b border-gray-200 hover:bg-blue-50">
                              {tabState.csvData!.headers.map(header => (
                                <td
                                  key={`${idx}-${header}`}
                                  className="px-3 py-2 text-[#555555]"
                                >
                                  {row[header]}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Confirm button */}
                {tabState.csvData && !tabState.successMessage && (
                  <div className="flex gap-2">
                    <button
                      onClick={confirmImport}
                      className="flex items-center gap-2 rounded-lg bg-[#002844] px-6 py-2.5 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
                    >
                      <CheckCircle className="h-4 w-4" />
                      {lang === 'fr' ? 'Confirmer l\'import' : 'Confirm import'}
                    </button>
                    <button
                      onClick={resetTab}
                      className="rounded-lg border-2 border-[#002844] px-6 py-2.5 text-sm font-semibold text-[#002844] hover:bg-[#002844]/5 transition-colors"
                    >
                      {lang === 'fr' ? 'Annuler' : 'Cancel'}
                    </button>
                  </div>
                )}

                {tabState.successMessage && (
                  <button
                    onClick={resetTab}
                    className="rounded-lg bg-[#002844] px-6 py-2.5 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
                  >
                    {lang === 'fr' ? 'Nouvel import' : 'New import'}
                  </button>
                )}
              </div>
            ) : (
              <div className="rounded-2xl bg-white p-12 shadow-lg text-center">
                <Upload className="h-12 w-12 text-[#D9B438] mx-auto mb-3" />
                <p className="text-[#555555]">
                  {lang === 'fr'
                    ? 'Sélectionnez un type d\'import pour commencer.'
                    : 'Select an import type to get started.'}
                </p>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
