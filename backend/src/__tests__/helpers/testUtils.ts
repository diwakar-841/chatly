import mongoose from "mongoose";
import request from "supertest";
import { MongoMemoryServer } from "mongodb-memory-server";
import app from "../../app.js";

let mongo: MongoMemoryServer | undefined;

/**
 * Connect to an isolated database for the current test file.
 *
 * - Default: an in-memory MongoDB (mongodb-memory-server).
 * - If MONGO_TEST_URI is set (e.g. a local `mongod`, or a throw-away Atlas
 *   cluster), that server is used instead with a unique, auto-dropped database.
 *   This is the way to run the suite where mongodb-memory-server cannot
 *   download/run a binary (e.g. Termux/Android).
 */
export async function connectTestDb(): Promise<void> {
  const externalUri = process.env.MONGO_TEST_URI;
  if (externalUri) {
    try {
      await mongoose.connect(externalUri, {
        dbName: `chat_test_${process.pid}_${Date.now()}`,
        // Fail in 5s with a clear message instead of hanging for 30s.
        serverSelectionTimeoutMS: 5000,
      });
    } catch (err) {
      const safeUri = externalUri.replace(/\/\/[^@/]*@/, "//***@");
      throw new Error(
        `Cannot reach MongoDB at ${safeUri}. Is mongod running / is the URI correct? (${(err as Error).message})`,
      );
    }
    return;
  }
  if (process.platform === "android") {
    throw new Error(
      "mongodb-memory-server cannot run on Android/Termux. " +
        'Start a mongod and run: MONGO_TEST_URI="mongodb://127.0.0.1:27017" npm test',
    );
  }
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
}

export async function disconnectTestDb(): Promise<void> {
  if (process.env.MONGO_TEST_URI && mongoose.connection.readyState === 1) {
    await mongoose.connection.dropDatabase();
  }
  await mongoose.disconnect();
  await mongo?.stop();
  mongo = undefined;
}

/** Remove every document from the given collections (all collections if omitted). */
export async function clearCollections(...names: string[]): Promise<void> {
  const collections = mongoose.connection.collections;
  const targets = names.length > 0 ? names : Object.keys(collections);
  for (const name of targets) {
    await collections[name]?.deleteMany({});
  }
}

export interface RegisteredUser {
  id: string;
  token: string;
  refreshToken: string;
  email: string;
}

/** Register a user through the real HTTP endpoint and return its credentials. */
export async function registerUser(
  username: string,
  fullName = username,
): Promise<RegisteredUser> {
  const email = `${username}@example.com`;
  const res = await request(app).post("/api/auth/register").send({
    username,
    email,
    password: "Password123!",
    fullName,
  });
  if (res.status !== 201) {
    throw new Error(
      `registerUser(${username}) failed: ${res.status} ${JSON.stringify(res.body)}`,
    );
  }
  return {
    id: res.body.user._id as string,
    token: res.body.accessToken as string,
    refreshToken: res.body.refreshToken as string,
    email,
  };
}
