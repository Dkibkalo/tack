# Demo recorder

Produces `public/demo.mp4`, `public/demo.gif` and `public/demo-poster.jpg` — the video
on the landing page and the GIF in the root README.

```bash
npm run demo
```

That drives a headless Chrome through the real product with real mouse moves, real
typing and real clicks, then encodes the frames. Nothing is mocked or staged: the
library is served from the working tree, and the export shown at the end is read out
of the running tool before Copy clears it. If the video shows something, the code did it.

## Re-record when the popup or the export changes

This is not decoration, it is the thing that goes stale first. Two releases in a row
have invalidated it:

- the popup grew a third tab, so a video showing two tabs was showing a product that
  no longer existed;
- the export header was rewritten, so the pane at the end quoted wording nobody would
  ever see again.

If you touch the popup layout, the toolbar, or `md()`, assume the demo is wrong until
you have re-run this.

## Files

| | |
|---|---|
| `record.mjs` | the scenario, and the CDP plumbing to drive it |
| `demo-page.html` | a fictional product page — see the note on why below |
| `encode.sh` | ffmpeg settings for the three assets |
| `frames/` | output, git-ignored |

The browser client is shared with the test suite (`test/cdp.mjs`) rather than copied,
so there is one implementation of talking to Chrome over the debugging pipe.

## Why a made-up page

The demo page is a fictional company. Recording a real site would put someone else's
brand and copy in our marketing next to invented criticism of it, which is not ours to
do — and the URL bar reads `localhost:5173`, because a local dev server is where this
actually gets used.

## Finding the UI

Tack's interface lives in a **closed** shadow root, so `document.querySelector` cannot
see it. `record.mjs` asks Chrome for the pierced DOM tree and measures each control
before clicking it. Never hardcode coordinates: a popup that shifts by a row would make
the recorder click the wrong thing and the mistake would only show up in the video.

## Encoding choices

- **mp4** 1000×482, CRF 26. Frames are captured at 2× and halved, which is what keeps
  the text sharp. The landing's demo window is laid out around this size.
- **gif** 10fps, 64 colours, 700px. An 8fps cut saves about 150KB; it was not taken,
  because a demo is judged on how it moves and the typing is where that shows.
- **poster** the frame `record.mjs` marks mid-edit. It is what a phone shows under
  "tap full screen", so it has to show the tool working rather than an empty page.
