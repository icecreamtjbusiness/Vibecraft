// ============================================================
// Texture system: procedural 16x16 pixel-art textures in MC style.
// Each block face texture is generated onto a canvas; all are
// packed into one big atlas (grid of 16x16 tiles) for rendering.
// ============================================================
(function () {
  'use strict';
  const WC = window.WC;
  const T = (WC.tex = {});
  const TILE = 16, ATLAS_COLS = 32;

  // ---------- helpers ----------
  function rng(seed) { return WC.rng(WC.hashString(seed)); }
  function hex(c) { return c; }
  function mix(a, b, t) { // blend two [r,g,b]
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  }
  function rgb(c) { return `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`; }

  // Base painter: draws pixels with noise variation
  function base(ctx, seed, colorA, colorB, variance = 0.18) {
    const r = rng(seed);
    const A = colorA, B = colorB;
    for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
      const t = r();
      let c = mix(A, B, (t - 0.5) * 2 * variance + variance);
      ctx.fillStyle = rgb(c);
      ctx.fillRect(x, y, 1, 1);
    }
  }

  // Stone-like speckle
  function stone(ctx, seed, colA, colB) {
    base(ctx, seed, colA, colB, 0.35);
    const r = rng(seed + 'sp');
    for (let i = 0; i < 24; i++) {
      const x = (r() * 16) | 0, y = (r() * 16) | 0;
      ctx.fillStyle = rgb(mix(colB, [0, 0, 0], 0.25 + r() * 0.2));
      ctx.fillRect(x, y, 1 + ((r() * 2) | 0), 1);
    }
  }

  // Dirt-like
  function dirt(ctx, seed) {
    const A = [134, 96, 67], B = [101, 71, 51];
    base(ctx, seed, A, B, 0.5);
    const r = rng(seed + 'd');
    for (let i = 0; i < 30; i++) {
      const x = (r() * 16) | 0, y = (r() * 16) | 0;
      ctx.fillStyle = rgb(mix(A, [60, 40, 25], 0.5 + r() * 0.4));
      ctx.fillRect(x, y, 1, 1);
    }
  }

  // Grass top
  function grassTop(ctx, seed) {
    const A = [116, 169, 74], B = [94, 140, 60];
    base(ctx, seed, A, B, 0.45);
    const r = rng(seed + 'g');
    for (let i = 0; i < 40; i++) {
      const x = (r() * 16) | 0, y = (r() * 16) | 0;
      ctx.fillStyle = rgb(mix(A, [140, 190, 90], r()));
      ctx.fillRect(x, y, 1, 1);
    }
  }

  // Grass side
  function grassSide(ctx, seed) {
    dirt(ctx, seed);
    const r = rng(seed + 'gs');
    // green overlay with jagged edge
    for (let x = 0; x < 16; x++) {
      const h = 2 + ((r() * 3) | 0);
      for (let y = 0; y < h; y++) {
        const g = mix([116, 169, 74], [80, 120, 50], r());
        ctx.fillStyle = rgb(g);
        ctx.fillRect(x, y, 1, 1);
      }
      if (r() > 0.5) { ctx.fillStyle = rgb(mix([116, 169, 74], [60, 90, 40], 0.5)); ctx.fillRect(x, h, 1, 1); }
    }
  }

  // Log side (vertical bark)
  function logSide(ctx, seed, dark, light) {
    const r = rng(seed);
    for (let x = 0; x < 16; x++) {
      const stripe = (Math.sin(x * 1.7 + r() * 0.5) * 0.5 + 0.5);
      for (let y = 0; y < 16; y++) {
        let c = mix(dark, light, stripe * 0.6 + r() * 0.25);
        if (r() > 0.93) c = mix(c, [0, 0, 0], 0.3);
        ctx.fillStyle = rgb(c); ctx.fillRect(x, y, 1, 1);
      }
    }
  }
  function logTop(ctx, seed, ringA, ringB) {
    const r = rng(seed);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const dx = x - 7.5, dy = y - 7.5;
      const d = Math.sqrt(dx * dx + dy * dy);
      const ring = (Math.sin(d * 2.2) * 0.5 + 0.5);
      ctx.fillStyle = rgb(mix(ringA, ringB, ring * 0.7 + r() * 0.15));
      ctx.fillRect(x, y, 1, 1);
    }
  }

  // Planks
  function planks(ctx, seed, c1, c2) {
    const r = rng(seed);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const row = (y / 4) | 0;
      let c = mix(c1, c2, r() * 0.5 + (row % 2) * 0.15);
      if (y % 4 === 3) c = mix(c, [0, 0, 0], 0.35); // seam
      if ((x + row * 8) % 16 === 0 && y % 4 !== 3) c = mix(c, [0, 0, 0], 0.3); // vertical seam
      ctx.fillStyle = rgb(c); ctx.fillRect(x, y, 1, 1);
    }
  }

  // Leaves
  function leaves(ctx, seed, colA, colB) {
    const r = rng(seed);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      if (r() > 0.12) {
        ctx.fillStyle = rgb(mix(colA, colB, r()));
        ctx.fillRect(x, y, 1, 1);
      } else {
        ctx.fillStyle = rgb(mix(colA, [0, 0, 0], 0.6));
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }

  // Sand / gravel
  function grains(ctx, seed, colA, colB, n = 60) {
    base(ctx, seed, colA, colB, 0.4);
    const r = rng(seed + 'gr');
    for (let i = 0; i < n; i++) {
      const x = (r() * 16) | 0, y = (r() * 16) | 0;
      ctx.fillStyle = rgb(mix(colB, [40, 40, 40], r() * 0.6));
      ctx.fillRect(x, y, 1, 1);
    }
  }

  // Ore: stone bg + colored blobs
  function ore(ctx, seed, oreCol) {
    stone(ctx, seed, [125, 125, 125], [100, 100, 100]);
    const r = rng(seed + 'ore');
    const blobs = 4 + ((r() * 4) | 0);
    for (let b = 0; b < blobs; b++) {
      const bx = 2 + ((r() * 12) | 0), by = 2 + ((r() * 12) | 0);
      const size = 2 + ((r() * 2) | 0);
      for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        if (r() > 0.25) {
          ctx.fillStyle = rgb(mix(oreCol, [255, 255, 255], r() * 0.25));
          ctx.fillRect(bx + x, by + y, 1, 1);
        }
      }
    }
  }

  // Cobblestone
  function cobble(ctx, seed) {
    const r = rng(seed);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const v = (Math.sin(x * 1.3 + y * 2.1) + Math.cos(x * 2.7 - y)) * 0.25 + 0.5;
      let c = mix([100, 100, 100], [160, 160, 160], v);
      if (r() > 0.85) c = mix(c, [60, 60, 60], 0.6);
      ctx.fillStyle = rgb(c); ctx.fillRect(x, y, 1, 1);
    }
    // cracks
    ctx.fillStyle = 'rgba(40,40,40,0.55)';
    for (let i = 0; i < 6; i++) {
      let x = (r() * 16) | 0, y = (r() * 16) | 0;
      for (let s = 0; s < 4 + r() * 4; s++) { ctx.fillRect(x, y, 1, 1); x += (r() * 3 | 0) - 1; y += (r() * 3 | 0) - 1; }
    }
  }

  // Bricks
  function bricks(ctx, seed, mortar, brick) {
    const r = rng(seed);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const row = (y / 4) | 0;
      const off = (row % 2) * 4;
      let c = brick.map((v, i) => v + (r() - 0.5) * 24);
      if (y % 4 === 0 || (x + off) % 8 === 0) c = mortar;
      ctx.fillStyle = rgb(c); ctx.fillRect(x, y, 1, 1);
    }
  }

  // Glass
  function glass(ctx) {
    ctx.clearRect(0, 0, 16, 16);
    ctx.fillStyle = 'rgba(200,230,255,0.18)'; ctx.fillRect(0, 0, 16, 16);
    ctx.strokeStyle = 'rgba(210,240,255,0.85)'; ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, 15, 15);
    ctx.beginPath(); ctx.moveTo(2, 13); ctx.lineTo(13, 2); ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.stroke();
  }

  // Water
  function water(ctx, seed) {
    const A = [40, 100, 200], B = [30, 80, 180];
    base(ctx, seed, A, B, 0.3);
    const r = rng(seed + 'w');
    for (let i = 0; i < 10; i++) {
      const y = (r() * 16) | 0, x = (r() * 12) | 0, w = 3 + ((r() * 5) | 0);
      ctx.fillStyle = 'rgba(120,180,255,0.35)'; ctx.fillRect(x, y, w, 1);
    }
  }

  // Torch
  function torch(ctx) {
    ctx.clearRect(0, 0, 16, 16);
    for (let y = 6; y < 16; y++) { ctx.fillStyle = y < 8 ? '#6b4a2b' : '#8a5a2b'; ctx.fillRect(7, y, 2, 1); }
    ctx.fillStyle = '#ffdf70'; ctx.fillRect(6, 3, 4, 3);
    ctx.fillStyle = '#ff9a2a'; ctx.fillRect(7, 2, 2, 2);
    ctx.fillStyle = '#fff6c8'; ctx.fillRect(7, 3, 2, 1);
  }

  // Flower / plant cross shapes
  function flower(ctx, petalCol, centerCol) {
    ctx.clearRect(0, 0, 16, 16);
    ctx.fillStyle = '#3e7d2f'; ctx.fillRect(7, 8, 2, 8);
    ctx.fillStyle = '#5aa03c'; ctx.fillRect(5, 10, 2, 2); ctx.fillRect(9, 12, 2, 2);
    ctx.fillStyle = petalCol; ctx.fillRect(6, 4, 4, 4); ctx.fillRect(5, 5, 6, 2);
    ctx.fillStyle = centerCol; ctx.fillRect(7, 5, 2, 2);
  }
  function tallGrass(ctx, seed) {
    ctx.clearRect(0, 0, 16, 16);
    const r = rng(seed);
    for (let i = 0; i < 8; i++) {
      const x = 1 + ((r() * 14) | 0);
      const h = 5 + ((r() * 9) | 0);
      ctx.fillStyle = rgb(mix([90, 150, 60], [140, 190, 80], r()));
      for (let y = 0; y < h; y++) ctx.fillRect(x, 16 - y - 1, 1, 1);
    }
  }

  // Sapling
  function sapling(ctx) {
    ctx.clearRect(0, 0, 16, 16);
    ctx.fillStyle = '#6b4a2b'; ctx.fillRect(7, 9, 2, 7);
    ctx.fillStyle = '#3f8f2f'; ctx.fillRect(4, 4, 8, 5); ctx.fillRect(6, 2, 4, 2);
    ctx.fillStyle = '#57b044'; ctx.fillRect(5, 5, 3, 2); ctx.fillRect(9, 4, 2, 2);
  }

  // Snow
  function snow(ctx, seed) { base(ctx, seed, [240, 248, 255], [215, 230, 245], 0.25); }

  // Netherrack
  function netherrack(ctx, seed) {
    const r = rng(seed);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const v = r();
      let c = v > 0.7 ? [150, 60, 50] : v > 0.35 ? [120, 45, 38] : [90, 32, 28];
      c = c.map(t => t + (r() - 0.5) * 20);
      ctx.fillStyle = rgb(c); ctx.fillRect(x, y, 1, 1);
    }
  }
  // Soul sand
  function soulSand(ctx, seed) {
    grains(ctx, seed, [80, 62, 48], [60, 45, 35], 40);
    const r = rng(seed + 'soul');
    for (let i = 0; i < 5; i++) {
      const x = 2 + ((r() * 12) | 0), y = 2 + ((r() * 12) | 0);
      ctx.fillStyle = 'rgba(30,25,20,0.8)';
      ctx.fillRect(x, y, 1, 2); ctx.fillRect(x + 2, y, 1, 2);
      ctx.fillRect(x, y + 3, 3, 1);
    }
  }
  // Glowstone
  function glowstone(ctx, seed) {
    base(ctx, seed, [200, 160, 70], [170, 120, 50], 0.4);
    const r = rng(seed + 'gl');
    for (let i = 0; i < 14; i++) {
      const x = (r() * 14) | 0, y = (r() * 14) | 0;
      ctx.fillStyle = '#ffeeb0'; ctx.fillRect(x, y, 2, 2);
    }
  }
  // Obsidian
  function obsidian(ctx, seed) {
    base(ctx, seed, [22, 15, 40], [12, 8, 25], 0.5);
    const r = rng(seed + 'ob');
    for (let i = 0; i < 10; i++) {
      ctx.fillStyle = 'rgba(90,60,150,0.5)';
      ctx.fillRect((r() * 15) | 0, (r() * 15) | 0, 2, 1);
    }
  }
  // Bedrock
  function bedrock(ctx, seed) {
    stone(ctx, seed, [85, 85, 85], [40, 40, 40]);
    const r = rng(seed + 'br');
    for (let i = 0; i < 20; i++) { ctx.fillStyle = '#111'; ctx.fillRect((r() * 16) | 0, (r() * 16) | 0, 2, 2); }
  }
  // End stone
  function endStone(ctx, seed) {
    base(ctx, seed, [220, 220, 150], [190, 190, 120], 0.35);
    const r = rng(seed + 'es');
    for (let i = 0; i < 20; i++) { ctx.fillStyle = 'rgba(150,150,90,0.6)'; ctx.fillRect((r() * 16) | 0, (r() * 16) | 0, 1, 1); }
  }
  // Purpur
  function purpur(ctx, seed) {
    base(ctx, seed, [170, 120, 170], [140, 90, 140], 0.4);
    const r = rng(seed + 'pu');
    for (let i = 0; i < 20; i++) { ctx.fillStyle = 'rgba(200,160,200,0.7)'; ctx.fillRect((r() * 15) | 0, (r() * 15) | 0, 2, 1); }
  }
  // Crying obsidian
  function cryingObsidian(ctx, seed) {
    obsidian(ctx, seed);
    const r = rng(seed + 'cry');
    for (let i = 0; i < 6; i++) {
      const x = 1 + ((r() * 14) | 0), y = (r() * 10) | 0;
      ctx.fillStyle = '#c23ce8'; ctx.fillRect(x, y, 1, 3 + ((r() * 4) | 0));
      ctx.fillStyle = '#e87bff'; ctx.fillRect(x, y + 1, 1, 1);
    }
  }
  // Portal blocks
  function portalTex(ctx, seed) {
    base(ctx, seed, [120, 40, 200], [80, 20, 160], 0.5);
    const r = rng(seed + 'por');
    for (let i = 0; i < 12; i++) { ctx.fillStyle = 'rgba(220,180,255,0.6)'; ctx.fillRect((r() * 15) | 0, (r() * 15) | 0, 2, 1); }
  }
  // Lava
  function lava(ctx, seed) {
    base(ctx, seed, [220, 100, 20], [180, 60, 10], 0.4);
    const r = rng(seed + 'lv');
    for (let i = 0; i < 12; i++) {
      const x = (r() * 12) | 0, y = (r() * 16) | 0;
      ctx.fillStyle = 'rgba(255,220,80,0.7)'; ctx.fillRect(x, y, 4 + ((r() * 4) | 0), 1);
    }
  }
  // Metal blocks
  function metalBlock(ctx, seed, colA, colB) {
    base(ctx, seed, colA, colB, 0.25);
    const r = rng(seed + 'm');
    for (let i = 0; i < 8; i++) { ctx.fillStyle = rgb(mix(colA, [255, 255, 255], 0.5)); ctx.fillRect((r() * 14) | 0, (r() * 14) | 0, 2, 1); }
    ctx.strokeStyle = rgb(mix(colB, [0, 0, 0], 0.4)); ctx.strokeRect(0.5, 0.5, 15, 15);
  }
  // Wood door
  function doorTex(ctx, seed, c1, c2) {
    planks(ctx, seed, c1, c2);
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(0, 0, 1, 16); ctx.fillRect(15, 0, 1, 16); ctx.fillRect(0, 0, 16, 1); ctx.fillRect(0, 15, 16, 1);
    ctx.fillStyle = '#d8d8d8'; ctx.fillRect(12, 8, 2, 2);
  }
  // Crafting table
  function craftingTable(ctx, seed) {
    planks(ctx, 'craft_top', [160, 120, 70], [130, 95, 55]);
    ctx.fillStyle = '#5a3d22'; ctx.fillRect(0, 0, 16, 2);
    ctx.fillStyle = '#7a5230'; ctx.fillRect(2, 2, 12, 12);
    ctx.fillStyle = '#4a3018'; ctx.fillRect(3, 3, 4, 4); ctx.fillRect(9, 3, 4, 4); ctx.fillRect(3, 9, 4, 4); ctx.fillRect(9, 9, 4, 4);
    ctx.fillStyle = '#9a7a4a'; ctx.fillRect(4, 4, 2, 2); ctx.fillRect(10, 10, 2, 2);
  }
  function craftingSide(ctx, seed) {
    planks(ctx, seed + 'cs', [150, 110, 65], [120, 88, 50]);
    ctx.fillStyle = '#4a3018'; ctx.fillRect(1, 4, 6, 6); ctx.fillRect(9, 4, 6, 6);
    ctx.fillStyle = '#8a6a3a'; ctx.fillRect(2, 5, 4, 4); ctx.fillRect(10, 5, 4, 4);
  }
  // Furnace
  function furnaceFront(ctx) {
    stone(ctx, 'furn', [110, 110, 110], [85, 85, 85]);
    ctx.fillStyle = '#2b2b2b'; ctx.fillRect(3, 10, 10, 5);
    ctx.fillStyle = '#555'; ctx.fillRect(3, 4, 10, 3);
    ctx.fillStyle = '#ff9a2a'; ctx.fillRect(4, 11, 8, 3);
    ctx.fillStyle = '#ffd070'; ctx.fillRect(5, 12, 6, 1);
  }
  function furnaceSide(ctx, seed) { stone(ctx, seed + 'fs', [110, 110, 110], [85, 85, 85]); }
  function furnaceTop(ctx, seed) { stone(ctx, seed + 'ft', [100, 100, 100], [75, 75, 75]); ctx.fillStyle = '#333'; ctx.fillRect(4, 4, 8, 8); ctx.strokeStyle = '#666'; ctx.strokeRect(4.5, 4.5, 7, 7); }
  // Chest
  function chestTop(ctx, seed) { planks(ctx, seed + 'ct', [140, 100, 55], [110, 78, 42]); ctx.fillStyle = '#3a2a12'; ctx.fillRect(0, 7, 16, 2); ctx.fillStyle = '#c9a227'; ctx.fillRect(6, 6, 4, 4); }
  function chestSide(ctx, seed) { planks(ctx, seed + 'cx', [140, 100, 55], [110, 78, 42]); ctx.fillStyle = '#3a2a12'; ctx.fillRect(0, 5, 16, 1); ctx.fillStyle = '#c9a227'; ctx.fillRect(7, 4, 2, 4); }
  // Bed
  function bedTop(ctx) { ctx.fillStyle = '#c33'; ctx.fillRect(0, 0, 16, 16); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 16, 6); ctx.strokeStyle = '#801010'; ctx.strokeRect(0.5, 0.5, 15, 15); }
  function bedSide(ctx) { ctx.fillStyle = '#c33'; ctx.fillRect(0, 2, 16, 8); ctx.fillStyle = '#ddd'; ctx.fillRect(0, 2, 6, 8); ctx.fillStyle = '#6b4a2b'; ctx.fillRect(0, 10, 16, 6); }
  // Bookshelf
  function bookshelf(ctx, seed) {
    planks(ctx, seed + 'bs', [150, 110, 65], [120, 88, 50]);
    const cols = ['#a33', '#3a5', '#55a', '#a83', '#83a'];
    const r = rng(seed + 'bk');
    for (let shelf = 0; shelf < 2; shelf++) {
      const y0 = 3 + shelf * 7;
      for (let x = 1; x < 15; x += 2) {
        ctx.fillStyle = cols[(r() * cols.length) | 0];
        ctx.fillRect(x, y0, 2, 5);
        ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(x, y0 + 4, 2, 1);
      }
    }
  }
  // Enchanting table
  function enchantTop(ctx, seed) {
    obsidian(ctx, seed + 'en');
    ctx.fillStyle = '#2a1a3a'; ctx.fillRect(2, 2, 12, 12);
    ctx.fillStyle = '#e8d8b0'; ctx.fillRect(5, 5, 6, 4);
    ctx.fillStyle = '#c9a227'; ctx.fillRect(6, 6, 4, 2);
  }
  function enchantSide(ctx, seed) { obsidian(ctx, seed + 'ens'); ctx.fillStyle = 'rgba(200,160,255,0.25)'; ctx.fillRect(0, 0, 16, 4); }
  // Anvil
  function anvilTex(ctx) {
    ctx.fillStyle = '#565656'; ctx.fillRect(2, 4, 12, 3); ctx.fillRect(6, 7, 4, 4); ctx.fillRect(3, 11, 10, 3);
    ctx.fillStyle = '#3c3c3c'; ctx.fillRect(2, 7, 12, 1); ctx.fillRect(4, 4, 8, 1);
  }
  // Fence
  function fenceTex(ctx, seed) {
    ctx.clearRect(0, 0, 16, 16);
    ctx.fillStyle = rgb(mix([150, 110, 65], [120, 88, 50], 0.3)); ctx.fillRect(6, 0, 4, 16);
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(6, 3, 4, 1); ctx.fillRect(6, 12, 4, 1);
  }
  // Ladder
  function ladderTex(ctx) {
    ctx.clearRect(0, 0, 16, 16);
    ctx.fillStyle = '#8a5a2b'; ctx.fillRect(2, 0, 2, 16); ctx.fillRect(12, 0, 2, 16);
    ctx.fillStyle = '#a06a35'; for (let y = 2; y < 16; y += 5) ctx.fillRect(2, y, 12, 2);
  }
  // Redstone stuff
  function redstoneDust(ctx) {
    ctx.clearRect(0, 0, 16, 16);
    ctx.fillStyle = 'rgba(150,20,20,0.8)';
    ctx.fillRect(7, 7, 2, 2); ctx.fillRect(4, 7, 2, 2); ctx.fillRect(10, 7, 2, 2); ctx.fillRect(7, 4, 2, 2); ctx.fillRect(7, 10, 2, 2);
  }
  function redstoneTorchOff(ctx) { torch(ctx); ctx.fillStyle = '#5a2a10'; ctx.fillRect(6, 3, 4, 3); }
  function repeaterTex(ctx) {
    ctx.clearRect(0, 0, 16, 16);
    ctx.fillStyle = '#7a4a4a'; ctx.fillRect(2, 10, 12, 4);
    ctx.fillStyle = '#c02020'; ctx.fillRect(4, 11, 2, 2); ctx.fillRect(10, 11, 2, 2);
  }
  function leverTex(ctx) {
    ctx.clearRect(0, 0, 16, 16);
    ctx.fillStyle = '#777'; ctx.fillRect(6, 10, 4, 4);
    ctx.fillStyle = '#8a5a2b'; ctx.fillRect(7, 4, 2, 7);
    ctx.fillStyle = '#444'; ctx.fillRect(6, 3, 4, 2);
  }
  function buttonTex(ctx) {
    ctx.clearRect(0, 0, 16, 16);
    ctx.fillStyle = '#8a8a8a'; ctx.fillRect(5, 7, 6, 4); ctx.fillStyle = '#666'; ctx.fillRect(6, 8, 4, 2);
  }
  function pressurePlate(ctx) {
    ctx.clearRect(0, 0, 16, 16);
    ctx.fillStyle = '#8a8a8a'; ctx.fillRect(2, 12, 12, 3); ctx.fillStyle = '#666'; ctx.fillRect(2, 12, 12, 1);
  }
  // Wool colors handled parametrically
  function wool(ctx, seed, col) {
    base(ctx, seed, col, col.map(v => v * 0.8), 0.3);
    const r = rng(seed + 'wo');
    for (let i = 0; i < 30; i++) { ctx.fillStyle = rgb(mix(col, [255, 255, 255], r() * 0.4)); ctx.fillRect((r() * 16) | 0, (r() * 16) | 0, 1, 1); }
  }
  // Carpet
  function carpet(ctx, seed, col) {
    ctx.clearRect(0, 0, 16, 16);
    base(ctx, seed, col, col.map(v => v * 0.85), 0.3);
    ctx.clearRect(0, 0, 16, 12);
  }
  // Concrete powder
  function powder(ctx, seed, col) { grains(ctx, seed, col, col.map(v => v * 0.88), 40); }
  // Terracotta
  function terracotta(ctx, seed, col) { stone(ctx, seed, col, col.map(v => v * 0.85)); }
  // Clay
  function clay(ctx, seed) { base(ctx, seed, [160, 160, 175], [140, 140, 155], 0.3); }
  // Farmland / podzol / mycelium / moss
  function farmland(ctx, seed) {
    dirt(ctx, seed);
    ctx.fillStyle = 'rgba(60,40,25,0.8)';
    for (let y = 1; y < 16; y += 4) ctx.fillRect(0, y, 16, 1);
  }
  function mycelium(ctx, seed) {
    dirt(ctx, seed);
    const r = rng(seed + 'my');
    for (let i = 0; i < 40; i++) { ctx.fillStyle = 'rgba(150,140,160,0.7)'; ctx.fillRect((r() * 16) | 0, (r() * 16) | 0, 1, 1); }
  }
  function podzol(ctx, seed) {
    dirt(ctx, seed);
    const r = rng(seed + 'pz');
    for (let i = 0; i < 30; i++) { ctx.fillStyle = 'rgba(90,60,20,0.8)'; ctx.fillRect((r() * 16) | 0, (r() * 16) | 0, 2, 1); }
  }
  function mossBlock(ctx, seed) {
    base(ctx, seed, [80, 110, 50], [60, 90, 40], 0.5);
    const r = rng(seed + 'mo');
    for (let i = 0; i < 30; i++) { ctx.fillStyle = 'rgba(120,160,80,0.8)'; ctx.fillRect((r() * 16) | 0, (r() * 16) | 0, 1, 1); }
  }
  // Ice / packed ice / blue ice
  function iceTex(ctx, seed, colA, colB) {
    base(ctx, seed, colA, colB, 0.25);
    const r = rng(seed + 'ic');
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    for (let i = 0; i < 4; i++) { ctx.beginPath(); const x = r() * 16, y = r() * 16; ctx.moveTo(x, y); ctx.lineTo(x + r() * 6 - 3, y + r() * 6 - 3); ctx.stroke(); }
  }
  // Prismarine
  function prismarine(ctx, seed) {
    base(ctx, seed, [90, 150, 140], [70, 120, 110], 0.4);
    const r = rng(seed + 'pr');
    for (let i = 0; i < 10; i++) { ctx.fillStyle = 'rgba(140,200,180,0.6)'; ctx.fillRect((r() * 13) | 0, (r() * 13) | 0, 3, 2); }
  }
  // Dark prismarine
  function darkPrismarine(ctx, seed) {
    base(ctx, seed, [50, 90, 80], [35, 70, 60], 0.4);
    const r = rng(seed + 'dp');
    for (let i = 0; i < 8; i++) { ctx.fillStyle = 'rgba(20,50,40,0.7)'; ctx.fillRect((r() * 12) | 0, (r() * 12) | 0, 4, 3); }
  }
  // Sea lantern
  function seaLantern(ctx, seed) {
    base(ctx, seed, [160, 220, 210], [120, 190, 180], 0.3);
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    for (let i = 0; i < 6; i++) ctx.fillRect(2 + ((rng(seed + 'sl' + i)() * 12) | 0), 2 + ((rng(seed + 'sl2' + i)() * 12) | 0), 3, 3);
  }
  // Bone block
  function boneBlock(ctx, seed) {
    base(ctx, seed, [225, 225, 210], [200, 200, 185], 0.3);
    const r = rng(seed + 'bo');
    for (let i = 0; i < 12; i++) { ctx.fillStyle = 'rgba(180,180,160,0.7)'; ctx.fillRect((r() * 14) | 0, (r() * 14) | 0, 2, 2); }
  }
  // Slime
  function slimeTex(ctx, seed) {
    base(ctx, seed, [110, 200, 110], [80, 170, 80], 0.3);
    const r = rng(seed + 'sl');
    for (let i = 0; i < 8; i++) { ctx.fillStyle = 'rgba(160,230,160,0.8)'; ctx.fillRect((r() * 13) | 0, (r() * 13) | 0, 3, 3); }
  }
  // Honey
  function honeyTex(ctx, seed) {
    base(ctx, seed, [240, 180, 40], [220, 150, 30], 0.3);
    const r = rng(seed + 'ho');
    for (let i = 0; i < 8; i++) { ctx.fillStyle = 'rgba(255,220,120,0.8)'; ctx.fillRect((r() * 12) | 0, (r() * 12) | 0, 4, 2); }
  }
  // Sweet berry bush
  function berryBush(ctx) {
    ctx.clearRect(0, 0, 16, 16);
    const r = rng('berry');
    for (let i = 0; i < 40; i++) { ctx.fillStyle = r() > 0.8 ? '#c33' : rgb(mix([60, 120, 40], [90, 150, 60], r())); ctx.fillRect((r() * 16) | 0, 4 + ((r() * 12) | 0), 1, 1); }
  }
  // Cactus
  function cactusSide(ctx, seed) {
    base(ctx, seed, [60, 140, 60], [40, 110, 40], 0.3);
    ctx.fillStyle = 'rgba(30,80,30,0.8)'; ctx.fillRect(0, 0, 1, 16); ctx.fillRect(15, 0, 1, 16);
    const r = rng(seed + 'ca');
    for (let i = 0; i < 6; i++) { ctx.fillStyle = '#ddd8a0'; ctx.fillRect(2 + ((r() * 12) | 0), (r() * 16) | 0, 1, 1); }
  }
  function cactusTop(ctx, seed) {
    base(ctx, seed, [70, 150, 70], [50, 120, 50], 0.3);
    ctx.fillStyle = 'rgba(30,80,30,0.6)'; ctx.fillRect(4, 4, 8, 8);
  }
  // Melon / pumpkin
  function melonSide(ctx, seed) {
    base(ctx, seed, [70, 140, 60], [50, 110, 45], 0.3);
    const r = rng(seed + 'me');
    for (let x = 1; x < 16; x += 4) { ctx.fillStyle = 'rgba(30,80,30,0.7)'; ctx.fillRect(x, 0, 2, 16); }
  }
  function melonTop(ctx, seed) {
    base(ctx, seed, [70, 140, 60], [50, 110, 45], 0.3);
    for (let x = 1; x < 16; x += 4) { ctx.fillStyle = 'rgba(30,80,30,0.7)'; ctx.fillRect(x, 0, 2, 16); }
    ctx.fillStyle = 'rgba(30,80,30,0.7)'; ctx.fillRect(0, 1, 16, 2); ctx.fillRect(0, 13, 16, 2);
  }
  function pumpkinSide(ctx, seed) {
    base(ctx, seed, [210, 120, 30], [180, 95, 20], 0.3);
    for (let x = 1; x < 16; x += 4) { ctx.fillStyle = 'rgba(140,70,10,0.7)'; ctx.fillRect(x, 0, 2, 16); }
  }
  function pumpkinFace(ctx, seed) {
    pumpkinSide(ctx, seed);
    ctx.fillStyle = '#3a2008';
    ctx.fillRect(3, 5, 3, 3); ctx.fillRect(10, 5, 3, 3);
    ctx.fillRect(4, 10, 2, 2); ctx.fillRect(7, 11, 2, 2); ctx.fillRect(10, 10, 2, 2);
  }
  function pumpkinTop(ctx, seed) {
    base(ctx, seed, [210, 120, 30], [180, 95, 20], 0.3);
    for (let x = 1; x < 16; x += 4) { ctx.fillStyle = 'rgba(140,70,10,0.7)'; ctx.fillRect(x, 0, 2, 16); }
    ctx.fillStyle = '#6b4a2b'; ctx.fillRect(6, 6, 4, 4);
  }
  // Pumpkin carved handled same as face lit
  // Nether wart
  function netherWart(ctx) {
    ctx.clearRect(0, 0, 16, 16);
    const r = rng('wart');
    for (let i = 0; i < 24; i++) { ctx.fillStyle = rgb(mix([150, 30, 40], [190, 50, 60], r())); ctx.fillRect(2 + ((r() * 12) | 0), 6 + ((r() * 9) | 0), 2, 2); }
  }
  // Shroomlight
  function shroomlight(ctx, seed) {
    base(ctx, seed, [240, 160, 80], [220, 120, 60], 0.3);
    const r = rng(seed + 'sh');
    for (let i = 0; i < 10; i++) { ctx.fillStyle = 'rgba(255,220,150,0.8)'; ctx.fillRect((r() * 13) | 0, (r() * 13) | 0, 3, 2); }
  }
  // Crimson / warped stems & nylium
  function crimsonStem(ctx, seed) { logSide(ctx, seed, [110, 30, 40], [150, 50, 60]); }
  function crimsonTop(ctx, seed) { logTop(ctx, seed, [150, 50, 60], [120, 35, 45]); }
  function warpedStem(ctx, seed) { logSide(ctx, seed, [30, 100, 110], [50, 140, 150]); }
  function warpedTop(ctx, seed) { logTop(ctx, seed, [50, 140, 150], [35, 110, 120]); }
  function crimsonNylium(ctx, seed) {
    base(ctx, seed, [120, 30, 40], [90, 20, 30], 0.4);
    const r = rng(seed + 'cn');
    for (let i = 0; i < 20; i++) { ctx.fillStyle = 'rgba(160,60,70,0.8)'; ctx.fillRect((r() * 16) | 0, (r() * 16) | 0, 1, 1); }
  }
  function warpedNylium(ctx, seed) {
    base(ctx, seed, [30, 100, 100], [20, 75, 80], 0.4);
    const r = rng(seed + 'wn');
    for (let i = 0; i < 20; i++) { ctx.fillStyle = 'rgba(60,140,140,0.8)'; ctx.fillRect((r() * 16) | 0, (r() * 16) | 0, 1, 1); }
  }
  // Basalt / blackstone / basalt pillars etc
  function basaltTex(ctx, seed) {
    base(ctx, seed, [70, 75, 80], [50, 55, 60], 0.35);
    const r = rng(seed + 'ba');
    for (let i = 0; i < 8; i++) { ctx.fillStyle = 'rgba(30,32,35,0.7)'; ctx.fillRect((r() * 14) | 0, 0, 2, 16); }
  }
  function blackstoneTex(ctx, seed) {
    stone(ctx, seed, [45, 40, 50], [25, 22, 30]);
  }
  function gildedBlackstone(ctx, seed) {
    blackstoneTex(ctx, seed);
    const r = rng(seed + 'gb');
    for (let i = 0; i < 8; i++) { ctx.fillStyle = '#d4af37'; ctx.fillRect((r() * 14) | 0, (r() * 14) | 0, 2, 2); }
  }
  // Quartz
  function quartzTex(ctx, seed) {
    base(ctx, seed, [235, 230, 220], [215, 210, 200], 0.2);
    ctx.fillStyle = 'rgba(200,195,185,0.6)'; ctx.fillRect(0, 4, 16, 1); ctx.fillRect(0, 12, 16, 1);
  }
  // Magma
  function magmaTex(ctx, seed) {
    base(ctx, seed, [120, 60, 20], [80, 35, 10], 0.4);
    const r = rng(seed + 'mg');
    for (let i = 0; i < 12; i++) { ctx.fillStyle = 'rgba(255,180,50,0.85)'; ctx.fillRect((r() * 13) | 0, (r() * 13) | 0, 3, 2); }
  }
  // Nether gold ore
  function netherGoldOre(ctx, seed) {
    netherrack(ctx, seed);
    const r = rng(seed + 'ngo');
    for (let b = 0; b < 6; b++) { const x = 2 + ((r() * 12) | 0), y = 2 + ((r() * 12) | 0); ctx.fillStyle = '#ffd700'; ctx.fillRect(x, y, 2, 2); }
  }
  // Ancient debris
  function ancientDebris(ctx, seed) {
    base(ctx, seed, [60, 50, 55], [40, 32, 38], 0.4);
    const r = rng(seed + 'ad');
    for (let i = 0; i < 10; i++) { ctx.fillStyle = 'rgba(110,80,90,0.9)'; ctx.fillRect((r() * 13) | 0, (r() * 13) | 0, 3, 2); }
    for (let i = 0; i < 6; i++) { ctx.fillStyle = 'rgba(200,170,60,0.7)'; ctx.fillRect((r() * 14) | 0, (r() * 14) | 0, 2, 1); }
  }
  // End portal frame
  function endPortalFrame(ctx, seed) {
    endStone(ctx, seed + 'epf');
    ctx.fillStyle = '#2a4a2a'; ctx.fillRect(3, 3, 10, 10);
    ctx.fillStyle = '#1a6a3a'; ctx.fillRect(5, 5, 6, 6);
  }
  // End portal
  function endPortalTex(ctx, seed) {
    base(ctx, seed, [10, 20, 15], [5, 10, 8], 0.4);
    const r = rng(seed + 'ep');
    for (let i = 0; i < 10; i++) { ctx.fillStyle = 'rgba(120,255,180,0.5)'; ctx.fillRect((r() * 14) | 0, (r() * 14) | 0, 2, 2); }
  }
  // End gateway
  function endGateway(ctx, seed) {
    obsidian(ctx, seed + 'eg');
    ctx.fillStyle = 'rgba(150,220,255,0.5)'; ctx.fillRect(4, 4, 8, 8);
  }
  // Dragon egg
  function dragonEgg(ctx, seed) {
    base(ctx, seed, [30, 15, 40], [15, 8, 25], 0.4);
    const r = rng(seed + 'de');
    for (let i = 0; i < 12; i++) { ctx.fillStyle = 'rgba(200,120,255,0.8)'; ctx.fillRect((r() * 14) | 0, (r() * 14) | 0, 2, 2); }
  }
  // Beacon
  function beaconTex(ctx) {
    ctx.fillStyle = '#3fbdbd'; ctx.fillRect(3, 3, 10, 10);
    ctx.fillStyle = '#dff'; ctx.fillRect(6, 6, 4, 4);
    ctx.strokeStyle = '#2a8a8a'; ctx.strokeRect(3.5, 3.5, 9, 9);
  }
  // Note block
  function noteBlock(ctx, seed) {
    planks(ctx, seed + 'nb', [170, 120, 70], [140, 95, 55]);
    ctx.fillStyle = '#333'; ctx.fillRect(7, 3, 2, 6); ctx.fillRect(5, 9, 6, 2);
  }
  // TNT
  function tntSide(ctx) {
    ctx.fillStyle = '#c33'; ctx.fillRect(0, 0, 16, 16);
    ctx.fillStyle = '#eee'; ctx.fillRect(0, 5, 16, 6);
    ctx.fillStyle = '#222'; ctx.font = 'bold 5px monospace'; ctx.fillText('TNT', 2, 10);
  }
  function tntTop(ctx, seed) { base(ctx, seed, '#c33'.match(/.{1}/) ? [200, 60, 50] : [0,0,0], [160, 40, 30], 0.3); ctx.fillStyle = '#333'; ctx.fillRect(6, 6, 4, 4); }
  // Sponge
  function spongeTex(ctx, seed) {
    base(ctx, seed, [200, 200, 90], [170, 170, 70], 0.3);
    const r = rng(seed + 'sp2');
    for (let i = 0; i < 14; i++) { ctx.fillStyle = 'rgba(120,120,40,0.8)'; ctx.fillRect((r() * 14) | 0, (r() * 14) | 0, 2, 2); }
  }
  // Hay
  function hayTex(ctx, seed) {
    base(ctx, seed, [180, 150, 50], [150, 120, 40], 0.3);
    ctx.fillStyle = 'rgba(100,80,20,0.6)'; ctx.fillRect(0, 3, 16, 1); ctx.fillRect(0, 12, 16, 1);
  }
  // Cobweb
  function cobwebTex(ctx) {
    ctx.clearRect(0, 0, 16, 16);
    ctx.strokeStyle = 'rgba(230,230,230,0.8)';
    ctx.beginPath();
    for (let a = 0; a < 4; a++) { const ang = a * Math.PI / 2 + Math.PI / 4; ctx.moveTo(8, 8); ctx.lineTo(8 + Math.cos(ang) * 10, 8 + Math.sin(ang) * 10); }
    ctx.moveTo(4, 4); ctx.lineTo(12, 4); ctx.lineTo(12, 12); ctx.lineTo(4, 12); ctx.closePath();
    ctx.stroke();
  }
  // Sculk family
  function sculkTex(ctx, seed) {
    base(ctx, seed, [20, 30, 40], [10, 15, 25], 0.4);
    const r = rng(seed + 'sc');
    for (let i = 0; i < 12; i++) { ctx.fillStyle = 'rgba(60,120,140,0.7)'; ctx.fillRect((r() * 14) | 0, (r() * 14) | 0, 2, 1); }
  }
  function sculkCatalyst(ctx, seed) {
    sculkTex(ctx, seed);
    ctx.fillStyle = '#0a5a6a'; ctx.fillRect(4, 4, 8, 8);
    ctx.fillStyle = '#3fd0e0'; ctx.fillRect(6, 6, 4, 4);
  }
  // Amethyst
  function amethystTex(ctx, seed) {
    base(ctx, seed, [160, 110, 220], [130, 80, 190], 0.4);
    const r = rng(seed + 'am');
    for (let i = 0; i < 8; i++) { ctx.fillStyle = 'rgba(220,180,255,0.8)'; ctx.fillRect((r() * 13) | 0, (r() * 13) | 0, 2, 3); }
  }
  // Budding amethyst / calcite / tuff / deepslate
  function deepslateTex(ctx, seed) { stone(ctx, seed, [70, 70, 78], [50, 50, 58]); }
  function calciteTex(ctx, seed) { base(ctx, seed, [225, 225, 225], [200, 200, 205], 0.3); }
  function tuffTex(ctx, seed) { stone(ctx, seed, [100, 100, 95], [80, 80, 75]); }
  function buddingAmethyst(ctx, seed) {
    amethystTex(ctx, seed);
    const r = rng(seed + 'bud');
    for (let i = 0; i < 5; i++) { ctx.fillStyle = '#cfa0ff'; ctx.fillRect((r() * 12) | 0, (r() * 12) | 0, 4, 4); ctx.fillStyle = '#e8d0ff'; ctx.fillRect((r() * 13) | 0, (r() * 13) | 0, 2, 2); }
  }
  // Copper family
  function copperTex(ctx, seed, colA, colB) {
    metalBlock(ctx, seed, colA, colB);
    const r = rng(seed + 'cu');
    for (let i = 0; i < 5; i++) { ctx.fillStyle = 'rgba(120,200,180,0.35)'; ctx.fillRect((r() * 12) | 0, (r() * 12) | 0, 4, 3); }
  }
  // Lightning rod / cut copper / chiseled
  function cutCopper(ctx, seed, colA, colB) {
    copperTex(ctx, seed, colA, colB);
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(0, 5, 16, 1); ctx.fillRect(0, 11, 16, 1); ctx.fillRect(5, 0, 1, 5); ctx.fillRect(10, 11, 1, 5);
  }
  // Pointed dripstone
  function dripstoneTex(ctx, seed) {
    base(ctx, seed, [130, 105, 80], [100, 80, 60], 0.35);
  }
  // Azalea / flowering azalea
  function azaleaTex(ctx, flowering) {
    ctx.clearRect(0, 0, 16, 16);
    const r = rng('azalea' + flowering);
    for (let i = 0; i < 30; i++) { ctx.fillStyle = rgb(mix([60, 120, 50], [100, 160, 80], r())); ctx.fillRect((r() * 16) | 0, (r() * 16) | 0, 1, 1); }
    if (flowering) for (let i = 0; i < 8; i++) { ctx.fillStyle = r() > 0.5 ? '#e8e8ff' : '#ffe8f8'; ctx.fillRect((r() * 14) | 0, (r() * 14) | 0, 2, 2); }
  }
  // Spawner
  function spawnerTex(ctx, seed) {
    base(ctx, seed, [55, 60, 65], [35, 40, 45], 0.4);
    const r = rng(seed + 'spa');
    for (let i = 0; i < 14; i++) { ctx.fillStyle = 'rgba(20,25,30,0.9)'; ctx.fillRect((r() * 14) | 0, (r() * 14) | 0, 2, 2); }
  }
  // Lodestone / respawn anchor / conduit
  function respawnAnchor(ctx, seed) {
    base(ctx, seed, [60, 30, 60], [40, 20, 40], 0.4);
    ctx.fillStyle = '#c9a227'; ctx.fillRect(5, 5, 6, 6); ctx.fillStyle = '#222'; ctx.fillRect(7, 7, 2, 2);
  }
  // Gold/iron/netherite blocks
  function goldBlock(ctx, seed) { metalBlock(ctx, seed, [240, 210, 60], [200, 170, 40]); }
  function ironBlock(ctx, seed) { metalBlock(ctx, seed, [220, 220, 220], [185, 185, 185]); }
  function diamondBlock(ctx, seed) {
    base(ctx, seed, [110, 230, 230], [80, 200, 200], 0.3);
    const r = rng(seed + 'dia');
    for (let i = 0; i < 10; i++) { ctx.fillStyle = 'rgba(200,255,255,0.8)'; ctx.fillRect((r() * 13) | 0, (r() * 13) | 0, 3, 2); }
  }
  function emeraldBlock(ctx, seed) {
    base(ctx, seed, [40, 200, 90], [25, 160, 65], 0.3);
    const r = rng(seed + 'em');
    for (let i = 0; i < 10; i++) { ctx.fillStyle = 'rgba(140,255,180,0.7)'; ctx.fillRect((r() * 13) | 0, (r() * 13) | 0, 3, 2); }
  }
  function lapisBlock(ctx, seed) {
    base(ctx, seed, [40, 80, 180], [25, 55, 140], 0.3);
  }
  function netheriteBlock(ctx, seed) {
    base(ctx, seed, [55, 45, 50], [38, 30, 35], 0.35);
    const r = rng(seed + 'ni');
    for (let i = 0; i < 8; i++) { ctx.fillStyle = 'rgba(90,75,85,0.8)'; ctx.fillRect((r() * 13) | 0, (r() * 13) | 0, 3, 2); }
  }
  // Coal block
  function coalBlock(ctx, seed) {
    base(ctx, seed, [30, 30, 30], [15, 15, 15], 0.4);
    const r = rng(seed + 'cb');
    for (let i = 0; i < 10; i++) { ctx.fillStyle = 'rgba(60,60,60,0.8)'; ctx.fillRect((r() * 13) | 0, (r() * 13) | 0, 3, 2); }
  }
  // Raw metal blocks
  function rawMetal(ctx, seed, colA, colB) {
    stone(ctx, seed, colA, colB);
    const r = rng(seed + 'raw');
    for (let i = 0; i < 10; i++) { ctx.fillStyle = rgb(mix(colA, [255, 255, 255], 0.4)); ctx.fillRect((r() * 13) | 0, (r() * 13) | 0, 3, 2); }
  }
  // Moss carpet / grass paths
  function pathTex(ctx, seed) {
    base(ctx, seed, [115, 85, 60], [95, 70, 48], 0.4);
    const r = rng(seed + 'pa');
    for (let i = 0; i < 20; i++) { ctx.fillStyle = 'rgba(140,110,80,0.8)'; ctx.fillRect((r() * 15) | 0, (r() * 15) | 0, 2, 1); }
  }
  // Lantern
  function lanternTex(ctx) {
    ctx.clearRect(0, 0, 16, 16);
    ctx.fillStyle = '#444'; ctx.fillRect(5, 1, 6, 2); ctx.fillRect(4, 3, 8, 10); ctx.fillRect(5, 13, 6, 2);
    ctx.fillStyle = '#ffd76a'; ctx.fillRect(5, 4, 6, 8);
    ctx.fillStyle = '#8a6a2a'; ctx.fillRect(7, 3, 2, 10);
  }
  // Campfire
  function campfireTex(ctx) {
    ctx.clearRect(0, 0, 16, 16);
    ctx.fillStyle = '#6b4a2b'; ctx.fillRect(2, 10, 12, 2); ctx.fillRect(4, 12, 8, 2);
    ctx.fillStyle = '#ff9a2a'; ctx.fillRect(5, 6, 6, 4); ctx.fillStyle = '#ffd76a'; ctx.fillRect(6, 7, 4, 2);
  }
  // Sign
  function signTex(ctx, seed) {
    ctx.clearRect(0, 0, 16, 16);
    ctx.fillStyle = '#8a5a2b'; ctx.fillRect(7, 8, 2, 8);
    ctx.fillStyle = rgb(mix([170, 130, 70], [150, 110, 60], 0.3)); ctx.fillRect(2, 2, 12, 7);
    ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.strokeRect(2.5, 2.5, 11, 6);
  }
  // Bedrock variants etc done.

  // ---------- Registry & atlas ----------
  const defs = {}; // name -> draw fn
  T.def = function (name, fn) { defs[name] = fn; };

  // Define all textures
  T.def('grass_top', grassTop);
  T.def('grass_side', grassSide);
  T.def('dirt', dirt);
  T.def('coarse_dirt', (c) => { grains(c, 'coarse', [110, 80, 55], [80, 55, 35], 80); });
  T.def('podzol', podzol);
  T.def('mycelium', mycelium);
  T.def('moss_block', mossBlock);
  T.def('mud', (c) => base(c, 'mud', [60, 55, 50], [45, 40, 36], 0.3));
  T.def('packed_mud', (c) => { base(c, 'pmud', [140, 110, 90], [115, 88, 70], 0.3); });
  T.def('clay', clay);
  T.def('sand', (c) => grains(c, 'sand', [220, 210, 160], [200, 190, 140], 50));
  T.def('red_sand', (c) => grains(c, 'redsand', [190, 100, 40], [160, 80, 30], 50));
  T.def('gravel', (c) => grains(c, 'gravel', [135, 130, 125], [100, 95, 90], 90));
  T.def('stone', (c) => stone(c, 'stone', [125, 125, 125], [105, 105, 105]));
  T.def('cobblestone', cobble);
  T.def('mossy_cobblestone', (c) => { cobble(c, 'mc'); const r = rng('mcm'); for (let i = 0; i < 24; i++) { c.fillStyle = 'rgba(80,130,60,0.6)'; c.fillRect((r() * 16) | 0, (r() * 16) | 0, 2, 1); } });
  T.def('stone_bricks', (c) => { bricks(c, 'sb', [100, 100, 100], [125, 125, 125]); });
  T.def('mossy_stone_bricks', (c) => { bricks(c, 'msb', [90, 100, 85], [110, 125, 105]); });
  T.def('cracked_stone_bricks', (c) => { bricks(c, 'csb', [95, 95, 95], [115, 115, 115]); const r = rng('cr'); for (let i = 0; i < 8; i++) { c.fillStyle = 'rgba(50,50,50,0.7)'; c.fillRect((r() * 15) | 0, (r() * 15) | 0, 1, 3); } });
  T.def('chiseled_stone_bricks', (c) => { bricks(c, 'chsb', [100, 100, 100], [120, 120, 120]); c.fillStyle = 'rgba(70,70,70,0.8)'; c.fillRect(4, 2, 8, 12); c.fillStyle = 'rgba(140,140,140,0.8)'; c.fillRect(5, 3, 6, 10); });
  T.def('deepslate', deepslateTex);
  T.def('cobbled_deepslate', (c) => { cobble(c, 'cds'); });
  T.def('polished_deepslate', (c) => { stone(c, 'pds', [70, 70, 78], [55, 55, 62]); });
  T.def('deepslate_bricks', (c) => { bricks(c, 'dsb', [45, 45, 52], [65, 65, 72]); });
  T.def('tuff', tuffTex);
  T.def('calcite', calciteTex);
  T.def('dripstone', dripstoneTex);
  T.def('granite', (c) => { stone(c, 'granite', [160, 100, 85], [130, 80, 65]); });
  T.def('diorite', (c) => { stone(c, 'diorite', [200, 200, 205], [170, 170, 175]); });
  T.def('andesite', (c) => { stone(c, 'andesite', [135, 135, 130], [110, 110, 105]); });
  T.def('bedrock', bedrock);
  T.def('obsidian', obsidian);
  T.def('crying_obsidian', cryingObsidian);
  T.def('water', water);
  T.def('lava', lava);
  T.def('glass', glass);
  T.def('bookshelf', bookshelf);
  T.def('oak_log_side', (c) => logSide(c, 'oak', [102, 81, 50], [154, 127, 81]));
  T.def('oak_log_top', (c) => logTop(c, 'oak', [190, 152, 93], [154, 127, 81]));
  T.def('spruce_log_side', (c) => logSide(c, 'spruce', [50, 40, 30], [110, 85, 55]));
  T.def('spruce_log_top', (c) => logTop(c, 'spruce', [140, 110, 70], [90, 68, 44]));
  T.def('birch_log_side', (c) => logSide(c, 'birch', [190, 190, 180], [230, 230, 220]));
  T.def('birch_log_top', (c) => logTop(c, 'birch', [220, 200, 160], [190, 170, 130]));
  T.def('jungle_log_side', (c) => logSide(c, 'jungle', [85, 70, 40], [140, 115, 65]));
  T.def('jungle_log_top', (c) => logTop(c, 'jungle', [170, 145, 85], [130, 105, 60]));
  T.def('acacia_log_side', (c) => logSide(c, 'acacia', [110, 70, 45], [160, 110, 70]));
  T.def('acacia_log_top', (c) => logTop(c, 'acacia', [180, 130, 80], [140, 95, 55]));
  T.def('dark_oak_log_side', (c) => logSide(c, 'darkoak', [60, 45, 25], [110, 85, 50]));
  T.def('dark_oak_log_top', (c) => logTop(c, 'darkoak', [130, 100, 60], [90, 68, 40]));
  T.def('mangrove_log_side', (c) => logSide(c, 'mangrove', [90, 45, 40], [140, 75, 60]));
  T.def('mangrove_log_top', (c) => logTop(c, 'mangrove', [160, 95, 75], [120, 65, 50]));
  T.def('cherry_log_side', (c) => logSide(c, 'cherry', [140, 90, 90], [200, 140, 135]));
  T.def('cherry_log_top', (c) => logTop(c, 'cherry', [230, 180, 175], [190, 130, 125]));
  T.def('bamboo_block_side', (c) => { logSide(c, 'bamboo', [120, 160, 60], [160, 200, 90]); });
  T.def('bamboo_block_top', (c) => { logTop(c, 'bamboo', [180, 210, 110], [140, 170, 80]); });
  T.def('crimson_stem_side', crimsonStem); T.def('crimson_stem_top', crimsonTop);
  T.def('warped_stem_side', warpedStem); T.def('warped_stem_top', warpedTop);
  T.def('oak_planks', (c) => planks(c, 'oak', [162, 130, 78], [140, 110, 66]));
  T.def('spruce_planks', (c) => planks(c, 'spruce', [110, 84, 54], [92, 70, 44]));
  T.def('birch_planks', (c) => planks(c, 'birch', [192, 172, 122], [170, 150, 100]));
  T.def('jungle_planks', (c) => planks(c, 'jungle', [170, 142, 84], [150, 122, 70]));
  T.def('acacia_planks', (c) => planks(c, 'acacia', [168, 94, 56], [148, 80, 48]));
  T.def('dark_oak_planks', (c) => planks(c, 'darkoak', [100, 76, 46], [84, 62, 38]));
  T.def('mangrove_planks', (c) => planks(c, 'mangrove', [118, 54, 48], [100, 44, 40]));
  T.def('cherry_planks', (c) => planks(c, 'cherry', [222, 179, 171], [200, 155, 148]));
  T.def('bamboo_planks', (c) => planks(c, 'bamboo', [196, 190, 110], [172, 166, 96]));
  T.def('crimson_planks', (c) => planks(c, 'crimson', [134, 52, 58], [112, 42, 48]));
  T.def('warped_planks', (c) => planks(c, 'warped', [44, 112, 110], [36, 92, 90]));
  T.def('oak_leaves', (c) => leaves(c, 'oakl', [60, 120, 40], [80, 150, 55]));
  T.def('spruce_leaves', (c) => leaves(c, 'spearl', [40, 90, 45], [55, 110, 60]));
  T.def('birch_leaves', (c) => leaves(c, 'birchl', [90, 150, 70], [110, 175, 85]));
  T.def('jungle_leaves', (c) => leaves(c, 'jungl', [50, 130, 40], [70, 155, 55]));
  T.def('acacia_leaves', (c) => leaves(c, 'acl', [80, 140, 50], [100, 160, 65]));
  T.def('dark_oak_leaves', (c) => leaves(c, 'dol', [45, 95, 35], [60, 115, 45]));
  T.def('mangrove_leaves', (c) => leaves(c, 'mgl', [55, 120, 60], [75, 140, 80]));
  T.def('cherry_leaves', (c) => leaves(c, 'chl', [220, 160, 170], [235, 185, 195]));
  T.def('azalea_leaves', (c) => leaves(c, 'azl', [65, 125, 55], [85, 145, 70]));
  T.def('flowering_azalea_leaves', (c) => { leaves(c, 'fal', [65, 125, 55], [85, 145, 70]); const r = rng('falc'); for (let i = 0; i < 10; i++) { c.fillStyle = r() > 0.5 ? '#e8e8ff' : '#ffe8f8'; c.fillRect((r() * 14) | 0, (r() * 14) | 0, 2, 2); } });
  T.def('crimson_fungus', (c) => { base(c, 'cf', [180, 60, 70], [150, 45, 55], 0.3); const r = rng('cfr'); for (let i = 0; i < 8; i++) { c.fillStyle = 'rgba(220,120,130,0.8)'; c.fillRect((r() * 13) | 0, (r() * 13) | 0, 3, 2); } });
  T.def('warped_fungus', (c) => { base(c, 'wf', [40, 140, 150], [30, 110, 120], 0.3); const r = rng('wfr'); for (let i = 0; i < 8; i++) { c.fillStyle = 'rgba(120,220,230,0.8)'; c.fillRect((r() * 13) | 0, (r() * 13) | 0, 3, 2); } });
  T.def('nether_wart_block', (c) => { base(c, 'nwb', [150, 25, 35], [110, 15, 25], 0.4); const r = rng('nwbr'); for (let i = 0; i < 14; i++) { c.fillStyle = 'rgba(190,60,70,0.8)'; c.fillRect((r() * 13) | 0, (r() * 13) | 0, 3, 2); } });
  T.def('warped_wart_block', (c) => { base(c, 'wwb', [20, 110, 120], [10, 80, 95], 0.4); const r = rng('wwbr'); for (let i = 0; i < 14; i++) { c.fillStyle = 'rgba(60,160,170,0.8)'; c.fillRect((r() * 13) | 0, (r() * 13) | 0, 3, 2); } });
  T.def('crimson_nylium', crimsonNylium);
  T.def('warped_nylium', warpedNylium);
  T.def('netherrack', netherrack);
  T.def('soul_sand', soulSand);
  T.def('soul_soil', (c) => base(c, 'soil', [70, 55, 45], [55, 42, 35], 0.3));
  T.def('glowstone', glowstone);
  T.def('shroomlight', shroomlight);
  T.def('basalt', basaltTex);
  T.def('polished_basalt', (c) => { stone(c, 'pb', [80, 85, 90], [60, 65, 70]); });
  T.def('blackstone', blackstoneTex);
  T.def('gilded_blackstone', gildedBlackstone);
  T.def('polished_blackstone', (c) => { stone(c, 'pbl', [50, 45, 55], [35, 30, 40]); });
  T.def('quartz_block', quartzTex);
  T.def('chiseled_quartz', (c) => { quartzTex(c, 'cq'); c.fillStyle = 'rgba(180,175,165,0.7)'; c.fillRect(3, 3, 10, 10); c.fillStyle = 'rgba(250,248,240,0.8)'; c.fillRect(5, 5, 6, 6); });
  T.def('quartz_bricks', (c) => { bricks(c, 'qb', [210, 205, 195], [235, 230, 220]); });
  T.def('nether_gold_ore', netherGoldOre);
  T.def('ancient_debris', ancientDebris);
  T.def('nether_portal', portalTex);
  T.def('end_stone', endStone);
  T.def('end_stone_bricks', (c) => { bricks(c, 'esb', [180, 180, 110], [215, 215, 145]); });
  T.def('purpur_block', purpur);
  T.def('purpur_pillar', (c) => { purpur(c, 'pp'); c.fillStyle = 'rgba(120,70,120,0.6)'; c.fillRect(2, 0, 2, 16); c.fillRect(12, 0, 2, 16); });
  T.def('end_portal_frame', endPortalFrame);
  T.def('end_portal', endPortalTex);
  T.def('end_gateway', endGateway);
  T.def('dragon_egg', dragonEgg);
  T.def('coal_ore', (c) => ore(c, 'coal', [30, 30, 30]));
  T.def('deepslate_coal_ore', (c) => { ore(c, 'dscoal', [25, 25, 25]); });
  T.def('iron_ore', (c) => ore(c, 'iron', [216, 176, 132]));
  T.def('deepslate_iron_ore', (c) => { ore(c, 'dsiron', [200, 160, 120]); });
  T.def('copper_ore', (c) => ore(c, 'copper', [200, 120, 80]));
  T.def('deepslate_copper_ore', (c) => { ore(c, 'dscopper', [190, 110, 70]); });
  T.def('gold_ore', (c) => ore(c, 'gold', [246, 208, 68]));
  T.def('deepslate_gold_ore', (c) => { ore(c, 'dsgold', [230, 190, 60]); });
  T.def('redstone_ore', (c) => { ore(c, 'redstone', [200, 40, 40]); });
  T.def('deepslate_redstone_ore', (c) => { ore(c, 'dsredstone', [190, 35, 35]); });
  T.def('lapis_ore', (c) => ore(c, 'lapis', [45, 95, 190]));
  T.def('deepslate_lapis_ore', (c) => { ore(c, 'dslapis', [40, 85, 175]); });
  T.def('diamond_ore', (c) => ore(c, 'diamond', [110, 230, 225]));
  T.def('deepslate_diamond_ore', (c) => { ore(c, 'dsdiamond', [100, 215, 210]); });
  T.def('emerald_ore', (c) => ore(c, 'emerald', [45, 200, 95]));
  T.def('deepslate_emerald_ore', (c) => { ore(c, 'dsemerald', [40, 185, 85]); });
  T.def('quartz_ore', (c) => { netherrack(c, 'qore'); const r = rng('qorer'); for (let i = 0; i < 10; i++) { c.fillStyle = '#f0ece0'; c.fillRect((r() * 13) | 0, (r() * 13) | 0, 3, 2); } });
  T.def('coal_block', coalBlock);
  T.def('raw_iron_block', (c) => rawMetal(c, 'ri', [160, 140, 130], [120, 100, 90]));
  T.def('raw_copper_block', (c) => rawMetal(c, 'rc', [150, 100, 70], [110, 70, 50]));
  T.def('raw_gold_block', (c) => rawMetal(c, 'rg', [200, 160, 60], [160, 125, 45]));
  T.def('iron_block', ironBlock);
  T.def('copper_block', (c) => copperTex(c, 'cop', [190, 110, 80], [160, 90, 60]));
  T.def('exposed_copper', (c) => copperTex(c, 'exp', [170, 140, 120], [140, 115, 95]));
  T.def('weathered_copper', (c) => copperTex(c, 'wea', [120, 165, 140], [95, 135, 115]));
  T.def('oxidized_copper', (c) => copperTex(c, 'oxi', [90, 165, 155], [70, 135, 128]));
  T.def('cut_copper', (c) => cutCopper(c, 'cut', [190, 110, 80], [160, 90, 60]));
  T.def('chiseled_copper', (c) => { cutCopper(c, 'chc', [190, 110, 80], [160, 90, 60]); c.fillStyle = 'rgba(90,50,30,0.7)'; c.fillRect(4, 4, 8, 8); c.fillStyle = 'rgba(220,140,100,0.8)'; c.fillRect(6, 6, 4, 4); });
  T.def('gold_block', goldBlock);
  T.def('diamond_block', diamondBlock);
  T.def('emerald_block', emeraldBlock);
  T.def('lapis_block', lapisBlock);
  T.def('netherite_block', netheriteBlock);
  T.def('redstone_block', (c) => { base(c, 'rsblk', [190, 30, 30], [150, 20, 20], 0.3); const r = rng('rsblkr'); for (let i = 0; i < 10; i++) { c.fillStyle = 'rgba(240,80,80,0.7)'; c.fillRect((r() * 13) | 0, (r() * 13) | 0, 3, 2); } });
  T.def('snow_block', snow);
  T.def('ice', (c) => iceTex(c, 'ice', [145, 195, 250], [120, 170, 235]));
  T.def('packed_ice', (c) => iceTex(c, 'pic', [130, 175, 240], [105, 150, 220]));
  T.def('blue_ice', (c) => iceTex(c, 'bic', [90, 145, 230], [70, 120, 205]));
  T.def('bricks', (c) => bricks(c, 'brick', [160, 150, 140], [150, 90, 70]));
  T.def('mud_bricks', (c) => bricks(c, 'mdb', [70, 62, 55], [110, 88, 70]));
  T.def('terracotta', (c) => terracotta(c, 'terra', [152, 94, 68]));
  T.def('prismarine', prismarine);
  T.def('dark_prismarine', darkPrismarine);
  T.def('prismarine_bricks', (c) => { bricks(c, 'prb', [60, 110, 100], [95, 155, 145]); });
  T.def('sea_lantern', seaLantern);
  T.def('bone_block', boneBlock);
  T.def('slime_block', slimeTex);
  T.def('honey_block', honeyTex);
  T.def('hay_block', hayTex);
  T.def('sponge', spongeTex);
  T.def('wet_sponge', (c) => spongeTex(c, 'ws'));
  T.def('tnt_side', tntSide);
  T.def('tnt_top', tntTop);
  T.def('note_block', noteBlock);
  T.def('beacon', beaconTex);
  T.def('respawn_anchor', respawnAnchor);
  T.def('lodestone', (c) => { base(c, 'lode', [90, 80, 100], [60, 55, 70], 0.3); c.fillStyle = '#c9a227'; c.fillRect(5, 5, 6, 6); });
  T.def('conduit', (c) => { base(c, 'cond', [80, 150, 160], [50, 110, 120], 0.3); c.fillStyle = 'rgba(200,255,255,0.8)'; c.fillRect(6, 6, 4, 4); });
  T.def('lantern', lanternTex);
  T.def('soul_lantern', (c) => { lanternTex(c); c.fillStyle = '#6fe0d0'; c.fillRect(5, 4, 6, 8); });
  T.def('campfire', campfireTex);
  T.def('soul_campfire', (c) => { campfireTex(c); c.fillStyle = '#6fe0d0'; c.fillRect(5, 6, 6, 4); c.fillStyle = '#bff'; c.fillRect(6, 7, 4, 2); });
  T.def('torch', torch);
  T.def('soul_torch', (c) => { torch(c); c.fillStyle = '#6fe0d0'; c.fillRect(6, 3, 4, 3); c.fillStyle = '#bff'; c.fillRect(7, 3, 2, 1); });
  T.def('redstone_torch', (c) => { torch(c); c.fillStyle = '#e04040'; c.fillRect(6, 3, 4, 3); c.fillStyle = '#ff8080'; c.fillRect(7, 3, 2, 1); });
  T.def('redstone_torch_off', redstoneTorchOff);
  T.def('redstone_wire', redstoneDust);
  T.def('repeater', repeaterTex);
  T.def('comparator', (c) => { repeaterTex(c); c.fillStyle = '#a04040'; c.fillRect(6, 8, 4, 3); });
  T.def('lever', leverTex);
  T.def('button', buttonTex);
  T.def('pressure_plate', pressurePlate);
  T.def('daylight_detector', (c) => { base(c, 'dd', [180, 180, 190], [150, 150, 160], 0.2); c.fillStyle = '#4a6ab0'; c.fillRect(3, 3, 10, 10); c.strokeStyle = '#333'; c.strokeRect(3.5, 3.5, 9, 9); });
  T.def('target_block', (c) => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5)); c.fillStyle = d < 2 ? '#fff' : d < 4 ? '#f66' : d < 6 ? '#fff' : d < 8 ? '#f66' : '#ddd'; c.fillRect(x, y, 1, 1); } });
  T.def('sculk', sculkTex);
  T.def('sculk_catalyst', sculkCatalyst);
  T.def('sculk_shrieker', (c) => { sculkTex(c, 'ss'); c.fillStyle = '#1a2a35'; c.fillRect(3, 3, 10, 10); c.fillStyle = '#0a5a6a'; c.fillRect(5, 5, 6, 6); });
  T.def('sculk_sensor', (c) => { sculkTex(c, 'sen'); c.fillStyle = '#2a4a55'; c.fillRect(2, 8, 12, 6); c.fillStyle = '#3fd0e0'; c.fillRect(6, 6, 4, 3); });
  T.def('amethyst_block', amethystTex);
  T.def('budding_amethyst', buddingAmethyst);
  T.def('amethyst_cluster', (c) => { c.clearRect(0, 0, 16, 16); const r = rng('clus'); for (let i = 0; i < 10; i++) { const x = 2 + ((r() * 12) | 0), h = 4 + ((r() * 8) | 0); c.fillStyle = '#a06ae0'; c.fillRect(x, 16 - h, 2, h); c.fillStyle = '#d0a8ff'; c.fillRect(x, 16 - h, 1, h - 2); } });
  T.def('small_amethyst_bud', (c) => { c.clearRect(0, 0, 16, 16); c.fillStyle = '#b080e8'; c.fillRect(6, 12, 4, 4); c.fillStyle = '#d8b8ff'; c.fillRect(7, 11, 2, 2); });
  T.def('medium_amethyst_bud', (c) => { c.clearRect(0, 0, 16, 16); c.fillStyle = '#a06ae0'; c.fillRect(5, 10, 6, 6); c.fillStyle = '#d0a8ff'; c.fillRect(6, 8, 4, 3); });
  T.def('large_amethyst_bud', (c) => { c.clearRect(0, 0, 16, 16); c.fillStyle = '#a06ae0'; c.fillRect(4, 8, 8, 8); c.fillStyle = '#d0a8ff'; c.fillRect(5, 5, 6, 4); });
  T.def('pointed_dripstone', (c) => { c.clearRect(0, 0, 16, 16); c.fillStyle = '#8a6a4a'; c.fillRect(7, 0, 2, 12); c.fillStyle = '#6a4a30'; c.fillRect(6, 0, 1, 8); c.fillStyle = '#a58a6a'; c.fillRect(8, 0, 1, 10); });
  T.def('azalea', (c) => azaleaTex(c, false));
  T.def('flowering_azalea', (c) => azaleaTex(c, true));
  T.def('spawner', spawnerTex);
  T.def('farmland', farmland);
  T.def('path_block', pathTex);
  T.def('crafting_table_top', craftingTable);
  T.def('crafting_table_side', craftingSide);
  T.def('furnace_front', furnaceFront);
  T.def('furnace_side', furnaceSide);
  T.def('furnace_top', furnaceTop);
  T.def('blast_furnace_front', (c) => { furnaceFront(c); c.fillStyle = '#444'; c.fillRect(2, 2, 12, 3); });
  T.def('smoker_front', (c) => { furnaceFront(c); c.fillStyle = '#666'; c.fillRect(3, 2, 10, 2); });
  T.def('chest_top', chestTop);
  T.def('chest_side', chestSide);
  T.def('ender_chest', (c) => { chestTop(c, 'ec'); c.fillStyle = '#1a3a3a'; c.fillRect(0, 0, 16, 16); c.globalAlpha = 0.5; chestTop(c, 'ec2'); c.globalAlpha = 1; });
  T.def('bed_top', bedTop);
  T.def('bed_side', bedSide);
  T.def('book_normal', (c) => { c.clearRect(0, 0, 16, 16); c.fillStyle = '#8a4a2a'; c.fillRect(3, 2, 10, 12); c.fillStyle = '#e8e0c8'; c.fillRect(5, 3, 7, 10); c.fillStyle = '#6a3a1a'; c.fillRect(3, 2, 2, 12); });
  T.def('enchanting_top', enchantTop);
  T.def('enchanting_side', enchantSide);
  T.def('anvil', anvilTex);
  T.def('grindstone', (c) => { c.fillStyle = '#6b4a2b'; c.fillRect(2, 12, 12, 4); c.fillStyle = '#8a8a8a'; c.fillRect(4, 4, 8, 8); c.fillStyle = '#bbb'; c.fillRect(5, 5, 6, 2); });
  T.def('smithing_table', (c) => { planks(c, 'st', [110, 80, 50], [90, 65, 40]); c.fillStyle = '#555'; c.fillRect(2, 2, 12, 5); c.fillStyle = '#c9a227'; c.fillRect(4, 3, 3, 3); });
  T.def('stonecutter', (c) => { stone(c, 'sc', [110, 110, 110], [85, 85, 85]); c.fillStyle = '#ccc'; c.fillRect(3, 3, 10, 3); c.fillStyle = '#666'; c.fillRect(7, 6, 2, 8); });
  T.def('loom', (c) => { planks(c, 'loom', [150, 110, 65], [120, 88, 50]); c.fillStyle = '#ddd'; c.fillRect(4, 2, 8, 8); c.fillStyle = '#c33'; c.fillRect(5, 3, 6, 2); c.fillStyle = '#39c'; c.fillRect(5, 6, 6, 2); });
  T.def('cartography_table', (c) => { planks(c, 'ctab', [130, 95, 55], [105, 78, 45]); c.fillStyle = '#e8e0c8'; c.fillRect(3, 2, 10, 6); c.fillStyle = '#39c'; c.fillRect(5, 4, 3, 2); });
  T.def('fletching_table', (c) => { planks(c, 'ftab', [150, 120, 70], [125, 98, 58]); c.fillStyle = '#aaa'; c.fillRect(3, 3, 4, 4); c.fillStyle = '#8a5a2b'; c.fillRect(9, 5, 5, 2); });
  T.def('composter', (c) => { planks(c, 'comp', [150, 120, 70], [125, 98, 58]); c.fillStyle = '#3a2a12'; c.fillRect(3, 3, 10, 10); c.fillStyle = '#6a4a2a'; c.fillRect(4, 4, 8, 8); });
  T.def('barrel_top', (c) => { planks(c, 'bart', [140, 105, 60], [115, 85, 48]); c.strokeStyle = '#3a2a12'; c.strokeRect(2.5, 2.5, 11, 11); c.fillStyle = '#8a6a3a'; c.fillRect(4, 4, 8, 8); });
  T.def('barrel_side', (c) => { planks(c, 'bars', [140, 105, 60], [115, 85, 48]); c.fillStyle = '#555'; c.fillRect(0, 2, 16, 2); c.fillRect(0, 12, 16, 2); });
  T.def('bell', (c) => { c.clearRect(0, 0, 16, 16); c.fillStyle = '#c9a227'; c.fillRect(5, 3, 6, 8); c.fillRect(4, 11, 8, 2); c.fillStyle = '#8a6a10'; c.fillRect(7, 13, 2, 2); c.fillStyle = '#666'; c.fillRect(7, 1, 2, 2); });
  T.def('chain', (c) => { c.clearRect(0, 0, 16, 16); c.strokeStyle = '#777'; c.lineWidth = 2; c.strokeRect(6, 1, 4, 6); c.strokeRect(6, 8, 4, 6); });
  T.def('iron_bars', (c) => { c.clearRect(0, 0, 16, 16); c.fillStyle = '#aaa'; c.fillRect(2, 0, 2, 16); c.fillRect(7, 0, 2, 16); c.fillRect(12, 0, 2, 16); c.fillRect(0, 4, 16, 2); c.fillRect(0, 10, 16, 2); });
  T.def('glass_pane_edge', (c) => { c.clearRect(0, 0, 16, 16); c.fillStyle = 'rgba(210,240,255,0.6)'; c.fillRect(7, 0, 2, 16); });
  T.def('ladder', ladderTex);
  T.def('fence_oak', (c) => fenceTex(c, 'foak'));
  T.def('cobweb', cobwebTex);
  T.def('cactus_side', cactusSide);
  T.def('cactus_top', cactusTop);
  T.def('melon_side', melonSide);
  T.def('melon_top', melonTop);
  T.def('melon_inside', (c) => { base(c, 'meli', [180, 220, 140], [150, 190, 110], 0.3); const r = rng('melir'); for (let i = 0; i < 10; i++) { c.fillStyle = '#3a3'; c.fillRect((r() * 14) | 0, (r() * 14) | 0, 1, 1); } });
  T.def('pumpkin_side', pumpkinSide);
  T.def('pumpkin_face', pumpkinFace);
  T.def('pumpkin_top', pumpkinTop);
  T.def('carved_pumpkin', (c) => { pumpkinFace(c, 'cp'); });
  T.def('jack_o_lantern', (c) => { pumpkinFace(c, 'jo'); c.fillStyle = 'rgba(255,200,80,0.5)'; c.fillRect(3, 5, 3, 3); c.fillRect(10, 5, 3, 3); });
  T.def('sweet_berry_bush', berryBush);
  T.def('nether_wart', netherWart);
  T.def('brown_mushroom', (c) => { c.clearRect(0, 0, 16, 16); c.fillStyle = '#c8a878'; c.fillRect(6, 9, 4, 5); c.fillStyle = '#9a6a3a'; c.fillRect(4, 5, 8, 4); c.fillStyle = '#b8845a'; c.fillRect(5, 6, 6, 2); });
  T.def('red_mushroom', (c) => { c.clearRect(0, 0, 16, 16); c.fillStyle = '#e8e0d8'; c.fillRect(6, 9, 4, 5); c.fillStyle = '#c03030'; c.fillRect(4, 5, 8, 4); c.fillStyle = '#fff'; c.fillRect(5, 6, 2, 1); c.fillRect(9, 5, 2, 2); });
  T.def('crimson_roots', (c) => { c.clearRect(0, 0, 16, 16); const r = rng('crroot'); for (let i = 0; i < 8; i++) { const x = 1 + ((r() * 14) | 0), h = 5 + ((r() * 9) | 0); c.fillStyle = rgb(mix([150, 40, 50], [190, 60, 70], r())); for (let y = 0; y < h; y++) c.fillRect(x, 16 - y - 1, 1, 1); } });
  T.def('warped_roots', (c) => { c.clearRect(0, 0, 16, 16); const r = rng('wrroot'); for (let i = 0; i < 8; i++) { const x = 1 + ((r() * 14) | 0), h = 5 + ((r() * 9) | 0); c.fillStyle = rgb(mix([30, 110, 110], [50, 150, 150], r())); for (let y = 0; y < h; y++) c.fillRect(x, 16 - y - 1, 1, 1); } });
  T.def('twisting_vines', (c) => { c.clearRect(0, 0, 16, 16); const r = rng('tv'); for (let i = 0; i < 6; i++) { const x = 2 + ((r() * 12) | 0); c.fillStyle = '#3aa050'; for (let y = 0; y < 16; y += 2) c.fillRect(x + (Math.sin(y) > 0 ? 1 : 0), y, 1, 2); } });
  T.def('weeping_vines', (c) => { c.clearRect(0, 0, 16, 16); const r = rng('wv'); for (let i = 0; i < 6; i++) { const x = 2 + ((r() * 12) | 0); c.fillStyle = '#a04050'; for (let y = 0; y < 16; y += 2) c.fillRect(x, y, 1, 2); } });
  T.def('kelp', (c) => { c.clearRect(0, 0, 16, 16); const r = rng('kp'); for (let i = 0; i < 5; i++) { const x = 2 + ((r() * 12) | 0); c.fillStyle = '#3a8040'; for (let y = 0; y < 16; y += 3) c.fillRect(x, y, 2, 3); } });
  T.def('seagrass', (c) => { c.clearRect(0, 0, 16, 16); const r = rng('sg'); for (let i = 0; i < 6; i++) { const x = 2 + ((r() * 12) | 0); c.fillStyle = '#3a9a50'; for (let y = 8; y < 16; y++) c.fillRect(x + ((Math.sin(y) > 0) ? 1 : 0), y, 1, 1); } });
  T.def('sea_pickle', (c) => { c.clearRect(0, 0, 16, 16); c.fillStyle = '#8aa040'; c.fillRect(5, 8, 6, 8); c.fillStyle = '#c0d060'; c.fillRect(6, 6, 4, 3); });
  T.def('coral_tube', (c) => { c.clearRect(0, 0, 16, 16); c.fillStyle = '#e070a0'; c.fillRect(4, 4, 3, 12); c.fillRect(9, 7, 3, 9); c.fillStyle = '#f0a0c0'; c.fillRect(4, 3, 3, 2); c.fillRect(9, 6, 3, 2); });
  T.def('sign', signTex);
  T.def('item_frame', (c) => { c.clearRect(0, 0, 16, 16); c.strokeStyle = '#8a5a2b'; c.lineWidth = 2; c.strokeRect(2, 2, 12, 12); });
  T.def('flower_tulip_red', (c) => flower(c, '#d04040', '#e8d040'));
  T.def('flower_tulip_orange', (c) => flower(c, '#e08030', '#e8d040'));
  T.def('flower_tulip_white', (c) => flower(c, '#f0f0f0', '#e8d040'));
  T.def('flower_tulip_pink', (c) => flower(c, '#e080c0', '#e8d040'));
  T.def('flower_azure_bluet', (c) => flower(c, '#f0e8e0', '#e8a040'));
  T.def('flower_red', (c) => flower(c, '#e03030', '#f0e0a0'));
  T.def('flower_yellow', (c) => flower(c, '#f0d838', '#c8a020'));
  T.def('flower_blue', (c) => flower(c, '#4060e0', '#f0e8a0'));
  T.def('flower_allium', (c) => flower(c, '#c060d0', '#e8e8f0'));
  T.def('flower_houstonia', (c) => flower(c, '#d0e8f0', '#f0f0a0'));
  T.def('flower_cornflower', (c) => flower(c, '#3050c0', '#e8e8f0'));
  T.def('flower_lily_of_valley', (c) => flower(c, '#f8f8f8', '#e8e8d0'));
  T.def('flower_wither', (c) => flower(c, '#505050', '#202020'));
  T.def('torchflower', (c) => flower(c, '#ff8030', '#ffd040'));
  T.def('poppy', (c) => flower(c, '#e02020', '#303030'));
  T.def('dandelion', (c) => flower(c, '#f8d838', '#f8f8d8'));
  T.def('cornflower', (c) => flower(c, '#3858c8', '#e8e8f8'));
  T.def('oxeye_daisy', (c) => flower(c, '#f8f8f8', '#f8d838'));
  T.def('sunflower_top', (c) => { c.clearRect(0, 0, 16, 16); c.fillStyle = '#f8d838'; c.fillRect(3, 3, 10, 10); c.fillStyle = '#8a5a2b'; c.fillRect(6, 6, 4, 4); });
  T.def('tall_grass', (c) => tallGrass(c, 'tg'));
  T.def('fern', (c) => { c.clearRect(0, 0, 16, 16); const r = rng('fern'); for (let i = 0; i < 6; i++) { const x = 3 + ((r() * 10) | 0); c.fillStyle = '#4a9a3a'; for (let y = 6; y < 16; y++) c.fillRect(x + ((y - 6) % 2), y, 1, 1); } });
  T.def('large_fern_bottom', (c) => tallGrass(c, 'lfb'));
  T.def('large_fern_top', (c) => tallGrass(c, 'lft'));
  T.def('rose_bush', (c) => { tallGrass(c, 'rb'); const r = rng('rbr'); for (let i = 0; i < 6; i++) { c.fillStyle = '#e03030'; c.fillRect((r() * 14) | 0, 4 + ((r() * 8) | 0), 2, 2); } });
  T.def('peony', (c) => { tallGrass(c, 'pe'); const r = rng('per'); for (let i = 0; i < 6; i++) { c.fillStyle = '#e080c0'; c.fillRect((r() * 14) | 0, 3 + ((r() * 6) | 0), 2, 2); } });
  T.def('lilac', (c) => { tallGrass(c, 'li'); const r = rng('lir'); for (let i = 0; i < 5; i++) { c.fillStyle = '#c060d0'; c.fillRect((r() * 14) | 0, 4 + ((r() * 6) | 0), 2, 2); } });
  T.def('wheat_stage0', (c) => { c.clearRect(0, 0, 16, 16); c.fillStyle = '#6aa040'; c.fillRect(7, 12, 1, 4); c.fillRect(5, 13, 1, 3); c.fillRect(9, 13, 1, 3); });
  T.def('wheat_stage3', (c) => { c.clearRect(0, 0, 16, 16); c.fillStyle = '#7ab040'; for (let x = 3; x < 14; x += 3) c.fillRect(x, 6, 1, 10); });
  T.def('wheat_ripe', (c) => { c.clearRect(0, 0, 16, 16); c.fillStyle = '#c8b040'; for (let x = 3; x < 14; x += 3) { c.fillRect(x, 4, 1, 12); c.fillRect(x - 1, 5, 3, 1); c.fillRect(x - 1, 8, 3, 1); } });
  T.def('carrot_top', (c) => { c.clearRect(0, 0, 16, 16); const r = rng('car'); for (let i = 0; i < 8; i++) { const x = 2 + ((r() * 12) | 0); c.fillStyle = '#4a9a3a'; c.fillRect(x, 8, 1, 8); c.fillStyle = '#e08030'; c.fillRect(x - 1, 14, 3, 2); } });
  T.def('potato_top', (c) => { c.clearRect(0, 0, 16, 16); const r = rng('pot'); for (let i = 0; i < 8; i++) { const x = 2 + ((r() * 12) | 0); c.fillStyle = '#4a8a4a'; c.fillRect(x, 9, 2, 7); } });
  T.def('beetroot_top', (c) => { c.clearRect(0, 0, 16, 16); const r = rng('bee'); for (let i = 0; i < 8; i++) { const x = 2 + ((r() * 12) | 0); c.fillStyle = '#a03050'; c.fillRect(x, 10, 1, 6); c.fillStyle = '#5aa03c'; c.fillRect(x - 1, 7, 3, 3); } });
  T.def('sapling', sapling);
  T.def('spruce_sapling', (c) => { c.clearRect(0, 0, 16, 16); c.fillStyle = '#6b4a2b'; c.fillRect(7, 10, 2, 6); c.fillStyle = '#2a6a30'; c.fillRect(5, 4, 6, 6); c.fillRect(6, 2, 4, 2); });
  T.def('bamboo_sapling', (c) => { c.clearRect(0, 0, 16, 16); c.fillStyle = '#5a9a40'; c.fillRect(7, 4, 2, 12); c.fillStyle = '#7ab050'; c.fillRect(5, 6, 2, 2); c.fillRect(9, 9, 2, 2); });
  T.def('mangrove_propagule', (c) => { c.clearRect(0, 0, 16, 16); c.fillStyle = '#4a8a40'; c.fillRect(7, 2, 2, 8); c.fillStyle = '#6aa050'; c.fillRect(5, 8, 6, 6); });
  T.def('cherry_sapling', (c) => { c.clearRect(0, 0, 16, 16); c.fillStyle = '#8a5a5a'; c.fillRect(7, 9, 2, 7); c.fillStyle = '#f0b8c8'; c.fillRect(4, 3, 8, 6); c.fillRect(6, 1, 4, 2); });
  T.def('bamboo', (c) => { c.clearRect(0, 0, 16, 16); c.fillStyle = '#6aa040'; c.fillRect(6, 0, 3, 16); c.fillStyle = '#4a8030'; c.fillRect(6, 4, 3, 1); c.fillRect(6, 10, 3, 1); c.fillStyle = '#8ac060'; c.fillRect(9, 6, 4, 2); });
  T.def('sugar_cane', (c) => { c.clearRect(0, 0, 16, 16); c.fillStyle = '#5a9a50'; c.fillRect(4, 0, 2, 16); c.fillRect(9, 0, 2, 16); c.fillStyle = '#3a7a30'; c.fillRect(4, 5, 2, 1); c.fillRect(9, 11, 2, 1); });
  T.def('cocoa', (c) => { c.clearRect(0, 0, 16, 16); c.fillStyle = '#6b4a2b'; c.fillRect(0, 0, 4, 16); c.fillStyle = '#7a4a20'; c.fillRect(4, 4, 4, 8); c.fillStyle = '#5a3010'; c.fillRect(5, 5, 2, 6); });
  T.def('vine', (c) => { c.clearRect(0, 0, 16, 16); const r = rng('vi'); for (let i = 0; i < 20; i++) { c.fillStyle = rgb(mix([40, 100, 30], [70, 130, 50], r())); c.fillRect((r() * 16) | 0, (r() * 16) | 0, 1, 2); } });
  T.def('snow_layer', (c) => snow(c, 'sl2'));
  T.def('air_placeholder', (c) => { c.clearRect(0, 0, 16, 16); });

  // Wool & concrete & carpets parametric definitions registered dynamically later.

  // ---------- Build atlas ----------
  T.buildAtlas = function () {
    const names = Object.keys(defs);
    // add wool colors
    const WOOL_COLORS = {
      white: [235, 235, 235], orange: [240, 125, 30], magenta: [189, 68, 179], light_blue: [58, 175, 217],
      yellow: [247, 230, 7], lime: [114, 190, 26], pink: [237, 141, 172], gray: [63, 68, 72],
      light_gray: [142, 142, 134], cyan: [21, 137, 145], purple: [125, 48, 197], blue: [45, 60, 184],
      brown: [118, 70, 33], green: [58, 142, 34], red: [175, 45, 34], black: [20, 20, 26],
    };
    for (const [cname, col] of Object.entries(WOOL_COLORS)) {
      defs['wool_' + cname] = (c) => wool(c, 'wool' + cname, col);
      defs['carpet_' + cname] = (c) => carpet(c, 'carpet' + cname, col);
      defs['concrete_powder_' + cname] = (c) => powder(c, 'cp' + cname, col);
      defs['concrete_' + cname] = (c) => { base(c, 'con' + cname, col, col.map(v => v * 0.92), 0.12); };
      defs['terracotta_' + cname] = (c) => terracotta(c, 'tc' + cname, col.map((v, i) => (v * 0.55 + [152, 94, 68][i] * 0.45) | 0));
      defs['glazed_terracotta_' + cname] = (c) => { terracotta(c, 'gtc' + cname, col.map((v, i) => (v * 0.7 + [152, 94, 68][i] * 0.3) | 0)); const r = rng('gt' + cname); for (let i = 0; i < 10; i++) { c.fillStyle = rgb(mix(col, [255, 255, 255], 0.5)); c.fillRect((r() * 13) | 0, (r() * 13) | 0, 3, 1); } };
      defs['bed_' + cname] = (c) => { c.fillStyle = rgb(col); c.fillRect(0, 0, 16, 16); c.fillStyle = '#f0f0f0'; c.fillRect(0, 0, 16, 6); c.strokeStyle = rgb(col.map(v => v * 0.7)); c.strokeRect(0.5, 0.5, 15, 15); };
      // doors per wood type registered separately
    }
    const WOODS = { oak: [[162, 130, 78], [140, 110, 66]], spruce: [[110, 84, 54], [92, 70, 44]], birch: [[192, 172, 122], [170, 150, 100]], jungle: [[170, 142, 84], [150, 122, 70]], acacia: [[168, 94, 56], [148, 80, 48]], dark_oak: [[100, 76, 46], [84, 62, 38]], mangrove: [[118, 54, 48], [100, 44, 40]], cherry: [[222, 179, 171], [200, 155, 148]], bamboo: [[196, 190, 110], [172, 166, 96]], crimson: [[134, 52, 58], [112, 42, 48]], warped: [[44, 112, 110], [36, 92, 90]] };
    for (const [wood, cols] of Object.entries(WOODS)) {
      defs[wood + '_door'] = (c) => doorTex(c, 'door' + wood, cols[0], cols[1]);
      defs[wood + '_trapdoor'] = (c) => { planks(c, 'td' + wood, cols[0], cols[1]); c.strokeStyle = 'rgba(0,0,0,0.4)'; c.strokeRect(1.5, 1.5, 13, 13); };
      defs['fence_' + wood] = (c) => fenceTex(c, 'f' + wood);
      defs['sign_item_' + wood] = (c) => signTex(c, 'si' + wood);
    }

    const total = names.length;
    const rows = Math.ceil(total / ATLAS_COLS);
    const atlas = document.createElement('canvas');
    atlas.width = ATLAS_COLS * TILE; atlas.height = rows * TILE;
    const actx = atlas.getContext('2d');
    actx.imageSmoothingEnabled = false;

    const index = {};
    names.forEach((name, i) => {
      const tx = (i % ATLAS_COLS) * TILE, ty = ((i / ATLAS_COLS) | 0) * TILE;
      const tmp = document.createElement('canvas'); tmp.width = TILE; tmp.height = TILE;
      const tctx = tmp.getContext('2d');
      try { defs[name](tctx); } catch (e) { console.warn('tex fail', name, e); }
      actx.drawImage(tmp, tx, ty);
      index[name] = i;
    });

    T.atlas = atlas;
    T.index = index;
    T.tileCount = total;
    T.cols = ATLAS_COLS;
    T.rows = rows;
    // UV helper
    T.uv = function (name) {
      const i = index[name];
      if (i === undefined) { console.warn('missing tex', name); return index.dirt; }
      return i;
    };
    T.tileUV = function (i) {
      const tx = i % ATLAS_COLS, ty = (i / ATLAS_COLS) | 0;
      const s = 1 / ATLAS_COLS, t = 1 / rows;
      return { u0: tx * s, v0: ty * t, u1: (tx + 1) * s, v1: (ty + 1) * t };
    };
    return atlas;
  };

  // Get single tile as dataURL (for item icons / UI)
  T.tileDataURL = function (name, scale = 4) {
    const i = T.index[name];
    if (i === undefined) return '';
    const c = document.createElement('canvas'); c.width = TILE; c.height = TILE;
    const ctx = c.getContext('2d');
    const tx = (i % ATLAS_COLS) * TILE, ty = ((i / ATLAS_COLS) | 0) * TILE;
    ctx.drawImage(T.atlas, tx, ty, TILE, TILE, 0, 0, TILE, TILE);
    const out = document.createElement('canvas'); out.width = TILE * scale; out.height = TILE * scale;
    const octx = out.getContext('2d'); octx.imageSmoothingEnabled = false;
    octx.drawImage(c, 0, 0, TILE * scale, TILE * scale);
    return out.toDataURL();
  };
})();
