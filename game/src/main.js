// Cinderport — main game loop: player, cars, police, missions, audio, save.
// Original open-world crime game for make.fun gta6-01, written from scratch.
import { TILE, MAP, WORLD, DAY_LENGTH, SAVE_KEY, DISTRICTS, CREW, MISSIONS } from "./config.js";
import { buildWorld } from "./world.js";
import { Renderer, Mesh } from "./engine3d.js";
import { buildCity, makeCar, makePerson } from "./city3d.js";
import { drawHUD } from "./render.js";
import { initInput, keys, mouse, consumeClick, pressed } from "./input.js";
import { applyShot, shotFromUrl } from "./shots.js";
import { clamp, dist2d, angleLerp, makeRng } from "./random.js";

const canvas3d = document.getElementById("gl");
const canvasHud = document.getElementById("hud");
const hudCtx = canvasHud.getContext("2d");

const world = buildWorld(1337);
const rng = makeRng(20261122);

const s = {
  mode: "title",
  time: 0,
  dayClock: 40,
  nightFactor: 0,
  raining: false,
  rainTimer: 20,
  money: 100,
  health: 100,
  ammo: 30,
  wanted: 0,
  wantedTimer: 0,
  missionIndex: 0,
  missionStage: 0,
  missionTimer: 0,
  missionText: MISSIONS[0].hint,
  target: null,
  district: 2,
  standing: [0, 0, 0, 0, 0],
  crewRecruited: [],
  crewSpeed: false,
  crewDecay: false,
  crewPunch: false,
  player: { x: world.spawn.x, z: world.spawn.z, angle: 0, speed: 0, inCar: false },
  police: [],
  traffic: [],
  parked: [],
  peds: [],
  rivals: [],
  vaultCar: null,
  cashLeft: 0,
  raceRing: 0,
  toast: "",
  toastTimer: 0,
  invulnerable: false,
  orbit: true,
  shotMode: null,
  muted: false,
  world,
};

let renderer = null;
let city = null;
let playerPerson = null;
let playerCar = null;
const carMeshes = [];
const personMeshes = [];

// ---------- audio (tiny WebAudio synth, no files) ----------
let audioCtx = null;
let sirenOsc = null;
let sirenGain = null;
function ensureAudio() {
  if (audioCtx) return;
  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    sirenOsc = audioCtx.createOscillator();
    sirenGain = audioCtx.createGain();
    sirenGain.gain.value = 0;
    sirenOsc.type = "triangle";
    sirenOsc.frequency.value = 800;
    sirenOsc.connect(sirenGain);
    sirenGain.connect(audioCtx.destination);
    sirenOsc.start();
  } catch (e) {
    audioCtx = null;
  }
}
function beep(freq, dur = 0.12, type = "square", vol = 0.08) {
  if (!audioCtx || s.muted) return;
  try {
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.value = vol;
    o.connect(g);
    g.connect(audioCtx.destination);
    o.start();
    o.stop(audioCtx.currentTime + dur);
  } catch (e) { /* audio is best-effort */ }
}
function updateSiren() {
  if (!sirenOsc || !sirenGain) return;
  if (s.muted || s.wanted === 0 || s.mode !== "playing") {
    sirenGain.gain.value = 0;
    return;
  }
  sirenGain.gain.value = 0.035;
  sirenOsc.frequency.value = 750 + 350 * Math.sin(s.time * 6);
}

// ---------- save / load ----------
function saveGame() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      money: s.money, missionIndex: s.missionIndex, standing: s.standing,
      crewRecruited: s.crewRecruited, health: s.health, ammo: s.ammo,
    }));
    toast("Game saved.");
  } catch (e) { toast("Save failed in this browser."); }
}
function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return;
    const d = JSON.parse(raw);
    s.money = d.money ?? s.money;
    s.missionIndex = d.missionIndex ?? 0;
    s.standing = d.standing || s.standing;
    s.crewRecruited = d.crewRecruited || [];
    s.health = d.health ?? 100;
    s.ammo = d.ammo ?? 30;
    applyCrewBonuses();
  } catch (e) { /* corrupted save: start fresh */ }
}
function applyCrewBonuses() {
  s.crewSpeed = s.crewRecruited.includes(0);
  s.crewDecay = s.crewRecruited.includes(1);
  s.crewPunch = s.crewRecruited.includes(2);
}

