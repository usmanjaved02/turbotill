import { Router } from 'express'
import { settingsController } from '../controllers/settings.controller.js'
import { requireAuth, requireCsrf } from '../helpers/auth.js'
import { createImageUpload } from '../helpers/uploads.js'
import { validate } from '../helpers/validate.js'
import { updateProfileSchema, updateWorkspaceSchema } from '../validations/settings.validation.js'

export const settingsRouter = Router()
const avatarUpload = createImageUpload('avatars')
const logoUpload = createImageUpload('logos')

settingsRouter.use(requireAuth, requireCsrf)

settingsRouter.patch('/profile', validate(updateProfileSchema), settingsController.updateProfile)
settingsRouter.patch('/workspace', validate(updateWorkspaceSchema), settingsController.updateWorkspace)
settingsRouter.post('/profile/avatar', avatarUpload.single('file'), settingsController.uploadAvatar)
settingsRouter.post('/workspace/logo', logoUpload.single('file'), settingsController.uploadWorkspaceLogo)
