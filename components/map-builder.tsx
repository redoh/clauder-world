"use client"

import { useEffect, useRef, useCallback, useState } from "react"
import {
  ALL_ASSETS,
  CATEGORY_LABELS,
  DEFAULT_GROUNDS,
  groundPath as resolveGroundPath,
  type AssetCategory,
  type AssetEntry,
  type MapTheme,
} from "@/lib/asset-catalog"
import {
  RiEraserLine,
  RiDownloadLine,
  RiUploadLine,
  RiDeleteBinLine,
  RiGridLine,
  RiArrowLeftLine,
  RiMagicLine,
  RiSparklingLine,
  RiLoader4Line,
  RiSipLine,
} from "@remixicon/react"

// ============================================================
// Constants
// ============================================================
const TILE_W = 128
const TILE_H = 64
const DEFAULT_GRID_W = 24
const DEFAULT_GRID_H = 24

// ============================================================
// Types
// ============================================================
interface Cell {
  ground: string
  building?: string
  prop?: string
  vehicle?: string
}

type LayerType = "ground" | "building" | "prop" | "vehicle"

interface MapJSON {
  gridWidth: number
  gridHeight: number
  theme?: MapTheme
  cells: Cell[][]
}

// Legend+grid compact format
interface LegendEntry {
  g: string       // ground
  b?: string      // building
  p?: string      // prop
  v?: string      // vehicle
}

interface LegendMapJSON {
  theme?: MapTheme
  legend: Record<string, LegendEntry>
  grid: string[]
}

// ============================================================
// Helpers
// ============================================================
// Dungeon tiles are 256x512 (2x city), so we render at half scale
const DUNGEON_SCALE = 0.5

function gridToScreen(gx: number, gy: number) {
  return {
    sx: (gx - gy) * (TILE_W / 2),
    sy: (gx + gy) * (TILE_H / 2),
  }
}

function screenToGrid(
  sx: number,
  sy: number,
  panX: number,
  panY: number
): { gx: number; gy: number } {
  const rx = sx - panX
  const ry = sy - panY
  const gx = (rx / (TILE_W / 2) + ry / (TILE_H / 2)) / 2
  const gy = (ry / (TILE_H / 2) - rx / (TILE_W / 2)) / 2
  return { gx: Math.floor(gx), gy: Math.floor(gy) }
}

function createEmptyMap(w: number, h: number, theme: MapTheme = "city"): Cell[][] {
  const defaultGround = DEFAULT_GROUNDS[theme]
  return Array.from({ length: h }, () =>
    Array.from({ length: w }, () => ({ ground: defaultGround }))
  )
}

function collectPaths(map: Cell[][], theme: MapTheme): string[] {
  const set = new Set<string>()
  for (const row of map) {
    for (const c of row) {
      set.add(resolveGroundPath(c.ground, theme))
      if (c.building) set.add(c.building)
      if (c.prop) set.add(c.prop)
      if (c.vehicle) set.add(c.vehicle)
    }
  }
  return [...set]
}

async function loadImages(
  paths: string[]
): Promise<Map<string, HTMLImageElement>> {
  const map = new Map<string, HTMLImageElement>()
  await Promise.all(
    paths.map(
      (src) =>
        new Promise<void>((resolve) => {
          const img = new Image()
          img.onload = () => {
            map.set(src, img)
            resolve()
          }
          img.onerror = () => resolve()
          img.src = src
        })
    )
  )
  return map
}

function layerFromCategory(cat: AssetCategory): LayerType {
  switch (cat) {
    case "grounds":
      return "ground"
    case "buildings":
      return "building"
    case "props":
      return "prop"
    case "vehicles":
      return "vehicle"
  }
}

// ============================================================
// Random map generator
// ============================================================
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function chance(p: number): boolean {
  return Math.random() < p
}

const CB = (n: string) => `/assets/city/Buildings/${n}.png`
const CP = (n: string) => `/assets/city/Props/${n}.png`
const CV = (n: string) => `/assets/city/Vehicles/${n}.png`

const ROAD_GROUNDS = [
  "tile_road_straight_SE_normal",
  "tile_road_straight_SW_normal",
]
const DIRT_ROADS = ["tile_dirtroad_straight_SE", "tile_dirtroad_straight_SW"]
const NATURAL_GROUNDS = [
  "tile_ground_grass",
  "tile_ground_grass_puddle",
  "tile_ground_dirt_normal",
]
const URBAN_GROUNDS = [
  "tile_ground_concrete_normal",
  "tile_ground_asphalt_normal",
]
const CROP_GROUNDS = [
  "tile_cropfield_growing",
  "tile_cropfield_grown",
  "tile_cropfield_racked",
]

const HOUSES = [
  "bld_house_blue_SE_normal",
  "bld_house_red_SE_normal",
  "bld_house_yellow_SE_normal",
  "bld_house_purple_SE_normal",
  "bld_house2_brown_SE_normal",
  "bld_house2_blue_SE_normal",
  "bld_house2_sand_SE_normal",
  "bld_house2_white_SE_normal",
  "bld_house3_green_SE_normal",
  "bld_house3_blue_SE_normal",
  "bld_house3_brown_SE_normal",
  "bld_house3_purple_SE_normal",
]
const COMMERCIAL = [
  "bld_cafe_pink_SE_normal",
  "bld_barbershop_purple_SE_normal",
  "bld_fruitstand_neutral_SE_normal",
  "bld_gunshop_gray_SE_normal",
  "bld_office_gray_SE_normal",
  "bld_office_brown_SE_normal",
  "bld_office2_blue_SE_normal",
  "bld_office2_green_SE_normal",
  "bld_office3_blue_SE_normal",
  "bld_office3_yellow_SE_normal",
]
const CIVIC = [
  "bld_hospital_white_SE_normal",
  "bld_policestation_blue_SE_normal",
  "bld_church_neutral_SE_normal",
  "bld_clinic_mint_SE_normal",
  "bld_firestation_SE_normal",
]
const INDUSTRIAL = [
  "bld_warehouse_brown_SE_normal",
  "bld_warehouse_orange_SE_normal",
  "bld_gasstation_green_SE_normal",
  "bld_autoshop_yellow_SE_normal",
  "bld_barn_red_SE_normal",
  "bld_contruction_neutral_SE_normal",
  "bld_watertower_blue_SE_normal",
]
const RURAL = [
  "bld_mobile_blue_SE_normal",
  "bld_mobile_green_SE_normal",
  "bld_mobile_purple_SE_normal",
  "bld_barn_red_SE_normal",
]

const TREES = [
  "prop_tree_styleA_normal",
  "prop_tree_styleB_normal",
  "prop_tree_styleC_normal",
]
const NATURE_PROPS = [
  ...TREES,
  "prop_flowers_pink",
  "prop_flowers_red",
  "prop_flowers_yellow",
  "prop_rock_brown",
  "prop_rock_gray",
  "prop_weeds_styleA",
  "prop_weeds_styleB",
  "prop_weeds_styleC",
  "prop_weeds_styleD",
]
const URBAN_PROPS = [
  "prop_lightpole_standard_SE_normal",
  "prop_trafficlight_standard_SE_normal",
  "prop_trashcan_blue_SE_normal",
  "prop_trashcan_green_SE_normal",
  "prop_mailbox_standard_SE_normal",
  "prop_cautionsign_standard_SE_normal",
  "prop_fence_wood_SE_normal",
  "prop_trashbag_black_styleA",
]

const CIVILIAN_VEHICLES = [
  "veh_sedan_blue_SE_normal",
  "veh_sedan_red_SE_normal",
  "veh_sedan_white_SE_normal",
  "veh_pickup_blue_SE_normal",
  "veh_pickup_green_SE_normal",
  "veh_pickup_orange_SE_normal",
  "veh_van_white_SE_normal",
  "veh_van_black_SE_normal",
  "veh_van_purple_SE_normal",
  "veh_truck_green_SE_normal",
  "veh_truck_red_SE_normal",
  "veh_truck_yellow_SE_normal",
]
const SPECIAL_VEHICLES = [
  "veh_ambulance_SE_normal",
  "veh_patrol_SE_normal",
  "veh_firetruck_SE_normal",
  "veh_swat_SE_normal",
  "veh_schoolbus_SE_normal",
  "veh_box_green_SE_normal",
  "veh_box_yellow_SE_normal",
]

