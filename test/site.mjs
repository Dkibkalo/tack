// Static checks on the built site. Runs after `astro build`, no browser needed.
import { readFile, readdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, relative } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dist = join(root, 'dist')
const ORIGIN = 'https://gettack.dev'

let pass = 0, fail = 0
const ok = (name, cond, detail) => {
  if (cond) { pass++; console.log('PASS ' + name) }
  else { fail++; console.log('FAIL ' + name + (detail === undefined ? '' : ' — ' + detail)) }
}

if (!existsSync(dist)) {
  console.error('dist/ is missing — run `npm run build` first')
  process.exit(2)
}

async function htmlFiles (dir) {
  const out = []
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) out.push(...await htmlFiles(p))
    else if (e.name.endsWith('.html')) out.push(p)
  }
  return out
}

const pages = await htmlFiles(dist)
ok('site has pages', pages.length >= 3, String(pages.length))

const one = (html, re) => (html.match(re) || []).length
const grab = (html, re) => (html.match(re) || [])[1]

// route a built file back to the URL path it will serve at
const routeOf = f => {
  const rel = relative(dist, f).replace(/\\/g, '/')
  return rel === 'index.html' ? '/' : '/' + rel.replace(/\/index\.html$/, '').replace(/\.html$/, '')
}

const routes = new Set(pages.map(routeOf))

for (const f of pages) {
  const route = routeOf(f)
  const html = await readFile(f, 'utf8')
  const tag = 'page ' + route

  ok(tag + ': one <title>', one(html, /<title>/g) === 1)
  ok(tag + ': has description', /<meta name="description" content="[^"]{40,}"/.test(html))
  ok(tag + ': one canonical', one(html, /rel="canonical"/g) === 1)

  const canonical = grab(html, /rel="canonical" href="([^"]+)"/)
  const expected = ORIGIN + route                     // root keeps its single slash
  ok(tag + ': canonical origin', (canonical || '').startsWith(ORIGIN), canonical)
  ok(tag + ': canonical matches route', canonical === expected, canonical + ' vs ' + expected)
  ok(tag + ': no trailing slash on sub-pages', route === '/' || !canonical?.endsWith('/'), canonical)

  for (const p of ['og:title', 'og:description', 'og:url', 'og:image']) {
    ok(tag + ': has ' + p, new RegExp(`property="${p}" content="[^"]+"`).test(html))
  }
  ok(tag + ': og:url equals canonical', grab(html, /property="og:url" content="([^"]+)"/) === canonical)

  // the privacy pitch is only honest if the page itself calls nobody
  ok(tag + ': no third-party fonts', !/fonts\.(googleapis|gstatic)\.com/.test(html))

  // A review payload belongs in nobody's <head>; the body may legitimately show
  // an example link, so only the metadata is checked.
  const head = (html.match(/<head>([\s\S]*?)<\/head>/) || [])[1] || ''
  ok(tag + ': no review payload in metadata', !/#tack=/.test(head))

  // internal links must resolve to a built route or an on-page anchor
  const links = [...html.matchAll(/href="(\/[^"#?]*)"/g)].map(m => m[1])
  const broken = links.filter(l => {
    if (l === '/') return false
    if (/\.(png|svg|ico|txt|xml|js|css|woff2?)$/.test(l)) return !existsSync(join(dist, l))
    return !routes.has(l.replace(/\/$/, ''))
  })
  ok(tag + ': internal links resolve', broken.length === 0, broken.join(', '))
}

// robots + sitemap agree with what was built
const robots = await readFile(join(dist, 'robots.txt'), 'utf8')
ok('robots allows crawling', /User-agent: \*/.test(robots) && !/Disallow: \/\s*$/m.test(robots))
const sitemapRef = grab(robots, /Sitemap:\s*(\S+)/)
ok('robots points at a sitemap', !!sitemapRef, sitemapRef)
ok('the referenced sitemap exists', existsSync(join(dist, (sitemapRef || '').replace(ORIGIN, ''))), sitemapRef)

const sm = await readFile(join(dist, 'sitemap-0.xml'), 'utf8')
const locs = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1])
ok('sitemap lists every page', routes.size === locs.length, `routes=${routes.size} locs=${locs.length}`)
for (const l of locs) {
  ok('sitemap entry is a real route: ' + l, routes.has(l.replace(ORIGIN, '') || '/'))
}

// llms.txt should only point at things that exist
const llms = await readFile(join(dist, 'llms.txt'), 'utf8')
ok('llms.txt has a title and summary', /^# Tack/m.test(llms) && /^> /m.test(llms))
const ownLinks = [...llms.matchAll(/\]\((https:\/\/gettack\.dev[^)]*)\)/g)].map(m => m[1])
ok('llms.txt links to at least one own page', ownLinks.length > 0)
for (const l of ownLinks) {
  ok('llms.txt link resolves: ' + l, routes.has(l.replace(ORIGIN, '') || '/'))
}

console.log('---')
console.log(`TOTAL ${pass} passed, ${fail} failed`)
process.exit(fail === 0 ? 0 : 1)
