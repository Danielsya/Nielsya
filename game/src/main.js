// Sunport City v2 — 3D open-world crime game (three.js, vendored locally). Written fresh.
import * as THREE from './three.module.js';
import { CONFIG, MISSIONS, CREW, STORY } from './config.js';
import { mulberry32, clamp, dist, angleTo, pick } from './random.js';
import { Input } from './input.js';
import { createWorld, isBlocked, randomRoadPoint, districtAt, roadPointAt } from './world.js';
import { buildCity, makeCar, makePoliceCar, makePerson, makeCashDrop } from './city3d.js';
import { drawHUD, drawTitle, drawPause, drawGameOver, drawComplete, drawStory } from './render.js';
import { getShotFromURL, applyShot } from './shots.js';

// --- Renderer (guarded: if WebGL is missing, show a clear message) ---
const hud = document.getElementById('hud');
const hctx = hud.getContext('2d');
function resizeHud() { hud.width = innerWidth; hud.height = innerHeight; }
addEventListener('resize', resizeHud); resizeHud();
let renderer = null;
try {
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(innerWidth, innerHeight);
  renderer.domElement.id = 'gl';
  renderer.domElement.style.cssText = 'position:fixed;inset:0;display:block;';
  document.body.prepend(renderer.domElement);
  addEventListener('resize', () => renderer.setSize(innerWidth, innerHeight));
} catch (e) {
  hctx.fillStyle = '#111'; hctx.fillRect(0, 0, hud.width, hud.height);
  hctx.fillStyle = '#fff'; hctx.font = '20px sans-serif'; hctx.textAlign = 'center';
  hctx.fillText('Sunport City needs WebGL. Please open it in desktop Chrome.', hud.width / 2, hud.height / 2);
  throw e;
}
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87b5e0);
const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 1, 6000);
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); });
const hemi = new THREE.HemisphereLight(0xbfe0ff, 0x3a5a3a, 0.9); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff0c0, 1.4); sun.position.set(800, 1200, 400); scene.add(sun);
const amb = new THREE.AmbientLight(0xffffff, 0.25); scene.add(amb);

const input = new Input(renderer.domElement);
const rng = mulberry32(20261121);
const world = createWorld(20261121);
const city = buildCity(scene, world);

// Rain: a points cloud that falls and recycles, shown only while raining.
const rainGeo = new THREE.BufferGeometry();
const rainPos = new Float32Array(900 * 3);
for (let i = 0; i < 900; i++) { rainPos[i * 3] = rng() * 2304; rainPos[i * 3 + 1] = rng() * 300; rainPos[i * 3 + 2] = rng() * 2304; }
rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
const rain = new THREE.Points(rainGeo, new THREE.PointsMaterial({ color: 0xaaccee, size: 2 }));
rain.visible = false; scene.add(rain);

function makeState() {
  const start = roadPointAt(world, 16, 16);
  const traffic = [];
  for (let i = 0; i < 9; i++) {
    const p = randomRoadPoint(world, rng);
    traffic.push({ x: p.x, z: p.z, angle: rng() * Math.PI * 2, speed: 70 + rng() * 50, color: pick(rng, [0xe05a4d, 0x4dd0a5, 0xc96fd1]), mesh: null });
  }
  const peds = [];
  for (let i = 0; i < 12; i++) {
    const p = randomRoadPoint(world, rng);
    peds.push({ x: p.x + 40, z: p.z + 40, mesh: null });
  }
  const gang = [];
  for (let i = 0; i < 5; i++) {
    const p = randomRoadPoint(world, rng);
    gang.push({ x: p.x, z: p.z, health: 100, mesh: null });
  }
  const standing = {};
  for (const d of ['downtown', 'marina', 'oldtown', 'hills', 'beach']) standing[d] = 0;
  return {
    world, mode: 'title', shot: null, shotMode: false, invulnerable: false,
    player: { x: start.x, z: start.z, angle: 0, speed: 0, health: 100, money: 100, ammo: 24, inCar: false, mesh: null, carMesh: null },
    traffic, peds, gang, police: [], wanted: 0,
    crew: [], standing, district: districtAt(start.x, start.z),
    missionIndex: 0, mission: MISSIONS[0], missionTime: MISSIONS[0].time,
    missionTarget: { x: 64 * 32 + 16, z: 16 * 32 + 16 },
    collected: 0, raceHit: 0, cashDrops: [], rivals: [],
    time: 0, dayClock: 9, timeLabel: '09:00', raining: false, rainTimer: 35,
    hint: '', camX: start.x, camZ: start.z, camY: 120,
  };
}
let state = makeState();

