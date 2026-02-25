'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getCurrentUser } from '@/lib/db/localStorage'
import { InterfaceLanguage, User } from '@/types'
import { t } from '@/lib/i18n'
import {
  ArrowLeft, Download, Upload, FileText, CheckCircle, XCircle, Shield,
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
    headers: ['id', 'language', 'word_target', 'word_fr', 'definition_en', 'example_en', 'theme', 'level', 'type', 'phonetic', 'is_grc'],
    exampleRow: ['1', 'en', 'hello', 'bonjour', 'A greeting', 'Hello, how are you?', 'greetings', 'A1', 'noun', 'hə-ˈlō', '0'],
  },
  {
    id: 'grammarRules',
    labelKey: 'admin.grammarRules',
    headers: ['id', 'language', 'rule_name', 'definition_fr', 'definition_en', 'attention_points', 'examples', 'level'],
    exampleRow: ['1', 'en', 'Present Simple', 'Présent simple', 'Used for habits and facts', 'Attention au 3e personne du singulier', 'I go, he goes', 'A1'],
  },
  {
    id: 'grammarExercises',
    labelKey: 'admin.grammarExercises',
    headers: ['id', 'grammar_rule_id', 'type', 'question', 'options', 'answer'],
    exampleRow: ['1', '1', 'multiple_choice', 'Complete: I ___ to school', 'go|goes|going|goes', 'go'],
  },
  {
    id: 'readingTexts',
    labelKey: 'admin.readingTexts',
    headers: ['id', 'language', 'level', 'theme', 'title', 'body_text'],
    exampleRow: ['1', 'en', 'A1', 'travel', 'My Trip to Paris', 'I went to Paris last summer...'],
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

export default function AdminImportsPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [lang, setLang] = useState<InterfaceLanguage>('fr')
  const [loading, setLoading] = useState(true)
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
    if (currentUser.role !== 'admin') {
      setUser(currentUser)
      setLang(currentUser.settings.interfaceLang || 'fr')
      setLoading(false)
      return
    }
    setUser(currentUser)
    setLang(currentUser.settings.interfaceLang || 'fr')
    setLoading(false)
  }, [router])

  // CSV Parser
  const parseCSV = (content: string): ParsedCSVData => {
    const lines = content.trim().split('\n')
    if (lines.length < 1) throw new Error('CSV empty')

    const headers = lines[0].split(',').map(h => h.trim())
    const rows: Record<string, string>[] = []

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue

      const values = line.split(',').map(v => v.trim())
      const row: Record<string, string> = {}
      headers.forEach((header, idx) => {
        row[header] = values[idx] || ''
      })
      rows.push(row)
    }

    return { headers, rows }
  }

  // Handle file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
      setTabState(prev => ({
        ...prev,
        errorMessage: lang === 'fr' ? 'Veuillez sélectionner un fichier CSV' : 'Please select a CSV file',
      }))
      return
    }

    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string
        const parsedData = parseCSV(content)
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
          csvData: parsedData,
          validationError: null,
          errorMessage: null,
          successMessage: null,
        }))
      } catch (error) { // eslint-disable-line @typescript-eslint/no-unused-vars
        setTabState(prev => ({
          ...prev,
          errorMessage: lang === 'fr' ? 'Erreur lors de la lecture du fichier' : 'Error reading file',
          file: null,
          csvData: null,
        }))
      }
    }
    reader.readAsText(file)
  }

  // Download template
  const downloadTemplate = (importType: ImportType) => {
    const config = IMPORT_TYPES.find(t => t.id === importType)
    if (!config) return

    const csvContent = [
      config.headers.join(','),
      config.exampleRow.join(','),
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

  // Admin access control
  if (user?.role !== 'admin') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
        <nav className="sticky top-0 z-50 bg-[#002844] shadow-lg">
          <div className="mx-auto max-w-7xl px-4">
            <div className="flex h-14 items-center justify-between">
              <h1 className="text-lg font-bold text-white">
                Lingua<span className="text-[#D9B438]">Learn</span>
              </h1>
            </div>
          </div>
        </nav>

        <main className="mx-auto max-w-2xl px-4 py-12">
          <div className="rounded-2xl bg-white p-8 shadow-lg text-center">
            <div className="flex justify-center mb-4">
              <Shield className="h-12 w-12 text-[#D9B438]" />
            </div>
            <h2 className="text-2xl font-bold text-[#002844] mb-3">
              {t('admin.adminOnly', lang)}
            </h2>
            <p className="text-[#555555] mb-6">
              {lang === 'fr'
                ? 'Seuls les administrateurs peuvent accéder à cette page.'
                : 'Only administrators can access this page.'}
            </p>
            <a
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-lg bg-[#002844] px-6 py-2.5 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
            >
              <ArrowLeft className="h-4 w-4" />
              {t('module.back', lang)}
            </a>
          </div>
        </main>
      </div>
    )
  }

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
            <a
              href="/dashboard"
              className="flex items-center gap-1 rounded-lg text-white/80 hover:bg-white/10 px-3 py-1.5 text-sm font-medium transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              {t('module.back', lang)}
            </a>
          </div>
        </div>
      </nav>

      {/* Main content */}
      <main className="mx-auto max-w-6xl px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-[#002844] flex items-center gap-2 mb-2">
            <Shield className="h-8 w-8 text-[#D9B438]" />
            {t('admin.title', lang)}
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
                {t('admin.template', lang)}
              </button>
            </div>

            {/* File input */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-[#002844] mb-2">
                {t('admin.selectFile', lang)}
              </label>
              <div className="relative">
                <input
                  type="file"
                  accept=".csv"
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
                        ? 'Cliquez pour sélectionner un fichier CSV'
                        : 'Click to select a CSV file'}
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
                  {t('admin.preview', lang)} ({Math.min(5, tabState.csvData.rows.length)} / {tabState.csvData.rows.length})
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
                  {t('admin.confirmImport', lang)}
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
            <Shield className="h-12 w-12 text-[#D9B438] mx-auto mb-3" />
            <p className="text-[#555555]">
              {lang === 'fr'
                ? 'Sélectionnez un type d\'import pour commencer.'
                : 'Select an import type to get started.'}
            </p>
          </div>
        )}
      </main>
    </div>
  )
}
