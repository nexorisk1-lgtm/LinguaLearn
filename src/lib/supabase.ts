/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Server-only Supabase client using fetch() directly (no SDK)
 * NEVER import this from client components — use API routes instead
 * Uses service key for full database access
 */

import { randomBytes } from 'crypto'

const SUPABASE_URL = process.env.SUPABASE_URL || ''
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || ''

interface SupabaseResponse<T = any> {
  data: T | null
  error: string | null
}

interface QueryOptions {
  body?: any
  filters?: string // e.g. "user_id=eq.abc123&week_start=eq.2026-03-30"
  select?: string
  order?: string
  limit?: number
  upsert?: boolean
}

/**
 * Make a PostgREST API call to Supabase
 * Uses service key for authorization
 */
export async function supabaseQuery<T = any>(
  table: string,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  options: QueryOptions = {}
): Promise<SupabaseResponse<T>> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return {
      data: null,
      error: 'Supabase not configured. Set SUPABASE_URL and SUPABASE_SERVICE_KEY env vars.',
    }
  }

  try {
    // Build base URL
    let url = `${SUPABASE_URL}/rest/v1/${table}`

    // Add query parameters for GET requests
    const params = new URLSearchParams()
    if (options.select) params.append('select', options.select)
    if (options.order) params.append('order', options.order)
    if (options.limit) params.append('limit', options.limit.toString())
    if (options.filters) {
      // filters come as raw PostgREST filter string
      url += `?${options.filters}`
    }
    if (params.toString()) {
      url += (options.filters ? '&' : '?') + params.toString()
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    }

    // Add Prefer header for upsert
    if (options.upsert && (method === 'POST' || method === 'PATCH')) {
      headers['Prefer'] = 'resolution=merge-duplicates'
    }

    const fetchOptions: RequestInit = {
      method,
      headers,
    }

    if (options.body && (method === 'POST' || method === 'PATCH')) {
      fetchOptions.body = JSON.stringify(options.body)
    }

    const response = await fetch(url, fetchOptions)

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`[SUPABASE] ${method} ${table} failed:`, {
        status: response.status,
        error: errorText,
      })
      return {
        data: null,
        error: `Supabase error: ${response.status}`,
      }
    }

    // DELETE responses return 204 with no body
    if (method === 'DELETE' && response.status === 204) {
      return {
        data: null,
        error: null,
      }
    }

    const data = await response.json()
    return {
      data: data as T,
      error: null,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[SUPABASE] Query failed:`, { table, method, message })
    return {
      data: null,
      error: message,
    }
  }
}

/**
 * Generate a 6-character challenge code
 * Uses uppercase alphanumeric, excludes ambiguous characters (I, O, 0, 1, L)
 */
export function generateChallengeCode(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789' // Exclude I, O, 0, 1, L
  let code = ''
  const bytes = randomBytes(6)
  for (let i = 0; i < 6; i++) {
    code += chars[bytes[i] % chars.length]
  }
  return code
}

/**
 * Get the current week start date (Monday 00:00 UTC)
 */
export function getCurrentWeekStart(): string {
  const now = new Date()
  const utcDay = now.getUTCDay()
  const daysToMonday = utcDay === 0 ? 6 : utcDay - 1
  const monday = new Date(now)
  monday.setUTCDate(monday.getUTCDate() - daysToMonday)
  monday.setUTCHours(0, 0, 0, 0)

  // Return as YYYY-MM-DD
  return monday.toISOString().split('T')[0]
}
