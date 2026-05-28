---
phase: 01-score-export-parity
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - web/stages.js
  - web/pipeline.js
  - web/main.js
  - web/index.html
  - web/style.css
autonomous: false
requirements: [PAR-04]

must_haves:
  truths:
    - "User sees a four-item ordered list of pipeline stages on the page during a conversion (Decoding audio, Loading model, Transcribing notes, Rendering score)"
    - "The list item for the currently-running stage is visually marked 'active' (distinct from pending and done states)"
    - "When the pipeline advances from one stage to the next, the previous stage flips to 'done' and the new one to 'active'"
    - "During the transcribing stage, the active list item shows a percent value that updates as basic-pitch's per-batch callback fires"
    - "When the pipeline finishes (success or error), the stage list is hidden via `statusEl.hidden = true` and item states reset to pending so the next run starts clean"
  artifacts:
    - path: "web/stages.js"
      provides: "STAGE enum + STAGE_ORDER + STAGE_LABELS exports"
      contains: "export const STAGE"
      min_lines: 10
    - path: "web/pipeline.js"
      provides: "progress callback emits {stage, label, percent?} objects (not strings)"
      contains: "stage:"
    - path: "web/index.html"
      provides: "<ol id=\"stage-list\"> markup with four <li data-stage=...> items"
      contains: "stage-list"
    - path: "web/main.js"
      provides: "renderStage({stage, label, percent}) function that drives the stage list"
      contains: "renderStage"
    - path: "web/style.css"
      provides: "Styles for [data-stage], [data-state=pending|active|done]"
      contains: "data-state"
  key_links:
    - from: "web/pipeline.js"
      to: "web/stages.js"
      via: "import { STAGE, STAGE_LABELS } from './stages.js'"
      pattern: "from ['\"]\\./stages\\.js['\"]"
    - from: "web/main.js"
      to: "web/stages.js"
      via: "import { STAGE_ORDER, STAGE_LABELS } from './stages.js' for the renderer"
      pattern: "from ['\"]\\./stages\\.js['\"]"
    - from: "web/main.js"
      to: "web/pipeline.js"
      via: "runPipeline(file, instrument, renderStage) — renderStage receives the new object event shape"
      pattern: "runPipeline\\("
---

<objective>
Replace the current single-string `progress(msg)` callback with a typed stage event (`{stage, label, percent?}`) and render a four-item stage indicator that names every step of the pipeline as it runs.

Purpose: The pipeline already takes 5-15 seconds (longer on cold model load). Users currently see only the latest status string; they don't know how many steps remain or whether the transcribe step is making progress. PAR-04 says "user sees clear stage-by-stage progress while a conversion runs (decoding, model loading, transcribing, rendering)" — this plan delivers exactly that surface and becomes the slot the rest of Phase 1 (error messages from Plans 2 and 3) plug into.

