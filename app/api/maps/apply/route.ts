import { auth } from "@/lib/auth"
import { getDb } from "@/lib/db"
import { headers } from "next/headers"

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user || session.user.role !== "admin") {
    return Response.json({ error: "forbidden" }, { status: 403 })
  }

  const { mapId } = await req.json()
  if (!mapId) {
    return Response.json({ error: "mapId is required" }, { status: 400 })
  }

  const savedMap = await getDb().savedMap.findUnique({ where: { id: mapId } })
  if (!savedMap) {
    return Response.json({ error: "not found" }, { status: 404 })
  }

  // Mark as published so it appears in the world map list
  await getDb().savedMap.update({
    where: { id: mapId },
    data: { published: true },
  })

  return Response.json({ success: true, fileId: mapId })
}
