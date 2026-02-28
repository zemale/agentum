import type { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma'
import { authenticate } from '../middleware/auth'

interface JwtPayload {
  id: string
  email: string
}

interface CreateTaskBody {
  agentId: string
  serviceId?: string
  title: string
  description: string
  budget: number
}

interface ProgressBody {
  message: string
}

interface CompleteBody {
  result: string
}

export async function taskRoutes(app: FastifyInstance) {
  // POST /tasks - create task with escrow
  app.post<{ Body: CreateTaskBody }>(
    '/',
    { preHandler: authenticate },
    async (request, reply) => {
      const payload = request.user as JwtPayload
      const { agentId, serviceId, title, description, budget } = request.body

      if (!agentId || !title || !description || budget === undefined) {
        return reply.status(400).send({ error: 'Bad Request', message: 'agentId, title, description and budget are required' })
      }

      const agent = await prisma.agent.findUnique({ where: { id: agentId } })
      if (!agent) {
        return reply.status(404).send({ error: 'Not Found', message: 'Agent not found' })
      }

      const customer = await prisma.user.findUnique({ where: { id: payload.id } })
      if (!customer || customer.balance < budget) {
        return reply.status(402).send({ error: 'Payment Required', message: 'Insufficient balance' })
      }

      const autoCloseAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

      const [task] = await prisma.$transaction([
        prisma.task.create({
          data: {
            customerId: payload.id,
            agentId,
            serviceId,
            title,
            description,
            budget,
            status: 'CREATED',
            autoCloseAt,
          },
        }),
        prisma.user.update({
          where: { id: payload.id },
          data: { balance: { decrement: budget }, frozen: { increment: budget } },
        }),
        prisma.transaction.create({
          data: {
            userId: payload.id,
            type: 'ESCROW_LOCK',
            amount: -budget,
            comment: `Escrow lock for task: ${title}`,
          },
        }),
      ])

      return reply.status(201).send(task)
    },
  )

  // GET /tasks - list tasks for current user
  app.get('/', { preHandler: authenticate }, async (request, reply) => {
    const payload = request.user as JwtPayload
    const tasks = await prisma.task.findMany({
      where: { customerId: payload.id },
      include: { agent: { select: { id: true, name: true } }, progress: true },
      orderBy: { createdAt: 'desc' },
    })
    return reply.send(tasks)
  })

  // GET /tasks/:id - get task detail
  app.get<{ Params: { id: string } }>('/:id', { preHandler: authenticate }, async (request, reply) => {
    const payload = request.user as JwtPayload
    const { id } = request.params
    const task = await prisma.task.findUnique({
      where: { id },
      include: { agent: { select: { id: true, name: true, ownerId: true } }, progress: { orderBy: { createdAt: 'asc' } } },
    })
    if (!task) return reply.status(404).send({ error: 'Not Found', message: 'Task not found' })
    // Only customer or agent owner can view
    if (task.customerId !== payload.id && task.agent.ownerId !== payload.id) {
      return reply.status(403).send({ error: 'Forbidden', message: 'Access denied' })
    }
    return reply.send(task)
  })

  // POST /tasks/:id/accept - agent accepts task
  app.post<{ Params: { id: string } }>(
    '/:id/accept',
    { preHandler: authenticate },
    async (request, reply) => {
      const payload = request.user as JwtPayload
      const { id } = request.params

      const task = await prisma.task.findUnique({
        where: { id },
        include: { agent: true },
      })
      if (!task) return reply.status(404).send({ error: 'Not Found', message: 'Task not found' })
      if (task.agent.ownerId !== payload.id) {
        return reply.status(403).send({ error: 'Forbidden', message: 'Only the agent owner can accept this task' })
      }
      if (task.status !== 'CREATED') {
        return reply.status(400).send({ error: 'Bad Request', message: 'Task cannot be accepted in current status' })
      }

      const updated = await prisma.task.update({
        where: { id },
        data: { status: 'ACCEPTED', acceptedAt: new Date() },
      })
      return reply.send(updated)
    },
  )

  // POST /tasks/:id/progress - agent posts progress
  app.post<{ Params: { id: string }; Body: ProgressBody }>(
    '/:id/progress',
    { preHandler: authenticate },
    async (request, reply) => {
      const payload = request.user as JwtPayload
      const { id } = request.params
      const { message } = request.body

      const task = await prisma.task.findUnique({
        where: { id },
        include: { agent: true },
      })
      if (!task) return reply.status(404).send({ error: 'Not Found', message: 'Task not found' })
      if (task.agent.ownerId !== payload.id) {
        return reply.status(403).send({ error: 'Forbidden', message: 'Only the agent owner can post progress' })
      }

      const progress = await prisma.progress.create({
        data: { taskId: id, message },
      })
      return reply.status(201).send(progress)
    },
  )

  // POST /tasks/:id/complete - agent submits result
  app.post<{ Params: { id: string }; Body: CompleteBody }>(
    '/:id/complete',
    { preHandler: authenticate },
    async (request, reply) => {
      const payload = request.user as JwtPayload
      const { id } = request.params
      const { result } = request.body

      const task = await prisma.task.findUnique({
        where: { id },
        include: { agent: true },
      })
      if (!task) return reply.status(404).send({ error: 'Not Found', message: 'Task not found' })
      if (task.agent.ownerId !== payload.id) {
        return reply.status(403).send({ error: 'Forbidden', message: 'Only the agent owner can complete this task' })
      }

      const autoCloseAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      const updated = await prisma.task.update({
        where: { id },
        data: { status: 'REVIEW', result, completedAt: new Date(), autoCloseAt },
      })
      return reply.send(updated)
    },
  )

  // POST /tasks/:id/approve - customer approves result
  app.post<{ Params: { id: string } }>(
    '/:id/approve',
    { preHandler: authenticate },
    async (request, reply) => {
      const payload = request.user as JwtPayload
      const { id } = request.params

      const task = await prisma.task.findUnique({
        where: { id },
        include: { agent: true },
      })
      if (!task) return reply.status(404).send({ error: 'Not Found', message: 'Task not found' })
      if (task.customerId !== payload.id) {
        return reply.status(403).send({ error: 'Forbidden', message: 'Only the customer can approve this task' })
      }
      if (task.status !== 'REVIEW') {
        return reply.status(400).send({ error: 'Bad Request', message: 'Task must be in REVIEW status to approve' })
      }

      await approveTask(task)
      const updated = await prisma.task.findUnique({ where: { id } })
      return reply.send(updated)
    },
  )
}

// Award milestone badges based on completed task count
export async function awardMilstoneBadges(agentId: string, completedCount: number) {
  const milestones = [
    { count: 10, type: '10_tasks' },
    { count: 50, type: '50_tasks' },
    { count: 100, type: '100_tasks' },
  ]

  for (const milestone of milestones) {
    if (completedCount >= milestone.count) {
      const exists = await prisma.badge.findFirst({ where: { agentId, type: milestone.type } })
      if (!exists) {
        await prisma.badge.create({ data: { agentId, type: milestone.type } })
      }
    }
  }
}

// Shared approve logic (used by route and auto-close cron)
export async function approveTask(task: { id: string; customerId: string; agentId: string; budget: number; agent: { ownerId: string } }) {
  const agentOwnerShare = Math.floor(task.budget * 0.9)
  const commission = task.budget - agentOwnerShare

  await prisma.$transaction([
    prisma.task.update({
      where: { id: task.id },
      data: { status: 'COMPLETED' },
    }),
    prisma.user.update({
      where: { id: task.customerId },
      data: { frozen: { decrement: task.budget } },
    }),
    prisma.user.update({
      where: { id: task.agent.ownerId },
      data: { balance: { increment: agentOwnerShare } },
    }),
    // Transaction logs
    prisma.transaction.create({
      data: {
        userId: task.customerId,
        type: 'PAYMENT',
        amount: -task.budget,
        taskId: task.id,
        comment: 'Payment for completed task',
      },
    }),
    prisma.transaction.create({
      data: {
        userId: task.agent.ownerId,
        type: 'EARNING',
        amount: agentOwnerShare,
        taskId: task.id,
        comment: 'Earning for completed task (90%)',
      },
    }),
    prisma.transaction.create({
      data: {
        userId: task.customerId,
        type: 'COMMISSION',
        amount: -commission,
        taskId: task.id,
        comment: 'Platform commission (10%)',
      },
    }),
  ])

  // Award milestone badges
  const completedCount = await prisma.task.count({
    where: { agentId: task.agentId, status: 'COMPLETED' },
  })
  await awardMilstoneBadges(task.agentId, completedCount)
}

// Shared decline logic
export async function declineTask(task: { id: string; customerId: string; budget: number }) {
  await prisma.$transaction([
    prisma.task.update({
      where: { id: task.id },
      data: { status: 'DECLINED' },
    }),
    prisma.user.update({
      where: { id: task.customerId },
      data: { balance: { increment: task.budget }, frozen: { decrement: task.budget } },
    }),
    prisma.transaction.create({
      data: {
        userId: task.customerId,
        type: 'ESCROW_RELEASE',
        amount: task.budget,
        taskId: task.id,
        comment: 'Escrow released - task declined',
      },
    }),
  ])
}
