---
phase: 04-cross-browser-mobile
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - web/style.css
  - web/main.js
autonomous: true
requirements:
  - XPLAT-02
user_setup: []
tags:
  - css
  - responsive
  - mobile
  - abcjs

must_haves:
  truths:
    - "On a 360px-wide viewport, the page has no horizontal scroll"
    - "On a 360px-wide viewport, the rendered score fits the container width (no inner horizontal scrollbar inside .score on phones)"
    - "Tapping the YouTube URL or file input on iOS Safari does NOT trigger the auto-zoom-on-focus behaviour (input computed font-size >= 16px on phones)"
    - "Desktop layout at >640px is visually unchanged"
    - "abcjs renders into a fluid container at any viewport width without overflowing the page"
  artifacts:
    - path: "web/style.css"
      provides: "Mobile breakpoint with fluid .score, 16px inputs, score svg max-width"
      contains: "@media (max-width: 640px)"
    - path: "web/main.js"
      provides: "renderAbc call that no longer hard-codes staffwidth: 740"
      contains: "ABCJS.renderAbc"
  key_links:
    - from: "web/main.js renderResult"
      to: "abcjs.renderAbc"
      via: "container.clientWidth-driven staffwidth (or omitted staffwidth)"
      pattern: "scoreContainer\\.clientWidth|staffwidth"
    - from: "web/style.css .score svg"
      to: "viewport"
      via: "max-width: 100%; height: auto"
      pattern: "\\.score svg"
---

<objective>
Make the deployed web app render cleanly on a phone-sized viewport. Two problems to fix:

1. `web/style.css` `.score { overflow-x: auto; }` combined with `staffwidth: 740` in `main.js` renderAbc means the abcjs SVG is fixed at ~740px wide and scrolls inside its own container on phones — users see a tiny scroll region they can't read.
2. `<input type="file">`, `<input type="url">`, and `<select>` inherit `font: inherit` which resolves to 0.9rem inside `.field`. iOS Safari auto-zooms the viewport when an input with computed font-size <16px is focused — disorienting and ugly.

Purpose: closes XPLAT-02 success criterion ("on a phone viewport, the page has no horizontal scroll, primary controls are reachable with one thumb, and the rendered score pans/zooms readably"). Pure CSS + ~5 LOC JS change. Desktop behaviour preserved.

Output:
- Updated `web/style.css` mobile media query (extends existing `@media (max-width: 640px)` block)
- Updated `web/main.js` `renderResult()` to drop hard-coded staffwidth in favour of container-driven width
- No new files, no new dependencies
</objective>

<execution_context>
@/Users/rowan/.claude/get-shit-done/workflows/execute-plan.md
@/Users/rowan/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@/Users/rowan/Documents/Note Converter/.planning/PROJECT.md
@/Users/rowan/Documents/Note Converter/.planning/ROADMAP.md
@/Users/rowan/Documents/Note Converter/.planning/STATE.md
@/Users/rowan/Documents/Note Converter/.planning/phases/04-cross-browser-mobile/04-RESEARCH.md
@/Users/rowan/Documents/Note Converter/CLAUDE.md
@/Users/rowan/Documents/Note Converter/web/style.css
@/Users/rowan/Documents/Note Converter/web/main.js
@/Users/rowan/Documents/Note Converter/web/index.html

<interfaces>
Key contracts the executor must hit. Extracted from the current codebase so no exploration is needed.

From `web/style.css` (lines to modify / extend):
- Existing rule at lines 306-312: `.score { background: #fff; border: 1px solid var(--border); border-radius: 8px; padding: 12px; overflow-x: auto; }`
- Existing mobile media query at lines 340-342: `@media (max-width: 640px) { .controls { grid-template-columns: 1fr; } }` — extend this block, don't add a second media query at the same breakpoint
- Existing input rule at line 148: `input[type="file"], input[type="url"], select { font: inherit; padding: 8px 10px; border: 1px solid var(--border); border-radius: 8px; background: #fff; }`
- `.field` (line 132) uses `font-size: 0.9rem` — children inherit this, so inputs resolve to ~14.4px on most browsers

From `web/main.js` (lines to modify):
- Lines 191-195, inside `renderResult(result, instrument)`:
  ```
  ABCJS.renderAbc("score", abc, {
    responsive: "resize",
    staffwidth: 740,
    add_classes: true,
  });
  ```
- `scoreEl` is captured at line 21: `const scoreEl = document.getElementById("score");`
- `resultEl` is captured at line 18: `const resultEl = document.getElementById("result");` — the score lives inside the result section which is `hidden=true` until renderResult runs

From `web/index.html`:
- Viewport meta is already present at line 5: `<meta name="viewport" content="width=device-width, initial-scale=1.0" />` — do NOT touch; do NOT add `user-scalable=no` (WCAG violation)
- `<div id="score" class="score"></div>` at line 114

