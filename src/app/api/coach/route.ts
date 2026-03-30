/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { NextRequest, NextResponse } from 'next/server'

// Coach LLM API route — P0-A: dual mode (discussion vs revision) + P0-E: natural prompt

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent'

interface CoachRequest {
  userMessage: string
  courseId: string
  mode: 'discussion' | 'revision'
  // Revision mode: specific word being asked
  questionAsked: string
  expectedWord: string
  expectedTrad: string
  acceptableSynonyms: string[]
  // Shared context
  courseWords: { word: string; trad: string; example_en?: string; phonetic?: string }[]
  scenario: string
  conversationHistory: { role: string; text: string }[]
  userName: string
  interfaceLang: string
}

// ============================================================
// P0-E: NATURAL PROMPT — "Léa" persona
// ============================================================

function buildDiscussionPrompt(req: CoachRequest): string {
  const wordList = req.courseWords.map(w => `${w.word} (${w.trad})`).join(', ')

  return `Tu es Léa, coach de langue anglaise pour débutants (niveau A1).
Tu es chaleureuse, naturelle et pédagogue.
Tu parles comme un vrai professeur, pas comme un robot.

COURS ACTUEL : ${req.courseId}
SCÉNARIO : ${req.scenario || 'conversation libre'}
MOTS DU COURS : ${wordList}
L'UTILISATEUR S'APPELLE : ${req.userName}

MODE : DISCUSSION (conversation libre en situation)

RÈGLES :
1. Tu mets l'utilisateur dans une SITUATION CONCRÈTE liée au scénario
2. L'utilisateur répond LIBREMENT en anglais
3. Tu évalues le SENS GÉNÉRAL, pas la correspondance exacte à un mot précis
4. Tu enrichis sa réponse avec contexte et nuances
5. Tu relances avec une NOUVELLE SITUATION

STRUCTURE DE RÉPONSE OBLIGATOIRE :
1. Validation ou correction courte et chaleureuse
2. Explication simple avec nuance de registre si pertinent
3. Exemple concret en situation
4. Relance naturelle avec nouvelle situation

EXEMPLE DE RÉPONSE :
"Super ! 'Hi' c'est parfait ici, c'est détendu et naturel.
Entre amis on dit 'Hi!', dans un magasin plutôt 'Hello!'.
Par exemple : 'Hi, how are you today?'
Maintenant imagine que tu entres dans un magasin. Le vendeur te regarde. Que lui dis-tu ?"

RÈGLES DE COMPORTEMENT :
- Explique les nuances naturellement : "'hi' c'est plus détendu. 'hello' est plus neutre."
- Valide avec chaleur, pas avec des formules figées
- Corrige avec bienveillance, jamais de ton sec
- JAMAIS de "Mot X/Y" ou de drill séquentiel en mode Discussion
- JAMAIS de structure mécanique type "Mot suivant : comment dit-on..."
- Enchaînement TOUJOURS par une nouvelle situation
- Si la réponse est globalement correcte mais pas le mot exact du cours, ACCEPTE avec nuance
- Français sauf contenu anglais. 2-5 phrases max.`
}

