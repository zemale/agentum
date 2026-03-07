import type { FastifyInstance } from 'fastify';
import { RegisterSchema, LoginSchema, RefreshTokenSchema } from '@agentum/shared';
import { prisma } from '@/lib/prisma.js';
import {
  hashPassword,
  verifyPassword,
  generateTokens,
  revokeRefreshToken,
  revokeAllUserRefreshTokens,
  validateRefreshToken,
} from '@/services/auth.js';

/**
 * Register authentication routes
 */
export default async function authRoutes(app: FastifyInstance) {
  /**
   * POST /auth/register
   * Register a new user
   */
  app.post(
    '/auth/register',
    {
      schema: {
        body: {
          type: 'object',
          required: ['email', 'password', 'name'],
          properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string', minLength: 8 },
            name: { type: 'string', minLength: 2 },
          },
        },
        response: {
          201: {
            type: 'object',
            properties: {
              user: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  email: { type: 'string' },
                  name: { type: 'string' },
                  balance: { type: 'number' },
                  frozen: { type: 'number' },
                },
              },
              accessToken: { type: 'string' },
              refreshToken: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const body = RegisterSchema.parse(request.body);

      // Check if user already exists
      const existingUser = await prisma.user.findUnique({
        where: { email: body.email },
      });

      if (existingUser) {
        reply.status(409);
        return {
          error: 'Conflict',
          message: 'User with this email already exists',
          code: 'USER_EXISTS',
        };
      }

      // Hash password
      const hashedPassword = await hashPassword(body.password);

      // Create user with default 1000 balance
      const user = await prisma.user.create({
        data: {
          email: body.email,
          password: hashedPassword,
          name: body.name,
          balance: 1000,
          frozen: 0,
        },
      });

      // Generate tokens
      const { accessToken, refreshToken } = generateTokens(user.id, user.email);

      reply.status(201);
      return {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          balance: user.balance,
          frozen: user.frozen,
        },
        accessToken,
        refreshToken,
      };
    }
  );

  /**
   * POST /auth/login
   * Login with email and password
   */
  app.post(
    '/auth/login',
    {
      schema: {
        body: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              user: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  email: { type: 'string' },
                  name: { type: 'string' },
                  balance: { type: 'number' },
                  frozen: { type: 'number' },
                },
              },
              accessToken: { type: 'string' },
              refreshToken: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const body = LoginSchema.parse(request.body);

      // Find user by email
      const user = await prisma.user.findUnique({
        where: { email: body.email },
      });

      if (!user) {
        reply.status(401);
        return {
          error: 'Unauthorized',
          message: 'Invalid email or password',
          code: 'INVALID_CREDENTIALS',
        };
      }

      // Verify password
      const isValidPassword = await verifyPassword(body.password, user.password);

      if (!isValidPassword) {
        reply.status(401);
        return {
          error: 'Unauthorized',
          message: 'Invalid email or password',
          code: 'INVALID_CREDENTIALS',
        };
      }

      // Generate tokens
      const { accessToken, refreshToken } = generateTokens(user.id, user.email);

      return {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          balance: user.balance,
          frozen: user.frozen,
        },
        accessToken,
        refreshToken,
      };
    }
  );

  /**
   * POST /auth/refresh
   * Refresh access token using refresh token
   */
  app.post(
    '/auth/refresh',
    {
      schema: {
        body: {
          type: 'object',
          required: ['refreshToken'],
          properties: {
            refreshToken: { type: 'string' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              accessToken: { type: 'string' },
              refreshToken: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { refreshToken: oldRefreshToken } = RefreshTokenSchema.parse(request.body);

      // Validate refresh token from database
      const userId = await validateRefreshToken(oldRefreshToken);

      if (!userId) {
        reply.status(401);
        return {
          error: 'Unauthorized',
          message: 'Invalid or expired refresh token',
          code: 'INVALID_REFRESH_TOKEN',
        };
      }

      // Get user
      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        reply.status(401);
        return {
          error: 'Unauthorized',
          message: 'User not found',
          code: 'USER_NOT_FOUND',
        };
      }

      // Revoke old refresh token (token rotation)
      await revokeRefreshToken(oldRefreshToken);

      // Generate new tokens
      const { accessToken, refreshToken: newRefreshToken } = generateTokens(user.id, user.email);

      return {
        accessToken,
        refreshToken: newRefreshToken,
      };
    }
  );

  /**
   * POST /auth/logout
   * Logout - revoke refresh token
   */
  app.post(
    '/auth/logout',
    {
      schema: {
        body: {
          type: 'object',
          properties: {
            refreshToken: { type: 'string' },
            allDevices: { type: 'boolean' },
          },
        },
      },
    },
    async (request, reply) => {
      const body = request.body as { refreshToken?: string; allDevices?: boolean };

      // If allDevices is true, revoke all tokens for the user
      if (body.allDevices && request.user?.userId) {
        await revokeAllUserRefreshTokens(request.user.userId);
        return { success: true };
      }

      // Revoke specific token if provided
      if (body.refreshToken) {
        await revokeRefreshToken(body.refreshToken);
      }

      return { success: true };
    }
  );

  /**
   * GET /auth/me
   * Get current user info (protected route)
   */
  app.get(
    '/auth/me',
    {
      preHandler: [app.authenticate],
      schema: {
        response: {
          200: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              email: { type: 'string' },
              name: { type: 'string' },
              balance: { type: 'number' },
              frozen: { type: 'number' },
              createdAt: { type: 'string' },
            },
          },
        },
      },
    },
    async (request) => {
      const user = await prisma.user.findUnique({
        where: { id: request.user!.userId },
      });

      return {
        id: user!.id,
        email: user!.email,
        name: user!.name,
        balance: user!.balance,
        frozen: user!.frozen,
        createdAt: user!.createdAt.toISOString(),
      };
    }
  );
}
