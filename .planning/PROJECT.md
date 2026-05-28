# Link To Notes

## What This Is

A tool that turns a YouTube link (or any audio file) into beginner-friendly sheet music for a single-line wind instrument — flute, clarinet, bass clarinet, alto sax, tenor sax, or baritone sax. Currently ships as a Python desktop app (pywebview shell around `converter.py`) and a static web app under `web/` deployed to GitHub Pages. This milestone shifts the primary product to the web app so anyone can "search it up and run it" with zero install.

## Core Value

A learner gets a readable, playable score for their chosen wind instrument from a song link or audio file, with no install and no account.

## Requirements

### Validated

<!-- Existing capabilities already shipped in the desktop and current web build. -->

- ✓ Desktop pipeline: YouTube URL → wav (yt-dlp) → MIDI (basic_pitch ONNX) → monophonic filter → alto-sax transpose/fit → music21 score → MusicXML/PDF — existing
- ✓ Web pipeline: audio file → decode (Web Audio API) → MIDI (`@spotify/basic-pitch` TFJS) → monophonic filter → transpose/key-snap → abcjs render — existing
- ✓ Web instrument dropdown: flute, clarinet, bass clarinet, alto sax, tenor sax, baritone sax — existing
- ✓ Web download: print-to-PDF via browser; ABC source visible — existing
- ✓ GitHub Pages deployment of `web/` with redirect from repo root — existing
- ✓ YouTube URL field on web with prefill into external downloader (savefrom.net, plus alt list) — existing

### Active

<!-- This milestone. Promote the web app to the primary product and close the parity gap. -->

- [ ] Web app reaches feature parity with the desktop app users actually depend on (MusicXML export, instrument selection persisted, clear progress UI)
- [ ] YouTube → audio flow on web is reliable enough for a non-technical user (clear instructions, working downloader links, no dead options)
- [ ] Web app degrades gracefully on mobile / Safari / Firefox (no broken pipeline, file picker works, layout usable on phone)
- [ ] Documentation positions the web app as the recommended way to use Link To Notes; desktop reframed as optional power-user build
- [ ] GitHub Pages deploy is automated and verifiable (push → live within minutes; broken deploys visible)

### Out of Scope

- Server-side YouTube extraction proxy — legal/abuse risk, breaks the "static, free hosting" model
- Accounts, login, cloud save — the project's value depends on zero friction; sessions stay local
- Polyphonic transcription / chord detection — current basic_pitch monophonic filter is the design, not a bug
- Real-time audio capture from mic — extra ML scope, no user demand yet
- Native mobile apps — PWA / responsive web covers the same need

## Context

- Existing codebase: Python (`converter.py`, `main.py`, pywebview shell in `desktop_ui/`) plus a parallel JS port in `web/` (`pipeline.js` mirrors `converter.py`).
- The web port already exists and ships — this milestone is about **promoting** it, not building it from scratch. Treat the JS pipeline as the source of truth going forward; the Python pipeline is legacy.
- YouTube downloading from the browser is blocked by CORS and YouTube ToS. Recent commits (`5134ece`, `eaa52b3`, `4b47b8b`) show the project iterating on third-party downloader bridges (cobalt.tools → y2mate → savefrom.net) because direct download isn't possible.
- Distribution channel is GitHub Pages: zero hosting cost, no backend, deploys from `main`. Anything that breaks that model needs strong justification.
- Target user: a learner or hobbyist musician who wants to play a specific song on a wind instrument. They're not a developer; they won't install Python or run a build.

## Constraints

- **Tech stack (web)**: Static ES modules, CDN-loaded deps (esm.sh + jsdelivr). No build step. Anything requiring a bundler is out unless we accept adding tooling.
- **Hosting**: GitHub Pages — static files only, no server, no env secrets.
- **Browser compatibility**: Modern evergreen browsers (Chrome, Safari, Firefox, Edge). iOS Safari matters because users will try on phones.
- **YouTube**: Cannot fetch YouTube media client-side. All YouTube flows route through external user-driven downloaders.
- **ML model**: `@spotify/basic-pitch` model loads from CDN; cold load is multi-MB. First-use latency is a real UX constraint.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Web app becomes the primary product | Zero install, broader reach, free hosting | — Pending |
| Keep Python desktop as legacy build, not primary | Audience of 1 (author + power users); upkeep cost > value | — Pending |
| No server-side YT extraction | Legal/abuse risk; breaks static hosting model | ✓ Good |
| Bridge YouTube via third-party downloaders, not in-app | CORS + ToS prevent direct download; bridging keeps zero infra | ⚠️ Revisit — third-party tools die often |
| Static ES modules + CDN deps, no bundler | Matches "no install" ethos; lowest contributor friction | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-05-27 after initialization*
