const detectBrowser = (userAgent?: string): string => {
  if (!userAgent) return 'Unknown browser'
  if (/edg\//i.test(userAgent)) return 'Edge'
  if (/chrome\//i.test(userAgent) && !/edg\//i.test(userAgent)) return 'Chrome'
  if (/firefox\//i.test(userAgent)) return 'Firefox'
  if (/safari\//i.test(userAgent) && !/chrome\//i.test(userAgent)) return 'Safari'
  if (/postmanruntime/i.test(userAgent)) return 'Postman'
  return 'Unknown browser'
}

const detectOperatingSystem = (userAgent?: string): string => {
  if (!userAgent) return 'Unknown OS'
  if (/windows/i.test(userAgent)) return 'Windows'
  if (/iphone|ipad|ios/i.test(userAgent)) return 'iOS'
  if (/android/i.test(userAgent)) return 'Android'
  if (/mac os x|macintosh/i.test(userAgent)) return 'macOS'
  if (/linux/i.test(userAgent)) return 'Linux'
  return 'Unknown OS'
}

const detectDeviceType = (userAgent?: string): 'desktop' | 'mobile' | 'tablet' | 'bot' | 'unknown' => {
  if (!userAgent) return 'unknown'
  if (/bot|crawler|spider|headless/i.test(userAgent)) return 'bot'
  if (/ipad|tablet/i.test(userAgent)) return 'tablet'
  if (/mobile|iphone|android/i.test(userAgent)) return 'mobile'
  if (/windows|macintosh|linux/i.test(userAgent)) return 'desktop'
  return 'unknown'
}

export const parseDeviceMetadata = (userAgent?: string) => {
  const browser = detectBrowser(userAgent)
  const operatingSystem = detectOperatingSystem(userAgent)
  const deviceType = detectDeviceType(userAgent)
  const deviceLabel = `${browser} on ${operatingSystem}`

  return {
    browser,
    operatingSystem,
    deviceType,
    deviceLabel
  }
}