function toast(msg, dur = 3) {
  s.toast = msg;
  s.toastTimer = dur;
}

// ---------- entities ----------
const TRAFFIC_COLORS = [
  [0.8, 0.15, 0.15], [0.15, 0.4, 0.85], [0.85, 0.75, 0.2], [0.2, 0.7, 0.3],
  [0.85, 0.85, 0.85], [0.5, 0.25, 0.7], [0.9, 0.5, 0.15], [0.3, 0.3, 0.35],
];

function spawnTraffic() {
  const MODELS = ["sedan", "sedan", "sport", "taxi", "truck"];
  for (let i = 0; i < 14; i++) {
    const axis = rng.int(0, 1);
    const line = (rng.int(0, 11) * 6 + 0.5) * TILE;
    const along = rng.range(40, WORLD - 40);
    const model = MODELS[rng.int(0, MODELS.length - 1)];
    const c = {
      x: axis === 0 ? along : line,
      z: axis === 0 ? line : along,
      angle: axis === 0 ? (rng.chance(0.5) ? 0 : Math.PI) : (rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2),
      speed: model === "truck" ? rng.range(6, 9) : rng.range(7, 12),
      axis, dir: 1,
      group: makeCar(renderer.gl, TRAFFIC_COLORS[i % TRAFFIC_COLORS.length], false, model),
    };
    c.dir = Math.cos(c.angle) >= 0 ? 1 : -1;
    if (axis === 1) c.dir = Math.sin(c.angle) >= 0 ? 1 : -1;
    s.traffic.push(c);
    for (const m of c.group.meshes) carMeshes.push(m);
  }
}

function spawnPeds() {
  const shirts = [[0.9, 0.3, 0.3], [0.3, 0.5, 0.9], [0.9, 0.8, 0.3], [0.4, 0.8, 0.4], [0.8, 0.5, 0.9]];
  for (let i = 0; i < 16; i++) {
    const p = {
      x: rng.range(60, WORLD - 60), z: rng.range(60, WORLD - 60),
      angle: rng.range(0, Math.PI * 2), speed: rng.range(1.2, 2.4),
      group: makePerson(renderer.gl, shirts[i % shirts.length]),
      alive: true,
    };
    s.peds.push(p);
    for (const m of p.group.meshes) personMeshes.push(m);
  }
}

function spawnPolice(n) {
  while (s.police.length < n) {
    const a = rng.range(0, Math.PI * 2);
    const px = s.player.x + Math.cos(a) * 55;
    const pz = s.player.z + Math.sin(a) * 55;
    // Interceptor sport models so police read as fast pursuit cars.
    const group = makeCar(renderer.gl, [0.92, 0.92, 0.92], true, "sport");
    const p = { x: px, z: pz, angle: a, speed: 0, group };
    s.police.push(p);
    for (const m of group.meshes) carMeshes.push(m);
  }
  while (s.police.length > n) {
    const p = s.police.pop();
    for (const m of p.group.meshes) m.visible = false;
  }
}

function nearestCar(maxD) {
  let best = null;
  let bestD = maxD;
  const consider = (c, kind) => {
    const d = dist2d(s.player.x, s.player.z, c.x, c.z);
    if (d < bestD) { bestD = d; best = { c, kind }; }
  };
  for (const t of s.traffic) consider(t, "traffic");
  for (const p of s.parked) consider(p, "parked");
  if (s.vaultCar && !s.vaultCar.stolen) consider(s.vaultCar, "vault");
  return best;
}

