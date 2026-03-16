import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import multer from 'multer'
import { env } from '../config/env.js'
import { ApiError } from './ApiError.js'

const allowedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp'])

const getUploadsRoot = () => path.resolve(process.cwd(), env.UPLOAD_DIR)

export const ensureDirectory = async (directory: string) => {
  await fs.mkdir(directory, { recursive: true })
}

const sanitizeExtension = (mimeType: string) => {
  if (mimeType === 'image/png') return '.png'
  if (mimeType === 'image/webp') return '.webp'
  return '.jpg'
}

export const createImageUpload = (subdirectory: string) =>
  multer({
    storage: multer.diskStorage({
      destination: async (_req, _file, callback) => {
        try {
          const directory = path.join(getUploadsRoot(), subdirectory)
          await ensureDirectory(directory)
          callback(null, directory)
        } catch (error) {
          callback(error as Error, '')
        }
      },
      filename: (_req, file, callback) => {
        const extension = sanitizeExtension(file.mimetype)
        callback(null, `${Date.now()}-${crypto.randomUUID()}${extension}`)
      }
    }),
    limits: {
      fileSize: env.MAX_IMAGE_UPLOAD_MB * 1024 * 1024,
      files: 1
    },
    fileFilter: (_req, file, callback) => {
      if (!allowedMimeTypes.has(file.mimetype)) {
        callback(new ApiError(400, 'Only JPG, PNG, and WEBP images are allowed', 'INVALID_UPLOAD_TYPE'))
        return
      }

      callback(null, true)
    }
  })

export const buildUploadUrl = (subdirectory: string, filename: string) => `/${env.UPLOAD_DIR}/${subdirectory}/${filename}`

export const removeUploadIfLocal = async (fileUrl?: string) => {
  if (!fileUrl || !fileUrl.startsWith(`/${env.UPLOAD_DIR}/`)) {
    return
  }

  const relativePath = fileUrl.replace(`/${env.UPLOAD_DIR}/`, '')
  const filePath = path.join(getUploadsRoot(), relativePath)

  try {
    await fs.unlink(filePath)
  } catch {
    return
  }
}

export const uploadsRoot = getUploadsRoot
