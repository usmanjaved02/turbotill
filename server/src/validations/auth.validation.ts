import { z } from 'zod'

const phoneSchema = z.string().trim().min(5).max(30).optional().or(z.literal(''))
const organizationRoleSchema = z.enum(['admin', 'manager', 'viewer'])
const emailSchema = z
  .string()
  .trim()
  .max(160)
  .email('Please enter a valid email address')
  .transform((value) => value.toLowerCase())
const strongPasswordSchema = z
  .string()
  .min(12, 'Password must be at least 12 characters long')
  .max(128)
  .regex(/[A-Z]/, 'Password must include an uppercase letter')
  .regex(/[a-z]/, 'Password must include a lowercase letter')
  .regex(/\d/, 'Password must include a number')
  .regex(/[^A-Za-z0-9]/, 'Password must include a symbol')

export const signupSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  businessName: z.string().trim().min(2).max(160),
  email: emailSchema,
  password: strongPasswordSchema,
  phone: phoneSchema
})

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(128)
})

export const createOrganizationUserSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: emailSchema,
  password: strongPasswordSchema,
  role: organizationRoleSchema.default('manager'),
  phone: phoneSchema
})
