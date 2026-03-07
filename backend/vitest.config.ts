import { defineConfig } from 'vitest/config';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    env: {
      // Default test environment variables
      NODE_ENV: 'test',
      PORT: '3001',
      LOG_LEVEL: 'error',
      DATABASE_URL: 'postgresql://postgres:postgres@localhost:5436/agentum?schema=public',
      REDIS_URL: 'redis://localhost:6379',
      RATE_LIMIT_ENABLED: 'false',
      JWT_SECRET: 'test-jwt-secret-for-testing-only',
      JWT_REFRESH_SECRET: 'test-refresh-secret-for-testing-only',
      BCRYPT_ROUNDS: '4', // Faster hashing for tests
    },
  },
});