function buildRevisionPrompt(req: CoachRequest): string {
  const wordList = req.courseWords.map(w => `- ${w.word} = ${w.trad}`).join('\n')

  return `Tu es Léa, coach de langue anglaise pour débutants (niveau A1).
Tu es chaleureuse, naturelle et pédagogue.

CONTEXTE ACTUEL :
- Question posée : "${req.questionAsked}"
- Mot attendu : "${req.expectedWord}" (= ${req.expectedTrad})
- Synonymes acceptables : ${req.acceptableSynonyms.length > 0 ? req.acceptableSynonyms.join(', ') : 'aucun'}
- Réponse de l'utilisateur : "${req.userMessage}"
L'utilisateur s'appelle ${req.userName}.

RÈGLE DE VALIDATION ABSOLUE :
Tu dois évaluer si la réponse RÉPOND À LA QUESTION POSÉE.
PAS si la réponse existe dans le cours.

CLASSIFICATION :
1. Si réponse = "${req.expectedWord}" → EXACTE
2. Si réponse ∈ [${req.acceptableSynonyms.join(', ')}] → ACCEPTABLE avec nuance sur le registre
3. Si réponse = autre mot du cours mais PAS attendu → INCORRECTE : "Non, '[réponse]' veut dire '[sa traduction]'. Pour '${req.expectedTrad}', on dit '${req.expectedWord}'."
4. Si réponse hors cours → INCORRECTE + correction

STRUCTURE DE RÉPONSE OBLIGATOIRE :
1. Validation ou correction courte et chaleureuse
2. Explication simple (nuance de registre si pertinent)
3. Exemple concret
4. Transition naturelle vers le mot suivant

EXEMPLE POUR SYNONYME ACCEPTABLE :
"Oui, 'hello' marche aussi !
'Hi' est plus détendu, entre amis. 'Hello' est un peu plus neutre.
Par exemple : 'Hello, nice to meet you!'
Allez, mot suivant..."

RÈGLES :
- Ton chaleureux et encourageant, jamais robotique
- Explique les nuances (formel/informel, contexte d'usage)
- Corrige avec bienveillance
- 2-5 phrases max. Français sauf contenu anglais.

Mots du cours :
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

// ============================================================
// P0-A: Discussion fallback — evaluate semantic correctness
// ============================================================

function generateDiscussionFallback(req: CoachRequest): { response: string; isCorrect: boolean } {
  const userText = req.userMessage.toLowerCase().trim()
  const isFr = req.interfaceLang === 'fr'
  const words = req.courseWords

  // Check if any course word appears in the user's response
  const matchedWords = words.filter(w =>
    userText.includes(w.word.toLowerCase()) || userText.includes(w.trad.toLowerCase())
  )

  if (matchedWords.length > 0) {
    const w = matchedWords[0]
    const scenario = req.scenario || ''
    const resp = isFr
      ? `Bien joue ! "${w.word}" est correct ici.\nPar exemple : "${w.example_en || w.word + '!'}"\n${scenario ? `Imagine maintenant une autre situation : ${scenario}. Que dirais-tu ?` : 'Continue, essaie une autre expression !'}`
      : `Well done! "${w.word}" works here.\nFor example: "${w.example_en || w.word + '!'}"\nWhat would you say next?`
    return { response: resp, isCorrect: true }
  }

  // "I don't know"
  const unknowns = ['je ne sais pas', "i don't know", 'idk', 'dunno', 'aucune idée']
  if (unknowns.some(p => userText.includes(p))) {
    const hint = words[0]
    const resp = isFr
      ? `Pas de souci ! Dans cette situation, tu pourrais dire "${hint.word}" (${hint.trad}).\nPar exemple : "${hint.example_en || hint.word}"\nEssaie de l'utiliser dans une phrase !`
      : `No worries! In this situation, you could say "${hint.word}" (${hint.trad}).\nTry using it in a sentence!`
    return { response: resp, isCorrect: false }
  }

  // Generic encouragement
  const resp = isFr
    ? `Hmm, essaie d'utiliser les mots du cours. Par exemple : "${words[0].word}" (${words[0].trad}) ou "${words[1]?.word || words[0].word}" (${words[1]?.trad || words[0].trad}).\nDans cette situation, que dirais-tu ?`
    : `Hmm, try using the course words. For example: "${words[0].word}" (${words[0].trad}).\nWhat would you say in this situation?`
  return { response: resp, isCorrect: false }
}

// ============================================================
// Revision fallback — strict contextual validation
// ============================================================

