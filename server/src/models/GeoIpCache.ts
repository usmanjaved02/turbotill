import { Schema, model } from 'mongoose'

const geoIpCacheSchema = new Schema(
  {
    ipAddress: {
      type: String,
      required: true,
      unique: true,
      index: true,
      maxlength: 120
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

export const GeoIpCacheModel = model('GeoIpCache', geoIpCacheSchema)
