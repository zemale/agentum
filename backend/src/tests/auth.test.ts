import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { buildApp } from '../index'
import { prisma } from '../lib/prisma'

const TEST_USER = {
  email: 'test@example.com',
  password: 'password123',
  name: 'Test User',
}

async function cleanupTestUsers() {
  const emails = [TEST_USER.email, 'login@example.com', 'protected@example.com']
  const users = await prisma.user.findMany({ where: { email: { in: emails } }, select: { id: true } })
  const ids = users.map((u) => u.id)
  if (ids.length > 0) {
    await prisma.transaction.deleteMany({ where: { userId: { in: ids } } })
    await prisma.user.deleteMany({ where: { id: { in: ids } } })
  }
}

describe('POST /auth/register', () => {
  beforeEach(async () => {
    await cleanupTestUsers()
  })
  afterAll(async () => {
    await cleanupTestUsers()
    await prisma.$disconnect()
  })

  it('registers a new user and returns JWT + user', async () => {
    const app = buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: TEST_USER,
    })
    expect(res.statusCode).toBe(201)
    const body = res.json()
    expect(body.token).toBeDefined()
    expect(body.user.email).toBe(TEST_USER.email)
    expect(body.user.name).toBe(TEST_USER.name)
    expect(body.user.balance).toBe(1000)
    expect(body.user.password).toBeUndefined()
  })

  it('returns 400 if email already taken', async () => {
    const app = buildApp()
    await app.inject({ method: 'POST', url: '/auth/register', payload: TEST_USER })
    const res = await app.inject({ method: 'POST', url: '/auth/register', payload: TEST_USER })
    expect(res.statusCode).toBe(400)
  })

  it('returns 400 for missing fields', async () => {
    const app = buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email: 'bad@example.com' },
    })
    expect(res.statusCode).toBe(400)
  })
})

describe('POST /auth/login', () => {
  const loginUser = { email: 'login@example.com', password: 'secret123', name: 'Login User' }

  beforeEach(async () => {
    await cleanupTestUsers()
    const app = buildApp()
    await app.inject({ method: 'POST', url: '/auth/register', payload: loginUser })
  })
  afterAll(async () => {
    await cleanupTestUsers()
  })

  it('logs in and returns JWT', async () => {
    const app = buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: loginUser.email, password: loginUser.password },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.token).toBeDefined()
    expect(body.user.email).toBe(loginUser.email)
  })

  it('returns 401 for wrong password', async () => {
    const app = buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: loginUser.email, password: 'wrong' },
    })
    expect(res.statusCode).toBe(401)
  })

  it('returns 401 for unknown email', async () => {
    const app = buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'nobody@example.com', password: 'anything' },
    })
    expect(res.statusCode).toBe(401)
  })
})

describe('Auth middleware', () => {
  it('returns 401 for protected endpoint without token', async () => {
    const app = buildApp()
    const res = await app.inject({ method: 'GET', url: '/auth/me' })
    expect(res.statusCode).toBe(401)
  })

  it('returns user for protected endpoint with valid token', async () => {
    const app = buildApp()
    await cleanupTestUsers()
    const reg = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email: 'protected@example.com', password: 'pass123', name: 'Protected' },
    })
    const { token } = reg.json()

    const res = await app.inject({
      method: 'GET',
      url: '/auth/me',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().email).toBe('protected@example.com')
  })
})
