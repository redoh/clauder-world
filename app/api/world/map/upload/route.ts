import { auth } from "@/lib/auth"
import { getDb } from "@/lib/db"
import { headers } from "next/headers"

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user || session.user.role !== "admin") {
    return Response.json({ error: "forbidden" }, { status: 403 })
  }

  const formData = await req.formData()
  const file = formData.get("file") as File | null
  let customName = (formData.get("name") as string | null)?.trim()

  if (!file) {
    return Response.json({ error: "no file provided" }, { status: 400 })
  }

  // Read and validate JSON
  let mapData: unknown
  try {
    const text = await file.text()
    mapData = JSON.parse(text)
  } catch {
    return Response.json({ error: "invalid JSON file" }, { status: 400 })
  }

  // Basic structure validation
  const data = mapData as Record<string, unknown>
  if (!data.legend || !data.grid) {
    return Response.json(
      { error: "invalid map format: must have legend and grid fields" },
      { status: 400 }
    )
  }

  if (!Array.isArray(data.grid) || data.grid.length === 0) {
    return Response.json(
      { error: "invalid map format: grid must be a non-empty array" },
      { status: 400 }
    )
  }

  // Determine map name
  const mapName = customName
    || file.name.replace(".json", "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())

  if (!mapName) {
    return Response.json({ error: "invalid map name" }, { status: 400 })
  }

  // Save to DB as published map
  const savedMap = await getDb().savedMap.create({
    data: {
      userId: session.user.id,
      name: mapName,
      mapData: mapData as object,
      published: true,
    },
  })

  return Response.json({
    success: true,
    map: {
      id: savedMap.id,
      label: savedMap.name,
      builtIn: false,
    },
  })
}
