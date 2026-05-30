---
phase: 03-youtube-handoff-polish
status: passed-with-caveats
verified: 2026-05-30
verifier: gsd-verifier
score: 3/3 success criteria verified (1 caveat — live-browser handoff deferred to Phase 4)
re_verification: false
mode: mvp
human_verification:
  - test: "Live cobalt.tools handoff smoke (desktop)"
    expected: "Pasting https://www.youtube.com/watch?v=dQw4w9WgXcQ + clicking Get MP3 → opens a new tab at https://cobalt.tools/#https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3DdQw4w9WgXcQ and cobalt's input is prefilled (cobalt may auto-start processing — that is documented behaviour)"
    why_human: "Cobalt is a third-party service; verifier cannot click a real popup in this session. Both plan summaries explicitly defer this to phase verification, and the DOWNLOADERS.md ritual codifies it as ship-day gate."
  - test: "iOS Safari popup-block check"
    expected: "Same flow on iOS Safari does not get popup-blocked (popup opens directly in a new tab)"
    why_human: "Requires actual iOS Safari runtime; deferred to Phase 4 (Cross-Browser & Mobile) per the plan's own verification section. Static-grep confirms window.open is synchronous-before-clipboard (the structural fix), but iOS gesture preservation can only be confirmed at runtime."
  - test: "Page-copy readability spot-check"
    expected: "A non-technical reader can follow the 4 instruction steps end-to-end and understand the 'open downloader, drop MP3 back here' flow without prior knowledge"
    why_human: "Plain-language quality is a judgment call. Grep confirms no jargon tokens (API/third-party/extraction/converter site) appear in the instructions block — but readability requires a human read-through."
---

# Phase 3: YouTube Handoff Polish — Verification Report

**Phase Goal:** "User pastes a YouTube URL, gets a working one-click handoff to a third-party MP3 downloader, and knows what to do next without prior knowledge."
**Verified:** 2026-05-30
**Status:** passed-with-caveats
**Mode:** MVP — user story implicit ("As a non-technical learner, I want to paste a YouTube link and get pointed at a working downloader with clear next-steps, so that I can produce sheet music without prior knowledge.")
**Re-verification:** No — initial verification

## Goal Achievement

### Roadmap Success Criteria (from ROADMAP.md)

| #   | Truth                                                                                                                                          | Status     | Evidence                                                                                                                                                                                                                                                  |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SC1 | User pastes a YouTube URL and clicks one button that opens a working third-party downloader pre-filled with that URL                           | VERIFIED   | `web/index.html:57` Get MP3 → button → `web/main.js:60-75` click handler → `web/main.js:57` `converterUrlFor()` → `web/downloaders.js:28` `https://cobalt.tools/#${encodeURIComponent(yt)}`. `scripts/test-downloaders.mjs` (4/4 pass) locks the exact URL. |
| SC2 | User sees a short, jargon-free explanation on the page describing the "download the audio, then upload it here" two-step flow                 | VERIFIED   | `web/index.html:18-50` `.instructions` section: 4-step `<ol>` (lines 20-25) + `<details>` with "Why two steps?" summary (line 35) + 2-sentence plain-language explainer (lines 36-39). Jargon scan on the instructions block returns 0 hits for API / third-party / extraction / converter site. |
| SC3 | Every downloader link visible to the user has been checked and actually loads / accepts the URL on the day of release; dead alternates are removed (not hidden, removed) | VERIFIED (with caveat) | `web/downloaders.js:23-39` ships 1 entry (cobalt) with `lastVerified: "2026-05-30"`. `web/index.html:44` alternates list is an empty JS-populated `<ul id="alt-downloaders">` (no hardcoded URLs). All four prior dead alternates (`yt1s`/`ezmp3`/`notube`/`ddownr`) — and `savefrom` everywhere — return 0 grep hits. `web/DOWNLOADERS.md` (67 lines) codifies the recurring ship-day ritual that Phase 1 RESEARCH.md flagged as the cobalt-MEDIUM-confidence-risk mitigation. Caveat: cobalt.tools live click-through was not exercised this session — see human verification items. |

**Score:** 3/3 roadmap success criteria verified (SC3 carries a runtime-confirmation caveat, deferred to human spot-check).

### Plan-frontmatter Must-Have Truths (merged, deduplicated against SCs above)

