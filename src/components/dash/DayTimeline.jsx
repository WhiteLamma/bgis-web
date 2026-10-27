"use client";

import Link from "@/components/transition/TransitionLink";
import { DUTY_STATUS } from "@/domain/duties";
import { fmtTime } from "@/utils/format";
import { byCheckpoint } from "./duty";

const ORDER = [DUTY_STATUS.DONE, DUTY_STATUS.DUE, DUTY_STATUS.OVERDUE, DUTY_STATUS.UPCOMING];
const BAR = { done: "ok", due: "wait", overdue: "bad", upcoming: "todo" };

/**
 * The school day as a strip: each checkpoint drawn across its own time
 * window, split by how many of its groups are submitted, due, overdue or not
 * yet open. A red line marks the present minute. Each bar opens that
 * checkpoint's duties.
 */
export default function DayTimeline({ duties, now, isToday }) {
  const rows = byCheckpoint(duties);
  if (!rows.length) return null;

  // Whole hours either side of the day's checkpoints.
  const from = Math.floor(Math.min(...rows.map((r) => r.start)) / 60) * 60;
  const to = Math.ceil(Math.max(...rows.map((r) => r.end)) / 60) * 60;
  const span = Math.max(60, to - from);
  const pct = (m) => `${((m - from) / span) * 100}%`;
  const step = span > 12 * 60 ? 180 : 120;
  const ticks = [];
  for (let m = from; m <= to; m += step) ticks.push(m);
  const showNow = isToday && now >= from && now <= to;

  return (
    <div className="timeline">
      <div className="tl-scale" aria-hidden="true">
        {ticks.map((m) => (
          <span key={m} style={{ left: pct(m) }}>{fmtTime(m).replace(":00", "")}</span>
        ))}
      </div>
      {rows.map((r, i) => {
        const counts = Object.fromEntries(ORDER.map((s) => [s, r.duties.filter((d) => d.status === s).length]));
        return (
          <div className="tl-row" key={r.id}>
            <div className="tl-name" title={r.name}>
              {r.name}
              <small>{counts.done} of {r.duties.length} done</small>
            </div>
            <div className="tl-track">
              {showNow && (
                <span className="tl-now" style={{ left: pct(now) }}>
                  {i === 0 && <span>Now {fmtTime(now)}</span>}
                </span>
              )}
              <Link
                href={`/dashboard/duties?checkpoint=${encodeURIComponent(r.id)}`}
                className="tl-bar"
                style={{ left: pct(r.start), width: `max(10px, calc(${pct(r.end)} - ${pct(r.start)}))` }}
                title={`${r.name}, ${fmtTime(r.start)} to ${fmtTime(r.end)}: ${counts.done} of ${r.duties.length} submitted`}
                aria-label={`${r.name}, ${fmtTime(r.start)} to ${fmtTime(r.end)}: ${counts.done} of ${r.duties.length} groups submitted`}
              >
                {ORDER.map((s) => counts[s] > 0 && <i key={s} className={BAR[s]} style={{ flex: counts[s] }} />)}
              </Link>
              {/* The window in words beside its bar; before it when the bar is near the right edge. */}
              {(r.end - from) / span < 0.75 ? (
                <span className="tl-time" style={{ left: pct(r.end) }} aria-hidden="true">{fmtTime(r.start)} to {fmtTime(r.end)}</span>
              ) : (
                <span className="tl-time before" style={{ left: pct(r.start) }} aria-hidden="true">{fmtTime(r.start)} to {fmtTime(r.end)}</span>
              )}
            </div>
          </div>
        );
      })}
      <div className="tl-legend">
        <span><i style={{ background: "var(--accent)" }} />Submitted</span>
        <span><i style={{ background: "#c99a2e" }} />Open now</span>
        <span><i style={{ background: "var(--negative)" }} />Overdue</span>
        <span><i style={{ background: "var(--panel-strong)", boxShadow: "inset 0 0 0 1.5px var(--control)" }} />Not open yet</span>
      </div>
    </div>
  );
}
