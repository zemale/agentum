import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { buildApp } from '../index'
import { prisma } from '../lib/prisma'

const CUSTOMER = {
  email: 'dispute-customer@example.com',
  password: 'password123',
  name: 'Dispute Customer',
}

const AGENT_OWNER = {
  email: 'dispute-agent-owner@example.com',
  password: 'password123',
  name: 'Dispute Agent Owner',
}

const ADMIN_USER = {
  email: 'dispute-admin@example.com',
  password: 'password123',
  name: 'Dispute Admin',
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
  const emails = [CUSTOMER.email, AGENT_OWNER.email, ADMIN_USER.email]
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
        await prisma.dispute.deleteMany({ where: { taskId: { in: taskIds } } })
        await prisma.progress.deleteMany({ where: { taskId: { in: taskIds } } })
        await prisma.review.deleteMany({ where: { taskId: { in: taskIds } } })
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
      await prisma.dispute.deleteMany({ where: { taskId: { in: customerTaskIds } } })
      await prisma.progress.deleteMany({ where: { taskId: { in: customerTaskIds } } })
      await prisma.review.deleteMany({ where: { taskId: { in: customerTaskIds } } })
      await prisma.task.deleteMany({ where: { id: { in: customerTaskIds } } })
    }
    await prisma.transaction.deleteMany({ where: { userId: { in: ids } } })
    await prisma.user.deleteMany({ where: { id: { in: ids } } })
  }
}

