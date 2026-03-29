// ==========================================
// LINGUALEARN ENGINE — Translation Store
// Architecture V2.1.1 Phase 14
// CanonicalContent + LocalizedContent system
// English = canonical, 6 target languages
// ==========================================

import type { LangueId } from './types';
import type { ContentStatus } from './contentStore';

// --- Supported target languages (non-canonical) ---
export const TARGET_LANGUAGES: LangueId[] = ['es', 'ko', 'ar', 'zh', 'ja', 'fr'];
export const ALL_CONTENT_LANGUAGES: LangueId[] = ['en', ...TARGET_LANGUAGES];

// --- Types ---
export type TranslationContentType = 'vocab' | 'grammar_rule' | 'grammar_exercise' | 'reading' | 'speaking' | 'writing';

export interface CanonicalEntry {
  id: string;                         // e.g. en_a1_c1_w1
  type: TranslationContentType;
  langueId: 'en';                     // English is always canonical
  status: ContentStatus;              // 'validated' for all existing EN content
  createdAt: string;
  updatedAt: string;
}

export interface LocalizedEntry {
  canonicalId: string;                // references CanonicalEntry.id
  targetLangueId: LangueId;          // langue cible de la traduction
  status: ContentStatus;             // 'draft' | 'validated' | 'override' | 'rejected'
  data: Record<string, string>;      // translated fields (word_target, definition_target, etc.)
  translatedAt: string;
  validatedBy?: string;              // admin email/name
}

export interface TranslationProgress {
  langueId: LangueId;
  total: number;
  translated: number;
  validated: number;
  draft: number;
  rejected: number;
  percent: number;
}

// --- Storage keys ---
const CANONICAL_KEY = 'lingualearn_canonical_entries';
const LOCALIZED_KEY = 'lingualearn_localized_entries';

// --- Logging ---
function logTranslation(action: string, data?: unknown): void {
  console.log(`[Engine:TranslationStore] ${action}`, data ?? '');
}

// ============================================
// CANONICAL ENTRIES
// ============================================

