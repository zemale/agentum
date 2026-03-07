import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';
import {
  httpRequestsTotal,
  httpRequestDurationSeconds,
  getMetrics,
  getMetricsContentType,
} from '@/lib/metrics.js';

/**
 * Fastify plugin for Prometheus metrics
 * - Tracks HTTP request count and duration
 * - Exposes /metrics endpoint for Prometheus scraping
 */
const metricsPlugin: FastifyPluginAsync = async (fastify) => {
  // Track HTTP metrics on response
  fastify.addHook('onResponse', async (request, reply) => {
    const method = request.method;
    const route = request.routeOptions?.url || request.url;
    const statusCode = reply.statusCode.toString();

    // Increment request counter
    httpRequestsTotal.inc({ method, route, status_code: statusCode });

    // Record duration in seconds
    const durationInSeconds = reply.elapsedTime / 1000;
    httpRequestDurationSeconds.observe({ method, route, status_code: statusCode }, durationInSeconds);
  });

  // Expose /metrics endpoint (no auth required for scraping)
  fastify.get('/metrics', async (request, reply) => {
    const metrics = await getMetrics();
    reply.header('Content-Type', getMetricsContentType());
    return metrics;
  });
};

export default fp(metricsPlugin, {
  name: 'metrics',
});
