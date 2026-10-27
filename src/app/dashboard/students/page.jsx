"use client";

import { useMemo, useState } from "react";
import { useTransitionRouter as useRouter } from "@/components/transition/PageTransition";
import { useAuth } from "@/context/AuthContext";
import { useSchoolData } from "@/context/SchoolDataContext";
import { isOversight } from "@/domain/roles";
import { classIncludesStudent } from "@/domain/classGroups";
import { statusLabel } from "@/domain/status";
import { plural } from "@/utils/format";
import { Chip, Empty, ErrorPanel, Icon, PageHead, Segmented, Skeleton } from "@/components/dash/ui";

const TYPE_LABEL = { R: "Residential", D: "Day scholar", V: "Vedic", B: "Day boarding" };

/**
 * The register. Oversight and the nurse see the school; a class teacher sees
 * their own class (the database narrows it the same way under RLS).
 */
export default function StudentsPage() {
  const { user } = useAuth();
  const { students, loading, error, refresh, openLeaves } = useSchoolData();
  const router = useRouter();
  const wholeSchool = isOversight(user.role) || user.role === "nurse";

  const [query, setQuery] = useState("");
  const [cls, setCls] = useState(wholeSchool ? "all" : user.classKey || "all");
  const [type, setType] = useState("all");

  const classes = useMemo(() => {
    const seen = new Map();
    students.forEach((s) => !seen.has(s.key) && seen.set(s.key, { key: s.key, label: s.label, grade: s.grade }));
    return [...seen.values()].sort((a, b) => a.grade - b.grade || a.label.localeCompare(b.label));
  }, [students]);

  const pool = wholeSchool ? students : students.filter((s) => user.classKey && classIncludesStudent(user.classKey, s));
  const q = query.trim().toLowerCase();
  const visible = pool
    .filter((s) => cls === "all" || s.key === cls || (!wholeSchool && classIncludesStudent(cls, s)))
    .filter((s) => type === "all" || (type === "res" ? s.type !== "D" : s.type === "D"))
    .filter((s) => !q || s.name.toLowerCase().includes(q) || String(s.adm).toLowerCase().includes(q));

  const away = visible.filter((s) => openLeaves[s.adm]).length;

  return (
    <>
      <PageHead
        eyebrow={wholeSchool ? "Register" : user.classLabel || "Your class"}
        title="Students"
        lede={wholeSchool ? `${plural(students.length, "student")} on the active register.` : "Your class register. Open a student for their attendance record."}
      />

      <section className="panel">
        <div className="toolbar">
          <div className="search">
            <Icon name="search" size={17} />
            <input className="input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name or admission no." aria-label="Search students" />
          </div>
          {wholeSchool && (
            <select className="select" style={{ width: "auto", minHeight: 38 }} value={cls} onChange={(e) => setCls(e.target.value)} aria-label="Class">
              <option value="all">All classes</option>
              {classes.map((c) => <option key={c.key} value={c.key}>Class {c.label}</option>)}
            </select>
          )}
          <Segmented label="Student type" value={type} onChange={setType} options={[{ value: "all", label: "All" }, { value: "res", label: "Residential" }, { value: "day", label: "Day" }]} />
          <span className="panel-note" style={{ marginLeft: "auto" }}>
            {loading ? "" : `${plural(visible.length, "student")}${away ? ` · ${away} off campus` : ""}`}
          </span>
        </div>

        {error ? <ErrorPanel message={error} onRetry={refresh} /> : loading ? <Skeleton rows={8} /> : visible.length === 0 ? (
          <Empty title="No students match">Try a different search or class.</Empty>
        ) : (
          <div className="table-wrap">
            <table className="table stack">
              <thead>
                <tr>
                  <th>Roll</th>
                  <th>Name</th>
                  <th>Class</th>
                  <th>Type</th>
                  <th>House</th>
                  <th>Adm. no.</th>
                  <th>Now</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((s) => {
                  const leave = openLeaves[s.adm];
                  return (
                    <tr key={s.adm} className="is-link" onClick={() => router.push(`/dashboard/students/${encodeURIComponent(s.adm)}`)}>
                      <td className="cell-sub" data-label="Roll">{s.roll ?? "—"}</td>
                      <td className="cell-main">{s.name}{s.remedial && <span className="cell-sub"> · remedial</span>}</td>
                      <td data-label="Class">{s.label}</td>
                      <td data-label="Type">{TYPE_LABEL[s.type] || "—"}</td>
                      <td data-label="House">{s.house || <span className="cell-sub">—</span>}</td>
                      <td className="cell-sub" data-label="Admission no.">{s.adm}</td>
                      <td className="stack-corner">{leave ? <Chip tone="info">{statusLabel(leave.status)} since {leave.outDay.slice(5)}</Chip> : <Chip tone="ok" plain>On campus</Chip>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
