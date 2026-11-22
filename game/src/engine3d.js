// Cinderport 3D engine — a minimal WebGL renderer written from scratch.
// No external libraries: matrices, shaders, mesh builders and canvas textures
// are all implemented here. Column-major mat4, Y-up, right-handed view space.
export function matIdentity() {
  return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
}

export function matMultiply(a, b) {
  const o = new Float32Array(16);
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      let s = 0;
      for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
      o[c * 4 + r] = s;
    }
  }
  return o;
}

export function matPerspective(fovY, aspect, near, far) {
  const f = 1 / Math.tan(fovY / 2);
  const o = new Float32Array(16);
  o[0] = f / aspect;
  o[5] = f;
  o[10] = (far + near) / (near - far);
  o[11] = -1;
  o[14] = (2 * far * near) / (near - far);
  return o;
}

export function matLookAt(eye, target, up) {
  const zx = eye[0] - target[0];
  const zy = eye[1] - target[1];
  const zz = eye[2] - target[2];
  let zl = Math.hypot(zx, zy, zz) || 1;
  const z = [zx / zl, zy / zl, zz / zl];
  // x = up x z
  let xx = up[1] * z[2] - up[2] * z[1];
  let xy = up[2] * z[0] - up[0] * z[2];
  let xz = up[0] * z[1] - up[1] * z[0];
  const xl = Math.hypot(xx, xy, xz) || 1;
  xx /= xl; xy /= xl; xz /= xl;
  // y = z x x (note: each term uses the matching component)
  const yx = z[1] * xz - z[2] * xy;
  const yy = z[2] * xx - z[0] * xz;
  const yz = z[0] * xy - z[1] * xx;
  const o = matIdentity();
  // Rotation part is R^T: the ROWS are the camera axes.
  o[0] = xx; o[4] = xy; o[8] = xz;
  o[1] = yx; o[5] = yy; o[9] = yz;
  o[2] = z[0]; o[6] = z[1]; o[10] = z[2];
  o[12] = -(xx * eye[0] + xy * eye[1] + xz * eye[2]);
  o[13] = -(yx * eye[0] + yy * eye[1] + yz * eye[2]);
  o[14] = -(z[0] * eye[0] + z[1] * eye[1] + z[2] * eye[2]);
  return o;
}

export function matTranslate(x, y, z) {
  const o = matIdentity();
  o[12] = x; o[13] = y; o[14] = z;
  return o;
}

export function matRotateY(a) {
  const c = Math.cos(a);
  const s = Math.sin(a);
  const o = matIdentity();
  o[0] = c; o[2] = -s;
  o[8] = s; o[10] = c;
  return o;
}

export function matRotateX(a) {
  const c = Math.cos(a);
  const s = Math.sin(a);
  const o = matIdentity();
  o[5] = c; o[6] = s;
  o[9] = -s; o[10] = c;
  return o;
}

export function matScale(x, y, z) {
  const o = matIdentity();
  o[0] = x; o[5] = y; o[10] = z;
  return o;
}

export function matFromTRS(x, y, z, rotY, sx = 1, sy = 1, sz = 1) {
  return matMultiply(matTranslate(x, y, z), matMultiply(matRotateY(rotY), matScale(sx, sy, sz)));
}

// Apply a mat4 to a geometry in place (positions with full matrix, normals
// with its upper 3x3 — our uses are rotations and translations only).
export function transformGeometry(geo, m) {
  for (let i = 0; i < geo.positions.length; i += 3) {
    const x = geo.positions[i], y = geo.positions[i + 1], z = geo.positions[i + 2];
    geo.positions[i] = m[0] * x + m[4] * y + m[8] * z + m[12];
    geo.positions[i + 1] = m[1] * x + m[5] * y + m[9] * z + m[13];
    geo.positions[i + 2] = m[2] * x + m[6] * y + m[10] * z + m[14];
  }
  for (let i = 0; i < geo.normals.length; i += 3) {
    const x = geo.normals[i], y = geo.normals[i + 1], z = geo.normals[i + 2];
    geo.normals[i] = m[0] * x + m[4] * y + m[8] * z;
    geo.normals[i + 1] = m[1] * x + m[5] * y + m[9] * z;
    geo.normals[i + 2] = m[2] * x + m[6] * y + m[10] * z;
  }
  return geo;
}

