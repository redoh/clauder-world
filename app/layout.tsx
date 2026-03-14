import type { Viewport } from "next"
import { Geist, Geist_Mono, Nunito_Sans } from "next/font/google"

import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { UserMenu } from "@/components/user-menu"
import { cn } from "@/lib/utils";

const nunitoSans = Nunito_Sans({variable:'--font-sans'})

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn("antialiased", fontMono.variable, "font-sans", nunitoSans.variable)}
    >
      <body className="overflow-hidden touch-none">
        <ThemeProvider>
          <header className="fixed top-0 right-0 left-0 z-50 flex items-center justify-end px-4 py-2">
            <div className="rounded-lg bg-zinc-900 px-4 py-2">
              <UserMenu />
            </div>
          </header>
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
