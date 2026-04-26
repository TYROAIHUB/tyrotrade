import * as React from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import * as topojson from "topojson-client";
// world-atlas ships TopoJSON; cast to unknown so the bundler doesn't
// need a typed JSON declaration to compile.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — JSON without ts types
import worldAtlas from "world-atlas/land-110m.json";

/**
 * 3D globe scene for the TYROtrade login right panel.
 *
 * Composition:
 *   - Wireframe + landmass globe rendered from world-atlas TopoJSON,
 *     bright sky-blue continent outlines on a dark navy sphere.
 *   - 12 hub ports at major shipping nodes (rotating with the globe).
 *   - 14 great-circle trade routes with miniature vessel meshes
 *     (hull + deck + bridge + masthead light) gliding along them in
 *     continuous loops.
 *   - Multi-layered fresnel atmosphere for a soft, smooth halo.
 *   - Background star field placed far behind the globe (z<-12) so
 *     stars never render in front of the planet.
 *
 * Loaded lazily by `LoginPage` to keep the main bundle slim.
 */
export default function GlobeScene({
  accelerated = false,
}: {
  /** When true (login transition), spin + vessel speeds multiply for
   *  a cool "warp into the platform" effect. */
  accelerated?: boolean;
}) {
  return (
    <div className="absolute inset-0 w-full h-full">
      <Canvas
        camera={{ position: [0, 0.4, 5.3], fov: 42 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true }}
        style={{ background: "transparent" }}
      >
        <ambientLight intensity={0.5} />
        <directionalLight position={[3, 4, 2]} intensity={1.25} color="#bae6fd" />
        <pointLight position={[-4, -2, -2]} intensity={0.45} color="#38bdf8" />

        <React.Suspense fallback={null}>
          {/* Stars rendered FIRST and far back so the globe always
              draws on top. */}
          <BackgroundStars />
          <GlobeGroup accelerated={accelerated} />
        </React.Suspense>
      </Canvas>
    </div>
  );
}

/* ─────────── Globe + everything that rotates with it ─────────── */

function GlobeGroup({ accelerated }: { accelerated: boolean }) {
  const groupRef = React.useRef<THREE.Group>(null);
  // Spin speed multiplier eases towards 8× when `accelerated` flips,
  // back to 1× when released — gives a smooth "kick into hyperdrive"
  // feel rather than a jarring jump. We also hold the globe still for
  // ~1.8 s on first paint so the user can register Turkey before the
  // auto-rotate starts.
  const speedRef = React.useRef(1);
  const holdRef = React.useRef(0);
  useFrame((_, dt) => {
    holdRef.current += dt;
    const target = accelerated ? 8 : 1;
    speedRef.current += (target - speedRef.current) * Math.min(1, dt * 4);
    const idle = holdRef.current > 1.8 ? 0.025 : 0; // hold then slow drift
    if (groupRef.current)
      groupRef.current.rotation.y +=
        dt * speedRef.current * (accelerated ? 0.06 : idle);
  });

  // Initial rotation pre-aimed so Anatolia (≈ 39°N, 35°E) faces the
  // camera the moment the canvas mounts. Derived empirically — see
  // earlier debug pass; Three.js Y-rotation sign convention placed
  // Turkey at the back with positive 2.18 rad, so we flip to 4.10.
  return (
    <group ref={groupRef} rotation={[0.18, 4.1, 0]}>
      <WireGlobe />
      <ContinentOutlines />
      <PortHubs />
      <TradeRoutes accelerated={accelerated} />
      {/* Atmosphere drawn last so its additive layers sit on top of
          the globe edges. */}
      <Atmosphere />
    </group>
  );
}

/* ─────────── Wireframe sphere (the globe itself) ─────────── */

function WireGlobe() {
  // Solid sphere only — the previous wireframe overlay produced "+" grid
  // intersections that read as icons floating on the surface. Continent
  // outlines + atmosphere alone give the planet enough definition.
  return (
    <mesh>
      <sphereGeometry args={[1.5, 64, 48]} />
      <meshStandardMaterial
        color="#0c1a3e"
        metalness={0.35}
        roughness={0.85}
      />
    </mesh>
  );
}

