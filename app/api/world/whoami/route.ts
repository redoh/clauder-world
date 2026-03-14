import { authenticateCliToken } from "@/lib/cli-auth"

export async function GET(req: Request) {
  const user = await authenticateCliToken(req)
  if (!user) {
    return Response.json({ error: "unauthorized" }, { status: 401 })
  }

  return Response.json({
    id: user.id,
    name: user.name,
    email: user.email,
  })
}
