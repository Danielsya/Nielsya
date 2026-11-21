// Sunport City v2 (3D) — shot setups for screenshots. Written fresh.
// ?shot=start -> title screen over the 3D city
// ?shot=play  -> LIVE 3D driving chase: player car, police behind, wanted 3,
//               mission active, HUD + minimap, invulnerable, never BUSTED.
// ?shot=end   -> mission-complete screen over the 3D city
import { MISSIONS } from './config.js';
export function getShotFromURL() {
  try { const q = new URLSearchParams(location.search); return q.get('shot') || null; } catch { return null; }
}
export function applyShot(state, shot) {
  if (!shot) return;
  state.shot = shot;
  state.shotMode = true;
  state.invulnerable = true;
  if (shot === 'start') {
    state.mode = 'title'; state.wanted = 0; state.player.health = 100;
    state.player.money = 100; state.dayClock = 10;
    state.player.x = 36 * 32 + 16; state.player.z = 36 * 32 + 16; state.player.angle = 0.6;
    state.player.inCar = false; state.police = []; state.missionIndex = 0; state.mission = MISSIONS[0];
    return;
  }
  if (shot === 'end') {
    state.mode = 'complete'; state.wanted = 0; state.player.health = 100;
    state.player.money = 2300; state.dayClock = 10;
    state.missionIndex = 5; state.mission = MISSIONS[5];
    state.player.x = 36 * 32 + 16; state.player.z = 36 * 32 + 16; state.player.angle = 0.6;
    state.player.inCar = false; state.police = [];
    return;
  }
  // play: live chase, never game-over
  state.mode = 'playing';
  state.wanted = 3;
  state.missionIndex = 0;
  state.mission = MISSIONS[0];
  state.missionTime = MISSIONS[0].time;
  state.player.health = 100;
  state.player.ammo = 30;
  state.player.money = 250;
  state.player.inCar = true;
  state.player.speed = 200;
  state.player.angle = 0;
  state.player.x = 16 * 32 + 16;
  state.player.z = 16 * 32 + 16;
  state.missionTarget = { x: 40 * 32 + 16, z: 16 * 32 + 16 };
  state.police = [
    { x: state.player.x - 110, z: state.player.z - 14, angle: 0, speed: 210, mesh: null },
    { x: state.player.x - 180, z: state.player.z + 16, angle: 0, speed: 205, mesh: null },
    { x: state.player.x - 250, z: state.player.z - 8, angle: 0, speed: 200, mesh: null },
  ];
  state.traffic = [
    { x: state.player.x + 320, z: state.player.z, angle: 0, speed: 90, color: 0xe05a4d, mesh: null },
    { x: state.player.x + 520, z: 8 * 32 + 16, angle: 0, speed: 90, color: 0x4dd0a5, mesh: null },
    { x: 24 * 32 + 16, z: 8 * 32 + 16, angle: 0, speed: 90, color: 0xc96fd1, mesh: null },
  ];
  state.peds = [
    { x: state.player.x + 150, z: state.player.z + 60, mesh: null },
    { x: state.player.x + 260, z: state.player.z - 60, mesh: null },
  ];
}
