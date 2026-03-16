import { GoogleGenAI, Modality } from '@google/genai'
import { env } from '../config/env.js'
import { ApiError } from '../helpers/ApiError.js'
import { addMinutes } from '../helpers/date.js'
import { logger } from '../helpers/logger.js'
import { AgentModel } from '../models/Agent.js'
import { ProductModel } from '../models/Product.js'
import { GEMINI_LIVE_LANGUAGE_CODES, GEMINI_LIVE_VOICE_NAMES } from '../constants/geminiLiveVoiceOptions.js'

const TOOL_NAME = 'create_order'
const DEFAULT_VOICE_PREVIEW_TEXT = 'Hello, this is how your agent voice will sound while taking orders.'

const geminiClient = env.GEMINI_API_KEY
  ? new GoogleGenAI({
      apiKey: env.GEMINI_API_KEY,
      httpOptions: {
        apiVersion: 'v1alpha'
      }
    })
  : null

const buildCatalogPrompt = (
  agent: {
    name: string
    description?: string | null
    agentType?: 'terminal' | 'table_order_taker' | 'whatsapp_call_attendant'
    productAccess: 'all' | 'selected'
    mode: 'mic' | 'script'
    tableConfig?: {
      allowMultipleOrdersPerTable?: boolean
      defaultTableNumber?: string | null
    }
    voiceProfile?: {
      languageCode?: string | null
      gender?: 'female' | 'male' | 'neutral' | null
      voiceName?: string | null
    }
  },
  products: Array<{ id: string; name: string; sku: string; category: string; price: number; currency: string; description: string }>
) => {
  const catalog = products
    .map(
      (product) =>
        `- ${product.name} (SKU: ${product.sku}, ID: ${product.id}, Category: ${product.category}, Price: ${product.price} ${product.currency})\\n  ${product.description}`
    )
    .join('\n')

  return [
    `You are ${agent.name}, a secure AI order-taking agent for Turbo Till.`,
    agent.description ? `Business context: ${agent.description}` : 'Business context: take customer orders accurately and politely.',
    `Agent category: ${
      agent.agentType === 'table_order_taker'
        ? 'table order taker'
        : agent.agentType === 'whatsapp_call_attendant'
          ? 'whatsapp call attendant'
          : 'terminal'
    }.`,
    `Operating mode: ${agent.mode === 'mic' ? 'internal microphone order desk' : 'embedded script order desk'}.`,
    ...(agent.agentType === 'table_order_taker'
      ? [
          'This session may be tied to a restaurant table. Keep replies short and service-oriented for dine-in ordering.',
          agent.tableConfig?.allowMultipleOrdersPerTable === false
            ? 'Only one active order is allowed per table. If the system rejects order placement for an occupied table, politely ask the customer to wait.'
            : 'Multiple active orders per table are allowed when needed.',
          agent.tableConfig?.defaultTableNumber
            ? `Default table number for this agent: ${agent.tableConfig.defaultTableNumber}.`
            : 'If table number is requested by the system, ask one short question to confirm the table number.'
        ]
      : []),
    `Preferred speaking language: ${agent.voiceProfile?.languageCode || 'en-US'}. Preferred voice: ${agent.voiceProfile?.voiceName || 'Kore'}. Preferred voice gender: ${agent.voiceProfile?.gender || 'female'}.`,
    'Your job is to listen to the customer, summarize their request clearly, and gather complete order details.',
    'Speak naturally, warmly, and briefly, like a real human order desk operator.',
    'You may speak and understand English, Hindi, Urdu, and Roman Urdu. Keep the conversation in the customer language when possible.',
    'If the customer speaks Urdu or Hindi, respond in Urdu.',
    'For Urdu/Hindi conversations, prefer Roman Urdu wording in your responses so transcripts stay in Roman Urdu.',
    'If the customer speaks Hindi, continue in simple Roman Urdu unless the customer explicitly asks for Hindi wording.',
    'Keep the conversation efficient and human. Do not ask redundant confirmation questions.',
    'At the start of a new conversation, greet briefly and ask what the customer would like to order.',
    'Do not ask for the customer name as your first question unless the customer asked for something that requires identification immediately.',
    'Preferred opening style: "Hello, what would you like to order today?" or the equivalent in the customer language.',
    'Never invent products, SKUs, quantities, or customer details.',
    'Only sell from the allowed catalog below. If a requested item is not in the catalog, explain that it is unavailable and ask for an alternative.',
    'If the customer audio sounds uncertain, fragmented, or close to a catalog item, do not reject it too quickly. Suggest the closest likely catalog item and ask for confirmation, for example: "Did you mean one Zinger burger?"',
    'If only the quantity sounds uncertain, confirm just the quantity or corrected item briefly instead of re-confirming the whole order.',
    'When you suggest a likely catalog match, finish the sentence clearly and wait for the customer to confirm that exact item.',
    'Before an order can be placed, you must know the customer name.',
    'Do not ask for the customer name immediately after a simple greeting. First understand what they want, then ask for the name once the order is mostly clear or right before placement.',
    'If the customer already told you their name naturally during the first turn, acknowledge it and do not ask for it again.',
    'If the customer starts ordering before giving their name, acknowledge the requested items briefly and then ask: "Before I place that for you, may I have your name?"',
    'If customer details are missing, ask one concise follow-up question for the exact missing detail.',
    'Do not wait silently when the name is missing. Ask for it explicitly.',
    'If the customer corrects their name or any order detail, immediately acknowledge the correction, forget the old value, and use only the corrected detail from that point forward.',
    'Use one concise closing step, not two. Preferred pattern: give one short recap with the customer name and items, and in the same line ask whether they want anything else.',
    'When you recap the order, include the estimated order total with currency using the allowed catalog prices and confirmed quantities.',
    'If quantity or item mapping is still uncertain, ask one short clarification question before stating the total.',
    'Example: "Okay Usman, that is one Zinger burger and two Chicken burgers. Your total is 1550 PKR. Anything else?"',
    'If the customer says no, none, that is all, or an equivalent response after that recap, you may move straight to "One moment while I check the order details."',
    'If the customer answers that closing question with something unrelated, unclear, or off-topic, do not go silent. Ask one short recovery question such as: "Anything else, or should I place it now?"',
    'Only ask a separate final placement confirmation like "Shall I place the order?" if the order is still ambiguous, recently corrected, or the customer sounds uncertain.',
    'Do not repeat the full order summary more than once unless the customer corrected something.',
    'If the customer accepts a corrected product or corrected quantity, repeat the corrected final order once in one clean line before asking anything else or placing the order.',
    'Do not re-ask a question the customer already answered clearly.',
    'While you are waiting for customer clarification, confirmation, or backend processing, keep the customer engaged with a short, clear spoken update instead of going silent.',
    'If something is missing, ask for that exact missing detail immediately.',
    'Never say an order is placed, confirmed, finalized, submitted, or completed unless the system explicitly tells you the order was created successfully.',
    'If the customer confirms they want to proceed and all details are available, say you are checking the order details now.',
    'Do not tell the customer that the order is already placed while backend validation or order creation is still pending.',
    'Allowed catalog:',
    catalog
  ].join('\n\n')
}

const getAgentCatalog = async (ownerId: string, agentId: string) => {
  const agent = await AgentModel.findOne({ _id: agentId, ownerId }).lean()
  if (!agent) {
    throw new ApiError(404, 'Agent not found', 'AGENT_NOT_FOUND')
  }

  const productFilter =
    agent.productAccess === 'all'
      ? { ownerId, status: { $ne: 'archived' } }
      : { ownerId, _id: { $in: agent.productIds }, status: { $ne: 'archived' } }

  const products = await ProductModel.find(productFilter)
    .sort({ name: 1 })
    .select({ name: 1, sku: 1, category: 1, price: 1, currency: 1, description: 1 })
    .lean()

  if (products.length === 0) {
    throw new ApiError(400, 'Create products before starting a live agent session', 'LIVE_AGENT_NO_PRODUCTS')
  }

  return { agent, products }
}

const extractJsonObject = (value: string) => {
  const trimmed = value.trim()
  const withoutFences = trimmed
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()

  const firstBrace = withoutFences.indexOf('{')
  const lastBrace = withoutFences.lastIndexOf('}')

  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return withoutFences.slice(firstBrace, lastBrace + 1)
  }

  return withoutFences
}

const trimDanglingJsonTokens = (value: string) => {
  let repaired = value.trimEnd()

  while (true) {
    const next = repaired
      .replace(/,\s*$/, '')
      .replace(/:\s*$/, '')

    if (next === repaired) {
      break
    }

    repaired = next
  }

  repaired = repaired.replace(/,\s*"[^"\\]*(?:\\.[^"\\]*)*"\s*$/, '')
  repaired = repaired.replace(/\{\s*"[^"\\]*(?:\\.[^"\\]*)*"\s*$/, '{')

  return repaired
}

const closeLikelyTruncatedJsonObject = (value: string) => {
  const source = extractJsonObject(value).trim()
  const firstBrace = source.indexOf('{')
  if (firstBrace < 0) {
    return null
  }

  const candidate = source.slice(firstBrace)
  let repaired = ''
  let inString = false
  let escaped = false
  const stack: Array<'{' | '['> = []

  for (const char of candidate) {
    repaired += char

    if (inString) {
      if (escaped) {
        escaped = false
        continue
      }

      if (char === '\\') {
        escaped = true
        continue
      }

      if (char === '"') {
        inString = false
      }
      continue
    }

    if (char === '"') {
      inString = true
      continue
    }

    if (char === '{' || char === '[') {
      stack.push(char)
      continue
    }

    if (char === '}' && stack[stack.length - 1] === '{') {
      stack.pop()
      continue
    }

    if (char === ']' && stack[stack.length - 1] === '[') {
      stack.pop()
    }
  }

  if (inString) {
    repaired += '"'
  }

  repaired = trimDanglingJsonTokens(repaired)

  while (stack.length > 0) {
    const open = stack.pop()
    repaired += open === '{' ? '}' : ']'
  }

  return repaired
}

const orderDraftJsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    readyToPlace: { type: 'boolean' },
    reason: { type: 'string' },
    customerName: { type: 'string' },
    customerPhone: { type: 'string' },
    customerEmail: { type: 'string' },
    notes: { type: 'string' },
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          productLabel: { type: 'string' },
          quantity: { type: 'number' }
        },
        required: ['productLabel', 'quantity']
      }
    }
  },
  required: ['readyToPlace', 'reason', 'items']
} as const

