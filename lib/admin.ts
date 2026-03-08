import "server-only"

import { hashPassword, verifyPassword } from "better-auth/crypto"
import { and, eq } from "drizzle-orm"

import {
  ADMIN_DEFAULT_PASSWORD,
  ADMIN_EMAIL,
  ADMIN_PASSWORD_CHANGE_SCOPE,
} from "@/lib/constants"
import { db, schema } from "@/lib/db"
import { getSession } from "@/lib/session"
import { listFiles } from "@/lib/storage-server"

export async function getPasswordChangeStatus(
  userId: string
): Promise<boolean> {
  const [account] = await db
    .select({ scope: schema.account.scope })
    .from(schema.account)
    .where(
      and(
        eq(schema.account.userId, userId),
        eq(schema.account.providerId, "credential")
      )
    )
    .limit(1)

  if (account?.scope === ADMIN_PASSWORD_CHANGE_SCOPE) {
    return true
  }

  const [legacyAccount] = await db
    .select({ password: schema.account.password })
    .from(schema.account)
    .innerJoin(schema.user, eq(schema.user.id, schema.account.userId))
    .where(
      and(
        eq(schema.account.userId, userId),
        eq(schema.user.email, ADMIN_EMAIL),
        eq(schema.account.providerId, "credential")
      )
    )
    .limit(1)

  if (!legacyAccount?.password) {
    return false
  }

  const usesDefaultPassword = await verifyPassword({
    hash: legacyAccount.password,
    password: ADMIN_DEFAULT_PASSWORD,
  })

  if (!usesDefaultPassword) {
    return false
  }

  await db
    .update(schema.account)
    .set({ scope: ADMIN_PASSWORD_CHANGE_SCOPE })
    .where(
      and(
        eq(schema.account.userId, userId),
        eq(schema.account.providerId, "credential")
      )
    )

  return true
}

export async function getAdminPageData(path: string) {
  const session = await getSession()
  if (!session) {
    return null
  }

  const [files, requiresPasswordChange] = await Promise.all([
    listFiles(path),
    getPasswordChangeStatus(session.user.id),
  ])

  return {
    currentPath: path,
    files,
    requiresPasswordChange,
    session,
  }
}

export async function changeAdminPassword(userId: string, newPassword: string) {
  if (newPassword.length < 8) {
    throw new Error("Password must be at least 8 characters")
  }

  if (newPassword === ADMIN_DEFAULT_PASSWORD) {
    throw new Error("Please choose a new password")
  }

  const passwordHash = await hashPassword(newPassword)
  await db
    .update(schema.account)
    .set({
      password: passwordHash,
      scope: null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(schema.account.userId, userId),
        eq(schema.account.providerId, "credential")
      )
    )
}
