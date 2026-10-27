"use client";

import { useMemo, useState } from "react";
import Link from "@/components/transition/TransitionLink";
import { useAuth } from "@/context/AuthContext";
import { useSchoolData } from "@/context/SchoolDataContext";
import { DUTY_STATUS, dutyStatus, escalationStage, summarise } from "@/domain/duties";
import { ALERT_KIND, describeAlert } from "@/domain/alerts";
import { canCloseAlerts, canMark, isOversight } from "@/domain/roles";
import { useNow } from "@/lib/clock";
import { fmtClock, fmtDay, fmtDuration, fmtTime, givenName, plural, todayISO, weekdayOf } from "@/utils/format";
import { Chip, DayPicker, Empty, ErrorPanel, Icon, PageHead, Skeleton } from "@/components/dash/ui";
import DayTimeline from "@/components/dash/DayTimeline";
import ResolveAlert from "@/components/dash/ResolveAlert";
import { useAlerts } from "@/components/dash/useAlerts";
import { STATUS_UI, byCheckpoint } from "@/components/dash/duty";

const greeting = (now) => (now < 720 ? "Good morning" : now < 1020 ? "Good afternoon" : "Good evening");

/**
 * Today. The screen's one question: is every child accounted for, and is
 * anything late? The greeting answers it in words from the data; the
 * timeline shows the whole day; the "Right now" card has the button for the
 * job that comes up most — opening the checkpoint that is open.
 */
