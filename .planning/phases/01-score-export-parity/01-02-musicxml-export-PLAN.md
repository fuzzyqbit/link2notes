---
phase: 01-score-export-parity
plan: 02
type: execute
wave: 2
depends_on: ["01-01"]
files_modified:
  - web/musicxml.js
  - web/instruments.js
  - web/main.js
  - web/index.html
autonomous: false
requirements: [PAR-01]

must_haves:
  truths:
    - "After a successful conversion, the result panel shows a 'Save MusicXML' button alongside the existing PDF/SVG/ABC buttons"
    - "Clicking 'Save MusicXML' downloads a file with extension `.musicxml` whose contents start with `<?xml version=\"1.0\"` and contain `<score-partwise version=\"4.0\">`"
    - "The downloaded file opens in MuseScore 4 (or any MusicXML 4.0 reader) without import errors and renders the same pitches, key signature, and tempo as the on-screen ABC score"
    - "The downloaded file's `<transpose>` element matches the selected instrument (alto sax shows chromatic=-9, diatonic=-5; flute has no transpose element)"
    - "The emitted MusicXML contains `<sound tempo=\"N\"/>` where N equals result.bpm, and MuseScore renders that value as a tempo marker"
    - "If the user clicks 'Save MusicXML' before a successful conversion exists, they see a specific error message ('Run a conversion first, then export MusicXML') instead of a silent failure or a broken download"
    - "Titles containing XML-special characters (&, <, >, \", ') are safely escaped — file remains well-formed"
  artifacts:
    - path: "web/musicxml.js"
      provides: "buildMusicXml(result, instrument, title) -> string pure function"
      contains: "export function buildMusicXml"
      min_lines: 100
    - path: "web/instruments.js"
      provides: "Each instrument has an `xml: {chromatic, diatonic, octaveChange}` property"
      contains: "xml:"
    - path: "web/index.html"
      provides: "<button id=\"download-musicxml\"> in the downloads row"
      contains: "download-musicxml"
    - path: "web/main.js"
      provides: "Click handler for #download-musicxml that calls buildMusicXml and triggers a Blob download"
      contains: "download-musicxml"
  key_links:
    - from: "web/main.js"
      to: "web/musicxml.js"
      via: "import { buildMusicXml } from './musicxml.js'"
      pattern: "from ['\"]\\./musicxml\\.js['\"]"
    - from: "web/main.js"
      to: "web/instruments.js"
      via: "instrument.xml passed into buildMusicXml"
      pattern: "instrument\\.xml|INSTRUMENTS\\["
    - from: "web/musicxml.js"
      to: "web/pipeline.js"
      via: "uses preferredAccidental(key) for sharp/flat spelling consistency with the on-screen score"
      pattern: "preferredAccidental"
---

<objective>
Add a real MusicXML export so users can save their generated score and open it in MuseScore, Finale, or any standard notation editor.

Purpose: PAR-01 is the single largest net-new capability in this phase — the desktop app already produces MusicXML, the web app doesn't. This closes the parity gap in the cleanest way (zero new deps, ~150-line emitter) and unlocks the rest of the music software ecosystem for users.

Output: A `Save MusicXML` button that produces a `.musicxml` file matching MuseScore 4's MusicXML 4.0 expectations: correct `<transpose>`, correct key signature, ties across barlines, escaped titles.
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
@.planning/phases/01-score-export-parity/01-01-SUMMARY.md
@CLAUDE.md
@web/pipeline.js
@web/main.js
@web/index.html
@web/instruments.js

<interfaces>
<!-- Key contracts the executor needs. Extracted from the codebase + RESEARCH.md §MusicXML Emission Deep Dive. -->

Input shape (from pipeline.js, runPipeline return value):
```
result = {
  notes: [{midi: number, ql: number}],   // ql in quarter notes; integer >= 2 after quantize
  bpm: 70,                                // TARGET_BPM (practice tempo)
  sourceBpm: number,
  key: {tonic: 0..11, mode: "major" | "minor"},
  letters: string,                        // preview only
}
```

