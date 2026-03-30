/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { NextRequest, NextResponse } from 'next/server'

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent'

// ============================================================
// TYPES
// ============================================================

interface CoachRequest {
  userMessage: string
  courseId: string
  agentType: 'teacher' | 'friend' | 'business'
  // Teacher-specific
  questionAsked?: string
  expectedWord?: string
  expectedTrad?: string
  acceptableSynonyms?: string[]
  // Shared context
  courseWords?: { word: string; trad: string; example_en?: string; phonetic?: string }[]
  scenario?: string
  conversationHistory: { role: string; text: string }[]
  userName: string
  interfaceLang: string
  // Anti-loop
  lastScenariosUsed?: string[]
  lastQuestionsAsked?: string[]
  lastTopics?: string[]
  // GRC context (Business only)
  grcLevel?: string
  grcThemes?: string[]
}

interface CoachResponse {
  response: string
  isCorrect: boolean | null
  nextWordIdx?: number
  intent: string
  source: 'llm' | 'fallback'
}

// ============================================================
// INTENT ENGINE
// ============================================================

function classifyIntent(userMessage: string): 'ANSWER' | 'COMMAND' | 'FREE_REQUEST' | 'DISCUSSION' {
  const msg = userMessage.toLowerCase().trim()

  // COMMAND: contains keywords like change, suivant, next, stop, autre, passe, skip
  const commandKeywords = ['change', 'suivant', 'next', 'stop', 'autre', 'passe', 'skip', 'skip', 'nouveau', 'new', 'different']
  if (commandKeywords.some(kw => msg.includes(kw))) {
    return 'COMMAND'
  }

  // FREE_REQUEST: contains ?, comment, how, why, pourquoi, explain, explique, c'est quoi, what is
  const questionKeywords = ['?', 'comment', 'how', 'why', 'pourquoi', 'explain', 'explique', "c'est quoi", 'what is', 'qu\'est', 'signifie', 'means']
  if (questionKeywords.some(kw => msg.includes(kw))) {
    return 'FREE_REQUEST'
  }

  // ANSWER: short response (1-3 words) or looks like translation/vocabulary answer
  const words = msg.split(/\s+/).filter(w => w.length > 0)
  if (words.length <= 3 && msg.length < 30) {
    return 'ANSWER'
  }

  // DISCUSSION: everything else
  return 'DISCUSSION'
}

// ============================================================
// SYSTEM PROMPT BUILDERS
// ============================================================

function buildTeacherPrompt(req: CoachRequest): string {
  const wordList = req.courseWords?.map(w => `- ${w.word} = ${w.trad}`).join('\n') || ''
  const antiLoopText = req.lastQuestionsAsked?.length
    ? `\nNE JAMAIS répéter une question de cette liste : ${req.lastQuestionsAsked.join(', ')}`
    : ''
  const isFr = req.interfaceLang === 'fr'

  return `Tu es Léa, professeur d'anglais structurée et bienveillante pour débutants (niveau A1).
Tu es chaleureuse, naturelle et pédagogue.
Tu parles comme un vrai professeur, pas comme un robot.

CONTEXTE ACTUEL :
- Question posée : "${req.questionAsked}"
- Mot attendu : "${req.expectedWord}" (= ${req.expectedTrad})
- Synonymes acceptables : ${req.acceptableSynonyms?.length ? req.acceptableSynonyms.join(', ') : 'aucun'}
- Réponse de l'utilisateur : "${req.userMessage}"
- L'utilisateur s'appelle ${req.userName}.

MOTS DU COURS (CONTEXTE SEUL, ne pas aller au-delà) :
${wordList}
${antiLoopText}

CLASSIFICATION DE L'INTENT :
Intention classifiée : ${classifyIntent(req.userMessage)}

RÈGLES DE VALIDATION ABSOLUE :
1. Si réponse = "${req.expectedWord}" → EXACTE
2. Si réponse ∈ [${req.acceptableSynonyms?.join(', ') || 'aucun'}] → ACCEPTABLE avec nuance
3. Si réponse = autre mot du cours mais PAS attendu → INCORRECTE avec explication
4. Si réponse hors cours → INCORRECTE + correction
5. Si intent = COMMAND → acknowledge et adapt
6. Si intent = FREE_REQUEST → répondre pédagogiquement
7. Si intent = DISCUSSION → rediriger doucement vers la révision

STRUCTURE DE RÉPONSE OBLIGATOIRE :
1. Validation ou correction courte et chaleureuse
2. Explication simple (nuance de registre si pertinent)
3. Exemple concret
4. Transition naturelle vers le mot suivant

RÈGLES DE COMPORTEMENT :
- Ton chaleureux et encourageant
- Explique les nuances (formel/informel)
- Corrige avec bienveillance
- 2-5 phrases max. Français sauf contenu anglais.
- JAMAIS de structure mécanique type "Mot suivant : ..."
- JAMAIS de "Mot X/Y" ou drill séquentiel mécanique`
}

