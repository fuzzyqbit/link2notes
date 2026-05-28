---
phase: 01-score-export-parity
plan: 01
subsystem: web/pipeline
tags: [progress-ui, pipeline-instrumentation, stage-indicator]
requirements: [PAR-04]
status: awaiting-human-verify

dependency_graph:
  requires: []
  provides:
    - web/stages.js (STAGE / STAGE_ORDER / STAGE_LABELS enum module)
    - typed progress event shape `{stage, label, percent?}` from pipeline.js
    - "#stage-list" DOM contract (four <li data-stage> slots in fixed order)
  affects:
    - Plan 01-02 (musicxml export) — unchanged, still consumes runPipeline result
    - Plan 01-03 (pdf hardening) — unchanged, but error path can now reuse the stage list
    - Future Phase 2 (XPLAT-03 error handling) — error state can be surfaced against the same <li data-stage> slots

tech_stack:
  added: []
  patterns:
    - "Frozen enum + label-map module (web/stages.js) — pure data, no runtime deps"
    - "Typed event object replacing free-text status string (progress callback)"
    - "DOM state via [data-state] attributes driven from JS (no class swap, no innerHTML rebuild)"

key_files:
  created:
    - path: web/stages.js
      role: STAGE enum + STAGE_ORDER + STAGE_LABELS exports
      lines: ~28
  modified:
    - path: web/pipeline.js
      role: progress() now emits {stage, label, percent?} at 4 distinct emission points
    - path: web/main.js
      role: renderStage/resetStages/hideStages replace showStatus/hideStatus; statusText removed
    - path: web/index.html
      role: <ol id="stage-list"> with four <li data-stage> items replaces <span id="status-text">
    - path: web/style.css
      role: per-state styling for [data-state="pending|active|done"] + spinner re-scoped to li children

decisions:
  - "Collapsed four post-ML progress emissions (filter/transpose/key/quantize) into a single STAGE.RENDERING event — matches the four user-visible stages required by PAR-04 without inventing slots the user can't act on."
  - "Used `[data-state]` attributes (not CSS classes) so HTML can be inspected and the state machine is visible in DevTools."
  - "Used Unicode `\\2713` checkmark via CSS `::before` for done-state prefix (no emoji per CLAUDE.md)."
  - "Kept the existing `.spinner` keyframes and box geometry; only the parent scoping changed so the same animation reuses across stages."
  - "Percent rounding (`Math.round(pct * 100)`) and formatting (`(NN%)`) live in main.js, not in pipeline.js — pipeline emits raw 0..1 per the plan."

metrics:
  duration: "single-session execution"
  completed: 2026-05-28
  tasks_complete: 2
  tasks_remaining: 1
  tasks_total: 3
---

# Phase 1 Plan 01: Stage Progress Indicator (Summary)

**One-liner:** Replaced the single-string `progress(msg)` pipeline callback with a typed `{stage, label, percent?}` event and a four-item DOM stage list that lights up as each pipeline step runs.

## Status

**Tasks 1 + 2 complete (auto). Task 3 awaiting human-verify checkpoint.**

The code changes are committed. The plan's `checkpoint:human-verify` gate (Task 3) requires the human to load the web app in a browser, run a real conversion, and confirm the stage list behaves as described. The executor stops here per the blocking-gate protocol.

## Tasks

### Task 1 — Create stages.js + emit typed events from pipeline.js (commit `43e6c6f`)

- Created `web/stages.js` exporting `STAGE` (frozen), `STAGE_ORDER` (length 4), `STAGE_LABELS` (4 keys). Values are stable kebab-case strings reusable as DOM `data-stage` attributes.
- Added `import { STAGE, STAGE_LABELS } from "./stages.js";` to `web/pipeline.js`.
- Replaced 5 string-literal `progress("...")` calls with object-shape emissions:
  - `decodeAudio` → `{stage: STAGE.DECODING, label}`
  - `extractNotes` once → `{stage: STAGE.MODEL_LOADING, label}` (pre-model-load)
  - `extractNotes` basic-pitch callback → `{stage: STAGE.TRANSCRIBING, label, percent: pct}` (raw 0..1, no rounding)
  - `runPipeline` → single `{stage: STAGE.RENDERING, label}` immediately after `extractNotes` returns, before `monophonicFilter`. The four old strings ("Filtering...", "Transposing...", "Detecting key...", "Quantizing rhythm...") are gone.
- Kept the `if (progress) progress(...)` guard at every call site — callback may still be undefined.

**Verification:**
- `node --input-type=module -e "import('./web/stages.js')..."` → OK
- `grep -c 'progress("'` web/pipeline.js → 0 (no legacy string calls)
- `grep -c 'stage: STAGE\.'` web/pipeline.js → 4 (≥3 required)

### Task 2 — Render stage list + replace showStatus with renderStage (commit `88d9ff4`)

