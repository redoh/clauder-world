import { auth } from "@/lib/auth"
import { getDb } from "@/lib/db"
import { headers } from "next/headers"

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) {
    return Response.json({ error: "unauthorized" }, { status: 401 })
  }

  const body = await req.json()
  const { name, mapData } = body

  if (!name || typeof name !== "string" || !name.trim()) {
    return Response.json({ error: "name is required" }, { status: 400 })
  }

  // Accept both legend+grid format and cell array format
  const hasLegend = mapData?.legend && mapData?.grid
  const hasCells = mapData?.cells && Array.isArray(mapData.cells)
  if (!mapData || (!hasLegend && !hasCells)) {
    return Response.json(
      { error: "invalid map format: must have legend+grid or cells" },
      { status: 400 }
    )
  }

  const saved = await getDb().savedMap.create({
    data: {
      userId: session.user.id,
      name: name.trim(),
      mapData,
    },
  })

  return Response.json({ success: true, map: { id: saved.id, name: saved.name } })
}
