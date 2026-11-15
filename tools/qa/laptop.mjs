// Small-laptop check: nothing cropped, every button reachable, dialogs collapse.
// node tools/qa/laptop.mjs <outDir> [baseUrl]
import { chromium } from '@playwright/test';
const out = process.argv[2] ?? 'qa-shots';
const base = process.argv[3] ?? 'http://127.0.0.1:4180/';
// Browser viewport sizes after the browser's own toolbars.
const SIZES = [
  { name: '1920x1080', width: 1920, height: 960 },
  { name: '1366x768', width: 1366, height: 657 },
  { name: '1280x720', width: 1280, height: 610 },
  { name: '1366x768@125%', width: 1093, height: 520 },
  { name: '1024x600', width: 1024, height: 500 },
];
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined });
const report = [];

// Buttons cut off by the window edge, or squashed so their label doesn't fit.
const clipped = (page) =>
  page.evaluate(() => {
    const bad = [];
    for (const el of document.querySelectorAll('button, .btn, input, select')) {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      if (el.closest('.blocklyFlyout, .district-menu, .cm-editor, [hidden]')) continue;
      const name = (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 24);
      const docW = document.documentElement.scrollWidth;
      const docH = document.documentElement.scrollHeight;
      if (r.right > docW + 1 || r.bottom > docH + 1 || r.left < -1) bad.push(`off-page:${name}`);
      if (el.scrollWidth > el.clientWidth + 2 && el.tagName === 'BUTTON') bad.push(`squashed:${name}`);
    }
    return bad;
  });
const scrolls = (page) => page.evaluate(() => ({ x: document.documentElement.scrollWidth > innerWidth + 1, y: document.documentElement.scrollHeight > innerHeight + 1 }));

for (const sz of SIZES) {
  const ctx = await browser.newContext({ viewport: { width: sz.width, height: sz.height } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  const shot = (n) => page.screenshot({ path: `${out}/laptop-${sz.name.replace('%', 'pc')}-${n}.png` });
  const check = async (where) => {
    const c = await clipped(page);
    const s = await scrolls(page);
    report.push(`${sz.name} ${where}: ${c.length ? 'CLIPPED ' + c.join(', ') : 'ok'}${s.x || s.y ? ` (page scrolls ${s.x ? 'x' : ''}${s.y ? 'y' : ''})` : ''}`);
  };

  await page.goto(base + '#unlock');
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('relight.save.v1', JSON.stringify({ version: 1, name: '', track: 'blocks', seenIntro: true, progress: {}, python: {}, blocks: {}, published: 0, workshop: null }));
  });
  await page.reload();
  await page.waitForTimeout(500);
  await shot('00-title');
  await check('title');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.waitForTimeout(700);
  await shot('01-hub');
  await check('hub');
  await page.getByRole('button', { name: "Hide Director Vance's tip" }).click();
  const tipGone = !(await page.locator('.hub-tip').isVisible());
  await page.getByRole('button', { name: "Show Director Vance's tip" }).click();
  report.push(`${sz.name} hub tip hides and comes back: ${tipGone && (await page.locator('.hub-tip').isVisible())}`);

  await page.getByRole('button', { name: 'Districts ▾' }).click();
  await page.getByRole('menuitem', { name: /The Docks/ }).click();
  await page.getByRole('button', { name: /Wake Up/ }).click();
  await page.waitForTimeout(1500);
  await shot('02-brief');
  await check('briefing');
  await page.getByRole('button', { name: 'Hide', exact: true }).click();
  await page.waitForTimeout(300);
  const chip = await page.locator('.comms-chip').isVisible();
  await shot('03-brief-hidden');
  await page.locator('.comms-chip').click();
  const back = await page.locator('.comms').isVisible();
  report.push(`${sz.name} briefing hides to a tab and reopens: ${chip && back}`);
  await page.getByRole('button', { name: 'Skip', exact: true }).click();
  await page.waitForTimeout(600);
  await page.waitForSelector('.py-status.ready', { timeout: 90000 });
  await shot('04-level-blocks');
  await check('level (blocks)');
  await page.getByRole('button', { name: 'Hint' }).click();
  await page.getByRole('button', { name: 'Hide ▾' }).click();
  await page.getByRole('button', { name: '▶ Run' }).click();
  await page.waitForTimeout(2500);
  const badge = await page.locator('.unread').innerText().catch(() => 'none');
  await shot('05-log-hidden');
  report.push(`${sz.name} log hides; unread badge after run: ${badge}`);
  await page.getByRole('button', { name: 'Show ▸' }).click();

  await page.locator('.track-toggle button', { hasText: 'Python' }).click();
  await page.waitForTimeout(400);
  await shot('06-level-python');
  await check('level (python)');
  await page.getByRole('button', { name: /Back to the city/ }).click();
  await page.waitForTimeout(400);
  await page.getByRole('button', { name: 'Workshop' }).first().click();
  await page.waitForTimeout(700);
  await shot('07-workshop');
  await check('workshop');
  report.push(`${sz.name} errors: ${JSON.stringify(errors)}`);
  await ctx.close();
}
console.log(report.join('\n'));
await browser.close();
