---
phase: 05-distribution-discovery
plan: 03
type: execute
wave: 2
depends_on:
  - 05-01
  - 05-02
files_modified:
  - .github/workflows/pages.yml
  - README.md
  - web/README.md
autonomous: false
requirements:
  - DIST-02
  - DIST-03
tags:
  - ci
  - github-actions
  - github-pages
  - distribution
  - readme-badge

must_haves:
  truths:
    - "A push to main triggers a GitHub Actions workflow that builds and deploys web/ to GitHub Pages"
    - "The Actions tab of the repo shows a 'Deploy Pages' (or equivalently-named) run per push to main, with green/red status visible"
    - "The root README displays a status badge that reflects the latest pages-deploy run state"
    - "If the deploy succeeds, the change is observable at https://fuzzyqbit.github.io/link2notes/ within minutes"
    - "If the deploy fails, the badge turns red AND the Actions tab shows the failed run with logs"
    - "The repo's About / description on github.com links to https://fuzzyqbit.github.io/link2notes/ (manual GitHub UI step performed by the user during the checkpoint)"
  artifacts:
    - path: ".github/workflows/pages.yml"
      provides: "Actions-based Pages deploy on push to main"
      min_lines: 30
      contains: "actions/deploy-pages"
    - path: "README.md"
      provides: "Status badge linking to the pages.yml workflow runs"
      contains: "workflows/pages.yml/badge.svg"
  key_links:
    - from: ".github/workflows/pages.yml"
      to: "GitHub Pages"
      via: "actions/upload-pages-artifact + actions/deploy-pages"
      pattern: "actions/deploy-pages|actions/upload-pages-artifact"
    - from: "README.md"
      to: ".github/workflows/pages.yml"
      via: "shields-style badge image URL"
      pattern: "actions/workflows/pages\\.yml/badge\\.svg"
    - from: "Repo About section (github.com UI)"
      to: "https://fuzzyqbit.github.io/link2notes/"
      via: "manual user action documented in checkpoint"
      pattern: "About|Website"
---

<objective>
Make deploys visible and the live URL discoverable from the repo's front door.

Two-part vertical:
  - **DIST-02:** Replace the implicit Settings → Pages "Deploy from a branch" mechanism with an explicit GitHub Actions workflow (`.github/workflows/pages.yml`). Push-to-main currently DOES deploy (confirmed live this session), but the deploy is invisible — no Actions run, no status surface, no failure signal. An Actions-based deploy gives us an Actions-tab run per push AND a badge we can pin in the README.
  - **DIST-03:** Add a deploy-status badge to the root README pointing at the new workflow's `badge.svg`, and walk the user through updating the repo's About / description to link the Pages URL. The About link is a GitHub UI action that requires a human in the browser; Claude documents and verifies, the user clicks.

