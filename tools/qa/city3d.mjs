// The 3D city hub: renders, drives with keys, opens a district by clicking
// its gate, shows the quest tracker, and switches to the flat map and back.
// node tools/qa/city3d.mjs <outDir> [baseUrl]
import { chromium, devices } from '@playwright/test';
const out = process.argv[2] ?? 'qa-shots';
const base = process.argv[3] ?? 'http://127.0.0.1:4180/';
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const report = [];

const progress = Object.fromEntries(
  ['docks-1', 'docks-2', 'docks-3', 'docks-4', 'docks-5', 'loops-1', 'loops-2', 'loops-3', 'spires-1'].map((id) => [id, { done: true, stars: 3 }]),
);

for (const [name, opts] of [
  ['1366x768', { viewport: { width: 1366, height: 768 } }],
  ['1024x600', { viewport: { width: 1024, height: 600 } }],
  ['ipad-landscape', { ...devices['iPad (gen 7) landscape'] }],
]) {
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(base);
  await page.evaluate((progress) => {
    localStorage.clear();
    localStorage.setItem('relight.save.v1', JSON.stringify({ version: 1, name: '', track: 'python', seenIntro: true, progress, python: {}, blocks: {}, published: 0, workshop: null }));
  }, progress);
  await page.reload();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.waitForSelector('.hub-canvas.is-3d', { timeout: 20000 });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${out}/city-${name}-0-start.png` });
  report.push(`${name} quest: ${(await page.locator('.quest').innerText()).replace(/\n/g, ' | ')}`);

  if (name === '1366x768') {
    // Drive with the keyboard.
    await page.keyboard.down('ArrowUp');
    await page.waitForTimeout(1200);
    await page.keyboard.up('ArrowUp');
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${out}/city-${name}-1-driving.png` });
    // Go there: Kilo drives to the next district and its panel opens.
    await page.getByRole('button', { name: 'Go there' }).click();
    const opened = await page.waitForSelector('.district-panel', { timeout: 20000 }).then(() => true, () => false);
    report.push(`${name} Go there drives to the gate and opens it: ${opened} (${opened ? await page.locator('.district-panel h2').innerText() : '-'})`);
    await page.screenshot({ path: `${out}/city-${name}-2-arrived.png` });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(600);
    report.push(`${name} approach card: ${(await page.locator('.gate-prompt').isVisible()) ? (await page.locator('.gate-prompt').innerText()).replace(/\n/g, ' | ') : 'not shown'}`);
    await page.screenshot({ path: `${out}/city-${name}-3-gate.png` });
    // Click on an empty street to move.
    const box = await page.locator('.hub-canvas').boundingBox();
    await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.85);
    await page.waitForTimeout(1500);
    // Flat map and back.
    await page.getByRole('button', { name: 'Districts ▾' }).click();
    await page.getByRole('menuitem', { name: /flat map/ }).click();
    await page.waitForTimeout(800);
    const flat = await page.locator('.hub-canvas:not(.is-3d)').isVisible();
    await page.screenshot({ path: `${out}/city-${name}-4-flat.png` });
    await page.getByRole('button', { name: 'Districts ▾' }).click();
    await page.getByRole('menuitem', { name: /3D city/ }).click();
    const back = await page.waitForSelector('.hub-canvas.is-3d', { timeout: 10000 }).then(() => true, () => false);
    report.push(`${name} flat map ${flat}, back to 3D ${back}`);
    // Into a level and back: the city is rebuilt without leaking.
    await page.getByRole('button', { name: 'Play' }).click();
    await page.getByRole('button', { name: 'Skip', exact: true }).click();
    await page.getByRole('button', { name: /Back to the city/ }).click();
    const again = await page.waitForSelector('.hub-canvas.is-3d', { timeout: 10000 }).then(() => true, () => false);
    report.push(`${name} level and back to the city: ${again}`);
  }
  if (name === 'ipad-landscape') {
    // Tap a spot on the road to drive there.
    const box = await page.locator('.hub-canvas').boundingBox();
    await page.touchscreen.tap(box.x + box.width * 0.5, box.y + box.height * 0.3);
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${out}/city-${name}-1-tapped.png` });
  }
  report.push(`${name} errors: ${JSON.stringify(errors)}`);
  await ctx.close();
}
console.log(report.join('\n'));
await browser.close();
