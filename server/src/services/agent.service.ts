import crypto from 'node:crypto'
import { ApiError } from '../helpers/ApiError.js'
import { AgentModel } from '../models/Agent.js'
import { ProductModel } from '../models/Product.js'
import { buildOrderCreatedWebhookPayload } from './order.service.js'
import { webhookDeliveryService } from './webhook-delivery.service.js'

type AgentType = 'terminal' | 'table_order_taker' | 'whatsapp_call_attendant'

type AgentTableConfig = {
  allowMultipleOrdersPerTable: boolean
  defaultTableNumber?: string
  customerEntryUrl?: string
}

const createEmbedCode = (agentId: string) =>
  `<script src="https://cdn.ordertacker.ai/widget.js" data-agent-id="${agentId}" async></script>`

const resolveAgentType = (value: unknown): AgentType =>
  value === 'table_order_taker' || value === 'whatsapp_call_attendant' ? value : 'terminal'

const resolveTableConfig = (agentType: AgentType, tableConfigPayload: unknown): AgentTableConfig | undefined => {
  if (agentType !== 'table_order_taker') {
    return undefined
  }

  const tableConfig =
    tableConfigPayload && typeof tableConfigPayload === 'object' ? (tableConfigPayload as Record<string, unknown>) : {}

  const defaultTableNumber =
    typeof tableConfig.defaultTableNumber === 'string' && tableConfig.defaultTableNumber.trim().length > 0
      ? tableConfig.defaultTableNumber.trim()
      : undefined

  const customerEntryUrl =
    typeof tableConfig.customerEntryUrl === 'string' && tableConfig.customerEntryUrl.trim().length > 0
      ? tableConfig.customerEntryUrl.trim()
      : undefined

  return {
    allowMultipleOrdersPerTable: tableConfig.allowMultipleOrdersPerTable !== false,
    ...(defaultTableNumber ? { defaultTableNumber } : {}),
    ...(customerEntryUrl ? { customerEntryUrl } : {})
  }
}

const mapAgent = (agent: any) => {
  const agentType = resolveAgentType(agent.agentType)

  return {
    id: agent._id.toString(),
    name: agent.name,
    agentType,
    ...(agent.description ? { description: agent.description } : {}),
    productAccess: agent.productAccess,
    productIds: agent.productIds.map((productId: { toString(): string }) => productId.toString()),
    ...(agent.webhookUrl ? { webhookUrl: agent.webhookUrl } : {}),
    webhookStatus: agent.webhookStatus,
    mode: agent.mode,
    ...(agentType === 'table_order_taker'
      ? {
          tableConfig: {
            allowMultipleOrdersPerTable: agent.tableConfig?.allowMultipleOrdersPerTable !== false,
            ...(typeof agent.tableConfig?.defaultTableNumber === 'string' && agent.tableConfig.defaultTableNumber.trim()
              ? { defaultTableNumber: agent.tableConfig.defaultTableNumber.trim() }
              : {}),
            ...(typeof agent.tableConfig?.customerEntryUrl === 'string' && agent.tableConfig.customerEntryUrl.trim()
              ? { customerEntryUrl: agent.tableConfig.customerEntryUrl.trim() }
              : {})
          }
        }
      : {}),
    voiceProfile: {
      languageCode: agent.voiceProfile?.languageCode ?? 'en-US',
      gender: agent.voiceProfile?.gender ?? 'female',
      voiceName: agent.voiceProfile?.voiceName ?? 'Kore'
    },
    isActive: agent.isActive,
    ordersHandled: agent.ordersHandled,
    lastActivity: agent.lastActivity.toISOString(),
    embedCode: agent.embedCode,
    createdAt: agent.createdAt.toISOString()
  }
}

const validateProductOwnership = async (ownerId: string, productIds: string[]) => {
  if (productIds.length === 0) {
    return
  }

  const productCount = await ProductModel.countDocuments({
    _id: { $in: productIds },
    ownerId
  })

  if (productCount !== productIds.length) {
    throw new ApiError(400, 'One or more selected products are invalid', 'INVALID_AGENT_PRODUCTS')
  }
}

