import { useEffect, useMemo, useRef, useState } from 'react'
import type {
  Agent,
  AgentInput,
  AgentType,
  AgentVoiceGender,
  AgentVoiceLanguage,
  AgentVoicePreviewInput,
  Product,
} from '../../types'
import { randomId } from '../../utils/format'
import { Badge } from '../common/Badge'
import { Button } from '../common/Button'
import { ToggleSwitch } from '../common/ToggleSwitch'
import { ProductSelector } from './ProductSelector'
import { ScriptEmbedCard } from './ScriptEmbedCard'
import { WebhookConfigCard } from './WebhookConfigCard'
import {
  GEMINI_LIVE_LANGUAGE_OPTIONS,
  GEMINI_LIVE_VOICE_OPTIONS,
  type GeminiLiveVoiceName
} from '../../constants/geminiLiveVoiceOptions'
import { AGENT_TYPE_LABELS, AGENT_TYPE_OPTIONS } from '../../constants/agentTypes'

interface AgentFormProps {
  products: Product[]
  initialValue?: Partial<Agent>
  initialAgentType?: AgentType
  lockAgentType?: boolean
  loading?: boolean
  submitLabel?: string
  onSubmit: (payload: AgentInput) => Promise<void> | void
  onSaveDraft?: (payload: AgentInput) => Promise<void> | void
  onCancel?: () => void
  testVoicePreview: (payload: AgentVoicePreviewInput) => Promise<{ audioBase64: string; mimeType: string }>
  testWebhook: (url: string) => Promise<'connected' | 'failed'>
}

const createSnippet = () =>
  `<script src="https://cdn.ordertacker.ai/widget.js" data-agent-id="${randomId('agent')}" async></script>`

const buildDefaultCustomerEntryUrl = () => {
  if (typeof window === 'undefined') {
    return 'https://your-domain.com/table-order'
  }

  return `${window.location.origin}/table-order`
}

const voiceGenderOptions: Array<{ value: AgentVoiceGender; label: string }> = [
  { value: 'female', label: 'Female' },
  { value: 'male', label: 'Male' },
  { value: 'neutral', label: 'Neutral' }
]

const voiceGenderByName: Record<GeminiLiveVoiceName, AgentVoiceGender> = Object.fromEntries(
  GEMINI_LIVE_VOICE_OPTIONS.map((option) => [option.value, option.gender])
) as Record<GeminiLiveVoiceName, AgentVoiceGender>

