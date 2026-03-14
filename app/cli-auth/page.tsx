"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { useSession, signIn, signUp } from "@/lib/auth-client"
import { AuthLayout } from "@/components/auth-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Suspense } from "react"

function CliAuthFlow() {
  const searchParams = useSearchParams()
  const port = searchParams.get("port")
  const { data: session, isPending } = useSession()
  const [status, setStatus] = useState<"pending" | "authorizing" | "success" | "error">("pending")
  const [error, setError] = useState("")

  // Auth form state
  const [mode, setMode] = useState<"signin" | "signup">("signin")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [name, setName] = useState("")
  const [loading, setLoading] = useState(false)
  const [formError, setFormError] = useState("")

  // Once logged in, send token to CLI
  useEffect(() => {
    if (!session?.user || !port || status !== "pending") return

    setStatus("authorizing")

    fetch(`${window.location.origin}/api/cli-auth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ port: Number(port) }),
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to authorize")
        return res.json()
      })
      .then(() => setStatus("success"))
      .catch((err) => {
        setError(err.message)
        setStatus("error")
      })
  }, [session, port, status])

  if (!port) {
    return (
      <AuthLayout>
        <div className="text-center">
          <h1 className="mb-2 text-2xl font-bold text-foreground">Invalid request</h1>
          <p className="text-muted-foreground">Missing callback port. Run `clauder-world login` from your terminal.</p>
        </div>
      </AuthLayout>
    )
  }

  if (status === "success") {
    return (
      <AuthLayout>
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-500/20">
            <svg className="h-8 w-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="mb-2 text-2xl font-bold text-foreground">Authorized!</h1>
          <p className="text-muted-foreground">You can close this tab and return to your terminal.</p>
        </div>
      </AuthLayout>
    )
  }

  if (status === "error") {
    return (
      <AuthLayout>
        <div className="text-center">
          <h1 className="mb-2 text-2xl font-bold text-destructive">Authorization failed</h1>
          <p className="text-muted-foreground">{error}</p>
          <Button className="mt-4" onClick={() => setStatus("pending")}>
            Try again
          </Button>
        </div>
      </AuthLayout>
    )
  }

  if (isPending || status === "authorizing") {
    return (
      <AuthLayout>
        <div className="text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-foreground/20 border-t-foreground" />
          <h1 className="mb-2 text-2xl font-bold text-foreground">
            {status === "authorizing" ? "Authorizing CLI..." : "Loading..."}
          </h1>
        </div>
      </AuthLayout>
    )
  }

  // Not logged in — show login form
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError("")
    setLoading(true)

    if (mode === "signin") {
      const res = await signIn.email({ email, password })
      setLoading(false)
      if (res.error) setFormError(res.error.message ?? "Sign in failed")
    } else {
      const res = await signUp.email({ name, email, password })
      setLoading(false)
      if (res.error) setFormError(res.error.message ?? "Sign up failed")
    }
  }

  async function handleSocial(provider: "google" | "github" | "discord") {
    await signIn.social({ provider, callbackURL: `/cli-auth?port=${port}` })
  }

  return (
    <AuthLayout>
      <div className="mb-6 text-center">
        <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-foreground/10 font-mono text-lg font-bold text-foreground">
          {">"}_
        </div>
        <h1 className="text-2xl font-bold text-foreground">Authorize CLI</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Sign in to connect your terminal to clauder.world
        </p>
      </div>

      <div className="flex gap-3">
        <Button variant="outline" className="flex-1 bg-white/10 backdrop-blur-sm" onClick={() => handleSocial("google")}>
          Google
        </Button>
        <Button variant="outline" className="flex-1 bg-white/10 backdrop-blur-sm" onClick={() => handleSocial("github")}>
          GitHub
        </Button>
        <Button variant="outline" className="flex-1 bg-white/10 backdrop-blur-sm" onClick={() => handleSocial("discord")}>
          Discord
        </Button>
      </div>

      <div className="my-6 flex items-center gap-3">
        <Separator className="flex-1" />
        <span className="text-xs text-muted-foreground">or</span>
        <Separator className="flex-1" />
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {mode === "signup" && (
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} required className="bg-white/10 backdrop-blur-sm" />
          </div>
        )}
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required className="bg-white/10 backdrop-blur-sm" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required className="bg-white/10 backdrop-blur-sm" />
        </div>

        {formError && <p className="text-sm text-destructive">{formError}</p>}

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "..." : mode === "signin" ? "Sign in" : "Create account"}
        </Button>
      </form>

      <p className="mt-4 text-center text-sm text-muted-foreground">
        {mode === "signin" ? (
          <>
            No account?{" "}
            <button onClick={() => setMode("signup")} className="text-foreground underline hover:no-underline">
              Sign up
            </button>
          </>
        ) : (
          <>
            Have an account?{" "}
            <button onClick={() => setMode("signin")} className="text-foreground underline hover:no-underline">
              Sign in
            </button>
          </>
        )}
      </p>
    </AuthLayout>
  )
}

export default function CliAuthPage() {
  return (
    <Suspense>
      <CliAuthFlow />
    </Suspense>
  )
}
