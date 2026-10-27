"use client";

import { useCallback, useEffect, useState } from "react";
import { useSchoolData } from "@/context/SchoolDataContext";
import { fetchHolidays } from "@/lib/holidays";
import { describeError } from "@/lib/errors";
import { fmtDay, todayISO } from "@/utils/format";
import { Chip, Empty, ErrorPanel, PageHead, Skeleton, useFeedback } from "@/components/dash/ui";

/**
 * Declared holidays. Declaring withdraws that day's pending checkpoints at
 * once (migration 033); cancelling rebuilds them. Submitted registers are
 * never touched either way.
 */
export default function HolidaysPage() {
  const { declareHoliday, cancelHoliday } = useSchoolData();
  const feedback = useFeedback();
  const [list, setList] = useState(null);
  const [error, setError] = useState(null);
  const [form, setForm] = useState({ from: todayISO(), to: "", label: "", hostelCheckpoints: true, note: "" });
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setError(null);
    fetchHolidays(todayISO()).then(setList, (e) => setError(describeError(e).message));
  }, []);
  useEffect(load, [load]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  async function declare(event) {
    event.preventDefault();
    setSaving(true);
    try {
      const rows = await declareHoliday({ ...form, to: form.to || form.from, label: form.label.trim() });
      feedback.toast(`${form.label.trim()} declared · ${rows.length} day${rows.length === 1 ? "" : "s"}`);
      setForm({ from: todayISO(), to: "", label: "", hostelCheckpoints: true, note: "" });
      load();
    } catch (e) {
      const d = describeError(e, { message: "The holiday was not declared." });
      feedback.alert({ title: d.title, message: d.message });
    } finally {
      setSaving(false);
    }
  }

  const cancel = (h) =>
    feedback.confirm({
      title: `Cancel ${h.label} on ${fmtDay(h.day)}?`,
      message: "That day's checkpoints are rebuilt and teachers will see them again.",
      confirmLabel: "Cancel holiday",
      cancelLabel: "Keep it",
      destructive: true,
      onConfirm: async () => {
        try {
          await cancelHoliday(h.day);
          feedback.toast(`${fmtDay(h.day)} is a school day again`);
          load();
        } catch (e) {
          const d = describeError(e, { message: "The holiday was not cancelled." });
          setTimeout(() => feedback.alert({ title: d.title, message: d.message }), 0);
        }
      },
    });

  return (
    <>
      <PageHead eyebrow="Calendar" title="Holidays" lede="Days the school does not take a register. Declaring one removes that day's pending checkpoints straight away." />
      <div className="grid-2">
        <section className="panel">
          <div className="panel-head"><h2 className="panel-title">Coming up</h2></div>
          {error ? <ErrorPanel message={error} onRetry={load} /> : list === null ? <Skeleton rows={4} /> : list.length === 0 ? (
            <Empty title="No holidays declared">Every day from today is a school day.</Empty>
          ) : (
            <ul className="rowlist">
              {list.map((h) => (
                <li key={h.day} className="row-link">
                  <span className="row-time">{h.day.slice(8)}<small>{new Date(h.day + "T00:00").toLocaleDateString("en-IN", { month: "short" })}</small></span>
                  <span className="row-body">
                    <span className="cell-main" style={{ display: "block" }}>{h.label}</span>
                    <span className="cell-sub">{fmtDay(h.day)}{h.note ? ` · ${h.note}` : ""}</span>
                  </span>
                  <span className="row-side">
                    <Chip tone={h.hostelCheckpoints ? "info" : "wait"}>{h.hostelCheckpoints ? "Hostel still marked" : "Campus closed"}</Chip>
                    <button className="btn btn-ghost btn-sm" onClick={() => cancel(h)}>Cancel</button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="panel panel-pad">
          <h2 className="panel-title" style={{ marginBottom: 14 }}>Declare a holiday</h2>
          <form onSubmit={declare} style={{ display: "grid", gap: 14 }}>
            <label className="field">
              <span className="field-label">Name</span>
              <input className="input" required value={form.label} onChange={set("label")} placeholder="e.g. Diwali break" />
            </label>
            <div className="form-grid">
              <label className="field">
                <span className="field-label">From</span>
                <input className="input" type="date" required min={todayISO()} value={form.from} onChange={set("from")} />
              </label>
              <label className="field">
                <span className="field-label">To (optional)</span>
                <input className="input" type="date" min={form.from} value={form.to} onChange={set("to")} />
              </label>
            </div>
            <label className="check">
              <input type="checkbox" checked={form.hostelCheckpoints} onChange={set("hostelCheckpoints")} />
              <span>Boarders stay on campus<br /><span className="cell-sub">Residential checkpoints (Mangalarati, meals, night) still run. Untick to close the campus.</span></span>
            </label>
            <label className="field">
              <span className="field-label">Note</span>
              <input className="input" value={form.note} onChange={set("note")} placeholder="Optional" />
            </label>
            <button className="btn btn-primary" disabled={saving}>{saving ? "Declaring…" : "Declare holiday"}</button>
          </form>
        </section>
      </div>
    </>
  );
}
