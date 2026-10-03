// ============================================================
// Chunk World: chunk storage, lighting (sun + block light),
// meshing into render jobs, block access API, save/load.
// ============================================================
(function () {
  'use strict';
  const WC = window.WC;
  const CH = WC.CHUNK, WH = WC.SKY_H, Y_MIN = WC.Y_MIN;

  class DimWorld {
    constructor(dim, seed) {
      this.dim = dim;
      this.seed = seed;
      this.gen = WC.genForDim(dim, seed);
      this.chunks = new Map();       // "cx,cz" -> chunk
      this.meshes = new Set();       // chunks needing remesh
      this.lightQueue = [];
      this.edits = new Map();        // persistent player edits "x,y,z" -> id
      this.blockEntities = new Map(); // "x,y,z" -> {type, inv...}
    }
    key(cx, cz) { return cx + ',' + cz; }
    getChunk(cx, cz) { return this.chunks.get(this.key(cx, cz)); }
    ensureChunk(cx, cz) {
      const k = this.key(cx, cz);
      let c = this.chunks.get(k);
      if (!c) {
        c = this.gen.generateChunk(this, cx, cz);
        c.cx = cx; c.cz = cz;
        WC.computeSkyAndBlockLight(this, c);
        // apply saved edits
        for (const [ek, ev] of this.edits) {
          const p = ek.split(',');
          if ((+p[0]) >> 4 === cx && (+p[2]) >> 4 === cz) {
            c.data[WC.idxL(+p[0] & 15, +p[1], +p[2] & 15)] = ev;
          }
        }
        this.chunks.set(k, c);
        this.meshes.add(k);
        // neighbors need remesh at borders
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nk = this.key(cx + dx, cz + dz);
          if (this.chunks.has(nk)) this.meshes.add(nk);
        }
      }
      return c;
    }
    blockAt(wx, wy, wz) {
      if (wy < Y_MIN || wy >= WC.Y_MAX) return 0;
      const cx = wx >> 4, cz = wz >> 4;
      const c = this.getChunk(cx, cz);
      if (!c) return null; // unknown
      return c.data[WC.idxL(wx & 15, wy, wz & 15)];
    }
    setBlock(wx, wy, wz, id, metaVal) {
      if (wy < Y_MIN || wy >= WC.Y_MAX) return false;
      const cx = wx >> 4, cz = wz >> 4;
      const c = this.ensureChunk(cx, cz);
      const i = WC.idxL(wx & 15, wy, wz & 15);
      if (c.data[i] === id && (metaVal === undefined || c.meta[i] === metaVal)) return false;
      c.data[i] = id;
      if (metaVal !== undefined) c.meta[i] = metaVal;
      this.edits.set(wx + ',' + wy + ',' + wz, id);
      this.markDirty(wx, wy, wz);
      return true;
    }
    markDirty(wx, wy, wz) {
      const cx = wx >> 4, cz = wz >> 4;
      // relight affected chunk(s) so torches/breaks update immediately
      this.relight(cx, cz);
      if ((wx & 15) === 0) this.relight(cx - 1, cz);
      if ((wx & 15) === 15) this.relight(cx + 1, cz);
      if ((wz & 15) === 0) this.relight(cx, cz - 1);
      if ((wz & 15) === 15) this.relight(cx, cz + 1);
      this.meshes.add(this.key(cx, cz));
      const lx = wx & 15, lz = wz & 15;
      if (lx === 0) this.meshes.add(this.key(cx - 1, cz));
      if (lx === 15) this.meshes.add(this.key(cx + 1, cz));
      if (lz === 0) this.meshes.add(this.key(cx, cz - 1));
      if (lz === 15) this.meshes.add(this.key(cx, cz + 1));
    }
    relight(cx, cz) {
      const c = this.chunks.get(this.key(cx, cz));
      if (c) WC.computeSkyAndBlockLight(this, c);
    }
    metaAt(wx, wy, wz) {
      const cx = wx >> 4, cz = wz >> 4;
      const c = this.getChunk(cx, cz);
      if (!c) return 0;
      return c.meta[WC.idxL(wx & 15, wy, wz & 15)];
    }
  }
  WC.idxL = (x, y, z) => ((y - Y_MIN) * CH + z) * CH + x;
  WC.unidxY = (i) => Math.floor(i / (CH * CH)) + Y_MIN;

  // ---------- Lighting ----------
  // skyLight & blockLight per chunk as Uint8Array halves packed: byte = (sky<<4)|block
  function initLights(chunk) {
    if (!chunk.light) chunk.light = new Uint8Array(chunk.data.length);
  }
  WC.computeSkyAndBlockLight = function (world, chunk) {
    initLights(chunk);
    const L = chunk.light, D = chunk.data;
    L.fill(0);
    const isOpaqueId = (id) => { const d = WC.blockIds[id]; return d && d.opaque; };
    const isTransparentLiquid = (id) => { const d = WC.blockIds[id]; return d && (d.liquid || !d.opaque); };
    // sky column
    for (let z = 0; z < CH; z++) for (let x = 0; x < CH; x++) {
      let sl = 15;
      for (let y = WH - 1; y >= 0; y--) {
        const i = WC.idxL(x, y + Y_MIN, z);
        const id = D[i];
        if (isOpaqueId(id)) sl = 0;
        else if (WC.blockIds[id] && WC.blockIds[id].liquid) sl = Math.max(0, sl - 2);
        L[i] = sl << 4;
      }
    }
    // BFS block light sources within chunk + neighbor edges approximated via queue
    const queue = [];
    for (let z = 0; z < CH; z++) for (let x = 0; x < CH; x++) for (let y = 0; y < WH; y++) {
      const i = WC.idxL(x, y + Y_MIN, z);
      const d = WC.blockIds[D[i]];
      if (d && d.light > 0) { L[i] |= d.light; queue.push([x, y, z]); }
    }
    while (queue.length) {
      const [x, y, z] = queue.shift();
      const lv = L[WC.idxL(x, y + Y_MIN, z)] & 15;
      if (lv <= 1) continue;
      const nb = [[x+1,y,z],[x-1,y,z],[x,y+1,z],[x,y-1,z],[x,y,z+1],[x,y,z-1]];
      for (const [nx, ny, nz] of nb) {
        if (nx < 0 || nx >= CH || nz < 0 || nz >= CH || ny < 0 || ny >= WH) continue;
        const ni = WC.idxL(nx, ny + Y_MIN, nz);
        const id = D[ni];
        if (isOpaqueId(id)) continue;
        const attenuation = (WC.blockIds[id] && WC.blockIds[id].liquid) ? 3 : 1;
        const nlv = lv - attenuation;
        if (nlv > (L[ni] & 15)) { L[ni] = (L[ni] & 0xF0) | nlv; queue.push([nx, ny, nz]); }
      }
    }
  };

  // ---------- Meshing ----------
  // face dirs: order matches renderer: +X,-X,+Y,-Y,+Z,-Z
  const FACES = [
    { n: [1, 0, 0], verts: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]], uvs: [[0, 1], [0, 0], [1, 0], [1, 1]] },
    { n: [-1, 0, 0], verts: [[0, 0, 1], [0, 1, 1], [0, 1, 0], [0, 0, 0]], uvs: [[0, 1], [0, 0], [1, 0], [1, 1]] },
    { n: [0, 1, 0], verts: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], uvs: [[0, 1], [1, 1], [1, 0], [0, 0]] },
    { n: [0, -1, 0], verts: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], uvs: [[0, 0], [1, 0], [1, 1], [0, 1]] },
    { n: [0, 0, 1], verts: [[1, 0, 1], [1, 1, 1], [0, 1, 1], [0, 0, 1]], uvs: [[0, 1], [0, 0], [1, 0], [1, 1]] },
    { n: [0, 0, -1], verts: [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]], uvs: [[0, 1], [0, 0], [1, 0], [1, 1]] },
  ];
  WC.FACES = FACES;

  function shouldDrawFace(selfDef, nbDef) {
    if (!nbDef || nbDef.id === 0) return true;
    if (selfDef.render === 'glass' || selfDef.render === 'pane') return nbDef !== selfDef;
    if (!nbDef.opaque) return !(nbDef.name === selfDef.name && (selfDef.liquid || !selfDef.transparent));
    return false;
  }

  // geometry per special render type produces list of quads {pos:[x,y,z], uv, level}
  function quadsForBlock(def, meta, x, y, z, out) {
    const r = def.render;
    const dir = meta & 7;
    if (r === 'cube') {
      for (let f = 0; f < 6; f++) out.push({ f, x, y, z, h: 1 });
    } else if (r === 'slab' || r === 'slab_tall') {
      const hh = r === 'slab_tall' ? 0.9 : 0.5;
      const top = (meta & 8) ? 1 : 0;
      out.push({ box: [x, y + (top ? 1 - hh : 0), z, x + 1, y + (top ? 1 : hh), z + 1] });
    } else if (r === 'stairs') {
      const d = meta & 3;
      // lower half full depth on back side, upper half on one side
      let bx0 = x, bx1 = x + 1, bz0 = z, bz1 = z + 1;
      let ux0 = x, ux1 = x + 1, uz0 = z, uz1 = z + 1;
      if (d === 0) { bz1 = z + 0.5; uz0 = z + 0.5; }
      else if (d === 1) { bz0 = z + 0.5; uz1 = z + 0.5; }
      else if (d === 2) { bx1 = x + 0.5; ux0 = x + 0.5; }
      else { bx0 = x + 0.5; ux1 = x + 0.5; }
      out.push({ box: [bx0, y, bz0, bx1, y + 0.5, bz1] });
      out.push({ box: [ux0, y + 0.5, uz0, ux1, y + 1, uz1] });
    } else if (r === 'cross') {
      out.push({ cross: 1, x, y, z });
    } else if (r === 'torch') {
      out.push({ smallCube: [0.4, 0.6, 0, 1, 0.4, 0.6], x, y, z, texOverride: 'torch' });
    } else if (r === 'fence') {
      out.push({ post: true, x, y, z });
    } else if (r === 'pane' || r === 'ladder' || r === 'wire' || r === 'thin' || r === 'plate' || r === 'layer' || r === 'carpet') {
      out.push({ flat: r, x, y, z, dir });
    } else if (r === 'door' || r === 'trapdoor' || r === 'sign' || r === 'bed') {
      out.push({ cubeThin: r, x, y, z, dir, meta });
    } else if (r === 'liquid') {
      out.push({ box: [x, y, z, x + 1, y + 0.875, z + 1], liquid: true });
    } else {
      out.push({ f: 2, x, y, z, h: 1 });
    }
  }

  WC.buildMesh = function (world, chunk) {
    initLights(chunk);
    const pos = [], uv = [], norm = [], color = [], aoArr = [], liqArr = [], idxs = [];
    const tiles = WC.texTiles;
    const D = chunk.data, M = chunk.meta, LT = chunk.light;
    const wx0 = chunk.cx * CH, wz0 = chunk.cz * CH;
    const getB = (x, y, z) => {
      if (y < 0 || y >= WH) return 0;
      if (x >= 0 && x < CH && z >= 0 && z < CH) return D[WC.idxL(x, y, z)];
      const nc = world.getChunk((wx0 + x) >> 4, (wz0 + z) >> 4);
      if (!nc) return 0;
      return nc.data[WC.idxL((wx0 + x) & 15, y, (wz0 + z) & 15)];
    };
    const quadBuf = [];
    for (let y = 0; y < WH; y++) for (let z = 0; z < CH; z++) for (let x = 0; x < CH; x++) {
      const i = WC.idxL(x, y, z);
      const id = D[i];
      if (!id) continue;
      const def = WC.blockIds[id];
      if (!def || def.render === 'none') continue;
      quadBuf.length = 0;
      quadsForBlock(def, M[i], x, y + Y_MIN, z, quadBuf);
      for (const q of quadBuf) emitQuad(q, def, i);
    }
    function pushVert(px, py, pz, u, v, nx, ny, nz, br, liq = 0) {
      pos.push(px + wx0, py, pz + wz0);
      uv.push(u, v);
      norm.push(nx, ny, nz);
      color.push(br, br, br, 1);
      aoArr.push(br);
      liqArr.push(liq);
    }
    function emitQuad(q, def, ci) {
      const sky = (LT[ci] >> 4) & 15;
      const blk = LT[ci] & 15;
      let lightLv = world.dim === 'overworld' ? Math.max(sky, blk) : blk;
      if (world.dim === 'end') lightLv = Math.max(lightLv, 6);
      if (world.dim === 'nether') lightLv = Math.max(lightLv + 2, blk);
      const br = Math.min(1, 0.08 + 0.92 * Math.pow(lightLv / 15, 1.35));
      const texName = q.texOverride || WC.faceTex(def, q.f !== undefined ? q.f : 2, { dir: q.dir });
      // tileUVFull returns [U0, V0(bottom-left), U1, V1(top-right)] in atlas coords (V grows up)
      const [TU0, TV0, TU1, TV1] = tileUVFull(texName);
      const isLiq = def.liquid || q.liquid ? 1 : 0;
      if (q.box) { emitBox(q.box[0], q.box[1], q.box[2], q.box[3], q.box[4], q.box[5], texName, br, def, 0, 0, 0, isLiq); return; }
      if (q.cross) {
        // two diagonal quads
        const emitDiag = (dx1, dz1, dx2, dz2) => {
          const b = pos.length / 3;
          pushVert(q.x + dx1, q.y, q.z + dz1, TU0, TV0, 0.7, 0, 0.7, br);
          pushVert(q.x + dx2, q.y, q.z + dz2, TU1, TV0, 0.7, 0, 0.7, br);
          pushVert(q.x + dx2, q.y + 1, q.z + dz2, TU1, TV1, 0.7, 0, 0.7, br);
          pushVert(q.x + dx1, q.y + 1, q.z + dz1, TU0, TV1, 0.7, 0, 0.7, br);
          idxs.push(b, b + 1, b + 2, b, b + 2, b + 3);
          const b2 = pos.length / 3;
          pushVert(q.x + dx2, q.y, q.z + dz2, TU0, TV0, -0.7, 0, 0.7, br);
          pushVert(q.x + dx1, q.y, q.z + dz1, TU1, TV0, -0.7, 0, 0.7, br);
          pushVert(q.x + dx1, q.y + 1, q.z + dz1, TU1, TV1, -0.7, 0, 0.7, br);
          pushVert(q.x + dx2, q.y + 1, q.z + dz2, TU0, TV1, -0.7, 0, 0.7, br);
          idxs.push(b2, b2 + 1, b2 + 2, b2, b2 + 2, b2 + 3);
        };
        emitDiag(0.15, 0.15, 0.85, 0.85);
        emitDiag(0.85, 0.15, 0.15, 0.85);
        return;
      }
      if (q.smallCube) {
        const [x0, x1, y0, y1, z0, z1] = q.smallCube;
        emitBox(q.x + x0, q.y + y0, q.z + z0, q.x + x1, q.y + y1, q.z + z1, texName, br, def, q.x, q.y, q.z, 0);
        return;
      }
      if (q.post) {
        emitBox(q.x + 0.375, q.y, q.z + 0.375, q.x + 0.625, q.y + 1.5, q.z + 0.625, texName, br, def, q.x, q.y, q.z);
        return;
      }
      if (q.flat) {
        const kinds = { pane: 0.075, ladder: 0.1, wire: 0.02, thin: 0.125, plate: 0.06, layer: 0.25, carpet: 0.0625 };
        const th = kinds[q.flat] || 0.1;
        const d = q.dir % 4;
        let bx0 = q.x, bx1 = q.x + 1, bz0 = q.z, bz1 = q.z + 1, by0 = q.y, by1 = q.y + th;
        if (q.flat === 'wire' || q.flat === 'plate' || q.flat === 'carpet' || q.flat === 'layer') { /* horizontal */ }
        else if (d === 0) { bx0 = q.x + 1 - th; bz0 = q.z + 0.4; bz1 = q.z + 0.6; by1 = q.y + 1; }
        else if (d === 1) { bx1 = q.x + th; bz0 = q.z + 0.4; bz1 = q.z + 0.6; by1 = q.y + 1; }
        else if (d === 2) { bz1 = q.z + th; bx0 = q.x + 0.4; bx1 = q.x + 0.6; by1 = q.y + 1; }
        else { bz0 = q.z + 1 - th; bx0 = q.x + 0.4; bx1 = q.x + 0.6; by1 = q.y + 1; }
        emitBox(bx0, by0, bz0, bx1, by1, bz1, texName, br, def, q.x, q.y, q.z);
        return;
      }
      if (q.cubeThin) {
        const kind = q.cubeThin;
        if (kind === 'door') {
          const open = q.meta & 8;
          if (!open) emitBox(q.x + 0.375, q.y, q.z + 0.375, q.x + 0.625, q.y + 2, q.z + 0.625, texName, br, def, q.x, q.y, q.z);
          else {
            const d = q.dir % 4;
            if (d === 0) emitBox(q.x + 0.875, q.y, q.z + 0.375, q.x + 1, q.y + 2, q.z + 0.625, texName, br, def, q.x, q.y, q.z);
            else if (d === 1) emitBox(q.x, q.y, q.z + 0.375, q.x + 0.125, q.y + 2, q.z + 0.625, texName, br, def, q.x, q.y, q.z);
            else if (d === 2) emitBox(q.x + 0.375, q.y, q.z + 0.875, q.x + 0.625, q.y + 2, q.z + 1, texName, br, def, q.x, q.y, q.z);
            else emitBox(q.x + 0.375, q.y, q.z, q.x + 0.625, q.y + 2, q.z + 0.125, texName, br, def, q.x, q.y, q.z);
          }
        } else if (kind === 'bed') {
          emitBox(q.x + 0.1, q.y, q.z + 0.1, q.x + 0.9, q.y + 0.5625, q.z + 1.9, texName, br, def, q.x, q.y, q.z);
        } else if (kind === 'sign') {
          emitBox(q.x + 0.45, q.y, q.z + 0.45, q.x + 0.55, q.y + 0.7, q.z + 0.55, 'oak_planks', br, def, q.x, q.y, q.z);
          emitBox(q.x + 0.15, q.y + 0.7, q.z + 0.4, q.x + 0.85, q.y + 1.1, q.z + 0.6, texName, br, def, q.x, q.y, q.z);
        } else if (kind === 'trapdoor') {
          emitBox(q.x, q.y + (q.meta & 4 ? 0.875 : 0), q.z, q.x + 1, q.y + (q.meta & 4 ? 1 : 0.125), q.z + 1, texName, br, def, q.x, q.y, q.z);
        }
        return;
      }
      // standard face quad
      const face = FACES[q.f];
      if (!face) return;
      // neighbor visibility check
      const nb = getB(q.x + face.n[0], q.y - Y_MIN + face.n[1], q.z + face.n[2]);
      const nbDef = WC.blockIds[nb];
      if (def.render === 'cube' || def.render === 'slab' || def.render === 'stairs' || def.render === 'glass' || def.render === 'liquid') {
        if (nbDef && !shouldDrawFace(def, nbDef)) return;
      }
      const h = q.h !== undefined ? q.h : 1;
      const yy = q.y;
      // convert per-face normalized uvs into atlas tile coords
      const fu0 = TU0 + face.uvs[0][0] * (TU1 - TU0), fv0 = TV0 + face.uvs[0][1] * (TV1 - TV0);
      const fu1 = TU0 + face.uvs[1][0] * (TU1 - TU0), fv1 = TV0 + face.uvs[1][1] * (TV1 - TV0);
      const fu2 = TU0 + face.uvs[2][0] * (TU1 - TU0), fv2 = TV0 + face.uvs[2][1] * (TV1 - TV0);
      const fu3 = TU0 + face.uvs[3][0] * (TU1 - TU0), fv3 = TV0 + face.uvs[3][1] * (TV1 - TV0);
      const fuv = [[fu0, fv0], [fu1, fv1], [fu2, fv2], [fu3, fv3]];
      const vs = face.verts;
      const b = pos.length / 3;
      for (let vi = 0; vi < 4; vi++) {
        const vx = q.x + vs[vi][0], vy = yy + vs[vi][1] * h, vz = q.z + vs[vi][2];
        pushVert(vx, vy, vz, fuv[vi][0], fuv[vi][1], face.n[0], face.n[1], face.n[2], br, isLiq);
      }
      idxs.push(b, b + 1, b + 2, b, b + 2, b + 3);
    }
    function emitBox(bx0, by0, bz0, bx1, by1, bz1, texName, br, def, ox, oy, oz, liq = 0) {
      // q.x/q.y/q.z passed to emitBox are LOCAL chunk coords for x/z but WORLD y;
      // pushVert adds (wx0, 0, wz0), so subtract the world offset here.
      const x0 = bx0 - wx0, z0 = bz0 - wz0, x1 = bx1 - wx0, z1 = bz1 - wz0;
      const y0 = by0, y1 = by1;
      const facesList = [
        { n: [1, 0, 0], v: [[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]] },
        { n: [-1, 0, 0], v: [[x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [x0, y0, z0]] },
        { n: [0, 1, 0], v: [[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]] },
        { n: [0, -1, 0], v: [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]] },
        { n: [0, 0, 1], v: [[x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [x0, y0, z1]] },
        { n: [0, 0, -1], v: [[x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [x1, y0, z0]] },
      ];
      for (const fc of facesList) {
        const b = pos.length / 3;
        const uvs = [[0, 1], [0, 0], [1, 0], [1, 1]];
        const [U0, V0, U1, V1] = tileUVFull(texName);
        // uvs[vi] = [uFlag, vFlag]; (0,0)->tile bottom-left corner (U0,V0), (1,1)->top-right (U1,V1)
        for (let vi = 0; vi < 4; vi++) {
          const [uu, vv] = uvs[vi];
          pushVert(fc.v[vi][0], fc.v[vi][1], fc.v[vi][2], uu ? U1 : U0, vv ? V1 : V0, fc.n[0], fc.n[1], fc.n[2], br, liq);
        }
        idxs.push(b, b + 1, b + 2, b, b + 2, b + 3);
      }
    }
    function tileUVFull(texName) {
      const t = tiles[texName];
      if (!t) return [0, 0, 1, 1];
      const n = tiles.cols || Math.ceil(Math.sqrt(tiles.count || 512));
      const s = 1 / n;
      const pad = s * 0.004;
      return [t.col * s + pad, 1 - (t.row + 1) * s + pad, (t.col + 1) * s - pad, 1 - t.row * s - pad];
    }
    // Per-face UVs are converted to atlas coordinates inside each emit branch.
    return {
      position: new Float32Array(pos),
      uv: new Float32Array(uv),
      normal: new Float32Array(norm),
      light: new Float32Array(aoArr),
      liquid: new Uint8Array(liqArr),
      index: idxs.length < 65536 ? new Uint16Array(idxs) : new Uint32Array(idxs),
      count: idxs.length,
      has32: idxs.length >= 65536,
    };
  };

  WC.DimWorld = DimWorld;
})();