function buildFriendPrompt(req: CoachRequest): string {
  const wordList = req.courseWords?.map(w => `${w.word} (${w.trad})`).join(', ') || ''
  const antiLoopText = req.lastScenariosUsed?.length
    ? `\nNE JAMAIS répéter un scénario de cette liste : ${req.lastScenariosUsed.join(', ')}`
    : ''
  const isFr = req.interfaceLang === 'fr'

  return `Tu es Alex, ami(e) anglophone cool et encourageant(e) pour pratiquer l'anglais.
Tu es décontracté(e), naturel(le) et sympathique.
Tu parles comme un vrai ami/une vraie amie, pas comme un professeur ou un robot.

MODE : CONVERSATION LIBRE (NO DRILL, NO SEQUENTIAL WORD TESTING)
- Tu mets l'utilisateur dans une SITUATION CONCRÈTE
- L'utilisateur répond LIBREMENT en anglais
- Tu évalues le SENS GÉNÉRAL, pas la correspondance exacte
- Tu enrichis sa réponse avec contexte et nuances
- Tu relances avec une NOUVELLE SITUATION

CONTEXTE ACTUEL :
- Scénario : ${req.scenario || 'conversation libre'}
- Mots du cours (référence seulement) : ${wordList}
- L'utilisateur s'appelle ${req.userName}.
${antiLoopText}

CLASSIFICATION DE L'INTENT :
Intention classifiée : ${classifyIntent(req.userMessage)}

RÈGLES ABSOLUES :
1. JAMAIS de "Mot X/Y" ou drill séquentiel
2. JAMAIS de structure mécanique de révision
3. JAMAIS de validation du mot exact du cours
4. Valide le SENS GÉNÉRAL et l'intention de communication
5. Si intent = COMMAND → acknowledge et change de situation
6. Si intent = FREE_REQUEST → réponds naturellement
7. Si intent = DISCUSSION ou ANSWER → continue la conversation

STRUCTURE DE RÉPONSE OBLIGATOIRE :
1. Validation ou réaction naturelle (courte)
2. Explication ou contexte si pertinent
3. Exemple concret en situation
4. Relance avec une NOUVELLE SITUATION (jamais la même)

EXEMPLES :
"Cool ! 'Hi' marche parfait. C'est détendu, comme on parlerait entre potes.
Imagine maintenant que tu entres dans un café. Le barista te regarde. Que lui dis-tu ?"

"Oui, bien joué ! Tu as dit ce qu'il fallait comprendre.
'Hello mate' c'est très british, c'est sympa comme ça.
Alors écoute, on change : tu es à une réception professionnelle. Tu vois quelqu'un de ton niveau. Que tu dis ?"

RÈGLES DE COMPORTEMENT :
- Tone décontracté et encourageant
- Explique les nuances naturellement
- Jamais de correction brutale
- 2-5 phrases max. Français sauf contenu anglais.
- Chaque relance doit être UNE NOUVELLE SITUATION`
}

