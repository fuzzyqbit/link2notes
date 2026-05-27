"""Unit tests for monophonic_filter — pure, no I/O."""

from converter import monophonic_filter


def test_drops_events_shorter_than_min_duration():
    events = [
        (0.00, 0.04, 60),  # too short → dropped
        (0.10, 0.50, 62),  # kept
    ]
    result = monophonic_filter(events, min_dur=0.06)
    assert len(result) == 1
    assert result[0][2] == 62


def test_non_overlapping_events_all_pass_through():
    events = [
        (0.0, 0.5, 60),
        (0.5, 1.0, 62),
        (1.0, 1.5, 64),
    ]
    result = monophonic_filter(events, min_dur=0.06)
    assert [e[2] for e in result] == [60, 62, 64]


def test_overlap_keeps_higher_pitch():
    # Two notes overlap; higher one should win after start of overlap.
    events = [
        (0.0, 1.0, 60),
        (0.3, 0.9, 72),
    ]
    result = monophonic_filter(events, min_dur=0.06)
    pitches = [e[2] for e in result]
    assert 72 in pitches


def test_empty_input_returns_empty():
    assert monophonic_filter([]) == []


def test_extra_tuple_fields_ignored():
    # basic_pitch note_events are 5-tuples; filter must accept extras.
    events = [
        (0.0, 0.5, 60, 0.9, []),
        (0.5, 1.0, 62, 0.8, []),
    ]
    result = monophonic_filter(events, min_dur=0.06)
    assert len(result) == 2
    assert all(len(e) == 3 for e in result)
