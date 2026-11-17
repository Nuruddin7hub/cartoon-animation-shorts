// Timeline for "How a 14-Inch Drill Bit Swallowed an Entire Lake" (Lake Peigneur, Nov 20, 1980)
// Locked to audio/peigneur/words.json (63.824 s voice + tail = 1933 frames @ 30 fps)
export const FPS = 30;
export const TOTAL = 1933;
export type V3 = [number, number, number];

export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const smooth = (x: number) => { const u = clamp01(x); return u * u * (3 - 2 * u); };
export const easeOut = (u: number) => 1 - (1 - clamp01(u)) ** 4;
export const glide = (u: number) => { const x = clamp01(u); return x * x * x * (x * (6 * x - 15) + 10); };

export type Light = "day" | "golden";
export type SceneMode = "surface" | "mine" | "whirlpool" | "waterfall" | "pop";
export type ShotDef = { id: number; a: number; b: number; light: Light; mode: SceneMode };

export const SHOTS: ShotDef[] = [
  { id: 1,  a: 0,    b: 168,  light: "day",    mode: "whirlpool" }, // hook: 14-inch drill bit drained 1,125-acre lake
  { id: 2,  a: 168,  b: 300,  light: "day",    mode: "surface" },   // setting: calm 3-ft fishing pond
  { id: 3,  a: 300,  b: 508,  light: "day",    mode: "mine" },      // hidden: 1,300 ft deep salt mine, 55 miners
  { id: 4,  a: 508,  b: 642,  light: "day",    mode: "surface" },   // fail1: Nov 20 1980, oil rig drilled straight down
  { id: 5,  a: 642,  b: 751,  light: "day",    mode: "mine" },      // fail2: at 1,228 ft, 14-inch bit got stuck
  { id: 6,  a: 751,  b: 900,  light: "day",    mode: "mine" },      // fail3: rig tilted, punched through ceiling
  { id: 7,  a: 900,  b: 1142, light: "day",    mode: "whirlpool" }, // analogy: fresh water dissolves salt -> whirlpool
  { id: 8,  a: 1142, b: 1330, light: "day",    mode: "whirlpool" }, // swallow: rig, 11 barges, tugboat, 65 acres
  { id: 9,  a: 1330, b: 1616, light: "day",    mode: "waterfall" }, // climax: 164-ft waterfall + 400-ft geysers
  { id: 10, a: 1616, b: 1784, light: "golden", mode: "mine" },      // escape: 55 miners rode one elevator out
  { id: 11, a: 1784, b: TOTAL,light: "golden", mode: "pop" },       // twist: 9 of 11 barges popped back up like corks
];

export const XFADE: Record<number, number> = { 3: 6, 4: 6, 5: 6, 7: 6, 9: 8, 10: 8, 11: 8 };
export const FLASH_AT = 168;

export const shotAt = (f: number) => SHOTS.find((s) => f >= s.a && f < s.b) ?? SHOTS[SHOTS.length - 1];
export const layersAt = (f: number): { id: number; alpha: number }[] => {
  for (const s of SHOTS) {
    const x = XFADE[s.id];
    if (x && f >= s.a - x / 2 && f < s.a + x / 2) {
      return [{ id: s.id - 1, alpha: 1 }, { id: s.id, alpha: (f - (s.a - x / 2) + 1) / (x + 1) }];
    }
  }
  return [{ id: shotAt(f).id, alpha: 1 }];
};

export type PeigneurState = {
  drillY: number;        // drill bit depth
  rigTilt: number;       // radians rig leans
  rigSink: number;       // 0..1 rig disappearing
  vortex: number;        // 0..1 whirlpool intensity
  waterLevel: number;    // 0 (full) -> -8 (drained) -> -1 (refilled)
  breach: number;        // 0..1 hole opening in mine ceiling
  geyser: number;        // 0..1 geyser eruption
  waterfall: number;     // 0..1 reverse canal waterfall
  elevatorY: number;     // mine elevator y
  bargePop: number;      // 0..1 barges popping back up
};

