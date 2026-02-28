import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { buildApp } from '../index'
import { prisma } from '../lib/prisma'

const CUSTOMER = {
  email: 'task-customer@example.com',
  password: 'password123',
  name: 'Task Customer',
}

const AGENT_OWNER = {
  email: 'task-agent-owner@example.com',
  password: 'password123',
  name: 'Task Agent Owner',
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
      const tasks = await prisma.task.findMany({
        where: { agentId: { in: agentIds } },
        select: { id: true },
      })
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
    // Also cleanup tasks where customer is one of our users
    const customerTasks = await prisma.task.findMany({
      where: { customerId: { in: ids } },
      select: { id: true },
    })
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

describe('Tasks', () => {
  let customerToken: string
  let agentOwnerToken: string
  let agentId: string
  let customerId: string
  let agentOwnerId: string
  let app: ReturnType<typeof buildApp>

  beforeEach(async () => {
    await cleanupTestData()
    app = buildApp()
    customerToken = await getToken(app, CUSTOMER)
    agentOwnerToken = await getToken(app, AGENT_OWNER)

    // Get user ids
    const customer = await prisma.user.findUnique({ where: { email: CUSTOMER.email } })
    customerId = customer!.id
    const agentOwner = await prisma.user.findUnique({ where: { email: AGENT_OWNER.email } })
    agentOwnerId = agentOwner!.id

    // Create an agent
    const agentRes = await app.inject({
      method: 'POST',
      url: '/agents',
      headers: { authorization: `Bearer ${agentOwnerToken}` },
      payload: { name: 'Test Agent', description: 'AI Agent', skills: 'coding', hourlyRate: 50 },
    })
    agentId = agentRes.json().id
  })

  afterAll(async () => {
    await cleanupTestData()
    await prisma.$disconnect()
  })

  // Task 4.2 — Create task with escrow
  describe('POST /tasks', () => {
    it('creates task and deducts from customer balance', async () => {
      const before = await prisma.user.findUnique({ where: { id: customerId } })
      const res = await app.inject({
        method: 'POST',
        url: '/tasks',
        headers: { authorization: `Bearer ${customerToken}` },
        payload: { agentId, title: 'Test Task', description: 'Do something', budget: 100 },
      })
      expect(res.statusCode).toBe(201)
      const body = res.json()
      expect(body.status).toBe('CREATED')
      expect(body.customerId).toBe(customerId)
      expect(body.budget).toBe(100)
      expect(body.autoCloseAt).toBeDefined()

      const after = await prisma.user.findUnique({ where: { id: customerId } })
      expect(after!.balance).toBe(before!.balance - 100)
      expect(after!.frozen).toBe(before!.frozen + 100)
    })

    it('returns 402 if balance insufficient', async () => {
      await prisma.user.update({ where: { id: customerId }, data: { balance: 50 } })
      const res = await app.inject({
        method: 'POST',
        url: '/tasks',
        headers: { authorization: `Bearer ${customerToken}` },
        payload: { agentId, title: 'Test Task', description: 'Do something', budget: 100 },
      })
      expect(res.statusCode).toBe(402)
    })

    it('returns 401 without auth', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/tasks',
        payload: { agentId, title: 'Test Task', description: 'Do something', budget: 100 },
      })
      expect(res.statusCode).toBe(401)
    })
  })

  // Task 4.3 — Accept task
  describe('POST /tasks/:id/accept', () => {
    it('agent accepts task → status ACCEPTED, acceptedAt set', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/tasks',
        headers: { authorization: `Bearer ${customerToken}` },
        payload: { agentId, title: 'Test Task', description: 'Do something', budget: 100 },
      })
      const taskId = createRes.json().id

      const res = await app.inject({
        method: 'POST',
        url: `/tasks/${taskId}/accept`,
        headers: { authorization: `Bearer ${agentOwnerToken}` },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.status).toBe('ACCEPTED')
      expect(body.acceptedAt).toBeDefined()
    })

    it('returns 403 if wrong agent owner', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/tasks',
        headers: { authorization: `Bearer ${customerToken}` },
        payload: { agentId, title: 'Test Task', description: 'Do something', budget: 100 },
      })
      const taskId = createRes.json().id

      const res = await app.inject({
        method: 'POST',
        url: `/tasks/${taskId}/accept`,
        headers: { authorization: `Bearer ${customerToken}` },
      })
      expect(res.statusCode).toBe(403)
    })
  })

  // Task 4.4 — Progress
  describe('POST /tasks/:id/progress', () => {
    it('agent posts progress → Progress record created', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/tasks',
        headers: { authorization: `Bearer ${customerToken}` },
        payload: { agentId, title: 'Test Task', description: 'Do something', budget: 100 },
      })
      const taskId = createRes.json().id

      await app.inject({
        method: 'POST',
        url: `/tasks/${taskId}/accept`,
        headers: { authorization: `Bearer ${agentOwnerToken}` },
      })

      const res = await app.inject({
        method: 'POST',
        url: `/tasks/${taskId}/progress`,
        headers: { authorization: `Bearer ${agentOwnerToken}` },
        payload: { message: 'Working on it...' },
      })
      expect(res.statusCode).toBe(201)
      const body = res.json()
      expect(body.message).toBe('Working on it...')
      expect(body.taskId).toBe(taskId)
    })
  })

  // Task 4.5 — Complete task
  describe('POST /tasks/:id/complete', () => {
    it('agent completes → status REVIEW, result saved, autoCloseAt updated', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/tasks',
        headers: { authorization: `Bearer ${customerToken}` },
        payload: { agentId, title: 'Test Task', description: 'Do something', budget: 100 },
      })
      const taskId = createRes.json().id

      await app.inject({
        method: 'POST',
        url: `/tasks/${taskId}/accept`,
        headers: { authorization: `Bearer ${agentOwnerToken}` },
      })

      const res = await app.inject({
        method: 'POST',
        url: `/tasks/${taskId}/complete`,
        headers: { authorization: `Bearer ${agentOwnerToken}` },
        payload: { result: 'Here is the finished work' },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.status).toBe('REVIEW')
      expect(body.result).toBe('Here is the finished work')
      expect(body.completedAt).toBeDefined()
      expect(body.autoCloseAt).toBeDefined()
    })
  })

  // Task 4.6 — Approve task
  describe('POST /tasks/:id/approve', () => {
    it('customer approves → frozen released, agent gets 90%, status COMPLETED', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/tasks',
        headers: { authorization: `Bearer ${customerToken}` },
        payload: { agentId, title: 'Test Task', description: 'Do something', budget: 100 },
      })
      const taskId = createRes.json().id

      await app.inject({
        method: 'POST',
        url: `/tasks/${taskId}/accept`,
        headers: { authorization: `Bearer ${agentOwnerToken}` },
      })

      await app.inject({
        method: 'POST',
        url: `/tasks/${taskId}/complete`,
        headers: { authorization: `Bearer ${agentOwnerToken}` },
        payload: { result: 'Done!' },
      })

      const agentOwnerBefore = await prisma.user.findUnique({ where: { id: agentOwnerId } })
      const customerBefore = await prisma.user.findUnique({ where: { id: customerId } })

      const res = await app.inject({
        method: 'POST',
        url: `/tasks/${taskId}/approve`,
        headers: { authorization: `Bearer ${customerToken}` },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.status).toBe('COMPLETED')

      const agentOwnerAfter = await prisma.user.findUnique({ where: { id: agentOwnerId } })
      const customerAfter = await prisma.user.findUnique({ where: { id: customerId } })

      // Agent owner gets 90% of budget
      expect(agentOwnerAfter!.balance).toBe(agentOwnerBefore!.balance + 90)
      // Customer frozen decreases
      expect(customerAfter!.frozen).toBe(customerBefore!.frozen - 100)
    })
  })
})
