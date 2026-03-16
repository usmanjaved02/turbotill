import { env } from '../config/env.js'
import { addDays, addMinutes } from '../helpers/date.js'
import { parseDeviceMetadata } from '../helpers/device.js'
import { ApiError } from '../helpers/ApiError.js'
import { createAccessToken } from '../helpers/auth.js'
import { createCsrfToken, createOpaqueRefreshToken, hashOpaqueToken } from '../helpers/cookies.js'
import { deriveOrderPrefixFromBusinessName } from '../helpers/orderPrefix.js'
import { comparePassword, hashPassword } from '../helpers/password.js'
import { mapUser } from '../helpers/user.js'
import { auditService } from './audit.service.js'
import { geoipService } from './geoip.service.js'
import { SessionModel } from '../models/Session.js'
import { UserModel } from '../models/User.js'
import crypto from 'node:crypto'

const MAX_FAILED_ATTEMPTS = 5
const LOCK_MINUTES = 15

interface AuthInput {
  email: string
  password: string
}

interface SignupInput extends AuthInput {
  fullName: string
  businessName: string
  phone?: string
}

interface CreateOrganizationUserInput {
  fullName: string
  email: string
  password: string
  role: 'admin' | 'manager' | 'viewer'
  phone?: string
}

type UserRole = 'owner' | 'admin' | 'manager' | 'viewer'

const mapOrganizationUser = (user: any) => ({
  id: user._id.toString(),
  fullName: user.fullName,
  email: user.email,
  ...(user.phone ? { phone: user.phone } : {}),
  role: user.role,
  createdAt: user.createdAt.toISOString(),
  ...(user.lastLoginAt ? { lastLoginAt: user.lastLoginAt.toISOString() } : {})
})

const resolveOrganizationContext = async (userId: string) => {
  const user = await UserModel.findById(userId)
    .select({ organizationId: 1, businessName: 1, role: 1, fullName: 1, email: 1 })
    .lean()

  if (!user) {
    throw new ApiError(404, 'User not found', 'USER_NOT_FOUND')
  }

  const organizationId = user.organizationId?.toString() ?? user._id.toString()

  if (!user.organizationId) {
    await UserModel.updateOne({ _id: user._id }, { organizationId: user._id })
  }

  return {
    organizationId,
    user
  }
}

const createSessionBundle = async (
  user: { id: string; email: string; role: UserRole },
  userAgent?: string,
  ipAddress?: string,
  familyId: string = crypto.randomUUID(),
  sessionName?: string
) => {
  const refreshToken = createOpaqueRefreshToken()
  const csrfToken = createCsrfToken()
  const deviceMetadata = parseDeviceMetadata(userAgent)
  const geoMetadata = await geoipService.enrichIpAddress(ipAddress)
  const session = await SessionModel.create({
    userId: user.id,
    familyId,
    refreshTokenHash: hashOpaqueToken(refreshToken),
    ...(userAgent ? { userAgent } : {}),
    ...(ipAddress ? { ipAddress } : {}),
    ...(sessionName ? { sessionName } : {}),
    ...deviceMetadata,
    ...geoMetadata,
    expiresAt: addDays(new Date(), env.REFRESH_TOKEN_TTL_DAYS)
  })

  return {
    accessToken: createAccessToken({ userId: user.id, email: user.email, role: user.role, sessionId: session.id }),
    refreshToken,
    csrfToken,
    sessionId: session.id
  }
}

const revokeSessionFamily = async (familyId: string, reason: 'family_revoked' | 'reuse_detected') => {
  await SessionModel.updateMany(
    { familyId, revokedAt: { $exists: false } },
    {
      revokedAt: new Date(),
      revokedReason: reason
    }
  )
}

