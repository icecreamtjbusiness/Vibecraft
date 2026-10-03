// ============================================================
// Block registry: every block with textures, physical props,
// tool requirements, drops, light, special flags.
// ============================================================
(function () {
  'use strict';
  const WC = window.WC;
  const B = WC.blocks;
  let ID = 0;

  // id -> def ; name -> id
  WC.blockIds = [];
  WC.blockByName = {};

  function def(name, opts) {
    const d = Object.assign({
      id: ++ID,
      name,
      display: name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      solid: true,            // collides
      opaque: true,           // fully hides neighbor faces
      render: 'cube',         // cube | cross | torch | fence | glass | liquid | slab | stairs | sign | bed | door | plant2 | none
      tex: { all: 'stone' },  // face textures: all/top/bottom/side/north/east/south/west/front
      hardness: 1.0,          // seconds by hand base (0 = instant, -1 = unbreakable)
      tool: null,             // pickaxe|axe|shovel|hoe|null
      tier: 0,                // min tool tier for drops (0=none,1=wood,...4=netherite-ish)
      drop: null,             // item name override or fn
      dropsFn: null,
      light: 0,               // emitted light 0..15
      transparent: false,     // no face-culling of neighbors
      liquid: false,
      gravity: false,         // sand/gravel fall
      flammable: false,
      container: null,        // 'chest'|'furnace'|'crafting'|'barrel'|'shulker'...
      replaceable: false,     // plants etc.
      walkSound: 'stone',
      color: [128, 128, 128], // tint for minimap/icons fallback
      extra: {},              // arbitrary data
    }, opts);
    if (d.transparent || !d.opaque) d.neighborCheck = true;
    B[name] = d;
    WC.blockIds[d.id] = d;
    WC.blockByName[name] = d;
    return d;
  }
  WC.BLOCK_COUNT = () => ID;

  function cube(name, texName, o = {}) {
    return def(name, Object.assign({ tex: { all: texName }, render: 'cube' }, o));
  }
  function woodCube(name, sideTex, topTex, o = {}) {
    return def(name, Object.assign({ tex: { side: sideTex, top: topTex, bottom: topTex }, render: 'cube' }, o));
  }

  // ---------- Non full blocks ----------
  def('air', { solid: false, opaque: false, transparent: true, render: 'none', hardness: 0, tex: { all: 'air_placeholder' }, replaceable: true });
  def('cave_air', { solid: false, opaque: false, transparent: true, render: 'none', hardness: 0, tex: { all: 'air_placeholder' }, replaceable: true });
  def('structure_void', { solid: false, opaque: false, transparent: true, render: 'none', hardness: 0, tex: { all: 'air_placeholder' } });

  // ---------- Overworld terrain ----------
  cube('grass_block', 'grass_top', { tex: { all: 'grass_side', top: 'grass_top', bottom: 'dirt' }, hardness: 0.6, tool: 'shovel', drop: 'dirt', walkSound: 'grass', color: [116, 169, 74], extra: { grass: true } });
  cube('mycelium', 'mycelium', { tex: { all: 'grass_side', top: 'mycelium', bottom: 'dirt' }, hardness: 0.6, tool: 'shovel', drop: 'dirt', color: [150, 140, 160] });
  cube('podzol', 'podzol', { tex: { all: 'grass_side', top: 'podzol', bottom: 'dirt' }, hardness: 0.6, tool: 'shovel', drop: 'dirt', color: [130, 90, 40] });
  cube('dirt', 'dirt', { hardness: 0.5, tool: 'shovel', walkSound: 'grass', color: [134, 96, 67] });
  cube('coarse_dirt', 'coarse_dirt', { hardness: 0.5, tool: 'shovel', color: [110, 80, 55] });
  cube('rooted_dirt', 'coarse_dirt', { hardness: 0.5, tool: 'shovel', color: [120, 90, 60] });
  cube('moss_block', 'moss_block', { hardness: 0.1, tool: 'hoe', walkSound: 'grass', color: [80, 110, 50], flammable: true });
  cube('mud', 'mud', { hardness: 0.5, tool: 'shovel', color: [60, 55, 50] });
  cube('clay', 'clay', { hardness: 0.6, tool: 'shovel', dropsFn: () => [{ item: 'clay_ball', count: 4 }], color: [160, 160, 175] });
  cube('sand', 'sand', { hardness: 0.5, tool: 'shovel', gravity: true, walkSound: 'sand', color: [220, 210, 160] });
  cube('red_sand', 'red_sand', { hardness: 0.5, tool: 'shovel', gravity: true, walkSound: 'sand', color: [190, 100, 40] });
  cube('gravel', 'gravel', { hardness: 0.6, tool: 'shovel', gravity: true, dropsFn: (r) => r() < 0.1 ? [{ item: 'flint', count: 1 }] : [{ item: 'gravel', count: 1 }], color: [135, 130, 125] });
  cube('farmland', 'farmland', { hardness: 0.6, tool: 'shovel', solid: false, opaque: false, transparent: true, render: 'slab_tall', drop: 'dirt', color: [100, 70, 45] });
  cube('path', 'path_block', { hardness: 0.65, tool: 'shovel', solid: false, opaque: false, transparent: true, render: 'slab_tall', drop: 'dirt', color: [115, 85, 60] });
  cube('snow_block', 'snow_block', { hardness: 0.2, tool: 'shovel', transparent: true, opaque: false, render: 'slab_tall', drop: 'snowball', dropsFn: () => [{ item: 'snowball', count: 4 }], walkSound: 'snow', color: [240, 248, 255] });
  def('snow_layer', { tex: { all: 'snow_layer' }, render: 'layer', hardness: 0.2, tool: 'shovel', solid: false, transparent: true, opaque: false, drop: 'snowball', walkSound: 'snow', color: [240, 248, 255], extra: { layers: 2 } });
  cube('ice', 'ice', { hardness: 0.5, tool: 'pickaxe', transparent: true, opaque: false, drop: null, walkSound: 'stone', color: [145, 195, 250] });
  cube('packed_ice', 'packed_ice', { hardness: 0.5, tool: 'pickaxe', drop: null, color: [130, 175, 240] });
  cube('blue_ice', 'blue_ice', { hardness: 0.5, tool: 'pickaxe', drop: null, color: [90, 145, 230] });
  cube('stone', 'stone', { hardness: 1.5, tool: 'pickaxe', tier: 1, drop: 'cobblestone', color: [125, 125, 125] });
  cube('granite', 'granite', { hardness: 1.5, tool: 'pickaxe', tier: 1, color: [160, 100, 85] });
  cube('polished_granite', 'granite', { hardness: 1.5, tool: 'pickaxe', tier: 1, color: [170, 110, 95] });
  cube('diorite', 'diorite', { hardness: 1.5, tool: 'pickaxe', tier: 1, color: [200, 200, 205] });
  cube('polished_diorite', 'diorite', { hardness: 1.5, tool: 'pickaxe', tier: 1, color: [210, 210, 215] });
  cube('andesite', 'andesite', { hardness: 1.5, tool: 'pickaxe', tier: 1, color: [135, 135, 130] });
  cube('polished_andesite', 'andesite', { hardness: 1.5, tool: 'pickaxe', tier: 1, color: [145, 145, 140] });
  cube('cobblestone', 'cobblestone', { hardness: 2, tool: 'pickaxe', tier: 1, walkSound: 'stone', color: [128, 128, 128] });
  cube('mossy_cobblestone', 'mossy_cobblestone', { hardness: 2, tool: 'pickaxe', tier: 1, color: [110, 130, 100] });
  cube('stone_bricks', 'stone_bricks', { hardness: 1.5, tool: 'pickaxe', tier: 1, color: [122, 122, 122] });
  cube('mossy_stone_bricks', 'mossy_stone_bricks', { hardness: 1.5, tool: 'pickaxe', tier: 1, color: [110, 125, 105] });
  cube('cracked_stone_bricks', 'cracked_stone_bricks', { hardness: 1.5, tool: 'pickaxe', tier: 1, color: [115, 115, 115] });
  cube('chiseled_stone_bricks', 'chiseled_stone_bricks', { hardness: 1.5, tool: 'pickaxe', tier: 1, color: [120, 120, 120] });
  cube('deepslate', 'deepslate', { hardness: 3, tool: 'pickaxe', tier: 1, drop: 'cobbled_deepslate', color: [70, 70, 78] });
  cube('cobbled_deepslate', 'cobbled_deepslate', { hardness: 3, tool: 'pickaxe', tier: 1, color: [65, 65, 72] });
  cube('polished_deepslate', 'polished_deepslate', { hardness: 3, tool: 'pickaxe', tier: 1, color: [62, 62, 70] });
  cube('deepslate_bricks', 'deepslate_bricks', { hardness: 3, tool: 'pickaxe', tier: 1, color: [60, 60, 68] });
  cube('cracked_deepslate_bricks', 'deepslate_bricks', { hardness: 3, tool: 'pickaxe', tier: 1, color: [55, 55, 62] });
  cube('tuff', 'tuff', { hardness: 1.5, tool: 'pickaxe', tier: 1, color: [100, 100, 95] });
  cube('calcite', 'calcite', { hardness: 0.75, tool: 'pickaxe', tier: 1, color: [225, 225, 225] });
  cube('dripstone_block', 'dripstone', { hardness: 1, tool: 'pickaxe', tier: 1, color: [130, 105, 80] });
  def('pointed_dripstone', { tex: { all: 'pointed_dripstone' }, render: 'cross', hardness: 0.1, tool: null, solid: false, transparent: true, opaque: false, color: [130, 105, 80] });
  cube('obsidian', 'obsidian', { hardness: 50, tool: 'pickaxe', tier: 3, walkSound: 'stone', color: [22, 15, 40] });
  cube('crying_obsidian', 'crying_obsidian', { hardness: 50, tool: 'pickaxe', tier: 3, light: 5, color: [60, 20, 80] });
  cube('bedrock', 'bedrock', { hardness: -1, drop: null, color: [60, 60, 60] });
  cube('barrier', 'bedrock', { hardness: -1, drop: null, transparent: true, opaque: false, color: [200, 60, 60] });

  // ---------- Ores ----------
  cube('coal_ore', 'coal_ore', { hardness: 3, tool: 'pickaxe', tier: 1, drop: 'coal', color: [90, 90, 90] });
  cube('deepslate_coal_ore', 'deepslate_coal_ore', { hardness: 4.5, tool: 'pickaxe', tier: 1, drop: 'coal', color: [55, 55, 60] });
  cube('iron_ore', 'iron_ore', { hardness: 3, tool: 'pickaxe', tier: 1, dropsFn: () => [{ item: 'raw_iron', count: 1 }], color: [170, 150, 130] });
  cube('deepslate_iron_ore', 'deepslate_iron_ore', { hardness: 4.5, tool: 'pickaxe', tier: 1, dropsFn: () => [{ item: 'raw_iron', count: 1 }], color: [90, 85, 85] });
  cube('copper_ore', 'copper_ore', { hardness: 3, tool: 'pickaxe', tier: 1, dropsFn: () => [{ item: 'raw_copper', count: 2 }], color: [150, 110, 90] });
  cube('deepslate_copper_ore', 'deepslate_copper_ore', { hardness: 4.5, tool: 'pickaxe', tier: 1, dropsFn: () => [{ item: 'raw_copper', count: 2 }], color: [85, 75, 75] });
  cube('gold_ore', 'gold_ore', { hardness: 3, tool: 'pickaxe', tier: 2, dropsFn: () => [{ item: 'raw_gold', count: 1 }], color: [170, 150, 90] });
  cube('deepslate_gold_ore', 'deepslate_gold_ore', { hardness: 4.5, tool: 'pickaxe', tier: 2, dropsFn: () => [{ item: 'raw_gold', count: 1 }], color: [95, 85, 70] });
  cube('redstone_ore', 'redstone_ore', { hardness: 3, tool: 'pickaxe', tier: 1, light: 0, dropsFn: () => [{ item: 'redstone', count: 4 + ((Math.random() * 4) | 0) }], color: [140, 70, 70] });
  cube('deepslate_redstone_ore', 'deepslate_redstone_ore', { hardness: 4.5, tool: 'pickaxe', tier: 1, dropsFn: () => [{ item: 'redstone', count: 4 + ((Math.random() * 4) | 0) }], color: [90, 55, 60] });
  cube('lapis_ore', 'lapis_ore', { hardness: 3, tool: 'pickaxe', tier: 1, dropsFn: () => [{ item: 'lapis_lazuli', count: 4 + ((Math.random() * 8) | 0) }], color: [90, 105, 150] });
  cube('deepslate_lapis_ore', 'deepslate_lapis_ore', { hardness: 4.5, tool: 'pickaxe', tier: 1, dropsFn: () => [{ item: 'lapis_lazuli', count: 4 + ((Math.random() * 8) | 0) }], color: [60, 65, 90] });
  cube('diamond_ore', 'diamond_ore', { hardness: 3, tool: 'pickaxe', tier: 2, drop: 'diamond', color: [100, 145, 145] });
  cube('deepslate_diamond_ore', 'deepslate_diamond_ore', { hardness: 4.5, tool: 'pickaxe', tier: 2, drop: 'diamond', color: [55, 75, 80] });
  cube('emerald_ore', 'emerald_ore', { hardness: 3, tool: 'pickaxe', tier: 2, drop: 'emerald', color: [90, 140, 100] });
  cube('deepslate_emerald_ore', 'deepslate_emerald_ore', { hardness: 4.5, tool: 'pickaxe', tier: 2, drop: 'emerald', color: [55, 80, 65] });
  cube('nether_gold_ore', 'nether_gold_ore', { hardness: 3, tool: 'pickaxe', tier: 1, dropsFn: () => [{ item: 'gold_ingot', count: 1 }], color: [140, 80, 60] });
  cube('quartz_ore', 'quartz_ore', { hardness: 3, tool: 'pickaxe', tier: 1, drop: 'quartz', color: [130, 60, 50] });
  cube('ancient_debris', 'ancient_debris', { hardness: 30, tool: 'pickaxe', tier: 3, drop: 'ancient_debris', color: [60, 50, 55] });
  cube('amethyst_block', 'amethyst_block', { hardness: 1.5, tool: 'pickaxe', tier: 1, color: [160, 110, 220] });
  cube('budding_amethyst', 'budding_amethyst', { hardness: 1.5, tool: 'pickaxe', tier: 1, drop: null, color: [180, 140, 230] });
  def('amethyst_cluster', { tex: { all: 'amethyst_cluster' }, render: 'cross', hardness: 1.5, tool: 'pickaxe', tier: 1, solid: false, transparent: true, opaque: false, light: 4, dropsFn: () => [{ item: 'amethyst_shard', count: 4 }], color: [170, 120, 220] });
  def('large_amethyst_bud', { tex: { all: 'large_amethyst_bud' }, render: 'cross', hardness: 1.5, solid: false, transparent: true, opaque: false, drop: 'amethyst_shard', color: [170, 120, 220] });
  def('medium_amethyst_bud', { tex: { all: 'medium_amethyst_bud' }, render: 'cross', hardness: 1.5, solid: false, transparent: true, opaque: false, drop: 'amethyst_shard', color: [170, 120, 220] });
  def('small_amethyst_bud', { tex: { all: 'small_amethyst_bud' }, render: 'cross', hardness: 1.5, solid: false, transparent: true, opaque: false, drop: 'amethyst_shard', color: [170, 120, 220] });
  cube('spawner', 'spawner', { hardness: 5, tool: 'pickaxe', tier: 1, drop: null, transparent: true, opaque: false, color: [45, 50, 55], extra: { mob: 'zombie' } });

  // ---------- Wood: logs ----------
  const WOODS = ['oak', 'spruce', 'birch', 'jungle', 'acacia', 'dark_oak', 'mangrove', 'cherry', 'bamboo'];
  for (const w of WOODS) {
    woodCube(w + '_log', w + '_log_side', w + '_log_top', { hardness: 2, tool: 'axe', walkSound: 'wood', flammable: true, color: [140, 110, 70] });
    woodCube(w + '_wood', w + '_log_side', w + '_log_top', { hardness: 2, tool: 'axe', walkSound: 'wood', flammable: true, color: [140, 110, 70] });
    def(w + '_planks', { tex: { all: w + '_planks' }, render: 'cube', hardness: 2, tool: 'axe', walkSound: 'wood', flammable: true, color: [160, 130, 80] });
    def(w + '_leaves', { tex: { all: w + '_leaves' }, render: 'cube', hardness: 0.2, solid: true, opaque: false, transparent: true, walkSound: 'grass', flammable: true, color: [70, 130, 50],
      dropsFn: (r) => { const out = []; if (r() < 0.05) out.push({ item: w + '_sapling', count: 1 }); if (r() < 0.02) out.push({ item: 'stick', count: 1 + ((r() * 2) | 0) }); if (r() < 0.01) out.push({ item: 'apple', count: 1 }); return out; } });
    def(w + '_slab', { tex: { all: w + '_planks' }, render: 'slab', hardness: 2, tool: 'axe', walkSound: 'wood', color: [160, 130, 80] });
    def(w + '_stairs', { tex: { all: w + '_planks' }, render: 'stairs', hardness: 2, tool: 'axe', walkSound: 'wood', color: [160, 130, 80] });
    def(w + '_fence', { tex: { all: 'fence_' + w }, render: 'fence', hardness: 2, tool: 'axe', walkSound: 'wood', color: [160, 130, 80] });
    def(w + '_fence_gate', { tex: { all: 'fence_' + w }, render: 'fence', hardness: 2, tool: 'axe', walkSound: 'wood', color: [160, 130, 80], extra: { gate: true } });
    def(w + '_door', { tex: { all: w + '_door' }, render: 'door', hardness: 1, tool: null, solid: false, transparent: true, opaque: false, walkSound: 'wood', color: [160, 130, 80], extra: { door: true, open: false } });
    def(w + '_trapdoor', { tex: { all: w + '_trapdoor' }, render: 'trapdoor', hardness: 1, solid: false, transparent: true, opaque: false, walkSound: 'wood', color: [160, 130, 80], extra: { trapdoor: true } });
    def(w + '_button', { tex: { all: w + '_planks' }, render: 'thin', hardness: 0.5, solid: false, transparent: true, opaque: false, color: [160, 130, 80], extra: { button: true } });
    def(w + '_pressure_plate', { tex: { all: w + '_planks' }, render: 'plate', hardness: 0.5, solid: false, transparent: true, opaque: false, color: [160, 130, 80], extra: { plate: true } });
    def(w + '_sign', { tex: { all: 'sign_item_' + w }, render: 'sign', hardness: 1, solid: false, transparent: true, opaque: false, color: [160, 130, 80], extra: { sign: true } });
    def(w + '_sapling', { tex: { all: w === 'oak' ? 'sapling' : (w + '_sapling') }, render: 'cross', hardness: 0, solid: false, transparent: true, opaque: false, replaceable: true, walkSound: 'grass', color: [80, 130, 60], extra: { sapling: w } });
  }
  // bookshelf variants
  for (const w of WOODS.slice(0, 6)) {
    def(w === 'oak' ? 'bookshelf' : w + '_bookshelf', { tex: { all: 'bookshelf', top: w + '_planks', bottom: w + '_planks' }, render: 'cube', hardness: 1.5, tool: 'axe', walkSound: 'wood', color: [150, 110, 65],
      dropsFn: () => [{ item: 'book', count: 3 }] });
  }

  // Nether fungi/stems
  woodCube('crimson_stem', 'crimson_stem_side', 'crimson_stem_top', { hardness: 2, tool: 'axe', color: [140, 50, 60] });
  woodCube('warped_stem', 'warped_stem_side', 'warped_stem_top', { hardness: 2, tool: 'axe', color: [40, 120, 120] });
  def('crimson_hyphae', { tex: { side: 'crimson_stem_side', top: 'crimson_stem_top', bottom: 'crimson_stem_top' }, render: 'cube', hardness: 2, tool: 'axe', color: [140, 50, 60] });
  def('warped_hyphae', { tex: { side: 'warped_stem_side', top: 'warped_stem_top', bottom: 'warped_stem_top' }, render: 'cube', hardness: 2, tool: 'axe', color: [40, 120, 120] });
  for (const w of ['crimson', 'warped']) {
    def(w + '_planks', { tex: { all: w + '_planks' }, render: 'cube', hardness: 2, tool: 'axe', color: w === 'crimson' ? [130, 50, 55] : [40, 110, 110] });
    def(w + '_slab', { tex: { all: w + '_planks' }, render: 'slab', hardness: 2, tool: 'axe', color: [100, 80, 80] });
    def(w + '_stairs', { tex: { all: w + '_planks' }, render: 'stairs', hardness: 2, tool: 'axe', color: [100, 80, 80] });
    def(w + '_fence', { tex: { all: 'fence_' + w }, render: 'fence', hardness: 2, tool: 'axe', color: [100, 80, 80] });
    def(w + '_door', { tex: { all: w + '_door' }, render: 'door', hardness: 1, solid: false, transparent: true, opaque: false, color: [100, 80, 80], extra: { door: true } });
    def(w + '_trapdoor', { tex: { all: w + '_trapdoor' }, render: 'trapdoor', hardness: 1, solid: false, transparent: true, opaque: false, color: [100, 80, 80], extra: { trapdoor: true } });
    def(w + '_sign', { tex: { all: 'sign_item_' + w }, render: 'sign', hardness: 1, solid: false, transparent: true, opaque: false, color: [100, 80, 80], extra: { sign: true } });
    def(w + '_button', { tex: { all: w + '_planks' }, render: 'thin', hardness: 0.5, solid: false, transparent: true, opaque: false, color: [100, 80, 80], extra: { button: true } });
    def(w + '_pressure_plate', { tex: { all: w + '_planks' }, render: 'plate', hardness: 0.5, solid: false, transparent: true, opaque: false, color: [100, 80, 80], extra: { plate: true } });
    def(w + '_fungus', { tex: { all: w === 'crimson' ? 'crimson_fungus' : 'warped_fungus' }, render: 'cube', hardness: 0.1, solid: false, transparent: true, opaque: false, color: [140, 60, 60] });
    def(w + '_nylium', { tex: { all: w === 'crimson' ? 'grass_side' : 'grass_side', top: w + '_nylium', bottom: 'netherrack' }, render: 'cube', hardness: 0.4, tool: 'shovel', drop: 'netherrack', color: [120, 40, 45] });
    def(w + '_roots', { tex: { all: w === 'crimson' ? 'crimson_roots' : 'warped_roots' }, render: 'cross', hardness: 0, solid: false, transparent: true, opaque: false, replaceable: true, color: [140, 60, 60] });
  }
  def('nether_wart_block', { tex: { all: 'nether_wart_block' }, render: 'cube', hardness: 1, color: [150, 25, 35] });
  def('warped_wart_block', { tex: { all: 'warped_wart_block' }, render: 'cube', hardness: 1, color: [20, 110, 120] });

  // ---------- Stone-like decorative ----------
  def('bricks', { tex: { all: 'bricks' }, render: 'cube', hardness: 2, tool: 'pickaxe', tier: 1, color: [150, 90, 70] });
  def('mud_bricks', { tex: { all: 'mud_bricks' }, render: 'cube', hardness: 1.5, tool: 'pickaxe', tier: 1, color: [110, 88, 70] });
  def('packed_mud', { tex: { all: 'packed_mud' }, render: 'cube', hardness: 1.5, color: [140, 110, 90] });
  def('terracotta', { tex: { all: 'terracotta' }, render: 'cube', hardness: 1.25, tool: 'pickaxe', tier: 1, color: [152, 94, 68] });
  def('smooth_stone', { tex: { all: 'stone_bricks' }, render: 'cube', hardness: 2, tool: 'pickaxe', tier: 1, color: [120, 120, 120] });

  // Colored blocks (generated names)
  const COLORS = ['white', 'orange', 'magenta', 'light_blue', 'yellow', 'lime', 'pink', 'gray', 'light_gray', 'cyan', 'purple', 'blue', 'brown', 'green', 'red', 'black'];
  for (const c of COLORS) {
    def('wool_' + c, { tex: { all: 'wool_' + c }, render: 'cube', hardness: 0.8, walkSound: 'wool', flammable: true, color: [200, 200, 200], extra: { woolColor: c } });
    def('carpet_' + c, { tex: { all: 'carpet_' + c }, render: 'carpet', hardness: 0.7, solid: false, transparent: true, opaque: false, walkSound: 'wool', flammable: true, color: [200, 200, 200], extra: { woolColor: c } });
    def('concrete_powder_' + c, { tex: { all: 'concrete_powder_' + c }, render: 'cube', hardness: 0.5, tool: 'shovel', gravity: true, color: [200, 200, 200], extra: { woolColor: c } });
    def('concrete_' + c, { tex: { all: 'concrete_' + c }, render: 'cube', hardness: 1.8, tool: 'pickaxe', tier: 1, color: [200, 200, 200], extra: { woolColor: c } });
    def('terracotta_' + c, { tex: { all: 'terracotta_' + c }, render: 'cube', hardness: 1.25, tool: 'pickaxe', tier: 1, color: [180, 140, 120], extra: { woolColor: c } });
    def('glazed_terracotta_' + c, { tex: { all: 'glazed_terracotta_' + c }, render: 'cube', hardness: 1.4, tool: 'pickaxe', tier: 1, color: [180, 140, 120], extra: { woolColor: c } });
  }

  // Glass & panes
  def('glass', { tex: { all: 'glass' }, render: 'glass', hardness: 0.3, transparent: true, opaque: false, drop: null, walkSound: 'stone', color: [210, 235, 255] });
  for (const c of COLORS) def('stained_glass_' + c, { tex: { all: 'concrete_' + c }, render: 'glass', hardness: 0.3, transparent: true, opaque: false, drop: null, color: [200, 200, 200], extra: { woolColor: c } });
  def('glass_pane', { tex: { all: 'glass_pane_edge' }, render: 'pane', hardness: 0.3, transparent: true, opaque: false, solid: true, drop: null, color: [210, 235, 255] });

  // ---------- Liquids ----------
  def('water', { tex: { all: 'water' }, render: 'liquid', liquid: true, solid: false, transparent: true, opaque: false, hardness: -1, drop: null, color: [40, 100, 200] });
  def('lava', { tex: { all: 'lava' }, render: 'liquid', liquid: true, solid: false, transparent: true, opaque: false, hardness: -1, drop: null, light: 15, color: [220, 100, 20] });

  // ---------- Light sources & misc functional ----------
  def('torch', { tex: { all: 'torch' }, render: 'torch', hardness: 0, solid: false, transparent: true, opaque: false, light: 14, walkSound: 'wood', color: [255, 220, 100] });
  def('soul_torch', { tex: { all: 'soul_torch' }, render: 'torch', hardness: 0, solid: false, transparent: true, opaque: false, light: 10, color: [110, 224, 208] });
  def('lantern', { tex: { all: 'lantern' }, render: 'cross', hardness: 1.5, tool: 'pickaxe', tier: 1, solid: false, transparent: true, opaque: false, light: 15, color: [255, 215, 106] });
  def('soul_lantern', { tex: { all: 'soul_lantern' }, render: 'cross', hardness: 1.5, tool: 'pickaxe', tier: 1, solid: false, transparent: true, opaque: false, light: 10, color: [110, 224, 208] });
  def('glowstone', { tex: { all: 'glowstone' }, render: 'cube', hardness: 0.3, transparent: true, opaque: false, light: 15, drop: 'glowstone_dust', color: [200, 160, 70] });
  def('shroomlight', { tex: { all: 'shroomlight' }, render: 'cube', hardness: 1, light: 15, color: [240, 160, 80] });
  def('sea_lantern', { tex: { all: 'sea_lantern' }, render: 'cube', hardness: 0.3, light: 15, color: [160, 220, 210] });
  def('jack_o_lantern', { tex: { all: 'jack_o_lantern' }, render: 'cube', hardness: 1, light: 15, color: [210, 120, 30] });
  def('end_rod', { tex: { all: 'bone_block' }, render: 'cross', hardness: 0, solid: false, transparent: true, opaque: false, light: 15, color: [250, 250, 250] });
  def('candle', { tex: { all: 'lantern' }, render: 'cross', hardness: 0.1, solid: false, transparent: true, opaque: false, light: 11, color: [230, 210, 160] });

  // Crafting stations & storage
  def('crafting_table', { tex: { all: 'crafting_table_side', top: 'crafting_table_top', bottom: 'oak_planks' }, render: 'cube', hardness: 2.5, tool: 'axe', container: 'crafting', walkSound: 'wood', color: [160, 120, 70] });
  def('furnace', { tex: { all: 'furnace_side', front: 'furnace_front', top: 'furnace_top', bottom: 'furnace_top' }, render: 'cube', hardness: 3.5, tool: 'pickaxe', tier: 1, container: 'furnace', light: 0, color: [110, 110, 110] });
  def('blast_furnace', { tex: { all: 'furnace_side', front: 'blast_furnace_front', top: 'furnace_top', bottom: 'furnace_top' }, render: 'cube', hardness: 3.5, tool: 'pickaxe', tier: 1, container: 'blast_furnace', color: [90, 90, 90] });
  def('smoker', { tex: { all: 'furnace_side', front: 'smoker_front', top: 'furnace_top', bottom: 'furnace_top' }, render: 'cube', hardness: 3.5, tool: 'pickaxe', tier: 1, container: 'smoker', color: [100, 90, 80] });
  def('chest', { tex: { all: 'chest_side', top: 'chest_top', bottom: 'chest_top' }, render: 'cube', hardness: 2.5, tool: 'axe', container: 'chest', walkSound: 'wood', color: [140, 100, 55] });
  def('ender_chest', { tex: { all: 'ender_chest', top: 'ender_chest', bottom: 'ender_chest' }, render: 'cube', hardness: 22.5, tool: 'pickaxe', tier: 3, container: 'ender', light: 3, color: [26, 58, 58] });
  def('trapped_chest', { tex: { all: 'chest_side', top: 'chest_top', bottom: 'chest_top' }, render: 'cube', hardness: 2.5, tool: 'axe', container: 'chest', color: [140, 100, 55], extra: { trapped: true } });
  def('barrel', { tex: { all: 'barrel_side', top: 'barrel_top', bottom: 'barrel_top' }, render: 'cube', hardness: 2.5, tool: 'axe', container: 'barrel', color: [140, 105, 60] });
  def('shulker_box', { tex: { all: 'concrete_purple' }, render: 'cube', hardness: 2, container: 'shulker', color: [125, 48, 197] });
  def('bookshelf_block', { tex: { all: 'bookshelf' }, render: 'cube', hardness: 1.5, tool: 'axe', color: [150, 110, 65] });
  def('lectern', { tex: { all: 'bookshelf', top: 'enchanting_top' }, render: 'cube', hardness: 2, tool: 'axe', color: [150, 110, 65], extra: { lectern: true } });
  def('enchanting_table', { tex: { all: 'enchanting_side', top: 'enchanting_top', bottom: 'obsidian' }, render: 'cube', hardness: 5, tool: 'pickaxe', tier: 1, container: 'enchanting', light: 7, color: [40, 25, 60] });
  def('anvil', { tex: { all: 'anvil' }, render: 'cube', hardness: 5, tool: 'pickaxe', tier: 1, container: 'anvil', color: [86, 86, 86] });
  def('grindstone', { tex: { all: 'grindstone' }, render: 'cube', hardness: 2, tool: 'pickaxe', tier: 1, container: 'grindstone', color: [120, 110, 100] });
  def('smithing_table', { tex: { all: 'smithing_table' }, render: 'cube', hardness: 2.5, tool: 'axe', container: 'smithing', color: [110, 80, 50] });
  def('stonecutter', { tex: { all: 'stonecutter' }, render: 'cube', hardness: 2, tool: 'pickaxe', tier: 1, container: 'stonecutter', color: [110, 110, 110] });
  def('loom', { tex: { all: 'loom' }, render: 'cube', hardness: 2.5, tool: 'axe', container: 'loom', color: [150, 110, 65] });
  def('cartography_table', { tex: { all: 'cartography_table' }, render: 'cube', hardness: 2.5, tool: 'axe', color: [130, 95, 55] });
  def('fletching_table', { tex: { all: 'fletching_table' }, render: 'cube', hardness: 2.5, tool: 'axe', color: [150, 120, 70] });
  def('composter', { tex: { all: 'composter' }, render: 'cube', hardness: 0.2, tool: 'axe', solid: false, transparent: true, opaque: false, color: [150, 120, 70], extra: { composter: true } });
  def('cauldron', { tex: { all: 'anvil' }, render: 'cube', hardness: 2, tool: 'pickaxe', tier: 1, solid: false, transparent: true, opaque: false, color: [60, 60, 60], extra: { cauldron: true } });
  def('bell', { tex: { all: 'bell' }, render: 'cross', hardness: 1, tool: 'pickaxe', tier: 1, solid: false, transparent: true, opaque: false, color: [201, 162, 39] });
  def('chain', { tex: { all: 'chain' }, render: 'cross', hardness: 5, tool: 'pickaxe', tier: 1, solid: false, transparent: true, opaque: false, color: [120, 120, 120] });
  def('item_frame', { tex: { all: 'item_frame' }, render: 'thin', hardness: 0.25, solid: false, transparent: true, opaque: false, color: [138, 90, 43] });
  def('target', { tex: { all: 'target_block' }, render: 'cube', hardness: 1.5, color: [240, 100, 100] });
  def('lodestone', { tex: { all: 'lodestone' }, render: 'cube', hardness: 3.5, tool: 'pickaxe', tier: 1, color: [90, 80, 100] });
  def('respawn_anchor', { tex: { all: 'respawn_anchor' }, render: 'cube', hardness: 50, tool: 'pickaxe', tier: 3, light: 15, color: [60, 30, 60], extra: { respawnAnchor: true } });
  def('beacon', { tex: { all: 'beacon' }, render: 'cube', hardness: 3, light: 15, drop: 'beacon', color: [63, 189, 189] });
  def('conduit', { tex: { all: 'conduit' }, render: 'cube', hardness: 3, light: 15, transparent: true, opaque: false, color: [80, 150, 160] });

  // Redstone
  def('redstone_lamp', { tex: { all: 'note_block' }, render: 'cube', hardness: 0.3, transparent: true, opaque: false, color: [150, 100, 60], extra: { lamp: true } });
  def('note_block', { tex: { all: 'note_block' }, render: 'cube', hardness: 0.8, tool: 'punch', walkSound: 'wood', color: [170, 120, 70], extra: { note: true } });
  def('observer', { tex: { all: 'stone', front: 'furnace_top' }, render: 'cube', hardness: 3, tool: 'pickaxe', tier: 1, color: [120, 120, 120], extra: { observer: true } });
  def('dispenser', { tex: { all: 'furnace_side', front: 'furnace_top' }, render: 'cube', hardness: 3.5, tool: 'pickaxe', tier: 1, container: 'chest', color: [110, 110, 110], extra: { dispenser: true } });
  def('dropper', { tex: { all: 'furnace_side', front: 'furnace_side' }, render: 'cube', hardness: 3.5, tool: 'pickaxe', tier: 1, container: 'chest', color: [105, 105, 105] });
  def('hopper', { tex: { all: 'iron_block' }, render: 'cube', hardness: 3, tool: 'pickaxe', tier: 1, container: 'hopper', color: [150, 150, 150], extra: { hopper: true } });
  def('redstone_wire', { tex: { all: 'redstone_wire' }, render: 'wire', hardness: 0, solid: false, transparent: true, opaque: false, color: [150, 20, 20], extra: { wire: true } });
  def('redstone_torch', { tex: { all: 'redstone_torch' }, render: 'torch', hardness: 0, solid: false, transparent: true, opaque: false, light: 7, color: [224, 64, 64], extra: { rsTorch: true } });
  def('repeater', { tex: { all: 'repeater' }, render: 'thin', hardness: 0, solid: false, transparent: true, opaque: false, color: [122, 74, 74], extra: { repeater: true } });
  def('comparator', { tex: { all: 'comparator' }, render: 'thin', hardness: 0, solid: false, transparent: true, opaque: false, color: [160, 64, 64], extra: { comparator: true } });
  def('lever', { tex: { all: 'lever' }, render: 'thin', hardness: 0.5, solid: false, transparent: true, opaque: false, color: [138, 90, 43], extra: { lever: true } });
  def('stone_button', { tex: { all: 'button' }, render: 'thin', hardness: 0.5, solid: false, transparent: true, opaque: false, color: [138, 138, 138], extra: { button: true } });
  def('stone_pressure_plate', { tex: { all: 'pressure_plate' }, render: 'plate', hardness: 0.5, solid: false, transparent: true, opaque: false, color: [138, 138, 138], extra: { plate: true } });
  def('light_weighted_pressure_plate', { tex: { all: 'pressure_plate' }, render: 'plate', hardness: 0.5, solid: false, transparent: true, opaque: false, color: [220, 200, 90], extra: { plate: true } });
  def('heavy_weighted_pressure_plate', { tex: { all: 'pressure_plate' }, render: 'plate', hardness: 0.5, solid: false, transparent: true, opaque: false, color: [140, 140, 140], extra: { plate: true } });
  def('daylight_detector', { tex: { all: 'daylight_detector' }, render: 'plate', hardness: 0.2, solid: false, transparent: true, opaque: false, color: [180, 180, 190], extra: { daylight: true } });
  def('tripwire_hook', { tex: { all: 'button' }, render: 'thin', hardness: 0.5, solid: false, transparent: true, opaque: false, color: [150, 150, 150] });
  def('piston', { tex: { all: 'stone_bricks', top: 'smooth_stone' }, render: 'cube', hardness: 1.5, tool: 'pickaxe', tier: 1, color: [120, 120, 120], extra: { piston: true } });
  def('sticky_piston', { tex: { all: 'stone_bricks', top: 'slime_block' }, render: 'cube', hardness: 1.5, tool: 'pickaxe', tier: 1, color: [120, 140, 120], extra: { piston: true, sticky: true } });
  def('slime_block', { tex: { all: 'slime_block' }, render: 'cube', hardness: 0, transparent: true, opaque: false, solid: true, color: [110, 200, 110], extra: { bounce: true } });
  def('honey_block', { tex: { all: 'honey_block' }, render: 'cube', hardness: 0, transparent: true, opaque: false, solid: true, color: [240, 180, 40] });
  def('tnt', { tex: { all: 'tnt_side', top: 'tnt_top', bottom: 'tnt_top' }, render: 'cube', hardness: 0, walkSound: 'grass', flammable: true, color: [200, 60, 50], extra: { tnt: true } });
  def('iron_bars', { tex: { all: 'iron_bars' }, render: 'pane', hardness: 5, tool: 'pickaxe', tier: 1, transparent: true, opaque: false, solid: true, color: [170, 170, 170] });
  def('scaffolding', { tex: { all: 'ladder' }, render: 'cube', hardness: 0, transparent: true, opaque: false, solid: true, color: [170, 150, 90] });
  def('ladder', { tex: { all: 'ladder' }, render: 'ladder', hardness: 0.4, solid: false, transparent: true, opaque: false, walkSound: 'wood', color: [138, 90, 43], extra: { climb: true } });

  // Metal / mineral blocks
  def('iron_block', { tex: { all: 'iron_block' }, render: 'cube', hardness: 5, tool: 'pickaxe', tier: 1, color: [220, 220, 220] });
  def('gold_block', { tex: { all: 'gold_block' }, render: 'cube', hardness: 3, tool: 'pickaxe', tier: 2, color: [240, 210, 60] });
  def('diamond_block', { tex: { all: 'diamond_block' }, render: 'cube', hardness: 5, tool: 'pickaxe', tier: 2, color: [110, 230, 230] });
  def('emerald_block', { tex: { all: 'emerald_block' }, render: 'cube', hardness: 5, tool: 'pickaxe', tier: 2, color: [40, 200, 90] });
  def('lapis_block', { tex: { all: 'lapis_block' }, render: 'cube', hardness: 3, tool: 'pickaxe', tier: 1, color: [40, 80, 180] });
  def('coal_block', { tex: { all: 'coal_block' }, render: 'cube', hardness: 5, tool: 'pickaxe', tier: 1, color: [25, 25, 25] });
  def('redstone_block', { tex: { all: 'redstone_block' }, render: 'cube', hardness: 5, tool: 'pickaxe', tier: 1, light: 0, color: [190, 30, 30] });
  def('netherite_block', { tex: { all: 'netherite_block' }, render: 'cube', hardness: 50, tool: 'pickaxe', tier: 3, color: [55, 45, 50] });
  def('raw_iron_block', { tex: { all: 'raw_iron_block' }, render: 'cube', hardness: 5, tool: 'pickaxe', tier: 1, color: [160, 140, 130] });
  def('raw_copper_block', { tex: { all: 'raw_copper_block' }, render: 'cube', hardness: 5, tool: 'pickaxe', tier: 1, color: [150, 100, 70] });
  def('raw_gold_block', { tex: { all: 'raw_gold_block' }, render: 'cube', hardness: 5, tool: 'pickaxe', tier: 2, color: [200, 160, 60] });
  // Copper family
  const COPPER_STATES = [['copper', [190, 110, 80]], ['exposed_copper', [170, 140, 120]], ['weathered_copper', [120, 165, 140]], ['oxidized_copper', [90, 165, 155]]];
  for (const [state, col] of COPPER_STATES) {
    const texFor = state === 'copper' ? 'copper_block' : state;
    def(state + '_block', { tex: { all: texFor }, render: 'cube', hardness: 3, tool: 'pickaxe', tier: 1, color: col });
    def('cut_' + state + '_block', { tex: { all: 'cut_copper' }, render: 'cube', hardness: 3, tool: 'pickaxe', tier: 1, color: col });
    def('chiseled_' + state + '_block', { tex: { all: 'chiseled_copper' }, render: 'cube', hardness: 3, tool: 'pickaxe', tier: 1, color: col });
    def(state + '_stairs', { tex: { all: texFor }, render: 'stairs', hardness: 3, tool: 'pickaxe', tier: 1, color: col });
    def(state + '_slab', { tex: { all: texFor }, render: 'slab', hardness: 3, tool: 'pickaxe', tier: 1, color: col });
    def('cut_' + state + '_stairs', { tex: { all: 'cut_copper' }, render: 'stairs', hardness: 3, tool: 'pickaxe', tier: 1, color: col });
    def('cut_' + state + '_slab', { tex: { all: 'cut_copper' }, render: 'slab', hardness: 3, tool: 'pickaxe', tier: 1, color: col });
  }
  def('lightning_rod', { tex: { all: 'copper_block' }, render: 'cross', hardness: 3, tool: 'pickaxe', tier: 1, solid: false, transparent: true, opaque: false, color: [190, 110, 80] });
  def('copper_grate', { tex: { all: 'chiseled_copper' }, render: 'cube', hardness: 3, tool: 'pickaxe', tier: 1, transparent: true, opaque: false, color: [190, 110, 80] });
  def('copper_bulb', { tex: { all: 'copper_block' }, render: 'cross', hardness: 3, tool: 'pickaxe', tier: 1, light: 15, solid: false, transparent: true, opaque: false, color: [220, 140, 100] });

  // Slabs & stairs for stone families
  const STONE_FAMS = ['stone', 'cobblestone', 'stone_bricks', 'mossy_cobblestone', 'deepslate', 'cobbled_deepslate', 'polished_deepslate', 'deepslate_bricks', 'tuff', 'granite', 'diorite', 'andesite', 'bricks', 'mud_bricks', 'prismarine', 'dark_prismarine', 'end_stone_bricks', 'purpur_block', 'blackstone', 'polished_blackstone', 'quartz_block'];
  for (const s of STONE_FAMS) {
    if (!B[s]) continue;
    def(s + '_slab', { tex: { all: B[s].tex.all }, render: 'slab', hardness: B[s].hardness, tool: B[s].tool, tier: B[s].tier, color: B[s].color });
    def(s + '_stairs', { tex: { all: B[s].tex.all }, render: 'stairs', hardness: B[s].hardness, tool: B[s].tool, tier: B[s].tier, color: B[s].color });
  }
  def('smooth_stone_slab', { tex: { all: 'stone_bricks' }, render: 'slab', hardness: 2, tool: 'pickaxe', tier: 1, color: [120, 120, 120] });

  // ---------- Plants ----------
  const PLANTS = {
    grass: 'tall_grass', fern: 'fern', poppy: 'poppy', dandelion: 'dandelion', cornflower: 'cornflower',
    lily_of_valley: 'flower_lily_of_valley', wither_rose: 'flower_wither',
    red_tulip: 'flower_tulip_red', orange_tulip: 'flower_tulip_orange', white_tulip: 'flower_tulip_white', pink_tulip: 'flower_tulip_pink',
    azure_bluet: 'flower_azure_bluet', allium: 'flower_allium', oxeye_daisy: 'oxeye_daisy', blue_orchid: 'flower_blue',
    torchflower: 'torchflower',
  };
  for (const [name, tex] of Object.entries(PLANTS)) {
    def(name, { tex: { all: tex }, render: 'cross', hardness: 0, solid: false, transparent: true, opaque: false, replaceable: true, walkSound: 'grass', color: [120, 180, 80], extra: { plant: true } });
  }
  def('sugar_cane', { tex: { all: 'sugar_cane' }, render: 'cross', hardness: 0, solid: false, transparent: true, opaque: false, walkSound: 'grass', color: [90, 150, 80], extra: { cane: true } });
  def('cactus', { tex: { all: 'cactus_side', top: 'cactus_top', bottom: 'cactus_top' }, render: 'cube', hardness: 0.4, transparent: true, opaque: false, solid: true, walkSound: 'grass', color: [60, 140, 60], extra: { cactus: true } });
  def('bamboo_block', { tex: { all: 'bamboo' }, render: 'cross', hardness: 1, solid: false, transparent: true, opaque: false, color: [120, 160, 60], extra: { bamboo: true } });
  def('vine', { tex: { all: 'vine' }, render: 'cross', hardness: 0.2, solid: false, transparent: true, opaque: false, walkSound: 'grass', color: [60, 120, 50], extra: { vine: true } });
  def('glow_lichen', { tex: { all: 'vine' }, render: 'cross', hardness: 0.2, solid: false, transparent: true, opaque: false, light: 7, color: [100, 200, 150] });
  def('brown_mushroom', { tex: { all: 'brown_mushroom' }, render: 'cross', hardness: 0, solid: false, transparent: true, opaque: false, replaceable: true, walkSound: 'grass', color: [150, 110, 70], extra: { plant: true } });
  def('red_mushroom', { tex: { all: 'red_mushroom' }, render: 'cross', hardness: 0, solid: false, transparent: true, opaque: false, replaceable: true, walkSound: 'grass', color: [190, 60, 60], extra: { plant: true } });
  def('crimson_fungus_block', { tex: { all: 'crimson_fungus' }, render: 'cross', hardness: 0, solid: false, transparent: true, opaque: false, replaceable: true, color: [180, 60, 70] });
  def('warped_fungus_block', { tex: { all: 'warped_fungus' }, render: 'cross', hardness: 0, solid: false, transparent: true, opaque: false, replaceable: true, color: [40, 140, 150] });
  def('nether_wart', { tex: { all: 'nether_wart' }, render: 'cross', hardness: 0, solid: false, transparent: true, opaque: false, color: [150, 25, 35], extra: { wart: true } });
  def('sweet_berry_bush', { tex: { all: 'sweet_berry_bush' }, render: 'cross', hardness: 0, solid: false, transparent: true, opaque: false, color: [90, 140, 60], extra: { berries: true } });
  def('kelp_plant', { tex: { all: 'kelp' }, render: 'cross', hardness: 0, solid: false, transparent: true, opaque: false, color: [60, 130, 70], extra: { kelp: true } });
  def('seagrass', { tex: { all: 'seagrass' }, render: 'cross', hardness: 0, solid: false, transparent: true, opaque: false, color: [60, 150, 80], extra: { plant: true } });
  def('tall_seagrass', { tex: { all: 'seagrass' }, render: 'cross', hardness: 0, solid: false, transparent: true, opaque: false, color: [60, 150, 80] });
  def('sea_pickle', { tex: { all: 'sea_pickle' }, render: 'cross', hardness: 0, solid: false, transparent: true, opaque: false, light: 6, color: [138, 160, 64] });
  def('coral', { tex: { all: 'coral_tube' }, render: 'cross', hardness: 1.5, tool: 'pickaxe', tier: 1, solid: false, transparent: true, opaque: false, color: [224, 112, 160] });
  def('dead_coral', { tex: { all: 'coral_tube' }, render: 'cross', hardness: 1.5, tool: 'pickaxe', tier: 1, solid: false, transparent: true, opaque: false, color: [150, 150, 150] });
  def('melon', { tex: { all: 'melon_side', top: 'melon_top', bottom: 'melon_top' }, render: 'cube', hardness: 1, tool: 'axe', walkSound: 'wood', color: [70, 140, 60] });
  def('melon_slice_block', { tex: { all: 'melon_inside' }, render: 'cube', hardness: 1, color: [180, 220, 140] });
  def('pumpkin', { tex: { all: 'pumpkin_side', front: 'pumpkin_face', top: 'pumpkin_top', bottom: 'pumpkin_top' }, render: 'cube', hardness: 1, tool: 'axe', walkSound: 'wood', flammable: true, color: [210, 120, 30] });
  def('carved_pumpkin', { tex: { all: 'pumpkin_side', front: 'carved_pumpkin', top: 'pumpkin_top', bottom: 'pumpkin_top' }, render: 'cube', hardness: 1, tool: 'axe', color: [210, 120, 30] });
  def('pumpkin_stem', { tex: { all: 'pumpkin_side' }, render: 'cross', hardness: 0, solid: false, transparent: true, opaque: false, color: [120, 100, 40] });
  def('hay_block', { tex: { all: 'hay_block' }, render: 'cube', hardness: 0.5, tool: 'axe', flammable: true, walkSound: 'grass', color: [180, 150, 50] });
  def('cobweb', { tex: { all: 'cobweb' }, render: 'cross', hardness: 4, solid: false, transparent: true, opaque: false, drop: 'string', color: [230, 230, 230] });
  def('azalea', { tex: { all: 'azalea' }, render: 'cross', hardness: 0, solid: false, transparent: true, opaque: false, color: [80, 130, 60] });
  def('flowering_azalea', { tex: { all: 'flowering_azalea' }, render: 'cross', hardness: 0, solid: false, transparent: true, opaque: false, color: [140, 160, 120] });
  def('azalea_leaves', { tex: { all: 'azalea_leaves' }, render: 'cube', hardness: 0.2, opaque: false, transparent: true, walkSound: 'grass', color: [80, 130, 60] });
  def('flowering_azalea_leaves', { tex: { all: 'flowering_azalea_leaves' }, render: 'cube', hardness: 0.2, opaque: false, transparent: true, walkSound: 'grass', color: [140, 160, 120] });
  def('big_dripleaf', { tex: { all: 'tall_grass' }, render: 'cross', hardness: 0, solid: false, transparent: true, opaque: false, color: [70, 140, 60] });
  def('small_dripleaf', { tex: { all: 'tall_grass' }, render: 'cross', hardness: 0, solid: false, transparent: true, opaque: false, color: [70, 140, 60] });
  def('moss_carpet', { tex: { all: 'moss_block' }, render: 'carpet', hardness: 0.1, solid: false, transparent: true, opaque: false, color: [80, 110, 50] });
  // crops
  def('wheat_crop', { tex: { all: 'wheat_stage0' }, render: 'cross', hardness: 0, solid: false, transparent: true, opaque: false, color: [150, 160, 60], extra: { crop: 'wheat', stage: 0 } });
  def('carrots', { tex: { all: 'carrot_top' }, render: 'cross', hardness: 0, solid: false, transparent: true, opaque: false, color: [120, 160, 60], extra: { crop: 'carrot', stage: 0 } });
  def('potatoes', { tex: { all: 'potato_top' }, render: 'cross', hardness: 0, solid: false, transparent: true, opaque: false, color: [120, 160, 60], extra: { crop: 'potato', stage: 0 } });
  def('beetroots', { tex: { all: 'beetroot_top' }, render: 'cross', hardness: 0, solid: false, transparent: true, opaque: false, color: [150, 60, 80], extra: { crop: 'beetroot', stage: 0 } });

  // ---------- Nether ----------
  def('netherrack', { tex: { all: 'netherrack' }, render: 'cube', hardness: 0.4, tool: 'pickaxe', tier: 1, walkSound: 'stone', color: [120, 45, 38] });
  def('soul_sand', { tex: { all: 'soul_sand' }, render: 'cube', hardness: 0.5, tool: 'shovel', walkSound: 'sand', color: [80, 62, 48] });
  def('soul_soil', { tex: { all: 'soul_soil' }, render: 'cube', hardness: 0.5, tool: 'shovel', walkSound: 'sand', color: [70, 55, 45] });
  def('basalt', { tex: { all: 'basalt' }, render: 'cube', hardness: 1.25, tool: 'pickaxe', tier: 1, color: [70, 75, 80] });
  def('polished_basalt', { tex: { all: 'polished_basalt' }, render: 'cube', hardness: 1.25, tool: 'pickaxe', tier: 1, color: [80, 85, 90] });
  def('smooth_basalt', { tex: { all: 'polished_basalt' }, render: 'cube', hardness: 1.25, tool: 'pickaxe', tier: 1, color: [75, 78, 85] });
  def('blackstone', { tex: { all: 'blackstone' }, render: 'cube', hardness: 1.5, tool: 'pickaxe', tier: 1, color: [45, 40, 50] });
  def('gilded_blackstone', { tex: { all: 'gilded_blackstone' }, render: 'cube', hardness: 3.5, tool: 'pickaxe', tier: 1, dropsFn: () => [{ item: 'gold_ingot', count: 1 + ((Math.random() * 4) | 0) }, { item: 'blackstone', count: 1 }], color: [60, 55, 40] });
  def('polished_blackstone', { tex: { all: 'polished_blackstone' }, render: 'cube', hardness: 1.5, tool: 'pickaxe', tier: 1, color: [50, 45, 55] });
  def('polished_blackstone_bricks', { tex: { all: 'polished_blackstone' }, render: 'cube', hardness: 1.5, tool: 'pickaxe', tier: 1, color: [48, 43, 52] });
  def('blackstone_slab', { tex: { all: 'blackstone' }, render: 'slab', hardness: 1.5, tool: 'pickaxe', tier: 1, color: [45, 40, 50] });
  def('blackstone_stairs', { tex: { all: 'blackstone' }, render: 'stairs', hardness: 1.5, tool: 'pickaxe', tier: 1, color: [45, 40, 50] });
  def('quartz_block', { tex: { all: 'quartz_block' }, render: 'cube', hardness: 0.8, tool: 'pickaxe', tier: 1, color: [235, 230, 220] });
  def('quartz_bricks', { tex: { all: 'quartz_bricks' }, render: 'cube', hardness: 0.8, tool: 'pickaxe', tier: 1, color: [230, 225, 215] });
  def('chiseled_quartz_block', { tex: { all: 'chiseled_quartz' }, render: 'cube', hardness: 0.8, tool: 'pickaxe', tier: 1, color: [232, 228, 218] });
  def('quartz_slab', { tex: { all: 'quartz_block' }, render: 'slab', hardness: 0.8, tool: 'pickaxe', tier: 1, color: [235, 230, 220] });
  def('quartz_stairs', { tex: { all: 'quartz_block' }, render: 'stairs', hardness: 0.8, tool: 'pickaxe', tier: 1, color: [235, 230, 220] });
  def('magma_block', { tex: { all: 'magma' }, render: 'cube', hardness: 0.5, tool: 'pickaxe', tier: 1, light: 0, color: [120, 60, 20], extra: { magma: true } });
  def('nether_portal', { tex: { all: 'nether_portal' }, render: 'cube', hardness: -1, solid: false, transparent: true, opaque: false, light: 11, drop: null, color: [120, 40, 200], extra: { portal: 'nether' } });
  def('weeping_vines', { tex: { all: 'weeping_vines' }, render: 'cross', hardness: 0.2, solid: false, transparent: true, opaque: false, color: [160, 64, 80] });
  def('twisting_vines', { tex: { all: 'twisting_vines' }, render: 'cross', hardness: 0.2, solid: false, transparent: true, opaque: false, color: [58, 160, 80] });

  // ---------- End ----------
  def('end_stone', { tex: { all: 'end_stone' }, render: 'cube', hardness: 3, tool: 'pickaxe', tier: 1, walkSound: 'stone', color: [220, 220, 150] });
  def('end_stone_bricks', { tex: { all: 'end_stone_bricks' }, render: 'cube', hardness: 3, tool: 'pickaxe', tier: 1, color: [210, 210, 140] });
  def('purpur_block', { tex: { all: 'purpur_block' }, render: 'cube', hardness: 1.5, tool: 'pickaxe', tier: 1, color: [170, 120, 170] });
  def('purpur_pillar', { tex: { all: 'purpur_pillar' }, render: 'cube', hardness: 1.5, tool: 'pickaxe', tier: 1, color: [175, 125, 175] });
  def('end_portal_frame', { tex: { all: 'end_portal_frame' }, render: 'cube', hardness: -1, solid: true, opaque: false, transparent: true, drop: null, light: 1, color: [180, 180, 110], extra: { endFrame: true } });
  def('end_portal_block', { tex: { all: 'end_portal' }, render: 'cube', hardness: -1, solid: false, transparent: true, opaque: false, light: 15, drop: null, color: [10, 20, 15], extra: { portal: 'end' } });
  def('end_gateway_block', { tex: { all: 'end_gateway' }, render: 'cube', hardness: -1, solid: false, transparent: true, opaque: false, light: 15, drop: null, color: [80, 40, 120], extra: { portal: 'return' } });
  def('dragon_egg', { tex: { all: 'dragon_egg' }, render: 'cube', hardness: 3, tool: 'pickaxe', tier: 3, light: 5, color: [30, 15, 40], extra: { dragonEgg: true } });
  def('chorus_plant', { tex: { all: 'purpur_block' }, render: 'cube', hardness: 0.4, solid: false, transparent: true, opaque: false, color: [120, 90, 130] });
  def('end_rod_block', { tex: { all: 'bone_block' }, render: 'cross', hardness: 0, solid: false, transparent: true, opaque: false, light: 15, color: [250, 250, 250] });

  // ---------- Special ----------
  def('bed', { tex: { all: 'bed_side', top: 'bed_top', bottom: 'oak_planks' }, render: 'bed', hardness: 0.2, solid: true, opaque: false, transparent: true, walkSound: 'wood', color: [200, 50, 50], extra: { bed: true } });
  def('sculk', { tex: { all: 'sculk' }, render: 'cube', hardness: 0.2, transparent: true, opaque: false, color: [20, 30, 40] });
  def('sculk_catalyst', { tex: { all: 'sculk_catalyst' }, render: 'cube', hardness: 3, tool: 'hoe', light: 6, color: [30, 60, 70] });
  def('sculk_shrieker', { tex: { all: 'sculk_shrieker' }, render: 'cube', hardness: 2.5, transparent: true, opaque: false, color: [25, 45, 55] });
  def('sculk_sensor', { tex: { all: 'sculk_sensor' }, render: 'cube', hardness: 1, transparent: true, opaque: false, color: [30, 60, 70] });
  def('reinforced_deepslate', { tex: { all: 'deepslate_bricks' }, render: 'cube', hardness: 50, tool: 'pickaxe', tier: 4, drop: null, color: [70, 70, 78] });
  def('decorated_pot', { tex: { all: 'terracotta' }, render: 'cross', hardness: 1, solid: false, transparent: true, opaque: false, color: [180, 120, 80] });
  def('suspicious_sand', { tex: { all: 'sand' }, render: 'cube', hardness: 0.5, tool: 'shovel', color: [220, 210, 160] });
  def('brushed_dirt', { tex: { all: 'dirt' }, render: 'cube', hardness: 0.5, tool: 'shovel', color: [134, 96, 67] });
  def('sniffer_egg', { tex: { all: 'dragon_egg' }, render: 'cube', hardness: 0.5, color: [160, 120, 90] });
  def('froglight', { tex: { all: 'shroomlight' }, render: 'cube', hardness: 1, light: 15, color: [200, 170, 90] });
  def('pearlescent_froglight', { tex: { all: 'shroomlight' }, render: 'cube', hardness: 1, light: 15, color: [220, 150, 220] });
  def('verdant_froglight', { tex: { all: 'shroomlight' }, render: 'cube', hardness: 1, light: 15, color: [150, 220, 150] });
  def('reinforced_deepslate_tile', { tex: { all: 'deepslate' }, render: 'cube', hardness: 50, drop: null, color: [65, 65, 72] });

  // ---------- Registry API ----------
  WC.blockId = (name) => (B[name] ? B[name].id : 0);
  WC.blockDef = (idOrName) => typeof idOrName === 'number' ? WC.blockIds[idOrName] : B[idOrName];
  WC.isSolid = (def) => def && def.solid;
  WC.isOpaque = (def) => def && def.opaque;
  WC.isLiquid = (def) => def && def.liquid;
  WC.canPassThrough = (def) => !def || !def.solid;

  // texture resolution per face
  // faceIndex: 0 +X(east) 1 -X(west) 2 +Y(top) 3 -Y(bottom) 4 +Z(south) 5 -Z(north)
  WC.faceTex = function (def, faceIndex, meta) {
    const t = def.tex;
    let name = t.all;
    if (faceIndex === 2 && t.top) name = t.top;
    else if (faceIndex === 3 && t.bottom) name = t.bottom;
    else if (t.side) name = t.side;
    if (t.front !== undefined && t.front !== null) {
      const fdir = (meta && meta.dir !== undefined) ? meta.dir : 4;
      if (faceIndex === fdir) name = t.front;
    }
    if (faceIndex === 2 && t.cropTop) name = t.cropTop;
    return name;
  };
})();
