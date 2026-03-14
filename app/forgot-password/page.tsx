"use client"

import { useState } from "react"
import { authClient } from "@/lib/auth-client"
import { AuthLayout } from "@/components/auth-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import Link from "next/link"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)
    const res = await authClient.requestPasswordReset({ email, redirectTo: "/reset-password" })
    setLoading(false)
    if (res.error) {
      setError(res.error.message ?? "Failed to send reset email")
    } else {
      setSent(true)
    }
  }

  if (sent) {
    return (
      <AuthLayout>
        <div className="text-center">
          <h1 className="mb-2 text-2xl font-bold text-foreground">Check your email</h1>
          <p className="text-muted-foreground">
            If an account exists for <strong>{email}</strong>, we sent a password reset link.
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
        <h1 className="text-2xl font-bold text-foreground">Forgot password</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Enter your email and we&apos;ll send you a reset link
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
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

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Sending..." : "Send reset link"}
        </Button>
      </form>

      <p className="mt-4 text-center text-sm text-muted-foreground">
        <Link href="/sign-in" className="text-foreground underline hover:no-underline">
          Back to sign in
        </Link>
      </p>
    </AuthLayout>
  )
}
