"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "@/components/transition/TransitionLink";
import { useParams } from "next/navigation";
import { useTransitionRouter as useRouter } from "@/components/transition/PageTransition";
import { useAuth } from "@/context/AuthContext";
import { useSchoolData } from "@/context/SchoolDataContext";
import { dutyStatus, escalationStage } from "@/domain/duties";
import { canMark, canOverride } from "@/domain/roles";
import { attendanceStudentLabel } from "@/domain/classGroups";
import { STATUS_META, statusLabel } from "@/domain/status";
import { useNow } from "@/lib/clock";
import { haptics } from "@/lib/haptics";
import { describeError } from "@/lib/errors";
import { fmtClock, fmtDay, fmtTime, plural, todayISO } from "@/utils/format";
import { Chip, Empty, Icon, PageHead, Skeleton, useFeedback } from "@/components/dash/ui";
import { STATUS_UI } from "@/components/dash/duty";

// The codes a marker can choose, in the order the app's sheet shows them.
// The four answers a teacher gives most, as big worded buttons; the rest
// sit behind "More…" so a row never becomes a wall of small codes.
const MAIN_CODES = ["P", "A", "H", "S"];
const MORE_CODES = ["V", "O", "G", "Y", "D"];
const codeLabel = (c) => (c === "P" ? "Present" : STATUS_META[c].label);

/**
 * One checkpoint's register — the web version of DutyMarkingScreen.
 *
 * Everyone starts present; only the exceptions are touched. The rules are
 * the app's, kept the same on purpose:
 *  - a submitted register is read-only for the person who marked it;
 *    oversight roles may overrule it (SRS A6), and every change is audited;
 *  - a child signed out at the gate is locked to the gate's status from the
 *    day they left (migration 034 enforces this in the database too);
 *  - submitting someone else's checkpoint, or any absence, asks first.
 */
