import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { buildApp } from '../index'
import { prisma } from '../lib/prisma'

const USER = {
  email: 'wallet-user@example.com',
  password: 'password123',
  name: 'Wallet User',
}

async function getToken(app: ReturnType<typeof buildApp>) {
  const res = await app.inject({
    method: 'POST',
    url: '/auth/register',
    payload: USER,
  })
  if (res.statusCode === 201) return { token: res.json().token, id: res.json().user.id }
  const loginRes = await app.inject({
    method: 'POST',
    url: '/auth/login',
    payload: { email: USER.email, password: USER.password },
  })
  return { token: loginRes.json().token, id: loginRes.json().user.id }
}

async function cleanupTestData() {
  const user = await prisma.user.findUnique({ where: { email: USER.email } })
  if (user) {
    await prisma.transaction.deleteMany({ where: { userId: user.id } })
    await prisma.user.delete({ where: { id: user.id } })
  }
}

describe('Wallet API', () => {
  let app: ReturnType<typeof buildApp>
  let token: string
  let userId: string

  beforeEach(async () => {
    await cleanupTestData()
    app = buildApp()
    await app.ready()
    const result = await getToken(app)
    token = result.token
    userId = result.id
  })

  afterAll(async () => {
    await cleanupTestData()
    await prisma.$disconnect()
  })

  describe('GET /wallet/balance', () => {
    it('returns user balance and frozen amount', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/wallet/balance',
        headers: { authorization: `Bearer ${token}` },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body).toHaveProperty('balance')
      expect(body).toHaveProperty('frozen')
      expect(typeof body.balance).toBe('number')
    })

    it('requires authentication', async () => {
      const res = await app.inject({ method: 'GET', url: '/wallet/balance' })
      expect(res.statusCode).toBe(401)
    })
  })

  describe('GET /wallet/transactions', () => {
    it('returns list with registration bonus transaction by default', async () => {
      // Registration creates a BONUS transaction for 1000 pulses
      const res = await app.inject({
        method: 'GET',
        url: '/wallet/transactions',
        headers: { authorization: `Bearer ${token}` },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body).toHaveProperty('data')
      expect(body).toHaveProperty('pagination')
      expect(Array.isArray(body.data)).toBe(true)
      expect(body.pagination.total).toBe(1) // registration bonus
      expect(body.data[0].type).toBe('BONUS')
      expect(body.pagination.page).toBe(1)
    })

    it('returns transactions for the user', async () => {
      // Seed an additional transaction (1 BONUS already exists from registration)
      await prisma.transaction.create({
        data: {
          userId,
          type: 'DEPOSIT',
          amount: 500,
          comment: 'Test deposit',
        },
      })

      const res = await app.inject({
        method: 'GET',
        url: '/wallet/transactions',
        headers: { authorization: `Bearer ${token}` },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.pagination.total).toBe(2) // BONUS + DEPOSIT
      const types = body.data.map((t: { type: string }) => t.type)
      expect(types).toContain('DEPOSIT')
    })

    it('supports pagination via ?page=1&limit=5', async () => {
      // Seed 9 more transactions (1 BONUS already exists from registration = 10 total)
      for (let i = 0; i < 9; i++) {
        await prisma.transaction.create({
          data: { userId, type: 'DEPOSIT', amount: i + 1, comment: `Deposit ${i + 1}` },
        })
      }

      const res = await app.inject({
        method: 'GET',
        url: '/wallet/transactions?page=1&limit=5',
        headers: { authorization: `Bearer ${token}` },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.data).toHaveLength(5)
      expect(body.pagination.total).toBe(10)
      expect(body.pagination.pages).toBe(2)
    })

    it('requires authentication', async () => {
      const res = await app.inject({ method: 'GET', url: '/wallet/transactions' })
      expect(res.statusCode).toBe(401)
    })
  })
})
