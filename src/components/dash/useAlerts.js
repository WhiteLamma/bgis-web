"use client";

import { createContext, createElement, useContext, useMemo } from "react";
import { useSchoolData } from "@/context/SchoolDataContext";
import { deriveAlerts } from "@/domain/alerts";
import { useResolutions } from "@/lib/alerts";
import { useNow } from "@/lib/clock";

/**
 * The day's safety alerts (SRS F1), derived from the marks exactly as the app
 * does, joined to their persisted resolutions (F4). An alert only closes when
 * someone writes a remark; nothing here resolves one automatically.
 *
 * One provider for the whole dashboard, so the sidebar's count and the Today
 * page can never disagree after a resolution.
 */
const AlertsContext = createContext(null);

export function AlertsProvider({ children }) {
  const { duties, records, studentsForDuty, day } = useSchoolData();
  const now = useNow();
  const { resolutions, apply, error } = useResolutions(day);

  const alerts = useMemo(() => {
    const derived = deriveAlerts(duties, records, studentsForDuty, now);
    return derived.map((a) => ({ ...a, resolution: resolutions[`${a.duty.id}:${a.student.adm}`] || null }));
  }, [duties, records, studentsForDuty, now, resolutions]);

  const value = useMemo(
    () => ({ alerts, open: alerts.filter((a) => !a.resolution), apply, error }),
    [alerts, apply, error]
  );

  return createElement(AlertsContext.Provider, { value }, children);
}

export function useAlerts() {
  const ctx = useContext(AlertsContext);
  if (!ctx) throw new Error("useAlerts must be used within AlertsProvider");
  return ctx;
}
