# Phase 2: Instrument Persistence & Error Handling - Research

**Researched:** 2026-05-29
**Domain:** Browser persistence (localStorage) + async-failure detection on a CDN-loaded TFJS model
**Confidence:** HIGH

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PAR-03 | User's last-selected instrument persists across page reloads (localStorage) | MDN canonical `storageAvailable()` pattern + validate-against-INSTRUMENT_ORDER restore + namespaced key |
| XPLAT-03 | Pipeline gracefully reports a clear error if the browser can't run the basic-pitch model (instead of hanging) | Timeout race around `bp.evaluateModel(...)` keyed off the absence of percent callbacks; constructor is synchronous and lazy-loads the model so failures surface from `evaluateModel`, not from `new BasicPitch(...)` |

## Overview

Both requirements are small, additive changes to `web/main.js` and `web/pipeline.js`. No new modules strictly required, but a 30-50 line `web/storage.js` helper for localStorage gives clean test surface and keeps `main.js` from growing a second responsibility. No external dependencies — both fixes are pure-platform code.

The phase has **zero new external dependencies** and **zero new CDN imports**. The Package Legitimacy Audit, Environment Availability, Security Domain, and Validation Architecture sections are therefore omitted (or trivially populated). The CLAUDE.md "no bundler, no build step" constraint is preserved.

**Primary recommendation:**
- **PAR-03:** Add a small `web/storage.js` with `loadInstrument()` / `saveInstrument(id)` that uses an MDN-style `storageAvailable()` probe, namespaces the key as `linkToNotes.instrument`, validates the restored value against `INSTRUMENT_ORDER`, and falls back to `"altoSax"` on any failure or unknown value. Wire `saveInstrument` to the `change` event on `#instrument-select`; restore right after dropdown population in `main.js`.
- **XPLAT-03:** Wrap `bp.evaluateModel(...)` in a 20-second watchdog (resets every time the percent callback fires, OR if no callback after 20s with no decoded audio, the model never loaded). Surface a plain-language error via the existing `showError` panel naming "this device's browser couldn't load the transcription model — try Chrome, Edge, or Firefox on a laptop or desktop." Do NOT add a pre-flight WebGL check — TFJS auto-falls-back to CPU, and a false-negative pre-check would lock out devices that would actually work.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Persist instrument selection | Browser / Client (localStorage) | — | No server exists; localStorage is the only persistence surface in a static-hosted app |
| Restore instrument on page load | Browser / Client (main.js init) | — | Runs in module-top-level code right after dropdown population, before default `altoSax` write |
| Detect basic-pitch model load failure | Browser / Client (pipeline.js) | — | All ML inference runs in-browser; failure detection must live next to the failure site |
| Surface error to user | Browser / Client (main.js) | — | Reuses existing `showError(msg)` red panel from Phase 1 — no new UI surface needed |
| Reset stage indicator on error | Browser / Client (main.js) | — | Already handled by Phase 1's `finally { hideStages() }` block — no change needed |

## Recommended Approach

### PAR-03 — Instrument persistence

**Single source of truth:** localStorage key `linkToNotes.instrument` holds the last instrument id (one of the strings in `INSTRUMENT_ORDER`). Two operations: `loadInstrument()` returns a valid id or `null`; `saveInstrument(id)` writes if the id is valid and storage is available. Both swallow errors and never throw — persistence is an enhancement, not a requirement.

**Storage helper module (`web/storage.js`):** new file, ~40 lines. Keeping the helper out of `main.js` lets the planner add a `web/storage.test.html` mirror of the Phase 1 `musicxml.test.html` browser test page, and lets a node smoke test exercise the logic with a mocked `globalThis.localStorage`.

**Where to save:**

Bind to the `change` event on `#instrument-select`. This catches every selection regardless of whether the user runs Convert — and matches user expectation that "if I changed it, it should remember."

