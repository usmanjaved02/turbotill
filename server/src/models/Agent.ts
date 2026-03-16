import { Schema, Types, model } from 'mongoose'
import { GEMINI_LIVE_LANGUAGE_CODES, GEMINI_LIVE_VOICE_NAMES } from '../constants/geminiLiveVoiceOptions.js'

const AGENT_TYPE_OPTIONS = ['terminal', 'table_order_taker', 'whatsapp_call_attendant'] as const

const agentSchema = new Schema(
  {
    ownerId: {
      type: Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 140
    },
    agentType: {
      type: String,
      enum: AGENT_TYPE_OPTIONS,
      default: 'terminal',
      required: true
    },
    description: {
      type: String,
      trim: true,
      maxlength: 1000
    },
    productAccess: {
      type: String,
      enum: ['all', 'selected'],
      required: true
    },
    productIds: [
      {
        type: Types.ObjectId,
        ref: 'Product'
      }
    ],
    webhookUrl: {
      type: String,
      trim: true
    },
    webhookSecret: {
      type: String,
      select: false
    },
    webhookStatus: {
      type: String,
      enum: ['connected', 'failed', 'not_configured'],
      default: 'not_configured'
    },
    mode: {
      type: String,
      enum: ['mic', 'script'],
      required: true
    },
    tableConfig: {
      allowMultipleOrdersPerTable: {
        type: Boolean,
        default: true
      },
      defaultTableNumber: {
        type: String,
        trim: true,
        maxlength: 40
      },
      customerEntryUrl: {
        type: String,
        trim: true,
        maxlength: 2048
      }
    },
    voiceProfile: {
      languageCode: {
        type: String,
        enum: GEMINI_LIVE_LANGUAGE_CODES,
        default: 'en-US'
      },
      gender: {
        type: String,
        enum: ['female', 'male', 'neutral'],
        default: 'female'
      },
      voiceName: {
        type: String,
        enum: GEMINI_LIVE_VOICE_NAMES,
        trim: true,
        default: 'Kore'
      }
    },
    isActive: {
      type: Boolean,
      default: false
    },
    ordersHandled: {
      type: Number,
      default: 0
    },
    lastActivity: {
      type: Date,
      default: Date.now
    },
    embedCode: {
      type: String,
      required: true
    }
  },
  {
    timestamps: true
  }
)

agentSchema.index({ ownerId: 1, name: 1 })

export const AgentModel = model('Agent', agentSchema)
