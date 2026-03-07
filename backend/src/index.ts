import './types/fastify.d.js';

// Import and initialize Sentry FIRST (before any other imports)
import { initSentry, Sentry } from '@/lib/sentry.js';
initSentry();

import Fastify from 'fastify';
import cors from '@fastify/cors';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { env } from '@/config/env.js';
import { logger } from '@/lib/logger.js';
import { connectRedis, disconnectRedis } from '@/lib/redis.js';
import loggingPlugin from '@/plugins/logging.js';
import idempotencyPlugin from '@/plugins/idempotency.js';
import errorHandlerPlugin from '@/plugins/error-handler.js';
import rateLimitPlugin from '@/plugins/rate-limits.js';
import authPlugin from '@/plugins/auth.js';
import agentAuthPlugin from '@/plugins/agent-auth.js';

// Import event system
import { startOutboxWorker, stopOutboxWorker } from '@/workers/outbox-worker.js';
import { registerDefaultHandlers } from '@/handlers/registry.js';
import { initSSEManager } from '@/lib/sse.js';

// Import routes
import healthRoutes from '@/routes/health.js';
import authRoutes from '@/routes/auth.js';
import agentRoutes from '@/routes/agents.js';
import serviceRoutes from '@/routes/services.js';
import walletRoutes from '@/routes/wallet.js';
import taskRoutes from '@/routes/tasks.js';
import eventRoutes from '@/routes/events.js';

const app = Fastify({
  logger,
});

// Setup Sentry request handler at the very start (must be first)
// Setup Sentry error handler (must be registered early)
Sentry.setupFastifyErrorHandler(app);

// Register logging plugin BEFORE routes to capture all requests
await app.register(loggingPlugin);

// Register idempotency plugin for mutation routes
await app.register(idempotencyPlugin);

// Register custom error handler plugin
await app.register(errorHandlerPlugin);

// Register rate limit plugin with Redis for distributed rate limiting
await app.register(rateLimitPlugin);

// Register authentication plugin
await app.register(authPlugin);

// Register agent authentication plugin
await app.register(agentAuthPlugin);

// Register other plugins
await app.register(cors, {
  origin: true,
  credentials: true,
});

// Swagger/OpenAPI setup
await app.register(swagger, {
  openapi: {
    info: {
      title: 'Agentum API',
      description: 'Fastify backend API for Agentum',
      version: '1.0.0',
    },
    servers: [
      {
        url: `http://localhost:${env.PORT}`,
        description: 'Development server',
      },
    ],
  },
});

await app.register(swaggerUi, {
  routePrefix: '/documentation',
  uiConfig: {
    docExpansion: 'list',
    deepLinking: false,
  },
});

// Register routes
await app.register(healthRoutes);
await app.register(authRoutes);
await app.register(agentRoutes);
await app.register(serviceRoutes);
await app.register(taskRoutes, { prefix: '/tasks' });
await app.register(eventRoutes, { prefix: '/events' });

// Note: Sentry error handling is set up above with setupFastifyErrorHandler
// The custom errorHandlerPlugin provides additional error context and formatting

// Graceful shutdown handling
const closeGracefully = async (signal: string) => {
  app.log.info(`Received signal ${signal}, closing server gracefully...`);

  // Stop outbox worker
  await stopOutboxWorker();

  // Flush Sentry events before shutting down
  await Sentry.flush(2000);

  // Disconnect from Redis
  await disconnectRedis();

  await app.close();
  process.exit(0);
};

process.on('SIGTERM', () => closeGracefully('SIGTERM'));
process.on('SIGINT', () => closeGracefully('SIGINT'));

// Start server
const start = async () => {
  try {
    // Connect to Redis on startup
    await connectRedis();

    // Initialize SSE manager
    await initSSEManager();

    // Register default event handlers
    await registerDefaultHandlers();

    // Start outbox worker for event processing
    await startOutboxWorker();

    await app.listen({ port: env.PORT, host: '0.0.0.0' });
    app.log.info(`Server running on http://localhost:${env.PORT}`);
    app.log.info(`Documentation available at http://localhost:${env.PORT}/documentation`);
  } catch (err) {
    app.log.error(err);
    Sentry.captureException(err as Error);
    process.exit(1);
  }
};

start();

export { app };
