"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useSchoolData } from "@/context/SchoolDataContext";
import { canStartClass } from "@/domain/roles";
import { addStudent, STUDENT_TYPES } from "@/lib/students";
import { invalidate } from "@/lib/cache";
import { describeError } from "@/lib/errors";
import { haptics } from "@/lib/haptics";
import { plural } from "@/utils/format";
import { useFeedback } from "./ui";

/**
 * Add one student to the register (migration 037) — the web version of the
 * app's AddStudentSheet. Used from Students (anyone who may add) and from
 * Account (teachers, who may not have a Students page).
 *
 * A teacher picks from the classes that already exist and starts on their own
 * class; a coordinator or admin can also start a new class, which is the one
 * thing `add_student` refuses a teacher.
 */

const HOUSE_ORDER = ["Vrindavan", "Goverdhan", "Nandgaon", "Barsana"];
const houseRank = (h) => (HOUSE_ORDER.includes(h) ? HOUSE_ORDER.indexOf(h) : 100);
const NEW = "__new__";

const blank = (classKey) => ({ admissionNo: "", name: "", classKey: classKey || "", newGrade: "", newSection: "", stype: "Residential", house: "", roll: "" });

export default function AddStudentDialog({ open, onClose, onAdded }) {
  const { user } = useAuth();
  const { students, refresh } = useSchoolData();
  const feedback = useFeedback();
  const ref = useRef(null);

  const classes = useMemo(() => {
    const byKey = new Map();
    for (const s of students) {
      if (!byKey.has(s.key)) byKey.set(s.key, { key: s.key, label: s.label, grade: s.grade, students: 0 });
      byKey.get(s.key).students += 1;
    }
    return [...byKey.values()].sort((a, b) => Number(a.grade) - Number(b.grade) || a.key.localeCompare(b.key));
  }, [students]);
  const houses = useMemo(
    () => [...new Set(students.map((s) => s.house).filter(Boolean))].sort((a, b) => houseRank(a) - houseRank(b) || a.localeCompare(b)),
    [students]
  );
  const mayStartClass = canStartClass(user?.role);
  const ownClass = classes.some((c) => c.key === user?.classKey) ? user.classKey : "";

  const [f, setF] = useState(blank(ownClass));
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) {
      // A fresh form every time, on the teacher's own class.
      setF(blank(ownClass));
      setTouched(false);
      setError("");
      el.showModal();
    }
    if (!open && el.open) el.close();
    // Only on opening: the class list reloading must not wipe a half-filled form.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const set = (patch) => {
    setTouched(true);
    setError("");
    setF((prev) => ({ ...prev, ...patch }));
  };

  const creating = f.classKey === NEW;
  const cls = classes.find((c) => c.key === f.classKey) || null;
  const grade = creating ? Number(f.newGrade) : cls?.grade;
  const section = creating ? f.newSection.trim().toUpperCase() : cls?.key.split("|")[1];
  const adm = f.admissionNo.trim().toUpperCase();
  const takenBy = students.find((s) => String(s.adm).toUpperCase() === adm);

  const problem = !/^[A-Z0-9/-]{3,20}$/.test(adm)
    ? "Admission number: 3–20 letters or digits, as on the register"
    : takenBy
      ? `${adm} already belongs to ${takenBy.name} (${takenBy.label})`
      : f.name.trim().length < 2
        ? "Enter the student's full name"
        : !f.classKey
          ? "Choose the class"
          : creating && !(grade >= 1 && grade <= 12)
            ? "New class: grade 1 to 12"
            : creating && !section
              ? "New class: enter the section"
              : f.roll && !(Number(f.roll) >= 1 && Number(f.roll) <= 999)
                ? "Roll number must be 1–999, or leave it blank"
                : null;

  const nextRoll = cls ? Math.max(0, ...students.filter((s) => s.key === cls.key).map((s) => s.roll || 0)) + 1 : 1;

  async function submit(event) {
    event.preventDefault();
    setTouched(true);
    if (problem || saving) return;
    setSaving(true);
    setError("");
    try {
      const made = await addStudent({
        admissionNo: adm,
        name: f.name.trim(),
        grade,
        section,
        stype: f.stype,
        house: f.house || null,
        roll: f.roll ? Number(f.roll) : null,
      });
      haptics.success();
      feedback.toast(`${made.name} added to Class ${made.label} · roll ${made.roll}`);
      // The register is cached for hours; drop it so every page sees the child.
      invalidate("students");
      refresh();
      onAdded?.(made);
      ref.current.close();
    } catch (e) {
      setError(describeError(e, { message: "Nothing was saved. Try again." }).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <dialog className="dlg" ref={ref} onClose={onClose} onClick={(e) => e.target === ref.current && !saving && ref.current.close()} aria-labelledby="add-student-title">
      {open && (
        <form onSubmit={submit} noValidate>
          <div className="dlg-body">
            <h2 className="dlg-title" id="add-student-title">Add a student</h2>
            <p className="dlg-text">Logged under your name.</p>

            <div className="form-2">
              <label className="field">
                <span className="field-label">Admission number</span>
                <input className="input" value={f.admissionNo} onChange={(e) => set({ admissionNo: e.target.value })} placeholder="e.g. 20261042" maxLength={20} autoCapitalize="characters" autoComplete="off" spellCheck={false} autoFocus />
              </label>
              <label className="field">
                <span className="field-label">Roll number (optional)</span>
                <input className="input" inputMode="numeric" value={f.roll} onChange={(e) => set({ roll: e.target.value.replace(/[^0-9]/g, "") })} placeholder={`Leave blank for ${nextRoll}`} maxLength={3} autoComplete="off" />
              </label>
            </div>

            <label className="field">
              <span className="field-label">Full name</span>
              <input className="input" value={f.name} onChange={(e) => set({ name: e.target.value })} placeholder="As on the admission form" maxLength={80} autoComplete="off" />
            </label>

            <label className="field">
              <span className="field-label">Class</span>
              <select className="select" value={f.classKey} onChange={(e) => set({ classKey: e.target.value })}>
                <option value="">Choose class</option>
                {classes.map((c) => (
                  <option key={c.key} value={c.key}>
                    Class {c.label} · {plural(c.students, "student")}{c.key === ownClass ? " · your class" : ""}
                  </option>
                ))}
                {mayStartClass && <option value={NEW}>Start a new class…</option>}
              </select>
              {!mayStartClass && <span className="field-help">A new class is started by a coordinator.</span>}
            </label>

            {creating && (
              <div className="form-2">
                <label className="field">
                  <span className="field-label">Grade</span>
                  <input className="input" inputMode="numeric" value={f.newGrade} onChange={(e) => set({ newGrade: e.target.value.replace(/[^0-9]/g, "") })} placeholder="1–12" maxLength={2} autoComplete="off" />
                </label>
                <label className="field">
                  <span className="field-label">Section</span>
                  <input className="input" value={f.newSection} onChange={(e) => set({ newSection: e.target.value })} placeholder="e.g. KRISHNA" maxLength={20} autoCapitalize="characters" autoComplete="off" />
                </label>
              </div>
            )}

            <div className="field" role="radiogroup" aria-label="Student type">
              <span className="field-label">Student type</span>
              <div className="pick-list pick-grid" style={{ maxHeight: "none" }}>
                {STUDENT_TYPES.map((t) => (
                  <label key={t.value} className="pick-item">
                    <input type="radio" name="stype" checked={f.stype === t.value} onChange={() => set({ stype: t.value })} />
                    <span><b>{t.label}</b><small>{t.hint}</small></span>
                  </label>
                ))}
              </div>
            </div>

            <label className="field">
              <span className="field-label">House</span>
              <select className="select" value={f.house} onChange={(e) => set({ house: e.target.value })}>
                <option value="">No house yet</option>
                {houses.map((h) => <option key={h} value={h}>{h}</option>)}
              </select>
            </label>

            {(error || (touched && problem)) && <p role="alert" style={{ color: "var(--negative)", marginTop: 14 }}>{error || problem}</p>}
          </div>
          <div className="dlg-actions">
            <button type="button" className="btn btn-ghost" onClick={() => ref.current.close()} disabled={saving}>Cancel</button>
            <button className="btn btn-primary" disabled={saving || (touched && !!problem)}>{saving ? "Adding…" : "Add student"}</button>
          </div>
        </form>
      )}
    </dialog>
  );
}
