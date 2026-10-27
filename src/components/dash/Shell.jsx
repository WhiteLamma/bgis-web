"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "@/components/transition/TransitionLink";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useSchoolData } from "@/context/SchoolDataContext";
import { navGroups, tabsFor, titleFor } from "@/domain/nav";
import { DUTY_STATUS, dutyStatus } from "@/domain/duties";
import { canApproveStaff, canMark, isOversight, roleLabel } from "@/domain/roles";
import { usePendingRequests } from "@/lib/access";
import { useNow } from "@/lib/clock";
import { haptics } from "@/lib/haptics";
import { fmtClock, fmtTime } from "@/utils/format";
import { Avatar, Icon, useFeedback } from "./ui";
import ConnectionNotice from "./ConnectionNotice";

// Presses that should tick: buttons, links in the frame, rows that open something.
// (Status buttons in a register vibrate on their own, more meaningfully.)
const TAPPABLE = ".btn, .side-link, .tab-link, .row-link, tr.is-link, .seg button, .daypick button, .pick-item, .mobile-bar button, .side-out, .side-refresh";

/**
 * The frame. On a computer: a labelled sidebar in three groups, with counts on
 * the pages that need someone, a live line saying what is happening now, and
 * a Refresh button with the time the data was last read. On a phone: a top
 * bar with the page's name and a bottom tab bar, like the mobile app, with
 * everything else under "More".
 */
