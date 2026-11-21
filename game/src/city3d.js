// Sunport City v2 (3D) — builds the low-poly three.js city from world data. Written fresh.
import * as THREE from './three.module.js';
import { CONFIG } from './config.js';

const T = CONFIG.tile;
const WORLD = CONFIG.worldTiles * T;

function windowTexture() {
  try {
    const c = document.createElement('canvas'); c.width = 64; c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = '#20242e'; g.fillRect(0, 0, 64, 128);
    for (let y = 8; y < 120; y += 16) for (let x = 8; x < 56; x += 14) {
      g.fillStyle = Math.random() < 0.5 ? '#ffd76a' : '#3a4a6a';
      g.fillRect(x, y, 9, 11);
    }
    const tex = new THREE.CanvasTexture(c);
    return tex;
  } catch { return null; }
}

export function buildCity(scene, world) {
  const tex = windowTexture();
  const lampLights = [];
  // Ground: grass base.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD, WORLD),
    new THREE.MeshLambertMaterial({ color: 0x7fae5a }),
  );
  ground.rotation.x = -Math.PI / 2; ground.position.set(WORLD / 2, 0, WORLD / 2);
  scene.add(ground);
  // Marina water (north-east) and beach sand (south).
  const water = new THREE.Mesh(new THREE.PlaneGeometry(12 * T, 12 * T), new THREE.MeshLambertMaterial({ color: 0x3d7fd1 }));
  water.rotation.x = -Math.PI / 2; water.position.set(66 * T, 0.2, 6 * T); scene.add(water);
  const sand = new THREE.Mesh(new THREE.PlaneGeometry(WORLD, 8 * T), new THREE.MeshLambertMaterial({ color: 0xe8d8a0 }));
  sand.rotation.x = -Math.PI / 2; sand.position.set(WORLD / 2, 0.2, 68 * T); scene.add(sand);
  // Roads: dark strips on the grid, with centre dashes.
  const roadMat = new THREE.MeshLambertMaterial({ color: 0x3a3f4a });
  const dashMat = new THREE.MeshLambertMaterial({ color: 0xe8d44d });
  for (let i = 0; i < world.size; i += CONFIG.roadEvery) {
    const v = new THREE.Mesh(new THREE.PlaneGeometry(T, WORLD), roadMat);
    v.rotation.x = -Math.PI / 2; v.position.set(i * T + T / 2, 0.3, WORLD / 2); scene.add(v);
    const h = new THREE.Mesh(new THREE.PlaneGeometry(WORLD, T), roadMat);
    h.rotation.x = -Math.PI / 2; h.position.set(WORLD / 2, 0.3, i * T + T / 2); scene.add(h);
    for (let d = 0; d < WORLD; d += 64) {
      const dash = new THREE.Mesh(new THREE.PlaneGeometry(2, 24), dashMat);
      dash.rotation.x = -Math.PI / 2; dash.position.set(i * T + T / 2, 0.4, d); scene.add(dash);
    }
  }
  // Parks: green discs + low-poly trees (cone on cylinder).
  const parkMat = new THREE.MeshLambertMaterial({ color: 0x5da85a });
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x6a4a2a });
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x2f7a3a });
  for (let y = 0; y < world.size; y++) for (let x = 0; x < world.size; x++) {
    if (world.tiles[y][x] !== 'park') continue;
    const px = x * T + T / 2, pz = y * T + T / 2;
    const disc = new THREE.Mesh(new THREE.CircleGeometry(T * 0.7, 12), parkMat);
    disc.rotation.x = -Math.PI / 2; disc.position.set(px, 0.35, pz); scene.add(disc);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(2, 3, 14, 6), trunkMat);
    trunk.position.set(px, 7, pz); scene.add(trunk);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(12, 26, 8), leafMat);
    cone.position.set(px, 26, pz); scene.add(cone);
  }
  // Buildings: boxes with lit-window texture on tall towers.
  for (const b of world.buildings) {
    const mat = new THREE.MeshLambertMaterial({ color: b.c, map: b.tall ? tex : null });
    const box = new THREE.Mesh(new THREE.BoxGeometry(b.w * T, b.height, b.h * T), mat);
    box.position.set(b.cx, b.height / 2, b.cz);
    scene.add(box);
    if (b.tall) {
      const roof = new THREE.Mesh(new THREE.BoxGeometry(b.w * T * 0.4, 6, b.h * T * 0.4), new THREE.MeshLambertMaterial({ color: 0x222633 }));
      roof.position.set(b.cx, b.height + 3, b.cz); scene.add(roof);
    }
  }
  // Street lights along roads (emissive bulbs glow at night).
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x333333 });
  const bulbMat = new THREE.MeshLambertMaterial({ color: 0xffe9a0, emissive: 0x554400 });
  for (let i = 0; i < world.size; i += CONFIG.roadEvery * 2) {
    for (let j = 0; j < world.size; j += CONFIG.roadEvery * 2) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(1, 1.5, 26, 6), poleMat);
      pole.position.set(i * T + T / 2 + 12, 13, j * T + T / 2 + 12); scene.add(pole);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(3, 8, 6), bulbMat.clone());
      bulb.position.set(i * T + T / 2 + 12, 27, j * T + T / 2 + 12); scene.add(bulb);
      lampLights.push(bulb);
    }
  }
  // Shops: teal boxes with a sign slab. Hideout: purple box.
  const shopMat = new THREE.MeshLambertMaterial({ color: 0x3dd0c0 });
  for (const s of world.shops) {
    const box = new THREE.Mesh(new THREE.BoxGeometry(28, 16, 20), shopMat);
    box.position.set(s.x, 8, s.z); scene.add(box);
  }
  const hide = new THREE.Mesh(new THREE.BoxGeometry(36, 20, 28), new THREE.MeshLambertMaterial({ color: 0x7a3aa0 }));
  hide.position.set(world.hideout.x, 10, world.hideout.z); scene.add(hide);
  // Race checkpoints: orange rings standing on the beach road.
  const ringMat = new THREE.MeshLambertMaterial({ color: 0xff8c1a, emissive: 0x662200 });
  const rings = [];
  for (const rc of world.raceChecks) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(22, 3, 8, 24), ringMat);
    ring.position.set(rc.x, 24, rc.z); scene.add(ring); rings.push(ring);
  }
  // Mission beacon: tall translucent gold cylinder at the target.
  const beacon = new THREE.Mesh(
    new THREE.CylinderGeometry(10, 10, 300, 12, 1, true),
    new THREE.MeshLambertMaterial({ color: 0xffcf3d, transparent: true, opacity: 0.35, side: THREE.DoubleSide }),
  );
  beacon.position.set(0, 150, 0); scene.add(beacon);
  return { lampLights, rings, beacon };
}

