"use client";

import "./transition.css";
import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import PeacockFeather from "./PeacockFeather";
import { EYE_R, VIEW, eyePath } from "./featherGeometry";
import { EASE, deadline, frames, tween } from "./tween";

/**
 * The peacock-feather page transition.
 *
 * One overlay for the whole site, and one entry point — `navigate(href)` —
 * that internal links (TransitionLink) and programmatic navigation
 * (useTransitionRouter) both go through. The sequence:
 *
 *  1. cover   the feather sweeps in from the lower right on a curve, vane and
 *             eye a beat apart; its eye settles at the centre and the screen
 *             floods outward from it in deep teal, ringed like the eye
 *  2. change  the route is pushed only once the old page is fully hidden, and
 *             the overlay holds until the new pathname has committed
 *  3. reveal  the eye "dilates": a hole opens from its heart and widens to
 *             the edges, while the feather lifts away to the upper left
 *
 * Same-page changes (query or hash only), external links, new tabs and
 * downloads never reach here — Next's onNavigate only fires for client-side
 * navigations, and same-path ones are pushed straight through.
 *
 * Browser back/forward cannot be paused before the route changes, so those
 * are left to the browser rather than flashing a late cover.
 */

const TransitionContext = createContext(null);

const COVER_MS = 600;
const REVEAL_MS = 580;
const ARRIVAL_TIMEOUT_MS = 3500;

// Unit eye for the mask and rings; transformed to size every frame.
const UNIT = 100;
const UNIT_EYE = eyePath(UNIT);
// Rings around the eye on the covered screen, as multiples of the eye's size.
const RINGS = [
  { f: 1.18, stroke: "#c9a95a", o: 0.55, w: 1.1 },
  { f: 1.75, stroke: "#2c9b90", o: 0.32, w: 1 },
  { f: 2.6, stroke: "#c9a95a", o: 0.22, w: 0.9 },
  { f: 3.9, stroke: "#1f7a58", o: 0.3, w: 1 },
  { f: 5.8, stroke: "#c9a95a", o: 0.14, w: 0.8 },
];

const samePath = (a, b) => {
  try {
    return decodeURI(a).replace(/\/+$/, "") === decodeURI(b).replace(/\/+$/, "");
  } catch {
    return a === b;
  }
};

