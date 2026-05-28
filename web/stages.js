// Pipeline stage enum + ordering + human-readable labels.
//
// Used by pipeline.js (emits `progress({stage, label, percent?})` events) and
// main.js (renders a four-item stage indicator that lights up the active step).
//
// STAGE values are stable kebab-case strings so they can also appear as
// `data-stage` attributes in the DOM without translation.

export const STAGE = Object.freeze({
  DECODING:      "decoding",
  MODEL_LOADING: "model-loading",
  TRANSCRIBING:  "transcribing",
  RENDERING:     "rendering",
});

export const STAGE_ORDER = Object.freeze([
  STAGE.DECODING,
  STAGE.MODEL_LOADING,
  STAGE.TRANSCRIBING,
  STAGE.RENDERING,
]);

export const STAGE_LABELS = Object.freeze({
  [STAGE.DECODING]:      "Decoding audio",
  [STAGE.MODEL_LOADING]: "Loading model (first run only)",
  [STAGE.TRANSCRIBING]:  "Transcribing notes",
  [STAGE.RENDERING]:     "Rendering score",
});
