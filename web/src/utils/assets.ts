const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:4000/api/v1'
const API_ORIGIN = new URL(API_BASE_URL).origin

export const resolveAssetUrl = (value?: string) => {
  if (!value) return ''
  if (/^(https?:|blob:|data:)/i.test(value)) return value
  if (value.startsWith('/')) return `${API_ORIGIN}${value}`
  return value
}
