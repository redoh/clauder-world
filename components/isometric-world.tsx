"use client"

import { useEffect, useRef, useCallback, useState } from "react"
import { useSession } from "@/lib/auth-client"
import { useChannel, usePresenceChannel } from "@/hooks/use-pubby"

// ============================================================
// Constants
// ============================================================
const TILE_W = 128
const TILE_H = 64

// ============================================================
// Types
// ============================================================
interface Cell {
  ground: string
  building?: string
  prop?: string
  vehicle?: string
}

interface Character {
  id: string
  name: string
  gridX: number
  gridY: number
  color: string
  accent: string
  eyeColor: string
  size: number
  bobOffset: number
  dir: "left" | "right"
  bubble?: string
  bubbleUntil?: number
  instanceCount?: number
  onlineSince?: number // performance.now() timestamp
}

// Speech bubble messages per character personality
const BUBBLE_MESSAGES: Record<string, string[]> = {
  Claude: [
    "thinking...", "task completed!", "reading docs...", "let me check...",
    "on it!", "done!", "analyzing...", "hmm interesting",
    "writing code...", "one sec...", "refactoring...",
  ],
  Pixel: [
    "debugging...", "found a bug!", "ship it!", "LGTM!",
    "needs tests...", "fixing...", "pushing...", "reviewing PR...",
  ],
  Nova: [
    "designing...", "looks good!", "almost done!", "deploying...",
    "coffee break!", "syncing...", "nice!", "merged!",
  ],
}

const BUBBLE_INTERVAL_MIN = 3000
const BUBBLE_INTERVAL_MAX = 8000
const BUBBLE_DURATION = 2500

// ============================================================
// Asset helpers
// ============================================================

// Dungeon tiles are 256x512 (2x city), rendered at half scale
const DUNGEON_SCALE = 0.5

// Resolve ground path: dungeon tiles don't start with "tile_"
function resolveGround(name: string): string {
  if (name.startsWith("tile_")) return `/assets/city/Grounds/${name}.png`
  return `/assets/dungeon/${name}.png`
}

function isDungeonGround(name: string): boolean {
  return !name.startsWith("tile_") && !name.startsWith("/assets/city/")
}

function isDungeonPath(path: string): boolean {
  return path.includes("/dungeon/")
}

// ============================================================
// Online duration formatter
// ============================================================
function formatOnlineDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  const pad = (n: number) => n.toString().padStart(2, "0")
  if (h > 0) return `${h}:${pad(m)}:${pad(s)}`
  return `${m}:${pad(s)}`
}

