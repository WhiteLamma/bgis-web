"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useAuth } from "@/context/AuthContext";
import { changeMyTemporaryPassword } from "@/lib/staff";
import { passwordProblem } from "@/lib/passwords";
import { describeError } from "@/lib/errors";
import { Icon } from "./ui";

/**
 * First sign-in with a temporary password (migration 048) — the web version
 * of the app's SetPasswordScreen.
 *
 * The whole dashboard for someone whose `must_change_password` is set: a
 * coordinator gave them `Initial@123` or a random password, and they reach
 * nothing else until they choose their own. Once they do, the temporary copy
 * is deleted on the server and the session stays valid, so there is no
 * second sign-in.
 */
export default function SetPassword() {
  const { user, logout, updateUser } = useAuth();
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const before = document.title;
    document.title = "Choose your password";
    return () => {
      document.title = before;
    };
  }, []);

  async function save(event) {
    event.preventDefault();
    if (busy) return;
    const problem = passwordProblem(pw, confirm);
    if (problem) return setError(problem);
    setBusy(true);
    setError("");
    try {
      await changeMyTemporaryPassword(pw);
      updateUser({ mustChangePassword: false });
    } catch (e) {
      setError(describeError(e, { message: e?.message || "Could not save. Try again." }).message);
    } finally {
      setBusy(false);
    }
  }

  const field = (label, value, onChange, autoFocus) => (
    <label style={{ display: "grid", gap: 6 }}>
      <span style={labelStyle}>{label}</span>
      <span className="pw-field">
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setError("");
          }}
          placeholder="At least 8 characters"
          autoComplete="new-password"
          autoFocus={autoFocus}
          style={input}
        />
        <button type="button" className="pw-eye" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide password" : "Show password"}>
          <Icon name={show ? "eyeOff" : "eye"} size={20} />
        </button>
      </span>
    </label>
  );

  return (
    <div className="gate-screen">
      <div className="gate-card" style={{ textAlign: "left" }}>
        <div className="gate-crest">
          <Image src="/images/app-login-logo.png" alt="" fill sizes="84px" />
        </div>
        <h1 style={{ textAlign: "center" }}>Choose your password</h1>
        <p>
          Welcome{user?.name ? `, ${user.name}` : ""}. You signed in with a temporary password from your coordinator. Choose your own now — after this, only you will know it.
        </p>
        <form onSubmit={save} style={{ display: "grid", gap: 14, marginTop: 8 }}>
          {field("NEW PASSWORD", pw, setPw, true)}
          {field("TYPE IT AGAIN", confirm, setConfirm, false)}
          {error && <p role="alert" style={{ color: "#8e1f3c", margin: 0 }}>{error}</p>}
          <button className="btn btn-primary" disabled={busy} style={btn}>{busy ? "Saving…" : "Save and continue"}</button>
          <button type="button" onClick={logout} style={{ ...btnGhost, justifySelf: "center" }}>Sign out</button>
        </form>
      </div>
    </div>
  );
}

// Rendered outside the dashboard frame, like PendingAccess, so it carries its own few styles.
const labelStyle = { fontSize: 12, fontWeight: 700, letterSpacing: ".06em", color: "#4f5b59" };
const btn = { minHeight: 48, padding: "0 20px", border: 0, borderRadius: 99, background: "#035352", color: "#fff", fontWeight: 700, cursor: "pointer" };
const btnGhost = { minHeight: 44, padding: "0 20px", border: "1px solid #cfc3a8", borderRadius: 99, background: "#fff", color: "#0c2b2a", fontWeight: 700, cursor: "pointer" };
const input = { minHeight: 46, padding: "0 16px", border: "1.5px solid #cfc3a8", borderRadius: 12, fontSize: 15, boxSizing: "border-box" };