/* ─────────── Continent outlines from world-atlas TopoJSON ─────────── */

function ContinentOutlines() {
  const lines = React.useMemo(() => {
    const fc = topojson.feature(
      worldAtlas as unknown as Parameters<typeof topojson.feature>[0],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (worldAtlas as any).objects.land
    ) as unknown as {
      features: Array<{
        geometry: { type: string; coordinates: number[][][] | number[][][][] };
      }>;
    };

    const segments: number[][] = [];
    // Filter out tiny island rings — anything with fewer than 24 vertices
    // (≈ small Pacific atolls, Aegean rocks) shows up as a "dot" cloud
    // rather than a continent outline at this zoom. Keeping only the
    // major landmasses gives a clean, readable globe.
    const MIN_RING_POINTS = 24;
    const pushIfMajor = (ring: number[][]) => {
      if (ring.length < MIN_RING_POINTS) return;
      segments.push(ringToSphere(ring, 1.51));
    };
    for (const feat of fc.features) {
      const { type, coordinates } = feat.geometry;
      if (type === "Polygon") {
        for (const ring of coordinates as number[][][]) {
          pushIfMajor(ring);
        }
      } else if (type === "MultiPolygon") {
        for (const poly of coordinates as number[][][][]) {
          for (const ring of poly) {
            pushIfMajor(ring);
          }
        }
      }
    }
    return segments;
  }, []);

  return (
    <group>
      {lines.map((arr, i) => (
        <line key={i}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              count={arr.length / 3}
              array={new Float32Array(arr)}
              itemSize={3}
              args={[new Float32Array(arr), 3]}
            />
          </bufferGeometry>
          <lineBasicMaterial color="#7dd3fc" transparent opacity={0.8} />
        </line>
      ))}
    </group>
  );
}

function ringToSphere(ring: number[][], radius: number): number[] {
  const out: number[] = [];
  for (const [lon, lat] of ring) {
    const [x, y, z] = latLonToVec3(lat, lon, radius);
    out.push(x, y, z);
  }
  return out;
}

function latLonToVec3(
  lat: number,
  lon: number,
  r: number
): [number, number, number] {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  return [
    -r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta),
  ];
}

/* ─────────── Multi-layer atmosphere ─────────── */

function Atmosphere() {
  // Just two fresnel shells:
  //   1. Tight inner rim — sky highlight on the globe edge
  //   2. Wide outer halo — soft sky→navy gradient that fades into space
  // The middle blue layers were redundant and made the glow feel busy.
  const layers = React.useMemo(
    () =>
      [
        { r: 1.555, color: "#bae6fd", power: 5.5, intensity: 0.85 },
        { r: 1.82, color: "#1e40af", power: 3.4, intensity: 0.5 },
      ].map((l) => ({
        r: l.r,
        uniforms: {
          glowColor: { value: new THREE.Color(l.color) },
          power: { value: l.power },
          intensity: { value: l.intensity },
        },
      })),
    []
  );

  return (
    <>
      {layers.map((l, i) => (
        <mesh key={i}>
          <sphereGeometry args={[l.r, 64, 48]} />
          <FresnelMaterial uniforms={l.uniforms} />
        </mesh>
      ))}
    </>
  );
}

/** Inline helper that wires up the shared fresnel shaderMaterial. */
function FresnelMaterial({
  uniforms,
}: {
  uniforms: {
    glowColor: { value: THREE.Color };
    power: { value: number };
    intensity: { value: number };
  };
}) {
  return (
    <shaderMaterial
      transparent
      depthWrite={false}
      side={THREE.BackSide}
      blending={THREE.AdditiveBlending}
      uniforms={uniforms}
      vertexShader={`
        varying vec3 vN;
        void main() {
          vN = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `}
      fragmentShader={`
        varying vec3 vN;
        uniform vec3 glowColor;
        uniform float power;
        uniform float intensity;
        void main() {
          float f = pow(1.0 - dot(vN, vec3(0.0, 0.0, 1.0)), power);
          gl_FragColor = vec4(glowColor, f * intensity);
        }
      `}
    />
  );
}

/* ─────────── Port hubs (rotates with globe) ─────────── */

