import { pubby } from "@/lib/pubby-server"
import { authenticateCliToken } from "@/lib/cli-auth"

export async function POST(req: Request) {
  const user = await authenticateCliToken(req)
  if (!user) {
    return Response.json({ error: "unauthorized" }, { status: 401 })
  }

  const body = await req.json()
  const { event, data } = body as { event: string; data: Record<string, unknown> }

  if (!event) {
    return Response.json({ error: "event is required" }, { status: 400 })
  }

  await pubby.trigger("world", "user-activity", {
    userId: user.id,
    userName: user.name,
    event,
    data,
    timestamp: Date.now(),
  })

  return Response.json({ success: true })
}
