// ============================================================
// Noise & terrain generation: infinite-ish world (chunks),
// biomes, caves, ores, structures (villages, temples, ruins,
// strongholds with End portal, desert/ocean features),
// Nether (2nd dimension) and End (3rd dimension).
// World size: 4M x 4M blocks per dimension like MC.
// ============================================================
(function () {
  'use strict';
  const WC = window.WC;

  // ---------- Perlin/Simplex style noise ----------
  function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  class Noise {
    constructor(seed) {
      this.seed = seed >>> 0;
      const rnd = mulberry32(this.seed);
      this.p = new Uint8Array(512);
      const perm = Array.from({ length: 256 }, (_, i) => i);
      for (let i = 255; i > 0; i--) { const j = (rnd() * (i + 1)) | 0; [perm[i], perm[j]] = [perm[j], perm[i]]; }
      for (let i = 0; i < 512; i++) this.p[i] = perm[i & 255];
      this.rnd = rnd;
    }
    fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
    lerp(a, b, t) { return a + t * (b - a); }
    grad(h, x, y) {
      switch (h & 3) { case 0: return x + y; case 1: return -x + y; case 2: return x - y; default: return -x - y; }
    }
    grad3(h, x, y, z) {
      const g = h & 15;
      const u = g < 8 ? x : y;
      const v = g < 4 ? y : (g === 12 || g === 14 ? x : z);
      return ((g & 1) ? -u : u) + ((g & 2) ? -v : v);
    }
    noise2(x, y) {
      const X = Math.floor(x) & 255, Y = Math.floor(y) & 255;
      x -= Math.floor(x); y -= Math.floor(y);
      const u = this.fade(x), v = this.fade(y);
      const p = this.p;
      const aa = p[p[X] + Y], ab = p[p[X] + Y + 1], ba = p[p[X + 1] + Y], bb = p[p[X + 1] + Y + 1];
      return this.lerp(
        this.lerp(this.grad(aa, x, y), this.grad(ba, x - 1, y), u),
        this.lerp(this.grad(ab, x, y - 1), this.grad(bb, x - 1, y - 1), u), v);
    }
    noise3(x, y, z) {
      const X = Math.floor(x) & 255, Y = Math.floor(y) & 255, Z = Math.floor(z) & 255;
      x -= Math.floor(x); y -= Math.floor(y); z -= Math.floor(z);
      const u = this.fade(x), v = this.fade(y), w = this.fade(z);
      const p = this.p;
      const A = p[X] + Y, AA = p[A] + Z, AB = p[A + 1] + Z, B = p[X + 1] + Y, BA = p[B] + Z, BB = p[B + 1] + Z;
      return this.lerp(this.lerp(
        this.lerp(this.grad3(p[AA], x, y, z), this.grad3(p[BA], x - 1, y, z), u),
        this.lerp(this.grad3(p[AB], x, y - 1, z), this.grad3(p[BB], x - 1, y - 1, z), u), v),
        this.lerp(
          this.lerp(this.grad3(p[AA + 1], x, y, z - 1), this.grad3(p[BA + 1], x - 1, y, z - 1), u),
          this.lerp(this.grad3(p[AB + 1], x, y - 1, z - 1), this.grad3(p[BB + 1], x - 1, y - 1, z - 1), u), v), w);
    }
    fbm2(x, y, oct = 4, lac = 2, gain = 0.5) {
      let f = 1, amp = 1, sum = 0, norm = 0;
      for (let i = 0; i < oct; i++) { sum += amp * this.noise2(x * f, y * f); norm += amp; f *= lac; amp *= gain; }
      return sum / norm;
    }
    ridged(x, y, oct = 4) {
      let f = 1, amp = 1, sum = 0, norm = 0;
      for (let i = 0; i < oct; i++) { const n = 1 - Math.abs(this.noise2(x * f, y * f)); sum += amp * n * n; norm += amp; f *= lac2(i); amp *= 0.5; }
      function lac2(i) { return Math.pow(2, i + 1) / Math.pow(2, i); }
      return sum / norm;
    }
  }
  WC.Noise = Noise;

  // ---------- Biome system ----------
  // Each biome: temperature, humidity, height bias, surface block, features
  const BIOMES = {
    plains:           { temp: 0.8, hum: 0.4, hBase: 64, hVar: 4,  surface: 'grass_block', under: 'dirt', trees: 0.004, flowers: 0.02, mobs: ['cow', 'sheep', 'pig', 'horse', 'enderman'], color: [140, 180, 90] },
    forest:           { temp: 0.7, hum: 0.7, hBase: 66, hVar: 6,  surface: 'grass_block', under: 'dirt', trees: 0.05, mobs: ['wolf', 'deer_wolf', 'fox', 'rabbit', 'bat', 'spider'], color: [90, 140, 70] },
    birch_forest:     { temp: 0.6, hum: 0.6, hBase: 65, hVar: 5,  surface: 'grass_block', under: 'dirt', trees: 0.045, wood: 'birch', mobs: ['wolf', 'fox', 'rabbit', 'deer_wolf'], color: [120, 160, 90] },
    dark_forest:      { temp: 0.7, hum: 0.8, hBase: 66, hVar: 6,  surface: 'grass_block', under: 'dirt', trees: 0.08, wood: 'dark_oak', mushrooms: true, mobs: ['bat', 'mushroom_cow', 'spider', 'witch'], color: [60, 100, 50] },
    jungle:           { temp: 0.95, hum: 0.9, hBase: 68, hVar: 8, surface: 'grass_block', under: 'dirt', trees: 0.09, wood: 'jungle', melons: true, bamboo: true, mobs: ['ocelot', 'parrot', 'panda', 'monkey'], color: [80, 150, 60] },
    sparse_jungle:    { temp: 0.9, hum: 0.8, hBase: 67, hVar: 7, surface: 'grass_block', under: 'dirt', trees: 0.03, wood: 'jungle', mobs: ['ocelot', 'parrot'], color: [100, 160, 70] },
    taiga:            { temp: 0.3, hum: 0.6, hBase: 66, hVar: 6, surface: 'grass_block', under: 'dirt', trees: 0.05, wood: 'spruce', podzol: true, mobs: ['wolf', 'fox', 'rabbit', 'deer_wolf'], color: [80, 120, 80] },
    snow_taiga:       { temp: 0.05, hum: 0.5, hBase: 66, hVar: 6, surface: 'snow_block', under: 'dirt', trees: 0.04, wood: 'spruce', mobs: ['rabbit', 'fox', 'wolf', 'polar_bear'], color: [200, 220, 230] },
    tundra:           { temp: -0.4, hum: 0.3, hBase: 64, hVar: 4, surface: 'snow_block', under: 'dirt', frozenOcean: true, trees: 0, mobs: ['polar_bear', 'rabbit', 'stray_spawn'], color: [225, 235, 245] },
    ice_plains:       { temp: -0.5, hum: 0.25, hBase: 64, hVar: 3, surface: 'ice_sheet', under: 'dirt', trees: 0, mobs: ['polar_bear', 'rabbit'], color: [230, 240, 250] },
    desert:           { temp: 1.0, hum: 0.05, hBase: 64, hVar: 4, surface: 'sand', under: 'sandstone_like', dunes: true, trees: 0, mobs: ['rabbit', 'snake_desert', 'husk'], color: [218, 200, 130] },
    savanna:          { temp: 0.9, hum: 0.25, hBase: 65, hVar: 5, surface: 'grass_block', under: 'dirt', trees: 0.008, wood: 'acacia', mobs: ['horse', 'donkey', 'llama', 'pig'], color: [170, 170, 80] },
    badlands:         { temp: 1.0, hum: 0.1, hBase: 70, hVar: 14, surface: 'terracotta', under: 'terracotta', redLayer: true, trees: 0, mobs: ['snake_desert', 'mule', 'bone_spider'], color: [190, 120, 70] },
    swamp:            { temp: 0.8, hum: 0.9, hBase: 62, hVar: 2, surface: 'grass_block', under: 'dirt', water: 0.55, trees: 0.02, wood: 'oak', vines: true, lily: true, mobs: ['frog', 'cat', 'slime', 'allay'], color: [90, 120, 70] },
    mangrove_swamp:   { temp: 0.8, hum: 0.9, hBase: 62, hVar: 2, surface: 'mud', under: 'mud', water: 0.5, trees: 0.05, wood: 'mangrove', mobs: ['frog', 'sniffer', 'allay'], color: [100, 120, 80] },
    meadow:           { temp: 0.5, hum: 0.7, hBase: 72, hVar: 6, surface: 'grass_block', under: 'dirt', trees: 0.002, flowers: 0.06, mobs: ['sheep', 'cow', 'horse', 'donkey'], color: [120, 180, 100] },
    cherry_grove:     { temp: 0.6, hum: 0.6, hBase: 68, hVar: 6, surface: 'grass_block', under: 'dirt', trees: 0.03, wood: 'cherry', pinkSnow: true, mobs: ['sheep', 'pig', 'cat'], color: [230, 180, 190] },
    forest_hills:     { temp: 0.65, hum: 0.65, hBase: 78, hVar: 18, surface: 'grass_block', under: 'dirt', trees: 0.04, mobs: ['wolf', 'fox', 'goat', 'rabbit'], color: [95, 145, 75] },
    mountains:        { temp: 0.2, hum: 0.4, hBase: 95, hVar: 45, surface: 'stone', under: 'stone', trees: 0, mobs: ['goat', 'llama', 'silverfish'], snowy: true, color: [150, 150, 155] },
    jagged_peaks:     { temp: 0.0, hum: 0.3, hBase: 120, hVar: 60, surface: 'stone', under: 'stone', trees: 0, mobs: ['goat', 'silverfish'], snowy: true, color: [170, 170, 175] },
    stony_peaks:      { temp: 0.3, hum: 0.3, hBase: 110, hVar: 50, surface: 'stone', under: 'stone', trees: 0, mobs: ['goat', 'silverfish'], color: [140, 140, 145] },
    beach:            { temp: 0.7, hum: 0.5, hBase: 62, hVar: 2, surface: 'sand', under: 'sand', trees: 0, mobs: ['turtle_beach', 'crab'], color: [214, 200, 150] },
    river:            { temp: 0.6, hum: 0.6, hBase: 58, hVar: 2, surface: 'gravel', under: 'dirt', water: 0.9, trees: 0, mobs: ['salmon_mob', 'cod_mob', 'dolphin'], color: [110, 140, 180] },
    ocean:            { temp: 0.5, hum: 0.9, hBase: 45, hVar: 12, surface: 'gravel_ocean', under: 'gravel_ocean', water: 1, trees: 0, kelp: true, coral: true, mobs: ['dolphin', 'turtle_beach', 'squid_mob', 'cod_mob', 'salmon_mob', 'guardian', 'heartless_shipwreck'], color: [60, 100, 180] },
    deep_ocean:       { temp: 0.4, hum: 0.9, hBase: 30, hVar: 10, surface: 'gravel_ocean', under: 'gravel_ocean', water: 1, trees: 0, kelp: true, mobs: ['squid_mob', 'glow_squid', 'drowned', 'guardian'], color: [40, 70, 150] },
    warm_ocean:       { temp: 0.9, hum: 0.9, hBase: 50, hVar: 8, surface: 'sand', under: 'sandstone_like', water: 1, trees: 0, coral: true, mobs: ['tropical_fish_mob', 'dolphin', 'turtle_beach'], color: [70, 150, 200] },
    lukewarm_ocean:   { temp: 0.7, hum: 0.9, hBase: 48, hVar: 8, surface: 'sand', under: 'sandstone_like', water: 1, trees: 0, coral: true, mobs: ['tropical_fish_mob', 'dolphin', 'squid_mob'], color: [60, 130, 190] },
    cold_ocean:       { temp: 0.1, hum: 0.9, hBase: 48, hVar: 8, surface: 'gravel_ocean', under: 'gravel_ocean', water: 1, trees: 0, frozen: true, mobs: ['cod_mob', 'dolphin', 'polar_bear'], color: [80, 130, 190] },
    mushroom_island:  { temp: 0.9, hum: 0.9, hBase: 68, hVar: 6, surface: 'mycelium', under: 'dirt', trees: 0, mushrooms: true, mobs: ['moobloom', 'mushroom_cow'], color: [150, 120, 140] },
    bamboo_jungle:    { temp: 0.9, hum: 0.9, hBase: 66, hVar: 6, surface: 'grass_block', under: 'dirt', trees: 0.02, wood: 'bamboo', bamboo: true, mobs: ['panda'], color: [110, 150, 70] },
    end_highlands:    { temp: 0.5, hum: 0.5, hBase: 60, hVar: 8, surface: 'end_stone', under: 'end_stone', trees: 0, chorus: true, mobs: ['shulker', 'enderman'], color: [220, 220, 160] },
  };
  WC.BIOMES = BIOMES;

  // missing helper blocks used by biomes -> register quick defs if absent
  (function ensureBlocks() {
    const B = WC.blocks;
    function alias(name, src) { if (!B[name]) { const d = JSON.parse(JSON.stringify(B[src])); d.name = name; d.id = ++WC._blockIdCounter; B[name] = d; WC.blockIds[d.id] = d; WC.blockByName[name] = d; } }
    WC._blockIdCounter = WC._blockIdCounter || Object.keys(B).length;
    alias('sandstone_like', 'sand');
    alias('gravel_ocean', 'gravel');
    alias('ice_sheet', 'ice');
    alias('bamboo_planks', 'oak_planks');
    alias('bamboo_log', 'oak_log');
    alias('bamboo_slab', 'oak_slab');
    alias('bamboo_stairs', 'oak_stairs');
    alias('bamboo_fence', 'oak_fence');
    alias('bamboo_door', 'oak_door');
    alias('bamboo_trapdoor', 'oak_trapdoor');
    alias('bamboo_sign', 'oak_sign');
    alias('bamboo_button', 'oak_button');
    alias('bamboo_pressure_plate', 'oak_pressure_plate');
    alias('bamboo_sapling', 'oak_sapling');
    alias('campfire', 'glowstone');
    alias('soul_campfire', 'shroomlight');
    alias('rose_bush', 'poppy');
    alias('peony', 'poppy');
    alias('lilac', 'poppy');
  })();

  // ---------- Chunk model ----------
  WC.CHUNK = 16;
  WC.SKY_H = 320;   // build height like modern MC (min -64 handled via offset)
  WC.Y_MIN = -64;
  WC.Y_MAX = 320;
  const CH = WC.CHUNK, WH = WC.Y_MAX - WC.Y_MIN;

  // ---------- Dimension generators ----------
  class OverworldGen {
    constructor(seed) {
      this.dim = 'overworld';
      this.nHeight = new Noise(seed);
      this.nBiomeT = new Noise(seed ^ 0x9e3779b9);
      this.nBiomeH = new Noise(seed ^ 0x85ebca6b);
      this.nBiomeF = new Noise(seed ^ 0xc2b2ae35);
      this.nCont = new Noise(seed ^ 0x27d4eb2f1);
      this.nRidge = new Noise(seed ^ 0x165667b1);
      this.nCave1 = new Noise(seed ^ 0xd3a2646c);
      this.nCave2 = new Noise(seed ^ 0xfd7046c5);
      this.nCave3 = new Noise(seed ^ 0xb55a4f09);
      this.nOre = new Noise(seed ^ 0x2a1b3d);
      this.structures = new StructurePlacer(seed);
    }
    biomeAt(wx, wz) {
      const cont = this.nCont.fbm2(wx / 6000, wz / 6000, 4);
      const t = this.nBiomeT.fbm2(wx / 900, wz / 900, 3);
      const h = this.nBiomeH.fbm2(wx / 1100, wz / 1100, 3);
      const f = this.nBiomeF.fbm2(wx / 700, wz / 700, 2);
      return pickBiome(cont, t, h, f);
    }
    heightAt(wx, wz, biome) {
      const base = biome.hBase;
      const rolling = this.nHeight.fbm2(wx / 300, wz / 300, 4) * 10;
      const detail = this.nHeight.noise2(wx / 60, wz / 60) * 3;
      let hill = this.nHeight.fbm2(wx / 1200, wz / 1200, 3) * biome.hVar;
      let mtn = 0;
      if (biome.name === 'mountains' || biome.name === 'jagged_peaks' || biome.name === 'stony_peaks') {
        mtn = this.nRidge.ridged(wx / 800, wz / 800, 4) * (base - 55) * 1.6;
      }
      // rivers carve down
      const rv = Math.abs(this.nHeight.fbm2(wx / 1500, wz / 1500, 2));
      let riverCut = 0;
      if (rv < 0.03 && !biome.water) riverCut = (0.03 - rv) * 260;
      let hh = base + rolling + detail + hill + mtn - riverCut;
      if (biome.water) {
        hh = base + this.nHeight.fbm2(wx / 400, wz / 400, 3) * biome.hVar * 0.5;
      }
      return Math.max(WC.Y_MIN + 5, Math.min(WC.Y_MAX - 40, hh | 0));
    }
    generateChunk(world, cx, cz) {
      const data = new Uint16Array(CH * WH * CH);
      const meta = new Uint8Array(CH * WH * CH);
      const lights = new Uint8Array(CH * WH * CH);
      const biomeMap = new Int16Array(CH * CH);
      const idx = (x, y, z) => ((y + (-WC.Y_MIN)) * CH + z) * CH + x;
      const heights = new Int16Array(CH * CH);
      // pass 1: heights & biomes
      for (let lz = 0; lz < CH; lz++) for (let lx = 0; lx < CH; lx++) {
        const wx = cx * CH + lx, wz = cz * CH + lz;
        const bn = this.biomeAt(wx, wz);
        const biome = BIOMES[bn];
        biomeMap[lz * CH + lx] = bn;
        const h = this.heightAt(wx, wz, biome);
        heights[lz * CH + lx] = h;
      }
      const seaLevel = 63;
      // pass 2: columns
      for (let lz = 0; lz < CH; lz++) for (let lx = 0; lx < CH; lx++) {
        const wx = cx * CH + lx, wz = cz * CH + lz;
        const bn = biomeMap[lz * CH + lx];
        const biome = BIOMES[bn];
        const h = heights[lz * CH + lx];
        for (let y = WC.Y_MIN; y <= WC.Y_MAX - 1; y++) {
          const i = idx(lx, y, lz);
          let id = 0;
          if (y <= WC.Y_MIN + 1) id = WC.blockId('bedrock');
          else if (y < WC.Y_MIN + 4 && this.nOre.noise2(wx + y * 31, wz - y * 17) > 0.3) id = WC.blockId('bedrock');
          else if (y > h) {
            if (y <= seaLevel && biome.water) id = WC.blockId('water');
            else if (y <= seaLevel && (biome.name === 'river')) id = WC.blockId('water');
          } else {
            const depth = h - y;
            if (depth === 0) {
              let surf = biome.surface;
              if (surf === 'ice_sheet') { id = WC.blockId('ice'); }
              else if (surf === 'gravel_ocean') id = WC.blockId('gravel');
              else if (surf === 'terracotta' && biome.redLayer) {
                const band = ((y / 8) | 0) % 4;
                id = WC.blockId(['terracotta', 'terracotta_orange', 'terracotta_white', 'terracotta'][band]);
              } else id = WC.blockId(surf);
              // beaches next to water
              if (h <= seaLevel + 1 && !biome.water && (surf === 'grass_block')) id = WC.blockId('sand');
              if (biome.frozen && h <= seaLevel + 1) id = WC.blockId('snow_block');
            } else if (depth <= 4) id = WC.blockId(biome.under === 'terracotta' ? 'terracotta' : (biome.under === 'sandstone_like' ? 'sandstone_like' : biome.under));
            else if (depth <= 6 + ((this.nOre.noise2(wx * 3, wz * 3) + 1) * 2 | 0)) id = WC.blockId(biome.redLayer ? 'terracotta' : (h > 90 ? 'stone' : 'stone'));
            else if (y < 0) id = WC.blockId(Math.random() < 0.12 ? 'deepslate' : 'stone');
            else id = WC.blockId('stone');
            // ore veins
            if (id === WC.blockId('stone') || id === WC.blockId('deepslate')) {
              const deep = id === WC.blockId('deepslate');
              const r = pseudoRand(wx, y, wz);
              const veinNoise = this.nOre.noise3(wx / 12, y / 12, wz / 12);
              const vn2 = this.nOre.noise3((wx + 500) / 9, y / 9, (wz - 300) / 9);
              if (veinNoise > 0.82 && y < 72) id = WC.blockId(deep ? 'coal_ore'.replace('coal', 'deepslate_coal') : 'coal_ore');
              else if (vn2 > 0.86 && y < 56 && y > 5) id = WC.blockId(deep ? 'deepslate_iron_ore' : 'iron_ore');
              else if (veinNoise > 0.88 && y < 32 && y > -7) id = WC.blockId(deep ? 'deepslate_copper_ore' : 'copper_ore');
              else if (vn2 > 0.9 && y < 32) id = WC.blockId(deep ? 'deepslate_gold_ore' : 'gold_ore');
              else if (r < 0.0009 && y < 16) id = WC.blockId(deep ? 'deepslate_diamond_ore' : 'diamond_ore');
              else if (r < 0.0012 && y < 30 && y > 0) id = WC.blockId(deep ? 'deepslate_lapis_ore' : 'lapis_ore');
              else if (veinNoise > 0.87 && y < 16) id = WC.blockId(deep ? 'deepslate_redstone_ore' : 'redstone_ore');
              else if (r < 0.0006 && y > 4 && y < 30 && biome.hBase >= 80) id = WC.blockId(deep ? 'deepslate_emerald_ore' : 'emerald_ore');
            }
          }
          data[i] = id;
        }
        // caves (carve after fill)
        for (let y = WC.Y_MIN + 3; y < h - 1; y++) {
          const c1 = this.nCave1.noise3(wx / 90, y / 45, wz / 90);
          const c2 = this.nCave2.noise3((wx + 900) / 110, y / 60, (wz - 700) / 110);
          const worm = Math.abs(c1) < 0.055 && Math.abs(c2) < 0.055;
          const cheese = this.nCave3.noise3(wx / 60, y / 60, wz / 60) > 0.62 && y < 30;
          // ravines
          const rav = Math.abs(this.nCave3.noise2(wx / 220, wz / 220)) < 0.012 && y > WC.Y_MIN + 8 && y < h - 4;
          if (worm || cheese || rav) {
            const i = idx(lx, y, lz);
            if (data[i] !== 0 && data[i] !== WC.blockId('bedrock')) {
              data[i] = y < 10 && Math.random() < 0.25 ? WC.blockId('lava') : WC.blockId('air');
            }
          }
        }
      }
      // pass 3: surface decoration (trees, plants, structures)
      const rng = mulberry32((cx * 73856093) ^ (cz * 19349663) ^ this.seedMix());
      for (let lz = 0; lz < CH; lz++) for (let lx = 0; lx < CH; lx++) {
        const wx = cx * CH + lx, wz = cz * CH + lz;
        const bn = biomeMap[lz * CH + lx];
        const biome = BIOMES[bn];
        const h = heights[lz * CH + lx];
        const above = h + 1;
        if (above >= WC.Y_MAX - 12) continue;
        const ground = data[idx(lx, h, lz)];
        const isGrass = ground === WC.blockId('grass_block') || ground === WC.blockId('podzol') || ground === WC.blockId('mycelium');
        const isSand = ground === WC.blockId('sand');
        const isSnowG = ground === WC.blockId('snow_block');
        const waterTop = data[idx(lx, h, lz)] === WC.blockId('water');
        if (waterTop && biome.kelp && rng() < 0.15) { placePlant(data, idx, lx, h, lz, 'kelp_plant', 2 + ((rng() * 3) | 0)); }
        if (waterTop && biome.coral && rng() < 0.08) { data[idx(lx, h - 1, lz)] = WC.blockId('coral'); }
        if (isGrass) {
          const r = rng();
          if (biome.trees && r < biome.trees && canPlaceTree(heights, lx, lz, h)) {
            placeTree(data, meta, idx, lx, h, lz, biome.wood || (bn.includes('taiga') ? 'spruce' : bn === 'jungle' ? 'jungle' : bn === 'desert' ? 'oak' : 'oak'), rng, biome);
          } else if (biome.bamboo && r < 0.25) placePlant(data, idx, lx, above, lz, 'bamboo_block', 2 + ((rng() * 3) | 0));
          else if (biome.flowers && r < biome.flowers) {
            const fl = ['poppy', 'dandelion', 'cornflower', 'oxeye_daisy', 'allium', 'azure_bluet', 'red_tulip', 'orange_tulip', 'white_tulip', 'pink_tulip', 'lily_of_valley'][ (rng() * 11) | 0 ];
            data[idx(lx, above, lz)] = WC.blockId(fl);
          } else if (r < 0.12) data[idx(lx, above, lz)] = WC.blockId(rng() < 0.5 ? 'grass' : 'fern');
          else if (biome.mushrooms && r < 0.01) data[idx(lx, above, lz)] = WC.blockId(rng() < 0.5 ? 'brown_mushroom' : 'red_mushroom');
          else if (biome.vines && r < 0.03) data[idx(lx, above, lz)] = WC.blockId('vine');
          else if (biome.lily && waterTop && r < 0.1) data[idx(lx, above, lz)] = WC.blockId('seagrass');
          else if (bn === 'cherry_grove' && r < 0.05) data[idx(lx, above, lz)] = WC.blockId('pink_petals_block');
        }
        if (isSand && biome.dunes && rng() < 0.004) { /* dune shape already from noise */ }
        if (isSand && rng() < 0.008) placeCactus(data, idx, lx, above, lz, 1 + ((rng() * 3) | 0));
        if (isSand && biome.melons && rng() < 0.004) data[idx(lx, above, lz)] = WC.blockId('melon');
        if (isSnowG && rng() < 0.002) { data[idx(lx, above, lz)] = WC.blockId('spruce_sapling'); }
      }
      // structures
      this.structures.place(world, data, meta, idx, biomeMap, heights, cx, cz);
      return { data, meta, lights, biomeMap, heights, dirty: true };
    }
    seedMix() { return this.nHeight.seed; }
  }

  function pseudoRand(x, y, z) {
    let h = (x * 374761393 + y * 668265263 + z * 2147483647) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }

  function pickBiome(cont, t, h, f) {
    // continent check
    if (cont < -0.28) {
      if (t < -0.2) return 'cold_ocean';
      if (t > 0.6) return 'warm_ocean';
      if (t > 0.3) return 'lukewarm_ocean';
      if (cont < -0.55) return 'deep_ocean';
      return 'ocean';
    }
    if (cont < -0.12) return 'beach';
    // land
    if (t < -0.45) return 'ice_plains';
    if (t < -0.15) return h > 0.2 ? 'snow_taiga' : 'tundra';
    if (t < 0.15) return h > 0.1 ? 'taiga' : 'forest';
    if (t < 0.45) {
      if (h > 0.45) return 'mountains';
      if (h < -0.45) return 'river';
      if (f > 0.4) return 'birch_forest';
      if (f < -0.4) return 'plains';
      return 'forest_hills';
    }
    if (t < 0.7) {
      if (h > 0.5) return 'jagged_peaks';
      if (h < -0.45) return 'river';
      if (f > 0.5) return 'dark_forest';
      if (f > 0.0) return 'forest';
      if (f < -0.5) return 'swamp';
      return 'plains';
    }
    // hot
    if (h < -0.5) return 'river';
    if (f > 0.55) return 'jungle';
    if (f > 0.2) return 'sparse_jungle';
    if (f < -0.45) return 'desert';
    if (f < -0.15) return 'badlands';
    return 'savanna';
  }
  // rare overrides
  const origPick = pickBiome;
  function pickBiomeSafe(cont, t, h, f) {
    const n = pseudoRand(((t * 1000) | 0), ((h * 1000) | 0), ((f * 1000) | 0));
    if (n < 0.004) return 'cherry_grove';
    if (n > 0.996) return 'mushroom_island';
    if (n > 0.99 && t > 0.4 && h > 0.3) return 'meadow';
    if (n < 0.012 && t > 0.6 && f > 0.3) return 'bamboo_jungle';
    if (n > 0.988 && t > 0.5 && f < -0.3) return 'mangrove_swamp';
    return origPick(cont, t, h, f);
  }
  pickBiome = pickBiomeSafe;

  function canPlaceTree(heights, lx, lz, h) {
    if (lx < 2 || lz < 2 || lx > CH - 3 || lz > CH - 3) return true; // edge handled loosely
    return true;
  }
  function setBlock(data, idx, lx, y, lz, name) {
    if (y < WC.Y_MIN || y >= WC.Y_MAX) return;
    if (lx < 0 || lz < 0 || lx >= CH || lz >= CH) return;
    data[idx(lx, y, lz)] = WC.blockId(name);
  }
  function getBlockData(data, idx, lx, y, lz) {
    if (y < WC.Y_MIN || y >= WC.Y_MAX || lx < 0 || lz < 0 || lx >= CH || lz >= CH) return 0;
    return data[idx(lx, y, lz)];
  }
  function placeTree(data, meta, idx, lx, h, lz, wood, rng, biome) {
    const trunkH = wood === 'spruce' ? 5 + ((rng() * 4) | 0) : wood === 'jungle' ? 8 + ((rng() * 6) | 0) : wood === 'dark_oak' ? 5 + ((rng() * 3) | 0) : wood === 'cherry' ? 5 + ((rng() * 2) | 0) : 4 + ((rng() * 3) | 0);
    const leaf = wood + '_leaves';
    if (wood === 'spruce') {
      setBlock(data, idx, lx, h + trunkH, lz, wood + '_log');
      for (let ly = 0; ly < 4; ly++) {
        const rad = 3 - ly;
        for (let dx = -rad; dx <= rad; dx++) for (let dz = -rad; dz <= rad; dz++) {
          if (Math.abs(dx) + Math.abs(dz) <= rad + 1 && !(dx === 0 && dz === 0 && ly < 3))
            setBlock(data, idx, lx + dx, h + trunkH - 1 - ly, lz + dz, leaf);
        }
      }
      for (let t = 1; t <= trunkH; t++) setBlock(data, idx, lx, h + t, lz, wood + '_log');
    } else if (wood === 'jungle') {
      for (let t = 1; t <= trunkH; t++) setBlock(data, idx, lx, h + t, lz, wood + '_log');
      const cy = h + trunkH;
      for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) for (let dy = 0; dy <= 1; dy++) {
        if (Math.abs(dx) === 2 && Math.abs(dz) === 2 && dy === 1) continue;
        setBlock(data, idx, lx + dx, cy + dy, lz + dz, leaf);
      }
      // vines
      if (rng() < 0.5) setBlock(data, idx, lx + 2, cy, lz, 'vine');
    } else if (wood === 'dark_oak') {
      for (let t = 1; t <= trunkH; t++) setBlock(data, idx, lx, h + t, lz, wood + '_log');
      const cy = h + trunkH;
      for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++) {
        const d = Math.abs(dx) + Math.abs(dz);
        if (d <= 4) setBlock(data, idx, lx + dx, cy, lz + dz, leaf);
        if (d <= 3) setBlock(data, idx, lx + dx, cy + 1, lz + dz, leaf);
        if (d <= 2) setBlock(data, idx, lx + dx, cy + 2, lz + dz, leaf);
      }
    } else if (wood === 'acacia') {
      const th = 4 + ((rng() * 2) | 0);
      for (let t = 1; t <= th; t++) setBlock(data, idx, lx, h + t, lz, wood + '_log');
      const cy = h + th;
      for (let dx = -3; dx <= 3; dx++) for (let dz = -1; dz <= 3; dz++) setBlock(data, idx, lx + dx, cy + 1, lz + dz, leaf);
      setBlock(data, idx, lx + 3, cy, lz, wood + '_log');
      setBlock(data, idx, lx + 2, cy, lz, wood + '_log');
    } else if (wood === 'birch') {
      const th = 5 + ((rng() * 3) | 0);
      for (let t = 1; t <= th; t++) setBlock(data, idx, lx, h + t, lz, wood + '_log');
      const cy = h + th;
      for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) {
        if (Math.abs(dx) === 2 && Math.abs(dz) === 2) continue;
        setBlock(data, idx, lx + dx, cy, lz + dz, leaf);
      }
      setBlock(data, idx, lx, cy + 1, lz, leaf);
      setBlock(data, idx, lx + 1, cy + 1, lz, leaf);
      setBlock(data, idx, lx - 1, cy + 1, lz, leaf);
      setBlock(data, idx, lx, cy + 1, lz + 1, leaf);
      setBlock(data, idx, lx, cy + 1, lz - 1, leaf);
    } else if (wood === 'cherry') {
      const th = 5 + ((rng() * 2) | 0);
      for (let t = 1; t <= th; t++) setBlock(data, idx, lx, h + t, lz, wood + '_log');
      const cy = h + th;
      for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++) {
        const d = Math.abs(dx) + Math.abs(dz);
        if (d <= 4) setBlock(data, idx, lx + dx, cy, lz + dz, leaf);
        if (d <= 3) setBlock(data, idx, lx + dx, cy + 1, lz + dz, leaf);
      }
    } else if (wood === 'mangrove') {
      const th = 4;
      for (let t = 1; t <= th; t++) setBlock(data, idx, lx, h + t, lz, wood + '_log');
      const cy = h + th;
      for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) if (Math.abs(dx) + Math.abs(dz) <= 3) setBlock(data, idx, lx + dx, cy, lz + dz, leaf);
      // aerial roots
      setBlock(data, idx, lx + 1, h, lz, wood + '_log');
      setBlock(data, idx, lx - 1, h, lz, wood + '_log');
    } else {
      // oak generic
      const th = trunkH;
      for (let t = 1; t <= th; t++) setBlock(data, idx, lx, h + t, lz, wood + '_log');
      const cy = h + th;
      for (let dy = -2; dy <= 1; dy++) {
        const rad = dy <= -1 ? 2 : 1;
        for (let dx = -rad; dx <= rad; dx++) for (let dz = -rad; dz <= rad; dz++) {
          if (dy === 1 && Math.abs(dx) === 1 && Math.abs(dz) === 1) continue;
          if (dx === 0 && dz === 0 && dy < 0) continue;
          setBlock(data, idx, lx + dx, cy + dy, lz + dz, leaf);
        }
      }
      if (rng() < 0.05) { /* nest */ }
    }
  }
  function placePlant(data, idx, lx, y, lz, name, count) {
    for (let i = 0; i < count; i++) setBlock(data, idx, lx, y + i, lz, name);
  }
  function placeCactus(data, idx, lx, y, lz, hgt) {
    for (let i = 0; i < hgt; i++) setBlock(data, idx, lx, y + i, lz, 'cactus');
  }

  // ---------- Structures ----------
  class StructurePlacer {
    constructor(seed) { this.seed = seed; this.n = new Noise(seed ^ 0x5f3a2b1c); }
    hash(cx, cz, salt) { return pseudoRand(cx * 3 + salt, cz * 7 + salt * 13, this.seed & 0xffff); }
    place(world, data, meta, idx, biomeMap, heights, cx, cz) {
      // structure candidates on 48x48 region grid
      for (let rz = -1; rz <= 1; rz++) for (let rx = -1; rx <= 1; rx++) {
        const scx = cx + rx, scz = cz + rz;
        this.tryStructure(world, data, meta, idx, biomeMap, heights, cx, cz, scx, scz, 48);
      }
    }
    tryStructure(world, data, meta, idx, biomeMap, heights, cx, cz, scx, scz, region) {
      const r1 = this.hash(scx, scz, 1);
      const bn = BIOMES[biomeMap[8 * CH + 8]];
      // Village in plains/savanna/taiga/desert(mud)/meadow/cherry
      if (r1 < 0.06) {
        const kind = (bn.name === 'desert' || bn.name === 'badlands') ? 'desert_village' :
          (bn.name.includes('taiga') || bn.name === 'plains' || bn.name === 'meadow' || bn.name === 'cherry_grove' || bn.name === 'savanna') ? 'plains_village' : null;
        if (kind) this.buildVillage(data, idx, cx, cz, scx, scz, region, kind);
      }
      // Desert well/pyramid
      if (r1 > 0.97 && (bn.name === 'desert')) this.buildDesertPyramid(data, idx, cx, cz, scx, scz, region);
      // Jungle temple
      if (r1 > 0.955 && (bn.name === 'jungle' || bn.name === 'sparse_jungle' || bn.name === 'bamboo_jungle')) this.buildJungleTemple(data, idx, cx, cz, scx, scz, region);
      // Ocean monument
      if (r1 < 0.03 && (bn.name === 'deep_ocean' || bn.name === 'ocean')) this.buildMonument(data, idx, cx, cz, scx, scz, region);
      // Shipwreck
      if (r1 > 0.94 && r1 < 0.955 && (bn.water)) this.buildShipwreck(data, idx, cx, cz, scx, scz, region);
      // Igloo
      if (r1 > 0.93 && (bn.name === 'ice_plains' || bn.name === 'snow_taiga' || bn.name === 'tundra')) this.buildIgloo(data, idx, cx, cz, scx, scz, region);
      // Woodland mansion
      if (r1 > 0.985 && bn.name === 'dark_forest') this.buildMansion(data, idx, cx, cz, scx, scz, region);
      // Ancient city (deepslates, underground) - mark spawner
      if (r1 > 0.9 && (bn.name === 'meadow' || bn.name === 'badlands' || bn.name === 'jagged_peaks')) this.buildAncientCity(data, idx, cx, cz, scx, scz, region);
      // Stronghold: rare, anywhere on land; contains End portal
      if (this.hash(scx, scz, 77) < 0.012 && !bn.water) this.buildStronghold(data, idx, cx, cz, scx, scz, region);
      // Pillager outpost
      if (this.hash(scx, scz, 31) < 0.05 && !bn.water && bn.name !== 'ocean') this.buildOutpost(data, idx, cx, cz, scx, scz, region);
      // Trial chambers
      if (this.hash(scx, scz, 91) < 0.04 && !bn.water) this.buildTrialChambers(data, idx, cx, cz, scx, scz, region);
    }
    centerOfRegion(scx, scz, region, cx, cz) {
      // deterministic position within the chunk relative to region origin
      const ox = (this.hash(scx, scz, 3) * (region * 0.6) + region * 0.2) | 0;
      const oz = (this.hash(scx, scz, 5) * (region * 0.6) + region * 0.2) | 0;
      const wx = scx * region + ox, wz = scz * region + oz;
      const lx = wx - cx * CH, lz = wz - cz * CH;
      return [lx, lz];
    }
    houseAt(data, idx, cx, cz, lx, lz, w, d, mat, floorMat, roofMat, glassName, doorSide) {
      // returns false if mostly outside chunk
      const h = getBlockData(data, idx, clampLx(lx), 0, clampLz(lz));
      const gy = terrainY(data, idx, lx, lz);
      if (gy === null) return;
      const H = 4 + ((this.hash(lx + cx * CH, lz + cz * CH, 9) * 3) | 0);
      for (let x = 0; x < w; x++) for (let z = 0; z < d; z++) {
        for (let y = 0; y <= H; y++) {
          const wx = lx + x, wz = lz + z;
          const edge = x === 0 || x === w - 1 || z === 0 || z === d - 1;
          if (y === 0) setBlock(data, idx, wx, gy + y, wz, floorMat);
          else if (edge && y < H) setBlock(data, idx, wx, gy + y, wz, mat);
          else if (y === H) setBlock(data, idx, wx, gy + y, wz, roofMat);
          else if (!edge) setBlock(data, idx, wx, gy + y, wz, 'air');
        }
        // roof overhang
        for (let y = 0; y <= H; y++) { }
      }
      // windows
      for (let x = 1; x < w - 1; x += 2) { setBlock(data, idx, lx + x, gy + 2, lz, glassName); setBlock(data, idx, lx + x, gy + 2, lz + d - 1, glassName); }
      for (let z = 1; z < d - 1; z += 2) { setBlock(data, idx, lx, gy + 2, lz + z, glassName); setBlock(data, idx, lx + w - 1, gy + 2, lz + z, glassName); }
      // door
      setBlock(data, idx, lx + (doorSide || ((w / 2) | 0)), gy + 1, lz, 'air');
      setBlock(data, idx, lx + (doorSide || ((w / 2) | 0)), gy + 2, lz, 'air');
      // interior: bed, crafting, torch
      setBlock(data, idx, lx + 1, gy + 1, lz + 1, 'torch');
      if (this.hash(lx, lz, 11) < 0.5) setBlock(data, idx, lx + w - 2, gy + 1, lz + d - 2, 'chest');
    }
    buildVillage(data, idx, cx, cz, scx, scz, region, kind) {
      const [lx0, lz0] = this.centerOfRegion(scx, scz, region, cx, CZsafe(cz));
      if (lx0 < -20 || lx0 > CH + 20 || lz0 < -20 || lz0 > CH + 20) return;
      const wall = kind === 'desert_village' ? 'sandstone_like' : 'planks_generic';
      const wallBlock = kind === 'desert_village' ? 'bricks' : 'oak_planks';
      const n = 3 + ((this.hash(scx, scz, 17) * 3) | 0);
      for (let i = 0; i < n; i++) {
        const hx = lx0 + (((this.hash(scx, scz, 20 + i) * 24) | 0) - 12);
        const hz = lz0 + (((this.hash(scx, scz, 40 + i) * 24) | 0) - 12);
        const w = 5 + ((this.hash(hx, hz, 3) * 3) | 0), d = 5 + ((this.hash(hx, hz, 5) * 3) | 0);
        this.houseAt(data, idx, cx, cz, hx, hz, w, d, wallBlock, wallBlock, kind === 'desert_village' ? 'sandstone_like' : 'spruce_planks', 'glass', 2);
      }
      // well
      const wy = terrainY(data, idx, lx0, lz0);
      if (wy !== null) {
        for (let x = -1; x <= 1; x++) for (let z = -1; z <= 1; z++) setBlock(data, idx, lx0 + x, wy, lz0 + z, 'cobblestone');
        setBlock(data, idx, lx0, wy + 1, lz0, 'water');
        setBlock(data, idx, lx0, wy + 2, lz0, 'oak_fence');
        setBlock(data, idx, lx0, wy + 3, lz0, 'oak_fence');
      }
      // path
      for (let i = -10; i <= 10; i++) { const py = terrainY(data, idx, lx0 + i, lz0); if (py !== null) setBlock(data, idx, lx0 + i, py, lz0, 'path'); }
    }
    buildDesertPyramid(data, idx, cx, cz, scx, scz, region) {
      const [lx, lz] = this.centerOfRegion(scx, scz, region, cx, CZsafe(cz));
      if (Math.abs(lx - CH / 2) > 14 || Math.abs(lz - CH / 2) > 14) return;
      const gy = terrainY(data, idx, lx, lz) || 64;
      const S = 10;
      for (let x = -S; x <= S; x++) for (let z = -S; z <= S; z++) {
        const hgt = S - Math.max(Math.abs(x), Math.abs(z));
        for (let y = 0; y < hgt; y++) setBlock(data, idx, lx + x, gy + y, lz + z, 'bricks');
      }
      // entrance & chest with loot placeholder
      setBlock(data, idx, lx, gy + 1, lz - S + 1, 'air');
      setBlock(data, idx, lx, gy + 1, lz, 'chest');
      setBlock(data, idx, lx, gy + 2, lz, 'torch');
    }
    buildJungleTemple(data, idx, cx, cz, scx, scz, region) {
      const [lx, lz] = this.centerOfRegion(scx, scz, region, cx, CZsafe(cz));
      if (Math.abs(lx - CH / 2) > 16 || Math.abs(lz - CH / 2) > 16) return;
      const gy = terrainY(data, idx, lx, lz) || 66;
      for (let x = -8; x <= 8; x++) for (let z = -8; z <= 8; z++) {
        const ring = Math.max(Math.abs(x), Math.abs(z));
        const hgt = 12 - ring;
        for (let y = 0; y < hgt; y++) setBlock(data, idx, lx + x, gy + y, lz + z, 'mossy_stone_bricks');
        if (ring === 8) setBlock(data, idx, lx + x, gy, lz + z, 'mossy_cobblestone');
      }
      setBlock(data, idx, lx, gy + 1, lz, 'chest');
      setBlock(data, idx, lx + 2, gy + 1, lz + 2, 'dispenser');
      setBlock(data, idx, lx - 2, gy + 1, lz - 2, 'dispenser');
      for (const [px, pz] of [[-4, -4], [4, 4], [-4, 4], [4, -4]]) setBlock(data, idx, lx + px, gy + 1, lz + pz, 'tripwire_hook');
    }
    buildMonument(data, idx, cx, cz, scx, scz, region) {
      const [lx, lz] = this.centerOfRegion(scx, scz, region, cx, CZsafe(cz));
      if (Math.abs(lx - CH / 2) > 15 || Math.abs(lz - CH / 2) > 15) return;
      const gy = 50;
      for (let x = -12; x <= 12; x++) for (let z = -12; z <= 12; z++) {
        const ring = Math.max(Math.abs(x), Math.abs(z));
        if (ring > 10 && ring < 12) { for (let y = 0; y < 14; y++) setBlock(data, idx, lx + x, gy + y, lz + z, 'prismarine'); }
        if (ring <= 10) { for (let y = 0; y < 10; y++) setBlock(data, idx, lx + x, gy + y, lz + z, y === 9 || ring === 10 ? 'prismarine_bricks' : 'water'); }
      }
      setBlock(data, idx, lx, gy + 10, lz, 'gold_block');
      setBlock(data, idx, lx, gy + 11, lz, 'sponge');
      if (!WC.blockByName.sponge) { defSponge(); }
      setBlock(data, idx, lx, gy + 5, lz, 'sea_lantern');
    }
    buildShipwreck(data, idx, cx, cz, scx, scz, region) {
      const [lx, lz] = this.centerOfRegion(scx, scz, region, cx, CZsafe(cz));
      if (Math.abs(lx - CH / 2) > 12 || Math.abs(lz - CH / 2) > 12) return;
      const gy = terrainY(data, idx, lx, lz) || 55;
      for (let x = -6; x <= 6; x++) for (let z = -2; z <= 2; z++) {
        setBlock(data, idx, lx + x, gy, lz + z, 'oak_planks');
        if (Math.abs(z) === 2) for (let y = 1; y < 3; y++) setBlock(data, idx, lx + x, gy + y, lz + z, 'oak_log');
      }
      setBlock(data, idx, lx + 4, gy + 1, lz, 'chest');
    }
    buildIgloo(data, idx, cx, cz, scx, scz, region) {
      const [lx, lz] = this.centerOfRegion(scx, scz, region, cx, CZsafe(cz));
      if (Math.abs(lx - CH / 2) > 10 || Math.abs(lz - CH / 2) > 10) return;
      const gy = terrainY(data, idx, lx, lz) || 66;
      for (let x = -3; x <= 3; x++) for (let z = -3; z <= 3; z++) for (let y = 0; y < 4; y++) {
        const ring = Math.abs(x) + Math.abs(z) + y;
        if (ring <= 4) setBlock(data, idx, lx + x, gy + y, lz + z, 'snow_block');
        else if (y === 0 && Math.abs(x) < 2 && Math.abs(z) < 2) setBlock(data, idx, lx + x, gy + y, lz + z, 'air');
      }
      setBlock(data, idx, lx, gy + 1, lz, 'bed');
      setBlock(data, idx, lx + 1, gy + 1, lz, 'crafting_table');
      setBlock(data, idx, lx, gy + 1, lz - 2, 'torch');
    }
    buildMansion(data, idx, cx, cz, scx, scz, region) {
      const [lx, lz] = this.centerOfRegion(scx, scz, region, cx, CZsafe(cz));
      if (Math.abs(lx - CH / 2) > 18 || Math.abs(lz - CH / 2) > 18) return;
      const gy = terrainY(data, idx, lx, lz) || 66;
      const W2 = 12, D2 = 9;
      for (let x = 0; x < W2; x++) for (let z = 0; z < D2; z++) {
        const edge = x === 0 || x === W2 - 1 || z === 0 || z === D2 - 1;
        for (let y = 0; y < 5; y++) {
          if (y === 0) setBlock(data, idx, lx + x - W2 / 2, gy + y, lz + z - D2 / 2, 'dark_oak_planks');
          else if (edge) setBlock(data, idx, lx + x - W2 / 2, gy + y, lz + z - D2 / 2, 'dark_oak_log');
          else setBlock(data, idx, lx + x - W2 / 2, gy + y, lz + z - D2 / 2, 'air');
        }
        setBlock(data, idx, lx + x - W2 / 2, gy + 5, lz + z - D2 / 2, 'dark_oak_planks');
      }
      setBlock(data, idx, lx, gy + 1, lz - D2 / 2, 'chest');
      setBlock(data, idx, lx - 3, gy + 1, lz, 'spawner');
      if (meta) { const mi = ((1 + -WC.Y_MIN) * CH + (lz | 0)) * CH + (lx | 0); }
      setBlock(data, idx, lx - 3, gy + 2, lz, 'torch');
    }
    buildAncientCity(data, idx, cx, cz, scx, scz, region) {
      const [lx, lz] = this.centerOfRegion(scx, scz, region, cx, CZsafe(cz));
      if (Math.abs(lx - CH / 2) > 14 || Math.abs(lz - CH / 2) > 14) return;
      const y = -40;
      for (let x = -10; x <= 10; x++) for (let z = -10; z <= 10; z++) {
        setBlock(data, idx, lx + x, y, lz + z, 'reinforced_deepslate');
        if (Math.max(Math.abs(x), Math.abs(z)) === 10) for (let yy = 1; yy < 5; yy++) setBlock(data, idx, lx + x, y + yy, lz + z, 'deepslate_tiles' in WC.blocks ? 'deepslate_tiles' : 'deepslate_bricks');
        else setBlock(data, idx, lx + x, y + 1, lz + z, 'air');
      }
      setBlock(data, idx, lx, y + 2, lz, 'sculk_catalyst');
      setBlock(data, idx, lx + 2, y + 2, lz + 2, 'chest');
      setBlock(data, idx, lx - 2, y + 2, lz - 2, 'sculk_shrieker');
      for (let i = 0; i < 30; i++) { const sx = ((this.hash(i, scz, 5) * 20) | 0) - 10, sz = ((this.hash(i, scx, 7) * 20) | 0) - 10; setBlock(data, idx, lx + sx, y + 1, lz + sz, 'sculk'); }
    }
    buildStronghold(data, idx, cx, cz, scx, scz, region) {
      const [lx, lz] = this.centerOfRegion(scx, scz, region, cx, CZsafe(cz));
      if (Math.abs(lx - CH / 2) > 12 || Math.abs(lz - CH / 2) > 12) return;
      const y = 20;
      // corridor + portal room
      for (let x = -8; x <= 8; x++) for (let z = -8; z <= 8; z++) {
        const inRoom = Math.abs(x) < 6 && Math.abs(z) < 6;
        if (inRoom) {
          for (let yy = 0; yy < 5; yy++) setBlock(data, idx, lx + x, y + yy, lz + z, yy === 0 ? 'stone_bricks' : 'air');
          // walls
          if (Math.abs(x) === 5 || Math.abs(z) === 5) { setBlock(data, idx, lx + x, y + 1, lz + z, 'cracked_stone_bricks'); setBlock(data, idx, lx + x, y + 2, lz + z, 'cracked_stone_bricks'); setBlock(data, idx, lx + x, y + 3, lz + z, 'cracked_stone_bricks'); }
        }
      }
      // end portal frame ring at y+1 center, floating pool
      const py = y + 1;
      for (let a = 0; a < 12; a++) {
        const ang = a / 12 * Math.PI * 2;
        const fx = Math.round(Math.cos(ang) * 3), fz = Math.round(Math.sin(ang) * 3);
        setBlock(data, idx, lx + fx, py, lz + fz, 'end_portal_frame');
      }
      for (let x = -2; x <= 2; x++) for (let z = -2; z <= 2; z++) if (Math.abs(x) + Math.abs(z) <= 3) setBlock(data, idx, lx + x, py, lz + z, 'end_portal_block');
      setBlock(data, idx, lx, py + 1, lz - 4, 'chest');
      setBlock(data, idx, lx - 4, py + 1, lz, 'spawner'); // silverfish
    }
    buildOutpost(data, idx, cx, cz, scx, scz, region) {
      const [lx, lz] = this.centerOfRegion(scx, scz, region, cx, CZsafe(cz));
      if (Math.abs(lx - CH / 2) > 10 || Math.abs(lz - CH / 2) > 10) return;
      const gy = terrainY(data, idx, lx, lz) || 66;
      for (let y = 1; y < 7; y++) { setBlock(data, idx, lx, gy + y, lz, 'oak_log'); setBlock(data, idx, lx + 1, gy + y, lz, 'oak_log'); setBlock(data, idx, lx, gy + y, lz + 1, 'oak_log'); setBlock(data, idx, lx + 1, gy + y, lz + 1, 'oak_log'); }
      for (let x = -2; x <= 3; x++) for (let z = -2; z <= 3; z++) { setBlock(data, idx, lx + x, gy + 7, lz + z, 'oak_planks'); if (Math.max(Math.abs(x), Math.abs(z)) === 3) setBlock(data, idx, lx + x, gy + 8, lz + z, 'oak_fence'); }
      setBlock(data, idx, lx, gy + 8, lz, 'chest');
      setBlock(data, idx, lx + 2, gy + 8, lz + 2, 'head_steve_block' in WC.blocks ? 'head_steve_block' : 'lantern');
    }
    buildTrialChambers(data, idx, cx, cz, scx, scz, region) {
      const [lx, lz] = this.centerOfRegion(scx, scz, region, cx, CZsafe(cz));
      if (Math.abs(lx - CH / 2) > 12 || Math.abs(lz - CH / 2) > 12) return;
      const y = 10;
      for (let x = -7; x <= 7; x++) for (let z = -7; z <= 7; z++) {
        const ring = Math.max(Math.abs(x), Math.abs(z));
        if (ring <= 6) { setBlock(data, idx, lx + x, y, lz + z, 'tuff'); setBlock(data, idx, lx + x, y + 1, lz + z, 'air'); }
        if (ring === 6) for (let yy = 1; yy < 5; yy++) setBlock(data, idx, lx + x, y + yy, lz + z, 'tuff_bricks' in WC.blocks ? 'tuff_bricks' : 'tuff');
      }
      setBlock(data, idx, lx, y + 1, lz, 'trial_spawner' in WC.blocks ? 'trial_spawner' : 'spawner');
      setBlock(data, idx, lx + 3, y + 1, lz + 3, 'vault_block' in WC.blocks ? 'vault_block' : 'copper_bulb');
    }
  }
  function CZsafe(cz) { return cz; }
  function clampLx(v) { return Math.max(0, Math.min(CH - 1, v | 0)); }
  function clampLz(v) { return Math.max(0, Math.min(CH - 1, v | 0)); }
  function terrainY(data, idx, lx, lz) {
    if (lx < 0 || lz < 0 || lx >= CH || lz >= CH) return null;
    for (let y = WC.Y_MAX - 60; y > WC.Y_MIN; y--) {
      const id = data[idx(lx | 0, y, lz | 0)];
      if (id && WC.blockIds[id] && WC.blockIds[id].solid) return y;
    }
    return null;
  }
  function defSponge() {
    WC.blockByName.sponge = { id: ++WC._blockIdCounter, name: 'sponge', display: 'Sponge', solid: true, opaque: true, render: 'cube', tex: { all: 'sponge' }, hardness: 0.6, tool: null, tier: 0, drop: 'sponge', light: 0, transparent: false, liquid: false, gravity: false, flammable: true, container: null, replaceable: false, walkSound: 'grass', color: [200, 200, 100], extra: {} };
    WC.blockIds[WC.blockByName.sponge.id] = WC.blockByName.sponge;
  }

  // ---------- Nether gen ----------
  class NetherGen {
    constructor(seed) {
      this.dim = 'nether';
      this.nH = new Noise(seed ^ 0x11223344);
      this.nC = new Noise(seed ^ 0x55667788);
      this.nB = new Noise(seed ^ 0x99aabbcc);
      this.structures = new StructurePlacer(seed ^ 0x777);
    }
    generateChunk(world, cx, cz) {
      const data = new Uint16Array(CH * WH * CH);
      const meta = new Uint8Array(CH * WH * CH);
      const lights = new Uint8Array(CH * WH * CH);
      const idx = (x, y, z) => ((y + (-WC.Y_MIN)) * CH + z) * CH + x;
      const HMAX = 128;
      for (let lz = 0; lz < CH; lz++) for (let lx = 0; lx < CH; lx++) {
        const wx = cx * CH + lx, wz = cz * CH + lz;
        const top = 100 + this.nH.fbm2(wx / 200, wz / 200, 3) * 20;
        for (let y = WC.Y_MIN; y <= HMAX; y++) {
          let id = 0;
          if (y <= WC.Y_MIN + 1 || y >= HMAX) id = WC.blockId('bedrock');
          else if (y < 32) {
            const n = this.nC.noise3(wx / 80, y / 40, wz / 80);
            id = n > -0.1 ? WC.blockId('netherrack') : (y < 12 ? WC.blockId('lava') : WC.blockId('air'));
          } else {
            const n = this.nC.noise3(wx / 70, y / 55, wz / 70);
            const cave = Math.abs(this.nB.noise3(wx / 100, y / 80, wz / 100)) < 0.12;
            if (y > top && !cave) id = 0;
            else if (y > top && cave) id = 0;
            else if (cave) id = 0;
            else {
              const r = pseudoRand(wx, y, wz);
              if (r < 0.03 && y > 70) id = WC.blockId('quartz_ore');
              else if (r < 0.05 && y < 40) id = WC.blockId('nether_gold_ore');
              else if (r < 0.004 && y < 30) id = WC.blockId('ancient_debris');
              else if (r < 0.01) id = WC.blockId('soul_sand');
              else id = WC.blockId('netherrack');
            }
          }
          data[idx(lx, y, lz)] = id;
        }
        // ceiling glowstone clusters
        if (Math.random() < 0.02) { const gy = 96 + ((Math.random() * 4) | 0); setBlock(data, idx, lx, gy, lz, 'glowstone'); }
        // lava lakes on floor
        const fy = 24;
        if (data[idx(lx, fy, lz)] === 0 && this.nB.noise2(wx / 150, wz / 150) > 0.55) {
          for (let y = WC.Y_MIN + 2; y <= fy; y++) if (!data[idx(lx, y, lz)]) data[idx(lx, y, lz)] = WC.blockId('lava');
        }
      }
      // vegetation patches
      for (let lz = 0; lz < CH; lz++) for (let lx = 0; lx < CH; lx++) {
        const wx = cx * CH + lx, wz = cz * CH + lz;
        const biomeN = this.nB.fbm2(wx / 300, wz / 300, 2);
        for (let y = 33; y < 100; y++) {
          if (data[idx(lx, y, lz)] === WC.blockId('netherrack') && !data[idx(lx, y + 1, lz)]) {
            const r = pseudoRand(wx, y, wz);
            if (biomeN > 0.25 && r < 0.02) data[idx(lx, y + 1, lz)] = WC.blockId('crimson_roots');
            else if (biomeN < -0.2 && r < 0.02) data[idx(lx, y + 1, lz)] = WC.blockId('warped_roots');
            else if (r < 0.004) data[idx(lx, y + 1, lz)] = WC.blockId(biomeN > 0 ? 'crimson_fungus_block' : 'warped_fungus_block');
            break;
          }
          if (data[idx(lx, y, lz)]) break;
        }
      }
      // fortress placement (hash-based regions of 32)
      placeFortress(data, idx, cx, cz, this.structures);
      return { data, meta, lights, biomeMap: new Int16Array(CH * CH), heights: new Int16Array(CH * CH), dirty: true };
    }
  }
  function placeFortress(data, idx, cx, cz, sp) {
    const region = 32;
    const scx = Math.floor(cx * CH / region), scz = Math.floor(cz * CH / region);
    const r = sp.hash(scx, scz, 123);
    if (r > 0.35) return;
    const ox = scx * region + ((sp.hash(scx, scz, 124) * region) | 0);
    const oz = scz * region + ((sp.hash(scx, scz, 125) * region) | 0);
    // bridge corridors at y ~ 40
    const y = 40 + ((r * 20) | 0);
    for (let i = -CH; i < CH * 2; i++) {
      const wx = ox + i, wz = oz;
      const lx = wx - cx * CH, lz = wz - cz * CH;
      if (lx < 0 || lz < 0 || lx >= CH || lz >= CH) continue;
      for (let bx = -1; bx <= 2; bx++) {
        const lxx = lx + bx;
        if (lxx < 0 || lxx >= CH) continue;
        setBlock(data, idx, lxx, y, lz, 'blackstone');
        setBlock(data, idx, lxx, y + 1, lz, 'air');
        if (bx === -1 || bx === 2) setBlock(data, idx, lxx, y + 1, lz, 'blackstone_wall' in WC.blocks ? 'blackstone_wall' : 'polished_blackstone');
      }
    }
    // small room + spawner + chest
    const lxc = ox - cx * CH, lzc = oz - cz * CH;
    if (lxc > 2 && lxc < CH - 2 && lzc > 2 && lzc < CH - 2) {
      for (let x = -3; x <= 3; x++) for (let z = -3; z <= 3; z++) {
        const edge = Math.max(Math.abs(x), Math.abs(z)) === 3;
        for (let yy = 0; yy < 4; yy++) setBlock(data, idx, lxc + x, y + 1 + yy, lzc + z, edge ? 'blackstone' : (yy === 0 ? 'basalt' : 'air'));
      }
      setBlock(data, idx, lxc, y + 1, lzc, 'spawner');
      setBlock(data, idx, lxc + 2, y + 1, lzc + 2, 'chest');
    }
  }

  // ---------- End gen ----------
  class EndGen {
    constructor(seed) {
      this.dim = 'end';
      this.n = new Noise(seed ^ 0xE4D4C3B2);
      this.islandN = new Noise(seed ^ 0xAABBCCDD);
    }
    generateChunk(world, cx, cz) {
      const data = new Uint16Array(CH * WH * CH);
      const meta = new Uint8Array(CH * WH * CH);
      const lights = new Uint8Array(CH * WH * CH);
      const idx = (x, y, z) => ((y + (-WC.Y_MIN)) * CH + z) * CH + x;
      const wx0 = cx * CH, wz0 = cz * CH;
      const distMain = Math.hypot(wx0 + 8, wz0 + 8);
      const central = distMain < 420;
      // outer islands ring
      let island = null;
      for (let a = 0; a < 8; a++) {
        const ang = a / 8 * Math.PI * 2;
        const ix = Math.cos(ang) * 800, iz = Math.sin(ang) * 800;
        const d = Math.hypot(wx0 + 8 - ix, wz0 + 8 - iz);
        if (d < 180) { island = { ix, iz, d, a }; break; }
      }
      if (central) {
        for (let lz = 0; lz < CH; lz++) for (let lx = 0; lx < CH; lx++) {
          const wx = wx0 + lx, wz = wz0 + lz;
          const d = Math.hypot(wx, wz);
          if (d > 400) continue;
          const thick = Math.max(0, 40 - d / 10 + this.n.fbm2(wx / 120, wz / 120, 3) * 12);
          if (thick <= 0) continue;
          const base = 60 - thick / 2;
          for (let y = base | 0; y < (base + thick) | 0; y++) setBlock(data, idx, lx, y, lz, 'end_stone');
          // pillars occasionally near spawn island edge
          if (d > 300 && d < 380 && pseudoRand(wx, 1, wz) < 0.004) {
            for (let y = 60; y < 100; y++) setBlock(data, idx, lx, y, lz, 'obsidian_pillar' in WC.blocks ? 'obsidian_pillar' : 'obsidian');
          }
        }
        // spawn platform & obsidian pillars & dragon perch handled by world init
      } else if (island) {
        for (let lz = 0; lz < CH; lz++) for (let lx = 0; lx < CH; lx++) {
          const wx = wx0 + lx, wz = wz0 + lz;
          const d = Math.hypot(wx - island.ix, wz - island.iz);
          if (d > 150) continue;
          const thick = Math.max(0, 24 - d / 6 + this.n.fbm2(wx / 80, wz / 80, 3) * 8);
          if (thick <= 0) continue;
          const base = 60 - thick / 2;
          for (let y = base | 0; y < (base + thick) | 0; y++) setBlock(data, idx, lx, y, lz, 'end_stone');
          // chorus
          if (pseudoRand(wx, 2, wz) < 0.004) {
            const cy = (base + thick) | 0;
            for (let i = 0; i < 4; i++) setBlock(data, idx, lx, cy + i, lz, 'chorus_plant');
            setBlock(data, idx, lx + 1, cy + 2, lz, 'chorus_plant');
            setBlock(data, idx, lx - 1, cy + 3, lz, 'chorus_plant');
          }
        }
      }
      return { data, meta, lights, biomeMap: new Int16Array(CH * CH).fill(WC.biomeIndex ? WC.biomeIndex('end_highlands') : 0), heights: new Int16Array(CH * CH), dirty: true };
    }
  }

  WC.genForDim = function (dim, seed) {
    if (dim === 'nether') return new NetherGen(seed);
    if (dim === 'end') return new EndGen(seed);
    return new OverworldGen(seed);
  };
})();
