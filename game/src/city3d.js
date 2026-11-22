// Cinderport city builder — turns the tile map into 3D meshes using the
// project's own WebGL engine. All geometry is generated here at runtime.
// Visual detail pass: detailed car models, varied buildings with rooftop
// furniture, neon signs, awnings, boats, umbrellas, sidewalks, crosswalks
// and traffic lights — all from code and canvas textures, no downloads.
import { TILE, MAP, WORLD, DISTRICTS, COLORS } from "./config.js";
import {
  Mesh, boxGeometry, cylinderGeometry, coneGeometry, sphereGeometry,
  planeGeometry, makeCanvasTexture, mergeGeometries, transformGeometry,
  matFromTRS, matTranslate, matMultiply, matRotateX, matRotateY,
} from "./engine3d.js";
import { TILE_ROAD, TILE_WATER, TILE_PARK, TILE_BEACH } from "./world.js";

function districtBaseColor(d) {
  const bases = [
    [0.62, 0.58, 0.50], // villas: warm stone
    [0.45, 0.42, 0.55], // neon towers: purple-grey
    [0.55, 0.48, 0.38], // wharf: timber brown
    [0.38, 0.34, 0.34], // lava row: dark basalt
    [0.30, 0.28, 0.27], // shore: dark sand huts
  ];
  return bases[d] || [0.5, 0.5, 0.5];
}

function shade(c, f) {
  return [c[0] * f, c[1] * f, c[2] * f];
}

