---
phase: 03-youtube-handoff-polish
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - web/downloaders.js
  - web/main.js
  - scripts/test-downloaders.mjs
autonomous: true
requirements:
  - YT-01
  - YT-03
tags:
  - youtube
  - handoff
  - cobalt
  - downloader-registry

must_haves:
  truths:
    - "Pasting a YouTube URL + clicking Get MP3 opens cobalt.tools in a new tab with the URL prefilled in the hash fragment"
    - "The click handler does NOT lose the iOS user-gesture context — window.open fires synchronously before any clipboard awaits"
    - "The downloader list is a single grep-able source of truth (web/downloaders.js), not hardcoded URLs scattered between main.js and index.html"
    - "Every downloader entry shipping today carries a lastVerified ISO date stamp (no half-checked alternates)"
    - "The node smoke test confirms PRIMARY.urlFor() returns the exact documented cobalt prefill format"
  artifacts:
    - path: "web/downloaders.js"
      provides: "DOWNLOADERS array + PRIMARY reference for the YouTube handoff"
      exports: ["DOWNLOADERS", "PRIMARY"]
      contains: "cobalt.tools"
      min_lines: 20
    - path: "web/main.js"
      provides: "Updated converterUrlFor + iOS-safe click handler + alternates-list renderer"
      contains: "import { PRIMARY"
    - path: "scripts/test-downloaders.mjs"
      provides: "Node smoke test for PRIMARY.urlFor URL construction"
      min_lines: 15
  key_links:
    - from: "web/main.js converterUrlFor()"
      to: "web/downloaders.js PRIMARY"
      via: "ES module import"
      pattern: "PRIMARY\\.urlFor"
    - from: "web/main.js getAudioBtn click handler"
      to: "cobalt.tools tab"
      via: "synchronous window.open inside user-gesture"
      pattern: "window\\.open\\(converterUrlFor"
    - from: "web/main.js (on load)"
      to: "ul#alt-downloaders in index.html"
      via: "defensive document.getElementById + appendChild loop"
      pattern: "alt-downloaders"
---

<objective>
Replace the dead savefrom.net handoff with a working cobalt.tools handoff backed by a single-source-of-truth downloader registry, and fix the iOS-Safari popup-block regression in the click handler.

Purpose: Closes YT-01 (one-click handoff to a working downloader) and the mechanism half of YT-03 (single source of truth for the visible downloader list, with verification dates). Without this, the deployed app's Get MP3 button opens a US-blocked site (savefrom.net, dead since 2020-04-28 — confirmed Phase 1 testing).

Output: A new `web/downloaders.js` module, an edited `web/main.js` that imports from it (replacing the hardcoded URL), and a tiny node smoke test that locks down the cobalt prefill format.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/ROADMAP.md
@.planning/REQUIREMENTS.md
@.planning/phases/03-youtube-handoff-polish/03-RESEARCH.md
@CLAUDE.md
@web/main.js
@web/index.html

<interfaces>
<!-- Existing main.js shape the editor must preserve -->

Existing identifiers in web/main.js (lines 9-71):
- `ytUrlInput` (HTMLInputElement) — `document.getElementById("yt-url")`
- `getAudioBtn` (HTMLButtonElement) — `document.getElementById("get-audio-btn")`
- `converterUrlFor(youtubeUrl)` — currently returns `https://en.savefrom.net/391/?url=${encodeURIComponent(youtubeUrl)}` (lines 55-57). MUST be replaced.
- `getAudioBtn.addEventListener("click", async () => { ... })` (lines 59-71) — currently AWAITs `navigator.clipboard.writeText` BEFORE `window.open`. MUST be reordered.
- `ytUrlInput.addEventListener("keydown", ...)` (lines 73-78) — must keep working (calls `getAudioBtn.click()`).

Existing import style at top of main.js (lines 1-7) — six ES module imports already in use. Add the new `downloaders.js` import alongside.

Cobalt prefill contract (sourced from RESEARCH.md / github.com/imputnet/cobalt web/README):
- Format: `https://cobalt.tools/#${encodeURIComponent(youtubeUrl)}`
- Hash fragment (NOT query string `?url=` — that was an unmerged feature request)
- URL-encoding the YouTube URL is documented and supported

