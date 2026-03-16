import { ApiError } from '../helpers/ApiError.js'
import { ProductModel } from '../models/Product.js'

type ProductPayload = {
  name: string
  sku: string
  category: string
  description: string
  price: number
  currency: 'USD' | 'EUR' | 'GBP'
  discount?: number
  status: 'draft' | 'published' | 'archived'
  image?: string
}

type ProductListQuery = {
  page: number
  limit: number
  q?: string
  category?: string
  status?: 'draft' | 'published' | 'archived'
  sort?: 'newest' | 'oldest' | 'price' | 'name'
}

const mapProduct = (product: any) => ({
  id: product._id.toString(),
  name: product.name,
  sku: product.sku,
  category: product.category,
  description: product.description,
  price: product.price,
  currency: product.currency,
  ...(typeof product.discount === 'number' ? { discount: product.discount } : {}),
  status: product.status,
  createdAt: product.createdAt.toISOString(),
  ...(product.image ? { image: product.image } : {})
})

const findDuplicateSkuInPayload = (payload: ProductPayload[]) => {
  const seen = new Set<string>()
  for (const entry of payload) {
    const normalized = entry.sku.trim().toLowerCase()
    if (seen.has(normalized)) {
      return entry.sku
    }
    seen.add(normalized)
  }
  return null
}

export const productService = {
  list: async (ownerId: string) => {
    const products = await ProductModel.find({ ownerId }).sort({ createdAt: -1 }).lean()
    return products.map(mapProduct)
  },

  listPaginated: async (ownerId: string, query: ProductListQuery) => {
    const filter: Record<string, unknown> = { ownerId }

    if (query.q?.trim()) {
      const search = query.q.trim()
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { sku: { $regex: search, $options: 'i' } },
        { category: { $regex: search, $options: 'i' } }
      ]
    }

    if (query.category?.trim()) {
      filter.category = query.category.trim()
    }

    if (query.status) {
      filter.status = query.status
    }

    let sort: Record<string, 1 | -1> = { createdAt: -1 }
    if (query.sort === 'oldest') {
      sort = { createdAt: 1 }
    } else if (query.sort === 'price') {
      sort = { price: -1 }
    } else if (query.sort === 'name') {
      sort = { name: 1 }
    }

    const skip = (query.page - 1) * query.limit

    const [products, total] = await Promise.all([
      ProductModel.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(query.limit)
        .lean(),
      ProductModel.countDocuments(filter)
    ])

    const totalPages = Math.max(1, Math.ceil(total / query.limit))

    return {
      products: products.map(mapProduct),
      page: query.page,
      limit: query.limit,
      total,
      totalPages
    }
  },

  getById: async (ownerId: string, productId: string) => {
    const product = await ProductModel.findOne({ _id: productId, ownerId }).lean()
    if (!product) {
      throw new ApiError(404, 'Product not found', 'PRODUCT_NOT_FOUND')
    }

    return mapProduct(product)
  },

  create: async (ownerId: string, payload: ProductPayload) => {
    const product = await ProductModel.create({
      ownerId,
      ...payload
    })
    return mapProduct(product)
  },

  bulkCreate: async (ownerId: string, payload: ProductPayload[]) => {
    const duplicateSku = findDuplicateSkuInPayload(payload)
    if (duplicateSku) {
      throw new ApiError(400, `Duplicate SKU found in CSV: ${duplicateSku}`, 'PRODUCT_BULK_DUPLICATE_SKU')
    }

    const requestedSkus = payload.map((entry) => entry.sku)
    const existingProducts = await ProductModel.find({
      ownerId,
      sku: { $in: requestedSkus }
    })
      .select({ sku: 1 })
      .lean()

    if (existingProducts.length > 0) {
      const existingSkuList = existingProducts.map((entry) => entry.sku).join(', ')
      throw new ApiError(
        409,
        `These SKUs already exist in your catalog: ${existingSkuList}`,
        'PRODUCT_BULK_SKU_ALREADY_EXISTS'
      )
    }

    const products = await ProductModel.insertMany(
      payload.map((entry) => ({
        ownerId,
        ...entry
      }))
    )

    return products.map(mapProduct)
  },

  update: async (ownerId: string, productId: string, payload: ProductPayload) => {
    const product = await ProductModel.findOneAndUpdate({ _id: productId, ownerId }, payload, {
      new: true,
      runValidators: true
    }).lean()

    if (!product) {
      throw new ApiError(404, 'Product not found', 'PRODUCT_NOT_FOUND')
    }

    return mapProduct(product)
  },

  remove: async (ownerId: string, productId: string) => {
    const product = await ProductModel.findOneAndDelete({ _id: productId, ownerId }).lean()
    if (!product) {
      throw new ApiError(404, 'Product not found', 'PRODUCT_NOT_FOUND')
    }
  }
}