// Rotation about Z (the engine only ships X/Y); column-major mat4.
function matRotateZ(a) {
  const c = Math.cos(a), s = Math.sin(a);
  return new Float32Array([c, s, 0, 0, -s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
}

// Baked-part helpers: local space is +x forward, +z to the car's left.
function partBox(list, w, h, d, color, x, y, z, rotX = 0, rotY = 0, rotZ = 0) {
  const g = boxGeometry(w, h, d, color);
  let m = matTranslate(x, y, z);
  if (rotX) m = matMultiply(m, matRotateX(rotX));
  if (rotY) m = matMultiply(m, matRotateY(rotY));
  if (rotZ) m = matMultiply(m, matRotateZ(rotZ));
  transformGeometry(g, m);
  list.push(g);
  return g;
}

function partCyl(list, rT, rB, h, seg, color, x, y, z, rotX = 0, rotZ = 0) {
  const g = cylinderGeometry(rT, rB, h, seg, color);
  let m = matTranslate(x, y, z);
  if (rotX) m = matMultiply(m, matRotateX(rotX));
  if (rotZ) m = matMultiply(m, matRotateZ(rotZ));
  transformGeometry(g, m);
  list.push(g);
  return g;
}

function windowTexture(gl, district) {
  // Per-district window palettes and lit ratios so every district reads
  // differently at a glance: warm villas, neon strip, cool wharf,
  // amber lava row, dim shore huts.
  const palettes = [
    { lit: ["#ffe9a8", "#ffd76a"], ratio: 0.5 },
    { lit: ["#ff2e88", "#22e6ff", "#ffe14d", "#7cff4d", "#ff9a3d"], ratio: 0.6 },
    { lit: ["#bfe3ff", "#9fd8ff"], ratio: 0.4 },
    { lit: ["#ffb347", "#ff7a2e"], ratio: 0.35 },
    { lit: ["#ffd9a0", "#ff9a5c"], ratio: 0.3 },
  ];
  const p = palettes[district] || palettes[0];
  return makeCanvasTexture(gl, 128, 128, (ctx, w, h) => {
    ctx.fillStyle = "#202024";
    ctx.fillRect(0, 0, w, h);
    const dark = "#2c3242";
    for (let y = 8; y < h - 8; y += 18) {
      for (let x = 8; x < w - 8; x += 16) {
        if (Math.random() < p.ratio) {
          ctx.fillStyle = p.lit[Math.floor(Math.random() * p.lit.length)];
        } else {
          ctx.fillStyle = dark;
        }
        ctx.fillRect(x, y, 9, 11);
      }
    }
  });
}

function neonTexture(gl) {
  return makeCanvasTexture(gl, 128, 128, (ctx, w, h) => {
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, "#241533");
    grad.addColorStop(1, "#120a1e");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    const cols = ["#ff2e88", "#22e6ff", "#ffe14d", "#7cff4d"];
    for (let y = 10; y < h - 10; y += 22) {
      for (let x = 8; x < w - 8; x += 18) {
        ctx.fillStyle = cols[Math.floor(Math.random() * cols.length)];
        ctx.fillRect(x, y, 10, 8);
      }
    }
  });
}

// Glowing text sign texture (canvas-drawn, no image files).
function signTexture(gl, text, fg, bg) {
  return makeCanvasTexture(gl, 256, 128, (ctx, w, h) => {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = fg;
    ctx.lineWidth = 4;
    ctx.strokeRect(6, 6, w - 12, h - 12);
    ctx.fillStyle = fg;
    ctx.font = "bold 44px Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = fg;
    ctx.shadowBlur = 18;
    ctx.fillText(text, w / 2, h / 2 + 2);
  });
}

function stripeTexture(gl, c1, c2) {
  return makeCanvasTexture(gl, 64, 64, (ctx, w, h) => {
    for (let x = 0; x < w; x += 16) {
      ctx.fillStyle = (x / 16) % 2 === 0 ? c1 : c2;
      ctx.fillRect(x, 0, 8, h);
    }
  });
}

function groundGeometry(world) {
  const g = { positions: [], normals: [], colors: [], uvs: [], indices: [] };
  const quadAt = (x0, z0, x1, z1, y, color) => {
    const base = g.positions.length / 3;
    g.positions.push(x0, y, z0, x1, y, z0, x1, y, z1, x0, y, z1);
    for (let i = 0; i < 4; i++) g.normals.push(0, 1, 0);
    for (let i = 0; i < 4; i++) g.colors.push(color[0], color[1], color[2]);
    g.uvs.push(0, 0, 1, 0, 1, 1, 0, 1);
    // Wound so the geometric normal points up (front-facing from above).
    g.indices.push(base, base + 2, base + 1, base, base + 3, base + 2);
  };
  const CROSS = [0.9, 0.9, 0.88];
  for (let tz = 0; tz < MAP; tz++) {
    for (let tx = 0; tx < MAP; tx++) {
      const t = world.tiles[tz * MAP + tx];
      if (t === TILE_WATER) continue;
      const x0 = tx * TILE, z0 = tz * TILE;
      const d = world.districtAtWorld(x0 + TILE / 2, z0 + TILE / 2);
      let color;
      if (t === TILE_ROAD) color = COLORS.road;
      else if (t === TILE_BEACH) color = COLORS.sand;
      else if (t === TILE_PARK) color = COLORS.park;
      else color = DISTRICTS[d].ground;
      quadAt(x0, z0, x0 + TILE, z0 + TILE, 0, color);
      if (t === TILE_ROAD) {
        // centre dashes along the road
        if (tx % 6 === 0 && tz % 2 === 0) {
          quadAt(x0 + TILE / 2 - 0.4, z0 + 2, x0 + TILE / 2 + 0.4, z0 + TILE - 2, 0.06, COLORS.roadLine);
        } else if (tz % 6 === 0 && tx % 2 === 0) {
          quadAt(x0 + 2, z0 + TILE / 2 - 0.4, x0 + TILE - 2, z0 + TILE / 2 + 0.4, 0.06, COLORS.roadLine);
        }
        // Raised sidewalks flanking the road (vertical roads first, so
        // intersection tiles never draw overlapping sidewalk quads).
        if (tx % 6 === 0) {
          quadAt(x0, z0, x0 + 1.3, z0 + TILE, 0.08, COLORS.sidewalk);
          quadAt(x0 + TILE - 1.3, z0, x0 + TILE, z0 + TILE, 0.08, COLORS.sidewalk);
        } else if (tz % 6 === 0) {
          quadAt(x0, z0, x0 + TILE, z0 + 1.3, 0.08, COLORS.sidewalk);
          quadAt(x0, z0 + TILE - 1.3, x0 + TILE, z0 + TILE, 0.08, COLORS.sidewalk);
        }
        // Crosswalk stripes at intersections.
        if (tx % 6 === 0 && tz % 6 === 0) {
          for (let i = 0; i < 5; i++) {
            quadAt(x0 + 1 + i * 1.8, z0 + 1, x0 + 1.9 + i * 1.8, z0 + TILE - 1, 0.1, CROSS);
            quadAt(x0 + 1, z0 + 1 + i * 1.8, x0 + TILE - 1, z0 + 1.9 + i * 1.8, 0.1, CROSS);
          }
        }
      }
      if (d === 3 && t !== TILE_ROAD && Math.random() < 0.12) {
        quadAt(x0 + 2, z0 + 2, x0 + TILE - 2, z0 + TILE - 2, 0.06, COLORS.lava);
      }
    }
  }
  return g;
}

export function buildCity(gl, world) {
  const meshes = [];
  const add = (m) => { meshes.push(m); return m; };

  // Ground + sea.
  add(new Mesh(gl, groundGeometry(world)));
  const sea = add(new Mesh(gl, planeGeometry(WORLD + 400, WORLD + 400, COLORS.water)));
  sea.set(WORLD / 2, -0.6, WORLD / 2);

  // Volcano: dark cone + glowing crater rim + orange core + smoke + lava.
  const v = world.volcano;
  const cone = add(new Mesh(gl, coneGeometry(v.r, 58, 12, [0.22, 0.20, 0.21])));
  cone.set(v.x, 29, v.z);
  const crater = add(new Mesh(gl, cylinderGeometry(v.r * 0.42, v.r * 0.55, 6, 12, COLORS.lava)));
  crater.set(v.x, 55, v.z);
  const lavaDisc = add(new Mesh(gl, cylinderGeometry(v.r * 0.38, v.r * 0.38, 1.2, 12, [1.0, 0.45, 0.05])));
  lavaDisc.set(v.x, 58.2, v.z);
  const rim = [];
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const g = boxGeometry(7, 2, 7, [1.0, 0.45, 0.08]);
    transformGeometry(g, matFromTRS(v.x + Math.cos(a) * v.r * 0.48, 57, v.z + Math.sin(a) * v.r * 0.48, 0));
    rim.push(g);
  }
  add(new Mesh(gl, mergeGeometries(rim)));
  // Lava streaks running down the cone on four sides.
  const streaks = [];
  partBox(streaks, 16, 0.6, 2.5, [1.0, 0.35, 0.05], v.x + 45, 42, v.z, 0, 0, -0.65);
  partBox(streaks, 16, 0.6, 2.5, [1.0, 0.35, 0.05], v.x - 45, 42, v.z, 0, 0, 0.65);
  partBox(streaks, 2.5, 0.6, 16, [1.0, 0.35, 0.05], v.x, 42, v.z + 45, 0.65);
  partBox(streaks, 2.5, 0.6, 16, [1.0, 0.35, 0.05], v.x, 42, v.z - 45, -0.65);
  add(new Mesh(gl, mergeGeometries(streaks)));
  // Smoke: stacked grey spheres drifting up from the crater.
  const smoke = [];
  for (let i = 0; i < 4; i++) {
    const sg = sphereGeometry(7 + i * 1.5, 5, 6, [0.32, 0.31, 0.32]);
    transformGeometry(sg, matFromTRS(v.x + i * 4 - 4, 66 + i * 9, v.z + (i % 2) * 5 - 2, 0));
    smoke.push(sg);
  }
  add(new Mesh(gl, mergeGeometries(smoke)));

  // Buildings, merged per district (one draw call each). Tall towers get
  // stepped setbacks so the skyline varies in height and footprint.
  const texByDistrict = [
    windowTexture(gl, 0), neonTexture(gl), windowTexture(gl, 2),
    windowTexture(gl, 3), windowTexture(gl, 4),
  ];
  const perDistrict = [[], [], [], [], []];
  const rooftops = [];
  const balconies = [];
  for (const b of world.buildings) {
    const base = districtBaseColor(b.district);
    const sh = 0.85 + b.hue * 0.3;
    const col = [base[0] * sh, base[1] * sh, base[2] * sh];
    const g = boxGeometry(b.w, b.h, b.d, col);
    transformGeometry(g, matFromTRS(b.x, b.h / 2, b.z, b.rot));
    perDistrict[b.district].push(g);
    if (b.h >= 24) {
      const up = boxGeometry(b.w * 0.62, b.h * 0.32, b.d * 0.62, shade(col, 0.9));
      transformGeometry(up, matFromTRS(b.x, b.h + (b.h * 0.32) / 2, b.z, b.rot));
      perDistrict[b.district].push(up);
      if (b.h >= 40) {
        const up2 = boxGeometry(b.w * 0.4, b.h * 0.25, b.d * 0.4, shade(col, 0.8));
        transformGeometry(up2, matFromTRS(b.x, b.h * 1.32 + (b.h * 0.25) / 2, b.z, b.rot));
        perDistrict[b.district].push(up2);
      }
    }
    // Rooftop furniture, placed in the building's local frame so it
    // follows the building's rotation. Deterministic from b.hue.
    if (b.hue < 0.45) {
      const ac = boxGeometry(2.2, 1, 2.2, [0.55, 0.56, 0.58]);
      transformGeometry(ac, matFromTRS(b.x, b.h + 0.5, b.z, b.rot));
      rooftops.push(ac);
    } else if (b.hue < 0.6 && b.h >= 16) {
      const ant = boxGeometry(0.3, 6, 0.3, [0.7, 0.7, 0.72]);
      transformGeometry(ant, matFromTRS(b.x - b.w * 0.25, b.h + 3, b.z - b.d * 0.2, b.rot));
      rooftops.push(ant);
      const tip = boxGeometry(0.7, 0.4, 0.7, [1.0, 0.2, 0.2]);
      transformGeometry(tip, matFromTRS(b.x - b.w * 0.25, b.h + 6.1, b.z - b.d * 0.2, b.rot));
      rooftops.push(tip);
    } else if (b.hue >= 0.88 && (b.district === 0 || b.district === 2) && b.h <= 12) {
      const tank = cylinderGeometry(1.6, 1.6, 2.6, 8, [0.5, 0.38, 0.28]);
      transformGeometry(tank, matFromTRS(b.x, b.h + 3.2, b.z, b.rot));
      rooftops.push(tank);
      const tcone = coneGeometry(1.9, 1.4, 8, [0.35, 0.25, 0.18]);
      transformGeometry(tcone, matFromTRS(b.x, b.h + 5.2, b.z, b.rot));
      rooftops.push(tcone);
      const tbase = boxGeometry(3, 0.8, 3, [0.4, 0.36, 0.32]);
      transformGeometry(tbase, matFromTRS(b.x, b.h + 0.4, b.z, b.rot));
      rooftops.push(tbase);
    }
    // Balconies on low villas and wharf shacks (half of them, to keep the
    // merged mesh comfortably under the index limit).
    if ((b.district === 0 || b.district === 2) && b.h >= 7 && b.h <= 12 && b.hue < 0.5) {
      for (const fy of [3.2, 6.0]) {
        if (fy + 0.5 > b.h) continue;
        for (const fx of [-0.2, 0.2]) {
          const bal = boxGeometry(3.0, 0.28, 1.3, [0.55, 0.5, 0.42]);
          // local +z is the building front; rotate with the building.
          const m = matFromTRS(b.x, fy, b.z, b.rot);
          const gx = fx * b.w, gz = b.d / 2 + 0.55;
          // bake the local offset into the geometry, then the building frame
          transformGeometry(bal, matTranslate(gx, 0, gz));
          transformGeometry(bal, m);
          balconies.push(bal);
        }
      }
    }
  }
  for (let d = 0; d < 5; d++) {
    if (perDistrict[d].length === 0) continue;
    add(new Mesh(gl, mergeGeometries(perDistrict[d]), { texture: texByDistrict[d] }));
  }
  if (rooftops.length) add(new Mesh(gl, mergeGeometries(rooftops)));
  if (balconies.length) add(new Mesh(gl, mergeGeometries(balconies)));

  // Trees: merged trunks + fuller two-tier canopies (sphere + cone).
  const trunks = [];
  const crowns = [];
  for (const t of world.trees) {
    const tg = cylinderGeometry(0.35 * t.s, 0.5 * t.s, 3.4 * t.s, 6, [0.35, 0.24, 0.15]);
    transformGeometry(tg, matFromTRS(t.x, 1.7 * t.s, t.z, 0));
    trunks.push(tg);
    const sg = sphereGeometry(2.5 * t.s, 4, 5, [0.16, 0.45, 0.20]);
    transformGeometry(sg, matFromTRS(t.x, 6.0 * t.s, t.z, 0));
    crowns.push(sg);
    const cg = coneGeometry(1.7 * t.s, 3.5 * t.s, 6, [0.2, 0.55, 0.24]);
    transformGeometry(cg, matFromTRS(t.x, 8.6 * t.s, t.z, 0));
    crowns.push(cg);
  }
  if (trunks.length) add(new Mesh(gl, mergeGeometries(trunks)));
  if (crowns.length) add(new Mesh(gl, mergeGeometries(crowns)));

  // Street lamps: merged poles + arms + glowing heads.
  const poles = [];
  const heads = [];
  for (const l of world.lamps) {
    const pg = cylinderGeometry(0.18, 0.22, 6, 6, [0.25, 0.25, 0.27]);
    transformGeometry(pg, matFromTRS(l.x, 3, l.z, 0));
    poles.push(pg);
    const arm = boxGeometry(2.2, 0.22, 0.22, [0.25, 0.25, 0.27]);
    transformGeometry(arm, matFromTRS(l.x, 5.9, l.z, 0));
    poles.push(arm);
    const hg = boxGeometry(1.4, 0.5, 0.7, [1.0, 0.9, 0.55]);
    transformGeometry(hg, matFromTRS(l.x, 6.2, l.z, 0));
    heads.push(hg);
  }
  if (poles.length) add(new Mesh(gl, mergeGeometries(poles)));
  if (heads.length) add(new Mesh(gl, mergeGeometries(heads)));

  // Traffic lights at big intersections (every 12 tiles where roads cross).
  const lights = [];
  for (let tz = 0; tz < MAP; tz += 12) {
    for (let tx = 0; tx < MAP; tx += 12) {
      if (!world.isRoad(tx, tz)) continue;
      const cx = (tx + 0.5) * TILE + 4.2;
      const cz = (tz + 0.5) * TILE + 4.2;
      const pole = cylinderGeometry(0.16, 0.2, 5, 6, [0.15, 0.15, 0.16]);
      transformGeometry(pole, matFromTRS(cx, 2.5, cz, 0));
      lights.push(pole);
      const head = boxGeometry(0.8, 2.0, 0.6, [0.1, 0.1, 0.11]);
      transformGeometry(head, matFromTRS(cx - 1.2, 5.2, cz, 0));
      lights.push(head);
      const lampCols = [[1, 0.1, 0.1], [1, 0.85, 0.1], [0.1, 0.9, 0.2]];
      for (let i = 0; i < 3; i++) {
        for (const side of [-0.36, 0.36]) {
          const lamp = boxGeometry(0.5, 0.45, 0.14, lampCols[i]);
          transformGeometry(lamp, matFromTRS(cx - 1.2, 5.85 - i * 0.62, cz + side, 0));
          lights.push(lamp);
        }
      }
    }
  }
  if (lights.length) add(new Mesh(gl, mergeGeometries(lights)));

  // Hideout (purple), shops (teal), casino (bright gold-trimmed tower).
  const hideout = add(new Mesh(gl, boxGeometry(14, 9, 12, [0.45, 0.2, 0.65])));
  hideout.set(world.hideout.x, 4.5, world.hideout.z);
  const stripeTex = stripeTexture(gl, "#0e8a8a", "#e8f4f4");
  for (const s of world.shops) {
    const shop = add(new Mesh(gl, boxGeometry(10, 6, 9, [0.1, 0.55, 0.55])));
    shop.set(s.x, 3, s.z);
    // Striped awning over the shop front, sloping down toward the street.
    const awn = [];
    partBox(awn, 9.5, 0.3, 4, [1, 1, 1], s.x, 3.6, s.z + 5.6, 0.4);
    add(new Mesh(gl, mergeGeometries(awn), { texture: stripeTex }));
    // Shop name board above the awning.
    const shortName = s.name === "Ammo & Meds" ? "AMMO" : s.name === "Harbor Supplies" ? "SUPPLIES" : "MART";
    const board = add(new Mesh(gl, boxGeometry(6.5, 2.2, 0.4, [1, 1, 1]), { texture: signTexture(gl, shortName, "#7dffd4", "#062a26") }));
    board.set(s.x, 7.4, s.z + 4.8);
  }
  const casino = add(new Mesh(gl, boxGeometry(24, 30, 20, [0.75, 0.6, 0.2]), { texture: neonTexture(gl) }));
  casino.set(world.casino.x, 15, world.casino.z);
  // Golden roof slab so the casino reads as a landmark from the air.
  const casinoRoof = add(new Mesh(gl, boxGeometry(26, 2, 22, [1.0, 0.8, 0.25])));
  casinoRoof.set(world.casino.x, 31, world.casino.z);
  // Big CASINO sign on the casino's flank.
  const casinoSign = add(new Mesh(gl, boxGeometry(0.5, 8, 9, [1, 1, 1]), { texture: signTexture(gl, "CASINO", "#ffd76a", "#1c0b2e") }));
  casinoSign.set(world.casino.x + 12.6, 18, world.casino.z);
  // Neon signs on the tallest Neon Strip towers.
  const tallNeon = world.buildings
    .filter((b) => b.district === 1 && b.h >= 30)
    .sort((a, b) => b.h - a.h)
    .slice(0, 3);
  const signDefs = [
    { text: "HOTEL", fg: "#22e6ff", bg: "#0a1a2e" },
    { text: "NEON BAR", fg: "#ff2e88", bg: "#220a1c" },
    { text: "CLUB LAVA", fg: "#ff9a3d", bg: "#1e0f08" },
  ];
  tallNeon.forEach((b, i) => {
    const def = signDefs[i % signDefs.length];
    const half = Math.max(b.w, b.d) / 2 + 0.4;
    const sign = add(new Mesh(gl, boxGeometry(0.5, 9, 4.6, [1, 1, 1]), { texture: signTexture(gl, def.text, def.fg, def.bg) }));
    // Ride high on the tower so the sign clears its shorter neighbours.
    sign.set(b.x + half, b.h * 0.62, b.z);
  });
  // Observatory: white tower + dome.
  const tower = add(new Mesh(gl, cylinderGeometry(5, 6, 18, 10, [0.85, 0.85, 0.82])));
  tower.set(world.observatory.x, 9, world.observatory.z);
  const dome = add(new Mesh(gl, sphereGeometry(6, 6, 10, [0.9, 0.92, 0.95])));
  dome.set(world.observatory.x, 18.5, world.observatory.z);

  // Harbor: boats in the inlet, crates stacked on the wharf.
  const boats = [];
  const boatDefs = [
    { tx: 69, tz: 40, rot: 0.3 },
    { tx: 70, tz: 46, rot: -0.4 },
    { tx: 68, tz: 49, rot: 0.9 },
  ];
  for (const bd of boatDefs) {
    const bx = (bd.tx + 0.5) * TILE;
    const bz = (bd.tz + 0.5) * TILE;
    const hull = boxGeometry(9, 1.4, 3.2, [0.28, 0.2, 0.16]);
    transformGeometry(hull, matFromTRS(bx, 0.5, bz, bd.rot));
    boats.push(hull);
    const cabin = boxGeometry(3, 1.6, 2.2, [0.85, 0.85, 0.8]);
    transformGeometry(cabin, matFromTRS(bx, 1.9, bz, bd.rot));
    boats.push(cabin);
    const mast = cylinderGeometry(0.12, 0.12, 7, 6, [0.5, 0.42, 0.3]);
    transformGeometry(mast, matFromTRS(bx, 4.2, bz, bd.rot));
    boats.push(mast);
  }
  if (boats.length) add(new Mesh(gl, mergeGeometries(boats)));
  const crates = [];
  const crateDefs = [
    [646, 1, 406, 2.4], [649, 1, 406, 2.0], [647.5, 3.1, 406, 1.8],
    [640, 1, 412, 2.2], [643, 1, 412, 2.4], [641.5, 3, 412, 1.6],
  ];
  for (const [cx, cy, cz, s] of crateDefs) {
    const cg = boxGeometry(s, s, s, [0.55, 0.42, 0.25]);
    transformGeometry(cg, matFromTRS(cx, cy, cz, 0));
    crates.push(cg);
  }
  if (crates.length) add(new Mesh(gl, mergeGeometries(crates)));

  // Beach umbrellas on the black sand.
  const umbrellas = [];
  const umbCols = [[1, 0.3, 0.3], [1, 0.85, 0.2], [0.2, 0.7, 1], [0.9, 0.4, 0.8]];
  for (let i = 0; i < 8; i++) {
    const ux = (16 + i * 6 + 0.5) * TILE;
    const uz = 63.5 * TILE;
    const pole = cylinderGeometry(0.12, 0.12, 2.6, 6, [0.9, 0.9, 0.85]);
    transformGeometry(pole, matFromTRS(ux, 1.3, uz, 0));
    umbrellas.push(pole);
    const canopy = coneGeometry(2.4, 1.3, 8, umbCols[i % umbCols.length]);
    transformGeometry(canopy, matFromTRS(ux, 3.1, uz, 0));
    umbrellas.push(canopy);
  }
  if (umbrellas.length) add(new Mesh(gl, mergeGeometries(umbrellas)));

  // Mission beacon: tall glowing pillar, repositioned per mission.
  const beacon = add(new Mesh(gl, cylinderGeometry(0.9, 0.9, 70, 8, [1.0, 0.85, 0.15])));
  beacon.set(world.crates.x, 35, world.crates.z);

  // Race rings: orange boxes arranged in a circle, one mesh per ring.
  const rings = world.raceRings.map((r) => {
    const parts = [];
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const g = boxGeometry(1.6, 1.6, 1.6, [1.0, 0.55, 0.05]);
      transformGeometry(g, matFromTRS(r.x + Math.cos(a) * 7, 4, r.z + Math.sin(a) * 7, 0));
      parts.push(g);
    }
    const m = add(new Mesh(gl, mergeGeometries(parts)));
    m.visible = false;
    return m;
  });

  // Cash drops: green bags with gold tops.
  const cashMeshes = world.cashDrops.map((c) => {
    const m = add(new Mesh(gl, boxGeometry(1.6, 1.1, 1.6, [0.15, 0.7, 0.25])));
    m.set(c.x, 0.8, c.z);
    return m;
  });

  return { meshes, beacon, rings, cashMeshes };
}

