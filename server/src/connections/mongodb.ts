import mongoose from 'mongoose'
import { env } from '../config/env.js'
import { logger } from '../helpers/logger.js'

export const connectMongo = async (): Promise<void> => {
  mongoose.set('strictQuery', true)
  await mongoose.connect(env.MONGODB_URI, {
    autoIndex: env.NODE_ENV !== 'production'
  })
  logger.info('MongoDB connection established')
}

export const disconnectMongo = async (): Promise<void> => {
  await mongoose.disconnect()
  logger.info('MongoDB connection closed')
}
