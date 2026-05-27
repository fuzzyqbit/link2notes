"""YouTube link -> simplified alto-saxophone notes pipeline."""

import os
import tempfile

import imageio_ffmpeg
import yt_dlp
from music21 import interval, instrument, meter, note, stream, tempo

FFMPEG_PATH = imageio_ffmpeg.get_ffmpeg_exe()


SAX_LO_MIDI = 58       # written Bb3 (hard low)
SAX_HI_MIDI = 78       # written F#6 (hard high)
SAX_COMFORT_LO = 65    # written F4 (comfortable low)
SAX_COMFORT_HI = 80    # written G#5 (comfortable high)
SAX_FRIENDLY_SHARPS = {0, 1, 2, -1, -2}  # C, G, D, F, Bb majors/relatives


def _ensure_dir(path):
    if path:
        os.makedirs(path, exist_ok=True)


def download_audio(url, out_dir, progress=None):
    if progress:
        progress("Downloading audio...")

    _ensure_dir(out_dir)
    out_template = os.path.join(out_dir, "audio.%(ext)s")
    ydl_opts = {
        "format": "bestaudio/best",
        "outtmpl": out_template,
        "postprocessors": [{
            "key": "FFmpegExtractAudio",
            "preferredcodec": "wav",
        }],
        "quiet": True,
        "no_warnings": True,
        "noprogress": True,
        "ffmpeg_location": FFMPEG_PATH,
    }
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(url, download=True)
        title = info.get("title", "untitled")

    wav_path = os.path.join(out_dir, "audio.wav")
    if not os.path.exists(wav_path):
        for fname in os.listdir(out_dir):
            if fname.startswith("audio."):
                wav_path = os.path.join(out_dir, fname)
                break

    safe_title = "".join(c for c in title if c.isalnum() or c in " -_").strip() or "untitled"
    return wav_path, safe_title


_ONNX_MODEL = None


def _get_onnx_model():
    """Load and cache the ONNX basic_pitch model.

    Pinning to ONNX (instead of letting basic_pitch auto-pick CoreML on macOS)
    avoids a CoreML bug where the .mlpackage model returns NaN for some longer
    inputs. ONNX gives stable results on every platform.
    """
    global _ONNX_MODEL
    if _ONNX_MODEL is None:
        import basic_pitch
        from basic_pitch.inference import Model
        model_path = os.path.join(
            os.path.dirname(basic_pitch.__file__),
            "saved_models", "icassp_2022", "nmp.onnx",
        )
        _ONNX_MODEL = Model(model_path)
    return _ONNX_MODEL


def extract_midi(wav_path, progress=None):
    if progress:
        progress("Extracting notes from audio (first run downloads model)...")
    from basic_pitch.inference import predict
    _model_output, midi_data, note_events = predict(
        wav_path, model_or_model_path=_get_onnx_model()
    )
    return midi_data, note_events


def monophonic_filter(note_events, min_dur=0.06):
    """Reduce polyphonic events to a single melody line (top note wins on overlap)."""
    cleaned = []
    for ev in note_events:
        start, end, pitch = ev[0], ev[1], ev[2]
        if end - start < min_dur:
            continue
        cleaned.append([start, end, int(pitch)])

    cleaned.sort(key=lambda e: (e[0], -e[2]))
    result = []
    for start, end, pitch in cleaned:
        if not result:
            result.append([start, end, pitch])
            continue
        last = result[-1]
        if start >= last[1]:
            result.append([start, end, pitch])
        elif pitch > last[2]:
            last[1] = start
            if last[1] - last[0] < min_dur:
                result.pop()
            result.append([start, end, pitch])
    return result


def build_score(midi_data, mono_events, progress=None):
    if progress:
        progress("Building score...")

    try:
        bpm = float(midi_data.estimate_tempo())
        if not (40 < bpm < 240) or bpm != bpm:
            bpm = 120.0
    except Exception:
        bpm = 120.0

    score = stream.Score()
    part = stream.Part()
    part.insert(0, instrument.AltoSaxophone())
    part.insert(0, tempo.MetronomeMark(number=round(bpm)))
    part.insert(0, meter.TimeSignature("4/4"))

    qps = bpm / 60.0  # quarter notes per second
    for start, end, pitch in mono_events:
        ql = (end - start) * qps
        if ql < 0.125:
            continue
        snapped_ql = max(0.25, round(ql * 4) / 4)
        n = note.Note(pitch)
        n.quarterLength = snapped_ql
        offset = round(start * qps * 4) / 4
        part.insert(offset, n)

    score.append(part)
    return score


