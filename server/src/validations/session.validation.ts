import { z } from 'zod'
import { objectIdSchema } from './common.validation.js'

export const revokeSessionParamsSchema = z.object({
  sessionId: objectIdSchema
})

export const updateSessionSchema = z.object({
  sessionName: z.string().trim().max(60).optional().or(z.literal(''))
})