export const stateAt = (id: number, f: number): PeigneurState => {
  const t = f / FPS;
  // Base defaults per shot so every shot is crystal-clear even during crossfades
  if (id === 1) {
    const u = clamp01(f / 168);
    return { drillY: -12, rigTilt: 0.12 + 0.28 * smooth(u), rigSink: 0.25 * u, vortex: 0.55 + 0.45 * u, waterLevel: -1.5 * u, breach: 0.7, geyser: 0, waterfall: 0, elevatorY: -20, bargePop: 0 };
  }
  if (id === 2) {
    return { drillY: 4, rigTilt: 0, rigSink: 0, vortex: 0, waterLevel: 0, breach: 0, geyser: 0, waterfall: 0, elevatorY: -20, bargePop: 0 };
  }
  if (id === 3) {
    return { drillY: -6, rigTilt: 0, rigSink: 0, vortex: 0, waterLevel: 0, breach: 0, geyser: 0, waterfall: 0, elevatorY: -22, bargePop: 0 };
  }
  if (id === 4) {
    const u = clamp01((f - 508) / 134);
    return { drillY: -2 - 10 * u, rigTilt: 0, rigSink: 0, vortex: 0, waterLevel: 0, breach: 0, geyser: 0, waterfall: 0, elevatorY: -22, bargePop: 0 };
  }
  if (id === 5) {
    const u = clamp01((f - 642) / 109);
    const jam = u > 0.45 ? Math.sin(u * 45) * 0.08 : 0;
    return { drillY: -13.2 + jam, rigTilt: 0, rigSink: 0, vortex: 0, waterLevel: 0, breach: u > 0.65 ? 0.12 : 0, geyser: 0, waterfall: 0, elevatorY: -22, bargePop: 0 };
  }
  if (id === 6) {
    const u = clamp01((f - 751) / 149);
    const punch = smooth((u - 0.35) / 0.3);
    return { drillY: -13.5 - 3.5 * punch, rigTilt: 0.22 * smooth(u), rigSink: 0, vortex: 0.15 * punch, waterLevel: 0, breach: 0.15 + 0.75 * punch, geyser: 0, waterfall: 0, elevatorY: -22, bargePop: 0 };
  }
  if (id === 7) {
    const u = clamp01((f - 900) / 242);
    return { drillY: -17, rigTilt: 0.18 + 0.25 * u, rigSink: 0.15 * u, vortex: 0.35 + 0.65 * smooth(u), waterLevel: -0.5 - 2.5 * u, breach: 1, geyser: 0, waterfall: 0, elevatorY: -22, bargePop: 0 };
  }
  if (id === 8) {
    const u = clamp01((f - 1142) / 188);
    return { drillY: -18, rigTilt: 0.45 + 0.55 * smooth(u), rigSink: smooth(u), vortex: 1.0, waterLevel: -3.0 - 3.5 * smooth(u), breach: 1, geyser: 0, waterfall: 0.2 * u, elevatorY: -22, bargePop: 0 };
  }
  if (id === 9) {
    const u = clamp01((f - 1330) / 286);
    const gey = smooth((u - 0.52) / 0.18);
    return { drillY: -20, rigTilt: 1, rigSink: 1, vortex: 0.35, waterLevel: -6.5 + 2.5 * u, breach: 1, geyser: gey * (0.85 + 0.15 * Math.sin(t * 14)), waterfall: 1.0, elevatorY: -22, bargePop: 0 };
  }
  if (id === 10) {
    const u = clamp01((f - 1616) / 168);
    return { drillY: -20, rigTilt: 1, rigSink: 1, vortex: 0, waterLevel: -2, breach: 1, geyser: 0, waterfall: 0, elevatorY: -23 + 22 * smooth(u), bargePop: 0 };
  }
  // id === 11
  const u = clamp01((f - 1784) / (TOTAL - 1784));
  return { drillY: -20, rigTilt: 1, rigSink: 1, vortex: 0, waterLevel: -0.8, breach: 0, geyser: 0, waterfall: 0, elevatorY: 0, bargePop: smooth(u / 0.65) };
};

