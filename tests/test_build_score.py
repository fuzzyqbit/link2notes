"""Test build_score with stub midi_data — avoids basic_pitch runtime."""

from converter import build_score


class _StubMidiData:
    """Minimal stand-in for a pretty_midi.PrettyMIDI instance."""

    def __init__(self, bpm):
        self._bpm = bpm

    def estimate_tempo(self):
        return self._bpm


def test_build_score_uses_estimated_tempo():
    midi = _StubMidiData(bpm=100)
    events = [(0.0, 0.6, 60), (0.6, 1.2, 62)]
    score = build_score(midi, events)
    marks = [m for m in score.flatten().getElementsByClass("MetronomeMark")]
    assert marks, "expected a MetronomeMark"
    assert marks[0].number == 100


def test_build_score_falls_back_when_tempo_unreasonable():
    midi = _StubMidiData(bpm=10)  # below 40 -> fallback 120
    events = [(0.0, 0.6, 60)]
    score = build_score(midi, events)
    marks = [m for m in score.flatten().getElementsByClass("MetronomeMark")]
    assert marks[0].number == 120


def test_build_score_emits_notes_for_valid_events():
    midi = _StubMidiData(bpm=120)
    events = [(0.0, 0.5, 60), (0.5, 1.0, 62), (1.0, 1.5, 64)]
    score = build_score(midi, events)
    midis = sorted(n.pitch.midi for n in score.flatten().notes if n.isNote)
    assert midis == [60, 62, 64]


def test_build_score_skips_events_too_short_after_conversion():
    # 0.05s @ 120bpm = 0.1 quarter, below 0.125 threshold.
    midi = _StubMidiData(bpm=120)
    events = [(0.0, 0.05, 60), (0.5, 1.0, 62)]
    score = build_score(midi, events)
    midis = [n.pitch.midi for n in score.flatten().notes if n.isNote]
    assert midis == [62]
