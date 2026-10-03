// ============================================================
// WebCraft Core: namespaces, event bus, math utils, RNG,
// noise generation (perlin/simplex-like), NBT-lite storage.
// ============================================================
(function () {
  'use strict';
  const WC = (window.WC = window.WC || {});

  // ---------- Namespaces ----------
  WC.blocks   = {};          // block registry
  WC.items    = {};          // item registry
  WC.recipes  = [];          // crafting recipes
  WC.entities = {};          // entity classes
  WC.renderers= {};          // block/item renderers
  WC.mobs     = {};          // mob definitions
  WC.biomes   = {};          // biome definitions
  WC.mods     = {};          // addon hooks
  WC.data     = {};          // runtime data stores

  // ---------- Event bus ----------
  const listeners = {};
  WC.on = function (ev, fn) { (listeners[ev] = listeners[ev] || []).push(fn); };
  WC.off = function (ev, fn) { if (listeners[ev]) listeners[ev] = listeners[ev].filter(f => f !== fn); };
  WC.emit = function (ev, ...args) { (listeners[ev] || []).forEach(f => { try { f(...args); } catch (e) { console.error('evt', ev, e); } }); };

  // ---------- Math ----------
  WC.clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  WC.lerp = (a, b, t) => a + (b - a) * t;
  WC.smoothstep = t => t * t * (3 - 2 * t);
  WC.DIR = [
    { name: 'down',  dx: 0, dy: -1, dz: 0 },
    { name: 'up',    dx: 0, dy: 1,  dz: 0 },
    { name: 'north', dx: 0, dy: 0,  dz: -1 },
    { name: 'south', dx: 0, dy: 0,  dz: 1 },
    { name: 'west',  dx: -1, dy: 0, dz: 0 },
    { name: 'east',  dx: 1, dy: 0,  dz: 0 },
  ];
  WC.dirIndex = { down: 0, up: 1, north: 2, south: 3, west: 4, east: 5 };

  // Seeded PRNG (mulberry32)
  WC.rng = function (seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  WC.hashString = function (s) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  };

  // ---------- Value/Perlin noise ----------
  function fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
  class Noise2D {
    constructor(seed) { this.rand = WC.rng(seed); this.perm = new Uint8Array(512); this.grad = new Float32Array(256 * 2); this._init(); }
    _init() {
      const p = new Uint8Array(256);
      for (let i = 0; i < 256; i++) p[i] = i;
      for (let i = 255; i > 0; i--) { const j = (this.rand() * (i + 1)) | 0; const t = p[i]; p[i] = p[j]; p[j] = t; }
      for (let i = 0; i < 512; i++) this.perm[i] = p[i & 255];
      for (let i = 0; i < 256; i++) {
        const a = (this.rand() * Math.PI * 2);
        this.grad[i * 2] = Math.cos(a); this.grad[i * 2 + 1] = Math.sin(a);
      }
    }
    dot(gi, x, y) { return this.grad[gi * 2] * x + this.grad[gi * 2 + 1] * y; }
    noise(x, y) {
      const X = Math.floor(x) & 255, Y = Math.floor(y) & 255;
      const xf = x - Math.floor(x), yf = y - Math.floor(y);
      const u = fade(xf), v = fade(yf);
      const p = this.perm;
      const aa = p[p[X] + Y], ab = p[p[X] + Y + 1], ba = p[p[X + 1] + Y], bb = p[p[X + 1] + Y + 1];
      const x1 = WC.lerp(this.dot(aa & 255, xf, yf), this.dot(ba & 255, xf - 1, yf), u);
      const x2 = WC.lerp(this.dot(ab & 255, xf, yf - 1), this.dot(bb & 255, xf - 1, yf - 1), u);
      return WC.lerp(x1, x2, v); // ~[-1,1]
    }
    fbm(x, y, oct = 4, lac = 2, gain = 0.5) {
      let amp = 1, freq = 1, sum = 0, norm = 0;
      for (let i = 0; i < oct; i++) { sum += amp * this.noise(x * freq, y * freq); norm += amp; amp *= gain; freq *= lac; }
      return sum / norm;
    }
  }
  class Noise3D {
    constructor(seed) { this.n1 = new Noise2D(seed); this.n2 = new Noise2D(seed ^ 0x9E3779B9); }
    noise(x, y, z) { return (this.n1.noise(x + z * 0.37, y - z * 0.71) + this.n2.noise(x - z * 0.53, y + z * 0.29)) * 0.5; }
    fbm(x, y, z, oct = 3) {
      let amp = 1, freq = 1, sum = 0, norm = 0;
      for (let i = 0; i < oct; i++) { sum += amp * this.noise(x * freq, y * freq, z * freq); norm += amp; amp *= 0.5; freq *= 2; }
      return sum / norm;
    }
  }
  WC.Noise2D = Noise2D; WC.Noise3D = Noise3D;

  // ---------- Block position helpers ----------
  WC.posKey = (x, y, z) => `${x},${y},${z}`;
  WC.chunkKey = (cx, cz) => `${cx},${cz}`;
  WC.blockIn = (pos, min, max) => pos.x >= min.x && pos.y >= min.y && pos.z >= min.z && pos.x <= max.x && pos.y <= max.y && pos.z <= max.z;

  // ---------- Simple JSON storage ----------
  WC.saveJSON = function (key, obj) {
    try { localStorage.setItem('webcraft:' + key, JSON.stringify(obj)); return true; }
    catch (e) { console.warn('save failed', e); return false; }
  };
  WC.loadJSON = function (key) {
    try { const s = localStorage.getItem('webcraft:' + key); return s ? JSON.parse(s) : null; }
    catch (e) { return null; }
  };
  WC.delJSON = function (key) { try { localStorage.removeItem('webcraft:' + key); } catch (e) {} };

  // ---------- Utilities ----------
  WC.uuid = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0; const v = c === 'x' ? r : (r & 0x3 | 0x8); return v.toString(16);
  });
  WC.dist2 = (ax, ay, az, bx, by, bz) => { const dx = ax - bx, dy = ay - by, dz = az - bz; return dx * dx + dy * dy + dz * dz; };
  WC.aabb = function (minX, minY, minZ, maxX, maxY, maxZ) { return { minX, minY, minZ, maxX, maxY, maxZ }; };
  WC.aabbOverlap = (a, b) => a.minX < b.maxX && a.maxX > b.minX && a.minY < b.maxY && a.maxY > b.minY && a.minZ < b.maxZ && a.maxZ > b.minZ;

  // Tick scheduler
  WC.schedule = { queue: [], add(delayTicks, fn, ...args) { this.queue.push({ at: WC.ticks + delayTicks, fn, args }); } };
  WC.ticks = 0;
})();
