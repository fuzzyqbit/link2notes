// Audio file -> simplified sheet music pipeline (browser port of converter.py).
//
// Stages:
//   1. Decode user file -> mono 22050 Hz Float32Array (basic-pitch target rate).
//   2. Run @spotify/basic-pitch -> raw frames -> polyphonic note events.
//   3. Monophonic filter (top note wins on overlap).
//   4. Build score events {midi, startSec, durSec} + estimate BPM from inter-onsets.
//   5. Transpose concert -> written for selected instrument; fold octaves to range.
//   6. Detect key (Krumhansl-Schmuckler), snap accidentals to scale (preserve
//      harmonic-minor leading tone).
//   7. Quantize durations to quarter-note grid; cap repeated-note runs.
//
// Output: { notes: [{midi, ql}], bpm, keySig, letters } where ql is in quarter notes.

import {
  BasicPitch,
  noteFramesToTime,
  addPitchBendsToNoteEvents,
  outputToNotesPoly,
} from "https://esm.sh/@spotify/basic-pitch@1.0.1";
import { STAGE, STAGE_LABELS } from "./stages.js";

// jsdelivr serves arbitrary files inside an npm package; basic-pitch ships the
// TFJS model at /model/model.json with weight shards next to it.
const MODEL_URL = "https://cdn.jsdelivr.net/npm/@spotify/basic-pitch@1.0.1/model/model.json";
const BP_SAMPLE_RATE = 22050;
const TARGET_BPM = 70;            // beginner-friendly practice tempo
const MIN_NOTE_QL = 2.0;          // minimum quarter-note length after simplification
const RUN_LIMIT = 2;              // collapse runs of same pitch beyond this many repeats

// -----------------------------------------------------------------------------
// Model-load watchdog (XPLAT-03)
// -----------------------------------------------------------------------------
// Why a reset-on-progress timer (not a flat setTimeout)?
//   - basic-pitch's percent callback fires repeatedly during inference. As long
//     as we see progress, the model is alive. A flat 20s setTimeout would
//     false-positive on slow CDN cold loads where the model takes >20s to
//     download but then runs fine.
//   - We reset `lastTickAt = Date.now()` on every percent callback and poll
//     every 1s. If we ever go >20s without a tick, we reject with a friendly
//     ModelLoadError. The user sees the error between ~20-21s — matches the
//     phase success criterion (~15s) within the polling-interval margin.
//   - 20000ms threshold per 02-RESEARCH.md ("XPLAT-03 — Model failure detection").

const MODEL_TIMEOUT_MS = 20000;
const MODEL_ERROR_COPY = "This browser couldn't load the transcription model in time. It may not support the audio-to-notes AI. Try Chrome, Edge, or Firefox on a laptop or desktop computer.";

export class ModelLoadError extends Error {
  constructor(msg) {
    super(msg);
    this.name = "ModelLoadError";
  }
}

// Krumhansl-Schmuckler major/minor pitch profiles.
const KS_MAJOR = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const KS_MINOR = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

const NOTE_NAMES_SHARP = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
const NOTE_NAMES_FLAT  = ["C","Db","D","Eb","E","F","Gb","G","Ab","A","Bb","B"];

// -----------------------------------------------------------------------------
// 1. Audio decoding (browser decodes anything; we resample to 22050 mono since
//    basic-pitch's model expects exactly that — AudioContext.decodeAudioData
//    returns audio at the device sample rate, not the source's).
// -----------------------------------------------------------------------------

export async function decodeAudio(file, progress) {
  if (progress) progress({ stage: STAGE.DECODING, label: STAGE_LABELS[STAGE.DECODING] });
  const arrayBuf = await file.arrayBuffer();
  const Ctx = window.AudioContext || window.webkitAudioContext;
  const tmp = new Ctx();
  const decoded = await tmp.decodeAudioData(arrayBuf);
  tmp.close();

  if (decoded.sampleRate === BP_SAMPLE_RATE && decoded.numberOfChannels === 1) return decoded;

  const targetLen = Math.ceil(decoded.duration * BP_SAMPLE_RATE);
  const OfflineCtx = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  const offline = new OfflineCtx(1, targetLen, BP_SAMPLE_RATE);
  const src = offline.createBufferSource();
  src.buffer = decoded;
  src.connect(offline.destination);
  src.start();
  return await offline.startRendering();
}

