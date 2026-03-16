import fs from 'node:fs/promises'
import path from 'node:path'
import { env } from '../config/env.js'
import { ApiError } from '../helpers/ApiError.js'
import { addHours } from '../helpers/date.js'
import { logger } from '../helpers/logger.js'
import { buildUploadUrl, ensureDirectory, removeUploadIfLocal, uploadsRoot } from '../helpers/uploads.js'
import { AuditExportJobModel } from '../models/AuditExportJob.js'
import { AuditLogModel } from '../models/AuditLog.js'
import { AuditSavedFilterModel } from '../models/AuditSavedFilter.js'

interface AuditInput {
  actorId?: string
  actorEmail?: string
  actorRole?: 'owner' | 'admin' | 'manager' | 'viewer'
  action: string
  entityType: string
  entityId?: string
  metadata?: Record<string, unknown>
  ipAddress?: string
  userAgent?: string
}

export interface AuditListQuery {
  actorId: string
  page?: number
  limit?: number
  action?: string
  entityType?: string
  actorEmail?: string
  search?: string
  from?: string
  to?: string
}

interface CreateAuditSavedFilterInput {
  name: string
  filters?: Partial<Omit<AuditListQuery, 'actorId' | 'page'>>
}

interface CreateAuditExportJobInput {
  format: 'csv' | 'json'
  filters?: Partial<Omit<AuditListQuery, 'actorId' | 'page'>>
}

const processingJobIds = new Set<string>()
let exportWorkerTimer: NodeJS.Timeout | null = null
let lastExportCleanupAt = 0

const mapAuditLog = (entry: any) => ({
  id: entry._id.toString(),
  actorId: entry.actorId?.toString?.() ?? null,
  actorEmail: entry.actorEmail ?? null,
  actorRole: entry.actorRole ?? null,
  action: entry.action,
  entityType: entry.entityType,
  entityId: entry.entityId ?? null,
  metadata: entry.metadata ?? null,
  ipAddress: entry.ipAddress ?? null,
  userAgent: entry.userAgent ?? null,
  createdAt: entry.createdAt.toISOString()
})

const mapSavedFilter = (entry: any) => ({
  id: entry._id.toString(),
  name: entry.name,
  filters: {
    search: entry.filters?.search ?? '',
    action: entry.filters?.action ?? '',
    entityType: entry.filters?.entityType ?? '',
    actorEmail: entry.filters?.actorEmail ?? '',
    from: entry.filters?.from ?? '',
    to: entry.filters?.to ?? '',
    limit: entry.filters?.limit ?? 10
  },
  createdAt: entry.createdAt.toISOString(),
  updatedAt: entry.updatedAt.toISOString()
})

const mapExportJob = (entry: any) => ({
  id: entry._id.toString(),
  format: entry.format,
  status: entry.status,
  filters: entry.filters ?? {},
  totalRows: entry.totalRows ?? 0,
  filename: entry.filename ?? null,
  fileUrl: entry.fileUrl ?? null,
  contentType: entry.contentType ?? null,
  errorMessage: entry.errorMessage ?? null,
  startedAt: entry.startedAt?.toISOString?.() ?? null,
  completedAt: entry.completedAt?.toISOString?.() ?? null,
  createdAt: entry.createdAt.toISOString(),
  expiresAt: entry.expiresAt.toISOString()
})

const escapeCsvValue = (value: unknown) => {
  const normalized = value == null ? '' : String(value)
  if (/[",\n]/.test(normalized)) {
    return `"${normalized.replace(/"/g, '""')}"`
  }
  return normalized
}

const normalizeAuditFilters = (query: Partial<Omit<AuditListQuery, 'actorId' | 'page'>>) => ({
  limit: Math.min(Math.max(Number(query.limit ?? 10), 1), 100),
  action: typeof query.action === 'string' ? query.action.trim() || undefined : undefined,
  entityType: typeof query.entityType === 'string' ? query.entityType.trim() || undefined : undefined,
  actorEmail: typeof query.actorEmail === 'string' ? query.actorEmail.trim().toLowerCase() || undefined : undefined,
  search: typeof query.search === 'string' ? query.search.trim() || undefined : undefined,
  from: typeof query.from === 'string' ? query.from.trim() || undefined : undefined,
  to: typeof query.to === 'string' ? query.to.trim() || undefined : undefined
})

const buildAuditFilter = (query: AuditListQuery) => {
  const normalized = normalizeAuditFilters(query)
  const filter: Record<string, unknown> = {
    actorId: query.actorId
  }

  if (normalized.action) {
    filter.action = normalized.action
  }

  if (normalized.entityType) {
    filter.entityType = normalized.entityType
  }

  if (normalized.actorEmail) {
    filter.actorEmail = normalized.actorEmail
  }

  if (normalized.search) {
    const searchRegex = new RegExp(normalized.search, 'i')
    filter.$or = [{ action: searchRegex }, { entityType: searchRegex }, { entityId: searchRegex }, { actorEmail: searchRegex }]
  }

  if (normalized.from || normalized.to) {
    filter.createdAt = {
      ...(normalized.from ? { $gte: new Date(normalized.from) } : {}),
      ...(normalized.to ? { $lte: new Date(normalized.to) } : {})
    }
  }

  return filter
}

const renderExportRows = (logs: ReturnType<typeof mapAuditLog>[], format: 'csv' | 'json') => {
  if (format === 'json') {
    return {
      contentType: 'application/json; charset=utf-8',
      body: JSON.stringify(logs, null, 2)
    }
  }

  const headers = ['createdAt', 'action', 'entityType', 'entityId', 'actorEmail', 'actorRole', 'ipAddress', 'userAgent']
  const csvRows = [
    headers.join(','),
    ...logs.map((entry) =>
      [entry.createdAt, entry.action, entry.entityType, entry.entityId, entry.actorEmail, entry.actorRole, entry.ipAddress, entry.userAgent]
        .map(escapeCsvValue)
        .join(',')
    )
  ]

  return {
    contentType: 'text/csv; charset=utf-8',
    body: csvRows.join('\n')
  }
}

const buildExportFilename = (jobId: string, format: 'csv' | 'json') => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  return `audit-export-${timestamp}-${jobId}.${format}`
}

