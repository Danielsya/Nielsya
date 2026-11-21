// Sunport City world: 72x72 tiles, roads every 8 tiles. Written fresh.
import { mulberry32, pick } from './random.js';
import { CONFIG } from './config.js';
export function createWorld(seed) {
  const rng = mulberry32(seed || 1);
  const size = CONFIG.worldTiles;
  const tiles = [];
  for (let y = 0; y < size; y++) {
    const row = [];
    for (let x = 0; x < size; x++) {
      const onRoadX = x % CONFIG.roadEvery === 0;
      const onRoadY = y % CONFIG.roadEvery === 0;
      let t = 'block';
      if (onRoadX || onRoadY) t = 'road';
      else if ((x + y) % 13 === 0) t = 'park';
      row.push(t);
    }
    tiles.push(row);
  }
  const buildings = [];
  for (let y = 2; y < size - 2; y += 4) {
    for (let x = 2; x < size - 2; x += 4) {
      if (tiles[y][x] === 'block' && rng() < 0.7) buildings.push({ x, y, w: 3, h: 3, c: pick(rng, ['#8a7f8d', '#6f7f9e', '#9e8a6f', '#7f9e8a']) });
    }
  }
  return { size, tiles, buildings, rng };
}
export function isRoad(world, tx, ty) {
  if (tx < 0 || ty < 0 || tx >= world.size || ty >= world.size) return false;
  return world.tiles[ty][tx] === 'road';
}
export function isBlocked(world, px, py) {
  const tx = Math.floor(px / CONFIG.tile), ty = Math.floor(py / CONFIG.tile);
  if (tx < 0 || ty < 0 || tx >= world.size || ty >= world.size) return true;
  for (const b of world.buildings) {
    if (tx >= b.x && tx < b.x + b.w && ty >= b.y && ty < b.y + b.h) return true;
  }
  return false;
}
export function randomRoadPoint(world, rng) {
  const roadXs = [], roadYs = [];
  for (let i = 0; i < world.size; i += CONFIG.roadEvery) { roadXs.push(i); roadYs.push(i); }
  const x = pick(rng, roadXs) * CONFIG.tile + CONFIG.tile / 2;
  const y = pick(rng, roadYs) * CONFIG.tile + CONFIG.tile / 2;
  return { x, y };
}
export function roadPointAt(world, tx, ty) { return { x: tx * CONFIG.tile + CONFIG.tile / 2, y: ty * CONFIG.tile + CONFIG.tile / 2 }; }
