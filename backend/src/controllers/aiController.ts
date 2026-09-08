import { Response, NextFunction } from "express";
import { AuthRequest } from "../types/index.js";
import { AppError } from "../utils/errors.js";
import logger from "../utils/logger.js";

interface GeminiMessage {
  role: "user" | "model";
  parts: { text: string }[];
}

export const aiChat = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { message, history } = req.body as {
      message: string;
      history?: GeminiMessage[];
    };

    if (!message?.trim()) {
      return next(new AppError("Message is required", 400));
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      logger.error("[AI] GEMINI_API_KEY is not configured");
      return next(
        new AppError("The AI assistant is currently unavailable. Please try again later.", 503),
      );
    }

    const contents: GeminiMessage[] = [
      ...(history || []),
      { role: "user", parts: [{ text: message }] },
    ];

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents }),
      },
    );

    if (!response.ok) {
      const err = await response.json().catch(() => null);
      logger.error(
        `[AI] Gemini API request failed (${response.status}): ${
          err?.error?.message || "no details"
        }`,
      );
      return next(
        new AppError("The AI assistant is temporarily unavailable. Please try again later.", 502),
      );
    }

    const data = (await response.json()) as {
      candidates: { content: { parts: { text: string }[] } }[];
    };

    const reply =
      data.candidates?.[0]?.content?.parts?.[0]?.text || "No response from AI.";
    res.json({ reply });
  } catch (error) {
    next(error);
  }
};
