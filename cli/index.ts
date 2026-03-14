#!/usr/bin/env node --import=tsx
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from "fs"
import { homedir } from "os"
import { join } from "path"
import { createServer } from "http"
import { exec } from "child_process"

const CONFIG_DIR = join(homedir(), ".clauder-world")
const CONFIG_FILE = join(CONFIG_DIR, "config.json")
const BASE_URL = process.env.CLAUDER_WORLD_URL || "http://localhost:3000"

const HOOK_EVENTS = [
  "SessionStart",
  "UserPromptSubmit",
  "PostToolUse",
  "Stop",
  "SubagentStart",
  "SubagentStop",
  "SessionEnd",
]

// ============================================================
// Config helpers
// ============================================================
interface Config {
  token: string
  userName: string
  userId: string
}

function loadConfig(): Config | null {
  if (!existsSync(CONFIG_FILE)) return null
  try {
    const data = JSON.parse(readFileSync(CONFIG_FILE, "utf-8"))
    if (!data.token) return null
    return data
  } catch {
    return null
  }
}

function saveConfig(config: Config) {
  mkdirSync(CONFIG_DIR, { recursive: true })
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2))
}

function requireConfig(): Config {
  const config = loadConfig()
  if (!config) {
    console.error("  Not logged in. Run: clauder-world login")
    process.exit(1)
  }
  return config
}

// ============================================================
// API helpers
// ============================================================
async function apiPost(path: string, body: Record<string, unknown>, token?: string) {
  const headers: Record<string, string> = { "Content-Type": "application/json" }
  if (token) headers["Authorization"] = `Bearer ${token}`

  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`API error ${res.status}: ${text}`)
  }

  return res.json()
}

// ============================================================
// Commands
// ============================================================
function openBrowser(url: string) {
  const cmd = process.platform === "darwin"
    ? "open"
    : process.platform === "win32"
      ? "start"
      : "xdg-open"
  exec(`${cmd} "${url}"`)
}

async function login() {
  console.log("\n  clauder-world login\n")

  // Start a temporary local server to receive the auth callback
  const result = await new Promise<Config>((resolve, reject) => {
    const timeout = setTimeout(() => {
      server.close()
      reject(new Error("Login timed out (60s). Try again."))
    }, 60_000)

    const server = createServer((req, res) => {
      // CORS headers for the browser POST
      res.setHeader("Access-Control-Allow-Origin", "*")
      res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS")
      res.setHeader("Access-Control-Allow-Headers", "Content-Type")

      if (req.method === "OPTIONS") {
        res.writeHead(204)
        res.end()
        return
      }

      if (req.method === "POST" && req.url === "/callback") {
        let body = ""
        req.on("data", (chunk) => { body += chunk })
        req.on("end", () => {
          try {
            const data = JSON.parse(body) as { token: string; userName: string; userId: string }
            res.writeHead(200, { "Content-Type": "application/json" })
            res.end(JSON.stringify({ ok: true }))
            clearTimeout(timeout)
            server.close()
            resolve(data)
          } catch {
            res.writeHead(400)
            res.end("invalid json")
          }
        })
        return
      }

      res.writeHead(404)
      res.end()
    })

    server.listen(0, "127.0.0.1", () => {
      const addr = server.address()
      if (!addr || typeof addr === "string") {
        reject(new Error("Failed to start local server"))
        return
      }

      const port = addr.port
      const authUrl = `${BASE_URL}/cli-auth?port=${port}`

      console.log("  Opening browser to authorize...")
      console.log(`  If it doesn't open, visit: ${authUrl}\n`)
      console.log("  Waiting for authorization...\n")

      openBrowser(authUrl)
    })
  })

  saveConfig(result)
  console.log(`  Logged in as ${result.userName}!`)
  console.log("\n  Next steps:")
  console.log("    1. Run: clauder-world setup-hooks")
  console.log("    2. Start coding with Claude!\n")
}

function getClaudeSettingsPath(): string {
  return join(homedir(), ".claude", "settings.json")
}

function loadClaudeSettings(): Record<string, unknown> {
  const settingsPath = getClaudeSettingsPath()
  if (!existsSync(settingsPath)) return {}
  try {
    return JSON.parse(readFileSync(settingsPath, "utf-8"))
  } catch {
    return {}
  }
}

function saveClaudeSettings(settings: Record<string, unknown>) {
  const settingsPath = getClaudeSettingsPath()
  mkdirSync(join(homedir(), ".claude"), { recursive: true })
  writeFileSync(settingsPath, JSON.stringify(settings, null, 2))
}

async function setupHooks() {
  requireConfig()

  const settings = loadClaudeSettings()
  const existingHooks = (settings["hooks"] as Record<string, unknown>) || {}

  const hooks: Record<string, Array<{ matcher: string; hooks: Array<{ type: string; command: string; async: boolean; timeout: number }> }>> = {}

  for (const event of HOOK_EVENTS) {
    hooks[event] = [
      {
        matcher: "",
        hooks: [
          {
            type: "command",
            command: "cat | clauder-world hook",
            async: true,
            timeout: 5,
          },
        ],
      },
    ]
  }

  settings["hooks"] = { ...existingHooks, ...hooks }
  saveClaudeSettings(settings)

  console.log("\n  Claude Code hooks installed!")
  console.log(`  Config: ${getClaudeSettingsPath()}`)
  console.log(`  Events: ${HOOK_EVENTS.join(", ")}\n`)
}

