import { Router } from 'express'
import { auditController } from '../controllers/audit.controller.js'
import { authorizeRoles, requireAuth, requireCsrf } from '../helpers/auth.js'
import { validate } from '../helpers/validate.js'
import {
  auditExportJobParamsSchema,
  auditQuerySchema,
  auditSavedFilterParamsSchema,
  createAuditExportJobSchema,
  createAuditSavedFilterSchema
} from '../validations/audit.validation.js'

export const auditRouter = Router()

auditRouter.use(requireAuth, authorizeRoles('owner', 'admin'))

auditRouter.get('/geo-cache-metrics', auditController.getGeoCacheMetrics)
auditRouter.get('/filters', auditController.listSavedFilters)
auditRouter.post('/filters', requireCsrf, validate(createAuditSavedFilterSchema), auditController.createSavedFilter)
auditRouter.delete('/filters/:id', requireCsrf, validate(auditSavedFilterParamsSchema, 'params'), auditController.deleteSavedFilter)
auditRouter.get('/export-jobs', auditController.listExportJobs)
auditRouter.post('/export-jobs', requireCsrf, validate(createAuditExportJobSchema), auditController.createExportJob)
auditRouter.get('/export-jobs/:id', validate(auditExportJobParamsSchema, 'params'), auditController.getExportJob)
auditRouter.get('/export', validate(auditQuerySchema, 'query'), auditController.exportLogs)
auditRouter.get('/', validate(auditQuerySchema, 'query'), auditController.listRecent)
