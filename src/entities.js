// ===== IRONSHIFT entities: player, enemies, projectiles, pickups, fx =====
const _tmp = new THREE.Vector3(), _tmp2 = new THREE.Vector3();

// ---------- FX ----------
const FX = {
  parts: [], scene: null,
  init(scene) {
    this.scene = scene; const g = new THREE.BoxGeometry(0.6, 0.6, 0.6);
    this.mats = { fire: new THREE.MeshBasicMaterial({ color: 0xffa030, transparent: true }), smoke: new THREE.MeshBasicMaterial({ color: 0x333333, transparent: true, opacity: 0.6 }), spark: new THREE.MeshBasicMaterial({ color: 0x8ff8ff, transparent: true }), metal: new THREE.MeshLambertMaterial({ color: 0x777777 }), red: new THREE.MeshBasicMaterial({ color: 0xff4040, transparent: true }) };
    for (let i = 0; i < 160; i++) { const m = new THREE.Mesh(g, this.mats.fire); m.visible = false; scene.add(m); this.parts.push({ m, v: new THREE.Vector3(), life: 0, max: 1, grav: 0, grow: 0 }); }
    // shockwave ring
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 32), new THREE.MeshBasicMaterial({ color: 0xffaa55, transparent: true, side: THREE.DoubleSide })); this.ring.rotation.x = -H2; this.ring.visible = false; scene.add(this.ring); this.ringT = 0;
  },
  spawn(pos, n, kind, speed, life, size) {
    let c = 0;
    for (const p of this.parts) {
      if (p.life > 0) continue;
      p.life = p.max = life * rand(0.6, 1.2); p.m.material = this.mats[kind]; p.m.visible = true; p.m.position.copy(pos);
      p.v.set(rand(-1, 1), rand(-0.2, 1), rand(-1, 1)).normalize().multiplyScalar(speed * rand(0.3, 1));
      p.grav = kind === 'metal' ? 30 : kind === 'smoke' ? -3 : 4; p.grow = kind === 'smoke' ? 2 : -0.5; p.m.scale.setScalar(size * rand(0.6, 1.3));
      p.m.rotation.set(rand(0, 3), rand(0, 3), 0);
      if (++c >= n) break;
    }
  },
  explode(pos, big) {
    const s = big ? 2.2 : 1;
    this.spawn(pos, 14 * s | 0, 'fire', 18 * s, 0.6, 1.6 * s); this.spawn(pos, 8 * s | 0, 'smoke', 6 * s, 1.4, 2 * s); this.spawn(pos, 8, 'metal', 22 * s, 1.2, 0.8);
    if (big) { this.ring.position.copy(pos); this.ring.position.y += 0.5; this.ring.visible = true; this.ringT = 0.6; }
    Audio_.boom(); Game.shake = Math.max(Game.shake, big ? 1.2 : 0.4);
  },
  update(dt) {
    for (const p of this.parts) {
      if (p.life <= 0) continue; p.life -= dt;
      if (p.life <= 0) { p.m.visible = false; continue; }
      p.v.y -= p.grav * dt; p.m.position.addScaledVector(p.v, dt); p.v.multiplyScalar(1 - dt * 1.5);
      const sc = p.m.scale.x * (1 + p.grow * dt); p.m.scale.setScalar(Math.max(0.05, sc));
      p.m.rotation.x += dt * 4;
    }
    for (const k in this.mats) if (this.mats[k].transparent) this.mats[k].opacity = 0.85;
    if (this.ringT > 0) { this.ringT -= dt; const k = 1 - this.ringT / 0.6; this.ring.scale.setScalar(2 + k * 30); this.ring.material.opacity = 1 - k; if (this.ringT <= 0) this.ring.visible = false; }
  }
};

