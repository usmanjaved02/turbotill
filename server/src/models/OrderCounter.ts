import { Schema, Types, model } from 'mongoose'

const orderCounterSchema = new Schema(
  {
    ownerId: {
      type: Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    dateKey: {
      type: String,
      required: true,
      trim: true,
      maxlength: 8
    },
    count: {
      type: Number,
      required: true,
      default: 0,
      min: 0
    }
  },
  {
    timestamps: true
  }
)

orderCounterSchema.index({ ownerId: 1, dateKey: 1 }, { unique: true })

export const OrderCounterModel = model('OrderCounter', orderCounterSchema)