const HUB_PORTS: { name: string; lat: number; lon: number }[] = [
  { name: "Istanbul", lat: 41.0082, lon: 28.9784 },
  { name: "Hamburg", lat: 53.5511, lon: 9.9937 },
  { name: "Rotterdam", lat: 51.9225, lon: 4.4792 },
  { name: "Shanghai", lat: 31.2304, lon: 121.4737 },
  { name: "Singapore", lat: 1.3521, lon: 103.8198 },
  { name: "Mumbai", lat: 19.076, lon: 72.8777 },
  { name: "Dubai", lat: 25.2048, lon: 55.2708 },
  { name: "Long Beach", lat: 33.7701, lon: -118.1937 },
  { name: "New Orleans", lat: 29.9511, lon: -90.0715 },
  { name: "Santos", lat: -23.9608, lon: -46.3331 },
  { name: "Cape Town", lat: -33.9249, lon: 18.4241 },
  { name: "Sydney", lat: -33.8688, lon: 151.2093 },
];

function PortHubs() {
  return (
    <group>
      {HUB_PORTS.map((p) => {
        const [x, y, z] = latLonToVec3(p.lat, p.lon, 1.51);
        return <PortPin key={p.name} pos={[x, y, z]} />;
      })}
    </group>
  );
}

function PortPin({ pos }: { pos: [number, number, number] }) {
  const ref = React.useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.getElapsedTime();
    const s = 1 + Math.sin(t * 2 + pos[0] * 5) * 0.22;
    ref.current.scale.setScalar(s);
  });
  return (
    <group position={pos}>
      <mesh ref={ref}>
        <sphereGeometry args={[0.025, 12, 12]} />
        <meshBasicMaterial color="#bae6fd" />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.05, 12, 12]} />
        <meshBasicMaterial color="#38bdf8" transparent opacity={0.4} />
      </mesh>
    </group>
  );
}

/* ─────────── Trade routes + moving vessels ─────────── */

// Maritime waypoints (lat, lon) — intermediate points that hug ocean
// corridors so trade routes never cut across continents.
const WP = {
  AEGEAN: [37.5, 25.0],
  E_MED: [34.5, 27.0],
  C_MED: [34.0, 18.0],
  W_MED: [37.0, 5.0],
  GIBRALTAR: [36.0, -5.5],
  N_ATLANTIC_E: [44.0, -12.0],
  ENGLISH_CHANNEL: [50.0, 0.5],
  N_SEA: [54.5, 4.0],
  BISCAY: [45.0, -8.0],
  NW_AFRICA: [25.0, -18.0],
  S_ATLANTIC_E: [10.0, -28.0],
  S_ATLANTIC_C: [-15.0, -25.0],
  S_ATLANTIC_W: [-22.0, -38.0],
  CARIBBEAN: [22.0, -75.0],
  N_ATLANTIC_W: [33.0, -65.0],
  // Suez corridor
  SUEZ_N: [31.5, 32.5],
  RED_SEA_C: [22.0, 38.0],
  BAB_EL_MANDEB: [12.5, 43.5],
  GULF_OF_ADEN: [12.0, 50.0],
  ARABIAN_SEA_W: [15.0, 60.0],
  ARABIAN_SEA_E: [12.0, 68.0],
  // Indian / Malacca / Pacific
  INDIAN_OCEAN_C: [5.0, 80.0],
  MALACCA: [3.5, 99.5],
  S_CHINA_SEA: [10.0, 113.0],
  E_CHINA_SEA: [27.0, 124.0],
  // Cape route (around Africa)
  S_AFRICA_W: [-30.0, 12.0],
  CAPE_OF_GOOD_HOPE: [-35.0, 19.0],
  // Persian Gulf
  STRAIT_HORMUZ: [26.5, 56.0],
  // Pacific
  N_PACIFIC_C: [22.0, 180.0],
  N_PACIFIC_E: [25.0, -150.0],
  EQUATOR_PACIFIC: [0.0, -160.0],
} as const;

