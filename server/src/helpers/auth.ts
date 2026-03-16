import jwt from 'jsonwebtoken'
import type { NextFunction, Request, Response } from 'express'
import { env } from '../config/env.js'
import { ApiError } from './ApiError.js'
import { COOKIE_NAMES } from './cookies.js'
import { logger } from './logger.js'

export interface AuthPayload {
  userId: string
  email: string
  role: 'owner' | 'admin' | 'manager' | 'viewer'
  sessionId: string
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthPayload
    }
  }
}

export const createAccessToken = (payload: AuthPayload): string =>
  jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: `${env.ACCESS_TOKEN_TTL_MINUTES}m`
  })

export const verifyAccessToken = (token: string): AuthPayload => {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as AuthPayload
}

export const requireAuth = (req: Request, _res: Response, next: NextFunction): void => {
  const bearer = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.slice(7)
    : undefined
  const token = req.cookies?.[COOKIE_NAMES.accessToken] ?? bearer

  if (!token) {
    next(new ApiError(401, 'Authentication required', 'UNAUTHORIZED'))
    return
  }

  try {
    req.auth = verifyAccessToken(token)
    next()
  } catch {
    next(new ApiError(401, 'Invalid or expired access token', 'UNAUTHORIZED'))
  }
}

export const requireCsrf = (req: Request, _res: Response, next: NextFunction): void => {
  const safeMethods = new Set(['GET', 'HEAD', 'OPTIONS'])
  const requestOrigin = req.headers.origin
  const requestReferer = req.headers.referer
  const trustedOrigin = env.FRONTEND_ORIGIN
  const isTrustedOrigin =
    (typeof requestOrigin === 'string' && requestOrigin === trustedOrigin) ||
    (typeof requestReferer === 'string' && requestReferer.startsWith(`${trustedOrigin}/`))

  if (safeMethods.has(req.method)) {
    next()
    return
  }

  const csrfCookie = req.cookies?.[COOKIE_NAMES.csrfToken]
  const csrfHeader = req.headers['x-csrf-token']
  const csrfMatched = Boolean(csrfCookie && csrfHeader && csrfCookie === csrfHeader)

  if (csrfMatched) {
    next()
    return
  }

  // Compatibility fallback for trusted first-party origin when browser/header quirks prevent CSRF header sync.
  if (csrfCookie && isTrustedOrigin) {
    logger.warn(
      {
        path: req.originalUrl,
        method: req.method,
        hasCsrfCookie: Boolean(csrfCookie),
        hasCsrfHeader: Boolean(csrfHeader),
        csrfCookiePreview: typeof csrfCookie === 'string' ? csrfCookie.slice(0, 8) : null,
        csrfHeaderPreview: typeof csrfHeader === 'string' ? csrfHeader.slice(0, 8) : null,
        origin: requestOrigin,
        referer: requestReferer
      },
      'CSRF header mismatch bypassed for trusted origin'
    )
    next()
    return
  }

  logger.warn(
    {
      path: req.originalUrl,
      method: req.method,
      hasCsrfCookie: Boolean(csrfCookie),
      hasCsrfHeader: Boolean(csrfHeader),
      csrfCookiePreview: typeof csrfCookie === 'string' ? csrfCookie.slice(0, 8) : null,
      csrfHeaderPreview: typeof csrfHeader === 'string' ? csrfHeader.slice(0, 8) : null,
      origin: requestOrigin,
      referer: requestReferer,
      trustedOrigin
    },
    'CSRF validation failed'
  )
  next(new ApiError(403, 'CSRF validation failed', 'CSRF_MISMATCH'))
}

export const authorizeRoles =
  (...allowedRoles: AuthPayload['role'][]) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.auth) {
      next(new ApiError(401, 'Authentication required', 'UNAUTHORIZED'))
      return
    }

    if (!allowedRoles.includes(req.auth.role)) {
      next(new ApiError(403, 'You do not have permission to perform this action', 'FORBIDDEN'))
      return
    }

    next()
  }
