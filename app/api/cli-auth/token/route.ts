import { auth } from "@/lib/auth"
import { getDb } from "@/lib/db"
import { headers } from "next/headers"
import { randomBytes } from "crypto"

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) {
    return Response.json({ error: "not authenticated" }, { status: 401 })
  }

  const { port } = await req.json() as { port: number }
  if (!port || port < 1024 || port > 65535) {
    return Response.json({ error: "invalid port" }, { status: 400 })
  }

  const db = getDb()

  // Get or create a persistent CLI token for this user
  let cliToken = await db.cliToken.findUnique({ where: { userId: session.user.id } })

  if (!cliToken) {
    cliToken = await db.cliToken.create({
      data: {
        userId: session.user.id,
        token: `cwt_${randomBytes(32).toString("hex")}`,
      },
    })
  }

  // Send credentials to CLI's local callback server
  try {
    const callbackRes = await fetch(`http://127.0.0.1:${port}/callback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: cliToken.token,
        userName: session.user.name,
        userId: session.user.id,
      }),
      signal: AbortSignal.timeout(5000),
    })

    if (!callbackRes.ok) {
      return Response.json({ error: "CLI callback failed" }, { status: 502 })
    }

    return Response.json({ success: true })
  } catch {
    return Response.json(
      { error: "Could not reach CLI. Make sure `clauder-world login` is still running." },
      { status: 502 }
    )
  }
}
