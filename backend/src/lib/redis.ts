import Redis from 'ioredis'

let redisClient: Redis | null = null

export function getRedis(): Redis | null {
  if (process.env.NODE_ENV === 'test') return null

  if (!redisClient) {
    const url = process.env.REDIS_URL || 'redis://localhost:6379'
    redisClient = new Redis(url, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
    })

    redisClient.on('error', (err) => {
      console.warn('[Redis] Connection error (non-fatal):', err.message)
    })
  }

  return redisClient
}

export async function redisSet(key: string, value: string, ttlSeconds?: number): Promise<void> {
  const redis = getRedis()
  if (!redis) return
  if (ttlSeconds) {
    await redis.set(key, value, 'EX', ttlSeconds)
  } else {
    await redis.set(key, value)
  }
}

export async function redisGet(key: string): Promise<string | null> {
  const redis = getRedis()
  if (!redis) return null
  return redis.get(key)
}

export async function redisDel(key: string): Promise<void> {
  const redis = getRedis()
  if (!redis) return
  await redis.del(key)
}

export async function closeRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit()
    redisClient = null
  }
}
