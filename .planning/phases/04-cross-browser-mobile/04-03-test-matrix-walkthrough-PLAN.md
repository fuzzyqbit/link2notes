---
phase: 04-cross-browser-mobile
plan: 03
type: execute
wave: 2
depends_on:
  - 04-01
  - 04-02
files_modified:
  - .planning/phases/04-cross-browser-mobile/04-test-matrix.md
autonomous: false
requirements:
  - XPLAT-01
  - XPLAT-02
user_setup:
  - service: github-pages
    why: "Real-device tests must run against the deployed Pages URL (not localhost) so Phase 1 PDF popup and Phase 3 cobalt handoff behaviour match what end users see"
    dashboard_config:
      - task: "Confirm latest commit on `main` has deployed successfully to GitHub Pages before starting the matrix walk; if Phase 5 auto-deploy isn't wired yet, push manually and wait for the Pages build to go green"
        location: "GitHub repo → Actions tab (or Settings → Pages)"
  - service: ios-safari
    why: "Real iPhone testing closes the deferred caveats from Phases 1-3 (PDF print blank-preview, cobalt handoff popup-blocker, M4A voice memo decode, AudioContext on iOS)"
    dashboard_config:
      - task: "User opens deployed Pages URL on their iPhone in Safari; for cold-load test, use Settings → Safari → Clear History and Website Data first OR a fresh Private tab"
        location: "iPhone Safari"
  - service: android-chrome
    why: "Real-device confirmation of XPLAT-01 on Android; DevTools emulation is best-effort only and should be flagged in the matrix if a real device isn't available"
    dashboard_config:
      - task: "Borrow or use any Android phone with Chrome to load the deployed URL; if unavailable, use Chrome DevTools mobile emulation and flag those cells in the matrix"
        location: "Android Chrome (preferred) OR Chrome DevTools Device Toolbar"

must_haves:
  truths:
    - "Phase 4 success criteria #1, #2, #3, #4 are confirmed (or honestly failed-and-documented) against the deployed GitHub Pages URL on real iOS Safari"
    - "A filled-in test matrix exists at `.planning/phases/04-cross-browser-mobile/04-test-matrix.md` with pass/fail/notes for every applicable cell"
    - "Each ❌ has a triage decision recorded: fix-in-phase (small fix, no regression risk) OR punt-to-v1.1 (logged in STATE.md Open Todos)"
    - "Deferred caveats from Phases 1, 2, 3 (real-iOS PDF print, browser-error scenarios, live cobalt click-through) are explicitly addressed by scenario rows S13, S10/S16, S14"
    - "Android coverage is honestly labelled: real-device cells marked as such, DevTools-emulation cells flagged with a caveat"
  artifacts:
    - path: ".planning/phases/04-cross-browser-mobile/04-test-matrix.md"
      provides: "Filled-in 16-scenario × 6-device-class matrix + triage notes for any failures"
      contains: "# Test Matrix"
  key_links:
    - from: "04-test-matrix.md ❌ cells"
      to: "STATE.md Open Todos OR new fix tasks in this plan"
      via: "Triage column in the matrix"
      pattern: "punt-to-v1.1|fix-in-phase"
    - from: "Phase 1/2/3 deferred caveats"
      to: "Scenarios S13 / S10+S16 / S14"
      via: "1:1 mapping in the matrix preamble"
      pattern: "S13|S10|S14"
---

<objective>
This phase is verification-heavy, not feature-heavy. Plans 04-01 and 04-02 ship small, low-risk code changes. Plan 04-03 is the actual deliverable: a structured, user-driven walk through the 16-scenario × 6-device-class test matrix from RESEARCH.md §Test Matrix, run against the **deployed GitHub Pages URL** on the user's own iPhone (+ Android if accessible) and on desktop browsers.