// ---- cars: one merged mesh per car, built from detailed parts ----
// Local space: +x is the front, +z is the car's left, y is up.
const GLASS = [0.07, 0.11, 0.17];
const GLASS_LIGHT = [0.38, 0.52, 0.66];
const TIRE = [0.07, 0.07, 0.08];
const HUB = [0.75, 0.75, 0.78];
const DARK = [0.08, 0.08, 0.09];

function addWheel(list, x, z, r) {
  partCyl(list, r, r, 0.38, 10, TIRE, x, r, z, Math.PI / 2);
  partCyl(list, r * 0.55, r * 0.55, 0.42, 8, HUB, x, r, z, Math.PI / 2);
}

function addLights(list, frontX, rearX, y = 0.95) {
  partBox(list, 0.12, 0.26, 0.5, [1.0, 0.95, 0.6], frontX, y, -0.78);
  partBox(list, 0.12, 0.26, 0.5, [1.0, 0.95, 0.6], frontX, y, 0.78);
  partBox(list, 0.12, 0.26, 0.45, [0.9, 0.08, 0.08], rearX, y, -0.78);
  partBox(list, 0.12, 0.26, 0.45, [0.9, 0.08, 0.08], rearX, y, 0.78);
  partBox(list, 0.12, 0.35, 1.3, [0.08, 0.08, 0.1], frontX + 0.02, 0.9, 0);
}

