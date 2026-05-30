# Phase 3: YouTube Handoff Polish - Research

**Researched:** 2026-05-30
**Domain:** Third-party YouTube→MP3 handoff (client-side, static-hosted)
**Confidence:** MEDIUM (cobalt prefill mechanism HIGH-confidence; downloader landscape inherently unstable)

## Summary

The current code points at `en.savefrom.net`, which is confirmed dead in the US since 2020-04 and continues to be US-blocked as of 2026-05 (verified by web search + project memory file `project-phase3-savefrom-dead.md`, plus Phase 1 testing 2026-05-28). The whole `<details>` alternates list in `web/index.html` (savefrom, yt1s, ezmp3, notube, ddownr) also degraded since it was last touched — `y2mate.com` and most `*.cc` derivatives are now ad-heavy, malware-flagged, or US-discontinued by their own admission.

The standout candidate is **cobalt.tools** (`imputnet/cobalt` on GitHub, AGPL-3, 40k+ stars, active monorepo). It is the only verified candidate with **documented URL-prefill syntax** (hash fragment: `https://cobalt.tools/#<URL>`) AND a reputable maintenance posture (open source, status page, no ads, no account, no signup). The catch: YouTube on the main public instance has been intermittently blocked by YouTube itself since mid-2025 — the operator's twitter (2026-03) said "fixed reliably for now," and the public status page on 2026-05-30 shows ongoing VP9 render incidents. This is exactly the reason YT-03 is in the requirements: the downloader landscape rots fast and Phase 3 must ship a survivable revisit cadence, not just a one-time link swap.

**Primary recommendation:** Replace `converterUrlFor()` to point at `https://cobalt.tools/#<encoded-yt-url>` (hash fragment, NOT query string — query string is undocumented and was the syntax in unmerged feature-request issue #234). Move the downloader list into a single `web/downloaders.js` module with a `lastVerified` ISO date per entry — that file becomes the "ship-day check" surface. Add a `web/DOWNLOADERS.md` (or comment in `downloaders.js`) with a 5-minute manual checklist for the next swap.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Parse + validate YouTube URL input | Browser/Client | — | Input element + `trim()` already lives in `web/main.js`; no server allowed |
| Encode URL for handoff target | Browser/Client | — | Pure URL construction; `encodeURIComponent` already in use |
| Copy URL to clipboard (graceful) | Browser/Client | — | `navigator.clipboard.writeText` already wrapped in try/catch (line 66-69 of main.js); pattern is correct |
| Open external downloader | Browser/Client | — | `window.open(url, "_blank", "noopener")` — must NOT proxy through server (constraint) |
| Maintain downloader candidate list | Static asset | — | A JS module + a markdown checklist; no DB, no fetch |
| "Is this link still alive" check | Manual / dev workflow | — | Runtime health check from client side is blocked by CORS; this is a release-day human gate |

**Verdict:** Phase 3 stays 100% client-side. No new tiers, no API calls, no proxies. The only new "tier" is a human verification ritual.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Browser native `URL` / `URLSearchParams` | — | URL parsing / encoding | Already in use; no dependency added [VERIFIED: web/main.js line 56] |
| Browser native `window.open` | — | External downloader handoff | Already in use; no dependency added [VERIFIED: web/main.js line 70] |
| Browser native `navigator.clipboard` | — | Clipboard fallback | Already in use; correctly try/catch wrapped [VERIFIED: web/main.js lines 66-69] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| — | — | — | This phase adds zero dependencies. Static ES modules + DOM APIs only. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `window.open(url, "_blank", "noopener")` | `<a href target=_blank rel="noopener">` form-submit | Anchor approach removes the popup-blocker risk on iOS Safari, but loses the imperative clipboard-then-open sequence that the current code uses. Anchor approach is more robust on mobile. **Recommend: keep `window.open` for the main button (matches current code), but ALSO render a same-target `<a>` next to it as a "didn't open?" fallback.** |
| Hash-fragment prefill (`#URL`) | Query-string prefill (`?url=URL`) | Hash is **documented**; query string was a feature request (issue #234) that may or may not be live and is not in the README. Pick hash. |

**Installation:**
```bash
# No installs. Static files only.
```

**Version verification:** N/A — no packages added. CDN deps (abcjs) are unchanged.

## Package Legitimacy Audit

> Not applicable — this phase installs zero packages. Edits are to `web/main.js`, `web/index.html`, `web/style.css`, plus one new module `web/downloaders.js` and one optional `web/DOWNLOADERS.md`. The static `<script>` tags in `web/index.html` are unchanged.

## Architecture Patterns

### System Architecture Diagram

```
[User types YT URL into <input id="yt-url">]
          |
          v
[Enter key OR click "Get MP3 →" button]
          |
          v
[main.js handler]
   |              \
   |               +--> navigator.clipboard.writeText(url)  [try/catch — already correct]
   |                                  |
   |                                  v
   |                          (browser may deny — silent fallback OK)
   v
[converterUrlFor(url) — REPLACED to use downloaders.PRIMARY]
          |
          v
[window.open(primaryDownloader.urlFor(youtubeUrl), "_blank", "noopener")]
          |
          v
[New tab: cobalt.tools/#<encoded-url> — input prefilled, user clicks download]
          |
          v
[User downloads MP3 from cobalt; brings file back to "Audio file" input on the same page]
```

### Recommended Project Structure
```
web/
├── main.js              # Edit: drop hardcoded converterUrlFor(); import from downloaders.js
├── index.html           # Edit: rewrite <details> alternates list + the YT-input <small> copy
├── downloaders.js       # NEW: list of {name, urlFor(url), notes, lastVerified} + PRIMARY pointer
├── DOWNLOADERS.md       # NEW (optional): 5-min manual verification checklist for the next swap
└── style.css            # Probably no change; existing .converter-list / .url-row classes carry over
```

### Pattern 1: Downloader Registry Module
**What:** A single ES module exporting an array of downloader candidates and a designated `PRIMARY`. Each entry knows how to build its own prefill URL.

**When to use:** Whenever the UI needs to render the downloader list or build the handoff URL. Centralizes the "what works today" knowledge in one grep-able file.

**Example:**
```javascript
// web/downloaders.js
// Source of truth for the YouTube → MP3 handoff candidates.
// Update lastVerified when you spot-check on release day.
// See DOWNLOADERS.md for the 5-minute verification ritual.

export const DOWNLOADERS = [
  {
    id: "cobalt",
    name: "cobalt.tools",
    note: "open-source, no ads, no signup — recommended",
    urlFor: (yt) => `https://cobalt.tools/#${encodeURIComponent(yt)}`,
    landingUrl: "https://cobalt.tools",
    lastVerified: "2026-05-30",
  },
  // Alternates: add ONLY after manually verifying both (a) loads from a US IP
  // (b) accepts a YouTube URL and produces an audio download.
];

