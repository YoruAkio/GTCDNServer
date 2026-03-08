import { redirect } from "next/navigation"

import AdminPageClient from "@/components/admin-page-client"
import { getAdminPageData } from "@/lib/admin"

export const dynamic = "force-dynamic"

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const path = typeof params.path === "string" ? params.path : ""
  const data = await getAdminPageData(path)

  if (!data) {
    redirect("/login")
  }

  return <AdminPageClient initialData={data} />
}
