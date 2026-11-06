// Pack the IdaraOS Vault extension into a signed CRX3 (+ update.xml) for self-hosted force-install.
//
// One-time tooling — run from the repo root:
//   cd apps/extension && npm i crx3 && node pack.mjs
//
// It signs with the key at apps/extension/.keys/signing.key (generated once, NEVER committed) and writes
// apps/extension/dist/idaraos-vault.crx. Place that .crx where IdaraOS serves it (AGENT/EXTENSION path or
// the prod image); IdaraOS generates the matching update.xml dynamically. The crxURL/updateURL below only
// matter if you use the crx3-generated dist/update.xml directly instead of IdaraOS's.

import crx3 from "crx3"
import path from "node:path"
import { fileURLToPath } from "node:url"

const dir = path.dirname(fileURLToPath(import.meta.url))
const base = process.env.VAULT_EXT_BASE_URL || "https://app.idaraos.com"

await crx3([path.join(dir, "manifest.json")], {
  keyPath: path.join(dir, ".keys", "signing.key"),
  crxPath: path.join(dir, "dist", "idaraos-vault.crx"),
  xmlPath: path.join(dir, "dist", "update.xml"),
  crxURL: `${base}/api/updater/v1/extension/idaraos-vault.crx`,
})

console.log("Packed → apps/extension/dist/idaraos-vault.crx (+ update.xml)")
console.log("Extension ID: fjlcilgleihnoonfmbofcfidpimedbof")