export const PRIMARY = DOWNLOADERS[0];
```

```javascript
// web/main.js (edit)
import { PRIMARY, DOWNLOADERS } from "./downloaders.js";

// REPLACE the existing converterUrlFor() function:
function converterUrlFor(youtubeUrl) {
  return PRIMARY.urlFor(youtubeUrl);
}
```

### Pattern 2: Hash-fragment prefill (cobalt-specific)
**What:** Cobalt's documented prefill syntax. The URL goes in the URL hash, not a query string.

**When to use:** This phase, for cobalt.

**Example:**
```javascript
// Documented in github.com/imputnet/cobalt web/README:
//   "to prefill the link into the input box & start the download automatically,
//   you can pass the URL in the `#` parameter, like this:
//   https://cobalt.tools/#https://www.youtube.com/watch?v=dQw4w9WgXcQ
//   the link can also be URI-encoded"
const url = `https://cobalt.tools/#${encodeURIComponent(youtubeUrl)}`;
```
[VERIFIED: github.com/imputnet/cobalt/blob/main/web/README.md]

### Anti-Patterns to Avoid
- **Hand-rolling a server-side YouTube extractor:** Already in `## Out of Scope` in REQUIREMENTS.md and STATE.md decisions. Static hosting is a project constraint.
- **Trusting WebSearch-discovered URLs without spot-check:** Every site in `web/index.html`'s current alternates list was plausible at the time it was added. Three are now degraded. The fix is the verification ritual (YT-03), not a smarter search query.
- **Picking a downloader because it's the first hit on Google:** Most top SEO results in this space are clone-domains operated by ad-injection networks (TechRadar, Wondershare, etc. lists are SEO chum). Stick to OSS-backed services with public source.
- **Building an in-page "is this link alive?" check:** CORS blocks cross-origin status requests from a static page. No-cors fetches always look like success. This is a manual gate, not an automated one.
- **Putting the downloader list in `index.html` only:** Splits truth between HTML (visible to users) and JS (used by the button). When one drifts the other rots. Single source in `downloaders.js`, render from there.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| YouTube audio extraction | A server proxy, an iframe scraper, a JS-based stream-ripper | Third-party downloader handoff (cobalt.tools) | (1) Project constraint — static hosting (2) Legal/abuse risk per `REQUIREMENTS.md ## Out of Scope` (3) YouTube actively blocks programmatic extraction; even cobalt's own server gets blocked |
| Liveness check for downloader URLs | A `fetch(downloader.url, {mode:"no-cors"})` smoke test | A human checklist run on release day | CORS makes no-cors fetches return opaque success even when the page is a 503 or banner. Static-site liveness checks are theater. |
| URL encoding | Manual `replace()` chains | `encodeURIComponent()` | Existing code (`web/main.js:56`) already does this correctly. Don't regress. |
| Clipboard write | Manual `document.execCommand("copy")` | `navigator.clipboard.writeText()` in try/catch | Existing code (`web/main.js:66-69`) already does this correctly. The try/catch is essential — write requires user gesture + permission and can throw silently on iOS. |

