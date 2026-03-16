import { Router } from 'express'
import { agentController } from '../controllers/agent.controller.js'
import { authorizeRoles, requireAuth, requireCsrf } from '../helpers/auth.js'
import { validate } from '../helpers/validate.js'
import {
  agentBodySchema,
  agentToggleSchema,
  createPublicLiveSessionSchema,
  createPublicTableOrderSchema,
  createConversationLiveOrderSchema,
  createLiveOrderSchema,
  createLiveSessionSchema,
  createLiveVoicePreviewSchema,
  liveSessionParamsSchema,
  publicTableOrderQuerySchema,
  webhookTestSchema
} from '../validations/agent.validation.js'
import { idParamSchema } from '../validations/common.validation.js'

export const agentRouter = Router()

agentRouter.get('/public/:id/table-order', validate(idParamSchema, 'params'), validate(publicTableOrderQuerySchema, 'query'), agentController.getPublicTableOrderSession)
agentRouter.post(
  '/public/:id/table-order',
  validate(idParamSchema, 'params'),
  validate(createPublicTableOrderSchema),
  agentController.createPublicTableOrder
)
agentRouter.post(
  '/public/:id/live/session',
  validate(idParamSchema, 'params'),
  validate(publicTableOrderQuerySchema, 'query'),
  validate(createPublicLiveSessionSchema),
  agentController.createPublicLiveSession
)
agentRouter.post(
  '/public/:id/live/conversation-order',
  validate(idParamSchema, 'params'),
  validate(publicTableOrderQuerySchema, 'query'),
  validate(createConversationLiveOrderSchema),
  agentController.createPublicConversationLiveOrder
)

agentRouter.use(requireAuth, requireCsrf)

agentRouter.get('/', agentController.list)
agentRouter.get('/:id', validate(idParamSchema, 'params'), agentController.getById)
agentRouter.post('/', authorizeRoles('owner', 'admin', 'manager'), validate(agentBodySchema), agentController.create)
agentRouter.patch(
  '/:id',
  authorizeRoles('owner', 'admin', 'manager'),
  validate(idParamSchema, 'params'),
  validate(agentBodySchema),
  agentController.update
)
agentRouter.patch(
  '/:id/toggle',
  authorizeRoles('owner', 'admin', 'manager'),
  validate(idParamSchema, 'params'),
  validate(agentToggleSchema),
  agentController.toggle
)
agentRouter.post(
  '/live/voice-preview',
  authorizeRoles('owner', 'admin', 'manager'),
  validate(createLiveVoicePreviewSchema),
  agentController.createLiveVoicePreview
)
agentRouter.post(
  '/:id/live/session',
  authorizeRoles('owner', 'admin', 'manager'),
  validate(liveSessionParamsSchema, 'params'),
  validate(createLiveSessionSchema),
  agentController.createLiveSession
)
agentRouter.post(
  '/:id/live/orders',
  authorizeRoles('owner', 'admin', 'manager'),
  validate(liveSessionParamsSchema, 'params'),
  validate(createLiveOrderSchema),
  agentController.createLiveOrder
)
agentRouter.post(
  '/:id/live/conversation-order',
  authorizeRoles('owner', 'admin', 'manager'),
  validate(liveSessionParamsSchema, 'params'),
  validate(createConversationLiveOrderSchema),
  agentController.createConversationLiveOrder
)
agentRouter.post('/webhook/test', authorizeRoles('owner', 'admin', 'manager'), validate(webhookTestSchema), agentController.testWebhook)
agentRouter.delete('/:id', authorizeRoles('owner', 'admin', 'manager'), validate(idParamSchema, 'params'), agentController.remove)
