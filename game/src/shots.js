// Shot setups for screenshots. Written fresh.
// ?shot=start -> title screen over the city
// ?shot=play  -> LIVE driving chase: player in a car, police chasing,
//               wanted 3, mission 1 active, health full, NO BUSTED.
//               Shot mode is invulnerable: health loss and arrest are
//               disabled while shotMode is true, so the render can never
//               flip to game-over.
// ?shot=end   -> mission-complete screen over the city
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
    state.mode = 'title';
    state.wanted = 0;
    state.player.health = 100;
    return;
  }
  if (shot === 'end') {
    state.mode = 'complete';
    state.wanted = 0;
    state.player.health = 100;
    state.player.money += 500;
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
  state.player.speed = 6;
  state.player.angle = 0;
  // Put the player car on a horizontal road, centre of the view.
  state.player.x = 16 * 32 + 16;
  state.player.y = 16 * 32 + 16;
  // Mission target ahead, to the east on the same road.
  state.missionTarget = { x: 40 * 32 + 16, y: 16 * 32 + 16 };
  // 3 police cars chasing behind (west), on the same road.
  state.police = [
    { x: state.player.x - 90, y: state.player.y - 10, angle: 0, speed: 6.2 },
    { x: state.player.x - 150, y: state.player.y + 12, angle: 0, speed: 6.0 },
    { x: state.player.x - 210, y: state.player.y - 6, angle: 0, speed: 5.8 },
  ];
  // Traffic ahead and around, on roads, not colliding with the player.
  state.traffic = [
    { x: state.player.x + 260, y: state.player.y, angle: 0, speed: 3, color: '#e05a4d' },
    { x: state.player.x + 420, y: 8 * 32 + 16, angle: 0, speed: 3, color: '#4dd0a5' },
    { x: 24 * 32 + 16, y: 8 * 32 + 16, angle: 0, speed: 3, color: '#c96fd1' },
    { x: state.player.x - 320, y: 24 * 32 + 16, angle: 0, speed: 3, color: '#e05a4d' },
  ];
  state.peds = [
    { x: state.player.x + 120, y: state.player.y + 48 },
    { x: state.player.x + 200, y: state.player.y - 48 },
    { x: state.player.x - 60, y: state.player.y + 64 },
  ];
  state.cam = { x: state.player.x - 640, y: state.player.y - 360 };
}
