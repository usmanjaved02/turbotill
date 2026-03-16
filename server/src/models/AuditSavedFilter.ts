import { Schema, model } from 'mongoose'

const auditSavedFilterSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 80
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
        max: 100,
        default: 10
      }
    }
  },
  {
    timestamps: true
  }
)

auditSavedFilterSchema.index({ userId: 1, name: 1 }, { unique: true })

export const AuditSavedFilterModel = model('AuditSavedFilter', auditSavedFilterSchema)