// 14 routes. `via` lists ocean waypoints between the two ports.
const ROUTES: {
  from: number;
  to: number;
  via: readonly (readonly [number, number])[];
  speed: number;
  offset: number;
}[] = [
  // ─── Istanbul outbound ───
  // IST → Hamburg : Aegean → Med → Gibraltar → Atlantic → Channel → North Sea
  {
    from: 0,
    to: 1,
    via: [WP.AEGEAN, WP.C_MED, WP.W_MED, WP.GIBRALTAR, WP.BISCAY, WP.ENGLISH_CHANNEL, WP.N_SEA],
    speed: 0.05,
    offset: 0.0,
  },
  // IST → Rotterdam : same Mediterranean → North Atlantic spine
  {
    from: 0,
    to: 2,
    via: [WP.AEGEAN, WP.C_MED, WP.W_MED, WP.GIBRALTAR, WP.BISCAY, WP.ENGLISH_CHANNEL],
    speed: 0.048,
    offset: 0.15,
  },
  // IST → Shanghai : Aegean → Suez → Red Sea → Bab → Indian → Malacca → S.China
  {
    from: 0,
    to: 3,
    via: [WP.AEGEAN, WP.E_MED, WP.SUEZ_N, WP.RED_SEA_C, WP.BAB_EL_MANDEB, WP.ARABIAN_SEA_E, WP.INDIAN_OCEAN_C, WP.MALACCA, WP.S_CHINA_SEA, WP.E_CHINA_SEA],
    speed: 0.04,
    offset: 0.3,
  },
  // IST → Singapore : same Suez spine, exit at Malacca
  {
    from: 0,
    to: 4,
    via: [WP.AEGEAN, WP.E_MED, WP.SUEZ_N, WP.RED_SEA_C, WP.BAB_EL_MANDEB, WP.ARABIAN_SEA_E, WP.INDIAN_OCEAN_C, WP.MALACCA],
    speed: 0.042,
    offset: 0.45,
  },
  // IST → Mumbai : Suez → Red Sea → Arabian Sea
  {
    from: 0,
    to: 5,
    via: [WP.AEGEAN, WP.E_MED, WP.SUEZ_N, WP.RED_SEA_C, WP.BAB_EL_MANDEB, WP.ARABIAN_SEA_W],
    speed: 0.046,
    offset: 0.6,
  },
  // IST → Dubai : Suez → Red Sea → Aden → Hormuz
  {
    from: 0,
    to: 6,
    via: [WP.AEGEAN, WP.E_MED, WP.SUEZ_N, WP.RED_SEA_C, WP.BAB_EL_MANDEB, WP.GULF_OF_ADEN, WP.STRAIT_HORMUZ],
    speed: 0.05,
    offset: 0.75,
  },
  // IST → New Orleans : Med → Gibraltar → Mid-Atlantic → Caribbean
  {
    from: 0,
    to: 8,
    via: [WP.AEGEAN, WP.C_MED, WP.W_MED, WP.GIBRALTAR, WP.NW_AFRICA, WP.N_ATLANTIC_W, WP.CARIBBEAN],
    speed: 0.038,
    offset: 0.1,
  },
  // IST → Santos : Med → Gibraltar → NW Africa → S Atlantic
  {
    from: 0,
    to: 9,
    via: [WP.AEGEAN, WP.C_MED, WP.W_MED, WP.GIBRALTAR, WP.NW_AFRICA, WP.S_ATLANTIC_E, WP.S_ATLANTIC_C, WP.S_ATLANTIC_W],
    speed: 0.04,
    offset: 0.55,
  },
  // IST → Cape Town : Med → Gibraltar → NW Africa → S Atlantic E → SW Africa
  {
    from: 0,
    to: 10,
    via: [WP.AEGEAN, WP.C_MED, WP.W_MED, WP.GIBRALTAR, WP.NW_AFRICA, WP.S_ATLANTIC_E, WP.S_AFRICA_W, WP.CAPE_OF_GOOD_HOPE],
    speed: 0.044,
    offset: 0.85,
  },

  // ─── Cross-lane traffic ───
  // Long Beach → Shanghai : Trans-Pacific
  {
    from: 7,
    to: 3,
    via: [WP.N_PACIFIC_E, WP.N_PACIFIC_C],
    speed: 0.05,
    offset: 0.7,
  },
  // Sydney → Singapore : through Coral Sea / Java Sea
  {
    from: 11,
    to: 4,
    via: [[-15.0, 145.0], [-5.0, 130.0]],
    speed: 0.04,
    offset: 0.4,
  },
  // Shanghai → New Orleans : Trans-Pacific south
  {
    from: 3,
    to: 8,
    via: [WP.E_CHINA_SEA, WP.N_PACIFIC_C, WP.EQUATOR_PACIFIC, [10.0, -100.0], [18.0, -90.0]],
    speed: 0.045,
    offset: 0.2,
  },
  // Dubai → Mumbai : Hormuz → Arabian Sea
  {
    from: 6,
    to: 5,
    via: [WP.STRAIT_HORMUZ, WP.ARABIAN_SEA_W],
    speed: 0.042,
    offset: 0.65,
  },
  // Santos → Cape Town : direct South Atlantic
  {
    from: 9,
    to: 10,
    via: [WP.S_ATLANTIC_W, WP.S_ATLANTIC_C, WP.S_AFRICA_W],
    speed: 0.046,
    offset: 0.25,
  },

  // ─── Additional global lanes for visual density ───
  // Hamburg → New Orleans : Trans-Atlantic
  {
    from: 1,
    to: 8,
    via: [WP.ENGLISH_CHANNEL, WP.BISCAY, WP.N_ATLANTIC_E, WP.N_ATLANTIC_W, WP.CARIBBEAN],
    speed: 0.044,
    offset: 0.35,
  },
  // Rotterdam → Santos : N→S Atlantic
  {
    from: 2,
    to: 9,
    via: [WP.ENGLISH_CHANNEL, WP.BISCAY, WP.NW_AFRICA, WP.S_ATLANTIC_E, WP.S_ATLANTIC_C, WP.S_ATLANTIC_W],
    speed: 0.038,
    offset: 0.5,
  },
  // Singapore → Hamburg : Indian → Suez → Med → North
  {
    from: 4,
    to: 1,
    via: [WP.MALACCA, WP.INDIAN_OCEAN_C, WP.ARABIAN_SEA_E, WP.BAB_EL_MANDEB, WP.RED_SEA_C, WP.SUEZ_N, WP.E_MED, WP.C_MED, WP.W_MED, WP.GIBRALTAR, WP.BISCAY, WP.ENGLISH_CHANNEL, WP.N_SEA],
    speed: 0.032,
    offset: 0.05,
  },
  // Mumbai → Long Beach : Indian → Pacific
  {
    from: 5,
    to: 7,
    via: [WP.ARABIAN_SEA_W, WP.INDIAN_OCEAN_C, WP.MALACCA, WP.S_CHINA_SEA, WP.E_CHINA_SEA, WP.N_PACIFIC_C, WP.N_PACIFIC_E],
    speed: 0.034,
    offset: 0.78,
  },
  // Cape Town → Singapore : South Indian
  {
    from: 10,
    to: 4,
    via: [WP.CAPE_OF_GOOD_HOPE, [-30.0, 50.0], [-15.0, 75.0], [-3.0, 95.0], WP.MALACCA],
    speed: 0.04,
    offset: 0.62,
  },
  // Dubai → Rotterdam : Hormuz → Aden → Suez → Med → North Atlantic
  {
    from: 6,
    to: 2,
    via: [WP.STRAIT_HORMUZ, WP.GULF_OF_ADEN, WP.BAB_EL_MANDEB, WP.RED_SEA_C, WP.SUEZ_N, WP.E_MED, WP.C_MED, WP.W_MED, WP.GIBRALTAR, WP.BISCAY, WP.ENGLISH_CHANNEL],
    speed: 0.036,
    offset: 0.92,
  },
  // Sydney → Long Beach : Trans-Pacific south
  {
    from: 11,
    to: 7,
    via: [[-25.0, 165.0], [-10.0, -160.0], [10.0, -140.0], WP.N_PACIFIC_E],
    speed: 0.04,
    offset: 0.48,
  },
  // New Orleans → Santos : Caribbean → Atlantic south
  {
    from: 8,
    to: 9,
    via: [WP.CARIBBEAN, [12.0, -55.0], [-5.0, -38.0], WP.S_ATLANTIC_W],
    speed: 0.042,
    offset: 0.18,
  },
];

