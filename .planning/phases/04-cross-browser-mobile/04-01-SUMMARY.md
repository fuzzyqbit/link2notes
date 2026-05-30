---
phase: 04-cross-browser-mobile
plan: 01
subsystem: web
tags:
  - css
  - responsive
  - mobile
  - abcjs
  - ios-safari
requirements:
  - XPLAT-02
dependency-graph:
  requires:
    - phase-01 abcjs render call site (renderResult in web/main.js)
    - phase-01 .score container styling (web/style.css)
  provides:
    - fluid score sizing: .score svg scales to container at any viewport width
    - iOS-safe input font-size (>=16px on phones, no focus-zoom)
    - container-driven abcjs staffwidth instead of hard 740px
  affects:
    - "Plan 04-03 test matrix S2 (no h-scroll), S11 (score readable on phone), iOS input-focus auto-zoom check are now testable on real devices"
tech-stack:
  added: []
  patterns:
    - "viewBox + max-width: 100% for fluid SVG (abcjs responsive: 'resize' supplies the viewBox)"
    - "container.clientWidth-driven abcjs staffwidth instead of hard pixel value"
    - "iOS-Safari focus-zoom workaround via input font-size: 16px inside (max-width: 640px) media query"
key-files:
  created: []
  modified:
    - web/style.css
    - web/main.js
decisions:
  - "Kept overflow-x: auto on .score at desktop (preserves the long-score scroll fallback), overrode to overflow-x: hidden inside the mobile media query (the page is the scroll surface on phones)"
  - "Container-driven staffwidth (Math.max(280, scoreEl.clientWidth - 24)) chosen over omitting staffwidth entirely; gives us explicit control of the engraver target while letting responsive: 'resize' + CSS max-width handle later resizes"
  - "Reordered resultEl.hidden = false to BEFORE renderAbc so clientWidth returns a real layout-box measurement (hidden=true yields 0)"
  - "Single @media (max-width: 640px) block extended in place rather than adding a sibling block — keeps style.css scannable"
metrics:
  duration: "~7 min wall"
  completed: "2026-05-30"
  tasks-completed: 2
  tasks-total: 2
  files-modified: 2
  net-loc: "+31 / -3 (style.css +20, main.js +14 / -3)"
---

# Phase 04 Plan 01: Mobile Layout Summary

One-liner: Made the web app phone-friendly by giving abcjs a fluid container (viewBox + CSS max-width) and forcing 16px inputs on phones so iOS Safari stops zooming on focus.

## What Shipped

**`web/style.css` (+20 LOC, single @media block extended):**

1. `.score` gained `-webkit-overflow-scrolling: touch` so the desktop overflow-x: auto fallback gets iOS momentum scroll when it triggers.
2. New top-level `.score svg { max-width: 100%; height: auto; display: block; }` rule — load-bearing line for fluid scaling; the abcjs-emitted SVG now scales down to fit narrow containers instead of overflowing.
3. Existing `@media (max-width: 640px)` block extended in place with three sibling rules:
   - `.score { overflow-x: hidden; }` — on phones the page (not the container) is the scroll surface
   - `.score svg { width: 100%; }` — force fluid (not just max-width)
   - `input[type="file"], input[type="url"], select { font-size: 16px; }` — prevents iOS Safari from auto-zooming the viewport when one of these inputs gets focus

**`web/main.js` (+14 / -3 LOC, renderResult only):**

1. Moved `resultEl.hidden = false` from end of renderResult to BEFORE the renderAbc call so `scoreEl.clientWidth` returns the real layout-box width (hidden=true yields 0).
2. Replaced the hard `staffwidth: 740` with `Math.max(280, scoreEl.clientWidth - 24)` — 24 accounts for the .score 12px padding on each side; 280 floor keeps very narrow viewports from squashing the staff.
3. Kept `responsive: "resize"` and `add_classes: true`. The interaction: abcjs uses staffwidth at first paint; responsive:"resize" adds the viewBox so later layout reflows let CSS `max-width: 100%` continue to scale the SVG.

## Verification Run (all pass)

| Check | Result |
|---|---|
| `grep -c '@media (max-width: 640px)' web/style.css` returns `1` | OK |
| `grep '\.score svg' web/style.css` | OK (top-level rule + media-query override both present) |
| `grep '\-webkit-overflow-scrolling: touch' web/style.css` | OK |
| `grep 'font-size: 16px' web/style.css` | OK |
| `grep 'scoreEl.clientWidth' web/main.js` | OK |
| `grep 'staffwidth: 740' web/main.js` returns nothing | OK |
| `node --check web/main.js` exit 0 | OK |

## Commits

- `f5e1108` — feat(04-01): fluid score container + 16px inputs on phones (web/style.css)
- `091ee09` — feat(04-01): size abcjs staffwidth from container, not hard 740 (web/main.js)

## Deviations from Plan

None — plan executed exactly as written. Both tasks landed atomically, all `<automated>` verify commands pass, no auto-fix rules invoked.

One small ordering note worth recording for the test matrix in Plan 04-03: the plan's Task 2 instructed reading clientWidth AFTER `resultEl.hidden = false`, which we did — but the existing renderResult only set `resultEl.hidden = false` at the very END. The reorder is a real behavioral change: any code that hooked into `resultEl.hidden` flipping to false used to see it flip after the score was rendered into DOM; now it flips first. There is no such code in main.js or elsewhere (verified by grep), but if a future plan wires e.g. an IntersectionObserver to `#result` to lazy-load something, it will now fire on the empty box before the SVG paints. Not a regression today; flagged for future awareness.

## Anything Weird or Surprising About abcjs

Nothing surprising — the documented `responsive: "resize"` + container-width-driven staffwidth combination behaves exactly as the cited GitHub issues (#71, #90, #211) describe. The viewBox abcjs emits with `responsive: "resize"` is what makes the CSS `.score svg { max-width: 100% }` work; without it, the SVG would scale awkwardly. The 280 floor in Math.max is precautionary — in practice clientWidth on a 360px viewport with main's `padding: 40px 24px` minus `.score` 12px padding lands around 280-292px, so the floor is rarely hit but does protect against the edge case where renderResult fires before the layout box is laid out.

The only thing worth flagging for the test matrix: **on a 360px-wide viewport, the score will engrave at ~280px wide** — which is narrow enough that abcjs may break a 4-bar line into a 2-bar line. That's the right tradeoff (readable narrow score > scrolling wide score), but it changes the visual rhythm of the page and the test matrix should note whether real-iPhone users find the resulting line breaks acceptable.

## Readiness Statement

Plan 04-03 test matrix can now exercise S2 (no h-scroll), S11 (score readable on phone), and the iOS auto-zoom check on real devices.

## Self-Check: PASSED

- `web/style.css` modified — FOUND (line containing `.score svg` and line containing `font-size: 16px` both present)
- `web/main.js` modified — FOUND (lines containing `scoreEl.clientWidth` and `Math.max(280` both present; `staffwidth: 740` absent)
- Commit `f5e1108` — FOUND in `git log`
- Commit `091ee09` — FOUND in `git log`
