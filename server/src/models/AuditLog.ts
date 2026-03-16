import { Schema, Types, model } from 'mongoose'

const auditLogSchema = new Schema(
  {
    actorId: {
      type: Types.ObjectId,
      ref: 'User'
    },
    actorEmail: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: 160
    },
    actorRole: {
      type: String,
      enum: ['owner', 'admin', 'manager', 'viewer']
    },
    action: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
      index: true
    },
    entityType: {
      type: String,
      required: true,
      trim: true,
      maxlength: 60
    },
    entityId: {
      type: String,
      trim: true,
      maxlength: 80
    },
    metadata: {
      type: Schema.Types.Mixed
    },
    ipAddress: {
      type: String,
      trim: true,
      maxlength: 120
    },
    userAgent: {
      type: String,
      trim: true,
      maxlength: 400
    }
  },
  {
    timestamps: true
  }
)

auditLogSchema.index({ createdAt: -1, actorId: 1, action: 1 })

export const AuditLogModel = model('AuditLog', auditLogSchema)
