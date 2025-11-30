"use client"

import { Suspense } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { Building2, UserX, Mail, ArrowLeft, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"

function RegistrationIncompleteContent() {
  const searchParams = useSearchParams()
  const email = searchParams.get("email")

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/50 p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="h-12 w-12 rounded-xl bg-primary flex items-center justify-center">
            <Building2 className="h-7 w-7 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">IdaraOS</h1>
            <p className="text-sm text-muted-foreground">Company OS</p>
          </div>
        </div>

        <Card className="border-border/50 shadow-xl">
          <CardHeader className="space-y-1 pb-4 text-center">
            <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
              <UserX className="h-8 w-8 text-orange-600 dark:text-orange-400" />
            </div>
            <CardTitle className="text-2xl font-semibold">Registration Incomplete</CardTitle>
            <CardDescription className="text-base">
              Your account has not been set up yet
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-4">
            <div className="rounded-lg bg-muted/50 p-4 space-y-3">
              <p className="text-sm text-muted-foreground">
                We found your Microsoft account, but you haven&apos;t been registered in the system yet.
              </p>
              
              {email && (
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{email}</span>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <h3 className="font-medium text-sm">What to do next:</h3>
              <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                <li>Contact your manager or IT administrator</li>
                <li>Ask them to create your account in the system</li>
                <li>Once your account is created, try signing in again</li>
              </ol>
            </div>

            <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 p-4">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                <strong>For Administrators:</strong> Go to Settings → Users & Access to add this user to the system.
              </p>
            </div>
          </CardContent>
          
          <CardFooter className="flex flex-col gap-3 pt-2">
            <Button asChild variant="outline" className="w-full">
              <Link href="/login">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Login
              </Link>
            </Button>
          </CardFooter>
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Need help?{" "}
          <a href="mailto:support@company.com" className="hover:underline">
            Contact Support
          </a>
        </p>
      </div>
    </div>
  )
}

function LoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  )
}

export default function RegistrationIncompletePage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <RegistrationIncompleteContent />
    </Suspense>
  )
}