// --- Meshes for actors (created once, repositioned every frame) ---
function syncMeshes() {
  const p = state.player;
  if (!p.mesh) { p.mesh = makePerson(0xffcf3d); scene.add(p.mesh); }
  if (!p.carMesh) { p.carMesh = makeCar(0xffcf3d); scene.add(p.carMesh); }
  p.mesh.visible = !p.inCar; p.carMesh.visible = p.inCar;
  p.mesh.position.set(p.x, 0, p.z); p.mesh.rotation.y = -p.angle + Math.PI / 2;
  p.carMesh.position.set(p.x, 0, p.z); p.carMesh.rotation.y = -p.angle + Math.PI / 2;
  for (const c of state.traffic) {
    if (!c.mesh) { c.mesh = makeCar(c.color); scene.add(c.mesh); }
    c.mesh.position.set(c.x, 0, c.z); c.mesh.rotation.y = -c.angle + Math.PI / 2;
  }
  for (const pd of state.peds) {
    if (!pd.mesh) { pd.mesh = makePerson(0xf2e6c9); scene.add(pd.mesh); }
    pd.mesh.position.set(pd.x, 0, pd.z);
  }
  for (const g of state.gang) {
    if (!g.mesh) { g.mesh = makePerson(0xb03a5a); scene.add(g.mesh); }
    g.mesh.visible = g.health > 0; g.mesh.position.set(g.x, 0, g.z);
  }
  for (const pol of state.police) {
    if (!pol.mesh) { pol.mesh = makePoliceCar(); scene.add(pol.mesh); }
    pol.mesh.position.set(pol.x, 0, pol.z); pol.mesh.rotation.y = -pol.angle + Math.PI / 2;
    const flash = Math.floor(state.time * 6) % 2 === 0;
    if (pol.mesh.userData.barR) pol.mesh.userData.barR.material.emissiveIntensity = flash ? 2 : 0.2;
    if (pol.mesh.userData.barB) pol.mesh.userData.barB.material.emissiveIntensity = flash ? 0.2 : 2;
  }
  for (const cd of state.cashDrops) {
    if (!cd.mesh) { cd.mesh = makeCashDrop(); scene.add(cd.mesh); }
    cd.mesh.visible = !cd.taken; cd.mesh.position.set(cd.x, 0, cd.z);
    cd.mesh.rotation.y += 0.02;
  }
  if (city.beacon) {
    if (state.missionTarget) { city.beacon.visible = true; city.beacon.position.set(state.missionTarget.x, 150, state.missionTarget.z); }
    else city.beacon.visible = false;
  }
}

// --- Audio: tiny synth, guarded for headless browsers ---
let audioCtx = null, muted = false;
function beep(freq, dur) {
  if (muted) return;
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.frequency.value = freq; o.connect(g); g.connect(audioCtx.destination);
    g.gain.setValueAtTime(0.08, audioCtx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
    o.start(); o.stop(audioCtx.currentTime + dur);
  } catch { /* no audio in headless */ }
}
function siren() { beep(660, 0.12); setTimeout(() => beep(440, 0.12), 130); }

function saveGame() {
  try {
    localStorage.setItem(CONFIG.saveKey, JSON.stringify({ money: state.player.money, missionIndex: state.missionIndex, standing: state.standing, crew: state.crew.map((c) => c.id) }));
  } catch {}
}
function loadGame() {
  try {
    const s = JSON.parse(localStorage.getItem(CONFIG.saveKey) || 'null');
    if (s) {
      state.player.money = s.money || 100; state.missionIndex = s.missionIndex || 0;
      state.mission = MISSIONS[state.missionIndex % MISSIONS.length];
      if (s.standing) state.standing = s.standing;
      if (s.crew) state.crew = CREW.filter((c) => s.crew.includes(c.id));
    }
  } catch {}
}
loadGame();

