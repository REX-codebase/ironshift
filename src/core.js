// ===== IRONSHIFT core: utils, noise, input, audio =====
'use strict';
const TAU = Math.PI * 2;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
const dist2 = (ax, az, bx, bz) => { const dx = ax - bx, dz = az - bz; return dx * dx + dz * dz; };
function angleDiff(a, b) { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; }
function damp(a, b, k, dt) { return lerp(a, b, 1 - Math.exp(-k * dt)); }

// seeded RNG so the world is identical every launch
function mulberry(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const srand = mulberry(1337);

// value noise
const NOISE_P = new Uint8Array(512);
(function () { const r = mulberry(42); const p = []; for (let i = 0; i < 256; i++) p[i] = i; for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; } for (let i = 0; i < 512; i++) NOISE_P[i] = p[i & 255]; })();
function hash2(x, z) { return NOISE_P[(NOISE_P[x & 255] + z) & 255] / 255; }
function vnoise(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z); const xf = x - xi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  const a = hash2(xi, zi), b = hash2(xi + 1, zi), c = hash2(xi, zi + 1), d = hash2(xi + 1, zi + 1);
  return lerp(lerp(a, b, u), lerp(c, d, u), v);
}
function fbm(x, z, oct) { let s = 0, a = 0.5, f = 1; for (let i = 0; i < oct; i++) { s += vnoise(x * f, z * f) * a; f *= 2; a *= 0.5; } return s; }

// ===== Input =====
const Input = {
  moveX: 0, moveY: 0, lookDX: 0, lookDY: 0,
  fire: false, jumpPressed: false, transformPressed: false, boost: false, interactPressed: false,
  keys: {}, touchMode: false, joyId: null, lookId: null, joyOrigin: { x: 0, y: 0 }, lookLast: { x: 0, y: 0 },
  init() {
    const joyZone = document.getElementById('joyzone');
    const lookZone = document.getElementById('lookzone');
    const knob = document.getElementById('joyknob');
    const base = document.getElementById('joybase');
    const R = 55;
    joyZone.addEventListener('touchstart', e => {
      e.preventDefault(); this.touchMode = true; Audio_.unlock();
      const t = e.changedTouches[0]; this.joyId = t.identifier; this.joyOrigin = { x: t.clientX, y: t.clientY };
      base.style.display = 'block'; base.style.left = (t.clientX - 70) + 'px'; base.style.top = (t.clientY - 70) + 'px';
      knob.style.transform = 'translate(0px,0px)';
    }, { passive: false });
    joyZone.addEventListener('touchmove', e => {
      e.preventDefault();
      for (const t of e.changedTouches) if (t.identifier === this.joyId) {
        let dx = t.clientX - this.joyOrigin.x, dy = t.clientY - this.joyOrigin.y; const l = Math.hypot(dx, dy);
        if (l > R) { dx *= R / l; dy *= R / l; }
        this.moveX = dx / R; this.moveY = -dy / R; knob.style.transform = `translate(${dx}px,${dy}px)`;
      }
    }, { passive: false });
    const joyEnd = e => { for (const t of e.changedTouches) if (t.identifier === this.joyId) { this.joyId = null; this.moveX = 0; this.moveY = 0; base.style.display = 'none'; } };
    joyZone.addEventListener('touchend', joyEnd); joyZone.addEventListener('touchcancel', joyEnd);
    lookZone.addEventListener('touchstart', e => { e.preventDefault(); this.touchMode = true; Audio_.unlock(); const t = e.changedTouches[0]; this.lookId = t.identifier; this.lookLast = { x: t.clientX, y: t.clientY }; }, { passive: false });
    lookZone.addEventListener('touchmove', e => {
      e.preventDefault();
      for (const t of e.changedTouches) if (t.identifier === this.lookId) { this.lookDX += t.clientX - this.lookLast.x; this.lookDY += t.clientY - this.lookLast.y; this.lookLast = { x: t.clientX, y: t.clientY }; }
    }, { passive: false });
    const lookEnd = e => { for (const t of e.changedTouches) if (t.identifier === this.lookId) this.lookId = null; };
    lookZone.addEventListener('touchend', lookEnd); lookZone.addEventListener('touchcancel', lookEnd);

    const btn = (id, down, up) => {
      const el = document.getElementById(id);
      el.addEventListener('touchstart', e => { e.preventDefault(); e.stopPropagation(); Audio_.unlock(); el.classList.add('pressed'); down(); }, { passive: false });
      const u = e => { e.preventDefault(); el.classList.remove('pressed'); up && up(); };
      el.addEventListener('touchend', u, { passive: false }); el.addEventListener('touchcancel', u, { passive: false });
      el.addEventListener('mousedown', e => { e.stopPropagation(); Audio_.unlock(); down(); });
      el.addEventListener('mouseup', e => { up && up(); });
    };
    btn('btnFire', () => this.fire = true, () => this.fire = false);
    btn('btnJump', () => this.jumpPressed = true);
    btn('btnShift', () => this.transformPressed = true);
    btn('btnBoost', () => this.boost = true, () => this.boost = false);
    btn('btnAct', () => this.interactPressed = true);

    // keyboard + mouse (desktop testing)
    addEventListener('keydown', e => {
      this.keys[e.code] = true;
      if (e.code === 'Space') this.jumpPressed = true;
      if (e.code === 'KeyF' || e.code === 'KeyQ') this.transformPressed = true;
      if (e.code === 'KeyE') this.interactPressed = true;
      if (e.code === 'Escape' || e.code === 'KeyP') Game.togglePause();
      if (e.code === 'KeyM') UI.toggleMap();
    });
    addEventListener('keyup', e => { this.keys[e.code] = false; });
    const cv = document.getElementById('game');
    cv.addEventListener('mousedown', e => { Audio_.unlock(); if (e.button === 0) this.fire = true; if (document.pointerLockElement !== cv && Game.state === 'play') cv.requestPointerLock && cv.requestPointerLock(); });
    addEventListener('mouseup', e => { if (e.button === 0) this.fire = false; });
    addEventListener('mousemove', e => { if (document.pointerLockElement === cv) { this.lookDX += e.movementX; this.lookDY += e.movementY; } });
  },
  poll() {
    if (!this.touchMode) {
      let x = 0, y = 0; const k = this.keys;
      if (k.KeyW || k.ArrowUp) y += 1; if (k.KeyS || k.ArrowDown) y -= 1; if (k.KeyA || k.ArrowLeft) x -= 1; if (k.KeyD || k.ArrowRight) x += 1;
      if (this.joyId === null) { this.moveX = x; this.moveY = y; }
      this.boost = !!(k.ShiftLeft || k.ShiftRight) || this.boost && false;
    }
  },
  endFrame() { this.lookDX = 0; this.lookDY = 0; this.jumpPressed = false; this.transformPressed = false; this.interactPressed = false; }
};

