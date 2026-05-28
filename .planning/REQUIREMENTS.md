# Requirements: Link To Notes — Web App Promotion

**Defined:** 2026-05-27
**Core Value:** A learner gets a readable, playable score for their chosen wind instrument from a song link or audio file, with no install and no account.

## v1 Requirements

Requirements for this milestone: shift the primary product to the web app, close the parity gap, and make sure non-technical users can complete the YouTube → sheet music flow on the device they have.

### Parity

- [ ] **PAR-01**: User can export the rendered score as MusicXML from the web app
- [ ] **PAR-02**: User can export the rendered score as PDF from the web app (via browser print → Save as PDF)
- [ ] **PAR-03**: User's last-selected instrument persists across page reloads (localStorage)
- [ ] **PAR-04**: User sees clear stage-by-stage progress while a conversion runs (decoding, model loading, transcribing, rendering)

### YouTube Flow

- [ ] **YT-01**: User can paste a YouTube URL on the web page and get a one-click handoff to a working third-party MP3 downloader
- [ ] **YT-02**: User sees plain-language instructions explaining the "download audio, then upload it here" workflow without jargon
- [ ] **YT-03**: Downloader links on the page are checked and only working options ship (no dead alternates surfaced to the user)

### Cross-Platform

- [ ] **XPLAT-01**: Audio file upload works on iOS Safari, Android Chrome, desktop Chrome/Safari/Firefox/Edge
- [ ] **XPLAT-02**: Layout is usable on a phone (no horizontal scroll, controls reachable with one thumb, sheet music pans/zooms reasonably)
- [ ] **XPLAT-03**: Pipeline gracefully reports a clear error if the browser can't run the basic-pitch model (instead of hanging)

### Distribution

- [ ] **DIST-01**: Documentation (root README + web/README) positions the GitHub Pages URL as the recommended way to use the app; desktop reframed as optional power-user build
- [ ] **DIST-02**: Push to `main` deploys `web/` to GitHub Pages automatically, with a visible deploy status (success/failure surfaced in repo)
- [ ] **DIST-03**: The published URL is discoverable from the GitHub repo (repo description / About section / README badge)

## v2 Requirements

Deferred to a later milestone. Tracked so we don't lose them.

### Polish

- **POL-01**: Drag-and-drop audio file upload (currently file picker only)
- **POL-02**: Recent conversions saved in localStorage so user can re-export without re-running the pipeline
- **POL-03**: Tempo / key override controls before render
- **POL-04**: Light/dark mode that respects `prefers-color-scheme`

### Accessibility

- **A11Y-01**: Keyboard navigation through all controls
- **A11Y-02**: Screen-reader labels on all interactive elements
- **A11Y-03**: WCAG AA contrast on text and controls

### Distribution

- **DIST-04**: PWA install manifest + service worker so the app works offline after first load
- **DIST-05**: Self-host fallback (single zipped folder) for users on networks that block CDNs

## Out of Scope

| Feature | Reason |
|---------|--------|
| Server-side YouTube extraction proxy | Legal/abuse risk; would break the static-hosting model that makes this project sustainable |
| User accounts, login, cloud save | Zero-friction is core value; sessions stay local |
| Polyphonic / chord transcription | Monophonic filter is a design choice for single-line wind instruments |
| Real-time mic capture | No user demand; significant extra ML scope |
| Native iOS / Android apps | PWA + responsive web meets the need at a fraction of the cost |
| Bundler / build step for `web/` | Breaks the "no install, drop-in static files" contributor model |

## Traceability

Filled in by the roadmapper on 2026-05-27. All 13 v1 requirements mapped across 5 phases.

| Requirement | Phase | Status |
|-------------|-------|--------|
| PAR-01 | Phase 1: Score Export Parity | Pending |
| PAR-02 | Phase 1: Score Export Parity | Pending |
| PAR-04 | Phase 1: Score Export Parity | Pending |
| PAR-03 | Phase 2: Instrument Persistence & Error Handling | Pending |
| XPLAT-03 | Phase 2: Instrument Persistence & Error Handling | Pending |
| YT-01 | Phase 3: YouTube Handoff Polish | Pending |
| YT-02 | Phase 3: YouTube Handoff Polish | Pending |
| YT-03 | Phase 3: YouTube Handoff Polish | Pending |
| XPLAT-01 | Phase 4: Cross-Browser & Mobile | Pending |
| XPLAT-02 | Phase 4: Cross-Browser & Mobile | Pending |
| DIST-01 | Phase 5: Distribution & Discovery | Pending |
| DIST-02 | Phase 5: Distribution & Discovery | Pending |
| DIST-03 | Phase 5: Distribution & Discovery | Pending |

**Coverage:**
- v1 requirements: 13 total
- Mapped to phases: 13
- Unmapped: 0 ✓

---
*Requirements defined: 2026-05-27*
*Last updated: 2026-05-27 after roadmap creation (traceability filled)*
