# Test Matrix — Phase 4 Cross-Browser & Mobile

**Deployed URL:** `<DEPLOYED_URL>` (likely `https://fuzzyqbit.github.io/link2notes/` — confirm before walking)
**Walk started:** `<YYYY-MM-DD>`
**Walked by:** (user)

This matrix closes deferred caveats from Phases 1 (real-iOS PDF print smoke), 2 (model load on mobile, instrument persistence cross-browser, private-mode silent fallback), and 3 (live cobalt click-through on deployed URL + iOS Safari popup-blocker). It is the single honest-pass record for XPLAT-01 and XPLAT-02. All cells must be tested against the deployed GitHub Pages URL — NOT localhost — because Phase 1 PDF popup and Phase 3 cobalt handoff behave differently on real https vs local http.

---

## Pre-Walk Checklist

- [ ] Latest `main` has deployed successfully to GitHub Pages (Plan 04-01 mobile-layout fixes + Plan 04-02 upload-hardening are live).
- [ ] iPhone with Safari is available (real device, not an emulator).
- [ ] Android device with Chrome status confirmed (real device available, OR DevTools-emulation fallback acknowledged and flagged in Device Coverage below).
- [ ] Firefox is installed on the Mac (or downloaded from mozilla.org).
- [ ] Edge decision made: installed on Mac, OR accepted "Chromium proxy via Chrome" with that caveat captured in Device Coverage below.

---

## Device Coverage

| Device class             | Approach                                                                                  | Status |
| ------------------------ | ----------------------------------------------------------------------------------------- | ------ |
| iPhone (real, iOS Safari) | User's own iPhone hits the deployed URL                                                  | TBD    |
| Android Chrome            | Real device if accessible; otherwise Chrome DevTools mobile emulation w/ caveat          | TBD    |
| Desktop Chrome (Mac)      | Direct browser test                                                                       | TBD    |
| Desktop Safari (Mac)      | Direct browser test                                                                       | TBD    |
| Desktop Firefox (Mac)     | Install if absent; direct test                                                            | TBD    |
| Desktop Edge (Mac)        | Install if absent; OR substitute with Chrome (Chromium proxy) and note it                | TBD    |

Replace each `TBD` with one of: `✓ tested` / `DevTools-emulation only` / `Chromium proxy via Chrome` / `not tested (reason)`.

---

## Legend

- ✅ pass
- ❌ fail (see Triage Log)
- ⚠️ partial (see Notes column / Triage Log)
- N/A not applicable for this device class
- ⬜ not yet tested

---

## Matrix

| Scenario                          | iOS Safari | Android Chrome | Desktop Chrome | Desktop Safari | Desktop Firefox | Desktop Edge |
| --------------------------------- | ---------- | -------------- | -------------- | -------------- | --------------- | ------------ |
| S1 Page loads                     | ⬜         | ⬜             | ⬜             | ⬜             | ⬜              | ⬜           |
| S2 No h-scroll                    | ⬜         | ⬜             | N/A            | N/A            | N/A             | N/A          |
| S3 Thumb reach                    | ⬜         | ⬜             | N/A            | N/A            | N/A             | N/A          |
| S4 Picker opens                   | ⬜         | ⬜             | ⬜             | ⬜             | ⬜              | ⬜           |
| S5 M4A accepted                   | ⬜         | ⬜             | ⬜             | ⬜             | ⬜              | ⬜           |
| S6 MP3 accepted                   | ⬜         | ⬜             | ⬜             | ⬜             | ⬜              | ⬜           |
| S7 WAV accepted                   | ⬜         | ⬜             | ⬜             | ⬜             | ⬜              | ⬜           |
| S8 OGG (or friendly fail)         | ⬜         | ⬜             | ⬜             | ⬜             | ⬜              | ⬜           |
| S9 Pipeline runs                  | ⬜         | ⬜             | ⬜             | ⬜             | ⬜              | ⬜           |
| S10 Model load OR friendly fail   | ⬜         | ⬜             | ⬜             | ⬜             | ⬜              | ⬜           |
| S11 Score readable                | ⬜         | ⬜             | N/A            | N/A            | N/A             | N/A          |
| S12 MusicXML download             | ⬜         | ⬜             | ⬜             | ⬜             | ⬜              | ⬜           |
| S13 PDF print                     | ⬜         | ⬜             | ⬜             | ⬜             | ⬜              | ⬜           |
| S14 cobalt handoff                | ⬜         | ⬜             | ⬜             | ⬜             | ⬜              | ⬜           |
| S15 Instrument persists           | ⬜         | ⬜             | ⬜             | ⬜             | ⬜              | ⬜           |
| S16 Private mode                  | ⬜         | N/A            | N/A            | ⬜             | N/A             | N/A          |

---

## Scenario Details

Each entry repeats the trigger and pass criterion verbatim from RESEARCH.md §Scenarios so the walker doesn't have to flip back.

1. **S1 Page loads without console error**
   - **Trigger:** Visit deployed URL.
   - **Pass criterion:** No red errors in DevTools console; page renders fully.

2. **S2 Viewport: no horizontal page scroll** (phones only — N/A for desktop)
   - **Trigger:** Visit on phone viewport.
   - **Pass criterion:** Drag finger left/right anywhere on page — nothing scrolls horizontally.

3. **S3 Controls reachable with one thumb** (phones only)
   - **Trigger:** Phone viewport.
   - **Pass criterion:** File picker + instrument dropdown + Convert button all reachable without a two-hand grip.

