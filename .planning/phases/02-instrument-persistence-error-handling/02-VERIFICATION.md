---
phase: 02-instrument-persistence-error-handling
verified: 2026-05-30
verifier: gsd-verifier
status: passed-with-caveats
score: 3/3 success criteria verified (code-trace) + automated tests green; 0/3 browser-verified in-session
re_verification:
  previous_status: none
  previous_score: N/A
  gaps_closed: []
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Plan 01 Scenario A — Happy path persistence"
    expected: "Pick Tenor Saxophone (Bb), reload, dropdown still reads Tenor Saxophone (Bb); DevTools shows linkToNotes.instrument = \"tenorSax\""
    why_human: "Requires a live browser localStorage cycle across a page reload — not exercisable in Node smoke tests"
  - test: "Plan 01 Scenario B — Invalid saved value"
    expected: "Manually edit linkToNotes.instrument to \"didgeridoo\" in DevTools, reload, dropdown falls back to Alto Saxophone (Eb) with no console errors"
    why_human: "Defensive guard verified by grep; user-perceivable fallback requires real reload"
  - test: "Plan 01 Scenario C — Storage unavailable (Safari private mode)"
    expected: "Open Safari private window, page loads without exceptions, dropdown defaults to altoSax, dropdown still functions locally"
    why_human: "Safari private mode storage quirk only reproducible in real Safari"
  - test: "Plan 02 Scenario A — Normal conversion regression check"
    expected: "Pick audio file, click Convert, full pipeline runs Decoding -> Loading model -> Transcribing (with live %) -> Rendering, score renders, no spurious error, watchdog does NOT false-trip"
    why_human: "Requires real basic-pitch CDN load and audio decode — Node test cannot simulate"
  - test: "Plan 02 Scenario B — Simulated 20s hang"
    expected: "Block cdn.jsdelivr.net in DevTools Network, click Convert; within ~15-21s the red error panel shows ModelLoadError copy containing 'couldn't load the transcription model', stage list hides, Convert button re-enables"
    why_human: "Watchdog only trips after real elapsed wall-clock time; Node smoke verified the code structure but not the live trip"
  - test: "Plan 02 Scenario C — Simulated fetch failure (503 on model.json)"
    expected: "Block or override model.json to 503; within seconds (NOT 20s) the same friendly ModelLoadError copy appears (not raw 'TypeError: Failed to fetch')"
    why_human: ".catch-rethrow path verified by grep; live fetch failure surface requires browser"
overrides_applied: 0
---

# Phase 2: Instrument Persistence & Error Handling — Verification Report

**Phase Goal:** "User's instrument choice is remembered between visits, and a broken model load fails loudly instead of hanging."
**Verified:** 2026-05-30
**Status:** passed-with-caveats — all code paths trace cleanly to the goal, all automated tests green, but the three live-browser checkpoints (Plan 01 Task 3 and Plan 02 Task 2) were not executed in this session. Both executor agents stalled at SUMMARY write due to the same Anthropic SSE / stream-watchdog timeout pattern seen in Phase 1 Wave 2; the orchestrator wrote both SUMMARYs after code-trace approval.
**Re-verification:** No — initial verification.

## Goal Achievement

### Observable Truths (Success Criteria)

| #   | Truth (Roadmap SC) | Status     | Evidence       |
| --- | ------------------ | ---------- | -------------- |
| 1   | User selects an instrument (e.g. tenor sax), reloads the page, and the dropdown is still set to tenor sax | VERIFIED (code-trace) | `web/main.js:42-46` reads `loadInstrument()` and applies `INSTRUMENTS[saved] ? saved : "altoSax"` guard on init; `addEventListener("change", ...)` calls `saveInstrument(instSelect.value)`. `web/storage.js:9` uses namespaced key `linkToNotes.instrument`. 8/8 storage smoke tests pass (`web/storage.test.cjs`). Live-browser reload check pending (human Scenario A). |
| 2   | User on a browser that cannot load the basic-pitch model sees a clear, plain-language error within ~15 seconds instead of an indefinite spinner | VERIFIED (code-trace) | `web/pipeline.js:45` `MODEL_TIMEOUT_MS = 20000`; `:106-114` `setInterval` polling watchdog rejects with `ModelLoadError` when `Date.now() - lastTickAt > 20s`; `:130` percent callback resets `lastTickAt` so legitimate progress prevents false-trip; `:141` `Promise.race([inferencePromise, timeoutPromise])`; `:142-146` finally block clears interval. Error flows through Phase-1 catch at `web/main.js:94-100` → `showError(err.message)` → `errorEl.textContent` (data flow traced end-to-end). 17/17 pipeline smoke tests pass. Live timing pending (human Scenario B). |
| 3   | The error message names the likely cause (browser/device unable to run the model) and suggests trying a desktop browser | VERIFIED | `web/pipeline.js:46` `MODEL_ERROR_COPY = "This browser couldn't load the transcription model in time. It may not support the audio-to-notes AI. Try Chrome, Edge, or Firefox on a laptop or desktop computer."` — contains the cause phrase ("couldn't load the transcription model"), all three browsers (Chrome, Edge, Firefox), and both "desktop" and "laptop" platforms. This text is what `super(msg)` assigns to `.message`, which is what `showError(err.message)` renders. |