function TradeRoutes({ accelerated }: { accelerated: boolean }) {
  const curves = React.useMemo(() => {
    return ROUTES.map((r) => {
      const a = HUB_PORTS[r.from];
      const b = HUB_PORTS[r.to];
      // Build the full polyline: port → all waypoints → port. Each
      // point is lifted slightly off the surface so the route arcs
      // visibly above the globe.
      const RADIUS = 1.55;
      const all: THREE.Vector3[] = [
        new THREE.Vector3(...latLonToVec3(a.lat, a.lon, RADIUS)),
        ...r.via.map(
          ([lat, lon]) =>
            new THREE.Vector3(...latLonToVec3(lat, lon, RADIUS))
        ),
        new THREE.Vector3(...latLonToVec3(b.lat, b.lon, RADIUS)),
      ];
      // Chordal Catmull-Rom + medium tension keeps tangents stable
      // even on long routes with many waypoints. The previous
      // "centripetal" + low tension (0.2) produced loops on dense
      // waypoint clusters and made vessels appear to "skip" segments.
      return new THREE.CatmullRomCurve3(all, false, "chordal", 0.5);
    });
  }, []);

  return (
    <group>
      {curves.map((curve, i) => (
        <RouteArc
          key={i}
          curve={curve}
          speed={ROUTES[i].speed}
          offset={ROUTES[i].offset}
          accelerated={accelerated}
        />
      ))}
    </group>
  );
}

