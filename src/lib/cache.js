/**
 * A small read cache, so the dashboard asks the school's database for
 * things only when they can have changed.
 *
 * What it does:
 *  - keeps each answer in memory for `ttl` ms, so moving between pages, or
 *    switching back to the tab, does not re-download it;
 *  - with `persist`, also keeps it in localStorage, so a reload or a new tab
 *    starts from the saved copy instead of fetching the 413-student register
 *    again (only for data that changes rarely: the register, the staff list);
 *  - merges identical requests made at the same moment into one;
 *  - is scoped to the signed-in account and wiped on sign-out, so one
 *    person's data is never shown to the next person on a shared computer.
 *
 * Writes never go through here. After a write, the caller invalidates the
 * keys it touched so the next read is fresh.
 */

const PREFIX = "bgsaar.cache.v1:";
const mem = new Map(); // key -> { at, value }
const inflight = new Map(); // key -> Promise
let scope = "anon";

export const MINUTE = 60 * 1000;
export const HOUR = 60 * MINUTE;

/** Called by AuthContext when the signed-in account changes. */
export function setCacheScope(userKey) {
  const next = userKey || "anon";
  if (next !== scope) mem.clear();
  scope = next;
}

const fullKey = (key) => `${scope}:${key}`;

const readStored = (key) => {
  try {
    const raw = localStorage.getItem(PREFIX + fullKey(key));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const writeStored = (key, entry) => {
  try {
    localStorage.setItem(PREFIX + fullKey(key), JSON.stringify(entry));
  } catch {
    // Storage full or blocked: the memory copy still works for this tab.
  }
};

/**
 * The cached value for `key` if it is younger than `ttl`, otherwise the
 * result of `fetcher()` (which is then cached). `force` skips the cache.
 */
export async function cached(key, ttl, fetcher, { persist = false, force = false } = {}) {
  const k = fullKey(key);
  const now = Date.now();
  if (!force) {
    const hit = mem.get(k);
    if (hit && now - hit.at < ttl) return hit.value;
    if (persist) {
      const stored = readStored(key);
      if (stored && now - stored.at < ttl) {
        mem.set(k, stored);
        return stored.value;
      }
    }
    if (inflight.has(k)) return inflight.get(k);
  }
  const p = (async () => {
    try {
      const value = await fetcher();
      const entry = { at: Date.now(), value };
      mem.set(k, entry);
      if (persist) writeStored(key, entry);
      return value;
    } finally {
      inflight.delete(k);
    }
  })();
  inflight.set(k, p);
  return p;
}

/** How old the cached copy of `key` is, in ms, or null when there is none. */
export function cacheAge(key) {
  const hit = mem.get(fullKey(key));
  return hit ? Date.now() - hit.at : null;
}

/** Drop every cached key that starts with `prefix` (or exactly matches it). */
export function invalidate(prefix) {
  const p = fullKey(prefix);
  for (const k of [...mem.keys()]) if (k.startsWith(p)) mem.delete(k);
  try {
    for (let i = localStorage.length - 1; i >= 0; i -= 1) {
      const k = localStorage.key(i);
      if (k && k.startsWith(PREFIX + p)) localStorage.removeItem(k);
    }
  } catch {
    // ignore
  }
}

/** Forget everything — on sign-out. */
export function clearCache() {
  mem.clear();
  inflight.clear();
  try {
    for (let i = localStorage.length - 1; i >= 0; i -= 1) {
      const k = localStorage.key(i);
      if (k && k.startsWith(PREFIX)) localStorage.removeItem(k);
    }
  } catch {
    // ignore
  }
  scope = "anon";
}
