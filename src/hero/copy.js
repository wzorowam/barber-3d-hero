export function smoothstep(edge0, edge1, x) {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0 || 1)));
  return t * t * (3 - 2 * t);
}

export function copyState(p) {
  const arrive = 1 - smoothstep(0.12, 0.21, p);
  const precision = smoothstep(0.25, 0.32, p) * (1 - smoothstep(0.46, 0.54, p));
  const sharp = smoothstep(0.72, 0.8, p) * (1 - smoothstep(0.96, 1, p));
  const cta = smoothstep(0.78, 0.88, p);
  return { arrive, precision, sharp, cta, hint: arrive, progress: p };
}
