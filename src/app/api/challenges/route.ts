/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * POST: Create a new challenge
 * GET: List challenges for a user
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseQuery, generateChallengeCode } from '@/lib/supabase'

/**
 * POST /api/challenges
 * Create a new challenge
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // Strict validation
    const { userId, userName, type, duration } = body
    if (!userId || !userName || !type || duration === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, userName, type, duration' },
        { status: 400 }
      )
    }

    if (!['solo', 'duo'].includes(type)) {
      return NextResponse.json({ error: 'Invalid type. Must be solo or duo.' }, { status: 400 })
    }

    if (typeof duration !== 'number' || duration <= 0) {
      return NextResponse.json({ error: 'Duration must be a positive number' }, { status: 400 })
    }

    // Reject unknown fields
    const allowedKeys = new Set(['userId', 'userName', 'type', 'duration'])
    for (const key of Object.keys(body)) {
      if (!allowedKeys.has(key)) {
        return NextResponse.json({ error: `Unknown field: ${key}` }, { status: 400 })
      }
    }

    // Generate challenge code
    const code = generateChallengeCode()

    // Calculate end date
    const now = new Date()
    const endDate = new Date(now.getTime() + duration * 24 * 60 * 60 * 1000)

    // Create challenge
    const challengeRes = await supabaseQuery('challenges', 'POST', {
      body: {
        code,
        creator_id: userId,
        type,
        status: 'active',
        end_date: endDate.toISOString(),
      },
    })

    if (challengeRes.error) {
      console.error('[CHALLENGE] Failed to create:', challengeRes.error)
      return NextResponse.json({ error: 'Failed to create challenge' }, { status: 500 })
    }

    const challenge = challengeRes.data?.[0] || challengeRes.data

    // Add creator as first participant
    const participantRes = await supabaseQuery('challenge_participants', 'POST', {
      body: {
        challenge_id: challenge.id,
        user_id: userId,
        user_name: userName,
        score: 0,
      },
    })

    if (participantRes.error) {
      console.error('[CHALLENGE] Failed to add creator as participant:', participantRes.error)
      return NextResponse.json(
        { error: 'Failed to create challenge participant' },
        { status: 500 }
      )
    }

    console.log('[CHALLENGE] Created:', { id: challenge.id, code, creator: userId })

    return NextResponse.json({
      id: challenge.id,
      code,
      type,
      creator_id: userId,
      status: 'active',
      end_date: endDate.toISOString(),
    })
  } catch (err) {
    console.error('[CHALLENGE] POST error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * GET /api/challenges?userId=xxx
 * List all challenges where user is a participant
 */
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json({ error: 'Missing userId query parameter' }, { status: 400 })
    }

    // Query challenge_participants to find all challenges for this user
    const participantRes = await supabaseQuery('challenge_participants', 'GET', {
      filters: `user_id=eq.${encodeURIComponent(userId)}`,
      select: 'challenge_id',
    })

    if (participantRes.error) {
      console.error('[CHALLENGE] Failed to fetch participants:', participantRes.error)
      return NextResponse.json({ error: 'Failed to fetch challenges' }, { status: 500 })
    }

    const participants = (participantRes.data || []) as any[]
    const challengeIds = participants.map((p) => p.challenge_id)

    if (challengeIds.length === 0) {
      return NextResponse.json([])
    }

    // Fetch full challenge details
    // Use PostgreSQL IN operator by making multiple requests or fetch all and filter
    // For simplicity, fetch all challenges and filter client-side
    const challengesRes = await supabaseQuery('challenges', 'GET', {})

    if (challengesRes.error) {
      console.error('[CHALLENGE] Failed to fetch challenges:', challengesRes.error)
      return NextResponse.json({ error: 'Failed to fetch challenges' }, { status: 500 })
    }

    const allChallenges = (challengesRes.data || []) as any[]
    const userChallenges = allChallenges.filter((c) => challengeIds.includes(c.id))

    return NextResponse.json(userChallenges)
  } catch (err) {
    console.error('[CHALLENGE] GET error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
