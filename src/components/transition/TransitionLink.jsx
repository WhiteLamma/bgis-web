"use client";

import Link from "next/link";
import { usePageTransition } from "./PageTransition";

/**
 * next/link, routed through the feather transition.
 *
 * Next calls onNavigate only for a client-side navigation — not for a
 * modifier-click into a new tab, a download, or an external URL — so those
 * keep the browser's own behaviour untouched. String hrefs only; an object
 * href passes straight through as a plain Link.
 */
export default function TransitionLink({ href, replace, onNavigate, ...props }) {
  const transition = usePageTransition();
  const handle =
    transition && typeof href === "string"
      ? (e) => {
          onNavigate?.(e);
          e.preventDefault();
          transition.navigate(href, { replace });
        }
      : onNavigate;
  return <Link href={href} replace={replace} onNavigate={handle} {...props} />;
}
