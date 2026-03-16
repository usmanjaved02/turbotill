import type { GeminiLiveLanguageCode, GeminiLiveVoiceName } from '../constants/geminiLiveVoiceOptions'

export type ProductStatus = 'draft' | 'published' | 'archived'
export type UserRole = 'owner' | 'admin' | 'manager' | 'viewer'
export type CurrencyCode = 'USD' | 'EUR' | 'GBP'

export interface Product {
  id: string
  name: string
  sku: string
  category: string
  description: string
  price: number
  currency: CurrencyCode
  discount?: number
  status: ProductStatus
  createdAt: string
  image?: string
}

export type AgentMode = 'mic' | 'script'
export type AgentType = 'terminal' | 'table_order_taker' | 'whatsapp_call_attendant'
export type AgentVoiceLanguage = GeminiLiveLanguageCode
export type AgentVoiceGender = 'female' | 'male' | 'neutral'

export interface AgentVoiceProfile {
  languageCode: AgentVoiceLanguage
  gender: AgentVoiceGender
  voiceName: GeminiLiveVoiceName
}

export interface AgentVoicePreviewInput {
  text?: string
  voiceProfile: AgentVoiceProfile
}

export interface AgentVoicePreviewResult {
  model: string
  audioBase64: string
  mimeType: string
  voiceProfile: AgentVoiceProfile
}

export interface AgentTableConfig {
  allowMultipleOrdersPerTable: boolean
  defaultTableNumber?: string
  customerEntryUrl?: string
}

export interface Agent {
  id: string
  name: string
  agentType: AgentType
  description?: string
  productAccess: 'all' | 'selected'
  productIds: string[]
  webhookUrl?: string
  webhookSecret?: string
  webhookStatus: 'connected' | 'failed' | 'not_configured'
  mode: AgentMode
  tableConfig?: AgentTableConfig
  voiceProfile: AgentVoiceProfile
  isActive: boolean
  ordersHandled: number
  lastActivity: string
  embedCode: string
  createdAt: string
}

export type OrderStatus = 'new' | 'confirmed' | 'processing' | 'completed' | 'cancelled'
export type OrderSource = 'mic' | 'script' | 'human' | 'webhook'

export interface OrderItem {
  productId: string
  productName: string
  quantity: number
  unitPrice: number
}

export interface Order {
  id: string
  orderName: string
  customerName: string
  customerPhone: string
  customerEmail: string
  tableNumber?: string
  items: OrderItem[]
  totalAmount: number
  agentId?: string
  agentName?: string
  source: OrderSource
  status: OrderStatus
  notes?: string
  webhookDelivered: boolean
  createdAt: string
  timeline: { label: string; at: string }[]
}

export interface AppUser {
  id: string
  fullName: string
  businessName: string
  orderPrefix?: string
  email: string
  phone?: string
  role: UserRole
  avatarUrl?: string
  businessLogo?: string
  defaultCurrency: CurrencyCode
  timezone: string
  notificationPreferences: {
    emailAlerts: boolean
    smsAlerts: boolean
  }
}

export interface UserSession {
  id: string
  sessionName: string | null
  userAgent: string
  deviceLabel: string
  browser: string
  operatingSystem: string
  deviceType: 'desktop' | 'mobile' | 'tablet' | 'bot' | 'unknown'
  ipAddress: string
  locationLabel: string | null
  locationCity: string | null
  locationRegion: string | null
  locationCountry: string | null
  locationTimezone: string | null
  geoSource: string | null
  lastUsedAt: string
  createdAt: string
  expiresAt: string
  isCurrent: boolean
  isRevoked: boolean
  revokedReason: 'logout' | 'session_revoked' | 'family_revoked' | 'reuse_detected' | null
}

export interface OrganizationUser {
  id: string
  fullName: string
  email: string
  phone?: string
  role: UserRole
  createdAt: string
  lastLoginAt?: string
}

export interface OrganizationUserInput {
  fullName: string
  email: string
  password: string
  role: 'admin' | 'manager' | 'viewer'
  phone?: string
}

export interface AuditLogEntry {
  id: string
  actorId: string | null
  actorEmail: string | null
  actorRole: UserRole | null
  action: string
  entityType: string
  entityId: string | null
  metadata: Record<string, unknown> | null
  ipAddress: string | null
  userAgent: string | null
  createdAt: string
}

export interface AppStats {
  totalProducts: number
  activeAgents: number
  ordersToday: number
  totalOrders: number
}

export interface ChecklistState {
  completeProfile: boolean
  addFirstProduct: boolean
  createFirstAgent: boolean
  configureWebhook: boolean
  activateAgent: boolean
}

export interface ToastMessage {
  id: string
  type: 'success' | 'error'
  title: string
  message: string
}

export interface GlobalState {
  products: Product[]
  agents: Agent[]
  orders: Order[]
  user: AppUser | null
  isAuthenticated: boolean
  checklist: ChecklistState
  hasSeenSignupOnboarding: boolean
}

