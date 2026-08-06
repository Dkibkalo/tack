// Records the landing demo: real browser, real mouse, real typing, real product.
// Nothing here is staged — the export shown at the end is read out of the running
// tool before Copy clears it, so the video cannot claim something the code does not do.
//
//   node tools/record/record.mjs      → frames/*.png + frames/poster.txt
//   bash tools/record/encode.sh       → public/demo.mp4, demo.gif, demo-poster.jpg
//   npm run demo                      → both
import { launch } from '../../test/cdp.mjs'
import { createServer } from 'node:http'
import { readFile, mkdir, rm, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join, normalize } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..', '..')
const OUT = join(HERE, 'frames')
const W = 1000, H = 620

const types = { '.html': 'text/html', '.js': 'text/javascript' }
const srv = createServer(async (req, res) => {
  let p = normalize(decodeURIComponent(req.url.split('?')[0]))
  if (p === '/') p = '/demo-page.html'
  // the library comes from the working tree, so the video always shows this commit
  const base = p === '/tack.js' ? ROOT : HERE
  try {
    const b = await readFile(join(base, p))
    res.writeHead(200, { 'content-type': types[p.slice(p.lastIndexOf('.'))] || 'text/plain' }).end(b)
  } catch { res.writeHead(404).end('not found') }
})

await rm(OUT, { recursive: true, force: true })
await mkdir(OUT, { recursive: true })

// a familiar dev-server port, because that is where Tack actually gets used
async function listenOn (candidates) {
  for (const c of candidates) {
    const got = await new Promise(resolve => {
      const onErr = () => resolve(null)
      srv.once('error', onErr)
      srv.listen(c, '127.0.0.1', () => { srv.removeListener('error', onErr); resolve(srv.address().port) })
    })
    if (got) return got
  }
  return new Promise(r => srv.listen(0, '127.0.0.1', () => r(srv.address().port)))
}
const port = await listenOn([5173, 8080, 4321, 3001])
const b = await launch([
  `--window-size=${W},${H}`,
  '--force-device-scale-factor=2',   // capture at 2x, downscale on encode
  '--disable-lcd-text'               // subpixel AA turns into colour fringes in video
])

let n = 0
const shot = async () => {
  const { data } = await b.call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
  await writeFile(join(OUT, String(n++).padStart(4, '0') + '.png'), Buffer.from(data, 'base64'))
}
const hold = async frames => { for (let i = 0; i < frames; i++) await shot() }
const evalJS = expression => b.call('Runtime.evaluate', { expression, awaitPromise: true })
const pause = ms => new Promise(r => setTimeout(r, ms))

let mx = 0, my = 0
const setCursor = async (x, y) => { mx = x; my = y; await evalJS(`__cursor(${x},${y})`) }

