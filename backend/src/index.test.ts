import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import healthRoutes from '@/routes/health.js';

// Mock dependencies
vi.mock('@/lib/prisma.js', () => ({
  prisma: {
    $queryRaw: vi.fn(),
  },
}));

vi.mock('@/lib/redis.js', () => ({
  healthCheck: vi.fn(),
  connectRedis: vi.fn(),
  disconnectRedis: vi.fn(),
}));

describe('App', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify();
    await app.register(healthRoutes);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    vi.clearAllMocks();
  });

  it('should have health routes registered', async () => {
    // Verify routes are registered by checking the printRoutes output
    const routes = app.printRoutes();
    expect(routes).toContain('health');
    expect(routes).toContain('(GET, HEAD)');
  });
});
