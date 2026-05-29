---
phase: 01-score-export-parity
plan: 02
subsystem: web/musicxml
tags: [musicxml, score-export, transpose, ties, key-signature]
requirements: [PAR-01]
status: awaiting-human-verify

dependency_graph:
  requires:
    - web/pipeline.js exports preferredAccidental
    - INSTRUMENTS entries gain xml: {chromatic, diatonic, octaveChange}
  provides:
    - web/musicxml.js exports buildMusicXml(result, instrument, title) -> string
    - web/musicxml.test.html (browser-runnable test page, 7 cases)
    - "#download-musicxml" button + click handler
  affects:
    - Plan 01-03 (pdf-hardening) — reuses lastResult/lastInstrument/showError patterns added here

tech_stack:
  added: []
  patterns:
    - "Hand-rolled MusicXML 4.0 score-partwise emitter (zero deps) — ~150 LOC"
    - "buildMeasures returns measure-body strings; buildMusicXml wraps + prepends attributes/direction only on first measure (per F3 fix)"
    - "Browser-only test harness via static HTML + DOMParser (no test framework needed; honors no-build-step constraint)"

key_files:
  created:
    - path: web/musicxml.js
      role: buildMusicXml emitter + private helpers (escapeXml, keyToFifths, midiToPitchParts, qlToType, emitNote, emitRest, buildMeasures)
    - path: web/musicxml.test.html
      role: 7-case browser test page (A-G with F's 4 sub-cases per F6 fix)
  modified:
    - path: web/instruments.js
      role: Each of 6 instruments gains xml: {chromatic, diatonic, octaveChange}; sign invariant xml.chromatic === -transposeSemitones
    - path: web/main.js
      role: Imports buildMusicXml; adds lastResult/lastInstrument module state; #download-musicxml handler with specific error copy
    - path: web/index.html
      role: New <button id="download-musicxml">Save MusicXML</button> in .downloads row

decisions:
  - "Hand-rolled emitter chosen over abcjs export or third-party lib — no working CDN-shipped MusicXML emitter exists; result.notes shape is already simpler than MusicXML, so direct emission is the lowest-overhead path."
  - "Transpose direction: xml.chromatic = -transposeSemitones because MusicXML <transpose> adds written->sounding (opposite of project's concert->written transposeSemitones)."
  - "Tempo emission via <direction><sound tempo='N'/></direction> in first measure only — MuseScore reads this as the score tempo marker."
  - "Browser-only test page (musicxml.test.html) instead of node test framework — preserves zero-build-step constraint from CLAUDE.md; node smoke tests cover automated verification."

metrics:
  duration: "single-session execution"
  completed: 2026-05-29
  tasks_complete: 3
  tasks_remaining: 1
  tasks_total: 4
---

# Phase 1 Plan 02: MusicXML Export (Summary)

**One-liner:** Added a real `.musicxml` download — hand-rolled MusicXML 4.0 emitter (`buildMusicXml`) wired to a `Save MusicXML` button, with per-instrument transpose metadata, tempo emission, escaped titles, and tie-across-barline handling.

## Status

**Tasks 1-3 complete (auto). Task 4 awaiting human-verify checkpoint.**

All automated `<automated>` verify commands across Tasks 1-3 pass (12/12 OK). The plan's `checkpoint:human-verify` gate (Task 4) requires the human to open the downloaded `.musicxml` in MuseScore 4 and confirm correct part name, key signature, transpose, ties, and tempo. The executor stops here per blocking-gate protocol.

## Tasks

### Task 1 — Add xml transpose metadata to each instrument (commit `4f9ba00`)

Added `xml: {chromatic, diatonic, octaveChange}` to all six entries in `web/instruments.js`:

| Instrument | chromatic | diatonic | octaveChange |
|---|---|---|---|
| flute        |   0 |   0 | 0 |
| clarinet     |  -2 |  -1 | 0 |
| bassClarinet | -14 |  -8 | 0 |
| altoSax      |  -9 |  -5 | 0 |
| tenorSax     | -14 |  -8 | 0 |
| bariSax      | -21 | -12 | 0 |

Sign invariant `xml.chromatic === -transposeSemitones` holds for every entry. INSTRUMENT_ORDER unchanged.

**Verification:** 2/2 node smokes OK (shape check + per-instrument values).

### Task 2 — Create web/musicxml.js + test page (commit `160852b`)

Created `web/musicxml.js` (~12.5 KB) exporting `buildMusicXml(result, instrument, title)` plus private helpers:
- `escapeXml(s)` — escapes `&`, `<`, `>`, `"`, `'`
- `keyToFifths(key)` — tonic + mode → fifths in [-6, 6]; covers all 24 cases including C minor (-3), E major (+4) per F6 fix
- `midiToPitchParts(midi, accidentalStyle)` — MIDI → `{step, alter, octave}` with sharp/flat spelling per detected key
- `qlToType(ql)` — 1→quarter, 2→half, 3→half+dot, 4→whole
- `emitNote`/`emitRest` — `<note>` elements with proper `<tie>` + `<notations><tied>` pairing
- `buildMeasures(notes, accidentalStyle)` — returns array of measure-body strings (no `<measure>` wrapper, per F3 fix); barline-fill algorithm ported from `buildAbc`

Top-level `buildMusicXml`:
1. XML decl + MusicXML 4.0 DOCTYPE + opening `<score-partwise version="4.0">`
2. `<work><work-title>{escaped title}</work-title></work>` + identification block
3. `<score-part id="P1"><part-name>{escaped instrument.label}</part-name></score-part>`
4. `<part id="P1">` wrapping each `buildMeasures` body in `<measure number="N">...</measure>`; only first measure gets `attributesXml` (divisions, key, time, clef, conditional transpose) + `directionXml` (`<sound tempo="{result.bpm}"/>`)

Created `web/musicxml.test.html` (~10.5 KB) — static page with `<script type="module">` running the 7 test cases (A-G) and writing pass/fail rows to a DOM table.

**Verification:** 5/5 node smokes OK (basic header, transpose, escaping, ties, tempo) + test page exists.

### Task 3 — Wire Save MusicXML button (commit `28a4658`)

Edited `web/index.html`: added `<button id="download-musicxml" type="button">Save MusicXML</button>` as first child of `.downloads` row.

Edited `web/main.js`:
- Imported `buildMusicXml` from `./musicxml.js`
- Added module-scope `let lastResult = null; let lastInstrument = null;`
- `renderResult()` populates both immediately
- `resetUI()` clears both
- New click handler for `#download-musicxml`:
  - Guard: if `lastResult` is null → `showError("Run a conversion first, then export MusicXML.")` + return
  - try/catch around `buildMusicXml` call; on error → `showError("Couldn't build the MusicXML file: " + err.message)` + `console.error(err)`
  - On success → `downloadBlob(xml, "${lastTitle}.musicxml", "application/vnd.recordare.musicxml+xml")` (IANA MIME)

**Verification:** 4/4 grep checks OK (button present, handler wired, state declared, error copy present).

### Task 4 — Manual verify in MuseScore (CHECKPOINT, NOT YET RUN)

Blocked by `gate="blocking"` `checkpoint:human-verify`. See "Checkpoint" section below.

## Deviations from Plan

None — all three auto tasks executed exactly as written. Round-2 plan revision fixes (F3 buildMeasures interface, F4 unescaped shell, F5 tempo verification, F6 expanded keyToFifths coverage) applied per the plan.

The executor agent timed out (Anthropic API stream idle timeout, partial response) after committing all three code commits but before writing this SUMMARY.md. The orchestrator (main thread) wrote this SUMMARY.md after re-running every `<automated>` verify from the plan and confirming 12/12 OK.

## Known Stubs

None.

## Checkpoint — Awaiting Human Verification

**Type:** checkpoint:human-verify (gate="blocking")
**Plan progress:** 3/4 tasks committed (Tasks 1-3). Task 4 cannot be auto-completed.

### What was built

A working "Save MusicXML" button that produces a MusicXML 4.0 file. The file should open cleanly in MuseScore 4 / Finale / any MusicXML-aware editor with:
- Correct part name (from instrument label)
- Correct key signature (from `result.key` via Krumhansl-Schmuckler)
- Correct `<transpose>` block for non-concert instruments (alto sax shows chromatic=-9, diatonic=-5; flute has no `<transpose>` block)
- Tied notes for any quantized note whose duration spans a barline
- `<sound tempo="70"/>` (or whatever `result.bpm` is) as the score tempo marker
- Safely escaped title (titles containing `&`, `<`, `>`, `"`, `'` remain well-formed)

### How to verify (per the plan)

Pre-requisite: **MuseScore 4** installed (free, https://musescore.org). Install if not present.

1. Serve the web app: `python3 -m http.server 8000 --directory web` from the worktree root.
2. Open `http://localhost:8000/musicxml.test.html` first. Confirm all 7 test rows show PASS and the summary at the bottom is green PASS. If any row fails, fix Task 2 before proceeding.
3. Open `http://localhost:8000/` and run a real conversion with a short audio clip. Pick **Alto Saxophone (Eb)** specifically.
4. After the result panel appears, click **Save MusicXML**. A `{title}.musicxml` file downloads.
5. Open the downloaded file in MuseScore 4 (File → Open).
6. Verify ALL of the following:
   a. File imports without "Not a valid MusicXML file" error. (A non-blocking warning about MusicXML 4.0 DOCTYPE is acceptable.)
   b. Part name in score header reads "Alto Saxophone (Eb)".
   c. Key signature on staff matches what the web UI displayed.
   d. Notes on MuseScore staff match the notes on the web UI's ABC staff (same pitches, rhythm, bar count).
   e. View → Concert Pitch toggle: notes shift DOWN (alto sax sounds a major sixth lower than written). If they shift UP, transpose direction is WRONG — fail this checkpoint.
   f. If original audio produced barline-spanning notes, they appear as tied notes (curved line connecting two noteheads of same pitch).
   g. Tempo marking at score start reads `70` BPM (or whatever the result.bpm was).
7. Run a second conversion with **Flute** selected. Save MusicXML, open in MuseScore.
   - Open file in a text editor too: confirm NO `<transpose>` block present.
   - View → Concert Pitch toggle has no effect on the staff.
8. Optional: pick an instrument + audio that exercise a flat key (e.g. clarinet + recording in F major). Confirm MusicXML uses flat spelling for accidentals.
9. Error path: in web UI, BEFORE running any conversion, click "Save MusicXML". Verify the red error panel shows exactly: "Run a conversion first, then export MusicXML." (NOT a silent download or browser error).

### Resume signal

Type `approved` if MuseScore opens the file correctly with the right part name, key, transpose, ties, and tempo. Otherwise describe what's wrong (e.g., "alto sax sounds in concert C, not Eb", "ties missing", "MuseScore says invalid MusicXML").

## Self-Check: PASSED

- `web/musicxml.js`, `web/musicxml.test.html`, `web/instruments.js`, `web/main.js`, `web/index.html` all present + modified per commit log.
- Commits `4f9ba00` (Task 1), `160852b` (Task 2), `28a4658` (Task 3) present in `git log --oneline` of the worktree branch.
- All 12 `<automated>` verify commands from the plan re-run by orchestrator after agent timeout — every one echoed OK.
- No unexpected deletions in any commit.
