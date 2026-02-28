import type { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma'
import { authenticate } from '../middleware/auth'

interface JwtPayload {
  id: string
  email: string
}

interface CreateAgentBody {
  name: string
  description: string
  skills: string
  hourlyRate: number
}

interface UpdateAgentBody {
  name?: string
  description?: string
  skills?: string
  hourlyRate?: number
}

interface CreateServiceBody {
  title: string
  description: string
  price: number
}

interface UpdateServiceBody {
  title?: string
  description?: string
  price?: number
  isActive?: boolean
}

export async function agentRoutes(app: FastifyInstance) {
  // POST /agents - create agent (auth required)
  app.post<{ Body: CreateAgentBody }>(
    '/',
    { preHandler: authenticate },
    async (request, reply) => {
      const payload = request.user as JwtPayload
      const { name, description, skills, hourlyRate } = request.body

      if (!name || !description || !skills || hourlyRate === undefined) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'name, description, skills and hourlyRate are required',
        })
      }

      if (typeof hourlyRate !== 'number' || hourlyRate < 0) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'hourlyRate must be a non-negative number',
        })
      }

      const agent = await prisma.agent.create({
        data: {
          ownerId: payload.id,
          name,
          description,
          skills,
          hourlyRate,
        },
        include: {
          owner: { select: { id: true, name: true, email: true } },
          services: true,
        },
      })

      return reply.status(201).send(agent)
    },
  )

  // GET /agents - list all agents (public, marketplace)
  app.get('/', async (request, reply) => {
    const agents = await prisma.agent.findMany({
      include: {
        owner: { select: { id: true, name: true } },
        services: { where: { isActive: true } },
        _count: { select: { reviews: true } },
      },
      orderBy: { rating: 'desc' },
    })
    return reply.send(agents)
  })

  // GET /agents/:id - get single agent profile
  app.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const { id } = request.params
    const agent = await prisma.agent.findUnique({
      where: { id },
      include: {
        owner: { select: { id: true, name: true } },
        services: true,
        reviews: {
          include: {
            task: { select: { title: true, customer: { select: { name: true } } } },
          },
          orderBy: { createdAt: 'desc' },
        },
        badges: true,
        _count: { select: { reviews: true, tasks: true } },
      },
    })

    if (!agent) {
      return reply.status(404).send({ error: 'Not Found', message: 'Agent not found' })
    }

    return reply.send(agent)
  })

  // PUT /agents/:id - update agent (owner only)
  app.put<{ Params: { id: string }; Body: UpdateAgentBody }>(
    '/:id',
    { preHandler: authenticate },
    async (request, reply) => {
      const payload = request.user as JwtPayload
      const { id } = request.params

      const agent = await prisma.agent.findUnique({ where: { id } })
      if (!agent) {
        return reply.status(404).send({ error: 'Not Found', message: 'Agent not found' })
      }

      if (agent.ownerId !== payload.id) {
        return reply.status(403).send({ error: 'Forbidden', message: 'You are not the owner of this agent' })
      }

      const { name, description, skills, hourlyRate } = request.body

      if (hourlyRate !== undefined && (typeof hourlyRate !== 'number' || hourlyRate < 0)) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'hourlyRate must be a non-negative number',
        })
      }

      const updated = await prisma.agent.update({
        where: { id },
        data: {
          ...(name !== undefined && { name }),
          ...(description !== undefined && { description }),
          ...(skills !== undefined && { skills }),
          ...(hourlyRate !== undefined && { hourlyRate }),
        },
        include: {
          owner: { select: { id: true, name: true, email: true } },
          services: true,
        },
      })

      return reply.send(updated)
    },
  )

  // DELETE /agents/:id - delete agent (owner only)
  app.delete<{ Params: { id: string } }>(
    '/:id',
    { preHandler: authenticate },
    async (request, reply) => {
      const payload = request.user as JwtPayload
      const { id } = request.params

      const agent = await prisma.agent.findUnique({ where: { id } })
      if (!agent) {
        return reply.status(404).send({ error: 'Not Found', message: 'Agent not found' })
      }

      if (agent.ownerId !== payload.id) {
        return reply.status(403).send({ error: 'Forbidden', message: 'You are not the owner of this agent' })
      }

      // Delete related records first
      await prisma.service.deleteMany({ where: { agentId: id } })
      await prisma.badge.deleteMany({ where: { agentId: id } })
      await prisma.agent.delete({ where: { id } })

      return reply.status(204).send()
    },
  )

  // POST /agents/:id/services - add service (owner only)
  app.post<{ Params: { id: string }; Body: CreateServiceBody }>(
    '/:id/services',
    { preHandler: authenticate },
    async (request, reply) => {
      const payload = request.user as JwtPayload
      const { id: agentId } = request.params
      const { title, description, price } = request.body

      if (!title || !description || price === undefined) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'title, description and price are required',
        })
      }

      const agent = await prisma.agent.findUnique({ where: { id: agentId } })
      if (!agent) {
        return reply.status(404).send({ error: 'Not Found', message: 'Agent not found' })
      }

      if (agent.ownerId !== payload.id) {
        return reply.status(403).send({ error: 'Forbidden', message: 'You are not the owner of this agent' })
      }

      const service = await prisma.service.create({
        data: { agentId, title, description, price },
      })

      return reply.status(201).send(service)
    },
  )

  // GET /agents/:id/services - list services (public)
  app.get<{ Params: { id: string } }>('/:id/services', async (request, reply) => {
    const { id: agentId } = request.params

    const agent = await prisma.agent.findUnique({ where: { id: agentId } })
    if (!agent) {
      return reply.status(404).send({ error: 'Not Found', message: 'Agent not found' })
    }

    const services = await prisma.service.findMany({
      where: { agentId },
      orderBy: { price: 'asc' },
    })

    return reply.send(services)
  })

  // PUT /agents/:agentId/services/:serviceId - update service (owner only)
  app.put<{ Params: { agentId: string; serviceId: string }; Body: UpdateServiceBody }>(
    '/:agentId/services/:serviceId',
    { preHandler: authenticate },
    async (request, reply) => {
      const payload = request.user as JwtPayload
      const { agentId, serviceId } = request.params

      const agent = await prisma.agent.findUnique({ where: { id: agentId } })
      if (!agent) {
        return reply.status(404).send({ error: 'Not Found', message: 'Agent not found' })
      }

      if (agent.ownerId !== payload.id) {
        return reply.status(403).send({ error: 'Forbidden', message: 'You are not the owner of this agent' })
      }

      const service = await prisma.service.findFirst({ where: { id: serviceId, agentId } })
      if (!service) {
        return reply.status(404).send({ error: 'Not Found', message: 'Service not found' })
      }

      const { title, description, price, isActive } = request.body

      const updated = await prisma.service.update({
        where: { id: serviceId },
        data: {
          ...(title !== undefined && { title }),
          ...(description !== undefined && { description }),
          ...(price !== undefined && { price }),
          ...(isActive !== undefined && { isActive }),
        },
      })

      return reply.send(updated)
    },
  )

  // DELETE /agents/:agentId/services/:serviceId - delete service (owner only)
  app.delete<{ Params: { agentId: string; serviceId: string } }>(
    '/:agentId/services/:serviceId',
    { preHandler: authenticate },
    async (request, reply) => {
      const payload = request.user as JwtPayload
      const { agentId, serviceId } = request.params

      const agent = await prisma.agent.findUnique({ where: { id: agentId } })
      if (!agent) {
        return reply.status(404).send({ error: 'Not Found', message: 'Agent not found' })
      }

      if (agent.ownerId !== payload.id) {
        return reply.status(403).send({ error: 'Forbidden', message: 'You are not the owner of this agent' })
      }

      const service = await prisma.service.findFirst({ where: { id: serviceId, agentId } })
      if (!service) {
        return reply.status(404).send({ error: 'Not Found', message: 'Service not found' })
      }

      await prisma.service.delete({ where: { id: serviceId } })

      return reply.status(204).send()
    },
  )
}
