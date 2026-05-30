---
phase: 03-youtube-handoff-polish
plan: 02
type: execute
wave: 1
depends_on: []
files_modified:
  - web/index.html
  - web/DOWNLOADERS.md
autonomous: true
requirements:
  - YT-02
  - YT-03
tags:
  - youtube
  - handoff
  - copy
  - documentation
  - verification-checklist

must_haves:
  truths:
    - "A non-technical learner reading the page copy understands the 2-step flow (open downloader, then drop the MP3 back here) without prior knowledge"
    - "The instructions copy makes no claim that anything 'downloads the MP3' on the first click — only that it 'opens a downloader pre-filled with your link'"
    - "The visible alternates list in the HTML is the empty container ul#alt-downloaders, populated by main.js at load time — no hardcoded URLs in the HTML"
    - "The small hint under the YT URL input does NOT mention savefrom.net (dead site)"
    - "DOWNLOADERS.md exists with a 5-minute ship-day verification ritual that a future maintainer can follow without reading any other doc"
  artifacts:
    - path: "web/index.html"
      provides: "Rewritten .instructions ol + .howto-download details + YT input small + alternates container ul id alt-downloaders"
      contains: "alt-downloaders"
    - path: "web/DOWNLOADERS.md"
      provides: "Ship-day verification checklist for the downloader registry"
      min_lines: 25
  key_links:
    - from: "web/index.html .howto-download details body"
      to: "web/main.js alternates renderer (Plan 01)"
      via: "ul id alt-downloaders empty container"
      pattern: "id=\"alt-downloaders\""
    - from: "web/DOWNLOADERS.md"
      to: "web/downloaders.js"
      via: "named cross-reference + describes the lastVerified field update workflow"
      pattern: "downloaders\\.js"
---

<objective>
Rewrite the YouTube-handoff page copy to be jargon-free, accurate to the new cobalt-based flow, and to leave the alternates list as a JS-populated container. Add a short maintainer-facing checklist (`web/DOWNLOADERS.md`) describing the 5-minute ship-day verification ritual that keeps the downloader list honest.

Purpose: Closes YT-02 (plain-language 2-step instructions) and the documentation half of YT-03 (a maintainer ritual that prevents the dead-link rot the current alternates list demonstrates). Without this, even with Plan 01's cobalt swap, the page copy still says "savefrom.net" in the hint text and the alternates list is full of dead sites surfaced to users.

Output: An edited `web/index.html` with new instruction copy + a hardcoded-URL-free alternates container, and a new `web/DOWNLOADERS.md` checklist co-located with `web/downloaders.js`.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/ROADMAP.md
@.planning/REQUIREMENTS.md
@.planning/phases/03-youtube-handoff-polish/03-RESEARCH.md
@CLAUDE.md
@web/index.html
@web/style.css

<interfaces>
Existing DOM regions this plan edits (the ONLY regions touched):

- `section.instructions` block at lines 18-54 of web/index.html — contains `h2 How to use`, an `ol` with 4 steps, `p.warning`, and a `details.howto-download` block.
- The `ol` (lines 20-27) — currently lists 4 steps, with step 1 mentioning "Your link is copied to the clipboard" (still accurate per Plan 01 fire-and-forget clipboard) and "a converter site opens" (still accurate, term to be changed).
- The `details.howto-download` (lines 36-53) — currently has summary "Trouble downloading? Other converters to try" and a `ul.converter-list` with 5 hardcoded dead-or-degraded site links (savefrom, yt1s, ezmp3, notube, ddownr).
- The `small` under the YT URL input (line 63) — currently says "Copies your link and opens savefrom.net with it pre-filled."

Existing CSS classes available (from style.css — DO NOT add new ones unless necessary):
- `.instructions`, `.instructions ol`, `.instructions .warning`
- `.howto-download`, `.howto-download summary`, `.howto-download .tip`, `.howto-download code`
- `.converter-list`, `.converter-list li`
- `.url-row`, `.field`

Parallel-safe with Plan 01: Plan 01 owns `web/main.js` + `web/downloaders.js`. This plan adds the `ul id="alt-downloaders"` element that Plan 01 alternates renderer looks up via `getElementById`. The two plans can land in either order — Plan 01 render code is defensive (no-op if container absent); Plan 02 HTML displays an empty list if Plan 01 has not landed.

