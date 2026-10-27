import { DUTY_STATUS } from "@/domain/duties";

/** How each computed duty status reads on the web: chip tone and label. */
export const STATUS_UI = {
  [DUTY_STATUS.DONE]: { tone: "ok", label: "Submitted", bar: "ok" },
  [DUTY_STATUS.OVERDUE]: { tone: "bad", label: "Overdue", bar: "bad" },
  [DUTY_STATUS.DUE]: { tone: "wait", label: "Due now", bar: "wait" },
  [DUTY_STATUS.UPCOMING]: { tone: "quiet", label: "Upcoming", bar: "todo" },
};

/**
 * Duties grouped by checkpoint, in the day's order: one row per checkpoint
 * with how many of its groups sit in each status. The timeline and the
 * "by checkpoint" views both read this.
 */
export function byCheckpoint(duties) {
  const map = new Map();
  for (const d of duties) {
    const key = d.checkpointId || d.checkpoint;
    if (!map.has(key)) map.set(key, { id: key, name: d.checkpoint, start: d.start, end: d.end, duties: [] });
    const row = map.get(key);
    row.start = Math.min(row.start, d.start);
    row.end = Math.max(row.end, d.end);
    row.duties.push(d);
  }
  return [...map.values()].sort((a, b) => a.start - b.start);
}
