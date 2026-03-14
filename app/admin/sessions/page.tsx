"use client"

import { useEffect, useState, useCallback } from "react"
import { useSession } from "@/lib/auth-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useRouter } from "next/navigation"

interface SessionLog {
  id: string
  name: string
  email: string
  image: string | null
  sessionCount: number
  lastSessionAt: string | null
  firstSessionAt: string | null
}

export default function SessionLogsPage() {
  const { data: session, isPending } = useSession()
  const router = useRouter()
  const [users, setUsers] = useState<SessionLog[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")

  useEffect(() => {
    if (!isPending && (!session?.user || session.user.role !== "admin")) {
      router.push("/")
    }
  }, [session, isPending, router])

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/session-logs")
      const data = await res.json()
      if (data.users) {
        setUsers(data.users)
      }
    } catch (err) {
      console.error("Failed to fetch session logs:", err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (session?.user?.role === "admin") {
      fetchData()
    }
  }, [session, fetchData])

  if (isPending || !session?.user || session.user.role !== "admin") {
    return null
  }

  const filteredUsers = users.filter(
    (u) =>
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase())
  )

  const totalSessions = users.reduce((sum, u) => sum + u.sessionCount, 0)

  function formatDate(dateStr: string | null) {
    if (!dateStr) return "—"
    return new Date(dateStr).toLocaleString("en-US", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-4xl space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Session Logs</h1>
            <p className="text-sm text-muted-foreground">
              {totalSessions} total sessions across {users.length} users
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => router.push("/admin")}>
              Admin Panel
            </Button>
            <Button variant="ghost" onClick={() => router.push("/")}>
              Back to World
            </Button>
          </div>
        </div>

        {/* Table */}
        <section className="rounded-lg border border-border bg-card p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">
              Sessions Per User
            </h2>
            <Input
              placeholder="Search users..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-64"
            />
          </div>

          {loading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="pb-3 pr-4 font-medium">User</th>
                    <th className="pb-3 pr-4 font-medium text-center">Sessions</th>
                    <th className="pb-3 pr-4 font-medium">First Session</th>
                    <th className="pb-3 font-medium">Last Session</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user) => (
                    <tr
                      key={user.id}
                      className="border-b border-border/50 last:border-0"
                    >
                      <td className="py-3 pr-4">
                        <div>
                          <span className="font-medium text-foreground">
                            {user.name}
                          </span>
                          <br />
                          <span className="text-xs text-muted-foreground">
                            {user.email}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 pr-4 text-center">
                        <span className="inline-flex h-7 min-w-[2rem] items-center justify-center rounded-full bg-primary/15 px-2 text-sm font-bold text-primary">
                          {user.sessionCount}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-xs text-muted-foreground">
                        {formatDate(user.firstSessionAt)}
                      </td>
                      <td className="py-3 text-xs text-muted-foreground">
                        {formatDate(user.lastSessionAt)}
                      </td>
                    </tr>
                  ))}
                  {filteredUsers.length === 0 && (
                    <tr>
                      <td
                        colSpan={4}
                        className="py-8 text-center text-muted-foreground"
                      >
                        No users found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
