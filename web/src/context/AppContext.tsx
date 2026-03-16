/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api, ApiClientError } from '../services/api'
import type {
  Agent,
  AgentInput,
  AgentOrderInput,
  AgentVoicePreviewInput,
  AgentVoicePreviewResult,
  AppStats,
  AppUser,
  GlobalState,
  Order,
  OrderStatus,
  ProfileSettingsInput,
  Product,
  ProductInput,
  WorkspaceSettingsInput,
  ToastMessage
} from '../types'
import { randomId } from '../utils/format'

interface AppContextValue {
  state: GlobalState
  stats: AppStats
  toasts: ToastMessage[]
  appLoading: boolean
  isBootstrapping: boolean
  shopifyModalOpen: boolean
  signupOnboardingOpen: boolean
  login: (email: string, password: string) => Promise<boolean>
  signup: (userInput: { fullName: string; businessName: string; email: string; phone?: string }, password: string) => Promise<boolean>
  logout: () => Promise<void>
  updateProfile: (payload: ProfileSettingsInput) => Promise<AppUser>
  updateWorkspace: (payload: WorkspaceSettingsInput) => Promise<AppUser>
  uploadAvatar: (file: File) => Promise<AppUser>
  uploadWorkspaceLogo: (file: File) => Promise<AppUser>
  closeSignupOnboarding: () => void
  openShopifyModal: () => void
  closeShopifyModal: () => void
  createProduct: (payload: ProductInput) => Promise<Product>
  createProductsBulk: (payload: ProductInput[]) => Promise<Product[]>
  updateProduct: (id: string, payload: ProductInput) => Promise<Product | null>
  deleteProduct: (id: string) => Promise<boolean>
  createAgent: (payload: AgentInput) => Promise<Agent>
  updateAgent: (id: string, payload: AgentInput) => Promise<Agent | null>
  deleteAgent: (id: string) => Promise<boolean>
  toggleAgent: (id: string, isActive: boolean) => Promise<void>
  testAgentVoicePreview: (payload: AgentVoicePreviewInput) => Promise<AgentVoicePreviewResult>
  testWebhook: (url: string) => Promise<'connected' | 'failed'>
  updateOrderStatus: (id: string, status: OrderStatus) => Promise<void>
  createOrderFromAgent: (payload: AgentOrderInput) => Promise<Order | null>
  registerExternalOrder: (order: Order) => void
  markChecklist: (item: keyof GlobalState['checklist']) => void
  pushToast: (toast: Omit<ToastMessage, 'id'>) => void
  dismissToast: (id: string) => void
}

const ONBOARDING_KEY = 'order-tacker-onboarding-seen'

const emptyChecklist: GlobalState['checklist'] = {
  completeProfile: false,
  addFirstProduct: false,
  createFirstAgent: false,
  configureWebhook: false,
  activateAgent: false
}

const initialState: GlobalState = {
  products: [],
  agents: [],
  orders: [],
  user: null,
  isAuthenticated: false,
  checklist: emptyChecklist,
  hasSeenSignupOnboarding: false
}

const AppContext = createContext<AppContextValue | undefined>(undefined)

const loadOnboardingSeen = (): boolean => {
  try {
    return localStorage.getItem(ONBOARDING_KEY) === 'true'
  } catch {
    return false
  }
}

const persistOnboardingSeen = (value: boolean): void => {
  try {
    localStorage.setItem(ONBOARDING_KEY, value ? 'true' : 'false')
  } catch {
    return
  }
}

const computeChecklist = (state: GlobalState): GlobalState['checklist'] => ({
  completeProfile: Boolean(state.user?.phone && state.user.businessName),
  addFirstProduct: state.products.length > 0,
  createFirstAgent: state.agents.length > 0,
  configureWebhook: state.agents.some((agent) => Boolean(agent.webhookUrl)),
  activateAgent: state.agents.some((agent) => agent.isActive)
})

