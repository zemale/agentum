import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { buildApp } from '../index'
import { prisma } from '../lib/prisma'

const OWNER = {
  email: 'agent-owner@example.com',
  password: 'password123',
  name: 'Agent Owner',
}

const OTHER_USER = {
  email: 'agent-other@example.com',
  password: 'password123',
  name: 'Other User',
}

const TEST_AGENT = {
  name: 'Test Agent',
  description: 'A helpful AI agent',
  skills: 'coding,writing',
  hourlyRate: 50,
}

async function getToken(app: ReturnType<typeof buildApp>, user: typeof OWNER) {
  // Register or login
  const res = await app.inject({
    method: 'POST',
    url: '/auth/register',
    payload: user,
  })
  if (res.statusCode === 201) return res.json().token
  const loginRes = await app.inject({
    method: 'POST',
    url: '/auth/login',
    payload: { email: user.email, password: user.password },
  })
  return loginRes.json().token
}

async function cleanupTestData() {
  const emails = [OWNER.email, OTHER_USER.email]
  const users = await prisma.user.findMany({ where: { email: { in: emails } }, select: { id: true } })
  const ids = users.map((u) => u.id)
  if (ids.length > 0) {
    const agents = await prisma.agent.findMany({ where: { ownerId: { in: ids } }, select: { id: true } })
    const agentIds = agents.map((a) => a.id)
    if (agentIds.length > 0) {
      await prisma.service.deleteMany({ where: { agentId: { in: agentIds } } })
      await prisma.badge.deleteMany({ where: { agentId: { in: agentIds } } })
      await prisma.agent.deleteMany({ where: { id: { in: agentIds } } })
    }
    await prisma.transaction.deleteMany({ where: { userId: { in: ids } } })
    await prisma.user.deleteMany({ where: { id: { in: ids } } })
  }
}

describe('Agent CRUD', () => {
  let ownerToken: string
  let otherToken: string
  let app: ReturnType<typeof buildApp>

  beforeEach(async () => {
    await cleanupTestData()
    app = buildApp()
    ownerToken = await getToken(app, OWNER)
    otherToken = await getToken(app, OTHER_USER)
  })

  afterAll(async () => {
    await cleanupTestData()
    await prisma.$disconnect()
  })

  it('POST /agents - creates agent with auth', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/agents',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: TEST_AGENT,
    })
    expect(res.statusCode).toBe(201)
    const body = res.json()
    expect(body.name).toBe(TEST_AGENT.name)
    expect(body.apiKey).toBeDefined()
    expect(body.owner).toBeDefined()
  })

  it('POST /agents - returns 401 without auth', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/agents',
      payload: TEST_AGENT,
    })
    expect(res.statusCode).toBe(401)
  })

  it('POST /agents - returns 400 if missing fields', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/agents',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { name: 'Only name' },
    })
    expect(res.statusCode).toBe(400)
  })

  it('GET /agents - lists all agents publicly', async () => {
    await app.inject({
      method: 'POST',
      url: '/agents',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: TEST_AGENT,
    })
    const res = await app.inject({ method: 'GET', url: '/agents' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(Array.isArray(body)).toBe(true)
    expect(body.length).toBeGreaterThan(0)
  })

  it('GET /agents/:id - returns agent by id', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/agents',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: TEST_AGENT,
    })
    const agentId = createRes.json().id

    const res = await app.inject({ method: 'GET', url: `/agents/${agentId}` })
    expect(res.statusCode).toBe(200)
    expect(res.json().id).toBe(agentId)
  })

  it('GET /agents/:id - returns 404 for unknown id', async () => {
    const res = await app.inject({ method: 'GET', url: '/agents/nonexistent-id' })
    expect(res.statusCode).toBe(404)
  })

  it('PUT /agents/:id - updates own agent', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/agents',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: TEST_AGENT,
    })
    const agentId = createRes.json().id

    const res = await app.inject({
      method: 'PUT',
      url: `/agents/${agentId}`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { name: 'Updated Name', hourlyRate: 100 },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().name).toBe('Updated Name')
    expect(res.json().hourlyRate).toBe(100)
  })

  it('PUT /agents/:id - returns 403 for non-owner', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/agents',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: TEST_AGENT,
    })
    const agentId = createRes.json().id

    const res = await app.inject({
      method: 'PUT',
      url: `/agents/${agentId}`,
      headers: { authorization: `Bearer ${otherToken}` },
      payload: { name: 'Hacked' },
    })
    expect(res.statusCode).toBe(403)
  })

  it('DELETE /agents/:id - deletes own agent', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/agents',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: TEST_AGENT,
    })
    const agentId = createRes.json().id

    const res = await app.inject({
      method: 'DELETE',
      url: `/agents/${agentId}`,
      headers: { authorization: `Bearer ${ownerToken}` },
    })
    expect(res.statusCode).toBe(204)

    const getRes = await app.inject({ method: 'GET', url: `/agents/${agentId}` })
    expect(getRes.statusCode).toBe(404)
  })

  it('DELETE /agents/:id - returns 403 for non-owner', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/agents',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: TEST_AGENT,
    })
    const agentId = createRes.json().id

    const res = await app.inject({
      method: 'DELETE',
      url: `/agents/${agentId}`,
      headers: { authorization: `Bearer ${otherToken}` },
    })
    expect(res.statusCode).toBe(403)
  })
})

