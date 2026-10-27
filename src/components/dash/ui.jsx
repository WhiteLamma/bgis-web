"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { fmtDay, fmtDayCompact, initial, todayISO } from "@/utils/format";
import { addDays } from "@/lib/report";
import { haptics } from "@/lib/haptics";

/* ---------- Icons: one stroke family, drawn for 20px ---------- */

const PATHS = {
  today: <><rect x="3.5" y="4.5" width="17" height="16" rx="2.5" /><path d="M3.5 9.5h17M8 2.5v4M16 2.5v4" /><circle cx="12" cy="15" r="1.6" /></>,
  duties: <><path d="M9 6h11M9 12h11M9 18h11" /><path d="m3.5 6 1.3 1.3L7 5M3.5 12l1.3 1.3L7 11M3.5 18l1.3 1.3L7 17" /></>,
  students: <><circle cx="9" cy="8" r="3.2" /><path d="M3 19.5c.6-3.3 3-5 6-5s5.4 1.7 6 5" /><path d="M15.5 4.9a3.2 3.2 0 0 1 0 6.2M17.6 14.7c1.7.7 2.9 2.4 3.3 4.8" /></>,
  staff: <><rect x="3.5" y="6.5" width="17" height="13" rx="2.5" /><path d="M9 6.5V5a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 5v1.5M3.5 12h17" /></>,
  gate: <><path d="M4 20.5V9l8-5.5L20 9v11.5" /><path d="M9 20.5v-6h6v6M4 20.5h16" /></>,
  holiday: <><path d="M12 3v2M12 19v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M3 12h2M19 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" /><circle cx="12" cy="12" r="4" /></>,
  activity: <><path d="M3 12h4l3-7 4 14 3-7h4" /></>,
  reports: <><path d="M7 3.5h7l4.5 4.5v12.5h-11.5Z" /><path d="M14 3.5V8h4.5M9.5 13h6M9.5 16.5h6" /></>,
  account: <><circle cx="12" cy="8.5" r="3.8" /><path d="M4.5 20.5c.9-3.9 3.8-6 7.5-6s6.6 2.1 7.5 6" /></>,
  logout: <><path d="M14 4.5h4.5a1.5 1.5 0 0 1 1.5 1.5v12a1.5 1.5 0 0 1-1.5 1.5H14M9.5 16.5 5 12l4.5-4.5M5 12h10" /></>,
  menu: <><path d="M4 7h16M4 12h16M4 17h16" /></>,
  left: <path d="m14.5 5.5-6.5 6.5 6.5 6.5" />,
  right: <path d="m9.5 5.5 6.5 6.5-6.5 6.5" />,
  search: <><circle cx="10.5" cy="10.5" r="6" /><path d="m15 15 5 5" /></>,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  alert: <><path d="M12 3.5 2.5 20h19Z" /><path d="M12 10v4.5M12 17.2v.3" /></>,
  lock: <><rect x="5" y="10.5" width="14" height="10" rx="2" /><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5.5M12 7.8v.3" /></>,
  print: <><path d="M7 8.5V3.5h10v5M7 17.5H4.5v-7a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v7H17" /><rect x="7" y="14" width="10" height="6.5" /></>,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  swap: <><path d="M4 8h13l-3.5-3.5M20 16H7l3.5 3.5" /></>,
  refresh: <><path d="M20 12a8 8 0 1 1-2.34-5.66" /><path d="M20 4v4.5h-4.5" /></>,
  phone: <><rect x="7" y="2.5" width="10" height="19" rx="2.5" /><path d="M11 18.5h2" /></>,
  wifiOff: <><path d="m3 3 18 18M8.5 16.4a5 5 0 0 1 7 0M5 12.9a10 10 0 0 1 4.2-2.6M19 12.9a10 10 0 0 0-2.2-1.6M2 9.3a15 15 0 0 1 4.5-2.8M22 9.3a15 15 0 0 0-8.6-3.7" /><circle cx="12" cy="19.5" r=".6" /></>,
  camera: <><path d="M4 8.5h3l1.8-2.5h6.4L17 8.5h3v10.5H4Z" /><circle cx="12" cy="13.5" r="3.4" /></>,
};

export function Icon({ name, size = 20, ...rest }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}>
      {PATHS[name]}
    </svg>
  );
}

/* ---------- Small pieces ---------- */

export const Chip = ({ tone = "quiet", children, plain }) => (
  <span className={`chip ${tone}${plain ? " plain" : ""}`}>{children}</span>
);

export function Avatar({ name, url, size }) {
  return (
    <span className={`avatar${size === "lg" ? " lg" : ""}`}>
      {url ? <img src={url} alt="" /> : initial(name)}
    </span>
  );
}

/**
 * The page title, then a grey line naming the day or scope (`eyebrow`, kept
 * as the prop name, now set below the title in sentence case), then an
 * optional plain sentence. `fact` is a second title line set in grey: the
 * one thing the data says today.
 */
