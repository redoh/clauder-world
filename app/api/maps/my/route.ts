import { auth } from "@/lib/auth"
import { getDb } from "@/lib/db"
import { headers } from "next/headers"

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) {
    return Response.json({ error: "unauthorized" }, { status: 401 })
  }

  const maps = await getDb().savedMap.findMany({
    where: { userId: session.user.id },
    select: { id: true, name: true, createdAt: true, updatedAt: true },
    orderBy: { updatedAt: "desc" },
  })

  return Response.json({ maps })
}