async function uninstallHooks() {
  const settings = loadClaudeSettings()
  const hooks = settings["hooks"] as Record<string, unknown> | undefined

  if (!hooks) {
    console.log("\n  No hooks to uninstall.\n")
    return
  }

  // Remove only clauder-world hooks
  for (const event of HOOK_EVENTS) {
    const eventHooks = hooks[event] as Array<{ hooks: Array<{ command: string }> }> | undefined
    if (!eventHooks) continue

    // Filter out clauder-world hook entries
    const filtered = eventHooks.filter(
      (entry) => !entry.hooks?.some((h) => h.command?.includes("clauder-world"))
    )

    if (filtered.length === 0) {
      delete hooks[event]
    } else {
      hooks[event] = filtered
    }
  }

  // Clean up empty hooks object
  if (Object.keys(hooks).length === 0) {
    delete settings["hooks"]
  } else {
    settings["hooks"] = hooks
  }

  saveClaudeSettings(settings)
  console.log("\n  Claude Code hooks uninstalled!\n")
}

async function handleHook() {
  const config = loadConfig()
  if (!config) return

  let input = ""
  try {
    input = readFileSync("/dev/stdin", "utf-8")
  } catch {
    return
  }

  let hookData: Record<string, unknown> = {}
  try {
    hookData = JSON.parse(input)
  } catch {
    return
  }

  const event = (hookData.hook_event_name as string) || "unknown"
  const sessionId = (hookData.session_id as string) || "unknown"
  const toolName = hookData.tool_name as string | undefined

  let activity = ""
  switch (event) {
    case "SessionStart":
      activity = "session started"
      break
    case "UserPromptSubmit":
      activity = "thinking..."
      break
    case "PostToolUse":
      if (toolName === "Bash") activity = "running command..."
      else if (toolName === "Edit") activity = "editing code..."
      else if (toolName === "Write") activity = "writing file..."
      else if (toolName === "Read") activity = "reading code..."
      else if (toolName === "Grep") activity = "searching..."
      else if (toolName === "Glob") activity = "finding files..."
      else if (toolName === "Agent") activity = "spawned agent"
      else activity = `used ${toolName || "tool"}...`
      break
    case "Stop":
      activity = "waiting for response..."
      break
    case "SubagentStart":
      activity = "subagent started"
      break
    case "SubagentStop":
      activity = "subagent finished"
      break
    case "SessionEnd":
      activity = "session ended"
      break
    default:
      activity = event
  }

  try {
    await Promise.all([
      apiPost("/api/world/event", {
        event,
        data: { activity, toolName, sessionId },
      }, config.token),
      apiPost("/api/world/heartbeat", {
        sessionId,
        action: event === "SessionEnd" ? "stop" : "ping",
      }, config.token),
    ])
  } catch {
    // Silently fail - don't disrupt Claude Code
  }
}

async function status() {
  const config = loadConfig()
  if (!config) {
    console.log("\n  Not logged in.\n  Run: clauder-world login\n")
    return
  }
  console.log(`\n  Logged in as: ${config.userName}`)
  console.log(`  User ID: ${config.userId}`)
  console.log(`  Server: ${BASE_URL}`)
  console.log(`  Hooks config: ${getClaudeSettingsPath()}\n`)
}

async function whoami() {
  const config = requireConfig()

  try {
    const res = await fetch(`${BASE_URL}/api/world/whoami`, {
      headers: { "Authorization": `Bearer ${config.token}` },
    })

    if (!res.ok) {
      console.error("\n  Token is invalid or expired. Run: clauder-world login\n")
      process.exit(1)
    }

    const data = await res.json() as { name: string; email: string; id: string }
    console.log(`\n  ${data.name}`)
    console.log(`  ${data.email}`)
    console.log(`  ${BASE_URL}\n`)
  } catch (err) {
    console.error(`\n  Could not reach server: ${err instanceof Error ? err.message : err}\n`)
    process.exit(1)
  }
}

async function logout() {
  if (existsSync(CONFIG_FILE)) {
    rmSync(CONFIG_FILE)
    console.log("\n  Logged out.\n")
  } else {
    console.log("\n  Not logged in.\n")
  }
}

// ============================================================
// Main
// ============================================================
const command = process.argv[2]

switch (command) {
  case "login":
    login()
    break
  case "hook":
    handleHook()
    break
  case "setup-hooks":
    setupHooks()
    break
  case "uninstall-hooks":
    uninstallHooks()
    break
  case "whoami":
    whoami()
    break
  case "status":
    status()
    break
  case "logout":
    logout()
    break
  default:
    console.log(`
  clauder-world - Connect your Claude Code sessions to clauder.world

  Commands:
    login            Sign in with your account
    whoami           Verify token and show account info
    setup-hooks      Install Claude Code hooks
    uninstall-hooks  Remove Claude Code hooks
    status           Show local config
    logout           Sign out

  Usage:
    clauder-world login
    clauder-world whoami
    clauder-world setup-hooks
`)
}
