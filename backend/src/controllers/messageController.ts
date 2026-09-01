import { Request, Response, NextFunction } from "express";
import * as messageService from "../services/messageService.js";
import { AuthRequest } from "../types/index.js";

function resolveType(
  file: Express.Multer.File | undefined,
  bodyType?: string,
): "text" | "image" | "file" {
  if (file) {
    return file.mimetype.startsWith("image/") ? "image" : "file";
  }
  if (bodyType === "image" || bodyType === "file") {
    return bodyType;
  }
  return "text";
}

export const sendMessage = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const {
      chatId,
      content,
      type: bodyType,
      replyTo,
      encryptedContent,
      nonce,
    } = req.body as {
      chatId: string;
      content?: string;
      type?: string;
      replyTo?: string;
      encryptedContent?: string;
      nonce?: string;
    };
    const mediaUrl = req.file ? req.file.path || "" : "";
    const type = resolveType(req.file, bodyType);
    const message = await messageService.sendMessage({
      chatId,
      content,
      type,
      replyTo,
      mediaUrl,
      senderId: (req as AuthRequest).user._id,
      senderUsername: (req as AuthRequest).user.username,
      encryptedContent,
      nonce,
    });
    res.status(201).json(message);
  } catch (err) {
    next(err);
  }
};

export const editMessage = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { content, encryptedContent, nonce } = req.body as {
      content?: string;
      encryptedContent?: string;
      nonce?: string;
    };
    const message = await messageService.editMessage({
      messageId: req.params.messageId,
      userId: (req as AuthRequest).user._id,
      content,
      encryptedContent,
      nonce,
    });
    res.json(message);
  } catch (err) {
    next(err);
  }
};

export const deleteMessage = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    await messageService.deleteMessage(
      req.params.messageId,
      (req as AuthRequest).user._id,
    );
    res.json({ message: "Message deleted" });
  } catch (err) {
    next(err);
  }
};

export const reactToMessage = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const message = await messageService.reactToMessage(
      req.params.messageId,
      (req as AuthRequest).user._id,
      (req.body as { emoji: string }).emoji,
    );
    res.json(message);
  } catch (err) {
    next(err);
  }
};

export const markRead = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    await messageService.markRead(
      req.params.chatId,
      (req as AuthRequest).user._id,
    );
    res.json({ message: "Messages marked as read" });
  } catch (err) {
    next(err);
  }
};

export const clearChat = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const forBoth = req.query.forBoth === "true";
    await messageService.clearChat(
      req.params.chatId,
      (req as AuthRequest).user._id,
      forBoth,
    );
    res.json({message: forBoth ? "Chat cleared for everyone" : "Chat cleared for you",});
  } catch (err) {
    next(err);
  }
};
