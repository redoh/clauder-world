"use client"

import { useState } from "react"
import { useSearchParams } from "next/navigation"
import { authClient } from "@/lib/auth-client"
import { AuthLayout } from "@/components/auth-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import Link from "next/link"
import { Suspense } from "react"

function ResetPasswordForm() {
  const searchParams = useSearchParams()
  const token = searchParams.get("token") ?? ""
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")

    if (password !== confirmPassword) {
      setError("Passwords don't match")
      return
    }

    if (!token) {
      setError("Invalid or missing reset token")
      return
    }

    setLoading(true)
    const res = await authClient.resetPassword({ newPassword: password, token })
    setLoading(false)
    if (res.error) {
      setError(res.error.message ?? "Failed to reset password")
    } else {
      setSuccess(true)
    }
  }

  if (success) {
    return (
      <AuthLayout>
        <div className="text-center">
          <h1 className="mb-2 text-2xl font-bold text-foreground">Password reset</h1>
          <p className="text-muted-foreground">
            Your password has been updated successfully.
          </p>
          <Link href="/sign-in">
            <Button className="mt-4">Sign in</Button>
          </Link>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout>
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold text-foreground">Reset password</h1>
        <p className="mt-1 text-sm text-muted-foreground">Enter your new password</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="password">New password</Label>
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
        <div className="space-y-2">
          <Label htmlFor="confirm">Confirm password</Label>
          <Input
            id="confirm"
            type="password"
            placeholder="••••••••"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={8}
            className="bg-white/10 backdrop-blur-sm"
          />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Resetting..." : "Reset password"}
        </Button>
      </form>
    </AuthLayout>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  )
}
