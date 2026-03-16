import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import type { FunctionCall } from '@google/genai'
import { Badge } from '../../components/common/Badge'
import { Button } from '../../components/common/Button'
import { MicIcon, PlayIcon, StopIcon } from '../../components/common/Icons'
import { useApp } from '../../context/AppContext'
import { api } from '../../services/api'
import { LiveAgentSessionClient } from '../../services/liveAgentSession'
import type { AgentLiveSession, LiveConversationEntry } from '../../types'
import { formatCurrency } from '../../utils/format'

interface DraftOrderItem {
  productId: string
  quantity: number
}

type GuidanceKind = 'items' | 'name' | 'confirmation'
type GuidanceMode = 'ask' | 'absorb'

const urduToRomanMap: Record<string, string> = {
  ا: 'a',
  آ: 'aa',
  ب: 'b',
  پ: 'p',
  ت: 't',
  ٹ: 't',
  ث: 's',
  ج: 'j',
  چ: 'ch',
  ح: 'h',
  خ: 'kh',
  د: 'd',
  ڈ: 'd',
  ذ: 'z',
  ر: 'r',
  ڑ: 'r',
  ز: 'z',
  ژ: 'zh',
  س: 's',
  ش: 'sh',
  ص: 's',
  ض: 'z',
  ط: 't',
  ظ: 'z',
  ع: 'a',
  غ: 'gh',
  ف: 'f',
  ق: 'q',
  ک: 'k',
  گ: 'g',
  ل: 'l',
  م: 'm',
  ن: 'n',
  ں: 'n',
  و: 'o',
  ہ: 'h',
  ھ: 'h',
  ء: '',
  ی: 'y',
  ے: 'e',
  ئ: 'i',
  ؤ: 'u',
  'َ': 'a',
  'ِ': 'i',
  'ُ': 'u',
  'ً': 'an',
  'ٍ': 'in',
  'ٌ': 'un',
  'ْ': '',
  'ّ': '',
  'ٰ': 'a',
  'ـ': ''
}

const hindiToRomanMap: Record<string, string> = {
  अ: 'a',
  आ: 'aa',
  इ: 'i',
  ई: 'ee',
  उ: 'u',
  ऊ: 'oo',
  ए: 'e',
  ऐ: 'ai',
  ओ: 'o',
  औ: 'au',
  क: 'k',
  ख: 'kh',
  ग: 'g',
  घ: 'gh',
  ङ: 'n',
  च: 'ch',
  छ: 'chh',
  ज: 'j',
  झ: 'jh',
  ञ: 'n',
  ट: 't',
  ठ: 'th',
  ड: 'd',
  ढ: 'dh',
  ण: 'n',
  त: 't',
  थ: 'th',
  द: 'd',
  ध: 'dh',
  न: 'n',
  प: 'p',
  फ: 'ph',
  ब: 'b',
  भ: 'bh',
  म: 'm',
  य: 'y',
  र: 'r',
  ल: 'l',
  व: 'v',
  श: 'sh',
  ष: 'sh',
  स: 's',
  ह: 'h',
  क़: 'q',
  ख़: 'kh',
  ग़: 'gh',
  ज़: 'z',
  ड़: 'r',
  ढ़: 'rh',
  ऱ: 'r',
  'ा': 'a',
  'ि': 'i',
  'ी': 'ee',
  'ु': 'u',
  'ू': 'oo',
  'े': 'e',
  'ै': 'ai',
  'ो': 'o',
  'ौ': 'au',
  '्': '',
  'ं': 'n',
  'ँ': 'n',
  'ः': 'h'
}

const transliterateWithMap = (value: string, map: Record<string, string>) =>
  Array.from(value)
    .map((char) => (char in map ? map[char] : char))
    .join('')