// ---------- missions ----------
function setMission(i) {
  s.missionIndex = i;
  s.missionStage = 0;
  s.missionTimer = 0;
  s.raceRing = 0;
  s.cashLeft = 0;
  const m = MISSIONS[i];
  s.missionText = m.hint;
  city.rings.forEach((r) => { r.visible = false; });
  city.cashMeshes.forEach((cm, idx) => { cm.visible = false; });
  if (s.vaultCar) {
    s.vaultCar.stolen = true;
    for (const mm of s.vaultCar.group.meshes) mm.visible = false;
    s.vaultCar = null;
  }
  if (i === 0) {
    s.target = { x: world.crates.x, z: world.crates.z };
  } else if (i === 1) {
    s.wanted = Math.max(s.wanted, 3);
    s.target = { x: world.hideout.x, z: world.hideout.z };
    s.missionTimer = 90;
  } else if (i === 2) {
    world.cashDrops.forEach((c) => { c.taken = false; });
    city.cashMeshes.forEach((cm) => { cm.visible = true; });
    s.cashLeft = 5;
    s.target = { x: world.cashDrops[0].x, z: world.cashDrops[0].z };
  } else if (i === 3) {
    city.rings.forEach((r) => { r.visible = true; });
    s.target = { x: world.raceRings[0].x, z: world.raceRings[0].z };
    spawnRivals();
  } else if (i === 4) {
    const group = makeCar(renderer.gl, [0.95, 0.8, 0.15], false, "sport");
    s.vaultCar = { x: world.vaultCar.x, z: world.vaultCar.z, angle: 0, group, stolen: false };
    for (const mm of group.meshes) carMeshes.push(mm);
    group.setPose(s.vaultCar.x, s.vaultCar.z, 0);
    s.target = { x: world.vaultCar.x, z: world.vaultCar.z };
  } else if (i === 5) {
    s.wanted = 5;
    s.target = { x: world.observatory.x, z: world.observatory.z };
  }
}

function spawnRivals() {
  s.rivals = [];
  for (let i = 0; i < 2; i++) {
    const group = makeCar(renderer.gl, i === 0 ? [0.9, 0.1, 0.5] : [0.1, 0.7, 0.9], false, "sport");
    const r = {
      x: s.player.x - 8 - i * 6, z: s.player.z + 6 + i * 6,
      angle: s.player.angle, ring: 0, progress: 0, group,
    };
    s.rivals.push(r);
    for (const mm of group.meshes) carMeshes.push(mm);
  }
}

function completeMission() {
  const m = MISSIONS[s.missionIndex];
  s.money += m.pay;
  s.standing[s.district] = Math.min(100, (s.standing[s.district] || 0) + 10);
  beep(660, 0.15, "sine", 0.1);
  setTimeout(() => beep(880, 0.25, "sine", 0.1), 140);
  toast(`Job done: ${m.name} — +$${m.pay}`);
  saveGame();
  if (s.missionIndex >= MISSIONS.length - 1) {
    s.mode = "complete";
    return;
  }
  s.missionIndex++;
  s.mode = "story";
  setMission(s.missionIndex);
}

function failMission(reason) {
  toast(reason + " — job restarted.");
  beep(180, 0.3, "sawtooth", 0.08);
  setMission(s.missionIndex);
}

function addWanted(n) {
  s.wanted = clamp(s.wanted + n, 0, 5);
}

// ---------- combat / interaction ----------
function tryPunch() {
  const dmg = s.crewPunch ? 60 : 30;
  for (const p of s.peds) {
    if (!p.alive) continue;
    if (dist2d(s.player.x, s.player.z, p.x, p.z) < 3.5) {
      p.alive = false;
      for (const m of p.group.meshes) m.visible = false;
      addWanted(1);
      toast("You knocked someone out. Wanted +1.");
      beep(140, 0.15, "square", 0.09);
      return;
    }
  }
  for (const pc of s.police) {
    if (dist2d(s.player.x, s.player.z, pc.x, pc.z) < 4) {
      pc.speed = Math.max(0, pc.speed - 6);
      addWanted(1);
      beep(140, 0.15, "square", 0.09);
      return;
    }
  }
}