| #   | Truth (from PLAN frontmatter)                                                                                                                       | Status     | Evidence                                                                                                                                                                                                       |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T1  | Pasting a YouTube URL + clicking Get MP3 opens cobalt.tools in a new tab with the URL prefilled in the hash fragment                                | VERIFIED   | Same chain as SC1. Hash fragment confirmed in `web/downloaders.js:28` (`/#${encodeURIComponent(yt)}`); smoke-test asserts exact output `https://cobalt.tools/#https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3DdQw4w9WgXcQ`. |
| T2  | The click handler does NOT lose the iOS user-gesture context — window.open fires synchronously before any clipboard awaits                          | VERIFIED   | `web/main.js:60-75` — handler arrow function is NOT async (verified by grep: 0 hits for `async` immediately after `getAudioBtn.addEventListener`). `window.open` is at line 70; `navigator.clipboard.writeText` follows at line 73 (fire-and-forget with `.catch`). No `await` precedes the open call. |
| T3  | The downloader list is a single grep-able source of truth (`web/downloaders.js`), not hardcoded URLs scattered between main.js and index.html       | VERIFIED   | `web/main.js:8` imports `{ PRIMARY, DOWNLOADERS }`; `web/main.js:57` delegates URL construction to `PRIMARY.urlFor`. `web/index.html` carries no hardcoded downloader URLs (only the empty `<ul id="alt-downloaders">` slot at line 44). `grep -c "cobalt" web/index.html` = 0 (registry stays free to swap). |
| T4  | Every downloader entry shipping today carries a `lastVerified` ISO date stamp                                                                       | VERIFIED   | Smoke test `test-3` asserts `lastVerified` matches `^\d{4}-\d{2}-\d{2}$` for every entry. Cobalt: `lastVerified: "2026-05-30"` (`web/downloaders.js:30`).                                                          |
| T5  | The node smoke test confirms `PRIMARY.urlFor()` returns the exact documented cobalt prefill format                                                  | VERIFIED   | `scripts/test-downloaders.mjs:25-31` asserts exact string equality. Run output: all 4 tests PASS.                                                                                                              |
| T6  | A non-technical learner reading the page copy understands the 2-step flow without prior knowledge                                                   | UNCERTAIN  | Structural elements all present; jargon tokens absent; but plain-language quality is a human judgment — surfaced in human verification list.                                                                  |
| T7  | The instructions copy makes no claim that anything "downloads the MP3" on the first click — only that it "opens a downloader pre-filled with your link" | VERIFIED   | `web/index.html:21-22` — step 1 says "Paste … click Get MP3 →"; step 2 says "A new tab opens with your link already filled in. Click the downloader's button to save the MP3". No "downloads the MP3 in one click" claim anywhere. YT input hint (`web/index.html:59`) says "Opens a downloader with your link already filled in. Save the MP3, then drop the file below." |
| T8  | The visible alternates list in the HTML is the empty container `ul#alt-downloaders`, populated by main.js at load time — no hardcoded URLs in HTML | VERIFIED   | `web/index.html:44` is exactly `<ul class="converter-list" id="alt-downloaders"></ul>` (empty). `web/main.js:474-489` runs `getElementById("alt-downloaders")` at load time, iterates `DOWNLOADERS`, appends `<li><a>` per entry — guarded with `if (altList)` for parallel safety. |
| T9  | The small hint under the YT URL input does NOT mention savefrom.net                                                                                 | VERIFIED   | `web/index.html:59` `<small>` says "Opens a downloader with your link already filled in." `grep -c savefrom web/index.html` = 0.                                                                              |
| T10 | DOWNLOADERS.md exists with a 5-minute ship-day verification ritual a maintainer can follow without reading any other doc                            | VERIFIED   | `web/DOWNLOADERS.md` — 67 lines. Contains: H1 + purpose sentence (lines 1-3), Why-This-Exists paragraph with YT-03 traceability (lines 5-15), 5-step numbered checklist (lines 17-39), Rules list with 6 bullets (lines 41-55), candidate-notes pointer (lines 57-63), most-recent-verification footer "2026-05-30 — cobalt.tools only" (line 67). Required tokens present: `lastVerified` (1), `downloaders.js` (2), `YT-03` (2), `adblock` case-insensitive (1), `2026-05-30` (2). |

**Plan-frontmatter score:** 9/10 VERIFIED + 1 UNCERTAIN (T6 routed to human verification).

### Required Artifacts

