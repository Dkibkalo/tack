# Backlog

What is decided but not built, and what was deliberately rejected. Rejections are
here on purpose: they stop the same idea being re-argued in six weeks.

Status: **next** (agreed, ready to build) · **later** (agreed, not scheduled) ·
**blocked** (waiting on something) · **cut** (decided against, with the reason).

---

## Shipped

Kept here for a release or two so the reasoning stays attached to the code.

### Batch protocol in the export — done
When an export carries more than one note, the header should tell the agent to read
every note before editing, find conflicts, duplicates and shared causes, implement the
smallest coherent set of changes, stop and report anything it cannot resolve safely,
and finish with a checklist mapping each note to done / blocked / covered by another —
naming files changed and how it verified.

Taken from the Codex desktop app's annotation batching, which handles stacked
annotations as one coordinated instruction set rather than a queue of edits.

Two details settled in review: only emit this when there is more than one note, and do
not say "propose one consolidated change" — unrelated notes need unrelated changes, and
"propose" invites the agent to plan instead of act.

Also extend the untrusted-input warning. It currently covers note bodies only, but
Text, Section, Classes, Selector and Source are all page-derived and equally untrusted.

### Source hint from dev-tool attributes — done
Some build setups already stamp the source location into the DOM. Read it if present
and export it as an anchor ranked above the selector:

| Attribute | Emitted by |
|---|---|
| `data-astro-source-file` + `data-astro-source-loc` | Astro, automatically in dev |
| `data-inspector-relative-path` + `-line` + `-column` | react-dev-inspector |
| `data-v-inspector` (`path:line:col`) | vite-plugin-vue-inspector |
| `data-tsd-source` (`path:line:col`) | TanStack Devtools |
| `data-component-path` + `data-component-line` | Lovable-style tooling |

This is a hint, not a resolved location — say so in the export. Astro does it by
default in dev; most React and Vue setups do not, so expect it to be absent more often
than present. Validate before trusting: plausible source extension, numeric line and
column, no newlines, bounded length. Prefer the clicked element, then a bounded
ancestor walk, and label an ancestor match as such.

Paths can be absolute and leak a username and directory layout, so the hint must stay
out of the share-link payload — local export only.

### Region annotation — done
Dragging a box currently selects the elements inside it. Codex also lets you annotate
an area that is not an element ("this whole strip feels cramped"). When a drag selects
nothing, record a region note instead: box geometry, the elements it overlaps, and the
nearest heading. A fallback, not a region editor.

### Demo recorder lives in the repo — done, 0.6.0
`npm run demo` records the landing video against the working tree and encodes all
three assets. The scenario finds Tack's controls by measuring the pierced DOM rather
than by hardcoded coordinates, so a popup that grows a row cannot make it silently
click the wrong thing, and the poster frame is marked by the scenario instead of
picked by hand. Encoding choices and the trigger for re-recording are written down in
`tools/record/README.md`.

### Privacy wording is wider than the truth — done
`/privacy` says a review link lives in the URL fragment, which browsers do not send to
servers. True, and not enough. The host page's own JavaScript can read `location.hash`
before Tack clears it, and can read Tack's `localStorage` because it is same-origin.
On a page you do not trust, a review can be read by that page. Blocks the source hint
above, which would put local paths into the same reachable storage.

Two smaller corrections in the same pass: the bookmarklet does make a network request —
for the script itself, from unpkg — even though the loaded core makes none; and "check
what was applied" marks a freeform note applied whenever the element's text changed,
which is a false positive for any unrelated edit, so it should not be sold as hard
verification.

### Style adjust with live preview — done, 0.6.0
Change size, line height, weight, colour, background, padding, gap or radius on the
element and watch the page update; save and it reverts, leaving a note with exact
before and after. Verified by the applied check like a text rewrite, because the
values are exact.

Preview is `Element.animate()` paused with `fill:'both'`, cancelled to revert. Proven
in a browser: no attribute and no inline style added, an existing inline style
survives, it reaches inside an open shadow root, layout properties revert cleanly.
`commitStyles()` is never called — it would write into the style attribute.

