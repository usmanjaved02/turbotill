import { z } from 'zod'

const productPayloadSchema = z.object({
  name: z.string().trim().min(2).max(180),
  sku: z.string().trim().min(2).max(80),
  category: z.string().trim().min(2).max(100),
  description: z.string().trim().min(2).max(3000),
  price: z.number().min(0.01).max(1_000_000),
  currency: z.enum(['USD', 'EUR', 'GBP']).default('USD'),
  discount: z.number().min(0).max(90).optional(),
  status: z.enum(['draft', 'published', 'archived']).default('published'),
  image: z.url().optional().or(z.literal(''))
})

export const productBodySchema = productPayloadSchema

export const productBulkBodySchema = z.object({
  products: z.array(productPayloadSchema).min(1).max(500)
})
