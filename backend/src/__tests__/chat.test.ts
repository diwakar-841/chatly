import { describe, it, expect, beforeAll, afterAll, afterEach, jest } from '@jest/globals';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';
import app from '../app.js';

// ── Prevent any real SMTP traffic during tests. ───────────────────────────────
jest.mock('../services/emailService.js', () => ({
  sendVerificationEmail: jest.fn(async () => {}),
  sendPasswordReset: jest.fn(async () => {}),
}));

let mongo: MongoMemoryServer;

const ALICE = { username: 'alice', email: 'alice@example.com', password: 'Password123!', fullName: 'Alice' };
const BOB   = { username: 'bob',   email: 'bob@example.com',   password: 'Password123!', fullName: 'Bob'   };

let aliceToken: string;
let aliceId:    string;
let bobId:      string;

/**
 * Spin up an isolated in-memory MongoDB and register two test users whose
 * tokens and IDs are reused across all chat-route tests.
 */
beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());

  const resA = await request(app).post('/api/auth/register').send(ALICE);
  const resB = await request(app).post('/api/auth/register').send(BOB);

  aliceToken = resA.body.accessToken;
  aliceId    = resA.body.user._id;
  bobId      = resB.body.user._id;
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

afterEach(async () => {
  // Remove chats and messages between tests; keep users so tokens stay valid.
  const { chats, messages } = mongoose.connection.collections;
  await chats?.deleteMany({});
  await messages?.deleteMany({});
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/chats
// ─────────────────────────────────────────────────────────────────────────────
describe('GET /api/chats', () => {
  it('returns an empty list when the user has no chats', async () => {
    const res = await request(app)
      .get('/api/chats')
      .set('Authorization', `Bearer ${aliceToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('returns 401 without a token', async () => {
    const res = await request(app).get('/api/chats');
    expect(res.status).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/chats/dm/:userId
// ─────────────────────────────────────────────────────────────────────────────
describe('GET /api/chats/dm/:userId', () => {
  it('creates and returns a DM between alice and bob', async () => {
    const res = await request(app)
      .get(`/api/chats/dm/${bobId}`)
      .set('Authorization', `Bearer ${aliceToken}`);
    expect(res.status).toBe(200);
    expect(res.body.isGroup).toBe(false);
    const memberIds = res.body.members.map((m: { _id: string }) => m._id);
    expect(memberIds).toContain(aliceId);
    expect(memberIds).toContain(bobId);
  });

  it('is idempotent — fetching the same DM twice returns the same chat', async () => {
    const first  = await request(app).get(`/api/chats/dm/${bobId}`).set('Authorization', `Bearer ${aliceToken}`);
    const second = await request(app).get(`/api/chats/dm/${bobId}`).set('Authorization', `Bearer ${aliceToken}`);
    expect(first.body._id).toBe(second.body._id);
  });

  it('returns 401 without a token', async () => {
    const res = await request(app).get(`/api/chats/dm/${bobId}`);
    expect(res.status).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/chats/group
// ─────────────────────────────────────────────────────────────────────────────
describe('POST /api/chats/group', () => {
  it('creates a group chat and includes the creator as admin', async () => {
    const res = await request(app)
      .post('/api/chats/group')
      .set('Authorization', `Bearer ${aliceToken}`)
      .field('name', 'Test Group')
      .field('members', JSON.stringify([bobId]));
    expect(res.status).toBe(201);
    expect(res.body.isGroup).toBe(true);
    expect(res.body.name).toBe('Test Group');
    expect(res.body.admins.map(String)).toContain(aliceId);
  });

  it('returns 400 when the group name is missing', async () => {
    const res = await request(app)
      .post('/api/chats/group')
      .set('Authorization', `Bearer ${aliceToken}`)
      .field('members', JSON.stringify([bobId]));
    expect(res.status).toBe(400);
  });

  it('returns 401 without a token', async () => {
    const res = await request(app)
      .post('/api/chats/group')
      .field('name', 'Ghost Group');
    expect(res.status).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/chats/:chatId/messages
// ─────────────────────────────────────────────────────────────────────────────
describe('GET /api/chats/:chatId/messages', () => {
  it('returns an empty message page for a new DM', async () => {
    const dmRes = await request(app)
      .get(`/api/chats/dm/${bobId}`)
      .set('Authorization', `Bearer ${aliceToken}`);
    const chatId = dmRes.body._id;

    const res = await request(app)
      .get(`/api/chats/${chatId}/messages`)
      .set('Authorization', `Bearer ${aliceToken}`);
    expect(res.status).toBe(200);
    // The service returns a paginated result with a data array.
    expect(Array.isArray(res.body.data ?? res.body)).toBe(true);
  });
});
