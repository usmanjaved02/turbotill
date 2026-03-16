import { Schema, Types, model } from 'mongoose'

const orderItemSchema = new Schema(
  {
    productId: {
      type: Types.ObjectId,
      ref: 'Product',
      required: true
    },
    productName: {
      type: String,
      required: true
    },
    quantity: {
      type: Number,
      required: true,
      min: 1
    },
    unitPrice: {
      type: Number,
      required: true,
      min: 0
    }
  },
  { _id: false }
)

const timelineSchema = new Schema(
  {
    label: {
      type: String,
      required: true
    },
    at: {
      type: Date,
      required: true
    }
  },
  { _id: false }
)

const orderSchema = new Schema(
  {
    ownerId: {
      type: Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    customerName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160
    },
    customerPhone: {
      type: String,
      trim: true,
      maxlength: 40
    },
    customerEmail: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: 160
    },
    tableNumber: {
      type: String,
      trim: true,
      maxlength: 40
    },
    items: {
      type: [orderItemSchema],
      required: true,
      validate: [(items: unknown[]) => items.length > 0, 'At least one order item is required']
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0
    },
    orderName: {
      type: String,
      trim: true,
      maxlength: 64
    },
    agentId: {
      type: Types.ObjectId,
      ref: 'Agent'
    },
    agentName: {
      type: String
    },
    source: {
      type: String,
      enum: ['mic', 'script', 'human', 'webhook'],
      required: true
    },
    status: {
      type: String,
      enum: ['new', 'confirmed', 'processing', 'completed', 'cancelled'],
      default: 'new'
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 2000
    },
    webhookDelivered: {
      type: Boolean,
      default: false
    },
    timeline: {
      type: [timelineSchema],
      default: []
    }
  },
  {
    timestamps: true
  }
)

orderSchema.index({ ownerId: 1, createdAt: -1 })
orderSchema.index({ ownerId: 1, agentId: 1, tableNumber: 1, status: 1 })
orderSchema.index({ ownerId: 1, orderName: 1 }, { unique: true, sparse: true })

export const OrderModel = model('Order', orderSchema)