const previewText = (value: string | undefined, maxLength = 280) => {
  const text = value?.replace(/\s+/g, ' ').trim() ?? ''
  return text.length <= maxLength ? text : `${text.slice(0, maxLength)}...`
}

const responseTextFromCandidates = (response: {
  text?: string
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string
        thought?: boolean
      }>
    }
  }>
}) => {
  const directText = response.text?.trim() ?? ''
  const partsText = (response.candidates?.[0]?.content?.parts ?? [])
    .map((part) => (typeof part?.text === 'string' ? part.text : ''))
    .join('')
    .trim()

  if (!partsText) {
    return directText
  }

  if (!directText) {
    return partsText
  }

  const directLooksTruncatedJson = directText.includes('{') && !directText.includes('}')
  if (directLooksTruncatedJson && partsText.length >= directText.length) {
    return partsText
  }

  return partsText.length > directText.length ? partsText : directText
}

type ParsedOrderDraft = {
  readyToPlace: boolean
  reason: string
  customerName?: string
  customerPhone?: string
  customerEmail?: string
  notes?: string
  items: Array<{ productLabel: string; quantity: number }>
}

const normalizeParsedOrderDraft = (value: unknown): ParsedOrderDraft | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }

  const record = value as Record<string, unknown>
  const rawItems = Array.isArray(record.items) ? record.items : []
  const items = rawItems
    .map((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        return null
      }

      const itemRecord = item as Record<string, unknown>
      const productLabel = typeof itemRecord.productLabel === 'string' ? itemRecord.productLabel.trim() : ''
      const quantityRaw =
        typeof itemRecord.quantity === 'number'
          ? itemRecord.quantity
          : typeof itemRecord.quantity === 'string'
            ? Number(itemRecord.quantity)
            : Number.NaN

      if (!productLabel || !Number.isFinite(quantityRaw) || quantityRaw <= 0) {
        return null
      }

      return {
        productLabel,
        quantity: quantityRaw
      }
    })
    .filter((item): item is { productLabel: string; quantity: number } => Boolean(item))

  return {
    readyToPlace: typeof record.readyToPlace === 'boolean' ? record.readyToPlace : false,
    reason: typeof record.reason === 'string' ? record.reason.trim() : '',
    customerName: typeof record.customerName === 'string' ? record.customerName.trim() : '',
    customerPhone: typeof record.customerPhone === 'string' ? record.customerPhone.trim() : '',
    customerEmail: typeof record.customerEmail === 'string' ? record.customerEmail.trim() : '',
    notes: typeof record.notes === 'string' ? record.notes.trim() : '',
    items
  }
}

const parseOrderDraftJson = (rawText: string): ParsedOrderDraft => {
  const parsed = JSON.parse(extractJsonObject(rawText)) as unknown
  const normalized = normalizeParsedOrderDraft(parsed)
  if (!normalized) {
    throw new SyntaxError('Order draft JSON did not contain an object payload')
  }
  return normalized
}

const tryParseLocallyRepairedOrderDraft = (rawText: string): ParsedOrderDraft | null => {
  const repairedJson = closeLikelyTruncatedJsonObject(rawText)
  if (!repairedJson) {
    return null
  }

  try {
    return parseOrderDraftJson(repairedJson)
  } catch {
    return null
  }
}

const extractPartialOrderDraftFromMalformedJson = (rawText: string): ParsedOrderDraft | null => {
  const source = extractJsonObject(rawText)
  if (!source.trim()) {
    return null
  }

  const readyToPlaceMatch = source.match(/"readyToPlace"\s*:\s*(true|false)/i)
  const reasonMatch = source.match(/"reason"\s*:\s*"([^"]*)/i)
  const customerNameMatch = source.match(/"customerName"\s*:\s*"([^"]*)/i)
  const customerPhoneMatch = source.match(/"customerPhone"\s*:\s*"([^"]*)/i)
  const customerEmailMatch = source.match(/"customerEmail"\s*:\s*"([^"]*)/i)
  const notesMatch = source.match(/"notes"\s*:\s*"([^"]*)/i)

  let items: Array<{ productLabel: string; quantity: number }> = []
  const itemsMatch = source.match(/"items"\s*:\s*(\[[\s\S]*\])/i)
  if (itemsMatch?.[1]) {
    try {
      const parsedItems = JSON.parse(itemsMatch[1]) as Array<{ productLabel: string; quantity: number }>
      if (Array.isArray(parsedItems)) {
        items = parsedItems
      }
    } catch {
      items = []
    }
  }

  const hasRecoverableField =
    Boolean(readyToPlaceMatch) ||
    Boolean(reasonMatch) ||
    Boolean(customerNameMatch) ||
    Boolean(customerPhoneMatch) ||
    Boolean(customerEmailMatch) ||
    Boolean(notesMatch) ||
    items.length > 0

  if (!hasRecoverableField) {
    return null
  }

  return {
    readyToPlace: readyToPlaceMatch?.[1]?.toLowerCase() === 'true',
    reason: reasonMatch?.[1]?.trim() ?? '',
    customerName: customerNameMatch?.[1]?.trim() ?? '',
    customerPhone: customerPhoneMatch?.[1]?.trim() ?? '',
    customerEmail: customerEmailMatch?.[1]?.trim() ?? '',
    notes: notesMatch?.[1]?.trim() ?? '',
    items
  }
}

const isUsefulSalvagedOrderDraft = (draft: ParsedOrderDraft) => {
  const normalizedReason = draft.reason.trim()
  const usefulReason = normalizedReason.length >= 12
  const hasMinimumReason = normalizedReason.length >= 6
  const hasStructuredSignal =
    Boolean(draft.customerName?.trim()) ||
    Boolean(draft.customerPhone?.trim()) ||
    Boolean(draft.customerEmail?.trim()) ||
    Boolean(draft.notes?.trim()) ||
    draft.items.length > 0

  if (!draft.readyToPlace && hasMinimumReason) {
    return true
  }

  return hasStructuredSignal || usefulReason
}

type ExtractedOrderDraft = {
  analysisSource: 'ai' | 'heuristic'
  readyToPlace: boolean
  hasCustomerName: boolean
  hasItems: boolean
  hasConfirmation: boolean
  reason: string
  customerName: string
  customerPhone: string
  customerEmail: string
  notes: string
  items: Array<{ productLabel: string; quantity: number }>
  nameCorrectedAfterRecap?: boolean
}

const parseGeneratedOrderDraft = async (
  rawText: string,
  context: {
    stage: 'primary' | 'fallback'
    agentId: string
    source: 'mic' | 'script'
    catalog: string
    conversation: string
    normalizedConversation: string
  }
  ) => {
  try {
    return parseOrderDraftJson(rawText)
  } catch (error) {
    const locallyRepaired = tryParseLocallyRepairedOrderDraft(rawText)
    if (locallyRepaired && isUsefulSalvagedOrderDraft(locallyRepaired)) {
      logger.info(
        {
          err: error,
          agentId: context.agentId,
          source: context.source,
          stage: context.stage,
          responsePreview: previewText(rawText),
          salvaged: {
            readyToPlace: locallyRepaired.readyToPlace,
            hasCustomerName: Boolean(locallyRepaired.customerName),
            hasItems: locallyRepaired.items.length > 0,
            reason: locallyRepaired.reason
          }
        },
        'Gemini order extraction returned malformed JSON; locally repaired and salvaged structured data'
      )
      return locallyRepaired
    }

    const salvaged = locallyRepaired ?? extractPartialOrderDraftFromMalformedJson(rawText)
    if (salvaged && isUsefulSalvagedOrderDraft(salvaged)) {
      logger.warn(
        {
          err: error,
          agentId: context.agentId,
          source: context.source,
          stage: context.stage,
          responsePreview: previewText(rawText),
          salvaged: {
            readyToPlace: salvaged.readyToPlace,
            hasCustomerName: Boolean(salvaged.customerName),
            hasItems: salvaged.items.length > 0,
            reason: salvaged.reason
          }
        },
        'Gemini order extraction returned malformed JSON; salvaged partial structured data locally'
      )
      return salvaged
    }

    if (salvaged) {
      logger.warn(
        {
          err: error,
          agentId: context.agentId,
          source: context.source,
          stage: context.stage,
          responsePreview: previewText(rawText),
          salvaged: {
            readyToPlace: salvaged.readyToPlace,
            hasCustomerName: Boolean(salvaged.customerName),
            hasItems: salvaged.items.length > 0,
            reason: salvaged.reason
          }
        },
        'Gemini order extraction salvage was too sparse; attempting repair pass'
      )
    } else {
      logger.warn(
        {
          err: error,
          agentId: context.agentId,
          source: context.source,
          stage: context.stage,
          responsePreview: previewText(rawText)
        },
        'Gemini order extraction returned malformed JSON; attempting repair pass'
      )
    }

    if (!geminiClient) {
      throw error
    }

    const repairResponse = await geminiClient.models.generateContent({
      model: env.GEMINI_ORDER_EXTRACTION_MODEL,
      contents: [
        'Repair this malformed order-extraction JSON into valid JSON.',
        'Return only valid JSON and do not use markdown fences.',
        'Use the malformed JSON, the raw conversation, the normalized conversation, and the allowed catalog together.',
        'If the malformed JSON is missing customerName, items, or reason but those are clear from the conversation, restore them.',
        'Do not invent missing order details. Preserve the intended values if they are present.',
        'Keep reason as one short plain-English sentence. Do not add escaped quotes or line breaks inside reason.',
        `Allowed catalog:\n${context.catalog}`,
        `Raw conversation:\n${context.conversation || 'No conversation captured yet.'}`,
        `Normalized conversation:\n${context.normalizedConversation || 'No normalized conversation available.'}`,
        `Malformed JSON:\n${rawText}`
      ].join('\n\n'),
      config: {
        responseMimeType: 'application/json',
        responseJsonSchema: orderDraftJsonSchema,
        thinkingConfig: {
          thinkingBudget: 0
        },
        temperature: 0,
        maxOutputTokens: 600
      }
    })

    const repairedText = responseTextFromCandidates(repairResponse)
    if (!repairedText) {
      throw error
    }

    let repaired: ParsedOrderDraft
    try {
      repaired = parseOrderDraftJson(repairedText)
    } catch (repairParseError) {
      const locallyRepairedRepair = tryParseLocallyRepairedOrderDraft(repairedText)
      if (locallyRepairedRepair && isUsefulSalvagedOrderDraft(locallyRepairedRepair)) {
        logger.info(
          {
            err: repairParseError,
            agentId: context.agentId,
            source: context.source,
            stage: context.stage,
            repairedResponsePreview: previewText(repairedText),
            salvaged: {
              readyToPlace: locallyRepairedRepair.readyToPlace,
              hasCustomerName: Boolean(locallyRepairedRepair.customerName),
              hasItems: locallyRepairedRepair.items.length > 0,
              reason: locallyRepairedRepair.reason
            }
          },
          'Gemini order extraction repair response was malformed; locally repaired and salvaged structured data'
        )
        return locallyRepairedRepair
      }

      const salvagedRepair = locallyRepairedRepair ?? extractPartialOrderDraftFromMalformedJson(repairedText)
      if (salvagedRepair && isUsefulSalvagedOrderDraft(salvagedRepair)) {
        logger.warn(
          {
            err: repairParseError,
            agentId: context.agentId,
            source: context.source,
            stage: context.stage,
            repairedResponsePreview: previewText(repairedText),
            salvaged: {
              readyToPlace: salvagedRepair.readyToPlace,
              hasCustomerName: Boolean(salvagedRepair.customerName),
              hasItems: salvagedRepair.items.length > 0,
              reason: salvagedRepair.reason
            }
          },
          'Gemini order extraction repair response was malformed; salvaged repaired structured data locally'
        )
        return salvagedRepair
      }

      logger.info(
        {
          err: repairParseError,
          agentId: context.agentId,
          source: context.source,
          stage: context.stage,
          repairedResponsePreview: previewText(repairedText)
        },
        'Gemini order extraction repair response was malformed and unusable'
      )
      throw repairParseError
    }

    logger.warn(
      {
        agentId: context.agentId,
        source: context.source,
        stage: context.stage,
        repairedResponsePreview: previewText(repairedText)
      },
      'Gemini order extraction JSON repair succeeded'
    )
    return repaired
  }
}

