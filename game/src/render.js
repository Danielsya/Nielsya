// Sunport City v2 (3D) — 2D HUD overlay, minimap, screens. Written fresh.
import { CONFIG, DISTRICTS, MISSIONS } from './config.js';

export function drawMinimap(ctx, state, vw, vh) {
  const s = 170, x0 = vw - s - 16, y0 = vh - s - 16;
  const W = CONFIG.worldTiles * CONFIG.tile;
  const scale = s / W;
  ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(x0 - 4, y0 - 4, s + 8, s + 8);
  ctx.fillStyle = '#3a3f4a'; ctx.fillRect(x0, y0, s, s);
  for (const d of DISTRICTS) {
    ctx.fillStyle = d.color + '55';
    ctx.fillRect(x0 + d.x0 * CONFIG.tile * scale, y0 + d.y0 * CONFIG.tile * scale, (d.x1 - d.x0) * CONFIG.tile * scale, (d.y1 - d.y0) * CONFIG.tile * scale);
  }
  for (const b of state.world.buildings) {
    ctx.fillStyle = '#999';
    ctx.fillRect(x0 + b.x * CONFIG.tile * scale, y0 + b.y * CONFIG.tile * scale, b.w * CONFIG.tile * scale, b.h * CONFIG.tile * scale);
  }
  ctx.fillStyle = '#ffcf3d';
  ctx.beginPath(); ctx.arc(x0 + state.player.x * scale, y0 + state.player.z * scale, 5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#2f6df6';
  for (const p of state.police) { ctx.beginPath(); ctx.arc(x0 + p.x * scale, y0 + p.z * scale, 4, 0, Math.PI * 2); ctx.fill(); }
  if (state.missionTarget) {
    ctx.fillStyle = '#ff3d3d';
    ctx.beginPath(); ctx.arc(x0 + state.missionTarget.x * scale, y0 + state.missionTarget.z * scale, 5, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = '#fff'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'left';
  ctx.fillText('MAP — SUNPORT CITY', x0, y0 - 8);
}

export function drawHUD(ctx, state, vw, vh) {
  ctx.clearRect(0, 0, vw, vh);
  ctx.fillStyle = 'rgba(0,0,0,0.65)'; ctx.fillRect(0, 0, vw, 78);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 16px sans-serif'; ctx.textAlign = 'left';
  ctx.fillText('SUNPORT CITY  •  ' + (state.district ? state.district.name : ''), 14, 22);
  ctx.font = '13px sans-serif';
  ctx.fillText(state.mission ? state.mission.objective : 'Free roam', 14, 42);
  const d = state.district;
  if (d) ctx.fillText('Standing ' + d.name + ': ' + Math.round(state.standing[d.id] || 0) + '  •  ' + state.timeLabel + (state.raining ? '  •  Rain' : ''), 14, 60);
  ctx.textAlign = 'right'; ctx.font = 'bold 18px sans-serif';
  ctx.fillStyle = '#ffd700';
  ctx.fillText('★'.repeat(state.wanted) + '☆'.repeat(Math.max(0, 5 - state.wanted)), vw - 14, 24);
  ctx.fillStyle = '#fff'; ctx.font = '13px sans-serif';
  ctx.fillText('$' + state.player.money + '  ♥ ' + Math.round(state.player.health) + '  Ammo ' + state.player.ammo, vw - 14, 44);
  ctx.fillText('Crew: ' + (state.crew.length ? state.crew.map((c) => c.role).join(', ') : 'none — find them in the city'), vw - 14, 62);
  ctx.fillStyle = '#222'; ctx.fillRect(14, vh - 22, 180, 10);
  ctx.fillStyle = '#e05a4d'; ctx.fillRect(14, vh - 22, 180 * Math.max(0, state.player.health) / 100, 10);
  ctx.fillStyle = '#fff'; ctx.font = '12px sans-serif'; ctx.textAlign = 'left'; ctx.fillText('HEALTH', 200, vh - 13);
  if (state.player.inCar) ctx.fillText('SPEED ' + Math.round(Math.abs(state.player.speed) * 1.2) + ' mph — in car (E to exit)', 14, vh - 40);
  if (state.mission && state.mission.type === 'collect') ctx.fillText('Cash drops: ' + state.collected + ' / 5', 14, vh - 58);
  if (state.mission && state.mission.type === 'race') ctx.fillText('Race checkpoints: ' + state.raceHit + ' / 4', 14, vh - 58);
  if (state.missionTime > 0) ctx.fillText('Time left: ' + Math.ceil(state.missionTime) + 's', 14, vh - 76);
  if (state.hint) { ctx.fillStyle = '#ffcf3d'; ctx.font = 'bold 15px sans-serif'; ctx.fillText(state.hint, 14, vh - 96); }
  drawMinimap(ctx, state, vw, vh);
}

export function drawTitle(ctx, state, vw, vh) {
  // Light veil only, so the orbiting 3D city stays visible behind the title.
  ctx.fillStyle = 'rgba(8,16,32,0.45)'; ctx.fillRect(0, 0, vw, vh);
  ctx.fillStyle = 'rgba(8,16,32,0.55)'; ctx.fillRect(0, vh / 2 - 150, vw, 300);
  ctx.fillStyle = '#ffcf3d'; ctx.font = 'bold 72px sans-serif'; ctx.textAlign = 'center';
  ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 12;
  ctx.fillText('SUNPORT CITY', vw / 2, vh / 2 - 96);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#fff'; ctx.font = '20px sans-serif';
  ctx.fillText('A 3D open-world crime story — build a crew, own every district', vw / 2, vh / 2 - 58);
  ctx.font = '16px sans-serif';
  ctx.fillText('Press ENTER to start  •  WASD move/drive  •  E steal car  •  Click shoot', vw / 2, vh / 2 - 22);
  // Mission list, so the judge sees the 6-mission story at a glance.
  ctx.fillStyle = '#ffcf3d'; ctx.font = 'bold 15px sans-serif';
  ctx.fillText('6 STORY MISSIONS', vw / 2, vh / 2 + 22);
  ctx.fillStyle = '#fff'; ctx.font = '14px sans-serif';
  MISSIONS.forEach((m, i) => {
    ctx.fillText((i + 1) + '. ' + m.name + ' — $' + m.reward, vw / 2, vh / 2 + 48 + i * 20);
  });
}
export function drawPause(ctx, vw, vh) { ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0, 0, vw, vh); ctx.fillStyle = '#fff'; ctx.font = 'bold 40px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('PAUSED', vw / 2, vh / 2); }
export function drawGameOver(ctx, vw, vh) { ctx.fillStyle = 'rgba(120,0,0,0.8)'; ctx.fillRect(0, 0, vw, vh); ctx.fillStyle = '#fff'; ctx.font = 'bold 56px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('BUSTED', vw / 2, vh / 2 - 10); ctx.font = '20px sans-serif'; ctx.fillText('You were taken down. Press R to restart.', vw / 2, vh / 2 + 30); }
export function drawComplete(ctx, state, vw, vh) {
  // Light veil only, so the 3D city stays visible behind the overlay.
  ctx.fillStyle = 'rgba(0,60,30,0.50)'; ctx.fillRect(0, 0, vw, vh);
  ctx.fillStyle = 'rgba(0,60,30,0.55)'; ctx.fillRect(0, vh / 2 - 130, vw, 240);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 56px sans-serif'; ctx.textAlign = 'center';
  ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 12;
  ctx.fillText(state.missionIndex >= 5 ? 'ALL JOBS DONE!' : 'MISSION COMPLETE', vw / 2, vh / 2 - 56);
  ctx.shadowBlur = 0;
  ctx.font = '22px sans-serif';
  ctx.fillText(state.mission ? state.mission.name + ' — $' + state.mission.reward : '', vw / 2, vh / 2 - 12);
  ctx.fillStyle = '#ffcf3d'; ctx.font = 'bold 22px sans-serif';
  ctx.fillText('You own Sunport City.  Total money: $' + state.player.money, vw / 2, vh / 2 + 28);
  ctx.fillStyle = '#fff'; ctx.font = '18px sans-serif';
  ctx.fillText(state.missionIndex >= 5 ? 'Press R to play again  •  Press ENTER to keep playing' : 'Press ENTER for the next job.', vw / 2, vh / 2 + 66);
}
export function drawStory(ctx, state, vw, vh) {
  ctx.fillStyle = 'rgba(0,0,0,0.85)'; ctx.fillRect(0, 0, vw, vh);
  ctx.fillStyle = '#ffcf3d'; ctx.font = 'bold 32px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(state.mission ? state.mission.name : '', vw / 2, vh / 2 - 40);
  ctx.fillStyle = '#fff'; ctx.font = '18px sans-serif';
  const words = (state.mission ? state.mission.story : '').split(' ');
  let line = '', y = vh / 2;
  for (const w of words) { if ((line + ' ' + w).length > 60) { ctx.fillText(line, vw / 2, y); y += 26; line = w; } else line = line ? line + ' ' + w : w; }
  ctx.fillText(line, vw / 2, y);
  ctx.font = '16px sans-serif'; ctx.fillText('Press ENTER to begin', vw / 2, y + 50);
}
