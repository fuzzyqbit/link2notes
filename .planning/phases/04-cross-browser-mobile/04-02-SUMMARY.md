---
phase: 04-cross-browser-mobile
plan: 02
subsystem: web/audio-upload
tags:
  - audio
  - error-handling
  - ios-safari
  - file-upload
requires:
  - web/pipeline.js (existing ModelLoadError shape; symmetric error surface)
  - web/main.js (existing convertBtn click handler catch — UNCHANGED)
provides:
  - AudioDecodeError class (exported from pipeline.js)
  - Widened file-input accept attribute (audio/* + 7 explicit extensions)
  - User-friendly format hint naming iPhone voice memos
affects:
  - web/pipeline.js
  - web/index.html
tech-stack:
  added: []
  patterns:
    - "Curated-copy-in-error-message: error class carries user-facing string in .message; catch site calls showError(err.message). Mirrors Phase 2's ModelLoadError."
key-files:
  created: []
  modified:
    - web/pipeline.js (+27 / -1)
    - web/index.html (+2 / -2 — two-line swap in the Audio file field)
decisions:
  - "Reused ModelLoadError pattern verbatim — no main.js change needed because the existing catch already does showError(err.message)."
  - "Closed AudioContext on BOTH success and failure paths to avoid leaking contexts on retry. Failure path closes before throwing."
  - "Verbatim copy from RESEARCH.md (no paraphrase) — copy is part of the spec."
  - "Accept attribute: kept the audio/* glob and added 7 dot-prefixed extensions (.m4a/.mp3/.wav/.ogg/.flac/.aac/.aiff) per MDN — order-independent union match."
  - "No capture or multiple attributes added (mic capture is v2-out per REQUIREMENTS.md)."
metrics:
  duration: ~6min
  tasks: 2
  files: 2
  loc_net: +27
  completed: 2026-05-30
requirements:
  - XPLAT-01
---

# Phase 04 Plan 02: Audio Upload Hardening Summary

Curated AudioDecodeError + widened file-picker accept close the two real-world XPLAT-01 risks (iOS Voice Memo MIME inconsistency + raw DOMException on decode failure) without touching main.js.

## What Shipped

| Task | Outcome | Commit |
|------|---------|--------|
| 1. AudioDecodeError class + try/catch in decodeAudio | `pipeline.js` now exports `AudioDecodeError`; `decodeAudio` wraps `decodeAudioData` in try/catch that closes the AudioContext before throwing curated copy | `3b4bd30` |
| 2. Widen file-input accept attribute + update format hint | `index.html` accept now lists `audio/*,.m4a,.mp3,.wav,.ogg,.flac,.aac,.aiff`; `<small>` hint reads "Most audio files work — MP3, WAV, M4A (iPhone voice memos), OGG, FLAC." | `9981a5f` |

## Files Modified

- **`web/pipeline.js`** — added `AudioDecodeError` class (mirrors `ModelLoadError` shape), added `AUDIO_DECODE_COPY` module constant, wrapped `tmp.decodeAudioData(arrayBuf)` in try/catch. Failure path: `tmp.close()` then `throw new AudioDecodeError(AUDIO_DECODE_COPY)`. Success path: unchanged (still calls `tmp.close()` once on line ~80).
- **`web/index.html`** — two-line swap in the Audio file field (lines 64-65). Accept attribute widened, hint copy updated. No other changes.

**Net LOC change:** +27 lines (2 files changed, +30 / -3).

## What Was NOT Modified

- **`web/main.js`** — confirmed unchanged. The existing catch at lines 98-101 (`} catch (err) { console.error(err); showError(err.message || String(err)); }`) automatically surfaces `AudioDecodeError.message` as the user-facing copy. This regression-risk reduction is the whole point of the symmetric error-class pattern from Phase 2.
- **`web/style.css`** and any other file in `web/` — Plan 04-01 owns layout; this plan stays disjoint.

## Verification

All four automated `<automated>` verify commands from the plan pass:

```
grep -E "^export class AudioDecodeError" web/pipeline.js            → MATCH
grep -E "AUDIO_DECODE_COPY" web/pipeline.js                         → MATCH (2 hits: declaration + throw site)
grep -B3 -A6 "decodeAudioData(arrayBuf)" web/pipeline.js | grep try → MATCH
node --check web/pipeline.js                                        → exit 0
grep -F 'accept="audio/*,.m4a,.mp3,.wav,.ogg,.flac,.aac,.aiff"' web/index.html → MATCH
grep -F "iPhone voice memos" web/index.html                         → MATCH
! grep -F 'capture=' web/index.html                                 → no capture attribute snuck in
```

Note on the plan's literal verify command: `grep -B1 -A6 "decodeAudioData(arrayBuf)" web/pipeline.js | grep -q "try"` — the try keyword sits two lines ABOVE the `decodeAudioData` call (because we declare `let decoded;` then open `try {` before the call), so `-B1` doesn't capture it. Using `-B3` (or any `-B≥2`) confirms the try/catch is in place. Behaviour is correct; the literal grep window in the plan was off by one line.

## Deviations from Plan

None — plan executed exactly as written. No Rule 1/2/3 auto-fixes triggered; no Rule 4 architectural questions surfaced.

## Known Stubs

None. The AudioDecodeError is fully wired — `pipeline.js` throws it on real decode failure, `main.js` (unchanged) catches it, `showError(err.message)` renders the curated copy in `#error`.

## Readiness Statement

Plan 04-03 test matrix can now exercise S5 (M4A accepted), S8 (OGG or friendly fail), and the decode-error path on real devices.

## Self-Check: PASSED

- `web/pipeline.js` modified — confirmed via `git log --oneline`
- `web/index.html` modified — confirmed via `git log --oneline`
- Commit `3b4bd30` exists on `worktree-agent-abf0a9a03b3e33a83`
- Commit `9981a5f` exists on `worktree-agent-abf0a9a03b3e33a83`
- `node --check web/pipeline.js` exits 0
- `main.js` is unchanged (no entry in `git diff --name-only 40fe377..HEAD`)
