import { z } from 'zod'
import { objectIdSchema } from './common.validation.js'
import { GEMINI_LIVE_LANGUAGE_CODES, GEMINI_LIVE_VOICE_NAMES } from '../constants/geminiLiveVoiceOptions.js'

const DEFAULT_VOICE_PREVIEW_TEXT = 'Hello, this is how your agent voice will sound while taking orders.'

const optionalTextField = (max: number) =>
  z
    .union([z.string().trim().max(max), z.literal(''), z.undefined()])
    .transform((value) => (typeof value === 'string' && value.trim() ? value.trim() : undefined))

const optionalEmailField = z
  .union([z.email().max(160), z.literal(''), z.undefined()])
  .transform((value) => (typeof value === 'string' && value.trim() ? value.toLowerCase().trim() : undefined))

const optionalUrlField = z
  .union([z.url().max(2048), z.literal(''), z.undefined()])
  .transform((value) => (typeof value === 'string' && value.trim() ? value.trim() : undefined))

const tableConfigSchema = z.object({
  allowMultipleOrdersPerTable: z.boolean().default(true),
  defaultTableNumber: optionalTextField(40),
  customerEntryUrl: optionalUrlField
})

const voiceProfileSchema = z.object({
  languageCode: z.enum(GEMINI_LIVE_LANGUAGE_CODES).default('en-US'),
  gender: z.enum(['female', 'male', 'neutral']).default('female'),
  voiceName: z.enum(GEMINI_LIVE_VOICE_NAMES).default('Kore')
})

export const createLiveVoicePreviewSchema = z.object({
  text: z
    .union([z.string().trim().max(500), z.undefined()])
    .transform((value) => (typeof value === 'string' && value.trim() ? value.trim() : DEFAULT_VOICE_PREVIEW_TEXT)),
  voiceProfile: voiceProfileSchema
})

export const publicTableOrderQuerySchema = z.object({
  table: optionalTextField(40)
})

export const createPublicTableOrderSchema = z.object({
  tableNumber: optionalTextField(40),
  customerName: z.string().trim().min(2).max(160),
  customerPhone: optionalTextField(40),
  customerEmail: optionalEmailField,
  notes: optionalTextField(2000),
  items: z
    .array(
      z.object({
        productId: objectIdSchema,
        quantity: z.number().int().min(1).max(1000)
      })
    )
    .min(1)
    .max(25)
})

export const createPublicLiveSessionSchema = z.object({
  source: z.enum(['mic', 'script']).default('mic'),
  tableNumber: optionalTextField(40)
})

export const agentBodySchema = z.object({
  name: z.string().trim().min(2).max(140),
  agentType: z.enum(['terminal', 'table_order_taker', 'whatsapp_call_attendant']).default('terminal'),
  description: z.string().trim().max(1000).optional(),
  productAccess: z.enum(['all', 'selected']),
  productIds: z.array(objectIdSchema).max(200),
  webhookUrl: z.url().optional().or(z.literal('')),
  webhookSecret: z.string().max(200).optional().or(z.literal('')),
  mode: z.enum(['mic', 'script']),
  tableConfig: tableConfigSchema.optional(),
  voiceProfile: voiceProfileSchema.default({
    languageCode: 'en-US',
    gender: 'female',
    voiceName: 'Kore'
  }),
  isActive: z.boolean()
}).transform((value) => {
  if (value.agentType !== 'table_order_taker') {
    return {
      ...value,
      tableConfig: undefined
    }
  }

  return {
    ...value,
    tableConfig: {
      allowMultipleOrdersPerTable: value.tableConfig?.allowMultipleOrdersPerTable ?? true,
      defaultTableNumber: value.tableConfig?.defaultTableNumber,
      customerEntryUrl: value.tableConfig?.customerEntryUrl
    }
  }
})

export const agentToggleSchema = z.object({
  isActive: z.boolean()
})

export const webhookTestSchema = z.object({
  url: z.url()
})

export const liveSessionParamsSchema = z.object({
  id: objectIdSchema
})

export const createLiveSessionSchema = z.object({
  source: z.enum(['mic', 'script']).default('mic')
})

export const createLiveOrderSchema = z.object({
  customerName: z.string().trim().min(2).max(160),
  customerPhone: optionalTextField(40),
  customerEmail: optionalEmailField,
  tableNumber: optionalTextField(40),
  notes: optionalTextField(2000),
  items: z
    .array(
      z.object({
        productLabel: z.string().trim().min(1).max(160),
        quantity: z.number().int().min(1).max(1000)
      })
    )
    .min(1)
    .max(25),
  source: z.enum(['mic', 'script']).default('mic')
})

export const createConversationLiveOrderSchema = z.object({
  source: z.enum(['mic', 'script']).default('mic'),
  tableNumber: optionalTextField(40),
  conversation: z
    .array(
      z.object({
        speaker: z.enum(['customer', 'agent']),
        text: z.string().trim().min(1).max(500)
      })
    )
    .min(1)
    .max(80),
  hints: z
    .object({
      customerName: z.string().trim().min(2).max(160).optional(),
      tableNumber: optionalTextField(40)
    })
    .optional()
})
