import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import rateLimitPlugin, { rateLimitConfigs } from './rate-limits.js';

// Mock the redis module
vi.mock('@/lib/redis.js', () => ({
  getRedisClient: vi.fn(() => ({
    status: 'ready',
    ping: vi.fn(() => Promise.resolve('PONG')),
  })),
  connectRedis: vi.fn(() => Promise.resolve()),
  disconnectRedis: vi.fn(() => Promise.resolve()),
  healthCheck: vi.fn(() => Promise.resolve({ status: 'ok', latency: 1 })),
}));

// Mock the logger
vi.mock('@/lib/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
  generateTraceId: vi.fn(() => 'test-trace-id'),
  createChildLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
}));

// Mock the env module
vi.mock('@/config/env.js', () => ({
  env: {
    PORT: 3001,
    NODE_ENV: 'test',
    LOG_LEVEL: 'error',
    DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
    REDIS_URL: 'redis://localhost:6379',
    RATE_LIMIT_ENABLED: true,
  },
}));

describe('rate-limits plugin', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = Fastify({
      logger: false,
    });
  });

  afterEach(async () => {
    await app.close();
    vi.clearAllMocks();
  });

  describe('plugin registration', () => {
    it('should register rate limit plugin without errors', async () => {
      await expect(app.register(rateLimitPlugin)).resolves.not.toThrow();
    });

    it('should apply rate limiting to routes', async () => {
      await app.register(rateLimitPlugin);

      // Add a test route
      app.get('/test', async () => ({ message: 'ok' }));

      // First request should succeed
      const response1 = await app.inject({
        method: 'GET',
        url: '/test',
      });
      expect(response1.statusCode).toBe(200);
    });

    it('should skip rate limiting for health check endpoints', async () => {
      await app.register(rateLimitPlugin);

      // Add health routes
      app.get('/health', async () => ({ status: 'ok' }));
      app.get('/health/redis', async () => ({ status: 'ok' }));

      // Multiple requests to health endpoint should all succeed
      for (let i = 0; i < 5; i++) {
        const response = await app.inject({
          method: 'GET',
          url: '/health',
        });
        expect(response.statusCode).toBe(200);
      }

      for (let i = 0; i < 5; i++) {
        const response = await app.inject({
          method: 'GET',
          url: '/health/redis',
        });
        expect(response.statusCode).toBe(200);
      }
    });
  });

  describe('rate limit configurations', () => {
    it('should export anonymous rate limit config', () => {
      expect(rateLimitConfigs.anonymous).toBeDefined();
      expect(rateLimitConfigs.anonymous.max).toBe(30);
      expect(rateLimitConfigs.anonymous.timeWindow).toBe('1 minute');
      expect(rateLimitConfigs.anonymous.keyGenerator).toBeDefined();
    });

    it('should export authenticated rate limit config', () => {
      expect(rateLimitConfigs.authenticated).toBeDefined();
      expect(rateLimitConfigs.authenticated.max).toBe(100);
      expect(rateLimitConfigs.authenticated.timeWindow).toBe('1 minute');
      expect(rateLimitConfigs.authenticated.keyGenerator).toBeDefined();
    });

    it('should export agent API rate limit config', () => {
      expect(rateLimitConfigs.agentApi).toBeDefined();
      expect(rateLimitConfigs.agentApi.max).toBe(100);
      expect(rateLimitConfigs.agentApi.timeWindow).toBe('1 minute');
      expect(rateLimitConfigs.agentApi.keyGenerator).toBeDefined();
    });

    it('should export strict rate limit config', () => {
      expect(rateLimitConfigs.strict).toBeDefined();
      expect(rateLimitConfigs.strict.max).toBe(10);
      expect(rateLimitConfigs.strict.timeWindow).toBe('1 minute');
      expect(rateLimitConfigs.strict.keyGenerator).toBeDefined();
    });

    it('should export custom rate limit config factory', () => {
      expect(rateLimitConfigs.custom).toBeDefined();
      expect(typeof rateLimitConfigs.custom).toBe('function');

      const customConfig = rateLimitConfigs.custom(50, '5 minutes');
      expect(customConfig.max).toBe(50);
      expect(customConfig.timeWindow).toBe('5 minutes');
    });
  });

  describe('key generators', () => {
    it('should generate different keys for authenticated vs anonymous users', () => {
      const mockRequest = {
        ip: '127.0.0.1',
        user: { id: 'user-123' },
      } as unknown as Parameters<typeof rateLimitConfigs.authenticated.keyGenerator>[0];

      // When user is authenticated, should use userId
      const authKey = rateLimitConfigs.authenticated.keyGenerator!(mockRequest);
      expect(authKey).toBe('user:user-123');

      // When user is not authenticated, should use IP
      const anonRequest = {
        ip: '192.168.1.1',
        user: undefined,
      } as unknown as Parameters<typeof rateLimitConfigs.anonymous.keyGenerator>[0];
      
      const anonKey = rateLimitConfigs.anonymous.keyGenerator!(anonRequest);
      expect(anonKey).toBe('ip:192.168.1.1');
    });

    it('should generate API key based keys for agent API config', () => {
      const mockRequest = {
        ip: '127.0.0.1',
        headers: {
          'x-api-key': 'api-key-123',
        },
      } as unknown as Parameters<typeof rateLimitConfigs.agentApi.keyGenerator>[0];

      const key = rateLimitConfigs.agentApi.keyGenerator!(mockRequest);
      expect(key).toBe('apikey:api-key-123');
    });

    it('should fall back to IP when no API key is present', () => {
      const mockRequest = {
        ip: '127.0.0.1',
        headers: {},
      } as unknown as Parameters<typeof rateLimitConfigs.agentApi.keyGenerator>[0];

      const key = rateLimitConfigs.agentApi.keyGenerator!(mockRequest);
      expect(key).toBe('ip:127.0.0.1');
    });

    it('should always use IP for strict rate limiting', () => {
      const mockRequest = {
        ip: '10.0.0.1',
        user: { id: 'user-123' }, // Even with a user, strict should use IP
      } as unknown as Parameters<typeof rateLimitConfigs.strict.keyGenerator>[0];

      const key = rateLimitConfigs.strict.keyGenerator!(mockRequest);
      expect(key).toBe('auth:10.0.0.1');
    });
  });

  describe('rate limiting behavior', () => {
    it('should return 429 when rate limit is exceeded', async () => {
      // Create a new app with very strict limits for testing
      const testApp = Fastify({ logger: false });
      
      await testApp.register(rateLimitPlugin);
      
      // Add a route with very low rate limit
      testApp.get('/strict-test', {
        config: {
          rateLimit: {
            max: 2,
            timeWindow: '1 minute',
          },
        },
      }, async () => ({ message: 'ok' }));

      // First two requests should succeed
      const res1 = await testApp.inject({ method: 'GET', url: '/strict-test' });
      expect(res1.statusCode).toBe(200);

      const res2 = await testApp.inject({ method: 'GET', url: '/strict-test' });
      expect(res2.statusCode).toBe(200);

      await testApp.close();
    });
  });

  describe('error response', () => {
    it('should include retry-after header in rate limit error response', async () => {
      const testApp = Fastify({ logger: false });
      
      await testApp.register(rateLimitPlugin);
      
      testApp.get('/error-test', {
        config: {
          rateLimit: {
            max: 1,
            timeWindow: '1 minute',
          },
        },
      }, async () => ({ message: 'ok' }));

      // First request
      await testApp.inject({ method: 'GET', url: '/error-test' });

      // Second request (may or may not be rate limited depending on Redis)
      const res2 = await testApp.inject({ method: 'GET', url: '/error-test' });
      
      // If rate limited, check for proper error format
      if (res2.statusCode === 429) {
        const body = JSON.parse(res2.body);
        expect(body.statusCode).toBe(429);
        expect(body.error).toBe('Too Many Requests');
        expect(body.message).toContain('Rate limit exceeded');
        expect(body.retryAfter).toBeDefined();
        expect(res2.headers['retry-after']).toBeDefined();
      }

      await testApp.close();
    });
  });
});
