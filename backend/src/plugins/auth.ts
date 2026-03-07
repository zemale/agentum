import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import { verifyAccessToken } from '@/services/auth.js';

/**
 * Extract token from Authorization header
 * Supports: "Bearer <token>" format
 */
function extractTokenFromHeader(authHeader: string | undefined): string | null {
  if (!authHeader) {
    return null;
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
    return null;
  }

  return parts[1];
}

/**
 * Fastify plugin for JWT authentication
 */
export default fp(async function authPlugin(app: FastifyInstance) {
  /**
   * Authenticate middleware - requires valid access token
   * Adds req.user if authentication is successful
   */
  app.decorate(
    'authenticate',
    async function authenticate(request: FastifyRequest, reply: FastifyReply) {
      const token = extractTokenFromHeader(request.headers.authorization);

      if (!token) {
        reply.status(401);
        return reply.send({
          error: 'Unauthorized',
          message: 'Access token is required',
          code: 'MISSING_TOKEN',
        });
      }

      try {
        const payload = verifyAccessToken(token);
        request.user = payload;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Invalid token';
        reply.status(401);
        return reply.send({
          error: 'Unauthorized',
          message,
          code: 'INVALID_TOKEN',
        });
      }
    }
  );

  /**
   * Optional authentication middleware - doesn't fail if no token
   * Still adds req.user if token is valid
   */
  app.decorate(
    'optionalAuth',
    async function optionalAuth(request: FastifyRequest, reply: FastifyReply) {
      const token = extractTokenFromHeader(request.headers.authorization);

      if (!token) {
        // No token provided, continue without user
        return;
      }

      try {
        const payload = verifyAccessToken(token);
        request.user = payload;
      } catch {
        // Invalid token, continue without user (optional auth)
        // Don't throw error for optional auth
      }
    }
  );
});


