import { createServerFn } from "@tanstack/react-start";
import type { Session } from "@/lib/auth";
import type { FolderOption, StorageObject } from "@/lib/storage";
import { ADMIN_EMAIL, ADMIN_PASSWORD_CHANGE_SCOPE } from "@/lib/constants";

async function getPasswordChangeStatus(userId: string): Promise<boolean> {
  const { env } = await import("cloudflare:workers");
  const d1 = (env as any).D1_DB as D1Database | undefined;
  if (!d1) throw new Error("D1_DB binding not found");

  const account = await d1
    .prepare("select scope from account where userId = ?1 and providerId = ?2 limit 1")
    .bind(userId, "credential")
    .first<{ scope: string | null }>();

  if (account?.scope === ADMIN_PASSWORD_CHANGE_SCOPE) {
    return true;
  }

  // @note upgrade old seeded admin rows once, then switch to cheap scope checks
  if (userId) {
    const legacyAccount = await d1
      .prepare(
        "select account.password as password from account inner join user on user.id = account.userId where user.id = ?1 and user.email = ?2 and account.providerId = ?3 limit 1",
      )
      .bind(userId, ADMIN_EMAIL, "credential")
      .first<{ password: string | null }>();

    if (!legacyAccount?.password) {
      return false;
    }

    const { verifyPassword } = await import("better-auth/crypto");
    const usesDefaultPassword = await verifyPassword({
      hash: legacyAccount.password,
      password: "admin123",
    });

    if (!usesDefaultPassword) {
      return false;
    }

    await d1
      .prepare("update account set scope = ?1 where userId = ?2 and providerId = ?3")
      .bind(ADMIN_PASSWORD_CHANGE_SCOPE, userId, "credential")
      .run();

    return true;
  }

  return false;
}

export const getAdminPageDataAction = createServerFn({ method: "GET" })
  .inputValidator((path: string | undefined) => path ?? "")
  .handler(
    async ({
      data: path,
    }): Promise<{
      currentPath: string;
      files: StorageObject[];
      requiresPasswordChange: boolean;
      session: Session | null;
    }> => {
      const { getServerSession } = await import("@/lib/session.server");
      const session = await getServerSession();

      if (!session) {
        return {
          currentPath: path,
          files: [],
          requiresPasswordChange: false,
          session: null,
        };
      }

      const { listFiles } = await import("@/lib/storage.server");
      const [files, requiresPasswordChange] = await Promise.all([
        listFiles(path),
        getPasswordChangeStatus(session.user.id),
      ]);

      return {
        currentPath: path,
        files,
        requiresPasswordChange,
        session,
      };
    },
  );

export const changeAdminPasswordAction = createServerFn({ method: "POST" })
  .inputValidator((newPassword: string) => newPassword)
  .handler(async ({ data: newPassword }): Promise<void> => {
    const { requireServerSession } = await import("@/lib/session.server");
    const session = await requireServerSession();

    if (newPassword.length < 8) {
      throw new Error("Password must be at least 8 characters");
    }

    if (newPassword === "admin123") {
      throw new Error("Please choose a new password");
    }

    const { env } = await import("cloudflare:workers");
    const d1 = (env as any).D1_DB as D1Database | undefined;
    if (!d1) throw new Error("D1_DB binding not found");

    const { hashPassword } = await import("better-auth/crypto");
    const passwordHash = await hashPassword(newPassword);
    const updatedAt = new Date().toISOString();

    await d1
      .prepare(
        "update account set password = ?1, scope = null, updatedAt = ?2 where userId = ?3 and providerId = ?4",
      )
      .bind(passwordHash, updatedAt, session.user.id, "credential")
      .run();
  });

export const listFilesAction = createServerFn({ method: "GET" })
  .inputValidator((path: string | undefined) => path ?? "")
  .handler(async ({ data: path }): Promise<StorageObject[]> => {
    const { requireServerSession } = await import("@/lib/session.server");
    await requireServerSession();
    const { listFiles } = await import("@/lib/storage.server");
    return listFiles(path);
  });

export const listFoldersAction = createServerFn({ method: "GET" }).handler(
  async (): Promise<FolderOption[]> => {
    const { requireServerSession } = await import("@/lib/session.server");
    await requireServerSession();
    const { listFolders } = await import("@/lib/storage.server");
    return listFolders();
  },
);

export const deleteFileAction = createServerFn({ method: "POST" })
  .inputValidator((key: string) => key)
  .handler(async ({ data: key }): Promise<void> => {
    const { requireServerSession } = await import("@/lib/session.server");
    await requireServerSession();
    const { deleteFile } = await import("@/lib/storage.server");
    await deleteFile(key);
  });

export const uploadFileAction = createServerFn({ method: "POST" })
  .inputValidator((formData: FormData) => formData)
  .handler(async ({ data: formData }): Promise<{ key: string }> => {
    const { requireServerSession } = await import("@/lib/session.server");
    await requireServerSession();

    const file = formData.get("file") as File | null;
    if (!file || typeof file === "string") {
      throw new Error("Missing file");
    }

    const path = ((formData.get("path") as string | null) ?? "").trim();
    const normalizedPath = path.replace(/^\/+|\/+$/g, "");
    const key =
      (formData.get("key") as string | null) ??
      `${normalizedPath ? `${normalizedPath}/` : ""}${file.name}`;

    const { uploadFile } = await import("@/lib/storage.server");
    await uploadFile(key, file.stream(), file.type || "application/octet-stream");

    return { key };
  });

export const createFolderAction = createServerFn({ method: "POST" })
  .inputValidator((input: { folderName: string; path: string }) => input)
  .handler(async ({ data: { folderName, path } }): Promise<{ key: string }> => {
    const { requireServerSession } = await import("@/lib/session.server");
    await requireServerSession();

    const normalized = folderName.trim().replace(/^\/+|\/+$/g, "");
    if (!normalized) {
      throw new Error("Folder name is required");
    }

    const normalizedPath = path.trim().replace(/^\/+|\/+$/g, "");
    const key = `${normalizedPath ? `${normalizedPath}/` : ""}${normalized}/`;

    const { createFolder } = await import("@/lib/storage.server");
    await createFolder(key);

    return { key };
  });

export const moveFileAction = createServerFn({ method: "POST" })
  .inputValidator((input: { sourceKey: string; destinationPrefix: string }) => input)
  .handler(async ({ data: { sourceKey, destinationPrefix } }): Promise<{ key: string }> => {
    const { requireServerSession } = await import("@/lib/session.server");
    await requireServerSession();

    if (sourceKey.endsWith("/")) {
      throw new Error("Only files can be moved");
    }

    const { moveFile } = await import("@/lib/storage.server");
    const key = await moveFile(sourceKey, destinationPrefix);
    return { key };
  });