// -----------------------------------------------------------------------------
// 2. ML inference
// -----------------------------------------------------------------------------

export async function extractNotes(audioBuffer, progress) {
  if (progress) progress({ stage: STAGE.MODEL_LOADING, label: STAGE_LABELS[STAGE.MODEL_LOADING] });

  const bp = new BasicPitch(MODEL_URL);

  const frames = [];
  const onsets = [];
  const contours = [];

  // Watchdog state. `lastTickAt` is reset on every percent callback below;
  // the timeoutPromise polls every 1s and rejects if we go quiet for >20s.
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

  // Wrap the inference promise. The .catch converts CDN/fetch failures
  // ("TypeError: Failed to fetch", 503s, CORS errors) into the same friendly
  // ModelLoadError the watchdog uses, so the user never sees a raw network
  // error string. The original error still goes to console.error via main.js.
  const inferencePromise = bp.evaluateModel(
    audioBuffer,
    (f, o, c) => {
      frames.push(...f);
      onsets.push(...o);
      contours.push(...c);
    },
    (pct) => {
      // Reset the watchdog FIRST so the progress callback's own work
      // (forwarding to UI) can never accidentally race with the timer.
      lastTickAt = Date.now();
      if (progress) progress({ stage: STAGE.TRANSCRIBING, label: STAGE_LABELS[STAGE.TRANSCRIBING], percent: pct });
    },
  ).catch((err) => {
    // Preserve the original error for developer debugging (main.js logs it)
    // but rewrite the surfaced message to the curated user-facing copy.
    if (err instanceof ModelLoadError) throw err;
    throw new ModelLoadError(MODEL_ERROR_COPY);
  });

  try {
    await Promise.race([inferencePromise, timeoutPromise]);
  } finally {
    // Always clear the polling interval — whether the race resolved with the
    // inference or rejected with the watchdog or fetch-rethrow.
    timeoutCleanup?.();
  }

  // outputToNotesPoly(frames, onsets, onsetThresh, frameThresh, minNoteLen).
  const polyNotes = outputToNotesPoly(frames, onsets, 0.25, 0.25, 5);
  const withBends = addPitchBendsToNoteEvents(contours, polyNotes);
  const timed = noteFramesToTime(withBends);

  // Normalize: entries are {startTimeSeconds, durationSeconds, pitchMidi, ...}
  return timed.map((n) => ({
    start: n.startTimeSeconds,
    end: n.startTimeSeconds + n.durationSeconds,
    midi: Math.round(n.pitchMidi),
  }));
}

// -----------------------------------------------------------------------------
// 3. Monophonic filter
// -----------------------------------------------------------------------------

export function monophonicFilter(events, minDur = 0.06) {
  const cleaned = events.filter((e) => e.end - e.start >= minDur).map((e) => ({ ...e }));
  cleaned.sort((a, b) => a.start - b.start || b.midi - a.midi);

  const out = [];
  for (const ev of cleaned) {
    if (out.length === 0) { out.push(ev); continue; }
    const last = out[out.length - 1];
    if (ev.start >= last.end) {
      out.push(ev);
    } else if (ev.midi > last.midi) {
      // Higher pitch overrides; truncate previous note.
      last.end = ev.start;
      if (last.end - last.start < minDur) out.pop();
      out.push(ev);
    }
  }
  return out;
}

// -----------------------------------------------------------------------------
// 4. Tempo estimate (median inter-onset interval -> BPM)
// -----------------------------------------------------------------------------