4. **S4 Audio file upload picker opens**
   - **Trigger:** Tap "Audio file" input.
   - **Pass criterion:** OS file picker / "Choose from Files" sheet appears.

5. **S5 M4A (Voice Memo) accepted**
   - **Trigger:** Pick an iPhone Voice Memo `.m4a` (Voice Memos app → Share → Save to Files → "On My iPhone" → then pick via Safari file input).
   - **Pass criterion:** File appears in input, Convert button enables. (Proves Plan 04-02 accept widening works.)

6. **S6 MP3 accepted**
   - **Trigger:** Pick any MP3.
   - **Pass criterion:** Same as S5 (file selectable, Convert enables).

7. **S7 WAV accepted**
   - **Trigger:** Pick any WAV.
   - **Pass criterion:** Same.

8. **S8 OGG accepted OR shows friendly decode-error message** (closes XPLAT-01 + Plan 04-02 AudioDecodeError path)
   - **Trigger:** Pick OGG (skip if iOS Safari can't even select — note as N/A with reason).
   - **Pass criterion:** Either decodes successfully OR shows the friendly decode-error message (NOT a silent fail, NOT a raw DOMException).

9. **S9 Full pipeline runs end-to-end**
   - **Trigger:** Pick a valid audio file → Convert.
   - **Pass criterion:** Stage list advances Decoding → Loading model → Transcribing (with %) → Rendering; score appears.

10. **S10 Model load on mobile completes OR fails friendly within ~20s** (closes Phase 2 watchdog scenario)
    - **Trigger:** First-time visit, cold cache. (To force cold: fresh Private tab, OR Settings → Safari → Clear History and Website Data first.)
    - **Pass criterion:** Either the model loads and pipeline finishes within ~60s OR the 20s ModelLoadError appears with the curated copy ("Try Chrome, Edge, or Firefox on a laptop or desktop computer") — NOT an infinite spinner. Note actual timing in Notes / Triage.

11. **S11 Score readable on phone** (closes XPLAT-02 + Plan 04-01 CSS work)
    - **Trigger:** After S9 succeeds, scroll to the score.
    - **Pass criterion:** Score visible at usable size; no inner horizontal scrollbar inside `.score`; pinch-to-zoom on the page makes notes legible.

12. **S12 Save MusicXML downloads a file**
    - **Trigger:** Tap "Save MusicXML".
    - **Pass criterion:** A `.musicxml` file lands in Downloads / Files.

13. **S13 Download PDF opens print dialog** (closes Phase 1 deferred iOS PDF caveat)
    - **Trigger:** Tap "Download PDF".
    - **Pass criterion:** iOS: print preview appears with score visible (NOT blank — Pitfall 6 from RESEARCH.md is the failure shape). Desktop: print dialog appears.

14. **S14 YouTube Get MP3 button opens cobalt with URL prefilled** (closes Phase 3 deferred live-cobalt caveat)
    - **Trigger:** Paste a real YouTube URL → tap Get MP3.
    - **Pass criterion:** New tab opens at cobalt.tools with URL prefilled in the hash fragment. On iOS: no popup-blocker prompt.

15. **S15 Instrument persists across reload** (closes Phase 2 PAR-03 deferred scenario)
    - **Trigger:** Pick Tenor Saxophone → fully reload the tab.
    - **Pass criterion:** Dropdown still says Tenor Saxophone.

16. **S16 Page works in Safari private mode (instrument defaults silently to Alto Sax)** (closes Phase 2 Scenario C)
    - **Trigger:** Open the deployed URL in a Safari Private window (desktop) or Private tab (iOS).
    - **Pass criterion:** No exceptions in console; instrument dropdown defaults to Alto Saxophone silently (no error toast about failed persistence).

---

## Triage Log

Fill one row per ❌ or ⚠️ cell during the walk.

| Scenario | Device | Symptom | Decision (fix-in-phase / punt-to-v1.1) | Owner / Notes |
| -------- | ------ | ------- | -------------------------------------- | ------------- |
|          |        |         |                                        |               |

---

## Deferred Caveats Closed

Tick each box when the corresponding scenario has been walked AND the result documented in the matrix above. If a caveat could not be closed (e.g. S13 still blank on iOS), leave the box unchecked and add a Notes line explaining the punt.

- [ ] Phase 1 real-iOS PDF print smoke test → S13
- [ ] Phase 2 model-load on mobile → S10
- [ ] Phase 2 instrument persistence cross-browser → S15
- [ ] Phase 2 private-mode silent fallback → S16
- [ ] Phase 3 live cobalt click-through on deployed URL → S14
- [ ] Phase 3 iOS Safari popup-blocker on cobalt handoff → S14 sub-observation

---

## Triage Protocol

Verbatim from RESEARCH.md §Failure handling protocol.

- **❌ small + low-regression-risk** → fix in this phase as a follow-on edit. The executor opens a discussion with the user describing the change BEFORE editing any source outside this test-matrix file. If approved: make the edit, redeploy, re-run the affected matrix cell, update the cell to ✅.
- **❌ big or risky** → punt to v1.1. Add a one-line entry to `.planning/STATE.md` under `## Accumulated Context > ### Open Todos` describing the issue, the scenario that surfaced it, and the device class. Update the matrix Notes column / Triage Log to reference the STATE.md line.
- **⚠️ partial** → record the exact symptom in the Triage Log and decide the same way (fix-in-phase vs punt).
- The phase doesn't try to fix everything — it documents what's known broken and ships honest.
