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

import { pgTable, uuid, text, timestamp, boolean, integer, smallint, index, uniqueIndex, type AnyPgColumn } from "drizzle-orm/pg-core"
import { relations } from "drizzle-orm"
import { organizations } from "./organizations"
import { users } from "./users"

// ============================================================================
// ENUMS
// ============================================================================

/** The kind of record a vault item holds. Phase 1 focuses on logins; the rest share the same storage. */
export const vaultItemTypeValues = ["login", "note", "card", "identity"] as const
export type VaultItemType = (typeof vaultItemTypeValues)[number]

/**
 * How the org password policy is enforced (Phase 2 Security Audit):
 * - off:   policy is not applied; nothing is flagged or blocked
 * - warn:  violations are allowed but counted in the Security Audit
 * - block: a password that violates the policy is rejected when saving an item
 */
export const vaultEnforcementValues = ["off", "warn", "block"] as const
export type VaultEnforcement = (typeof vaultEnforcementValues)[number]

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
    // Non-secret derived values for the Security Audit (never decrypt to compute these):
    // keyed HMAC of the password (reuse detection) and a 0-4 strength score, set at save time.
    passwordFingerprint: text("password_fingerprint"),
    passwordStrength: smallint("password_strength"),
    // TOTP/2FA secret (base32 or an otpauth:// URI), encrypted at rest. Live codes are derived from it.
    totpEncrypted: text("totp_encrypted"),
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
// ORG POLICY SETTINGS (Phase 2)
// ============================================================================

/** One row per organisation: the vault password policy the Security Audit enforces/reports against. */
export const vaultSettings = pgTable(
  "security_vault_settings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    minLength: integer("min_length").notNull().default(12),
    requireUpper: boolean("require_upper").notNull().default(true),
    requireLower: boolean("require_lower").notNull().default(true),
    requireDigit: boolean("require_digit").notNull().default(true),
    requireSymbol: boolean("require_symbol").notNull().default(false),
    // Every credential must be unique within the user's own vault
    noReuse: boolean("no_reuse").notNull().default(true),
    // Flag passwords older than this many days (0 = no limit)
    maxAgeDays: integer("max_age_days").notNull().default(0),
    enforcement: text("enforcement", { enum: vaultEnforcementValues }).notNull().default("warn"),
    updatedById: uuid("updated_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("idx_security_vault_settings_org").on(table.orgId)]
)

// ============================================================================
// SHARING (Phase 3): groups + item/folder shares to members or groups
// ============================================================================

export const vaultSharePermissionValues = ["view", "edit"] as const
export type VaultSharePermission = (typeof vaultSharePermissionValues)[number]

export const vaultShareStatusValues = ["active", "revoked"] as const
export type VaultShareStatus = (typeof vaultShareStatusValues)[number]

/** A reusable sharing group (a named set of members), managed by an admin. */
export const vaultGroups = pgTable(
  "security_vault_groups",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    createdById: uuid("created_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("idx_security_vault_groups_org").on(table.orgId)]
)

export const vaultGroupMembers = pgTable(
  "security_vault_group_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    groupId: uuid("group_id")
      .notNull()
      .references(() => vaultGroups.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_security_vault_group_members_unique").on(table.groupId, table.userId),
    index("idx_security_vault_group_members_user").on(table.userId),
  ]
)

/**
 * A share of one item OR one folder (exactly one set) to one member OR one group (exactly one set),
 * created by the item's owner. Because decryption is server-side, a share is just an ACL - no key
 * wrapping. Optional expiresAt gives time-boxed access; status "revoked" ends it early.
 */
export const vaultShares = pgTable(
  "security_vault_shares",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    itemId: uuid("item_id").references(() => vaultItems.id, { onDelete: "cascade" }),
    folderId: uuid("folder_id").references(() => vaultFolders.id, { onDelete: "cascade" }),
    targetUserId: uuid("target_user_id").references(() => users.id, { onDelete: "cascade" }),
    targetGroupId: uuid("target_group_id").references(() => vaultGroups.id, { onDelete: "cascade" }),
    permission: text("permission", { enum: vaultSharePermissionValues }).notNull().default("view"),
    sharedById: uuid("shared_by_id").references(() => users.id, { onDelete: "set null" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    status: text("status", { enum: vaultShareStatusValues }).notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_security_vault_shares_org").on(table.orgId),
    index("idx_security_vault_shares_item").on(table.itemId),
    index("idx_security_vault_shares_folder").on(table.folderId),
    index("idx_security_vault_shares_target_user").on(table.targetUserId),
    index("idx_security_vault_shares_target_group").on(table.targetGroupId),
  ]
)

// ============================================================================
// ATTACHMENTS (Phase 4): encrypted files attached to an item
// ============================================================================

export const vaultAttachments = pgTable(
  "security_vault_attachments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    itemId: uuid("item_id")
      .notNull()
      .references(() => vaultItems.id, { onDelete: "cascade" }),
    filename: text("filename").notNull(),
    contentType: text("content_type"),
    sizeBytes: integer("size_bytes").notNull(),
    // base64 of (iv + authTag + AES-256-GCM ciphertext) of the file bytes
    dataEncrypted: text("data_encrypted").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("idx_security_vault_attachments_item").on(table.itemId)]
)

// ============================================================================
// INFERRED TYPES
// ============================================================================

export type VaultSettings = typeof vaultSettings.$inferSelect
export type NewVaultSettings = typeof vaultSettings.$inferInsert
export type VaultGroup = typeof vaultGroups.$inferSelect
export type VaultGroupMember = typeof vaultGroupMembers.$inferSelect
export type VaultShare = typeof vaultShares.$inferSelect
export type NewVaultShare = typeof vaultShares.$inferInsert
export type VaultAttachment = typeof vaultAttachments.$inferSelect
export type NewVaultAttachment = typeof vaultAttachments.$inferInsert

// ============================================================================
// EXTENSION TOKENS (Phase 5)
// ============================================================================

export const vaultExtensionTokens = pgTable(
  "security_vault_extension_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    tokenHash: text("token_hash").notNull(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_security_vault_extension_tokens_hash").on(table.tokenHash),
    index("idx_security_vault_extension_tokens_user").on(table.userId),
  ]
)

export type VaultExtensionToken = typeof vaultExtensionTokens.$inferSelect

export type VaultFolder = typeof vaultFolders.$inferSelect
export type NewVaultFolder = typeof vaultFolders.$inferInsert
export type VaultItem = typeof vaultItems.$inferSelect
export type NewVaultItem = typeof vaultItems.$inferInsert
export type VaultItemHistoryRow = typeof vaultItemHistory.$inferSelect
export type NewVaultItemHistoryRow = typeof vaultItemHistory.$inferInsert
