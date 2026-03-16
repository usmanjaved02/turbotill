import crypto from 'node:crypto'
import type { Response } from 'express'
import { env, isProduction } from '../config/env.js'

export const COOKIE_NAMES = {
  accessToken: 'ot_access',
  refreshToken: 'ot_refresh',
  csrfToken: 'ot_csrf'
} as const

export const createOpaqueRefreshToken = (): string => crypto.randomBytes(48).toString('hex')

export const hashOpaqueToken = (value: string): string => crypto.createHash('sha256').update(value).digest('hex')

export const createCsrfToken = (): string => crypto.randomBytes(24).toString('hex')

const cookieDomain = env.COOKIE_DOMAIN?.trim() || undefined
const writeDualCookies = Boolean(cookieDomain)

const sharedCookieOptions = {
  secure: isProduction,
  sameSite: 'lax' as const,
  ...(cookieDomain ? { domain: cookieDomain } : {})
}

const hostCookieOptions = {
  secure: isProduction,
  sameSite: 'lax' as const
}

const setCookieWithCompatibility = (
  res: Response,
  name: string,
  value: string,
  options: {
    httpOnly: boolean
    maxAge: number
  }
) => {
  res.cookie(name, value, {
    ...options,
    ...sharedCookieOptions
  })

  if (writeDualCookies) {
    // Keep host-only cookie synced so older host-scoped cookies do not cause CSRF mismatches.
    res.cookie(name, value, {
      ...options,
      ...hostCookieOptions
    })
  }
}

const clearCookieWithCompatibility = (res: Response, name: string, httpOnly: boolean) => {
  res.clearCookie(name, {
    httpOnly,
    ...sharedCookieOptions
  })

  if (writeDualCookies) {
    res.clearCookie(name, {
      httpOnly,
      ...hostCookieOptions
    })
  }
}

export const setAccessTokenCookie = (res: Response, accessToken: string): void => {
  setCookieWithCompatibility(res, COOKIE_NAMES.accessToken, accessToken, {
    httpOnly: true,
    maxAge: env.ACCESS_TOKEN_TTL_MINUTES * 60 * 1000
  })
}

export const setAuthCookies = (res: Response, accessToken: string, refreshToken: string, csrfToken: string): void => {
  setAccessTokenCookie(res, accessToken)

  setCookieWithCompatibility(res, COOKIE_NAMES.refreshToken, refreshToken, {
    httpOnly: true,
    maxAge: env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000
  })

  setCookieWithCompatibility(res, COOKIE_NAMES.csrfToken, csrfToken, {
    httpOnly: false,
    maxAge: env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000
  })
}

export const clearAuthCookies = (res: Response): void => {
  for (const cookieName of Object.values(COOKIE_NAMES)) {
    clearCookieWithCompatibility(res, cookieName, cookieName !== COOKIE_NAMES.csrfToken)
  }
}
