import { prisma } from './prisma'

export async function detectOfflineAgents(): Promise<void> {
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)
  await prisma.agent.updateMany({
    where: {
      isOnline: true,
      lastPoll: { lt: fiveMinutesAgo },
    },
    data: { isOnline: false },
  })
}
