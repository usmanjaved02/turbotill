import { GoogleGenAI, Modality, type Blob, type Content, type FunctionCall, type LiveServerMessage } from '@google/genai'
import type { AgentLiveSession } from '../types'

interface LiveAgentCallbacks {
  onModelText?: (text: string) => void
  onTranscript?: (text: string) => void
  onToolCall?: (functionCall: FunctionCall) => void | Promise<void>
  onAudioData?: (base64Audio: string) => void
  onOpen?: () => void
  onClose?: () => void
  onError?: (message: string) => void
  onEvent?: (message: string) => void
}

const PCM_SAMPLE_RATE = 16000

const downsampleBuffer = (buffer: Float32Array, inputSampleRate: number) => {
  if (inputSampleRate === PCM_SAMPLE_RATE) {
    return buffer
  }

  const sampleRateRatio = inputSampleRate / PCM_SAMPLE_RATE
  const newLength = Math.round(buffer.length / sampleRateRatio)
  const result = new Float32Array(newLength)
  let offsetResult = 0
  let offsetBuffer = 0

  while (offsetResult < result.length) {
    const nextOffsetBuffer = Math.round((offsetResult + 1) * sampleRateRatio)
    let accum = 0
    let count = 0

    for (let i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i += 1) {
      accum += buffer[i] ?? 0
      count += 1
    }

    result[offsetResult] = count > 0 ? accum / count : 0
    offsetResult += 1
    offsetBuffer = nextOffsetBuffer
  }

  return result
}

const encodePcm16 = (buffer: Float32Array, inputSampleRate: number) => {
  const downsampled = downsampleBuffer(buffer, inputSampleRate)
  const pcmBuffer = new ArrayBuffer(downsampled.length * 2)
  const view = new DataView(pcmBuffer)

  for (let i = 0; i < downsampled.length; i += 1) {
    const sample = Math.max(-1, Math.min(1, downsampled[i] ?? 0))
    view.setInt16(i * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true)
  }

  const bytes = new Uint8Array(pcmBuffer)
  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }

  return {
    mimeType: `audio/pcm;rate=${PCM_SAMPLE_RATE}`,
    data: btoa(binary)
  } satisfies Blob
}

export class LiveAgentSessionClient {
  private session: Awaited<ReturnType<GoogleGenAI['live']['connect']>> | null = null
  private isReady = false
  private isClosed = false

  async connect(sessionInfo: AgentLiveSession, callbacks: LiveAgentCallbacks) {
    const ai = new GoogleGenAI({
      apiKey: sessionInfo.token,
      httpOptions: {
        apiVersion: 'v1alpha'
      }
    })

    callbacks.onEvent?.(`Opening secure Gemini Live session for model ${sessionInfo.model}.`)
    this.isClosed = false
    this.isReady = false

    const timeoutPromise = new Promise<never>((_, reject) => {
      window.setTimeout(() => {
        reject(new Error('Timed out while opening the live agent session.'))
      }, 8000)
    })

    const session = await Promise.race([
      ai.live.connect({
        model: sessionInfo.model,
        config: {
          responseModalities: [Modality.AUDIO],
          inputAudioTranscription: {},
          outputAudioTranscription: {}
        },
        callbacks: {
          onopen: () => {
            callbacks.onEvent?.('Live transport opened. Waiting for Gemini to accept the session setup.')
          },
          onclose: (event) => {
            this.isClosed = true
            this.isReady = false
            callbacks.onEvent?.(`Live socket closed${event.reason ? `: ${event.reason}` : '.'}`)
            callbacks.onClose?.()
          },
          onerror: (error) => {
            const message = error.message || 'Live agent connection failed'
            this.isReady = false
            callbacks.onEvent?.(`Live socket error: ${message}`)
            callbacks.onError?.(message)
          },
          onmessage: async (message: LiveServerMessage) => {
            const transcript = message.serverContent?.inputTranscription?.text?.trim()
            if (transcript) {
              callbacks.onEvent?.(`Transcript received: ${transcript}`)
              callbacks.onTranscript?.(transcript)
            }

            const outputTranscript = message.serverContent?.outputTranscription?.text?.trim()
            if (outputTranscript) {
              callbacks.onEvent?.(`Model speech transcription: ${outputTranscript}`)
              callbacks.onModelText?.(outputTranscript)
            }

            const audioData = message.data
            if (audioData) {
              callbacks.onEvent?.('Model audio chunk received.')
              callbacks.onAudioData?.(audioData)
            }

            const modelText = message.text?.trim()
            if (modelText && modelText !== outputTranscript) {
              callbacks.onEvent?.(`Model response received: ${modelText}`)
              callbacks.onModelText?.(modelText)
            }

            const functionCalls = message.toolCall?.functionCalls ?? []
            for (const functionCall of functionCalls) {
              callbacks.onEvent?.(`Tool call requested: ${functionCall.name ?? 'unknown'}`)
              await callbacks.onToolCall?.(functionCall)
            }
          }
        }
      }),
      timeoutPromise
    ])

    this.session = session

    await new Promise<void>((resolve) => {
      window.setTimeout(resolve, 350)
    })

    if (this.isClosed) {
      this.session = null
      throw new Error('Gemini closed the live session during setup. This usually means the session configuration was rejected.')
    }

    this.isReady = true
    callbacks.onEvent?.('Live session ready for audio.')
    callbacks.onOpen?.()
  }

