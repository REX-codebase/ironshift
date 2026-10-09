const puppeteer = require('puppeteer-core');
(async () => {
  const b = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/chromium', headless: 'new', args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage(); await p.setViewport({ width: 1280, height: 720 });
  const errs = []; p.on('pageerror', e => errs.push(e.message + ' ' + (e.stack||'').split('\n')[1]));
  await p.goto('file://" + require("path").resolve(__dirname, "../dist/index.html") + "'); await new Promise(r => setTimeout(r, 4000));
  await p.evaluate(() => { document.getElementById('btnNew').click(); Game.godMode = true; });
  const W = s => new Promise(r => setTimeout(r, s * 1000));
  for (let s = 8; s <= 16; s++) {
    await p.evaluate(s => { UI.queue.length = 0; try { Story.start(s); } catch (e) { console.log(e) } }, s); await W(2.5);
    console.log(s, await p.evaluate(() => JSON.stringify({ step: Story.step, obj: UI._obj, alive: Enemies.list.filter(e => !e.dead).length })));
    if (s === 13 || s === 14) await p.evaluate(() => { for (const e of Enemies.list) if (!e.dead) e.damage ? e.damage(1e6) : e.kill(); });
  }
  await W(3); await p.screenshot({ path: '../docs/shots-end.png' });
  await p.evaluate(() => { World.timeOfDay = 0.82; UI.queue.length = 0; document.getElementById('ending').style.display = 'none'; }); await W(2); await p.screenshot({ path: '../docs/shots-night.png' });
  console.log('ERRORS', errs.length, errs.slice(0, 8).join('\n'));
  await b.close();
})();
