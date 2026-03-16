import type { NextFunction, Request, Response } from 'express'
import mongoose from 'mongoose'
import multer from 'multer'
import { ZodError } from 'zod'
import { env } from '../config/env.js'
import { ApiError } from './ApiError.js'
import { logger } from './logger.js'

export const notFoundHandler = (req: Request, _res: Response, next: NextFunction): void => {
  next(new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`, 'ROUTE_NOT_FOUND'))
}

export const errorHandler = (error: unknown, req: Request, res: Response, _next: NextFunction): Response => {
  logger.error({ err: error, path: req.originalUrl, method: req.method }, 'Request failed')

  if (error instanceof ApiError) {
    return res.status(error.statusCode).json({
      success: false,
      code: error.code,
      message: error.message,
      details: error.details
    })
  }

  if (error instanceof ZodError) {
    return res.status(400).json({
      success: false,
      code: 'VALIDATION_ERROR',
      message: 'Validation failed',
      details: error.flatten()
    })
  }

  if (error instanceof mongoose.Error.ValidationError) {
    return res.status(400).json({
      success: false,
      code: 'DB_VALIDATION_ERROR',
      message: 'Database validation failed',
      details: error.errors
    })
  }

  if (error instanceof mongoose.Error.CastError) {
    return res.status(400).json({
      success: false,
      code: 'INVALID_IDENTIFIER',
      message: 'Invalid resource identifier'
    })
  }

  if (error instanceof multer.MulterError) {
    return res.status(400).json({
      success: false,
      code: error.code === 'LIMIT_FILE_SIZE' ? 'FILE_TOO_LARGE' : 'UPLOAD_ERROR',
      message: error.code === 'LIMIT_FILE_SIZE' ? 'Uploaded file is too large' : error.message
    })
  }

  return res.status(500).json({
    success: false,
    code: 'INTERNAL_SERVER_ERROR',
    message: env.NODE_ENV === 'production' ? 'Internal server error' : (error as Error).message
  })
}