Purpose: closes the "passed-with-caveats" debt from Phases 1, 2, and 3 (real-iOS PDF print, browser-error scenarios, live cobalt click-through) in a single honest pass. The deliverable is `.planning/phases/04-cross-browser-mobile/04-test-matrix.md` — a filled-in markdown grid with pass/fail/notes per cell, plus a triage list deciding which (if any) failures get fixed in this phase vs. punted to v1.1.

Output:
- New file `.planning/phases/04-cross-browser-mobile/04-test-matrix.md` (scaffold from Task 1, filled in by Task 2)
- Updated STATE.md Open Todos with any v1.1 punts (Task 2 if needed)
- Any small fix-in-phase patches Task 2 surfaces (handled inline as small follow-on edits, with the executor showing diffs before applying)
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
@/Users/rowan/Documents/Note Converter/.planning/phases/01-score-export-parity/01-VERIFICATION.md
@/Users/rowan/Documents/Note Converter/.planning/phases/02-instrument-persistence-error-handling/02-VERIFICATION.md
@/Users/rowan/Documents/Note Converter/.planning/phases/03-youtube-handoff-polish/03-VERIFICATION.md
@/Users/rowan/Documents/Note Converter/.planning/phases/04-cross-browser-mobile/04-01-SUMMARY.md
@/Users/rowan/Documents/Note Converter/.planning/phases/04-cross-browser-mobile/04-02-SUMMARY.md

<interfaces>
The matrix scaffold (rows = scenarios, columns = device classes) and the 16 scenario definitions come verbatim from RESEARCH.md §Test Matrix. The executor must not invent new scenarios — the research file is the spec. The legend (✅ / ❌ / ⚠️ / N/A) and the triage protocol (fix-in-phase vs punt-to-v1.1) also come from there.

Deferred caveats this matrix closes (from prior VERIFICATION.md files):
- Phase 1: real-iOS PDF print smoke test → S13 (PDF print)
- Phase 2: 6 browser scenarios (model load + private mode + persistence) → S10 + S15 + S16
- Phase 3: live cobalt click-through on deployed URL + iOS Safari popup-blocker → S14 (cobalt handoff)

Devices in scope (RESEARCH.md §Devices in scope):
| Device class | Approach | Availability |
|---|---|---|
| iPhone (real, iOS Safari) | User's own iPhone, hits deployed URL | Available |
| Android Chrome | Real device if accessible, otherwise DevTools emulation w/ caveat | Uncertain — flag at start |
| Desktop Chrome (Mac) | Direct browser test | Available |
| Desktop Safari (Mac) | Direct browser test | Available |
| Desktop Firefox (Mac) | Install if absent | Verify at start |
| Desktop Edge (Mac) | Install if absent; or accept Chrome as proxy (both Chromium) | Verify or substitute |

Scenarios (RESEARCH.md §Scenarios — full text per row):
S1 Page loads without console error
S2 Viewport: no horizontal page scroll (phones only — N/A for desktop)
S3 Controls reachable with one thumb (phones only)
S4 Audio file upload picker opens
S5 M4A (Voice Memo) accepted
S6 MP3 accepted
S7 WAV accepted
S8 OGG accepted OR shows friendly decode-error message (NOT silent fail) — closes XPLAT-01 + Plan 04-02 AudioDecodeError path
S9 Full pipeline runs end-to-end (stage list advances, score appears)
S10 Model load completes OR fails friendly within ~20s (closes Phase 2 watchdog scenario)
S11 Score readable on phone — closes XPLAT-02 + Plan 04-01 CSS work
S12 Save MusicXML downloads a file
S13 Download PDF opens print dialog — closes Phase 1 deferred iOS PDF caveat
S14 YouTube Get MP3 button opens cobalt with URL prefilled — closes Phase 3 deferred live-cobalt caveat
S15 Instrument persists across reload — closes Phase 2 PAR-03 deferred scenario
S16 Page works in Safari private mode (instrument defaults silently to Alto Sax) — closes Phase 2 Scenario C

