// localStorage helper: persists the last-selected instrument across reloads.
// All operations are no-throw — persistence is an enhancement, never required.
// The UI must keep working even if storage is completely broken.
//
// Namespaced key: GitHub Pages serves multiple projects under one origin
// (username.github.io/*), and localStorage is per-origin, so a bare
// "instrument" key would collide with sibling apps. Prefix avoids that.

const KEY = "linkToNotes.instrument";

// MDN-canonical localStorage availability probe.
// Handles Safari private mode (setItem throws QuotaExceededError) and
// cookies-off browser settings (access throws) without leaking exceptions.
function storageAvailable() {
  try {
    const x = "__lt2n_test__";
    localStorage.setItem(x, x);
    localStorage.removeItem(x);
    return true;
  } catch {
    return false;
  }
}

// Returns the saved instrument id, or null if nothing saved / unreadable.
// Validation against INSTRUMENTS happens at the call site (main.js) so this
// module stays independent of the instruments registry.
export function loadInstrument() {
  if (!storageAvailable()) return null;
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

// Writes the id if storage is available; silently no-ops otherwise.
// Catches mid-session failures (quota exceeded, storage disabled by user
// between probe and write) so the change handler never throws into the UI.
export function saveInstrument(id) {
  if (!storageAvailable()) return;
  try {
    localStorage.setItem(KEY, id);
  } catch {
    // Quota exceeded or storage disabled mid-session — swallow.
  }
}
