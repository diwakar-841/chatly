// Runs before every test file (before any module is imported).
// Gives the app the environment it needs so tests never depend on a local .env.
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret";
process.env.JWT_EXPIRE = process.env.JWT_EXPIRE || "15m";
process.env.CLIENT_URL = process.env.CLIENT_URL || "http://localhost:5173";
