import Anthropic from "@anthropic-ai/sdk"
import { NextRequest, NextResponse } from "next/server"

const client = new Anthropic()

// Dungeon tiles available
const DUNGEON_TILE_DOCS = `
## Available Dungeon Tiles

FLOORS (ground layer - use name only):
  stone_S, stoneTile_S, stoneUneven_S, stoneMissingTiles_S, stoneInset_S,
  stoneStep_S, stoneSteps_S, dirt_S, dirtTiles_S,
  planks_S, planksBroken_S, planksHole_S

WALLS (building layer - name only, path added automatically):
  stoneWall_S, stoneWallAged_S, stoneWallBroken_S, stoneWallHalf_S, stoneWallHole_S,
  stoneWallRound_S, stoneWallRoundBroken_S, stoneWallRoundWindow_S,
  stoneWallArchway_S, stoneWallWindow_S, stoneWallWindowBars_S,
  stoneWallDoor_S, stoneWallDoorBars_S, stoneWallDoorClosed_S, stoneWallDoorOpen_S,
  stoneWallGate_S, stoneWallGateBars_S, stoneWallGateClosed_S, stoneWallGateOpen_S,
  stoneWallColumn_S, stoneWallColumnIn_S, stoneWallCorner_S, stoneWallStructure_S,
  stoneColumn_S, stoneColumnWood_S

PROPS (prop layer - name only):
  barrel_S, barrels_S, barrelsStacked_S, chestClosed_S, chestOpen_S,
  chair_S, tableRound_S, tableRoundChairs_S, tableRoundItemsChairs_S,
  tableShort_S, tableShortChairs_S, tableChairsBroken_S,
  woodenCrate_S, woodenCrates_S, woodenPile_S

STRUCTURES (vehicle layer - name only):
  bridge_S, bridgeBroken_S, stairs_S, stairsAged_S, stairsCorner_S, stairsSpiral_S,
  woodenSupports_S, woodenSupportBeams_S, woodenSupportsBeam_S, woodenSupportsBlock_S
`

const CITY_TILE_DOCS = `
## Available City Tiles

GROUNDS (ground layer - use name only):
  tile_ground_grass, tile_ground_concrete_normal, tile_ground_asphalt_normal,
  tile_ground_dirt_normal, tile_ground_water, tile_ground_dirt_puddle, tile_ground_grass_puddle,
  tile_road_straight_SE_normal, tile_road_straight_SW_normal,
  tile_road_corner_E_normal, tile_road_corner_N_normal, tile_road_corner_S_normal, tile_road_corner_W_normal,
  tile_road_xing_normal, tile_road_deadend_NE_normal, tile_road_deadend_SE_normal, tile_road_deadend_SW_normal,
  tile_road_intersect_NE_normal, tile_road_intersect_NW_normal, tile_road_intersect_SE_normal, tile_road_intersect_SW_normal,
  tile_dirtroad_straight_SE, tile_dirtroad_straight_SW,
  tile_cropfield_growing, tile_cropfield_grown, tile_cropfield_racked

BUILDINGS (building layer - name only, path added automatically):
  bld_house_blue_SE_normal, bld_house_red_SE_normal, bld_house_yellow_SE_normal, bld_house_purple_SE_normal,
  bld_house2_brown_SE_normal, bld_house2_blue_SE_normal, bld_house2_sand_SE_normal, bld_house2_white_SE_normal,
  bld_house3_green_SE_normal, bld_house3_blue_SE_normal, bld_house3_brown_SE_normal,
  bld_cafe_pink_SE_normal, bld_barbershop_purple_SE_normal, bld_fruitstand_neutral_SE_normal,
  bld_office_gray_SE_normal, bld_office2_blue_SE_normal, bld_office3_yellow_SE_normal,
  bld_hospital_white_SE_normal, bld_policestation_blue_SE_normal, bld_church_neutral_SE_normal,
  bld_warehouse_brown_SE_normal, bld_gasstation_green_SE_normal, bld_barn_red_SE_normal

PROPS (prop layer - name only):
  prop_tree_styleA_normal, prop_tree_styleB_normal, prop_tree_styleC_normal,
  prop_flowers_pink, prop_flowers_red, prop_flowers_yellow,
  prop_lightpole_standard_SE_normal, prop_trafficlight_standard_SE_normal,
  prop_trashcan_blue_SE_normal, prop_mailbox_standard_SE_normal, prop_fence_wood_SE_normal,
  prop_rock_brown, prop_rock_gray, prop_weeds_styleA

VEHICLES (vehicle layer - name only):
  veh_sedan_blue_SE_normal, veh_sedan_red_SE_normal, veh_sedan_white_SE_normal,
  veh_pickup_blue_SE_normal, veh_pickup_green_SE_normal,
  veh_van_white_SE_normal, veh_van_black_SE_normal,
  veh_truck_green_SE_normal, veh_truck_red_SE_normal,
  veh_ambulance_SE_normal, veh_patrol_SE_normal, veh_firetruck_SE_normal
`