export function estimateBpm(events) {
  if (events.length < 4) return 120;
  const intervals = [];
  for (let i = 1; i < events.length; i++) {
    const d = events[i].start - events[i - 1].start;
    if (d > 0.08 && d < 2.0) intervals.push(d);
  }
  if (!intervals.length) return 120;
  intervals.sort((a, b) => a - b);
  const median = intervals[Math.floor(intervals.length / 2)];
  // median IOI is one beat at the song's pulse
  let bpm = 60 / median;
  while (bpm < 60) bpm *= 2;
  while (bpm > 200) bpm /= 2;
  return Math.round(bpm);
}

// -----------------------------------------------------------------------------
// 5. Transposition + range folding
// -----------------------------------------------------------------------------

export function transposeAndFit(events, instrument) {
  const written = events.map((e) => ({ ...e, midi: e.midi + instrument.transposeSemitones }));

  // Find the bulk-shift (in octaves) that maximizes notes inside the comfort range.
  let bestShift = 0;
  let bestScore = -Infinity;
  for (let shift = -24; shift <= 24; shift += 12) {
    let score = 0;
    for (const ev of written) {
      const m = ev.midi + shift;
      if (m >= instrument.loMidi && m <= instrument.hiMidi) score += 1;
      if (m >= instrument.comfortLo && m <= instrument.comfortHi) score += 1;
    }
    if (score > bestScore) { bestScore = score; bestShift = shift; }
  }

  return written.map((ev) => {
    let m = ev.midi + bestShift;
    while (m < instrument.loMidi) m += 12;
    while (m > instrument.hiMidi) m -= 12;
    while (m < instrument.comfortLo && m + 12 <= instrument.hiMidi) m += 12;
    while (m > instrument.comfortHi && m - 12 >= instrument.loMidi) m -= 12;
    return { ...ev, midi: m };
  });
}

// -----------------------------------------------------------------------------
// 6. Key detection + scale snap
// -----------------------------------------------------------------------------

export function detectKey(events) {
  const hist = new Array(12).fill(0);
  for (const ev of events) {
    const dur = Math.max(0.05, ev.end - ev.start);
    hist[((ev.midi % 12) + 12) % 12] += dur;
  }

  function correlate(profile, tonicPc) {
    const rotated = new Array(12);
    for (let i = 0; i < 12; i++) rotated[i] = profile[(i - tonicPc + 12) % 12];
    let sumXY = 0, sumX = 0, sumY = 0, sumX2 = 0, sumY2 = 0;
    for (let i = 0; i < 12; i++) {
      sumXY += hist[i] * rotated[i];
      sumX += hist[i]; sumY += rotated[i];
      sumX2 += hist[i] ** 2; sumY2 += rotated[i] ** 2;
    }
    const n = 12;
    const num = n * sumXY - sumX * sumY;
    const den = Math.sqrt((n * sumX2 - sumX ** 2) * (n * sumY2 - sumY ** 2));
    return den === 0 ? 0 : num / den;
  }

  let best = { tonic: 0, mode: "major", score: -Infinity };
  for (let tonic = 0; tonic < 12; tonic++) {
    const maj = correlate(KS_MAJOR, tonic);
    if (maj > best.score) best = { tonic, mode: "major", score: maj };
    const min = correlate(KS_MINOR, tonic);
    if (min > best.score) best = { tonic, mode: "minor", score: min };
  }
  return best;
}

export function scalePitchClasses(key) {
  // Major: W-W-H-W-W-W-H. Natural minor: W-H-W-W-H-W-W.
  // Add harmonic-minor leading tone for minor keys (preserves raised 7).
  const majorSteps = [0, 2, 4, 5, 7, 9, 11];
  const minorSteps = [0, 2, 3, 5, 7, 8, 10];
  const steps = key.mode === "major" ? majorSteps : minorSteps;
  const set = new Set(steps.map((s) => (s + key.tonic) % 12));
  if (key.mode === "minor") set.add((key.tonic + 11) % 12);
  return set;
}

