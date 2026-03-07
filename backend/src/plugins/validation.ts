/**
 * Fastify Validation Plugin
 * 
 * This plugin provides request validation using shared Zod schemas.
 * It uses fastify-zod for integration with Fastify's request lifecycle.
 */

import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import type { ZodSchema } from 'zod';
import { z } from 'zod';
import {
  RegisterSchema,
  LoginSchema,
  RefreshTokenSchema,
  UpdateUserSchema,
  CreateAgentSchema,
  UpdateAgentSchema,
  CreateTaskSchema,
  UpdateTaskSchema,
  CreateProgressSchema,
  CreateServiceSchema,
  PaginationSchema,
  IdSchema,
} from '@agentum/shared';

// Extend Fastify types to include validated data
declare module 'fastify' {
  interface FastifyRequest {
    validatedBody?: unknown;
    validatedParams?: unknown;
    validatedQuery?: unknown;
  }
}

// Schema definition for route validation
export interface RouteValidationSchema {
  body?: ZodSchema;
  params?: ZodSchema;
  querystring?: ZodSchema;
  response?: Record<number, ZodSchema>;
}

/**
 * Create a validation preHandler for a route
 */
function createValidationHandler(schema: RouteValidationSchema) {
  return async (request: any, reply: any) => {
    // Validate body
    if (schema.body) {
      const result = schema.body.safeParse(request.body);
      if (!result.success) {
        return reply.status(400).send({
          success: false,
          error: 'Validation failed',
          details: result.error.errors.map((e) => ({
            path: e.path.join('.'),
            message: e.message,
          })),
        });
      }
      request.validatedBody = result.data;
    }

    // Validate params
    if (schema.params) {
      const result = schema.params.safeParse(request.params);
      if (!result.success) {
        return reply.status(400).send({
          success: false,
          error: 'Invalid URL parameters',
          details: result.error.errors.map((e) => ({
            path: e.path.join('.'),
            message: e.message,
          })),
        });
      }
      request.validatedParams = result.data;
    }

    // Validate query string
    if (schema.querystring) {
      const result = schema.querystring.safeParse(request.query);
      if (!result.success) {
        return reply.status(400).send({
          success: false,
          error: 'Invalid query parameters',
          details: result.error.errors.map((e) => ({
            path: e.path.join('.'),
            message: e.message,
          })),
        });
      }
      request.validatedQuery = result.data;
    }
  };
}

/**
 * Validation plugin for Fastify
 */
const validationPlugin: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // Decorate fastify with validation utilities
  fastify.decorate('validate', createValidationHandler);

  // Add hook to handle validation errors gracefully
  fastify.setErrorHandler((error, request, reply) => {
    if (error.validation) {
      return reply.status(400).send({
        success: false,
        error: 'Validation failed',
        details: error.validation,
      });
    }

    // Log unexpected errors
    fastify.log.error(error);
    return reply.status(500).send({
      success: false,
      error: 'Internal server error',
    });
  });
};

export default fp(validationPlugin, {
  name: 'validation',
});

// ============================================
// Predefined validation schemas for routes
// ============================================

export const AuthValidation = {
  register: {
    body: RegisterSchema,
  } satisfies RouteValidationSchema,

  login: {
    body: LoginSchema,
  } satisfies RouteValidationSchema,

  refresh: {
    body: RefreshTokenSchema,
  } satisfies RouteValidationSchema,
};

export const UserValidation = {
  update: {
    body: UpdateUserSchema,
  } satisfies RouteValidationSchema,

  getById: {
    params: z.object({ id: IdSchema }),
  } satisfies RouteValidationSchema,
};

export const AgentValidation = {
  create: {
    body: CreateAgentSchema,
  } satisfies RouteValidationSchema,

  update: {
    params: z.object({ id: IdSchema }),
    body: UpdateAgentSchema,
  } satisfies RouteValidationSchema,

  getById: {
    params: z.object({ id: IdSchema }),
  } satisfies RouteValidationSchema,

  list: {
    querystring: PaginationSchema,
  } satisfies RouteValidationSchema,

  createService: {
    params: z.object({ agentId: IdSchema }),
    body: CreateServiceSchema,
  } satisfies RouteValidationSchema,
};

export const TaskValidation = {
  create: {
    body: CreateTaskSchema,
  } satisfies RouteValidationSchema,

  update: {
    params: z.object({ id: IdSchema }),
    body: UpdateTaskSchema,
  } satisfies RouteValidationSchema,

  getById: {
    params: z.object({ id: IdSchema }),
  } satisfies RouteValidationSchema,

  list: {
    querystring: PaginationSchema,
  } satisfies RouteValidationSchema,

  createProgress: {
    params: z.object({ taskId: IdSchema }),
    body: CreateProgressSchema,
  } satisfies RouteValidationSchema,
};

// ============================================
// Helper to apply validation to routes
// ============================================

/**
 * Create route options with validation
 * Usage:
 * 
 * ```typescript
 * fastify.post('/auth/register', 
 *   withValidation(AuthValidation.register),
 *   async (request, reply) => {
 *     // request.body is validated as RegisterInput
 *     const data = request.body;
 *   }
 * );
 * ```
 */
export function withValidation(schema: RouteValidationSchema) {
  return {
    preHandler: createValidationHandler(schema),
    // Schema for fastify's built-in validation (if using fastify-zod)
    schema: {
      body: schema.body,
      params: schema.params,
      querystring: schema.querystring,
      response: schema.response,
    },
  };
}

/**
 * Validation decorator for route handlers
 * Usage:
 * 
 * ```typescript
 * fastify.post('/auth/register', 
 *   { preHandler: validateRequest(AuthValidation.register) },
 *   async (request, reply) => {
 *     // request.validatedBody is available
 *     const data = request.validatedBody;
 *   }
 * );
 * ```
 */
export function validateRequest(schema: RouteValidationSchema) {
  return createValidationHandler(schema);
}
