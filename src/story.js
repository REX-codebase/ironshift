// ===== IRONSHIFT story, missions, races, shop =====
const WHO = {
  VEGA: { name: 'VEGA', color: '#5ff6ff' },
  YOU: { name: 'VANGUARD', color: '#ff5a5a' },
  ELDER: { name: 'ELDER BASTION', color: '#9dffb0' },
  KRAXX: { name: 'WARLORD KRAXX', color: '#ff8a30' },
  SEEKER: { name: 'SEEKER', color: '#ffd84a' },
  MEMORY: { name: '▌MEMORY FRAGMENT', color: '#c9a7ff' },
};
const SHARD_SPOTS = [
  [-560, 600], [-700, 380], [-420, 230], [-250, 420], [-120, -150], [200, 230], [330, 420], [520, 660], [640, 300], [820, -50],
  [470, -150], [720, -300], [400, -620], [140, -560], [-140, -700], [-380, -300], [-760, -420], [-820, 120], [-60, 820], [260, -40],
];
const LORE = [
  'Before the Foundry, Ferrum had a thousand Shiftborn cities. Haven is the last.',
  'Shiftborn change form by Spark resonance. No Spark, no shift.',
  'The Rustborn were Shiftborn once. Kraxx gave them armor that never shifts.',
  'Your designation, AX-7, was assigned by the Foundry. "Vanguard" was the name Seeker gave you.',
  'Elder Bastion has not transformed in 900 cycles. He says he no longer needs to.',
  'Scrapyard 9 is where the Foundry dumps the units it fails to rewrite.',
  'VEGA was launched to watch the sky. Now she mostly watches you.',
  'Greenwire Woods grew from copper seeds planted by the first Shiftborn.',
  'The Relay Spire once linked every city on Ferrum. Kraxx cut the line first.',
  'Seeker can outrun anything on four wheels. She never let you forget it.',
  'Rustveil Canyon is red because the rock is full of oxidized Spark.',
  'The Foundry core burns stolen Sparks. Every flare is someone\'s memory.',
  'Kraxx was a builder. He wanted a world where nothing ever changed again.',
  'You were his best lieutenant. You led three raids on Haven.',
  'On the fourth raid you saw the children of Haven shifting for the first time. You stopped.',
  'Seeker opened the Foundry gate for you. She stayed behind to close it.',
  'The Rustborn cannot transform. That is why they fear you.',
  'The old ruins were a school. The giant head was its teacher.',
  'Every Spark Shard you return makes Haven\'s shield a little brighter.',
  'All memory restored. You are Vanguard. You chose this.',
];
const RACES = [
  { id: 'r1', name: 'Greenwire Sprint', start: [40, 70], cps: [[250, 300], [420, 520], [750, 100], [560, -330]], par: 42 },
  { id: 'r2', name: 'Ashfield Run', start: [-120, 60], cps: [[-300, 300], [-620, 520], [-300, 140], [-120, 60]], par: 48 },
  { id: 'r3', name: 'Canyon Dash', start: [250, -120], cps: [[560, -330], [690, -520], [450, -470], [250, -120]], par: 40 },
];
const RACE_ROUTE_FOUNDRY = [[450, -470], [150, -420], [-200, -460], [-525, -500]];
const UPGRADES = [
  { id: 'armor', name: 'Plating', desc: '+30 max HP, -5% damage taken' },
  { id: 'blaster', name: 'Ion Blaster', desc: '+4 damage per shot' },
  { id: 'engine', name: 'Spark Engine', desc: '+12% speed in both modes' },
  { id: 'cell', name: 'Energy Cell', desc: 'Faster boost/double-jump recharge' },
];
const upCost = l => [80, 160, 280, 450, 700][l] || 0;

