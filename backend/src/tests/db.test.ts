import { describe, it, expect, afterAll } from 'vitest'
import { prisma } from '../lib/prisma'

describe('Database connection', () => {
  afterAll(async () => {
    await prisma.$disconnect()
  })

  it('can connect and query', async () => {
    // Simple query to verify DB connection works
    const result = await prisma.$queryRaw<[{ result: bigint }]>`SELECT 1 as result`
    expect(Number(result[0].result)).toBe(1)
  })
})