function generateRandomCityMap(w: number, h: number): Cell[][] {
  const defaultGround = DEFAULT_GROUNDS.city
  const m: Cell[][] = Array.from({ length: h }, () =>
    Array.from({ length: w }, () => ({ ground: defaultGround }))
  )

  const sg = (x: number, y: number, name: string) => {
    if (x >= 0 && x < w && y >= 0 && y < h) m[y][x].ground = name
  }
  const sb = (x: number, y: number, name: string) => {
    if (x >= 0 && x < w && y >= 0 && y < h) m[y][x].building = CB(name)
  }
  const sp = (x: number, y: number, name: string) => {
    if (x >= 0 && x < w && y >= 0 && y < h) m[y][x].prop = CP(name)
  }
  const sv = (x: number, y: number, name: string) => {
    if (x >= 0 && x < w && y >= 0 && y < h) m[y][x].vehicle = CV(name)
  }

  const isOccupied = (x: number, y: number) => {
    if (x < 0 || x >= w || y < 0 || y >= h) return true
    const c = m[y][x]
    return !!c.building || !!c.prop || !!c.vehicle
  }

  // --- ROADS: generate a grid of roads with random spacing ---
  const hRoads: number[] = []
  const vRoads: number[] = []

  // Place horizontal roads (SE direction) at semi-random intervals
  {
    let y = 3 + Math.floor(Math.random() * 3)
    while (y < h - 2) {
      hRoads.push(y)
      y += 5 + Math.floor(Math.random() * 4)
    }
  }
  // Place vertical roads (SW direction) at semi-random intervals
  {
    let x = 3 + Math.floor(Math.random() * 3)
    while (x < w - 2) {
      vRoads.push(x)
      x += 5 + Math.floor(Math.random() * 4)
    }
  }

  // Draw horizontal roads
  for (const ry of hRoads) {
    for (let x = 0; x < w; x++) {
      sg(x, ry, vRoads.includes(x) ? "tile_road_xing_normal" : "tile_road_straight_SE_normal")
    }
  }
  // Draw vertical roads
  for (const rx of vRoads) {
    for (let y = 0; y < h; y++) {
      if (!hRoads.includes(y)) {
        sg(rx, y, "tile_road_straight_SW_normal")
      }
    }
  }

  // Sidewalks adjacent to roads
  for (const ry of hRoads) {
    for (let x = 0; x < w; x++) {
      if (ry - 1 >= 0 && m[ry - 1][x].ground === defaultGround)
        sg(x, ry - 1, "tile_ground_concrete_normal")
      if (ry + 1 < h && m[ry + 1][x].ground === defaultGround)
        sg(x, ry + 1, "tile_ground_concrete_normal")
    }
  }
  for (const rx of vRoads) {
    for (let y = 0; y < h; y++) {
      if (rx - 1 >= 0 && m[y][rx - 1].ground === defaultGround)
        sg(rx - 1, y, "tile_ground_concrete_normal")
      if (rx + 1 < w && m[y][rx + 1].ground === defaultGround)
        sg(rx + 1, y, "tile_ground_concrete_normal")
    }
  }

  // --- ZONES: assign each block a zone type ---
  // Blocks are the areas between roads
  const blockXRanges: [number, number][] = []
  {
    let prev = 0
    for (const rx of vRoads) {
      if (rx - 1 > prev) blockXRanges.push([prev, rx - 1])
      prev = rx + 1
    }
    if (prev < w) blockXRanges.push([prev, w - 1])
  }
  const blockYRanges: [number, number][] = []
  {
    let prev = 0
    for (const ry of hRoads) {
      if (ry - 1 > prev) blockYRanges.push([prev, ry - 1])
      prev = ry + 1
    }
    if (prev < h) blockYRanges.push([prev, h - 1])
  }

  type ZoneType = "residential" | "commercial" | "civic" | "industrial" | "park" | "farm" | "rural"
  const ZONE_TYPES: ZoneType[] = [
    "residential", "residential", "commercial", "civic",
    "industrial", "park", "farm", "rural",
  ]

  for (const [x0, x1] of blockXRanges) {
    for (const [y0, y1] of blockYRanges) {
      const zone = pick(ZONE_TYPES)
      const bw = x1 - x0 + 1
      const bh = y1 - y0 + 1

      switch (zone) {
        case "residential": {
          // Place 1-3 houses with driveways
          const count = Math.min(3, Math.floor((bw * bh) / 6))
          for (let i = 0; i < count; i++) {
            const bx = x0 + 1 + Math.floor(Math.random() * Math.max(1, bw - 2))
            const by = y0 + 1 + Math.floor(Math.random() * Math.max(1, bh - 2))
            if (!isOccupied(bx, by)) {
              sb(bx, by, pick(HOUSES))
              // Driveway below
              if (by + 1 <= y1 && !isOccupied(bx, by + 1))
                sg(bx, by + 1, "tile_ground_asphalt_normal")
            }
          }
          // Scatter trees and flowers
          for (let y = y0; y <= y1; y++) {
            for (let x = x0; x <= x1; x++) {
              if (!isOccupied(x, y) && chance(0.15)) sp(x, y, pick(NATURE_PROPS))
            }
          }
          // Maybe a parked car
          if (chance(0.5)) {
            const cx = x0 + Math.floor(Math.random() * bw)
            const cy = y0 + Math.floor(Math.random() * bh)
            if (!isOccupied(cx, cy)) sv(cx, cy, pick(CIVILIAN_VEHICLES))
          }
          break
        }

        case "commercial": {
          // Concrete ground
          for (let y = y0; y <= y1; y++)
            for (let x = x0; x <= x1; x++)
              if (m[y][x].ground === defaultGround) sg(x, y, pick(URBAN_GROUNDS))

          // Place shops
          const count = Math.min(3, Math.floor((bw * bh) / 5))
          for (let i = 0; i < count; i++) {
            const bx = x0 + 1 + Math.floor(Math.random() * Math.max(1, bw - 2))
            const by = y0 + Math.floor(Math.random() * Math.max(1, bh - 1))
            if (!isOccupied(bx, by)) sb(bx, by, pick(COMMERCIAL))
          }
          // Urban props
          for (let y = y0; y <= y1; y++)
            for (let x = x0; x <= x1; x++)
              if (!isOccupied(x, y) && chance(0.12)) sp(x, y, pick(URBAN_PROPS))
          // Delivery van
          if (chance(0.6)) {
            const cx = x0 + Math.floor(Math.random() * bw)
            const cy = y0 + Math.floor(Math.random() * bh)
            if (!isOccupied(cx, cy)) sv(cx, cy, pick([...CIVILIAN_VEHICLES, "veh_box_green_SE_normal"]))
          }
          break
        }

        case "civic": {
          // Place 1-2 civic buildings
          const count = Math.min(2, Math.floor((bw * bh) / 6))
          for (let i = 0; i < count; i++) {
            const bx = x0 + 1 + Math.floor(Math.random() * Math.max(1, bw - 2))
            const by = y0 + 1 + Math.floor(Math.random() * Math.max(1, bh - 2))
            if (!isOccupied(bx, by)) {
              sb(bx, by, pick(CIVIC))
              sg(bx, by, pick(URBAN_GROUNDS))
            }
          }
          // Light poles
          for (let y = y0; y <= y1; y++)
            for (let x = x0; x <= x1; x++)
              if (!isOccupied(x, y) && chance(0.08)) sp(x, y, pick(URBAN_PROPS))
          // Emergency vehicle
          if (chance(0.5)) {
            const cx = x0 + Math.floor(Math.random() * bw)
            const cy = y0 + Math.floor(Math.random() * bh)
            if (!isOccupied(cx, cy)) sv(cx, cy, pick(SPECIAL_VEHICLES))
          }
          break
        }

        case "industrial": {
          // Asphalt ground
          for (let y = y0; y <= y1; y++)
            for (let x = x0; x <= x1; x++)
              if (m[y][x].ground === defaultGround) sg(x, y, chance(0.7) ? "tile_ground_asphalt_normal" : "tile_ground_dirt_normal")

          const count = Math.min(2, Math.floor((bw * bh) / 7))
          for (let i = 0; i < count; i++) {
            const bx = x0 + 1 + Math.floor(Math.random() * Math.max(1, bw - 2))
            const by = y0 + 1 + Math.floor(Math.random() * Math.max(1, bh - 2))
            if (!isOccupied(bx, by)) sb(bx, by, pick(INDUSTRIAL))
          }
          // Industrial props
          for (let y = y0; y <= y1; y++)
            for (let x = x0; x <= x1; x++)
              if (!isOccupied(x, y) && chance(0.1))
                sp(x, y, pick(["prop_trashcan_green_SE_normal", "prop_cautionsign_standard_SE_normal", "prop_trashbag_black_styleA", "prop_rocks_gray_styleA"]))
          // Truck
          if (chance(0.5)) {
            const cx = x0 + Math.floor(Math.random() * bw)
            const cy = y0 + Math.floor(Math.random() * bh)
            if (!isOccupied(cx, cy)) sv(cx, cy, pick(["veh_truck_green_SE_normal", "veh_truck_red_SE_normal", "veh_box_yellow_SE_normal"]))
          }
          break
        }

        case "park": {
          // Dense trees and flowers
          for (let y = y0; y <= y1; y++) {
            for (let x = x0; x <= x1; x++) {
              if (chance(0.08)) sg(x, y, "tile_ground_grass_puddle")
              if (!isOccupied(x, y) && chance(0.35)) sp(x, y, pick(NATURE_PROPS))
            }
          }
          break
        }

        case "farm": {
          // Crop fields in the interior
          for (let y = y0; y <= y1; y++) {
            for (let x = x0; x <= x1; x++) {
              if (chance(0.65)) sg(x, y, pick(CROP_GROUNDS))
            }
          }
          // Maybe a barn
          if (bw >= 3 && bh >= 3) {
            const bx = x0 + 1 + Math.floor(Math.random() * Math.max(1, bw - 2))
            const by = y1 - 1
            if (!isOccupied(bx, by)) sb(bx, by, pick(["bld_barn_red_SE_normal", "bld_mobile_green_SE_normal"]))
          }
          // Fences
          for (let x = x0; x <= x1; x++) {
            if (!isOccupied(x, y0) && chance(0.4)) sp(x, y0, "prop_fence_wood_SE_normal")
          }
          break
        }

        case "rural": {
          // Dirt, scattered buildings
          for (let y = y0; y <= y1; y++)
            for (let x = x0; x <= x1; x++)
              if (chance(0.2)) sg(x, y, "tile_ground_dirt_normal")

          if (bw >= 3 && bh >= 3) {
            const bx = x0 + 1 + Math.floor(Math.random() * Math.max(1, bw - 2))
            const by = y0 + 1 + Math.floor(Math.random() * Math.max(1, bh - 2))
            if (!isOccupied(bx, by)) sb(bx, by, pick(RURAL))
          }
          for (let y = y0; y <= y1; y++)
            for (let x = x0; x <= x1; x++)
              if (!isOccupied(x, y) && chance(0.12)) sp(x, y, pick(NATURE_PROPS))
          break
        }
      }
    }
  }

  // --- VEHICLES ON ROADS ---
  for (const ry of hRoads) {
    for (let x = 0; x < w; x++) {
      if (!isOccupied(x, ry) && chance(0.06)) sv(x, ry, pick(CIVILIAN_VEHICLES))
    }
  }
  for (const rx of vRoads) {
    for (let y = 0; y < h; y++) {
      if (!isOccupied(rx, y) && chance(0.06)) sv(rx, y, pick(CIVILIAN_VEHICLES))
    }
  }

  return m
}