// ============================================================
// Color helpers (for character drawing)
// ============================================================
function lighten(hex: string, amt: number): string {
  const n = parseInt(hex.replace("#", ""), 16)
  const r = Math.min(255, ((n >> 16) & 0xff) + amt)
  const g = Math.min(255, ((n >> 8) & 0xff) + amt)
  const b = Math.min(255, (n & 0xff) + amt)
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`
}

// ============================================================
// Character drawing (pixel art style)
// ============================================================
function drawCharacter(
  ctx: CanvasRenderingContext2D,
  char: Character,
  sx: number,
  sy: number,
  time: number
) {
  const s = char.size
  const px = 12 * s
  const bob = Math.sin(time * 0.003 + char.bobOffset) * 1.5 * s
  const cx = Math.round(sx)
  const cy = Math.round(sy - px * 1.2 + bob)
  const p = Math.max(1, Math.round(s * 1.5))

  const rect = (x: number, y: number, w: number, h: number, c: string) => {
    ctx.fillStyle = c
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h))
  }

  // Shadow
  ctx.fillStyle = "rgba(0,0,0,0.2)"
  ctx.beginPath()
  ctx.ellipse(cx, sy + 1, px * 0.4, px * 0.15, 0, 0, Math.PI * 2)
  ctx.fill()

  const bodyW = p * 5, bodyH = p * 5

  // Body
  rect(cx - bodyW / 2, cy, bodyW, bodyH, char.color)
  rect(cx - bodyW / 2, cy, p, bodyH, lighten(char.color, 30))
  rect(cx - bodyW / 2, cy + bodyH - p * 2, bodyW, p, char.accent)

  // Head
  const headW = p * 4, headH = p * 4
  const headY = cy - headH + p
  rect(cx - headW / 2, headY, headW, headH, "#f5d6b8")
  rect(cx - headW / 2, headY, p, headH, "#fce4cc")

  // Hair
  rect(cx - headW / 2 - p, headY - p, headW + p * 2, p * 2, char.accent)
  rect(cx - headW / 2 - p, headY, p, headH - p, char.accent)

  // Eyes
  const eyeOff = char.dir === "right" ? p * 0.5 : -p * 0.5
  rect(cx - p + eyeOff, headY + p * 2, p, p, char.eyeColor)
  rect(cx + p * 0.5 + eyeOff, headY + p * 2, p, p, char.eyeColor)
  rect(cx - p + eyeOff, headY + p * 2, Math.max(1, p * 0.5), Math.max(1, p * 0.5), "#fff")

  // Arms
  const armBob = Math.sin(time * 0.004 + char.bobOffset) * p
  rect(cx - bodyW / 2 - p, cy + p + armBob, p, p * 3, char.color)
  rect(cx + bodyW / 2, cy + p - armBob, p, p * 3, char.color)
  rect(cx - bodyW / 2 - p, cy + p * 4 + armBob, p, p, "#f5d6b8")
  rect(cx + bodyW / 2, cy + p * 4 - armBob, p, p, "#f5d6b8")

  // Legs
  const legBob = Math.sin(time * 0.005 + char.bobOffset) * p * 0.4
  rect(cx - p * 1.2, cy + bodyH, p, p * 2 + legBob, char.accent)
  rect(cx + p * 0.2, cy + bodyH, p, p * 2 - legBob, char.accent)
  rect(cx - p * 1.2, cy + bodyH + p * 2 + legBob, p * 1.3, p, "#3a3a4a")
  rect(cx + p * 0.2, cy + bodyH + p * 2 - legBob, p * 1.3, p, "#3a3a4a")

  // Online duration badge (above name)
  if (char.onlineSince != null) {
    const elapsed = time - char.onlineSince
    const durationText = formatOnlineDuration(elapsed)
    const timerFontSize = Math.max(7, 7 * s)
    ctx.font = `bold ${timerFontSize}px monospace`
    ctx.textAlign = "center"
    const tw = ctx.measureText(durationText).width
    const tPadX = 4 * s
    const tPadY = 2 * s
    const tBgW = tw + tPadX * 2
    const tBgH = timerFontSize + tPadY * 2
    const tX = cx - tBgW / 2
    const tY = headY - p - 14 * s - tBgH
    // Badge background
    ctx.fillStyle = "rgba(34,197,94,0.85)"
    ctx.beginPath()
    ctx.roundRect(tX, tY, tBgW, tBgH, 3 * s)
    ctx.fill()
    // Duration text
    ctx.fillStyle = "#ffffff"
    ctx.fillText(durationText, cx, tY + tPadY + timerFontSize - 1)
  }

  // Name + instance count badge
  const displayName = char.instanceCount && char.instanceCount > 0
    ? `${char.name} [${char.instanceCount}]`
    : char.name
  ctx.font = `bold ${Math.max(8, 9 * s)}px monospace`
  ctx.textAlign = "center"
  ctx.fillStyle = "rgba(0,0,0,0.5)"
  ctx.fillText(displayName, cx + 1, headY - p - 1)
  ctx.fillStyle = "#ffffff"
  ctx.fillText(displayName, cx, headY - p - 2)

  // Instance count badge (green dot)
  if (char.instanceCount && char.instanceCount > 0) {
    const badgeX = cx + ctx.measureText(displayName).width / 2 + 4 * s
    const badgeY = headY - p - 6
    ctx.fillStyle = "#22c55e"
    ctx.beginPath()
    ctx.arc(badgeX, badgeY, 3 * s, 0, Math.PI * 2)
    ctx.fill()
  }

  // Speech bubble
  if (char.bubble && char.bubbleUntil && time < char.bubbleUntil) {
    const bubbleText = char.bubble
    ctx.font = `bold ${Math.max(7, 8 * s)}px monospace`
    const textW = ctx.measureText(bubbleText).width
    const padX = 6 * s
    const padY = 4 * s
    const bw = textW + padX * 2
    const bh = 14 * s
    const bx = cx - bw / 2
    const by = headY - p * 3 - bh - 4 * s

    // Fade out in last 500ms
    const remaining = char.bubbleUntil - time
    const alpha = remaining < 500 ? remaining / 500 : 1

    ctx.globalAlpha = alpha

    // Bubble background
    ctx.fillStyle = "#ffffff"
    ctx.beginPath()
    ctx.roundRect(bx, by, bw, bh, 4 * s)
    ctx.fill()

    // Bubble tail (small triangle pointing down)
    ctx.beginPath()
    ctx.moveTo(cx - 3 * s, by + bh)
    ctx.lineTo(cx, by + bh + 4 * s)
    ctx.lineTo(cx + 3 * s, by + bh)
    ctx.closePath()
    ctx.fill()

    // Bubble border
    ctx.strokeStyle = "rgba(0,0,0,0.15)"
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.roundRect(bx, by, bw, bh, 4 * s)
    ctx.stroke()

    // Bubble text
    ctx.fillStyle = "#1a1a2e"
    ctx.textAlign = "center"
    ctx.fillText(bubbleText, cx, by + padY + 8 * s)

    ctx.globalAlpha = 1
  }
}

// ============================================================
// Default characters — spread across the map
// ============================================================
function createCharacters(): Character[] {
  return [
    { id: "1", name: "Claude", gridX: 3, gridY: 2, color: "#d97706", accent: "#92400e", eyeColor: "#1e1e2e", size: 2.5, bobOffset: 0, dir: "right" },
    { id: "2", name: "Pixel", gridX: 1, gridY: 5, color: "#6366f1", accent: "#3730a3", eyeColor: "#1e1e2e", size: 1.3, bobOffset: 1.5, dir: "left" },
    { id: "3", name: "Nova", gridX: 5, gridY: 4, color: "#ec4899", accent: "#9d174d", eyeColor: "#1e1e2e", size: 1, bobOffset: 3, dir: "right" },
  ]
}

// Generate deterministic color from string
function hashColor(str: string, saturation = 70, lightness = 50): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  const h = ((hash % 360) + 360) % 360
  // Convert HSL to hex
  const s = saturation / 100
  const l = lightness / 100
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => {
    const k = (n + h / 30) % 12
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)
    return Math.round(255 * color).toString(16).padStart(2, "0")
  }
  return `#${f(0)}${f(8)}${f(4)}`
}