function missionTargetFor(m) {
  if (m.type === 'deliver') return { x: 64 * 32 + 16, z: 16 * 32 + 16 };
  if (m.type === 'escape' || m.type === 'final' || m.type === 'heist') return { x: world.hideout.x, z: world.hideout.z };
  if (m.type === 'race') return { x: world.raceChecks[0].x, z: world.raceChecks[0].z };
  return { x: 32 * 32 + 16, z: 32 * 32 + 16 };
}
function startMission(i) {
  state.missionIndex = i % MISSIONS.length;
  state.mission = MISSIONS[state.missionIndex];
  state.missionTime = state.mission.time;
  state.collected = 0; state.raceHit = 0; state.rivals = [];
  state.missionTarget = missionTargetFor(state.mission);
  for (const cd of state.cashDrops) if (cd.mesh) { scene.remove(cd.mesh); cd.mesh = null; }
  state.cashDrops = [];
  if (state.mission.type === 'collect') {
    for (let k = 0; k < 5; k++) {
      const p = randomRoadPoint(world, rng);
      state.cashDrops.push({ x: p.x, z: p.z, taken: false, mesh: null });
    }
  }
  if (state.mission.type === 'race') {
    for (let k = 0; k < 2; k++) {
      const p = roadPointAt(world, 8, 56);
      state.rivals.push({ x: p.x + k * 40, z: p.z, angle: 0, speed: 150 + k * 20, color: 0xff8c1a, mesh: null, hit: 0 });
    }
    state.traffic.push(...state.rivals);
  }
  if (state.mission.type === 'escape' || state.mission.type === 'final') state.wanted = state.mission.type === 'final' ? 5 : 3;
  if (state.mission.type === 'heist') state.wanted = 0;
  state.mode = 'story';
}
function completeMission() {
  const m = state.mission;
  state.player.money += m.reward;
  const d = state.district;
  if (d) state.standing[d.id] = Math.min(100, (state.standing[d.id] || 0) + 15);
  state.mode = 'complete'; saveGame(); beep(660, 0.2);
}
function failMission() {
  state.missionTime = state.mission.time;
  state.wanted = Math.min(5, state.wanted + 1);
  state.hint = 'Mission failed — timer reset, heat is up. Try again!';
}

function topSpeed() { return CONFIG.carSpeed * (state.crew.some((c) => c.id === 'driver') ? 1.25 : 1); }
function damage(v) { return v * (state.crew.some((c) => c.id === 'muscle') ? 1.5 : 1); }

function placeCamera(p, distBack, height) {
  const tx = p.x - Math.cos(p.angle) * distBack, tz = p.z - Math.sin(p.angle) * distBack;
  state.camX += (tx - state.camX) * 0.2; state.camZ += (tz - state.camZ) * 0.2;
  state.camY += ((height + 20) - state.camY) * 0.2;
  camera.position.set(state.camX, state.camY, state.camZ);
  camera.lookAt(p.x, 18, p.z);
}
function updateShotChase(dt) {
  // ONLY for ?shot=play. Start/end shots must NOT come here: they keep
  // their own mode ('title' / 'complete') so their overlays render.
  if (state.shot !== 'play') return;
  const p = state.player;
  p.speed = 200; p.x += Math.cos(p.angle) * p.speed * dt; p.z += Math.sin(p.angle) * p.speed * dt;
  if (p.x > 60 * 32) p.x = 8 * 32;
  p.health = 100; state.wanted = 3; state.mode = 'playing';
  state.police.forEach((pol, i) => { pol.x = p.x - 110 - i * 70; pol.z = p.z + (i % 2 ? 16 : -12); pol.angle = 0; });
  state.traffic.forEach((c) => { c.x += Math.cos(c.angle) * c.speed * dt; if (c.x > 68 * 32) c.x = 4 * 32; });
  state.missionTime = Math.max(30, state.missionTime - dt * 0.1);
  // Camera must follow in shot mode too — update() returns early for shots.
  placeCamera(p, 170, 80);
}
// Start/end shots: orbit the camera HIGH over the city centre in daylight,
// never behind a building, never dark. Mode stays 'title' / 'complete'.
function updateShotOrbit() {
  state.dayClock = 10; // fixed bright morning, so the city is well-lit
  state.mode = state.shot === 'end' ? 'complete' : 'title';
  state.wanted = 0;
  const cx = 36 * 32 + 16, cz = 36 * 32 + 16;
  const t = state.time * 0.08;
  camera.position.set(cx + Math.cos(t) * 650, 420, cz + Math.sin(t) * 650);
  camera.lookAt(cx, 0, cz);
}

