// Blocks track, test maps, arcade with key presses, workshop + share link.
import { chromium } from '@playwright/test';
const out = process.argv[2] ?? 'qa-shots';
const base = process.argv[3] ?? 'http://127.0.0.1:4180/';
const size = { width: Number(process.env.W ?? 1366), height: Number(process.env.H ?? 768) };
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined });
const ctx = await browser.newContext({ viewport: size });
await ctx.grantPermissions(['clipboard-read', 'clipboard-write']);
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => m.type() === 'error' && errors.push('console: ' + m.text()));
const shot = (n) => page.screenshot({ path: `${out}/${size.width}-${n}.png` });
const skipBrief = async () => {
  await page.getByRole('button', { name: 'Skip', exact: true }).click();
  await page.waitForTimeout(400);
};
const openLevel = async (district, title) => {
  await page.getByRole('button', { name: 'Districts ▾' }).click();
  await page.getByRole('menuitem', { name: new RegExp(district) }).click();
  await page.getByRole('button', { name: new RegExp(title) }).click();
  await page.waitForTimeout(800);
};

// fresh save, blocks track, everything unlocked
await page.goto(base + '#unlock');
await page.evaluate(() => localStorage.setItem('relight.save.v1', JSON.stringify({ version: 1, name: '', track: 'blocks', seenIntro: true, progress: {}, python: {}, blocks: {}, published: 0, workshop: null })));
await page.reload();
await page.getByRole('button', { name: 'Continue' }).click();
await page.waitForTimeout(800);

// Blocks: Loop Line 1 (starter has repeat 4 { move right })
await openLevel('Loop Line', 'The Stairway');
await shot('20-brief-loops');
await skipBrief();
await page.waitForSelector('.py-status.ready', { timeout: 60000 });
await shot('21-blocks');
await page.getByRole('button', { name: '▶ Run' }).click();
await page.waitForTimeout(3500);
await shot('22-blocks-run');
// switch to python: blocks become python
await page.locator('.track-toggle button', { hasText: 'Python' }).click();
await page.waitForTimeout(500);
await shot('23-blocks-to-python');
await page.getByRole('button', { name: /Back to the city|City/ }).first().click();
await page.waitForTimeout(500);

// Spires 1 in Python with the solution: watches test maps
await openLevel('Signal Spires', 'Scanner Sweep');
await skipBrief();
await page.locator('.cm-content').click();
await page.keyboard.press('Control+A');
// first a solution that only works on map 1
await page.keyboard.type('bot.move_right()\nbot.zap("right")\nbot.move_right(3)\nbot.zap("right")\nbot.move_right(3)\n');
await page.getByRole('button', { name: '▶ Run' }).click();
await page.waitForTimeout(1200);
await page.locator('.speed button', { hasText: '4×' }).click();
await page.waitForTimeout(4500);
await shot('24-testmaps-fail');
await page.locator('.cm-content').click();
await page.keyboard.press('Control+A');
await page.keyboard.insertText('for i in range(7):\n    if bot.look("right") == "glitch":\n        bot.zap("right")\n    bot.move_right()\n');
await page.getByRole('button', { name: '▶ Run' }).click();
await page.waitForTimeout(1200);
await shot('25-testmaps-run');
await page.waitForTimeout(9000);
await shot('26-testmaps-win');
await page.getByRole('button', { name: 'City map' }).click();
await page.waitForTimeout(400);

// Arcade 1 with solution, play with keys
await openLevel('The Arcade', 'Take the Controls');
await skipBrief();
await page.locator('.cm-content').click();
await page.keyboard.press('Control+A');
await page.keyboard.insertText('def on_key(key):\n    if key == "right":\n        bot.move_right()\n    elif key == "left":\n        bot.move_left()\n    elif key == "up":\n        bot.move_up()\n    elif key == "down":\n        bot.move_down()\n\ndef on_collect():\n    game.add_score(1)\n    if bot.cells_left() == 0:\n        game.win("All cells collected!")\n');
await shot('27-arcade-code');
await page.getByRole('button', { name: '▶ Build & play' }).click();
await page.waitForTimeout(1200);
const seq = 'L3 U2 D4 R3 U2 R5 U2 D4'.split(' ');
const name = { L: 'ArrowLeft', R: 'ArrowRight', U: 'ArrowUp', D: 'ArrowDown' };
let n = 0;
for (const k of seq) {
  for (let i = 0; i < Number(k.slice(1)); i++) {
    await page.keyboard.press(name[k[0]]);
    await page.waitForTimeout(140);
  }
  if (++n === 4) await shot('28-arcade-live');
}
await page.waitForTimeout(2000);
await shot('29-arcade-win');
await page.getByRole('button', { name: /Next level/ }).click();
await page.waitForTimeout(800);
await shot('30-arcade2-brief');
await skipBrief();
await page.getByRole('button', { name: '▶ Build & play' }).click();
await page.waitForTimeout(3000);
await shot('31-arcade2-live');
await page.getByRole('button', { name: '■ Stop' }).click().catch(() => undefined);
await page.getByRole('button', { name: /Back to the city|City/ }).first().click();
await page.waitForTimeout(500);

// Workshop
await page.getByRole('button', { name: 'Workshop' }).first().click();
await page.waitForTimeout(800);
await shot('32-workshop');
// paint a wall line and a cell
const box = await page.locator('.ws-map .stage-wrap').boundingBox();
await page.getByRole('button', { name: 'Wall' }).click();
await page.mouse.move(box.x + box.width * 0.45, box.y + box.height * 0.25);
await page.mouse.down();
await page.mouse.move(box.x + box.width * 0.45, box.y + box.height * 0.7, { steps: 8 });
await page.mouse.up();
await page.getByRole('button', { name: 'Cell' }).click();
await page.mouse.click(box.x + box.width * 0.3, box.y + box.height * 0.6);
await page.waitForTimeout(300);
await shot('33-workshop-painted');
await page.getByRole('button', { name: '▶ Test it with code' }).click();
await page.waitForTimeout(800);
await shot('34-workshop-test');
console.log(JSON.stringify(errors, null, 1));
await browser.close();