DO NOT touch any region outside the `.instructions` section and the YT URL input `small` hint at line 63. Specifically do NOT touch: `header`, `section.controls` (other than the one `small`), `section#status`, `section#error`, `section#result`, `footer`, `script` tags.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Rewrite the .instructions section + YT input hint in web/index.html</name>
  <files>web/index.html</files>
  <read_first>
    - /Users/rowan/Documents/Note Converter/web/index.html (lines 18-54 for .instructions; line 63 for the YT input small hint)
    - /Users/rowan/Documents/Note Converter/.planning/phases/03-youtube-handoff-polish/03-RESEARCH.md (sections: Common Pitfalls 5 One-click claim vs reality, Code Example 3 HTML copy rewrite for YT-02, Validation Plan YT-02 row)
    - /Users/rowan/Documents/Note Converter/web/style.css (lines 40-119 — confirm which classes carry over so the new copy stays styled)
  </read_first>
  <action>
    Edit `web/index.html` in three discrete regions. Do NOT touch anything outside these regions.

    1. Rewrite the `ol` inside `section.instructions` (currently lines 20-27). New 4-step copy must be jargon-free per YT-02 — no "API", no "third-party", no "extraction", no "converter site" (use "downloader" — matches the rest of this phase vocabulary). Per RESEARCH.md Pitfall 5, the language must NOT claim the first click "downloads the MP3" — only that it opens a downloader with the link already filled in. Required structure (4 list items, each one `li ... /li`):
       - Step 1: "Paste a YouTube link in the box below and click Get MP3 then arrow." Mark the verbs and the button name with `strong` tags. Keep the arrow character. Exact copy: `<li><strong>Paste</strong> a YouTube link in the box below and click <strong>Get MP3 →</strong>.</li>`
       - Step 2: `<li>A new tab opens with your link already filled in. <strong>Click the downloader's button</strong> to save the MP3 to your device.</li>` (No "pick MP3" instruction — cobalt defaults to audio for YouTube, but the user still clicks cobalt download button. Truthful, not over-promising.)
       - Step 3: `<li>Come back here and <strong>drop the MP3</strong> into the <strong>Audio file</strong> box.</li>`
       - Step 4: `<li>Pick your instrument and press <strong>Convert</strong>.</li>`

    2. Rewrite the `details.howto-download` block (currently lines 36-53). The new summary and body must:
       - Change the summary text to: `Why two steps? And what if the downloader is broken?` (Replaces "Trouble downloading? Other converters to try" — the new line frames both halves of YT-02: explanation of the flow AND graceful fallback.)
       - Replace the first `p` with the 2-step-flow explainer (exact text): `Browsers can't pull audio out of YouTube directly — only YouTube's own player can. So we hand the link off to a downloader, which gives you back an MP3 you can drop into this page. Two clicks, no install.`
       - Add a second `p`: `Free downloader sites change often. If the one we open is down, try one of these:`
       - Replace the hardcoded `ul.converter-list` (currently has 5 dead/degraded `li a href=...` entries for savefrom, yt1s, ezmp3, notube, ddownr) with an EMPTY container. Exact markup: `<ul class="converter-list" id="alt-downloaders"></ul>`. NO hardcoded URLs. The list is populated at load time by Plan 01 alternates renderer (which reads from `web/downloaders.js`). This is the single-source-of-truth boundary — HTML carries the slot, downloaders.js carries the truth.
       - Replace the existing `.tip` `p` with: `Already have a recording? Skip Get MP3 and drop the file in directly — any audio format your browser can decode works (MP3, WAV, M4A, OGG, FLAC).` Keep the `class="tip"` so existing CSS still applies.

    3. Update the `small` hint under the YT URL input (currently line 63, which says "Copies your link and opens savefrom.net with it pre-filled. Pick MP3 and download — then drop the file below. More options in the instructions above."). New copy: `Opens a downloader with your link already filled in. Save the MP3, then drop the file below. More options in the instructions above.` No mention of savefrom.net (dead) or cobalt by name (the registry should be free to swap the primary without an HTML edit).

    Preserve all attribute formatting (existing `a` tags in the codebase use `target="_blank" rel="noopener"`). Do NOT introduce new CSS classes; rely on existing `.instructions ol`, `.instructions li`, `.warning`, `.howto-download` styles. The `p.warning` block (the "solo instrument" warning, currently lines 29-34) must stay UNCHANGED — it is correct and Phase-3-relevant.
  </action>
  <verify>
    <automated>cd "/Users/rowan/Documents/Note Converter" && test "$(grep -c 'id="alt-downloaders"' web/index.html)" -eq 1 && test "$(grep -c 'savefrom' web/index.html)" -eq 0 && test "$(grep -c 'href="https://yt1s' web/index.html)" -eq 0 && test "$(grep -c 'href="https://ezmp3' web/index.html)" -eq 0 && test "$(grep -c 'href="https://notube' web/index.html)" -eq 0 && test "$(grep -c 'href="https://ddownr' web/index.html)" -eq 0 && test "$(grep -c 'Why two steps' web/index.html)" -ge 1 && test "$(grep -c 'class="warning"' web/index.html)" -ge 1 && test "$(grep -c '<section' web/index.html)" -eq "$(grep -c '</section>' web/index.html)"</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c 'id="alt-downloaders"' web/index.html` returns exactly 1 (the empty container)
    - `grep -c 'savefrom' web/index.html` returns 0 (dead site fully removed, including from the hint and the alternates list)
    - `grep -c 'href="https://yt1s' web/index.html` returns 0
    - `grep -c 'href="https://ezmp3' web/index.html` returns 0
    - `grep -c 'href="https://notube' web/index.html` returns 0
    - `grep -c 'href="https://ddownr' web/index.html` returns 0 (all four old hardcoded alternates removed, not hidden — per YT-03 success criterion 3)
    - `grep -c 'Why two steps' web/index.html` returns at least 1 (new details summary in place)
    - `grep -c 'class="warning"' web/index.html` returns at least 1 (the existing solo-instrument warning preserved)
    - `grep -c '<ol>' web/index.html` returns at least 1 (instructions ordered list still exists)
    - Section tag balance preserved: `grep -c '<section' web/index.html` equals `grep -c '</section>' web/index.html`
    - The `header`, `section.controls` (except the one `small` hint), `section#status`, `section#error`, `section#result`, `footer` blocks remain present and unmodified
  </acceptance_criteria>
  <done>
    `web/index.html` reads as a clear 2-step instruction to a non-technical learner with no jargon. The alternates `ul` is an empty JS-populated container — no hardcoded downloader URLs in HTML. The savefrom.net mention in the YT input hint is gone. The Plan 01 renderer will populate this list at load time.
  </done>
