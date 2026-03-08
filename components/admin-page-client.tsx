"use client"

import { motion } from "framer-motion"
import {
  ChevronRight,
  FileText,
  FolderOpen,
  FolderPlus,
  FolderTree,
  MoveRight,
  Trash2,
  Upload,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useMemo, useRef, useState } from "react"

import Navbar from "@/components/navbar"
import { Button } from "@/components/ui/button"
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from "@/components/ui/modal"
import { authClient, type Session } from "@/lib/auth-client"
import type { FolderOption, StorageObject } from "@/lib/storage"

type AdminPageData = {
  currentPath: string
  files: StorageObject[]
  requiresPasswordChange: boolean
  session: Session
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

function formatUploadedDate(value: string, useLocalTime: boolean) {
  return new Intl.DateTimeFormat(useLocalTime ? undefined : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: useLocalTime ? undefined : "UTC",
  }).format(new Date(value))
}

function normalizePath(path: string) {
  return path.trim().replace(/^\/+|\/+$/g, "")
}

function getParentPath(path: string) {
  const normalized = normalizePath(path)
  if (!normalized) return ""

  const parts = normalized.split("/")
  parts.pop()
  return parts.join("/")
}

function getBreadcrumbs(path: string) {
  const normalized = normalizePath(path)
  if (!normalized) return [] as Array<{ label: string; path: string }>

  const parts = normalized.split("/")
  return parts.map((part, index) => ({
    label: part,
    path: parts.slice(0, index + 1).join("/"),
  }))
}

function formatFolderLabel(folder: FolderOption) {
  return folder.key ? folder.name : "/"
}

function mergeUploadQueue(current: File[], incoming: File[]) {
  const merged = [...current]

  for (const file of incoming) {
    const exists = merged.some(
      (item) =>
        item.name === file.name &&
        item.size === file.size &&
        item.lastModified === file.lastModified
    )

    if (!exists) {
      merged.push(file)
    }
  }

  return merged
}

async function fetchJson<T>(
  input: RequestInfo,
  init?: RequestInit
): Promise<T> {
  const response = await fetch(input, {
    cache: "no-store",
    ...init,
  })

  if (!response.ok) {
    const errorBody = (await response.json().catch(() => null)) as {
      error?: string
    } | null
    throw new Error(errorBody?.error || "Request failed")
  }

  return response.json() as Promise<T>
}

