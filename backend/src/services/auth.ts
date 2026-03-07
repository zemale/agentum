import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma.js';
import { env } from '@/config/env.js';

// Base token payload (what's stored in JWT)
interface BaseTokenPayload {
  userId: string;
  email: string;
  type: 'access' | 'refresh';
}

// Full token payload with id alias for backward compatibility
export interface TokenPayload extends BaseTokenPayload {
  id: string; // Alias for userId for backward compatibility
}

/**
 * Hash a password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, env.BCRYPT_ROUNDS);
}

/**
 * Verify a password against a hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Generate a random token string
 */
function generateRandomToken(): string {
  return crypto.randomBytes(64).toString('hex');
}

/**
 * Sign a JWT-like token (using simple HMAC for this implementation)
 * In production, consider using @fastify/jwt or jsonwebtoken library
 */
function signToken(payload: BaseTokenPayload, secret: string, expiresInSeconds: number): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify({
    ...payload,
    exp: Math.floor(Date.now() / 1000) + expiresInSeconds,
    iat: Math.floor(Date.now() / 1000),
  })).toString('base64url');
  
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${header}.${body}`)
    .digest('base64url');
  
  return `${header}.${body}.${signature}`;
}

/**
 * Verify and decode a token
 */
function verifyToken(token: string, secret: string): BaseTokenPayload {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid token format');
  }

  const [header, body, signature] = parts;
  
  // Verify signature
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(`${header}.${body}`)
    .digest('base64url');
  
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
    throw new Error('Invalid token signature');
  }

  // Parse payload
  const payload = JSON.parse(Buffer.from(body, 'base64url').toString()) as BaseTokenPayload & { exp: number; iat: number };
  
  // Check expiration
  if (payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error('Token expired');
  }

  return payload;
}

/**
 * Generate access and refresh tokens for a user
 */
export function generateTokens(userId: string, email: string): { accessToken: string; refreshToken: string } {
  const accessToken = signToken(
    { userId, email, type: 'access' },
    env.JWT_SECRET,
    15 * 60 // 15 minutes
  );

  const refreshToken = signToken(
    { userId, email, type: 'refresh' },
    env.JWT_REFRESH_SECRET,
    30 * 24 * 60 * 60 // 30 days
  );

  return { accessToken, refreshToken };
}

/**
 * Verify an access token
 */
export function verifyAccessToken(token: string): TokenPayload {
  const payload = verifyToken(token, env.JWT_SECRET);
  if (payload.type !== 'access') {
    throw new Error('Invalid token type');
  }
  // Add id alias for backward compatibility
  return { ...payload, id: payload.userId };
}

/**
 * Verify a refresh token
 */
export function verifyRefreshToken(token: string): TokenPayload {
  const payload = verifyToken(token, env.JWT_REFRESH_SECRET);
  if (payload.type !== 'refresh') {
    throw new Error('Invalid token type');
  }
  // Add id alias for backward compatibility
  return { ...payload, id: payload.userId };
}

/**
 * Create a refresh token and store it in the database
 */
export async function createRefreshToken(userId: string): Promise<string> {
  const token = generateRandomToken();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30); // 30 days

  await prisma.refreshToken.create({
    data: {
      token,
      userId,
      expiresAt,
    },
  });

  return token;
}

/**
 * Validate a refresh token from the database and return the userId if valid
 */
export async function validateRefreshToken(token: string): Promise<string | null> {
  const refreshToken = await prisma.refreshToken.findUnique({
    where: { token },
  });

  if (!refreshToken) {
    return null;
  }

  if (refreshToken.expiresAt < new Date()) {
    // Token expired, delete it
    await prisma.refreshToken.delete({
      where: { token },
    });
    return null;
  }

  return refreshToken.userId;
}

/**
 * Revoke a specific refresh token
 */
export async function revokeRefreshToken(token: string): Promise<void> {
  await prisma.refreshToken.deleteMany({
    where: { token },
  });
}

/**
 * Revoke all refresh tokens for a user
 */
export async function revokeAllUserRefreshTokens(userId: string): Promise<void> {
  await prisma.refreshToken.deleteMany({
    where: { userId },
  });
}

/**
 * Clean up expired refresh tokens (can be called periodically)
 */
export async function cleanupExpiredRefreshTokens(): Promise<number> {
  const result = await prisma.refreshToken.deleteMany({
    where: {
      expiresAt: {
        lt: new Date(),
      },
    },
  });

  return result.count;
}
