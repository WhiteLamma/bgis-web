"use client";

import { useEffect, useId, useRef, useState } from "react";

function Icon({ name }) {
  const paths = {
    mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 6 9 7 9-7" /></>,
    lock: <><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
    eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>,
    hidden: <><path d="m3 3 18 18M10.6 5.1 12 5c6.5 0 10 7 10 7a19 19 0 0 1-3 3.9M6.5 6.5A21 21 0 0 0 2 12s3.5 7 10 7a12 12 0 0 0 5.5-1.5M10 10a3 3 0 0 0 4 4" /></>,
  };
  return <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

// Layout and interactions only. The page supplies onSignIn (Supabase Auth in
// LoginGate); credentials are never stored by this component.
export default function LoginForm({ onSignIn }) {
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [help, setHelp] = useState(null);
  const dialog = useRef(null);
  const headingId = useId();

  useEffect(() => {
    if (help && !dialog.current?.open) dialog.current?.showModal();
  }, [help]);

  async function submit(event) {
    event.preventDefault();
    if (submitting) return;
    setError("");
    if (!onSignIn) {
      setError("Web sign-in is not available yet. Please continue using the BG-SAAR mobile app.");
      return;
    }
    const values = new FormData(event.currentTarget);
    setSubmitting(true);
    try {
      await onSignIn({ email: values.get("email").trim(), password: values.get("password").trim() });
    } catch (e) {
      // onSignIn throws errors already worded for the person at the keyboard.
      setError(e?.message || "Could not sign in. Please check your details and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function officeHelp(title, message) { setHelp({ title, message }); }

  return (
    <>
      <form className="login-form" onSubmit={submit}>
        {error && <div className="login-notice" role="alert">{error}</div>}
        <label className="login-label" htmlFor="login-email">Email</label>
        <div className="login-input-row">
          <Icon name="mail" />
          <input id="login-email" name="email" type="email" autoComplete="username" placeholder="you@bgis.org" spellCheck={false} autoCapitalize="none" required />
        </div>
        <label className="login-label login-password-label" htmlFor="login-password">Password</label>
        <div className="login-input-row">
          <Icon name="lock" />
          <input id="login-password" name="password" type={visible ? "text" : "password"} autoComplete="current-password" placeholder="••••••••" required />
          <button className="password-toggle" type="button" onClick={() => setVisible((value) => !value)} aria-label={visible ? "Hide password" : "Show password"} aria-pressed={visible}>
            <Icon name={visible ? "hidden" : "eye"} />
          </button>
        </div>
        <button type="button" className="forgot-password" onClick={() => officeHelp("Forgot password", "Password resets are done by the school office. Ask a coordinator or the administrator to set a new password for your account.")}>Forgot password?</button>
        <button type="submit" className="sign-in" disabled={submitting}>{submitting ? "Signing in…" : "Sign in"}</button>
        <p className="login-access">New here? <button type="button" onClick={() => officeHelp("Request access", "Please contact the school office to request a teacher account. A coordinator or administrator can help you get access.")}>Request access</button></p>
        <p className="login-office">Need help? <button type="button" onClick={() => officeHelp("Contact the school office", "Your school coordinator or administrator can help with your account, password and access.")}>Contact the school office</button></p>
      </form>
      <dialog className="office-dialog" ref={dialog} aria-labelledby={headingId} onClose={() => setHelp(null)} onClick={(event) => { if (event.target === dialog.current) dialog.current.close(); }}>
        {help && <>
          <div className="office-dialog-icon"><Icon name="lock" /></div>
          <h2 id={headingId}>{help.title}</h2>
          <p>{help.message}</p>
          <button className="sign-in" type="button" onClick={() => dialog.current.close()}>Okay</button>
        </>}
      </dialog>
    </>
  );
}