Do NOT bind to the Convert click — that misses the case where the user picks an instrument, reloads to share the page, and is surprised the choice was lost.

**Where to restore:**

In `main.js`, immediately after the dropdown population loop (`for (const id of INSTRUMENT_ORDER) { ... }`), replace the unconditional `instSelect.value = "altoSax"` (line 36) with:

```js
const saved = loadInstrument();                                  // returns valid id or null
instSelect.value = (saved && INSTRUMENTS[saved]) ? saved : "altoSax";
```

The validation guard (`INSTRUMENTS[saved]`) makes the restore resilient to a future release that removes an instrument from `INSTRUMENT_ORDER` — old saved values become invalid and we silently fall back to the default. [VERIFIED: codebase inspection of `web/instruments.js` — `INSTRUMENTS` is a keyed object, missing keys return undefined.]

**Edge cases handled by the helper:**

| Scenario | Behavior |
|----------|----------|
| Safari private browsing | `storageAvailable()` returns false, `loadInstrument()` returns null, default `altoSax` wins. No exception escapes. [CITED: MDN canonical pattern + WebKit bug 157010] |
| `localStorage.getItem` returns null (never saved) | `loadInstrument()` returns null |
| Saved value not in `INSTRUMENTS` (renamed/removed instrument) | Restore guard falls back to `altoSax` |
| `localStorage.setItem` throws `QuotaExceededError` | `saveInstrument()` catches silently — UI still works, just no persistence |
| `localStorage` blocked entirely (cookies-off browser setting) | `storageAvailable()` catches the access throw, returns false |

**Key namespacing:** Use `linkToNotes.instrument`, not bare `instrument`. The web app is hosted on GitHub Pages at a path under `*.github.io` — if the user has other apps on the same origin (`username.github.io/other-project`), localStorage IS shared across paths under one origin. A unique prefix prevents accidental collisions. [VERIFIED: HTML Storage spec — localStorage is per-origin, not per-path. Two different GitHub Pages projects under the same user are the same origin.]

### XPLAT-03 — Model failure detection

**Three failure modes to distinguish:**

1. **Constructor synchronous throw** — only happens if basic-pitch's `OVERLAP_LENGTH_FRAMES` invariant breaks. Not a real-world failure mode; we don't need special handling beyond the existing try/catch in `main.js`. [VERIFIED: source of `BasicPitch` constructor at github.com/spotify/basic-pitch-ts/blob/main/src/inference.ts — only one validation throw, no network or backend work in the constructor.]

2. **`tf.loadGraphModel` (CDN fetch) rejects** — happens when the model JSON or a weight shard fails to download (network error, CDN down, CORS issue). Surfaces inside `evaluateModel` because the constructor stores the unawaited promise. Manifests as a thrown Error with a fetch-style message. The existing `main.js` convert-handler catch will surface it via `showError(err.message)`. We need to detect this case and **replace** the raw fetch-error message with user-readable copy.

