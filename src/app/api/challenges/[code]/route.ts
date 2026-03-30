/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * GET /api/challenges/[code]
 * Get challenge details with all participants and scores
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseQuery } from '@/lib/supabase'

interface RouteContext {
  params: Promise<{ code: string }>
}

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const { code } = await context.params

    if (!code) {
      return NextResponse.json({ error: 'Challenge code is required' }, { status: 400 })
    }

    // Fetch challenge by code
    const challengeRes = await supabaseQuery('challenges', 'GET', {
      filters: `code=eq.${encodeURIComponent(code)}`,
    })

    if (challengeRes.error) {
      console.error('[CHALLENGE] Failed to fetch challenge:', challengeRes.error)
      return NextResponse.json({ error: 'Failed to fetch challenge' }, { status: 500 })
    }

    const challenges = (challengeRes.data || []) as any[]
    if (challenges.length === 0) {
      return NextResponse.json({ error: 'Challenge not found' }, { status: 404 })
    }

    const challenge = challenges[0]

    // Fetch all participants for this challenge
    const participantsRes = await supabaseQuery('challenge_participants', 'GET', {
      filters: `challenge_id=eq.${encodeURIComponent(challenge.id)}`,
      order: 'score.desc',
    })

    if (participantsRes.error) {
      console.error('[CHALLENGE] Failed to fetch participants:', participantsRes.error)
      return NextResponse.json({ error: 'Failed to fetch participants' }, { status: 500 })
    }

    const participants = (participantsRes.data || []) as any[]

    return NextResponse.json({
      ...challenge,
      participants,
    })
  } catch (err) {
    console.error('[CHALLENGE] GET detail error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
