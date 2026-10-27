"use client";

import { Suspense, useMemo, useState } from "react";
import ReassignDialog from "@/components/dash/ReassignDialog";
import { useSearchParams } from "next/navigation";
import { useTransitionRouter as useRouter } from "@/components/transition/PageTransition";
import { useAuth } from "@/context/AuthContext";
import { useSchoolData } from "@/context/SchoolDataContext";
import { DUTY_STATUS, dutyStatus, summarise } from "@/domain/duties";
import { canReassign, defaultsToOwnDuties } from "@/domain/roles";
import { useNow } from "@/lib/clock";
import { fmtDay, fmtTime, plural } from "@/utils/format";
import { Chip, DayPicker, Empty, ErrorPanel, Icon, PageHead, Segmented, Skeleton, useFeedback } from "@/components/dash/ui";
import { STATUS_UI, byCheckpoint } from "@/components/dash/duty";

const STATUS_RANK = { overdue: 0, due: 1, upcoming: 2, done: 3 };

function DutiesView() {
  const { user } = useAuth();
  const { duties, records, loading, error, refresh, day, setDay, isToday, studentsForDuty, staff, staffName, reassignDuty } = useSchoolData();
  const now = useNow();
  const router = useRouter();
  const params = useSearchParams();
  const feedback = useFeedback();

  const [scope, setScope] = useState(defaultsToOwnDuties(user.role) ? "mine" : "all");
  const [status, setStatus] = useState("all");
  const checkpoint = params.get("checkpoint") || "all";
  const setCheckpoint = (v) => router.replace(v === "all" ? "/dashboard/duties" : `/dashboard/duties?checkpoint=${encodeURIComponent(v)}`);

  const withStatus = useMemo(
    () => duties.map((d) => ({ ...d, status: dutyStatus(d, records, isToday ? now : 24 * 60) })),
    [duties, records, now, isToday]
  );
  const checkpoints = useMemo(() => byCheckpoint(duties), [duties]);

  const visible = withStatus
    .filter((d) => scope === "all" || d.staffId === user.id)
    .filter((d) => checkpoint === "all" || (d.checkpointId || d.checkpoint) === checkpoint)
    .filter((d) => status === "all" || d.status === status)
    .sort((a, b) => a.start - b.start || STATUS_RANK[a.status] - STATUS_RANK[b.status] || a.group.localeCompare(b.group, undefined, { numeric: true }));

  const mineCount = withStatus.filter((d) => d.staffId === user.id).length;

  // The duty being given to someone else, or null.
  const [reassigning, setReassigning] = useState(null);
  const reassign = (duty) => setReassigning(duty);

  return (
    <>
      <ReassignDialog
        duty={reassigning}
        staff={staff}
        staffName={staffName}
        onReassign={reassignDuty}
        onClose={() => setReassigning(null)}
        onDone={feedback.toast}
      />
      <PageHead eyebrow={fmtDay(day) === "Today" ? "Today" : fmtDay(day)} title="Duties" lede="Every checkpoint and the class or group it covers. Press a row to open its register.">
        <DayPicker day={day} onChange={setDay} />
      </PageHead>

      <section className="panel">
        <div className="toolbar">
          <Segmented
            label="Whose duties"
            value={scope}
            onChange={setScope}
            options={[{ value: "mine", label: `My duties (${mineCount})` }, { value: "all", label: "Whole school" }]}
          />
          <select className="select" value={checkpoint} onChange={(e) => setCheckpoint(e.target.value)} aria-label="Checkpoint">
            <option value="all">All checkpoints</option>
            {checkpoints.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select className="select" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
            <option value="all">Any status</option>
            {Object.values(DUTY_STATUS).map((s) => <option key={s} value={s}>{STATUS_UI[s].label}</option>)}
          </select>
          <span className="panel-note" style={{ marginLeft: "auto" }}>{loading ? "" : plural(visible.length, "duty", "duties")}</span>
        </div>

        {error ? (
          <ErrorPanel message={error} onRetry={refresh} />
        ) : loading ? (
          <Skeleton rows={7} />
        ) : visible.length === 0 ? (
          <Empty title={scope === "mine" ? "Nothing assigned to you" : "No duties match"}>
            {scope === "mine" ? "Switch to Whole school to see everyone's checkpoints, or cover one." : "Try another checkpoint or status."}
          </Empty>
        ) : (
          <div className="table-wrap">
            <table className="table stack">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Checkpoint</th>
                  <th>Class or group</th>
                  <th>Who marks it</th>
                  <th className="num">Children seen</th>
                  <th>Status</th>
                  {canReassign(user.role) && <th aria-label="Actions" />}
                </tr>
              </thead>
              <tbody>
                {visible.map((d) => {
                  const rec = records[d.id];
                  const size = studentsForDuty(d).length;
                  const t = rec ? summarise(size, rec.statuses) : null;
                  return (
                    <tr key={d.id} className="is-link" onClick={() => router.push(`/dashboard/duties/${d.id}`)}>
                      <td style={{ whiteSpace: "nowrap" }} data-label="Time">
                        <span className="cell-main">{fmtTime(d.start)}</span>
                        <div className="cell-sub">to {fmtTime(d.end)}</div>
                      </td>
                      <td className="cell-main">{d.checkpoint}{d.mandatoryEscalation && <div className="cell-sub">If missed, goes to the Principal</div>}</td>
                      <td data-label="For">{d.group}<div className="cell-sub">{plural(size, "child", "children")}</div></td>
                      <td data-label="Marked by">{d.staffId === user.id ? <b>You</b> : staffName(d.staffId) || <span className="cell-sub">Unassigned</span>}</td>
                      <td className="num" data-label="Children seen">
                        {t ? (
                          <>
                            <b>{t.accounted}</b><span className="cell-sub"> of {t.total}</span>
                            {t.absent > 0 && <div style={{ color: "var(--negative)", fontWeight: 700, fontSize: 15 }}>{t.absent} absent</div>}
                          </>
                        ) : <span className="cell-sub">—</span>}
                      </td>
                      <td className="stack-corner"><Chip tone={STATUS_UI[d.status].tone}>{STATUS_UI[d.status].label}</Chip></td>
                      {canReassign(user.role) && (
                        <td className="num stack-action">
                          {d.state !== "submitted" && (
                            <button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); reassign(d); }} aria-label={`Give ${d.checkpoint}, ${d.group} to someone else`}>
                              <Icon name="swap" size={18} />Give to someone
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

export default function DutiesPage() {
  return (
    <Suspense fallback={<Skeleton rows={7} />}>
      <DutiesView />
    </Suspense>
  );
}
