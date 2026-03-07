import "@tanstack/react-start/server-only";

import { env } from "cloudflare:workers";

import type { FolderOption, StorageObject } from "./storage";

function getBucket(): R2Bucket {
  const bucket = (env as any).R2_DB as R2Bucket | undefined;
  if (!bucket) throw new Error("R2_DB binding not found");
  return bucket;
}

function normalizePrefix(prefix: string) {
  const trimmed = prefix.trim().replace(/^\/+|\/+$/g, "");
  return trimmed ? `${trimmed}/` : "";
}

function sortEntries(entries: StorageObject[]) {
  return [...entries].sort((a, b) => {
    if (a.isFolder !== b.isFolder) {
      return a.isFolder ? -1 : 1;
    }

    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });
}

async function listAllKeys(prefix = "") {
  const bucket = getBucket();
  const normalizedPrefix = normalizePrefix(prefix);
  const keys: string[] = [];
  let cursor: string | undefined;

  while (true) {
    const listed = await bucket.list({ prefix: normalizedPrefix, cursor });
    keys.push(...listed.objects.map(object => object.key));

    if (!listed.truncated) break;
    cursor = listed.cursor;
  }

  return keys;
}

export async function listFiles(prefix = ""): Promise<StorageObject[]> {
  const bucket = getBucket();
  const normalizedPrefix = normalizePrefix(prefix);
  const listed = await bucket.list({
    prefix: normalizedPrefix,
    delimiter: "/",
  });

  const folders = (listed.delimitedPrefixes ?? []).map<StorageObject>(
    folderKey => ({
      key: folderKey,
      name: folderKey.slice(normalizedPrefix.length).replace(/\/$/, ""),
      size: 0,
      uploaded: new Date(0).toISOString(),
      isFolder: true,
    }),
  );

  const files = listed.objects
    .filter(
      object => object.key !== normalizedPrefix && !object.key.endsWith("/"),
    )
    .map<StorageObject>(object => ({
      key: object.key,
      name: object.key.slice(normalizedPrefix.length),
      size: object.size,
      uploaded: object.uploaded.toISOString(),
      isFolder: false,
    }));

  return sortEntries([...folders, ...files]);
}

export async function listFolders(): Promise<FolderOption[]> {
  const keys = await listAllKeys();
  const folders = new Set<string>([""]);

  for (const key of keys) {
    const cleanKey = key.endsWith("/") ? key.slice(0, -1) : key;
    const parts = cleanKey.split("/").filter(Boolean);

    if (key.endsWith("/")) {
      folders.add(`${cleanKey}/`);
    }

    for (let index = 1; index < parts.length; index += 1) {
      folders.add(`${parts.slice(0, index).join("/")}/`);
    }
  }

  return [...folders]
    .map<FolderOption>(key => ({
      key,
      name: key ? key.slice(0, -1) : "Root",
    }))
    .sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
    );
}

export async function uploadFile(
  key: string,
  body: ReadableStream | ArrayBuffer,
  contentType: string,
): Promise<void> {
  const bucket = getBucket();
  await bucket.put(key, body, { httpMetadata: { contentType } });
}

export async function createFolder(key: string): Promise<void> {
  const bucket = getBucket();
  await bucket.put(key, new Uint8Array(0), {
    httpMetadata: { contentType: "application/x-directory" },
  });
}

export async function deleteFile(key: string): Promise<void> {
  const bucket = getBucket();
  if (key.endsWith("/")) {
    const keys = await listAllKeys(key);
    const deleteKeys = keys.length > 0 ? keys : [key];
    await bucket.delete(deleteKeys as any);
    return;
  }

  await bucket.delete(key);
}

export async function moveFile(
  sourceKey: string,
  destinationPrefix: string,
): Promise<string> {
  const bucket = getBucket();
  const normalizedPrefix = normalizePrefix(destinationPrefix);
  const fileName = sourceKey.split("/").pop();

  if (!fileName) throw new Error("Invalid file key");

  const nextKey = `${normalizedPrefix}${fileName}`;
  if (nextKey === sourceKey) {
    throw new Error("File is already in that folder");
  }

  const object = await bucket.get(sourceKey);
  if (!object?.body) {
    throw new Error("File not found");
  }

  await bucket.put(nextKey, object.body, {
    httpMetadata: {
      contentType:
        object.httpMetadata?.contentType || "application/octet-stream",
    },
  });

  await bucket.delete(sourceKey);

  return nextKey;
}
