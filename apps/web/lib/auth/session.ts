/**
 * Session management utilities
 * Uses HTTP-only cookies for secure session storage
 */

import { cookies } from "next/headers"
import { SignJWT, jwtVerify } from "jose"
import { createHash } from "crypto"

const SESSION_COOKIE_NAME = "idaraos_session"
const SESSION_DURATION = 60 * 60 * 24 * 7 // 7 days in seconds

// In production, use a proper secret from environment variables
const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "your-super-secret-key-change-in-production"
)

export interface SessionPayload {
  userId: string
  email: string
  name: string
  role: string
  orgId: string
  expiresAt: number
}

/**
 * Create a session token
 */
export async function createSessionToken(payload: Omit<SessionPayload, "expiresAt">): Promise<string> {
  const expiresAt = Date.now() + SESSION_DURATION * 1000
  
  const token = await new SignJWT({ ...payload, expiresAt })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(expiresAt / 1000)
    .setIssuedAt()
    .sign(JWT_SECRET)
  
  return token
}

/**
 * Verify and decode a session token
 */
export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET)
    return payload as unknown as SessionPayload
  } catch {
    return null
  }
}

/**
 * Get the cookie domain for cross-subdomain support
 * Returns .idaraos.com format for production (works on both root and app subdomain)
 */
function getCookieDomain(): string | undefined {
  const rootDomain = process.env.ROOT_DOMAIN
  if (rootDomain && process.env.NODE_ENV === "production") {
    return `.${rootDomain}`
  }
  return undefined
}

/**
 * Set the session cookie
 */
export async function setSessionCookie(token: string): Promise<void> {
  const cookieStore = await cookies()
  const domain = getCookieDomain()
  
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_DURATION,
    path: "/",
    ...(domain && { domain }),
  })
}

/**
 * Get the current session from cookies
 */
export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value
  
  if (!token) {
    return null
  }
  
  return verifySessionToken(token)
}

/**
 * Clear the session cookie
 */
export async function clearSession(): Promise<void> {
  const cookieStore = await cookies()
  const domain = getCookieDomain()
  
  // Delete with domain if set (for cross-subdomain support)
  if (domain) {
    cookieStore.set(SESSION_COOKIE_NAME, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 0, // Expire immediately
      path: "/",
      domain,
    })
  } else {
    cookieStore.delete(SESSION_COOKIE_NAME)
  }
}

/**
 * Simple password hashing (for demo purposes)
 * In production, use bcrypt or argon2
 */
export function hashPassword(password: string): string {
  // Simple hash for demo - in production use bcrypt
  return createHash("sha256").update(password).digest("hex")
}

/**
 * Verify password against hash
 */
export function verifyPassword(password: string, hash: string): boolean {
  return hashPassword(password) === hash
}

/**
 * Get the current user from session
 * Returns a minimal user object with id, email, name, and orgId
 * 
 * @returns User object with id, email, name, and orgId, or null if no session exists
 */
export async function getSessionUser(): Promise<{ id: string; email: string; name: string; orgId: string } | null> {
  const session = await getSession()
  
  if (!session) {
    return null
  }
  
  return {
    id: session.userId,
    email: session.email,
    name: session.name,
    orgId: session.orgId,
  }
}

