# Link To Notes

Turn a YouTube link or audio file into beginner-friendly sheet music for a single-line wind instrument — flute, clarinet, bass clarinet, alto sax, tenor sax, or baritone sax.

**Try it now: <https://fuzzyqbit.github.io/link2notes/>**

[![Deploy Pages](https://github.com/fuzzyqbit/link2notes/actions/workflows/pages.yml/badge.svg)](https://github.com/fuzzyqbit/link2notes/actions/workflows/pages.yml)

No install. No account. No upload. Everything runs in your browser. Open the web app and you're one paste away from a playable score.

## How to use

1. **Paste** a YouTube link in the box and click **Get MP3 →**.
2. A new tab opens with your link already filled in. **Click the downloader's button** to save the MP3 to your device.
3. Come back to the web app and **drop the MP3** into the **Audio file** box.
4. Pick your **Instrument** and press **Convert**.

When the score appears, use **Save MusicXML**, **Download PDF**, **Download SVG**, or **Download ABC** to export.

> Already have a recording? Skip Get MP3 and drop the file in directly — MP3, WAV, M4A (iPhone voice memos), OGG, and FLAC all work.

## What works best

Only **solo instrument** tracks work well. One instrument playing one note at a time. No chords, no backing tracks, no singing over the music, no full bands. Pick a video that's just a single flute, violin, piano melody line, etc.

## Supported instruments

- Flute
- Clarinet
- Bass clarinet
- Alto sax
- Tenor sax
- Baritone sax

The score is automatically transposed into the right key for the instrument you pick.

## What it uses

- `@spotify/basic-pitch` (TFJS port of the Python `basic_pitch` model) — pitch detection.
- `abcjs` — ABC notation → SVG sheet music.
- Web Audio API — decodes any audio the browser supports (mp3, wav, m4a, ogg, flac).
- Krumhansl-Schmuckler key detection — rolled inline, no extra dep.

All loaded from public CDNs (esm.sh + jsdelivr) on first visit; cached by the browser after.

## Desktop app (optional, power-user)

If you'd rather run Link To Notes as a native desktop app instead of the web app, two options:

- **Download a prebuilt binary** (mac arm64 or Windows x64) from the [GitHub Releases tab](https://github.com/fuzzyqbit/link2notes/releases).
- **Build it yourself** locally with `build.sh` (PyInstaller wrapper around `converter.py` + the pywebview shell in `desktop_ui/`). Also see `scripts/` for related helpers.

The desktop build exists for offline use and YouTube auto-download; for everyone else, the web app is the recommended path.

## Develop the web app locally

Contributors and tinkerers: see [`web/README.md`](web/README.md) for local-dev instructions (a short `python3 -m http.server` recipe), the file layout under `web/`, and the differences between the web and desktop versions.

## License

See [LICENSE](LICENSE).