**Key insight:** The whole point of this phase is to ride on top of someone else's downloader. Resist any urge to "make it more reliable" by adding logic — every line of code here is a future maintenance liability.

## Runtime State Inventory

This phase is a rename/refactor + copy change in `web/main.js` + `web/index.html`. Inventory:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — the app has no DB. localStorage only holds `instrument` (PAR-03, unrelated). | None |
| Live service config | None — no external services in this project. | None |
| OS-registered state | None — purely a static web page. | None |
| Secrets/env vars | None — project constraint (`CLAUDE.md`: "no env secrets"). | None |
| Build artifacts | None — no build step (project constraint). The only "artifact" is the deployed static folder on GitHub Pages, which auto-updates on push. | None — GitHub Pages picks up the next push |

Nothing in any category outside the source files needs touching. This is a pure source edit.

## Common Pitfalls

### Pitfall 1: Picking a downloader by `?url=` when the doc says `#`
**What goes wrong:** The handoff opens cobalt.tools but the URL field is empty — user is back to copy-paste.
**Why it happens:** Issue #234 (Nov 2023) requested `?url=` syntax; the README only documents `#URL`. WebSearch results sometimes quote the issue request as if it landed.
**How to avoid:** Use the documented syntax: `https://cobalt.tools/#<URL>` (hash, not query). Test once with a real YouTube URL.
**Warning signs:** Field is blank after redirect; user has to paste manually anyway. [VERIFIED: github.com/imputnet/cobalt/blob/main/web/README.md]

### Pitfall 2: Cobalt's main instance gets re-blocked by YouTube
**What goes wrong:** User clicks Get MP3, page loads, cobalt shows "this service is currently unavailable for YouTube." Total handoff failure.
**Why it happens:** YouTube actively blocks Cobalt's main server IP. The maintainers cycle infrastructure but it's a cat-and-mouse game (last "fixed reliably" Twitter post was 2026-03; status page on 2026-05-30 shows ongoing VP9 render incidents).
**How to avoid:** (a) Build the verification cadence per YT-03 so the next swap is a 5-minute job. (b) Always render at least one alternate that the user can click directly. (c) Don't promise "one-click guaranteed" in the copy — say "opens a downloader" instead of "downloads the MP3."
**Warning signs:** Cobalt status page (`status.cobalt.tools`) shows YouTube health-check failures. Reddit/discord threads spike. Maintainer's twitter (`@justusecobalt`) posts an outage notice. [CITED: status.cobalt.tools]

### Pitfall 3: iOS Safari pop-up block
**What goes wrong:** `window.open(url, "_blank", "noopener")` returns `null` or quietly does nothing because iOS Safari treats it as a non-user-gesture popup, especially if it fires AFTER an async clipboard write resolves.
**Why it happens:** iOS only allows `window.open` within the synchronous handler of a user gesture. The current code awaits `navigator.clipboard.writeText(url)` BEFORE `window.open` — on slow clipboard permission grants, iOS may have lost the gesture context by then.
**How to avoid:** Call `window.open` FIRST (synchronously, in the click handler), THEN fire-and-forget the clipboard write. Or: handle clipboard async but accept that on iOS the popup may need to be a real `<a target="_blank">` anchor (which never gets popup-blocked).
**Warning signs:** Mobile users report "nothing happens when I click Get MP3." Phase 4 (Cross-Browser & Mobile) is the dedicated catch for this, but Phase 3 should not regress current behavior.

### Pitfall 4: SEO-bait alternates
**What goes wrong:** Ship a "tested" alternates list that turns out to be ad-injection networks, redirects to fake-button pages, or scam download links.
**Why it happens:** The whole genre is plagued by SEO clone-farms (`*.cc`, `*.gs`, `*.ai`, `*.wtf`, `*.tube` mirrors). Search results for "best yt to mp3" are dominated by listicles that earn referral revenue.
**How to avoid:** Only list sites where you can answer YES to all of: (1) source is open and recently committed, OR (2) the site is the original published domain (not a `*.cc` mirror), AND (3) you personally clicked through with adblock OFF on a US IP within the last 7 days and got a real audio download.
**Warning signs:** The "download" button on the destination opens an ad pop-up instead of starting the download. Pages flash multiple fake "click here" buttons. Domain is a 3-letter TLD with no listed company / contact / repo.

### Pitfall 5: "One-click" claim vs reality
**What goes wrong:** YT-01 says "one-click handoff." If cobalt requires the user to then click "download" on the cobalt page, AND then choose audio format, AND then click download again — is that "one-click"?
**Why it happens:** The first click is "open downloader pre-filled." The downloader still needs interaction.
**How to avoid:** Be honest in the page copy. YT-01 success criterion 1 reads "opens a working third-party downloader pre-filled with that URL" — which is a one-click handoff to the downloader, not one click to MP3. The instruction copy should set the right expectation: "Click Get MP3 → on the next page, pick MP3 and download → drop it back here."

