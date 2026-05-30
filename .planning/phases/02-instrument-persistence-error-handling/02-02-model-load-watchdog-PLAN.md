---
phase: 02-instrument-persistence-error-handling
plan: 02
type: execute
wave: 1
depends_on: []
files_modified:
  - web/pipeline.js
autonomous: false
requirements: [XPLAT-03]
tags: [error-handling, watchdog, model-load, web]

must_haves:
  truths:
    - "If basic-pitch model load hangs (no progress callbacks for 20 seconds), the user sees a clear plain-language error within ~15-21s instead of an indefinite spinner"
    - "If the CDN fetch for the model JSON or weight shards fails (network error, 503, CORS), the user sees the same friendly ModelLoadError copy instead of a raw 'TypeError: Failed to fetch'"
    - "The error message names the likely cause ('this browser couldn't load the transcription model') and suggests trying Chrome/Edge/Firefox on a laptop or desktop"
    - "On a successful conversion, the new watchdog adds zero perceptible latency and never false-positives — the inference's percent callback resets the timer on each tick"
    - "When the watchdog fires (or the model fetch fails), the existing Phase 1 stage indicator hides cleanly in main.js's `finally { hideStages() }` block, and the Convert button re-enables"
  artifacts:
    - path: web/pipeline.js
      provides: "ModelLoadError class + MODEL_TIMEOUT_MS constant + reset-on-progress watchdog around bp.evaluateModel + catch/rethrow on fetch-error"
      contains: "class ModelLoadError"
      exports: ["ModelLoadError"]
  key_links:
    - from: "extractNotes()"
      to: "ModelLoadError"
      via: "Promise.race([inference, watchdog]) where watchdog rejects with new ModelLoadError on stalled progress"
      pattern: "ModelLoadError"
    - from: "bp.evaluateModel percent callback"
      to: "watchdog reset"
      via: "lastTickAt = Date.now() at the top of the percent callback"
      pattern: "lastTickAt = Date\\.now\\(\\)"
    - from: "bp.evaluateModel rejection (fetch error)"
      to: "ModelLoadError (re-thrown)"
      via: ".catch((err) => { throw new ModelLoadError(...) })"
      pattern: "throw new ModelLoadError"
    - from: "ModelLoadError.message"
      to: "showError(err.message) in main.js:86"
      via: "existing Phase 1 catch block — no main.js changes needed"
      pattern: "showError\\(err\\.message"
---

<objective>
Implement XPLAT-03: detect a stuck/failed basic-pitch model load and surface a plain-language error within ~15 seconds instead of letting the page hang indefinitely.

Purpose: Today, if a user on a browser/device that can't run the TFJS model clicks Convert, the spinner runs forever — no signal, no recovery. This plan wraps `bp.evaluateModel` in a reset-on-progress watchdog and converts both the hang case and the CDN-fetch-failure case into a friendly `ModelLoadError` with actionable copy.

Output: One file modified (`web/pipeline.js`). Adds a new `ModelLoadError extends Error` class, a `MODEL_TIMEOUT_MS` constant (20s), and a Promise.race watchdog around `bp.evaluateModel(...)`. Reuses Phase 1's `main.js` catch (line 84-90) — no `main.js` changes required. Zero new CDN imports.
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
@web/pipeline.js
@web/main.js
@web/stages.js

<interfaces>
<!-- Source-of-truth contracts the executor must NOT invent. -->

From web/pipeline.js (current state — function to modify):
- Lines 68-99: export async function extractNotes(audioBuffer, progress)
- Line 71: const bp = new BasicPitch(MODEL_URL);   <-- synchronous, lazy; failures surface in evaluateModel
- Lines 76-86: await bp.evaluateModel(audioBuffer, frameCb, percentCb)
- Line 84: percent callback fires `progress({ stage: STAGE.TRANSCRIBING, ..., percent: pct })` — THIS is the signal that resets the watchdog
- Line 69: pre-call MODEL_LOADING event already emitted
- Imports from "https://esm.sh/@spotify/basic-pitch@1.0.1" at lines 15-20