export const agentService = {
  list: async (ownerId: string) => {
    const agents = await AgentModel.find({ ownerId }).sort({ createdAt: -1 }).lean()
    return agents.map(mapAgent)
  },

  getById: async (ownerId: string, agentId: string) => {
    const agent = await AgentModel.findOne({ _id: agentId, ownerId }).lean()
    if (!agent) {
      throw new ApiError(404, 'Agent not found', 'AGENT_NOT_FOUND')
    }

    return mapAgent(agent)
  },

  create: async (ownerId: string, payload: Record<string, unknown>) => {
    const productAccess = payload.productAccess as 'all' | 'selected'
    const productIds = (payload.productIds as string[]) ?? []
    const agentType = resolveAgentType(payload.agentType)
    const tableConfig = resolveTableConfig(agentType, payload.tableConfig)

    if (productAccess === 'selected') {
      await validateProductOwnership(ownerId, productIds)
    }

    const seed = crypto.randomUUID()
    const agent = await AgentModel.create({
      ownerId,
      name: payload.name as string,
      description: payload.description as string | undefined,
      agentType,
      productAccess,
      productIds,
      webhookUrl: payload.webhookUrl as string | undefined,
      webhookSecret: payload.webhookSecret as string | undefined,
      webhookStatus: payload.webhookUrl ? 'connected' : 'not_configured',
      mode: payload.mode as 'mic' | 'script',
      voiceProfile: payload.voiceProfile as Record<string, unknown>,
      isActive: payload.isActive as boolean,
      ...(tableConfig ? { tableConfig } : {}),
      embedCode: createEmbedCode(seed)
    })

    return mapAgent(agent)
  },

  update: async (ownerId: string, agentId: string, payload: Record<string, unknown>) => {
    const productAccess = payload.productAccess as 'all' | 'selected'
    const productIds = (payload.productIds as string[]) ?? []
    const agentType = resolveAgentType(payload.agentType)
    const tableConfig = resolveTableConfig(agentType, payload.tableConfig)

    if (productAccess === 'selected') {
      await validateProductOwnership(ownerId, productIds)
    }

    const updateDoc: Record<string, unknown> = {
      name: payload.name as string,
      description: payload.description as string | undefined,
      agentType,
      productAccess,
      productIds,
      webhookUrl: payload.webhookUrl as string | undefined,
      webhookSecret: payload.webhookSecret as string | undefined,
      webhookStatus: payload.webhookUrl ? 'connected' : 'not_configured',
      mode: payload.mode as 'mic' | 'script',
      voiceProfile: payload.voiceProfile as Record<string, unknown>,
      isActive: payload.isActive as boolean
    }

    if (tableConfig) {
      updateDoc.tableConfig = tableConfig
    } else {
      updateDoc.$unset = { tableConfig: 1 }
    }

    const agent = await AgentModel.findOneAndUpdate(
      { _id: agentId, ownerId },
      updateDoc,
      {
        new: true,
        runValidators: true
      }
    ).lean()

    if (!agent) {
      throw new ApiError(404, 'Agent not found', 'AGENT_NOT_FOUND')
    }

    return mapAgent(agent)
  },

  toggle: async (ownerId: string, agentId: string, isActive: boolean) => {
    const agent = await AgentModel.findOneAndUpdate(
      { _id: agentId, ownerId },
      { isActive, lastActivity: new Date() },
      { new: true }
    ).lean()

    if (!agent) {
      throw new ApiError(404, 'Agent not found', 'AGENT_NOT_FOUND')
    }

    return mapAgent(agent)
  },

  remove: async (ownerId: string, agentId: string) => {
    const agent = await AgentModel.findOneAndDelete({ _id: agentId, ownerId }).lean()
    if (!agent) {
      throw new ApiError(404, 'Agent not found', 'AGENT_NOT_FOUND')
    }
  },

  testWebhook: async (url: string) => {
    const now = new Date()
    const mockAgent = {
      _id: { toString: () => 'test_agent' },
      name: 'Webhook Test Agent',
      mode: 'mic',
      isActive: true
    }

    const mockOrder = {
      _id: { toString: () => 'test_order' },
      orderName: 'ts-26-03-15-0001',
      customerName: 'Webhook Test',
      customerPhone: '+1 555 000 0000',
      customerEmail: 'webhook-test@example.com',
      tableNumber: 'T-01',
      items: [
        {
          productId: { toString: () => 'test_product_1' },
          productName: 'Webhook Test Product',
          quantity: 1,
          unitPrice: 25
        }
      ],
      totalAmount: 25,
      agentId: { toString: () => 'test_agent' },
      agentName: 'Webhook Test Agent',
      source: 'mic',
      status: 'new',
      notes: 'This is a webhook payload structure test.',
      webhookDelivered: false,
      createdAt: now,
      timeline: [{ label: 'Order created', at: now }]
    }

    const result = await webhookDeliveryService.deliverOrderCreated({
      url,
      payload: buildOrderCreatedWebhookPayload(mockOrder, mockAgent)
    })

    return {
      url,
      status: result.delivered ? 'connected' : 'failed'
    }
  }
}
