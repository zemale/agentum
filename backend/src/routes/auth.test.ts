import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '@/index.js';
import { prisma } from '@/lib/prisma.js';
import { hashPassword } from '@/services/auth.js';

describe('Auth Routes', () => {
  // Clean up test data before and after tests
  beforeEach(async () => {
    await prisma.refreshToken.deleteMany();
    await prisma.user.deleteMany({
      where: {
        email: {
          contains: 'test',
        },
      },
    });
  });

  describe('POST /auth/register', () => {
    it('should register a new user successfully', async () => {
      const response = await request(app.server)
        .post('/auth/register')
        .send({
          email: 'test@example.com',
          password: 'password123',
          name: 'Test User',
        })
        .expect(201);

      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('refreshToken');
      expect(response.body.user.email).toBe('test@example.com');
      expect(response.body.user.name).toBe('Test User');
      expect(response.body.user.balance).toBe(1000);
      expect(response.body.user.frozen).toBe(0);
      expect(response.body.user).not.toHaveProperty('password');
    });

    it('should return 409 for duplicate email', async () => {
      // Create first user
      await request(app.server)
        .post('/auth/register')
        .send({
          email: 'test@example.com',
          password: 'password123',
          name: 'Test User',
        })
        .expect(201);

      // Try to create second user with same email
      const response = await request(app.server)
        .post('/auth/register')
        .send({
          email: 'test@example.com',
          password: 'password123',
          name: 'Test User 2',
        })
        .expect(409);

      expect(response.body.code).toBe('USER_EXISTS');
    });

    it('should validate email format', async () => {
      const response = await request(app.server)
        .post('/auth/register')
        .send({
          email: 'invalid-email',
          password: 'password123',
          name: 'Test User',
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should validate password minimum length', async () => {
      const response = await request(app.server)
        .post('/auth/register')
        .send({
          email: 'test@example.com',
          password: 'short',
          name: 'Test User',
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should validate name minimum length', async () => {
      const response = await request(app.server)
        .post('/auth/register')
        .send({
          email: 'test@example.com',
          password: 'password123',
          name: 'A',
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /auth/login', () => {
    beforeEach(async () => {
      // Create a test user
      await prisma.user.create({
        data: {
          email: 'login@test.com',
          password: await hashPassword('password123'),
          name: 'Login Test User',
        },
      });
    });

    it('should login with valid credentials', async () => {
      const response = await request(app.server)
        .post('/auth/login')
        .send({
          email: 'login@test.com',
          password: 'password123',
        })
        .expect(200);

      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('refreshToken');
      expect(response.body.user.email).toBe('login@test.com');
    });

    it('should return 401 for invalid email', async () => {
      const response = await request(app.server)
        .post('/auth/login')
        .send({
          email: 'nonexistent@test.com',
          password: 'password123',
        })
        .expect(401);

      expect(response.body.code).toBe('INVALID_CREDENTIALS');
    });

    it('should return 401 for invalid password', async () => {
      const response = await request(app.server)
        .post('/auth/login')
        .send({
          email: 'login@test.com',
          password: 'wrongpassword',
        })
        .expect(401);

      expect(response.body.code).toBe('INVALID_CREDENTIALS');
    });
  });

  describe('POST /auth/refresh', () => {
    let refreshToken: string;
    let userId: string;

    beforeEach(async () => {
      // Register a user and get refresh token
      const registerResponse = await request(app.server)
        .post('/auth/register')
        .send({
          email: 'refresh@test.com',
          password: 'password123',
          name: 'Refresh Test User',
        });

      refreshToken = registerResponse.body.refreshToken;
      userId = registerResponse.body.user.id;
    });

    it('should refresh tokens with valid refresh token', async () => {
      const response = await request(app.server)
        .post('/auth/refresh')
        .send({
          refreshToken,
        })
        .expect(200);

      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('refreshToken');
      expect(response.body.refreshToken).not.toBe(refreshToken);
    });

    it('should invalidate old refresh token after refresh', async () => {
      // First refresh
      await request(app.server)
        .post('/auth/refresh')
        .send({
          refreshToken,
        })
        .expect(200);

      // Try to use old refresh token again
      const response = await request(app.server)
        .post('/auth/refresh')
        .send({
          refreshToken,
        })
        .expect(401);

      expect(response.body.code).toBe('INVALID_REFRESH_TOKEN');
    });

    it('should return 401 for invalid refresh token', async () => {
      const response = await request(app.server)
        .post('/auth/refresh')
        .send({
          refreshToken: 'invalid-token',
        })
        .expect(401);

      expect(response.body.code).toBe('INVALID_REFRESH_TOKEN');
    });
  });

  describe('POST /auth/logout', () => {
    let refreshToken: string;
    let accessToken: string;

    beforeEach(async () => {
      // Register a user and get tokens
      const registerResponse = await request(app.server)
        .post('/auth/register')
        .send({
          email: 'logout@test.com',
          password: 'password123',
          name: 'Logout Test User',
        });

      refreshToken = registerResponse.body.refreshToken;
      accessToken = registerResponse.body.accessToken;
    });

    it('should logout and revoke refresh token', async () => {
      const response = await request(app.server)
        .post('/auth/logout')
        .send({
          refreshToken,
        })
        .expect(200);

      expect(response.body.success).toBe(true);

      // Try to use revoked refresh token
      const refreshResponse = await request(app.server)
        .post('/auth/refresh')
        .send({
          refreshToken,
        })
        .expect(401);

      expect(refreshResponse.body.code).toBe('INVALID_REFRESH_TOKEN');
    });

    it('should logout without refresh token', async () => {
      const response = await request(app.server)
        .post('/auth/logout')
        .send({})
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should logout from all devices with allDevices flag', async () => {
      // First get current user info
      const meResponse = await request(app.server)
        .get('/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const response = await request(app.server)
        .post('/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          allDevices: true,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('GET /auth/me (Protected Route)', () => {
    let accessToken: string;
    let userEmail: string;

    beforeEach(async () => {
      // Register a user and get access token
      const registerResponse = await request(app.server)
        .post('/auth/register')
        .send({
          email: 'me@test.com',
          password: 'password123',
          name: 'Me Test User',
        });

      accessToken = registerResponse.body.accessToken;
      userEmail = registerResponse.body.user.email;
    });

    it('should return user info with valid access token', async () => {
      const response = await request(app.server)
        .get('/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.email).toBe(userEmail);
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('name');
      expect(response.body).toHaveProperty('balance');
      expect(response.body).toHaveProperty('frozen');
      expect(response.body).toHaveProperty('createdAt');
    });

    it('should return 401 without access token', async () => {
      const response = await request(app.server)
        .get('/auth/me')
        .expect(401);

      expect(response.body.code).toBe('MISSING_TOKEN');
    });

    it('should return 401 with invalid access token', async () => {
      const response = await request(app.server)
        .get('/auth/me')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body.code).toBe('INVALID_TOKEN');
    });

    it('should return 401 with malformed Authorization header', async () => {
      const response = await request(app.server)
        .get('/auth/me')
        .set('Authorization', 'invalid-header')
        .expect(401);

      expect(response.body.code).toBe('MISSING_TOKEN');
    });
  });
});