The companion HTML element `<ul id="alt-downloaders">` is owned by Plan 02 (index.html rewrite).
This plan must render into it IF PRESENT, but must NOT crash if absent (parallel-safe with Plan 02).
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Create web/downloaders.js registry + node smoke test</name>
  <files>web/downloaders.js, scripts/test-downloaders.mjs</files>
  <read_first>
    - /Users/rowan/Documents/Note Converter/.planning/phases/03-youtube-handoff-polish/03-RESEARCH.md (sections: Pattern 1 Downloader Registry Module, Pattern 2 Hash-fragment prefill, Code Example 2, Downloader Evaluation Table net recommendation)
    - /Users/rowan/Documents/Note Converter/web/main.js (lines 1-7 — existing ES module import style)
    - /Users/rowan/Documents/Note Converter/scripts (look at any existing test-*.mjs files to match the established node smoke-test pattern from Phases 1-2)
  </read_first>
  <behavior>
    - Test 1: `PRIMARY.urlFor("https://www.youtube.com/watch?v=dQw4w9WgXcQ")` returns the EXACT string `https://cobalt.tools/#https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3DdQw4w9WgXcQ` (hash fragment, fully URL-encoded). This locks down the documented cobalt prefill format against accidental regressions.
    - Test 2: `PRIMARY.id` === "cobalt" — guards against reordering DOWNLOADERS array and silently flipping the primary.
    - Test 3: Every entry in `DOWNLOADERS` has all required fields: `id`, `name`, `urlFor` (function), `landingUrl`, `lastVerified`. The `lastVerified` value matches the ISO date pattern `^\d{4}-\d{2}-\d{2}$`.
    - Test 4: `DOWNLOADERS[0] === PRIMARY` — primary is the head of the array, not a stale reference.
  </behavior>
  <action>
    Create `web/downloaders.js` as a plain static ES module (no bundler, no Node-only APIs, no dynamic imports). It must:

    1. Export `DOWNLOADERS` — an array of objects. Each object has the shape `{ id: string, name: string, note?: string, urlFor: (yt: string) =&gt; string, landingUrl: string, lastVerified: string }`.
    2. The first entry (the primary) is cobalt.tools per the RESEARCH.md Net Recommendation: `id: "cobalt"`, `name: "cobalt.tools"`, `note: "open-source, no ads, no signup — recommended"`, `urlFor: (yt) =&gt; \`https://cobalt.tools/#${encodeURIComponent(yt)}\``, `landingUrl: "https://cobalt.tools"`, `lastVerified: "2026-05-30"`.
    3. Include a top-of-file comment block explaining: (a) what this file is the source of truth for, (b) that DOWNLOADERS.md (created by Plan 02) holds the 5-minute verification ritual, (c) the rule "if an entry fails day-of-ship verification, REMOVE it, do not hide it" (per YT-03 success criterion).
    4. Export `PRIMARY` as `DOWNLOADERS[0]` (not a separate constant — the array head IS the primary, so they stay in sync).
    5. Do NOT add alternates yet. The 03-RESEARCH.md `## Downloader Evaluation Table` flagged candidates (dltkk.to, cnvmp3.com) but explicitly says "verify manually then add to list." Plan 02 wires up the verification ritual and will inform whether alternates ship. For Plan 01, ship cobalt only — "one good link is better than three half-checked ones" (RESEARCH.md net recommendation).

    Create `scripts/test-downloaders.mjs` as a node smoke test matching the established pattern in `scripts/test-storage.mjs` / `scripts/test-pipeline-error.mjs` from Phases 1-2 (assertion style, exit-with-nonzero-on-fail, one-line PASS/FAIL output). Import from `../web/downloaders.js` and run the four behavior tests listed above.

    Implementation order (TDD): write `scripts/test-downloaders.mjs` first with the four assertions, run it, confirm it fails because `web/downloaders.js` does not exist yet. Then create `web/downloaders.js`. Re-run the smoke test, confirm all four pass.
  </action>
  <verify>
    <automated>cd "/Users/rowan/Documents/Note Converter" && node scripts/test-downloaders.mjs</automated>
  </verify>
  <acceptance_criteria>
    - `node scripts/test-downloaders.mjs` exits 0 with PASS output for all four behavior tests
    - `grep -c "^export" web/downloaders.js` returns 2 (DOWNLOADERS array + PRIMARY)
    - `grep -c "cobalt.tools/#" web/downloaders.js` returns at least 1 (the urlFor template)
    - `grep -c "savefrom" web/downloaders.js` returns 0 (no leftover dead site)
    - `grep -c "lastVerified" web/downloaders.js` returns at least 1
    - File is a valid ES module that can be imported by another ES module (smoke test exercises this)
  </acceptance_criteria>
  <done>
    `web/downloaders.js` exists as a working ES module exporting DOWNLOADERS and PRIMARY. `scripts/test-downloaders.mjs` exists and passes all four assertions. Cobalt prefill URL format is locked in by the smoke test (will fail loudly if anyone changes the encoding).
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Wire downloaders.js into main.js + iOS-safe click handler + render alternates</name>
  <files>web/main.js</files>
  <read_first>
    - /Users/rowan/Documents/Note Converter/web/main.js (lines 1-78 — imports, ytUrlInput/getAudioBtn refs, converterUrlFor, click handler, keydown handler)
    - /Users/rowan/Documents/Note Converter/web/downloaders.js (produced by Task 1 — confirms PRIMARY shape)
    - /Users/rowan/Documents/Note Converter/.planning/phases/03-youtube-handoff-polish/03-RESEARCH.md (sections: Pitfall 3 iOS Safari pop-up block, Code Example 1, Code Example 4 click handler, Code Example 3 render alternates block)
  </read_first>
  <behavior>
    - Test 1 (manual via existing keydown path): pressing Enter in the YT URL input invokes the same handler as clicking the button (no regression to existing keydown shortcut at lines 73-78).
    - Test 2 (manual): with a non-empty URL, click triggers `window.open(...)` SYNCHRONOUSLY in the click event tick, before any awaited clipboard write. Empty URL still focuses the input and does nothing else.
    - Test 3 (smoke / static check): the file imports `PRIMARY` and `DOWNLOADERS` from `./downloaders.js`. The string literal `savefrom.net` does not appear anywhere in main.js.
    - Test 4 (smoke / static check): the alternates renderer is guarded with an `if (altList)` check so the file does not throw when `index.html` does not yet have `&lt;ul id="alt-downloaders"&gt;` (Plan 02 is parallel-safe; this code must work whether Plan 02 has shipped or not).
  </behavior>
  <action>
    Edit `web/main.js` in three discrete edits:

    1. **Add the import** at the top with the existing six imports (lines 1-7). New line: `import { PRIMARY, DOWNLOADERS } from "./downloaders.js";`. Place it after the `loadInstrument/saveInstrument` import to group it with the other module imports.

    2. **Replace `converterUrlFor`** at lines 52-57. Delete the existing two-line comment about savefrom.net + the ss-prefix URL hack — it is no longer accurate. New body: `return PRIMARY.urlFor(youtubeUrl);`. Keep the function declaration so the rest of the file's call sites (line 70 inside the click handler) remain unchanged. New short comment above the function: explains that the actual URL construction lives in `downloaders.js` and points at the registry pattern.

    3. **Reorder the click handler** at lines 59-71. Per RESEARCH.md Pitfall 3 + Code Example 4: iOS Safari only allows `window.open` inside the synchronous click handler — awaiting `navigator.clipboard.writeText` first burns the user-gesture and the popup gets blocked. New shape (remove `async` from the arrow function; do not `await` the clipboard call):
       - Read `url = ytUrlInput.value.trim()`. If empty, focus the input and return early (unchanged behavior).
       - Call `window.open(converterUrlFor(url), "_blank", "noopener")` FIRST, on its own line, synchronously.
       - THEN, as fire-and-forget: `if (navigator.clipboard?.writeText) { navigator.clipboard.writeText(url).catch(() =&gt; { /* permission denied — OK, downloader is already prefilled */ }); }`. No try/catch wrapping the whole handler — the open call should run regardless of clipboard outcome.

    4. **Add the alternates renderer** at the END of the module (after the existing `downloadBlob` function at line 460). This block:
       - Looks up `document.getElementById("alt-downloaders")`.
       - If the element is ABSENT (parallel-safe with Plan 02 — Plan 02 owns the HTML rewrite that introduces this element), bail silently with no error.
       - If present, iterate `DOWNLOADERS`. For each entry, create an `&lt;li&gt;` containing an `&lt;a href={landingUrl} target="_blank" rel="noopener"&gt;{name}&lt;/a&gt;`. If the entry has a `note`, append ` — ${note}` as a text node. Append the `&lt;li&gt;` to the list. Use the same DOM-API style already used elsewhere in main.js (createElement / appendChild — no innerHTML, no template strings of HTML).

    Do NOT touch the keydown handler, the convertBtn handler, the renderResult/buildAbc path, or any of the download-* handlers. They are out of scope for this plan.
  </action>
  <verify>
    <automated>cd "/Users/rowan/Documents/Note Converter" && grep -v '^//' web/main.js | grep -v '^\s*//' | grep -c 'savefrom' | xargs -I{} test {} -eq 0 && grep -c 'PRIMARY.urlFor' web/main.js && grep -c 'alt-downloaders' web/main.js && node --check web/main.js && node scripts/test-downloaders.mjs</automated>
  </verify>
  <acceptance_criteria>
    - `grep -v '^//' web/main.js | grep -v '^\s*//' | grep -c 'savefrom'` returns 0 (no leftover dead site reference in executable code; commented-out lines also gone per the action's "delete the existing two-line comment")
    - `grep -c 'savefrom' web/main.js` returns 0 (also gone from comments per action)
    - `grep -c 'PRIMARY.urlFor' web/main.js` returns at least 1
    - `grep -c 'import { PRIMARY' web/main.js` returns exactly 1
    - `grep -c 'alt-downloaders' web/main.js` returns at least 1 (the renderer's getElementById call)
    - `node --check web/main.js` exits 0 (syntactically valid)
    - In the click handler block (lines around 59-71): the `window.open(` call appears textually BEFORE any `navigator.clipboard` call. Verify with: `awk '/getAudioBtn.addEventListener/,/^\}\);$/' web/main.js | grep -n -E '(window\.open|navigator\.clipboard)'` — first match must be `window.open`.
    - The click handler arrow function is no longer marked `async` (no `async () =>` for the getAudioBtn handler). Verify: `grep -A1 'getAudioBtn.addEventListener' web/main.js | grep -c 'async'` returns 0.
    - `node scripts/test-downloaders.mjs` still passes (Task 1 contract unbroken)
  </acceptance_criteria>
  <done>
    The Get MP3 button now points at cobalt.tools (via downloaders.js), the click handler is iOS-Safari-safe (window.open synchronous first), and the alternates renderer is in place but defensive. main.js still loads in the browser without errors. The smoke test from Task 1 still passes.
  </done>
</task>

</tasks>

<verification>
After both tasks complete:

1. **Static checks (automated):**
   - `node --check web/main.js` exits 0
   - `node --check web/downloaders.js` exits 0
   - `node scripts/test-downloaders.mjs` passes all four assertions
   - `grep -c savefrom web/main.js web/downloaders.js` returns 0 across both files
   - `grep -c "cobalt.tools/#" web/downloaders.js` returns at least 1

2. **Behavior check (manual, deferred to phase verification):**
   - Open `web/index.html` in a browser
   - Paste `https://www.youtube.com/watch?v=dQw4w9WgXcQ` into the YT URL input
   - Click "Get MP3 →"
   - A new tab opens at `https://cobalt.tools/#https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3DdQw4w9WgXcQ`
   - The cobalt input field is prefilled with the YouTube URL (cobalt may begin processing automatically — that is documented cobalt behavior, not a bug)

3. **iOS gesture check (deferred to Phase 4 cross-browser pass):**
   - On iOS Safari: same flow, popup must not be blocked. If the popup IS blocked, the diagnosis is that `window.open` is no longer synchronous — re-check Task 2 acceptance criteria for handler ordering.
</verification>

<success_criteria>
- `web/downloaders.js` exists, exports DOWNLOADERS + PRIMARY, locks down cobalt prefill format
- `web/main.js` no longer references savefrom.net anywhere; imports from downloaders.js
- Click handler calls `window.open` synchronously first (iOS-safe)
- Alternates renderer is present and defensive (parallel-safe with Plan 02)
- `scripts/test-downloaders.mjs` passes
- Closes YT-01 (mechanism) + the registry half of YT-03
</success_criteria>

<output>
Create `.planning/phases/03-youtube-handoff-polish/03-01-SUMMARY.md` when done.
</output>