export default function DutyPage() {
  const { id } = useParams();
  const dutyId = decodeURIComponent(id);
  const router = useRouter();
  const { user } = useAuth();
  const { duties, records, loading, studentsForDuty, submitDuty, overrideDuty, staffName, leaveFor, isToday } = useSchoolData();
  const feedback = useFeedback();
  const now = useNow();

  const duty = duties.find((d) => String(d.id) === dutyId);
  const students = useMemo(() => studentsForDuty(duty), [duty, studentsForDuty]);
  const existing = duty ? records[duty.id] : null;

  const submitted = duty?.state === "submitted";
  const isOverride = submitted && canOverride(user.role);
  // Teachers may mark early or late (041); only a future day stays closed.
  const outsideWindow = !!duty?.pilotWindow && !isOverride && duty.day > todayISO();
  const readOnly = !canMark(user.role) || (submitted && !isOverride) || outsideWindow;

  const [statuses, setStatuses] = useState(existing?.statuses || {});
  const adopted = useRef(!!existing);
  useEffect(() => {
    // Adopt the saved marks once, when they first arrive — never afterwards,
    // so a background refresh cannot wipe marks being made.
    if (adopted.current || !existing?.statuses) return;
    adopted.current = true;
    setStatuses(existing.statuses);
  }, [existing]);

  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);

  const locked = useMemo(() => {
    const map = {};
    if (!duty?.day) return map;
    students.forEach((s) => {
      const leave = leaveFor(s.adm);
      if (leave && duty.day >= leave.outDay) map[s.id] = leave;
    });
    return map;
  }, [students, leaveFor, duty?.day]);

  const effective = useMemo(() => {
    const merged = { ...statuses };
    Object.entries(locked).forEach(([sid, leave]) => (merged[sid] = leave.status));
    return merged;
  }, [statuses, locked]);

  const marked = Object.keys(effective).length;
  const absent = Object.values(effective).filter((s) => s === "A").length;
  const elsewhere = marked - absent;
  const present = students.length - marked;

  const changedCount = useMemo(() => {
    if (!isOverride) return 0;
    const before = existing?.statuses || {};
    const ids = new Set([...Object.keys(before), ...Object.keys(effective)]);
    let n = 0;
    ids.forEach((k) => (effective[k] || null) !== (before[k] || null) && (n += 1));
    return n;
  }, [isOverride, existing, effective]);

  if (loading && !duty) return <div className="panel"><Skeleton rows={8} /></div>;
  if (!duty) {
    return (
      <div className="panel">
        <Empty title="Duty not available" action={<Link className="btn btn-ghost" href="/dashboard/duties">Back to duties</Link>}>
          It may have been reassigned, or it belongs to another day. Pick the day on the Duties page.
        </Empty>
      </div>
    );
  }

  const status = dutyStatus(duty, records, isToday ? now : 24 * 60);
  const esc = isToday && !submitted ? escalationStage(duty, now) : null;
  const coveringFor = duty.staffId !== user.id ? staffName(duty.staffId) || "another teacher" : null;
  const markedBy = staffName(existing?.submittedBy);

  const setStatus = (sid, code) => {
    if (code === "A") haptics.markAbsent();
    else if (statuses[sid] === "A") haptics.undoAbsent();
    else haptics.select();
    setStatuses((prev) => {
      const next = { ...prev };
      if (code === "P") delete next[sid];
      else next[sid] = code;
      return next;
    });
  };

  // One status for the whole group. Gate sign-outs keep the gate's mark, and
  // marks already made are only replaced after a confirm.
  const markAll = (code) => {
    if (!code) return;
    const targets = students.filter((s) => !locked[s.id]);
    const label = codeLabel(code);
    const run = () => {
      setStatuses((prev) => {
        const next = { ...prev };
        targets.forEach((s) => {
          if (code === "P") delete next[s.id];
          else next[s.id] = code;
        });
        return next;
      });
      code === "A" ? haptics.warn() : haptics.select();
      feedback.toast(`${plural(targets.length, "student")} marked ${label}`);
    };
    const replacing = targets.filter((s) => statuses[s.id] && statuses[s.id] !== code).length;
    if (!replacing) return run();
    feedback.confirm({
      title: `Mark everyone ${label}?`,
      message: `This replaces ${plural(replacing, "mark")} already made.`,
      cancelLabel: "Keep my marks",
      confirmLabel: `Mark all ${label}`,
      destructive: code === "A",
      onConfirm: run,
    });
  };

  const q = query.trim().toLowerCase();
  const visible = q
    ? students.filter((s) => s.name.toLowerCase().includes(q) || String(s.roll || "").includes(q) || String(s.adm).toLowerCase().includes(q))
    : students;

  const fail = (e, title, message) => {
    haptics.error();
    const d = describeError(e, { title, message }, "Your marks are still here.");
    feedback.alert({ title: d.offline ? d.title : title, message: d.message, destructive: !d.offline });
  };

  const remarkRef = useRef(null);
  const doSubmit = async () => {
    setSaving(true);
    try {
      const { remarkSaved = true } = (await submitDuty(duty.id, effective, user.id, remarkRef.current?.value || "")) || {};
      haptics.success();
      feedback.toast(`${duty.checkpoint} submitted${coveringFor ? ` for ${coveringFor}` : ""} · ${present}/${students.length} present${absent ? `, ${absent} absent` : ""}${remarkSaved ? "" : " · remark not saved"}`);
      router.push("/dashboard/duties");
    } catch (e) {
      fail(e, "Not submitted", "Something went wrong saving this. Your marks are still here — try again.");
    } finally {
      setSaving(false);
    }
  };

  const doOverride = async () => {
    setSaving(true);
    try {
      const changed = await overrideDuty(duty.id, effective, user.id);
      haptics.success();
      feedback.toast(changed === 0 ? "No changes to save" : `${plural(changed, "mark")} amended in ${duty.checkpoint}`);
      router.push("/dashboard/duties");
    } catch (e) {
      fail(e, "Not saved", "Something went wrong while saving this amendment. Your changes have been kept.");
    } finally {
      setSaving(false);
    }
  };

  const onSave = () => {
    if (isOverride || absent > 0 || coveringFor) haptics.warn();
    if (isOverride) {
      feedback.confirm({
        title: markedBy ? `Overrule ${markedBy}'s submission?` : "Overrule this submission?",
        message: `This changes ${plural(changedCount, "mark")} in ${duty.checkpoint}. The original submitter stays on the record, and this amendment is attributed to you.`,
        cancelLabel: "Review",
        confirmLabel: "Save correction",
        destructive: true,
        onConfirm: doOverride,
      });
    } else {
      // One final step for every submit: the count, any warning, and an
      // optional remark for the office (gurukul 042).
      feedback.confirm({
        title: `Submit ${duty.checkpoint}?`,
        message: `${present}/${students.length} present${elsewhere ? `, ${elsewhere} elsewhere` : ""}${absent ? `, ${absent} absent` : ""}.${
          absent ? " Absent means unaccounted for — this raises a safety alert to the Principal." : ""
        }${coveringFor ? ` Submitting for ${coveringFor}; the record will show you submitted it.` : ""}`,
        body: (
          <label className="dlg-remark">
            <span>Remark (optional)</span>
            <textarea ref={remarkRef} className="input" rows={3} maxLength={500} placeholder="Anything the office should know" />
          </label>
        ),
        cancelLabel: "Review",
        confirmLabel: "Submit",
        destructive: absent > 0,
        onConfirm: doSubmit,
      });
    }
  };

  return (
    <>
      <PageHead
        eyebrow={`${fmtDay(duty.day)} · ${fmtTime(duty.start)} – ${fmtTime(duty.end)}`}
        title={`${duty.checkpoint} · ${duty.group}`}
        lede={submitted
          ? `Submitted by ${markedBy || "—"} at ${fmtClock(existing?.submittedAt)}${existing?.correctedAt ? `, corrected by ${staffName(existing.correctedBy) || "—"} at ${fmtClock(existing.correctedAt)}` : ""}.`
          : `Assigned to ${duty.staffId === user.id ? "you" : staffName(duty.staffId) || "nobody"}. Everyone starts present — mark only the exceptions.`}
      >
        <Link href="/dashboard/duties" className="btn btn-ghost"><Icon name="left" size={18} />All duties</Link>
        <Chip tone={STATUS_UI[status].tone}>{STATUS_UI[status].label}</Chip>
      </PageHead>

      <div className="banners">
        {esc && <div className="banner bad"><Icon name="alert" /><span><b>{esc.text}.</b> This checkpoint's window {now > duty.end ? "has closed" : "is closing"}.</span></div>}
        {coveringFor && !readOnly && !submitted && <div className="banner wait"><Icon name="info" /><span>You are covering for <b>{coveringFor}</b>. It stays on their roster; the record will show you submitted it.</span></div>}
        {isOverride && <div className="banner wait"><Icon name="info" /><span>You are correcting a submitted register. Every change is written to the activity log.</span></div>}
        {outsideWindow && <div className="banner info"><Icon name="lock" /><span>Marking opens on {fmtDay(duty.day)}.</span></div>}
        {submitted && !isOverride && <div className="banner info"><Icon name="lock" /><span>This register is submitted and locked. Ask a coordinator if a mark needs correcting.</span></div>}
        {submitted && duty.remark && <div className="banner info"><Icon name="info" /><span><b>Remark:</b> {duty.remark}</span></div>}
        {Object.keys(locked).length > 0 && <div className="banner info"><Icon name="gate" /><span>{plural(Object.keys(locked).length, "student is", "students are")} signed out at the gate and recorded as away until reception signs them back in.</span></div>}
      </div>

      <section className="panel">
        <div className="mark-head">
          <div className="tally"><b>{present}</b><span>Present</span></div>
          <div className={`tally${absent ? " bad" : ""}`}><b>{absent}</b><span>Absent</span></div>
          <div className="tally"><b>{elsewhere}</b><span>Elsewhere</span></div>
          <div className="tally"><b>{students.length}</b><span>In group</span></div>
          <div className="mark-tools">
            <div className="search" style={{ flex: "1 1 220px", maxWidth: 320 }}>
              <Icon name="search" size={20} />
              <input className="input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find a child by name or roll" aria-label="Find a child" />
            </div>
            {!readOnly && students.length > 1 && (
              <select
                className="input mark-all"
                value=""
                onChange={(e) => markAll(e.target.value)}
                aria-label="Mark everyone in this group"
              >
                <option value="" disabled>Mark all…</option>
                <option value="P">Present</option>
                {Object.entries(STATUS_META).map(([k, v]) => (
                  <option key={k} value={k}>{k === "D" ? "YDIV — Your day in Vrindavan" : v.label}</option>
                ))}
              </select>
            )}
          </div>
        </div>

        {students.length === 0 ? (
          <Empty title="No students in this group">The register has nobody matching this duty's group.</Empty>
        ) : (
          <div role="list">
            {visible.map((s) => {
              const code = effective[s.id] || "P";
              const leave = locked[s.id];
              const sub = attendanceStudentLabel(s, duty);
              return (
                <div role="listitem" key={s.id} className={`mark-row${code === "A" ? " is-absent" : ""}`}>
                  <span className="mark-roll">{s.roll ?? "—"}</span>
                  <span style={{ minWidth: 0 }}>
                    <span className="mark-name" style={{ display: "block" }}>{s.name}</span>
                    <span className="cell-sub">
                      {[sub, s.type === "D" ? "Day scholar" : "Residential"].filter(Boolean).join(" · ")}
                      {leave && <> · <b style={{ color: "var(--accent)" }}>Signed out {fmtDay(leave.outDay)}{leave.reason ? `: ${leave.reason}` : ""}</b></>}
                    </span>
                  </span>
                  <span className="mark-codes" role="radiogroup" aria-label={`Where is ${s.name}?`}>
                    {readOnly || leave ? (
                      <Chip tone={code === "A" ? "bad" : code === "P" ? "ok" : "quiet"} plain={!!leave}>{leave && <Icon name="lock" size={15} />}{statusLabel(code === "P" ? null : code)}</Chip>
                    ) : (
                      <>
                        {MAIN_CODES.map((c) => (
                          <button
                            key={c}
                            type="button"
                            role="radio"
                            aria-checked={code === c}
                            aria-pressed={code === c}
                            className={`code-btn${c === "A" ? " absent" : ""}`}
                            onClick={() => setStatus(s.id, c)}
                          >
                            {codeLabel(c)}
                          </button>
                        ))}
                        <details className="mark-more">
                          <summary className="code-btn" aria-pressed={MORE_CODES.includes(code)}>
                            {MORE_CODES.includes(code) ? codeLabel(code) : "More…"}
                          </summary>
                          <div className="mark-more-menu">
                            {MORE_CODES.map((c) => (
                              <button
                                key={c}
                                type="button"
                                role="radio"
                                aria-checked={code === c}
                                aria-pressed={code === c}
                                className="code-btn"
                                onClick={(e) => {
                                  setStatus(s.id, c);
                                  e.currentTarget.closest("details").open = false;
                                }}
                              >
                                {codeLabel(c)}
                              </button>
                            ))}
                          </div>
                        </details>
                      </>
                    )}
                  </span>
                </div>
              );
            })}
            {visible.length === 0 && <Empty>No student matches “{query}”.</Empty>}
          </div>
        )}

        {!readOnly && students.length > 0 && (
          <div className="mark-foot">
            <span className="panel-note">
              {isOverride
                ? changedCount ? `${plural(changedCount, "mark")} changed from the submitted register` : "No changes yet"
                : `${present} present${absent ? ` · ${absent} absent` : ""}${elsewhere ? ` · ${elsewhere} elsewhere` : ""}`}
            </span>
            <button className={`btn ${absent && !isOverride ? "btn-danger" : "btn-primary"}`} style={{ minHeight: 56, padding: "0 32px", fontSize: 18 }} onClick={onSave} disabled={saving || (isOverride && changedCount === 0)}>
              {saving ? "Saving…" : isOverride ? "Save correction" : `Submit ${duty.checkpoint}`}
            </button>
          </div>
        )}
      </section>
    </>
  );
}
