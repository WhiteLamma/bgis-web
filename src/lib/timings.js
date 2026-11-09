import { supabase } from "./supabase";

/**
 * Checkpoint timings, as the app's Checkpoints & groups screen edits them
 * (gurukul `save_checkpoint`, migration 036). Duties read their window from
 * the checkpoint live, so a change applies to every register at once.
 */
export async function fetchCheckpoints() {
  const { data, error } = await supabase
    .from("checkpoints")
    .select("id, name, start_min, end_min, mandatory_escalation, active")
    .eq("active", true)
    .order("start_min");
  if (error) throw new Error(error.message);
  return (data || []).map((c) => ({
    id: c.id,
    name: c.name,
    start: c.start_min,
    end: c.end_min,
    mandatory: !!c.mandatory_escalation,
  }));
}

export async function saveCheckpointTime(cp, start, end) {
  const { error } = await supabase.rpc("save_checkpoint", {
    p_id: cp.id,
    p_name: cp.name,
    p_start: start,
    p_end: end,
    p_mandatory: cp.mandatory,
  });
  if (error) throw new Error(error.message);
}

/** Minutes ↔ "HH:MM" for <input type="time">. Midnight (1440) shows as 00:00. */
export const toInput = (min) =>
  `${String(Math.floor(min / 60) % 24).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

export const fromInput = (text) => {
  const m = /^(\d{2}):(\d{2})$/.exec(text || "");
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};