export default function Shell({ children, alertCount = 0 }) {
  const { user, logout } = useAuth();
  const { duties, records, isToday, refresh, lastLoaded, loading } = useSchoolData();
  const feedback = useFeedback();
  const pathname = usePathname();
  const now = useNow();
  const [open, setOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const groups = navGroups(user);
  const tabs = tabsFor(user);
  const requests = usePendingRequests(canApproveStaff(user?.role));

  // Close the "More" sheet on navigation.
  useEffect(() => setOpen(false), [pathname]);

  // A light tick on every press, anywhere in the dashboard (Android only;
  // other devices ignore it). One listener rather than one per button.
  useEffect(() => {
    const onDown = (e) => {
      if (e.pointerType !== "mouse" && e.target.closest?.(TAPPABLE)) haptics.tap();
    };
    document.addEventListener("pointerdown", onDown, { passive: true });
    return () => document.removeEventListener("pointerdown", onDown);
  }, []);

  // Escape closes the sheet.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // What the counts and the "now" line say, from the day already loaded.
  const status = useMemo(() => {
    const mine = canMark(user?.role) && !isOversight(user?.role);
    const list = (mine ? duties.filter((d) => d.staffId === user?.id) : duties).map((d) => ({
      ...d,
      status: dutyStatus(d, records, isToday ? now : 24 * 60),
    }));
    const overdue = list.filter((d) => d.status === DUTY_STATUS.OVERDUE).length;
    const due = list.filter((d) => d.status === DUTY_STATUS.DUE).sort((a, b) => a.end - b.end)[0];
    const next = list.filter((d) => d.status === DUTY_STATUS.UPCOMING).sort((a, b) => a.start - b.start)[0];
    return { overdue, due, next, total: list.length, done: list.filter((d) => d.status === DUTY_STATUS.DONE).length };
  }, [duties, records, now, isToday, user]);

  const counts = {
    "/dashboard": alertCount ? { n: alertCount, label: `${alertCount} children to account for`, tone: "bad" } : null,
    "/dashboard/duties": status.overdue ? { n: status.overdue, label: `${status.overdue} overdue`, tone: "bad" } : null,
    "/dashboard/staff": requests.requests.length ? { n: requests.requests.length, label: `${requests.requests.length} people asking for access`, tone: "info" } : null,
  };

  const isActive = (href) =>
    href === "/dashboard" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  const confirmSignOut = () => {
    setOpen(false);
    feedback.confirm({
      title: "Sign out of BG-SAAR?",
      message: "You will need your email and password to come back in. Anything you have not submitted on this computer will be lost.",
      cancelLabel: "Stay signed in",
      confirmLabel: "Sign out",
      destructive: true,
      onConfirm: logout,
    });
  };

  const doRefresh = async () => {
    setRefreshing(true);
    try {
      await refresh();
      requests.reload?.();
    } finally {
      setRefreshing(false);
    }
  };

  const nowLine = !isToday
    ? "Looking at another day"
    : status.overdue
      ? `${status.overdue} overdue`
      : status.due
        ? `${status.due.checkpoint} is open`
        : status.next
          ? `Next: ${status.next.checkpoint} at ${fmtTime(status.next.start)}`
          : status.total
            ? "All checkpoints done"
            : "No checkpoints today";

  const Count = ({ c }) => (c ? <span className={`side-count ${c.tone}`} aria-label={c.label}>{c.n}</span> : null);

  return (
    <div className="dash">
      <aside className={`side${open ? " is-open" : ""}`} aria-label="Main navigation" id="main-nav">
        <div className="side-top">
          <Link href="/dashboard" className="side-brand">
            <span className="side-crest">
              <Image src="/images/app-login-logo.png" alt="" fill sizes="52px" />
            </span>
            <span>
              <span className="side-name">BG-SAAR</span>
              <span className="side-sub">Bhaktivedanta Gurukula</span>
            </span>
          </Link>
          <button type="button" className="side-close" onClick={() => setOpen(false)} aria-label="Close menu">
            <Icon name="close" size={22} />
          </button>
        </div>

        <div className={`side-now${status.overdue && isToday ? " is-bad" : ""}`} aria-live="polite">
          <span className="side-now-time">{fmtTime(now)}</span>
          <span className="side-now-text">{nowLine}</span>
        </div>

        <nav className="side-groups">
          {groups.map((g) => (
            <div key={g.name} className="side-group">
              <p className="side-label">{g.name}</p>
              <div className="side-nav">
                {g.pages.map((p) => (
                  <Link key={p.href} href={p.href} className="side-link" aria-current={isActive(p.href) ? "page" : undefined}>
                    <Icon name={p.icon} size={22} />
                    <span className="side-link-label">{p.label}</span>
                    <Count c={counts[p.href]} />
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="side-foot">
          <button type="button" className="side-refresh" onClick={doRefresh} disabled={refreshing || loading}>
            <Icon name="refresh" size={20} className={refreshing ? "spin" : undefined} />
            <span>
              {refreshing ? "Refreshing…" : "Refresh"}
              <small>{lastLoaded ? `Updated ${fmtClock(new Date(lastLoaded).toISOString())}` : "Loading…"}</small>
            </span>
          </button>
          <Link href="/dashboard/account" className="side-user" aria-current={isActive("/dashboard/account") ? "page" : undefined}>
            <Avatar name={user?.name} url={user?.photoUrl} />
            <span style={{ minWidth: 0 }}>
              <span className="side-user-name">{user?.name}</span>
              <span className="side-user-role">{roleLabel(user?.role)}{user?.classLabel ? ` · ${user.classLabel}` : ""}</span>
            </span>
          </Link>
          <button type="button" className="side-out" onClick={confirmSignOut}>
            <Icon name="logout" size={22} />
            Sign out
          </button>
        </div>
      </aside>
      {open && <div className="side-scrim" onClick={() => setOpen(false)} aria-hidden="true" />}

      <div className="dash-body">
        <header className="mobile-bar">
          <span className="mobile-crest">
            <Image src="/images/app-login-logo.png" alt="" fill sizes="36px" />
          </span>
          <b>{titleFor(user, pathname)}</b>
          <button type="button" className="mobile-refresh" onClick={doRefresh} disabled={refreshing || loading} aria-label="Refresh">
            <Icon name="refresh" size={22} className={refreshing ? "spin" : undefined} />
          </button>
        </header>

        <main className="main">
          <div className="page">
            <ConnectionNotice />
            {children}
          </div>
        </main>

        <nav className="tabbar" aria-label="Main pages">
          {tabs.map((p) => (
            <Link key={p.href} href={p.href} className="tab-link" aria-current={isActive(p.href) ? "page" : undefined}>
              <span className="tab-icon">
                <Icon name={p.icon} size={24} />
                {counts[p.href] && <span className={`tab-dot ${counts[p.href].tone}`}>{counts[p.href].n}</span>}
              </span>
              {p.label}
            </Link>
          ))}
          <button type="button" className="tab-link" onClick={() => setOpen(true)} aria-expanded={open} aria-controls="main-nav">
            <span className="tab-icon">
              <Icon name="menu" size={24} />
              {counts["/dashboard/staff"] && <span className="tab-dot info">{counts["/dashboard/staff"].n}</span>}
            </span>
            More
          </button>
        </nav>
      </div>
    </div>
  );
}
