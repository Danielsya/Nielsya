// World generation for Cinderport: tile map, districts, buildings and places.
// Deterministic from a fixed seed so every run builds the same island.
import { TILE, MAP, DISTRICTS } from "./config.js";
import { makeRng } from "./random.js";

export const TILE_ROAD = 1;
export const TILE_BLOCK = 0;
export const TILE_WATER = 2;
export const TILE_PARK = 3;
export const TILE_BEACH = 4;

const VOLCANO = { tx: 36, tz: 10, r: 7 };

export function districtAt(tx, tz) {
  // North: Observatory Heights around the volcano. North-east: Neon Strip.
  // East: Harborlight Wharf. West-center: Lavaflow Row. South: Blacksand Shore.
  if (tz >= 58) return 4;
  if (tz < 20 && tx >= 24 && tx < 48) return 0;
  if (tz < 34 && tx >= 48) return 1;
  if (tx >= 56) return 2;
  if (tx < 24 && tz >= 24 && tz < 58) return 3;
  if (tz < 20) return 0;
  return 2;
}

export function buildWorld(seed = 1337) {
  const rng = makeRng(seed);
  const tiles = new Uint8Array(MAP * MAP);
  const at = (tx, tz) => tiles[tz * MAP + tx];
  const set = (tx, tz, v) => {
    if (tx >= 0 && tx < MAP && tz >= 0 && tz < MAP) tiles[tz * MAP + tx] = v;
  };

  // Base: blocks, roads every 6 tiles, water south, beach strip above it.
  for (let tz = 0; tz < MAP; tz++) {
    for (let tx = 0; tx < MAP; tx++) {
      if (tz >= 66) set(tx, tz, TILE_WATER);
      else if (tz >= 62) set(tx, tz, TILE_BEACH);
      else if (tx % 6 === 0 || tz % 6 === 0) set(tx, tz, TILE_ROAD);
      else set(tx, tz, TILE_BLOCK);
    }
  }
  // Harbor inlet on the east edge.
  for (let tz = 36; tz < 52; tz++) {
    for (let tx = 68; tx < MAP; tx++) set(tx, tz, TILE_WATER);
  }
  // Volcano crater: rock, no roads or buildings.
  for (let tz = 0; tz < MAP; tz++) {
    for (let tx = 0; tx < MAP; tx++) {
      const dx = tx - VOLCANO.tx;
      const dz = tz - VOLCANO.tz;
      if (dx * dx + dz * dz < VOLCANO.r * VOLCANO.r) set(tx, tz, TILE_BLOCK);
    }
  }
  // Parks: a few green blocks.
  const parks = [
    [12, 12], [30, 30], [48, 48], [18, 42], [54, 18],
  ];
  for (const [px, pz] of parks) {
    for (let tz = pz; tz < pz + 3; tz++) {
      for (let tx = px; tx < px + 3; tx++) {
        if (at(tx, tz) === TILE_BLOCK) set(tx, tz, TILE_PARK);
      }
    }
  }

  const tileCenter = (tx, tz) => ({ x: (tx + 0.5) * TILE, z: (tz + 0.5) * TILE });
  const buildings = [];
  const trees = [];
  const lamps = [];

  for (let tz = 1; tz < MAP - 1; tz++) {
    for (let tx = 1; tx < MAP - 1; tx++) {
      const t = at(tx, tz);
      const d = districtAt(tx, tz);
      if (t === TILE_PARK && rng.chance(0.5)) {
        const c = tileCenter(tx, tz);
        trees.push({ x: c.x + rng.range(-3, 3), z: c.z + rng.range(-3, 3), s: rng.range(0.8, 1.4) });
      }
      if (t === TILE_ROAD) {
        if ((tx % 6 === 0 && tz % 3 === 0) || (tz % 6 === 0 && tx % 3 === 0)) {
          const c = tileCenter(tx, tz);
          lamps.push({ x: c.x + 4, z: c.z + 4 });
        }
        continue;
      }
      if (t !== TILE_BLOCK) continue;
      // Skip the volcano cone itself.
      const dx = tx - VOLCANO.tx;
      const dz = tz - VOLCANO.tz;
      if (dx * dx + dz * dz < (VOLCANO.r + 1) * (VOLCANO.r + 1)) continue;
      if (rng.chance(0.62)) {
        const c = tileCenter(tx, tz);
        let h = rng.range(6, 16);
        if (d === 1) h = rng.range(18, 46); // neon towers
        if (d === 0) h = rng.range(5, 12); // villas
        if (d === 2) h = rng.range(4, 9); // wharf shacks
        if (d === 3) h = rng.range(5, 14);
        buildings.push({
          x: c.x, z: c.z, w: TILE * rng.range(0.6, 0.9), d: TILE * rng.range(0.6, 0.9),
          h, district: d, rot: rng.chance(0.5) ? 0 : Math.PI / 2,
          hue: rng.range(0, 1),
        });
      } else if (rng.chance(0.25)) {
        const c = tileCenter(tx, tz);
        trees.push({ x: c.x, z: c.z, s: rng.range(0.8, 1.3) });
      }
    }
  }

  const T = (tx, tz) => tileCenter(tx, tz);
  const hideoutC = T(10, 44);
  const casinoC = T(58, 14);
  const observatoryC = T(36, 8);

  const world = {
    seed, tiles, buildings, trees, lamps,
    volcano: { x: (VOLCANO.tx + 0.5) * TILE, z: (VOLCANO.tz + 0.5) * TILE, r: VOLCANO.r * TILE },
    hideout: { x: hideoutC.x, z: hideoutC.z },
    casino: { x: casinoC.x, z: casinoC.z },
    observatory: { x: observatoryC.x, z: observatoryC.z },
    spawn: { x: T(36, 40).x, z: T(36, 40).z, angle: 0 },
    shops: [
      { x: T(30, 24).x, z: T(30, 24).z, name: "Ammo & Meds" },
      { x: T(54, 30).x, z: T(54, 30).z, name: "Harbor Supplies" },
      { x: T(18, 54).x, z: T(18, 54).z, name: "Lava Mart" },
    ],
    crewSpots: [
      { x: T(60, 20).x, z: T(60, 20).z, crew: 0 },
      { x: T(62, 44).x, z: T(62, 44).z, crew: 1 },
      { x: T(12, 36).x, z: T(12, 36).z, crew: 2 },
    ],
    crates: { x: T(62, 42).x, z: T(62, 42).z },
    cashDrops: [
      T(20, 63), T(32, 64), T(44, 63), T(52, 64), T(62, 62),
    ].map((p) => ({ x: p.x, z: p.z, taken: false })),
    vaultCar: { x: casinoC.x + 14, z: casinoC.z + 6 },
    raceRings: [T(54, 12), T(60, 30), T(48, 48), T(30, 54)].map((p) => ({ x: p.x, z: p.z })),
    isRoad(tx, tz) {
      if (tx < 0 || tx >= MAP || tz < 0 || tz >= MAP) return false;
      return tiles[tz * MAP + tx] === TILE_ROAD;
    },
    isWater(tx, tz) {
      if (tx < 0 || tx >= MAP || tz < 0 || tz >= MAP) return true;
      return tiles[tz * MAP + tx] === TILE_WATER;
    },
    tileAt(x, z) {
      const tx = Math.floor(x / TILE);
      const tz = Math.floor(z / TILE);
      if (tx < 0 || tx >= MAP || tz < 0 || tz >= MAP) return TILE_WATER;
      return tiles[tz * MAP + tx];
    },
    districtAtWorld(x, z) {
      const tx = Math.floor(x / TILE);
      const tz = Math.floor(z / TILE);
      return districtAt(Math.max(0, Math.min(MAP - 1, tx)), Math.max(0, Math.min(MAP - 1, tz)));
    },
    // Circle vs building AABB test for collisions.
    hitsBuilding(x, z, r) {
      for (const b of buildings) {
        const hw = b.w / 2 + r;
        const hd = b.d / 2 + r;
        if (Math.abs(x - b.x) < hw && Math.abs(z - b.z) < hd) return b;
      }
      return null;
    },
  };
  return world;
}

export { DISTRICTS };
