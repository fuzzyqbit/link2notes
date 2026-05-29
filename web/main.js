// UI controller: wires the form to the pipeline and renders ABC -> sheet music.

import { INSTRUMENTS, INSTRUMENT_ORDER } from "./instruments.js";
import { runPipeline, midiToNameForKey, preferredAccidental } from "./pipeline.js";
import { STAGE_ORDER, STAGE_LABELS } from "./stages.js";
import { buildMusicXml } from "./musicxml.js";

const ytUrlInput = document.getElementById("yt-url");
const getAudioBtn = document.getElementById("get-audio-btn");
const fileInput = document.getElementById("audio-input");
const instSelect = document.getElementById("instrument-select");
const convertBtn = document.getElementById("convert-btn");
const statusEl = document.getElementById("status");
const stageListEl = document.getElementById("stage-list");
const errorEl = document.getElementById("error");
const resultEl = document.getElementById("result");
const keyInfo = document.getElementById("key-info");
const bpmInfo = document.getElementById("bpm-info");
const scoreEl = document.getElementById("score");
const lettersEl = document.getElementById("letters-text");

let lastAbc = null;
let lastTitle = "score";
// MusicXML export needs the full pipeline result + the selected instrument
// (not just the rendered ABC), so hold references after each successful render.
let lastResult = null;
let lastInstrument = null;

// Populate instrument dropdown.
for (const id of INSTRUMENT_ORDER) {
  const opt = document.createElement("option");
  opt.value = id;
  opt.textContent = INSTRUMENTS[id].label;
  instSelect.appendChild(opt);
}
instSelect.value = "altoSax";

fileInput.addEventListener("change", () => {
  convertBtn.disabled = !fileInput.files?.length;
});

// Cycle through a few converter sites — pick whichever still works today.
// savefrom.net accepts ?url= for prefill; if that breaks, fall back to its
// `ss`-prefix URL hack (works for youtube.com and music.youtube.com).
function converterUrlFor(youtubeUrl) {
  return `https://en.savefrom.net/391/?url=${encodeURIComponent(youtubeUrl)}`;
}

getAudioBtn.addEventListener("click", async () => {
  const url = ytUrlInput.value.trim();
  if (!url) {
    ytUrlInput.focus();
    return;
  }
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url);
    }
  } catch { /* clipboard blocked — user can paste manually */ }
  window.open(converterUrlFor(url), "_blank", "noopener");
});

ytUrlInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    getAudioBtn.click();
  }
});

convertBtn.addEventListener("click", async () => {
  const file = fileInput.files?.[0];
  if (!file) return;
  lastTitle = file.name.replace(/\.[^.]+$/, "") || "score";

  resetUI();
  resetStages();
  statusEl.hidden = false;
  convertBtn.disabled = true;

  try {
    const instrument = INSTRUMENTS[instSelect.value];
    const result = await runPipeline(file, instrument, renderStage);
    renderResult(result, instrument);
  } catch (err) {
    console.error(err);
    showError(err.message || String(err));
  } finally {
    hideStages();
    convertBtn.disabled = false;
  }
});

function resetUI() {
  errorEl.hidden = true;
  errorEl.textContent = "";
  resultEl.hidden = true;
  scoreEl.innerHTML = "";
  lettersEl.textContent = "";
  lastAbc = null;
  lastResult = null;
  lastInstrument = null;
  hideStages();
}

// Stage indicator: updates the <ol id="stage-list"> based on which pipeline
// stage is currently emitting. Earlier stages flip to "done", later ones stay
// "pending". The active stage's optional `percent` (0..1) is rendered as
// "(NN%)" in its percent span.
function renderStage(evt) {
  if (!evt || !evt.stage) return;
  const activeIdx = STAGE_ORDER.indexOf(evt.stage);
  if (activeIdx < 0) return;
  for (let i = 0; i < STAGE_ORDER.length; i++) {
    const stageId = STAGE_ORDER[i];
    const li = stageListEl.querySelector(`li[data-stage="${stageId}"]`);
    if (!li) continue;
    if (i < activeIdx) {
      li.dataset.state = "done";
      const pct = li.querySelector(".percent");
      if (pct) pct.textContent = "";
    } else if (i === activeIdx) {
      li.dataset.state = "active";
      const pct = li.querySelector(".percent");
      if (pct) {
        if (Number.isFinite(evt.percent)) {
          pct.textContent = `(${Math.round(evt.percent * 100)}%)`;
        } else {
          pct.textContent = "";
        }
      }
    } else {
      li.dataset.state = "pending";
      const pct = li.querySelector(".percent");
      if (pct) pct.textContent = "";
    }
  }
}