// ---------- Projectiles ----------
const Shots = {
  list: [], scene: null,
  init(scene) {
    this.scene = scene; const g = new THREE.SphereGeometry(0.45, 6, 4); g.scale(1, 1, 3.5);
    this.mP = new THREE.MeshBasicMaterial({ color: 0x5ff6ff }); this.mE = new THREE.MeshBasicMaterial({ color: 0xff4a3a }); this.mB = new THREE.MeshBasicMaterial({ color: 0xffa020 });
    for (let i = 0; i < 160; i++) { const m = new THREE.Mesh(g, this.mP); m.visible = false; scene.add(m); this.list.push({ m, v: new THREE.Vector3(), life: 0, owner: 'p', dmg: 0, r: 1 }); }
  },
  fire(pos, dir, speed, owner, dmg, big) {
    for (const s of this.list) {
      if (s.life > 0) continue;
      s.life = 2.2; s.owner = owner; s.dmg = dmg; s.m.visible = true; s.m.position.copy(pos); s.v.copy(dir).normalize().multiplyScalar(speed);
      s.m.material = owner === 'p' ? this.mP : big ? this.mB : this.mE; s.m.scale.setScalar(big ? 2.5 : 1); s.r = big ? 2.5 : 1;
      s.m.lookAt(_tmp.copy(pos).add(s.v)); return s;
    }
  },
  update(dt) {
    const P = Game.player;
    for (const s of this.list) {
      if (s.life <= 0) continue; s.life -= dt;
      s.m.position.addScaledVector(s.v, dt);
      const p = s.m.position;
      let dead = s.life <= 0;
      if (!dead && p.y < terrainHeight(p.x, p.z)) dead = true;
      if (!dead && s.owner === 'p') {
        for (const e of Enemies.list) {
          if (e.dead) continue; const r = e.radius + s.r * 0.5;
          if (e.center().distanceToSquared(p) < r * r) { e.damage(s.dmg); FX.spawn(p, 4, 'spark', 10, 0.25, 0.5); dead = true; break; }
        }
      } else if (!dead && s.owner === 'e' && !P.dead) {
        const r = (P.mode === 'car' ? 3.5 : 3) + s.r * 0.4;
        if (_tmp.copy(P.pos).setY(P.pos.y + (P.mode === 'car' ? 1.5 : 4)).distanceToSquared(p) < r * r) { P.damage(s.dmg); FX.spawn(p, 4, 'red', 8, 0.25, 0.5); dead = true; }
      }
      if (dead) { s.life = 0; s.m.visible = false; }
    }
  },
  clear() { for (const s of this.list) { s.life = 0; s.m.visible = false; } }
};

// ---------- Pickups ----------
const Pickups = {
  list: [], scene: null,
  init(scene) {
    this.scene = scene;
    this.geo = { shard: new THREE.OctahedronGeometry(1.4, 0), scrap: new THREE.BoxGeometry(0.8, 0.8, 0.8), health: new THREE.OctahedronGeometry(0.9, 0) };
    this.mat = { shard: new THREE.MeshBasicMaterial({ color: 0x5ff6ff }), scrap: new THREE.MeshLambertMaterial({ color: 0xe0b040, emissive: 0x332200 }), health: new THREE.MeshBasicMaterial({ color: 0x55ff7a }) };
    const bg = new THREE.CylinderGeometry(0.15, 0.15, 30, 4); bg.translate(0, 15, 0); this.beamGeo = bg; this.beamMat = new THREE.MeshBasicMaterial({ color: 0x5ff6ff, transparent: true, opacity: 0.35 });
  },
  add(kind, x, y, z, data) {
    const m = new THREE.Mesh(this.geo[kind], this.mat[kind]); m.position.set(x, y, z); this.scene.add(m);
    const p = { kind, m, data: data || {}, t: rand(0, 6), vy: 0, base: y };
    if (kind === 'shard') { const b = new THREE.Mesh(this.beamGeo, this.beamMat); m.add(b); }
    if (kind !== 'shard') { p.vy = 12; p.vx = rand(-6, 6); p.vz = rand(-6, 6); p.life = 25; }
    this.list.push(p); return p;
  },
  remove(p) { this.scene.remove(p.m); p.dead = true; },
  update(dt) {
    const P = Game.player;
    for (const p of this.list) {
      if (p.dead) continue; p.t += dt; p.m.rotation.y += dt * 2;
      if (p.kind === 'shard') { p.m.position.y = p.base + Math.sin(p.t * 2) * 0.6; }
      else {
        p.life -= dt; if (p.life <= 0) { this.remove(p); continue; }
        const gy = terrainHeight(p.m.position.x, p.m.position.z) + 0.6;
        p.vy -= 30 * dt; p.m.position.x += p.vx * dt; p.m.position.z += p.vz * dt; p.m.position.y += p.vy * dt; p.vx *= 1 - dt * 2; p.vz *= 1 - dt * 2;
        if (p.m.position.y < gy) { p.m.position.y = gy; p.vy = 0; }
        const d2 = p.m.position.distanceToSquared(P.pos);
        if (d2 < 30 * 30 && p.t > 0.5) { _tmp.copy(P.pos).sub(p.m.position).normalize().multiplyScalar(40 * dt); p.m.position.add(_tmp); }
      }
      const reach = p.kind === 'shard' ? 5.5 : 4;
      _tmp.copy(P.pos); _tmp.y += 2;
      if (!P.dead && _tmp.distanceToSquared(p.m.position) < reach * reach * 2) this.collect(p);
    }
    this.list = this.list.filter(p => !p.dead);
  },
  collect(p) {
    const P = Game.player;
    if (p.kind === 'scrap') { Game.save.scrap += p.data.v || 5; Audio_.tone(800, 1200, 0.06, 0.04, 'triangle'); }
    else if (p.kind === 'health') { P.hp = Math.min(P.maxHp, P.hp + 25); Audio_.pickup(); }
    else if (p.kind === 'shard') {
      Audio_.pickup(); FX.spawn(p.m.position, 20, 'spark', 14, 0.8, 0.6);
      if (p.data.story) Story.onShard(p.data.id);
      else { Game.save.shards.push(p.data.id); Game.save.scrap += 25; const lore = LORE[Game.save.shards.length - 1] || ''; UI.toast('Spark Shard ' + Game.save.shards.length + '/' + SHARD_SPOTS.length, lore); Game.saveGame(); }
    }
    this.remove(p);
  }
};

