import type { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma'
import { authenticate } from '../middleware/auth'

interface JwtPayload {
  id: string
  email: string
}

interface TransactionsQuery {
  page?: string
  limit?: string
}

export async function walletRoutes(app: FastifyInstance) {
  // GET /wallet/transactions - paginated transaction history
  app.get<{ Querystring: TransactionsQuery }>(
    '/transactions',
    { preHandler: authenticate },
    async (request, reply) => {
      const payload = request.user as JwtPayload
      const page = Math.max(1, parseInt(request.query.page || '1', 10))
      const limit = Math.min(100, Math.max(1, parseInt(request.query.limit || '20', 10)))
      const skip = (page - 1) * limit

      const [transactions, total] = await Promise.all([
        prisma.transaction.findMany({
          where: { userId: payload.id },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        }),
        prisma.transaction.count({ where: { userId: payload.id } }),
      ])

      return reply.send({
        data: transactions,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      })
    },
  )

  // GET /wallet/balance - current balance info
  app.get('/balance', { preHandler: authenticate }, async (request, reply) => {
    const payload = request.user as JwtPayload
    const user = await prisma.user.findUnique({
      where: { id: payload.id },
      select: { balance: true, frozen: true },
    })
    if (!user) return reply.status(404).send({ error: 'Not Found', message: 'User not found' })
    return reply.send(user)
  })
}
