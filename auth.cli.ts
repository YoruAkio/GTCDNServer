// @note CLI-only shim for better-auth schema generation
// this file is ONLY used by `bunx @better-auth/cli generate`
// production code uses createAuth(db) in src/lib/auth.ts with a real D1 binding
import { betterAuth } from "better-auth";
import Database from "better-sqlite3";

const sqlite = new Database(":memory:");

export const auth = betterAuth({
  database: sqlite,
  emailAndPassword: { enabled: true },
});