`!important` wins over it. The row says `locked by !important` rather than showing
nothing, and the note still records the request so an agent knows the rule has to go.
One trap found while building: when the browser refuses the change it resolves to the
old value, and recording that as "resolved to" made the applied check pass on a change
nobody had made. Only record a resolved value when it differs from both the request
and the original.

The landing's "never shifts your layout" claim was dropped, on the owner's call.

---

## Agreed, not scheduled

### Trim the bundle — later
0.3.5 was 11352 bytes gzipped; 0.6.0 is 15524, up 37% across mobile support, DOM
events, the batch protocol, source hints, region notes and style preview. Most of the
growth is prose in the export, which is the part users praise, so cutting it is not
obviously right. Worth a measured pass before it goes further: which paragraphs earn
their bytes, and whether the export protocol could be fetched rather than inlined
without breaking the no-network promise.


### MCP sync loop — later
Deliberately shipped the copy-paste path first: the moment the answer to "how do I use
this" is "run a local server", it stops being something you can hand to a designer.

Shape: a file bridge first, then `tack_pending`, `tack_watch`, `tack_resolve`,
`tack_reply`, `tack_verify`. Optional in every sense — the script detects the bridge and
behaves identically when it is absent. The core must keep making no network calls; a
companion process does the talking.

### Review-level context field — later
One optional field for state and constraints ("mobile empty state; keep the card DOM
unchanged"), carried at the top of the export. Codex's own guidance tells users to name
the route and state; we already capture the viewport and could capture intent.

### Mobile landing is still eleven screens — later
Down from 11.7 after the mobile pass, but that is length, not density. Cutting sections
is a product decision, not a mechanical one.

### Dark-theme variant of the demo page — later
The recorded demo runs on a light fictional page while the landing is dark. A dark
variant would sit better, at the cost of re-recording.

### Hero tagline no longer describes the product — later
"Click. Comment. Feed to AI." predates rewrite-in-place, share links and verification.

---

## Blocked

### SEO articles — blocked on data
Deliberately gated on analytics. Now that the funnel is instrumented
(`tack:activate` → `tack:note` → `tack:export`), wait for real numbers rather than
guessing which topics to write.

### Launch sequence — blocked on the author
Drafts are written: one subreddit post, then a second a few days later with the
sharpened framing, then Show HN on a Tuesday-to-Thursday morning ET, then a dev.to
article a week later. Every one of these has to be posted by a human from their own
account; asking anyone to upvote is a ban.

### Awesome-list submissions — blocked on maintainers
`jamesmurdza/awesome-ai-devtools` [#933](https://github.com/jamesmurdza/awesome-ai-devtools/pull/933)
and `ai-for-developers/awesome-ai-coding-tools` [#599](https://github.com/ai-for-developers/awesome-ai-coding-tools/pull/599)
are open and passed automated checks. `awesome-claude-code` was submitted through its
web form by the author. Nothing to do but wait.

### Mobile behaviour on real hardware — blocked on a device
Everything in the 0.4.0 mobile pass was verified in emulated Chrome across five screen
sizes. Chrome on Android should behave the same way; iOS Safari is a different engine
with its own shrink-to-fit logic and has not been reproduced on a real device.

---

## Cut

### Computed-style snapshot in the export — cut
Recording font size, colour and box dimensions for every note as a cheap substitute for
Codex's screenshots. Rejected in review as noise and false precision: it inflates every
note to help with a small number of subjective complaints. If style preview lands, the
same information arrives with intent attached, which is worth far more.

### Screenshots in the core — cut
Rasterising needs a large dependency and would wreck both the size budget and the
privacy model. If a browser agent is driving Tack it can take its own screenshot.

### Source-file resolution by reading framework internals — cut
What Agentation and Codex do. It requires knowing the framework, which is the one thing
Tack refuses to require — that refusal is why it works on Rails, WordPress and static
HTML. The attribute hint above is the version of this that fits.
