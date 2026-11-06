/**
 * Vault browser-extension support (Phase 5)
 *
 * The extension authenticates with a per-user token (the SSO session cookie isn't sent from an
 * extension's cross-site fetch). Only the token's SHA-256 hash is stored. Token-authed endpoints let
 * the extension sync the user's logins (decrypted, for autofill) and save new ones.
 */

import { and, desc, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { vaultExtensionTokens, vaultItems } from "@/lib/db/schema"
import { decryptOptional } from "@/lib/vault/crypto-server"
import { generateSecret, hashSecret } from "./software-updates-server"
import { importVaultItems } from "./vault-server"

export interface ExtensionTokenView {
  id: string
  name: string
  lastUsedAt: string | null
  createdAt: string
}

export async function listExtensionTokens(orgId: string, userId: string): Promise<ExtensionTokenView[]> {
  const rows = await db
    .select()
    .from(vaultExtensionTokens)
    .where(and(eq(vaultExtensionTokens.orgId, orgId), eq(vaultExtensionTokens.userId, userId)))
    .orderBy(desc(vaultExtensionTokens.createdAt))
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    lastUsedAt: r.lastUsedAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
  }))
}

/** Create a token. The plaintext is returned ONCE (only its hash is stored). */
export async function generateExtensionToken(
  orgId: string,
  userId: string,
  name: string
): Promise<{ id: string; name: string; token: string; createdAt: string }> {
  const token = generateSecret("vext")
  const [row] = await db
    .insert(vaultExtensionTokens)
    .values({ orgId, userId, name: name.trim() || "Browser extension", tokenHash: hashSecret(token) })
    .returning()
  return { id: row.id, name: row.name, token, createdAt: row.createdAt.toISOString() }
}

export async function revokeExtensionToken(orgId: string, userId: string, id: string): Promise<boolean> {
  const rows = await db
    .delete(vaultExtensionTokens)
    .where(and(eq(vaultExtensionTokens.id, id), eq(vaultExtensionTokens.orgId, orgId), eq(vaultExtensionTokens.userId, userId)))
    .returning({ id: vaultExtensionTokens.id })
  return rows.length > 0
}

/** Authenticate a `Authorization: Bearer <token>` header. Returns the owning org/user, or null. */
export async function authenticateExtensionToken(authHeader: string | null): Promise<{ orgId: string; userId: string } | null> {
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null
  const token = authHeader.slice(7).trim()
  if (!token) return null
  const [row] = await db
    .select()
    .from(vaultExtensionTokens)
    .where(eq(vaultExtensionTokens.tokenHash, hashSecret(token)))
    .limit(1)
  if (!row) return null
  await db.update(vaultExtensionTokens).set({ lastUsedAt: new Date() }).where(eq(vaultExtensionTokens.id, row.id))
  return { orgId: row.orgId, userId: row.userId }
}

export interface ExtensionLogin {
  id: string
  title: string
  url: string | null
  username: string | null
  password: string
}

/** The user's login items with a password, decrypted, for autofill. */
export async function getLoginsForExtension(orgId: string, userId: string): Promise<ExtensionLogin[]> {
  const rows = await db
    .select()
    .from(vaultItems)
    .where(and(eq(vaultItems.orgId, orgId), eq(vaultItems.userId, userId), eq(vaultItems.type, "login")))
    .orderBy(vaultItems.title)
  return rows
    .filter((r) => r.passwordEncrypted)
    .map((r) => ({ id: r.id, title: r.title, url: r.url, username: r.username, password: decryptOptional(r.passwordEncrypted) ?? "" }))
}

export async function saveLoginFromExtension(
  orgId: string,
  userId: string,
  input: { title: string; url: string | null; username: string | null; password: string }
): Promise<{ imported: number }> {
  return importVaultItems(orgId, userId, [
    { title: input.title, url: input.url, username: input.username, password: input.password },
  ])
}