const mergeAiAndHeuristicDraft = (
  parsed: ParsedOrderDraft,
  heuristicDraft: ExtractedOrderDraft
): ExtractedOrderDraft => {
  const customerName = parsed.customerName?.trim() || heuristicDraft.customerName || ''
  const customerPhone = parsed.customerPhone?.trim() || heuristicDraft.customerPhone || ''
  const customerEmail = parsed.customerEmail?.trim() || heuristicDraft.customerEmail || ''
  const notes = parsed.notes?.trim() || heuristicDraft.notes || ''
  const items = Array.isArray(parsed.items) && parsed.items.length > 0 ? parsed.items : heuristicDraft.items
  const hasCustomerName = Boolean(customerName)
  const hasItems = Array.isArray(items) && items.length > 0
  const hasConfirmation = Boolean(parsed.readyToPlace || heuristicDraft.hasConfirmation)
  const readyToPlace = Boolean(hasCustomerName && hasItems && (parsed.readyToPlace || heuristicDraft.readyToPlace))

  return {
    analysisSource: 'ai',
    readyToPlace,
    hasCustomerName,
    hasItems,
    hasConfirmation,
    reason:
      parsed.reason ||
      heuristicDraft.reason ||
      (!hasCustomerName
        ? 'Customer name is still required before the order can be placed.'
        : !hasItems
          ? 'The product summary is still incomplete.'
          : 'The conversation is not confirmed enough yet.'),
    customerName,
    customerPhone,
    customerEmail,
    notes,
    items
  }
}

const normalizeConversationForExtraction = async (
  conversation: string,
  catalog: string
) => {
  if (!geminiClient || !conversation.trim()) {
    return conversation
  }

  try {
    const response = await geminiClient.models.generateContent({
      model: env.GEMINI_ORDER_EXTRACTION_MODEL,
      contents: [
        'Normalize this order-taking conversation into a concise semantic transcript.',
        'The transcript may contain fragmented speech-recognition chunks, mixed scripts, and multiple languages.',
        'The speakers may use English, Hindi, Urdu, Roman Urdu, or short confirmations from another language.',
        'Rewrite the conversation into clear turn-by-turn lines while preserving the real meaning.',
        'Translate non-English content into simple English, but preserve customer names and catalog product names accurately.',
        'Do not invent missing details. If something is uncertain, keep it uncertain.',
        'Return plain text only, one line per turn, using exactly the prefixes "Customer:" and "Agent:".',
        `Allowed catalog:\n${catalog}`,
        `Raw conversation:\n${conversation}`
      ].join('\n\n'),
      config: {
        temperature: 0,
        maxOutputTokens: 700
      }
    })

    return response.text?.trim() || conversation
  } catch {
    return conversation
  }
}

const normalizeTranscriptSpacing = (value: string) =>
  value
    .replace(/\s+([,.!?])/g, '$1')
    .replace(/\(\s+/g, '(')
    .replace(/\s+\)/g, ')')
    .replace(/\s{2,}/g, ' ')
    .trim()

const standaloneShortTokens = new Set([
  'a',
  'i',
  'an',
  'am',
  'at',
  'by',
  'do',
  'go',
  'he',
  'hi',
  'if',
  'in',
  'is',
  'it',
  'ji',
  'me',
  'my',
  'no',
  'of',
  'ok',
  'on',
  'or',
  'to',
  'up',
  'us',
  'we',
  'ye'
])

const mergeSpeakerTurns = (conversation: Array<{ speaker: 'customer' | 'agent'; text: string }>) => {
  const merged: Array<{ speaker: 'customer' | 'agent'; text: string }> = []

  for (const entry of conversation) {
    const text = entry.text.trim()
    if (!text) continue

    const last = merged[merged.length - 1]
    if (!last || last.speaker !== entry.speaker) {
      merged.push({ speaker: entry.speaker, text })
      continue
    }

    const shortFragment = text.toLowerCase()
    const needsDirectJoin =
      /^[.,!?)]$/.test(text) ||
      ((/^[\p{L}\p{M}]{1,2}$/u.test(text) || /^[a-z]{1,2}$/i.test(text)) &&
        !standaloneShortTokens.has(shortFragment) &&
        /[\p{L}\p{M}]$/u.test(last.text) &&
        !/\s$/.test(last.text))

    last.text = normalizeTranscriptSpacing(`${last.text}${needsDirectJoin ? '' : ' '}${text}`)
  }

  return merged.map((entry) => ({
    ...entry,
    text: normalizeTranscriptSpacing(entry.text)
  }))
}

const normalizeComparable = (value: string) =>
  value
    .toLowerCase()
    .replace(/ज़िंगर|जिंगर|زنگر/gu, ' zinger ')
    .replace(/बर्गर|बरगर|برگر/gu, ' burger ')
    .replace(/चिकन|چکن/gu, ' chicken ')
    .replace(/सिंगल|سنگل/gu, ' single ')
    .replace(/कुछ\s+और/gu, ' kuch aur ')
    .replace(/और\s+जोड़ना/gu, ' aur jodna ')
    .replace(/और\s+चाहिए/gu, ' aur chahiye ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const quantityWordMap: Record<string, number> = {
  a: 1,
  an: 1,
  one: 1,
  single: 1,
  ek: 1,
  ایک: 1,
  एक: 1,
  two: 2,
  do: 2,
  دو: 2,
  दो: 2,
  three: 3,
  teen: 3,
  تین: 3,
  तीन: 3,
  four: 4,
  char: 4,
  چار: 4,
  चार: 4,
  five: 5,
  paanch: 5,
  پانچ: 5,
  पांच: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10
}

const singularizeWord = (value: string) => value.replace(/s$/i, '')

const tokenizeComparable = (value: string) =>
  normalizeComparable(value)
    .split(/\s+/)
    .map((token) => singularizeWord(token.trim()))
    .filter(Boolean)

const getTokenQuantity = (token: string) => {
  if (/^\d+$/.test(token)) {
    return Number(token)
  }

  return quantityWordMap[token] ?? null
}

const getEditDistance = (left: string, right: string) => {
  if (left === right) return 0
  if (!left.length) return right.length
  if (!right.length) return left.length

  const matrix = Array.from({ length: left.length + 1 }, () => Array(right.length + 1).fill(0))

  for (let i = 0; i <= left.length; i += 1) {
    matrix[i]![0] = i
  }

  for (let j = 0; j <= right.length; j += 1) {
    matrix[0]![j] = j
  }

  for (let i = 1; i <= left.length; i += 1) {
    for (let j = 1; j <= right.length; j += 1) {
      const substitutionCost = left[i - 1] === right[j - 1] ? 0 : 1
      matrix[i]![j] = Math.min(
        matrix[i - 1]![j]! + 1,
        matrix[i]![j - 1]! + 1,
        matrix[i - 1]![j - 1]! + substitutionCost
      )
    }
  }

  return matrix[left.length]![right.length]!
}

const areSimilarTokens = (left: string, right: string) => {
  if (!left || !right) return false
  if (left === right) return true

  const shorterLength = Math.min(left.length, right.length)
  if (shorterLength >= 4 && (left.startsWith(right) || right.startsWith(left))) {
    return true
  }

  if (left.length >= 4 && right.length >= 4 && getEditDistance(left, right) <= 1) {
    return true
  }

  return false
}

const getProductTokenCoverage = (text: string, productName: string) => {
  const textTokens = tokenizeComparable(text)
  const productTokens = tokenizeComparable(productName)

  if (textTokens.length === 0 || productTokens.length === 0) {
    return 0
  }

  const usedIndexes = new Set<number>()
  let matchedTokens = 0

  for (const productToken of productTokens) {
    const matchIndex = textTokens.findIndex((textToken, index) => !usedIndexes.has(index) && areSimilarTokens(textToken, productToken))
    if (matchIndex >= 0) {
      usedIndexes.add(matchIndex)
      matchedTokens += 1
    }
  }

  return matchedTokens / productTokens.length
}