def fit_to_alto_sax(score, progress=None):
    """Transpose concert pitch -> alto-sax written, then re-key for playability."""
    if progress:
        progress("Transposing for alto saxophone...")

    written = score.transpose(interval.Interval("M6"))

    best = None
    for semitones in range(-12, 13):
        candidate = written.transpose(semitones)
        notes = [n for n in candidate.flatten().notes if n.isNote]
        if not notes:
            continue
        in_range = sum(1 for n in notes if SAX_LO_MIDI <= n.pitch.midi <= SAX_HI_MIDI)
        in_comfort = sum(1 for n in notes if SAX_COMFORT_LO <= n.pitch.midi <= SAX_COMFORT_HI)
        try:
            sharps = candidate.analyze("key").sharps
        except Exception:
            sharps = 7
        friendly = 1 if sharps in SAX_FRIENDLY_SHARPS else 0
        rank = (in_range, in_comfort, friendly, -abs(sharps), -abs(semitones))
        if best is None or rank > best[0]:
            best = (rank, candidate)

    fitted = best[1] if best else written

    for n in fitted.flatten().notes:
        if not n.isNote:
            continue
        # Hard-range fold first.
        while n.pitch.midi < SAX_LO_MIDI:
            n.transpose("P8", inPlace=True)
        while n.pitch.midi > SAX_HI_MIDI:
            n.transpose("-P8", inPlace=True)
        # Bias toward comfortable middle.
        while n.pitch.midi < SAX_COMFORT_LO and n.pitch.midi + 12 <= SAX_HI_MIDI:
            n.transpose("P8", inPlace=True)
        while n.pitch.midi > SAX_COMFORT_HI and n.pitch.midi - 12 >= SAX_LO_MIDI:
            n.transpose("-P8", inPlace=True)

    return fitted


def quantize_and_measure(score, progress=None):
    if progress:
        progress("Quantizing rhythm...")
    score.quantize([4, 2], processOffsets=True, processDurations=True, inPlace=True)
    score.makeMeasures(inPlace=True)
    return score


def score_to_letters(score, max_notes=200):
    letters = []
    for n in score.flatten().notes:
        if not n.isNote:
            continue
        letters.append(n.nameWithOctave)
        if len(letters) >= max_notes:
            letters.append("...")
            break
    return " ".join(letters) if letters else "(no notes detected)"


def simplify_score(score, target_bpm=70, min_quarter=2.0, dedupe_run_limit=2, max_notes=None, snap_to_scale=True):
    """Return a beginner-friendly version of the score.

    - Snaps pitches to detected key (or harmonic-minor for minor keys, so the
      leading tone like G# in A-minor survives). Kills random accidentals.
    - Quantizes durations to whole-quarter values (no fractions / 8ths).
    - Drops notes shorter than half a quarter.
    - Caps long runs of the same pitch.
    - Re-fits to alto-sax middle register.
    - Resets tempo to something practiceable.
    """
    from music21 import key as m21key, metadata as m21meta

    orig_notes = [n for n in score.flatten().notes if n.isNote]
    if not orig_notes:
        return score

    scale_pcs = None
    if snap_to_scale:
        try:
            detected = score.analyze("key")
        except Exception:
            detected = m21key.Key("C")
        scale_pcs = {p.pitchClass for p in detected.pitches}
        if detected.mode == "minor":
            # Add harmonic-minor leading tone (preserves the dramatic raised 7th).
            scale_pcs.add((detected.tonic.pitchClass + 11) % 12)

    new_score = stream.Score()
    part = stream.Part()
    part.insert(0, instrument.AltoSaxophone())
    part.insert(0, tempo.MetronomeMark(number=target_bpm))
    part.insert(0, meter.TimeSignature("4/4"))

    try:
        title = score.metadata.title if score.metadata else None
    except Exception:
        title = None
    if title:
        new_score.insert(0, m21meta.Metadata(title=title))

    prev_midi = None
    run_count = 0
    for n in orig_notes:
        ql = n.quarterLength
        if ql < 0.5:
            continue
        ql = max(min_quarter, float(round(ql)))

        chosen_pitch = n.pitch
        if scale_pcs is not None and chosen_pitch.pitchClass not in scale_pcs:
            for delta in (1, -1, 2, -2):
                if (chosen_pitch.pitchClass + delta) % 12 in scale_pcs:
                    chosen_pitch = chosen_pitch.transpose(delta)
                    break

        if prev_midi == chosen_pitch.midi:
            run_count += 1
            if run_count > dedupe_run_limit:
                if len(part.notes):
                    part.notes[-1].quarterLength += ql
                continue
        else:
            run_count = 0

        new_n = note.Note(chosen_pitch.nameWithOctave, quarterLength=ql)
        part.append(new_n)
        prev_midi = chosen_pitch.midi
        if max_notes and len(part.notes) >= max_notes:
            break

    new_score.append(part)
    new_score = fit_to_alto_sax(new_score)
    new_score.makeMeasures(inPlace=True)
    return new_score


