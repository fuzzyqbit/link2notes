---
phase: 02-instrument-persistence-error-handling
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - web/storage.js
  - web/main.js
autonomous: false
requirements: [PAR-03]
tags: [persistence, localStorage, instrument-dropdown, web]

must_haves:
  truths:
    - "After selecting tenor sax and reloading the page, the dropdown still reads 'Tenor Saxophone (Bb)'"
    - "After selecting flute and reloading the page, the dropdown still reads 'Flute'"
    - "On first-ever visit (no saved value), the dropdown defaults to 'Alto Saxophone (Eb)'"
    - "If localStorage is unavailable (Safari private mode, cookies-off), the page loads without throwing and falls back to altoSax"
    - "If a saved value names an unknown/removed instrument, the dropdown silently falls back to altoSax"
  artifacts:
    - path: web/storage.js
      provides: "loadInstrument / saveInstrument / storageAvailable helpers, no-throw, key namespaced linkToNotes.instrument"
      exports: ["loadInstrument", "saveInstrument"]
      min_lines: 25
    - path: web/main.js
      provides: "Restore-on-load + save-on-change wiring around #instrument-select"
      contains: "loadInstrument"
  key_links:
    - from: web/main.js
      to: web/storage.js
      via: "import { loadInstrument, saveInstrument } from './storage.js'"
      pattern: "from \"./storage.js\""
    - from: "#instrument-select change event"
      to: "localStorage.setItem('linkToNotes.instrument', ...)"
      via: "saveInstrument(instSelect.value)"
      pattern: "saveInstrument"
    - from: "Module top-level dropdown init"
      to: "localStorage.getItem('linkToNotes.instrument')"
      via: "loadInstrument() guarded by INSTRUMENTS[saved] validation"
      pattern: "loadInstrument\\(\\)"
---

<objective>
Implement PAR-03: persist the user's last-selected instrument across page reloads using localStorage.

Purpose: User picks tenor sax, closes the tab, comes back tomorrow — the dropdown still says tenor sax. Removes the most common micro-friction in the app (every visit forced back to altoSax default).

Output: New `web/storage.js` helper module + two small wiring edits in `web/main.js` (restore after dropdown population, save on `change`). Zero new CDN imports, no build step, no schema for localStorage values. Survives Safari private mode and quota-exceeded by silently falling back.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/REQUIREMENTS.md
@.planning/phases/02-instrument-persistence-error-handling/02-RESEARCH.md
@.planning/phases/01-score-export-parity/01-VERIFICATION.md
@CLAUDE.md

<!-- Files this plan touches (read before editing) -->
@web/main.js
@web/instruments.js
@web/index.html

<interfaces>
<!-- Source-of-truth contracts the executor must NOT invent. -->

From web/instruments.js — INSTRUMENTS is a keyed object; missing keys return undefined:
- INSTRUMENTS["altoSax"]  -> { label: "Alto Saxophone (Eb)", ... }
- INSTRUMENTS["bogus"]    -> undefined
- INSTRUMENT_ORDER         -> ["flute","clarinet","bassClarinet","altoSax","tenorSax","bariSax"]

From web/main.js (current state — DO NOT delete the dropdown population loop):
- Line 3:  import { INSTRUMENTS, INSTRUMENT_ORDER } from "./instruments.js";
- Lines 29-35: for-loop populates instSelect from INSTRUMENT_ORDER
- Line 36:  instSelect.value = "altoSax";   <-- this is the line to replace
- Line 11:  const instSelect = document.getElementById("instrument-select");

From #instrument-select — DOM contract from web/index.html:74:
- <select id="instrument-select"></select>  (empty, populated by JS)

