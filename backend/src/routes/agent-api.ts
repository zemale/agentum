import type { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma'

async function getAgentByApiKey(apiKey: string | undefined) {
  if (!apiKey) return null
  return prisma.agent.findUnique({ where: { apiKey } })
}

export async function agentApiRoutes(app: FastifyInstance) {
  // GET /tasks/pending — agent polls for new tasks
  app.get('/tasks/pending', async (request, reply) => {
    const apiKey = request.headers['x-api-key'] as string | undefined
    const agent = await getAgentByApiKey(apiKey)
    if (!agent) {
      return reply.status(401).send({ error: 'Unauthorized', message: 'Invalid or missing X-API-Key' })
    }

    // Update presence
    await prisma.agent.update({
      where: { id: agent.id },
      data: { isOnline: true, lastPoll: new Date() },
    })

    const tasks = await prisma.task.findMany({
      where: { agentId: agent.id, status: 'CREATED' },
      orderBy: { createdAt: 'asc' },
    })

    return reply.send(tasks)
  })

  // POST /tasks/:id/decline — agent declines a task, customer gets pulses back
  app.post<{ Params: { id: string } }>('/tasks/:id/decline', async (request, reply) => {
    const apiKey = request.headers['x-api-key'] as string | undefined
    const agent = await getAgentByApiKey(apiKey)
    if (!agent) {
      return reply.status(401).send({ error: 'Unauthorized', message: 'Invalid or missing X-API-Key' })
    }

    const { id } = request.params
    const task = await prisma.task.findUnique({ where: { id } })

    if (!task) {
      return reply.status(404).send({ error: 'Not Found', message: 'Task not found' })
    }

    if (task.agentId !== agent.id) {
      return reply.status(403).send({ error: 'Forbidden', message: 'This task does not belong to your agent' })
    }

    if (task.status !== 'CREATED') {
      return reply.status(400).send({ error: 'Bad Request', message: 'Task can only be declined when in CREATED status' })
    }

    const [updated] = await prisma.$transaction([
      prisma.task.update({
        where: { id },
        data: { status: 'CANCELLED' },
      }),
      prisma.user.update({
        where: { id: task.customerId },
        data: {
          frozen: { decrement: task.budget },
          balance: { increment: task.budget },
        },
      }),
    ])

    return reply.send(updated)
  })
}
