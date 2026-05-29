// MusicXML 4.0 partwise emitter for the Link To Notes pipeline.
//
// Pure function: buildMusicXml(result, instrument, title) -> string.
// No DOM, no fs, no fetch. Hand-written per RESEARCH.md §MusicXML Emission
// Deep Dive — no library exists that emits MusicXML client-side without a
// bundler, and the surface we need is tiny (~12 element types).
//
// Pipeline-supplied invariants we rely on:
//   - notes[i].midi is WRITTEN pitch (concert already transposed away)
//   - notes[i].ql is integer >= 2 (MIN_NOTE_QL=2 in pipeline.js)
//   - bpm is the practice tempo (TARGET_BPM=70) — matches buildAbc
//   - key.{tonic 0..11, mode "major"|"minor"}
//
// `<transpose>` adds to written to get sounding (opposite of
// instrument.transposeSemitones), so instrument.xml carries the pre-flipped
// values from instruments.js.

// -----------------------------------------------------------------------------
// Helpers (all private to the module)
// -----------------------------------------------------------------------------

// Mirror of `preferredAccidental` in pipeline.js — duplicated here (6 lines of
// data + logic) so this module has zero internal imports. That keeps node-level
// smoke tests (which can't follow the https:esm.sh imports in pipeline.js) cheap
// and keeps `buildMusicXml` a pure function with no transitive deps. If the
// pipeline.js version changes, change this one too — Plan 01-04 (golden
// fixtures) will catch any drift.
function preferredAccidental(key) {
  const flatTonicsMajor = new Set([5, 10, 3, 8, 1, 6]);
  if (key.mode === "major") return flatTonicsMajor.has(key.tonic) ? "flat" : "sharp";
  const relMajor = (key.tonic + 3) % 12;
  return flatTonicsMajor.has(relMajor) ? "flat" : "sharp";
}

function escapeXml(s) {
  return String(s).replace(/[<>&"']/g, (c) => ({
    "<": "&lt;",
    ">": "&gt;",
    "&": "&amp;",
    '"': "&quot;",
    "'": "&apos;",
  }[c]));
}

// Tonic pitch class (0..11) + mode -> MusicXML <fifths> integer in [-6, 6].
// Major-key table per RESEARCH.md §Key signature.
// Minor: relative major = (tonic + 3) % 12.
const MAJOR_FIFTHS = [
  0,   // 0  C
  -5,  // 1  Db (enharmonic of C#)
  2,   // 2  D
  -3,  // 3  Eb
  4,   // 4  E
  -1,  // 5  F
  6,   // 6  F# / Gb (use sharps side)
  1,   // 7  G
  -4,  // 8  Ab
  3,   // 9  A
  -2,  // 10 Bb
  5,   // 11 B
];

function keyToFifths(key) {
  if (key.mode === "minor") {
    const relMajor = (key.tonic + 3) % 12;
    return MAJOR_FIFTHS[relMajor];
  }
  return MAJOR_FIFTHS[key.tonic];
}

// MIDI pitch class -> {step, alter} per spelling style.
// Sharp style: chromatic notes spelled with #; flat style with b.
const PC_SHARP = [
  { step: "C", alter: 0 },  // 0  C
  { step: "C", alter: 1 },  // 1  C#
  { step: "D", alter: 0 },  // 2  D
  { step: "D", alter: 1 },  // 3  D#
  { step: "E", alter: 0 },  // 4  E
  { step: "F", alter: 0 },  // 5  F
  { step: "F", alter: 1 },  // 6  F#
  { step: "G", alter: 0 },  // 7  G
  { step: "G", alter: 1 },  // 8  G#
  { step: "A", alter: 0 },  // 9  A
  { step: "A", alter: 1 },  // 10 A#
  { step: "B", alter: 0 },  // 11 B
];
const PC_FLAT = [
  { step: "C", alter: 0 },   // 0  C
  { step: "D", alter: -1 },  // 1  Db
  { step: "D", alter: 0 },   // 2  D
  { step: "E", alter: -1 },  // 3  Eb
  { step: "E", alter: 0 },   // 4  E
  { step: "F", alter: 0 },   // 5  F
  { step: "G", alter: -1 },  // 6  Gb
  { step: "G", alter: 0 },   // 7  G
  { step: "A", alter: -1 },  // 8  Ab
  { step: "A", alter: 0 },   // 9  A
  { step: "B", alter: -1 },  // 10 Bb
  { step: "B", alter: 0 },   // 11 B
];