function resetStages() {
  for (const stageId of STAGE_ORDER) {
    const li = stageListEl.querySelector(`li[data-stage="${stageId}"]`);
    if (!li) continue;
    li.dataset.state = "pending";
    const pct = li.querySelector(".percent");
    if (pct) pct.textContent = "";
  }
  statusEl.hidden = false;
}

function hideStages() {
  statusEl.hidden = true;
  for (const stageId of STAGE_ORDER) {
    const li = stageListEl.querySelector(`li[data-stage="${stageId}"]`);
    if (!li) continue;
    li.dataset.state = "pending";
    const pct = li.querySelector(".percent");
    if (pct) pct.textContent = "";
  }
}

function showError(msg) {
  errorEl.hidden = false;
  errorEl.textContent = msg;
}

function renderResult(result, instrument) {
  // Capture export-ready state BEFORE abcjs.renderAbc — if rendering throws
  // we still want Save MusicXML to work against the pipeline result.
  lastResult = result;
  lastInstrument = instrument;

  const abc = buildAbc(result, instrument);
  lastAbc = abc;

  // abcjs is loaded via the global <script> tag.
  // eslint-disable-next-line no-undef
  ABCJS.renderAbc("score", abc, {
    responsive: "resize",
    staffwidth: 740,
    add_classes: true,
  });

  const tonicName = midiToNameForKey(result.key.tonic + 60, result.key).slice(0, -1);
  keyInfo.textContent = `Key: ${tonicName} ${result.key.mode}`;
  bpmInfo.textContent = `Practice tempo: ${result.bpm} BPM (source ≈ ${result.sourceBpm})`;
  lettersEl.textContent = result.letters;

  resultEl.hidden = false;
}

// -----------------------------------------------------------------------------
// ABC notation builder
// -----------------------------------------------------------------------------

function buildAbc(result, instrument) {
  const { notes, bpm, key } = result;
  const accidentalStyle = preferredAccidental(key);

  const lines = [];
  lines.push("X:1");
  lines.push(`T:${escapeAbc(lastTitle)}`);
  lines.push(`C:${instrument.label}`);
  lines.push("M:4/4");
  lines.push("L:1/4");
  lines.push(`Q:1/4=${bpm}`);
  lines.push(`K:${abcKey(key)}`);

  // Break into bars of 4 quarter-note beats.
  const tokens = [];
  let beatsInBar = 0;
  for (const n of notes) {
    let remaining = n.ql;
    while (remaining > 0) {
      const room = 4 - beatsInBar;
      const take = Math.min(remaining, room);
      tokens.push(abcNote(n.midi, take, accidentalStyle));
      beatsInBar += take;
      remaining -= take;
      if (beatsInBar >= 4) {
        tokens.push("|");
        beatsInBar = 0;
      }
      // If we split across a bar, tie the two halves (ABC tie suffix: "C-|C").
      if (remaining > 0) {
        const noteIdx = tokens.length - 2;
        tokens[noteIdx] = tokens[noteIdx] + "-";
      }
    }
    // Insert a line break every 4 bars for readable layout.
    const barCount = tokens.filter((t) => t === "|").length;
    if (barCount > 0 && barCount % 4 === 0 && tokens[tokens.length - 1] === "|") {
      tokens.push("\n");
    }
  }
  if (beatsInBar > 0) {
    // Pad final bar with rest so the engraver doesn't complain.
    tokens.push(abcRest(4 - beatsInBar));
    tokens.push("|]");
  } else if (tokens[tokens.length - 1] === "|") {
    tokens[tokens.length - 1] = "|]";
  }

  lines.push(tokens.join(""));
  return lines.join("\n");
}

function abcKey(key) {
  // abcjs key spec: e.g. "G", "Bbm", "F#".
  const sharpNames = ["C","C#","D","Eb","E","F","F#","G","Ab","A","Bb","B"];
  const flatNames  = ["C","Db","D","Eb","E","F","Gb","G","Ab","A","Bb","B"];
  const style = preferredAccidental(key);
  const table = style === "flat" ? flatNames : sharpNames;
  const tonic = table[key.tonic];
  return key.mode === "minor" ? `${tonic}m` : tonic;
}