| Artifact                          | Expected                                                                                | Status     | Details                                                                                                                                                                                                                                          |
| --------------------------------- | --------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `web/downloaders.js`              | DOWNLOADERS array + PRIMARY reference, contains "cobalt.tools", ≥20 lines               | VERIFIED   | 42 lines (exceeds min). Exports 2 (`grep -c "^export"` = 2). Contains 5 `cobalt` mentions including `id`, `name`, `urlFor`, `landingUrl`. Header comment captures verification ritual (lines 1-21). Imported successfully by smoke test (exits 0). |
| `web/main.js`                     | Updated `converterUrlFor` + iOS-safe click handler + alternates renderer; contains import of `PRIMARY` | VERIFIED   | Import at line 8 (`import { PRIMARY, DOWNLOADERS } from "./downloaders.js";`). `converterUrlFor` at line 56-58 (1-line body). Click handler 60-75. Alternates renderer 467-489 (guarded). `node --check` exits 0. Wired (1 `PRIMARY.urlFor` call site).     |
| `scripts/test-downloaders.mjs`    | Node smoke test for `PRIMARY.urlFor`, ≥15 lines                                         | VERIFIED   | 82 lines. 4 assertions: prefill format, primary id, all-entries-required-fields-and-ISO-date, primary-is-array-head. Run output: `OK test-1-cobalt-prefill-format-locked`, `OK test-2-primary-id-is-cobalt`, `OK test-3-all-entries-have-required-fields-and-iso-date`, `OK test-4-primary-is-array-head`, `All 4 tests passed`. Exit 0. |
| `web/index.html`                  | Rewritten `.instructions ol` + `.howto-download details` + YT input `<small>` + empty `<ul id="alt-downloaders">` | VERIFIED   | 4-step `<ol>` at lines 20-25; `<details>` summary "Why two steps? And what if the downloader is broken?" at line 35; explainer paragraphs 36-43; empty `<ul id="alt-downloaders">` at line 44; vendor-neutral `<small>` at line 59; `.warning` solo-instrument block preserved at lines 27-32; section open/close tags balanced (5/5). |
| `web/DOWNLOADERS.md`              | Ship-day verification checklist, ≥25 lines                                              | VERIFIED   | 67 lines (well above min). All required tokens present.                                                                                                                                                                                          |

### Key Link Verification

| From                                                | To                                          | Via                                                                  | Status   | Details                                                                                                                                                                                                                       |
| --------------------------------------------------- | ------------------------------------------- | -------------------------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `web/main.js converterUrlFor()`                     | `web/downloaders.js PRIMARY`                | ES module import + `PRIMARY.urlFor()` call                           | WIRED    | Import at `web/main.js:8`; call at `web/main.js:57` (`return PRIMARY.urlFor(youtubeUrl);`). Pattern `PRIMARY\.urlFor` matches 1 location.                                                                                       |
| `web/main.js getAudioBtn click handler`             | cobalt.tools tab                            | synchronous `window.open(converterUrlFor(url), "_blank", "noopener")` inside user-gesture | WIRED    | `web/main.js:70` calls `window.open(converterUrlFor(url), ...)`. Click handler is NOT async; `window.open` precedes any clipboard call (confirmed by awk over the handler block: line 11 window.open, line 14 navigator.clipboard). |
| `web/main.js` (on load)                             | `ul#alt-downloaders` in `web/index.html`    | defensive `document.getElementById` + `appendChild` loop             | WIRED    | `web/main.js:474` `const altList = document.getElementById("alt-downloaders")` + `if (altList)` guard at line 475 + iteration 476-488. HTML container present at `web/index.html:44`.                                            |
| `web/index.html .howto-download details body`       | `web/main.js` alternates renderer (Plan 01) | empty `<ul id="alt-downloaders">` container                          | WIRED    | HTML carries the slot, JS populates it; pattern `id="alt-downloaders"` matches 1 location in index.html.                                                                                                                       |
| `web/DOWNLOADERS.md`                                | `web/downloaders.js`                        | named cross-reference + `lastVerified` field update workflow         | WIRED    | DOWNLOADERS.md references `downloaders.js` 2 times (lines 22, 36); checklist item 5 describes the `lastVerified` update workflow exactly as documented in `web/downloaders.js` header.                                          |

### Data-Flow Trace (Level 4)

| Artifact                           | Data Variable    | Source                              | Produces Real Data | Status                                                                                                |
| ---------------------------------- | ---------------- | ----------------------------------- | ------------------ | ----------------------------------------------------------------------------------------------------- |
| `web/main.js` alternates renderer  | `DOWNLOADERS`    | `web/downloaders.js` static array   | Yes (1 real entry, cobalt) | FLOWING — renderer reads 1 entry and produces 1 `<li><a>cobalt.tools</a> — open-source, no ads, no signup — recommended</li>` |
| `web/main.js` Get MP3 handler      | `PRIMARY.urlFor` | `web/downloaders.js:28` template     | Yes (encodeURIComponent template) | FLOWING — smoke test confirms exact URL output                                                       |