export const AgentForm = ({
  products,
  initialValue,
  initialAgentType,
  lockAgentType,
  loading,
  submitLabel = 'Create Agent',
  onSubmit,
  onSaveDraft,
  onCancel,
  testVoicePreview,
  testWebhook,
}: AgentFormProps) => {
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [name, setName] = useState(initialValue?.name ?? '')
  const [agentType, setAgentType] = useState<AgentType>(initialAgentType ?? initialValue?.agentType ?? 'terminal')
  const [description, setDescription] = useState(initialValue?.description ?? '')
  const [productAccess, setProductAccess] = useState<'all' | 'selected'>(initialValue?.productAccess ?? 'all')
  const [selectedProducts, setSelectedProducts] = useState<string[]>(initialValue?.productIds ?? [])
  const [webhookUrl, setWebhookUrl] = useState(initialValue?.webhookUrl ?? '')
  const [webhookSecret, setWebhookSecret] = useState(initialValue?.webhookSecret ?? '')
  const [webhookStatus, setWebhookStatus] = useState<Agent['webhookStatus']>(
    initialValue?.webhookStatus ?? 'not_configured'
  )
  const [mode, setMode] = useState<'mic' | 'script'>(initialValue?.mode ?? 'mic')
  const [voiceLanguage, setVoiceLanguage] = useState<AgentVoiceLanguage>(
    initialValue?.voiceProfile?.languageCode ?? 'en-US'
  )
  const [voiceGender, setVoiceGender] = useState<AgentVoiceGender>(initialValue?.voiceProfile?.gender ?? 'female')
  const [voiceName, setVoiceName] = useState<GeminiLiveVoiceName>(initialValue?.voiceProfile?.voiceName ?? 'Kore')
  const [allowMultipleOrdersPerTable, setAllowMultipleOrdersPerTable] = useState(
    initialValue?.tableConfig?.allowMultipleOrdersPerTable ?? true
  )
  const [defaultTableNumber, setDefaultTableNumber] = useState(initialValue?.tableConfig?.defaultTableNumber ?? '')
  const [customerEntryUrl, setCustomerEntryUrl] = useState(
    initialValue?.tableConfig?.customerEntryUrl ?? buildDefaultCustomerEntryUrl()
  )
  const [isPreviewLoading, setIsPreviewLoading] = useState(false)
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false)
  const [voicePreviewError, setVoicePreviewError] = useState('')
  const [qrCopyStatus, setQrCopyStatus] = useState('')
  const [qrDownloadStatus, setQrDownloadStatus] = useState('')
  const [isActive, setIsActive] = useState(initialValue?.isActive ?? false)
  const [embedCode, setEmbedCode] = useState(initialValue?.embedCode ?? createSnippet())
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [testingWebhook, setTestingWebhook] = useState(false)
  const previewAudioRef = useRef<HTMLAudioElement | null>(null)
  const previewRequestSeqRef = useRef(0)

  const isTableOrderAgent = agentType === 'table_order_taker'

  useEffect(() => {
    if (!initialAgentType) {
      return
    }

    setAgentType(initialAgentType)
  }, [initialAgentType])

  const selectedNames = useMemo(
    () => products.filter((product) => selectedProducts.includes(product.id)).map((product) => product.name),
    [products, selectedProducts]
  )

  const availableProductCount = products.length
  const selectedSummary =
    productAccess === 'all'
      ? `All ${availableProductCount} product${availableProductCount === 1 ? '' : 's'}`
      : selectedNames.length > 0
        ? `${selectedNames.length} selected`
        : 'None selected'

  const payload: AgentInput = {
    name: name.trim(),
    agentType,
    description: description.trim() || undefined,
    productAccess,
    productIds: productAccess === 'selected' ? selectedProducts : [],
    webhookUrl: webhookUrl.trim() || undefined,
    webhookSecret: webhookSecret.trim() || undefined,
    mode: isTableOrderAgent ? 'mic' : mode,
    tableConfig: isTableOrderAgent
      ? {
          allowMultipleOrdersPerTable,
          defaultTableNumber: defaultTableNumber.trim() || undefined,
          customerEntryUrl: customerEntryUrl.trim() || undefined
        }
      : undefined,
    voiceProfile: {
      languageCode: voiceLanguage,
      gender: voiceGender,
      voiceName
    },
    isActive,
  }

  const validateStepOne = () => {
    const nextErrors: Record<string, string> = {}

    if (!name.trim()) {
      nextErrors.name = 'Agent name is required.'
    }

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const validateStepTwo = () => {
    const nextErrors: Record<string, string> = {}

    if (productAccess === 'selected' && selectedProducts.length === 0) {
      nextErrors.products = 'Select at least one product.'
    }

    if (products.length === 0) {
      nextErrors.products = 'Create products first before assigning them to an agent.'
    }

    if (webhookUrl && !/^https?:\/\//.test(webhookUrl)) {
      nextErrors.webhook = 'Webhook URL should start with http:// or https://'
    }

    if (isTableOrderAgent && !defaultTableNumber.trim()) {
      nextErrors.tableNumber = 'Default table number is required for table QR generation.'
    }

    if (isTableOrderAgent && customerEntryUrl && !/^https?:\/\//.test(customerEntryUrl)) {
      nextErrors.customerEntryUrl = 'Customer entry URL should start with http:// or https://'
    }

    setErrors((prev) => {
      const next = { ...prev }
      delete next.products
      delete next.webhook
      delete next.tableNumber
      delete next.customerEntryUrl
      return { ...next, ...nextErrors }
    })
    return Object.keys(nextErrors).length === 0
  }

  const validateAll = () => {
    const nameErrors: Record<string, string> = {}
    const setupErrors: Record<string, string> = {}

    if (!name.trim()) {
      nameErrors.name = 'Agent name is required.'
    }

    if (productAccess === 'selected' && selectedProducts.length === 0) {
      setupErrors.products = 'Select at least one product.'
    }

    if (products.length === 0) {
      setupErrors.products = 'Create products first before assigning them to an agent.'
    }

    if (webhookUrl && !/^https?:\/\//.test(webhookUrl)) {
      setupErrors.webhook = 'Webhook URL should start with http:// or https://'
    }

    if (isTableOrderAgent && !defaultTableNumber.trim()) {
      setupErrors.tableNumber = 'Default table number is required for table QR generation.'
    }

    if (isTableOrderAgent && customerEntryUrl && !/^https?:\/\//.test(customerEntryUrl)) {
      setupErrors.customerEntryUrl = 'Customer entry URL should start with http:// or https://'
    }

    const nextErrors = { ...nameErrors, ...setupErrors }
    setErrors(nextErrors)

    return Object.keys(nextErrors).length === 0
  }

  const handleNextStep = () => {
    if (step === 1) {
      if (!validateStepOne()) {
        return
      }

      setStep(2)
      return
    }

    if (step === 2) {
      if (!validateStepTwo()) {
        return
      }

      setStep(3)
    }
  }

  const handleBackStep = () => {
    if (step === 3) {
      setStep(2)
      return
    }

    setStep(1)
  }

  const goToStep = (targetStep: 1 | 2 | 3) => {
    if (targetStep === 1) {
      setStep(1)
      return
    }

    if (!validateStepOne()) {
      return
    }

    if (targetStep === 2) {
      setStep(2)
      return
    }

    if (!validateStepTwo()) {
      return
    }

    setStep(3)
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()

    if (step === 1 || step === 2) {
      handleNextStep()
      return
    }

    if (!validateAll()) {
      return
    }

    await onSubmit(payload)
  }

  const handleSaveDraft = async () => {
    if (!onSaveDraft) {
      return
    }

    if (!validateAll()) {
      return
    }

    await onSaveDraft({ ...payload, isActive: false })
  }

  const stopVoicePreview = () => {
    previewRequestSeqRef.current += 1
    if (previewAudioRef.current) {
      previewAudioRef.current.pause()
      previewAudioRef.current.currentTime = 0
      previewAudioRef.current = null
    }
    setIsPreviewLoading(false)
    setIsPreviewPlaying(false)
  }

  const playVoicePreview = async () => {
    const requestSeq = previewRequestSeqRef.current + 1
    previewRequestSeqRef.current = requestSeq

    if (previewAudioRef.current) {
      previewAudioRef.current.pause()
      previewAudioRef.current.currentTime = 0
      previewAudioRef.current = null
    }

    setVoicePreviewError('')
    setIsPreviewLoading(true)
    setIsPreviewPlaying(false)

    try {
      const preview = await testVoicePreview({
        voiceProfile: {
          languageCode: voiceLanguage,
          gender: voiceGender,
          voiceName
        }
      })

      if (previewRequestSeqRef.current !== requestSeq) {
        return
      }

      setIsPreviewLoading(false)
      const audio = new Audio(`data:${preview.mimeType};base64,${preview.audioBase64}`)
      previewAudioRef.current = audio
      audio.onended = () => {
        if (previewRequestSeqRef.current !== requestSeq) {
          return
        }
        previewAudioRef.current = null
        setIsPreviewLoading(false)
        setIsPreviewPlaying(false)
      }
      audio.onerror = () => {
        if (previewRequestSeqRef.current !== requestSeq) {
          return
        }
        previewAudioRef.current = null
        setIsPreviewLoading(false)
        setIsPreviewPlaying(false)
        setVoicePreviewError('Voice preview could not be played for this voice. Try another option.')
      }

      setIsPreviewPlaying(true)
      await audio.play()
    } catch (error) {
      if (previewRequestSeqRef.current !== requestSeq) {
        return
      }
      previewAudioRef.current = null
      setIsPreviewLoading(false)
      setIsPreviewPlaying(false)
      setVoicePreviewError(error instanceof Error ? error.message : 'Voice preview failed. Please try again.')
    }
  }

  const handleVoiceNameChange = (nextVoice: GeminiLiveVoiceName) => {
    setVoiceName(nextVoice)
    setVoiceGender(voiceGenderByName[nextVoice] ?? 'neutral')
  }

  const stepOneComplete = Boolean(name.trim())
  const canGoToStepTwo = stepOneComplete
  const canGoToStepThree = canGoToStepTwo && step !== 1
  const selectedAgentType = AGENT_TYPE_OPTIONS.find((option) => option.value === agentType)
  const selectedProductsPreview =
    selectedNames.length > 0
      ? `${selectedNames.slice(0, 4).join(', ')}${selectedNames.length > 4 ? ` +${selectedNames.length - 4} more` : ''}`
      : 'None selected'
  const hasPersistedAgentId = Boolean(initialValue?.id?.trim())
  const qrAgentId = hasPersistedAgentId ? String(initialValue?.id) : 'new-agent'
  const qrIsPreview = !hasPersistedAgentId

  const qrTargetLink = useMemo(() => {
    if (!isTableOrderAgent || !defaultTableNumber.trim()) {
      return ''
    }

    const baseUrl = customerEntryUrl.trim() || buildDefaultCustomerEntryUrl()
    if (!/^https?:\/\//.test(baseUrl)) {
      return ''
    }

    try {
      const url = new URL(baseUrl)
      url.searchParams.set('agentId', qrAgentId)
      url.searchParams.set('table', defaultTableNumber.trim())
      return url.toString()
    } catch {
      return ''
    }
  }, [customerEntryUrl, defaultTableNumber, isTableOrderAgent, qrAgentId])

  const qrImageUrl = qrTargetLink
    ? `https://api.qrserver.com/v1/create-qr-code/?size=320x320&format=png&data=${encodeURIComponent(qrTargetLink)}`
    : ''

  const copyQrLink = async () => {
    if (!qrTargetLink) {
      return
    }

    if (!navigator.clipboard?.writeText) {
      setQrCopyStatus('Clipboard is not available in this browser.')
      return
    }

    try {
      await navigator.clipboard.writeText(qrTargetLink)
      setQrCopyStatus('QR link copied.')
    } catch {
      setQrCopyStatus('Unable to copy link right now.')
    }
  }

  const downloadQrCodePng = async () => {
    if (!qrTargetLink || !defaultTableNumber.trim()) {
      return
    }

    setQrDownloadStatus('Preparing QR image...')

    const safeAgentName = (name.trim() || 'Order Agent').replace(/[^\w\s-]/g, '').trim() || 'Order Agent'
    const safeTable = defaultTableNumber.trim().replace(/[^\w-]/g, '') || 'table'
    const fileBase = `${safeAgentName.replace(/\s+/g, '-').toLowerCase()}-${safeTable.toLowerCase()}-qr-code`
    const qrPngUrl = `https://api.qrserver.com/v1/create-qr-code/?size=1024x1024&format=png&data=${encodeURIComponent(qrTargetLink)}`

    try {
      const response = await fetch(qrPngUrl)
      if (!response.ok) {
        throw new Error('Unable to fetch QR image.')
      }
      const blob = await response.blob()
      const href = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = href
      link.download = `${fileBase}.png`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(href)
      setQrDownloadStatus('QR image downloaded.')
    } catch {
      setQrDownloadStatus('Unable to download QR image right now.')
    }
  }

  useEffect(() => {
    if (!qrCopyStatus) {
      return
    }

    const timeout = setTimeout(() => setQrCopyStatus(''), 2200)
    return () => clearTimeout(timeout)
  }, [qrCopyStatus])

  useEffect(() => {
    if (!qrDownloadStatus) {
      return
    }

    const timeout = setTimeout(() => setQrDownloadStatus(''), 2400)
    return () => clearTimeout(timeout)
  }, [qrDownloadStatus])

  useEffect(() => {
    return () => {
      previewRequestSeqRef.current += 1
      if (previewAudioRef.current) {
        previewAudioRef.current.pause()
        previewAudioRef.current.currentTime = 0
        previewAudioRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (step !== 2) {
      return
    }

    void validateStepTwo()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productAccess, selectedProducts.length, webhookUrl, defaultTableNumber, customerEntryUrl, step, isTableOrderAgent])

  useEffect(() => {
    if (isTableOrderAgent && mode !== 'mic') {
      setMode('mic')
    }
  }, [isTableOrderAgent, mode])

  return (
    <form className="stack-lg" onSubmit={handleSubmit}>
      <section className="card agent-stepper-shell">
        <div className="agent-stepper-head">
          <div>
            <span className="section-kicker">Guided Setup</span>
            <h3>Agent Configuration Wizard</h3>
          </div>
          <Badge tone={step === 3 ? 'success' : 'info'}>{`Step ${step} of 3`}</Badge>
        </div>
        <div className="agent-stepper-track">
          <button
            type="button"
            className={`agent-step-chip ${step === 1 ? 'active' : stepOneComplete ? 'done' : ''}`}
            onClick={() => goToStep(1)}
          >
            1. Identity & Voice
          </button>
          <button
            type="button"
            className={`agent-step-chip ${step === 2 ? 'active' : step === 3 ? 'done' : ''}`}
            onClick={() => goToStep(2)}
            disabled={!canGoToStepTwo}
          >
            2. Access, Delivery & Channel
          </button>
          <button
            type="button"
            className={`agent-step-chip ${step === 3 ? 'active' : ''}`}
            onClick={() => goToStep(3)}
            disabled={!canGoToStepThree}
          >
            3. Review & Save
          </button>
        </div>
      </section>

      <section className="card agent-step-guidance">
        <strong>
          {step === 1
            ? 'Step 1: Set basic profile'
            : step === 2
              ? 'Step 2: Configure access and channels'
              : 'Step 3: Final review and activation'}
        </strong>
        <p className="muted">
          {step === 1
            ? 'Choose category, set instructions, and test the agent voice.'
            : step === 2
              ? 'Assign products, webhook, table options, and operating mode.'
              : 'Review all settings in one place, then save or activate.'}
        </p>
      </section>

      <div className="stack-lg agent-form-main agent-builder-single-column">
        {step === 1 ? (
          <section className="card stack-lg agent-form-step-card">
            <div className="agent-step-layout-grid step-one">
              <section className="stack-sm agent-form-step-section agent-form-step-panel agent-step-panel-category">
                <div className="agent-form-section-head">
                  <div>
                    <span className="section-kicker">Agent Category</span>
                    <h3>Choose category</h3>
                  </div>
                  <p className="muted">Category decides the workflow shape, customer entry points, and operational guardrails.</p>
                </div>

                <div className="agent-type-grid">
                  {AGENT_TYPE_OPTIONS.map((option) => {
                    const disabled =
                      (!option.available && option.value !== agentType) || (Boolean(lockAgentType) && option.value !== agentType)
                    return (
                      <button
                        key={option.value}
                        type="button"
                        className={`mode-card agent-type-card ${agentType === option.value ? 'active' : ''}`}
                        disabled={disabled}
                        onClick={() => {
                          setAgentType(option.value)
                          setErrors((prev) => {
                            const next = { ...prev }
                            delete next.tableNumber
                            delete next.customerEntryUrl
                            return next
                          })
                        }}
                      >
                        <div className="split-row">
                          <strong>{option.label}</strong>
                          {!option.available ? <Badge tone="warning">Coming soon</Badge> : null}
                        </div>
                        <p>{option.shortDescription}</p>
                        <small className="muted">{option.details}</small>
                      </button>
                    )
                  })}
                </div>
              </section>

              <section className="stack-sm agent-form-step-section agent-form-step-panel agent-step-panel-identity">
                <div className="agent-form-section-head">
                  <div>
                    <span className="section-kicker">Identity</span>
                    <h3>Name & Instructions</h3>
                  </div>
                  <p className="muted">Provide a clear purpose so your team can activate the right agent in seconds.</p>
                </div>

                <label>
                  Agent name
                  <input
                    className={`input ${errors.name ? 'input-error' : ''}`}
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="e.g. Floor A Dinner Shift Agent"
                  />
                  {errors.name ? <small className="error-text">{errors.name}</small> : null}
                </label>

                <label>
                  Description / instructions
                  <textarea
                    className="input"
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="Describe behavior, constraints, and service style for this agent"
                  />
                </label>
              </section>

              <section className="stack-sm agent-form-step-section agent-form-step-panel agent-step-panel-voice">
                <div className="agent-form-section-head">
                  <div>
                    <span className="section-kicker">Voice</span>
                    <h3>Voice Preview</h3>
                  </div>
                  <p className="muted">Configure voice language and preset, then test exactly how this agent sounds.</p>
                </div>

                <div className="grid two-col">
                  <label>
                    Speak language
                    <select
                      className="input"
                      value={voiceLanguage}
                      onChange={(event) => setVoiceLanguage(event.target.value as AgentVoiceLanguage)}
                    >
                      {GEMINI_LIVE_LANGUAGE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    Voice gender
                    <select className="input" value={voiceGender} disabled>
                      {voiceGenderOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <small className="muted">Auto-selected from the chosen voice preset.</small>
                  </label>
                </div>

                <label>
                  Voice preset
                  <select
                    className="input"
                    value={voiceName}
                    onChange={(event) => handleVoiceNameChange(event.target.value as GeminiLiveVoiceName)}
                  >
                    {GEMINI_LIVE_VOICE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="row gap-sm wrap">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      if (isPreviewLoading || isPreviewPlaying) {
                        stopVoicePreview()
                        return
                      }

                      void playVoicePreview()
                    }}
                  >
                    {isPreviewLoading ? 'Generating Voice...' : isPreviewPlaying ? 'Stop Voice Test' : 'Test Voice'}
                  </Button>
                  <span className="muted">Backend uses Gemini Live voice preview with the selected profile.</span>
                </div>

                {isPreviewLoading ? <small className="muted">Generating voice preview from Gemini Live...</small> : null}
                {voicePreviewError ? <small className="error-text">{voicePreviewError}</small> : null}
              </section>
            </div>
          </section>
        ) : null}

        {step === 2 ? (
          <section className="card stack-lg agent-form-step-card">
            <div className="agent-step-layout-grid step-two">
              <section className="stack-sm agent-form-step-section agent-form-step-panel agent-step-panel-products">
                <div className="agent-form-section-head">
                  <div>
                    <span className="section-kicker">Catalog Access</span>
                    <h3>Product scope</h3>
                  </div>
                  <p className="muted">Choose whether this agent can sell the full catalog or only a focused product set.</p>
                </div>

                <div className="grid two-col agent-access-grid">
                  <label className="selector-item">
                    <input
                      type="radio"
                      checked={productAccess === 'all'}
                      onChange={() => setProductAccess('all')}
                    />
                    <span className="agent-scope-option">
                      <strong>All Products</strong>
                      <small>Agent can take orders for the full catalog.</small>
                    </span>
                  </label>
                  <label className="selector-item">
                    <input
                      type="radio"
                      checked={productAccess === 'selected'}
                      onChange={() => setProductAccess('selected')}
                    />
                    <span className="agent-scope-option">
                      <strong>Specific Products</strong>
                      <small>Limit this agent to selected menu items only.</small>
                    </span>
                  </label>
                </div>

                <div className="agent-access-note">
                  <strong>Current access:</strong> {selectedSummary}
                </div>

                {productAccess === 'selected' ? (
                  <ProductSelector products={products} selectedIds={selectedProducts} onChange={setSelectedProducts} />
                ) : null}

                {errors.products ? <small className="error-text">{errors.products}</small> : null}
              </section>

              <section className="stack-sm agent-form-step-section agent-form-step-panel agent-step-panel-webhook">
                <div className="agent-form-section-wrap">
                  <WebhookConfigCard
                    webhookUrl={webhookUrl}
                    webhookSecret={webhookSecret}
                    status={webhookStatus}
                    onUrlChange={setWebhookUrl}
                    onSecretChange={setWebhookSecret}
                    onTest={async () => {
                      setTestingWebhook(true)
                      const status = await testWebhook(webhookUrl)
                      setWebhookStatus(status)
                      setTestingWebhook(false)
                    }}
                    isTesting={testingWebhook}
                    embedded
                  />
                  {errors.webhook ? <small className="error-text">{errors.webhook}</small> : null}
                </div>
              </section>

              {isTableOrderAgent ? (
                <section className="stack-sm agent-form-step-section agent-form-step-panel agent-step-panel-table">
                  <div className="agent-form-section-head">
                    <div>
                      <span className="section-kicker">Table Controls</span>
                      <h3>QR & table occupancy rules</h3>
                    </div>
                    <p className="muted">Generate table QR links and enforce single-active-order behavior when required.</p>
                  </div>

                  <label>
                    Default table number
                    <input
                      className={`input ${errors.tableNumber ? 'input-error' : ''}`}
                      value={defaultTableNumber}
                      onChange={(event) => setDefaultTableNumber(event.target.value)}
                      placeholder="e.g. T-12"
                    />
                    {errors.tableNumber ? <small className="error-text">{errors.tableNumber}</small> : null}
                  </label>

                  <div className="agent-inline-toggle">
                    <div>
                      <strong>Allow multiple active orders per table</strong>
                      <p className="muted">
                        If disabled, this agent blocks new orders for the same table until the current one is completed or cancelled.
                      </p>
                    </div>
                    <ToggleSwitch
                      checked={allowMultipleOrdersPerTable}
                      onChange={setAllowMultipleOrdersPerTable}
                      label={allowMultipleOrdersPerTable ? 'Enabled' : 'Disabled'}
                    />
                  </div>

                  <label>
                    Customer entry URL (embedded UI)
                    <input
                      className={`input ${errors.customerEntryUrl ? 'input-error' : ''}`}
                      value={customerEntryUrl}
                      onChange={(event) => setCustomerEntryUrl(event.target.value)}
                      placeholder="https://yourdomain.com/table-order"
                    />
                    <small className="muted">Agent ID and table number are appended automatically for QR scans.</small>
                    {errors.customerEntryUrl ? <small className="error-text">{errors.customerEntryUrl}</small> : null}
                  </label>

                  <div className={`agent-qr-shell ${qrIsPreview ? 'preview-blur-card' : ''}`}>
                    {qrTargetLink ? (
                      <>
                        <div className={`agent-qr-card-content ${qrIsPreview ? 'is-blurred' : ''}`}>
                          <img src={qrImageUrl} alt={`QR code for table ${defaultTableNumber}`} className="agent-qr-image" />
                          <div className="stack-xs">
                            <div className="split-row">
                              <strong>Table QR preview</strong>
                              <Badge tone={qrIsPreview ? 'warning' : 'success'}>
                                {qrIsPreview ? 'Preview' : 'Live'}
                              </Badge>
                            </div>
                            <span className="muted">
                              {qrIsPreview
                                ? 'Actual working link will appear after agent creation.'
                                : 'Scan to place order directly from customer mobile.'}
                            </span>
                            <code className="agent-qr-link">{qrTargetLink}</code>
                            {!qrIsPreview ? (
                              <div className="row gap-sm wrap">
                                <Button type="button" size="sm" variant="secondary" onClick={() => void copyQrLink()}>
                                  Copy link
                                </Button>
                                <Button type="button" size="sm" variant="secondary" onClick={() => void downloadQrCodePng()}>
                                  Download QR (PNG)
                                </Button>
                                <a href={qrTargetLink} target="_blank" rel="noreferrer" className="text-link">
                                  Open link
                                </a>
                              </div>
                            ) : (
                              <small className="muted">Save this agent to activate link actions and QR download.</small>
                            )}
                            {qrCopyStatus ? <small className="muted">{qrCopyStatus}</small> : null}
                            {qrDownloadStatus ? <small className="muted">{qrDownloadStatus}</small> : null}
                          </div>
                        </div>
                        {qrIsPreview ? (
                          <div className="agent-qr-preview-overlay" role="status" aria-live="polite">
                            <strong>Will be visible after agent creation</strong>
                          </div>
                        ) : null}
                      </>
                    ) : (
                      <p className="muted">
                        Enter default table number and a valid customer entry URL to generate the table QR preview.
                      </p>
                    )}
                  </div>
                </section>
              ) : null}

              <section className={`stack-sm agent-form-step-section agent-form-step-panel agent-step-panel-channel ${isTableOrderAgent ? '' : 'full'}`}>
                <div className="agent-form-section-head">
                  <div>
                    <span className="section-kicker">Channel</span>
                    <h3>Operating mode</h3>
                  </div>
                  <p className="muted">
                    {isTableOrderAgent
                      ? 'Table order taker always runs in mic mode.'
                      : 'Choose between internal operator mic flow and embeddable customer script experience.'}
                  </p>
                </div>

                {isTableOrderAgent ? (
                  <div className="agent-access-note">
                    <strong>Fixed mode:</strong> Our Agent UI (Mic-based)
                  </div>
                ) : (
                  <>
                    <div className="grid two-col agent-mode-grid">
                      <button
                        type="button"
                        className={`mode-card agent-mode-card ${mode === 'mic' ? 'active' : ''}`}
                        onClick={() => setMode('mic')}
                      >
                        <strong>Our Agent UI (Mic-based)</strong>
                        <p>Use the live mic console where an operator captures orders with AI support.</p>
                      </button>
                      <button
                        type="button"
                        className={`mode-card agent-mode-card ${mode === 'script' ? 'active' : ''}`}
                        onClick={() => setMode('script')}
                      >
                        <strong>Embedded UI (Script)</strong>
                        <p>Use a script snippet that plugs into your website or customer-facing page.</p>
                      </button>
                    </div>

                    {mode === 'script' ? (
                      <div className="agent-preview-shell">
                        <ScriptEmbedCard code={embedCode} onRegenerate={() => setEmbedCode(createSnippet())} embedded />
                      </div>
                    ) : null}
                  </>
                )}
              </section>
            </div>
          </section>
        ) : null}

        {step === 3 ? (
          <section className="card stack-sm agent-summary-panel agent-review-panel">
            <div className="agent-summary-head">
              <div>
                <span className="section-kicker">Final Review</span>
                <h3>Review & activation</h3>
              </div>
              <Badge tone={isActive ? 'success' : 'warning'}>{isActive ? 'Active' : 'Inactive'}</Badge>
            </div>

            <div className="card agent-activation-card">
              <div className="split-row">
                <div>
                  <strong>Agent activation</strong>
                  <p className="muted">Turn this on when this category should accept live orders.</p>
                </div>
                <ToggleSwitch checked={isActive} onChange={setIsActive} label={isActive ? 'On' : 'Off'} />
              </div>
            </div>

            <div className="agent-summary-grid">
              <div className="agent-summary-tile">
                <span>Category</span>
                <strong>{AGENT_TYPE_LABELS[agentType]}</strong>
              </div>
              <div className="agent-summary-tile">
                <span>Agent Name</span>
                <strong>{name || 'Pending name'}</strong>
              </div>
              <div className="agent-summary-tile">
                <span>Mode</span>
                <strong>{mode === 'mic' ? 'Our Agent UI' : 'Embedded UI'}</strong>
              </div>
              <div className="agent-summary-tile">
                <span>Voice</span>
                <strong>{voiceName} ({voiceGender})</strong>
              </div>
              <div className="agent-summary-tile">
                <span>Language</span>
                <strong>{voiceLanguage}</strong>
              </div>
              <div className="agent-summary-tile">
                <span>Product Access</span>
                <strong>{selectedSummary}</strong>
              </div>
              <div className="agent-summary-tile">
                <span>Webhook</span>
                <strong>{webhookUrl ? `Configured (${webhookStatus})` : 'Not configured'}</strong>
              </div>
              {isTableOrderAgent ? (
                <div className="agent-summary-tile">
                  <span>Table rule</span>
                  <strong>{allowMultipleOrdersPerTable ? 'Multiple active orders' : 'Single active order only'}</strong>
                </div>
              ) : null}
              {isTableOrderAgent ? (
                <div className="agent-summary-tile">
                  <span>Default Table</span>
                  <strong>{defaultTableNumber || 'Not set'}</strong>
                </div>
              ) : null}
            </div>

            <div className="agent-summary-note">
              <strong>Instructions</strong>
              <p>{description.trim() || 'No additional instructions provided.'}</p>
            </div>

            {productAccess === 'selected' ? (
              <div className="agent-summary-note">
                <strong>Selected products</strong>
                <p>{selectedProductsPreview}</p>
              </div>
            ) : null}
          </section>
        ) : null}
      </div>

      <section className="card agent-wizard-actions">
        <div className="agent-wizard-actions-row">
          <div>
            <strong>{step === 1 ? 'Identity setup' : step === 2 ? 'Setup configuration' : 'Ready to save'}</strong>
            <p className="muted">
              {step === 1
                ? 'Complete the basics, then continue.'
                : step === 2
                  ? 'Finish setup details, then continue to review.'
                  : 'Save as draft or publish this agent now.'}
            </p>
          </div>
          <div className="agent-wizard-actions-primary">
            {step === 1 && onCancel ? (
              <Button type="button" variant="ghost" onClick={onCancel}>
                Cancel
              </Button>
            ) : null}
            {step > 1 ? (
              <Button type="button" variant="ghost" onClick={handleBackStep}>
                {step === 2 ? 'Back to Step 1' : 'Back to Step 2'}
              </Button>
            ) : null}
            {step === 1 ? (
              <Button type="button" onClick={handleNextStep} disabled={loading}>
                Continue to Step 2
              </Button>
            ) : null}
            {step === 2 ? (
              <Button type="button" onClick={handleNextStep} disabled={loading}>
                Continue to Review
              </Button>
            ) : null}
            {step === 3 && onSaveDraft ? (
              <Button type="button" variant="secondary" onClick={() => void handleSaveDraft()} disabled={loading}>
                Save Draft
              </Button>
            ) : null}
            {step === 3 ? (
              <Button type="submit" disabled={loading}>
                {loading ? 'Saving...' : submitLabel}
              </Button>
            ) : null}
          </div>
        </div>
      </section>

      {selectedAgentType ? (
        <section className="card agent-category-footnote">
          <strong>{selectedAgentType.label}</strong>
          <p className="muted">{selectedAgentType.details}</p>
        </section>
      ) : null}
    </form>
  )
}
