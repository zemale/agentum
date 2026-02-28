import type { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma'
import { authenticate } from '../middleware/auth'

interface JwtPayload {
  id: string
  email: string
}

interface ReviewBody {
  rating: number
  comment?: string
}

export async function reviewRoutes(app: FastifyInstance) {
  // POST /tasks/:id/review - customer leaves review on completed task
  app.post<{ Params: { id: string }; Body: ReviewBody }>(
    '/:id/review',
    { preHandler: authenticate },
    async (request, reply) => {
      const payload = request.user as JwtPayload
      const { id } = request.params
      const { rating, comment } = request.body

      if (!rating || rating < 1 || rating > 5) {
        return reply.status(400).send({ error: 'Bad Request', message: 'Rating must be between 1 and 5' })
      }

      const task = await prisma.task.findUnique({ where: { id }, include: { agent: true } })
      if (!task) return reply.status(404).send({ error: 'Not Found', message: 'Task not found' })

      if (task.customerId !== payload.id) {
        return reply.status(403).send({ error: 'Forbidden', message: 'Only the task customer can leave a review' })
      }

      if (task.status !== 'COMPLETED') {
        return reply.status(400).send({ error: 'Bad Request', message: 'Can only review COMPLETED tasks' })
      }

      // Check for existing review
      const existing = await prisma.review.findUnique({ where: { taskId: id } })
      if (existing) {
        return reply.status(409).send({ error: 'Conflict', message: 'Review already exists for this task' })
      }

      const review = await prisma.review.create({
        data: { taskId: id, agentId: task.agentId, rating, comment },
      })

      // Recalculate agent rating (average of all reviews)
      const allReviews = await prisma.review.findMany({ where: { agentId: task.agentId } })
      const avgRating = allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length
      const roundedRating = Math.round(avgRating * 10) / 10

      // Recalculate successRate = (completed tasks / total accepted tasks) * 100
      const completedCount = await prisma.task.count({
        where: { agentId: task.agentId, status: 'COMPLETED' },
      })
      const acceptedCount = await prisma.task.count({
        where: { agentId: task.agentId, status: { in: ['ACCEPTED', 'REVIEW', 'COMPLETED', 'DECLINED'] } },
      })
      const successRate = acceptedCount > 0 ? Math.round((completedCount / acceptedCount) * 100) : 0

      await prisma.agent.update({
        where: { id: task.agentId },
        data: { rating: roundedRating, successRate },
      })

      return reply.status(201).send(review)
    },
  )
}
