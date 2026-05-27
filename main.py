"""Link To Notes — pywebview desktop shell.

Loads desktop_ui/index.html into an OS-native webview and exposes a small
Python API to the page: convert(url) → notes preview, save(format) → file dialog.
"""

import json
import os
import sys
import threading
import traceback

import webview

import base64

from converter import (
    assemble_pdf_from_pngs,
    render_score_svg_pages,
    run_pipeline,
    save_musicxml,
)


def resource_path(rel_path):
    """Resolve a bundled read-only asset in dev or in a PyInstaller bundle."""
    base = getattr(sys, "_MEIPASS", os.path.dirname(os.path.abspath(__file__)))
    return os.path.join(base, rel_path)


def _decode_png_data_url(data_url):
    """Strip the data: prefix from a PNG data URL and return raw bytes."""
    if not isinstance(data_url, str) or "," not in data_url:
        raise ValueError("Expected a base64 PNG data URL")
    header, b64 = data_url.split(",", 1)
    if "image/png" not in header:
        raise ValueError(f"Expected image/png data URL, got {header!r}")
    return base64.b64decode(b64)


def default_output_dir():
    """User-writable directory for saved sheet music."""
    docs = os.path.join(os.path.expanduser("~"), "Documents", "LinkToNotes")
    try:
        os.makedirs(docs, exist_ok=True)
        return docs
    except OSError:
        return os.path.expanduser("~")


class Api:
    """Methods exposed to JavaScript as `window.pywebview.api.*`."""

    def __init__(self):
        self._window = None
        self._lock = threading.Lock()
        self._latest_score = None
        self._latest_title = ""

    def attach_window(self, window):
        self._window = window

    def _push_progress(self, message):
        if not self._window:
            return
        payload = json.dumps(message)
        try:
            self._window.evaluate_js(f"window.linktonotes_progress({payload});")
        except Exception:
            pass

    def convert(self, url):
        """Run YouTube → notes pipeline. Returns {title, letters, svgs} for the UI to render."""
        url = (url or "").strip()
        if not url:
            raise ValueError("Paste a YouTube link first.")

        try:
            score, letters, title = run_pipeline(url, progress=self._push_progress)
            self._push_progress("Rendering sheet music...")
            svgs = render_score_svg_pages(score)
        except Exception as exc:
            traceback.print_exc()
            raise RuntimeError(str(exc)) from exc

        with self._lock:
            self._latest_score = score
            self._latest_title = title
        return {"title": title, "letters": letters, "svgs": svgs}

    def _safe_title(self):
        title = self._latest_title or "untitled"
        return "".join(c for c in title if c.isalnum() or c in " -_").strip() or "untitled"

    def _ask_save_path(self, ext, file_type_label):
        if not self._window:
            raise RuntimeError("Window not ready.")
        chosen = self._window.create_file_dialog(
            webview.SAVE_DIALOG,
            directory=default_output_dir(),
            save_filename=f"{self._safe_title()}{ext}",
            file_types=(f"{file_type_label} (*{ext})",),
        )
        if not chosen:
            return ""
        raw = chosen if isinstance(chosen, str) else chosen[0]
        path = str(raw)
        if not path.lower().endswith(ext):
            path += ext
        return path

    def save_musicxml(self):
        """Open a Save dialog for the latest score as MusicXML. Returns path or ''."""
        try:
            with self._lock:
                score = self._latest_score
            if score is None:
                raise RuntimeError("Nothing to save yet — convert a link first.")
            path = self._ask_save_path(".musicxml", "MusicXML")
            if not path:
                return ""
            save_musicxml(score, path)
            return path
        except Exception as exc:
            traceback.print_exc()
            raise RuntimeError(str(exc)) from exc

    def save_pdf(self, png_data_urls):
        """Assemble a PDF from PNG pages the UI rasterized in the webview."""
        try:
            if not png_data_urls:
                raise RuntimeError("No pages to save.")
            png_pages = [_decode_png_data_url(u) for u in png_data_urls]
            path = self._ask_save_path(".pdf", "Sheet music PDF")
            if not path:
                return ""
            assemble_pdf_from_pngs(png_pages, path)
            return path
        except Exception as exc:
            traceback.print_exc()
            raise RuntimeError(str(exc)) from exc


def main():
    api = Api()
    window = webview.create_window(
        "Link To Notes",
        url=resource_path(os.path.join("desktop_ui", "index.html")),
        js_api=api,
        width=560,
        height=720,
        resizable=True,
    )
    api.attach_window(window)
    webview.start()


if __name__ == "__main__":
    main()