// Concatenate several geometries into one draw call (indices re-based).
export function mergeGeometries(list) {
  const out = { positions: [], normals: [], colors: [], uvs: [], indices: [] };
  let base = 0;
  for (const g of list) {
    out.positions.push(...g.positions);
    out.normals.push(...g.normals);
    out.colors.push(...g.colors);
    out.uvs.push(...g.uvs);
    for (const idx of g.indices) out.indices.push(idx + base);
    base += g.positions.length / 3;
  }
  return out;
}

// ---- geometry builders: { positions, normals, colors, uvs, indices } ----
function newGeo() {
  return { positions: [], normals: [], colors: [], uvs: [], indices: [] };
}

function pushVert(g, p, n, c, uv) {
  g.positions.push(p[0], p[1], p[2]);
  g.normals.push(n[0], n[1], n[2]);
  g.colors.push(c[0], c[1], c[2]);
  g.uvs.push(uv[0], uv[1]);
  return g.positions.length / 3 - 1;
}

function quad(g, a, b, c, d, n, color, shade = 1) {
  const col = [color[0] * shade, color[1] * shade, color[2] * shade];
  const i0 = pushVert(g, a, n, col, [0, 0]);
  const i1 = pushVert(g, b, n, col, [1, 0]);
  const i2 = pushVert(g, c, n, col, [1, 1]);
  const i3 = pushVert(g, d, n, col, [0, 1]);
  g.indices.push(i0, i1, i2, i0, i2, i3);
}

export function boxGeometry(w, h, d, color) {
  const g = newGeo();
  const x = w / 2, y = h / 2, z = d / 2;
  quad(g, [-x, -y, z], [x, -y, z], [x, y, z], [-x, y, z], [0, 0, 1], color, 0.85);
  quad(g, [x, -y, -z], [-x, -y, -z], [-x, y, -z], [x, y, -z], [0, 0, -1], color, 0.7);
  quad(g, [-x, y, -z], [-x, y, z], [x, y, z], [x, y, -z], [0, 1, 0], color, 1.0);
  quad(g, [-x, -y, -z], [x, -y, -z], [x, -y, z], [-x, -y, z], [0, -1, 0], color, 0.5);
  quad(g, [x, -y, z], [x, -y, -z], [x, y, -z], [x, y, z], [1, 0, 0], color, 0.8);
  quad(g, [-x, -y, -z], [-x, -y, z], [-x, y, z], [-x, y, -z], [-1, 0, 0], color, 0.75);
  return g;
}

export function planeGeometry(w, d, color) {
  const g = newGeo();
  const x = w / 2, z = d / 2;
  // Vertex order gives an upward geometric normal so the plane is
  // front-facing seen from above (backface culling is on).
  quad(g, [-x, 0, z], [x, 0, z], [x, 0, -z], [-x, 0, -z], [0, 1, 0], color, 1.0);
  return g;
}

export function cylinderGeometry(rTop, rBottom, h, seg, color) {
  const g = newGeo();
  const y0 = -h / 2, y1 = h / 2;
  for (let i = 0; i < seg; i++) {
    const a0 = (i / seg) * Math.PI * 2;
    const a1 = ((i + 1) / seg) * Math.PI * 2;
    const n0 = [Math.cos(a0), 0, Math.sin(a0)];
    const n1 = [Math.cos(a1), 0, Math.sin(a1)];
    const p0b = [Math.cos(a0) * rBottom, y0, Math.sin(a0) * rBottom];
    const p1b = [Math.cos(a1) * rBottom, y0, Math.sin(a1) * rBottom];
    const p0t = [Math.cos(a0) * rTop, y1, Math.sin(a0) * rTop];
    const p1t = [Math.cos(a1) * rTop, y1, Math.sin(a1) * rTop];
    const i0 = pushVert(g, p0b, n0, color, [i / seg, 0]);
    const i1 = pushVert(g, p1b, n1, color, [(i + 1) / seg, 0]);
    const i2 = pushVert(g, p1t, n1, color, [(i + 1) / seg, 1]);
    const i3 = pushVert(g, p0t, n0, color, [i / seg, 1]);
    // Wound so the geometric normal points outward (front-facing outside).
    g.indices.push(i0, i2, i1, i0, i3, i2);
  }
  // top cap (normal +y: wind counter-clockwise seen from above)
  const ct = pushVert(g, [0, y1, 0], [0, 1, 0], color, [0.5, 0.5]);
  for (let i = 0; i < seg; i++) {
    const a0 = (i / seg) * Math.PI * 2;
    const a1 = ((i + 1) / seg) * Math.PI * 2;
    const p0 = [Math.cos(a0) * rTop, y1, Math.sin(a0) * rTop];
    const p1 = [Math.cos(a1) * rTop, y1, Math.sin(a1) * rTop];
    const i0 = pushVert(g, p0, [0, 1, 0], color, [0.5, 0.5]);
    const i1 = pushVert(g, p1, [0, 1, 0], color, [0.5, 0.5]);
    g.indices.push(ct, i1, i0);
  }
  return g;
}

