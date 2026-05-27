"""Unit tests for the pywebview Api class — no webview window required."""

import pytest

from main import Api, default_output_dir, resource_path


def test_resource_path_in_dev_resolves_to_real_file():
    p = resource_path("desktop_ui/index.html")
    import os
    assert os.path.exists(p), f"expected {p} to exist in dev"


def test_default_output_dir_is_writable_path():
    import os
    p = default_output_dir()
    assert os.path.isdir(p)
    # Path is under user's home, never under filesystem root.
    assert p.startswith(os.path.expanduser("~"))


def test_convert_rejects_empty_url():
    api = Api()
    with pytest.raises(ValueError, match="YouTube link"):
        api.convert("")
    with pytest.raises(ValueError):
        api.convert("   ")


def test_save_without_prior_convert_raises():
    api = Api()
    with pytest.raises(RuntimeError, match="convert a link first"):
        api.save_musicxml()


def test_save_without_window_attached_raises_clearly():
    api = Api()
    # Pretend a conversion ran without going through convert().
    api._latest_score = object()
    api._latest_title = "x"
    with pytest.raises(RuntimeError, match="Window not ready"):
        api.save_musicxml()
