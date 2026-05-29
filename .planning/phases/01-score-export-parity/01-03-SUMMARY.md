---
phase: 01-score-export-parity
plan: 03
subsystem: web/export
tags: [pdf, export, popup-fallback, ios-safari]
requires: [01-01, 01-02]
provides:
  - printScore router (web/main.js)
  - printInWindow helper (web/main.js)
  - printInIframe helper (web/main.js)
  - escapeHtml helper (web/main.js)
affects:
  - web/main.js (#download-pdf click handler)
tech_stack:
  added: []
  patterns: [popup-with-iframe-fallback, document.write-print-shim]
key_files:
  created: []
  modified:
    - web/main.js
decisions:
  - "Kept escapeHtml local to main.js instead of importing from musicxml.js — Plans 02 and 03 are parallel-shippable and must not depend on each other."
  - "Bumped popup setTimeout from 200ms to 500ms per RESEARCH.md §iOS Safari blank-preview pitfall."
  - "Iframe cleanup uses 1000ms after print() so the browser has time to capture the print dialog before the iframe is detached."
  - "Used inline `.style.X = '...'` instead of a CSS class for the iframe — no shared stylesheet dependency, no specificity surprises."
metrics:
  duration: ~5min
  completed: "2026-05-28"
  commits:
    - 7cb4d78: feat(01-03) harden PDF export with iframe fallback + iOS Safari fix
status: awaiting-human-verification
---

# Phase 01 Plan 03: PDF Hardening Summary

PDF export now survives popup blockers (hidden iframe fallback), avoids iOS Safari's blank-preview quirk (500ms delay + early document.close), and surfaces specific user-facing errors for every known failure mode instead of swallowing the click.

## What Was Built

`web/main.js` was extended with four new pieces and one rewrite:

1. **`escapeHtml(s)`** — module-scope helper that XML-escapes `&`, `<`, `>`, `"`, `'`. Local to main.js by design (Plans 02 and 03 are independently shippable, so plan 03 does not import the equivalent escape from `musicxml.js`).
2. **`printInWindow(win, xml, title)`** — writes the print HTML into an opened popup. Title goes through `escapeHtml`. `win.document.close()` is called before the inline `<script>` runs, and the inline `setTimeout` waits 500ms (was 200ms) before calling `window.print()`.
3. **`printInIframe(xml, title)`** — popup-blocker fallback. Creates an `<iframe>` styled `position: fixed; right: 0; bottom: 0; width: 0; height: 0; border: 0;`, appends to `document.body`, opens its `contentDocument`, writes the same HTML the popup branch uses, closes, then schedules `setTimeout(() => { focus(); print(); setTimeout(() => iframe.remove(), 1000); }, 250)`.
4. **`printScore(xml, title)`** — router. Tries `window.open("", "_blank")` inside try/catch (some browsers throw instead of returning null). If a window is obtained, delegates to `printInWindow`. Otherwise wraps `printInIframe` in try/catch and surfaces `showError("Couldn't open the print dialog. Try the SVG download instead.")` on a thrown error.
5. **`#download-pdf` click handler rewrite** — replaced the silent `if (!svgEl) return` with `showError("Run a conversion first, then export PDF.")`, then delegates to `printScore(xml, lastTitle)` for everything else.

No other download handler was touched. No new imports were added. No HTML changes (the `#download-pdf` button already exists).

## Verification Results

All 6 automated verify commands from the plan pass:

| # | Check | Result |
|---|-------|--------|
| 1 | `function printInIframe` + `printInWindow` + `printScore` all defined | OK |
| 2 | "Run a conversion first, then export PDF." present | OK |
| 3 | "Couldn't open the print dialog" present | OK |
| 4 | 3+ `setTimeout` calls (popup 500ms, iframe 250ms, cleanup 1000ms) | OK (3 found) |
| 5 | `escapeHtml` present | OK |
| 6 | `position: fixed` + `createElement("iframe")` present | OK |

Smoke checks beyond the plan:
- `node --check web/main.js` — passes (no syntax errors).
- `grep` confirms `#download-musicxml`, `#download-abc`, `#download-svg` handlers untouched (no cross-handler regression at the source level).
- Post-commit `git diff --diff-filter=D HEAD~1 HEAD` — no unintended deletions.

## Deviations from Plan

None — plan executed exactly as written.

## Authentication Gates

None.

## Known Stubs

None.

## Checkpoint Awaiting Human Verification (Task 2)

**Type:** checkpoint:human-verify (blocking gate)

**Why this gate exists:** The hardening is for failure modes that automated checks cannot fully simulate — actual popup blocker behavior, the iOS Safari print preview, and the visual confirmation that the print dialog actually opens with the score visible.

**How to verify:**

1. Serve the web app: `python3 -m http.server 8000 --directory web`
2. Open `http://localhost:8000/` in Chrome desktop.
3. **Happy path (popup allowed).** Allow popups for `localhost:8000`.
   - Run a real conversion with any short audio clip and any instrument.
   - Click **Download PDF**. A new tab should open with the score; the print dialog should appear within ~1 second.
   - Cancel the print dialog; confirm the new tab's title is the source filename minus extension and the SVG is sized to letter paper.
   - Close the tab. Confirm no error panel appears on the main page.
4. **Popup-blocked path.** Block popups for `localhost:8000` (Chrome address-bar icon → Pop-ups blocked, or Settings → Site settings → Pop-ups and redirects → Block).
   - Reload, run a conversion, click **Download PDF**.
   - The print dialog should still appear (driven by the hidden iframe). Cancel it.
   - In DevTools Elements panel, search for `iframe` — verify any added iframe has been removed within a couple of seconds (1000ms cleanup setTimeout).
   - No error panel should appear if the iframe path worked.
5. **Before-conversion error.** Reload (no score rendered). Click **Download PDF** without converting first.
   - Verify the red error panel shows exactly: **"Run a conversion first, then export PDF."**
   - No print dialog, no tab.
6. **iOS Safari smoke (if available).** Visit the running localhost via local network IP, or push to a test branch and use the deployed GitHub Pages URL.
   - Run a conversion, tap **Download PDF**.
   - iOS print preview should appear with the score visible (not blank). If blank, the 500ms timeout is still too short — flag for follow-up.
   - Optional: pinch out on the preview thumbnail to reach iOS's Save to Files → PDF flow.
7. **Cross-handler smoke.** Confirm Plan 02's "Save MusicXML" button still works; confirm SVG and ABC downloads still work. None should be affected by Plan 03.

**Resume signal:** Type "approved" if all four paths (happy popup, blocked popup → iframe, before-conversion error, iOS smoke if available) work as described. Otherwise describe what failed (e.g., "iframe doesn't print on Safari", "iOS still blank after 500ms").

## Threat Flags

None — no new threat surface introduced. The popup and iframe are same-origin (about:blank we wrote to); the title we inject is XML-escaped via `escapeHtml`; the SVG content is generated by abcjs from our own ABC string (no user-controlled SVG enters the pipeline).

## Files Modified

- `web/main.js` (+90 lines, -8 lines): added `escapeHtml`, `printInWindow`, `printInIframe`, `printScore`; rewrote `#download-pdf` click handler.

## Commits

| Hash | Type | Message |
|------|------|---------|
| 7cb4d78 | feat | feat(01-03): harden PDF export with iframe fallback + iOS Safari fix |

## Self-Check: PASSED

- `web/main.js` exists and contains all four new functions.
- Commit `7cb4d78` exists on `worktree-agent-a7bc44fb84541b4a9`.
- All 6 `<automated>` verify commands echoed OK.
- `node --check web/main.js` passes.
- No regression to `#download-musicxml`, `#download-abc`, `#download-svg` handlers.
