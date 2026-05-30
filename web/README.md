# Link To Notes — Web Version

Live app: https://fuzzyqbit.github.io/link2notes/ — drop an audio file (or paste a YouTube link), pick a wind instrument (flute, clarinet, bass clarinet, alto sax, tenor sax, baritone sax), get beginner-friendly sheet music. Runs entirely in your browser. No install, no account, no server.

See the [root README](../README.md) for the full project overview and the desktop app.

## What it uses

- `@spotify/basic-pitch` (TFJS port of the Python `basic_pitch` model) — pitch detection.
- `abcjs` — ABC notation → SVG sheet music.
- Web Audio API — decodes any audio the browser supports (mp3, wav, m4a, ogg, flac).
- Krumhansl-Schmuckler key detection — rolled inline, no extra dep.

All loaded from public CDNs (esm.sh + jsdelivr) on first visit; cached by the browser after.

## Differences from the desktop version

- No YouTube auto-download. Users supply the audio file (use a free site like cobalt.tools to grab from a link, or any audio they already have).
- PDF export uses the browser's print dialog ("Save as PDF") instead of qlmanage. Works on every platform.
- Instrument dropdown (was alto-sax only).

## Files

- `index.html` — UI shell.
- `style.css` — styling.
- `instruments.js` — transposition + range table per instrument.
- `pipeline.js` — port of `converter.py`: decode → ML → monophonic filter → transpose → key snap → quantize.
- `main.js` — glue + ABC builder + render + downloads.

## Run locally (contributors)

Most users don't need this — open the live URL above. Local dev is only for editing the source.

```sh
cd web
python3 -m http.server 8000
open http://localhost:8000
```

ES modules need a real HTTP origin — don't open `index.html` via `file://`.

## Maintainer: Deploy to GitHub Pages

Current deploy method (subject to change — see `.github/workflows/` for the Actions-based replacement).

1. Push this repo to GitHub.
2. Repo settings → **Pages**.
3. Source: **Deploy from a branch**, branch: `main` (or `master`), folder: `/web`.
4. Save. Your site goes live at `https://<user>.github.io/<repo>/`.
