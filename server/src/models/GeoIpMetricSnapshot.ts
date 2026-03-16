import { Schema, model } from 'mongoose'

const geoIpMetricSnapshotSchema = new Schema(
  {
    periodStartedAt: {
      type: Date,
      required: true,
      index: true
    },
    periodEndedAt: {
      type: Date,
      required: true
    },
    totalRequests: {
      type: Number,
      required: true,
      default: 0
    },
    cacheHits: {
      type: Number,
      required: true,
      default: 0
    },
    cacheMisses: {
      type: Number,
      required: true,
      default: 0
    },
    privateRequests: {
      type: Number,
      required: true,
      default: 0
    },
    pendingLookups: {
      type: Number,
      required: true,
      default: 0
    },
    unavailableLookups: {
      type: Number,
      required: true,
      default: 0
    },
    remoteLookupsCompleted: {
      type: Number,
      required: true,
      default: 0
    },
    remoteLookupFailures: {
      type: Number,
      required: true,
      default: 0
    },
    expiredEntriesRemoved: {
      type: Number,
      required: true,
      default: 0
    },
    cacheDocuments: {
      type: Number,
      required: true,
      default: 0
    },
    hitRate: {
      type: Number,
      required: true,
      default: 0
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

geoIpMetricSnapshotSchema.index({ createdAt: -1 })

export const GeoIpMetricSnapshotModel = model('GeoIpMetricSnapshot', geoIpMetricSnapshotSchema)
