import Fastify from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import { healthRoutes } from './routes/health'
import { authRoutes } from './routes/auth'
import { agentRoutes } from './routes/agents'
import { taskRoutes } from './routes/tasks'
import { approveTask } from './routes/tasks'

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
  app.register(agentRoutes, { prefix: '/agents' })
  app.register(taskRoutes, { prefix: '/tasks' })

  return app
}

async function start() {
  const app = buildApp()
  try {
    await app.listen({ port: 3001, host: '0.0.0.0' })
    console.log('Agentum backend running on http://localhost:3001')

    // Auto-close tasks in REVIEW after 7 days
    setInterval(async () => {
      const { prisma } = await import('./lib/prisma')
      const overdueTasks = await prisma.task.findMany({
        where: { status: 'REVIEW', autoCloseAt: { lt: new Date() } },
        include: { agent: true },
      })
      for (const task of overdueTasks) {
        try {
          await approveTask(task)
          console.log(`Auto-closed task ${task.id}`)
        } catch (e) {
          console.error(`Failed to auto-close task ${task.id}:`, e)
        }
      }
    }, 3600000) // every hour
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}

if (require.main === module) {
  start()
}