export default function AdminPageClient({
  initialData,
}: {
  initialData: AdminPageData
}) {
  const ITEMS_PER_PAGE = 20
  const router = useRouter()
  const [useLocalTime, setUseLocalTime] = useState(false)

  const [files, setFiles] = useState<StorageObject[]>(initialData.files)
  const [folders, setFolders] = useState<FolderOption[]>([])
  const [requiresPasswordChange, setRequiresPasswordChange] = useState(
    initialData.requiresPasswordChange
  )
  const [uploading, setUploading] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const [draggingFileKey, setDraggingFileKey] = useState<string | null>(null)
  const [dragOverFolderKey, setDragOverFolderKey] = useState<string | null>(
    null
  )
  const [dragOverBreadcrumbPath, setDragOverBreadcrumbPath] = useState<
    string | null
  >(null)
  const [creatingFolder, setCreatingFolder] = useState(false)
  const [movingFile, setMovingFile] = useState(false)
  const [deletingKey, setDeletingKey] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<StorageObject | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [page, setPage] = useState(1)
  const [folderModalOpen, setFolderModalOpen] = useState(false)
  const [folderName, setFolderName] = useState("")
  const [folderError, setFolderError] = useState<string | null>(null)
  const [uploadModalOpen, setUploadModalOpen] = useState(false)
  const [uploadDestination, setUploadDestination] = useState("")
  const [uploadQueue, setUploadQueue] = useState<File[]>([])
  const [uploadProgress, setUploadProgress] = useState(0)
  const [moveModalOpen, setMoveModalOpen] = useState(false)
  const [moveFileKey, setMoveFileKey] = useState<string | null>(null)
  const [moveDestination, setMoveDestination] = useState("")
  const [moveError, setMoveError] = useState<string | null>(null)
  const [passwordModalOpen, setPasswordModalOpen] = useState(false)
  const [newPassword, setNewPassword] = useState("")
  const [changingPassword, setChangingPassword] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setFiles(initialData.files)
  }, [initialData.files])

  useEffect(() => {
    setRequiresPasswordChange(initialData.requiresPasswordChange)
  }, [initialData.requiresPasswordChange])

  useEffect(() => {
    setSearchQuery("")
    setPage(1)
  }, [initialData.currentPath])

  const currentPath = normalizePath(initialData.currentPath)
  const breadcrumbs = getBreadcrumbs(currentPath)
  const filteredFiles = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return files

    return files.filter((file) => file.name.toLowerCase().includes(query))
  }, [files, searchQuery])
  const totalPages = Math.max(
    1,
    Math.ceil(filteredFiles.length / ITEMS_PER_PAGE)
  )
  const paginatedFiles = useMemo(() => {
    const start = (page - 1) * ITEMS_PER_PAGE
    return filteredFiles.slice(start, start + ITEMS_PER_PAGE)
  }, [filteredFiles, page])

  useEffect(() => {
    setPage((current) => Math.min(current, totalPages))
  }, [totalPages])

  useEffect(() => {
    setUseLocalTime(true)
  }, [])

  async function refresh() {
    const nextFiles = await fetchJson<StorageObject[]>(
      `/api/admin/files?path=${encodeURIComponent(currentPath)}`
    )
    setFiles(nextFiles)
  }

  async function loadFolders() {
    const nextFolders = await fetchJson<FolderOption[]>("/api/admin/folders")
    setFolders(nextFolders)
    return nextFolders
  }

  async function navigateToPath(path: string) {
    const normalized = normalizePath(path)
    router.push(
      normalized ? `/admin?path=${encodeURIComponent(normalized)}` : "/admin"
    )
  }

  async function uploadFiles(filesToUpload: File[]) {
    return uploadFilesToPath(filesToUpload, currentPath)
  }

  async function uploadFilesToPath(
    filesToUpload: File[],
    destinationPath: string
  ) {
    if (filesToUpload.length === 0) return false

    setError(null)
    setUploading(true)
    setUploadProgress(0)

    try {
      for (const [index, file] of filesToUpload.entries()) {
        const body = new FormData()
        body.append("file", file)
        body.append("path", destinationPath)
        await fetchJson("/api/admin/upload", { method: "POST", body })
        setUploadProgress(
          Math.round(((index + 1) / filesToUpload.length) * 100)
        )
      }

      await refresh()
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed")
      return false
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
      setDragActive(false)
    }
  }

  async function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setDragOverFolderKey(null)

    if (event.dataTransfer.types.includes("application/x-gtcdn-file-key")) {
      setDragActive(false)
      return
    }

    const droppedFiles = Array.from(event.dataTransfer.files ?? [])
    await uploadFiles(droppedFiles)
  }

  async function openUploadModal() {
    setError(null)
    setUploadQueue([])
    setUploadProgress(0)
    setUploadDestination(currentPath)
    await loadFolders()
    setUploadModalOpen(true)
  }

  function handleUploadQueueChange(event: React.ChangeEvent<HTMLInputElement>) {
    const nextFiles = Array.from(event.target.files ?? [])
    if (nextFiles.length === 0) return

    setUploadQueue((current) => mergeUploadQueue(current, nextFiles))
    event.target.value = ""
  }

  function removeUploadQueueItem(fileToRemove: File) {
    setUploadQueue((current) =>
      current.filter(
        (file) =>
          !(
            file.name === fileToRemove.name &&
            file.size === fileToRemove.size &&
            file.lastModified === fileToRemove.lastModified
          )
      )
    )
  }

  async function handleMoveToFolder(destinationKey: string) {
    if (!draggingFileKey) return

    setError(null)
    setMovingFile(true)

    try {
      await fetchJson("/api/admin/move", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sourceKey: draggingFileKey,
          destinationPrefix: destinationKey,
        }),
      })
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to move file")
    } finally {
      setMovingFile(false)
      setDraggingFileKey(null)
      setDragOverFolderKey(null)
      setDragOverBreadcrumbPath(null)
    }
  }

  async function handleDelete(key: string) {
    setError(null)
    setDeletingKey(key)

    try {
      await fetchJson("/api/admin/files", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ key }),
      })
      if (key.endsWith("/")) {
        setFolders((prev) =>
          prev.filter(
            (folder) => !(folder.key === key || folder.key.startsWith(key))
          )
        )
      }
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed")
    } finally {
      setDeletingKey(null)
    }
  }

  async function handleSignOut() {
    await authClient.signOut()
    router.push("/login")
    router.refresh()
  }

  async function handleUploadSubmit(event: React.FormEvent) {
    event.preventDefault()
    const ok = await uploadFilesToPath(uploadQueue, uploadDestination)
    if (!ok) return
    setUploadQueue([])
    setUploadModalOpen(false)
  }

  async function openMoveModal(fileKey: string) {
    setMoveError(null)
    setMoveFileKey(fileKey)
    setMoveDestination(currentPath)
    await loadFolders()
    setMoveModalOpen(true)
  }

  async function handleCreateFolder(event: React.FormEvent) {
    event.preventDefault()
    setFolderError(null)
    setCreatingFolder(true)

    try {
      await fetchJson("/api/admin/folders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          folderName,
          path: currentPath,
        }),
      })
      setFolderModalOpen(false)
      setFolders((prev) => {
        const nextKey = `${currentPath ? `${currentPath}/` : ""}${folderName.trim().replace(/^\/+|\/+$/g, "")}/`
        if (!nextKey || prev.some((folder) => folder.key === nextKey))
          return prev
        return [...prev, { key: nextKey, name: nextKey.slice(0, -1) }]
      })
      await refresh()
    } catch (err) {
      setFolderError(
        err instanceof Error ? err.message : "Failed to create folder"
      )
    } finally {
      setCreatingFolder(false)
    }
  }

  async function handleMoveFile(event: React.FormEvent) {
    event.preventDefault()
    if (!moveFileKey) return

    setMoveError(null)
    setMovingFile(true)

    try {
      await fetchJson("/api/admin/move", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sourceKey: moveFileKey,
          destinationPrefix: moveDestination,
        }),
      })
      setMoveModalOpen(false)
      setMoveFileKey(null)
      await refresh()
    } catch (err) {
      setMoveError(err instanceof Error ? err.message : "Failed to move file")
    } finally {
      setMovingFile(false)
    }
  }

  async function handlePasswordChange(event: React.FormEvent) {
    event.preventDefault()
    setPasswordError(null)
    setChangingPassword(true)

    try {
      await fetchJson("/api/admin/password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password: newPassword }),
      })
      setNewPassword("")
      setRequiresPasswordChange(false)
      setPasswordModalOpen(false)
    } catch (err) {
      setPasswordError(
        err instanceof Error ? err.message : "Failed to update password"
      )
    } finally {
      setChangingPassword(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar
        adminProfile={{
          name: initialData.session.user.name ?? "Admin",
          email: initialData.session.user.email ?? "-",
          onChangePassword: () => setPasswordModalOpen(true),
          onSignOut: handleSignOut,
        }}
      />

      <Modal
        open={requiresPasswordChange || passwordModalOpen}
        onOpenChange={setPasswordModalOpen}
        dismissible={!requiresPasswordChange}
      >
        <ModalContent>
          <ModalHeader>
            <div className="space-y-2">
              <ModalTitle>
                {requiresPasswordChange
                  ? "Change default password"
                  : "Change password"}
              </ModalTitle>
              <ModalDescription>
                {requiresPasswordChange
                  ? "Your account is still using the default password. You must set a new password before continuing."
                  : "Set a new password for the admin account."}
              </ModalDescription>
            </div>

            {!requiresPasswordChange ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setPasswordModalOpen(false)}
              >
                Close
              </Button>
            ) : null}
          </ModalHeader>

          <form onSubmit={handlePasswordChange}>
            <ModalBody>
              <div className="space-y-2">
                <label
                  htmlFor="new-password"
                  className="block text-sm font-medium text-foreground"
                >
                  New password
                </label>
                <input
                  id="new-password"
                  type="password"
                  required
                  minLength={8}
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground transition-colors outline-none placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/50"
                  placeholder="Enter a new password"
                />
              </div>

              {passwordError ? (
                <p className="text-sm text-destructive">{passwordError}</p>
              ) : null}
            </ModalBody>

            <ModalFooter className="justify-end">
              <Button type="submit" disabled={changingPassword}>
                {changingPassword ? "Updating password..." : "Update password"}
              </Button>
            </ModalFooter>
          </form>
        </ModalContent>
      </Modal>

      <Modal open={folderModalOpen} onOpenChange={setFolderModalOpen}>
        <ModalContent>
          <ModalHeader>
            <div className="space-y-2">
              <ModalTitle>Create folder</ModalTitle>
              <ModalDescription>
                Create a folder in the current location. Nested names like
                `cache/images` also work.
              </ModalDescription>
            </div>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setFolderModalOpen(false)}
            >
              Close
            </Button>
          </ModalHeader>

          <form onSubmit={handleCreateFolder}>
            <ModalBody>
              <div className="space-y-2">
                <label
                  htmlFor="folder-name"
                  className="block text-sm font-medium text-foreground"
                >
                  Folder name
                </label>
                <input
                  id="folder-name"
                  type="text"
                  required
                  value={folderName}
                  onChange={(event) => setFolderName(event.target.value)}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground transition-colors outline-none placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/50"
                  placeholder="example-folder"
                />
              </div>

              {folderError ? (
                <p className="text-sm text-destructive">{folderError}</p>
              ) : null}
            </ModalBody>

            <ModalFooter>
              <Button type="submit" disabled={creatingFolder}>
                {creatingFolder ? "Creating folder..." : "Create folder"}
              </Button>
            </ModalFooter>
          </form>
        </ModalContent>
      </Modal>

      <Modal open={uploadModalOpen} onOpenChange={setUploadModalOpen}>
        <ModalContent>
          <ModalHeader>
            <div className="space-y-2">
              <ModalTitle>Upload files</ModalTitle>
              <ModalDescription>
                Choose files, then select which folder should receive them
                before starting the upload.
              </ModalDescription>
            </div>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setUploadModalOpen(false)}
            >
              Close
            </Button>
          </ModalHeader>

          <form onSubmit={handleUploadSubmit}>
            <ModalBody>
              <div className="space-y-2">
                <label
                  htmlFor="upload-destination"
                  className="block text-sm font-medium text-foreground"
                >
                  Destination folder
                </label>
                <select
                  id="upload-destination"
                  value={uploadDestination}
                  onChange={(event) => setUploadDestination(event.target.value)}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground transition-colors outline-none focus:border-ring focus:ring-2 focus:ring-ring/50"
                  disabled={uploading}
                >
                  {folders.map((folder) => (
                    <option
                      key={folder.key || "root"}
                      value={folder.key.slice(0, -1)}
                    >
                      {formatFolderLabel(folder)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="upload-files"
                  className="block text-sm font-medium text-foreground"
                >
                  Files
                </label>
                <input
                  id="upload-files"
                  ref={fileInputRef}
                  type="file"
                  multiple
                  onChange={handleUploadQueueChange}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-2 file:text-foreground"
                  disabled={uploading}
                />
                {uploadQueue.length > 0 ? (
                  <div className="space-y-2 rounded-lg border border-border bg-muted/40 px-3 py-2">
                    <p className="text-sm text-muted-foreground">
                      {uploadQueue.length} file
                      {uploadQueue.length === 1 ? "" : "s"} selected
                    </p>
                    <div className="upload-queue-scroll max-h-40 space-y-2 overflow-auto pr-1">
                      {uploadQueue.map((file) => (
                        <div
                          key={`${file.name}-${file.size}-${file.lastModified}`}
                          className="flex items-center justify-between gap-3 rounded-md bg-background/70 px-2 py-1.5 text-sm"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-foreground">
                              {file.name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatBytes(file.size)}
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="xs"
                            onClick={() => removeUploadQueueItem(file)}
                            disabled={uploading}
                          >
                            Remove
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>

              {uploading ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>Uploading</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <motion.div
                      className="h-full rounded-full bg-primary"
                      animate={{ width: `${uploadProgress}%` }}
                      transition={{ duration: 0.2, ease: "easeOut" }}
                    />
                  </div>
                </div>
              ) : null}
            </ModalBody>

            <ModalFooter>
              <Button
                type="submit"
                disabled={uploading || uploadQueue.length === 0}
              >
                {uploading ? "Uploading..." : "Continue Upload"}
              </Button>
            </ModalFooter>
          </form>
        </ModalContent>
      </Modal>

      <Modal open={moveModalOpen} onOpenChange={setMoveModalOpen}>
        <ModalContent>
          <ModalHeader>
            <div className="space-y-2">
              <ModalTitle>Move file</ModalTitle>
              <ModalDescription>
                Choose the destination folder for `
                {moveFileKey?.split("/").pop()}`.
              </ModalDescription>
            </div>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setMoveModalOpen(false)}
            >
              Close
            </Button>
          </ModalHeader>

          <form onSubmit={handleMoveFile}>
            <ModalBody>
              <div className="space-y-2">
                <label
                  htmlFor="move-destination"
                  className="block text-sm font-medium text-foreground"
                >
                  Destination folder
                </label>
                <select
                  id="move-destination"
                  value={moveDestination}
                  onChange={(event) => setMoveDestination(event.target.value)}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground transition-colors outline-none focus:border-ring focus:ring-2 focus:ring-ring/50"
                >
                  {folders.map((folder) => (
                    <option
                      key={folder.key || "root"}
                      value={folder.key.slice(0, -1)}
                    >
                      {formatFolderLabel(folder)}
                    </option>
                  ))}
                </select>
              </div>

              {moveError ? (
                <p className="text-sm text-destructive">{moveError}</p>
              ) : null}
            </ModalBody>

            <ModalFooter>
              <Button type="submit" disabled={movingFile}>
                {movingFile ? "Moving file..." : "Move file"}
              </Button>
            </ModalFooter>
          </form>
        </ModalContent>
      </Modal>

      <Modal
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <ModalContent className="max-w-sm">
          <ModalHeader className="block space-y-2">
            <ModalTitle>
              Delete {deleteTarget?.isFolder ? "folder" : "file"}?
            </ModalTitle>
            <ModalDescription>
              {deleteTarget?.isFolder
                ? `This will permanently remove ${deleteTarget.name} and all contents inside it.`
                : `This will permanently remove ${deleteTarget?.name}.`}
            </ModalDescription>
          </ModalHeader>

          <ModalFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setDeleteTarget(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deletingKey === deleteTarget?.key}
              onClick={async () => {
                if (!deleteTarget) return
                await handleDelete(deleteTarget.key)
                setDeleteTarget(null)
              }}
            >
              {deletingKey === deleteTarget?.key ? "Deleting..." : "Delete"}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <motion.main
        className="mx-auto max-w-5xl space-y-8 px-6 py-10"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.24, ease: "easeOut" }}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <button
                type="button"
                className={`rounded-md px-2 py-1 transition-colors hover:text-foreground ${dragOverBreadcrumbPath === "" ? "bg-primary/10 text-foreground" : ""}`}
                onClick={() => navigateToPath("")}
                onDragOver={(event) => {
                  if (!draggingFileKey) return
                  event.preventDefault()
                  event.dataTransfer.dropEffect = "move"
                  setDragOverBreadcrumbPath("")
                }}
                onDragLeave={() => {
                  if (dragOverBreadcrumbPath === "")
                    setDragOverBreadcrumbPath(null)
                }}
                onDrop={async (event) => {
                  if (!draggingFileKey) return
                  event.preventDefault()
                  await handleMoveToFolder("")
                }}
              >
                /
              </button>
              {breadcrumbs.map((crumb) => (
                <div key={crumb.path} className="flex items-center gap-2">
                  <ChevronRight className="size-3.5" />
                  <button
                    type="button"
                    className={`rounded-md px-2 py-1 transition-colors hover:text-foreground ${dragOverBreadcrumbPath === crumb.path ? "bg-primary/10 text-foreground" : ""}`}
                    onClick={() => navigateToPath(crumb.path)}
                    onDragOver={(event) => {
                      if (!draggingFileKey) return
                      event.preventDefault()
                      event.dataTransfer.dropEffect = "move"
                      setDragOverBreadcrumbPath(crumb.path)
                    }}
                    onDragLeave={() => {
                      if (dragOverBreadcrumbPath === crumb.path)
                        setDragOverBreadcrumbPath(null)
                    }}
                    onDrop={async (event) => {
                      if (!draggingFileKey) return
                      event.preventDefault()
                      await handleMoveToFolder(crumb.path)
                    }}
                  >
                    {crumb.label}
                  </button>
                </div>
              ))}
            </div>

            <div>
              <h1 className="text-xl font-semibold text-foreground">
                File Manager
              </h1>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {currentPath ? `Inside ${currentPath}` : "Root directory"} -{" "}
                {filteredFiles.length}{" "}
                {filteredFiles.length === 1 ? "item" : "items"}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setFolderModalOpen(true)}
            >
              <FolderPlus className="size-3.5" />
              New Folder
            </Button>
            <Button onClick={openUploadModal} disabled={uploading} size="sm">
              <Upload className="size-3.5" />
              {uploading ? "Uploading..." : "Upload"}
            </Button>
          </div>
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <section
          className={`rounded-2xl border transition-colors ${dragActive ? "border-primary bg-primary/5" : "border-border bg-card"}`}
          onDragEnter={(event) => {
            event.preventDefault()
            if (
              event.dataTransfer.types.includes("application/x-gtcdn-file-key")
            )
              return
            setDragActive(true)
          }}
          onDragOver={(event) => {
            event.preventDefault()
            if (
              event.dataTransfer.types.includes("application/x-gtcdn-file-key")
            )
              return
            setDragActive(true)
          }}
          onDragLeave={(event) => {
            event.preventDefault()
            if (event.currentTarget === event.target) setDragActive(false)
          }}
          onDrop={handleDrop}
        >
          <div className="border-b border-border px-4 py-3">
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => {
                setSearchQuery(event.target.value)
                setPage(1)
              }}
              placeholder="Search files and folders"
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground transition-colors outline-none placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/50"
            />
          </div>
          {filteredFiles.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 px-6 py-20 text-muted-foreground">
              <FolderOpen className="size-8 opacity-40" />
              <p className="text-sm">
                {searchQuery
                  ? "No items match your search."
                  : "This folder is empty. Upload files or create a new folder."}
              </p>
            </div>
          ) : (
            <div className="overflow-hidden">
              {currentPath && page === 1 && !searchQuery ? (
                <div
                  className={`px-4 py-3 ${paginatedFiles.length > 0 ? "border-b border-border" : ""} ${dragOverFolderKey === ".." ? "bg-primary/10" : ""}`}
                  onDragOver={(event) => {
                    if (!draggingFileKey) return
                    event.preventDefault()
                    event.dataTransfer.dropEffect = "move"
                    setDragOverFolderKey("..")
                  }}
                  onDragLeave={() => {
                    if (dragOverFolderKey === "..") {
                      setDragOverFolderKey(null)
                    }
                  }}
                  onDrop={async (event) => {
                    if (!draggingFileKey) return
                    event.preventDefault()
                    await handleMoveToFolder(getParentPath(currentPath))
                  }}
                >
                  <button
                    type="button"
                    className="flex w-full items-center gap-4 text-left"
                    onClick={() => navigateToPath(getParentPath(currentPath))}
                  >
                    <FolderOpen
                      className="size-4 shrink-0 text-muted-foreground"
                      strokeWidth={1.5}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        ...
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Up one folder
                      </p>
                    </div>
                  </button>
                </div>
              ) : null}

              {paginatedFiles.map((file, index) => (
                <div
                  key={file.key}
                  className={`group flex items-center gap-4 px-4 py-3 ${index !== paginatedFiles.length - 1 ? "border-b border-border" : ""} ${file.isFolder && dragOverFolderKey === file.key ? "bg-primary/10" : ""}`}
                  onDragOver={(event) => {
                    if (!file.isFolder || !draggingFileKey) return
                    event.preventDefault()
                    event.dataTransfer.dropEffect = "move"
                    setDragOverFolderKey(file.key)
                  }}
                  onDragLeave={() => {
                    if (dragOverFolderKey === file.key) {
                      setDragOverFolderKey(null)
                    }
                  }}
                  onDrop={async (event) => {
                    if (!file.isFolder || !draggingFileKey) return
                    event.preventDefault()
                    await handleMoveToFolder(file.key)
                  }}
                >
                  {file.isFolder ? (
                    <FolderTree
                      className="size-4 shrink-0 text-muted-foreground"
                      strokeWidth={1.5}
                    />
                  ) : (
                    <button
                      type="button"
                      draggable
                      onDragStart={(event) => {
                        event.dataTransfer.effectAllowed = "move"
                        event.dataTransfer.setData(
                          "application/x-gtcdn-file-key",
                          file.key
                        )
                        event.dataTransfer.setData("text/plain", file.key)
                        setDraggingFileKey(file.key)
                      }}
                      onDragEnd={() => {
                        setDraggingFileKey(null)
                        setDragOverFolderKey(null)
                        setDragOverBreadcrumbPath(null)
                      }}
                      className="shrink-0 cursor-grab active:cursor-grabbing"
                      title="Drag to move file"
                    >
                      <FileText
                        className="size-4 text-muted-foreground"
                        strokeWidth={1.5}
                      />
                    </button>
                  )}

                  <div className="min-w-0 flex-1">
                    {file.isFolder ? (
                      <button
                        type="button"
                        className="truncate text-left text-sm font-medium text-foreground hover:text-primary"
                        onClick={() => navigateToPath(file.key)}
                      >
                        {file.name}
                      </button>
                    ) : (
                      <p className="truncate text-sm font-medium text-foreground">
                        {file.name}
                      </p>
                    )}

                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {file.isFolder ? "Folder" : formatBytes(file.size)}{" "}
                      &middot;{" "}
                      {file.isFolder && file.uploaded.startsWith("1970-")
                        ? "Open folder"
                        : formatUploadedDate(file.uploaded, useLocalTime)}
                    </p>
                  </div>

                  {!file.isFolder ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => openMoveModal(file.key)}
                      title="Move file"
                      className="shrink-0 text-muted-foreground hover:text-foreground md:hidden"
                    >
                      <MoveRight className="size-3.5" />
                    </Button>
                  ) : null}

                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setDeleteTarget(file)}
                    disabled={deletingKey === file.key}
                    title={file.isFolder ? "Delete folder" : "Delete file"}
                    className="shrink-0 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {filteredFiles.length > ITEMS_PER_PAGE ? (
            <div className="flex items-center justify-between border-t border-border px-4 py-3 text-sm text-muted-foreground">
              <span>
                Page {page} of {totalPages}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={page === 1}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                >
                  Previous
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={page === totalPages}
                  onClick={() =>
                    setPage((current) => Math.min(totalPages, current + 1))
                  }
                >
                  Next
                </Button>
              </div>
            </div>
          ) : null}
        </section>
      </motion.main>
    </div>
  )
}
