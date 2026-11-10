import { supabase } from "./supabase";

/**
 * Web only. Kept out of `lib/duties.js` because that file is a word-for-word
 * copy of the app's (see scripts/sync-app.mjs) — add web-only code to files
 * like this one, never to a SHARED file.
 *
 * Marks for many duties in as few requests as possible: one paged query over
 * `duty_id in (...)` instead of one request per duty. Only stored exceptions
 * are fetched (Present is a null status), and the read pages at 1,000 with a
 * stable order (see history.js for why an unpaged read silently drops the
 * absences). Returns `{ [dutyId]: { admissionNo: code } }`.
 */
export async function fetchAttendanceFor(dutyIds) {
  const out = Object.fromEntries(dutyIds.map((id) => [id, {}]));
  if (!dutyIds.length) return out;
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("attendance")
      .select("duty_id, admission_no, status")
      .in("duty_id", dutyIds)
      .not("status", "is", null)
      .order("duty_id")
      .order("admission_no")
      .range(from, from + PAGE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    data.forEach((r) => {
      if (out[r.duty_id]) out[r.duty_id][r.admission_no] = r.status;
    });
    if (data.length < PAGE) break;
  }
  return out;
}
