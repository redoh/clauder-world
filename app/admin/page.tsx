"use client"

import { useEffect, useState, useCallback } from "react"
import { useSession, authClient } from "@/lib/auth-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useRouter } from "next/navigation"
import { MapPreview } from "@/components/map-preview"

interface UserEntry {
  id: string
  name: string
  email: string
  role: string | null
  banned: boolean | null
  banReason: string | null
  createdAt: string
}

interface MapEntry {
  id: string
  label: string
  builtIn: boolean
}

interface SavedMapEntry {
  id: string
  name: string
  createdAt: string
  updatedAt: string
  user: { id: string; name: string; email: string }
}

interface SessionLog {
  id: string
  name: string
  email: string
  image: string | null
  sessionCount: number
  lastSessionAt: string | null
  firstSessionAt: string | null
}

type Tab = "overview" | "users" | "maps" | "sessions"

const NAV_ITEMS: { id: Tab; label: string; icon: string }[] = [
  { id: "overview", label: "Overview", icon: "grid" },
  { id: "users", label: "Users", icon: "users" },
  { id: "maps", label: "Maps", icon: "map" },
  { id: "sessions", label: "Session Logs", icon: "clock" },
]

function NavIcon({ type }: { type: string }) {
  switch (type) {
    case "grid":
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
        </svg>
      )
    case "users":
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      )
    case "map":
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" /><line x1="8" y1="2" x2="8" y2="18" /><line x1="16" y1="6" x2="16" y2="22" />
        </svg>
      )
    case "clock":
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
        </svg>
      )
    default:
      return null
  }
}

function StatCard({ label, value, icon, accent }: { label: string; value: string | number; icon: string; accent?: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className="text-muted-foreground/50">
          <NavIcon type={icon} />
        </span>
      </div>
      <div className={`mt-3 text-3xl font-bold ${accent ? "text-emerald-400" : "text-foreground"}`}>
        {value}
      </div>
    </div>
  )
}