function addMirrors(list, x, y, halfW) {
  partBox(list, 0.28, 0.16, 0.35, DARK, x, y, -halfW - 0.08);
  partBox(list, 0.28, 0.16, 0.35, DARK, x, y, halfW + 0.08);
}

function buildSedan(list, color, stripe) {
  partBox(list, 4.6, 1.0, 2.2, color, 0, 0.85, 0);
  partBox(list, 1.1, 0.12, 1.9, shade(color, 0.82), 1.65, 1.38, 0);
  partBox(list, 0.45, 0.5, 2.05, [0.12, 0.12, 0.13], 2.32, 0.55, 0);
  partBox(list, 0.45, 0.5, 2.05, [0.12, 0.12, 0.13], -2.32, 0.55, 0);
  addLights(list, 2.5, -2.5);
  // Tinted glass cabin with a painted roof panel and sloped glass.
  partBox(list, 2.4, 0.8, 1.85, GLASS, -0.25, 1.75, 0);
  partBox(list, 2.0, 0.16, 1.7, color, -0.25, 2.22, 0);
  partBox(list, 0.07, 1.0, 1.7, GLASS_LIGHT, 1.02, 1.72, 0, 0, 0, 0.45);
  partBox(list, 0.07, 0.95, 1.7, GLASS_LIGHT, -1.5, 1.72, 0, 0, 0, -0.45);
  addMirrors(list, 0.8, 1.5, 1.02);
  if (stripe) partBox(list, 4.0, 0.07, 0.55, stripe, 0, 1.39, 0);
  for (const [wx, wz] of [[-1.5, -1.05], [1.5, -1.05], [-1.5, 1.05], [1.5, 1.05]]) {
    addWheel(list, wx, wz, 0.48);
  }
}

