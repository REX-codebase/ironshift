// ===== IRONSHIFT robot rig: one set of parts, two poses (mech <-> vehicle) =====
const _q1 = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _e = new THREE.Euler(), _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3();
const PALETTES = {
  vanguard: { main: 0xc8202a, dark: 0x2c3440, trim: 0xb8c2cc, glow: 0x3ef0ff, glass: 0x1d3550 },
  rust: { main: 0x5b2a6e, dark: 0x1e1b22, trim: 0x77706a, glow: 0xff3030, glass: 0x2a0d0d },
  kraxx: { main: 0x1f1f24, dark: 0x3a0f12, trim: 0x8a7f6a, glow: 0xff5a10, glass: 0x400a00 },
  elder: { main: 0x2f6fb0, dark: 0x2a2f38, trim: 0xd8c48a, glow: 0x9dffb0, glass: 0x18304a },
  seeker: { main: 0xe0b020, dark: 0x30302c, trim: 0xe8e8e8, glow: 0x3ef0ff, glass: 0x1d3550 },
};
const H2 = Math.PI / 2;
// [name, size, mat, robotPose(p,r) or null(animated), carPose(p,r,s), delay]
function rigDefs() {
  return [
    ['pelvis', [3, 1.1, 2], 'dark', [[0, 4.3, 0], [0, 0, 0]], [[0, 1.2, -0.6], [0, 0, 0], [1.3, 0.8, 2.2]], 0.1],
    ['chest', [4, 2.6, 2.4], 'main', [[0, 5.9, 0], [0, 0, 0]], [[0, 1.55, 2.6], [H2, 0, 0], [1.05, 1, 0.75]], 0.0],
    ['chestGlow', [2.6, 0.5, 0.15], 'glow', [[0, 6.3, 1.22], [0, 0, 0]], [[0, 1.75, 4.62], [0, 0, 0], [1.5, 0.8, 1]], 0.0],
    ['abs', [2.4, 1.1, 1.8], 'trim', [[0, 4.95, 0.1], [0, 0, 0]], [[0, 1.3, 0.6], [0, 0, 0], [1.6, 0.8, 1.3]], 0.15],
    ['head', [1.3, 1.3, 1.3], 'trim', [[0, 7.95, 0], [0, 0, 0]], [[0, 1.0, 0.8], [0, 0, 0], [0.4, 0.4, 0.4]], 0.05],
    ['crest', [0.3, 0.9, 1.2], 'main', [[0, 8.75, -0.1], [0, 0, 0]], [[0, 1.0, 0.8], [0, 0, 0], [0.3, 0.3, 0.3]], 0.05],
    ['visor', [1.1, 0.28, 0.1], 'glow', [[0, 8.05, 0.67], [0, 0, 0]], [[0, 1.0, 0.8], [0, 0, 0], [0.3, 0.3, 0.3]], 0.05],
    ['shoulderL', [1.5, 1.3, 1.8], 'main', [[-2.75, 6.75, 0], [0, 0, 0.15]], [[-1.15, 2.75, -1.0], [0, 0, 0], [1, 0.5, 1.6]], 0.2],
    ['shoulderR', [1.5, 1.3, 1.8], 'main', [[2.75, 6.75, 0], [0, 0, -0.15]], [[1.15, 2.75, -1.0], [0, 0, 0], [1, 0.5, 1.6]], 0.2],
    ['uArmL', [0.9, 1.8, 0.9], 'dark', null, [[-2.05, 1.0, 0.5], [H2, 0, 0], [1, 1, 1]], 0.25],
    ['uArmR', [0.9, 1.8, 0.9], 'dark', null, [[2.05, 1.0, 0.5], [H2, 0, 0], [1, 1, 1]], 0.25],
    ['fArmL', [1.05, 1.9, 1.05], 'main', null, [[-2.05, 1.0, -1.5], [H2, 0, 0], [1, 1, 1]], 0.3],
    ['fArmR', [1.05, 1.9, 1.05], 'main', null, [[2.05, 1.0, -1.5], [H2, 0, 0], [1, 1, 1]], 0.3],
    ['blaster', [0.55, 0.55, 2.2], 'dark', null, [[0, 3.3, -0.6], [0, 0, 0], [1, 1, 1]], 0.35],
    ['blasterTip', [0.35, 0.35, 0.3], 'glow', null, [[0, 3.3, 0.6], [0, 0, 0], [1, 1, 1]], 0.35],
    ['thighL', [1.15, 1.8, 1.15], 'dark', null, [[-1.35, 1.2, -2.5], [H2, 0, 0], [1, 1, 1]], 0.15],
    ['thighR', [1.15, 1.8, 1.15], 'dark', null, [[1.35, 1.2, -2.5], [H2, 0, 0], [1, 1, 1]], 0.15],
    ['shinL', [1.35, 1.8, 1.45], 'main', null, [[-1.35, 1.45, -4.0], [H2, 0, 0], [1.2, 0.8, 1]], 0.2],
    ['shinR', [1.35, 1.8, 1.45], 'main', null, [[1.35, 1.45, -4.0], [H2, 0, 0], [1.2, 0.8, 1]], 0.2],
    ['footL', [1.3, 0.5, 2.0], 'dark', null, [[-1.3, 1.0, -4.95], [0, H2, 0], [0.6, 1.4, 1]], 0.25],
    ['footR', [1.3, 0.5, 2.0], 'dark', null, [[1.3, 1.0, -4.95], [0, H2, 0], [0.6, 1.4, 1]], 0.25],
    ['windshield', [3.2, 0.15, 1.9], 'glass', [[0, 6.0, -1.35], [-1.3, 0, 0]], [[0, 2.35, 0.95], [-0.55, 0, 0], [1.05, 1, 1.1]], 0.1],
    ['roof', [3.3, 0.3, 2.7], 'main', [[0, 5.2, -1.45], [H2, 0, 0]], [[0, 3.05, -0.85], [0, 0, 0], [1, 1, 1.1]], 0.1],
    ['rearGlass', [3.0, 0.15, 1.4], 'glass', [[0, 4.2, -1.2], [H2 - 0.2, 0, 0]], [[0, 2.5, -2.55], [0.6, 0, 0], [1.05, 1, 1]], 0.12],
    ['spoiler', [3.8, 0.2, 0.8], 'dark', [[0, 7.4, -1.5], [0.3, 0, 0]], [[0, 2.7, -4.7], [0, 0, 0], [1.1, 1, 1]], 0.3],
    ['wheelFL', 'wheel', 'tire', [[-2.6, 6.5, -1.1], [0, 0, H2]], [[-2.2, 0.95, 3.0], [0, 0, H2], [1, 1, 1]], 0.3],
    ['wheelFR', 'wheel', 'tire', [[2.6, 6.5, -1.1], [0, 0, H2]], [[2.2, 0.95, 3.0], [0, 0, H2], [1, 1, 1]], 0.3],
    ['wheelRL', 'wheel', 'tire', null, [[-2.2, 0.95, -3.2], [0, 0, H2], [1, 1, 1]], 0.35],
    ['wheelRR', 'wheel', 'tire', null, [[2.2, 0.95, -3.2], [0, 0, H2], [1, 1, 1]], 0.35],
    ['tailL', [0.8, 0.3, 0.1], 'redlight', [[-0.9, 4.25, -1.02], [0, 0, 0]], [[-1.5, 1.6, -5.25], [0, 0, 0], [1, 1, 1]], 0.2],
    ['tailR', [0.8, 0.3, 0.1], 'redlight', [[0.9, 4.25, -1.02], [0, 0, 0]], [[1.5, 1.6, -5.25], [0, 0, 0], [1, 1, 1]], 0.2],
  ];
}
const _geoCache = {};
function partGeo(size) {
  if (size === 'wheel') { if (!_geoCache.wheel) _geoCache.wheel = new THREE.CylinderGeometry(0.95, 0.95, 0.7, 12); return _geoCache.wheel; }
  const k = size.join(','); if (!_geoCache[k]) _geoCache[k] = new THREE.BoxGeometry(size[0], size[1], size[2]); return _geoCache[k];
}
const _matCache = {};
function rigMats(pal) {
  const key = JSON.stringify(pal); if (_matCache[key]) return _matCache[key];
  const m = {
    main: new THREE.MeshPhongMaterial({ color: pal.main, shininess: 80, specular: 0x666666 }),
    dark: new THREE.MeshPhongMaterial({ color: pal.dark, shininess: 30 }),
    trim: new THREE.MeshPhongMaterial({ color: pal.trim, shininess: 100, specular: 0x999999 }),
    glow: new THREE.MeshBasicMaterial({ color: pal.glow }),
    glass: new THREE.MeshPhongMaterial({ color: pal.glass, shininess: 150, specular: 0xffffff }),
    tire: new THREE.MeshLambertMaterial({ color: 0x151515 }),
    redlight: new THREE.MeshBasicMaterial({ color: 0xff2020 }),
  };
  _matCache[key] = m; return m;
}