localStorage namespacing (per RESEARCH.md):
- Key: "linkToNotes.instrument"  (NOT bare "instrument" — GitHub Pages shares origin across project paths)
- Value: one of the strings in INSTRUMENT_ORDER, or absent
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Create web/storage.js with no-throw localStorage helpers</name>
  <read_first>
    - /Users/rowan/Documents/Note Converter/web/instruments.js (INSTRUMENT_ORDER reference — but storage.js stays independent of it; validation lives at the call site in main.js)
    - /Users/rowan/Documents/Note Converter/.planning/phases/02-instrument-persistence-error-handling/02-RESEARCH.md (sections "PAR-03 — Instrument persistence" and "web/storage.js skeleton")
    - /Users/rowan/Documents/Note Converter/CLAUDE.md (Static ES modules + CDN-only constraint — storage.js MUST be a plain ES module with no imports)
  </read_first>
  <behavior>
    - Test 1: storageAvailable() returns true when a stub localStorage supports setItem/getItem/removeItem without throwing.
    - Test 2: storageAvailable() returns false when setItem throws (Safari private mode / cookies-off simulation).
    - Test 3: loadInstrument() returns null when storageAvailable() is false.
    - Test 4: loadInstrument() returns the saved string when localStorage.getItem returns a non-null value.
    - Test 5: loadInstrument() returns null when getItem throws (catch silently).
    - Test 6: saveInstrument("tenorSax") writes to localStorage under key "linkToNotes.instrument" when storage is available.
    - Test 7: saveInstrument(id) silently no-ops when storageAvailable() is false (no throw escapes).
    - Test 8: saveInstrument(id) silently catches a QuotaExceededError from setItem (no throw escapes).
  </behavior>
  <action>
    Create new file `web/storage.js` (plain ES module, no imports, no CDN deps).

    Required exports: `loadInstrument()` and `saveInstrument(id)`. Internal helper `storageAvailable()` (not exported — keep module surface minimal).

    Key constant: `const KEY = "linkToNotes.instrument";` — the namespaced localStorage key. Do NOT use a bare "instrument" key — GitHub Pages shares origin across project paths so collisions with other repos on `*.github.io` are real.

    `storageAvailable()` implements the MDN-canonical probe: try setItem of a sentinel value (e.g. "__lt2n_test__") + removeItem, return true on success, catch any throw and return false. This catches Safari private mode (QuotaExceededError on setItem) without leaking an exception.

    `loadInstrument()`: if `!storageAvailable()` return null; otherwise try `localStorage.getItem(KEY)` inside try/catch and return null on throw. Returns the raw string or null — value validation against `INSTRUMENTS` is the caller's job (main.js).

    `saveInstrument(id)`: if `!storageAvailable()` return (no-op); otherwise try `localStorage.setItem(KEY, id)` inside try/catch and swallow on throw (quota-exceeded, mid-session storage disable). Never throws.

    Persistence is an enhancement, NOT a requirement — every operation must be no-throw. The UI must keep working even if storage is completely broken.

    Create a sibling node smoke test runner at `web/storage.test.cjs` (CommonJS so it runs as a plain `node` script without ESM gymnastics; import the ESM module via dynamic `import()`). Cover all 8 behaviors from the `<behavior>` block above using a hand-rolled `global.localStorage` stub that exposes setItem/getItem/removeItem and lets each test swap implementations (throwing stubs for failure-path tests). After each test, clear `global.localStorage`. Test runner: print "OK <test-name>" per pass, exit non-zero on any failure. Mirror the Phase 1 musicxml smoke-test style (no test framework — plain `assert` from node stdlib).
  </action>
  <verify>
    <automated>cd "/Users/rowan/Documents/Note Converter" && node --check web/storage.js && node web/storage.test.cjs</automated>
  </verify>
  <acceptance_criteria>
    - File `web/storage.js` exists.
    - `grep -c '^export ' web/storage.js` returns at least 2 (loadInstrument + saveInstrument).
    - `grep -c 'linkToNotes.instrument' web/storage.js` returns at least 1 (the namespaced key constant).
    - `grep -c 'try' web/storage.js` returns at least 3 (storageAvailable, loadInstrument, saveInstrument each have try/catch).
    - `grep -v '^\s*//' web/storage.js | grep -c 'throw' ` returns 0 (no throw statements in non-comment lines — module is no-throw).
    - `grep -c 'import ' web/storage.js` returns 0 (zero external imports — pure-platform module).
    - `node --check web/storage.js` exits 0 (valid ES module syntax).
    - `node web/storage.test.cjs` exits 0 and prints "OK" for each of the 8 behavior tests.
    - File `web/storage.test.cjs` exists with at least 8 `assert` calls.
  </acceptance_criteria>
  <done>
    storage.js exports loadInstrument + saveInstrument; both are no-throw; smoke test covers happy path, private-mode (setItem throws), quota-exceeded (mid-session throw), unknown-key (null return), and key namespacing.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Wire restore-on-load + save-on-change in web/main.js</name>
  <read_first>
    - /Users/rowan/Documents/Note Converter/web/main.js (full file — Task modifies lines 3-6 import block and lines 29-36 dropdown init region)
    - /Users/rowan/Documents/Note Converter/web/storage.js (created in Task 1 — exports loadInstrument, saveInstrument)
    - /Users/rowan/Documents/Note Converter/web/instruments.js (INSTRUMENTS keyed object — used to validate restored value)
    - /Users/rowan/Documents/Note Converter/.planning/phases/02-instrument-persistence-error-handling/02-RESEARCH.md (section "main.js diff sketch")
  </read_first>
  <behavior>
    - Test 1: After saveInstrument("tenorSax") then page reload, instSelect.value === "tenorSax".
    - Test 2: After saveInstrument("flute") then page reload, instSelect.value === "flute".
    - Test 3: On a fresh page (localStorage empty), instSelect.value === "altoSax".
    - Test 4: After saveInstrument("didgeridoo") (unknown instrument) then page reload, instSelect.value === "altoSax" (validation guard).
    - Test 5: Changing instSelect from altoSax -> clarinet fires a `change` event that triggers saveInstrument("clarinet") — localStorage.getItem("linkToNotes.instrument") === "clarinet" afterward.
    - Test 6 (browser-only via checkpoint): Safari private window — no exception in DevTools console, dropdown defaults to altoSax cleanly.
  </behavior>
  <action>
    Modify `web/main.js`. Make exactly two regions of edits — DO NOT restructure the file or rename other variables.

    Edit 1 — Import block (currently lines 3-6): add a new import line after the existing `./stages.js` import (or anywhere in the import cluster — keep imports grouped):
    `import { loadInstrument, saveInstrument } from "./storage.js";`

    Edit 2 — Dropdown init region (currently lines 29-36): REPLACE the line `instSelect.value = "altoSax";` with a restore-with-validation guard. The replacement reads the saved id via `loadInstrument()` and validates it against the `INSTRUMENTS` keyed object before assigning; falls back to `"altoSax"` if the saved value is null, undefined, or names an instrument no longer in `INSTRUMENTS`. After the value assignment, attach a `change` event listener on `instSelect` that calls `saveInstrument(instSelect.value)` — wires the user's manual selections to localStorage so the next load restores them.

    The restore expression must match this shape exactly (lets the verifier grep for it):
    `const saved = loadInstrument(); instSelect.value = (saved && INSTRUMENTS[saved]) ? saved : "altoSax";`
    (May be split across multiple lines for readability; the two function calls + the ternary guard + the fallback string MUST appear.)

    The change listener must use the `addEventListener("change", ...)` form on `instSelect`, NOT inline `onchange=` assignment.

    DO NOT:
    - Change any other line in main.js.
    - Remove or modify the existing for-loop that populates the dropdown.
    - Add a debounce or rate-limit on the change handler (per RESEARCH.md "no debounce needed for a select element").
    - Bind to the Convert button click instead — per RESEARCH.md, that misses the "pick → reload before converting" case.
    - Introduce any other localStorage call from main.js (must go through storage.js helpers).

    No tests get added to main.js itself; the storage.js Node smoke test (Task 1) covers the helpers, and the human-verify checkpoint (Task 3) covers the wired behavior in a real browser.
  </action>
  <verify>
    <automated>cd "/Users/rowan/Documents/Note Converter" && node --check web/main.js && grep -c 'from "./storage.js"' web/main.js && grep -c 'loadInstrument()' web/main.js && grep -c 'INSTRUMENTS\[saved\]' web/main.js && grep -c 'addEventListener("change"' web/main.js && ! grep -q 'instSelect.value = "altoSax";' web/main.js && echo OK</automated>
  </verify>
  <acceptance_criteria>
    - `node --check web/main.js` exits 0.
    - `grep -c 'from "./storage.js"' web/main.js` returns exactly 1 (import added).
    - `grep -c 'loadInstrument' web/main.js` returns at least 1 (restore call wired).
    - `grep -c 'saveInstrument' web/main.js` returns at least 1 (save call wired in change listener).
    - `grep -c 'INSTRUMENTS\[saved\]' web/main.js` returns at least 1 (validation guard present).
    - `grep -c 'addEventListener("change"' web/main.js` returns at least 1 (change listener attached — may match other listeners too; the saveInstrument call inside one of them is what matters, verified by next check).
    - `grep -B1 -A2 'addEventListener("change"' web/main.js | grep -c saveInstrument` returns at least 1 (saveInstrument is invoked inside a change handler).
    - `grep -q 'instSelect.value = "altoSax";' web/main.js` returns FALSE (the bare default assignment was replaced — the new code may still contain `"altoSax"` as a fallback string in a ternary, just not as the unconditional assignment).
    - File diff is small: `git diff --stat web/main.js` shows fewer than 15 lines changed.
  </acceptance_criteria>
  <done>
    main.js imports loadInstrument/saveInstrument from storage.js; the dropdown init uses loadInstrument() with an INSTRUMENTS[saved] validation guard and falls back to altoSax; a change listener on #instrument-select saves the new value via saveInstrument; node --check passes; no other lines touched.
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 3: Verify persistence in a real browser (3 scenarios)</name>
  <what-built>
    A two-line wiring change in web/main.js plus a new web/storage.js module that persists the dropdown selection in localStorage under the key `linkToNotes.instrument`. After this task ships, picking tenor sax and reloading the page should still show tenor sax. The dropdown defaults to altoSax only on first-ever visit or when storage is unavailable.
  </what-built>
  <how-to-verify>
    Serve the web app locally and walk through three scenarios:

    1. Start a static server from the project root:
       `python3 -m http.server 8000 --directory web`
    2. Open `http://localhost:8000/` in Chrome (or any modern browser).

    Scenario A — Happy path (persistence works):
    - Open DevTools → Application → Local Storage → http://localhost:8000.
    - Change the Instrument dropdown to "Tenor Saxophone (Bb)".
    - Confirm a new entry appears in Local Storage: `linkToNotes.instrument = "tenorSax"`.
    - Reload the page (Cmd+R / Ctrl+R).
    - Confirm the dropdown still reads "Tenor Saxophone (Bb)".
    - Change to "Flute", reload, confirm dropdown reads "Flute" and storage value is "flute".

    Scenario B — Invalid saved value (validation guard):
    - In DevTools → Application → Local Storage, manually edit the value of `linkToNotes.instrument` to `didgeridoo`.
    - Reload the page.
    - Confirm the dropdown shows "Alto Saxophone (Eb)" (default), no console errors, page loads cleanly.

    Scenario C — Storage unavailable (graceful degradation):
    - Open a Safari Private window (or Chrome Incognito with Site Settings → Cookies blocked).
    - Visit `http://localhost:8000/`.
    - Confirm the page loads without exceptions in DevTools console.
    - Confirm the dropdown defaults to "Alto Saxophone (Eb)".
    - Try changing instrument — UI should still work (the save silently no-ops, but the dropdown still changes locally).

    Optional smoke (regression): pick a real audio file with any instrument and click Convert. The conversion pipeline should still run end-to-end (no regression from the import/wiring changes).
  </how-to-verify>
  <resume-signal>
    Type `approved` if all three scenarios behave as described. If something is off (e.g. "Scenario A — dropdown resets to altoSax after reload", "Scenario C — TypeError in console") report the specific scenario letter and the unexpected behavior.
  </resume-signal>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Browser localStorage <-> page JS | User-controlled storage; values must be validated against `INSTRUMENTS` before use as object lookup key |
