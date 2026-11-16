import type { PresenceChannel } from "@getpubby/sdk";

export interface PresenceMember {
  id: string;
  info: { name: string; image?: string };
}

export function readPresenceMembers(channel: PresenceChannel): PresenceMember[] {
  const members: PresenceMember[] = [];
  for (const [id, rawInfo] of channel.getMembers()) {
    if (typeof id !== "string" || !id.trim()) continue;
    const info = rawInfo && typeof rawInfo === "object"
      ? rawInfo as Record<string, unknown>
      : {};
    members.push({
      id,
      info: {
        name: typeof info.name === "string" && info.name.trim()
          ? info.name.trim()
          : "Clauder",
        ...(typeof info.image === "string" ? { image: info.image } : {}),
      },
    });
  }
  return members;
}

export function observePresenceMembers(
  channel: PresenceChannel,
  onMembers: (members: PresenceMember[]) => void,
) {
  // The SDK updates its member map before emitting these events. Join/leave
  // payloads use user_id/user_info, not the application's id/info shape.
  const refresh = () => onMembers(readPresenceMembers(channel));
  const events = [
    "pusher:subscription_succeeded",
    "pusher:member_added",
    "pusher:member_removed",
  ];
  for (const event of events) channel.bind(event, refresh);
  refresh();

  return () => {
    for (const event of events) channel.unbind(event, refresh);
  };
}