class Rig {
  constructor(paletteName, scale) {
    this.root = new THREE.Group(); this.body = new THREE.Group(); this.root.add(this.body);
    this.scale = scale || 1; this.body.scale.setScalar(this.scale);
    const mats = rigMats(PALETTES[paletteName]);
    this.parts = {}; this.list = [];
    for (const d of rigDefs()) {
      const [name, size, mat, rp, cp, delay] = d;
      const mesh = new THREE.Mesh(partGeo(size), mats[mat]);
      const part = { name, mesh, delay, rp: rp ? { p: new THREE.Vector3(...rp[0]), q: new THREE.Quaternion().setFromEuler(new THREE.Euler(...rp[1])) } : { p: new THREE.Vector3(), q: new THREE.Quaternion() }, animated: !rp,
        cp: { p: new THREE.Vector3(...cp[0]), q: new THREE.Quaternion().setFromEuler(new THREE.Euler(...cp[1])), s: new THREE.Vector3(...cp[2]) } };
      this.parts[name] = part; this.list.push(part); this.body.add(mesh);
    }
    this.t = 0; this.walk = 0; this.walkAmt = 0; this.aim = 0; this.wheelSpin = 0; this.steer = 0; this.punch = 0;
    // blob shadow
    const sh = new THREE.Mesh(new THREE.CircleGeometry(3.2, 16), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false }));
    sh.rotation.x = -Math.PI / 2; sh.scale.setScalar(this.scale); this.shadow = sh;
    this.update(0);
  }
  // animated robot-mode limb poses
  _limbs() {
    const P = this.parts; const ph = this.walk, wa = this.walkAmt;
    const leg = (side, phase) => {
      const s = Math.sin(phase);
      const a = s * 0.65 * wa; const bend = Math.max(0, Math.sin(phase + 1.2)) * 0.9 * wa + 0.05;
      const b = a - bend;
      const hx = side * 1.0, hy = 3.95;
      const kz = Math.sin(a) * 1.8, ky = hy - Math.cos(a) * 1.8;
      const az = kz + Math.sin(b) * 1.8, ay = ky - Math.cos(b) * 1.8;
      const th = P[side < 0 ? 'thighL' : 'thighR'], sh = P[side < 0 ? 'shinL' : 'shinR'], ft = P[side < 0 ? 'footL' : 'footR'];
      th.rp.p.set(hx, hy - Math.cos(a) * 0.9, Math.sin(a) * 0.9); th.rp.q.setFromEuler(_e.set(-a, 0, 0));
      sh.rp.p.set(hx, ky - Math.cos(b) * 0.9, kz + Math.sin(b) * 0.9); sh.rp.q.setFromEuler(_e.set(-b, 0, 0));
      ft.rp.p.set(hx, Math.max(ay - 0.15, 0.25), az + 0.3); ft.rp.q.setFromEuler(_e.set(0, 0, 0));
      return { ax: hx, ay, az };
    };
    const L = leg(-1, ph), R = leg(1, ph + Math.PI);
    // rear wheels on calves
    P.wheelRL.rp.p.set(-1.95, P.shinL.rp.p.y, P.shinL.rp.p.z - 0.2); P.wheelRL.rp.q.setFromEuler(_e.set(0, 0, H2));
    P.wheelRR.rp.p.set(1.95, P.shinR.rp.p.y, P.shinR.rp.p.z - 0.2); P.wheelRR.rp.q.setFromEuler(_e.set(0, 0, H2));
    const arm = (side, swing, raise) => {
      const sx = side * 2.85, sy = 6.5;
      const a = lerp(swing, H2 * 0.95, raise); // angle forward from straight down
      const b = lerp(a + 0.3 * wa + 0.15, H2 * 0.95, raise);
      const ez = Math.sin(a) * 1.8, ey = sy - Math.cos(a) * 1.8;
      const ua = P[side < 0 ? 'uArmL' : 'uArmR'], fa = P[side < 0 ? 'fArmL' : 'fArmR'];
      ua.rp.p.set(sx, sy - Math.cos(a) * 0.9, Math.sin(a) * 0.9); ua.rp.q.setFromEuler(_e.set(-a, 0, 0));
      fa.rp.p.set(sx, ey - Math.cos(b) * 0.95, ez + Math.sin(b) * 0.95); fa.rp.q.setFromEuler(_e.set(-b, 0, 0));
      return { hx: sx, hy: ey - Math.cos(b) * 1.9, hz: ez + Math.sin(b) * 1.9, b };
    };
    const swing = Math.sin(ph) * 0.55 * this.walkAmt;
    arm(-1, -swing + this.punch * 1.4, 0);
    const hand = arm(1, swing, this.aim);
    // blaster rides on right forearm
    const bl = P.blaster, tip = P.blasterTip;
    const b = hand.b; const fx = hand.hx + 0.7;
    bl.rp.p.set(fx, hand.hy + Math.cos(b) * 0.7 - 0.0, hand.hz - Math.sin(b) * 0.7); bl.rp.q.setFromEuler(_e.set(-b + H2, 0, 0));
    tip.rp.p.set(fx, bl.rp.p.y - Math.cos(b) * 1.15, bl.rp.p.z + Math.sin(b) * 1.15); tip.rp.q.copy(bl.rp.q);
  }
  update(dt) {
    this._limbs();
    const T = this.t;
    for (const p of this.list) {
      let k = clamp((T - p.delay) / 0.62, 0, 1); k = k * k * (3 - 2 * k);
      p.mesh.position.lerpVectors(p.rp.p, p.cp.p, k);
      // transformation flourish: parts arc outwards mid-transform
      const arc = Math.sin(k * Math.PI);
      if (arc > 0.001) { p.mesh.position.x += Math.sign(p.rp.p.x || 0.0001) * arc * 0.8; p.mesh.position.y += arc * 0.6; }
      p.mesh.quaternion.slerpQuaternions(p.rp.q, p.cp.q, k);
      if (arc > 0.001) { _q1.setFromEuler(_e.set(arc * 0.6, arc * (p.rp.p.x > 0 ? 0.7 : -0.7), 0)); p.mesh.quaternion.multiply(_q1); }
      p.mesh.scale.set(lerp(1, p.cp.s.x, k), lerp(1, p.cp.s.y, k), lerp(1, p.cp.s.z, k));
      if (p.name.startsWith('wheel')) {
        if (k > 0.5) { _q1.setFromAxisAngle(_v1.set(0, 1, 0), -this.wheelSpin); if (p.name === 'wheelFL' || p.name === 'wheelFR') { _q2.setFromAxisAngle(_v2.set(0, 1, 0), this.steer * 0.45); p.mesh.quaternion.premultiply(_q2); } p.mesh.quaternion.multiply(_q1); }
      }
    }
  }
  // world-space muzzle position
  muzzle(out) { this.parts.blasterTip.mesh.getWorldPosition(out); return out; }
  setVisible(v) { this.root.visible = v; this.shadow.visible = v; }
}
