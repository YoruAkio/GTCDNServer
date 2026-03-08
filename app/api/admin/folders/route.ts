import { NextResponse } from "next/server"

import { jsonError } from "@/lib/http"
import { requireRequestSession } from "@/lib/session"
import { createFolder, listFolders } from "@/lib/storage-server"

export async function GET(request: Request) {
  try {
    await requireRequestSession(request)
    return NextResponse.json(await listFolders())
  } catch (error) {
    return jsonError(error, 401)
  }
}

export async function POST(request: Request) {
  try {
    await requireRequestSession(request)
    const body = (await request.json()) as {
      folderName?: string
      path?: string
    }
    const folderName = body.folderName?.trim().replace(/^\/+|\/+$/g, "") ?? ""
    const currentPath = body.path?.trim().replace(/^\/+|\/+$/g, "") ?? ""

    if (!folderName) {
      return jsonError("Folder name is required", 400)
    }

    const key = `${currentPath ? `${currentPath}/` : ""}${folderName}/`
    await createFolder(key)
    return NextResponse.json({ key })
  } catch (error) {
    return jsonError(error, 400)
  }
}
