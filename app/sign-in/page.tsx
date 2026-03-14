"use client"

import { useState } from "react"
import { signIn, authClient } from "@/lib/auth-client"
import { AuthLayout } from "@/components/auth-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import Link from "next/link"

export default function SignInPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [magicLinkSent, setMagicLinkSent] = useState(false)

  async function handleEmailSignIn(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)
    const res = await signIn.email({ email, password, callbackURL: "/" })
    setLoading(false)
    if (res.error) setError(res.error.message ?? "Sign in failed")
  }

  async function handleMagicLink() {
    setError("")
    if (!email) {
      setError("Enter your email first")
      return
    }
    setLoading(true)
    const res = await signIn.magicLink({ email, callbackURL: "/" })
    setLoading(false)
    if (res.error) {
      setError(res.error.message ?? "Failed to send magic link")
    } else {
      setMagicLinkSent(true)
    }
  }

  async function handleSocial(provider: "google" | "github" | "discord") {
    await signIn.social({ provider, callbackURL: "/" })
  }

  if (magicLinkSent) {
    return (
      <AuthLayout>
        <div className="text-center">
          <h1 className="mb-2 text-2xl font-bold text-foreground">Check your email</h1>
          <p className="text-muted-foreground">
            We sent a magic link to <strong>{email}</strong>
          </p>
          <Button
            variant="ghost"
            className="mt-4"
            onClick={() => setMagicLinkSent(false)}
          >
            Back to sign in
          </Button>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout>
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold text-foreground">Welcome back</h1>
        <p className="mt-1 text-sm text-muted-foreground">Sign in to your account</p>
      </div>

      {/* Social providers */}
      <div className="flex gap-3">
        <Button
          variant="outline"
          className="flex-1 bg-white/10 backdrop-blur-sm"
          onClick={() => handleSocial("google")}
        >
          Google
        </Button>
        <Button
          variant="outline"
          className="flex-1 bg-white/10 backdrop-blur-sm"
          onClick={() => handleSocial("github")}
        >
          GitHub
        </Button>
        <Button
          variant="outline"
          className="flex-1 bg-white/10 backdrop-blur-sm"
          onClick={() => handleSocial("discord")}
        >
          Discord
        </Button>
      </div>

      <div className="my-6 flex items-center gap-3">
        <Separator className="flex-1" />
        <span className="text-xs text-muted-foreground">or</span>
        <Separator className="flex-1" />
      </div>

      {/* Email/password form */}
      <form onSubmit={handleEmailSignIn} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="bg-white/10 backdrop-blur-sm"
          />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link
              href="/forgot-password"
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Forgot password?
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="bg-white/10 backdrop-blur-sm"
          />
        </div>

        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Signing in..." : "Sign in"}
        </Button>
      </form>

      <Button
        variant="ghost"
        className="mt-3 w-full text-sm"
        onClick={handleMagicLink}
        disabled={loading}
      >
        Send magic link instead
      </Button>

      <p className="mt-4 text-center text-sm text-muted-foreground">
        Don&apos;t have an account?{" "}
        <Link href="/sign-up" className="text-foreground underline hover:no-underline">
          Sign up
        </Link>
      </p>
    </AuthLayout>
  )
}