const getErrorMessage = (error: unknown): string => {
  if (error instanceof ApiClientError) {
    const details = error.details
    if (details && typeof details === 'object') {
      const formErrors = Array.isArray((details as { formErrors?: unknown }).formErrors)
        ? ((details as { formErrors: unknown[] }).formErrors.filter((entry): entry is string => typeof entry === 'string'))
        : []

      if (formErrors.length > 0) {
        return formErrors[0]!
      }

      const fieldErrors = (details as { fieldErrors?: Record<string, unknown[]> }).fieldErrors
      if (fieldErrors && typeof fieldErrors === 'object') {
        for (const value of Object.values(fieldErrors)) {
          if (Array.isArray(value)) {
            const message = value.find((entry): entry is string => typeof entry === 'string')
            if (message) {
              return message
            }
          }
        }
      }
    }

    return error.message
  }
  if (error instanceof Error) return error.message
  return 'Something went wrong'
}

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<GlobalState>({
    ...initialState,
    hasSeenSignupOnboarding: loadOnboardingSeen()
  })
  const [toasts, setToasts] = useState<ToastMessage[]>([])
  const [appLoading, setAppLoading] = useState(false)
  const [isBootstrapping, setIsBootstrapping] = useState(true)
  const [shopifyModalOpen, setShopifyModalOpen] = useState(false)
  const [signupOnboardingOpen, setSignupOnboardingOpen] = useState(false)

  const pushToast = (toast: Omit<ToastMessage, 'id'>) => {
    const id = randomId('toast')
    setToasts((prev) => [...prev, { ...toast, id }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((entry) => entry.id !== id))
    }, 4200)
  }

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((entry) => entry.id !== id))
  }

  const setWithChecklist = (updater: (prev: GlobalState) => GlobalState) => {
    setState((prev) => {
      const next = updater(prev)
      return { ...next, checklist: computeChecklist(next) }
    })
  }

  const hydrateWorkspace = async () => {
    const [productData, agentData, orderData] = await Promise.all([
      api.products.list(),
      api.agents.list(),
      api.orders.list()
    ])

    return {
      products: productData.products,
      agents: agentData.agents,
      orders: orderData.orders
    }
  }

  useEffect(() => {
    let active = true

    const bootstrap = async () => {
      setIsBootstrapping(true)
      try {
        const me = await api.auth.me()
        const workspace = await hydrateWorkspace()

        if (!active) return

        setWithChecklist((prev) => ({
          ...prev,
          ...workspace,
          user: me.user,
          isAuthenticated: true
        }))
      } catch {
        if (!active) return
        setWithChecklist((prev) => ({
          ...prev,
          products: [],
          agents: [],
          orders: [],
          user: null,
          isAuthenticated: false
        }))
      } finally {
        if (active) setIsBootstrapping(false)
      }
    }

    void bootstrap()

    return () => {
      active = false
    }
  }, [])

  const login = async (email: string, password: string) => {
    setAppLoading(true)
    try {
      const result = await api.auth.login({ email, password })
      const workspace = await hydrateWorkspace()
      setWithChecklist((prev) => ({
        ...prev,
        ...workspace,
        user: result.user,
        isAuthenticated: true
      }))
      pushToast({ type: 'success', title: 'Welcome back', message: 'You are now logged in.' })
      return true
    } catch (error) {
      throw new Error(getErrorMessage(error))
    } finally {
      setAppLoading(false)
    }
  }

  const signup = async (userInput: { fullName: string; businessName: string; email: string; phone?: string }, password: string) => {
    setAppLoading(true)
    try {
      const result = await api.auth.signup({
        ...userInput,
        password
      })

      persistOnboardingSeen(false)
      setSignupOnboardingOpen(true)
      setWithChecklist((prev) => ({
        ...prev,
        user: result.user,
        isAuthenticated: true,
        products: [],
        agents: [],
        orders: [],
        hasSeenSignupOnboarding: false
      }))
      pushToast({ type: 'success', title: 'Account created', message: 'Your workspace is ready.' })
      return true
    } catch (error) {
      throw new Error(getErrorMessage(error))
    } finally {
      setAppLoading(false)
    }
  }

  const logout = async () => {
    try {
      await api.auth.logout()
    } finally {
      setSignupOnboardingOpen(false)
      persistOnboardingSeen(false)
      setWithChecklist((prev) => ({
        ...prev,
        products: [],
        agents: [],
        orders: [],
        user: null,
        isAuthenticated: false
      }))
    }
  }

  const closeSignupOnboarding = () => {
    persistOnboardingSeen(true)
    setSignupOnboardingOpen(false)
    setWithChecklist((prev) => ({ ...prev, hasSeenSignupOnboarding: true }))
  }

  const openShopifyModal = () => setShopifyModalOpen(true)
  const closeShopifyModal = () => setShopifyModalOpen(false)

  const updateProfile = async (payload: ProfileSettingsInput) => {
    setAppLoading(true)
    try {
      const { user } = await api.settings.updateProfile(payload)
      setWithChecklist((prev) => ({ ...prev, user }))
      pushToast({ type: 'success', title: 'Profile updated', message: 'Your account settings were saved.' })
      return user
    } finally {
      setAppLoading(false)
    }
  }

  const updateWorkspace = async (payload: WorkspaceSettingsInput) => {
    setAppLoading(true)
    try {
      const { user } = await api.settings.updateWorkspace(payload)
      setWithChecklist((prev) => ({ ...prev, user }))
      pushToast({ type: 'success', title: 'Workspace updated', message: 'Workspace preferences were saved.' })
      return user
    } finally {
      setAppLoading(false)
    }
  }

  const uploadAvatar = async (file: File) => {
    setAppLoading(true)
    try {
      const { user } = await api.auth.uploadAvatar(file)
      setWithChecklist((prev) => ({ ...prev, user }))
      pushToast({ type: 'success', title: 'Avatar updated', message: 'Your profile image was uploaded.' })
      return user
    } finally {
      setAppLoading(false)
    }
  }

  const uploadWorkspaceLogo = async (file: File) => {
    setAppLoading(true)
    try {
      const { user } = await api.auth.uploadWorkspaceLogo(file)
      setWithChecklist((prev) => ({ ...prev, user }))
      pushToast({ type: 'success', title: 'Logo updated', message: 'Your workspace logo was uploaded.' })
      return user
    } finally {
      setAppLoading(false)
    }
  }

  const createProduct = async (payload: ProductInput) => {
    setAppLoading(true)
    try {
      const { product } = await api.products.create(payload)
      setWithChecklist((prev) => ({ ...prev, products: [product, ...prev.products] }))
      pushToast({ type: 'success', title: 'Product created', message: `${payload.name} is now available.` })
      return product
    } finally {
      setAppLoading(false)
    }
  }

  const createProductsBulk = async (payload: ProductInput[]) => {
    setAppLoading(true)
    try {
      const { products } = await api.products.bulkCreate({ products: payload })
      setWithChecklist((prev) => ({ ...prev, products: [...products, ...prev.products] }))
      pushToast({
        type: 'success',
        title: 'Products uploaded',
        message: `${products.length} product${products.length === 1 ? '' : 's'} added to your catalog.`
      })
      return products
    } finally {
      setAppLoading(false)
    }
  }

  const updateProduct = async (id: string, payload: ProductInput) => {
    setAppLoading(true)
    try {
      const { product } = await api.products.update(id, payload)
      setWithChecklist((prev) => ({
        ...prev,
        products: prev.products.map((entry) => (entry.id === id ? product : entry))
      }))
      pushToast({ type: 'success', title: 'Saved', message: 'Product changes were saved.' })
      return product
    } finally {
      setAppLoading(false)
    }
  }

  const deleteProduct = async (id: string) => {
    setAppLoading(true)
    try {
      await api.products.remove(id)
      setWithChecklist((prev) => ({
        ...prev,
        products: prev.products.filter((product) => product.id !== id),
        agents: prev.agents.map((agent) => ({
          ...agent,
          productIds: agent.productIds.filter((productId) => productId !== id)
        }))
      }))
      pushToast({ type: 'success', title: 'Deleted', message: 'Product was removed.' })
      return true
    } finally {
      setAppLoading(false)
    }
  }

  const createAgent = async (payload: AgentInput) => {
    setAppLoading(true)
    try {
      const { agent } = await api.agents.create(payload)
      setWithChecklist((prev) => ({ ...prev, agents: [agent, ...prev.agents] }))
      pushToast({ type: 'success', title: 'Agent created', message: `${agent.name} is ready.` })
      return agent
    } finally {
      setAppLoading(false)
    }
  }

  const updateAgent = async (id: string, payload: AgentInput) => {
    setAppLoading(true)
    try {
      const { agent } = await api.agents.update(id, payload)
      setWithChecklist((prev) => ({
        ...prev,
        agents: prev.agents.map((entry) => (entry.id === id ? agent : entry))
      }))
      pushToast({ type: 'success', title: 'Agent updated', message: 'Configuration was saved.' })
      return agent
    } finally {
      setAppLoading(false)
    }
  }

  const deleteAgent = async (id: string) => {
    setAppLoading(true)
    try {
      await api.agents.remove(id)
      setWithChecklist((prev) => ({
        ...prev,
        agents: prev.agents.filter((agent) => agent.id !== id)
      }))
      pushToast({ type: 'success', title: 'Deleted', message: 'Agent was removed.' })
      return true
    } finally {
      setAppLoading(false)
    }
  }

  const toggleAgent = async (id: string, isActive: boolean) => {
    const { agent } = await api.agents.toggle(id, isActive)
    setWithChecklist((prev) => ({
      ...prev,
      agents: prev.agents.map((entry) => (entry.id === id ? agent : entry))
    }))
    pushToast({
      type: 'success',
      title: isActive ? 'Agent activated' : 'Agent paused',
      message: isActive ? 'Orders will be captured by this agent.' : 'This agent will not capture new orders.'
    })
  }

  const testWebhook = async (url: string) => {
    if (!url) {
      pushToast({
        type: 'error',
        title: 'Webhook URL required',
        message: 'Enter a URL before testing webhook delivery.'
      })
      return 'failed'
    }

    try {
      const result = await api.agents.testWebhook(url)
      pushToast({
        type: result.status === 'connected' ? 'success' : 'error',
        title: result.status === 'connected' ? 'Webhook Connected' : 'Webhook Failed',
        message:
          result.status === 'connected'
            ? 'Test order notification delivered successfully.'
            : 'Unable to deliver test notification. Try again later.'
      })
      return result.status
    } catch {
      pushToast({
        type: 'error',
        title: 'Webhook Failed',
        message: 'Unable to deliver test notification. Try again later.'
      })
      return 'failed'
    }
  }

  const testAgentVoicePreview = async (payload: AgentVoicePreviewInput) => {
    try {
      return await api.agents.testVoicePreview(payload)
    } catch (error) {
      throw new Error(getErrorMessage(error))
    }
  }

  const updateOrderStatus = async (id: string, status: OrderStatus) => {
    const { order } = await api.orders.updateStatus(id, status)
    setState((prev) => ({
      ...prev,
      orders: prev.orders.map((entry) => (entry.id === id ? order : entry))
    }))
    pushToast({ type: 'success', title: 'Order updated', message: `Status is now ${status}.` })
  }

  const createOrderFromAgent = async (payload: AgentOrderInput) => {
    try {
      const { order } = await api.orders.create({
        ...payload,
        customerPhone: payload.customerPhone?.trim() ? payload.customerPhone.trim() : undefined,
        customerEmail: payload.customerEmail?.trim() ? payload.customerEmail.trim() : undefined,
        notes: payload.notes?.trim() ? payload.notes.trim() : undefined,
        source: payload.source ?? 'mic'
      })
      setWithChecklist((prev) => ({
        ...prev,
        orders: [order, ...prev.orders],
        agents: prev.agents.map((agent) =>
          agent.id === payload.agentId
            ? {
                ...agent,
                ordersHandled: agent.ordersHandled + 1,
                lastActivity: order.createdAt,
                isActive: true
              }
            : agent
        )
      }))
      pushToast({
        type: 'success',
        title: 'Order captured',
        message: `${order.id} created by the live agent.`
      })
      return order
    } catch (error) {
      pushToast({
        type: 'error',
        title: 'Order failed',
        message: getErrorMessage(error)
      })
      return null
    }
  }

  const registerExternalOrder = (order: Order) => {
    setWithChecklist((prev) => ({
      ...prev,
      orders: prev.orders.some((entry) => entry.id === order.id) ? prev.orders : [order, ...prev.orders],
      agents: prev.agents.map((agent) =>
        agent.id === order.agentId
          ? {
              ...agent,
              ordersHandled: agent.ordersHandled + (prev.orders.some((entry) => entry.id === order.id) ? 0 : 1),
              lastActivity: order.createdAt,
              isActive: true
            }
          : agent
      )
    }))
    pushToast({
      type: 'success',
      title: 'Order captured',
      message: `${order.id} created from the live conversation.`
    })
  }

  const markChecklist = (item: keyof GlobalState['checklist']) => {
    setState((prev) => ({ ...prev, checklist: { ...prev.checklist, [item]: true } }))
  }

  const stats = useMemo<AppStats>(() => {
    const today = new Date().toDateString()
    return {
      totalProducts: state.products.length,
      activeAgents: state.agents.filter((agent) => agent.isActive).length,
      ordersToday: state.orders.filter((order) => new Date(order.createdAt).toDateString() === today).length,
      totalOrders: state.orders.length
    }
  }, [state.orders, state.products, state.agents])

  const value = {
    state,
    stats,
    toasts,
    appLoading,
    isBootstrapping,
    shopifyModalOpen,
    signupOnboardingOpen,
    login,
    signup,
    logout,
    updateProfile,
    updateWorkspace,
    uploadAvatar,
    uploadWorkspaceLogo,
    closeSignupOnboarding,
    openShopifyModal,
    closeShopifyModal,
    createProduct,
    createProductsBulk,
    updateProduct,
    deleteProduct,
    createAgent,
    updateAgent,
    deleteAgent,
    toggleAgent,
    testAgentVoicePreview,
    testWebhook,
    updateOrderStatus,
    createOrderFromAgent,
    registerExternalOrder,
    markChecklist,
    pushToast,
    dismissToast
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export const useApp = () => {
  const context = useContext(AppContext)
  if (!context) throw new Error('useApp must be used inside AppProvider')
  return context
}

export const useOrderById = (orderId?: string): Order | undefined => {
  const {
    state: { orders }
  } = useApp()
  return orders.find((order) => order.id === orderId)
}
