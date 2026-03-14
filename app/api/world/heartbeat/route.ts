import { pubby } from "@/lib/pubby-server"
import { authenticateCliToken } from "@/lib/cli-auth"

// Track active sessions per user: userId -> Set<sessionId>
const activeSessions = new Map<string, Set<string>>()

const SESSION_TIMEOUT = 30_000
const sessionTimers = new Map<string, ReturnType<typeof setTimeout>>()

function cleanupSession(userId: string, sessionId: string) {
  const sessions = activeSessions.get(userId)
  if (sessions) {
    sessions.delete(sessionId)
    if (sessions.size === 0) {
      activeSessions.delete(userId)
    }
  }
  sessionTimers.delete(`${userId}:${sessionId}`)
}

export async function POST(req: Request) {
  const user = await authenticateCliToken(req)
  if (!user) {
    return Response.json({ error: "unauthorized" }, { status: 401 })
  }

  const { sessionId, action } = await req.json() as { sessionId: string; action: "start" | "stop" | "ping" }
  const userId = user.id
  const timerKey = `${userId}:${sessionId}`

  const existingTimer = sessionTimers.get(timerKey)
  if (existingTimer) clearTimeout(existingTimer)

  if (action === "stop") {
    cleanupSession(userId, sessionId)
  } else {
    if (!activeSessions.has(userId)) {
      activeSessions.set(userId, new Set())
    }
    activeSessions.get(userId)!.add(sessionId)

    sessionTimers.set(timerKey, setTimeout(() => cleanupSession(userId, sessionId), SESSION_TIMEOUT))
  }

  const instanceCount = activeSessions.get(userId)?.size ?? 0

  await pubby.trigger("world", "instance-count", {
    userId,
    userName: user.name,
    count: instanceCount,
    timestamp: Date.now(),
  })

  return Response.json({ success: true, instanceCount })
}