// ===== Audio (all synthesized, no files) =====
const Audio_ = {
  ctx: null, master: null, engineOsc: null, engineGain: null, musicGain: null, enabled: true,
  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain(); this.master.gain.value = 0.5; this.master.connect(this.ctx.destination);
      // engine
      this.engineOsc = this.ctx.createOscillator(); this.engineOsc.type = 'sawtooth'; this.engineOsc.frequency.value = 40;
      const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 400;
      this.engineGain = this.ctx.createGain(); this.engineGain.gain.value = 0;
      this.engineOsc.connect(f); f.connect(this.engineGain); this.engineGain.connect(this.master); this.engineOsc.start();
      this.startMusic();
    } catch (e) { this.ctx = null; }
  },
  noiseBuf: null,
  noise(dur, freq, vol, type) {
    if (!this.ctx) return; const c = this.ctx;
    if (!this.noiseBuf) { const n = c.sampleRate * 1; this.noiseBuf = c.createBuffer(1, n, c.sampleRate); const d = this.noiseBuf.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; }
    const s = c.createBufferSource(); s.buffer = this.noiseBuf;
    const f = c.createBiquadFilter(); f.type = type || 'lowpass'; f.frequency.value = freq;
    const g = c.createGain(); g.gain.setValueAtTime(vol, c.currentTime); g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
    s.connect(f); f.connect(g); g.connect(this.master); s.start(); s.stop(c.currentTime + dur);
  },
  tone(f0, f1, dur, vol, type) {
    if (!this.ctx) return; const c = this.ctx;
    const o = c.createOscillator(); o.type = type || 'square'; o.frequency.setValueAtTime(f0, c.currentTime); o.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), c.currentTime + dur);
    const g = c.createGain(); g.gain.setValueAtTime(vol, c.currentTime); g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
    o.connect(g); g.connect(this.master); o.start(); o.stop(c.currentTime + dur);
  },
  shoot() { this.tone(900, 200, 0.12, 0.08, 'square'); },
  enemyShoot() { this.tone(300, 120, 0.15, 0.05, 'sawtooth'); },
  hit() { this.noise(0.08, 2000, 0.15, 'highpass'); },
  boom() { this.noise(0.7, 600, 0.5); this.tone(120, 30, 0.5, 0.2, 'sine'); },
  pickup() { this.tone(600, 1400, 0.15, 0.08, 'triangle'); setTimeout(() => this.tone(900, 1800, 0.15, 0.06, 'triangle'), 80); },
  transform() {
    this.noise(0.5, 1200, 0.15, 'bandpass');
    [0, 70, 140, 230, 300, 380].forEach((t, i) => setTimeout(() => this.tone(200 + i * 60, 80 + i * 30, 0.06, 0.08, 'square'), t));
  },
  ui() { this.tone(500, 700, 0.05, 0.05, 'triangle'); },
  setEngine(on, speed) {
    if (!this.ctx) return; const t = this.ctx.currentTime;
    this.engineGain.gain.setTargetAtTime(on ? 0.06 + speed * 0.04 : 0, t, 0.1);
    this.engineOsc.frequency.setTargetAtTime(35 + speed * 90, t, 0.1);
  },
  startMusic() {
    const c = this.ctx; this.musicGain = c.createGain(); this.musicGain.gain.value = 0.05; this.musicGain.connect(this.master);
    const notes = [110, 130.81, 146.83, 164.81, 196, 220, 246.94];
    const pads = [55, 65.41, 73.42, 49];
    let step = 0;
    const tick = () => {
      if (!this.ctx) return;
      const now = c.currentTime;
      if (step % 16 === 0) { // pad chord
        const root = pads[(step / 16) % pads.length | 0];
        [1, 1.5, 2].forEach(m => { const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = root * m; const fl = c.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = 500; const g = c.createGain(); g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(0.25, now + 1); g.gain.linearRampToValueAtTime(0, now + 4); o.connect(fl); fl.connect(g); g.connect(this.musicGain); o.start(now); o.stop(now + 4.1); });
      }
      if (Math.random() < 0.55) { const o = c.createOscillator(); o.type = 'triangle'; o.frequency.value = notes[Math.floor(Math.random() * notes.length)] * (Math.random() < 0.3 ? 2 : 1); const g = c.createGain(); g.gain.setValueAtTime(0.3, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.4); o.connect(g); g.connect(this.musicGain); o.start(now); o.stop(now + 0.45); }
      step++;
    };
    setInterval(tick, 250);
  }
};