// glide the pointer, capturing as it goes — eased so it reads as a hand, not a jump
async function moveTo (x, y, steps = 12) {
  const sx = mx, sy = my
  for (let i = 1; i <= steps; i++) {
    const t = i / steps
    const e = t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
    const cx = Math.round(sx + (x - sx) * e), cy = Math.round(sy + (y - sy) * e)
    await b.call('Input.dispatchMouseEvent', { type: 'mouseMoved', x: cx, y: cy, buttons: 0 })
    await setCursor(cx, cy)
    await shot()
  }
}
async function click () {
  await evalJS('__cursorDown(1)')
  await b.call('Input.dispatchMouseEvent', { type: 'mousePressed', x: mx, y: my, button: 'left', clickCount: 1, buttons: 1 })
  await shot()
  await evalJS('__cursorDown(0)')
  await b.call('Input.dispatchMouseEvent', { type: 'mouseReleased', x: mx, y: my, button: 'left', clickCount: 1, buttons: 0 })
  await shot()
}
async function type (text, perFrame = 3) {
  let since = 0
  for (const ch of text) {
    await b.call('Input.insertText', { text: ch })
    if (++since >= perFrame) { since = 0; await shot() }
  }
  await shot()
}
async function key (k, code, mods = 0) {
  await b.call('Input.dispatchKeyEvent', { type: 'keyDown', key: k, code, windowsVirtualKeyCode: code === 'KeyA' ? 65 : 0, modifiers: mods })
  await b.call('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code, modifiers: mods })
}

await b.call('Page.enable')
await b.call('Runtime.enable')
await b.call('DOM.enable')
await b.call('Page.navigate', { url: `http://localhost:${port}/` })
await pause(1400)

const box = async sel => {
  const { result } = await evalJS(
    `(() => { const r = document.querySelector(${JSON.stringify(sel)}).getBoundingClientRect();
      return JSON.stringify({x: Math.round(r.left + r.width/2), y: Math.round(r.top + r.height/2)}) })()`)
  return JSON.parse(result.value)
}

// Tack's UI is in a CLOSED shadow root, so the only way to find a control is to ask
// the browser for the pierced tree. Coordinates are read, never hardcoded — a popup
// that moves or grows a row must not silently make the recorder click the wrong thing.
async function findNode (cls) {
  const { root } = await b.call('DOM.getDocument', { depth: -1, pierce: true })
  const hits = []
  const walk = node => {
    const attrs = node.attributes || []
    for (let i = 0; i < attrs.length; i += 2) {
      if (attrs[i] === 'class' && attrs[i + 1].split(/\s+/).includes(cls)) hits.push(node)
    }
    ;(node.children || []).forEach(walk)
    ;(node.shadowRoots || []).forEach(walk)
    if (node.contentDocument) walk(node.contentDocument)
  }
  walk(root)
  return hits[0]
}
async function centreOf (nodeId) {
  const { model } = await b.call('DOM.getBoxModel', { nodeId })
  const q = model.content
  return { x: Math.round((q[0] + q[4]) / 2), y: Math.round((q[1] + q[5]) / 2) }
}
// child = index into that node's element children (tabs and style rows have no own classes)
async function inShadow (cls, child) {
  const node = await findNode(cls)
  if (!node) throw new Error('no .' + cls + ' — did the UI change?')
  if (child === undefined) return centreOf(node.nodeId)
  const kids = (node.children || []).filter(k => k.nodeType === 1)
  if (!kids[child]) throw new Error('.' + cls + ' has no child ' + child)
  return centreOf(kids[child].nodeId)
}
async function clickIn (cls, child) {
  const p = await inShadow(cls, child)
  await moveTo(p.x, p.y, 8)
  await click()
}

// ── the story ────────────────────────────────────────────────────────────────
await evalJS(`localStorage.setItem('tack_prefs', JSON.stringify({seen:1}))`)
await evalJS('__tack.on()')
await pause(400)
await setCursor(-50, -50)
await hold(8)                                    // the page, with the toolbar waiting

// 1. rewrite the copy: the note carries the exact replacement, not a description
const sub = await box('#sub')
await moveTo(sub.x - 140, sub.y, 18)             // hover highlights the element
await hold(8)
await click()
await pause(400)
await hold(8)

await clickIn('tabs', 1)                         // → ✎ Edit text
await pause(250)
await hold(8)                                    // current text is already there

await key('a', 'KeyA', 2)                        // select it
await hold(3)
await type('Ship your first dashboard in five minutes.', 2)
await hold(10)

await clickIn('sv')                              // Save
await pause(350)
await hold(10)                                   // marker 1 lands

// 2. adjust a style and watch the page change while you type
const head = await box('#headline')
await moveTo(head.x - 180, head.y, 16)
await hold(6)
await click()
await pause(400)
await hold(6)

await clickIn('tabs', 2)                         // → ◨ Style
await pause(300)
await hold(10)                                   // the element's real values, read off the browser

await clickIn('srow', 1)                         // the font-size input
await key('a', 'KeyA', 2)
await hold(2)
await type('34px', 1)                            // the headline reflows as the digits land
const posterFrame = n                            // the moment worth putting on the poster
await hold(20)                                   // sit on it — this is the whole point

await clickIn('sv')
await pause(400)
await hold(14)                                   // and the page snaps back: nothing was changed

// the real export, taken before Copy clears it
const { result: mdRes } = await evalJS('__tack.md(false)')
const exported = mdRes.value

await clickIn('go')                              // Copy
await pause(450)
await hold(14)                                   // toast: copied, list cleared

// ── second beat: what the agent actually receives ───────────────────────────
await evalJS(`__showPaste(${JSON.stringify(exported)})`)
await pause(320)
await hold(18)                                   // the protocol at the top

const { result: maxRes } = await evalJS('__scrollMax()')
const max = maxRes.value
for (let i = 1; i <= 40; i++) {                  // scroll down to the rewrite and the style
  await evalJS(`__scrollPaste(${Math.round(max * (i / 40))})`)
  await shot()
}
await hold(26)                                   // hold on Current / Change to / Style

await writeFile(join(OUT, 'poster.txt'), String(posterFrame))
console.log('frames:', n, '· poster frame:', posterFrame)
b.close(); srv.close()
