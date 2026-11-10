"use client";

import { useEffect, useRef, useState } from "react";
import { canManageStaffMember, roleLabel } from "@/domain/roles";
import { addStaffMemberWithLogin, loginDetailsText } from "@/lib/staff";
import { formatCode } from "@/lib/passwords";
import { copyText } from "@/lib/clipboard";
import { describeError } from "@/lib/errors";
import { fmtClock } from "@/utils/format";
import { Avatar, Icon, useFeedback } from "./ui";

/**
 * Staff logins with a temporary password (migration 048) — the web version
 * of the app's add-staff sheet, LoginDetailsSheet and the login part of the
 * staff member sheet in RosterScreen.
 */

/** A <dialog> that opens while `open` is truthy and reports every close. */
function useModal(open) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);
  return ref;
}

/* ---------- The ID and temporary password, to hand over ---------- */

export function LoginDetailsDialog({ details, onClose }) {
  const ref = useModal(!!details);
  const feedback = useFeedback();

  const copy = async () => {
    const ok = await copyText(loginDetailsText(details));
    feedback.toast(ok ? "Login details copied" : "Could not copy — select the text above instead");
  };

  return (
    <dialog className="dlg" ref={ref} onClose={onClose} onClick={(e) => e.target === ref.current && ref.current.close()} aria-labelledby="login-details-title">
      {details && (
        <>
          <div className="dlg-body">
            <h2 className="dlg-title" id="login-details-title">{details.title || "Login details"}</h2>
            <p className="dlg-text">Give these to {details.name}. They choose their own password on first sign-in.</p>
            <div className="login-box">
              <span className="login-box-label">ID (email)</span>
              <span className="login-box-value">{details.email}</span>
              <span className="login-box-label" style={{ marginTop: 10 }}>Temporary password</span>
              <span className="login-box-value is-password">{details.password}</span>
            </div>
            <p className="panel-note" style={{ marginTop: 12 }}>
              This password works until they replace it. After that nobody — you included — can see their password; you can only give them a new temporary one.
            </p>
          </div>
          <div className="dlg-actions">
            <button type="button" className="btn btn-ghost" onClick={() => ref.current.close()}>Done</button>
            <button type="button" className="btn btn-primary" onClick={copy} autoFocus>Copy login details</button>
          </div>
        </>
      )}
    </dialog>
  );
}

/* ---------- A one-time reset code (migration 036), shown once ---------- */

export function ResetCodeDialog({ reset, onClose }) {
  const ref = useModal(!!reset);
  return (
    <dialog className="dlg" ref={ref} onClose={onClose} aria-labelledby="reset-code-title">
      {reset && (
        <>
          <div className="dlg-body">
            <h2 className="dlg-title" id="reset-code-title">One-time reset code</h2>
            <p className="dlg-text">For {reset.name}. Give it to them yourself — do not post it in a group.</p>
            <div className="login-box" style={{ textAlign: "center" }}>
              <span className="login-box-value is-password" style={{ fontSize: 30, letterSpacing: ".12em" }} aria-label={`Code ${reset.code.split("").join(" ")}`}>
                {formatCode(reset.code)}
              </span>
            </div>
            <p className="panel-note" style={{ marginTop: 12 }}>
              On the app&apos;s sign-in screen they tap “Forgot password?”, enter {reset.email}, this code and a new password. It expires at {fmtClock(reset.expiresAt)} and works once. Closing this does not cancel it.
            </p>
          </div>
          <div className="dlg-actions">
            <button type="button" className="btn btn-primary" onClick={() => ref.current.close()} autoFocus>Done</button>
          </div>
        </>
      )}
    </dialog>
  );
}

