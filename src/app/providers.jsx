"use client";

import { AuthProvider } from "@/context/AuthContext";
import { PageTransitionProvider } from "@/components/transition/PageTransition";

/** Client-side providers shared by every route. */
export default function Providers({ children }) {
  return (
    <PageTransitionProvider>
      <AuthProvider>{children}</AuthProvider>
    </PageTransitionProvider>
  );
}
