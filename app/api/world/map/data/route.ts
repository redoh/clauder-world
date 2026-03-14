import { getDb } from "@/lib/db"
import { readFile } from "fs/promises"
import { join } from "path"

const BUILT_IN_MAPS = ["city_map", "dungeon_map"]

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get("id")

  if (!id) {
    return Response.json({ error: "id is required" }, { status: 400 })
  }

  // Built-in maps: serve from filesystem
  if (BUILT_IN_MAPS.includes(id)) {
    try {
      const filePath = join(process.cwd(), "public", "map", `${id}.json`)
      const raw = await readFile(filePath, "utf-8")
      return Response.json({ mapData: JSON.parse(raw) })
    } catch {
      return Response.json({ error: "built-in map not found" }, { status: 404 })
    }
  }

  // DB maps: fetch by ID
  const savedMap = await getDb().savedMap.findUnique({
    where: { id },
    select: { mapData: true },
  })

  if (!savedMap) {
    return Response.json({ error: "map not found" }, { status: 404 })
  }

  return Response.json({ mapData: savedMap.mapData })
}
