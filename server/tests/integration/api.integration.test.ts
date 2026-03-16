import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { after, before, beforeEach, describe, test } from 'node:test'
import type { Express } from 'express'
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import request, { type Response, type SuperAgentTest } from 'supertest'

const API_PREFIX = '/api/v1'

let mongoServer: MongoMemoryServer
let app: Express
let connectMongo: (() => Promise<void>) | undefined
let disconnectMongo: (() => Promise<void>) | undefined
let UserModel: mongoose.Model<any>
let GeoIpCacheModel: mongoose.Model<any>

const setTestEnv = (mongoUri: string) => {
  process.env.NODE_ENV = 'test'
  process.env.PORT = '4000'
  process.env.MONGODB_URI = mongoUri
  process.env.FRONTEND_ORIGIN = 'http://localhost:5173'
  process.env.JWT_ACCESS_SECRET = 'integration-test-access-secret-key-1234567890'
  process.env.ACCESS_TOKEN_TTL_MINUTES = '15'
  process.env.REFRESH_TOKEN_TTL_DAYS = '7'
  process.env.GEOIP_MONITOR_INTERVAL_MS = '1000'
  process.env.GEOIP_METRICS_RETENTION_DAYS = '7'
  process.env.AUDIT_INLINE_EXPORT_LIMIT = '1'
  process.env.AUDIT_EXPORT_MAX_ROWS = '100'
  process.env.AUDIT_EXPORT_JOB_TTL_HOURS = '24'
  process.env.AUDIT_EXPORT_POLL_INTERVAL_MS = '50'
}

