import type React from "react"
import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { ThemeProvider } from "next-themes"
import { Toaster } from "sonner"
import { QueryProvider } from "@/lib/api/query-provider"
import { RBACProvider } from "@/lib/rbac"
import "./globals.css"

const geist = Geist({ subsets: ["latin"] })
const geistMono = Geist_Mono({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "IdaraOS - Company OS",
  description: "Open-source company operating system for managing people, assets, security, and compliance",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={geist.className}>
      <body className="font-sans antialiased" suppressHydrationWarning>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <QueryProvider>
            <RBACProvider>
              {children}
              <Analytics />
              <Toaster />
            </RBACProvider>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
