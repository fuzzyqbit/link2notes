---
phase: 05-distribution-discovery
plan: 02
type: execute
wave: 1
depends_on: []
files_modified:
  - web/README.md
autonomous: true
requirements:
  - DIST-01
tags:
  - documentation
  - distribution
  - readme

must_haves:
  truths:
    - "A visitor who opens web/README.md sees the live Pages URL above the fold (first 15 lines)"
    - "The first section/heading frames Link To Notes as a hosted web app to use, not a project to clone"
    - "'Run locally' section is retained but demoted below the primary call-to-action"
    - "web/README.md cross-links to the new root README.md so the two are navigable as a pair"
    - "Deploy-to-GitHub-Pages instructions are demoted (or removed) — they describe project setup, not user onboarding, and now belong further down or in a dedicated maintainer section"
  artifacts:
    - path: "web/README.md"
      provides: "Web-app-specific docs, repositioned to lead with hosted URL"
      min_lines: 25
      contains: "https://fuzzyqbit.github.io/link2notes/"
  key_links:
    - from: "web/README.md"
      to: "https://fuzzyqbit.github.io/link2notes/"
      via: "headline link in opening section"
      pattern: "fuzzyqbit\\.github\\.io/link2notes"
    - from: "web/README.md"
      to: "README.md"
      via: "cross-link to root README"
      pattern: "\\.\\./README\\.md|\\(/README\\.md\\)|root README"
---

<objective>
Rewrite `web/README.md` so the live GitHub Pages URL is the headline, not a footnote under "Run locally". The current file leads with `## Run locally` (contributor-facing instructions), then `## Deploy to GitHub Pages` (maintainer-facing instructions), then the user-facing tech stack — exactly the wrong order for someone landing on the file from the GitHub UI.

Purpose: Close the web/README half of DIST-01 — both READMEs (root and web/) must position the Pages URL as the primary entry point, with local dev clearly framed as contributor-only.

Output: A rewritten `web/README.md` that opens with "Try it now: <Pages URL>", retains the local-dev recipe under a demoted contributor section, and cross-links to the new root README.md.
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
<!-- Existing web/README.md sections to preserve (do not delete the content, just reorder). -->

Current sections in web/README.md (verified by reading the file):
  1. Title + one-line description
  2. "## Run locally" — python3 -m http.server 8000 recipe
  3. "## Deploy to GitHub Pages (free hosting)" — repo setup instructions (4-step Settings → Pages walkthrough)
  4. "## What it uses" — basic-pitch, abcjs, Web Audio API, Krumhansl-Schmuckler
  5. "## Differences from the desktop version" — YouTube auto-download removed; PDF via print; instrument dropdown
  6. "## Files" — file-by-file index (index.html, style.css, instruments.js, pipeline.js, main.js)

Live Pages URL (do not invent alternate):
  https://fuzzyqbit.github.io/link2notes/

Root README path (created in parallel Plan 1):
  /Users/rowan/Documents/Note Converter/README.md
  Cross-link form from web/README.md → root README is `../README.md`.

Deploy mechanism reality (per STATE.md and Phase 5 pre-inspection):
  - Repo currently deploys via Settings → Pages → "Deploy from a branch" pointing at /web
  - Plan 3 will replace this with a .github/workflows/pages.yml Actions-based deploy
  - The "Deploy to GitHub Pages" instructions in the current web/README are accurate-for-now but will go stale once Plan 3 lands — keep them brief and label as maintainer notes, do NOT polish them further
