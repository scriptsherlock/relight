// The Foundry in the real app: every level in Python, the "use the idea"
// check, and the new blocks (functions, variables, repeat while) generating
// code that wins. Set CHROME to a Chromium path if Playwright's own is missing.
// node tools/qa/foundry.mjs <outDir> [baseUrl]
import { chromium } from '@playwright/test';
const out = process.argv[2] ?? 'qa-shots';
const base = process.argv[3] ?? 'http://127.0.0.1:4180/';
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined });
const report = [];

const SOLUTIONS = {
  'Your Own Command':
    'def grab():\n    bot.zap("up")\n    bot.move_up(2)\n    bot.move_down(2)\n\nbot.move_right()\ngrab()\nbot.move_right(3)\ngrab()\nbot.move_right(4)\ngrab()\nbot.move_right(3)\ngrab()\nbot.move_right()\n',
  'Give It an Input': 'def clear(n):\n    bot.move_right(n)\n    bot.zap("right")\n    bot.move_right()\n\nclear(2)\nclear(4)\nclear(1)\nclear(4)\nbot.move_right(2)\n',
  'Growing Stairs': 'steps = 1\nfor i in range(4):\n    bot.move_right(steps)\n    bot.move_down()\n    steps = steps + 1\n',
  'Sawtooth Ridge': 'for t in range(3):\n    for i in range(3):\n        bot.move_up()\n        bot.move_right()\n    for i in range(3):\n        bot.move_down()\n        bot.move_right()\n',
  'Wall Runner':
    'def run_right():\n    while bot.look("right") != "wall":\n        bot.move_right()\n\ndef run_down():\n    while bot.look("down") != "wall":\n        bot.move_down()\n\nwhile not bot.at_exit():\n    run_right()\n    run_down()\n',
  'The Foundry Core':
    'def check_up():\n    if bot.look("up") == "cell":\n        bot.move_up()\n        bot.move_down()\n\ndef check_down():\n    if bot.look("down") == "cell":\n        bot.move_down()\n        bot.move_up()\n\nwhile not bot.at_exit():\n    check_up()\n    check_down()\n    if bot.look("right") == "glitch":\n        bot.zap("right")\n    bot.move_right()\n',
};

// Blocks that a pupil could build, saved as Blockly JSON. Note the function
// is placed BELOW its use, to prove definitions are moved to the top.
const mv = (dir, n = 1, next) => ({ type: 'kilo_move', fields: { DIR: dir, N: n }, ...(next ? { next: { block: next } } : {}) });
const chain = (...bs) => bs.reduceRight((next, b) => ({ ...b, ...(next ? { next: { block: next } } : {}) }), null);
const call = (name) => ({ type: 'fn_call', fields: { NAME: name } });
const BLOCKS = {
  'Your Own Command': [
    { x: 30, y: 30, ...chain(mv('right'), call('grab'), mv('right', 3), call('grab'), mv('right', 4), call('grab'), mv('right', 3), call('grab'), mv('right')) },
    {
      x: 30, y: 600, type: 'fn_def', fields: { NAME: 'Grab', PARAM: '' },
      inputs: { DO: { block: chain({ type: 'kilo_zap', fields: { DIR: 'up' } }, mv('up', 2), mv('down', 2)) } },
    },
  ],
  'Give It an Input': [
    { x: 30, y: 30, type: 'fn_def', fields: { NAME: 'clear', PARAM: 'n' },
      inputs: { DO: { block: chain({ type: 'kilo_move_var', fields: { DIR: 'right', VAR: 'n' } }, { type: 'kilo_zap', fields: { DIR: 'right' } }, mv('right')) } } },
    { x: 30, y: 300, ...chain(...[2, 4, 1, 4].map((n) => ({ type: 'fn_call_n', fields: { NAME: 'clear', N: n } })), mv('right', 2)) },
  ],
  'Growing Stairs': [
    { x: 30, y: 30, ...chain({ type: 'var_set', fields: { N: 1 } }, {
      type: 'kilo_repeat', fields: { N: 4 },
      inputs: { DO: { block: chain({ type: 'kilo_move_var', fields: { DIR: 'right', VAR: 'steps' } }, mv('down'), { type: 'var_change', fields: { N: 1 } }) } },
    }) },
  ],
  'Wall Runner': [
    { x: 30, y: 30, type: 'kilo_while_exit', inputs: { DO: { block: chain(call('run_right'), call('run_down')) } } },
    ...['right', 'down'].map((d, i) => ({
      x: 30, y: 250 + i * 220, type: 'fn_def', fields: { NAME: `run_${d}`, PARAM: '' },
      inputs: { DO: { block: { type: 'kilo_while', inputs: { COND: { block: { type: 'kilo_look_is', fields: { DIR: d, OP: '!=', THING: 'wall' } } }, DO: { block: mv(d) } } } } },
    })),
  ],
};

