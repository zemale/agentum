import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { env } from '@/config/env.js';

// Models that support soft delete (have deletedAt field)
const softDeleteModels = new Set(['user', 'agent', 'service', 'task']);

// Create PostgreSQL connection pool
const pool = new Pool({ connectionString: env.DATABASE_URL });

/**
 * Creates a Prisma Client with soft delete extension
 * The extension:
 * 1. Overrides findUnique/findFirst/findMany to filter deletedAt: null
 * 2. Overrides delete to set deletedAt instead of actual delete
 */
const prismaClientSingleton = () => {
  const adapter = new PrismaPg(pool);
  const client = new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' 
      ? ['query', 'error', 'warn'] 
      : ['error'],
  });

  // Create soft delete extension using Prisma Client Extensions
  const softDeleteExtension = client.$extends({
    query: {
      $allModels: {
        async findUnique({ model, operation, args, query }) {
          const modelName = model.toLowerCase();
          if (!softDeleteModels.has(modelName)) {
            return query(args);
          }

          // Add deletedAt: null filter
          const argsWithFilter = {
            ...args,
            where: {
              ...args.where,
              deletedAt: null,
            },
          };

          return query(argsWithFilter as typeof args);
        },
        async findFirst({ model, operation, args, query }) {
          const modelName = model.toLowerCase();
          if (!softDeleteModels.has(modelName)) {
            return query(args);
          }

          const argsWithFilter = {
            ...args,
            where: {
              ...args.where,
              deletedAt: null,
            },
          };

          return query(argsWithFilter as typeof args);
        },
        async findMany({ model, operation, args, query }) {
          const modelName = model.toLowerCase();
          if (!softDeleteModels.has(modelName)) {
            return query(args);
          }

          const argsWithFilter = {
            ...args,
            where: {
              ...args.where,
              deletedAt: null,
            },
          };

          return query(argsWithFilter as typeof args);
        },
        async count({ model, operation, args, query }) {
          const modelName = model.toLowerCase();
          if (!softDeleteModels.has(modelName)) {
            return query(args);
          }

          const argsWithFilter = {
            ...args,
            where: {
              ...args.where,
              deletedAt: null,
            },
          };

          return query(argsWithFilter as typeof args);
        },
        async delete({ model, operation, args, query }) {
          const modelName = model.toLowerCase();
          if (!softDeleteModels.has(modelName)) {
            return query(args);
          }

          // Convert delete to update with deletedAt
          const modelClient = (client as unknown as Record<string, { update: (args: { where: unknown; data: { deletedAt: Date } }) => Promise<unknown> }>)[model];

          return modelClient.update({
            where: args.where,
            data: { deletedAt: new Date() },
          });
        },
        async deleteMany({ model, operation, args, query }) {
          const modelName = model.toLowerCase();
          if (!softDeleteModels.has(modelName)) {
            return query(args);
          }

          // Convert deleteMany to updateMany with deletedAt
          const modelClient = (client as unknown as Record<string, { updateMany: (args: { where: unknown; data: { deletedAt: Date } }) => Promise<unknown> }>)[model];

          return modelClient.updateMany({
            where: args.where || {},
            data: { deletedAt: new Date() },
          });
        },
      },
    },
  });

  return softDeleteExtension;
};

type PrismaClientSingleton = ReturnType<typeof prismaClientSingleton>;

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClientSingleton | undefined;
};

export const prisma = globalForPrisma.prisma ?? prismaClientSingleton();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;