export function PageTransitionProvider({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");

  const root = useRef(null);
  const vane = useRef(null);
  const eye = useRef(null);
  const veil = useRef(null);
  const mask = useRef(null);
  const coverEye = useRef(null);
  const holeEye = useRef(null);
  const rings = useRef(null);
  const veilEye = useRef(null);

  const running = useRef(false);
  const pending = useRef(null);
  const live = useRef(new Set()); // animations and tweens to cancel on unmount
  const waiters = useRef(new Set());
  const pathRef = useRef(pathname);

  // Resolve anyone waiting for the destination to commit.
  useEffect(() => {
    pathRef.current = pathname;
    waiters.current.forEach((w) => {
      if (samePath(w.path, pathname)) {
        waiters.current.delete(w);
        w.resolve(true);
      }
    });
  }, [pathname]);

  const waitForPath = useCallback((path) => {
    if (samePath(path, pathRef.current)) return Promise.resolve(true);
    return new Promise((resolve) => {
      const w = { path, resolve };
      waiters.current.add(w);
      // Never hold the cover indefinitely: a slow or failed route still reveals.
      setTimeout(() => {
        if (waiters.current.delete(w)) resolve(false);
      }, ARRIVAL_TIMEOUT_MS);
    });
  }, []);

  /** Track an animation or tween so it is cancelled if the provider unmounts. */
  const track = useCallback((a) => {
    live.current.add(a);
    const done = a.finished.then(() => live.current.delete(a), () => live.current.delete(a));
    return done;
  }, []);

  /** Cancel every running animation and tween (each resolves as it stops). */
  const stopAll = useCallback(() => {
    live.current.forEach((a) => a.cancel());
    live.current.clear();
  }, []);

  useEffect(() => {
    const all = live.current;
    const pendingWaiters = waiters.current;
    return () => {
      all.forEach((a) => a.cancel());
      pendingWaiters.forEach((w) => w.resolve(false));
    };
  }, []);

  /** Size every layer to the current viewport. Returns the geometry used by the phases. */
  const layout = useCallback(() => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const cx = vw / 2;
    const cy = vh / 2;
    // The feather is drawn at the size it will be seen at the centre, so the
    // compositor only ever scales it down, never blurs it up.
    const fh = Math.max(vh * 1.02, 600);
    const k = fh / VIEW.h;
    const fw = VIEW.w * k;
    const ox = -VIEW.x * k;
    const oy = -VIEW.y * k;
    for (const el of [vane.current, eye.current]) {
      Object.assign(el.style, {
        width: `${fw}px`,
        height: `${fh}px`,
        left: `${cx - ox}px`,
        top: `${cy - oy}px`,
        transformOrigin: `${ox}px ${oy}px`,
      });
    }
    veil.current.setAttribute("viewBox", `0 0 ${vw} ${vh}`);
    Object.entries({ x: 0, y: 0, width: vw, height: vh }).forEach(([key, v]) => mask.current.setAttribute(key, v));
    // The feather's outer (bronze) eye on screen, and the size that floods the viewport.
    const eyeOuter = EYE_R * 1.5 * k;
    const flood = Math.hypot(vw, vh) / 2 / 0.78;
    return { vw, vh, cx, cy, k, eyeOuter, flood };
  }, []);

  const placeEye = (el, g, r) => el.setAttribute("transform", `translate(${g.cx} ${g.cy}) scale(${Math.max(0, r) / UNIT})`);

  const reset = useCallback(() => {
    const el = root.current;
    if (!el) return;
    el.removeAttribute("data-active");
    el.style.removeProperty("--pt-veil-opacity");
    for (const f of [vane.current, eye.current]) {
      f.getAnimations().forEach((a) => a.cancel());
      f.style.opacity = "0";
    }
  }, []);

  /* ---------- Phases ---------- */

  const cover = useCallback(
    async (g, reduced) => {
      placeEye(holeEye.current, g, 0);
      if (reduced) {
        placeEye(coverEye.current, g, g.flood);
        rings.current.setAttribute("opacity", "0");
        veilEye.current.setAttribute("opacity", "0");
        await track(tween({ duration: 160, onUpdate: (p) => root.current.style.setProperty("--pt-veil-opacity", p) }));
        return;
      }
      root.current.style.setProperty("--pt-veil-opacity", 1);
      placeEye(coverEye.current, g, 0);
      rings.current.setAttribute("opacity", "1");
      veilEye.current.setAttribute("opacity", "1");
      veilEye.current.setAttribute("transform", `translate(${g.cx} ${g.cy}) scale(${g.k})`);

      // Enters from the lower right, bowing up through the lower third before
      // settling: an arc, never a straight line.
      const path = (lag) => [
        { transform: `translate(${g.vw * 0.62}px, ${g.vh * 0.78}px) rotate(-42deg) scale(0.5)`, opacity: 0 },
        { transform: `translate(${g.vw * 0.44}px, ${g.vh * 0.42}px) rotate(-30deg) scale(0.66)`, opacity: 1, offset: 0.2 },
        { transform: `translate(${g.vw * 0.1 + lag}px, ${g.vh * 0.08}px) rotate(-12deg) scale(0.9)`, opacity: 1, offset: 0.62 },
        { transform: "translate(0px, 0px) rotate(-4deg) scale(1)", opacity: 1 },
      ];
      const glide = { duration: COVER_MS - 40, easing: EASE.glide, fill: "forwards" };
      const moves = [
        track(vane.current.animate(path(g.vw * 0.03), { ...glide, delay: 0 })),
        // The eye trails the vane slightly and catches up: the layers read as depth.
        track(eye.current.animate(path(-g.vw * 0.015), { ...glide, delay: 40 })),
      ];

      // The screen floods outward from the eye once the feather is nearly home.
      const flood = track(
        tween({
          duration: 300,
          delay: COVER_MS - 300,
          ease: EASE.flood,
          onUpdate: (p) => {
            placeEye(coverEye.current, g, g.eyeOuter * 0.92 + (g.flood - g.eyeOuter * 0.92) * p);
            const s = g.k * (0.92 + 0.08 * p);
            rings.current.setAttribute("transform", `translate(${g.cx} ${g.cy}) scale(${(s * EYE_R * 1.5) / UNIT})`);
          },
        })
      );
      await Promise.all([...moves, flood]);
    },
    [track]
  );

  const reveal = useCallback(
    async (g, reduced) => {
      if (reduced) {
        await track(tween({ duration: 180, onUpdate: (p) => root.current.style.setProperty("--pt-veil-opacity", 1 - p) }));
        return;
      }
      // The feather lifts away to the upper left, seen first through the
      // opening eye and then over the new page.
      const lift = (lag) => [
        { transform: "translate(0px, 0px) rotate(-4deg) scale(1)", opacity: 1 },
        { transform: `translate(${-g.vw * 0.16 + lag}px, ${-g.vh * 0.2}px) rotate(6deg) scale(1.04)`, opacity: 1, offset: 0.35 },
        { transform: `translate(${-g.vw * 0.62}px, ${-g.vh * 0.86}px) rotate(20deg) scale(1.12)`, opacity: 0 },
      ];
      const glide = { duration: REVEAL_MS, easing: "cubic-bezier(0.45, 0, 0.3, 1)", fill: "forwards" };
      const moves = [
        track(vane.current.animate(lift(0), { ...glide, delay: 40 })),
        track(eye.current.animate(lift(g.vw * 0.02), { ...glide, delay: 0 })),
      ];

      const base = (g.k * EYE_R * 1.5) / UNIT;
      const open = track(
        tween({
          duration: REVEAL_MS - 40,
          ease: EASE.open,
          onUpdate: (p) => {
            // The hole starts inside the heart and widens past the corners.
            placeEye(holeEye.current, g, g.eyeOuter * 0.35 + (g.flood * 1.02 - g.eyeOuter * 0.35) * p);
            rings.current.setAttribute("transform", `translate(${g.cx} ${g.cy}) scale(${base * (1 + 0.55 * p)})`);
            rings.current.setAttribute("opacity", String(1 - p));
            veilEye.current.setAttribute("opacity", String(Math.max(0, 1 - p * 2.2)));
          },
        })
      );
      await Promise.all([...moves, open]);
    },
    [track]
  );

  /* ---------- Navigation ---------- */

  const go = useCallback(
    (href, replace) => (replace ? router.replace(href) : router.push(href)),
    [router]
  );

  const navigate = useCallback(
    async (href, { replace = false } = {}) => {
      let url;
      try {
        url = new URL(href, window.location.href);
      } catch {
        return go(href, replace);
      }
      if (url.origin !== window.location.origin) {
        window.location.assign(url.href);
        return;
      }
      // Query or hash only: no page is changing, so nothing to cover.
      if (samePath(url.pathname, window.location.pathname)) return go(href, replace);
      // Already mid-flight: the latest destination wins.
      if (running.current) {
        pending.current = { href, replace };
        return;
      }
      // A background tab draws no frames; there is nobody to show it to.
      if (document.hidden) return go(href, replace);

      running.current = true;
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const el = root.current;
      let next = { href, replace };
      try {
        const g = layout();
        el.setAttribute("data-active", "");
        el.setAttribute("data-reduced", reduced ? "true" : "false");
        // Each phase has a hard deadline. If the browser stops drawing frames
        // mid-flight, the sequence still moves on and the overlay comes down.
        await deadline(cover(g, reduced), COVER_MS + 450);
        stopAll();
        // Whatever the phase managed, the old page is now fully hidden.
        placeEye(coverEye.current, g, g.flood);
        el.style.setProperty("--pt-veil-opacity", 1);
        // Under full cover: the old page is hidden. Push, and keep pushing the
        // latest request until one lands with nothing newer queued behind it.
        for (let i = 0; i < 4; i += 1) {
          if (pending.current) {
            next = pending.current;
            pending.current = null;
          }
          go(next.href, next.replace);
          await waitForPath(new URL(next.href, window.location.href).pathname);
          if (!pending.current) break;
        }
        // Let the new page paint beneath the cover before opening it.
        await deadline(frames(2), 120);
        await deadline(reveal(g, reduced), REVEAL_MS + 450);
      } catch (e) {
        // A failed animation must never strand the visitor: finish the
        // navigation without ceremony.
        console.warn("Page transition skipped:", e);
        if (!samePath(new URL(next.href, window.location.href).pathname, window.location.pathname)) go(next.href, next.replace);
      } finally {
        stopAll();
        reset();
        running.current = false;
        const queued = pending.current;
        pending.current = null;
        if (queued) navigate(queued.href, { replace: queued.replace });
      }
    },
    [go, layout, cover, reveal, reset, stopAll, waitForPath]
  );

  // While covered, the page underneath must not take keystrokes either.
  useEffect(() => {
    const block = (e) => {
      if (running.current && (e.key === "Enter" || e.key === " ")) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener("keydown", block, true);
    return () => window.removeEventListener("keydown", block, true);
  }, []);

  const value = useMemo(() => ({ navigate }), [navigate]);

  return (
    <TransitionContext.Provider value={value}>
      {children}
      <div ref={root} className="pt-root" aria-hidden="true">
        <div ref={vane} className="pt-feather">
          <PeacockFeather uid={`${uid}v`} layer="vane" />
        </div>
        <div ref={eye} className="pt-feather">
          <PeacockFeather uid={`${uid}e`} layer="eye" />
        </div>
        <svg ref={veil} className="pt-veil" viewBox="0 0 100 100" preserveAspectRatio="none">
          <defs>
            <mask id={`${uid}-mask`} ref={mask} maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse">
              <path ref={coverEye} d={UNIT_EYE} fill="#fff" />
              <path ref={holeEye} d={UNIT_EYE} fill="#000" />
            </mask>
          </defs>
          <g mask={`url(#${uid}-mask)`}>
            <rect width="100%" height="100%" fill="#02403f" />
            <g ref={rings} fill="none">
              {RINGS.map((r) => (
                <path key={r.f} d={eyePath(UNIT * r.f)} stroke={r.stroke} strokeOpacity={r.o} strokeWidth={r.w} vectorEffect="non-scaling-stroke" />
              ))}
            </g>
            {/* The feather's eye, repeated on the veil so the flood seems to grow out of it. */}
            <g ref={veilEye}>
              <PeacockFeather uid={`${uid}c`} layer="eye" x={VIEW.x} y={VIEW.y} width={VIEW.w} height={VIEW.h} />
            </g>
          </g>
        </svg>
      </div>
    </TransitionContext.Provider>
  );
}

export function usePageTransition() {
  return useContext(TransitionContext);
}

/**
 * `router.push` / `router.replace` with the transition. Falls back to the
 * plain router outside the provider, so a component never breaks for want of it.
 */
export function useTransitionRouter() {
  const ctx = useContext(TransitionContext);
  const router = useRouter();
  return useMemo(
    () => ({
      ...router,
      push: (href) => (ctx ? ctx.navigate(href) : router.push(href)),
      replace: (href) => (ctx ? ctx.navigate(href, { replace: true }) : router.replace(href)),
    }),
    [ctx, router]
  );
}
