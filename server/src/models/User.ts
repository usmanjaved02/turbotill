import { Schema, Types, model } from 'mongoose'

const userSchema = new Schema(
  {
    fullName: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 120
    },
    businessName: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 160
    },
    organizationId: {
      type: Types.ObjectId,
      ref: 'User',
      index: true
    },
    orderPrefix: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: 12
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true
    },
    phone: {
      type: String,
      trim: true,
      maxlength: 30
    },
    businessLogo: {
      type: String,
      trim: true,
      maxlength: 500
    },
    avatarUrl: {
      type: String,
      trim: true,
      maxlength: 500
    },
    passwordHash: {
      type: String,
      required: true,
      select: false
    },
    role: {
      type: String,
      enum: ['owner', 'admin', 'manager', 'viewer'],
      default: 'owner'
    },
    failedLoginCount: {
      type: Number,
      default: 0,
      select: false
    },
    lockUntil: {
      type: Date,
      select: false
    },
    lastLoginAt: {
      type: Date
    },
    defaultCurrency: {
      type: String,
      enum: ['USD', 'EUR', 'GBP'],
      default: 'USD'
    },
    timezone: {
      type: String,
      trim: true,
      default: 'America/New_York',
      maxlength: 100
    },
    notificationPreferences: {
      emailAlerts: {
        type: Boolean,
        default: true
      },
      smsAlerts: {
        type: Boolean,
        default: false
      }
    }
  },
  {
    timestamps: true
  }
)

export const UserModel = model('User', userSchema)
