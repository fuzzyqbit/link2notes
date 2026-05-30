// Node smoke test for web/storage.js.
// CommonJS file imports the ESM module via dynamic import().
// Hand-rolled localStorage stub on globalThis; each test may swap setItem/
// getItem/removeItem with throwing variants to exercise failure paths.
// No test framework — plain node:assert, mirrors Phase 1 musicxml smoke-test
// style. Exits non-zero on first failure; prints "OK <name>" per pass.

const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

// Fresh stub installer. Each test calls this to wipe state, then optionally
// patches setItem / getItem / removeItem to throw before running its assertions.
function installFreshStorage() {
  const store = new Map();
  globalThis.localStorage = {
    setItem(k, v) { store.set(String(k), String(v)); },
    getItem(k) { return store.has(String(k)) ? store.get(String(k)) : null; },
    removeItem(k) { store.delete(String(k)); },
    _store: store,
  };
}

function uninstallStorage() {
  delete globalThis.localStorage;
}

async function main() {
  const modulePath = path.join(__dirname, "storage.js");
  const moduleUrl = pathToFileURL(modulePath).href;
  const storage = await import(moduleUrl);

  // ---- Test 1: storageAvailable() returns true under a working stub ----
  // storageAvailable is not exported, so we exercise it via loadInstrument()
  // and saveInstrument() round-trip — if storageAvailable returned false,
  // loadInstrument would return null even after saveInstrument wrote.
  installFreshStorage();
  storage.saveInstrument("altoSax");
  assert.equal(storage.loadInstrument(), "altoSax", "round-trip should return saved value");
  console.log("OK test-1-storage-available-happy-path");

  // ---- Test 2: storageAvailable() returns false when setItem throws ----
  // Verified by observing that saveInstrument silently no-ops and a later
  // loadInstrument returns null (probe fails, both helpers bail).
  installFreshStorage();
  const realSet = globalThis.localStorage.setItem.bind(globalThis.localStorage);
  globalThis.localStorage.setItem = () => { throw new Error("QuotaExceededError"); };
  storage.saveInstrument("tenorSax"); // must not throw
  // restore setItem so the assertion-side getItem still works; loadInstrument
  // is called next and should hit storageAvailable() which calls setItem first
  // — so we keep the throwing version in place to verify the bail.
  assert.equal(storage.loadInstrument(), null, "loadInstrument returns null when probe throws");
  // Confirm nothing was written under the throwing stub.
  globalThis.localStorage.setItem = realSet;
  assert.equal(globalThis.localStorage.getItem("linkToNotes.instrument"), null, "no write occurred");
  console.log("OK test-2-storage-available-throw-on-setitem");

  // ---- Test 3: loadInstrument() returns null when storageAvailable() is false ----
  installFreshStorage();
  globalThis.localStorage.setItem = () => { throw new Error("no storage"); };
  assert.equal(storage.loadInstrument(), null, "loadInstrument null when probe fails");
  console.log("OK test-3-load-null-when-unavailable");

  // ---- Test 4: loadInstrument() returns saved string when getItem returns value ----
  installFreshStorage();
  globalThis.localStorage._store.set("linkToNotes.instrument", "tenorSax");
  assert.equal(storage.loadInstrument(), "tenorSax", "loadInstrument returns saved value");
  console.log("OK test-4-load-returns-saved-value");

  // ---- Test 5: loadInstrument() returns null when getItem throws ----
  installFreshStorage();
  // probe must succeed (setItem/removeItem fine); only getItem throws.
  globalThis.localStorage.getItem = () => { throw new Error("getItem broke"); };
  assert.equal(storage.loadInstrument(), null, "loadInstrument null when getItem throws");
  console.log("OK test-5-load-null-when-getitem-throws");

  // ---- Test 6: saveInstrument writes under namespaced key ----
  installFreshStorage();
  storage.saveInstrument("tenorSax");
  assert.equal(
    globalThis.localStorage.getItem("linkToNotes.instrument"),
    "tenorSax",
    "save writes under linkToNotes.instrument key",
  );
  // Confirm the bare "instrument" key was NOT written.
  assert.equal(globalThis.localStorage.getItem("instrument"), null, "no bare 'instrument' key");
  console.log("OK test-6-save-uses-namespaced-key");

  // ---- Test 7: saveInstrument() silently no-ops when storage unavailable ----
  installFreshStorage();
  globalThis.localStorage.setItem = () => { throw new Error("unavailable"); };
  let threw = false;
  try { storage.saveInstrument("flute"); } catch { threw = true; }
  assert.equal(threw, false, "saveInstrument did not throw when storage unavailable");
  console.log("OK test-7-save-noops-when-unavailable");

  // ---- Test 8: saveInstrument() silently catches QuotaExceededError ----
  // This is the mid-session quota-exceeded case: probe succeeded earlier but a
  // subsequent write throws (e.g. user filled storage in another tab). Our
  // implementation calls storageAvailable() per-call so it would also bail at
  // the probe, but we still verify a direct write-throw doesn't leak.
  installFreshStorage();
  let probeCalled = false;
  const realSet8 = globalThis.localStorage.setItem.bind(globalThis.localStorage);
  globalThis.localStorage.setItem = (k, v) => {
    // First call is the probe ("__lt2n_test__"); allow it. Subsequent call
    // (the real save) throws QuotaExceededError.
    if (!probeCalled && k === "__lt2n_test__") {
      probeCalled = true;
      return realSet8(k, v);
    }
    const err = new Error("QuotaExceededError");
    err.name = "QuotaExceededError";
    throw err;
  };
  threw = false;
  try { storage.saveInstrument("bariSax"); } catch { threw = true; }
  assert.equal(threw, false, "saveInstrument silently caught QuotaExceededError");
  console.log("OK test-8-save-catches-quota-exceeded");

  uninstallStorage();
  console.log("\nAll 8 tests passed.");
}

main().catch((err) => {
  console.error("FAIL:", err);
  process.exit(1);
});