function buildSport(list, color, stripe) {
  partBox(list, 5.0, 0.8, 2.1, color, 0, 0.72, 0);
  partBox(list, 1.2, 0.1, 1.85, shade(color, 0.82), 1.8, 1.15, 0);
  partBox(list, 0.4, 0.42, 1.95, [0.12, 0.12, 0.13], 2.55, 0.48, 0);
  partBox(list, 0.4, 0.42, 1.95, [0.12, 0.12, 0.13], -2.55, 0.48, 0);
  addLights(list, 2.72, -2.72, 0.82);
  partBox(list, 2.1, 0.65, 1.75, GLASS, -0.35, 1.42, 0);
  partBox(list, 1.8, 0.14, 1.6, color, -0.35, 1.82, 0);
  partBox(list, 0.07, 0.9, 1.6, GLASS_LIGHT, 0.78, 1.4, 0, 0, 0, 0.5);
  partBox(list, 0.07, 0.85, 1.6, GLASS_LIGHT, -1.45, 1.4, 0, 0, 0, -0.5);
  addMirrors(list, 0.6, 1.25, 0.98);
  // Rear spoiler on two struts.
  partBox(list, 0.16, 0.45, 0.16, DARK, -2.45, 1.35, -0.65);
  partBox(list, 0.16, 0.45, 0.16, DARK, -2.45, 1.35, 0.65);
  partBox(list, 0.7, 0.1, 1.9, DARK, -2.45, 1.62, 0);
  if (stripe) partBox(list, 4.4, 0.07, 0.5, stripe, 0, 1.16, 0);
  for (const [wx, wz] of [[-1.6, -1.0], [1.6, -1.0], [-1.6, 1.0], [1.6, 1.0]]) {
    addWheel(list, wx, wz, 0.55);
  }
}

