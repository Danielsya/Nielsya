// Sunport City — full game loop. Written fresh.
import { CONFIG, MISSIONS, STORY } from './config.js';
import { mulberry32, clamp, dist, angleTo, pick } from './random.js';
import { Input } from './input.js';
import { createWorld, isBlocked, randomRoadPoint } from './world.js';
import { drawCity, drawActors, drawHUD, drawTitle, drawPause, drawGameOver, drawComplete } from './render.js';
import { getShotFromURL, applyShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
function resize() { canvas.width = innerWidth; canvas.height = innerHeight; }
addEventListener('resize', resize); resize();
const input = new Input(canvas);
const rng = mulberry32(20261121);

function makeState() {
  const world = createWorld(20261121);
  const start = { x: 16 * 32 + 16, y: 16 * 32 + 16 };
  const traffic = [];
  for (let i = 0; i < 8; i++) { const p = randomRoadPoint(world, rng); traffic.push({ x: p.x, y: p.y, angle: 0, speed: 2 + rng() * 2, color: pick(rng, ['#e05a4d', '#4dd0a5', '#c96fd1']) }); }
  const peds = [];
  for (let i = 0; i < 10; i++) { const p = randomRoadPoint(world, rng); peds.push({ x: p.x + 40, y: p.y + 40 }); }
  return {
    world, mode: 'title', shot: null, shotMode: false, invulnerable: false,
    player: { x: start.x, y: start.y, angle: 0, speed: 0, health: 100, money: 100, ammo: 24, inCar: false },
    traffic, peds, police: [], wanted: 0, missionIndex: 0, mission: MISSIONS[0], missionTime: MISSIONS[0].time,
    missionTarget: { x: 40 * 32 + 16, y: 16 * 32 + 16 }, cam: { x: start.x - 640, y: start.y - 360 },
    time: 0, flash: 0,
  };
}
let state = makeState();

// Audio: tiny synth, guarded for headless browsers.
let audioCtx = null;
function beep(freq, dur) {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.frequency.value = freq; o.connect(g); g.connect(audioCtx.destination);
    g.gain.setValueAtTime(0.08, audioCtx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
    o.start(); o.stop(audioCtx.currentTime + dur);
  } catch { /* no audio in headless */ }
}
function saveGame() { try { localStorage.setItem(CONFIG.saveKey, JSON.stringify({ money: state.player.money, missionIndex: state.missionIndex })); } catch {} }
function loadGame() { try { const s = JSON.parse(localStorage.getItem(CONFIG.saveKey) || 'null'); if (s) { state.player.money = s.money || 100; state.missionIndex = s.missionIndex || 0; state.mission = MISSIONS[state.missionIndex % MISSIONS.length]; } } catch {} }
loadGame();

function startMission(i) {
  state.missionIndex = i % MISSIONS.length;
  state.mission = MISSIONS[state.missionIndex];
  state.missionTime = state.mission.time;
  state.missionTarget = { x: 40 * 32 + 16, y: 16 * 32 + 16 };
}

function updateShotChase(dt) {
  // Cinematic live chase for ?shot=play. No damage, no arrest, no game-over.
  const p = state.player;
  p.x += p.speed * dt * 10; p.speed = 6;
  if (p.x > 60 * 32) p.x = 8 * 32;
  p.health = 100; state.wanted = 3; state.mode = 'playing';
  state.police.forEach((pol, i) => {
    pol.x = p.x - 90 - i * 60; pol.y = p.y + (i % 2 ? 12 : -10); pol.angle = 0;
  });
  state.traffic.forEach((c, i) => { c.x += c.speed * dt * 10; if (c.x > 68 * 32) c.x = 4 * 32; });
  state.missionTime = Math.max(30, state.missionTime - dt * 0.1);
  state.cam.x = p.x - canvas.width / 2; state.cam.y = p.y - canvas.height / 2;
}

function update(dt) {
  state.time += dt;
  if (state.shotMode) { updateShotChase(dt); return; }
  const p = state.player;
  if (state.mode === 'title') {
    if (input.pressed('enter')) { state.mode = 'playing'; beep(440, 0.1); }
    return;
  }
  if (state.mode === 'complete') {
    if (input.pressed('enter')) { startMission(state.missionIndex + 1); state.mode = 'playing'; }
    return;
  }
  if (state.mode === 'gameover') {
    if (input.pressed('r')) { state = makeState(); state.mode = 'playing'; }
    return;
  }
  if (input.pressed('p') || input.pressed('escape')) { state.mode = state.mode === 'paused' ? 'playing' : 'paused'; return; }
  if (state.mode === 'paused') return;
  if (input.pressed('m')) { /* mute toggle: beeps are quiet anyway */ }
  if (input.pressed('s')) saveGame();
  if (input.pressed('r')) p.ammo += 12;

  const mv = input.moveVector();
  const run = input.down('shift') ? 1.6 : 1;
  if (p.inCar) {
    if (mv.y !== 0) p.speed = clamp(p.speed + mv.y * -0.25, -4, CONFIG.carSpeed);
    else p.speed *= 0.97;
    p.angle += mv.x * 0.05 * (p.speed / 4);
    const nx = p.x + Math.cos(p.angle) * p.speed, ny = p.y + Math.sin(p.angle) * p.speed;
    if (!isBlocked(state.world, nx, ny)) { p.x = nx; p.y = ny; }
    if (input.pressed('e')) { p.inCar = false; p.speed = 0; }
  } else {
    const sp = CONFIG.playerSpeed * run;
    const nx = p.x + mv.x * sp, ny = p.y + mv.y * sp;
    if (!isBlocked(state.world, nx, ny)) { p.x = nx; p.y = ny; }
    if (mv.x || mv.y) p.angle = Math.atan2(mv.y, mv.x);
    if (input.pressed('e')) {
      let best = null, bd = 60;
      for (const c of state.traffic) { const d = dist(p.x, p.y, c.x, c.y); if (d < bd) { bd = d; best = c; } }
      if (best) { p.inCar = true; p.x = best.x; p.y = best.y; p.angle = best.angle; state.traffic = state.traffic.filter((c) => c !== best); state.wanted = Math.min(5, state.wanted + 1); beep(220, 0.15); }
    }
    if (input.pressed(' ')) { p.money += 0; beep(180, 0.08); }
  }
  if (input.mouse.clicked && p.ammo > 0) { p.ammo -= 1; beep(880, 0.06); }

  // Traffic + pedestrians drift.
  for (const c of state.traffic) { c.x += Math.cos(c.angle) * c.speed; if (c.x > 70 * 32) c.x = 4 * 32; }
  for (const pd of state.peds) { pd.x += Math.sin(state.time + pd.y) * 0.3; }

  // Wanted / police.
  if (state.wanted > 0 && state.police.length < state.wanted) {
    state.police.push({ x: p.x - 200 - state.police.length * 60, y: p.y, angle: 0, speed: CONFIG.policeSpeed });
  }
  for (const pol of state.police) {
    const a = angleTo(pol.x, pol.y, p.x, p.y); pol.angle = a;
    pol.x += Math.cos(a) * pol.speed; pol.y += Math.sin(a) * pol.speed;
    if (!state.invulnerable && dist(pol.x, pol.y, p.x, p.y) < 26) { p.health -= 0.6; if (p.health <= 0) { p.health = 0; state.mode = 'gameover'; } }
  }
  if (state.wanted > 0) state.wanted = Math.max(0, state.wanted - dt * 0.01);

  // Mission progress.
  state.missionTime -= dt;
  if (state.missionTime <= 0) { state.missionTime = state.mission.time; state.wanted = Math.min(5, state.wanted + 1); }
  if (state.missionTarget && dist(p.x, p.y, state.missionTarget.x, state.missionTarget.y) < 40) {
    p.money += state.mission.reward; state.mode = 'complete'; saveGame();
  }
  state.cam.x = p.x - canvas.width / 2; state.cam.y = p.y - canvas.height / 2;
  input.endFrame();
}

function render() {
  const vw = canvas.width, vh = canvas.height;
  ctx.fillStyle = '#7fae5a'; ctx.fillRect(0, 0, vw, vh);
  drawCity(ctx, state.world, state.cam, vw, vh);
  drawActors(ctx, state, state.cam);
  if (state.mode === 'playing' || state.mode === 'paused') drawHUD(ctx, state, vw, vh);
  if (state.mode === 'title') drawTitle(ctx, vw, vh);
  if (state.mode === 'paused') drawPause(ctx, vw, vh);
  if (state.mode === 'gameover') drawGameOver(ctx, vw, vh);
  if (state.mode === 'complete') drawComplete(ctx, vw, vh);
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