// ---------------- camera ----------------
export type Cam = { pos: V3; look: V3; fov: number; roll: number };
type Shot = Partial<Cam> & { pos: V3; look: V3 };
type Key = { f: number; dur?: number; cut?: boolean; s: (f: number) => Shot };
const full = (c: Shot): Cam => ({ fov: 40, roll: 0, ...c });
const mix = (a: Cam, b: Cam, k: number): Cam => ({
  pos: a.pos.map((v, i) => v + (b.pos[i] - v) * k) as V3,
  look: a.look.map((v, i) => v + (b.look[i] - v) * k) as V3,
  fov: a.fov + (b.fov - a.fov) * k,
  roll: a.roll + (b.roll - a.roll) * k,
});
const run = (keys: Key[], f: number) => {
  let cur = full(keys[0].s(f));
  for (let i = 1; i < keys.length; i++) {
    const k = keys[i];
    if (f < k.f) break;
    cur = k.cut ? full(k.s(f)) : mix(cur, full(k.s(f)), glide((f - k.f) / (k.dur ?? 24)));
  }
  return cur;
};
const pushK = (f: number, f0: number, rate: number, punch = 0, n = 35) => {
  const x = Math.max(0, f - f0);
  let s = rate * x;
  if (punch > rate) for (let i = 0; i < Math.min(x, n); i++) s += (punch - rate) * Math.max(0, Math.min(1, (i + 0.5) / 8, (n - i - 0.5) / 8));
  return s;
};
const dolly = (pos: V3, look: V3, k: number): V3 => pos.map((v, i) => v + (look[i] - v) * k) as V3;

