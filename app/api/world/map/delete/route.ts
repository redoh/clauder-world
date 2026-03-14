import { auth } from "@/lib/auth"
import { getDb } from "@/lib/db"
import { headers } from "next/headers"

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user || session.user.role !== "admin") {
    return Response.json({ error: "forbidden" }, { status: 403 })
  }

  const { mapId } = (await req.json()) as { mapId: string }

  if (!mapId) {
    return Response.json({ error: "no map id provided" }, { status: 400 })
  }

  // Don't allow deleting built-in maps
  if (mapId === "city_map" || mapId === "dungeon_map") {
    return Response.json(
      { error: "cannot delete built-in maps" },
      { status: 400 }
    )
  }

  try {
    await getDb().savedMap.delete({ where: { id: mapId } })
  } catch {
    return Response.json({ error: "map not found" }, { status: 404 })
  }

  return Response.json({ success: true })
}
