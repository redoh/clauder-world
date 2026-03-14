import { getDb } from "./db"

export async function authenticateCliToken(req: Request) {
  const authHeader = req.headers.get("authorization")
  if (!authHeader?.startsWith("Bearer ")) return null

  const token = authHeader.slice(7)
  if (!token.startsWith("cwt_")) return null

  const db = getDb()
  const cliToken = await db.cliToken.findUnique({
    where: { token },
    include: { user: true },
  })

  return cliToken?.user ?? null
}
