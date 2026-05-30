# Phase 4: Cross-Browser & Mobile — Research

**Researched:** 2026-05-30
**Domain:** Cross-browser web compatibility + mobile-responsive layout for an existing static web app
**Confidence:** HIGH (codebase + Phase 1-3 verification artifacts are the dominant source; external claims are well-corroborated WebKit/Chromium pitfalls)
**Mode:** mvp

---

## Project Constraints (from CLAUDE.md)

These directives bind every recommendation below. Any approach that violates them is automatically out of scope.

- **No build step.** Static ES modules + CDN imports only (esm.sh + jsdelivr). Anything that requires a bundler is forbidden unless we accept adding tooling — and Phase 4 is the wrong phase for that.
- **GitHub Pages hosting only.** No server, no env secrets. Rules out BrowserStack/SauceLabs CI integrations, paid test farms, server-side polyfills.
- **Modern evergreen browsers** are the support matrix: Chrome, Safari, Firefox, Edge — and **iOS Safari matters because users will try on phones.**
- **YouTube media cannot be fetched client-side.** Stays out of Phase 4 scope (already delivered by Phase 3's cobalt.tools handoff).
- **basic-pitch model loads from CDN; cold load is multi-MB and first-use latency is a real UX constraint** — Phase 4 must not regress the model-load watchdog (Phase 2 / XPLAT-03 / `web/pipeline.js:45-146`).
- **GSD workflow:** all edits to `web/` files must originate from a GSD command (`/gsd-execute-phase`).

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| XPLAT-01 | Audio file upload works on iOS Safari, Android Chrome, desktop Chrome/Safari/Firefox/Edge | §Browser Audio Decode Matrix + §iOS File Picker Behaviour + §AudioContext User-Gesture audit |
| XPLAT-02 | Layout is usable on a phone — no horizontal scroll, controls reachable with one thumb, sheet music pans/zooms reasonably | §Mobile Layout Audit + §abcjs SVG Sizing + §Score Container Pan/Zoom Strategy |
</phase_requirements>

---

## Summary

The web app already has most of what it needs to run on mobile and across browsers — `web/pipeline.js` uses the `webkit` fallback for `AudioContext`/`OfflineAudioContext`, the YouTube handoff is iOS-popup-safe (Phase 3), the PDF print path is iOS-Safari-tuned (Phase 1), and the model-load watchdog gives a clean failure path on devices that can't run TFJS (Phase 2). The viewport meta tag is present. The single existing mobile media query collapses `.controls` to one column at `≤640px`.

**The two real gaps are:**

1. **The score container (`.score` in `web/style.css:306`) uses `overflow-x: auto`** — fine on desktop, hostile on phones. abcjs renders fixed-width SVG (staffwidth 740 in `main.js:193`), which is wider than every phone in portrait, so the score itself horizontally scrolls *inside* its own box. Users on phones get a tiny score they can't read without zooming the page (which iOS Safari conflates with the score's own scroll). The fix is to make the score SVG fluid via `viewBox` + `width: 100%; height: auto` and let the browser's native pinch-zoom handle reading detail.
2. **Real-device confirmation has been deferred from every prior phase to this one.** Phases 1-3 all carry "passed-with-caveats" because iOS Safari smoke (PDF print, audio decode, popup-blocker, model load) was never run on a real iPhone. Phase 4's primary deliverable is a structured **test matrix the user walks through on their own iPhone + a borrowed/proxy Android**, with each row producing pass/fail/notes that decide whether bugs are fixed-in-phase or punted to v1.1.

**Primary recommendation:**

