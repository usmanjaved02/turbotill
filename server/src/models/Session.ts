import { Schema, model, Types } from 'mongoose'

const sessionSchema = new Schema(
  {
    userId: {
      type: Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    familyId: {
      type: String,
      required: true,
      index: true
    },
    refreshTokenHash: {
      type: String,
      required: true,
      unique: true,
      index: true,
      select: false
    },
    userAgent: {
      type: String,
      trim: true,
      maxlength: 400
    },
    ipAddress: {
      type: String,
      trim: true,
      maxlength: 120
    },
    sessionName: {
      type: String,
      trim: true,
      maxlength: 60
    },
    browser: {
      type: String,
      trim: true,
      maxlength: 80
    },
    operatingSystem: {
      type: String,
      trim: true,
      maxlength: 80
    },
    deviceType: {
      type: String,
      enum: ['desktop', 'mobile', 'tablet', 'bot', 'unknown'],
      default: 'unknown'
    },
    deviceLabel: {
      type: String,
      trim: true,
      maxlength: 160
    },
    locationCity: {
      type: String,
      trim: true,
      maxlength: 100
    },
    locationRegion: {
      type: String,
      trim: true,
      maxlength: 100
    },
    locationCountry: {
      type: String,
      trim: true,
      maxlength: 100
    },
    locationTimezone: {
      type: String,
      trim: true,
      maxlength: 100
    },
    locationLabel: {
      type: String,
      trim: true,
      maxlength: 180
    },
    geoSource: {
      type: String,
      trim: true,
      maxlength: 40
    },
    lastUsedAt: {
      type: Date,
      default: Date.now
    },
    rotatedAt: {
      type: Date
    },
    replacedBySessionId: {
      type: Types.ObjectId,
      ref: 'Session'
    },
    revokedAt: {
      type: Date
    },
    revokedReason: {
      type: String,
      enum: ['logout', 'session_revoked', 'family_revoked', 'reuse_detected']
    },
    expiresAt: {
      type: Date,
      required: true,
      index: {
        expireAfterSeconds: 0
      }
    }
  },
  {
    timestamps: true
  }
)

export const SessionModel = model('Session', sessionSchema)