export function PageHead({ eyebrow, title, fact, lede, children }) {
  return (
    <header className="page-head">
      <div>
        <h1 className="page-title">
          {title}
          {fact && <span className="page-title-fact">{fact}</span>}
        </h1>
        {eyebrow && <p className="page-sub">{eyebrow}</p>}
        {lede && <p className="page-lede">{lede}</p>}
      </div>
      {children && <div className="head-actions">{children}</div>}
    </header>
  );
}

export function Empty({ title, children, action }) {
  return (
    <div className="empty">
      {title && <p className="empty-title">{title}</p>}
      {children && <p>{children}</p>}
      {action && <div style={{ marginTop: 16 }}>{action}</div>}
    </div>
  );
}

export function Skeleton({ rows = 4 }) {
  return (
    <div style={{ padding: "12px 24px 24px", display: "grid", gap: 20 }} aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="skeleton" style={{ height: 24, width: `${92 - (i % 4) * 12}%` }} />
      ))}
    </div>
  );
}

export function ErrorPanel({ message, onRetry }) {
  return (
    <div className="panel">
      <Empty title="Couldn't load this" action={onRetry && <button className="btn btn-ghost" onClick={onRetry}>Try again</button>}>
        {message}
      </Empty>
    </div>
  );
}

/** Previous / date / next. The date opens the browser's own date picker. */
export function DayPicker({ day, onChange, allowFuture = true }) {
  const today = todayISO();
  return (
    <div className="daypick">
      <button type="button" onClick={() => onChange(addDays(day, -1))} aria-label="Previous day" title="Previous day"><Icon name="left" size={22} /></button>
      <label title="Choose a day">
        {fmtDay(day) === "Today" ? "Today" : fmtDayCompact(day)}
        <input type="date" value={day} max={allowFuture ? undefined : today} onChange={(e) => e.target.value && onChange(e.target.value)} aria-label="Choose a day" />
      </label>
      <button type="button" onClick={() => onChange(addDays(day, 1))} disabled={!allowFuture && day >= today} aria-label="Next day" title="Next day"><Icon name="right" size={22} /></button>
      {day !== today && <button type="button" className="daypick-today" onClick={() => onChange(today)}>Back to today</button>}
    </div>
  );
}

export function Segmented({ options, value, onChange, label }) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={value === o.value} onClick={() => onChange(o.value)}>{o.label}</button>
      ))}
    </div>
  );
}

/* ---------- Dialogs and toasts, one of each for the whole dashboard ---------- */

const FeedbackContext = createContext(null);

export function FeedbackProvider({ children }) {
  const [dialog, setDialog] = useState(null);
  const [toast, setToast] = useState(null);
  const ref = useRef(null);
  const timer = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (dialog && !el.open) el.showModal();
    if (!dialog && el.open) el.close();
  }, [dialog]);

  const close = useCallback(() => setDialog(null), []);

  const alert = useCallback((opts) => {
    if (opts.destructive) haptics.error();
    setDialog({ ...opts, kind: "alert" });
  }, []);
  const confirm = useCallback((opts) => {
    // A warning pulse before anything that cannot be taken back.
    if (opts.destructive) haptics.warn();
    setDialog({ ...opts, kind: "confirm" });
  }, []);
  const show = useCallback((message) => {
    clearTimeout(timer.current);
    setToast(message);
    timer.current = setTimeout(() => setToast(null), 3600);
  }, []);

  const [busy, setBusy] = useState(false);
  const onConfirm = async () => {
    if (!dialog?.onConfirm) return close();
    setBusy(true);
    try {
      await dialog.onConfirm();
    } finally {
      setBusy(false);
      close();
    }
  };

  return (
    <FeedbackContext.Provider value={{ alert, confirm, toast: show }}>
      {children}
      <dialog className="dlg" ref={ref} onClose={close} onClick={(e) => e.target === ref.current && !busy && close()}>
        {dialog && (
          <>
            <div className="dlg-body">
              <h2 className="dlg-title">{dialog.title}</h2>
              {dialog.message && <p className="dlg-text">{dialog.message}</p>}
              {dialog.body}
            </div>
            <div className="dlg-actions">
              {dialog.kind === "confirm" && (
                <button className="btn btn-ghost" onClick={close} disabled={busy}>{dialog.cancelLabel || "Cancel"}</button>
              )}
              <button className={`btn ${dialog.destructive ? "btn-danger" : "btn-primary"}`} onClick={onConfirm} disabled={busy} autoFocus>
                {busy ? "Working…" : dialog.confirmLabel || "Okay"}
              </button>
            </div>
          </>
        )}
      </dialog>
      {toast && <div className="toast" role="status"><Icon name="check" size={18} />{toast}</div>}
    </FeedbackContext.Provider>
  );
}

export function useFeedback() {
  const ctx = useContext(FeedbackContext);
  if (!ctx) throw new Error("useFeedback must be used within FeedbackProvider");
  return ctx;
}
