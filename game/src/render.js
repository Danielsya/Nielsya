// Rendering: city, actors, HUD, minimap, screens. Written fresh.
import { CONFIG, COLOURS } from './config.js';
export function drawCity(ctx, world, cam, vw, vh) {
  const t = CONFIG.tile;
  const x0 = Math.max(0, Math.floor(cam.x / t)), x1 = Math.min(world.size - 1, Math.ceil((cam.x + vw) / t));
  const y0 = Math.max(0, Math.floor(cam.y / t)), y1 = Math.min(world.size - 1, Math.ceil((cam.y + vh) / t));
  ctx.fillStyle = COLOURS.grass; ctx.fillRect(0, 0, vw, vh);
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const s = world.tiles[y][x], px = x * t - cam.x, py = y * t - cam.y;
      if (s === 'road') { ctx.fillStyle = COLOURS.road; ctx.fillRect(px, py, t, t); ctx.fillStyle = COLOURS.roadLine; if (x % 2 === 0) ctx.fillRect(px + t / 2 - 1, py, 2, t); }
      else if (s === 'park') { ctx.fillStyle = COLOURS.park; ctx.fillRect(px, py, t, t); }
      else { ctx.fillStyle = COLOURS.sidewalk; ctx.fillRect(px, py, t, t); }
    }
  }
  for (const b of world.buildings) {
    const px = b.x * t - cam.x, py = b.y * t - cam.y;
    if (px > -120 && px < vw + 120 && py > -120 && py < vh + 120) { ctx.fillStyle = b.c; ctx.fillRect(px, py, b.w * t, b.h * t); ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(px + 6, py + 6, b.w * t - 12, 8); }
  }
}
export function drawCar(ctx, x, y, angle, color, cam) {
  ctx.save(); ctx.translate(x - cam.x, y - cam.y); ctx.rotate(angle);
  ctx.fillStyle = color; ctx.fillRect(-18, -9, 36, 18);
  ctx.fillStyle = 'rgba(180,220,255,0.8)'; ctx.fillRect(-4, -7, 12, 14);
  ctx.fillStyle = '#111'; ctx.fillRect(-13, -11, 8, 4); ctx.fillRect(-13, 7, 8, 4); ctx.fillRect(6, -11, 8, 4); ctx.fillRect(6, 7, 8, 4);
  ctx.restore();
}
export function drawPerson(ctx, x, y, color, cam) {
  ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x - cam.x, y - cam.y, 7, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#222'; ctx.fillRect(x - cam.x - 3, y - cam.y - 3, 6, 6);
}
export function drawActors(ctx, state, cam) {
  for (const c of state.traffic) drawCar(ctx, c.x, c.y, c.angle, c.color, cam);
  for (const p of state.peds) drawPerson(ctx, p.x, p.y, COLOURS.ped, cam);
  for (const p of state.police) { drawCar(ctx, p.x, p.y, p.angle, COLOURS.police, cam); ctx.fillStyle = '#ff3d3d'; ctx.fillRect(p.x - cam.x - 4, p.y - cam.y - 14, 8, 4); }
  const pl = state.player;
  if (pl.inCar) drawCar(ctx, pl.x, pl.y, pl.angle, COLOURS.player, cam);
  else drawPerson(ctx, pl.x, pl.y, COLOURS.player, cam);
  if (state.missionTarget) { ctx.fillStyle = '#ffcf3d'; ctx.beginPath(); ctx.arc(state.missionTarget.x - cam.x, state.missionTarget.y - cam.y, 10, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#111'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('!', state.missionTarget.x - cam.x, state.missionTarget.y - cam.y + 4); }
}
export function drawMinimap(ctx, state, vw, vh) {
  const s = 150, x0 = vw - s - 16, y0 = vh - s - 16;
  ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(x0 - 4, y0 - 4, s + 8, s + 8);
  const scale = s / (state.world.size * CONFIG.tile);
  ctx.fillStyle = '#3a3f4a'; ctx.fillRect(x0, y0, s, s);
  for (const b of state.world.buildings) ctx.fillStyle = '#888', ctx.fillRect(x0 + b.x * CONFIG.tile * scale, y0 + b.y * CONFIG.tile * scale, b.w * CONFIG.tile * scale, b.h * CONFIG.tile * scale);
  ctx.fillStyle = '#ffcf3d'; ctx.beginPath(); ctx.arc(x0 + state.player.x * scale, y0 + state.player.y * scale, 5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#2f6df6'; for (const p of state.police) { ctx.beginPath(); ctx.arc(x0 + p.x * scale, y0 + p.y * scale, 4, 0, Math.PI * 2); ctx.fill(); }
  if (state.missionTarget) { ctx.fillStyle = '#ff3d3d'; ctx.beginPath(); ctx.arc(x0 + state.missionTarget.x * scale, y0 + state.missionTarget.y * scale, 5, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = '#fff'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'left'; ctx.fillText('MAP — SUNPORT CITY', x0, y0 - 8);
}
export function drawHUD(ctx, state, vw, vh) {
  ctx.fillStyle = 'rgba(0,0,0,0.65)'; ctx.fillRect(0, 0, vw, 56);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 16px sans-serif'; ctx.textAlign = 'left';
  ctx.fillText('SUNPORT CITY', 14, 22);
  ctx.font = '13px sans-serif'; ctx.fillText(state.mission ? state.mission.objective : 'Free roam', 14, 42);
  ctx.textAlign = 'right'; ctx.font = 'bold 18px sans-serif';
  ctx.fillStyle = '#ffd700'; ctx.fillText('★'.repeat(state.wanted) + '☆'.repeat(Math.max(0, 5 - state.wanted)), vw - 14, 24);
  ctx.fillStyle = '#fff'; ctx.font = '13px sans-serif';
  ctx.fillText('$' + state.player.money + '  ♥ ' + Math.round(state.player.health) + '  Ammo ' + state.player.ammo, vw - 14, 44);
  ctx.fillStyle = '#222'; ctx.fillRect(14, vh - 22, 180, 10);
  ctx.fillStyle = '#e05a4d'; ctx.fillRect(14, vh - 22, 180 * Math.max(0, state.player.health) / 100, 10);
  ctx.fillStyle = '#fff'; ctx.font = '12px sans-serif'; ctx.textAlign = 'left'; ctx.fillText('HEALTH', 200, vh - 13);
  if (state.player.inCar) { ctx.fillStyle = '#fff'; ctx.fillText('SPEED ' + Math.round(Math.abs(state.player.speed) * 12) + ' mph — in car (E to exit)', 14, vh - 40); }
  drawMinimap(ctx, state, vw, vh);
}
export function drawTitle(ctx, vw, vh) {
  ctx.fillStyle = 'rgba(10,20,40,0.72)'; ctx.fillRect(0, 0, vw, vh);
  ctx.fillStyle = '#ffcf3d'; ctx.font = 'bold 64px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('SUNPORT CITY', vw / 2, vh / 2 - 60);
  ctx.fillStyle = '#fff'; ctx.font = '20px sans-serif'; ctx.fillText('An open-world crime game — drive, steal, escape the law', vw / 2, vh / 2 - 20);
  ctx.font = '16px sans-serif'; ctx.fillText('Press ENTER to start  •  WASD move/drive  •  E steal car  •  Click shoot', vw / 2, vh / 2 + 30);
}
export function drawPause(ctx, vw, vh) { ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0, 0, vw, vh); ctx.fillStyle = '#fff'; ctx.font = 'bold 40px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('PAUSED', vw / 2, vh / 2); }
export function drawGameOver(ctx, vw, vh) { ctx.fillStyle = 'rgba(120,0,0,0.8)'; ctx.fillRect(0, 0, vw, vh); ctx.fillStyle = '#fff'; ctx.font = 'bold 56px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('BUSTED', vw / 2, vh / 2 - 10); ctx.font = '20px sans-serif'; ctx.fillText('You were taken down. Press R to restart.', vw / 2, vh / 2 + 30); }
export function drawComplete(ctx, vw, vh) { ctx.fillStyle = 'rgba(0,80,40,0.75)'; ctx.fillRect(0, 0, vw, vh); ctx.fillStyle = '#fff'; ctx.font = 'bold 48px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('MISSION COMPLETE', vw / 2, vh / 2 - 10); ctx.font = '20px sans-serif'; ctx.fillText('Sunport City is yours. Press ENTER for the next job.', vw / 2, vh / 2 + 30); }