export function coneGeometry(r, h, seg, color) {
  return cylinderGeometry(0.01, r, h, seg, color);
}

export function sphereGeometry(r, latSeg, lonSeg, color) {
  const g = newGeo();
  for (let la = 0; la < latSeg; la++) {
    const t0 = la / latSeg;
    const t1 = (la + 1) / latSeg;
    const p0 = Math.PI * t0, p1 = Math.PI * t1;
    for (let lo = 0; lo < lonSeg; lo++) {
      const a0 = (lo / lonSeg) * Math.PI * 2;
      const a1 = ((lo + 1) / lonSeg) * Math.PI * 2;
      const v = (phi, theta) => {
        const sp = Math.sin(phi), cp = Math.cos(phi);
        return [r * sp * Math.cos(theta), r * cp, r * sp * Math.sin(theta)];
      };
      const q0 = v(p0, a0), q1 = v(p0, a1), q2 = v(p1, a1), q3 = v(p1, a0);
      const n0 = [q0[0] / r, q0[1] / r, q0[2] / r];
      const n1 = [q1[0] / r, q1[1] / r, q1[2] / r];
      const n2 = [q2[0] / r, q2[1] / r, q2[2] / r];
      const n3 = [q3[0] / r, q3[1] / r, q3[2] / r];
      const i0 = pushVert(g, q0, n0, color, [lo / lonSeg, t0]);
      const i1 = pushVert(g, q1, n1, color, [(lo + 1) / lonSeg, t0]);
      const i2 = pushVert(g, q2, n2, color, [(lo + 1) / lonSeg, t1]);
      const i3 = pushVert(g, q3, n3, color, [lo / lonSeg, t1]);
      g.indices.push(i0, i1, i2, i0, i2, i3);
    }
  }
  return g;
}

// ---- canvas texture ----
export function makeCanvasTexture(gl, w, h, draw) {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  draw(ctx, w, h);
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.bindTexture(gl.TEXTURE_2D, null);
  return tex;
}

// ---- mesh ----
export class Mesh {
  constructor(gl, geo, opts = {}) {
    this.gl = gl;
    this.texture = opts.texture || null;
    this.visible = true;
    this.x = 0; this.y = 0; this.z = 0;
    this.rotY = 0; this.rotX = 0;
    this.sx = 1; this.sy = 1; this.sz = 1;
    this.indexCount = geo.indices.length;
    const mk = (data, size) => {
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);
      return buf;
    };
    this.posBuf = mk(geo.positions, 3);
    this.norBuf = mk(geo.normals, 3);
    this.colBuf = mk(geo.colors, 3);
    this.uvBuf = mk(geo.uvs, 2);
    this.idxBuf = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.idxBuf);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(geo.indices), gl.STATIC_DRAW);
  }
  set(x, y, z, rotY = 0, sx = 1, sy = sx, sz = sx) {
    this.x = x; this.y = y; this.z = z;
    this.rotY = rotY;
    this.sx = sx; this.sy = sy; this.sz = sz;
    return this;
  }
  modelMatrix() {
    let m = matTranslate(this.x, this.y, this.z);
    m = matMultiply(m, matRotateY(this.rotY));
    if (this.rotX) m = matMultiply(m, matRotateX(this.rotX));
    m = matMultiply(m, matScale(this.sx, this.sy, this.sz));
    return m;
  }
}

// ---- renderer ----
const VERT = `
attribute vec3 aPos; attribute vec3 aNormal; attribute vec3 aColor; attribute vec2 aUv;
uniform mat4 uModel; uniform mat4 uView; uniform mat4 uProj;
varying vec3 vNormal; varying vec3 vColor; varying vec2 vUv; varying float vDepth;
void main() {
  vec4 wp = uModel * vec4(aPos, 1.0);
  vNormal = mat3(uModel) * aNormal;
  vColor = aColor; vUv = aUv;
  vec4 vp = uView * wp;
  vDepth = -vp.z;
  gl_Position = uProj * vp;
}`;