function midiToPitchParts(midi, accidentalStyle) {
  const pc = ((midi % 12) + 12) % 12;
  const octave = Math.floor(midi / 12) - 1;  // middle C (60) -> 4
  const table = accidentalStyle === "flat" ? PC_FLAT : PC_SHARP;
  const { step, alter } = table[pc];
  return { step, alter, octave };
}

// ql (integer 1..4) -> {type, dotted}.
// 3 is encoded as a dotted half (duration=3, type=half, <dot/>).
function qlToType(ql) {
  switch (ql) {
    case 1: return { type: "quarter", dotted: false };
    case 2: return { type: "half", dotted: false };
    case 3: return { type: "half", dotted: true };
    case 4: return { type: "whole", dotted: false };
    default:
      // Out of spec — barline splitter should have capped at 1..4. Fall back
      // to "whole" so the file still parses.
      return { type: "whole", dotted: false };
  }
}

// Emit one <note> element. `tieState` is "none" | "start" | "stop".
// MusicXML element ordering inside <note>:
//   <pitch>...</pitch>
//   <duration>N</duration>
//   <tie type="..."/>   (sound-only marker, before <type>)
//   <type>...</type>
//   <dot/>              (if dotted)
//   <notations><tied type="..."/></notations>  (visual marker, after <type>)
function emitNote(parts, duration, type, dotted, tieState) {
  const { step, alter, octave } = parts;
  const pitchInner =
    `<step>${step}</step>` +
    (alter !== 0 ? `<alter>${alter}</alter>` : "") +
    `<octave>${octave}</octave>`;
  const tieEl = tieState === "none" ? "" : `<tie type="${tieState}"/>`;
  const dotEl = dotted ? `<dot/>` : "";
  const tiedEl = tieState === "none"
    ? ""
    : `<notations><tied type="${tieState}"/></notations>`;
  return (
    `<note>` +
      `<pitch>${pitchInner}</pitch>` +
      `<duration>${duration}</duration>` +
      tieEl +
      `<type>${type}</type>` +
      dotEl +
      tiedEl +
    `</note>`
  );
}

function emitRest(duration, type) {
  return (
    `<note>` +
      `<rest/>` +
      `<duration>${duration}</duration>` +
      `<type>${type}</type>` +
    `</note>`
  );
}

// Walk notes and split into per-measure bodies. Each entry is the inner XML
// of one measure (notes + rests only, NO <measure> wrapper). The caller is
// responsible for wrapping each body in <measure number="N">...</measure>
// and prepending attributesXml + directionXml inside the first wrapper.
//
// Barline algorithm ports buildAbc (main.js lines 196-229): fill the current
// bar to 4 beats; on overflow, emit a tied piece into the current bar and a
// matching stop piece at the start of the next. Final bar padded with a rest
// if beatsInBar < 4 && beatsInBar > 0. Empty notes -> single whole-rest bar.
function buildMeasures(notes, accidentalStyle) {
  if (!notes.length) {
    return [emitRest(4, "whole")];
  }

  const bodies = [];
  let current = "";
  let beatsInBar = 0;

  for (const note of notes) {
    const parts = midiToPitchParts(note.midi, accidentalStyle);
    let remaining = note.ql;
    while (remaining > 0) {
      const room = 4 - beatsInBar;
      const take = Math.min(remaining, room);
      const { type, dotted } = qlToType(take);
      const willSpan = remaining - take > 0;

      // Decide tie state for this piece:
      //   - "start" if this is a leading piece of a split note (willSpan)
      //   - "stop"  if this piece continues a previously split note
      //   - "none"  if neither
      // Detect "stop": we've already emitted a "start" earlier in this iteration
      // when willSpan was true on the previous take. Track via `pendingTieStop`.
      // Easier: a piece is a "stop" when it's NOT the first take of the note
      // (i.e., we've already taken some part of it).
      const isContinuation = take < note.ql && remaining < note.ql;
      let tieState;
      if (isContinuation && willSpan) {
        // Middle piece of a 3-bar span — both stop (prev tie) and start
        // (next tie). MusicXML supports two <tie> elements on one note; emit
        // both. Easiest path: emit two separate <note> halves... but our
        // barline algorithm pieces are at most 4 ql each, so a 3-bar span
        // needs 3 ties total. We model the middle as "stop" first then a
        // separate "start" piece. To keep this simple we emit one note with
        // two <tie> markers via concatenation.
        // Practical note: pipeline caps ql in practice at <=8 (RESEARCH.md
        // §Note type element), so middle pieces are rare; encode safely.
        current += emitTwoTies(parts, take, type, dotted);
      } else if (willSpan) {
        tieState = "start";
        current += emitNote(parts, take, type, dotted, tieState);
      } else if (isContinuation) {
        tieState = "stop";
        current += emitNote(parts, take, type, dotted, tieState);
      } else {
        current += emitNote(parts, take, type, dotted, "none");
      }

      beatsInBar += take;
      remaining -= take;

      if (beatsInBar >= 4) {
        bodies.push(current);
        current = "";
        beatsInBar = 0;
      }
    }
  }

  // Pad final partial bar with a rest.
  if (beatsInBar > 0) {
    const padQl = 4 - beatsInBar;
    const { type, dotted } = qlToType(padQl);
    // Rests can be dotted too, but for the cap we just emit a plain typed rest.
    // dotted is only true for padQl=3 (rare path), and a dotted rest still
    // parses; emit <dot/> inside the rest if needed. For simplicity emit plain.
    if (dotted) {
      current +=
        `<note><rest/><duration>${padQl}</duration><type>${type}</type><dot/></note>`;
    } else {
      current += emitRest(padQl, type);
    }
    bodies.push(current);
  }

  return bodies;
}

