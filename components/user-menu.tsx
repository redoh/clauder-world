"use client"

import { useState } from "react"
import { useSession, signOut } from "@/lib/auth-client"
import { useChannel } from "@/hooks/use-pubby"
import { Button } from "@/components/ui/button"
import Link from "next/link"

export function UserMenu() {
  const { data: session, isPending } = useSession()
  const [instanceCount, setInstanceCount] = useState(0)

  useChannel("world", {
    "instance-count": (raw: unknown) => {
      const data = raw as { userId: string; count: number }
      if (session?.user && data.userId === session.user.id) {
        setInstanceCount(data.count)
      }
    },
  })

  if (isPending) return null

  if (!session) {
    return (
      <div className="flex items-center gap-2">
        <Link href="/sign-in">
          <Button variant="ghost" size="sm" className="text-zinc-300 hover:text-white hover:bg-zinc-700">
            Sign in
          </Button>
        </Link>
        <Link href="/sign-up">
          <Button size="sm">Sign up</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2">
        {session.user.image && (
          <img
            src={session.user.image}
            alt=""
            className="h-7 w-7 rounded-full"
          />
        )}
        <span className="text-sm font-medium text-white">
          {session.user.name}
        </span>
        {instanceCount > 0 && (
          <span className="flex items-center gap-1 rounded-full bg-green-500/20 px-2 py-0.5 text-xs font-mono text-green-400">
            <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
            {instanceCount} claude
          </span>
        )}
      </div>
      {session.user.role === "admin" && (
        <Link href="/admin">
          <Button variant="outline" size="sm" className="border-zinc-600 text-white hover:bg-zinc-700">
            Admin
          </Button>
        </Link>
      )}
      <Button
        variant="ghost"
        size="sm"
        className="text-zinc-300 hover:text-white hover:bg-zinc-700"
        onClick={() => signOut({ fetchOptions: { onSuccess: () => window.location.reload() } })}
      >
        Sign out
      </Button>
    </div>
  )
}
