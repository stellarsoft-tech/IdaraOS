/**
 * Password Vault schema - Drizzle ORM table definitions
 *
 * A built-in password manager. Each user has a personal vault of items (logins, secure notes, payment
 * cards, identities) organised into folders. Secrets (passwords, notes, card numbers) are stored
 * ENCRYPTED AT REST with AES-256-GCM (lib/vault/crypto-server.ts); non-secret metadata (title,
 * username, url) is stored in the clear so the vault can be listed and searched. Access is gated by the
 * IdaraOS session (SSO + 2FA) and RBAC (security.my-vault); the server decrypts on demand for the owner.
 *
 * This is NOT zero-knowledge - the server can decrypt - which is what enables org policy enforcement,
 * Security Audit, and admin recovery (see the module plan).
 */

import { pgTable, uuid, text, timestamp, boolean, index, type AnyPgColumn } from "drizzle-orm/pg-core"
import { relations } from "drizzle-orm"
import { organizations } from "./organizations"
import { users } from "./users"

// ============================================================================
// ENUMS
// ============================================================================

/** The kind of record a vault item holds. Phase 1 focuses on logins; the rest share the same storage. */
export const vaultItemTypeValues = ["login", "note", "card", "identity"] as const
export type VaultItemType = (typeof vaultItemTypeValues)[number]

// ============================================================================
// FOLDERS
// ============================================================================

export const vaultFolders = pgTable(
  "security_vault_folders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    // The owner of the folder (a personal vault folder)
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // Optional parent for nesting (self-reference; cascade so deleting a folder removes its subtree)
    parentFolderId: uuid("parent_folder_id").references((): AnyPgColumn => vaultFolders.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_security_vault_folders_org").on(table.orgId),
    index("idx_security_vault_folders_user").on(table.userId),
    index("idx_security_vault_folders_parent").on(table.parentFolderId),
  ]
)

// ============================================================================
// ITEMS
// ============================================================================

export const vaultItems = pgTable(
  "security_vault_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    folderId: uuid("folder_id").references(() => vaultFolders.id, { onDelete: "set null" }),
    type: text("type", { enum: vaultItemTypeValues }).notNull().default("login"),
    // Non-secret, searchable metadata
    title: text("title").notNull(),
    username: text("username"),
    url: text("url"),
    favorite: boolean("favorite").notNull().default(false),
    // Secret fields, AES-256-GCM encrypted at rest (null when absent)
    passwordEncrypted: text("password_encrypted"),
    notesEncrypted: text("notes_encrypted"),
    // Type-specific secret fields (card number/cvv, identity fields, custom fields) as an encrypted JSON blob
    extraEncrypted: text("extra_encrypted"),
    // When the password last changed (for the max-age policy / audit); null for non-login items
    lastPasswordChangeAt: timestamp("last_password_change_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_security_vault_items_org").on(table.orgId),
    index("idx_security_vault_items_user").on(table.userId),
    index("idx_security_vault_items_folder").on(table.folderId),
  ]
)

// ============================================================================
// PASSWORD HISTORY
// ============================================================================

/** Previous passwords for an item, so a user can see/restore an earlier value and track when it changed. */
export const vaultItemHistory = pgTable(
  "security_vault_item_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    itemId: uuid("item_id")
      .notNull()
      .references(() => vaultItems.id, { onDelete: "cascade" }),
    passwordEncrypted: text("password_encrypted").notNull(),
    changedById: uuid("changed_by_id").references(() => users.id, { onDelete: "set null" }),
    changedAt: timestamp("changed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_security_vault_item_history_item").on(table.itemId),
    index("idx_security_vault_item_history_org").on(table.orgId),
  ]
)

// ============================================================================
// RELATIONS
// ============================================================================

export const vaultFoldersRelations = relations(vaultFolders, ({ one, many }) => ({
  parent: one(vaultFolders, {
    fields: [vaultFolders.parentFolderId],
    references: [vaultFolders.id],
    relationName: "vault_folder_parent",
  }),
  children: many(vaultFolders, { relationName: "vault_folder_parent" }),
  items: many(vaultItems),
}))

export const vaultItemsRelations = relations(vaultItems, ({ one, many }) => ({
  folder: one(vaultFolders, { fields: [vaultItems.folderId], references: [vaultFolders.id] }),
  history: many(vaultItemHistory),
}))

export const vaultItemHistoryRelations = relations(vaultItemHistory, ({ one }) => ({
  item: one(vaultItems, { fields: [vaultItemHistory.itemId], references: [vaultItems.id] }),
}))

// ============================================================================
// INFERRED TYPES
// ============================================================================

export type VaultFolder = typeof vaultFolders.$inferSelect
export type NewVaultFolder = typeof vaultFolders.$inferInsert
export type VaultItem = typeof vaultItems.$inferSelect
export type NewVaultItem = typeof vaultItems.$inferInsert
export type VaultItemHistoryRow = typeof vaultItemHistory.$inferSelect
export type NewVaultItemHistoryRow = typeof vaultItemHistory.$inferInsert
