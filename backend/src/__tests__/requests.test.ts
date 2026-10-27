import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  afterEach,
  jest,
} from "@jest/globals";
import mongoose from "mongoose";
import request from "supertest";
import app from "../app.js";
import {
  connectTestDb,
  disconnectTestDb,
  clearCollections,
  registerUser,
  type RegisteredUser,
} from "./helpers/testUtils.js";

jest.mock("../services/emailService.js", () => {
  return {
    sendVerificationOtp: jest.fn(async () => {}),
    sendPasswordResetOtp: jest.fn(async () => {}),
  };
});

let carol: RegisteredUser;
let dave: RegisteredUser;

const auth = (u: RegisteredUser) => {
  return { Authorization: `Bearer ${u.token}` };
};

beforeAll(async () => {
  await connectTestDb();
  carol = await registerUser("carol", "Carol");
  dave = await registerUser("dave", "Dave");
});

afterAll(async () => {
  await disconnectTestDb();
});

afterEach(async () => {
  await clearCollections("requests", "chats", "notifications");
});

describe("friend requests", () => {
  it("sends a request and reports it as pending_sent", async () => {
    const res = await request(app)
      .post(`/api/requests/send/${dave.id}`)
      .set(auth(carol));
    expect(res.status).toBe(201);

    const status = await request(app)
      .get(`/api/requests/status/${dave.id}`)
      .set(auth(carol));
    expect(status.body.status).toBe("pending_sent");
  });

  it("rejects a request to yourself", async () => {
    const res = await request(app)
      .post(`/api/requests/send/${carol.id}`)
      .set(auth(carol));
    expect(res.status).toBe(400);
  });

  it("rejects a request to a user that does not exist", async () => {
    const ghost = new mongoose.Types.ObjectId().toString();
    const res = await request(app)
      .post(`/api/requests/send/${ghost}`)
      .set(auth(carol));
    expect(res.status).toBe(404);
  });

  it("rejects a duplicate pending request with 409", async () => {
    await request(app).post(`/api/requests/send/${dave.id}`).set(auth(carol));
    const res = await request(app)
      .post(`/api/requests/send/${dave.id}`)
      .set(auth(carol));
    expect(res.status).toBe(409);
  });

  it("lets the sender try again after the request was rejected", async () => {
    const sent = await request(app)
      .post(`/api/requests/send/${dave.id}`)
      .set(auth(carol));
    const rejected = await request(app)
      .put(`/api/requests/respond/${sent.body._id}`)
      .set(auth(dave))
      .send({ action: "reject" });
    expect(rejected.status).toBe(200);

    // A rejected request is reported as "none", so the UI offers "Add friend".
    const status = await request(app)
      .get(`/api/requests/status/${dave.id}`)
      .set(auth(carol));
    expect(status.body.status).toBe("none");

    const again = await request(app)
      .post(`/api/requests/send/${dave.id}`)
      .set(auth(carol));
    expect(again.status).toBe(201);
  });

  it("creates a DM once the request is accepted", async () => {
    const sent = await request(app)
      .post(`/api/requests/send/${dave.id}`)
      .set(auth(carol));
    const accepted = await request(app)
      .put(`/api/requests/respond/${sent.body._id}`)
      .set(auth(dave))
      .send({ action: "accept" });
    expect(accepted.status).toBe(200);

    const chats = await request(app).get("/api/chats").set(auth(carol));
    expect(chats.body).toHaveLength(1);
    expect(chats.body[0].isGroup).toBe(false);
  });
});
