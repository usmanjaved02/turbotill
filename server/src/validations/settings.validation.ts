import { z } from 'zod'

const optionalPhoneSchema = z.string().trim().min(5).max(30).optional().or(z.literal(''))

const passwordSchema = z
  .string()
  .min(12)
  .max(128)
  .regex(/[A-Z]/, 'Password must include an uppercase letter')
  .regex(/[a-z]/, 'Password must include a lowercase letter')
  .regex(/\d/, 'Password must include a number')
  .regex(/[^A-Za-z0-9]/, 'Password must include a symbol')

export const updateProfileSchema = z
  .object({
    fullName: z.string().trim().min(2).max(120),
    businessName: z.string().trim().min(2).max(160),
    email: z.email().max(160).transform((value) => value.toLowerCase().trim()),
    phone: optionalPhoneSchema,
    currentPassword: z.string().min(1).max(128).optional(),
    newPassword: passwordSchema.optional()
  })
  .superRefine((payload, context) => {
    if (payload.newPassword && !payload.currentPassword) {
      context.addIssue({
        code: 'custom',
        path: ['currentPassword'],
        message: 'Current password is required to set a new password'
      })
    }
  })

export const updateWorkspaceSchema = z.object({
  businessName: z.string().trim().min(2).max(160),
  businessLogo: z.string().trim().url().max(500).optional().or(z.literal('')),
  defaultCurrency: z.enum(['USD', 'EUR', 'GBP']),
  timezone: z.string().trim().min(3).max(100),
  notificationPreferences: z.object({
    emailAlerts: z.boolean(),
    smsAlerts: z.boolean()
  })
})
