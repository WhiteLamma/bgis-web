"use client";

import { useEffect, useState } from "react";
import { haptics, hapticsSupported, isHapticsEnabled, setHapticsEnabled } from "@/lib/haptics";

/**
 * Settings that belong to this device rather than the account: vibration,
 * and how to put BG-SAAR on the phone's home screen. Saved in this browser.
 */
export default function PhoneSettings() {
  const [vibrate, setVibrate] = useState(true);
  const [supported, setSupported] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [installEvent, setInstallEvent] = useState(null);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    setVibrate(isHapticsEnabled());
    setSupported(hapticsSupported());
    setInstalled(window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true);
    setIos(/iphone|ipad|ipod/i.test(navigator.userAgent));
    // Chrome on Android offers its own install prompt; keep it for our button.
    const onPrompt = (e) => {
      e.preventDefault();
      setInstallEvent(e);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  const toggle = (e) => {
    const on = e.target.checked;
    setHapticsEnabled(on);
    setVibrate(on);
    if (on) haptics.success();
  };

  const install = async () => {
    if (!installEvent) return;
    installEvent.prompt();
    const { outcome } = await installEvent.userChoice;
    if (outcome === "accepted") setInstalled(true);
    setInstallEvent(null);
  };

  return (
    <section className="panel panel-pad">
      <h2 className="panel-title" style={{ marginBottom: 14 }}>This phone or computer</h2>

      <label className="check" style={{ alignItems: "center", justifyContent: "space-between" }}>
        <span>
          Vibrate when I mark a child
          <span className="field-help">
            {supported
              ? "A short buzz confirms each mark. Turn it off for Mangalarati and night attendance near sleeping children."
              : "This device cannot vibrate (iPhones and computers do not allow it). Nothing to change here."}
          </span>
        </span>
        <input type="checkbox" role="switch" checked={vibrate} onChange={toggle} disabled={!supported} aria-label="Vibrate when I mark a child" style={{ width: 28, height: 28, flex: "none" }} />
      </label>

      <div style={{ marginTop: 22 }}>
        <p style={{ fontWeight: 700 }}>Open BG-SAAR like an app</p>
        {installed ? (
          <p className="field-help">It is already on this device’s home screen.</p>
        ) : installEvent ? (
          <>
            <p className="field-help">Put BG-SAAR on your home screen so it opens full screen with one tap.</p>
            <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={install}>Add to home screen</button>
          </>
        ) : ios ? (
          <p className="field-help">In Safari, press the Share button, then <b>Add to Home Screen</b>.</p>
        ) : (
          <p className="field-help">On an Android phone, open this page in Chrome, press the ⋮ menu, then <b>Add to Home screen</b>.</p>
        )}
      </div>
    </section>
  );
}
