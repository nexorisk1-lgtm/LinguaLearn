/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'

// Coach LLM API route — contextual matching
// The coach evaluates if the answer matches THE QUESTION ASKED, not just any course word

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent'

interface CoachRequest {
  userMessage: string
  courseId: string
  mode: 'discussion' | 'revision'
  // CRITICAL: the specific word being asked about
  questionAsked: string           // e.g. "comment dit-on 'salut' en anglais ?"
  expectedWord: string            // e.g. "hi"
  expectedTrad: string            // e.g. "salut"
  acceptableSynonyms: string[]    // e.g. ["hello"] (other valid translations)
  // Full course context for reference
  courseWords: { word: string; trad: string; example_en?: string; phonetic?: string }[]
  conversationHistory: { role: string; text: string }[]
  userName: string
  interfaceLang: string
}

function buildSystemPrompt(req: CoachRequest): string {
  const wordList = req.courseWords.map(w => `- ${w.word} = ${w.trad}`).join('\n')

  return `Tu es le coach de l'app LinguaLearn. Tu te comportes comme un PROFESSEUR, pas comme un validateur de mots.

CONTEXTE ACTUEL :
- Question posée : "${req.questionAsked}"
- Mot attendu : "${req.expectedWord}" (= ${req.expectedTrad})
- Synonymes acceptables : ${req.acceptableSynonyms.length > 0 ? req.acceptableSynonyms.join(', ') : 'aucun'}
- Réponse de l'utilisateur : "${req.userMessage}"

RÈGLE DE VALIDATION ABSOLUE :
Tu dois évaluer si la réponse de l'utilisateur RÉPOND À LA QUESTION POSÉE.
PAS si la réponse existe dans le cours.

Exemple critique :
- Question : "comment dit-on 'salut' en anglais ?"
- Réponse : "good evening"
- MAUVAIS : "Exactement ! good evening = bonsoir ✅" (car good evening EST dans le cours)
- BON : "Non, 'good evening' veut dire 'bonsoir'. Pour 'salut', on dit 'hi'. ❌"

CLASSIFICATION :
1. Si réponse = "${req.expectedWord}" → EXACTE ✅ "Exactement !" + explication courte
2. Si réponse ∈ [${req.acceptableSynonyms.join(', ')}] → ACCEPTABLE ⚠️ "Oui, ça marche aussi" + nuance
3. Si réponse = autre mot du cours mais PAS le mot attendu → INCORRECTE ❌ "Non, '[réponse]' veut dire '[sa traduction]'. Pour '${req.expectedTrad}', on dit '${req.expectedWord}'."
4. Si réponse hors cours → INCORRECTE ❌ + correction

APRÈS CHAQUE FEEDBACK : enchaîne sur le mot suivant avec une nouvelle question.
Format : texte naturel, 2-4 phrases max. Français sauf contenu anglais. Niveau A1.
L'utilisateur s'appelle ${req.userName}.

Mots du cours pour référence :
${wordList}`
}

function buildConversation(req: CoachRequest): any[] {
  const messages: any[] = []
  const recentHistory = req.conversationHistory.slice(-10)
  for (const msg of recentHistory) {
    messages.push({
      role: msg.role === 'coach' ? 'model' : 'user',
      parts: [{ text: msg.text }],
    })
  }
  messages.push({
    role: 'user',
    parts: [{ text: req.userMessage }],
  })
  return messages
}