function buildBusinessPrompt(req: CoachRequest): string {
  const grcVocab = [
    'audit', 'risk', 'compliance', 'governance', 'cybersecurity',
    'control', 'mitigation', 'assessment', 'framework', 'incident',
    'policy', 'committee', 'stakeholder', 'remediation', 'evidence'
  ]
  const antiLoopText = req.lastTopics?.length
    ? `\nNE JAMAIS répéter un sujet de cette liste : ${req.lastTopics.join(', ')}`
    : ''

  return `Tu es Marc, consultant GRC (Governance, Risk & Compliance) senior bilingue.
Tu es professionnel(le), expertise, naturel(le) dans les discussions d'affaires.
Tu parles comme un vrai consultant, avec jargon GRC naturel.

MODE : ROLEPLAY PROFESSIONNEL GRC
- Simule des situations réelles : audit committee meeting, risk assessment, compliance report, incident response, etc.
- Évalue la COMPRÉHENSION GÉNÉRALE et l'usage correct du jargon GRC
- Mets l'utilisateur dans des situations concrètes de travail
- Relance avec une NOUVELLE SITUATION GRC

CONTEXTE ACTUEL :
- Niveau GRC : ${req.grcLevel || 'intermediate'}
- Thèmes GRC : ${req.grcThemes?.join(', ') || 'all'}
- Scénario : ${req.scenario || 'GRC discussion'}
- L'utilisateur s'appelle ${req.userName}.
${antiLoopText}

CLASSIFICATION DE L'INTENT :
Intention classifiée : ${classifyIntent(req.userMessage)}

VOCABULAIRE GRC SEULEMENT :
${grcVocab.join(', ')}

RÈGLES ABSOLUES :
1. Contexte Lock : GRC vocabulary ONLY
2. Accepte le sens général, pas la correspondance exacte de mots
3. Si intent = COMMAND → acknowledge et change de situation
4. Si intent = FREE_REQUEST → réponds avec expertise GRC
5. Si intent = DISCUSSION ou ANSWER → continue le roleplay

STRUCTURE DE RÉPONSE OBLIGATOIRE :
1. Validation ou feedback court
2. Correction ou clarification si pertinent
3. Exemple concret en contexte GRC
4. Relance avec une NOUVELLE SITUATION GRC

EXEMPLES :
"Bonne compréhension. 'Risk mitigation' c'est bien.
Dans notre contexte, on dirait aussi 'risk remediation' pour les actions correctrices.
Imagine que tu sois face au audit committee pour présenter ta risk assessment. La slide de cybersecurity threats est affichée. Qu'est-ce que tu dis ?"

RÈGLES DE COMPORTEMENT :
- Ton professionnel et bienveillant
- Explique le jargon GRC naturellement
- Jamais de ton sec ou critique
- 2-5 phrases max. Français sauf contenu anglais.
- Chaque relance = NOUVELLE SITUATION GRC`
}

// ============================================================
// CONVERSATION BUILDER
// ============================================================

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
// FALLBACK FUNCTIONS
// ============================================================

