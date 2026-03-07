import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';

// Models that support soft delete (have deletedAt field)
const softDeleteModels = new Set(['user', 'agent', 'service', 'task']);

/**
 * Creates a test Prisma Client with soft delete extension
 */
const createTestPrisma = () => {
  const client = new PrismaClient();

  const softDeleteExtension = client.$extends({
    query: {
      $allModels: {
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
      },
    },
  });

  return softDeleteExtension;
};

const prisma = createTestPrisma();

describe('Prisma Soft Delete', () => {
  const testEmail = `test-${Date.now()}@example.com`;

  beforeAll(async () => {
    // Clean up any existing test users using raw query for hard delete
    const baseClient = new PrismaClient();
    await baseClient.$executeRaw`DELETE FROM "User" WHERE email LIKE 'test-%'`;
    await baseClient.$disconnect();
  });

  afterAll(async () => {
    // Clean up test users - hard delete using raw query
    const baseClient = new PrismaClient();
    await baseClient.$executeRaw`DELETE FROM "User" WHERE email LIKE 'test-%'`;
    await baseClient.$disconnect();
  });

  it('should create a user successfully', async () => {
    const user = await prisma.user.create({
      data: {
        email: testEmail,
        password: 'hashedpassword123',
        name: 'Test User',
        balance: 1000,
        frozen: 0,
      },
    });

    expect(user).toBeDefined();
    expect(user.email).toBe(testEmail);
    expect(user.name).toBe('Test User');
    expect(user.balance).toBe(1000);
    expect(user.frozen).toBe(0);
    expect(user.deletedAt).toBeNull();
    expect(user.id).toBeDefined();
    expect(user.createdAt).toBeInstanceOf(Date);
    expect(user.updatedAt).toBeInstanceOf(Date);
  });

  it('should soft delete user (set deletedAt instead of actual delete)', async () => {
    // Create a user to delete
    const userToDelete = await prisma.user.create({
      data: {
        email: `delete-test-${Date.now()}@example.com`,
        password: 'hashedpassword123',
        name: 'User To Delete',
      },
    });

    // Delete the user (should be soft delete)
    const deletedUser = await prisma.user.delete({
      where: { id: userToDelete.id },
    });

    expect(deletedUser.deletedAt).toBeInstanceOf(Date);

    // Cleanup - hard delete using raw query
    const baseClient = new PrismaClient();
    await baseClient.$executeRaw`DELETE FROM "User" WHERE id = ${userToDelete.id}`;
    await baseClient.$disconnect();
  });

  it('should not return deleted users in findMany', async () => {
    const uniqueEmail = `findmany-test-${Date.now()}@example.com`;

    // Create user
    const user = await prisma.user.create({
      data: {
        email: uniqueEmail,
        password: 'hashedpassword123',
        name: 'FindMany Test User',
      },
    });

    // Verify user is found before deletion
    const beforeDelete = await prisma.user.findMany({
      where: { email: uniqueEmail },
    });
    expect(beforeDelete.length).toBe(1);

    // Soft delete the user
    await prisma.user.delete({
      where: { id: user.id },
    });

    // Verify user is NOT found via findMany (soft delete middleware filters it)
    const afterDelete = await prisma.user.findMany({
      where: { email: uniqueEmail },
    });
    expect(afterDelete.length).toBe(0);

    // Verify user is NOT found via findFirst
    const findFirstResult = await prisma.user.findFirst({
      where: { email: uniqueEmail },
    });
    expect(findFirstResult).toBeNull();

    // Cleanup - hard delete using raw query
    const baseClient = new PrismaClient();
    await baseClient.$executeRaw`DELETE FROM "User" WHERE id = ${user.id}`;
    await baseClient.$disconnect();
  });
});
