import { FRAME_COUNT } from './frames.js';

function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
    img.alt = '';
  });
}

function cover(ctx, img, width, height) {
  const scale = Math.max(width / img.width, height / img.height);
  const w = img.width * scale;
  const h = img.height * scale;
  ctx.drawImage(img, (width - w) / 2, (height - h) / 2, w, h);
}

export async function mountSequence(canvas) {
  const frames = await Promise.all(
    Array.from({ length: FRAME_COUNT }, (_, i) => (
      loadImage(`/fallback/frame-${String(i).padStart(2, '0')}.jpg`)
    )),
  );
  const ready = frames.filter(Boolean).length >= FRAME_COUNT - 2;
  if (!ready) return null;

  const ctx = canvas.getContext('2d', { alpha: false });

  function resize() {
    const width = canvas.clientWidth || 1;
    const height = canvas.clientHeight || 1;
    const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
  }

  function draw(progress) {
    const index = Math.round(Math.min(1, Math.max(0, progress)) * (FRAME_COUNT - 1));
    const img = frames[index] || frames.find(Boolean);
    if (!img) return;
    ctx.fillStyle = '#101114';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    cover(ctx, img, canvas.width, canvas.height);
  }

  const observer = new ResizeObserver(() => resize());
  observer.observe(canvas.parentElement || canvas);
  resize();
  draw(0);

  return {
    draw,
    resize,
    dispose() {
      observer.disconnect();
    },
  };
}

export function showStills(root) {
  const stills = root.querySelector('.hero-stills');
  if (stills) stills.hidden = false;
  root.querySelectorAll('canvas').forEach((canvas) => {
    canvas.hidden = true;
  });
  document.documentElement.classList.add('is-stills');
}