const wait = async (ms: number) => {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

const getSetCookieHeaders = (response: Response): string[] => {
  const cookies = response.headers['set-cookie']
  return Array.isArray(cookies) ? cookies : []
}

const getCookieValue = (response: Response, name: string): string => {
  const cookie = getSetCookieHeaders(response).find((entry) => entry.startsWith(`${name}=`))
  assert.ok(cookie, `Expected ${name} cookie to be present`)
  return cookie.split(';')[0]!.split('=').slice(1).join('=')
}

const getCookieHeader = (response: Response, name: string): string => {
  const cookie = getSetCookieHeaders(response).find((entry) => entry.startsWith(`${name}=`))
  assert.ok(cookie, `Expected ${name} cookie to be present`)
  return cookie.split(';')[0]!
}

const getCsrfToken = async (agent: SuperAgentTest): Promise<string> => {
  const response = await agent.get(`${API_PREFIX}/auth/me`).expect(200)
  assert.equal(response.body.success, true)
  return response.body.data.csrfToken as string
}

const signupUser = async (
  agent: SuperAgentTest,
  overrides: Partial<{
    fullName: string
    businessName: string
    email: string
    password: string
    phone: string
  }> = {}
) => {
  const payload = {
    fullName: 'Avery Cole',
    businessName: 'Northline Supply Co.',
    email: 'avery@example.com',
    password: 'SecurePass123!',
    phone: '+1-555-000-0000',
    ...overrides
  }

  const response = await agent.post(`${API_PREFIX}/auth/signup`).send(payload).expect(201)
  return { payload, response }
}

describe('Turbo Tll API integration', () => {
  before(async () => {
    mongoServer = await MongoMemoryServer.create({
      instance: {
        ip: '127.0.0.1',
        port: 27027
      }
    })
    setTestEnv(mongoServer.getUri())

    const [{ createApp }, mongoModule, userModelModule, geoIpCacheModule] = await Promise.all([
      import('../../app.js'),
      import('../../src/connections/mongodb.js'),
      import('../../src/models/User.js'),
      import('../../src/models/GeoIpCache.js')
    ])

    app = createApp()
    connectMongo = mongoModule.connectMongo
    disconnectMongo = mongoModule.disconnectMongo
    UserModel = userModelModule.UserModel
    GeoIpCacheModel = geoIpCacheModule.GeoIpCacheModel

    await connectMongo()
  })

  after(async () => {
    if (disconnectMongo) {
      await disconnectMongo()
    }

    await mongoServer.stop()
  })

  beforeEach(async () => {
    assert.ok(mongoose.connection.db, 'Expected mongoose connection to be ready')
    await mongoose.connection.db.dropDatabase()
  })

  test('exposes health endpoints for app and API routes', async () => {
    const rootHealthResponse = await request(app).get('/healthz').expect(200)
    assert.equal(rootHealthResponse.body.status, 'ok')
    assert.equal(rootHealthResponse.body.mongo, 'up')

    const rootHealthAliasResponse = await request(app).get('/health').expect(200)
    assert.equal(rootHealthAliasResponse.body.status, 'ok')
    assert.equal(rootHealthAliasResponse.body.mongo, 'up')

    const apiHealthResponse = await request(app).get(`${API_PREFIX}/health`).expect(200)
    assert.equal(apiHealthResponse.body.success, true)
  })

  test('lists sessions and revokes other sessions safely', async () => {
    const primaryAgent = request.agent(app)
    const secondaryAgent = request.agent(app)

    const { payload } = await signupUser(primaryAgent)
    await secondaryAgent.post(`${API_PREFIX}/auth/login`).send({
      email: payload.email,
      password: payload.password
    }).expect(200)

    const sessionsResponse = await primaryAgent.get(`${API_PREFIX}/auth/sessions`).expect(200)
    assert.equal(sessionsResponse.body.data.sessions.length, 2)

    const secondaryCsrf = await getCsrfToken(secondaryAgent)
    const primaryCsrf = await getCsrfToken(primaryAgent)

    const revokeResponse = await primaryAgent
      .post(`${API_PREFIX}/auth/sessions/revoke-others`)
      .set('X-CSRF-Token', primaryCsrf)
      .expect(200)

    assert.equal(revokeResponse.body.data.revokedCount, 1)

    await secondaryAgent
      .post(`${API_PREFIX}/auth/refresh`)
      .set('X-CSRF-Token', secondaryCsrf)
      .expect(401)
  })

  test('detects refresh token reuse and revokes the token family', async () => {
    const agent = request.agent(app)
    const { response } = await signupUser(agent, { email: 'rotation@example.com' })

    const originalRefreshCookie = getCookieHeader(response, 'ot_refresh')
    const originalCsrfCookie = getCookieHeader(response, 'ot_csrf')
    const originalCsrfValue = getCookieValue(response, 'ot_csrf')

    const refreshResponse = await agent
      .post(`${API_PREFIX}/auth/refresh`)
      .set('X-CSRF-Token', originalCsrfValue)
      .expect(200)

    assert.equal(refreshResponse.body.success, true)

    const reuseResponse = await request(app)
      .post(`${API_PREFIX}/auth/refresh`)
      .set('Cookie', [originalRefreshCookie, originalCsrfCookie])
      .set('X-CSRF-Token', originalCsrfValue)
      .expect(401)

    assert.equal(reuseResponse.body.code, 'REFRESH_TOKEN_REUSE')
  })

  test('blocks viewer role from mutating protected resources', async () => {
    const viewerAgent = request.agent(app)
    const { payload } = await signupUser(viewerAgent, { email: 'viewer@example.com' })

    await UserModel.updateOne({ email: payload.email }, { role: 'viewer' })

    await viewerAgent.post(`${API_PREFIX}/auth/logout`).set('X-CSRF-Token', await getCsrfToken(viewerAgent)).expect(200)

    await viewerAgent.post(`${API_PREFIX}/auth/login`).send({
      email: payload.email,
      password: payload.password
    }).expect(200)

    const csrfToken = await getCsrfToken(viewerAgent)
    const response = await viewerAgent
      .post(`${API_PREFIX}/products`)
      .set('X-CSRF-Token', csrfToken)
      .send({
        name: 'Catalog Tee',
        sku: 'TEE-001',
        category: 'Apparel',
        description: 'Premium catalog product',
        price: 29,
        currency: 'USD',
        stock: 18,
        status: 'published'
      })
      .expect(403)

    assert.equal(response.body.code, 'FORBIDDEN')
  })

  test('records audit logs for protected write operations', async () => {
    const agent = request.agent(app)
    await signupUser(agent, { email: 'audit@example.com' })

    const csrfToken = await getCsrfToken(agent)

    const createProductResponse = await agent
      .post(`${API_PREFIX}/products`)
      .set('X-CSRF-Token', csrfToken)
      .send({
        name: 'Order Desk Bundle',
        sku: 'ODB-100',
        category: 'Bundles',
        description: 'A starter bundle for order desks',
        price: 149,
        currency: 'USD',
        stock: 9,
        status: 'published'
      })
      .expect(201)

    const productId = createProductResponse.body.data.product.id as string
    assert.ok(productId)

    const auditResponse = await agent.get(`${API_PREFIX}/audit-logs?limit=10`).expect(200)
    const actions = (auditResponse.body.data.logs as Array<{ action: string; entityId: string | null }>).map((entry) => entry.action)

    assert.ok(actions.includes('auth.signup'))
    assert.ok(actions.includes('product.created'))
  })

  test('persists profile and workspace settings to mongodb', async () => {
    const agent = request.agent(app)
    await signupUser(agent, { email: 'settings@example.com' })

    const csrfToken = await getCsrfToken(agent)

    await agent
      .patch(`${API_PREFIX}/settings/profile`)
      .set('X-CSRF-Token', csrfToken)
      .send({
        fullName: 'Avery Stone',
        businessName: 'Northline Ops',
        email: 'settings-updated@example.com',
        phone: '+1-555-111-2222'
      })
      .expect(200)

    await agent
      .patch(`${API_PREFIX}/settings/workspace`)
      .set('X-CSRF-Token', csrfToken)
      .send({
        businessName: 'Northline Ops',
        businessLogo: 'https://cdn.example.com/logo.png',
        defaultCurrency: 'EUR',
        timezone: 'Europe/London',
        notificationPreferences: {
          emailAlerts: false,
          smsAlerts: true
        }
      })
      .expect(200)

    const meResponse = await agent.get(`${API_PREFIX}/auth/me`).expect(200)
    assert.equal(meResponse.body.data.user.fullName, 'Avery Stone')
    assert.equal(meResponse.body.data.user.email, 'settings-updated@example.com')
    assert.equal(meResponse.body.data.user.defaultCurrency, 'EUR')
    assert.equal(meResponse.body.data.user.notificationPreferences.smsAlerts, true)
  })

  test('persists optional session naming across refresh rotation', async () => {
    const agent = request.agent(app)
    await signupUser(agent, { email: 'devices@example.com' })

    const initialSessions = await agent.get(`${API_PREFIX}/auth/sessions`).expect(200)
    const currentSessionId = initialSessions.body.data.sessions[0].id as string
    const csrfToken = await getCsrfToken(agent)

    await agent
      .patch(`${API_PREFIX}/auth/sessions/${currentSessionId}`)
      .set('X-CSRF-Token', csrfToken)
      .send({ sessionName: 'Office MacBook' })
      .expect(200)

    await agent
      .post(`${API_PREFIX}/auth/refresh`)
      .set('X-CSRF-Token', csrfToken)
      .expect(200)

    const sessionsAfterRefresh = await agent.get(`${API_PREFIX}/auth/sessions`).expect(200)
    const activeSession = (sessionsAfterRefresh.body.data.sessions as Array<{ isCurrent: boolean; sessionName: string | null }>).find(
      (session) => session.isCurrent
    )

    assert.ok(activeSession)
    assert.equal(activeSession?.sessionName, 'Office MacBook')
  })

  test('uploads avatar and workspace logo through multipart endpoints', async () => {
    const agent = request.agent(app)
    await signupUser(agent, { email: 'uploads@example.com' })

    const csrfToken = await getCsrfToken(agent)
    const pngBuffer = Buffer.from(
      '89504e470d0a1a0a0000000d4948445200000001000000010802000000907724de0000000c49444154789c6360000002000154a24f5d0000000049454e44ae426082',
      'hex'
    )

    const avatarResponse = await agent
      .post(`${API_PREFIX}/settings/profile/avatar`)
      .set('X-CSRF-Token', csrfToken)
      .attach('file', pngBuffer, {
        filename: 'avatar.png',
        contentType: 'image/png'
      })
      .expect(200)

    assert.match(avatarResponse.body.data.user.avatarUrl as string, /^\/uploads\/avatars\//)

    const logoResponse = await agent
      .post(`${API_PREFIX}/settings/workspace/logo`)
      .set('X-CSRF-Token', csrfToken)
      .attach('file', pngBuffer, {
        filename: 'logo.png',
        contentType: 'image/png'
      })
      .expect(200)

    assert.match(logoResponse.body.data.user.businessLogo as string, /^\/uploads\/logos\//)
  })

  test('returns paginated filtered audit logs and session geo labels', async () => {
    const agent = request.agent(app)
    await signupUser(agent, { email: 'filters@example.com' })
    const csrfToken = await getCsrfToken(agent)

    await agent
      .post(`${API_PREFIX}/products`)
      .set('X-CSRF-Token', csrfToken)
      .send({
        name: 'Ops Bundle',
        sku: 'OPS-001',
        category: 'Bundles',
        description: 'Ops starter bundle',
        price: 90,
        currency: 'USD',
        stock: 5,
        status: 'published'
      })
      .expect(201)

    const auditResponse = await agent.get(`${API_PREFIX}/audit-logs?entityType=product&limit=1&page=1`).expect(200)
    assert.equal(auditResponse.body.data.page, 1)
    assert.equal(auditResponse.body.data.limit, 1)
    assert.ok((auditResponse.body.data.logs as Array<{ entityType: string }>).every((entry) => entry.entityType === 'product'))

    const sessionsResponse = await agent.get(`${API_PREFIX}/auth/sessions`).expect(200)
    assert.equal(sessionsResponse.body.data.sessions[0].locationLabel, 'Private network')
  })

  test('exports audit logs and uses cached geo metadata for public ips', async () => {
    await GeoIpCacheModel.create({
      ipAddress: '203.0.113.10',
      locationCity: 'New York',
      locationRegion: 'NY',
      locationCountry: 'USA',
      locationTimezone: 'America/New_York',
      locationLabel: 'New York, NY, USA',
      geoSource: 'remote',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
    })

    const agent = request.agent(app)
    await agent
      .post(`${API_PREFIX}/auth/signup`)
      .set('X-Forwarded-For', '203.0.113.10')
      .send({
        fullName: 'Cache User',
        businessName: 'Cache Co',
        email: 'cache@example.com',
        password: 'SecurePass123!',
        phone: '+1-555-000-0101'
      })
      .expect(201)

    const sessionsResponse = await agent.get(`${API_PREFIX}/auth/sessions`).expect(200)
    assert.equal(sessionsResponse.body.data.sessions[0].locationLabel, 'New York, NY, USA')

    const exportResponse = await agent.get(`${API_PREFIX}/audit-logs/export?format=csv`).expect(200)
    assert.match(exportResponse.headers['content-type'] as string, /text\/csv/)
    assert.match(exportResponse.text, /auth\.signup/)
  })

  test('persists saved audit filters in mongodb and exposes geo cache metrics', async () => {
    await GeoIpCacheModel.create({
      ipAddress: '203.0.113.22',
      locationCity: 'Chicago',
      locationRegion: 'IL',
      locationCountry: 'USA',
      locationTimezone: 'America/Chicago',
      locationLabel: 'Chicago, IL, USA',
      geoSource: 'remote',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
    })

    const agent = request.agent(app)
    await agent
      .post(`${API_PREFIX}/auth/signup`)
      .set('X-Forwarded-For', '203.0.113.22')
      .send({
        fullName: 'Preset User',
        businessName: 'Preset Co',
        email: 'preset@example.com',
        password: 'SecurePass123!',
        phone: '+1-555-000-0202'
      })
      .expect(201)

    const createFilterResponse = await agent
      .post(`${API_PREFIX}/audit-logs/filters`)
      .send({
        name: 'Products only',
        filters: {
          entityType: 'product',
          limit: 20
        }
      })
      .set('X-CSRF-Token', await getCsrfToken(agent))
      .expect(201)

    assert.equal(createFilterResponse.body.data.filter.name, 'Products only')

    const listFiltersResponse = await agent.get(`${API_PREFIX}/audit-logs/filters`).expect(200)
    assert.equal(listFiltersResponse.body.data.filters.length, 1)
    assert.equal(listFiltersResponse.body.data.filters[0].filters.entityType, 'product')

    const metricsResponse = await agent.get(`${API_PREFIX}/audit-logs/geo-cache-metrics`).expect(200)
    assert.ok(metricsResponse.body.data.current.cacheHits >= 1)
    assert.equal(metricsResponse.body.data.current.cacheDocuments, 1)
  })

  test('queues async audit export jobs when inline export limits are exceeded', async () => {
    const agent = request.agent(app)
    await agent
      .post(`${API_PREFIX}/auth/signup`)
      .set('X-Forwarded-For', '198.51.100.77')
      .send({
        fullName: 'Async Export User',
        businessName: 'Async Export Co',
        email: 'exports-async@example.com',
        password: 'SecurePass123!',
        phone: '+1-555-000-0303'
      })
      .expect(201)

    const csrfToken = await getCsrfToken(agent)

    await agent
      .post(`${API_PREFIX}/products`)
      .set('X-CSRF-Token', csrfToken)
      .send({
        name: 'Async Bundle',
        sku: 'ASYNC-001',
        category: 'Bundles',
        description: 'Triggers async export volume',
        price: 55,
        currency: 'USD',
        stock: 7,
        status: 'published'
      })
      .expect(201)

    const exportResponse = await agent.get(`${API_PREFIX}/audit-logs/export?format=json`).expect(409)
    assert.equal(exportResponse.body.code, 'EXPORT_REQUIRES_ASYNC')

    const createJobResponse = await agent
      .post(`${API_PREFIX}/audit-logs/export-jobs`)
      .set('X-CSRF-Token', csrfToken)
      .send({
        format: 'json',
        filters: {}
      })
      .expect(202)

    const jobId = createJobResponse.body.data.job.id as string
    assert.ok(jobId)

    let completedJob: { status: string; fileUrl: string | null } | null = null
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const jobResponse = await agent.get(`${API_PREFIX}/audit-logs/export-jobs/${jobId}`).expect(200)
      completedJob = jobResponse.body.data.job as { status: string; fileUrl: string | null }
      if (completedJob.status === 'completed') {
        break
      }
      await wait(75)
    }

    assert.ok(completedJob)
    assert.equal(completedJob?.status, 'completed')
    assert.match(completedJob?.fileUrl ?? '', /^\/uploads\/exports\//)
  })

  test('creates live agent orders and signs webhook notifications', async () => {
    let receivedPayload: any = null
    let receivedSignature = ''
    let receivedEvent = ''
    let receivedTimestamp = ''
    const webhookServer = createServer((req, res) => {
      let body = ''
      req.on('data', (chunk) => {
        body += chunk
      })
      req.on('end', () => {
        receivedPayload = JSON.parse(body)
        receivedSignature = String(req.headers['x-turbotill-signature'] ?? '')
        receivedEvent = String(req.headers['x-turbotill-event'] ?? '')
        receivedTimestamp = String(req.headers['x-turbotill-timestamp'] ?? '')
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok: true }))
      })
    })

    await new Promise<void>((resolve) => webhookServer.listen(0, '127.0.0.1', () => resolve()))
    const address = webhookServer.address()
    assert.ok(address && typeof address === 'object')
    const webhookUrl = `http://127.0.0.1:${address.port}/orders`

    try {
      const agent = request.agent(app)
      await agent
        .post(`${API_PREFIX}/auth/signup`)
        .set('X-Forwarded-For', '198.51.100.99')
        .send({
          fullName: 'Live Agent User',
          businessName: 'Live Agent Co',
          email: 'live-agent@example.com',
          password: 'SecurePass123!',
          phone: '+1-555-000-0404'
        })
        .expect(201)

      const csrfToken = await getCsrfToken(agent)

      const createProductResponse = await agent
        .post(`${API_PREFIX}/products`)
        .set('X-CSRF-Token', csrfToken)
        .send({
          name: 'Brew Kit',
          sku: 'BREW-101',
          category: 'Kits',
          description: 'Starter brewing kit',
          price: 65,
          currency: 'USD',
          stock: 20,
          status: 'published'
        })
        .expect(201)

      const productId = createProductResponse.body.data.product.id as string

      const createAgentResponse = await agent
        .post(`${API_PREFIX}/agents`)
        .set('X-CSRF-Token', csrfToken)
        .send({
          name: 'Desk Agent',
          description: 'Handles temporary order desk coverage',
          productAccess: 'selected',
          productIds: [productId],
          webhookUrl,
          webhookSecret: 'live_webhook_secret',
          mode: 'mic',
          isActive: true
        })
        .expect(201)

      const liveAgentId = createAgentResponse.body.data.agent.id as string

      const liveOrderResponse = await agent
        .post(`${API_PREFIX}/agents/${liveAgentId}/live/orders`)
        .set('X-CSRF-Token', csrfToken)
        .send({
          customerName: 'Morgan Reed',
          customerPhone: '+1-555-111-9999',
          items: [{ productLabel: 'Brew Kit', quantity: 2 }],
          notes: 'Leave at front desk',
          source: 'mic'
        })
        .expect(201)

      assert.equal(liveOrderResponse.body.data.order.webhookDelivered, true)
      assert.equal(liveOrderResponse.body.data.order.agentId, liveAgentId)
      assert.ok(receivedPayload)
      assert.equal(receivedPayload.event, 'order.created')
      assert.equal(receivedPayload.order.customerName, 'Morgan Reed')
      assert.equal(receivedPayload.order.items[0].productName, 'Brew Kit')
      assert.equal(receivedEvent, 'order.created')
      assert.match(receivedTimestamp, /^\d{4}-\d{2}-\d{2}T/)
      assert.match(receivedSignature, /^[a-f0-9]{64}$/)
    } finally {
      await new Promise<void>((resolve, reject) => webhookServer.close((error) => (error ? reject(error) : resolve())))
    }
  })
})
