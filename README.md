# 📌 Tack

**Click. Comment. Feed to AI.**

Ultra-lightweight (11KB) tool to annotate any webpage and export comments for your AI coding assistant. One script tag. Zero dependencies.

## Quick Start

Add one line to your HTML:

```html
<script src="https://unpkg.com/@kibkalo/tack"></script>
```

Then add `#tack` to your URL:

```
https://yoursite.com/page#tack
```

That's it. Click elements, leave notes, export for AI.

## How It Works

1. **Add the script** — stays dormant until activated
2. **Add `#tack` to URL** — toolbar appears, no page reload needed
3. **Click any element** — leave a note, or rewrite its text directly
4. **Copy** — paste into ChatGPT, Claude, Cursor, etc.
5. **Check what was applied** — reload afterwards and see what actually landed

## Notes don't pile up

`Copy` exports this page's notes **and clears them**. You handed them to the AI; they shouldn't come back in the next export. Undo is one click, and `☰ → Restore last export` brings back the whole batch if you need it.

Reviewing several pages? Notes accumulate per page as you navigate. `☰ → Copy all pages` bundles everything into one file, grouped by URL. `↓ Download .md` never clears anything.

## Rewrite text in place

Click a text element and its current text is already in the edit box. Change it, and the export carries an exact replacement rather than a description:

```markdown
**Current:** `Building the future, one widget at a time.`
**Change to:** `Ship your first widget in five minutes.`
```

Works on `alt`, `placeholder`, `title`, `aria-label`, `href` and `value` too. The export tells the model to apply these verbatim, and to stop if the current text no longer matches what you saw.

## Share a review as a link

`☰ → Copy review link` compresses the whole review into the URL:

```
https://acme.com/pricing#tack=zVY9b8IwEP0rlmdESttD…
```

Open it anywhere and the notes reappear on the real page. No account, no backend, no install on the other end — the notes travel in the link itself.

## Check what was applied

After your agent finishes, reload and pick `☰ → Check what was applied`. Tack compares each annotated element against what it looked like when you flagged it: changed elements go green, unchanged stay amber, missing ones are called out. Text edits are matched exactly against what you typed.

## Multi-select

Shift-click several elements, or drag a box around them, then write one note for the group ("these three cards should be equal height"). The export lists every selector the note applies to.

## Bookmarklet

For pages you don't control, use the bookmarklet from the [landing page](https://gettack.dev). Drag it to your bookmarks bar, click on any page. Sites with a strict `script-src` CSP will block it.

## Export Format

Tack exports Markdown that tells the model how to read it:

```markdown
# Tack review — 2 notes
https://acme.com/pricing · viewport 1440×900 · 2026-08-05

## How to use this file
Each note has three anchors, most reliable first:
1. **Text** — element text at review time. Grep this first.
2. **Section** — nearest preceding heading. Disambiguates repeated text.
3. **Selector** — DOM path at review time; exact but stale after a refactor.

Resolve by Text, confirm with Section, fall back to Selector. If nothing matches,
the markup changed: act on the note's intent, do not guess a nearby element…

---

## 1.
**Where:** section "Pricing" → `button`
**Text:** `Buy now`
**Classes:** `btn btn-primary`
**Selector:** `[data-testid="cta"]`
**Note:**
> Too aggressive. Use "Start free trial" and make it green.
```

Every export ends with one attribution line (`Collected with Tack v0.3.2 — https://gettack.dev`) so whoever receives the file knows what produced it.

Selectors break on the first refactor; element text usually survives. Telling the model that up front is worth more than another field of metadata.

## Features

