/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'

// P0-1: Coach LLM API route — Gemini Flash
// Fallback: rule-based if API key missing or error

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent'

interface CoachRequest {
  userMessage: string
  courseId: string
  mode: 'discussion' | 'revision'
  courseWords: { word: string; trad: string; example_en?: string; phonetic?: string }[]
  conversationHistory: { role: string; text: string }[]
  userName: string
  interfaceLang: string
}

function buildSystemPrompt(req: CoachRequest): string {
  const wordList = req.courseWords.map(w => `- ${w.word} = ${w.trad}${w.example_en ? ` (ex: "${w.example_en}")` : ''}`).join('\n')

  return `Tu es le coach de l'app LinguaLearn.
Tu travailles UNIQUEMENT sur les mots du cours en cours.
Cours actuel : ${req.courseId}
Mots autorisés :
${wordList}
Mode actif : ${req.mode === 'discussion' ? 'Discussion' : 'Révision ciblée'}

Règles absolues :
- Uniquement le vocabulaire de la liste transmise
- Valider toute réponse sémantiquement correcte
- Distinguer : réponse exacte / acceptable / incorrecte
- Toujours expliquer après validation ou correction
- Français sauf contenu en anglais
- Niveau A1 : phrases courtes, vocabulaire simple
- Toujours prendre l'initiative : poser une question, ne pas attendre
- Jamais de message générique ou de répétition inutile

Classification des réponses :
1. Si la réponse correspond EXACTEMENT à un mot de la liste → "Exactement ! ✅" + explication courte
2. Si la réponse correspond à un AUTRE mot de la liste → "Oui, ça marche aussi ⚠️" + nuance (explique la différence)
3. Sinon → "On cherchait X ❌" + explication + exemple

Boucle conversationnelle :
1. Pose UNE question claire (mode discussion = mise en situation / mode révision = traduction directe)
2. Attends la réponse
3. Classe et donne un feedback (exacte/acceptable/incorrecte)
4. Donne UNE explication courte
5. Enchaîne sur le mot suivant

Format de réponse : texte naturel, 2-4 phrases max. Pas de markdown, pas de listes à puces.
L'utilisateur s'appelle ${req.userName}.
Langue d'interface : ${req.interfaceLang === 'fr' ? 'français' : 'anglais'}.`
}

function buildConversation(req: CoachRequest): any[] {
  const messages: any[] = []

  // Add history (last 10 exchanges max for context window)
  const recentHistory = req.conversationHistory.slice(-10)
  for (const msg of recentHistory) {
    messages.push({
      role: msg.role === 'coach' ? 'model' : 'user',
      parts: [{ text: msg.text }],
    })
  }

  // Add current user message
  messages.push({
    role: 'user',
    parts: [{ text: req.userMessage }],
  })

  return messages
}

// Rule-based fallback when API is unavailable
function generateFallbackResponse(req: CoachRequest): string {
  const userText = req.userMessage.toLowerCase().trim()
  const words = req.courseWords
  const isFr = req.interfaceLang === 'fr'

  // Check "I don't know"
  const unknownPhrases = ['je ne sais pas', "i don't know", 'idk', 'dunno', 'no idea', 'i dont know', 'aucune idée']
  if (unknownPhrases.some(p => userText === p || userText.includes(p))) {
    const randomWord = words[Math.floor(Math.random() * words.length)]
    return isFr
      ? `Pas de souci ! La réponse était "${randomWord.word}" (${randomWord.trad}). On continue : comment dit-on "${words[(words.indexOf(randomWord) + 1) % words.length].trad}" en anglais ?`
      : `No worries! The answer was "${randomWord.word}" (${randomWord.trad}). Let's continue: how do you say "${words[(words.indexOf(randomWord) + 1) % words.length].trad}" in English?`
  }

  // Check exact match
  const exactMatch = words.find(w => w.word.toLowerCase() === userText || w.trad.toLowerCase() === userText)
  if (exactMatch) {
    const nextIdx = (words.indexOf(exactMatch) + 1) % words.length
    const next = words[nextIdx]
    return isFr
      ? `Exactement ! ✅ "${exactMatch.word}" = ${exactMatch.trad}. ${exactMatch.example_en ? `Ex: "${exactMatch.example_en}"` : ''} Suivant : comment dit-on "${next.trad}" en anglais ?`
      : `Exactly! ✅ "${exactMatch.word}" = ${exactMatch.trad}. ${exactMatch.example_en ? `Ex: "${exactMatch.example_en}"` : ''} Next: how do you say "${next.trad}" in English?`
  }

  // Check acceptable (another word from the list)
  const acceptable = words.find(w =>
    userText.includes(w.word.toLowerCase()) || userText.includes(w.trad.toLowerCase())
  )
  if (acceptable) {
    const next = words[(words.indexOf(acceptable) + 1) % words.length]
    return isFr
      ? `Oui, ça marche aussi ⚠️ "${acceptable.word}" = ${acceptable.trad}. On continue : comment dit-on "${next.trad}" en anglais ?`
      : `Yes, that works too ⚠️ "${acceptable.word}" = ${acceptable.trad}. Let's continue: how do you say "${next.trad}" in English?`
  }

  // Incorrect
  const targetWord = words[0]
  const next = words.length > 1 ? words[1] : words[0]
  return isFr
    ? `On cherchait "${targetWord.word}" (${targetWord.trad}) ❌. ${targetWord.example_en ? `Exemple : "${targetWord.example_en}"` : ''} Essaie maintenant : comment dit-on "${next.trad}" en anglais ?`
    : `We were looking for "${targetWord.word}" (${targetWord.trad}) ❌. ${targetWord.example_en ? `Example: "${targetWord.example_en}"` : ''} Now try: how do you say "${next.trad}" in English?`
}

export async function POST(request: NextRequest) {
  try {
    const req: CoachRequest = await request.json()

    // Validate required fields
    if (!req.userMessage || !req.courseWords || req.courseWords.length === 0) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Check for API key
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      // Fallback mode: rule-based
      const fallback = generateFallbackResponse(req)
      return NextResponse.json({ response: fallback, source: 'fallback' })
    }

    // Build request for Gemini
    const systemPrompt = buildSystemPrompt(req)
    const contents = buildConversation(req)

    // Call Gemini Flash with timeout
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 4000) // 4s timeout

    try {
      const geminiResponse = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents,
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 300,
            topP: 0.9,
          },
          safetySettings: [
            { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
          ],
        }),
        signal: controller.signal,
      })

      clearTimeout(timeout)

      if (!geminiResponse.ok) {
        // API error → fallback
        console.error('Gemini API error:', geminiResponse.status)
        const fallback = generateFallbackResponse(req)
        return NextResponse.json({ response: fallback, source: 'fallback' })
      }

      const data = await geminiResponse.json()
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text

      if (!text) {
        const fallback = generateFallbackResponse(req)
        return NextResponse.json({ response: fallback, source: 'fallback' })
      }

      return NextResponse.json({ response: text.trim(), source: 'llm' })
    } catch (fetchError: any) {
      clearTimeout(timeout)
      // Timeout or network error → fallback
      console.error('Gemini fetch error:', fetchError.message)
      const fallback = generateFallbackResponse(req)
      return NextResponse.json({ response: fallback, source: 'fallback' })
    }
  } catch (error: any) {
    console.error('Coach API error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