// ============================================================
// Dungeon random map generator (BSP tree)
// ============================================================
type RoomRole = "entrance" | "corridor_hub" | "storage" | "prison" | "dining" | "treasure" | "boss" | "library" | "barracks"

interface DungeonRoom {
  x: number; y: number; w: number; h: number
  role: RoomRole
}

const ROOM_FLOOR_THEMES: Record<RoomRole, string[]> = {
  entrance:     ["stoneTile_S", "stoneTile_S", "stoneStep_S"],
  corridor_hub: ["stone_S", "stoneTile_S"],
  storage:      ["dirt_S", "dirtTiles_S", "planks_S"],
  prison:       ["stone_S", "stoneMissingTiles_S", "stoneUneven_S"],
  dining:       ["planks_S", "planks_S", "stoneTile_S"],
  treasure:     ["stoneTile_S", "stoneInset_S", "stoneTile_S"],
  boss:         ["stoneTile_S", "stoneTile_S", "stoneInset_S"],
  library:      ["planks_S", "planks_S", "stoneTile_S"],
  barracks:     ["stone_S", "planks_S", "dirt_S"],
}

const ROOM_WALL_THEMES: Record<RoomRole, string[]> = {
  entrance:     ["stoneWall_S", "stoneWallColumn_S"],
  corridor_hub: ["stoneWall_S", "stoneWallAged_S"],
  storage:      ["stoneWallAged_S", "stoneWallBroken_S", "stoneWallAgedLeft_S"],
  prison:       ["stoneWall_S", "stoneWallWindowBars_S", "stoneWallDoorBars_S"],
  dining:       ["stoneWallAged_S", "stoneWallWindow_S"],
  treasure:     ["stoneWall_S", "stoneWallColumn_S", "stoneWallStructure_S"],
  boss:         ["stoneWallRound_S", "stoneWallColumn_S", "stoneWallStructure_S"],
  library:      ["stoneWall_S", "stoneWallWindow_S", "stoneWallAged_S"],
  barracks:     ["stoneWallAged_S", "stoneWallBroken_S", "stoneWallHalf_S"],
}

const ROOM_PROPS: Record<RoomRole, string[]> = {
  entrance:     ["stoneColumn_S", "stoneColumnWood_S"],
  corridor_hub: ["barrel_S", "woodenCrate_S"],
  storage:      ["barrel_S", "barrels_S", "barrelsStacked_S", "woodenCrate_S", "woodenCrates_S", "woodenPile_S"],
  prison:       ["chair_S", "barrel_S"],
  dining:       ["tableRoundChairs_S", "tableRoundItemsChairs_S", "tableShortChairs_S", "barrel_S", "chair_S"],
  treasure:     ["chestClosed_S", "chestOpen_S", "barrelsStacked_S"],
  boss:         ["stoneColumn_S", "chestClosed_S"],
  library:      ["tableShort_S", "tableRound_S", "chair_S", "woodenCrate_S"],
  barracks:     ["tableChairsBroken_S", "barrel_S", "woodenPile_S", "chair_S"],
}

const ROOM_PROP_DENSITY: Record<RoomRole, number> = {
  entrance: 0.05, corridor_hub: 0.06, storage: 0.3, prison: 0.08,
  dining: 0.2, treasure: 0.15, boss: 0.06, library: 0.18, barracks: 0.15,
}

const ROOM_STRUCTURES: Record<RoomRole, string[]> = {
  entrance:     ["stairs_S", "stairsAged_S"],
  corridor_hub: [],
  storage:      ["woodenSupports_S", "woodenSupportBeams_S"],
  prison:       [],
  dining:       [],
  treasure:     ["stairsSpiral_S"],
  boss:         ["bridge_S"],
  library:      ["woodenSupportsBlock_S"],
  barracks:     ["woodenSupports_S"],
}

// BSP tree for dungeon partitioning
interface BSPNode {
  x: number; y: number; w: number; h: number
  left?: BSPNode; right?: BSPNode
  room?: DungeonRoom
}

function bspSplit(node: BSPNode, minSize: number, depth: number): void {
  if (depth <= 0 || node.w < minSize * 2 + 3 && node.h < minSize * 2 + 3) return

  const canSplitH = node.w >= minSize * 2 + 3
  const canSplitV = node.h >= minSize * 2 + 3
  if (!canSplitH && !canSplitV) return

  let horizontal: boolean
  if (canSplitH && canSplitV) horizontal = Math.random() < (node.w > node.h ? 0.7 : 0.3)
  else horizontal = canSplitH

  if (horizontal) {
    const split = node.x + minSize + 1 + Math.floor(Math.random() * (node.w - minSize * 2 - 2))
    node.left = { x: node.x, y: node.y, w: split - node.x, h: node.h }
    node.right = { x: split, y: node.y, w: node.x + node.w - split, h: node.h }
  } else {
    const split = node.y + minSize + 1 + Math.floor(Math.random() * (node.h - minSize * 2 - 2))
    node.left = { x: node.x, y: node.y, w: node.w, h: split - node.y }
    node.right = { x: node.x, y: split, w: node.w, h: node.y + node.h - split }
  }

  bspSplit(node.left, minSize, depth - 1)
  bspSplit(node.right, minSize, depth - 1)
}