// ---------- Player ----------
class Player {
  constructor(scene) {
    this.rig = new Rig('vanguard', 1); scene.add(this.rig.root); scene.add(this.rig.shadow);
    this.pos = new THREE.Vector3(LOC.scrapyard.x + 10, 0, LOC.scrapyard.z - 10); this.pos.y = terrainHeight(this.pos.x, this.pos.z);
    this.vel = new THREE.Vector3(); this.yaw = 0; this.heading = 0; this.speed = 0; this.mode = 'robot'; this.tTarget = 0;
    this.maxHp = 100; this.hp = 100; this.energy = 100; this.grounded = true; this.fireCd = 0; this.dead = false; this.hurtT = 0; this.pitch = 0; this.roll = 0; this.airT = 0; this.canTransform = true;
  }
  stats() { const u = Game.save.up; return { dmg: 10 + u.blaster * 4, maxHp: 100 + u.armor * 30, speedMul: 1 + u.engine * 0.12, energyRegen: 18 + u.cell * 6 }; }
  damage(d) {
    if (this.dead || Game.godMode) return; const armor = Game.save.up.armor;
    this.hp -= d * (1 - armor * 0.05); this.hurtT = 0.3; Audio_.hit(); UI.flash(); Game.shake = Math.max(Game.shake, 0.3);
    if (this.hp <= 0) { this.hp = 0; this.die(); }
  }
  die() { this.dead = true; FX.explode(_tmp.copy(this.pos).setY(this.pos.y + 3), true); this.rig.setVisible(false); UI.showDeath(); }
  respawn(at) {
    this.dead = false; this.hp = this.maxHp; this.energy = 100; this.rig.setVisible(true); this.pos.set(at.x, terrainHeight(at.x, at.z) + 1, at.z); this.vel.set(0, 0, 0); this.speed = 0;
    this.mode = 'robot'; this.tTarget = 0; this.rig.t = 0;
  }
  toggleMode() {
    if (!this.canTransform) return;
    if (this.rig.t > 0.05 && this.rig.t < 0.95) return;
    Audio_.transform(); FX.spawn(_tmp.copy(this.pos).setY(this.pos.y + 3), 10, 'spark', 12, 0.4, 0.4);
    if (this.mode === 'robot') { this.mode = 'car'; this.tTarget = 1; this.heading = this.yaw; this.speed = Math.hypot(this.vel.x, this.vel.z); }
    else {
      this.mode = 'robot'; this.tTarget = 0; this.yaw = this.heading;
      // leap out of the vehicle at speed
      if (this.speed > 30) { this.vel.set(Math.sin(this.heading) * this.speed * 0.6, 18, Math.cos(this.heading) * this.speed * 0.6); this.grounded = false; }
      else this.vel.set(Math.sin(this.heading) * this.speed * 0.5, this.vel.y, Math.cos(this.heading) * this.speed * 0.5);
    }
    Story.event('transform', this.mode);
  }
  findTarget(dirX, dirZ, cone, range) {
    let best = null, bs = 1e9;
    for (const e of Enemies.list) {
      if (e.dead) continue; const c = e.center(); const dx = c.x - this.pos.x, dz = c.z - this.pos.z; const d = Math.hypot(dx, dz);
      if (d > range || d < 0.1) continue; const dot = (dx * dirX + dz * dirZ) / d; if (dot < Math.cos(cone)) continue;
      const score = d * (2 - dot); if (score < bs) { bs = score; best = e; }
    }
    return best;
  }
  update(dt, cam) {
    const st = this.stats(); this.maxHp = st.maxHp;
    if (this.dead) return;
    const R = this.rig;
    R.t = damp(R.t, this.tTarget, 6, dt); if (Math.abs(R.t - this.tTarget) < 0.002) R.t = this.tTarget;
    const transforming = R.t > 0.02 && R.t < 0.98;
    this.energy = Math.min(100, this.energy + st.energyRegen * dt * (Input.boost ? 0 : 1));
    if (Input.transformPressed) this.toggleMode();
    this.fireCd -= dt; this.hurtT -= dt;
    const mx = Input.moveX, my = Input.moveY; const mag = Math.min(1, Math.hypot(mx, my));
    const fx = Math.sin(cam.yaw), fz = Math.cos(cam.yaw); const rx = -Math.cos(cam.yaw), rz = Math.sin(cam.yaw);
    let target = null;
    if (this.mode === 'robot' && R.t < 0.5) {
      // ---- MECH ----
      let wx = fx * my + rx * mx, wz = fz * my + rz * mx; const wl = Math.hypot(wx, wz); if (wl > 0) { wx /= wl; wz /= wl; }
      const boosting = Input.boost && this.energy > 1 && mag > 0.1;
      if (boosting) this.energy -= 30 * dt;
      const spd = (boosting ? 34 : 18) * st.speedMul * mag * (transforming ? 0.3 : 1);
      const accel = this.grounded ? 12 : 3;
      this.vel.x = damp(this.vel.x, wx * spd, accel, dt); this.vel.z = damp(this.vel.z, wz * spd, accel, dt);
      if (Input.jumpPressed && this.grounded) { this.vel.y = 24; this.grounded = false; Audio_.tone(200, 500, 0.15, 0.06, 'square'); }
      else if (Input.jumpPressed && !this.grounded && this.energy > 25 && !this.dj) { this.vel.y = 20; this.energy -= 25; this.dj = true; FX.spawn(this.pos, 8, 'spark', 8, 0.4, 0.5); Audio_.tone(300, 800, 0.15, 0.06, 'square'); }
      // facing
      const firing = Input.fire;
      if (firing) { target = this.findTarget(fx, fz, 0.7, 110); }
      let wantYaw = this.yaw;
      if (target) { const c = target.center(); wantYaw = Math.atan2(c.x - this.pos.x, c.z - this.pos.z); }
      else if (firing) wantYaw = cam.yaw;
      else if (wl > 0.1) wantYaw = Math.atan2(wx, wz);
      this.yaw += angleDiff(this.yaw, wantYaw) * Math.min(1, dt * 12);
      R.aim = damp(R.aim, firing ? 1 : 0, 14, dt);
      const hs = Math.hypot(this.vel.x, this.vel.z);
      R.walkAmt = damp(R.walkAmt, this.grounded ? clamp(hs / 18, 0, 1.2) : 0.3, 8, dt); R.walk += dt * (hs * 0.38 + 0.5);
      if (firing && this.fireCd <= 0) {
        this.fireCd = 0.16;
        R.muzzle(_tmp);
        if (target) _tmp2.copy(target.center()).sub(_tmp); else _tmp2.set(fx, Math.sin(-cam.pitch) * 0.6, fz);
        Shots.fire(_tmp, _tmp2, 140, 'p', st.dmg); Audio_.shoot();
      }
      this.speed = 0; this.heading = this.yaw;
      Audio_.setEngine(false, 0);
    } else {
      // ---- VEHICLE ----
      const boosting = Input.boost && this.energy > 1;
      if (boosting) { this.energy -= 22 * dt; if (Math.random() < 0.6) FX.spawn(_tmp.set(this.pos.x - Math.sin(this.heading) * 5, this.pos.y + 1.2, this.pos.z - Math.cos(this.heading) * 5), 1, 'fire', 4, 0.25, 0.7); }
      const maxS = (boosting ? 95 : 60) * st.speedMul;
      // car steering: relative to camera when touch so the stick feels natural
      let throttle = my, steer = mx;
      if (Input.touchMode && mag > 0.2) {
        const wx = fx * my + rx * mx, wz = fz * my + rz * mx; const want = Math.atan2(wx, wz);
        const d = angleDiff(this.heading, want);
        if (Math.abs(d) < 2.3) { throttle = mag; steer = clamp(-d * 2, -1, 1); } else { throttle = -mag * 0.7; steer = clamp(d * 2, -1, 1); }
      }
      if (boosting && throttle < 0.2) throttle = 1;
      if (throttle > 0) this.speed += throttle * 42 * dt * (this.speed < 0 ? 2.5 : 1);
      else if (throttle < 0) this.speed += throttle * (this.speed > 0 ? 70 : 25) * dt;
      else this.speed = damp(this.speed, 0, 0.8, dt);
      this.speed = clamp(this.speed, -22, maxS);
      if (boosting) this.speed = damp(this.speed, maxS, 1.5, dt);
      const turnRate = 2.2 * clamp(Math.abs(this.speed) / 18, 0, 1) * (this.speed >= 0 ? 1 : -1);
      if (this.grounded) this.heading -= steer * turnRate * dt;
      R.steer = damp(R.steer, -steer, 10, dt);
      const hx = Math.sin(this.heading), hz = Math.cos(this.heading);
      const grip = this.grounded ? (Math.abs(steer) > 0.6 && this.speed > 45 ? 3 : 9) : 0.2;
      this.vel.x = damp(this.vel.x, hx * this.speed, grip, dt); this.vel.z = damp(this.vel.z, hz * this.speed, grip, dt);
      this.yaw = this.heading; R.walkAmt = 0; R.aim = 0;
      R.wheelSpin += this.speed * dt / 0.95;
      Audio_.setEngine(true, Math.abs(this.speed) / 80);
      if (Input.jumpPressed && this.grounded && this.speed > 10) { this.vel.y = 16; this.grounded = false; }
      // car weapon: roof cannon
      if (Input.fire && this.fireCd <= 0) {
        this.fireCd = 0.12; target = this.findTarget(hx, hz, 0.45, 120);
        R.parts.blasterTip.mesh.getWorldPosition(_tmp);
        if (target) _tmp2.copy(target.center()).sub(_tmp); else _tmp2.set(hx, 0, hz);
        Shots.fire(_tmp, _tmp2, 160 + Math.max(0, this.speed), 'p', st.dmg * 0.8); Audio_.shoot();
      }
      // ramming
      if (Math.abs(this.speed) > 25) for (const e of Enemies.list) {
        if (e.dead || e.type === 'drone') continue; const c = e.center();
        if (dist2(c.x, c.z, this.pos.x, this.pos.z) < (e.radius + 3) ** 2 && Math.abs(c.y - this.pos.y) < e.radius + 3) {
          e.damage(Math.abs(this.speed) * 1.2 * (e.type === 'boss' ? 0.3 : 1)); e.knock(hx * this.speed * 0.5, hz * this.speed * 0.5); this.speed *= 0.4; Game.shake = 0.6; Audio_.hit();
        }
      }
    }
    // ---- physics shared ----
    this.vel.y -= 55 * dt;
    this.pos.x += this.vel.x * dt; this.pos.z += this.vel.z * dt; this.pos.y += this.vel.y * dt;
    const rad = this.mode === 'car' && R.t > 0.5 ? 3.2 : 2.2;
    const before = _tmp2.copy(this.pos);
    const bx = before.x, bz = before.z;
    if (World.collide(this.pos, rad, this.pos.y)) {
      if (this.mode === 'car') { const imp = Math.abs(this.speed); if (imp > 35) { Game.shake = 0.5; Audio_.hit(); FX.spawn(this.pos, 6, 'spark', 12, 0.3, 0.5); } this.speed *= 0.5; }
      this.vel.x = (this.pos.x - bx) / Math.max(dt, 1e-3) * 0 + this.vel.x * 0.5; this.vel.z = this.vel.z * 0.5;
    }
    const gy = World.supportHeight(this.pos.x, this.pos.z, this.pos.y);
    const wasAir = !this.grounded;
    if (this.pos.y <= gy + (this.grounded && this.mode === 'car' ? 1.0 : 0.05)) {
      if (wasAir && this.vel.y < -30) { Game.shake = 0.35; FX.spawn(_tmp.copy(this.pos), 8, 'smoke', 6, 0.6, 1.2); }
      this.pos.y = gy; if (this.vel.y < 0) this.vel.y = 0; this.grounded = true; this.dj = false;
    } else this.grounded = false;
    // under water: sink + damage over time
    if (this.pos.y < -14) { this.damage(20 * dt); this.vel.multiplyScalar(0.9); }
    // orientation
    this.rig.root.position.copy(this.pos);
    let tp = 0, tr = 0;
    if (R.t > 0.5 && this.grounded) {
      const hx = Math.sin(this.heading), hz = Math.cos(this.heading);
      const f = terrainHeight(this.pos.x + hx * 3, this.pos.z + hz * 3), b = terrainHeight(this.pos.x - hx * 3, this.pos.z - hz * 3);
      const l = terrainHeight(this.pos.x - hz * 2, this.pos.z + hx * 2), r = terrainHeight(this.pos.x + hz * 2, this.pos.z - hx * 2);
      tp = Math.atan2(b - f, 6); tr = Math.atan2(r - l, 4);
    }
    this.pitch = damp(this.pitch, tp, 8, dt); this.roll = damp(this.roll, tr, 8, dt);
    this.rig.root.rotation.set(0, 0, 0); this.rig.root.rotation.order = 'YXZ'; this.rig.root.rotation.set(this.pitch, this.yaw, this.roll);
    this.rig.body.position.y = this.mode === 'robot' && this.grounded ? Math.abs(Math.sin(R.walk)) * 0.25 * R.walkAmt : 0;
    R.update(dt);
    this.rig.shadow.position.set(this.pos.x, terrainHeight(this.pos.x, this.pos.z) + 0.15, this.pos.z);
    this.hp = Math.min(this.hp, this.maxHp);
    // slow regen out of combat
    if (this.hurtT < -6) this.hp = Math.min(this.maxHp, this.hp + 3 * dt);
  }
}