function tryShoot() {
  if (s.ammo <= 0) { toast("Out of ammo — buy more at a shop."); return; }
  if (!consumeClick()) return;
  s.ammo--;
  beep(1200, 0.06, "square", 0.07);
  // Aim: nearest police car or ped in front of the camera direction.
  const fx = Math.sin(s.player.angle);
  const fz = Math.cos(s.player.angle);
  let best = null;
  let bestScore = 60;
  const consider = (x, z, kind, ref) => {
    const dx = x - s.player.x;
    const dz = z - s.player.z;
    const d = Math.hypot(dx, dz);
    if (d > 60 || d < 1) return;
    const dot = (dx * fx + dz * fz) / d;
    if (dot < 0.55) return;
    if (d < bestScore) { bestScore = d; best = { kind, ref }; }
  };
  for (const pc of s.police) consider(pc.x, pc.z, "police", pc);
  for (const p of s.peds) if (p.alive) consider(p.x, p.z, "ped", p);
  if (!best) return;
  if (best.kind === "police") {
    const pc = best.ref;
    s.police = s.police.filter((p) => p !== pc);
    for (const m of pc.group.meshes) m.visible = false;
    s.money += 150;
    addWanted(1);
    toast("Police car down! +$150, wanted +1.");
  } else {
    const p = best.ref;
    p.alive = false;
    for (const m of p.group.meshes) m.visible = false;
    addWanted(1);
    toast("Target down. Wanted +1.");
  }
}

function tryInteract() {
  // Crew recruit.
  for (const spot of world.crewSpots) {
    if (s.crewRecruited.includes(spot.crew)) continue;
    if (dist2d(s.player.x, s.player.z, spot.x, spot.z) < 7) {
      const c = CREW[spot.crew];
      if (s.money >= c.cost) {
        s.money -= c.cost;
        s.crewRecruited.push(spot.crew);
        applyCrewBonuses();
        toast(`${c.name} joined the crew! ${c.bonus}`);
        beep(520, 0.15, "sine", 0.1);
      } else {
        toast(`${c.name} costs $${c.cost} — you have $${s.money}.`);
      }
      return;
    }
  }
  // Shops: E buys ammo, H buys health.
  for (const shop of world.shops) {
    if (dist2d(s.player.x, s.player.z, shop.x, shop.z) < 8) {
      if (s.money >= 50 && s.ammo < 60) {
        s.money -= 50;
        s.ammo = Math.min(60, s.ammo + 24);
        toast("Bought ammo +24 for $50.");
        beep(700, 0.1, "sine", 0.09);
      } else if (s.money < 50) {
        toast("Not enough money for ammo ($50).");
      } else {
        toast("Ammo is full.");
      }
      return;
    }
  }
  // Steal / enter a car.
  if (!s.player.inCar) {
    const near = nearestCar(7);
    if (near) {
      const c = near.c;
      if (near.kind === "traffic") s.traffic = s.traffic.filter((t) => t !== c);
      if (near.kind === "parked") s.parked = s.parked.filter((p) => p !== c);
      playerCar = c.group || c;
      s.player.inCar = true;
      s.player.speed = 0;
      if (near.kind === "vault") {
        c.stolen = true;
        s.wanted = Math.max(s.wanted, 4);
        s.target = { x: world.hideout.x, z: world.hideout.z };
        toast("Vault car stolen! Get to the hideout — wanted 4!");
      } else {
        addWanted(1);
        toast("Car stolen. Wanted +1.");
      }
      beep(300, 0.12, "square", 0.08);
      return;
    }
  } else {
    // Exit the car: leave it parked here.
    const parkedCar = { x: s.player.x, z: s.player.z, angle: s.player.angle, group: playerCar };
    s.parked.push(parkedCar);
    playerCar = null;
    s.player.inCar = false;
    s.player.speed = 0;
  }
}

function tryHeal() {
  for (const shop of world.shops) {
    if (dist2d(s.player.x, s.player.z, shop.x, shop.z) < 8) {
      if (s.money >= 50 && s.health < 100) {
        s.money -= 50;
        s.health = Math.min(100, s.health + 30);
        toast("Bought health +30 for $50.");
        beep(700, 0.1, "sine", 0.09);
      }
      return;
    }
  }
}

