import type { FastifyInstance } from 'fastify';
import { prisma } from '@/lib/prisma.js';
import { healthCheck as redisHealthCheck } from '@/lib/redis.js';

const VERSION = '1.0.0';

interface HealthStatus {
  status: 'ok' | 'error';
  latency?: number;
  error?: string;
}

interface DetailedHealthResponse {
  status: 'ok' | 'degraded' | 'error';
  version: string;
  timestamp: string;
  checks: {
    database: HealthStatus;
    redis: HealthStatus;
  };
}

/**
 * Check database health by running SELECT 1
 */
async function checkDatabase(): Promise<HealthStatus> {
  const start = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return {
      status: 'ok',
      latency: Date.now() - start,
    };
  } catch (err) {
    return {
      status: 'error',
      error: err instanceof Error ? err.message : 'Unknown database error',
    };
  }
}

/**
 * Check Redis health by running PING
 */
async function checkRedis(): Promise<HealthStatus> {
  const result = await redisHealthCheck();
  return {
    status: result.status,
    latency: result.latency,
    error: result.message,
  };
}

/**
 * Register health check routes
 */
export default async function healthRoutes(app: FastifyInstance) {
  // Basic health check
  app.get('/health', async () => {
    return {
      status: 'ok',
      version: VERSION,
      timestamp: new Date().toISOString(),
    };
  });

  // Database health check
  app.get('/health/db', async (request, reply) => {
    const result = await checkDatabase();

    if (result.status === 'ok') {
      return {
        status: 'ok',
        latency: result.latency,
        timestamp: new Date().toISOString(),
      };
    } else {
      reply.status(503);
      return {
        status: 'error',
        error: result.error,
        timestamp: new Date().toISOString(),
      };
    }
  });

  // Redis health check
  app.get('/health/redis', async (request, reply) => {
    const result = await checkRedis();

    if (result.status === 'ok') {
      return {
        status: 'ok',
        latency: result.latency,
        timestamp: new Date().toISOString(),
      };
    } else {
      reply.status(503);
      return {
        status: 'error',
        error: result.error,
        timestamp: new Date().toISOString(),
      };
    }
  });

  // Detailed health check - all services
  app.get('/health/detailed', async (request, reply) => {
    const [dbResult, redisResult] = await Promise.all([
      checkDatabase(),
      checkRedis(),
    ]);

    const allOk = dbResult.status === 'ok' && redisResult.status === 'ok';
    const anyError = dbResult.status === 'error' || redisResult.status === 'error';

    const overallStatus: DetailedHealthResponse['status'] = allOk
      ? 'ok'
      : anyError
        ? 'error'
        : 'degraded';

    const response: DetailedHealthResponse = {
      status: overallStatus,
      version: VERSION,
      timestamp: new Date().toISOString(),
      checks: {
        database: dbResult,
        redis: redisResult,
      },
    };

    if (overallStatus === 'error') {
      reply.status(503);
    }

    return response;
  });
}
