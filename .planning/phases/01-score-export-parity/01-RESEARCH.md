# Phase 1: Score Export Parity - Research

**Researched:** 2026-05-28
**Domain:** Browser-side music notation export (MusicXML + PDF) and pipeline progress UX
**Confidence:** HIGH

## Project Constraints (from CLAUDE.md)

- Static ES modules only; CDN deps via esm.sh + jsdelivr; **no build step / no bundler** [VERIFIED: CLAUDE.md]
- GitHub Pages static hosting — no server, no env secrets [VERIFIED: CLAUDE.md]
- Must work on modern evergreen browsers including **iOS Safari** [VERIFIED: CLAUDE.md]
- All file-editing work routed through a GSD command (this RESEARCH.md is the gate to `/gsd:plan-phase`) [VERIFIED: CLAUDE.md]
- No emojis in code/docs unless asked [VERIFIED: CLAUDE.md]

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PAR-01 | Export rendered score as MusicXML | Recommended Approach §A (hand-write MusicXML from `result.notes`) |
| PAR-02 | Export rendered score as PDF | Recommended Approach §B (keep popup+print, harden fallback + error path) |
| PAR-04 | Show stage-by-stage progress | Recommended Approach §C (typed stage object replacing free-text string) |

## Summary

The web pipeline (`web/pipeline.js`) already produces a clean, quantized monophonic line `{notes: [{midi, ql}], bpm, key, letters}` with all the structural decisions a score needs already locked in: 4/4 time signature, written-pitch MIDI numbers, quarter-note grid, key signature, instrument transposition semitones. **The data is simpler than MusicXML.** That means hand-writing a minimal MusicXML emitter in pure JS (zero new deps) is the lowest-risk path for PAR-01 — every JS-side MusicXML emitter library on npm is either an import-only parser (`xml2abc-js`), a renderer (OSMD), or requires a bundler (`@stringsync/musicxml`).

PDF export (PAR-02) is already wired via a popup window calling `window.print()`. The main risks are popup blockers (already messaged), iOS Safari quirks with `window.print` from an opened document, and SVG sizing. The fix is hardening: an in-page hidden iframe fallback that avoids the popup-blocker risk, explicit `<svg>` width/height attributes for print sizing, and Safari-specific timing.

Stage progress (PAR-04) currently uses a single string callback `progress(msg)`. The UI shows the latest string. For a stage indicator that names the current step and shows percent within the long-running ML stage, the smallest change is to upgrade the callback contract from `(string)` to `({stage, label, percent?})` while keeping all five existing call sites backward-compatible via a tiny wrapper.

