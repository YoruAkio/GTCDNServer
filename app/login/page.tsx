import { redirect } from "next/navigation"

import LoginForm from "@/components/login-form"
import { getSession } from "@/lib/session"

export const dynamic = "force-dynamic"

export default async function LoginPage() {
  const session = await getSession()
  if (session) {
    redirect("/admin")
  }

  return <LoginForm />
}
