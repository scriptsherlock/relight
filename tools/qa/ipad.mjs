// iPad walkthrough: touch only. Landscape and portrait.
// node tools/qa/ipad.mjs <outDir> [baseUrl]
import { chromium, devices } from '@playwright/test';
const out = process.argv[2] ?? 'qa-shots';
const base = process.argv[3] ?? 'http://127.0.0.1:4180/';
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined });
const ARCADE = 'def on_key(key):\n    if key == "right":\n        bot.move_right()\n    elif key == "left":\n        bot.move_left()\n    elif key == "up":\n        bot.move_up()\n    elif key == "down":\n        bot.move_down()\n\ndef on_collect():\n    game.add_score(1)\n    if bot.cells_left() == 0:\n        game.win("All cells collected!")\n';
const report = [];

for (const orient of ['landscape', 'portrait']) {
  const ctx = await browser.newContext({ ...devices[`iPad (gen 7)${orient === 'landscape' ? ' landscape' : ''}`] });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push('console: ' + m.text()));
  const shot = (n) => page.screenshot({ path: `${out}/ipad-${orient}-${n}.png` });
  const cdp = await ctx.newCDPSession(page);
  const touchDrag = async (sx, sy, tx, ty) => {
    const tp = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
    await tp('touchStart', sx, sy);
    for (let i = 1; i <= 20; i++) {
      await tp('touchMove', sx + ((tx - sx) * i) / 20, sy + ((ty - sy) * i) / 20);
      await page.waitForTimeout(16);
    }
    await tp('touchEnd');
    await page.waitForTimeout(500);
  };
  const tapText = (role, name) => page.getByRole(role, { name }).first().tap();
  const openLevel = async (district, title) => {
    await tapText('button', 'Districts ▾');
    await page.getByRole('menuitem', { name: new RegExp(district) }).tap();
    await page.getByRole('button', { name: new RegExp(title) }).tap();
    await page.waitForTimeout(700);
    await tapText('button', 'Skip');
    await page.waitForTimeout(400);
  };

  await page.goto(base + '#unlock');
  await page.evaluate(() => localStorage.setItem('relight.save.v1', JSON.stringify({ version: 1, name: '', track: 'blocks', seenIntro: true, progress: {}, python: {}, blocks: {}, published: 0, workshop: null })));
  await page.reload();
  await tapText('button', 'Continue');
  await page.waitForTimeout(800);
  report.push(`${orient}: hub tip = ${(await page.locator('.hub-tip p').innerText()).slice(0, 70)}`);
  // tap the map: Kilo should drive
  const c = await page.locator('.hub-canvas').boundingBox();
  await page.touchscreen.tap(c.x + c.width * 0.3, c.y + c.height * 0.75);
  await page.waitForTimeout(1500);
  await shot('01-hub');
  // driving may have reached a gate and opened its panel
  if (await page.locator('.district-panel').isVisible().catch(() => false)) {
    report.push(`${orient}: tapping the map drove Kilo into a district (panel opened)`);
    await page.getByRole('button', { name: 'Close' }).tap();
  }

  // Blocks level: drag a block from the toolbox with a finger
  await openLevel('The Docks', 'Wake Up');
  await page.waitForSelector('.py-status.ready', { timeout: 90000 });
  const count = () => page.evaluate(() => document.querySelectorAll('.blocklySvg .blocklyBlockCanvas g.blocklyBlock').length);
  const before = await count();
  const g = await page.evaluate(() => {
    const a = document.querySelector('.blocklyFlyout .blocklyBlockCanvas > g > .blocklyPath').getBoundingClientRect();
    const w = document.querySelector('.blocklySvg').getBoundingClientRect();
    return { sx: a.x + 12, sy: a.y + a.height / 2, tx: w.x + w.width * 0.65, ty: w.y + w.height * 0.75 };
  });
  await touchDrag(g.sx, g.sy, g.tx, g.ty);
  report.push(`${orient}: blocks touch drag ${before} -> ${await count()} blocks`);
  await shot('02-blocks');
  await tapText('button', '▶ Run');
  await page.waitForTimeout(3000);
  await shot('03-blocks-run');
  await tapText('button', /Back to the city/);
  await page.waitForTimeout(400);

  // Arcade with the on-screen pad
  await openLevel('The Arcade', 'Take the Controls');
  await page.locator('.track-toggle button', { hasText: 'Python' }).tap();
  await page.locator('.cm-content').tap();
  await page.keyboard.press('Control+A');
  await page.keyboard.insertText(ARCADE);
  await page.getByRole('button', { name: '▶ Build & play' }).tap();
  await page.waitForTimeout(1500);
  const pad = { L: '.pad-left', R: '.pad-right', U: '.pad-up', D: '.pad-down' };
  let n = 0;
  for (const k of 'L3 U2 D4 R3 U2 R5 U2 D4'.split(' ')) {
    for (let i = 0; i < Number(k.slice(1)); i++) {
      await page.locator(pad[k[0]]).tap();
      await page.waitForTimeout(150);
    }
    if (++n === 4) await shot('04-arcade-live');
  }
  await page.waitForTimeout(2200);
  const won = await page.locator('.result-card').isVisible().catch(() => false);
  report.push(`${orient}: arcade won with touch pad = ${won}`);
  await shot('05-arcade-result');
  if (won) await page.getByRole('button', { name: 'City map' }).tap();
  else await tapText('button', /Back to the city/);
  await page.waitForTimeout(400);

  // Workshop: paint with a finger
  await tapText('button', 'Workshop');
  await page.waitForTimeout(700);
  await page.getByRole('button', { name: 'Wall' }).tap();
  const b = await page.locator('.ws-map .stage-wrap').boundingBox();
  const rowsBefore = await page.evaluate(() => JSON.parse(localStorage.getItem('relight.save.v1')).workshop?.rows?.join('') ?? '');
  await touchDrag(b.x + b.width * 0.45, b.y + b.height * 0.3, b.x + b.width * 0.45, b.y + b.height * 0.7);
  await page.waitForTimeout(500);
  const rowsAfter = await page.evaluate(() => JSON.parse(localStorage.getItem('relight.save.v1')).workshop?.rows?.join('') ?? '');
  report.push(`${orient}: workshop finger paint changed map = ${rowsBefore !== rowsAfter}`);
  await shot('06-workshop');
  report.push(`${orient}: errors ${JSON.stringify(errors)}`);
  await ctx.close();
}
console.log(report.join('\n'));
await browser.close();
