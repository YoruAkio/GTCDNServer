import { NextResponse } from "next/server"

import { jsonError } from "@/lib/http"
import { requireRequestSession } from "@/lib/session"
import { uploadFile } from "@/lib/storage-server"

export async function POST(request: Request) {
  try {
    await requireRequestSession(request)
    const formData = await request.formData()
    const file = formData.get("file")

    if (!(file instanceof File)) {
      return jsonError("Missing file", 400)
    }

    const path = ((formData.get("path") as string | null) ?? "").trim()
    const normalizedPath = path.replace(/^\/+|\/+$/g, "")
    const key =
      (formData.get("key") as string | null) ??
      `${normalizedPath ? `${normalizedPath}/` : ""}${file.name}`

    const uploadedKey = await uploadFile(
      key,
      await file.arrayBuffer(),
      file.type || "application/octet-stream"
    )
    return NextResponse.json({ key: uploadedKey })
  } catch (error) {
    return jsonError(error, 400)
  }
}
