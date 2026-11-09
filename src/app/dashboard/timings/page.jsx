"use client";

import { useCallback, useEffect, useState } from "react";
import { useSchoolData } from "@/context/SchoolDataContext";
import { fetchCheckpoints, saveCheckpointTime, toInput, fromInput } from "@/lib/timings";
import { describeError } from "@/lib/errors";
import { fmtTime } from "@/utils/format";
import { Empty, ErrorPanel, PageHead, Skeleton, useFeedback } from "@/components/dash/ui";

const endLabel = (min) => (min >= 1440 ? "midnight" : fmtTime(min));

/**
 * The day's timetable. One row per checkpoint; change a time and a Save
 * appears on that row only. An end of 00:00 means midnight.
 */
export default function TimingsPage() {
  const { refresh } = useSchoolData();
  const feedback = useFeedback();
  const [list, setList] = useState(null);
  const [error, setError] = useState(null);
  const [draft, setDraft] = useState({});
  const [saving, setSaving] = useState(null);

  const load = useCallback(() => {
    setError(null);
    fetchCheckpoints().then(setList, (e) => setError(describeError(e).message));
  }, []);
  useEffect(load, [load]);

  const edit = (id, key) => (e) =>
    setDraft((d) => ({ ...d, [id]: { ...d[id], [key]: e.target.value } }));

  async function save(cp) {
    const start = fromInput(draft[cp.id]?.start ?? toInput(cp.start));
    let end = fromInput(draft[cp.id]?.end ?? toInput(cp.end));
    if (end === 0) end = 1440;
    if (start === null || end === null || end <= start) {
      feedback.alert({ title: "Check the times", message: "The window has to end after it starts. Use 00:00 for midnight." });
      return;
    }
    setSaving(cp.id);
    try {
      await saveCheckpointTime(cp, start, end);
      feedback.toast(`${cp.name} · ${fmtTime(start)} – ${endLabel(end)}`);
      setDraft(({ [cp.id]: _, ...rest }) => rest);
      load();
      refresh();
    } catch (e) {
      const d = describeError(e, { message: "The time was not saved." });
      feedback.alert({ title: d.title, message: d.message });
    } finally {
      setSaving(null);
    }
  }

  return (
    <>
      <PageHead
        title="Timings"
        lede="When each checkpoint opens. Changes apply to every register straight away, including today's."
      />
      <section className="panel">
        {error ? <ErrorPanel message={error} onRetry={load} /> : list === null ? <Skeleton rows={6} /> : list.length === 0 ? (
          <Empty title="No checkpoints">Add checkpoints from the app's Checkpoints & groups screen.</Empty>
        ) : (
          <ul className="rowlist">
            {list.map((cp) => {
              const d = draft[cp.id] || {};
              const dirty = (d.start != null && d.start !== toInput(cp.start)) || (d.end != null && d.end !== toInput(cp.end));
              return (
                <li key={cp.id} className="row-link timing-row">
                  <span className="row-time">{fmtTime(cp.start)}<small>to {endLabel(cp.end)}</small></span>
                  <span className="row-body"><span className="cell-main" style={{ display: "block" }}>{cp.name}</span></span>
                  <span className="row-side">
                    <label className="timing-field">
                      <span>From</span>
                      <input type="time" className="input" value={d.start ?? toInput(cp.start)} onChange={edit(cp.id, "start")} />
                    </label>
                    <label className="timing-field">
                      <span>To</span>
                      <input type="time" className="input" value={d.end ?? toInput(cp.end)} onChange={edit(cp.id, "end")} />
                    </label>
                    {dirty && (
                      <button className="btn btn-primary btn-sm" onClick={() => save(cp)} disabled={saving === cp.id}>
                        {saving === cp.id ? "Saving…" : "Save"}
                      </button>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      <p className="cell-sub" style={{ margin: "12px 4px" }}>To end at midnight, set To as 00:00. Who marks a register is changed from Duties.</p>
    </>
  );
}
