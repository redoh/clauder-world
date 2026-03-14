import { pubby } from "@/lib/pubby-server";

export async function POST(req: Request) {
  const { socket_id, channel_name } = await req.json();

  if (channel_name.startsWith("presence-")) {
    // For presence channels, include user data
    // TODO: Replace with your actual user auth logic
    const userId = `user-${Math.random().toString(36).slice(2, 9)}`;
    const auth = pubby.authenticatePresenceChannel(
      socket_id,
      channel_name,
      userId,
      { name: `User ${userId}` },
    );
    return Response.json(auth);
  }

  // For private channels
  const auth = pubby.authenticatePrivateChannel(socket_id, channel_name);
  return Response.json(auth);
}
