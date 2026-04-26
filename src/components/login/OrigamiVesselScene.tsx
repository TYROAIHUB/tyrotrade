import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";

/**
 * Realistic Sea Horizon scene for the login right panel.
 *
 * Layered composition:
 *   1. Background: real cargo-vessel photo at sea (Pexels), positioned
 *      so the ship sits on the horizon line.
 *   2. Night-mood gradient overlay — deep navy → translucent so the
 *      photo desaturates into the brand palette without losing detail.
 *   3. Realistic SVG moon — radial gradients + shadow craters in the
 *      upper-right sky.
 *   4. Atmosphere — animated wave rings, port beacons, twinkling stars.
 *
 * Mouse parallax shifts moon + atmosphere slightly. Respects
 * `prefers-reduced-motion` (no animation, no parallax).
 */
export function OrigamiVesselScene() {
  const prefersReduced = useReducedMotion();
  const ref = React.useRef<HTMLDivElement>(null);
  const [mouse, setMouse] = React.useState({ x: 0, y: 0 });

  React.useEffect(() => {
    if (prefersReduced) return;
    const el = ref.current;
    if (!el) return;
    const onMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      setMouse({
        x: (e.clientX - cx) / (rect.width / 2),
        y: (e.clientY - cy) / (rect.height / 2),
      });
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, [prefersReduced]);

  return (
    <div
      ref={ref}
      className="relative w-full h-full overflow-hidden bg-[#020617]"
      aria-hidden
    >
      {/* ─── Layer 1: Real cargo vessel photograph ─── */}
      <motion.img
        src={VESSEL_PHOTO}
        alt=""
        loading="eager"
        className="absolute inset-0 w-full h-full object-cover"
        style={{
          // Slight blue tint + reduced saturation so the photo blends
          // into the brand palette rather than competing with it.
          filter: "saturate(0.65) brightness(0.55) hue-rotate(-12deg)",
          transform: prefersReduced
            ? undefined
            : `translate(${mouse.x * -10}px, ${mouse.y * -6}px) scale(1.06)`,
          transition: prefersReduced ? undefined : "transform 0.6s ease-out",
        }}
      />

      {/* ─── Layer 2: Night-mood gradient overlay ─── */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "linear-gradient(180deg, rgba(2,6,23,0.78) 0%, rgba(12,26,62,0.55) 30%, rgba(30,58,138,0.35) 55%, rgba(2,6,23,0.65) 100%)",
        }}
      />

      {/* Soft cyan glow at the top — creates a moonlit-night feel */}
      <div
        className="absolute inset-x-0 top-0 h-1/2 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at 75% 25%, rgba(56,189,248,0.22) 0%, transparent 55%)",
        }}
      />

      {/* Left-edge fade — blends the panel into the login content */}
      <div
        className="absolute inset-y-0 left-0 w-40 pointer-events-none"
        style={{
          background:
            "linear-gradient(to right, #020617 0%, rgba(2,6,23,0.5) 50%, transparent 100%)",
        }}
      />

      {/* ─── Layer 3: SVG decorations (moon, atmosphere) ─── */}
      <svg
        viewBox="0 0 800 900"
        className="absolute inset-0 w-full h-full pointer-events-none"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          {/* Realistic moon — multi-stop radial gradient with subtle
              terminator (light → shadow side). */}
          <radialGradient id="moon-body" cx="40%" cy="40%" r="65%">
            <stop offset="0%" stopColor="#fefce8" />
            <stop offset="35%" stopColor="#f5f5f4" />
            <stop offset="65%" stopColor="#a8a29e" />
            <stop offset="90%" stopColor="#44403c" />
            <stop offset="100%" stopColor="#1c1917" />
          </radialGradient>

          {/* Soft atmospheric halo around the moon */}
          <radialGradient id="moon-halo" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#bae6fd" stopOpacity="0.45" />
            <stop offset="50%" stopColor="#38bdf8" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#1e3a8a" stopOpacity="0" />
          </radialGradient>

          {/* Crater shadow */}
          <radialGradient id="crater-shadow" cx="40%" cy="40%" r="60%">
            <stop offset="0%" stopColor="#57534e" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#a8a29e" stopOpacity="0" />
          </radialGradient>

          {/* Crater highlight (small bright edge) */}
          <radialGradient id="crater-light" cx="35%" cy="35%" r="50%">
            <stop offset="0%" stopColor="#fafaf9" stopOpacity="0.65" />
            <stop offset="100%" stopColor="#fafaf9" stopOpacity="0" />
          </radialGradient>

          {/* Port beacon glow */}
          <radialGradient id="beacon-glow">
            <stop offset="0%" stopColor="#bae6fd" stopOpacity="1" />
            <stop offset="40%" stopColor="#38bdf8" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Moon group — upper-right, prominent realistic disc with
            multi-layer halo, terminator shading, and crater detail. */}
        <motion.g
          style={
            prefersReduced
              ? undefined
              : {
                  transform: `translate(${mouse.x * 14}px, ${mouse.y * 7}px)`,
                  transition: "transform 0.6s ease-out",
                }
          }
        >
          {/* Outer atmospheric halo — soft sky-blue glow */}
          <circle cx="630" cy="200" r="280" fill="url(#moon-halo)" />
          <circle cx="630" cy="200" r="200" fill="url(#moon-halo)" opacity="0.7" />
          <circle cx="630" cy="200" r="150" fill="url(#moon-halo)" opacity="0.55" />

          {/* Moon body — larger main disc */}
          <circle cx="630" cy="200" r="110" fill="url(#moon-body)" />

          {/* Surface craters — scaled up to match larger moon */}
          {CRATERS.map((c, i) => (
            <g
              key={i}
              transform={`translate(${630 + c.dx * 1.7}, ${200 + c.dy * 1.7})`}
            >
              <circle r={c.r * 1.7} fill="url(#crater-shadow)" opacity={c.o} />
              {c.r > 4 && (
                <circle
                  cx={-c.r * 0.4}
                  cy={-c.r * 0.4}
                  r={c.r * 0.7}
                  fill="url(#crater-light)"
                />
              )}
            </g>
          ))}

          {/* Maria (dark plains) — subtle large dark patches */}
          <circle cx="612" cy="178" r="22" fill="#57534e" opacity="0.18" />
          <circle cx="660" cy="232" r="28" fill="#44403c" opacity="0.22" />
          <circle cx="595" cy="225" r="14" fill="#57534e" opacity="0.18" />

          {/* Top-left lit highlight (simulates sun-side illumination) */}
          <ellipse
            cx="595"
            cy="170"
            rx="48"
            ry="32"
            fill="#fefce8"
            opacity="0.22"
          />
          <ellipse
            cx="588"
            cy="165"
            rx="20"
            ry="14"
            fill="#fefce8"
            opacity="0.32"
          />

          {/* Soft outer rim shadow on the dark side */}
          <circle
            cx="630"
            cy="200"
            r="110"
            fill="none"
            stroke="#1c1917"
            strokeWidth="2"
            opacity="0.3"
          />
        </motion.g>

        {/* Stars in the upper sky */}
        <g fill="#ffffff">
          {STARS.map((s, i) => (
            <circle key={i} cx={s.x} cy={s.y} r={s.r} opacity={s.o}>
              {!prefersReduced && i % 3 === 0 && (
                <animate
                  attributeName="opacity"
                  values={`${s.o};${s.o * 0.35};${s.o}`}
                  dur={`${3 + (i % 4)}s`}
                  repeatCount="indefinite"
                />
              )}
            </circle>
          ))}
        </g>

        {/* Port beacons floating across the sea */}
        <g>
          {BEACONS.map((b, i) => (
            <g key={i} transform={`translate(${b.x}, ${b.y})`}>
              <circle r="22" fill="url(#beacon-glow)">
                {!prefersReduced && (
                  <animate
                    attributeName="r"
                    values="18;30;18"
                    dur={`${3 + (i % 3) * 0.7}s`}
                    repeatCount="indefinite"
                  />
                )}
                {!prefersReduced && (
                  <animate
                    attributeName="opacity"
                    values="0.85;0.3;0.85"
                    dur={`${3 + (i % 3) * 0.7}s`}
                    repeatCount="indefinite"
                  />
                )}
              </circle>
              <circle r="3" fill="#bae6fd" />
              <circle r="1" fill="#ffffff" />
            </g>
          ))}
        </g>

        {/* Animated wave rings — emanate from the vessel's photographed
            position (roughly viewBox center, slightly below mid). */}
        {!prefersReduced &&
          [0, 1, 2].map((i) => (
            <circle
              key={i}
              cx="400"
              cy="540"
              r="20"
              fill="none"
              stroke="#7dd3fc"
              strokeWidth="1.4"
              opacity="0.55"
            >
              <animate
                attributeName="r"
                from="20"
                to="220"
                dur="6s"
                begin={`${i * 2}s`}
                repeatCount="indefinite"
              />
              <animate
                attributeName="opacity"
                from="0.55"
                to="0"
                dur="6s"
                begin={`${i * 2}s`}
                repeatCount="indefinite"
              />
              <animate
                attributeName="stroke-width"
                from="1.6"
                to="0.3"
                dur="6s"
                begin={`${i * 2}s`}
                repeatCount="indefinite"
              />
            </circle>
          ))}
      </svg>
    </div>
  );
}

