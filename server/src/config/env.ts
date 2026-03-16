import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import { z } from 'zod'


dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
  FRONTEND_ORIGIN: z.string().url().default('http://localhost:5173'),
  COOKIE_DOMAIN: z.preprocess(
    (value) => (typeof value === 'string' && value.trim().length === 0 ? undefined : value),
    z.string().min(1).optional()
  ),
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  ACCESS_TOKEN_TTL_MINUTES: z.coerce.number().int().min(5).max(60 * 24).default(15),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(30).default(7),
  UPLOAD_DIR: z.string().min(1).default('uploads'),
  MAX_IMAGE_UPLOAD_MB: z.coerce.number().int().min(1).max(10).default(3),
  GEOIP_LOOKUP_ENABLED: z.coerce.boolean().default(false),
  GEOIP_LOOKUP_URL_TEMPLATE: z.string().optional(),
  GEOIP_LOOKUP_TIMEOUT_MS: z.coerce.number().int().min(200).max(10000).default(1500),
  GEOIP_CACHE_TTL_HOURS: z.coerce.number().int().min(1).max(24 * 30).default(24 * 7),
  GEOIP_MONITOR_INTERVAL_MS: z.coerce.number().int().min(1000).max(24 * 60 * 60 * 1000).default(10 * 60 * 1000),
  GEOIP_METRICS_RETENTION_DAYS: z.coerce.number().int().min(1).max(365).default(30),
  AUDIT_INLINE_EXPORT_LIMIT: z.coerce.number().int().min(1).max(100000).default(1000),
  AUDIT_EXPORT_MAX_ROWS: z.coerce.number().int().min(10).max(250000).default(10000),
  AUDIT_EXPORT_JOB_TTL_HOURS: z.coerce.number().int().min(1).max(24 * 30).default(24),
  AUDIT_EXPORT_POLL_INTERVAL_MS: z.coerce.number().int().min(50).max(60 * 60 * 1000).default(3000),
  GEMINI_API_KEY: z.string().min(1).optional(),
  GEMINI_LIVE_MODEL: z.string().min(1).default('gemini-2.5-flash-native-audio-preview-12-2025'),
  GEMINI_TTS_MODEL: z.string().min(1).default('gemini-2.5-flash-preview-tts'),
  GEMINI_ORDER_EXTRACTION_MODEL: z.string().min(1).default('gemini-2.5-flash'),
  GEMINI_LIVE_TOKEN_TTL_MINUTES: z.coerce.number().int().min(1).max(60).default(10),
  GEMINI_LIVE_NEW_SESSION_TTL_SECONDS: z.coerce.number().int().min(15).max(300).default(60),
  WEBHOOK_DELIVERY_TIMEOUT_MS: z.coerce.number().int().min(500).max(15000).default(4000)
})

const parsedEnv = envSchema.safeParse(process.env)

if (!parsedEnv.success) {
  const issues = parsedEnv.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ')
  throw new Error(`Invalid environment configuration: ${issues}`)
}

export const env = parsedEnv.data
export const isProduction = env.NODE_ENV === 'production'