Depends on Plans 1 & 2 because the badge embeds in README.md (written in Plan 1) and the workflow needs the repositioned web/README to already exist (so we don't badge a stale doc).

Output:
  - New `.github/workflows/pages.yml` that builds and deploys `web/` on push to main
  - Status badge appended to root README.md
  - Pointer/note in web/README.md replacing its current "Deploy to GitHub Pages" maintainer section with a reference to the workflow
  - A checkpoint walking the user through (a) flipping repo Settings → Pages source from "Branch" to "GitHub Actions", and (b) updating the repo About-section website link
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
@.github/workflows/ci.yml
@.github/workflows/release.yml
@.planning/phases/05-distribution-discovery/05-01-SUMMARY.md
@.planning/phases/05-distribution-discovery/05-02-SUMMARY.md
@README.md
@web/README.md

<interfaces>
<!-- GitHub-published action versions known good at planning time. -->
<!-- If Context7 / current GitHub docs show a newer minor version, use the newer one; do not downgrade. -->

Known-good GitHub-official actions for Pages deploy:
  - actions/checkout@v4
  - actions/configure-pages@v5
  - actions/upload-pages-artifact@v3
  - actions/deploy-pages@v4

Workflow permissions block required for actions/deploy-pages:
  permissions:
    contents: read
    pages: write
    id-token: write

Concurrency block required to avoid concurrent deploy clashes:
  concurrency:
    group: "pages"
    cancel-in-progress: false

Pages environment name (required by deploy-pages):
  environment:
    name: github-pages
    url: ${{ steps.deployment.outputs.page_url }}

Artifact source dir for upload-pages-artifact: `./web` (this repo's /web/ is the deployable static site).

Repo identity (used in badge URL):
  owner: fuzzyqbit
  repo:  link2notes
  branch for badge: main
  Badge URL form: https://github.com/fuzzyqbit/link2notes/actions/workflows/pages.yml/badge.svg
  Badge link target: https://github.com/fuzzyqbit/link2notes/actions/workflows/pages.yml

Existing workflows (do NOT modify):
  .github/workflows/ci.yml — runs pytest on push to main + PRs
  .github/workflows/release.yml — tag-driven desktop build
The new pages.yml runs alongside these on push to main without coordination.

Settings → Pages source change required (manual GitHub UI, user does this in the checkpoint):
  Current:  Source = "Deploy from a branch", branch = main, folder = /web
  Required: Source = "GitHub Actions"
  Without this change, the new workflow will succeed in Actions but the live site will keep being served by the branch-based deploy — no observable effect. The flip is one-time.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Add Actions-based Pages deploy workflow</name>
  <files>.github/workflows/pages.yml</files>
  <read_first>
    - /Users/rowan/Documents/Note Converter/.github/workflows/ci.yml (existing workflow — match style, indentation, on: trigger shape)
    - /Users/rowan/Documents/Note Converter/.github/workflows/release.yml (existing workflow — confirm permissions-block convention)
    - /Users/rowan/Documents/Note Converter/web/ (confirm the directory is the deployable static site — index.html, style.css, *.js)
  </read_first>
  <action>
    Create `.github/workflows/pages.yml`. The workflow has ONE job, `deploy`, that runs on every push to `main` and on manual workflow_dispatch. The job: checks out, configures Pages, uploads `./web` as a Pages artifact, deploys.

    Required workflow elements (compose these into valid YAML; do NOT inline code blocks in this action, but the executor MUST produce the file with this shape):

    - `name:` "Deploy Pages"
    - `on:` push to branches [main], plus workflow_dispatch
    - top-level `permissions:` block granting `contents: read`, `pages: write`, `id-token: write`
    - top-level `concurrency:` group "pages", cancel-in-progress false
    - One job `deploy` running on `ubuntu-latest`
    - Job `environment:` set to `name: github-pages` and `url: ${{ steps.deployment.outputs.page_url }}`
    - Steps in order:
      1. actions/checkout@v4
      2. actions/configure-pages@v5
      3. actions/upload-pages-artifact@v3 with `path: ./web`
      4. actions/deploy-pages@v4 with `id: deployment`

    No build step — `web/` is already a static-site directory consumable as-is by upload-pages-artifact.

    Do NOT add a Node setup, no `npm install`, no bundler step — the project's hard constraint (CLAUDE.md) is no build step for the web app.

    Do NOT touch ci.yml or release.yml.
  </action>
  <verify>
    <automated>test -f "/Users/rowan/Documents/Note Converter/.github/workflows/pages.yml" && grep -q "actions/deploy-pages@v4\|actions/deploy-pages@v" "/Users/rowan/Documents/Note Converter/.github/workflows/pages.yml" && grep -q "actions/upload-pages-artifact" "/Users/rowan/Documents/Note Converter/.github/workflows/pages.yml" && grep -q "path: ./web\|path: \"./web\"\|path: './web'" "/Users/rowan/Documents/Note Converter/.github/workflows/pages.yml" && grep -q "pages: write" "/Users/rowan/Documents/Note Converter/.github/workflows/pages.yml" && grep -q "id-token: write" "/Users/rowan/Documents/Note Converter/.github/workflows/pages.yml" && grep -q "concurrency:" "/Users/rowan/Documents/Note Converter/.github/workflows/pages.yml" && grep -q "branches:.*main\|- main" "/Users/rowan/Documents/Note Converter/.github/workflows/pages.yml" && python3 -c "import yaml,sys; yaml.safe_load(open('/Users/rowan/Documents/Note Converter/.github/workflows/pages.yml'))" 2>&1 | (! grep -i "error\|exception")</automated>
  </verify>
  <done>
    - File exists at `.github/workflows/pages.yml`
    - YAML parses without error (python3 yaml.safe_load passes)
    - References actions/deploy-pages and actions/upload-pages-artifact with `path: ./web`
    - Triggers on push to main + workflow_dispatch
    - Has the three required permissions and a concurrency block
    - No build / npm install step
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Add deploy-status badge to root README and replace web/README maintainer section</name>
  <files>README.md, web/README.md</files>
  <read_first>
    - /Users/rowan/Documents/Note Converter/README.md (created in Plan 1 — confirm structure before deciding where to drop the badge)
    - /Users/rowan/Documents/Note Converter/web/README.md (rewritten in Plan 2 — locate the "Maintainer: Deploy to GitHub Pages" section to replace)
    - /Users/rowan/Documents/Note Converter/.github/workflows/pages.yml (just-created workflow — confirm the filename matches the badge URL)
  </read_first>
  <action>
    Two edits, both in this single task because they are tightly coupled to the workflow filename and to each other.

    Edit 1 — root README.md:
    Append a deploy-status badge near the top of the file (just below the title and primary call-to-action, before "## How to use"). Badge format: a markdown image linking to the workflow's Actions page. The image URL must reference the workflow file by its on-disk filename so it tracks renames correctly. Use:

      Badge image source: https://github.com/fuzzyqbit/link2notes/actions/workflows/pages.yml/badge.svg
      Badge link target:  https://github.com/fuzzyqbit/link2notes/actions/workflows/pages.yml
      Alt text: "Deploy Pages"

    Do NOT add other badges (license, CI status, etc.) in this task — out of scope.

    Edit 2 — web/README.md:
    Locate the `## Maintainer: Deploy to GitHub Pages` section added in Plan 2. REPLACE its body with a brief pointer: deploy is now driven by `.github/workflows/pages.yml` on push to `main`; before this works end-to-end the maintainer must set Settings → Pages source to "GitHub Actions" (one-time). Remove the obsolete 4-step "Deploy from a branch" walkthrough — it is no longer the deploy path.

    Do NOT remove the section heading; keep it findable. Do NOT remove the "Run locally (contributors)" section.
  </action>
  <verify>
    <automated>grep -q "actions/workflows/pages.yml/badge.svg" "/Users/rowan/Documents/Note Converter/README.md" && grep -q "actions/workflows/pages.yml)" "/Users/rowan/Documents/Note Converter/README.md" && grep -q "workflows/pages.yml" "/Users/rowan/Documents/Note Converter/web/README.md" && grep -q "GitHub Actions" "/Users/rowan/Documents/Note Converter/web/README.md" && grep -v '^#' "/Users/rowan/Documents/Note Converter/web/README.md" | (! grep -i "Deploy from a branch") && grep -qi "settings.*pages\|pages.*source\|source.*github actions" "/Users/rowan/Documents/Note Converter/web/README.md"</automated>
  </verify>
  <done>
    - Root README contains a markdown badge whose image URL is `actions/workflows/pages.yml/badge.svg`
    - Badge is wrapped in a link to `actions/workflows/pages.yml`
    - web/README references the new workflow filename
    - web/README no longer contains the obsolete "Deploy from a branch" walkthrough (outside of comments)
    - web/README instructs the maintainer to flip Settings → Pages source to "GitHub Actions"
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 3: Human enables Actions-based Pages source AND updates repo About link, then verifies deploy</name>
  <what-built>
    - `.github/workflows/pages.yml` — Actions-based deploy of `web/` to GitHub Pages on push to main
    - Status badge in root README.md
    - web/README.md updated to point at the new workflow
    The workflow is wired but Pages source is still "Deploy from a branch" — without flipping the source to "GitHub Actions" the workflow runs but the live site keeps being served by the old branch-based deploy. The repo About section also still has no website link.
  </what-built>
  <how-to-verify>
    Two GitHub-UI actions and one end-to-end verification.

    1. Flip Pages source to GitHub Actions (one-time):
       a. Open https://github.com/fuzzyqbit/link2notes/settings/pages
       b. Under "Build and deployment", change Source from "Deploy from a branch" to "GitHub Actions"
       c. Save. (Setting auto-saves on dropdown change in current GitHub UI.)

    2. Update the repo About section so the live URL is discoverable without reading the README:
       a. Open https://github.com/fuzzyqbit/link2notes
       b. Click the gear icon next to "About" (top-right of the repo landing page)
       c. In the "Website" field, paste: https://fuzzyqbit.github.io/link2notes/
       d. Optional: also tick "Use your GitHub Pages website" if the checkbox is present (it pre-fills the same URL)
       e. (Optional) Update the short description if it doesn't already mention "web app" or "sheet music"
       f. Click "Save changes"

    3. Verify deploy is visible and successful:
       a. Make a trivial commit on main (e.g., touch a whitespace in README.md, or push the actual phase-completion commit)
       b. Open https://github.com/fuzzyqbit/link2notes/actions
       c. Confirm a "Deploy Pages" workflow run appears for that commit
       d. Wait for it to finish (typically &lt; 2 min)
       e. Confirm the run is green
       f. Confirm the badge in the README on github.com renders as green ("passing")
       g. Open https://fuzzyqbit.github.io/link2notes/ in a private window and confirm the site loads (any change in the trivial commit should be visible if applicable)

    4. Verify discoverability:
       a. Open https://github.com/fuzzyqbit/link2notes in a fresh tab
       b. Confirm the About panel on the right shows the Pages URL as a clickable link
       c. Click it and confirm it opens the live app

    If any step fails (workflow red, badge red, About link not saved, Pages source still on Branch), describe the failure in the resume signal.
  </how-to-verify>
  <resume-signal>
    Reply "approved" if all four blocks pass.
    Otherwise reply with which step failed and the observed result (e.g., "step 3e: workflow red, error in upload-pages-artifact step", or "step 2c: GitHub rejected URL, said it must be HTTPS").
  </resume-signal>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| GitHub Actions runner → GitHub Pages | Workflow has `pages: write` and `id-token: write`; deploys arbitrary content from `./web` on every push to main. Trust boundary is "anything that lands on main becomes the live site." |
| Repo visitor → About-section URL | Manually-entered URL becomes a public link from github.com; if wrong, sends visitors elsewhere. |
| pages.yml workflow → third-party actions (actions/checkout, configure-pages, upload-pages-artifact, deploy-pages) | All four are first-party GitHub actions (`actions/*` namespace); trust same as GitHub. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-05-07 | Elevation of Privilege | pages.yml `permissions:` block | mitigate | Use least-privilege: `contents: read`, `pages: write`, `id-token: write` only. No `contents: write`, no secrets exposure. Matches GitHub's published deploy-pages template. |
| T-05-08 | Tampering | Anything pushed to main is deployed | accept | Solo-developer repo; main-branch protection is out of scope for this phase. Risk equivalent to current Settings-based branch deploy. |
| T-05-09 | Denial of Service | Concurrent deploys racing | mitigate | `concurrency: group: pages, cancel-in-progress: false` serializes deploys without dropping the latest. |
| T-05-10 | Spoofing | About-section URL points to wrong host | mitigate | Checkpoint task spells out the exact URL to paste (https://fuzzyqbit.github.io/link2notes/) and asks the user to click-verify after saving. |
| T-05-11 | Information disclosure | Workflow logs | accept | Logs contain only static-asset paths; no secrets, no env vars, no API keys. |
| T-05-12 | Tampering (supply chain) | actions/checkout@v4, actions/configure-pages@v5, actions/upload-pages-artifact@v3, actions/deploy-pages@v4 | accept | All four are `actions/*` first-party GitHub-published actions; same trust domain as github.com itself. Pinning to major versions matches existing ci.yml convention. |
</threat_model>

<verification>
- `.github/workflows/pages.yml` exists and YAML-parses
- Push to main produces a visible "Deploy Pages" run in the Actions tab
- The run completes green and updates https://fuzzyqbit.github.io/link2notes/
- The status badge in README.md renders as "passing" on github.com
- The repo About panel on github.com shows the Pages URL as a clickable link
- A new visitor landing on the repo can reach the live app in one click via the About panel OR the README headline (two independent paths)
</verification>

<success_criteria>
DIST-02 satisfied: push to main triggers automated deploy of `web/` to GitHub Pages with visible success/failure surfacing (Actions tab + README badge).
DIST-03 satisfied: published URL is discoverable from the repo via (a) About-section website link AND (b) deploy-status badge in the root README (both independent of having to read the README body).

Combined with Plans 1 & 2: all four Phase 5 success criteria from ROADMAP.md are TRUE — readmes funnel to live URL, About links to live URL, push-to-main deploys with visible status, fresh deploy observable within minutes.
</success_criteria>

<output>
Create `.planning/phases/05-distribution-discovery/05-03-SUMMARY.md` when done. Include:
- Path of created workflow + action versions used
- Badge markdown snippet added to README
- Confirmation Pages source was flipped to "GitHub Actions" (from checkpoint result)
- Confirmation About-section URL set (from checkpoint result)
- Observed first deploy run URL + duration (if captured)
- Any deviations from the planned action versions (e.g., if Context7 surfaced newer-good versions)
</output>
