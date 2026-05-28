# State: Link To Notes — Web App Promotion (v1.0)

**Last updated:** 2026-05-27

## Project Reference

- **Project:** Link To Notes
- **Milestone:** v1.0 — Web App Promotion
- **Core Value:** A learner gets a readable, playable score for their chosen wind instrument from a song link or audio file, with no install and no account.
- **Current Focus:** Promote the existing static web app (`web/`) to the primary product by closing parity, mobile, YouTube-handoff, and distribution gaps.

## Current Position

- **Phase:** Not started (Phase 1 next)
- **Plan:** None
- **Status:** Roadmap defined, awaiting `/gsd:plan-phase 1`
- **Progress:** `[          ]` 0/5 phases complete

## Performance Metrics

- Phases planned: 5
- Phases complete: 0
- v1 requirements: 13
- Requirements mapped: 13 (100%)
- Requirements delivered: 0

## Accumulated Context

### Decisions

- Web app is the primary product going forward; Python desktop is legacy
- No server-side YouTube extraction (legal/abuse + breaks static hosting)
- YouTube flow stays as a third-party downloader bridge (currently savefrom.net + alternates)
- Static ES modules + CDN deps, no bundler / build step
- GitHub Pages is the distribution channel — deploys must stay automated and visible

### Open Todos

- Plan Phase 1 (Score Export Parity)
- Verify which third-party YouTube downloaders are actually working as of release day (Phase 3)
- Audit auto-deploy: confirm push-to-main currently triggers Pages deploy, or wire one up (Phase 5)

### Blockers

- None

### Risk Watch

- Third-party YouTube downloaders die frequently — Phase 3 needs to set up an easy revisit cadence, not just a one-time link check
- Mobile Safari may not cope with the basic-pitch model load; Phase 2's clear-error path is the safety net for Phase 4's cross-device promise
- CDN-loaded ML model means cold-start latency on slow networks; progress UI in Phase 1 is the user-facing mitigation

## Session Continuity

**Last session:** Initial project setup — PROJECT.md, REQUIREMENTS.md, ROADMAP.md, STATE.md created.

**Next session entry point:**
1. Run `/gsd:plan-phase 1` to break Phase 1 (Score Export Parity) into plans
2. First plan likely targets PAR-01 (MusicXML export) since it's the largest net-new capability

**Files of record:**
- `.planning/PROJECT.md` — project context, constraints, key decisions
- `.planning/REQUIREMENTS.md` — v1/v2 requirements with traceability
- `.planning/ROADMAP.md` — 5 phases, success criteria, coverage
- `.planning/STATE.md` — this file (live project memory)

---
*State initialized: 2026-05-27*