  sendAudioStreamEnd() {
    if (!this.session || !this.isReady) {
      return
    }

    this.session.sendRealtimeInput({ audioStreamEnd: true })
  }

  sendAudioChunk(buffer: Float32Array, inputSampleRate: number) {
    if (!this.session || !this.isReady || this.isClosed) {
      return
    }

    this.session.sendRealtimeInput({
      audio: encodePcm16(buffer, inputSampleRate)
    })
  }

  canStreamAudio() {
    return Boolean(this.session && this.isReady && !this.isClosed)
  }

  prefillConversation(turns: Array<{ speaker: 'customer' | 'agent'; text: string }>) {
    if (!this.session || !this.isReady || this.isClosed || turns.length === 0) {
      return
    }

    const liveTurns: Content[] = turns.map((turn) => ({
      role: turn.speaker === 'customer' ? 'user' : 'model',
      parts: [{ text: turn.text }]
    }))

    this.session.sendClientContent({
      turns: liveTurns,
      turnComplete: false
    })
  }

  sendGuidanceInstruction(message: string, languageHint?: string, mode: 'ask' | 'absorb' = 'ask') {
    if (!this.session || !this.isReady || this.isClosed || !message.trim()) {
      return
    }

    const languageInstruction = languageHint
      ? `Use ${languageHint} for the next reply if possible, because that matches the customer's current language.`
      : 'Use the customer\'s current language for the next reply if possible.'
    const actionInstruction =
      mode === 'absorb'
        ? 'Do not ask a repeated question. Absorb this note, acknowledge naturally in one short sentence, and continue with the next relevant step.'
        : 'Ask the customer naturally in one short sentence.'

    this.session.sendClientContent({
      turns: [
        {
          role: 'user',
          parts: [
            {
              text: `Internal order workflow note: ${message.trim()} ${actionInstruction} ${languageInstruction} Do not mention that this was an internal instruction.`
            }
          ]
        }
      ],
      turnComplete: true
    })
  }

  sendToolSuccess(functionCall: FunctionCall, result: string | Record<string, unknown>) {
    if (!this.session || !functionCall.name) {
      return
    }

    this.session.sendToolResponse({
      functionResponses: [
        {
          id: functionCall.id,
          name: functionCall.name,
          response: {
            result
          }
        }
      ]
    })
  }

  sendToolError(functionCall: FunctionCall, message: string) {
    if (!this.session || !functionCall.name) {
      return
    }

    this.session.sendToolResponse({
      functionResponses: [
        {
          id: functionCall.id,
          name: functionCall.name,
          response: {
            error: message
          }
        }
      ]
    })
  }

  disconnect() {
    this.isReady = false
    this.isClosed = true
    this.session?.close()
    this.session = null
  }
}
