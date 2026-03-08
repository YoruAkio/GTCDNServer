import "server-only"

import {
  CopyObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3"
import { like } from "drizzle-orm"

import { db, schema } from "@/lib/db"
import type { FolderOption, StorageObject } from "@/lib/storage"

function normalizePrefix(prefix: string) {
  const trimmed = prefix.trim().replace(/^\/+|\/+$/g, "")
  return trimmed ? `${trimmed}/` : ""
}

function getFolderChain(path: string) {
  const normalized = normalizePrefix(path)
  const parts = normalized.split("/").filter(Boolean)
  return parts.map((_, index) => `${parts.slice(0, index + 1).join("/")}/`)
}

function sortEntries(entries: StorageObject[]) {
  return entries.toSorted((a, b) => {
    if (a.isFolder !== b.isFolder) {
      return a.isFolder ? -1 : 1
    }

    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
  })
}

async function getStorageClient() {
  return {
    bucket: process.env.R2_BUCKET!,
    client: new S3Client({
      region: process.env.R2_REGION || "auto",
      endpoint: process.env.R2_ENDPOINT,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
    }),
  }
}

async function upsertFolders(paths: string[]) {
  if (paths.length === 0) return

  const now = new Date()
  await db
    .insert(schema.folder)
    .values(paths.map((path) => ({ path, createdAt: now, updatedAt: now })))
    .onConflictDoUpdate({
      target: schema.folder.path,
      set: { updatedAt: now },
    })
}

async function removeFoldersByPrefix(prefix: string) {
  const normalizedPrefix = normalizePrefix(prefix)
  if (!normalizedPrefix) return

  await db
    .delete(schema.folder)
    .where(like(schema.folder.path, `${normalizedPrefix}%`))
}

function encodeCopySource(bucket: string, key: string) {
  return `${bucket}/${key.split("/").map(encodeURIComponent).join("/")}`
}

export async function listFiles(prefix = ""): Promise<StorageObject[]> {
  const normalizedPrefix = normalizePrefix(prefix)
  const { bucket, client } = await getStorageClient()
  const listed = await client.send(
    new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: normalizedPrefix,
      Delimiter: "/",
    })
  )

  const folders = (listed.CommonPrefixes ?? [])
    .map((folder) => folder.Prefix)
    .filter((folderKey): folderKey is string => Boolean(folderKey))
    .map<StorageObject>((folderKey) => ({
      key: folderKey,
      name: folderKey.slice(normalizedPrefix.length).replace(/\/$/, ""),
      size: 0,
      uploaded: new Date(0).toISOString(),
      isFolder: true,
    }))

  const files = (listed.Contents ?? [])
    .filter(
      (object) =>
        object.Key &&
        object.Key !== normalizedPrefix &&
        !object.Key.endsWith("/")
    )
    .map<StorageObject>((object) => ({
      key: object.Key as string,
      name: (object.Key as string).slice(normalizedPrefix.length),
      size: object.Size ?? 0,
      uploaded: object.LastModified?.toISOString() ?? new Date(0).toISOString(),
      isFolder: false,
    }))

  return sortEntries([...folders, ...files])
}

export async function listFolders(): Promise<FolderOption[]> {
  const folders = await db
    .select({ path: schema.folder.path })
    .from(schema.folder)

  return [
    { key: "", name: "Root" },
    ...(folders.map((folder) => ({
      key: folder.path,
      name: folder.path.slice(0, -1),
    })) as FolderOption[]),
  ]
}

export async function uploadFile(
  key: string,
  body: ReadableStream | ArrayBuffer,
  contentType: string
): Promise<void> {
  const { bucket, client } = await getStorageClient()
  const payload = body instanceof ArrayBuffer ? new Uint8Array(body) : body
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: payload,
      ContentType: contentType,
    })
  )
  await upsertFolders(getFolderChain(key))
}

export async function createFolder(key: string): Promise<void> {
  const normalizedKey = normalizePrefix(key)
  const { bucket, client } = await getStorageClient()
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: normalizedKey,
      Body: "",
      ContentType: "application/x-directory",
    })
  )

  await upsertFolders(getFolderChain(normalizedKey))
}

export async function deleteFile(key: string): Promise<void> {
  const { bucket, client } = await getStorageClient()

  if (key.endsWith("/")) {
    let continuationToken: string | undefined
    let deletedAny = false

    while (true) {
      const listed = await client.send(
        new ListObjectsV2Command({
          Bucket: bucket,
          Prefix: normalizePrefix(key),
          ContinuationToken: continuationToken,
        })
      )

      const objects = (listed.Contents ?? [])
        .map((item) => item.Key)
        .filter((item): item is string => Boolean(item))
        .map((item) => ({ Key: item }))

      if (objects.length > 0) {
        await client.send(
          new DeleteObjectsCommand({
            Bucket: bucket,
            Delete: { Objects: objects, Quiet: true },
          })
        )
        deletedAny = true
      }

      if (!listed.IsTruncated) {
        break
      }

      continuationToken = listed.NextContinuationToken
    }

    if (!deletedAny) {
      await client.send(
        new DeleteObjectCommand({ Bucket: bucket, Key: normalizePrefix(key) })
      )
    }

    await removeFoldersByPrefix(key)
    return
  }

  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))
}

export async function moveFile(
  sourceKey: string,
  destinationPrefix: string
): Promise<string> {
  const normalizedPrefix = normalizePrefix(destinationPrefix)
  const fileName = sourceKey.split("/").pop()
  if (!fileName) throw new Error("Invalid file key")

  const nextKey = `${normalizedPrefix}${fileName}`
  if (nextKey === sourceKey) {
    throw new Error("File is already in that folder")
  }

  const { bucket, client } = await getStorageClient()
  const object = await client.send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: sourceKey,
    })
  )

  if (!object.Body) {
    throw new Error("File not found")
  }

  await client.send(
    new CopyObjectCommand({
      Bucket: bucket,
      Key: nextKey,
      CopySource: encodeCopySource(bucket, sourceKey),
      ContentType: object.ContentType || "application/octet-stream",
      MetadataDirective: "REPLACE",
    })
  )

  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: sourceKey }))
  await upsertFolders(getFolderChain(nextKey))

  return nextKey
}