const textLikelyMentionsProduct = (text: string, productName: string, minimumCoverage = 1) => {
  const comparableText = normalizeComparable(text)
  const comparableProduct = normalizeComparable(productName)

  if (comparableText.includes(comparableProduct)) {
    return true
  }

  return getProductTokenCoverage(text, productName) >= minimumCoverage
}

const findBestCatalogMatch = (
  text: string,
  products: Array<{ _id: { toString(): string }; name: string }>,
  minimumCoverage = 1
) => {
  let bestMatch: { productLabel: string; coverage: number } | null = null

  for (const product of products) {
    const coverage = getProductTokenCoverage(text, product.name)
    if (coverage < minimumCoverage) {
      continue
    }

    if (!bestMatch || coverage > bestMatch.coverage) {
      bestMatch = {
        productLabel: product.name,
        coverage
      }
    }
  }

  return bestMatch
}

const detectQuantityFromText = (text: string) => {
  for (const token of tokenizeComparable(text)) {
    const quantity = getTokenQuantity(token)
    if (quantity) {
      return quantity
    }
  }

  return 1
}

const extractQuantityForProduct = (text: string, productName: string) => {
  if (!textLikelyMentionsProduct(text, productName, 1)) {
    return null
  }

  const textTokens = tokenizeComparable(text)
  const productTokens = tokenizeComparable(productName)
  const matchedTokenIndexes = textTokens
    .map((token, index) => (productTokens.some((productToken) => areSimilarTokens(token, productToken)) ? index : -1))
    .filter((index) => index >= 0)

  if (matchedTokenIndexes.length === 0) {
    return null
  }

  const lastMentionIndex = matchedTokenIndexes[matchedTokenIndexes.length - 1]!
  const quantitySearchStart = Math.max(0, lastMentionIndex - 4)

  for (let index = lastMentionIndex - 1; index >= quantitySearchStart; index -= 1) {
    const quantity = getTokenQuantity(textTokens[index]!)
    if (quantity) {
      return quantity
    }
  }

  return 1
}

const extractSuggestedCatalogItem = (
  conversation: Array<{ speaker: 'customer' | 'agent'; text: string }>,
  products: Array<{ _id: { toString(): string }; name: string }>
) => {
  const recentEntries = conversation.slice(-12)

  for (let index = recentEntries.length - 1; index >= 0; index -= 1) {
    const entry = recentEntries[index]!
    const comparableEntry = normalizeComparable(entry.text)
    const isAgentSuggestion =
      entry.speaker === 'agent' &&
      /(did you mean|we have|would you like|do you mean|i can offer|we can offer|available|instead|got it|that is|this is)/i.test(
        comparableEntry
      )
    const isCustomerRequest = entry.speaker === 'customer'

    if (!isAgentSuggestion && !isCustomerRequest) {
      continue
    }

    const bestMatch = findBestCatalogMatch(entry.text, products, isAgentSuggestion ? 0.75 : 1)
    if (bestMatch) {
      const previousCustomerContext = recentEntries
        .slice(0, index)
        .reverse()
        .find((candidate) => candidate.speaker === 'customer')

      return {
        productLabel: bestMatch.productLabel,
        quantity: detectQuantityFromText(previousCustomerContext?.text || entry.text)
      }
    }
  }

  return null
}

const productSuggestionPattern =
  /(did you mean|do you mean|would you like|we have|available|instead|i can offer|we can offer|got it|did you want)/i

const findLatestAcceptedProductCorrection = (
  conversation: Array<{ speaker: 'customer' | 'agent'; text: string }>,
  products: Array<{ _id: { toString(): string }; name: string }>
) => {
  for (let index = conversation.length - 1; index >= 0; index -= 1) {
    const entry = conversation[index]!
    if (entry.speaker !== 'agent' || !productSuggestionPattern.test(entry.text)) {
      continue
    }

    const bestMatch = findBestCatalogMatch(entry.text, products, 0.75)
    if (!bestMatch) {
      continue
    }

    const nextCustomerReply = conversation.find((candidate, candidateIndex) => candidateIndex > index && candidate.speaker === 'customer')
    if (!nextCustomerReply) {
      continue
    }

    if (
      hasPositiveConfirmation(nextCustomerReply.text) ||
      textLikelyMentionsProduct(nextCustomerReply.text, bestMatch.productLabel, 0.5)
    ) {
      return {
        productLabel: bestMatch.productLabel,
        index
      }
    }
  }

  return null
}

