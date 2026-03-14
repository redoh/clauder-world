"use client"

import { useEffect, useRef, useState } from "react"
import {
  DEFAULT_GROUNDS,
  groundPath as resolveGroundPath,
  type MapTheme,
} from "@/lib/asset-catalog"

const TILE_W = 128
const TILE_H = 64
const DUNGEON_SCALE = 0.5

interface Cell {
  ground: string
  building?: string
  prop?: string
  vehicle?: string
}

interface LegendEntry {
  g: string
  b?: string
  p?: string
  v?: string
}

function gridToScreen(gx: number, gy: number) {
  return {
    sx: (gx - gy) * (TILE_W / 2),
    sy: (gx + gy) * (TILE_H / 2),
  }
}

function parseCells(mapData: Record<string, unknown>): { cells: Cell[][]; theme: MapTheme } {
  if (mapData.legend && mapData.grid) {
    const legend = mapData.legend as Record<string, LegendEntry>
    const grid = mapData.grid as string[]
    const theme = (mapData.theme as MapTheme) || "city"
    const cells = grid.map((row) =>
      Array.from(row).map((sym) => {
        const entry = legend[sym]
        if (!entry) return { ground: DEFAULT_GROUNDS[theme] }
        const cell: Cell = { ground: entry.g }
        if (entry.b) cell.building = entry.b
        if (entry.p) cell.prop = entry.p
        if (entry.v) cell.vehicle = entry.v
        return cell
      })
    )
    return { cells, theme }
  }
  if (mapData.cells) {
    return {
      cells: mapData.cells as Cell[][],
      theme: (mapData.theme as MapTheme) || "city",
    }
  }
  return { cells: [], theme: "city" }
}

function collectPaths(cells: Cell[][], theme: MapTheme): string[] {
  const set = new Set<string>()
  for (const row of cells) {
    for (const c of row) {
      set.add(resolveGroundPath(c.ground, theme))
      if (c.building) set.add(c.building)
      if (c.prop) set.add(c.prop)
      if (c.vehicle) set.add(c.vehicle)
    }
  }
  return [...set]
}

async function loadImages(paths: string[]): Promise<Map<string, HTMLImageElement>> {
  const map = new Map<string, HTMLImageElement>()
  await Promise.all(
    paths.map(
      (src) =>
        new Promise<void>((resolve) => {
          const img = new Image()
          img.onload = () => { map.set(src, img); resolve() }
          img.onerror = () => resolve()
          img.src = src
        })
    )
  )
  return map
}

