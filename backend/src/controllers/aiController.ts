import { Response, NextFunction } from "express";
import { AuthRequest } from "../types/index.js";
import { AppError } from "../utils/errors.js";

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
      return next(new AppError("AI service not configured", 500));
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
      const err = await response.json();
      return next(new AppError(err?.error?.message || "Gemini API error", 502));
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
