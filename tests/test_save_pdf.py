"""Slow integration test: verovio SVG render for the desktop preview.

Replaces the old qlmanage-based save_pdf test — PDF export now happens via the
OS print dialog driven from the webview, so there's no Python save_pdf to test.
"""

import pytest
from music21 import note, stream

from converter import render_score_svg_pages


pytestmark = pytest.mark.slow


def _make_score():
    s = stream.Score()
    p = stream.Part()
    for i, pitch in enumerate(["C4", "D4", "E4", "F4", "G4", "A4", "B4", "C5"]):
        n = note.Note(pitch)
        n.quarterLength = 1.0
        p.insert(i, n)
    s.append(p)
    return s


def test_render_score_svg_pages_returns_nonempty_svg():
    pages = render_score_svg_pages(_make_score())
    assert isinstance(pages, list)
    assert len(pages) >= 1
    for svg in pages:
        assert svg.startswith("<svg"), "expected SVG markup"
        assert "</svg>" in svg
        # Verovio inlines glyph paths inside <defs>; if the resource path is
        # broken the SVG comes out without any path definitions.
        assert "<path" in svg, "expected note glyph paths in SVG"
