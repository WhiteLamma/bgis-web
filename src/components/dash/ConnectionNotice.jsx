"use client";

import { useEffect, useState } from "react";
import { useSchoolData } from "@/context/SchoolDataContext";
import { haptics } from "@/lib/haptics";
import { Icon } from "./ui";

/**
 * A plain notice when the phone or computer loses its connection, and a
 * quiet re-read of the day when it comes back. Marks typed while offline stay
 * on the register screen; submitting needs the connection, and this says so
 * before anyone presses Submit and wonders why it failed.
 */
export default function ConnectionNotice() {
  const { refresh } = useSchoolData();
  const [online, setOnline] = useState(true);

  useEffect(() => {
    setOnline(navigator.onLine);
    const goOffline = () => {
      setOnline(false);
      haptics.warn();
    };
    const goOnline = () => {
      setOnline(true);
      refresh();
    };
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
    };
  }, [refresh]);

  if (online) return null;
  return (
    <div className="banners" role="status">
      <div className="banner wait">
        <Icon name="wifiOff" />
        <span>
          <b>No internet connection.</b> You can keep marking; the register will be sent when you press Submit with a connection again.
        </span>
      </div>
    </div>
  );
}