**Score:** 3/3 truths verified at code level. All three remain pending live-browser confirmation (see Human Verification Required).

### Required Artifacts

| Artifact | Expected    | Status | Details |
| -------- | ----------- | ------ | ------- |
| `web/storage.js`   | `loadInstrument` + `saveInstrument` exports, no-throw, namespaced key | VERIFIED | 47 lines; exports both helpers; zero imports (pure platform); 3 try/catch blocks; 0 `throw` statements outside class declarations; key constant `"linkToNotes.instrument"` at line 9 |
| `web/storage.test.cjs` | 8 behavior tests covering load/save/probe/quota/private-mode | VERIFIED | All 8 tests pass: happy path, setItem-throws, load-when-unavailable, load-saved-value, getItem-throws, namespaced-key, save-noops, quota-exceeded |
| `web/main.js`      | Import + restore-with-validation + save-on-change wiring | VERIFIED | Line 7 import; lines 42-46 contain `const saved = loadInstrument();`, ternary guard `(saved && INSTRUMENTS[saved]) ? saved : "altoSax"`, and `addEventListener("change", () => saveInstrument(instSelect.value))` |
| `web/pipeline.js`  | `ModelLoadError` class + `MODEL_TIMEOUT_MS` + watchdog + fetch-error rethrow | VERIFIED | Lines 45-53 define constants + exported class; lines 92-146 contain watchdog (`Promise.race`, `lastTickAt` reset, `clearInterval` cleanup, `.catch` rethrow). 7 references to `ModelLoadError` across the file |
| `web/pipeline.error.test.cjs` | 17 source-invariant + behavior assertions | VERIFIED | All 17 OK lines printed; covers class shape, instanceof Error, name, message preservation, all greppable structural patterns |

### Key Link Verification

| From | To  | Via | Status | Details |
| ---- | --- | --- | ------ | ------- |
| `web/main.js` | `web/storage.js` | `import { loadInstrument, saveInstrument } from "./storage.js"` | WIRED | Line 7 import + lines 42 & 45 invocations |
| `#instrument-select change event` | `localStorage.setItem('linkToNotes.instrument', ...)` | `saveInstrument(instSelect.value)` inside change listener | WIRED | Lines 44-46; listener uses `addEventListener("change", ...)` not inline `onchange=` |
| Module-top dropdown init | `localStorage.getItem('linkToNotes.instrument')` | `loadInstrument()` guarded by `INSTRUMENTS[saved]` | WIRED | Lines 42-43 |
| `extractNotes()` | `ModelLoadError` | `Promise.race([inference, watchdog])` where watchdog rejects with `new ModelLoadError` on stalled progress | WIRED | `web/pipeline.js:110` (watchdog reject) + `:141` (Promise.race) |
| `bp.evaluateModel` percent callback | watchdog reset | `lastTickAt = Date.now()` at top of percent callback | WIRED | `web/pipeline.js:130` (reset is the FIRST statement in percent callback before forwarding to `progress()`) |
| `bp.evaluateModel` rejection (fetch error) | `ModelLoadError` (re-thrown) | `.catch((err) => { throw new ModelLoadError(...) })` | WIRED | `web/pipeline.js:133-138`; preserves `ModelLoadError` instanceof check to avoid double-wrap |
| `ModelLoadError.message` | `showError(err.message)` in main.js | Phase 1's existing catch block (no main.js changes for Plan 02) | WIRED | `web/main.js:94-100` — `catch (err) { console.error(err); showError(err.message || String(err)); } finally { hideStages(); convertBtn.disabled = false; }` |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| `web/main.js` instrument dropdown init | `saved` | `loadInstrument()` → `localStorage.getItem("linkToNotes.instrument")` | YES (real browser storage; null on first visit triggers `altoSax` fallback) | FLOWING |
| `web/main.js` `showError` for ModelLoadError path | `err.message` | `new ModelLoadError(MODEL_ERROR_COPY).message` via `super(msg)` | YES (canonical curated string flows verbatim into `errorEl.textContent`) | FLOWING |
| `web/pipeline.js` watchdog state | `lastTickAt` | initial `Date.now()` + per-tick reset in percent callback | YES (poll loop reads it every 1s and rejects on 20s silence) | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| storage.js parses as valid ES module | `node --check web/storage.js` | exit 0 | PASS |
| main.js parses as valid ES module | `node --check web/main.js` | exit 0 | PASS |
| pipeline.js parses as valid ES module | `node --check web/pipeline.js` | exit 0 | PASS |
| storage smoke tests all green | `node web/storage.test.cjs` | "All 8 tests passed" exit 0 | PASS |
| pipeline.error smoke tests all green | `node web/pipeline.error.test.cjs` | "All tests passed" exit 0 (17 OK) | PASS |
| Error copy substring assertions | python3 extraction of MODEL_ERROR_COPY string | Has Chrome=True, Edge=True, Firefox=True, desktop/laptop=True, couldn't-load phrase=True | PASS |
| End-to-end data-flow trace (ModelLoadError → DOM) | python3 chained assertion across pipeline.js + main.js | "FULL DATA FLOW VERIFIED" | PASS |
| Live browser reload persistence | (requires real browser) | not executed | SKIP — routed to human |
| Live model-hang error timing | (requires real browser + network simulation) | not executed | SKIP — routed to human |

