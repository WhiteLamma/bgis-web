/**
 * Attendance status codes, as the app's `STATUS_META` / `SPANNING` in
 * gurukul/src/data/mockData.js. Present has no code: it is stored as a null
 * status, the absence of an entry.
 */
export const STATUS_META = {
  // Absent is the only unaccounted-for state, so it is the only loud one.
  A: { label: "Absent", short: "Abs" },
  H: { label: "Home", short: "Home" },
  S: { label: "Sick", short: "Sick" },
  V: { label: "Activity", short: "Act" },
  O: { label: "Outing", short: "Out" },
  G: { label: "Gita Nagari", short: "GN" },
  Y: { label: "Self study", short: "Self" },
};

/** Statuses that carry over to every later checkpoint until cleared. */
export const SPANNING = ["H", "S", "O", "G"];

export const statusLabel = (code) => (code ? STATUS_META[code]?.label || code : "Present");
