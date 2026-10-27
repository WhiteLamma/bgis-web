"use client";

import { useMemo, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useSchoolData } from "@/context/SchoolDataContext";
import { approveRequest, rejectRequest, usePendingRequests } from "@/lib/access";
import { describeError } from "@/lib/errors";
import { canApproveStaff, roleLabel } from "@/domain/roles";
import { fmtDay, plural } from "@/utils/format";
import { Avatar, Chip, Empty, ErrorPanel, Icon, PageHead, Segmented, Skeleton, useFeedback } from "@/components/dash/ui";

/**
 * The staff directory, and — for coordinator and admin — the queue of people
 * asking for access. Approving always creates a teacher (migration 013); the
 * class is an optional second grant that opens that class's register.
 */
export default function StaffPage() {
  const { user } = useAuth();
  const { staff, students, duties, loading, error, refresh } = useSchoolData();
  const approver = canApproveStaff(user.role);
  const queue = usePendingRequests(approver);
  const feedback = useFeedback();
  const [role, setRole] = useState("all");
  const [query, setQuery] = useState("");
  const classPick = useRef(null);
  const noteRef = useRef(null);

  const classes = useMemo(() => {
    const seen = new Map();
    students.forEach((s) => !seen.has(s.key) && seen.set(s.key, { key: s.key, label: s.label, grade: s.grade }));
    return [...seen.values()].sort((a, b) => a.grade - b.grade || a.label.localeCompare(b.label));
  }, [students]);

  const dutyCount = useMemo(() => {
    const m = {};
    duties.forEach((d) => (m[d.staffId] = (m[d.staffId] || 0) + 1));
    return m;
  }, [duties]);

  const roles = [...new Set(staff.map((s) => s.role))];
  const q = query.trim().toLowerCase();
  const visible = staff
    .filter((s) => role === "all" || s.role === role)
    .filter((s) => !q || s.name.toLowerCase().includes(q) || (s.email || "").toLowerCase().includes(q));

  const approve = (req) =>
    feedback.confirm({
      title: `Approve ${req.name}?`,
      message: `${req.email} becomes a teacher and can sign in straight away.`,
      body: (
        <label className="field" style={{ marginTop: 14 }}>
          <span className="field-label">Class teacher of (optional)</span>
          <select className="select" ref={classPick} defaultValue="">
            <option value="">No class — duty staff only</option>
            {classes.map((c) => <option key={c.key} value={c.key}>Class {c.label}</option>)}
          </select>
        </label>
      ),
      confirmLabel: "Approve",
      onConfirm: async () => {
        try {
          await approveRequest(req.id, classPick.current?.value || null);
          feedback.toast(`${req.name} approved`);
          queue.reload();
          refresh();
        } catch (e) {
          const d = describeError(e, { message: "The request was not approved." });
          setTimeout(() => feedback.alert({ title: d.title, message: d.message }), 0);
        }
      },
    });

  const reject = (req) =>
    feedback.confirm({
      title: `Decline ${req.name}?`,
      message: "They stay signed in to a waiting screen that says the request was declined.",
      body: (
        <label className="field" style={{ marginTop: 14 }}>
          <span className="field-label">Reason (shown to them)</span>
          <input className="input" ref={noteRef} placeholder="Optional" />
        </label>
      ),
      confirmLabel: "Decline",
      destructive: true,
      onConfirm: async () => {
        try {
          await rejectRequest(req.id, noteRef.current?.value || null);
          feedback.toast(`${req.name} declined`);
          queue.reload();
        } catch (e) {
          const d = describeError(e, { message: "The request was not declined." });
          setTimeout(() => feedback.alert({ title: d.title, message: d.message }), 0);
        }
      },
    });

  return (
    <>
      <PageHead eyebrow="Directory" title="Staff" lede={`${plural(staff.length, "active staff member")}. Duties today are counted beside each name.`} />

      {approver && (queue.loading || queue.requests.length > 0 || queue.error) && (
        <section className="panel" style={{ marginBottom: 18 }}>
          <div className="panel-head">
            <h2 className="panel-title">Access requests</h2>
            <span className="panel-note">{queue.requests.length ? `${queue.requests.length} waiting` : ""}</span>
          </div>
          {queue.error ? <ErrorPanel message={queue.error} onRetry={queue.reload} /> : queue.loading ? <Skeleton rows={2} /> : (
            <ul className="rowlist">
              {queue.requests.map((r) => (
                <li key={r.id} className="row-link">
                  <Avatar name={r.name} />
                  <span className="row-body">
                    <span className="cell-main" style={{ display: "block" }}>{r.name}</span>
                    <span className="cell-sub">{r.email}{r.phone ? ` · ${r.phone}` : ""} · asked {fmtDay(r.requestedAt?.slice(0, 10))}</span>
                  </span>
                  <span className="row-side">
                    <button className="btn btn-ghost btn-sm" onClick={() => reject(r)}>Decline</button>
                    <button className="btn btn-primary btn-sm" onClick={() => approve(r)}><Icon name="check" size={16} />Approve</button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section className="panel">
        <div className="toolbar">
          <div className="search">
            <Icon name="search" size={17} />
            <input className="input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name or email" aria-label="Search staff" />
          </div>
          <Segmented label="Role" value={role} onChange={setRole} options={[{ value: "all", label: "Everyone" }, ...roles.map((r) => ({ value: r, label: roleLabel(r) }))]} />
        </div>
        {error ? <ErrorPanel message={error} onRetry={refresh} /> : loading ? <Skeleton rows={6} /> : visible.length === 0 ? <Empty>No staff match.</Empty> : (
          <div className="table-wrap">
            <table className="table stack">
              <thead><tr><th>Name</th><th>Role</th><th>Class</th><th>Contact</th><th className="num">Duties today</th></tr></thead>
              <tbody>
                {visible.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <Avatar name={s.name} url={s.photoUrl} />
                        <span className="cell-main">{s.name}{s.id === user.id && <span className="cell-sub"> · you</span>}</span>
                      </span>
                    </td>
                    <td className="stack-corner"><Chip tone={s.role === "teacher" ? "quiet" : "info"} plain>{roleLabel(s.role)}</Chip></td>
                    <td data-label="Class">{s.classLabel || <span className="cell-sub">—</span>}</td>
                    <td className="cell-sub" data-label="Contact">{s.email}{s.phone ? <><br />{s.phone}</> : null}</td>
                    <td className="num" data-label="Duties today">{dutyCount[s.id] || <span className="cell-sub">0</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