function buildTaxi(list, color) {
  buildSedan(list, color, null);
  // Roof sign + door bands.
  partBox(list, 1.1, 0.1, 0.6, DARK, -0.2, 2.32, 0);
  partBox(list, 1.0, 0.32, 0.5, [1.0, 0.85, 0.15], -0.2, 2.52, 0);
  partBox(list, 2.6, 0.28, 0.06, DARK, -0.2, 0.9, -1.11);
  partBox(list, 2.6, 0.28, 0.06, DARK, -0.2, 0.9, 1.11);
}

function buildTruck(list, color) {
  // Cab up front, tall cargo box behind, six wheels.
  partBox(list, 1.7, 1.7, 2.25, color, 1.45, 1.2, 0);
  partBox(list, 0.5, 0.75, 1.95, GLASS, 2.2, 1.55, 0);
  partBox(list, 1.5, 0.14, 2.1, shade(color, 0.9), 1.45, 2.1, 0);
  partBox(list, 2.9, 2.1, 2.35, [0.78, 0.75, 0.7], -1.05, 1.4, 0);
  for (const rx of [-0.4, -1.7]) {
    partBox(list, 0.08, 1.9, 0.1, [0.6, 0.58, 0.55], rx, 1.4, -1.2);
    partBox(list, 0.08, 1.9, 0.1, [0.6, 0.58, 0.55], rx, 1.4, 1.2);
  }
  partBox(list, 0.4, 0.5, 2.0, [0.12, 0.12, 0.13], 2.35, 0.55, 0);
  partBox(list, 0.4, 0.5, 2.0, [0.12, 0.12, 0.13], -2.55, 0.55, 0);
  addLights(list, 2.52, -2.72, 0.95);
  addMirrors(list, 2.1, 1.6, 1.12);
  for (const [wx, wz] of [[1.6, -1.08], [1.6, 1.08], [-0.5, -1.08], [-0.5, 1.08], [-1.9, -1.08], [-1.9, 1.08]]) {
    addWheel(list, wx, wz, 0.5);
  }
}

