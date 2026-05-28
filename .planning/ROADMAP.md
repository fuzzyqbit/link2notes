# Roadmap: Link To Notes — Web App Promotion (v1.0)

**Created:** 2026-05-27
**Milestone:** v1.0 — Web App Promotion
**Granularity:** coarse
**Mode:** mvp
**Coverage:** 13/13 v1 requirements mapped

## Strategy

The web app already runs end-to-end (audio file -> MIDI -> abcjs render -> instrument transpose -> PDF print). This milestone promotes it to the primary product by closing observable gaps in five vertical slices, each ending with a user-visible improvement on the deployed GitHub Pages site:

1. **Score Export Parity** — match the desktop app's MusicXML/PDF export with clear progress UI
2. **Instrument Persistence & Error Handling** — survive reloads, fail loudly on unsupported browsers
3. **YouTube Handoff Polish** — keep the bridge to third-party downloaders alive and honest
4. **Cross-Browser & Mobile** — make the deployed app usable on the phones learners actually carry
5. **Distribution & Discovery** — point everyone (and the repo) at the web URL, with visible deploys

The existing `web/pipeline.js`, abcjs render layer, instrument dropdown, and Pages deploy are treated as the source of truth — phases extend them, not rewrite them.

## Phases

- [ ] **Phase 1: Score Export Parity** — User can export the rendered score as MusicXML and PDF with clear stage-by-stage progress
- [ ] **Phase 2: Instrument Persistence & Error Handling** — Instrument choice survives reloads and model failures surface as readable errors
- [ ] **Phase 3: YouTube Handoff Polish** — YouTube paste produces a one-click handoff to a verified working downloader with plain-language instructions
- [ ] **Phase 4: Cross-Browser & Mobile** — Verified working pipeline and usable layout on iOS Safari, Android Chrome, and desktop browsers
- [ ] **Phase 5: Distribution & Discovery** — Repo, README, and auto-deploy all point at the live web app as the recommended product

## Phase Details

### Phase 1: Score Export Parity
**Goal:** User can download a real MusicXML file and a PDF of their generated score, with clear feedback about what the pipeline is doing
**Mode:** mvp
**Depends on:** Nothing (extends existing `web/pipeline.js` + abcjs render)
**Requirements:** PAR-01, PAR-02, PAR-04
**Success Criteria** (what must be TRUE):
  1. After a successful conversion, user clicks "Save MusicXML" and receives a valid `.musicxml` file that opens in MuseScore / Finale
  2. After a successful conversion, user clicks "Save PDF" (or equivalent) and gets a PDF of the score via the browser print pathway
  3. While a conversion runs, user sees a stage indicator that names the current step (decoding audio, loading model, transcribing, rendering) and updates as the pipeline advances
  4. If MusicXML or PDF export fails, user sees a specific error message instead of a silent failure
**Plans:** 3 plans
  - [ ] 01-01-stage-progress-PLAN.md — Stage-by-stage progress indicator (PAR-04)
  - [ ] 01-02-musicxml-export-PLAN.md — MusicXML export with correct transpose and ties (PAR-01)
  - [ ] 01-03-pdf-hardening-PLAN.md — PDF popup-blocker fallback and specific error copy (PAR-02)
**UI hint:** yes

### Phase 2: Instrument Persistence & Error Handling
**Goal:** User's instrument choice is remembered between visits, and a broken model load fails loudly instead of hanging
**Mode:** mvp
**Depends on:** Phase 1 (shared progress UI surface from PAR-04 is reused for error display)
**Requirements:** PAR-03, XPLAT-03
**Success Criteria** (what must be TRUE):
  1. User selects an instrument (e.g. tenor sax), reloads the page, and the dropdown is still set to tenor sax
  2. User on a browser that cannot load the basic-pitch model sees a clear, plain-language error within ~15 seconds instead of an indefinite spinner
  3. The error message names the likely cause (browser/device unable to run the model) and suggests trying a desktop browser
**Plans:** TBD
**UI hint:** yes

### Phase 3: YouTube Handoff Polish
**Goal:** User pastes a YouTube URL, gets a working one-click handoff to a third-party MP3 downloader, and knows what to do next without prior knowledge
**Mode:** mvp
**Depends on:** Nothing (parallel-safe with Phases 1–2; touches the YouTube section only)
**Requirements:** YT-01, YT-02, YT-03
**Success Criteria** (what must be TRUE):
  1. User pastes a YouTube URL and clicks one button that opens a working third-party downloader pre-filled with that URL
  2. User sees a short, jargon-free explanation on the page describing the "download the audio, then upload it here" two-step flow
  3. Every downloader link visible to the user has been checked and actually loads / accepts the URL on the day of release; dead alternates are removed (not hidden, removed)
**Plans:** TBD
**UI hint:** yes

### Phase 4: Cross-Browser & Mobile
**Goal:** The deployed web app actually works for a learner on whatever device they happen to grab — phone, tablet, or laptop
**Mode:** mvp
**Depends on:** Phases 1–3 (verifies the full surface, including new export buttons and YouTube handoff)
**Requirements:** XPLAT-01, XPLAT-02
**Success Criteria** (what must be TRUE):
  1. User on iOS Safari can pick an audio file, run the pipeline, see the score, and trigger MusicXML/PDF export without the page breaking
  2. User on Android Chrome can complete the same end-to-end flow
  3. User on desktop Chrome, Safari, Firefox, and Edge can complete the same flow (smoke-tested per browser)
  4. On a phone-sized viewport, the page has no horizontal scroll, primary controls (file picker, instrument, convert, export) are reachable with one thumb, and the rendered score pans/zooms readably
**Plans:** TBD
**UI hint:** yes

### Phase 5: Distribution & Discovery
**Goal:** Anyone landing on the GitHub repo is funneled to the live web app, and any push to `main` ships visibly
**Mode:** mvp
**Depends on:** Phases 1–4 (the live URL is only worth promoting once it actually delivers the milestone)
**Requirements:** DIST-01, DIST-02, DIST-03
**Success Criteria** (what must be TRUE):
  1. Root README and `web/README` present the GitHub Pages URL as the primary way to use Link To Notes; desktop is clearly marked as an optional power-user build
  2. The GitHub repo's About / description links to the live Pages URL so a visitor finds it without reading the README
  3. A push to `main` triggers an automated deploy of `web/` to GitHub Pages, and the deploy's success or failure is visible in the repo (Actions tab, badge, or equivalent surface)
  4. User can confirm a fresh deploy is live within minutes of a push by visiting the published URL
**Plans:** TBD

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Score Export Parity | 0/3 | Planned | - |
| 2. Instrument Persistence & Error Handling | 0/0 | Not started | - |
| 3. YouTube Handoff Polish | 0/0 | Not started | - |
| 4. Cross-Browser & Mobile | 0/0 | Not started | - |
| 5. Distribution & Discovery | 0/0 | Not started | - |

## Coverage Map

| Requirement | Phase |
|-------------|-------|
| PAR-01 | Phase 1 |
| PAR-02 | Phase 1 |
| PAR-04 | Phase 1 |
| PAR-03 | Phase 2 |
| XPLAT-03 | Phase 2 |
| YT-01 | Phase 3 |
| YT-02 | Phase 3 |
| YT-03 | Phase 3 |
| XPLAT-01 | Phase 4 |
| XPLAT-02 | Phase 4 |
| DIST-01 | Phase 5 |
| DIST-02 | Phase 5 |
| DIST-03 | Phase 5 |

**Mapped:** 13/13 v1 requirements
**Orphaned:** 0
**Duplicates:** 0

---
*Roadmap created: 2026-05-27*