</interfaces>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Reposition web/README.md to lead with live Pages URL</name>
  <files>web/README.md</files>
  <read_first>
    - /Users/rowan/Documents/Note Converter/web/README.md (the file being rewritten — read all of it first; you are reordering, not deleting)
    - /Users/rowan/Documents/Note Converter/web/index.html (for exact button label / instrument list consistency)
    - /Users/rowan/Documents/Note Converter/.planning/STATE.md (current Phase 5 framing)
  </read_first>
  <action>
    Rewrite `/Users/rowan/Documents/Note Converter/web/README.md`. Use the Read tool to load the current file first, then use the Write tool to overwrite (it is a small file, full rewrite is cleaner than incremental edits).

    Required new structure (in this order):

    1. Title `# Link To Notes — Web Version` (keep existing title).

    2. **Lead paragraph** — replace the current opening with a sentence that names the live Pages URL as the way to use the app. Example shape: "Live app: https://fuzzyqbit.github.io/link2notes/ — drop an audio file (or paste a YouTube link), pick a wind instrument, get sheet music. Runs entirely in your browser." The Pages URL MUST appear within the first 15 lines.

    3. Cross-link line directly under the lead, pointing to the root README. Form: a line like "See the [root README](../README.md) for the full overview and the desktop app." Use the relative path `../README.md`.

    4. `## What it uses` — keep existing bullets (basic-pitch, abcjs, Web Audio API, Krumhansl-Schmuckler) verbatim. This stays user-facing.

    5. `## Differences from the desktop version` — keep existing bullets verbatim. Already user-facing.

    6. `## Files` — keep existing file index verbatim. Useful for contributors.

    7. `## Run locally (contributors)` — DEMOTED. Move the existing `python3 -m http.server 8000` recipe here. Add a one-line preface: "Most users don't need this — open the live URL above. Local dev is only for editing the source." Keep the `file://` warning.

    8. `## Maintainer: Deploy to GitHub Pages` — DEMOTED and re-framed. Keep the existing 4-step Settings → Pages walkthrough but prefix with: "Current deploy method (subject to change — see `.github/workflows/` for the Actions-based replacement)." Do NOT polish the instructions further; Plan 3 will replace this section with a pointer to the workflow.

    Constraints:
    - Do NOT delete any technically-accurate content; reorder and reframe only.
    - Do NOT add deploy-status badge here — badge lives in root README (added in Plan 3).
    - Do NOT use emojis.
    - The first H2 heading reached by scrolling MUST NOT be "Run locally" — it must be a user-facing section.
  </action>
  <verify>
    <automated>head -15 "/Users/rowan/Documents/Note Converter/web/README.md" | grep -q "fuzzyqbit.github.io/link2notes" && grep -q "../README.md\|(/README.md)\|root README" "/Users/rowan/Documents/Note Converter/web/README.md" && grep -q "## What it uses" "/Users/rowan/Documents/Note Converter/web/README.md" && grep -qi "run locally (contributors)\|## Run locally$" "/Users/rowan/Documents/Note Converter/web/README.md" && grep -qi "maintainer\|current deploy method" "/Users/rowan/Documents/Note Converter/web/README.md" && awk '/^## /{print NR": "$0}' "/Users/rowan/Documents/Note Converter/web/README.md" | head -1 | grep -vqi "run locally"</automated>
  </verify>
  <done>
    - First 15 lines of web/README.md contain the live Pages URL
    - First H2 heading is NOT "Run locally" (verified by `awk` line above)
    - A cross-link to `../README.md` exists
    - `## What it uses`, `## Differences from the desktop version`, `## Files` retained
    - `## Run locally` re-titled with "(contributors)" qualifier or otherwise demoted
    - Deploy-to-Pages section retained but prefixed as maintainer-only and subject to change
    - No emojis
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| repo visitor → web/README.md | Untrusted reader; public doc surface. No code execution. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-05-04 | Information disclosure | web/README.md | accept | Public doc by design; no secrets. Pages URL is already public. |
| T-05-05 | Tampering | Cross-link `../README.md` | accept | Same-repo relative link, no external resolution. |
| T-05-06 | Repudiation | Deploy instructions becoming stale after Plan 3 | mitigate | Section is explicitly labeled "subject to change" and Plan 3's task replaces or supersedes it. |
</threat_model>

<verification>
- web/README.md renders on github.com with Pages URL in the visible-above-fold preview
- First H2 heading shown in GitHub's rendered ToC is user-facing, not "Run locally"
- The `../README.md` cross-link resolves correctly in GitHub's web UI (works on a relative-path basis)
</verification>

<success_criteria>
DIST-01 fully satisfied (combined with Plan 1): both root README and web/README position the Pages URL as primary, desktop / local-dev demoted to optional / contributor-only.
</success_criteria>

<output>
Create `.planning/phases/05-distribution-discovery/05-02-SUMMARY.md` when done. Include:
- Confirmation Pages URL appears in first 15 lines
- New section order
- Cross-link form used (../README.md or other)
- Note that Plan 3 will further revise the maintainer deploy section
</output>
