// ===== IRONSHIFT world: terrain, city, landmarks, collisions, sky =====
const WORLD_SIZE = 2000, HALF = 1000;
const LOC = {
  scrapyard: { x: -620, z: 520, name: 'Scrapyard 9' },
  haven: { x: 0, z: 0, name: 'Haven' },
  garage: { x: 52, z: 38, name: 'Haven Garage' },
  elder: { x: 0, z: -28, name: 'Elder Bastion' },
  relay: { x: 690, z: -520, name: 'Relay Spire' },
  outpost: { x: 560, z: -330, name: 'Dust Outpost' },
  foundry: { x: -560, z: -640, name: 'The Foundry' },
  forest: { x: 420, z: 520, name: 'Greenwire Woods' },
  ruins: { x: -300, z: 120, name: 'Old Ruins' },
};
const FLATS = [
  { x: 0, z: 0, r: 300, h: 2 },
  { x: LOC.scrapyard.x, z: LOC.scrapyard.z, r: 120, h: 6 },
  { x: LOC.foundry.x, z: LOC.foundry.z, r: 170, h: 4 },
  { x: LOC.relay.x, z: LOC.relay.z, r: 70, h: 30 },
  { x: LOC.outpost.x, z: LOC.outpost.z, r: 90, h: 12 },
  { x: LOC.ruins.x, z: LOC.ruins.z, r: 80, h: 8 },
];
const ROADS = [
  [LOC.scrapyard, { x: -300, z: 300 }, { x: -120, z: 60 }, LOC.haven],
  [LOC.haven, { x: 250, z: -120 }, LOC.outpost, LOC.relay],
  [LOC.haven, { x: -200, z: -300 }, LOC.foundry],
  [LOC.haven, { x: 250, z: 300 }, LOC.forest],
  [{ x: -120, z: 60 }, LOC.ruins],
  [LOC.forest, { x: 750, z: 100 }, LOC.outpost],
];

function rawHeight(x, z) {
  let h = fbm(x * 0.0035 + 10, z * 0.0035 - 7, 4) * 70 - 22;
  h += (fbm(x * 0.02, z * 0.02, 2) - 0.5) * 4;
  // canyon east: ridges
  if (x > 300 && z < 100) h += Math.abs(Math.sin(x * 0.012 + fbm(x * 0.01, z * 0.01, 2) * 4)) * 25;
  // border mountains
  const edge = Math.max(Math.abs(x), Math.abs(z));
  if (edge > 800) h += Math.pow((edge - 800) / 200, 2) * 160;
  return h;
}
function terrainHeight(x, z) {
  let h = rawHeight(x, z);
  for (const f of FLATS) {
    const d = Math.sqrt(dist2(x, z, f.x, f.z));
    if (d < f.r * 1.6) { const w = 1 - clamp((d - f.r) / (f.r * 0.6), 0, 1); h = lerp(h, f.h, w * w * (3 - 2 * w)); }
  }
  // roads flatten slightly
  const rd = World.roadDist ? World.roadDist(x, z) : 99;
  if (rd < 14) { const w = 1 - rd / 14; h = lerp(h, World.roadHeight(x, z), w * 0.85); }
  return h;
}
function zoneOf(x, z) {
  if (dist2(x, z, 0, 0) < 330 * 330) return 'Haven';
  if (dist2(x, z, LOC.scrapyard.x, LOC.scrapyard.z) < 180 * 180) return 'Scrapyard 9';
  if (dist2(x, z, LOC.foundry.x, LOC.foundry.z) < 230 * 230) return 'The Foundry';
  if (x > 300 && z < 100) return 'Rustveil Canyon';
  if (x > 150 && z > 300) return 'Greenwire Woods';
  if (x < -150 && z > -150) return 'Ashfield Plains';
  return 'The Wilds';
}

