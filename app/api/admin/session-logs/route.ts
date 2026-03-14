import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { getDb } from "@/lib/db"

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const prisma = getDb()

  const results = await prisma.$queryRawUnsafe(`
    SELECT
      u.id,
      u.name,
      u.email,
      u.image,
      COUNT(s.id)::int AS "sessionCount",
      MAX(s."createdAt") AS "lastSessionAt",
      MIN(s."createdAt") AS "firstSessionAt"
    FROM "user" u
    LEFT JOIN "session" s ON s."userId" = u.id
    GROUP BY u.id, u.name, u.email, u.image
    ORDER BY "sessionCount" DESC
  `)

  return NextResponse.json({ users: results })
}
