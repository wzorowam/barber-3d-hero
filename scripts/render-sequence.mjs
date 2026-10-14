import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { FRAME_COUNT } from '../src/hero/frames.js';

const port = 4178;
const root = new URL('..', import.meta.url);
const outDir = new URL('../public/fallback/', import.meta.url);

const server = spawn(
  process.execPath,
  ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(port), '--strictPort'],
  { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] },
);

function waitForServer() {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Vite nie wstał.')), 20000);
    const onData = (chunk) => {
      const text = chunk.toString();
      if (text.includes('Local') || text.includes('localhost') || text.includes('127.0.0.1')) {
        clearTimeout(timer);
        resolve();
      }
    };
    server.stdout.on('data', onData);
    server.stderr.on('data', onData);
    server.on('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`Vite zakończył się kodem ${code}`));
    });
  });
}

async function saveDataUrl(dataUrl, fileUrl) {
  const base64 = dataUrl.split(',')[1];
  await writeFile(fileUrl, Buffer.from(base64, 'base64'));
}

try {
  await waitForServer();
  await mkdir(outDir, { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  const logs = [];
  page.on('console', (msg) => logs.push(`${msg.type()}: ${msg.text()}`));
  page.on('pageerror', (error) => logs.push(`pageerror: ${error.message}`));
  await page.goto(`http://127.0.0.1:${port}/?mode=webgl&capture=1&snap=0&scrub=0`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__atelier?.ready && window.__atelier.mode === 'webgl', null, { timeout: 20000 });

  const calls = await page.evaluate(() => window.__atelier.getDrawCalls());
  console.log('draw calls', calls);
  if (calls > 25) throw new Error(`Za dużo wywołań rysowania: ${calls}`);

  for (let i = 0; i < FRAME_COUNT; i += 1) {
    const progress = i / (FRAME_COUNT - 1);
    const dataUrl = await page.evaluate(async (p) => {
      window.__atelier.setHeroProgress(p);
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      return document.querySelector('#hero-webgl').toDataURL('image/jpeg', 0.72);
    }, progress);
    const name = `frame-${String(i).padStart(2, '0')}.jpg`;
    await saveDataUrl(dataUrl, new URL(name, outDir));
    console.log(name);
  }

  await page.evaluate((p) => window.__atelier.setHeroProgress(p), 0);
  await saveDataUrl(
    await page.evaluate(() => document.querySelector('#hero-webgl').toDataURL('image/jpeg', 0.8)),
    new URL('poster.jpg', outDir),
  );
  await saveDataUrl(
    await page.evaluate(() => document.querySelector('#hero-webgl').toDataURL('image/jpeg', 0.8)),
    new URL('before.jpg', outDir),
  );
  await page.evaluate((p) => window.__atelier.setHeroProgress(p), 0.86);
  await saveDataUrl(
    await page.evaluate(() => document.querySelector('#hero-webgl').toDataURL('image/jpeg', 0.8)),
    new URL('after.jpg', outDir),
  );

  if (logs.some((line) => line.startsWith('pageerror') || line.startsWith('error:'))) {
    console.log(logs.join('\n'));
  }
  await browser.close();
  console.log('fallback frames written');
} finally {
  server.kill('SIGTERM');
}