// ---------- movement ----------
function movePlayer(dt) {
  const p = s.player;
  const run = keys.run ? 1.6 : 1;
  if (!p.inCar) {
    const spd = 6 * run;
    let mx = 0, mz = 0;
    if (keys.up) { mx += Math.sin(p.angle); mz += Math.cos(p.angle); }
    if (keys.down) { mx -= Math.sin(p.angle); mz -= Math.cos(p.angle); }
    if (keys.left) p.angle += 2.6 * dt;
    if (keys.right) p.angle -= 2.6 * dt;
    const len = Math.hypot(mx, mz) || 1;
    const nx = p.x + (mx / len) * spd * dt * (keys.up || keys.down ? 1 : 0);
    const nz = p.z + (mz / len) * spd * dt * (keys.up || keys.down ? 1 : 0);
    if (!world.hitsBuilding(nx, p.z, 1) && world.tileAt(nx, p.z) !== 2) p.x = nx;
    if (!world.hitsBuilding(p.x, nz, 1) && world.tileAt(p.x, nz) !== 2) p.z = nz;
    p.speed = keys.up || keys.down ? spd : 0;
  } else {
    const top = (s.crewSpeed ? 34 : 26);
    if (keys.up) p.speed = Math.min(top, p.speed + 16 * dt);
    else if (keys.down) p.speed = Math.max(-9, p.speed - 20 * dt);
    else p.speed *= Math.max(0, 1 - 1.4 * dt);
    const steer = (keys.left ? 1 : 0) - (keys.right ? 1 : 0);
    p.angle += steer * clamp(p.speed / top, -1, 1) * 1.9 * dt;
    const nx = p.x + Math.sin(p.angle) * p.speed * dt;
    const nz = p.z + Math.cos(p.angle) * p.speed * dt;
    if (!world.hitsBuilding(nx, p.z, 2.2) && world.tileAt(nx, p.z) !== 2) p.x = nx;
    else p.speed *= 0.4;
    if (!world.hitsBuilding(p.x, nz, 2.2) && world.tileAt(p.x, nz) !== 2) p.z = nz;
    else p.speed *= 0.4;
    // Ram traffic cars.
    for (const t of s.traffic) {
      if (dist2d(p.x, p.z, t.x, t.z) < 4.5) {
        t.speed = Math.max(t.speed, Math.abs(p.speed) * 0.5);
        p.speed *= 0.85;
      }
    }
  }
  p.x = clamp(p.x, 12, WORLD - 12);
  p.z = clamp(p.z, 12, WORLD - 12);
}

function updateTraffic(dt) {
  for (const t of s.traffic) {
    if (t.axis === 0) {
      t.x += Math.cos(t.angle) * t.speed * dt;
      if (t.x > WORLD - 20) t.x = 20;
      if (t.x < 20) t.x = WORLD - 20;
    } else {
      t.z += Math.sin(t.angle) * t.speed * dt;
      if (t.z > WORLD - 20) t.z = 20;
      if (t.z < 20) t.z = WORLD - 20;
    }
    t.group.setPose(t.x, t.z, t.angle);
  }
  for (const p of s.parked) p.group.setPose(p.x, p.z, p.angle);
  if (s.vaultCar && !s.vaultCar.stolen) s.vaultCar.group.setPose(s.vaultCar.x, s.vaultCar.z, s.vaultCar.angle);
}

function updatePeds(dt) {
  for (const p of s.peds) {
    if (!p.alive) continue;
    // Flee from the player when close.
    const d = dist2d(p.x, p.z, s.player.x, s.player.z);
    if (d < 12) {
      const a = Math.atan2(p.x - s.player.x, p.z - s.player.z);
      p.angle = angleLerp(p.angle, a, 0.1);
    } else if (Math.random() < 0.01) {
      p.angle += (Math.random() - 0.5) * 2;
    }
    const nx = p.x + Math.sin(p.angle) * p.speed * dt;
    const nz = p.z + Math.cos(p.angle) * p.speed * dt;
    if (!world.hitsBuilding(nx, nz, 0.8) && world.tileAt(nx, nz) !== 2) {
      p.x = nx; p.z = nz;
    } else {
      p.angle += Math.PI / 2;
    }
    p.group.setPose(p.x, p.z, p.angle);
  }
}

function updatePolice(dt) {
  spawnPolice(s.wanted);
  for (const pc of s.police) {
    const targetAngle = Math.atan2(s.player.x - pc.x, s.player.z - pc.z);
    pc.angle = angleLerp(pc.angle, targetAngle, 1.6 * dt);
    const top = 24;
    pc.speed = Math.min(top, pc.speed + 12 * dt);
    pc.x += Math.sin(pc.angle) * pc.speed * dt;
    pc.z += Math.cos(pc.angle) * pc.speed * dt;
    pc.group.setPose(pc.x, pc.z, pc.angle);
    const d = dist2d(pc.x, pc.z, s.player.x, s.player.z);
    if (d < 4.5 && !s.invulnerable) {
      s.health -= 14 * dt;
      if (s.health <= 0) {
        s.health = 0;
        s.mode = "busted";
        beep(120, 0.5, "sawtooth", 0.1);
      }
    }
  }
}