// Rule-based fallback — CONTEXTUAL validation against expectedWord
function generateFallbackResponse(req: CoachRequest): { response: string; isCorrect: boolean; nextWordIdx: number } {
  const userText = req.userMessage.toLowerCase().trim()
  const expected = req.expectedWord.toLowerCase()
  const expectedTrad = req.expectedTrad.toLowerCase()
  const synonyms = req.acceptableSynonyms.map(s => s.toLowerCase())
  const words = req.courseWords
  const isFr = req.interfaceLang === 'fr'

  // Find current word index to determine next
  const currentIdx = words.findIndex(w => w.word.toLowerCase() === expected)
  const nextIdx = (currentIdx + 1) % words.length
  const nextWord = words[nextIdx]

  // "I don't know"
  const unknownPhrases = ['je ne sais pas', "i don't know", 'idk', 'dunno', 'no idea', 'aucune idée']
  if (unknownPhrases.some(p => userText === p || userText.includes(p))) {
    const nextQ = isFr
      ? `Pas de souci ! La réponse était "${req.expectedWord}" (${req.expectedTrad}). Mot suivant : comment dit-on "${nextWord.trad}" en anglais ?`
      : `No worries! The answer was "${req.expectedWord}" (${req.expectedTrad}). Next word: how do you say "${nextWord.trad}" in English?`
    return { response: nextQ, isCorrect: false, nextWordIdx: nextIdx }
  }

  // EXACT match: answer = expected word
  if (userText === expected) {
    const exampleStr = words[currentIdx]?.example_en ? ` Ex: "${words[currentIdx].example_en}"` : ''
    const resp = isFr
      ? `Exactement ! ✅ "${req.expectedWord}" = ${req.expectedTrad}.${exampleStr} Mot suivant : comment dit-on "${nextWord.trad}" en anglais ?`
      : `Exactly! ✅ "${req.expectedWord}" = ${req.expectedTrad}.${exampleStr} Next: how do you say "${nextWord.trad}" in English?`
    return { response: resp, isCorrect: true, nextWordIdx: nextIdx }
  }

  // ACCEPTABLE: answer is a valid synonym for the same meaning
  if (synonyms.includes(userText)) {
    const resp = isFr
      ? `Oui, ça marche aussi ⚠️ "${userText}" est correct pour "${expectedTrad}". La réponse principale est "${req.expectedWord}". Mot suivant : comment dit-on "${nextWord.trad}" en anglais ?`
      : `Yes, that works too ⚠️ "${userText}" is correct for "${expectedTrad}". The main answer is "${req.expectedWord}". Next: how do you say "${nextWord.trad}" in English?`
    return { response: resp, isCorrect: true, nextWordIdx: nextIdx }
  }

  // WRONG: answer is another word from the course but NOT the expected one
  const wrongCourseWord = words.find(w => w.word.toLowerCase() === userText)
  if (wrongCourseWord) {
    const resp = isFr
      ? `Non, "${wrongCourseWord.word}" veut dire "${wrongCourseWord.trad}" ❌. Pour "${req.expectedTrad}", on dit "${req.expectedWord}". On réessaie : comment dit-on "${req.expectedTrad}" en anglais ?`
      : `No, "${wrongCourseWord.word}" means "${wrongCourseWord.trad}" ❌. For "${req.expectedTrad}", we say "${req.expectedWord}". Let's try again: how do you say "${req.expectedTrad}" in English?`
    // Stay on same word — don't advance
    return { response: resp, isCorrect: false, nextWordIdx: currentIdx }
  }

  // WRONG: answer completely outside course
  const resp = isFr
    ? `"${req.userMessage}" n'est pas dans notre cours ❌. Pour "${req.expectedTrad}", on dit "${req.expectedWord}". On réessaie : comment dit-on "${req.expectedTrad}" en anglais ?`
    : `"${req.userMessage}" is not in our course ❌. For "${req.expectedTrad}", we say "${req.expectedWord}". Let's try again: how do you say "${req.expectedTrad}" in English?`
  return { response: resp, isCorrect: false, nextWordIdx: currentIdx }
}

export async function POST(request: NextRequest) {
  try {
    const req: CoachRequest = await request.json()

    if (!req.userMessage || !req.courseWords || req.courseWords.length === 0) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Always run contextual fallback first to determine correctness
    const fallbackResult = generateFallbackResponse(req)

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json({
        response: fallbackResult.response,
        isCorrect: fallbackResult.isCorrect,
        nextWordIdx: fallbackResult.nextWordIdx,
        source: 'fallback',
      })
    }

    // Try LLM for richer response
    const systemPrompt = buildSystemPrompt(req)
    const contents = buildConversation(req)
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 4000)

    try {
      const geminiResponse = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents,
          generationConfig: { temperature: 0.7, maxOutputTokens: 300, topP: 0.9 },
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

      if (!geminiResponse.ok) throw new Error('API error')
      const data = await geminiResponse.json()
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text

      if (!text) throw new Error('No text')

      // Use LLM text but keep deterministic correctness from fallback
      return NextResponse.json({
        response: text.trim(),
        isCorrect: fallbackResult.isCorrect,
        nextWordIdx: fallbackResult.nextWordIdx,
        source: 'llm',
      })
    } catch {
      clearTimeout(timeout)
      return NextResponse.json({
        response: fallbackResult.response,
        isCorrect: fallbackResult.isCorrect,
        nextWordIdx: fallbackResult.nextWordIdx,
        source: 'fallback',
      })
    }
  } catch (error: any) {
    console.error('Coach API error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
