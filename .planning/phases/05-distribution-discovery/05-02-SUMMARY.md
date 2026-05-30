---
phase: 05-distribution-discovery
plan: 02
subsystem: documentation
tags:
  - documentation
  - distribution
  - readme
dependency_graph:
  requires: []
  provides:
    - web-readme-pages-first
  affects:
    - web/README.md
tech_stack:
  added: []
  patterns:
    - "Lead-with-live-URL framing for user-facing docs"
    - "Demote contributor / maintainer instructions below user-facing content"
key_files:
  created: []
  modified:
    - web/README.md
decisions:
  - "Use ../README.md (relative path) for cross-link to root README — works in GitHub web UI and local clones."
  - "Keep maintainer Settings → Pages walkthrough verbatim but prefix as 'subject to change' since Plan 3 replaces it with an Actions-based deploy."
  - "Drop the throwaway sentence 'That URL is what users search up and run' — the new lead paragraph already conveys this without repetition."
metrics:
  duration: "~1 minute"
  completed: "2026-05-30"
requirements:
  - DIST-01
---

# Phase 05 Plan 02: Web README Reposition Summary

Reordered `web/README.md` so the live GitHub Pages URL (https://fuzzyqbit.github.io/link2notes/) leads the file and contributor / maintainer instructions are demoted below user-facing content. Closes the web/ half of DIST-01.

## What Changed

`web/README.md` was fully rewritten (overwrite, not incremental) — same content, new order. No technical claims removed; only repositioned.

### New section order

1. Title `# Link To Notes — Web Version` (unchanged).
2. Lead paragraph naming the live Pages URL and what the app does. Pages URL appears on line 3 (well within the first-15-lines requirement).
3. Cross-link line: `See the [root README](../README.md) for the full project overview and the desktop app.`
4. `## What it uses` (unchanged bullets: basic-pitch, abcjs, Web Audio API, Krumhansl-Schmuckler).
5. `## Differences from the desktop version` (unchanged bullets).
6. `## Files` (unchanged file index).
7. `## Run locally (contributors)` — demoted; preface "Most users don't need this — open the live URL above. Local dev is only for editing the source." Original `python3 -m http.server 8000` recipe and `file://` warning retained verbatim.
8. `## Maintainer: Deploy to GitHub Pages` — demoted; prefixed with "Current deploy method (subject to change — see `.github/workflows/` for the Actions-based replacement)." Original 4-step Settings → Pages walkthrough retained verbatim.

### Cross-link form used

`../README.md` — relative path from `web/README.md` to the root README created in parallel Plan 05-01. This resolves correctly in both GitHub's web UI and local clones.

### Pages URL placement

Confirmed: `head -15 web/README.md | grep fuzzyqbit.github.io/link2notes` matches on line 3.

### First H2 heading

Verified `awk '/^## /' web/README.md | head -1` returns `## What it uses` — a user-facing section, not "Run locally". Satisfies the plan's headline-ordering constraint.

## Verification

All six plan `<automated>` checks passed:

| Check | Result |
| ----- | ------ |
| Pages URL within first 15 lines | OK |
| `../README.md` (or root README) cross-link present | OK |
| `## What it uses` section retained | OK |
| `## Run locally (contributors)` heading present | OK |
| Maintainer / "Current deploy method" framing present | OK |
| First H2 is NOT "Run locally" | OK (first H2 is `## What it uses`) |

Emoji scan: clean (regex `[\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}]` returned no matches).
Line count: 49 lines (well above the `min_lines: 25` must-have).

## Deviations from Plan

None — plan executed exactly as written.

## Threat Flags

None. The repositioned file introduces no new attack surface: it is a public-by-design Markdown doc, the cross-link is same-repo relative, and the Pages URL is already public.

## Notes for Future Plans

- Plan 05-03 will replace the "Maintainer: Deploy to GitHub Pages" section with a pointer to the new `.github/workflows/pages.yml` Actions-based deploy. The current section is intentionally minimal and labeled "subject to change" to signal this hand-off.
- The cross-link `../README.md` assumes Plan 05-01 (parallel wave) creates `/README.md` at the repo root. If 05-01 fails to land, this link breaks — verifier should check both READMEs as a pair.

## Self-Check: PASSED

- `web/README.md` exists — FOUND
- `.planning/phases/05-distribution-discovery/05-02-SUMMARY.md` exists — FOUND
- Task 1 commit `9ff301c` present in `git log` — FOUND

## Commits

- `9ff301c` — docs(05-02): reposition web/README to lead with live Pages URL
