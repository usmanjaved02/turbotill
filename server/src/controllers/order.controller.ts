import type { Request, Response } from 'express'
import { asyncHandler } from '../helpers/asyncHandler.js'
import { getRequestMeta } from '../helpers/requestMeta.js'
import { sendSuccess } from '../helpers/response.js'
import { auditService } from '../services/audit.service.js'
import { orderService } from '../services/order.service.js'

const ORDER_STATUS = ['new', 'confirmed', 'processing', 'completed', 'cancelled'] as const
const ORDER_SOURCE = ['mic', 'script', 'human', 'webhook'] as const
const ORDER_SORT = ['newest', 'oldest'] as const
type OrderStatusValue = (typeof ORDER_STATUS)[number]
type OrderSourceValue = (typeof ORDER_SOURCE)[number]
type OrderSortValue = (typeof ORDER_SORT)[number]

const parsePositiveInt = (value: unknown, fallback: number, max: number) => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    return fallback
  }

  return Math.min(Math.max(Math.trunc(parsed), 1), max)
}

const hasOrderListQuery = (req: Request) =>
  ['page', 'limit', 'q', 'status', 'source', 'agentId', 'sort'].some((key) => req.query[key] !== undefined)

const isOrderStatus = (value: string): value is OrderStatusValue => ORDER_STATUS.some((entry) => entry === value)
const isOrderSource = (value: string): value is OrderSourceValue => ORDER_SOURCE.some((entry) => entry === value)
const isOrderSort = (value: string): value is OrderSortValue => ORDER_SORT.some((entry) => entry === value)

export const orderController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    if (hasOrderListQuery(req)) {
      const status = typeof req.query.status === 'string' && isOrderStatus(req.query.status)
        ? req.query.status
        : undefined

      const source = typeof req.query.source === 'string' && isOrderSource(req.query.source)
        ? req.query.source
        : undefined

      const sort = typeof req.query.sort === 'string' && isOrderSort(req.query.sort)
        ? req.query.sort
        : undefined

      const result = await orderService.listPaginated(req.auth!.userId, {
        page: parsePositiveInt(req.query.page, 1, 100_000),
        limit: parsePositiveInt(req.query.limit, 20, 100),
        q: typeof req.query.q === 'string' ? req.query.q : undefined,
        status,
        source,
        agentId: typeof req.query.agentId === 'string' ? req.query.agentId : undefined,
        sort
      })

      sendSuccess(res, result)
      return
    }

    const orders = await orderService.list(req.auth!.userId)
    sendSuccess(res, { orders })
  }),

  getById: asyncHandler(async (req: Request, res: Response) => {
    const order = await orderService.getById(req.auth!.userId, req.params.id as string)
    sendSuccess(res, { order })
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    const order = await orderService.create(req.auth!.userId, req.body)
    const meta = getRequestMeta(req)
    await auditService.record({
      actorId: req.auth!.userId,
      actorEmail: req.auth!.email,
      actorRole: req.auth!.role,
      action: 'order.created',
      entityType: 'order',
      entityId: order.id,
      metadata: {
        source: order.source,
        totalAmount: order.totalAmount,
        agentId: order.agentId ?? null
      },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent
    })
    sendSuccess(res, { order }, 'Order created', 201)
  }),

  updateStatus: asyncHandler(async (req: Request, res: Response) => {
    const order = await orderService.updateStatus(req.auth!.userId, req.params.id as string, req.body.status)
    const meta = getRequestMeta(req)
    await auditService.record({
      actorId: req.auth!.userId,
      actorEmail: req.auth!.email,
      actorRole: req.auth!.role,
      action: 'order.status_updated',
      entityType: 'order',
      entityId: order.id,
      metadata: {
        status: order.status
      },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent
    })
    sendSuccess(res, { order }, 'Order updated')
  })
}
