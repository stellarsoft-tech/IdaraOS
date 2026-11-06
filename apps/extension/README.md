# IdaraOS Vault browser extension

A Manifest V3 extension (Chrome/Edge) that autofills logins from your IdaraOS Vault and offers to save
new ones. It's plain JavaScript — no build step.

## How it authenticates

The IdaraOS session cookie is HTTP-only and `SameSite=Lax`, so it isn't sent from an extension's
cross-site `fetch`. Instead the extension uses a **per-user vault token**:

1. In IdaraOS go to **Security → Vault → Browser extension** and generate a token (shown once).
2. Open the extension popup, expand **Settings**, enter your IdaraOS **server URL** (e.g.
   `https://idaraos.com`) and the **token**, then **Save & sync**.

The token is scoped to that one user's vault and can be revoked at any time from the same screen.

## What it does

- **Autofill:** on a page with a login form, it matches the site against your vault (by hostname) and
  shows a small **🔐 IdaraOS** button by the username field; click it (or **Fill** in the popup) to fill.
- **Save:** when you submit a login that isn't already saved, it offers to save it to your vault.
- The background service worker holds decrypted logins **in memory only** (never persisted to disk);
  they clear when the worker suspends and re-sync on demand.

## Endpoints used

- `GET  /api/vault-ext/items` — the user's logins (decrypted) for autofill
- `POST /api/vault-ext/items` — save a new login

Both are token-authed (`Authorization: Bearer <vext token>`), CORS-open, and carry no cookies.

## Install (unpacked, for testing)

1. Chrome/Edge → `chrome://extensions` → enable **Developer mode**.
2. **Load unpacked** → select this `apps/extension` folder.
3. Configure the server URL + token in the popup.

## Deploy to the fleet (self-hosted, via the IdaraOS agent)

No web store and no Intune — the agent force-installs it. Browsers only force-install a **signed,
ID-stable** package by its **update URL**, so you pack it once and IdaraOS serves it:

1. **Pack it** (one-time; needs the signing key at `.keys/signing.key`, generated already):
   ```
   cd apps/extension && npm i crx3 && node pack.mjs
   ```
   This produces `apps/extension/dist/idaraos-vault.crx` (extension id `fjlcilgleihnoonfmbofcfidpimedbof`,
   baked into the manifest `key`).
2. **Place the `.crx`** where IdaraOS serves it: copy it to `deployment/extension/idaraos-vault.crx`
   (so it ships in the prod image), or set `VAULT_EXTENSION_CRX_PATH` to its location. IdaraOS then serves
   it at `/api/updater/v1/extension/idaraos-vault.crx` with an update manifest at
   `/api/updater/v1/extension/update.xml`.
3. **Turn on the policy:** Security → Software Updates → Groups & policies → enable **Deploy Vault browser
   extension** (pick Chrome and/or Edge) for the groups/devices you want. The agent (1.11.0+) writes the
   browser's `ExtensionInstallForcelist` pointing at IdaraOS. Turning the policy off removes it.

The signing key is private — keep `apps/extension/.keys/signing.key` out of git (it is `.gitignore`d) and
back it up (e.g. Key Vault). Re-packing with a different key changes the extension id.

## Caveats

- Form detection is heuristic (best-effort); unusual or multi-step login flows may not be detected.
- This is not zero-knowledge — the server returns decrypted logins to an authenticated token, matching
  the vault's server-side-encryption model.
- Packaging/signing for the Chrome Web Store / Edge Add-ons is a separate step.
