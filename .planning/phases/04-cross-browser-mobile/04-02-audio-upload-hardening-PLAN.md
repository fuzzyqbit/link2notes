---
phase: 04-cross-browser-mobile
plan: 02
type: execute
wave: 1
depends_on: []
files_modified:
  - web/pipeline.js
  - web/index.html
autonomous: true
requirements:
  - XPLAT-01
user_setup: []
tags:
  - audio
  - error-handling
  - ios-safari
  - file-upload

must_haves:
  truths:
    - "The file picker on iOS Safari does NOT filter out iPhone Voice Memo `.m4a` files (the accept attribute now matches both MIME-by-glob and explicit extensions)"
    - "When `decodeAudioData` rejects (unsupported codec, corrupt file, OGG on iOS Safari), the user sees a curated 'AudioDecodeError' message naming MP3/WAV as safe fallbacks — not a raw DOMException"
    - "A small `<small>` hint below the file input names the supported formats so users with non-MP3 files know what to expect"
    - "The Phase 2 ModelLoadError watchdog path is unchanged — model failures still surface its curated copy"
  artifacts:
    - path: "web/pipeline.js"
      provides: "AudioDecodeError class + try/catch in decodeAudio that throws curated copy"
      exports: ["AudioDecodeError"]
      contains: "class AudioDecodeError"
    - path: "web/index.html"
      provides: "Widened accept attribute on #audio-input + updated <small> hint listing formats"
      contains: "audio/*,.m4a"
  key_links:
    - from: "web/pipeline.js decodeAudio"
      to: "AudioDecodeError"
      via: "try/catch around tmp.decodeAudioData(arrayBuf)"
      pattern: "decodeAudioData.*catch|AudioDecodeError"
    - from: "web/main.js convertBtn click handler"
      to: "showError(err.message)"
      via: "existing catch block at line 98-101 — no change needed; AudioDecodeError.message is the friendly copy"
      pattern: "showError\\(err\\.message"
---

<objective>
Close the two real-world XPLAT-01 risks identified in RESEARCH.md:

1. **iOS Voice Memo MIME inconsistency.** Different iOS Safari builds report `.m4a` as `audio/mp4`, `audio/x-m4a`, or `audio/mpeg`. The current `accept="audio/*"` filter can grey out valid files in the picker. Fix by adding explicit extensions to the accept attribute — MDN guarantees extension-globs are honoured alongside MIME-globs.
2. **Silent decode failures.** Today `decodeAudioData` raw-throws a DOMException ("Unable to decode audio data") which surfaces via `main.js:99` `showError(err.message)` as a useless string. Wrap it in try/catch and throw a new `AudioDecodeError` carrying curated copy that tells the user which formats are safe and how to convert iPhone Voice Memos.

Purpose: matches Phase 2's pattern (ModelLoadError carries curated copy in `.message`, main.js already shows it via the existing catch block). No main.js changes needed — symmetry with the model-load error path.

Output:
- New `AudioDecodeError` class exported from `web/pipeline.js`, plus try/catch around `decodeAudioData` in `decodeAudio()`
- Widened `accept` attribute on `<input id="audio-input">` in `web/index.html`
- Updated `<small>` hint under the file input naming supported formats including "M4A (iPhone voice memos)"
</objective>

<execution_context>
@/Users/rowan/.claude/get-shit-done/workflows/execute-plan.md
@/Users/rowan/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@/Users/rowan/Documents/Note Converter/.planning/PROJECT.md
@/Users/rowan/Documents/Note Converter/.planning/ROADMAP.md
@/Users/rowan/Documents/Note Converter/.planning/STATE.md
@/Users/rowan/Documents/Note Converter/.planning/phases/04-cross-browser-mobile/04-RESEARCH.md
@/Users/rowan/Documents/Note Converter/CLAUDE.md
@/Users/rowan/Documents/Note Converter/web/pipeline.js
@/Users/rowan/Documents/Note Converter/web/index.html
@/Users/rowan/Documents/Note Converter/web/main.js

