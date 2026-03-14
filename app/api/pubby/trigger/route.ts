import { pubby } from "@/lib/pubby-server";

export async function POST(req: Request) {
  const { channel, event, data, socketId } = await req.json();

  if (!channel || !event) {
    return Response.json(
      { error: "channel and event are required" },
      { status: 400 },
    );
  }

  await pubby.trigger(channel, event, data ?? {}, socketId ? { socketId } : undefined);

  return Response.json({ success: true });
}
