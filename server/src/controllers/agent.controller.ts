import type { Request, Response } from 'express'
import { asyncHandler } from '../helpers/asyncHandler.js'
import { ApiError } from '../helpers/ApiError.js'
import { getRequestMeta } from '../helpers/requestMeta.js'
import { sendSuccess } from '../helpers/response.js'
import { auditService } from '../services/audit.service.js'
import { agentService } from '../services/agent.service.js'
import { geminiLiveService } from '../services/gemini-live.service.js'
import { orderService } from '../services/order.service.js'
import { publicTableOrderService } from '../services/public-table-order.service.js'

const buildConversationOrderAsk = (state: {
  hasItems?: boolean
  hasCustomerName?: boolean
  hasConfirmation?: boolean
  hasConversation?: boolean
}) => {
  if (!state.hasItems) {
    if (state.hasConversation) {
      return 'Please repeat your item once clearly so I can confirm it correctly.'
    }
    return 'Hello, what would you like to order today?'
  }

  if (!state.hasCustomerName) {
    return 'Before I place that, what name should I put on the order?'
  }

  if (!state.hasConfirmation) {
    return 'Anything else, or should I place it now?'
  }

  return undefined
}

export const agentController = {
  getPublicTableOrderSession: asyncHandler(async (req: Request, res: Response) => {
    const agentId = req.params.id as string

    if (!publicTableOrderService.isValidAgentId(agentId)) {
      throw new ApiError(404, 'Table ordering link is invalid', 'TABLE_AGENT_NOT_FOUND')
    }

    const session = await publicTableOrderService.getSession(agentId, req.query.table as string | undefined)
    sendSuccess(res, session, 'Table ordering session loaded')
  }),

  createPublicTableOrder: asyncHandler(async (req: Request, res: Response) => {
    const agentId = req.params.id as string

    if (!publicTableOrderService.isValidAgentId(agentId)) {
      throw new ApiError(404, 'Table ordering link is invalid', 'TABLE_AGENT_NOT_FOUND')
    }

    const result = await publicTableOrderService.createOrder(agentId, req.body)
    sendSuccess(res, result, 'Order placed successfully', 201)
  }),

  createPublicLiveSession: asyncHandler(async (req: Request, res: Response) => {
    const agentId = req.params.id as string

    if (!publicTableOrderService.isValidAgentId(agentId)) {
      throw new ApiError(404, 'Table ordering link is invalid', 'TABLE_AGENT_NOT_FOUND')
    }

    const result = await publicTableOrderService.createLiveSession(agentId, {
      source: req.body.source,
      tableNumber: typeof req.body.tableNumber === 'string' ? req.body.tableNumber : (req.query.table as string | undefined)
    })

    sendSuccess(res, result, 'Live session issued', 201)
  }),

  createPublicConversationLiveOrder: asyncHandler(async (req: Request, res: Response) => {
    const agentId = req.params.id as string

    if (!publicTableOrderService.isValidAgentId(agentId)) {
      throw new ApiError(404, 'Table ordering link is invalid', 'TABLE_AGENT_NOT_FOUND')
    }

    const context = await publicTableOrderService.getLiveContext(
      agentId,
      typeof req.body.tableNumber === 'string'
        ? req.body.tableNumber
        : typeof req.body.hints?.tableNumber === 'string'
          ? req.body.hints.tableNumber
          : (req.query.table as string | undefined)
    )

    const draft = await geminiLiveService.extractOrderDraft(context.ownerId, agentId, {
      source: req.body.source,
      tableNumber: context.table.number,
      conversation: req.body.conversation,
      hints: {
        ...(req.body.hints ?? {}),
        tableNumber: context.table.number
      }
    })

    const hasConversation = Array.isArray(req.body.conversation) && req.body.conversation.length > 0

    if (!draft.readyToPlace || !draft.customerName.trim() || draft.items.length === 0) {
      sendSuccess(
        res,
        {
          analysisSource: draft.analysisSource,
          readyToPlace: false,
          hasCustomerName: draft.hasCustomerName,
          hasItems: draft.hasItems,
          hasConfirmation: draft.hasConfirmation,
          reason: draft.reason || 'The conversation does not contain a confirmed, complete order yet.',
          ask: buildConversationOrderAsk({
            ...draft,
            hasConversation
          })
        },
        'Conversation analyzed'
      )
      return
    }

    try {
      const order = await orderService.createFromLiveAgent(context.ownerId, agentId, {
        customerName: draft.customerName,
        customerPhone: draft.customerPhone || undefined,
        customerEmail: draft.customerEmail || undefined,
        tableNumber: context.table.number,
        notes: draft.notes || undefined,
        source: req.body.source,
        items: draft.items
      })

      sendSuccess(
        res,
        {
          analysisSource: draft.analysisSource,
          readyToPlace: true,
          hasCustomerName: true,
          hasItems: true,
          hasConfirmation: true,
          reason: draft.reason,
          order
        },
        'Conversation order created',
        201
      )
    } catch (error) {
      if (
        error instanceof ApiError &&
        (error.code === 'TABLE_ORDER_ALREADY_ACTIVE' || error.code === 'TABLE_NUMBER_REQUIRED')
      ) {
        sendSuccess(
          res,
          {
            analysisSource: draft.analysisSource,
            readyToPlace: false,
            hasCustomerName: true,
            hasItems: true,
            hasConfirmation: true,
            reason: error.message,
            ask:
              error.code === 'TABLE_NUMBER_REQUIRED'
                ? 'Please share your table number so I can place the order.'
                : 'This table already has an active order. Please wait until it is completed, or use another table number.'
          },
          'Conversation analyzed'
        )
        return
      }

      throw error
    }
  }),

  list: asyncHandler(async (req: Request, res: Response) => {
    const agents = await agentService.list(req.auth!.userId)
    sendSuccess(res, { agents })
  }),

  getById: asyncHandler(async (req: Request, res: Response) => {
    const agent = await agentService.getById(req.auth!.userId, req.params.id as string)
    sendSuccess(res, { agent })
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    const agent = await agentService.create(req.auth!.userId, req.body)
    const meta = getRequestMeta(req)
    await auditService.record({
      actorId: req.auth!.userId,
      actorEmail: req.auth!.email,
      actorRole: req.auth!.role,
      action: 'agent.created',
      entityType: 'agent',
      entityId: agent.id,
      metadata: {
        name: agent.name,
        mode: agent.mode
      },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent
    })
    sendSuccess(res, { agent }, 'Agent created', 201)
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const agent = await agentService.update(req.auth!.userId, req.params.id as string, req.body)
    const meta = getRequestMeta(req)
    await auditService.record({
      actorId: req.auth!.userId,
      actorEmail: req.auth!.email,
      actorRole: req.auth!.role,
      action: 'agent.updated',
      entityType: 'agent',
      entityId: agent.id,
      metadata: {
        name: agent.name,
        mode: agent.mode,
        isActive: agent.isActive
      },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent
    })
    sendSuccess(res, { agent }, 'Agent updated')
  }),

  toggle: asyncHandler(async (req: Request, res: Response) => {
    const agent = await agentService.toggle(req.auth!.userId, req.params.id as string, req.body.isActive)
    const meta = getRequestMeta(req)
    await auditService.record({
      actorId: req.auth!.userId,
      actorEmail: req.auth!.email,
      actorRole: req.auth!.role,
      action: 'agent.toggled',
      entityType: 'agent',
      entityId: agent.id,
      metadata: {
        isActive: agent.isActive
      },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent
    })
    sendSuccess(res, { agent }, 'Agent status updated')
  }),

  testWebhook: asyncHandler(async (req: Request, res: Response) => {
    const result = await agentService.testWebhook(req.body.url)
    const meta = getRequestMeta(req)
    await auditService.record({
      actorId: req.auth!.userId,
      actorEmail: req.auth!.email,
      actorRole: req.auth!.role,
      action: 'agent.webhook_tested',
      entityType: 'webhook',
      metadata: {
        url: req.body.url,
        status: result.status
      },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent
    })
    sendSuccess(res, result, 'Webhook test completed')
  }),

  createLiveSession: asyncHandler(async (req: Request, res: Response) => {
    const result = await geminiLiveService.createEphemeralSessionToken(req.auth!.userId, req.params.id as string, req.body.source)
    const meta = getRequestMeta(req)
    await auditService.record({
      actorId: req.auth!.userId,
      actorEmail: req.auth!.email,
      actorRole: req.auth!.role,
      action: 'agent.live_session_created',
      entityType: 'agent_live_session',
      entityId: req.params.id as string,
      metadata: {
        model: result.model,
        source: result.source
      },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent
    })
    sendSuccess(res, result, 'Live session issued', 201)
  }),

  createLiveVoicePreview: asyncHandler(async (req: Request, res: Response) => {
    const result = await geminiLiveService.generateVoicePreview(req.auth!.userId, req.body)
    const meta = getRequestMeta(req)
    await auditService.record({
      actorId: req.auth!.userId,
      actorEmail: req.auth!.email,
      actorRole: req.auth!.role,
      action: 'agent.live_voice_preview_tested',
      entityType: 'agent_live_voice_preview',
      metadata: {
        model: result.model,
        languageCode: result.voiceProfile.languageCode,
        gender: result.voiceProfile.gender,
        voiceName: result.voiceProfile.voiceName,
        textLength: typeof req.body.text === 'string' ? req.body.text.length : 0
      },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent
    })
    sendSuccess(res, result, 'Live voice preview generated')
  }),

  createLiveOrder: asyncHandler(async (req: Request, res: Response) => {
    const order = await orderService.createFromLiveAgent(req.auth!.userId, req.params.id as string, req.body)
    const meta = getRequestMeta(req)
    await auditService.record({
      actorId: req.auth!.userId,
      actorEmail: req.auth!.email,
      actorRole: req.auth!.role,
      action: 'agent.live_order_created',
      entityType: 'order',
      entityId: order.id,
      metadata: {
        agentId: req.params.id,
        source: order.source,
        totalAmount: order.totalAmount
      },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent
    })
    sendSuccess(res, { order }, 'Live order created', 201)
  }),

  createConversationLiveOrder: asyncHandler(async (req: Request, res: Response) => {
    const draft = await geminiLiveService.extractOrderDraft(req.auth!.userId, req.params.id as string, req.body)
    const hasConversation = Array.isArray(req.body.conversation) && req.body.conversation.length > 0

    if (!draft.readyToPlace || !draft.customerName.trim() || draft.items.length === 0) {
      sendSuccess(
        res,
        {
          analysisSource: draft.analysisSource,
          readyToPlace: false,
          hasCustomerName: draft.hasCustomerName,
          hasItems: draft.hasItems,
          hasConfirmation: draft.hasConfirmation,
          reason: draft.reason || 'The conversation does not contain a confirmed, complete order yet.',
          ask: buildConversationOrderAsk({
            ...draft,
            hasConversation
          })
        },
        'Conversation analyzed'
      )
      return
    }

    let order
    try {
      order = await orderService.createFromLiveAgent(req.auth!.userId, req.params.id as string, {
        customerName: draft.customerName,
        customerPhone: draft.customerPhone || undefined,
        customerEmail: draft.customerEmail || undefined,
        tableNumber:
          typeof req.body.tableNumber === 'string'
            ? req.body.tableNumber
            : typeof req.body.hints?.tableNumber === 'string'
              ? req.body.hints.tableNumber
              : undefined,
        notes: draft.notes || undefined,
        source: req.body.source,
        items: draft.items
      })
    } catch (error) {
      if (
        error instanceof ApiError &&
        (error.code === 'TABLE_ORDER_ALREADY_ACTIVE' || error.code === 'TABLE_NUMBER_REQUIRED')
      ) {
        sendSuccess(
          res,
          {
            analysisSource: draft.analysisSource,
            readyToPlace: false,
            hasCustomerName: true,
            hasItems: true,
            hasConfirmation: true,
            reason: error.message,
            ask:
              error.code === 'TABLE_NUMBER_REQUIRED'
                ? 'Please share your table number so I can place the order.'
                : 'This table already has an active order. Please wait until it is completed, or use another table number.'
          },
          'Conversation analyzed'
        )
        return
      }

      throw error
    }

    const meta = getRequestMeta(req)
    await auditService.record({
      actorId: req.auth!.userId,
      actorEmail: req.auth!.email,
      actorRole: req.auth!.role,
      action: 'agent.live_conversation_order_created',
      entityType: 'order',
      entityId: order.id,
      metadata: {
        agentId: req.params.id,
        source: order.source,
        totalAmount: order.totalAmount
      },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent
    })

    sendSuccess(
      res,
      {
        analysisSource: draft.analysisSource,
        readyToPlace: true,
        hasCustomerName: true,
        hasItems: true,
        hasConfirmation: true,
        reason: draft.reason,
        order
      },
      'Conversation order created',
      201
    )
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    await agentService.remove(req.auth!.userId, req.params.id as string)
    const meta = getRequestMeta(req)
    await auditService.record({
      actorId: req.auth!.userId,
      actorEmail: req.auth!.email,
      actorRole: req.auth!.role,
      action: 'agent.deleted',
      entityType: 'agent',
      entityId: req.params.id as string,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent
    })
    sendSuccess(res, null, 'Agent deleted')
  })
}
