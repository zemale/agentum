import Fastify from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import { healthRoutes } from './routes/health'
import { authRoutes } from './routes/auth'
import { agentRoutes } from './routes/agents'
import { taskRoutes } from './routes/tasks'
import { approveTask } from './routes/tasks'
import { walletRoutes } from './routes/wallet'
import { agentApiRoutes } from './routes/agent-api'
import { reviewRoutes } from './routes/reviews'
import { disputeRoutes } from './routes/disputes'
import { detectOfflineAgents } from './lib/offline-detection'

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
  app.register(walletRoutes, { prefix: '/wallet' })
  app.register(agentApiRoutes, { prefix: '/api/v1/agent' })
  app.register(reviewRoutes, { prefix: '/tasks' })
  app.register(disputeRoutes)

  return app
}

async function start() {
  const app = buildApp()
  try {
    await app.listen({ port: 3001, host: '0.0.0.0' })
    console.log('Agentum backend running on http://localhost:3001')

    // Offline detection: every 5 minutes
    setInterval(async () => {
      try {
        await detectOfflineAgents()
      } catch (e) {
        console.error('Failed to run offline detection:', e)
      }
    }, 5 * 60 * 1000)

    // Weekly cron: award "top_week" badge every Monday 00:00
    const scheduleTopWeekBadge = () => {
      const now = new Date()
      const nextMonday = new Date(now)
      // Day 1 = Monday
      const daysUntilMonday = (1 - now.getDay() + 7) % 7 || 7
      nextMonday.setDate(now.getDate() + daysUntilMonday)
      nextMonday.setHours(0, 0, 0, 0)
      const msUntilMonday = nextMonday.getTime() - now.getTime()

      setTimeout(async () => {
        try {
          const { prisma } = await import('./lib/prisma')
          const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
          const results = await prisma.task.groupBy({
            by: ['agentId'],
            where: { status: 'COMPLETED', completedAt: { gte: sevenDaysAgo } },
            _count: { id: true },
            orderBy: { _count: { id: 'desc' } },
            take: 1,
          })
          if (results.length > 0) {
            const topAgentId = results[0].agentId
            const exists = await prisma.badge.findFirst({ where: { agentId: topAgentId, type: 'top_week' } })
            if (!exists) {
              await prisma.badge.create({ data: { agentId: topAgentId, type: 'top_week' } })
              console.log(`Awarded top_week badge to agent ${topAgentId}`)
            }
          }
        } catch (e) {
          console.error('Failed to award top_week badge:', e)
        }
        // Re-schedule next week
        setInterval(async () => {
          try {
            const { prisma } = await import('./lib/prisma')
            const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
            const results = await prisma.task.groupBy({
              by: ['agentId'],
              where: { status: 'COMPLETED', completedAt: { gte: sevenDaysAgo } },
              _count: { id: true },
              orderBy: { _count: { id: 'desc' } },
              take: 1,
            })
            if (results.length > 0) {
              const topAgentId = results[0].agentId
              await prisma.badge.create({ data: { agentId: topAgentId, type: 'top_week' } })
              console.log(`Awarded top_week badge to agent ${topAgentId}`)
            }
          } catch (e) {
            console.error('Failed to award weekly top_week badge:', e)
          }
        }, 7 * 24 * 60 * 60 * 1000)
      }, msUntilMonday)
    }
    scheduleTopWeekBadge()

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
