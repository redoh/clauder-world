import { getDb } from "@/lib/db"

const BUILT_IN_MAPS = [
  { id: "city_map", label: "City Map", builtIn: true },
  { id: "dungeon_map", label: "Dungeon Map", builtIn: true },
]

export async function GET() {
  const publishedMaps = await getDb().savedMap.findMany({
    where: { published: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  })

  const dbMaps = publishedMaps.map((m) => ({
    id: m.id,
    label: m.name,
    builtIn: false,
  }))

  const maps = [...BUILT_IN_MAPS, ...dbMaps]

  return Response.json({ maps })
}
