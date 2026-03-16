import { z } from 'zod'
import { objectIdSchema } from './common.validation.js'

const optionalTextField = (max: number) =>
  z
    .union([z.string().trim().max(max), z.literal(''), z.undefined()])
    .transform((value) => (typeof value === 'string' && value.trim() ? value.trim() : undefined))

const optionalEmailField = z
  .union([z.email().max(160), z.literal(''), z.undefined()])
  .transform((value) => (typeof value === 'string' && value.trim() ? value.toLowerCase().trim() : undefined))

export const createOrderSchema = z.object({
  agentId: objectIdSchema.optional(),
  customerName: z.string().trim().min(2).max(160),
  customerPhone: optionalTextField(40),
  customerEmail: optionalEmailField,
  tableNumber: optionalTextField(40),
  items: z
    .array(
      z.object({
        productId: objectIdSchema,
        quantity: z.number().int().min(1).max(1000)
      })
    )
    .min(1),
  notes: z.string().trim().max(2000).optional(),
  source: z.enum(['mic', 'script', 'human', 'webhook']).default('human')
})

export const updateOrderStatusSchema = z.object({
  status: z.enum(['new', 'confirmed', 'processing', 'completed', 'cancelled'])
})