function bspCollectLeaves(node: BSPNode): BSPNode[] {
  if (!node.left && !node.right) return [node]
  const leaves: BSPNode[] = []
  if (node.left) leaves.push(...bspCollectLeaves(node.left))
  if (node.right) leaves.push(...bspCollectLeaves(node.right))
  return leaves
}

function generateRandomDungeonMap(w: number, h: number): Cell[][] {
  const defaultGround = DEFAULT_GROUNDS.dungeon
  const m: Cell[][] = Array.from({ length: h }, () =>
    Array.from({ length: w }, () => ({ ground: defaultGround }))
  )
  const D = (n: string) => `/assets/dungeon/${n}.png`

  const sg = (x: number, y: number, name: string) => {
    if (x >= 0 && x < w && y >= 0 && y < h) m[y][x].ground = name
  }
  const sb = (x: number, y: number, name: string) => {
    if (x >= 0 && x < w && y >= 0 && y < h) m[y][x].building = D(name)
  }
  const sp = (x: number, y: number, name: string) => {
    if (x >= 0 && x < w && y >= 0 && y < h) m[y][x].prop = D(name)
  }
  const sv = (x: number, y: number, name: string) => {
    if (x >= 0 && x < w && y >= 0 && y < h) m[y][x].vehicle = D(name)
  }
  const isOccupied = (x: number, y: number) => {
    if (x < 0 || x >= w || y < 0 || y >= h) return true
    const c = m[y][x]
    return !!c.building || !!c.prop || !!c.vehicle
  }
  const isFloor = (x: number, y: number) => {
    if (x < 0 || x >= w || y < 0 || y >= h) return false
    return m[y][x].ground !== defaultGround
  }

  // --- BSP partition ---
  const minRoomDim = 3
  const root: BSPNode = { x: 1, y: 1, w: w - 2, h: h - 2 }
  const maxDepth = Math.min(5, Math.floor(Math.log2(Math.min(w, h))))
  bspSplit(root, minRoomDim, maxDepth)
  const leaves = bspCollectLeaves(root)

  // Assign roles
  const roles: RoomRole[] = ["entrance", "boss", "treasure", "prison", "dining", "storage", "library", "barracks", "corridor_hub"]
  const shuffledRoles = [...roles].sort(() => Math.random() - 0.5)

  // Create rooms inside each BSP leaf
  const rooms: DungeonRoom[] = []
  for (let i = 0; i < leaves.length; i++) {
    const leaf = leaves[i]
    // Room is smaller than the leaf partition (padding)
    const rw = minRoomDim + Math.floor(Math.random() * Math.max(1, leaf.w - minRoomDim - 1))
    const rh = minRoomDim + Math.floor(Math.random() * Math.max(1, leaf.h - minRoomDim - 1))
    const rx = leaf.x + Math.floor(Math.random() * Math.max(1, leaf.w - rw))
    const ry = leaf.y + Math.floor(Math.random() * Math.max(1, leaf.h - rh))
    const role = shuffledRoles[i % shuffledRoles.length]
    const room: DungeonRoom = { x: rx, y: ry, w: rw, h: rh, role }
    leaf.room = room
    rooms.push(room)
  }

  // --- Carve rooms ---
  for (const room of rooms) {
    const floorTiles = ROOM_FLOOR_THEMES[room.role]
    for (let y = room.y; y < room.y + room.h; y++) {
      for (let x = room.x; x < room.x + room.w; x++) {
        sg(x, y, pick(floorTiles))
      }
    }
  }

  // --- Connect rooms with corridors (L-shaped) ---
  // Sort rooms by distance to create a spanning-tree-like connectivity
  const connected = new Set<number>([0])
  const unconnected = new Set<number>(rooms.map((_, i) => i).filter(i => i > 0))

  const roomCenter = (r: DungeonRoom) => ({ cx: Math.floor(r.x + r.w / 2), cy: Math.floor(r.y + r.h / 2) })

  while (unconnected.size > 0) {
    let bestDist = Infinity
    let bestFrom = 0
    let bestTo = 0

    for (const ci of connected) {
      const a = roomCenter(rooms[ci])
      for (const ui of unconnected) {
        const b = roomCenter(rooms[ui])
        const dist = Math.abs(a.cx - b.cx) + Math.abs(a.cy - b.cy)
        if (dist < bestDist) {
          bestDist = dist
          bestFrom = ci
          bestTo = ui
        }
      }
    }

    connected.add(bestTo)
    unconnected.delete(bestTo)

    const a = roomCenter(rooms[bestFrom])
    const b = roomCenter(rooms[bestTo])

    // Carve L-shaped corridor
    const corridorFloor = pick(["dirt_S", "stoneTile_S", "stone_S"])
    const carveCorridor = (x: number, y: number) => {
      sg(x, y, corridorFloor)
      // Also carve adjacent for width (1-wide corridor + walls on sides)
      if (m[y]?.[x]?.building) delete m[y][x].building
    }

    // Randomly choose elbow direction
    if (chance(0.5)) {
      // Horizontal first, then vertical
      let cx = a.cx
      while (cx !== b.cx) {
        carveCorridor(cx, a.cy)
        cx += cx < b.cx ? 1 : -1
      }
      let cy = a.cy
      while (cy !== b.cy) {
        carveCorridor(b.cx, cy)
        cy += cy < b.cy ? 1 : -1
      }
      carveCorridor(b.cx, b.cy)
    } else {
      // Vertical first, then horizontal
      let cy = a.cy
      while (cy !== b.cy) {
        carveCorridor(a.cx, cy)
        cy += cy < b.cy ? 1 : -1
      }
      let cx = a.cx
      while (cx !== b.cx) {
        carveCorridor(cx, b.cy)
        cx += cx < b.cx ? 1 : -1
      }
      carveCorridor(b.cx, b.cy)
    }
  }

  // --- Place walls around all floor tiles ---
  const wallCandidates: [number, number][] = []
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!isFloor(x, y)) {
        // Check if adjacent to any floor tile
        const adjFloor = isFloor(x-1, y) || isFloor(x+1, y) || isFloor(x, y-1) || isFloor(x, y+1)
          || isFloor(x-1, y-1) || isFloor(x+1, y-1) || isFloor(x-1, y+1) || isFloor(x+1, y+1)
        if (adjFloor) wallCandidates.push([x, y])
      }
    }
  }

  // Find which room is nearest to determine wall style
  const nearestRoom = (x: number, y: number): DungeonRoom => {
    let best = rooms[0]
    let bestDist = Infinity
    for (const r of rooms) {
      const cx = r.x + r.w / 2
      const cy = r.y + r.h / 2
      const d = Math.abs(x - cx) + Math.abs(y - cy)
      if (d < bestDist) { bestDist = d; best = r }
    }
    return best
  }

  for (const [x, y] of wallCandidates) {
    const room = nearestRoom(x, y)
    const wallTiles = ROOM_WALL_THEMES[room.role]

    // Corner detection
    const floorN = isFloor(x, y-1)
    const floorS = isFloor(x, y+1)
    const floorE = isFloor(x+1, y)
    const floorW = isFloor(x-1, y)
    const isCorner = (floorN || floorS) && (floorE || floorW)

    if (isCorner) {
      sb(x, y, "stoneWallCorner_S")
    } else {
      sb(x, y, pick(wallTiles))
    }
  }

  // --- Place doors/archways at corridor-room intersections ---
  for (const room of rooms) {
    // Check each wall cell for corridor adjacency
    const checkDoor = (wx: number, wy: number, floorDx: number, floorDy: number) => {
      if (wx < 0 || wx >= w || wy < 0 || wy >= h) return
      if (!m[wy][wx].building) return
      // Check if the other side of the wall is a corridor floor
      const ox = wx + floorDx
      const oy = wy + floorDy
      if (isFloor(ox, oy) && !rooms.some(r => ox >= r.x && ox < r.x + r.w && oy >= r.y && oy < r.y + r.h)) {
        // This wall borders a corridor - make it a door
        const doorTile = room.role === "prison" ? "stoneWallDoorBars_S"
          : room.role === "treasure" ? "stoneWallGateClosed_S"
          : pick(["stoneWallDoor_S", "stoneWallArchway_S", "stoneWallDoorOpen_S"])
        m[wy][wx].building = D(doorTile)
      }
    }
    // Top wall
    for (let x = room.x; x < room.x + room.w; x++) checkDoor(x, room.y - 1, 0, -1)
    // Bottom wall
    for (let x = room.x; x < room.x + room.w; x++) checkDoor(x, room.y + room.h, 0, 1)
    // Left wall
    for (let y = room.y; y < room.y + room.h; y++) checkDoor(room.x - 1, y, -1, 0)
    // Right wall
    for (let y = room.y; y < room.y + room.h; y++) checkDoor(room.x + room.w, y, 1, 0)
  }

  // --- Decorate rooms with props ---
  for (const room of rooms) {
    const props = ROOM_PROPS[room.role]
    const density = ROOM_PROP_DENSITY[room.role]

    for (let y = room.y; y < room.y + room.h; y++) {
      for (let x = room.x; x < room.x + room.w; x++) {
        if (!isOccupied(x, y) && chance(density)) {
          sp(x, y, pick(props))
        }
      }
    }

    // Place room-specific structures
    const structures = ROOM_STRUCTURES[room.role]
    if (structures.length > 0 && chance(0.6)) {
      // Place structure near room center
      const cx = room.x + Math.floor(room.w / 2)
      const cy = room.y + Math.floor(room.h / 2)
      if (!isOccupied(cx, cy)) {
        sv(cx, cy, pick(structures))
      }
    }

    // Special decorations per role
    if (room.role === "treasure") {
      // Place chests along back wall
      for (let x = room.x; x < room.x + room.w; x++) {
        if (!isOccupied(x, room.y) && chance(0.4)) sp(x, room.y, pick(["chestClosed_S", "chestOpen_S"]))
      }
    }
    if (room.role === "prison") {
      // Columns inside
      if (room.w >= 5 && room.h >= 5) {
        for (let x = room.x + 2; x < room.x + room.w - 1; x += 2) {
          if (!isOccupied(x, room.y + 1)) sp(x, room.y + 1, "stoneColumn_S")
          if (!isOccupied(x, room.y + room.h - 2)) sp(x, room.y + room.h - 2, "stoneColumn_S")
        }
      }
    }
    if (room.role === "boss") {
      // Columns in corners
      const corners = [
        [room.x + 1, room.y + 1], [room.x + room.w - 2, room.y + 1],
        [room.x + 1, room.y + room.h - 2], [room.x + room.w - 2, room.y + room.h - 2],
      ]
      for (const [cx, cy] of corners) {
        if (!isOccupied(cx, cy)) sp(cx, cy, "stoneColumn_S")
      }
    }
    if (room.role === "entrance") {
      // Staircase
      const cx = room.x + Math.floor(room.w / 2)
      const cy = room.y + Math.floor(room.h / 2)
      if (!isOccupied(cx, cy)) sv(cx, cy, pick(["stairs_S", "stairsSpiral_S"]))
    }
  }

  // --- Add wooden supports in corridors ---
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      if (!isFloor(x, y) || isOccupied(x, y)) continue
      // Check if this is a corridor cell (not inside any room)
      const inRoom = rooms.some(r => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h)
      if (!inRoom && chance(0.04)) {
        sv(x, y, pick(["woodenSupports_S", "woodenSupportBeams_S", "woodenSupportsBeam_S"]))
      }
    }
  }

  return m
}

