import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { authController } from '../controllers/auth.controller.js'
import { authorizeRoles, requireAuth, requireCsrf } from '../helpers/auth.js'
import { validate } from '../helpers/validate.js'
import { createOrganizationUserSchema, loginSchema, signupSchema } from '../validations/auth.validation.js'
import { revokeSessionParamsSchema, updateSessionSchema } from '../validations/session.validation.js'

export const authRouter = Router()

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false
})

authRouter.post('/signup', authLimiter, validate(signupSchema), authController.signup)
authRouter.post('/login', authLimiter, validate(loginSchema), authController.login)
authRouter.post('/refresh', requireCsrf, authController.refresh)
authRouter.post('/logout', requireCsrf, authController.logout)
authRouter.get('/me', requireAuth, authController.me)
authRouter.get('/sessions', requireAuth, authController.listSessions)
authRouter.patch(
  '/sessions/:sessionId',
  requireAuth,
  requireCsrf,
  validate(revokeSessionParamsSchema, 'params'),
  validate(updateSessionSchema),
  authController.updateSessionName
)
authRouter.delete(
  '/sessions/:sessionId',
  requireAuth,
  requireCsrf,
  validate(revokeSessionParamsSchema, 'params'),
  authController.revokeSession
)
authRouter.post('/sessions/revoke-others', requireAuth, requireCsrf, authController.revokeOtherSessions)
authRouter.get('/organization/users', requireAuth, authController.listOrganizationUsers)
authRouter.post(
  '/organization/users',
  requireAuth,
  requireCsrf,
  authorizeRoles('owner', 'admin'),
  validate(createOrganizationUserSchema),
  authController.createOrganizationUser
)
