import {
  ROLES,
  canDeclareHoliday,
  canMark,
  canPrintReports,
  canWorkGate,
  isOversight,
} from "./roles";

/**
 * Which dashboard pages each role is offered — the web version of the app's
 * RootNavigator tabs. Like everything in roles.js this decides what the
 * interface OFFERS; the database's RLS policies are the actual boundary.
 *
 * `group` places a page in the sidebar; `tab` puts it on the phone's bottom
 * bar (at most four, the rest live under "More"). Reception holds the gate
 * register and nothing else, as in the app.
 */
const PAGES = [
  { href: "/dashboard", label: "Today", icon: "today", group: "Daily work", tab: true, show: (u) => u.role !== ROLES.RECEPTION },
  { href: "/dashboard/duties", label: "Duties", icon: "duties", group: "Daily work", tab: true, show: (u) => canMark(u.role) },
  {
    href: "/dashboard/students",
    label: "Students",
    icon: "students",
    group: "Daily work",
    tab: true,
    // A class teacher sees their own class; oversight and the nurse see the school.
    show: (u) => isOversight(u.role) || u.role === ROLES.NURSE || !!u.classKey,
  },
  { href: "/dashboard/gate", label: "Gate desk", icon: "gate", group: "Office", tab: (u) => u.role === ROLES.RECEPTION, show: (u) => canWorkGate(u.role) },
  { href: "/dashboard/reports", label: "Reports", icon: "reports", group: "Office", show: (u) => canPrintReports(u.role) || !!u.classKey },
  { href: "/dashboard/staff", label: "Staff", icon: "staff", group: "Office", show: (u) => isOversight(u.role) },
  { href: "/dashboard/holidays", label: "Holidays", icon: "holiday", group: "Office", show: (u) => canDeclareHoliday(u.role) },
  { href: "/dashboard/activity", label: "Activity", icon: "activity", group: "Records", show: (u) => u.role !== ROLES.RECEPTION },
];

export const navFor = (user) => (user ? PAGES.filter((p) => p.show(user)) : []);

/** The pages, grouped for the sidebar, in order. */
export const navGroups = (user) => {
  const groups = [];
  for (const p of navFor(user)) {
    let g = groups.find((x) => x.name === p.group);
    if (!g) groups.push((g = { name: p.group, pages: [] }));
    g.pages.push(p);
  }
  return groups;
};

/** Up to four pages for the phone's bottom bar. */
export const tabsFor = (user) =>
  navFor(user)
    .filter((p) => (typeof p.tab === "function" ? p.tab(user) : p.tab))
    .slice(0, 4);

/** The page title for a path, for the phone's top bar. */
export const titleFor = (user, pathname) => {
  if (pathname.startsWith("/dashboard/account")) return "Account";
  const page = [...navFor(user)]
    .sort((a, b) => b.href.length - a.href.length)
    .find((p) => pathname === p.href || pathname.startsWith(`${p.href}/`));
  return page?.label || "BG-SAAR";
};

/** Whether `user` may open `pathname` — used to send them home instead. */
export const canOpen = (user, pathname) => {
  if (!user) return false;
  if (pathname === "/dashboard/account") return true;
  const page = [...PAGES]
    .sort((a, b) => b.href.length - a.href.length)
    .find((p) => pathname === p.href || pathname.startsWith(`${p.href}/`));
  return page ? page.show(user) : true;
};

/** Where a role lands after signing in. */
export const homeFor = (user) => navFor(user)[0]?.href || "/dashboard/account";
