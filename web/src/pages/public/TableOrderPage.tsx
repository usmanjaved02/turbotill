import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge } from '../../components/common/Badge'
import { Button } from '../../components/common/Button'
import { MicIcon, PlayIcon, StopIcon } from '../../components/common/Icons'
import { api, ApiClientError } from '../../services/api'
import { LiveAgentSessionClient } from '../../services/liveAgentSession'
import type { AgentConversationOrderResult, LiveConversationEntry, PublicTableOrderSession } from '../../types'
import { formatCurrency } from '../../utils/format'

const getErrorMessage = (error: unknown) => {
  if (error instanceof ApiClientError) return error.message
  if (error instanceof Error) return error.message
  return 'Something went wrong. Please try again.'
}

const compactConversation = (entries: LiveConversationEntry[], limit = 80) => {
  const merged: LiveConversationEntry[] = []

  for (const entry of entries) {
    const text = entry.text.trim()
    if (!text) continue

    const last = merged[merged.length - 1]
    if (!last || last.speaker !== entry.speaker) {
      merged.push({ speaker: entry.speaker, text })
      continue
    }

    const joined = `${last.text} ${text}`
      .replace(/\s+([,.!?])/g, '$1')
      .replace(/\s{2,}/g, ' ')
      .trim()

    last.text = joined
  }

  return merged.slice(-limit)
}

