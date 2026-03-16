import { z } from 'zod'
import { objectIdSchema } from './common.validation.js'

const optionalDateString = z
  .string()
  .trim()
  .refine((value) => !Number.isNaN(Date.parse(value)), 'Invalid date value')
  .optional()
  .or(z.literal(''))

export const auditQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(1000).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  action: z.string().trim().max(80).optional().or(z.literal('')),
  entityType: z.string().trim().max(80).optional().or(z.literal('')),
  actorEmail: z.email().max(160).optional().or(z.literal('')),
  search: z.string().trim().max(120).optional().or(z.literal('')),
  from: optionalDateString,
  to: optionalDateString,
  format: z.enum(['csv', 'json']).optional(),
  async: z.coerce.boolean().optional()
})

export const createAuditSavedFilterSchema = z.object({
  name: z.string().trim().min(2).max(80),
  filters: auditQuerySchema.omit({ page: true, format: true, async: true }).optional().default({})
})

export const auditSavedFilterParamsSchema = z.object({
  id: objectIdSchema
})

export const createAuditExportJobSchema = z.object({
  format: z.enum(['csv', 'json']),
  filters: auditQuerySchema.omit({ page: true, format: true, async: true }).optional().default({})
})

export const auditExportJobParamsSchema = z.object({
  id: objectIdSchema
})
