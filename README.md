# 📌 Tack

**Click. Comment. Feed to AI.**

Ultra-lightweight (&lt;4KB) tool to annotate any webpage and export comments for your AI coding assistant. One script tag. Zero dependencies.

## Quick Start

Add one line to your HTML:

```html
<script src="https://unpkg.com/tack.js"></script>
```

Then add `#tack` to your URL:

```
https://yoursite.com/page#tack
```

That's it. Click elements, leave notes, export for AI.

## How It Works

1. **Add the script** — stays invisible until activated, zero overhead
2. **Add `#tack` to URL** — toolbar appears, no page reload needed
3. **Click any element** — leave a note about what should change
4. **Copy for AI** — paste into ChatGPT, Claude, Cursor, etc.

## Multi-Page Reviews

Navigate between pages while reviewing — comments accumulate across all pages. Export collects everything into one Markdown file, organized by URL. Works automatically with the `<script>` tag on each page.

## Bookmarklet

For pages you don't control, use the bookmarklet from the [landing page](https://gettack.dev). Drag it to your bookmarks bar, click on any page.

## Export Format

Tack exports LLM-optimized Markdown with triple-anchor element identification:

```markdown
## 1.
**Where:** section "About Us" → `p`
**Element text:** "We provide excellent services..."
**Selector:** `main > section:nth-of-type(2) > p:nth-of-type(3)`
**Note:** Make this more specific
```

Each note includes: element text (most reliable), section heading (human-readable), and CSS selector (precise but fragile). Your AI finds the exact element every time.

## Features

- 📦 **<4KB gzipped** — zero dependencies, vanilla JS
- 🔒 **Local-only** — no data leaves your browser (localStorage)
- 👻 **Invisible until needed** — activate with `#tack`, sleeps otherwise
- 📋 **Copy or download** — Markdown export for any LLM
- 📄 **Multi-page** — comments accumulate across pages
- 🌐 **Works anywhere** — any page, any framework, bookmarklet for external sites

## Keep in Production

The script does nothing until `#tack` is in the URL hash. No overhead, no DOM changes, no network requests. You can leave it in production and activate whenever you need a review.

## vs. Alternatives

| | Tack | Vibe Annotations | Drawbridge |
|---|---|---|---|
| Install | 1 script tag | Extension + MCP server | Extension |
| Any page | ✓ (bookmarklet) | localhost only | ✓ |
| Multi-page | ✓ | ✓ | ✗ |
| Size | <4KB | Extension + server | Extension |
| Zero config | ✓ | ✗ | ✗ |
| Open source | MIT | MIT | Custom |

## License

MIT — [kibkalo.com](https://kibkalo.com)
