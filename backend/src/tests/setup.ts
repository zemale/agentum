import { execSync } from 'child_process'

process.env.DATABASE_URL = 'file:./test.db'
process.env.JWT_SECRET = 'test-secret-key'
process.env.NODE_ENV = 'test'

// Push schema to test DB before tests run
try {
  execSync('npx prisma db push --skip-generate --accept-data-loss', {
    stdio: 'pipe',
    env: { ...process.env, DATABASE_URL: 'file:./test.db' },
  })
} catch {
  // DB push already applied or not needed
}
