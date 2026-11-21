// Sunport City v2 (3D) — island city data on the XZ plane (y is up in 3D). Written fresh.
import { mulberry32, pick, randRange } from './random.js';
import { CONFIG, DISTRICTS } from './config.js';

export function districtAt(px, pz) {
  const tx = Math.floor(px / CONFIG.tile), ty = Math.floor(pz / CONFIG.tile);
  for (const d of DISTRICTS) if (tx >= d.x0 && tx < d.x1 && ty >= d.y0 && ty < d.y1) return d;
  return DISTRICTS[0];
}

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
      else if (x >= 60 && y < 12) t = 'water';
      else if (y >= 64) t = 'sand';
      else if ((x + y) % 13 === 0) t = 'park';
      row.push(t);
    }
    tiles.push(row);
  }
  const palettes = {
    downtown: [0x7a6a8a, 0x5f708f, 0x8a7f6a, 0x6a8a7f],
    marina: [0x4a6a8a, 0x6a7a8a, 0x8a6a5a],
    oldtown: [0x9e8a6f, 0x8a7a5a, 0xa08a6a],
    hills: [0x7f9e8a, 0x8a9e7f, 0x6f8a9e],
    beach: [0xd8c8a0, 0xc8b890, 0xe0d0a8],
  };
  const buildings = [];
  for (let y = 2; y < size - 2; y += 4) {
    for (let x = 2; x < size - 2; x += 4) {
      if (tiles[y][x] === 'block' && rng() < 0.68) {
        const d = districtAt(x * CONFIG.tile, y * CONFIG.tile);
        const tall = d.id === 'downtown' && rng() < 0.5;
        buildings.push({
          x, y, w: 3, h: 3,
          cx: x * CONFIG.tile + 1.5 * CONFIG.tile,
          cz: y * CONFIG.tile + 1.5 * CONFIG.tile,
          height: tall ? randRange(rng, 90, 220) : randRange(rng, 18, 60),
          c: pick(rng, palettes[d.id] || palettes.downtown),
          district: d.id, tall,
        });
      }
    }
  }
  const shops = [
    { x: 24 * 32 + 16, z: 32 * 32 + 16, name: 'Ammo & Meds — Downtown' },
    { x: 8 * 32 + 16, z: 40 * 32 + 16, name: 'Ammo & Meds — Old Town' },
    { x: 48 * 32 + 16, z: 56 * 32 + 16, name: 'Ammo & Meds — Beach' },
  ];
  const hideout = { x: 8 * 32 + 16, z: 32 * 32 + 16, name: 'Hideout' };
  const raceStart = { x: 8 * 32 + 16, z: 56 * 32 + 16 };
  const raceChecks = [
    { x: 24 * 32 + 16, z: 56 * 32 + 16 }, { x: 40 * 32 + 16, z: 64 * 32 + 16 },
    { x: 56 * 32 + 16, z: 56 * 32 + 16 }, { x: 64 * 32 + 16, z: 64 * 32 + 16 },
  ];
  const crewSpots = [
    { x: 32 * 32 + 16, z: 32 * 32 + 16, crew: 'driver' },
    { x: 16 * 32 + 16, z: 40 * 32 + 16, crew: 'hacker' },
    { x: 40 * 32 + 16, z: 16 * 32 + 16, crew: 'muscle' },
  ];
  const vaultCar = { x: 40 * 32 + 16, z: 8 * 32 + 16 };
  return { size, tiles, buildings, shops, hideout, raceStart, raceChecks, crewSpots, vaultCar, rng };
}
export function isRoad(world, tx, ty) {
  if (tx < 0 || ty < 0 || tx >= world.size || ty >= world.size) return false;
  return world.tiles[ty][tx] === 'road';
}
export function isBlocked(world, px, pz) {
  const tx = Math.floor(px / CONFIG.tile), ty = Math.floor(pz / CONFIG.tile);
  if (tx < 0 || ty < 0 || tx >= world.size || ty >= world.size) return true;
  if (world.tiles[ty][tx] === 'water') return true;
  for (const b of world.buildings) {
    if (tx >= b.x && tx < b.x + b.w && ty >= b.y && ty < b.y + b.h) return true;
  }
  return false;
}
export function randomRoadPoint(world, rng) {
  const roadXs = [], roadYs = [];
  for (let i = 0; i < world.size; i += CONFIG.roadEvery) { roadXs.push(i); roadYs.push(i); }
  const x = pick(rng, roadXs) * CONFIG.tile + CONFIG.tile / 2;
  const z = pick(rng, roadYs) * CONFIG.tile + CONFIG.tile / 2;
  return { x, z };
}
export function roadPointAt(world, tx, ty) { return { x: tx * CONFIG.tile + CONFIG.tile / 2, z: ty * CONFIG.tile + CONFIG.tile / 2 }; }
