import crypto from 'node:crypto'
import { env, isProduction } from '../config/env.js'
import { logger } from '../helpers/logger.js'

interface DeliverOrderWebhookInput {
  url: string
  secret?: string
  payload: Record<string, unknown>
}

const privateIpPattern = /^(10\.|127\.|169\.254\.|172\.(1[6-9]|2\d|3[0-1])\.|192\.168\.)/

const isBlockedHostname = (hostname: string) => {
  const normalized = hostname.toLowerCase()
  if (normalized === 'localhost' || normalized.endsWith('.local')) {
    return true
  }

  return privateIpPattern.test(normalized)
}

const ensureAllowedWebhookUrl = (targetUrl: string) => {
  const parsed = new URL(targetUrl)

  if (isProduction && parsed.protocol !== 'https:') {
    throw new Error('Webhook URL must use HTTPS in production')
  }

  if (isProduction && isBlockedHostname(parsed.hostname)) {
    throw new Error('Webhook destination is blocked')
  }

  return parsed
}

const buildSignature = (payload: string, secret: string, timestamp: string) => {
  return crypto.createHmac('sha256', secret).update(`${timestamp}.${payload}`).digest('hex')
}

export const webhookDeliveryService = {
  deliverOrderCreated: async ({ url, secret, payload }: DeliverOrderWebhookInput) => {
    try {
      const parsed = ensureAllowedWebhookUrl(url)
      const body = JSON.stringify(payload)
      const timestamp = new Date().toISOString()
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), env.WEBHOOK_DELIVERY_TIMEOUT_MS)

      try {
      const response = await fetch(parsed.toString(), {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'TurboTill-Webhook/1.0',
          'X-TurboTill-Event': 'order.created',
          'X-TurboTill-Timestamp': timestamp,
          ...(secret ? { 'X-TurboTill-Signature': buildSignature(body, secret, timestamp) } : {})
        },
        body
      })

      return {
        delivered: response.ok,
        statusCode: response.status
      }
      } finally {
        clearTimeout(timeout)
      }
    } catch (error) {
      logger.warn({ err: error, url }, 'Webhook delivery failed')
      return {
        delivered: false,
        statusCode: null
      }
    }
  }
}
