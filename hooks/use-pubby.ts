"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import type { Pubby, Channel, PresenceChannel } from "@getpubby/sdk";
import { getPubbyClient } from "@/lib/pubby";
import { observePresenceMembers, type PresenceMember } from "@/lib/presence";

type ConnectionState =
  | "initialized"
  | "connecting"
  | "connected"
  | "disconnected"
  | "failed";

export function usePubby() {
  const pubbyRef = useRef<Pubby | null>(null);
  const [connectionState, setConnectionState] =
    useState<ConnectionState>("initialized");

  useEffect(() => {
    const pubby = getPubbyClient();
    pubbyRef.current = pubby;

    pubby.onConnectionStateChange((state: ConnectionState) => {
      setConnectionState(state);
    });

    pubby.connect();

    return () => {
      pubby.disconnect();
    };
  }, []);

  return { pubby: pubbyRef.current, connectionState };
}

export function useChannel(
  channelName: string,
  events?: Record<string, (data: unknown) => void>,
) {
  const { pubby, connectionState } = usePubby();
  const channelRef = useRef<Channel | null>(null);

  useEffect(() => {
    if (!pubby) return;

    const channel = pubby.subscribe(channelName);
    channelRef.current = channel;

    if (events) {
      for (const [eventName, handler] of Object.entries(events)) {
        channel.bind(eventName, handler);
      }
    }

    return () => {
      if (events) {
        for (const eventName of Object.keys(events)) {
          channel.unbind(eventName);
        }
      }
      pubby.unsubscribe(channelName);
    };
  }, [pubby, channelName]);

  const trigger = useCallback(
    async (event: string, data: unknown) => {
      await fetch("/api/pubby/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel: channelName,
          event,
          data,
          socketId: pubby?.getSocketId(),
        }),
      });
    },
    [channelName, pubby],
  );

  return { channel: channelRef.current, connectionState, trigger };
}

const NO_MEMBERS: PresenceMember[] = [];

export function usePresenceChannel(channelName: string) {
  const { pubby } = usePubby();
  const [members, setMembers] = useState<PresenceMember[]>(NO_MEMBERS);

  useEffect(() => {
    if (!pubby || !channelName) return;

    const name = `presence-${channelName}`;
    const channel = pubby.subscribe(name) as PresenceChannel;
    const stopObserving = observePresenceMembers(channel, setMembers);

    return () => {
      stopObserving();
      pubby.unsubscribe(name);
    };
  }, [pubby, channelName]);

  return { members: channelName ? members : NO_MEMBERS };
}