Output: A working stage list (`<ol id="stage-list">`) that updates live during conversion, plus a new `web/stages.js` module that future phases reuse (Phase 2's XPLAT-03 error handling will surface failures against the same stage slots).
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
@CLAUDE.md
@web/pipeline.js
@web/main.js
@web/index.html
@web/style.css

<interfaces>
<!-- Key contracts the executor needs. Extracted from the codebase + RESEARCH.md §Stage Progress Deep Dive. -->

Current progress contract (web/pipeline.js):
- `decodeAudio(file, progress)` calls `progress("Decoding audio...")`
- `extractNotes(audioBuffer, progress)` calls `progress("Loading model (first run only)...")` once, then `progress("Pitch detection: NN%")` many times via basic-pitch's `(pct: number 0..1)` callback
- `runPipeline(file, instrument, progress)` calls `progress("Filtering to monophonic line...")`, `progress("Transposing for instrument...")`, `progress("Detecting key...")`, `progress("Quantizing rhythm...")`

Current UI hook (web/main.js):
- `showStatus(msg)` sets `statusEl.hidden = false` and `statusText.textContent = msg`
- `hideStatus()` clears both
- Called once at start (`showStatus("Starting...")`) and then via `runPipeline(file, instrument, showStatus)`

New event shape (from RESEARCH.md §Stage Progress Deep Dive):
```
progress({
  stage: STAGE.DECODING | STAGE.MODEL_LOADING | STAGE.TRANSCRIBING | STAGE.RENDERING,
  label: "Human-readable label",
  percent: 0.42  // optional, [0,1]
})
```

Old-string -> new-stage mapping (from RESEARCH.md §Mapping current emissions):
| Old string | New stage | percent |
|---|---|---|
| "Decoding audio..." | DECODING | undefined |
| "Loading model (first run only)..." | MODEL_LOADING | undefined |
| "Pitch detection: NN%" | TRANSCRIBING | the basic-pitch p value |
| "Filtering to monophonic line..." | RENDERING | undefined |
| "Transposing for instrument..." | RENDERING | undefined |
| "Detecting key..." | RENDERING | undefined |
| "Quantizing rhythm..." | RENDERING | undefined |
</interfaces>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Create stages.js module and update pipeline.js to emit stage objects</name>
  <files>web/stages.js, web/pipeline.js</files>
  <read_first>
    - web/pipeline.js (current progress callback usage — five call sites total)
    - .planning/phases/01-score-export-parity/01-RESEARCH.md (sections: "Stage Progress Deep Dive", "Pattern 2: Discrete stage enum", "Pattern 3: Backward-compatible progress wrapper")
  </read_first>
  <action>
    Create `web/stages.js` as a new ES module exporting three frozen constants per RESEARCH.md §Pattern 2:
    - `STAGE`: object with four keys (DECODING, MODEL_LOADING, TRANSCRIBING, RENDERING) mapping to kebab-case string values ("decoding", "model-loading", "transcribing", "rendering"). Wrap in Object.freeze.
    - `STAGE_ORDER`: array of the four STAGE values in pipeline order.
    - `STAGE_LABELS`: object mapping each STAGE value to its human-readable label per RESEARCH.md (Decoding audio, Loading model (first run only), Transcribing notes, Rendering score).

    Edit `web/pipeline.js`:
    - Add `import { STAGE, STAGE_LABELS } from "./stages.js";` at top.
    - Replace each of the five `progress("...")` call sites with `progress({stage: STAGE.X, label: STAGE_LABELS[STAGE.X]})` per the mapping in `<interfaces>` above. The transcribing call (inside `extractNotes`'s basic-pitch percent callback) MUST also pass `percent: pct` (the raw 0..1 number — do NOT pre-multiply or round; the renderer formats it).
    - In `runPipeline`, the four post-ML strings ("Filtering to monophonic line", "Transposing for instrument", "Detecting key", "Quantizing rhythm") all collapse to a single emission of `{stage: STAGE.RENDERING, label: STAGE_LABELS[STAGE.RENDERING]}` per RESEARCH.md §Mapping. Emit it ONCE, immediately after `await extractNotes` returns (the basic-pitch percent callbacks must be fully drained before the RENDERING event fires) and before `monophonicFilter`. Delete the four individual `progress(...)` lines in `runPipeline`.

    Keep the parameter name `progress` and the existing `if (progress) progress(...)` guard at every call site — the function may still be undefined.
  </action>
  <verify>
    <automated>node --input-type=module -e "import('./web/stages.js').then(m => { if (!m.STAGE || !m.STAGE_ORDER || !m.STAGE_LABELS) process.exit(1); if (m.STAGE_ORDER.length !== 4) process.exit(2); if (m.STAGE_LABELS[m.STAGE.DECODING] !== 'Decoding audio') process.exit(3); console.log('OK'); })"</automated>
    <automated>grep -v '^#' web/pipeline.js | grep -c 'progress("' | awk '$1 != "0" { print "FAIL: legacy string progress calls remain"; exit 1 } { print "OK" }'</automated>
    <automated>grep -v '^#' web/pipeline.js | grep -c 'stage: STAGE\.' | awk '$1 + 0 < 3 { print "FAIL: expected 3+ stage emissions in pipeline.js, got " $1; exit 1 } { print "OK ("$1")" }'</automated>
  </verify>
  <acceptance_criteria>
    - `web/stages.js` exists, exports `STAGE` (frozen), `STAGE_ORDER` (length 4), `STAGE_LABELS` (4 keys).
    - `web/pipeline.js` imports from `./stages.js`.
    - Zero `progress("...")` string-literal calls remain in `web/pipeline.js` (every emission is an object with a `stage` key).
    - `extractNotes`'s basic-pitch percent callback emits `{stage: STAGE.TRANSCRIBING, label, percent: pct}` with `pct` passed through unchanged (0..1).
    - `runPipeline` emits `{stage: STAGE.RENDERING, ...}` exactly once between `extractNotes` and `monophonicFilter`; the four old post-ML strings are gone.
  </acceptance_criteria>
  <done>
    Pipeline runs end-to-end without throwing and every progress event it emits is the new object shape; consumer (Task 2) can read `evt.stage`, `evt.label`, optional `evt.percent`.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Add stage-list markup + styles, replace showStatus with renderStage in main.js</name>
  <files>web/index.html, web/style.css, web/main.js</files>
  <read_first>
    - web/index.html (current `<section id="status">` markup, lines 80-83)
    - web/style.css (current `.status` and `.spinner` rules, lines 196-226)
    - web/main.js (current `showStatus`, `hideStatus`, `resetUI`, and the call site `runPipeline(file, instrument, showStatus)`)
    - web/stages.js (the module Task 1 just created — for STAGE_ORDER and STAGE_LABELS)
  </read_first>
  <action>
    Edit `web/index.html`:
    - Replace the existing `<section id="status" class="status" hidden>...</section>` block with a new section containing an ordered list:
      - Outer: `<section id="status" class="status" hidden>`.
      - Inside: `<ol id="stage-list">` with four `<li>` children, one per STAGE in pipeline order. Each `<li>` has attributes `data-stage="decoding"` (etc.) and `data-state="pending"`. The visible text of each `<li>` is the corresponding STAGE_LABELS value.
      - The four `<li>` data-stage values MUST be exactly: `decoding`, `model-loading`, `transcribing`, `rendering`.
    - Remove the old `<span id="status-text">` and the old inline spinner div (the new CSS handles the spinner via the active-state pseudo-element or a child `<span class="spinner">` inside the active `<li>`; pick the child-span approach for simplicity — add `<span class="spinner" aria-hidden="true"></span>` and `<span class="percent"></span>` as additional children of each `<li>` so they can be styled in/out by `[data-state]`).

    Edit `web/style.css`:
    - Replace the existing `.status` flex rule with rules that lay the `<ol id="stage-list">` as a vertical list (no bullet markers, padding-left 0, gap 8px between items).
    - Style `#stage-list li` with `display: flex; align-items: center; gap: 10px;`.
    - Style `#stage-list li[data-state="pending"]` muted (color: var(--muted), opacity: 0.6), with the spinner and percent children hidden.
    - Style `#stage-list li[data-state="active"]` with full color, font-weight 600, and the spinner visible (reuse the existing `.spinner` keyframes).
    - Style `#stage-list li[data-state="done"]` with a checkmark prefix (use a `::before` content of "✓" — NO emoji — or the Unicode check `"\\2713"`) and slightly muted color. Hide the spinner and percent.
    - Style the percent span to render as e.g. "(42%)" only when non-empty; leave the formatting in JS.
    - Keep the existing `.spinner` keyframe `spin` and the spinner box dimensions; just hide/show it via the parent `<li>` state attribute.

    Edit `web/main.js`:
    - Add `import { STAGE_ORDER, STAGE_LABELS } from "./stages.js";` near the existing imports.
    - Remove the `statusText` constant (line 12) — it no longer exists in the DOM.
    - Replace the `showStatus(msg)` and `hideStatus()` functions with:
      - `renderStage(evt)`: receives `{stage, label, percent}`. Looks up each `<li>` in `#stage-list` by `data-stage`. For each item, sets `data-state` based on its index relative to the active stage's index in STAGE_ORDER (earlier -> "done", equal -> "active", later -> "pending"). For the active item, sets the `.percent` child's textContent to `(NN%)` when `evt.percent` is a finite number (using `Math.round(evt.percent * 100)`), otherwise clears it.
      - `resetStages()`: sets every `<li>`'s `data-state` to `pending`, clears `.percent`, sets `statusEl.hidden = false` so the list is visible from the start of the run.
      - `hideStages()`: sets `statusEl.hidden = true` (hide the stage list section) and resets every `<li>` back to `data-state="pending"` so the next run starts clean. MUST be called on both successful render completion and on error.
    - In the convert handler:
      - On click: call `resetStages()` and `statusEl.hidden = false` (instead of `showStatus("Starting...")`).
      - Pass `renderStage` (not `showStatus`) into `runPipeline(file, instrument, renderStage)`.
      - In the `finally` block, call `hideStages()` instead of `hideStatus()`.
    - In `resetUI()`, also call `hideStages()` (currently `hideStatus()`).
  </action>
  <verify>
    <automated>grep -q 'id="stage-list"' web/index.html && grep -q 'data-stage="decoding"' web/index.html && grep -q 'data-stage="model-loading"' web/index.html && grep -q 'data-stage="transcribing"' web/index.html && grep -q 'data-stage="rendering"' web/index.html && echo OK</automated>
    <automated>grep -v '^/\*' web/style.css | grep -c 'data-state' | awk '$1 + 0 < 3 { print "FAIL: stage states not styled"; exit 1 } { print "OK" }'</automated>
    <automated>grep -q 'renderStage' web/main.js && grep -q 'STAGE_ORDER' web/main.js && ! grep -q 'showStatus' web/main.js && echo OK</automated>
    <automated>! grep -q 'statusText' web/main.js && echo OK || { echo "FAIL: statusText reference still present"; exit 1; }</automated>
  </verify>
  <acceptance_criteria>
    - `web/index.html` has `<ol id="stage-list">` with exactly four `<li>` items whose `data-stage` values are `decoding`, `model-loading`, `transcribing`, `rendering` in that order. Each `<li>` initially has `data-state="pending"`.
    - `web/style.css` has rules for `#stage-list li[data-state="pending"]`, `[data-state="active"]`, and `[data-state="done"]` that produce visually distinct presentations.
    - `web/main.js` no longer references `statusText`, `showStatus`, or `hideStatus`. It defines and uses `renderStage`, `resetStages`, and `hideStages` instead.
    - `runPipeline` is called with `renderStage` as the third argument.
    - The `<section id="status">` is shown at run start and hidden in the `finally` block (success AND error paths).
  </acceptance_criteria>
  <done>
    The DOM reflects the four-stage list, CSS distinguishes states, and main.js wires the new render function. Compatible with Task 1's stage-event shape.
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 3: Manual verify stage progress in a real conversion</name>
  <what-built>
    A live four-item stage indicator (Decoding audio → Loading model → Transcribing notes → Rendering score) that activates each step as the pipeline runs through it and shows a live percent inside Transcribing.
  </what-built>
  <how-to-verify>
    1. From the project root, serve the web app locally: `python3 -m http.server 8000 --directory web` (or any static server pointed at `web/`).
    2. Open `http://localhost:8000/` in Chrome (or Safari/Firefox).
    3. Pick any short audio file (5-30 seconds, monophonic if possible; if no fixture exists yet, any audio clip will do — pipeline can fail at later stages, but the first two stages will still light up).
    4. Pick an instrument and click `Convert`.
    5. Watch the stage list during conversion. Expected behavior:
       - All four stages visible from the start; the first ("Decoding audio") is `active` and shows a spinner.
       - "Decoding audio" flips to `done` (checkmark) when "Loading model" becomes `active`.
       - "Loading model" flips to `done` when "Transcribing notes" becomes `active`.
       - "Transcribing notes" displays a live percent like `(42%)` that increases during the run.
       - "Rendering score" briefly becomes `active`, then the whole list disappears when the result is shown (or stays hidden on error).
    6. Confirm there are NO leftover references to the old single-line status in the rendered page (no `#status-text`, no static "Starting..." message).
    7. Try a deliberate error: pick a non-audio file (e.g. a tiny .txt renamed `.mp3`). The pipeline should fail; verify the stage list disappears and the error panel shows (the specific error copy is Plan 2's scope — for now just confirm the stages clean up).
  </how-to-verify>
  <resume-signal>Type "approved" if the stage list behaves as described, or describe what went wrong (e.g., "transcribing percent never appears", "list doesn't hide on completion").</resume-signal>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| User -> Browser | User-supplied audio file enters the pipeline. Already constrained to `accept="audio/*"`. |
| Browser -> CDN | basic-pitch model + abcjs loaded from jsdelivr/esm.sh. Out of scope for this plan (no new fetches). |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-01-01 | Information Disclosure | Error path showing internal stage names | accept | Stage labels are user-friendly ("Decoding audio") not stack traces; no PII or internal paths exposed via `data-stage` attributes. |
| T-01-02 | Denial of Service | basic-pitch percent callback fires per-batch (hundreds of times) and triggers DOM updates | mitigate | `renderStage` only touches 4 fixed elements via `querySelector`; no listeners attached, no array growth. Re-render cost is constant per call. If perf becomes an issue, debounce in a follow-up. |
</threat_model>

<verification>
- The four stage emissions from `pipeline.js` map one-to-one to the four `<li>` items in the DOM.
- During a real conversion: Decoding (~instant), Model Loading (~3-15s cold, ~0s warm), Transcribing (~1-5s, percent visible), Rendering (~instant).
- No console errors in DevTools during a successful or failed conversion.
- The Task 3 human-verify checkpoint passes.
</verification>

<success_criteria>
PAR-04 satisfied: User sees a stage indicator that names the current step and updates as the pipeline advances. Specifically:
1. Four named stages visible during conversion: Decoding audio, Loading model, Transcribing notes, Rendering score.
2. Active stage is visually distinct from pending and done.
3. Transcribing stage shows live percent.
4. List hides on completion / error so the result or error panel can take the focus.
</success_criteria>

<output>
On completion, write `.planning/phases/01-score-export-parity/01-01-SUMMARY.md` per the summary template. Note any deviations (e.g., spinner styling tweaks) so Plan 2 and Plan 3 can read it before adding error states against the same stage list.
</output>
</output>
