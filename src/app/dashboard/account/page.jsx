"use client";

import { useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { updateOwnPhone } from "@/lib/staff";
import { removeAvatar, uploadAvatar } from "@/lib/avatars";
import { useMarkingTotals } from "@/lib/history";
import { describeError } from "@/lib/errors";
import { canMark, roleLabel } from "@/domain/roles";
import { Avatar, Icon, PageHead, useFeedback } from "@/components/dash/ui";

/**
 * Your profile. Email and role are fixed by the office (the staff RLS
 * policy's WITH CHECK pins them); phone and photo are yours to change.
 */
export default function AccountPage() {
  const { user, updateUser, logout } = useAuth();
  const feedback = useFeedback();
  const totals = useMarkingTotals(canMark(user.role) ? user.id : null);
  const [phone, setPhone] = useState(user.phone || "");
  const [savingPhone, setSavingPhone] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const fileRef = useRef(null);

  async function savePhone(event) {
    event.preventDefault();
    setSavingPhone(true);
    try {
      const row = await updateOwnPhone(user.id, phone.trim());
      updateUser({ phone: row.phone });
      feedback.toast("Phone number saved");
    } catch (e) {
      const d = describeError(e, { message: "Your phone number was not saved." });
      feedback.alert({ title: d.title, message: d.message });
    } finally {
      setSavingPhone(false);
    }
  }

  async function onPhoto(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setPhotoBusy(true);
    try {
      const url = await uploadAvatar(file, user.id);
      updateUser({ photoUrl: url });
      feedback.toast("Photo updated");
    } catch (e) {
      const d = describeError(e, { message: e?.message || "The photo was not uploaded." });
      feedback.alert({ title: d.title, message: d.message });
    } finally {
      setPhotoBusy(false);
    }
  }

  const removePhoto = () =>
    feedback.confirm({
      title: "Remove your photo?",
      confirmLabel: "Remove",
      destructive: true,
      onConfirm: async () => {
        try {
          await removeAvatar(user.id);
          updateUser({ photoUrl: null });
          feedback.toast("Photo removed");
        } catch (e) {
          const d = describeError(e, { message: "The photo was not removed." });
          setTimeout(() => feedback.alert({ title: d.title, message: d.message }), 0);
        }
      },
    });

  return (
    <>
      <PageHead eyebrow="Account" title={user.name} lede={`${roleLabel(user.role)}${user.classLabel ? ` · Class teacher of ${user.classLabel}` : ""}`}>
        <button className="btn btn-ghost" onClick={logout}><Icon name="logout" size={18} />Sign out</button>
      </PageHead>

      <div className="grid-2">
        <div className="stack">
          <section className="panel panel-pad" style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
            <Avatar name={user.name} url={user.photoUrl} size="lg" />
            <div style={{ flex: 1, minWidth: 200 }}>
              <h2 className="panel-title">Profile photo</h2>
              <p className="panel-note">Shown beside your name on duties and in the staff directory.</p>
              <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                <button className="btn btn-primary btn-sm" onClick={() => fileRef.current.click()} disabled={photoBusy}><Icon name="camera" size={16} />{photoBusy ? "Uploading…" : user.photoUrl ? "Change photo" : "Add photo"}</button>
                {user.photoUrl && <button className="btn btn-ghost btn-sm" onClick={removePhoto} disabled={photoBusy}>Remove</button>}
              </div>
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={onPhoto} />
            </div>
          </section>

          <section className="panel panel-pad">
            <h2 className="panel-title" style={{ marginBottom: 14 }}>Details</h2>
            <dl className="kv" style={{ marginBottom: 18 }}>
              <dt>Email</dt><dd>{user.email}</dd>
              <dt>Role</dt><dd>{roleLabel(user.role)}</dd>
              <dt>Class</dt><dd>{user.classLabel || "—"}</dd>
            </dl>
            <form onSubmit={savePhone} style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
              <label className="field" style={{ flex: "1 1 220px" }}>
                <span className="field-label">Phone</span>
                <input className="input" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Not set" autoComplete="tel" />
              </label>
              <button className="btn btn-primary" disabled={savingPhone || phone.trim() === (user.phone || "")}>{savingPhone ? "Saving…" : "Save"}</button>
            </form>
            <p className="panel-note" style={{ marginTop: 12 }}>Email and role are set by the school office.</p>
          </section>
        </div>

        {canMark(user.role) && (
          <section className="figures" style={{ gridTemplateColumns: "minmax(0, 1fr)", margin: 0 }}>
            <div className="figure">
              <p className="figure-label">Checkpoints you have submitted</p>
              <p className="figure-value">{totals.loading ? "—" : totals.error ? "?" : totals.taken}</p>
            </div>
            <div className="figure" style={{ borderLeft: 0, borderTop: "1px solid var(--panel-strong)" }}>
              <p className="figure-label">Students checked</p>
              <p className="figure-value">{totals.loading ? "—" : totals.error ? "?" : totals.marked.toLocaleString("en-IN")}</p>
              <p className="figure-foot">{totals.error ? "Couldn't load your totals." : `${totals.absent} of them marked absent`}</p>
            </div>
          </section>
        )}
      </div>
    </>
  );
}
