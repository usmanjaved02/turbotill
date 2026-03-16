import type { Request, Response } from 'express'
import { asyncHandler } from '../helpers/asyncHandler.js'
import { getRequestMeta } from '../helpers/requestMeta.js'
import { sendSuccess } from '../helpers/response.js'
import { auditService } from '../services/audit.service.js'
import { productService } from '../services/product.service.js'

const PRODUCT_STATUS = ['draft', 'published', 'archived'] as const
const PRODUCT_SORT = ['newest', 'oldest', 'price', 'name'] as const
type ProductStatusValue = (typeof PRODUCT_STATUS)[number]
type ProductSortValue = (typeof PRODUCT_SORT)[number]

const parsePositiveInt = (value: unknown, fallback: number, max: number) => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    return fallback
  }

  return Math.min(Math.max(Math.trunc(parsed), 1), max)
}

const hasProductListQuery = (req: Request) =>
  ['page', 'limit', 'q', 'category', 'status', 'sort'].some((key) => req.query[key] !== undefined)

const isProductStatus = (value: string): value is ProductStatusValue =>
  PRODUCT_STATUS.some((entry) => entry === value)

const isProductSort = (value: string): value is ProductSortValue =>
  PRODUCT_SORT.some((entry) => entry === value)

export const productController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    if (hasProductListQuery(req)) {
      const status = typeof req.query.status === 'string' && isProductStatus(req.query.status)
        ? req.query.status
        : undefined

      const sort = typeof req.query.sort === 'string' && isProductSort(req.query.sort)
        ? req.query.sort
        : undefined

      const result = await productService.listPaginated(req.auth!.userId, {
        page: parsePositiveInt(req.query.page, 1, 100_000),
        limit: parsePositiveInt(req.query.limit, 20, 100),
        q: typeof req.query.q === 'string' ? req.query.q : undefined,
        category: typeof req.query.category === 'string' ? req.query.category : undefined,
        status,
        sort
      })

      sendSuccess(res, result)
      return
    }

    const products = await productService.list(req.auth!.userId)
    sendSuccess(res, { products })
  }),

  getById: asyncHandler(async (req: Request, res: Response) => {
    const product = await productService.getById(req.auth!.userId, req.params.id as string)
    sendSuccess(res, { product })
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    const product = await productService.create(req.auth!.userId, req.body)
    const meta = getRequestMeta(req)
    await auditService.record({
      actorId: req.auth!.userId,
      actorEmail: req.auth!.email,
      actorRole: req.auth!.role,
      action: 'product.created',
      entityType: 'product',
      entityId: product.id,
      metadata: {
        name: product.name,
        sku: product.sku
      },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent
    })
    sendSuccess(res, { product }, 'Product created', 201)
  }),

  bulkCreate: asyncHandler(async (req: Request, res: Response) => {
    const products = await productService.bulkCreate(req.auth!.userId, req.body.products)
    const meta = getRequestMeta(req)
    await auditService.record({
      actorId: req.auth!.userId,
      actorEmail: req.auth!.email,
      actorRole: req.auth!.role,
      action: 'product.bulk_created',
      entityType: 'product',
      entityId: undefined,
      metadata: {
        count: products.length
      },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent
    })
    sendSuccess(res, { products }, `${products.length} products created`, 201)
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const product = await productService.update(req.auth!.userId, req.params.id as string, req.body)
    const meta = getRequestMeta(req)
    await auditService.record({
      actorId: req.auth!.userId,
      actorEmail: req.auth!.email,
      actorRole: req.auth!.role,
      action: 'product.updated',
      entityType: 'product',
      entityId: product.id,
      metadata: {
        name: product.name,
        status: product.status
      },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent
    })
    sendSuccess(res, { product }, 'Product updated')
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    await productService.remove(req.auth!.userId, req.params.id as string)
    const meta = getRequestMeta(req)
    await auditService.record({
      actorId: req.auth!.userId,
      actorEmail: req.auth!.email,
      actorRole: req.auth!.role,
      action: 'product.deleted',
      entityType: 'product',
      entityId: req.params.id as string,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent
    })
    sendSuccess(res, null, 'Product deleted')
  })
}