export function MapPreview({ mapData }: { mapData: Record<string, unknown> }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [loading, setLoading] = useState(true)
  const dataRef = useRef<{ cells: Cell[][]; theme: MapTheme; images: Map<string, HTMLImageElement> } | null>(null)
  const panRef = useRef({ x: 0, y: 0 })
  const zoomRef = useRef(1)
  const dragRef = useRef({ active: false, startX: 0, startY: 0, panStartX: 0, panStartY: 0 })
  const animRef = useRef(0)

  useEffect(() => {
    const { cells, theme } = parseCells(mapData)
    if (cells.length === 0) { setLoading(false); return }

    const paths = collectPaths(cells, theme)
    loadImages(paths).then((images) => {
      dataRef.current = { cells, theme, images }

      // Auto-center
      const gw = cells[0]?.length ?? 0
      const gh = cells.length
      const canvas = canvasRef.current
      if (canvas) {
        const centerScreen = gridToScreen(gw / 2, gh / 2)
        panRef.current.x = canvas.clientWidth / 2 - centerScreen.sx
        panRef.current.y = canvas.clientHeight / 4 - centerScreen.sy
        // Auto-zoom to fit
        const mapPixelW = (gw + gh) * (TILE_W / 2)
        const mapPixelH = (gw + gh) * (TILE_H / 2)
        const scaleX = canvas.clientWidth / mapPixelW
        const scaleY = canvas.clientHeight / mapPixelH
        zoomRef.current = Math.min(scaleX, scaleY, 1) * 0.85
      }

      setLoading(false)
    })
  }, [mapData])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || loading) return

    const render = () => {
      const d = dataRef.current
      if (!d) { animRef.current = requestAnimationFrame(render); return }

      const dpr = window.devicePixelRatio || 1
      const W = canvas.clientWidth
      const H = canvas.clientHeight
      canvas.width = W * dpr
      canvas.height = H * dpr
      const ctx = canvas.getContext("2d")!
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, W, H)

      const z = zoomRef.current
      ctx.setTransform(dpr * z, 0, 0, dpr * z, 0, 0)
      ctx.imageSmoothingEnabled = false

      const { cells, theme, images } = d
      const gw = cells[0]?.length ?? 0
      const gh = cells.length
      const px = panRef.current.x
      const py = panRef.current.y
      const isDungeon = theme === "dungeon"

      const drawObj = (img: HTMLImageElement, sX: number, sY: number) => {
        if (isDungeon) {
          const dw = img.width * DUNGEON_SCALE
          const dh = img.height * DUNGEON_SCALE
          ctx.drawImage(img, sX - dw / 2, sY + TILE_H / 2 - dh, dw, dh)
        } else {
          ctx.drawImage(img, sX - img.width / 2, sY + TILE_H / 2 - img.height, img.width, img.height)
        }
      }

      type Drawable = { depth: number; fn: () => void }
      const groundDraws: Drawable[] = []
      const objectDraws: Drawable[] = []

      for (let gy = 0; gy < gh; gy++) {
        for (let gx = 0; gx < gw; gx++) {
          const { sx, sy } = gridToScreen(gx, gy)
          const screenX = sx + px
          const screenY = sy + py
          const cell = cells[gy][gx]
          const depth = (gx + gy) * 100 + gx

          const gPath = resolveGroundPath(cell.ground, theme)
          const gImg = images.get(gPath)
          if (gImg) {
            if (isDungeon) {
              const dw = gImg.width * DUNGEON_SCALE
              const dh = gImg.height * DUNGEON_SCALE
              groundDraws.push({ depth, fn: () => ctx.drawImage(gImg, screenX - dw / 2, screenY + TILE_H / 2 - dh, dw, dh) })
            } else {
              groundDraws.push({ depth, fn: () => ctx.drawImage(gImg, screenX - TILE_W / 2, screenY - TILE_H / 2, TILE_W, TILE_H) })
            }
          }

          if (cell.building) {
            const img = images.get(cell.building)
            if (img) objectDraws.push({ depth: depth + 50, fn: () => drawObj(img, screenX, screenY) })
          }
          if (cell.prop) {
            const img = images.get(cell.prop)
            if (img) objectDraws.push({ depth, fn: () => drawObj(img, screenX, screenY) })
          }
          if (cell.vehicle) {
            const img = images.get(cell.vehicle)
            if (img) objectDraws.push({ depth: depth + 25, fn: () => drawObj(img, screenX, screenY) })
          }
        }
      }

      groundDraws.sort((a, b) => a.depth - b.depth)
      for (const d of groundDraws) d.fn()
      objectDraws.sort((a, b) => a.depth - b.depth)
      for (const d of objectDraws) d.fn()

      animRef.current = requestAnimationFrame(render)
    }

    animRef.current = requestAnimationFrame(render)
    return () => cancelAnimationFrame(animRef.current)
  }, [loading])

  // Pan & zoom handlers
  const onMouseDown = (e: React.MouseEvent) => {
    dragRef.current = { active: true, startX: e.clientX, startY: e.clientY, panStartX: panRef.current.x, panStartY: panRef.current.y }
  }
  const onMouseMove = (e: React.MouseEvent) => {
    if (!dragRef.current.active) return
    const z = zoomRef.current
    panRef.current.x = dragRef.current.panStartX + (e.clientX - dragRef.current.startX) / z
    panRef.current.y = dragRef.current.panStartY + (e.clientY - dragRef.current.startY) / z
  }
  const onMouseUp = () => { dragRef.current.active = false }
  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? 0.9 : 1.1
    zoomRef.current = Math.max(0.1, Math.min(5, zoomRef.current * delta))
  }

  return (
    <div className="relative w-full h-full">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-zinc-900/80">
          <span className="text-sm text-zinc-400 animate-pulse">Loading preview...</span>
        </div>
      )}
      <canvas
        ref={canvasRef}
        className="w-full h-full cursor-grab active:cursor-grabbing"
        style={{ imageRendering: "pixelated" }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={() => { dragRef.current.active = false }}
        onWheel={onWheel}
      />
    </div>
  )
}
