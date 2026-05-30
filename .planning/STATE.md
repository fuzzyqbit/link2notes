---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: completed
last_updated: "2026-05-29T01:13:11.400Z"
progress:
  total_phases: 5
  completed_phases: 1
  total_plans: 3
  completed_plans: 3
  percent: 20
---

# State: Link To Notes — Web App Promotion (v1.0)

**Last updated:** 2026-05-29 (Phase 2 planned, paused before execute)

## Project Reference

- **Project:** Link To Notes
- **Milestone:** v1.0 — Web App Promotion
- **Core Value:** A learner gets a readable, playable score for their chosen wind instrument from a song link or audio file, with no install and no account.
- **Current Focus:** Phase 02 — Instrument Persistence & Error Handling (next)

## Current Position

- **Phase:** 1 — Score Export Parity — **COMPLETE** (passed-with-caveats per 01-VERIFICATION.md)
- **Phase 2:** Instrument Persistence & Error Handling — **PLANNED** (2 plans, plan-checker PASS first round)
- **Plan:** Plans 02-01 + 02-02 ready for execute (both Wave 1, disjoint files)
- **Status:** Phase 2 planned, awaiting `/gsd-execute-phase 2`
- **Progress:** `[##        ]` 1/5 phases complete (20%)

## Performance Metrics

- Phases planned: 5
- Phases complete: 1
- v1 requirements: 13
- Requirements mapped: 13 (100%)
- Requirements delivered: 3 (PAR-01, PAR-02, PAR-04)

## Accumulated Context

### Decisions

- Web app is the primary product going forward; Python desktop is legacy
- No server-side YouTube extraction (legal/abuse + breaks static hosting)
- YouTube flow stays as a third-party downloader bridge (currently savefrom.net + alternates)
- Static ES modules + CDN deps, no bundler / build step
- GitHub Pages is the distribution channel — deploys must stay automated and visible

### Open Todos

- Plan Phase 2 — Instrument Persistence & Error Handling (`/gsd-plan-phase 2`)
- Visual MuseScore confirmation of Plan 01-02 still outstanding (no admin password, installer blocked). File correctness proven by automated + structural checks. Revisit in Phase 4 cross-browser pass or if MuseScore install becomes possible.
- Real-iOS PDF print smoke test (Plan 01-03) deferred to Phase 4 cross-browser pass — owns the iOS retest by design
- Replace dead `savefrom.net` YouTube handoff (US blocked since 2020-04-28, confirmed) — Phase 3 work
- Audit auto-deploy: confirm push-to-main triggers Pages deploy (Phase 5)

### Blockers

- None

### Risk Watch

- Third-party YouTube downloaders die frequently — Phase 3 needs to set up an easy revisit cadence, not just a one-time link check
- Mobile Safari may not cope with the basic-pitch model load; Phase 2's clear-error path is the safety net for Phase 4's cross-device promise
- CDN-loaded ML model means cold-start latency on slow networks; progress UI in Phase 1 is the user-facing mitigation

## Session Continuity

**Last session (2026-05-29 evening):** Planned Phase 2. RESEARCH.md committed (d450c09) — recommends new `web/storage.js` for PAR-03 + 20s reset-on-progress watchdog around `bp.evaluateModel` for XPLAT-03. 2 PLAN.md files committed (07db2fc) — plan-checker PASS first round, no revisions. Both plans Wave 1 with disjoint `files_modified` (Plan 02-01 touches storage.js + main.js; Plan 02-02 touches pipeline.js only). Paused before execute-phase per user request at 21:57.

**Next session entry point:**

1. Run `/gsd-execute-phase 2` — both Plans can run in parallel (Wave 1, disjoint files).
2. Plan 02-01 (instrument-persistence, PAR-03): 3 tasks (2 auto + 1 human-verify). Vertical slice: select tenor sax, reload, dropdown still tenor sax.
3. Plan 02-02 (model-load-watchdog, XPLAT-03): 2 tasks (1 auto + 1 human-verify). Vertical slice: simulated 20s hang fails loudly with plain-language error.
4. Each plan ends with a human-verify checkpoint — be ready to test in browser (Plan 02-02 verify includes simulating model-load failure, possibly via DevTools network throttle or stubbing).
5. Test audio file `test-tune.aiff` lives at project root — reuse.

**Files of record:**

- `.planning/PROJECT.md` — project context, constraints, key decisions
- `.planning/REQUIREMENTS.md` — v1/v2 requirements with traceability
- `.planning/ROADMAP.md` — 5 phases, success criteria, coverage
- `.planning/STATE.md` — this file (live project memory)

---
*State initialized: 2026-05-27*
