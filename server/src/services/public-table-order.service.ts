import mongoose from 'mongoose'
import { ApiError } from '../helpers/ApiError.js'
import { AgentModel } from '../models/Agent.js'
import { OrderModel } from '../models/Order.js'
import { ProductModel } from '../models/Product.js'
import { UserModel } from '../models/User.js'
import { geminiLiveService } from './gemini-live.service.js'
import { orderService } from './order.service.js'

const ACTIVE_TABLE_ORDER_STATUSES = ['new', 'confirmed', 'processing'] as const

const assertTableOrderAgentIsAvailable = async (agentId: string) => {
  const agent = await AgentModel.findById(agentId).lean()

  if (!agent) {
    throw new ApiError(404, 'Table ordering link is invalid', 'TABLE_AGENT_NOT_FOUND')
  }

  if (agent.agentType !== 'table_order_taker') {
    throw new ApiError(404, 'This link is not configured for table ordering', 'TABLE_AGENT_TYPE_MISMATCH')
  }

  if (!agent.isActive) {
    throw new ApiError(409, 'This table ordering agent is currently unavailable', 'TABLE_AGENT_INACTIVE')
  }

  if (!agent.ownerId) {
    throw new ApiError(500, 'Agent owner is missing for table ordering', 'TABLE_AGENT_OWNER_MISSING')
  }

  return agent
}

const resolveTableNumber = (agent: any, requestedTable?: string) => {
  const normalizedRequestedTable = typeof requestedTable === 'string' && requestedTable.trim().length > 0
    ? requestedTable.trim()
    : undefined

  const defaultTableNumber =
    typeof agent.tableConfig?.defaultTableNumber === 'string' && agent.tableConfig.defaultTableNumber.trim().length > 0
      ? agent.tableConfig.defaultTableNumber.trim()
      : undefined

  const tableNumber = normalizedRequestedTable ?? defaultTableNumber

  if (!tableNumber) {
    throw new ApiError(400, 'Table number is required for this link', 'TABLE_NUMBER_REQUIRED')
  }

  return tableNumber
}

const checkTableAvailability = async (agent: any, tableNumber: string) => {
  const allowMultipleOrdersPerTable = agent.tableConfig?.allowMultipleOrdersPerTable !== false

  if (allowMultipleOrdersPerTable) {
    return {
      allowMultipleOrdersPerTable,
      isAvailable: true
    }
  }

  const hasActiveOrder = await OrderModel.exists({
    ownerId: agent.ownerId,
    agentId: agent._id,
    tableNumber,
    status: { $in: ACTIVE_TABLE_ORDER_STATUSES }
  })

  return {
    allowMultipleOrdersPerTable,
    isAvailable: !hasActiveOrder
  }
}

const getOwnerBranding = async (ownerId: string) => {
  const owner = await UserModel.findById(ownerId).select({ businessName: 1, businessLogo: 1 }).lean()

  return {
    companyName: owner?.businessName || 'Turbo Till',
    companyLogo: owner?.businessLogo || ''
  }
}

export const publicTableOrderService = {
  getLiveContext: async (agentId: string, requestedTable?: string) => {
    const agent = await assertTableOrderAgentIsAvailable(agentId)
    if (!agent.ownerId) {
      throw new ApiError(500, 'Agent owner is missing for table ordering', 'TABLE_AGENT_OWNER_MISSING')
    }
    const ownerId = agent.ownerId.toString()
    const tableNumber = resolveTableNumber(agent, requestedTable)
    const tableState = await checkTableAvailability(agent, tableNumber)
    const branding = await getOwnerBranding(ownerId)

    return {
      agent,
      ownerId,
      table: {
        number: tableNumber,
        allowMultipleOrdersPerTable: tableState.allowMultipleOrdersPerTable,
        isAvailable: tableState.isAvailable
      },
      branding
    }
  },

  getSession: async (agentId: string, requestedTable?: string) => {
    const context = await publicTableOrderService.getLiveContext(agentId, requestedTable)

    const productFilter =
      context.agent.productAccess === 'all'
        ? { ownerId: context.agent.ownerId, status: { $ne: 'archived' } }
        : { ownerId: context.agent.ownerId, _id: { $in: context.agent.productIds }, status: { $ne: 'archived' } }

    const products = await ProductModel.find(productFilter)
      .sort({ category: 1, name: 1 })
      .select({ name: 1, sku: 1, category: 1, price: 1, currency: 1, description: 1 })
      .lean()

    return {
      brand: {
        companyName: context.branding.companyName,
        companyLogo: context.branding.companyLogo
      },
      agent: {
        id: context.agent._id.toString(),
        name: context.agent.name,
        description: typeof context.agent.description === 'string' ? context.agent.description : ''
      },
      table: context.table,
      menu: products.map((product) => ({
        id: product._id.toString(),
        name: product.name,
        sku: product.sku,
        category: product.category,
        price: product.price,
        currency: product.currency,
        description: product.description
      }))
    }
  },

  createLiveSession: async (
    agentId: string,
    payload: {
      source: 'mic' | 'script'
      tableNumber?: string
    }
  ) => {
    const context = await publicTableOrderService.getLiveContext(agentId, payload.tableNumber)

    if (!context.table.isAvailable) {
      throw new ApiError(
        409,
        `Table ${context.table.number} already has an active order. Please wait until it is completed.`,
        'TABLE_ORDER_ALREADY_ACTIVE'
      )
    }

    const session = await geminiLiveService.createEphemeralSessionToken(context.ownerId, agentId, payload.source)

    return {
      ...session,
      brand: {
        companyName: context.branding.companyName,
        companyLogo: context.branding.companyLogo
      },
      table: context.table
    }
  },

  createOrder: async (
    agentId: string,
    payload: {
      customerName: string
      customerPhone?: string
      customerEmail?: string
      notes?: string
      tableNumber?: string
      items: Array<{ productId: string; quantity: number }>
    }
  ) => {
    const context = await publicTableOrderService.getLiveContext(agentId, payload.tableNumber)

    if (payload.items.length === 0) {
      throw new ApiError(400, 'Add at least one menu item before placing an order', 'TABLE_ORDER_ITEMS_REQUIRED')
    }

    const order = await orderService.create(context.ownerId, {
      agentId: context.agent._id.toString(),
      customerName: payload.customerName,
      customerPhone: payload.customerPhone,
      customerEmail: payload.customerEmail,
      notes: payload.notes,
      tableNumber: context.table.number,
      source: 'script',
      items: payload.items
    })

    return {
      order,
      table: {
        number: context.table.number
      }
    }
  },

  isValidAgentId: (value: string) => mongoose.isValidObjectId(value)
}
