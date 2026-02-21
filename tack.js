// Tack — Click. Comment. Feed to AI.
// https://gettack.dev | MIT License
;(function () {
  var D = document, W = window, notes = [], active = false
  var host, shadow, style, path = location.pathname

  function save () { try { localStorage.setItem('tack_notes', JSON.stringify(notes)) } catch (e) {}; updBar() }
  function load () { try { return JSON.parse(localStorage.getItem('tack_notes')) || [] } catch (e) { return [] } }
  function here () { return notes.filter(n => n.path === path) }

  // --- Element identification ---
  function sel (el) {
    if (el.id) return '#' + CSS.escape(el.id)
    var parts = []
    while (el && el.parentElement && el !== D.body) {
      var p = el.parentElement, tag = el.tagName.toLowerCase()
      var sibs = [...p.children].filter(c => c.tagName === el.tagName)
      parts.unshift(sibs.length > 1 ? tag + ':nth-of-type(' + (sibs.indexOf(el) + 1) + ')' : tag)
      el = p
    }
    return parts.join(' > ')
  }
  function heading (el) {
    for (var n = el; n && n !== D.body; n = n.parentElement)
      for (var s = n.previousElementSibling; s; s = s.previousElementSibling)
        if (/^H[1-6]$/.test(s.tagName)) return s.textContent.trim().slice(0, 80)
    return ''
  }
  function txt (el) {
    var t = (el.textContent || '').replace(/\s+/g, ' ').trim()
    return t.length > 120 ? t.slice(0, 120) + '...' : t
  }

  // --- Shadow DOM UI ---
  function buildBar () {
    host = D.createElement('div'); host.id = 'tack-host'
    shadow = host.attachShadow({ mode: 'closed' })
    shadow.innerHTML = `<style>
:host{all:initial;position:fixed;top:0;left:0;width:100%;z-index:2147483647;pointer-events:none;font-family:system-ui,sans-serif}
.b{pointer-events:auto;display:flex;align-items:center;gap:10px;height:36px;padding:0 14px;background:rgba(15,23,42,.92);backdrop-filter:blur(8px);color:#e2e8f0;font-size:13px;border-bottom:1px solid rgba(255,255,255,.06)}
.b b{color:#f59e0b} .b .s{flex:1}
.b button{pointer-events:auto;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.08);color:#cbd5e1;padding:3px 10px;border-radius:4px;cursor:pointer;font:inherit;font-size:12px}
.b button:hover{background:rgba(255,255,255,.15)}
.p{pointer-events:auto;position:fixed;width:300px;padding:10px;background:#1e293b;border:1px solid #334155;border-radius:8px;box-shadow:0 8px 32px rgba(0,0,0,.4);z-index:2147483647}
.p textarea{width:100%;height:64px;background:#0f172a;color:#e2e8f0;border:1px solid #334155;border-radius:4px;padding:8px;font:13px/1.4 system-ui;resize:vertical}
.p textarea:focus{outline:2px solid #3b82f6;border-color:transparent}
.g{display:flex;gap:6px;margin-top:8px;justify-content:flex-end} .g .f{flex:1}
.g button{border:0;padding:4px 12px;border-radius:4px;cursor:pointer;font:12px system-ui;color:#fff}
.sv{background:#2563eb} .cn{background:#475569} .dl{background:#dc2626}
.t{pointer-events:auto;position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#1e293b;color:#e2e8f0;padding:8px 16px;border-radius:6px;font-size:13px;box-shadow:0 4px 16px rgba(0,0,0,.3)}
.t a{color:#60a5fa;margin-left:6px;cursor:pointer}</style>
<div class="b"><b>📌 Tack</b><span class="c"></span><span class="s"></span></div>`
    var bar = shadow.querySelector('.b')
    ;[['Copy for AI', expCopy], ['↓ .md', expFile], ['Clear', clearAll], ['✕', off]].forEach(([l, fn]) => {
      var b = D.createElement('button'); b.textContent = l; b.onclick = fn; bar.appendChild(b)
    })
    D.body.appendChild(host); updBar()
  }

  function updBar () {
    var c = shadow && shadow.querySelector('.c'); if (!c) return
    var h = here().length, pg = new Set(notes.map(n => n.path)).size
    c.textContent = pg > 1 ? h + ' here · ' + notes.length + ' total · ' + pg + ' pages' : h + ' note' + (h !== 1 ? 's' : '')
  }

  function popup (rect, val, onSave, onDel) {
    closePop()
    var p = D.createElement('div'); p.className = 'p'
    p.style.cssText = `top:${Math.min(rect.bottom + 8, W.innerHeight - 200)}px;left:${Math.max(8, Math.min(rect.left, W.innerWidth - 330))}px`
    var ta = D.createElement('textarea'); ta.placeholder = 'What should change?'; ta.value = val || ''
    var g = D.createElement('div'); g.className = 'g'
    g.innerHTML = (onDel ? '<button class="dl">Delete</button><span class="f"></span>' : '') +
      '<button class="cn">Cancel</button><button class="sv">Save ⌘↵</button>'
    p.append(ta, g); shadow.appendChild(p); ta.focus()
    if (val) ta.setSelectionRange(val.length, val.length)
    if (onDel) g.querySelector('.dl').onclick = () => { onDel(); closePop() }
    g.querySelector('.cn').onclick = closePop
    g.querySelector('.sv').onclick = () => { var t = ta.value.trim(); if (t) { onSave(t); closePop() } }
    ta.onkeydown = e => { if (e.key === 'Escape') closePop(); if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') g.querySelector('.sv').click() }
  }
  function closePop () { var p = shadow && shadow.querySelector('.p'); if (p) p.remove() }

  function toast (msg, undo) {
    if (!shadow) return
    var old = shadow.querySelector('.t'); if (old) old.remove()
    var t = D.createElement('div'); t.className = 't'
    if (undo) { t.innerHTML = msg + '<a>Undo</a>'; t.querySelector('a').onclick = () => { undo(); t.remove() } }
    else t.textContent = msg
    shadow.appendChild(t); setTimeout(() => { if (t.parentNode) t.remove() }, 5000)
  }

  // --- Pins on page elements ---
  function addPin (el, note) {
    el.classList.add('tack-noted')
    if (getComputedStyle(el).position === 'static') el.style.position = 'relative'
    var old = el.querySelector('[data-tack="' + note.id + '"]'); if (old) old.remove()
    var pin = D.createElement('div'); pin.className = 'tack-pin'; pin.dataset.tack = note.id
    pin.title = note.note; pin.textContent = '📌'
    pin.onclick = e => { e.stopPropagation(); e.preventDefault()
      popup(pin.getBoundingClientRect(), note.note,
        t => { note.note = t; save(); pin.title = t },
        () => { notes = notes.filter(n => n.id !== note.id); save(); pin.remove(); el.classList.remove('tack-noted') })
    }
    el.appendChild(pin)
  }
  function restorePins () { here().forEach(n => { try { var el = D.querySelector(n.selector); if (el) addPin(el, n) } catch (e) {} }) }
  function clearPins () { D.querySelectorAll('.tack-noted').forEach(el => el.classList.remove('tack-noted')); D.querySelectorAll('.tack-pin').forEach(el => el.remove()) }

  // --- Click → new comment ---
  function onClick (e) {
    var el = e.target
    if ((el.closest && el.closest('#tack-host')) || (el.closest && el.closest('.tack-pin'))) return
    if (/^(HTML|BODY|SCRIPT|STYLE|LINK|META|HEAD)$/.test(el.tagName)) return
    e.preventDefault(); e.stopPropagation()
    popup(el.getBoundingClientRect(), '', text => {
      var id = notes.length ? Math.max(...notes.map(n => n.id)) + 1 : 1
      var note = { id, path, selector: sel(el), heading: heading(el), text: txt(el), note: text }
      notes.push(note); save(); addPin(el, note)
    })
  }

  // --- Export ---
  function md () {
    var grouped = {}, idx = 0
    notes.forEach(n => { (grouped[n.path] = grouped[n.path] || []).push(n) })
    var pgs = Object.keys(grouped), multi = pgs.length > 1
    var o = location.origin !== 'null' ? location.origin : ''
    var m = '# Tack: Page Review\nDate: ' + new Date().toISOString().slice(0, 10) + '\nNotes: ' + notes.length + '\n'
    pgs.forEach(p => {
      m += '\n---\n\n'
      if (multi) m += '### Page: ' + o + p + '\n\n'
      grouped[p].forEach(n => { idx++
        m += '## ' + idx + '.\n**Where:** section "' + n.heading + '" → `' + n.selector.split(' > ').pop() + '`\n'
        m += '**Element text:** "' + n.text + '"\n**Selector:** `' + n.selector + '`\n**Note:** ' + n.note + '\n\n'
      })
    })
    return m
  }
  function expCopy () { if (!notes.length) return toast('No notes'); navigator.clipboard.writeText(md()).then(() => toast('Copied!')) }
  function expFile () {
    if (!notes.length) return toast('No notes')
    var a = D.createElement('a'); a.href = URL.createObjectURL(new Blob([md()], { type: 'text/markdown' }))
    a.download = 'tack-review-' + new Date().toISOString().slice(0, 10) + '.md'; a.click()
  }
  function clearAll () {
    if (!notes.length) return
    var bak = notes.slice(); notes = []; save(); clearPins()
    toast('Cleared!', () => { notes = bak; save(); restorePins() })
  }

  // --- Activate / Deactivate ---
  function on () {
    if (active) return; active = true; notes = load(); buildBar()
    style = D.createElement('style'); style.id = 'tack-styles'
    style.textContent = 'body.tack-on *:hover{outline:2px solid #3b82f6!important;outline-offset:2px;cursor:crosshair!important}body.tack-on #tack-host *:hover,body.tack-on .tack-pin:hover{outline:none!important;cursor:default!important}.tack-noted{outline:2px solid #f59e0b!important;outline-offset:2px}.tack-pin{position:absolute;top:-8px;right:-8px;font-size:14px;cursor:pointer;z-index:2147483646;line-height:1;user-select:none}'
    D.head.appendChild(style); D.body.classList.add('tack-on'); D.body.style.paddingTop = '36px'
    D.addEventListener('click', onClick, true); restorePins()
  }
  function off () {
    if (!active) return; active = false
    D.body.classList.remove('tack-on'); D.body.style.paddingTop = ''
    if (style) style.remove(); if (host) host.remove()
    host = shadow = style = null; clearPins()
    D.removeEventListener('click', onClick, true)
    if (location.hash.includes('tack')) history.replaceState(null, '', location.pathname + location.search)
  }
  function chk () { if (location.hash.includes('tack') || W.__tack_activate) on(); else if (active) off() }

  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', chk); else chk()
  W.addEventListener('hashchange', chk)
})()
