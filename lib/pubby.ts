import { Pubby } from "@getpubby/sdk";

let pubbyInstance: Pubby | null = null;

export function getPubbyClient(): Pubby {
  if (pubbyInstance) return pubbyInstance;

  pubbyInstance = new Pubby(process.env.NEXT_PUBLIC_PUBBY_KEY!, {
    wsHost: process.env.NEXT_PUBLIC_PUBBY_WS_HOST!,
    authEndpoint: "/api/pubby/auth",
    debug: process.env.NODE_ENV === "development",
  });

  return pubbyInstance;
}
