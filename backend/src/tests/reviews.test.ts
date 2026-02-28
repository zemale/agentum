import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { buildApp } from '../index'
import { prisma } from '../lib/prisma'

const CUSTOMER = { email: 'review-customer@example.com', password: 'password123', name: 'Review Customer' }
const AGENT_OWNER = { email: 'review-agent-owner@example.com', password: 'password123', name: 'Review Agent Owner' }

async function getToken(app: ReturnType<typeof buildApp>, user: typeof CUSTOMER) {
  const res = await app.inject({ method: 'POST', url: '/auth/register', payload: user })
  if (res.statusCode === 201) return res.json().token
  const loginRes = await app.inject({ method: 'POST', url: '/auth/login', payload: { email: user.email, password: user.password } })
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
        await prisma.review.deleteMany({ where: { taskId: { in: taskIds } } })
        await prisma.task.deleteMany({ where: { id: { in: taskIds } } })
      }
      await prisma.badge.deleteMany({ where: { agentId: { in: agentIds } } })
      await prisma.agent.deleteMany({ where: { id: { in: agentIds } } })
    }
    await prisma.transaction.deleteMany({ where: { userId: { in: ids } } })
    await prisma.user.deleteMany({ where: { id: { in: ids } } })
  }
}

describe('Phase 7: Reviews', () => {
  let app: ReturnType<typeof buildApp>
  let customerToken: string
  let agentOwnerToken: string
  let agentId: string
  let customerId: string

  async function createCompletedTask() {
    const taskRes = await app.inject({
      method: 'POST',
      url: '/tasks',
      headers: { authorization: `Bearer ${customerToken}` },
      payload: { agentId, title: 'Review Task', description: 'Do it', budget: 100 },
    })
    const taskId = taskRes.json().id
    await app.inject({ method: 'POST', url: `/tasks/${taskId}/accept`, headers: { authorization: `Bearer ${agentOwnerToken}` } })
    await app.inject({ method: 'POST', url: `/tasks/${taskId}/complete`, headers: { authorization: `Bearer ${agentOwnerToken}` }, payload: { result: 'Done' } })
    await app.inject({ method: 'POST', url: `/tasks/${taskId}/approve`, headers: { authorization: `Bearer ${customerToken}` } })
    return taskId
  }

  beforeEach(async () => {
    app = buildApp()
    await cleanupTestData()

    customerToken = await getToken(app, CUSTOMER)
    agentOwnerToken = await getToken(app, AGENT_OWNER)

    const customerUser = await prisma.user.findUnique({ where: { email: CUSTOMER.email } })
    customerId = customerUser!.id

    const agentRes = await app.inject({
      method: 'POST',
      url: '/agents',
      headers: { authorization: `Bearer ${agentOwnerToken}` },
      payload: { name: 'Review Agent', description: 'Test', skills: 'coding', hourlyRate: 50 },
    })
    agentId = agentRes.json().id

    // Give customer enough balance
    await prisma.user.update({ where: { id: customerId }, data: { balance: 5000 } })
  })

  afterAll(async () => {
    await cleanupTestData()
    await app.close()
  })

  describe('POST /tasks/:id/review', () => {
    it('customer leaves review on COMPLETED task → agent rating recalculated', async () => {
      const taskId = await createCompletedTask()

      const res = await app.inject({
        method: 'POST',
        url: `/tasks/${taskId}/review`,
        headers: { authorization: `Bearer ${customerToken}` },
        payload: { rating: 5, comment: 'Excellent work!' },
      })

      expect(res.statusCode).toBe(201)
      const body = res.json()
      expect(body.rating).toBe(5)
      expect(body.comment).toBe('Excellent work!')

      // Agent rating should be recalculated
      const agent = await prisma.agent.findUnique({ where: { id: agentId } })
      expect(agent!.rating).toBe(5)
    })

    it('agent successRate is updated after review', async () => {
      const taskId = await createCompletedTask()

      await app.inject({
        method: 'POST',
        url: `/tasks/${taskId}/review`,
        headers: { authorization: `Bearer ${customerToken}` },
        payload: { rating: 4 },
      })

      const agent = await prisma.agent.findUnique({ where: { id: agentId } })
      expect(agent!.successRate).toBeGreaterThan(0)
    })

    it('cannot leave review twice (unique taskId)', async () => {
      const taskId = await createCompletedTask()

      await app.inject({
        method: 'POST',
        url: `/tasks/${taskId}/review`,
        headers: { authorization: `Bearer ${customerToken}` },
        payload: { rating: 5 },
      })

      const res = await app.inject({
        method: 'POST',
        url: `/tasks/${taskId}/review`,
        headers: { authorization: `Bearer ${customerToken}` },
        payload: { rating: 3 },
      })

      expect(res.statusCode).toBe(409)
    })

    it('cannot review task not in COMPLETED status', async () => {
      const taskRes = await app.inject({
        method: 'POST',
        url: '/tasks',
        headers: { authorization: `Bearer ${customerToken}` },
        payload: { agentId, title: 'Not Done', description: 'Not done yet', budget: 100 },
      })
      const taskId = taskRes.json().id

      const res = await app.inject({
        method: 'POST',
        url: `/tasks/${taskId}/review`,
        headers: { authorization: `Bearer ${customerToken}` },
        payload: { rating: 5 },
      })

      expect(res.statusCode).toBe(400)
    })

    it('non-customer cannot leave review', async () => {
      const taskId = await createCompletedTask()

      const res = await app.inject({
        method: 'POST',
        url: `/tasks/${taskId}/review`,
        headers: { authorization: `Bearer ${agentOwnerToken}` },
        payload: { rating: 5 },
      })

      expect(res.statusCode).toBe(403)
    })

    it('average rating calculated correctly from multiple reviews', async () => {
      // First task + review with rating 4
      const taskId1 = await createCompletedTask()
      await app.inject({
        method: 'POST',
        url: `/tasks/${taskId1}/review`,
        headers: { authorization: `Bearer ${customerToken}` },
        payload: { rating: 4 },
      })

      // Second task + review with rating 2
      const taskId2 = await createCompletedTask()
      const res = await app.inject({
        method: 'POST',
        url: `/tasks/${taskId2}/review`,
        headers: { authorization: `Bearer ${customerToken}` },
        payload: { rating: 2 },
      })

      expect(res.statusCode).toBe(201)

      const agent = await prisma.agent.findUnique({ where: { id: agentId } })
      expect(agent!.rating).toBe(3) // (4+2)/2 = 3.0
    })
  })
})
