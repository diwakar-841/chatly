import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  jest,
} from "@jest/globals";
import request from "supertest";
import app from "../app.js";
import User from "../models/User.js";
import {
  connectTestDb,
  disconnectTestDb,
  clearCollections,
} from "./helpers/testUtils.js";

// Never send real e-mails from tests.
jest.mock("../services/emailService.js", () => {
  return {
    sendVerificationOtp: jest.fn(async () => {}),
    sendPasswordResetOtp: jest.fn(async () => {}),
  };
});

const USER = {
  username: "testauth",
  email: "testauth@example.com",
  password: "Password123!",
  fullName: "Test Auth",
};

beforeAll(async () => {
  await connectTestDb();
});

afterAll(async () => {
  await disconnectTestDb();
});

// Every test starts from an empty database, so each test registers what it needs.
beforeEach(async () => {
  await clearCollections();
});

const register = async () => {
  const res = await request(app).post("/api/auth/register").send(USER);
  return res.body as {
    accessToken: string;
    refreshToken: string;
    user: { _id: string; email: string };
  };
};

describe("POST /api/auth/register", () => {
  it("creates a new account and returns tokens + user", async () => {
    const res = await request(app).post("/api/auth/register").send(USER);
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("accessToken");
    expect(res.body).toHaveProperty("refreshToken");
    expect(res.body.user.email).toBe(USER.email);
    expect(res.body.user).not.toHaveProperty("password");
  });

  it("ignores privileged fields sent by the client (mass assignment)", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ ...USER, isVerified: true, publicKey: "x".repeat(40) });
    expect(res.status).toBe(201);
    expect(res.body.user.isVerified).toBe(false);

    const stored = await User.findOne({ email: USER.email });
    expect(stored?.isVerified).toBe(false);
    expect(stored?.publicKey).toBe("");
  });

  it("rejects a duplicate email with 409", async () => {
    await register();
    const res = await request(app).post("/api/auth/register").send(USER);
    expect(res.status).toBe(409);
  });

  it("rejects a duplicate username with 409", async () => {
    await register();
    const res = await request(app)
      .post("/api/auth/register")
      .send({ ...USER, email: "other@example.com" });
    expect(res.status).toBe(409);
  });

  it("returns 400 when required fields are missing", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ email: USER.email });
    expect(res.status).toBe(400);
  });

  it("returns 400 for a weak password", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ ...USER, password: "weakpass" });
    expect(res.status).toBe(400);
  });
});

describe("POST /api/auth/login", () => {
  beforeEach(async () => {
    await register();
  });

  it("returns tokens and user on valid credentials", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: USER.email, password: USER.password });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("accessToken");
    expect(res.body.user.email).toBe(USER.email);
  });

  it("returns 401 on wrong password", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: USER.email, password: "WrongPass999!" });
    expect(res.status).toBe(401);
  });

  it("returns 401 for an email that does not exist", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "nobody@example.com", password: "anything" });
    expect(res.status).toBe(401);
  });
});

describe("GET /api/auth/me", () => {
  it("returns the authenticated user", async () => {
    const { accessToken } = await register();
    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.email).toBe(USER.email);
    expect(res.body).not.toHaveProperty("password");
  });

  it("returns 401 when no token is provided", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
  });

  it("returns 401 for a malformed token", async () => {
    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", "Bearer not-a-valid-token");
    expect(res.status).toBe(401);
  });

  it("returns 401 (not 404) when the token belongs to a deleted user", async () => {
    const { accessToken } = await register();
    await User.deleteMany({});
    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${accessToken}`);
    expect(res.status).toBe(401);
  });
});

describe("POST /api/auth/refresh-token", () => {
  it("issues a new token pair for a valid refresh token", async () => {
    const { refreshToken } = await register();
    const res = await request(app)
      .post("/api/auth/refresh-token")
      .send({ refreshToken });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("accessToken");
    expect(res.body).toHaveProperty("refreshToken");
    expect(res.body.refreshToken).not.toBe(refreshToken);
  });

  it("rotates refresh tokens: the old one stops working", async () => {
    const { refreshToken } = await register();
    await request(app).post("/api/auth/refresh-token").send({ refreshToken });
    const reuse = await request(app)
      .post("/api/auth/refresh-token")
      .send({ refreshToken });
    expect(reuse.status).toBe(401);
  });

  it("returns 401 for an invalid refresh token", async () => {
    const res = await request(app)
      .post("/api/auth/refresh-token")
      .send({ refreshToken: "bad-token" });
    expect(res.status).toBe(401);
  });

  it("returns 400 when the refresh token is missing", async () => {
    const res = await request(app).post("/api/auth/refresh-token").send({});
    expect(res.status).toBe(400);
  });
});

describe("POST /api/auth/logout", () => {
  it("revokes the given refresh token", async () => {
    const { accessToken, refreshToken } = await register();
    const out = await request(app)
      .post("/api/auth/logout")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ refreshToken });
    expect(out.status).toBe(200);

    const res = await request(app)
      .post("/api/auth/refresh-token")
      .send({ refreshToken });
    expect(res.status).toBe(401);
  });
});