function buildPolice(list, model = "sedan") {
  // Interceptor body (sport) or standard sedan, then police livery on top.
  const sport = model === "sport";
  if (sport) buildSport(list, [0.92, 0.92, 0.92], null);
  else buildSedan(list, [0.92, 0.92, 0.92], null);
  const topY = sport ? 1.15 : 1.38; // body-top height of the base model
  const bandY = sport ? 0.75 : 0.9;
  const bandZ = sport ? 1.06 : 1.11;
  const barY = sport ? 1.98 : 2.38; // light-bar base height (roof + a little)
  const noseX = sport ? 2.6 : 2.45;
  // Black hood + trunk panels and door bands over the white body.
  partBox(list, 1.15, 0.07, 2.0, [0.05, 0.05, 0.06], 1.65, topY, 0);
  partBox(list, 1.15, 0.07, 2.0, [0.05, 0.05, 0.06], -1.65, topY, 0);
  partBox(list, 2.3, 0.55, 0.06, [0.05, 0.05, 0.06], -0.2, bandY, -bandZ);
  partBox(list, 2.3, 0.55, 0.06, [0.05, 0.05, 0.06], -0.2, bandY, bandZ);
  // Push bumper + detailed red/blue light bar.
  partBox(list, 0.3, 0.55, 1.9, [0.14, 0.14, 0.15], noseX, 0.65, 0);
  partBox(list, 1.0, 0.16, 1.5, [0.12, 0.12, 0.14], -0.2, barY, 0);
  partBox(list, 0.42, 0.3, 0.62, [1.0, 0.05, 0.05], -0.2, barY + 0.14, -0.4);
  partBox(list, 0.42, 0.3, 0.62, [0.1, 0.3, 1.0], -0.2, barY + 0.14, 0.4);
  partBox(list, 0.3, 0.28, 0.3, [0.95, 0.95, 0.9], -0.2, barY + 0.12, 0);
}

