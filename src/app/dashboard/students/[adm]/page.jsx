"use client";

import { useEffect, useState } from "react";
import Link from "@/components/transition/TransitionLink";
import { useParams } from "next/navigation";
import { useSchoolData } from "@/context/SchoolDataContext";
import { RANGES, useStudentHistory } from "@/lib/studentHistory";
import { fetchLeaveHistory } from "@/lib/leave";
import { statusLabel } from "@/domain/status";
import { fmtDay, fmtTime } from "@/utils/format";
import { Chip, Empty, ErrorPanel, Icon, PageHead, Segmented, Skeleton } from "@/components/dash/ui";

const TYPE_LABEL = { R: "Residential", D: "Day scholar", V: "Vedic", B: "Day boarding" };

/** One student's record: who they are, where they are, and their checkpoints. */
export default function StudentPage() {
  const { adm } = useParams();
  const admission = decodeURIComponent(adm);
  const { students, loading, openLeaves } = useSchoolData();
  const [days, setDays] = useState(30);
  const history = useStudentHistory(admission, days);
  const [leaves, setLeaves] = useState(null);

  useEffect(() => {
    fetchLeaveHistory(admission).then(setLeaves, () => setLeaves([]));
  }, [admission]);

  const s = students.find((x) => String(x.adm) === admission);
  if (loading && !s) return <div className="panel"><Skeleton rows={6} /></div>;
  if (!s) {
    return (
      <div className="panel">
        <Empty title="Student not found" action={<Link className="btn btn-ghost" href="/dashboard/students">Back to students</Link>}>
          They may have left the register, or are outside the classes you can see.
        </Empty>
      </div>
    );
  }

  const leave = openLeaves[s.adm];
  const sum = history.summary;
  // Most recent first, grouped by day.
  const byDay = new Map();
  [...history.marks].sort((a, b) => b.day.localeCompare(a.day) || b.start_min - a.start_min).forEach((m) => {
    if (!byDay.has(m.day)) byDay.set(m.day, []);
    byDay.get(m.day).push(m);
  });

  return (
    <>
      <PageHead eyebrow={`Class ${s.label} · Adm ${s.adm}`} title={s.name}>
        <Link href="/dashboard/students" className="btn btn-ghost"><Icon name="left" size={18} />All students</Link>
      </PageHead>

      <div className="grid-2">
        <div>
          <section className="figures" style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
            <div className="figure is-ok">
              <p className="figure-label">Present</p>
              <p className="figure-value">{sum ? `${Math.round(Number(sum.pct_present) || 0)}` : "—"}<small>%</small></p>
              <p className="figure-foot">{sum ? `${sum.present} of ${sum.checkpoints} checkpoints` : "No marks yet"}</p>
            </div>
            <div className={`figure${sum?.absent ? " is-bad" : ""}`}>
              <p className="figure-label">Absent</p>
              <p className="figure-value">{sum ? sum.absent : "—"}</p>
              <p className="figure-foot">Unaccounted for</p>
            </div>
            <div className="figure">
              <p className="figure-label">Elsewhere</p>
              <p className="figure-value">{sum ? sum.elsewhere : "—"}</p>
              <p className="figure-foot">Home, sick, activity…</p>
            </div>
          </section>

          <section className="panel">
            <div className="panel-head">
              <h2 className="panel-title">Checkpoints</h2>
              <Segmented label="Range" value={days} onChange={setDays} options={RANGES.map((r) => ({ value: r.key, label: r.label }))} />
            </div>
            {history.error ? <ErrorPanel message={history.error} /> : history.loading ? <Skeleton rows={6} /> : byDay.size === 0 ? (
              <Empty>No submitted checkpoints for this student in the last {days} days.</Empty>
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>Day</th><th>Checkpoint</th><th>Status</th><th>Marked by</th></tr></thead>
                  <tbody>
                    {[...byDay.entries()].flatMap(([day, marks]) =>
                      marks.map((m, i) => (
                        <tr key={`${day}-${m.checkpoint}-${i}`}>
                          <td className={i ? "cell-sub" : "cell-main"}>{i ? "" : fmtDay(day)}</td>
                          <td>{m.checkpoint}<span className="cell-sub"> · {fmtTime(m.start_min)}</span></td>
                          <td>{m.present ? <Chip tone="ok" plain>Present</Chip> : <Chip tone={m.accounted ? "quiet" : "bad"}>{m.status_label || statusLabel(m.status)}</Chip>}</td>
                          <td className="cell-sub">{m.marked_by || "—"}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

        <aside className="stack">
          <section className="panel panel-pad">
            <h2 className="panel-title" style={{ marginBottom: 14 }}>Details</h2>
            <dl className="kv">
              <dt>Class</dt><dd>{s.label}</dd>
              <dt>Roll</dt><dd>{s.roll ?? "—"}</dd>
              <dt>Type</dt><dd>{TYPE_LABEL[s.type] || "—"}</dd>
              <dt>House</dt><dd>{s.house || "—"}</dd>
              <dt>Remedial</dt><dd>{s.remedial ? "Yes" : "No"}</dd>
              <dt>Now</dt><dd>{leave ? `${statusLabel(leave.status)} since ${fmtDay(leave.outDay)}` : "On campus"}</dd>
            </dl>
          </section>
          <section className="panel">
            <div className="panel-head"><h2 className="panel-title">Gate history</h2></div>
            {leaves === null ? <Skeleton rows={3} /> : leaves.length === 0 ? <Empty>Never signed out at the gate.</Empty> : (
              <ul className="rowlist">
                {leaves.map((l) => (
                  <li key={l.id} className="row-link" style={{ display: "block" }}>
                    <span className="cell-main">{statusLabel(l.status)} · {fmtDay(l.outDay)}{l.backDay ? ` → ${fmtDay(l.backDay)}` : ""}</span>
                    <span className="cell-sub" style={{ display: "block" }}>{l.reason || "No reason recorded"}{l.open ? " · still away" : ""}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </>
  );
}
