import type {
  Agent,
  AgentInput,
  AgentVoicePreviewInput,
  AgentVoicePreviewResult,
  AgentLiveOrderInput,
  AgentLiveSession,
  AgentConversationOrderResult,
  AgentConversationOrderInput,
  AgentOrderInput,
  AuditExportJob,
  AuditLogListParams,
  AuditLogEntry,
  OrganizationUser,
  OrganizationUserInput,
  AppUser,
  GeoCacheMetricsCurrent,
  GeoCacheMetricSnapshot,
  Order,
  OrderStatus,
  ProfileSettingsInput,
  PublicTableLiveSession,
  PublicTableOrderInput,
  PublicTableOrderSession,
  Product,
  ProductInput,
  SavedAuditFilter,
  WorkspaceSettingsInput,
  UserSession
} from '../types'

interface ProductListParams {
  page?: number
  limit?: number
  q?: string
  category?: string
  status?: 'draft' | 'published' | 'archived'
  sort?: 'newest' | 'oldest' | 'price' | 'name'
}

interface ProductListResult {
  products: Product[]
  page?: number
  limit?: number
  total?: number
  totalPages?: number
}

interface OrderListParams {
  page?: number
  limit?: number
  q?: string
  status?: 'new' | 'confirmed' | 'processing' | 'completed' | 'cancelled'
  source?: 'mic' | 'script' | 'human' | 'webhook'
  agentId?: string
  sort?: 'newest' | 'oldest'
}

interface OrderListResult {
  orders: Order[]
  page?: number
  limit?: number
  total?: number
  totalPages?: number
}

interface ApiEnvelope<T> {
  success: boolean
  message: string
  data: T
}

class ApiClientError extends Error {
  readonly statusCode: number
  readonly code?: string
  readonly details?: unknown

  constructor(message: string, statusCode: number, details?: unknown, code?: string) {
    super(message)
    this.name = 'ApiClientError'
    this.statusCode = statusCode
    this.code = code
    this.details = details
  }
}

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:4000/api/v1'
const CSRF_COOKIE = 'ot_csrf'
let csrfTokenCache: string | null = null

const getCookie = (name: string): string | undefined => {
  const value = document.cookie
    .split('; ')
    .find((entry) => entry.startsWith(`${name}=`))
    ?.split('=')
    .slice(1)
    .join('=')

  return value ? decodeURIComponent(value) : undefined
}

const shouldAttachCsrf = (method: string) => !['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase())

const resolveCsrfToken = (): string | undefined => getCookie(CSRF_COOKIE) ?? csrfTokenCache ?? undefined

const captureCsrfTokenFromPayload = (payload: unknown): void => {
  if (!payload || typeof payload !== 'object') {
    return
  }

  const data = (payload as { data?: unknown }).data
  if (!data || typeof data !== 'object') {
    return
  }

  const csrfToken = (data as { csrfToken?: unknown }).csrfToken
  if (typeof csrfToken === 'string' && csrfToken.trim().length > 0) {
    csrfTokenCache = csrfToken
    return
  }

  if (csrfToken === null) {
    csrfTokenCache = null
  }
}

const toQueryString = (params: Record<string, string | number | undefined>) => {
  const search = new URLSearchParams()

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') {
      search.set(key, String(value))
    }
  })

  return search.toString()
}

const request = async <T>(
  path: string,
  options: RequestInit = {},
  retryOnUnauthorized = true
): Promise<T> => {
  const method = options.method ?? 'GET'
  const headers = new Headers(options.headers)
  headers.set('Accept', 'application/json')

  if (!(options.body instanceof FormData) && options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  if (shouldAttachCsrf(method)) {
    const csrfToken = resolveCsrfToken()
    if (csrfToken) {
      headers.set('X-CSRF-Token', csrfToken)
    }
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
    credentials: 'include'
  })

  if (response.status === 401 && retryOnUnauthorized && !path.startsWith('/auth/')) {
    try {
      await request('/auth/refresh', { method: 'POST' }, false)
      return request<T>(path, options, false)
    } catch {
      throw new ApiClientError('Your session has expired. Please log in again.', 401, undefined, 'UNAUTHORIZED')
    }
  }

  const contentType = response.headers.get('content-type') ?? ''
  const payload = contentType.includes('application/json')
    ? ((await response.json()) as Partial<ApiEnvelope<T>> & { code?: string; details?: unknown; message?: string })
    : null
  captureCsrfTokenFromPayload(payload)

  if (!response.ok) {
    throw new ApiClientError(payload?.message ?? 'Request failed', response.status, payload?.details, payload?.code)
  }

  return (payload as ApiEnvelope<T>).data
}

