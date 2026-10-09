const puppeteer = require('puppeteer-core');
(async () => {
  const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/chromium', headless: 'new', args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'] });
  const page = await browser.newPage(); await page.setViewport({ width: 1280, height: 720 });
  const errs = []; page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message + ' ' + (e.stack||'').split('\n')[1])); page.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()); });
  await page.goto('file://" + require("path").resolve(__dirname, "../dist/index.html") + "', { waitUntil: 'load' });
  await new Promise(r => setTimeout(r, 4000));
  await page.evaluate(() => { localStorage.clear(); document.getElementById('btnNew').click(); Game.godMode = true; });
  const W = s => new Promise(r => setTimeout(r, s * 1000));
  const st = async l => console.log(l, await page.evaluate(() => JSON.stringify({ step: Story.step, obj: UI._obj, alive: Enemies.list.filter(e => !e.dead).length, scrap: Game.save.scrap })));
  const tp = (x, z) => page.evaluate(({ x, z }) => { const P = Game.player; P.pos.set(x, terrainHeight(x, z) + 1, z); P.vel.set(0, 0, 0); P.speed = 0; UI.queue.length = 0; if (UI.talking) UI.advance(); }, { x, z });
  const killAll = () => page.evaluate(() => { for (const e of Enemies.list) if (!e.dead) e.kill(); });
  await W(1); await tp(-590, 550); await W(1.5); await st('after beacon');
  await page.evaluate(() => Game.player.toggleMode()); await W(1.5); await st('after shift');
  await page.evaluate(() => tpGate = 1); await tp(...await page.evaluate(() => [GATE.x, GATE.z])); await W(1.5); await st('after gate');
  await killAll(); await W(1.5); await st('after drones');
  await tp(0, 30); await W(1.5); await st('after haven');
  await tp(0, -15); await W(1.5); await st('after elder');
  for (const p of [[170, 150], [-210, -80], [80, -250]]) { await tp(p[0], p[1]); await W(1.2); }
  await st('after shards');
  await tp(0, -15); await W(1.5); await st('after return');
  for (let w = 0; w < 3; w++) { await W(7); await st('wave' + w); await killAll(); }
  await W(5); await st('after raid');
  await tp(690, -460); await W(1.5); await st('at relay');
  await killAll(); await W(1.5); await st('relay cleared');
  await tp(690, -510); await W(11); await st('relay held');
  await page.evaluate(() => { UI.queue.length = 0; UI.advance(); }); await W(1); await page.evaluate(() => { while (UI.queue.length) UI.advance(); UI.advance(); }); await W(1); await st('race start');
  for (const c of [[450, -470], [150, -420], [-200, -460], [-525, -500]]) { await tp(c[0], c[1]); await W(1); }
  await st('race done');
  await W(2); await page.screenshot({ path: '../docs/shots-boss2.png' });
  await page.evaluate(() => { const b = Enemies.list.find(e => e.type === 'boss'); b.damage(1000); }); await W(1); await page.evaluate(() => { const b = Enemies.list.find(e => e.type === 'boss'); b.damage(1000); }); await W(2);
  await page.evaluate(() => { const b = Enemies.list.find(e => e.type === 'boss'); b.damage(1e5); }); await W(2); await st('boss dead');
  await tp(-540, -610); await W(2); await st('seeker');
  await page.evaluate(() => { UI.queue.length = 0; UI.advance(); }); await W(1);
  await page.evaluate(() => { while (UI.queue.length) UI.advance(); }); await W(1); await page.screenshot({ path: '../docs/shots-ending.png' });
  console.log('ending visible', await page.evaluate(() => getComputedStyle(document.getElementById('ending')).display));
  await page.evaluate(() => { document.getElementById('btnEndOk').click(); });
  // race side quest
  await tp(40, 70); await W(1); console.log('act', await page.evaluate(() => UI._act && UI._act.label));
  await page.evaluate(() => { Input.interactPressed = true; }); await W(0.5); await st('race1');
  await page.evaluate(() => { Game.save.scrap = 900; }); await tp(52, 38); await W(1); console.log('act2', await page.evaluate(() => UI._act && UI._act.label));
  await page.evaluate(() => { Race.active = null; UI.openShop(); Shop.buy('blaster'); Shop.buy('engine'); }); await W(0.5); await page.screenshot({ path: '../docs/shots-shop.png' });
  await page.evaluate(() => UI.closeShop());
  await page.evaluate(() => { World.timeOfDay = 0.8; Game.player.toggleMode(); Game.cam.pitch = 0.1; }); await W(2); await page.screenshot({ path: '../docs/shots-night.png' });
  await page.evaluate(() => { UI.toggleMap(); }); await W(2); await page.screenshot({ path: '../docs/shots-map.png' });
  console.log('save', await page.evaluate(() => localStorage.getItem('ironshift_save').slice(0, 200)));
  console.log('ERRORS', errs.length, errs.slice(0, 10).join('\n'));
  await browser.close();
})();
