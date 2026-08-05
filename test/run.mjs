// Smoke tests: serve the repo, run the harness in headless Chrome, read the DOM.
// No dependencies — Node's http server plus `--dump-dom`.
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join, normalize } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const types = { '.html': 'text/html', '.js': 'text/javascript', '.md': 'text/markdown' }

const server = createServer(async (req, res) => {
  let p = normalize(decodeURIComponent(req.url.split('?')[0]))
  if (p === '/' || p === '/test' || p === '/test/') p = '/test/index.html'
  // TACK=min runs the same suite against the built artifact
  if (p === '/tack.js' && process.env.TACK === 'min') p = '/tack.min.js'
  try {
    const body = await readFile(join(root, p))
    res.writeHead(200, { 'content-type': types[p.slice(p.lastIndexOf('.'))] || 'text/plain' })
    res.end(body)
  } catch {
    res.writeHead(404).end('not found')
  }
})

const chrome = process.env.CHROME || 'google-chrome'
server.listen(0, '127.0.0.1', () => {
  const { port } = server.address()
  execFile(chrome, [
    '--headless', '--no-sandbox', '--disable-gpu', '--virtual-time-budget=8000',
    '--dump-dom', `http://127.0.0.1:${port}/test/index.html`
  ], { maxBuffer: 1 << 24 }, (err, stdout) => {
    server.close()
    if (err && !stdout) { console.error('chrome failed:', err.message); process.exit(2) }
    const m = stdout.match(/<pre id="out">([\s\S]*?)<\/pre>/)
    if (!m) { console.error('no test output found in DOM'); process.exit(2) }
    const out = m[1].replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
    console.log(out.trim())
    process.exit(out.includes('SMOKE_OK') ? 0 : 1)
  })
})
