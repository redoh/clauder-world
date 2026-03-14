"use client"

import { useState } from "react"
import { signUp, signIn } from "@/lib/auth-client"
import { AuthLayout } from "@/components/auth-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import Link from "next/link"

export default function SignUpPage() {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)
    const res = await signUp.email({ name, email, password, callbackURL: "/" })
    setLoading(false)
    if (res.error) {
      setError(res.error.message ?? "Sign up failed")
    } else {
      setSuccess(true)
    }
  }

  async function handleSocial(provider: "google" | "github" | "discord") {
    await signIn.social({ provider, callbackURL: "/" })
  }

  if (success) {
    return (
      <AuthLayout>
        <div className="text-center">
          <h1 className="mb-2 text-2xl font-bold text-foreground">Check your email</h1>
          <p className="text-muted-foreground">
            We sent a verification link to <strong>{email}</strong>
          </p>
          <Link href="/sign-in">
            <Button variant="ghost" className="mt-4">
              Back to sign in
            </Button>
          </Link>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout>
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold text-foreground">Create account</h1>
        <p className="mt-1 text-sm text-muted-foreground">Get started for free</p>
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

      <form onSubmit={handleSignUp} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="bg-white/10 backdrop-blur-sm"
          />
        </div>
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
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            className="bg-white/10 backdrop-blur-sm"
          />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Creating account..." : "Create account"}
        </Button>
      </form>

      <p className="mt-4 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/sign-in" className="text-foreground underline hover:no-underline">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  )
}
