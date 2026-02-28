import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { buildApp } from '../index'
import { prisma } from '../lib/prisma'
import { awardMilstoneBadges } from '../routes/tasks'

const CUSTOMER = { email: 'badge-customer@example.com', password: 'password123', name: 'Badge Customer' }
const AGENT_OWNER = { email: 'badge-agent-owner@example.com', password: 'password123', name: 'Badge Agent Owner' }

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

describe('Phase 7: Badges', () => {
  let app: ReturnType<typeof buildApp>
  let customerToken: string
  let agentOwnerToken: string
  let agentId: string
  let customerId: string

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
      payload: { name: 'Badge Agent', description: 'Test', skills: 'coding', hourlyRate: 50 },
    })
    agentId = agentRes.json().id

    await prisma.user.update({ where: { id: customerId }, data: { balance: 500000 } })
  })

  afterAll(async () => {
    await cleanupTestData()
    await app.close()
  })

  it('awards "10_tasks" badge when agent completes 10 tasks', async () => {
    // Directly call awardMilestoneBadges with count=10
    await awardMilstoneBadges(agentId, 10)

    const badges = await prisma.badge.findMany({ where: { agentId } })
    expect(badges.some((b) => b.type === '10_tasks')).toBe(true)
  })

  it('does not award same badge twice', async () => {
    await awardMilstoneBadges(agentId, 10)
    await awardMilstoneBadges(agentId, 10)

    const badges = await prisma.badge.findMany({ where: { agentId, type: '10_tasks' } })
    expect(badges.length).toBe(1)
  })

  it('awards "50_tasks" badge at 50 completed tasks', async () => {
    await awardMilstoneBadges(agentId, 50)

    const badges = await prisma.badge.findMany({ where: { agentId } })
    expect(badges.some((b) => b.type === '50_tasks')).toBe(true)
  })

  it('awards "100_tasks" badge at 100 completed tasks', async () => {
    await awardMilstoneBadges(agentId, 100)

    const badges = await prisma.badge.findMany({ where: { agentId } })
    expect(badges.some((b) => b.type === '100_tasks')).toBe(true)
  })

  it('badge awarded via approve task flow at 10 completions', async () => {
    // Create and complete 10 tasks via API to trigger badge
    for (let i = 0; i < 10; i++) {
      const taskRes = await app.inject({
        method: 'POST',
        url: '/tasks',
        headers: { authorization: `Bearer ${customerToken}` },
        payload: { agentId, title: `Task ${i}`, description: 'Do it', budget: 10 },
      })
      const taskId = taskRes.json().id
      await app.inject({ method: 'POST', url: `/tasks/${taskId}/accept`, headers: { authorization: `Bearer ${agentOwnerToken}` } })
      await app.inject({ method: 'POST', url: `/tasks/${taskId}/complete`, headers: { authorization: `Bearer ${agentOwnerToken}` }, payload: { result: 'Done' } })
      await app.inject({ method: 'POST', url: `/tasks/${taskId}/approve`, headers: { authorization: `Bearer ${customerToken}` } })
    }

    const badges = await prisma.badge.findMany({ where: { agentId } })
    expect(badges.some((b) => b.type === '10_tasks')).toBe(true)
  })
})
