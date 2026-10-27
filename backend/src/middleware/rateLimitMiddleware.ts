import rateLimit from "express-rate-limit";

// The automated test-suite fires far more requests than a real user would.
const skipInTests = (): boolean => {
  return process.env.NODE_ENV === "test";
};

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { message: "Too many requests, please try again later." },
  skip: skipInTests,
  standardHeaders: true,
  legacyHeaders: false,
});

export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { message: "Too many requests, please try again later." },
  skip: skipInTests,
  standardHeaders: true,
  legacyHeaders: false,
});

// The AI assistant proxies to a paid third-party API, so it gets its own
// tighter limit to bound per-user cost exposure independent of the
// general API limiter.
export const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: {
    message: "You're sending messages too fast. Please slow down.",
  },
  skip: skipInTests,
  standardHeaders: true,
  legacyHeaders: false,
});