### Behavioral Spot-Checks

| Behavior                                                                              | Command                                              | Result                            | Status |
| ------------------------------------------------------------------------------------- | ---------------------------------------------------- | --------------------------------- | ------ |
| `PRIMARY.urlFor` returns the documented cobalt prefill format for a known YouTube URL | `node scripts/test-downloaders.mjs`                  | All 4 assertions PASS, exit 0     | PASS   |
| `web/main.js` is syntactically valid ES module                                        | `node --check web/main.js`                           | exit 0                            | PASS   |
| `web/downloaders.js` is syntactically valid ES module                                 | `node --check web/downloaders.js`                    | exit 0                            | PASS   |
| `savefrom.net` is fully purged across the web/ surface                                | `grep -c savefrom web/main.js web/downloaders.js web/index.html` | 0 / 0 / 0                | PASS   |
| Dead alternates fully removed (not hidden) from HTML                                  | `grep -E "yt1s\|ezmp3\|notube\|ddownr" web/index.html \| wc -l` | 0                          | PASS   |
| Section-tag balance preserved in index.html                                           | `grep -c '<section' web/index.html` vs `</section>`  | 5 / 5                             | PASS   |
| Click handler ordering: window.open BEFORE navigator.clipboard                        | awk over handler block                               | line 11 `window.open`, line 14 `navigator.clipboard` | PASS   |
| Click handler is NOT async                                                            | `grep -A1 'getAudioBtn.addEventListener' web/main.js \| grep -c 'async'` | 0                | PASS   |
| Live cobalt.tools click-through opens a working downloader                            | (requires real browser + popup)                       | not executable in this session    | SKIP — routed to human verification |

### Probe Execution

No formal `scripts/*/tests/probe-*.sh` exist in this project — the established pattern is co-located node smoke tests (`scripts/test-*.mjs` + `web/*.test.cjs`). The Phase-3-relevant smoke test (`scripts/test-downloaders.mjs`) was executed under Behavioral Spot-Checks above and passed all 4 assertions.

### Requirements Coverage

| Requirement | Source Plan(s)              | Description                                                                                                  | Status     | Evidence                                                                                                                                                                                                                                |
| ----------- | --------------------------- | ------------------------------------------------------------------------------------------------------------ | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| YT-01       | 03-01-handoff-mechanism     | User can paste a YouTube URL and get a one-click handoff to a working third-party MP3 downloader              | SATISFIED  | `web/index.html:55-58` URL input + Get MP3 button → `web/main.js:60-75` handler → `web/main.js:57 → web/downloaders.js:28` cobalt hash-fragment prefill. Smoke test enforces the exact prefill string.                                    |
| YT-02       | 03-02-copy-and-checklist    | Plain-language 2-step instructions, no jargon                                                                | SATISFIED  | `web/index.html:18-50` rewritten `.instructions` section. 4-step `<ol>` + "Why two steps?" details body with the literal 2-step explainer. Grep for API/third-party/extraction/converter site in the instructions block returns 0.       |
| YT-03       | 03-01 (registry) + 03-02 (ritual) | Downloader links are checked; only working options ship; no dead alternates surfaced                          | SATISFIED  | `web/downloaders.js` ships 1 entry (cobalt) with ISO `lastVerified` enforced by smoke test. Dead alternates removed from index.html (not hidden — grep confirms 0 hits for yt1s/ezmp3/notube/ddownr/savefrom). `web/DOWNLOADERS.md` codifies the 5-minute ritual that makes "checked on day of release" repeatable. |

**Orphan check:** REQUIREMENTS.md maps Phase 3 to YT-01, YT-02, YT-03. All three appear in at least one plan's `requirements` field. **0 orphaned requirements.**

### Anti-Patterns Found

| File                          | Line | Pattern              | Severity | Impact                                                                                                                  |
| ----------------------------- | ---- | -------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------- |
| (none)                        | —    | TBD / FIXME / XXX / TODO / HACK / PLACEHOLDER | —        | All 5 modified files scanned (`web/main.js`, `web/downloaders.js`, `web/index.html`, `web/DOWNLOADERS.md`, `scripts/test-downloaders.mjs`) — clean. |

