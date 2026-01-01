"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Building2, Loader2, Eye, EyeOff } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"

// Microsoft Entra ID Icon
function MicrosoftIcon({ className }: { readonly className?: string }) {
  return (
    <svg className={className} viewBox="0 0 21 21" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="1" y="1" width="9" height="9" fill="#F25022"/>
      <rect x="11" y="1" width="9" height="9" fill="#7FBA00"/>
      <rect x="1" y="11" width="9" height="9" fill="#00A4EF"/>
      <rect x="11" y="11" width="9" height="9" fill="#FFB900"/>
    </svg>
  )
}

interface SSOConfig {
  ssoAvailable: boolean
  tenantId: string | null
  clientId: string | null
  passwordAuthDisabled: boolean
}

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [urlError, setUrlError] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isSSOLoading, setIsSSOLoading] = useState(false)
  const [appName, setAppName] = useState("IdaraOS")
  const [tagline, setTagline] = useState<string>("Company OS")
  const [ssoConfig, setSSOConfig] = useState<SSOConfig | null>(null)

  // Check for error in URL params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const errorParam = params.get("error")
    if (errorParam) {
      setUrlError(decodeURIComponent(errorParam))
      // Clean up URL
      window.history.replaceState({}, "", "/login")
    }
  }, [])

  // Fetch public branding and SSO config
  useEffect(() => {
    // Fetch branding
    fetch("/api/public/branding")
      .then(res => res.json())
      .then(data => {
        if (data.appName) setAppName(data.appName)
        // Empty string means hide, null/undefined defaults to "Company OS"
        setTagline(data.tagline === "" ? "" : (data.tagline ?? "Company OS"))
      })
      .catch(() => {
        // Keep default on error
      })

    // Check if SSO is available via environment variables
    fetch("/api/auth/sso-config")
      .then(res => res.json())
      .then(data => {
        if (data.ssoAvailable) {
          setSSOConfig(data)
        }
      })
      .catch(() => {
        // SSO not available
      })
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || "Login failed")
        return
      }

      // Get return URL from query params, default to dashboard
      const returnTo = new URLSearchParams(window.location.search).get("returnTo") || "/dashboard"
      
      // Redirect to dashboard on success
      router.push(returnTo)
      router.refresh()
    } catch {
      setError("An error occurred. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleMicrosoftSSO = async () => {
    setIsSSOLoading(true)
    setError("")
    setUrlError("")

    // Get return URL from query params, default to dashboard
    const returnTo = new URLSearchParams(window.location.search).get("returnTo") || "/dashboard"

    // Redirect to our SSO login endpoint which handles the OAuth flow
    window.location.href = `/api/auth/login/azure-ad?returnTo=${encodeURIComponent(returnTo)}`
  }

  const ssoAvailable = ssoConfig?.ssoAvailable === true

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/50 p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="h-12 w-12 rounded-xl bg-primary flex items-center justify-center">
            <Building2 className="h-7 w-7 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{appName}</h1>
            {tagline && <p className="text-sm text-muted-foreground">{tagline}</p>}
          </div>
        </div>

        <Card className="border-border/50 shadow-xl">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-2xl font-semibold">Welcome back</CardTitle>
            <CardDescription>
              Sign in to your account to continue
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-4">
            {(error || urlError) && (
              <div className="p-3 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg">
                {error || urlError}
              </div>
            )}

            {/* Microsoft SSO Button */}
            {ssoAvailable && (
              <>
                <Button 
                  type="button"
                  variant={ssoConfig?.passwordAuthDisabled ? "default" : "outline"}
                  className="w-full h-11 gap-3"
                  onClick={handleMicrosoftSSO}
                  disabled={isSSOLoading}
                >
                  {isSSOLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <MicrosoftIcon className="h-5 w-5" />
                  )}
                  Sign in with Microsoft
                </Button>

                {!ssoConfig?.passwordAuthDisabled && (
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <Separator className="w-full" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-card px-2 text-muted-foreground">
                        Or continue with email
                      </span>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Email/Password Form - Only show if password auth is not disabled */}
            {(!ssoAvailable || !ssoConfig?.passwordAuthDisabled) && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  autoFocus={!ssoAvailable}
                />
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <Link 
                    href="/forgot-password" 
                    className="text-sm text-muted-foreground hover:text-primary transition-colors"
                  >
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                </div>
              </div>
              
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Sign in
              </Button>
            </form>
            )}

            {/* SSO Only Message */}
            {ssoAvailable && ssoConfig?.passwordAuthDisabled && (
              <p className="text-sm text-center text-muted-foreground">
                Your organization requires sign-in with Microsoft.
              </p>
            )}
          </CardContent>
          
          <CardFooter className="flex flex-col gap-3 pt-2">
            <p className="text-sm text-center text-muted-foreground">
              Don&apos;t have an account?{" "}
              <Link href="/setup" className="text-primary hover:underline">
                Set up your account
              </Link>
            </p>
          </CardFooter>
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-6">
          By signing in, you agree to our{" "}
          <Link href="/terms" className="hover:underline">Terms of Service</Link>
          {" "}and{" "}
          <Link href="/privacy" className="hover:underline">Privacy Policy</Link>
        </p>
      </div>
    </div>
  )
}