## Code Examples

### Example 1: Replace `converterUrlFor()`
```javascript
// web/main.js - REPLACE existing converterUrlFor (lines 53-57)

import { PRIMARY } from "./downloaders.js";

function converterUrlFor(youtubeUrl) {
  return PRIMARY.urlFor(youtubeUrl);
}
```

### Example 2: `web/downloaders.js` (new file)
```javascript
// web/downloaders.js
// Single source of truth for the YouTube → MP3 handoff list.
//
// To verify on release day (5 minutes):
//   1. From a US connection (no VPN), click each entry's landingUrl.
//   2. Confirm: no "discontinued in US" banner, no scam-button overlay, real input field visible.
//   3. Paste a YouTube link, click their download/convert button, confirm an audio file actually starts downloading.
//   4. Update lastVerified to today.
// If any entry fails, REMOVE it (don't hide it — YT-03 success criterion).

export const DOWNLOADERS = [
  {
    id: "cobalt",
    name: "cobalt.tools",
    note: "open-source, no ads, no signup — recommended",
    urlFor: (yt) => `https://cobalt.tools/#${encodeURIComponent(yt)}`,
    landingUrl: "https://cobalt.tools",
    lastVerified: "2026-05-30",
  },
  // Add 1-2 verified alternates here. Candidates worth re-checking on release day:
  //   - dltkk.to        (yt-dlp web frontend, claims no ads / no signup; prefill: NO — copy-paste only)
  //   - cnvmp3.com      (ad-free, donations; prefill: NOT documented — copy-paste only)
  // For copy-paste-only alternates, set urlFor: (yt) => "https://<site>" (no prefill) and surface that in the UI copy.
];

export const PRIMARY = DOWNLOADERS[0];
```

### Example 3: HTML copy rewrite for YT-02
```html
<!-- web/index.html - replace the .instructions ol AND the .howto-download <details> -->

<section class="instructions">
  <h2>How to use</h2>
  <ol>
    <li><strong>Paste</strong> a YouTube link in the box below and click <strong>Get MP3 →</strong>.</li>
    <li>A new tab opens with the link already filled in. <strong>Click the downloader's button</strong> to save the MP3 to your device.</li>
    <li>Come back here and <strong>drop the MP3</strong> into the <strong>Audio file</strong> box.</li>
    <li>Pick your instrument and press <strong>Convert</strong>.</li>
  </ol>

  <p class="warning">
    <strong>Important:</strong> only <strong>solo instrument</strong> tracks work well.
    One instrument playing one note at a time. No chords, no backing tracks, no
    singing over the music, no full bands.
  </p>

  <details class="howto-download">
    <summary>Why two steps? And what if the downloader is broken?</summary>
    <p>
      Browsers can't pull audio out of YouTube directly — only YouTube's own player can.
      So we hand the link off to a third-party converter, which gives you back an MP3 you
      can drop into this page. Two clicks, no install.
    </p>
    <p>
      Free converter sites change often. If the one we open is down, try one of these:
    </p>
    <ul class="converter-list" id="alt-downloaders"></ul>
    <p class="tip">
      Already have a recording? Skip Get MP3 and drop the file in directly — any format
      your browser can decode works (MP3, WAV, M4A, OGG, FLAC).
    </p>
  </details>
</section>
```

```javascript
// web/main.js - render alternates from downloaders.js into #alt-downloaders
import { DOWNLOADERS } from "./downloaders.js";

const altList = document.getElementById("alt-downloaders");
if (altList) {
  for (const d of DOWNLOADERS) {
    const li = document.createElement("li");
    const a = document.createElement("a");
    a.href = d.landingUrl;
    a.target = "_blank";
    a.rel = "noopener";
    a.textContent = d.name;
    li.appendChild(a);
    if (d.note) {
      li.appendChild(document.createTextNode(` — ${d.note}`));
    }
    altList.appendChild(li);
  }
}
```

### Example 4: Adjust click handler to be iOS-Safari safe
```javascript
// web/main.js - REPLACE existing getAudioBtn click handler (lines 59-71)
// Open FIRST (synchronous inside user gesture), THEN attempt clipboard.

