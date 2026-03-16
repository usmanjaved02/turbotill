import { Router } from 'express'
import { productController } from '../controllers/product.controller.js'
import { authorizeRoles, requireAuth, requireCsrf } from '../helpers/auth.js'
import { validate } from '../helpers/validate.js'
import { idParamSchema } from '../validations/common.validation.js'
import { productBodySchema, productBulkBodySchema } from '../validations/product.validation.js'

export const productRouter = Router()

productRouter.use(requireAuth, requireCsrf)

productRouter.get('/', productController.list)
productRouter.post('/bulk', authorizeRoles('owner', 'admin', 'manager'), validate(productBulkBodySchema), productController.bulkCreate)
productRouter.get('/:id', validate(idParamSchema, 'params'), productController.getById)
productRouter.post('/', authorizeRoles('owner', 'admin', 'manager'), validate(productBodySchema), productController.create)
productRouter.patch(
  '/:id',
  authorizeRoles('owner', 'admin', 'manager'),
  validate(idParamSchema, 'params'),
  validate(productBodySchema),
  productController.update
)
productRouter.delete('/:id', authorizeRoles('owner', 'admin', 'manager'), validate(idParamSchema, 'params'), productController.remove)