const SYSTEM_PROMPT = `You are an isometric map generator for a tile-based game.

You output a COMPACT format using a legend + character grid. This keeps the output small.

FORMAT:
{
  "legend": {
    ".": { "g": "default_ground_tile" },
    "#": { "g": "floor_tile", "b": "wall_tile" },
    "A": { "g": "floor_tile", "b": "wall_with_door" },
    "T": { "g": "floor_tile", "p": "table_prop" },
    ...more entries as needed (use any printable ASCII character)
  },
  "grid": [
    "........########........",
    "........#......#........",
    "........A......A........",
    "........#..TT..#........",
    "........########........",
    ...one string per row, each character = one cell
  ]
}

RULES:
- "legend" maps single characters to cell definitions. Keys: "g"=ground, "b"=building/wall, "p"=prop, "v"=vehicle/structure. Use TILE NAMES ONLY (no paths).
- "grid" is an array of strings. Each string is one row. Each character maps to a legend entry.
- Grid must be EXACTLY the requested dimensions (each row same length = width, number of rows = height).
- Every legend entry MUST have "g" (ground). "b", "p", "v" are optional.
- Use "." for empty/default ground. Use "#" for walls. Use letters/symbols for other tile combos.
- Design interesting, realistic layouts. Walls should form room boundaries. Leave walkable space. Place props logically.
- ONLY use tile names from the provided list. Do NOT invent names.
- Output ONLY the JSON. No markdown, no explanation.`

// Map tile names to full asset paths based on theme
function resolveCell(
  legendEntry: { g?: string; b?: string; p?: string; v?: string },
  theme: string,
  defaultGround: string
): Record<string, string> {
  const cell: Record<string, string> = {
    ground: legendEntry.g || defaultGround,
  }

  const buildPath = (name: string, layer: "building" | "prop" | "vehicle") => {
    if (!name) return undefined
    if (theme === "dungeon") return `/assets/dungeon/${name}.png`
    // City: determine subfolder from layer
    switch (layer) {
      case "building": return `/assets/city/Buildings/${name}.png`
      case "prop": return `/assets/city/Props/${name}.png`
      case "vehicle": return `/assets/city/Vehicles/${name}.png`
    }
  }

  if (legendEntry.b) {
    const path = buildPath(legendEntry.b, "building")
    if (path) cell.building = path
  }
  if (legendEntry.p) {
    const path = buildPath(legendEntry.p, "prop")
    if (path) cell.prop = path
  }
  if (legendEntry.v) {
    const path = buildPath(legendEntry.v, "vehicle")
    if (path) cell.vehicle = path
  }

  return cell
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not configured" },
      { status: 500 }
    )
  }

  const { prompt, gridWidth, gridHeight, theme } = await req.json()

  if (!prompt || !gridWidth || !gridHeight || !theme) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 }
    )
  }

  const tileDocs = theme === "dungeon" ? DUNGEON_TILE_DOCS : CITY_TILE_DOCS
  const defaultGround = theme === "dungeon" ? "stone_S" : "tile_ground_grass"

  const userMessage = `Generate a ${gridWidth}x${gridHeight} ${theme} map:
"${prompt}"

${tileDocs}

Grid: ${gridWidth} columns x ${gridHeight} rows. Default ground: "${defaultGround}".
Each grid row string must be EXACTLY ${gridWidth} characters. There must be EXACTLY ${gridHeight} rows.
Output ONLY valid JSON, no markdown.`

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 16000,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    })

    const text =
      response.content[0].type === "text" ? response.content[0].text : ""

    // Extract JSON from response
    let jsonStr = text.trim()
    // Strip markdown fences if present
    if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "")
    }

    const data = JSON.parse(jsonStr)

    if (!data.legend || !data.grid || !Array.isArray(data.grid)) {
      return NextResponse.json(
        { error: "Invalid response format - missing legend or grid" },
        { status: 500 }
      )
    }

    const legend: Record<string, { g?: string; b?: string; p?: string; v?: string }> = data.legend
    const grid: string[] = data.grid

    // Expand the compact format into full cells
    const cells: Record<string, string>[][] = []
    for (let y = 0; y < gridHeight; y++) {
      const row: Record<string, string>[] = []
      const gridRow = grid[y] || ""
      for (let x = 0; x < gridWidth; x++) {
        const char = gridRow[x] || "."
        const legendEntry = legend[char] || { g: defaultGround }
        row.push(resolveCell(legendEntry, theme, defaultGround))
      }
      cells.push(row)
    }

    return NextResponse.json({ cells })
  } catch (e) {
    console.error("AI generation error:", e)
    const msg = e instanceof Error ? e.message : "AI generation failed"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
