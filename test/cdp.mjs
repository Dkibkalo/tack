// Minimal Chrome DevTools Protocol client over the debugging pipe.
//
// Node has no global WebSocket before 21, and --remote-debugging-pipe needs none:
// fd 3 is browser-in, fd 4 is browser-out, messages are NUL-terminated JSON.
// Kept here rather than pulled from npm so the test suite stays dependency-free.
import { spawn } from 'node:child_process'

export async function launch (args = []) {
  const chrome = spawn(process.env.CHROME || 'google-chrome', [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--hide-scrollbars',
    '--remote-debugging-pipe', ...args, 'about:blank'
  ], { stdio: ['ignore', 'pipe', 'pipe', 'pipe', 'pipe'] })

  const [, , , wr, rd] = chrome.stdio
  let id = 0, buf = Buffer.alloc(0)
  const pending = new Map()

  rd.on('data', chunk => {
    buf = Buffer.concat([buf, chunk])
    let i
    while ((i = buf.indexOf(0)) !== -1) {
      const msg = JSON.parse(buf.subarray(0, i).toString())
      buf = buf.subarray(i + 1)
      if (msg.id && pending.has(msg.id)) {
        const { resolve, reject } = pending.get(msg.id)
        pending.delete(msg.id)
        msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result)
      }
    }
  })

  const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
    const m = { id: ++id, method, params }
    if (sessionId) m.sessionId = sessionId
    pending.set(m.id, { resolve, reject })
    wr.write(JSON.stringify(m) + '\0')
  })

  const { targetInfos } = await send('Target.getTargets')
  const page = targetInfos.find(t => t.type === 'page')
  const { sessionId } = await send('Target.attachToTarget', { targetId: page.targetId, flatten: true })

  const call = (method, params) => send(method, params, sessionId)

  return {
    call,
    close: () => { try { chrome.kill() } catch {} },

    /** Evaluate an expression in the page and return its value. */
    async eval (expression) {
      const { result, exceptionDetails } = await call('Runtime.evaluate',
        { expression, awaitPromise: true, returnByValue: true })
      if (exceptionDetails) throw new Error(exceptionDetails.text)
      return result.value
    },

    /**
     * Border box of the first element carrying `cls`, searched through closed
     * shadow roots — the only way to see Tack's UI, which lives in one.
     * Returns null when no such element exists.
     */
    async boxOf (cls) {
      const { root } = await call('DOM.getDocument', { depth: -1, pierce: true })
      const hits = []
      const walk = n => {
        const a = n.attributes || []
        for (let i = 0; i < a.length; i += 2) {
          if (a[i] === 'class' && a[i + 1].split(/\s+/).includes(cls)) hits.push(n)
        }
        ;(n.children || []).forEach(walk)
        ;(n.shadowRoots || []).forEach(walk)
      }
      walk(root)
      if (!hits[0]) return null
      const { model } = await call('DOM.getBoxModel', { nodeId: hits[0].nodeId })
      const q = model.border
      return {
        left: Math.round(q[0]), top: Math.round(q[1]),
        right: Math.round(q[2]), bottom: Math.round(q[5]),
        width: Math.round(q[2] - q[0]), height: Math.round(q[5] - q[1])
      }
    }
  }
}