def save_musicxml(score, path):
    score.write("musicxml", fp=path)


def assemble_pdf_from_pngs(png_byte_pages, pdf_path):
    """Write a Letter-sized multi-page PDF from a list of PNG-encoded pages.

    The desktop UI rasterizes verovio SVGs in the webview (via <canvas>) and
    sends the PNG bytes here for PDF assembly. This lets us use the OS's full
    SVG renderer (WKWebView / WebView2 / WebKitGTK) for fidelity while keeping
    a single cross-platform PDF writer (PyMuPDF).
    """
    import fitz  # PyMuPDF

    pdf_path = str(pdf_path)

    LETTER_W_PT, LETTER_H_PT = 612.0, 792.0
    MARGIN_PT = 36.0
    max_w = LETTER_W_PT - 2 * MARGIN_PT
    max_h = LETTER_H_PT - 2 * MARGIN_PT

    out_doc = fitz.open()
    for png_bytes in png_byte_pages:
        page_doc = fitz.open(stream=png_bytes, filetype="png")
        rect = page_doc[0].rect
        page_doc.close()

        scale = min(max_w / rect.width, max_h / rect.height)
        draw_w = rect.width * scale
        draw_h = rect.height * scale
        x = (LETTER_W_PT - draw_w) / 2
        y = MARGIN_PT

        page = out_doc.new_page(width=LETTER_W_PT, height=LETTER_H_PT)
        page.insert_image(fitz.Rect(x, y, x + draw_w, y + draw_h), stream=png_bytes)
    out_doc.save(pdf_path)
    out_doc.close()


def render_score_svg_pages(score):
    """Render score to a list of SVG strings (one per page) via verovio.

    Used by the desktop UI to preview real sheet music inside the webview and
    drive print-to-PDF via the OS print dialog — replaces the macOS-only
    qlmanage path and works on every platform.
    """
    import verovio

    with tempfile.NamedTemporaryFile(suffix=".musicxml", delete=False) as tmp:
        mxl_path = tmp.name
    try:
        score.write("musicxml", fp=mxl_path)
        tk = verovio.toolkit()
        tk.loadFile(mxl_path)
        tk.setOptions({
            "pageWidth": 2159,
            "pageHeight": 2794,
            "scale": 40,
            "footer": "none",
            "header": "auto",
            "adjustPageHeight": False,
            "spacingStaff": 8,
        })
        tk.redoLayout()
        return [tk.renderToSVG(i) for i in range(1, tk.getPageCount() + 1)]
    finally:
        try:
            os.unlink(mxl_path)
        except OSError:
            pass


def run_pipeline(url, progress=None):
    with tempfile.TemporaryDirectory() as tmp:
        wav_path, title = download_audio(url, tmp, progress)
        midi_data, note_events = extract_midi(wav_path, progress)

    mono = monophonic_filter(note_events)
    if not mono:
        raise RuntimeError("No notes detected in audio.")

    score = build_score(midi_data, mono, progress)
    score = fit_to_alto_sax(score, progress)
    score = quantize_and_measure(score, progress)

    if progress:
        progress("Simplifying for beginner...")
    score = simplify_score(score)

    letters = score_to_letters(score)
    return score, letters, title