export const authService = {
  signup: async (payload: SignupInput, userAgent?: string, ipAddress?: string) => {
    const existingUser = await UserModel.findOne({ email: payload.email }).lean()
    if (existingUser) {
      throw new ApiError(409, 'An account with this email already exists', 'EMAIL_ALREADY_EXISTS')
    }

    const user = await UserModel.create({
      fullName: payload.fullName,
      businessName: payload.businessName,
      orderPrefix: deriveOrderPrefixFromBusinessName(payload.businessName),
      email: payload.email,
      ...(payload.phone ? { phone: payload.phone } : {}),
      passwordHash: await hashPassword(payload.password)
    })
    await UserModel.updateOne({ _id: user._id }, { organizationId: user._id })

    const session = await createSessionBundle(
      { id: user.id, email: user.email, role: user.role },
      userAgent,
      ipAddress
    )
    await auditService.record({
      actorId: user.id,
      actorEmail: user.email,
      actorRole: user.role,
      action: 'auth.signup',
      entityType: 'user',
      entityId: user.id,
      metadata: {
        sessionId: session.sessionId
      },
      ipAddress,
      userAgent
    })

    return {
      user: mapUser(user),
      ...session
    }
  },

  login: async (payload: AuthInput, userAgent?: string, ipAddress?: string) => {
    const user = await UserModel.findOne({ email: payload.email }).select(
      '+passwordHash +failedLoginCount +lockUntil'
    )

    if (!user) {
      throw new ApiError(401, 'Invalid email or password', 'INVALID_CREDENTIALS')
    }

    if (user.lockUntil && user.lockUntil.getTime() > Date.now()) {
      throw new ApiError(423, 'Account temporarily locked due to failed login attempts', 'ACCOUNT_LOCKED')
    }

    const passwordMatches = await comparePassword(payload.password, user.passwordHash)

    if (!passwordMatches) {
      const failedLoginCount = user.failedLoginCount + 1
      const lockUntil = failedLoginCount >= MAX_FAILED_ATTEMPTS ? addMinutes(new Date(), LOCK_MINUTES) : undefined

      await UserModel.updateOne(
        { _id: user._id },
        {
          failedLoginCount,
          ...(lockUntil ? { lockUntil } : {})
        }
      )

      throw new ApiError(401, 'Invalid email or password', 'INVALID_CREDENTIALS')
    }

    await UserModel.updateOne(
      { _id: user._id },
      {
        failedLoginCount: 0,
        $unset: { lockUntil: 1 },
        lastLoginAt: new Date()
      }
    )

    const session = await createSessionBundle(
      { id: user.id, email: user.email, role: user.role },
      userAgent,
      ipAddress
    )
    await auditService.record({
      actorId: user.id,
      actorEmail: user.email,
      actorRole: user.role,
      action: 'auth.login',
      entityType: 'session',
      entityId: session.sessionId,
      ipAddress,
      userAgent
    })

    return {
      user: mapUser(user),
      ...session
    }
  },

  me: async (userId: string) => {
    const user = await UserModel.findById(userId).lean()
    if (!user) {
      throw new ApiError(404, 'User not found', 'USER_NOT_FOUND')
    }

    return mapUser(user)
  },

  refresh: async (refreshToken?: string, userAgent?: string, ipAddress?: string) => {
    if (!refreshToken) {
      throw new ApiError(401, 'Refresh session is invalid or expired', 'INVALID_REFRESH_TOKEN')
    }

    const refreshTokenHash = hashOpaqueToken(refreshToken)
    const session = await SessionModel.findOne({ refreshTokenHash }).select('+refreshTokenHash')

    if (!session) {
      throw new ApiError(401, 'Refresh session is invalid or expired', 'INVALID_REFRESH_TOKEN')
    }

    if (session.rotatedAt && session.replacedBySessionId) {
      await revokeSessionFamily(session.familyId, 'reuse_detected')
      await auditService.record({
        actorId: session.userId.toString(),
        action: 'auth.refresh_reuse_detected',
        entityType: 'session',
        entityId: session.id,
        metadata: {
          familyId: session.familyId
        },
        ipAddress,
        userAgent
      })
      throw new ApiError(401, 'Refresh token reuse detected. Please log in again.', 'REFRESH_TOKEN_REUSE')
    }

    if (session.revokedAt || session.expiresAt.getTime() <= Date.now()) {
      throw new ApiError(401, 'Refresh session is invalid or expired', 'INVALID_REFRESH_TOKEN')
    }

    const user = await UserModel.findById(session.userId).lean()
    if (!user) {
      throw new ApiError(404, 'User not found', 'USER_NOT_FOUND')
    }

    const nextSession = await createSessionBundle(
      { id: user._id.toString(), email: user.email, role: user.role },
      userAgent,
      ipAddress,
      session.familyId,
      session.sessionName ?? undefined
    )

    await SessionModel.updateOne(
      { _id: session._id },
      {
        rotatedAt: new Date(),
        replacedBySessionId: nextSession.sessionId,
        lastUsedAt: new Date()
      }
    )
    await auditService.record({
      actorId: user._id.toString(),
      actorEmail: user.email,
      actorRole: user.role,
      action: 'auth.refresh_rotated',
      entityType: 'session',
      entityId: nextSession.sessionId,
      metadata: {
        previousSessionId: session.id,
        familyId: session.familyId
      },
      ipAddress,
      userAgent
    })

    return {
      user: mapUser(user),
      accessToken: nextSession.accessToken,
      refreshToken: nextSession.refreshToken,
      csrfToken: nextSession.csrfToken,
      sessionId: nextSession.sessionId
    }
  },

  logout: async (refreshToken?: string) => {
    if (!refreshToken) {
      return
    }

    const session = await SessionModel.findOneAndUpdate(
      { refreshTokenHash: hashOpaqueToken(refreshToken) },
      { revokedAt: new Date(), revokedReason: 'logout' },
      { new: true }
    )

    if (session) {
      const user = await UserModel.findById(session.userId).lean()
      await auditService.record({
        actorId: session.userId.toString(),
        actorEmail: user?.email,
        actorRole: user?.role,
        action: 'auth.logout',
        entityType: 'session',
        entityId: session.id
      })
    }
  },

  listSessions: async (userId: string, currentSessionId?: string) => {
    const sessions = await SessionModel.find({ userId }).sort({ createdAt: -1 }).lean()

    return sessions.map((session) => ({
      id: session._id.toString(),
      sessionName: session.sessionName ?? null,
      userAgent: session.userAgent ?? 'Unknown device',
      deviceLabel: session.deviceLabel ?? 'Unknown device',
      browser: session.browser ?? 'Unknown browser',
      operatingSystem: session.operatingSystem ?? 'Unknown OS',
      deviceType: session.deviceType ?? 'unknown',
      ipAddress: session.ipAddress ?? 'Unknown IP',
      locationLabel: session.locationLabel ?? null,
      locationCity: session.locationCity ?? null,
      locationRegion: session.locationRegion ?? null,
      locationCountry: session.locationCountry ?? null,
      locationTimezone: session.locationTimezone ?? null,
      geoSource: session.geoSource ?? null,
      lastUsedAt: session.lastUsedAt.toISOString(),
      createdAt: session.createdAt.toISOString(),
      expiresAt: session.expiresAt.toISOString(),
      isCurrent: currentSessionId === session._id.toString(),
      isRevoked: Boolean(session.revokedAt),
      revokedReason: session.revokedReason ?? null
    }))
  },

  updateSessionName: async (userId: string, sessionId: string, sessionName?: string) => {
    const normalizedName = sessionName?.trim()
    const session = await SessionModel.findOneAndUpdate(
      { _id: sessionId, userId },
      normalizedName ? { sessionName: normalizedName } : { $unset: { sessionName: 1 } },
      { new: true }
    ).lean()

    if (!session) {
      throw new ApiError(404, 'Session not found', 'SESSION_NOT_FOUND')
    }

    if (normalizedName) {
      await SessionModel.updateMany(
        {
          familyId: session.familyId,
          userId
        },
        { sessionName: normalizedName }
      )
    }

    return {
      id: session._id.toString(),
      sessionName: normalizedName ?? null
    }
  },

  revokeSession: async (userId: string, sessionId: string, currentSessionId?: string) => {
    if (currentSessionId && currentSessionId === sessionId) {
      throw new ApiError(400, 'Use logout to end the current session', 'CURRENT_SESSION_REVOKE_NOT_ALLOWED')
    }

    const session = await SessionModel.findOneAndUpdate(
      { _id: sessionId, userId, revokedAt: { $exists: false } },
      { revokedAt: new Date(), revokedReason: 'session_revoked' },
      { new: true }
    ).lean()

    if (!session) {
      throw new ApiError(404, 'Session not found', 'SESSION_NOT_FOUND')
    }

    return session._id.toString()
  },

  revokeOtherSessions: async (userId: string, currentSessionId?: string) => {
    const filter: Record<string, unknown> = {
      userId,
      revokedAt: { $exists: false }
    }

    if (currentSessionId) {
      filter._id = { $ne: currentSessionId }
    }

    const result = await SessionModel.updateMany(filter, {
      revokedAt: new Date(),
      revokedReason: 'family_revoked'
    })

    return result.modifiedCount
  },

  listOrganizationUsers: async (userId: string) => {
    const { organizationId } = await resolveOrganizationContext(userId)
    const users = await UserModel.find({ organizationId })
      .sort({ createdAt: -1 })
      .select({ fullName: 1, email: 1, phone: 1, role: 1, createdAt: 1, lastLoginAt: 1 })
      .lean()

    return users.map(mapOrganizationUser)
  },

  createOrganizationUser: async (actorId: string, payload: CreateOrganizationUserInput) => {
    const { organizationId, user: actor } = await resolveOrganizationContext(actorId)

    if (!['owner', 'admin'].includes(actor.role)) {
      throw new ApiError(403, 'Only owner or admin can create organization users', 'FORBIDDEN')
    }

    const existingUser = await UserModel.findOne({ email: payload.email.toLowerCase().trim() }).lean()
    if (existingUser) {
      throw new ApiError(409, 'An account with this email already exists', 'EMAIL_ALREADY_EXISTS')
    }

    const user = await UserModel.create({
      fullName: payload.fullName,
      businessName: actor.businessName,
      organizationId,
      orderPrefix: deriveOrderPrefixFromBusinessName(actor.businessName),
      email: payload.email.toLowerCase().trim(),
      ...(payload.phone ? { phone: payload.phone } : {}),
      role: payload.role,
      passwordHash: await hashPassword(payload.password)
    })

    return mapOrganizationUser(user)
  }
}
