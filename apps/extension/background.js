// IdaraOS Vault — background service worker.
// Holds the in-memory login cache and talks to the token-authed /api/vault-ext endpoints. The actual
// secrets live only in memory here (cleared when the worker is suspended) and are never persisted.

let cache = { logins: [], syncedAt: 0 }

async function getConfig() {
  return chrome.storage.local.get(["serverUrl", "token"])
}

async function apiFetch(path, options = {}) {
  const { serverUrl, token } = await getConfig()
  if (!serverUrl || !token) throw new Error("Not configured — open the extension and set your server URL + token.")
  const headers = { Authorization: "Bearer " + token, ...(options.headers || {}) }
  if (options.body) headers["Content-Type"] = "application/json"
  const res = await fetch(serverUrl.replace(/\/+$/, "") + path, { ...options, headers })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || "HTTP " + res.status)
  }
  return res.json()
}

async function sync() {
  const { data } = await apiFetch("/api/vault-ext/items")
  cache = { logins: Array.isArray(data) ? data : [], syncedAt: Date.now() }
  return cache
}

function hostOf(url) {
  try {
    return new URL(url.startsWith("http") ? url : "https://" + url).hostname.replace(/^www\./, "")
  } catch {
    return ""
  }
}

function matchLogins(pageUrl) {
  const host = hostOf(pageUrl)
  if (!host) return []
  return cache.logins.filter((l) => {
    const h = hostOf(l.url || "")
    return h && (h === host || host.endsWith("." + h) || h.endsWith("." + host))
  })
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  ;(async () => {
    try {
      if (msg.type === "status") {
        const cfg = await getConfig()
        sendResponse({ ok: true, configured: !!(cfg.serverUrl && cfg.token), count: cache.logins.length, syncedAt: cache.syncedAt })
      } else if (msg.type === "sync") {
        await sync()
        sendResponse({ ok: true, count: cache.logins.length, syncedAt: cache.syncedAt })
      } else if (msg.type === "logins") {
        if (!cache.syncedAt) await sync()
        sendResponse({ ok: true, logins: cache.logins })
      } else if (msg.type === "match") {
        if (!cache.syncedAt) await sync()
        sendResponse({ ok: true, logins: matchLogins(msg.url) })
      } else if (msg.type === "save") {
        await apiFetch("/api/vault-ext/items", { method: "POST", body: JSON.stringify(msg.login) })
        await sync()
        sendResponse({ ok: true })
      } else {
        sendResponse({ ok: false, error: "unknown message" })
      }
    } catch (e) {
      sendResponse({ ok: false, error: e.message })
    }
  })()
  return true // keep the channel open for the async response
})
