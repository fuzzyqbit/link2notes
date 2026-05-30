---
phase: 03-youtube-handoff-polish
plan: 01
subsystem: web
tags:
  - youtube
  - handoff
  - cobalt
  - downloader-registry
  - ios-safari
requires:
  - web/main.js (pre-existing structure: ytUrlInput, getAudioBtn, converterUrlFor, click handler)
provides:
  - web/downloaders.js — single source of truth for YT→MP3 downloader candidates
  - PRIMARY + DOWNLOADERS exports consumed by main.js (and any future renderer)
  - Documented cobalt hash-fragment prefill URL format locked down by smoke test
  - iOS-Safari-safe click handler pattern (open synchronous, clipboard fire-and-forget)
  - Defensive #alt-downloaders renderer (parallel-safe with Plan 03-02)
affects:
  - web/main.js (import added, converterUrlFor rewritten, click handler reordered, renderer appended)
  - scripts/test-downloaders.mjs (new node smoke test)
tech-stack:
  added: []
  patterns:
    - "Registry-module pattern: list-of-objects with id/name/urlFor/landingUrl/lastVerified; head-of-array IS PRIMARY"
    - "iOS-Safari user-gesture rule: window.open MUST be synchronous in the click handler; awaits burn the gesture"
    - "Defensive DOM renderer: getElementById + if (el) guard for parallel-shipped plans"
    - "TDD: node smoke test written first (RED), then ESM module (GREEN), no REFACTOR needed"
key-files:
  created:
    - web/downloaders.js
    - scripts/test-downloaders.mjs
    - .planning/phases/03-youtube-handoff-polish/03-01-SUMMARY.md
  modified:
    - web/main.js
decisions:
  - "Use cobalt.tools as PRIMARY (only OSS-backed candidate with documented prefill mechanism per RESEARCH.md Net Recommendation)"
  - "Ship cobalt alone in this plan; alternates wait for Plan 03-03 verification ritual (research net: 'one good link is better than three half-checked ones')"
  - "Use hash-fragment prefill (https://cobalt.tools/#URL), NOT query string ?url= — only the # form is documented in cobalt's README"
  - "PRIMARY exported as DOWNLOADERS[0] reference (not separate constant) so reordering can never silently flip the primary"
  - "Click handler: drop async, drop try/catch wrapper, open BEFORE clipboard write — fixes iOS Safari popup-block (research Pitfall 3 / Code Example 4)"
  - "Alternates renderer guarded with `if (altList)` so main.js does not throw when #alt-downloaders is absent (Plan 03-02 owns the HTML rewrite that introduces it)"
metrics:
  duration: ~15 minutes
  tasks_completed: 2
  files_changed: 3
  commits: 3
  completed: 2026-05-30
---

# Phase 3 Plan 01: YouTube Handoff Mechanism Summary

Swapped the dead savefrom.net handoff for cobalt.tools via a new single-source-of-truth `web/downloaders.js` registry, fixed the iOS-Safari popup-block by reordering the click handler so `window.open` fires synchronously inside the user gesture, and added a defensive alternates renderer that is parallel-safe with the HTML rewrite owned by Plan 03-02.

## Objective

Replace the US-blocked savefrom.net default with a working cobalt.tools handoff, route the URL construction through a grep-able registry module (every entry stamped with an ISO `lastVerified` date), and fix the regression where awaiting the clipboard write before `window.open` burned the user-gesture context on iOS Safari. Closes YT-01 (one-click handoff to a working downloader) and the mechanism half of YT-03 (single source of truth + verification dates).

## What Changed

### Created `web/downloaders.js`

A 42-line ES module exporting two things:

- `DOWNLOADERS` — an array of `{ id, name, note?, urlFor, landingUrl, lastVerified }` objects. Ships with one entry (`cobalt`).
- `PRIMARY` — `DOWNLOADERS[0]`, the array head as a stable reference. Reordering the array therefore reorders the primary in lockstep; there is no separate constant to drift.

The cobalt entry's `urlFor` is the documented hash-fragment prefill: `https://cobalt.tools/#${encodeURIComponent(yt)}`. The header comment captures the ship-day verification ritual ("if an entry fails day-of-ship verification, REMOVE it — do not hide it"), the YT-03 success criterion, and a pointer to `web/DOWNLOADERS.md` (created by Plan 03-03).

### Created `scripts/test-downloaders.mjs`

A 4-assertion node smoke test that locks the contract:

1. `PRIMARY.urlFor("https://www.youtube.com/watch?v=dQw4w9WgXcQ")` produces the exact string `https://cobalt.tools/#https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3DdQw4w9WgXcQ`. Fails loudly if anyone "fixes" the encoding incorrectly.
2. `PRIMARY.id === "cobalt"`. Guards against silently flipping the primary by reordering.
3. Every `DOWNLOADERS` entry has all required fields and a valid ISO date `lastVerified`. Enforces "no half-checked alternates."
4. `DOWNLOADERS[0] === PRIMARY`. Prevents `PRIMARY` from drifting into a stale reference.

