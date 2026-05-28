---
phase: 01-score-export-parity
plan: 03
type: execute
wave: 3
depends_on: ["01-01", "01-02"]
files_modified:
  - web/main.js
autonomous: false
requirements: [PAR-02]

must_haves:
  truths:
    - "Clicking 'Download PDF' after a successful conversion opens the browser print dialog with the score laid out on the page"
    - "If the browser blocks the popup window, the export still works — a hidden in-page iframe handles the print instead of failing"
    - "On iOS Safari, the print pathway does not produce a blank preview (the timing before window.print() is sufficient)"
    - "If the user clicks 'Download PDF' before a successful conversion, they see a specific message ('Run a conversion first, then export PDF.') instead of a silent failure"
    - "If both popup AND iframe fail, the user sees 'Couldn't open the print dialog. Try the SVG download instead.' (not a silent failure)"
    - "PDF print path does not regress: existing successful flow (popup allowed, score rendered, print dialog) continues to work"
  artifacts:
    - path: "web/main.js"
      provides: "printScore(xml, title) router + printInWindow + printInIframe helpers"
      contains: "printInIframe"
  key_links:
    - from: "web/main.js #download-pdf handler"
      to: "printScore() router"
      via: "click handler delegates to printScore which tries popup then iframe"
      pattern: "printScore\\("
    - from: "printInIframe"
      to: "document.body"
      via: "creates hidden iframe, document.write SVG + print CSS, focus + print, cleanup"
      pattern: "createElement\\(['\"]iframe['\"]\\)"
---

<objective>
Harden the PDF export pathway so popup-blocked browsers and iOS Safari still produce a working print dialog, and so every failure mode shows a specific user-facing error instead of a silent failure.

Purpose: The current popup-based print works in the happy path but breaks under three real conditions users will hit: popup blockers, iOS Safari's first-print-blank quirk, and the "no SVG yet" race. PAR-02 says "user can export the rendered score as PDF" — making it actually work on iPhones (Phase 4's primary target device) is the missing piece. This plan is independent of Plan 2 (MusicXML) and runs in parallel with it.

Output: A `printScore(xml, title)` router that tries `window.open` first (preserves the current re-printable tab UX), falls back to an invisible iframe when the popup is blocked, and surfaces specific errors for each failure category.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/ROADMAP.md
@.planning/REQUIREMENTS.md
@.planning/phases/01-score-export-parity/01-RESEARCH.md
@.planning/phases/01-score-export-parity/01-01-SUMMARY.md
@CLAUDE.md
@web/main.js
@web/index.html

<interfaces>
<!-- Key contracts the executor needs. Extracted from the current main.js and RESEARCH.md §PDF Hardening Deep Dive. -->

Current PDF handler (web/main.js lines 252-273):
```
document.getElementById("download-pdf").addEventListener("click", () => {
  const svgEl = scoreEl.querySelector("svg");
  if (!svgEl) return;  // silent failure — REPLACE
  const xml = new XMLSerializer().serializeToString(svgEl);
  const win = window.open("", "_blank");
  if (!win) {
    showError("Pop-up blocked — allow pop-ups for this site to export PDF.");
    return;  // no fallback — REPLACE with iframe
  }
  win.document.write(`...<script>window.onload = () => setTimeout(() => window.print(), 200);<\/script>...`);
  win.document.close();
});
```