export function makeCar(color) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(52, 14, 26), new THREE.MeshLambertMaterial({ color }));
  body.position.y = 10; g.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(26, 12, 22), new THREE.MeshLambertMaterial({ color: 0xbfe0ff }));
  cabin.position.set(-4, 22, 0); g.add(cabin);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
  const wheelGeo = new THREE.CylinderGeometry(7, 7, 5, 10);
  for (const [wx, wz] of [[18, 13], [18, -13], [-18, 13], [-18, -13]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.x = Math.PI / 2; w.position.set(wx, 7, wz); g.add(w);
  }
  return g;
}

export function makePoliceCar() {
  const g = makeCar(0x2f6df6);
  const barR = new THREE.Mesh(new THREE.BoxGeometry(10, 4, 8), new THREE.MeshLambertMaterial({ color: 0xff2020, emissive: 0xff0000 }));
  barR.position.set(-4, 30, 6); g.add(barR);
  const barB = new THREE.Mesh(new THREE.BoxGeometry(10, 4, 8), new THREE.MeshLambertMaterial({ color: 0x2020ff, emissive: 0x0000ff }));
  barB.position.set(-4, 30, -6); g.add(barB);
  g.userData.barR = barR; g.userData.barB = barB;
  return g;
}

export function makePerson(color) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(7, 9, 26, 8), new THREE.MeshLambertMaterial({ color }));
  body.position.y = 16; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(7, 10, 8), new THREE.MeshLambertMaterial({ color: 0xf2c9a0 }));
  head.position.y = 36; g.add(head);
  return g;
}

export function makeCashDrop() {
  const g = new THREE.Group();
  const bag = new THREE.Mesh(new THREE.BoxGeometry(14, 10, 10), new THREE.MeshLambertMaterial({ color: 0x2f8a3a }));
  bag.position.y = 8; g.add(bag);
  const band = new THREE.Mesh(new THREE.BoxGeometry(15, 3, 11), new THREE.MeshLambertMaterial({ color: 0xffd700 }));
  band.position.y = 10; g.add(band);
  return g;
}
