import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { buildApp } from '../index'
import { prisma } from '../lib/prisma'

const CUSTOMER = {
  email: 'agent-api-customer@example.com',
  password: 'password123',
  name: 'Agent API Customer',
}

const AGENT_OWNER = {
  email: 'agent-api-owner@example.com',
  password: 'password123',
  name: 'Agent API Owner',
}

async function getToken(app: ReturnType<typeof buildApp>, user: typeof CUSTOMER) {
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
  const emails = [CUSTOMER.email, AGENT_OWNER.email]
  const users = await prisma.user.findMany({ where: { email: { in: emails } }, select: { id: true } })
  const ids = users.map((u) => u.id)
  if (ids.length > 0) {
    const agents = await prisma.agent.findMany({ where: { ownerId: { in: ids } }, select: { id: true } })
    const agentIds = agents.map((a) => a.id)
    if (agentIds.length > 0) {
      const tasks = await prisma.task.findMany({ where: { agentId: { in: agentIds } }, select: { id: true } })
      const taskIds = tasks.map((t) => t.id)
      if (taskIds.length > 0) {
        await prisma.progress.deleteMany({ where: { taskId: { in: taskIds } } })
        await prisma.review.deleteMany({ where: { taskId: { in: taskIds } } })
        await prisma.dispute.deleteMany({ where: { taskId: { in: taskIds } } })
        await prisma.task.deleteMany({ where: { id: { in: taskIds } } })
      }
      await prisma.service.deleteMany({ where: { agentId: { in: agentIds } } })
      await prisma.badge.deleteMany({ where: { agentId: { in: agentIds } } })
      await prisma.agent.deleteMany({ where: { id: { in: agentIds } } })
    }
    const customerTasks = await prisma.task.findMany({ where: { customerId: { in: ids } }, select: { id: true } })
    const customerTaskIds = customerTasks.map((t) => t.id)
    if (customerTaskIds.length > 0) {
      await prisma.progress.deleteMany({ where: { taskId: { in: customerTaskIds } } })
      await prisma.review.deleteMany({ where: { taskId: { in: customerTaskIds } } })
      await prisma.dispute.deleteMany({ where: { taskId: { in: customerTaskIds } } })
      await prisma.task.deleteMany({ where: { id: { in: customerTaskIds } } })
    }
    await prisma.transaction.deleteMany({ where: { userId: { in: ids } } })
    await prisma.user.deleteMany({ where: { id: { in: ids } } })
  }
}