// ---------- Enemies ----------
function makeDrone() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(1.4, 10, 8), rigMats(PALETTES.rust).main); g.add(body);
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), rigMats(PALETTES.rust).glow); eye.position.z = 1.2; g.add(eye);
  const wing = new THREE.Mesh(new THREE.BoxGeometry(5, 0.2, 1.2), rigMats(PALETTES.rust).dark); g.add(wing);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.4, 1.2), rigMats(PALETTES.rust).dark); fin.position.set(0, 0.9, -0.6); g.add(fin);
  return g;
}
const ENEMY_TYPES = {
  drone: { hp: 30, radius: 2.2, speed: 16, range: 30, cd: 1.6, dmg: 6, scrap: 6 },
  trooper: { hp: 70, radius: 3.5, speed: 11, range: 35, cd: 1.9, dmg: 7, scrap: 12 },
  brute: { hp: 220, radius: 5.5, speed: 7, range: 45, cd: 2.6, dmg: 16, scrap: 35 },
  boss: { hp: 2600, radius: 11, speed: 9, range: 70, cd: 1.4, dmg: 12, scrap: 400 },
};
class Enemy {
  constructor(type, x, z, opts) {
    const T = ENEMY_TYPES[type]; this.type = type; this.T = T; opts = opts || {};
    this.hp = this.maxHp = T.hp * (opts.hpMul || 1); this.radius = T.radius; this.dead = false;
    this.home = new THREE.Vector3(x, 0, z); this.pos = new THREE.Vector3(x, terrainHeight(x, z), z); this.vel = new THREE.Vector3();
    this.yaw = rand(0, TAU); this.cd = rand(1, 2.5); this.state = 'idle'; this.t = rand(0, 10); this.strafe = Math.random() < 0.5 ? 1 : -1; this.tag = opts.tag || null; this.aggro = opts.aggro || 80; this.burst = 0;
    if (type === 'drone') { this.obj = makeDrone(); this.pos.y += 9; this.shadow = null; }
    else { this.rig = new Rig(type === 'boss' ? 'kraxx' : 'rust', type === 'boss' ? 3.2 : type === 'brute' ? 1.45 : 0.85); this.obj = this.rig.root; this.shadow = this.rig.shadow; Game.scene.add(this.shadow); }
    Game.scene.add(this.obj);
    this.phase = 1;
  }
  center() { if (!this._c) this._c = new THREE.Vector3(); return this._c.copy(this.pos).setY(this.pos.y + (this.type === 'drone' ? 0 : this.radius * 0.9)); }
  knock(vx, vz) { this.vel.x += vx; this.vel.z += vz; }
  damage(d) {
    if (this.dead) return; this.hp -= d; this.hitT = 0.12; this.state = 'chase';
    if (this.type === 'boss') Story.event('bossHp', this.hp / this.maxHp);
    if (this.hp <= 0) this.kill();
  }
  kill() {
    this.dead = true; const c = this.center().clone(); FX.explode(c, this.type === 'brute' || this.type === 'boss');
    Game.scene.remove(this.obj); if (this.shadow) Game.scene.remove(this.shadow);
    const n = Math.ceil(this.T.scrap / 6); for (let i = 0; i < Math.min(n, 12); i++) Pickups.add('scrap', c.x, c.y, c.z, { v: Math.ceil(this.T.scrap / Math.min(n, 12)) });
    if (Math.random() < 0.25) Pickups.add('health', c.x, c.y, c.z);
    Game.save.kills++; Story.event('kill', this);
  }
  update(dt) {
    if (this.dead) return; const P = Game.player; this.t += dt; this.cd -= dt; this.hitT -= dt;
    const dx = P.pos.x - this.pos.x, dz = P.pos.z - this.pos.z; const d = Math.hypot(dx, dz);
    if (this.state === 'idle' && d < this.aggro && !P.dead) this.state = 'chase';
    if (this.state === 'chase' && (d > 260 || P.dead) && this.type !== 'boss') this.state = 'return';
    if (this.state === 'return' && dist2(this.pos.x, this.pos.z, this.home.x, this.home.z) < 100) this.state = 'idle';
    const T = this.T; let mvx = 0, mvz = 0;
    if (this.state === 'chase') {
      const nx = dx / (d || 1), nz = dz / (d || 1);
      if (d > T.range) { mvx = nx; mvz = nz; } else if (d < T.range * 0.5) { mvx = -nx * 0.6; mvz = -nz * 0.6; }
      if (this.type !== 'brute') { mvx += -nz * this.strafe * 0.6; mvz += nx * this.strafe * 0.6; if (Math.random() < dt * 0.3) this.strafe *= -1; }
      this.yaw += angleDiff(this.yaw, Math.atan2(dx, dz)) * Math.min(1, dt * 6);
      if (this.cd <= 0 && d < T.range * 2.2) this.attack(d);
    } else {
      const hx = this.home.x + Math.cos(this.t * 0.3) * 15 - this.pos.x, hz = this.home.z + Math.sin(this.t * 0.3) * 15 - this.pos.z; const hl = Math.hypot(hx, hz) || 1;
      mvx = hx / hl * 0.5; mvz = hz / hl * 0.5; this.yaw += angleDiff(this.yaw, Math.atan2(hx, hz)) * Math.min(1, dt * 3);
    }
    const sp = T.speed * (this.type === 'boss' && this.phase > 1 ? 1.4 : 1);
    this.vel.x = damp(this.vel.x, mvx * sp, 3, dt); this.vel.z = damp(this.vel.z, mvz * sp, 3, dt);
    this.pos.x += this.vel.x * dt; this.pos.z += this.vel.z * dt;
    if (this.type === 'drone') {
      const gy = terrainHeight(this.pos.x, this.pos.z) + 9 + Math.sin(this.t * 2) * 1.5; this.pos.y = damp(this.pos.y, Math.max(gy, P.pos.y + 6), 2, dt);
      this.obj.position.copy(this.pos); this.obj.rotation.set(0, this.yaw, Math.sin(this.t * 3) * 0.15);
    } else {
      World.collide(this.pos, this.radius * 0.6, this.pos.y);
      this.pos.y = terrainHeight(this.pos.x, this.pos.z);
      const R = this.rig; const hs = Math.hypot(this.vel.x, this.vel.z);
      R.walkAmt = damp(R.walkAmt, clamp(hs / 9, 0, 1), 6, dt); R.walk += dt * (hs * 0.5 / R.scale + 0.3);
      R.aim = damp(R.aim, this.state === 'chase' ? 1 : 0, 5, dt); R.punch = Math.max(0, R.punch - dt * 3);
      R.root.position.copy(this.pos); R.root.rotation.set(0, this.yaw, 0); R.update(dt);
      this.shadow.position.set(this.pos.x, this.pos.y + 0.15, this.pos.z);
      R.body.position.y = Math.abs(Math.sin(R.walk)) * 0.2 * R.walkAmt;
    }
    // hit flash
    if (this.obj) this.obj.visible = !(this.hitT > 0 && (this.t * 30 | 0) % 2);
  }
  attack(d) {
    const T = this.T; const P = Game.player;
    const src = this.type === 'drone' ? _tmp2.copy(this.pos) : this.rig.muzzle(_tmp2);
    const aimAt = _tmp.copy(P.pos).setY(P.pos.y + (P.mode === 'car' ? 1.5 : 4));
    // lead the target a bit
    aimAt.addScaledVector(P.vel, d / 90 * 0.6);
    const dir = aimAt.sub(src);
    if (this.type === 'boss') {
      const hpK = this.hp / this.maxHp; this.phase = hpK < 0.33 ? 3 : hpK < 0.66 ? 2 : 1;
      const pattern = (this.t * 0.4 | 0) % 3;
      if (pattern === 0) { for (let i = -2; i <= 2; i++) { const a = Math.atan2(dir.x, dir.z) + i * 0.16; Shots.fire(src, new THREE.Vector3(Math.sin(a), dir.y / dir.length(), Math.cos(a)), 75, 'e', T.dmg, true); } this.cd = T.cd; }
      else if (pattern === 1) { Shots.fire(src, dir, 95, 'e', T.dmg, false); this.cd = 0.18; if (++this.burst > 7) { this.burst = 0; this.cd = 1.4; } }
      else { // ground slam shockwave
        if (d < 40) { FX.explode(_tmp.copy(this.pos), true); this.rig.punch = 1; if (Math.abs(P.pos.y - this.pos.y) < 4) P.damage(22); } else Shots.fire(src, dir, 85, 'e', T.dmg * 1.5, true);
        this.cd = 2.2;
      }
      if (this.phase >= 2 && Enemies.list.filter(e => !e.dead && e.type === 'drone').length < this.phase * 2 && Math.random() < 0.25) Enemies.spawn('drone', this.pos.x + rand(-30, 30), this.pos.z + rand(-30, 30), { aggro: 400 });
      Audio_.enemyShoot(); return;
    }
    if (this.type === 'trooper') { this.burst++; this.cd = this.burst % 3 ? 0.22 : T.cd; }
    else this.cd = T.cd + rand(-0.3, 0.3);
    dir.x += rand(-0.04, 0.04) * d; dir.z += rand(-0.04, 0.04) * d;
    Shots.fire(src, dir, this.type === 'brute' ? 60 : 70, 'e', T.dmg, this.type === 'brute'); Audio_.enemyShoot();
  }
}
const Enemies = {
  list: [],
  spawn(type, x, z, opts) { const e = new Enemy(type, x, z, opts); this.list.push(e); return e; },
  update(dt) {
    for (const e of this.list) {
      // cull far enemies from updating (except tagged story ones)
      if (!e.dead && (e.tag || dist2(e.pos.x, e.pos.z, Game.player.pos.x, Game.player.pos.z) < 400 * 400)) e.update(dt);
    }
    if (this.list.length > 60) this.list = this.list.filter(e => !e.dead);
  },
  alive(tag) { return this.list.filter(e => !e.dead && (!tag || e.tag === tag)).length; },
  clearTag(tag) { for (const e of this.list) if (!e.dead && e.tag === tag) { e.dead = true; Game.scene.remove(e.obj); if (e.shadow) Game.scene.remove(e.shadow); } },
};