function updateRivals(dt) {
  for (const r of s.rivals) {
    const ring = world.raceRings[r.ring];
    if (!ring) continue;
    const targetAngle = Math.atan2(ring.x - r.x, ring.z - r.z);
    r.angle = angleLerp(r.angle, targetAngle, 1.8 * dt);
    const spd = 13 + r.progress * 0.4;
    r.x += Math.sin(r.angle) * spd * dt;
    r.z += Math.cos(r.angle) * spd * dt;
    r.group.setPose(r.x, r.z, r.angle);
    if (dist2d(r.x, r.z, ring.x, ring.z) < 9) {
      r.ring++;
      r.progress++;
      if (r.ring >= world.raceRings.length) {
        failMission("A rival won the Neon Grand Prix");
        return;
      }
    }
  }
}

// ---------- mission progress ----------
function updateMission(dt) {
  const m = s.missionIndex;
  if (s.missionTimer > 0) {
    s.missionTimer -= dt;
    if (s.missionTimer <= 0) {
      failMission("Time ran out");
      return;
    }
  }
  const p = s.player;
  if (m === 0) {
    if (s.missionStage === 0) {
      if (dist2d(p.x, p.z, world.crates.x, world.crates.z) < 9) {
        s.missionStage = 1;
        s.missionTimer = 120;
        s.target = { x: world.casino.x, z: world.casino.z };
        toast("Crates loaded — deliver them to the casino!");
        beep(520, 0.12, "sine", 0.09);
      }
    } else if (dist2d(p.x, p.z, world.casino.x, world.casino.z) < 12) {
      completeMission();
    }
  } else if (m === 1) {
    if (dist2d(p.x, p.z, world.hideout.x, world.hideout.z) < 10) completeMission();
  } else if (m === 2) {
    for (let i = 0; i < world.cashDrops.length; i++) {
      const c = world.cashDrops[i];
      if (!c.taken && dist2d(p.x, p.z, c.x, c.z) < 6) {
        c.taken = true;
        city.cashMeshes[i].visible = false;
        s.cashLeft--;
        s.money += 100;
        toast(`Cash bag grabbed! ${s.cashLeft} left. +$100`);
        beep(760, 0.1, "sine", 0.09);
        const next = world.cashDrops.find((cc) => !cc.taken);
        s.target = next ? { x: next.x, z: next.z } : null;
      }
    }
    if (s.cashLeft <= 0) completeMission();
  } else if (m === 3) {
    const ring = world.raceRings[s.raceRing];
    if (ring && dist2d(p.x, p.z, ring.x, ring.z) < 9) {
      s.raceRing++;
      if (s.raceRing >= world.raceRings.length) {
        city.rings.forEach((r) => { r.visible = false; });
        completeMission();
      } else {
        s.target = { x: world.raceRings[s.raceRing].x, z: world.raceRings[s.raceRing].z };
        toast(`Checkpoint ${s.raceRing + 1}/4!`);
        beep(660, 0.1, "sine", 0.09);
      }
    }
    updateRivals(dt);
  } else if (m === 4) {
    if (s.vaultCar && s.vaultCar.stolen && dist2d(p.x, p.z, world.hideout.x, world.hideout.z) < 10) {
      completeMission();
    }
  } else if (m === 5) {
    if (dist2d(p.x, p.z, world.observatory.x, world.observatory.z) < 12) completeMission();
  }
}