- `web/index.html`: replaced the `<span id="status-text">` + inline spinner with `<ol id="stage-list">` containing four `<li data-stage="…" data-state="pending">` items in pipeline order. Each `<li>` has children `<span class="spinner">`, `<span class="stage-label">`, `<span class="percent">`.
- `web/style.css`: removed the old `.status` flex rule that depended on the deleted spinner. Added rules for `#stage-list`, `#stage-list li`, and `#stage-list li[data-state="pending|active|done"]`. Pending = muted + opacity 0.6 + hide spinner/percent. Active = full color + bold + show spinner. Done = checkmark prefix (`"\2713"` via `::before`) + muted + hide spinner/percent. Empty `.percent` collapses via `:empty`. Kept the original `.spinner` keyframe + dimensions.
- `web/main.js`:
  - Added `import { STAGE_ORDER, STAGE_LABELS } from "./stages.js";`.
  - Removed `statusText` const (the DOM node no longer exists).
  - Removed `showStatus` + `hideStatus` functions entirely.
  - Added `renderStage(evt)` — looks up each `<li>` by `data-stage`, sets `data-state` based on index vs active index in `STAGE_ORDER`, and writes `(NN%)` to the active item's `.percent` when `evt.percent` is a finite number.
  - Added `resetStages()` — sets every `<li>` to pending, clears percents, shows `#status`.
  - Added `hideStages()` — hides `#status` and resets every `<li>` back to pending so the next run starts clean.
  - Convert handler: calls `resetStages()` + sets `statusEl.hidden = false` on click; passes `renderStage` into `runPipeline`; calls `hideStages()` in the `finally` block (both success and error paths).
  - `resetUI()` also calls `hideStages()` for safety.

**Verification:**
- `grep` checks for `id="stage-list"`, all four `data-stage="..."` values → OK
- `grep -c 'data-state'` style.css → ≥3 → OK
- `grep -q renderStage && grep -q STAGE_ORDER && ! grep -q showStatus` main.js → OK
- `! grep -q statusText` main.js → OK

### Task 3 — Manual verify in real conversion (CHECKPOINT, NOT YET RUN)

Blocked by `gate="blocking"` `checkpoint:human-verify`. Awaiting human verification per the resume-signal protocol. See "Checkpoint" section below.

## Deviations from Plan

None — both auto tasks executed exactly as written.

A few small implementation-level choices the plan left open are noted in `decisions` above:

- Spinner now lives as a child `<span class="spinner">` of each `<li>` (the plan's recommended option).
- Used CSS `::before` content `"\2713"` for the done checkmark (the plan's "no emoji" option).
- Added `flex-shrink: 0` and `box-sizing: border-box` to the spinner so its 18×18 dimensions hold inside the flex `<li>`.
- The `<ol id="stage-list">` lives inside the existing `<section id="status">` so `statusEl.hidden = true/false` continues to toggle visibility of the whole indicator block via one assignment — no new container needed.

## Known Stubs

None. The stage list is fully wired from pipeline events to DOM updates.

## Checkpoint — Awaiting Human Verification

**Type:** checkpoint:human-verify (gate="blocking")
**Plan progress:** 2/3 tasks committed (Tasks 1+2). Task 3 cannot be auto-completed.

### What was built

A live four-item stage indicator (Decoding audio → Loading model (first run only) → Transcribing notes → Rendering score) that activates each step as the pipeline runs through it, shows a live percent inside Transcribing, and hides itself when the run finishes (success or error).

### How to verify (per the plan)

1. From the project root: `python3 -m http.server 8000 --directory web` (or any static server pointed at `web/`).
2. Open `http://localhost:8000/` in Chrome (or Safari/Firefox).
3. Pick any short audio file (5–30 seconds, monophonic if possible).
4. Pick an instrument and click **Convert**.
5. Watch the stage list during conversion:
   - All four stages visible from the start; "Decoding audio" is `active` with spinner.
   - "Decoding audio" flips to `done` (checkmark) when "Loading model" becomes `active`.
   - "Loading model" flips to `done` when "Transcribing notes" becomes `active`.
   - "Transcribing notes" shows live percent like `(42%)` that increases.
   - "Rendering score" briefly becomes `active`, then the whole list disappears when the result is shown (or stays hidden on error).
6. Confirm no leftover `#status-text` or static "Starting..." message in the rendered page.
7. Try a deliberate error: pick a non-audio file (e.g. a `.txt` renamed `.mp3`). Pipeline should fail; verify the stage list disappears and the error panel shows.

### Resume signal

Type `approved` if the stage list behaves as described, or describe what went wrong (e.g., "transcribing percent never appears", "list doesn't hide on completion").

## Self-Check: PASSED

- `web/stages.js` exists at the worktree path — created via Write tool in Task 1.
- `web/pipeline.js`, `web/main.js`, `web/index.html`, `web/style.css` modified — confirmed by `git diff --stat` showing 3 files at Task 2 commit and 2 files at Task 1 commit.
- Commits `43e6c6f` (Task 1) and `88d9ff4` (Task 2) present in `git log --oneline` of the worktree branch.
- No unexpected deletions in either commit.