function RouteArc({
  curve,
  speed,
  offset,
  accelerated,
}: {
  curve: THREE.CatmullRomCurve3;
  speed: number;
  offset: number;
  accelerated: boolean;
}) {
  const points = React.useMemo(
    () => curve.getPoints(120).flatMap((p) => [p.x, p.y, p.z]),
    [curve]
  );
  const pointArray = React.useMemo(() => new Float32Array(points), [points]);
  const vesselRef = React.useRef<THREE.Group>(null);
  const tRef = React.useRef(offset);
  const speedMultRef = React.useRef(1);

  useFrame((_, dt) => {
    const target = accelerated ? 5 : 1;
    speedMultRef.current +=
      (target - speedMultRef.current) * Math.min(1, dt * 4);
    tRef.current += dt * speed * speedMultRef.current;
    if (tRef.current > 1) tRef.current -= 1;
    const t = tRef.current;
    const pos = curve.getPoint(t);
    const tan = curve.getTangent(t);
    if (vesselRef.current) {
      vesselRef.current.position.copy(pos);
      // Orient the vessel so its long axis follows the curve tangent
      // and its "up" points away from the globe's centre.
      const up = pos.clone().normalize();
      const m = new THREE.Matrix4();
      m.lookAt(new THREE.Vector3(0, 0, 0), tan.clone().normalize(), up);
      vesselRef.current.quaternion.setFromRotationMatrix(m);
    }
  });

  return (
    <group>
      {/* Glowing arc — slightly above the globe surface */}
      <line>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={pointArray.length / 3}
            array={pointArray}
            itemSize={3}
            args={[pointArray, 3]}
          />
        </bufferGeometry>
        <lineBasicMaterial color="#38bdf8" transparent opacity={0.55} />
      </line>

      <Vessel groupRef={vesselRef} />
    </group>
  );
}

/* ─────────── Vessel mesh — proper cargo-ship silhouette ───────────
 *
 *  Composed of small primitives (hull, deck, container stacks,
 *  bridge tower, masthead light) that read as a tiny ship from a
 *  distance. Scale tuned for a globe radius of 1.5.                 */

