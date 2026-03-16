export const isValidEmail = (value: string) => {
  const normalized = value.trim()
  if (!normalized) {
    return false
  }

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)
}

export const evaluatePassword = (value: string) => ({
  minLength: value.length >= 12,
  uppercase: /[A-Z]/.test(value),
  lowercase: /[a-z]/.test(value),
  number: /\d/.test(value),
  symbol: /[^A-Za-z0-9]/.test(value)
})

export const getPasswordValidationMessage = (value: string) => {
  const rules = evaluatePassword(value)
  if (rules.minLength && rules.uppercase && rules.lowercase && rules.number && rules.symbol) {
    return null
  }

  return 'Use at least 12 characters with uppercase, lowercase, number, and symbol.'
}
