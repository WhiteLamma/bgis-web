"use client";

import { useEffect, useMemo, useState } from "react";
import { useNotifications } from "@/context/NotificationsContext";
import { fmtClock, fmtDay, plural } from "@/utils/format";
import { Empty, ErrorPanel, Icon, PageHead, Segmented, Skeleton } from "@/components/dash/ui";

/** The local calendar day of a timestamp, as "2026-11-10". */
const localDay = (ts) => {
  const d = new Date(ts);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/**
 * Every sign-out and sign-in at the gate, newest first, grouped by day — the
 * web version of the app's NotificationsScreen (migration 047). Nothing here
 * is ever deleted; opening a notice marks it read for you only.
 */
export default function NotificationsPage() {
  const { enabled, items, unread, loading, error, refresh, markRead, markAllRead, describe } = useNotifications();
  const [filter, setFilter] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  // Default: Unread when there is something unread, else All — decided once
  // the first list arrives, never flipped under the reader afterwards.
  useEffect(() => {
    if (filter === null && !loading && (items.length || !enabled)) setFilter(unread > 0 ? "unread" : "all");
  }, [filter, loading, items.length, unread, enabled]);
  const shown = filter || "all";

  const visible = useMemo(
    () =>
      items.filter((n) =>
        shown === "unread" ? !n.read : shown === "out" ? n.kind === "student_out" : shown === "in" ? n.kind === "student_in" : true
      ),
    [items, shown]
  );

  const groups = useMemo(() => {
    const out = [];
    for (const n of visible) {
      const day = localDay(n.at);
      let g = out[out.length - 1];
      if (!g || g.day !== day) out.push((g = { day, items: [] }));
      g.items.push(n);
    }
    return out;
  }, [visible]);

  if (!enabled) {
    return (
      <>
        <PageHead title="Notifications" />
        <div className="panel"><Empty>Gate notifications go to coordinators, the MOD and administrators.</Empty></div>
      </>
    );
  }

  const doRefresh = async () => {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <>
      <PageHead
        title="Notifications"
        lede={unread ? `${plural(unread, "unread notice")} · every sign-out and sign-in at the gate` : "You are all caught up."}
      >
        <button className="btn btn-ghost" onClick={doRefresh} disabled={refreshing}>
          <Icon name="refresh" size={18} className={refreshing ? "spin" : undefined} />
          {refreshing ? "Refreshing…" : "Refresh"}
        </button>
      </PageHead>

      <section className="panel">
        <div className="toolbar">
          <Segmented
            label="Show"
            value={shown}
            onChange={setFilter}
            options={[
              { value: "unread", label: unread ? `Unread (${unread > 99 ? "99+" : unread})` : "Unread" },
              { value: "all", label: "All" },
              { value: "out", label: "Signed out" },
              { value: "in", label: "Signed in" },
            ]}
          />
          {unread > 0 && <button className="btn btn-text" onClick={markAllRead}>Mark all read</button>}
        </div>

        {error && items.length === 0 ? (
          <ErrorPanel message={error} onRetry={refresh} />
        ) : loading && items.length === 0 ? (
          <Skeleton rows={5} />
        ) : visible.length === 0 ? (
          <Empty title={shown === "unread" ? "Nothing unread" : "No notices yet"}>
            {shown === "unread" ? "Every gate notice has been read." : "Sign-outs and sign-ins at the gate will appear here."}
          </Empty>
        ) : (
          <div style={{ paddingBottom: 8 }}>
            {groups.map((g) => (
              <div key={g.day}>
                <h2 className="notice-day">{fmtDay(g.day)}</h2>
                <ul className="rowlist" style={{ padding: 0 }}>
                  {g.items.map((n) => {
                    const d = describe(n);
                    const out = n.kind === "student_out";
                    return (
                      <li key={n.id}>
                        <button
                          type="button"
                          className={`notice${n.read ? "" : " is-unread"}`}
                          onClick={() => !n.read && markRead([n.id])}
                          aria-label={`${n.read ? "" : "Unread. "}${d.title}. ${d.body}`}
                        >
                          <span className={`notice-icon ${out ? "out" : "in"}`}><Icon name={out ? "exit" : "enter"} size={20} /></span>
                          <span className="notice-body">
                            <span className="notice-title">{d.title}</span>
                            <span className="notice-text">{d.body}</span>
                            <span className="notice-text">
                              {fmtClock(n.at)}
                              {out && n.expectedBack ? ` · expected back ${fmtDay(n.expectedBack)}` : ""}
                            </span>
                          </span>
                          {!n.read && <span className="notice-dot" aria-hidden="true" />}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