function Vessel({ groupRef }: { groupRef: React.RefObject<THREE.Group | null> }) {
  return (
    // The lookAt orientation expects the vessel's local +Z axis to
    // match the curve tangent ("forward"). Local +Y points outward
    // from the globe; the deck stack therefore sits along +Y.
    <group ref={groupRef}>
      {/* Hull — long, slim, slight V-shape achieved with a stretched box */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[0.018, 0.012, 0.06]} />
        <meshStandardMaterial
          color="#1e3a8a"
          metalness={0.4}
          roughness={0.55}
          emissive="#1e40af"
          emissiveIntensity={0.25}
        />
      </mesh>
      {/* Deck plate */}
      <mesh position={[0, 0.008, 0]}>
        <boxGeometry args={[0.02, 0.002, 0.06]} />
        <meshStandardMaterial color="#172554" roughness={0.7} />
      </mesh>
      {/* Container stack 1 (mid-front) */}
      <mesh position={[0, 0.014, -0.012]}>
        <boxGeometry args={[0.014, 0.008, 0.018]} />
        <meshStandardMaterial
          color="#7dd3fc"
          emissive="#7dd3fc"
          emissiveIntensity={0.35}
        />
      </mesh>
      {/* Container stack 2 (mid-back) */}
      <mesh position={[0, 0.014, 0.008]}>
        <boxGeometry args={[0.014, 0.008, 0.014]} />
        <meshStandardMaterial
          color="#bae6fd"
          emissive="#bae6fd"
          emissiveIntensity={0.4}
        />
      </mesh>
      {/* Bridge / superstructure (rear) */}
      <mesh position={[0, 0.018, 0.022]}>
        <boxGeometry args={[0.012, 0.012, 0.008]} />
        <meshStandardMaterial
          color="#e0f2fe"
          emissive="#bae6fd"
          emissiveIntensity={0.55}
        />
      </mesh>
      {/* Masthead light — bright dot above the bridge */}
      <mesh position={[0, 0.028, 0.022]}>
        <sphereGeometry args={[0.0035, 8, 8]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
      {/* Wake glow halo around the vessel */}
      <mesh>
        <sphereGeometry args={[0.05, 12, 12]} />
        <meshBasicMaterial color="#7dd3fc" transparent opacity={0.18} />
      </mesh>
    </group>
  );
}

/* ─────────── Background stars (always behind the globe) ─────────── */

function BackgroundStars() {
  // Realistic space backdrop: three layered point clouds at different
  // depths and brightnesses, plus a sparse cluster of "bright" stars
  // for visual interest. Positions stay well behind the globe so
  // nothing renders in front of the planet.
  return (
    <>
      <StarLayer count={420} sizeMin={0.012} sizeMax={0.025} zNear={-22} zFar={-44} color="#94a3b8" opacity={0.55} />
      <StarLayer count={200} sizeMin={0.025} sizeMax={0.05} zNear={-18} zFar={-30} color="#cbd5e1" opacity={0.7} />
      <StarLayer count={45} sizeMin={0.06} sizeMax={0.1} zNear={-15} zFar={-22} color="#f1f5f9" opacity={0.95} />
    </>
  );
}

function StarLayer({
  count,
  sizeMin,
  sizeMax,
  zNear,
  zFar,
  color,
  opacity,
}: {
  count: number;
  sizeMin: number;
  sizeMax: number;
  zNear: number;
  zFar: number;
  color: string;
  opacity: number;
}) {
  const ref = React.useRef<THREE.Points>(null);
  const { positions, sizes } = React.useMemo(() => {
    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      // Wide spherical-ish shell behind the globe
      const angle = Math.random() * Math.PI * 2;
      const radius = 6 + Math.random() * 30;
      positions[i * 3] = Math.cos(angle) * radius;
      positions[i * 3 + 1] = Math.sin(angle) * radius * (0.6 + Math.random() * 0.5);
      positions[i * 3 + 2] = zNear - Math.random() * (zNear - zFar);
      sizes[i] = sizeMin + Math.random() * (sizeMax - sizeMin);
    }
    return { positions, sizes };
  }, [count, sizeMin, sizeMax, zNear, zFar]);

  useFrame((_, dt) => {
    if (!ref.current) return;
    // Different drift speeds per layer → parallax illusion
    ref.current.rotation.y += dt * 0.005;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={positions}
          itemSize={3}
          args={[positions, 3]}
        />
        <bufferAttribute
          attach="attributes-size"
          count={count}
          array={sizes}
          itemSize={1}
          args={[sizes, 1]}
        />
      </bufferGeometry>
      <pointsMaterial
        size={sizeMax}
        color={color}
        transparent
        opacity={opacity}
        sizeAttenuation
      />
    </points>
  );
}