export function snapToScale(events, key) {
  const scale = scalePitchClasses(key);
  return events.map((ev) => {
    let m = ev.midi;
    if (scale.has(((m % 12) + 12) % 12)) return ev;
    for (const delta of [1, -1, 2, -2]) {
      const pc = (((m + delta) % 12) + 12) % 12;
      if (scale.has(pc)) return { ...ev, midi: m + delta };
    }
    return ev;
  });
}

// -----------------------------------------------------------------------------
// 7. Quantize + simplify
// -----------------------------------------------------------------------------

export function quantizeAndSimplify(events, bpm) {
  const qps = bpm / 60.0;
  const result = [];
  let prevMidi = null;
  let runCount = 0;

  for (const ev of events) {
    let ql = (ev.end - ev.start) * qps;
    if (ql < 0.5) continue;
    ql = Math.max(MIN_NOTE_QL, Math.round(ql));

    if (prevMidi === ev.midi) {
      runCount += 1;
      if (runCount > RUN_LIMIT) {
        if (result.length) result[result.length - 1].ql += ql;
        continue;
      }
    } else {
      runCount = 0;
    }

    result.push({ midi: ev.midi, ql });
    prevMidi = ev.midi;
  }
  return result;
}

// -----------------------------------------------------------------------------
// Letters string for the preview pane
// -----------------------------------------------------------------------------

export function notesToLetters(notes, maxNotes = 200) {
  if (!notes.length) return "(no notes detected)";
  const out = [];
  for (let i = 0; i < notes.length && i < maxNotes; i++) {
    out.push(midiToName(notes[i].midi, true));
  }
  if (notes.length > maxNotes) out.push("...");
  return out.join(" ");
}

export function midiToName(midi, withOctave = false) {
  const pc = ((midi % 12) + 12) % 12;
  const octave = Math.floor(midi / 12) - 1;
  const name = NOTE_NAMES_SHARP[pc];
  return withOctave ? `${name}${octave}` : name;
}

// Pick the spelling (sharps vs flats) that matches the detected key signature.
export function preferredAccidental(key) {
  // Keys with flats: F, Bb, Eb, Ab, Db, Gb major and their relative minors.
  const flatTonicsMajor = new Set([5, 10, 3, 8, 1, 6]);  // F, Bb, Eb, Ab, Db, Gb
  if (key.mode === "major") return flatTonicsMajor.has(key.tonic) ? "flat" : "sharp";
  // Relative-minor tonic = major tonic - 3 semitones.
  const relMajor = (key.tonic + 3) % 12;
  return flatTonicsMajor.has(relMajor) ? "flat" : "sharp";
}

export function midiToNameForKey(midi, key) {
  const pc = ((midi % 12) + 12) % 12;
  const octave = Math.floor(midi / 12) - 1;
  const table = preferredAccidental(key) === "flat" ? NOTE_NAMES_FLAT : NOTE_NAMES_SHARP;
  return `${table[pc]}${octave}`;
}

// -----------------------------------------------------------------------------
// End-to-end orchestrator
// -----------------------------------------------------------------------------

export async function runPipeline(file, instrument, progress) {
  const audio = await decodeAudio(file, progress);
  const raw = await extractNotes(audio, progress);

  if (progress) progress({ stage: STAGE.RENDERING, label: STAGE_LABELS[STAGE.RENDERING] });
  const mono = monophonicFilter(raw);
  if (!mono.length) throw new Error("No notes detected in audio.");

  const bpmSource = estimateBpm(mono);

  const fitted = transposeAndFit(mono, instrument);

  const key = detectKey(fitted);
  const snapped = snapToScale(fitted, key);

  const notes = quantizeAndSimplify(snapped, bpmSource);

  if (!notes.length) throw new Error("No notes survived simplification — try a clearer recording.");

  const letters = notesToLetters(notes.map((n) => ({ midi: n.midi })));

  return {
    notes,                  // [{midi, ql}]
    bpm: TARGET_BPM,        // practice tempo (not source BPM)
    sourceBpm: bpmSource,
    key,                    // {tonic, mode}
    letters,
  };
}