// Emit a single <note> that both stops a prior tie and starts a new one.
// Used for the rare middle piece of a 3-bar span. MusicXML allows two <tie>
// (sound) and two <tied> (visual) markers on one note.
function emitTwoTies(parts, duration, type, dotted) {
  const { step, alter, octave } = parts;
  const pitchInner =
    `<step>${step}</step>` +
    (alter !== 0 ? `<alter>${alter}</alter>` : "") +
    `<octave>${octave}</octave>`;
  const dotEl = dotted ? `<dot/>` : "";
  return (
    `<note>` +
      `<pitch>${pitchInner}</pitch>` +
      `<duration>${duration}</duration>` +
      `<tie type="stop"/>` +
      `<tie type="start"/>` +
      `<type>${type}</type>` +
      dotEl +
      `<notations><tied type="stop"/><tied type="start"/></notations>` +
    `</note>`
  );
}

// -----------------------------------------------------------------------------
// Public entry point
// -----------------------------------------------------------------------------

export function buildMusicXml(result, instrument, title) {
  const { notes, bpm, key } = result;
  const accidentalStyle = preferredAccidental(key);

  // Header: XML decl + DOCTYPE + root open.
  // Per RESEARCH.md §Element checklist + W3C "Hello World".
  const header =
    `<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n` +
    `<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" ` +
    `"http://www.musicxml.org/dtds/partwise.dtd">\n` +
    `<score-partwise version="4.0">`;

  const safeTitle = escapeXml(title || "score");
  const safeLabel = escapeXml(instrument.label);

  const work = `<work><work-title>${safeTitle}</work-title></work>`;
  const ident =
    `<identification><encoding><software>Link To Notes</software></encoding></identification>`;
  const partList =
    `<part-list><score-part id="P1"><part-name>${safeLabel}</part-name></score-part></part-list>`;

  // First-measure attributes: divisions, key, time, clef, [transpose].
  const fifths = keyToFifths(key);
  const t = instrument.xml;
  const transposeXml =
    t && t.chromatic !== 0
      ? `<transpose>` +
          `<diatonic>${t.diatonic}</diatonic>` +
          `<chromatic>${t.chromatic}</chromatic>` +
          (t.octaveChange ? `<octave-change>${t.octaveChange}</octave-change>` : "") +
        `</transpose>`
      : "";
  const attributesXml =
    `<attributes>` +
      `<divisions>1</divisions>` +
      `<key><fifths>${fifths}</fifths><mode>${key.mode}</mode></key>` +
      `<time><beats>4</beats><beat-type>4</beat-type></time>` +
      `<clef><sign>G</sign><line>2</line></clef>` +
      transposeXml +
    `</attributes>`;

  // Practice tempo for MuseScore to pick up. Match buildAbc's Q:1/4=bpm.
  const directionXml =
    `<direction placement="above"><sound tempo="${bpm}"/></direction>`;

  const bodies = buildMeasures(notes || [], accidentalStyle);

  let part = `<part id="P1">`;
  for (let i = 0; i < bodies.length; i++) {
    const number = i + 1;
    const prefix = i === 0 ? attributesXml + directionXml : "";
    part += `<measure number="${number}">${prefix}${bodies[i]}</measure>`;
  }
  part += `</part>`;

  return header + work + ident + partList + part + `</score-partwise>`;
}
