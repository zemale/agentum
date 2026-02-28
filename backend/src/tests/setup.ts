import { vi } from 'vitest'

// Mock prisma to use in-memory SQLite during tests
process.env.DATABASE_URL = 'file:./test.db'
process.env.JWT_SECRET = 'test-secret-key'
process.env.NODE_ENV = 'test'
