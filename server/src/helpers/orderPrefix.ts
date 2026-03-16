const normalizeAlphaNumeric = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '')

export const deriveOrderPrefixFromBusinessName = (businessName: string) => {
  const normalized = normalizeAlphaNumeric(businessName)

  if (normalized.length === 0) {
    return 'ot'
  }

  if (normalized.length === 1) {
    return `${normalized}${normalized}`
  }

  return `${normalized[0]}${normalized[normalized.length - 1]}`
}

export const normalizeOrderPrefix = (prefix?: string | null) => {
  const normalized = normalizeAlphaNumeric(prefix ?? '')
  if (normalized.length >= 2) {
    return normalized.slice(0, 6)
  }

  if (normalized.length === 1) {
    return `${normalized}${normalized}`
  }

  return ''
}