/** Get all canonical entries from localStorage */
export function getCanonicalEntries(): CanonicalEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(CANONICAL_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/** Save canonical entries */
function saveCanonicalEntries(entries: CanonicalEntry[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(CANONICAL_KEY, JSON.stringify(entries));
  } catch (e) {
    console.error('[Engine:TranslationStore] Failed to save canonical:', e);
  }
}

/** Register a canonical entry (idempotent) */
export function registerCanonical(id: string, type: TranslationContentType): CanonicalEntry {
  const entries = getCanonicalEntries();
  const existing = entries.find(e => e.id === id);
  if (existing) return existing;

  const entry: CanonicalEntry = {
    id,
    type,
    langueId: 'en',
    status: 'validated',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  entries.push(entry);
  saveCanonicalEntries(entries);
  logTranslation('canonical registered', { id, type });
  return entry;
}

/** Bulk register canonical entries from existing content */
export function syncCanonicalFromContent(vocabIds: string[], grammarRuleIds: string[]): number {
  const entries = getCanonicalEntries();
  const existingIds = new Set(entries.map(e => e.id));
  let added = 0;
  const now = new Date().toISOString();

  for (const id of vocabIds) {
    if (!existingIds.has(id)) {
      entries.push({
        id, type: 'vocab', langueId: 'en',
        status: 'validated', createdAt: now, updatedAt: now,
      });
      added++;
    }
  }

  for (const id of grammarRuleIds) {
    if (!existingIds.has(id)) {
      entries.push({
        id, type: 'grammar_rule', langueId: 'en',
        status: 'validated', createdAt: now, updatedAt: now,
      });
      added++;
    }
  }

  if (added > 0) {
    saveCanonicalEntries(entries);
    logTranslation('canonical synced', { added, total: entries.length });
  }

  return added;
}

// ============================================
// LOCALIZED ENTRIES
// ============================================

/** Get all localized entries */
export function getLocalizedEntries(): LocalizedEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCALIZED_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/** Save localized entries */
function saveLocalizedEntries(entries: LocalizedEntry[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCALIZED_KEY, JSON.stringify(entries));
  } catch (e) {
    console.error('[Engine:TranslationStore] Failed to save localized:', e);
  }
}

/** Get localized entries for a specific language */
export function getLocalizedForLanguage(langueId: LangueId): LocalizedEntry[] {
  return getLocalizedEntries().filter(e => e.targetLangueId === langueId);
}

/** Get localized entry for a specific canonical ID + language */
export function getLocalizedEntry(canonicalId: string, targetLangueId: LangueId): LocalizedEntry | null {
  return getLocalizedEntries().find(
    e => e.canonicalId === canonicalId && e.targetLangueId === targetLangueId
  ) || null;
}

/** Upsert a localized entry (create or update) */
export function upsertLocalizedEntry(
  canonicalId: string,
  targetLangueId: LangueId,
  data: Record<string, string>,
  status: ContentStatus = 'draft'
): LocalizedEntry {
  const entries = getLocalizedEntries();
  const idx = entries.findIndex(
    e => e.canonicalId === canonicalId && e.targetLangueId === targetLangueId
  );

  const entry: LocalizedEntry = {
    canonicalId,
    targetLangueId,
    status,
    data,
    translatedAt: new Date().toISOString(),
  };

  if (idx >= 0) {
    entries[idx] = entry;
  } else {
    entries.push(entry);
  }

  saveLocalizedEntries(entries);
  logTranslation('localized upserted', { canonicalId, targetLangueId, status });
  return entry;
}

/** Validate a localized entry (admin action) */
export function validateLocalizedEntry(
  canonicalId: string,
  targetLangueId: LangueId,
  validatedBy: string
): LocalizedEntry | null {
  const entries = getLocalizedEntries();
  const idx = entries.findIndex(
    e => e.canonicalId === canonicalId && e.targetLangueId === targetLangueId
  );

  if (idx < 0) return null;

  entries[idx].status = 'validated';
  entries[idx].validatedBy = validatedBy;
  saveLocalizedEntries(entries);

  logTranslation('localized validated', { canonicalId, targetLangueId, validatedBy });
  return entries[idx];
}

/** Reject a localized entry (admin action) */
export function rejectLocalizedEntry(
  canonicalId: string,
  targetLangueId: LangueId
): LocalizedEntry | null {
  const entries = getLocalizedEntries();
  const idx = entries.findIndex(
    e => e.canonicalId === canonicalId && e.targetLangueId === targetLangueId
  );

  if (idx < 0) return null;

  entries[idx].status = 'rejected';
  saveLocalizedEntries(entries);

  logTranslation('localized rejected', { canonicalId, targetLangueId });
  return entries[idx];
}

// ============================================
// TRANSLATION PROGRESS
// ============================================

/** Get translation progress per language */
export function getTranslationProgress(): TranslationProgress[] {
  const canonical = getCanonicalEntries();
  const localized = getLocalizedEntries();
  const total = canonical.length;

  return TARGET_LANGUAGES.map(langueId => {
    const langEntries = localized.filter(e => e.targetLangueId === langueId);
    const validated = langEntries.filter(e => e.status === 'validated').length;
    const draft = langEntries.filter(e => e.status === 'draft').length;
    const rejected = langEntries.filter(e => e.status === 'rejected').length;
    const translated = langEntries.length;

    return {
      langueId,
      total,
      translated,
      validated,
      draft,
      rejected,
      percent: total > 0 ? Math.round((validated / total) * 100) : 0,
    };
  });
}

/** STATUS VALIDATION RULE: Only 'validated' localized content is served to users */
export function getValidatedTranslation(
  canonicalId: string,
  targetLangueId: LangueId
): Record<string, string> | null {
  const entry = getLocalizedEntry(canonicalId, targetLangueId);
  if (!entry || entry.status !== 'validated') return null;
  return entry.data;
}

/** Bulk import translations for a language (admin CSV import) */
export function bulkImportTranslations(
  targetLangueId: LangueId,
  translations: Array<{ canonicalId: string; data: Record<string, string> }>,
  status: ContentStatus = 'draft'
): number {
  let imported = 0;
  for (const t of translations) {
    upsertLocalizedEntry(t.canonicalId, targetLangueId, t.data, status);
    imported++;
  }
  logTranslation('bulk import', { targetLangueId, imported });
  return imported;
}

/** Initialize empty localized structures for all target languages */
export function initializeEmptyLocalizations(): void {
  const canonical = getCanonicalEntries();
  if (canonical.length === 0) return;

  const localized = getLocalizedEntries();
  const existingKeys = new Set(
    localized.map(e => `${e.canonicalId}__${e.targetLangueId}`)
  );

  const newEntries: LocalizedEntry[] = [...localized];
  let added = 0;

  for (const lang of TARGET_LANGUAGES) {
    for (const can of canonical) {
      const key = `${can.id}__${lang}`;
      if (!existingKeys.has(key)) {
        newEntries.push({
          canonicalId: can.id,
          targetLangueId: lang,
          status: 'draft',
          data: {},
          translatedAt: '',
        });
        added++;
      }
    }
  }

  if (added > 0) {
    saveLocalizedEntries(newEntries);
    logTranslation('empty localizations initialized', { added });
  }
}
