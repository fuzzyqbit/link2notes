"use strict";

const $ = (id) => document.getElementById(id);

const linkInput = $("link");
const convertBtn = $("convert");
const statusEl = $("status");
const previewEl = $("preview");
const titleEl = $("songTitle");
const sheetEl = $("sheet");
const notesEl = $("notes");
const printBtn = $("printPdf");
const saveXmlBtn = $("saveXml");
const cancelBtn = $("cancel");

function setStatus(msg) {
  statusEl.textContent = msg || "";
}

window.linktonotes_progress = (msg) => setStatus(msg);

function renderSheet(svgs) {
  sheetEl.innerHTML = "";
  for (const svg of svgs) {
    const page = document.createElement("div");
    page.className = "page";
    page.innerHTML = svg;
    sheetEl.appendChild(page);
  }
}

async function onConvert() {
  const url = linkInput.value.trim();
  if (!url) {
    setStatus("Paste a YouTube link first.");
    return;
  }
  convertBtn.disabled = true;
  convertBtn.textContent = "Processing…";
  previewEl.classList.add("hidden");
  setStatus("Starting…");

  try {
    const result = await window.pywebview.api.convert(url);
    titleEl.textContent = result.title;
    notesEl.textContent = result.letters;
    renderSheet(result.svgs || []);
    previewEl.classList.remove("hidden");
    setStatus("Done.");
  } catch (err) {
    setStatus("");
    alert("Conversion failed:\n" + (err && err.message ? err.message : err));
  } finally {
    convertBtn.disabled = false;
    convertBtn.textContent = "Convert to notes";
  }
}

async function onSaveXml() {
  try {
    const path = await window.pywebview.api.save_musicxml();
    if (path) setStatus(`Saved: ${path}`);
  } catch (err) {
    alert("Save failed:\n" + (err && err.message ? err.message : err));
  }
}

// Rasterize one SVG string to a PNG data URL at the given pixel width.
function svgToPngDataUrl(svgString, pxWidth) {
  return new Promise((resolve, reject) => {
    const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const ratio = img.naturalHeight / img.naturalWidth || (1118 / 864);
      const canvas = document.createElement("canvas");
      canvas.width = pxWidth;
      canvas.height = Math.round(pxWidth * ratio);
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      try {
        resolve(canvas.toDataURL("image/png"));
      } catch (e) {
        reject(e);
      }
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(new Error("SVG failed to load into image"));
    };
    img.src = url;
  });
}

async function onSavePdf() {
  const pages = Array.from(sheetEl.querySelectorAll(".page svg"));
  if (!pages.length) {
    alert("Nothing to save yet.");
    return;
  }
  printBtn.disabled = true;
  setStatus("Rendering pages…");
  try {
    const dataUrls = [];
    for (let i = 0; i < pages.length; i++) {
      setStatus(`Rendering page ${i + 1} of ${pages.length}…`);
      const svgString = new XMLSerializer().serializeToString(pages[i]);
      // 2400px wide ≈ 300 DPI on US Letter (8" content area).
      const dataUrl = await svgToPngDataUrl(svgString, 2400);
      dataUrls.push(dataUrl);
    }
    setStatus("Saving PDF…");
    const path = await window.pywebview.api.save_pdf(dataUrls);
    setStatus(path ? `Saved: ${path}` : "");
  } catch (err) {
    setStatus("");
    alert("Save failed:\n" + (err && err.message ? err.message : err));
  } finally {
    printBtn.disabled = false;
  }
}

convertBtn.addEventListener("click", onConvert);
linkInput.addEventListener("keydown", (e) => { if (e.key === "Enter") onConvert(); });
printBtn.addEventListener("click", onSavePdf);
saveXmlBtn.addEventListener("click", onSaveXml);
cancelBtn.addEventListener("click", () => previewEl.classList.add("hidden"));
