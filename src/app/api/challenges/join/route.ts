/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * POST /api/challenges/join
 * Join an existing challenge by code
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseQuery } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // Strict validation
    const { userId, userName, code } = body
    if (!userId || !userName || !code) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, userName, code' },
        { status: 400 }
      )
    }

    // Reject unknown fields
    const allowedKeys = new Set(['userId', 'userName', 'code'])
    for (const key of Object.keys(body)) {
      if (!allowedKeys.has(key)) {
        return NextResponse.json({ error: `Unknown field: ${key}` }, { status: 400 })
      }
    }

    // Find challenge by code
    const challengeRes = await supabaseQuery('challenges', 'GET', {
      filters: `code=eq.${encodeURIComponent(code)}`,
      select: 'id,status,end_date',
    })

    if (challengeRes.error) {
      console.error('[CHALLENGE] Failed to fetch challenge:', challengeRes.error)
      return NextResponse.json({ error: 'Failed to fetch challenge' }, { status: 500 })
    }

    const challenges = (challengeRes.data || []) as any[]
    if (challenges.length === 0) {
      return NextResponse.json({ error: 'Challenge code not found' }, { status: 404 })
    }

    const challenge = challenges[0]

    // Check if challenge is still active
    if (challenge.status !== 'active') {
      return NextResponse.json({ error: 'Challenge is not active' }, { status: 400 })
    }

    // Check if end date has passed
    if (new Date(challenge.end_date) < new Date()) {
      return NextResponse.json({ error: 'Challenge has ended' }, { status: 400 })
    }

    // Check if user is already a participant
    const existingParticipantRes = await supabaseQuery('challenge_participants', 'GET', {
      filters: `challenge_id=eq.${encodeURIComponent(challenge.id)}&user_id=eq.${encodeURIComponent(userId)}`,
    })

    if (existingParticipantRes.error) {
      console.error('[CHALLENGE] Failed to check existing participant:', existingParticipantRes.error)
      return NextResponse.json({ error: 'Failed to verify participation' }, { status: 500 })
    }

    const existingParticipants = (existingParticipantRes.data || []) as any[]
    if (existingParticipants.length > 0) {
      return NextResponse.json(
        { error: 'User is already a participant in this challenge' },
        { status: 400 }
      )
    }

    // Add user as participant
    const joinRes = await supabaseQuery('challenge_participants', 'POST', {
      body: {
        challenge_id: challenge.id,
        user_id: userId,
        user_name: userName,
        score: 0,
      },
    })

    if (joinRes.error) {
      console.error('[CHALLENGE] Failed to add participant:', joinRes.error)
      return NextResponse.json({ error: 'Failed to join challenge' }, { status: 500 })
    }

    console.log('[CHALLENGE] Joined:', { code, userId })

    return NextResponse.json({
      success: true,
      challenge_id: challenge.id,
      message: 'Successfully joined challenge',
    })
  } catch (err) {
    console.error('[CHALLENGE] JOIN error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