function generateRevisionFallback(req: CoachRequest): { response: string; isCorrect: boolean; nextWordIdx: number } {
  const userText = req.userMessage.toLowerCase().trim()
  const expected = req.expectedWord.toLowerCase()
  const synonyms = req.acceptableSynonyms.map(s => s.toLowerCase())
  const words = req.courseWords
  const isFr = req.interfaceLang === 'fr'

  const currentIdx = words.findIndex(w => w.word.toLowerCase() === expected)
  const nextIdx = (currentIdx + 1) % words.length
  const nextWord = words[nextIdx]

  // "I don't know"
  const unknowns = ['je ne sais pas', "i don't know", 'idk', 'dunno', 'aucune idée']
  if (unknowns.some(p => userText === p || userText.includes(p))) {
    return {
      response: isFr
        ? `Pas de souci ! La reponse etait "${req.expectedWord}" (${req.expectedTrad}).\nPar exemple : "${words[currentIdx]?.example_en || req.expectedWord}"\nAllez, on continue !`
        : `No worries! The answer was "${req.expectedWord}" (${req.expectedTrad}). Let's continue!`,
      isCorrect: false,
      nextWordIdx: nextIdx,
    }
  }

  // EXACT match
  if (userText === expected) {
    const ex = words[currentIdx]?.example_en ? `\nPar exemple : "${words[currentIdx].example_en}"` : ''
    return {
      response: isFr
        ? `Exactement ! "${req.expectedWord}" = ${req.expectedTrad}.${ex}\nAllez, mot suivant !`
        : `Exactly! "${req.expectedWord}" = ${req.expectedTrad}.${ex}\nNext word!`,
      isCorrect: true,
      nextWordIdx: nextIdx,
    }
  }

  // P0-D: SYNONYM match (expanded via FR_SYNONYMS)
  if (synonyms.includes(userText)) {
    // Nuanced response explaining the difference
    return {
      response: isFr
        ? `Oui, "${userText}" marche aussi !\n"${req.expectedWord}" est plus courant pour "${req.expectedTrad}", mais "${userText}" est tout a fait correct.\nAllez, on continue !`
        : `Yes, "${userText}" works too!\n"${req.expectedWord}" is more common for "${req.expectedTrad}", but "${userText}" is perfectly fine.\nLet's continue!`,
      isCorrect: true,
      nextWordIdx: nextIdx,
    }
  }

  // WRONG: another course word
  const wrongWord = words.find(w => w.word.toLowerCase() === userText)
  if (wrongWord) {
    return {
      response: isFr
        ? `Non, "${wrongWord.word}" veut dire "${wrongWord.trad}".\nPour "${req.expectedTrad}", on dit "${req.expectedWord}".\nEssaie encore !`
        : `No, "${wrongWord.word}" means "${wrongWord.trad}".\nFor "${req.expectedTrad}", we say "${req.expectedWord}".\nTry again!`,
      isCorrect: false,
      nextWordIdx: currentIdx,
    }
  }

  // WRONG: outside course
  return {
    response: isFr
      ? `"${req.userMessage}" n'est pas le mot attendu.\nPour "${req.expectedTrad}", on dit "${req.expectedWord}".\nEssaie encore !`
      : `"${req.userMessage}" is not the expected word.\nFor "${req.expectedTrad}", we say "${req.expectedWord}".\nTry again!`,
    isCorrect: false,
    nextWordIdx: currentIdx,
  }
}

// ============================================================
// Main handler
// ============================================================

export async function POST(request: NextRequest) {
  try {
    const req: CoachRequest = await request.json()

    if (!req.userMessage || !req.courseWords || req.courseWords.length === 0) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const isDiscussion = req.mode === 'discussion'

    // Compute deterministic fallback
    const fallbackResult = isDiscussion
      ? { ...generateDiscussionFallback(req), nextWordIdx: undefined as number | undefined }
      : generateRevisionFallback(req)

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json({
        response: fallbackResult.response,
        isCorrect: fallbackResult.isCorrect,
        nextWordIdx: fallbackResult.nextWordIdx,
        source: 'fallback',
      })
    }

    // Build mode-specific prompt
    const systemPrompt = isDiscussion ? buildDiscussionPrompt(req) : buildRevisionPrompt(req)
    const contents = buildConversation(req)
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)

    try {
      const geminiResponse = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents,
          generationConfig: {
            temperature: isDiscussion ? 0.85 : 0.7,
            maxOutputTokens: 400,
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

      if (!geminiResponse.ok) throw new Error('API error')
      const data = await geminiResponse.json()
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text

      if (!text) throw new Error('No text')

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
