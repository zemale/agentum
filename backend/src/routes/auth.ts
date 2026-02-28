import type { FastifyInstance } from 'fastify'
import bcrypt from 'bcrypt'
import { prisma } from '../lib/prisma'
import { authenticate } from '../middleware/auth'

interface RegisterBody {
  email: string
  password: string
  name: string
}

interface LoginBody {
  email: string
  password: string
}

interface JwtPayload {
  id: string
  email: string
}

export async function authRoutes(app: FastifyInstance) {
  // POST /auth/register
  app.post<{ Body: RegisterBody }>('/register', async (request, reply) => {
    const { email, password, name } = request.body

    if (!email || !password || !name) {
      return reply.status(400).send({ error: 'Bad Request', message: 'email, password and name are required' })
    }

    if (password.length < 6) {
      return reply.status(400).send({ error: 'Bad Request', message: 'password must be at least 6 characters' })
    }

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      return reply.status(400).send({ error: 'Bad Request', message: 'Email already registered' })
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        balance: 1000,
        frozen: 0,
      },
    })

    // Record bonus transaction
    await prisma.transaction.create({
      data: {
        userId: user.id,
        type: 'BONUS',
        amount: 1000,
        comment: 'Стартовый бонус при регистрации',
      },
    })

    const token = app.jwt.sign({ id: user.id, email: user.email } satisfies JwtPayload)

    return reply.status(201).send({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        balance: user.balance,
        frozen: user.frozen,
        createdAt: user.createdAt,
      },
    })
  })

  // POST /auth/login
  app.post<{ Body: LoginBody }>('/login', async (request, reply) => {
    const { email, password } = request.body

    if (!email || !password) {
      return reply.status(400).send({ error: 'Bad Request', message: 'email and password are required' })
    }

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) {
      return reply.status(401).send({ error: 'Unauthorized', message: 'Invalid credentials' })
    }

    const valid = await bcrypt.compare(password, user.password)
    if (!valid) {
      return reply.status(401).send({ error: 'Unauthorized', message: 'Invalid credentials' })
    }

    const token = app.jwt.sign({ id: user.id, email: user.email } satisfies JwtPayload)

    return reply.status(200).send({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        balance: user.balance,
        frozen: user.frozen,
        createdAt: user.createdAt,
      },
    })
  })

  // GET /auth/me — protected endpoint
  app.get('/me', { preHandler: authenticate }, async (request, reply) => {
    const payload = request.user as JwtPayload
    const user = await prisma.user.findUnique({ where: { id: payload.id } })
    if (!user) {
      return reply.status(404).send({ error: 'Not Found', message: 'User not found' })
    }
    return reply.send({
      id: user.id,
      email: user.email,
      name: user.name,
      balance: user.balance,
      frozen: user.frozen,
      createdAt: user.createdAt,
    })
  })
}
