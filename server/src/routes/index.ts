import { Router } from 'express'
import { authRouter } from './auth.routes.js'
import { agentRouter } from './agent.routes.js'
import { auditRouter } from './audit.routes.js'
import { orderRouter } from './order.routes.js'
import { productRouter } from './product.routes.js'
import { settingsRouter } from './settings.routes.js'

export const apiRouter = Router()

apiRouter.get('/health', (_req, res) => {
  res.status(200).json({
    success: true,
    message: 'Turbo Till API is healthy'
  })
})

apiRouter.use('/auth', authRouter)
apiRouter.use('/products', productRouter)
apiRouter.use('/agents', agentRouter)
apiRouter.use('/orders', orderRouter)
apiRouter.use('/audit-logs', auditRouter)
apiRouter.use('/settings', settingsRouter)
