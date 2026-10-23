/*! Glimmer Vale — OriginKit. Adapted from user-provided component source.
 * OriginKit custom license: https://www.originkit.dev/docs/licensing
 * See NOTICE.md. React wrapper removed; shared clock and reduced geometry/bloom added. */
const DEFAULT_ADVANCED = {
  loopSec: 8,
  waveHeight: 25,
  waveLength: 70,
  crestBright: 100,
  slopeBright: 100,
  pointSize: 100,
  twinkleSharp: 8,
  prismShare: 60,
  crestColor: "#F4F0FF",
  slopeColor: "#8C84C8",
  slopeDeep: "#5A5290",
  hillShadow: "#2A2138",
  glowColor: "#E8E2FF",
  glowStrength: 60,
  hotspotX: 65,
  hotspotStrength: 70,
  skyMid: "#4A5290",
  horizonGlow: "#F6E8E2",
  horizonGlowStrength: 30,
  petalColor: "#F2EEFF",
  petalTip: "#B8B0F0",
  flowerCore: "#E8502A",
  flowerSize: 100,
  flowerBlur: 100,
  fringe: 100,
  sway: 50,
  midCount: 110,
  bokehCount: 90,
  grassCount: 320,
  glintCount: 20,
  glintSize: 100,
  bob: 6,
  seed: 7,
  grain: 12,
  vignette: 15,
  hover: 50
};
const CAM_H = 2.2;
const PITCH = 0.25;
const TAN_V = 0.33;
const TAN_H = 0.5;
const NEAR = 0.3;
const FAR = 220;
const D0 = 1.6;
const D1 = 90;
const RIDGE_PTS = 24e3;
const FIELD_PTS = 16e3;
const MAX_PTS = RIDGE_PTS + FIELD_PTS;
const ROW_DT = 0.05;
const ROWS_FRONT = 34;
const ROWS_BACK = 6;
const MAX_HF = 0;
const PT_D0 = 3;
const PT_D1 = 24;
const MESH_C = 160;
const MESH_R = 100;
const MESH_S = 1.3;
const BLOOM_LEVELS = 4;
const MAX_SPRITES = 4200;
const SPR_STRIDE = 13;
const TAU = Math.PI * 2;
const BIG_DAISIES = [
  [0.08, 0.86, 0.025, 0, 0.65],
  [0.94, 0.8, 0.025, 1, 0.65]
];
const BOKEH_COLORS = ["#FF3A3A", "#4AFF8A", "#6AE8FF", "#FFD060", "#FF7A3A"];
const SPECK_WARM = ["#FFC25A", "#FF8A3A", "#FFB080", "#FFD890"];
const SPECK_COOL = ["#8FF0FF", "#9CFFB8"];
const GLINT_COLORS = ["#7DFFB0", "#7FE8FF", "#FFFFFF", "#FF5A5A", "#FFC060", "#C9A8FF"];
const MID_PETAL = "#D6D0FA";
const MID_RIM = "#B6A8F2";
const MID_CORE = "#F07890";
const GRASS_A = [15 / 255, 42 / 255, 20 / 255];
const GRASS_B = [58 / 255, 124 / 255, 62 / 255];
const CORNERS = [-1, -1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1];
const num = (v, d) => typeof v === "number" && isFinite(v) ? v : d;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const smooth = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
function parseColor(input, fallback = [0, 0, 0]) {
  if (typeof input !== "string") return fallback;
  let s = input.trim();
  const v = s.match(/^var\([^,]+,\s*(.+)\)$/);
  if (v) s = v[1].trim();
  if (s[0] === "#") {
    let h = s.slice(1);
    if (h.length === 3 || h.length === 4) h = h.split("").map((c) => c + c).join("");
    const n = parseInt(h.slice(0, 6), 16);
    if (h.length >= 6 && !isNaN(n)) return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255];
    return fallback;
  }
  const m = s.match(/rgba?\(([^)]+)\)/);
  if (m) {
    const p = m[1].split(/[\s,/]+/).filter(Boolean).map(parseFloat);
    if (p.length >= 3 && !isNaN(p[0]) && !isNaN(p[1]) && !isNaN(p[2])) return [p[0] / 255, p[1] / 255, p[2] / 255];
  }
  return fallback;
}
const mix3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
function mulberry32(a) {
  return () => {
    a |= 0;
    a = a + 1831565813 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
const RN = 32;
const RU0 = -0.35;
const RU1 = 1.35;
const RIDGE_A = [
  [-0.35, 0.272, 7],
  [0, 0.339, 7],
  [0.0625, 0.361, 7],
  [0.125, 0.387, 7],
  [0.1875, 0.417, 7],
  [0.25, 0.444, 7],
  [0.3125, 0.462, 7],
  [0.375, 0.476, 6.8],
  [0.44, 0.49, 6.6],
  [0.5, 0.497, 6.5],
  [0.56, 0.49, 6.6],
  [0.62, 0.468, 7],
  [0.68, 0.432, 7.6],
  [0.75, 0.39, 8.2],
  [0.8125, 0.368, 8.5],
  [0.875, 0.364, 8.5],
  [0.9375, 0.371, 8.5],
  [1, 0.38, 8.5],
  [1.35, 0.4, 8.5]
];
const RIDGE_B = [
  [-0.35, 0.5, 10.5],
  [0, 0.492, 10.5],
  [0.2, 0.482, 11],
  [0.3, 0.466, 12],
  [0.375, 0.452, 13],
  [0.4375, 0.437, 13.6],
  [0.5, 0.416, 14],
  [0.5625, 0.401, 14],
  [0.625, 0.398, 13.8],
  [0.6875, 0.394, 13.4],
  [0.75, 0.4, 13],
  [0.85, 0.41, 12.5],
  [1, 0.42, 12],
  [1.35, 0.44, 12]
];
const FALL_A = [6.5, 3];
const FALL_B = [6.5, 3];
const FLOOR = -1.6;
const SHOULDER = [1.1, 1.2];
const SHOULDER_SWELL = 0.6;
function catmull(pts, col, u) {
  const n = pts.length;
  const x = clamp(u, pts[0][0], pts[n - 1][0]);
  let i = 0;
  while (i < n - 2 && x > pts[i + 1][0]) i++;
  const p0 = pts[Math.max(i - 1, 0)][col], p1 = pts[i][col], p2 = pts[i + 1][col], p3 = pts[Math.min(i + 2, n - 1)][col];
  const t = (x - pts[i][0]) / (pts[i + 1][0] - pts[i][0]);
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t);
}
function buildRidges() {
  const c = Math.cos(PITCH), s = Math.sin(PITCH);
  const out = new Float32Array(RN * 4);
  for (let i = 0; i < RN; i++) {
    const u = RU0 + (RU1 - RU0) * i / (RN - 1);
    [RIDGE_A, RIDGE_B].forEach((r, j) => {
      const y = catmull(r, 1, u);
      const z = catmull(r, 2, u);
      const k = (1 - 2 * y) * TAN_V;
      out[i * 4 + j * 2] = CAM_H + z * (k * c - s) / (c + k * s);
      out[i * 4 + j * 2 + 1] = z;
    });
  }
  return out;
}
const RIDGES = buildRidges();
const TERRAIN_GLSL = `
uniform vec4 u_cam;   // camX, camY, cos pitch, sin pitch
uniform vec4 u_proj;  // tanH, tanV, A, B
uniform vec4 u_wave;  // 1/scale, amp, k, phase
uniform vec4 u_r[${RN}];
vec4 cr(vec4 p0, vec4 p1, vec4 p2, vec4 p3, float t){
  return 0.5 * (2.0 * p1 + (-p0 + p2) * t + (2.0 * p0 - 5.0 * p1 + 4.0 * p2 - p3) * t * t + (-p0 + 3.0 * p1 - 3.0 * p2 + p3) * t * t * t);
}
vec4 ridgeAt(float u){
  float f = clamp((u - ${RU0.toFixed(3)}) / ${(RU1 - RU0).toFixed(3)}, 0.0, 1.0) * ${(RN - 1).toFixed(1)};
  int i = int(min(floor(f), ${(RN - 2).toFixed(1)}));
  float t = f - float(i);
  return cr(u_r[max(i - 1, 0)], u_r[i], u_r[i + 1], u_r[min(i + 2, ${RN - 1})], t);
}
float dome(float t, float wf, float wb){
  if (t < 0.0) { float f = clamp(-t / wf, 0.0, 1.0); float g = 1.0 - f * f; return g * g; }
  float f = clamp(t / wb, 0.0, 1.0);
  return 1.0 - f * f * (3.0 - 2.0 * f);
}
float smax(float a, float b, float k){
  float h = max(k - abs(a - b), 0.0) / k;
  return max(a, b) + h * h * k * 0.25;
}
float shoulderA(float u){
  float k = (u - 0.47) / 0.17;
  return ${SHOULDER[0].toFixed(2)} + ${SHOULDER_SWELL.toFixed(2)} * (exp(-k * k) + smoothstep(0.65, 0.85, u));
}
float ridgeLit(vec4 r, float which){
  return which < 0.5 ? smoothstep(1.35, 2.05, r.x - ${FLOOR.toFixed(2)}) : smoothstep(0.4, 1.2, r.z - ${FLOOR.toFixed(2)});
}
// crest: 1 on the top of whichever ridge is the surface here, falling to 0
// down its face. The glitter is lit by it.
float baseH(float x, float d, out float crest, out float owner){
  float u = 0.5 + (x / (${TAN_H.toFixed(3)} * max(d, 0.5))) * 0.5;
  vec4 r = ridgeAt(0.5 + (u - 0.5) * u_wave.x);
  float ca = dome(d - r.y, ${FALL_A[0].toFixed(2)}, ${FALL_A[1].toFixed(2)});
  float cb = dome(d - r.w, ${FALL_B[0].toFixed(2)}, ${FALL_B[1].toFixed(2)});
  float a = (r.x - ${FLOOR.toFixed(2)}) * ca;
  float b = (r.z - ${FLOOR.toFixed(2)}) * cb;
  // the lit shoulder is a narrow strip either side of the crest line
  float ta = d - r.y, tb = d - r.w;
  float sa = 1.0 - smoothstep(0.0, ta < 0.0 ? shoulderA(0.5 + (u - 0.5) * u_wave.x) : ${FALL_A[1].toFixed(2)}, abs(ta));
  float sb = 1.0 - smoothstep(0.0, tb < 0.0 ? ${SHOULDER[1].toFixed(2)} : ${FALL_B[1].toFixed(2)}, abs(tb));
  owner = a > b ? 0.0 : 1.0;
  // the near ridge's ribbon fades out as it sinks into the valley
  crest = a > b ? sa * ridgeLit(r, 0.0) : sb * ridgeLit(r, 1.0);
  // past the far ridge the sheet ends: drop it out of sight
  float cliff = smoothstep(r.w + ${FALL_B[1].toFixed(2)}, r.w + ${(FALL_B[1] + 4).toFixed(2)}, d);
  return ${FLOOR.toFixed(2)} + smax(a, b, 0.35) - cliff * 40.0;
}
float sheetEnd(float x, float d){
  float u = 0.5 + (x / (${TAN_H.toFixed(3)} * max(d, 0.5))) * 0.5;
  vec4 r = ridgeAt(0.5 + (u - 0.5) * u_wave.x);
  return step(r.w + ${FALL_B[1].toFixed(2)}, d);
}
float terrH(float x, float d, out float crest, out float owner){
  float e = smoothstep(3.0, 8.0, d);
  float a = u_wave.z * (x + 0.35 * d);
  float w = sin(a - u_wave.w) - sin(a)
          + 0.6 * (sin(1.86 * a + 2.0 * u_wave.w + 1.3) - sin(1.86 * a + 1.3));
  return baseH(x, d, crest, owner) + u_wave.y * e * w;
}
float terrH(float x, float d){ float c, o; return terrH(x, d, c, o); }
vec3 viewOf(vec3 P){
  vec3 r = P - vec3(u_cam.x, u_cam.y, 0.0);
  float depth = -r.y * u_cam.w - r.z * u_cam.z;
  float yv = r.y * u_cam.z - r.z * u_cam.w;
  return vec3(r.x, yv, depth);
}
vec4 clipOf(vec3 v){
  return vec4(v.x / u_proj.x, v.y / u_proj.y, u_proj.z * v.z + u_proj.w, v.z);
}
vec3 normalAt(float x, float d){
  float e = 0.05;
  float hx = (terrH(x + e, d) - terrH(x - e, d)) / (2.0 * e);
  float hd = (terrH(x, d + e) - terrH(x, d - e)) / (2.0 * e);
  return normalize(vec3(-hx, 1.0, hd));
}`;
function ridgeAt(u, out) {
  const f = clamp((u - RU0) / (RU1 - RU0), 0, 1) * (RN - 1);
  const i = Math.min(Math.floor(f), RN - 2);
  const t = f - i;
  const i0 = Math.max(i - 1, 0), i3 = Math.min(i + 2, RN - 1);
  for (let q = 0; q < 4; q++) {
    const p0 = RIDGES[i0 * 4 + q], p1 = RIDGES[i * 4 + q], p2 = RIDGES[(i + 1) * 4 + q], p3 = RIDGES[i3 * 4 + q];
    out[q] = 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t);
  }
  return out;
}
const dome = (t, wf, wb) => {
  if (t < 0) {
    const f2 = clamp(-t / wf, 0, 1);
    const g = 1 - f2 * f2;
    return g * g;
  }
  const f = clamp(t / wb, 0, 1);
  return 1 - f * f * (3 - 2 * f);
};
const smax = (a, b, k) => {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.max(a, b) + h * h * k * 0.25;
};
const R4 = [0, 0, 0, 0];
function baseH(x, d, w) {
  const u = 0.5 + x / (TAN_H * Math.max(d, 0.5)) * 0.5;
  const r = ridgeAt(0.5 + (u - 0.5) * w.si, R4);
  const a = (r[0] - FLOOR) * dome(d - r[1], FALL_A[0], FALL_A[1]);
  const b = (r[2] - FLOOR) * dome(d - r[3], FALL_B[0], FALL_B[1]);
  const cliff = smooth(r[3] + FALL_B[1], r[3] + FALL_B[1] + 4, d);
  return FLOOR + smax(a, b, 0.35) - cliff * 40;
}
function terrH(x, d, w) {
  const e = smooth(3, 8, d);
  const a = w.k * (x + 0.35 * d);
  const wv = Math.sin(a - w.ph) - Math.sin(a) + 0.6 * (Math.sin(1.86 * a + 2 * w.ph + 1.3) - Math.sin(1.86 * a + 1.3));
  return baseH(x, d, w) + w.amp * e * wv;
}
function crestYAt(fx, w, camX, camY, c, s) {
  const ndcX = fx * 2 - 1;
  let best = -Infinity;
  for (let d = 3; d < 70; d += 0.2) {
    const x = camX + ndcX * TAN_H * d;
    const ry = terrH(x, d, w) - camY;
    const depth = -ry * s + d * c;
    const yv = ry * c + d * s;
    const ny = yv / depth / TAN_V;
    if (ny > best) best = ny;
  }
  return 0.5 - best * 0.5;
}
function buildPoints(seed) {
  const rnd = mulberry32(seed * 9973 + 1);
  const d = new Float32Array(MAX_PTS * 4);
  let i = 0;
  const put = (a, b, c, e) => {
    const o = i++ * 4;
    d[o] = a;
    d[o + 1] = b;
    d[o + 2] = c;
    d[o + 3] = e;
  };
  const rows = ROWS_FRONT + ROWS_BACK + 1;
  const share = [0.4, 0.6];
  for (let ridge = 0; ridge < 2; ridge++) {
    const per = Math.floor(RIDGE_PTS * share[ridge] / rows);
    for (let k = -ROWS_FRONT; k <= ROWS_BACK; k++) {
      const off = rnd();
      for (let n = 0; n < per; n++) {
        put(-0.32 + 1.64 * (n + off + (rnd() - 0.5) * 0.5) / per, (k + (rnd() - 0.5) * 0.22) * ROW_DT, rnd(), ridge);
      }
    }
  }
  while (i < MAX_PTS) {
    const z = PT_D0 + (PT_D1 - PT_D0) * Math.sqrt(rnd());
    put((rnd() * 2 - 1) * z * TAN_H * 1.25, z, rnd(), 2);
  }
  for (let a = MAX_PTS - 1; a > 0; a--) {
    const b = Math.floor(rnd() * (a + 1));
    for (let q = 0; q < 4; q++) {
      const t = d[a * 4 + q];
      d[a * 4 + q] = d[b * 4 + q];
      d[b * 4 + q] = t;
    }
  }
  return d;
}
function buildHillFlowers(seed) {
  const rnd = mulberry32(seed * 6151 + 5);
  const d = new Float32Array(MAX_HF * 4);
  const streaks = [];
  for (let i = 0; i < 160; i++) {
    const z = 3.5 + (30 - 3.5) * Math.sqrt(rnd());
    streaks.push([(rnd() * 2 - 1) * z * TAN_H * 1.2, z, 0.6 + 2.2 * rnd(), (rnd() - 0.5) * 0.5]);
  }
  for (let i = 0; i < MAX_HF; i++) {
    let x, z;
    if (rnd() < 0.65) {
      const s = streaks[Math.floor(rnd() * streaks.length)];
      const t = (rnd() - 0.5) * s[2];
      x = s[0] + t + (rnd() - 0.5) * 0.25;
      z = s[1] + t * s[3] + (rnd() - 0.5) * 0.25;
    } else {
      z = 3.5 + (34 - 3.5) * Math.sqrt(rnd());
      x = (rnd() * 2 - 1) * z * TAN_H * 1.25;
    }
    const o = i * 4;
    d[o] = x;
    d[o + 1] = z;
    d[o + 2] = rnd();
    d[o + 3] = rnd();
  }
  return d;
}
function buildMesh() {
  const v = new Float32Array((MESH_C + 1) * (MESH_R + 1) * 2);
  let o = 0;
  for (let j = 0; j <= MESH_R; j++) {
    const d = D0 * Math.pow(D1 / D0, j / MESH_R);
    for (let i = 0; i <= MESH_C; i++) {
      v[o++] = i / MESH_C * 2 - 1;
      v[o++] = d;
    }
  }
  const idx = new Uint32Array(MESH_C * MESH_R * 6);
  o = 0;
  for (let j = 0; j < MESH_R; j++) {
    for (let i = 0; i < MESH_C; i++) {
      const a = j * (MESH_C + 1) + i;
      const b = a + 1;
      const c = a + MESH_C + 1;
      const e = c + 1;
      idx[o++] = a;
      idx[o++] = c;
      idx[o++] = b;
      idx[o++] = b;
      idx[o++] = c;
      idx[o++] = e;
    }
  }
  return { v, idx };
}
const item = (p) => ({
  kind: 0,
  x: 0,
  y: 0,
  d: 0,
  key: 0,
  f: 0,
  tilt: 1,
  rot: 0,
  n: 0,
  blur: 0,
  ph: 0,
  tint: [1, 1, 1],
  col: [1, 1, 1],
  alpha: 1,
  h: 0,
  w: 0,
  ang: 0,
  near: 0,
  ox: 0,
  oy: 0,
  ...p
});
function buildMeadow(seed, mid, bokeh, grass) {
  const rnd = mulberry32(seed * 7919 + 13);
  const items = [];
  for (const [x, y, d, warm, light] of BIG_DAISIES) {
    const tilt = 0.6 + 0.22 * rnd();
    const rot = rnd() * TAU;
    const ph = (rnd() - 0.5) * 0.9;
    items.push(item({
      kind: 0,
      x,
      y,
      d: d * 1.3,
      key: y + 0.08,
      tilt,
      rot,
      n: 11 + Math.floor(rnd() * 5),
      blur: 0.04 + d * 1.3,
      ph,
      tint: warm ? [1, 0.9, 0.74] : [light * light, light * (0.4 + 0.6 * light), light * (0.6 + 0.4 * light)]
    }));
    const specks = light < 0.7 ? 0 : 3 + Math.floor(rnd() * 4);
    for (let k = 0; k < specks; k++) {
      const cool = rnd() < 0.2;
      const a = cool ? -0.2 + (rnd() - 0.5) * 1.2 : -Math.PI / 2 - 0.5 + (rnd() - 0.5) * 1.8;
      const rr = 0.56 + 0.18 * rnd();
      const pal = cool ? SPECK_COOL : SPECK_WARM;
      items.push(item({
        kind: 5,
        x,
        y,
        d: d * 1.3,
        key: y + 0.081,
        ph,
        ox: Math.cos(a) * rr,
        oy: Math.sin(a) * rr * tilt,
        w: 0.04 + 0.045 * rnd(),
        col: parseColor(pal[Math.floor(rnd() * pal.length)]),
        alpha: 0.55 + 0.55 * rnd()
      }));
    }
  }
  const pushBokeh = (x, y, d, col, alpha) => items.push(item({ kind: 2, x, y, d, col, alpha, ph: rnd() * TAU, key: y }));
  const drifts = [];
  for (let i = 0; i < 12; i++) drifts.push([rnd(), 0.56 + 0.15 * rnd()]);
  for (let i = 0; i < 8; i++) {
    const x = 0.22 + 0.07 * i;
    drifts.push([x, 0.675 + 0.02 * Math.sin(x * 9)]);
  }
  for (let i = 0; i < mid; i++) {
    let x, y;
    if (rnd() < 0.7) {
      const c = drifts[Math.floor(rnd() * drifts.length)];
      x = c[0] + (rnd() - 0.5) * 0.16;
      y = c[1] + (rnd() - 0.5) * 0.035;
    } else {
      x = -0.03 + 1.06 * rnd();
      y = 0.54 + 0.24 * rnd();
    }
    const f = clamp((y - 0.53) / 0.27, 0, 1);
    const br = 0.62 + 0.45 * f;
    const warm = rnd() < 0.2;
    const d = (0.018 + 0.045 * f) * (0.7 + 0.6 * rnd());
    items.push(item({
      kind: 1,
      x,
      y,
      f,
      key: y,
      d,
      tilt: 0.42 + 0.3 * rnd(),
      rot: rnd() * TAU,
      n: 10 + Math.floor(rnd() * 5),
      blur: 0.06 + 0.07 * f + 0.04 * rnd(),
      ph: rnd() * TAU,
      tint: warm ? [br, br * 0.88, br * 0.78] : [br * 0.86, br * 0.9, br],
      alpha: 0.65 + 0.35 * f
    }));
    if (bokeh > 0 && rnd() < 0.7) {
      const g = parseColor(GLINT_COLORS[Math.floor(rnd() * GLINT_COLORS.length)]);
      pushBokeh(x + (rnd() - 0.5) * d * 0.6, y - d * 0.25, d * (0.14 + 0.12 * rnd()), g, 1.1 + 0.9 * rnd());
    }
  }
  for (let i = 0; i < bokeh; i++) {
    const y = rnd() < 0.7 ? 0.6 + 0.16 * rnd() : 0.55 + 0.42 * Math.pow(rnd(), 1.3);
    pushBokeh(rnd(), y, 4e-3 + 0.012 * rnd() * rnd(), parseColor(BOKEH_COLORS[Math.floor(rnd() * 5)]), 0.7 + 0.9 * rnd());
  }
  for (let i = 0; i < bokeh * 4; i++) {
    const y = 0.6 + 0.2 * Math.pow(rnd(), 1.6);
    const hue = rnd();
    const col = [0, 0.33, 0.67].map((o) => 0.55 + 0.45 * Math.cos(TAU * (hue + o)));
    pushBokeh(rnd(), y, 4e-3 + 5e-3 * rnd() * (y - 0.55) * 8, col, 0.9 + 1.3 * rnd());
  }
  if (bokeh > 0) {
    pushBokeh(0.054, 0.847, 0.016, parseColor("#FF3A3A"), 0.9);
    pushBokeh(0.246, 0.88, 0.014, parseColor("#FF3A3A"), 0.8);
  }
  for (let i = 0; i < grass; i++) {
    const y = rnd() < 0.6 ? 0.58 + 0.2 * rnd() : 0.54 + 0.48 * Math.pow(rnd(), 0.8);
    const f = clamp((y - 0.54) / 0.48, 0, 1);
    const h = (0.018 + 0.075 * f) * (0.6 + 0.8 * rnd());
    const m = rnd();
    items.push(item({
      kind: 3,
      x: rnd(),
      y,
      f,
      key: y,
      h,
      w: h * (0.07 + 0.06 * rnd()),
      ang: (rnd() - 0.5) * 0.7,
      ph: rnd() * TAU,
      col: mix3(GRASS_A, GRASS_B, m * (1 - 0.85 * f)),
      alpha: 0.85 * (1 - 0.8 * f)
    }));
  }
  // Replace the former foreground flower field with small, softly twinkling glints.
  for (let i = 0; i < 1400; i++) {
    const x = rnd(), y = 0.52 + 0.46 * rnd();
    items.push(item({
      kind: 6, x, y, key: y, ph: rnd() * TAU,
      d: 0.002 + 0.005 * rnd() ** 3,
      alpha: (0.55 + 0.5 * rnd()) * (x > 0.35 && x < 0.65 ? 0.65 : 1),
      col: mix3(parseColor(GLINT_COLORS[Math.floor(rnd() * GLINT_COLORS.length)]), [1, 1, 1], 0.55)
    }));
  }
  items.sort((a, b) => a.key - b.key);
  return items;
}
const packTilt = (tilt, alpha) => Math.floor(clamp(tilt, 0.05, 1) * 100) + clamp(alpha, 0, 1) * 0.999;
const grow = (bl) => clamp(0.85 + bl * 1.1, 1, 1.9);
function pushSprite(b, i, W, H, cx, cy, hx, hy, ang, type, q0, q1, q2, q3, r, g, bl, a) {
  if (i >= MAX_SPRITES) return i;
  const c = Math.cos(ang), s = Math.sin(ang);
  let o = i * 6 * SPR_STRIDE;
  for (let k = 0; k < 6; k++) {
    const lx = CORNERS[k * 2], ly = CORNERS[k * 2 + 1];
    b[o++] = (cx + lx * hx * c - ly * hy * s) / W;
    b[o++] = (cy + lx * hx * s + ly * hy * c) / H;
    b[o++] = lx;
    b[o++] = ly;
    b[o++] = type;
    b[o++] = q0;
    b[o++] = q1;
    b[o++] = q2;
    b[o++] = q3;
    b[o++] = r;
    b[o++] = g;
    b[o++] = bl;
    b[o++] = a;
  }
  return i + 1;
}
const FS_VS = `#version 300 es
in vec2 a_p;
out vec2 v_uv;
void main(){ v_uv = a_p * 0.5 + 0.5; gl_Position = vec4(a_p, 0.0, 1.0); }`;
const SKY_FS = `#version 300 es
precision highp float;
uniform vec2 u_res;
uniform vec3 u_top, u_mid, u_hor, u_gc;
uniform vec4 u_g;
out vec4 o;
void main(){
  vec2 f = gl_FragCoord.xy / max(u_res, vec2(1.0));
  float y = 1.0 - f.y;
  vec3 c = mix(u_top, u_mid, smoothstep(0.0, 0.22, y));
  c = mix(c, u_hor, smoothstep(0.14, 0.36, y));

  float side = clamp(0.65 + (f.x - u_g.x), 0.0, 1.3) * (1.0 - 0.4 * smoothstep(0.1, 0.36, y));
  c *= mix(vec3(1.0), vec3(1.55, 1.6, 1.22), side);
  vec2 d = vec2((f.x - u_g.x) * u_g.w, (y - u_g.y) * 1.8);
  c += u_gc * u_g.z * exp(-dot(d, d) / 0.05) * 0.35;
  o = vec4(c, 1.0);
}`;
const TERRAIN_VS = `#version 300 es
precision highp float;
in vec2 a_m;
${TERRAIN_GLSL}
uniform vec4 u_fog;
uniform vec3 u_shadow, u_ground, u_rim, u_sky, u_sheen;
out vec3 v_col;
void main(){
  float d = a_m.y;
  float x = u_cam.x + a_m.x * ${MESH_S.toFixed(2)} * d * u_proj.x;
  float crest, owner;
  float H = terrH(x, d, crest, owner);
  vec3 P = vec3(x, H, -d);
  vec3 v = viewOf(P);
  gl_Position = clipOf(v);
  vec3 N = normalAt(x, d);
  vec3 V = normalize(vec3(u_cam.x, u_cam.y, 0.0) - P);
  float facing = clamp(dot(N, V), 0.0, 1.0);

  vec3 c = mix(u_shadow * 1.15 + u_rim * 0.06, u_shadow * 0.72, smoothstep(0.02, 0.3, facing));
  c = mix(u_ground, c, smoothstep(3.0, 6.5, d));

  c += u_sheen * pow(crest, 1.6);

  float sy = 0.5 - 0.5 * gl_Position.y / gl_Position.w;
  c = mix(c, u_ground, smoothstep(0.58, 0.8, sy) * 0.92);
  float fog = 1.0 - exp(-max(d - 8.0, 0.0) / u_fog.w);
  c = mix(c, u_fog.rgb, fog);

  v_col = mix(c, u_sky, smoothstep(18.0, 40.0, d));
}`;
const TERRAIN_FS = `#version 300 es
precision highp float;
in vec3 v_col;
out vec4 o;
void main(){ o = vec4(v_col, 1.0); }`;
const GLITTER_VS = `#version 300 es
precision highp float;
in vec4 a_d;
${TERRAIN_GLSL}
uniform vec4 u_px;
uniform vec4 u_light;
uniform vec4 u_tw;
uniform vec4 u_hot;
uniform vec4 u_sun;
uniform vec4 u_fog;
uniform vec3 u_crest, u_slope, u_deep;
out vec3 v_col;
out float v_kind;
out float v_soft;
float h(float n){ return fract(sin(n) * 43758.5453123); }

vec3 film(float t){ return 0.5 + 0.5 * cos(6.2831853 * (t + vec3(0.0, 0.33, 0.67))); }
void main(){
  float x = a_d.x, d = a_d.y, s = a_d.z;
  bool row = a_d.w < 1.5;
  float prof = 0.0;
  float sh = a_d.w < 0.5 ? shoulderA(a_d.x) : ${SHOULDER[1].toFixed(2)};
  if (row) {
    vec4 r = ridgeAt(a_d.x);
    d = (a_d.w < 0.5 ? r.y : r.w) + a_d.y;
    x = (a_d.x - 0.5) / u_wave.x * 2.0 * ${TAN_H.toFixed(3)} * d;

    float t = a_d.y;
    prof = t < 0.0 ? exp(-pow(-t / sh, 4.0)) : 0.55 * exp(-pow(t / 0.35, 2.0));
    prof *= 0.55 + 0.45 * h(floor(t / ${ROW_DT.toFixed(3)} + 0.5) * 7.31 + a_d.w * 3.7);

    prof *= clamp(d / 7.0, 1.0, 1.45) * ridgeLit(r, a_d.w);
  }
  float crest, owner;
  float H = terrH(x, d, crest, owner);
  vec3 P = vec3(x, H + 0.03, -d);
  vec3 v = viewOf(P);
  gl_Position = clipOf(v);
  vec3 N = normalAt(x, d);
  vec3 V = normalize(vec3(u_cam.x, u_cam.y, 0.0) - P);
  float facing = dot(N, V);
  float graze = 1.0 - clamp(facing, 0.0, 1.0);
  float h1 = h(s * 91.7 + 1.3), h2 = h(s * 47.3 + 7.1), h3 = h(s * 13.9 + 3.7);
  float h4 = h(s * 71.1 + 5.3), h5 = h(s * 29.3 + 9.9), h6 = h(s * 53.7 + 2.2);

  float rim = smoothstep(0.42, 0.03, facing);
  float back = clamp(dot(N, u_sun.xyz) * 0.5 + 0.6, 0.0, 1.0);
  float hills = smoothstep(2.5, 7.0, d);

  float top = row ? prof * prof * prof * 8.0 * (0.3 + 2.4 * h2 * h2 * h2) : crest * crest * 0.2;
  float I = u_light.x * (top + 0.06 * rim * rim) * back * (0.3 + 0.7 * hills)
          + u_light.y * (0.01 + 0.07 * pow(h2, 4.0)) * (0.35 + 0.65 * hills);
  rim = max(rim, top);
  vec2 ndc = gl_Position.xy / gl_Position.w;
  vec2 dh = (ndc - u_hot.xy) * vec2(3.4, 8.0);
  I *= 1.0 + u_hot.z * 1.6 * exp(-dot(dh, dh)) * (0.3 + rim);

  float ph = 6.2831853 * (u_tw.w / u_tw.x + h5);
  float fl = pow(0.5 + 0.5 * sin(ph), u_light.w);
  I *= 0.6 + u_light.z * fl;

  float bpos = row ? clamp(-a_d.y / sh, -0.4, 1.6) : 1.0 + h3;
  float hue = 0.8 + bpos * 0.2 + (h1 - 0.5) * 0.22 + (h5 < 0.22 ? 0.48 : 0.0);
  vec3 iri = mix(film(hue + 0.03 * sin(ph)), vec3(1.0), 0.16);
  vec3 col = mix(u_crest, mix(u_slope, u_deep, h3), smoothstep(0.25, 0.0, rim) * 0.85);

  col = h4 < u_tw.y ? iri : mix(col, iri, 0.55);
  if (h4 < u_tw.y) I = min(I, 1.6);
  float fog = 1.0 - exp(-max(d - 8.0, 0.0) / u_fog.w);
  col = mix(col, u_fog.rgb * 1.6, fog * 0.5);
  I *= 1.0 - 0.35 * fog;

  float px = u_px.y * u_px.x / (max(v.z, 0.1) * u_proj.y) * (0.7 + 0.6 * h1);
  float blur = smoothstep(4.5, 2.0, d);
  px *= 1.0 + 1.5 * blur;
  v_soft = blur;
  float sz = clamp(px, u_px.w, u_px.z);
  I *= min(1.0, (px * px) / (sz * sz)) / (1.0 + 3.0 * blur);

  I *= 1.0 - smoothstep(0.6, 0.8, 0.5 - 0.5 * ndc.y);
  v_kind = 0.0;
  if (h6 < u_tw.z) {
    float cyc = fract(u_tw.w / u_sun.w + h3);
    float a = pow(sin(3.14159265 * cyc), 3.0);
    float lit = smoothstep(0.25, 0.6, rim) * (1.0 - fog);
    v_kind = 1.0;
    I = a * lit * 2.2;
    sz = clamp(u_px.x * 0.05 * u_hot.w * (0.6 + 0.4 * h2) * a, 0.0, u_px.z);
    if (lit * a < 0.02) sz = 0.0;
    col = mix(u_crest, vec3(1.0), 0.5);
  }
  v_col = col * I;

  bool hide = sheetEnd(x, d) > 0.5 || d < 1.0 || (row && abs(owner - a_d.w) > 0.5);
  gl_PointSize = hide ? 0.0 : sz;
}`;
const GLITTER_FS = `#version 300 es
precision highp float;
in vec3 v_col;
in float v_kind;
in float v_soft;
out vec4 o;
void main(){
  vec2 q = gl_PointCoord * 2.0 - 1.0;
  float d = dot(q, q);
  if (v_kind > 0.5) {
    float r = sqrt(d);
    float rays = exp(-abs(q.y) * 28.0) * max(1.0 - abs(q.x), 0.0)
               + exp(-abs(q.x) * 28.0) * max(1.0 - abs(q.y), 0.0);
    float core = exp(-d * 30.0);
    o = vec4(v_col * (core * 1.5 + rays * 0.8 + exp(-r * 6.0) * 0.15), 0.0);
    return;
  }
  if (d > 1.0) discard;
  float core = exp(-d * 6.0);
  float disc = 1.0 - smoothstep(0.55, 1.0, d);
  float rimB = smoothstep(0.35, 0.9, d) * disc;
  float val = mix(core * 0.9 + disc * 0.3, disc * 0.55 + rimB * 0.45, v_soft);
  o = vec4(v_col * val, 0.0);
}`;
const FLOWER_VS = `#version 300 es
precision highp float;
in vec4 a_d;
${TERRAIN_GLSL}
uniform vec4 u_px;
uniform vec4 u_fog;
uniform vec3 u_petal, u_tip, u_core, u_deep;
out vec3 v_col;
out vec3 v_rim;
out vec3 v_core;
out float v_asp;
out float v_a;
out float v_seed;
void main(){
  float x = a_d.x, d = a_d.y;
  v_seed = fract(a_d.z * 7.13 + a_d.w * 3.71);
  float H = terrH(x, d);
  vec3 P = vec3(x, H + 0.05, -d);
  vec3 v = viewOf(P);
  gl_Position = clipOf(v);
  vec3 N = normalAt(x, d);
  vec3 V = normalize(vec3(u_cam.x, u_cam.y, 0.0) - P);
  float facing = clamp(dot(N, V), 0.0, 1.0);

  v_asp = clamp(facing * 0.75, 0.25, 0.5);
  float px = u_px.y * u_px.x * 0.075 / (max(v.z, 0.1) * u_proj.y) * (0.6 + 0.8 * a_d.z);
  float sz = clamp(px, 0.0, u_px.z);
  float fog = 1.0 - exp(-max(d - 8.0, 0.0) / u_fog.w);
  float hills = smoothstep(3.0, 7.0, d);

  vec3 c = mix(u_deep, u_petal, a_d.w * a_d.w) * (0.6 + 0.4 * (1.0 - facing));
  v_col = mix(c, u_fog.rgb * 0.8, fog);
  v_rim = u_tip * 0.5 * (1.0 - fog);
  v_core = u_core * 0.25 * (1.0 - fog);
  v_a = hills * (1.0 - fog * 0.9) * min(1.0, px / 2.0);
  gl_PointSize = sz < 1.5 || sheetEnd(x, d) > 0.5 ? 0.0 : sz;
}`;
const FLOWER_FS = `#version 300 es
precision highp float;
in vec3 v_col;
in vec3 v_rim;
in vec3 v_core;
in float v_asp;
in float v_a;
in float v_seed;
out vec4 o;
float hsh(float n){ return fract(sin(n) * 43758.5453123); }
void main(){
  vec2 q = gl_PointCoord * 2.0 - 1.0;
  q.y /= v_asp;
  float r = length(q);
  if (r > 1.0) discard;

  float a = atan(q.y, q.x) + v_seed * 6.2831853;
  float lobe = 0.74 + 0.26 * pow(abs(cos(a * 4.5)), 0.6);
  float m = 1.0 - smoothstep(lobe * 0.78, lobe, r);
  float centre = 1.0 - smoothstep(0.16, 0.3, r);
  if (m < 0.01) discard;

  float top = smoothstep(0.0, -0.9, q.y * v_asp) * smoothstep(0.25, 0.9, r);
  vec3 c = v_col * (0.8 + 0.3 * r) + v_rim * top;
  c = mix(c, v_core * 2.4, centre);

  if (v_seed < 0.4) {
    vec2 g = vec2(hsh(v_seed * 91.0) - 0.5, hsh(v_seed * 47.0) - 0.7) * 1.2;
    float s = exp(-dot(q - g, q - g) * 30.0);
    vec3 hue = 0.5 + 0.5 * cos(6.2831853 * (hsh(v_seed * 13.0) + vec3(0.0, 0.33, 0.67)));
    c += mix(hue, vec3(1.0), 0.35) * s * 1.6;
  }
  float al = m * v_a;
  o = vec4(c * al, al * 0.9);
}`;
const SPRITE_VS = `#version 300 es
in vec2 a_p;
in vec2 a_uv;
in float a_type;
in vec4 a_q;
in vec4 a_c;
out vec2 v_uv;
out float v_type;
out vec4 v_q;
out vec4 v_c;
out vec2 v_scr;
void main(){
  v_uv = a_uv; v_type = a_type; v_q = a_q; v_c = a_c; v_scr = a_p;
  gl_Position = vec4(a_p.x * 2.0 - 1.0, 1.0 - a_p.y * 2.0, 0.0, 1.0);
}`;
const SPRITE_FS = `#version 300 es
precision highp float;
in vec2 v_uv;
in float v_type;
in vec4 v_q;
in vec4 v_c;
in vec2 v_scr;
uniform vec3 u_petal, u_tip, u_core, u_mpetal, u_mrim, u_mcore;
uniform float u_fringe;
out vec4 o;
float hsh(float n){ return fract(sin(n) * 43758.5453123); }

vec4 petals(vec2 p, float n, float rot, float bl, float cup, float seed){
  vec2 q = p - vec2(0.0, 0.17 * cup);
  float r = length(q);
  float u = (atan(q.y, q.x) + rot) / (6.2831853 / n);
  float k0 = floor(u + 0.5);

  float clear = 1.0;
  vec4 acc = vec4(0.0);
  for (int j = -1; j <= 1; j++) {
    float k = k0 + float(j);
    float mk = mod(k, n);
    float h1 = hsh(mk * 7.31 + seed), h2 = hsh(mk * 3.17 + seed * 1.7), h3 = hsh(mk * 5.03 + seed * 2.3);
    float da = (u - k + (h2 - 0.5) * 0.3) * (6.2831853 / n);
    float th = k * (6.2831853 / n) - rot;
    float s = sin(th);
    float len = 0.8 * (0.84 + 0.2 * h1) * (1.0 + 0.32 * cup * max(-s, 0.0)) * (1.0 - 0.3 * cup * max(s, 0.0));
    float along = r * cos(da), across = r * sin(da);

    float A = len * 0.5, B = len * (0.23 + 0.05 * h3);

    float e = length(vec2((along - len * 0.5) / A, across / (B * (0.8 + 0.2 * smoothstep(0.0, 0.4, along / len)))));
    float dist = (e - 1.0) * B;
    float m = 1.0 - smoothstep(-bl, bl, dist);
    clear *= 1.0 - m;

    float edge = 1.0 - 0.22 * smoothstep(0.6, 1.0, abs(across / B)) * smoothstep(0.15, 0.4, along / len);
    acc += vec4(1.0, clamp(along / len, 0.0, 1.0), clamp(across / B, -1.0, 1.0), (0.86 + 0.2 * h3) * edge) * m;
  }
  float cover = 1.0 - clear;

  float layered = 1.0 + 0.18 * clamp(acc.x - cover, 0.0, 1.0);
  vec4 res = vec4(cover, acc.yzw / max(acc.x, 1e-4));
  res.w *= layered;
  return res;
}
float petalMask(vec2 p, float n, float rot, float bl, float cup, float seed){
  return petals(p, n, rot, bl, cup, seed).x;
}
void main(){
  vec2 p = v_uv;
  float r = length(p);
  float t = v_type;
  if (t < 0.5) {
    float bl = max(v_q.x, 0.012);
    float n = floor(v_q.y), rot = v_q.z;
    float cup = 1.0 - floor(v_q.w) / 100.0;
    float w = fract(v_q.w) / 0.999;
    float seed = rot * 13.7;
    p *= 1.0 + fract(v_q.y) * 2.0;
    r = length(p);
    bool big = v_c.a < 0.5;
    vec3 base = big ? u_petal : u_mpetal;
    vec3 tip = big ? u_tip : u_mrim;
    vec3 cc = big ? u_core : u_mcore;

    vec4 pt = petals(p, n, rot, bl, cup, seed);

    vec2 dir = v_scr - 0.5;
    vec2 off = dir / max(length(dir), 0.05) * u_fringe * (0.01 + bl * 0.08) * min(length(dir) * 2.5, 1.0);
    float k = u_fringe * (0.015 + bl * 0.12);
    float mR = petalMask((p - off) / (1.0 + k), n, rot, bl, cup, seed);
    float mB = petalMask((p + off * 0.5) / (1.0 + k * 0.8), n, rot, bl, cup, seed);
    float mG = pt.x;

    float a = pt.y, x = pt.z;
    float sharp = 1.0 - smoothstep(0.02, 0.14, bl);
    vec2 q = p - vec2(0.0, 0.17 * cup);
    vec3 pet = mix(base, tip * vec3(0.88, 0.94, 1.12), 0.35 + 0.55 * smoothstep(0.3, 1.0, a));

    pet = mix(pet, mix(vec3(1.0, 0.55, 0.62), vec3(1.0, 0.62, 0.86), smoothstep(0.1, 0.45, a)), (1.0 - smoothstep(0.0, 0.5, a)) * 0.62);
    float vein = exp(-x * x * 40.0) * 0.1;
    pet *= 1.0 + vein * sharp;
    float far = smoothstep(0.1, -0.7, q.y);
    float edgeGlow = smoothstep(0.55, 1.0, abs(x)) * (0.5 + 0.5 * a) * 0.35;
    pet *= pt.w * (0.56 + 0.3 * far) * (1.0 + edgeGlow + far * a * 0.3) * v_c.rgb;

    float rq = length(q);
    float cr = big ? 0.14 : 0.1;
    float cb = 0.03 + bl * 0.8;
    float core = 1.0 - smoothstep(cr - cb, cr + cb, rq);
    vec2 g = q * (big ? 46.0 : 34.0);
    vec2 gi = floor(g);
    float floret = smoothstep(0.42, 0.12, length(fract(g) - 0.5)) * step(0.2, hsh(gi.x * 17.0 + gi.y * 131.0 + seed));
    float dome = smoothstep(0.6 * cr, -cr, q.y);
    vec3 cCol = mix(cc * vec3(0.55, 0.22, 0.26), cc * 1.25, dome * 0.8 + 0.2);
    cCol = mix(cCol, vec3(1.0, 0.78, 0.35), dome * floret * 0.55 * sharp);
    cCol *= 1.0 - smoothstep(0.55 * cr, cr, rq) * 0.45;
    cCol *= mix(1.0, 0.75 + 0.5 * floret, sharp);
    cCol *= max(v_c.r, 0.3);

    vec3 c = mix(pet, cCol, core);
    float alpha = clamp(max(max(mG, mR * 0.8), core), 0.0, 1.0) * 0.93 * w;
    vec3 rgb = c * vec3(max(mR, core), max(mG, core), max(mB, core)) * w;

    float halo = exp(-max(r - 0.62, 0.0) * 7.0) * (1.0 - mG) * 0.16;
    rgb += (pet * halo + mix(cc, vec3(1.0, 0.42, 0.62), 0.4) * exp(-rq * rq * 9.0) * 0.38 * max(v_c.r, 0.3)) * w;
    o = vec4(rgb, alpha);
  } else if (t < 1.5) {
    vec3 d3 = 1.0 - smoothstep(vec3(0.68), vec3(0.98), r * vec3(0.94, 1.0, 1.07));
    float disc = d3.g;
    float rim = smoothstep(0.5, 0.92, r) * disc;
    vec3 col = v_c.rgb * (d3 * 0.65 + rim * 0.45) + vec3(1.0, 0.95, 0.82) * exp(-r * r * 3.5) * 0.9 * v_c.a;
    o = vec4(col * v_q.w * (1.0 + v_c.a), disc * v_c.a * 0.85);
  } else if (t < 2.5) {
    float core = exp(-r * r * 25.0);
    float rays = exp(-abs(p.y) * 30.0) * max(1.0 - abs(p.x), 0.0) + exp(-abs(p.x) * 30.0) * max(1.0 - abs(p.y), 0.0);
    o = vec4(v_c.rgb * (core + rays * 0.7) * v_q.w, 0.0);
  } else if (t < 3.5) {
    float k = p.y * 0.5 + 0.5;
    float hw = 0.12 + 0.88 * k;
    float edge = 1.0 - smoothstep(hw * 0.55, hw, abs(p.x));
    float a = edge * smoothstep(0.0, 0.2, k) * v_q.w;

    float lit = 0.45 + 0.9 * smoothstep(0.45, 1.0, k);
    o = vec4(v_c.rgb * lit * a, a);
  } else {
    float g = exp(-r * r * 4.5) * (1.0 - smoothstep(0.8, 1.0, r));
    o = vec4(v_c.rgb * g * v_q.w, 0.0);
  }
}`;
const DOWN_FS = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_src;
uniform vec2 u_texel;
uniform float u_pre;
out vec4 o;
vec3 pre(vec3 c){
  float b = max(c.r, max(c.g, c.b));
  float k = clamp(b - 0.45, 0.0, 0.8);
  float w = max(k * k / (4.0 * 0.8 + 0.0001), b - 1.25) / max(b, 0.0001);
  return c * max(w, 0.0);
}
void main(){
  vec2 h = u_texel * 0.5;
  vec3 s = texture(u_src, v_uv).rgb * 4.0;
  s += texture(u_src, v_uv - h).rgb;
  s += texture(u_src, v_uv + h).rgb;
  s += texture(u_src, v_uv + vec2(h.x, -h.y)).rgb;
  s += texture(u_src, v_uv - vec2(h.x, -h.y)).rgb;
  s /= 8.0;
  o = vec4(u_pre > 0.5 ? pre(min(s, vec3(6.0))) : s, 1.0);
}`;
const UP_FS = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_src;
uniform vec2 u_texel;
out vec4 o;
void main(){
  vec2 h = u_texel * 0.5;
  vec3 s = texture(u_src, v_uv + vec2(-h.x * 2.0, 0.0)).rgb;
  s += texture(u_src, v_uv + vec2(-h.x, h.y)).rgb * 2.0;
  s += texture(u_src, v_uv + vec2(0.0, h.y * 2.0)).rgb;
  s += texture(u_src, v_uv + vec2(h.x, h.y)).rgb * 2.0;
  s += texture(u_src, v_uv + vec2(h.x * 2.0, 0.0)).rgb;
  s += texture(u_src, v_uv + vec2(h.x, -h.y)).rgb * 2.0;
  s += texture(u_src, v_uv + vec2(0.0, -h.y * 2.0)).rgb;
  s += texture(u_src, v_uv + vec2(-h.x, -h.y)).rgb * 2.0;
  o = vec4(s / 12.0, 1.0);
}`;
const COMPOSITE_FS = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_scene, u_bloom;
uniform vec3 u_tint;
uniform vec2 u_bl;
out vec4 o;
vec3 shoulder(vec3 c){
  float m = max(c.r, max(c.g, c.b));
  if (m <= 0.75) return c;
  float t = 0.75 + 0.25 * (1.0 - exp(-(m - 0.75) / 0.25));
  vec3 h = c * (t / m);

  return mix(h, vec3(t), clamp((m - 1.1) / 2.2, 0.0, 0.7));
}
void main(){
  vec2 d = v_uv - 0.5;

  vec2 ca = d * dot(d, d) * 0.009 * u_bl.y;
  vec3 c;
  c.r = texture(u_scene, v_uv - ca).r;
  c.g = texture(u_scene, v_uv).g;
  c.b = texture(u_scene, v_uv + ca).b;
  vec3 b;
  b.r = texture(u_bloom, v_uv - ca * 2.0).r;
  b.g = texture(u_bloom, v_uv).g;
  b.b = texture(u_bloom, v_uv + ca * 2.0).b;
  c += b * u_bl.x * u_tint;
  o = vec4(shoulder(c), 1.0);
}`;
function makeProgram(gl, vs, fs, names) {
  const sh = (type, src) => {
    const s = gl.createShader(type);
    if (!s) throw new Error("createShader failed");
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) || "shader compile failed");
    return s;
  };
  const p = gl.createProgram();
  if (!p) throw new Error("createProgram failed");
  gl.attachShader(p, sh(gl.VERTEX_SHADER, vs));
  gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) || "link failed");
  const u = {};
  for (const n of names) u[n] = gl.getUniformLocation(p, n);
  return { prog: p, u };
}
function vaoFor(gl, prog, buf, layout) {
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  const stride = layout.reduce((a, l) => a + l[1], 0) * 4;
  let off = 0;
  for (const [name, size] of layout) {
    const loc = gl.getAttribLocation(prog, name);
    if (loc >= 0) {
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, stride, off * 4);
    }
    off += size;
  }
  gl.bindVertexArray(null);
  return vao;
}
function makeTarget(gl, w, h, hdr, withDepth) {
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  if (hdr) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
  else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const fb = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  let depth = null;
  if (withDepth) {
    depth = gl.createRenderbuffer();
    gl.bindRenderbuffer(gl.RENDERBUFFER, depth);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, w, h);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depth);
  }
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return { tex, fb, depth, w, h };
}
function freeTarget(gl, t) {
  gl.deleteTexture(t.tex);
  gl.deleteFramebuffer(t.fb);
  if (t.depth) gl.deleteRenderbuffer(t.depth);
}
function targetOk(gl, t) {
  gl.bindFramebuffer(gl.FRAMEBUFFER, t.fb);
  const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return ok;
}
const WORLD_U = ["u_cam", "u_proj", "u_wave", "u_r[0]"];
function setupGpu(gl) {
  const quad = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const fsProg = (fs, names) => {
    const p = makeProgram(gl, FS_VS, fs, names);
    return { ...p, vao: vaoFor(gl, p.prog, quad, [["a_p", 2]]) };
  };
  const terrain = makeProgram(gl, TERRAIN_VS, TERRAIN_FS, [...WORLD_U, "u_fog", "u_shadow", "u_ground", "u_rim", "u_sky", "u_sheen"]);
  const mesh = buildMesh();
  const meshBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, meshBuf);
  gl.bufferData(gl.ARRAY_BUFFER, mesh.v, gl.STATIC_DRAW);
  const meshVao = vaoFor(gl, terrain.prog, meshBuf, [["a_m", 2]]);
  gl.bindVertexArray(meshVao);
  const idxBuf = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuf);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.idx, gl.STATIC_DRAW);
  gl.bindVertexArray(null);
  const glitter = makeProgram(gl, GLITTER_VS, GLITTER_FS, [
    ...WORLD_U,
    "u_px",
    "u_light",
    "u_tw",
    "u_hot",
    "u_sun",
    "u_fog",
    "u_crest",
    "u_slope",
    "u_deep"
  ]);
  const ptBuf = gl.createBuffer();
  const flower = makeProgram(gl, FLOWER_VS, FLOWER_FS, [...WORLD_U, "u_px", "u_fog", "u_petal", "u_tip", "u_core", "u_deep"]);
  const hfBuf = gl.createBuffer();
  const sprite = makeProgram(gl, SPRITE_VS, SPRITE_FS, ["u_petal", "u_tip", "u_core", "u_mpetal", "u_mrim", "u_mcore", "u_fringe"]);
  const sprBuf = gl.createBuffer();
  const range = gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE);
  return {
    sky: fsProg(SKY_FS, ["u_res", "u_top", "u_mid", "u_hor", "u_gc", "u_g"]),
    down: fsProg(DOWN_FS, ["u_src", "u_texel", "u_pre"]),
    up: fsProg(UP_FS, ["u_src", "u_texel"]),
    comp: fsProg(COMPOSITE_FS, ["u_scene", "u_bloom", "u_tint", "u_bl"]),
    terrain: { ...terrain, vao: meshVao, count: mesh.idx.length },
    glitter: { ...glitter, buf: ptBuf, vao: vaoFor(gl, glitter.prog, ptBuf, [["a_d", 4]]) },
    flower: { ...flower, buf: hfBuf, vao: vaoFor(gl, flower.prog, hfBuf, [["a_d", 4]]) },
    sprite: {
      ...sprite,
      buf: sprBuf,
      vao: vaoFor(gl, sprite.prog, sprBuf, [["a_p", 2], ["a_uv", 2], ["a_type", 1], ["a_q", 4], ["a_c", 4]])
    },
    maxPt: range && range[1] ? range[1] : 64
  };
}
function createGlimmerVale(canvas, options) {
  const gl = canvas.getContext("webgl2", { alpha: false, antialias: false, premultipliedAlpha: true, preserveDrawingBuffer: true });
  if (!gl) throw new Error("Glimmer Vale requires WebGL2");
  let gpu;
  try {
    gpu = setupGpu(gl);
  } catch (error) {
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    throw error;
  }
  let hdr = !!gl.getExtension("EXT_color_buffer_float");
  const sizeRef = { current: { w: 1, h: 1 } };
  const liveRef = { current: options };
  const pointerRef = { current: { tx: 0, ty: 0, over: 0, down: 0, x: 0, y: 0, o: 0, d: 0 } };
  const spr = new Float32Array(MAX_SPRITES * 6 * SPR_STRIDE);
  const midPetal = parseColor(MID_PETAL), midRim = parseColor(MID_RIM), midCore = parseColor(MID_CORE);
  let scene = null;
  let bloom = [];
  let pointSeed = NaN;
  let meadowKey = "";
  let meadow = [];
  let last = -1;
  let tw = 0;
  const allocate = (cw, ch) => {
    if (scene) freeTarget(gl, scene);
    bloom.forEach((t) => freeTarget(gl, t));
    scene = makeTarget(gl, cw, ch, hdr, true);
    if (hdr && !targetOk(gl, scene)) {
      freeTarget(gl, scene);
      hdr = false;
      scene = makeTarget(gl, cw, ch, false, true);
    }
    bloom = [];
    let w = cw, h = ch;
    for (let i = 0; i < BLOOM_LEVELS; i++) {
      w = Math.max(1, w >> 1);
      h = Math.max(1, h >> 1);
      bloom.push(makeTarget(gl, w, h, hdr, false));
    }
  };
  const frame = (now) => {
    const L = liveRef.current;
    const adv = { ...DEFAULT_ADVANCED, ...L.advanced ?? {} };
    const rdt = last < 0 ? 0 : Math.min(Math.max(0, (now - last) / 1e3), 1 / 20);
    last = now;
    const loop = Math.max(2, num(adv.loopSec, 8));
    const spd = Math.max(0, num(L.speed, 50)) / 50;
    tw = (tw + rdt * spd) % loop;
    const { w: W, h: H } = sizeRef.current;
    if (W < 2 || H < 2) return;
    const dpr = 1;
    const cw = Math.round(W * dpr), ch = Math.round(H * dpr);
    if (canvas.width !== cw || canvas.height !== ch || !scene || scene.w !== cw || scene.h !== ch) {
      canvas.width = cw;
      canvas.height = ch;
      allocate(cw, ch);
    }
    const sceneT = scene;
    const P = pointerRef.current;
    const kp = 1 - Math.exp(-rdt / 0.4);
    P.x += (P.tx - P.x) * kp;
    P.y += (P.ty - P.y) * kp;
    P.o += (P.over - P.o) * kp;
    P.d += (P.down - P.d) * (1 - Math.exp(-rdt / 0.25));
    const hk = Math.max(0, num(adv.hover, 50)) / 50;
    const scaleF = clamp(num(L.scale, 100), 30, 200) / 100;
    const spark = clamp(num(L.sparkle, 50), 0, 100) / 50;
    const dens = clamp(num(L.density, 60), 10, 100) / 100;
    const unit = Math.min(W, H * 0.75);
    const sx = -P.x * 0.02 * hk;
    const bob = num(adv.bob, 6) / 1e3 * Math.sin(TAU * tw / loop);
    const camX = P.x * 0.35 * hk;
    const camY = CAM_H + bob * 6 - P.y * 0.06 * hk;
    const pitch = PITCH + P.y * 8e-3 * hk;
    const cosP = Math.cos(pitch), sinP = Math.sin(pitch);
    const worldW = 2 * TAN_H * 12;
    const wave = {
      si: 1 / scaleF,
      amp: num(adv.waveHeight, 25) / 1e3 * 3,
      k: TAU / Math.max(0.3, num(adv.waveLength, 70) / 100 * worldW * scaleF),
      ph: TAU * tw / loop
    };
    const hotX = num(adv.hotspotX, 65) / 100;
    const hotS = num(adv.hotspotStrength, 70) / 100;
    const hotY = crestYAt(hotX, wave, camX, camY, cosP, sinP) + 0.06;
    const glowS = num(adv.glowStrength, 60) / 100 * (1 + 0.4 * P.d * hk);
    const swayK = num(adv.sway, 50) / 50;
    const flowerK = num(adv.flowerSize, 100) / 100 * scaleF;
    const blurK = num(adv.flowerBlur, 100) / 100;
    const bg = parseColor(L.background, [0, 0, 0]);
    const crestC = parseColor(adv.crestColor, [0.96, 0.94, 1]);
    const glowC = parseColor(adv.glowColor, [0.91, 0.89, 1]);
    const shadow = parseColor(adv.hillShadow, [0.16, 0.13, 0.22]);
    const slopeC = parseColor(adv.slopeColor, [0.55, 0.52, 0.78]);
    const deep = parseColor(adv.slopeDeep, [0.35, 0.32, 0.56]);
    const skyHor = parseColor(L.skyHorizon, [0.61, 0.61, 0.78]);
    const petalC = parseColor(adv.petalColor, [0.95, 0.93, 1]);
    const tipC = parseColor(adv.petalTip, [0.72, 0.69, 0.94]);
    const coreC = parseColor(adv.flowerCore, [0.91, 0.31, 0.16]);
    const fogC = mix3(skyHor, deep, 0.45);
    const fogDist = 22 * scaleF;
    const seed = Math.round(num(adv.seed, 7));
    if (seed !== pointSeed) {
      gl.bindBuffer(gl.ARRAY_BUFFER, gpu.glitter.buf);
      gl.bufferData(gl.ARRAY_BUFFER, buildPoints(seed), gl.STATIC_DRAW);
      gl.bindBuffer(gl.ARRAY_BUFFER, gpu.flower.buf);
      gl.bufferData(gl.ARRAY_BUFFER, buildHillFlowers(seed), gl.STATIC_DRAW);
      pointSeed = seed;
    }
    const midN = Math.round(clamp(num(adv.midCount, 110), 0, 200));
    const bokN = Math.round(clamp(num(adv.bokehCount, 90), 0, 200));
    const grassN = Math.round(clamp(num(adv.grassCount, 320), 0, 400));
    const mKey = `${seed}|${midN}|${bokN}|${grassN}`;
    if (mKey !== meadowKey) {
      meadow = buildMeadow(seed, midN, bokN, grassN);
      meadowKey = mKey;
    }
    let si = 0;
    const hxPx = hotX * W, hyPx = hotY * H;
    const gR = unit * 0.13 * scaleF;
    si = pushSprite(spr, si, W, H, hxPx, hyPx, gR * 0.6, gR * 0.4, 0, 4, 0, 0, 0, hotS * 0.35, glowC[0], glowC[1], glowC[2], 0);
    si = pushSprite(spr, si, W, H, hxPx, hyPx, W * 0.14, H * 0.012, 0, 4, 0, 0, 0, hotS * 0.3, glowC[0], glowC[1], glowC[2], 0);
    const pushStem = (i, cx, cy, R, light, ang) => {
      const len = R * 2.4;
      const g = 0.35 + 0.4 * light;
      return pushSprite(spr, i, W, H, cx - Math.sin(ang) * len, cy + R * 0.2 + len, Math.max(0.6, R * 0.04), len, ang, 3, 0, 0, 0, 0.22, GRASS_A[0] * g, GRASS_A[1] * g * 1.4, GRASS_A[2] * g, 1);
    };
    for (const m of meadow) {
      if (m.kind === 0 || m.kind === 5) {
        const near = m.d / 0.15;
        const sw = Math.sin(TAU * tw / (loop / 2) + m.ph);
        const ang = 1.5 * Math.PI / 180 * swayK * (0.5 + 0.5 * near) * sw;
        const R = m.d * 0.5 * unit * flowerK;
        const cx = m.x * W + sw * 4e-3 * W * near * swayK - P.x * 0.04 * hk * W * near;
        const cy = m.y * H - P.y * 0.015 * hk * H * near;
        const hx = R / 0.8;
        if (m.kind === 0) {
          const bl = m.blur * blurK;
          const g = grow(bl);
          si = pushSprite(spr, si, W, H, cx, cy, hx * g, hx * m.tilt * g, ang, 0, bl, m.n + (g - 1) * 0.5, m.rot, packTilt(m.tilt, 1), m.tint[0], m.tint[1], m.tint[2], 0);
        } else {
          const c = Math.cos(ang), s = Math.sin(ang);
          const ox = m.ox * hx, oy = m.oy * hx;
          const r = hx * m.w * (0.6 + 0.6 * blurK);
          si = pushSprite(spr, si, W, H, cx + ox * c - oy * s, cy + ox * s + oy * c, r, r, 0, 1, 0, 0, 0, m.alpha * (0.8 + 0.6 * spark), m.col[0], m.col[1], m.col[2], 0.5);
        }
      } else if (m.kind === 1) {
        const sw = Math.sin(TAU * tw / (loop / 2) + m.ph);
        const ang = 1 * Math.PI / 180 * swayK * sw;
        const R = m.d * 0.5 * unit * flowerK;
        const cx = m.x * W + sw * 2e-3 * W * swayK - P.x * W * hk * (0.012 + 0.015 * m.f);
        const cy = (m.y + bob * (1 - m.f)) * H - P.y * 6e-3 * hk * H;
        const hx = R / 0.8;
        const bl = m.blur * blurK;
        const g = grow(bl);
        si = pushStem(si, cx, cy, R, m.tint[0] * 0.8, ang);
        si = pushSprite(spr, si, W, H, cx, cy, hx * g, hx * m.tilt * g, ang, 0, bl, m.n + (g - 1) * 0.5, m.rot, packTilt(m.tilt, m.alpha), m.tint[0], m.tint[1], m.tint[2], 1);
      } else if (m.kind === 6) {
        const shimmer = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(TAU * tw / loop + m.ph)) ** 2;
        const R = Math.max(1.4, m.d * unit * scaleF * 1.2);
        si = pushSprite(spr, si, W, H, m.x * W, m.y * H, R, R, 0, 2, 0, 0, 0, m.alpha * shimmer * 1.6, m.col[0], m.col[1], m.col[2], 0);
      } else if (m.kind === 2) {
        const s = Math.sin(TAU * tw / loop + m.ph);
        const breath = 0.8 + 0.2 * s;
        const dy = -8e-3 * s + 8e-3 * Math.sin(m.ph);
        const R = m.d * 0.5 * unit * scaleF;
        const cx = m.x * W - P.x * 0.025 * hk * W;
        const cy = (m.y + dy) * H - P.y * 0.01 * hk * H;
        si = pushSprite(spr, si, W, H, cx, cy, R, R, 0, 1, 0, 0, 0, m.alpha * breath, m.col[0], m.col[1], m.col[2], 0);
      } else {
        const ang = m.ang + Math.sin(TAU * tw / (loop / 2) + m.ph) * 0.03 * swayK;
        const hh = m.h * 0.5 * unit * scaleF;
        const hw = Math.max(0.6, m.w * 0.5 * unit * scaleF);
        const bx = m.x * W - P.x * W * hk * (0.012 + 0.02 * m.f);
        const by = m.y * H;
        for (let b = -1; b <= 1; b++) {
          const a2 = ang + b * 0.24;
          const h2 = hh * (1 - 0.18 * Math.abs(b) - 0.1 * b);
          const x2 = bx + b * hw * 2.5;
          si = pushSprite(spr, si, W, H, x2 + Math.sin(a2) * h2, by - Math.cos(a2) * h2, hw, h2, a2, 3, 0, 0, 0, m.alpha, m.col[0], m.col[1], m.col[2], 1);
        }
      }
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, sceneT.fb);
    gl.viewport(0, 0, cw, ch);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);
    gl.depthMask(true);
    gl.clearColor(bg[0], bg[1], bg[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    const S = gpu.sky;
    gl.useProgram(S.prog);
    gl.uniform2f(S.u.u_res, cw, ch);
    gl.uniform3fv(S.u.u_top, parseColor(L.skyTop, [0.23, 0.25, 0.56]));
    gl.uniform3fv(S.u.u_mid, parseColor(adv.skyMid, [0.34, 0.38, 0.67]));
    gl.uniform3fv(S.u.u_hor, skyHor);
    gl.uniform3fv(S.u.u_gc, parseColor(adv.horizonGlow, [0.96, 0.91, 0.89]));
    gl.uniform4f(S.u.u_g, hotX + sx * 0.3, hotY - 0.02, num(adv.horizonGlowStrength, 30) / 100, W / H);
    gl.bindVertexArray(S.vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    const A = (FAR + NEAR) / (FAR - NEAR), B = -2 * FAR * NEAR / (FAR - NEAR);
    const setWorld = (u) => {
      gl.uniform4f(u.u_cam, camX, camY, cosP, sinP);
      gl.uniform4f(u.u_proj, TAN_H, TAN_V, A, B);
      gl.uniform4f(u.u_wave, wave.si, wave.amp, wave.k, wave.ph);
      gl.uniform4f(u.u_fog, fogC[0], fogC[1], fogC[2], fogDist);
      gl.uniform4fv(u["u_r[0]"], RIDGES);
    };
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    const T = gpu.terrain;
    gl.useProgram(T.prog);
    setWorld(T.u);
    gl.uniform3fv(T.u.u_shadow, shadow);
    gl.uniform3fv(T.u.u_ground, bg);
    gl.uniform3fv(T.u.u_rim, slopeC);
    gl.uniform3fv(T.u.u_sky, skyHor);
    const sheen = mix3(slopeC, glowC, 0.25).map((c, i) => c * [0.42, 0.37, 0.52][i] * (num(adv.crestBright, 100) / 100));
    gl.uniform3fv(T.u.u_sheen, sheen);
    gl.bindVertexArray(T.vao);
    gl.drawElements(gl.TRIANGLES, T.count, gl.UNSIGNED_INT, 0);
    gl.depthMask(false);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    const Fl = gpu.flower;
    gl.useProgram(Fl.prog);
    setWorld(Fl.u);
    gl.uniform4f(Fl.u.u_px, ch / 2, flowerK, gpu.maxPt, 0);
    gl.uniform3fv(Fl.u.u_petal, slopeC);
    gl.uniform3fv(Fl.u.u_tip, petalC);
    gl.uniform3fv(Fl.u.u_core, coreC);
    gl.uniform3fv(Fl.u.u_deep, deep);
    gl.bindVertexArray(Fl.vao);
    gl.drawArrays(gl.POINTS, 0, Math.floor(MAX_HF * dens));
    const G = gpu.glitter;
    gl.useProgram(G.prog);
    setWorld(G.u);
    gl.uniform4f(G.u.u_px, ch / 2, 0.017 * scaleF * (num(adv.pointSize, 100) / 100), gpu.maxPt, 1 * dpr);
    const flash = 0.45 * spark * (1 + 0.3 * P.o * hk + 0.8 * P.d * hk);
    gl.uniform4f(G.u.u_light, num(adv.crestBright, 100) / 100, num(adv.slopeBright, 100) / 100, flash, Math.max(1, num(adv.twinkleSharp, 8)));
    const drawn = Math.floor(MAX_PTS * dens);
    const glintShare = clamp(num(adv.glintCount, 20), 0, 60) * spark * 4 / Math.max(1, drawn);
    gl.uniform4f(G.u.u_tw, loop / 5, clamp(num(adv.prismShare, 60) / 100 * Math.min(1, 0.5 + spark * 0.5), 0, 1), glintShare, tw);
    gl.uniform4f(G.u.u_hot, hotX * 2 - 1 + sx, 1 - hotY * 2, hotS, num(adv.glintSize, 100) / 100);
    const sl = Math.hypot((hotX * 2 - 1) * TAN_H, 0.18, 1);
    gl.uniform4f(G.u.u_sun, (hotX * 2 - 1) * TAN_H / sl, 0.18 / sl, -1 / sl, loop / 10);
    gl.uniform3fv(G.u.u_crest, crestC);
    gl.uniform3fv(G.u.u_slope, slopeC);
    gl.uniform3fv(G.u.u_deep, deep);
    gl.bindVertexArray(G.vao);
    gl.drawArrays(gl.POINTS, 0, drawn);
    gl.disable(gl.DEPTH_TEST);
    const Sp = gpu.sprite;
    gl.useProgram(Sp.prog);
    gl.uniform3fv(Sp.u.u_petal, petalC);
    gl.uniform3fv(Sp.u.u_tip, tipC);
    gl.uniform3fv(Sp.u.u_core, coreC);
    gl.uniform3fv(Sp.u.u_mpetal, midPetal);
    gl.uniform3fv(Sp.u.u_mrim, midRim);
    gl.uniform3fv(Sp.u.u_mcore, midCore);
    gl.uniform1f(Sp.u.u_fringe, num(adv.fringe, 100) / 100);
    gl.bindBuffer(gl.ARRAY_BUFFER, Sp.buf);
    gl.bufferData(gl.ARRAY_BUFFER, spr.subarray(0, si * 6 * SPR_STRIDE), gl.DYNAMIC_DRAW);
    gl.bindVertexArray(Sp.vao);
    gl.drawArrays(gl.TRIANGLES, 0, si * 6);
    gl.disable(gl.BLEND);
    const Dn = gpu.down;
    gl.useProgram(Dn.prog);
    gl.bindVertexArray(Dn.vao);
    gl.activeTexture(gl.TEXTURE0);
    gl.uniform1i(Dn.u.u_src, 0);
    let src = sceneT;
    for (let i = 0; i < bloom.length; i++) {
      const dst = bloom[i];
      gl.bindFramebuffer(gl.FRAMEBUFFER, dst.fb);
      gl.viewport(0, 0, dst.w, dst.h);
      gl.bindTexture(gl.TEXTURE_2D, src.tex);
      gl.uniform2f(Dn.u.u_texel, 1 / src.w, 1 / src.h);
      gl.uniform1f(Dn.u.u_pre, i === 0 ? 1 : 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      src = dst;
    }
    const Up = gpu.up;
    gl.useProgram(Up.prog);
    gl.bindVertexArray(Up.vao);
    gl.uniform1i(Up.u.u_src, 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    for (let i = bloom.length - 1; i > 0; i--) {
      const from = bloom[i], dst = bloom[i - 1];
      gl.bindFramebuffer(gl.FRAMEBUFFER, dst.fb);
      gl.viewport(0, 0, dst.w, dst.h);
      gl.bindTexture(gl.TEXTURE_2D, from.tex);
      gl.uniform2f(Up.u.u_texel, 1 / from.w, 1 / from.h);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    gl.disable(gl.BLEND);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, cw, ch);
    const C = gpu.comp;
    gl.useProgram(C.prog);
    gl.bindVertexArray(C.vao);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, sceneT.tex);
    gl.uniform1i(C.u.u_scene, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, bloom[0].tex);
    gl.uniform1i(C.u.u_bloom, 1);
    gl.activeTexture(gl.TEXTURE0);
    gl.uniform3fv(C.u.u_tint, mix3([1, 1, 1], glowC, 0.35));
    gl.uniform2f(C.u.u_bl, glowS * 0.75, num(adv.fringe, 100) / 100);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);
  };
  return {
    render(time, width, height) {
      sizeRef.current = { w: width, h: height };
      frame(time * 1e3);
    },
    dispose() {
      if (scene) freeTarget(gl, scene);
      bloom.forEach((t) => freeTarget(gl, t));
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    }
  };
}
export {
  createGlimmerVale
};