// MIDI -> ABC pitch token. Middle C (60) = "C". Octaves up add commas/apostrophes.
function abcNote(midi, ql, accStyle) {
  const pc = ((midi % 12) + 12) % 12;
  const octave = Math.floor(midi / 12) - 1;
  const sharpLetters = ["C","^C","D","^D","E","F","^F","G","^G","A","^A","B"];
  const flatLetters  = ["C","_D","D","_E","E","F","_G","G","_A","A","_B","B"];
  const letters = accStyle === "flat" ? flatLetters : sharpLetters;
  let token = letters[pc];
  const accidental = token.startsWith("^") || token.startsWith("_") ? token[0] : "";
  const letter = token.replace(/^[\^_=]/, "");

  // ABC octave convention: C = octave 4, c = octave 5, c' = 6, C, = 3, C,, = 2.
  let pitch;
  if (octave >= 5) {
    pitch = letter.toLowerCase();
    for (let i = 0; i < octave - 5; i++) pitch += "'";
  } else {
    pitch = letter.toUpperCase();
    for (let i = 0; i < 4 - octave; i++) pitch += ",";
  }
  return accidental + pitch + abcDur(ql);
}

function abcRest(ql) {
  return "z" + abcDur(ql);
}

function abcDur(ql) {
  // L:1/4 = one quarter note. So duration multiplier == ql.
  if (ql === 1) return "";
  if (Number.isInteger(ql)) return String(ql);
  // Fractional (unlikely after simplification, but safe).
  const num = Math.round(ql * 4);
  return num + "/4";
}

function escapeAbc(s) {
  return s.replace(/[\r\n]/g, " ");
}

// -----------------------------------------------------------------------------
// Downloads
// -----------------------------------------------------------------------------

document.getElementById("download-musicxml").addEventListener("click", () => {
  // Specific error categories (no silent failures):
  //   - No pipeline result yet  -> "Run a conversion first..."
  //   - Emitter throws          -> surface the message via showError + console
  if (!lastResult || !lastInstrument) {
    showError("Run a conversion first, then export MusicXML.");
    return;
  }
  let xml;
  try {
    xml = buildMusicXml(lastResult, lastInstrument, lastTitle);
  } catch (err) {
    console.error(err);
    showError("Couldn't build the MusicXML file: " + (err.message || String(err)));
    return;
  }
  // IANA-registered MIME for MusicXML (RESEARCH.md §File extension + MIME).
  downloadBlob(xml, `${lastTitle}.musicxml`, "application/vnd.recordare.musicxml+xml");
});

document.getElementById("download-abc").addEventListener("click", () => {
  if (!lastAbc) return;
  downloadBlob(lastAbc, `${lastTitle}.abc`, "text/plain");
});

document.getElementById("download-svg").addEventListener("click", () => {
  const svgEl = scoreEl.querySelector("svg");
  if (!svgEl) return;
  const clone = svgEl.cloneNode(true);
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  const xml = new XMLSerializer().serializeToString(clone);
  downloadBlob(xml, `${lastTitle}.svg`, "image/svg+xml");
});

document.getElementById("download-pdf").addEventListener("click", () => {
  // Browser print dialog -> "Save as PDF". Simpler + higher fidelity than rasterizing.
  const svgEl = scoreEl.querySelector("svg");
  if (!svgEl) return;
  const xml = new XMLSerializer().serializeToString(svgEl);

  const win = window.open("", "_blank");
  if (!win) {
    showError("Pop-up blocked — allow pop-ups for this site to export PDF.");
    return;
  }
  win.document.write(`
    <!doctype html><html><head><meta charset="utf-8"><title>${escapeAbc(lastTitle)}</title>
    <style>
      @page { size: letter; margin: 0.5in; }
      body { margin: 0; font-family: sans-serif; }
      svg { width: 100%; height: auto; }
    </style></head>
    <body>${xml}<script>window.onload = () => setTimeout(() => window.print(), 200);<\/script></body></html>
  `);
  win.document.close();
});

function downloadBlob(content, filename, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