const Story = {
  step: 0, sTime: 0, data: {}, marker: null, cpRing: null, npcs: {}, storyShards: [],
  init(scene) {
    // waypoint beam
    const g = new THREE.CylinderGeometry(1.2, 1.2, 400, 8, 1, true); g.translate(0, 200, 0);
    this.marker = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0xffc23a, transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide })); scene.add(this.marker);
    this.cpRing = new THREE.Mesh(new THREE.TorusGeometry(12, 1, 8, 32), new THREE.MeshBasicMaterial({ color: 0xffc23a })); this.cpRing.visible = false; scene.add(this.cpRing);
    // NPCs
    const elder = new Rig('elder', 1.7); const ey = terrainHeight(LOC.elder.x, LOC.elder.z); elder.root.position.set(LOC.elder.x, ey, LOC.elder.z); elder.root.rotation.y = 0; scene.add(elder.root); scene.add(elder.shadow); elder.shadow.position.set(LOC.elder.x, ey + 0.2, LOC.elder.z); this.npcs.elder = elder; World.addCyl(LOC.elder.x, LOC.elder.z, 4, ey + 15);
    const seeker = new Rig('seeker', 0.9); seeker.root.visible = false; seeker.shadow.visible = false; scene.add(seeker.root); scene.add(seeker.shadow); this.npcs.seeker = seeker;
    // race start pillars
    this.raceMarks = RACES.map(r => { const m = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 1, 16), new THREE.MeshBasicMaterial({ color: 0xff3ad0, transparent: true, opacity: 0.7 })); m.position.set(r.start[0], terrainHeight(r.start[0], r.start[1]) + 0.5, r.start[1]); scene.add(m); const b = new THREE.Mesh(this.marker.geometry, new THREE.MeshBasicMaterial({ color: 0xff3ad0, transparent: true, opacity: 0.25, depthWrite: false })); b.scale.set(1.2, 0.15, 1.2); m.add(b); return m; });
  },
  campsAllowed(id) { return this.step >= 4; },
  respawnPoint() {
    if (this.step < 4) return LOC.scrapyard;
    if (this.step >= 13 && this.step < 14) return { x: -525, z: -480 };
    if (this.step >= 10 && this.step <= 12) return { x: 640, z: -470 };
    return { x: 0, z: 40 };
  },
  start(step) { this.step = step; this.sTime = 0; this.data = {}; const s = STEPS[step]; if (s && s.enter) s.enter(this.data); Game.save.step = step; Game.saveGame(); UI.setObjective(this.objText()); if (s && s.chapter) UI.chapter(s.chapter); },
  next() { this.start(this.step + 1); },
  objText() { const s = STEPS[this.step]; if (!s) return ''; return typeof s.obj === 'function' ? s.obj(this.data) : s.obj; },
  waypoint() { if (Race.active) return Race.wp(); const s = STEPS[this.step]; return s && s.wp ? s.wp(this.data) : null; },
  update(dt) {
    this.sTime += dt; const s = STEPS[this.step];
    if (s && s.update && !Game.player.dead) { if (s.update(this.data, dt)) this.next(); }
    UI.setObjective(Race.active ? Race.text() : this.objText());
    const wp = this.waypoint();
    if (wp) { this.marker.visible = true; this.marker.position.set(wp.x, terrainHeight(wp.x, wp.z), wp.z); this.marker.material.opacity = 0.25 + Math.sin(Game.time * 4) * 0.1; }
    else this.marker.visible = false;
    // npcs idle anim
    const e = this.npcs.elder; e.walk += dt * 0.5; e.walkAmt = 0; const P = Game.player;
    const want = Math.atan2(P.pos.x - LOC.elder.x, P.pos.z - LOC.elder.z); e.root.rotation.y += angleDiff(e.root.rotation.y, want) * dt * 2 * (dist2(P.pos.x, P.pos.z, LOC.elder.x, LOC.elder.z) < 60 * 60 ? 1 : 0); e.update(dt);
    const sk = this.npcs.seeker; if (sk.root.visible) { sk.update(dt); }
    for (const m of this.raceMarks) { m.rotation.y += dt; m.visible = this.step >= 9 && !Race.active; }
  },
  event(kind, arg) {
    const s = STEPS[this.step]; if (s && s.on) s.on(this.data, kind, arg);
  },
  onShard(id) { this.data.got = (this.data.got || 0) + 1; Game.save.storyShards = this.data.got; Game.saveGame(); UI.toast('Haven Spark Shard recovered', this.data.got + '/3'); },
  spawnStoryShards() {
    const spots = [[170, 150], [-210, -80], [80, -250]];
    this.data.got = 0;
    spots.forEach((p, i) => { Pickups.add('shard', p[0], terrainHeight(p[0], p[1]) + 3, p[1], { story: true, id: 's' + i }); });
  },
  nearestStoryShard() {
    let best = null, bd = 1e12; const P = Game.player.pos;
    for (const p of Pickups.list) if (p.kind === 'shard' && p.data.story && !p.dead) { const d = dist2(p.m.position.x, p.m.position.z, P.x, P.z); if (d < bd) { bd = d; best = { x: p.m.position.x, z: p.m.position.z }; } }
    return best;
  },
};
const near = (pt, r) => dist2(Game.player.pos.x, Game.player.pos.z, pt.x, pt.z) < r * r;
const pt = (x, z) => ({ x, z });
const GATE = (() => { const dx = -300 - LOC.scrapyard.x, dz = 300 - LOC.scrapyard.z; const l = Math.hypot(dx, dz); return pt(LOC.scrapyard.x + dx / l * 125, LOC.scrapyard.z + dz / l * 125); })();

