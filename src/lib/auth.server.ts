import "@tanstack/react-start/server-only";

import { betterAuth } from "better-auth";
import { hashPassword } from "better-auth/crypto";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { env } from "cloudflare:workers";
import { Kysely } from "kysely";
import { D1Dialect } from "kysely-d1";

import { ADMIN_EMAIL, ADMIN_NAME } from "./constants";

const ADMIN_DEFAULT_PASSWORD = "admin123";

let schemaReady = false;
let schemaPromise: Promise<void> | null = null;
let seeded = false;
let seedPromise: Promise<void> | null = null;

async function ensureSchema(d1: D1Database) {
  if (schemaReady) return;
  if (!schemaPromise) {
    schemaPromise = d1
      .batch([
        d1.prepare(
          'create table if not exists "user" ("id" text not null primary key, "name" text not null, "email" text not null unique, "emailVerified" integer not null, "image" text, "createdAt" date not null, "updatedAt" date not null)',
        ),
        d1.prepare(
          'create table if not exists "session" ("id" text not null primary key, "expiresAt" date not null, "token" text not null unique, "createdAt" date not null, "updatedAt" date not null, "ipAddress" text, "userAgent" text, "userId" text not null references "user" ("id") on delete cascade)',
        ),
        d1.prepare(
          'create table if not exists "account" ("id" text not null primary key, "accountId" text not null, "providerId" text not null, "userId" text not null references "user" ("id") on delete cascade, "accessToken" text, "refreshToken" text, "idToken" text, "accessTokenExpiresAt" date, "refreshTokenExpiresAt" date, "scope" text, "password" text, "createdAt" date not null, "updatedAt" date not null)',
        ),
        d1.prepare(
          'create table if not exists "verification" ("id" text not null primary key, "identifier" text not null, "value" text not null, "expiresAt" date not null, "createdAt" date not null, "updatedAt" date not null)',
        ),
        d1.prepare(
          'create index if not exists "session_userId_idx" on "session" ("userId")',
        ),
        d1.prepare(
          'create index if not exists "account_userId_idx" on "account" ("userId")',
        ),
        d1.prepare(
          'create index if not exists "verification_identifier_idx" on "verification" ("identifier")',
        ),
      ])
      .then(() => {
        schemaReady = true;
      });
  }

  await schemaPromise;
}

async function seedAdmin() {
  if (seeded) return;
  if (!seedPromise) {
    seedPromise = (async () => {
      const d1 = (env as any).D1_DB as D1Database | undefined;
      if (!d1) throw new Error("D1_DB binding not found");
      await ensureSchema(d1);

      try {
        const existing = await d1
          .prepare("select id from user where email = ?1 limit 1")
          .bind(ADMIN_EMAIL)
          .first<{ id: string }>();

        if (!existing) {
          const userId = crypto.randomUUID();
          const accountId = crypto.randomUUID();
          const now = new Date().toISOString();
          const passwordHash = await hashPassword(ADMIN_DEFAULT_PASSWORD);

          await d1.batch([
            d1
              .prepare(
                "insert into user (id, name, email, emailVerified, image, createdAt, updatedAt) values (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
              )
              .bind(userId, ADMIN_NAME, ADMIN_EMAIL, 1, null, now, now),
            d1
              .prepare(
                "insert into account (id, accountId, providerId, userId, password, createdAt, updatedAt) values (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
              )
              .bind(
                accountId,
                userId,
                "credential",
                userId,
                passwordHash,
                now,
                now,
              ),
          ]);
        }
      } finally {
        seeded = true;
      }
    })();
  }

  await seedPromise;
}

export function createAuth() {
  const d1 = (env as any).D1_DB as D1Database | undefined;
  if (!d1) throw new Error("D1_DB binding not found");

  const baseURL =
    ((env as any).BETTER_AUTH_URL as string | undefined) ??
    "http://localhost:3000";

  const db = new Kysely({ dialect: new D1Dialect({ database: d1 }) });

  return betterAuth({
    baseURL,
    database: {
      db,
      type: "sqlite",
      transaction: false,
    },
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
    },
    plugins: [tanstackStartCookies()],
  });
}

export async function getAuth() {
  const d1 = (env as any).D1_DB as D1Database | undefined;
  if (!d1) throw new Error("D1_DB binding not found");

  await ensureSchema(d1);

  const auth = createAuth();
  await seedAdmin();
  return auth;
}

export type Auth = ReturnType<typeof createAuth>;
