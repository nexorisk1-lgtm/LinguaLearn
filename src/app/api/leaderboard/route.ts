/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * GET /api/leaderboard?userId=xxx
 * Return top 10 users by total_score for current week
 * Also include requesting user's rank and score (even if not in top 10)
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseQuery, getCurrentWeekStart } from '@/lib/supabase'

interface LeaderboardEntry {
  rank: number
  user_id: string
  user_name: string
  total_score: number
  learning_score: number
  game_score: number
  is_current_user: boolean
}

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json({ error: 'Missing userId query parameter' }, { status: 400 })
    }

    const weekStart = getCurrentWeekStart()

    // Fetch all scores for the current week, ordered by total_score descending
    const scoresRes = await supabaseQuery('weekly_scores', 'GET', {
      filters: `week_start=eq.${weekStart}`,
      order: 'total_score.desc',
    })

    if (scoresRes.error) {
      console.error('[LEADERBOARD] Failed to fetch scores:', scoresRes.error)
      return NextResponse.json({ error: 'Failed to fetch leaderboard' }, { status: 500 })
    }

    const allScores = (scoresRes.data || []) as any[]

    // Build leaderboard with ranks
    const leaderboard: LeaderboardEntry[] = allScores.slice(0, 10).map((score, index) => ({
      rank: index + 1,
      user_id: score.user_id,
      user_name: score.user_name,
      total_score: score.total_score,
      learning_score: score.learning_score,
      game_score: score.game_score,
      is_current_user: score.user_id === userId,
    }))

    // Find requesting user's position
    let userPosition: LeaderboardEntry | null = null
    const userScoreIndex = allScores.findIndex((s) => s.user_id === userId)

    if (userScoreIndex >= 0) {
      const userScore = allScores[userScoreIndex]
      userPosition = {
        rank: userScoreIndex + 1,
        user_id: userScore.user_id,
        user_name: userScore.user_name,
        total_score: userScore.total_score,
        learning_score: userScore.learning_score,
        game_score: userScore.game_score,
        is_current_user: true,
      }

      // Only add to leaderboard if not already in top 10
      if (userScoreIndex >= 10) {
        leaderboard.push(userPosition)
      }
    }

    return NextResponse.json({
      week_start: weekStart,
      leaderboard,
      user_position: userPosition,
    })
  } catch (err) {
    console.error('[LEADERBOARD] GET error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
