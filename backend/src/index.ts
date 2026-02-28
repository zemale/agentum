import Fastify from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import { healthRoutes } from './routes/health'
import { authRoutes } from './routes/auth'

export function buildApp() {
  const app = Fastify({ logger: process.env.NODE_ENV !== 'test' })

  app.register(cors, {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  })

  app.register(jwt, {
    secret: process.env.JWT_SECRET || 'agentum-dev-secret-change-in-production',
  })

  app.register(healthRoutes)
  app.register(authRoutes, { prefix: '/auth' })

  return app
}

async function start() {
  const app = buildApp()
  try {
    await app.listen({ port: 3001, host: '0.0.0.0' })
    console.log('Agentum backend running on http://localhost:3001')
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}

if (require.main === module) {
  start()
}
