import { Request, Response, NextFunction } from "express";
import * as chatService from "../services/chatService.js";
import { AuthRequest } from "../types/index.js";

export const getDM = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const chat = await chatService.getOrCreateDM(
      (req as AuthRequest).user._id,
      req.params.userId,
    );
    res.json(chat);
  } catch (err) {
    next(err);
  }
};

export const getUserChats = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const chats = await chatService.getUserChats(
      (req as AuthRequest).user._id,
      page,
    );
    res.json(chats);
  } catch (err) {
    next(err);
  }
};

export const createGroup = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { name, description, isPublic, members } = req.body as {
      name: string;
      description?: string;
      isPublic?: string;
      members?: string[];
    };
    const groupAvatar = req.file ? req.file.path : "";
    const chat = await chatService.createGroup({
      name,
      description,
      isPublic: isPublic === "true",
      members: members ?? [],
      creatorId: (req as AuthRequest).user._id,
      groupAvatar,
    });
    res.status(201).json(chat);
  } catch (err) {
    next(err);
  }
};

export const updateGroup = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const groupAvatar = req.file ? req.file.path : undefined;
    const { name, description, isPublic } = req.body as {
      name?: string;
      description?: string;
      isPublic?: string;
    };
    const updates = {
      ...(name !== undefined ? { name } : {}),
      ...(description !== undefined ? { description } : {}),
      ...(isPublic !== undefined ? { isPublic: isPublic === "true" } : {}),
      ...(groupAvatar ? { groupAvatar } : {}),
    };
    const chat = await chatService.updateGroup(
      req.params.chatId,
      (req as AuthRequest).user._id,
      updates,
    );
    res.json(chat);
  } catch (err) {
    next(err);
  }
};

export const addMembers = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const chat = await chatService.addMembers(
      req.params.chatId,
      (req as AuthRequest).user._id,
      (req.body as { members: string[] }).members,
    );
    res.json(chat);
  } catch (err) {
    next(err);
  }
};

export const removeMember = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const chat = await chatService.removeMember(
      req.params.chatId,
      (req as AuthRequest).user._id,
      req.params.memberId,
    );
    res.json(chat);
  } catch (err) {
    next(err);
  }
};

export const leaveGroup = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const result = await chatService.leaveGroup(
      req.params.chatId,
      (req as AuthRequest).user._id,
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const requestJoinGroup = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const result = await chatService.requestJoinGroup(
      req.params.chatId,
      (req as AuthRequest).user._id,
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const getJoinRequests = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const chat = await chatService.getJoinRequests(
      req.params.chatId,
      (req as AuthRequest).user._id,
    );
    res.json(chat);
  } catch (err) {
    next(err);
  }
};

export const handleJoinRequest = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { action } = req.body as { action: "accept" | "reject" };
    const chat = await chatService.handleJoinRequest(
      req.params.chatId,
      (req as AuthRequest).user._id,
      req.params.userId,
      action,
    );
    res.json(chat);
  } catch (err) {
    next(err);
  }
};

export const togglePinMessage = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const chat = await chatService.togglePinMessage(
      req.params.chatId,
      req.params.messageId,
      (req as AuthRequest).user._id,
    );
    res.json(chat);
  } catch (err) {
    next(err);
  }
};

export const getMessages = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const result = await chatService.getMessages(
      req.params.chatId,
      (req as AuthRequest).user._id,
      page,
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const hideChatForMe = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    await chatService.hideChat(
      req.params.chatId,
      (req as AuthRequest).user._id,
    );
    res.json({ message: "Chat removed from your list" });
  } catch (err) {
    next(err);
  }
};

export const acceptGroupInvite = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const result = await chatService.acceptGroupInvite(
      req.params.chatId,
      (req as AuthRequest).user._id,
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const rejectGroupInvite = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const result = await chatService.rejectGroupInvite(
      req.params.chatId,
      (req as AuthRequest).user._id,
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const getMyGroupInvites = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const chats = await chatService.getMyGroupInvites(
      (req as AuthRequest).user._id,
    );
    res.json(chats);
  } catch (err) {
    next(err);
  }
};

export const getChatById = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const chat = await chatService.getChatById(
      req.params.chatId,
      (req as AuthRequest).user._id,
    );
    res.json(chat);
  } catch (err) {
    next(err);
  }
};

export const searchGroups = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const q = (req.query.q as string) || "";
    const page = parseInt(req.query.page as string) || 1;
    const result = await chatService.searchGroups(
      q,
      (req as AuthRequest).user._id,
      page,
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
};