Style matches the existing Phase 1+2 smoke tests (`web/storage.test.cjs`, `web/pipeline.error.test.cjs`): plain `node:assert/strict`, no test framework, `OK <name>` per pass, non-zero exit on first failure. Uses ESM (`.mjs`) with dynamic-imported target module so it works against the static ESM `web/downloaders.js`.

### Edited `web/main.js`

Three discrete edits:

1. **Added import** alongside the existing six: `import { PRIMARY, DOWNLOADERS } from "./downloaders.js";` (placed right after the `storage.js` import to group it with the other internal modules).
2. **Rewrote `converterUrlFor`** to delegate to `PRIMARY.urlFor(youtubeUrl)`. Removed the stale savefrom.net comment about the `ss`-prefix URL hack (no longer accurate). New comment points readers at `downloaders.js` for swaps.
3. **Reordered the click handler** per RESEARCH.md Pitfall 3:
   - Dropped `async` from the arrow function.
   - Removed the `try/catch` wrapper around the whole handler.
   - `window.open(...)` is now the FIRST executable line after the empty-URL guard, fully synchronous inside the user-gesture event.
   - `navigator.clipboard.writeText(url)` runs fire-and-forget afterwards with a `.catch(() => {})` so a denied permission no longer prevents the handoff.

   Net effect: on iOS Safari, the popup never gets blocked because the user-gesture context is intact when `window.open` runs. Desktop behaviour is unchanged.
4. **Appended an alternates renderer** after the existing `downloadBlob` function. Looks up `document.getElementById("alt-downloaders")` and bails silently if absent (the `<ul id="alt-downloaders">` element is owned by Plan 03-02's HTML rewrite — Plan 03-01 must work in the browser whether 03-02 has shipped or not). When present, iterates `DOWNLOADERS` and appends an `<li>` per entry with an `<a target="_blank" rel="noopener">` and an optional ` — ${note}` text node. Uses `createElement`/`appendChild` to match the project's existing DOM-API style (no `innerHTML`).

## Verification

### Automated (passing)

- `node scripts/test-downloaders.mjs` — all 4 assertions pass.
- `node --check web/main.js` — exit 0.
- `node --check web/downloaders.js` — exit 0.
- `grep -c savefrom web/main.js web/downloaders.js` — `0` across both files.
- `grep -c "cobalt.tools/#" web/downloaders.js` — 1.
- `grep -c PRIMARY.urlFor web/main.js` — 1.
- `grep -c 'import { PRIMARY' web/main.js` — 1.
- `grep -c alt-downloaders web/main.js` — 2 (getElementById call + comment).
- Click-handler ordering: the first executable token inside the handler (excluding comments) is `window.open(...)` on line 11 of the block; `navigator.clipboard` appears on line 14.
- The click handler is no longer marked `async`.

### Manual (deferred to phase verification)

- Open `web/index.html` in a browser. Paste `https://www.youtube.com/watch?v=dQw4w9WgXcQ`. Click Get MP3. Verify a new tab opens at `https://cobalt.tools/#https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3DdQw4w9WgXcQ` and cobalt's input field is prefilled.
- iOS Safari (Phase 4 cross-browser pass): confirm popup is NOT blocked after the handler change.

## Commits

| Hash      | Type | Summary                                                                        |
| --------- | ---- | ------------------------------------------------------------------------------ |
| `ef22e5c` | test | (03-01) add failing smoke test for downloaders registry (RED)                  |
| `44a1de7` | feat | (03-01) add downloaders.js registry with cobalt as PRIMARY (GREEN)             |
| `a486927` | feat | (03-01) wire downloaders.js + iOS-safe click handler + alternates              |

TDD gate sequence verified: `test()` commit precedes `feat()` GREEN commit. No REFACTOR needed — the GREEN implementation matches the registry spec exactly and the click-handler edit is a single discrete change.

## Deviations from Plan

None. The plan was executed exactly as written:

- The plan's `read_first` reference to `scripts/test-storage.mjs` / `scripts/test-pipeline-error.mjs` was correctly flagged as stale in the orchestrator prompt — the Phase 1+2 smoke tests actually live as `web/storage.test.cjs` + `web/pipeline.error.test.cjs`. The `<action>` spec for `scripts/test-downloaders.mjs` was self-contained, so I matched its assertion style (plain `node:assert/strict`, `OK <name>` per pass, non-zero exit on fail) against `web/storage.test.cjs` and produced an ESM (`.mjs`) variant since the target module is ESM. No rule-triggered deviation.

## Known Stubs

None. `web/downloaders.js` ships with cobalt as a fully wired primary; the empty-alternates state is intentional per the plan ("alternates wait for Plan 03-03 verification ritual"). The `#alt-downloaders` renderer is a no-op until Plan 03-02 introduces the matching `<ul>` element in `web/index.html`; this is by-design parallel safety, not a stub.

## Threat Flags

None. No new network endpoints, no auth surface, no file access, no schema changes. The handoff URL points at a third-party domain that the user explicitly chose by clicking Get MP3 — same trust boundary as the previous savefrom.net target, just at a different (better-maintained, OSS) destination.

## Self-Check

- web/downloaders.js — present
- scripts/test-downloaders.mjs — present
- web/main.js — modified
- ef22e5c — found
- 44a1de7 — found
- a486927 — found

## Self-Check: PASSED
