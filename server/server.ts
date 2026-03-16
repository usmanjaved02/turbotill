import { createServer } from 'node:http'
import { createApp } from './app.js'
import { env } from './src/config/env.js'
import { connectMongo, disconnectMongo } from './src/connections/mongodb.js'
import { logger } from './src/helpers/logger.js'
import { auditService } from './src/services/audit.service.js'
import { geoCacheMonitorService } from './src/services/geo-cache-monitor.service.js'

const SHUTDOWN_TIMEOUT_MS = 10_000

const startServer = async (): Promise<void> => {
  await connectMongo()
  auditService.startBackgroundWorkers()
  geoCacheMonitorService.start()

  const app = createApp()
  const server = createServer(app)
  let shuttingDown = false

  server.listen(env.PORT, '0.0.0.0', () => {
    logger.info(`API listening on port ${env.PORT}`)
  })

  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) {
      return
    }
    shuttingDown = true
    logger.info(`Received ${signal}, shutting down gracefully`)

    const shutdownTimeout = setTimeout(() => {
      logger.error(`Graceful shutdown exceeded ${SHUTDOWN_TIMEOUT_MS}ms, forcing exit`)
      process.exit(1)
    }, SHUTDOWN_TIMEOUT_MS)
    shutdownTimeout.unref()

    server.close(async () => {
      auditService.stopBackgroundWorkers()
      geoCacheMonitorService.stop()
      await disconnectMongo()
      clearTimeout(shutdownTimeout)
      process.exit(0)
    })
  }

  process.on('SIGINT', () => {
    void shutdown('SIGINT')
  })

  process.on('SIGTERM', () => {
    void shutdown('SIGTERM')
  })
}

void startServer().catch((error: unknown) => {
  logger.fatal({ err: error }, 'Failed to start API server')
  process.exit(1)
})
