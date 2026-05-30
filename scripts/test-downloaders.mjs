// Node smoke test for web/downloaders.js.
// Locks down the cobalt prefill URL format + DOWNLOADERS/PRIMARY contract.
// No test framework — plain node:assert, mirrors web/storage.test.cjs style.
// Exits non-zero on first failure; prints "OK <name>" per pass.
//
// Plan 03-01 (YT-01, YT-03). If anyone "fixes" the encoding incorrectly or
// reorders DOWNLOADERS, this test fails loudly.

import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const modulePath = path.join(__dirname, "..", "web", "downloaders.js");
  const moduleUrl = pathToFileURL(modulePath).href;
  const { DOWNLOADERS, PRIMARY } = await import(moduleUrl);

  // ---- Test 1: PRIMARY.urlFor returns the exact documented cobalt prefill format ----
  // Hash fragment, fully URL-encoded. This is the contract from cobalt's web/README.
  // If cobalt changes its prefill syntax, or if someone substitutes a query string,
  // this test fails — forcing a deliberate update.
  const ytUrl = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
  const expected = "https://cobalt.meowing.de/#https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3DdQw4w9WgXcQ";
  assert.equal(
    PRIMARY.urlFor(ytUrl),
    expected,
    "PRIMARY.urlFor produces the documented cobalt hash-fragment prefill URL",
  );
  console.log("OK test-1-cobalt-prefill-format-locked");

  // ---- Test 2: PRIMARY.id starts with "cobalt" ----
  // Guards against silently flipping the primary by reordering the DOWNLOADERS
  // array. We allow any cobalt-family instance (cobalt, cobalt-meowing, etc.)
  // since main cobalt.tools and community instances share the same prefill
  // protocol — see DOWNLOADERS.md for rotation history.
  assert.ok(
    PRIMARY.id.startsWith("cobalt"),
    `PRIMARY.id starts with "cobalt" (was ${PRIMARY.id})`,
  );
  console.log("OK test-2-primary-id-is-cobalt-family");

  // ---- Test 3: Every DOWNLOADERS entry has all required fields ----
  // Required: id, name, urlFor (function), landingUrl, lastVerified (ISO date).
  // The ISO date pattern ^\d{4}-\d{2}-\d{2}$ enforces "no half-checked alternates"
  // per YT-03 — every shipped entry carries a real verification stamp.
  const isoDate = /^\d{4}-\d{2}-\d{2}$/;
  assert.ok(Array.isArray(DOWNLOADERS), "DOWNLOADERS is an array");
  assert.ok(DOWNLOADERS.length >= 1, "DOWNLOADERS has at least one entry");
  for (const d of DOWNLOADERS) {
    assert.equal(typeof d.id, "string", `entry ${d?.id ?? "?"} has string id`);
    assert.ok(d.id.length > 0, `entry ${d.id} id is non-empty`);
    assert.equal(typeof d.name, "string", `entry ${d.id} has string name`);
    assert.ok(d.name.length > 0, `entry ${d.id} name is non-empty`);
    assert.equal(typeof d.urlFor, "function", `entry ${d.id} has urlFor function`);
    assert.equal(typeof d.landingUrl, "string", `entry ${d.id} has string landingUrl`);
    assert.ok(d.landingUrl.startsWith("http"), `entry ${d.id} landingUrl is an http(s) URL`);
    assert.equal(typeof d.lastVerified, "string", `entry ${d.id} has string lastVerified`);
    assert.match(
      d.lastVerified,
      isoDate,
      `entry ${d.id} lastVerified is ISO date (YYYY-MM-DD)`,
    );
  }
  console.log("OK test-3-all-entries-have-required-fields-and-iso-date");

  // ---- Test 4: DOWNLOADERS[0] === PRIMARY ----
  // Array head IS the primary; this prevents PRIMARY from becoming a stale
  // reference to a removed entry after a list edit.
  assert.equal(
    DOWNLOADERS[0],
    PRIMARY,
    "DOWNLOADERS[0] is the same object reference as PRIMARY",
  );
  console.log("OK test-4-primary-is-array-head");

  console.log("\nAll 4 tests passed.");
}

main().catch((err) => {
  console.error("FAIL:", err);
  process.exit(1);
});
