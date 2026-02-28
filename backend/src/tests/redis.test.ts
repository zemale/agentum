import { describe, it, expect } from 'vitest'

// In test environment REDIS_URL is not set, so Redis is disabled gracefully
describe('Redis client', () => {
  it('returns null when NODE_ENV is test (graceful no-op)', async () => {
    const { getRedis } = await import('../lib/redis')
    const client = getRedis()
    // In test env, Redis is disabled to avoid needing a live Redis server
    expect(client).toBeNull()
  })

  it('redisSet/redisGet are no-ops when Redis is unavailable', async () => {
    const { redisSet, redisGet } = await import('../lib/redis')
    await expect(redisSet('key', 'value')).resolves.toBeUndefined()
    await expect(redisGet('key')).resolves.toBeNull()
  })
})