function createUserCharacter(userId: string, userName: string): Character {
  const color = hashColor(userId, 70, 45)
  const accent = hashColor(userId, 70, 28)
  return {
    id: `user-${userId}`,
    name: userName.split(" ")[0],
    gridX: 4,
    gridY: 3,
    color,
    accent,
    eyeColor: "#1e1e2e",
    size: 1.8,
    bobOffset: 2,
    dir: "right",
    onlineSince: performance.now(),
  }
}

const USER_BUBBLE_MESSAGES = [
  "hello!", "exploring...", "nice place!", "where am I?",
  "cool!", "building...", "just arrived!", "vibing...",
]

// ============================================================
// Legend+grid map parser
// ============================================================
interface LegendEntry {
  g: string
  b?: string
  p?: string
  v?: string
}

function parseLegendMap(
  legend: Record<string, LegendEntry>,
  grid: string[],
  theme: string
): Cell[][] {
  return grid.map((row) =>
    Array.from(row).map((sym) => {
      const entry = legend[sym]
      if (!entry) return { ground: resolveGround("tile_ground_grass") }
      const cell: Cell = {
        ground: entry.g.startsWith("/") ? entry.g : resolveGround(entry.g),
      }
      // building/prop/vehicle: if already a full path keep it, otherwise resolve
      if (entry.b) cell.building = entry.b.startsWith("/") ? entry.b : (theme === "dungeon" ? `/assets/dungeon/${entry.b}.png` : `/assets/city/Buildings/${entry.b}.png`)
      if (entry.p) cell.prop = entry.p.startsWith("/") ? entry.p : (theme === "dungeon" ? `/assets/dungeon/${entry.p}.png` : `/assets/city/Props/${entry.p}.png`)
      if (entry.v) cell.vehicle = entry.v.startsWith("/") ? entry.v : (theme === "dungeon" ? `/assets/dungeon/${entry.v}.png` : `/assets/city/Vehicles/${entry.v}.png`)
      return cell
    })
  )
}

