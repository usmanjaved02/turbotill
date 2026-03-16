import { Schema, Types, model } from 'mongoose'

const productSchema = new Schema(
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
      maxlength: 180
    },
    sku: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80
    },
    category: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 3000
    },
    price: {
      type: Number,
      required: true,
      min: 0
    },
    currency: {
      type: String,
      enum: ['USD', 'EUR', 'GBP'],
      default: 'USD'
    },
    discount: {
      type: Number,
      min: 0,
      max: 90
    },
    status: {
      type: String,
      enum: ['draft', 'published', 'archived'],
      default: 'draft'
    },
    image: {
      type: String,
      trim: true
    }
  },
  {
    timestamps: true
  }
)

productSchema.index({ ownerId: 1, sku: 1 }, { unique: true })

export const ProductModel = model('Product', productSchema)