### Probe Execution

No formal probe scripts declared by either PLAN; both plans relied on `node --check` + dedicated `.cjs` smoke tests (executed above as spot-checks) plus human-verify checkpoints.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ---------- | ----------- | ------ | -------- |
| PAR-03 | 02-01 | User's last-selected instrument persists across page reloads (localStorage) | SATISFIED (code) / NEEDS HUMAN (live reload) | `web/storage.js` + `web/main.js:42-46` wiring; namespaced key `linkToNotes.instrument`; INSTRUMENTS validation guard prevents tampering issues; 8/8 storage tests pass |
| XPLAT-03 | 02-02 | Pipeline gracefully reports a clear error if the browser can't run the basic-pitch model (instead of hanging) | SATISFIED (code) / NEEDS HUMAN (live timing) | `MODEL_TIMEOUT_MS=20000` reset-on-progress watchdog at `web/pipeline.js:106-146`; fetch-error rethrow via `.catch` at line 133; user-facing copy at line 46 flows through `showError(err.message)` via Phase-1 catch path; 17/17 pipeline tests pass |

Both PLAN frontmatters declare exactly one requirement each — REQUIREMENTS.md Phase-2 mapping (PAR-03 + XPLAT-03) is fully claimed and verified. Zero orphaned requirements for Phase 2.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| (none) | — | — | — | No `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` markers in any Phase-2-modified file (storage.js, storage.test.cjs, pipeline.js, pipeline.error.test.cjs, main.js). No empty-return stubs. No hardcoded `[]`/`{}` data substitution for real flows. |

### Human Verification Required

See `human_verification:` block in frontmatter — 6 scenarios across 2 plans:

1. **Plan 01 Scenario A** (happy path): pick Tenor Sax → reload → still Tenor Sax + DevTools storage shows `linkToNotes.instrument = "tenorSax"`.
2. **Plan 01 Scenario B** (validation guard): hand-edit storage to `"didgeridoo"` → reload → falls back to Alto Sax silently.
3. **Plan 01 Scenario C** (Safari private mode): no exceptions, defaults to Alto Sax, UI still functions.
4. **Plan 02 Scenario A** (regression): real conversion still works end-to-end, watchdog does not false-trip.
5. **Plan 02 Scenario B** (simulated hang): block CDN → friendly red error within ~15-21s, NOT infinite spinner, NOT raw fetch error.
6. **Plan 02 Scenario C** (fetch failure): 503 on `model.json` → same friendly copy appears within seconds via the `.catch` rethrow path.

### Gaps Summary

**No blocking gaps.** Every must-have at the code level is wired, substantive, and traceable from input to user-visible output. The two PLAN checkpoints (Plan 01 Task 3 and Plan 02 Task 2) are both explicit `checkpoint:human-verify` gates that the executor agents could not complete autonomously by design — they require a real browser. Both executor agents additionally stalled at SUMMARY write due to a recurring Anthropic SSE / stream-watchdog timeout (same pattern seen in Phase 1 Wave 2); the orchestrator wrote both SUMMARYs after code-trace approval, and both SUMMARYs accurately reflect shipped code. SUMMARY commit hashes (`babd16e`, `46f6b06`, `95d3627`, `91c7d8e`, `c27ad9a`) all exist in `git log`.

Recommendation: complete the 6 human checkpoint scenarios at the next browser-session opportunity. If any fail, file as a gap-closure plan against Phase 2; do not block Phase 3 (YouTube Handoff Polish) which is parallel-safe per the ROADMAP dependency graph.

---

*Verified: 2026-05-30*
*Verifier: Claude (gsd-verifier)*
