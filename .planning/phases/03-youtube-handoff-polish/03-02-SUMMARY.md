---
phase: 03-youtube-handoff-polish
plan: 02
subsystem: web-handoff-copy
tags:
  - youtube
  - handoff
  - copy
  - documentation
  - verification-checklist
requires:
  - none
provides:
  - "web/index.html .instructions: jargon-free 4-step user copy for the YouTube handoff flow"
  - "web/index.html: <ul id=\"alt-downloaders\"></ul> empty container for Plan 03-01 alternates renderer"
  - "web/index.html: vendor-neutral YT input <small> hint (no dead savefrom.net reference)"
  - "web/DOWNLOADERS.md: 5-minute ship-day verification ritual co-located with web/downloaders.js"
affects:
  - "web/index.html .instructions section"
  - "web/index.html section.controls YT URL <small> hint"
  - "web/ documentation surface (new file)"
tech-stack:
  added: []
  patterns:
    - "Empty JS-populated DOM slot (ul#alt-downloaders) as the HTML/JS contract — HTML carries the slot, downloaders.js carries the truth"
    - "Co-located runbook (web/DOWNLOADERS.md next to web/downloaders.js) for discoverability by maintainers editing the list"
key-files:
  created:
    - web/DOWNLOADERS.md
  modified:
    - web/index.html
decisions:
  - "REMOVE not hide: dead alternates (savefrom, yt1s, ezmp3, notube, ddownr) deleted from HTML rather than commented out or flag-hidden — per YT-03 'no dead alternates surfaced'"
  - "Vendor-neutral copy: YT input hint says 'opens a downloader' without naming cobalt.tools — registry is free to swap PRIMARY without an HTML edit"
  - "Honest expectation-setting: instructions say 'click the downloader's button to save the MP3' — does not claim Get MP3 click downloads the file (Pitfall 5)"
  - "Co-located runbook: web/DOWNLOADERS.md placed in web/ next to downloaders.js (RESEARCH Open Question 2) so anyone editing the list sees the ritual"
metrics:
  duration: "~8 minutes"
  completed: 2026-05-30
  tasks: 2
  files: 2
---

# Phase 03 Plan 02: Copy + Checklist Summary

Rewrote `web/index.html` YouTube-handoff copy to a jargon-free 4-step flow and added `web/DOWNLOADERS.md` as a 5-minute ship-day verification ritual for the downloader registry.

## What changed

**`web/index.html` (modified):**
- **Instructions `<ol>`** rewritten to 4 plain-language steps. The new copy does NOT claim the first click "downloads the MP3" — it says "a new tab opens with your link already filled in, click the downloader's button to save the MP3" (per RESEARCH Pitfall 5). Step structure: paste → click downloader's button → drop MP3 here → pick instrument and convert.
- **`.howto-download` `<details>` summary** changed from `Trouble downloading? Other converters to try` to `Why two steps? And what if the downloader is broken?` — frames both halves of YT-02 (the 2-step explanation AND the graceful-fallback path).
- **`.howto-download` body** now explains the 2-step flow ("Browsers can't pull audio out of YouTube directly — only YouTube's own player can. So we hand the link off to a downloader…") in plain language with no "third-party", "API", or "extraction" jargon.
- **Alternates list** changed from a hardcoded `<ul class="converter-list">` with 5 dead/degraded `<li><a>` entries (savefrom, yt1s, ezmp3, notube, ddownr) to an EMPTY `<ul class="converter-list" id="alt-downloaders"></ul>` container. Plan 03-01's renderer will populate it from `web/downloaders.js` at load time. No hardcoded URLs in HTML — single source of truth boundary established.
- **`.tip` paragraph** rewritten to lead with "Already have a recording? Skip Get MP3…" — emphasises the bypass path for users who already have a file.
- **YT input `<small>` hint** changed from `Copies your link and opens savefrom.net with it pre-filled. …` to `Opens a downloader with your link already filled in. Save the MP3, then drop the file below. More options in the instructions above.` — no dead savefrom.net mention, no name lock-in for the registry.
- **`<p class="warning">` solo-instrument block:** UNCHANGED (correct and Phase-3-relevant per plan).

