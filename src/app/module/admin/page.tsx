'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  getCurrentUser,
  getPendingProposedWords,
  validateProposedWord,
  rejectProposedWord,
  getAllUsers,
  getUserPasswords,
  approveUser,
  deleteUser,
  adminCreateUser,
} from '@/lib/db/localStorage'
import { BANK_VOCABULARY } from '@/lib/db/bankVocabulary'
import { BANK_GRAMMAR } from '@/lib/db/bankGrammar'
import { BANK_READING } from '@/lib/db/bankReading'
import { InterfaceLanguage, User, ALL_THEMES } from '@/types'
import { BANK_A1_COURSES } from '@/lib/db/bankA1Courses'
import { t } from '@/lib/i18n'
import {
  ArrowLeft, Download, Upload, FileText, CheckCircle, XCircle, BarChart3, Lock,
  Users, Eye, EyeOff, UserPlus, Trash2, Shield,
} from 'lucide-react'
import BottomNav from '@/components/BottomNav'

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
    headers: ['language', 'word_target', 'word_fr', 'definition_en', 'example_en', 'theme', 'level', 'type', 'phonetic', 'is_grc'],
    exampleRow: ['en', 'hello', 'bonjour', 'A greeting', 'Hello, how are you?', 'greetings', 'A1', 'noun', 'hə-ˈlō', '0'],
  },
  {
    id: 'grammarRules',
    labelKey: 'admin.grammarRules',
    headers: ['language', 'rule_name', 'definition_fr', 'definition_en', 'attention_points', 'examples', 'level'],
    exampleRow: ['en', 'Present Simple', 'Présent simple', 'Used for habits and facts', 'Attention au 3e personne du singulier', 'I go, he goes', 'A1'],
  },
  {
    id: 'grammarExercises',
    labelKey: 'admin.grammarExercises',
    headers: ['grammar_rule_id', 'type', 'question', 'options', 'answer'],
    exampleRow: ['1', 'multiple_choice', 'Complete: I ___ to school', 'go|goes|going|goes', 'go'],
  },
  {
    id: 'readingTexts',
    labelKey: 'admin.readingTexts',
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

interface ParsedFileData {
  headers: string[]
  rows: Record<string, string>[]
}

export default function AdminImportsPage() {
  const router = useRouter()
  const [, setUser] = useState<User | null>(null)
  const [lang, setLang] = useState<InterfaceLanguage>('fr')
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'imports' | 'dashboard' | 'proposedWords' | 'utilisateurs' | 'images'>('dashboard')
  const [pendingWordsCount, setPendingWordsCount] = useState(0)
  const [users, setUsers] = useState<User[]>([])
  const [passwordVisibility, setPasswordVisibility] = useState<Record<string, boolean>>({})
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [createFormData, setCreateFormData] = useState({ firstName: '', email: '', password: '', role: 'user' as 'user' | 'admin' })
  const [createError, setCreateError] = useState('')
  const [detailView, setDetailView] = useState<'vocab' | 'reading' | 'grammar' | null>(null)
  const [editingWordId, setEditingWordId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<Record<string, string>>({})
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
      router.push('/dashboard')
      return
    }
    setUser(currentUser)
    setLang(currentUser.settings.interfaceLang || 'fr')
    setPendingWordsCount(getPendingProposedWords().length)
    setUsers(getAllUsers())
    setLoading(false)
  }, [router])

  // CSV Parser
  const parseCSV = (content: string): ParsedCSVData => {
    const lines = content.trim().split('\n')
    if (lines.length < 1) throw new Error('CSV empty')

    let startLine = 1
    const headers = lines[0].split(',').map(h => h.trim())

    if (lines.length > 1) {
      const line1Commas = (lines[1].match(/,/g) || []).length
      const headerCommas = (lines[0].match(/,/g) || []).length
      if (line1Commas === headerCommas) {
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

      if (!row['id'] && tabState.selectedType) {
        row['id'] = crypto.randomUUID()
      }

      rows.push(row)
    }

    return { headers, rows }
  }

  // XLSX Parser
  const parseXLSX = async (file: File): Promise<ParsedFileData> => {
    try {
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

  // Handle file selection
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

  // Download template
  const downloadTemplate = (importType: ImportType) => {
    const config = IMPORT_TYPES.find(t => t.id === importType)
    if (!config) return

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

    const exampleWithNote = config.exampleRow.map((val, idx) => {
      if (config.headers[idx] === 'id') {
        return '(auto-generated - do not fill)'
      }
      return val
    })

    const secondExample = [...exampleWithNote]

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
    } catch {
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

  // User management functions
  const handleApproveUser = (userId: string) => {
    approveUser(userId)
    setUsers(getAllUsers())
  }

  const handleDeleteUser = (userId: string) => {
    if (confirm(lang === 'fr' ? 'Êtes-vous sûr de vouloir supprimer cet utilisateur ?' : 'Are you sure you want to delete this user?')) {
      deleteUser(userId)
      setUsers(getAllUsers())
    }
  }

  const handleCreateUser = () => {
    setCreateError('')
    if (!createFormData.firstName || !createFormData.email || !createFormData.password) {
      setCreateError(lang === 'fr' ? 'Tous les champs sont requis' : 'All fields are required')
      return
    }

    const result = adminCreateUser(
      createFormData.firstName,
      createFormData.email,
      createFormData.password,
      createFormData.role
    )

    if (!result.success) {
      setCreateError(result.error === 'emailExists'
        ? (lang === 'fr' ? 'Cet email existe déjà' : 'This email already exists')
        : (lang === 'fr' ? 'Erreur lors de la création' : 'Error creating user'))
      return
    }

    setUsers(getAllUsers())
    setShowCreateForm(false)
    setCreateFormData({ firstName: '', email: '', password: '', role: 'user' })
  }

  const togglePasswordVisibility = (email: string) => {
    setPasswordVisibility(prev => ({
      ...prev,
      [email]: !prev[email],
    }))
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-[#002844]" />
      </div>
    )
  }

  // Dashboard render
  const renderDashboard = () => {
    const totalUsers = users.length
    const adminCount = users.filter(u => u.role === 'admin').length
    const vocabCount = BANK_VOCABULARY ? BANK_VOCABULARY.length : 0
    const readingCount = BANK_READING ? BANK_READING.length : 0
    const grammarCount = BANK_GRAMMAR ? BANK_GRAMMAR.length : 0
    const pendingCount = getPendingProposedWords().length

    const stats = [
      {
        label: lang === 'fr' ? 'Utilisateurs' : 'Users',
        value: totalUsers,
        icon: Users,
        color: '#D9B438',
        action: () => setActiveTab('utilisateurs'),
      },
      {
        label: lang === 'fr' ? 'Admins' : 'Admins',
        value: adminCount,
        icon: Shield,
        color: '#D9B438',
        action: () => setActiveTab('utilisateurs'),
      },
      {
        label: lang === 'fr' ? 'Mots de vocabulaire' : 'Vocabulary Words',
        value: vocabCount,
        icon: FileText,
        color: '#D9B438',
        action: () => setDetailView('vocab'),
      },
      {
        label: lang === 'fr' ? 'Textes de lecture' : 'Reading Texts',
        value: readingCount,
        icon: FileText,
        color: '#D9B438',
        action: () => setDetailView('reading'),
      },
      {
        label: lang === 'fr' ? 'Règles de grammaire' : 'Grammar Rules',
        value: grammarCount,
        icon: FileText,
        color: '#D9B438',
        action: () => setDetailView('grammar'),
      },
      {
        label: lang === 'fr' ? 'Mots en attente' : 'Pending Words',
        value: pendingCount,
        icon: Lock,
        color: '#D9B438',
        action: () => setActiveTab('proposedWords'),
      },
    ]

    return (
      <div className="space-y-8">
        {/* Header */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-[#002844] flex items-center gap-2 mb-2">
            <BarChart3 className="h-8 w-8 text-[#D9B438]" />
            {lang === 'fr' ? 'Tableau de bord' : 'Dashboard'}
          </h2>
          <p className="text-[#555555]">
            {lang === 'fr'
              ? 'Vue d\'ensemble de la plateforme'
              : 'Platform overview'}
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {stats.map((stat, idx) => {
            const IconComponent = stat.icon
            return (
              <button
                key={idx}
                onClick={() => { if (stat.action) stat.action(); }}
                disabled={stat.action === undefined}
                className={`rounded-2xl bg-white p-6 shadow-lg transition-all ${
                  stat.action !== undefined ? 'hover:shadow-xl hover:scale-105 cursor-pointer' : 'cursor-default'
                }`}
              >
                <div className="flex items-center justify-between mb-4">
                  <IconComponent className="h-8 w-8" style={{ color: stat.color }} />
                </div>
                <div className="text-4xl font-bold text-[#002844] mb-2">
                  {stat.value}
                </div>
                <div className="text-sm text-[#555555] font-medium">
                  {stat.label}
                </div>
              </button>
            )
          })}
        </div>

        {/* Detail View Section */}
        {detailView && (
          <div className="mt-8 rounded-2xl bg-white p-6 shadow-lg">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-[#002844]">
                {detailView === 'vocab' && (lang === 'fr' ? 'Vocabulaire par niveau' : 'Vocabulary by level')}
                {detailView === 'reading' && (lang === 'fr' ? 'Lectures par niveau' : 'Readings by level')}
                {detailView === 'grammar' && (lang === 'fr' ? 'Grammaire par niveau' : 'Grammar by level')}
              </h3>
              <button
                onClick={() => setDetailView(null)}
                className="px-4 py-2 rounded-lg bg-[#002844] text-white font-semibold hover:opacity-90 transition-opacity"
              >
                {lang === 'fr' ? 'Fermer' : 'Close'}
              </button>
            </div>

            {/* Level breakdown table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ backgroundColor: '#E8F4F8' }}>
                    <th className="px-4 py-3 text-left font-semibold text-[#002844]">
                      {lang === 'fr' ? 'Niveau' : 'Level'}
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-[#002844]">
                      {lang === 'fr' ? 'Nombre' : 'Count'}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    let source: any[] = [];
                    if (detailView === 'vocab') source = BANK_VOCABULARY || [];
                    else if (detailView === 'reading') source = BANK_READING || [];
                    else if (detailView === 'grammar') source = BANK_GRAMMAR || [];

                    const levels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
                    const counts: Record<string, number> = {};

                    levels.forEach(level => {
                      counts[level] = source.filter(item => {
                        return item.level === level;
                      }).length;
                    });

                    return levels.map((level) => (
                      <tr key={level} className="border-b border-gray-200 hover:bg-blue-50">
                        <td className="px-4 py-3 font-semibold text-[#002844]">{level}</td>
                        <td className="px-4 py-3 text-[#555555]">{counts[level]}</td>
                      </tr>
                    ));
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    )
  }

  // Users tab render
  const renderUsersTab = () => {
    return (
      <div className="space-y-8">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold text-[#002844] flex items-center gap-2 mb-2">
              <Users className="h-8 w-8 text-[#D9B438]" />
              {lang === 'fr' ? 'Gestion des utilisateurs' : 'User Management'}
            </h2>
            <p className="text-[#555555]">
              {lang === 'fr'
                ? 'Gérez les utilisateurs et leurs permissions'
                : 'Manage users and their permissions'}
            </p>
          </div>
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="flex items-center gap-2 rounded-lg bg-[#002844] px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
          >
            <UserPlus className="h-4 w-4" />
            {lang === 'fr' ? 'Créer un compte' : 'Create Account'}
          </button>
        </div>

        {/* Create form */}
        {showCreateForm && (
          <div className="rounded-2xl bg-white p-6 shadow-lg mb-6">
            <h3 className="text-lg font-bold text-[#002844] mb-4">
              {lang === 'fr' ? 'Créer un nouvel utilisateur' : 'Create New User'}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <input
                type="text"
                placeholder={lang === 'fr' ? 'Nom' : 'First Name'}
                value={createFormData.firstName}
                onChange={(e) => setCreateFormData(prev => ({ ...prev, firstName: e.target.value }))}
                className="rounded-lg border-2 border-[#002844] px-3 py-2 text-sm focus:outline-none focus:border-[#D9B438]"
              />
              <input
                type="email"
                placeholder={lang === 'fr' ? 'Email' : 'Email'}
                value={createFormData.email}
                onChange={(e) => setCreateFormData(prev => ({ ...prev, email: e.target.value }))}
                className="rounded-lg border-2 border-[#002844] px-3 py-2 text-sm focus:outline-none focus:border-[#D9B438]"
              />
              <input
                type="password"
                placeholder={lang === 'fr' ? 'Mot de passe' : 'Password'}
                value={createFormData.password}
                onChange={(e) => setCreateFormData(prev => ({ ...prev, password: e.target.value }))}
                className="rounded-lg border-2 border-[#002844] px-3 py-2 text-sm focus:outline-none focus:border-[#D9B438]"
              />
              <select
                value={createFormData.role}
                onChange={(e) => setCreateFormData(prev => ({ ...prev, role: e.target.value as 'user' | 'admin' }))}
                className="rounded-lg border-2 border-[#002844] px-3 py-2 text-sm focus:outline-none focus:border-[#D9B438]"
              >
                <option value="user">{lang === 'fr' ? 'Utilisateur' : 'User'}</option>
                <option value="admin">{lang === 'fr' ? 'Admin' : 'Admin'}</option>
              </select>
            </div>
            {createError && (
              <div className="mb-4 flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 p-3">
                <XCircle className="h-5 w-5 text-red-600" />
                <p className="text-sm text-red-600">{createError}</p>
              </div>
            )}
            <div className="flex gap-2">
              <button
                onClick={handleCreateUser}
                className="flex items-center gap-2 rounded-lg bg-[#002844] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
              >
                <CheckCircle className="h-4 w-4" />
                {lang === 'fr' ? 'Créer' : 'Create'}
              </button>
              <button
                onClick={() => {
                  setShowCreateForm(false)
                  setCreateError('')
                }}
                className="rounded-lg border-2 border-[#002844] px-4 py-2 text-sm font-semibold text-[#002844] hover:bg-[#002844]/5 transition-colors"
              >
                {lang === 'fr' ? 'Annuler' : 'Cancel'}
              </button>
            </div>
          </div>
        )}

        {/* Users table */}
        <div className="rounded-2xl bg-white shadow-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ backgroundColor: '#002844' }}>
                  <th className="px-6 py-4 text-left font-semibold text-white">
                    {lang === 'fr' ? 'Nom' : 'Name'}
                  </th>
                  <th className="px-6 py-4 text-left font-semibold text-white">
                    {lang === 'fr' ? 'Email' : 'Email'}
                  </th>
                  <th className="px-6 py-4 text-left font-semibold text-white">
                    {lang === 'fr' ? 'Mot de passe' : 'Password'}
                  </th>
                  <th className="px-6 py-4 text-left font-semibold text-white">
                    {lang === 'fr' ? 'Date inscription' : 'Join Date'}
                  </th>
                  <th className="px-6 py-4 text-left font-semibold text-white">
                    {lang === 'fr' ? 'Rôle' : 'Role'}
                  </th>
                  <th className="px-6 py-4 text-left font-semibold text-white">
                    {lang === 'fr' ? 'Statut' : 'Status'}
                  </th>
                  <th className="px-6 py-4 text-center font-semibold text-white">
                    {lang === 'fr' ? 'Actions' : 'Actions'}
                  </th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => {
                  const passwords = getUserPasswords()
                  const password = passwords[user.email] || '••••••'
                  const isVisible = passwordVisibility[user.email] || false

                  return (
                    <tr key={user.id} className="border-b border-gray-200 hover:bg-blue-50">
                      <td className="px-6 py-4 font-semibold text-[#002844]">
                        {user.firstName}
                      </td>
                      <td className="px-6 py-4 text-[#555555]">
                        {user.email}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm text-[#555555]">
                            {isVisible ? password : '••••••'}
                          </span>
                          <button
                            onClick={() => togglePasswordVisibility(user.email)}
                            className="text-[#002844] hover:text-[#D9B438] transition-colors"
                          >
                            {isVisible ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-[#555555]">
                        {new Date(user.createdAt).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US')}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className="px-3 py-1 rounded-full text-sm font-medium"
                          style={{
                            backgroundColor: user.role === 'admin' ? '#D9B438' : '#E8F4F8',
                            color: user.role === 'admin' ? '#002844' : '#002844',
                          }}
                        >
                          {user.role === 'admin'
                            ? (lang === 'fr' ? 'Admin' : 'Admin')
                            : (lang === 'fr' ? 'Utilisateur' : 'User')}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className="px-3 py-1 rounded-full text-sm font-medium"
                          style={{
                            backgroundColor: user.status === 'active' ? '#E8F4F8' : '#FFF3CD',
                            color: user.status === 'active' ? '#002844' : '#856404',
                          }}
                        >
                          {user.status === 'active'
                            ? (lang === 'fr' ? 'Actif' : 'Active')
                            : (lang === 'fr' ? 'En attente' : 'Pending')}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-2 justify-center">
                          {user.status === 'pending' && (
                            <button
                              onClick={() => handleApproveUser(user.id)}
                              className="px-3 py-1.5 rounded-lg font-semibold text-white text-sm hover:opacity-90 transition-opacity flex items-center gap-1"
                              style={{ backgroundColor: '#2e7d32' }}
                            >
                              <CheckCircle className="h-3.5 w-3.5" />
                              {lang === 'fr' ? 'Valider' : 'Approve'}
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteUser(user.id)}
                            className="px-3 py-1.5 rounded-lg font-semibold text-white text-sm hover:opacity-90 transition-opacity flex items-center gap-1"
                            style={{ backgroundColor: '#d32f2f' }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            {lang === 'fr' ? 'Supprimer' : 'Delete'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    )
  }

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
        <div className="mb-8 flex gap-2 border-b-2 border-gray-200 flex-wrap">
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
            onClick={() => setActiveTab('utilisateurs')}
            className={`px-4 py-3 font-semibold transition-all border-b-2 ${
              activeTab === 'utilisateurs'
                ? 'border-[#002844] text-[#002844]'
                : 'border-transparent text-[#555555] hover:text-[#002844]'
            }`}
          >
            {lang === 'fr' ? 'Utilisateurs' : 'Users'}
          </button>
          <button
            onClick={() => setActiveTab('proposedWords')}
            className={`px-4 py-3 font-semibold transition-all border-b-2 ${
              activeTab === 'proposedWords'
                ? 'border-[#002844] text-[#002844]'
                : 'border-transparent text-[#555555] hover:text-[#002844]'
            }`}
          >
            {lang === 'fr' ? 'Mots à qualifier' : 'Proposed Words'}
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
          {/* BUG-80: Images tab */}
          <button
            onClick={() => setActiveTab('images')}
            className={`px-4 py-3 font-semibold transition-all border-b-2 ${
              activeTab === 'images'
                ? 'border-[#002844] text-[#002844]'
                : 'border-transparent text-[#555555] hover:text-[#002844]'
            }`}
          >
            {lang === 'fr' ? 'Images Vocab' : 'Vocab Images'}
          </button>
        </div>

        {/* Dashboard tab */}
        {activeTab === 'dashboard' && renderDashboard()}

        {/* Users tab */}
        {activeTab === 'utilisateurs' && renderUsersTab()}

        {/* Proposed Words tab */}
        {activeTab === 'proposedWords' && (
          <div>
            {/* Header */}
            <div className="mb-8">
              <h2 className="text-3xl font-bold text-[#002844] flex items-center gap-2 mb-2">
                <Lock className="h-8 w-8 text-[#D9B438]" />
                {lang === 'fr' ? 'Mots à qualifier' : 'Proposed Words'}
              </h2>
              <p className="text-[#555555]">
                {lang === 'fr'
                  ? 'Validez ou refusez les mots proposés par les utilisateurs.'
                  : 'Validate or reject words proposed by users.'}
              </p>
            </div>

            {/* Proposed words list */}
            {pendingWordsCount === 0 ? (
              <div className="rounded-2xl bg-white p-12 shadow-lg text-center">
                <CheckCircle className="h-12 w-12 text-[#D9B438] mx-auto mb-3" />
                <p className="text-[#555555]">
                  {lang === 'fr'
                    ? 'Aucun mot en attente de validation.'
                    : 'No words pending validation.'}
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {getPendingProposedWords().map((word) => (
                  <div key={word.id} className="rounded-2xl bg-white p-6 shadow-lg">
                    {editingWordId === word.id ? (
                      // Edit Form
                      <div className="space-y-4">
                        <h3 className="text-lg font-bold text-[#002844] mb-4">
                          {lang === 'fr' ? 'Éditer le mot' : 'Edit Word'}
                        </h3>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* word_target */}
                          <div>
                            <label className="block text-sm font-semibold text-[#002844] mb-1">
                              {lang === 'fr' ? 'Mot cible' : 'Target Word'} *
                            </label>
                            <input
                              type="text"
                              placeholder={lang === 'fr' ? 'Mot dans la langue cible' : 'Word in target language'}
                              value={editForm.word_target || ''}
                              onChange={(e) => setEditForm(prev => ({ ...prev, word_target: e.target.value }))}
                              className="w-full rounded-lg border-2 border-[#002844] px-3 py-2 text-sm focus:outline-none focus:border-[#D9B438]"
                            />
                          </div>

                          {/* word_fr */}
                          <div>
                            <label className="block text-sm font-semibold text-[#002844] mb-1">
                              {lang === 'fr' ? 'Traduction FR' : 'French Translation'} *
                            </label>
                            <input
                              type="text"
                              placeholder={lang === 'fr' ? 'Traduction en français' : 'French translation'}
                              value={editForm.word_fr || ''}
                              onChange={(e) => setEditForm(prev => ({ ...prev, word_fr: e.target.value }))}
                              className="w-full rounded-lg border-2 border-[#002844] px-3 py-2 text-sm focus:outline-none focus:border-[#D9B438]"
                            />
                          </div>

                          {/* definition_en */}
                          <div>
                            <label className="block text-sm font-semibold text-[#002844] mb-1">
                              {lang === 'fr' ? 'Définition EN' : 'English Definition'}
                            </label>
                            <input
                              type="text"
                              placeholder={lang === 'fr' ? 'Définition en anglais' : 'English definition'}
                              value={editForm.definition_en || ''}
                              onChange={(e) => setEditForm(prev => ({ ...prev, definition_en: e.target.value }))}
                              className="w-full rounded-lg border-2 border-[#002844] px-3 py-2 text-sm focus:outline-none focus:border-[#D9B438]"
                            />
                          </div>

                          {/* definition_fr */}
                          <div>
                            <label className="block text-sm font-semibold text-[#002844] mb-1">
                              {lang === 'fr' ? 'Définition FR' : 'French Definition'}
                            </label>
                            <input
                              type="text"
                              placeholder={lang === 'fr' ? 'Définition en français' : 'French definition'}
                              value={editForm.definition_fr || ''}
                              onChange={(e) => setEditForm(prev => ({ ...prev, definition_fr: e.target.value }))}
                              className="w-full rounded-lg border-2 border-[#002844] px-3 py-2 text-sm focus:outline-none focus:border-[#D9B438]"
                            />
                          </div>

                          {/* example_en */}
                          <div>
                            <label className="block text-sm font-semibold text-[#002844] mb-1">
                              {lang === 'fr' ? 'Exemple EN' : 'English Example'}
                            </label>
                            <input
                              type="text"
                              placeholder={lang === 'fr' ? 'Exemple en anglais' : 'English example'}
                              value={editForm.example_en || ''}
                              onChange={(e) => setEditForm(prev => ({ ...prev, example_en: e.target.value }))}
                              className="w-full rounded-lg border-2 border-[#002844] px-3 py-2 text-sm focus:outline-none focus:border-[#D9B438]"
                            />
                          </div>

                          {/* example_fr */}
                          <div>
                            <label className="block text-sm font-semibold text-[#002844] mb-1">
                              {lang === 'fr' ? 'Exemple FR' : 'French Example'}
                            </label>
                            <input
                              type="text"
                              placeholder={lang === 'fr' ? 'Exemple en français' : 'French example'}
                              value={editForm.example_fr || ''}
                              onChange={(e) => setEditForm(prev => ({ ...prev, example_fr: e.target.value }))}
                              className="w-full rounded-lg border-2 border-[#002844] px-3 py-2 text-sm focus:outline-none focus:border-[#D9B438]"
                            />
                          </div>

                          {/* theme */}
                          <div>
                            <label className="block text-sm font-semibold text-[#002844] mb-1">
                              {lang === 'fr' ? 'Thème' : 'Theme'} *
                            </label>
                            <select
                              value={editForm.theme || ''}
                              onChange={(e) => setEditForm(prev => ({ ...prev, theme: e.target.value }))}
                              className="w-full rounded-lg border-2 border-[#002844] px-3 py-2 text-sm focus:outline-none focus:border-[#D9B438]"
                            >
                              <option value="">{lang === 'fr' ? 'Sélectionner un thème' : 'Select a theme'}</option>
                              {(ALL_THEMES || []).map(theme => (
                                <option key={theme.id} value={theme.id}>{lang === 'fr' ? theme.nameFr : theme.nameEn}</option>
                              ))}
                            </select>
                          </div>

                          {/* level */}
                          <div>
                            <label className="block text-sm font-semibold text-[#002844] mb-1">
                              {lang === 'fr' ? 'Niveau' : 'Level'} *
                            </label>
                            <select
                              value={editForm.level || ''}
                              onChange={(e) => setEditForm(prev => ({ ...prev, level: e.target.value }))}
                              className="w-full rounded-lg border-2 border-[#002844] px-3 py-2 text-sm focus:outline-none focus:border-[#D9B438]"
                            >
                              <option value="">{lang === 'fr' ? 'Sélectionner un niveau' : 'Select a level'}</option>
                              {['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].map(lvl => (
                                <option key={lvl} value={lvl}>{lvl}</option>
                              ))}
                            </select>
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="flex gap-2 pt-4">
                          <button
                            onClick={() => {
                              const canValidate = editForm.word_target && editForm.word_fr && editForm.level && editForm.theme;
                              if (!canValidate) {
                                alert(lang === 'fr' ? 'Remplissez les champs obligatoires' : 'Fill required fields');
                                return;
                              }

                              // Validate the word
                              validateProposedWord(word.id);

                              // Save enriched data to vocabulary bank
                              const existingVocab = JSON.parse(localStorage.getItem('lingualearn_imported_vocab') || '[]');
                              const newVocabItem = {
                                id: crypto.randomUUID(),
                                language: word.language,
                                word_target: editForm.word_target,
                                word_fr: editForm.word_fr,
                                definition_en: editForm.definition_en || '',
                                definition_fr: editForm.definition_fr || '',
                                example_en: editForm.example_en || '',
                                example_fr: editForm.example_fr || '',
                                theme: editForm.theme,
                                level: editForm.level,
                                type: 'noun',
                                phonetic: '',
                                is_grc: '0',
                              };
                              existingVocab.push(newVocabItem);
                              localStorage.setItem('lingualearn_imported_vocab', JSON.stringify(existingVocab));

                              // Reset and refresh
                              setEditingWordId(null);
                              setEditForm({});
                              setPendingWordsCount(getPendingProposedWords().length);
                            }}
                            className="px-4 py-2 rounded-lg font-semibold text-white hover:opacity-90 transition-opacity flex items-center gap-2"
                            style={{ backgroundColor: '#2e7d32' }}
                          >
                            <CheckCircle className="h-4 w-4" />
                            {lang === 'fr' ? 'Valider' : 'Validate'}
                          </button>

                          <button
                            onClick={() => {
                              rejectProposedWord(word.id);
                              setEditingWordId(null);
                              setEditForm({});
                              setPendingWordsCount(getPendingProposedWords().length);
                            }}
                            className="px-4 py-2 rounded-lg font-semibold text-white hover:opacity-90 transition-opacity flex items-center gap-2"
                            style={{ backgroundColor: '#d32f2f' }}
                          >
                            <XCircle className="h-4 w-4" />
                            {lang === 'fr' ? 'Refuser' : 'Reject'}
                          </button>

                          <button
                            onClick={() => {
                              setEditingWordId(null);
                              setEditForm({});
                            }}
                            className="px-4 py-2 rounded-lg border-2 border-[#002844] font-semibold text-[#002844] hover:bg-[#002844]/5 transition-colors"
                          >
                            {lang === 'fr' ? 'Annuler' : 'Cancel'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      // Display mode
                      <div>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                          <div>
                            <p className="text-xs font-semibold text-[#555555] uppercase">
                              {lang === 'fr' ? 'Mot cible' : 'Target Word'}
                            </p>
                            <p className="text-sm font-semibold text-[#002844] mt-1">
                              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                              {(word as any).word_target || word.word || '-'}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-[#555555] uppercase">
                              {lang === 'fr' ? 'Traduction FR' : 'French Translation'}
                            </p>
                            <p className="text-sm font-semibold text-[#002844] mt-1">
                              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                              {(word as any).word_fr || word.definition || '-'}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-[#555555] uppercase">
                              {lang === 'fr' ? 'Langue' : 'Language'}
                            </p>
                            <p className="text-sm font-semibold text-[#D9B438] mt-1">
                              {word.language.toUpperCase()}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-[#555555] uppercase">
                              {lang === 'fr' ? 'Proposé par' : 'Proposed by'}
                            </p>
                            <p className="text-sm text-[#002844] mt-1">
                              {(() => {
                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                const proposerId = word.proposedBy || (word as any).userId || ''
                                const proposer = users.find(u => u.id === proposerId || u.email === proposerId)
                                return proposer ? proposer.firstName : (proposerId || '-')
                              })()}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-[#555555] uppercase">
                              {lang === 'fr' ? 'Date' : 'Date'}
                            </p>
                            <p className="text-sm text-[#002844] mt-1">
                              {new Date(word.createdAt).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US')}
                            </p>
                          </div>
                        </div>

                        <div className="flex gap-2 pt-4 border-t border-gray-200">
                          <button
                            onClick={() => {
                              setEditingWordId(word.id);
                              // eslint-disable-next-line @typescript-eslint/no-explicit-any
                              const wordAny = word as any;
                              setEditForm({
                                word_target: wordAny.word_target || '',
                                word_fr: wordAny.word_fr || '',
                                definition_en: '',
                                definition_fr: '',
                                example_en: '',
                                example_fr: '',
                                theme: '',
                                level: '',
                              });
                            }}
                            className="px-4 py-2 rounded-lg font-semibold text-white hover:opacity-90 transition-opacity flex items-center gap-2"
                            style={{ backgroundColor: '#1976d2' }}
                          >
                            {lang === 'fr' ? 'Éditer' : 'Edit'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

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

                {/* File input */}
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
        {/* BUG-80: Images Vocab tab */}
        {activeTab === 'images' && (
          <div>
            <div className="mb-8">
              <h2 className="text-3xl font-bold text-[#002844] flex items-center gap-2 mb-2">
                🖼️ {lang === 'fr' ? 'Images vocabulaire V4' : 'V4 Vocabulary Images'}
              </h2>
              <p className="text-[#555555]">
                {lang === 'fr'
                  ? 'Ajoutez une URL d\'image (Unsplash/Pexels) pour chaque mot de vocabulaire.'
                  : 'Add an image URL (Unsplash/Pexels) for each vocabulary word.'}
              </p>
            </div>
            {BANK_A1_COURSES.map(course => (
              <div key={course.id} className="mb-6 bg-white rounded-2xl p-4 shadow-sm">
                <h3 className="text-sm font-bold text-[#002844] mb-3">
                  Cours {course.number} — {course.title} ({course.vocabulary.length} mots)
                </h3>
                <div className="grid gap-2">
                  {course.vocabulary.map((v, idx) => (
                    <div key={idx} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                      <div className="w-12 h-12 rounded-lg bg-gray-200 flex items-center justify-center overflow-hidden flex-shrink-0">
                        {v.image
                          ? <img src={v.image} alt={v.word} className="w-12 h-12 object-cover" />
                          : <span className="text-xs text-gray-400">?</span>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-[#002844]">{v.word}</p>
                        <p className="text-xs text-[#555555]">{v.trad_fr}</p>
                      </div>
                      <input
                        type="url"
                        placeholder="URL image..."
                        defaultValue={v.image || ''}
                        className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-xs focus:border-[#002844] focus:outline-none"
                        onBlur={(e) => {
                          // Save image URL to localStorage for admin override
                          const key = `lingualearn_vocab_image_${course.id}_${idx}`;
                          if (e.target.value) localStorage.setItem(key, e.target.value);
                          else localStorage.removeItem(key);
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
      {/* V3.10 Règle 1: Menu bas permanent */}
      <BottomNav lang={lang} />
    </div>
  )
}
