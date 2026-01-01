"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Building2, Loader2, Eye, EyeOff, Check } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"

export default function SetupPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [appName, setAppName] = useState("IdaraOS")
  const [tagline, setTagline] = useState<string>("Company OS")

  // Fetch public branding
  useEffect(() => {
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
  }, [])

  // Password requirements
  const hasMinLength = password.length >= 8
  const hasUppercase = /[A-Z]/.test(password)
  const hasLowercase = /[a-z]/.test(password)
  const hasNumber = /[0-9]/.test(password)
  const passwordsMatch = password === confirmPassword && password.length > 0

  const isPasswordValid = hasMinLength && hasUppercase && hasLowercase && hasNumber

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (!isPasswordValid) {
      setError("Please meet all password requirements")
      return
    }

    if (!passwordsMatch) {
      setError("Passwords do not match")
      return
    }

    setIsLoading(true)

    try {
      const response = await fetch("/api/auth/set-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || "Failed to set password")
        return
      }

      setSuccess(true)
      
      // Redirect to login after 2 seconds
      setTimeout(() => {
        router.push("/login")
      }, 2000)
    } catch {
      setError("An error occurred. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/50 p-4">
        <Card className="w-full max-w-md border-border/50 shadow-xl">
          <CardContent className="pt-6 text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center mb-4">
              <Check className="h-6 w-6 text-green-500" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Password Set Successfully</h2>
            <p className="text-muted-foreground mb-4">
              Your account is now active. Redirecting to login...
            </p>
            <Link href="/login">
              <Button variant="outline">Go to Login</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

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
            <CardTitle className="text-2xl font-semibold">Set up your account</CardTitle>
            <CardDescription>
              Create a password to activate your account
            </CardDescription>
          </CardHeader>
          
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              {error && (
                <div className="p-3 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg">
                  {error}
                </div>
              )}
              
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
                  autoFocus
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Create a strong password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="new-password"
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
                
                {/* Password requirements */}
                <div className="text-xs space-y-1 mt-2">
                  <p className={hasMinLength ? "text-green-500" : "text-muted-foreground"}>
                    {hasMinLength ? "✓" : "○"} At least 8 characters
                  </p>
                  <p className={hasUppercase ? "text-green-500" : "text-muted-foreground"}>
                    {hasUppercase ? "✓" : "○"} One uppercase letter
                  </p>
                  <p className={hasLowercase ? "text-green-500" : "text-muted-foreground"}>
                    {hasLowercase ? "✓" : "○"} One lowercase letter
                  </p>
                  <p className={hasNumber ? "text-green-500" : "text-muted-foreground"}>
                    {hasNumber ? "✓" : "○"} One number
                  </p>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type={showPassword ? "text" : "password"}
                  placeholder="Confirm your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                />
                {confirmPassword && !passwordsMatch && (
                  <p className="text-xs text-destructive">Passwords do not match</p>
                )}
              </div>
            </CardContent>
            
            <CardFooter className="flex flex-col gap-3 pt-4">
              <Button 
                type="submit" 
                className="w-full" 
                disabled={isLoading || !isPasswordValid || !passwordsMatch}
              >
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Activate Account
              </Button>
              
              <p className="text-sm text-center text-muted-foreground">
                Already have an account?{" "}
                <Link href="/login" className="text-primary hover:underline">
                  Sign in
                </Link>
              </p>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  )
}

