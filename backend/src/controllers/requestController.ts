import { Request, Response, NextFunction } from "express";
import * as requestService from "../services/requestService.js";
import { AuthRequest } from "../types/index.js";

export const sendRequest = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const request = await requestService.sendRequest(
      (req as AuthRequest).user._id,
      req.params.userId,
    );
    res.status(201).json(request);
  } catch (err) {
    next(err);
  }
};

export const respondToRequest = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const request = await requestService.respondToRequest(
      req.params.requestId,
      (req as AuthRequest).user._id,
      (req.body as { action: string }).action,
    );
    res.json(request);
  } catch (err) {
    next(err);
  }
};

export const withdrawRequest = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    await requestService.withdrawRequest(
      req.params.requestId,
      (req as AuthRequest).user._id,
    );
    res.json({ message: "Request withdrawn" });
  } catch (err) {
    next(err);
  }
};

export const getRequestStatus = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const result = await requestService.getRequestStatus(
      (req as AuthRequest).user._id,
      req.params.userId,
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const getPendingRequests = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const requests = await requestService.getPendingRequests(
      (req as AuthRequest).user._id,
    );
    res.json(requests);
  } catch (err) {
    next(err);
  }
};

export const getSentRequests = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const requests = await requestService.getSentRequests(
      (req as AuthRequest).user._id,
    );
    res.json(requests);
  } catch (err) {
    next(err);
  }
};

export const unfriend = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    await requestService.unfriend(
      (req as AuthRequest).user._id,
      req.params.userId,
    );
    res.json({ message: "Unfriended successfully" });
  } catch (err) {
    next(err);
  }
};
