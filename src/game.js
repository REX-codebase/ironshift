// ===== IRONSHIFT main =====
const DEFAULT_SAVE = () => ({ v: 1, step: 0, scrap: 0, kills: 0, shards: [], camps: {}, races: {}, up: { armor: 0, blaster: 0, engine: 0, cell: 0 }, pos: null, beaten: false, quality: 1, storyShards: 0 });
const Game = {
  state: 'title', paused: false, time: 0, shake: 0, godMode: false,
  cam: { yaw: 0, pitch: 0.25, dist: 15, lastLook: 0 },
  init() {
    const cv = $('game');
    this.renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: false, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(65, innerWidth / innerHeight, 0.5, 2200);
    this.loadSave();
    this.applyQuality();
    addEventListener('resize', () => this.resize()); this.resize();
    World.build(this.scene); FX.init(this.scene); Shots.init(this.scene); Pickups.init(this.scene);
    this.player = new Player(this.scene);
    Story.init(this.scene);
    Input.init(); UI.init();
    document.addEventListener('visibilitychange', () => { if (document.hidden && this.state === 'play' && !this.paused) this.togglePause(); });
    $('btnNew').onclick = () => { Audio_.unlock(); this.save = DEFAULT_SAVE(); this.startGame(); };
    $('btnCont').onclick = () => { Audio_.unlock(); this.startGame(); };
    if (!this.hasSave) $('btnCont').style.display = 'none';
    $('btnResume').onclick = () => this.togglePause();
    $('btnMap').onclick = () => { this.togglePause(); UI.toggleMap(); };
    $('btnQual').onclick = () => { this.save.quality = (this.save.quality + 1) % 3; this.applyQuality(); this.resize(); this.saveGame(); };
    $('btnSnd').onclick = () => { Audio_.enabled = !Audio_.enabled; if (Audio_.master) Audio_.master.gain.value = Audio_.enabled ? 0.5 : 0; $('btnSnd').textContent = 'SOUND: ' + (Audio_.enabled ? 'ON' : 'OFF'); };
    $('btnTitle').onclick = () => { this.saveGame(); location.reload(); };
    $('btnRespawn').onclick = () => { $('death').style.display = 'none'; const r = Story.respawnPoint(); this.player.respawn(r); Shots.clear(); };
    $('btnEndOk').onclick = () => { $('ending').style.display = 'none'; this.paused = false; };
    $('loading').style.display = 'none'; $('title').style.display = 'flex';
    this.last = performance.now(); requestAnimationFrame(t => this.loop(t));
    // title camera orbit
    window.__ironshift = this;
  },
  applyQuality() {
    const q = this.save.quality; const dpr = Math.min(devicePixelRatio || 1, 2);
    this.renderer.setPixelRatio([0.6, 0.85, 1.25][q] * dpr > 2 ? 2 : [0.6, 0.85, 1.25][q] * dpr);
    this.camera.far = [900, 1500, 2200][q]; if (this.scene.fog) this.scene.fog.far = [600, 900, 1300][q]; this.camera.updateProjectionMatrix();
    $('btnQual').textContent = 'GRAPHICS: ' + ['LOW', 'MEDIUM', 'HIGH'][q];
  },
  resize() { this.renderer.setSize(innerWidth, innerHeight, false); this.camera.aspect = innerWidth / innerHeight; this.camera.updateProjectionMatrix(); },
  loadSave() {
    try { const s = JSON.parse(localStorage.getItem('ironshift_save')); if (s && s.v === 1) { this.save = Object.assign(DEFAULT_SAVE(), s); this.hasSave = true; return; } } catch (e) { }
    this.save = DEFAULT_SAVE(); this.hasSave = false;
  },
  saveGame() { try { const P = this.player; if (P && !P.dead) this.save.pos = { x: P.pos.x, z: P.pos.z }; localStorage.setItem('ironshift_save', JSON.stringify(this.save)); } catch (e) { } },
  startGame() {
    $('title').style.display = 'none'; $('hud').style.display = 'block'; $('controls').style.display = 'block';
    this.state = 'play';
    const s = this.save; const P = this.player;
    // free-roam shards
    SHARD_SPOTS.forEach((p, i) => { if (!s.shards.includes(i)) Pickups.add('shard', p[0], Math.max(terrainHeight(p[0], p[1]), -11) + 3, p[1], { id: i }); });
    if (s.step >= 8) World.shield.visible = true;
    if (s.step >= 15) { const sk = Story.npcs.seeker; const x = LOC.foundry.x + 20, z = LOC.foundry.z + 30; sk.root.visible = true; sk.root.position.set(x, terrainHeight(x, z), z); World.foundryCore.material.color.setHex(0x55d6ff); }
    if (s.pos && s.step > 0) { const r = s.step >= 13 && s.step < 14 ? Story.respawnPoint() : s.pos; P.respawn(r); } else P.respawn({ x: LOC.scrapyard.x + 10, z: LOC.scrapyard.z - 10 });
    this.cam.yaw = Math.atan2(LOC.scrapyard.x + 30 - P.pos.x, LOC.scrapyard.z + 30 - P.pos.z); P.yaw = this.cam.yaw;
    Story.start(Math.min(s.step, STEPS.length - 1));
    setInterval(() => { if (this.state === 'play' && !this.paused) this.saveGame(); }, 15000);
  },
  togglePause() {
    if (this.state !== 'play') return;
    if ($('shop').style.display === 'block') { UI.closeShop(); return; }
    if (UI.mapOpen) { UI.toggleMap(); return; }
    this.paused = !this.paused; $('pause').style.display = this.paused ? 'flex' : 'none';
    if (this.paused) { this.saveGame(); Audio_.setEngine(false, 0); }
  },
  updateCamera(dt) {
    const c = this.cam, P = this.player;
    if (Input.lookDX || Input.lookDY) { c.yaw -= Input.lookDX * (Input.touchMode ? 0.0065 : 0.003); c.pitch = clamp(c.pitch + Input.lookDY * (Input.touchMode ? 0.005 : 0.0025), -0.35, 1.1); c.lastLook = this.time; }
    const inCar = P.rig.t > 0.5;
    if (inCar && this.time - c.lastLook > 1.2 && Math.abs(P.speed) > 6) { c.yaw += angleDiff(c.yaw, P.speed > 0 ? P.heading : P.heading + Math.PI) * Math.min(1, dt * 2.5); c.pitch = damp(c.pitch, 0.22, 1.5, dt); }
    const dist = inCar ? 17 + Math.abs(P.speed) * 0.05 : 15; const hOff = inCar ? 3.5 : 6.5;
    c.dist = damp(c.dist, dist, 4, dt);
    const fx = Math.sin(c.yaw), fz = Math.cos(c.yaw);
    const tgt = _tmp.set(P.pos.x, P.pos.y + hOff, P.pos.z);
    const cp = Math.cos(c.pitch), sp = Math.sin(c.pitch);
    let cx = tgt.x - fx * c.dist * cp, cy = tgt.y + c.dist * sp, cz = tgt.z - fz * c.dist * cp;
    const gy = terrainHeight(cx, cz) + 1.5; if (cy < gy) cy = gy;
    // smooth
    if (!this._cpos) this._cpos = new THREE.Vector3(cx, cy, cz);
    this._cpos.set(cx, cy, cz);
    this.camera.position.copy(this._cpos);
    if (this.shake > 0) { this.camera.position.x += rand(-1, 1) * this.shake; this.camera.position.y += rand(-1, 1) * this.shake; this.shake = Math.max(0, this.shake - dt * 2.5); }
    this.camera.lookAt(tgt.x, tgt.y + (inCar ? 1 : 0), tgt.z);
    const fov = 65 + (inCar ? clamp(Math.abs(P.speed) - 40, 0, 50) * 0.25 : 0);
    if (Math.abs(this.camera.fov - fov) > 0.1) { this.camera.fov = damp(this.camera.fov, fov, 3, dt); this.camera.updateProjectionMatrix(); }
  },
  loop(now) {
    requestAnimationFrame(t => this.loop(t));
    let dt = Math.min(0.05, (now - this.last) / 1000); this.last = now;
    if (this.state === 'title') {
      this.time += dt; const a = this.time * 0.05;
      this.camera.position.set(Math.cos(a) * 140, 60, Math.sin(a) * 140); this.camera.lookAt(0, 20, 0);
      World.updateSky(0, this.camera.position); World.update(dt, this.time);
      this.renderer.render(this.scene, this.camera); return;
    }
    if (this.paused) { Input.endFrame(); this.renderer.render(this.scene, this.camera); return; }
    this.time += dt;
    Input.poll();
    const P = this.player;
    P.update(dt, this.cam);
    Enemies.update(dt); Shots.update(dt); Pickups.update(dt); FX.update(dt);
    Camps.update(); Story.update(dt);
    const act = Race.update(dt) || Shop.check(); UI.setAct(act);
    if (Input.interactPressed && act) act.fn();
    this.updateCamera(dt);
    World.updateSky(dt, P.pos); World.update(dt, this.time);
    UI.update(dt);
    Input.endFrame();
    this.renderer.render(this.scene, this.camera);
    this.frames = (this.frames || 0) + 1;
  }
};
window.addEventListener('load', () => { try { Game.init(); } catch (e) { $('loading').textContent = 'Error: ' + e.message; console.error(e); } });
// Android back button hook (called from Java)
window.onAndroidBack = () => { if (Game.state === 'play') Game.togglePause(); return true; };
