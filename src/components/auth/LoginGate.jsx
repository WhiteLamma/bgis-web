"use client";

import { useEffect } from "react";
import { useTransitionRouter as useRouter } from "@/components/transition/PageTransition";
import LoginForm from "./LoginForm";
import { supabase, supabaseConfigError } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { describeError } from "@/lib/errors";

/**
 * The login form, wired to Supabase Auth.
 *
 * Signing in is the same three-state resolution the app uses (AuthContext):
 * staff go to the dashboard, an account with no staff row goes to the waiting
 * screen inside it, and anything else stays here with a reason.
 */
export default function LoginGate() {
  const router = useRouter();
  const { user, pending, restoring, resolveSession } = useAuth();

  // Already signed in (a restored session, or the sign-in below finishing).
  useEffect(() => {
    if (!restoring && (user || pending)) router.replace("/dashboard");
  }, [restoring, user, pending, router]);

  async function signIn({ email, password }) {
    if (supabaseConfigError) {
      throw new Error(`This site is missing its server settings (${supabaseConfigError}).`);
    }
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      if (/invalid login credentials/i.test(error.message)) {
        throw new Error("That email and password don't match an account. Check them and try again.");
      }
      if (/email not confirmed/i.test(error.message)) {
        throw new Error("Confirm your email address first — the link is in your inbox.");
      }
      throw new Error(describeError(error, { message: error.message }).message);
    }
    // Activity log entry. Best effort: a failed log must not keep anyone out.
    // A Postgrest builder is a thenable without .catch(), hence then(ok, fail).
    supabase.rpc("log_sign_in").then(() => {}, () => {});
    await resolveSession(data.session);
  }

  return <LoginForm onSignIn={signIn} />;
}