// ---------- Camps (free-roam enemy groups, persist when cleared) ----------
const CAMPS = [
  { id: 'c1', x: -420, z: 380, units: ['drone', 'drone', 'trooper'] },
  { id: 'c2', x: -300, z: 140, units: ['trooper', 'trooper', 'drone'] },
  { id: 'c3', x: 300, z: -200, units: ['trooper', 'trooper', 'brute'] },
  { id: 'c4', x: 560, z: -330, units: ['trooper', 'trooper', 'trooper', 'brute', 'drone'] },
  { id: 'c5', x: 420, z: 520, units: ['drone', 'drone', 'trooper', 'trooper'] },
  { id: 'c6', x: -330, z: -380, units: ['trooper', 'brute', 'drone', 'drone'] },
  { id: 'c7', x: 760, z: 120, units: ['brute', 'trooper', 'trooper'] },
  { id: 'c8', x: -700, z: -150, units: ['drone', 'drone', 'drone', 'trooper'] },
  { id: 'c9', x: 150, z: 700, units: ['trooper', 'trooper', 'brute'] },
  { id: 'c10', x: -480, z: -560, units: ['brute', 'brute', 'trooper', 'drone'] },
];
const Camps = {
  active: {},
  update() {
    const P = Game.player;
    for (const c of CAMPS) {
      if (Game.save.camps[c.id]) continue;
      const near = dist2(P.pos.x, P.pos.z, c.x, c.z) < 300 * 300;
      if (near && !this.active[c.id] && Story.campsAllowed(c.id)) {
        this.active[c.id] = c.units.map((u, i) => Enemies.spawn(u, c.x + Math.cos(i * 2.1) * 14, c.z + Math.sin(i * 2.1) * 14, { tag: null }));
      }
      const a = this.active[c.id];
      if (a && a.every(e => e.dead)) { Game.save.camps[c.id] = true; delete this.active[c.id]; Game.save.scrap += 60; UI.toast('Rustborn camp cleared', '+60 scrap'); Game.saveGame(); }
      else if (a && !near && dist2(P.pos.x, P.pos.z, c.x, c.z) > 420 * 420) { for (const e of a) if (!e.dead) { e.dead = true; Game.scene.remove(e.obj); if (e.shadow) Game.scene.remove(e.shadow); } delete this.active[c.id]; }
    }
  }
};