getAudioBtn.addEventListener("click", () => {
  const url = ytUrlInput.value.trim();
  if (!url) {
    ytUrlInput.focus();
    return;
  }
  // Open inside the user gesture — iOS Safari requires synchronous window.open.
  window.open(converterUrlFor(url), "_blank", "noopener");
  // Fire-and-forget clipboard write; failure is fine (downloader is already prefilled).
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(url).catch(() => { /* permission denied — OK */ });
  }
});
```

## Downloader Evaluation Table (as of 2026-05-30)

Confidence is HIGH only where a primary source (project README, status page, project memory file, or maintainer's social post) confirmed the status today. Sites that blocked our verification fetch are marked LOW.

| # | Site | Prefill mechanism | US-accessible | Active maintenance | Ads / signup | Verified today | Confidence | Verdict |
|---|------|-------------------|---------------|-------------------|--------------|-----------------|------------|---------|
| 1 | **cobalt.tools** | `#<URL>` hash fragment (documented in web/README) | YES (app loads); YouTube extraction has been intermittently blocked since mid-2025 — `status.cobalt.tools` 2026-05-30 shows VP9 render incidents | YES — 40k+ stars, AGPL-3, active monorepo, public status page | NO ads, NO signup, NO account | Project README + status page + maintainer twitter | HIGH (mechanism), MEDIUM (reliability) | **PRIMARY** — best of a rotting genre; the docs/status page give an early-warning signal |
| 2 | savefrom.net (current default) | `?url=` (works in regions where site is up) | NO — US-discontinued since 2020-04-28; confirmed Phase 1 testing 2026-05-28 + project memory + USTR 2024 Notorious Markets List + web searches today | YES (operating elsewhere) | Heavy ads + push notifications | Project memory + USTR list + 2026 search | HIGH | **REMOVE** — primary failure mode of this whole phase |
| 3 | y2mate.com | None documented | NO — operator notice "discontinued as of August 1, 2026" for US/UK/Australia; in IFPI October 2025 shutdown announcement; clone domains (`y2mate.nu`, `y2mate.icu`, `y2matehd.com`, `y2mate.is`) exist but are unrelated SEO mirrors | Mixed (originals dead; clones thriving) | Heavy ads, deceptive buttons widely reported | WebSearch 2026-05-30 | MEDIUM | **REMOVE** — even if a clone works today it'll change owners by next month |
| 4 | yt1s.com | Unknown — verification fetch refused | Unknown | Unknown | Reported "fast, ad-heavy" in existing code comments | Did not load | LOW | **REMOVE** until re-verified manually |
| 5 | ezmp3.cc | Unknown — verification fetch ECONNREFUSED | Unknown | Unknown | Unknown | Did not load | LOW | **REMOVE** until re-verified manually |
| 6 | notube.net | None documented (suggests `notube.net/watch?v=` URL-replace trick — copy-paste workflow, not prefill) | Unknown — site loads, claims "no ads, no registration" | Unclear | Self-claim "no ads" | WebFetch loaded landing page | MEDIUM | KEEP as a copy-paste alternate only; not a one-click target |
| 7 | ddownr.com | Unknown — verification fetch ECONNREFUSED | Unknown | Unknown | Existing code says "supports music.youtube.com" | Did not load | LOW | **REMOVE** until re-verified manually |
| 8 | ytmp3.cc / ytmp3.ai | Unknown | Site redirects to ytmp3.ai; widely flagged by security writeups as ad/malware-heavy | YES (active) | Ads + redirects + "push notification" prompts | WebSearch + security reviews | MEDIUM | **REMOVE** — ecosystem is unsafe by default; bad recommendation |
| 9 | dltkk.to | None documented (manual paste only) | YES — site loaded, claims "Zero Ads", "ALL SYSTEMS ONLINE", uptime 98.2% | Unclear (no public repo found) | Self-claim "no ads, no registration" | WebFetch confirmed page | MEDIUM | **Possible alternate** — verify manually then add to list as copy-paste alternate |
| 10 | cnvmp3.com | None documented | Unclear — site loaded, claims ad-free, Ko-fi-funded | Active (recent donation milestones visible) | Self-claim ad-free, no account | WebFetch confirmed page | MEDIUM | **Possible alternate** — verify manually then add to list as copy-paste alternate |
| 11 | ssyt.rip | None documented | Unknown | Unknown | Self-claim "no intrusive pop-ups" | WebFetch loaded page | LOW-MEDIUM | Skip unless cobalt + 2 alternates aren't enough |
| 12 | ytdlp.online (yt-dlp web GUI) | None documented; supports anonymous downloads with "auto-deleted every hour" file holding | YES (site loaded) | Active (version banner shows 2026-05-30 web UI build) | Optional account, no ads in current view | WebFetch confirmed page | MEDIUM | **Possible alternate** — niche/technical interface; not ideal for "non-technical learner" but a survivable fallback |

**Net recommendation for `downloaders.js` on ship day:**
- **PRIMARY:** `cobalt.tools` (`#URL` prefill, documented).
- **ALT 1 (copy-paste):** `dltkk.to` — only after manual click-through verification.
- **ALT 2 (copy-paste):** `cnvmp3.com` — only after manual click-through verification.
- Everything else: drop.

