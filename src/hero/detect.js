const params = () => new URLSearchParams(window.location.search);

export function hasWebGL2() {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2');
    return Boolean(gl);
  } catch {
    return false;
  }
}

function isPhone() {
  return window.matchMedia('(max-width: 760px) and (pointer: coarse)').matches;
}

/**
 * WebGL hero on desktops and capable phones.
 * Sequence (or stills, if frames are missing) when motion should be reduced,
 * WebGL2 is unavailable, data-saver is on, or the device is genuinely small:
 * very little memory, two or fewer cores, or a phone that is both narrow and
 * short on cores and memory.
 */
export function detectMode() {
  const forced = params().get('mode');
  if (forced === 'webgl' || forced === 'sequence' || forced === 'stills') return forced;

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return 'stills';
  if (!hasWebGL2()) return 'sequence';

  const saveData = Boolean(navigator.connection && navigator.connection.saveData);
  const mem = navigator.deviceMemory;
  const cores = navigator.hardwareConcurrency || 8;
  const phone = isPhone();

  if (saveData) return 'sequence';
  if (cores <= 2) return 'sequence';
  if (typeof mem === 'number' && mem <= 2) return 'sequence';
  if (phone && cores <= 4) return 'sequence';
  if (phone && typeof mem === 'number' && mem <= 4) return 'sequence';

  return 'webgl';
}

export function pixelRatio() {
  const dpr = window.devicePixelRatio || 1;
  const phone = window.matchMedia('(max-width: 760px)').matches;
  return Math.min(dpr, phone ? 1.25 : 1.5);
}

export function captureMode() {
  return params().has('capture');
}

export function scrubValue() {
  return params().get('scrub') === '0' ? true : 1;
}

export function snapEnabled() {
  if (captureMode()) return false;
  return params().get('snap') !== '0';
}