export const TableOrderPage = () => {
  const params = useMemo(() => new URLSearchParams(window.location.search), [])
  const agentId = params.get('agentId')?.trim() ?? ''
  const tableFromQuery = params.get('table')?.trim() ?? ''

  const [loading, setLoading] = useState(true)
  const [sessionMeta, setSessionMeta] = useState<PublicTableOrderSession | null>(null)
  const [connectionState, setConnectionState] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle')
  const [isListening, setIsListening] = useState(false)
  const [error, setError] = useState('')
  const [orderReadiness, setOrderReadiness] = useState<{
    hasCustomerName: boolean
    hasItems: boolean
    hasConfirmation: boolean
    reason: string
  }>({
    hasCustomerName: false,
    hasItems: false,
    hasConfirmation: false,
    reason: 'Tap the mic and tell us your order.'
  })
  const [placedOrder, setPlacedOrder] = useState<{ orderName: string; total: number; currency: string } | null>(null)

  const liveClientRef = useRef<LiveAgentSessionClient | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const processorNodeRef = useRef<ScriptProcessorNode | null>(null)
  const speakerContextRef = useRef<AudioContext | null>(null)
  const playbackCursorRef = useRef(0)
  const conversationRef = useRef<LiveConversationEntry[]>([])
  const analysisTimeoutRef = useRef<number | null>(null)
  const analysisInFlightRef = useRef(false)
  const orderCreatedRef = useRef(false)
  const lastAskRef = useRef('')

  const loadSession = async () => {
    if (!agentId) {
      setError('Agent link is missing. Please scan the QR again.')
      setLoading(false)
      return
    }

    if (agentId === 'new-agent') {
      setError('This is a draft QR preview. Save agent first, then use the generated live table QR.')
      setLoading(false)
      return
    }

    setLoading(true)
    setError('')

    try {
      const data = await api.agents.getPublicTableOrderSession(agentId, tableFromQuery || undefined)
      setSessionMeta(data)
      setOrderReadiness((prev) => ({
        ...prev,
        reason: data.table.isAvailable
          ? 'Tap the mic and tell us your order.'
          : `Table ${data.table.number} is busy right now. Please call staff for help.`
      }))
    } catch (sessionError) {
      setError(getErrorMessage(sessionError))
    } finally {
      setLoading(false)
    }
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
      return
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
      await speakerContext.resume()
    }

    return speakerContext
  }

  const queueSpeakerAudio = async (base64Audio: string) => {
    try {
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
    } catch {
      await closeSpeakerContext()
    }
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

  const disconnectLive = async () => {
    if (analysisTimeoutRef.current) {
      window.clearTimeout(analysisTimeoutRef.current)
      analysisTimeoutRef.current = null
    }
    analysisInFlightRef.current = false
    stopAudioCapture()
    liveClientRef.current?.disconnect()
    liveClientRef.current = null
    await closeSpeakerContext()
    setConnectionState('idle')
  }

  const addConversationLine = (speaker: 'customer' | 'agent', text: string) => {
    const normalizedText = text.trim()
    if (!normalizedText) return

    conversationRef.current = compactConversation([...conversationRef.current, { speaker, text: normalizedText }], 120)
  }

  const applyConversationAnalysis = (result: AgentConversationOrderResult) => {
    setOrderReadiness({
      hasCustomerName: Boolean(result.hasCustomerName),
      hasItems: Boolean(result.hasItems),
      hasConfirmation: Boolean(result.hasConfirmation ?? result.readyToPlace),
      reason: result.reason
    })

    if (result.readyToPlace && result.order) {
      orderCreatedRef.current = true
      const currency = result.order.items[0]?.unitPrice ? sessionMeta?.menu[0]?.currency || 'USD' : 'USD'
      setPlacedOrder({
        orderName: result.order.orderName || result.order.id,
        total: result.order.totalAmount,
        currency
      })
      void disconnectLive()
      return
    }

    const suggestedAsk = result.ask?.trim() ?? ''
    if (suggestedAsk && liveClientRef.current?.canStreamAudio() && suggestedAsk !== lastAskRef.current) {
      lastAskRef.current = suggestedAsk
      liveClientRef.current.sendGuidanceInstruction(suggestedAsk, 'Urdu', 'ask')
    }
  }

  const scheduleConversationAnalysis = () => {
    if (!agentId || orderCreatedRef.current || analysisInFlightRef.current || conversationRef.current.length < 2) {
      return
    }

    if (analysisTimeoutRef.current) {
      window.clearTimeout(analysisTimeoutRef.current)
    }

    analysisTimeoutRef.current = window.setTimeout(async () => {
      analysisInFlightRef.current = true

      try {
        const result = await api.agents.createPublicConversationOrder(
          agentId,
          {
            source: 'mic',
            tableNumber: sessionMeta?.table.number || tableFromQuery || undefined,
            conversation: compactConversation(conversationRef.current, 80),
            hints: {
              tableNumber: sessionMeta?.table.number || tableFromQuery || undefined
            }
          },
          tableFromQuery || undefined
        )

        applyConversationAnalysis(result)
      } catch (analysisError) {
        setError(getErrorMessage(analysisError))
      } finally {
        analysisInFlightRef.current = false
      }
    }, 1200)
  }

  const startAudioCapture = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    })

    const context = new AudioContext()
    const sourceNode = context.createMediaStreamSource(stream)
    const processorNode = context.createScriptProcessor(4096, 1, 1)

    processorNode.onaudioprocess = (event) => {
      if (!liveClientRef.current?.canStreamAudio()) {
        return
      }

      const input = event.inputBuffer.getChannelData(0)
      const chunk = new Float32Array(input.length)
      chunk.set(input)
      liveClientRef.current.sendAudioChunk(chunk, context.sampleRate)
    }

    sourceNode.connect(processorNode)
    processorNode.connect(context.destination)

    mediaStreamRef.current = stream
    audioContextRef.current = context
    sourceNodeRef.current = sourceNode
    processorNodeRef.current = processorNode
    setIsListening(true)
  }

  const startVoiceOrdering = async () => {
    if (!sessionMeta) return
    if (!sessionMeta.table.isAvailable) {
      setError(`Table ${sessionMeta.table.number} is busy right now. Please call staff for help.`)
      return
    }

    setError('')
    setConnectionState('connecting')

    try {
      const sessionInfo = await api.agents.createPublicLiveSession(
        agentId,
        {
          source: 'mic',
          tableNumber: sessionMeta.table.number
        },
        tableFromQuery || undefined
      )

      const client = new LiveAgentSessionClient()
      liveClientRef.current = client

      await client.connect(sessionInfo, {
        onOpen: () => {
          setConnectionState('connected')
        },
        onClose: () => {
          setConnectionState('idle')
          setIsListening(false)
        },
        onError: (message) => {
          setConnectionState('error')
          setError(message)
        },
        onTranscript: (text) => {
          const normalizedText = text.trim()
          if (!normalizedText) return

          addConversationLine('customer', normalizedText)
          scheduleConversationAnalysis()
        },
        onModelText: (text) => {
          const normalizedText = text.trim()
          if (!normalizedText) return

          addConversationLine('agent', normalizedText)
          scheduleConversationAnalysis()
        },
        onAudioData: (base64Audio) => {
          void queueSpeakerAudio(base64Audio)
        }
      })

      await startAudioCapture()
    } catch (startError) {
      setConnectionState('error')
      setError(getErrorMessage(startError))
      await disconnectLive()
    }
  }

  const stopVoiceOrdering = async () => {
    liveClientRef.current?.sendAudioStreamEnd()
    await disconnectLive()
  }

  useEffect(() => {
    void loadSession()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId, tableFromQuery])

  useEffect(() => {
    return () => {
      if (analysisTimeoutRef.current) {
        window.clearTimeout(analysisTimeoutRef.current)
      }
      stopAudioCapture()
      void closeSpeakerContext()
      liveClientRef.current?.disconnect()
    }
  }, [])

  if (loading) {
    return (
      <div className="table-order-page">
        <div className="table-order-shell card">
          <div className="table-order-brand" aria-hidden="true">
            <img src="/turbotillicon.png" alt="" className="table-order-brand-icon" />
            <span className="table-order-brand-logo-shell">
              <img src="/turbotillLogo.png" alt="" className="table-order-brand-logo" />
            </span>
          </div>
          <p className="muted">Opening your table...</p>
        </div>
      </div>
    )
  }

  if (!sessionMeta) {
    return (
      <div className="table-order-page">
        <div className="table-order-shell card stack-sm">
          <div className="table-order-brand" aria-hidden="true">
            <img src="/turbotillicon.png" alt="" className="table-order-brand-icon" />
            <span className="table-order-brand-logo-shell">
              <img src="/turbotillLogo.png" alt="" className="table-order-brand-logo" />
            </span>
          </div>
          <h2>We could not open this table</h2>
          <p className="muted">{error || 'This QR link is not active right now.'}</p>
          <Link to="/" className="text-link">Back to home</Link>
        </div>
      </div>
    )
  }

  const isConnecting = connectionState === 'connecting'
  const isMicExpanded = isListening && connectionState === 'connected'

  return (
    <div className={`table-order-page ${isMicExpanded ? 'mic-focus-active' : ''}`}>
      <main className="table-order-shell stack-lg">
        <div className="table-order-brand" aria-hidden="true">
          <img src="/turbotillicon.png" alt="" className="table-order-brand-icon" />
          <span className="table-order-brand-logo-shell">
            <img src="/turbotillLogo.png" alt="" className="table-order-brand-logo" />
          </span>
        </div>
        <section className="card table-voice-hero stack-sm">
          <div className="split-row">
            <span className="section-kicker">Table {sessionMeta.table.number}</span>
            <Badge tone={connectionState === 'connected' ? 'success' : connectionState === 'connecting' ? 'warning' : 'neutral'}>
              {connectionState === 'connected' ? 'Listening' : connectionState === 'connecting' ? 'Starting' : 'Ready'}
            </Badge>
          </div>
          <h1>Welcome to {sessionMeta.brand.companyName}</h1>
          <p className="muted">Tap the mic and speak your order naturally. We will confirm each item and place it for you.</p>

          <div className={`table-voice-mic-shell ${isMicExpanded ? 'expanded' : ''} ${isConnecting ? 'is-connecting' : ''}`}>
            <div className={`table-voice-stage ${isMicExpanded ? 'active' : ''}`}>
              <div className={`voice-layer-stack ${isMicExpanded ? 'active' : ''}`} aria-hidden="true">
                <span className="voice-layer voice-layer-1" />
                <span className="voice-layer voice-layer-2" />
                <span className="voice-layer voice-layer-3" />
              </div>
              <button
                type="button"
                className={`mic-btn table-voice-mic-btn ${isListening ? 'active' : ''} ${isConnecting ? 'warming' : ''} ${isMicExpanded ? 'expanded' : ''}`}
                onClick={() => {
                  if (isListening || connectionState === 'connected' || connectionState === 'connecting') {
                    void stopVoiceOrdering()
                    return
                  }
                  void startVoiceOrdering()
                }}
                aria-label="Start table voice ordering"
              >
                <MicIcon />
              </button>
              <div
                className={`voice-bars ${
                  isListening ? 'active' : connectionState === 'connecting' ? 'warming' : ''
                }`}
                aria-hidden="true"
              >
                <span />
                <span />
                <span />
                <span />
                <span />
              </div>
            </div>
            {isConnecting ? (
              <div className="table-voice-connecting" role="status" aria-live="polite">
                <div className="table-voice-loader" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </div>
                <strong>Starting your voice assistant...</strong>
                <span>Please wait a moment. We are connecting now.</span>
              </div>
            ) : null}
            <p className="muted">
              {isListening
                ? 'We can hear you now. Speak naturally, one item at a time.'
                : connectionState === 'connecting'
                  ? 'Please wait, we are getting ready...'
                  : 'Tap the mic to start talking'}
            </p>
            <div className={`row gap-sm wrap ${isMicExpanded ? 'table-voice-action-hidden' : ''}`}>
              <Button
                size="sm"
                onClick={() => {
                  if (isListening || connectionState === 'connected' || connectionState === 'connecting') {
                    void stopVoiceOrdering()
                    return
                  }
                  void startVoiceOrdering()
                }}
                iconLeft={isListening || isConnecting ? <StopIcon /> : <PlayIcon />}
              >
                {isListening ? 'Stop Ordering' : isConnecting ? 'Cancel Starting' : 'Start Ordering'}
              </Button>
            </div>
          </div>

          {placedOrder ? (
            <div className="table-order-success">
              <strong>Your order is placed</strong>
              <p>
                {placedOrder.orderName} is confirmed. Total {formatCurrency(placedOrder.total, placedOrder.currency)}.
              </p>
            </div>
          ) : null}

          <p className="muted">{orderReadiness.reason}</p>
          {error ? <p className="error-text">{error}</p> : null}
        </section>

      </main>
    </div>
  )
}