const CAMS: Record<number, Key[]> = {
  1: [
    { f: 0, s: (f) => ({ pos: dolly([18, 9, 26], [0, 0.5, 0], pushK(f, 0, 0.0025, 0.005, 30)), look: [0, 0.5, 0], fov: 44, roll: -0.05 }) },
    { f: 84, dur: 30, s: (f) => ({ pos: dolly([10, 12, 16], [0, -1, 0], pushK(f, 84, 0.003)), look: [0, -1, 0], fov: 40, roll: 0.04 }) },
  ],
  2: [
    { f: 168, s: (f) => ({ pos: dolly([-16, 4.2, 22], [2, 1.0, 0], pushK(f, 168, 0.0022)), look: [2, 1.0, 0], fov: 40, roll: 0 }) },
  ],
  3: [
    { f: 300, s: (f) => ({ pos: dolly([11, -17.5, 16], [0, -19.5, 0], pushK(f, 300, 0.0022)), look: [0, -19.5, 0], fov: 44, roll: 0 }) },
    { f: 410, dur: 26, s: (f) => ({ pos: dolly([-9, -18.2, 12], [0, -19.5, 0], pushK(f, 410, 0.0028)), look: [0, -19.5, 0], fov: 42, roll: 0.03 }) },
  ],
  4: [
    { f: 508, s: (f) => ({ pos: dolly([14, 5.5, 18], [0, 3.2, 0], pushK(f, 508, 0.0025)), look: [0, 3.2, 0], fov: 42, roll: 0 }) },
  ],
  5: [
    { f: 642, s: (f) => ({ pos: dolly([5.5, -13.5, 8.5], [0, -13.2, 0], pushK(f, 642, 0.0035, 0.006, 25)), look: [0, -13.2, 0], fov: 38, roll: -0.04 }) },
  ],
  6: [
    { f: 751, s: (f) => ({ pos: dolly([13, 6.5, 17], [0, 3.5, 0], pushK(f, 751, 0.0025)), look: [0, 3.5, 0], fov: 42, roll: 0.07 }) },
    { f: 810, cut: true, s: (f) => ({ pos: dolly([7.5, -17.5, 10], [0, -15.5, 0], pushK(f, 810, 0.003, 0.006, 30)), look: [0, -15.5, 0], fov: 44, roll: -0.05 }) },
  ],
  7: [
    { f: 900, s: (f) => ({ pos: dolly([0, 18, 22], [0, -1, 0], pushK(f, 900, 0.0025)), look: [0, -1, 0], fov: 46, roll: 0.04 }) },
    { f: 1030, dur: 28, s: (f) => ({ pos: dolly([-14, 10, 16], [0, -2, 0], pushK(f, 1030, 0.003)), look: [0, -2, 0], fov: 42, roll: -0.05 }) },
  ],
  8: [
    { f: 1142, s: (f) => ({ pos: dolly([19, 8.5, 22], [0, -1.5, 0], pushK(f, 1142, 0.0028)), look: [0, -1.5, 0], fov: 44, roll: 0.06 }) },
  ],
  9: [
    { f: 1330, s: (f) => ({ pos: dolly([22, 11, 28], [-2, 1.5, -4], pushK(f, 1330, 0.0022)), look: [-2, 1.5, -4], fov: 46, roll: -0.04 }) },
    { f: 1490, dur: 24, s: (f) => ({ pos: dolly([16, 13, 24], [8, 9, -6], pushK(f, 1490, 0.003, 0.006, 25)), look: [8, 9, -6], fov: 48, roll: 0.06 }) },
  ],
  10: [
    { f: 1616, s: (f) => ({ pos: dolly([-10, -14, 15], [-6, -12, 0], pushK(f, 1616, 0.0025)), look: [-6, -12, 0], fov: 42, roll: 0 }) },
    { f: 1700, dur: 24, s: (f) => ({ pos: dolly([-18, 3.8, 16], [-12, 1.8, -4], pushK(f, 1700, 0.0025)), look: [-12, 1.8, -4], fov: 38, roll: 0 }) },
  ],
  11: [
    { f: 1784, s: (f) => ({ pos: dolly([16, 4.5, 20], [0, 0.8, 0], pushK(f, 1784, 0.0022)), look: [0, 0.8, 0], fov: 40, roll: 0 }) },
  ],
};

// Impact flip-shakes on drill jam, ceiling breach, rig swallow, geyser blast
const KICKS: { f: number; a: number; d?: number }[] = [
  { f: 685, a: 0.024, d: 8 },
  { f: 812, a: 0.028, d: 9 },
  { f: 1200, a: 0.022, d: 8 },
  { f: 1495, a: 0.030, d: 10 },
];

export const camAt = (id: number, f: number): Cam => {
  const c = run(CAMS[id], f);
  let kick = 0;
  for (const k of KICKS) {
    const df = f - k.f;
    if (df >= 0 && df < (k.d ?? 8)) kick += k.a * (1 - df / (k.d ?? 8)) * (df % 2 ? -1 : 1);
  }
  return { ...c, roll: c.roll + kick };
};

export type Dof = { cInf: number; focus?: (f: number) => V3 };
const DOF: Record<number, Dof> = {
  1: { cInf: 10 },
  2: { cInf: 7 },
  3: { cInf: 11 },
  4: { cInf: 9 },
  5: { cInf: 14 },
  6: { cInf: 12 },
  7: { cInf: 6 },
  8: { cInf: 5 },
  9: { cInf: 4 },
  10: { cInf: 10 },
  11: { cInf: 8 },
};
export const dofAt = (f: number): Dof => DOF[shotAt(f).id];

export const FOREGROUND: Partial<Record<number, { type: "grass" | "beam"; pos: V3 }[]>> = {
  2: [{ type: "grass", pos: [-13, 0.6, 17] }],
  4: [{ type: "beam", pos: [11, 4.5, 14] }],
  11: [{ type: "grass", pos: [13, 0.6, 15] }],
};
