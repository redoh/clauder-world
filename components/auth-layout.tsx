"use client"

export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-primary/30 via-background to-accent/40">
      {/* Decorative blurred circles */}
      <div className="absolute -top-40 -left-40 h-96 w-96 rounded-full bg-primary/20 blur-3xl" />
      <div className="absolute -right-40 -bottom-40 h-96 w-96 rounded-full bg-accent/30 blur-3xl" />
      <div className="absolute top-1/3 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-chart-2/15 blur-3xl" />

      {/* Glass card */}
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-white/20 bg-white/10 p-8 shadow-2xl backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
        {children}
      </div>
    </div>
  )
}
