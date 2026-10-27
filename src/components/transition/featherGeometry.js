/**
 * Geometry for the peacock feather, in the feather's own coordinates: the
 * centre of the eye is the origin, the tip points up (-y), the quill runs
 * down to the base at y ≈ 800.
 *
 * Everything is computed once at module load from fixed numbers — no
 * randomness — so the server and the browser render identical markup and
 * hydration never sees a mismatch.
 */

export const VIEW = { x: -330, y: -300, w: 660, h: 1140 };
export const EYE_R = 78;

const r1 = (n) => Math.round(n * 10) / 10;
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (e0, e1, x) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

// The quill: a quadratic from the base, through a gentle bow, to the tip.
const BASE = { x: 34, y: 800 };
const CTRL = { x: -22, y: 330 };
const TIP = { x: 0, y: -250 };

const shaftAt = (t) => ({
  x: (1 - t) * (1 - t) * BASE.x + 2 * (1 - t) * t * CTRL.x + t * t * TIP.x,
  y: (1 - t) * (1 - t) * BASE.y + 2 * (1 - t) * t * CTRL.y + t * t * TIP.y,
});
const tangentAt = (t) => {
  const dx = 2 * (1 - t) * (CTRL.x - BASE.x) + 2 * t * (TIP.x - CTRL.x);
  const dy = 2 * (1 - t) * (CTRL.y - BASE.y) + 2 * t * (TIP.y - CTRL.y);
  const len = Math.hypot(dx, dy);
  return { x: dx / len, y: dy / len };
};

export const SHAFT = `M${BASE.x} ${BASE.y} Q${CTRL.x} ${CTRL.y} ${TIP.x} ${TIP.y}`;

/**
 * The eye's outline at radius r: a teardrop pointing toward the tip, fuller
 * at the base — the shape of a real ocellus rather than a circle.
 */
export const eyePath = (r, dy = 0) => {
  const p = (x, y) => `${r1(x * r)} ${r1(y * r + dy)}`;
  return (
    `M${p(0, -1.32)}` +
    `C${p(0.52, -1.02)} ${p(0.98, -0.42)} ${p(0.98, 0.12)}` +
    `C${p(0.98, 0.7)} ${p(0.52, 1.02)} ${p(0, 1.02)}` +
    `C${p(-0.52, 1.02)} ${p(-0.98, 0.7)} ${p(-0.98, 0.12)}` +
    `C${p(-0.98, -0.42)} ${p(-0.52, -1.02)} ${p(0, -1.32)}Z`
  );
};

/** The kidney-shaped heart of the eye, notched at the top. */
export const heartPath = (r, dy = 0) => {
  const p = (x, y) => `${r1(x * r)} ${r1(y * r + dy)}`;
  return (
    `M${p(0, -0.62)}` +
    `C${p(0.22, -0.98)} ${p(0.92, -0.86)} ${p(0.9, -0.12)}` +
    `C${p(0.88, 0.56)} ${p(0.42, 0.92)} ${p(0, 0.92)}` +
    `C${p(-0.42, 0.92)} ${p(-0.88, 0.56)} ${p(-0.9, -0.12)}` +
    `C${p(-0.92, -0.86)} ${p(-0.22, -0.98)} ${p(0, -0.62)}Z`
  );
};

/**
 * The barbs: fine filaments either side of the quill. Short and loose near
 * the base, long and dense around the eye, sweeping toward the tip. Each has
 * a tone index (0 bronze, 1 emerald, 2 teal) so the vane shifts colour along
 * its length the way the real one does.
 */
function buildBarbs() {
  const out = [];
  const N = 58;
  for (let i = 0; i < N; i += 1) {
    const t = 0.05 + (i / (N - 1)) * 0.93;
    const p = shaftAt(t);
    const tan = tangentAt(t);
    // Length envelope: wisps low down, fullest just below the eye, tapering to the tip.
    const len = lerp(48, 268, smooth(0.08, 0.66, t)) * (1 - 0.72 * smooth(0.86, 1, t));
    // Angle off the quill: wide at the base, swept toward the tip near the eye.
    const sweep = lerp(1.12, 0.5, smooth(0.2, 0.95, t));
    for (const side of [-1, 1]) {
      // Normal to the quill on this side, rotated toward the tip by `sweep`.
      const nx = -tan.y * side;
      const ny = tan.x * side;
      const dx = nx * Math.sin(sweep) + tan.x * Math.cos(sweep);
      const dy = ny * Math.sin(sweep) + tan.y * Math.cos(sweep);
      // Each filament droops slightly away from the tip at its end.
      const droop = 0.18 + 0.1 * Math.sin(i * 1.7);
      const ex = p.x + dx * len;
      const ey = p.y + dy * len + len * droop * 0.35;
      const cx = p.x + dx * len * 0.55 - tan.x * len * 0.08;
      const cy = p.y + dy * len * 0.55 - tan.y * len * 0.08;
      out.push({
        d: `M${r1(p.x)} ${r1(p.y)}Q${r1(cx)} ${r1(cy)} ${r1(ex)} ${r1(ey)}`,
        tone: t < 0.42 ? 0 : t < 0.78 ? 1 + (i % 2) : 2 - (i % 2),
        w: r1(lerp(1.5, 0.9, t)),
        o: r1(lerp(0.42, 0.85, smooth(0.1, 0.7, t)) * 100) / 100,
      });
    }
  }
  return out;
}

/** Short gold-bronze filaments fringing the eye — the "lashes" past its outer ring. */
function buildFringe() {
  const out = [];
  const N = 46;
  for (let i = 0; i < N; i += 1) {
    const a = (i / N) * Math.PI * 2;
    const rx = Math.cos(a);
    const ry = Math.sin(a);
    // Longer toward the tip, where the eye's outer band is widest.
    const reach = 1.62 + 0.42 * Math.max(0, -ry) + 0.06 * Math.sin(i * 2.3);
    const s = 1.5 * EYE_R;
    const e = reach * EYE_R;
    const bend = 0.12 * EYE_R * (i % 2 ? 1 : -1);
    out.push(
      `M${r1(rx * s)} ${r1(ry * s * 1.08)}Q${r1(rx * (s + e) / 2 - ry * bend)} ${r1(ry * (s + e) / 2 * 1.08 + rx * bend)} ${r1(rx * e)} ${r1(ry * e * 1.1)}`
    );
  }
  return out;
}

export const BARBS = buildBarbs();
export const FRINGE = buildFringe();
export const BARB_TONES = ["#7c7f3c", "#1d7a54", "#25847c"];
