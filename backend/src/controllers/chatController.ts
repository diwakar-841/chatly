import { Request, Response, NextFunction } from 'express';
import * as chatService from '../services/chatService.js';
import { AuthRequest } from '../types/index.js';

/** Opens an existing DM or creates a new one between the caller and the target user. */
export const getDM = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const chat = await chatService.getOrCreateDM((req as AuthRequest).user._id, req.params.userId);
    res.json(chat);
  } catch (err) { next(err); }
};

/** Returns all non-hidden chats the caller belongs to, sorted by last activity. */
export const getUserChats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const chats = await chatService.getUserChats((req as AuthRequest).user._id, page);
    res.json(chats);
  } catch (err) { next(err); }
};

/** Creates a new group chat with the caller as admin and sends invites to listed members. */
export const createGroup = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { name, description, isPublic, members } = req.body as {
      name: string; description?: string; isPublic?: string; members?: string[];
    };
    const groupAvatar = req.file ? req.file.path : '';
    const chat = await chatService.createGroup({
      name, description,
      isPublic: isPublic === 'true',
      members: members ?? [],
      creatorId: (req as AuthRequest).user._id,
      groupAvatar,
    });
    res.status(201).json(chat);
  } catch (err) { next(err); }
};

/** Updates group metadata (name, description, isPublic, avatar); admin only. */
export const updateGroup = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const groupAvatar = req.file ? req.file.path : undefined;
    const { name, description, isPublic } = req.body as { name?: string; description?: string; isPublic?: string; };
    const updates = {
      ...(name !== undefined ? { name } : {}),
      ...(description !== undefined ? { description } : {}),
      ...(isPublic !== undefined ? { isPublic: isPublic === 'true' } : {}),
      ...(groupAvatar ? { groupAvatar } : {}),
    };
    const chat = await chatService.updateGroup(req.params.chatId, (req as AuthRequest).user._id, updates);
    res.json(chat);
  } catch (err) { next(err); }
};

/** Sends group invites to the listed user IDs; admin only. */
export const addMembers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const chat = await chatService.addMembers(
      req.params.chatId,
      (req as AuthRequest).user._id,
      (req.body as { members: string[] }).members
    );
    res.json(chat);
  } catch (err) { next(err); }
};

/** Removes the target member from the group; admin or self. */
export const removeMember = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const chat = await chatService.removeMember(
      req.params.chatId,
      (req as AuthRequest).user._id,
      req.params.memberId
    );
    res.json(chat);
  } catch (err) { next(err); }
};

/** Removes the caller from the group, disbanding it if they were the last member. */
export const leaveGroup = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const result = await chatService.leaveGroup(req.params.chatId, (req as AuthRequest).user._id);
    res.json(result);
  } catch (err) { next(err); }
};

/** Joins a public group directly or queues a join request for a private group. */
export const requestJoinGroup = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const result = await chatService.requestJoinGroup(req.params.chatId, (req as AuthRequest).user._id);
    res.json(result);
  } catch (err) { next(err); }
};

/** Returns the pending join-request list for a group; admin only. */
export const getJoinRequests = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const chat = await chatService.getJoinRequests(req.params.chatId, (req as AuthRequest).user._id);
    res.json(chat);
  } catch (err) { next(err); }
};

/** Accepts or rejects a pending join request for a user; admin only. */
export const handleJoinRequest = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { action } = req.body as { action: 'accept' | 'reject' };
    const chat = await chatService.handleJoinRequest(
      req.params.chatId,
      (req as AuthRequest).user._id,
      req.params.userId,
      action
    );
    res.json(chat);
  } catch (err) { next(err); }
};

/** Pins or unpins a message in the group; admin only. */
export const togglePinMessage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const chat = await chatService.togglePinMessage(
      req.params.chatId,
      req.params.messageId,
      (req as AuthRequest).user._id
    );
    res.json(chat);
  } catch (err) { next(err); }
};

/** Returns a paginated list of messages for the chat, excluding deleted and hidden ones. */
export const getMessages = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const result = await chatService.getMessages(
      req.params.chatId,
      (req as AuthRequest).user._id,
      page
    );
    res.json(result);
  } catch (err) { next(err); }
};

/** Hides the chat from the caller's list without deleting any messages. */
export const hideChatForMe = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    await chatService.hideChat(req.params.chatId, (req as AuthRequest).user._id);
    res.json({ message: 'Chat removed from your list' });
  } catch (err) { next(err); }
};

/** Accepts a pending group invite, moving the caller from pendingInvites to members. */
export const acceptGroupInvite = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const result = await chatService.acceptGroupInvite(
      req.params.chatId,
      (req as AuthRequest).user._id
    );
    res.json(result);
  } catch (err) { next(err); }
};

/** Declines a pending group invite and removes the caller from pendingInvites. */
export const rejectGroupInvite = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const result = await chatService.rejectGroupInvite(
      req.params.chatId,
      (req as AuthRequest).user._id
    );
    res.json(result);
  } catch (err) { next(err); }
};

/** Returns all groups that have sent the caller a pending invite. */
export const getMyGroupInvites = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const chats = await chatService.getMyGroupInvites((req as AuthRequest).user._id);
    res.json(chats);
  } catch (err) { next(err); }
};

/** Returns a single chat by ID, accessible only to members. */
export const getChatById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const chat = await chatService.getChatById(req.params.chatId, (req as AuthRequest).user._id);
    res.json(chat);
  } catch (err) { next(err); }
};

/** Searches public groups by name with pagination. */
export const searchGroups = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const q = (req.query.q as string) || '';
    const page = parseInt(req.query.page as string) || 1;
    const result = await chatService.searchGroups(q, (req as AuthRequest).user._id, page);
    res.json(result);
  } catch (err) { next(err); }
};
