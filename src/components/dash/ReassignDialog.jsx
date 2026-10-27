"use client";

import { useEffect, useRef, useState } from "react";
import { roleLabel } from "@/domain/roles";
import { describeError } from "@/lib/errors";
import { fmtDay, fmtTime } from "@/utils/format";
import { Avatar, Icon } from "./ui";

/**
 * Give a duty to someone else for one day (SRS B2). A searchable list of
 * people to tap, rather than a dropdown: large targets, names in full, and
 * the person's role and class beside each so nobody picks the wrong Krishna.
 */
export default function ReassignDialog({ duty, staff, staffName, onReassign, onClose, onDone }) {
  const ref = useRef(null);
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (duty && !ref.current.open) {
      setQuery("");
      setPicked(duty.staffId || null);
      setError("");
      ref.current.showModal();
    }
  }, [duty]);

  const people = staff.filter((s) => s.role !== "nurse" && s.role !== "reception");
  const q = query.trim().toLowerCase();
  const shown = q ? people.filter((s) => s.name.toLowerCase().includes(q) || (s.classLabel || "").toLowerCase().includes(q)) : people;

  async function save(event) {
    event.preventDefault();
    if (!picked || picked === duty.staffId) return ref.current.close();
    setSaving(true);
    setError("");
    try {
      await onReassign(duty.id, picked);
      onDone(`${duty.checkpoint} (${duty.group}) is now with ${staffName(picked)}`);
      ref.current.close();
    } catch (e) {
      setError(describeError(e, { message: "The duty was not moved. Try again." }).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <dialog className="dlg" ref={ref} onClose={onClose} onClick={(e) => e.target === ref.current && !saving && ref.current.close()} aria-labelledby="reassign-title">
      {duty && (
        <form onSubmit={save}>
          <div className="dlg-body">
            <h2 className="dlg-title" id="reassign-title">Give this duty to someone else</h2>
            <p className="dlg-text">
              <b style={{ color: "var(--text)" }}>{duty.checkpoint}</b>, {duty.group}
              <br />
              {fmtDay(duty.day)}, {fmtTime(duty.start)} to {fmtTime(duty.end)}. Only this day changes; the weekly roster stays the same.
            </p>
            <label className="field">
              <span className="field-label">Who should take it?</span>
              <span className="search" style={{ display: "block" }}>
                <Icon name="search" size={20} />
                <input className="input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Type a name" autoComplete="off" />
              </span>
            </label>
            <div className="pick-list" role="radiogroup" aria-label="Staff">
              {shown.map((s) => (
                <label key={s.id} className="pick-item">
                  <input type="radio" name="reassign-to" value={s.id} checked={picked === s.id} onChange={() => setPicked(s.id)} />
                  <Avatar name={s.name} url={s.photoUrl} />
                  <span style={{ minWidth: 0 }}>
                    <b>{s.name}{s.id === duty.staffId ? " (has it now)" : ""}</b>
                    <small>{roleLabel(s.role)}{s.classLabel ? ` · ${s.classLabel}` : ""}</small>
                  </span>
                </label>
              ))}
              {shown.length === 0 && <p className="panel-note" style={{ padding: "12px 4px" }}>Nobody matches “{query}”.</p>}
            </div>
            {error && <p style={{ color: "var(--negative)", marginTop: 12 }}>{error}</p>}
          </div>
          <div className="dlg-actions">
            <button type="button" className="btn btn-ghost" onClick={() => ref.current.close()} disabled={saving}>Cancel</button>
            <button className="btn btn-primary" disabled={saving || !picked || picked === duty.staffId}>
              {saving ? "Moving…" : picked && picked !== duty.staffId ? `Give to ${staffName(picked).split(" ")[0]}` : "Choose a person"}
            </button>
          </div>
        </form>
      )}
    </dialog>
  );
}
