import { createServerFn } from "@tanstack/react-start";
import type { FolderOption, StorageObject } from "@/lib/storage";
import { ADMIN_EMAIL } from "@/lib/constants";
import { getSession } from "@/lib/session";

const ADMIN_DEFAULT_PASSWORD = "admin123";

// @note guard: throws if no active session
async function requireAuth() {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");
  return session;
}

export const getPasswordStatusAction = createServerFn({
  method: "GET",
}).handler(async (): Promise<{ requiresPasswordChange: boolean }> => {
  await requireAuth();

  const { env } = await import("cloudflare:workers");
  const d1 = (env as any).D1_DB as D1Database | undefined;
  if (!d1) throw new Error("D1_DB binding not found");

  const account = await d1
    .prepare(
      "select account.password as password from account inner join user on user.id = account.userId where user.email = ?1 and account.providerId = ?2 limit 1",
    )
    .bind(ADMIN_EMAIL, "credential")
    .first<{ password: string | null }>();

  if (!account?.password) {
    return { requiresPasswordChange: true };
  }

  const { verifyPassword } = await import("better-auth/crypto");

  return {
    requiresPasswordChange: await verifyPassword({
      hash: account.password,
      password: ADMIN_DEFAULT_PASSWORD,
    }),
  };
});

export const changeAdminPasswordAction = createServerFn({ method: "POST" })
  .inputValidator((newPassword: string) => newPassword)
  .handler(async ({ data: newPassword }): Promise<void> => {
    const session = await requireAuth();

    if (newPassword.length < 8) {
      throw new Error("Password must be at least 8 characters");
    }

    if (newPassword === ADMIN_DEFAULT_PASSWORD) {
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
        "update account set password = ?1, updatedAt = ?2 where userId = ?3 and providerId = ?4",
      )
      .bind(passwordHash, updatedAt, session.user.id, "credential")
      .run();
  });

export const listFilesAction = createServerFn({ method: "GET" })
  .inputValidator((path: string | undefined) => path ?? "")
  .handler(async ({ data: path }): Promise<StorageObject[]> => {
    await requireAuth();
    const { listFiles } = await import("@/lib/storage.server");
    return listFiles(path);
  });

export const listFoldersAction = createServerFn({ method: "GET" }).handler(
  async (): Promise<FolderOption[]> => {
    await requireAuth();
    const { listFolders } = await import("@/lib/storage.server");
    return listFolders();
  },
);

export const deleteFileAction = createServerFn({ method: "POST" })
  .inputValidator((key: string) => key)
  .handler(async ({ data: key }): Promise<void> => {
    await requireAuth();
    const { deleteFile } = await import("@/lib/storage.server");
    await deleteFile(key);
  });

export const uploadFileAction = createServerFn({ method: "POST" })
  .inputValidator((formData: FormData) => formData)
  .handler(async ({ data: formData }): Promise<{ key: string }> => {
    await requireAuth();

    const file = formData.get("file") as File | null;
    if (!file || typeof file === "string") {
      throw new Error("Missing file");
    }

    const path = ((formData.get("path") as string | null) ?? "").trim();
    const normalizedPath = path.replace(/^\/+|\/+$/g, "");
    const key =
      (formData.get("key") as string | null) ??
      `${normalizedPath ? `${normalizedPath}/` : ""}${file.name}`;
    const buffer = await file.arrayBuffer();

    const { uploadFile } = await import("@/lib/storage.server");
    await uploadFile(key, buffer, file.type || "application/octet-stream");

    return { key };
  });

export const createFolderAction = createServerFn({ method: "POST" })
  .inputValidator((input: { folderName: string; path: string }) => input)
  .handler(async ({ data: { folderName, path } }): Promise<{ key: string }> => {
    await requireAuth();

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
  .inputValidator(
    (input: { sourceKey: string; destinationPrefix: string }) => input,
  )
  .handler(
    async ({
      data: { sourceKey, destinationPrefix },
    }): Promise<{ key: string }> => {
      await requireAuth();

      if (sourceKey.endsWith("/")) {
        throw new Error("Only files can be moved");
      }

      const { moveFile } = await import("@/lib/storage.server");
      const key = await moveFile(sourceKey, destinationPrefix);
      return { key };
    },
  );
