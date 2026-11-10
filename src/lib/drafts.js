/**
 * Unsaved marks for a register, kept while the marker steps away to the gate
 * page to sign a child out — so coming back finds the register half-marked
 * exactly as they left it. In memory only: it survives moving between pages
 * of the dashboard, not a reload, which is the same promise the register
 * itself makes about unsaved marks.
 */
const drafts = new Map();

export const saveDraft = (dutyId, statuses) => drafts.set(String(dutyId), { ...statuses });

/** The saved marks for this duty, or null. Reading does not remove them
 *  (React may run a state initializer twice); `clearDraft` does. */
export const readDraft = (dutyId) => drafts.get(String(dutyId)) || null;

export const clearDraft = (dutyId) => drafts.delete(String(dutyId));