describe('Service CRUD', () => {
  let ownerToken: string
  let otherToken: string
  let app: ReturnType<typeof buildApp>
  let agentId: string

  beforeEach(async () => {
    await cleanupTestData()
    app = buildApp()
    ownerToken = await getToken(app, OWNER)
    otherToken = await getToken(app, OTHER_USER)

    const createRes = await app.inject({
      method: 'POST',
      url: '/agents',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: TEST_AGENT,
    })
    agentId = createRes.json().id
  })

  afterAll(async () => {
    await cleanupTestData()
    await prisma.$disconnect()
  })

  const TEST_SERVICE = {
    title: 'Code Review',
    description: 'I will review your code',
    price: 200,
  }

  it('POST /agents/:id/services - creates service', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/agents/${agentId}/services`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: TEST_SERVICE,
    })
    expect(res.statusCode).toBe(201)
    const body = res.json()
    expect(body.title).toBe(TEST_SERVICE.title)
    expect(body.agentId).toBe(agentId)
    expect(body.isActive).toBe(true)
  })

  it('POST /agents/:id/services - returns 403 for non-owner', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/agents/${agentId}/services`,
      headers: { authorization: `Bearer ${otherToken}` },
      payload: TEST_SERVICE,
    })
    expect(res.statusCode).toBe(403)
  })

  it('POST /agents/:id/services - returns 400 if missing fields', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/agents/${agentId}/services`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { title: 'Only title' },
    })
    expect(res.statusCode).toBe(400)
  })

  it('GET /agents/:id/services - lists services publicly', async () => {
    await app.inject({
      method: 'POST',
      url: `/agents/${agentId}/services`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: TEST_SERVICE,
    })
    const res = await app.inject({ method: 'GET', url: `/agents/${agentId}/services` })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(Array.isArray(body)).toBe(true)
    expect(body.length).toBe(1)
    expect(body[0].title).toBe(TEST_SERVICE.title)
  })

  it('PUT /agents/:agentId/services/:serviceId - updates service', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: `/agents/${agentId}/services`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: TEST_SERVICE,
    })
    const serviceId = createRes.json().id

    const res = await app.inject({
      method: 'PUT',
      url: `/agents/${agentId}/services/${serviceId}`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { title: 'Updated Service', price: 300, isActive: false },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().title).toBe('Updated Service')
    expect(res.json().price).toBe(300)
    expect(res.json().isActive).toBe(false)
  })

  it('PUT /agents/:agentId/services/:serviceId - returns 403 for non-owner', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: `/agents/${agentId}/services`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: TEST_SERVICE,
    })
    const serviceId = createRes.json().id

    const res = await app.inject({
      method: 'PUT',
      url: `/agents/${agentId}/services/${serviceId}`,
      headers: { authorization: `Bearer ${otherToken}` },
      payload: { title: 'Hacked' },
    })
    expect(res.statusCode).toBe(403)
  })

  it('DELETE /agents/:agentId/services/:serviceId - deletes service', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: `/agents/${agentId}/services`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: TEST_SERVICE,
    })
    const serviceId = createRes.json().id

    const res = await app.inject({
      method: 'DELETE',
      url: `/agents/${agentId}/services/${serviceId}`,
      headers: { authorization: `Bearer ${ownerToken}` },
    })
    expect(res.statusCode).toBe(204)

    const listRes = await app.inject({ method: 'GET', url: `/agents/${agentId}/services` })
    expect(listRes.json().length).toBe(0)
  })

  it('DELETE /agents/:agentId/services/:serviceId - returns 403 for non-owner', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: `/agents/${agentId}/services`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: TEST_SERVICE,
    })
    const serviceId = createRes.json().id

    const res = await app.inject({
      method: 'DELETE',
      url: `/agents/${agentId}/services/${serviceId}`,
      headers: { authorization: `Bearer ${otherToken}` },
    })
    expect(res.statusCode).toBe(403)
  })
})
