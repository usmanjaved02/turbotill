import { env } from '../config/env.js'
import { addDays } from '../helpers/date.js'
import { logger } from '../helpers/logger.js'
import { GeoIpCacheModel } from '../models/GeoIpCache.js'
import { GeoIpMetricSnapshotModel } from '../models/GeoIpMetricSnapshot.js'

interface GeoMetricCounters {
  totalRequests: number
  cacheHits: number
  cacheMisses: number
  privateRequests: number
  pendingLookups: number
  unavailableLookups: number
  remoteLookupsCompleted: number
  remoteLookupFailures: number
}

type GeoMetricEvent =
  | 'cache_hit'
  | 'cache_miss'
  | 'private_request'
  | 'pending_lookup'
  | 'unavailable_lookup'
  | 'remote_lookup_completed'
  | 'remote_lookup_failed'

const createEmptyCounters = (): GeoMetricCounters => ({
  totalRequests: 0,
  cacheHits: 0,
  cacheMisses: 0,
  privateRequests: 0,
  pendingLookups: 0,
  unavailableLookups: 0,
  remoteLookupsCompleted: 0,
  remoteLookupFailures: 0
})

let counters = createEmptyCounters()
let periodStartedAt = new Date()
let monitorTimer: NodeJS.Timeout | null = null

const buildHitRate = (totalRequests: number, cacheHits: number) =>
  totalRequests > 0 ? Number(((cacheHits / totalRequests) * 100).toFixed(2)) : 0

const snapshotMetrics = async () => {
  const periodEndedAt = new Date()
  const cleanupResult = await GeoIpCacheModel.deleteMany({ expiresAt: { $lte: periodEndedAt } })
  const cacheDocuments = await GeoIpCacheModel.countDocuments({ expiresAt: { $gt: periodEndedAt } })
  const hitRate = buildHitRate(counters.totalRequests, counters.cacheHits)

  const snapshot = await GeoIpMetricSnapshotModel.create({
    periodStartedAt,
    periodEndedAt,
    ...counters,
    expiredEntriesRemoved: cleanupResult.deletedCount ?? 0,
    cacheDocuments,
    hitRate,
    expiresAt: addDays(periodEndedAt, env.GEOIP_METRICS_RETENTION_DAYS)
  })

  logger.info(
    {
      geoCache: {
        hitRate,
        cacheHits: counters.cacheHits,
        cacheMisses: counters.cacheMisses,
        remoteLookupsCompleted: counters.remoteLookupsCompleted,
        remoteLookupFailures: counters.remoteLookupFailures,
        expiredEntriesRemoved: cleanupResult.deletedCount ?? 0,
        cacheDocuments
      }
    },
    'Geo cache metrics snapshot'
  )

  counters = createEmptyCounters()
  periodStartedAt = periodEndedAt

  return snapshot
}

export const geoCacheMonitorService = {
  record: (event: GeoMetricEvent) => {
    switch (event) {
      case 'cache_hit':
        counters.totalRequests += 1
        counters.cacheHits += 1
        break
      case 'cache_miss':
        counters.totalRequests += 1
        counters.cacheMisses += 1
        break
      case 'private_request':
        counters.totalRequests += 1
        counters.privateRequests += 1
        break
      case 'pending_lookup':
        counters.pendingLookups += 1
        break
      case 'unavailable_lookup':
        counters.unavailableLookups += 1
        break
      case 'remote_lookup_completed':
        counters.remoteLookupsCompleted += 1
        break
      case 'remote_lookup_failed':
        counters.remoteLookupFailures += 1
        break
      default:
        break
    }
  },

  getMetrics: async () => {
    const [recentSnapshots, cacheDocuments] = await Promise.all([
      GeoIpMetricSnapshotModel.find().sort({ createdAt: -1 }).limit(12).lean(),
      GeoIpCacheModel.countDocuments({ expiresAt: { $gt: new Date() } })
    ])

    return {
      current: {
        periodStartedAt: periodStartedAt.toISOString(),
        totalRequests: counters.totalRequests,
        cacheHits: counters.cacheHits,
        cacheMisses: counters.cacheMisses,
        privateRequests: counters.privateRequests,
        pendingLookups: counters.pendingLookups,
        unavailableLookups: counters.unavailableLookups,
        remoteLookupsCompleted: counters.remoteLookupsCompleted,
        remoteLookupFailures: counters.remoteLookupFailures,
        cacheDocuments,
        hitRate: buildHitRate(counters.totalRequests, counters.cacheHits)
      },
      recent: recentSnapshots.map((entry) => ({
        id: entry._id.toString(),
        periodStartedAt: entry.periodStartedAt.toISOString(),
        periodEndedAt: entry.periodEndedAt.toISOString(),
        totalRequests: entry.totalRequests,
        cacheHits: entry.cacheHits,
        cacheMisses: entry.cacheMisses,
        privateRequests: entry.privateRequests,
        pendingLookups: entry.pendingLookups,
        unavailableLookups: entry.unavailableLookups,
        remoteLookupsCompleted: entry.remoteLookupsCompleted,
        remoteLookupFailures: entry.remoteLookupFailures,
        expiredEntriesRemoved: entry.expiredEntriesRemoved,
        cacheDocuments: entry.cacheDocuments,
        hitRate: entry.hitRate,
        createdAt: entry.createdAt.toISOString()
      }))
    }
  },

  start: () => {
    if (monitorTimer) {
      return
    }

    monitorTimer = setInterval(() => {
      void snapshotMetrics()
    }, env.GEOIP_MONITOR_INTERVAL_MS)
  },

  stop: () => {
    if (monitorTimer) {
      clearInterval(monitorTimer)
      monitorTimer = null
    }
  }
}
