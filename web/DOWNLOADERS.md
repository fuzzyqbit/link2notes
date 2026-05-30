# Downloader Verification Checklist

Run this before every release that ships changes to the YouTube handoff. Takes 5 minutes.

## Why this exists

The YouTube-downloader genre rots fast. Sites get blocked by YouTube, change owners, sprout
ad-injection overlays, or get acquired by adware networks — sometimes in the span of a single
month. CORS blocks any meaningful runtime liveness check from a static page (no-cors fetches
return opaque success even when the target is a 503 or a banner), so we cannot detect rot
automatically from the browser. This file is therefore a human gate — accept it. The cost is
five minutes a release; the alternative is shipping dead or scam links to learners.

This checklist is the documentation half of requirement **YT-03** ("Downloader links on the
page are checked and only working options ship — no dead alternates surfaced to the user").

## The checklist

1. Use a normal US-residential connection — **NO VPN, NO corporate proxy, NO school network**.
   VPNs and corporate networks can mask geo-blocks and DNS-level filtering that real users will
   hit. If you only have access to a filtered network, stop and find another connection.
2. Open `web/downloaders.js` in your editor. It is the **single source of truth** — the in-page
   alternates list (`<ul id="alt-downloaders">`) is rendered from this array at load time, so
   whatever ships here ships to users.
3. For each entry in the `DOWNLOADERS` array, open its `landingUrl` in a regular browser tab
   **with ADBLOCK OFF** (real users will not all have uBlock; you need to see the page as they
   will). Confirm:
   - **(a)** no "discontinued in your country" banner,
   - **(b)** no scam-button overlay (fake "Download" buttons that open ads instead of the
     downloader),
   - **(c)** a real URL input field is visible without dismissing 3+ popups.
4. Paste a test YouTube URL — recommend `https://www.youtube.com/watch?v=dQw4w9WgXcQ` (short,
   stable, well-known) — and click the site's actual download or convert button. Confirm an
   audio file **actually starts downloading** (not a redirect to an ad page, not a fake "click
   here" interstitial, not a "subscribe to continue" prompt).
5. If the entry passed, update its `lastVerified` field in `web/downloaders.js` to today's date
   in ISO format (`YYYY-MM-DD`). If the entry **failed**, **REMOVE** it from the array — do
   not comment it out, do not hide it behind a feature flag, do not leave it "for later".
   Per YT-03, dead alternates do not ship.

## Rules

- **DO** add a new candidate only after running the full checklist above on it.
- **DO** keep the array short — one good entry beats three half-checked entries.
- **DO NOT** trust SEO results. "Best youtube to mp3 2026" listicles are referral spam, and
  most top-ranked candidates are ad-injection mirrors operated by referral networks.
- **DO NOT** add 3-letter-TLD clone domains (`*.cc`, `*.gs`, `*.tube`, `*.ai`, `*.nu`) without
  source-code evidence (a public repo, recent commits, named maintainers). Most are SEO mirrors
  run by ad-injection networks impersonating the original site's name.
- **DO NOT** build an automated runtime liveness check from the static page — CORS makes the
  results meaningless (no-cors fetches return opaque success even when the page is a 503 or
  redirects to ads). Liveness is a human responsibility, not a code one.
- **DO NOT** claim "one-click downloads MP3" in any user-facing copy. The first click opens a
  downloader; the user still clicks once more on the downloader site to save the file. Set
  that expectation honestly.

## Candidate notes

`.planning/phases/03-youtube-handoff-polish/03-RESEARCH.md` contains a `Downloader Evaluation
Table` of candidates inspected by the researcher on 2026-05-30 (cobalt as primary; `dltkk.to`
and `cnvmp3.com` flagged as worth manual click-through verification). The table is the starting
point for adding new entries — but every entry still needs the full checklist above before it
ships.

---

**Most recent ship-day verification:** 2026-05-30 — cobalt.meowing.de (PRIMARY) + cnvmp3.com (copy-paste fallback).

## Rotation log

- **2026-05-30 (later same day):** Pulled `cobalt.tools` as PRIMARY. User reported "cobalt is not able to download links" — confirmed main cobalt.tools instance is YouTube-blocked. Swapped to community instance `cobalt.meowing.de` (same open-source frontend, same `#URL` prefill protocol, instance was up + working at time of swap). Added `cnvmp3.com` as copy-paste fallback (no prefill — `urlFor: () => landingUrl`). Past PRIMARY `cobalt.tools` removed (per "REMOVE not hide" rule).
- **2026-05-30:** Initial ship — `cobalt.tools` as PRIMARY (Phase 3, see 03-RESEARCH.md).