describe('Agent API', () => {
  let customerToken: string
  let agentApiKey: string
  let agentId: string
  let customerId: string
  let app: ReturnType<typeof buildApp>

  beforeEach(async () => {
    await cleanupTestData()
    app = buildApp()
    customerToken = await getToken(app, CUSTOMER)
    await getToken(app, AGENT_OWNER)

    const customer = await prisma.user.findUnique({ where: { email: CUSTOMER.email } })
    customerId = customer!.id

    const agentOwner = await prisma.user.findUnique({ where: { email: AGENT_OWNER.email } })

    // Create agent directly to get apiKey
    const agent = await prisma.agent.create({
      data: {
        ownerId: agentOwner!.id,
        name: 'API Test Agent',
        description: 'Test Agent',
        skills: 'coding',
        hourlyRate: 50,
      },
    })
    agentId = agent.id
    agentApiKey = agent.apiKey
  })

  afterAll(async () => {
    await cleanupTestData()
  })

  // ── Task 5.1: GET /api/v1/agent/tasks/pending ────────────────────────────

  describe('GET /api/v1/agent/tasks/pending', () => {
    it('should return 401 without API key', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/v1/agent/tasks/pending' })
      expect(res.statusCode).toBe(401)
    })

    it('should return 401 with invalid API key', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/agent/tasks/pending',
        headers: { 'x-api-key': 'invalid-key' },
      })
      expect(res.statusCode).toBe(401)
    })

    it('should return CREATED tasks for this agent and update isOnline/lastPoll', async () => {
      // Create a task for this agent
      const task = await prisma.task.create({
        data: {
          customerId,
          agentId,
          title: 'Pending Task',
          description: 'Do something',
          budget: 100,
          status: 'CREATED',
        },
      })

      // Create a non-CREATED task (should not be returned)
      await prisma.task.create({
        data: {
          customerId,
          agentId,
          title: 'Accepted Task',
          description: 'Already accepted',
          budget: 50,
          status: 'ACCEPTED',
        },
      })

      const before = new Date()
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/agent/tasks/pending',
        headers: { 'x-api-key': agentApiKey },
      })
      const after = new Date()

      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(Array.isArray(body)).toBe(true)
      expect(body).toHaveLength(1)
      expect(body[0].id).toBe(task.id)
      expect(body[0].status).toBe('CREATED')

      // Check isOnline/lastPoll updated
      const updatedAgent = await prisma.agent.findUnique({ where: { id: agentId } })
      expect(updatedAgent!.isOnline).toBe(true)
      expect(new Date(updatedAgent!.lastPoll!).getTime()).toBeGreaterThanOrEqual(before.getTime())
      expect(new Date(updatedAgent!.lastPoll!).getTime()).toBeLessThanOrEqual(after.getTime())
    })
  })

  // ── Task 5.2: POST /api/v1/agent/tasks/:id/decline ───────────────────────

  describe('POST /api/v1/agent/tasks/:id/decline', () => {
    it('should decline task, set CANCELLED, and refund customer', async () => {
      const budget = 200

      // Freeze funds as if task was created normally
      await prisma.user.update({
        where: { id: customerId },
        data: { balance: { decrement: budget }, frozen: { increment: budget } },
      })

      const task = await prisma.task.create({
        data: {
          customerId,
          agentId,
          title: 'Task to Decline',
          description: 'Will be declined',
          budget,
          status: 'CREATED',
        },
      })

      const customerBefore = await prisma.user.findUnique({ where: { id: customerId } })

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/agent/tasks/${task.id}/decline`,
        headers: { 'x-api-key': agentApiKey },
      })

      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.status).toBe('CANCELLED')

      // Customer gets pulses back
      const customerAfter = await prisma.user.findUnique({ where: { id: customerId } })
      expect(customerAfter!.frozen).toBe(customerBefore!.frozen - budget)
      expect(customerAfter!.balance).toBe(customerBefore!.balance + budget)
    })

    it('should return 404 for non-existent task', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/agent/tasks/nonexistent-id/decline',
        headers: { 'x-api-key': agentApiKey },
      })
      expect(res.statusCode).toBe(404)
    })

    it('should return 403 if task belongs to another agent', async () => {
      // Create another agent
      const anotherAgent = await prisma.agent.create({
        data: {
          ownerId: (await prisma.user.findUnique({ where: { email: CUSTOMER.email } }))!.id,
          name: 'Another Agent',
          description: 'Another',
          skills: 'other',
          hourlyRate: 10,
        },
      })

      const task = await prisma.task.create({
        data: {
          customerId,
          agentId: anotherAgent.id,
          title: 'Other Task',
          description: 'Not yours',
          budget: 50,
          status: 'CREATED',
        },
      })

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/agent/tasks/${task.id}/decline`,
        headers: { 'x-api-key': agentApiKey },
      })
      expect(res.statusCode).toBe(403)
    })

    it('should return 400 if task is not CREATED', async () => {
      const task = await prisma.task.create({
        data: {
          customerId,
          agentId,
          title: 'Accepted Task',
          description: 'Already accepted',
          budget: 50,
          status: 'ACCEPTED',
        },
      })

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/agent/tasks/${task.id}/decline`,
        headers: { 'x-api-key': agentApiKey },
      })
      expect(res.statusCode).toBe(400)
    })
  })

  // ── Task 5.3: Offline detection logic ───────────────────────────────────

  describe('Offline detection', () => {
    it('should mark agents as offline if lastPoll is older than 5 minutes', async () => {
      // Simulate agent that polled 6 minutes ago
      const sixMinutesAgo = new Date(Date.now() - 6 * 60 * 1000)
      await prisma.agent.update({
        where: { id: agentId },
        data: { isOnline: true, lastPoll: sixMinutesAgo },
      })

      // Run the offline detection logic
      const { detectOfflineAgents } = await import('../lib/offline-detection')
      await detectOfflineAgents()

      const agent = await prisma.agent.findUnique({ where: { id: agentId } })
      expect(agent!.isOnline).toBe(false)
    })

    it('should NOT mark agents offline if lastPoll is recent (< 5 minutes)', async () => {
      const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000)
      await prisma.agent.update({
        where: { id: agentId },
        data: { isOnline: true, lastPoll: twoMinutesAgo },
      })

      const { detectOfflineAgents } = await import('../lib/offline-detection')
      await detectOfflineAgents()

      const agent = await prisma.agent.findUnique({ where: { id: agentId } })
      expect(agent!.isOnline).toBe(true)
    })

    it('should NOT mark already-offline agents', async () => {
      const sixMinutesAgo = new Date(Date.now() - 6 * 60 * 1000)
      await prisma.agent.update({
        where: { id: agentId },
        data: { isOnline: false, lastPoll: sixMinutesAgo },
      })

      const { detectOfflineAgents } = await import('../lib/offline-detection')
      await detectOfflineAgents()

      const agent = await prisma.agent.findUnique({ where: { id: agentId } })
      expect(agent!.isOnline).toBe(false)
    })
  })
})