const World = {
  colliders: [], grid: new Map(), CELL: 40, roadSegs: [], scene: null, timeOfDay: 0.3,
  sun: null, hemi: null, skyMat: null, windowMat: null, shield: null, relayLight: null, foundryCore: null, beacons: [],
  roadDist(x, z) {
    let best = 1e9;
    for (const s of this.roadSegs) {
      const dx = s.bx - s.ax, dz = s.bz - s.az; const t = clamp(((x - s.ax) * dx + (z - s.az) * dz) / (dx * dx + dz * dz), 0, 1);
      const px = s.ax + dx * t, pz = s.az + dz * t; const d = (x - px) * (x - px) + (z - pz) * (z - pz); if (d < best) { best = d; this._rt = t; this._rs = s; }
    }
    return Math.sqrt(best);
  },
  roadHeight(x, z) { const s = this._rs; if (!s) return 0; return lerp(s.ah, s.bh, this._rt); },
  addBox(minX, maxX, minZ, maxZ, top) {
    const c = { type: 'box', minX, maxX, minZ, maxZ, top };
    this.colliders.push(c); this._index(c, minX, maxX, minZ, maxZ); return c;
  },
  addCyl(x, z, r, top) { const c = { type: 'cyl', x, z, r, top }; this.colliders.push(c); this._index(c, x - r, x + r, z - r, z + r); return c; },
  _index(c, minX, maxX, minZ, maxZ) {
    for (let gx = Math.floor(minX / this.CELL); gx <= Math.floor(maxX / this.CELL); gx++)
      for (let gz = Math.floor(minZ / this.CELL); gz <= Math.floor(maxZ / this.CELL); gz++) {
        const k = gx + ',' + gz; if (!this.grid.has(k)) this.grid.set(k, []); this.grid.get(k).push(c);
      }
  },
  // push a circle (x,z,r) at height y out of colliders; returns true if hit
  collide(p, r, y) {
    let hit = false;
    const gx = Math.floor(p.x / this.CELL), gz = Math.floor(p.z / this.CELL);
    const seen = new Set();
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
      const list = this.grid.get((gx + i) + ',' + (gz + j)); if (!list) continue;
      for (const c of list) {
        if (seen.has(c)) continue; seen.add(c);
        if (y > c.top - 0.5) continue;
        if (c.type === 'box') {
          const cx = clamp(p.x, c.minX, c.maxX), cz = clamp(p.z, c.minZ, c.maxZ);
          let dx = p.x - cx, dz = p.z - cz; const d2 = dx * dx + dz * dz;
          if (d2 < r * r) {
            hit = true;
            if (d2 > 1e-6) { const d = Math.sqrt(d2); p.x = cx + dx / d * r; p.z = cz + dz / d * r; }
            else { // inside box: push out nearest side
              const l = p.x - c.minX, rr = c.maxX - p.x, b = p.z - c.minZ, f = c.maxZ - p.z; const m = Math.min(l, rr, b, f);
              if (m === l) p.x = c.minX - r; else if (m === rr) p.x = c.maxX + r; else if (m === b) p.z = c.minZ - r; else p.z = c.maxZ + r;
            }
          }
        } else {
          const dx = p.x - c.x, dz = p.z - c.z; const d = Math.hypot(dx, dz); const m = r + c.r;
          if (d < m) { hit = true; const k = d > 1e-4 ? m / d : 1; p.x = c.x + dx * k; p.z = c.z + (d > 1e-4 ? dz * k : m); }
        }
      }
    }
    p.x = clamp(p.x, -HALF + 30, HALF - 30); p.z = clamp(p.z, -HALF + 30, HALF - 30);
    return hit;
  },
  // top of any collider under point (for standing on roofs)
  supportHeight(x, z, y) {
    let h = terrainHeight(x, z);
    const list = this.grid.get(Math.floor(x / this.CELL) + ',' + Math.floor(z / this.CELL));
    if (list) for (const c of list) {
      if (c.top > y + 1.2) continue;
      if (c.type === 'box') { if (x >= c.minX && x <= c.maxX && z >= c.minZ && z <= c.maxZ) h = Math.max(h, c.top); }
      else if (dist2(x, z, c.x, c.z) < c.r * c.r) h = Math.max(h, c.top);
    }
    return h;
  },

  build(scene) {
    this.scene = scene;
    // road segments first (terrain uses them)
    for (const r of ROADS) for (let i = 0; i < r.length - 1; i++) {
      const a = r[i], b = r[i + 1];
      this.roadSegs.push({ ax: a.x, az: a.z, bx: b.x, bz: b.z, ah: 0, bh: 0 });
    }
    for (const s of this.roadSegs) { s.ah = this._flatH(s.ax, s.az); s.bh = this._flatH(s.bx, s.bz); }
    this.buildSky(scene);
    this.buildTerrain(scene);
    this.buildRoads(scene);
    this.buildCity(scene);
    this.buildScrapyard(scene);
    this.buildFoundry(scene);
    this.buildRelay(scene);
    this.buildNature(scene);
    this.buildRuins(scene);
  },
  _flatH(x, z) { let h = rawHeight(x, z); for (const f of FLATS) { const d = Math.sqrt(dist2(x, z, f.x, f.z)); if (d < f.r * 1.6) { const w = 1 - clamp((d - f.r) / (f.r * 0.6), 0, 1); h = lerp(h, f.h, w * w * (3 - 2 * w)); } } return h; },

  buildSky(scene) {
    const geo = new THREE.SphereGeometry(800, 24, 12);
    this.skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false,
      uniforms: { top: { value: new THREE.Color(0x2a6fd6) }, bottom: { value: new THREE.Color(0xf2c48a) }, sunDir: { value: new THREE.Vector3(0, 1, 0) }, night: { value: 0 } },
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0);} ',
      fragmentShader: `uniform vec3 top; uniform vec3 bottom; uniform vec3 sunDir; uniform float night; varying vec3 vP;
        float h21(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }
        void main(){ float h = clamp(vP.y*1.4+0.15,0.0,1.0); vec3 c = mix(bottom, top, h);
          float s = max(dot(vP, normalize(sunDir)),0.0); c += vec3(1.0,0.8,0.5)*pow(s,200.0)*2.0 + vec3(1.0,0.6,0.3)*pow(s,8.0)*0.25*(1.0-night);
          vec2 g = floor(vP.xz/(vP.y+1.2)*180.0); float st = step(0.997, h21(g)) * night * step(0.05, vP.y);
          c += vec3(st);
          gl_FragColor = vec4(c,1.0);} `
    });
    this.sky = new THREE.Mesh(geo, this.skyMat); this.sky.renderOrder = -10; this.sky.frustumCulled = false; scene.add(this.sky);
    this.sun = new THREE.DirectionalLight(0xfff1dd, 1.6); scene.add(this.sun); scene.add(this.sun.target);
    this.hemi = new THREE.HemisphereLight(0xbcd8ff, 0x5a4a3a, 0.9); scene.add(this.hemi);
    scene.fog = new THREE.Fog(0xcfd9e6, 120, 900);
  },
  updateSky(dt, playerPos) {
    this.timeOfDay = (this.timeOfDay + dt / 480) % 1; // 8 min full day
    const ang = this.timeOfDay * TAU - Math.PI / 2;
    const sy = Math.sin(ang), sx = Math.cos(ang);
    const dir = new THREE.Vector3(sx, sy, 0.35).normalize();
    const day = clamp(sy * 3 + 0.3, 0, 1); const night = 1 - day; const dusk = clamp(1 - Math.abs(sy) * 4, 0, 1);
    this.skyMat.uniforms.sunDir.value.copy(dir);
    this.skyMat.uniforms.night.value = night;
    const top = new THREE.Color(0x2a6fd6).lerp(new THREE.Color(0x050a1c), night);
    const bot = new THREE.Color(0xcfe0f0).lerp(new THREE.Color(0xff8a4a), dusk * 0.8).lerp(new THREE.Color(0x0d1428), night * 0.9);
    this.skyMat.uniforms.top.value.copy(top); this.skyMat.uniforms.bottom.value.copy(bot);
    this.scene.fog.color.copy(bot);
    this.sun.intensity = 0.15 + day * 1.5; this.sun.color.setHex(dusk > 0.5 ? 0xffb07a : 0xfff1dd);
    if (sy < 0) { this.sun.position.set(-sx, -sy, 0.3).multiplyScalar(300).add(playerPos); this.sun.intensity = 0.25; this.sun.color.setHex(0x8899ff); }
    else this.sun.position.copy(dir).multiplyScalar(300).add(playerPos);
    this.sun.target.position.copy(playerPos);
    this.hemi.intensity = 0.35 + day * 0.6;
    this.sky.position.copy(Game.camera.position);
    if (this.windowMat) this.windowMat.emissiveIntensity = 0.15 + night * 1.1;
    return night;
  },

  buildTerrain(scene) {
    const SEG = 220;
    const geo = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, SEG, SEG); geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position; const cols = new Float32Array(pos.count * 3);
    const cGrass = new THREE.Color(0x5d8a3a), cGrass2 = new THREE.Color(0x3f6b2c), cSand = new THREE.Color(0xc79a5b), cSand2 = new THREE.Color(0xa86f3c), cRock = new THREE.Color(0x6e6a66), cAsh = new THREE.Color(0x3a3533), cCity = new THREE.Color(0x6c7075), cSnow = new THREE.Color(0xe8eef2), c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i); const h = terrainHeight(x, z); pos.setY(i, h);
      const n = fbm(x * 0.03, z * 0.03, 2);
      const zone = zoneOf(x, z);
      if (zone === 'Haven') c.copy(cCity).lerp(cGrass, clamp((Math.hypot(x, z) - 250) / 80, 0, 1));
      else if (zone === 'Rustveil Canyon') c.copy(cSand).lerp(cSand2, n);
      else if (zone === 'The Foundry' || zone === 'Scrapyard 9') c.copy(cAsh).lerp(cRock, n * 0.6);
      else c.copy(cGrass).lerp(cGrass2, n);
      if (h > 60) c.lerp(cRock, clamp((h - 60) / 40, 0, 1));
      if (h > 140) c.lerp(cSnow, clamp((h - 140) / 40, 0, 1));
      cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(cols, 3)); geo.computeVertexNormals();
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
    const m = new THREE.Mesh(geo, mat); scene.add(m); this.terrain = m;
    // water lake in the south-east lowlands
    const water = new THREE.Mesh(new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE), new THREE.MeshPhongMaterial({ color: 0x2b6c9e, transparent: true, opacity: 0.75, shininess: 90 }));
    water.rotation.x = -Math.PI / 2; water.position.y = -12; scene.add(water); this.water = water;
  },
  buildRoads(scene) {
    const verts = [], idx = []; let base = 0; const W = 7;
    for (const s of this.roadSegs) {
      const len = Math.hypot(s.bx - s.ax, s.bz - s.az); const n = Math.ceil(len / 6);
      const dx = (s.bx - s.ax) / len, dz = (s.bz - s.az) / len; const px = -dz, pz = dx;
      for (let i = 0; i <= n; i++) {
        const t = i / n; const x = lerp(s.ax, s.bx, t), z = lerp(s.az, s.bz, t);
        const xl = x + px * W, zl = z + pz * W, xr = x - px * W, zr = z - pz * W;
        verts.push(xl, terrainHeight(xl, zl) + 0.25, zl, xr, terrainHeight(xr, zr) + 0.25, zr);
        if (i < n) { idx.push(base, base + 1, base + 2, base + 1, base + 3, base + 2); }
        base += 2;
      }
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3)); geo.setIndex(idx); geo.computeVertexNormals();
    const tex = this.makeRoadTex();
    const uvs = []; for (let i = 0; i < verts.length / 3; i += 2) { uvs.push(0, i * 0.5, 1, i * 0.5); }
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: tex, polygonOffset: true, polygonOffsetFactor: -2 })); scene.add(m);
  },
  makeRoadTex() {
    const cv = document.createElement('canvas'); cv.width = 64; cv.height = 64; const g = cv.getContext('2d');
    g.fillStyle = '#3a3c40'; g.fillRect(0, 0, 64, 64); g.fillStyle = '#d9c44a'; g.fillRect(30, 0, 4, 32);
    g.fillStyle = '#ddd'; g.fillRect(2, 0, 2, 64); g.fillRect(60, 0, 2, 64);
    const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
  },
  makeWindowTex() {
    const cv = document.createElement('canvas'); cv.width = 64; cv.height = 128; const g = cv.getContext('2d');
    g.fillStyle = '#2b3038'; g.fillRect(0, 0, 64, 128);
    for (let y = 4; y < 128; y += 12) for (let x = 4; x < 64; x += 12) { g.fillStyle = Math.random() < 0.55 ? '#ffd27a' : '#1a2a3a'; g.fillRect(x, y, 7, 7); }
    const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
  },
  buildCity(scene) {
    const r = mulberry(7);
    const wt = this.makeWindowTex();
    this.windowMat = new THREE.MeshLambertMaterial({ map: wt, emissive: 0xffffff, emissiveMap: wt, emissiveIntensity: 0.2 });
    const boxGeo = new THREE.BoxGeometry(1, 1, 1); boxGeo.translate(0, 0.5, 0);
    const list = [];
    const BLOCK = 64;
    for (let bx = -4; bx <= 4; bx++) for (let bz = -4; bz <= 4; bz++) {
      const cx = bx * BLOCK, cz = bz * BLOCK;
      if (Math.hypot(cx, cz) > 270) continue;
      if (Math.abs(bx) <= 1 && Math.abs(bz) <= 1) continue; // central plaza
      if (bz === 0 || bx === 0) continue; // main avenues
      // 2x2 buildings per block
      for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
        if (r() < 0.15) continue;
        const w = 16 + r() * 8, d = 16 + r() * 8; const dc = Math.hypot(cx, cz);
        const h = 12 + r() * (dc < 160 ? 70 : 30);
        const x = cx - 13 + i * 26, z = cz - 13 + j * 26;
        list.push({ x, z, w, d, h });
      }
    }
    const im = new THREE.InstancedMesh(boxGeo, this.windowMat, list.length);
    const mtx = new THREE.Matrix4(); const col = new THREE.Color();
    list.forEach((b, i) => {
      const y = terrainHeight(b.x, b.z) - 1;
      mtx.compose(new THREE.Vector3(b.x, y, b.z), new THREE.Quaternion(), new THREE.Vector3(b.w, b.h, b.d)); im.setMatrixAt(i, mtx);
      col.setHSL(0.58 + r() * 0.1, 0.1, 0.55 + r() * 0.3); im.setColorAt(i, col);
      this.addBox(b.x - b.w / 2, b.x + b.w / 2, b.z - b.d / 2, b.z + b.d / 2, y + b.h);
    });
    scene.add(im);
    // rooftop glow strips
    // plaza: Elder statue base and fountain ring
    const plaza = new THREE.Mesh(new THREE.CylinderGeometry(36, 36, 0.6, 40), new THREE.MeshLambertMaterial({ color: 0x8a8f96 }));
    plaza.position.set(0, terrainHeight(0, 0) + 0.3, 0); scene.add(plaza);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(10, 0.8, 8, 40), new THREE.MeshBasicMaterial({ color: 0x47e0ff }));
    ring.rotation.x = Math.PI / 2; ring.position.set(0, terrainHeight(0, 0) + 1, 0); scene.add(ring); this.plazaRing = ring;
    // Haven shield dome (activated by story)
    const sh = new THREE.Mesh(new THREE.SphereGeometry(300, 32, 16, 0, TAU, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x55d6ff, transparent: true, opacity: 0.08, side: THREE.DoubleSide, depthWrite: false }));
    sh.position.set(0, 0, 0); sh.visible = false; scene.add(sh); this.shield = sh;
    // garage
    const gy = terrainHeight(LOC.garage.x, LOC.garage.z);
    const gar = new THREE.Group();
    const g1 = new THREE.Mesh(new THREE.BoxGeometry(22, 10, 16), new THREE.MeshLambertMaterial({ color: 0x404a58 })); g1.position.y = 5; gar.add(g1);
    const sign = new THREE.Mesh(new THREE.BoxGeometry(14, 2.5, 0.4), new THREE.MeshBasicMaterial({ color: 0xffa53a })); sign.position.set(0, 11.5, 8); gar.add(sign);
    gar.position.set(LOC.garage.x + 14, gy, LOC.garage.z); scene.add(gar);
    this.addBox(LOC.garage.x + 3, LOC.garage.x + 25, LOC.garage.z - 8, LOC.garage.z + 8, gy + 10);
    // streetlights along avenues
    const lampGeo = new THREE.CylinderGeometry(0.2, 0.3, 8, 6); lampGeo.translate(0, 4, 0);
    const lamps = new THREE.InstancedMesh(lampGeo, new THREE.MeshLambertMaterial({ color: 0x333333 }), 40);
    const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.6, 8, 6), new THREE.MeshBasicMaterial({ color: 0xfff0b0 }), 40);
    let k = 0;
    for (let i = -5; i <= 5; i++) { if (i === 0) continue; for (const s of [-1, 1]) { if (k >= 40) break; const x = i * 26, z = s * 10; const y = terrainHeight(x, z); mtx.makeTranslation(x, y, z); lamps.setMatrixAt(k, mtx); mtx.makeTranslation(x, y + 8.2, z); bulbs.setMatrixAt(k, mtx); k++; } }
    for (let i = -5; i <= 5 && k < 40; i++) { if (i === 0) continue; const x = 10, z = i * 26; const y = terrainHeight(x, z); mtx.makeTranslation(x, y, z); lamps.setMatrixAt(k, mtx); mtx.makeTranslation(x, y + 8.2, z); bulbs.setMatrixAt(k, mtx); k++; }
    lamps.count = k; bulbs.count = k; scene.add(lamps); scene.add(bulbs);
  },
  buildScrapyard(scene) {
    const r = mulberry(11); const L = LOC.scrapyard;
    const geo = new THREE.ConeGeometry(1, 1, 6); geo.translate(0, 0.5, 0);
    const N = 38; const im = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ color: 0x6b5a4a }), N);
    const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), col = new THREE.Color();
    for (let i = 0; i < N; i++) {
      const a = r() * TAU, d = 30 + r() * 80; const x = L.x + Math.cos(a) * d, z = L.z + Math.sin(a) * d;
      const s = 5 + r() * 9, h = 4 + r() * 10;
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), r() * TAU);
      mtx.compose(new THREE.Vector3(x, terrainHeight(x, z) - 0.5, z), q, new THREE.Vector3(s, h, s)); im.setMatrixAt(i, mtx);
      col.setHSL(0.05 + r() * 0.06, 0.3, 0.25 + r() * 0.2); im.setColorAt(i, col);
      this.addCyl(x, z, s * 0.7, terrainHeight(x, z) + h * 0.8);
    }
    scene.add(im);
    // wrecked car shells
    const shell = new THREE.InstancedMesh(new THREE.BoxGeometry(4, 1.6, 8), new THREE.MeshLambertMaterial({ color: 0x8a4a2a }), 14);
    for (let i = 0; i < 14; i++) { const a = r() * TAU, d = 15 + r() * 60; const x = L.x + Math.cos(a) * d, z = L.z + Math.sin(a) * d; q.setFromEuler(new THREE.Euler(r() * 0.5, r() * TAU, r() * 0.6)); mtx.compose(new THREE.Vector3(x, terrainHeight(x, z) + 0.8, z), q, new THREE.Vector3(1, 1, 1)); shell.setMatrixAt(i, mtx); }
    scene.add(shell);
    // crane
    const cm = new THREE.MeshLambertMaterial({ color: 0xd9a42a });
    const tower = new THREE.Mesh(new THREE.BoxGeometry(3, 40, 3), cm); const ty = terrainHeight(L.x + 40, L.z - 40); tower.position.set(L.x + 40, ty + 20, L.z - 40); scene.add(tower);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(50, 2, 2), cm); arm.position.set(L.x + 25, ty + 40, L.z - 40); scene.add(arm);
    this.addBox(L.x + 38.5, L.x + 41.5, L.z - 41.5, L.z - 38.5, ty + 40);
    // fence ring
    const fence = new THREE.Mesh(new THREE.TorusGeometry(125, 0.4, 4, 64), new THREE.MeshLambertMaterial({ color: 0x555555 })); fence.rotation.x = Math.PI / 2; fence.position.set(L.x, terrainHeight(L.x, L.z) + 3, L.z); scene.add(fence);
  },
  buildFoundry(scene) {
    const L = LOC.foundry; const y0 = terrainHeight(L.x, L.z);
    const dark = new THREE.MeshLambertMaterial({ color: 0x2a2530 }), glowM = new THREE.MeshBasicMaterial({ color: 0xff5a1f });
    // ring walls with gaps
    for (let i = 0; i < 16; i++) {
      if (i === 3 || i === 4) continue; // entrance facing north-east (towards Haven)
      const a = i / 16 * TAU; const x = L.x + Math.cos(a) * 140, z = L.z + Math.sin(a) * 140;
      const w = new THREE.Mesh(new THREE.BoxGeometry(52, 22, 6), dark); w.position.set(x, y0 + 11, z); w.rotation.y = -a + Math.PI / 2; scene.add(w);
      // approximate collider with cylinders along the wall
      for (let k = -2; k <= 2; k++) { const tx = x + Math.cos(a + Math.PI / 2) * k * 11, tz = z + Math.sin(a + Math.PI / 2) * k * 11; this.addCyl(tx, tz, 6, y0 + 22); }
    }
    // chimneys
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * TAU + 0.3; const x = L.x + Math.cos(a) * 95, z = L.z + Math.sin(a) * 95;
      const c = new THREE.Mesh(new THREE.CylinderGeometry(5, 7, 60, 10), dark); c.position.set(x, y0 + 30, z); scene.add(c);
      const g = new THREE.Mesh(new THREE.CylinderGeometry(5.2, 5.2, 3, 10), glowM); g.position.set(x, y0 + 59, z); scene.add(g);
      this.addCyl(x, z, 7, y0 + 60);
    }
    // central core
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(9, 1), new THREE.MeshBasicMaterial({ color: 0xff3a1a, wireframe: false }));
    core.position.set(L.x, y0 + 26, L.z); scene.add(core); this.foundryCore = core;
    const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(10, 16, 16, 8), dark); pedestal.position.set(L.x, y0 + 8, L.z); scene.add(pedestal);
    this.addCyl(L.x, L.z, 15, y0 + 16);
    const coreLight = new THREE.PointLight(0xff4a1a, 3, 200); coreLight.position.copy(core.position); scene.add(coreLight);
    // lava channels
    const lava = new THREE.Mesh(new THREE.RingGeometry(40, 46, 48), glowM); lava.rotation.x = -Math.PI / 2; lava.position.set(L.x, y0 + 0.3, L.z); scene.add(lava);
  },
  buildRelay(scene) {
    const L = LOC.relay; const y0 = terrainHeight(L.x, L.z);
    const m = new THREE.MeshLambertMaterial({ color: 0x9aa4b0 });
    for (let i = 0; i < 4; i++) {
      const a = i / 4 * TAU + Math.PI / 4; const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 1.2, 70, 6), m);
      leg.position.set(L.x + Math.cos(a) * 5, y0 + 35, L.z + Math.sin(a) * 5); leg.rotation.set(Math.sin(a) * 0.08, 0, -Math.cos(a) * 0.08); scene.add(leg);
    }
    for (let h = 10; h < 70; h += 12) { const ring = new THREE.Mesh(new THREE.TorusGeometry(5.5 - h * 0.04, 0.3, 4, 12), m); ring.rotation.x = Math.PI / 2; ring.position.set(L.x, y0 + h, L.z); scene.add(ring); }
    const dish = new THREE.Mesh(new THREE.SphereGeometry(6, 16, 8, 0, TAU, 0, Math.PI / 3), new THREE.MeshLambertMaterial({ color: 0xdddddd, side: THREE.DoubleSide })); dish.position.set(L.x, y0 + 66, L.z); dish.rotation.x = Math.PI * 0.75; scene.add(dish);
    const light = new THREE.Mesh(new THREE.SphereGeometry(1.5, 10, 8), new THREE.MeshBasicMaterial({ color: 0xff2222 })); light.position.set(L.x, y0 + 72, L.z); scene.add(light); this.relayLight = light;
    this.addCyl(L.x, L.z, 6, y0 + 70);
    // platform
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(18, 18, 0.5, 24), new THREE.MeshLambertMaterial({ color: 0x555b66 })); pad.position.set(L.x, y0 + 0.25, L.z); scene.add(pad);
    // outpost huts
    const O = LOC.outpost; const r = mulberry(5);
    for (let i = 0; i < 7; i++) { const a = r() * TAU, d = 20 + r() * 45; const x = O.x + Math.cos(a) * d, z = O.z + Math.sin(a) * d; const y = terrainHeight(x, z); const w = 8 + r() * 6, h = 5 + r() * 5; const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), new THREE.MeshLambertMaterial({ color: 0x5a3a4a })); b.position.set(x, y + h / 2, z); scene.add(b); this.addBox(x - w / 2, x + w / 2, z - w / 2, z + w / 2, y + h); }
  },
  buildNature(scene) {
    const r = mulberry(99);
    const trunkG = new THREE.CylinderGeometry(0.5, 0.7, 4, 5); trunkG.translate(0, 2, 0);
    const leafG = new THREE.ConeGeometry(3.5, 9, 7); leafG.translate(0, 8, 0);
    const N = 650;
    const trunks = new THREE.InstancedMesh(trunkG, new THREE.MeshLambertMaterial({ color: 0x5a3d26 }), N);
    const leaves = new THREE.InstancedMesh(leafG, new THREE.MeshLambertMaterial({ color: 0x2f6b34 }), N);
    const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), col = new THREE.Color(); let k = 0;
    for (let tries = 0; tries < 6000 && k < N; tries++) {
      const x = (r() - 0.5) * 1700, z = (r() - 0.5) * 1700;
      const zone = zoneOf(x, z); if (zone === 'Haven' || zone === 'The Foundry' || zone === 'Rustveil Canyon' || zone === 'Scrapyard 9') continue;
      const dens = zone === 'Greenwire Woods' ? 0.9 : 0.12; if (r() > dens) continue;
      if (this.roadDist(x, z) < 14) continue;
      const y = terrainHeight(x, z); if (y < -10 || y > 110) continue;
      const s = 0.8 + r() * 0.8;
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), r() * TAU);
      mtx.compose(new THREE.Vector3(x, y - 0.3, z), q, new THREE.Vector3(s, s, s)); trunks.setMatrixAt(k, mtx); leaves.setMatrixAt(k, mtx);
      col.setHSL(0.28 + r() * 0.08, 0.45, 0.22 + r() * 0.12); leaves.setColorAt(k, col);
      this.addCyl(x, z, 1.2 * s, y + 12 * s); k++;
    }
    trunks.count = k; leaves.count = k; scene.add(trunks); scene.add(leaves);
    // canyon rocks
    const rockG = new THREE.DodecahedronGeometry(1, 0);
    const R = 160; const rocks = new THREE.InstancedMesh(rockG, new THREE.MeshLambertMaterial({ color: 0x9a6a44 }), R); k = 0;
    for (let tries = 0; tries < 3000 && k < R; tries++) {
      const x = 300 + r() * 600, z = -700 + r() * 800; if (zoneOf(x, z) !== 'Rustveil Canyon') continue; if (this.roadDist(x, z) < 15) continue;
      if (dist2(x, z, LOC.relay.x, LOC.relay.z) < 60 * 60 || dist2(x, z, LOC.outpost.x, LOC.outpost.z) < 80 * 80) continue;
      const s = 2 + r() * 7; const y = terrainHeight(x, z);
      q.setFromEuler(new THREE.Euler(r() * 3, r() * 3, r() * 3)); mtx.compose(new THREE.Vector3(x, y + s * 0.3, z), q, new THREE.Vector3(s, s * (0.6 + r() * 0.8), s)); rocks.setMatrixAt(k, mtx);
      col.setHSL(0.06 + r() * 0.03, 0.4, 0.3 + r() * 0.15); rocks.setColorAt(k, col);
      this.addCyl(x, z, s * 0.85, y + s); k++;
    }
    rocks.count = k; scene.add(rocks);
  },
  buildRuins(scene) {
    const L = LOC.ruins; const r = mulberry(21);
    const m = new THREE.MeshLambertMaterial({ color: 0x8f8a7a });
    for (let i = 0; i < 14; i++) {
      const a = r() * TAU, d = 10 + r() * 55; const x = L.x + Math.cos(a) * d, z = L.z + Math.sin(a) * d; const y = terrainHeight(x, z);
      const h = 4 + r() * 18; const p = new THREE.Mesh(new THREE.BoxGeometry(3, h, 3), m); p.position.set(x, y + h / 2, z); p.rotation.z = (r() - 0.5) * 0.2; scene.add(p);
      this.addBox(x - 1.5, x + 1.5, z - 1.5, z + 1.5, y + h);
    }
    // giant fallen Shiftborn statue head
    const head = new THREE.Mesh(new THREE.BoxGeometry(14, 12, 14), new THREE.MeshLambertMaterial({ color: 0x6e7a86 }));
    const hy = terrainHeight(L.x, L.z); head.position.set(L.x, hy + 4, L.z); head.rotation.set(0.3, 0.6, 0.2); scene.add(head);
    const visor = new THREE.Mesh(new THREE.BoxGeometry(10, 2, 1), new THREE.MeshBasicMaterial({ color: 0x47e0ff })); visor.position.set(0, 1, 7.1); head.add(visor);
    this.addCyl(L.x, L.z, 9, hy + 10);
  },
  update(dt, t) {
    if (this.relayLight) this.relayLight.material.color.setHex((t * 2 | 0) % 2 ? 0xff2222 : 0x330000);
    if (this.foundryCore) { this.foundryCore.rotation.y += dt * 0.5; this.foundryCore.rotation.x += dt * 0.3; const s = 1 + Math.sin(t * 3) * 0.05; this.foundryCore.scale.setScalar(s); }
    if (this.plazaRing) this.plazaRing.rotation.z += dt;
    if (this.water) this.water.position.y = -12 + Math.sin(t * 0.5) * 0.2;
  }
};
