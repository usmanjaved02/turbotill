import { ApiError } from '../helpers/ApiError.js'
import { comparePassword, hashPassword } from '../helpers/password.js'
import { mapUser } from '../helpers/user.js'
import { UserModel } from '../models/User.js'

interface UpdateProfileInput {
  fullName: string
  businessName: string
  email: string
  phone?: string
  currentPassword?: string
  newPassword?: string
}

interface UpdateWorkspaceInput {
  businessName: string
  businessLogo?: string
  defaultCurrency: 'USD' | 'EUR' | 'GBP'
  timezone: string
  notificationPreferences: {
    emailAlerts: boolean
    smsAlerts: boolean
  }
}

export const settingsService = {
  getUserById: async (userId: string) => {
    const user = await UserModel.findById(userId).lean()
    if (!user) {
      throw new ApiError(404, 'User not found', 'USER_NOT_FOUND')
    }

    return mapUser(user)
  },

  updateProfile: async (userId: string, payload: UpdateProfileInput) => {
    const user = await UserModel.findById(userId).select('+passwordHash')
    if (!user) {
      throw new ApiError(404, 'User not found', 'USER_NOT_FOUND')
    }

    if (payload.email !== user.email) {
      const existingUser = await UserModel.findOne({ email: payload.email, _id: { $ne: userId } }).lean()
      if (existingUser) {
        throw new ApiError(409, 'An account with this email already exists', 'EMAIL_ALREADY_EXISTS')
      }
    }

    if (payload.newPassword) {
      const passwordMatches = await comparePassword(payload.currentPassword ?? '', user.passwordHash)
      if (!passwordMatches) {
        throw new ApiError(401, 'Current password is incorrect', 'INVALID_CURRENT_PASSWORD')
      }
      user.passwordHash = await hashPassword(payload.newPassword)
    }

    user.fullName = payload.fullName
    user.businessName = payload.businessName
    user.email = payload.email
    user.phone = payload.phone?.trim() ? payload.phone.trim() : undefined

    await user.save()
    return mapUser(user)
  },

  updateWorkspace: async (userId: string, payload: UpdateWorkspaceInput) => {
    const user = await UserModel.findByIdAndUpdate(
      userId,
      {
        businessName: payload.businessName,
        businessLogo: payload.businessLogo?.trim() ? payload.businessLogo.trim() : undefined,
        defaultCurrency: payload.defaultCurrency,
        timezone: payload.timezone,
        notificationPreferences: payload.notificationPreferences
      },
      {
        new: true,
        runValidators: true
      }
    ).lean()

    if (!user) {
      throw new ApiError(404, 'User not found', 'USER_NOT_FOUND')
    }

    return mapUser(user)
  },

  updateProfileMedia: async (
    userId: string,
    payload: {
      avatarUrl?: string
      businessLogo?: string
    }
  ) => {
    const user = await UserModel.findByIdAndUpdate(
      userId,
      payload,
      {
        new: true,
        runValidators: true
      }
    ).lean()

    if (!user) {
      throw new ApiError(404, 'User not found', 'USER_NOT_FOUND')
    }

    return mapUser(user)
  }
}
