"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useAuth } from "@/context/AuthContext";
import { REQUEST_STATE, fetchMyRequest, submitAccessRequest } from "@/lib/access";
import { describeError } from "@/lib/errors";
import { fmtDay } from "@/utils/format";

/**
 * Signed in, but not staff yet — the web version of the app's PendingScreen.
 * The account can read nothing but its own access request (migration 012),
 * so this is the only thing it is offered.
 */
export default function PendingAccess({ email }) {
  const { logout, refreshSession } = useAuth();
  const [request, setRequest] = useState(undefined);
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);

  const load = () =>
    fetchMyRequest()
      .then(setRequest)
      .catch((e) => {
        setRequest(null);
        setError(describeError(e).message);
      });

  useEffect(() => {
    load();
  }, []);

  async function submit(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSending(true);
    setError("");
    try {
      await submitAccessRequest({ name: form.get("name").trim(), email, phone: form.get("phone").trim() });
      await load();
    } catch (e) {
      setError(describeError(e).message);
    } finally {
      setSending(false);
    }
  }

  const state = request?.state;

  return (
    <div className="gate-screen">
      <div className="gate-card" style={{ textAlign: "left" }}>
        <div className="gate-crest">
          <Image src="/images/app-login-logo.png" alt="" fill sizes="84px" />
        </div>
        <h1 style={{ textAlign: "center" }}>
          {state === REQUEST_STATE.REJECTED ? "Access not approved" : request ? "Waiting for approval" : "Request access"}
        </h1>
        {request === undefined ? (
          <p style={{ textAlign: "center" }}>Checking your account…</p>
        ) : request ? (
          <>
            <p>
              {state === REQUEST_STATE.REJECTED
                ? `Your request was declined${request.decisionNote ? `: “${request.decisionNote}”` : "."} Speak to the school office if you think this is a mistake.`
                : `You asked for access on ${fmtDay(request.requestedAt?.slice(0, 10))}. A coordinator or the administrator will approve it, and then your duties will appear here.`}
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button className="btn btn-primary" onClick={refreshSession} style={btn}>Check again</button>
              <button className="btn btn-ghost" onClick={logout} style={btnGhost}>Sign out</button>
            </div>
          </>
        ) : (
          <form onSubmit={submit} style={{ display: "grid", gap: 12 }}>
            <p>You are signed in as <b>{email}</b>, which is not linked to a staff record yet. Tell the office who you are.</p>
            <input name="name" required placeholder="Full name" style={input} autoComplete="name" />
            <input name="phone" placeholder="Phone (optional)" style={input} autoComplete="tel" />
            <button className="btn btn-primary" disabled={sending} style={btn}>{sending ? "Sending…" : "Send request"}</button>
            <button type="button" onClick={logout} style={{ ...btnGhost, justifySelf: "center" }}>Sign out</button>
          </form>
        )}
        {error && <p style={{ color: "#8e1f3c", marginTop: 12 }}>{error}</p>}
      </div>
    </div>
  );
}

// This screen renders outside the dashboard frame, so it carries its own few styles.
const btn = { minHeight: 44, padding: "0 20px", border: 0, borderRadius: 99, background: "#035352", color: "#fff", fontWeight: 700, cursor: "pointer" };
const btnGhost = { minHeight: 44, padding: "0 20px", border: "1px solid #cfc3a8", borderRadius: 99, background: "#fff", color: "#0c2b2a", fontWeight: 700, cursor: "pointer" };
const input = { minHeight: 46, padding: "0 16px", border: "1.5px solid #cfc3a8", borderRadius: 12, fontSize: 15 };
