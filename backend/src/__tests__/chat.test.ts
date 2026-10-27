import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  afterEach,
  jest,
} from "@jest/globals";
import request from "supertest";
import app from "../app.js";
import FriendRequest from "../models/Request.js";
import {
  connectTestDb,
  disconnectTestDb,
  clearCollections,
  registerUser,
  type RegisteredUser,
} from "./helpers/testUtils.js";

// Prevent any real EmailJS traffic during tests.
jest.mock("../services/emailService.js", () => {
  return {
    sendVerificationOtp: jest.fn(async () => {}),
    sendPasswordResetOtp: jest.fn(async () => {}),
  };
});

let alice: RegisteredUser;
let bob: RegisteredUser;

const auth = (u: RegisteredUser) => {
  return { Authorization: `Bearer ${u.token}` };
};

/**
 * Spin up an isolated database and register two users. New accounts are
 * private by default, so alice and bob must be friends before they can DM.
 */
beforeAll(async () => {
  await connectTestDb();
  alice = await registerUser("alice", "Alice");
  bob = await registerUser("bob", "Bob");
  await FriendRequest.create({
    sender: alice.id,
    recipient: bob.id,
    status: "accepted",
  });
});

afterAll(async () => {
  await disconnectTestDb();
});

afterEach(async () => {
  // Keep users and friendships; reset chats and messages between tests.
  await clearCollections("chats", "messages");
});

const openDm = async () => {
  const res = await request(app)
    .get(`/api/chats/dm/${bob.id}`)
    .set(auth(alice));
  return res.body as { _id: string };
};

const createGroup = async () => {
  const res = await request(app)
    .post("/api/chats/group")
    .set(auth(alice))
    .field("name", "Test Group")
    .field("members", JSON.stringify([bob.id]));
  return res.body as { _id: string };
};

describe("GET /api/chats", () => {
  it("returns an empty list when the user has no chats", async () => {
    const res = await request(app).get("/api/chats").set(auth(alice));
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("returns 401 without a token", async () => {
    const res = await request(app).get("/api/chats");
    expect(res.status).toBe(401);
  });
});

describe("GET /api/chats/dm/:userId", () => {
  it("creates and returns a DM between alice and bob", async () => {
    const res = await request(app)
      .get(`/api/chats/dm/${bob.id}`)
      .set(auth(alice));
    expect(res.status).toBe(200);
    expect(res.body.isGroup).toBe(false);
    const memberIds = res.body.members.map((m: { _id: string }) => {
      return m._id;
    });
    expect(memberIds).toContain(alice.id);
    expect(memberIds).toContain(bob.id);
  });

  it("is idempotent — fetching the same DM twice returns the same chat", async () => {
    const first = await request(app)
      .get(`/api/chats/dm/${bob.id}`)
      .set(auth(alice));
    const second = await request(app)
      .get(`/api/chats/dm/${bob.id}`)
      .set(auth(alice));
    expect(first.body._id).toBe(second.body._id);
  });

  it("refuses to open a DM with yourself", async () => {
    const res = await request(app)
      .get(`/api/chats/dm/${alice.id}`)
      .set(auth(alice));
    expect(res.status).toBe(400);
  });

  it("returns 401 without a token", async () => {
    const res = await request(app).get(`/api/chats/dm/${bob.id}`);
    expect(res.status).toBe(401);
  });
});

describe("POST /api/chats/group", () => {
  it("creates a group chat and includes the creator as admin", async () => {
    const res = await request(app)
      .post("/api/chats/group")
      .set(auth(alice))
      .field("name", "Test Group")
      .field("members", JSON.stringify([bob.id]));
    expect(res.status).toBe(201);
    expect(res.body.isGroup).toBe(true);
    expect(res.body.name).toBe("Test Group");
    // admins are populated user objects, not bare ids
    const adminIds = res.body.admins.map((a: { _id: string }) => {
      return a._id;
    });
    expect(adminIds).toContain(alice.id);
  });

  it("accepts a single member sent as a plain form field", async () => {
    // The web client appends `members` once per user; with exactly one user
    // multer delivers a string, not an array.
    const res = await request(app)
      .post("/api/chats/group")
      .set(auth(alice))
      .field("name", "Pair Group")
      .field("members", bob.id);
    expect(res.status).toBe(201);
    expect(res.body.name).toBe("Pair Group");
  });

  it("accepts several members sent as repeated form fields", async () => {
    const carol = await registerUser("carol", "Carol");
    const res = await request(app)
      .post("/api/chats/group")
      .set(auth(alice))
      .field("name", "Trio")
      .field("members", bob.id)
      .field("members", carol.id);
    expect(res.status).toBe(201);
  });

  it("returns 400 when the group name is missing", async () => {
    const res = await request(app)
      .post("/api/chats/group")
      .set(auth(alice))
      .field("members", JSON.stringify([bob.id]));
    expect(res.status).toBe(400);
  });

  it("returns 400 for an invalid member id", async () => {
    const res = await request(app)
      .post("/api/chats/group")
      .set(auth(alice))
      .field("name", "Bad Members")
      .field("members", "not-an-id");
    expect(res.status).toBe(400);
  });

  it("returns 401 without a token", async () => {
    const res = await request(app)
      .post("/api/chats/group")
      .field("name", "Ghost Group");
    expect(res.status).toBe(401);
  });
});

describe("GET /api/chats/:chatId/messages", () => {
  it("returns an empty message page for a new DM", async () => {
    const dm = await openDm();
    const res = await request(app)
      .get(`/api/chats/${dm._id}/messages`)
      .set(auth(alice));
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.total).toBe(0);
  });

  it("returns 403 for a chat the user is not a member of", async () => {
    const carol = await registerUser("carol2", "Carol");
    const dm = await openDm();
    const res = await request(app)
      .get(`/api/chats/${dm._id}/messages`)
      .set(auth(carol));
    expect(res.status).toBe(403);
  });
});

describe("PATCH /api/chats/:chatId/pin/:messageId", () => {
  const sendText = async (chatId: string, content: string) => {
    const res = await request(app)
      .post("/api/messages")
      .set(auth(alice))
      .send({ chatId, content });
    return res.body as { _id: string };
  };

  it("pins a message that belongs to the chat", async () => {
    const dm = await openDm();
    const msg = await sendText(dm._id, "pin me");
    const res = await request(app)
      .patch(`/api/chats/${dm._id}/pin/${msg._id}`)
      .set(auth(alice));
    expect(res.status).toBe(200);
    const pinnedIds = res.body.pinnedMessages.map((m: { _id: string }) => {
      return m._id;
    });
    expect(pinnedIds).toEqual([msg._id]);
  });

  it("refuses to pin a message from a different chat", async () => {
    const dm = await openDm();
    const group = await createGroup();
    const secret = await sendText(dm._id, "private DM text");
    const res = await request(app)
      .patch(`/api/chats/${group._id}/pin/${secret._id}`)
      .set(auth(alice));
    expect(res.status).toBe(404);
  });
});
