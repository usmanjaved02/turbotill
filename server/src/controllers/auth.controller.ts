import type { Request, Response } from 'express'
import { asyncHandler } from '../helpers/asyncHandler.js'
import { clearAuthCookies, COOKIE_NAMES, setAuthCookies } from '../helpers/cookies.js'
import { getRequestMeta } from '../helpers/requestMeta.js'
import { sendSuccess } from '../helpers/response.js'
import { auditService } from '../services/audit.service.js'
import { authService } from '../services/auth.service.js'

export const authController = {
  signup: asyncHandler(async (req: Request, res: Response) => {
    const result = await authService.signup(req.body, getRequestMeta(req).userAgent, getRequestMeta(req).ipAddress)
    setAuthCookies(res, result.accessToken, result.refreshToken, result.csrfToken)
    sendSuccess(res, { user: result.user, csrfToken: result.csrfToken }, 'Account created', 201)
  }),

  login: asyncHandler(async (req: Request, res: Response) => {
    const result = await authService.login(req.body, getRequestMeta(req).userAgent, getRequestMeta(req).ipAddress)
    setAuthCookies(res, result.accessToken, result.refreshToken, result.csrfToken)
    sendSuccess(res, { user: result.user, csrfToken: result.csrfToken }, 'Login successful')
  }),

  me: asyncHandler(async (req: Request, res: Response) => {
    const user = await authService.me(req.auth!.userId)
    sendSuccess(res, { user, csrfToken: req.cookies?.[COOKIE_NAMES.csrfToken] ?? null })
  }),

  refresh: asyncHandler(async (req: Request, res: Response) => {
    const result = await authService.refresh(
      req.cookies?.[COOKIE_NAMES.refreshToken],
      getRequestMeta(req).userAgent,
      getRequestMeta(req).ipAddress
    )
    setAuthCookies(res, result.accessToken, result.refreshToken, result.csrfToken)
    sendSuccess(res, { user: result.user, csrfToken: result.csrfToken }, 'Session refreshed')
  }),

  logout: asyncHandler(async (req: Request, res: Response) => {
    await authService.logout(req.cookies?.[COOKIE_NAMES.refreshToken])
    clearAuthCookies(res)
    sendSuccess(res, null, 'Logged out')
  }),

  listSessions: asyncHandler(async (req: Request, res: Response) => {
    const sessions = await authService.listSessions(req.auth!.userId, req.auth!.sessionId)
    sendSuccess(res, { sessions })
  }),

  revokeSession: asyncHandler(async (req: Request, res: Response) => {
    const sessionId = await authService.revokeSession(req.auth!.userId, req.params.sessionId as string, req.auth!.sessionId)
    const meta = getRequestMeta(req)
    await auditService.record({
      actorId: req.auth!.userId,
      actorEmail: req.auth!.email,
      actorRole: req.auth!.role,
      action: 'auth.session_revoked',
      entityType: 'session',
      entityId: sessionId,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent
    })
    sendSuccess(res, { sessionId }, 'Session revoked')
  }),

  revokeOtherSessions: asyncHandler(async (req: Request, res: Response) => {
    const revokedCount = await authService.revokeOtherSessions(req.auth!.userId, req.auth!.sessionId)
    const meta = getRequestMeta(req)
    await auditService.record({
      actorId: req.auth!.userId,
      actorEmail: req.auth!.email,
      actorRole: req.auth!.role,
      action: 'auth.other_sessions_revoked',
      entityType: 'session',
      metadata: {
        revokedCount
      },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent
    })
    sendSuccess(res, { revokedCount }, 'Other sessions revoked')
  }),

  updateSessionName: asyncHandler(async (req: Request, res: Response) => {
    const result = await authService.updateSessionName(req.auth!.userId, req.params.sessionId as string, req.body.sessionName)
    const meta = getRequestMeta(req)
    await auditService.record({
      actorId: req.auth!.userId,
      actorEmail: req.auth!.email,
      actorRole: req.auth!.role,
      action: 'auth.session_named',
      entityType: 'session',
      entityId: result.id,
      metadata: {
        sessionName: result.sessionName
      },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent
    })
    sendSuccess(res, result, 'Session updated')
  }),

  listOrganizationUsers: asyncHandler(async (req: Request, res: Response) => {
    const users = await authService.listOrganizationUsers(req.auth!.userId)
    sendSuccess(res, { users })
  }),

  createOrganizationUser: asyncHandler(async (req: Request, res: Response) => {
    const user = await authService.createOrganizationUser(req.auth!.userId, req.body)
    const meta = getRequestMeta(req)
    await auditService.record({
      actorId: req.auth!.userId,
      actorEmail: req.auth!.email,
      actorRole: req.auth!.role,
      action: 'auth.organization_user_created',
      entityType: 'user',
      entityId: user.id,
      metadata: {
        email: user.email,
        role: user.role
      },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent
    })
    sendSuccess(res, { user }, 'Organization user created', 201)
  })
}