const FRAG = `
precision mediump float;
varying vec3 vNormal; varying vec3 vColor; varying vec2 vUv; varying float vDepth;
uniform vec3 uLightDir; uniform vec3 uFogColor; uniform float uFogNear; uniform float uFogFar;
uniform sampler2D uTex; uniform int uUseTex; uniform float uAmbient;
void main() {
  vec3 n = normalize(vNormal);
  float diff = max(dot(n, normalize(uLightDir)), 0.0);
  vec3 base = vColor;
  if (uUseTex == 1) base = texture2D(uTex, vUv).rgb * vColor;
  vec3 col = base * (uAmbient + diff * (1.0 - uAmbient));
  float f = clamp((vDepth - uFogNear) / (uFogFar - uFogNear), 0.0, 1.0);
  gl_FragColor = vec4(mix(col, uFogColor, f), 1.0);
}`;

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    const gl = canvas.getContext("webgl", { antialias: true }) || canvas.getContext("experimental-webgl");
    if (!gl) throw new Error("WebGL is not available in this browser.");
    this.gl = gl;
    const compile = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        throw new Error("Shader compile failed: " + gl.getShaderInfoLog(s));
      }
      return s;
    };
    const prog = gl.createProgram();
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      throw new Error("Shader link failed: " + gl.getProgramInfoLog(prog));
    }
    gl.useProgram(prog);
    this.prog = prog;
    this.loc = {};
    for (const name of ["aPos", "aNormal", "aColor", "aUv", "uModel", "uView", "uProj", "uLightDir", "uFogColor", "uFogNear", "uFogFar", "uTex", "uUseTex", "uAmbient"]) {
      this.loc[name] = name.startsWith("a")
        ? gl.getAttribLocation(prog, name)
        : gl.getUniformLocation(prog, name);
    }
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
    this.view = matIdentity();
    this.proj = matIdentity();
    this.sunDir = [0.5, 0.8, 0.3];
    this.ambient = 0.55;
    this.fogColor = [0.6, 0.75, 0.9];
    this.fogNear = 120;
    this.fogFar = 520;
  }

  resize() {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    this.proj = matPerspective((62 * Math.PI) / 180, this.canvas.width / this.canvas.height, 0.5, 1200);
  }

  setCamera(eye, target) {
    this.view = matLookAt(eye, target, [0, 1, 0]);
  }

  setAtmosphere({ sky, fog, sunDir, ambient, fogNear, fogFar }) {
    const gl = this.gl;
    gl.clearColor(sky[0], sky[1], sky[2], 1);
    this.fogColor = fog;
    this.sunDir = sunDir;
    this.ambient = ambient;
    if (fogNear !== undefined) this.fogNear = fogNear;
    if (fogFar !== undefined) this.fogFar = fogFar;
  }

  clear() {
    const gl = this.gl;
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  }

  draw(mesh) {
    if (!mesh.visible || mesh.indexCount === 0) return;
    const gl = this.gl;
    const L = this.loc;
    gl.uniformMatrix4fv(L.uModel, false, mesh.modelMatrix());
    gl.uniformMatrix4fv(L.uView, false, this.view);
    gl.uniformMatrix4fv(L.uProj, false, this.proj);
    gl.uniform3fv(L.uLightDir, this.sunDir);
    gl.uniform3fv(L.uFogColor, this.fogColor);
    gl.uniform1f(L.uFogNear, this.fogNear);
    gl.uniform1f(L.uFogFar, this.fogFar);
    gl.uniform1f(L.uAmbient, this.ambient);
    if (mesh.texture) {
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, mesh.texture);
      gl.uniform1i(L.uTex, 0);
      gl.uniform1i(L.uUseTex, 1);
    } else {
      gl.uniform1i(L.uUseTex, 0);
    }
    const bind = (buf, loc, size) => {
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
    };
    bind(mesh.posBuf, L.aPos, 3);
    bind(mesh.norBuf, L.aNormal, 3);
    bind(mesh.colBuf, L.aColor, 3);
    bind(mesh.uvBuf, L.aUv, 2);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.idxBuf);
    gl.drawElements(gl.TRIANGLES, mesh.indexCount, gl.UNSIGNED_SHORT, 0);
  }
}