Instrument shape (current — needs `xml` added per RESEARCH.md §Transpose element):
```
{ label: "Alto Saxophone (Eb)", transposeSemitones: 9, loMidi, hiMidi, comfortLo, comfortHi }
```

Required `xml` extension per RESEARCH.md table:
| Instrument | xml.chromatic | xml.diatonic | xml.octaveChange |
|---|---|---|---|
| flute        |   0 |   0 | 0 |
| clarinet     |  -2 |  -1 | 0 |
| bassClarinet | -14 |  -8 | 0 |
| altoSax      |  -9 |  -5 | 0 |
| tenorSax     | -14 |  -8 | 0 |
| bariSax      | -21 | -12 | 0 |

Note: `xml.chromatic = -instrument.transposeSemitones`. Diatonic values are hand-derived intervals per the research table. The `octaveChange` field is included for completeness but is 0 for every instrument here (octave shift is already folded into `diatonic`).

Key -> fifths map (RESEARCH.md §Key signature):
- Tonic pitch class + mode -> fifths integer in [-6, 6].
- Major: C=0, G=1, D=2, A=3, E=4, B=5, F#=6, F=-1, Bb=-2, Eb=-3, Ab=-4, Db=-5, Gb=-6.
- Minor: shift by relative-minor offset (e.g., A minor = 0, E minor = 1).

Existing helper available for import from `web/pipeline.js`:
- `preferredAccidental(key) -> "sharp" | "flat"` — use to pick MIDI->step spelling table.

