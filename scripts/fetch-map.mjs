import { writeFile } from 'node:fs/promises';
import sharp from 'sharp';

const lat = 52.23218;
const lon = 21.01317;
const zoom = 16;
const n = 2 ** zoom;
const fx = ((lon + 180) / 360) * n;
const latRad = (lat * Math.PI) / 180;
const fy = (1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n;
const tx = Math.floor(fx);
const ty = Math.floor(fy);

const tiles = [];
for (let dy = -1; dy <= 1; dy += 1) {
  for (let dx = -1; dx <= 1; dx += 1) {
    const url = `https://tile.openstreetmap.org/${zoom}/${tx + dx}/${ty + dy}.png`;
    const response = await fetch(url, {
      headers: { 'User-Agent': 'AtelierBrzytwaSample/1.0 (static demo map)' },
    });
    if (!response.ok) throw new Error(`${response.status} ${url}`);
    tiles.push({ input: Buffer.from(await response.arrayBuffer()), left: (dx + 1) * 256, top: (dy + 1) * 256 });
  }
}

const stitched = sharp({
  create: { width: 768, height: 768, channels: 4, background: { r: 230, g: 224, b: 214, alpha: 1 } },
}).composite(tiles);

const px = (1 + (fx - tx)) * 256;
const py = (1 + (fy - ty)) * 256;
const cropW = 720;
const cropH = 480;
const left = Math.max(0, Math.min(768 - cropW, Math.round(px - cropW / 2)));
const top = Math.max(0, Math.min(768 - cropH, Math.round(py - cropH / 2)));

const jpeg = await stitched.extract({ left, top, width: cropW, height: cropH }).jpeg({ quality: 78 }).toBuffer();
await writeFile(new URL('../public/images/map.jpg', import.meta.url), jpeg);
console.log('map.jpg', jpeg.length);