- **For XPLAT-01:** ship a minimal robustness pass (drop the `accept="audio/*"` MIME filter to a glob, log decode errors verbatim, and confirm `extractNotes`'s user-gesture chain holds on iOS) and route the rest through the test matrix. Real bugs become small follow-up tasks; no bugs surfaced means the existing code already meets the requirement.
- **For XPLAT-02:** rewrite the score container + add 1-2 mobile breakpoints + tighten the download row to wrap cleanly + ensure controls stack reachable in bottom 1/3 on a 360-wide viewport. Estimated 40-90 LOC of CSS + 1-2 small `index.html`/`main.js` touches.
- **Total estimated footprint:** 1 plan with 3 small waves: (a) XPLAT-02 layout work + abcjs responsive rendering, (b) XPLAT-01 small fixes + decode hardening, (c) cross-device test matrix walked by the user on real iPhone + verified deploy URL — with a triage protocol for any bug found.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| File picker | Browser (HTML `<input type="file">`) | — | OS-native picker; nothing the app can override |
| Audio decoding | Browser (Web Audio API) | — | `AudioContext.decodeAudioData` does the format-sniffing per browser |
| Sample-rate resampling | Browser (OfflineAudioContext) | — | Already implemented in `pipeline.js:78-85` |
| ML inference (basic-pitch) | Browser (TFJS WebGL/WASM backend) | CDN (model fetch from jsdelivr) | TFJS picks backend; CDN serves weights |
| Score rendering (SVG) | Browser (abcjs DOM → SVG) | — | abcjs renders into a DOM container |
| Pan/zoom for reading | Browser (native pinch-zoom + container CSS) | — | No JS lib needed when SVG is fluid + container scrolls vertically only |
| PDF print | Browser (popup/iframe + window.print) | OS (system print dialog) | Already iOS-Safari-tuned |
| Layout responsiveness | CSS (media queries + grid/flex collapse) | — | Pure CSS, no JS layout calc |
| Cross-browser testing | Manual (user-driven, real devices) | DevTools emulation (cheap pre-check) | No CI / paid farm per CLAUDE.md |

**Why this matters for Phase 4:** every responsibility above is already in the right tier. Phase 4 does not introduce new architecture — it tunes layout CSS and verifies behaviour. Anything that pushes work into a new tier (e.g., adding a server-side audio transcoder, adding a JS pan/zoom library) is over-scoped for MVP and contradicts the no-build-step constraint.

---

## Standard Stack

Phase 4 adds **zero new dependencies.** The entire phase is CSS + small JS/HTML refinements + a manual test pass. This is by design — adding a CDN dep for mobile work would mean fetching another JS bundle on every cold load, regressing the basic-pitch model-load budget on slow mobile networks.

### Core (already in the project, no version changes)
| Library | Version | Purpose | Why we don't change it |
|---------|---------|---------|------------------------|
| `abcjs` | 6.4.1 | Score → SVG renderer | Phase 1-3 verified working; we change *how we configure it* (viewBox + responsive options), not the lib. [VERIFIED: `web/index.html:9` and confirmed working in Phase 1 verification] |
| `@spotify/basic-pitch` | 1.0.1 | Pitch detection (TFJS) | Phase 2 watchdog provides the safety net for low-end mobile. [VERIFIED: `web/pipeline.js:20`] |
| Web Audio API | browser-native | Audio decode + resample | iOS `webkit*` prefix already handled at `pipeline.js:71,79` [VERIFIED: codebase] |

### Supporting (browser features we'll lean on but not import)
| Feature | Purpose | When to Use |
|---------|---------|-------------|
| CSS `@media (max-width: …)` | Responsive breakpoints | XPLAT-02 layout collapse |
| CSS `viewBox` + `width: 100%` on SVG | Fluid score sizing | XPLAT-02 score-container fix |
| CSS `touch-action` | Optional — opt-in/out of native gestures | If pinch-zoom on score needs tuning beyond defaults |
| `<meta name="viewport">` (already present) | Tells iOS Safari not to zoom out | Already at `index.html:5` — verify, do not regress |

### Explicitly NOT to add
| Tempting library | Why not |
|------------------|---------|
| `svg-pan-zoom` (npm) | Adds another CDN fetch + JS bundle; browser-native pinch-zoom on a properly-sized SVG is sufficient and free. [ASSUMED based on Phase 1-3 design philosophy of minimal deps] |
| BrowserStack / SauceLabs / Lambdatest | Paid, requires secrets, contradicts "no env secrets" (CLAUDE.md). Manual real-device pass on the user's own iPhone is the documented strategy. |
| Bundler-emitted PWA manifest | DIST-04 is explicitly v2-deferred in REQUIREMENTS.md. Out of scope. |

**Installation:** None. Phase 4 modifies existing files only.

**Version verification:** N/A — no new packages.

---

## Package Legitimacy Audit

> Skipped — Phase 4 installs zero external packages. The existing `abcjs@6.4.1` and `@spotify/basic-pitch@1.0.1` were audited in earlier phases and are in production use across Phase 1-3 verifications.

---

## Mobile Layout Audit (current state)

Walk-through of `web/index.html` + `web/style.css` against a 360×640 phone viewport (typical iPhone SE / lower-end Android).

### What's already correct

- `<meta name="viewport" content="width=device-width, initial-scale=1.0">` at `index.html:5`. [VERIFIED: file inspection]
- `body { font-family: ui-sans-serif, system-ui, -apple-system, ...; }` — system font stack, no web-font fetch on slow mobile networks. [VERIFIED: `style.css:17`]
- `main { max-width: 880px; margin: 0 auto; padding: 40px 24px 64px; }` — `max-width` is fine; the 24px side padding may eat into 360px viewport but doesn't break anything. [VERIFIED: `style.css:23-27`]
- Existing breakpoint `@media (max-width: 640px) { .controls { grid-template-columns: 1fr; } }` collapses the 3-column controls grid to one column. [VERIFIED: `style.css:340-342`]
- `.downloads { flex-wrap: wrap; }` — the 4 download buttons (MusicXML / PDF / SVG / ABC) already wrap when narrow. [VERIFIED: `style.css:295-300`]
- `.url-row { display: flex; }` with `.url-row input[type="url"] { flex: 1; min-width: 0; }` — URL input shrinks correctly; the **Get MP3 →** button stays right-aligned. [VERIFIED: `style.css:156-167`]

### What's broken on phones

| Issue | Where | Symptom | Severity |
|-------|-------|---------|----------|
| `.score { overflow-x: auto; }` with `staffwidth: 740` in abcjs render call | `style.css:306-312` + `main.js:193` | abcjs emits a fixed-width SVG ~740px wide; the container scrolls inside the page; on a 360px viewport users see only the first ~half of every line and must finger-swipe inside a tiny scroll region. | **HIGH** — directly violates "sheet music pans/zooms reasonably" success criterion. |
| `abcjs.renderAbc("score", abc, { responsive: "resize", staffwidth: 740, ... })` | `main.js:191-195` | `responsive: "resize"` is supposed to scale SVG to its container, but the explicit `staffwidth: 740` overrides it, locking the natural width. abcjs's responsive option works best when `staffwidth` is omitted or set conditionally. [CITED: github.com/paulrosen/abcjs issues #71, #90, #211 — long history of users hitting this exact interaction] | **HIGH** — drives issue above. |
| `.instructions { padding: 16px 20px; }` | `style.css:43-46` | Long `<warning>` text + nested `<details>` can crowd the controls below the fold on a phone — controls move out of the bottom-thumb zone. | **MEDIUM** — usability; not a layout break. |
| `.downloads` button labels: "Save MusicXML", "Download PDF", "Download SVG", "Download ABC" | `index.html:109-112` | At 360px after wrapping, 4 buttons stack 2×2 or 4×1; tap targets are fine but the wrapping looks scrappy. | **LOW** — cosmetic. |
| Controls block (file picker, instrument, Convert) appears mid-page on phones | `index.html:52-74` | Convert button is the only primary action but is bottom of the controls section — could be off-screen on first scroll if instructions are expanded. | **MEDIUM** — thumb-reach; addressable with `<details closed>` default + tighter spacing. |
| No mobile-specific font-size tweaks | `style.css` whole-file | iOS Safari may auto-shrink long URLs in `<input type="url">` to fit; the placeholder `https://www.youtube.com/watch?v=…` may overflow. iOS Safari also zooms in on focus for `<input>` whose `font-size < 16px` — current `font: inherit` resolves to 16px so we're OK, but the `.field` block uses `font-size: 0.9rem` which inherits to the input. [ASSUMED — iOS auto-zoom on inputs <16px is a well-known WebKit behaviour; verify on real device] | **MEDIUM** — would cause unwanted zoom-in on input focus. |

### What's already iOS-tuned but unverified

| Path | iOS-specific code | Status |
|------|-------------------|--------|
| `window.open(converterUrlFor(url), "_blank", "noopener")` BEFORE clipboard write | `main.js:66-75` | Code-correct; never run on a real iPhone (Phase 3 caveat) |
| `setTimeout(() => window.print(), 500)` in popup with `document.close()` before script | `main.js:411-420` | Code-correct; never run on a real iPhone (Phase 1 caveat) |
| `AudioContext` / `OfflineAudioContext` with `webkit*` fallback | `pipeline.js:71,79` | Code-correct; sample-rate fix landed in Phase 1; never end-to-end tested on real iOS |
| 20s reset-on-progress model watchdog with friendly error copy | `pipeline.js:45-146` | Code-correct; the trip path was never observed on a real device |

---

## Recommended Approach (per requirement)

### XPLAT-01 — Audio file upload works on all target browsers

**Status of current code:** structurally correct on every target browser. Real-world risks are:

1. **iOS Safari Voice Memo files** are `.m4a` (AAC inside MP4 container). The HTML file picker exposes them as MIME `audio/mp4` or `audio/x-m4a` depending on iOS version. Some Safari versions send the file as `audio/mpeg` which can confuse `accept="audio/*"` filters. [VERIFIED: addpipe, drupal.org/file_entity issue #3133613, openai community thread — all confirm m4a MIME inconsistency on iOS]
2. **`AudioContext` user-gesture requirement on iOS Safari/WebKit** — `new AudioContext()` works without a gesture for decode, but if it ever needed to `resume()`, it would need to happen inside a click handler. Current flow: Convert button click → `runPipeline` → `decodeAudio` → `new Ctx()` then `decodeAudioData`. **This is inside the click handler**, so it's safe; the OfflineAudioContext in the resample branch is constructed inside the same async stack and runs `startRendering()` which doesn't need a fresh gesture. [VERIFIED: `pipeline.js:68-86` is invoked from `main.js:96` inside the click handler]
3. **basic-pitch model on mobile** — the TFJS WebGL backend may fail on iOS Safari low-power mode or in private browsing. Phase 2's `ModelLoadError` is the fallback: the 20s watchdog plus the curated copy ("Try Chrome, Edge, or Firefox on a laptop or desktop computer") is the user-facing safety net. **Phase 4 must not regress this watchdog.**
4. **Android Chrome** — historically the least problematic. `accept="audio/*"` typically opens the system file browser; some Android variants open a "Music" app instead. No structural code change expected.
5. **Desktop browsers** — Chrome / Safari / Firefox / Edge all support the entire stack (Web Audio API, `<input type="file" accept>`, TFJS, abcjs). The risk surface is small.

**Recommended changes (small, defensive):**

- **Loosen the file accept filter:** change `accept="audio/*"` to `accept="audio/*,.m4a,.mp3,.wav,.ogg,.flac,.aac,.aiff"` so iOS Voice Memos and other files that arrive with a non-`audio/*` MIME still appear in the picker. [CITED: MDN file-input accept attribute — extension fallbacks are honoured alongside MIME globs]
- **Improve the decode-error message** in `pipeline.js:decodeAudio`: wrap `decodeAudioData` in a try/catch that surfaces "We couldn't decode this audio file in your browser. Try converting it to MP3 or WAV first." instead of the raw DOMException. (Phase 2 already handles model errors; this closes the symmetric gap for decode errors.)
- **Add a one-line note under the file input** clarifying which formats work: "Most audio files work — MP3, WAV, M4A (iPhone voice memos), OGG, FLAC."
- **Do NOT add `capture="user"` or `capture="microphone"`** on the file input — that forces the file picker to open the camera/mic UI on mobile instead of the file browser. Out of scope (mic capture is in REQUIREMENTS.md "Out of Scope").

**Verification (per device):** see Test Matrix below. Plan should include 1 plan/2 small tasks: (a) the defensive fixes above; (b) the test matrix walked by user on real iPhone + Android (if available).

---

### XPLAT-02 — Layout usable on a phone

**Status of current code:** the viewport meta + grid collapse are present but the score container is the load-bearing problem.

**Recommended changes:**

#### 1. Fix the score container (HIGH priority)

In `web/main.js:191-195`, drop the explicit `staffwidth: 740` — let abcjs's `responsive: "resize"` work as documented. Alternatively, set `staffwidth` dynamically based on the container's `clientWidth` measured on render:

```javascript
// In main.js, replace the renderAbc call
const scoreContainer = document.getElementById("score");
const containerWidth = Math.max(280, scoreContainer.clientWidth - 24); // 24 = padding
ABCJS.renderAbc("score", abc, {
  responsive: "resize",
  staffwidth: containerWidth,
  add_classes: true,
  viewportHorizontal: false,
});
```

Then in `web/style.css:306-312`:

```css
.score {
  background: #fff;
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 12px;
  /* on mobile: pinch-to-zoom the page works because container is fluid */
  overflow-x: auto;     /* keep — desktop users with very wide scores still want scroll */
  -webkit-overflow-scrolling: touch;  /* iOS momentum scroll inside container */
}
.score svg {
  max-width: 100%;
  height: auto;
}

/* On phones, let the page (not the container) be the scroll surface */
@media (max-width: 640px) {
  .score { overflow-x: hidden; }
  .score svg { width: 100%; }
}
```

This makes the score scale to viewport on phones (readable, no horizontal page scroll), while desktop keeps the natural-width-with-horizontal-scroll behaviour for very long scores. [VERIFIED: abcjs issues #71/#90/#211 document this as the working pattern when paired with `responsive: "resize"`]

#### 2. Tighten the input font size (prevents iOS focus zoom)

Add at the top of `style.css` or in the existing mobile media query:

```css
@media (max-width: 640px) {
  input[type="file"],
  input[type="url"],
  select {
    font-size: 16px;  /* iOS Safari won't auto-zoom on focus when ≥16px */
  }
}
```

[ASSUMED — iOS auto-zoom-on-focus for inputs with computed font-size <16px is a long-documented WebKit behaviour; verify on real device during test matrix]

#### 3. Improve thumb-reach by collapsing instructions by default on mobile

The `<details>` element at `index.html:34` already collapses the "Why two steps?" block. The outer `.instructions` `<section>` containing the 4-step `<ol>` is always-visible. Consider:

```css
@media (max-width: 640px) {
  /* Trim padding so primary controls sit higher on the viewport */
  .instructions { padding: 12px 14px; margin-bottom: 12px; }
  main { padding: 16px 12px 48px; }
}
```

Also: confirm during user testing whether converting the always-visible `<ol>` to a top-level `<details open>` improves thumb-reach without hurting first-visitor clarity. **This is a discretionary call — leave as-is unless test matrix surfaces a complaint.**

#### 4. Make download row stack cleanly at 360px

The `.downloads` row already has `flex-wrap: wrap`, so 4 buttons will wrap to 2 rows on a narrow phone. Acceptable as-is. If user testing flags it as ugly:

```css
@media (max-width: 480px) {
  .downloads { display: grid; grid-template-columns: 1fr 1fr; }
}
```

#### 5. Verify no horizontal scroll on the page itself

Add to QA pass: load the page on a 360px viewport (DevTools or real phone), scroll vertically to bottom; if the page ever scrolls horizontally even 1px, find the offender (usually a long URL, code block, or unbroken string). Common culprits: the `<pre id="letters-text">` in `index.html:117` — it has `white-space: pre-wrap; word-wrap: break-word;` set at `style.css:325-326`, so it should be fine; verify.

**Estimated footprint for XPLAT-02:** 40-90 LOC of CSS + 5-10 LOC change to `main.js` `renderAbc` call.

---

## Test Matrix (browser × scenario)

**This is the deliverable that closes the deferred-iOS-test debt from Phases 1-3.** Each cell becomes one observation during the manual test pass. The user runs this matrix against the **deployed GitHub Pages URL** (not localhost — Phase 3 cobalt handoff and Phase 1 PDF popup behave differently when origin is `localhost` vs a real https origin).

### Devices in scope

| Device class | Test approach | Owner | Status |
|--------------|---------------|-------|--------|
| **iPhone (real, iOS Safari)** | User pulls out their own iPhone, hits deployed URL | User | Available (per phase context) |
| **Android Chrome (real)** | Borrow / use any Android phone if accessible; otherwise use Chrome DevTools mobile emulation as **best-effort** with explicit caveat in test matrix that emulation ≠ real device | User | **Flag if not accessible** |
| **Desktop Chrome (Mac)** | Direct browser test | User | Available |
| **Desktop Safari (Mac)** | Direct browser test | User | Available |
| **Desktop Firefox (Mac)** | Install if absent; direct test | User | Verify availability |
| **Desktop Edge (Mac)** | Install if absent; direct test (or accept Chrome as proxy since both are Chromium) | User | **Verify or substitute** |
| **DevTools mobile emulation** | Pre-check before real-device pass; catches obvious layout breaks cheaply | Claude (during plan execution) | Available |

### Scenarios (rows of the matrix)

| # | Scenario | Trigger | Pass criterion |
|---|---------|---------|----------------|
| S1 | Page loads without console error | Visit deployed URL | No red errors in DevTools console; page renders fully |
| S2 | Viewport: no horizontal page scroll | Visit on phone viewport | Drag finger left/right anywhere on page — nothing scrolls horizontally |
| S3 | Controls reachable with one thumb | Phone viewport | File picker + instrument dropdown + Convert button all reachable without two-hand grip |
| S4 | Audio file upload picker opens | Tap "Audio file" input | OS file picker / "Choose from Files" sheet appears |
| S5 | M4A (Voice Memo) accepted | Pick an iPhone Voice Memo `.m4a` | File appears in input, Convert button enables |
| S6 | MP3 accepted | Pick any MP3 | Same |
| S7 | WAV accepted | Pick any WAV | Same |
| S8 | OGG accepted (skip on iOS Safari — not natively decodable) | Pick OGG | Either decodes OR shows the friendly decode-error message (NOT a silent fail) |
| S9 | Full pipeline runs end-to-end | Pick valid audio → Convert | Stage list advances Decoding → Loading model → Transcribing (with %) → Rendering; score appears |
| S10 | Model load on mobile completes OR fails friendly | First-time visit, cold cache | Either the model loads and pipeline finishes within ~60s OR the 20s ModelLoadError appears with the curated copy (NOT an infinite spinner) |
| S11 | Score readable on phone | After S9, scroll to score | Score is visible at usable size; pinching out makes notes legible; no tiny scrollbar inside the score container |
| S12 | Save MusicXML downloads a file | Tap "Save MusicXML" | A `.musicxml` file lands in Downloads / Files |
| S13 | Download PDF opens print dialog | Tap "Download PDF" | iOS: print preview appears with score visible (NOT blank). Desktop: print dialog appears. (closes Phase 1 deferred caveat) |
| S14 | YouTube Get MP3 button opens cobalt | Paste YouTube URL + tap Get MP3 | New tab opens at cobalt.tools with URL prefilled in hash (closes Phase 3 deferred caveat). On iOS: no popup-blocker prompt. |
| S15 | Instrument persists across reload | Pick Tenor Sax → reload | Dropdown still says Tenor Saxophone (closes Phase 2 deferred caveat) |
| S16 | Page works in Safari private mode | Open in private window | No exceptions; instrument defaults to Alto Sax silently (closes Phase 2 Scenario C) |

### Matrix template (markdown table to fill in during execution)

|  | iOS Safari | Android Chrome | Desktop Chrome | Desktop Safari | Desktop Firefox | Desktop Edge |
|--|-----------|----------------|----------------|----------------|-----------------|--------------|
| S1 Page loads | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| S2 No h-scroll | ⬜ | ⬜ | N/A | N/A | N/A | N/A |
| S3 Thumb reach | ⬜ | ⬜ | N/A | N/A | N/A | N/A |
| S4 Picker opens | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| S5 M4A accepted | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| S6 MP3 accepted | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| S7 WAV accepted | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| S8 OGG (or friendly fail) | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| S9 Pipeline runs | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| S10 Model load OR friendly fail | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| S11 Score readable | ⬜ | ⬜ | N/A | N/A | N/A | N/A |
| S12 MusicXML download | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| S13 PDF print | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| S14 cobalt handoff | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| S15 Instrument persists | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| S16 Private mode | ⬜ | N/A | N/A | ⬜ | N/A | N/A |

Cell legend: ✅ pass / ❌ fail with note / ⚠️ partial with note / N/A not applicable for this device class.

**Failure handling protocol:** every ❌ becomes a triage decision — fix-in-phase (small fix, no regression risk) OR punt-to-v1.1 (with a 1-line note in `STATE.md` Open Todos). The phase doesn't try to fix everything; it documents what's known broken and ships honest.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Pinch-to-zoom on the score | A `svg-pan-zoom` JS library | Browser-native pinch-zoom on a properly sized SVG with `viewBox` | Adds CDN fetch + JS, increases mobile load time; native gestures are smoother and ad-free |
| Cross-browser test automation | Playwright + CI matrix + saucelabs key | Manual real-device pass + documented test matrix | No env-secrets per CLAUDE.md; no CI infrastructure; user has the devices needed |
| Detect iOS to gate behaviour | `navigator.userAgent` sniffing | Feature detection (`window.webkitAudioContext`, `'ontouchstart' in window`) where actually needed | UA sniffing is fragile; we already do feature detection at `pipeline.js:71,79` |
| Responsive PDF print template | A new HTML/CSS print template tuned per device | Trust the Phase 1 popup+iframe path; verify it via S13 | Phase 1 already engineered this; Phase 4 verifies, doesn't rebuild |
| Audio format conversion in-browser | A ffmpeg.wasm transcoder | Trust browser's `decodeAudioData` + the friendly error path | ffmpeg.wasm is ~25MB cold load; the audio formats users have (mp3, wav, m4a) decode natively on every target browser |

**Key insight:** Phase 4 is a verification + small-fix phase, not a feature phase. Every "don't build" above is a temptation that would inflate scope past MVP and risk regressing Phases 1-3.

---

## Implementation Notes

### Where the fixes go

| File | What changes | Why |
|------|--------------|-----|
| `web/style.css` | Mobile media queries: score container fluid, input font-size ≥16px, tighter padding on phones | XPLAT-02 |
| `web/main.js` | `renderAbc` call: drop hard `staffwidth: 740` OR set it from container width; optional decode-error try/catch in `runPipeline` orchestrator if we want symmetry with Phase 2's error path | XPLAT-02 + XPLAT-01 |
| `web/pipeline.js` | `decodeAudio`: wrap `decodeAudioData` in try/catch, throw new `AudioDecodeError` with friendly copy | XPLAT-01 defensive |
| `web/index.html` | `accept` attribute on file input expanded; small note under file input listing supported formats | XPLAT-01 |
| `.planning/phases/04-cross-browser-mobile/04-test-matrix.md` (new) | Filled-in test matrix from execution | XPLAT-01 + XPLAT-02 verification |

**Estimated LOC:** ~50-100 lines of CSS + 10-20 lines of JS + 2-3 lines of HTML + the test matrix doc.

### Wave structure (recommended)

- **Wave 1 (parallel-safe):**
  - Plan 04-01 — Mobile layout: CSS media queries, score container fluid sizing, input font-size, `main.js` renderAbc tweak. ~60 LOC.
  - Plan 04-02 — Audio upload hardening: `accept` attribute widening, `decodeAudio` try/catch + friendly error copy, small `<small>` hint under file input. ~20 LOC.
- **Wave 2 (depends on Wave 1):**
  - Plan 04-03 — Cross-browser test matrix execution. User-driven (checkpoint:human-verify). Output: filled-in test matrix doc + triage list (fixes to ship in this phase vs. punt to v1.1).

(Final plan structure is the planner's call — this is a recommendation, not a lock.)

### Deploy-and-test cycle

Real-device testing happens against the **deployed GitHub Pages URL**, not localhost. Loop:

1. Make CSS/JS changes locally.
2. Run desktop browser smoke (DevTools emulation) to catch obvious regressions.
3. Commit → push to `main` → GitHub Pages auto-deploys (per project history).
4. On the real device, hard-reload the deployed URL (iOS Safari needs Clear History on the site domain or a tab swipe-close + relaunch to dodge service-worker/cache; we don't have an SW yet so a normal pull-to-refresh should work, but be aware).
5. Walk the test matrix scenarios for that device.
6. Note results; if any fail → triage → either fix and re-deploy or punt.

The deploy cycle is fast (Pages typically deploys in 1-3 min). Plan to budget ~30-60 min for a full real-device matrix walk.

### Edge case: GitHub Pages cache + iOS Safari

iOS Safari is aggressive about caching static assets. If the user has visited the page before, the basic-pitch model and JS modules may be cached. For Phase 4's purposes:

- **Pro:** good — proves the "second-visit" experience.
- **Con:** during testing, you may not actually be exercising the cold-load path. To test cold load: open in a fresh Private tab, OR Settings → Safari → Clear History and Website Data for the domain.
- For testing the 20s `ModelLoadError` path: use DevTools (desktop Safari) to throttle network, or use Network Link Conditioner on iOS to simulate.

---

## Common Pitfalls

### Pitfall 1: abcjs `responsive: "resize"` + explicit `staffwidth` collide
**What goes wrong:** Setting `staffwidth: 740` while also requesting `responsive: "resize"` produces an SVG that has `width="740"` baked in; on a 360px container, the SVG overflows and the `.score { overflow-x: auto; }` shows a scrollbar inside the box.
**Why it happens:** `staffwidth` controls the abcjs internal staff width; `responsive: "resize"` adds the viewBox-based scaling. The two options interact in non-obvious ways. [CITED: github.com/paulrosen/abcjs issues #71, #211]
**How to avoid:** either omit `staffwidth` and let abcjs pick (it defaults to ~740) and rely on viewBox-driven CSS scaling, OR compute `staffwidth` from `container.clientWidth` at render time. The CSS rule `.score svg { max-width: 100%; height: auto; }` is the seatbelt regardless of which approach you pick.
**Warning signs:** A scrollbar inside the score box on phones; the score appears clipped at a fixed width.

### Pitfall 2: iOS Safari auto-zooms into inputs with font-size <16px
**What goes wrong:** User taps file input or URL field on iPhone; Safari zooms the page in to make the input legible; layout shifts; user is now disoriented and must double-tap to zoom back.
**Why it happens:** Long-standing WebKit accessibility behaviour. iOS Safari treats any input with computed font-size <16px as "too small" and zooms the viewport on focus.
**How to avoid:** Force `font-size: 16px` (or larger) on `input` and `select` inside the mobile media query. Don't change desktop sizing.
**Warning signs:** Page suddenly zooms when you tap a form field; manually pinching back out feels like fighting the browser.

### Pitfall 3: iOS Safari Voice Memo MIME inconsistency
**What goes wrong:** User picks an iPhone Voice Memo (`.m4a`); the file appears greyed-out in the picker because `accept="audio/*"` doesn't match the MIME Safari reports; OR the file is selected but `decodeAudioData` rejects it.
**Why it happens:** Different iOS Safari versions report `.m4a` as `audio/mp4`, `audio/x-m4a`, or `audio/mpeg` depending on Safari build. [VERIFIED: drupal.org/file_entity issue #3133613, openai community thread]
**How to avoid:** Add explicit extensions to `accept`: `accept="audio/*,.m4a,.mp3,.wav,.ogg,.flac,.aac,.aiff"`. If `decodeAudioData` rejects, the new try/catch surfaces a useful message.
**Warning signs:** Picker filters out valid audio; user reports "I can't pick my recording."

### Pitfall 4: basic-pitch model loads silently slow on mobile data
**What goes wrong:** User on cellular/3G visits the page; the multi-MB model takes >20s to download; the watchdog trips with `ModelLoadError` even though the model would have loaded eventually given more time.
**Why it happens:** The 20s watchdog (Phase 2) is reset by progress events from `bp.evaluateModel`'s percent callback. **Progress events do NOT fire during the initial model fetch — only during inference.** So on a slow first-load, the watchdog sees zero progress for >20s and trips.
**How to avoid:** This is a known design choice from Phase 2 — the trade-off is "false-positive on slow first-load" vs "infinite-spinner on dead browser." Phase 4 should validate behaviour on real cellular, then decide: keep watchdog as-is (and add a one-line note in the error copy: "On slow connections, try again on Wi-Fi"), or extend the timeout to 30-45s for the model-loading stage specifically.
**Warning signs:** User on cellular reports "it always says it can't load the model" while desktop works fine. **Surface this in the test matrix as a discussion item.**

### Pitfall 5: GitHub Pages CDN cache makes the "real device" test stale
**What goes wrong:** You push a CSS fix, the user reloads on iPhone, but the old CSS is cached and the bug appears to persist.
**Why it happens:** GitHub Pages serves assets with long cache headers; mobile Safari caches aggressively.
**How to avoid:** During test cycles, ask the user to fully close the tab and reopen, OR use Settings → Safari → Clear Website Data. Worst case: bust the cache by appending `?v=N` to `style.css` / `main.js` references in `index.html` while testing.
**Warning signs:** Fix doesn't appear to work; "did you reload?" is the answer.

### Pitfall 6: iframe-fallback PDF print silently fails on iOS Safari
**What goes wrong:** Phase 1's PDF path tries `window.open` first (popup), falls back to a hidden iframe. iOS Safari may block both paths if the user has set "Block Pop-ups" AND the iframe path doesn't fire `print()` reliably from a hidden iframe.
**Why it happens:** iOS Safari treats hidden iframes inconsistently for `print()`. The print dialog needs a visible context.
**How to avoid:** Phase 1 left the iframe path in as a defense in depth; Phase 4 verifies via S13. If it fails, document in the test matrix and add a user-facing tip: "If PDF doesn't appear on iPhone, use Download SVG and convert via Files app." Don't rebuild the PDF path in Phase 4 — that's scope creep.
**Warning signs:** S13 fails on iOS Safari; print dialog never appears.

---

## Code Examples

### Fluid score container with abcjs

```css
/* style.css — replace the current .score rules */
.score {
  background: #fff;
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 12px;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}
.score svg {
  max-width: 100%;
  height: auto;
  display: block;
}
@media (max-width: 640px) {
  .score { overflow-x: hidden; }
  .score svg { width: 100%; }
}
```

### renderAbc call that respects container width

```javascript
// main.js — replace existing ABCJS.renderAbc call in renderResult()
const scoreContainer = document.getElementById("score");
// Read clientWidth AFTER the result section is unhidden so the container
// has a real layout box; subtract padding to leave breathing room.
resultEl.hidden = false;
const containerWidth = Math.max(280, scoreContainer.clientWidth - 24);
ABCJS.renderAbc("score", abc, {
  responsive: "resize",
  staffwidth: containerWidth,
  add_classes: true,
});
```
[CITED: paulrosen/abcjs README — `staffwidth` is documented; `responsive: "resize"` is the supported responsive option]

### iOS-safe input font sizing

```css
/* style.css — inside existing @media (max-width: 640px) block */
@media (max-width: 640px) {
  .controls { grid-template-columns: 1fr; }
  /* Prevent iOS Safari from zooming on input focus */
  input[type="file"],
  input[type="url"],
  select {
    font-size: 16px;
  }
}
```

### Friendly decode error

```javascript
// pipeline.js — wrap decodeAudioData in decodeAudio()
export class AudioDecodeError extends Error {
  constructor(msg) { super(msg); this.name = "AudioDecodeError"; }
}

const AUDIO_DECODE_COPY = "We couldn't decode this audio file in your browser. Try MP3 or WAV — those work everywhere. If you exported from iPhone Voice Memos, share it from the Voice Memos app as an MP3 first.";

// inside decodeAudio, replace the bare decodeAudioData call:
let decoded;
try {
  decoded = await tmp.decodeAudioData(arrayBuf);
} catch (err) {
  tmp.close();
  throw new AudioDecodeError(AUDIO_DECODE_COPY);
}
```

The catch in `main.js:98` already surfaces `err.message` via `showError`, so no main.js change needed.

### Widened accept attribute

```html
<!-- index.html line 64 — replace existing input -->
<input
  type="file"
  id="audio-input"
  accept="audio/*,.m4a,.mp3,.wav,.ogg,.flac,.aac,.aiff"
/>
<small>Most audio files work — MP3, WAV, M4A (iPhone voice memos), OGG, FLAC.</small>
```

---

## State of the Art

| Old approach | Current approach | When changed | Impact |
|--------------|------------------|--------------|--------|
| Fixed-width SVG with `overflow-x: auto` parent | viewBox-driven SVG with `max-width: 100%` parent | Modern responsive pattern, stable since 2015 | Native pinch-zoom on phones, no extra JS lib |
| UA sniffing for iOS/Android | Feature detection (`webkit*` prefixes, `'ontouchstart' in window`) | Already in use in this codebase | Less fragile across iOS Safari versions |
| Polyfilling AudioContext | Native + `webkitAudioContext` fallback only | iOS 14+ has full AudioContext support; `webkit*` is still required for older devices | Two lines of fallback covers all targets |
| `<meta name="viewport" content="user-scalable=no">` | Modern accessibility guidance recommends LEAVING pinch-zoom enabled | WCAG 2.1 SC 1.4.4 | Our current viewport meta does NOT disable user-scalable — correct |

**Deprecated/outdated:**
- `document.execCommand('print')` — deprecated; do not use as PDF fallback. Phase 1 correctly uses `window.print()`.
- `navigator.userAgent` parsing for iOS detection — fragile; prefer feature detection.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | iOS Safari auto-zooms on focus for inputs with computed font-size <16px | Pitfall 2, XPLAT-02 recommendation | If wrong, the 16px rule is harmless overhead — no risk |
| A2 | `svg-pan-zoom` lib is unnecessary because browser-native pinch-zoom is sufficient when SVG is fluid | Don't Hand-Roll | If user testing shows pinch-zoom is awkward (e.g. competing with page zoom), we may need to add the lib in a v1.1 follow-up. Phase 4 ships without and verifies. |
| A3 | Cobalt MEDIUM-confidence risk from Phase 3 has not changed since 2026-05-30 | Test Matrix S14 | If cobalt is down on test day, S14 fails; Phase 3 already gated on `DOWNLOADERS.md` ritual — this is a Phase 5 / ship-day re-verify, not a Phase 4 blocker |
| A4 | 20s model-load watchdog reset behaviour does NOT see progress events during initial CDN fetch (only during inference) | Pitfall 4 | If wrong (i.e. progress fires during fetch), then false-positive risk on slow networks goes away — phase improves naturally |
| A5 | Android device may not be accessible to user | Test Matrix Devices in scope | If unavailable, Android Chrome row falls back to DevTools emulation with explicit caveat. Phase ships but acknowledges the gap in `STATE.md` |
| A6 | iframe-fallback PDF print may behave unpredictably on iOS Safari | Pitfall 6 | If S13 fails, the path is documented as iOS-Safari-incompatible and a workaround tip is added — does not block phase |
| A7 | GitHub Pages auto-deploy from main is already wired (per Phase 5 future work) | Implementation Notes / Deploy cycle | If not, user pushes to main but no deploy fires — Phase 5 owns this; if it bites Phase 4 testing, escalate to Phase 5 |
| A8 | Voice Memos exported via "Share" on iPhone produce `.m4a` files with MIME issues | XPLAT-01 / Pitfall 3 | Well-documented per the cited sources; if not reproducible, the wider `accept` attribute is harmless |

---

## Open Questions

1. **Is the user's Android device available?**
   - What we know: phase context says "Android device may or may not be accessible — flag if Android testing requires user procurement."
   - What's unclear: yes/no for this milestone.
   - Recommendation: Plan should include a checkpoint asking the user explicitly, and if no Android available, mark S* Android cells as "DevTools emulation only" with that caveat in the verification doc. This is honest reporting per the GSD verification philosophy.

2. **Should we ship a "known limitations" section in `web/README.md` after the test matrix runs?**
   - What we know: if any cells fail and are punted to v1.1, users on those devices may hit them silently.
   - What's unclear: whether DIST-01 (Phase 5) owns this README update or whether Phase 4 should.
   - Recommendation: Phase 4 captures findings; Phase 5 owns the README polish that surfaces them to end users.

3. **What about `<input type="file">` `capture` attribute for "record in app"?**
   - What we know: REQUIREMENTS.md lists "Real-time mic capture" as out of scope.
   - Recommendation: explicitly **do not** add `capture="user"` or `capture="microphone"` in Phase 4. Out of scope.

4. **Does the user have desktop Edge installed on Mac?**
   - What we know: Edge on Mac is a real browser but uncommon.
   - Recommendation: if absent, Chrome is acceptable substitute (both Chromium). Note in test matrix.

5. **iOS PWA install / Add to Home Screen behaviour?**
   - DIST-04 (PWA manifest + SW) is v2-deferred per REQUIREMENTS.md.
   - Recommendation: out of scope. Don't add manifest in Phase 4 even if tempting.

---

## Environment Availability

| Dependency | Required by | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| iPhone with Safari | XPLAT-01 + XPLAT-02 real-device test | ✓ (per phase context) | iOS version TBD by user | None — required for honest sign-off |
| Android device with Chrome | XPLAT-01 real-device test | ✗ uncertain | — | DevTools mobile emulation with explicit caveat in test matrix |
| Mac with Chrome + Safari + Firefox + Edge | Desktop smoke per-browser | ✓ (per phase context; Firefox/Edge may need install) | latest stable | Chrome substitutes for Edge if Edge unavailable (both Chromium) |
| `python3 -m http.server` | Local dev iteration before deploy | ✓ (Mac default) | 3.x | Any static server |
| Git + GitHub Pages auto-deploy | Deploy-and-test cycle | Assumed ✓ (per project history) | — | Phase 5 owns Pages hardening |
| Chrome DevTools (mobile emulation) | Cheap pre-check before real device | ✓ (bundled with Chrome) | latest | Firefox Responsive Design Mode |
| Network throttling tool (for testing model timeout on slow connection) | Pitfall 4 validation | ✓ (Chrome DevTools, Safari Web Inspector, iOS Network Link Conditioner) | — | Trust real cellular if convenient |

**Missing dependencies with no fallback:** none that block the phase. Android unavailability degrades but doesn't block — capture honestly.

**Missing dependencies with fallback:** Edge (use Chrome), Android device (DevTools emulation with caveat).

---

## Validation Architecture

> Skipped — `workflow.nyquist_validation` is explicitly `false` in `.planning/config.json`.

---

## Security Domain

> Skipped — Phase 4 is layout + verification only. No new auth, session, input-validation surfaces. Existing inputs (file upload, URL input) were security-audited implicitly in Phases 1-3 (e.g., `escapeHtml` on titles, `encodeURIComponent` on YouTube URLs, no `innerHTML` of untrusted strings). No new external data sources are introduced. ASVS V5 (Input Validation) is already covered by the existing XML/HTML escape helpers and `encodeURIComponent` use; no new controls needed.

If the discuss-phase or planner believes a security review is warranted (e.g., new file type handling could surface a parsing CVE), surface that as an open question. Default position: no additional security controls needed for Phase 4.

---

## Sources

### Primary (HIGH confidence)
- `web/index.html`, `web/style.css`, `web/main.js`, `web/pipeline.js`, `web/downloaders.js`, `web/README.md` — current implementation state, read in full during research
- `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`, `.planning/STATE.md`, `.planning/config.json` — milestone definition + workflow config
- `.planning/phases/01-score-export-parity/01-VERIFICATION.md` — documents deferred iOS PDF + MuseScore tests
- `.planning/phases/02-instrument-persistence-error-handling/02-VERIFICATION.md` — documents deferred 6 browser scenarios; defines `ModelLoadError` watchdog architecture
- `.planning/phases/03-youtube-handoff-polish/03-VERIFICATION.md` — documents deferred live cobalt + iOS Safari popup tests
- `.planning/phases/01-score-export-parity/01-RESEARCH.md` — section on iOS Safari PDF print blank-preview pitfall (line 356), used as the canonical iOS-print reference

### Secondary (MEDIUM confidence)
- [GitHub paulrosen/abcjs issue #71 — viewBox vs fixed dimensions](https://github.com/paulrosen/abcjs/issues/71)
- [GitHub paulrosen/abcjs issue #90 — responsive SVG feature request](https://github.com/paulrosen/abcjs/issues/90)
- [GitHub paulrosen/abcjs issue #211 — unexpected behaviour with responsive resize](https://github.com/paulrosen/abcjs/issues/211)
- [Drupal file_entity issue #3133613 — M4A MIME type playback issue in Safari 13.1](https://www.drupal.org/project/file_entity/issues/3133613)
- [OpenAI community — Issues with audio files from iOS and the x-m4a format](https://community.openai.com/t/issues-with-audio-files-from-ios-and-the-x-m4a-format/794701)
- [AddPipe — Record Lossless Audio in Safari (codec support overview)](https://blog.addpipe.com/record-high-quality-audio-in-safari-with-alac-and-pcm-support-via-mediarecorder/)

### Tertiary (LOW confidence — verify during execution)
- iOS Safari auto-zoom on input font-size <16px — well-known but unverified in this session. Confirm with quick real-device test before relying on the 16px fix being load-bearing.
- iframe-fallback `window.print()` reliability on iOS Safari — uncertain; S13 of test matrix is the verification gate.
- 20s `ModelLoadError` watchdog progress-event-during-fetch behaviour (Pitfall 4) — based on reading Phase 2 code; not empirically tested on slow connections.

---

## Metadata

**Confidence breakdown:**

| Area | Level | Reason |
|------|-------|--------|
| Mobile layout audit | HIGH | Direct read of current `style.css` + `index.html`; well-known responsive CSS patterns |
| XPLAT-02 fix recipe (fluid SVG) | MEDIUM-HIGH | abcjs issues cited; pattern is standard but exact interaction with `staffwidth` should be verified live during execution |
| XPLAT-01 audio decode robustness | HIGH | Codebase already has `webkit*` fallback + Phase 1 sample-rate fix; remaining risks are documented MIME quirks with clear mitigations |
| iOS Safari pitfalls (auto-zoom, MIME, print) | MEDIUM | Well-documented in community sources; real-device confirmation is the test matrix's job |
| Test matrix design | HIGH | Directly closes documented deferrals from Phases 1-3 verifications |
| basic-pitch behaviour on mobile WebGL | MEDIUM-LOW | Phase 2 watchdog is the safety net; actual TFJS behaviour on a 2-year-old iPhone is unknown until tested |
| GitHub Pages deploy cycle | MEDIUM | Inferred from project history; Phase 5 owns the formal audit |

**Research date:** 2026-05-30
**Valid until:** 2026-06-29 (30 days — abcjs, basic-pitch, iOS Safari behaviour all change slowly; cobalt.tools status should be re-checked on ship day via DOWNLOADERS.md ritual regardless)