Barline split algorithm (port from main.js lines 146-171, the buildAbc loop): walk each note's `ql`, fill the current bar to 4 beats, emit a piece into the current measure, if remaining > 0 the piece gets `<tie type="start"/>` + `<notations><tied type="start"/></notations>` and the next piece (in the new measure) gets matching `type="stop"`. Final bar padded with a rest if `beatsInBar < 4`.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Add per-instrument xml metadata to instruments.js</name>
  <files>web/instruments.js</files>
  <read_first>
    - web/instruments.js (current INSTRUMENTS object — six instrument entries)
    - .planning/phases/01-score-export-parity/01-RESEARCH.md (sections: "Transpose element (CRITICAL)" and the per-instrument table)
  </read_first>
  <behavior>
    - Each of the six instruments (flute, clarinet, bassClarinet, altoSax, tenorSax, bariSax) gains an `xml` field with three integer subfields: `chromatic`, `diatonic`, `octaveChange`.
    - Sign invariant: `xml.chromatic === -instrument.transposeSemitones` for every instrument.
    - Flute is the only instrument with all-zero xml values (concert pitch).
    - Sax + clarinet instruments have negative `xml.chromatic` (sound lower than written).
  </behavior>
  <action>
    Edit each entry in the INSTRUMENTS object in `web/instruments.js`. Add an `xml: { chromatic: N, diatonic: N, octaveChange: 0 }` field to each of the six instruments, with values from the table in `<interfaces>` above (matches RESEARCH.md §Transpose element).

    Place `xml` immediately after `transposeSemitones` so the relationship is visually obvious. Add a short comment above each instrument's `xml` line reminding the reader that `chromatic = -transposeSemitones` (MusicXML's transpose adds to written to get sounding; transposeSemitones adds to concert to get written — opposite directions).

    Do NOT change `transposeSemitones`, the comfort ranges, or any existing field. Do NOT add `xml` to `INSTRUMENT_ORDER`.
  </action>
  <verify>
    <automated>node --input-type=module -e "import('./web/instruments.js').then(m => { const I = m.INSTRUMENTS; for (const k of m.INSTRUMENT_ORDER) { const i = I[k]; if (!i.xml || typeof i.xml.chromatic !== 'number' || typeof i.xml.diatonic !== 'number' || typeof i.xml.octaveChange !== 'number') { console.error('FAIL', k, i.xml); process.exit(1); } if (i.xml.chromatic !== -i.transposeSemitones) { console.error('FAIL sign', k, i.xml.chromatic, -i.transposeSemitones); process.exit(2); } } console.log('OK'); })"</automated>
    <automated>node --input-type=module -e "import('./web/instruments.js').then(m => { const I = m.INSTRUMENTS; const cases = [['flute', 0, 0], ['clarinet', -2, -1], ['bassClarinet', -14, -8], ['altoSax', -9, -5], ['tenorSax', -14, -8], ['bariSax', -21, -12]]; for (const [k, ch, di] of cases) { if (I[k].xml.chromatic !== ch || I[k].xml.diatonic !== di) { console.error('FAIL', k, I[k].xml); process.exit(1); } } console.log('OK'); })"</automated>
  </verify>
  <acceptance_criteria>
    - All six instruments have `xml: {chromatic, diatonic, octaveChange}` with integer values.
    - Sign invariant holds: `xml.chromatic === -transposeSemitones` for every instrument.
    - Values for flute, clarinet, bassClarinet, altoSax, tenorSax, bariSax exactly match the table in `<interfaces>`.
    - `INSTRUMENT_ORDER` unchanged.
  </acceptance_criteria>
  <done>
    `INSTRUMENTS` object has the new `xml` field for all six entries; downstream `buildMusicXml` (Task 2) can read `instrument.xml.{chromatic, diatonic, octaveChange}` directly.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Create web/musicxml.js — buildMusicXml pure function</name>
  <files>web/musicxml.js</files>
  <read_first>
    - web/instruments.js (post-Task-1, for the `xml` field shape)
    - web/pipeline.js (for `preferredAccidental(key)`, `result.notes`, `result.bpm`, `result.key` shapes; and the existing `buildAbc` barline-split algorithm in main.js lines 146-171 as the reference port)
    - web/main.js (the `buildAbc` function — port the barline-split loop, including the final-rest pad)
    - .planning/phases/01-score-export-parity/01-RESEARCH.md (sections: "MusicXML Emission Deep Dive" in full, "Code Examples")
  </read_first>
  <behavior>
    Pure function `buildMusicXml(result, instrument, title) -> string`. Given a typical result (~30-100 notes, integer ql, key C major or similar), it returns a MusicXML 4.0 score-partwise document such that:
    - Output starts with `<?xml version="1.0" encoding="UTF-8" standalone="no"?>` followed by the MusicXML 4.0 partwise DOCTYPE and `<score-partwise version="4.0">`.
    - Contains `<work><work-title>{escaped title}</work-title></work>`.
    - Contains exactly one `<score-part id="P1">` whose `<part-name>` is `{escaped instrument.label}`.
    - Contains exactly one `<part id="P1">` with at least one `<measure>`.
    - First measure has `<attributes>` containing `<divisions>1</divisions>`, `<key><fifths>N</fifths><mode>major|minor</mode></key>`, `<time><beats>4</beats><beat-type>4</beat-type></time>`, `<clef><sign>G</sign><line>2</line></clef>`, and a `<transpose>` block IFF `instrument.xml.chromatic !== 0`.
    - First measure also has `<direction>` with `<sound tempo="{result.bpm}"/>` so MuseScore picks up the practice tempo.
    - Every note becomes one or more `<note>` elements with `<pitch><step>X</step>[<alter>N</alter>]<octave>N</octave></pitch>`, `<duration>N</duration>`, `<type>quarter|half|whole|...</type>` and, for spanning notes, `<tie>` + `<notations><tied>` pairs.
    - Notes whose `ql` overflows the 4-beat measure are split into pieces summing to the original duration; each split pair has `<tie type="start"/>` + `<tied type="start"/>` on the leading piece and matching `type="stop"` on the trailing piece. The split logic mirrors the `buildAbc` loop's barline-fill algorithm.
    - Final bar is padded with `<note><rest/>...</note>` if `beatsInBar < 4` at end of input.
    - All user-supplied strings (title, instrument.label) pass through an `escapeXml` helper that converts `&`, `<`, `>`, `"`, `'`.
    - Returns a single string. No DOM, no fs, no fetch, no side effects.

    Test cases (build a tiny browser-runnable `web/musicxml.test.html` that imports `buildMusicXml` and runs assertions in a `<script type="module">`; print PASS/FAIL into the page):
    - Test A: Empty notes array -> output still valid (one measure with whole rest). String contains `<part-id` only once. Parses as XML via `DOMParser`.
    - Test B: Single quarter-note middle-C result `{notes: [{midi: 60, ql: 1}], bpm: 70, key: {tonic: 0, mode: "major"}}` with flute -> output contains `<step>C</step>`, `<octave>4</octave>`, `<duration>1</duration>`, `<type>quarter</type>`. Output contains `<fifths>0</fifths>`. NO `<transpose>` block (flute is concert).
    - Test C: Same notes but alto sax -> output contains `<transpose>` with `<chromatic>-9</chromatic>` and `<diatonic>-5</diatonic>`. Pitch encoding unchanged (notes are already written-pitch).
    - Test D: Title `"Tom & <Jerry>"` -> output well-formed (parses without error). Contains `Tom &amp; &lt;Jerry&gt;` in `<work-title>`.
    - Test E: Note with `ql: 6` (spans into measure 2) -> two `<note>` elements with same pitch, first has `<tie type="start"/>` and `<notations><tied type="start"/></notations>`, second has matching `type="stop"`. Durations sum to 6.
    - Test F: keyToFifths coverage — Bb major (`tonic: 10, mode: "major"`) -> `<fifths>-2</fifths>`; A minor (`tonic: 9, mode: "minor"`) -> `<fifths>0</fifths>`; C minor (`tonic: 0, mode: "minor"`) -> `<fifths>-3</fifths>`; E major (`tonic: 4, mode: "major"`) -> `<fifths>4</fifths>`.
    - Test G: DOMParser parses every test case's output without `<parsererror>` (well-formed XML).

    Test runner pattern (no test framework — the project has none; use a `web/musicxml.test.html` page that imports the module and writes pass/fail to the DOM, runnable via the same `python3 -m http.server` flow used elsewhere).
  </behavior>
  <action>
    Create `web/musicxml.js` as a new ES module exporting `buildMusicXml(result, instrument, title)`.

    Internal structure (all helpers private to the module — non-exported):
    - `escapeXml(s)`: per RESEARCH.md §Implementation Notes — replace `&`, `<`, `>`, `"`, `'` with named entities.
    - `keyToFifths(key)`: tonic + mode -> fifths integer in [-6, 6]. Implement as a lookup table per the mapping in `<interfaces>` (12 tonics × 2 modes = 24 cases; use two 12-entry arrays indexed by tonic).
    - `midiToPitchParts(midi, accidentalStyle)`: midi number + "sharp"|"flat" -> `{step, alter, octave}` per the RESEARCH.md §Pitch encoding table. Octave = `Math.floor(midi / 12) - 1` (middle C = 60 = octave 4).
    - `qlToType(ql)`: 1->quarter, 2->half, 3->half (with dot — flag this; the caller emits `<dot/>`), 4->whole, other values are out-of-spec (the barline-split layer should have already capped to 1..4). Return both the type name and whether a `<dot/>` is needed.
    - `emitNote({step, alter, octave}, duration, type, dotted, tieState)` -> string. `tieState` is one of `"none" | "start" | "stop"`. When non-none, emit both `<tie type="X"/>` (immediately before `<type>`) and `<notations><tied type="X"/></notations>` (after `<type>` per MusicXML element order — see code example in RESEARCH.md §Note with tie across barline).
    - `emitRest(duration, type)` -> string. `<note><rest/><duration>N</duration><type>...</type></note>`.
    - `buildMeasures(notes, accidentalStyle)` -> array of **measure-body strings** (NO `<measure>` wrapper). Each entry is the inner XML for one measure: note + rest elements only. The caller (`buildMusicXml`) wraps each body in `<measure number="N">...</measure>` and is responsible for prepending the first-measure `<attributes>` and `<direction>` blocks INSIDE that wrapper. Implements the barline-fill algorithm: walk notes, fill current bar to 4 beats, on overflow split with tie. Pads final bar with a rest if `beatsInBar < 4 && beatsInBar > 0`. Empty notes array -> one entry containing a whole rest.

    Top-level `buildMusicXml(result, instrument, title)`:
    1. Pull `notes`, `bpm`, `key` from `result`. Compute `accidentalStyle = preferredAccidental(key)` (import from `./pipeline.js`).
    2. Build header (XML decl + DOCTYPE + opening `<score-partwise>`).
    3. Build identification block: `<work><work-title>{escapeXml(title || "score")}</work-title></work>` and `<identification><encoding><software>Link To Notes</software></encoding></identification>`.
    4. Build part-list: one `<score-part id="P1"><part-name>{escapeXml(instrument.label)}</part-name></score-part>`.
    5. Build `<part id="P1">`. Call `bodies = buildMeasures(notes, accidentalStyle)`. Compute `attributesXml` (a string containing `<attributes><divisions>1</divisions><key>...</key><time>...</time><clef>...</clef>[<transpose>...</transpose> iff instrument.xml.chromatic !== 0]</attributes>`) and `directionXml` (`<direction placement="above"><sound tempo="${result.bpm}"/></direction>`). For each `bodies[i]`, emit `<measure number="${i+1}">` + (if i===0: `attributesXml + directionXml`) + `bodies[i]` + `</measure>`.
    6. Close `</part></score-partwise>`. Return the joined string.

    Import `preferredAccidental` from `./pipeline.js` (already exported there).

    Also create `web/musicxml.test.html`: a static page with `<script type="module">` that imports `buildMusicXml` and runs the seven test cases (A through G from `<behavior>`) using `DOMParser` checks and `String.prototype.includes` checks. Write pass/fail rows into a `<table>` in the page so the verify step can grep the served HTML output OR open it in a browser. Page heading: "MusicXML emitter tests". Each test row has classes `pass` or `fail`. A summary `<div id="result">PASS</div>` or `FAIL` at the bottom.
  </action>
  <verify>
    <automated>node --input-type=module --eval "import('./web/musicxml.js').then(m => { if (typeof m.buildMusicXml !== 'function') process.exit(1); const r = m.buildMusicXml({notes:[{midi:60,ql:1}],bpm:70,key:{tonic:0,mode:'major'}},{label:'Flute',xml:{chromatic:0,diatonic:0,octaveChange:0}},'Test'); if (!r.startsWith('<?xml')) { console.error('no xml decl'); process.exit(2); } if (!r.includes('<score-partwise version=\"4.0\">')) { console.error('no root'); process.exit(3); } if (!r.includes('<divisions>1</divisions>')) { console.error('no divisions'); process.exit(4); } if (!r.includes('<step>C</step>')) { console.error('no step'); process.exit(5); } console.log('OK basic'); })"</automated>
    <automated>node --input-type=module --eval "import('./web/musicxml.js').then(m => { const r = m.buildMusicXml({notes:[{midi:69,ql:1}],bpm:70,key:{tonic:0,mode:'major'}},{label:'Alto Sax',xml:{chromatic:-9,diatonic:-5,octaveChange:0}},'X'); if (!r.includes('<chromatic>-9</chromatic>') || !r.includes('<diatonic>-5</diatonic>')) { console.error('transpose missing or wrong'); process.exit(1); } console.log('OK transpose'); })"</automated>
    <automated>node --input-type=module --eval "import('./web/musicxml.js').then(m => { const r = m.buildMusicXml({notes:[{midi:60,ql:1}],bpm:70,key:{tonic:0,mode:'major'}},{label:'Tom & Jerry',xml:{chromatic:0,diatonic:0,octaveChange:0}},'A <B>'); if (!r.includes('A &lt;B&gt;') || !r.includes('Tom &amp; Jerry')) { console.error('escape failed'); process.exit(1); } console.log('OK escape'); })"</automated>
    <automated>node --input-type=module --eval "import('./web/musicxml.js').then(m => { const r = m.buildMusicXml({notes:[{midi:67,ql:6}],bpm:70,key:{tonic:0,mode:'major'}},{label:'Flute',xml:{chromatic:0,diatonic:0,octaveChange:0}},'tie'); const starts = (r.match(/<tie type=\"start\"\/>/g) || []).length; const stops = (r.match(/<tie type=\"stop\"\/>/g) || []).length; if (starts !== 1 || stops !== 1) { console.error('tie counts wrong', starts, stops); process.exit(1); } if (!r.includes('<tied type=\"start\"/>') || !r.includes('<tied type=\"stop\"/>')) { console.error('tied missing'); process.exit(2); } console.log('OK tie'); })"</automated>
    <automated>node --input-type=module --eval "import('./web/musicxml.js').then(m => { const r = m.buildMusicXml({notes:[{midi:60,ql:1}],bpm:77,key:{tonic:0,mode:'major'}},{label:'Flute',xml:{chromatic:0,diatonic:0,octaveChange:0}},'tempo'); if (!r.includes('<sound tempo=\"77\"')) { console.error('tempo missing or wrong'); process.exit(1); } console.log('OK tempo'); })"</automated>
    <automated>test -f web/musicxml.test.html && grep -q 'buildMusicXml' web/musicxml.test.html && echo OK</automated>
  </verify>
  <acceptance_criteria>
    - `web/musicxml.js` exports `buildMusicXml(result, instrument, title)`.
    - Function returns a string starting with `<?xml version="1.0"` and containing `<score-partwise version="4.0">`.
    - First measure contains `<divisions>1</divisions>`, `<key><fifths>...`, `<time>`, `<clef>`, and a `<transpose>` block only when instrument is not concert pitch.
    - First measure also contains `<sound tempo="N"/>` where N matches `result.bpm` (verified by Test E/G + the node smoke test that calls with `bpm:77`).
    - Notes spanning the 4-beat barline emit paired `<tie>` + `<tied>` start/stop elements.
    - XML-special characters in title and instrument label are escaped.
    - `web/musicxml.test.html` exists with the seven test cases and runs against the served page.
  </acceptance_criteria>
  <done>
    Pure emitter module exists and passes node-level smoke tests for header, transpose, escaping, and ties. The browser test page (`musicxml.test.html`) is available for visual verification in Task 4.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 3: Wire 'Save MusicXML' button in index.html + main.js</name>
  <files>web/index.html, web/main.js</files>
  <read_first>
    - web/index.html (current `.downloads` row, lines 92-96)
    - web/main.js (current download handlers, lines 238-273; `lastTitle` and result-state variables)
    - web/musicxml.js (the module from Task 2 — for the function signature)
    - .planning/phases/01-score-export-parity/01-RESEARCH.md (sections: "File extension + MIME", "PDF Hardening Deep Dive §C Surface error categories" — the same error-category pattern applies to MusicXML)
  </read_first>
  <action>
    Edit `web/index.html`:
    - In the `.downloads` div (lines 92-96), add a new button as the FIRST child: `<button id="download-musicxml" type="button">Save MusicXML</button>`. (PDF stays second; SVG and ABC keep their order.)

    Edit `web/main.js`:
    - Add `import { buildMusicXml } from "./musicxml.js";` near the existing imports.
    - At module scope, alongside `lastAbc` and `lastTitle`, add `let lastResult = null;` and `let lastInstrument = null;` — populated in `renderResult` immediately after the existing assignments.
    - In `resetUI()`, also clear `lastResult = null;` and `lastInstrument = null;`.
    - In `renderResult(result, instrument)`, set `lastResult = result; lastInstrument = instrument;` near the top (before the abcjs call so the data is available even if render throws).
    - Add a click handler for `#download-musicxml`:
      - If `lastResult` is null, call `showError("Run a conversion first, then export MusicXML.")` and return.
      - Wrap the `buildMusicXml` call in try/catch. On error, call `showError("Couldn't build the MusicXML file: " + err.message)` and `console.error(err)`. Do NOT silently fail.
      - On success, call `downloadBlob(xml, `${lastTitle}.musicxml`, "application/vnd.recordare.musicxml+xml")` per RESEARCH.md §File extension + MIME.

    Reuse the existing `downloadBlob` function. Reuse the existing `showError` function. Do NOT introduce a new error UI surface in this plan — Plan 3 (PDF hardening) will share the same `showError` path.

    Do NOT change the other download handlers (PDF, SVG, ABC) — Plan 3 owns PDF changes.
  </action>
  <verify>
    <automated>grep -q 'id="download-musicxml"' web/index.html && echo OK</automated>
    <automated>grep -q 'download-musicxml' web/main.js && grep -q 'buildMusicXml' web/main.js && grep -q 'application/vnd.recordare.musicxml' web/main.js && echo OK</automated>
    <automated>grep -q 'lastResult' web/main.js && grep -q 'lastInstrument' web/main.js && echo OK</automated>
    <automated>grep -q 'Run a conversion first' web/main.js && echo OK</automated>
  </verify>
  <acceptance_criteria>
    - `web/index.html` has `<button id="download-musicxml">Save MusicXML</button>` inside `.downloads` div.
    - `web/main.js` imports `buildMusicXml`.
    - Module-level `lastResult` and `lastInstrument` are declared, set in `renderResult`, cleared in `resetUI`.
    - Click handler calls `buildMusicXml(lastResult, lastInstrument, lastTitle)` and downloads via `downloadBlob` with `.musicxml` extension and the IANA MIME type.
    - Clicking before a result exists shows a specific error ("Run a conversion first, then export MusicXML.") via `showError`.
    - `buildMusicXml` errors are caught and surfaced via `showError` (not silent).
  </acceptance_criteria>
  <done>
    Button visible in UI; clicking after a successful conversion produces a `.musicxml` download; clicking before a conversion shows the specific error; emitter errors are surfaced.
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 4: Manual verify — file opens in MuseScore 4 with correct part name, key, and transpose</name>
  <what-built>
    A working "Save MusicXML" export that produces a MusicXML 4.0 file matching the on-screen ABC score's pitches, key, and tempo, with the correct `<transpose>` for the selected instrument.
  </what-built>
  <how-to-verify>
    Pre-requisite: MuseScore 4 installed (free, https://musescore.org). If not installed, install before proceeding.

    1. Serve the web app: `python3 -m http.server 8000 --directory web`.
    2. Open `http://localhost:8000/musicxml.test.html` first — confirm the page shows all seven test rows as `PASS` and a green `PASS` summary at the bottom. If any row is red, fix Task 2 before proceeding.
    3. Open `http://localhost:8000/` and run a real conversion with a short audio clip. Pick **Alto Saxophone (Eb)** specifically.
    4. After the result panel appears, click **Save MusicXML**. A file `{title}.musicxml` downloads.
    5. Open the downloaded file in MuseScore 4 (File -> Open).
    6. Verify ALL of the following:
       a. The file imports without "Not a valid MusicXML file" error. (MuseScore 4 may show a non-blocking warning about MusicXML 4.0 DOCTYPE — that's acceptable per RESEARCH.md A4.)
       b. Part name in the score header reads "Alto Saxophone (Eb)".
       c. The key signature on the staff matches what the web UI displayed (e.g., if the web UI said "Key: C major", the staff has no sharps/flats).
       d. The notes on the MuseScore staff match the notes on the web UI's ABC staff (same pitches, same rhythm, same number of bars).
       e. Open View -> Concert Pitch toggle. The notes shift down (alto sax sounds a major sixth lower than written). If they shift UP instead, the transpose direction is wrong — fail this checkpoint.
       f. If the original audio produced any notes that spanned barlines, they should appear as tied notes in MuseScore (curved line connecting two noteheads of the same pitch).
       g. Right-click any note -> Properties -> the tempo is `70` BPM (or visible as a tempo marking at the start).
    7. Run a second conversion with **Flute** selected. Click Save MusicXML. Open in MuseScore.
       - The file should have NO `<transpose>` block (open in a text editor to confirm) — flute is concert pitch.
       - View -> Concert Pitch toggle has no effect on the staff.
    8. Optional but recommended: pick an instrument that uses a flat key (e.g., feed clarinet a recording in F major) and confirm the MusicXML uses flat spelling for accidentals matching what the web UI rendered.
    9. Error path: in the web UI, BEFORE running any conversion, click "Save MusicXML". Verify the red error panel shows "Run a conversion first, then export MusicXML." (and NOT a silent download or browser error).
  </how-to-verify>
  <resume-signal>Type "approved" if MuseScore opens the file correctly with the right part name, key, transpose, and ties. Otherwise describe what's wrong (e.g., "alto sax sounds in concert C, not Eb", "ties missing", "MuseScore says invalid MusicXML").</resume-signal>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| User input -> MusicXML output | Filename (becomes `<work-title>`) is user-supplied via file picker — must be XML-escaped. |
| MusicXML file -> external editor | The `.musicxml` file is consumed by MuseScore/Finale; well-formed XML is the only invariant we control. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-01-03 | Tampering | XML injection via filename containing `&`, `<`, `>` | mitigate | `escapeXml` helper runs on every user-supplied string (`title`, `instrument.label`) before string concatenation. Verified by Test D in Task 2. |
| T-01-04 | Information Disclosure | `<software>Link To Notes</software>` in `<encoding>` block | accept | Project identification is desired (provenance for downstream debugging) and is not sensitive. |
| T-01-05 | Denial of Service | Pathological note count (e.g., 100k notes) consumes memory while concatenating | accept | Pipeline upstream caps via `MIN_NOTE_QL=2` and `RUN_LIMIT=2`; realistic max is ~200 notes. String concatenation linear in note count. |
</threat_model>

<verification>
- Browser test page (`musicxml.test.html`) shows seven green PASS rows.
- Real conversion with alto sax produces a file that opens in MuseScore with the correct key, transposed staff, and tempo.
- Real conversion with flute produces a file with no `<transpose>` block.
- Clicking the button before any conversion shows the specific error message.
- XML-special characters in titles are escaped (test via filename like `A & B.mp3`).
</verification>

<success_criteria>
PAR-01 satisfied: "User can export the rendered score as MusicXML from the web app" — specifically:
1. The "Save MusicXML" button exists in the result panel.
2. Clicking after a successful conversion downloads a `.musicxml` file with the IANA MIME type.
3. The file opens in MuseScore 4 with correct part name, key signature, transpose, and ties.
4. Errors (no result, emit failure) surface specific user-facing messages instead of silent failures.
</success_criteria>

<output>
On completion, write `.planning/phases/01-score-export-parity/01-02-SUMMARY.md` per the summary template. Note the seven test cases in `musicxml.test.html` as the reusable smoke harness for future regressions.
</output>
