// IdaraOS Vault — content script. Detects a login form, offers autofill from matching vault items,
// and offers to save a new login on submit. Heuristic and best-effort.

;(function () {
  function findFields() {
    const pw = Array.from(document.querySelectorAll('input[type="password"]')).find((i) => i.offsetParent !== null)
    if (!pw) return null
    const scope = pw.form || document
    const inputs = Array.from(scope.querySelectorAll("input"))
    const pwIdx = inputs.indexOf(pw)
    let user = null
    for (let i = pwIdx - 1; i >= 0; i--) {
      const t = (inputs[i].type || "text").toLowerCase()
      if (["text", "email", "tel"].includes(t) && inputs[i].offsetParent !== null) {
        user = inputs[i]
        break
      }
    }
    if (!user) {
      user = scope.querySelector(
        'input[type="email"], input[autocomplete="username"], input[name*="user" i], input[name*="email" i], input[id*="user" i], input[id*="email" i]'
      )
    }
    return { user, pw }
  }

  function setVal(el, val) {
    if (!el) return
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set
    setter.call(el, val)
    el.dispatchEvent(new Event("input", { bubbles: true }))
    el.dispatchEvent(new Event("change", { bubbles: true }))
  }

  function fill(login) {
    const f = findFields()
    if (!f) return
    setVal(f.user, login.username || "")
    setVal(f.pw, login.password || "")
  }

  // Let the popup trigger a fill on the active tab
  chrome.runtime.onMessage.addListener((msg, _s, resp) => {
    if (msg.type === "fill") {
      fill(msg.login)
      resp({ ok: true })
    }
  })

  const fields = findFields()
  if (fields && fields.user) {
    chrome.runtime.sendMessage({ type: "match", url: location.href }, (res) => {
      if (chrome.runtime.lastError) return
      if (res && res.ok && res.logins && res.logins.length) addAutofillButton(res.logins)
    })
  }

  function addAutofillButton(logins) {
    const f = findFields()
    if (!f || !f.user) return
    const btn = document.createElement("button")
    btn.textContent = "🔐 IdaraOS"
    btn.type = "button"
    Object.assign(btn.style, {
      position: "absolute",
      zIndex: 2147483647,
      fontSize: "11px",
      padding: "2px 6px",
      background: "#111827",
      color: "#fff",
      border: "none",
      borderRadius: "4px",
      cursor: "pointer",
      boxShadow: "0 1px 4px rgba(0,0,0,.3)",
    })
    const r = f.user.getBoundingClientRect()
    btn.style.top = window.scrollY + r.top + 2 + "px"
    btn.style.left = window.scrollX + r.right - 72 + "px"
    btn.addEventListener("click", (e) => {
      e.preventDefault()
      fill(logins[0])
      btn.remove()
    })
    document.body.appendChild(btn)
    setTimeout(() => btn.remove(), 15000)
  }

  document.addEventListener(
    "submit",
    () => {
      const f = findFields()
      if (!f || !f.pw || !f.pw.value) return
      const login = {
        title: location.hostname.replace(/^www\./, ""),
        url: location.origin,
        username: f.user ? f.user.value : "",
        password: f.pw.value,
      }
      chrome.runtime.sendMessage({ type: "match", url: location.href }, (res) => {
        if (chrome.runtime.lastError) return
        const existing = res && res.ok && res.logins && res.logins.some((l) => (l.username || "") === login.username)
        if (!existing) promptSave(login)
      })
    },
    true
  )

  function promptSave(login) {
    const bar = document.createElement("div")
    Object.assign(bar.style, {
      position: "fixed",
      bottom: "16px",
      right: "16px",
      zIndex: 2147483647,
      background: "#111827",
      color: "#fff",
      padding: "10px 12px",
      borderRadius: "8px",
      font: "13px system-ui, sans-serif",
      boxShadow: "0 2px 12px rgba(0,0,0,.35)",
    })
    const label = document.createElement("span")
    label.textContent = "Save this login to IdaraOS Vault?"
    const yes = document.createElement("button")
    yes.textContent = "Save"
    const no = document.createElement("button")
    no.textContent = "Dismiss"
    for (const b of [yes, no]) Object.assign(b.style, { marginLeft: "8px", cursor: "pointer", padding: "2px 8px", borderRadius: "4px", border: "none" })
    yes.style.background = "#22c55e"
    bar.append(label, yes, no)
    document.body.appendChild(bar)
    yes.onclick = () => {
      chrome.runtime.sendMessage({ type: "save", login }, () => {})
      bar.remove()
    }
    no.onclick = () => bar.remove()
    setTimeout(() => bar.remove(), 12000)
  }
})()
