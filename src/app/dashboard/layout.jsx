"use client";

import "./dashboard.css";
import { useEffect } from "react";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { SchoolDataProvider } from "@/context/SchoolDataContext";
import { canOpen, homeFor } from "@/domain/nav";
import Shell from "@/components/dash/Shell";
import { FeedbackProvider } from "@/components/dash/ui";
import { AlertsProvider, useAlerts } from "@/components/dash/useAlerts";
import PendingAccess from "@/components/dash/PendingAccess";
import { isOversight } from "@/domain/roles";

function Crest({ loading }) {
  return (
    <div className={`gate-crest${loading ? " loading-crest" : ""}`}>
      <Image src="/images/app-login-logo.png" alt="Bhaktivedanta Gurukula crest" fill sizes="84px" priority />
    </div>
  );
}

/** Mounted only for staff, so the alert count can read the school's day. */
function StaffFrame({ children }) {
  const { user } = useAuth();
  const { open } = useAlerts();
  return <Shell alertCount={isOversight(user?.role) ? open.length : 0}>{children}</Shell>;
}

/**
 * Everything under /dashboard. Signed-out visitors go to /login; an account
 * with no staff row sees the waiting screen; staff get the dashboard, with
 * pages their role is not offered sending them to their own home instead.
 *
 * This is a courtesy, not the security boundary: the data on every page is
 * read through RLS with the person's own token.
 */
export default function DashboardLayout({ children }) {
  const { user, pending, restoring } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (restoring) return;
    if (!user && !pending) router.replace("/login");
    else if (user && !canOpen(user, pathname)) router.replace(homeFor(user));
  }, [restoring, user, pending, pathname, router]);

  if (restoring || (!user && !pending)) {
    return (
      <div className="gate-screen" aria-busy="true">
        <Crest loading />
      </div>
    );
  }

  if (!user && pending) {
    return (
      <div className="dash" style={{ display: "block" }}>
        <PendingAccess email={pending.email} />
      </div>
    );
  }

  return (
    <SchoolDataProvider>
      <FeedbackProvider>
        <AlertsProvider>
          <StaffFrame>{children}</StaffFrame>
        </AlertsProvider>
      </FeedbackProvider>
    </SchoolDataProvider>
  );
}
