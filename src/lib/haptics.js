/**
 * Vibration on the web, matching the mobile app's haptics (gurukul
 * src/lib/haptics.js): a firm pulse when a child is marked Absent, a lighter
 * one when that is undone, a double pulse when a register is submitted, and
 * a warning pattern before something that raises an alert. Every button and
 * page change gives a very short tick, so the phone feels like an app.
 *
 * Uses navigator.vibrate, which Android phones support. iPhones and desktops
 * ignore it, so every call is safe to make anywhere.
 *
 * Switchable from Account, for the same reason as in the app: Mangalarati is
 * at 4:30 AM in a dormitory, and forty buzzes near sleeping children is a
 * problem. Saved per device.
 */

const STORAGE_KEY = "bgsaar.haptics";
let enabled = true;
let loaded = false;

const load = () => {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved !== null) enabled = saved === "on";
  } catch {
    // Storage blocked: keep the default.
  }
};

export const hapticsSupported = () => typeof navigator !== "undefined" && typeof navigator.vibrate === "function";

export const isHapticsEnabled = () => {
  load();
  return enabled;
};

export function setHapticsEnabled(value) {
  enabled = !!value;
  loaded = true;
  try {
    localStorage.setItem(STORAGE_KEY, enabled ? "on" : "off");
  } catch {
    // The in-memory value still applies for this tab.
  }
}

const fire = (pattern) => {
  load();
  if (!enabled || !hapticsSupported()) return;
  try {
    navigator.vibrate(pattern);
  } catch {
    // No motor, or the browser declined: never interrupt the person.
  }
};

export const haptics = {
  /** A button pressed or a page opened: barely there. */
  tap: () => fire(8),
  /** A status chosen for a child. */
  select: () => fire(12),
  /** Marked Absent — the one status meaning "unaccounted for". */
  markAbsent: () => fire(35),
  /** An Absent mark undone. Lighter, so the two are told apart by feel. */
  undoAbsent: () => fire(10),
  /** Submitted and saved. */
  success: () => fire([18, 70, 28]),
  /** A confirmation about to raise an alert, or a destructive step. */
  warn: () => fire([40, 60, 40]),
  /** Something failed. */
  error: () => fire([70, 50, 70, 50, 70]),
};
