import { smoothstep } from './copy.js';

const TAU = Math.PI * 2;

const KEYS = [
  { t: 0.0, p: [-0.55, 0.34, 6.7], l: [-0.95, 0.08, 0], cut: 0, rot: 0, sc: 0.0, open: 0.5, rz: 0.0, lift: 0.7, cross: 0, rim: 0.7, glint: 22 },
  { t: 0.1, p: [-0.2, 0.32, 5.7], l: [-0.7, 0.1, 0], cut: 0, rot: 0, sc: 0.07, open: 0.42, rz: 0.07, lift: 0.2, cross: 0, rim: 0.75, glint: 14 },
  { t: 0.25, p: [0.95, 0.32, 4.4], l: [-0.1, 0.16, 0], cut: 0.04, rot: 0, sc: 0.26, open: 0.4, rz: 0.18, lift: 0, cross: 0, rim: 0.85, glint: 4 },
  { t: 0.45, p: [2.4, 0.55, 3.2], l: [0.05, 0.2, 0], cut: 0.5, rot: 0, sc: 0.8, open: 0.28, rz: 0.38, lift: 0, cross: 0, rim: 0.95, glint: 1.6 },
  { t: 0.6, p: [1.5, -0.05, 3.45], l: [0.1, 0.0, 0], cut: 0.85, rot: 0, sc: 0.95, open: 0.16, rz: 0.88, lift: 0.35, cross: 0, rim: 1.1, glint: 0.5 },
  { t: 0.75, p: [0.2, 0.38, 4.8], l: [-0.35, 0.14, 0], cut: 1, rot: TAU, sc: 1, open: 0.14, rz: 1, lift: 1.2, cross: 0.35, rim: 1.45, glint: 0.5 },
  { t: 0.9, p: [-0.45, 0.3, 5.6], l: [-0.85, 0.08, 0], cut: 1, rot: TAU, sc: 1, open: 0.1, rz: 1, lift: 0.08, cross: 1, rim: 1.6, glint: 2.8 },
  { t: 1, p: [-0.5, 0.28, 5.95], l: [-0.9, 0.06, 0], cut: 1, rot: TAU, sc: 1, open: 0.1, rz: 1, lift: 0.04, cross: 1, rim: 1.3, glint: 1.3 },
];

const NUM = ['cut', 'rot', 'sc', 'open', 'rz', 'lift', 'cross', 'rim', 'glint'];

function lerp(a, b, u) {
  return a + (b - a) * u;
}

function lerpArr(a, b, u) {
  return [lerp(a[0], b[0], u), lerp(a[1], b[1], u), lerp(a[2], b[2], u)];
}

export function poseAt(progress) {
  const t = Math.min(1, Math.max(0, progress));
  let i = 0;
  while (i < KEYS.length - 2 && t > KEYS[i + 1].t) i += 1;
  const a = KEYS[i];
  const b = KEYS[i + 1];
  const span = b.t - a.t || 1;
  const u = smoothstep(0, 1, (t - a.t) / span);
  const pose = {
    cam: lerpArr(a.p, b.p, u),
    look: lerpArr(a.l, b.l, u),
  };
  for (const key of NUM) pose[key] = lerp(a[key], b[key], u);
  if (t > 0.26 && t < 0.58) {
    pose.open = 0.16 + Math.abs(Math.sin(t * 42)) * 0.36;
  }
  return pose;
}
