/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * POST /api/scores
 * Submit a score for the current week
 * Updates weekly_scores and challenge_participants if applicable
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseQuery, getCurrentWeekStart } from '@/lib/supabase'

const VALID_SCORE_TYPES = new Set(['learning', 'game', 'battle'])

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // Strict validation
    const { userId, userName, score, scoreType, source } = body
    if (!userId || !userName || score === undefined || !scoreType || !source) {
      return NextResponse.json(
        {
          error: 'Missing required fields: userId, userName, score, scoreType, source',
        },
        { status: 400 }
      )
    }

    // Reject unknown fields
    const allowedKeys = new Set(['userId', 'userName', 'score', 'scoreType', 'source'])
    for (const key of Object.keys(body)) {
      if (!allowedKeys.has(key)) {
        return NextResponse.json({ error: `Unknown field: ${key}` }, { status: 400 })
      }
    }

    // Validate score is a positive number
    if (typeof score !== 'number' || score <= 0) {
      return NextResponse.json(
        { error: 'Score must be a positive number' },
        { status: 400 }
      )
    }

    // Validate scoreType
    if (!VALID_SCORE_TYPES.has(scoreType)) {
      return NextResponse.json(
        {
          error: `Invalid scoreType. Must be one of: ${Array.from(VALID_SCORE_TYPES).join(', ')}`,
        },
        { status: 400 }
      )
    }

    // Get current week start
    const weekStart = getCurrentWeekStart()

    // Check if user already has a weekly_scores row
    const existingScoreRes = await supabaseQuery('weekly_scores', 'GET', {
      filters: `user_id=eq.${encodeURIComponent(userId)}&week_start=eq.${weekStart}`,
    })

    if (existingScoreRes.error) {
      console.error('[SCORE] Failed to check existing score:', existingScoreRes.error)
      return NextResponse.json({ error: 'Failed to submit score' }, { status: 500 })
    }

    const existingScores = (existingScoreRes.data || []) as any[]

    // Security: verify userName consistency if user already has a score
    if (existingScores.length > 0) {
      const existingScore = existingScores[0]
      if (existingScore.user_name !== userName) {
        console.error('[SCORE] Username mismatch - possible impersonation attempt', {
          userId,
          expectedName: existingScore.user_name,
          providedName: userName,
        })
        return NextResponse.json(
          { error: 'Username does not match existing record' },
          { status: 403 }
        )
      }
    }

    // If user exists, we need to add to existing scores
    let upsertBody: any

    if (existingScores.length > 0) {
      const existing = existingScores[0]
      const updatedLearning =
        scoreType === 'learning' ? existing.learning_score + score : existing.learning_score
      const updatedGame =
        scoreType === 'game' ? existing.game_score + score : existing.game_score

      upsertBody = {
        user_id: userId,
        user_name: userName,
        week_start: weekStart,
        learning_score: updatedLearning,
        game_score: updatedGame,
        total_score: updatedLearning + updatedGame,
      }
    } else {
      upsertBody = {
        user_id: userId,
        user_name: userName,
        week_start: weekStart,
        learning_score: scoreType === 'learning' ? score : 0,
        game_score: scoreType === 'game' || scoreType === 'battle' ? score : 0,
        total_score: score,
      }
    }

    // Upsert weekly_scores
    const upsertRes = await supabaseQuery('weekly_scores', 'POST', {
      body: upsertBody,
      upsert: true,
    })

    if (upsertRes.error) {
      console.error('[SCORE] Failed to upsert weekly score:', upsertRes.error)
      return NextResponse.json({ error: 'Failed to submit score' }, { status: 500 })
    }

    // Update challenge_participants scores if user is in any active challenges
    const participantRes = await supabaseQuery('challenge_participants', 'GET', {
      filters: `user_id=eq.${encodeURIComponent(userId)}`,
    })

    if (participantRes.error) {
      console.error('[SCORE] Failed to fetch challenge participants:', participantRes.error)
      // Don't fail the score submission, but log the error
    } else {
      const participants = (participantRes.data || []) as any[]

      // Update each challenge participant's score
      for (const participant of participants) {
        const newScore = participant.score + score
        await supabaseQuery('challenge_participants', 'PATCH', {
          filters: `id=eq.${encodeURIComponent(participant.id)}`,
          body: { score: newScore },
        })
      }
    }

    console.log('[SCORE] Submitted:', { userId, score, scoreType, source })

    return NextResponse.json({
      success: true,
      message: 'Score submitted successfully',
      week_start: weekStart,
    })
  } catch (err) {
    console.error('[SCORE] POST error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