export default function TodayPage() {
  const { user } = useAuth();
  const { duties, records, loading, error, refresh, day, setDay, isToday, holiday, campusClosed, studentsForDuty, staffName, openLeaves } = useSchoolData();
  const { alerts, open, apply } = useAlerts();
  const now = useNow();
  const [resolving, setResolving] = useState(null);

  const oversight = isOversight(user.role);
  const mine = canMark(user.role) && !oversight;
  // Teachers see their own day; oversight and the nurse see the school's.
  const scoped = useMemo(() => {
    const list = mine ? duties.filter((d) => d.staffId === user.id) : duties;
    return list.map((d) => ({ ...d, status: dutyStatus(d, records, isToday ? now : 24 * 60) }));
  }, [duties, records, now, mine, user, isToday]);

  const count = (s) => scoped.filter((d) => d.status === s).length;
  const submitted = count(DUTY_STATUS.DONE);
  const overdue = count(DUTY_STATUS.OVERDUE);
  const dueNow = count(DUTY_STATUS.DUE);

  // Absences across the day's submitted registers, one per child.
  const absentToday = useMemo(() => {
    const kids = new Set();
    for (const d of duties) {
      const st = records[d.id]?.statuses || {};
      for (const [adm, code] of Object.entries(st)) if (code === "A") kids.add(adm);
    }
    return kids.size;
  }, [duties, records]);

  const attention = scoped
    .filter((d) => d.status === DUTY_STATUS.OVERDUE || d.status === DUTY_STATUS.DUE)
    .sort((a, b) => (a.status === b.status ? a.end - b.end : a.status === DUTY_STATUS.OVERDUE ? -1 : 1));
  const next = scoped.filter((d) => d.status === DUTY_STATUS.UPCOMING).sort((a, b) => a.start - b.start)[0] || null;
  // What the "Right now" card is about: the most urgent open duty, else the next one.
  const focus = attention[0] || next;
  // The next few checkpoints after the one in focus, one line each.
  const afterThat = byCheckpoint(scoped.filter((d) => d.status === DUTY_STATUS.UPCOMING))
    .filter((c) => !focus || c.name !== focus.checkpoint)
    .slice(0, 3);

  const recent = scoped
    .filter((d) => d.status === DUTY_STATUS.DONE)
    .sort((a, b) => (records[b.id]?.submittedAt || "").localeCompare(records[a.id]?.submittedAt || ""))
    .slice(0, 5);

  const showAlerts = oversight || user.role === "nurse";

  // The day's one fact, in words, for the second line of the greeting.
  const fact = loading
    ? ""
    : campusClosed
      ? "The campus is closed today."
      : showAlerts && open.length
        ? `${plural(open.length, "child", "children")} to account for.`
        : overdue
          ? `${plural(overdue, "checkpoint is", "checkpoints are")} overdue.`
          : !scoped.length
            ? mine ? "You have no checkpoints today." : "No checkpoints on this day."
            : submitted === scoped.length
              ? "Every checkpoint is in."
              : dueNow
                ? `${attention[0].checkpoint} is open now.`
                : isToday && next
                  ? `Nothing is late. Next is ${next.checkpoint} at ${fmtTime(next.start)}.`
                  : `${submitted} of ${scoped.length} checkpoints submitted.`;

  const dateLine = `${weekdayOf(day)}, ${new Date(`${day}T00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}`;

  return (
    <>
      <PageHead
        title={isToday ? `${greeting(now)}, ${givenName(user.name)}.` : `${fmtDay(day)}.`}
        fact={fact}
        eyebrow={dateLine}
      >
        <DayPicker day={day} onChange={setDay} />
      </PageHead>

      {holiday && (
        <div className="banners">
          <div className="banner info">
            <Icon name="holiday" />
            <span><b>{holiday.label}.</b> {campusClosed ? "The campus is closed, so no registers are taken." : "Classes are off. The hostel checkpoints still run."}</span>
          </div>
        </div>
      )}

      {error ? (
        <ErrorPanel message={error} onRetry={refresh} />
      ) : (
        <>
          <section className="figures" aria-label="The day in numbers">
            <div className="figure">
              <p className="figure-label">{mine ? "Your checkpoints done" : "Checkpoints done"}</p>
              <p className="figure-value">{loading ? "—" : submitted}<small>of {scoped.length}</small></p>
              <p className="figure-foot">{loading ? "" : scoped.length - submitted ? `${scoped.length - submitted} still to do` : "All submitted"}</p>
            </div>
            <div className={`figure${overdue ? " is-bad" : ""}`}>
              <p className="figure-label">Overdue</p>
              <p className="figure-value">{loading ? "—" : overdue}</p>
              <p className="figure-foot">{overdue ? "Time is up, not marked" : "Nothing is late"}</p>
            </div>
            <div className={`figure${absentToday ? " is-bad" : ""}`}>
              <p className="figure-label">Marked absent</p>
              <p className="figure-value">{loading ? "—" : absentToday}</p>
              <p className="figure-foot">{absentToday ? "Children, all checkpoints today" : "No one so far today"}</p>
            </div>
            <div className="figure">
              <p className="figure-label">Away from campus</p>
              <p className="figure-value">{Object.keys(openLeaves).length}</p>
              <p className="figure-foot">Signed out at the gate</p>
            </div>
          </section>

          <div className="grid-main">
            <section className="panel is-card" aria-labelledby="day-title">
              <div className="panel-head">
                <h2 className="panel-title" id="day-title">{mine ? "Your day" : "The school's day"}</h2>
                <Link href="/dashboard/duties" className="btn btn-text">See every duty</Link>
              </div>
              {loading ? <Skeleton rows={5} /> : scoped.length ? (
                <DayTimeline duties={scoped} now={now} isToday={isToday} />
              ) : (
                <Empty title={campusClosed ? "No registers today" : "No checkpoints on this day"}>
                  {campusClosed ? "The campus is closed." : isToday ? "Checkpoints are made each night. If this stays empty, tell the office." : "Nothing was planned for this day."}
                </Empty>
              )}
            </section>

            <section className="panel now-card" aria-labelledby="now-title">
              <h2 className="now-label" id="now-title">{focus && focus.status !== DUTY_STATUS.UPCOMING ? "Right now" : "Coming next"}</h2>
              {loading ? (
                <Skeleton rows={3} />
              ) : focus ? (
                <>
                  <p className="now-what">{focus.checkpoint}</p>
                  <p className="now-when">
                    {focus.group}
                    <br />
                    {fmtTime(focus.start)} to {fmtTime(focus.end)}
                    {isToday && focus.status === DUTY_STATUS.OVERDUE && <><br /><b style={{ color: "var(--negative)" }}>Late by {fmtDuration(now - focus.end)}</b></>}
                    {isToday && focus.status === DUTY_STATUS.DUE && <><br /><b>Closes in {fmtDuration(focus.end - now)}</b></>}
                  </p>
                  {canMark(user.role) && (
                    <Link href={`/dashboard/duties/${focus.id}`} className={`btn btn-block ${focus.status === DUTY_STATUS.UPCOMING ? "btn-ghost" : "btn-primary"}`}>
                      {focus.status === DUTY_STATUS.UPCOMING ? "Look at the register" : "Mark this register"}
                    </Link>
                  )}
                  {afterThat.length > 0 && (
                    <div className="now-after">
                      <h3>After that</h3>
                      <ul>
                        {afterThat.map((c) => (
                          <li key={c.id}><span>{c.name}</span><span>{fmtTime(c.start)}</span></li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <p className="now-what">{scoped.length ? "All done" : "Nothing planned"}</p>
                  <p className="now-when">{scoped.length ? "Every checkpoint for the day is submitted." : "There are no checkpoints on this day."}</p>
                </>
              )}
            </section>
          </div>

          <div className="grid-2">
            <section className="panel" aria-labelledby="attn-title">
              <div className="panel-head">
                <h2 className="panel-title" id="attn-title">Needs attention</h2>
                <span className="panel-note">{attention.length ? plural(attention.length, "checkpoint") : ""}</span>
              </div>
              {loading ? <Skeleton /> : attention.length ? (
                <ul className="rowlist">
                  {attention.slice(0, 6).map((d) => {
                    const esc = isToday ? escalationStage(d, now) : null;
                    return (
                      <li key={d.id}>
                        <Link className="row-link" href={`/dashboard/duties/${d.id}`}>
                          <span className="row-time">{fmtTime(d.start)}<small>to {fmtTime(d.end)}</small></span>
                          <span className="row-body">
                            <span className="cell-main" style={{ display: "block" }}>{d.checkpoint}</span>
                            <span className="cell-sub">
                              {d.group} · {d.staffId === user.id ? "you" : staffName(d.staffId) || "nobody assigned"}
                              {esc && d.status === DUTY_STATUS.OVERDUE ? ` · ${esc.text}` : ""}
                            </span>
                          </span>
                          <span className="row-side"><Chip tone={STATUS_UI[d.status].tone}>{STATUS_UI[d.status].label}</Chip></span>
                        </Link>
                      </li>
                    );
                  })}
                  {attention.length > 6 && (
                    <li><Link className="row-link btn-text" href="/dashboard/duties">See all {attention.length}</Link></li>
                  )}
                </ul>
              ) : recent.length ? (
                <>
                  <p className="safe-note"><Icon name="check" />Nothing is waiting. Last submitted:</p>
                  <ul className="rowlist">
                    {recent.map((d) => {
                      const rec = records[d.id];
                      const t = summarise(studentsForDuty(d).length, rec?.statuses);
                      return (
                        <li key={d.id}>
                          <Link className="row-link" href={`/dashboard/duties/${d.id}`}>
                            <span className="row-time">{fmtClock(rec?.submittedAt) || fmtTime(d.end)}</span>
                            <span className="row-body">
                              <span className="cell-main" style={{ display: "block" }}>{d.checkpoint}</span>
                              <span className="cell-sub">{d.group} · by {staffName(rec?.submittedBy) || "—"}</span>
                            </span>
                            <span className="row-side">
                              <span>{t.accounted} of {t.total}</span>
                              {t.absent > 0 && <Chip tone="bad">{t.absent} absent</Chip>}
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </>
              ) : (
                <p className="safe-note quiet"><Icon name="check" />Nothing is waiting{isToday && next ? `. Next is ${next.checkpoint} at ${fmtTime(next.start)}.` : "."}</p>
              )}
            </section>

            {showAlerts ? (
              <section className="panel" aria-labelledby="alerts-title">
                <div className="panel-head">
                  <h2 className="panel-title" id="alerts-title">Children to account for</h2>
                  <span className="panel-note">{open.length ? `${open.length} open` : alerts.length ? "All accounted for" : ""}</span>
                </div>
                {loading ? <Skeleton rows={3} /> : alerts.length === 0 ? (
                  <p className="safe-note"><Icon name="check" />Every child is accounted for.</p>
                ) : (
                  <div style={{ paddingBottom: 8 }}>
                    {alerts.slice(0, 6).map((a) => (
                      <div key={a.id} className={`alert-item${a.resolution ? " resolved" : a.kind === ALERT_KIND.NOT_SEEN ? " not-seen" : ""}`}>
                        <div>
                          <p className="alert-name">{a.student.name}</p>
                          <p className="cell-sub">Class {a.student.label}{a.student.house ? ` · ${a.student.house}` : ""}</p>
                          <p className="alert-desc">{describeAlert(a)}</p>
                          {a.resolution && <p className="alert-remark">{a.resolution.remark} ({staffName(a.resolution.resolvedBy) || "staff"}, {fmtClock(a.resolution.resolvedAt)})</p>}
                        </div>
                        <div style={{ display: "grid", gap: 10, justifyItems: "end", alignContent: "start" }}>
                          {!a.resolution && (a.kind === ALERT_KIND.WENT_MISSING ? <Chip tone="bad">Went missing</Chip> : <Chip tone="wait">Not seen today</Chip>)}
                          {canCloseAlerts(user.role) && (
                            <button className={`btn btn-sm ${a.resolution ? "btn-ghost" : "btn-primary"}`} onClick={() => setResolving(a)}>
                              {a.resolution ? "Change note" : "Account for"}
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            ) : (
              <section className="panel" aria-labelledby="how-title">
                <div className="panel-head"><h2 className="panel-title" id="how-title">How to mark a register</h2></div>
                <ol style={{ margin: 0, padding: "0 24px 24px 48px", display: "grid", gap: 10 }}>
                  <li>Open the checkpoint from <b>Right now</b> or <b>Duties</b>.</li>
                  <li>Everyone starts as <b>Present</b>. Press <b>Absent</b>, <b>Home</b> or <b>Sick</b> only for children who are not there.</li>
                  <li>Press the big button at the bottom to submit. The office is told straight away.</li>
                </ol>
              </section>
            )}
          </div>
        </>
      )}

      <ResolveAlert alert={resolving} staffId={user.id} onClose={() => setResolving(null)} onResolved={apply} />
      {day > todayISO() && <p className="panel-note" style={{ marginTop: 16 }}>This day is still to come. Its checkpoints appear the night before.</p>}
    </>
  );
}
