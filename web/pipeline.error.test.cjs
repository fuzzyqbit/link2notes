// Smoke test for ModelLoadError + the reset-on-progress watchdog scaffolding
// in pipeline.js. We deliberately do NOT exercise the live model load — there
// is no audioBuffer here, and the basic-pitch CDN import would not resolve in
// Node anyway. Browser-level verification is the Task 2 checkpoint.
//
// We assert two things:
//   1. Source-level invariants of pipeline.js (greppable structure) — these are
//      what main.js depends on at runtime.
//   2. Behavioral invariants of the ModelLoadError class itself, by extracting
//      and re-evaluating just the class declaration via `new Function(...)`.
//      The class has no external dependencies, so this is safe.
//
// Exits 0 on success, non-zero on first failure.

"use strict";

const fs = require("fs");
const path = require("path");

const PIPELINE_PATH = path.join(__dirname, "pipeline.js");
const SRC = fs.readFileSync(PIPELINE_PATH, "utf8");

let failed = 0;
function ok(name) {
  console.log("OK " + name);
}
function fail(name, detail) {
  console.error("FAIL " + name + (detail ? " — " + detail : ""));
  failed += 1;
}
function assert(name, cond, detail) {
  if (cond) ok(name); else fail(name, detail);
}

// ---------------------------------------------------------------------------
// Source-level invariants
// ---------------------------------------------------------------------------

assert(
  "pipeline.js declares export class ModelLoadError",
  /export\s+class\s+ModelLoadError\s+extends\s+Error\b/.test(SRC),
  "expected `export class ModelLoadError extends Error` in pipeline.js",
);

assert(
  "pipeline.js defines MODEL_TIMEOUT_MS = 20000",
  /MODEL_TIMEOUT_MS\s*=\s*20000\b/.test(SRC),
  "expected `MODEL_TIMEOUT_MS = 20000` literal in pipeline.js",
);

assert(
  "pipeline.js wraps inference in Promise.race",
  /Promise\.race\s*\(/.test(SRC),
  "expected Promise.race(...) call in pipeline.js",
);

assert(
  "pipeline.js sets lastTickAt at init and in the percent callback",
  (SRC.match(/lastTickAt\s*=\s*Date\.now\(\)/g) || []).length >= 2,
  "expected `lastTickAt = Date.now()` to appear at least twice",
);

assert(
  "pipeline.js calls clearInterval to clean up the watchdog",
  /clearInterval\s*\(/.test(SRC),
  "expected clearInterval(...) call in pipeline.js",
);

assert(
  "pipeline.js re-throws fetch failures as ModelLoadError",
  /throw\s+new\s+ModelLoadError\b/.test(SRC),
  "expected `throw new ModelLoadError(...)` in pipeline.js",
);

// Strip comments before checking for the user-facing copy so that a stray
// occurrence in a `//` or `/* */` line doesn't mask whether the live string
// is present in real code.
const noLineComments = SRC.replace(/^\s*\/\/.*$/gm, "");
const noBlockComments = noLineComments.replace(/\/\*[\s\S]*?\*\//g, "");
assert(
  "pipeline.js contains user-facing copy `couldn't load the transcription model` in non-comment code",
  noBlockComments.includes("couldn't load the transcription model"),
  "expected the canonical user-facing phrase in code (not just a comment)",
);

assert(
  "pipeline.js error copy names Chrome",
  /\bChrome\b/.test(SRC),
  "expected Chrome named in the error copy",
);
assert(
  "pipeline.js error copy names Edge",
  /\bEdge\b/.test(SRC),
  "expected Edge named in the error copy",
);
assert(
  "pipeline.js error copy names Firefox",
  /\bFirefox\b/.test(SRC),
  "expected Firefox named in the error copy",
);
assert(
  "pipeline.js error copy mentions desktop or laptop",
  /\b(desktop|laptop)\b/.test(SRC),
  "expected `desktop` or `laptop` named in the error copy",
);

assert(
  "pipeline.js extractNotes is still exported",
  /export\s+async\s+function\s+extractNotes\b/.test(SRC),
  "expected extractNotes to remain exported (no signature drift)",
);

// ---------------------------------------------------------------------------
// Behavioral invariants of ModelLoadError
// ---------------------------------------------------------------------------
//
// Re-create the class in a sandbox by evaluating just its declaration. The
// class body has no external references, so this is safe.

const classMatch = SRC.match(
  /export\s+(class\s+ModelLoadError\s+extends\s+Error\s*\{[\s\S]*?\n\})/,
);
if (!classMatch) {
  fail(
    "ModelLoadError class declaration is extractable from pipeline.js",
    "could not regex-match the class block",
  );
} else {
  ok("ModelLoadError class declaration is extractable from pipeline.js");
  // `new Function(...)` lets us evaluate the class declaration without
  // wrapping it in a module — it returns the class constructor.
  const make = new Function(classMatch[1] + "\nreturn ModelLoadError;");
  const ModelLoadError = make();

  const e = new ModelLoadError("test message");

  assert(
    "ModelLoadError instances are instances of Error",
    e instanceof Error,
    "expected `new ModelLoadError(...) instanceof Error` to be true",
  );
  assert(
    "ModelLoadError instances are instances of ModelLoadError",
    e instanceof ModelLoadError,
    "expected `new ModelLoadError(...) instanceof ModelLoadError` to be true",
  );
  assert(
    "ModelLoadError.name is 'ModelLoadError'",
    e.name === "ModelLoadError",
    "expected e.name === 'ModelLoadError', got: " + e.name,
  );
  assert(
    "ModelLoadError preserves the constructor message",
    e.message === "test message",
    "expected e.message === 'test message', got: " + e.message,
  );
}

// ---------------------------------------------------------------------------
// Done
// ---------------------------------------------------------------------------

if (failed > 0) {
  console.error("\n" + failed + " test(s) failed");
  process.exit(1);
} else {
  console.log("\nAll tests passed");
  process.exit(0);
}