/* ─────────── Assets ─────────── */

// Real cargo vessel at sea (Pexels — verified large container ship under
// way in open water). Same family as the project hero images.
const VESSEL_PHOTO =
  "https://images.pexels.com/photos/35982637/pexels-photo-35982637.jpeg?auto=compress&cs=tinysrgb&w=1600&fit=crop";

// Moon surface craters — relative offsets from moon center, opacity, radius.
const CRATERS = [
  { dx: -22, dy: -8, r: 8, o: 0.7 },
  { dx: 14, dy: -22, r: 6, o: 0.6 },
  { dx: 18, dy: 10, r: 11, o: 0.65 },
  { dx: -10, dy: 22, r: 5, o: 0.55 },
  { dx: 30, dy: 28, r: 4, o: 0.5 },
  { dx: -28, dy: 18, r: 3.5, o: 0.45 },
  { dx: -4, dy: -28, r: 3, o: 0.4 },
  { dx: 38, dy: -10, r: 2.5, o: 0.4 },
  { dx: 8, dy: 32, r: 2.5, o: 0.35 },
  { dx: -34, dy: -22, r: 2, o: 0.35 },
];

// Atmospheric stars
const STARS = [
  { x: 80, y: 60, r: 0.8, o: 0.7 },
  { x: 180, y: 110, r: 0.5, o: 0.5 },
  { x: 260, y: 50, r: 0.9, o: 0.85 },
  { x: 340, y: 170, r: 0.6, o: 0.55 },
  { x: 460, y: 90, r: 0.7, o: 0.65 },
  { x: 540, y: 200, r: 0.5, o: 0.45 },
  { x: 720, y: 60, r: 0.8, o: 0.75 },
  { x: 760, y: 140, r: 0.6, o: 0.55 },
  { x: 60, y: 230, r: 0.4, o: 0.4 },
  { x: 130, y: 320, r: 0.5, o: 0.5 },
  { x: 30, y: 150, r: 0.5, o: 0.45 },
  { x: 150, y: 30, r: 0.6, o: 0.55 },
];

// Port beacons floating across the lower portion (sea level)
const BEACONS = [
  { x: 130, y: 700 },
  { x: 280, y: 770 },
  { x: 580, y: 720 },
  { x: 700, y: 800 },
];
