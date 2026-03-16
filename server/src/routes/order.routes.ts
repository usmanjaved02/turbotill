import { Router } from 'express'
import { orderController } from '../controllers/order.controller.js'
import { authorizeRoles, requireAuth, requireCsrf } from '../helpers/auth.js'
import { validate } from '../helpers/validate.js'
import { idParamSchema } from '../validations/common.validation.js'
import { createOrderSchema, updateOrderStatusSchema } from '../validations/order.validation.js'

export const orderRouter = Router()

orderRouter.use(requireAuth, requireCsrf)

orderRouter.get('/', orderController.list)
orderRouter.get('/:id', validate(idParamSchema, 'params'), orderController.getById)
orderRouter.post('/', authorizeRoles('owner', 'admin', 'manager'), validate(createOrderSchema), orderController.create)
orderRouter.patch(
  '/:id/status',
  authorizeRoles('owner', 'admin', 'manager'),
  validate(idParamSchema, 'params'),
  validate(updateOrderStatusSchema),
  orderController.updateStatus
)
