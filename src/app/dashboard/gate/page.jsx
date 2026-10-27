"use client";

import { useState } from "react";
import { useSchoolData } from "@/context/SchoolDataContext";
import { SPANNING, statusLabel } from "@/domain/status";
import { describeError } from "@/lib/errors";
import { fmtClock, fmtDay, plural, todayISO } from "@/utils/format";
import { Chip, Empty, ErrorPanel, Icon, PageHead, Skeleton, useFeedback } from "@/components/dash/ui";

/**
 * The gate desk: sign a student out to family, and back in. Both are RPCs
 * (migration 034) — the database records who did it and from which day the
 * child reads as away at every checkpoint. Only signing in ends a leave.
 */
export default function GatePage() {
  const { students, openLeaves, signStudentOut, signStudentIn, loading, error, refresh } = useSchoolData();
  const feedback = useFeedback();
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState(null);
  const [status, setStatus] = useState("H");
  const [reason, setReason] = useState("");
  const [expected, setExpected] = useState("");
  const [saving, setSaving] = useState(false);

  const q = query.trim().toLowerCase();
  const matches = q.length < 2 ? [] : students.filter((s) => s.name.toLowerCase().includes(q) || String(s.adm).toLowerCase().includes(q)).slice(0, 8);
  const away = Object.values(openLeaves).sort((a, b) => (b.outAt || "").localeCompare(a.outAt || ""));
  const studentOf = (adm) => students.find((s) => s.adm === adm);

  async function signOut(event) {
    event.preventDefault();
    setSaving(true);
    try {
      await signStudentOut({ adm: picked.adm, status, reason: reason.trim(), expectedBack: expected || null });
      feedback.toast(`${picked.name} signed out · ${statusLabel(status)}`);
      setPicked(null);
      setQuery("");
      setReason("");
      setExpected("");
    } catch (e) {
      const d = describeError(e, { message: "The student was not signed out." });
      feedback.alert({ title: d.title, message: d.message });
    } finally {
      setSaving(false);
    }
  }

  const signIn = (leave) => {
    const s = studentOf(leave.adm);
    feedback.confirm({
      title: `Sign ${s?.name || leave.adm} back in?`,
      message: "They read as present again from the next checkpoint. Only do this once they are physically back on campus.",
      confirmLabel: "Sign in",
      onConfirm: async () => {
        try {
          await signStudentIn(leave.adm);
          feedback.toast(`${s?.name || leave.adm} is back on campus`);
        } catch (e) {
          const d = describeError(e, { message: "The student was not signed in." });
          setTimeout(() => feedback.alert({ title: d.title, message: d.message }), 0);
        }
      },
    });
  };

  return (
    <>
      <PageHead eyebrow="Front desk" title="Gate desk" lede="Sign students out to family and back in. While a student is out, every checkpoint records them as away." />

      <div className="grid-2">
        <section className="panel">
          <div className="panel-head">
            <h2 className="panel-title">Off campus now</h2>
            <span className="panel-note">{plural(away.length, "student")}</span>
          </div>
          {error ? <ErrorPanel message={error} onRetry={refresh} /> : loading ? <Skeleton rows={4} /> : away.length === 0 ? (
            <Empty title="Everyone is on campus">Nobody is signed out right now.</Empty>
          ) : (
            <ul className="rowlist">
              {away.map((l) => {
                const s = studentOf(l.adm);
                const overdue = l.expectedBack && l.expectedBack < todayISO();
                return (
                  <li key={l.id} className="row-link">
                    <span className="row-body">
                      <span className="cell-main" style={{ display: "block" }}>{s?.name || l.adm} <span className="cell-sub">· {s?.label}</span></span>
                      <span className="cell-sub">
                        Out {fmtDay(l.outDay)} {fmtClock(l.outAt)}{l.reason ? ` — ${l.reason}` : ""}
                        {l.expectedBack ? ` · due back ${fmtDay(l.expectedBack)}` : ""}
                      </span>
                    </span>
                    <span className="row-side">
                      {overdue && <Chip tone="bad">Late back</Chip>}
                      <Chip tone="info">{statusLabel(l.status)}</Chip>
                      <button className="btn btn-primary btn-sm" onClick={() => signIn(l)}>Sign in</button>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="panel panel-pad">
          <h2 className="panel-title" style={{ marginBottom: 14 }}>Sign a student out</h2>
          {!picked ? (
            <>
              <div className="search">
                <Icon name="search" size={17} />
                <input className="input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Name or admission no." aria-label="Find a student" autoComplete="off" />
              </div>
              <ul className="rowlist" style={{ marginTop: 10 }}>
                {matches.map((s) => (
                  <li key={s.adm}>
                    <button className="row-link" style={{ padding: "10px 4px" }} onClick={() => setPicked(s)} disabled={!!openLeaves[s.adm]}>
                      <span className="row-body">
                        <span className="cell-main" style={{ display: "block" }}>{s.name}</span>
                        <span className="cell-sub">{s.label} · Adm {s.adm}</span>
                      </span>
                      {openLeaves[s.adm] ? <Chip tone="info">Already out</Chip> : <Icon name="right" size={18} />}
                    </button>
                  </li>
                ))}
              </ul>
              {q.length >= 2 && matches.length === 0 && <p className="panel-note" style={{ marginTop: 10 }}>No student matches.</p>}
            </>
          ) : (
            <form onSubmit={signOut} style={{ display: "grid", gap: 14 }}>
              <div className="banner info" style={{ justifyContent: "space-between" }}>
                <span><b>{picked.name}</b> · {picked.label} · Adm {picked.adm}</span>
                <button type="button" className="btn-text btn" onClick={() => setPicked(null)}>Change</button>
              </div>
              <div className="field">
                <span className="field-label">Going</span>
                <div className="seg" role="group" aria-label="Status">
                  {SPANNING.map((c) => (
                    <button type="button" key={c} aria-pressed={status === c} onClick={() => setStatus(c)}>{statusLabel(c)}</button>
                  ))}
                </div>
              </div>
              <label className="field">
                <span className="field-label">Reason / collected by</span>
                <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Father, family function" />
              </label>
              <label className="field">
                <span className="field-label">Expected back</span>
                <input className="input" type="date" min={todayISO()} value={expected} onChange={(e) => setExpected(e.target.value)} />
              </label>
              <button className="btn btn-primary" disabled={saving}>{saving ? "Signing out…" : "Sign out"}</button>
            </form>
          )}
        </section>
      </div>
    </>
  );
}