abcjs API:
- `ABCJS.renderAbc(targetId, abcString, options)` — UMD global loaded from CDN at index.html line 9
- `responsive: "resize"` option adds viewBox-based scaling
- `staffwidth` is the engraver's internal staff width in pixels; when set, it overrides the responsive scaling target — that's the bug we're fixing
- Per RESEARCH.md §Common Pitfalls Pitfall 1, the supported pattern is either omit `staffwidth` (abcjs picks default ~740) OR set it from container.clientWidth at render time. We use the container-driven approach because the result section is hidden=true until renderResult, and reading clientWidth after unhide gives us the real layout box width.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Fix score container CSS so SVG is fluid on phones</name>
  <files>web/style.css</files>
  <read_first>
    - web/style.css lines 295-342 (current .downloads, .score, .letters, footer, and existing @media block)
    - .planning/phases/04-cross-browser-mobile/04-RESEARCH.md §Recommended Approach > XPLAT-02 > "Fix the score container (HIGH priority)" — code shape is recommended there
    - .planning/phases/04-cross-browser-mobile/04-RESEARCH.md §Common Pitfalls Pitfall 1 (abcjs responsive + staffwidth interaction)
  </read_first>
  <action>
    Modify `web/style.css` in three coordinated places:

    1. Replace the existing `.score` rule (currently lines 306-312) with a version that adds `-webkit-overflow-scrolling: touch;` for iOS momentum scrolling inside the container, and KEEPS `overflow-x: auto` so desktop users with extra-long scores still get the scroll fallback. Keep all other properties (background, border, border-radius, padding) unchanged.

    2. Add a new `.score svg` rule immediately after the `.score` rule, with `max-width: 100%; height: auto; display: block;`. This is the load-bearing line that lets the abcjs-emitted SVG scale down to fit narrow containers without overflowing.

    3. Extend the EXISTING `@media (max-width: 640px)` block (currently lines 340-342, contains only `.controls { grid-template-columns: 1fr; }`). Add three sibling rules INSIDE the same media query:
       - `.score { overflow-x: hidden; }` — on phones the page is the scroll surface, not the container
       - `.score svg { width: 100%; }` — force fluid (not just max-width)
       - A combined selector `input[type="file"], input[type="url"], select { font-size: 16px; }` — prevents iOS Safari from auto-zooming on input focus (Pitfall 2)

    Do NOT add a second `@media (max-width: 640px)` block — extend the existing one to keep the file scannable. Do NOT change desktop sizing for inputs (the 16px rule lives only inside the media query). Do NOT touch the viewport `<meta>` tag in index.html — it is already correct.

    Constraints from RESEARCH.md: no new dependencies; preserve `user-scalable` default (pinch-zoom must stay enabled per WCAG 2.1 SC 1.4.4); no JS pan/zoom libraries (browser-native is sufficient when the SVG is fluid).
  </action>
  <verify>
    <automated>grep -E "^\.score svg" web/style.css && grep -E "font-size: 16px" web/style.css && grep -E "-webkit-overflow-scrolling: touch" web/style.css && [ "$(grep -c '@media (max-width: 640px)' web/style.css)" = "1" ]</automated>
    <human-check>Open web/index.html in a browser via `python3 -m http.server` from the project root, navigate to `/web/`, run a quick test conversion (any short audio file), then open DevTools and switch to iPhone SE (375x667) mobile emulation. Confirm: (a) no horizontal page scroll, (b) the score SVG fills the available width without an inner horizontal scrollbar, (c) tapping the URL input does not zoom the page in.</human-check>
  </verify>
  <acceptance_criteria>
    - `web/style.css` contains exactly one `@media (max-width: 640px)` block, and that block contains the existing `.controls { grid-template-columns: 1fr; }` rule plus the three new rules listed in the action.
    - The new `.score svg` selector exists at the top level (outside any media query) with `max-width: 100%`.
    - `.score` rule still has `overflow-x: auto` at desktop, and is overridden to `overflow-x: hidden` inside the media query.
    - Input font-size override inside the media query covers `input[type="file"]`, `input[type="url"]`, and `select`.
    - File diff is CSS-only — no other files modified by this task.
  </acceptance_criteria>
  <done>
    `web/style.css` reflects the three changes above; DevTools mobile emulation at 360-375px shows no inner horizontal scrollbar on `.score` and no page-level horizontal scroll; inputs do not trigger iOS auto-zoom (visually verified by the executor in DevTools device-mode preview).
  </done>
</task>

