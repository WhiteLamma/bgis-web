"use client";

import { useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useSchoolData } from "@/context/SchoolDataContext";
import { useAuditLog } from "@/lib/audit";
import { ROLES, isOversight } from "@/domain/roles";
import { statusLabel } from "@/domain/status";
import { fmtClock, fmtDay } from "@/utils/format";
import { Empty, ErrorPanel, PageHead, Segmented, Skeleton } from "@/components/dash/ui";

const TONE = { ok: "var(--positive)", info: "var(--accent)", wait: "var(--pill-wait-ink)", quiet: "var(--muted)" };

/**
 * The activity log, written from the reader's point of view like the app's
 * ActivityScreen. What comes back is decided by the audit_log RLS policy:
 * oversight gets the school, everyone else the entries naming them.
 */
export default function ActivityPage() {
  const { user } = useAuth();
  const { staffName } = useSchoolData();
  const isAdmin = user.role === ROLES.ADMIN;
  const [routine, setRoutine] = useState("all");
  const { entries, loading, error, reload } = useAuditLog(isAdmin && routine === "ops" ? { severity: "operational" } : {});
  const me = user.id;

  const who = (id, capital = true) => (!id ? (capital ? "Someone" : "someone") : id === me ? (capital ? "You" : "you") : staffName(id) || "A colleague");

  const describe = (e) => {
    const mine = e.subjectId === me && e.actorId !== me;
    switch (e.action) {
      case "duty_submitted": {
        const covering = e.subjectId && e.subjectId !== e.actorId;
        if (!covering) return { tone: "ok", title: `${who(e.actorId)} submitted ${e.checkpoint || "a checkpoint"}` };
        return {
          tone: "info",
          title: mine ? `${who(e.actorId)} submitted your ${e.checkpoint || "checkpoint"}` : `${who(e.actorId)} submitted ${e.checkpoint || "a checkpoint"} for ${who(e.subjectId, false)}`,
          body: mine ? "Marked on your behalf. The duty is still yours." : null,
        };
      }
      case "attendance_override":
        return {
          tone: "wait",
          title: mine ? `${who(e.actorId)} overruled your ${e.checkpoint || "attendance"}` : `${who(e.actorId)} overruled ${e.checkpoint || "attendance"}`,
          body: `${e.admissionNo ? `${e.admissionNo}: ` : ""}${statusLabel(e.oldValue)} → ${statusLabel(e.newValue)}`,
        };
      case "duty_reassigned":
        return {
          tone: "info",
          title: mine ? `${who(e.actorId)} moved your ${e.checkpoint || "duty"} to ${who(e.relatedId, false)}` : `${who(e.actorId)} reassigned ${e.checkpoint || "a duty"}`,
          body: mine ? null : `${who(e.subjectId)} → ${who(e.relatedId, false)}`,
        };
      case "alert_resolved":
        return { tone: "ok", title: `${who(e.actorId)} accounted for a student`, body: e.newValue };
      case "profile_updated":
        return {
          tone: "quiet",
          title: `${who(e.actorId)} updated ${e.actorId === e.subjectId ? "their" : `${who(e.subjectId, false)}'s`} ${e.field || "profile"}`,
          body: e.field === "photo" ? null : `${e.oldValue || "not set"} → ${e.newValue || "not set"}`,
        };
      case "signed_in":
        return { tone: "quiet", title: `${who(e.actorId)} signed in` };
      case "role_changed":
      case "class_changed":
        return { tone: "wait", title: `${who(e.actorId)} changed ${who(e.subjectId, false)}'s ${e.field}`, body: `${e.oldValue || "none"} → ${e.newValue || "none"}` };
      case "staff_added":
      case "student_added":
        return { tone: "info", title: `${who(e.actorId)} added ${e.action === "staff_added" ? who(e.subjectId, false) : `student ${e.admissionNo}`}` };
      default:
        return { tone: "quiet", title: e.action.replace(/_/g, " "), body: e.checkpoint };
    }
  };

  const grouped = useMemo(() => {
    const out = new Map();
    entries.forEach((e) => {
      const day = (e.at || "").slice(0, 10);
      if (!out.has(day)) out.set(day, []);
      out.get(day).push(e);
    });
    return [...out.entries()];
  }, [entries]);

  return (
    <>
      <PageHead
        eyebrow="Activity"
        title="Log"
        lede={isOversight(user.role) ? "Every submission, cover and correction across the school." : "Your submissions, and anything done to your duties."}
      >
        {isAdmin && <Segmented label="Entries" value={routine} onChange={setRoutine} options={[{ value: "all", label: "Everything" }, { value: "ops", label: "Attendance only" }]} />}
      </PageHead>

      <section className="panel">
        {error ? <ErrorPanel message={error} onRetry={reload} /> : loading ? <Skeleton rows={8} /> : entries.length === 0 ? (
          <Empty title="Nothing yet">Submissions, covers and corrections will appear here.</Empty>
        ) : grouped.map(([day, list], gi) => (
          <div key={day}>
            <div className="panel-head" style={gi ? { borderTop: "1px solid var(--panel-strong)" } : undefined}>
              <h2 className="panel-title" style={{ fontSize: 16 }}>{fmtDay(day)}</h2>
            </div>
            <ul className="rowlist">
              {list.map((e) => {
                const d = describe(e);
                return (
                  <li key={e.id} className="row-link" style={{ alignItems: "flex-start" }}>
                    <span className="row-time" style={{ color: "var(--muted)" }}>{fmtClock(e.at)}</span>
                    <span aria-hidden="true" style={{ flex: "none", width: 8, height: 8, marginTop: 7, borderRadius: 4, background: TONE[d.tone] }} />
                    <span className="row-body">
                      <span className="cell-main" style={{ display: "block" }}>{d.title}</span>
                      {(d.body || e.day) && <span className="cell-sub">{[d.body, e.day && e.day !== day ? `for ${fmtDay(e.day)}` : null].filter(Boolean).join(" · ")}</span>}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </section>
    </>
  );
}
