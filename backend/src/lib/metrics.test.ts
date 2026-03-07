import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import {
  httpRequestsTotal,
  httpRequestDurationSeconds,
  agentOnlineTotal,
  walletBalanceTotal,
  taskCountByStatus,
  outboxPending,
  getMetrics,
  getMetricsContentType,
  resetMetrics,
} from './metrics.js';
import metricsPlugin from '@/plugins/metrics.js';

describe('Metrics', () => {
  beforeEach(() => {
    resetMetrics();
  });

  describe('Custom Metrics', () => {
    it('should increment http_requests_total counter', async () => {
      httpRequestsTotal.inc({ method: 'GET', route: '/test', status_code: '200' });
      httpRequestsTotal.inc({ method: 'GET', route: '/test', status_code: '200' });
      httpRequestsTotal.inc({ method: 'POST', route: '/api', status_code: '201' });

      const metrics = await getMetrics();
      expect(metrics).toContain('http_requests_total');
      expect(metrics).toContain('method="GET"');
      expect(metrics).toContain('route="/test"');
      expect(metrics).toContain('status_code="200"');
    });

    it('should observe http_request_duration_seconds histogram', async () => {
      httpRequestDurationSeconds.observe(
        { method: 'GET', route: '/test', status_code: '200' },
        0.123
      );

      const metrics = await getMetrics();
      expect(metrics).toContain('http_request_duration_seconds');
      expect(metrics).toContain('method="GET"');
    });

    it('should set agent_online_total gauge', async () => {
      agentOnlineTotal.set(5);

      const metrics = await getMetrics();
      expect(metrics).toContain('agent_online_total');
      expect(metrics).toContain('5');
    });

    it('should set wallet_balance_total gauge', async () => {
      walletBalanceTotal.set(1234.56);

      const metrics = await getMetrics();
      expect(metrics).toContain('wallet_balance_total');
      expect(metrics).toContain('1234.56');
    });

    it('should set task_count_by_status gauge with labels', async () => {
      taskCountByStatus.set({ status: 'pending' }, 10);
      taskCountByStatus.set({ status: 'completed' }, 25);
      taskCountByStatus.set({ status: 'failed' }, 3);

      const metrics = await getMetrics();
      expect(metrics).toContain('task_count_by_status');
      expect(metrics).toContain('status="pending"');
      expect(metrics).toContain('status="completed"');
      expect(metrics).toContain('status="failed"');
    });

    it('should set outbox_pending gauge', async () => {
      outboxPending.set(7);

      const metrics = await getMetrics();
      expect(metrics).toContain('outbox_pending');
      expect(metrics).toContain('7');
    });

    it('should reset all metrics', async () => {
      httpRequestsTotal.inc({ method: 'GET', route: '/test', status_code: '200' });
      agentOnlineTotal.set(10);

      resetMetrics();

      const metrics = await getMetrics();
      // After reset, counters should be 0 (no values yet)
      expect(metrics).toContain('http_requests_total');
      expect(metrics).toContain('agent_online_total');
    });
  });

  describe('Content Type', () => {
    it('should return Prometheus content type', () => {
      const contentType = getMetricsContentType();
      expect(contentType).toBe('text/plain; version=0.0.4; charset=utf-8');
    });
  });
});

describe('Metrics Plugin', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify({
      logger: false,
    });

    // Register metrics plugin
    await app.register(metricsPlugin);

    // Test routes
    app.get('/test-success', async () => {
      return { status: 'ok' };
    });

    app.get('/test-error', async (request, reply) => {
      reply.status(500);
      return { error: 'test error' };
    });

    app.post('/test-post', async () => {
      return { created: true };
    });

    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    resetMetrics();
  });

  describe('/metrics endpoint', () => {
    it('should return Prometheus format', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/metrics',
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toBe(
        'text/plain; version=0.0.4; charset=utf-8'
      );
      
      const body = response.body;
      expect(body).toContain('# HELP');
      expect(body).toContain('# TYPE');
    });

    it('should be accessible without auth', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/metrics',
      });

      expect(response.statusCode).toBe(200);
    });
  });

  describe('HTTP metrics tracking', () => {
    it('should track GET requests', async () => {
      await app.inject({
        method: 'GET',
        url: '/test-success',
      });

      const metrics = await getMetrics();
      expect(metrics).toContain('http_requests_total');
      expect(metrics).toContain('method="GET"');
      expect(metrics).toContain('route="/test-success"');
      expect(metrics).toContain('status_code="200"');
    });

    it('should track POST requests', async () => {
      await app.inject({
        method: 'POST',
        url: '/test-post',
      });

      const metrics = await getMetrics();
      expect(metrics).toContain('method="POST"');
      expect(metrics).toContain('route="/test-post"');
    });

    it('should track error responses', async () => {
      await app.inject({
        method: 'GET',
        url: '/test-error',
      });

      const metrics = await getMetrics();
      expect(metrics).toContain('status_code="500"');
    });

    it('should track request duration', async () => {
      await app.inject({
        method: 'GET',
        url: '/test-success',
      });

      const metrics = await getMetrics();
      expect(metrics).toContain('http_request_duration_seconds');
      expect(metrics).toContain('method="GET"');
    });

    it('should track multiple requests', async () => {
      await app.inject({ method: 'GET', url: '/test-success' });
      await app.inject({ method: 'GET', url: '/test-success' });
      await app.inject({ method: 'POST', url: '/test-post' });

      const response = await app.inject({
        method: 'GET',
        url: '/metrics',
      });

      expect(response.statusCode).toBe(200);
      expect(response.body).toContain('http_requests_total');
    });
  });
});