**Primary recommendation:** Hand-write MusicXML from `result.notes`; keep print-popup PDF flow but add iframe fallback + iOS Safari handling; refactor `progress(msg)` to `progress({stage, label, percent})` with a discrete stage enum.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Audio decode | Browser (Web Audio API) | — | `AudioContext.decodeAudioData` is the only available decoder client-side |
| ML inference | Browser (TFJS via basic-pitch) | CDN (model bytes) | Model.json + weight shards fetched from jsdelivr; tensors run in-browser |
| Score data shape | Browser (pipeline.js) | — | All quantize/key/transpose logic already lives client-side |
| ABC -> SVG render | Browser (abcjs UMD global) | — | Already in place; not changing in this phase |
| MusicXML serialize | Browser (new module) | — | Pure string emission from `result.notes`; no server, no deps |
| PDF generation | Browser print dialog | OS (PDF writer) | User picks "Save as PDF" in their browser/OS print dialog — no JS PDF lib needed |
| Stage progress UX | Browser (DOM) | — | Pipeline emits events, UI listens and renders |
| File delivery | Browser (Blob + anchor download) | — | Static-host constraint forbids server endpoints |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| (none new) | — | MusicXML emit | Hand-rolled. Data shape is too simple to justify a dep, and no zero-build CDN ESM MusicXML emitter exists. [VERIFIED: web research — see §Alternatives Considered] |
| abcjs | 6.4.1 (already loaded) | SVG render (existing) | Keep — already produces the SVG that becomes the PDF. [VERIFIED: web/index.html:9] |
| @spotify/basic-pitch | 1.0.1 (already loaded) | Audio -> notes | Keep — exposes a per-batch progress callback `(p: number)` 0..1 we use for the "transcribing" stage percent. [VERIFIED: basic-pitch-ts README; web/pipeline.js:69-71] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (none) | — | — | Phase requires no new runtime deps. All work is in `web/` source files. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-written MusicXML | `opensheetmusicdisplay` (OSMD) | Importer/renderer, **not an emitter**. Wrong tool. [VERIFIED: OSMD blog] |
| Hand-written MusicXML | `xml2abc-js` (Wim Vree) | Converts **MusicXML -> ABC**, not the reverse. Wrong direction. [VERIFIED: Vree's site] |
| Hand-written MusicXML | `@stringsync/musicxml` | TypeScript class lib, **requires bundler**. Violates CLAUDE.md no-build-step constraint. [VERIFIED: stringsync GitHub] |
| Hand-written MusicXML | Convert ABC -> MusicXML in-browser | **Does not exist as a JS library** — confirmed in abcjs GitHub issue #719: "There is no way to do MusicXML export entirely client-side in JavaScript at this time." [CITED: github.com/paulrosen/abcjs/issues/719] |
| Hand-written MusicXML | Server-side conversion | Violates static-hosting constraint. [VERIFIED: CLAUDE.md] |
| Popup `window.print()` | `print-js` library (Print.js) | Adds a dep purely to wrap `window.print` with a print-stylesheet helper. Hand-written iframe approach is 30 lines and avoids the dep. [VERIFIED: Print.js GitHub] |
| Popup `window.print()` | `html2pdf.js` / `jsPDF` | Rasterizes SVG -> raster PDF (loses vector quality + page layout control). Print-pathway is what the requirement asks for. [VERIFIED: PAR-02 phrasing] |

**Installation:** None. Phase ships zero new package installs.

## Package Legitimacy Audit

This phase installs **no new packages**. The only external runtime deps are already loaded (`abcjs@6.4.1`, `@spotify/basic-pitch@1.0.1`) and were vetted at project setup time. No legitimacy gate run required.

## Architecture Patterns

### System Architecture Diagram

```
User picks audio file
        |
        v
+----------------------+
| decodeAudio          | --progress--> stage: "decoding"
| (AudioContext)       |
+----------------------+
        |
        v
+----------------------+
| extractNotes         | --progress--> stage: "model-loading" (cold start)
| (basic-pitch)        | --progress--> stage: "transcribing" (with percent)
+----------------------+
        |
        v
+----------------------+
| monophonic + key +   | --progress--> stage: "rendering"
| transpose + quantize |
+----------------------+
        |
        v
   result {notes, bpm, key, letters}
        |
        +-----+-----------------+--------------+
        |     |                 |              |
        v     v                 v              v
   buildAbc  buildMusicXML   renderToScore  letters preview
   (existing)(NEW PAR-01)   (existing)      (existing)
        |                       |
        v                       |
   ABCJS.renderAbc(score)       |
        |                       |
        v                       |
   <svg> in #score              |
        |                       |
   +----+-----+                 |
   |    |     |                 |
   v    v     v                 v
  PDF  SVG   ABC            MusicXML (.musicxml file)
 (PAR-02)    download         (PAR-01)
   ^
   |
 print dialog (popup OR iframe fallback)
```

### Recommended Project Structure

```
web/
├── index.html         # existing — add stage indicator markup + .musicxml button
├── style.css          # existing — add stage indicator styles
├── main.js            # existing — wire new buttons + stage UI; thin
├── pipeline.js        # existing — change progress callback shape
├── instruments.js     # existing — add transpose interval metadata (see §Implementation Notes)
├── musicxml.js        # NEW — buildMusicXml(result, instrument, title): string
└── stages.js          # NEW — STAGE enum + STAGE_LABELS + label helpers
```

Two new files only. Keeps the project flat and discoverable.

### Pattern 1: Pure-function exporter, called from main.js

**What:** `buildMusicXml(result, instrument, title)` returns a string. No side effects. Tested in isolation.
**When to use:** Always for the MusicXML path — keeps main.js a UI controller and lets the emitter be unit-tested by feeding fixture `result` objects.
**Example:**
```js
// musicxml.js
export function buildMusicXml(result, instrument, title) {
  const divisions = 1; // 1 division per quarter — our data is already on the quarter grid
  // ... emit header, attributes, measures
  return xml;
}
```

### Pattern 2: Discrete stage enum, single progress event shape

**What:** Replace `progress("Decoding audio...")` with `progress({stage: STAGE.DECODING, label: "Decoding audio", percent: undefined})`. UI maps stage -> a slot in a fixed list (so the user sees "1/4 Decoding audio (in progress)" not just the latest string).
**When to use:** All five existing progress call sites in `pipeline.js`.
**Example:**
```js
// stages.js
export const STAGE = Object.freeze({
  DECODING:      "decoding",
  MODEL_LOADING: "model-loading",
  TRANSCRIBING:  "transcribing",
  RENDERING:     "rendering",
});
export const STAGE_ORDER = [STAGE.DECODING, STAGE.MODEL_LOADING, STAGE.TRANSCRIBING, STAGE.RENDERING];
export const STAGE_LABELS = {
  [STAGE.DECODING]:      "Decoding audio",
  [STAGE.MODEL_LOADING]: "Loading model (first run only)",
  [STAGE.TRANSCRIBING]:  "Transcribing notes",
  [STAGE.RENDERING]:     "Rendering score",
};
```

### Pattern 3: Backward-compatible progress wrapper

**What:** Accept either a function (legacy `(string)`) or an object-emitter. Inside the pipeline, always emit objects; wrap legacy callers.
**When to use:** During the migration so the refactor lands in one commit without breaking the UI in flight.
**Example:**
```js
function emit(progress, evt) {
  if (typeof progress === "function") progress(evt);
}
// callers pass: (evt) => { statusText.textContent = evt.label + (evt.percent ? ` (${Math.round(evt.percent*100)}%)` : ""); }
```

### Anti-Patterns to Avoid

- **Emitting MusicXML with template literals containing user-supplied strings without escaping** — `<` `>` `&` `"` in song titles / instrument labels break the XML. Always run titles through an `escapeXml` helper.
- **Skipping the `<divisions>` element** — MuseScore/Finale will refuse the file. Required at the first measure's `<attributes>`. [CITED: w3.org/2021/06/musicxml40/musicxml-reference/elements/divisions]
- **Using `<tie>` without `<tied>`** — `<tie>` is sound-only; visible ties need `<tied>` inside `<notations>`. [CITED: musicxml40/musicxml-reference/elements/tied]
- **Polling progress on a tight loop in the UI thread** — basic-pitch calls the percent callback per batch; just re-render on each call.
- **`document.write` inside the popup without `meta charset`** — already handled in current code; keep the `<meta charset="utf-8">` line.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| PDF byte assembly | Custom `jsPDF` setup, font embedding, page splitting | Browser print dialog -> Save as PDF | Vector fidelity, OS-native dialog, no font licensing, zero deps. The current popup approach is correct. |
| MIDI -> note name spelling | Reinvent enharmonic spelling | Reuse `preferredAccidental(key)` already in pipeline.js | Already tested and consistent with the on-screen ABC render. Stay consistent or MusicXML will disagree with what the user saw. |
| XML serialization | Build a generic XML library | Hand-write the ~10 element types MusicXML needs | The MusicXML subset for a single-line score is ~12 distinct tags. A general XML lib is overkill; a 5-line `escapeXml` helper + template strings is right-sized. |
| Tempo / time-sig / key encoding | Re-derive from notes inside the emitter | Read from `result.bpm`, hard-code 4/4 (matches buildAbc), read `result.key` | Pipeline already settled these. Don't recompute. |

**Key insight:** The phase is small and contained because all the hard musical decisions are already locked into `result` by the time export runs. The export modules are pure formatters of an already-correct data structure.

## MusicXML Emission Deep Dive

### Element checklist (minimum viable score-partwise for MuseScore 4 / Finale)

| Element | Required? | Value for this app |
|---------|-----------|--------------------|
| XML decl `<?xml version="1.0" encoding="UTF-8" standalone="no"?>` | Yes | Standalone="no" matches the W3C "Hello World" example [CITED: w3.org/2021/06/musicxml40/tutorial/hello-world] |
| DOCTYPE `<!DOCTYPE score-partwise PUBLIC ...>` | Recommended | Use the MusicXML 4.0 partwise DTD line from the W3C tutorial. Omitting works in MuseScore but stricter validators complain. |
| `<score-partwise version="4.0">` | Yes | Root |
| `<work><work-title>` | Optional but nice | Use `lastTitle` from main.js (the filename minus extension) |
| `<identification><encoding>` | Optional | Add `<software>Link To Notes</software>` for provenance |
| `<part-list>` -> `<score-part id="P1"><part-name>` | Yes | `instrument.label` (e.g., "Alto Saxophone (Eb)") |
| `<part id="P1">` | Yes | One part, monophonic |
| `<measure number="N">` | Yes | One per 4/4 bar |
| First measure `<attributes>`: `<divisions>`, `<key><fifths>`, `<time>`, `<clef>`, `<transpose>` | Yes | All five required for transposing instruments; see encoding details below |
| `<note>` -> `<pitch>` `<step>` `<alter>` `<octave>` | Yes | One note element per quantized note |
| `<note>` -> `<duration>`, `<type>` | Yes | duration in divisions, `<type>` in note-name terms (quarter/half/whole) |
| `<note>` -> `<tie type="..."/>` + `<notations><tied type="..."/>` | Conditional | Required when a note's `ql` crosses a barline (see §Tie handling) |

[CITED: w3.org/2021/06/musicxml40/tutorial/hello-world]

### Divisions choice

`<divisions>1</divisions>`. Our quantized data has integer `ql` values on a quarter-note grid (pipeline.js sets `MIN_NOTE_QL=2` and rounds `ql = Math.round(ql)`). A division of 1 means duration=1 -> quarter note, duration=2 -> half, duration=4 -> whole. Simple, no fractions. [CITED: w3.org/2021/06/musicxml40/musicxml-reference/elements/divisions/]

### Key signature (`<fifths>`)

Map detected key to MusicXML fifths (sharps positive, flats negative):

```
C/Am  = 0    G/Em  = 1    D/Bm  = 2    A/F#m = 3    E/C#m = 4    B/G#m = 5    F#/D#m = 6
F/Dm  = -1   Bb/Gm = -2   Eb/Cm = -3   Ab/Fm = -4   Db/Bbm= -5   Gb/Ebm= -6
```

`result.key.tonic` is a pitch-class 0-11 (C=0). `result.key.mode` is "major" or "minor". Mode element: `<mode>major</mode>` or `<mode>minor</mode>`.

Convert tonic + mode -> fifths using a hand-coded lookup. Match `preferredAccidental(key)` in pipeline.js so MusicXML's fifths agree with the on-screen rendering's accidental style.

### Time signature

Hard-code 4/4 (`<beats>4</beats><beat-type>4</beat-type>`) — `buildAbc` already locks this in via `M:4/4`. No reason to compute it.

### Clef

Treble (`<sign>G</sign><line>2</line>`) for every supported instrument — flute, clarinet, sax family all read treble. Bass clarinet treble-clef notation matches its standard transposing convention here (already encoded in `instruments.js`).

### Transpose element (CRITICAL — gets concert/written wrong by default)

The web pipeline already converts **concert -> written** before producing `result.notes`. The MIDI numbers in `result.notes` ARE written pitch. The `<transpose>` element tells MusicXML readers what to ADD to the written pitch to get the sounding (concert) pitch — i.e., **the opposite direction** of what `instrument.transposeSemitones` stores.

**Encoding rule:** `<chromatic>` = `-(instrument.transposeSemitones)`.

[CITED: w3.org/2021/06/musicxml40/musicxml-reference/elements/transpose] - "The transpose type represents what must be added to a written pitch to get a correct sounding pitch."

| Instrument | `transposeSemitones` (concert->written) | MusicXML `<chromatic>` (written->sounding) | `<diatonic>` |
|------------|------------------------------------------|--------------------------------------------|--------------|
| Flute | 0 | 0 | 0 |
| Clarinet (Bb) | 2 | -2 | -1 |
| Bass Clarinet (Bb) | 14 | -14 | -8 (one octave + M2 down) |
| Alto Sax (Eb) | 9 | -9 | -5 (M6 down) |
| Tenor Sax (Bb) | 14 | -14 | -8 |
| Bari Sax (Eb) | 21 | -21 | -12 (one octave + M6 down) |

Add `octave-change` for sub-octave parts: bass clarinet -1 (or include in diatonic), tenor sax -1, bari sax -1. This is what makes the part read at the right octave in MuseScore.

**Recommended:** add a `xml` field (or derive at emit time) to each instrument in `instruments.js`:

```js
clarinet: { ...,
  xml: { chromatic: -2, diatonic: -1, octaveChange: 0 },
},
```

This is the cleanest fix vs. computing diatonic at emit time (off-by-one bugs likely).

### Tie handling (notes that span barlines)

`buildAbc` already splits notes across barlines and inserts ABC ties (the "-" suffix). The MusicXML emitter must do the same logic — pipeline.js gives us notes that may be longer than 4 beats, and a note straddling beat 5 must become two `<note>` elements (one ending the bar, one starting the next) with `<tie>` + `<tied>` markers.

Pattern per spanning note:
- First `<note>`: `<tie type="start"/>` and `<notations><tied type="start"/></notations>`
- Second `<note>` (same pitch, next measure): `<tie type="stop"/>` and `<notations><tied type="stop"/></notations>`

[CITED: w3.org/2021/06/musicxml40/musicxml-reference/elements/tied] - tied is the visual element, tie is the sound element; need both.

The barline-splitting loop from `buildAbc` (main.js lines 146-171) is the reference algorithm — port it.

### Pitch encoding

`<step>` = letter (C, D, E, F, G, A, B). `<alter>` = -1 (flat), 0 (natural, omit), 1 (sharp). `<octave>` uses scientific pitch notation (middle C = octave 4).

Use `preferredAccidental(key)` from pipeline.js to decide sharp vs flat spelling, exactly matching the on-screen render. Map:

```
MIDI pc | sharp-style step,alter | flat-style step,alter
0  C    | C,0                    | C,0
1  C#   | C,1                    | D,-1
2  D    | D,0                    | D,0
3  D#   | D,1                    | E,-1
4  E    | E,0                    | E,0
5  F    | F,0                    | F,0
6  F#   | F,1                    | G,-1
7  G    | G,0                    | G,0
8  G#   | G,1                    | A,-1
9  A    | A,0                    | A,0
10 A#   | A,1                    | B,-1
11 B    | B,0                    | B,0
```

### Note `<type>` element

Map duration (in quarters) to MusicXML type names:

| ql | type |
|----|------|
| 1 | quarter |
| 2 | half |
| 3 | half + dot (`<dot/>` child + duration=3) |
| 4 | whole |
| 5+ | split across bars (tie) — each piece typed individually |

Since `MIN_NOTE_QL = 2` and `Math.round(ql)`, the only values we see in practice are 2, 3, 4, 5, 6, 7, 8. Anything `ql > 4` will get split by the barline loop into pieces of 1-4 ql each.

### Final-bar rest padding

`buildAbc` pads the final bar with a rest if `beatsInBar < 4`. Do the same in MusicXML: emit a `<note><rest/><duration>N</duration><type>...</type></note>`. Without this, MuseScore shows an incomplete final measure.

### File extension + MIME

- Extension: `.musicxml` [CITED: mime-type.com/application/vnd.recordare.musicxml+xml — "The recommended file extension for uncompressed MusicXML files is .musicxml"]
- MIME: `application/vnd.recordare.musicxml+xml` (IANA-registered) [CITED: iana.org/assignments/media-types/application/vnd.recordare.musicxml+xml]

Use this MIME in the Blob, not `text/xml`. Most browsers ignore it for downloads but it's correct for any HTTP scenario.

## PDF Hardening Deep Dive

### Current implementation (main.js:252-273) — what works

- Pops a new window, writes SVG + print CSS, calls `window.print()` on load.
- Already handles popup blocker (line 259: `if (!win) showError(...)`).
- Already sets `@page` size and SVG width: 100%.

### What can break

1. **iOS Safari may print blank pages** when `window.print()` is called on a document that was just `document.write`'d. The known workaround is a `setTimeout` before `window.print()` — already present (200ms) but may need to be larger (try 500ms) and `document.close()` before scheduling the print. [VERIFIED: copyprogramming.com Safari print guide; Print.js issue #528]
2. **Popup blocker** in stricter browsers blocks the open even with user gesture (rare but happens with multiple-window-open heuristics).
3. **SVG without explicit width/height attrs** can render at 0x0 in some print engines. abcjs's SVG already sets viewBox; ensure the popup's `<style>` keeps `svg { width: 100%; height: auto; }` (already does).
4. **Cross-origin font** issues — irrelevant here since abcjs renders with native SVG text.
5. **iOS Safari print dialog is the share sheet** — when a user picks "Print" via share sheet they get the iOS print UI; "Save as PDF" requires the pinch-out-of-preview gesture. Document this in the button tooltip or instructions ("On iPhone: tap Print, then pinch out on the preview to save as PDF").

### Hardening recommendations

**A. Add an iframe fallback.** When `window.open` returns null, fall back to an in-page hidden iframe:

```js
function printViaIframe(xml, title) {
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument;
  doc.open();
  doc.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeXml(title)}</title>
    <style>@page { size: letter; margin: 0.5in; } body{margin:0;} svg{width:100%;height:auto;}</style>
    </head><body>${xml}</body></html>`);
  doc.close();
  // Wait for layout before printing.
  setTimeout(() => {
    iframe.contentWindow.focus();
    iframe.contentWindow.print();
    // Give the dialog time to capture; clean up after.
    setTimeout(() => iframe.remove(), 1000);
  }, 250);
}
```

This sidesteps popup blockers entirely. On iOS Safari this also works because the print is invoked from the same-origin iframe context.

**B. Try popup first (preserves current UX where user sees the score in a tab they can re-print) but fall back to iframe transparently.** That removes the "allow popups" instruction for most users.

**C. Surface error categories.** The error message should distinguish:
- No SVG rendered yet -> "Run a conversion first, then export PDF."
- Popup AND iframe both failed -> "Couldn't open the print dialog. Try the SVG download instead."
- Print dialog cancelled -> silent (we can't detect cancellation in browsers reliably).

**D. iOS Safari testing note.** The phase has a downstream Phase 4 covering cross-browser; for Phase 1 we add the iframe fallback and document the iOS "pinch to save" tip, deferring full iOS smoke to Phase 4.

## Stage Progress Deep Dive

### Current state (pipeline.js)

Five `progress(string)` call sites:
- `decodeAudio`: `"Decoding audio..."` (once)
- `extractNotes`: `"Loading model (first run only)..."` (once) + `"Pitch detection: NN%"` (many)
- `runPipeline`: `"Filtering to monophonic line..."`, `"Transposing for instrument..."`, `"Detecting key..."`, `"Quantizing rhythm..."`

basic-pitch's `evaluateModel` calls its percent callback with a `number` in [0,1] (per batch) [VERIFIED: basic-pitch-ts README, npm package]. We have real granularity inside the transcribing stage; everything else is a single fast emission.

### Proposed event shape

```js
progress({
  stage: STAGE.TRANSCRIBING,  // one of four discrete values
  label: "Transcribing notes",
  percent: 0.42,              // optional, 0..1
});
```

### Mapping current emissions

| Old string | New stage | percent |
|------------|-----------|---------|
| "Decoding audio..." | DECODING | undefined |
| "Loading model (first run only)..." | MODEL_LOADING | undefined |
| "Pitch detection: NN%" | TRANSCRIBING | the basic-pitch p value |
| "Filtering to monophonic line..." | RENDERING | undefined |
| "Transposing for instrument..." | RENDERING | undefined |
| "Detecting key..." | RENDERING | undefined |
| "Quantizing rhythm..." | RENDERING | undefined |

Grouping the four post-ML steps under "RENDERING" is honest — they're collectively fast (sub-second) and the user-visible meaning is "preparing the score." If we want finer steps later, expand the enum; today the four-stage indicator matches what PAR-04 explicitly lists.

### UI rendering

A small `<ol>` of four `<li>` elements, each with states: pending / active / done. The `active` one shows percent if present, else a spinner. Mark previous stages `done` when a later stage starts.

```html
<ol id="stage-list">
  <li data-stage="decoding">Decoding audio</li>
  <li data-stage="model-loading">Loading model</li>
  <li data-stage="transcribing">Transcribing notes</li>
  <li data-stage="rendering">Rendering score</li>