const buildExportFilePath = (filename: string) => path.join(uploadsRoot(), 'exports', filename)

const prepareExportPayload = async (query: AuditListQuery, format: 'csv' | 'json') => {
  const filter = buildAuditFilter(query)
  const total = await AuditLogModel.countDocuments(filter)

  if (total > env.AUDIT_EXPORT_MAX_ROWS) {
    throw new ApiError(413, 'Audit export exceeds the maximum allowed row count', 'EXPORT_TOO_LARGE', {
      total,
      limit: env.AUDIT_EXPORT_MAX_ROWS
    })
  }

  const logs = await AuditLogModel.find(filter)
    .sort({ createdAt: -1 })
    .limit(env.AUDIT_EXPORT_MAX_ROWS)
    .lean()

  const mappedLogs = logs.map(mapAuditLog)
  const rendered = renderExportRows(mappedLogs, format)

  return {
    total,
    ...rendered
  }
}

const processExportJob = async (jobId: string) => {
  if (processingJobIds.has(jobId)) {
    return
  }

  processingJobIds.add(jobId)

  try {
    const job = await AuditExportJobModel.findById(jobId)
    if (!job || job.status === 'completed') {
      return
    }

    job.status = 'processing'
    job.startedAt = new Date()
    job.errorMessage = undefined
    await job.save()

    const { total, body, contentType } = await prepareExportPayload(
      {
        actorId: job.userId.toString(),
        ...normalizeAuditFilters({
          search: job.filters?.search ?? undefined,
          action: job.filters?.action ?? undefined,
          entityType: job.filters?.entityType ?? undefined,
          actorEmail: job.filters?.actorEmail ?? undefined,
          from: job.filters?.from ?? undefined,
          to: job.filters?.to ?? undefined,
          limit: job.filters?.limit ?? undefined
        })
      },
      job.format
    )

    const filename = buildExportFilename(job._id.toString(), job.format)
    const directory = path.join(uploadsRoot(), 'exports')
    await ensureDirectory(directory)
    const filePath = buildExportFilePath(filename)
    await fs.writeFile(filePath, body, 'utf8')

    job.status = 'completed'
    job.totalRows = total
    job.filename = filename
    job.fileUrl = buildUploadUrl('exports', filename)
    job.contentType = contentType
    job.completedAt = new Date()
    job.expiresAt = addHours(new Date(), env.AUDIT_EXPORT_JOB_TTL_HOURS)
    await job.save()
  } catch (error) {
    logger.error({ err: error, jobId }, 'Failed to process audit export job')
    await AuditExportJobModel.findByIdAndUpdate(jobId, {
      status: 'failed',
      errorMessage: error instanceof Error ? error.message : 'Unknown export error',
      completedAt: new Date()
    })
  } finally {
    processingJobIds.delete(jobId)
  }
}

const cleanupExpiredExportArtifacts = async () => {
  const expiredJobs = await AuditExportJobModel.find({ expiresAt: { $lte: new Date() } })
    .select({ fileUrl: 1 })
    .lean()

  await Promise.all(expiredJobs.map((job) => removeUploadIfLocal(job.fileUrl ?? undefined)))

  if (expiredJobs.length > 0) {
    await AuditExportJobModel.deleteMany({ _id: { $in: expiredJobs.map((job) => job._id) } })
  }

  return expiredJobs.length
}

const scanPendingExportJobs = async () => {
  const pendingJobs = await AuditExportJobModel.find({ status: 'pending' })
    .sort({ createdAt: 1 })
    .limit(3)
    .lean()

  await Promise.all(
    pendingJobs
      .filter((job) => !processingJobIds.has(job._id.toString()))
      .map((job) => processExportJob(job._id.toString()))
  )
}