const STEPS = [
  // ---------------- CHAPTER 1 ----------------
  { chapter: ['CHAPTER I', 'COLD BOOT'], obj: 'Walk to the beacon', wp: () => pt(LOC.scrapyard.x + 30, LOC.scrapyard.z + 30),
    enter() { UI.say([[WHO.VEGA, 'Reboot sequence complete... AX-7, can you hear me?'], [WHO.YOU, 'Where... where am I? My memory core is... empty.'], [WHO.VEGA, 'I\'m VEGA, an orbital relay intelligence. You\'ve been offline for 312 cycles, dumped in Scrapyard 9.'], [WHO.VEGA, 'Your motor routines look intact. Use the left side of the screen to move. Drag the right side to look.']]); },
    update() { return near(pt(LOC.scrapyard.x + 30, LOC.scrapyard.z + 30), 14); } },
  { obj: 'Transform into vehicle mode (⟳ SHIFT)', enter() { UI.say([[WHO.VEGA, 'Good. Now the part that makes you Shiftborn. Tap SHIFT to transform.']]); UI.hint('btnShift'); },
    on(d, k, a) { if (k === 'transform' && a === 'car') d.done = true; }, update(d) { return d.done || Game.player.mode === 'car'; } },
  { obj: 'Drive to the scrapyard gate', wp: () => GATE, enter() { UI.say([[WHO.VEGA, 'Vehicle mode online! Steer with the stick, hold BOOST for a burst of speed. Head for the gate.']]); },
    update() { return near(GATE, 16); } },
  { obj: d => 'Destroy the scavenger drones (' + (3 - Enemies.alive('ch1')) + '/3)',
    enter() { for (let i = 0; i < 3; i++) Enemies.spawn('drone', GATE.x + 40 + i * 12, GATE.z + 20 - i * 10, { tag: 'ch1', aggro: 200 }); UI.say([[WHO.VEGA, 'Contacts! Rustborn scavenger drones. Shift back to mech mode and hold FIRE. I\'ll help you lock on.'], [WHO.YOU, 'Rustborn... that name hurts somewhere I can\'t find.']]); },
    update() { return Enemies.alive('ch1') === 0 && this._t(); }, _t() { return true; } },
  { obj: 'Drive to Haven', wp: () => pt(0, 40),
    enter() { UI.say([[WHO.VEGA, 'Your combat routines are frighteningly good, AX-7.'], [WHO.VEGA, 'There\'s a city to the south-east. Haven, the last free Shiftborn city. Follow the road. Someone there may know who you are.']]); },
    update() { return near(pt(0, 0), 60); } },
  // ---------------- CHAPTER 2 ----------------
  { chapter: ['CHAPTER II', 'HAVEN'], obj: 'Speak with Elder Bastion in the plaza', wp: () => LOC.elder,
    enter() { UI.say([[WHO.VEGA, 'The elder is waiting in the central plaza.']]); }, update() { return near(LOC.elder, 16); } },
  { obj: d => 'Recover Haven\'s Spark Shards (' + (d.got || 0) + '/3)', wp: () => Story.nearestStoryShard(),
    enter(d) { UI.say([[WHO.ELDER, 'Vanguard...? By the first Spark. We thought the Foundry had swallowed you whole.'], [WHO.YOU, 'You know me? I don\'t remember anything.'], [WHO.ELDER, 'Then let your actions remind you. Haven\'s shield is failing. When the sky-relay fell, three Spark Shards scattered around the city.'], [WHO.ELDER, 'Bring them back to me, and Haven may yet stand.']]); Story.spawnStoryShards(); },
    update(d) { return (d.got || 0) >= 3; } },
  { obj: 'Return the shards to Elder Bastion', wp: () => LOC.elder, update() { return near(LOC.elder, 16); } },
  // ---------------- CHAPTER 3 ----------------
  { chapter: ['CHAPTER III', 'THE RAID'], obj: d => 'Defend Haven: wave ' + Math.min(3, (d.wave || 0) + 1) + '/3 (' + Enemies.alive('raid') + ' left)', wp: () => { const e = Enemies.list.find(e => !e.dead && e.tag === 'raid'); return e ? pt(e.pos.x, e.pos.z) : null; },
    enter(d) { World.shield.visible = true; d.wave = -1; d.cool = 6; UI.say([[WHO.ELDER, 'The shield... it sings again. Thank you, Vanguard.'], [WHO.VEGA, 'Warning! Rustborn signatures inbound. They tracked the shards\' energy straight here!'], [WHO.KRAXX, 'Vanguard. My favorite traitor. You carried the Sparks right back to the nest. How thoughtful.'], [WHO.KRAXX, 'Take the city. Bring me the deserter... in pieces, if you must.']]); },
    update(d, dt) {
      if (Enemies.alive('raid') === 0) {
        d.cool -= dt;
        if (d.cool <= 0) {
          d.wave++; if (d.wave >= 3) return true;
          const waves = [['drone', 'drone', 'trooper', 'trooper'], ['trooper', 'trooper', 'trooper', 'drone', 'drone', 'drone'], ['brute', 'trooper', 'trooper', 'drone', 'drone', 'brute']];
          const a0 = rand(0, TAU);
          waves[d.wave].forEach((u, i) => { const a = a0 + i * 0.35; Enemies.spawn(u, Math.cos(a) * 200, Math.sin(a) * 200, { tag: 'raid', aggro: 600 }); });
          UI.toast('WAVE ' + (d.wave + 1), d.wave === 2 ? 'Brutes incoming!' : 'Rustborn assault'); d.cool = 3;
        }
      }
      return false;
    } },
  { obj: 'Travel to the Relay Spire in Rustveil Canyon', wp: () => LOC.relay,
    enter() { UI.say([[WHO.ELDER, 'You fought like the Vanguard of old.'], [WHO.YOU, 'Kraxx called me a traitor. Why?'], [WHO.ELDER, '...Because before you were ours, you were his. That truth is yours to recover, not mine to tell.'], [WHO.VEGA, 'I can rebuild your memory core, but I need the Relay Spire in Rustveil Canyon back online. It\'s a long drive east.'], [WHO.VEGA, 'Tip: spend your scrap at the Haven Garage for upgrades. And look for Spark Shards, they hold memory fragments. Purple pillars mark street races.']]); },
    update() { return near(LOC.relay, 70); } },
  // ---------------- CHAPTER 4 ----------------
  { chapter: ['CHAPTER IV', 'SIGNAL IN THE DUST'], obj: () => 'Clear the spire\'s guards (' + Enemies.alive('relay') + ' left)', wp: () => LOC.relay,
    enter() { const L = LOC.relay; ['trooper', 'trooper', 'trooper', 'drone', 'drone', 'brute'].forEach((u, i) => Enemies.spawn(u, L.x + Math.cos(i) * 30, L.z + Math.sin(i) * 30, { tag: 'relay', aggro: 160 })); UI.say([[WHO.VEGA, 'Kraxx left a garrison on the spire. Clear them out.']]); },
    update() { return Enemies.alive('relay') === 0; } },
  { obj: d => 'Hold the spire pad to restore the relay: ' + Math.floor((d.hold || 0) / 8 * 100) + '%', wp: () => LOC.relay,
    enter(d) { d.hold = 0; d.sp = 3; UI.say([[WHO.VEGA, 'Stand on the pad at the base of the spire. I need 8 seconds of uplink.']]); },
    update(d, dt) {
      if (near(LOC.relay, 18)) { d.hold += dt; d.sp -= dt; if (d.sp <= 0) { d.sp = 3; Enemies.spawn('drone', LOC.relay.x + rand(-60, 60), LOC.relay.z + rand(-60, 60), { tag: 'relaydr', aggro: 300 }); } }
      return d.hold >= 8;
    } },
  { obj: d => d.racing ? 'Race to the Foundry gate! ' + Math.max(0, d.time).toFixed(1) + 's  (' + d.cp + '/' + RACE_ROUTE_FOUNDRY.length + ')' : 'Restoring memory...', wp: d => d.racing ? pt(...RACE_ROUTE_FOUNDRY[d.cp]) : null,
    enter(d) {
      d.racing = false; d.cp = 0; d.time = 80;
      UI.say([[WHO.VEGA, 'Uplink established. Rebuilding memory core...'], [WHO.MEMORY, 'KRAXX: "Lieutenant AX-7. The Haven Sparks will feed the Foundry. Every Shiftborn mind, rewritten. Loyal. Silent. Still."'], [WHO.MEMORY, 'AX-7: "They\'re children, Kraxx. They\'re just learning to shift. I won\'t."'], [WHO.MEMORY, 'SEEKER: "Go, Vanguard! I\'ll hold the gate. Drive and don\'t look back!"'], [WHO.YOU, 'Seeker... she saved me. I left her there.'], [WHO.VEGA, 'Her signal is alive, inside the Foundry! But the gate seals at the next power cycle. You have 80 seconds. DRIVE!']], () => { d.racing = true; UI.toast('GO!', 'Follow the gold rings'); });
    },
    update(d, dt) {
      if (!d.racing) return false;
      d.time -= dt; const c = RACE_ROUTE_FOUNDRY[d.cp];
      Story.cpRing.visible = true; Story.cpRing.position.set(c[0], terrainHeight(c[0], c[1]) + 10, c[1]); Story.cpRing.rotation.y = Game.time;
      if (near(pt(...c), 16)) { d.cp++; Audio_.pickup(); if (d.cp >= RACE_ROUTE_FOUNDRY.length) { Story.cpRing.visible = false; return true; } }
      if (d.time <= 0) { Story.cpRing.visible = false; UI.toast('The gate sealed...', 'VEGA rewinds the uplink. Try again!'); const P = Game.player; P.pos.set(640, terrainHeight(640, -470), -470); P.vel.set(0, 0, 0); P.speed = 0; d.time = 80; d.cp = 0; }
      return false;
    } },
  // ---------------- CHAPTER 5 ----------------
  { chapter: ['CHAPTER V', 'THE FOUNDRY'], obj: 'Defeat Warlord Kraxx', wp: () => { const b = Enemies.list.find(e => e.type === 'boss' && !e.dead); return b ? pt(b.pos.x, b.pos.z) : LOC.foundry; },
    enter(d) {
      Enemies.clearTag('boss'); const L = LOC.foundry;
      d.boss = Enemies.spawn('boss', L.x + 10, L.z + 60, { tag: 'boss', aggro: 400 }); d.said66 = d.said33 = false;
      UI.bossBar(true);
      UI.say([[WHO.KRAXX, 'So. The deserter crawls home.'], [WHO.YOU, 'Where is Seeker, Kraxx?'], [WHO.KRAXX, 'Feeding my core, one memory at a time. Soon she won\'t remember your name. Neither will you.'], [WHO.VEGA, 'His armor is thick. Keep moving, hit him hard, and ram him in vehicle mode when you can!']]);
    },
    on(d, k, a) {
      if (k === 'bossHp') { if (a < 0.66 && !d.said66) { d.said66 = true; UI.say([[WHO.KRAXX, 'Drones! Swarm him!']]); } if (a < 0.33 && !d.said33) { d.said33 = true; UI.say([[WHO.KRAXX, 'You were built to obey! You were BUILT FOR ME!'], [WHO.YOU, 'I was built. I chose who to become.']]); } }
    },
    update(d) { UI.bossHp(d.boss ? d.boss.hp / d.boss.maxHp : 0); return d.boss && d.boss.dead; } },
  { obj: 'Free Seeker', wp: () => pt(LOC.foundry.x + 20, LOC.foundry.z + 30),
    enter(d) {
      UI.bossBar(false); Enemies.clearTag('relaydr');
      for (const e of Enemies.list) if (!e.dead && e.type === 'drone' && dist2(e.pos.x, e.pos.z, LOC.foundry.x, LOC.foundry.z) < 300 * 300) e.kill();
      const sk = Story.npcs.seeker; const x = LOC.foundry.x + 20, z = LOC.foundry.z + 30; sk.root.visible = true; sk.shadow.visible = true; sk.root.position.set(x, terrainHeight(x, z), z); sk.shadow.position.set(x, terrainHeight(x, z) + 0.2, z);
      World.foundryCore.material.color.setHex(0x55d6ff);
    },
    update() { return near(pt(LOC.foundry.x + 20, LOC.foundry.z + 30), 14); } },
  { obj: 'THE END. Free roam: Spark Shards, camps, races and upgrades await',
    enter(d) {
      UI.say([[WHO.SEEKER, 'Vanguard...? You came back. You actually came back.'], [WHO.YOU, 'You held a gate for me once. I owed you a drive home.'], [WHO.VEGA, 'The Foundry core has been purged. Every stolen Spark is returning to its owner.'], [WHO.ELDER, 'Haven sings tonight, Vanguard. Whatever you were, you are ours now.'], [WHO.SEEKER, 'Race you back to Haven. Loser carries the next shard.']], () => { UI.showEnding(); });
      Game.save.beaten = true;
    } },
];

