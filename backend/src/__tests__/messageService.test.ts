import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
} from "@jest/globals";
import mongoose from "mongoose";
import * as messageService from "../services/messageService.js";
import Message from "../models/Message.js";
import Chat from "../models/Chat.js";
import User from "../models/User.js";
import { connectTestDb, disconnectTestDb } from "./helpers/testUtils.js";

/** `sender` comes back populated, so read the id from the document, not toString(). */
const idOf = (value: unknown): string => {
  const maybeDoc = value as { _id?: unknown } | null;
  return String(maybeDoc?._id ?? value);
};

beforeAll(async () => {
  await connectTestDb();
});

afterAll(async () => {
  await disconnectTestDb();
});

describe("MessageService", () => {
  let chatId: string;
  let aliceId: string;
  let bobId: string;

  const alice = () => {
    return new mongoose.Types.ObjectId(aliceId);
  };
  const bob = () => {
    return new mongoose.Types.ObjectId(bobId);
  };

  const sendFromAlice = (content: string, extra: { chat?: string; replyTo?: string } = {}) => {
    return messageService.sendMessage({
      chatId: extra.chat ?? chatId,
      senderId: alice(),
      senderUsername: "alice",
      content,
      type: "text",
      replyTo: extra.replyTo,
    });
  };

  beforeEach(async () => {
    const a = await User.create({
      username: "alice",
      email: "alice@test.com",
      password: "hashedpass123",
      isPrivate: false,
    });
    const b = await User.create({
      username: "bob",
      email: "bob@test.com",
      password: "hashedpass123",
      isPrivate: false,
    });
    aliceId = a._id.toString();
    bobId = b._id.toString();

    const chat = await Chat.create({
      members: [a._id, b._id],
      admins: [a._id],
      isGroup: true,
    });
    chatId = chat._id.toString();
  });

  afterEach(async () => {
    await Message.deleteMany({});
    await Chat.deleteMany({});
    await User.deleteMany({});
  });

  it("should send a message", async () => {
    const msg = await sendFromAlice("Hello");
    expect(msg.content).toBe("Hello");
    expect(idOf(msg.sender)).toBe(aliceId);
  });

  it("should reject an empty message", async () => {
    await expect(sendFromAlice("   ")).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it("should reject a sender who is not a chat member", async () => {
    const outsider = new mongoose.Types.ObjectId();
    await expect(
      messageService.sendMessage({
        chatId,
        senderId: outsider,
        senderUsername: "outsider",
        content: "hi",
        type: "text",
      }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("should increase the unread counter of the other members only", async () => {
    await sendFromAlice("one");
    await sendFromAlice("two");
    const chat = await Chat.findById(chatId);
    expect(chat?.unreadCounts?.get(bobId)).toBe(2);
    expect(chat?.unreadCounts?.get(aliceId)).toBeUndefined();
  });

  it("should accept a reply to a message from the same chat", async () => {
    const first = await sendFromAlice("original");
    const reply = await sendFromAlice("reply", { replyTo: first._id.toString() });
    expect(idOf(reply.replyTo)).toBe(first._id.toString());
  });

  it("should reject a reply to a message from another chat", async () => {
    const otherChat = await Chat.create({
      members: [alice()],
      admins: [alice()],
      isGroup: true,
    });
    const secret = await sendFromAlice("secret", {
      chat: otherChat._id.toString(),
    });

    await expect(
      sendFromAlice("sneaky reply", { replyTo: secret._id.toString() }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("should mark messages as read for the reader", async () => {
    const msg = await sendFromAlice("Test message");
    await messageService.markRead(chatId, bob());

    const updated = await Message.findById(msg._id);
    expect(updated?.readBy.map(String)).toContain(bobId);

    const chat = await Chat.findById(chatId);
    expect(chat?.unreadCounts?.get(bobId)).toBe(0);
  });

  it("should mark messages as delivered for the recipient", async () => {
    const msg = await sendFromAlice("Test");
    await messageService.markDelivered(chatId, bob());

    const updated = await Message.findById(msg._id);
    expect(updated?.deliveredTo.map(String)).toContain(bobId);
  });

  it("should delete a message", async () => {
    const msg = await sendFromAlice("Delete me");
    const deleted = await messageService.deleteMessage(
      msg._id.toString(),
      alice(),
    );
    expect(deleted.isDeleted).toBe(true);
    expect(deleted.content).toBe("");
  });

  it("should not let another user delete a message", async () => {
    const msg = await sendFromAlice("Not yours");
    await expect(
      messageService.deleteMessage(msg._id.toString(), bob()),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("should react to a message and toggle the reaction off", async () => {
    const msg = await sendFromAlice("React to me");
    const reacted = await messageService.reactToMessage(
      msg._id.toString(),
      bob(),
      "👍",
    );
    expect(reacted.reactions.length).toBe(1);
    expect(reacted.reactions[0].emoji).toBe("👍");

    const toggled = await messageService.reactToMessage(
      msg._id.toString(),
      bob(),
      "👍",
    );
    expect(toggled.reactions.length).toBe(0);
  });

  it("should clear chat for one user only", async () => {
    await sendFromAlice("Message 1");
    await messageService.clearChat(chatId, alice(), false);

    // Clearing "for me" hides the messages but does not delete the documents.
    const messages = await Message.find({ chat: chatId });
    expect(messages.length).toBe(1);
    const hiddenFor = (messages[0].deletedFor ?? []).map(String);
    expect(hiddenFor).toContain(aliceId);
    expect(hiddenFor).not.toContain(bobId);
  });
});
