const $ = s => document.querySelector(s)
const el = (t, c, h) => { const e = document.createElement(t); if (c) e.className = c; if (h != null) e.innerHTML = h; return e }
const esc = s => s.replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]))

let DB
const S = { cmd: null, v: [], tier: "", mega: false, alt: false, text: "" }

// the params that are active right now (the alt list is used when e.g. /effect clear is picked)
const params = () => (S.alt && S.cmd.alt ? S.cmd.alt.struct : S.cmd.struct)
const item = x => (typeof x == "string" ? { value: x } : x)
const norm = l => (l && l.length && !l[0].groupName ? [{ groupName: "", optionsList: l }] : l)

// turns a param into a list of groups: [{groupName, optionsList, subGroups?}]
function groups(p) {
    const o = DB.options
    if (p.type == "map") {
        return o[p.optionName][S.mega ? "mega" : "small"].map(g => ({
            groupName: g.groupName,
            optionsList: g.optionsList.map(k => ({ value: `${g.groupName}.${k}`, label: k }))
        }))
    }
    const l = p.choices || o[p.optionName]
    if (!l) return null
    if (p.dependsOn != null) {
        const m = S.v[p.dependsOn].trim()
        const x = Object.hasOwn(l, m) ? { [m]: l[m] } : l
        return Object.entries(x).map(([k, v]) => ({ groupName: k + " sub elements", optionsList: v }))
    }
    return norm(l)
}

