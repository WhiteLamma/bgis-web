"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "@/components/transition/TransitionLink";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { navFor } from "@/domain/nav";
import { roleLabel } from "@/domain/roles";
import { Avatar, Icon } from "./ui";

/**
 * The frame: the school's crest and name, the pages this role is offered,
 * and the signed-in person. Labelled links on the page's own ground — no
 * coloured sidebar — so the content, not the chrome, carries the colour.
 */
export default function Shell({ children, alertCount = 0 }) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const pages = navFor(user);

  // Close the drawer on navigation (phones).
  useEffect(() => setOpen(false), [pathname]);

  const isActive = (href) =>
    href === "/dashboard" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <div className="dash">
      <aside className={`side${open ? " is-open" : ""}`} aria-label="Main navigation">
        <Link href="/dashboard" className="side-brand">
          <span className="side-crest">
            <Image src="/images/app-login-logo.png" alt="" fill sizes="52px" />
          </span>
          <span>
            <span className="side-name">BG-SAAR</span>
            <span className="side-sub">Bhaktivedanta Gurukula</span>
          </span>
        </Link>

        <p className="side-label">Pages</p>
        <nav className="side-nav">
          {pages.map((p) => (
            <Link key={p.href} href={p.href} className="side-link" aria-current={isActive(p.href) ? "page" : undefined}>
              <Icon name={p.icon} size={22} />
              {p.label}
              {p.href === "/dashboard" && alertCount > 0 && (
                <span className="side-count" aria-label={`${alertCount} children to account for`}>{alertCount}</span>
              )}
            </Link>
          ))}
        </nav>

        <div className="side-foot">
          <Link href="/dashboard/account" className="side-user" aria-current={isActive("/dashboard/account") ? "page" : undefined}>
            <Avatar name={user?.name} url={user?.photoUrl} />
            <span style={{ minWidth: 0 }}>
              <span className="side-user-name">{user?.name}</span>
              <span className="side-user-role">{roleLabel(user?.role)}{user?.classLabel ? ` · ${user.classLabel}` : ""}</span>
            </span>
          </Link>
          <button type="button" className="side-out" onClick={logout}>
            <Icon name="logout" size={22} />
            Sign out
          </button>
        </div>
      </aside>

      <div style={{ minWidth: 0 }}>
        <div className="mobile-bar">
          <button type="button" onClick={() => setOpen(true)} aria-label="Open menu" aria-expanded={open}>
            <Icon name="menu" size={20} />Menu
          </button>
          <b>BG-SAAR</b>
        </div>
        <main className="main" onClick={() => open && setOpen(false)}>
          <div className="page">{children}</div>
        </main>
      </div>
    </div>
  );
}