From web/main.js (existing catch — DO NOT modify this file):
- Lines 84-90: try/catch/finally around `await runPipeline(file, instrument, renderStage)`
- Line 86: showError(err.message || String(err));    <-- ModelLoadError.message will appear here verbatim
- Line 88: hideStages() in finally — stage list hides on both success and error
- Line 89: convertBtn.disabled = false; — Convert re-enables

From web/stages.js (read-only — already imported by pipeline.js):
- STAGE.MODEL_LOADING = "model-loading"
- STAGE.TRANSCRIBING  = "transcribing"
- STAGE_LABELS[...]   = matching human strings

Phase 1 verification confirms: stage indicator already hides on error (SC-3, finally block at main.js:88). Phase 2 inherits this behavior — no main.js change needed for the error display path.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Add ModelLoadError + reset-on-progress watchdog around bp.evaluateModel</name>
  <read_first>
    - /Users/rowan/Documents/Note Converter/web/pipeline.js (full file — extractNotes is the only function to modify)
    - /Users/rowan/Documents/Note Converter/web/stages.js (STAGE / STAGE_LABELS — already imported)
    - /Users/rowan/Documents/Note Converter/.planning/phases/02-instrument-persistence-error-handling/02-RESEARCH.md (sections "XPLAT-03 — Model failure detection", "The watchdog pattern", "pipeline.js diff sketch")
  </read_first>
  <behavior>
    - Test 1: `ModelLoadError` is a subclass of `Error`. `new ModelLoadError("x") instanceof Error` is true. `.name === "ModelLoadError"`. `.message === "x"`.
    - Test 2: `MODEL_TIMEOUT_MS` is a numeric constant (~20000) — readable for future tuning.
    - Test 3: The user-facing error copy contains the phrase "couldn't load the transcription model" AND names at least one of Chrome / Edge / Firefox AND mentions "desktop" or "laptop" as the suggested platform. (Discoverable by greppable substrings.)
    - Test 4 (browser, covered by Task 2 checkpoint): blocking the model.json URL in DevTools Network → Convert → within 20-21s the red error panel shows the ModelLoadError copy (not "Failed to fetch").
    - Test 5 (browser, covered by Task 2 checkpoint): a normal conversion still completes — the watchdog never false-positives on a real run.
  </behavior>
  <action>
    Modify `web/pipeline.js`. Edit ONLY the `extractNotes` function and add the new constants/class at module scope. Do NOT touch any other exported function.

    Edit 1 — Module scope additions (place after the existing constants like `MIN_NOTE_QL`, before `extractNotes`):
    - `const MODEL_TIMEOUT_MS = 20000;` — 20-second threshold. RESEARCH.md justifies this: the success criterion says "within ~15s", and a 1s polling interval gives a user-visible error between 15-21s.
    - `const MODEL_ERROR_COPY = "This browser couldn't load the transcription model in time. It may not support the audio-to-notes AI. Try Chrome, Edge, or Firefox on a laptop or desktop computer.";` — the verbatim user-facing string. Phrasing comes from RESEARCH.md; do not rephrase.
    - `export class ModelLoadError extends Error { constructor(msg) { super(msg); this.name = "ModelLoadError"; } }` — discriminator for callers that want to type-check (though main.js currently doesn't — it just shows .message).

    Edit 2 — Rewrite the body of `extractNotes` (lines ~68-99) to wrap `bp.evaluateModel(...)` in a Promise.race between the inference promise and a watchdog promise:

    Structure (per RESEARCH.md pipeline.js diff sketch):
    1. Keep the existing `if (progress) progress({ stage: STAGE.MODEL_LOADING, label: STAGE_LABELS[STAGE.MODEL_LOADING] });` and `const bp = new BasicPitch(MODEL_URL);`.
    2. Declare `let lastTickAt = Date.now();` and `let timeoutCleanup;` in the function scope.
    3. Build a `timeoutPromise = new Promise((_, reject) => { ... })` whose body uses `setInterval(() => { if (Date.now() - lastTickAt > MODEL_TIMEOUT_MS) { clearInterval(id); reject(new ModelLoadError(MODEL_ERROR_COPY)); } }, 1000)`. Capture `id` and expose cleanup via `timeoutCleanup = () => clearInterval(id);`.
    4. Build `inferencePromise` as the existing `bp.evaluateModel(...)` call. Inside the percent callback, set `lastTickAt = Date.now()` at the TOP of the callback (before the existing `progress(...)` call) so every progress tick resets the watchdog. Keep the existing frame-collecting frame callback and the existing percent->progress translation.
    5. Append a `.catch((err) => { throw new ModelLoadError(MODEL_ERROR_COPY); })` to `inferencePromise`. This catches fetch failures (model.json 503, CORS errors, "Failed to fetch") and CDN parse errors and rewrites them as the friendly ModelLoadError. (Per RESEARCH.md "Also catch model-fetch errors (not just hangs)".)
    6. Wrap in `try { await Promise.race([inferencePromise, timeoutPromise]); } finally { timeoutCleanup?.(); }` — the finally ensures the setInterval is cleared even if the inference rejects.
    7. After the await, continue with the existing post-processing pipeline UNCHANGED: `outputToNotesPoly(frames, onsets, 0.25, 0.25, 5)`, `addPitchBendsToNoteEvents(contours, polyNotes)`, `noteFramesToTime(withBends)`, and the final `.map(...)` to the normalized shape.

    DO NOT:
    - Add a pre-flight WebGL or WASM capability check (TFJS auto-falls-back; pre-checks false-negative on machines that would actually work — RESEARCH.md "Why NOT a pre-flight WebGL/WASM capability check").
    - Use a flat `setTimeout(reject, 15000)` (false-positives on slow CDN cold loads — RESEARCH.md "Why the percent-callback resetting watchdog").
    - Modify `main.js` (Phase 1's existing `catch (err) { showError(err.message); }` already surfaces the friendly copy via the inherited error-display flow).
    - Change `runPipeline` or any other exported function.
    - Lower the threshold below 15000ms or raise it above 30000ms (success criterion target is ~15s).
    - Wrap `new BasicPitch(MODEL_URL)` in try/catch — the constructor only throws on a basic-pitch internal invariant; not a real-world failure mode.

    Add a Node smoke test at `web/pipeline.error.test.cjs` (CommonJS, dynamic ESM import) that imports `web/pipeline.js` and asserts:
    - `ModelLoadError` is exported.
    - `new ModelLoadError("msg") instanceof Error` is true.
    - `new ModelLoadError("msg").name === "ModelLoadError"`.
    - `new ModelLoadError("msg").message === "msg"`.
    - Reading the file source as text (fs.readFileSync) and checking that the file contains the literal phrase "couldn't load the transcription model" AND each of "Chrome", "Edge", "Firefox" AND one of "desktop"/"laptop".
    - Reading the file source and confirming `MODEL_TIMEOUT_MS = 20000` appears.
    - File contains `Promise.race` (verifies the watchdog structure).
    - File contains `lastTickAt = Date.now()` appearing at least twice (once for init, once for the percent-callback reset).
    Print "OK <test-name>" per pass; exit non-zero on any failure.

    The smoke test deliberately does NOT exercise the live model load (no audioBuffer, no CDN dependency) — full pipeline integration is covered by the browser checkpoint in Task 2.
  </action>
  <verify>
    <automated>cd "/Users/rowan/Documents/Note Converter" && node --check web/pipeline.js && node web/pipeline.error.test.cjs</automated>
  </verify>
  <acceptance_criteria>
    - `node --check web/pipeline.js` exits 0.
    - `grep -c 'class ModelLoadError' web/pipeline.js` returns at least 1.
    - `grep -c 'export class ModelLoadError' web/pipeline.js` returns 1 (the class is exported for type-discrimination).
    - `grep -c 'MODEL_TIMEOUT_MS' web/pipeline.js` returns at least 2 (declaration + usage).
    - `grep -c 'MODEL_TIMEOUT_MS = 20000' web/pipeline.js` returns 1.
    - `grep -c 'Promise.race' web/pipeline.js` returns at least 1.
    - `grep -c 'lastTickAt = Date.now()' web/pipeline.js` returns at least 2 (initialization + reset inside percent callback).
    - `grep -c 'clearInterval' web/pipeline.js` returns at least 1 (cleanup in finally or in the timeout itself).
    - `grep -c 'throw new ModelLoadError' web/pipeline.js` returns at least 1 (the catch-rethrow on fetch errors).
    - `grep -q 'setTimeout' web/pipeline.js | head -1` — if setTimeout appears, it must NOT be used as a flat timeout (the test below is a soft guard; the reviewer relies on grep `Promise.race` + `lastTickAt` pattern as the structural evidence).
    - `grep -v '^\s*//\|^\s*\*' web/pipeline.js | grep -c "couldn't load the transcription model"` returns 1 (the user-facing copy appears in non-comment code).
    - File contains all three browser names: `grep -c Chrome web/pipeline.js` >= 1, `grep -c Edge web/pipeline.js` >= 1, `grep -c Firefox web/pipeline.js` >= 1.
    - `node web/pipeline.error.test.cjs` exits 0.
    - main.js was NOT touched: `git diff --name-only web/main.js` returns empty (or git status doesn't list it).
  </acceptance_criteria>
  <done>
    pipeline.js exports a ModelLoadError class, defines MODEL_TIMEOUT_MS = 20000, wraps bp.evaluateModel in a Promise.race against a reset-on-progress watchdog, and catches fetch-style rejections by re-throwing as ModelLoadError with the canonical user-facing copy. Smoke test confirms the class shape, the constant value, and the presence of the user-facing copy. main.js is unchanged.
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 2: Verify watchdog + fetch-failure error in a real browser (3 scenarios)</name>
  <what-built>
    A 20-second reset-on-progress watchdog wrapped around basic-pitch's `evaluateModel(...)` plus a catch that converts CDN/fetch failures into a friendly `ModelLoadError`. The error reuses Phase 1's existing red error panel via main.js's existing catch — no main.js changes were needed. On a normal conversion the watchdog is invisible; on a stuck or failed model load the user sees actionable copy within ~15-21s.
  </what-built>
  <how-to-verify>
    Serve the web app locally and walk through three scenarios. Pick a real audio file ready before starting (any monophonic clip, 5-30 seconds — same as Phase 1's smoke).

    Setup:
    1. From the project root: `python3 -m http.server 8000 --directory web`
    2. Open `http://localhost:8000/` in Chrome.

    Scenario A — Normal conversion still works (regression check):
    - Pick the audio file, pick any instrument, click Convert.
    - Watch the stage list: Decoding → Loading model → Transcribing (with live %) → Rendering, no error.
    - Confirm the score renders, no spurious error appears, Convert button re-enables, stage list hides.
    - PASS = no regression from the watchdog wrapper.

    Scenario B — Simulated model hang (no progress for 20s):
    - Open DevTools → Network tab. In Chrome, set "Throttling" to "Offline" (or use "Block request URL" on `cdn.jsdelivr.net/*` if available — right-click any request → Block request domain).
    - Pick the audio file, pick any instrument, click Convert.
    - Stage list should show: Decoding (done) → Loading model (active, spinner).
    - Within ~15-21 seconds: the red error panel must appear with copy containing "couldn't load the transcription model" and mentioning Chrome/Edge/Firefox + desktop/laptop. The stage list should hide. Convert button should re-enable.
    - PASS = friendly error shows within ~21s, NOT an infinite spinner, NOT a raw "Failed to fetch".

    Scenario C — Simulated fetch failure (model.json returns 503):
    - DevTools → Network → right-click any request to `cdn.jsdelivr.net/.../model.json` → "Block request URL" (or use a charles/proxy pattern if comfortable). Alternatively: in DevTools → Network, use the "Override response" feature to return 503 for the model URL.
    - Pick the audio file, click Convert.
    - Within a couple of seconds (NOT 20s — the fetch error fires immediately, the watchdog isn't what triggers it): the red error panel should show the SAME friendly ModelLoadError copy (NOT the raw "TypeError: Failed to fetch" message).
    - PASS = the .catch-rethrow path delivers friendly copy on fast fetch failures too.

    Console expectations:
    - Scenarios B and C: `console.error(err)` from main.js:85 will dump the original Error to the console for developer debugging. The user-facing red panel still shows the friendly copy. This is the documented pattern from Phase 1 and is expected.

    If you can also test on Safari or Firefox, repeat Scenario A only (regression check). Real iOS device testing of Scenario B is owned by Phase 4 (cross-browser smoke).
  </how-to-verify>
  <resume-signal>
    Type `approved` if all three scenarios behave as described. If a scenario fails — e.g. "Scenario B — spinner ran for 60s with no error", "Scenario C — saw raw Failed to fetch message", "Scenario A — normal conversion now hangs at ~21s" — report which scenario, the actual timing, and the actual error text (if any).
  </resume-signal>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Browser <-> CDN (jsdelivr / esm.sh) | Untrusted network; fetch can fail, hang, or return malformed data |
| TFJS model -> WebGL / CPU backend | Untrusted hardware/driver path; iOS Safari 16.4 known to silently hang |
| ModelLoadError.message -> showError textContent | Output-only sanitized text (set via .textContent in main.js:163, not innerHTML — no XSS risk) |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-02-05 | Denial of Service | bp.evaluateModel hangs indefinitely (no progress callback) — iOS Safari 16.4 WebGL bug | mitigate | Reset-on-progress watchdog at 20s; rejects with ModelLoadError; main.js catch surfaces friendly copy + stage list hides + Convert re-enables. |
| T-02-06 | Denial of Service | CDN fetch fails (network error, 503, CORS) | mitigate | inferencePromise.catch rewrites the raw fetch error as ModelLoadError. User sees actionable copy instead of "TypeError: Failed to fetch". |
| T-02-07 | Information Disclosure | Raw fetch error leaks internal URL paths or CDN provider names to user | mitigate | ModelLoadError replaces the raw .message with a curated user-facing string. Original error still goes to console.error for developer debugging (main.js:85). |
| T-02-08 | Tampering | basic-pitch CDN URL replaced via supply-chain attack | accept | Version-pinned imports (`@spotify/basic-pitch@1.0.1`, jsdelivr `@1.0.1/model/model.json`); not in scope to add SRI for the model JSON (CDN doesn't publish hashes). Existing risk inherited from Phase 0. |
| T-02-09 | Denial of Service | Watchdog setInterval leaks if inferencePromise resolves before timer is cleared | mitigate | `try { Promise.race(...) } finally { timeoutCleanup?.() }` clears the interval on both resolve and reject paths. |
</threat_model>

<verification>
Plan-level success: after this plan ships and Task 2's checkpoint passes, phase Success Criteria #2 ("clear error within ~15 seconds instead of indefinite spinner") and #3 ("names the likely cause and suggests a desktop browser") are satisfied.

Pre-checkpoint automation (Task 1):
- `node --check web/pipeline.js` passes.
- `node web/pipeline.error.test.cjs` exits 0 with all "OK" lines.
- grep gates from Task 1's `<acceptance_criteria>` all pass.

Checkpoint (Task 2): 3 browser scenarios (normal conversion, simulated hang, simulated fetch failure) approved by human.
</verification>

<success_criteria>
- web/pipeline.js exports ModelLoadError; the class is a real Error subclass.
- MODEL_TIMEOUT_MS = 20000; user-facing copy includes "couldn't load the transcription model" + Chrome/Edge/Firefox + desktop/laptop language.
- Reset-on-progress watchdog (Promise.race) wraps bp.evaluateModel; percent callback resets lastTickAt before forwarding to progress().
- Fetch failures (and any inference rejection) are re-thrown as ModelLoadError with the same friendly copy.
- main.js is NOT modified; Phase 1's existing `catch (err) { showError(err.message); }` + `finally { hideStages(); convertBtn.disabled = false; }` covers the UI path.
- Browser smoke (Task 2): normal conversion unchanged, simulated hang fires error within ~15-21s, simulated fetch failure shows friendly copy immediately.
- Requirement XPLAT-03 satisfied.
</success_criteria>

<output>
Create `.planning/phases/02-instrument-persistence-error-handling/02-02-SUMMARY.md` on completion, summarizing:
- Task 1 commit (with hash).
- Files modified (expected: pipeline.js only) and files created (pipeline.error.test.cjs).
- Key decisions taken (e.g. 20s threshold confirmation, decision to skip pre-flight WebGL check, decision to not modify main.js).
- Checkpoint outcome (approved / scenarios that failed and how resolved).
- Known stubs (expected: none).
</output>
