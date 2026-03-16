import { Schema, model } from 'mongoose'

const auditExportJobSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    format: {
      type: String,
      enum: ['csv', 'json'],
      required: true
    },
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed'],
      default: 'pending',
      index: true
    },
    filters: {
      search: {
        type: String,
        trim: true,
        maxlength: 120
      },
      action: {
        type: String,
        trim: true,
        maxlength: 80
      },
      entityType: {
        type: String,
        trim: true,
        maxlength: 80
      },
      actorEmail: {
        type: String,
        trim: true,
        lowercase: true,
        maxlength: 160
      },
      from: {
        type: String,
        trim: true,
        maxlength: 40
      },
      to: {
        type: String,
        trim: true,
        maxlength: 40
      },
      limit: {
        type: Number,
        min: 1,
        max: 100
      }
    },
    totalRows: {
      type: Number,
      default: 0
    },
    filename: {
      type: String,
      trim: true,
      maxlength: 200
    },
    fileUrl: {
      type: String,
      trim: true,
      maxlength: 500
    },
    contentType: {
      type: String,
      trim: true,
      maxlength: 120
    },
    errorMessage: {
      type: String,
      trim: true,
      maxlength: 500
    },
    startedAt: {
      type: Date
    },
    completedAt: {
      type: Date
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

auditExportJobSchema.index({ userId: 1, createdAt: -1 })

export const AuditExportJobModel = model('AuditExportJob', auditExportJobSchema)
