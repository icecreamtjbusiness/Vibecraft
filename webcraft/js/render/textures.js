// ============================================================
// Procedural pixel-art texture atlas (16x16 tiles, NEAREST).
// Every block/item icon is generated to look like Minecraft.
// ============================================================
(function () {
  'use strict';
  const WC = window.WC;
  const TS = 16; // tile size px

  // deterministic RNG per texture name
  function rngFor(name) {
    let h = 2166136261;
    for (let i = 0; i < name.length; i++) { h ^= name.charCodeAt(i); h = Math.imul(h, 16777619); }
    return function () { h += 0x6D2B79F5; let t = h; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }

  function newTile() { const d = new Uint8Array(TS * TS * 4); return d; }
  function setPx(t, x, y, r, g, b, a = 255) { if (x < 0 || y < 0 || x >= TS || y >= TS) return; const i = (y * TS + x) * 4; t[i] = r; t[i + 1] = g; t[i + 2] = b; t[i + 3] = a; }
  function fill(t, c) { for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) setPx(t, x, y, ...c); }
  function noiseFill(t, base, vary, rnd) {
    for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) {
      const v = (rnd() - 0.5) * vary;
      setPx(t, x, y, clamp8(base[0] + v), clamp8(base[1] + v), clamp8(base[2] + v));
    }
  }
  function clamp8(v) { return Math.max(0, Math.min(255, v | 0)); }
  function shade(c, f) { return [clamp8(c[0] * f), clamp8(c[1] * f), clamp8(c[2] * f)]; }

  const PAINTERS = {};
  function P(name, fn) { PAINTERS[name] = fn; }

  // ---- generic helpers used by painters ----
  function stoneTex(t, base, rnd, speck = 0.25) {
    noiseFill(t, base, 40, rnd);
    for (let i = 0; i < 24; i++) {
      const x = (rnd() * TS) | 0, y = (rnd() * TS) | 0;
      const s = shade(base, 0.7 + rnd() * 0.5);
      setPx(t, x, y, ...s); setPx(t, x + 1, y, ...s);
    }
  }
  function woodSide(t, col, rnd) {
    for (let x = 0; x < TS; x++) {
      const streak = 0.85 + 0.3 * Math.sin(x * 1.7 + rnd() * 0.5);
      for (let y = 0; y < TS; y++) {
        const v = (rnd() - 0.5) * 14;
        setPx(t, x, y, ...shade(col, streak + v / 255));
      }
    }
    for (let i = 0; i < 3; i++) { const x = (rnd() * TS) | 0; for (let y = 0; y < TS; y++) { const p = t[(y * TS + x) * 4]; setPx(t, x, y, p * 0.8, t[(y * TS + x) * 4 + 1] * 0.8, t[(y * TS + x) * 4 + 2] * 0.8); } }
  }
  function woodTop(t, col, rnd) {
    noiseFill(t, shade(col, 1.1), 12, rnd);
    const cx = 8, cy = 8;
    for (let r = 1; r < 7; r += 2) {
      for (let a = 0; a < 6.28; a += 0.08) {
        const x = (cx + Math.cos(a) * r) | 0, y = (cy + Math.sin(a) * r) | 0;
        setPx(t, x, y, ...shade(col, 0.75));
      }
    }
  }
  function planks(t, col, rnd) {
    noiseFill(t, col, 16, rnd);
    for (const y of [3, 7, 11, 15]) for (let x = 0; x < TS; x++) setPx(t, x, y, ...shade(col, 0.6));
    for (const [y0, off] of [[0, 4], [4, 12], [8, 8], [12, 14]]) for (let y = y0; y < y0 + 4 && y < TS; y++) setPx(t, off, y, ...shade(col, 0.6));
  }
  function dirtish(t, col, rnd) {
    noiseFill(t, col, 50, rnd);
    for (let i = 0; i < 20; i++) { const x = (rnd() * TS) | 0, y = (rnd() * TS) | 0; setPx(t, x, y, ...shade(col, 0.7)); }
  }
  function grassTop(t, rnd) {
    const base = [106, 170, 64];
    noiseFill(t, base, 40, rnd);
    for (let i = 0; i < 30; i++) { const x = (rnd() * TS) | 0, y = (rnd() * TS) | 0; setPx(t, x, y, ...shade(base, 0.75 + rnd() * 0.6)); }
  }
  function grassSide(t, rnd) {
    dirtish(t, [134, 96, 67], rnd);
    const gc = [106, 170, 64];
    for (let x = 0; x < TS; x++) {
      const hgt = 3 + ((rnd() * 3) | 0);
      for (let y = 0; y < hgt; y++) setPx(t, x, y, ...shade(gc, 0.8 + rnd() * 0.4));
    }
  }
  function leaves(t, col, rnd) {
    for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) {
      if (rnd() < 0.12) { setPx(t, x, y, 0, 0, 0, 0); continue; }
      const v = (rnd() - 0.5) * 60;
      setPx(t, x, y, clamp8(col[0] + v), clamp8(col[1] + v), clamp8(col[2] + v));
    }
  }
  function sand(t, col, rnd) { noiseFill(t, col, 22, rnd); }
  function bricksT(t, m, c) {
    fill(t, m);
    for (let row = 0; row < 4; row++) {
      const y = row * 4 + 3;
      for (let x = 0; x < TS; x++) setPx(t, x, y, ...c);
      const off = row % 2 ? 4 : 0;
      for (let bx = off; bx < TS; bx += 8) for (let by = row * 4; by < row * 4 + 3; by++) setPx(t, bx, by, ...c);
    }
  }
  function glassT(t) {
    t.fill(0);
    for (let i = 0; i < TS; i++) { setPx(t, i, 0, 235, 245, 250, 120); setPx(t, i, 15, 235, 245, 250, 120); setPx(t, 0, i, 235, 245, 250, 120); setPx(t, 15, i, 235, 245, 250, 120); }
    for (let i = 2; i < 8; i++) setPx(t, i, i, 255, 255, 255, 150);
    for (let i = 0; i < 4; i++) setPx(t, 10 + i, 3 - i, 255, 255, 255, 120);
  }
  function waterT(t, rnd) {
    for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) {
      const w = Math.sin((x + y * 0.5) * 0.8) * 15;
      setPx(t, x, y, 40 + w * 0.3, 90 + w * 0.5, 200 + w, 190);
    }
  }
  function lavaT(t, rnd) {
    for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) {
      const n = Math.sin(x * 0.9 + y * 0.6) * Math.cos(y * 0.8 - x * 0.3);
      const c = n > 0 ? [220, 90 + n * 60, 10] : [140, 30, 5];
      setPx(t, x, y, ...c);
    }
    for (let i = 0; i < 12; i++) { const x = (rnd() * TS) | 0, y = (rnd() * TS) | 0; setPx(t, x, y, 255, 200, 60); }
  }
  function oreT(t, rock, gem, rnd) {
    stoneTex(t, rock, rnd, 0.2);
    for (let i = 0; i < 6; i++) {
      const x = 2 + ((rnd() * 12) | 0), y = 2 + ((rnd() * 12) | 0);
      setPx(t, x, y, ...gem); setPx(t, x + 1, y, ...gem); setPx(t, x, y + 1, ...gem); setPx(t, x + 1, y + 1, ...shade(gem, 1.3));
    }
  }
  function metalT(t, col, rnd) {
    noiseFill(t, col, 18, rnd);
    for (let i = 0; i < 5; i++) { const x = (rnd() * TS) | 0, y = (rnd() * TS) | 0; setPx(t, x, y, 255, 255, 255, 200); setPx(t, x + 1, y, 250, 250, 250, 150); }
  }
  function woolT(t, col, rnd) {
    noiseFill(t, col, 26, rnd);
    for (let i = 0; i < 40; i++) { const x = (rnd() * TS) | 0, y = (rnd() * TS) | 0; setPx(t, x, y, ...shade(col, 0.8)); }
  }
  function flowerT(t, petal, center, rnd) {
    t.fill(0);
    const pts = [[8, 4], [7, 5], [9, 5], [6, 6], [10, 6], [8, 6], [7, 7], [9, 7], [8, 8]];
    for (const [x, y] of pts) setPx(t, x, y, ...petal);
    setPx(t, 8, 6, ...center); setPx(t, 8, 7, ...center);
    // stem
    for (let y = 9; y < 16; y++) { setPx(t, 8, y, 40, 120, 40); if (y === 11) setPx(t, 9, y, 60, 150, 50); if (y === 13) setPx(t, 7, y, 60, 150, 50); }
  }
  function plantT(t, col, rnd) {
    t.fill(0);
    for (let b = 0; b < 3; b++) {
      const bx = 3 + b * 5;
      for (let y = 15; y > 4 + ((rnd() * 4) | 0); y--) setPx(t, bx, y, ...shade(col, 0.8 + (15 - y) * 0.02));
      setPx(t, bx - 1, 8 + b, ...shade(col, 1.2)); setPx(t, bx + 1, 6 + b, ...shade(col, 1.2));
    }
  }
  function torchT(t) {
    t.fill(0);
    for (let y = 6; y < 16; y++) { setPx(t, 7, y, 120, 80, 40); setPx(t, 8, y, 90, 60, 30); }
    setPx(t, 7, 5, 255, 200, 60); setPx(t, 8, 5, 255, 150, 40); setPx(t, 7, 4, 255, 230, 120); setPx(t, 8, 3, 255, 240, 180);
  }
  function logSide(t, col, bark, rnd) {
    woodSide(t, bark, rnd);
    for (let y = 0; y < TS; y++) { setPx(t, 3, y, ...shade(bark, 0.7)); setPx(t, 12, y, ...shade(bark, 0.7)); }
  }
  function snowT(t, rnd) { noiseFill(t, [240, 248, 255], 10, rnd); }
  function iceT(t, rnd) { for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) setPx(t, x, y, 140 + (rnd() * 30) | 0, 190 + (rnd() * 20) | 0, 240, 220); }
  function netherrack(t, rnd) { noiseFill(t, [110, 30, 30], 50, rnd); for (let i = 0; i < 20; i++) { const x = (rnd() * TS) | 0, y = (rnd() * TS) | 0; setPx(t, x, y, 60, 10, 10); } }
  function endstone(t, rnd) { noiseFill(t, [200, 200, 130], 30, rnd); for (let i = 0; i < 10; i++) { const x = (rnd() * TS) | 0, y = (rnd() * TS) | 0; setPx(t, x, y, 150, 150, 80); } }
  function obsidian(t, rnd) { noiseFill(t, [22, 15, 35], 20, rnd); for (let i = 0; i < 8; i++) { const x = (rnd() * TS) | 0, y = (rnd() * TS) | 0; setPx(t, x, y, 90, 60, 140, 200); } }
  function glowstoneT(t, rnd) { noiseFill(t, [230, 190, 80], 40, rnd); for (let i = 0; i < 10; i++) { const x = (rnd() * TS) | 0, y = (rnd() * TS) | 0; setPx(t, x, y, 255, 240, 160); } }
  function portalT(t, rnd) { for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) { const n = Math.sin(x * 1.2 + y) * Math.cos(y * 1.3 - x * 0.7); setPx(t, x, y, 120 + n * 60, 30, 180 + n * 40, 235); } }
  function bedrockT(t, rnd) { noiseFill(t, [85, 85, 85], 70, rnd); }
  function cobbleT(t, rnd) {
    noiseFill(t, [110, 110, 110], 40, rnd);
    const stones = [[1, 1, 4, 3], [6, 1, 4, 4], [11, 2, 3, 3], [1, 5, 3, 4], [5, 6, 5, 3], [11, 6, 4, 4], [2, 11, 5, 4], [8, 10, 3, 5], [12, 11, 3, 4]];
    for (const [x, y, w, h] of stones) {
      const g = 90 + ((rnd() * 60) | 0);
      for (let yy = y; yy < y + h && yy < TS; yy++) for (let xx = x; xx < x + w && xx < TS; xx++) setPx(t, xx, yy, g, g, g);
      for (let xx = x; xx < x + w && xx < TS; xx++) setPx(t, xx, y, g + 30, g + 30, g + 30);
    }
  }
  function brickWallLike(t, a, b) { bricksT(t, a, b); }
  function carpetLike(t, col, rnd) { woolT(t, shade(col, 0.9), rnd); }
  function solidColor(t, col, rnd) { noiseFill(t, col, 14, rnd); }

  // register painters for all textures needed
  const TEXSPECS = {
    grass_top: (t, r) => grassTop(t, r),
    grass_side: (t, r) => grassSide(t, r),
    dirt: (t, r) => dirtish(t, [134, 96, 67], r),
    podzol: (t, r) => { dirtish(t, [80, 50, 25], r); for (let i = 0; i < 8; i++) setPx(t, (r() * 16) | 0, (r() * 3) | 0, 120, 100, 40); },
    mycelium_side: (t, r) => { dirtish(t, [110, 90, 80], r); for (let i = 0; i < 10; i++) setPx(t, (r() * 16) | 0, (r() * 4) | 0, 160, 140, 170); },
    mycelium_top: (t, r) => { noiseFill(t, [140, 120, 140], 30, r); },
    stone: (t, r) => stoneTex(t, [125, 125, 125], r),
    cobblestone: (t, r) => cobbleT(t, r),
    mossy_cobblestone: (t, r) => { cobbleT(t, r); for (let i = 0; i < 30; i++) setPx(t, (r() * 16) | 0, (r() * 16) | 0, 70, 120, 60, 200); },
    gravel: (t, r) => { noiseFill(t, [125, 120, 115], 60, r); for (let i = 0; i < 25; i++) { const x = (r() * 16) | 0, y = (r() * 16) | 0; setPx(t, x, y, 90, 85, 80); setPx(t, x + 1, y + 1, 150, 145, 140); } },
    sand: (t, r) => sand(t, [219, 207, 163], r),
    red_sand: (t, r) => sand(t, [190, 102, 33], r),
    sandstone_side: (t, r) => { noiseFill(t, [216, 203, 155], 16, r); for (let y = 0; y < 16; y += 4) for (let x = 0; x < 16; x++) setPx(t, x, y, 190, 178, 130); },
    sandstone_top: (t, r) => noiseFill(t, [223, 210, 160], 14, r),
    sandstone_carved: (t, r) => { noiseFill(t, [216, 203, 155], 14, r); for (let x = 2; x < 14; x++) { setPx(t, x, 4, 160, 145, 100); setPx(t, x, 11, 160, 145, 100); } setPx(t, 5, 7, 120, 100, 70); setPx(t, 10, 7, 120, 100, 70); },
    terracotta: (t, r) => noiseFill(t, [152, 93, 67], 16, r),
    terracotta_orange: (t, r) => noiseFill(t, [156, 97, 63], 16, r),
    terracotta_white: (t, r) => noiseFill(t, [178, 139, 115], 16, r),
    clay: (t, r) => noiseFill(t, [160, 166, 179], 16, r),
    dirt_with_roots: (t, r) => { dirtish(t, [110, 80, 55], r); for (let i = 0; i < 8; i++) { const x = (r() * 16) | 0; for (let y = (r() * 8) | 0; y < 16; y++) setPx(t, x, y, 90, 60, 30); } },
    mud: (t, r) => noiseFill(t, [60, 52, 46], 20, r),
    muddy_mangrove_roots: (t, r) => { noiseFill(t, [70, 55, 40], 24, r); for (let x = 0; x < 16; x += 4) for (let y = 0; y < 16; y++) setPx(t, x, y, 100, 75, 45); },
    mangrove_roots: (t, r) => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) setPx(t, x, y, (x + y) % 4 ? 110 : 80, (x + y) % 4 ? 75 : 50, (x + y) % 4 ? 45 : 30); },
    packed_mud: (t, r) => noiseFill(t, [94, 72, 56], 14, r),
    bricks: (t, r) => bricksT(t, [150, 95, 80], [120, 70, 60]),
    stone_bricks: (t, r) => bricksT(t, [120, 120, 120], [90, 90, 90]),
    mossy_stone_bricks: (t, r) => { bricksT(t, [115, 125, 110], [85, 95, 80]); for (let i = 0; i < 20; i++) setPx(t, (r() * 16) | 0, (r() * 16) | 0, 70, 120, 60, 180); },
    cracked_stone_bricks: (t, r) => { bricksT(t, [120, 120, 120], [90, 90, 90]); for (let i = 0; i < 6; i++) { let x = (r() * 16) | 0, y = (r() * 16) | 0; for (let k = 0; k < 4; k++) { setPx(t, x, y, 70, 70, 70); x += (r() * 3 - 1) | 0; y++; } } },
    chiseled_stone_bricks: (t, r) => { bricksT(t, [120, 120, 120], [90, 90, 90]); for (let x = 4; x < 12; x++) for (let y = 4; y < 12; y++) if ((x + y) % 3 === 0) setPx(t, x, y, 150, 150, 150); },
    deepslate: (t, r) => stoneTex(t, [65, 65, 70], r),
    cobbed_deepslate: (t, r) => cobbleT(t, r),
    deepslate_bricks: (t, r) => bricksT(t, [70, 70, 75], [45, 45, 50]),
    deepslate_tiles: (t, r) => bricksT(t, [60, 60, 65], [40, 40, 45]),
    polished_deepslate: (t, r) => noiseFill(t, [80, 80, 85], 12, r),
    tuff: (t, r) => noiseFill(t, [108, 109, 102], 24, r),
    calcite: (t, r) => noiseFill(t, [223, 224, 220], 12, r),
    amethyst_block: (t, r) => noiseFill(t, [133, 97, 176], 24, r),
    budding_amethyst: (t, r) => { noiseFill(t, [133, 97, 176], 20, r); for (let i = 0; i < 8; i++) { const x = 2 + ((r() * 12) | 0), y = 2 + ((r() * 12) | 0); setPx(t, x, y, 200, 170, 255); setPx(t, x + 1, y, 180, 140, 230); } },
    copper_block: (t, r) => metalT(t, [190, 102, 67], r),
    exposed_copper: (t, r) => metalT(t, [170, 128, 106], r),
    weathered_copper: (t, r) => metalT(t, [112, 132, 112], r),
    oxidized_copper: (t, r) => metalT(t, [82, 112, 102], r),
    cut_copper: (t, r) => { metalT(t, [190, 102, 67], r); for (let y = 0; y < 16; y += 4) for (let x = 0; x < 16; x++) setPx(t, x, y, 150, 80, 50); },
    iron_block: (t, r) => metalT(t, [216, 216, 216], r),
    gold_block: (t, r) => metalT(t, [244, 214, 62], r),
    diamond_block: (t, r) => { noiseFill(t, [100, 220, 220], 20, r); for (let i = 0; i < 10; i++) { const x = (r() * 16) | 0, y = (r() * 16) | 0; setPx(t, x, y, 200, 255, 255); } },
    emerald_block: (t, r) => { noiseFill(t, [42, 170, 85], 20, r); for (let i = 0; i < 8; i++) { const x = (r() * 16) | 0, y = (r() * 16) | 0; setPx(t, x, y, 120, 255, 160); } },
    lapis_block: (t, r) => { noiseFill(t, [32, 69, 163], 20, r); for (let i = 0; i < 8; i++) { const x = (r() * 16) | 0, y = (r() * 16) | 0; setPx(t, x, y, 80, 120, 230); } },
    redstone_block: (t, r) => { noiseFill(t, [160, 20, 20], 16, r); for (let i = 0; i < 6; i++) { const x = (r() * 16) | 0, y = (r() * 16) | 0; setPx(t, x, y, 255, 60, 60); } },
    netherite_block: (t, r) => { noiseFill(t, [66, 61, 63], 12, r); for (let i = 0; i < 6; i++) { const x = (r() * 16) | 0, y = (r() * 16) | 0; setPx(t, x, y, 110, 100, 105); } },
    coal_block: (t, r) => noiseFill(t, [30, 30, 30], 20, r),
    raw_iron_block: (t, r) => noiseFill(t, [158, 122, 100], 30, r),
    raw_copper_block: (t, r) => noiseFill(t, [150, 100, 80], 30, r),
    raw_gold_block: (t, r) => noiseFill(t, [170, 140, 80], 30, r),
    quartz_block: (t, r) => noiseFill(t, [235, 230, 225], 10, r),
    smooth_quartz: (t, r) => noiseFill(t, [230, 225, 218], 8, r),
    purpur_block: (t, r) => noiseFill(t, [155, 105, 155], 20, r),
    prismarine: (t, r) => { noiseFill(t, [60, 130, 120], 20, r); for (let y = 0; y < 16; y += 4) for (let x = 0; x < 16; x++) setPx(t, x, y, 40, 100, 95); },
    prismarine_bricks: (t, r) => bricksT(t, [70, 140, 130], [50, 110, 100]),
    dark_prismarine: (t, r) => { noiseFill(t, [40, 80, 70], 16, r); },
    sea_lantern: (t, r) => { noiseFill(t, [150, 220, 210], 30, r); for (let i = 0; i < 10; i++) { const x = (r() * 16) | 0, y = (r() * 16) | 0; setPx(t, x, y, 230, 255, 250); } },
    netherrack: (t, r) => netherrack(t, r),
    soul_sand: (t, r) => { noiseFill(t, [80, 60, 45], 20, r); for (let i = 0; i < 6; i++) { const x = 2 + ((r() * 12) | 0), y = 2 + ((r() * 12) | 0); for (let a = 0; a < 6.28; a += 0.5) setPx(t, (x + Math.cos(a) * 2) | 0, (y + Math.sin(a) * 2) | 0, 50, 35, 25); } },
    soul_soil: (t, r) => noiseFill(t, [70, 55, 45], 24, r),
    soul_torch: (t) => { t.fill(0); for (let y = 6; y < 16; y++) { setPx(t, 7, y, 120, 80, 40); setPx(t, 8, y, 90, 60, 30); } setPx(t, 7, 5, 100, 220, 200); setPx(t, 8, 4, 150, 250, 230); },
    magma: (t, r) => { noiseFill(t, [120, 50, 20], 40, r); for (let i = 0; i < 12; i++) { const x = (r() * 16) | 0, y = (r() * 16) | 0; setPx(t, x, y, 255, 180, 60); } },
    basalt: (t, r) => { noiseFill(t, [70, 70, 75], 16, r); for (let x = 2; x < 16; x += 5) for (let y = 0; y < 16; y++) setPx(t, x, y, 50, 50, 55); },
    polished_basalt: (t, r) => noiseFill(t, [85, 85, 92], 10, r),
    blackstone: (t, r) => cobbleT(t, r),
    gilded_blackstone: (t, r) => { cobbleT(t, r); for (let i = 0; i < 10; i++) setPx(t, (r() * 16) | 0, (r() * 16) | 0, 220, 180, 60); },
    crying_obsidian: (t, r) => { obsidian(t, r); for (let i = 0; i < 6; i++) { const x = (r() * 16) | 0; for (let y = 0; y < 8; y++) setPx(t, x, y, 180, 40, 60); } },
    obsidian: (t, r) => obsidian(t, r),
    end_stone: (t, r) => endstone(t, r),
    end_stone_bricks: (t, r) => bricksT(t, [200, 200, 130], [170, 170, 100]),
    purpur_pillar: (t, r) => { noiseFill(t, [150, 100, 150], 14, r); for (let x = 0; x < 16; x += 4) for (let y = 0; y < 16; y++) setPx(t, x, y, 120, 80, 120); },
    chorus_plant: (t, r) => { t.fill(0); for (let y = 0; y < 16; y++) { setPx(t, 7, y, 90, 60, 110); setPx(t, 8, y, 70, 45, 90); } for (let i = 0; i < 5; i++) setPx(t, 5 + ((r() * 6) | 0), (r() * 16) | 0, 140, 100, 160); },
    purpura_flower: (t, r) => { t.fill(0); for (const [x, y] of [[7, 7], [8, 7], [7, 8], [8, 8], [6, 6], [9, 9], [6, 9], [9, 6]]) setPx(t, x, y, 180, 120, 200); },
    wood_oak: (t, r) => woodSide(t, [150, 110, 60], r),
    wood_spruce: (t, r) => woodSide(t, [100, 70, 40], r),
    wood_birch: (t, r) => woodSide(t, [210, 200, 180], r),
    wood_jungle: (t, r) => woodSide(t, [120, 90, 50], r),
    wood_acacia: (t, r) => woodSide(t, [130, 80, 60], r),
    wood_darkoak: (t, r) => woodSide(t, [70, 50, 30], r),
    wood_mangrove: (t, r) => woodSide(t, [90, 55, 45], r),
    wood_cherry: (t, r) => woodSide(t, [200, 140, 150], r),
    wood_bamboo: (t, r) => { woodSide(t, [140, 160, 70], r); for (let y = 0; y < 16; y += 5) for (let x = 0; x < 16; x++) setPx(t, x, y, 100, 120, 50); },
    top_oak: (t, r) => woodTop(t, [150, 110, 60], r),
    top_spruce: (t, r) => woodTop(t, [100, 70, 40], r),
    top_birch: (t, r) => woodTop(t, [210, 200, 180], r),
    top_jungle: (t, r) => woodTop(t, [120, 90, 50], r),
    top_acacia: (t, r) => woodTop(t, [130, 80, 60], r),
    top_darkoak: (t, r) => woodTop(t, [70, 50, 30], r),
    top_mangrove: (t, r) => woodTop(t, [90, 55, 45], r),
    top_cherry: (t, r) => woodTop(t, [200, 140, 150], r),
    top_bamboo: (t, r) => woodTop(t, [140, 160, 70], r),
    planks_oak: (t, r) => planks(t, [162, 130, 78], r),
    planks_spruce: (t, r) => planks(t, [114, 84, 50], r),
    planks_birch: (t, r) => planks(t, [192, 175, 127], r),
    planks_jungle: (t, r) => planks(t, [160, 115, 80], r),
    planks_acacia: (t, r) => planks(t, [168, 96, 92], r),
    planks_darkoak: (t, r) => planks(t, [90, 62, 42], r),
    planks_mangrove: (t, r) => planks(t, [118, 70, 60], r),
    planks_cherry: (t, r) => planks(t, [219, 173, 179], r),
    planks_bamboo: (t, r) => planks(t, [178, 188, 96], r),
    leaves_oak: (t, r) => leaves(t, [60, 120, 40], r),
    leaves_spruce: (t, r) => leaves(t, [40, 90, 50], r),
    leaves_birch: (t, r) => leaves(t, [80, 140, 60], r),
    leaves_jungle: (t, r) => leaves(t, [50, 130, 40], r),
    leaves_acacia: (t, r) => leaves(t, [90, 140, 50], r),
    leaves_darkoak: (t, r) => leaves(t, [45, 95, 35], r),
    leaves_mangrove: (t, r) => leaves(t, [55, 110, 55], r),
    leaves_cherry: (t, r) => leaves(t, [220, 150, 170], r),
    bedrock: (t, r) => bedrockT(t, r),
    water: (t, r) => waterT(t, r),
    lava: (t, r) => lavaT(t, r),
    glass: (t) => glassT(t),
    bookshelf_side: (t, r) => { planks(t, [114, 84, 50], r); },
    bookshelf_books: (t, r) => { fill(t, [110, 80, 50]); for (let i = 0; i < 12; i++) { const x = 1 + i; if (x > 14) break; const c = [[180, 60, 60], [60, 90, 180], [70, 150, 70], [200, 180, 80]][(r() * 4) | 0]; for (let y = 2; y < 14; y++) if (r() > 0.15) setPx(t, x, y, ...c); } },
    crafting_table_top: (t, r) => { planks(t, [150, 110, 70], r); for (let x = 0; x < 16; x++) { setPx(t, x, 0, 90, 60, 30); setPx(t, x, 15, 90, 60, 30); } for (let y = 0; y < 16; y++) { setPx(t, 0, y, 90, 60, 30); setPx(t, 15, y, 90, 60, 30); } for (let i = 4; i < 12; i++) { setPx(t, i, 4, 60, 40, 20); setPx(t, i, 11, 60, 40, 20); setPx(t, 4, i, 60, 40, 20); setPx(t, 11, i, 60, 40, 20); } },
    crafting_table_side: (t, r) => { planks(t, [150, 110, 70], r); for (let x = 2; x < 14; x++) setPx(t, x, 2, 90, 60, 30); },
    furnace_front: (t, r) => { stoneTex(t, [100, 100, 100], r); for (let x = 3; x < 13; x++) for (let y = 4; y < 13; y++) setPx(t, x, y, 40, 40, 40); for (let x = 4; x < 12; x++) for (let y = 9; y < 12; y++) setPx(t, x, y, 30, 30, 30); },
    furnace_lit: (t, r) => { stoneTex(t, [100, 100, 100], r); for (let x = 3; x < 13; x++) for (let y = 4; y < 13; y++) setPx(t, x, y, 40, 40, 40); for (let x = 4; x < 12; x++) for (let y = 6; y < 12; y++) { const f = y > 9 ? [255, 200, 60] : [230, 100, 20]; setPx(t, x, y, ...f); } },
    blastface: (t, r) => { stoneTex(t, [80, 80, 85], r); for (let x = 4; x < 12; x++) for (let y = 3; y < 13; y++) setPx(t, x, y, 30, 30, 35); for (let x = 5; x < 11; x++) setPx(t, x, 8, 20, 20, 25); },
    smokerface: (t, r) => { stoneTex(t, [110, 80, 60], r); for (let x = 4; x < 12; x++) for (let y = 4; y < 12; y++) setPx(t, x, y, 60, 40, 30); },
    chest_front: (t, r) => { planks(t, [130, 90, 50], r); for (let x = 0; x < 16; x++) { setPx(t, x, 4, 90, 60, 30); setPx(t, x, 5, 150, 110, 60); } setPx(t, 7, 6, 240, 200, 80); setPx(t, 8, 6, 240, 200, 80); setPx(t, 7, 7, 200, 160, 60); setPx(t, 8, 7, 200, 160, 60); },
    enderchest: (t, r) => { noiseFill(t, [30, 30, 40], 10, r); setPx(t, 7, 6, 100, 255, 180); setPx(t, 8, 6, 100, 255, 180); setPx(t, 7, 7, 60, 200, 140); setPx(t, 8, 7, 60, 200, 140); for (let i = 0; i < 20; i++) setPx(t, (r() * 16) | 0, (r() * 16) | 0, 80, 60, 100); },
    trappedchest: (t, r) => { chest_front(t, r); setPx(t, 7, 9, 200, 40, 40); setPx(t, 8, 9, 200, 40, 40); },
    barrel_side: (t, r) => { woodSide(t, [110, 80, 50], r); for (let y = 0; y < 16; y++) { setPx(t, 0, y, 70, 50, 30); setPx(t, 15, y, 70, 50, 30); } },
    barrel_top: (t, r) => { woodTop(t, [120, 90, 55], r); for (let x = 2; x < 14; x++) { setPx(t, x, 2, 80, 55, 35); setPx(t, x, 13, 80, 55, 35); } },
    anvil: (t, r) => { noiseFill(t, [60, 60, 65], 10, r); for (let x = 2; x < 14; x++) { setPx(t, x, 2, 110, 110, 115); setPx(t, x, 3, 90, 90, 95); } for (let y = 4; y < 12; y++) { setPx(t, 6, y, 80, 80, 85); setPx(t, 9, y, 80, 80, 85); } for (let x = 4; x < 12; x++) { setPx(t, x, 12, 100, 100, 105); } },
    enchant_table_side: (t, r) => { noiseFill(t, [55, 35, 70], 14, r); },
    enchant_top: (t, r) => { noiseFill(t, [40, 25, 60], 10, r); for (let x = 3; x < 13; x++) for (let y = 3; y < 13; y++) setPx(t, x, y, 180, 150, 60); for (let x = 5; x < 11; x++) for (let y = 5; y < 11; y++) setPx(t, x, y, 240, 220, 120); },
    bookshelf_plain: (t, r) => planks(t, [150, 110, 70], r),
    obsidian_shard: (t, r) => obsidian(t, r),
    portal_frame: (t, r) => { noiseFill(t, [30, 25, 45], 10, r); for (let x = 4; x < 12; x++) for (let y = 4; y < 12; y++) setPx(t, x, y, 60, 200, 120); },
    end_portal_tex: (t, r) => portalT(t, r),
    nether_portal_tex: (t, r) => { for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) { const n = Math.sin(x * 1.5 + y * 0.9) * Math.cos(y * 1.1 - x * 0.6); setPx(t, x, y, 120 + n * 60, 20, 160 + n * 50, 235); } },
    farmland_wet: (t, r) => { dirtish(t, [90, 60, 40], r); for (let y = 1; y < 16; y += 4) for (let x = 0; x < 16; x++) setPx(t, x, y, 60, 40, 25); },
    wheat_0: (t, r) => plantT(t, [120, 180, 60], r),
    wheat_3: (t, r) => plantT(t, [170, 190, 60], r),
    wheat_7: (t, r) => plantT(t, [210, 190, 60], r),
    carrot_3: (t, r) => plantT(t, [80, 160, 50], r),
    potato_3: (t, r) => plantT(t, [90, 170, 70], r),
    beetroot_3: (t, r) => plantT(t, [100, 160, 60], r),
    torch: (t) => torchT(t),
    soul_torch_tex: (t) => torchT(t),
    lantern_tex: (t, r) => { t.fill(0); for (let x = 5; x < 11; x++) for (let y = 4; y < 12; y++) setPx(t, x, y, 60, 50, 40); for (let x = 6; x < 10; x++) for (let y = 5; y < 11; y++) setPx(t, x, y, 255, 200, 80); setPx(t, 7, 2, 80, 70, 60); setPx(t, 8, 2, 80, 70, 60); },
    poppy: (t, r) => flowerT(t, [200, 40, 40], [240, 200, 60], r),
    dandelion: (t, r) => flowerT(t, [240, 220, 60], [200, 160, 40], r),
    cornflower: (t, r) => flowerT(t, [80, 110, 220], [160, 180, 240], r),
    oxeye_daisy: (t, r) => flowerT(t, [240, 240, 240], [240, 210, 60], r),
    allium: (t, r) => flowerT(t, [180, 90, 200], [220, 160, 240], r),
    azure_bluet: (t, r) => flowerT(t, [230, 230, 250], [240, 240, 120], r),
    tulip_red: (t, r) => flowerT(t, [200, 60, 50], [120, 160, 60], r),
    tulip_orange: (t, r) => flowerT(t, [230, 130, 40], [120, 160, 60], r),
    tulip_white: (t, r) => flowerT(t, [240, 240, 240], [120, 160, 60], r),
    tulip_pink: (t, r) => flowerT(t, [240, 150, 200], [120, 160, 60], r),
    lily_of_valley: (t, r) => flowerT(t, [245, 245, 250], [200, 220, 200], r),
    wither_rose: (t, r) => { flowerT(t, [60, 60, 60], [200, 60, 40], r); },
    sunflower_top: (t, r) => flowerT(t, [240, 200, 40], [120, 80, 30], r),
    grass_plant: (t, r) => plantT(t, [90, 150, 50], r),
    fern_plant: (t, r) => plantT(t, [70, 130, 60], r),
    deadbush: (t, r) => plantT(t, [140, 110, 60], r),
    sapling_oak: (t, r) => { t.fill(0); setPx(t, 8, 12, 110, 80, 40); setPx(t, 8, 13, 110, 80, 40); setPx(t, 8, 14, 110, 80, 40); setPx(t, 8, 15, 110, 80, 40); for (const [x, y] of [[6, 8], [7, 7], [8, 6], [9, 7], [10, 8], [7, 9], [9, 9], [8, 8], [8, 10], [7, 11], [9, 11]]) setPx(t, x, y, 60, 130, 40); },
    sapling_spruce: (t, r) => { t.fill(0); for (let y = 4; y < 16; y++) { setPx(t, 8, y, 90, 60, 30); if (y < 12) { setPx(t, 7, y, 40, 100, 40); setPx(t, 9, y, 40, 100, 40); } } },
    cactus_side: (t, r) => { noiseFill(t, [25, 120, 40], 16, r); for (let y = 0; y < 16; y++) { setPx(t, 0, y, 15, 80, 25); setPx(t, 15, y, 15, 80, 25); } for (let i = 3; i < 16; i += 5) { setPx(t, 4, i, 220, 220, 180); setPx(t, 11, i + 2, 220, 220, 180); } },
    cactus_top: (t, r) => { noiseFill(t, [30, 130, 45], 14, r); for (let x = 5; x < 11; x++) for (let y = 5; y < 11; y++) setPx(t, x, y, 60, 160, 60); },
    sugar_cane: (t, r) => { t.fill(0); for (let y = 0; y < 16; y++) { setPx(t, 6, y, 120, 200, 120); setPx(t, 7, y, 90, 180, 90); setPx(t, 8, y, 120, 200, 120); } setPx(t, 6, 5, 200, 240, 200); setPx(t, 8, 11, 200, 240, 200); },
    bamboo_tex: (t, r) => { t.fill(0); for (let y = 0; y < 16; y++) { setPx(t, 7, y, 140, 170, 70); setPx(t, 8, y, 110, 150, 60); } setPx(t, 7, 4, 90, 120, 50); setPx(t, 8, 10, 90, 120, 50); setPx(t, 9, 2, 100, 160, 60); setPx(t, 6, 13, 100, 160, 60); },
    melon_side: (t, r) => { noiseFill(t, [80, 150, 50], 16, r); for (let x = 0; x < 16; x += 4) for (let y = 0; y < 16; y++) setPx(t, x, y, 40, 90, 30); },
    melon_top: (t, r) => { noiseFill(t, [80, 150, 50], 16, r); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if ((x + y) % 8 < 2) setPx(t, x, y, 40, 90, 30); },
    pumpkin_side: (t, r) => { noiseFill(t, [200, 120, 30], 16, r); for (let x = 0; x < 16; x += 5) for (let y = 0; y < 16; y++) setPx(t, x, y, 160, 90, 20); },
    pumpkin_face: (t, r) => { noiseFill(t, [200, 120, 30], 16, r); for (const [x, y] of [[3, 4], [4, 4], [5, 5], [10, 4], [11, 4], [12, 5], [6, 9], [7, 10], [8, 9], [9, 10], [5, 11], [10, 11]]) setPx(t, x, y, 30, 20, 10); },
    pumpkin_top: (t, r) => { noiseFill(t, [200, 120, 30], 16, r); for (let x = 6; x < 10; x++) for (let y = 6; y < 10; y++) setPx(t, x, y, 120, 80, 20); },
    lit_pumpkin: (t, r) => { pumpkin_face(t, r); for (const [x, y] of [[3, 4], [4, 4], [10, 4], [11, 4], [7, 10], [8, 9]]) setPx(t, x, y, 255, 220, 80); },
    nether_wart0: (t, r) => plantT(t, [150, 40, 40], r),
    nether_wart2: (t, r) => plantT(t, [190, 60, 60], r),
    shroom_brown: (t, r) => { t.fill(0); for (let x = 5; x < 11; x++) for (let y = 5; y < 9; y++) setPx(t, x, y, 130, 100, 80); for (let x = 6; x < 10; x++) setPx(t, x, 4, 150, 120, 90); setPx(t, 7, 9, 200, 190, 170); setPx(t, 8, 9, 200, 190, 170); setPx(t, 7, 10, 200, 190, 170); setPx(t, 8, 10, 200, 190, 170); },
    shroom_red: (t, r) => { t.fill(0); for (let x = 4; x < 12; x++) for (let y = 4; y < 9; y++) setPx(t, x, y, 200, 50, 45); for (const [x, y] of [[5, 5], [9, 6], [7, 7], [10, 5]]) setPx(t, x, y, 240, 240, 240); setPx(t, 7, 9, 220, 200, 180); setPx(t, 8, 9, 220, 200, 180); setPx(t, 7, 10, 220, 200, 180); setPx(t, 8, 10, 220, 200, 180); },
    crimson_fungus: (t, r) => { t.fill(0); for (let x = 5; x < 11; x++) for (let y = 4; y < 8; y++) setPx(t, x, y, 200, 60, 90); setPx(t, 7, 8, 180, 80, 90); setPx(t, 8, 9, 180, 80, 90); setPx(t, 7, 10, 180, 80, 90); },
    warped_fungus: (t, r) => { t.fill(0); for (let x = 5; x < 11; x++) for (let y = 4; y < 8; y++) setPx(t, x, y, 60, 180, 180); setPx(t, 7, 8, 50, 150, 150); setPx(t, 8, 9, 50, 150, 150); setPx(t, 7, 10, 50, 150, 150); },
    crimson_roots: (t, r) => plantT(t, [200, 80, 100], r),
    warped_roots: (t, r) => plantT(t, [60, 190, 190], r),
    shroomlight: (t, r) => { noiseFill(t, [230, 160, 90], 30, r); for (let i = 0; i < 10; i++) { const x = (r() * 16) | 0, y = (r() * 16) | 0; setPx(t, x, y, 255, 220, 140); } },
    weeping_vines: (t, r) => { t.fill(0); for (let y = 0; y < 16; y++) { setPx(t, 7, y, 190, 60, 60); if (y % 4 === 0) setPx(t, 8, y, 220, 90, 80); } },
    twisting_vines: (t, r) => { t.fill(0); for (let y = 0; y < 16; y++) { setPx(t, 7 + ((Math.sin(y * 0.8) * 2) | 0), y, 40, 170, 160); } },
    nether_sprouts: (t, r) => plantT(t, [60, 140, 120], r),
    spore_blossom: (t, r) => { t.fill(0); for (let x = 4; x < 12; x++) for (let y = 0; y < 4; y++) setPx(t, x, y, 180, 80, 120); for (let i = 0; i < 6; i++) setPx(t, 5 + i * 2, 5 + ((i % 2) * 2), 220, 140, 180); },
    dripstone: (t, r) => { t.fill(0); for (let y = 0; y < 14; y++) { setPx(t, 7, y, 140, 110, 80); setPx(t, 8, y, 120, 90, 60); } setPx(t, 7, 14, 170, 140, 100); },
    pointed_dripstone: (t, r) => { t.fill(0); for (let y = 0; y < 12; y++) setPx(t, 8, y, 150, 120, 85); setPx(t, 8, 12, 170, 140, 100); setPx(t, 8, 13, 180, 150, 110); setPx(t, 8, 14, 190, 160, 120); },
    amethyst_shard_tex: (t, r) => { t.fill(0); for (let i = 0; i < 10; i++) { setPx(t, 5 + (i >> 1), 12 - i, 150, 110, 200); setPx(t, 6 + (i >> 1), 12 - i, 120, 80, 180); } },
    large_fern: (t, r) => plantT(t, [50, 120, 50], r),
    rose_bush: (t, r) => { plantT(t, [60, 120, 50], r); setPx(t, 5, 6, 200, 50, 50); setPx(t, 10, 5, 200, 50, 50); },
    peony: (t, r) => { plantT(t, [70, 130, 60], r); setPx(t, 5, 5, 230, 120, 160); setPx(t, 10, 4, 230, 120, 160); },
    lilac: (t, r) => { plantT(t, [80, 130, 70], r); setPx(t, 5, 5, 180, 120, 220); setPx(t, 10, 5, 180, 120, 220); },
    pink_petals: (t, r) => { t.fill(0); for (let i = 0; i < 20; i++) setPx(t, (r() * 16) | 0, (r() * 16) | 0, 240, 170, 190); },
    moss_block: (t, r) => noiseFill(t, [60, 100, 45], 24, r),
    moss_carpet_t: (t, r) => carpetLike(t, [60, 100, 45], r),
    hanging_roots: (t, r) => { t.fill(0); for (let y = 0; y < 12; y++) { setPx(t, 6 + ((Math.sin(y) * 2) | 0), y, 70, 110, 60); setPx(t, 10, y, 60, 100, 55); } },
    vine: (t, r) => { t.fill(0); for (let y = 0; y < 16; y++) { setPx(t, 3, y, 50, 110, 40); setPx(t, 8, y, 60, 120, 45); setPx(t, 12, y, 50, 110, 40); if (y % 5 === 0) setPx(t, 4, y, 80, 140, 60); } },
    glow_lichen: (t, r) => { t.fill(0); for (let i = 0; i < 30; i++) { const x = (r() * 16) | 0, y = (r() * 16) | 0; setPx(t, x, y, 100, 220, 200, 220); } },
    sculk: (t, r) => { noiseFill(t, [15, 40, 55], 20, r); for (let i = 0; i < 10; i++) { const x = (r() * 16) | 0, y = (r() * 16) | 0; setPx(t, x, y, 60, 160, 180); } },
    sculk_vein: (t, r) => { t.fill(0); for (let i = 0; i < 20; i++) { const x = (r() * 16) | 0, y = (r() * 16) | 0; setPx(t, x, y, 40, 120, 140, 200); } },
    sculk_catalyst: (t, r) => { noiseFill(t, [20, 50, 65], 16, r); for (const [x, y] of [[7, 3], [8, 3], [7, 4], [8, 4], [6, 5], [9, 5]]) setPx(t, x, y, 120, 220, 240); },
    sculk_shrieker: (t, r) => { noiseFill(t, [25, 55, 70], 14, r); for (let x = 4; x < 12; x++) for (let y = 2; y < 6; y++) setPx(t, x, y, 90, 180, 200); },
    sculk_sensor: (t, r) => { noiseFill(t, [20, 45, 60], 14, r); for (let x = 3; x < 13; x++) setPx(t, x, 6, 100, 200, 220); },
    sponge: (t, r) => { noiseFill(t, [200, 200, 90], 24, r); for (let i = 0; i < 12; i++) { const x = (r() * 14) | 0, y = (r() * 14) | 0; setPx(t, x, y, 160, 160, 60); } },
    wet_sponge: (t, r) => { noiseFill(t, [160, 170, 80], 20, r); },
    hay: (t, r) => { noiseFill(t, [170, 150, 50], 18, r); for (let y = 0; y < 16; y += 4) for (let x = 0; x < 16; x++) setPx(t, x, y, 140, 120, 40); },
    honeycomb: (t, r) => { noiseFill(t, [220, 170, 60], 16, r); for (let i = 0; i < 8; i++) { const x = 2 + ((r() * 12) | 0), y = 2 + ((r() * 12) | 0); setPx(t, x, y, 180, 130, 40); setPx(t, x + 1, y, 180, 130, 40); } },
    beehive: (t, r) => { woodSide(t, [190, 150, 80], r); for (let x = 4; x < 12; x++) for (let y = 6; y < 12; y++) setPx(t, x, y, 120, 90, 40); },
    cobweb: (t, r) => { t.fill(0); for (let x = 0; x < 16; x++) for (let y = 0; y < 16; y++) { if (x === y || x + y === 15 || x === 8 || y === 8 || Math.abs(x - 8) + Math.abs(y - 8) === 6) setPx(t, x, y, 230, 230, 240, 160); } },
    snow_block: (t, r) => snowT(t, r),
    powder_snow: (t, r) => { noiseFill(t, [245, 250, 255], 6, r); },
    ice: (t, r) => iceT(t, r),
    packed_ice: (t, r) => { noiseFill(t, [130, 180, 240], 14, r); },
    blue_ice: (t, r) => { noiseFill(t, [110, 160, 240], 10, r); for (let i = 0; i < 6; i++) setPx(t, (r() * 16) | 0, (r() * 16) | 0, 180, 220, 255); },
    frosted_ice: (t, r) => { iceT(t, r); for (let i = 0; i < 10; i++) setPx(t, (r() * 16) | 0, (r() * 16) | 0, 200, 230, 255); },
    path: (t, r) => { dirtish(t, [140, 110, 80], r); for (let y = 2; y < 16; y += 4) for (let x = 0; x < 16; x++) setPx(t, x, y, 110, 85, 60); },
    farmland: (t, r) => { dirtish(t, [105, 70, 45], r); for (let y = 1; y < 16; y += 4) for (let x = 0; x < 16; x++) setPx(t, x, y, 75, 50, 30); },
    coral_tube: (t, r) => { t.fill(0); for (let y = 4; y < 16; y++) { setPx(t, 5, y, 230, 100, 160); setPx(t, 9, y, 240, 130, 90); if (y === 4) { setPx(t, 5, 3, 250, 150, 190); setPx(t, 9, 3, 250, 170, 120); } } },
    coral_fan: (t, r) => { t.fill(0); for (let x = 3; x < 13; x++) for (let y = 8; y < 14; y++) if (Math.abs(x - 8) + (y - 8) < 6) setPx(t, x, y, 220, 120, 60); setPx(t, 8, 14, 160, 90, 40); },
    coral_block: (t, r) => noiseFill(t, [220, 110, 140], 24, r),
    seagrass: (t, r) => plantT(t, [40, 130, 70], r),
    kelp: (t, r) => { t.fill(0); for (let y = 0; y < 16; y++) { setPx(t, 7 + ((Math.sin(y * 0.7) * 2) | 0), y, 50, 140, 80); } },
    sea_pickle: (t, r) => { t.fill(0); for (let x = 5; x < 11; x++) for (let y = 6; y < 14; y++) setPx(t, x, y, 120, 180, 80); for (let x = 6; x < 10; x++) setPx(t, x, 5, 160, 220, 120); },
    bubble_col: (t, r) => { t.fill(0); for (let i = 0; i < 10; i++) { const x = 2 + ((r() * 12) | 0), y = 2 + ((r() * 12) | 0); setPx(t, x, y, 200, 240, 255, 150); setPx(t, x + 1, y + 1, 220, 250, 255, 120); } },
    bedrock_side: (t, r) => bedrockT(t, r),
    iron_ore: (t, r) => oreT(t, [125, 125, 125], [210, 180, 150], r),
    deepslate_iron_ore: (t, r) => oreT(t, [65, 65, 70], [210, 180, 150], r),
    gold_ore: (t, r) => oreT(t, [125, 125, 125], [244, 214, 62], r),
    deepslate_gold_ore: (t, r) => oreT(t, [65, 65, 70], [244, 214, 62], r),
    copper_ore: (t, r) => oreT(t, [125, 125, 125], [190, 102, 67], r),
    deepslate_copper_ore: (t, r) => oreT(t, [65, 65, 70], [190, 102, 67], r),
    coal_ore: (t, r) => oreT(t, [125, 125, 125], [40, 40, 40], r),
    deepslate_coal_ore: (t, r) => oreT(t, [65, 65, 70], [40, 40, 40], r),
    diamond_ore: (t, r) => oreT(t, [125, 125, 125], [110, 230, 230], r),
    deepslate_diamond_ore: (t, r) => oreT(t, [65, 65, 70], [110, 230, 230], r),
    emerald_ore: (t, r) => oreT(t, [125, 125, 125], [50, 200, 100], r),
    deepslate_emerald_ore: (t, r) => oreT(t, [65, 65, 70], [50, 200, 100], r),
    lapis_ore: (t, r) => oreT(t, [125, 125, 125], [40, 80, 200], r),
    deepslate_lapis_ore: (t, r) => oreT(t, [65, 65, 70], [40, 80, 200], r),
    redstone_ore: (t, r) => oreT(t, [125, 125, 125], [220, 40, 40], r),
    deepslate_redstone_ore: (t, r) => oreT(t, [65, 65, 70], [220, 40, 40], r),
    nether_gold_ore: (t, r) => oreT(t, [110, 30, 30], [244, 214, 62], r),
    quartz_ore: (t, r) => oreT(t, [110, 30, 30], [235, 225, 220], r),
    ancient_debris: (t, r) => { noiseFill(t, [60, 45, 42], 20, r); for (let i = 0; i < 8; i++) { const x = (r() * 16) | 0, y = (r() * 16) | 0; setPx(t, x, y, 120, 80, 75); } },
    respawn_anchor0: (t, r) => { noiseFill(t, [50, 40, 60], 14, r); for (let x = 4; x < 12; x++) for (let y = 4; y < 12; y++) setPx(t, x, y, 30, 25, 40); },
    respawn_anchor4: (t, r) => { noiseFill(t, [50, 40, 60], 14, r); for (let x = 4; x < 12; x++) for (let y = 4; y < 12; y++) setPx(t, x, y, 220, 120, 255); },
    lodestone: (t, r) => { noiseFill(t, [120, 100, 60], 16, r); for (let x = 5; x < 11; x++) for (let y = 5; y < 11; y++) setPx(t, x, y, 60, 200, 180); },
    beacon_base: (t, r) => { noiseFill(t, [180, 200, 210], 10, r); },
    beacon_core: (t, r) => { noiseFill(t, [120, 220, 220], 20, r); for (let x = 5; x < 11; x++) for (let y = 5; y < 11; y++) setPx(t, x, y, 200, 255, 255); },
    conduit: (t, r) => { noiseFill(t, [60, 120, 140], 20, r); setPx(t, 7, 7, 150, 255, 255); setPx(t, 8, 8, 150, 255, 255); },
    jukebox_side: (t, r) => planks(t, [120, 90, 60], r),
    jukebox_top: (t, r) => { noiseFill(t, [90, 60, 40], 12, r); for (let x = 3; x < 13; x++) for (let y = 3; y < 13; y++) setPx(t, x, y, 40, 30, 20); },
    note_block: (t, r) => { planks(t, [150, 110, 70], r); setPx(t, 8, 8, 200, 60, 60); setPx(t, 7, 8, 200, 60, 60); },
    door_oak: (t, r) => { planks(t, [162, 130, 78], r); for (let y = 0; y < 16; y++) { setPx(t, 0, y, 110, 80, 40); setPx(t, 15, y, 110, 80, 40); } setPx(t, 12, 8, 220, 190, 80); setPx(t, 12, 9, 220, 190, 80); },
    trapdoor_oak: (t, r) => { planks(t, [162, 130, 78], r); for (let x = 2; x < 14; x++) setPx(t, x, 2, 110, 80, 40); for (let x = 2; x < 14; x++) setPx(t, x, 13, 110, 80, 40); },
    ladder: (t, r) => { t.fill(0); for (let y = 0; y < 16; y++) { setPx(t, 2, y, 130, 95, 50); setPx(t, 13, y, 130, 95, 50); } for (let y = 1; y < 16; y += 5) for (let x = 2; x < 14; x++) setPx(t, x, y, 150, 110, 60); },
    fence_oak: (t, r) => { woodSide(t, [150, 110, 60], r); for (let y = 0; y < 16; y++) { setPx(t, 6, y, 120, 85, 45); setPx(t, 9, y, 120, 85, 45); } },
    sign_oak: (t, r) => { planks(t, [162, 130, 78], r); for (let y = 4; y < 6; y++) for (let x = 2; x < 14; x++) setPx(t, x, y, 100, 70, 40); },
    button_oak: (t, r) => { t.fill(0); for (let x = 4; x < 12; x++) for (let y = 6; y < 10; y++) setPx(t, x, y, 150, 110, 60); },
    plate_oak: (t, r) => { t.fill(0); for (let x = 2; x < 14; x++) for (let y = 10; y < 14; y++) setPx(t, x, y, 150, 110, 60); },
    wool_white: (t, r) => woolT(t, [235, 235, 235], r),
    wool_red: (t, r) => woolT(t, [180, 60, 50], r),
    wool_blue: (t, r) => woolT(t, [50, 70, 180], r),
    wool_green: (t, r) => woolT(t, [70, 140, 60], r),
    wool_yellow: (t, r) => woolT(t, [220, 190, 60], r),
    wool_black: (t, r) => woolT(t, [30, 30, 30], r),
    wool_pink: (t, r) => woolT(t, [230, 150, 180], r),
    wool_cyan: (t, r) => woolT(t, [60, 160, 170], r),
    wool_orange: (t, r) => woolT(t, [220, 120, 40], r),
    wool_purple: (t, r) => woolT(t, [120, 60, 160], r),
    wool_lime: (t, r) => woolT(t, [120, 190, 60], r),
    wool_gray: (t, r) => woolT(t, [100, 100, 100], r),
    carpet_red: (t, r) => carpetLike(t, [180, 60, 50], r),
    concrete_white: (t, r) => solidColor(t, [200, 200, 200], r),
    concrete_orange: (t, r) => solidColor(t, [216, 127, 25], r),
    concrete_red: (t, r) => solidColor(t, [192, 77, 77], r),
    concrete_blue: (t, r) => solidColor(t, [71, 107, 194], r),
    concrete_light_blue: (t, r) => solidColor(t, [58, 179, 218], r),
    concrete_black: (t, r) => solidColor(t, [8, 10, 15], r),
    concrete_lime: (t, r) => solidColor(t, [143, 219, 37], r),
    concrete_pink: (t, r) => solidColor(t, [214, 147, 193], r),
    concrete_purple: (t, r) => solidColor(t, [125, 62, 192], r),
    concrete_cyan: (t, r) => solidColor(t, [21, 137, 145], r),
    concrete_gray: (t, r) => solidColor(t, [60, 68, 71], r),
    concrete_silver: (t, r) => solidColor(t, [155, 161, 167], r),
    concrete_yellow: (t, r) => solidColor(t, [230, 190, 45], r),
    concrete_green: (t, r) => solidColor(t, [77, 153, 77], r),
    concrete_magenta: (t, r) => solidColor(t, [186, 90, 174], r),
    concrete_brown: (t, r) => solidColor(t, [104, 81, 50], r),
    concrete_powder_white: (t, r) => solidColor(t, [207, 207, 207], r),
    terracotta_white: (t, r) => solidColor(t, [209, 178, 161], r),
    terracotta_orange2: (t, r) => solidColor(t, [160, 95, 83], r),
    terracotta_red: (t, r) => solidColor(t, [157, 51, 38], r),
    terracotta_blue: (t, r) => solidColor(t, [69, 73, 136], r),
    terracotta_yellow: (t, r) => solidColor(t, [183, 114, 32], r),
    terracotta_black: (t, r) => solidColor(t, [37, 22, 16], r),
    terracotta_pink: (t, r) => solidColor(t, [154, 77, 91], r),
    terracotta_cyan: (t, r) => solidColor(t, [76, 83, 85], r),
    terracotta_lime: (t, r) => solidColor(t, [132, 109, 40], r),
    terracotta_purple: (t, r) => solidColor(t, [89, 45, 89], r),
    terracotta_gray: (t, r) => solidColor(t, [54, 54, 61], r),
    terracotta_silver: (t, r) => solidColor(t, [102, 102, 102], r),
    terracotta_green: (t, r) => solidColor(t, [83, 95, 39], r),
    terracotta_brown: (t, r) => solidColor(t, [97, 63, 48], r),
    terracotta_magenta: (t, r) => solidColor(t, [149, 88, 108], r),
    terracotta_lightblue: (t, r) => solidColor(t, [133, 136, 153], r),
    glazing_white: (t, r) => { solidColor(t, [240, 240, 240], r); for (let i = 0; i < 6; i++) setPx(t, (r() * 16) | 0, (r() * 16) | 0, 255, 255, 255); },
    glazing_orange: (t, r) => { solidColor(t, [234, 127, 55], r); },
    glazing_red: (t, r) => { solidColor(t, [192, 57, 40], r); },
    glazing_blue: (t, r) => { solidColor(t, [74, 100, 192], r); },
    glazing_lime: (t, r) => { solidColor(t, [143, 219, 37], r); },
    glazing_pink: (t, r) => { solidColor(t, [237, 148, 193], r); },
    glazing_cyan: (t, r) => { solidColor(t, [21, 203, 196], r); },
    glazing_purple: (t, r) => { solidColor(t, [125, 62, 192], r); },
    glazing_yellow: (t, r) => { solidColor(t, [240, 209, 45], r); },
    glazing_black: (t, r) => { solidColor(t, [10, 10, 12], r); },
    glazing_green: (t, r) => { solidColor(t, [73, 141, 73], r); },
    glazing_brown: (t, r) => { solidColor(t, [104, 81, 50], r); },
    glazing_gray: (t, r) => { solidColor(t, [58, 64, 69], r); },
    glazing_silver: (t, r) => { solidColor(t, [151, 157, 163], r); },
    glazing_magenta: (t, r) => { solidColor(t, [186, 90, 174], r); },
    glazing_lightblue: (t, r) => { solidColor(t, [58, 179, 218], r); },
    stonebrick_slab: (t, r) => bricksT(t, [120, 120, 120], [90, 90, 90]),
    andesite: (t, r) => noiseFill(t, [137, 137, 137], 20, r),
    diorite: (t, r) => noiseFill(t, [180, 180, 180], 16, r),
    granite: (t, r) => noiseFill(t, [152, 109, 95], 20, r),
    smooth_stone: (t, r) => noiseFill(t, [140, 140, 140], 8, r),
    polished_andesite: (t, r) => noiseFill(t, [130, 140, 130], 8, r),
    polished_diorite: (t, r) => noiseFill(t, [185, 190, 195], 8, r),
    polished_granite: (t, r) => noiseFill(t, [160, 115, 100], 8, r),
    mossy_stone: (t, r) => { stoneTex(t, [125, 125, 125], r); for (let i = 0; i < 30; i++) setPx(t, (r() * 16) | 0, (r() * 16) | 0, 80, 130, 70, 190); },
    coal_ore_tex: (t, r) => oreT(t, [125, 125, 125], [40, 40, 40], r),
    ice_plains_tex: (t, r) => snowT(t, r),
    coarse_dirt: (t, r) => dirtish(t, [110, 70, 50], r),
    rootdirt: (t, r) => dirtish(t, [100, 65, 45], r),
    farmland_dry: (t, r) => { dirtish(t, [105, 70, 45], r); for (let y = 1; y < 16; y += 4) for (let x = 0; x < 16; x++) setPx(t, x, y, 75, 50, 30); },
    frame_empty: (t, r) => { noiseFill(t, [120, 120, 120], 10, r); for (let x = 2; x < 14; x++) { setPx(t, x, 2, 60, 60, 60); setPx(t, x, 13, 60, 60, 60); } },
    frame_filled: (t, r) => { noiseFill(t, [120, 120, 120], 10, r); for (let x = 5; x < 11; x++) for (let y = 5; y < 11; y++) setPx(t, x, y, 240, 220, 100); },
    target_outer: (t, r) => { noiseFill(t, [230, 230, 230], 8, r); for (let x = 0; x < 16; x++) for (let y = 0; y < 16; y++) if ((x + y) % 6 < 2) setPx(t, x, y, 40, 40, 40); },
    target_mid: (t, r) => { noiseFill(t, [240, 100, 60], 10, r); },
    target_inner: (t, r) => { noiseFill(t, [250, 250, 250], 6, r); },
    hay_block: (t, r) => hay(t, r),
    slime_block: (t, r) => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) setPx(t, x, y, 90, 200, 90, 200); for (let i = 0; i < 8; i++) setPx(t, (r() * 16) | 0, (r() * 16) | 0, 140, 230, 140, 220); },
    honey_block: (t, r) => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) setPx(t, x, y, 240, 180, 60, 210); },
    honey_top: (t, r) => { noiseFill(t, [240, 190, 70], 12, r); },
    honey_bottom: (t, r) => { noiseFill(t, [230, 180, 60], 12, r); },
    honey_side: (t, r) => { noiseFill(t, [235, 185, 65], 12, r); for (let y = 0; y < 16; y++) { setPx(t, 0, y, 200, 150, 40); setPx(t, 15, y, 200, 150, 40); } },
    honey_drrip: (t, r) => { noiseFill(t, [240, 190, 70], 10, r); setPx(t, 8, 12, 250, 210, 90); setPx(t, 8, 13, 250, 210, 90); },
    ochre: (t, r) => solidColor(t, [120, 100, 40], r),
    pearl: (t, r) => solidColor(t, [100, 160, 180], r),
    copper_grate: (t, r) => { metalT(t, [190, 102, 67], r); for (let x = 1; x < 16; x += 3) for (let y = 1; y < 16; y += 3) setPx(t, x, y, 60, 30, 20); },
    chainmail_tex: (t, r) => { noiseFill(t, [170, 175, 180], 12, r); for (let i = 0; i < 10; i++) { const x = (r() * 16) | 0, y = (r() * 16) | 0; setPx(t, x, y, 120, 125, 130); } },
    copper_door: (t, r) => { metalT(t, [190, 102, 67], r); for (let y = 0; y < 16; y++) { setPx(t, 0, y, 140, 70, 40); setPx(t, 15, y, 140, 70, 40); } setPx(t, 12, 8, 230, 200, 120); },
    copper_trap: (t, r) => { metalT(t, [190, 102, 67], r); },
    copper_bulb_on: (t, r) => { noiseFill(t, [250, 220, 120], 14, r); for (let x = 4; x < 12; x++) for (let y = 4; y < 12; y++) setPx(t, x, y, 255, 240, 160); },
    copper_bulb_off: (t, r) => { noiseFill(t, [120, 90, 60], 14, r); },
    copper_bulb_exposed: (t, r) => { noiseFill(t, [180, 150, 100], 14, r); },
    copper_bulb_oxidized: (t, r) => { noiseFill(t, [100, 130, 120], 14, r); },
    copper_grate_tex: (t, r) => copper_grate(t, r),
    candle_tex: (t, r) => { t.fill(0); for (let x = 5; x < 11; x++) for (let y = 4; y < 14; y++) setPx(t, x, y, 230, 220, 200); setPx(t, 7, 3, 255, 200, 80); setPx(t, 8, 2, 255, 230, 120); },
    cake_side: (t, r) => { noiseFill(t, [230, 200, 160], 10, r); for (let x = 0; x < 16; x++) { setPx(t, x, 2, 250, 240, 230); setPx(t, x, 3, 250, 240, 230); } },
    cake_top: (t, r) => { noiseFill(t, [250, 240, 230], 8, r); for (let i = 0; i < 4; i++) setPx(t, 3 + i * 3, 5, 220, 60, 60); },
    cake_eat: (t, r) => { noiseFill(t, [240, 220, 190], 10, r); },
    cookie_tex: (t, r) => { noiseFill(t, [190, 140, 80], 20, r); for (let i = 0; i < 5; i++) setPx(t, 3 + ((r() * 10) | 0), 3 + ((r() * 10) | 0), 90, 50, 30); },
    skull_skeleton: (t, r) => { noiseFill(t, [210, 210, 205], 12, r); setPx(t, 5, 6, 30, 30, 30); setPx(t, 6, 6, 30, 30, 30); setPx(t, 9, 6, 30, 30, 30); setPx(t, 10, 6, 30, 30, 30); for (let x = 5; x < 11; x++) setPx(t, x, 11, 40, 40, 40); },
    skull_wither: (t, r) => { noiseFill(t, [60, 60, 62], 10, r); setPx(t, 5, 6, 200, 200, 200); setPx(t, 9, 6, 200, 200, 200); },
    skull_zombie: (t, r) => { noiseFill(t, [90, 130, 90], 14, r); setPx(t, 5, 6, 20, 30, 20); setPx(t, 9, 6, 20, 30, 20); },
    skull_player: (t, r) => { noiseFill(t, [200, 160, 120], 12, r); setPx(t, 5, 7, 40, 40, 120); setPx(t, 9, 7, 40, 40, 120); },
    skull_dragon: (t, r) => { noiseFill(t, [40, 30, 50], 10, r); setPx(t, 5, 6, 160, 60, 200); setPx(t, 9, 6, 160, 60, 200); },
    skull_creeper: (t, r) => { noiseFill(t, [80, 170, 80], 14, r); setPx(t, 5, 6, 20, 40, 20); setPx(t, 9, 6, 20, 40, 20); setPx(t, 7, 8, 20, 40, 20); setPx(t, 8, 8, 20, 40, 20); },
    head_steve: (t, r) => skull_player(t, r),
    bell_body: (t, r) => { noiseFill(t, [220, 180, 60], 14, r); for (let x = 3; x < 13; x++) for (let y = 4; y < 12; y++) setPx(t, x, y, 240, 200, 80); },
    loom_tex: (t, r) => { planks(t, [150, 110, 70], r); for (let x = 4; x < 12; x++) setPx(t, x, 3, 200, 200, 200); },
    cartography_table: (t, r) => { planks(t, [110, 80, 50], r); for (let x = 2; x < 14; x++) for (let y = 2; y < 6; y++) setPx(t, x, y, 220, 210, 180); },
    fletching_table: (t, r) => { planks(t, [150, 120, 70], r); for (let y = 0; y < 16; y += 4) for (let x = 0; x < 16; x++) setPx(t, x, y, 120, 90, 50); },
    smithing_table: (t, r) => { noiseFill(t, [90, 90, 95], 12, r); for (let x = 3; x < 13; x++) for (let y = 3; y < 7; y++) setPx(t, x, y, 140, 100, 60); },
    grindstone_side: (t, r) => { noiseFill(t, [120, 120, 125], 12, r); },
    grindstone_top: (t, r) => { noiseFill(t, [150, 150, 155], 10, r); for (let x = 4; x < 12; x++) for (let y = 4; y < 12; y++) setPx(t, x, y, 100, 100, 105); },
    stonecutter_side: (t, r) => { noiseFill(t, [110, 110, 110], 12, r); },
    stonecutter_top: (t, r) => { noiseFill(t, [130, 130, 130], 10, r); for (let x = 2; x < 14; x++) setPx(t, x, 8, 80, 80, 85); },
    lectern_side: (t, r) => { planks(t, [120, 90, 55], r); },
    lectern_top: (t, r) => { noiseFill(t, [140, 105, 60], 10, r); for (let x = 3; x < 13; x++) for (let y = 3; y < 9; y++) setPx(t, x, y, 230, 220, 190); },
    cauldron_side: (t, r) => { noiseFill(t, [70, 70, 75], 10, r); for (let y = 2; y < 14; y++) { setPx(t, 1, y, 50, 50, 55); setPx(t, 14, y, 50, 50, 55); } },
    cauldron_top: (t, r) => { noiseFill(t, [60, 60, 65], 8, r); for (let x = 3; x < 13; x++) for (let y = 3; y < 13; y++) setPx(t, x, y, 40, 90, 160); },
    composter_side: (t, r) => { woodSide(t, [140, 100, 60], r); for (let x = 0; x < 16; x++) { setPx(t, x, 0, 100, 70, 40); } },
    composter_fill: (t, r) => { woodSide(t, [140, 100, 60], r); for (let x = 2; x < 14; x++) for (let y = 8; y < 14; y++) setPx(t, x, y, 90, 70, 40); },
    barrel_tex: (t, r) => barrel_side(t, r),
    campfire_log: (t, r) => { t.fill(0); for (let x = 2; x < 14; x++) for (let y = 8; y < 12; y++) setPx(t, x, y, 110, 75, 40); for (let x = 4; x < 12; x++) setPx(t, x, 6, 255, 160, 40); setPx(t, 8, 4, 255, 200, 60); },
    soul_campfire_tex: (t, r) => { t.fill(0); for (let x = 2; x < 14; x++) for (let y = 8; y < 12; y++) setPx(t, x, y, 90, 70, 50); for (let x = 4; x < 12; x++) setPx(t, x, 6, 100, 220, 200); },
    scaffolding: (t, r) => { t.fill(0); for (let y = 0; y < 16; y++) { setPx(t, 2, y, 160, 120, 60); setPx(t, 13, y, 160, 120, 60); } for (let y = 2; y < 16; y += 6) for (let x = 2; x < 14; x++) setPx(t, x, y, 180, 140, 70); },
    scaffolding_top: (t, r) => { noiseFill(t, [170, 130, 70], 12, r); },
    scaffolding_bottom: (t, r) => { noiseFill(t, [150, 110, 60], 12, r); },
    powdersnow_bucket: (t, r) => { noiseFill(t, [240, 248, 255], 8, r); },
    brush_tex: (t, r) => { t.fill(0); for (let y = 2; y < 12; y++) { setPx(t, 8, y, 150, 100, 50); } for (let x = 6; x < 11; x++) for (let y = 12; y < 15; y++) setPx(t, x, y, 200, 180, 140); },
    pot_open: (t, r) => { noiseFill(t, [150, 90, 60], 16, r); for (let x = 4; x < 12; x++) for (let y = 2; y < 6; y++) setPx(t, x, y, 60, 40, 30); },
    decorated_pot: (t, r) => { noiseFill(t, [170, 100, 65], 14, r); for (let x = 3; x < 13; x++) { setPx(t, x, 6, 60, 40, 30); setPx(t, x, 10, 60, 40, 30); } },
    suspicious_sand: (t, r) => { noiseFill(t, [219, 207, 163], 12, r); for (let i = 0; i < 6; i++) setPx(t, (r() * 16) | 0, (r() * 16) | 0, 180, 160, 120); },
    suspicious_gravel: (t, r) => { noiseFill(t, [125, 120, 115], 14, r); for (let i = 0; i < 6; i++) setPx(t, (r() * 16) | 0, (r() * 16) | 0, 90, 85, 80); },
    trial_spawner: (t, r) => { noiseFill(t, [60, 60, 70], 12, r); for (let x = 4; x < 12; x++) for (let y = 4; y < 12; y++) setPx(t, x, y, 200, 160, 60); },
    trial_spawner_active: (t, r) => { noiseFill(t, [60, 60, 70], 12, r); for (let x = 4; x < 12; x++) for (let y = 4; y < 12; y++) setPx(t, x, y, 60, 220, 240); },
    vault: (t, r) => { noiseFill(t, [50, 45, 60], 10, r); for (let x = 5; x < 11; x++) for (let y = 5; y < 11; y++) setPx(t, x, y, 220, 180, 60); },
    vault_unlocked: (t, r) => { noiseFill(t, [50, 45, 60], 10, r); for (let x = 5; x < 11; x++) for (let y = 5; y < 11; y++) setPx(t, x, y, 80, 240, 160); },
    heavy_core: (t, r) => { noiseFill(t, [30, 25, 35], 8, r); setPx(t, 7, 7, 255, 240, 200); setPx(t, 8, 8, 255, 240, 200); },
    wind_charge: (t, r) => { t.fill(0); for (let i = 0; i < 12; i++) setPx(t, 6 + ((r() * 4) | 0), 6 + ((r() * 4) | 0), 180, 240, 250, 200); },
    breeze_texture: (t, r) => { noiseFill(t, [120, 180, 190], 20, r); },
    ominous_bottle: (t, r) => { t.fill(0); for (let y = 4; y < 14; y++) { setPx(t, 7, y, 100, 60, 140); setPx(t, 8, y, 120, 80, 160); } setPx(t, 7, 3, 60, 40, 90); },
    echo_shard: (t, r) => { t.fill(0); for (let i = 0; i < 8; i++) setPx(t, 4 + i, 10 - i, 60, 180, 200); },
    recovery_compass_item: (t, r) => { t.fill(0); for (let x = 4; x < 12; x++) for (let y = 4; y < 12; y++) setPx(t, x, y, 200, 200, 210); setPx(t, 8, 5, 220, 60, 60); },
    froglegs_item: (t, r) => { noiseFill(t, [180, 120, 90], 20, r); },
    armadillo_scute: (t, r) => { noiseFill(t, [120, 90, 60], 16, r); },
    creaking_heart_tex: (t, r) => { noiseFill(t, [60, 50, 40], 12, r); setPx(t, 7, 7, 120, 100, 80); },
    resin_clump: (t, r) => { noiseFill(t, [180, 140, 80], 16, r); },
    resin_brick: (t, r) => bricksT(t, [170, 130, 70], [140, 100, 50]),
    pale_oak_log: (t, r) => woodSide(t, [190, 180, 165], r),
    pale_oak_planks: (t, r) => planks(t, [200, 190, 172], r),
    pale_leaves: (t, r) => leaves(t, [180, 200, 170], r),
    open_eyeblossom: (t, r) => flowerT(t, [120, 90, 160], [220, 220, 240], r),
    closed_eyeblossom: (t, r) => flowerT(t, [90, 70, 120], [180, 180, 200], r),
    pale_moss: (t, r) => noiseFill(t, [140, 150, 130], 20, r),
    creaking_tex: (t, r) => { noiseFill(t, [80, 70, 55], 16, r); },
    test_instance: (t, r) => solidColor(t, [100, 100, 200], r),
    structure_void: (t, r) => { t.fill(0); for (let i = 0; i < 16; i++) { setPx(t, i, i, 200, 100, 200, 100); setPx(t, i, 15 - i, 200, 100, 200, 100); } },
    barrier: (t, r) => { noiseFill(t, [220, 80, 80], 20, r); for (let x = 0; x < 16; x++) for (let y = 0; y < 16; y++) if ((x + y) % 8 < 4) setPx(t, x, y, 255, 255, 255, 200); },
    light_source: (t, r) => { noiseFill(t, [250, 240, 120], 10, r); },
    structure_block: (t, r) => { noiseFill(t, [180, 180, 190], 14, r); for (let x = 2; x < 14; x++) { setPx(t, x, 2, 100, 100, 110); setPx(t, x, 13, 100, 100, 110); } },
    jigsaw_block: (t, r) => { noiseFill(t, [150, 150, 160], 12, r); setPx(t, 8, 8, 60, 60, 70); },
    data_block_tex: (t, r) => { noiseFill(t, [120, 140, 120], 12, r); },
    camera_block: (t, r) => { noiseFill(t, [100, 100, 105], 10, r); },
    potion_enchant_glint: (t, r) => { noiseFill(t, [120, 80, 200], 30, r); },
    fire_0: (t, r) => { t.fill(0); for (let y = 6; y < 16; y++) for (let x = 2; x < 14; x++) { const d = (y - 6) / 10; if (r() < 0.6 + d * 0.3) setPx(t, x, y, 255, 120 + r() * 80, 20, 230); } for (let x = 5; x < 11; x++) setPx(t, x, 4, 255, 200, 60, 180); },
    fire_edge: (t, r) => { t.fill(0); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (r() < 0.3) setPx(t, x, y, 255, 140, 30, 200); },
    smoke_p: (t, r) => { t.fill(0); for (let i = 0; i < 30; i++) setPx(t, (r() * 16) | 0, (r() * 16) | 0, 60, 60, 60, 150); },
    portal_particle: (t, r) => { t.fill(0); for (let i = 0; i < 20; i++) setPx(t, (r() * 16) | 0, (r() * 16) | 0, 160, 60, 220, 200); },
    end_portal_part: (t, r) => { t.fill(0); for (let i = 0; i < 20; i++) setPx(t, (r() * 16) | 0, (r() * 16) | 0, 60, 220, 160, 200); },
    raindrop: (t, r) => { t.fill(0); for (let y = 2; y < 14; y++) setPx(t, 8, y, 150, 180, 230, 160); },
    snowflake: (t, r) => { t.fill(0); setPx(t, 8, 8, 250, 250, 255); setPx(t, 7, 7, 250, 250, 255); setPx(t, 9, 9, 250, 250, 255); },
    damage_icon: (t, r) => { t.fill(0); for (let i = 0; i < 10; i++) setPx(t, 8 + ((r() * 6) | 0) - 3, 8 + ((r() * 6) | 0) - 3, 255, 60, 60, 200); },
    heart_full: (t, r) => { t.fill(0); const H = [[3, 4], [4, 3], [5, 3], [6, 4], [7, 5], [8, 4], [9, 3], [10, 3], [11, 4], [12, 5], [4, 5], [5, 6], [6, 6], [7, 6], [8, 5], [9, 6], [10, 6], [11, 5], [5, 7], [6, 7], [7, 7], [8, 7], [9, 7], [10, 7], [6, 8], [7, 8], [8, 8], [9, 8], [7, 9], [8, 9]]; for (const [x, y] of H) setPx(t, x, y, 220, 40, 40); for (const [x, y] of [[4, 4], [5, 4], [6, 5]]) setPx(t, x, y, 255, 120, 120); },
    hunger_icon: (t, r) => { noiseFill(t, [180, 120, 60], 16, r); for (let x = 4; x < 12; x++) for (let y = 6; y < 12; y++) setPx(t, x, y, 200, 140, 70); setPx(t, 8, 4, 120, 80, 40); },
    armor_icon: (t, r) => { noiseFill(t, [150, 160, 170], 12, r); },
    bubble_icon: (t, r) => { t.fill(0); for (let x = 5; x < 11; x++) for (let y = 5; y < 11; y++) if (Math.hypot(x - 8, y - 8) < 3) setPx(t, x, y, 180, 220, 255, 220); },
    exp_orb: (t, r) => { t.fill(0); for (let x = 6; x < 10; x++) for (let y = 6; y < 10; y++) setPx(t, x, y, 120, 255, 60, 230); },
    arrow_proj: (t, r) => { t.fill(0); for (let x = 2; x < 14; x++) setPx(t, x, 8, 140, 100, 60); setPx(t, 13, 7, 200, 200, 200); setPx(t, 13, 8, 220, 220, 220); setPx(t, 2, 7, 240, 240, 240); setPx(t, 2, 9, 240, 240, 240); },
  };
  WC.texSpecs = TEXSPECS;

  // ---------- Build atlas ----------
  WC.buildAtlas = function () {
    const names = Object.keys(TEXSPECS);
    const cols = Math.ceil(Math.sqrt(names.length));
    const rows = Math.ceil(names.length / cols);
    const size = cols * TS;
    const pixels = new Uint8Array(size * size * 4);
    const tiles = {};
    names.forEach((n, i) => {
      const t = newTile();
      try { TEXSPECS[n](t, rngFor(n)); } catch (e) { console.warn('tex fail', n, e); }
      const col = i % cols, row = (i / cols) | 0;
      for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) {
        const si = (y * TS + x) * 4;
        const di = (((row * TS + y)) * size + (col * TS + x)) * 4;
        pixels[di] = t[si]; pixels[di + 1] = t[si + 1]; pixels[di + 2] = t[si + 2]; pixels[di + 3] = t[si + 3];
      }
      tiles[n] = { col, row };
    });
    tiles.count = names.length;
    tiles.cols = cols;
    tiles.size = size;
    WC.texTiles = tiles;
    WC.atlasPixels = pixels;
    return { pixels, size, count: names.length };
  };

  // ---------- Item icons (for UI, reuse atlas tiles + drawn shapes) ----------
  WC.itemIconCanvas = function (itemName, px = 32) {
    const it = WC.items[itemName];
    const cv = document.createElement('canvas');
    cv.width = cv.height = px;
    const c = cv.getContext('2d');
    c.imageSmoothingEnabled = false;
    const key = it && it.icon;
    if (key && WC.texTiles[key]) {
      drawAtlasTile(c, key, 0, 0, px);
      if (it.type === 'block') { /* flat ok */ }
    } else if (it && it.type === 'tool' || it && it.type === 'weapon' || it && it.type === 'armor' || it && it.type === 'food' || it && it.type === 'potion' || it && it.type === 'misc') {
      drawItemShape(c, it, px);
    } else if (key && WC.texTiles[key]) drawAtlasTile(c, key, 0, 0, px);
    else { c.fillStyle = '#888'; c.fillRect(2, 2, px - 4, px - 4); }
    return cv;
  };
  function drawAtlasTile(c, texName, dx, dy, size) {
    const t = WC.texTiles[texName];
    if (!t) return;
    const srcX = t.col * TS, srcY = t.row * TS;
    c.drawImage(WC.atlasCanvas, srcX, srcY, TS, TS, dx, dy, size, size);
  }
  WC.ensureAtlasCanvas = function () {
    if (WC.atlasCanvas) return;
    const cv = document.createElement('canvas');
    cv.width = cv.height = WC.texTiles.size;
    const c = cv.getContext('2d');
    const img = c.createImageData(cv.width, cv.height);
    img.data.set(WC.atlasPixels);
    c.putImageData(img, 0, 0);
    WC.atlasCanvas = cv;
  };
  function hexCol(cVal) {
    if (Array.isArray(cVal)) return `rgb(${cVal[0]},${cVal[1]},${cVal[2]})`;
    return cVal;
  }
  function drawItemShape(c, it, px) {
    const col = hexCol(it.color || [200, 200, 200]);
    const kind = it.icon || it.name;
    const s = px / 16;
    c.scale(s, s);
    const R = (x, y, w, h, color) => { c.fillStyle = color; c.fillRect(x, y, w, h); };
    const stick = '#8a5a2b';
    if (/pickaxe/.test(kind)) { R(2, 2, 12, 3, col); R(3, 5, 3, 2, col); R(10, 5, 3, 2, col); R(7, 4, 2, 11, stick); }
    else if (/axe|tomahawk/.test(kind)) { R(9, 2, 5, 4, col); R(8, 4, 4, 4, col); R(7, 3, 2, 12, stick); }
    else if (/sword/.test(kind)) { R(9, 2, 3, 9, col); R(10, 1, 2, 2, col); R(7, 10, 7, 2, stick); R(9, 12, 2, 3, '#5a4a2a'); }
    else if (/shovel/.test(kind)) { R(7, 2, 6, 5, col); R(8, 6, 2, 9, stick); }
    else if (/hoe/.test(kind)) { R(9, 3, 5, 3, col); R(8, 5, 2, 2, col); R(7, 5, 2, 10, stick); }
    else if (/shears/.test(kind)) { R(4, 2, 3, 8, col); R(9, 2, 3, 8, col); R(6, 9, 4, 4, '#aaa'); }
    else if (/flint_steel/.test(kind)) { R(3, 9, 10, 3, '#999'); R(9, 3, 4, 7, '#777'); R(10, 2, 2, 2, '#ccc'); }
    else if (/bow/.test(kind)) { c.strokeStyle = stick; c.lineWidth = 2; c.beginPath(); c.arc(11, 8, 6, -1.2, 1.2); c.stroke(); R(5, 2, 1, 12, '#ddd'); }
    else if (/crossbow/.test(kind)) { R(2, 3, 12, 2, col); R(7, 4, 2, 7, stick); R(4, 10, 8, 2, stick); }
    else if (/spear/.test(kind)) { R(3, 12, 11, 2, stick); R(11, 8, 4, 6, col); R(13, 3, 2, 6, col); R(12, 5, 4, 2, col); }
    else if (/mace/.test(kind)) { R(3, 12, 11, 2, stick); R(3, 3, 7, 8, col); R(2, 4, 1, 6, '#666'); R(10, 4, 1, 6, '#666'); }
    else if (/trident/.test(kind)) { R(7, 3, 2, 12, col); R(3, 2, 2, 6, col); R(11, 2, 2, 6, col); R(4, 7, 7, 2, col); }
    else if (/shield/.test(kind)) { R(3, 2, 10, 10, col); R(4, 12, 8, 2, shadeCss(col, 0.8)); R(7, 5, 2, 5, '#ddd'); }
    else if (/totem/.test(kind)) { R(5, 2, 6, 5, '#2a8'); R(4, 7, 8, 6, '#da3'); R(6, 9, 1, 2, '#000'); R(9, 9, 1, 2, '#000'); }
    else if (/elytra/.test(kind)) { R(2, 3, 5, 10, '#8aa'); R(9, 3, 5, 10, '#8aa'); R(7, 4, 2, 8, '#556'); }
    else if (/helmet/.test(kind)) { R(3, 4, 10, 6, col); R(3, 3, 10, 2, shadeCss(col, 1.1)); R(5, 10, 2, 3, col); R(9, 10, 2, 3, col); }
    else if (/chestplate/.test(kind)) { R(2, 4, 12, 8, col); R(2, 3, 4, 2, col); R(10, 3, 4, 2, col); R(7, 4, 2, 8, shadeCss(col, 0.8)); }
    else if (/leggings/.test(kind)) { R(3, 2, 10, 4, col); R(3, 6, 4, 8, col); R(9, 6, 4, 8, col); }
    else if (/boots/.test(kind)) { R(4, 2, 4, 8, col); R(4, 10, 7, 3, col); R(10, 2, 3, 8, shadeCss(col, 0.9)); }
    else if (/potion/.test(kind)) { R(6, 6, 4, 8, '#bbb'); R(7, 3, 2, 3, '#bbb'); R(6, 7, 4, 6, it.potionColor || '#a3f'); R(7, 2, 2, 1, '#865'); }
    else if (/tnt/.test(kind)) { R(3, 4, 10, 9, '#c33'); R(3, 6, 10, 3, '#eee'); c.fillStyle = '#000'; c.font = '5px sans-serif'; c.fillText('TNT', 4, 13); R(7, 2, 2, 2, '#fa0'); }
    else if (/food|apple|bread|meat|steak|pork|chicken|mutton|fish|cookie|cake|pie|salmon|cod|beet|soup|stew|berry|melon|pumpkin|carrot|potato|wheat_item|sugar|egg|milk|bucket_water|golden/.test(kind)) {
      R(4, 5, 8, 8, col); R(6, 3, 2, 2, '#5a3'); R(8, 3, 2, 2, '#5a3');
    }
    else if (/ingot|gem|crystal|shard|pearl|eye|rod|dust|leather|feather|bone|string|wool_item|clay|brick_item|netherite|scute|horn|membrane|cream|blaze|nugget|coal_item|quartz_item|amethyst|echo|recovery|heart|core|charge|bottle|guide|book_item|paper|map|compass|clock|name_tag|saddle|lead|brush|spyglass|disc|record|arrow_item|flint|gunpowder|slimeball|slime_ball|ink|glow_ink|prismarine|shulker_shell|shell|venison|frog_legs|armadillo|sniffer_egg|ominous|trial_key|wind/.test(kind)) {
      R(4, 6, 8, 5, col); R(5, 5, 6, 1, shadeCss(col, 1.2));
    }
    else if (/bucket/.test(kind)) { R(4, 5, 8, 8, '#aab'); R(4, 4, 8, 2, '#889'); if (kind.includes('water')) R(5, 7, 6, 5, '#36f'); if (kind.includes('lava')) R(5, 7, 6, 5, '#f63'); if (kind.includes('milk')) R(5, 7, 6, 5, '#fff'); if (kind.includes('powder')) R(5, 7, 6, 5, '#eef'); if (kind.includes('fish')) R(5, 8, 6, 3, '#5af'); }
    else if (/seed|sapling/.test(kind)) { R(6, 8, 4, 4, col); R(7, 5, 2, 3, '#5a3'); }
    else if (/music/.test(kind)) { R(4, 4, 8, 8, '#222'); R(7, 7, 2, 2, col); }
    else if (/spawner|egg_spawn/.test(kind)) { R(3, 3, 10, 10, '#345'); for (let i = 0; i < 6; i++) R(4 + i * 2, 4 + (i % 3) * 3, 1, 1, '#8cf'); }
    else { R(4, 4, 8, 8, col); }
  }
  function shadeCss(col, f) {
    const m = String(col).match(/\d+/g);
    if (!m) return col;
    return `rgb(${m.slice(0, 3).map(v => Math.min(255, v * f | 0)).join(',')})`;
  }
})();
