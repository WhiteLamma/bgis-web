/**
 * The smallest animation helpers the transition needs.
 *
 * The feather layers are HTML boxes moved with the Web Animations API, so the
 * compositor does the work. The full-screen mask lives inside an SVG <mask>,
 * where CSS animations repaint unreliably across browsers — that part is
 * driven frame by frame with `tween`, which sets plain attributes.
 */

/** A cubic-bezier easing, solved by Newton's method — the same curve CSS uses. */
export function bezier(x1, y1, x2, y2) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const sx = (t) => ((ax * t + bx) * t + cx) * t;
  const sy = (t) => ((ay * t + by) * t + cy) * t;
  const dx = (t) => (3 * ax * t + 2 * bx) * t + cx;
  return (x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 6; i += 1) {
      const d = dx(t);
      if (Math.abs(d) < 1e-6) break;
      t -= (sx(t) - x) / d;
    }
    return sy(Math.min(1, Math.max(0, t)));
  };
}

export const EASE = {
  // Slow lift-off, long glide, soft landing: a feather, not a slide.
  glide: "cubic-bezier(0.55, 0.05, 0.18, 1)",
  // Gathers, then floods the screen.
  flood: bezier(0.72, 0, 0.22, 1),
  // Opens quickly from the centre, settles at the edges.
  open: bezier(0.5, 0, 0.12, 1),
  linear: (t) => t,
};

/**
 * Run `onUpdate(progress)` every frame for `duration` ms after `delay`.
 * Returns { finished, cancel }. Cancelling resolves `finished` without
 * running the remaining frames, so nothing awaits a promise that never ends.
 */
export function tween({ duration, delay = 0, ease = EASE.linear, onUpdate }) {
  let raf = 0;
  let done;
  const finished = new Promise((resolve) => (done = resolve));
  const start = performance.now() + delay;
  const frame = (now) => {
    const p = Math.min(1, Math.max(0, (now - start) / duration));
    onUpdate(ease(p));
    if (p < 1) raf = requestAnimationFrame(frame);
    else done();
  };
  raf = requestAnimationFrame(frame);
  return {
    finished,
    cancel: () => {
      cancelAnimationFrame(raf);
      done();
    },
  };
}

/** Resolve after `n` animation frames — enough for the browser to paint. */
export const frames = (n = 2) =>
  new Promise((resolve) => {
    const step = (left) => (left <= 0 ? resolve() : requestAnimationFrame(() => step(left - 1)));
    step(n);
  });

/**
 * Resolve with `promise`, or after `ms` regardless. Timers keep running when
 * a browser stops producing animation frames (an occluded or backgrounded
 * window), so this is what guarantees an overlay can never be left up.
 */
export const deadline = (promise, ms) =>
  Promise.race([promise, new Promise((resolve) => setTimeout(resolve, ms))]);
