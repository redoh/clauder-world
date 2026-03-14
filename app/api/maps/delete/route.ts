import { auth } from "@/lib/auth"
import { getDb } from "@/lib/db"
import { headers } from "next/headers"

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) {
    return Response.json({ error: "unauthorized" }, { status: 401 })
  }

  const { mapId } = await req.json()
  if (!mapId) {
    return Response.json({ error: "mapId is required" }, { status: 400 })
  }

  const map = await getDb().savedMap.findUnique({ where: { id: mapId } })
  if (!map) {
    return Response.json({ error: "not found" }, { status: 404 })
  }

  // Only owner or admin can delete
  if (map.userId !== session.user.id && session.user.role !== "admin") {
    return Response.json({ error: "forbidden" }, { status: 403 })
  }

  await getDb().savedMap.delete({ where: { id: mapId } })

  return Response.json({ success: true })
}
