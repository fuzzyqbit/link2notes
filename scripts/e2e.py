"""End-to-end smoke test: YouTube URL or search → notes → MusicXML + verovio SVG.

PDF export now happens via the OS print dialog in the desktop UI, so this
script only validates the headless pieces: pipeline + MusicXML + SVG render.

Usage:
    python scripts/e2e.py                                       # default search query
    python scripts/e2e.py "https://www.youtube.com/watch?v=ID"
    python scripts/e2e.py "ytsearch1:happy birthday piano"

Exit code 0 on success, 1 on failure.
"""

import os
import sys
import time
import traceback

# Make project root importable when run as `python scripts/e2e.py`.
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, ROOT)

from converter import render_score_svg_pages, run_pipeline, save_musicxml  # noqa: E402

DEFAULT_URL = "ytsearch1:mary had a little lamb piano short"


def log(msg):
    print(f"[{time.strftime('%H:%M:%S')}] {msg}", flush=True)


def main():
    url = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_URL
    out_dir = os.path.join(ROOT, "output")
    os.makedirs(out_dir, exist_ok=True)

    log(f"URL: {url}")
    t0 = time.time()
    try:
        score, letters, title = run_pipeline(url, progress=log)
    except Exception:
        traceback.print_exc()
        return 1

    log(f"pipeline OK in {time.time() - t0:.1f}s — title={title!r}")
    log(f"letters preview: {letters[:200]}")

    note_count = sum(1 for n in score.flatten().notes if n.isNote)
    log(f"note count: {note_count}")
    if note_count == 0:
        log("FAIL — no notes in final score")
        return 1

    xml_path = os.path.join(out_dir, f"e2e_{title}.musicxml")
    save_musicxml(score, xml_path)
    log(f"wrote {xml_path} ({os.path.getsize(xml_path)} bytes)")

    svgs = render_score_svg_pages(score)
    log(f"rendered {len(svgs)} SVG page(s)")
    if not svgs or not all(s.startswith("<svg") for s in svgs):
        log("FAIL — verovio SVG render produced no output")
        return 1

    # Persist first page so it can be inspected manually.
    svg_path = os.path.join(out_dir, f"e2e_{title}_page1.svg")
    with open(svg_path, "w", encoding="utf-8") as f:
        f.write(svgs[0])
    log(f"wrote {svg_path} ({os.path.getsize(svg_path)} bytes)")
    log("E2E PASS")
    return 0


if __name__ == "__main__":
    sys.exit(main())