</task>

<task type="auto">
  <name>Task 2: Create web/DOWNLOADERS.md ship-day verification checklist</name>
  <files>web/DOWNLOADERS.md</files>
  <read_first>
    - /Users/rowan/Documents/Note Converter/.planning/phases/03-youtube-handoff-polish/03-RESEARCH.md (sections: Architectural Responsibility Map "Is this link still alive" row, Anti-Patterns "Building an in-page is-this-link-alive check", Pattern 1 Code Example 2 verification-ritual comment, Risks & Mitigations top row "Cobalt main instance gets re-blocked", Downloader Evaluation Table net recommendation)
    - /Users/rowan/Documents/Note Converter/.planning/REQUIREMENTS.md (YT-03 phrasing — "Downloader links on the page are checked and only working options ship (no dead alternates surfaced to the user)")
  </read_first>
  <action>
    Create `web/DOWNLOADERS.md` as a maintainer-facing checklist. It is the long-form complement to the comment block at the top of `web/downloaders.js` (Plan 01 Task 1). Co-located with `downloaders.js` per Open Question 2 in RESEARCH.md.

    Required structure (markdown, around 30-50 lines, no fluff):

    1. Title + one-sentence purpose. H1: `# Downloader Verification Checklist`. Followed by a single sentence: "Run this before every release that ships changes to the YouTube handoff. Takes 5 minutes."

    2. Why this exists. A short paragraph (3-4 sentences max) explaining: (a) the YouTube-downloader genre rots fast — sites get blocked, change owners, add ads, get acquired by ad-injection networks; (b) CORS makes runtime liveness checks impossible from a static page; (c) this is therefore a human gate — accept it; (d) reference YT-03 as the requirement this checklist satisfies.

    3. The checklist itself (markdown ordered list, items 1 through 5):
       1. From a normal US-residential connection — NO VPN, NO corporate proxy. (VPNs and corporate networks can hide geo-blocks.)
       2. Open `web/downloaders.js` in your editor — it is the source of truth.
       3. For each entry in the `DOWNLOADERS` array, open its `landingUrl` in a regular browser tab WITH ADBLOCK OFF. Confirm: (a) no "discontinued in your country" banner, (b) no scam-button overlay (fake "Download" buttons that open ads), (c) a real URL input field is visible.
       4. Paste a test YouTube URL — recommend `https://www.youtube.com/watch?v=dQw4w9WgXcQ` (short, stable, well-known) — and click the site actual download/convert button. Confirm an audio file ACTUALLY starts downloading (not a redirect to an ad page, not a fake "click here" interstitial).
       5. If the entry passed, update its `lastVerified` field in `web/downloaders.js` to today date (ISO format `YYYY-MM-DD`). If the entry FAILED, REMOVE it from the array — do not comment it out, do not hide it behind a flag. Per YT-03, dead alternates do not ship.

    4. Rules section (a short list of dos and don'ts, 4-6 bullets max):
       - DO add a new candidate ONLY after running the full checklist above on it.
       - DO keep the array short — one good entry beats three half-checked entries.
       - DO NOT trust SEO results ("best youtube to mp3 2026" listicles are referral spam).
       - DO NOT add 3-letter-TLD clone domains (`*.cc`, `*.gs`, `*.tube`, `*.ai`) without source-code evidence — most are SEO mirrors run by ad-injection networks.
       - DO NOT build an automated runtime liveness check from the static page — CORS makes the results meaningless (no-cors fetches return opaque success even when the page is a 503).
       - DO NOT claim "one-click downloads MP3" in any user-facing copy. The first click opens a downloader; the user still clicks once more on the downloader site.

    5. Pointer to candidate notes (1-2 lines): mention that `.planning/phases/03-youtube-handoff-polish/03-RESEARCH.md` contains a `Downloader Evaluation Table` of candidates the researcher inspected on 2026-05-30 (cobalt as primary, dltkk.to and cnvmp3.com flagged as worth manual verification), and that the table is the starting point for adding new entries — but every entry still needs the full checklist above.

    6. Last verified header (1 line at the bottom): `**Most recent ship-day verification:** 2026-05-30 — cobalt.tools only.` This gives a future maintainer a glance at how stale the current state is.

    No code blocks except where absolutely needed (the test URL is fine inline as a backtick). No marketing language. No emojis. The tone is operational — a runbook, not a brochure.

    The file MUST contain the literal tokens `lastVerified`, `downloaders.js`, `YT-03`, and `adblock` (or `ADBLOCK`) — these are checked by the verify gate to catch a maintainer who waters down the checklist later.
  </action>
  <verify>
    <automated>cd "/Users/rowan/Documents/Note Converter" && test -f web/DOWNLOADERS.md && test "$(wc -l < web/DOWNLOADERS.md)" -ge 25 && test "$(grep -c 'lastVerified' web/DOWNLOADERS.md)" -ge 1 && test "$(grep -c 'downloaders.js' web/DOWNLOADERS.md)" -ge 1 && test "$(grep -c 'YT-03' web/DOWNLOADERS.md)" -ge 1 && test "$(grep -ci 'adblock' web/DOWNLOADERS.md)" -ge 1 && test "$(grep -c '2026-05-30' web/DOWNLOADERS.md)" -ge 1</automated>
  </verify>
  <acceptance_criteria>
    - File `web/DOWNLOADERS.md` exists
    - File is at least 25 lines long (`wc -l web/DOWNLOADERS.md` returns >= 25)
    - Contains the token `lastVerified` at least once (cross-references the downloaders.js field)
    - Contains the filename `downloaders.js` at least once (cross-references the registry)
    - Contains the requirement ID `YT-03` at least once (traceability)
    - Contains `adblock` (case-insensitive) at least once (the "with adblock off" instruction is preserved)
    - Contains the date `2026-05-30` at least once (the "most recent verification" footer)
    - File has the structure described in `<action>`: H1 title, "why this exists" paragraph, 5-item ordered checklist, rules list, candidates pointer, last-verified footer
    - No emoji characters present
  </acceptance_criteria>
  <done>
    `web/DOWNLOADERS.md` exists as a standalone runbook a future maintainer can follow in 5 minutes without reading any other doc. Co-located with the `web/downloaders.js` registry it documents.
  </done>
</task>

</tasks>

<verification>
After both tasks complete:

1. **Static checks (automated):**
   - `grep -c 'id="alt-downloaders"' web/index.html` returns exactly 1
   - `grep -c savefrom web/index.html` returns 0
   - `grep -c '2026-05-30' web/DOWNLOADERS.md` returns at least 1
   - `wc -l web/DOWNLOADERS.md` returns at least 25
   - All four dead alternate URLs (yt1s, ezmp3, notube, ddownr) absent from index.html

2. **Behavior check (manual, deferred to phase verification):**
   - Open `web/index.html` in a browser
   - Read the `.instructions` section top-to-bottom — confirm a non-technical learner could follow it without prior knowledge (no "API", no "third-party", no "extraction" terms)
   - Open the `Why two steps? And what if the downloader is broken?` `<details>` block — confirm the alternates `<ul>` is populated (if Plan 01 has landed) OR empty with no rendering errors (if Plan 01 has not yet landed). Either is acceptable — the contract is "JS-populated, no hardcoded URLs."
   - Hover/inspect the YT URL input `<small>` — confirm it no longer says "savefrom.net"

3. **Runbook smoke check (manual, optional):**
   - A teammate who has never seen the project should be able to follow `web/DOWNLOADERS.md` end-to-end in 5 minutes without asking questions.
</verification>

<success_criteria>
- `web/index.html` has new 4-step jargon-free instructions (YT-02)
- `web/index.html` has empty `<ul id="alt-downloaders">` container — no hardcoded URLs
- `web/index.html` YT input hint no longer says savefrom.net
- `web/DOWNLOADERS.md` exists with a 5-minute ship-day verification ritual (YT-03 documentation half)
- Closes YT-02 (plain-language 2-step instructions) + the documentation half of YT-03
</success_criteria>

<output>
Create `.planning/phases/03-youtube-handoff-polish/03-02-SUMMARY.md` when done.
</output>