If any of the 3 fails the day-of verification, ship with whatever passes (even if that's just cobalt alone). YT-03 is "no dead alternates surfaced" — one good link is better than three half-checked ones.

## Implementation Notes

### File-by-file delta

**`web/downloaders.js` (NEW, ~30 LOC):** Exports `DOWNLOADERS` array and `PRIMARY` reference. Single source of truth.

**`web/main.js` (EDIT, ~10 LOC changed):**
- Add `import { PRIMARY, DOWNLOADERS } from "./downloaders.js";` near the top with other imports.
- Replace `converterUrlFor()` (lines 53-57) to return `PRIMARY.urlFor(youtubeUrl)`. Drop the savefrom.net comment.
- Reorder the click handler (lines 59-71): call `window.open` FIRST, then fire-and-forget clipboard (per Pitfall 3). This is a small UX improvement on iOS that doesn't change desktop behavior.
- Add a small block to render the `<ul id="alt-downloaders">` from `DOWNLOADERS` on load.

**`web/index.html` (EDIT, ~20 LOC changed):**
- Rewrite the `.instructions ol` for plain-language YT-02 copy.
- Rewrite the `.howto-download` `<details>` block — change the summary line, change the body copy, change the `<ul class="converter-list">` to be `<ul id="alt-downloaders">` (populated by JS from `downloaders.js`).
- Update the `<small>` under the YT URL input to reflect the new primary (drop "savefrom.net").

**`web/style.css` (likely NO change):** The existing `.url-row`, `.converter-list`, `.howto-download`, `.warning`, `.tip` classes carry over. Only edit if the new copy needs a new visual treatment.

**`web/DOWNLOADERS.md` (NEW, optional, ~30 lines):** The verification checklist (5 minutes, US connection, click through each, update `lastVerified`). Lives next to `downloaders.js` so it's discoverable by anyone editing the list.

**Estimated total diff:** ~80 LOC across 3 files edited + 1-2 files added. Comfortably within "small phase" territory.

### Plan-shape suggestion (informational — planner decides)
This looks like 2-3 plans rather than 1, because the verification ritual is genuinely separate work from the swap:
- **Plan 1 (YT-01):** Swap `converterUrlFor()` to cobalt + introduce `downloaders.js` + iOS-Safari click-order fix.
- **Plan 2 (YT-02):** Rewrite the in-page instructions and `<details>` body copy.
- **Plan 3 (YT-03):** Add `DOWNLOADERS.md` checklist + perform the ship-day verification on each entry + delete unverified entries.

Plans 1-2 are parallel-safe (different concerns, different DOM regions). Plan 3 depends on 1 (needs `downloaders.js` to exist). The planner may collapse these for mvp granularity — that's a planner call.

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Cobalt main instance gets re-blocked by YouTube within 1-2 months of release | HIGH (it's already intermittent per status page 2026-05-30) | HIGH (primary handoff dead) | (a) The verification ritual (YT-03 / `DOWNLOADERS.md`) makes the next swap a 5-minute job. (b) Ship at least one copy-paste alternate so users have a path even on day 1 of an outage. (c) The instructions copy should say "opens a downloader" rather than "downloads the MP3" so the broken-cobalt case doesn't read as a lie. |
| Alternates we verify today degrade silently (ads added, account required, geographic block) | MEDIUM-HIGH (this is what just happened to the current list) | MEDIUM (user falls back, may bounce) | The `lastVerified` date in each entry. The `DOWNLOADERS.md` ritual. No automated cadence — accept that this is a human task on each release. |
| Adblock-on / adblock-off divergence — a site looks "clean" with uBlock but is unusable without | MEDIUM | LOW (annoying, not blocking) | Verify with adblock OFF on a normal browser profile. Note "ads present" in the `note` field if so. |
| iOS Safari popup-block on `window.open` after async work | MEDIUM | MEDIUM (mobile users bounce) | Reorder click handler — `window.open` synchronous first, clipboard fire-and-forget after. (Already in Code Examples.) Phase 4 cross-browser pass will catch any residual cases. |
| User on aggressive corporate / school network where downloader domains are blocked at DNS | LOW-MEDIUM | LOW (out of our control) | The "Already have a recording? drop it in directly" line in the instructions stays. Their existing audio file path is the bypass. |
| New downloader is malware / scam-redirect that we missed | LOW (if verification ritual is followed) | HIGH (user trust damage) | Manual verification with adblock off on a US connection. If anything is ambiguous, don't ship it. "No alternate" is a valid state. |

## Validation Plan

> `nyquist_validation` is `false` in `.planning/config.json`. Skipping the detailed Test Framework / Sampling-Rate section.

Phase 3 has no unit-testable surface beyond pure URL construction. The validation that matters is human:

| Requirement | Check | How |
|-------------|-------|-----|
| YT-01 | Pasting a YouTube URL + clicking Get MP3 opens cobalt.tools with the URL prefilled in the input | Manual: enter `https://www.youtube.com/watch?v=dQw4w9WgXcQ`, click Get MP3, verify cobalt tab opens with the link pre-populated. Confirm both on desktop Chrome AND iOS Safari (Phase 4 dovetail). |
| YT-01 unit | `converterUrlFor("https://www.youtube.com/watch?v=abc")` returns the exact expected hash-fragment URL | Optional node smoke test: import `downloaders.js`, assert `PRIMARY.urlFor("...")` matches expected string. ~10 LOC. |
| YT-02 | Page copy describes the 2-step flow without jargon | Reviewer reads the new copy, confirms it makes sense to a non-technical learner. No "API", no "third-party", no "extraction" terms in the visible flow text. |
| YT-03 | Every visible downloader link has been clicked today AND produces an audio download | Manual ship-day pass per `DOWNLOADERS.md`. Each entry has `lastVerified: <today>` in `downloaders.js`. Any failing entry deleted, not hidden. |

The optional `downloaders.test.js` is the only automated piece worth writing — keeps the URL construction honest if cobalt changes its prefill syntax. ~10 LOC.

## Project Constraints (from CLAUDE.md)

| Directive | Implication for Phase 3 |
|-----------|------------------------|
| Static ES modules, CDN deps only, no build step | New `downloaders.js` must be a plain ES module imported by `web/main.js`. No bundler. |
| Hosting: GitHub Pages, no server, no env secrets | No proxy, no API key, no server-side anything. The whole phase is HTML/JS/Markdown edits. |
| Browser compatibility: modern evergreen + iOS Safari | Test iOS popup ordering (Pitfall 3). `URLSearchParams`, `encodeURIComponent`, `window.open`, `<details>` all supported. |
| Cannot fetch YouTube media client-side; all YouTube flows route through external user-driven downloaders | Codified in the architecture. This phase reinforces it; doesn't fight it. |
| Use GSD workflow for file edits | Plans + tasks generated by planner; this research is the input. |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Cobalt's `#<URL>` prefill behavior actually works on the live `cobalt.tools` page today (not just documented) | Pattern 2 / Code Examples | YT-01 fails on day 1. Mitigation: manual verify once before merging Plan 1 — paste the test URL and watch the input populate. [VERIFIED via project README quotation; LIVE behavior ASSUMED until human spot-check] |
| A2 | `dltkk.to` and `cnvmp3.com` are real ad-free downloaders, not scam pages we haven't seen yet | Downloader Evaluation Table | Ship a scam link. Mitigation: ritualized manual verification before adding to `downloaders.js`. [ASSUMED — WebFetch saw self-described "no ads"; no clickthrough done] |
| A3 | iOS Safari's popup-block triggers when `window.open` follows `await navigator.clipboard.writeText` | Pitfall 3 / Code Example 4 | Reorder doesn't help; mobile users still bounce. Mitigation: Phase 4 cross-browser pass will catch real device behavior. [ASSUMED — well-known iOS behavior pattern; not freshly tested on iOS 18 this session] |
| A4 | The 3-letter TLD downloader clones (`*.cc`, `*.ai`, `*.nu`, `*.tube`) are mostly SEO mirrors / scam, not legitimate operations | Anti-Patterns + Pitfall 4 | We exclude a legitimate site by being overly conservative. Mitigation: low-cost — there are enough OK candidates to fill the alternates list without needing the `.cc` mirrors. [ASSUMED based on security writeups in search results] |
| A5 | The current code's `getAudioBtn` click handler order is the source of any iOS popup-block, not some other factor (focus, async work elsewhere) | Code Example 4 | Reorder makes no measurable difference. Mitigation: this change is low-cost, low-risk — even if it doesn't help iOS it doesn't hurt desktop. [ASSUMED based on iOS Safari docs] |
| A6 | The `<details>` element renders OK on all target browsers including iOS Safari | Pattern in index.html (unchanged from existing) | Alternates list invisible to some users. Mitigation: existing `<details class="howto-download">` is already in production from earlier phases — if it worked before, it works now. [VERIFIED: already shipping] |

All claims tagged `[ASSUMED]` above should be the discussion seeds with the user before Plan execution. The single most consequential one is A1 — a live cobalt spot-check before merging Plan 1 essentially eliminates the YT-01 risk.

## Open Questions

1. **Do we want to render the alternates list inline in `<details>` (current pattern) or as a sentence ("if that didn't work, try cobalt.tools, dltkk.to, cnvmp3.com")?**
   - What we know: Current `<details>` collapses by default; some users will never see it. A flat sentence is more discoverable but uses vertical space.
   - What's unclear: User research not in scope. Phase 4 mobile work may force a decision (vertical space at premium on phone).
   - Recommendation: Keep `<details>` for now — matches existing pattern, doesn't change visual footprint, the planner can revisit if Phase 4 finds it's a problem.

2. **Should `DOWNLOADERS.md` live in `/web/` or at repo root?**
   - What we know: `/web/` already has a `README.md` per the DIST-01 requirement framing.
   - What's unclear: Whether the verification ritual is "developer documentation" (belongs in root) or "web-app documentation" (belongs in /web/).
   - Recommendation: `/web/DOWNLOADERS.md` — co-located with the `downloaders.js` it documents. Anyone editing the list will see it. Planner can override.

3. **Do we add a `downloaders.test.js` node smoke test, or skip it for this phase?**
   - What we know: `nyquist_validation: false` in config — automated testing is not required by the workflow.
   - What's unclear: Whether a 10-LOC test that confirms `PRIMARY.urlFor("...")` returns the expected string is worth the indirection.
   - Recommendation: Yes, add it — it's tiny, catches the regression where someone "fixes" the encoding incorrectly, and the project has node smoke tests already from Phases 1-2 (`scripts/test-storage.mjs`, etc.) as established pattern.

4. **Does the user want to ship the ship-day-verified alternates list as part of this phase, OR ship just the cobalt swap now and add the alternates after the next downloader rotation?**
   - What we know: YT-03 success criterion says "every visible downloader link has been checked" — it doesn't say HOW MANY must be visible.
   - What's unclear: Does "shipping with PRIMARY only and a clear note 'one good link beats three half-checked'" satisfy YT-03, or does the user want a richer fallback list?
   - Recommendation: Discuss with user during plan-discuss. The minimal-viable answer is "cobalt + 1 verified alternate." The richer answer is "cobalt + 2-3 verified alternates."

## Environment Availability

This phase has no external runtime dependencies — pure HTML/JS/CSS edits to existing static files. No new tools required.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Browser with `URL`, `URLSearchParams`, `window.open`, `navigator.clipboard` | Whole phase | ✓ (existing target = modern evergreen browsers per CLAUDE.md) | — | — |
| Node.js (for optional smoke test) | Optional `downloaders.test.js` | ✓ (used by existing test scripts from Phases 1-2) | — | — |

**Missing dependencies with no fallback:** None.
**Missing dependencies with fallback:** None.

## Sources

### Primary (HIGH confidence)
- `/Users/rowan/Documents/Note Converter/web/main.js` — current `converterUrlFor()`, click handler, clipboard pattern
- `/Users/rowan/Documents/Note Converter/web/index.html` — current `<details>` alternates list + instruction copy
- `/Users/rowan/Documents/Note Converter/.planning/REQUIREMENTS.md` — YT-01/02/03 phrasing, `## Out of Scope` constraints
- `/Users/rowan/Documents/Note Converter/.planning/STATE.md` — risk note "third-party YouTube downloaders die frequently"; project decisions (no server proxy)
- `/Users/rowan/.claude/projects/.../memory/project_phase3_savefrom_dead.md` — savefrom.net dead-in-US (USTR 2024 Notorious Markets List confirmation)
- `https://github.com/imputnet/cobalt/blob/main/web/README.md` — cobalt prefill syntax (hash fragment, documented)
- `https://github.com/imputnet/cobalt` — cobalt project status, AGPL-3, active monorepo, 40k+ stars
- `https://status.cobalt.tools/` — cobalt operational status as of 2026-05-30 (VP9 render incidents active)

### Secondary (MEDIUM confidence)
- `https://github.com/imputnet/cobalt/issues/234` — feature request for `?url=` query syntax (NOT merged; prefer documented `#URL`)
- `https://github.com/imputnet/cobalt/issues/1325` — bookmarklet using `#URL` syntax (confirms the hash-fragment route is the intended path)
- USTR 2024 Notorious Markets List — savefrom.net entry; y2mate IFPI shutdown announcement (cited via WebSearch results)
- `https://instances.cobalt.best/service/youtube` — community instances list (not deeply inspected; mentioned as a path forward for users)
- WebFetch results for `cobalt.tools`, `notube.net`, `dltkk.to`, `cnvmp3.com`, `ssyt.rip`, `ytdlp.online`, `yt2mp3.gs` — landing-page-only inspection on 2026-05-30

### Tertiary (LOW confidence)
- WebSearch results for "best youtube to mp3 converter 2026" — listicles from TechRadar/Wondershare/NoteBurner/AudiFab/etc. — treat as informational pointers only, not endorsements
- Sites that refused WebFetch (`en.savefrom.net`, `yt1s.com`, `ezmp3.cc`, `ytmp3.cc`, `ssyoutube.com`, `ddownr.com`, `y2mate.com`) — status unknown without manual click-through

## Metadata

**Confidence breakdown:**
- Cobalt as PRIMARY recommendation: HIGH on mechanism (README + issue thread quote the exact prefill syntax), MEDIUM on reliability (status page shows current YouTube health incidents; landscape is inherently unstable)
- Architectural shape (`downloaders.js` + `DOWNLOADERS.md`): HIGH (matches existing project conventions — single ES module, no bundler, markdown docs co-located)
- Downloader alternates list: MEDIUM-LOW (most candidates blocked our verification fetch; ritual on ship-day is the only honest way to land this)
- Pitfalls (cobalt blocked / iOS popup / SEO bait): HIGH on phenomenon, MEDIUM on specific mitigations
- iOS click-order fix: MEDIUM (well-documented iOS behavior, but not freshly tested on iOS 18 this session)

**Research date:** 2026-05-30
**Valid until:** 2026-06-30 for the cobalt recommendation (the genre rotates fast — recheck before Phase 4 lands, or earlier if shipping is delayed). The verification ritual itself is the long-term mitigation.
