"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { fetchStudents } from "../lib/students";
import { fetchStaff } from "../lib/staff";
import { HOUR, MINUTE, cacheAge, cached, invalidate } from "../lib/cache";
import {
  fetchDuties,
  fetchAttendanceFor,
  resolveGroup,
  submitDuty as submitDutyToDb,
  overrideAttendance as overrideAttendanceInDb,
  reassignDuty as reassignDutyInDb,
} from "../lib/duties";
import { fetchHoliday, declareHoliday as declareHolidayInDb, cancelHoliday as cancelHolidayInDb } from "../lib/holidays";
import {
  fetchOpenLeaves,
  signStudentOut as signStudentOutInDb,
  signStudentIn as signStudentInInDb,
} from "../lib/leave";
import { todayISO } from "../utils/format";

/**
 * One source of truth for students, duties and attendance.
 *
 * Every screen reads from here rather than fetching its own copy, so a change
 * made by one role is visible to the others. Without this, the coordinator
 * reassigning a duty and the teacher's list of duties would be two unrelated
 * views of the same row and could disagree.
 */

const SchoolDataContext = createContext(null);

export function SchoolDataProvider({ children }) {
  const [students, setStudents] = useState([]);
  const [staff, setStaff] = useState([]);
  const [duties, setDuties] = useState([]);
  const [trialSettings, setTrialSettings] = useState({});
  // { [dutyId]: { statuses: { admissionNo: code }, submittedBy, submittedAt } }
  const [records, setRecords] = useState({});
  // The declared holiday on `day`, or null. Screens need this to tell an empty
  // Duties list apart from a failed nightly generation — the two look
  // identical and mean opposite things.
  const [holiday, setHoliday] = useState(null);
  // Everyone currently signed out at the gate, as { [admissionNo]: leave }.
  // NOT scoped to `day`: a leave is open until reception closes it, so this is
  // a fact about right now, which is why the marking screen can trust it while
  // looking at any day's register.
  const [openLeaves, setOpenLeaves] = useState({});
  const [loading, setLoading] = useState(true);
  // The day every screen is working on. Today, until somebody picks another.
  //
  // Until this existed there was no route to a past day's DUTY anywhere in
  // the app — Records could read a past day back but offered no way to
  // change it, and Records is on the teacher's tab bar only. So the three
  // roles allowed to correct a submitted register (coordinator, MOD, the
  // Principal's office) could not reach one. The permission existed in the
  // database and had no button attached to it.
  const [day, setSelectedDay] = useState(todayISO());
  const selectedDayRef = useRef(day);
  const loadVersion = useRef(0);
  const followToday = useRef(true);
  const setDay = useCallback((target) => {
    followToday.current = target === todayISO();
    if (target !== selectedDayRef.current) {
      selectedDayRef.current = target;
      loadVersion.current += 1;
      // Never show yesterday's registers beneath tomorrow's date while loading.
      setDuties([]);
      setRecords({});
      setHoliday(null);
      setLoading(true);
    }
    setSelectedDay(target);
  }, []);
  useEffect(() => {
    const rollOver = () => {
      if (followToday.current) {
        const today = todayISO();
        setDay(today);
      }
    };
    const timer = setInterval(rollOver, 30000);
    const onVisible = () => {
      if (document.visibilityState === "visible") rollOver();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [setDay]);
  const [error, setError] = useState(null);
  // When the day's data was last read from the server, for "Updated 9:14 AM".
  const [lastLoaded, setLastLoaded] = useState(null);

  /**
   * Load the day. Light on the server by design (see lib/cache.js):
   *  - the register and staff list come from the saved copy when it is fresh
   *    (6 h and 30 min), so they are not re-downloaded on every visit;
   *  - a day's duties and all their marks are fetched together and kept for
   *    45 s, the marks in one paged query rather than one request per duty;
   *  - `force` re-reads the day (after a write, or the Refresh button);
   *    `everything` also re-reads the register and staff.
   * Skeletons only show when there is nothing for this day on screen yet.
   */
  const shownDay = useRef(null);
  const load = useCallback(async ({ force = false, everything = false } = {}) => {
    // A foreground event can arrive between midnight's setDay and its render.
    if (day !== selectedDayRef.current) return;
    const version = ++loadVersion.current;
    if (shownDay.current !== day) setLoading(true);
    setError(null);
    try {
      const [studentRows, staffRows, bundle, leaveMap, settings] = await Promise.all([
        cached("students", 6 * HOUR, fetchStudents, { persist: true, force: everything }),
        cached("staff", 30 * MINUTE, fetchStaff, { persist: true, force: everything }),
        cached(`day:${day}`, 45 * 1000, async () => {
          const [dutyRows, holidayRow] = await Promise.all([fetchDuties(day), fetchHoliday(day)]);
          // Marks only for duties already submitted: pending ones have none.
          const submitted = dutyRows.filter((d) => d.state === "submitted");
          const marks = await fetchAttendanceFor(submitted.map((d) => d.id));
          return { dutyRows, holidayRow, submitted, marks };
        }, { force }),
        cached("leaves", 60 * 1000, fetchOpenLeaves, { force }),
        cached("app_env", HOUR, async () => {
          const { data } = await supabase
            .from("app_env")
            .select("key,value")
            .in("key", ["trial_start", "trial_end", "attendance_mode", "attendance_scope"]);
          return Object.fromEntries((data || []).map((row) => [row.key, row.value]));
        }, { persist: true, force: everything }),
      ]);
      const { dutyRows, holidayRow, submitted, marks } = bundle;
      const entries = submitted.map((d) => [
        d.id,
        {
          statuses: marks[d.id] || {},
          submittedBy: d.submittedBy,
          submittedAt: d.submittedAt,
          correctedBy: d.correctedBy,
          correctedAt: d.correctedAt,
        },
      ]);
      if (version !== loadVersion.current) return;
      shownDay.current = day;
      setLastLoaded(Date.now());
      // Publish duties with their saved marks. A correction screen must never
      // see "submitted" before the absences have arrived.
      setRecords(Object.fromEntries(entries));
      setTrialSettings(settings);
      setStudents(studentRows);
      setStaff(staffRows);
      setDuties(dutyRows);
      setHoliday(holidayRow);
      setOpenLeaves(leaveMap);
    } catch (e) {
      if (version === loadVersion.current) setError(e.message || "Could not load school data");
    } finally {
      if (version === loadVersion.current) setLoading(false);
    }
  }, [day]);

  useEffect(() => {
    load();
  }, [load]);

  // A tab left open while colleagues submit is stale when someone comes back
  // to it. Coming back re-reads the day only if the copy is over a minute old
  // (the cache decides), and while the tab is open and visible it checks
  // every three minutes — a light read, and never while hidden.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") load();
    };
    const poll = setInterval(() => {
      if (document.visibilityState === "visible") load({ force: (cacheAge(`day:${selectedDayRef.current}`) ?? Infinity) > 3 * MINUTE - 5000 });
    }, 3 * MINUTE);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(poll);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load]);

  // Every write changes the day's duties or marks: drop the cached day so the
  // next read is fresh, without fetching now (the screen is updated locally).
  const dropDay = useCallback((d = selectedDayRef.current) => invalidate(`day:${d}`), []);

  /**
   * Cached per duty. `resolveGroup` filters and sorts the whole 415-student
   * register, and screens call this inside `renderItem` — on the Duties list
   * that was one full filter+sort per row per render, which is what made
   * scrolling stutter on a low-end phone. The cache is thrown away whenever
   * the register changes, so it can never serve a stale group.
   */
  const groupCache = useMemo(() => new Map(), [students]);
  const studentsForDuty = useCallback(
    (duty) => {
      if (!duty) return [];
      const hit = groupCache.get(duty.id);
      if (hit) return hit;
      const group = resolveGroup(duty, students);
      groupCache.set(duty.id, group);
      return group;
    },
    [groupCache, students]
  );

  const submitDuty = useCallback(
    async (dutyId, statuses, staffId) => {
      const duty = duties.find((d) => d.id === dutyId);
      if (!duty) throw new Error("That duty no longer exists.");

      // `staffId` is no longer sent: migrations/010 resolves the submitter
      // from the caller's own token. It is still used below for the optimistic
      // local update, which the next refresh replaces with the server's value.
      await submitDutyToDb({
        dutyId,
        students: resolveGroup(duty, students),
        statuses,
      });

      dropDay(duty.day);
      if (duty.day !== selectedDayRef.current) return;
      // A request started before this write may still contain "pending".
      // It must not erase a successful submission when it finally arrives.
      loadVersion.current += 1;
      setLoading(false);

      // Update locally so the UI responds immediately, then reload so every
      // screen sees the same server state.
      setRecords((prev) => ({
        ...prev,
        [dutyId]: { statuses, submittedBy: staffId, submittedAt: new Date().toISOString() },
      }));
      setDuties((prev) =>
        prev.map((d) => (d.id === dutyId ? { ...d, state: "submitted", submittedBy: staffId } : d))
      );
    },
    [duties, students, dropDay]
  );

  /**
   * Amend a record that is already submitted (SRS A6).
   *
   * Shares one database function with `submitDuty` since migrations/010, which
   * branches on the duty's own state: pending means submit, submitted means
   * correct. Keeping two entry points here is still worth it — they update
   * different local state and say different things to the user — but the app
   * can no longer ask for the wrong write, because it no longer chooses.
   */
  const overrideDuty = useCallback(
    async (dutyId, statuses, staffId) => {
      const duty = duties.find((d) => d.id === dutyId);
      if (!duty) throw new Error("That duty no longer exists.");

      // The database diffs against what is stored and returns how many marks
      // actually changed — the app no longer has to hold a `before` map and
      // hope it matches the row it is about to overwrite.
      const changed = await overrideAttendanceInDb({
        dutyId,
        students: resolveGroup(duty, students),
        statuses,
      });

      dropDay(duty.day);
      if (duty.day !== selectedDayRef.current) return changed;
      loadVersion.current += 1;
      setLoading(false);

      const correctedAt = new Date().toISOString();
      setRecords((prev) => ({
        ...prev,
        [dutyId]: { ...prev[dutyId], statuses, correctedBy: staffId, correctedAt },
      }));
      setDuties((prev) =>
        prev.map((d) =>
          d.id === dutyId ? { ...d, correctedBy: staffId, correctedAt } : d
        )
      );
      return changed;
    },
    [duties, students, dropDay]
  );

  /**
   * Declare a holiday, or cancel one.
   *
   * Both reload rather than patching local state. Declaring a holiday deletes
   * that day's pending checkpoints inside the database (migration 033), so the
   * duties list this context is holding is wrong the instant the write
   * returns — and "wrong" here means showing a teacher a register she is no
   * longer allowed to submit. A refetch is the only honest answer.
   */
  const declareHoliday = useCallback(
    async (input) => {
      const rows = await declareHolidayInDb(input);
      invalidate("day:");
      invalidate("holidays");
      await load({ force: true });
      return rows;
    },
    [load]
  );

  const cancelHoliday = useCallback(
    async (targetDay) => {
      await cancelHolidayInDb(targetDay);
      invalidate("day:");
      invalidate("holidays");
      await load({ force: true });
    },
    [load]
  );

  /**
   * The gate desk. Signing a student out changes what every later checkpoint
   * records for them, so the open-leave map is updated immediately — a
   * teacher's marking screen reads it on every row.
   *
   * The duties and marks are untouched by either call, so this deliberately
   * does NOT do a full `load()`: reception signs children in and out through
   * the day, and refetching the whole 415-student register each time would
   * make the desk unusable on a slow connection.
   */
  const signStudentOut = useCallback(async (input) => {
    const leave = await signStudentOutInDb(input);
    invalidate("leaves");
    setOpenLeaves((prev) => ({ ...prev, [leave.adm]: leave }));
    return leave;
  }, []);

  const signStudentIn = useCallback(async (adm) => {
    const leave = await signStudentInInDb(adm);
    invalidate("leaves");
    setOpenLeaves((prev) => {
      const next = { ...prev };
      delete next[adm];
      return next;
    });
    return leave;
  }, []);

  /** The open leave for one student, or null. Used per row while marking. */
  const leaveFor = useCallback((adm) => openLeaves[adm] || null, [openLeaves]);

  const reassignDuty = useCallback(async (dutyId, staffId) => {
    const duty = duties.find((d) => d.id === dutyId);
    await reassignDutyInDb(dutyId, staffId);
    dropDay(duty?.day);
    if (duty?.day !== selectedDayRef.current) return;
    loadVersion.current += 1;
    setLoading(false);
    setDuties((prev) => prev.map((d) => (d.id === dutyId ? { ...d, staffId } : d)));
  }, [duties, dropDay]);


  /** Directory lookups. `staffName` returns "" for an id that is not in the
   *  directory, so a caller can fall back rather than print "undefined". */
  const staffById = useCallback((id) => staff.find((s) => s.id === id) || null, [staff]);
  const staffName = useCallback((id) => staffById(id)?.name || "", [staffById]);

  const value = useMemo(
    () => ({
      students,
      staff,
      duties,
      trialSettings,
      records,
      loading,
      error,
      day,
      setDay,
      isToday: day === todayISO(),
      // The holiday on `day`, or null. `campusClosed` is the distinction that
      // matters to a screen: on a classes-off holiday the boarders are still
      // here and the residential checkpoints are still in the list below.
      holiday,
      campusClosed: !!holiday && !holiday.hostelCheckpoints,
      openLeaves,
      leaveFor,
      // Re-read the day from the server now (the Refresh button, a retry).
      refresh: () => load({ force: true }),
      lastLoaded,
      studentsForDuty,
      staffById,
      staffName,
      submitDuty,
      overrideDuty,
      reassignDuty,
      declareHoliday,
      cancelHoliday,
      signStudentOut,
      signStudentIn,
    }),
    [
      students,
      staff,
      duties,
      trialSettings,
      records,
      loading,
      error,
      day,
      load,
      lastLoaded,
      setDay,
      studentsForDuty,
      staffById,
      staffName,
      submitDuty,
      overrideDuty,
      reassignDuty,
      holiday,
      openLeaves,
      leaveFor,
      declareHoliday,
      cancelHoliday,
      signStudentOut,
      signStudentIn,
    ]
  );

  return <SchoolDataContext.Provider value={value}>{children}</SchoolDataContext.Provider>;
}

export function useSchoolData() {
  const ctx = useContext(SchoolDataContext);
  if (!ctx) throw new Error("useSchoolData must be used within SchoolDataProvider");
  return ctx;
}
