export const mapUser = (user: any) => ({
  id: user._id.toString(),
  fullName: user.fullName,
  businessName: user.businessName,
  email: user.email,
  role: user.role,
  defaultCurrency: user.defaultCurrency,
  timezone: user.timezone,
  notificationPreferences: {
    emailAlerts: Boolean(user.notificationPreferences?.emailAlerts),
    smsAlerts: Boolean(user.notificationPreferences?.smsAlerts)
  },
  ...(user.orderPrefix ? { orderPrefix: user.orderPrefix } : {}),
  ...(user.phone ? { phone: user.phone } : {}),
  ...(user.avatarUrl ? { avatarUrl: user.avatarUrl } : {}),
  ...(user.businessLogo ? { businessLogo: user.businessLogo } : {})
})
