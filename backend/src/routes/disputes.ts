import type { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma'
import { authenticate } from '../middleware/auth'

interface JwtPayload {
  id: string
  email: string
}

interface DisputeBody {
  reason: string
}

interface ResolveBody {
  winner: 'customer' | 'agent'
  resolution: string
}

export async function disputeRoutes(app: FastifyInstance) {
  // POST /tasks/:id/dispute - customer opens dispute on REVIEW task
  app.post<{ Params: { id: string }; Body: DisputeBody }>(
    '/tasks/:id/dispute',
    { preHandler: authenticate },
    async (request, reply) => {
      const payload = request.user as JwtPayload
      const { id } = request.params
      const { reason } = request.body

      if (!reason) {
        return reply.status(400).send({ error: 'Bad Request', message: 'reason is required' })
      }

      const task = await prisma.task.findUnique({
        where: { id },
        include: { agent: true },
      })

      if (!task) {
        return reply.status(404).send({ error: 'Not Found', message: 'Task not found' })
      }

      if (task.customerId !== payload.id) {
        return reply.status(403).send({ error: 'Forbidden', message: 'Only the task customer can open a dispute' })
      }

      const existing = await prisma.dispute.findUnique({ where: { taskId: id } })
      if (existing) {
        return reply.status(409).send({ error: 'Conflict', message: 'Dispute already exists for this task' })
      }

      if (task.status !== 'REVIEW') {
        return reply.status(400).send({ error: 'Bad Request', message: 'Can only open dispute on tasks in REVIEW status' })
      }

      // Create dispute and update task status atomically
      const [dispute] = await prisma.$transaction([
        prisma.dispute.create({
          data: { taskId: id, reason, status: 'OPEN' },
        }),
        prisma.task.update({
          where: { id },
          data: { status: 'DISPUTED' },
        }),
      ])

      return reply.status(201).send(dispute)
    }
  )

  // POST /disputes/:id/resolve - admin resolves a dispute
  app.post<{ Params: { id: string }; Body: ResolveBody }>(
    '/disputes/:id/resolve',
    { preHandler: authenticate },
    async (request, reply) => {
      const payload = request.user as JwtPayload
      const { id } = request.params
      const { winner, resolution } = request.body

      // Check admin role
      const user = await prisma.user.findUnique({ where: { id: payload.id } })
      if (!user || user.role !== 'ADMIN') {
        return reply.status(403).send({ error: 'Forbidden', message: 'Only admins can resolve disputes' })
      }

      if (!winner || !['customer', 'agent'].includes(winner)) {
        return reply.status(400).send({ error: 'Bad Request', message: 'winner must be "customer" or "agent"' })
      }

      if (!resolution) {
        return reply.status(400).send({ error: 'Bad Request', message: 'resolution is required' })
      }

      const dispute = await prisma.dispute.findUnique({
        where: { id },
        include: { task: { include: { agent: true } } },
      })

      if (!dispute) {
        return reply.status(404).send({ error: 'Not Found', message: 'Dispute not found' })
      }

      if (dispute.status !== 'OPEN' && dispute.status !== 'IN_REVIEW') {
        return reply.status(400).send({ error: 'Bad Request', message: 'Dispute is already resolved' })
      }

      const { task } = dispute
      const budget = task.budget
      const newStatus = winner === 'customer' ? 'RESOLVED_CUSTOMER' : 'RESOLVED_AGENT'

      if (winner === 'customer') {
        // Refund customer: frozen -= budget, balance += budget
        await prisma.$transaction([
          prisma.dispute.update({
            where: { id },
            data: { status: newStatus, resolution, resolvedBy: payload.id, resolvedAt: new Date() },
          }),
          prisma.task.update({ where: { id: task.id }, data: { status: 'DISPUTED' } }),
          prisma.user.update({
            where: { id: task.customerId },
            data: { frozen: { decrement: budget }, balance: { increment: budget } },
          }),
          prisma.transaction.create({
            data: { userId: task.customerId, type: 'DISPUTE_REFUND', amount: budget, taskId: task.id, comment: 'Dispute resolved in customer favor' },
          }),
        ])
      } else {
        // Pay agent 90% of budget, customer loses frozen funds
        const agentPayout = Math.floor(budget * 0.9)
        await prisma.$transaction([
          prisma.dispute.update({
            where: { id },
            data: { status: newStatus, resolution, resolvedBy: payload.id, resolvedAt: new Date() },
          }),
          prisma.task.update({ where: { id: task.id }, data: { status: 'COMPLETED' } }),
          prisma.user.update({
            where: { id: task.customerId },
            data: { frozen: { decrement: budget } },
          }),
          prisma.user.update({
            where: { id: task.agent.ownerId },
            data: { balance: { increment: agentPayout } },
          }),
          prisma.transaction.create({
            data: { userId: task.agent.ownerId, type: 'DISPUTE_PAYOUT', amount: agentPayout, taskId: task.id, comment: 'Dispute resolved in agent favor' },
          }),
        ])
      }

      const updatedDispute = await prisma.dispute.findUnique({ where: { id } })
      return reply.status(200).send(updatedDispute)
    }
  )
}
