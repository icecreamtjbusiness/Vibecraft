// ============================================================
// WebCraft Renderer: WebGL2 pipeline for voxel terrain,
// box-model mobs, particles, sky, weather, block highlight,
// and first-person held item.
// ============================================================
(function () {
  'use strict';
  const WC = window.WC;

  // ---------- tiny mat4 ----------
  const M4 = {
    create() { return new Float32Array(16); },
    ident(o) { o.fill(0); o[0] = o[5] = o[10] = o[15] = 1; return o; },
    persp(o, fovY, aspect, near, far) {
      const f = 1 / Math.tan(fovY / 2), nf = 1 / (near - far);
      o.fill(0);
      o[0] = f / aspect; o[5] = f; o[10] = (far + near) * nf; o[11] = -1; o[14] = 2 * far * near * nf;
      return o;
    },
    lookAt(o, ex, ey, ez, cx, cy, cz, ux, uy, uz) {
      let zx = ex - cx, zy = ey - cy, zz = ez - cz;
      let l = Math.hypot(zx, zy, zz) || 1; zx /= l; zy /= l; zz /= l;
      let xx = uy * zz - uz * zy, xy = uz * zx - ux * zz, xz = ux * zy - uy * zx;
      l = Math.hypot(xx, xy, xz) || 1; xx /= l; xy /= l; xz /= l;
      const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
      o[0] = xx; o[1] = yx; o[2] = zx; o[3] = 0;
      o[4] = xy; o[5] = yy; o[6] = zy; o[7] = 0;
      o[8] = xz; o[9] = yz; o[10] = zz; o[11] = 0;
      o[12] = -(xx * ex + xy * ey + xz * ez);
      o[13] = -(yx * ex + yy * ey + yz * ez);
      o[14] = -(zx * ex + zy * ey + zz * ez);
      o[15] = 1;
      return o;
    },
    mul(o, a, b) {
      for (let c = 0; c < 4; c++) {
        const b0 = b[c * 4], b1 = b[c * 4 + 1], b2 = b[c * 4 + 2], b3 = b[c * 4 + 3];
        o[c * 4] = a[0] * b0 + a[4] * b1 + a[8] * b2 + a[12] * b3;
        o[c * 4 + 1] = a[1] * b0 + a[5] * b1 + a[9] * b2 + a[13] * b3;
        o[c * 4 + 2] = a[2] * b0 + a[6] * b1 + a[10] * b2 + a[14] * b3;
        o[c * 4 + 3] = a[3] * b0 + a[7] * b1 + a[11] * b2 + a[15] * b3;
      }
      return o;
    },
    transRotY(o, x, y, z, ry) {
      M4.ident(o);
      const c = Math.cos(ry), s = Math.sin(ry);
      o[0] = c; o[2] = -s; o[4] = s; o[5] = 1; o[8] = c * 0 + o[8]; // keep simple: build manually below
      M4.ident(o);
      o[0] = c; o[2] = -s; o[8] = s; o[10] = c;
      o[12] = x; o[13] = y; o[14] = z;
      return o;
    },
  };

  // ---------- shaders ----------
  const VS_CHUNK = `#version 300 es
  layout(location=0) in vec3 aPos;
  layout(location=1) in vec2 aUV;
  layout(location=2) in vec3 aNorm;
  layout(location=3) in float aLight;
  uniform mat4 uVP;
  out vec2 vUV; out vec3 vNorm; out float vLight; out vec3 vWorld;
  void main(){ gl_Position = uVP * vec4(aPos,1.0); vUV=aUV; vNorm=aNorm; vLight=aLight; vWorld=aPos; }`;

  const FS_CHUNK = `#version 300 es
  precision highp float;
  in vec2 vUV; in vec3 vNorm; in float vLight; in vec3 vWorld;
  uniform sampler2D uAtlas;
  uniform vec3 uFogColor; uniform float uFogNear; uniform float uFogFar;
  uniform vec3 uCam; uniform float uTintR; uniform float uTintG; uniform float uTintB;
  uniform float uTime; uniform int uHasTint;
  out vec4 frag;
  void main(){
    vec4 t = texture(uAtlas, vUV);
    if (t.a < 0.35) discard;
    float nd = max(dot(normalize(vNorm), normalize(vec3(0.35, 0.9, 0.2))), 0.0);
    float shade = vLight * (0.72 + 0.28 * nd);
    vec3 col = t.rgb * shade;
    if (uHasTint == 1) col *= vec3(uTintR, uTintG, uTintB);
    float d = length(vWorld - uCam);
    float fog = clamp((d - uFogNear) / max(1.0, uFogFar - uFogNear), 0.0, 1.0);
    col = mix(col, uFogColor, fog);
    frag = vec4(col, t.a);
  }`;

  const VS_SIMPLE = `#version 300 es
  layout(location=0) in vec3 aPos;
  layout(location=1) in vec2 aUV;
  layout(location=2) in vec4 aColor;
  uniform mat4 uVP; uniform mat4 uModel;
  out vec2 vUV; out vec4 vColor;
  void main(){ gl_Position = uVP * uModel * vec4(aPos,1.0); vUV=aUV; vColor=aColor; }`;

  const FS_SIMPLE = `#version 300 es
  precision highp float;
  in vec2 vUV; in vec4 vColor;
  uniform sampler2D uTex; uniform int uUseTex; uniform float uAlphaMul;
  out vec4 frag;
  void main(){
    vec4 c = vColor;
    if (uUseTex == 1) { vec4 t = texture(uTex, vUV); if (t.a < 0.1) discard; c *= t; }
    frag = vec4(c.rgb, c.a * uAlphaMul);
  }`;

  const VS_SKY = `#version 300 es
  layout(location=0) in vec3 aPos;
  uniform mat4 uVP; uniform vec3 uCam;
  out vec3 vDir;
  void main(){ vec3 p = aPos + uCam; gl_Position = uVP * vec4(p,1.0); vDir = aPos; }`;

  const FS_SKY = `#version 300 es
  precision highp float;
  in vec3 vDir;
  uniform vec3 uTop; uniform vec3 uBot; uniform vec3 uHorizon;
  uniform vec3 uSunDir; uniform float uSunSize; uniform vec3 uSunColor;
  uniform int uStarsOn; uniform float uStarSeed; uniform vec3 uMoonDir;
  out vec4 frag;
  float hash(vec3 p){ p = fract(p*vec3(443.897,441.423,437.195)); p += dot(p,p.yzx+19.19); return fract((p.x+p.y)*p.z); }
  void main(){
    vec3 d = normalize(vDir);
    float h = d.y;
    vec3 col = mix(uHorizon, uTop, smoothstep(0.02, 0.55, h));
    col = mix(col, uBot, smoothstep(-0.05, -0.5, h));
    // sun
    float sd = dot(d, uSunDir);
    if (sd > 0.9995 - uSunSize) col = mix(col, uSunColor, smoothstep(0.9985 - uSunSize, 0.9995, sd));
    float glow = pow(max(sd, 0.0), 90.0);
    col += uSunColor * glow * 0.35;
    // moon
    float md = dot(d, uMoonDir);
    if (md > 0.9992) col = mix(col, vec3(0.95,0.95,1.0), smoothstep(0.9992, 0.9996, md));
    // stars
    if (uStarsOn == 1 && h > -0.02) {
      vec3 sp = floor(d * 220.0);
      float r = hash(sp + uStarSeed);
      if (r > 0.9965) col += vec3(1.0) * (0.4 + 0.6 * hash(sp * 1.7));
    }
    frag = vec4(col, 1.0);
  }`;

  function compile(gl, type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error('shader: ' + gl.getShaderInfoLog(s) + '\n' + src.slice(0, 200));
    return s;
  }
  function program(gl, vs, fs, attribs) {
    const p = gl.createProgram();
    gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs));
    gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('link: ' + gl.getProgramInfoLog(p));
    const u = {};
    const nu = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < nu; i++) { const info = gl.getActiveUniform(p, i); u[info.name.replace('[0]', '')] = gl.getUniformLocation(p, info.name); }
    return { p, u };
  }

  // ---------- mob colors ----------
  const MOB_COLORS = {
    cow: [[110, 70, 55], [230, 230, 230]], sheep: [[235, 235, 235], [180, 150, 120]], pig: [[230, 150, 150], [200, 110, 110]],
    chicken: [[240, 240, 240], [220, 60, 50]], rabbit: [[180, 150, 110], [220, 200, 170]], horse: [[140, 100, 60], [90, 60, 40]],
    donkey: [[160, 160, 160], [120, 120, 120]], mule: [[130, 120, 110], [100, 90, 80]], llama: [[200, 170, 130], [160, 130, 90]],
    trader_llama: [[190, 150, 120], [150, 120, 90]], wolf: [[220, 220, 220], [150, 150, 150]], ocelot: [[210, 180, 120], [160, 130, 80]],
    cat: [[180, 140, 90], [60, 60, 60]], fox: [[220, 130, 60], [240, 220, 200]], panda: [[245, 245, 245], [30, 30, 30]],
    polar_bear: [[240, 240, 245], [220, 220, 230]], bee: [[240, 200, 60], [60, 50, 30]], parrot: [[80, 200, 80], [220, 60, 60]],
    dolphin: [[120, 150, 190], [200, 220, 240]], turtle: [[110, 160, 90], [160, 130, 70]], squid: [[60, 60, 120], [40, 40, 90]],
    glow_squid: [[80, 180, 200], [60, 140, 170]], cod: [[120, 150, 170], [200, 210, 220]], salmon: [[220, 130, 110], [180, 100, 90]],
    tropical_fish: [[240, 180, 60], [60, 120, 220]], pufferfish: [[220, 190, 100], [180, 150, 70]], frog: [[110, 190, 80], [80, 150, 60]],
    tadpole: [[90, 120, 90], [70, 90, 70]], goat: [[190, 180, 160], [120, 110, 90]], axolotl: [[240, 150, 180], [200, 100, 140]],
    allay: [[120, 180, 240], [200, 230, 250]], moobloom: [[220, 90, 80], [240, 220, 60]], mushroom_cow: [[200, 80, 70], [150, 60, 50]],
    sniffer: [[150, 110, 90], [110, 80, 60]], armadillo: [[160, 120, 80], [120, 90, 60]], camel: [[210, 170, 110], [170, 130, 80]],
    deer_wolf: [[170, 130, 90], [130, 100, 70]], iron_golem: [[210, 210, 210], [160, 160, 160]], snow_golem: [[245, 245, 250], [60, 60, 60]],
    enderman: [[20, 20, 25], [60, 220, 200]], piglin: [[220, 150, 120], [150, 90, 60]], piglin_brute: [[200, 120, 90], [120, 60, 40]],
    hoglin: [[180, 80, 80], [140, 60, 60]], strider: [[220, 120, 110], [180, 80, 70]], zoglin: [[190, 130, 110], [150, 90, 80]],
    breeze: [[200, 220, 230], [150, 180, 200]], creaking: [[90, 75, 55], [50, 40, 30]],
    zombie: [[80, 140, 90], [60, 100, 70]], husk: [[170, 150, 100], [130, 110, 70]], drowned: [[70, 140, 140], [50, 110, 110]],
    zombie_villager: [[80, 140, 90], [60, 100, 70]], skeleton: [[220, 220, 210], [180, 180, 170]], stray: [[180, 210, 220], [140, 170, 180]],
    bogged: [[120, 150, 110], [90, 120, 80]], wither_skeleton: [[60, 60, 60], [30, 30, 30]], creeper: [[90, 180, 80], [60, 140, 50]],
    spider: [[60, 45, 40], [120, 40, 40]], cave_spider: [[80, 100, 130], [40, 60, 90]], silverfish: [[120, 120, 130], [80, 80, 90]],
    endermite: [[180, 160, 150], [120, 100, 90]], slime: [[120, 220, 120], [90, 190, 90]], magma_cube: [[220, 120, 40], [120, 40, 20]],
    ghast: [[230, 230, 230], [200, 200, 200]], blaze: [[240, 190, 60], [200, 120, 30]], phantom: [[120, 130, 180], [80, 90, 140]],
    vex: [[180, 220, 230], [120, 160, 180]], ravager: [[160, 130, 110], [120, 90, 70]], pillager: [[180, 140, 120], [100, 80, 60]],
    vindicator: [[200, 160, 140], [120, 90, 70]], evoker: [[180, 120, 200], [100, 60, 120]], illusioner: [[150, 170, 200], [90, 110, 140]],
    witch: [[120, 80, 160], [60, 40, 90]], guardian: [[120, 160, 180], [80, 120, 140]], elder_guardian: [[140, 170, 150], [90, 120, 100]],
    shulker: [[150, 90, 160], [110, 60, 120]], villager: [[200, 160, 130], [120, 90, 60]], wandering_trader: [[180, 140, 160], [100, 70, 90]],
    farmer: [[200, 160, 130], [120, 100, 60]], librarian: [[200, 160, 130], [80, 60, 140]], toolsmith: [[200, 160, 130], [90, 70, 50]],
    weaponsmith: [[200, 160, 130], [70, 50, 40]], armorer: [[200, 160, 130], [60, 60, 70]], cleric: [[200, 160, 130], [140, 120, 160]],
    fisherman: [[200, 160, 130], [100, 120, 90]], fletcher: [[200, 160, 130], [120, 100, 70]], butcher: [[200, 160, 130], [150, 80, 70]],
    leatherworker: [[200, 160, 130], [140, 110, 80]], mason: [[200, 160, 130], [160, 140, 120]], cartographer: [[200, 160, 130], [90, 100, 150]],
    nitwit: [[200, 160, 130], [150, 120, 140]], baby_villager: [[210, 170, 140], [130, 100, 70]], zombie_villager_baby: [[80, 140, 90], [60, 100, 70]],
    bat: [[80, 60, 50], [50, 35, 30]], zombified_piglin: [[150, 120, 100], [90, 70, 60]], warden: [[40, 60, 70], [20, 35, 45]],
    ender_dragon: [[30, 25, 40], [60, 40, 80]], wither: [[40, 40, 45], [20, 20, 25]],
  };

  // ---------- entity mesh builder (box model) ----------
  function entBox(out, cx, cy, cz, sx, sy, sz, color, rx = 0, rz = 0, uv = null) {
    // rotated around X then Z at center
    const hx = sx / 2, hy = sy / 2, hz = sz / 2;
    const cosx = Math.cos(rx), sinx = Math.sin(rx), cosz = Math.cos(rz), sinz = Math.sin(rz);
    const V = [[-hx, -hy, -hz], [hx, -hy, -hz], [hx, hy, -hz], [-hx, hy, -hz], [-hx, -hy, hz], [hx, -hy, hz], [hx, hy, hz], [-hx, hy, hz]];
    const rot = (v) => {
      let [x, y, z] = v;
      let y1 = y * cosx - z * sinx, z1 = y * sinx + z * cosx;
      let x2 = x * cosz - y1 * sinz, y2 = x * sinz + y1 * cosz;
      return [cx + x2, cy + y2, cz + z1];
    };
    const RV = V.map(rot);
    const F = [[0, 1, 2, 3], [5, 4, 7, 6], [4, 0, 3, 7], [1, 5, 6, 2], [3, 2, 6, 7], [4, 5, 1, 0]];
    const N = [[0, 0, -1], [0, 0, 1], [-1, 0, 0], [1, 0, 0], [0, 1, 0], [0, -1, 0]];
    const faces = uv ? [uv.back, uv.front, uv.left, uv.right, uv.top, uv.bottom] : null;
    for (let f = 0; f < 6; f++) {
      const q = F[f], n = N[f];
      const sh = 0.75 + 0.25 * Math.abs(n[1]) + (n[0] ? 0.1 : 0) + (n[2] ? -0.05 : 0);
      const cols = [Math.min(1, color[0] * sh), Math.min(1, color[1] * sh), Math.min(1, color[2] * sh)];
      const uvs = faces ? faces[f] : [[0, 0], [1, 0], [1, 1], [0, 1]];
      const base = out.p.length / 3;
      for (let vi = 0; vi < 4; vi++) {
        out.p.push(...RV[q[vi]]);
        out.n.push(...n);
        out.c.push(...cols, 1);
        out.uv.push(...uvs[vi]);
      }
      out.i.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
  }

  function buildEntityMesh(e) {
    const def = WC.MOBS[e.type] || {};
    const pal = MOB_COLORS[e.type] || [[180, 120, 100], [120, 80, 60]];
    const A = (c) => [c[0] / 255, c[1] / 255, c[2] / 255];
    const main = A(pal[0]), sec = A(pal[1] || pal[0]);
    const out = { p: [], n: [], c: [], uv: [], i: [] };
    const w = def.w || 0.6, h = def.h || 1.8;
    const walk = Math.sin(e.age * 0.25) * 0.5;
    const hurtFlash = e.hurtT > 0;
    const hx = (c) => hurtFlash ? [1, 0.3, 0.3] : c;
    const yaw = e.yaw || 0;
    // translate helper: positions are local, apply yaw at draw via model matrix (we bake pos + yaw rotation here)
    const RY = (x, z) => [x * Math.cos(yaw) + z * Math.sin(yaw), -x * Math.sin(yaw) + z * Math.cos(yaw)];
    function box(lx, ly, lz, sx, sy, sz, color, rx = 0, rz = 0) {
      const [px, pz] = RY(lx, lz);
      entBox(out, e.x + px, e.y + ly, e.z + pz, sx, sy, sz, hx(color), rx, rz);
    }
    const t = e.type;
    if (t === 'item') {
      const it = WC.items[e.stack?.item];
      const col = it ? [(it.color[0] || 150) / 255, (it.color[1] || 150) / 255, (it.color[2] || 150) / 255] : [0.6, 0.5, 0.4];
      box(0, 0.25 + Math.sin(e.bob + e.age * 0.1) * 0.06, 0, 0.35, 0.35, 0.08, col, 0.5, 0.6);
      return out;
    }
    if (t === 'proj') {
      const kind = e.kind;
      const col = kind === 'fireball' ? [1, 0.6, 0.2] : kind === 'witherskull' ? [0.3, 0.3, 0.3] : kind === 'dragon_fireball' ? [0.6, 0.2, 0.8] : kind === 'trident' ? [0.4, 0.8, 0.8] : [0.8, 0.7, 0.5];
      const s = kind === 'fireball' || kind === 'dragon_fireball' ? 0.4 : 0.12;
      box(0, 0, 0, s, s, s * (kind === 'arrow' ? 4 : 1), col);
      return out;
    }
    if (t === 'ender_dragon') {
      // body + wings + head + tail
      box(0, h * 0.55, 0, 2.2, 1.6, 5, main, 0, 0);
      const [hx2, hz2] = [0, -3.4];
      box(hx2, h * 0.75, hz2, 1.2, 1.1, 1.6, sec);
      const wingY = h * 0.75, flap = Math.sin(e.age * 0.12) * 0.6;
      entBox(out, e.x + Math.cos(yaw) * 2.6, e.y + wingY + flap, e.z - Math.sin(yaw) * 2.6, 3.6, 0.2, 2.4, hx(main), 0, flap * 0.4);
      entBox(out, e.x - Math.cos(yaw) * 2.6, e.y + wingY - flap, e.z + Math.sin(yaw) * 2.6, 3.6, 0.2, 2.4, hx(main), 0, -flap * 0.4);
      for (let i = 0; i < 5; i++) box(0, h * 0.6, 2.8 + i * 0.9, 0.7 - i * 0.1, 0.5, 1, sec);
      return out;
    }
    if (t === 'wither') {
      box(0, 1.6, 0, 1.6, 2.4, 1.2, main);
      box(-0.9, 3.1, 0, 0.8, 0.9, 0.8, sec); box(0.9, 3.1, 0, 0.8, 0.9, 0.8, sec); box(0, 3.4, 0, 0.9, 1, 0.9, sec);
      return out;
    }
    if (t === 'ghast') {
      box(0, h * 0.7, 0, 3.6, 3.4, 3.6, main);
      for (let i = 0; i < 6; i++) box(-1.4 + i * 0.55, h * 0.25 + Math.sin(e.age * 0.1 + i) * 0.2, 0, 0.2, 1.6, 0.2, sec);
      return out;
    }
    if (def.quaduped || ['cow', 'sheep', 'pig', 'rabbit', 'horse', 'donkey', 'mule', 'llama', 'wolf', 'ocelot', 'cat', 'fox', 'panda', 'polar_bear', 'hoglin', 'zoglin', 'strider', 'deer_wolf', 'goat', 'camel', 'sniffer', 'armadillo', 'moobloom', 'mushroom_cow'].includes(t)) {
      const legH = h * 0.42, bodyY = legH + h * 0.28;
      const bw = w * 0.9, bh = h * 0.5, bl = h * 0.85;
      box(0, bodyY, 0, bw, bh, bl, main);
      const legs = [[-bw * 0.3, -bl * 0.32], [bw * 0.3, -bl * 0.32], [-bw * 0.3, bl * 0.32], [bw * 0.3, bl * 0.32]];
      legs.forEach(([lx, lz], i) => box(lx, legH / 2, lz, bw * 0.22, legH, bw * 0.22, sec, i % 2 ? walk : -walk));
      box(0, bodyY + bh * 0.25, -bl * 0.62, bw * 0.55, bh * 0.7, bw * 0.5, t === 'sheep' ? sec : main);
      if (t === 'cow' || t === 'moobloom' || t === 'mushroom_cow') { box(-bw * 0.28, bodyY + bh * 0.75, -bl * 0.62, 0.12, 0.25, 0.12, [1, 1, 0.9]); box(bw * 0.28, bodyY + bh * 0.75, -bl * 0.62, 0.12, 0.25, 0.12, [1, 1, 0.9]); }
      return out;
    }
    if (['chicken'].includes(t)) {
      box(0, 0.45, 0, 0.5, 0.7, 0.6, main);
      box(0, 0.95, -0.25, 0.3, 0.3, 0.3, main);
      box(0, 0.9, -0.45, 0.12, 0.1, 0.15, [1, 0.7, 0.1]);
      box(-0.12, 0.15, 0, 0.12, 0.3, 0.12, [1, 0.7, 0.1]); box(0.12, 0.15, 0, 0.12, 0.3, 0.12, [1, 0.7, 0.1]);
      return out;
    }
    if (['bee', 'parrot', 'allay'].includes(t)) {
      box(0, 0.35, 0, w * 0.8, h * 0.7, w, main);
      const flap = Math.sin(e.age * 0.9) * 0.5;
      box(-w * 0.6, 0.6, 0, 0.3, 0.05, 0.4, [1, 1, 1], flap); box(w * 0.6, 0.6, 0, 0.3, 0.05, 0.4, [1, 1, 1], -flap);
      return out;
    }
    if (['squid', 'glow_squid', 'dolphin', 'turtle', 'cod', 'salmon', 'tropical_fish', 'pufferfish', 'axolotl', 'tadpole', 'guardian', 'elder_guardian'].includes(t)) {
      box(0, h * 0.5, 0, w, h * 0.8, h * 1.2, main);
      box(0, h * 0.5, h * 0.75, w * 0.15, h * 0.5, h * 0.4, sec);
      return out;
    }
    if (['spider', 'cave_spider', 'silverfish', 'endermite'].includes(t)) {
      box(0, h * 0.5, 0.2, w * 0.8, h * 0.7, h * 0.9, main);
      box(0, h * 0.55, -h * 0.5, w * 0.5, h * 0.5, h * 0.4, main);
      for (let i = 0; i < 4; i++) {
        const sw = walk * (i % 2 ? 1 : -1);
        box(-w * 0.5, h * 0.4, -0.3 + i * 0.22, 0.5, 0.1, 0.12, sec, 0, sw);
        box(w * 0.5, h * 0.4, -0.3 + i * 0.22, 0.5, 0.1, 0.12, sec, 0, -sw);
      }
      return out;
    }
    if (['slime', 'magma_cube'].includes(t)) {
      const s = (e.size || 1) * 0.55;
      const hop = Math.abs(Math.sin(e.age * 0.15)) * 0.2;
      box(0, s * 0.9 + hop, 0, s * 2, s * 1.6, s * 2, main);
      return out;
    }
    if (['bat'].includes(t)) {
      box(0, 0.3, 0, 0.4, 0.4, 0.5, main);
      const flap = Math.sin(e.age * 0.8) * 0.7;
      box(-0.5, 0.35, 0, 0.7, 0.05, 0.4, sec, 0, flap); box(0.5, 0.35, 0, 0.7, 0.05, 0.4, sec, 0, -flap);
      return out;
    }
    if (['phantom'].includes(t)) {
      box(0, 0.4, 0, 0.9, 0.2, 1.6, main);
      box(-0.9, 0.4, 0.2, 1.0, 0.05, 0.8, sec); box(0.9, 0.4, 0.2, 1.0, 0.05, 0.8, sec);
      return out;
    }
    if (['iron_golem'].includes(t)) {
      box(0, 1.5, 0, 1.2, 1.4, 0.8, main);
      box(0, 2.45, 0, 0.6, 0.6, 0.6, main);
      box(-0.75, 1.9, 0, 0.35, 1.2, 0.35, main); box(0.75, 1.9, 0, 0.35, 1.2, 0.35, main);
      box(-0.3, 0.4, 0, 0.4, 0.9, 0.4, main); box(0.3, 0.4, 0, 0.4, 0.9, 0.4, main);
      box(0, 1.7, -0.45, 0.3, 0.3, 0.1, sec);
      return out;
    }
    if (['snow_golem'].includes(t)) {
      box(0, 0.4, 0, 0.7, 0.8, 0.7, main); box(0, 1.1, 0, 0.55, 0.6, 0.55, main); box(0, 1.65, 0, 0.4, 0.4, 0.4, main);
      box(0, 1.65, -0.22, 0.1, 0.1, 0.15, [1, 0.5, 0.1]);
      return out;
    }
    if (['enderman', 'vex'].includes(t)) {
      box(0, 1.3, 0, 0.45, 1.4, 0.35, main);
      box(0, 2.2, 0, 0.55, 0.65, 0.5, main);
      box(0, 2.25, -0.26, 0.4, 0.12, 0.05, sec); // eyes
      box(-0.35, 1.4, 0, 0.15, 1.2, 0.15, main); box(0.35, 1.4, 0, 0.15, 1.2, 0.15, main);
      box(-0.12, 0.35, 0, 0.16, 0.7, 0.16, main); box(0.12, 0.35, 0, 0.16, 0.7, 0.16, main);
      return out;
    }
    if (['ravager'].includes(t)) {
      box(0, 1.1, 0, 1.4, 1.6, 2.0, main);
      box(0, 1.9, -1.3, 0.9, 0.9, 0.9, sec);
      [[-0.5, -0.7], [0.5, -0.7], [-0.5, 0.7], [0.5, 0.7]].forEach(([lx, lz]) => box(lx, 0.3, lz, 0.35, 0.6, 0.35, main));
      return out;
    }
    if (['shulker'].includes(t)) {
      const open = Math.sin(e.age * 0.05) * 0.3 + 0.3;
      box(0, 0.5, 0, 1, 0.9, 1, main);
      box(0, 1.1 + open, 0, 1.1, 0.35, 1.1, sec);
      return out;
    }
    if (['warden'].includes(t)) {
      box(0, 1.6, 0, 1.1, 1.9, 0.8, main);
      box(0, 2.75, 0, 0.9, 0.8, 0.7, main);
      box(-0.35, 3.0, -0.4, 0.2, 0.5, 0.2, sec); box(0.35, 3.0, -0.4, 0.2, 0.5, 0.2, sec);
      box(-0.8, 2.0, 0, 0.35, 1.5, 0.35, main); box(0.8, 2.0, 0, 0.35, 1.5, 0.35, main);
      box(-0.25, 0.55, 0, 0.35, 1.1, 0.35, main); box(0.25, 0.55, 0, 0.35, 1.1, 0.35, main);
      return out;
    }
    if (['blaze'].includes(t)) {
      box(0, 1.1, 0, 0.5, 0.9, 0.5, main);
      box(0, 1.7, 0, 0.4, 0.4, 0.4, sec);
      for (let i = 0; i < 4; i++) {
        const a = e.age * 0.1 + i * 1.57;
        box(Math.cos(a) * 0.6, 1.1 + Math.sin(a * 2) * 0.2, Math.sin(a) * 0.6, 0.12, 0.7, 0.12, sec);
      }
      return out;
    }
    // humanoid default (zombie/skeleton/player-like/villager/piglin/etc.)
    const isSkeleton = ['skeleton', 'stray', 'bogged', 'wither_skeleton'].includes(t);
    const skinC = main, shirtC = sec;
    const scale = def.baby ? 0.55 : 1;
    const armSw = e.aiState === 'attack' ? -1.2 : walk * 0.6;
    box(0, 1.1 * scale, 0, 0.55 * scale, 0.75 * scale, 0.3 * scale, shirtC);           // torso
    box(0, 1.78 * scale, 0, 0.52 * scale, 0.52 * scale, 0.52 * scale, skinC);          // head
    if (isSkeleton) { box(0, 1.85 * scale, -0.28 * scale, 0.36 * scale, 0.1, 0.05, [0.1, 0.1, 0.1]); }
    else { box(0, 1.9 * scale, 0, 0.54 * scale, 0.16 * scale, 0.54 * scale, sec); }    // hair
    box(-0.42 * scale, 1.15 * scale, 0, 0.22 * scale, 0.72 * scale, 0.22 * scale, skinC, armSw);
    box(0.42 * scale, 1.15 * scale, 0, 0.22 * scale, 0.72 * scale, 0.22 * scale, skinC, -armSw);
    box(-0.15 * scale, 0.38 * scale, 0, 0.24 * scale, 0.75 * scale, 0.24 * scale, isSkeleton ? skinC : [0.25, 0.3, 0.5]);
    box(0.15 * scale, 0.38 * scale, 0, 0.24 * scale, 0.75 * scale, 0.24 * scale, isSkeleton ? skinC : [0.25, 0.3, 0.5]);
    return out;
  }

  // ---------- particle system ----------
  class Particles {
    constructor() { this.list = []; this.max = 2500; }
    add(x, y, z, vx, vy, vz, life, color, size, tex = null) {
      if (this.list.length >= this.max) this.list.shift();
      this.list.push({ x, y, z, vx, vy, vz, life, maxLife: life, color, size, tex });
    }
    blockBreak(wx, wy, wz, blockDef) {
      const tiles = WC.texTiles;
      const tn = blockDef ? WC.faceTex(blockDef, 2, {}) : null;
      const t = tn && tiles[tn];
      const col = blockDef ? [blockDef.color[0] / 255, blockDef.color[1] / 255, blockDef.color[2] / 255] : [0.6, 0.6, 0.6];
      for (let i = 0; i < 14; i++) {
        this.add(wx + 0.5 + (Math.random() - .5) * 0.7, wy + 0.5 + (Math.random() - .5) * 0.7, wz + 0.5 + (Math.random() - .5) * 0.7,
          (Math.random() - .5) * 2.5, Math.random() * 3, (Math.random() - .5) * 2.5, 0.7 + Math.random() * 0.5,
          [col[0] * (0.8 + Math.random() * 0.4), col[1] * (0.8 + Math.random() * 0.4), col[2] * (0.8 + Math.random() * 0.4)], 0.06 + Math.random() * 0.06, t ? tn : null);
      }
    }
    crit(x, y, z) { for (let i = 0; i < 8; i++) this.add(x, y + 1, z, (Math.random() - .5) * 2, 2 + Math.random() * 2, (Math.random() - .5) * 2, 0.8, [1, 1, 0.4], 0.05); }
    damage(x, y, z) { for (let i = 0; i < 6; i++) this.add(x, y + 1, z, (Math.random() - .5) * 3, 1 + Math.random() * 2, (Math.random() - .5) * 3, 0.6, [1, 0.2, 0.2], 0.05); }
    heart(x, y, z) { this.add(x, y + 1.5, z, 0, 1.2, 0, 1.0, [1, 0.3, 0.4], 0.12); }
    explode(x, y, z, power) {
      const n = Math.min(120, power * 25);
      for (let i = 0; i < n; i++) {
        const a = Math.random() * 6.283, b = Math.acos(2 * Math.random() - 1), sp = (1 + Math.random() * 3) * power;
        this.add(x, y, z, Math.sin(b) * Math.cos(a) * sp, Math.cos(b) * sp * 0.7 + 2, Math.sin(b) * Math.sin(a) * sp,
          0.6 + Math.random() * 0.8, Math.random() < 0.5 ? [0.2, 0.2, 0.2] : [1, 0.6, 0.2], 0.15 + Math.random() * 0.25);
      }
    }
    portal(x, y, z) { this.add(x + Math.random(), y + Math.random(), z + Math.random(), 0, 0.5, 0, 1.2, [0.6, 0.2, 0.9], 0.08, 'portal_particle'); }
    endPortal(x, y, z) { this.add(x + (Math.random() - .5) * 6, y + Math.random() * 3, z + (Math.random() - .5) * 6, 0, 0.3, 0, 2, [0.2, 0.9, 0.6], 0.06, 'end_portal_part'); }
    flame(x, y, z) { this.add(x + (Math.random() - .5) * 0.6, y, z + (Math.random() - .5) * 0.6, 0, 1.5 + Math.random(), 0, 0.8, [1, 0.5 + Math.random() * 0.3, 0.1], 0.08, 'fire_0'); }
    smoke(x, y, z) { this.add(x, y + 1, z, (Math.random() - .5) * 0.3, 0.8, (Math.random() - .5) * 0.3, 1.5, [0.3, 0.3, 0.3], 0.15, 'smoke_p'); }
    xpOrb(x, y, z) { this.add(x, y + 0.5, z, (Math.random() - .5), 1.5, (Math.random() - .5), 0.6, [0.5, 1, 0.2], 0.06, 'exp_orb'); }
    update(dt, world) {
      for (let i = this.list.length - 1; i >= 0; i--) {
        const p = this.list[i];
        p.life -= dt;
        if (p.life <= 0) { this.list.splice(i, 1); continue; }
        p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
        p.vy -= 6 * dt;
        if (!p.tex) {
          const bx = Math.floor(p.x), by = Math.floor(p.y), bz = Math.floor(p.z);
          const d = WC.blockIds[WC.blockAt(bx, by, bz)];
          if (d && d.solid) { p.y -= p.vy * dt; p.vy = -p.vy * 0.3; p.vx *= 0.7; p.vz *= 0.7; }
        } else p.vy += 8 * dt; // flames rise
      }
    }
  }

  // ---------- renderer ----------
  class Renderer {
    constructor(canvas) {
      const gl = this.gl = canvas.getContext('webgl2', { antialias: false, alpha: false });
      if (!gl) throw new Error('WebGL2 not supported');
      this.canvas = canvas;
      this.chunkProg = program(gl, VS_CHUNK, FS_CHUNK);
      this.simpleProg = program(gl, VS_SIMPLE, FS_SIMPLE);
      this.skyProg = program(gl, VS_SKY, FS_SKY);
      this.meshes = new Map();     // "dim:cx,cz" -> {vao, count, has32}
      this.entityBufs = new Map(); // eid -> {vao,count}
      this.particles = new Particles();
      this.whiteTex = this.makeTex(new Uint8Array([255, 255, 255, 255]), 1, 1);
      this.atlasTex = null;
      gl.enable(gl.DEPTH_TEST);
      gl.enable(gl.CULL_FACE);
      gl.cullFace(gl.BACK);
      // sky quad (hemisphere cube)
      this.skyVAO = gl.createVertexArray();
      gl.bindVertexArray(this.skyVAO);
      const S = 1;
      const skyVerts = new Float32Array([-S,-S,-S, S,-S,-S, S,S,-S, -S,S,-S, -S,-S,S, S,-S,S, S,S,S, -S,S,S]);
      const skyIdx = [0,1,2,0,2,3, 5,4,7,5,7,6, 4,0,3,4,3,7, 1,5,6,1,6,2, 3,2,6,3,6,7, 4,5,1,4,1,0];
      gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, skyVerts, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(skyIdx), gl.STATIC_DRAW);
      // highlight wire cube
      this.hlVAO = this.makeLineCube();
      this.vp = M4.create(); this.proj = M4.create(); this.view = M4.create();
      this.tmpM = M4.create();
      this.frameCount = 0;
      this.lastChunkKey = '';
    }
    makeTex(data, w, h) {
      const gl = this.gl;
      const t = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return t;
    }
    setAtlas(atlasPixels, size) {
      if (this.atlasTex) this.gl.deleteTexture(this.atlasTex);
      this.atlasTex = this.makeTex(atlasPixels, size, size);
    }
    makeLineCube() {
      const gl = this.gl;
      const v = new Float32Array([0,0,0, 1,0,0, 1,0,1, 0,0,1, 0,1,0, 1,1,0, 1,1,1, 0,1,1]);
      const idx = [0,1,1,2,2,3,3,0, 4,5,5,6,6,7,7,4, 0,4,1,5,2,6,3,7];
      const vao = gl.createVertexArray();
      gl.bindVertexArray(vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, v, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(idx), gl.STATIC_DRAW);
      gl.bindVertexArray(null);
      return { vao, count: idx.length };
    }
    uploadChunk(dim, chunk, mesh) {
      const gl = this.gl;
      const key = dim + ':' + chunk.cx + ',' + chunk.cz;
      let rec = this.meshes.get(key);
      if (rec) { gl.deleteVertexArray(rec.vao); }
      const vao = gl.createVertexArray();
      gl.bindVertexArray(vao);
      const mkBuf = (loc, arr, size) => {
        const b = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, b);
        gl.bufferData(gl.ARRAY_BUFFER, arr, gl.STATIC_DRAW);
        gl.enableVertexAttribArray(loc);
        gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
        return b;
      };
      mkBuf(0, mesh.position, 3);
      mkBuf(1, mesh.uv, 2);
      mkBuf(2, mesh.normal, 3);
      const lightArr = mesh.light || new Float32Array(mesh.position.length / 3);
      mkBuf(3, lightArr, 1);
      const ib = gl.createBuffer();
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.index, gl.STATIC_DRAW);
      gl.bindVertexArray(null);
      rec = { vao, count: mesh.count, has32: mesh.has32 };
      this.meshes.set(key, rec);
    }
    removeChunkMesh(dim, cx, cz) {
      const key = dim + ':' + cx + ',' + cz;
      const rec = this.meshes.get(key);
      if (rec) { this.gl.deleteVertexArray(rec.vao); this.meshes.delete(key); }
    }
    clearAllMeshes() {
      for (const rec of this.meshes.values()) this.gl.deleteVertexArray(rec.vao);
      this.meshes.clear();
    }
    skyColors(dim, timePct) {
      if (dim === 'nether') return { top: [0.25, 0.05, 0.03], bot: [0.35, 0.1, 0.05], hor: [0.4, 0.12, 0.06], stars: 0, sun: [1, 0.5, 0.2], sunDir: [0, 1, 0] };
      if (dim === 'end') return { top: [0.02, 0.02, 0.03], bot: [0.05, 0.05, 0.06], hor: [0.08, 0.08, 0.1], stars: 1, sun: [0.7, 0.7, 0.75], sunDir: [0.3, 0.8, 0.2] };
      const day = Math.cos((timePct - 0.25) * Math.PI * 2); // 1 at noon, -1 midnight
      const k = (day + 1) / 2;
      const rain = WC.state.weather !== 'clear' ? 0.55 : 1;
      const lerp3 = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
      const topDay = [0.45, 0.68, 0.95], topNight = [0.02, 0.02, 0.06];
      const horDay = [0.75, 0.85, 0.95], horDusk = [0.95, 0.55, 0.3], horNight = [0.05, 0.05, 0.1];
      let top = lerp3(topNight, topDay, k);
      let hor = k > 0.65 ? lerp3(horDusk, horDay, (k - 0.65) / 0.35) : k < 0.35 ? lerp3(horNight, horDusk, k / 0.35) : horDusk;
      top = top.map(v => v * rain); hor = hor.map(v => v * rain);
      const ang = (timePct - 0.25) * Math.PI * 2;
      return { top, bot: top.map(v => v * 0.7), hor, stars: k < 0.3 ? 1 : 0, sun: [1, 0.9, 0.6], sunDir: [Math.cos(ang), Math.sin(ang), 0.3], moonDir: [-Math.cos(ang), -Math.sin(ang), -0.3] };
    }
    render(nowMs) {
      const gl = this.gl, S = WC.state, p = S.player;
      const W = this.canvas.width, H = this.canvas.height;
      gl.viewport(0, 0, W, H);
      const dist = Math.max(2, S.options.renderDist | 0);
      const rd = dist * 16;
      const sc = this.skyColors(S.dim, (S.time % 24000) / 24000);
      gl.clearColor(sc.hor[0], sc.hor[1], sc.hor[2], 1);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

      // camera
      const fov = (S.options.fov || 70) * Math.PI / 180;
      const aspect = W / H;
      M4.persp(this.proj, fov, aspect, 0.08, rd * 3);
      const eyeY = p.y + (S.thirdPerson === 0 ? 1.62 : 1.62);
      const cp = Math.cos(p.pitch), sp2 = Math.sin(p.pitch), cy = Math.cos(p.yaw), sy = Math.sin(p.yaw);
      let ex = p.x, ey = eyeY, ez = p.z;
      let tx, ty, tz;
      if (S.thirdPerson === 0) {
        tx = p.x + sy * cp; ty = eyeY + sp2; tz = p.z - cy * cp;
      } else {
        const back = S.thirdPerson === 1 ? 1 : -1;
        ex = p.x - sy * cp * 4 * back; ey = eyeY + sp2 * -4 * back + 0.3; ez = p.z + cy * cp * 4 * back;
        tx = p.x + sy * cp; ty = eyeY + sp2; tz = p.z - cy * cp;
      }
      M4.lookAt(this.view, ex, ey, ez, tx, ty, tz, 0, 1, 0);
      M4.mul(this.vp, this.proj, this.view);

      // ---- sky ----
      if (S.dim === 'overworld' || true) {
        gl.useProgram(this.skyProg.p);
        gl.depthMask(false);
        gl.disable(gl.CULL_FACE);
        gl.uniformMatrix4fv(this.skyProg.u.uVP, false, this.vp);
        gl.uniform3f(this.skyProg.u.uCam, ex, ey, ez);
        gl.uniform3fv(this.skyProg.u.uTop, sc.top);
        gl.uniform3fv(this.skyProg.u.uBot, sc.bot);
        gl.uniform3fv(this.skyProg.u.uHorizon, sc.hor);
        gl.uniform3fv(this.skyProg.u.uSunDir, sc.sunDir);
        gl.uniform3fv(this.skyProg.u.uSunColor, sc.sun);
        gl.uniform1f(this.skyProg.u.uSunSize, 0.0015);
        gl.uniform1i(this.skyProg.u.uStarsOn, sc.stars);
        gl.uniform1f(this.skyProg.u.uStarSeed, (S.time % 24000) / 24000 * 7);
        gl.uniform3fv(this.skyProg.u.uMoonDir, sc.moonDir || [0, 1, 0]);
        gl.bindVertexArray(this.skyVAO);
        gl.drawElements(gl.TRIANGLES, 36, gl.UNSIGNED_SHORT, 0);
        gl.depthMask(true);
        gl.enable(gl.CULL_FACE);
      }

      // ---- chunks ----
      const fogNear = rd * 0.55, fogFar = rd * 1.05;
      const prog = this.chunkProg;
      gl.useProgram(prog.p);
      gl.uniformMatrix4fv(prog.u.uVP, false, this.vp);
      gl.uniform3fv(prog.u.uFogColor, sc.hor);
      gl.uniform1f(prog.u.uFogNear, fogNear);
      gl.uniform1f(prog.u.uFogFar, fogFar);
      gl.uniform3f(prog.u.uCam, ex, ey, ez);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.atlasTex || this.whiteTex);
      gl.uniform1i(prog.u.uAtlas, 0);
      gl.uniform1i(prog.u.uHasTint, 0);
      const world = WC.world();
      const pcx = Math.floor(p.x) >> 4, pcz = Math.floor(p.z) >> 4;
      // opaque pass: sort roughly front to back
      const order = [];
      for (let dx = -dist; dx <= dist; dx++) for (let dz = -dist; dz <= dist; dz++) {
        if (dx * dx + dz * dz > (dist + 1) * (dist + 1)) continue;
        order.push([pcx + dx, pcz + dz, dx * dx + dz * dz]);
      }
      order.sort((a, b) => a[2] - b[2]);
      const waterQueue = [];
      for (const [cx, cz] of order) {
        const c = world.getChunk(cx, cz);
        if (!c) continue;
        const key = S.dim + ':' + cx + ',' + cz;
        const rec = this.meshes.get(key);
        if (!rec) continue;
        // frustum-lite check
        const wx = cx * 16 + 8, wz = cz * 16 + 8;
        const ddx = wx - p.x, ddz = wz - p.z;
        const facing = (ddx * sy - ddz * cy);
        if (Math.hypot(ddx, ddz) > rd * 1.6 && facing < -4) continue;
        gl.bindVertexArray(rec.vao);
        if (rec.has32) {
          const ext = gl.getExtension('OES_element_index_uint');
          gl.drawElements(gl.TRIANGLES, rec.count, gl.UNSIGNED_INT, 0);
        } else gl.drawElements(gl.TRIANGLES, rec.count, gl.UNSIGNED_SHORT, 0);
      }

      // ---- entities ----
      gl.useProgram(this.simpleProg.p);
      gl.uniformMatrix4fv(this.simpleProg.u.uVP, false, this.vp);
      gl.uniform1i(this.simpleProg.u.uUseTex, 0);
      gl.uniform1f(this.simpleProg.u.uAlphaMul, 1);
      for (const e of S.entities) {
        if (e.dead) continue;
        const d2 = (e.x - p.x) ** 2 + (e.y - p.y) ** 2 + (e.z - p.z) ** 2;
        if (d2 > rd * rd * 1.2) continue;
        const rec = this.buildEntity(e);
        if (!rec) continue;
        M4.ident(this.tmpM);
        gl.uniformMatrix4fv(this.simpleProg.u.uModel, false, this.tmpM);
        gl.bindVertexArray(rec.vao);
        gl.drawElements(gl.TRIANGLES, rec.count, gl.UNSIGNED_SHORT, 0);
      }

      // ---- particles ----
      this.renderParticles(ex, ey, ez, fogNear, fogFar);

      // ---- block highlight ----
      if (WC.target && WC.target.hit) {
        const t = WC.target;
        gl.useProgram(this.simpleProg.p);
        gl.uniform1i(this.simpleProg.u.uUseTex, 0);
        gl.uniform1f(this.simpleProg.u.uAlphaMul, 1);
        M4.transRotY(this.tmpM, t.x, t.y, t.z, 0);
        gl.uniformMatrix4fv(this.simpleProg.u.uModel, false, this.tmpM);
        gl.disable(gl.DEPTH_TEST);
        gl.bindVertexArray(this.hlVAO.vao);
        gl.drawElements(gl.LINES, this.hlVAO.count, gl.UNSIGNED_SHORT, 0);
        gl.enable(gl.DEPTH_TEST);
        // breaking overlay crack (simple darkening cube scaled)
        if (p.breaking && p.breaking.progress > 0) {
          const pr = Math.min(0.98, p.breaking.progress / p.breaking.total);
          M4.ident(this.tmpM);
          this.tmpM[0] = 1 - pr * 0.15; this.tmpM[5] = 1 - pr * 0.15; this.tmpM[10] = 1 - pr * 0.15;
          this.tmpM[12] = t.x + pr * 0.075; this.tmpM[13] = t.y + pr * 0.075; this.tmpM[14] = t.z + pr * 0.075;
          gl.uniformMatrix4fv(this.simpleProg.u.uModel, false, this.tmpM);
          gl.drawElements(gl.LINES, this.hlVAO.count, gl.UNSIGNED_SHORT, 0);
        }
      }

      // ---- water/translucent second pass handled inside chunk mesh (alpha blend) ----
      this.frameCount++;
    }
    buildEntity(e) {
      let rec = this.entityBufs.get(e.id);
      const ageTick = (e.age * 2) | 0;
      if (rec && rec.tick === ageTick && rec.pos0 === e.x && rec.pos2 === e.z) return rec;
      const gl = this.gl;
      if (rec) gl.deleteVertexArray(rec.vao);
      const data = buildEntityMesh(e);
      if (!data.p.length) { this.entityBufs.delete(e.id); return null; }
      const interleaved = [];
      const vc = data.p.length / 3;
      for (let i = 0; i < vc; i++) {
        interleaved.push(data.p[i * 3], data.p[i * 3 + 1], data.p[i * 3 + 2],
          data.uv[i * 2], data.uv[i * 2 + 1],
          data.c[i * 4], data.c[i * 4 + 1], data.c[i * 4 + 2], data.c[i * 4 + 3]);
      }
      const vao = gl.createVertexArray();
      gl.bindVertexArray(vao);
      const vb = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, vb);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(interleaved), gl.DYNAMIC_DRAW);
      const stride = 9 * 4;
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, stride, 0);
      gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 2, gl.FLOAT, false, stride, 12);
      gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 4, gl.FLOAT, false, stride, 20);
      const ib = gl.createBuffer();
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(data.i), gl.DYNAMIC_DRAW);
      gl.bindVertexArray(null);
      rec = { vao, count: data.i.length, tick: ageTick, pos0: e.x, pos2: e.z, vb, ib };
      this.entityBufs.set(e.id, rec);
      return rec;
    }
    renderParticles(ex, ey, ez, fogNear, fogFar) {
      const gl = this.gl, list = this.particles.list;
      if (!list.length) return;
      const verts = [];
      for (const pt of list) {
        const a = Math.min(1, pt.life / pt.maxLife + 0.2);
        const s = pt.size * (0.5 + a * 0.5);
        const dx = pt.x - ex, dy = pt.y - ey, dz = pt.z - ez;
        const right = [Math.cos(pt.yaw || 0), 0, 0];
        // billboard using camera basis
        // view basis from state player yaw/pitch approx: use screen-space quad via cam right/up
        const cy = Math.cos(WC.state.player.yaw), sy = Math.sin(WC.state.player.yaw);
        const rx = cy, rz = sy; // camera right
        const ux = 0, uy = 1;   // up approx
        const b = verts.length / 7;
        const push = (ox, oy) => verts.push(pt.x + rx * ox + 0 * oy, pt.y + uy * oy, pt.z + rz * ox, pt.color[0], pt.color[1], pt.color[2], a);
        push(-s, -s); push(s, -s); push(s, s); push(-s, s);
      }
      if (!verts.length) return;
      gl.useProgram(this.simpleProg.p);
      gl.uniform1i(this.simpleProg.u.uUseTex, 0);
      gl.uniform1f(this.simpleProg.u.uAlphaMul, 1);
      M4.ident(this.tmpM);
      gl.uniformMatrix4fv(this.simpleProg.u.uModel, false, this.tmpM);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.depthMask(false);
      const vao = gl.createVertexArray();
      gl.bindVertexArray(vao);
      const vb = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, vb);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(verts), gl.DYNAMIC_DRAW);
      const stride = 7 * 4;
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, stride, 0);
      gl.disableVertexAttribArray(1);
      gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 4, gl.FLOAT, false, stride, 12);
      const nq = verts.length / 7;
      const idx = new Uint16Array(nq / 4 * 6);
      for (let q = 0; q < nq / 4; q++) {
        const o = q * 4, k = q * 6;
        idx[k] = o; idx[k + 1] = o + 1; idx[k + 2] = o + 2; idx[k + 3] = o; idx[k + 4] = o + 2; idx[k + 5] = o + 3;
      }
      const ib = gl.createBuffer();
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.DYNAMIC_DRAW);
      gl.drawElements(gl.TRIANGLES, idx.length, gl.UNSIGNED_SHORT, 0);
      gl.bindVertexArray(null);
      gl.deleteVertexArray(vao); gl.deleteBuffer(vb); gl.deleteBuffer(ib);
      gl.depthMask(true);
      gl.disable(gl.BLEND);
      // attribute 1 must be re-enabled for other passes; vertexAttribPointer state lives in VAO so fine
    }
  }

  WC.Particles = Particles;
  WC.Renderer = Renderer;
  WC.mat4 = M4;
})();