const extractNameFromRecap = (text: string) => {
  const match = text.match(/\bfor\s+(.+)/iu)
  const altMatch =
    text.match(/([\p{L}\p{M}' .-]{1,80})\s+के\s+लिए/u) ?? text.match(/([\p{L}\p{M}' .-]{1,80})\s+کے\s+لیے/u)
  const leadingAddressMatch =
    text.match(
      /^(?:okay|ok|alright|all right|understood|got it|so|toh|theek hai|ठीक है|ٹھیک ہے)\s+([\p{L}][\p{L}\p{M}' .-]{0,60}?)(?=\s*,?\s*(?:that|this|it|yeh|yeah|یہ|यह)(?:\s|$))/iu
    ) ??
    text.match(
      /^([\p{L}][\p{L}\p{M}' .-]{0,60}?)\s+(?:के लिए|کے لیے|for)\s+(?:that|this|it|yeh|یہ|यह)(?:\s|$)/iu
    )
  const candidateSource = match?.[1] || altMatch?.[1] || leadingAddressMatch?.[1]
  if (!candidateSource) {
    return ''
  }

  const sentenceChunk = candidateSource.split(/[.?!,]/, 1)[0]?.trim() ?? ''
  const withoutTrailingPrompt = sentenceChunk
    .replace(/\b(shall|may|can|could|would|will|should)\b.*$/iu, '')
    .replace(/\b(place|confirm|process|submit|check)\b.*$/iu, '')
    .replace(/\s+(है|ہے)\b.*$/u, '')
    .trim()

  const tokens = withoutTrailingPrompt
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean)
  const filteredTokens = tokens.filter(
    (token) =>
      !/^(a|an|one|single|ek|एक|ایک|zinger|burger|burgers|chicken|चिकन|बरगर|بर्गर|کے|لیے|लिए|के|hai|है|ہے|to|तो|yeh|यह|this|is)$/iu.test(
        token
      ) &&
      !/^\d+$/u.test(token)
  )

  const nameCandidate = filteredTokens.slice(-3).join(' ').trim()
  return /^[\p{L}][\p{L}\p{M}' .-]{0,60}$/u.test(nameCandidate) ? nameCandidate : ''
}

const extractNameFromAgentAcknowledgement = (text: string) => {
  const acknowledgementMatch =
    text.match(/\b(?:thank you|thanks|shukriya|shukran)\s*,?\s*([\p{L}][\p{L}\p{M}' .-]{0,60})/iu) ??
    text.match(/(?:शुक्रिया|धन्यवाद|شکریہ)\s*,?\s*([\p{L}][\p{L}\p{M}' .-]{0,60})/u) ??
    text.match(/\b(?:hello|hi|hey)\s+([\p{L}][\p{L}\p{M}' .-]{0,60})/iu) ??
    text.match(
      /\b(?:okay|ok|alright|understood|got it|theek hai|ठीक है|ٹھیک ہے)\s+([\p{L}][\p{L}\p{M}' .-]{0,60}?)(?=\s*,?\s*(?:that|this|it|anything|would)\b)/iu
    )

  if (!acknowledgementMatch?.[1]) {
    return ''
  }

  const candidate = acknowledgementMatch[1].split(/[.?!,]/, 1)[0]?.trim() ?? ''
  return /^[\p{L}][\p{L}\p{M}' .-]{0,60}$/u.test(candidate) ? candidate : ''
}

const hasPositiveConfirmation = (text: string) => {
  const comparable = normalizeComparable(text)
  return (
    /\b(yes|yes please|yeah|yeah please|yep|correct|confirm|confirmed|please do|go ahead|place it|place my order|place the order|is my order place|is my order placed|is the order place|is the order placed|my order place|my order placed|ok|okay|okay please)\b/i.test(
      comparable
    ) ||
    /\b(haan|han|haan ji|han ji|ji|ji please|jee|jee haan|theek hai|thik hai|kar dein|kar de|place kar dein)\b/i.test(comparable) ||
    /(हाँ|ہاں|جی ہاں|جی|जी|जी हाँ|जी का|जी प्लीज|यस|यस प्लीज|प्लीज|ठीक है|ٹھیک ہے|कर दो|کر دو|कर دیں|کر دیں|بالکل|うん|はい)/u.test(
      text
    )
  )
}

const hasNegativeAdditionalItemsResponse = (text: string) => {
  const comparable = normalizeComparable(text)
  return (
    /\b(no|non|nope|none|nothing else|that s all|thats all|that is all|all good|just this|only this|bas|bus|nahin|nahi|nah)\b/i.test(
      comparable
    ) ||
    /(नहीं|نہیں|نهीं|बस|اور نہیں|बस इतना|بس اتنا)/u.test(text)
  )
}

const nameQuestionPattern =
  /(may i have your name|what is your name|your name please|could i have your name|can i have your name|aapka naam|aap ka naam|naam jaan sakta|naam bata|naam kya hai|آپ کا نام|نام کیا ہے)/i
const additionalItemsPromptPattern =
  /(anything else|any other item|would you like anything else|would you like to add anything else|do you want anything else|something else|add anything else|anything more|kuch aur|aur mangwana|aur jodna|aur chahiye|कुछ और|और जोड़ना|और चाहिए|जोड़ना चाहेंगे|जोड़ना चाहते|اور کچھ|مزید کچھ)/i
const recapPattern =
  /(just to confirm|this is|that is|shall i place|may i place|pusti karne ke liye|pushti karne ke liye|kya main order place karu|kya main order place kar doon|kya main aapka order place karu|पुष्टि|एक बार पुष्टि|क्या मैं ऑर्डर|क्या मैं आपका ऑर्डर|آرڈر پلیس کروں|کیا میں آرڈر پلیس کروں)|(?:^|[\s,])(?:yeh|ye|یہ|यह)(?:[\s,].*?)?(?:hai|ho gaya|ho gaye|hain|ہے|ہیں)(?:[.?!,\s]|$)/i
const nameCorrectionPattern =
  /\b(no[, ]+|not\s+|actually[, ]+|sorry[, ]+|correction[, ]+|my name is|name is|it is|it's|i am|i'm|this is|call me)\b/i
const nonNameUtterancePattern =
  /\b(hello|hi|hey|order|place|placed|placing|processing|process|confirm|confirmed|system|burger|zinger|yes|yeah|okay|ok|please|plz|pls|no|nope|none|haan|han|ji|jee|theek|thik|nahi|nahin|nah|यस|प्लीज|जी|हाँ|नहीं|جی|ہاں|نہیں|پلیز)\b/iu

const isLikelyBareName = (text: string) => {
  const cleaned = text.replace(/[.?!,]+$/g, '').trim()
  if (!cleaned) return false

  const comparable = normalizeComparable(cleaned)
  if (!comparable || hasPositiveConfirmation(comparable) || nonNameUtterancePattern.test(comparable)) {
    return false
  }

  const tokens = cleaned
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean)

  if (tokens.length === 0 || tokens.length > 3) {
    return false
  }

  return tokens.every((token) => /^[\p{L}][\p{L}\p{M}'-]*$/u.test(token))
}

const extractCustomerNameFromUtterance = (text: string, options?: { allowBare?: boolean }) => {
  const allowBare = options?.allowBare ?? true
  const normalized = text.trim()
  if (!normalized) return ''

  const structuredPatterns = [
    /\b(?:my name is|name is|it is|it's|i am|i'm|this is|call me|no[, ]+my name is|no[, ]+it is)\s+([\p{L}][\p{L}\p{M}' .-]{0,60}?)(?=\s*(?:[.?!,]|$|\band\b|\bi need\b|\bi want\b|\bplease\b))/iu,
    /(?:मेरा नाम|میرا نام|mera naam|mera nam)\s+([\p{L}][\p{L}\p{M}' .-]{0,60}?)(?=\s*(?:है|ہے|hai)\b|[.?!,]|$)/iu
  ]

  for (const pattern of structuredPatterns) {
    const structuredMatch = normalized.match(pattern)
    if (structuredMatch?.[1]) {
      return structuredMatch[1].trim()
    }
  }

  if (!allowBare) {
    return ''
  }

  const cleaned = normalized.replace(/^[^$\p{L}]*/u, '').replace(/[.?!,]+$/u, '').trim()
  const tokens = cleaned
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 4)

  const candidate = tokens.join(' ').trim()
  if (!candidate) {
    return ''
  }

  if (!isLikelyBareName(candidate)) {
    return ''
  }

  return /^[\p{L}][\p{L}\p{M}' .-]{0,60}$/u.test(candidate) ? candidate : ''
}

const buildHeuristicDraft = (
  conversation: Array<{ speaker: 'customer' | 'agent'; text: string }>,
  products: Array<{ _id: { toString(): string }; name: string }>,
  hints?: { customerName?: string }
) => {
  const agentRecapIndex = [...conversation]
    .reverse()
    .findIndex(
      (entry) =>
        entry.speaker === 'agent' &&
        recapPattern.test(entry.text)
    )

  const actualRecapIndex = agentRecapIndex >= 0 ? conversation.length - 1 - agentRecapIndex : -1
  const recapText = actualRecapIndex >= 0 ? conversation[actualRecapIndex]!.text : ''
  const lastNameQuestionIndex = [...conversation]
    .reverse()
    .findIndex((entry) => entry.speaker === 'agent' && nameQuestionPattern.test(entry.text))
  const actualNameQuestionIndex = lastNameQuestionIndex >= 0 ? conversation.length - 1 - lastNameQuestionIndex : -1
  const lastAdditionalItemsPromptIndex = [...conversation]
    .reverse()
    .findIndex((entry) => entry.speaker === 'agent' && additionalItemsPromptPattern.test(entry.text))
  const actualAdditionalItemsPromptIndex =
    lastAdditionalItemsPromptIndex >= 0 ? conversation.length - 1 - lastAdditionalItemsPromptIndex : -1
  const recapScopedAdditionalItemsPromptIndex =
    actualRecapIndex >= 0
      ? (() => {
          const reversedIndex = [...conversation]
            .slice(0, actualRecapIndex + 1)
            .reverse()
            .findIndex((entry) => entry.speaker === 'agent' && additionalItemsPromptPattern.test(entry.text))

          return reversedIndex >= 0 ? actualRecapIndex - reversedIndex : -1
        })()
      : actualAdditionalItemsPromptIndex
  const effectiveAdditionalItemsPromptIndex =
    recapScopedAdditionalItemsPromptIndex >= 0 ? recapScopedAdditionalItemsPromptIndex : actualAdditionalItemsPromptIndex
  const acceptedProductCorrection = findLatestAcceptedProductCorrection(conversation, products)
  const customerBeforeRecap = conversation.filter(
    (entry, index) => entry.speaker === 'customer' && (actualRecapIndex < 0 || index < actualRecapIndex)
  )
  const customerAfterRecap = actualRecapIndex >= 0 ? conversation.slice(actualRecapIndex + 1).filter((entry) => entry.speaker === 'customer') : []
  const explicitConfirmation = customerAfterRecap.some((entry) => hasPositiveConfirmation(entry.text))
  const firstConfirmationIndex =
    actualRecapIndex >= 0
      ? conversation.findIndex((entry, index) => index > actualRecapIndex && entry.speaker === 'customer' && hasPositiveConfirmation(entry.text))
      : -1
  const customerBetweenNameQuestionAndRecap = conversation.filter(
    (entry, index) =>
      entry.speaker === 'customer' &&
      actualNameQuestionIndex >= 0 &&
      index > actualNameQuestionIndex &&
      (actualRecapIndex < 0 || index < actualRecapIndex)
  )
  const customerAfterRecapBeforeConfirmation =
    actualRecapIndex >= 0
      ? conversation.filter(
          (entry, index) =>
            entry.speaker === 'customer' &&
            index > actualRecapIndex &&
            (firstConfirmationIndex < 0 || index < firstConfirmationIndex)
        )
      : []
  const askedForMoreItems =
    effectiveAdditionalItemsPromptIndex >= 0 && (actualRecapIndex < 0 || effectiveAdditionalItemsPromptIndex <= actualRecapIndex)
  const moreItemsResponseEntries = askedForMoreItems
    ? conversation.filter(
        (entry, index) =>
          entry.speaker === 'customer' &&
          index > effectiveAdditionalItemsPromptIndex &&
          (firstConfirmationIndex < 0 || index <= firstConfirmationIndex)
      )
    : []
  const moreItemsResolved = !askedForMoreItems ? false : moreItemsResponseEntries.length > 0
  const moreItemsReplyAfterRecap = askedForMoreItems
    ? conversation.find(
        (entry, index) =>
          entry.speaker === 'customer' &&
          index > Math.max(effectiveAdditionalItemsPromptIndex, actualRecapIndex)
      ) ?? null
    : null
  const implicitConfirmation =
    actualRecapIndex >= 0 &&
    effectiveAdditionalItemsPromptIndex >= 0 &&
    effectiveAdditionalItemsPromptIndex <= actualRecapIndex &&
    Boolean(moreItemsReplyAfterRecap && hasNegativeAdditionalItemsResponse(moreItemsReplyAfterRecap.text))

  const initialCustomerNameCandidates = customerBeforeRecap
    .map((entry) => extractCustomerNameFromUtterance(entry.text, { allowBare: false }))
    .filter(Boolean)

  const customerNameCandidates = customerBetweenNameQuestionAndRecap
    .map((entry) => extractCustomerNameFromUtterance(entry.text, { allowBare: true }))
    .filter(Boolean)

  const correctionNameCandidates = customerAfterRecapBeforeConfirmation
    .filter((entry) => !hasNegativeAdditionalItemsResponse(entry.text) && !hasPositiveConfirmation(entry.text))
    .map((entry) =>
      extractCustomerNameFromUtterance(entry.text, {
        allowBare: nameCorrectionPattern.test(entry.text) || isLikelyBareName(entry.text)
      })
    )
    .filter(Boolean)
  const acknowledgementNameCandidates = conversation
    .filter(
      (entry, index) =>
        entry.speaker === 'agent' &&
        index < (actualRecapIndex >= 0 ? actualRecapIndex : conversation.length) &&
        extractNameFromAgentAcknowledgement(entry.text)
    )
    .map((entry) => extractNameFromAgentAcknowledgement(entry.text))
    .filter(Boolean)

  const latestInitialCustomerName = initialCustomerNameCandidates.at(-1) ?? ''
  const latestCustomerName = customerNameCandidates.at(-1) ?? ''
  const latestCorrectionName = correctionNameCandidates.at(-1) ?? ''
  const latestAcknowledgedName = acknowledgementNameCandidates.at(-1) ?? ''
  const hintedCustomerName = hints?.customerName?.trim() ?? ''

  const candidateText = conversation.map((entry) => entry.text).join(' ')
  const matchedItems = products
    .map((product) => {
      const quantity = extractQuantityForProduct(candidateText, product.name)
      if (!quantity) return null
      return {
        productLabel: product.name,
        quantity
      }
    })
    .filter(Boolean) as Array<{ productLabel: string; quantity: number }>
  const suggestedItem = matchedItems.length === 0 ? extractSuggestedCatalogItem(conversation, products) : null

  const recapName = extractNameFromRecap(recapText)
  const customerName =
    latestCorrectionName || latestCustomerName || latestInitialCustomerName || recapName || latestAcknowledgedName || hintedCustomerName
  const recapNameMismatch =
    Boolean(latestCorrectionName && recapName) &&
    normalizeComparable(latestCorrectionName) !== normalizeComparable(recapName)
  const correctedProductNeedsFreshRecap = Boolean(
    acceptedProductCorrection &&
      (actualRecapIndex < acceptedProductCorrection.index ||
        !textLikelyMentionsProduct(recapText, acceptedProductCorrection.productLabel, 1))
  )
  const hasCustomerName = Boolean(customerName)
  const effectiveItems = matchedItems.length > 0 ? matchedItems : suggestedItem ? [suggestedItem] : []
  const hasItems = effectiveItems.length > 0
  const hasConfirmation = explicitConfirmation || implicitConfirmation

  return {
    analysisSource: 'heuristic' as const,
    readyToPlace: Boolean(
      actualRecapIndex >= 0 &&
        askedForMoreItems &&
        moreItemsResolved &&
        hasConfirmation &&
        hasCustomerName &&
        hasItems &&
        !recapNameMismatch &&
        !correctedProductNeedsFreshRecap
    ),
    hasCustomerName,
    hasItems,
    hasConfirmation: recapNameMismatch || correctedProductNeedsFreshRecap || !askedForMoreItems || !moreItemsResolved ? false : hasConfirmation,
    nameCorrectedAfterRecap: recapNameMismatch || correctedProductNeedsFreshRecap,
    reason: !hasCustomerName
      ? 'Customer name is still required before the order can be placed.'
      : recapNameMismatch
        ? `The customer corrected their name to ${latestCorrectionName}. Repeat the order summary with the corrected name before placing the order.`
      : correctedProductNeedsFreshRecap
        ? `The customer accepted ${acceptedProductCorrection?.productLabel}. Repeat the corrected order once before you move toward placement.`
      : !askedForMoreItems
        ? 'Ask the customer whether they want anything else before you recap and place the order.'
      : !moreItemsResolved
        ? 'The agent asked whether the customer wants anything else, but the customer has not answered yet.'
      : suggestedItem && matchedItems.length === 0
        ? `The customer request appears noisy. A likely catalog match is ${suggestedItem.quantity} ${suggestedItem.productLabel}. Ask the customer to confirm that item explicitly before placing the order.`
      : !hasItems
        ? 'The product summary is still incomplete.'
        : actualRecapIndex < 0
          ? 'The agent still needs to repeat the order summary back to the customer.'
          : !hasConfirmation
            ? 'The customer still needs to confirm the recapped order, or say that nothing else should be added after the recap.'
            : 'The order is confirmed and ready to place.',
    customerName,
    customerPhone: '',
    customerEmail: '',
    notes: '',
    items: effectiveItems
  }
}

export const geminiLiveService = {
  generateVoicePreview: async (
    ownerId: string,
    payload: {
      text?: string
      voiceProfile: {
        languageCode: string
        gender: 'female' | 'male' | 'neutral'
        voiceName: string
      }
    }
  ) => {
    if (!geminiClient) {
      throw new ApiError(503, 'Gemini voice preview is not configured on the server', 'GEMINI_LIVE_UNAVAILABLE')
    }

    const baseVoiceProfile = {
      languageCode: GEMINI_LIVE_LANGUAGE_CODES.includes(
        payload.voiceProfile.languageCode as (typeof GEMINI_LIVE_LANGUAGE_CODES)[number]
      )
        ? payload.voiceProfile.languageCode
        : 'en-US',
      gender: payload.voiceProfile.gender,
      voiceName: GEMINI_LIVE_VOICE_NAMES.includes(payload.voiceProfile.voiceName as (typeof GEMINI_LIVE_VOICE_NAMES)[number])
        ? payload.voiceProfile.voiceName
        : 'Kore'
    }
    const transcript = (payload.text ?? DEFAULT_VOICE_PREVIEW_TEXT).replace(/\s+/g, ' ').trim() || DEFAULT_VOICE_PREVIEW_TEXT

    const liveModelCandidates = Array.from(new Set([env.GEMINI_LIVE_MODEL, 'gemini-live-2.5-flash-preview']))
    const isTransientLiveError = (error: unknown) =>
      error instanceof Error &&
      /"status":"INTERNAL"|"status":"UNAVAILABLE"|\"code\":500|\"code\":503|\"code\":429|temporarily unavailable|try again|timeout|ECONNRESET|socket/i.test(
        error.message
      )
    const isModelNotFoundError = (error: unknown) =>
      error instanceof Error && /"status":"NOT_FOUND"|is not found for API version|not supported/i.test(error.message)
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

    const pcm16ToWavBase64 = (pcmData: Buffer, sampleRate = 24000) => {
      const channels = 1
      const bitsPerSample = 16
      const blockAlign = channels * (bitsPerSample / 8)
      const byteRate = sampleRate * blockAlign
      const dataSize = pcmData.length
      const wav = Buffer.alloc(44 + dataSize)

      wav.write('RIFF', 0)
      wav.writeUInt32LE(36 + dataSize, 4)
      wav.write('WAVE', 8)
      wav.write('fmt ', 12)
      wav.writeUInt32LE(16, 16)
      wav.writeUInt16LE(1, 20)
      wav.writeUInt16LE(channels, 22)
      wav.writeUInt32LE(sampleRate, 24)
      wav.writeUInt32LE(byteRate, 28)
      wav.writeUInt16LE(blockAlign, 32)
      wav.writeUInt16LE(bitsPerSample, 34)
      wav.write('data', 36)
      wav.writeUInt32LE(dataSize, 40)
      pcmData.copy(wav, 44)

      return wav.toString('base64')
    }

    const requestAudioFromLive = async (modelName: string, voiceName: string) =>
      new Promise<{ audioBase64: string; mimeType: string }>((resolve, reject) => {
        let settled = false
        let session: Awaited<ReturnType<GoogleGenAI['live']['connect']>> | null = null
        const pcmChunks: Buffer[] = []

        const cleanup = () => {
          if (session) {
            try {
              session.close()
            } catch {
              // best effort
            }
          }
        }

        const finalizeReject = (error: unknown) => {
          if (settled) return
          settled = true
          clearTimeout(timeoutId)
          cleanup()
          reject(error instanceof Error ? error : new Error('Gemini Live voice preview failed'))
        }

        const finalizeResolve = () => {
          if (settled) return
          settled = true
          clearTimeout(timeoutId)
          cleanup()
          const pcmData = Buffer.concat(pcmChunks)
          if (pcmData.length === 0) {
            reject(new Error('Gemini Live returned no audio chunks for voice preview'))
            return
          }

          resolve({
            audioBase64: pcm16ToWavBase64(pcmData),
            mimeType: 'audio/wav'
          })
        }

        const timeoutId = setTimeout(() => {
          finalizeReject(new Error('Timed out while waiting for Gemini Live voice preview audio'))
        }, 12000)

        void (async () => {
          try {
            session = await geminiClient.live.connect({
              model: modelName,
              config: {
                responseModalities: [Modality.AUDIO],
                temperature: 0,
                speechConfig: {
                  languageCode: baseVoiceProfile.languageCode,
                  voiceConfig: {
                    prebuiltVoiceConfig: {
                      voiceName
                    }
                  }
                },
                systemInstruction:
                  'You are a text-to-speech voice engine. Speak the given transcript as audio only. Do not respond with text.'
              },
              callbacks: {
                onmessage: (message) => {
                  const audioChunk = message.data?.trim()
                  if (audioChunk) {
                    try {
                      pcmChunks.push(Buffer.from(audioChunk, 'base64'))
                    } catch {
                      finalizeReject(new Error('Received invalid audio chunk from Gemini Live'))
                      return
                    }
                  }

                  if (message.serverContent?.turnComplete || message.serverContent?.generationComplete) {
                    finalizeResolve()
                  }
                },
                onerror: (event) => {
                  const eventMessage =
                    (event as { error?: { message?: string }; message?: string }).error?.message ??
                    (event as { message?: string }).message ??
                    'Gemini Live connection error'
                  finalizeReject(new Error(eventMessage))
                },
                onclose: (event) => {
                  if (settled) {
                    return
                  }
                  const reason = (event as { reason?: string }).reason
                  if (pcmChunks.length > 0) {
                    finalizeResolve()
                    return
                  }
                  finalizeReject(new Error(reason ? `Gemini Live closed before audio preview: ${reason}` : 'Gemini Live closed before audio preview'))
                }
              }
            })

            session.sendClientContent({
              turns: [
                {
                  role: 'user',
                  parts: [
                    {
                      text: transcript
                    }
                  ]
                }
              ],
              turnComplete: true
            })
          } catch (error) {
            finalizeReject(error)
          }
        })()
      })

    const requestAudioFromLiveWithRetries = async (modelName: string, voiceName: string) => {
      let attempts = 0
      let lastError: unknown
      while (attempts < 3) {
        attempts += 1
        try {
          return await requestAudioFromLive(modelName, voiceName)
        } catch (error) {
          lastError = error
          if (!isTransientLiveError(error) || attempts >= 3) {
            throw error
          }

          const waitMs = attempts * 350
          logger.warn(
            {
              err: error,
              ownerId,
              model: modelName,
              voiceName,
              attempt: attempts,
              nextRetryInMs: waitMs
            },
            'Gemini Live voice preview hit a transient error; retrying'
          )
          await wait(waitMs)
        }
      }

      throw (lastError instanceof Error ? lastError : new Error('Gemini Live voice preview retry failed'))
    }

    let lastError: unknown
    for (const [index, modelName] of liveModelCandidates.entries()) {
      try {
        let activeVoiceName = baseVoiceProfile.voiceName
        try {
          const preview = await requestAudioFromLiveWithRetries(modelName, activeVoiceName)
          return {
            model: modelName,
            audioBase64: preview.audioBase64,
            mimeType: preview.mimeType,
            voiceProfile: {
              ...baseVoiceProfile,
              voiceName: activeVoiceName
            }
          }
        } catch (primaryError) {
          if (activeVoiceName !== 'Kore' && (isTransientLiveError(primaryError) || /no audio|invalid audio|closed/i.test(String(primaryError)))) {
            logger.warn(
              {
                err: primaryError,
                ownerId,
                model: modelName,
                failedVoiceName: activeVoiceName,
                fallbackVoiceName: 'Kore'
              },
              'Gemini Live voice preview failed for selected voice; retrying with fallback voice'
            )
            activeVoiceName = 'Kore'
            const fallbackPreview = await requestAudioFromLiveWithRetries(modelName, activeVoiceName)
            return {
              model: modelName,
              audioBase64: fallbackPreview.audioBase64,
              mimeType: fallbackPreview.mimeType,
              voiceProfile: {
                ...baseVoiceProfile,
                voiceName: activeVoiceName
              }
            }
          }
          throw primaryError
        }
      } catch (error) {
        lastError = error
        const nextModel = liveModelCandidates[index + 1]
        logger.warn(
          {
            err: error,
            ownerId,
            model: modelName,
            nextModel: nextModel ?? null,
            voiceProfile: baseVoiceProfile
          },
          nextModel ? 'Gemini Live voice preview model failed; trying fallback Live model' : 'Gemini Live voice preview generation failed'
        )
        if (nextModel) {
          await wait(200)
          continue
        }
      }
    }

    if (isModelNotFoundError(lastError)) {
      throw new ApiError(
        500,
        `Configured GEMINI_LIVE_MODEL (${env.GEMINI_LIVE_MODEL}) is not available for Gemini Live. Set GEMINI_LIVE_MODEL to a supported Live model.`,
        'GEMINI_LIVE_MODEL_UNSUPPORTED'
      )
    }

    throw new ApiError(502, 'Unable to generate voice preview right now', 'GEMINI_VOICE_PREVIEW_FAILED', {
      message: lastError instanceof Error ? lastError.message : 'Unknown Gemini voice preview error'
    })
  },

  createEphemeralSessionToken: async (ownerId: string, agentId: string, source: 'mic' | 'script') => {
    if (!geminiClient) {
      throw new ApiError(503, 'Gemini Live is not configured on the server', 'GEMINI_LIVE_UNAVAILABLE')
    }

    const { agent, products } = await getAgentCatalog(ownerId, agentId)
    const agentRecord = agent as {
      voiceProfile?: Record<string, unknown>
      agentType?: unknown
      tableConfig?: Record<string, unknown>
    }
    const agentVoiceProfile = agentRecord.voiceProfile
    const resolvedAgentType: 'terminal' | 'table_order_taker' | 'whatsapp_call_attendant' =
      agentRecord.agentType === 'table_order_taker' || agentRecord.agentType === 'whatsapp_call_attendant'
        ? agentRecord.agentType
        : 'terminal'
    const agentTableConfig = agentRecord.tableConfig
    const voiceProfile = {
      languageCode:
        typeof agentVoiceProfile?.languageCode === 'string' &&
        GEMINI_LIVE_LANGUAGE_CODES.includes(
          agentVoiceProfile.languageCode as (typeof GEMINI_LIVE_LANGUAGE_CODES)[number]
        )
          ? agentVoiceProfile.languageCode
          : 'en-US',
      gender: typeof agentVoiceProfile?.gender === 'string' ? (agentVoiceProfile.gender as 'female' | 'male' | 'neutral') : 'female',
      voiceName:
        typeof agentVoiceProfile?.voiceName === 'string' &&
        GEMINI_LIVE_VOICE_NAMES.includes(agentVoiceProfile.voiceName as (typeof GEMINI_LIVE_VOICE_NAMES)[number])
          ? agentVoiceProfile.voiceName
          : 'Kore'
    }

    const expireTime = addMinutes(new Date(), env.GEMINI_LIVE_TOKEN_TTL_MINUTES).toISOString()
    const newSessionExpireTime = new Date(Date.now() + env.GEMINI_LIVE_NEW_SESSION_TTL_SECONDS * 1000).toISOString()

    const token = await geminiClient.authTokens.create({
      config: {
        uses: 1,
        expireTime,
        newSessionExpireTime,
        liveConnectConstraints: {
          model: env.GEMINI_LIVE_MODEL,
          config: {
            responseModalities: [Modality.AUDIO],
            temperature: 0.2,
            maxOutputTokens: 768,
            speechConfig: {
              languageCode: voiceProfile.languageCode,
              voiceConfig: {
                prebuiltVoiceConfig: {
                  voiceName: voiceProfile.voiceName
                }
              }
            },
            enableAffectiveDialog: true,
            systemInstruction: buildCatalogPrompt(
              {
                name: String(agent.name),
                description: typeof agent.description === 'string' ? agent.description : undefined,
                agentType: resolvedAgentType,
                productAccess: agent.productAccess === 'selected' ? 'selected' : 'all',
                mode: agent.mode === 'script' ? 'script' : 'mic',
                tableConfig: {
                  allowMultipleOrdersPerTable: agentTableConfig?.allowMultipleOrdersPerTable !== false,
                  defaultTableNumber:
                    typeof agentTableConfig?.defaultTableNumber === 'string' ? agentTableConfig.defaultTableNumber : undefined
                },
                voiceProfile
              },
              products.map((product) => ({
                id: product._id.toString(),
                name: product.name,
                sku: product.sku,
                category: product.category,
                price: product.price,
                currency: product.currency,
                description: product.description
              }))
            ),
            inputAudioTranscription: {},
            outputAudioTranscription: {},
            realtimeInputConfig: {
              automaticActivityDetection: {
                disabled: false,
                prefixPaddingMs: 160,
                silenceDurationMs: 1200
              }
            }
          }
        }
      }
    })

    return {
      token: token.name ?? '',
      model: env.GEMINI_LIVE_MODEL,
      expiresAt: expireTime,
      source,
      toolName: TOOL_NAME,
      products: products.map((product) => ({
        id: product._id.toString(),
        name: product.name,
        sku: product.sku,
        category: product.category,
        price: product.price,
        currency: product.currency
      }))
    }
  },

  extractOrderDraft: async (
    ownerId: string,
    agentId: string,
    payload: {
      source: 'mic' | 'script'
      conversation: Array<{ speaker: 'customer' | 'agent'; text: string }>
      hints?: {
        customerName?: string
        tableNumber?: string
      }
      tableNumber?: string
    }
  ) => {
    if (!geminiClient) {
      throw new ApiError(503, 'Gemini extraction is not configured on the server', 'GEMINI_LIVE_UNAVAILABLE')
    }

    const { agent, products } = await getAgentCatalog(ownerId, agentId)
    const normalizedConversation = mergeSpeakerTurns(
      payload.conversation
        .filter((entry) => entry.text.trim().length > 0)
        .slice(-120)
    )

    const conversation = normalizedConversation
      .slice(-80)
      .filter((entry) => entry.text.trim().length > 0)
      .map((entry) => `${entry.speaker === 'customer' ? 'Customer' : 'Agent'}: ${entry.text.trim()}`)
      .join('\n')

    const catalog = products
      .map((product) => `- ${product.name} | SKU ${product.sku} | ${product.price} ${product.currency}`)
      .join('\n')
    const normalizedSemanticConversation = await normalizeConversationForExtraction(conversation, catalog)

    try {
      const response = await geminiClient.models.generateContent({
        model: env.GEMINI_ORDER_EXTRACTION_MODEL,
        contents: [
          'You extract confirmed order data from an order-taking conversation.',
          'The transcript may contain partial word fragments from realtime speech recognition. Reconstruct obvious broken words and sentence fragments before extracting the order details.',
          'The customer may speak in English, Hindi, Urdu, or Roman Urdu. Use the actual meaning of the conversation, not only exact English wording.',
          'If the customer confirms, adds items, gives their name, or asks for placement in Hindi, Urdu, or Roman Urdu, treat that as valid order intent.',
          'Handle noisy product mentions carefully. If the customer first says a noisy product and then accepts a corrected catalog item, use the corrected catalog item.',
          'Handle noisy quantity mentions carefully. If the quantity is later clarified or corrected, use the latest clarified quantity.',
          'Only use products from the allowed catalog.',
          'Keep reason as one short plain-English sentence. Do not add escaped quotes or line breaks inside reason.',
          'Only mark readyToPlace=true if the customer name and items are clear and the conversation has one concise closing step.',
          'A valid concise closing step can be either: (a) the agent repeats the customer name and order summary and the customer explicitly confirms placement after that recap, or (b) the agent repeats the customer name and order summary together with an "anything else" question, and the customer replies with no / nothing else / that is all after that recap.',
          'Treat recap lines in English, Hindi, Urdu, or Roman Urdu as valid if they clearly restate the customer name and items, for example: "Yeh do Zinger burger ho gaye. Kuch aur chahiye?"',
          'If the customer replies to that closing question with something unrelated or unclear, keep readyToPlace=false and explain that the agent should ask one short recovery question like "Anything else, or should I place it now?"',
          'If a corrected product or corrected quantity was accepted, require one fresh recap that includes the corrected final order before readyToPlace can be true.',
          'Do not require both an "anything else" answer and a separate final "shall I place" confirmation in routine orders.',
          'If the agent has not yet asked whether the customer wants anything else, or has not yet given one concise recap with the customer name and order summary, set readyToPlace=false and explain which step is still missing.',
          'If the order is incomplete or ambiguous, set readyToPlace=false and explain what is missing in reason.',
          'If a product is not in the catalog, do not invent a replacement.',
          `Agent name: ${agent.name}`,
          `Source: ${payload.source}`,
          `Allowed catalog:\n${catalog}`,
          `Raw conversation:\n${conversation || 'No conversation captured yet.'}`,
          `Normalized conversation:\n${normalizedSemanticConversation || 'No normalized conversation available.'}`
        ].join('\n\n'),
        config: {
          responseMimeType: 'application/json',
          responseJsonSchema: orderDraftJsonSchema,
          thinkingConfig: {
            thinkingBudget: 0
          },
          temperature: 0.1,
          maxOutputTokens: 600
        }
      })

      const text = responseTextFromCandidates(response)
      if (!text) {
        logger.warn(
          {
            agentId,
            source: payload.source
          },
          'Gemini order extraction returned an empty primary response'
        )
        return {
          analysisSource: 'ai' as const,
          readyToPlace: false,
          hasCustomerName: false,
          hasItems: false,
          hasConfirmation: false,
          reason: 'No structured order data is available from the conversation yet.',
          customerName: '',
          customerPhone: '',
          customerEmail: '',
          notes: '',
          items: []
        }
      }

      const parsed = await parseGeneratedOrderDraft(text, {
        stage: 'primary',
        agentId,
        source: payload.source,
        catalog,
        conversation,
        normalizedConversation: normalizedSemanticConversation
      })

      const hasCustomerName = Boolean(parsed.customerName?.trim())
      const hasItems = Array.isArray(parsed.items) && parsed.items.length > 0
      const hasConfirmation = Boolean(parsed.readyToPlace)
      const heuristicDraft = buildHeuristicDraft(normalizedConversation, products, payload.hints)

      if (heuristicDraft.nameCorrectedAfterRecap) {
        logger.warn(
          {
            agentId,
            source: payload.source,
            aiReason: parsed.reason,
            heuristicReason: heuristicDraft.reason,
            customerName: parsed.customerName?.trim() ?? '',
            heuristicCustomerName: heuristicDraft.customerName
          },
          'Gemini order extraction yielded a stale recap; using heuristic correction'
        )
        return heuristicDraft
      }

      if (!hasCustomerName || !hasItems || !hasConfirmation) {
        if (heuristicDraft.readyToPlace || heuristicDraft.hasCustomerName || heuristicDraft.hasItems || heuristicDraft.hasConfirmation) {
          const mergedDraft = mergeAiAndHeuristicDraft(parsed, heuristicDraft)
          logger.warn(
            {
              agentId,
              source: payload.source,
              ai: {
                readyToPlace: parsed.readyToPlace,
                hasCustomerName,
                hasItems,
                hasConfirmation,
                reason: parsed.reason
              },
              heuristic: {
                readyToPlace: heuristicDraft.readyToPlace,
                hasCustomerName: heuristicDraft.hasCustomerName,
                hasItems: heuristicDraft.hasItems,
                hasConfirmation: heuristicDraft.hasConfirmation,
                reason: heuristicDraft.reason
              },
              merged: {
                readyToPlace: mergedDraft.readyToPlace,
                hasCustomerName: mergedDraft.hasCustomerName,
                hasItems: mergedDraft.hasItems,
                hasConfirmation: mergedDraft.hasConfirmation,
                reason: mergedDraft.reason
              },
              primaryResponsePreview: previewText(text)
            },
            'Gemini order extraction was incomplete; merging AI and heuristic result'
          )
          return mergedDraft
        }
      }

      return {
        analysisSource: 'ai' as const,
        readyToPlace: Boolean(parsed.readyToPlace && hasCustomerName && hasItems),
        hasCustomerName,
        hasItems,
        hasConfirmation,
        reason:
          parsed.reason ||
          (!parsed.customerName?.trim()
            ? 'Customer name is still required before the order can be placed.'
            : 'The conversation is not confirmed enough yet.'),
        customerName: parsed.customerName?.trim() ?? '',
        customerPhone: parsed.customerPhone?.trim() ?? '',
        customerEmail: parsed.customerEmail?.trim() ?? '',
        notes: parsed.notes?.trim() ?? '',
        items: Array.isArray(parsed.items) ? parsed.items : []
      }
    } catch (error) {
      logger.warn(
        {
          err: error,
          agentId,
          source: payload.source,
          conversationPreview: previewText(conversation),
          normalizedConversationPreview: previewText(normalizedSemanticConversation)
        },
        'Gemini primary order extraction failed; attempting fallback extraction'
      )
      try {
        const fallbackResponse = await geminiClient.models.generateContent({
          model: env.GEMINI_ORDER_EXTRACTION_MODEL,
          contents: [
            'Return only JSON. Do not use markdown fences.',
            'The transcript may contain partial word fragments from realtime speech recognition. Reconstruct obvious broken words before extracting order details.',
            'The conversation may be in English, Hindi, Urdu, or Roman Urdu. Infer the meaning across those languages when extracting order details.',
            'If a noisy product or quantity was corrected later in the conversation and the customer accepted that correction, use the corrected final value.',
            'Keep reason as one short plain-English sentence. Do not add escaped quotes or line breaks inside reason.',
            'Only set readyToPlace=true if the customer name and items are clear and the conversation has one concise closing step: either an explicit confirmation after the recap, or a "no / nothing else" response to an anything-else question that came together with the recap.',
            'Treat recap lines in English, Hindi, Urdu, or Roman Urdu as valid if they clearly restate the customer name and items, for example: "Yeh do Zinger burger ho gaye. Kuch aur chahiye?"',
            'If the customer replies to that closing question with something unrelated or unclear, keep readyToPlace=false and say the agent should ask one short recovery question like "Anything else, or should I place it now?"',
            'If a corrected product or quantity was accepted, require one fresh recap that includes the corrected final order before readyToPlace can be true.',
            'If the order is not fully confirmed, set readyToPlace to false and items to an empty array.',
            `Allowed catalog:\n${catalog}`,
            `Raw conversation:\n${conversation || 'No conversation captured yet.'}`,
            `Normalized conversation:\n${normalizedSemanticConversation || 'No normalized conversation available.'}`
          ].join('\n\n'),
          config: {
            responseMimeType: 'application/json',
            responseJsonSchema: orderDraftJsonSchema,
            thinkingConfig: {
              thinkingBudget: 0
            },
            temperature: 0,
            maxOutputTokens: 450
          }
        })

        const fallbackText = responseTextFromCandidates(fallbackResponse)
        if (!fallbackText) {
          logger.warn(
            {
              agentId,
              source: payload.source
            },
            'Gemini fallback order extraction returned an empty response'
          )
          return {
            analysisSource: 'ai' as const,
            readyToPlace: false,
            hasCustomerName: false,
            hasItems: false,
            hasConfirmation: false,
            reason: 'Conversation analysis is still in progress.',
            customerName: '',
            customerPhone: '',
            customerEmail: '',
            notes: '',
            items: []
          }
        }

        const parsed = await parseGeneratedOrderDraft(fallbackText, {
          stage: 'fallback',
          agentId,
          source: payload.source,
          catalog,
          conversation,
          normalizedConversation: normalizedSemanticConversation
        })

        const hasCustomerName = Boolean(parsed.customerName?.trim())
        const hasItems = Array.isArray(parsed.items) && parsed.items.length > 0
        const hasConfirmation = Boolean(parsed.readyToPlace)
        const heuristicDraft = buildHeuristicDraft(normalizedConversation, products, payload.hints)

        if (heuristicDraft.nameCorrectedAfterRecap) {
          logger.warn(
            {
              agentId,
              source: payload.source,
              fallbackReason: parsed.reason,
              heuristicReason: heuristicDraft.reason,
              fallbackResponsePreview: previewText(fallbackText)
            },
            'Gemini fallback extraction yielded a stale recap; using heuristic correction'
          )
          return heuristicDraft
        }

        if (!hasCustomerName || !hasItems || !hasConfirmation) {
          if (heuristicDraft.readyToPlace || heuristicDraft.hasCustomerName || heuristicDraft.hasItems || heuristicDraft.hasConfirmation) {
            const mergedDraft = mergeAiAndHeuristicDraft(parsed, heuristicDraft)
            logger.warn(
              {
                agentId,
                source: payload.source,
                fallback: {
                  readyToPlace: parsed.readyToPlace,
                  hasCustomerName,
                  hasItems,
                  hasConfirmation,
                  reason: parsed.reason
                },
                heuristic: {
                  readyToPlace: heuristicDraft.readyToPlace,
                  hasCustomerName: heuristicDraft.hasCustomerName,
                  hasItems: heuristicDraft.hasItems,
                  hasConfirmation: heuristicDraft.hasConfirmation,
                  reason: heuristicDraft.reason
                },
                merged: {
                  readyToPlace: mergedDraft.readyToPlace,
                  hasCustomerName: mergedDraft.hasCustomerName,
                  hasItems: mergedDraft.hasItems,
                  hasConfirmation: mergedDraft.hasConfirmation,
                  reason: mergedDraft.reason
                },
                fallbackResponsePreview: previewText(fallbackText)
              },
              'Gemini fallback order extraction was incomplete; merging AI and heuristic result'
            )
            return mergedDraft
          }
        }

        return {
          analysisSource: 'ai' as const,
          readyToPlace: Boolean(parsed.readyToPlace && hasCustomerName && hasItems),
          hasCustomerName,
          hasItems,
          hasConfirmation,
          reason:
            parsed.reason ||
            (!parsed.customerName?.trim()
              ? 'Customer name is still required before the order can be placed.'
              : 'The conversation is not confirmed enough yet.'),
          customerName: parsed.customerName?.trim() ?? '',
          customerPhone: parsed.customerPhone?.trim() ?? '',
          customerEmail: parsed.customerEmail?.trim() ?? '',
          notes: parsed.notes?.trim() ?? '',
          items: Array.isArray(parsed.items) ? parsed.items : []
        }
      } catch (fallbackError) {
        logger.error(
          {
            err: fallbackError,
            agentId,
            source: payload.source,
            conversationPreview: previewText(conversation),
            normalizedConversationPreview: previewText(normalizedSemanticConversation)
          },
          'Gemini fallback order extraction failed; using heuristic result'
        )
        const heuristicDraft = buildHeuristicDraft(normalizedConversation, products, payload.hints)
        if (heuristicDraft.readyToPlace || heuristicDraft.hasCustomerName || heuristicDraft.hasItems || heuristicDraft.hasConfirmation) {
          logger.warn(
            {
              agentId,
              source: payload.source,
              heuristic: {
                readyToPlace: heuristicDraft.readyToPlace,
                hasCustomerName: heuristicDraft.hasCustomerName,
                hasItems: heuristicDraft.hasItems,
                hasConfirmation: heuristicDraft.hasConfirmation,
                reason: heuristicDraft.reason
              }
            },
            'Using heuristic order extraction after Gemini failure'
          )
          return heuristicDraft
        }

        return {
          analysisSource: 'heuristic' as const,
          readyToPlace: false,
          hasCustomerName: false,
          hasItems: false,
          hasConfirmation: false,
          reason: 'Conversation analysis is still collecting enough confirmed order detail.',
          customerName: '',
          customerPhone: '',
          customerEmail: '',
          notes: '',
          items: []
        }
      }
    }
  }
}
