import { describe, it, expect, beforeAll, afterAll, afterEach, jest } from '@jest/globals';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';
import app from '../app.js';

// Mock email service
jest.mock('../services/emailService.js', () => ({
  sendVerificationEmail: jest.fn(async () => {}),
  sendPasswordReset: jest.fn(async () => {}),
}));

let mongo: MongoMemoryServer;
let accessToken: string;
let refreshToken: string;

const USER = {
  username: 'testauth',
  email: 'testauth@example.com',
  password: 'Password123!',
  fullName: 'Test Auth',
};

/**
 * Start an isolated in-memory database before any test in this suite runs.
 * This guarantees tests are hermetic and never touch a real MongoDB instance.
 */
beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

afterEach(async () => {
  // Wipe collections between tests so each test starts from a clean state.
  const collections = mongoose.connection.collections;
  for (const col of Object.values(collections)) {
    await col.deleteMany({});
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/register
// ─────────────────────────────────────────────────────────────────────────────
describe('POST /api/auth/register', () => {
  it('creates a new account and returns tokens + user', async () => {
    const res = await request(app).post('/api/auth/register').send(USER);
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('accessToken');
    expect(res.body).toHaveProperty('refreshToken');
    expect(res.body.user.email).toBe(USER.email);
    expect(res.body.user).not.toHaveProperty('password');
  });

  it('rejects a duplicate email with 409', async () => {
    await request(app).post('/api/auth/register').send(USER);
    const res = await request(app).post('/api/auth/register').send(USER);
    expect(res.status).toBe(409);
  });

  it('returns 400 when required fields are missing', async () => {
    const res = await request(app).post('/api/auth/register').send({ email: USER.email });
    expect(res.status).toBe(400);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/login
// ─────────────────────────────────────────────────────────────────────────────
describe('POST /api/auth/login', () => {
  beforeAll(async () => {
    const res = await request(app).post('/api/auth/register').send(USER);
    accessToken  = res.body.accessToken;
    refreshToken = res.body.refreshToken;
  });

  it('returns tokens and user on valid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: USER.email, password: USER.password });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('accessToken');
    expect(res.body.user.email).toBe(USER.email);
  });

  it('returns 401 on wrong password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: USER.email, password: 'WrongPass999!' });
    expect(res.status).toBe(401);
  });

  it('returns 401 for an email that does not exist', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: 'anything' });
    expect(res.status).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/auth/me
// ─────────────────────────────────────────────────────────────────────────────
describe('GET /api/auth/me', () => {
  beforeAll(async () => {
    const res = await request(app).post('/api/auth/register').send(USER);
    accessToken = res.body.accessToken;
  });

  it('returns the authenticated user', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.email).toBe(USER.email);
  });

  it('returns 401 when no token is provided', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('returns 401 for a malformed token', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer not-a-valid-token');
    expect(res.status).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/refresh-token
// ─────────────────────────────────────────────────────────────────────────────
describe('POST /api/auth/refresh-token', () => {
  beforeAll(async () => {
    const res = await request(app).post('/api/auth/register').send(USER);
    refreshToken = res.body.refreshToken;
  });

  it('issues a new token pair for a valid refresh token', async () => {
    const res = await request(app)
      .post('/api/auth/refresh-token')
      .send({ refreshToken });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('accessToken');
    expect(res.body).toHaveProperty('refreshToken');
  });

  it('returns 401 for an invalid refresh token', async () => {
    const res = await request(app)
      .post('/api/auth/refresh-token')
      .send({ refreshToken: 'bad-token' });
    expect(res.status).toBe(401);
  });
});