3. **Silent hang during model load or first inference** — the documented iOS 16.4 Safari WebGL issue. `evaluateModel` neither resolves nor rejects, the percent callback never fires. [VERIFIED: tfjs issue #7399 — "Can not estimateFaces or executeAsync it just freezes there"]. This is the case the user explicitly called out ("instead of hanging").

**Why NOT a pre-flight WebGL/WASM capability check:**

- TFJS auto-falls-back from WebGL → CPU when WebGL is unavailable. A pre-flight `canvas.getContext("webgl2")` check would false-negative on a Mac that would actually transcribe fine via the CPU backend.
- WebAssembly is ~98% supported on evergreen browsers and basic-pitch's TFJS dep doesn't require the WASM backend (the default WebGL/CPU path is used). [CITED: caniuse.com/wasm — global support >97% as of 2026].
- We have one real symptom (the hang). Detect that symptom directly. Don't pre-emptively guess at causes.

**The watchdog pattern:**

```js
async function extractNotesWithTimeout(audioBuffer, progress) {
  if (progress) progress({ stage: STAGE.MODEL_LOADING, label: STAGE_LABELS[STAGE.MODEL_LOADING] });

  const bp = new BasicPitch(MODEL_URL);
  let lastProgressAt = Date.now();

  // Resets every time basic-pitch reports a percent.
  const watchdog = new Promise((_, reject) => {
    const id = setInterval(() => {
      if (Date.now() - lastProgressAt > MODEL_TIMEOUT_MS) {
        clearInterval(id);
        reject(new ModelLoadError(
          "This browser couldn't load the transcription model in time. " +
          "It may not support the audio-to-notes AI. Try Chrome, Edge, or " +
          "Firefox on a laptop or desktop computer."
        ));
      }
    }, 1000);
    // Cleanup is handled by Promise.race: the model promise resolving will
    // make the unresolved watchdog garbage-collect; we just need to clear
    // the interval, so we expose it via a closure-captured flag.
    watchdogCleanup = () => clearInterval(id);
  });

  const inference = (async () => {
    const frames = [], onsets = [], contours = [];
    await bp.evaluateModel(
      audioBuffer,
      (f, o, c) => { frames.push(...f); onsets.push(...o); contours.push(...c); },
      (pct) => {
        lastProgressAt = Date.now();   // reset the watchdog
        if (progress) progress({ stage: STAGE.TRANSCRIBING, label: ..., percent: pct });
      },
    );
    return { frames, onsets, contours };
  })();

  try {
    const out = await Promise.race([inference, watchdog]);
    // ...rest of post-processing
  } finally {
    watchdogCleanup?.();
  }
}
```

**Why the percent-callback resetting watchdog (not a flat `setTimeout(15000)`):**

- A flat 15s timeout would false-positive on slow networks where the multi-MB model legitimately takes 20-30s to download on first run. The "Loading model (first run only)" label already warns the user this is slow.
- A reset-on-progress watchdog distinguishes "no progress for N seconds" (real hang) from "slow but progressing" (acceptable). Once the percent callback fires for the first time, we know the model loaded successfully and inference is running — from then on each callback resets the timer.
- The 20s threshold matches the user-visible success criterion ("clear error within ~15 seconds") with a small buffer for legitimate slow first-callbacks on cold CDN cache.

**Recommended threshold:** `MODEL_TIMEOUT_MS = 20000` (20 seconds). The phase success criterion says "within ~15 seconds"; 20s with a 1s polling interval gives the user error between 15-21s in practice. Tuneable later.

**Error type — distinguish from "no notes detected":**

Create a `ModelLoadError extends Error` class in pipeline.js. The convert handler in main.js can either check `instanceof ModelLoadError` or just trust the error message text (already user-friendly). The phase 1 pattern is to set `showError(err.message)`, so making the `ModelLoadError` message the final user-facing string is the lowest-friction approach.

**Where the catch lives:**

The existing `main.js` convert handler at line 84-86 already does:
```js
} catch (err) {
  console.error(err);
  showError(err.message || String(err));
}
```

If we set the `ModelLoadError` message to be the user-facing copy, **no change to main.js is needed for the error display path** — it inherits the existing showError + console.error + hideStages flow. The only main.js change required is the localStorage restore.

**Also catch model-fetch errors (not just hangs):**

Wrap the `bp.evaluateModel(...)` call itself in a try/catch that re-throws as `ModelLoadError` if the error looks like a fetch/network failure (e.g. `err.message.includes("model.json") || err.message.includes("fetch") || err.name === "TypeError"`). This covers the case where the CDN returns 503 or the user is offline mid-load — they get the same "browser couldn't load the model" copy instead of a raw `TypeError: Failed to fetch` leak.

## Implementation Notes

### File-level change inventory

| File | Change | Approx. LOC |
|------|--------|-------------|
| `web/storage.js` | NEW — `storageAvailable()`, `loadInstrument()`, `saveInstrument(id)` | ~40 |
| `web/pipeline.js` | Add `ModelLoadError` class + `MODEL_TIMEOUT_MS` const + watchdog around `bp.evaluateModel` + catch/rethrow on fetch-error | ~30 |
| `web/main.js` | Import `loadInstrument`/`saveInstrument` from `./storage.js`; replace L36 default-write with `loadInstrument`-guarded restore; add `change` listener on `instSelect` | ~5 |
| `web/index.html` | No changes (existing `#error` panel reused; existing stage indicator reused) | 0 |
| `web/style.css` | No changes | 0 |
| `web/storage.test.html` | NEW — browser smoke test page (mirrors Phase 1 musicxml.test.html style) | ~80 (optional, but matches Phase 1 convention) |

Total expected code change: ~75 LOC of new code + 5 LOC modified. Well under the 100 LOC threshold flagged in `<additional_context>`.

### web/storage.js skeleton

```js
// localStorage helper: persists the last-selected instrument across reloads.
// All operations are no-throw — persistence is an enhancement, never required.

const KEY = "linkToNotes.instrument";

// MDN-canonical localStorage availability probe. Handles Safari private mode
// (setItem throws QuotaExceededError) without leaking an exception.
function storageAvailable() {
  try {
    const x = "__lt2n_test__";
    localStorage.setItem(x, x);
    localStorage.removeItem(x);
    return true;
  } catch {
    return false;
  }
}

// Returns the saved instrument id, or null if nothing saved / unreadable.
// Validation against INSTRUMENT_ORDER happens at the call site in main.js so
// this module stays independent of the instruments registry.
export function loadInstrument() {
  if (!storageAvailable()) return null;
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

// Writes the id if storage is available; silently no-ops otherwise.
export function saveInstrument(id) {
  if (!storageAvailable()) return;
  try {
    localStorage.setItem(KEY, id);
  } catch {
    // Quota exceeded or storage disabled mid-session — swallow.
  }
}
```

### main.js diff sketch

```js
// (top) — add the import
import { loadInstrument, saveInstrument } from "./storage.js";

// Populate instrument dropdown.
for (const id of INSTRUMENT_ORDER) { /* ... existing ... */ }

// Replace: instSelect.value = "altoSax";
const saved = loadInstrument();
instSelect.value = (saved && INSTRUMENTS[saved]) ? saved : "altoSax";

instSelect.addEventListener("change", () => {
  saveInstrument(instSelect.value);
});
```

### pipeline.js diff sketch (extractNotes only)

```js
const MODEL_TIMEOUT_MS = 20000;
const MODEL_ERROR_COPY =
  "This browser couldn't load the transcription model in time. " +
  "It may not support the audio-to-notes AI. Try Chrome, Edge, or " +
  "Firefox on a laptop or desktop computer.";

export class ModelLoadError extends Error {
  constructor(msg) { super(msg); this.name = "ModelLoadError"; }
}

export async function extractNotes(audioBuffer, progress) {
  if (progress) progress({ stage: STAGE.MODEL_LOADING, label: STAGE_LABELS[STAGE.MODEL_LOADING] });

  const bp = new BasicPitch(MODEL_URL);
  const frames = [], onsets = [], contours = [];

  let lastTickAt = Date.now();
  let timeoutCleanup;
  const timeoutPromise = new Promise((_, reject) => {
    const id = setInterval(() => {
      if (Date.now() - lastTickAt > MODEL_TIMEOUT_MS) {
        clearInterval(id);
        reject(new ModelLoadError(MODEL_ERROR_COPY));
      }
    }, 1000);
    timeoutCleanup = () => clearInterval(id);
  });

  const inferencePromise = bp.evaluateModel(
    audioBuffer,
    (f, o, c) => { frames.push(...f); onsets.push(...o); contours.push(...c); },
    (pct) => {
      lastTickAt = Date.now();
      if (progress) progress({ stage: STAGE.TRANSCRIBING, label: STAGE_LABELS[STAGE.TRANSCRIBING], percent: pct });
    },
  ).catch((err) => {
    // CDN fetch failures, model parse errors, TFJS backend init failures all
    // look like raw exceptions. Re-throw as a friendly ModelLoadError so the
    // user sees actionable copy instead of "Failed to fetch".
    throw new ModelLoadError(MODEL_ERROR_COPY);
  });

  try {
    await Promise.race([inferencePromise, timeoutPromise]);
  } finally {
    timeoutCleanup?.();
  }

  // ...existing post-processing (outputToNotesPoly, etc) unchanged...
}
```

## Risks & Mitigations

| Risk | Severity | Mitigation |
|------|----------|------------|
| 20s timeout false-positives on cold CDN with slow connection | Medium | Watchdog resets on every percent callback — first successful tick proves model loaded; subsequent ticks prevent timeout. Only "no callback for 20s straight" trips it. |
| `ModelLoadError` swallows the real CDN error message, hurting debuggability | Low | `console.error(err)` is already called in main.js convert handler (line 85) — devs see the raw error in the console; users see the friendly copy. Phase 1's existing pattern. |
| `localStorage` write listener could collide if user picks two instruments in rapid succession | None | `change` fires once per committed selection; no debounce needed for a select element. |
| Saved instrument key collides with another GitHub Pages app on `*.github.io` | Low | Namespace prefix `linkToNotes.` prevents collision. Unique enough for this project's scope. |
| basic-pitch v1.0.1 internals change (esm.sh pinning is by version, but the model URL on jsdelivr could 404 if removed) | Low | The CDN URLs are version-pinned in `pipeline.js:20-25`. If jsdelivr removes the package, the fetch fails → our watchdog catches it → user sees the friendly ModelLoadError. Worst case is documented as the exact case XPLAT-03 mitigates. |
| Cleanup of the watchdog interval if `inferencePromise` rejects before the watchdog fires | Low | `try { Promise.race(...) } finally { timeoutCleanup?.() }` clears the interval even on rejection. JS event loop will not retain the unresolved watchdog promise once the interval is cleared. |
| Saved instrument value pollutes test runs | Low | Browser test page (if written) should call `localStorage.clear()` in setup. |

## Validation Plan

**Node smoke tests (CLI-runnable, mirrors Phase 1 convention):**

| Test | What it proves | Approx. command |
|------|----------------|-----------------|
| `storage.js` syntax check | File is valid ES module | `node --check web/storage.js` |
| `pipeline.js` syntax check | watchdog code parses | `node --check web/pipeline.js` |
| `main.js` syntax check | restore-or-default code parses | `node --check web/main.js` |
| `storageAvailable` returns true with stub localStorage | Helper works in happy path | tiny node script defining `global.localStorage = {setItem, getItem, removeItem}` |
| `loadInstrument` returns null when getItem throws | Hostile-storage path is no-throw | stub localStorage with throwing methods |
| `saveInstrument` silently no-ops when setItem throws | Quota-exceeded path is no-throw | same |
| `ModelLoadError` is an Error subclass with `.name === "ModelLoadError"` | Type discriminator works | trivial node script |

**Browser smoke checkpoints (user-verify, as Phase 1 did for stage progress):**

| Scenario | How to verify | What to look for |
|----------|---------------|------------------|
| Pick tenor sax, reload | Open DevTools → Application → Local Storage; reload page | localStorage shows `linkToNotes.instrument = "tenorSax"`; on reload the dropdown reads "Tenor Saxophone (Bb)" |
| Pick instrument in private browsing | Safari Private window; pick clarinet, reload | No exception in console; dropdown resets to default altoSax (acceptable degradation) |
| Saved value becomes invalid (simulate future removal) | DevTools: set `linkToNotes.instrument = "didgeridoo"`, reload | Dropdown shows altoSax default (validation guard fires); no console error |
| Model load failure (simulate hang) | DevTools → Network → block `cdn.jsdelivr.net`; pick a file, click Convert | Within ~20s the red error panel shows "This browser couldn't load the transcription model..."; stage indicator hides; Convert button re-enables |
| Model load failure (simulate fetch error) | DevTools → Network → block `model.json` URL specifically with 503 response | Same friendly error copy; not a raw "Failed to fetch" |
| Normal conversion still works | Don't block anything; pick a real audio file | No regression; transcription completes, score renders |

**Skip in this phase, owned by Phase 4 (Cross-Browser & Mobile):**
- Real iOS Safari device test of the hang path (Phase 4 owns iOS smoke per ROADMAP.md and the verification report).
- Real Android Chrome smoke.
- Phase 2 needs the timeout + error to **fire correctly**, not be **exhaustively device-tested**.

## State of the Art

| Old Approach | Current Approach | Why |
|--------------|------------------|-----|
| `if (typeof localStorage !== "undefined")` feature check | MDN's `try{setItem;removeItem;return true}catch{return false}` probe | Safari private mode exposes `localStorage` but throws on write — typeof check false-positives. [CITED: WebKit bug 157010, MDN Using_the_Web_Storage_API] |
| `setTimeout(reject, 15000)` flat timeout | Watchdog reset on each progress callback | Flat timeout false-positives on legitimately slow CDN cold loads; watchdog distinguishes "stuck" from "slow but moving" |
| Pre-flight `canvas.getContext("webgl2")` capability check | Detect failure at the symptom (no progress) and surface friendly error | TFJS auto-falls-back from WebGL to CPU; pre-flight check false-negatives on machines that would actually work. [CITED: tensorflow.org/js/guide/platform_environment — backend priority + automatic selection] |
| `AbortSignal.timeout(ms)` modern fetch pattern | Manual `setInterval` watchdog | `bp.evaluateModel` does not accept an AbortSignal; we don't control its fetch. Manual watchdog is the only option without forking the library. |

**Deprecated/outdated:**
- The "test if `window.localStorage` exists" pre-2016 detection pattern is broken in Safari private mode.
- The "race a Promise against `setTimeout(reject, MS)`" naive pattern is too noisy for a multi-MB ML model on a slow network.

## Project Constraints (from CLAUDE.md)

| Constraint | Phase 2 compliance |
|------------|--------------------|
| Static ES modules, CDN-loaded deps only (esm.sh + jsdelivr), no build step | OK — `web/storage.js` is plain ES module; no new CDN imports; no bundler |
| Hosting: GitHub Pages, static files only, no server | OK — no server-side anything; localStorage is client-only by definition |
| Modern evergreen browsers; iOS Safari matters | OK — MDN storage pattern handles iOS Safari private mode; watchdog handles iOS 16.4 WebGL hang |
| YouTube: cannot fetch YouTube media client-side | N/A — Phase 2 doesn't touch the YouTube flow |
| Multi-MB ML model loads from CDN; first-use latency is real | Addressed — 20s watchdog accommodates slow first loads (resets per progress callback); raw timeout would have been a regression |
| GSD Workflow Enforcement: use GSD entry points before file edits | Will apply to Plan execution — this research doc is the Plan input, not a direct file edit |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | 20s is the right watchdog threshold | Recommended Approach (XPLAT-03) | Too short → false-positive errors on slow CDN; too long → user gives up before error fires. Tuneable post-launch. |
| A2 | Reset-on-progress watchdog covers the "model loaded but inference hung" case as well as the "model never loaded" case | Recommended Approach (XPLAT-03) | If TFJS hangs mid-inference AFTER one percent callback, watchdog still catches it (because subsequent callbacks stop). Confidence: high. |
| A3 | `change` event fires reliably on `<select>` for both keyboard and mouse selection across target browsers | Implementation Notes | Standard HTML behavior; very low risk. |
| A4 | basic-pitch v1.0.1 esm.sh URL stays available | Risks & Mitigations | Out-of-scope mitigation — covered by Phase 4 cross-browser pass. If CDN dies, our watchdog catches it. |

## Open Questions

1. **Should the error message include a "Reload page to try again" link?**
   - What we know: Phase 1's `showError` is a static red panel with no actions.
   - What's unclear: Whether a one-time-per-page-load failure with no retry is acceptable UX, or whether we should add a reload button.
   - Recommendation: Punt to discuss-phase or Plan. The success criterion ("user sees a clear error within ~15s") doesn't require a retry affordance. Phase 4 (Cross-Browser & Mobile) may surface real-device feedback that motivates one. Default to no retry button in this phase; reuse existing `showError` shape.

2. **Should a `web/storage.test.html` browser test page be a Plan deliverable?**
   - What we know: Phase 1 added `web/musicxml.test.html` as a browser-runnable smoke harness for the emitter; the Verification report says it became "the project's equivalent visual smoke harness."
   - What's unclear: Whether the persistence logic needs the same level of harness, given it's ~10 lines of real logic.
   - Recommendation: Build it (low cost, matches Phase 1 convention, makes the validation plan exercises cheap to re-run). The planner can choose to fold it into a single task.

3. **Should `ModelLoadError` also fire when "No notes detected" gets thrown?**
   - What we know: `pipeline.js:315` throws `"No notes detected in audio."` already.
   - What's unclear: Whether the user benefits from distinguishing "your audio had no detectable notes" from "your browser couldn't run the model."
   - Recommendation: Keep them distinct. They have different user remediations (use a clearer recording vs. use a different browser). The existing "No notes detected" string is already user-readable.

## Sources

### Primary (HIGH confidence)
- [MDN Using the Web Storage API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API/Using_the_Web_Storage_API) - canonical `storageAvailable()` pattern
- [WebKit bug 157010](https://bugs.webkit.org/show_bug.cgi?id=157010) - Safari private mode QuotaExceededError behavior
- [tfjs issue #7399 - WebGL backend does not work with iOS 16.4 beta](https://github.com/tensorflow/tfjs/issues/7399) - the documented silent-hang failure mode this phase must detect
- [spotify/basic-pitch-ts source](https://github.com/spotify/basic-pitch-ts) - constructor is lazy, fetch happens inside `evaluateModel`
- [TensorFlow.js Platform and Environment guide](https://www.tensorflow.org/js/guide/platform_environment) - backend priority and auto-fallback behavior

### Secondary (MEDIUM confidence)
- [tfjs issue #8267 - Safari webworker WebGL context error](https://github.com/tensorflow/tfjs/issues/8267) - related Safari WebGL failure mode
- [Matt Burke - DOM Exception 22 on Safari private browsing](https://mattburke.dev/dom-exception-22-quota-exceeded-on-safari-private-browsing-with-localstorage/) - corroborates WebKit bug 157010

### Tertiary (LOW confidence)
- WebSearch on AbortSignal timeout patterns — not directly applicable (basic-pitch doesn't accept AbortSignal), but informed the rejection of the naive `Promise.race(p, setTimeout(reject))` pattern.

## Metadata

**Confidence breakdown:**
- localStorage pattern: HIGH — canonical MDN solution, well-documented Safari private mode quirk
- Watchdog pattern: HIGH — direct fit to the documented iOS Safari hang failure mode, basic-pitch source confirms where the failure surfaces
- Error copy: MEDIUM — recommended copy is reasonable but not user-tested; Plan or discuss-phase may refine
- Cleanup semantics: HIGH — standard `try/finally` plus `clearInterval` pattern

**Research date:** 2026-05-29
**Valid until:** ~2026-06-28 (stable platform APIs + pinned CDN package versions — low rot rate)
