import { BARBS, BARB_TONES, EYE_R, FRINGE, SHAFT, VIEW, eyePath, heartPath } from "./featherGeometry";

/**
 * A peacock feather drawn in SVG, in two separable layers so the transition
 * can move them a beat apart for depth:
 *
 *  - "vane": the quill and its barbs
 *  - "eye":  the ocellus — fringe, bronze, emerald, turquoise and the deep
 *            blue heart, with one restrained highlight for the iridescence
 *
 * `uid` prefixes every gradient id, so two feathers on a page never share one.
 * Colours: emerald, teal and peacock blue, with gold kept to hairlines and the
 * outer bronze band.
 */
export default function PeacockFeather({ uid, layer, ...svgProps }) {
  const id = (name) => `${uid}-${name}`;
  const viewBox = `${VIEW.x} ${VIEW.y} ${VIEW.w} ${VIEW.h}`;

  return (
    <svg {...svgProps} viewBox={viewBox} preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={id("quill")} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#d8c48a" />
          <stop offset=".7" stopColor="#b59d58" />
          <stop offset="1" stopColor="#8f7c3e" stopOpacity=".3" />
        </linearGradient>
        <radialGradient id={id("bronze")} cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform={`translate(0 ${-EYE_R * 0.1}) scale(${EYE_R * 1.6})`}>
          <stop offset=".6" stopColor="#6f6a2a" />
          <stop offset="1" stopColor="#a8923f" />
        </radialGradient>
        <radialGradient id={id("emerald")} cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform={`translate(0 ${EYE_R * 0.05}) scale(${EYE_R * 1.3})`}>
          <stop offset=".55" stopColor="#0f5e43" />
          <stop offset="1" stopColor="#1f8a5c" />
        </radialGradient>
        <radialGradient id={id("teal")} cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform={`translate(${-EYE_R * 0.2} ${-EYE_R * 0.25}) scale(${EYE_R * 1.05})`}>
          <stop offset="0" stopColor="#4fc0b3" />
          <stop offset=".7" stopColor="#1f948d" />
          <stop offset="1" stopColor="#14716f" />
        </radialGradient>
        <radialGradient id={id("heart")} cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform={`translate(${-EYE_R * 0.18} ${-EYE_R * 0.05}) scale(${EYE_R * 0.75})`}>
          <stop offset="0" stopColor="#1c4f9c" />
          <stop offset=".65" stopColor="#0e2f6d" />
          <stop offset="1" stopColor="#081c45" />
        </radialGradient>
      </defs>

      {layer !== "eye" && (
        <g>
          <g fill="none" strokeLinecap="round">
            {BARBS.map((b, i) => (
              <path key={i} d={b.d} stroke={BARB_TONES[b.tone]} strokeWidth={b.w} strokeOpacity={b.o} />
            ))}
          </g>
          <path d={SHAFT} fill="none" stroke={`url(#${id("quill")})`} strokeWidth="3.4" strokeLinecap="round" />
          <path d={SHAFT} fill="none" stroke="#f1e3b4" strokeOpacity=".45" strokeWidth="1" strokeLinecap="round" transform="translate(-1 0)" />
        </g>
      )}

      {layer !== "vane" && (
        <g>
          <g fill="none" stroke="#b79b48" strokeOpacity=".7" strokeWidth="1.1" strokeLinecap="round">
            {FRINGE.map((d, i) => <path key={i} d={d} />)}
          </g>
          <path d={eyePath(EYE_R * 1.5)} fill={`url(#${id("bronze")})`} />
          <path d={eyePath(EYE_R * 1.24, EYE_R * 0.04)} fill={`url(#${id("emerald")})`} />
          <path d={eyePath(EYE_R * 1.24, EYE_R * 0.04)} fill="none" stroke="#d6b75c" strokeOpacity=".55" strokeWidth=".9" />
          <path d={eyePath(EYE_R * 0.98, EYE_R * 0.08)} fill={`url(#${id("teal")})`} />
          <path d={heartPath(EYE_R * 0.66, EYE_R * 0.16)} fill={`url(#${id("heart")})`} />
          {/* One soft highlight on the turquoise band: iridescence, not glow. */}
          <path d={`M${-EYE_R * 0.62} ${-EYE_R * 0.38}Q${-EYE_R * 0.3} ${-EYE_R * 0.98} ${EYE_R * 0.28} ${-EYE_R * 0.9}`} fill="none" stroke="#b6f0e6" strokeOpacity=".42" strokeWidth="2.6" strokeLinecap="round" />
          <ellipse cx={-EYE_R * 0.24} cy={-EYE_R * 0.02} rx={EYE_R * 0.12} ry={EYE_R * 0.07} fill="#9fd8f0" fillOpacity=".28" transform={`rotate(-30 ${-EYE_R * 0.24} ${-EYE_R * 0.02})`} />
        </g>
      )}
    </svg>
  );
}
