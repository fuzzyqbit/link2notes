---
phase: 02-instrument-persistence-error-handling
plan: 01
subsystem: web/storage
tags: [localStorage, persistence, instrument-selection]
requirements: [PAR-03]
status: awaiting-human-verify

dependency_graph:
  requires: []
  provides:
    - web/storage.js exports loadInstrument() / saveInstrument(id) — no-throw
    - "linkToNotes.instrument" localStorage key (namespaced)
  affects: []

tech_stack:
  added: []
  patterns:
    - "MDN-canonical storageAvailable probe (try/setItem/removeItem/catch)"
    - "Defensive restore: (saved && INSTRUMENTS[saved]) ? saved : 'altoSax' — guards against future instrument removal"
    - "Save on `change` event (not Convert click) — works even before pipeline runs"
    - "Node-runnable test (.cjs) with mocked storage — no browser test page needed"

key_files:
  created:
    - path: web/storage.js
      role: loadInstrument() + saveInstrument(id) + private storageAvailable() probe
    - path: web/storage.test.cjs
      role: 8 node smoke tests (all PASS) — mocks localStorage, tests load/save/quota/private-mode paths
  modified:
    - path: web/main.js
      role: import loadInstrument + saveInstrument; replace `instSelect.value = "altoSax"` with defensive restore; add change listener calling saveInstrument

decisions:
  - "Key namespaced as 'linkToNotes.instrument' (not bare 'instrument') to avoid collisions with other apps on github.io"
  - "storageAvailable probe used both at load AND save time (Safari private mode flips behavior unpredictably)"
  - "Validate saved value via INSTRUMENTS[saved] truthy check — if instrument key removed in future release, defaults to altoSax instead of breaking dropdown"

metrics:
  completed: 2026-05-29
  tasks_complete: 2
  tasks_remaining: 1
  tasks_total: 3
---

# Phase 2 Plan 01: Instrument Persistence (Summary)

**One-liner:** User's instrument selection now survives page reload via namespaced localStorage with no-throw helpers.

## Status

**Tasks 1+2 complete (auto, TDD). Task 3 awaiting human-verify checkpoint.**

All `<automated>` verifies OK: 8/8 node smokes pass, storage.js exports both helpers, main.js uses defensive restore + change listener bound.

## Tasks

### Task 1 — RED + GREEN: web/storage.js + test (commits `babd16e` RED, `46f6b06` GREEN)
- `babd16e`: failing test asserting `loadInstrument()` + `saveInstrument()` exist + behavior
- `46f6b06`: implementation — MDN-canonical storageAvailable probe; namespaced key `linkToNotes.instrument`; all operations no-throw; 8 smoke tests covering load, save, quota exceeded, private mode

### Task 2 — main.js wire-up (commit `95d3627`)
- Imports `loadInstrument` + `saveInstrument` from `./storage.js`
- Replaces unconditional `instSelect.value = "altoSax"` with `const saved = loadInstrument(); instSelect.value = (saved && INSTRUMENTS[saved]) ? saved : "altoSax";`
- Adds `instSelect.addEventListener("change", () => saveInstrument(instSelect.value));`

### Task 3 — Manual verify (CHECKPOINT, NOT YET RUN)

## Checkpoint — Awaiting Human Verification

**Type:** checkpoint:human-verify (gate=blocking)

### How to verify (per plan)
1. Serve: `python3 -m http.server 8000 --directory web`
2. Open localhost:8000, dropdown shows Alto Sax default
3. Change to **Tenor Saxophone (Bb)**
4. Reload page → dropdown still shows Tenor Saxophone (Bb)
5. DevTools → Application → Local Storage → confirm key `linkToNotes.instrument` = `"tenorSax"`
6. Edit storage value manually to garbage like `"bogusInstrument"` → reload → dropdown falls back to Alto Sax (defensive restore)
7. Safari private mode: select tenor sax → reload → falls back to default (no throw)

### Resume signal
Type `approved` if dropdown remembers tenor sax across reload + garbage value falls back cleanly. Otherwise describe failure.

## Self-Check: PASSED
- 8/8 node smoke tests pass
- Defensive restore + change listener verified by grep
- Worktree HEAD `95d3627`
