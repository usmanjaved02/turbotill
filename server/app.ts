import cookieParser from 'cookie-parser'
import cors from 'cors'
import express from 'express'
import rateLimit from 'express-rate-limit'
import helmet from 'helmet'
import mongoose from 'mongoose'
import path from 'node:path'
import { pinoHttp } from 'pino-http'
import { env } from './src/config/env.js'
import { errorHandler, notFoundHandler } from './src/helpers/errorHandler.js'
import { logger } from './src/helpers/logger.js'
import { uploadsRoot } from './src/helpers/uploads.js'
import { apiRouter } from './src/routes/index.js'

export const createApp = () => {
  const app = express()

  app.disable('x-powered-by')
  app.set('trust proxy', 1)

  app.use(
    pinoHttp({
      logger
    })
  )

  app.get('/healthz', (_req, res) => {
    const mongoConnected = mongoose.connection.readyState === 1
    res.status(mongoConnected ? 200 : 503).json({
      status: mongoConnected ? 'ok' : 'degraded',
      mongo: mongoConnected ? 'up' : 'down'
    })
  })

  app.get('/health', (_req, res) => {
    const mongoConnected = mongoose.connection.readyState === 1
    res.status(mongoConnected ? 200 : 503).json({
      status: mongoConnected ? 'ok' : 'degraded',
      mongo: mongoConnected ? 'up' : 'down'
    })
  })

  app.use(
    helmet({
      crossOriginResourcePolicy: false
    })
  )

  app.use(
    cors({
      origin: env.FRONTEND_ORIGIN,
      credentials: true
    })
  )

  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 200,
      standardHeaders: true,
      legacyHeaders: false
    })
  )

  app.use(express.json({ limit: '100kb' }))
  app.use(express.urlencoded({ extended: false, limit: '50kb' }))
  app.use(cookieParser())
  app.use(`/${env.UPLOAD_DIR}`, express.static(path.resolve(uploadsRoot()), { fallthrough: false, index: false }))

  app.use('/api/v1', apiRouter)

  app.use(notFoundHandler)
  app.use(errorHandler)

  return app
}