// ---------------- Side races ----------------
const Race = {
  active: null, cp: 0, time: 0,
  update(dt) {
    const P = Game.player;
    if (!this.active) {
      if (Story.step < 9 || STEPS[Story.step] === STEPS[12]) return null;
      for (const r of RACES) if (near(pt(...r.start), 10)) return { label: 'RACE', fn: () => this.begin(r) };
      return null;
    }
    this.time += dt; const c = this.active.cps[this.cp];
    Story.cpRing.visible = true; Story.cpRing.position.set(c[0], terrainHeight(c[0], c[1]) + 10, c[1]); Story.cpRing.rotation.y = Game.time;
    if (near(pt(...c), 16)) {
      this.cp++; Audio_.pickup();
      if (this.cp >= this.active.cps.length) {
        const r = this.active; const best = Game.save.races[r.id];
        const won = this.time <= r.par;
        if (won && !best) Game.save.scrap += 150;
        if (!best || this.time < best) Game.save.races[r.id] = this.time;
        UI.toast(won ? 'RACE WON! ' + this.time.toFixed(1) + 's' : 'Finished: ' + this.time.toFixed(1) + 's', won ? (best ? 'Best: ' + Math.min(best, this.time).toFixed(1) + 's' : '+150 scrap') : 'Beat ' + r.par + 's to win');
        this.active = null; Story.cpRing.visible = false; Game.saveGame();
      }
    }
    if (this.time > 180) { this.active = null; Story.cpRing.visible = false; UI.toast('Race abandoned', ''); }
    return null;
  },
  begin(r) { this.active = r; this.cp = 0; this.time = 0; if (Game.player.mode !== 'car') Game.player.toggleMode(); UI.toast(r.name, 'Par time ' + r.par + 's. GO!'); },
  wp() { const c = this.active.cps[this.cp]; return pt(c[0], c[1]); },
  text() { return this.active.name + ': ' + this.time.toFixed(1) + 's  (' + this.cp + '/' + this.active.cps.length + ')'; },
};

// ---------------- Garage shop ----------------
const Shop = {
  check() { if (Story.step >= 5 && near(LOC.garage, 16)) return { label: 'GARAGE', fn: () => UI.openShop() }; return null; },
  buy(id) { const l = Game.save.up[id]; const c = upCost(l); if (l >= 5 || Game.save.scrap < c) { Audio_.tone(200, 100, 0.2, 0.06, 'square'); return; } Game.save.scrap -= c; Game.save.up[id]++; Audio_.pickup(); if (id === 'armor') Game.player.hp += 30; Game.saveGame(); UI.openShop(); },
};
