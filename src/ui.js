// ===== IRONSHIFT UI =====
const $ = id => document.getElementById(id);
const UI = {
  queue: [], talking: false, talkT: 0, onDone: null, toastT: 0, mapOpen: false,
  init() {
    $('dialog').addEventListener('click', () => this.advance());
    $('dialog').addEventListener('touchstart', e => { e.preventDefault(); this.advance(); }, { passive: false });
    $('minimap').addEventListener('click', () => this.toggleMap());
    $('minimap').addEventListener('touchstart', e => { e.preventDefault(); this.toggleMap(); }, { passive: false });
    $('mapView').addEventListener('click', () => this.toggleMap());
    $('btnPause').addEventListener('click', () => Game.togglePause());
    $('btnPause').addEventListener('touchstart', e => { e.preventDefault(); Game.togglePause(); }, { passive: false });
    this.mm = $('minimap').getContext('2d');
  },
  say(lines, done) { for (const l of lines) this.queue.push({ who: l[0], text: l[1] }); if (done) this.queue.push({ done }); if (!this.talking) this.advance(); },
  advance() {
    const n = this.queue.shift();
    if (!n) { this.talking = false; $('dialog').style.display = 'none'; return; }
    if (n.done) { n.done(); return this.advance(); }
    this.talking = true; this.talkT = Math.max(3.2, n.text.length * 0.055); this.typed = 0; this.full = n.text;
    $('dialog').style.display = 'block'; $('dlgName').textContent = n.who.name; $('dlgName').style.color = n.who.color; $('dlgText').textContent = ''; $('dialog').style.borderColor = n.who.color;
    Audio_.ui();
  },
  setObjective(t) { if (this._obj !== t) { this._obj = t; $('objText').textContent = t; } },
  chapter(c) { const el = $('chapter'); el.innerHTML = '<small>' + c[0] + '</small>' + c[1]; el.classList.remove('show'); void el.offsetWidth; el.classList.add('show'); },
  toast(a, b) { $('toast').innerHTML = '<b>' + a + '</b>' + (b ? '<br><span>' + b + '</span>' : ''); $('toast').style.opacity = 1; this.toastT = 3.5; },
  hint(id) { const el = $(id); el.classList.add('hint'); setTimeout(() => el.classList.remove('hint'), 6000); },
  flash() { const f = $('flash'); f.style.opacity = 0.45; },
  bossBar(on) { $('boss').style.display = on ? 'block' : 'none'; },
  bossHp(k) { $('bossFill').style.width = (k * 100) + '%'; },
  showDeath() { setTimeout(() => { $('death').style.display = 'flex'; }, 1200); },
  showEnding() {
    const s = Game.save;
    $('endStats').innerHTML = 'Rustborn destroyed: ' + s.kills + '<br>Spark Shards: ' + s.shards.length + '/' + SHARD_SPOTS.length + '<br>Camps cleared: ' + Object.keys(s.camps).length + '/' + CAMPS.length + '<br>Races run: ' + Object.keys(s.races).length + '/' + RACES.length;
    $('ending').style.display = 'flex'; Game.paused = true;
  },
  openShop() {
    Game.paused = true; const s = Game.save; let h = '<h2>HAVEN GARAGE</h2><div class="scrap">Scrap: ' + s.scrap + '</div>';
    for (const u of UPGRADES) { const l = s.up[u.id]; const c = upCost(l); h += '<div class="uprow"><div><b>' + u.name + '</b> <span class="lv">' + '■'.repeat(l) + '□'.repeat(5 - l) + '</span><br><small>' + u.desc + '</small></div>' + (l >= 5 ? '<button disabled>MAX</button>' : '<button onclick="Shop.buy(\'' + u.id + '\')" ' + (s.scrap < c ? 'class="poor"' : '') + '>' + c + '</button>') + '</div>'; }
    h += '<button class="close" onclick="UI.closeShop()">DONE</button>';
    $('shop').innerHTML = h; $('shop').style.display = 'block';
  },
  closeShop() { $('shop').style.display = 'none'; Game.paused = false; },
  toggleMap() {
    if (Game.state !== 'play') return;
    this.mapOpen = !this.mapOpen; $('mapView').style.display = this.mapOpen ? 'flex' : 'none';
    if (this.mapOpen) this.drawBigMap();
  },
  update(dt) {
    const P = Game.player, s = Game.save;
    $('hpFill').style.width = (P.hp / P.maxHp * 100) + '%';
    $('enFill').style.width = P.energy + '%';
    $('scrap').textContent = '⚙ ' + s.scrap + '   ◆ ' + s.shards.length + '/' + SHARD_SPOTS.length;
    const z = zoneOf(P.pos.x, P.pos.z); if (z !== this._zone) { this._zone = z; $('zone').textContent = z.toUpperCase(); $('zone').classList.remove('show'); void $('zone').offsetWidth; $('zone').classList.add('show'); }
    if (this.talking) {
      this.typed += dt * 60; $('dlgText').textContent = this.full.slice(0, this.typed | 0);
      this.talkT -= dt; if (this.talkT <= 0) this.advance();
    }
    if (this.toastT > 0) { this.toastT -= dt; if (this.toastT <= 0) $('toast').style.opacity = 0; }
    const f = $('flash'); const o = parseFloat(f.style.opacity || 0); if (o > 0) f.style.opacity = Math.max(0, o - dt * 2);
    const wp = Story.waypoint();
    if (wp) { const d = Math.hypot(wp.x - P.pos.x, wp.z - P.pos.z); $('wpDist').textContent = d > 1000 ? (d / 1000).toFixed(1) + ' km' : Math.round(d) + ' m'; } else $('wpDist').textContent = '';
    $('speed').textContent = P.mode === 'car' ? Math.round(Math.abs(P.speed) * 3.6) + ' km/h' : '';
    $('btnBoost').textContent = P.mode === 'car' ? 'BOOST' : 'DASH';
    this.drawMini();
  },
  setAct(a) { const b = $('btnAct'); if (a) { b.style.display = 'flex'; b.textContent = a.label; this._act = a; } else { b.style.display = 'none'; this._act = null; } },
  drawMini() {
    const g = this.mm, W = 150, C = W / 2, P = Game.player, cam = Game.cam; const sc = C / 260;
    const sy = Math.sin(cam.yaw), cy = Math.cos(cam.yaw);
    const M = (x, z) => { const dx = x - P.pos.x, dz = z - P.pos.z; return [C + (-dx * cy + dz * sy) * sc, C - (dx * sy + dz * cy) * sc]; };
    g.clearRect(0, 0, W, W); g.save(); g.beginPath(); g.arc(C, C, C - 2, 0, TAU); g.clip();
    g.fillStyle = 'rgba(10,20,30,0.75)'; g.fillRect(0, 0, W, W);
    g.strokeStyle = 'rgba(200,200,200,0.5)'; g.lineWidth = 3;
    for (const s of World.roadSegs) { const a = M(s.ax, s.az), b = M(s.bx, s.bz); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); }
    const h0 = M(0, 0); g.strokeStyle = 'rgba(95,246,255,0.5)'; g.lineWidth = 1; g.beginPath(); g.arc(h0[0], h0[1], 300 * sc, 0, TAU); g.stroke();
    const dot = (x, z, col, r) => { const q = M(x, z); g.fillStyle = col; g.beginPath(); g.arc(q[0], q[1], r, 0, TAU); g.fill(); };
    if (Story.step >= 5) dot(LOC.garage.x, LOC.garage.z, '#ffa53a', 4);
    if (Story.step >= 9) for (const r of RACES) dot(r.start[0], r.start[1], '#ff3ad0', 4);
    for (const p of Pickups.list) if (p.kind === 'shard' && dist2(p.m.position.x, p.m.position.z, P.pos.x, P.pos.z) < 160 * 160) dot(p.m.position.x, p.m.position.z, '#5ff6ff', 3);
    for (const e of Enemies.list) if (!e.dead && dist2(e.pos.x, e.pos.z, P.pos.x, P.pos.z) < 300 * 300) dot(e.pos.x, e.pos.z, '#ff4040', e.type === 'boss' ? 6 : 2.5);
    g.restore();
    const wp = Story.waypoint();
    if (wp) { const q = M(wp.x, wp.z); let rx = q[0] - C, rz = q[1] - C; const l = Math.hypot(rx, rz); const k = l > C - 8 ? (C - 8) / l : 1; g.fillStyle = '#ffc23a'; g.beginPath(); g.arc(C + rx * k, C + rz * k, 5, 0, TAU); g.fill(); }
    g.save(); g.translate(C, C); g.rotate(cam.yaw - P.yaw); g.fillStyle = '#fff'; g.beginPath(); g.moveTo(0, -8); g.lineTo(5, 6); g.lineTo(0, 3); g.lineTo(-5, 6); g.closePath(); g.fill(); g.restore();
    g.strokeStyle = 'rgba(95,246,255,0.8)'; g.lineWidth = 2; g.beginPath(); g.arc(C, C, C - 2, 0, TAU); g.stroke();
  },
  drawBigMap() {
    const cv = $('bigmap'); const S = Math.min(innerWidth, innerHeight) * 0.92 | 0; cv.width = cv.height = S; const g = cv.getContext('2d');
    const k = S / 2000; const X = x => (1000 - x) * k, Z = z => (1000 - z) * k;
    const img = g.createImageData(S, S); const step = 2000 / S;
    for (let j = 0; j < S; j += 4) for (let i = 0; i < S; i += 4) {
      const x = 1000 - i * step, z = 1000 - j * step; const zn = zoneOf(x, z); const h = terrainHeight(x, z);
      let c = zn === 'Haven' ? [90, 96, 104] : zn === 'Rustveil Canyon' ? [170, 120, 70] : (zn === 'The Foundry' || zn === 'Scrapyard 9') ? [60, 55, 55] : [70, 110, 55];
      if (h < -12) c = [40, 100, 150]; if (h > 70) c = [130, 125, 120];
      const sh = clamp(1 + h / 300, 0.6, 1.4);
      for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) { const o = ((j + b) * S + (i + a)) * 4; if (o >= img.data.length) continue; img.data[o] = c[0] * sh; img.data[o + 1] = c[1] * sh; img.data[o + 2] = c[2] * sh; img.data[o + 3] = 255; }
    }
    g.putImageData(img, 0, 0);
    g.strokeStyle = '#ddd'; g.lineWidth = 2; for (const s of World.roadSegs) { g.beginPath(); g.moveTo(X(s.ax), Z(s.az)); g.lineTo(X(s.bx), Z(s.bz)); g.stroke(); }
    g.font = 'bold ' + Math.max(10, S / 50 | 0) + 'px sans-serif'; g.textAlign = 'center';
    for (const key of ['scrapyard', 'haven', 'relay', 'outpost', 'foundry', 'forest', 'ruins']) { const L = LOC[key]; g.fillStyle = '#000a'; g.fillText(L.name, X(L.x) + 1, Z(L.z) - 9); g.fillStyle = '#fff'; g.fillText(L.name, X(L.x), Z(L.z) - 10); g.beginPath(); g.arc(X(L.x), Z(L.z), 4, 0, TAU); g.fill(); }
    if (Story.step >= 9) for (const r of RACES) { g.fillStyle = '#ff3ad0'; g.beginPath(); g.arc(X(r.start[0]), Z(r.start[1]), 6, 0, TAU); g.fill(); }
    for (const c of CAMPS) if (!Game.save.camps[c.id] && Story.step >= 4) { g.fillStyle = '#ff4040'; g.fillRect(X(c.x) - 4, Z(c.z) - 4, 8, 8); }
    const wp = Story.waypoint(); if (wp) { g.fillStyle = '#ffc23a'; g.beginPath(); g.arc(X(wp.x), Z(wp.z), 8, 0, TAU); g.fill(); }
    const P = Game.player; g.save(); g.translate(X(P.pos.x), Z(P.pos.z)); g.rotate(-P.yaw); g.fillStyle = '#fff'; g.strokeStyle = '#000'; g.beginPath(); g.moveTo(0, -10); g.lineTo(7, 8); g.lineTo(-7, 8); g.closePath(); g.fill(); g.stroke(); g.restore();
    // map is drawn north=+z down; flip vertically & horizontally so it matches minimap orientation with camera at yaw=PI
  },
};
