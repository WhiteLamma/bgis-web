import { supabase } from "./supabase";

/**
 * Passwords — the web side of the app's `lib/passwords.js`.
 *
 * Nobody ever sees another person's chosen password. A coordinator can hand
 * out a temporary one (migration 048, in `staff.js`) or a one-time reset code
 * (migration 036, here) that the person redeems in the app's "Forgot
 * password?" screen with a password of their own.
 */

export const MIN_PASSWORD = 8;

/** A reason the password is not acceptable, or null. Shown under the field. */
export function passwordProblem(pw, confirm) {
  if (!pw) return "Enter a new password";
  if (pw.length < MIN_PASSWORD) return `At least ${MIN_PASSWORD} characters`;
  if (confirm !== undefined && pw !== confirm) return "The two passwords do not match";
  return null;
}

/** Coordinator/admin. Returns `{ code, expiresAt }` — show it once. */
export async function issueResetCode(staffId) {
  const { data, error } = await supabase.rpc("issue_password_reset", { p_staff: staffId });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return { code: row.code, expiresAt: row.expires_at };
}

/** "ABCD-EFGH" for reading aloud; the database ignores the dash. */
export const formatCode = (code) => (code ? `${code.slice(0, 4)}-${code.slice(4)}` : "");
