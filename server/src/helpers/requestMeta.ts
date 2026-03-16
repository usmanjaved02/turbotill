import type { Request } from 'express'

const normalizeIpAddress = (value?: string) => {
  if (!value) return undefined
  if (value === '::1') return '127.0.0.1'
  return value.replace(/^::ffff:/, '')
}

export const getRequestMeta = (req: Request) => ({
  ipAddress: normalizeIpAddress(req.ip),
  userAgent: req.get('user-agent')
})
