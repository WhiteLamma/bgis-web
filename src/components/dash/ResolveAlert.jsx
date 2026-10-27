"use client";

import { useEffect, useRef, useState } from "react";
import { QUICK_REASONS, describeAlert } from "@/domain/alerts";
import { resolveAlert } from "@/lib/alerts";
import { describeError } from "@/lib/errors";

/**
 * Close a safety alert with a written remark (SRS F4). A quick reason fills
 * the remark; the remark itself is required, because the person reading the
 * log tomorrow needs to know where the child was.
 */
export default function ResolveAlert({ alert, staffId, onClose, onResolved }) {
  const ref = useRef(null);
  const [remark, setRemark] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (alert && !ref.current.open) {
      setRemark(alert.resolution?.remark || "");
      setError("");
      ref.current.showModal();
    }
  }, [alert]);

  async function save(event) {
    event.preventDefault();
    if (!remark.trim()) return;
    setSaving(true);
    setError("");
    try {
      const res = await resolveAlert({
        dutyId: alert.duty.id,
        admissionNo: alert.student.adm,
        kind: alert.kind,
        remark: remark.trim(),
        staffId,
      });
      onResolved(res);
      ref.current.close();
    } catch (e) {
      setError(describeError(e, { message: "The remark was not saved. Try again." }).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <dialog className="dlg" ref={ref} onClose={onClose} onClick={(e) => e.target === ref.current && !saving && ref.current.close()}>
      {alert && (
        <form onSubmit={save}>
          <div className="dlg-body">
            <h2 className="dlg-title">Where is {alert.student.name}?</h2>
            <p className="page-sub" style={{ marginTop: 4 }}>Class {alert.student.label} · Admission no. {alert.student.adm}</p>
            <p className="dlg-text">{describeAlert(alert)}</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, margin: "16px 0 12px" }}>
              {QUICK_REASONS.map((r) => (
                <button key={r.id} type="button" className="btn btn-ghost btn-sm" aria-pressed={remark === r.label} onClick={() => setRemark(r.label)}>
                  {r.label}
                </button>
              ))}
            </div>
            <label className="field">
              <span className="field-label">What did you find out?</span>
              <textarea className="textarea" value={remark} onChange={(e) => setRemark(e.target.value)} required placeholder="Where the child is, and who confirmed it" />
            </label>
            {error && <p style={{ color: "var(--negative)", marginTop: 10 }}>{error}</p>}
          </div>
          <div className="dlg-actions">
            <button type="button" className="btn btn-ghost" onClick={() => ref.current.close()} disabled={saving}>Cancel</button>
            <button className="btn btn-primary" disabled={saving || !remark.trim()}>{saving ? "Saving…" : "Save and close"}</button>
          </div>
        </form>
      )}
    </dialog>
  );
}
