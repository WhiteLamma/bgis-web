"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useSchoolData } from "@/context/SchoolDataContext";
import { approveRequest, rejectRequest, usePendingRequests } from "@/lib/access";
import { fetchStaffLogins, setTemporaryPassword } from "@/lib/staff";
import { issueResetCode } from "@/lib/passwords";
import { invalidate } from "@/lib/cache";
import { describeError } from "@/lib/errors";
import { canApproveStaff, roleLabel } from "@/domain/roles";
import { fmtDay, plural } from "@/utils/format";
import { Avatar, Chip, Empty, ErrorPanel, Icon, PageHead, Segmented, Skeleton, useFeedback } from "@/components/dash/ui";
import { AddStaffDialog, LoginDetailsDialog, ResetCodeDialog, StaffDetailDialog } from "@/components/dash/StaffLogins";

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

  // Login state per staff member (048), only for coordinator/admin: the
  // temporary password while it is still the one in use.
  const [logins, setLogins] = useState({});
  const loadLogins = useCallback(async () => {
    if (approver) setLogins(await fetchStaffLogins());
  }, [approver]);
  useEffect(() => {
    loadLogins();
  }, [loadLogins]);
  const [adding, setAdding] = useState(false);
  const [selected, setSelected] = useState(null);
  const [loginDetails, setLoginDetails] = useState(null);
  const [resetCode, setResetCode] = useState(null);

  const failed = (e, title) => {
    const d = describeError(e, { title, message: "Nothing was changed. Try again." });
    setTimeout(() => feedback.alert({ title: d.title, message: d.message }), 0);
  };

  /** Create a login, or reset one, with Initial@123 or a random password. */
  const giveTemporaryPassword = (member, random) => {
    const login = logins[member.id];
    const what = random ? "a random password" : "Initial@123";
    feedback.confirm({
      title: login?.hasLogin ? `Reset ${member.name}'s password?` : `Create a login for ${member.name}?`,
      message: login?.hasLogin
        ? `Their password becomes ${what} and they are signed out everywhere. They will be asked to choose their own the next time they sign in.`
        : `They sign in with ${member.email} and ${what}, and choose their own password the first time.`,
      confirmLabel: login?.hasLogin ? "Reset" : "Create login",
      onConfirm: async () => {
        try {
          const password = await setTemporaryPassword(member.id, random);
          setLoginDetails({ name: member.name, email: member.email, password });
          loadLogins();
        } catch (e) {
          failed(e, "Password not changed");
        }
      },
    });
  };

  const issueReset = (member) =>
    feedback.confirm({
      title: `Reset ${member.name}'s password?`,
      message:
        "You get a one-time code to give them in person or by phone. They enter it on the app's sign-in screen under “Forgot password?” and choose a new password themselves — you never see it. The code works once and expires in 30 minutes. They are signed out everywhere when it is used.",
      confirmLabel: "Get code",
      onConfirm: async () => {
        try {
          const { code, expiresAt } = await issueResetCode(member.id);
          setResetCode({ name: member.name, email: member.email, code, expiresAt });
        } catch (e) {
          failed(e, "No code issued");
        }
      },
    });

  const loginNote = (s) => {
    const l = logins[s.id];
    if (!l) return "";
    if (!l.hasLogin) return " · no login yet";
    return l.mustChange ? " · temporary password" : "";
  };

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
      <PageHead title="Staff" lede={`${plural(staff.length, "active staff member")}. Duties today are counted beside each name.`}>
        {approver && <button className="btn btn-primary" onClick={() => setAdding(true)}>+ Add staff</button>}
      </PageHead>

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
                  <tr
                    key={s.id}
                    className="is-link"
                    tabIndex={0}
                    onClick={() => setSelected(s)}
                    onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), setSelected(s))}
                    aria-label={`${s.name}, open details`}
                  >
                    <td>
                      <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <Avatar name={s.name} url={s.photoUrl} />
                        <span className="cell-main">{s.name}{s.id === user.id && <span className="cell-sub"> · you</span>}</span>
                      </span>
                    </td>
                    <td className="stack-corner"><Chip tone={s.role === "teacher" ? "quiet" : "info"} plain>{roleLabel(s.role)}</Chip>{loginNote(s) && <span className="cell-sub">{loginNote(s)}</span>}</td>
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

      <AddStaffDialog
        open={adding}
        staff={staff}
        classes={classes}
        onClose={() => setAdding(false)}
        onAdded={(details) => {
          setLoginDetails(details);
          invalidate("staff");
          refresh();
          loadLogins();
          queue.reload();
        }}
      />
      <StaffDetailDialog
        member={selected}
        login={selected ? logins[selected.id] : undefined}
        me={user}
        canSeeLogins={approver}
        onClose={() => setSelected(null)}
        onShowLogin={setLoginDetails}
        onTempPassword={giveTemporaryPassword}
        onResetCode={issueReset}
      />
      <LoginDetailsDialog details={loginDetails} onClose={() => setLoginDetails(null)} />
      <ResetCodeDialog reset={resetCode} onClose={() => setResetCode(null)} />
    </>
  );
}
