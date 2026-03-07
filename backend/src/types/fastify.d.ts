import 'fastify';
import type { TokenPayload } from '@/services/auth.js';

declare module 'fastify' {
  interface FastifyRequest {
    /**
     * Unique trace ID for request tracing
     * - Extracted from X-Trace-ID header if present
     * - Generated automatically if not provided
     */
    trace_id: string;

    /**
     * Authenticated user payload from JWT token
     * Available when using authenticate decorator
     */
    user?: TokenPayload;
  }

  interface FastifyInstance {
    /**
     * Authenticate decorator - requires valid JWT token
     * Usage: route options: { preHandler: [app.authenticate] }
     */
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;

    /**
     * Optional authentication decorator - doesn't fail if no token
     * Usage: route options: { preHandler: [app.optionalAuth] }
     */
    optionalAuth: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}
