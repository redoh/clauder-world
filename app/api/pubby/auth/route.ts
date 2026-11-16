import { pubby } from "@/lib/pubby-server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export async function POST(req: Request) {
  const { socket_id, channel_name } = await req.json();

  if (channel_name.startsWith("presence-")) {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    const authResponse = pubby.authenticatePresenceChannel(
      socket_id,
      channel_name,
      session.user.id,
      { name: session.user.name, image: session.user.image },
    );
    return Response.json(authResponse);
  }

  // For private channels
  const authResponse = pubby.authenticatePrivateChannel(socket_id, channel_name);
  return Response.json(authResponse);
}
