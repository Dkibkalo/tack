// Narrow-viewport checks on the built site, at real phone and tablet sizes.
//
// Two invariants, and the second is the reason the first matters.
//
// 1. Nothing may be wider than the viewport. On the mobile rendering path,
//    content wider than the screen makes the browser hand out a layout viewport
//    wider than the screen too.
// 2. Tack's toolbar must be inside the part of the page a finger can reach.
//    It is `position:fixed; right/bottom`, and fixed positioning resolves against
//    that layout viewport — so an overflowing decoration anywhere on this page
//    pushes the toolbar off-screen and the product looks dead on a phone.
//
// `--window-size` cannot express this: headless Chrome clamps the window to about
// 500px and never enters the mobile rendering path. Only device metrics do both.
import { launch } from './cdp.mjs'
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, normalize } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dist = join(root, 'dist')

if (!existsSync(dist)) {
  console.error('dist/ is missing — run `npm run build` first')
  process.exit(2)
}

const types = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.woff2': 'font/woff2', '.mp4': 'video/mp4', '.jpg': 'image/jpeg',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.xml': 'application/xml'
}

// dist/ serves the site; the repo root serves the deliberately-broken fixture
// and the library itself, so the same run covers "our page" and "someone else's".
const server = createServer(async (req, res) => {
  let p = normalize(decodeURIComponent(req.url.split('?')[0].split('#')[0]))
  if (p.endsWith('/')) p += 'index.html'
  else if (!p.slice(p.lastIndexOf('/')).includes('.')) p += '/index.html'
  const bases = p.startsWith('/test/') ? [root, dist] : [dist, root]
  for (const base of bases) {
    try {
      const body = await readFile(join(base, p))
      return res.writeHead(200, { 'content-type': types[p.slice(p.lastIndexOf('.'))] || 'text/plain' }).end(body)
    } catch {}
  }
  res.writeHead(404).end('not found')
})

// 320 is the narrowest screen still worth supporting; 768 is iPad portrait,
// where an 800px-wide decoration first stops fitting.
const DEVICES = [
  [320, 568, 'iPhone SE'],
  [360, 800, 'Android'],
  [390, 844, 'iPhone 14'],
  [430, 932, 'iPhone Pro Max'],
  [768, 1024, 'iPad portrait']
]
const ROUTES = ['/', '/docs', '/privacy']

let pass = 0, fail = 0
const ok = (name, cond, detail) => {
  if (cond) { pass++; console.log('PASS ' + name) }
  else { fail++; console.log('FAIL ' + name + (detail === undefined ? '' : ' — ' + detail)) }
}

await new Promise(r => server.listen(0, '127.0.0.1', r))
const { port } = server.address()

for (const [width, height, device] of DEVICES) {
  const b = await launch()
  await b.call('Page.enable')
  await b.call('Runtime.enable')
  await b.call('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 2, mobile: true })
  await b.call('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 })

  for (const route of ROUTES) {
    const tag = `${device} ${width}x${height} ${route}`
    await b.call('Page.navigate', { url: `http://localhost:${port}${route}` })
    await new Promise(r => setTimeout(r, 1400))

    const m = JSON.parse(await b.eval(`(() => {
      const e = document.documentElement, wide = []
      document.querySelectorAll('*').forEach(el => {
        const r = el.getBoundingClientRect()
        if (r.right > e.clientWidth + 1) {
          let clipped = false
          for (let p = el.parentElement; p && !clipped; p = p.parentElement) {
            if (getComputedStyle(p).overflowX !== 'visible') clipped = true
          }
          if (!clipped) wide.push(el.tagName.toLowerCase() +
            (el.className ? '.' + String(el.className).trim().split(/\\s+/)[0] : ''))
        }
      })
      return JSON.stringify({ scrollW: e.scrollWidth, clientW: e.clientWidth,
        visW: Math.round(visualViewport.width), visH: Math.round(visualViewport.height),
        wide: wide.slice(0, 4) })
    })()`))

    ok(tag + ': no horizontal overflow',
      m.scrollW <= m.clientW + 1,
      `content ${m.scrollW}px in a ${m.clientW}px viewport` + (m.wide.length ? ' — ' + m.wide.join(', ') : ''))

    // The toolbar check only makes sense where Tack is loaded, which is every page.
    // Clearing storage first also brings back the first-run toast, which shares
    // the bottom of a phone screen with the toolbar and must not cover it.
    await b.eval(`localStorage.clear()`)
    await b.eval(`location.hash = 'tack'`)
    await new Promise(r => setTimeout(r, 900))
    const bar = await b.boxOf('pill')
    ok(tag + ': toolbar reachable',
      !!bar && bar.left >= 0 && bar.top >= 0 && bar.right <= m.visW + 1 && bar.bottom <= m.visH + 1,
      bar ? `toolbar at ${bar.left},${bar.top} -> ${bar.right},${bar.bottom} on a ${m.visW}x${m.visH} screen`
          : 'toolbar not found')

    const toast = await b.boxOf('tst')
    const overlaps = bar && toast &&
      bar.left < toast.right && toast.left < bar.right &&
      bar.top < toast.bottom && toast.top < bar.bottom
    ok(tag + ': first-run toast clears the toolbar', !overlaps,
      toast ? `toast ${toast.left},${toast.top} -> ${toast.right},${toast.bottom} covers the toolbar` : '')
  }

  // Tack has to work on pages it does not control, including ones that overflow.
  // Here the page IS broken on purpose; the library must cope anyway.
  {
    const tag = `${device} ${width}x${height} hostile page`
    await b.call('Page.navigate', { url: `http://localhost:${port}/test/overflow.html` })
    await new Promise(r => setTimeout(r, 1200))
    const m = JSON.parse(await b.eval(`JSON.stringify({
      scrollW: document.documentElement.scrollWidth,
      clientW: document.documentElement.clientWidth,
      visW: Math.round(visualViewport.width), visH: Math.round(visualViewport.height) })`))
    ok(tag + ': fixture really does overflow', m.scrollW > m.clientW + 1,
      `content ${m.scrollW}px vs viewport ${m.clientW}px — the test proves nothing otherwise`)

    await b.eval(`location.hash = 'tack'`)
    await new Promise(r => setTimeout(r, 800))
    const bar = await b.boxOf('pill')
    ok(tag + ': toolbar still reachable',
      !!bar && bar.left >= 0 && bar.top >= 0 && bar.right <= m.visW + 1 && bar.bottom <= m.visH + 1,
      bar ? `toolbar at ${bar.left},${bar.top} -> ${bar.right},${bar.bottom} on a ${m.visW}x${m.visH} screen`
          : 'toolbar not found')

    // Tap an element and check the annotation popup lands on the screen too.
    const at = JSON.parse(await b.eval(`(() => { const r = document.querySelector('#lead').getBoundingClientRect()
      return JSON.stringify({ x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }) })()`))
    await b.call('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: at.x, y: at.y }] })
    await new Promise(r => setTimeout(r, 80))
    await b.call('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await new Promise(r => setTimeout(r, 700))
    const pop = await b.boxOf('pop')
    ok(tag + ': tap opens a popup on screen',
      !!pop && pop.left >= 0 && pop.top >= 0 && pop.right <= m.visW + 1 && pop.bottom <= m.visH + 1,
      pop ? `popup at ${pop.left},${pop.top} -> ${pop.right},${pop.bottom} on a ${m.visW}x${m.visH} screen`
          : 'no popup — a tap did not reach the page')
  }
  b.close()
}

server.close()
console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
