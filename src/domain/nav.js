import {
  ROLES,
  canApproveStaff,
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
 * Reception holds the gate register and nothing else, as in the app: no
 * duties and no whole-school view.
 */
const PAGES = [
  { href: "/dashboard", label: "Today", icon: "today", show: (u) => u.role !== ROLES.RECEPTION },
  { href: "/dashboard/duties", label: "Duties", icon: "duties", show: (u) => canMark(u.role) },
  {
    href: "/dashboard/students",
    label: "Students",
    icon: "students",
    // A class teacher sees their own class; oversight and the nurse see the school.
    show: (u) => isOversight(u.role) || u.role === ROLES.NURSE || !!u.classKey,
  },
  { href: "/dashboard/reports", label: "Reports", icon: "reports", show: (u) => canPrintReports(u.role) || !!u.classKey },
  { href: "/dashboard/staff", label: "Staff", icon: "staff", show: (u) => isOversight(u.role) },
  { href: "/dashboard/gate", label: "Gate desk", icon: "gate", show: (u) => canWorkGate(u.role) },
  { href: "/dashboard/holidays", label: "Holidays", icon: "holiday", show: (u) => canDeclareHoliday(u.role) },
  { href: "/dashboard/activity", label: "Activity", icon: "activity", show: (u) => u.role !== ROLES.RECEPTION },
];

export const navFor = (user) => (user ? PAGES.filter((p) => p.show(user)) : []);

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
