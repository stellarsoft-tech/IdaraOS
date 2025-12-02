/**
 * Next.js Middleware
 * Handles authentication, security headers, route protection, and multi-domain routing
 * 
 * Domain Architecture:
 * - idaraos.com (or root domain) → Marketing/landing pages only
 * - app.idaraos.com → Application (login, dashboard, all authenticated routes)
 * 
 * Users accessing app routes on the root domain are redirected to app subdomain.
 * Users accessing marketing routes on app subdomain are redirected to root domain.
 */

import { NextRequest, NextResponse } from "next/server"

// =============================================================================
// Domain Configuration
// =============================================================================

// The root/marketing domain (without app. prefix)
// Set via environment variable or defaults for different environments
const ROOT_DOMAIN = process.env.ROOT_DOMAIN || "idaraos.com"
const APP_SUBDOMAIN = process.env.APP_SUBDOMAIN || "app"

// Domains where multi-domain routing is enabled
// Add your production domains here. Localhost is excluded for easier development.
const MULTI_DOMAIN_HOSTS = [
  ROOT_DOMAIN,
  `${APP_SUBDOMAIN}.${ROOT_DOMAIN}`,
  // Add staging domains if needed
  // "staging.idaraos.com",
  // "app.staging.idaraos.com",
]

// Routes that should ONLY be on the marketing site (root domain)
// These redirect from app.domain → domain
const marketingOnlyRoutes = [
  "/", // Landing page
  "/pricing",
  "/about",
  "/contact",
  "/blog",
  "/features",
  "/enterprise",
  "/terms",
  "/privacy",
]

// Routes that should ONLY be on the app subdomain
// These redirect from domain → app.domain
const appOnlyRoutes = [
  "/login",
  "/register",
  "/dashboard",
  "/people",
  "/assets",
  "/security",
  "/docs",
  "/finance",
  "/vendors",
  "/workflows",
  "/settings",
  "/registration-incomplete",
  "/set-password",
]

// =============================================================================
// Security Configuration
// =============================================================================

// Security headers to apply to all responses
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
  "/dashboard",
  "/people",
  "/assets",
  "/security",
  "/docs",
  "/finance",
  "/vendors",
  "/workflows",
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
 * Check if the path exactly matches (for root path handling)
 */
function matchesExactPath(pathname: string, patterns: string[]): boolean {
  return patterns.includes(pathname)
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

/**
 * Check if we should apply multi-domain routing for this host
 */
function isMultiDomainEnabled(host: string): boolean {
  // Disable multi-domain routing for localhost/development
  if (host.includes("localhost") || host.includes("127.0.0.1")) {
    return false
  }
  
  // Disable for Azure Container Apps default URLs
  if (host.includes(".azurecontainerapps.io")) {
    return false
  }
  
  // Check if this is one of our configured domains
  const hostname = host.split(":")[0] // Remove port if present
  return MULTI_DOMAIN_HOSTS.some(d => hostname === d || hostname.endsWith(`.${d}`))
}

/**
 * Check if we're on the app subdomain
 */
function isAppSubdomain(host: string): boolean {
  const hostname = host.split(":")[0]
  return hostname.startsWith(`${APP_SUBDOMAIN}.`)
}

/**
 * Get the root domain from a hostname
 */
function getRootDomain(host: string): string {
  const hostname = host.split(":")[0]
  if (hostname.startsWith(`${APP_SUBDOMAIN}.`)) {
    return hostname.substring(APP_SUBDOMAIN.length + 1)
  }
  return hostname
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const host = request.headers.get("host") || ""

  // Skip middleware for static files and Next.js internals
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/static") ||
    pathname.includes(".") // Files with extensions (images, fonts, etc.)
  ) {
    return NextResponse.next()
  }

  // ==========================================================================
  // Multi-Domain Routing
  // ==========================================================================
  
  if (isMultiDomainEnabled(host)) {
    const onAppSubdomain = isAppSubdomain(host)
    const rootDomain = getRootDomain(host)
    
    // Check if this is a marketing-only route accessed from app subdomain
    // Redirect: app.idaraos.com/ → idaraos.com/
    if (onAppSubdomain && matchesExactPath(pathname, marketingOnlyRoutes)) {
      const marketingUrl = new URL(pathname, `https://${rootDomain}`)
      marketingUrl.search = request.nextUrl.search
      const response = NextResponse.redirect(marketingUrl)
      return applySecurityHeaders(response)
    }
    
    // Check if this is an app-only route accessed from root domain
    // Redirect: idaraos.com/login → app.idaraos.com/login
    if (!onAppSubdomain && matchesPath(pathname, appOnlyRoutes)) {
      const appUrl = new URL(pathname, `https://${APP_SUBDOMAIN}.${rootDomain}`)
      appUrl.search = request.nextUrl.search
      const response = NextResponse.redirect(appUrl)
      return applySecurityHeaders(response)
    }
  }

  // ==========================================================================
  // Authentication Handling
  // ==========================================================================
  
  // Get session token from cookies
  const sessionToken = request.cookies.get("idaraos_session")?.value

  // Check if path is public (no auth required)
  const isPublicRoute = matchesPath(pathname, publicRoutes)
  
  // Check if path is an auth route (login/register)
  const isAuthRoute = matchesPath(pathname, authRoutes)
  
  // Check if path is protected (requires auth)
  const isProtectedRoute = matchesPath(pathname, protectedRoutes) && !isPublicRoute

  // Handle auth routes - redirect to dashboard if already authenticated
  if (isAuthRoute && sessionToken) {
    const response = NextResponse.redirect(new URL("/dashboard", request.url))
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
