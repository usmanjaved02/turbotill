import type { Request, Response } from 'express'
import { ApiError } from '../helpers/ApiError.js'
import { createAccessToken } from '../helpers/auth.js'
import { asyncHandler } from '../helpers/asyncHandler.js'
import { setAccessTokenCookie } from '../helpers/cookies.js'
import { getRequestMeta } from '../helpers/requestMeta.js'
import { sendSuccess } from '../helpers/response.js'
import { buildUploadUrl, removeUploadIfLocal } from '../helpers/uploads.js'
import { auditService } from '../services/audit.service.js'
import { settingsService } from '../services/settings.service.js'

export const settingsController = {
  updateProfile: asyncHandler(async (req: Request, res: Response) => {
    const user = await settingsService.updateProfile(req.auth!.userId, req.body)
    setAccessTokenCookie(
      res,
      createAccessToken({
        userId: user.id,
        email: user.email,
        role: user.role,
        sessionId: req.auth!.sessionId
      })
    )

    const meta = getRequestMeta(req)
    await auditService.record({
      actorId: req.auth!.userId,
      actorEmail: user.email,
      actorRole: user.role,
      action: 'settings.profile_updated',
      entityType: 'user',
      entityId: user.id,
      metadata: {
        email: user.email,
        businessName: user.businessName
      },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent
    })

    sendSuccess(res, { user }, 'Profile updated')
  }),

  updateWorkspace: asyncHandler(async (req: Request, res: Response) => {
    const user = await settingsService.updateWorkspace(req.auth!.userId, req.body)
    const meta = getRequestMeta(req)
    await auditService.record({
      actorId: req.auth!.userId,
      actorEmail: user.email,
      actorRole: user.role,
      action: 'settings.workspace_updated',
      entityType: 'workspace',
      entityId: user.id,
      metadata: {
        businessName: user.businessName,
        defaultCurrency: user.defaultCurrency,
        timezone: user.timezone
      },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent
    })

    sendSuccess(res, { user }, 'Workspace updated')
  }),

  uploadAvatar: asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) {
      throw new ApiError(400, 'Avatar file is required', 'FILE_REQUIRED')
    }

    const existingUser = await settingsService.getUserById(req.auth!.userId)
    await removeUploadIfLocal(existingUser.avatarUrl)

    const user = await settingsService.updateProfileMedia(req.auth!.userId, {
      avatarUrl: buildUploadUrl('avatars', req.file.filename)
    })
    const meta = getRequestMeta(req)
    await auditService.record({
      actorId: req.auth!.userId,
      actorEmail: user.email,
      actorRole: user.role,
      action: 'settings.avatar_uploaded',
      entityType: 'user',
      entityId: user.id,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent
    })
    sendSuccess(res, { user }, 'Avatar uploaded')
  }),

  uploadWorkspaceLogo: asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) {
      throw new ApiError(400, 'Logo file is required', 'FILE_REQUIRED')
    }

    const existingUser = await settingsService.getUserById(req.auth!.userId)
    await removeUploadIfLocal(existingUser.businessLogo)

    const user = await settingsService.updateProfileMedia(req.auth!.userId, {
      businessLogo: buildUploadUrl('logos', req.file.filename)
    })
    const meta = getRequestMeta(req)
    await auditService.record({
      actorId: req.auth!.userId,
      actorEmail: user.email,
      actorRole: user.role,
      action: 'settings.logo_uploaded',
      entityType: 'workspace',
      entityId: user.id,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent
    })
    sendSuccess(res, { user }, 'Logo uploaded')
  })
}
