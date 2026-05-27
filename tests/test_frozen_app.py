"""Smoke test for the PyInstaller-built app — confirms it launches without crashing."""

import os
import subprocess
import sys
import time

import pytest


pytestmark = pytest.mark.slow

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
MAC_BINARY = os.path.join(PROJECT_ROOT, "dist", "LinkToNotes.app", "Contents", "MacOS", "LinkToNotes")
LINUX_BINARY = os.path.join(PROJECT_ROOT, "dist", "LinkToNotes", "LinkToNotes")
WIN_BINARY = os.path.join(PROJECT_ROOT, "dist", "LinkToNotes", "LinkToNotes.exe")


def _binary_path():
    if sys.platform == "darwin" and os.path.exists(MAC_BINARY):
        return MAC_BINARY
    if sys.platform.startswith("linux") and os.path.exists(LINUX_BINARY):
        return LINUX_BINARY
    if sys.platform == "win32" and os.path.exists(WIN_BINARY):
        return WIN_BINARY
    return None


@pytest.mark.skipif(_binary_path() is None, reason="frozen app not built yet — run ./build.sh first")
def test_frozen_app_launches_and_survives():
    """Launch the frozen app, wait, confirm it didn't crash on import."""
    binary = _binary_path()
    proc = subprocess.Popen(
        [binary],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        env={**os.environ, "PYTHONUNBUFFERED": "1"},
    )
    try:
        # Give Tk + heavy imports time to settle.
        time.sleep(6)
        assert proc.poll() is None, (
            f"frozen app exited early with code {proc.returncode}.\n"
            f"stderr: {proc.stderr.read().decode(errors='replace')[:2000]}"
        )
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            proc.kill()
            proc.wait()
