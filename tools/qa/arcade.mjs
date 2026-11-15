// Arcade rules in the real app (Pyodide): exit wins via on_exit, glitches path
// round blocks, and the exit-check-in-on_collect mistake gets a warning.
// node tools/qa/arcade.mjs <outDir>
import { chromium } from '@playwright/test';
const out = process.argv[2] ?? 'qa-shots';
const base = process.argv[3] ?? 'http://127.0.0.1:4180/';
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined });
const report = [];

const KEYS = `def on_key(key):
    if key == "up":
        bot.move_up()
    elif key == "down":
        bot.move_down()
    elif key == "left":
        bot.move_left()
    elif key == "right":
        bot.move_right()
`;

async function play(name, rows, code, act) {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(base);
  await page.evaluate(
    ([rows, code]) =>
      localStorage.setItem('relight.save.v1', JSON.stringify({ version: 1, name: '', track: 'python', seenIntro: true, progress: {}, python: {}, blocks: {}, published: 0,
        workshop: { title: 'QA', message: 'QA', mode: 'arcade', rows, cells: true, code, blocks: null } })),
    [rows, code],
  );
  await page.reload();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: 'Workshop', exact: true }).click();
  const issues = await page.locator('li').allInnerTexts();
  if (issues.length) console.log(name, 'workshop issues:', issues);
  await page.getByRole('button', { name: '▶ Code & playtest' }).click({ timeout: 5000 });
  await page.waitForSelector('.py-status.ready', { timeout: 60000 });
  await page.getByRole('button', { name: '▶ Build & play' }).click();
  await page.waitForTimeout(800);
  await act(page);
  await page.screenshot({ path: `${out}/arcade-${name}.png` });
  const text = await page.locator('body').innerText();
  await ctx.close();
  return { text, errors };
}

// 1. The pupil's own level and code: the warning should appear.
const mine = await play(
  'warning',
  ['############', '#S........##', '#.....C#...#', '#..#.#.....#', '#..#...#.#.#', '#.....#..#.#', '#...#.....E#', '############'],
  `${KEYS}\ndef on_collect():\n    game.add_score(1)\n    if bot.cells_left() == 0 and bot.at_exit():\n        game.win("You win!")\n`,
  async () => {},
);
report.push(`warning shown: ${mine.text.includes('This exit check never runs')}; errors ${JSON.stringify(mine.errors)}`);

// 2. Collect the cell, walk onto the exit: on_exit wins.
const exit = await play(
  'exit-win',
  ['#########', '#S.C.E..#', '#########'],
  `${KEYS}\ndef on_exit():\n    if bot.cells_left() == 0:\n        game.win("Kilo escaped!")\n`,
  async (page) => {
    for (let i = 0; i < 4; i++) {
      await page.keyboard.press('ArrowRight');
      await page.waitForTimeout(200);
    }
    await page.waitForTimeout(1200);
  },
);
report.push(`exit wins: ${exit.text.includes('Kilo escaped!')}; errors ${JSON.stringify(exit.errors)}`);

// 3. Kilo hides behind a block; the glitch must walk round it.
const chase = await play(
  'chase-round-block',
  ['#######', '#C....#', '#S.#.G#', '#.....#', '#######'],
  `${KEYS}\ndef on_tick():\n    for g in game.glitches():\n        g.move_toward_bot()\n`,
  async (page) => {
    await page.waitForTimeout(5000);
  },
);
report.push(`glitch catches Kilo behind a block: ${chase.text.includes('A glitch caught Kilo!')}; errors ${JSON.stringify(chase.errors)}`);

console.log(report.join('\n'));
await browser.close();
