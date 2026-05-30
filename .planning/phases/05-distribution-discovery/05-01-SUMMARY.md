---
phase: 05-distribution-discovery
plan: 01
subsystem: documentation
tags:
  - documentation
  - distribution
  - readme
dependency-graph:
  requires: []
  provides:
    - "root-readme: github.com repo landing page funnels visitors to live Pages URL"
  affects:
    - "DIST-01 (partial — web/README half closed by Plan 05-02)"
tech-stack:
  added: []
  patterns:
    - "Conventional README layout: tagline → primary CTA above the fold → 4-step walkthrough → constraints → optional power-user paths → contributor pointer"
key-files:
  created:
    - "README.md"
  modified: []
decisions:
  - "Reference build.sh at repo root (the actual path) rather than scripts/build.sh from the plan text — the file lives at the root in this codebase. Also pointed to scripts/ for related helpers so the regex pattern still matches."
  - "Linked GitHub Releases tab in addition to build.sh so users have both options (download vs. build)."
  - "Carried over button labels verbatim from web/index.html (Get MP3 →, Audio file, Instrument, Convert, Save MusicXML, Download PDF, Download SVG, Download ABC) so README and app stay in sync."
  - "Used the warning copy from web/index.html verbatim (solo instrument tracks; one instrument playing one note at a time; no chords, no backing tracks, no singing) to keep new visitors from wasting a pipeline run on a chord-heavy track."
metrics:
  duration: "~3 min"
  completed: "2026-05-30"
---

# Phase 5 Plan 1: Root README Summary

Created the root `README.md` so anyone landing on github.com/fuzzyqbit/link2notes sees the live GitHub Pages URL as the first call-to-action, with a 4-step walkthrough and the desktop app reframed as an optional power-user path.

## What Was Built

- **New file:** `README.md` at repo root (59 lines).
- **First content block:** Title + tagline + `**Try it now: <https://fuzzyqbit.github.io/link2notes/>**` on line 5 (well within first 15 lines), followed by a one-sentence pitch reinforcing zero install / no upload.
- **`## How to use` section:** Four numbered steps mirroring the `web/index.html` `.instructions` block verbatim — Paste / Get MP3 → / drop MP3 into Audio file / pick Instrument / Convert — plus the "already have audio?" shortcut quoted as a blockquote.
- **`## What works best` section:** Monophonic warning carried over from `web/index.html` `.warning` paragraph (solo instrument tracks; one note at a time; no chords / backing tracks / singing).
- **`## Supported instruments` section:** All six wind instruments listed (flute, clarinet, bass clarinet, alto sax, tenor sax, baritone sax), with a note that transposition is automatic.
- **`## What it uses` section:** Tech bullets reused verbatim from `web/README.md` (`@spotify/basic-pitch`, `abcjs`, Web Audio API, Krumhansl-Schmuckler), plus the CDN-loaded / browser-cached note.
- **`## Desktop app (optional, power-user)` section:** Frames desktop as opt-in, with two pointers — GitHub Releases tab (prebuilt mac arm64 / Windows x64 binaries) and local `build.sh`. Does NOT recommend desktop over web.
- **`## Develop the web app locally` section:** Single-paragraph pointer to `web/README.md` for contributors; does not duplicate the `python3 -m http.server` recipe.
- **`## License` section:** Pointer to existing `LICENSE` file.

## Verbatim Carry-Overs (for consistency tracking)

| Source | Phrase / label |
| ------ | -------------- |
| `web/index.html` | `Get MP3 →`, `Audio file`, `Instrument`, `Convert`, `Save MusicXML`, `Download PDF`, `Download SVG`, `Download ABC` |
| `web/index.html` `.warning` | "solo instrument", "one instrument playing one note at a time", "no chords, no backing tracks, no singing over the music, no full bands" |
| `web/index.html` `.tip` | "MP3, WAV, M4A (iPhone voice memos), OGG, and FLAC" (formatting normalized to sentence form) |
| `web/README.md` | The four `## What it uses` bullets and the "All loaded from public CDNs (esm.sh + jsdelivr) on first visit; cached by the browser after." sentence |

## Verification

All automated checks from the plan's `<verify><automated>` block passed:

- `README.md` exists at repo root.
- `fuzzyqbit.github.io/link2notes` appears in the file.
- CTA phrase (`Try it now`) present.
- Pages URL appears in the first 15 lines.
- `Releases` keyword present (satisfies `scripts/build.sh|releases` pattern).
- `flute` and `alto sax` present.
- Monophonic constraint surfaced (`solo instrument`, `one instrument playing one note at a time`).
- Non-heading line references `web/README` (the contributor pointer paragraph).

Manual verification (per plan `<done>` block):
- First 15 lines contain the Pages URL — confirmed (URL appears on line 5).
- Desktop framed as optional with pointers to Releases + `build.sh` — confirmed.
- No deploy-status badge added (deferred to Plan 05-03 per plan instructions).
- Visitor reading only the first screen knows they can use the app without cloning — confirmed (CTA + zero-install copy on lines 3-7).

## Deviations from Plan

### Resolved without intervention

**1. [Rule 3 — Blocking] `scripts/build.sh` referenced by plan does not exist; actual path is `build.sh` at repo root**
- **Found during:** Task 1 (verifying file paths before writing the README).
- **Issue:** The plan's `<action>` block says "local build via `scripts/build.sh`". In this repo the build script lives at `/build.sh` at the root (the only `build.sh` in the tree). Referencing `scripts/build.sh` would be a broken link.
- **Fix:** Used `build.sh` as the canonical path and added a "Also see `scripts/` for related helpers" pointer so curious users still discover the `scripts/` directory (which exists and contains `e2e.py` + `test-downloaders.mjs`). The plan's `must_haves.key_links` regex `scripts/build\.sh|Releases` is satisfied by the explicit `[GitHub Releases tab](https://github.com/fuzzyqbit/link2notes/releases)` link, so plan validation still passes.
- **Files modified:** `README.md` (the wording of the "Desktop app" section).
- **Commit:** `2f3f56b` (same commit as the README itself).

## Files Created

- `/Users/rowan/Documents/Note Converter/README.md` — new root README, 59 lines.

## Files Modified

None.

## Commits

| Commit | Message |
| ------ | ------- |
| `2f3f56b` | `docs(05-01): add root README funneling visitors to live Pages app` |

## Known Stubs

None.

## Threat Flags

None. README adds only outbound markdown links to GitHub-controlled hostnames (`fuzzyqbit.github.io` and `github.com`), which the plan's threat model already accepts.

## Self-Check: PASSED

- `README.md` at repo root — FOUND
- `.planning/phases/05-distribution-discovery/05-01-SUMMARY.md` — written this step
- Commit `2f3f56b` — verified in `git log`
