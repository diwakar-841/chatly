import { Response, NextFunction } from "express";
import { AuthRequest } from "../types/index.js";
import { AppError } from "../utils/errors.js";
import logger from "../utils/logger.js";

interface GeminiMessage {
  role: "user" | "model";
  parts: { text: string }[];
}

const MAX_AI_MESSAGE_LENGTH = 4000;
const MAX_AI_HISTORY_TURNS = 20;

function sanitizeHistory(history: unknown): GeminiMessage[] {
  if (!Array.isArray(history)) {
    return [];
  }
  return history
    .filter((entry): entry is GeminiMessage => {
      return (
        !!entry &&
        (entry.role === "user" || entry.role === "model") &&
        Array.isArray(entry.parts) &&
        entry.parts.length > 0 &&
        typeof entry.parts[0]?.text === "string"
      );
    })
    .slice(-MAX_AI_HISTORY_TURNS)
    .map((entry) => {
      return {
        role: entry.role,
        parts: [{ text: entry.parts[0].text.slice(0, MAX_AI_MESSAGE_LENGTH) }],
      };
    });
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

    if (typeof message !== "string" || !message.trim()) {
      return next(new AppError("Message is required", 400));
    }
    if (message.length > MAX_AI_MESSAGE_LENGTH) {
      return next(
        new AppError(
          `Message is too long (max ${MAX_AI_MESSAGE_LENGTH} characters).`,
          400,
        ),
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      logger.error("[AI] GEMINI_API_KEY is not configured");
      return next(
        new AppError("The AI assistant is currently unavailable. Please try again later.", 503),
      );
    }

    const contents: GeminiMessage[] = [
      ...sanitizeHistory(history),
      { role: "user", parts: [{ text: message.trim() }] },
    ];

    // Key goes in a header (not the URL) so it cannot end up in proxy/access logs.
    // Timeout: without one a stalled upstream request would hang forever.
    const model = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({ contents }),
        signal: AbortSignal.timeout(30_000),
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
    if ((error as Error)?.name === "TimeoutError") {
      return next(
        new AppError("The AI assistant took too long to respond. Please try again.", 504),
      );
    }
    next(error);
  }
};
