import { NextRequest, NextResponse } from 'next/server'

/**
 * P0-B: Google Cloud TTS Neural2 API route
 * Provides native-quality pronunciation for English and French.
 * Falls back to 400 error if no API key configured (client uses Web Speech API).
 *
 * POST /api/tts
 * Body: { text: string, lang: 'en' | 'fr' }
 * Returns: audio/mp3 binary
 */

const GOOGLE_TTS_URL = 'https://texttospeech.googleapis.com/v1/text:synthesize'

// Neural2 voices — native quality
const VOICES: Record<string, { languageCode: string; name: string }> = {
  en: { languageCode: 'en-US', name: 'en-US-Neural2-J' },  // Male, natural US English
  fr: { languageCode: 'fr-FR', name: 'fr-FR-Neural2-B' },  // Male, natural French
}

export async function POST(request: NextRequest) {
  try {
    const { text, lang } = await request.json()

    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'Missing text' }, { status: 400 })
    }

    const apiKey = process.env.GOOGLE_CLOUD_TTS_KEY
    if (!apiKey) {
      // No API key → client should fall back to Web Speech API
      return NextResponse.json({ error: 'TTS not configured' }, { status: 503 })
    }

    const voice = VOICES[lang] || VOICES.en
    const cleanText = text.slice(0, 500) // Limit length

    const response = await fetch(`${GOOGLE_TTS_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: { text: cleanText },
        voice: {
          languageCode: voice.languageCode,
          name: voice.name,
        },
        audioConfig: {
          audioEncoding: 'MP3',
          speakingRate: 0.9,
          pitch: 0,
        },
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      console.error('Google TTS error:', err)
      return NextResponse.json({ error: 'TTS API error' }, { status: 502 })
    }

    const data = await response.json()
    const audioContent = data.audioContent // base64 encoded MP3

    if (!audioContent) {
      return NextResponse.json({ error: 'No audio content' }, { status: 502 })
    }

    // Return base64 audio as JSON (simpler for client to handle)
    return NextResponse.json({ audio: audioContent, format: 'mp3' })
  } catch (error) {
    console.error('TTS route error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