</ol>
```

CSS classes drive visuals. No new dependencies.

## Implementation Notes

### Files touched

| File | Change |
|------|--------|
| `web/musicxml.js` | NEW: pure `buildMusicXml(result, instrument, title)` -> string |
| `web/stages.js` | NEW: `STAGE`, `STAGE_ORDER`, `STAGE_LABELS` |
| `web/instruments.js` | Add `xml: {chromatic, diatonic, octaveChange}` to each instrument |
| `web/pipeline.js` | Change `progress(msg)` call sites to emit `{stage, label, percent}` |
| `web/main.js` | Wire `#download-musicxml` button; replace `showStatus(string)` with stage-list renderer; harden PDF popup with iframe fallback |
| `web/index.html` | Add `<button id="download-musicxml">`; replace `#status` with `<ol id="stage-list">` markup |
| `web/style.css` | Stage list states (pending/active/done) + percent display |

### Key code snippets to write (sketches — not final)

**buildMusicXml header:**
```js
// Source: w3.org/2021/06/musicxml40/tutorial/hello-world
function header() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="4.0">`;
}
```

**First-measure attributes (transpose included):**
```js
function attributes(key, instrument) {
  const fifths = keyToFifths(key);
  const t = instrument.xml;
  return `<attributes>
  <divisions>1</divisions>
  <key><fifths>${fifths}</fifths><mode>${key.mode}</mode></key>
  <time><beats>4</beats><beat-type>4</beat-type></time>
  <clef><sign>G</sign><line>2</line></clef>
  ${t.chromatic !== 0 ? `<transpose>
    <diatonic>${t.diatonic}</diatonic>
    <chromatic>${t.chromatic}</chromatic>
    ${t.octaveChange ? `<octave-change>${t.octaveChange}</octave-change>` : ""}
  </transpose>` : ""}
</attributes>`;
}
```

**Note with tie + barline split** — port the algorithm from `buildAbc` in main.js (lines 146-171), but emit MusicXML `<note>` elements and `<tie type="start"/>` / `<tied type="start"/>` (and matching stop) instead of ABC "-" tokens.

**escapeXml:**
```js
function escapeXml(s) {
  return String(s).replace(/[<>&"']/g, c => ({"<":"&lt;",">":"&gt;","&":"&amp;",'"':"&quot;","'":"&apos;"}[c]));
}
```

## Runtime State Inventory

Not applicable — this is a feature-add phase, not a rename/refactor. No prior renamed string to chase through datastores.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Modern browser with Web Audio API | All phases | ✓ (assumed user) | — | XPLAT-03 in Phase 2 handles unsupported browsers |
| AudioContext.decodeAudioData | extractNotes | ✓ | — | — |
| Blob + URL.createObjectURL | All downloads (ABC/SVG/MusicXML) | ✓ on every evergreen browser | — | None needed |
| window.open / iframe.print | PDF export | ✓ | — | iframe fallback covers popup blocker |
| jsdelivr + esm.sh reachable | Model + abcjs + basic-pitch | Assumed | — | Out of scope for this phase (DIST-05 v2) |

**Missing dependencies with no fallback:** None — phase is pure browser-side code.

## Common Pitfalls

### Pitfall 1: Transpose direction sign error

**What goes wrong:** MusicXML opens in MuseScore but every note is in the wrong key — alto sax part shows in concert pitch instead of Eb, or pitched a sixth too high.
**Why it happens:** `instrument.transposeSemitones` is the amount **added to concert** to get written. MusicXML `<chromatic>` is the amount **added to written** to get sounding. They're opposites. Off-by-sign here is the #1 bug.
**How to avoid:** Encode `xml.chromatic = -instrument.transposeSemitones` and test against alto sax (a known +9 / -9 pair) before shipping.
**Warning signs:** Concert C in source plays as concert C in MuseScore (wrong — should be concert Eb if alto sax). Or written note is right but MuseScore "Concert Pitch" toggle shifts it the wrong way.

### Pitfall 2: Missing `<divisions>` or `<duration>` mismatch

**What goes wrong:** "Not a valid MusicXML file" error in MuseScore 4 on import.
**Why it happens:** First measure must contain `<attributes><divisions>` and every `<note>` must have a `<duration>` whose value is consistent with divisions.
**How to avoid:** Always emit `<divisions>1</divisions>` and emit `<duration>` equal to the integer ql for each note piece.
**Warning signs:** "Bar 1 is too short/long" warnings on import.

### Pitfall 3: Title contains `&` (e.g., "Tom & Jerry")

**What goes wrong:** Generated XML fails to parse — MuseScore reports "not well-formed."
**Why it happens:** `&` must be `&amp;` in XML.
**How to avoid:** Run every user-derived string (title, instrument label) through `escapeXml`.
**Warning signs:** Any file titled with `&`, `<`, `>` opens as garbage or fails outright.

### Pitfall 4: iOS Safari prints blank page from popup

**What goes wrong:** PDF on iPhone is blank.
**Why it happens:** `window.print()` fires before the SVG has laid out, or the popup is suppressed and the user doesn't realize the share-sheet appeared.
**How to avoid:** Use iframe fallback (in-page, no popup), call `iframe.contentWindow.focus()` before `.print()`, and use a `setTimeout` of 250-500ms.
**Warning signs:** iOS user reports blank pages or no dialog.

### Pitfall 5: Tied note at end of score

**What goes wrong:** Final note has `<tied type="start"/>` but no matching `stop` because the next measure was the final-rest pad.
**Why it happens:** Loop emits the start-tie before checking whether a next piece exists.
**How to avoid:** Only emit `<tied type="start"/>` if `remaining > 0` after this piece (port the buildAbc logic exactly).
**Warning signs:** MuseScore shows a dangling tie on the last note.

### Pitfall 6: Progress callback emitted from inside a Promise resolution after pipeline aborted

**What goes wrong:** Stage indicator updates after the user navigated away or a new conversion started.
**Why it happens:** basic-pitch's percent callback fires across multiple frames; the JS callback has no cancellation.
**How to avoid:** Either accept this for the MVP (it's harmless), or hold a `runId` token in main.js and ignore progress events whose token doesn't match the current run. Recommend deferring to a future phase unless user reports.
**Warning signs:** Stage list shows "Transcribing 30%" after a successful conversion finished.

## Code Examples

### Minimal score-partwise that opens in MuseScore 4

```xml
<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="4.0">
  <work><work-title>Example</work-title></work>
  <part-list>
    <score-part id="P1"><part-name>Alto Saxophone (Eb)</part-name></score-part>
  </part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>1</divisions>
        <key><fifths>0</fifths><mode>major</mode></key>
        <time><beats>4</beats><beat-type>4</beat-type></time>
        <clef><sign>G</sign><line>2</line></clef>
        <transpose>
          <diatonic>-5</diatonic>
          <chromatic>-9</chromatic>
        </transpose>
      </attributes>
      <note>
        <pitch><step>C</step><octave>5</octave></pitch>
        <duration>4</duration>
        <type>whole</type>
      </note>
    </measure>
  </part>
</score-partwise>
```

Source: adapted from [w3.org/2021/06/musicxml40/tutorial/hello-world](https://www.w3.org/2021/06/musicxml40/tutorial/hello-world/) plus the `<transpose>` element per [w3.org/2021/06/musicxml40/musicxml-reference/elements/transpose](https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/transpose/).

### Note with tie across barline

```xml
<!-- end of measure N: half note tied forward -->
<note>
  <pitch><step>G</step><octave>4</octave></pitch>
  <duration>2</duration>
  <tie type="start"/>
  <type>half</type>
  <notations><tied type="start"/></notations>
</note>
<!-- start of measure N+1: matching stop -->
<note>
  <pitch><step>G</step><octave>4</octave></pitch>
  <duration>2</duration>
  <tie type="stop"/>
  <type>half</type>
  <notations><tied type="stop"/></notations>
</note>
```

Source: [w3.org/2021/06/musicxml40/musicxml-reference/elements/tied](https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/tied/).

### Iframe print fallback (sketch)

```js
function printScore(xml, title) {
  let win;
  try { win = window.open("", "_blank"); } catch { win = null; }
  if (win) return printInWindow(win, xml, title);
  return printInIframe(xml, title);
}
```

## State of the Art

| Old approach | Current approach | When changed | Impact |
|--------------|------------------|--------------|--------|
| `<tie>` element only | `<tie>` + `<tied>` pair (sound vs visual) | MusicXML 2.0+ | Visual ties require `<tied>` inside `<notations>` — `<tie>` alone produces sound but no rendered curve [CITED: musicxml-reference/elements/tied] |
| `.xml` extension | `.musicxml` extension preferred | MusicXML 3.x+ | Use `.musicxml` for clarity; `.xml` still works [CITED: mime-type.com] |
| `application/xml` MIME | `application/vnd.recordare.musicxml+xml` | IANA registration | Use the registered MIME [CITED: IANA] |
| DTD-only docs | DTD + W3C 4.0 spec | MusicXML 4.0 (2021) | Modern validators accept DTD or schemaless well-formed XML |

**Deprecated/outdated:**
- `document.execCommand('print')`: deprecated but still works as Safari fallback. Don't rely on it unless `window.print` itself is broken. [VERIFIED: web search]

## Validation Architecture

`workflow.nyquist_validation` is not set in `.planning/config.json` (no config file). Treating as enabled per the absent-key default.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None currently in the project [VERIFIED: web/ has no test files; package.json absent] |
| Config file | None |
| Quick run command | None |
| Full suite command | None |

This is a static, browser-only project with no test harness. Phase 1 should not block on adding a full test framework (would violate "no build step" CLAUDE.md constraint if it requires node + bundler tooling). Instead, recommend lightweight manual + validation approaches.

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| PAR-01 | MusicXML file is well-formed XML | manual (validator) | Drop into [w3.org/2021/06/musicxml40/listings/musicxml.xsd](https://www.w3.org/2021/06/musicxml40/listings/musicxml.xsd/) or open in MuseScore 4 | manual |
| PAR-01 | MusicXML opens in MuseScore 4 with correct part name, key sig, transpose | manual | Open .musicxml in MuseScore 4 | manual |
| PAR-01 | Tied notes across barlines render as ties (not two separate notes) | manual visual check | Inspect MuseScore render | manual |
| PAR-02 | Print dialog appears and SVG is laid out on page | manual | Click "Download PDF" in browser, observe dialog preview | manual |
| PAR-02 | iframe fallback used when popup blocked | manual | Block popups in browser settings, retry | manual |
| PAR-04 | Stage list updates as pipeline runs | manual | Watch UI during conversion | manual |
| PAR-04 | Transcribing stage shows percent | manual | Watch UI during conversion (5-10 seconds visible) | manual |
| PAR-04 | Failed export shows specific error | manual | Trigger error path (no SVG, blocked popup+iframe) | manual |

### Sampling Rate

- **Per task commit:** Open the deployed page locally (`python -m http.server` in `web/`), run a known fixture audio file end-to-end, verify the touched behavior.
- **Per phase merge:** Full manual smoke — run the pipeline on at least two real audio files (one in C major, one with sharps/flats), open the generated `.musicxml` in MuseScore 4 (free download), print the PDF, watch the stage list.
- **Phase gate:** All four success criteria from ROADMAP.md verified by hand.

### Wave 0 Gaps

- [ ] Pick or capture a 10-30 second fixture audio file (solo flute / sax) to use as the manual-smoke input. Keep it in `web/fixtures/` or document the source.
- [ ] Install MuseScore 4 (free, [musescore.org](https://musescore.org)) on the dev machine for MusicXML validation.
- [ ] Optional: drop a tiny browser-runnable assertion harness in `web/test.html` that imports `musicxml.js` and runs `buildMusicXml` against a hand-built fixture `result` object, comparing the output string to an expected fixture. This is zero-dep and runs in the browser — fits the static-hosting constraint.

*If a test harness is added, "Quick run command" becomes "Open web/test.html in a browser."*

## Security Domain

Phase 1 has narrow security surface (browser-only, no server, no auth, no PII). ASVS categories:

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | yes (XML escaping) | `escapeXml` helper on every user-supplied string (title, instrument label) before emit |
| V6 Cryptography | no | — |
| V7 Error Handling & Logging | yes (errors are user-facing) | Show specific, non-leaking error messages per category; no stack traces in UI |
| V11 Business Logic | partial | None beyond input shape checks |
| V12 Files & Resources | yes (file download / file upload) | Already in place: `accept="audio/*"` on file input, browser-mediated download via Blob |
| V14 Configuration | no | — |

### Known threat patterns for this stack

| Pattern | STRIDE | Standard mitigation |
|---------|--------|---------------------|
| XML injection via filename in `<work-title>` | Tampering | `escapeXml` all strings before emit |
| Popup phishing (we open `_blank` windows) | Spoofing | Window opens to `about:blank` we wrote to — not a remote URL. Safe. |
| Memory leak via un-revoked Blob URLs | Availability (minor) | Already revoked in `downloadBlob`; mirror in MusicXML path |
| User-supplied audio file abuse (huge file, decoder DoS) | Availability | Out of scope for Phase 1 — Phase 2's XPLAT-03 error-handling work covers decoder failures |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The diatonic value for each instrument transpose I listed (clarinet -1, alto sax -5, etc.) | MusicXML §Transpose element | Off-by-one in stave reading direction — MuseScore may show a "perfect" interval where it should be "major." Verify by opening a hand-written MusicXML fixture per instrument in MuseScore before locking. |
| A2 | iOS Safari iframe-print works reliably (not popup) | PDF Hardening §Hardening A | Phase 4 cross-browser sweep will confirm. If it fails on iOS, fall back to displaying SVG full-screen with browser-instructions ("Use Share -> Print to save as PDF"). |
| A3 | `<dot/>` element with `type=half` + `duration=3` is the correct way to encode dotted half | MusicXML §Note type element | If MuseScore rejects, fall back to splitting dotted notes into tied half + quarter pieces. |
| A4 | MuseScore 4 accepts MusicXML 4.0 DOCTYPE | MusicXML §Element checklist | MuseScore forums report "Importing MusicXML 4.0 files currently produces an error, with the workaround being to simply ignore the error" — file still opens. If that's blocking, fall back to MusicXML 3.1 DOCTYPE. [CITED: musescore.org/en/node/321095] |

## Open Questions

1. **Should the MusicXML include the `<encoding>` provenance block ("Generated by Link To Notes")?**
   - What we know: It's optional. Helps debug downstream issues.
   - Recommendation: Include it. Tiny addition, useful metadata.

2. **Should the practice-tempo BPM (70) or the source BPM go into `<sound tempo="...">`?**
   - What we know: `buildAbc` uses `result.bpm` (the 70 practice tempo). UI shows both.
   - Recommendation: Match `buildAbc` — emit `result.bpm` (practice tempo) as the MusicXML tempo. Consistent with the on-screen render and with the "beginner-friendly" framing.

3. **Should the iframe fallback be the default (skip popup entirely) to remove the "allow popups" friction altogether?**
   - What we know: Popup gives users a tab they can re-print or save the SVG from. Iframe is invisible.
   - Recommendation: Try popup first, fall back silently. If user-testing shows popup blockers are common, swap to iframe-first in a follow-up.

4. **Do we want a `runId` for cancellation of in-flight pipelines?**
   - What we know: Currently no way to cancel a conversion mid-flight. Stage indicator can update after a new run starts.
   - Recommendation: Defer. Adds complexity not in scope for the four success criteria. Document as a known minor issue.

## Sources

### Primary (HIGH confidence)

- [MusicXML 4.0 "Hello World" tutorial](https://www.w3.org/2021/06/musicxml40/tutorial/hello-world/) — canonical minimal score-partwise
- [MusicXML 4.0 `<transpose>` element reference](https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/transpose/) — chromatic/diatonic semantics
- [MusicXML 4.0 `<tied>` element reference](https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/tied/) — tie-vs-tied
- [MusicXML 4.0 `<divisions>` element reference](https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/divisions/) — duration encoding
- [MusicXML 4.0 schema (musicxml.xsd)](https://www.w3.org/2021/06/musicxml40/listings/musicxml.xsd/) — for validation
- [IANA media type registration for MusicXML](https://www.iana.org/assignments/media-types/application/vnd.recordare.musicxml+xml) — MIME type + extension
- [@spotify/basic-pitch on npm](https://www.npmjs.com/package/@spotify/basic-pitch) and [basic-pitch-ts README](https://github.com/spotify/basic-pitch-ts/blob/main/README.md) — `evaluateModel` callback shape
- Project source: `web/pipeline.js`, `web/main.js`, `web/instruments.js`, `web/index.html`, `converter.py`

### Secondary (MEDIUM confidence)

- [abcjs MusicXML export GitHub issue #719](https://github.com/paulrosen/abcjs/issues/719) — confirms no client-side JS ABC->MusicXML exporter exists
- [xml2abc-js by Wim Vree](https://wim.vree.org/js/xml2abc-js_index.html) — converts the wrong direction (MusicXML -> ABC); confirms no reverse JS port
- [MuseScore forum: MusicXML 4.0 import](https://musescore.org/en/node/321095) — MuseScore 4 accepts MusicXML 4.0 with a warning
- [copyprogramming.com Safari print guide](https://copyprogramming.com/howto/issue-with-window-print-on-safari) — iOS Safari print quirks
- [Print.js issue #528](https://github.com/crabbly/Print.js/issues/528) — Safari first-print blank-page bug + setTimeout fix
- [mime-type.com MusicXML entry](https://mime-type.com/application/vnd.recordare.musicxml+xml/) — `.musicxml` extension recommendation
- [music21 documentation](https://music21.org/music21docs/usersGuide/usersGuide_31_clefs.html) — desktop pipeline reference for tie/clef encoding

### Tertiary (LOW confidence)

- General WebSearch findings on browser createObjectURL + Blob download cross-browser support — well-known but not authoritatively cited here; assumed reliable.

## Metadata

**Confidence breakdown:**
- MusicXML structure (PAR-01): HIGH — multiple authoritative W3C references, canonical example matched
- Transpose direction (PAR-01): HIGH — verified against MusicXML 4.0 spec definition
- Specific `<diatonic>` values per instrument (PAR-01): MEDIUM — derived by hand from semitone intervals; flagged A1
- PDF print pathway (PAR-02): HIGH — already implemented and working; recommendations are hardening
- Stage progress event shape (PAR-04): HIGH — based on basic-pitch's documented callback and existing pipeline call sites
- iOS Safari print specifics: MEDIUM — search confirms known issues, exact workaround needs Phase 4 verification

**Research date:** 2026-05-28
**Valid until:** 2026-06-27 (30 days — MusicXML and the print pathway are stable specs; phase scope is small)