function generateTeacherFallback(req: CoachRequest): { response: string; isCorrect: boolean; nextWordIdx: number } {
  const userText = req.userMessage.toLowerCase().trim()
  const expected = (req.expectedWord || '').toLowerCase()
  const synonyms = (req.acceptableSynonyms || []).map(s => s.toLowerCase())
  const words = req.courseWords || []
  const isFr = req.interfaceLang === 'fr'

  const currentIdx = words.findIndex(w => w.word.toLowerCase() === expected)
  const nextIdx = currentIdx >= 0 ? (currentIdx + 1) % words.length : 0
  const nextWord = nextIdx >= 0 && nextIdx < words.length ? words[nextIdx] : undefined

  // "I don't know"
  const unknowns = ['je ne sais pas', "i don't know", 'idk', 'dunno', 'aucune idée']
  if (unknowns.some(p => userText.includes(p))) {
    return {
      response: isFr
        ? `Pas de souci ! La réponse était "${req.expectedWord}" (${req.expectedTrad}).\nPar exemple : "${words[currentIdx]?.example_en || req.expectedWord}"\nAllez, on continue !`
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

  // SYNONYM match
  if (synonyms.includes(userText)) {
    return {
      response: isFr
        ? `Oui, "${userText}" marche aussi !\n"${req.expectedWord}" est plus courant, mais "${userText}" est correct.\nAllez, on continue !`
        : `Yes, "${userText}" works too!\n"${req.expectedWord}" is more common, but "${userText}" is fine.\nLet's continue!`,
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

function generateFriendFallback(req: CoachRequest): { response: string; isCorrect: boolean | null } {
  const userText = req.userMessage.toLowerCase().trim()
  const words = req.courseWords || []
  const isFr = req.interfaceLang === 'fr'

  // Check if any course word appears
  const matchedWords = words.filter(
    w => userText.includes(w.word.toLowerCase()) || userText.includes(w.trad.toLowerCase())
  )

  if (matchedWords.length > 0) {
    const w = matchedWords[0]
    const scenario = req.scenario || ''
    const resp = isFr
      ? `Bien joué ! "${w.word}" c'est correct ici.\nPar exemple : "${w.example_en || w.word + '!'}"\n${scenario ? `Allez, imagine une autre situation : ${scenario}. Que dirais-tu ?` : 'Continue, essaie une autre expression !'}`
      : `Well done! "${w.word}" works here.\nFor example: "${w.example_en || w.word + '!'}"\nNow imagine: ${scenario || 'what would you say next?'}`
    return { response: resp, isCorrect: null }
  }

  // "I don't know"
  const unknowns = ['je ne sais pas', "i don't know", 'idk', 'dunno', 'aucune idée']
  if (unknowns.some(p => userText.includes(p))) {
    const hint = words[0]
    const resp = isFr
      ? `Pas de souci ! Tu pourrais dire "${hint.word}" (${hint.trad}).\nPar exemple : "${hint.example_en || hint.word}"\nEssaie de l'utiliser !`
      : `No worries! You could say "${hint.word}" (${hint.trad}).\nTry using it!`
    return { response: resp, isCorrect: null }
  }

  // Generic encouragement
  const hint = words[Math.floor(Math.random() * words.length)]
  const resp = isFr
    ? `Cool ! Continue. Essaie d'utiliser des mots du cours. Par exemple : "${hint.word}" (${hint.trad}).\nDans cette situation, comment tu réagirais ?`
    : `Cool! Try using course words. For example: "${hint.word}" (${hint.trad}).\nWhat would you say?`

  return { response: resp, isCorrect: null }
}

function generateBusinessFallback(req: CoachRequest): { response: string; isCorrect: boolean | null } {
  const isFr = req.interfaceLang === 'fr'
  const grcKeywords = ['audit', 'risk', 'compliance', 'governance', 'control', 'assessment', 'mitigation']

  const userText = req.userMessage.toLowerCase()
  const hasGrcContent = grcKeywords.some(kw => userText.includes(kw))

  if (hasGrcContent) {
    const resp = isFr
      ? `Bonne approche ! Tu utilises bien le jargon GRC.\nContinue dans cette direction. Imaginez que vous êtes en audit committee meeting et qu'on vous demande de décrire les principaux cyber risks. Qu'est-ce que vous dites ?`
      : `Good approach! You're using GRC terminology well.\nLet's continue. Imagine you're in an audit committee meeting presenting cyber risks. What do you say?`
    return { response: resp, isCorrect: null }
  }

  const resp = isFr
    ? `D'accord. En contexte GRC, on serait plus spécifique.\nPar exemple, on parle de 'risk mitigation', 'compliance framework', 'governance control'.\nAllez, imaginez un scenario : audit committee vous pose une question sur la risk appetite. Comment vous répondez ?`
    : `OK. In GRC context, we'd be more specific.\nFor example: 'risk mitigation', 'compliance framework', 'governance control'.\nNow, imagine the audit committee asks about risk appetite. How do you respond?`

  return { response: resp, isCorrect: null }
}

// ============================================================
// MAIN HANDLER
// ============================================================

export async function POST(request: NextRequest) {
  try {
    const req: CoachRequest = await request.json()

    if (!req.userMessage || !req.courseWords || req.courseWords.length === 0) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const intent = classifyIntent(req.userMessage)
    const agentType = req.agentType || 'friend'

    // Compute deterministic fallback FIRST
    let fallbackResult: any
    if (agentType === 'teacher') {
      fallbackResult = generateTeacherFallback(req)
    } else if (agentType === 'business') {
      fallbackResult = generateBusinessFallback(req)
    } else {
      fallbackResult = generateFriendFallback(req)
    }

    // Add intent to all fallbacks
    const fallbackWithIntent = {
      ...fallbackResult,
      isCorrect: fallbackResult.isCorrect ?? null,
      nextWordIdx: fallbackResult.nextWordIdx ?? undefined,
      intent,
      source: 'fallback' as const,
    }

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json(fallbackWithIntent)
    }

    // Build agent-specific prompt
    let systemPrompt = ''
    let temperature = 0.75
    if (agentType === 'teacher') {
      systemPrompt = buildTeacherPrompt(req)
      temperature = 0.6
    } else if (agentType === 'business') {
      systemPrompt = buildBusinessPrompt(req)
      temperature = 0.75
    } else {
      systemPrompt = buildFriendPrompt(req)
      temperature = 0.85
    }

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
            temperature,
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

      if (!geminiResponse.ok) {
        throw new Error('API error')
      }

      const data = await geminiResponse.json()
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text

      if (!text) {
        throw new Error('No text in response')
      }

      const result: CoachResponse = {
        response: text.trim(),
        isCorrect: fallbackWithIntent.isCorrect,
        nextWordIdx: fallbackWithIntent.nextWordIdx,
        intent,
        source: 'llm',
      }

      return NextResponse.json(result)
    } catch (error: any) {
      clearTimeout(timeout)
      return NextResponse.json(fallbackWithIntent)
    }
  } catch (error: any) {
    console.error('Coach API error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