export interface ProductInput {
  name: string
  sku: string
  category: string
  description: string
  price: number
  currency: CurrencyCode
  discount?: number
  status: ProductStatus
  image?: string
}

export interface AgentInput {
  name: string
  agentType: AgentType
  description?: string
  productAccess: 'all' | 'selected'
  productIds: string[]
  webhookUrl?: string
  webhookSecret?: string
  mode: AgentMode
  tableConfig?: AgentTableConfig
  voiceProfile: AgentVoiceProfile
  isActive: boolean
}

export interface AgentOrderInput {
  agentId: string
  customerName: string
  customerPhone?: string
  customerEmail?: string
  tableNumber?: string
  items: { productId: string; quantity: number }[]
  notes?: string
  source?: 'mic' | 'script'
}

export interface AgentLiveSession {
  token: string
  model: string
  expiresAt: string
  source: 'mic' | 'script'
  toolName: string
  products: Array<{
    id: string
    name: string
    sku: string
    category: string
    price: number
    currency: CurrencyCode
  }>
}

export interface AgentLiveOrderInput {
  customerName: string
  customerPhone?: string
  customerEmail?: string
  tableNumber?: string
  items: Array<{ productLabel: string; quantity: number }>
  notes?: string
  source: 'mic' | 'script'
}

export interface LiveConversationEntry {
  speaker: 'customer' | 'agent'
  text: string
}

export interface AgentConversationOrderResult {
  analysisSource: 'ai' | 'heuristic'
  readyToPlace: boolean
  hasCustomerName?: boolean
  hasItems?: boolean
  hasConfirmation?: boolean
  reason: string
  ask?: string
  order?: Order
}

export interface AgentConversationOrderInput {
  source: 'mic' | 'script'
  tableNumber?: string
  conversation: LiveConversationEntry[]
  hints?: {
    customerName?: string
    tableNumber?: string
  }
}

export interface PublicTableOrderMenuItem {
  id: string
  name: string
  sku: string
  category: string
  price: number
  currency: CurrencyCode
  description: string
}

export interface PublicTableOrderSession {
  brand: {
    companyName: string
    companyLogo?: string
  }
  agent: {
    id: string
    name: string
    description?: string
  }
  table: {
    number: string
    allowMultipleOrdersPerTable: boolean
    isAvailable: boolean
  }
  menu: PublicTableOrderMenuItem[]
}

export interface PublicTableLiveSession extends AgentLiveSession {
  brand: {
    companyName: string
    companyLogo?: string
  }
  table: {
    number: string
    allowMultipleOrdersPerTable: boolean
    isAvailable: boolean
  }
}

export interface PublicTableOrderInput {
  tableNumber?: string
  customerName: string
  customerPhone?: string
  customerEmail?: string
  notes?: string
  items: Array<{ productId: string; quantity: number }>
}

export interface ProfileSettingsInput {
  fullName: string
  businessName: string
  email: string
  phone?: string
  currentPassword?: string
  newPassword?: string
}

export interface WorkspaceSettingsInput {
  businessName: string
  businessLogo?: string
  defaultCurrency: CurrencyCode
  timezone: string
  notificationPreferences: {
    emailAlerts: boolean
    smsAlerts: boolean
  }
}

export interface AuditLogListParams {
  page?: number
  limit?: number
  action?: string
  entityType?: string
  actorEmail?: string
  search?: string
  from?: string
  to?: string
}

export interface SavedAuditFilter {
  id: string
  name: string
  filters: AuditLogListParams & { limit?: number }
  createdAt?: string
  updatedAt?: string
}

export interface AuditExportJob {
  id: string
  format: 'csv' | 'json'
  status: 'pending' | 'processing' | 'completed' | 'failed'
  filters: AuditLogListParams & { limit?: number }
  totalRows: number
  filename: string | null
  fileUrl: string | null
  contentType: string | null
  errorMessage: string | null
  startedAt: string | null
  completedAt: string | null
  createdAt: string
  expiresAt: string
}

export interface GeoCacheMetricsCurrent {
  periodStartedAt: string
  totalRequests: number
  cacheHits: number
  cacheMisses: number
  privateRequests: number
  pendingLookups: number
  unavailableLookups: number
  remoteLookupsCompleted: number
  remoteLookupFailures: number
  cacheDocuments: number
  hitRate: number
}

export interface GeoCacheMetricSnapshot {
  id: string
  periodStartedAt: string
  periodEndedAt: string
  totalRequests: number
  cacheHits: number
  cacheMisses: number
  privateRequests: number
  pendingLookups: number
  unavailableLookups: number
  remoteLookupsCompleted: number
  remoteLookupFailures: number
  expiredEntriesRemoved: number
  cacheDocuments: number
  hitRate: number
  createdAt: string
}
