import type React from "react"
import type { Metadata } from "next"
import { Geist } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { ThemeProvider } from "next-themes"
import { Toaster } from "sonner"
import { QueryProvider } from "@/lib/api/query-provider"
import { RBACProvider } from "@/lib/rbac"
import "./globals.css"

const geist = Geist({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "IdaraOS - Company OS",
  description: "Open-source company operating system for managing people, assets, security, and compliance",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  // Only enable Vercel Analytics on Vercel platform
  // On Azure Container Apps, this would cause 404 errors and CSP violations
  const isVercel = process.env.VERCEL === "1" || process.env.NEXT_PUBLIC_VERCEL_ENV

  return (
    <html lang="en" suppressHydrationWarning className={`${geist.className} h-full`}>
      <body className="font-sans antialiased h-full" suppressHydrationWarning>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <QueryProvider>
            <RBACProvider>
              <div className="h-full">
                {children}
              </div>
              {isVercel && <Analytics />}
              <Toaster />
            </RBACProvider>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
