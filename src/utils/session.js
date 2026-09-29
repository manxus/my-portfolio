/**
 * sessionStorage that never throws. With storage blocked (private modes,
 * "block all cookies") the bare API throws on access, and a throw in a render
 * path takes the whole app down.
 */
export function sessionGet(key) {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

export function sessionSet(key, value) {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

/** When this tab's visit began; falls back to "now" without storage. */
export function getSessionStart() {
  let start = sessionGet('bv_session_start');
  if (!start) {
    start = String(Date.now());
    sessionSet('bv_session_start', start);
  }
  return Number(start);
}
