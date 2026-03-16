import mongoose from 'mongoose'
import { ApiError } from '../helpers/ApiError.js'
import { deriveOrderPrefixFromBusinessName, normalizeOrderPrefix } from '../helpers/orderPrefix.js'
import { AgentModel } from '../models/Agent.js'
import { OrderCounterModel } from '../models/OrderCounter.js'
import { OrderModel } from '../models/Order.js'
import { ProductModel } from '../models/Product.js'
import { UserModel } from '../models/User.js'
import { webhookDeliveryService } from './webhook-delivery.service.js'

const ACTIVE_TABLE_ORDER_STATUSES = ['new', 'confirmed', 'processing'] as const

const DEFAULT_TIMEZONE = 'UTC'
const ORDER_STATUS = ['new', 'confirmed', 'processing', 'completed', 'cancelled'] as const
const ORDER_SOURCE = ['mic', 'script', 'human', 'webhook'] as const

type OrderListQuery = {
  page: number
  limit: number
  q?: string
  status?: (typeof ORDER_STATUS)[number]
  source?: (typeof ORDER_SOURCE)[number]
  agentId?: string
  sort?: 'newest' | 'oldest'
}

const getDateKeyForTimezone = (value: Date, timeZone: string) => {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: '2-digit',
      month: '2-digit',
      day: '2-digit'
    })
    const parts = formatter.formatToParts(value)
    const year = parts.find((part) => part.type === 'year')?.value ?? '00'
    const month = parts.find((part) => part.type === 'month')?.value ?? '01'
    const day = parts.find((part) => part.type === 'day')?.value ?? '01'
    return `${year}-${month}-${day}`
  } catch {
    const fallbackFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: DEFAULT_TIMEZONE,
      year: '2-digit',
      month: '2-digit',
      day: '2-digit'
    })
    const parts = fallbackFormatter.formatToParts(value)
    const year = parts.find((part) => part.type === 'year')?.value ?? '00'
    const month = parts.find((part) => part.type === 'month')?.value ?? '01'
    const day = parts.find((part) => part.type === 'day')?.value ?? '01'
    return `${year}-${month}-${day}`
  }
}

const getOwnerOrderPrefixAndTimezone = async (ownerId: string) => {
  const owner = await UserModel.findById(ownerId)
    .select({ businessName: 1, orderPrefix: 1, timezone: 1 })
    .lean()

  if (!owner) {
    throw new ApiError(404, 'Workspace owner not found', 'ORDER_OWNER_NOT_FOUND')
  }

  const existingPrefix = normalizeOrderPrefix(typeof owner.orderPrefix === 'string' ? owner.orderPrefix : '')
  const derivedPrefix = deriveOrderPrefixFromBusinessName(owner.businessName ?? '')
  const orderPrefix = existingPrefix || derivedPrefix

  if (!existingPrefix) {
    await UserModel.updateOne(
      { _id: ownerId, $or: [{ orderPrefix: { $exists: false } }, { orderPrefix: '' }] },
      { orderPrefix }
    )
  }

  const timezone = typeof owner.timezone === 'string' && owner.timezone.trim().length > 0 ? owner.timezone.trim() : DEFAULT_TIMEZONE

  return {
    orderPrefix,
    timezone
  }
}

