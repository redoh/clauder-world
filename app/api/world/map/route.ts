import { pubby } from "@/lib/pubby-server"
import { auth } from "@/lib/auth"
import { getDb } from "@/lib/db"
import { headers } from "next/headers"

const BUILT_IN_MAPS = ["city_map", "dungeon_map"]

// Current active map (default: city)
let activeMap = "city_map"

export async function GET() {
  return Response.json({ map: activeMap })
}

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user || session.user.role !== "admin") {
    return Response.json({ error: "forbidden" }, { status: 403 })
  }

  const { map } = await req.json() as { map: string }

  // Validate: either a built-in map or a published savedMap
  if (!BUILT_IN_MAPS.includes(map)) {
    const exists = await getDb().savedMap.findFirst({
      where: { id: map, published: true },
      select: { id: true },
    })
    if (!exists) {
      return Response.json({ error: "invalid map" }, { status: 400 })
    }
  }

  activeMap = map

  await pubby.trigger("world", "map-change", {
    map: activeMap,
    changedBy: session.user.name,
    timestamp: Date.now(),
  })

  return Response.json({ success: true, map: activeMap })
}
