---
phase: 02-instrument-persistence-error-handling
plan: 02
subsystem: web/pipeline
tags: [model-load, watchdog, error-handling, basic-pitch]
requirements: [XPLAT-03]
status: awaiting-human-verify

dependency_graph:
  requires: []
  provides:
    - ModelLoadError class (exported from web/pipeline.js)
    - 20s reset-on-progress watchdog around bp.evaluateModel
  affects:
    - web/main.js error path (UNCHANGED — Phase 1's existing catch shows ModelLoadError.message via showError)

tech_stack:
  added: []
  patterns:
    - "Reset-on-progress watchdog: setInterval polls lastTickAt every 1s; trips at 20s of silence"
    - "Custom Error subclass with user-facing copy in .message — flows through existing catch path unchanged"
    - "Promise.race(evaluatePromise, watchdogPromise) — watchdog rejects with ModelLoadError if no progress"
    - "Node-runnable test (.cjs) with stubbed BasicPitch — no browser needed for failure simulation"

key_files:
  created:
    - path: web/pipeline.error.test.cjs
      role: Node smoke tests covering ModelLoadError class + watchdog behavior — all PASS
  modified:
    - path: web/pipeline.js
      role: Add ModelLoadError class + MODEL_TIMEOUT_MS=20000 + watchdog wrapper around bp.evaluateModel; rethrow CDN fetch errors as ModelLoadError

decisions:
  - "Reset-on-progress (not flat timeout) — legitimately slow CDN loads keep ticking percent so they don't false-positive; only true hangs (no callback for 20s) trip the watchdog"
  - "ModelLoadError.message is user-facing copy ('This browser couldn't load the transcription model...try Chrome, Edge, or Firefox on a laptop or desktop') — surfaced directly by Phase 1's existing showError(err.message)"
  - "No main.js changes — Phase 1's catch already does showError(err.message); ModelLoadError extends Error so it lands there cleanly"
  - "Skip pre-flight WebGL/WASM capability check (per RESEARCH.md) — TFJS auto-falls-back to CPU; pre-check would false-negative working devices"

metrics:
  completed: 2026-05-29
  tasks_complete: 1
  tasks_remaining: 1
  tasks_total: 2
---

# Phase 2 Plan 02: Model Load Watchdog (Summary)

**One-liner:** Hung basic-pitch model loads now fail loudly within ~20s with a plain-language error directing users to desktop browsers, instead of spinning forever.

## Status

**Task 1 complete (auto, TDD). Task 2 awaiting human-verify checkpoint.**

All `<automated>` verifies OK: ModelLoadError class defined, MODEL_TIMEOUT_MS constant present, watchdog references (lastTickAt + MODEL_TIMEOUT_MS) present, ModelLoadError referenced 7 times across pipeline.js, node smoke tests pass.

## Tasks

### Task 1 — RED + GREEN: pipeline.js watchdog (commits `91c7d8e` RED, `c27ad9a` GREEN)
- `91c7d8e`: failing tests asserting ModelLoadError class exists + watchdog rejects on silence
- `c27ad9a`: implementation — ModelLoadError extends Error with user-facing copy; MODEL_TIMEOUT_MS=20000; reset-on-progress watchdog via setInterval polling lastTickAt; Promise.race(evaluatePromise, watchdogPromise); CDN fetch errors rethrown as ModelLoadError

### Task 2 — Manual verify (CHECKPOINT, NOT YET RUN)

## Checkpoint — Awaiting Human Verification

**Type:** checkpoint:human-verify (gate=blocking)

### How to verify (per plan)
1. Serve: `python3 -m http.server 8000 --directory web`
2. Open localhost:8000
3. **Happy path (sanity):** convert `test-tune.aiff` with any instrument → succeeds as before (watchdog doesn't false-trip on legitimate progress)
4. **Simulated hang via DevTools:**
   - DevTools → Network → block URL pattern `*basic-pitch*` or `*cdn.jsdelivr.net*`
   - Or: set Network throttle to "Offline" before clicking Convert
   - Click Convert. Within ~20s, red error panel shows: "This browser couldn't load the transcription model... try Chrome, Edge, or Firefox on a laptop or desktop"
   - Stage list hides (Phase 1's finally block)
5. **No-progress hang (deeper):** if DevTools blocking doesn't reproduce, edit `web/pipeline.js` MODEL_URL to bogus URL (e.g. `https://example.invalid/model.json`) → save → reload → Convert → ModelLoadError surfaces within timeout

### Resume signal
Type `approved` if the simulated model-load failure shows the plain-language error within ~15-21s + happy path still works. Otherwise describe what broke.

## Self-Check: PASSED
- ModelLoadError class found in pipeline.js
- Watchdog references (lastTickAt, MODEL_TIMEOUT_MS) confirmed
- node web/pipeline.error.test.cjs — all tests pass
- web/main.js UNCHANGED per plan spec (Phase 1's catch flow inherited)
- Worktree HEAD `c27ad9a`
