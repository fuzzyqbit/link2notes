---
phase: 05-distribution-discovery
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - README.md
autonomous: true
requirements:
  - DIST-01
tags:
  - documentation
  - distribution
  - readme

must_haves:
  truths:
    - "A visitor opening the repo on github.com sees a root README.md as the first content rendered"
    - "The very first heading/paragraph names the live GitHub Pages URL (https://fuzzyqbit.github.io/link2notes/) as the recommended way to use Link To Notes"
    - "The README contains a 4-step usage walkthrough that covers paste-YouTube-URL OR upload-audio, pick instrument, click Convert, download MusicXML/PDF"
    - "Desktop app is mentioned but explicitly framed as optional / power-user, with a pointer to scripts/build.sh and the GitHub Releases tab"
    - "README does NOT instruct the visitor to clone the repo or run a build step in order to use the app"
  artifacts:
    - path: "README.md"
      provides: "Top-level repo landing doc that funnels visitors to live Pages URL"
      min_lines: 30
      contains: "https://fuzzyqbit.github.io/link2notes/"
  key_links:
    - from: "README.md"
      to: "https://fuzzyqbit.github.io/link2notes/"
      via: "markdown link in primary call-to-action"
      pattern: "fuzzyqbit\\.github\\.io/link2notes"
    - from: "README.md"
      to: "web/README.md"
      via: "markdown link to web-app-specific docs"
      pattern: "\\(web/README\\.md\\)|\\(\\./web/README\\.md\\)|\\(web\\)"
    - from: "README.md"
      to: "scripts/build.sh"
      via: "power-user desktop build pointer"
      pattern: "scripts/build\\.sh|Releases"
---

<objective>
Create a new `README.md` at the repo root that positions the live GitHub Pages URL as the primary, recommended way to use Link To Notes. Currently the repo has no root README — visitors landing on github.com/fuzzyqbit/link2notes see only the file tree, with no funnel to the live app. The desktop app is the only README that exists (web/README.md), and even it leads with "Run locally" rather than "Try it now."

Purpose: Close DIST-01 — funnel any repo visitor to the live web app within one click, without reading deep docs or running a build.

Output: A root `README.md` whose first content is a Pages URL call-to-action, followed by a brief 4-step usage walkthrough, with desktop reframed as optional.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/REQUIREMENTS.md
@CLAUDE.md
@web/README.md
@web/index.html

<interfaces>
<!-- Key context for the executor — already-deployed UI surface and known URLs. -->
<!-- Use these literal strings; do not invent alternates. -->

Live Pages URL (verified live this session, push-to-main triggers deploy via repo Settings → Pages → "Deploy from a branch"):
  https://fuzzyqbit.github.io/link2notes/

Git remote (use HTTPS form in markdown links, not SSH):
  https://github.com/fuzzyqbit/link2notes

UI flow surfaced on the deployed page (web/index.html headings + button text — match this language in the README walkthrough so the README and the app agree):
  1. "Paste a YouTube link" → "Get MP3 →" button → opens cobalt.tools in new tab with URL prefilled
  2. Save the MP3 from the downloader
  3. Drop the MP3 into the "Audio file" picker
  4. Pick instrument (flute, clarinet, bass clarinet, alto sax, tenor sax, baritone sax)
  5. Click "Convert"
  6. Use "Save MusicXML" / "Download PDF" / "Download SVG" / "Download ABC" buttons under the rendered score

Already-have-audio path (per web/index.html `.tip` paragraph): skip Get MP3 and drop the file in directly — MP3, WAV, M4A, OGG, FLAC.

Desktop power-user surface (does NOT need to be invented — already exists):
  - scripts/build.sh — local PyInstaller build script
  - .github/workflows/release.yml — produces mac arm64 + Windows x64 zips on tag push
  - GitHub Releases tab — where users download prebuilt binaries

Monophonic-only constraint (per web/index.html `.warning` block) MUST be surfaced in the README so new visitors don't waste a full pipeline run on a chord-heavy track:
  "Only solo instrument tracks work well. One instrument playing one note at a time."
