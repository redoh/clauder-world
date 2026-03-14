import { auth } from "@/lib/auth"
import { getDb } from "@/lib/db"
import { headers } from "next/headers"

export async function GET(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) {
    return Response.json({ error: "unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const id = searchParams.get("id")
  if (!id) {
    return Response.json({ error: "id is required" }, { status: 400 })
  }

  const map = await getDb().savedMap.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      mapData: true,
      createdAt: true,
      user: { select: { name: true } },
    },
  })

  if (!map) {
    return Response.json({ error: "not found" }, { status: 404 })
  }

  // Only owner or admin can view
  if (map.user.name !== session.user.name && session.user.role !== "admin") {
    return Response.json({ error: "forbidden" }, { status: 403 })
  }

  return Response.json({ map })
}
