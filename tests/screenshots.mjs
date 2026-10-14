import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const port = 4173;
const outDir = process.env.SHOTS_DIR || '/opt/cursor/artifacts';
const server = spawn(
  process.execPath,
  ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'],
  { stdio: ['ignore', 'pipe', 'pipe'] },
);

function waitForServer() {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Podgląd nie wstał.')), 20000);
    const onData = (chunk) => {
      const text = chunk.toString();
      if (text.includes('Local') || text.includes('127.0.0.1')) {
        clearTimeout(timer);
        resolve();
      }
    };
    server.stdout.on('data', onData);
    server.stderr.on('data', onData);
    server.on('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`Podgląd zakończył się kodem ${code}`));
    });
  });
}

const viewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
];
const stops = [0, 0.3, 0.6, 0.9];

try {
  await waitForServer();
  await mkdir(outDir, { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome', headless: true });

  for (const viewport of viewports) {
    const page = await browser.newPage({
      viewport: { width: viewport.width, height: viewport.height },
      deviceScaleFactor: 1,
    });
    const problems = [];
    page.on('pageerror', (error) => problems.push(error.message));
    await page.goto(`http://127.0.0.1:${port}/?snap=0&scrub=0`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__atelier?.ready, null, { timeout: 20000 });
    await page.evaluate(() => document.fonts.ready);
    const mode = await page.evaluate(() => window.__atelier.mode);
    console.log(viewport.name, mode, 'draws', await page.evaluate(() => window.__atelier.getDrawCalls()));

    for (const stop of stops) {
      await page.evaluate((ratio) => window.__atelier.scrollToRatio(ratio), stop);
      await page.waitForTimeout(700);
      const label = String(Math.round(stop * 100)).padStart(2, '0');
      const file = `${outDir}/screenshot_${viewport.name}_scroll_${label}.png`;
      await page.screenshot({ path: file, fullPage: false });
      console.log(file);
    }

    if (viewport.name === 'desktop') {
      await page.evaluate(() => window.__atelier.scrollToRatio(0.72));
      await page.waitForTimeout(400);
      await page.locator('#rezerwacja-form').scrollIntoViewIfNeeded();
      await page.fill('input[name="name"]', 'Jan Kowalski');
      await page.fill('input[name="phone"]', '500600700');
      await page.fill('input[name="email"]', 'jan@przyklad.example');
      await page.selectOption('select[name="service"]', { label: 'Fade' });
      await page.selectOption('select[name="barber"]', { label: 'Marek Lewandowski' });
      const day = await page.evaluate(() => {
        const now = new Date();
        const next = new Date(now);
        next.setDate(now.getDate() + 2);
        while (next.getDay() === 0) next.setDate(next.getDate() + 1);
        const local = new Date(next.getTime() - next.getTimezoneOffset() * 60000);
        return local.toISOString().slice(0, 10);
      });
      await page.fill('input[name="date"]', day);
      await page.dispatchEvent('input[name="date"]', 'change');
      await page.selectOption('select[name="time"]', { index: 2 });
      await page.click('button[type="submit"]');
      await page.waitForSelector('#potwierdzenie:not([hidden])');
      const file = `${outDir}/screenshot_desktop_booking_confirmation.png`;
      await page.screenshot({ path: file, fullPage: false });
      console.log(file);
    }

    if (problems.length) {
      console.log(problems.join('\n'));
      throw new Error(problems[0]);
    }
    await page.close();
  }

  await browser.close();
} finally {
  server.kill('SIGTERM');
}