Note: `web/downloaders.js:32-38` contains a commented-out section listing future-candidate alternates (`dltkk.to`, `cnvmp3.com`). This is intentional research notes for the next maintainer, not dead code or a stub — DOWNLOADERS.md item 3 in candidate notes references the same evaluation table. Per RESEARCH.md / plan decision "ship cobalt alone; one good link beats three half-checked ones."

### Human Verification Required

Three items routed to human verification (also embedded in frontmatter for downstream HUMAN-UAT routing).

#### 1. Live cobalt.tools handoff smoke (desktop browser)

**Test:** Open `web/index.html` in a modern desktop browser (Chrome / Safari / Firefox / Edge). Paste `https://www.youtube.com/watch?v=dQw4w9WgXcQ` into the YouTube link input. Click **Get MP3 →**.
**Expected:** A new tab opens at exactly `https://cobalt.tools/#https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3DdQw4w9WgXcQ`. The cobalt UI loads with the URL prefilled in its input box. Cobalt may auto-start processing — per cobalt's documented behaviour, this is correct, not a bug.
**Why human:** Cobalt is a third-party service whose live state cannot be sampled from this verifier session. Both plan summaries explicitly defer this confirmation to phase verification; `web/DOWNLOADERS.md` codifies it as the ship-day gate.

#### 2. iOS Safari popup-block check

**Test:** On a real iOS Safari (iPhone or iPad), load the deployed `web/index.html`. Repeat the paste + Get MP3 → flow.
**Expected:** A new tab opens immediately; no popup-blocker prompt; cobalt loads with the URL prefilled.
**Why human:** The structural fix (synchronous `window.open` before any `await`) is grep-verified above (line 11 `window.open` precedes line 14 `navigator.clipboard` inside the handler; arrow function is not `async`). But iOS Safari's user-gesture preservation can only be confirmed against the real runtime — Plan 01 verification section + Phase 4 (Cross-Browser & Mobile) explicitly own the runtime confirmation.

#### 3. Page-copy readability spot-check

**Test:** Ask someone unfamiliar with the project to load the page and follow the instructions for converting a YouTube link. Have them narrate what they do and where they hesitate.
**Expected:** They can paste a link → open cobalt → save MP3 → drop the file back in → convert, without external help. No confusion about "what just happened" after Get MP3 (i.e., the "we opened a downloader, you still need to click on cobalt" expectation is clear).
**Why human:** Jargon scan confirms structural absence of API / third-party / extraction / converter site language inside the `.instructions` block. Readability quality, however, is a judgment call no grep can replace.

### Risk Notes (informational; not gating)

- **Cobalt MEDIUM-confidence risk** (per 03-RESEARCH.md): cobalt's main instance was briefly blocked from US YouTube traffic in mid-2025. `web/DOWNLOADERS.md` is the explicit mitigation — it gates every release on a manual 5-minute liveness check. Phase 3 cannot eliminate this risk (no static page can), only contain it via process. The DOWNLOADERS.md ritual + the ISO `lastVerified` stamp on every entry (enforced by `scripts/test-downloaders.mjs`) discharge Phase 1's risk-register obligation for this milestone.
- **Single-entry registry today**: Shipping cobalt alone is an explicit plan decision ("one good link is better than three half-checked ones") and aligns with YT-03's "no dead alternates surfaced" requirement. Future maintainers can add candidates per the DOWNLOADERS.md ritual. This is not a gap.

### Deferred Items

None. All gaps identified are runtime spot-checks (live cobalt, iOS Safari, copy-readability) routed to human verification rather than later phases. Phase 4 (Cross-Browser & Mobile) will independently re-verify the iOS Safari popup behaviour, but it does not retroactively cover Phase 3's gap — Phase 3 ships the structural fix; Phase 4 confirms the runtime outcome.

### Gaps Summary

No structural gaps. All five must-have artifacts exist, are substantive, are wired, and the data they carry flows through to the user-facing surface as designed. All three roadmap success criteria are met by code on disk; SC3 in particular is over-served by the combination of (a) zero dead links shipped, (b) ISO date stamps machine-enforced by the smoke test, and (c) a maintainer ritual codified in `web/DOWNLOADERS.md`.

The "passed-with-caveats" status reflects three items that cannot be verified by a static-code verifier session and have been routed to human verification:

1. Live cobalt.tools click-through (deferred to phase verification per both plan summaries)
2. iOS Safari popup-block check (deferred to Phase 4 per Plan 01 verification section)
3. Page-copy readability (judgment call requiring a real reader)

If those three items pass when a human runs them, Phase 3 is a clean PASS.

---

*Verified: 2026-05-30*
*Verifier: Claude (gsd-verifier)*