<interfaces>
Key contracts the executor must hit. Extracted from the current codebase so no exploration is needed.

From `web/pipeline.js`:
- Existing ModelLoadError class at lines 48-53 (template for the new AudioDecodeError):
  ```
  export class ModelLoadError extends Error {
    constructor(msg) {
      super(msg);
      this.name = "ModelLoadError";
    }
  }
  ```
- Existing decodeAudio function at lines 68-86 — the try/catch wraps the call at line 73: `const decoded = await tmp.decodeAudioData(arrayBuf);`
- Line 74 calls `tmp.close();` which must still run on the success path; on the failure path we still want to close the context before throwing (don't leak the AudioContext)

From `web/main.js`:
- Existing catch in the convert-btn click handler at lines 98-101:
  ```
  } catch (err) {
    console.error(err);
    showError(err.message || String(err));
  } finally {
  ```
  This already does the right thing — `AudioDecodeError.message` will carry the curated copy. NO change needed in main.js.
- The pattern is symmetric with how `ModelLoadError` surfaces (Phase 2): pipeline throws, main.js catches, showError shows `err.message`.

From `web/index.html`:
- Line 64: `<input type="file" id="audio-input" accept="audio/*" />`
- Line 65: `<small>Any audio your browser can decode (mp3, wav, m4a, ogg).</small>`

Curated copy (final wording; matches RESEARCH.md §Code Examples > "Friendly decode error"):
> "We couldn't decode this audio file in your browser. Try MP3 or WAV — those work everywhere. If you exported from iPhone Voice Memos, share it from the Voice Memos app as an MP3 first."

Widened accept attribute (per MDN file-input docs — comma-separated mix of MIME globs and dot-prefixed extensions is supported):
> `accept="audio/*,.m4a,.mp3,.wav,.ogg,.flac,.aac,.aiff"`

Updated hint copy (concrete, friendly, names the iOS Voice Memo case):
> "Most audio files work — MP3, WAV, M4A (iPhone voice memos), OGG, FLAC."
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add AudioDecodeError class + try/catch around decodeAudioData</name>
  <files>web/pipeline.js</files>
  <read_first>
    - web/pipeline.js lines 45-86 (existing ModelLoadError class as template, then existing decodeAudio function — both blocks needed in one read)
    - web/main.js lines 84-105 (the convertBtn click handler that catches whatever pipeline throws — confirm no change is needed there)
    - .planning/phases/04-cross-browser-mobile/04-RESEARCH.md §Recommended Approach > XPLAT-01 §Code Examples > "Friendly decode error"
  </read_first>
  <action>
    Modify `web/pipeline.js` in two coordinated edits:

    1. Add a new exported error class and copy constant immediately after the existing `MODEL_ERROR_COPY` / `ModelLoadError` block (currently lines 46-53). Mirror the ModelLoadError shape exactly for consistency:
       - `export class AudioDecodeError extends Error` with a constructor that sets `this.name = "AudioDecodeError";`
       - A module-level constant `const AUDIO_DECODE_COPY = "We couldn't decode this audio file in your browser. Try MP3 or WAV — those work everywhere. If you exported from iPhone Voice Memos, share it from the Voice Memos app as an MP3 first.";`
       Place AUDIO_DECODE_COPY adjacent to its class (above the class is fine — matches the ModelLoadError style of `MODEL_ERROR_COPY` const above the class above it).

    2. Modify the existing `decodeAudio` function (currently lines 68-86) to wrap `tmp.decodeAudioData(arrayBuf)` in a try/catch:
       - The try block contains the single `decodeAudioData` call and assignment to `decoded`.
       - The catch block calls `tmp.close()` to release the AudioContext (mirrors the success path at line 74), then `throw new AudioDecodeError(AUDIO_DECODE_COPY);`. Do NOT include the original error as a cause or in the message — main.js already calls `console.error(err)` for developer visibility before showError.
       - Keep all other lines of decodeAudio untouched: the progress emit at line 69, the arrayBuffer read at 70, the Ctx construction at 71-72, the close at 74 (still runs on the success path), the resample branch at 76-85.

    Do NOT change the existing ModelLoadError or any of its surrounding plumbing. Do NOT change the inferencePromise .catch in extractNotes (Phase 2 owns that path). Do NOT add a third error class. Do NOT change main.js — its existing catch handles the new error via `err.message` automatically (symmetry with the ModelLoadError path is the whole point).

    Constraints from RESEARCH.md: no new dependencies; curated copy is verbatim from the research file (do not paraphrase — copy is part of the spec); preserve `tmp.close()` on both paths to avoid AudioContext leaks on retry.
  </action>
  <verify>
    <automated>grep -E "^export class AudioDecodeError" web/pipeline.js && grep -E "AUDIO_DECODE_COPY" web/pipeline.js && grep -B1 -A6 "decodeAudioData\(arrayBuf\)" web/pipeline.js | grep -q "try" && node --check web/pipeline.js</automated>
    <human-check>Verify in a browser: open web/index.html via a local static server, open DevTools console, run `import("./pipeline.js").then(m => console.log(typeof m.AudioDecodeError))` — should print `"function"`. Then create a fake "broken" file (e.g. a text file renamed to .mp3), pick it via the file input, click Convert; the error pane should display the curated copy starting with "We couldn't decode this audio file in your browser." rather than a DOMException.</human-check>
  </verify>
  <acceptance_criteria>
    - `web/pipeline.js` exports a new class `AudioDecodeError` whose constructor sets `this.name = "AudioDecodeError"`.
    - `AUDIO_DECODE_COPY` constant contains the exact research-spec string (verbatim, including the em-dash and punctuation).
    - `decodeAudio` wraps the `decodeAudioData` call in try/catch; the catch closes the AudioContext before throwing.
    - Success path still calls `tmp.close()` exactly once at line 74 (no double-close).
    - `node --check web/pipeline.js` exits 0.
    - main.js is NOT modified by this task.
  </acceptance_criteria>
  <done>
    AudioDecodeError exists and is thrown by decodeAudio on decode rejection; the catch closes the context before throwing; node syntax check passes; manual broken-file test in the browser surfaces the curated copy via the existing main.js error pane.
  </done>
</task>

<task type="auto">
  <name>Task 2: Widen file-input accept attribute and update format hint</name>
  <files>web/index.html</files>
  <read_first>
    - web/index.html lines 62-66 (the Audio file field — input element + small hint)
    - .planning/phases/04-cross-browser-mobile/04-RESEARCH.md §Common Pitfalls Pitfall 3 (iOS Voice Memo MIME inconsistency — explains the why)
    - .planning/phases/04-cross-browser-mobile/04-RESEARCH.md §Code Examples > "Widened accept attribute"
  </read_first>
  <action>
    Modify `web/index.html` at the Audio file field (currently lines 63-65, the `<input type="file" id="audio-input" ...>` and its sibling `<small>...</small>`).

    1. Replace `accept="audio/*"` with `accept="audio/*,.m4a,.mp3,.wav,.ogg,.flac,.aac,.aiff"`. The MIME glob stays — extension fallbacks are added so iOS Safari versions that report Voice Memos as `audio/mpeg` or `audio/x-m4a` (not under the strict `audio/*` regex some browsers apply) still show the file as pickable. Per MDN, the accept attribute treats comma-separated MIME globs and dot-prefixed extensions as a union match — no order dependency.

    2. Replace the `<small>` text "Any audio your browser can decode (mp3, wav, m4a, ogg)." with "Most audio files work — MP3, WAV, M4A (iPhone voice memos), OGG, FLAC." The new copy is explicitly user-friendly: names the iPhone Voice Memo use case (the highest-MIME-friction format per Pitfall 3), uses uppercase format names (more skimmable on mobile), and uses an em-dash for visual cohesion with other copy on the page.

    Do NOT add `capture="user"` or `capture="microphone"` — that forces the picker into camera/mic UI on mobile (REQUIREMENTS.md "Out of Scope" — real-time mic capture). Do NOT add a `multiple` attribute (out of scope; pipeline is single-file). Do NOT touch any other element in index.html.

    Constraints from RESEARCH.md: no new attributes beyond the widened accept; no JS behavioural change in this task (the try/catch in Task 1 handles the case where a picked file fails to decode after the picker accepts it).
  </action>
  <verify>
    <automated>grep -F 'accept="audio/*,.m4a,.mp3,.wav,.ogg,.flac,.aac,.aiff"' web/index.html && grep -F "iPhone voice memos" web/index.html && ! grep -F 'capture=' web/index.html</automated>
    <human-check>Load web/index.html in Chrome. Click the Audio file input — the OS picker opens. Drag any `.m4a` file from the filesystem into the picker; it should be selectable (no greying out). The `<small>` hint visibly reads "Most audio files work — MP3, WAV, M4A (iPhone voice memos), OGG, FLAC." On iOS Safari (real device test happens in Plan 04-03 S5), the same picker should accept iPhone Voice Memos.</human-check>
  </verify>
  <acceptance_criteria>
    - `web/index.html` accept attribute on `#audio-input` literally matches `audio/*,.m4a,.mp3,.wav,.ogg,.flac,.aac,.aiff`.
    - `<small>` hint text under the file input matches the new wording exactly (case-sensitive on the format names, em-dash present).
    - No `capture` attribute added.
    - No `multiple` attribute added.
    - File diff is HTML-only — only the two lines in the Audio file field change.
  </acceptance_criteria>
  <done>
    Accept attribute and hint updated; manual desktop browser test shows .m4a files are selectable in the picker; hint copy reads correctly; no other index.html elements touched.
  </done>
</task>

</tasks>

<verification>
1. `grep "AudioDecodeError" web/pipeline.js` returns the class definition + the throw site
2. `node --check web/pipeline.js` exits 0
3. `grep -F 'accept="audio/*,.m4a,.mp3,.wav,.ogg,.flac,.aac,.aiff"' web/index.html` returns one line
4. `grep "iPhone voice memos" web/index.html` returns the updated hint
5. `! grep "capture=" web/index.html` (no capture attribute snuck in)
6. Manual: pick a corrupt-renamed file (e.g. a .txt renamed to .mp3) → Convert → error pane shows curated AudioDecodeError copy starting with "We couldn't decode this audio file in your browser."
7. Manual: pick a valid .m4a (any short voice recording) on desktop Chrome → file selects, Convert button enables, pipeline runs end-to-end
</verification>

<success_criteria>
- File picker accepts .m4a / iPhone Voice Memo files even when iOS Safari reports a non-canonical MIME
- Decode failures show a friendly, actionable error (mentions MP3/WAV fallback and the Voice Memos export trick) instead of a DOMException
- Phase 2's ModelLoadError path is unaffected (no regression in the model-load failure surface)
- No main.js change; no new dependencies; no new error categories beyond the single AudioDecodeError
- Phase 4 success criterion #1 ("iOS Safari user: pick file → run pipeline → see score → MusicXML/PDF export without page breaking") becomes verifiable on real device — Plan 04-03 will run S5 (M4A accepted) and S8 (OGG-or-friendly-fail) to confirm
</success_criteria>

<output>
After completing both tasks, run the verification commands above. Then write a summary to `.planning/phases/04-cross-browser-mobile/04-02-SUMMARY.md` capturing:
- Files modified (web/pipeline.js, web/index.html)
- Net LOC change
- Confirmation that main.js was NOT modified (regression-risk reduction)
- One-line readiness statement: "Plan 04-03 test matrix can now exercise S5 (M4A accepted), S8 (OGG or friendly fail), and the decode-error path on real devices."
</output>