// ---------- day / night / rain ----------
function updateSky(dt) {
  s.dayClock = (s.dayClock + dt) % DAY_LENGTH;
  const phase = (s.dayClock / DAY_LENGTH) * Math.PI * 2;
  const day = clamp(0.5 + 0.5 * Math.sin(phase), 0, 1);
  s.nightFactor = 1 - day;
  const skyDay = [0.55, 0.75, 0.95];
  const skyNight = [0.05, 0.08, 0.18];
  const sky = skyDay.map((v, i) => v * day + skyNight[i] * (1 - day));
  const sunDir = [Math.cos(phase) * 0.6, Math.max(0.25, Math.sin(phase)), 0.4];
  renderer.setAtmosphere({
    sky, fog: sky,
    sunDir, ambient: 0.35 + 0.4 * day,
    fogNear: 140, fogFar: 560,
  });
  s.rainTimer -= dt;
  if (s.rainTimer <= 0) {
    s.raining = !s.raining;
    s.rainTimer = s.raining ? 12 : 35;
  }
}

// ---------- camera ----------
function updateCamera(dt) {
  const p = s.player;
  if (s.orbit && (s.mode === "title" || s.mode === "story" || s.mode === "complete")) {
    const a = s.time * 0.05;
    const cx = WORLD / 2;
    const cz = WORLD / 2 - 40;
    renderer.setCamera(
      [cx + Math.cos(a) * 260, 150, cz + Math.sin(a) * 260],
      [cx, 10, cz],
    );
    return;
  }
  // In shot-play mode pull the camera further back so the police cars
  // chasing 10-18 units behind the player stay inside the frame.
  const dist = s.shotMode === "play" ? 28 : p.inCar ? 19 : 13;
  const height = s.shotMode === "play" ? 10 : p.inCar ? 8.5 : 6.5;
  const bx = p.x - Math.sin(p.angle) * dist;
  const bz = p.z - Math.cos(p.angle) * dist;
  renderer.setCamera(
    [bx, height, bz],
    [p.x + Math.sin(p.angle) * 8, 2.5, p.z + Math.cos(p.angle) * 8],
  );
}

// ---------- shot-mode chase (deterministic demo drive) ----------
function updateShotChase(dt) {
  const p = s.player;
  p.speed = 16;
  p.angle = Math.PI / 2;
  p.x += Math.sin(p.angle) * p.speed * dt;
  if (p.x > WORLD - 30) p.x = 30;
  // Stay on the road at tz=36 (centre z=365), weaving gently.
  p.z = 36 * TILE + 5 + Math.sin(s.time * 0.4) * 2;
  s.health = 100;
  if (s.missionTimer < 60) s.missionTimer = 120;
  s.police.forEach((pc, i) => {
    // Close behind the player car so the chase reads in frame: the shot
    // camera sits 28 units behind the player, so police 10-18 back stay in view.
    pc.x = p.x - 10 - i * 4;
    pc.z = p.z + (i - 1) * 4;
    pc.angle = Math.PI / 2;
    pc.group.setPose(pc.x, pc.z, pc.angle);
  });
}

// ---------- boot ----------
function boot() {
  try {
    renderer = new Renderer(canvas3d);
  } catch (e) {
    document.body.innerHTML = "<div style='color:#fff;font-family:sans-serif;padding:40px'><h1>Cinderport</h1><p>This game needs WebGL, which this browser does not provide.</p></div>";
    return;
  }
  initInput(canvas3d);
  city = buildCity(renderer.gl, world);
  playerPerson = makePerson(renderer.gl, [0.95, 0.75, 0.2]);
  for (const m of playerPerson.meshes) personMeshes.push(m);
  spawnTraffic();
  spawnPeds();
  // Pose every entity once so the first frame never shows them at the origin.
  updateTraffic(0);
  updatePeds(0);
  playerPerson.setPose(s.player.x, s.player.z, s.player.angle);

  const shot = shotFromUrl();
  if (shot) {
    s.shotMode = shot;
    applyShot(s, shot, world);
    if (shot === "play") {
      // The player only gets a car by stealing one in normal play, so the
      // shot setup (inCar=true) had no car at all: build the yellow player
      // car here — a sport model with a black racing stripe — plus meshes
      // for the police cars (they had no group before, which crashed
      // every frame).
      playerCar = makeCar(renderer.gl, [1.0, 0.8, 0.15], false, "sport", { stripe: [0.05, 0.05, 0.05] });
      for (const m of playerCar.meshes) carMeshes.push(m);
      s.police = s.police.map((pc) => {
        const group = makeCar(renderer.gl, [0.92, 0.92, 0.92], true);
        for (const m of group.meshes) carMeshes.push(m);
        return { ...pc, group };
      });
    }
  } else {
    loadGame();
    setMission(s.missionIndex);
    s.mode = "title";
  }

  // Crew members standing at their spots.
  s.crewMarkers = world.crewSpots
    .filter((sp) => !s.crewRecruited.includes(sp.crew))
    .map((sp) => ({ x: sp.x, z: sp.z }));

  resize();
  window.addEventListener("resize", resize);
  requestAnimationFrame(loop);
}

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  canvas3d.width = w;
  canvas3d.height = h;
  canvasHud.width = w;
  canvasHud.height = h;
  if (renderer) renderer.resize();
}