const toRomanUrduTranscript = (value: string) => {
  let normalized = value
  if (/[\u0600-\u06FF]/u.test(normalized)) {
    normalized = transliterateWithMap(normalized, urduToRomanMap)
  }

  if (/[\u0900-\u097F]/u.test(normalized)) {
    normalized = transliterateWithMap(normalized, hindiToRomanMap)
  }

  return normalized
    .replace(/\s+([,.!?])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

export const AgentLivePage = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const {
    state: { agents, products },
    toggleAgent,
    createOrderFromAgent,
    registerExternalOrder,
    pushToast
  } = useApp()

  const agent = agents.find((entry) => entry.id === id)
  const availableProducts = useMemo(() => {
    if (!agent) return []
    return agent.productAccess === 'all'
      ? products
      : products.filter((product) => agent.productIds.includes(product.id))
  }, [agent, products])
  const liveTableNumber = useMemo(() => {
    if (typeof window === 'undefined') {
      return ''
    }

    return new URLSearchParams(window.location.search).get('table')?.trim() ?? ''
  }, [])

  const [source, setSource] = useState<'mic' | 'script'>(agent?.mode === 'script' ? 'script' : 'mic')
  const [liveSession, setLiveSession] = useState<AgentLiveSession | null>(null)
  const [connectionState, setConnectionState] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle')
  const [isListening, setIsListening] = useState(false)
  const [transcripts, setTranscripts] = useState<string[]>([])
  const [modelMessages, setModelMessages] = useState<string[]>([])
  const [guidanceMessages, setGuidanceMessages] = useState<string[]>([])
  const [toolEvents, setToolEvents] = useState<string[]>([])
  const [diagnostics, setDiagnostics] = useState<string[]>([])
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')
  const [notes, setNotes] = useState('')
  const [selectedProductId, setSelectedProductId] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [items, setItems] = useState<DraftOrderItem[]>([])
  const [placing, setPlacing] = useState(false)
  const [formError, setFormError] = useState('')
  const [lastOrderId, setLastOrderId] = useState('')
  const [lastOrderName, setLastOrderName] = useState('')
  const [orderReadiness, setOrderReadiness] = useState({
    hasCustomerName: false,
    hasItems: false,
    hasConfirmation: false,
    reason: 'The agent is still gathering enough information to place the order.'
  })

  const liveClientRef = useRef<LiveAgentSessionClient | null>(null)
  const liveSessionRef = useRef<AgentLiveSession | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const processorNodeRef = useRef<ScriptProcessorNode | null>(null)
  const speakerContextRef = useRef<AudioContext | null>(null)
  const playbackCursorRef = useRef(0)
  const latestTranscriptRef = useRef('')
  const latestTranscriptAtRef = useRef(0)
  const latestModelMessageAtRef = useRef(0)
  const conversationRef = useRef<LiveConversationEntry[]>([])
  const analysisTimeoutRef = useRef<number | null>(null)
  const analysisInFlightRef = useRef(false)
  const conversationOrderCreatedRef = useRef(false)
  const promptedForNameRef = useRef(false)
  const sessionResettingRef = useRef(false)
  const lastGuidanceKeyRef = useRef<string | null>(null)
  const lastGuidanceSentAtRef = useRef(0)
  const pendingGuidanceRef = useRef<{ key: string; kind: GuidanceKind; message: string } | null>(null)
  const pendingGuidanceTimeoutRef = useRef<number | null>(null)
  const orderFinalizedRef = useRef(false)
  const listeningRecoveryRef = useRef(false)
  const lastLiveActivityAtRef = useRef(Date.now())
  const waitingForCustomerResponseRef = useRef(false)
  const customerSilenceFollowUpCountRef = useRef(0)
  const customerSilenceCheckStartedAtRef = useRef(0)
  const micStartedAtRef = useRef(0)
  const lastMicFrameAtRef = useRef(0)
  const loggedMicFrameRef = useRef(false)
  const pendingLiveClientRef = useRef<LiveAgentSessionClient | null>(null)
  const sessionLeaseTimerRef = useRef<number | null>(null)
  const sessionLeaseRefreshInFlightRef = useRef(false)

  const productById = useMemo(() => Object.fromEntries(availableProducts.map((product) => [product.id, product])), [availableProducts])

  const effectiveSelectedProductId = availableProducts.some((item) => item.id === selectedProductId)
    ? selectedProductId
    : (availableProducts[0]?.id ?? '')

  const total = items.reduce((sum, entry) => {
    const product = productById[entry.productId]
    if (!product) return sum
    return sum + product.price * entry.quantity
  }, 0)

  const addItem = (productId: string, qty: number) => {
    if (!productId || qty <= 0) return
    setItems((prev) => {
      const existing = prev.find((entry) => entry.productId === productId)
      if (existing) {
        return prev.map((entry) => (entry.productId === productId ? { ...entry, quantity: entry.quantity + qty } : entry))
      }
      return [...prev, { productId, quantity: qty }]
    })
  }

  const stopAudioCapture = () => {
    processorNodeRef.current?.disconnect()
    sourceNodeRef.current?.disconnect()
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop())
    void audioContextRef.current?.close()

    processorNodeRef.current = null
    sourceNodeRef.current = null
    mediaStreamRef.current = null
    audioContextRef.current = null
    setIsListening(false)
  }

  const decodePcm16 = (base64Audio: string) => {
    const binary = atob(base64Audio)
    const bytes = new Uint8Array(binary.length)

    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index)
    }

    const view = new DataView(bytes.buffer)
    const samples = new Float32Array(bytes.byteLength / 2)

    for (let index = 0; index < samples.length; index += 1) {
      samples[index] = view.getInt16(index * 2, true) / 0x8000
    }

    return samples
  }

  const closeSpeakerContext = async () => {
    const speakerContext = speakerContextRef.current
    speakerContextRef.current = null
    playbackCursorRef.current = 0

    if (!speakerContext || speakerContext.state === 'closed') {
      return
    }

    try {
      await speakerContext.close()
    } catch {
      // Best-effort cleanup only.
    }
  }

  const ensureSpeakerContext = async () => {
    let speakerContext = speakerContextRef.current

    if (!speakerContext || speakerContext.state === 'closed') {
      speakerContext = new AudioContext({ sampleRate: 24000 })
      speakerContextRef.current = speakerContext
      playbackCursorRef.current = speakerContext.currentTime
    }

    if ((speakerContext.state as string) === 'suspended' || (speakerContext.state as string) === 'interrupted') {
      try {
        await speakerContext.resume()
      } catch {
        await closeSpeakerContext()
        speakerContext = new AudioContext({ sampleRate: 24000 })
        speakerContextRef.current = speakerContext
        playbackCursorRef.current = speakerContext.currentTime
      }
    }

    return speakerContext
  }

  const queueSpeakerAudio = async (base64Audio: string) => {
    lastLiveActivityAtRef.current = Date.now()
    const playChunk = async () => {
      const speakerContext = await ensureSpeakerContext()
      const samples = decodePcm16(base64Audio)
      const audioBuffer = speakerContext.createBuffer(1, samples.length, 24000)
      audioBuffer.copyToChannel(samples, 0)

      const sourceNode = speakerContext.createBufferSource()
      sourceNode.buffer = audioBuffer
      sourceNode.connect(speakerContext.destination)

      const startAt = Math.max(playbackCursorRef.current, speakerContext.currentTime)
      sourceNode.start(startAt)
      playbackCursorRef.current = startAt + audioBuffer.duration
    }

    try {
      await playChunk()
    } catch {
      setDiagnostics((prev) => [`${new Date().toLocaleTimeString()}: Speaker playback stalled. Rebuilding audio output now.`, ...prev].slice(0, 14))
      await closeSpeakerContext()

      try {
        await playChunk()
        setDiagnostics((prev) => [`${new Date().toLocaleTimeString()}: Speaker audio output recovered successfully.`, ...prev].slice(0, 14))
      } catch {
        setDiagnostics((prev) => [`${new Date().toLocaleTimeString()}: Speaker audio output could not be recovered for the current response.`, ...prev].slice(0, 14))
      }
    }
  }

  const resetConversationState = (reason: string) => {
    lastLiveActivityAtRef.current = Date.now()
    micStartedAtRef.current = 0
    lastMicFrameAtRef.current = 0
    loggedMicFrameRef.current = false
    latestTranscriptRef.current = ''
    latestTranscriptAtRef.current = 0
    latestModelMessageAtRef.current = 0
    conversationRef.current = []
    conversationOrderCreatedRef.current = false
    orderFinalizedRef.current = false
    analysisInFlightRef.current = false
    promptedForNameRef.current = false
    lastGuidanceKeyRef.current = null
    lastGuidanceSentAtRef.current = 0
    pendingGuidanceRef.current = null
    waitingForCustomerResponseRef.current = false
    customerSilenceFollowUpCountRef.current = 0
    customerSilenceCheckStartedAtRef.current = 0
    if (pendingGuidanceTimeoutRef.current) {
      window.clearTimeout(pendingGuidanceTimeoutRef.current)
      pendingGuidanceTimeoutRef.current = null
    }
    setTranscripts([])
    setModelMessages([])
    setGuidanceMessages([])
    setOrderReadiness({
      hasCustomerName: false,
      hasItems: false,
      hasConfirmation: false,
      reason
    })
  }

  const disconnectLiveSession = async () => {
    sessionResettingRef.current = true
    listeningRecoveryRef.current = false
    clearSessionLeaseTimer()
    stopAudioCapture()
    playbackCursorRef.current = 0
    if (analysisTimeoutRef.current) {
      window.clearTimeout(analysisTimeoutRef.current)
      analysisTimeoutRef.current = null
    }
    void closeSpeakerContext()
    pendingLiveClientRef.current?.disconnect()
    pendingLiveClientRef.current = null
    liveClientRef.current?.disconnect()
    liveClientRef.current = null
    liveSessionRef.current = null
    setLiveSession(null)
    setConnectionState('idle')
    await new Promise((resolve) => window.setTimeout(resolve, 250))
    sessionResettingRef.current = false
  }

  const restartListeningSession = async (reason: string) => {
    if (listeningRecoveryRef.current || sessionResettingRef.current) return
    listeningRecoveryRef.current = true

    setDiagnostics((prev) => [`${new Date().toLocaleTimeString()}: ${reason}`, ...prev].slice(0, 14))

    try {
      await disconnectLiveSession()
      const sessionInfo = await ensureLiveSession()
      if (!sessionInfo) return
      await startAudioCapture()
      setDiagnostics((prev) => [`${new Date().toLocaleTimeString()}: Live listening recovered successfully.`, ...prev].slice(0, 14))
    } catch (error) {
      setConnectionState('error')
      pushToast({
        type: 'error',
        title: 'Live listening stopped',
        message: error instanceof Error ? error.message : 'The agent stopped listening and could not recover automatically.'
      })
    } finally {
      listeningRecoveryRef.current = false
    }
  }

  const restartMicrophoneCapture = async (reason: string) => {
    if (listeningRecoveryRef.current || sessionResettingRef.current) return
    listeningRecoveryRef.current = true

    setDiagnostics((prev) => [`${new Date().toLocaleTimeString()}: ${reason}`, ...prev].slice(0, 14))

    try {
      stopAudioCapture()
      await new Promise((resolve) => window.setTimeout(resolve, 300))
      await startAudioCapture()
      setDiagnostics((prev) => [`${new Date().toLocaleTimeString()}: Microphone capture recovered successfully.`, ...prev].slice(0, 14))
    } catch (error) {
      setConnectionState('error')
      pushToast({
        type: 'error',
        title: 'Microphone stalled',
        message: error instanceof Error ? error.message : 'Microphone capture could not be recovered automatically.'
      })
    } finally {
      listeningRecoveryRef.current = false
    }
  }

  const promptForMissingDetail = (
    key: string,
    kind: GuidanceKind,
    message: string,
    toolEvent: string,
    mode: GuidanceMode = 'ask'
  ) => {
    const now = Date.now()
    const recentlySentSameGuidance =
      lastGuidanceKeyRef.current === key && now - lastGuidanceSentAtRef.current < 5000

    if (recentlySentSameGuidance || pendingGuidanceRef.current?.key === key) return

    if (pendingGuidanceTimeoutRef.current) {
      window.clearTimeout(pendingGuidanceTimeoutRef.current)
      pendingGuidanceTimeoutRef.current = null
    }

    pendingGuidanceRef.current = { key, kind, message }
    pendingGuidanceTimeoutRef.current = window.setTimeout(() => {
      const pending = pendingGuidanceRef.current
      pendingGuidanceRef.current = null
      pendingGuidanceTimeoutRef.current = null

      if (!pending || pending.key !== key) return
      if (lastGuidanceKeyRef.current === key && Date.now() - lastGuidanceSentAtRef.current < 5000) return
      if (mode === 'ask' && hasRecentAgentPrompt(kind)) {
        setDiagnostics((prev) => [
          `${new Date().toLocaleTimeString()}: System guidance was skipped because the live agent already asked the same question.`,
          ...prev
        ].slice(0, 14))
        return
      }

      lastGuidanceKeyRef.current = key
      lastGuidanceSentAtRef.current = Date.now()
      setGuidanceMessages((prev) => [message, ...prev].slice(0, 8))
      setToolEvents((prev) => [toolEvent, ...prev].slice(0, 8))
      const languageHint = inferConversationLanguageHint()
      liveClientRef.current?.sendGuidanceInstruction(message, languageHint, mode)
      setDiagnostics((prev) => [
        `${new Date().toLocaleTimeString()}: System guidance sent to the live agent${languageHint ? ` in ${languageHint}` : ''}${mode === 'absorb' ? ' (absorb mode).' : '.'}`,
        ...prev
      ].slice(0, 14))
    }, 700)
  }

  const mergeModelUtterance = (previous: string | undefined, incoming: string) => {
    const next = incoming.trim()
    if (!next) return previous ?? ''
    if (!previous) return next

    const current = previous.trim()
    if (!current) return next
    if (current === next) return current
    if (next.startsWith(current)) return next
    if (current.startsWith(next)) return current
    if (current.toLowerCase().endsWith(next.toLowerCase())) return current

    const separator = /[^\s]$/.test(current) && /^[^\s.,!?]/.test(next) ? ' ' : ''
    return `${current}${separator}${next}`.trim()
  }

  const compactConversation = (entries: LiveConversationEntry[], limit = 24) => {
    const merged: LiveConversationEntry[] = []

    for (const entry of entries) {
      const text = entry.text.trim()
      if (!text) continue

      const last = merged[merged.length - 1]
      if (!last || last.speaker !== entry.speaker) {
        merged.push({ speaker: entry.speaker, text })
        continue
      }

      const directJoin =
        /^[.,!?)]$/.test(text) ||
        ((/^[\p{L}\p{M}]{1,2}$/u.test(text) || /^[a-z]{1,2}$/i.test(text)) && /[\p{L}\p{M}]$/u.test(last.text) && !/\s$/.test(last.text))

      const joined = `${last.text}${directJoin ? '' : ' '}${text}`
        .replace(/\s+([,.!?])/g, '$1')
        .replace(/\s{2,}/g, ' ')
        .trim()

      last.text = joined
    }

    return merged.slice(-limit)
  }

  const compactConversationForLease = (entries: LiveConversationEntry[]) => {
    return compactConversation(entries, 24)
  }

  const clearSessionLeaseTimer = () => {
    if (sessionLeaseTimerRef.current) {
      window.clearTimeout(sessionLeaseTimerRef.current)
      sessionLeaseTimerRef.current = null
    }
  }

  const speakPostOrderConfirmation = async (message: string) => {
    if (!('speechSynthesis' in window)) {
      await new Promise((resolve) => globalThis.setTimeout(resolve, 1400))
      return
    }

    await new Promise<void>((resolve) => {
      let completed = false
      const finish = () => {
        if (completed) return
        completed = true
        resolve()
      }

      window.speechSynthesis.cancel()
      const utterance = new SpeechSynthesisUtterance(message)
      utterance.rate = 1
      utterance.pitch = 1
      utterance.volume = 1
      utterance.onend = finish
      utterance.onerror = finish
      window.speechSynthesis.speak(utterance)
      globalThis.setTimeout(finish, 2600)
    })
  }

  const normalizePromptText = (value: string) =>
    value
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim()

  const matchesPromptKind = (kind: GuidanceKind, value: string) => {
    const normalized = normalizePromptText(value)
    if (!normalized) return false

    if (kind === 'items') {
      return /(what would you like to order|what can i get|which item would you like|what would you like today|what can i get for you|what would you like|kya order|kuch order|aap kya lena chahenge|kya chahiye|क्या चाहिए|क्या ऑर्डर|کیا آرڈر|کیا چاہیے)/i.test(
        normalized
      )
    }

    if (kind === 'name') {
      return /(may i have your name|what is your name|your name please|could i have your name|can i have your name|what name should i put on the order|name for the order|before i place that.*name|aapka naam|aap ka naam|naam batayen|नाम क्या है|آپ کا نام|نام بتائیں)/i.test(
        normalized
      )
    }

    return /(shall i place the order|would you like me to place|please confirm|should i place|confirm if you would like me to place|should i place it now|would you like me to place it now|anything else,? or should i place it now|anything else|kuch aur|aur kuch|place it now|kya main order place|kya mein order place|क्या मैं ऑर्डर|کیا میں آرڈر)/i.test(
      normalized
    )
  }

  const findCustomerReplyAfterLatestAgentPrompt = (kind: GuidanceKind) => {
    const recentConversation = conversationRef.current.slice(-24)
    let latestPromptIndex = -1

    for (let index = recentConversation.length - 1; index >= 0; index -= 1) {
      const entry = recentConversation[index]
      if (entry?.speaker === 'agent' && matchesPromptKind(kind, entry.text)) {
        latestPromptIndex = index
        break
      }
    }

    if (latestPromptIndex < 0) {
      return ''
    }

    for (let index = recentConversation.length - 1; index > latestPromptIndex; index -= 1) {
      const entry = recentConversation[index]
      if (entry?.speaker !== 'customer') continue

      const reply = entry.text.trim()
      if (!reply) continue
      if (matchesPromptKind(kind, reply)) continue

      return reply
    }

    return ''
  }

  const buildAbsorbGuidance = (kind: GuidanceKind, customerReply: string) => {
    const compactReply = customerReply.replace(/\s+/g, ' ').trim().slice(0, 180)

    if (kind === 'items') {
      return `The customer already answered the product question: "${compactReply}". Do not ask the same question again. Absorb this detail, confirm the interpreted item(s) briefly only if needed, and continue.`
    }

    if (kind === 'name') {
      return `The customer already answered with their name: "${compactReply}". Do not ask for the name again. Absorb the name, acknowledge briefly, and continue with the next step.`
    }

    return `The customer already responded after your closing question: "${compactReply}". Do not repeat the same confirmation question. Absorb the response and move to the next relevant step.`
  }

  const hasRecentAgentPrompt = (kind: GuidanceKind) => {
    const recentAgentText = conversationRef.current
      .filter((entry) => entry.speaker === 'agent')
      .slice(-12)
      .map((entry) => entry.text.toLowerCase())
      .join(' ')

    if (!recentAgentText) return false

    return matchesPromptKind(kind, recentAgentText)
  }

  const inferCustomerNameHint = () => {
    const mergedAgentTurns = compactConversationForLease(conversationRef.current).filter((entry) => entry.speaker === 'agent')

    for (let index = mergedAgentTurns.length - 1; index >= 0; index -= 1) {
      const text = mergedAgentTurns[index]?.text.trim() ?? ''
      if (!text) continue

      const acknowledgementMatch =
        text.match(
          /(?:okay|ok|alright|understood|got it|theek hai|ठीक है|ओके|ٹھیک ہے)\s+([\p{L}][\p{L}\p{M}' .-]{0,60}?)(?=\s*,?\s*(?:that|this|it|anything|would|यह|yeh)\b)/iu
        ) ??
        text.match(/\b(?:thank you|thanks|shukriya|shukran)\s*,?\s*([\p{L}][\p{L}\p{M}' .-]{0,60})/iu) ??
        text.match(/(?:शुक्रिया|धन्यवाद|شکریہ)\s*,?\s*([\p{L}][\p{L}\p{M}' .-]{0,60})/u)

      const candidate = acknowledgementMatch?.[1]?.split(/[.?!,]/, 1)[0]?.trim() ?? ''
      if (candidate && candidate.length >= 2) {
        return candidate
      }
    }

    return ''
  }

  const inferConversationLanguageHint = () => {
    const recentCustomerText = conversationRef.current
      .filter((entry) => entry.speaker === 'customer')
      .slice(-12)
      .map((entry) => entry.text)
      .join(' ')

    if (!recentCustomerText.trim()) {
      return ''
    }

    if (/[\u0900-\u097F]/u.test(recentCustomerText) || /[\u0600-\u06FF]/u.test(recentCustomerText)) {
      return 'Urdu'
    }

    const normalized = recentCustomerText.toLowerCase()
    if (/\b(aap|naam|kya|mujhe|mera|hain|hai|chahiye|kar do|kar dein|theek|jee|ji|haan|nahin|nahi)\b/i.test(normalized)) {
      return 'Urdu'
    }

    return 'English'
  }

  const isAgentCheckpointTurn = (text: string) => {
    const normalized = text.toLowerCase()
    return /(anything else|shall i place|should i place|would you like me to place|before i place|that is|this is|just to confirm|one more time|checking the order details|placing that now|i am placing|order details now)/i.test(
      normalized
    )
  }

  const isCustomerCheckpointTurn = (text: string) => {
    const normalized = text.toLowerCase()
    return /\b(no|none|nothing else|that's all|thats all|that is all|all good|just this|only this|yes|yes please|yeah|okay|ok|place it|go ahead|please place|place my order|place the order|is my order place|is my order placed|is the order place|is the order placed|my order place|my order placed)\b/i.test(
      normalized
    )
  }

  const shouldWaitForCustomerReply = (text: string) => {
    const normalized = text.toLowerCase()
    if (!normalized.trim()) return false

    return (
      /\?/.test(text) ||
      /(what would you like|what can i get|may i have your name|what is your name|anything else|should i place|shall i place|would you like me to place|are you there|can you hear me|kuch aur|aapka naam|naam batayen|کچھ اور|آپ کا نام)/i.test(
        normalized
      )
    )
  }

  const scheduleConversationAnalysis = (delayMs = 1000) => {
    if (!agent || conversationOrderCreatedRef.current || orderFinalizedRef.current) return

    if (analysisTimeoutRef.current) {
      window.clearTimeout(analysisTimeoutRef.current)
    }

    analysisTimeoutRef.current = window.setTimeout(async () => {
      if (!agent || analysisInFlightRef.current || conversationOrderCreatedRef.current || conversationRef.current.length < 2) {
        return
      }

      analysisInFlightRef.current = true

      try {
        const result = await api.agents.createConversationOrder(agent.id, {
          source,
          tableNumber: liveTableNumber || undefined,
          conversation: compactConversation(conversationRef.current, 80),
          hints: {
            customerName: inferCustomerNameHint() || undefined,
            tableNumber: liveTableNumber || undefined
          }
        })

        setOrderReadiness({
          hasCustomerName: Boolean(result.hasCustomerName),
          hasItems: Boolean(result.hasItems),
          hasConfirmation: Boolean(result.hasConfirmation ?? result.readyToPlace),
          reason: result.reason
        })

        if (!result.readyToPlace) {
          const suggestedAsk = result.ask?.trim()

          if (!result.hasItems) {
            const customerReply = findCustomerReplyAfterLatestAgentPrompt('items')
            if (customerReply) {
              promptForMissingDetail(
                'absorb-items-reply',
                'items',
                buildAbsorbGuidance('items', customerReply),
                'Customer already answered the product question. Guided the live agent to absorb the response and continue.',
                'absorb'
              )
            } else if (!hasRecentAgentPrompt('items')) {
              promptForMissingDetail(
                'missing-items',
                'items',
                suggestedAsk || 'Hello, what would you like to order today?',
                'Order items are still missing. Prompted the customer to name the product.'
              )
            }
          } else if (!result.hasCustomerName) {
            const customerReply = findCustomerReplyAfterLatestAgentPrompt('name')
            if (customerReply) {
              promptedForNameRef.current = true
              promptForMissingDetail(
                'absorb-name-reply',
                'name',
                buildAbsorbGuidance('name', customerReply),
                'Customer already answered the name question. Guided the live agent to absorb the response and continue.',
                'absorb'
              )
            } else if (!promptedForNameRef.current && !hasRecentAgentPrompt('name')) {
              promptedForNameRef.current = true
              promptForMissingDetail(
                'missing-name',
                'name',
                suggestedAsk || 'Before I place that, what name should I put on the order?',
                'Customer name is still missing. Prompted for name before order placement.'
              )
            }
          } else if (!result.hasConfirmation) {
            const customerReply = findCustomerReplyAfterLatestAgentPrompt('confirmation')
            if (customerReply) {
              promptForMissingDetail(
                'absorb-confirmation-reply',
                'confirmation',
                buildAbsorbGuidance('confirmation', customerReply),
                'Customer already replied to the closing question. Guided the live agent to absorb the response and continue.',
                'absorb'
              )
            } else if (!hasRecentAgentPrompt('confirmation')) {
              promptForMissingDetail(
                'missing-confirmation',
                'confirmation',
                suggestedAsk || 'Anything else, or should I place it now?',
                'Customer confirmation is still missing. Prompted with a short recovery question.'
              )
            }
          }
        }

        if (result.readyToPlace && result.order) {
          const createdOrder = result.order
          const displayOrderName = createdOrder.orderName || createdOrder.id
          conversationOrderCreatedRef.current = true
          orderFinalizedRef.current = true
          lastGuidanceKeyRef.current = null
          registerExternalOrder(createdOrder)
          setLastOrderId(createdOrder.id)
          setLastOrderName(displayOrderName)
          setToolEvents((prev) => [`Order ${displayOrderName} created from confirmed live conversation.`, ...prev].slice(0, 8))
          setModelMessages((prev) => [`Order ${displayOrderName} has been placed successfully.`, ...prev].slice(0, 12))
          setGuidanceMessages([])
          void rotateForNextCustomer(createdOrder.id, displayOrderName)
        } else if (result.reason) {
          setToolEvents((prev) => {
            if (prev[0] === result.reason) return prev
            return [result.reason, ...prev].slice(0, 8)
          })
        }
      } catch {
        // Keep the live session running even if background extraction fails.
      } finally {
        analysisInFlightRef.current = false
      }
    }, delayMs)
  }

  const appendConversationEntry = (speaker: LiveConversationEntry['speaker'], text: string) => {
    const normalized = text.trim()
    if (!normalized) return

    if (speaker === 'agent' && pendingGuidanceRef.current) {
      const pendingKind = pendingGuidanceRef.current.kind
      const recentAgentText = normalized.toLowerCase()
      const agentAskedPendingQuestion = matchesPromptKind(pendingKind, recentAgentText)

      if (agentAskedPendingQuestion) {
        if (pendingGuidanceTimeoutRef.current) {
          window.clearTimeout(pendingGuidanceTimeoutRef.current)
          pendingGuidanceTimeoutRef.current = null
        }
        lastGuidanceKeyRef.current = pendingGuidanceRef.current.key
        lastGuidanceSentAtRef.current = Date.now()
        pendingGuidanceRef.current = null
        setDiagnostics((prev) => [
          `${new Date().toLocaleTimeString()}: Pending system guidance was canceled because the live agent already asked the same question.`,
          ...prev
        ].slice(0, 14))
      }
    }

    const previous = conversationRef.current[conversationRef.current.length - 1]
    if (previous && previous.speaker === speaker) {
      previous.text = mergeModelUtterance(previous.text, normalized)
      conversationRef.current = [...conversationRef.current].slice(-120)
    } else {
      conversationRef.current = [...conversationRef.current, { speaker, text: normalized }].slice(-120)
    }

    const effectiveText = conversationRef.current[conversationRef.current.length - 1]?.text ?? normalized

    if (speaker === 'customer') {
      waitingForCustomerResponseRef.current = false
      customerSilenceFollowUpCountRef.current = 0
      customerSilenceCheckStartedAtRef.current = 0
    } else if (shouldWaitForCustomerReply(effectiveText)) {
      if (!waitingForCustomerResponseRef.current) {
        customerSilenceFollowUpCountRef.current = 0
      }
      waitingForCustomerResponseRef.current = true
      customerSilenceCheckStartedAtRef.current = Date.now()
    }

    if (speaker === 'agent' && isAgentCheckpointTurn(effectiveText)) {
      scheduleConversationAnalysis(1200)
      return
    }

    if (speaker === 'customer' && isCustomerCheckpointTurn(effectiveText)) {
      scheduleConversationAnalysis(900)
      return
    }

    scheduleConversationAnalysis(1400)
  }

  const startAudioCapture = async () => {
    stopAudioCapture()

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    })

    const audioContext = new AudioContext()
    if (audioContext.state === 'suspended') {
      await audioContext.resume()
    }
    const sourceNode = audioContext.createMediaStreamSource(stream)
    const processorNode = audioContext.createScriptProcessor(4096, 1, 1)
    const silentGain = audioContext.createGain()
    silentGain.gain.value = 0

    const [primaryTrack] = stream.getAudioTracks()
    if (primaryTrack) {
      primaryTrack.onended = () => {
        setDiagnostics((prev) => [`${new Date().toLocaleTimeString()}: Microphone track ended unexpectedly.`, ...prev].slice(0, 14))
        stopAudioCapture()
      }
    }

    processorNode.onaudioprocess = (event) => {
      if (!liveClientRef.current?.canStreamAudio()) {
        return
      }
      lastMicFrameAtRef.current = Date.now()
      if (!loggedMicFrameRef.current) {
        loggedMicFrameRef.current = true
        setDiagnostics((prev) => [`${new Date().toLocaleTimeString()}: Microphone audio frames are flowing to the live session.`, ...prev].slice(0, 14))
      }
      const channelData = event.inputBuffer.getChannelData(0)
      liveClientRef.current?.sendAudioChunk(new Float32Array(channelData), audioContext.sampleRate)
    }

    sourceNode.connect(processorNode)
    processorNode.connect(silentGain)
    silentGain.connect(audioContext.destination)

    mediaStreamRef.current = stream
    audioContextRef.current = audioContext
    sourceNodeRef.current = sourceNode
    processorNodeRef.current = processorNode
    lastLiveActivityAtRef.current = Date.now()
    micStartedAtRef.current = Date.now()
    lastMicFrameAtRef.current = 0
    loggedMicFrameRef.current = false

    setDiagnostics((prev) => [`Microphone stream started at ${new Date().toLocaleTimeString()}.`, ...prev].slice(0, 12))
    setIsListening(true)
  }

  const buildLiveCallbacks = (client: LiveAgentSessionClient, options?: { pending?: boolean }) => ({
    onOpen: () => {
      lastLiveActivityAtRef.current = Date.now()
      if (!options?.pending) {
        setConnectionState('connected')
      }
    },
    onClose: () => {
      const isCurrentClient = liveClientRef.current === client
      const isPendingClient = pendingLiveClientRef.current === client

      if (isPendingClient) {
        pendingLiveClientRef.current = null
        return
      }

      if (!isCurrentClient) {
        return
      }

      clearSessionLeaseTimer()
      stopAudioCapture()
      playbackCursorRef.current = 0
      if (analysisTimeoutRef.current) {
        window.clearTimeout(analysisTimeoutRef.current)
        analysisTimeoutRef.current = null
      }
      analysisInFlightRef.current = false
      liveSessionRef.current = null
      setLiveSession(null)
      liveClientRef.current = null
      if (sessionResettingRef.current) {
        setConnectionState('idle')
        return
      }
      setConnectionState('error')
    },
    onError: (message: string) => {
      const isCurrentClient = liveClientRef.current === client
      const isPendingClient = pendingLiveClientRef.current === client

      if (isPendingClient) {
        pendingLiveClientRef.current = null
        setDiagnostics((prev) => [`${new Date().toLocaleTimeString()}: Secure session refresh failed: ${message}`, ...prev].slice(0, 14))
        return
      }

      if (!isCurrentClient) {
        return
      }

      clearSessionLeaseTimer()
      stopAudioCapture()
      playbackCursorRef.current = 0
      if (analysisTimeoutRef.current) {
        window.clearTimeout(analysisTimeoutRef.current)
        analysisTimeoutRef.current = null
      }
      analysisInFlightRef.current = false
      liveSessionRef.current = null
      setLiveSession(null)
      liveClientRef.current = null
      if (sessionResettingRef.current) {
        setConnectionState('idle')
        return
      }
      setConnectionState('error')
      pushToast({ type: 'error', title: 'Live session error', message })
    },
    onEvent: (message: string) => {
      setDiagnostics((prev) => [`${new Date().toLocaleTimeString()}: ${message}`, ...prev].slice(0, 14))
    },
    onTranscript: (text: string) => {
      if (pendingLiveClientRef.current === client && liveClientRef.current !== client) {
        return
      }

      const normalized = toRomanUrduTranscript(text.trim())
      const now = Date.now()
      if (!normalized) return
      lastLiveActivityAtRef.current = now
      if (latestTranscriptRef.current === normalized && now - latestTranscriptAtRef.current < 1200) return
      latestTranscriptRef.current = normalized
      latestTranscriptAtRef.current = now
      setTranscripts((prev) => [normalized, ...prev].slice(0, 12))
      appendConversationEntry('customer', normalized)
    },
    onModelText: (text: string) => {
      if (pendingLiveClientRef.current === client && liveClientRef.current !== client) {
        return
      }

      const normalized = toRomanUrduTranscript(text.trim())
      if (!normalized) return
      const now = Date.now()
      lastLiveActivityAtRef.current = now
      setModelMessages((prev) => {
        const shouldMerge = prev.length > 0 && now - latestModelMessageAtRef.current < 1400
        latestModelMessageAtRef.current = now
        if (!shouldMerge) {
          return [normalized, ...prev].slice(0, 12)
        }

        return [mergeModelUtterance(prev[0], normalized), ...prev.slice(1)].slice(0, 12)
      })
      appendConversationEntry('agent', normalized)
    },
    onAudioData: (base64Audio: string) => {
      if (pendingLiveClientRef.current === client && liveClientRef.current !== client) {
        return
      }

      lastLiveActivityAtRef.current = Date.now()
      void queueSpeakerAudio(base64Audio)
    },
    onToolCall: async (functionCall: FunctionCall) => {
      if (pendingLiveClientRef.current === client && liveClientRef.current !== client) {
        return
      }

      await handleToolCall(functionCall)
    }
  })

  const hydrateConversationIntoLiveSession = async (client: LiveAgentSessionClient) => {
    const turns = compactConversationForLease(conversationRef.current)
    if (turns.length === 0) {
      return
    }

    client.prefillConversation(turns)
    setDiagnostics((prev) => [`${new Date().toLocaleTimeString()}: Rehydrated the live session with the current customer conversation.`, ...prev].slice(0, 14))
    await new Promise((resolve) => window.setTimeout(resolve, 180))
  }

  const scheduleSessionLeaseRefresh = (sessionInfo: AgentLiveSession) => {
    clearSessionLeaseTimer()

    const expiresAt = new Date(sessionInfo.expiresAt).getTime()
    if (Number.isNaN(expiresAt)) {
      return
    }

    const refreshLeadMs = 90_000
    const delay = Math.max(5_000, expiresAt - Date.now() - refreshLeadMs)
    sessionLeaseTimerRef.current = window.setTimeout(() => {
      void refreshSessionLease('Secure live session lease is rotating automatically before expiry.')
    }, delay)
  }

  const refreshSessionLease = async (reason: string) => {
    if (!agent || sessionLeaseRefreshInFlightRef.current || sessionResettingRef.current) {
      return
    }

    const currentSession = liveSessionRef.current
    const currentClient = liveClientRef.current
    if (!currentSession || !currentClient) {
      return
    }

    const expiresAt = new Date(currentSession.expiresAt).getTime()
    const remainingMs = Number.isNaN(expiresAt) ? 0 : expiresAt - Date.now()
    const recentActivityMs = Date.now() - lastLiveActivityAtRef.current
    const busy = analysisInFlightRef.current || listeningRecoveryRef.current || recentActivityMs < 2500

    if (busy && remainingMs > 30_000) {
      clearSessionLeaseTimer()
      sessionLeaseTimerRef.current = window.setTimeout(() => {
        void refreshSessionLease('Secure live session lease rotation was briefly delayed while the customer conversation was active.')
      }, 10_000)
      return
    }

    sessionLeaseRefreshInFlightRef.current = true
    setDiagnostics((prev) => [`${new Date().toLocaleTimeString()}: ${reason}`, ...prev].slice(0, 14))
    let replacementClient: LiveAgentSessionClient | null = null

    try {
      const replacementSession = await api.agents.createLiveSession(agent.id, source)
      replacementClient = new LiveAgentSessionClient()
      pendingLiveClientRef.current = replacementClient

      await replacementClient.connect(replacementSession, buildLiveCallbacks(replacementClient, { pending: true }))
      await hydrateConversationIntoLiveSession(replacementClient)

      const shouldResumeMic = isListening
      if (shouldResumeMic) {
        stopAudioCapture()
      }

      liveClientRef.current = replacementClient
      liveSessionRef.current = replacementSession
      setLiveSession(replacementSession)
      setConnectionState('connected')
      scheduleSessionLeaseRefresh(replacementSession)

      pendingLiveClientRef.current = null
      currentClient.disconnect()

      if (shouldResumeMic) {
        await startAudioCapture()
      }

      setDiagnostics((prev) => [`${new Date().toLocaleTimeString()}: Secure live session lease refreshed without resetting the current customer conversation.`, ...prev].slice(0, 14))
    } catch (error) {
      replacementClient?.disconnect()
      pendingLiveClientRef.current = null
      setDiagnostics((prev) => [`${new Date().toLocaleTimeString()}: Live session lease refresh failed. The current session will keep running until its expiry.`, ...prev].slice(0, 14))
      clearSessionLeaseTimer()
      sessionLeaseTimerRef.current = window.setTimeout(() => {
        void refreshSessionLease('Retrying the secure live session lease refresh.')
      }, 15_000)
      if (remainingMs <= 20_000) {
        pushToast({
          type: 'error',
          title: 'Live session refresh failed',
          message: error instanceof Error ? error.message : 'The secure session could not be refreshed before expiry.'
        })
      }
    } finally {
      sessionLeaseRefreshInFlightRef.current = false
    }
  }

  const ensureLiveSession = async () => {
    if (!agent) return null
    if (liveSessionRef.current) return liveSessionRef.current

    setConnectionState('connecting')

    try {
      const sessionInfo = await api.agents.createLiveSession(agent.id, source)
      const client = new LiveAgentSessionClient()
      liveClientRef.current = client

      await client.connect(sessionInfo, buildLiveCallbacks(client))

      liveSessionRef.current = sessionInfo
      setLiveSession(sessionInfo)
      scheduleSessionLeaseRefresh(sessionInfo)
      resetConversationState('The live agent is connected and ready to collect customer details.')
      setDiagnostics((prev) => [`${new Date().toLocaleTimeString()}: Live session token issued.`, ...prev].slice(0, 14))
      return sessionInfo
    } catch (error) {
      setConnectionState('error')
      pushToast({
        type: 'error',
        title: 'Gemini Live unavailable',
        message: error instanceof Error ? error.message : 'Unable to start the secure live session.'
      })
      return null
    }
  }

  const rotateForNextCustomer = async (orderId: string, orderName?: string) => {
    const displayOrderName = orderName || orderId
    const shouldResumeListening = Boolean(liveSessionRef.current || isListening || connectionState === 'connected')

    await disconnectLiveSession()
    resetConversationState('Preparing a fresh session for the next customer.')
    setToolEvents((prev) => [`Order ${displayOrderName} completed. Starting a fresh session for the next customer.`, ...prev].slice(0, 8))
    setDiagnostics((prev) => [`${new Date().toLocaleTimeString()}: Resetting session context after order ${displayOrderName}.`, ...prev].slice(0, 14))
    pushToast({
      type: 'success',
      title: 'Order placed',
      message: `${displayOrderName} is complete. Preparing for the next customer.`
    })

    const postOrderMessage = `Your order ${displayOrderName} has been placed successfully. Please wait while it is being processed.`
    setModelMessages([postOrderMessage])
    setGuidanceMessages([])
    await speakPostOrderConfirmation(postOrderMessage)
    await new Promise((resolve) => window.setTimeout(resolve, 450))

    if (!shouldResumeListening) return

    const sessionInfo = await ensureLiveSession()
    if (!sessionInfo) return

    try {
      await startAudioCapture()
      setDiagnostics((prev) => [`${new Date().toLocaleTimeString()}: Fresh session is now listening for the next customer.`, ...prev].slice(0, 14))
    } catch (error) {
      setConnectionState('error')
      pushToast({
        type: 'error',
        title: 'Microphone unavailable',
        message: error instanceof Error ? error.message : 'Microphone access is required for live listening.'
      })
    }
  }

  const handleToolCall = async (functionCall: FunctionCall) => {
    if (!agent || functionCall.name !== liveSession?.toolName || !functionCall.args) {
      return
    }

    if (orderFinalizedRef.current) {
      liveClientRef.current?.sendToolSuccess(functionCall, 'This order has already been completed. Start with the next customer.')
      return
    }

    setToolEvents((prev) => ['Live tool call received. Waiting for confirmed conversation-order flow to finalize the order.', ...prev].slice(0, 8))
    liveClientRef.current?.sendToolSuccess(
      functionCall,
      'Continue the conversation with the customer. The backend will place the order after the spoken recap and confirmation are complete.'
    )
  }

  const startAgent = async () => {
    if (!agent) return
    if (!agent.isActive) await toggleAgent(agent.id, true)

    const sessionInfo = await ensureLiveSession()
    if (!sessionInfo) return

    if (isListening) return
    if (!liveClientRef.current?.canStreamAudio()) {
      setConnectionState('error')
      pushToast({
        type: 'error',
        title: 'Live session unavailable',
        message: 'Gemini closed the live session before audio streaming could begin.'
      })
      return
    }

    try {
      await startAudioCapture()
      pushToast({
        type: 'success',
        title: 'Listening live',
        message: 'Speak normally, then pause briefly. The agent will respond automatically.'
      })
    } catch (error) {
      setConnectionState('error')
      pushToast({
        type: 'error',
        title: 'Microphone unavailable',
        message: error instanceof Error ? error.message : 'Microphone access is required for live listening.'
      })
    }
  }

  const stopListening = () => {
    if (!isListening) return
    liveClientRef.current?.sendAudioStreamEnd()
    setDiagnostics((prev) => [`${new Date().toLocaleTimeString()}: Audio stream ended by operator.`, ...prev].slice(0, 14))
    stopAudioCapture()
  }

  const endSession = () => {
    clearSessionLeaseTimer()
    stopAudioCapture()
    playbackCursorRef.current = 0
    if (analysisTimeoutRef.current) {
      window.clearTimeout(analysisTimeoutRef.current)
      analysisTimeoutRef.current = null
    }
    analysisInFlightRef.current = false
    void closeSpeakerContext()
    pendingLiveClientRef.current?.disconnect()
    pendingLiveClientRef.current = null
    liveClientRef.current?.disconnect()
    liveClientRef.current = null
    resetConversationState('Start a new session to collect customer details and place the order.')
    liveSessionRef.current = null
    setLiveSession(null)
    setConnectionState('idle')
  }

  const placeOrder = async () => {
    if (!agent) return
    setFormError('')
    if (!customerName.trim()) {
      setFormError('Customer name is required to place order.')
      return
    }
    if (items.length === 0) {
      setFormError('Add at least one product item before placing order.')
      return
    }

    setPlacing(true)
    const created = await createOrderFromAgent({
      agentId: agent.id,
      customerName,
      customerPhone,
      customerEmail,
      tableNumber: liveTableNumber || undefined,
      notes,
      source,
      items
    })
    setPlacing(false)

    if (!created) return
    const displayOrderName = created.orderName || created.id
    orderFinalizedRef.current = true
    setLastOrderId(created.id)
    setLastOrderName(displayOrderName)
    setItems([])
    setNotes('')
    if (liveSession || isListening) {
      void rotateForNextCustomer(created.id, displayOrderName)
    }
  }

  useEffect(() => {
    if (!isListening) return

    const SILENCE_FOLLOW_UP_DELAY_MS = 7000
    const MAX_SILENCE_FOLLOW_UPS = 2

    const interval = window.setInterval(() => {
      const now = Date.now()
      const streamActive = Boolean(mediaStreamRef.current?.active)
      const canStreamAudio = Boolean(liveClientRef.current?.canStreamAudio())
      const inactivityMs = now - lastLiveActivityAtRef.current
      const micWarmupMs = micStartedAtRef.current ? now - micStartedAtRef.current : 0
      const micFrameStalled =
        isListening &&
        micStartedAtRef.current > 0 &&
        ((lastMicFrameAtRef.current === 0 && micWarmupMs > 3500) ||
          (lastMicFrameAtRef.current > 0 && now - lastMicFrameAtRef.current > 4000))

      if (streamActive && canStreamAudio) {
        if (!micFrameStalled) {
          if (
            waitingForCustomerResponseRef.current &&
            customerSilenceCheckStartedAtRef.current > 0 &&
            !orderFinalizedRef.current &&
            !conversationOrderCreatedRef.current
          ) {
            const silenceMs = now - customerSilenceCheckStartedAtRef.current

            if (silenceMs >= SILENCE_FOLLOW_UP_DELAY_MS && customerSilenceFollowUpCountRef.current < MAX_SILENCE_FOLLOW_UPS) {
              customerSilenceFollowUpCountRef.current += 1
              customerSilenceCheckStartedAtRef.current = now

              const languageHint = inferConversationLanguageHint()
              const followUpMessage =
                'Customer has not responded for several seconds. Ask one short follow-up like "Are you still there?" in the customer language.'

              liveClientRef.current?.sendGuidanceInstruction(followUpMessage, languageHint, 'ask')
              setGuidanceMessages((prev) => [followUpMessage, ...prev].slice(0, 8))
              setToolEvents((prev) => [
                `Customer response timeout: sent follow-up prompt ${customerSilenceFollowUpCountRef.current}/${MAX_SILENCE_FOLLOW_UPS}.`,
                ...prev
              ].slice(0, 8))
              setDiagnostics((prev) => [
                `${new Date().toLocaleTimeString()}: No customer response detected. Sent follow-up ${customerSilenceFollowUpCountRef.current}/${MAX_SILENCE_FOLLOW_UPS}.`,
                ...prev
              ].slice(0, 14))
              return
            }

            if (silenceMs >= SILENCE_FOLLOW_UP_DELAY_MS && customerSilenceFollowUpCountRef.current >= MAX_SILENCE_FOLLOW_UPS) {
              waitingForCustomerResponseRef.current = false
              customerSilenceFollowUpCountRef.current = 0
              customerSilenceCheckStartedAtRef.current = 0
              void restartListeningSession('No customer response after two follow-up prompts. Ending this session and starting a fresh one now.')
              return
            }
          }

          return
        }
      }

      if (sessionResettingRef.current || listeningRecoveryRef.current || analysisInFlightRef.current) {
        return
      }

      if (micFrameStalled && canStreamAudio) {
        void restartMicrophoneCapture('Listening appears active, but the microphone is not sending audio frames. Restarting microphone capture now.')
        return
      }

      if (inactivityMs < 6000) {
        return
      }

      if (!streamActive) {
        void restartListeningSession('Listening stopped because the microphone stream became inactive. Reconnecting now.')
        return
      }

      if (!canStreamAudio) {
        void restartListeningSession('Listening stopped because the live session is no longer accepting audio. Reconnecting now.')
      }
    }, 1500)

    return () => {
      window.clearInterval(interval)
    }
    // The watchdog should only run while the current listening state is active.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isListening])

  useEffect(() => {
    return () => {
      clearSessionLeaseTimer()
      if (analysisTimeoutRef.current) {
        window.clearTimeout(analysisTimeoutRef.current)
      }
      processorNodeRef.current?.disconnect()
      sourceNodeRef.current?.disconnect()
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop())
      void audioContextRef.current?.close()
      void closeSpeakerContext()
      pendingLiveClientRef.current?.disconnect()
      liveClientRef.current?.disconnect()
    }
  }, [])

  if (!agent) return <Navigate to="/app/agents" replace />

  if (availableProducts.length === 0) {
    return (
      <div className="stack-lg">
        <h1>Live Agent Console</h1>
        <section className="card stack-sm">
          <h3>No products available for this agent</h3>
          <p>Add products first or update this agent's product access before starting live order capture.</p>
          <div className="row gap-sm">
            <Button onClick={() => navigate('/app/products/new')}>Add Product</Button>
            <Button variant="secondary" onClick={() => navigate(`/app/agents/${agent.id}/edit`)}>
              Update Agent Access
            </Button>
          </div>
        </section>
      </div>
    )
  }

  return (
    <div className="stack-lg">
      <section className="split-row card">
        <div>
          <h1>Live Agent Console</h1>
          <p>{agent.name} can now listen in real time, ask follow-up questions, create orders, and trigger webhooks from the backend.</p>
        </div>
        <div className="row gap-sm wrap">
          <Badge tone={agent.isActive ? 'success' : 'warning'}>{agent.isActive ? 'Agent On' : 'Agent Off'}</Badge>
          <Badge tone={connectionState === 'connected' ? 'success' : connectionState === 'error' ? 'danger' : 'neutral'}>
            {connectionState === 'connected' ? 'Live Connected' : connectionState === 'connecting' ? 'Connecting' : connectionState === 'error' ? 'Error' : 'Not Connected'}
          </Badge>
          <Button variant="secondary" onClick={() => navigate(`/app/agents/${agent.id}`)}>
            Back to Agent
          </Button>
        </div>
      </section>

      <section className="grid two-col">
        <article className="card stack-sm live-console-panel">
          <div className="split-row">
            <h3>Realtime Listener</h3>
            <Badge tone={isListening ? 'success' : 'neutral'}>{isListening ? 'Listening' : 'Idle'}</Badge>
          </div>

          <div className="live-audio-visual">
            <button className={`mic-btn ${isListening ? 'active' : ''}`} aria-label="Mic state">
              <MicIcon />
            </button>
            <div className={`wave-bars ${isListening ? 'active' : ''}`}>
              <span />
              <span />
              <span />
              <span />
              <span />
            </div>
          </div>

          <div className="row gap-sm wrap">
            <Button onClick={startAgent} iconLeft={<PlayIcon />} disabled={connectionState === 'connecting'}>
              {isListening ? 'Listening...' : 'Start Listening'}
            </Button>
            <Button variant="secondary" onClick={stopListening} iconLeft={<StopIcon />} disabled={!isListening}>
              Stop Listening
            </Button>
            <Button variant="ghost" onClick={endSession} disabled={!liveSession}>
              End Session
            </Button>
          </div>

          <label>
            Live source
            <select className="input" value={source} onChange={(event) => setSource(event.target.value as 'mic' | 'script')} disabled={Boolean(liveSession)}>
              <option value="mic">Mic UI</option>
              <option value="script">Embedded Script</option>
            </select>
          </label>

          {liveSession ? (
            <p className="muted">
              Secure live lease active until {new Date(liveSession.expiresAt).toLocaleTimeString()}. It rotates automatically before expiry, so the
              current customer conversation stays active.
            </p>
          ) : (
            <p className="muted">A short-lived, server-issued Gemini Live token will be created when listening starts.</p>
          )}
          <p className="muted">Voice activity detection is enabled, so the agent should respond after you finish speaking.</p>
        </article>

        <article className="card stack-sm">
          <h3>Tool Activity</h3>
          <p className="muted">Orders are only created by the backend after the model calls the secure order tool.</p>
          {toolEvents.length === 0 ? (
            <p className="muted">No tool activity yet.</p>
          ) : (
            <ul className="line-list">
              {toolEvents.map((event, index) => (
                <li key={`${event}-${index}`}>{event}</li>
              ))}
            </ul>
          )}
          {lastOrderId ? (
            <p className="success-text">
              Latest order: <Link to={`/app/orders/${lastOrderId}`}>{lastOrderName || lastOrderId}</Link>
            </p>
          ) : null}
        </article>
      </section>

      <section className="card stack-sm">
        <div className="split-row">
          <div>
            <h3>Order Readiness</h3>
            <p className="muted">This shows what the agent still needs before the backend can create the order and trigger your webhook.</p>
          </div>
          <Badge tone={orderReadiness.hasCustomerName && orderReadiness.hasItems && orderReadiness.hasConfirmation ? 'success' : 'warning'}>
            {orderReadiness.hasCustomerName && orderReadiness.hasItems && orderReadiness.hasConfirmation ? 'Ready to Place' : 'Collecting Details'}
          </Badge>
        </div>
        <div className="live-readiness-list">
          <div className={`live-readiness-item ${orderReadiness.hasCustomerName ? 'is-complete' : ''}`}>
            <strong>Customer name</strong>
            <span>{orderReadiness.hasCustomerName ? 'Captured' : 'Still needed'}</span>
          </div>
          <div className={`live-readiness-item ${orderReadiness.hasItems ? 'is-complete' : ''}`}>
            <strong>Order items</strong>
            <span>{orderReadiness.hasItems ? 'Matched to catalog' : 'Still needed'}</span>
          </div>
          <div className={`live-readiness-item ${orderReadiness.hasConfirmation ? 'is-complete' : ''}`}>
            <strong>Customer confirmation</strong>
            <span>{orderReadiness.hasConfirmation ? 'Confirmed' : 'Still needed'}</span>
          </div>
        </div>
        <div className="live-readiness-reason">
          <strong>Current status</strong>
          <p>{orderReadiness.reason}</p>
        </div>
      </section>

      <section className="card stack-sm">
        <div className="split-row">
          <h3>Live diagnostics</h3>
          <Badge tone={diagnostics.length > 0 ? 'neutral' : 'warning'}>{diagnostics.length > 0 ? 'Tracing events' : 'No events yet'}</Badge>
        </div>
        <p className="muted">Use this to verify whether the session opened, the microphone started, and transcripts are reaching the UI.</p>
        {diagnostics.length === 0 ? (
          <p className="muted">Start listening to capture the connection and transcription lifecycle.</p>
        ) : (
          <ul className="line-list">
            {diagnostics.map((event, index) => (
              <li key={`${event}-${index}`}>{event}</li>
            ))}
          </ul>
        )}
      </section>

      <section className="grid two-col">
        <article className="card stack-sm">
          <h3>Customer Transcript</h3>
          {transcripts.length === 0 ? (
            <p className="muted">No live transcription yet. Start listening and speak into the microphone.</p>
          ) : (
            <ul className="line-list">
              {transcripts.map((line, idx) => (
                <li key={`${line}-${idx}`}>{line}</li>
              ))}
            </ul>
          )}
        </article>

        <article className="card stack-sm">
          <h3>Agent Responses</h3>
          {modelMessages.length === 0 ? (
            <p className="muted">The agent responses will appear here after transcription and tool execution.</p>
          ) : (
            <ul className="line-list">
              {modelMessages.map((line, idx) => (
                <li key={`${line}-${idx}`}>{line}</li>
              ))}
            </ul>
          )}
          {guidanceMessages.length > 0 ? (
            <>
              <h4>System Guidance</h4>
              <ul className="line-list">
                {guidanceMessages.map((line, idx) => (
                  <li key={`${line}-${idx}`}>{line}</li>
                ))}
              </ul>
            </>
          ) : null}
        </article>
      </section>

      <section className="grid two-col">
        <article className="card stack-sm">
          <h3>Manual fallback order</h3>
          <p className="muted">Use this if you want to place an order manually while the live session is unavailable.</p>
          <label>
            Customer name
            <input className="input" value={customerName} onChange={(event) => setCustomerName(event.target.value)} />
          </label>
          <div className="grid two-col">
            <label>
              Phone
              <input className="input" value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value)} />
            </label>
            <label>
              Email
              <input className="input" value={customerEmail} onChange={(event) => setCustomerEmail(event.target.value)} />
            </label>
          </div>
          <label>
            Notes
            <textarea className="input" value={notes} onChange={(event) => setNotes(event.target.value)} />
          </label>
        </article>

        <article className="card stack-sm">
          <h3>Add order items</h3>
          <div className="row gap-sm wrap">
            <select className="input" value={effectiveSelectedProductId} onChange={(event) => setSelectedProductId(event.target.value)}>
              {availableProducts.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </select>
            <input className="input" type="number" min={1} value={quantity} onChange={(event) => setQuantity(Math.max(1, Number(event.target.value)))} />
            <Button type="button" onClick={() => addItem(effectiveSelectedProductId, quantity)}>
              Add item
            </Button>
          </div>

          <ul className="line-list">
            {items.map((entry) => {
              const product = productById[entry.productId]
              if (!product) return null
              return (
                <li key={entry.productId}>
                  <div className="split-row">
                    <span>
                      {product.name} x{entry.quantity}
                    </span>
                    <div className="row gap-xs">
                      <strong>{formatCurrency(product.price * entry.quantity, product.currency)}</strong>
                      <Button size="sm" variant="ghost" onClick={() => setItems((prev) => prev.filter((item) => item.productId !== entry.productId))}>
                        Remove
                      </Button>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>

          <div className="split-row">
            <span>Total</span>
            <strong>{formatCurrency(total)}</strong>
          </div>
          {formError ? <p className="error-text">{formError}</p> : null}
          <Button onClick={placeOrder} disabled={placing}>
            {placing ? 'Placing...' : 'Place Manual Order'}
          </Button>
        </article>
      </section>
    </div>
  )
}