// A car is a single merged mesh that moves as one group.
export function makeCar(gl, color, isPolice = false, model = "sedan", opts = {}) {
  const parts = [];
  if (isPolice) {
    buildPolice(parts, model);
  } else if (model === "sport") {
    buildSport(parts, color, opts.stripe || null);
  } else if (model === "taxi") {
    buildTaxi(parts, color);
  } else if (model === "truck") {
    buildTruck(parts, color);
  } else {
    buildSedan(parts, color, opts.stripe || null);
  }
  const mesh = new Mesh(gl, mergeGeometries(parts));
  return {
    meshes: [mesh],
    setPose(x, z, angle) {
      // Local +x is the car's front; world forward is (sin angle, cos angle).
      // Mesh rotY = angle - PI/2 maps local +x onto that forward vector.
      mesh.set(x, 0, z, angle - Math.PI / 2);
    },
  };
}

export function makePerson(gl, shirtColor) {
  const parts = [];
  const addPart = (geo, dx, dy, dz) => {
    const m = new Mesh(gl, geo);
    parts.push({ mesh: m, dx, dy, dz });
    return m;
  };
  addPart(cylinderGeometry(0.42, 0.5, 1.1, 8, shirtColor), 0, 0.95, 0);
  addPart(sphereGeometry(0.34, 6, 8, [0.85, 0.65, 0.5]), 0, 1.85, 0);
  return {
    meshes: parts.map((p) => p.mesh),
    setPose(x, z, angle) {
      // Same heading convention as cars: local +x faces (sin angle, cos angle).
      const c = Math.sin(angle), s = Math.cos(angle);
      for (const p of parts) {
        const wx = x + p.dx * c - p.dz * s;
        const wz = z + p.dx * s + p.dz * c;
        p.mesh.set(wx, p.dy, wz, angle - Math.PI / 2);
      }
    },
  };
}