<task type="auto">
  <name>Task 2: Drop hard-coded staffwidth from main.js renderAbc call</name>
  <files>web/main.js</files>
  <read_first>
    - web/main.js lines 180-204 (renderResult function — the only renderAbc call site)
    - web/main.js lines 18-22 (the `scoreEl` and `resultEl` const captures we need to read clientWidth)
    - .planning/phases/04-cross-browser-mobile/04-RESEARCH.md §Code Examples > "renderAbc call that respects container width"
  </read_first>
  <action>
    In `web/main.js` inside `renderResult(result, instrument)` (currently lines 180-203), replace the existing `ABCJS.renderAbc("score", abc, { responsive: "resize", staffwidth: 740, add_classes: true });` call with a container-width-driven version:

    1. BEFORE calling renderAbc, unhide the result section (`resultEl.hidden = false;`) so the score container has a real layout box. The current code sets `resultEl.hidden = false` AFTER renderAbc (line 202) — that ordering must change so we can measure clientWidth.
    2. Read `scoreContainer.clientWidth` (using the already-captured `scoreEl` const at line 21 — no new DOM query needed). Subtract 24 to account for the `.score` 12px padding on each side, and clamp to a minimum of 280 so very narrow viewports still get a usable engraver width: `const containerWidth = Math.max(280, scoreEl.clientWidth - 24);`
    3. Pass that as `staffwidth` to renderAbc, keeping `responsive: "resize"` and `add_classes: true`. The interaction is: abcjs uses staffwidth to lay out the engraver, and `responsive: "resize"` adds the viewBox so CSS `max-width: 100%` (from Plan 04-01 Task 1) lets it scale further if the container later resizes.
    4. The metadata writes (keyInfo, bpmInfo, lettersEl) and the lastResult/lastInstrument captures stay exactly where they are — only the renderAbc call and the resultEl.hidden ordering change.

    Do NOT introduce a window resize listener (out of scope; responsive: "resize" + CSS max-width handles re-flows). Do NOT add a ResizeObserver. Do NOT remove `responsive: "resize"` — Plan 04-01 Task 1's CSS relies on the viewBox it produces.

    Constraints from RESEARCH.md: no new dependencies; do not call any new abcjs option not already documented in its README; preserve the existing `add_classes: true` (other code may rely on the abcjs-added classes for styling/PDF).
  </action>
  <verify>
    <automated>grep -E "scoreEl\.clientWidth" web/main.js && grep -E "Math\.max\(280" web/main.js && ! grep -E "staffwidth: 740" web/main.js && node --check web/main.js</automated>
    <human-check>Reload web/index.html in DevTools at iPhone SE width (375px); run a conversion; the rendered score should fill the score container and remain readable. Then switch DevTools to a desktop viewport (1280px); the score should now render wider, using the full container width up to the max-width: 880px of `main`. No console errors.</human-check>
  </verify>
  <acceptance_criteria>
    - `web/main.js` no longer contains the literal `staffwidth: 740`.
    - The replacement uses `scoreEl.clientWidth` and a Math.max floor of 280.
    - `resultEl.hidden = false` is called BEFORE the renderAbc invocation so clientWidth returns a real measurement (not 0).
    - `responsive: "resize"` and `add_classes: true` are preserved in the options.
    - `node --check web/main.js` exits 0 (no syntax errors).
    - No other JS files modified by this task.
  </acceptance_criteria>
  <done>
    The renderAbc call reads container width at render time; node syntax check passes; DevTools mobile preview shows a score that fits its container without overflow; desktop preview still gets a wide, readable score.
  </done>
</task>

</tasks>

<verification>
1. `grep -c '@media (max-width: 640px)' web/style.css` returns `1` (single media query block, extended in place)
2. `grep 'font-size: 16px' web/style.css` returns the input override rule
3. `grep 'scoreEl.clientWidth' web/main.js` returns the new container-width read
4. `grep 'staffwidth: 740' web/main.js` returns nothing (old fixed value gone)
5. `node --check web/main.js` exits 0
6. Manual DevTools mobile emulation (iPhone SE 375x667): no horizontal page scroll, no inner scroll inside `.score`, inputs do not auto-zoom on focus
7. Manual DevTools desktop viewport (1280x800): score renders at near-container width, layout otherwise unchanged
</verification>

<success_criteria>
- Mobile viewport (<=640px): score fits the page width with no inner scrollbar; inputs do not zoom on focus
- Desktop viewport (>640px): unchanged appearance and behaviour from before this plan
- abcjs renders without console errors on every conversion
- No new dependencies added (CDN list in index.html unchanged)
- Phase 4 success criterion #4 ("On a phone viewport, the page has no horizontal scroll, primary controls reachable with one thumb, and the rendered score pans/zooms readably") is structurally satisfied — Plan 04-03 (test matrix) will confirm on real devices
</success_criteria>

<output>
After completing both tasks, run the verification commands above. Then write a summary to `.planning/phases/04-cross-browser-mobile/04-01-SUMMARY.md` capturing:
- Files modified (web/style.css, web/main.js)
- Net LOC change
- Anything weird or surprising about how abcjs responded to the new options (worth noting for the test matrix in Plan 04-03)
- One-line readiness statement: "Plan 04-03 test matrix can now exercise S2 (no h-scroll), S11 (score readable on phone), and the iOS auto-zoom check on real devices."
</output>