/* ---------- Add a staff member with a login ready to use ---------- */

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function AddStaffDialog({ open, staff, classes, onClose, onAdded }) {
  const ref = useModal(open);
  const [form, setForm] = useState({ name: "", email: "", phone: "", classKey: "", random: false });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (open) {
      setForm({ name: "", email: "", phone: "", classKey: "", random: false });
      setError("");
      setTouched(false);
    }
  }, [open]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const email = form.email.trim().toLowerCase();
  const problem =
    form.name.trim().length < 2
      ? "Enter their full name"
      : !EMAIL.test(email)
        ? "Enter a valid email address"
        : staff.some((m) => (m.email || "").toLowerCase() === email)
          ? "Someone on the staff already uses that email"
          : null;

  async function submit(event) {
    event.preventDefault();
    setTouched(true);
    if (problem || saving) return;
    setSaving(true);
    setError("");
    try {
      const name = form.name.trim();
      const made = await addStaffMemberWithLogin({
        name,
        email,
        phone: form.phone.trim(),
        classKey: form.classKey || null,
        random: form.random,
      });
      onAdded({ name, email, password: made.password, title: `${name} added` });
      ref.current.close();
    } catch (e) {
      setError(describeError(e, { message: "Nothing was changed. Try again." }).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <dialog className="dlg" ref={ref} onClose={onClose} onClick={(e) => e.target === ref.current && !saving && ref.current.close()} aria-labelledby="add-staff-title">
      {open && (
        <form onSubmit={submit} noValidate>
          <div className="dlg-body">
            <h2 className="dlg-title" id="add-staff-title">Add staff member</h2>
            <p className="dlg-text">Added as a teacher with a login ready to use. You get their ID and temporary password to hand over.</p>
            <label className="field">
              <span className="field-label">Full name</span>
              <input className="input" value={form.name} onChange={set("name")} placeholder="Radha Priya Mataji" maxLength={80} autoFocus autoComplete="off" />
            </label>
            <label className="field">
              <span className="field-label">School email</span>
              <input className="input" type="email" value={form.email} onChange={set("email")} placeholder="name@gurukula.org" autoComplete="off" autoCapitalize="none" spellCheck={false} />
            </label>
            <label className="field">
              <span className="field-label">Phone (optional)</span>
              <input className="input" type="tel" value={form.phone} onChange={set("phone")} placeholder="+91 …" autoComplete="off" />
            </label>
            <label className="field">
              <span className="field-label">Class teacher of (optional)</span>
              <select className="select" value={form.classKey} onChange={set("classKey")}>
                <option value="">No class — duty staff only</option>
                {classes.map((c) => <option key={c.key} value={c.key}>Class {c.label}</option>)}
              </select>
            </label>
            <div className="field" role="radiogroup" aria-label="Temporary password">
              <span className="field-label">Temporary password</span>
              <div className="pick-list" style={{ maxHeight: "none" }}>
                <label className="pick-item">
                  <input type="radio" name="temp-kind" checked={!form.random} onChange={() => setForm((f) => ({ ...f, random: false }))} />
                  <span><b>Initial@123</b><small>The school default</small></span>
                </label>
                <label className="pick-item">
                  <input type="radio" name="temp-kind" checked={form.random} onChange={() => setForm((f) => ({ ...f, random: true }))} />
                  <span><b>Random password</b><small>A one-off password made for them</small></span>
                </label>
              </div>
            </div>
            {(error || (touched && problem)) && <p style={{ color: "var(--negative)", marginTop: 12 }}>{error || problem}</p>}
          </div>
          <div className="dlg-actions">
            <button type="button" className="btn btn-ghost" onClick={() => ref.current.close()} disabled={saving}>Cancel</button>
            <button className="btn btn-primary" disabled={saving}>{saving ? "Adding…" : "Add and create login"}</button>
          </div>
        </form>
      )}
    </dialog>
  );
}

/* ---------- One staff member: contact, login state, password actions ---------- */

/**
 * `login` is this person's row from `list_staff_logins`, or undefined when
 * the caller does not manage them (or the server has no 048) — then no login
 * line is shown at all.
 */
export function StaffDetailDialog({ member, login, me, canSeeLogins, onClose, onShowLogin, onTempPassword, onResetCode }) {
  const ref = useModal(!!member);
  const manage = !!member && canSeeLogins && member.id !== me.id && canManageStaffMember(me.role, member.role);
  // Actions close this dialog first, as in the app, so the confirm is on top.
  const then = (fn) => () => {
    const m = member;
    ref.current.close();
    fn(m);
  };

  let loginLine = null;
  if (member && canSeeLogins && login) {
    loginLine = !login.hasLogin ? (
      <div className="login-line"><Icon name="lock" size={18} /><span><b>No login yet</b><small>Create one below</small></span></div>
    ) : login.tempPassword ? (
      <button type="button" className="login-line is-button" onClick={then((m) => onShowLogin({ name: m.name, email: m.email, password: login.tempPassword }))}>
        <Icon name="key" size={18} />
        <span><b>Password: <span className="mono">{login.tempPassword}</span></b><small>Temporary — they have not changed it yet. Click to copy login details</small></span>
      </button>
    ) : (
      <div className="login-line"><Icon name="lock" size={18} /><span><b>Has set their own password</b><small>Private to them — reset it below if they forget it</small></span></div>
    );
  }

  const noLogin = login && !login.hasLogin;

  return (
    <dialog className="dlg" ref={ref} onClose={onClose} onClick={(e) => e.target === ref.current && ref.current.close()} aria-labelledby="staff-detail-title">
      {member && (
        <>
          <div className="dlg-body">
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <Avatar name={member.name} url={member.photoUrl} size="lg" />
              <div style={{ minWidth: 0 }}>
                <h2 className="dlg-title" id="staff-detail-title">{member.name}</h2>
                <p className="cell-sub">{roleLabel(member.role)}{member.classLabel ? ` · Class ${member.classLabel}` : ""}{member.id === me.id ? " · you" : ""}</p>
              </div>
            </div>
            <dl className="kv" style={{ marginTop: 18 }}>
              <dt>Email</dt><dd>{member.email || "—"}</dd>
              <dt>Phone</dt><dd>{member.phone || "—"}</dd>
            </dl>
            {loginLine && <div style={{ marginTop: 16 }}>{loginLine}</div>}
            {manage && (
              <div className="staff-actions">
                <button type="button" className="btn btn-ghost btn-block" onClick={then((m) => onTempPassword(m, false))}>
                  <Icon name="key" size={18} />{noLogin ? "Create login · Initial@123" : "Reset password to Initial@123"}
                </button>
                <button type="button" className="btn btn-ghost btn-block" onClick={then((m) => onTempPassword(m, true))}>
                  <Icon name="key" size={18} />{noLogin ? "Create login · random password" : "Reset to a random password"}
                </button>
                {login?.hasLogin !== false && (
                  <button type="button" className="btn btn-text" onClick={then(onResetCode)}>Send a reset code instead</button>
                )}
              </div>
            )}
          </div>
          <div className="dlg-actions">
            <button type="button" className="btn btn-primary" onClick={() => ref.current.close()} autoFocus>Close</button>
          </div>
        </>
      )}
    </dialog>
  );
}