**`web/DOWNLOADERS.md` (new, 67 lines):**
- H1 title + one-sentence purpose
- "Why this exists" — short paragraph explaining genre rot, CORS-blocked liveness checks, human-gate acceptance, YT-03 traceability
- 5-step ordered checklist: (1) US-residential connection, no VPN; (2) `web/downloaders.js` is source of truth; (3) adblock-off click-through with three sub-checks; (4) test URL `dQw4w9WgXcQ` + real audio download required; (5) update `lastVerified` ISO date OR REMOVE entry (no commenting out, no flag-hiding)
- Rules list (6 bullets): DO add only after running checklist; DO keep array short; DO NOT trust SEO listicles; DO NOT add 3-letter-TLD clones without source-code evidence; DO NOT build runtime liveness check (CORS theater); DO NOT claim "one-click downloads MP3"
- Candidate-notes pointer to `03-RESEARCH.md` Downloader Evaluation Table
- Last-verified footer: `**Most recent ship-day verification:** 2026-05-30 — cobalt.tools only.`

## Commits

- `68dfd3b` — docs(03-02): rewrite YouTube handoff copy to jargon-free 4-step flow (web/index.html)
- `a424f37` — docs(03-02): add web/DOWNLOADERS.md ship-day verification checklist (web/DOWNLOADERS.md)

## Verification

All `<automated>` verify gates passed:

**Task 1 (web/index.html):**
- `grep -c 'id="alt-downloaders"' web/index.html` = 1 ✓
- `grep -c savefrom web/index.html` = 0 ✓ (dead site fully removed from hint AND alternates list)
- `grep -c 'href="https://yt1s' web/index.html` = 0 ✓
- `grep -c 'href="https://ezmp3' web/index.html` = 0 ✓
- `grep -c 'href="https://notube' web/index.html` = 0 ✓
- `grep -c 'href="https://ddownr' web/index.html` = 0 ✓
- `grep -c 'Why two steps' web/index.html` ≥ 1 ✓
- `grep -c 'class="warning"' web/index.html` ≥ 1 ✓ (solo-instrument warning preserved)
- `<section>` open/close tag balance preserved ✓

**Task 2 (web/DOWNLOADERS.md):**
- File exists ✓
- 67 lines (≥ 25 required) ✓
- Contains `lastVerified` ✓
- Contains `downloaders.js` ✓
- Contains `YT-03` ✓
- Contains `adblock` (case-insensitive) ✓
- Contains `2026-05-30` ✓

## Deviations from Plan

None — plan executed exactly as written. All `<action>` items implemented; all `<acceptance_criteria>` met; all verify gates passed first try.

The plan called for two minor copy adjustments that matched the RESEARCH.md examples almost verbatim (one notable difference: plan body text said "we hand the link off to a downloader" while RESEARCH Example 3 said "third-party converter" — the PLAN's wording is the YT-02-compliant jargon-free version, so I used the plan's wording, not the research example's).

## Stub tracking

The `<ul id="alt-downloaders">` container is INTENTIONALLY empty in committed HTML. It is not a stub in the YT-03 sense — it is the JS-populated DOM contract Plan 03-01 fulfils at runtime. If Plan 03-01 lands, the list populates from `web/downloaders.js`. If Plan 03-01 has not yet landed (or its renderer is removed), the `<details>` block still functions: the explanatory copy and the `.tip` paragraph render, only the alternates `<ul>` is empty. This is the acceptable degraded state explicitly called out in PLAN.md `<interfaces>` ("Plan 02 HTML displays an empty list if Plan 01 has not landed").

## Threat surface

No new threat surface introduced by this plan. All changes are copy + documentation. No new network endpoints, no auth paths, no file-access patterns, no schema changes. The HTML `<ul>` slot is populated by trusted same-origin JS (`web/downloaders.js`); no untrusted-input injection path.

## Self-Check: PASSED

- web/index.html: FOUND (modified, see commit `68dfd3b`)
- web/DOWNLOADERS.md: FOUND (created, see commit `a424f37`)
- Commit `68dfd3b`: FOUND in `git log`
- Commit `a424f37`: FOUND in `git log`
- All verify-gate command outputs: passed (zero failed assertions)
