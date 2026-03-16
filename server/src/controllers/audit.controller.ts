import type { Request, Response } from 'express'
import { asyncHandler } from '../helpers/asyncHandler.js'
import { sendSuccess } from '../helpers/response.js'
import { auditService } from '../services/audit.service.js'
import { geoCacheMonitorService } from '../services/geo-cache-monitor.service.js'

const getAuditQuery = (req: Request) => ({
  actorId: req.auth!.userId,
  page: Number(req.query.page ?? 1),
  limit: Number(req.query.limit ?? 20),
  action: typeof req.query.action === 'string' ? req.query.action : undefined,
  entityType: typeof req.query.entityType === 'string' ? req.query.entityType : undefined,
  actorEmail: typeof req.query.actorEmail === 'string' ? req.query.actorEmail : undefined,
  search: typeof req.query.search === 'string' ? req.query.search : undefined,
  from: typeof req.query.from === 'string' ? req.query.from : undefined,
  to: typeof req.query.to === 'string' ? req.query.to : undefined
})

export const auditController = {
  listRecent: asyncHandler(async (req: Request, res: Response) => {
    const result = await auditService.listRecent(getAuditQuery(req))
    sendSuccess(res, result)
  }),

  exportLogs: asyncHandler(async (req: Request, res: Response) => {
    const format = req.query.format === 'csv' ? 'csv' : 'json'
    const result = await auditService.exportLogs(getAuditQuery(req), format)
    res.setHeader('Content-Type', result.contentType)
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`)
    res.status(200).send(result.body)
  }),

  listSavedFilters: asyncHandler(async (req: Request, res: Response) => {
    const result = await auditService.listSavedFilters(req.auth!.userId)
    sendSuccess(res, result)
  }),

  createSavedFilter: asyncHandler(async (req: Request, res: Response) => {
    const result = await auditService.createSavedFilter(req.auth!.userId, req.body)
    sendSuccess(res, result, 'Saved audit filter created', 201)
  }),

  deleteSavedFilter: asyncHandler(async (req: Request, res: Response) => {
    const result = await auditService.deleteSavedFilter(req.auth!.userId, String(req.params.id))
    sendSuccess(res, result, 'Saved audit filter deleted')
  }),

  listExportJobs: asyncHandler(async (req: Request, res: Response) => {
    const result = await auditService.listExportJobs(req.auth!.userId)
    sendSuccess(res, result)
  }),

  createExportJob: asyncHandler(async (req: Request, res: Response) => {
    const result = await auditService.createExportJob(req.auth!.userId, req.body)
    sendSuccess(res, result, 'Audit export job queued', 202)
  }),

  getExportJob: asyncHandler(async (req: Request, res: Response) => {
    const result = await auditService.getExportJob(req.auth!.userId, String(req.params.id))
    sendSuccess(res, result)
  }),

  getGeoCacheMetrics: asyncHandler(async (_req: Request, res: Response) => {
    const result = await geoCacheMonitorService.getMetrics()
    sendSuccess(res, result)
  })
}