</interfaces>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Write root README.md funneling visitors to the live Pages URL</name>
  <files>README.md</files>
  <read_first>
    - /Users/rowan/Documents/Note Converter/web/README.md (current README, only README in repo — reuse its "What it uses" and "Differences from desktop" framing where appropriate)
    - /Users/rowan/Documents/Note Converter/web/index.html (canonical user-facing copy: button labels, 4-step instructions block, monophonic warning, supported audio formats)
    - /Users/rowan/Documents/Note Converter/CLAUDE.md (project framing: "search it up and run it" with zero install)
  </read_first>
  <action>
    Create a NEW file `/Users/rowan/Documents/Note Converter/README.md` at the repo root. There is no existing root README to merge with — this is a fresh file.

    Required structure (in this order):

    1. Title `# Link To Notes` followed by a one-line tagline matching the web app subtitle: a YouTube link or audio file becomes beginner-friendly sheet music for a single-line wind instrument.

    2. **Primary call-to-action** as the first content block (BEFORE any other headings). Format as a prominent link to the live Pages URL `https://fuzzyqbit.github.io/link2notes/`. Use language like "Try it now: https://fuzzyqbit.github.io/link2notes/" or "Open the web app: ...". The Pages URL MUST appear above the fold — within the first 10 lines after the title.

    3. `## How to use` section with a numbered list mirroring the web UI's own 4-step instructions (paste YouTube link → click Get MP3 → save MP3 from the downloader → drop MP3 into Audio file picker → pick instrument → Convert → use Save MusicXML / Download PDF buttons). Match the button labels exactly as they appear in `web/index.html` so the README and app agree. Include the "already have audio?" shortcut as a sub-bullet or aside.

    4. `## What works best` note carrying over the monophonic warning verbatim in spirit ("solo instrument tracks; one instrument playing one note at a time; no chords, no backing tracks, no singing").

    5. `## Supported instruments` listing the six wind instruments: flute, clarinet, bass clarinet, alto sax, tenor sax, baritone sax.

    6. `## What it uses` short tech-stack section (basic-pitch, abcjs, Web Audio API, Krumhansl-Schmuckler key detection) — reuse the bullet wording from web/README.md so the two stay consistent.

    7. `## Desktop app (optional, power-user)` section near the bottom. Frame as "if you'd rather run it as a native desktop app instead of the web app, ..." with two pointers: (a) prebuilt mac arm64 / Windows x64 binaries from the GitHub Releases tab, link to https://github.com/fuzzyqbit/link2notes/releases ; (b) local build via `scripts/build.sh`. Do NOT recommend desktop over web. Do NOT instruct general visitors to clone the repo.

    8. `## Develop the web app locally` (last section, contributor-facing) with a short pointer to `web/README.md` for local dev / contributing — actual `python3 -m http.server 8000` instructions live in web/README.md, do not duplicate them here.

    Do NOT add a deploy-status badge in this task — the badge is added in Plan 3 once the Actions-based pages workflow exists. Leave space (or a TODO comment) only if natural; do not pre-add a broken badge.

    Do NOT use emojis per the project-level rule.
  </action>
  <verify>
    <automated>test -f "/Users/rowan/Documents/Note Converter/README.md" && grep -q "fuzzyqbit.github.io/link2notes" "/Users/rowan/Documents/Note Converter/README.md" && grep -qi "try it now\|open the web app\|use the web app\|web app:" "/Users/rowan/Documents/Note Converter/README.md" && head -15 "/Users/rowan/Documents/Note Converter/README.md" | grep -q "fuzzyqbit.github.io/link2notes" && grep -qi "scripts/build.sh\|releases" "/Users/rowan/Documents/Note Converter/README.md" && grep -qi "flute" "/Users/rowan/Documents/Note Converter/README.md" && grep -qi "alto sax\|alto-sax" "/Users/rowan/Documents/Note Converter/README.md" && grep -qi "monophonic\|solo instrument\|one note at a time\|one instrument playing" "/Users/rowan/Documents/Note Converter/README.md" && grep -v '^#' "/Users/rowan/Documents/Note Converter/README.md" | grep -q "web/README"</automated>
  </verify>
  <done>
    - `README.md` exists at the repo root (not inside web/)
    - First 15 lines contain the live Pages URL https://fuzzyqbit.github.io/link2notes/
    - At least one call-to-action phrase ("try it now" / "open the web app" / "use the web app") appears near the top
    - All six instruments listed
    - Monophonic constraint surfaced
    - Desktop section exists and is framed as optional, with pointer to Releases tab and scripts/build.sh
    - A non-comment line references `web/README.md` for local dev
    - No deploy-status badge yet (added in Plan 3)
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| repo visitor → README content | Untrusted reader; README is public marketing surface. No code execution, no input. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-05-01 | Information disclosure | README.md | accept | Public docs by design; no secrets ever appear in README. No env vars, no API keys, no internal URLs. |
| T-05-02 | Tampering | Outbound link to https://fuzzyqbit.github.io/link2notes/ | accept | GitHub-controlled hostname; same-trust-domain as the repo itself. |
| T-05-03 | Spoofing | Outbound link to GitHub Releases tab | accept | Same-host github.com link; no redirect indirection. |
</threat_model>

<verification>
- `README.md` exists at repo root and renders correctly on github.com (rendered preview shows Pages URL above the fold)
- Clicking the headline link from the GitHub-rendered README opens the live web app
- A visitor who reads only the first screen of the README knows they can use the app without cloning the repo
</verification>

<success_criteria>
DIST-01 partially satisfied (root README half): repo-root documentation positions the Pages URL as primary; desktop reframed as optional. (web/README half is closed by Plan 2; combined satisfaction of DIST-01 happens when both ship.)
</success_criteria>

<output>
Create `.planning/phases/05-distribution-discovery/05-01-SUMMARY.md` when done. Include:
- Path of README.md created
- Confirmation Pages URL appears in first 15 lines
- Confirmation desktop is framed as optional
- Any wording carried over verbatim from web/index.html (for consistency tracking)
</output>