const createOrderName = async (ownerId: string, now: Date) => {
  const { orderPrefix, timezone } = await getOwnerOrderPrefixAndTimezone(ownerId)
  const dateKey = getDateKeyForTimezone(now, timezone)
  const sequence = await OrderCounterModel.findOneAndUpdate(
    { ownerId, dateKey },
    { $inc: { count: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  ).lean()

  const count = Math.max(1, sequence?.count ?? 1)
  return `${orderPrefix}-${dateKey}-${String(count).padStart(4, '0')}`
}

const mapOrder = (order: any) => ({
  id: order._id.toString(),
  orderName:
    typeof order.orderName === 'string' && order.orderName.trim().length > 0 ? order.orderName.trim() : order._id.toString(),
  customerName: order.customerName,
  customerPhone: order.customerPhone ?? '',
  customerEmail: order.customerEmail ?? '',
  ...(order.tableNumber ? { tableNumber: order.tableNumber } : {}),
  items: order.items.map((item: any) => ({
    productId: item.productId.toString(),
    productName: item.productName,
    quantity: item.quantity,
    unitPrice: item.unitPrice
  })),
  totalAmount: order.totalAmount,
  ...(order.agentId ? { agentId: order.agentId.toString() } : {}),
  ...(order.agentName ? { agentName: order.agentName } : {}),
  source: order.source,
  status: order.status,
  ...(order.notes ? { notes: order.notes } : {}),
  webhookDelivered: order.webhookDelivered,
  createdAt: order.createdAt.toISOString(),
  timeline: order.timeline.map((entry: any) => ({
    label: entry.label,
    at: entry.at.toISOString()
  }))
})

const mapOrderForWebhook = (order: any) => {
  const mapped = mapOrder(order)
  const { webhookDelivered: _webhookDelivered, ...withoutWebhookDelivered } = mapped
  return withoutWebhookDelivered
}

export const buildOrderCreatedWebhookPayload = (order: any, agentDocument: any) => ({
  event: 'order.created',
  order: mapOrderForWebhook(order),
  agent: {
    id: agentDocument._id.toString(),
    name: agentDocument.name,
    mode: agentDocument.mode,
    isActive: agentDocument.isActive
  }
})

const normalizeLabel = (value: string) => value.trim().toLowerCase().replace(/\s+/g, ' ')

const getAgentDocument = async (ownerId: string, agentId: string, includeSecret = false) => {
  const query = AgentModel.findOne({ _id: agentId, ownerId })
  if (includeSecret) {
    query.select('+webhookSecret')
  }

  const agent = await query
  if (!agent) {
    throw new ApiError(400, 'Agent does not belong to this workspace', 'INVALID_ORDER_AGENT')
  }

  return agent
}

const ensureAgentCanSellProducts = (agentDocument: any, productIds: string[]) => {
  if (!agentDocument || agentDocument.productAccess === 'all') {
    return
  }

  const allowed = new Set(agentDocument.productIds.map((productId: { toString(): string }) => productId.toString()))
  const invalid = productIds.some((productId) => !allowed.has(productId))

  if (invalid) {
    throw new ApiError(400, 'One or more items are outside this agent\'s product access', 'INVALID_AGENT_PRODUCT_ACCESS')
  }
}

const normalizeTableNumber = (value: unknown) =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined

const getAgentTableConfig = (agentDocument: any) => {
  const agentType =
    agentDocument?.agentType === 'table_order_taker' || agentDocument?.agentType === 'whatsapp_call_attendant'
      ? agentDocument.agentType
      : 'terminal'

  if (agentType !== 'table_order_taker') {
    return null
  }

  return {
    allowMultipleOrdersPerTable: agentDocument.tableConfig?.allowMultipleOrdersPerTable !== false,
    defaultTableNumber: normalizeTableNumber(agentDocument.tableConfig?.defaultTableNumber)
  }
}

const ensureTableAvailability = async (
  ownerId: string,
  agentDocument: any,
  tableNumber: string
) => {
  const hasActiveOrder = await OrderModel.exists({
    ownerId,
    agentId: agentDocument._id,
    tableNumber,
    status: { $in: ACTIVE_TABLE_ORDER_STATUSES }
  })

  if (hasActiveOrder) {
    throw new ApiError(
      409,
      `Table ${tableNumber} already has an active order. Complete or cancel it before taking another order.`,
      'TABLE_ORDER_ALREADY_ACTIVE'
    )
  }
}

const buildOrderItemsFromIds = async (ownerId: string, items: Array<{ productId: string; quantity: number }>, agentDocument?: any) => {
  const productIds = items.map((item) => new mongoose.Types.ObjectId(item.productId))
  const products = await ProductModel.find({
    _id: { $in: productIds },
    ownerId,
    status: { $ne: 'archived' }
  }).lean()

  if (products.length !== items.length) {
    throw new ApiError(400, 'Order contains invalid products', 'INVALID_ORDER_PRODUCTS')
  }

  ensureAgentCanSellProducts(
    agentDocument,
    items.map((item) => item.productId)
  )

  return items.map((item) => {
    const product = products.find((entry: any) => entry._id.toString() === item.productId)
    if (!product) {
      throw new ApiError(400, 'Order contains invalid products', 'INVALID_ORDER_PRODUCTS')
    }

    return {
      productId: product._id,
      productName: product.name,
      quantity: item.quantity,
      unitPrice: product.price
    }
  })
}

const buildOrderItemsFromLabels = async (
  ownerId: string,
  agentDocument: any,
  items: Array<{ productLabel: string; quantity: number }>
) => {
  const productFilter =
    agentDocument.productAccess === 'all'
      ? { ownerId, status: { $ne: 'archived' } }
      : { ownerId, _id: { $in: agentDocument.productIds }, status: { $ne: 'archived' } }

  const products = await ProductModel.find(productFilter).lean()
  if (products.length === 0) {
    throw new ApiError(400, 'No products are available for this agent', 'LIVE_AGENT_NO_PRODUCTS')
  }

  return items.map((item) => {
    const normalizedLabel = normalizeLabel(item.productLabel)
    const exactMatch = products.find(
      (product: any) => normalizeLabel(product.name) === normalizedLabel || normalizeLabel(product.sku) === normalizedLabel
    )

    if (exactMatch) {
      return {
        productId: exactMatch._id,
        productName: exactMatch.name,
        quantity: item.quantity,
        unitPrice: exactMatch.price
      }
    }

    const partialMatches = products.filter(
      (product: any) =>
        normalizeLabel(product.name).includes(normalizedLabel) || normalizeLabel(product.sku).includes(normalizedLabel)
    )

    if (partialMatches.length === 1) {
      return {
        productId: partialMatches[0]!._id,
        productName: partialMatches[0]!.name,
        quantity: item.quantity,
        unitPrice: partialMatches[0]!.price
      }
    }

    throw new ApiError(400, `Could not resolve product label: ${item.productLabel}`, 'LIVE_AGENT_UNKNOWN_PRODUCT')
  })
}

const dispatchOrderWebhook = async (agentDocument: any, order: any) => {
  if (!agentDocument?.webhookUrl) {
    return {
      delivered: false,
      statusCode: null
    }
  }

  const payload = buildOrderCreatedWebhookPayload(order, agentDocument)

  return webhookDeliveryService.deliverOrderCreated({
    url: agentDocument.webhookUrl,
    secret: agentDocument.webhookSecret,
    payload
  })
}

const finalizeOrder = async (ownerId: string, order: any, agentDocument: any, now: Date) => {
  if (agentDocument) {
    const webhookResult = await dispatchOrderWebhook(agentDocument, order)

    const timelineEntry = {
      label: webhookResult.delivered
        ? `Webhook delivered${webhookResult.statusCode ? ` (${webhookResult.statusCode})` : ''}`
        : agentDocument.webhookUrl
          ? 'Webhook delivery failed'
          : 'Webhook not configured',
      at: new Date()
    }

    const updatedOrder = await OrderModel.findByIdAndUpdate(
      order._id,
      {
        webhookDelivered: webhookResult.delivered,
        $push: { timeline: timelineEntry }
      },
      { new: true }
    ).lean()

    await AgentModel.updateOne(
      { _id: agentDocument._id, ownerId },
      {
        $inc: { ordersHandled: 1 },
        lastActivity: now,
        isActive: true
      }
    )

    return updatedOrder ?? order
  }

  return order
}

export const orderService = {
  list: async (ownerId: string) => {
    const orders = await OrderModel.find({ ownerId }).sort({ createdAt: -1 }).lean()
    return orders.map(mapOrder)
  },

  listPaginated: async (ownerId: string, query: OrderListQuery) => {
    const filter: Record<string, unknown> = { ownerId }

    if (query.q?.trim()) {
      const search = query.q.trim()
      filter.$or = [
        { orderName: { $regex: search, $options: 'i' } },
        { customerName: { $regex: search, $options: 'i' } },
        { agentName: { $regex: search, $options: 'i' } },
        { tableNumber: { $regex: search, $options: 'i' } }
      ]
    }

    if (query.status) {
      filter.status = query.status
    }

    if (query.source) {
      filter.source = query.source
    }

    if (query.agentId) {
      if (!mongoose.Types.ObjectId.isValid(query.agentId)) {
        return {
          orders: [],
          page: query.page,
          limit: query.limit,
          total: 0,
          totalPages: 1
        }
      }

      filter.agentId = new mongoose.Types.ObjectId(query.agentId)
    }

    const sort = query.sort === 'oldest' ? { createdAt: 1 as const } : { createdAt: -1 as const }
    const skip = (query.page - 1) * query.limit

    const [orders, total] = await Promise.all([
      OrderModel.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(query.limit)
        .lean(),
      OrderModel.countDocuments(filter)
    ])

    const totalPages = Math.max(1, Math.ceil(total / query.limit))

    return {
      orders: orders.map(mapOrder),
      page: query.page,
      limit: query.limit,
      total,
      totalPages
    }
  },

  getById: async (ownerId: string, orderId: string) => {
    const order = await OrderModel.findOne({ _id: orderId, ownerId }).lean()
    if (!order) {
      throw new ApiError(404, 'Order not found', 'ORDER_NOT_FOUND')
    }

    return mapOrder(order)
  },

  create: async (
    ownerId: string,
    payload: {
      agentId?: string
      customerName: string
      customerPhone?: string
      customerEmail?: string
      tableNumber?: string
      items: Array<{ productId: string; quantity: number }>
      notes?: string
      source: 'mic' | 'script' | 'human' | 'webhook'
    }
  ) => {
    let agentDocument: any = null

    if (payload.agentId) {
      agentDocument = await getAgentDocument(ownerId, payload.agentId, true)
    }

    const tableConfig = getAgentTableConfig(agentDocument)
    const tableNumber = normalizeTableNumber(payload.tableNumber) ?? tableConfig?.defaultTableNumber

    if (tableConfig) {
      if (!tableNumber) {
        throw new ApiError(400, 'Table number is required for this table order taker agent', 'TABLE_NUMBER_REQUIRED')
      }

      if (!tableConfig.allowMultipleOrdersPerTable) {
        await ensureTableAvailability(ownerId, agentDocument, tableNumber)
      }
    }

    const normalizedItems = await buildOrderItemsFromIds(ownerId, payload.items, agentDocument)
    const totalAmount = normalizedItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)
    const now = new Date()
    const orderName = await createOrderName(ownerId, now)

    const order = await OrderModel.create({
      ownerId,
      orderName,
      customerName: payload.customerName,
      ...(payload.customerPhone ? { customerPhone: payload.customerPhone } : {}),
      ...(payload.customerEmail ? { customerEmail: payload.customerEmail } : {}),
      ...(tableNumber ? { tableNumber } : {}),
      items: normalizedItems,
      totalAmount,
      ...(agentDocument ? { agentId: agentDocument._id, agentName: agentDocument.name } : {}),
      source: payload.source,
      ...(payload.notes ? { notes: payload.notes } : {}),
      webhookDelivered: false,
      timeline: [{ label: 'Order created', at: now }]
    })

    const finalizedOrder = await finalizeOrder(ownerId, order, agentDocument, now)
    return mapOrder(finalizedOrder)
  },

  createFromLiveAgent: async (
    ownerId: string,
    agentId: string,
    payload: {
      customerName: string
      customerPhone?: string
      customerEmail?: string
      tableNumber?: string
      items: Array<{ productLabel: string; quantity: number }>
      notes?: string
      source: 'mic' | 'script'
    }
  ) => {
    const agentDocument = await getAgentDocument(ownerId, agentId, true)
    const tableConfig = getAgentTableConfig(agentDocument)
    const tableNumber = normalizeTableNumber(payload.tableNumber) ?? tableConfig?.defaultTableNumber

    if (tableConfig) {
      if (!tableNumber) {
        throw new ApiError(400, 'Table number is required for this table order taker agent', 'TABLE_NUMBER_REQUIRED')
      }

      if (!tableConfig.allowMultipleOrdersPerTable) {
        await ensureTableAvailability(ownerId, agentDocument, tableNumber)
      }
    }

    const normalizedItems = await buildOrderItemsFromLabels(ownerId, agentDocument, payload.items)
    const totalAmount = normalizedItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)
    const now = new Date()
    const orderName = await createOrderName(ownerId, now)

    const order = await OrderModel.create({
      ownerId,
      orderName,
      customerName: payload.customerName,
      ...(payload.customerPhone ? { customerPhone: payload.customerPhone } : {}),
      ...(payload.customerEmail ? { customerEmail: payload.customerEmail } : {}),
      ...(tableNumber ? { tableNumber } : {}),
      items: normalizedItems,
      totalAmount,
      agentId: agentDocument._id,
      agentName: agentDocument.name,
      source: payload.source,
      ...(payload.notes ? { notes: payload.notes } : {}),
      webhookDelivered: false,
      timeline: [
        { label: 'Order created by live agent', at: now },
        { label: `Captured via ${payload.source === 'mic' ? 'microphone' : 'embedded script'} session`, at: now },
        ...(tableNumber ? [{ label: `Table ${tableNumber}`, at: now }] : [])
      ]
    })

    const finalizedOrder = await finalizeOrder(ownerId, order, agentDocument, now)
    return mapOrder(finalizedOrder)
  },

  updateStatus: async (
    ownerId: string,
    orderId: string,
    status: 'new' | 'confirmed' | 'processing' | 'completed' | 'cancelled'
  ) => {
    const order = await OrderModel.findOneAndUpdate(
      { _id: orderId, ownerId },
      {
        status,
        $push: {
          timeline: {
            label: `Status changed to ${status}`,
            at: new Date()
          }
        }
      },
      { new: true }
    ).lean()

    if (!order) {
      throw new ApiError(404, 'Order not found', 'ORDER_NOT_FOUND')
    }

    return mapOrder(order)
  }
}
