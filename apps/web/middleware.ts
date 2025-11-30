/**
 * Next.js Middleware
 * Handles authentication, security headers, and route protection
 */

import { NextRequest, NextResponse } from "next/server"

// Security headers to apply to all responses
// These complement the headers defined in next.config.ts
// Middleware headers are applied dynamically and can override static headers
const securityHeaders: Record<string, string> = {
  "X-DNS-Prefetch-Control": "on",
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
  "X-Frame-Options": "SAMEORIGIN",
  "X-Content-Type-Options": "nosniff",
  "X-XSS-Protection": "1; mode=block",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), interest-cohort=()",
}

// Routes that require authentication
const protectedRoutes = [
  "/",
  "/people",
  "/security",
  "/settings",
]

// Routes that should redirect to dashboard if already authenticated
const authRoutes = ["/login", "/register"]

// Public routes that don't require authentication
const publicRoutes = [
  "/api/auth/login",
  "/api/auth/logout",
  "/api/auth/sso-config",
  "/api/auth/login/azure-ad",
  "/api/auth/callback/azure-ad",
  "/api/scim", // SCIM endpoints have their own token auth
  "/api/health",
  "/registration-incomplete",
  "/set-password",
]

/**
 * Check if the path matches any of the provided patterns
 */
function matchesPath(pathname: string, patterns: string[]): boolean {
  return patterns.some((pattern) => {
    if (pattern.endsWith("*")) {
      return pathname.startsWith(pattern.slice(0, -1))
    }
    return pathname === pattern || pathname.startsWith(pattern + "/")
  })
}

/**
 * Apply security headers to a response
 */
function applySecurityHeaders(response: NextResponse): NextResponse {
  Object.entries(securityHeaders).forEach(([key, value]) => {
    response.headers.set(key, value)
  })
  return response
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Skip middleware for static files and Next.js internals
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/static") ||
    pathname.includes(".") // Files with extensions (images, fonts, etc.)
  ) {
    return NextResponse.next()
  }

  // Get session token from cookies
  const sessionToken = request.cookies.get("session")?.value

  // Check if path is public (no auth required)
  const isPublicRoute = matchesPath(pathname, publicRoutes)
  
  // Check if path is an auth route (login/register)
  const isAuthRoute = matchesPath(pathname, authRoutes)
  
  // Check if path is protected (requires auth)
  const isProtectedRoute = matchesPath(pathname, protectedRoutes) && !isPublicRoute

  // Handle auth routes - redirect to dashboard if already authenticated
  if (isAuthRoute && sessionToken) {
    const response = NextResponse.redirect(new URL("/", request.url))
    return applySecurityHeaders(response)
  }

  // Handle protected routes - redirect to login if not authenticated
  if (isProtectedRoute && !sessionToken) {
    const loginUrl = new URL("/login", request.url)
    loginUrl.searchParams.set("returnTo", pathname)
    const response = NextResponse.redirect(loginUrl)
    return applySecurityHeaders(response)
  }

  // Apply security headers to all responses
  const response = NextResponse.next()
  return applySecurityHeaders(response)
}

// Configure which routes the middleware runs on
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
}
