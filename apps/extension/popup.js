const $ = (id) => document.getElementById(id)

function send(msg) {
  return new Promise((resolve) => chrome.runtime.sendMessage(msg, resolve))
}

async function currentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  return tab
}

function escapeHtml(s) {
  return (s || "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c])
}

async function refreshStatus() {
  const s = await send({ type: "status" })
  if (!s || !s.configured) {
    $("status").textContent = "Not configured — add your server URL and token below."
    $("settings").open = true
    return
  }
  const when = s.syncedAt ? new Date(s.syncedAt).toLocaleTimeString() : "never"
  $("status").textContent = `${s.count} logins · synced ${when}`
}

async function showMatches() {
  const tab = await currentTab()
  const box = $("matches")
  box.innerHTML = ""
  if (!tab || !tab.url) return
  const res = await send({ type: "match", url: tab.url })
  if (!res || !res.ok) {
    box.innerHTML = `<div class="muted">${escapeHtml(res && res.error ? res.error : "Configure below first.")}</div>`
    return
  }
  if (!res.logins.length) {
    box.innerHTML = `<div class="muted">No saved logins for this site.</div>`
    return
  }
  for (const l of res.logins) {
    const row = document.createElement("div")
    row.className = "item"
    const t = document.createElement("div")
    t.className = "t"
    t.innerHTML = `<div>${escapeHtml(l.title)}</div><div class="muted">${escapeHtml(l.username || "")}</div>`
    const fill = document.createElement("button")
    fill.textContent = "Fill"
    fill.onclick = async () => {
      const tab = await currentTab()
      chrome.tabs.sendMessage(tab.id, { type: "fill", login: l })
      window.close()
    }
    row.append(t, fill)
    box.appendChild(row)
  }
}

async function init() {
  const cfg = await chrome.storage.local.get(["serverUrl", "token"])
  if (cfg.serverUrl) $("serverUrl").value = cfg.serverUrl
  if (cfg.token) $("token").value = cfg.token

  $("save").onclick = async () => {
    await chrome.storage.local.set({ serverUrl: $("serverUrl").value.trim(), token: $("token").value.trim() })
    const r = await send({ type: "sync" })
    if (!r.ok) $("status").textContent = r.error
    else $("settings").open = false
    await refreshStatus()
    await showMatches()
  }
  $("sync").onclick = async () => {
    const r = await send({ type: "sync" })
    if (!r.ok) $("status").textContent = r.error
    await refreshStatus()
    await showMatches()
  }

  await refreshStatus()
  await showMatches()
}

init()