async function openLevel(page, title) {
  await page.getByRole('button', { name: 'Districts ▾' }).click();
  await page.getByRole('menuitem', { name: /The Foundry/ }).click();
  await page.getByRole('button', { name: new RegExp(title) }).click();
  await page.getByRole('button', { name: 'Skip', exact: true }).click();
  await page.waitForTimeout(500);
}

async function run(page) {
  await page.getByRole('button', { name: '▶ Run' }).click();
  await page.locator('.speed button', { hasText: '4×' }).click().catch(() => undefined);
  const won = await page.waitForSelector('.result-card', { timeout: 30000 }).then(() => true, () => false);
  return won;
}

async function session(track, blocks = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(base + '#unlock');
  await page.evaluate(([track, blocks]) => localStorage.setItem('relight.save.v1', JSON.stringify({ version: 1, name: '', track, seenIntro: true, progress: {}, python: {}, blocks, published: 0, workshop: null })), [track, blocks]);
  await page.reload();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.waitForTimeout(800);
  return { ctx, page, errors };
}

// ---- Python track: every level, plus the "use the idea" check.
{
  const { ctx, page, errors } = await session('python');
  await page.screenshot({ path: `${out}/foundry-00-hub.png` });
  await page.getByRole('button', { name: 'Districts ▾' }).click();
  await page.getByRole('menuitem', { name: /The Foundry/ }).click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${out}/foundry-01-panel.png` });
  await page.keyboard.press('Escape');
  let first = true;
  for (const [title, code] of Object.entries(SOLUTIONS)) {
    await page.goto(base + '#unlock');
    await page.reload();
    await page.waitForTimeout(600);
    await page.getByRole('button', { name: 'Continue' }).click().catch(() => undefined);
    await page.waitForTimeout(600);
    await openLevel(page, title);
    await page.waitForSelector('.py-status.ready', { timeout: 60000 });
    if (first) {
      await page.screenshot({ path: `${out}/foundry-02-level1.png` });
      // Win without a function: should be told to build one.
      await page.locator('.cm-content').click();
      await page.keyboard.press('Control+A');
      await page.keyboard.insertText('bot.move_right()\nbot.zap("up")\nbot.move_up(2)\nbot.move_down(2)\nbot.move_right(3)\nbot.zap("up")\nbot.move_up(2)\nbot.move_down(2)\nbot.move_right(4)\nbot.zap("up")\nbot.move_up(2)\nbot.move_down(2)\nbot.move_right(3)\nbot.zap("up")\nbot.move_up(2)\nbot.move_down(2)\nbot.move_right()\n');
      await page.getByRole('button', { name: '▶ Run' }).click();
      await page.locator('.speed button', { hasText: '4×' }).click().catch(() => undefined);
      await page.getByText('Nearly there').waitFor({ timeout: 30000 }).catch(() => undefined);
      report.push(`no-function win is held back: ${await page.getByText('Nearly there').isVisible()}, no result card: ${!(await page.locator('.result-card').isVisible())}`);
      await page.screenshot({ path: `${out}/foundry-03-nearly.png` });
      first = false;
    }
    await page.locator('.cm-content').click();
    await page.keyboard.press('Control+A');
    await page.keyboard.insertText(code);
    const won = await run(page);
    report.push(`python ${title}: ${won ? 'won' : 'NOT WON'}`);
    if (title === 'The Foundry Core') await page.screenshot({ path: `${out}/foundry-04-core-won.png` });
  }
  report.push(`python errors: ${JSON.stringify(errors)}`);
  await ctx.close();
}

// ---- Blocks track: functions, variables and repeat-while.
{
  const saved = Object.fromEntries(
    Object.entries(BLOCKS).map(([title, blocks]) => [title, { blocks: { languageVersion: 0, blocks } }]),
  );
  const ids = { 'Your Own Command': 'foundry-1', 'Give It an Input': 'foundry-2', 'Growing Stairs': 'foundry-3', 'Wall Runner': 'foundry-5' };
  const byId = Object.fromEntries(Object.entries(saved).map(([t, s]) => [ids[t], s]));
  const { ctx, page, errors } = await session('blocks', byId);
  for (const title of Object.keys(BLOCKS)) {
    await page.goto(base + '#unlock');
    await page.reload();
    await page.waitForTimeout(600);
    await page.getByRole('button', { name: 'Continue' }).click().catch(() => undefined);
    await page.waitForTimeout(600);
    await openLevel(page, title);
    await page.waitForSelector('.py-status.ready', { timeout: 60000 });
    await page.waitForTimeout(400);
    if (title === 'Wall Runner') await page.screenshot({ path: `${out}/foundry-05-blocks.png` });
    const won = await run(page);
    report.push(`blocks ${title}: ${won ? 'won' : 'NOT WON'}`);
    if (!won) await page.screenshot({ path: `${out}/foundry-fail-${ids[title]}.png` });
  }
  report.push(`blocks errors: ${JSON.stringify(errors)}`);
  await ctx.close();
}

console.log(report.join('\n'));
await browser.close();