function parseCellMap(cells: Cell[][], theme: string): Cell[][] {
  return cells.map((row) =>
    row.map((src) => {
      const cell: Cell = {
        ground: src.ground.startsWith("/") ? src.ground : resolveGround(src.ground),
      }
      if (src.building) cell.building = src.building
      if (src.prop) cell.prop = src.prop
      if (src.vehicle) cell.vehicle = src.vehicle
      return cell
    })
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseMapJSON(data: any): Cell[][] {
  const theme = data.theme || "city"
  if (data.legend && data.grid) {
    return parseLegendMap(data.legend, data.grid, theme)
  }
  if (data.cells) {
    return parseCellMap(data.cells, theme)
  }
  return []
}

// ============================================================
// Map is now loaded from JSON files
// ============================================================
// ============================================================
// Isometric projection
// ============================================================
function gridToScreen(gx: number, gy: number) {
  return {
    sx: (gx - gy) * (TILE_W / 2),
    sy: (gx + gy) * (TILE_H / 2),
  }
}

function screenToGrid(sx: number, sy: number) {
  const gx = (sx / (TILE_W / 2) + sy / (TILE_H / 2)) / 2
  const gy = (sy / (TILE_H / 2) - sx / (TILE_W / 2)) / 2
  return { gx: Math.floor(gx), gy: Math.floor(gy) }
}

// ============================================================
// Image preloader
// ============================================================
function collectPaths(map: Cell[][]): string[] {
  const set = new Set<string>()
  for (const row of map) {
    for (const c of row) {
      // Ground is stored as name or full path
      if (c.ground.startsWith("/")) set.add(c.ground)
      else set.add(resolveGround(c.ground))
      if (c.building) set.add(c.building)
      if (c.prop) set.add(c.prop)
      if (c.vehicle) set.add(c.vehicle)
    }
  }
  return [...set]
}

async function loadImages(paths: string[]): Promise<Map<string, HTMLImageElement>> {
  const imgs = new Map<string, HTMLImageElement>()
  await Promise.all(
    paths.map(
      (src) =>
        new Promise<void>((resolve) => {
          const img = new Image()
          img.onload = () => { imgs.set(src, img); resolve() }
          img.onerror = () => { console.warn("Failed:", src); resolve() }
          img.src = src
        })
    )
  )
  return imgs
}

// ============================================================
// Component
// ============================================================
export function IsometricWorld() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef(0)
  const imagesRef = useRef(new Map<string, HTMLImageElement>())
  const mapRef = useRef<Cell[][]>([])
  const blockedRef = useRef(new Set<string>())
  const [loaded, setLoaded] = useState(false)
  const [characters, setCharacters] = useState<Character[]>(createCharacters)
  const { data: session } = useSession()
  const userCharIdRef = useRef<string | null>(null)

  // Presence channel for online users
  const { members } = usePresenceChannel(session?.user ? "world" : "")

  // Sync characters from presence members + own session
  useEffect(() => {
    if (!session?.user) {
      if (userCharIdRef.current) {
        userCharIdRef.current = null
        setCharacters((prev) => prev.filter((c) => !c.id.startsWith("user-")))
      }
      return
    }

    // Ensure own character exists
    const ownChar = createUserCharacter(session.user.id, session.user.name)
    if (userCharIdRef.current !== ownChar.id) {
      userCharIdRef.current = ownChar.id
      BUBBLE_MESSAGES[session.user.name.split(" ")[0]] = USER_BUBBLE_MESSAGES
    }

    setCharacters((prev) => {
      const npcs = prev.filter((c) => !c.id.startsWith("user-"))
      const userChars: Character[] = []

      // Add own character
      const existingOwn = prev.find((c) => c.id === ownChar.id)
      userChars.push(existingOwn ? { ...existingOwn, name: ownChar.name } : ownChar)

      // Add other presence members
      for (const member of members) {
        if (member.id === session.user.id) continue
        const existingMember = prev.find((c) => c.id === `user-${member.id}`)
        if (existingMember) {
          userChars.push(existingMember)
        } else {
          const memberChar = createUserCharacter(member.id, member.info.name)
          BUBBLE_MESSAGES[member.info.name.split(" ")[0]] = USER_BUBBLE_MESSAGES
          userChars.push(memberChar)
        }
      }

      return [...npcs, ...userChars]
    })
  }, [session, members])

  // Pubby: listen for real-time user activity from Claude Code hooks
  const lastBubbleRef = useRef(0)
  useChannel("world", {
    "user-activity": (raw: unknown) => {
      const data = raw as { userId: string; userName: string; event: string; data: { activity: string }; timestamp: number }
      const now = performance.now()
      // Debounce: max 1 bubble per 3 seconds per user
      if (now - lastBubbleRef.current < 3000) return
      lastBubbleRef.current = now

      // Update browser tab title with latest activity
      document.title = `${data.data.activity} · clauder.world`

      setCharacters((prev) => {
        const idx = prev.findIndex((c) => c.id === `user-${data.userId}`)
        if (idx < 0) return prev
        const updated = [...prev]
        updated[idx] = {
          ...updated[idx],
          bubble: data.data.activity,
          bubbleUntil: now + BUBBLE_DURATION,
        }
        return updated
      })
    },
    "instance-count": (raw: unknown) => {
      const data = raw as { userId: string; count: number }
      setCharacters((prev) => {
        const idx = prev.findIndex((c) => c.id === `user-${data.userId}`)
        if (idx < 0) return prev
        const updated = [...prev]
        updated[idx] = { ...updated[idx], instanceCount: data.count }
        return updated
      })
    },
    "map-change": (raw: unknown) => {
      const data = raw as { map: string }
      setLoaded(false)
      loadMap(data.map)
    },
  })

  // Speech bubble timer - randomly assign bubbles to characters
  useEffect(() => {
    const scheduleNext = () => {
      const delay = BUBBLE_INTERVAL_MIN + Math.random() * (BUBBLE_INTERVAL_MAX - BUBBLE_INTERVAL_MIN)
      return setTimeout(() => {
        setCharacters((prev) => {
          // Only pick from NPC characters (not logged-in users)
          const npcIndices = prev.map((c, i) => c.id.startsWith("user-") ? -1 : i).filter((i) => i >= 0)
          if (npcIndices.length === 0) return prev
          const idx = npcIndices[Math.floor(Math.random() * npcIndices.length)]
          const char = prev[idx]
          const msgs = BUBBLE_MESSAGES[char.name] || BUBBLE_MESSAGES.Claude
          const msg = msgs[Math.floor(Math.random() * msgs.length)]
          const now = performance.now()
          const updated = [...prev]
          updated[idx] = { ...char, bubble: msg, bubbleUntil: now + BUBBLE_DURATION }
          return updated
        })
        timerRef = scheduleNext()
      }, delay)
    }
    let timerRef = scheduleNext()
    return () => clearTimeout(timerRef)
  }, [])

  const panRef = useRef({ x: 0, y: 0 })
  const zoomRef = useRef(1)
  const dragRef = useRef({ active: false, startX: 0, startY: 0, panStartX: 0, panStartY: 0 })
  const didDragRef = useRef(false)

  const loadMap = useCallback((mapId: string) => {
    fetch(`/api/world/map/data?id=${mapId}`)
      .then((r) => r.json())
      .then((data) => {
        const map = parseMapJSON(data.mapData)
        mapRef.current = map
        return loadImages(collectPaths(map))
      })
      .then((imgs) => {
        imagesRef.current = imgs
        const map = mapRef.current
        const gw = map[0]?.length ?? 0
        const gh = map.length
        const center = gridToScreen(gw / 2, gh / 2)
        panRef.current = {
          x: window.innerWidth / 2 - center.sx,
          y: window.innerHeight / 2 - center.sy,
        }
        setLoaded(true)
      })
      .catch((err) => {
        console.error("Failed to load map:", err)
      })
  }, [])

  // Load initial map from API
  useEffect(() => {
    fetch("/api/world/map")
      .then((r) => r.json())
      .then((data) => loadMap(data.map))
      .catch(() => loadMap("city_map"))
  }, [loadMap])

  const render = useCallback(
    (time: number) => {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext("2d")
      if (!ctx) return

      const W = window.innerWidth
      const H = window.innerHeight
      const dpr = window.devicePixelRatio || 1

      if (canvas.width !== W * dpr || canvas.height !== H * dpr) {
        canvas.width = W * dpr
        canvas.height = H * dpr
        canvas.style.width = `${W}px`
        canvas.style.height = `${H}px`
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      // Sky (drawn without zoom)
      const sky = ctx.createLinearGradient(0, 0, 0, H)
      sky.addColorStop(0, "#87CEEB")
      sky.addColorStop(0.7, "#B0E0E6")
      sky.addColorStop(1, "#90C695")
      ctx.fillStyle = sky
      ctx.fillRect(0, 0, W, H)

      // Apply zoom + pan
      const z = zoomRef.current
      ctx.setTransform(dpr * z, 0, 0, dpr * z, 0, 0)
      ctx.imageSmoothingEnabled = false

      const imgs = imagesRef.current
      const map = mapRef.current
      const gh = map.length
      const gw = map[0]?.length ?? 0
      const px = panRef.current.x
      const py = panRef.current.y

      type D = { depth: number; fn: () => void }
      const groundD: D[] = []
      const objectD: D[] = []

      for (let gy = 0; gy < gh; gy++) {
        for (let gx = 0; gx < gw; gx++) {
          const { sx, sy } = gridToScreen(gx, gy)
          const scrX = sx + px
          const scrY = sy + py

          if (scrX < -TILE_W * 6 || scrX > W / z + TILE_W * 6 || scrY < -800 || scrY > H / z + TILE_H * 6)
            continue

          const cell = map[gy][gx]
          const depth = (gx + gy) * 100 + gx

          // Detect if this cell is dungeon (ground path contains /dungeon/)
          const groundPath = cell.ground
          const dungeon = isDungeonPath(groundPath)

          const gImg = imgs.get(groundPath)
          if (gImg) {
            if (dungeon) {
              const dw = gImg.width * DUNGEON_SCALE
              const dh = gImg.height * DUNGEON_SCALE
              groundD.push({
                depth,
                fn: () => ctx.drawImage(gImg, scrX - dw / 2, scrY + TILE_H / 2 - dh, dw, dh),
              })
            } else {
              groundD.push({
                depth,
                fn: () => ctx.drawImage(gImg, scrX - TILE_W / 2, scrY - TILE_H / 2, TILE_W, TILE_H),
              })
            }
          }

          const drawObj = (img: HTMLImageElement, sX: number, sY: number, depthVal: number) => {
            const isDng = isDungeonPath(cell.building || "") || isDungeonPath(cell.prop || "") || isDungeonPath(cell.vehicle || "") || dungeon
            if (isDng) {
              const dw = img.width * DUNGEON_SCALE
              const dh = img.height * DUNGEON_SCALE
              objectD.push({ depth: depthVal, fn: () => ctx.drawImage(img, sX - dw / 2, sY + TILE_H / 2 - dh, dw, dh) })
            } else {
              objectD.push({ depth: depthVal, fn: () => ctx.drawImage(img, sX - img.width / 2, sY + TILE_H / 2 - img.height, img.width, img.height) })
            }
          }

          if (cell.building) {
            const img = imgs.get(cell.building)
            if (img) drawObj(img, scrX, scrY, depth + 50)
          }

          if (cell.prop) {
            const img = imgs.get(cell.prop)
            if (img) drawObj(img, scrX, scrY, depth)
          }

          if (cell.vehicle) {
            const img = imgs.get(cell.vehicle)
            if (img) drawObj(img, scrX, scrY, depth + 25)
          }
        }
      }

      // Characters as objects
      for (const c of characters) {
        const { sx, sy } = gridToScreen(c.gridX, c.gridY)
        const scrX = sx + px
        const scrY = sy + py
        if (scrX < -400 || scrX > W / z + 400 || scrY < -400 || scrY > H / z + 400) continue
        objectD.push({
          depth: (c.gridX + c.gridY) * 100 + c.gridX + 30,
          fn: () => drawCharacter(ctx, c, scrX, scrY, time),
        })
      }

      groundD.sort((a, b) => a.depth - b.depth)
      objectD.sort((a, b) => a.depth - b.depth)
      for (const d of groundD) d.fn()
      for (const d of objectD) d.fn()

      // HUD (reset transform - no zoom)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.fillStyle = "rgba(0,0,0,0.5)"
      ctx.beginPath()
      ctx.roundRect(16, 16, 220, 56, 8)
      ctx.fill()
      ctx.fillStyle = "#fff"
      ctx.font = "bold 15px monospace"
      ctx.textAlign = "left"
      ctx.fillText("clauder.world", 28, 36)
      ctx.font = "10px monospace"
      ctx.fillStyle = "rgba(255,255,255,0.6)"
      ctx.fillText("drag to explore | scroll to zoom", 28, 52)
      ctx.fillText(`${characters.length} characters online`, 28, 64)

      // Character legend
      const legendY = H - 20
      ctx.font = "10px monospace"
      ctx.textAlign = "center"
      const totalW = characters.length * 75
      const startX = W / 2 - totalW / 2
      characters.forEach((c, i) => {
        const lx = startX + i * 75 + 37
        ctx.fillStyle = c.color
        ctx.fillRect(Math.round(lx - 18), legendY - 5, 7, 7)
        ctx.fillStyle = "rgba(255,255,255,0.55)"
        ctx.fillText(c.name, lx + 4, legendY + 2)
      })

      animRef.current = requestAnimationFrame(render)
    },
    [loaded, characters]
  )

  useEffect(() => {
    if (!loaded) return
    animRef.current = requestAnimationFrame(render)
    return () => cancelAnimationFrame(animRef.current)
  }, [loaded, render])

  // Prevent browser gestures (pinch zoom, double-tap zoom) on the canvas
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const prevent = (e: Event) => e.preventDefault()
    canvas.addEventListener("gesturestart", prevent, { passive: false })
    canvas.addEventListener("gesturechange", prevent, { passive: false })
    canvas.addEventListener("gestureend", prevent, { passive: false })
    // Ensure wheel events with passive: false for preventDefault to work
    canvas.addEventListener("wheel", prevent, { passive: false })
    return () => {
      canvas.removeEventListener("gesturestart", prevent)
      canvas.removeEventListener("gesturechange", prevent)
      canvas.removeEventListener("gestureend", prevent)
      canvas.removeEventListener("wheel", prevent)
    }
  }, [])

  // Pan
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    didDragRef.current = false
    dragRef.current = {
      active: true,
      startX: e.clientX, startY: e.clientY,
      panStartX: panRef.current.x, panStartY: panRef.current.y,
    }
  }, [])
  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragRef.current.active) return
    const dx = e.clientX - dragRef.current.startX
    const dy = e.clientY - dragRef.current.startY
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) didDragRef.current = true
    const z = zoomRef.current
    panRef.current.x = dragRef.current.panStartX + dx / z
    panRef.current.y = dragRef.current.panStartY + dy / z
  }, [])
  const onMouseUp = useCallback(() => { dragRef.current.active = false }, [])

  // Zoom (towards cursor)
  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const oldZ = zoomRef.current
    const delta = e.deltaY > 0 ? 0.9 : 1.1
    const newZ = Math.max(0.2, Math.min(4, oldZ * delta))
    // Zoom towards cursor position
    const mx = e.clientX
    const my = e.clientY
    panRef.current.x = mx / newZ - (mx / oldZ - panRef.current.x)
    panRef.current.y = my / newZ - (my / oldZ - panRef.current.y)
    zoomRef.current = newZ
  }, [])

  // Reset zoom & pan to center
  const resetView = useCallback(() => {
    const map = mapRef.current
    const gw = map[0]?.length ?? 0
    const gh = map.length
    const center = gridToScreen(gw / 2, gh / 2)
    zoomRef.current = 1
    panRef.current = {
      x: window.innerWidth / 2 - center.sx,
      y: window.innerHeight / 2 - center.sy,
    }
  }, [])

  // Touch (with pinch-to-zoom)
  const pinchRef = useRef({ active: false, dist: 0, startZoom: 1 })
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault()
    didDragRef.current = false
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX
      const dy = e.touches[0].clientY - e.touches[1].clientY
      pinchRef.current = { active: true, dist: Math.hypot(dx, dy), startZoom: zoomRef.current }
      dragRef.current.active = false
      return
    }
    const t = e.touches[0]
    dragRef.current = {
      active: true,
      startX: t.clientX, startY: t.clientY,
      panStartX: panRef.current.x, panStartY: panRef.current.y,
    }
  }, [])
  const onTouchMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault()
    if (e.touches.length === 2 && pinchRef.current.active) {
      const dx = e.touches[0].clientX - e.touches[1].clientX
      const dy = e.touches[0].clientY - e.touches[1].clientY
      const dist = Math.hypot(dx, dy)
      const scale = dist / pinchRef.current.dist
      zoomRef.current = Math.max(0.2, Math.min(4, pinchRef.current.startZoom * scale))
      didDragRef.current = true
      return
    }
    if (!dragRef.current.active) return
    const t = e.touches[0]
    const dx = t.clientX - dragRef.current.startX
    const dy = t.clientY - dragRef.current.startY
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) didDragRef.current = true
    const z = zoomRef.current
    panRef.current.x = dragRef.current.panStartX + dx / z
    panRef.current.y = dragRef.current.panStartY + dy / z
  }, [])
  const onTouchEnd = useCallback(() => {
    dragRef.current.active = false
    pinchRef.current.active = false
  }, [])

  // Click to move character
  const onClick = useCallback(
    (e: React.MouseEvent) => {
      if (didDragRef.current) return
      const z = zoomRef.current
      const sx = e.clientX / z - panRef.current.x
      const sy = e.clientY / z - panRef.current.y
      const { gx, gy } = screenToGrid(sx, sy)
      const map = mapRef.current
      const gridH = map.length
      const gridW = map[0]?.length ?? 0
      if (gx < 0 || gx >= gridW || gy < 0 || gy >= gridH) return
      if (blockedRef.current.has(`${gx},${gy}`)) return

      setCharacters((prev) => {
        // If logged in, move the user's character; otherwise move a random one
        const userIdx = prev.findIndex((c) => c.id.startsWith("user-"))
        const idx = userIdx >= 0 ? userIdx : Math.floor(Math.random() * prev.length)
        const updated = [...prev]
        const c = { ...updated[idx] }
        const dx = gx - c.gridX
        const dy = gy - c.gridY
        const nx = c.gridX + Math.sign(dx)
        const ny = c.gridY + Math.sign(dy)
        if (blockedRef.current.has(`${nx},${ny}`)) return prev
        c.gridX = nx
        c.gridY = ny
        c.dir = dx >= 0 ? "right" : "left"
        updated[idx] = c
        return updated
      })
    },
    []
  )

  if (!loaded) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-gradient-to-b from-sky-300 to-green-400">
        <p className="text-white font-mono text-lg animate-pulse drop-shadow-md">Loading world...</p>
      </div>
    )
  }

  return (
    <>
      <canvas
        ref={canvasRef}
        className="fixed inset-0 cursor-grab active:cursor-grabbing"
        style={{ imageRendering: "pixelated", touchAction: "none" }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onWheel={onWheel}
        onClick={onClick}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      />
      <button
        onClick={resetView}
        className="fixed top-[80px] left-4 px-3 py-1.5 rounded-lg bg-black/50 hover:bg-black/70 text-white text-xs font-mono backdrop-blur-sm transition-colors cursor-pointer"
      >
        Reset Zoom
      </button>
    </>
  )
}