describe('Disputes', () => {
  let customerToken: string
  let agentOwnerToken: string
  let adminToken: string
  let agentId: string
  let customerId: string
  let agentOwnerId: string
  let adminId: string
  let app: ReturnType<typeof buildApp>

  beforeEach(async () => {
    await cleanupTestData()
    app = buildApp()

    customerToken = await getToken(app, CUSTOMER)
    agentOwnerToken = await getToken(app, AGENT_OWNER)
    adminToken = await getToken(app, ADMIN_USER)

    // Get user IDs
    const customerUser = await prisma.user.findUnique({ where: { email: CUSTOMER.email } })
    const agentOwnerUser = await prisma.user.findUnique({ where: { email: AGENT_OWNER.email } })
    const adminUser = await prisma.user.findUnique({ where: { email: ADMIN_USER.email } })
    customerId = customerUser!.id
    agentOwnerId = agentOwnerUser!.id
    adminId = adminUser!.id

    // Make adminUser an ADMIN
    await prisma.user.update({ where: { id: adminId }, data: { role: 'ADMIN' } })

    // Create agent
    const agentRes = await app.inject({
      method: 'POST',
      url: '/agents',
      headers: { authorization: `Bearer ${agentOwnerToken}` },
      payload: {
        name: 'Dispute Test Agent',
        description: 'Test agent for disputes',
        skills: 'testing',
        hourlyRate: 100,
      },
    })
    agentId = agentRes.json().id

    // Give customer enough balance
    await prisma.user.update({ where: { id: customerId }, data: { balance: 5000 } })
  })

  afterAll(async () => {
    await cleanupTestData()
  })

  // Helper: create task in REVIEW status
  async function createTaskInReview(budget = 500): Promise<string> {
    const task = await prisma.task.create({
      data: {
        customerId,
        agentId,
        title: 'Test dispute task',
        description: 'A task for dispute testing',
        budget,
        status: 'REVIEW',
      },
    })
    // Simulate frozen funds
    await prisma.user.update({ where: { id: customerId }, data: { frozen: { increment: budget } } })
    return task.id
  }

  // ---- Task 8.2 tests ----

  it('customer can open dispute on REVIEW task', async () => {
    const taskId = await createTaskInReview()

    const res = await app.inject({
      method: 'POST',
      url: `/tasks/${taskId}/dispute`,
      headers: { authorization: `Bearer ${customerToken}` },
      payload: { reason: 'Agent did not complete the work properly' },
    })

    expect(res.statusCode).toBe(201)
    const body = res.json()
    expect(body.status).toBe('OPEN')
    expect(body.taskId).toBe(taskId)

    const task = await prisma.task.findUnique({ where: { id: taskId } })
    expect(task!.status).toBe('DISPUTED')

    const dispute = await prisma.dispute.findUnique({ where: { taskId } })
    expect(dispute).not.toBeNull()
    expect(dispute!.reason).toBe('Agent did not complete the work properly')
  })

  it('cannot open dispute on non-REVIEW task', async () => {
    const task = await prisma.task.create({
      data: {
        customerId,
        agentId,
        title: 'Created task',
        description: 'desc',
        budget: 100,
        status: 'CREATED',
      },
    })

    const res = await app.inject({
      method: 'POST',
      url: `/tasks/${task.id}/dispute`,
      headers: { authorization: `Bearer ${customerToken}` },
      payload: { reason: 'Issue' },
    })

    expect(res.statusCode).toBe(400)
  })

  it('cannot open dispute twice on same task', async () => {
    const taskId = await createTaskInReview()

    await app.inject({
      method: 'POST',
      url: `/tasks/${taskId}/dispute`,
      headers: { authorization: `Bearer ${customerToken}` },
      payload: { reason: 'First dispute' },
    })

    const res = await app.inject({
      method: 'POST',
      url: `/tasks/${taskId}/dispute`,
      headers: { authorization: `Bearer ${customerToken}` },
      payload: { reason: 'Second dispute' },
    })

    expect(res.statusCode).toBe(409)
  })

  // ---- Task 8.3 tests ----

  it('admin resolves dispute in favor of customer → customer gets refund', async () => {
    const budget = 500
    const taskId = await createTaskInReview(budget)

    // Open dispute
    const disputeRes = await app.inject({
      method: 'POST',
      url: `/tasks/${taskId}/dispute`,
      headers: { authorization: `Bearer ${customerToken}` },
      payload: { reason: 'Bad work' },
    })
    const disputeId = disputeRes.json().id

    const customerBefore = await prisma.user.findUnique({ where: { id: customerId } })

    const res = await app.inject({
      method: 'POST',
      url: `/disputes/${disputeId}/resolve`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { winner: 'customer', resolution: 'Customer is right' },
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.status).toBe('RESOLVED_CUSTOMER')

    const customerAfter = await prisma.user.findUnique({ where: { id: customerId } })
    expect(customerAfter!.balance).toBe(customerBefore!.balance + budget)
    expect(customerAfter!.frozen).toBe(customerBefore!.frozen - budget)
  })

  it('admin resolves dispute in favor of agent → agent gets 90% of budget', async () => {
    const budget = 500
    const taskId = await createTaskInReview(budget)

    // Open dispute
    const disputeRes = await app.inject({
      method: 'POST',
      url: `/tasks/${taskId}/dispute`,
      headers: { authorization: `Bearer ${customerToken}` },
      payload: { reason: 'Bad work' },
    })
    const disputeId = disputeRes.json().id

    const agentOwnerBefore = await prisma.user.findUnique({ where: { id: agentOwnerId } })
    const customerBefore = await prisma.user.findUnique({ where: { id: customerId } })

    const res = await app.inject({
      method: 'POST',
      url: `/disputes/${disputeId}/resolve`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { winner: 'agent', resolution: 'Agent did good work' },
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.status).toBe('RESOLVED_AGENT')

    const agentOwnerAfter = await prisma.user.findUnique({ where: { id: agentOwnerId } })
    const customerAfter = await prisma.user.findUnique({ where: { id: customerId } })

    const agentPayout = Math.floor(budget * 0.9)
    expect(agentOwnerAfter!.balance).toBe(agentOwnerBefore!.balance + agentPayout)
    expect(customerAfter!.frozen).toBe(customerBefore!.frozen - budget)
  })

  it('non-admin cannot resolve dispute', async () => {
    const taskId = await createTaskInReview()

    const disputeRes = await app.inject({
      method: 'POST',
      url: `/tasks/${taskId}/dispute`,
      headers: { authorization: `Bearer ${customerToken}` },
      payload: { reason: 'Issue' },
    })
    const disputeId = disputeRes.json().id

    const res = await app.inject({
      method: 'POST',
      url: `/disputes/${disputeId}/resolve`,
      headers: { authorization: `Bearer ${customerToken}` },
      payload: { winner: 'customer', resolution: 'I want my money back' },
    })

    expect(res.statusCode).toBe(403)
  })
})
