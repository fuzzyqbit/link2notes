"""Unit tests for score-shaping helpers — pure music21, no I/O."""

import os
import tempfile

import pytest
from music21 import converter as m21_converter, note, stream

from converter import (
    SAX_HI_MIDI,
    SAX_LO_MIDI,
    fit_to_alto_sax,
    quantize_and_measure,
    save_musicxml,
    score_to_letters,
    simplify_score,
)


def _make_score(pitches, ql=1.0):
    """Build minimal Score with given pitches at sequential offsets."""
    s = stream.Score()
    p = stream.Part()
    for i, pitch in enumerate(pitches):
        n = note.Note(pitch)
        n.quarterLength = ql
        p.insert(i * ql, n)
    s.append(p)
    return s


# ---------- score_to_letters ----------

def test_score_to_letters_empty_score_returns_placeholder():
    s = stream.Score()
    s.append(stream.Part())
    assert score_to_letters(s) == "(no notes detected)"


def test_score_to_letters_basic():
    s = _make_score(["C4", "D4", "E4"])
    letters = score_to_letters(s)
    assert letters == "C4 D4 E4"


def test_score_to_letters_truncates_at_max():
    s = _make_score(["C4"] * 10)
    letters = score_to_letters(s, max_notes=3)
    tokens = letters.split(" ")
    assert tokens[-1] == "..."
    assert len([t for t in tokens if t != "..."]) == 3


# ---------- fit_to_alto_sax ----------

def test_fit_to_alto_sax_lands_inside_hard_range():
    # Input concert pitch melody around middle C.
    s = _make_score(["C4", "E4", "G4", "C5"])
    fitted = fit_to_alto_sax(s)
    midis = [n.pitch.midi for n in fitted.flatten().notes if n.isNote]
    assert midis, "expected notes after transposition"
    for m in midis:
        assert SAX_LO_MIDI <= m <= SAX_HI_MIDI, f"midi {m} outside sax range"


def test_fit_to_alto_sax_preserves_note_count():
    s = _make_score(["C4", "D4", "E4", "F4"])
    fitted = fit_to_alto_sax(s)
    assert len([n for n in fitted.flatten().notes if n.isNote]) == 4


# ---------- quantize_and_measure ----------

def test_quantize_and_measure_creates_measures():
    s = _make_score(["C4", "D4", "E4", "F4"])
    out = quantize_and_measure(s)
    # After makeMeasures, the part should contain Measure objects.
    has_measures = any(
        "Measure" in m.classes
        for p in out.parts
        for m in p.getElementsByClass("Measure")
    )
    assert has_measures


# ---------- simplify_score ----------

def test_simplify_score_empty_returns_same():
    s = stream.Score()
    s.append(stream.Part())
    out = simplify_score(s)
    assert out is s  # short-circuit return


def test_simplify_score_caps_repeated_runs():
    # 10 identical notes; with dedupe_run_limit=2, should collapse to <=3 events.
    s = _make_score(["C4"] * 10, ql=2.0)
    out = simplify_score(s, dedupe_run_limit=2, target_bpm=70, min_quarter=2.0)
    notes = [n for n in out.flatten().notes if n.isNote]
    assert len(notes) <= 3, f"expected <=3 after dedup, got {len(notes)}"


def test_simplify_score_drops_very_short_notes():
    s = _make_score(["C4", "D4", "E4"], ql=0.25)  # all < 0.5, must all be dropped
    out = simplify_score(s)
    notes = [n for n in out.flatten().notes if n.isNote]
    assert len(notes) == 0


# ---------- save_musicxml ----------

def test_save_musicxml_writes_parseable_file(tmp_path):
    s = _make_score(["C4", "E4", "G4"])
    out_path = str(tmp_path / "out.musicxml")
    save_musicxml(s, out_path)
    assert os.path.exists(out_path)
    assert os.path.getsize(out_path) > 0
    # Round-trip parse — proves the file is valid MusicXML.
    parsed = m21_converter.parse(out_path)
    pitches = [n.nameWithOctave for n in parsed.flatten().notes if n.isNote]
    assert pitches == ["C4", "E4", "G4"]
