import { redirect } from "next/navigation"

import HomePage from "@/components/home-page"
import { getSession } from "@/lib/session"

export const dynamic = "force-dynamic"

export default async function Page() {
  const session = await getSession()
  if (session) {
    redirect("/admin")
  }

  return <HomePage />
}