Triage protocol per RESEARCH.md §Failure handling protocol:
- ❌ small + low-regression-risk → fix in this phase as a follow-on edit (executor opens a discussion with user before changing code outside the test-matrix file)
- ❌ big or risky → punt to v1.1; add one-line entry to STATE.md Open Todos; document in test matrix Notes column
- ⚠️ partial → record exact symptom and decide same way

Pre-walk checklist (user must confirm before starting Task 2):
1. The current `main` branch has been deployed to GitHub Pages (latest Plan 04-01 + 04-02 changes are live).
2. User has access to their iPhone with Safari.
3. User has confirmed (or denied) access to an Android device — DevTools fallback is acknowledged either way.
4. User has Firefox installed on Mac (download from mozilla.org if missing).
5. User has decided on Edge: install OR accept "Chromium proxy via Chrome" with that caveat captured in the matrix.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Scaffold the test matrix document</name>
  <files>.planning/phases/04-cross-browser-mobile/04-test-matrix.md</files>
  <read_first>
    - .planning/phases/04-cross-browser-mobile/04-RESEARCH.md §Test Matrix (Devices in scope + Scenarios + Matrix template + Failure handling protocol) — this is the literal source of the scaffold contents
    - .planning/phases/01-score-export-parity/01-VERIFICATION.md (so the executor knows which caveats S13 inherits)
    - .planning/phases/02-instrument-persistence-error-handling/02-VERIFICATION.md (S10, S15, S16)
    - .planning/phases/03-youtube-handoff-polish/03-VERIFICATION.md (S14)
  </read_first>
  <action>
    Create `.planning/phases/04-cross-browser-mobile/04-test-matrix.md` with the structure below. Use Write tool (not Bash heredoc).

    Required sections, in order:

    1. `# Test Matrix — Phase 4 Cross-Browser & Mobile` header + a 3-4 line preamble naming the deployed Pages URL (placeholder `<DEPLOYED_URL>` if unknown — the human checkpoint in Task 2 will fill it), the date the walk starts (placeholder), and a one-line statement that this matrix closes deferred caveats from Phases 1, 2, 3.

    2. `## Pre-Walk Checklist` — a markdown checklist with the 5 items from the Pre-walk checklist in the `<interfaces>` block above. Empty `- [ ]` boxes.

    3. `## Device Coverage` — a table with three columns (Device class | Approach | Status). Six rows, one per device class from RESEARCH.md §Devices in scope. Status column has placeholders `TBD` that the human will replace with `✓ tested` / `DevTools-emulation only` / `not tested`.

    4. `## Legend` — short block: ✅ pass / ❌ fail (see Triage) / ⚠️ partial (see Notes) / N/A not applicable for this device class / ⬜ not yet tested.

    5. `## Matrix` — the 16×6 markdown table from RESEARCH.md §Test Matrix Matrix Template. Columns: Scenario, iOS Safari, Android Chrome, Desktop Chrome, Desktop Safari, Desktop Firefox, Desktop Edge. Rows: S1 through S16 with the short scenario name (e.g. "S1 Page loads", "S2 No h-scroll"). Pre-populate the N/A cells exactly as the research template shows (S2 + S3 + S11 are N/A for all four desktop columns; S16 is N/A for everything except iOS Safari and Desktop Safari). All other cells start as `⬜`.

    6. `## Scenario Details` — a numbered list S1-S16 where each entry repeats the trigger + pass criterion verbatim from RESEARCH.md §Scenarios so the human walking the matrix doesn't have to flip back to RESEARCH.md.

    7. `## Triage Log` — placeholder header with a sub-table (Scenario | Device | Symptom | Decision | Owner). Empty for now; the human checkpoint in Task 2 fills this as it walks the matrix.

    8. `## Deferred Caveats Closed` — a markdown checklist mapping prior-phase caveats to scenario rows:
       - [ ] Phase 1 real-iOS PDF print smoke test → S13
       - [ ] Phase 2 model-load on mobile → S10
       - [ ] Phase 2 instrument persistence cross-browser → S15
       - [ ] Phase 2 private-mode silent fallback → S16
       - [ ] Phase 3 live cobalt click-through on deployed URL → S14
       - [ ] Phase 3 iOS Safari popup-blocker on cobalt handoff → S14 sub-observation

    9. `## Triage Protocol` — copy the protocol verbatim from RESEARCH.md §Failure handling protocol (4-6 lines).

    Do NOT fill in any cell with pass/fail data — Task 2 is the actual walk. This task only produces the scaffold. Do NOT modify any source files (web/*). Do NOT modify STATE.md yet — STATE.md updates are part of Task 2's triage outcome.

    Constraints from RESEARCH.md: scenarios and cell layout come from research, not invented; legend and protocol come from research; deferred-caveat mapping is the load-bearing column that justifies running this matrix at all (not "we're paranoid").
  </action>
  <verify>
    <automated>test -f .planning/phases/04-cross-browser-mobile/04-test-matrix.md && grep -E "^## Pre-Walk Checklist" .planning/phases/04-cross-browser-mobile/04-test-matrix.md && grep -E "^## Device Coverage" .planning/phases/04-cross-browser-mobile/04-test-matrix.md && grep -E "^## Matrix" .planning/phases/04-cross-browser-mobile/04-test-matrix.md && grep -E "^## Scenario Details" .planning/phases/04-cross-browser-mobile/04-test-matrix.md && grep -E "^## Triage" .planning/phases/04-cross-browser-mobile/04-test-matrix.md && grep -E "^\| S16 " .planning/phases/04-cross-browser-mobile/04-test-matrix.md && grep -c "⬜" .planning/phases/04-cross-browser-mobile/04-test-matrix.md | awk '$1 > 50 {exit 0} {exit 1}'</automated>
    <human-check>Open `.planning/phases/04-cross-browser-mobile/04-test-matrix.md` in a markdown previewer or `cat` it. Confirm: (a) all 8 sections from the action exist; (b) the matrix table has 16 scenario rows and 6 device columns; (c) ⬜ cells dominate (no premature pass/fail); (d) the Scenario Details list reads naturally enough that you could walk it on your phone without flipping back to RESEARCH.md.</human-check>
  </verify>
  <acceptance_criteria>
    - File `.planning/phases/04-cross-browser-mobile/04-test-matrix.md` exists with all 8 sections.
    - Matrix table has 16 scenario rows (S1-S16) and 6 device columns (iOS Safari, Android Chrome, Desktop Chrome, Desktop Safari, Desktop Firefox, Desktop Edge).
    - N/A cells match the research template exactly: S2, S3, S11 are N/A in all 4 desktop columns; S16 is N/A in Android Chrome + Desktop Chrome + Desktop Firefox + Desktop Edge.
    - At least 50 cells contain `⬜` (rough sanity floor: 16 × 6 = 96 cells, minus ~16-20 N/A, leaves ~75+ testable cells — `⬜ > 50` catches a "I forgot the ⬜s" mistake).
    - Scenario Details section repeats each scenario's trigger and pass criterion verbatim from RESEARCH.md §Scenarios.
    - Deferred Caveats Closed checklist has the 6 entries above with `- [ ]` boxes.
    - No web/* files modified by this task.
  </acceptance_criteria>
  <done>
    Scaffold file is committed-ready: structure is complete, no test data filled in, deferred-caveat mapping is explicit, ready for the human checkpoint walk in Task 2.
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 2: Walk the test matrix on real devices and triage failures</name>
  <files>
    .planning/phases/04-cross-browser-mobile/04-test-matrix.md
    .planning/STATE.md (only if v1.1 punts are recorded)
  </files>
  <what-built>
    Plan 04-01 has shipped the mobile CSS + main.js renderAbc fix. Plan 04-02 has shipped the widened accept attribute + AudioDecodeError. Both are deployed to GitHub Pages (the user must confirm this in the Pre-Walk Checklist below before starting). Task 1 has scaffolded `.planning/phases/04-cross-browser-mobile/04-test-matrix.md` with empty pass/fail cells.

    This checkpoint is the actual user-driven walk through the matrix. The deployed Pages URL is the test target — NOT localhost (Phase 3 cobalt handoff and Phase 1 PDF print behave differently on real https vs local http).
  </what-built>
  <how-to-verify>
    Step 0 — Pre-walk: open `04-test-matrix.md`, tick the 5 Pre-Walk Checklist boxes (deploy confirmed, devices available, Firefox/Edge available or substituted, etc.). Fill in the `<DEPLOYED_URL>` placeholder with the actual Pages URL. Fill in the walk-start date.

    Step 1 — Desktop pass (~10 min):
    1. On Desktop Chrome (Mac): visit deployed URL → walk S1, S4-S10, S12-S15. Mark each cell ✅ / ❌ / ⚠️.
    2. Repeat for Desktop Safari: same scenarios + S16 (open the deployed URL in a Private Safari window, confirm no exceptions, confirm instrument dropdown defaults to Alto Sax — closes Phase 2 Scenario C).
    3. Repeat for Desktop Firefox.
    4. Repeat for Desktop Edge (or substitute with a second Chrome run and note "Chromium proxy" in the matrix Device Coverage row).

    Step 2 — iOS Safari pass on real iPhone (~15-20 min):
    1. On iPhone Safari: visit deployed URL.
    2. Walk every scenario S1-S16 (S16: open the URL in a Private tab to test private mode).
    3. Crucial scenarios that close prior-phase caveats:
       - **S5 M4A**: pick an iPhone Voice Memo (Voice Memos app → share → Save to Files → "On My iPhone" → then pick via Safari file input). Confirm the file is selectable (proves the Plan 04-02 accept widening works).
       - **S9 + S10**: actually run the pipeline. Confirm the stage list advances and either the score renders or ModelLoadError appears within ~20s. Note timing in the matrix Notes column.
       - **S11**: after S9 succeeds, scroll to the score. Confirm: score fits the viewport (no inner horizontal scrollbar inside `.score`); pinch-to-zoom on the page works to make notes legible.
       - **S13**: tap "Download PDF". Confirm the print preview shows the score (NOT blank) — closes Phase 1 deferred caveat. If blank or missing, this is the Pitfall 6 from RESEARCH.md — record symptom and triage.
       - **S14**: paste a real YouTube URL → tap Get MP3 → confirm a new tab opens at cobalt.tools with the URL prefilled in the hash fragment (no popup-blocker prompt) — closes Phase 3 deferred caveat.
       - **S15**: pick Tenor Saxophone → fully reload Safari tab → confirm dropdown still says Tenor Saxophone — closes Phase 2 PAR-03 deferred caveat.

    Step 3 — Android Chrome (~10 min if real device; or 5 min DevTools fallback):
    1. If real Android available: walk S1, S2, S3, S4, S6-S15. Mark cells ✅ / ❌. Skip S5 (M4A is iOS-specific) and S16 (Safari-specific).
    2. If NOT available: use Chrome DevTools Device Toolbar (Pixel 5 preset). Walk S1-S4, S6, S7, S9, S11, S12. Note in the matrix: "DevTools emulation only — real Android Chrome not tested this phase; revisit in Phase 5 or v1.1."

    Step 4 — Triage (~10 min):
    1. Review every ❌ cell. For each, decide using the Triage Protocol in the matrix:
       - **fix-in-phase**: <30 LOC, no regression risk, can be done now. Open a discussion with the user describing the change BEFORE editing source. If approved, make the edit, redeploy, re-run the affected matrix cell, update the cell to ✅.
       - **punt-to-v1.1**: log a 1-line entry in `.planning/STATE.md` under `## Accumulated Context > ### Open Todos` describing the issue + which scenario surfaced it + which device class. Update the matrix Notes column to reference the STATE.md line.
    2. Tick the relevant box(es) in `## Deferred Caveats Closed` based on what was actually observed.
    3. If everything passes (no ❌): tick all 6 deferred-caveat boxes; matrix is done.

    Step 5 — Sign-off:
    Type one of these in chat:
    - `approved — matrix complete, no fixes needed`
    - `approved — matrix complete, [N] fix-in-phase patches applied, [M] items punted to v1.1`
    - `not approved — [reason]` (e.g. "iPhone unavailable today, defer plan to next session")

    If the user reports an issue with Plans 04-01 or 04-02 specifically (e.g. score still overflowing on phone), the executor should diagnose and apply a targeted fix following the fix-in-phase rules above, then re-run the affected matrix cell with the user.
  </how-to-verify>
  <resume-signal>Type "approved — matrix complete, no fixes needed" / "approved — matrix complete, [N] fixes applied, [M] punted" / "not approved — [reason]"</resume-signal>
  <acceptance_criteria>
    - Every applicable matrix cell (non-N/A) contains ✅, ❌, or ⚠️ — no ⬜ left behind, OR if any ⬜ remain they have a one-line Notes explanation (e.g. "Android device unavailable this session").
    - Every ❌ has a triage decision recorded in `## Triage Log` (fix-in-phase OR punt-to-v1.1).
    - Every v1.1 punt has a corresponding new entry in `.planning/STATE.md > Open Todos`.
    - All 6 boxes in `## Deferred Caveats Closed` are either ticked (caveat closed) or have a Notes explanation (e.g. "S13 deferred — iOS PDF print still blank; punted to v1.1").
    - `<DEPLOYED_URL>` and walk-start-date placeholders are replaced with real values.
  </acceptance_criteria>
</task>

</tasks>

<verification>
1. `test -f .planning/phases/04-cross-browser-mobile/04-test-matrix.md` (scaffold exists from Task 1)
2. After Task 2: `grep -c "⬜" .planning/phases/04-cross-browser-mobile/04-test-matrix.md` returns a small number (only legitimately-deferred cells) — most cells have ✅ / ❌ / ⚠️ / N/A
3. `grep "✅\|❌" .planning/phases/04-cross-browser-mobile/04-test-matrix.md | wc -l` returns >40 (substantive walk happened, not a paper exercise)
4. Every `- [x]` in `## Deferred Caveats Closed` corresponds to an actual observation in the matrix; any unchecked box has a Notes line explaining why
5. If any v1.1 punts exist, `git diff .planning/STATE.md` shows new Open Todos entries describing each punt
6. The user has typed an `approved — ...` resume signal
</verification>

<success_criteria>
- Phase 4 success criteria #1 ("iOS Safari user: pick file → run pipeline → see score → MusicXML/PDF export without page breaking"), #2 (Android Chrome same flow), #3 (Desktop Chrome/Safari/Firefox/Edge smoke), and #4 (phone viewport usable) all have evidence in the matrix
- Real iOS Safari testing has happened (closes the cumulative "passed-with-caveats" debt from Phases 1-3)
- Failures are honestly documented and triaged — no silent gaps
- Any fix-in-phase patches applied during the walk are committed with their own verification
- The phase ships honest: if cobalt is dead on test day, or iOS PDF print is broken, that's a v1.1 punt with a clear note, not a hidden bug
</success_criteria>

<output>
After Task 2 completes (human approval received), write a summary to `.planning/phases/04-cross-browser-mobile/04-03-SUMMARY.md` capturing:
- Devices actually tested (vs flagged as DevTools-only or skipped)
- Pass count vs fail count vs partial
- List of fix-in-phase patches applied during the walk (with commit refs if available)
- List of v1.1 punts added to STATE.md
- Which of the 6 deferred caveats were closed vs re-deferred
- One-line readiness statement for Phase 5: "Phase 4 verification complete. Phase 5 (Distribution & Discovery) can proceed; [optional: known limitations to surface in README per Open Question #2 from RESEARCH.md]."
</output>
