// ============================================================
// Crafting system: shaped/shapeless grid recipes, furnace,
// smoker, blast furnace, campfire cooking, stonecutter,
// smithing (netherite upgrades & armor trims), brewing,
// enchanting costs. Includes copper tools/armor, spear, mace.
// ============================================================
(function () {
  'use strict';
  const WC = window.WC;
  const R = WC.recipes = [];

  // kind: 'shaped' | 'shapeless' | 'smelting' | 'blasting' | 'smoking' | 'campfire' | 'stonecutting' | 'smithing' | 'brewing' | 'special'
  function shaped(out, count, pattern, key) {
    R.push({ kind: 'shaped', out, count: count || 1, pattern, key });
  }
  function shapeless(out, count, ing) {
    R.push({ kind: 'shapeless', out, count: count || 1, ingredients: ing });
  }
  function smelt(out, count, inp, time = 10, kind = 'smelting') {
    R.push({ kind, out, count: count || 1, ingredient: inp, time });
  }

  const W = ['oak', 'spruce', 'birch', 'jungle', 'acacia', 'dark_oak', 'mangrove', 'cherry', 'bamboo'];
  const NW = ['crimson', 'warped'];
  const ALLW = [...W, ...NW];

  // ---------- Base materials ----------
  shapeless('stick', 4, ['planks']);
  shaped('torch', 4, ['#', '#', 'S'], { '#': 'coal', S: 'stick' });
  shaped('soul_torch', 4, ['#', '#', 'S'], { '#': 'coal', S: 'stick' }); // alt: soul sand + torches handled specially
  shaped('charcoal_block', 1, ['CCC', 'CCC', 'CCC'], { C: 'charcoal' });
  shaped('coal', 9, ['B'], { B: 'coal_block' });
  shaped('coal_block', 1, ['CCC', 'CCC', 'CCC'], { C: 'coal' });
  for (const raw of [['raw_iron', 'raw_iron_block'], ['raw_gold', 'raw_gold_block'], ['raw_copper', 'raw_copper_block']]) {
    shaped(raw[1], 1, ['RRR', 'RRR', 'RRR'], { R: raw[0] });
    shapeless(raw[0], 9, [raw[1]]);
  }
  for (const ing of [['iron_ingot', 'iron_block'], ['gold_ingot', 'gold_block'], ['copper_ingot', 'copper_block'], ['diamond', 'diamond_block'], ['emerald', 'emerald_block'], ['lapis_lazuli', 'lapis_block'], ['quartz', 'quartz_block'], ['netherite_ingot', 'netherite_block']]) {
    if (!WC.blockByName[ing[1]]) continue;
    shaped(ing[1], 1, ['III', 'III', 'III'], { I: ing[0] });
    shapeless(ing[0], 9, [ing[1]]);
  }
  shapeless('bone_meal', 3, ['bone']);
  shaped('bone_block', 1, ['BBB', 'BBB', 'BBB'], { B: 'bone_meal' });
  shapeless('bone', 9, ['bone_block']);
  shaped('wheat', 9, ['F'], { F: 'hay_block' });
  shaped('hay_block', 1, ['WWW', 'WWW', 'WWW'], { W: 'wheat' });
  shapeless('string_from_wool', 4, []); // placeholder no
  R.pop();
  shaped('carpet', 3, ['WW'], { W: 'wool_white' });
  shapeless('feather_to_string', 1, []); R.pop();
  // cobble->stone via smelt below; stone bricks etc
  shaped('stone_bricks', 4, ['SS', 'SS'], { S: 'stone' });
  shaped('mossy_stone_bricks', 1, ['SC', 'CS'], { S: 'stone_bricks', C: 'vine' });
  shaped('cracked_stone_bricks', 1, ['B'], { B: 'stone_bricks' }); // needs furnace - simplified as craftable
  shaped('chiseled_stone_bricks', 1, ['SS'], { S: 'stone_slab' });
  shaped('polished_granite', 4, ['GG', 'GG'], { G: 'granite' });
  shaped('polished_diorite', 4, ['DD', 'DD'], { D: 'diorite' });
  shaped('polished_andesite', 4, ['AA', 'AA'], { A: 'andesite' });
  shaped('polished_deepslate', 4, ['DD', 'DD'], { D: 'cobbled_deepslate' });
  shaped('deepslate_bricks', 4, ['DD', 'DD'], { D: 'polished_deepslate' });
  shaped('polished_blackstone', 4, ['BB', 'BB'], { B: 'blackstone' });
  shaped('polished_blackstone_bricks', 4, ['PP', 'PP'], { P: 'polished_blackstone' });
  shaped('chiseled_polished_blackstone', 1, ['PP'], { P: 'polished_blackstone_slab' });
  shaped('quartz_bricks', 4, ['QQ', 'QQ'], { Q: 'quartz_block' });
  shaped('chiseled_quartz_block', 1, ['QQ'], { Q: 'quartz_slab' });
  shaped('quartz_block', 4, ['QQ', 'QQ'], { Q: 'quartz' });
  shaped('smooth_sandstone_like', 1, []); R.pop();
  shaped('end_stone_bricks', 4, ['EE', 'EE'], { E: 'end_stone' });
  shaped('purpur_block', 4, ['CC', 'CC'], { C: 'popped_chorus_fruit' });
  shaped('purpur_pillar', 2, ['P', 'P'], { P: 'purpur_block' });
  shaped('bricks', 1, ['BB', 'BB'], { B: 'brick' });
  shaped('mud_bricks', 4, ['MM', 'MM'], { M: 'packed_mud' });
  shaped('packed_mud', 1, ['MD'], { M: 'mud', D: 'dirt' });
  shaped('terracotta_like', 1, []); R.pop();
  // Slabs / stairs / fences per wood
  for (const w of ALLW) {
    const p = w + '_planks';
    if (!WC.blockByName[p]) continue;
    shaped(w + '_slab', 6, ['PPP'], { P: p });
    shaped(w + '_stairs', 4, ['P  ', 'PP ', 'PPP'], { P: p });
    shaped(w + '_fence', 3, ['PSP', 'PSP'], { P: p, S: 'stick' });
    shaped(w + '_door', 3, ['PP', 'PP', 'PP'], { P: p });
    shaped(w + '_trapdoor', 2, ['PP', 'PP'], { P: p });
    shaped(w + '_button', 1, ['P'], { P: p });
    shaped(w + '_pressure_plate', 1, ['PP'], { P: p });
    shaped(w + '_sign', 3, ['PPP', 'PSP', ' S'], { P: p, S: 'stick' });
    if (WC.blockByName[w + '_wood']) shaped(w + '_bookshelf', 1, ['PPP', 'BBB', 'PPP'], { P: p, B: 'book' });
    if (WC.blockByName[w + '_block'] || WC.blockByName[w + '_log']) { /* logs exist */ }
    if (WC.blockByName[w + '_slab']) shaped(w + '_double_check', 1, []); R.pop();
  }
  // Stone-family slabs/stairs
  const STONEFAM = ['stone', 'cobblestone', 'stone_bricks', 'mossy_cobblestone', 'deepslate', 'cobbled_deepslate', 'polished_deepslate', 'deepslate_bricks', 'tuff', 'granite', 'diorite', 'andesite', 'bricks', 'mud_bricks', 'prismarine', 'dark_prismarine', 'end_stone_bricks', 'purpur_block', 'blackstone', 'polished_blackstone', 'quartz_block'];
  for (const s of STONEFAM) {
    if (!WC.blockByName[s]) continue;
    if (WC.blockByName[s + '_slab']) shaped(s + '_slab', 6, ['XXX'], { X: s });
    if (WC.blockByName[s + '_stairs']) shaped(s + '_stairs', 4, ['X  ', 'XX ', 'XXX'], { X: s });
  }
  // Copper slabs/stairs/cut/chiseled
  for (const st of ['', 'exposed_', 'weathered_', 'oxidized_']) {
    const base = (st === '' ? 'copper' : st.replace('_', '') ) + '_block';
    const bname = WC.blockByName[base] ? base : null;
    if (!bname) continue;
    const cut = 'cut_' + base, chis = 'chiseled_' + base;
    shaped(cut, 4, ['CC', 'CC'], { C: bname });
    shaped(chis, 1, ['CC'], { C: WC.blockByName['cut_' + base + '_slab'] ? 'cut_' + base + '_slab' : bname });
    if (WC.blockByName[cut + '_slab']) shaped(cut + '_slab', 6, ['CCC'], { C: cut });
    if (WC.blockByName[cut + '_stairs']) shaped(cut + '_stairs', 4, ['C  ', 'CC ', 'CCC'], { C: cut });
    if (WC.blockByName[base.replace('_block', '') + '_slab'] || WC.blockByName[(st ? st.replace('_', '') : '') + 'copper_slab']) { /* registered differently */ }
  }
  // Register copper slab/stairs crafting against actual names
  for (const st of ['copper', 'exposed_copper', 'weathered_copper', 'oxidized_copper']) {
    if (WC.blockByName[st + '_slab']) shaped(st + '_slab', 6, ['CCC'], { C: st + '_block' });
    if (WC.blockByName[st + '_stairs']) shaped(st + '_stairs', 4, ['C  ', 'CC ', 'CCC'], { C: st + '_block' });
  }
  shaped('lightning_rod', 1, ['C', 'C', 'I'], { C: 'copper_ingot', I: 'copper_block' });
  shaped('copper_grate', 4, ['CC', 'CC'], { C: 'cut_copper_block' });
  shaped('copper_bulb', 1, ['G', 'C', 'G'], { G: 'glowstone_dust', C: 'copper_block' });

  // ---------- Tools (all tiers) ----------
  for (const mat of ['wooden', 'stone', 'copper', 'iron', 'golden', 'diamond', 'netherite']) {
    const m = mat === 'netherite' ? 'netherite_ingot' : mat === 'wooden' ? 'oak_planks' : mat === 'stone' ? 'cobblestone' : mat === 'copper' ? 'copper_ingot' : mat === 'iron' ? 'iron_ingot' : mat === 'golden' ? 'gold_ingot' : 'diamond';
    shaped(mat + '_sword', 1, ['M', 'M', 'S'], { M: m, S: 'stick' });
    shaped(mat + '_pickaxe', 1, ['MMM', ' S ', ' S '], { M: m, S: 'stick' });
    shaped(mat + '_axe', 1, ['MM', 'MS', ' S'], { M: m, S: 'stick' });
    shaped(mat + '_shovel', 1, ['M', 'S', 'S'], { M: m, S: 'stick' });
    shaped(mat + '_hoe', 1, ['MM', ' S', ' S'], { M: m, S: 'stick' });
    shaped(mat + '_spear', 1, ['  M', ' S ', 'S  '], { M: m, S: 'stick' });
    if (['iron', 'diamond', 'netherite'].includes(mat)) {
      shaped(mat + '_mace', 1, [' M ', 'MSM', ' S '], { M: m, S: 'stick' });
    }
  }
  // Mace special: heavy core based recipe too
  shaped('mace_heavy', 1, [' H ', 'HSR', ' S '], { H: 'heavy_core', S: 'stick', R: 'iron_ingot' });
  // Netherite upgrade recipes handled in smithing section.

  // ---------- Weapons/misc ----------
  shaped('bow', 1, [' #S', '# S', ' #S'], { '#': 'stick', S: 'string' });
  shaped('crossbow', 1, ['#SD', 'S# ', 'D# '], { '#': 'stick', S: 'string', D: 'planks' });
  shaped('arrow', 4, ['F', 'S', 'T'], { F: 'flint', S: 'stick', T: 'feather' });
  shaped('shield', 1, ['POP', 'PPP', ' P '], { P: 'planks', O: 'iron_ingot' });
  shaped('shears', 1, [' I', 'I '], { I: 'iron_ingot' });
  shaped('flint_and_steel', 1, ['I ', ' F'], { I: 'iron_ingot', F: 'flint' });
  shaped('fishing_rod', 1, ['  S', ' #S', '# #'], { S: 'stick', '#': 'string' });
  shaped('carrot_on_a_stick', 1, ['  C', '  F', ' S '], { C: 'carrot', F: 'fishing_rod', S: 'stick' });
  shaped('warped_fungus_on_a_stick', 1, ['  W', '  F', ' S '], { W: 'warped_fungus', F: 'fishing_rod', S: 'stick' });
  shaped('spyglass', 1, [' Q', 'I ', 'I '], { Q: 'amethyst_shard', I: 'copper_ingot' });
  shaped('brush', 1, [' B', ' S', ' I'], { B: 'feather', S: 'stick', I: 'copper_ingot' });
  shaped('bucket', 3, ['I I', ' I '], { I: 'iron_ingot' });
  shaped('minecart', 1, ['I I', 'III'], { I: 'iron_ingot' });
  shaped('chest_minecart', 1, ['C', 'M'], { C: 'chest', M: 'minecart' });
  shaped('hopper_minecart', 1, ['H', 'M'], { H: 'hopper', M: 'minecart' });
  shaped('furnace_minecart', 1, ['F', 'M'], { F: 'furnace', M: 'minecart' });
  shaped('tnt_minecart', 1, ['T', 'M'], { T: 'tnt', M: 'minecart' });
  for (const w of W) if (WC.blockByName[w + '_boat'] || true) {
    // boats: use planks generic since boat items defined only oak; register alias
  }
  shaped('oak_boat', 1, ['P P', 'PPP'], { P: 'oak_planks' });
  shaped('chest_boat', 1, ['C', 'B'], { C: 'chest', B: 'oak_boat' });
  shaped('lead', 1, ['## ', '#O ', '  #'], { '#': 'string', O: 'slime_ball' });
  shaped('painting', 1, ['###', '#X#', '###'], { '#': 'stick', X: 'wool_white' });
  shaped('item_frame_item', 1, ['###', '#L#', '###'], { '#': 'stick', L: 'leather' });
  shaped('glowing_item_frame', 1, ['F'], { F: 'item_frame_item' });
  shaped('armor_stand', 1, ['SSS', ' S ', 'S#S'], { S: 'stick', '#': 'slab_any' });
  shaped('flower_pot', 3, ['I I', ' I '], { I: 'brick' });
  shaped('lantern', 1, [' S ', 'S#S', ' S '], { S: 'iron_nugget', '#': 'torch' });
  shaped('soul_lantern', 1, [' S ', 'S#S', ' S '], { S: 'iron_nugget', '#': 'soul_torch' });
  shaped('campfire', 1, [' S ', 'SCS', '###'], { S: 'stick', C: 'coal', '#': 'log' });
  shaped('soul_campfire', 1, [' S ', 'SCS', '###'], { S: 'stick', C: 'coal', '#': 'soul_soil' });
  shaped('tnt', 1, ['GSG', 'SGS', 'GSG'], { G: 'gunpowder', S: 'sand' });
  shaped('target', 1, ['RRR', 'RWR', 'RRR'], { R: 'redstone', W: 'wool_white' });
  shaped('scaffolding', 6, ['BSS', 'BSB', 'SSB'], { B: 'bamboo', S: 'string' });
  shaped('lodestone', 1, ['OOO', 'ONN', 'OOO'], { O: 'obsidian', N: 'netherite_ingot' });
  shaped('respawn_anchor', 1, ['OOO', 'NNN', 'OOO'], { O: 'obsidian', N: 'glowstone' });
  shaped('beacon', 1, ['GGG', 'GNZ', 'OOO'], { G: 'glass', N: 'nether_star', Z: 'obsidian', O: 'obsidian' });
  shaped('conduit', 1, ['PNP', 'NZN', 'PNP'], { P: 'nautilus_shell', N: 'heart_of_the_sea', Z: 'obsidian' });
  // add missing mats used above
  if (!WC.items.nautilus_shell) WC.items.nautilus_shell = { name: 'nautilus_shell', display: 'Nautilus Shell', stack: 64, type: 'item', color: [200, 180, 160], icon: 'shell' };
  if (!WC.items.heart_of_the_sea) WC.items.heart_of_the_sea = { name: 'heart_of_the_sea', display: 'Heart Of The Sea', stack: 64, type: 'item', color: [60, 180, 220], icon: 'heart' };
  if (!WC.items.nether_star) WC.items.nether_star = { name: 'nether_star', display: 'Nether Star', stack: 64, type: 'item', color: [240, 240, 200], icon: 'star', rare: true };

  // ---------- Stations ----------
  shaped('crafting_table', 1, ['PP', 'PP'], { P: 'planks' });
  shaped('furnace', 1, ['CCC', 'C C', 'CCC'], { C: 'cobblestone' });
  shaped('blast_furnace', 1, ['FFF', 'I I', 'CCC'], { F: 'furnace', I: 'iron_ingot', C: 'cobblestone' });
  shaped('smoker', 1, ['FFF', 'S S', 'LLL'], { F: 'furnace', S: 'log', L: 'planks' });
  shaped('chest', 1, ['PPP', 'P P', 'PPP'], { P: 'planks' });
  shaped('trapped_chest', 1, ['T', 'C'], { T: 'tripwire_hook', C: 'chest' });
  shaped('barrel', 1, ['PSP', 'P P', 'PSP'], { P: 'planks', S: 'stick' });
  shaped('ender_chest', 1, ['EEE', 'ECE', 'EEE'], { E: 'obsidian', C: 'eye_of_ender' });
  shaped('bookshelf', 1, ['PPP', 'BBB', 'PPP'], { P: 'planks', B: 'book' });
  shaped('lectern', 1, ['B', 'S', 'SSS'], { B: 'bookshelf', S: 'stone_slab' });
  shaped('enchanting_table', 1, [' B ', 'DOO', 'OOO'], { B: 'book', D: 'diamond', O: 'obsidian' });
  shaped('anvil', 1, ['III', ' I ', 'III'], { I: 'iron_block' });
  shaped('grindstone', 1, ['PS', 'PPP'], { P: 'planks', S: 'stone_slab' });
  shaped('smithing_table', 1, ['II', 'PP', 'PP'], { I: 'iron_ingot', P: 'planks' });
  shaped('stonecutter', 1, ['I', 'S', 'S'], { I: 'iron_ingot', S: 'stone' });
  shaped('loom', 1, ['SS', 'PP', 'PP'], { S: 'string', P: 'planks' });
  shaped('cartography_table', 1, ['PP', 'PP', 'DD'], { P: 'planks', D: 'paper' });
  shaped('fletching_table', 1, ['FF', 'PP', 'PP'], { F: 'flint', P: 'planks' });
  shaped('composter', 1, ['P P', 'P P', 'PPP'], { P: 'planks' });
  shaped('cauldron', 1, ['I I', 'I I', 'III'], { I: 'iron_ingot' });
  shaped('bell', 1, ['GGG', 'G G', ' S '], { G: 'gold_ingot', S: 'stick' });
  shaped('chain', 1, ['I', 'I', 'I'], { I: 'iron_nugget' });
  shaped('iron_bars', 16, ['III', 'III'], { I: 'iron_ingot' });
  shaped('hopper', 1, ['I I', 'ICI', ' I '], { I: 'iron_ingot', C: 'chest' });
  shaped('observer', 1, ['CCC', 'CRQ', 'CCC'], { C: 'cobblestone', R: 'redstone', Q: 'quartz' });
  shaped('dispenser', 1, ['CCC', 'CIC', 'CRB'], { C: 'cobblestone', I: 'bow', R: 'redstone', B: 'gunpowder' });
  shaped('dropper', 1, ['CCC', 'C C', 'CRC'], { C: 'cobblestone', R: 'redstone' });
  shaped('piston', 1, ['PPP', 'CIC', 'CR '], { P: 'planks', C: 'cobblestone', I: 'iron_ingot', R: 'redstone' });
  shaped('sticky_piston', 1, ['S', 'P'], { S: 'slime_ball', P: 'piston' });
  shaped('note_block', 1, ['PPP', 'PRP', 'PPP'], { P: 'planks', R: 'redstone' });
  shaped('redstone_lamp', 1, ['GRG', 'RGR', 'GRG'], { G: 'glass', R: 'redstone' });
  shaped('repeater', 1, ['RRR', 'TT ', '   '], { R: 'redstone_torch', T: 'stone' });
  shaped('comparator', 1, ['TTT', 'TQT', 'CCC'], { T: 'redstone_torch', Q: 'quartz', C: 'stone' });
  shaped('lever', 1, ['S', 'C'], { S: 'stick', C: 'cobblestone' });
  shaped('stone_button', 1, ['S'], { S: 'stone' });
  shaped('stone_pressure_plate', 1, ['SS'], { S: 'stone' });
  shaped('light_weighted_pressure_plate', 1, ['GG'], { G: 'gold_ingot' });
  shaped('heavy_weighted_pressure_plate', 1, ['II'], { I: 'iron_ingot' });
  shaped('daylight_detector', 1, ['GGG', 'QQQ', 'SSS'], { G: 'glass', Q: 'quartz', S: 'slab_any' });
  shaped('tripwire_hook', 1, ['I', 'S', 'P'], { I: 'iron_ingot', S: 'stick', P: 'planks' });
  shaped('redstone_block', 1, ['RRR', 'RRR', 'RRR'], { R: 'redstone' });
  shapeless('redstone', 9, ['redstone_block']);
  shaped('redstone_torch', 1, ['R', 'S'], { R: 'redstone', S: 'stick' });
  shaped('slime_block', 1, ['SSS', 'SSS', 'SSS'], { S: 'slime_ball' });
  shapeless('slime_ball', 9, ['slime_block']);
  shaped('honey_block', 1, ['HH', 'HH'], { H: 'honey_bottle' });
  shapeless('honey_bottle', 4, ['honey_block']);
  shaped('magma_block', 1, ['SN', 'NS'], { S: 'slime_ball', N: 'nether_wart' });
  shaped('glowstone', 1, ['GG', 'GG'], { G: 'glowstone_dust' });
  shapeless('glowstone_dust', 4, ['glowstone']);
  shaped('sea_lantern', 1, ['GPG', 'PTP', 'GPG'], { G: 'glass_pane', P: 'prismarine_shard', T: 'prismarine_crystals' });
  if (!WC.items.prismarine_shard) WC.items.prismarine_shard = { name: 'prismarine_shard', display: 'Prismarine Shard', stack: 64, type: 'item', color: [90, 150, 140], icon: 'shard' };
  if (!WC.items.prismarine_crystals) WC.items.prismarine_crystals = { name: 'prismarine_crystals', display: 'Prismarine Crystals', stack: 64, type: 'item', color: [140, 200, 180], icon: 'crystal' };
  shaped('prismarine', 1, ['SS', 'SS'], { S: 'prismarine_shard' });
  shaped('prismarine_bricks', 1, ['PP', 'PP'], { P: 'prismarine' });
  shaped('dark_prismarine', 1, ['SSS', 'SIS', 'SSS'], { S: 'prismarine_shard', I: 'black_dye' });
  shaped('end_crystal', 1, ['GGG', 'GEG', 'NTN'], { G: 'glass', E: 'eye_of_ender', N: 'ghast_tear', T: 'gold_block' });
  shaped('dragon_breath_glass', 1, [], {}); R.pop();
  shaped('experience_bottle_like', 1, []); R.pop();

  // ---------- Glass / ice / snow ----------
  shaped('glass_pane', 16, ['GG', 'GG'], { G: 'glass' });
  shaped('snow_block', 1, ['SS', 'SS'], { S: 'snowball' });
  shapeless('snowball', 4, ['snow_block']);
  shaped('packed_ice', 1, ['III', 'III', 'III'], { I: 'ice' });
  shaped('blue_ice', 1, ['III', 'III', 'III'], { I: 'packed_ice' });
  shaped('item_frame_glow', 1, []); R.pop();

  // ---------- Food & farm ----------
  shapeless('bread', 1, ['WWW', '', ''], ); R.pop();
  shaped('bread', 1, ['WWW'], { W: 'wheat' });
  shaped('cake', 1, ['MMM', 'SES', 'BBB'], { M: 'milk_bucket', S: 'sugar', E: 'egg', B: 'wheat' });
  shaped('cookie', 8, ['WSW'], { W: 'wheat', S: 'sugar' });
  shaped('mushroom_stew', 1, ['BR'], { B: 'bowl', R: 'brown_mushroom' });
  shaped('rabbit_stew', 1, ['CCCCC'], { C: 'cooked_rabbit' }); R.pop();
  shaped('rabbit_stew', 1, ['BCR', 'CP ', ' S '], { B: 'bowl', C: 'cooked_rabbit', R: 'carrot', P: 'potato', S: 'baked_potato' });
  shaped('beetroot_soup', 1, ['BBBBB'], { B: 'beetroot' }); R.pop();
  shaped('beetroot_soup', 1, ['BBB', ' B ', ' S '], { B: 'beetroot', S: 'bowl' });
  shaped('suspicious_stew', 1, ['BBB', ' B ', ' S '], { B: 'flower' }); R.pop();
  shaped('pumpkin_pie', 1, ['PE'], { P: 'pumpkin', E: 'sugar' });
  shaped('melon_seeds', 1, ['M'], { M: 'melon_slice' });
  shaped('pumpkin_seeds', 1, ['P'], { P: 'pumpkin' });
  shaped('beetroot_seeds', 1, ['B'], { B: 'beetroot' });
  shapeless('wheat_seeds', 2, ['wheat_crop']);
  shaped('sugar', 1, ['S'], { S: 'sugar_cane' });
  shaped('paper', 3, ['SSS'], { S: 'sugar_cane' });
  shaped('golden_apple', 1, ['GGG', 'GAG', 'GGG'], { G: 'gold_nugget', A: 'apple' });
  shaped('gold_nugget_from_ingot', 9, ['G'], { G: 'gold_ingot' }); R[R.length-1].out = 'gold_nugget';
  shaped('iron_nugget_from_ingot', 9, ['G'], { G: 'iron_ingot' }); R[R.length-1].out = 'iron_nugget';
  shaped('gold_ingot_from_nuggets', 1, ['GGG', 'GGG', 'GGG'], { G: 'gold_nugget' }); R[R.length-1].out = 'gold_ingot';
  shaped('iron_ingot_from_nuggets', 1, ['GGG', 'GGG', 'GGG'], { G: 'iron_nugget' }); R[R.length-1].out = 'iron_ingot';
  shaped('golden_carrot', 1, ['GGG', 'GC ', 'GGG'], { G: 'gold_nugget', C: 'carrot' });
  shaped('glistering_melon', 1, ['GGG', 'GMG', 'GGG'], { G: 'gold_nugget', M: 'melon_slice' });
  if (!WC.items.glistering_melon_slice) WC.items.glistering_melon_slice = { name: 'glistering_melon_slice', display: 'Glistering Melon Slice', stack: 64, type: 'item', color: [240, 210, 60], icon: 'melon' };
  shaped('fermented_spider_eye', 1, ['SEB'], { S: 'spider_eye', E: 'brown_mushroom', B: 'sugar' });
  shaped('magma_cream', 1, ['BS'], { B: 'blaze_powder', S: 'slime_ball' });
  shapeless('blaze_powder', 2, ['blaze_rod']);
  shaped('eye_of_ender', 1, ['BE'], { B: 'blaze_powder', E: 'ender_pearl' });
  shaped('ender_eye_alias', 1, ['BE'], { B: 'blaze_powder', E: 'ender_pearl' }); R.pop();
  shaped('firework_rocket', 3, ['PGG'], { P: 'paper', G: 'gunpowder' });
  shaped('firework_star', 1, ['GD'], { G: 'gunpowder', D: 'dye_any' });
  shaped('totem_from_heads', 1, []); R.pop();
  shaped('wind_charge', 1, ['SBS', 'BTB', 'SBS'], { S: 'breeze_rod', B: 'slime_ball', T: 'amethyst_shard' });
  shaped('resonance_upgrade', 1, []); R.pop();

  // ---------- Wool / carpets / beds ----------
  shapeless('white_wool_from_string', 1, ['SS', 'SS']); R[R.length-1].ingredients = ['string', 'string', 'string', 'string']; R[R.length-1].out = 'wool_white';
  for (const c of ['white','orange','magenta','light_blue','yellow','lime','pink','gray','light_gray','cyan','purple','blue','brown','green','red','black']) {
    shapeless('wool_' + c, 1, ['wool_white', c + '_dye']);
    shapeless('carpet_' + c, 3, ['wool_' + c]);
    shapeless('bed_' + c, 1, ['WWW', 'PPP']); R.pop();
    shaped('bed_' + c, 1, ['WWW', 'PPP'], { W: 'wool_' + c, P: 'planks' });
    shapeless('concrete_powder_' + c, 8, ['csg']); R.pop();
    shaped('concrete_powder_' + c, 8, ['SSS', 'SCS', 'SSS'], { S: 'sand', C: 'csg_' + c });
    if (!WC.items['csg_' + c]) WC.items['csg_' + c] = { name: 'csg_' + c, display: c + ' Concrete Powder Mix', stack: 64, type: 'item', color: [150,150,150], icon: 'powder' };
  }
  // simpler concrete powder: gravel+sand+dye
  for (const c of ['white','orange','magenta','light_blue','yellow','lime','pink','gray','light_gray','cyan','purple','blue','brown','green','red','black']) {
    shapeless('concrete_powder_' + c, 8, ['sand', 'sand', 'sand', 'sand', 'gravel', 'gravel', 'gravel', 'gravel', c + '_dye']);
  }

  // ---------- Dyes from flowers ----------
  shapeless('dandelion_yellow', 1, ['dandelion']);
  shapeless('poppy_red', 1, ['poppy']);
  shapeless('cyan_dye', 1, ['cornflower']);
  shapeless('light_gray_dye', 1, ['oxeye_daisy']);
  shapeless('white_dye', 1, ['lily_of_valley']);
  shapeless('red_dye', 1, ['rose_bush']);
  shapeless('pink_dye', 1, ['peony']);
  shapeless('magenta_dye', 1, ['allium']);
  shapeless('purple_dye', 1, ['lilac']);
  shapeless('light_blue_dye', 1, ['blue_orchid']);
  shapeless('torchflower_seeds_item', 1, []); R.pop();

  // ---------- Smelting / blasting / smoking ----------
  smelt('glass', 1, 'sand'); smelt('glass', 1, 'red_sand');
  smelt('iron_ingot', 1, 'iron_ore'); smelt('iron_ingot', 1, 'raw_iron'); smelt('iron_ingot', 1, 'deepslate_iron_ore');
  smelt('gold_ingot', 1, 'gold_ore'); smelt('gold_ingot', 1, 'raw_gold'); smelt('gold_ingot', 1, 'nether_gold_ore'); smelt('gold_ingot', 1, 'deepslate_gold_ore');
  smelt('copper_ingot', 1, 'copper_ore'); smelt('copper_ingot', 1, 'raw_copper'); smelt('copper_ingot', 1, 'deepslate_copper_ore');
  smelt('stone', 1, 'cobblestone'); smelt('smooth_stone', 1, 'stone'); smelt('sand', 1, 'glass'); // glass->sand wrong; pop
  R.pop();
  smelt('coal', 1, 'log'); smelt('charcoal', 1, 'log');
  smelt('cooked_beef', 1, 'beef'); smelt('cooked_porkchop', 1, 'porkchop'); smelt('cooked_chicken', 1, 'chicken');
  smelt('cooked_mutton', 1, 'mutton'); smelt('cooked_rabbit', 1, 'rabbit'); smelt('baked_potato', 1, 'potato');
  smelt('cooked_cod', 1, 'cod'); smelt('cooked_salmon', 1, 'salmon'); smelt('dried_kelp', 1, 'kelp');
  smelt('brick', 1, 'clay_ball'); smelt('terracotta', 1, 'clay');
  smelt('nether_brick_item', 1, 'netherrack'); if (!WC.items.nether_brick_item) WC.items.nether_brick_item = { name: 'nether_brick_item', display: 'Nether Brick', stack: 64, type: 'item', color: [60, 25, 25], icon: 'brick' };
  smelt('smooth_basalt', 1, 'basalt'); smelt('stone', 1, 'deepslate');
  smelt('gilded_blackstone_smelt', 1, 'blackstone'); R.pop();
  smelt('air_drop', 1, 'nothing'); R.pop();
  // blasting (fast) ores
  smelt('iron_ingot', 1, 'iron_ore', 5, 'blasting'); smelt('gold_ingot', 1, 'gold_ore', 5, 'blasting'); smelt('copper_ingot', 1, 'copper_ore', 5, 'blasting');
  // smoking food faster
  smelt('cooked_beef', 1, 'beef', 5, 'smoking'); smelt('cooked_porkchop', 1, 'porkchop', 5, 'smoking'); smelt('cooked_chicken', 1, 'chicken', 5, 'smoking'); smelt('baked_potato', 1, 'potato', 5, 'smoking');
  // campfire cooking
  smelt('cooked_beef', 1, 'beef', 30, 'campfire'); smelt('cooked_chicken', 1, 'chicken', 30, 'campfire'); smelt('cooked_cod', 1, 'cod', 30, 'campfire');

  // ---------- Smithing (netherite upgrades + trims) ----------
  function smith(base, add, out) { R.push({ kind: 'smithing', base, add, out, count: 1 }); }
  for (const part of ['helmet', 'chestplate', 'leggings', 'boots']) {
    smith('diamond_' + part, 'netherite_ingot', 'netherite_' + part);
    smith('netherite_' + part, 'netherite_upgrade_smithing_template', 'netherite_' + part);
  }
  for (const tool of ['sword', 'pickaxe', 'axe', 'shovel', 'hoe', 'spear', 'mace']) {
    if (WC.items['diamond_' + tool]) smith('diamond_' + tool, 'netherite_ingot', 'netherite_' + tool);
  }
  if (!WC.items.netherite_upgrade_smithing_template) WC.items.netherite_upgrade_smithing_template = { name: 'netherite_upgrade_smithing_template', display: 'Netherite Upgrade Smithing Template', stack: 64, type: 'item', color: [200, 200, 200], icon: 'template', rare: true };
  // Ancient debris -> netherite scrap (smelt), scrap+gold -> ingot
  smelt('netherite_scrap', 1, 'ancient_debris', 10, 'blasting');
  shaped('netherite_ingot', 1, ['SSS', 'SGS', 'SSS'], { S: 'netherite_scrap', G: 'gold_ingot' });
  // remove dup netherite_ingot block recipe conflict: ours is fine (only one matches first)

  // ---------- Stonecutting shortcuts ----------
  function cut(out, inp) { R.push({ kind: 'stonecutting', out, count: 1, ingredient: inp }); }
  for (const s of ['stone', 'cobblestone', 'deepslate', 'cobbled_deepslate', 'blackstone', 'quartz_block', 'sandstone_like']) {
    if (!WC.blockByName[s]) continue;
    if (WC.blockByName[s + '_slab']) cut(s + '_slab', s);
    if (WC.blockByName[s + '_stairs']) cut(s + '_stairs', s);
  }
  cut('stone_bricks', 'stone'); cut('smooth_stone', 'stone');
  cut('cut_copper_block', 'copper_block'); cut('chiseled_copper_block', 'copper_block');
  cut('copper_stairs', 'copper_block'); cut('copper_slab', 'copper_block');
  cut('cut_copper_stairs', 'cut_copper_block'); cut('cut_copper_slab', 'cut_copper_block');

  // ---------- Brewing (cauldron/brew stand style) ----------
  function brew(inp, ing, out) { R.push({ kind: 'brewing', input: inp, ingredient: ing, out }); }
  brew('water_bottle', 'nether_wart', 'awkward_potion');
  brew('awkward_potion', 'glistering_melon_slice', 'healing_potion');
  brew('healing_potion', 'glowstone_dust', 'healing_potion_ii');
  if (!WC.items.healing_potion_ii) WC.items.healing_potion_ii = { name: 'healing_potion_ii', display: 'Potion of Healing II', stack: 1, type: 'potion', potionEffects: [['instant_health', 2]], color: [180, 40, 40], icon: 'potion' };
  brew('awkward_potion', 'ghast_tear', 'regeneration_potion');
  brew('awkward_potion', 'blaze_powder', 'strength_potion');
  brew('awkward_potion', 'sugar', 'swiftness_potion');
  brew('awkward_potion', 'rabbit_foot', 'leaping_potion');
  brew('awkward_potion', 'magma_cream', 'fire_resistance_potion');
  brew('awkward_potion', 'fermented_spider_eye', 'invisibility_potion');
  brew('awkward_potion', 'golden_carrot', 'night_vision_potion');
  brew('awkward_potion', 'pufferfish', 'water_breathing_potion');
  brew('awkward_potion', 'turtle_helmet', 'turtle_master_potion');
  brew('awkward_potion', 'phantom_membrane', 'slow_falling_potion');
  brew('awkward_potion', 'spider_eye', 'poison_potion');
  brew('awkward_potion', 'melon', 'harming_potion'); R.pop();
  brew('awkward_potion', 'fermented_spider_eye', 'slowness_potion');
  brew('awkward_potion', 'dragon_breath', 'lingering_placeholder'); R.pop();

  // ---------- Special "recipes" needing context ----------
  R.push({ kind: 'special', id: 'map_extend' });
  R.push({ kind: 'special', id: 'banner_duplicate' });
  R.push({ kind: 'special', id: 'repair_combine' });   // anvil combine same items
  R.push({ kind: 'special', id: 'book_apply' });       // enchanted book onto item at enchanting/anvil
  R.push({ kind: 'special', id: 'firework_launch' });
  R.push({ kind: 'special', id: 'dye_leather' });      // dye + leather armor in water cauldron or crafting
  R.push({ kind: 'special', id: 'head_skull' });

  // ---------- Recipe matching engine ----------
  // Normalize a 3x3 grid of item names (or null) into canonical strings.
  function normGrid(grid) {
    // trim empty rows/cols
    let minR = 3, maxR = -1, minC = 3, maxC = -1;
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
      if (grid[r * 3 + c]) { if (r < minR) minR = r; if (r > maxR) maxR = r; if (c < minC) minC = c; if (c > maxC) maxC = c; }
    }
    if (maxR < 0) return null;
    const h = maxR - minR + 1, w = maxC - minC + 1;
    const out = [];
    for (let r = 0; r < h; r++) { const row = []; for (let c = 0; c < w; c++) row.push(grid[(minR + r) * 3 + (minC + c)] || null); out.push(row.join(',')); }
    return { rows: out, h, w };
  }
  function parsePattern(recipe) {
    // returns array of rows with keys resolved to arrays of acceptable items
    const rows = recipe.pattern.map(r => r.split('').map(ch => {
      if (ch === ' ') return null;
      const k = recipe.key[ch];
      return k ? (Array.isArray(k) ? k : [k]) : [ch];
    }));
    return rows;
  }
  function matchShaped(recipe, gridNorm) {
    if (!gridNorm) return false;
    const pr = parsePattern(recipe);
    if (pr.length !== gridNorm.h || pr[0].length !== gridNorm.w) return false;
    for (let r = 0; r < pr.length; r++) for (let c = 0; c < pr[r].length; c++) {
      const need = pr[r][c], have = gridNorm.rows[r].split(',')[c];
      if (need === null) { if (have) return false; }
      else { if (!have || !need.includes(have)) return false; }
    }
    return true;
  }
  function matchShapeless(recipe, items) {
    const need = [...recipe.ingredients];
    outer: for (const it of items) {
      for (let i = 0; i < need.length; i++) if (need[i] === it) { need.splice(i, 1); continue outer; }
      return false;
    }
    return need.length === 0;
  }
  // wildcard expansions
  function expand(name) {
    switch (name) {
      case 'planks': return Object.keys(WC.blocks).filter(n => n.endsWith('_planks'));
      case 'log': return Object.keys(WC.blocks).filter(n => n.endsWith('_log') || n.endsWith('_wood'));
      case 'slab_any': return Object.keys(WC.blocks).filter(n => n.endsWith('_slab'));
      case 'dye_any': return Object.keys(WC.items).filter(n => n.endsWith('_dye'));
      case 'flower': return ['poppy', 'dandelion', 'cornflower', 'oxeye_daisy', 'allium', 'azure_bluet', 'red_tulip', 'orange_tulip', 'white_tulip', 'pink_tulip', 'lily_of_valley', 'wither_rose', 'torchflower', 'blue_orchid'];
      default: return [name];
    }
  }
  function matchAny(recipeList, grid, flatItems, station) {
    const results = [];
    const gridNorm = grid ? normGrid(grid) : null;
    const itemsFlat = flatItems.filter(Boolean).flatMap(expand);
    for (const rec of recipeList) {
      if (rec.kind === 'shaped' && gridNorm) {
        // allow wildcards in key values
        const expanded = { ...rec, key: {} };
        for (const [k, v] of Object.entries(rec.key || {})) expanded.key[k] = Array.isArray(v) ? v.flatMap(expand) : expand(v);
        if (matchShaped(expanded, gridNorm)) results.push(rec);
      } else if (rec.kind === 'shapeless' && itemsFlat.length) {
        const expIng = rec.ingredients.flatMap(expand);
        if (expIng.length === itemsFlat.length && matchShapeless({ ingredients: expIng }, itemsFlat)) results.push(rec);
      } else if ((rec.kind === 'smelting' || rec.kind === 'blasting' || rec.kind === 'smoking' || rec.kind === 'campfire' || rec.kind === 'stonecutting') && itemsFlat.length === 1) {
        if (expand(rec.ingredient).includes(itemsFlat[0])) {
          const stMap = { smelting: ['furnace', 'blast_furnace', 'smoker', 'campfire'], blasting: ['blast_furnace'], smoking: ['smoker'], campfire: ['campfire'], stonecutting: ['stonecutter'] };
          if (!station || stMap[rec.kind].includes(station)) results.push(rec);
        }
      } else if (rec.kind === 'smithing' && itemsFlat.length >= 2) {
        if (itemsFlat[0] === rec.base && itemsFlat[1] === rec.add) results.push(rec);
      }
    }
    return results;
  }
  WC.craftMatch = matchAny;
  WC.craftNormGrid = normGrid;
  WC.canCraft = function (rec, invCounts) {
    // check inventory has needed ingredients (counts map item->count).
    // For wildcard options (e.g. 'planks' -> any *_planks), sum available counts.
    const need = [];
    if (rec.kind === 'shaped') {
      for (const row of rec.pattern) for (const ch of row) { if (ch !== ' ') need.push(expand(rec.key[ch] || ch)); }
    } else if (rec.kind === 'shapeless') {
      for (const ing of rec.ingredients) need.push(expand(ing));
    } else if (rec.ingredient) {
      need.push(expand(rec.ingredient));
    } else if (rec.kind === 'smithing') {
      need.push([rec.base]); need.push([rec.add]);
    }
    const avail = {};
    for (const opts of need) {
      const key = opts.join('|');
      let have = avail[key] !== undefined ? avail[key] : opts.reduce((a, o) => a + (invCounts[o] || 0), 0);
      if (have <= 0) return false;
      avail[key] = have - 1;
    }
    return true;
  };
})();