Hardened pathway (per RESEARCH.md §PDF Hardening Deep Dive):
1. Guard: `if (!svgEl) -> showError("Run a conversion first, then export PDF.")` — specific copy, not silent return.
2. Try popup: `window.open("", "_blank")`. If non-null, write the same print HTML the current code does, BUT bump the `setTimeout` from 200ms to 500ms and call `win.document.close()` BEFORE the script tag runs (per RESEARCH.md §What can break #1, iOS Safari needs `document.close()` then a longer setTimeout).
3. If popup is null OR throws, fall back to `printInIframe(xml, title)`:
   - Create `<iframe>` with fixed-position 0×0 styling so it doesn't disrupt layout.
   - Append to body. Get `iframe.contentDocument`. `doc.open(); doc.write(...full HTML with SVG + print CSS...); doc.close();`.
   - `setTimeout(() => { iframe.contentWindow.focus(); iframe.contentWindow.print(); setTimeout(() => iframe.remove(), 1000); }, 250);`.
   - Wrap iframe call in try/catch — if it throws, call `showError("Couldn't open the print dialog. Try the SVG download instead.")`.
4. CSS in both windows: `@page { size: letter; margin: 0.5in; } body { margin: 0; font-family: sans-serif; } svg { width: 100%; height: auto; }` (matches current code).
5. HTML escape `title` before injection (current code uses `escapeAbc` which only handles newlines — use a real escapeXml for the popup's `<title>` tag).

Reusable existing helpers in web/main.js:
- `showError(msg)`: red panel, shown
- `scoreEl`: the `#score` div containing the rendered SVG

XML escape: write a tiny local `escapeHtml(s)` helper IN this plan (do NOT import from musicxml.js — Plans 2 and 3 are parallel and must not depend on each other). Three lines: replace `&`, `<`, `>`, `"`, `'`.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Refactor PDF handler into printScore router + popup + iframe fallback</name>
  <files>web/main.js</files>
  <read_first>
    - web/main.js (the existing #download-pdf click handler at lines 252-273; the existing `showError` helper at lines 103-106; the `escapeAbc` helper at lines 230-232 for reference)
    - .planning/phases/01-score-export-parity/01-RESEARCH.md (sections: "PDF Hardening Deep Dive" in full, especially §Hardening recommendations A, B, C; "Pitfall 4: iOS Safari prints blank page from popup")
    - web/index.html (the existing `#download-pdf` button — no changes needed there)
  </read_first>
  <action>
    Edit `web/main.js` to replace the current `#download-pdf` click handler implementation. Three additions and one rewrite:

    1. Add a local helper `escapeHtml(s)` at module scope (near `escapeAbc`):
       Replaces `&`, `<`, `>`, `"`, `'` with their named XML entities. Use a single regex replace per RESEARCH.md §Implementation Notes. Three-five lines of code.

    2. Add `printInWindow(win, xml, title)` function:
       - Writes the same HTML the current handler writes, with two changes:
         - Title tag uses `escapeHtml(title)` instead of `escapeAbc(title)`.
         - The setTimeout inside the popup's inline script is `500` not `200`, AND `win.document.close()` is called BEFORE the script runs (move the `win.document.close()` call from outside the write to a position where the loaded document closes before triggering print). The structure: `win.document.write(...); win.document.close(); /* the inline <script> with setTimeout 500 runs on its own */`.
       - Returns nothing; side effects only.

    3. Add `printInIframe(xml, title)` function:
       - Creates an iframe with these styles (set via `.style.X = "..."` to avoid CSS conflicts): `position: fixed; right: 0; bottom: 0; width: 0; height: 0; border: 0;`.
       - Appends to `document.body`.
       - `const doc = iframe.contentDocument; doc.open(); doc.write(\`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>@page { size: letter; margin: 0.5in; } body { margin: 0; font-family: sans-serif; } svg { width: 100%; height: auto; }</style></head><body>${xml}</body></html>\`); doc.close();`.
       - After write+close, schedule `setTimeout(() => { try { iframe.contentWindow.focus(); iframe.contentWindow.print(); } catch (e) { /* dialog cancelled or blocked */ } setTimeout(() => iframe.remove(), 1000); }, 250);` — note the 1000ms cleanup gives the browser time to capture the dialog before the iframe is removed.
       - Returns nothing.

    4. Add `printScore(xml, title)` function that routes:
       - Try popup: `let win; try { win = window.open("", "_blank"); } catch { win = null; }`.
       - If `win`: call `printInWindow(win, xml, title)`. Return.
       - Else fallback: wrap `printInIframe(xml, title)` in try/catch. On thrown error, call `showError("Couldn't open the print dialog. Try the SVG download instead.")`.

    5. REWRITE the `#download-pdf` click handler (currently lines 252-273) to:
       - Get `svgEl = scoreEl.querySelector("svg")`.
       - If null, call `showError("Run a conversion first, then export PDF.")` and return. (REPLACES the current silent `return`.)
       - Compute `xml = new XMLSerializer().serializeToString(svgEl)`.
       - Call `printScore(xml, lastTitle)`. Done.

    Do NOT change any other download handler. Do NOT touch index.html (the button already exists). Do NOT add new imports.
  </action>
  <verify>
    <automated>grep -q 'function printInIframe' web/main.js && grep -q 'function printInWindow' web/main.js && grep -q 'function printScore' web/main.js && echo OK</automated>
    <automated>grep -q 'Run a conversion first, then export PDF' web/main.js && echo OK</automated>
    <automated>grep -q "Couldn't open the print dialog" web/main.js && echo OK</automated>
    <automated>N=$(grep -c 'setTimeout' web/main.js); if [ "$N" -lt 3 ]; then echo "FAIL: expected 3+ setTimeouts (popup 500ms, iframe 250ms, cleanup 1000ms), got $N"; exit 1; fi; echo OK</automated>
    <automated>grep -q 'escapeHtml' web/main.js && echo OK</automated>
    <automated>grep -q 'position: fixed' web/main.js && grep -q 'createElement("iframe")' web/main.js && echo OK</automated>
  </verify>
  <acceptance_criteria>
    - `web/main.js` defines `escapeHtml`, `printInWindow`, `printInIframe`, and `printScore` functions.
    - `#download-pdf` handler delegates to `printScore` after a non-silent guard for missing SVG.
    - Popup branch uses 500ms setTimeout (not 200ms) and closes document before script runs.
    - Iframe branch uses fixed 0×0 styling, document.open/write/close, 250ms before print, 1000ms before cleanup.
    - Both fallback failures surface specific error messages via `showError`.
    - No regression to SVG, ABC, or MusicXML (Plan 2) download handlers.
  </acceptance_criteria>
  <done>
    PDF handler is hardened against popup blockers and iOS Safari quirks; all known failure modes surface specific copy.
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 2: Manual verify — PDF works with popup allowed, popup blocked, and before-conversion</name>
  <what-built>
    A PDF export that survives popup blockers (via hidden iframe fallback) and surfaces specific errors instead of silent failures.
  </what-built>
  <how-to-verify>
    1. Serve the web app: `python3 -m http.server 8000 --directory web`.
    2. Open `http://localhost:8000/` in Chrome desktop.
    3. **Happy path (popup allowed).** Make sure popups are allowed for `localhost:8000` (site settings).
       - Run a real conversion with any short audio clip and any instrument.
       - Click **Download PDF**. A new tab opens with the score laid out; the browser print dialog appears automatically within ~1 second.
       - Cancel the print dialog and inspect the new tab — the score SVG is visible and sized to fit the page. Confirm the tab's title is the source filename minus extension.
       - Close the tab. Confirm no error panel appears on the main page.
    4. **Popup-blocked path.** Block popups for localhost (Chrome: address-bar icon -> Pop-ups blocked OR Settings -> Site settings -> Pop-ups and redirects -> Block).
       - Reload the page and run a conversion again.
       - Click **Download PDF**. The print dialog should still appear (driven by an invisible iframe). Cancel it.
       - In DevTools Elements, search for `iframe` — verify any added iframe has been removed within a couple of seconds after the print dialog closed (cleanup setTimeout).
       - No error panel should appear if the iframe path worked.
    5. **Before-conversion error.** Reload the page (so no score is rendered). Click **Download PDF** WITHOUT running a conversion.
       - Verify the red error panel shows exactly: "Run a conversion first, then export PDF."
       - No print dialog appears, no tab opens.
    6. **iOS Safari smoke (if available).** On an iPhone, navigate to the running localhost (via local network IP) OR push to a test branch and use the deployed GitHub Pages URL.
       - Run a conversion (any short audio file).
       - Tap **Download PDF**. The iOS print preview should appear with the score visible (not blank). If blank, the 500ms timeout is still too short — flag in summary for follow-up.
       - Optional: pinch out on the preview thumbnail to reach iOS's "Save to Files" -> PDF flow.
    7. **Cross-handler smoke.** Confirm Plan 2's "Save MusicXML" button (if Plan 2 has merged) still works. Confirm SVG and ABC downloads still work. None of these should be affected by Plan 3.
  </how-to-verify>
  <resume-signal>Type "approved" if all four paths (happy popup, blocked popup -> iframe, before-conversion error, iOS smoke if available) work as described. Otherwise describe what failed (e.g., "iframe doesn't print on Safari", "iOS still blank after 500ms").</resume-signal>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Main page -> popup window | Popup is `_blank`, same-origin (about:blank we wrote to). No remote URL involved. |
| Main page -> hidden iframe | Iframe is same-origin, content written by us. The SVG it embeds is generated by abcjs from our own data. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-01-06 | Spoofing | The popup window could in theory host attacker content | accept | We open with `""` URL (about:blank) and immediately `document.write` our own HTML. No remote navigation. The title we inject is user-supplied — XML-escaped via `escapeHtml`. |
| T-01-07 | Tampering | Untrusted SVG content from abcjs serialized into popup/iframe HTML | accept | abcjs SVG output is generated from our own ABC string (which we built); no user-controlled SVG enters the pipeline. The XMLSerializer step does not re-introduce script tags. |
| T-01-08 | Denial of Service | Repeated PDF clicks could leak iframes if cleanup setTimeout misses | mitigate | 1000ms cleanup after print is set per click. If user spams the button, multiple iframes will accumulate briefly but each cleans up independently. Acceptable for the MVP. |
| T-01-09 | Information Disclosure | Title in popup `<title>` and `<work-title>` may contain user filename | mitigate | `escapeHtml` runs on title before injection (prevents script injection via filename). |
</threat_model>

<verification>
- Popup-allowed path opens print dialog within 1 second; preview shows the SVG sized to letter paper.
- Popup-blocked path still opens a print dialog (via iframe); no error panel shown.
- Click-before-conversion shows the specific copy "Run a conversion first, then export PDF."
- iOS Safari (when tested) shows a non-blank print preview.
- DevTools shows no orphaned iframes after the print flow completes (cleanup setTimeout works).
</verification>

<success_criteria>
PAR-02 satisfied: "User can export the rendered score as PDF from the web app (via browser print → Save as PDF)" — specifically:
1. Print dialog opens reliably from the happy path.
2. Popup-blocker fallback (hidden iframe) keeps the path working when window.open is denied.
3. Errors at every known failure point surface a specific user-facing message instead of a silent failure.
4. iOS Safari path produces a non-blank print preview (verified visually).
</success_criteria>

<output>
On completion, write `.planning/phases/01-score-export-parity/01-03-SUMMARY.md` per the summary template. If the iOS smoke test was skipped (no device available), note it explicitly so Phase 4 (cross-browser) picks it up.
</output>
