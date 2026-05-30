// Single source of truth for the YouTube → MP3 handoff candidates.
//
// This file is the ONLY place the app knows about specific downloader sites.
// web/main.js imports PRIMARY for the "Get MP3" button and DOWNLOADERS for
// rendering the alternates list — keeping HTML and behaviour in sync.
//
// The 5-minute ship-day verification ritual lives in web/DOWNLOADERS.md
// (introduced by Plan 03-03). Quick version:
//   1. From a US connection (no VPN), open each entry's landingUrl.
//   2. Confirm: no "discontinued in US" banner, no scam overlay, input visible.
//   3. Paste a YouTube link, click their download/convert button, confirm an
//      audio file actually downloads.
//   4. Update lastVerified to today.
//
// Rule: if an entry fails day-of-ship verification, REMOVE it. Do not hide it,
// do not comment it out, do not leave it "to fix later" — one good link is
// better than three half-checked ones (YT-03 success criterion).
//
// Cobalt prefill format reference: github.com/imputnet/cobalt web/README
//   "to prefill the link into the input box & start the download automatically,
//   you can pass the URL in the `#` parameter"

export const DOWNLOADERS = [
  {
    id: "cobalt-meowing",
    name: "cobalt (meowing.de instance)",
    note: "open-source cobalt frontend on a community instance — main cobalt.tools is YouTube-blocked, this one works",
    urlFor: (yt) => `https://cobalt.meowing.de/#${encodeURIComponent(yt)}`,
    landingUrl: "https://cobalt.meowing.de",
    lastVerified: "2026-05-30",
  },
  {
    id: "cnvmp3",
    name: "cnvmp3.com",
    note: "ad-free, donation-funded — paste your link manually (no prefill)",
    urlFor: () => "https://cnvmp3.com",
    landingUrl: "https://cnvmp3.com",
    lastVerified: "2026-05-30",
  },
  // Alternates: add ONLY after manually verifying both (a) loads from a US IP,
  // (b) accepts a YouTube URL and produces an audio download.
  // Past PRIMARY (kept as a note, not surfaced): cobalt.tools — see DOWNLOADERS.md log.
  // For copy-paste-only alternates, set `urlFor: () => "https://<site>"`
  // (no prefill — just opens the landing page) and surface that in UI copy.
];

// PRIMARY is the array head — they stay in sync by reference, never drift.
export const PRIMARY = DOWNLOADERS[0];
