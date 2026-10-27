"use client";

import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { REPORT_FORMAT, buildReport, lastSaturday, openReport, printReport, weekStart } from "@/lib/report";
import { describeError } from "@/lib/errors";
import { canPrintReports } from "@/domain/roles";
import { fmtDay, todayISO } from "@/utils/format";
import { Icon, PageHead, useFeedback } from "@/components/dash/ui";

/**
 * The printed sheets, built from the same reportData/reportHtml the app
 * uses, so the office files one document whichever device produced it.
 * Printing goes through the browser's dialog, which also saves as PDF.
 */
export default function ReportsPage() {
  const { user } = useAuth();
  const feedback = useFeedback();
  const schoolWide = canPrintReports(user.role);
  const today = todayISO();

  const formats = [
    { id: REPORT_FORMAT.REGISTER, title: schoolWide ? "Attendance register" : `${user.classLabel || "Class"} register`, text: "Every student and every checkpoint, one row each. What goes in the file.", show: true },
    { id: REPORT_FORMAT.HEADCOUNT, title: "Headcount", text: "Counts per checkpoint, then only the children who were not present, with the reason.", show: schoolWide },
    { id: REPORT_FORMAT.SATURDAY, title: "Saturday assembly", text: "The school's own assembly sheet: grade band by house, ready for signatures.", show: schoolWide },
  ].filter((f) => f.show);

  const [format, setFormat] = useState(formats[0].id);
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [busy, setBusy] = useState(null);

  const quick = [
    { label: "Today", from: today, to: today },
    { label: "This week", from: weekStart(today), to: today },
    { label: "Last Saturday", from: lastSaturday(today), to: lastSaturday(today) },
  ];

  async function run(action) {
    setBusy(action);
    try {
      const report = await buildReport({
        from,
        to: format === REPORT_FORMAT.SATURDAY ? from : to,
        format,
        generatedBy: user.name,
        classKey: schoolWide ? null : user.classKey,
        classLabel: schoolWide ? null : user.classLabel,
      });
      if (report.empty) {
        feedback.alert({ title: "Nothing to print", message: "No checkpoints were submitted in that range." });
        return;
      }
      if (action === "print") await printReport(report.html);
      else openReport(report.html);
    } catch (e) {
      const d = describeError(e, { message: "The report could not be built." });
      feedback.alert({ title: d.title, message: d.message });
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <PageHead eyebrow="Print & file" title="Reports" lede="Build a sheet, read it on screen, or print it. Your browser's print dialog can also save it as a PDF." />

      <div className="grid-2">
        <section className="panel">
          <div className="panel-head"><h2 className="panel-title">Which sheet</h2></div>
          <ul className="rowlist">
            {formats.map((f) => (
              <li key={f.id}>
                <button className="row-link" onClick={() => setFormat(f.id)} aria-pressed={format === f.id} style={format === f.id ? { background: "var(--accent-soft)" } : undefined}>
                  <Icon name="reports" />
                  <span className="row-body">
                    <span className="cell-main" style={{ display: "block" }}>{f.title}</span>
                    <span className="cell-sub">{f.text}</span>
                  </span>
                  {format === f.id && <Icon name="check" />}
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="panel panel-pad">
          <h2 className="panel-title" style={{ marginBottom: 14 }}>Dates</h2>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
            {quick.map((qk) => (
              <button key={qk.label} className="btn btn-ghost btn-sm" onClick={() => { setFrom(qk.from); setTo(qk.to); }}>{qk.label}</button>
            ))}
          </div>
          <div className="form-grid">
            <label className="field">
              <span className="field-label">{format === REPORT_FORMAT.SATURDAY ? "Saturday" : "From"}</span>
              <input className="input" type="date" max={today} value={from} onChange={(e) => e.target.value && setFrom(e.target.value)} />
            </label>
            {format !== REPORT_FORMAT.SATURDAY && (
              <label className="field">
                <span className="field-label">To</span>
                <input className="input" type="date" max={today} value={to} onChange={(e) => e.target.value && setTo(e.target.value)} />
              </label>
            )}
          </div>
          <p className="panel-note" style={{ margin: "12px 0 18px" }}>
            {format === REPORT_FORMAT.SATURDAY || from === to ? fmtDay(from) : `${fmtDay(from < to ? from : to)} to ${fmtDay(from < to ? to : from)}`}
          </p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button className="btn btn-primary" onClick={() => run("print")} disabled={!!busy}><Icon name="print" size={18} />{busy === "print" ? "Building…" : "Print"}</button>
            <button className="btn btn-ghost" onClick={() => run("open")} disabled={!!busy}>{busy === "open" ? "Building…" : "Open in a new tab"}</button>
          </div>
        </section>
      </div>
    </>
  );
}