- 📦 **11KB gzipped** — zero dependencies, vanilla JS
- 🔒 **Local-only** — no data leaves your browser (localStorage)
- 👻 **Dormant until needed** — activate with `#tack`
- 🖐 **Never writes to your DOM** — annotations are drawn on an overlay, so `<img>`, inputs, SVG and tables are untouched, and your layout never shifts
- ✏️ **Rewrite text and attributes** in place instead of describing the change
- 🔗 **Share a review as a link** — no server, no account
- ✅ **Verify what was applied** after the agent runs
- 🌓 **Shadow DOM & SPA aware** — selectors cross open shadow roots (` >>> `), pins survive `pushState` navigation
- ✍️ **Text selection** — select a phrase to annotate exactly that
- 🎯 **Multi-select** — shift-click or drag a box, one note for many elements
- ⏸ **Freeze animations** so you can annotate a specific frame
- 🌗 **Light and dark** toolbar
- 📄 **Multi-page** — per-page by default, all pages on demand
- 🌐 **Works anywhere** — any page, any framework, bookmarklet for external sites

## Keyboard

| | |
|---|---|
| `⌘⇧F` / `Ctrl⇧F` | toggle Tack |
| `⌘↵` | save note |
| `↑` / `↓` | move the target to the parent / first child element |
| `Enter` | annotate the element you moved to |
| `Esc` | close popup, or drop the current selection |

Deliberately no single-letter shortcuts — Tack runs on top of your app, and your app's shortcuts win.

## Programmatic API

Available as `window.__tack` once the script loads:

```js
__tack.on()                          // activate without the #tack hash
__tack.add('#hero h1', 'note')       // annotate by selector or element
__tack.add('#sub', '', {to: 'New copy'})       // propose exact replacement text
__tack.add('#img', '', {a: 'alt', to: 'Alt'})  // …or an attribute value
__tack.menu()                        // open the actions menu
__tack.open('#hero h1', {edit: 1})   // open the editor on an element
__tack.select(['#a', '#b'])          // stage a multi-element selection
__tack.list()                        // all notes as plain objects
__tack.md(true)                      // markdown for every page (false = current page)
__tack.copy(false)                   // copy current page's notes, then clear them
__tack.link()                        // shareable URL with the review inside
__tack.load(url)                     // import a review link
__tack.applied()                     // [{note, status: 'ok' | 'no'}]
__tack.prefs({light: 1})             // block, markers, freeze, light, open
__tack.off()
```

This is how an agent with browser control reviews a page it doesn't own: load the URL, inject `tack.js`, annotate, read `md()`.

## Keep in Production

Until `#tack` is in the URL hash, Tack registers one idle keyboard listener and stops. No DOM changes, no network requests, no work on your page.

Once active it is honest about what it does: a fixed toolbar, intercepted clicks, and an overlay above your page. Closing it removes every trace.

## Claude Code

`skills/tack/SKILL.md` covers both installing Tack in a project and applying a pasted review. Point your agent at it, or copy it into `.claude/skills/`.

## Development

```bash
npm install
npm test          # headless Chrome smoke suite, source + built artifact
npm run build:js  # tack.js → tack.min.js
npm run dev       # landing page
```

`tack.js` is the readable source. `tack.min.js` is what npm and unpkg serve; it is committed, so rebuild and commit it whenever `tack.js` changes.

## vs. Alternatives

| | Tack | Agentation | Vibe Annotations | Drawbridge |
|---|---|---|---|---|
| Install | 1 script tag | npm + edit your app | Extension + MCP | Extension |
| Framework | Any | React 18+ only | Any | Any |
| Build step | None | Required | Required | n/a |
| Pages you don't own | ✓ (bookmarklet) | ✗ | ✗ localhost only | ✓ |
| Ship to production | ✓ dormant | ✗ dev-only | ✗ | ✗ |
| Size | 11KB gzip | 672KB ESM | Extension + server | Extension |
| License | MIT | PolyForm Shield | MIT | Custom |
| Agent sync loop (MCP) | ✗ not yet | ✓ | ✓ | ✗ |
| React source file + line | ✗ | ✓ | ✗ | ✗ |
| Layout / wireframe mode | ✗ | ✓ | ✗ | ✗ |

Competitor facts checked 2026-08-05 against their public packages and docs.

## License

MIT — [kibkalo.com](https://kibkalo.com)
