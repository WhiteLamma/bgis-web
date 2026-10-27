import { createClient } from "@supabase/supabase-js";

/**
 * The Supabase client for the dashboard: the same project the gurukul app
 * uses (see docs/gurukul/), reached with the anon key so every request goes
 * through the database's RLS policies.
 *
 * The env vars must be read by their literal names: Next.js inlines
 * `process.env.NEXT_PUBLIC_*` at build time and cannot inline a dynamic
 * lookup. Only these two belong here. The service-role key bypasses every
 * policy and must never be given a NEXT_PUBLIC_ name.
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** Names of the missing env vars, or null when the client is configured. */
export const supabaseConfigError = (() => {
  const missing = [
    !url && "NEXT_PUBLIC_SUPABASE_URL",
    !anonKey && "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  ].filter(Boolean);
  return missing.length ? missing.join(" and ") : null;
})();

export const isSupabaseConfigured = !supabaseConfigError;

/**
 * Placeholders keep `createClient` from throwing at import time when the env
 * is missing, so a page can show `supabaseConfigError` instead of crashing.
 * `.invalid` (RFC 2606) never resolves, so a stray request fails as a network
 * error rather than reaching someone else's server.
 */
export const supabase = createClient(
  url || "https://unconfigured.invalid",
  anonKey || "unconfigured-anon-key",
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);
