import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import healthRoutes from './health.js';

// Mock the prisma module
vi.mock('@/lib/prisma.js', () => ({
  prisma: {
    $queryRaw: vi.fn(),
  },
}));

// Mock the redis module
vi.mock('@/lib/redis.js', () => ({
  healthCheck: vi.fn(),
  connectRedis: vi.fn(),
  disconnectRedis: vi.fn(),
}));

import { prisma } from '@/lib/prisma.js';
import { healthCheck as redisHealthCheck } from '@/lib/redis.js';

describe('Health Routes', () => {
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

  describe('GET /health', () => {
    it('should return status ok, version, and timestamp', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health',
      });

      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('status', 'ok');
      expect(body).toHaveProperty('version', '1.0.0');
      expect(body).toHaveProperty('timestamp');

      // Verify timestamp is a valid ISO string
      const timestamp = new Date(body.timestamp);
      expect(timestamp.toISOString()).toBe(body.timestamp);
    });
  });

  describe('GET /health/db', () => {
    it('should return ok when database is healthy', async () => {
      vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([{ 1: 1 }]);

      const response = await app.inject({
        method: 'GET',
        url: '/health/db',
      });

      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('status', 'ok');
      expect(body).toHaveProperty('latency');
      expect(typeof body.latency).toBe('number');
      expect(body).toHaveProperty('timestamp');
    });

    it('should return error when database check fails', async () => {
      vi.mocked(prisma.$queryRaw).mockRejectedValueOnce(new Error('Connection refused'));

      const response = await app.inject({
        method: 'GET',
        url: '/health/db',
      });

      expect(response.statusCode).toBe(503);

      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('status', 'error');
      expect(body).toHaveProperty('error', 'Connection refused');
      expect(body).toHaveProperty('timestamp');
    });
  });

  describe('GET /health/redis', () => {
    it('should return ok when redis is healthy', async () => {
      vi.mocked(redisHealthCheck).mockResolvedValueOnce({
        status: 'ok',
        latency: 5,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/health/redis',
      });

      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('status', 'ok');
      expect(body).toHaveProperty('latency', 5);
      expect(body).toHaveProperty('timestamp');
    });

    it('should return error when redis check fails', async () => {
      vi.mocked(redisHealthCheck).mockResolvedValueOnce({
        status: 'error',
        message: 'Redis connection failed',
      });

      const response = await app.inject({
        method: 'GET',
        url: '/health/redis',
      });

      expect(response.statusCode).toBe(503);

      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('status', 'error');
      expect(body).toHaveProperty('error', 'Redis connection failed');
      expect(body).toHaveProperty('timestamp');
    });
  });

  describe('GET /health/detailed', () => {
    it('should return all services healthy', async () => {
      vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([{ 1: 1 }]);
      vi.mocked(redisHealthCheck).mockResolvedValueOnce({
        status: 'ok',
        latency: 3,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/health/detailed',
      });

      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('status', 'ok');
      expect(body).toHaveProperty('version', '1.0.0');
      expect(body).toHaveProperty('timestamp');
      expect(body).toHaveProperty('checks');

      expect(body.checks.database).toEqual({
        status: 'ok',
        latency: expect.any(Number),
      });

      expect(body.checks.redis).toEqual({
        status: 'ok',
        latency: 3,
      });
    });

    it('should return error status when database fails', async () => {
      vi.mocked(prisma.$queryRaw).mockRejectedValueOnce(new Error('DB error'));
      vi.mocked(redisHealthCheck).mockResolvedValueOnce({
        status: 'ok',
        latency: 3,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/health/detailed',
      });

      expect(response.statusCode).toBe(503);

      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('status', 'error');
      expect(body.checks.database).toEqual({
        status: 'error',
        error: 'DB error',
      });
      expect(body.checks.redis).toEqual({
        status: 'ok',
        latency: 3,
      });
    });

    it('should return error status when redis fails', async () => {
      vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([{ 1: 1 }]);
      vi.mocked(redisHealthCheck).mockResolvedValueOnce({
        status: 'error',
        message: 'Redis down',
      });

      const response = await app.inject({
        method: 'GET',
        url: '/health/detailed',
      });

      expect(response.statusCode).toBe(503);

      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('status', 'error');
      expect(body.checks.database).toEqual({
        status: 'ok',
        latency: expect.any(Number),
      });
      expect(body.checks.redis).toEqual({
        status: 'error',
        error: 'Redis down',
      });
    });

    it('should return error status when both services fail', async () => {
      vi.mocked(prisma.$queryRaw).mockRejectedValueOnce(new Error('DB error'));
      vi.mocked(redisHealthCheck).mockResolvedValueOnce({
        status: 'error',
        message: 'Redis down',
      });

      const response = await app.inject({
        method: 'GET',
        url: '/health/detailed',
      });

      expect(response.statusCode).toBe(503);

      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('status', 'error');
      expect(body.checks.database).toEqual({
        status: 'error',
        error: 'DB error',
      });
      expect(body.checks.redis).toEqual({
        status: 'error',
        error: 'Redis down',
      });
    });
  });
});
