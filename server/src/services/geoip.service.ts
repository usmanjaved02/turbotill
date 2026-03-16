import { env } from '../config/env.js'
import { addHours } from '../helpers/date.js'
import { SessionModel } from '../models/Session.js'
import { GeoIpCacheModel } from '../models/GeoIpCache.js'
import { geoCacheMonitorService } from './geo-cache-monitor.service.js'

interface GeoLookupResult {
  locationCity?: string
  locationRegion?: string
  locationCountry?: string
  locationTimezone?: string
  locationLabel?: string
  geoSource: string
}

const pendingLookups = new Map<string, Promise<GeoLookupResult | undefined>>()

const isPrivateIp = (ipAddress?: string) => {
  if (!ipAddress) return true
  return (
    ipAddress === '127.0.0.1' ||
    ipAddress.startsWith('10.') ||
    ipAddress.startsWith('192.168.') ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(ipAddress)
  )
}

const buildLocationLabel = (parts: Array<string | undefined>) => {
  const filtered = parts.filter(Boolean)
  return filtered.length > 0 ? filtered.join(', ') : undefined
}

const persistLookupResult = async (ipAddress: string, result: GeoLookupResult) => {
  await GeoIpCacheModel.findOneAndUpdate(
    { ipAddress },
    {
      ipAddress,
      ...result,
      expiresAt: addHours(new Date(), env.GEOIP_CACHE_TTL_HOURS)
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true
    }
  )

  await SessionModel.updateMany(
    {
      ipAddress,
      geoSource: { $in: ['pending', 'unavailable'] }
    },
    result
  )
}

const mapProviderPayload = (payload: Record<string, unknown>): GeoLookupResult | null => {
  const locationCity = (payload.city as string | undefined) ?? (payload.town as string | undefined)
  const locationRegion =
    (payload.region as string | undefined) ??
    (payload.regionName as string | undefined) ??
    (payload.state as string | undefined)
  const locationCountry = (payload.country as string | undefined) ?? (payload.country_name as string | undefined)
  const locationTimezone =
    (payload.timezone as string | undefined) ??
    ((payload.time_zone as { name?: string } | undefined)?.name ?? undefined)

  if (!locationCity && !locationRegion && !locationCountry) {
    return null
  }

  return {
    locationCity,
    locationRegion,
    locationCountry,
    locationTimezone,
    locationLabel: buildLocationLabel([locationCity, locationRegion, locationCountry]),
    geoSource: 'remote'
  }
}

const fetchRemoteLookup = async (ipAddress: string): Promise<GeoLookupResult | undefined> => {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), env.GEOIP_LOOKUP_TIMEOUT_MS)

  try {
    const url = env.GEOIP_LOOKUP_URL_TEMPLATE!.replace('{ip}', encodeURIComponent(ipAddress))
    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        Accept: 'application/json'
      }
    })

    if (!response.ok) {
      geoCacheMonitorService.record('remote_lookup_failed')
      return {
        locationLabel: 'Public network',
        geoSource: 'unavailable'
      }
    }

    const payload = (await response.json()) as Record<string, unknown>
    const mapped = mapProviderPayload(payload)
    if (mapped) {
      geoCacheMonitorService.record('remote_lookup_completed')
      return mapped
    }

    geoCacheMonitorService.record('remote_lookup_failed')
    return { locationLabel: 'Public network', geoSource: 'unavailable' }
  } catch {
    geoCacheMonitorService.record('remote_lookup_failed')
    return {
      locationLabel: 'Public network',
      geoSource: 'unavailable'
    }
  } finally {
    clearTimeout(timeout)
  }
}

const scheduleBackgroundLookup = (ipAddress: string) => {
  if (pendingLookups.has(ipAddress) || !env.GEOIP_LOOKUP_ENABLED || !env.GEOIP_LOOKUP_URL_TEMPLATE) {
    return
  }

  const lookupPromise = (async () => {
    const result = await fetchRemoteLookup(ipAddress)
    if (result && result.geoSource !== 'pending') {
      await persistLookupResult(ipAddress, result)
    }
    return result
  })()

  pendingLookups.set(ipAddress, lookupPromise)
  void lookupPromise.finally(() => {
    pendingLookups.delete(ipAddress)
  })
}

export const geoipService = {
  enrichIpAddress: async (ipAddress?: string): Promise<GeoLookupResult | undefined> => {
    if (!ipAddress) {
      return undefined
    }

    if (isPrivateIp(ipAddress)) {
      geoCacheMonitorService.record('private_request')
      return {
        locationLabel: 'Private network',
        geoSource: 'private'
      }
    }

    const cached = await GeoIpCacheModel.findOne({
      ipAddress,
      expiresAt: { $gt: new Date() }
    }).lean()

    if (cached) {
      geoCacheMonitorService.record('cache_hit')
      return {
        locationCity: cached.locationCity ?? undefined,
        locationRegion: cached.locationRegion ?? undefined,
        locationCountry: cached.locationCountry ?? undefined,
        locationTimezone: cached.locationTimezone ?? undefined,
        locationLabel: cached.locationLabel ?? undefined,
        geoSource: cached.geoSource ?? 'remote'
      }
    }

    geoCacheMonitorService.record('cache_miss')

    if (!env.GEOIP_LOOKUP_ENABLED || !env.GEOIP_LOOKUP_URL_TEMPLATE) {
      geoCacheMonitorService.record('unavailable_lookup')
      return {
        locationLabel: 'Public network',
        geoSource: 'unavailable'
      }
    }
 
    scheduleBackgroundLookup(ipAddress)
    geoCacheMonitorService.record('pending_lookup')
    return {
      locationLabel: 'Public network',
      geoSource: 'pending'
    }
  }
}
