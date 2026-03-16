import type { NextFunction, Request, Response } from 'express'
import type { ZodType } from 'zod'
import { ApiError } from './ApiError.js'

const resolveValidationMessage = (issues: Array<{ path: PropertyKey[]; message: string }>) => {
  const firstIssue = issues[0]
  if (!firstIssue) {
    return 'Validation failed'
  }

  const fieldPath = firstIssue.path
    .map((entry) => String(entry))
    .filter(Boolean)
    .join('.')

  return fieldPath ? `${fieldPath}: ${firstIssue.message}` : firstIssue.message
}

export const validate =
  <T>(schema: ZodType<T>, source: 'body' | 'params' | 'query' = 'body') =>
  (req: Request, _res: Response, next: NextFunction): void => {
    const parsed = schema.safeParse(req[source])

    if (!parsed.success) {
      next(new ApiError(400, resolveValidationMessage(parsed.error.issues), 'VALIDATION_ERROR', parsed.error.flatten()))
      return
    }

    Object.assign(req[source], parsed.data)
    next()
  }