// ---------- main loop ----------
let last = performance.now();
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  s.time += dt;
  if (s.toastTimer > 0) {
    s.toastTimer -= dt;
    if (s.toastTimer <= 0) s.toast = "";
  }

  // Global keys.
  if (pressed("mute")) {
    s.muted = !s.muted;
    toast(s.muted ? "Sound off." : "Sound on.");
  }
  if (pressed("enter")) {
    ensureAudio();
    if (s.mode === "title") {
      s.mode = "story";
      setMission(s.missionIndex);
    } else if (s.mode === "story") {
      s.mode = "playing";
      s.orbit = false;
    } else if (s.mode === "complete") {
      s.mode = "playing";
      s.orbit = false;
      setMission(0);
      s.money = 100;
    }
  }
  if (pressed("pause") && (s.mode === "playing" || s.mode === "paused")) {
    s.mode = s.mode === "playing" ? "paused" : "playing";
  }
  if (pressed("restart") && s.mode !== "title") {
    if (s.mode === "busted" || s.mode === "complete") {
      s.health = 100;
      s.wanted = 0;
      s.player.x = world.spawn.x;
      s.player.z = world.spawn.z;
      s.player.inCar = false;
      s.mode = "story";
      setMission(s.missionIndex);
    } else {
      setMission(s.missionIndex);
      s.health = 100;
      toast("Job restarted.");
    }
  }

  if (s.mode === "playing") {
    if (s.shotMode === "play") {
      updateShotChase(dt);
    } else {
      movePlayer(dt);
      if (pressed("action")) tryInteract();
      if (pressed("punch")) tryPunch();
      if (pressed("heal")) tryHeal();
      tryShoot();
      updateTraffic(dt);
      updatePeds(dt);
      updatePolice(dt);
      updateMission(dt);
      // Wanted decay.
      s.wantedTimer += dt;
      const decayEvery = s.crewDecay ? 6 : 12;
      if (s.wantedTimer > decayEvery && s.wanted > 0) {
        s.wantedTimer = 0;
        s.wanted--;
      }
    }
  }

  // Saving: press S while paused to write the save file.
  if (s.mode === "paused" && pressed("enter")) {
    saveGame();
  }

  s.district = world.districtAtWorld(s.player.x, s.player.z);
  updateSky(dt);
  updateCamera(dt);

  // Beacon pulse + placement at the current target.
  if (city && city.beacon) {
    if (s.target && s.mode === "playing") {
      city.beacon.visible = true;
      city.beacon.set(s.target.x, 35, s.target.z, 0, 1 + Math.sin(s.time * 3) * 0.15, 1, 1 + Math.sin(s.time * 3) * 0.15);
    } else {
      city.beacon.visible = false;
    }
  }

  // Player meshes.
  if (playerPerson) {
    playerPerson.setPose(s.player.x, s.player.z, s.player.angle);
    for (const m of playerPerson.meshes) m.visible = !s.player.inCar && s.mode !== "title";
  }
  if (playerCar) playerCar.setPose(s.player.x, s.player.z, s.player.angle);

  // Draw 3D.
  renderer.clear();
  for (const m of city.meshes) renderer.draw(m);
  for (const m of carMeshes) renderer.draw(m);
  for (const m of personMeshes) renderer.draw(m);

  // Draw HUD.
  hudCtx.clearRect(0, 0, canvasHud.width, canvasHud.height);
  drawHUD(hudCtx, canvasHud.width, canvasHud.height, s);
  updateSiren();
}

boot();
