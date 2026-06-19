import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import * as messageService from '../services/messageService.js';
import Message from '../models/Message.js';
import Chat from '../models/Chat.js';
import User from '../models/User.js';
let mongo: MongoMemoryServer;

/**
 * Start an in-memory MongoDB instance once for the whole suite.
 * This avoids needing a real database URI and keeps tests self-contained.
 */
beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

describe('MessageService', () => {
  let chatId: string;
  let userId: string;

  beforeEach(async () => {
    const user = await User.create({
      username: 'testuser',
      email: 'test@test.com',
      password: 'hashedpass123',
      isPrivate: false,
    });
    userId = user._id.toString();

    const chat = await Chat.create({
      members: [user._id],
      isGroup: true,
    });
    chatId = chat._id.toString();
  });

  afterEach(async () => {
    await Message.deleteMany({});
    await Chat.deleteMany({});
    await User.deleteMany({});
  });

  it('should send a message', async () => {
    const msg = await messageService.sendMessage({
      chatId,
      senderId: new mongoose.Types.ObjectId(userId),
      senderUsername: 'testuser',
      content: 'Hello',
      type: 'text',
    });
    expect(msg.content).toBe('Hello');
    expect(msg.sender.toString()).toBe(userId);
  });

  it('should mark message as read', async () => {
    const msg = await messageService.sendMessage({
      chatId,
      senderId: new mongoose.Types.ObjectId(userId),
      senderUsername: 'testuser',
      content: 'Test message',
      type: 'text',
    });
    await messageService.markRead(chatId, new mongoose.Types.ObjectId(userId));
    const updated = await Message.findById(msg._id);
    expect(updated?.readBy.map(String)).toContain(userId);
  });

  it('should mark message as delivered', async () => {
    const msg = await messageService.sendMessage({
      chatId,
      senderId: new mongoose.Types.ObjectId(userId),
      senderUsername: 'testuser',
      content: 'Test',
      type: 'text',
    });
    await messageService.markDelivered(chatId, new mongoose.Types.ObjectId(userId));
    const updated = await Message.findById(msg._id);
    expect(updated?.deliveredTo.map(String)).toContain(userId);
  });

  it('should delete a message', async () => {
    const msg = await messageService.sendMessage({
      chatId,
      senderId: new mongoose.Types.ObjectId(userId),
      senderUsername: 'testuser',
      content: 'Delete me',
      type: 'text',
    });
    const deleted = await messageService.deleteMessage(
      msg._id.toString(),
      new mongoose.Types.ObjectId(userId)
    );
    expect(deleted.isDeleted).toBe(true);
    expect(deleted.content).toBe('');
  });

  it('should react to a message', async () => {
    const msg = await messageService.sendMessage({
      chatId,
      senderId: new mongoose.Types.ObjectId(userId),
      senderUsername: 'testuser',
      content: 'React to me',
      type: 'text',
    });
    const reacted = await messageService.reactToMessage(
      msg._id.toString(),
      new mongoose.Types.ObjectId(userId),
      '👍'
    );
    expect(reacted.reactions.length).toBe(1);
    expect(reacted.reactions[0].emoji).toBe('👍');
  });

  it('should clear chat for user', async () => {
    await messageService.sendMessage({
      chatId,
      senderId: new mongoose.Types.ObjectId(userId),
      senderUsername: 'testuser',
      content: 'Message 1',
      type: 'text',
    });
    await messageService.clearChat(chatId, new mongoose.Types.ObjectId(userId), false);
    // clearChat for self marks messages hidden but does not delete documents
    const messages = await Message.find({ chat: chatId });
    expect(messages.length).toBeGreaterThan(0);
  });
});
