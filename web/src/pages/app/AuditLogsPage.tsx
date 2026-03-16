import { useEffect, useMemo, useState } from 'react'
import { Button } from '../../components/common/Button'
import { Skeleton } from '../../components/common/Skeleton'
import { CloseIcon } from '../../components/common/Icons'
import { useApp } from '../../context/AppContext'
import { ApiClientError, api } from '../../services/api'
import type {
  AuditExportJob,
  AuditLogEntry,
  GeoCacheMetricsCurrent,
  GeoCacheMetricSnapshot,
  SavedAuditFilter
} from '../../types'
import { resolveAssetUrl } from '../../utils/assets'
import { formatDateTime } from '../../utils/format'

const defaultFilters = {
  search: '',
  action: '',
  entityType: '',
  from: '',
  to: '',
  limit: 10
}

const triggerFileDownload = async (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export const AuditLogsPage = () => {
  const {
    state: { user },
    pushToast
  } = useApp()
  const [filters, setFilters] = useState(defaultFilters)
  const [page, setPage] = useState(1)
  const [logs, setLogs] = useState<AuditLogEntry[]>([])
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [savedFilters, setSavedFilters] = useState<SavedAuditFilter[]>([])
  const [filterName, setFilterName] = useState('')
  const [exportingFormat, setExportingFormat] = useState<'csv' | 'json' | null>(null)
  const [exportJobs, setExportJobs] = useState<AuditExportJob[]>([])
  const [geoMetrics, setGeoMetrics] = useState<GeoCacheMetricsCurrent | null>(null)
  const [geoHistory, setGeoHistory] = useState<GeoCacheMetricSnapshot[]>([])
  const [supportLoading, setSupportLoading] = useState(true)

  useEffect(() => {
    let active = true

    const loadLogs = async () => {
      setLoading(true)
      try {
        const result = await api.audit.listRecent({
          page,
          limit: filters.limit,
          search: filters.search || undefined,
          action: filters.action || undefined,
          entityType: filters.entityType || undefined,
          from: filters.from || undefined,
          to: filters.to || undefined
        })

        if (!active) return
        setLogs(result.logs)
        setTotal(result.total)
        setTotalPages(result.totalPages)
      } catch {
        if (!active) return
        setLogs([])
        setTotal(0)
        setTotalPages(1)
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    void loadLogs()
    return () => {
      active = false
    }
  }, [filters, page])

  useEffect(() => {
    if (user?.role !== 'owner' && user?.role !== 'admin') {
      return
    }

    let active = true

    const loadSupportData = async () => {
      setSupportLoading(true)
      try {
        const [saved, jobs, metrics] = await Promise.all([
          api.audit.listSavedFilters(),
          api.audit.listExportJobs(),
          api.audit.getGeoCacheMetrics()
        ])

        if (!active) return
        setSavedFilters(saved.filters)
        setExportJobs(jobs.jobs)
        setGeoMetrics(metrics.current)
        setGeoHistory(metrics.recent)
      } catch {
        if (!active) return
      } finally {
        if (active) {
          setSupportLoading(false)
        }
      }
    }

    void loadSupportData()
    return () => {
      active = false
    }
  }, [user?.role])

  useEffect(() => {
    const hasActiveJobs = exportJobs.some((job) => job.status === 'pending' || job.status === 'processing')
    if (!hasActiveJobs) {
      return
    }

    const interval = window.setInterval(async () => {
      try {
        const result = await api.audit.listExportJobs()
        setExportJobs(result.jobs)
      } catch {
        return
      }
    }, 3000)

    return () => {
      window.clearInterval(interval)
    }
  }, [exportJobs])

  const actionOptions = useMemo(
    () => Array.from(new Set(logs.map((entry) => entry.action))).sort(),
    [logs]
  )

  const entityOptions = useMemo(
    () => Array.from(new Set(logs.map((entry) => entry.entityType))).sort(),
    [logs]
  )

  const handleExport = async (format: 'csv' | 'json') => {
    setExportingFormat(format)

    try {
      const result = await api.audit.exportLogs(filters, format)
      await triggerFileDownload(result.blob, result.filename)
    } catch (error) {
      if (error instanceof ApiClientError && error.code === 'EXPORT_REQUIRES_ASYNC') {
        try {
          const queued = await api.audit.createExportJob({ format, filters })
          setExportJobs((prev) => [queued.job, ...prev.filter((entry) => entry.id !== queued.job.id)])
          pushToast({
            type: 'success',
            title: 'Export queued',
            message: 'This export is being prepared in the background. Download it from the jobs list once it completes.'
          })
        } catch (queueError) {
          pushToast({
            type: 'error',
            title: 'Queue failed',
            message: queueError instanceof Error ? queueError.message : 'Unable to queue the export job.'
          })
        }
      } else {
        pushToast({
          type: 'error',
          title: 'Export failed',
          message: error instanceof Error ? error.message : 'Unable to export audit logs.'
        })
      }
    } finally {
      setExportingFormat(null)
    }
  }

  if (user?.role !== 'owner' && user?.role !== 'admin') {
    return (
      <div className="card">
        <h1>Audit Logs</h1>
        <p className="muted">Only workspace owners and admins can view audit history.</p>
      </div>
    )
  }

  return (
    <div className="stack-lg">
      <section className="card stack-sm">
        <div className="split-row">
          <div>
            <h1>Audit Logs</h1>
            <p className="muted">Trace settings changes, agent activity, and session security events.</p>
          </div>
          <strong>{total} events</strong>
        </div>
        <div className="grid four-col">
          <label>
            Search
            <input
              className="input"
              value={filters.search}
              onChange={(event) => {
                setPage(1)
                setFilters((prev) => ({ ...prev, search: event.target.value }))
              }}
              placeholder="Search action, entity, email..."
            />
          </label>
          <label>
            Action
            <select
              className="input"
              value={filters.action}
              onChange={(event) => {
                setPage(1)
                setFilters((prev) => ({ ...prev, action: event.target.value }))
              }}
            >
              <option value="">All actions</option>
              {actionOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label>
            Entity Type
            <select
              className="input"
              value={filters.entityType}
              onChange={(event) => {
                setPage(1)
                setFilters((prev) => ({ ...prev, entityType: event.target.value }))
              }}
            >
              <option value="">All entities</option>
              {entityOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label>
            Rows
            <select
              className="input"
              value={filters.limit}
              onChange={(event) => {
                setPage(1)
                setFilters((prev) => ({ ...prev, limit: Number(event.target.value) }))
              }}
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
          </label>
          <label>
            From
            <input
              className="input"
              type="date"
              value={filters.from}
              onChange={(event) => {
                setPage(1)
                setFilters((prev) => ({ ...prev, from: event.target.value }))
              }}
            />
          </label>
          <label>
            To
            <input
              className="input"
              type="date"
              value={filters.to}
              onChange={(event) => {
                setPage(1)
                setFilters((prev) => ({ ...prev, to: event.target.value }))
              }}
            />
          </label>
          <div className="row end audit-filter-actions">
            <Button
              variant="ghost"
              onClick={() => {
                setPage(1)
                setFilters(defaultFilters)
              }}
            >
              Reset filters
            </Button>
          </div>
        </div>
        <div className="split-row audit-toolbar">
          <div className="row gap-sm wrap">
            <input
              className="input audit-filter-name"
              value={filterName}
              onChange={(event) => setFilterName(event.target.value)}
              placeholder="Name this filter preset"
            />
            <Button
              variant="secondary"
              onClick={async () => {
                if (!filterName.trim()) {
                  pushToast({
                    type: 'error',
                    title: 'Preset name required',
                    message: 'Enter a name before saving this filter preset.'
                  })
                  return
                }

                try {
                  const result = await api.audit.createSavedFilter({
                    name: filterName.trim(),
                    filters
                  })
                  setSavedFilters((prev) => [result.filter, ...prev.filter((entry) => entry.id !== result.filter.id)])
                  setFilterName('')
                  pushToast({
                    type: 'success',
                    title: 'Filter saved',
                    message: 'This audit filter preset is now available across your account sessions.'
                  })
                } catch (error) {
                  pushToast({
                    type: 'error',
                    title: 'Save failed',
                    message: error instanceof Error ? error.message : 'Unable to save the audit filter preset.'
                  })
                }
              }}
            >
              Save filter
            </Button>
          </div>
          <div className="row gap-sm wrap">
            <Button variant="ghost" disabled={exportingFormat !== null} onClick={() => void handleExport('json')}>
              {exportingFormat === 'json' ? 'Preparing...' : 'Export JSON'}
            </Button>
            <Button disabled={exportingFormat !== null} onClick={() => void handleExport('csv')}>
              {exportingFormat === 'csv' ? 'Preparing...' : 'Export CSV'}
            </Button>
          </div>
        </div>
        {savedFilters.length > 0 ? (
          <div className="audit-saved-filters">
            {savedFilters.map((savedFilter) => (
              <article key={savedFilter.id} className="audit-filter-chip">
                <button
                  className="text-btn"
                  onClick={() => {
                    setPage(1)
                    setFilters({
                      ...defaultFilters,
                      ...savedFilter.filters,
                      limit: savedFilter.filters.limit ?? 10
                    })
                  }}
                >
                  {savedFilter.name}
                </button>
                <button
                  className="icon-btn"
                  onClick={async () => {
                    try {
                      await api.audit.deleteSavedFilter(savedFilter.id)
                      setSavedFilters((prev) => prev.filter((entry) => entry.id !== savedFilter.id))
                    } catch (error) {
                      pushToast({
                        type: 'error',
                        title: 'Delete failed',
                        message: error instanceof Error ? error.message : 'Unable to delete this saved filter.'
                      })
                    }
                  }}
                  aria-label={`Delete ${savedFilter.name}`}
                >
                  <CloseIcon size={14} />
                </button>
              </article>
            ))}
          </div>
        ) : null}
      </section>

      <section className="grid three-col">
        <article className="card stack-xs audit-metric-card">
          <span className="eyebrow">Geo Cache Hit Rate</span>
          {supportLoading ? <Skeleton height={28} /> : <strong>{geoMetrics?.hitRate ?? 0}%</strong>}
          <p className="muted">{geoMetrics?.cacheHits ?? 0} cache hits across {geoMetrics?.totalRequests ?? 0} session lookups in the current window.</p>
        </article>
        <article className="card stack-xs audit-metric-card">
          <span className="eyebrow">Cached Locations</span>
          {supportLoading ? <Skeleton height={28} /> : <strong>{geoMetrics?.cacheDocuments ?? 0}</strong>}
          <p className="muted">Entries are cleaned on a rolling schedule and refreshed by TTL.</p>
        </article>
        <article className="card stack-xs audit-metric-card">
          <span className="eyebrow">Background Lookups</span>
          {supportLoading ? <Skeleton height={28} /> : <strong>{geoMetrics?.remoteLookupsCompleted ?? 0}</strong>}
          <p className="muted">{geoMetrics?.pendingLookups ?? 0} pending, {geoMetrics?.remoteLookupFailures ?? 0} failed in the current monitor period.</p>
        </article>
      </section>

      {geoHistory.length > 0 ? (
        <section className="card stack-sm">
          <div className="split-row">
            <div>
              <h2>Geo Cache History</h2>
              <p className="muted">Recent monitor snapshots for cache performance and cleanup.</p>
            </div>
          </div>
          <div className="audit-table">
            <div className="audit-table-head geo-history-grid">
              <span>Window End</span>
              <span>Hit Rate</span>
              <span>Hits / Misses</span>
              <span>Cleaned</span>
              <span>Cache Size</span>
            </div>
            {geoHistory.slice(0, 6).map((entry) => (
              <article key={entry.id} className="audit-row geo-history-grid">
                <span>{formatDateTime(entry.periodEndedAt)}</span>
                <span>{entry.hitRate}%</span>
                <span>
                  {entry.cacheHits} / {entry.cacheMisses}
                </span>
                <span>{entry.expiredEntriesRemoved}</span>
                <span>{entry.cacheDocuments}</span>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className="card stack-sm">
        <div className="split-row">
          <div>
            <h2>Export Jobs</h2>
            <p className="muted">Large exports are queued here automatically and kept for a limited download window.</p>
          </div>
        </div>
        {supportLoading ? (
          <div className="stack-sm">
            <Skeleton height={18} />
            <Skeleton height={18} />
            <Skeleton height={18} />
          </div>
        ) : exportJobs.length === 0 ? (
          <p className="muted">No background audit exports yet.</p>
        ) : (
          <div className="audit-table">
            <div className="audit-table-head export-jobs-grid">
              <span>Created</span>
              <span>Format</span>
              <span>Status</span>
              <span>Rows</span>
              <span>Download</span>
            </div>
            {exportJobs.map((job) => (
              <article key={job.id} className="audit-row export-jobs-grid">
                <span>{formatDateTime(job.createdAt)}</span>
                <span className="text-uppercase">{job.format}</span>
                <span>
                  <span
                    className={`badge ${
                      job.status === 'completed'
                        ? 'badge-success'
                        : job.status === 'failed'
                          ? 'badge-danger'
                          : 'badge-warning'
                    }`}
                  >
                    {job.status}
                  </span>
                </span>
                <span>{job.totalRows}</span>
                <span>
                  {job.status === 'completed' && job.fileUrl ? (
                    <a className="text-link" href={resolveAssetUrl(job.fileUrl)} target="_blank" rel="noreferrer">
                      Download
                    </a>
                  ) : job.status === 'failed' ? (
                    job.errorMessage ?? 'Failed'
                  ) : (
                    'Preparing...'
                  )}
                </span>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="card stack-sm">
        {loading ? (
          <div className="stack-sm">
            <Skeleton height={18} />
            <Skeleton height={18} />
            <Skeleton height={18} />
            <Skeleton height={18} />
          </div>
        ) : logs.length === 0 ? (
          <div className="audit-empty">
            <p className="muted">No audit events matched the current filters.</p>
          </div>
        ) : (
          <div className="audit-table">
            <div className="audit-table-head">
              <span>When</span>
              <span>Action</span>
              <span>Entity</span>
              <span>Actor</span>
              <span>Network</span>
            </div>
            {logs.map((entry) => (
              <article key={entry.id} className="audit-row">
                <span>{formatDateTime(entry.createdAt)}</span>
                <span className="text-capitalize">{entry.action.replaceAll('.', ' ').replaceAll('_', ' ')}</span>
                <span>
                  {entry.entityType}
                  {entry.entityId ? ` · ${entry.entityId}` : ''}
                </span>
                <span>{entry.actorEmail ?? 'System'}</span>
                <span>{entry.ipAddress ?? 'Unknown IP'}</span>
              </article>
            ))}
          </div>
        )}
        <div className="split-row">
          <p className="muted">
            Page {page} of {totalPages}
          </p>
          <div className="row gap-sm">
            <Button variant="ghost" onClick={() => setPage((prev) => Math.max(prev - 1, 1))} disabled={page === 1}>
              Previous
            </Button>
            <Button variant="secondary" onClick={() => setPage((prev) => Math.min(prev + 1, totalPages))} disabled={page >= totalPages}>
              Next
            </Button>
          </div>
        </div>
      </section>
    </div>
  )
}