/* ---------- command list ---------- */
function renderCmds() {
    const q = $("#q").value.trim().toLowerCase().replace(/^\//, ""), box = $("#cmds")
    box.innerHTML = ""
    const list = DB.commands.filter(c => q ? (c.name.includes(q) || c.desc.toLowerCase().includes(q)) : c.tier == S.tier)
    list.forEach(c => {
        const b = el("button", "cmd" + (c === S.cmd ? " on" : ""), `<b>/${c.name}${c.secret ? "<em>secret</em>" : ""}</b><span>${c.desc}</span>`)
        b.onclick = () => pick(c)
        box.append(b)
    })
    if (!list.length) box.append(el("p", "hint", "No commands match. Try another word."))
    const t = $("#tabs")
    t.innerHTML = ""
    DB.tiers.forEach(({ id, name }) => {
        const b = el("button", !q && id == S.tier ? "on" : "", name)
        b.onclick = () => { S.tier = id; $("#q").value = ""; renderCmds() }
        t.append(b)
    })
}

function pick(c) {
    S.cmd = c; S.v = c.struct.map(() => ""); S.alt = false
    draw(); renderCmds()
    if (innerWidth <= 820) $("#panel").scrollIntoView({ behavior: "smooth" })
}

/* ---------- builder panel ---------- */
function draw() {
    const c = S.cmd, m = $("#panel")
    m.innerHTML = `<h2>/${c.name}</h2><p class="d">${c.desc}</p>`
        + (c.secret ? `<p class="hint">Secret command. It is not listed in /cmds.</p>` : "")
        + `<div id="fs"></div>`
    fields(0)
    if (!params().length) m.append(el("p", "hint", "This command has no options. Just copy it."))
    build()
}

function fields(from) {
    const fs = $("#fs")
    while (fs.children.length > from) fs.lastChild.remove()
    params().forEach((p, i) => { if (i >= from) fs.append(field(p, i)) })
}

// when a field changes, redraw the fields that depend on it
function sync(i) {
    const c = S.cmd, w = c.alt && c.alt.when
    const swap = w && w.index === i
    if (!swap && !params().some(p => p.dependsOn === i)) return
    if (swap) {
        const n = S.v[i].trim() == w.value
        if (n != S.alt) { S.alt = n; for (let k = 2; k < S.v.length; k++) S.v[k] = "" }
    }
    params().forEach((p, k) => { if (p.dependsOn === i) S.v[k] = "" })
    fields(i + 1)
}

function field(p, i) {
    const f = el("div", "f"), gs = groups(p)
    f.append(el("label", "", p.name + (p.optional ? "<small>optional</small>" : "")))
    if (p.type == "map") {
        const sg = el("div", "tabs s")
        ;["Small server", "Mega server (49)"].forEach((t, k) => {
            const b = el("button", !!k == S.mega ? "on" : "", t)
            b.onclick = () => { S.mega = !!k; S.v[i] = ""; draw() }
            sg.append(b)
        })
        f.append(sg)
    }
    const inp = el("input")
    inp.type = p.type == "number" ? "number" : "text"
    inp.autocomplete = "off"; inp.spellcheck = false
    inp.placeholder = (gs ? "Search or type " : "Type ") + p.name
    inp.value = S.v[i] || ""
    if (p.type == "number") {
        if (p.min != null) inp.min = p.min
        if (p.max != null) inp.max = p.max
        inp.step = p.step || 1
    }
    f.append(inp)
    let box
    if (gs) { box = el("div", "chips"); f.append(box) }
    const hint = p.hint || (DB.hints || {})[p.optionName]
    if (hint) f.append(el("p", "hint", hint))

    const paint = () => {
        if (!box) return
        const q = inp.value.trim().toLowerCase()
        const all = g => [...g.optionsList, ...(g.subGroups || []).flatMap(all)]
        const exact = gs.some(g => all(g).some(x => item(x).value.toLowerCase() == q))
        const ok = x => exact || !q || (item(x).value + " " + (item(x).label || "")).toLowerCase().includes(q)
        const part = (g, host) => {
            const its = g.optionsList.filter(ok)
            if (!its.length) return false
            if (g.groupName) host.append(el("h4", "", g.groupName))
            const r = el("div", "row")
            its.forEach(x => {
                const { value: v, label: l } = item(x)
                const b = el("button", "chip" + (v == inp.value.trim() ? " on" : ""), l ? `${l}${v.includes(".") ? "" : `<i>${v}</i>`}` : v)
                b.type = "button"; b.title = v
                b.onclick = () => { inp.value = v; S.v[i] = v; paint(); sync(i); build() }
                r.append(b)
            })
            host.append(r)
            return true
        }
        box.innerHTML = ""
        gs.forEach(g => {
            const main = el("div"), has = part(g, main), subs = []
            ;(g.subGroups || []).forEach(s => { const d = el("div", "sub"); if (part(s, d)) subs.push(d) })
            if (!has && !subs.length) return
            if (!has && g.groupName) main.append(el("h4", "", g.groupName))
            box.append(main, ...subs)
        })
        if (!box.children.length) box.append(el("p", "hint", p.emptyText || "No matches. What you typed will be used as written."))
    }
    inp.oninput = () => { S.v[i] = inp.value; paint(); sync(i); build() }
    paint()
    return f
}

/* ---------- output + copy ---------- */
function build() {
    const c = S.cmd, ps = params(), v = S.v.map(x => x.trim())
    let last = -1
    ps.forEach((p, i) => { if (v[i] || !p.optional) last = i })
    const vals = [], html = []
    let ok = true
    for (let i = 0; i <= last; i++) {
        if (v[i]) { vals.push(v[i]); html.push(esc(v[i])) }
        else { ok = false; html.push(`<u>[${ps[i].name}]</u>`) }
    }
    S.text = ok ? ["/" + c.name, ...vals].join(" ") : ""
    $("#out").innerHTML = "/" + c.name + (html.length ? " " + html.join(" ") : "")
    $("#cp").disabled = !ok
}

let tt
function toast(m) {
    const t = $("#t")
    t.textContent = m; t.classList.add("on")
    clearTimeout(tt); tt = setTimeout(() => t.classList.remove("on"), 1800)
}

async function copy() {
    if (!S.text) return toast("Fill in the dashed fields first")
    try { await navigator.clipboard.writeText(S.text) }
    catch (e) {
        const a = el("textarea"); a.value = S.text
        document.body.append(a); a.select(); document.execCommand("copy"); a.remove()
    }
    toast("Copied " + S.text)
}

$("#cp").onclick = copy
$("#q").oninput = renderCmds

// Ctrl+C copies the command when nothing else is selected
addEventListener("keydown", e => {
    if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() != "c") return
    const a = document.activeElement
    const picked = getSelection().toString() || (a && a.selectionStart != null && a.selectionStart !== a.selectionEnd)
    if (!picked) { e.preventDefault(); copy() }
})

/* ---------- start ---------- */
fetch("src/storage.json")
    .then(r => r.json())
    .then(json => {
        DB = json
        const o = DB.options
        o.targetAll = [...o.targetPlayers, ...o.targetPlates]
        S.tier = DB.tiers[0].id
        $("#version").innerText = `v${DB.version}`
        pick(DB.commands.find(c => c.name == "event"))
    })
    .catch(err => {
        console.error(err)
        $("#panel").innerHTML = `<p class="hint">Could not load src/storage.json. Open the site through a web server (or Vercel) instead of double-clicking the file.</p>`
    })