function update(dt) {
  state.time += dt;
  state.dayClock = (state.dayClock + (dt * 24) / CONFIG.dayLength) % 24;
  const hh = Math.floor(state.dayClock), mm = Math.floor((state.dayClock - hh) * 60);
  state.timeLabel = String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
  // Day/night: sun swings, sky + lights follow.
  const sunA = (state.dayClock / 24) * Math.PI * 2 - Math.PI / 2;
  const dayF = clamp(Math.sin(sunA) * 0.5 + 0.5, 0.08, 1);
  sun.intensity = 0.2 + dayF * 1.3;
  sun.position.set(Math.cos(sunA) * 1000, Math.sin(sunA) * 1000 + 200, 400);
  scene.background.setHSL(0.58, 0.5, 0.12 + dayF * 0.45);
  hemi.intensity = 0.25 + dayF * 0.65;
  for (const lamp of city.lampLights) lamp.material.emissiveIntensity = dayF < 0.4 ? 1.6 : 0.15;
  // Rain cycle.
  state.rainTimer -= dt;
  if (state.rainTimer <= 0) { state.raining = !state.raining; state.rainTimer = state.raining ? 12 : 35; rain.visible = state.raining; }
  if (state.raining) {
    const pos = rainGeo.attributes.position.array;
    for (let i = 0; i < 900; i++) { pos[i * 3 + 1] -= 420 * dt; if (pos[i * 3 + 1] < 0) pos[i * 3 + 1] = 300; }
    rainGeo.attributes.position.needsUpdate = true;
  }

  if (state.shotMode) {
    if (state.shot === 'start' || state.shot === 'end') { updateShotOrbit(); return; }
    updateShotChase(dt); return;
  }
  const p = state.player;
  // Title / story / end screens: orbit the camera high over the city so the
  // 3D world is visible behind the overlay instead of a black origin view.
  if (state.mode === 'title' || state.mode === 'story' || state.mode === 'complete') {
    const t = state.time * 0.05;
    camera.position.set(p.x + Math.cos(t) * 500, 320, p.z + Math.sin(t) * 500);
    camera.lookAt(p.x, 0, p.z);
  }
  if (state.mode === 'title') { if (input.pressed('enter')) { startMission(state.missionIndex); } return; }
  if (state.mode === 'story') { if (input.pressed('enter')) { state.mode = 'playing'; beep(440, 0.1); } return; }
  if (state.mode === 'complete') { if (input.pressed('enter')) { startMission(state.missionIndex + 1); } return; }
  if (state.mode === 'gameover') { if (input.pressed('r')) { state = makeState(); state.mode = 'playing'; } return; }
  if (input.pressed('p') || input.pressed('escape')) { state.mode = state.mode === 'paused' ? 'playing' : 'paused'; return; }
  if (state.mode === 'paused') return;
  if (input.pressed('m')) { muted = !muted; }
  if (input.pressed('s')) saveGame();
  if (input.pressed('r') && !p.inCar) p.ammo += 12;

  const mv = input.moveVector();
  const run = input.down('shift') ? CONFIG.runMult : 1;
  state.district = districtAt(p.x, p.z);
  state.hint = '';
  if (p.inCar) {
    if (mv.y !== 0) p.speed = clamp(p.speed + mv.y * -CONFIG.carAccel * dt, -80, topSpeed());
    else p.speed *= Math.pow(0.4, dt);
    p.angle += mv.x * 0.9 * dt * clamp(p.speed / 120, -1, 1);
    const nx = p.x + Math.cos(p.angle) * p.speed * dt, nz = p.z + Math.sin(p.angle) * p.speed * dt;
    if (!isBlocked(state.world, nx, nz)) { p.x = nx; p.z = nz; }
    else { p.speed *= 0.4; }
    // Running over a pedestrian raises heat.
    for (const pd of state.peds) {
      if (dist(p.x, p.z, pd.x, pd.z) < 24 && Math.abs(p.speed) > 60) { state.wanted = Math.min(5, state.wanted + 1); pd.x += 200; beep(180, 0.1); }
    }
    if (input.pressed('e')) { p.inCar = false; p.speed = 0; p.x += 40; }
  } else {
    const sp = CONFIG.playerSpeed * run;
    p.angle += mv.x * 2.4 * dt;
    const fx = Math.cos(p.angle), fz = Math.sin(p.angle);
    const nx = p.x + fx * (-mv.y) * sp * dt, nz = p.z + fz * (-mv.y) * sp * dt;
    if (!isBlocked(state.world, nx, nz)) { p.x = nx; p.z = nz; }
    if (input.pressed('e')) {
      // Steal the vault car (heist mission).
      if (state.mission.type === 'heist' && dist(p.x, p.z, state.world.vaultCar.x, state.world.vaultCar.z) < 70) {
        p.inCar = true; p.x = state.world.vaultCar.x; p.z = state.world.vaultCar.z; state.wanted = 4; state.missionTarget = { x: state.world.hideout.x, z: state.world.hideout.z }; beep(220, 0.15); state.hint = 'Vault car stolen! Deliver it to the Hideout!';
      } else {
        let best = null, bd = 70;
        for (const c of state.traffic) { const d = dist(p.x, p.z, c.x, c.z); if (d < bd) { bd = d; best = c; } }
        if (best) {
          p.inCar = true; p.x = best.x; p.z = best.z; p.angle = best.angle; p.speed = 0;
          state.traffic = state.traffic.filter((c) => c !== best);
          state.wanted = Math.min(5, state.wanted + 1); beep(220, 0.15);
        } else {
          // Recruit crew / shop, if standing next to one.
          for (const spot of state.world.crewSpots) {
            const c = CREW.find((k) => k.id === spot.crew);
            if (c && !state.crew.includes(c) && dist(p.x, p.z, spot.x, spot.z) < 70) {
              if (p.money >= c.cost) { p.money -= c.cost; state.crew.push(c); state.hint = c.name + ' joined your crew! ' + c.bonus; beep(520, 0.15); }
              else state.hint = c.name + ' wants $' + c.cost + ' to join. You have $' + p.money + '.';
            }
          }
          for (const s of state.world.shops) {
            if (dist(p.x, p.z, s.x, s.z) < 70 && p.money >= 50) { p.money -= 50; p.ammo += 24; p.health = Math.min(100, p.health + 30); state.hint = 'Bought ammo + health at ' + s.name; beep(520, 0.1); }
          }
        }
      }
    }
    if (input.pressed(' ')) {
      for (const g of state.gang) {
        if (g.health > 0 && dist(p.x, p.z, g.x, g.z) < 45) { g.health -= damage(20); beep(180, 0.08); if (g.health <= 0) { p.money += 50; state.standing[state.district.id] = Math.min(100, (state.standing[state.district.id] || 0) + 2); } }
      }
    }
  }
  // Shooting: forward cone, hits gang.
  if (input.mouse.clicked && p.ammo > 0) {
    p.ammo -= 1; beep(880, 0.06);
    for (const g of state.gang) {
      if (g.health <= 0) continue;
      const d = dist(p.x, p.z, g.x, g.z);
      const a = Math.abs(((angleTo(p.x, p.z, g.x, g.z) - p.angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
      if (d < 320 && a < 0.35) { g.health -= damage(34); if (g.health <= 0) { p.money += 50; } }
    }
    state.wanted = Math.min(5, state.wanted + 1);
  }

  // Traffic + pedestrians drift along roads.
  for (const c of state.traffic) {
    c.x += Math.cos(c.angle) * c.speed * dt; c.z += Math.sin(c.angle) * c.speed * dt;
    if (c.x > 70 * 32 || c.z > 70 * 32 || c.x < 2 * 32 || c.z < 2 * 32) { const np = randomRoadPoint(state.world, rng); c.x = np.x; c.z = np.z; }
  }
  for (const pd of state.peds) { pd.x += Math.sin(state.time + pd.z) * 6 * dt; }
  // Gang members wander toward the player and punch.
  for (const g of state.gang) {
    if (g.health <= 0) continue;
    const a = angleTo(g.x, g.z, p.x, p.z);
    g.x += Math.cos(a) * 26 * dt; g.z += Math.sin(a) * 26 * dt;
    if (!state.invulnerable && dist(g.x, g.z, p.x, p.z) < 30) { p.health -= 8 * dt; if (p.health <= 0) { p.health = 0; state.mode = 'gameover'; } }
  }
  // Wanted / police.
  const decay = 0.01 * (state.crew.some((c) => c.id === 'hacker') ? 2 : 1);
  if (state.wanted > 0 && state.police.length < state.wanted) {
    state.police.push({ x: p.x - 260 - state.police.length * 80, z: p.z, angle: 0, speed: CONFIG.policeSpeed, mesh: null });
    if (Math.floor(state.time) % 3 === 0) siren();
  }
  for (const pol of state.police) {
    const a = angleTo(pol.x, pol.z, p.x, p.z); pol.angle = a;
    pol.x += Math.cos(a) * pol.speed * dt; pol.z += Math.sin(a) * pol.speed * dt;
    if (!state.invulnerable && dist(pol.x, pol.z, p.x, p.z) < 30) { p.health -= 25 * dt; if (p.health <= 0) { p.health = 0; state.mode = 'gameover'; } }
  }
  if (state.wanted > 0 && state.mission.type !== 'final' && state.mission.type !== 'escape') state.wanted = Math.max(0, state.wanted - dt * decay);

  // Mission progress.
  state.missionTime -= dt;
  if (state.missionTime <= 0) failMission();
  const m = state.mission;
  if (m.type === 'deliver' || m.type === 'escape' || m.type === 'final' || m.type === 'heist') {
    if (state.missionTarget && dist(p.x, p.z, state.missionTarget.x, state.missionTarget.z) < 60) completeMission();
  } else if (m.type === 'collect') {
    for (const cd of state.cashDrops) {
      if (!cd.taken && dist(p.x, p.z, cd.x, cd.z) < 45) { cd.taken = true; state.collected += 1; p.money += 100; beep(700, 0.1); }
    }
    if (state.collected >= 5) completeMission();
  } else if (m.type === 'race') {
    if (state.raceHit < world.raceChecks.length) {
      const rc = world.raceChecks[state.raceHit];
      state.missionTarget = { x: rc.x, z: rc.z };
      if (dist(p.x, p.z, rc.x, rc.z) < 60) { state.raceHit += 1; beep(700, 0.12); if (state.raceHit >= 4) completeMission(); }
    }
    for (const r of state.rivals) {
      if (r.hit < 4) {
        const rc = world.raceChecks[r.hit];
        const a = angleTo(r.x, r.z, rc.x, rc.z);
        r.x += Math.cos(a) * r.speed * dt; r.z += Math.sin(a) * r.speed * dt;
        if (dist(r.x, r.z, rc.x, rc.z) < 60) { r.hit += 1; if (r.hit >= 4) failMission(); }
      }
    }
  }
  // Camera: third-person, behind the player.
  const camDist = p.inCar ? 170 : 110, camH = p.inCar ? 80 : 62;
  const tx = p.x - Math.cos(p.angle) * camDist, tz = p.z - Math.sin(p.angle) * camDist;
  state.camX += (tx - state.camX) * Math.min(1, dt * 4);
  state.camZ += (tz - state.camZ) * Math.min(1, dt * 4);
  state.camY += ((camH + 20) - state.camY) * Math.min(1, dt * 4);
  camera.position.set(state.camX, state.camY, state.camZ);
  camera.lookAt(p.x, 18, p.z);
  input.endFrame();
}

function render() {
  syncMeshes();
  renderer.render(scene, camera);
  hctx.clearRect(0, 0, hud.width, hud.height);
  if (state.mode === 'playing' || state.mode === 'paused') drawHUD(hctx, state, hud.width, hud.height);
  if (state.mode === 'title') drawTitle(hctx, state, hud.width, hud.height);
  if (state.mode === 'story') drawStory(hctx, state, hud.width, hud.height);
  if (state.mode === 'paused') drawPause(hctx, hud.width, hud.height);
  if (state.mode === 'gameover') drawGameOver(hctx, hud.width, hud.height);
  if (state.mode === 'complete') drawComplete(hctx, state, hud.width, hud.height);
}

// Shot setup: applied once at load. In shot mode the game is live, never BUSTED.
const shot = getShotFromURL();
if (shot) applyShot(state, shot);
let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  update(dt); render();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
export { state, makeState };