export const auditService = {
  record: async (payload: AuditInput) => {
    await AuditLogModel.create(payload)
  },

  listRecent: async (query: AuditListQuery) => {
    const page = Math.max(query.page ?? 1, 1)
    const limit = Math.min(Math.max(query.limit ?? 20, 1), 100)
    const filter = buildAuditFilter(query)

    const [logs, total] = await Promise.all([
      AuditLogModel.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      AuditLogModel.countDocuments(filter)
    ])

    return {
      logs: logs.map(mapAuditLog),
      page,
      limit,
      total,
      totalPages: Math.max(Math.ceil(total / limit), 1)
    }
  },

  listSavedFilters: async (userId: string) => {
    const entries = await AuditSavedFilterModel.find({ userId }).sort({ updatedAt: -1 }).lean()
    return {
      filters: entries.map(mapSavedFilter)
    }
  },

  createSavedFilter: async (userId: string, input: CreateAuditSavedFilterInput) => {
    const count = await AuditSavedFilterModel.countDocuments({ userId })
    if (count >= 25) {
      throw new ApiError(400, 'You have reached the saved audit filter limit', 'AUDIT_FILTER_LIMIT_REACHED', {
        limit: 25
      })
    }

    try {
      const entry = await AuditSavedFilterModel.create({
        userId,
        name: input.name.trim(),
        filters: normalizeAuditFilters(input.filters ?? {})
      })

      return {
        filter: mapSavedFilter(entry)
      }
    } catch (error) {
      if ((error as { code?: number }).code === 11000) {
        throw new ApiError(409, 'A saved audit filter with this name already exists', 'AUDIT_FILTER_DUPLICATE')
      }
      throw error
    }
  },

  deleteSavedFilter: async (userId: string, filterId: string) => {
    const deleted = await AuditSavedFilterModel.findOneAndDelete({ _id: filterId, userId })
    if (!deleted) {
      throw new ApiError(404, 'Saved audit filter not found', 'AUDIT_FILTER_NOT_FOUND')
    }

    return {
      filterId
    }
  },

  exportLogs: async (query: AuditListQuery, format: 'csv' | 'json') => {
    const filter = buildAuditFilter(query)
    const total = await AuditLogModel.countDocuments(filter)

    if (total > env.AUDIT_EXPORT_MAX_ROWS) {
      throw new ApiError(413, 'Audit export exceeds the maximum allowed row count', 'EXPORT_TOO_LARGE', {
        total,
        limit: env.AUDIT_EXPORT_MAX_ROWS
      })
    }

    if (total > env.AUDIT_INLINE_EXPORT_LIMIT) {
      throw new ApiError(409, 'Audit export is too large for an inline download and must be queued', 'EXPORT_REQUIRES_ASYNC', {
        total,
        inlineLimit: env.AUDIT_INLINE_EXPORT_LIMIT
      })
    }

    const { body, contentType } = await prepareExportPayload(query, format)

    return {
      contentType,
      filename: `audit-logs-${new Date().toISOString().slice(0, 10)}.${format}`,
      body
    }
  },

  listExportJobs: async (userId: string) => {
    const jobs = await AuditExportJobModel.find({ userId }).sort({ createdAt: -1 }).limit(10).lean()
    return {
      jobs: jobs.map(mapExportJob)
    }
  },

  getExportJob: async (userId: string, jobId: string) => {
    const job = await AuditExportJobModel.findOne({ _id: jobId, userId }).lean()
    if (!job) {
      throw new ApiError(404, 'Audit export job not found', 'AUDIT_EXPORT_JOB_NOT_FOUND')
    }

    return {
      job: mapExportJob(job)
    }
  },

  createExportJob: async (userId: string, input: CreateAuditExportJobInput) => {
    const normalizedFilters = normalizeAuditFilters(input.filters ?? {})
    const filter = buildAuditFilter({ actorId: userId, ...normalizedFilters })
    const total = await AuditLogModel.countDocuments(filter)

    if (total > env.AUDIT_EXPORT_MAX_ROWS) {
      throw new ApiError(413, 'Audit export exceeds the maximum allowed row count', 'EXPORT_TOO_LARGE', {
        total,
        limit: env.AUDIT_EXPORT_MAX_ROWS
      })
    }

    const job = await AuditExportJobModel.create({
      userId,
      format: input.format,
      filters: normalizedFilters,
      totalRows: total,
      status: 'pending',
      expiresAt: addHours(new Date(), env.AUDIT_EXPORT_JOB_TTL_HOURS)
    })

    queueMicrotask(() => {
      void processExportJob(job._id.toString())
    })

    return {
      job: mapExportJob(job)
    }
  },

  startBackgroundWorkers: () => {
    if (exportWorkerTimer) {
      return
    }

    exportWorkerTimer = setInterval(() => {
      const now = Date.now()
      if (now - lastExportCleanupAt >= 15 * 60 * 1000) {
        lastExportCleanupAt = now
        void cleanupExpiredExportArtifacts()
      }
      void scanPendingExportJobs()
    }, env.AUDIT_EXPORT_POLL_INTERVAL_MS)
  },

  stopBackgroundWorkers: () => {
    if (exportWorkerTimer) {
      clearInterval(exportWorkerTimer)
      exportWorkerTimer = null
    }
  }
}