export default function AdminPage() {
  const { data: session, isPending } = useSession()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<Tab>("overview")
  const [users, setUsers] = useState<UserEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [activeMap, setActiveMap] = useState("city_map")
  const [availableMaps, setAvailableMaps] = useState<MapEntry[]>([])
  const [search, setSearch] = useState("")
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [uploadName, setUploadName] = useState("")
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadError, setUploadError] = useState("")
  const [uploading, setUploading] = useState(false)
  const [sessionLogs, setSessionLogs] = useState<SessionLog[]>([])
  const [sessionsLoading, setSessionsLoading] = useState(false)
  const [sessionSearch, setSessionSearch] = useState("")
  const [savedMaps, setSavedMaps] = useState<SavedMapEntry[]>([])
  const [savedMapsLoading, setSavedMapsLoading] = useState(false)
  const [previewMap, setPreviewMap] = useState<{ name: string; data: Record<string, unknown> } | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)

  useEffect(() => {
    if (!isPending && (!session?.user || session.user.role !== "admin")) {
      router.push("/")
    }
  }, [session, isPending, router])

  const fetchUsers = useCallback(async () => {
    try {
      const res = await authClient.admin.listUsers({
        query: { limit: 100, sortBy: "createdAt", sortDirection: "desc" },
      })
      if (res.data) {
        setUsers(res.data.users as unknown as UserEntry[])
      }
    } catch (err) {
      console.error("Failed to fetch users:", err)
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchMap = useCallback(async () => {
    const res = await fetch("/api/world/map")
    const data = await res.json()
    setActiveMap(data.map)
  }, [])

  const fetchMaps = useCallback(async () => {
    const res = await fetch("/api/world/map/list")
    const data = await res.json()
    setAvailableMaps(data.maps)
  }, [])

  const fetchSessionLogs = useCallback(async () => {
    setSessionsLoading(true)
    try {
      const res = await fetch("/api/admin/session-logs")
      const data = await res.json()
      if (data.users) setSessionLogs(data.users)
    } catch (err) {
      console.error("Failed to fetch session logs:", err)
    } finally {
      setSessionsLoading(false)
    }
  }, [])

  const fetchSavedMaps = useCallback(async () => {
    setSavedMapsLoading(true)
    try {
      const res = await fetch("/api/maps/all")
      const data = await res.json()
      if (data.maps) setSavedMaps(data.maps)
    } catch (err) {
      console.error("Failed to fetch saved maps:", err)
    } finally {
      setSavedMapsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (session?.user?.role === "admin") {
      fetchUsers()
      fetchMap()
      fetchMaps()
      fetchSessionLogs()
      fetchSavedMaps()
    }
  }, [session, fetchUsers, fetchMap, fetchMaps, fetchSessionLogs, fetchSavedMaps])

  async function handleBan(userId: string) {
    setActionLoading(userId)
    await authClient.admin.banUser({ userId, banReason: "Banned by admin" })
    await fetchUsers()
    setActionLoading(null)
  }

  async function handleUnban(userId: string) {
    setActionLoading(userId)
    await authClient.admin.unbanUser({ userId })
    await fetchUsers()
    setActionLoading(null)
  }

  async function handleMapChange(map: string) {
    setActionLoading(`map-${map}`)
    await fetch("/api/world/map", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ map }),
    })
    setActiveMap(map)
    setActionLoading(null)
  }

  async function handleUpload() {
    if (!uploadFile) return
    setUploading(true)
    setUploadError("")
    try {
      const formData = new FormData()
      formData.append("file", uploadFile)
      if (uploadName) formData.append("name", uploadName)
      const res = await fetch("/api/world/map/upload", {
        method: "POST",
        body: formData,
      })
      const data = await res.json()
      if (!res.ok) {
        setUploadError(data.error || "Upload failed")
      } else {
        setUploadFile(null)
        setUploadName("")
        await fetchMaps()
      }
    } catch {
      setUploadError("Upload failed")
    } finally {
      setUploading(false)
    }
  }

  async function handlePreviewMap(mapId: string, mapName: string) {
    setPreviewLoading(true)
    try {
      const res = await fetch(`/api/maps/get?id=${mapId}`)
      const data = await res.json()
      if (res.ok && data.map?.mapData) {
        setPreviewMap({ name: mapName, data: data.map.mapData as Record<string, unknown> })
      }
    } catch (err) {
      console.error("Failed to load map preview:", err)
    } finally {
      setPreviewLoading(false)
    }
  }

  async function handleApplySavedMap(mapId: string) {
    setActionLoading(`apply-${mapId}`)
    try {
      const res = await fetch("/api/maps/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mapId }),
      })
      const data = await res.json()
      if (res.ok && data.fileId) {
        await handleMapChange(data.fileId)
        await fetchMaps()
      }
    } catch (err) {
      console.error("Failed to apply saved map:", err)
    } finally {
      setActionLoading(null)
    }
  }

  async function handleDeleteSavedMap(mapId: string) {
    if (!confirm("Delete this saved map?")) return
    setActionLoading(`delete-saved-${mapId}`)
    try {
      await fetch("/api/maps/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mapId }),
      })
      await fetchSavedMaps()
    } catch (err) {
      console.error("Failed to delete saved map:", err)
    } finally {
      setActionLoading(null)
    }
  }

  async function handleDeleteMap(mapId: string) {
    if (!confirm(`Delete map "${mapId}"?`)) return
    setActionLoading(`delete-${mapId}`)
    await fetch("/api/world/map/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mapId }),
    })
    if (activeMap === mapId) {
      await handleMapChange("city_map")
    }
    await fetchMaps()
    setActionLoading(null)
  }

  if (isPending || !session?.user || session.user.role !== "admin") {
    return null
  }

  const filteredUsers = users.filter(
    (u) =>
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase())
  )

  const bannedCount = users.filter((u) => u.banned).length
  const adminCount = users.filter((u) => u.role === "admin").length
  const customMapCount = availableMaps.filter((m) => !m.builtIn).length
  const totalSessions = sessionLogs.reduce((sum, u) => sum + u.sessionCount, 0)

  const filteredSessionLogs = sessionLogs.filter(
    (u) =>
      u.name.toLowerCase().includes(sessionSearch.toLowerCase()) ||
      u.email.toLowerCase().includes(sessionSearch.toLowerCase())
  )

  function formatDate(dateStr: string | null) {
    if (!dateStr) return "\u2014"
    return new Date(dateStr).toLocaleString("en-US", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl px-6 pt-12 pb-12">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Admin Panel</h1>
              <p className="text-sm text-muted-foreground">
                Manage users, maps, and world settings
              </p>
            </div>
            <Button variant="ghost" onClick={() => router.push("/")}>
              Back to World
            </Button>
          </div>
        </div>

        {/* Sidebar + Content */}
        <div className="flex gap-8">
          {/* Sidebar */}
          <nav className="w-56 shrink-0">
            <div className="space-y-1">
              {NAV_ITEMS.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${
                    activeTab === item.id
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <NavIcon type={item.icon} />
                  {item.label}
                </button>
              ))}
            </div>
          </nav>

          {/* Content */}
          <main className="min-w-0 flex-1">
            {/* Overview Tab */}
            {activeTab === "overview" && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <StatCard label="Total Users" value={users.length} icon="users" />
                  <StatCard label="Admins" value={adminCount} icon="users" />
                  <StatCard label="Banned" value={bannedCount} icon="users" accent={bannedCount > 0} />
                  <StatCard label="Total Maps" value={availableMaps.length} icon="map" />
                  <StatCard label="Custom Maps" value={customMapCount} icon="map" />
                  <StatCard
                    label="Active Map"
                    value={activeMap.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                    icon="grid"
                  />
                  <StatCard label="Total Sessions" value={totalSessions} icon="clock" />
                </div>
              </div>
            )}

            {/* Users Tab */}
            {activeTab === "users" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-foreground">
                    Users ({users.length})
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
                  <div className="space-y-2">
                    {filteredUsers.map((user) => (
                      <div
                        key={user.id}
                        className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-foreground">
                              {user.name}
                            </span>
                            {user.role === "admin" && (
                              <span className="rounded bg-primary/20 px-1.5 py-0.5 text-[10px] font-bold uppercase text-primary">
                                admin
                              </span>
                            )}
                            {user.banned && (
                              <span className="rounded bg-destructive/20 px-1.5 py-0.5 text-[10px] font-bold uppercase text-destructive">
                                banned
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {user.email}
                          </span>
                        </div>
                        <div>
                          {user.role !== "admin" &&
                            (user.banned ? (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={actionLoading === user.id}
                                onClick={() => handleUnban(user.id)}
                              >
                                {actionLoading === user.id ? "..." : "Unban"}
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="destructive"
                                disabled={actionLoading === user.id}
                                onClick={() => handleBan(user.id)}
                              >
                                {actionLoading === user.id ? "..." : "Ban"}
                              </Button>
                            ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Maps Tab */}
            {activeTab === "maps" && (
              <div className="space-y-6">
                {/* Active Map Selection */}
                <div className="rounded-lg border border-border bg-card p-6">
                  <h2 className="mb-4 text-lg font-semibold text-foreground">Active Map</h2>
                  <div className="flex flex-wrap gap-3">
                    {availableMaps.map((m) => (
                      <div key={m.id} className="flex items-center gap-1">
                        <Button
                          variant={activeMap === m.id ? "default" : "outline"}
                          disabled={actionLoading === `map-${m.id}`}
                          onClick={() => handleMapChange(m.id)}
                        >
                          {actionLoading === `map-${m.id}` ? "..." : m.label}
                        </Button>
                        {!m.builtIn && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                            disabled={actionLoading === `delete-${m.id}`}
                            onClick={() => handleDeleteMap(m.id)}
                          >
                            {actionLoading === `delete-${m.id}` ? "..." : "X"}
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Changing the map will update it for all connected users in real-time.
                  </p>
                </div>

                {/* Upload Map */}
                <div className="rounded-lg border border-border bg-card p-6">
                  <h2 className="mb-4 text-lg font-semibold text-foreground">Upload Custom Map</h2>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                    <div className="flex-1">
                      <label className="mb-1 block text-xs text-muted-foreground">
                        Map Name (optional)
                      </label>
                      <Input
                        placeholder="e.g. my_custom_map"
                        value={uploadName}
                        onChange={(e) => setUploadName(e.target.value)}
                      />
                    </div>
                    <div className="flex-1">
                      <label className="mb-1 block text-xs text-muted-foreground">
                        Map JSON File
                      </label>
                      <Input
                        type="file"
                        accept=".json"
                        onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
                      />
                    </div>
                    <Button disabled={!uploadFile || uploading} onClick={handleUpload}>
                      {uploading ? "Uploading..." : "Upload"}
                    </Button>
                  </div>
                  {uploadError && (
                    <p className="mt-2 text-xs text-destructive">{uploadError}</p>
                  )}
                  <p className="mt-2 text-xs text-muted-foreground">
                    Upload a JSON file with legend + grid format. Use the Map Builder to create maps.
                  </p>
                </div>

                {/* User Saved Maps */}
                <div className="rounded-lg border border-border bg-card p-6">
                  <h2 className="mb-4 text-lg font-semibold text-foreground">
                    User Saved Maps ({savedMaps.length})
                  </h2>
                  {savedMapsLoading ? (
                    <p className="text-sm text-muted-foreground">Loading...</p>
                  ) : savedMaps.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No user-saved maps yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {savedMaps.map((m) => (
                        <div
                          key={m.id}
                          className="flex items-center justify-between rounded-lg border border-border px-4 py-3"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-foreground">
                                {m.name}
                              </span>
                              <span className="text-[10px] text-muted-foreground">
                                by {m.user.name}
                              </span>
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {new Date(m.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={previewLoading}
                              onClick={() => handlePreviewMap(m.id, m.name)}
                            >
                              Preview
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={actionLoading === `apply-${m.id}`}
                              onClick={() => handleApplySavedMap(m.id)}
                            >
                              {actionLoading === `apply-${m.id}` ? "..." : "Use"}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive hover:text-destructive"
                              disabled={actionLoading === `delete-saved-${m.id}`}
                              onClick={() => handleDeleteSavedMap(m.id)}
                            >
                              {actionLoading === `delete-saved-${m.id}` ? "..." : "X"}
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Sessions Tab */}
            {activeTab === "sessions" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">Session Logs</h2>
                    <p className="text-sm text-muted-foreground">
                      {totalSessions} total sessions across {sessionLogs.length} users
                    </p>
                  </div>
                  <Input
                    placeholder="Search users..."
                    value={sessionSearch}
                    onChange={(e) => setSessionSearch(e.target.value)}
                    className="w-64"
                  />
                </div>

                <div className="rounded-lg border border-border bg-card p-6">
                  {sessionsLoading ? (
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
                          {filteredSessionLogs.map((user) => (
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
                          {filteredSessionLogs.length === 0 && (
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
                </div>
              </div>
            )}
          </main>
        </div>
      </div>

      {/* Map Preview Modal */}
      {previewMap && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setPreviewMap(null)}
        >
          <div
            className="relative w-[90vw] h-[80vh] max-w-6xl rounded-xl border border-border bg-zinc-900 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-700">
              <h3 className="text-sm font-semibold text-white">{previewMap.name}</h3>
              <button
                onClick={() => setPreviewMap(null)}
                className="text-zinc-400 hover:text-white text-lg leading-none px-2"
              >
                X
              </button>
            </div>
            <div className="w-full" style={{ height: "calc(100% - 48px)" }}>
              <MapPreview mapData={previewMap.data} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
