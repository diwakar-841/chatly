/**
 * Jest configuration (CommonJS on purpose: package.json has "type": "module").
 *
 * - Source is TypeScript with NodeNext-style imports ("../app.js" -> app.ts),
 *   so ts-jest compiles it to CommonJS and the moduleNameMapper strips ".js".
 * - Only src/**\/*.test.ts is run. The compiled copies in dist/ are ignored.
 */
/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: "node",
  testTimeout: 30000,
  roots: ["<rootDir>/src"],
  testMatch: ["**/__tests__/**/*.test.ts"],
  testPathIgnorePatterns: ["/node_modules/", "/dist/"],
  moduleFileExtensions: ["ts", "js", "json"],
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
  transform: {
    "^.+\\.ts$": ["ts-jest", { tsconfig: "<rootDir>/tsconfig.jest.json" }],
  },
  setupFiles: ["<rootDir>/jest.setup.cjs"],
};