// ============================================================
// Component
// ============================================================
export function MapBuilder() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef(0)
  const imagesRef = useRef(new Map<string, HTMLImageElement>())

  const [theme, setTheme] = useState<MapTheme>("city")
  const themeRef = useRef<MapTheme>("city")
  const [gridW, setGridW] = useState(DEFAULT_GRID_W)
  const [gridH, setGridH] = useState(DEFAULT_GRID_H)
  const mapRef = useRef<Cell[][]>(createEmptyMap(DEFAULT_GRID_W, DEFAULT_GRID_H, "city"))
  const [mapVersion, setMapVersion] = useState(0)
  const bumpMap = () => setMapVersion((v) => v + 1)

  const [loaded, setLoaded] = useState(false)
  const [activeCategory, setActiveCategory] = useState<AssetCategory>("grounds")
  const [selectedAsset, setSelectedAsset] = useState<AssetEntry | null>(null)
  const [eraserMode, setEraserMode] = useState(false)
  const [eraserLayer, setEraserLayer] = useState<LayerType>("building")
  const [pickerMode, setPickerMode] = useState(false)
  const [showGrid, setShowGrid] = useState(true)
  const [aiPrompt, setAiPrompt] = useState("")
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)

  const panRef = useRef({ x: 0, y: 0 })
  const zoomRef = useRef(1)
  const dragRef = useRef({
    active: false,
    startX: 0,
    startY: 0,
    panStartX: 0,
    panStartY: 0,
    moved: false,
  })
  const paintingRef = useRef(false)
  const hoverRef = useRef<{ gx: number; gy: number } | null>(null)

  // Preload all catalog assets on mount
  useEffect(() => {
    const allPaths: string[] = []
    for (const themeAssets of Object.values(ALL_ASSETS)) {
      for (const catAssets of Object.values(themeAssets)) {
        for (const a of catAssets) {
          allPaths.push(a.path)
        }
      }
    }
    // Also add the default grounds
    allPaths.push(resolveGroundPath(DEFAULT_GROUNDS.city, "city"))
    allPaths.push(resolveGroundPath(DEFAULT_GROUNDS.dungeon, "dungeon"))

    loadImages(allPaths).then((imgs) => {
      imagesRef.current = imgs
      const center = gridToScreen(gridW / 2, gridH / 2)
      // Canvas starts after sidebar (w-72 = 288px), center within canvas area
      const sidebarW = 288
      const canvasW = window.innerWidth - sidebarW
      panRef.current = {
        x: canvasW / 2 - center.sx,
        y: window.innerHeight / 2 - center.sy,
      }
      setLoaded(true)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Render loop
  const render = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const rect = canvas.getBoundingClientRect()
    const W = rect.width
    const H = rect.height
    const dpr = window.devicePixelRatio || 1

    if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) {
      canvas.width = Math.round(W * dpr)
      canvas.height = Math.round(H * dpr)
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    // Background
    const skyGrad = ctx.createLinearGradient(0, 0, 0, H)
    if (themeRef.current === "dungeon") {
      skyGrad.addColorStop(0, "#1a1210")
      skyGrad.addColorStop(0.6, "#201815")
      skyGrad.addColorStop(1, "#15100d")
    } else {
      skyGrad.addColorStop(0, "#1a1a2e")
      skyGrad.addColorStop(0.6, "#16213e")
      skyGrad.addColorStop(1, "#0f3460")
    }
    ctx.fillStyle = skyGrad
    ctx.fillRect(0, 0, W, H)

    // Apply zoom + pan
    const z = zoomRef.current
    ctx.setTransform(dpr * z, 0, 0, dpr * z, 0, 0)
    ctx.imageSmoothingEnabled = false

    const imgs = imagesRef.current
    const map = mapRef.current
    const gw = map[0]?.length ?? 0
    const gh = map.length
    const px = panRef.current.x
    const py = panRef.current.y
    const curTheme = themeRef.current
    const isDungeon = curTheme === "dungeon"

    // Helper to draw an object image, scaling dungeon tiles (256x512) to fit the grid
    const drawObj = (
      img: HTMLImageElement,
      sX: number,
      sY: number,
    ) => {
      if (isDungeon) {
        const dw = img.width * DUNGEON_SCALE
        const dh = img.height * DUNGEON_SCALE
        ctx.drawImage(img, sX - dw / 2, sY + TILE_H / 2 - dh, dw, dh)
      } else {
        ctx.drawImage(
          img,
          sX - img.width / 2,
          sY + TILE_H / 2 - img.height,
          img.width,
          img.height
        )
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

        if (
          screenX < -TILE_W * 2 ||
          screenX > W / z + TILE_W * 2 ||
          screenY < -300 ||
          screenY > H / z + TILE_H * 2
        )
          continue

        const cell = map[gy][gx]
        const depth = (gx + gy) * 100 + gx

        // Ground
        const gPath = resolveGroundPath(cell.ground, curTheme)
        const gImg = imgs.get(gPath)
        if (gImg) {
          if (isDungeon) {
            // Dungeon ground tiles are 256x512, render at half scale, bottom-aligned
            const dw = gImg.width * DUNGEON_SCALE
            const dh = gImg.height * DUNGEON_SCALE
            groundDraws.push({
              depth,
              fn: () => ctx.drawImage(gImg, screenX - dw / 2, screenY + TILE_H / 2 - dh, dw, dh),
            })
          } else {
            groundDraws.push({
              depth,
              fn: () =>
                ctx.drawImage(
                  gImg,
                  screenX - TILE_W / 2,
                  screenY - TILE_H / 2,
                  TILE_W,
                  TILE_H
                ),
            })
          }
        }

        // Grid overlay
        if (showGrid) {
          groundDraws.push({
            depth: depth + 1,
            fn: () => {
              ctx.strokeStyle = "rgba(255,255,255,0.1)"
              ctx.lineWidth = 0.5
              ctx.beginPath()
              ctx.moveTo(screenX, screenY - TILE_H / 2)
              ctx.lineTo(screenX + TILE_W / 2, screenY)
              ctx.lineTo(screenX, screenY + TILE_H / 2)
              ctx.lineTo(screenX - TILE_W / 2, screenY)
              ctx.closePath()
              ctx.stroke()
            },
          })
        }

        // Hover highlight
        const hover = hoverRef.current
        if (hover && hover.gx === gx && hover.gy === gy) {
          groundDraws.push({
            depth: depth + 2,
            fn: () => {
              ctx.fillStyle = eraserMode
                ? "rgba(255,80,80,0.25)"
                : "rgba(100,200,255,0.25)"
              ctx.strokeStyle = eraserMode
                ? "rgba(255,80,80,0.6)"
                : "rgba(100,200,255,0.6)"
              ctx.lineWidth = 1.5
              ctx.beginPath()
              ctx.moveTo(screenX, screenY - TILE_H / 2)
              ctx.lineTo(screenX + TILE_W / 2, screenY)
              ctx.lineTo(screenX, screenY + TILE_H / 2)
              ctx.lineTo(screenX - TILE_W / 2, screenY)
              ctx.closePath()
              ctx.fill()
              ctx.stroke()
            },
          })
        }

        // Building
        if (cell.building) {
          const img = imgs.get(cell.building)
          if (img) {
            objectDraws.push({
              depth: depth + 50,
              fn: () => drawObj(img, screenX, screenY),
            })
          }
        }

        // Prop
        if (cell.prop) {
          const img = imgs.get(cell.prop)
          if (img) {
            objectDraws.push({
              depth,
              fn: () => drawObj(img, screenX, screenY),
            })
          }
        }

        // Vehicle
        if (cell.vehicle) {
          const img = imgs.get(cell.vehicle)
          if (img) {
            objectDraws.push({
              depth: depth + 25,
              fn: () => drawObj(img, screenX, screenY),
            })
          }
        }
      }
    }

    groundDraws.sort((a, b) => a.depth - b.depth)
    for (const d of groundDraws) d.fn()
    objectDraws.sort((a, b) => a.depth - b.depth)
    for (const d of objectDraws) d.fn()

    // Coordinate display (reset zoom for HUD)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    const hover = hoverRef.current
    if (hover && hover.gx >= 0 && hover.gx < gw && hover.gy >= 0 && hover.gy < gh) {
      ctx.fillStyle = "rgba(0,0,0,0.6)"
      ctx.beginPath()
      ctx.roundRect(W - 160, H - 44, 144, 32, 6)
      ctx.fill()
      ctx.fillStyle = "#fff"
      ctx.font = "bold 13px monospace"
      ctx.textAlign = "center"
      ctx.fillText(`x: ${hover.gx}  y: ${hover.gy}`, W - 88, H - 23)
    }

    animRef.current = requestAnimationFrame(render)
  }, [loaded, showGrid, eraserMode, mapVersion])

  useEffect(() => {
    if (!loaded) return
    animRef.current = requestAnimationFrame(render)
    return () => cancelAnimationFrame(animRef.current)
  }, [loaded, render])

  // Place asset or erase on cell
  const handleCellAction = useCallback(
    (gx: number, gy: number) => {
      const map = mapRef.current
      const gh = map.length
      const gw = map[0]?.length ?? 0
      if (gx < 0 || gx >= gw || gy < 0 || gy >= gh) return

      const cell = map[gy][gx]

      if (eraserMode) {
        switch (eraserLayer) {
          case "ground":
            cell.ground = DEFAULT_GROUNDS[themeRef.current]
            break
          case "building":
            delete cell.building
            break
          case "prop":
            delete cell.prop
            break
          case "vehicle":
            delete cell.vehicle
            break
        }
        bumpMap()
        return
      }

      if (!selectedAsset) return

      const layer = layerFromCategory(selectedAsset.category)
      switch (layer) {
        case "ground":
          cell.ground = selectedAsset.name
          break
        case "building":
          cell.building = selectedAsset.path
          break
        case "prop":
          cell.prop = selectedAsset.path
          break
        case "vehicle":
          cell.vehicle = selectedAsset.path
          break
      }
      bumpMap()
    },
    [selectedAsset, eraserMode, eraserLayer]
  )

  // Pick asset from cell (eyedropper)
  const handlePick = useCallback(
    (gx: number, gy: number) => {
      const map = mapRef.current
      const gh = map.length
      const gw = map[0]?.length ?? 0
      if (gx < 0 || gx >= gw || gy < 0 || gy >= gh) return
      const cell = map[gy][gx]
      const t = themeRef.current
      const assets = ALL_ASSETS[t]

      // Pick topmost layer: vehicle > prop > building > ground
      let found: AssetEntry | undefined
      let cat: AssetCategory | undefined
      if (cell.vehicle) {
        found = assets.vehicles.find((a) => a.path === cell.vehicle || a.name === cell.vehicle)
        cat = "vehicles"
      }
      if (!found && cell.prop) {
        found = assets.props.find((a) => a.path === cell.prop || a.name === cell.prop)
        cat = "props"
      }
      if (!found && cell.building) {
        found = assets.buildings.find((a) => a.path === cell.building || a.name === cell.building)
        cat = "buildings"
      }
      if (!found) {
        found = assets.grounds.find((a) => a.name === cell.ground)
        cat = "grounds"
      }

      if (found && cat) {
        setSelectedAsset(found)
        setActiveCategory(cat)
        setEraserMode(false)
        setPickerMode(false)
      }
    },
    []
  )

  // Mouse handlers
  // Convert viewport mouse coords to world-space coords (accounting for zoom)
  const canvasCoords = useCallback((e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect()
    const z = zoomRef.current
    return {
      cx: (e.clientX - (rect?.left ?? 0)) / z,
      cy: (e.clientY - (rect?.top ?? 0)) / z,
    }
  }, [])

  const canPaint = !pickerMode && (eraserMode || !!selectedAsset)

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 0 && (pickerMode || e.altKey)) {
      // Picker: alt+click or picker mode → pick asset from cell
      const { cx, cy } = canvasCoords(e)
      const { gx, gy } = screenToGrid(cx, cy, panRef.current.x, panRef.current.y)
      handlePick(gx, gy)
      return
    }
    if (e.button === 0 && canPaint) {
      // Left click with a tool selected → paint mode
      paintingRef.current = true
      const { cx, cy } = canvasCoords(e)
      const { gx, gy } = screenToGrid(cx, cy, panRef.current.x, panRef.current.y)
      handleCellAction(gx, gy)
    } else {
      // Middle click, or left click without tool → pan mode
      dragRef.current = {
        active: true,
        startX: e.clientX,
        startY: e.clientY,
        panStartX: panRef.current.x,
        panStartY: panRef.current.y,
        moved: false,
      }
    }
  }, [canPaint, pickerMode, canvasCoords, handleCellAction, handlePick])

  const onMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const { cx, cy } = canvasCoords(e)
      const { gx, gy } = screenToGrid(cx, cy, panRef.current.x, panRef.current.y)
      hoverRef.current = { gx, gy }

      if (paintingRef.current) {
        handleCellAction(gx, gy)
        return
      }

      if (!dragRef.current.active) return
      const dx = e.clientX - dragRef.current.startX
      const dy = e.clientY - dragRef.current.startY
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        dragRef.current.moved = true
      }
      const z = zoomRef.current
      panRef.current.x = dragRef.current.panStartX + dx / z
      panRef.current.y = dragRef.current.panStartY + dy / z
    },
    [canvasCoords, handleCellAction]
  )

  const onMouseUp = useCallback(
    (e: React.MouseEvent) => {
      paintingRef.current = false
      const wasDrag = dragRef.current.moved
      dragRef.current.active = false
      dragRef.current.moved = false

      // If no tool and didn't drag, treat as single click placement (fallback)
      if (!wasDrag && !canPaint) {
        const { cx, cy } = canvasCoords(e)
        const { gx, gy } = screenToGrid(cx, cy, panRef.current.x, panRef.current.y)
        handleCellAction(gx, gy)
      }
    },
    [handleCellAction, canvasCoords, canPaint]
  )

  const onContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      const { cx, cy } = canvasCoords(e)
      const { gx, gy } = screenToGrid(cx, cy, panRef.current.x, panRef.current.y)
      const map = mapRef.current
      const gh = map.length
      const gw = map[0]?.length ?? 0
      if (gx < 0 || gx >= gw || gy < 0 || gy >= gh) return
      const cell = map[gy][gx]
      // Right click removes in priority: vehicle > prop > building
      if (cell.vehicle) {
        delete cell.vehicle
      } else if (cell.prop) {
        delete cell.prop
      } else if (cell.building) {
        delete cell.building
      } else {
        cell.ground = DEFAULT_GROUNDS[themeRef.current]
      }
      bumpMap()
    },
    []
  )

  // Zoom (towards cursor)
  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const oldZ = zoomRef.current
    const delta = e.deltaY > 0 ? 0.9 : 1.1
    const newZ = Math.max(0.2, Math.min(4, oldZ * delta))
    const rect = canvasRef.current?.getBoundingClientRect()
    const mx = e.clientX - (rect?.left ?? 0)
    const my = e.clientY - (rect?.top ?? 0)
    panRef.current.x = mx / newZ - (mx / oldZ - panRef.current.x)
    panRef.current.y = my / newZ - (my / oldZ - panRef.current.y)
    zoomRef.current = newZ
  }, [])

  // Export JSON
  const exportJSON = useCallback(() => {
    const map = mapRef.current

    // Build legend: find all unique cell configurations and assign symbols
    const cellKeyToSymbol = new Map<string, string>()
    const legend: Record<string, LegendEntry> = {}

    // Symbol pool: printable ASCII chars (skip space), then extended if needed
    const SYMBOL_POOL = "._~:;!@#$%^&*+=?/|\\<>abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
    let symbolIdx = 0

    const getCellKey = (cell: Cell): string => {
      const parts = [cell.ground]
      if (cell.building) parts.push("b:" + cell.building)
      if (cell.prop) parts.push("p:" + cell.prop)
      if (cell.vehicle) parts.push("v:" + cell.vehicle)
      return parts.join("|")
    }

    // First pass: collect unique cell types
    for (const row of map) {
      for (const cell of row) {
        const key = getCellKey(cell)
        if (!cellKeyToSymbol.has(key)) {
          if (symbolIdx >= SYMBOL_POOL.length) {
            alert("Map has too many unique tile combinations for legend format. Falling back to verbose export.")
            return
          }
          const sym = SYMBOL_POOL[symbolIdx++]
          cellKeyToSymbol.set(key, sym)
          const entry: LegendEntry = { g: cell.ground }
          if (cell.building) entry.b = cell.building
          if (cell.prop) entry.p = cell.prop
          if (cell.vehicle) entry.v = cell.vehicle
          legend[sym] = entry
        }
      }
    }

    // Second pass: build grid strings
    const grid: string[] = map.map((row) =>
      row.map((cell) => cellKeyToSymbol.get(getCellKey(cell))!).join("")
    )

    const data: LegendMapJSON = { theme: themeRef.current, legend, grid }
    const json = JSON.stringify(data, null, 2)
    const blob = new Blob([json], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "map.json"
    a.click()
    URL.revokeObjectURL(url)
  }, [])

  // Import JSON – supports both legend+grid and legacy cell-array formats
  const importJSON = useCallback(() => {
    const input = document.createElement("input")
    input.type = "file"
    input.accept = ".json"
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      const text = await file.text()
      try {
        const data = JSON.parse(text)

        let cells: Cell[][]
        let importedTheme: MapTheme
        let gw: number
        let gh: number

        if (data.legend && data.grid) {
          // Legend+grid format
          const legendData = data as LegendMapJSON
          importedTheme = legendData.theme || "city"
          gh = legendData.grid.length
          gw = legendData.grid[0]?.length ?? 0
          cells = legendData.grid.map((row: string) =>
            Array.from(row).map((sym) => {
              const entry = legendData.legend[sym]
              if (!entry) return { ground: DEFAULT_GROUNDS[importedTheme] }
              const cell: Cell = { ground: entry.g }
              if (entry.b) cell.building = entry.b
              if (entry.p) cell.prop = entry.p
              if (entry.v) cell.vehicle = entry.v
              return cell
            })
          )
        } else if (data.cells) {
          // Legacy format
          if (!data.gridWidth || !data.gridHeight) {
            alert("Invalid map JSON format")
            return
          }
          importedTheme = data.theme || "city"
          gw = data.gridWidth
          gh = data.gridHeight
          cells = data.cells
        } else {
          alert("Invalid map JSON format")
          return
        }

        themeRef.current = importedTheme
        setTheme(importedTheme)
        mapRef.current = cells
        setGridW(gw)
        setGridH(gh)

        // Load any new images that might be in the imported map
        const paths = collectPaths(cells, importedTheme)
        loadImages(paths).then((newImgs) => {
          for (const [k, v] of newImgs) {
            imagesRef.current.set(k, v)
          }
          bumpMap()
        })
      } catch {
        alert("Failed to parse JSON file")
      }
    }
    input.click()
  }, [])

  // Clear map
  const clearMap = useCallback(() => {
    mapRef.current = createEmptyMap(gridW, gridH, themeRef.current)
    bumpMap()
  }, [gridW, gridH])

  // Random map
  const randomizeMap = useCallback(() => {
    if (themeRef.current === "dungeon") {
      mapRef.current = generateRandomDungeonMap(gridW, gridH)
    } else {
      mapRef.current = generateRandomCityMap(gridW, gridH)
    }
    bumpMap()
  }, [gridW, gridH])

  // AI generate map
  const generateWithAI = useCallback(async () => {
    if (!aiPrompt.trim() || aiLoading) return
    setAiLoading(true)
    setAiError(null)
    try {
      const res = await fetch("/api/generate-map", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: aiPrompt.trim(),
          gridWidth: gridW,
          gridHeight: gridH,
          theme: themeRef.current,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setAiError(data.error || "Generation failed")
        return
      }
      mapRef.current = data.cells
      // Load any images that might be new
      const paths = collectPaths(data.cells, themeRef.current)
      const newImgs = await loadImages(paths)
      for (const [k, v] of newImgs) {
        imagesRef.current.set(k, v)
      }
      bumpMap()
    } catch (e) {
      setAiError(e instanceof Error ? e.message : "Network error")
    } finally {
      setAiLoading(false)
    }
  }, [aiPrompt, aiLoading, gridW, gridH])

  // Resize grid
  const resizeGrid = useCallback(
    (newW: number, newH: number) => {
      const old = mapRef.current
      const oldH = old.length
      const oldW = old[0]?.length ?? 0
      const newMap = createEmptyMap(newW, newH, themeRef.current)
      for (let y = 0; y < Math.min(oldH, newH); y++) {
        for (let x = 0; x < Math.min(oldW, newW); x++) {
          newMap[y][x] = { ...old[y][x] }
        }
      }
      mapRef.current = newMap
      setGridW(newW)
      setGridH(newH)
      bumpMap()
    },
    []
  )

  if (!loaded) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-gradient-to-b from-[#1a1a2e] to-[#0f3460]">
        <p className="text-white font-mono text-lg animate-pulse">
          Loading assets...
        </p>
      </div>
    )
  }

  const categories: AssetCategory[] = [
    "grounds",
    "buildings",
    "props",
    "vehicles",
  ]

  return (
    <div className="fixed inset-0 flex">
      {/* Sidebar */}
      <div className="w-72 bg-zinc-900 border-r border-zinc-700 flex flex-col z-10 select-none">
        {/* Header */}
        <div className="p-3 border-b border-zinc-700 flex items-center gap-2">
          <a
            href="/"
            className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
            title="Back to world"
          >
            <RiArrowLeftLine className="size-4" />
          </a>
          <h1 className="text-white font-mono text-sm font-bold">
            Map Builder
          </h1>
        </div>

        {/* Theme selector */}
        <div className="p-2 border-b border-zinc-700 flex gap-1">
          {(["city", "dungeon"] as MapTheme[]).map((t) => (
            <button
              key={t}
              onClick={() => {
                if (t === theme) return
                themeRef.current = t
                setTheme(t)
                setSelectedAsset(null)
                setActiveCategory("grounds")
                mapRef.current = createEmptyMap(gridW, gridH, t)
                bumpMap()
              }}
              className={`flex-1 py-2 px-3 rounded text-xs font-mono font-bold uppercase tracking-wider transition-colors ${
                theme === t
                  ? t === "city"
                    ? "bg-blue-600 text-white"
                    : "bg-amber-700 text-white"
                  : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
              }`}
            >
              {t === "city" ? "City" : "Dungeon"}
            </button>
          ))}
        </div>

        {/* Toolbar */}
        <div className="p-2 border-b border-zinc-700 flex flex-wrap gap-1">
          <button
            onClick={() => {
              setEraserMode(!eraserMode)
              if (!eraserMode) {
                setSelectedAsset(null)
                setPickerMode(false)
              }
            }}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-mono transition-colors ${
              eraserMode
                ? "bg-red-600 text-white"
                : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
            }`}
            title="Eraser (right-click also removes)"
          >
            <RiEraserLine className="size-3.5" />
            Eraser
          </button>
          <button
            onClick={() => {
              setPickerMode(!pickerMode)
              if (!pickerMode) setEraserMode(false)
            }}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-mono transition-colors ${
              pickerMode
                ? "bg-amber-600 text-white"
                : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
            }`}
            title="Picker – click a tile to select its asset (Alt+click)"
          >
            <RiSipLine className="size-3.5" />
            Picker
          </button>
          <button
            onClick={() => setShowGrid(!showGrid)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-mono transition-colors ${
              showGrid
                ? "bg-blue-600 text-white"
                : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
            }`}
            title="Toggle grid"
          >
            <RiGridLine className="size-3.5" />
            Grid
          </button>
          <button
            onClick={exportJSON}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-mono bg-emerald-700 text-white hover:bg-emerald-600 transition-colors"
            title="Export map as JSON"
          >
            <RiDownloadLine className="size-3.5" />
            Export
          </button>
          <button
            onClick={importJSON}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-mono bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors"
            title="Import map from JSON"
          >
            <RiUploadLine className="size-3.5" />
            Import
          </button>
          <button
            onClick={clearMap}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-mono bg-zinc-800 text-red-400 hover:bg-red-900/40 transition-colors"
            title="Clear entire map"
          >
            <RiDeleteBinLine className="size-3.5" />
            Clear
          </button>
          <button
            onClick={randomizeMap}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-mono bg-purple-700 text-white hover:bg-purple-600 transition-colors"
            title="Generate random map"
          >
            <RiMagicLine className="size-3.5" />
            Random
          </button>
        </div>

        {/* Grid size */}
        <div className="p-2 border-b border-zinc-700 flex items-center gap-2">
          <span className="text-zinc-400 text-xs font-mono">Size:</span>
          <input
            type="number"
            min={4}
            max={64}
            value={gridW}
            onChange={(e) => {
              const v = Math.max(4, Math.min(64, Number(e.target.value)))
              resizeGrid(v, gridH)
            }}
            className="w-14 bg-zinc-800 text-white text-xs font-mono px-2 py-1 rounded border border-zinc-600 text-center"
          />
          <span className="text-zinc-500 text-xs">x</span>
          <input
            type="number"
            min={4}
            max={64}
            value={gridH}
            onChange={(e) => {
              const v = Math.max(4, Math.min(64, Number(e.target.value)))
              resizeGrid(gridW, v)
            }}
            className="w-14 bg-zinc-800 text-white text-xs font-mono px-2 py-1 rounded border border-zinc-600 text-center"
          />
        </div>

        {/* AI Prompt */}
        <div className="p-2 border-b border-zinc-700">
          <div className="flex items-center gap-1.5 mb-1.5">
            <RiSparklingLine className="size-3.5 text-amber-400" />
            <span className="text-zinc-400 text-xs font-mono">AI Generate</span>
          </div>
          <div className="flex gap-1">
            <input
              type="text"
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") generateWithAI()
              }}
              placeholder={theme === "dungeon" ? "dark prison with treasure vault..." : "small town with park and shops..."}
              className="flex-1 bg-zinc-800 text-white text-xs font-mono px-2 py-1.5 rounded border border-zinc-600 placeholder:text-zinc-500 focus:outline-none focus:border-amber-500"
              disabled={aiLoading}
            />
            <button
              onClick={generateWithAI}
              disabled={aiLoading || !aiPrompt.trim()}
              className="px-2.5 py-1.5 rounded text-xs font-mono bg-amber-600 text-white hover:bg-amber-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
            >
              {aiLoading ? (
                <RiLoader4Line className="size-3.5 animate-spin" />
              ) : (
                <RiSparklingLine className="size-3.5" />
              )}
            </button>
          </div>
          {aiError && (
            <p className="text-red-400 text-[10px] font-mono mt-1 truncate" title={aiError}>
              {aiError}
            </p>
          )}
        </div>

        {/* Eraser layer selector */}
        {eraserMode && (
          <div className="p-2 border-b border-zinc-700">
            <span className="text-zinc-400 text-xs font-mono block mb-1.5">
              Erase layer:
            </span>
            <div className="flex gap-1">
              {(["ground", "building", "prop", "vehicle"] as LayerType[]).map(
                (layer) => {
                  const catKey = (layer + "s") as AssetCategory
                  return (
                    <button
                      key={layer}
                      onClick={() => setEraserLayer(layer)}
                      className={`px-2 py-1 rounded text-xs font-mono transition-colors ${
                        eraserLayer === layer
                          ? "bg-red-600 text-white"
                          : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                      }`}
                    >
                      {CATEGORY_LABELS[theme][catKey]}
                    </button>
                  )
                }
              )}
            </div>
          </div>
        )}

        {/* Category tabs */}
        <div className="flex border-b border-zinc-700">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => {
                setActiveCategory(cat)
                setEraserMode(false)
              }}
              className={`flex-1 py-2.5 px-2 text-xs font-mono transition-colors ${
                activeCategory === cat && !eraserMode
                  ? "bg-zinc-800 text-white border-b-2 border-blue-500"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
              }`}
            >
              {CATEGORY_LABELS[theme][cat]}
            </button>
          ))}
        </div>

        {/* Asset palette */}
        <div className="flex-1 overflow-y-auto p-2">
          <div className="grid grid-cols-3 gap-1.5">
            {ALL_ASSETS[theme][activeCategory].map((asset) => (
              <button
                key={asset.name}
                onClick={() => {
                  setSelectedAsset(asset)
                  setEraserMode(false)
                  setPickerMode(false)
                }}
                className={`relative group rounded p-1 transition-colors ${
                  selectedAsset?.name === asset.name && !eraserMode
                    ? "bg-blue-600/30 ring-1 ring-blue-500"
                    : "bg-zinc-800 hover:bg-zinc-700"
                }`}
                title={asset.name}
              >
                <img
                  src={asset.path}
                  alt={asset.name}
                  className="w-full h-auto"
                  style={{ imageRendering: "pixelated" }}
                  loading="lazy"
                />
                <div className="absolute inset-x-0 bottom-0 bg-black/70 text-[8px] font-mono text-zinc-300 px-0.5 py-0.5 truncate opacity-0 group-hover:opacity-100 transition-opacity rounded-b">
                  {asset.name.replace(/^(tile_|bld_|prop_|veh_)/, "").replace(/_(S|E|N|W)$/, "")}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Selected info */}
        {selectedAsset && !eraserMode && (
          <div className="p-2 border-t border-zinc-700 bg-zinc-800/50">
            <p className="text-[10px] font-mono text-zinc-400 truncate">
              {selectedAsset.name}
            </p>
          </div>
        )}
      </div>

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        className={`flex-1 ${pickerMode ? "cursor-copy" : "cursor-crosshair"} active:cursor-grabbing`}
        style={{ imageRendering: "pixelated" }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={() => {
          dragRef.current.active = false
          paintingRef.current = false
          hoverRef.current = null
        }}
        onContextMenu={onContextMenu}
        onWheel={onWheel}
      />
    </div>
  )
}
