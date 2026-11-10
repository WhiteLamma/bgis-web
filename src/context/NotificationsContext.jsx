"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "./AuthContext";
import { useSchoolData } from "./SchoolDataContext";
import { useFeedback } from "@/components/dash/ui";
import { receivesGateNotices, roleLabel } from "@/domain/roles";
import { STATUS_META } from "@/domain/status";
import { fetchNotifications, fromRow, markNotificationsRead, subscribeNotifications } from "@/lib/notifications";

/**
 * Gate notifications for the people a missing child escalates to — every
 * sign-out and sign-in, whoever did it (migration 047). The web version of
 * the app's NotificationsContext.
 *
 *   1. live, while the dashboard is open: a toast (and a browser
 *      notification if this browser already allows them and the tab is hidden)
 *   2. on coming back to the tab: the list reloads and the unread count shows
 *   3. the Notifications page, which holds every notice, so one that was
 *      missed while the dashboard was closed is still there to read.
 *
 * For any other role this provider does nothing and `enabled` is false.
 */

const NotificationsContext = createContext({
  enabled: false,
  items: [],
  unread: 0,
  loading: false,
  error: null,
  refresh: () => {},
  markRead: async () => {},
  markAllRead: async () => {},
  describe: () => ({ title: "", body: "" }),
});

export function NotificationsProvider({ children }) {
  const { user } = useAuth();
  const { students, staffName, refreshLeaves } = useSchoolData();
  const feedback = useFeedback();
  const enabled = !!user && receivesGateNotices(user.role);
  const me = user?.id;

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const studentsByAdm = useMemo(() => new Map((students || []).map((s) => [s.adm, s])), [students]);

  const describe = useCallback(
    (n) => {
      const s = studentsByAdm.get(n.adm);
      const name = s?.name || n.adm;
      const cls = s?.label ? ` (${s.label})` : "";
      const by = n.actor
        ? n.actor === me
          ? "you"
          : `${staffName(n.actor) || "a colleague"}${n.actorRole ? ` · ${roleLabel(n.actorRole)}` : ""}`
        : "unknown";
      if (n.kind === "student_in") {
        return { title: `${name}${cls} is back on campus`, body: `Signed in by ${by}` };
      }
      const status = STATUS_META[n.status]?.label || n.status || "Away";
      const reason = n.reason ? ` — ${n.reason}` : "";
      return { title: `${name}${cls} signed out · ${status}`, body: `Signed out by ${by}${reason}` };
    },
    [studentsByAdm, staffName, me]
  );

  // Refs so the realtime callback always sees current names and helpers
  // without resubscribing every time the register reloads.
  const live = useRef({ describe, toast: feedback.toast, refreshLeaves });
  useEffect(() => {
    live.current = { describe, toast: feedback.toast, refreshLeaves };
  });

  const refresh = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    try {
      setItems(await fetchNotifications(me));
      setError(null);
    } catch (e) {
      setError(e.message || "Could not load notifications");
    } finally {
      setLoading(false);
    }
  }, [enabled, me]);

  useEffect(() => {
    if (!enabled) {
      setItems([]);
      return undefined;
    }
    refresh();

    const unsubscribe = subscribeNotifications((row) => {
      const n = fromRow(row, me);
      // The person who did it was already marked read by the trigger.
      if (n.actor && n.actor === me) n.read = true;
      setItems((prev) => (prev.some((p) => p.id === n.id) ? prev : [n, ...prev]));
      if (!n.read) {
        const d = live.current.describe(n);
        live.current.toast(d.title);
        try {
          if (typeof Notification !== "undefined" && Notification.permission === "granted" && document.visibilityState === "hidden") {
            new Notification(d.title, { body: d.body, tag: `gate-${n.id}`, icon: "/icons/icon-192.png" });
          }
        } catch {
          // Some browsers only allow notifications from a service worker.
        }
      }
      // Keep the Gate page and marking locks in step with the new leave.
      live.current.refreshLeaves?.();
    });

    // Coming back to the tab catches anything realtime missed while asleep.
    let last = Date.now();
    const onBack = () => {
      if (document.visibilityState !== "visible" || Date.now() - last < 5000) return;
      last = Date.now();
      refresh();
    };
    document.addEventListener("visibilitychange", onBack);
    window.addEventListener("focus", onBack);

    return () => {
      unsubscribe();
      document.removeEventListener("visibilitychange", onBack);
      window.removeEventListener("focus", onBack);
    };
  }, [enabled, me, refresh]);

  const markRead = useCallback(async (ids) => {
    if (!ids?.length) return;
    const set = new Set(ids);
    setItems((prev) => prev.map((n) => (set.has(n.id) ? { ...n, read: true } : n)));
    try {
      await markNotificationsRead(ids);
    } catch (e) {
      setError(e.message);
    }
  }, []);

  const markAllRead = useCallback(async () => {
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    try {
      await markNotificationsRead(null);
    } catch (e) {
      setError(e.message);
    }
  }, []);

  const unread = useMemo(() => items.filter((n) => !n.read).length, [items]);

  const value = useMemo(
    () => ({ enabled, items, unread, loading, error, refresh, markRead, markAllRead, describe }),
    [enabled, items, unread, loading, error, refresh, markRead, markAllRead, describe]
  );

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export const useNotifications = () => useContext(NotificationsContext);

/** "99+" past ninety-nine, as on the app's badge. */
export const badgeCount = (n) => (n > 99 ? "99+" : String(n));
