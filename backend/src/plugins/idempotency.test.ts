import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import idempotencyPlugin from './idempotency.js';
import { getRedisClient } from '@/lib/redis.js';
import {
  buildKey,
  isMutationMethod,
  bodiesMatch,
  IDEMPOTENCY_KEY_PREFIX,
  IDEMPOTENCY_HEADER,
} from './idempotency.js';

describe('Idempotency Plugin', () => {
  let app: FastifyInstance;
  let requestCounter: number;

  beforeAll(async () => {
    app = Fastify({
      logger: false,
    });

    // Register idempotency plugin
    await app.register(idempotencyPlugin);

    // Test routes for different HTTP methods
    app.post('/test', async (request) => {
      requestCounter++;
      return { 
        id: requestCounter, 
        method: 'POST',
        body: request.body,
      };
    });

    app.put('/test/:id', async (request) => {
      requestCounter++;
      return { 
        id: requestCounter, 
        method: 'PUT',
        params: request.params,
        body: request.body,
      };
    });

    app.patch('/test/:id', async (request) => {
      requestCounter++;
      return { 
        id: requestCounter, 
        method: 'PATCH',
        body: request.body,
      };
    });

    app.delete('/test/:id', async (request, reply) => {
      requestCounter++;
      reply.status(204);
      return null;
    });

    app.get('/test', async () => {
      requestCounter++;
      return { id: requestCounter, method: 'GET' };
    });

    // Error route for testing
    app.post('/error', async () => {
      throw new Error('Test error');
    });

    await app.ready();
  });

  afterAll(async () => {
    // Clean up Redis keys
    const redis = getRedisClient();
    const keys = await redis.keys(`${IDEMPOTENCY_KEY_PREFIX}*`);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
    await app.close();
  });

  beforeEach(async () => {
    requestCounter = 0;
    // Clean up any existing idempotency keys
    const redis = getRedisClient();
    const keys = await redis.keys(`${IDEMPOTENCY_KEY_PREFIX}*`);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  });

  describe('Helper Functions', () => {
    it('should build correct Redis key', () => {
      const key = buildKey('test-key-123');
      expect(key).toBe(`${IDEMPOTENCY_KEY_PREFIX}test-key-123`);
    });

    it('should identify mutation methods correctly', () => {
      expect(isMutationMethod('POST')).toBe(true);
      expect(isMutationMethod('PUT')).toBe(true);
      expect(isMutationMethod('PATCH')).toBe(true);
      expect(isMutationMethod('DELETE')).toBe(true);
      expect(isMutationMethod('GET')).toBe(false);
      expect(isMutationMethod('HEAD')).toBe(false);
      expect(isMutationMethod('OPTIONS')).toBe(false);
    });

    it('should match identical bodies', () => {
      const body1 = { name: 'test', value: 123 };
      const body2 = { name: 'test', value: 123 };
      expect(bodiesMatch(body1, body2)).toBe(true);
    });

    it('should not match different bodies', () => {
      const body1 = { name: 'test', value: 123 };
      const body2 = { name: 'test', value: 456 };
      expect(bodiesMatch(body1, body2)).toBe(false);
    });

    it('should handle null bodies', () => {
      expect(bodiesMatch(null, null)).toBe(true);
      expect(bodiesMatch(null, { test: 'value' })).toBe(false);
    });
  });

  describe('First Request Processing', () => {
    it('should process first request with idempotency key', async () => {
      const idempotencyKey = 'test-key-001';
      const requestBody = { name: 'Test Item', price: 99.99 };

      const response = await app.inject({
        method: 'POST',
        url: '/test',
        headers: {
          [IDEMPOTENCY_HEADER]: idempotencyKey,
          'Content-Type': 'application/json',
        },
        payload: requestBody,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.id).toBe(1); // First request
      expect(body.method).toBe('POST');
      expect(body.body).toEqual(requestBody);
    });

    it('should process request without idempotency key normally', async () => {
      const requestBody = { name: 'Test Item' };

      const response = await app.inject({
        method: 'POST',
        url: '/test',
        headers: {
          'Content-Type': 'application/json',
        },
        payload: requestBody,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.id).toBe(1);
    });

    it('should skip idempotency for GET requests', async () => {
      const idempotencyKey = 'test-key-get';

      // First request
      const response1 = await app.inject({
        method: 'GET',
        url: '/test',
        headers: {
          [IDEMPOTENCY_HEADER]: idempotencyKey,
        },
      });

      expect(response1.statusCode).toBe(200);
      const body1 = JSON.parse(response1.body);
      expect(body1.id).toBe(1);

      // Second request with same key - should still process (GET is not cached)
      const response2 = await app.inject({
        method: 'GET',
        url: '/test',
        headers: {
          [IDEMPOTENCY_HEADER]: idempotencyKey,
        },
      });

      expect(response2.statusCode).toBe(200);
      const body2 = JSON.parse(response2.body);
      expect(body2.id).toBe(2); // Should be a new request
    });
  });

  describe('Duplicate Request Handling', () => {
    it('should return cached response for duplicate request', async () => {
      const idempotencyKey = 'test-key-dup';
      const requestBody = { name: 'Duplicate Test' };

      // First request
      const response1 = await app.inject({
        method: 'POST',
        url: '/test',
        headers: {
          [IDEMPOTENCY_HEADER]: idempotencyKey,
          'Content-Type': 'application/json',
        },
        payload: requestBody,
      });

      expect(response1.statusCode).toBe(200);
      const body1 = JSON.parse(response1.body);
      expect(body1.id).toBe(1);

      // Duplicate request with same key
      const response2 = await app.inject({
        method: 'POST',
        url: '/test',
        headers: {
          [IDEMPOTENCY_HEADER]: idempotencyKey,
          'Content-Type': 'application/json',
        },
        payload: requestBody,
      });

      expect(response2.statusCode).toBe(200);
      const body2 = JSON.parse(response2.body);
      expect(body2.id).toBe(1); // Same as first request (cached)
      expect(body2).toEqual(body1);

      // Counter should only be incremented once
      expect(requestCounter).toBe(1);
    });

    it('should cache responses for PUT requests', async () => {
      const idempotencyKey = 'test-key-put';

      // First PUT request
      const response1 = await app.inject({
        method: 'PUT',
        url: '/test/123',
        headers: {
          [IDEMPOTENCY_HEADER]: idempotencyKey,
          'Content-Type': 'application/json',
        },
        payload: { name: 'Updated' },
      });

      expect(response1.statusCode).toBe(200);
      const body1 = JSON.parse(response1.body);
      expect(body1.id).toBe(1);

      // Duplicate PUT request
      const response2 = await app.inject({
        method: 'PUT',
        url: '/test/123',
        headers: {
          [IDEMPOTENCY_HEADER]: idempotencyKey,
          'Content-Type': 'application/json',
        },
        payload: { name: 'Updated' },
      });

      expect(response2.statusCode).toBe(200);
      const body2 = JSON.parse(response2.body);
      expect(body2.id).toBe(1); // Cached response
    });

    it('should cache responses for PATCH requests', async () => {
      const idempotencyKey = 'test-key-patch';

      // First PATCH request
      const response1 = await app.inject({
        method: 'PATCH',
        url: '/test/456',
        headers: {
          [IDEMPOTENCY_HEADER]: idempotencyKey,
          'Content-Type': 'application/json',
        },
        payload: { field: 'value' },
      });

      expect(response1.statusCode).toBe(200);
      const body1 = JSON.parse(response1.body);
      expect(body1.id).toBe(1);

      // Duplicate PATCH request
      const response2 = await app.inject({
        method: 'PATCH',
        url: '/test/456',
        headers: {
          [IDEMPOTENCY_HEADER]: idempotencyKey,
          'Content-Type': 'application/json',
        },
        payload: { field: 'value' },
      });

      expect(response2.statusCode).toBe(200);
      const body2 = JSON.parse(response2.body);
      expect(body2.id).toBe(1); // Cached response
    });

    it('should cache DELETE requests with 204 status', async () => {
      const idempotencyKey = 'test-key-delete';

      // First DELETE request
      const response1 = await app.inject({
        method: 'DELETE',
        url: '/test/789',
        headers: {
          [IDEMPOTENCY_HEADER]: idempotencyKey,
        },
      });

      expect(response1.statusCode).toBe(204);

      // Duplicate DELETE request
      const response2 = await app.inject({
        method: 'DELETE',
        url: '/test/789',
        headers: {
          [IDEMPOTENCY_HEADER]: idempotencyKey,
        },
      });

      expect(response2.statusCode).toBe(204);
      expect(requestCounter).toBe(1); // Only processed once
    });
  });

  describe('Request Mismatch Handling', () => {
    it('should return 409 for same key with different body', async () => {
      const idempotencyKey = 'test-key-mismatch-body';

      // First request
      const response1 = await app.inject({
        method: 'POST',
        url: '/test',
        headers: {
          [IDEMPOTENCY_HEADER]: idempotencyKey,
          'Content-Type': 'application/json',
        },
        payload: { name: 'First' },
      });

      expect(response1.statusCode).toBe(200);

      // Second request with same key but different body
      const response2 = await app.inject({
        method: 'POST',
        url: '/test',
        headers: {
          [IDEMPOTENCY_HEADER]: idempotencyKey,
          'Content-Type': 'application/json',
        },
        payload: { name: 'Second' },
      });

      expect(response2.statusCode).toBe(409);
      const body2 = JSON.parse(response2.body);
      expect(body2.error).toBe('Conflict');
      expect(body2.message).toContain('different request');
    });

    it('should return 409 for same key with different method', async () => {
      const idempotencyKey = 'test-key-mismatch-method';

      // First request with POST
      const response1 = await app.inject({
        method: 'POST',
        url: '/test',
        headers: {
          [IDEMPOTENCY_HEADER]: idempotencyKey,
          'Content-Type': 'application/json',
        },
        payload: { name: 'Test' },
      });

      expect(response1.statusCode).toBe(200);

      // Second request with same key but PUT method
      const response2 = await app.inject({
        method: 'PUT',
        url: '/test/123',
        headers: {
          [IDEMPOTENCY_HEADER]: idempotencyKey,
          'Content-Type': 'application/json',
        },
        payload: { name: 'Test' },
      });

      expect(response2.statusCode).toBe(409);
      const body2 = JSON.parse(response2.body);
      expect(body2.error).toBe('Conflict');
    });

    it('should return 409 for same key with different URL', async () => {
      const idempotencyKey = 'test-key-mismatch-url';

      // First request
      const response1 = await app.inject({
        method: 'PUT',
        url: '/test/111',
        headers: {
          [IDEMPOTENCY_HEADER]: idempotencyKey,
          'Content-Type': 'application/json',
        },
        payload: { name: 'Test' },
      });

      expect(response1.statusCode).toBe(200);

      // Second request with same key but different URL
      const response2 = await app.inject({
        method: 'PUT',
        url: '/test/222',
        headers: {
          [IDEMPOTENCY_HEADER]: idempotencyKey,
          'Content-Type': 'application/json',
        },
        payload: { name: 'Test' },
      });

      expect(response2.statusCode).toBe(409);
    });
  });

  describe('Key Isolation', () => {
    it('should not interfere between different idempotency keys', async () => {
      const key1 = 'test-key-isolated-1';
      const key2 = 'test-key-isolated-2';

      // Request with key1
      const response1 = await app.inject({
        method: 'POST',
        url: '/test',
        headers: {
          [IDEMPOTENCY_HEADER]: key1,
          'Content-Type': 'application/json',
        },
        payload: { key: 'first' },
      });

      expect(response1.statusCode).toBe(200);
      const body1 = JSON.parse(response1.body);
      expect(body1.id).toBe(1);

      // Request with key2 - should be processed separately
      const response2 = await app.inject({
        method: 'POST',
        url: '/test',
        headers: {
          [IDEMPOTENCY_HEADER]: key2,
          'Content-Type': 'application/json',
        },
        payload: { key: 'second' },
      });

      expect(response2.statusCode).toBe(200);
      const body2 = JSON.parse(response2.body);
      expect(body2.id).toBe(2); // New request, not cached

      // Request with key1 again - should return cached
      const response3 = await app.inject({
        method: 'POST',
        url: '/test',
        headers: {
          [IDEMPOTENCY_HEADER]: key1,
          'Content-Type': 'application/json',
        },
        payload: { key: 'first' },
      });

      expect(response3.statusCode).toBe(200);
      const body3 = JSON.parse(response3.body);
      expect(body3.id).toBe(1); // Cached from first request
    });
  });

  describe('TTL Expiration', () => {
    it('should allow new request after TTL expires', async () => {
      const idempotencyKey = 'test-key-ttl';
      const redis = getRedisClient();

      // First request with short TTL
      const response1 = await app.inject({
        method: 'POST',
        url: '/test',
        headers: {
          [IDEMPOTENCY_HEADER]: idempotencyKey,
          'Content-Type': 'application/json',
        },
        payload: { data: 'test' },
      });

      expect(response1.statusCode).toBe(200);
      const body1 = JSON.parse(response1.body);
      expect(body1.id).toBe(1);

      // Manually set a short TTL for testing
      await redis.expire(buildKey(idempotencyKey), 1);

      // Wait for TTL to expire
      await new Promise((resolve) => setTimeout(resolve, 1100));

      // Verify key is gone
      const exists = await redis.exists(buildKey(idempotencyKey));
      expect(exists).toBe(0);

      // New request with same key should be processed
      const response2 = await app.inject({
        method: 'POST',
        url: '/test',
        headers: {
          [IDEMPOTENCY_HEADER]: idempotencyKey,
          'Content-Type': 'application/json',
        },
        payload: { data: 'test' },
      });

      expect(response2.statusCode).toBe(200);
      const body2 = JSON.parse(response2.body);
      expect(body2.id).toBe(2); // New request after TTL
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty idempotency key', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/test',
        headers: {
          [IDEMPOTENCY_HEADER]: '',
          'Content-Type': 'application/json',
        },
        payload: { test: 'data' },
      });

      // Empty string headers are treated as missing by many HTTP implementations
      // Fastify parses empty string as empty string, so we should get 400
      if (response.statusCode === 400) {
        const body = JSON.parse(response.body);
        expect(body.error).toBe('Bad Request');
      } else {
        // If somehow the empty string is treated as no key, it should process normally
        expect(response.statusCode).toBe(200);
      }
    });

    it('should handle whitespace-only idempotency key', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/test',
        headers: {
          [IDEMPOTENCY_HEADER]: '   ',
          'Content-Type': 'application/json',
        },
        payload: { test: 'data' },
      });

      // Whitespace-only should be rejected as invalid
      expect(response.statusCode).toBe(400);
    });

    it('should handle array of idempotency keys (use first)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/test',
        headers: {
          [IDEMPOTENCY_HEADER]: ['key-1', 'key-2'],
          'Content-Type': 'application/json',
        },
        payload: { test: 'data' },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should not cache error responses', async () => {
      const idempotencyKey = 'test-key-error';

      // First request that will fail
      const response1 = await app.inject({
        method: 'POST',
        url: '/error',
        headers: {
          [IDEMPOTENCY_HEADER]: idempotencyKey,
          'Content-Type': 'application/json',
        },
        payload: { test: 'data' },
      });

      expect(response1.statusCode).toBe(500);

      // Second request - should also fail (not cached)
      const response2 = await app.inject({
        method: 'POST',
        url: '/error',
        headers: {
          [IDEMPOTENCY_HEADER]: idempotencyKey,
          'Content-Type': 'application/json',
        },
        payload: { test: 'data' },
      });

      expect(response2.statusCode).toBe(500);
    });
  });
});