export const api = {
  auth: {
    signup: (payload: {
      fullName: string
      businessName: string
      email: string
      password: string
      phone?: string
    }) => request<{ user: AppUser }>('/auth/signup', { method: 'POST', body: JSON.stringify(payload) }),
    login: (payload: { email: string; password: string }) =>
      request<{ user: AppUser }>('/auth/login', { method: 'POST', body: JSON.stringify(payload) }),
    me: () => request<{ user: AppUser; csrfToken: string | null }>('/auth/me'),
    refresh: () => request<{ user: AppUser }>('/auth/refresh', { method: 'POST' }),
    logout: async () => {
      const result = await request<null>('/auth/logout', { method: 'POST' })
      csrfTokenCache = null
      return result
    },
    listSessions: () => request<{ sessions: UserSession[] }>('/auth/sessions'),
    updateSessionName: (sessionId: string, sessionName?: string) =>
      request<{ id: string; sessionName: string | null }>(`/auth/sessions/${sessionId}`, {
        method: 'PATCH',
        body: JSON.stringify({ sessionName })
      }),
    revokeSession: (sessionId: string) => request<{ sessionId: string }>(`/auth/sessions/${sessionId}`, { method: 'DELETE' }),
    revokeOtherSessions: () => request<{ revokedCount: number }>('/auth/sessions/revoke-others', { method: 'POST' }),
    listOrganizationUsers: () => request<{ users: OrganizationUser[] }>('/auth/organization/users'),
    createOrganizationUser: (payload: OrganizationUserInput) =>
      request<{ user: OrganizationUser }>('/auth/organization/users', { method: 'POST', body: JSON.stringify(payload) }),
    uploadAvatar: (file: File) => {
      const formData = new FormData()
      formData.append('file', file)
      return request<{ user: AppUser }>('/settings/profile/avatar', { method: 'POST', body: formData })
    },
    uploadWorkspaceLogo: (file: File) => {
      const formData = new FormData()
      formData.append('file', file)
      return request<{ user: AppUser }>('/settings/workspace/logo', { method: 'POST', body: formData })
    }
  },
  settings: {
    updateProfile: (payload: ProfileSettingsInput) =>
      request<{ user: AppUser }>('/settings/profile', { method: 'PATCH', body: JSON.stringify(payload) }),
    updateWorkspace: (payload: WorkspaceSettingsInput) =>
      request<{ user: AppUser }>('/settings/workspace', { method: 'PATCH', body: JSON.stringify(payload) })
  },
  products: {
    list: (params: ProductListParams = {}) => {
      const query = toQueryString({
        page: params.page,
        limit: params.limit,
        q: params.q,
        category: params.category,
        status: params.status,
        sort: params.sort
      })

      return request<ProductListResult>(`/products${query ? `?${query}` : ''}`)
    },
    getById: (id: string) => request<{ product: Product }>(`/products/${id}`),
    create: (payload: ProductInput) =>
      request<{ product: Product }>('/products', { method: 'POST', body: JSON.stringify(payload) }),
    bulkCreate: (payload: { products: ProductInput[] }) =>
      request<{ products: Product[] }>('/products/bulk', { method: 'POST', body: JSON.stringify(payload) }),
    update: (id: string, payload: ProductInput) =>
      request<{ product: Product }>(`/products/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
    remove: (id: string) => request<null>(`/products/${id}`, { method: 'DELETE' })
  },
  agents: {
    list: () => request<{ agents: Agent[] }>('/agents'),
    getById: (id: string) => request<{ agent: Agent }>(`/agents/${id}`),
    create: (payload: AgentInput) =>
      request<{ agent: Agent }>('/agents', { method: 'POST', body: JSON.stringify(payload) }),
    update: (id: string, payload: AgentInput) =>
      request<{ agent: Agent }>(`/agents/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
    toggle: (id: string, isActive: boolean) =>
      request<{ agent: Agent }>(`/agents/${id}/toggle`, { method: 'PATCH', body: JSON.stringify({ isActive }) }),
    createLiveSession: (id: string, source: 'mic' | 'script') =>
      request<AgentLiveSession>(`/agents/${id}/live/session`, { method: 'POST', body: JSON.stringify({ source }) }),
    createLiveOrder: (id: string, payload: AgentLiveOrderInput) =>
      request<{ order: Order }>(`/agents/${id}/live/orders`, { method: 'POST', body: JSON.stringify(payload) }),
    createConversationOrder: (id: string, payload: AgentConversationOrderInput) =>
      request<AgentConversationOrderResult>(`/agents/${id}/live/conversation-order`, {
        method: 'POST',
        body: JSON.stringify(payload)
      }),
    testVoicePreview: (payload: AgentVoicePreviewInput) =>
      request<AgentVoicePreviewResult>('/agents/live/voice-preview', {
        method: 'POST',
        body: JSON.stringify(payload)
      }),
    testWebhook: (url: string) =>
      request<{ status: 'connected' | 'failed'; url: string }>('/agents/webhook/test', {
        method: 'POST',
        body: JSON.stringify({ url })
      }),
    getPublicTableOrderSession: (id: string, table?: string) => {
      const search = new URLSearchParams()
      if (table) {
        search.set('table', table)
      }

      const query = search.toString()
      return request<PublicTableOrderSession>(`/agents/public/${id}/table-order${query ? `?${query}` : ''}`)
    },
    createPublicLiveSession: (id: string, payload: { source: 'mic' | 'script'; tableNumber?: string }, table?: string) => {
      const search = new URLSearchParams()
      if (table) {
        search.set('table', table)
      }

      const query = search.toString()
      return request<PublicTableLiveSession>(`/agents/public/${id}/live/session${query ? `?${query}` : ''}`, {
        method: 'POST',
        body: JSON.stringify(payload)
      })
    },
    createPublicConversationOrder: (id: string, payload: AgentConversationOrderInput, table?: string) => {
      const search = new URLSearchParams()
      if (table) {
        search.set('table', table)
      }

      const query = search.toString()
      return request<AgentConversationOrderResult>(`/agents/public/${id}/live/conversation-order${query ? `?${query}` : ''}`, {
        method: 'POST',
        body: JSON.stringify(payload)
      })
    },
    createPublicTableOrder: (id: string, payload: PublicTableOrderInput) =>
      request<{ order: Order; table: { number: string } }>(`/agents/public/${id}/table-order`, {
        method: 'POST',
        body: JSON.stringify(payload)
      }),
    remove: (id: string) => request<null>(`/agents/${id}`, { method: 'DELETE' })
  },
  orders: {
    list: (params: OrderListParams = {}) => {
      const query = toQueryString({
        page: params.page,
        limit: params.limit,
        q: params.q,
        status: params.status,
        source: params.source,
        agentId: params.agentId,
        sort: params.sort
      })

      return request<OrderListResult>(`/orders${query ? `?${query}` : ''}`)
    },
    getById: (id: string) => request<{ order: Order }>(`/orders/${id}`),
    create: (payload: AgentOrderInput | Omit<AgentOrderInput, 'agentId'> & { source: Order['source'] }) =>
      request<{ order: Order }>('/orders', { method: 'POST', body: JSON.stringify(payload) }),
    updateStatus: (id: string, status: OrderStatus) =>
      request<{ order: Order }>(`/orders/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) })
  },
  audit: {
    listRecent: (params: AuditLogListParams = {}) => {
      const searchParams = new URLSearchParams()
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== '') {
          searchParams.set(key, String(value))
        }
      })

      return request<{
        logs: AuditLogEntry[]
        page: number
        limit: number
        total: number
        totalPages: number
      }>(`/audit-logs?${searchParams.toString()}`)
    },
    listSavedFilters: () => request<{ filters: SavedAuditFilter[] }>('/audit-logs/filters'),
    createSavedFilter: (payload: { name: string; filters: AuditLogListParams }) =>
      request<{ filter: SavedAuditFilter }>('/audit-logs/filters', { method: 'POST', body: JSON.stringify(payload) }),
    deleteSavedFilter: (id: string) => request<{ filterId: string }>(`/audit-logs/filters/${id}`, { method: 'DELETE' }),
    listExportJobs: () => request<{ jobs: AuditExportJob[] }>('/audit-logs/export-jobs'),
    createExportJob: (payload: { format: 'csv' | 'json'; filters: AuditLogListParams }) =>
      request<{ job: AuditExportJob }>('/audit-logs/export-jobs', { method: 'POST', body: JSON.stringify(payload) }),
    getExportJob: (id: string) => request<{ job: AuditExportJob }>(`/audit-logs/export-jobs/${id}`),
    getGeoCacheMetrics: () =>
      request<{ current: GeoCacheMetricsCurrent; recent: GeoCacheMetricSnapshot[] }>('/audit-logs/geo-cache-metrics'),
    exportLogs: async (params: AuditLogListParams = {}, format: 'csv' | 'json' = 'json') => {
      const searchParams = new URLSearchParams()
      Object.entries({ ...params, format }).forEach(([key, value]) => {
        if (value !== undefined && value !== '') {
          searchParams.set(key, String(value))
        }
      })

      const response = await fetch(`${API_BASE_URL}/audit-logs/export?${searchParams.toString()}`, {
        credentials: 'include',
        headers: {
          Accept: format === 'csv' ? 'text/csv' : 'application/json'
        }
      })

      if (!response.ok) {
        let payload:
          | (Partial<ApiEnvelope<unknown>> & { code?: string; details?: unknown; message?: string })
          | null = null

        const contentType = response.headers.get('content-type') ?? ''
        if (contentType.includes('application/json')) {
          payload = (await response.json()) as Partial<ApiEnvelope<unknown>> & {
            code?: string
            details?: unknown
            message?: string
          }
        }

        throw new ApiClientError(payload?.message ?? 'Unable to export audit logs', response.status, payload?.details, payload?.code)
      }

      const disposition = response.headers.get('content-disposition') ?? ''
      const filenameMatch = disposition.match(/filename="([^"]+)"/)

      return {
        blob: await response.blob(),
        filename: filenameMatch?.[1] ?? `audit-logs.${format}`
      }
    }
  }
}

export { ApiClientError }
