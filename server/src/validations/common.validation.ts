import { z } from 'zod'

export const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid identifier')

export const idParamSchema = z.object({
  id: objectIdSchema
})