| `change` event on `<select>` | User-driven; standard HTML event, no injection surface |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-02-01 | Tampering | Restored localStorage value used as object key on INSTRUMENTS | mitigate | Restore guard `(saved && INSTRUMENTS[saved]) ? saved : "altoSax"` rejects unknown keys; falls back to default. Even if user tampers with localStorage, the lookup returns undefined for unknown keys (object access, not eval) so no code injection is possible. |
| T-02-02 | Denial of Service | localStorage.setItem throws QuotaExceededError or storage disabled mid-session | accept | saveInstrument() silently catches; persistence degrades to nothing but UI keeps working. No user-facing failure. |
| T-02-03 | Information Disclosure | localStorage key collides with another GitHub Pages app under `*.github.io` | mitigate | Namespace key as `linkToNotes.instrument` (per RESEARCH.md). Only an instrument string is stored (no PII). |
| T-02-04 | Tampering | storage.js module imports could be replaced via supply chain attack | accept | Module has zero imports — pure platform code. No supply-chain surface. |
</threat_model>

<verification>
Plan-level success: after this plan ships and the human-verify checkpoint passes, the phase Success Criterion #1 ("User selects an instrument, reloads, dropdown still set") is satisfied.

Pre-checkpoint automation:
- `node --check web/storage.js && node --check web/main.js` passes.
- `node web/storage.test.cjs` exits 0 with at least 8 "OK" lines.
- grep gates from each task's `<acceptance_criteria>` all pass.

Checkpoint (Task 3): 3 browser scenarios approved by human.
</verification>

<success_criteria>
- web/storage.js exists, exports loadInstrument + saveInstrument, no-throw across all 8 tested paths.
- web/main.js imports the helpers, restores with INSTRUMENTS validation guard, saves on change event.
- Browser smoke test (Task 3): tenor sax → reload → still tenor sax; invalid saved value → falls back to altoSax silently; private mode → no exceptions, defaults clean.
- No regression in the conversion pipeline (Scenario C optional smoke).
- Requirement PAR-03 satisfied.
</success_criteria>

<output>
Create `.planning/phases/02-instrument-persistence-error-handling/02-01-SUMMARY.md` on completion, summarizing:
- Tasks 1+2 commits (with hashes).
- Files created/modified.
- Key decisions taken (e.g. exact validation expression, change-event vs convert-click choice).
- Checkpoint outcome (approved / scenarios that failed and how resolved).
- Known stubs (expected: none).
</output>
