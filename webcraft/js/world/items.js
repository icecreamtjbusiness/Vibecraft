// ============================================================
// Item registry: tools, weapons (incl. spear & mace), armor
// (incl. copper), food, materials, spawn eggs, potions, etc.
// ============================================================
(function () {
  'use strict';
  const WC = window.WC;
  const I = WC.items;

  function def(name, opts) {
    const d = Object.assign({
      name,
      display: name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      stack: 64,
      type: 'item',        // item | tool | weapon | armor | food | block | potion | spawn_egg
      block: null,          // if placeable -> block name
      durability: 0,
      tier: 0,              // material tier for tools
      attack: 0,            // base damage (hearts*2 style: half-hearts)
      speed: 1.0,           // attack speed
      armor: 0,             // defense points
      armorToughness: 0,
      slot: null,           // head|chest|legs|feet
      food: 0,              // hunger restored
      saturation: 0,
      effects: [],          // potion/food effects
      tex: null,            // texture tile name (block items use block tex)
      icon: null,           // procedural icon id for 2D drawing
      color: [200, 200, 200],
      rare: false,
      description: '',
    }, opts);
    I[name] = d;
    return d;
  }
  WC.itemDef = (name) => I[name];

  // ---------- Block items (auto from blocks) ----------
  WC.registerBlockItems = function () {
    for (const [name, bdef] of Object.entries(WC.blocks)) {
      if (['air', 'cave_air', 'structure_void'].includes(name)) continue;
      if (I[name]) continue;
      def(name, { type: 'block', block: name, tex: WC.faceTex(bdef, 2) || bdef.tex.all, color: bdef.color, display: bdef.display });
    }
  };

  // ---------- Materials / crafting ingredients ----------
  const mats = {
    coal: [60, 60, 60], charcoal: [70, 55, 45], diamond: [110, 230, 230], emerald: [40, 200, 90],
    lapis_lazuli: [40, 80, 180], redstone: [200, 40, 40], quartz: [235, 230, 220], amethyst_shard: [170, 120, 220],
    glowstone_dust: [240, 200, 90], gunpowder: [120, 120, 120], flint: [80, 80, 90], string: [220, 220, 220],
    feather: [230, 230, 230], leather: [160, 120, 80], rabbit_hide: [180, 150, 120], rabbit_foot: [170, 140, 110],
    bone: [225, 225, 210], bone_meal: [235, 235, 225], ink_sac: [25, 25, 35], glow_ink_sac: [60, 160, 160],
    egg: [230, 220, 180], stick: [160, 120, 70], bowl: [180, 140, 90], bucket: [190, 190, 195], water_bucket: [190, 190, 195], lava_bucket: [190, 190, 195], milk_bucket: [240, 240, 240], powder_snow_bucket: [240, 248, 255],
    clay_ball: [160, 160, 175], brick: [165, 95, 75], nether_brick: [60, 25, 25], paper: [235, 235, 225], book: [200, 180, 140], writable_book: [210, 190, 150], written_book: [180, 120, 90],
    sugar: [240, 240, 240], glass_bottle: [210, 235, 255], glass: [210, 235, 255], experience_bottle: [120, 220, 120],
    ender_pearl: [30, 120, 100], blaze_rod: [240, 200, 80], blaze_powder: [250, 180, 60], ghast_tear: [220, 230, 240],
    magma_cream: [220, 150, 60], slime_ball: [110, 200, 110], phantom_membrane: [180, 160, 200],
    gold_nugget: [240, 210, 60], iron_nugget: [200, 200, 200], netherite_scrap: [70, 60, 65], netherite_ingot: [60, 52, 56],
    ancient_debris: [70, 58, 62], shulker_shell: [180, 120, 190], chorus_fruit: [150, 90, 130], popped_chorus_fruit: [200, 160, 150],
    dragon_breath: [180, 100, 220], ender_eye: [60, 160, 120], eye_of_ender: [60, 160, 120], totem_of_undying: [230, 200, 90],
    music_disc: [40, 40, 40], name_tag: [200, 190, 150], lead: [200, 190, 120], saddle: [130, 80, 50],
    bundle: [150, 90, 60], spyglass: [180, 180, 190], brush: [180, 140, 90], recovery_compass: [120, 200, 220], compass: [180, 200, 210], clock: [230, 210, 120],
    filled_map: [200, 190, 150], empty_map: [220, 215, 190], cake: [240, 220, 200], cookie: [180, 130, 70],
    mushroom_stew: [180, 140, 100], rabbit_stew: [200, 150, 100], suspicious_stew: [180, 120, 160], beetroot_soup: [160, 60, 80],
    honey_bottle: [240, 180, 40], honeycomb: [240, 190, 60], bread: [200, 150, 80],
    wheat: [200, 180, 80], wheat_seeds: [150, 160, 70], carrot: [230, 130, 40], potato: [190, 150, 90], baked_potato: [200, 140, 70], poisonous_potato: [150, 160, 80],
    beetroot: [170, 50, 70], beetroot_seeds: [150, 120, 70], sweet_berries: [200, 50, 60], glow_berries: [220, 200, 60],
    apple: [220, 60, 50], golden_apple: [240, 210, 60], enchanted_golden_apple: [120, 220, 220], melon_slice: [240, 120, 110], melon_seeds: [150, 160, 70], pumpkin_seeds: [190, 150, 70],
    cocoa_beans: [90, 50, 20], nether_wart: [150, 25, 35], torchflower_seeds: [230, 140, 60], pitcher_pod: [120, 160, 200],
    bamboo: [120, 160, 60], sugar_cane_item: [90, 150, 80], kelp: [60, 130, 70], dried_kelp: [90, 110, 60], cactus_green: [80, 140, 60],
    flower: [220, 80, 80], dandelion_yellow: [240, 210, 40], poppy_red: [220, 40, 40], cyan_dye: [40, 160, 160],
    bone_block_item: [225, 225, 210],
    iron_ingot: [220, 220, 220], gold_ingot: [240, 210, 60], copper_ingot: [190, 110, 80],
    raw_iron: [170, 140, 120], raw_gold: [220, 180, 60], raw_copper: [150, 100, 70],
    trident: [80, 180, 190], shield: [150, 110, 60], elytra: [120, 120, 130],
    arrow: [200, 200, 200], bow: [160, 120, 70], crossbow: [120, 90, 50], spectral_arrow: [240, 200, 90], tipped_arrow: [180, 120, 220],
    firework_rocket: [220, 80, 120], firework_star: [240, 200, 80],
    tnt_minecart: [120, 120, 120], minecart: [160, 160, 165], chest_minecart: [150, 110, 60], hopper_minecart: [140, 140, 145], furnace_minecart: [120, 110, 100],
    boat: [150, 110, 60], oak_boat: [150, 110, 60], chest_boat: [140, 100, 55],
    painting: [180, 140, 80], item_frame_item: [150, 110, 60], glowing_item_frame: [120, 200, 120],
    armor_stand: [180, 160, 130], flower_pot: [170, 90, 60],
    head_steve: [150, 120, 100], head_zombie: [90, 120, 90], head_skeleton: [200, 200, 190], head_creeper: [80, 160, 70], head_dragon: [60, 40, 70],
    goat_horn: [200, 180, 140], frog_legs: [170, 190, 120], cod: [120, 170, 200], salmon: [200, 120, 100], tropical_fish: [240, 160, 60], pufferfish: [220, 190, 90],
    cooked_cod: [200, 160, 90], cooked_salmon: [190, 110, 80],
    beef: [220, 100, 100], cooked_beef: [180, 110, 60], porkchop: [240, 160, 150], cooked_porkchop: [200, 130, 70],
    chicken: [240, 190, 170], cooked_chicken: [200, 140, 80], mutton: [200, 130, 120], cooked_mutton: [170, 110, 70],
    rabbit: [200, 160, 130], cooked_rabbit: [180, 130, 90], rotten_flesh: [120, 90, 60], spider_eye: [120, 60, 120], fermented_spider_eye: [100, 80, 110],
    wind_charge: [180, 220, 230], breeze_rod: [200, 230, 240], heavy_core: [120, 100, 140], resonance_spring: [200, 180, 100],
    trial_key: [200, 180, 90], ominous_bottle: [120, 60, 140], ominous_trial_key: [120, 60, 140], vault: [200, 180, 90],
    snout_armor_trim: [200, 180, 140], rib_armor_trim: [200, 180, 140], way_of_smithing_template: [200, 200, 200],
  };
  for (const [n, col] of Object.entries(mats)) {
    def(n, { type: 'item', color: col, icon: n });
  }
  // Dyes map to colors
  const DYECOLS = { white_dye: [235,235,235], orange_dye: [240,125,30], magenta_dye: [189,68,179], light_blue_dye: [58,175,217], yellow_dye: [247,230,7], lime_dye: [114,190,26], pink_dye: [237,141,172], gray_dye: [63,68,72], light_gray_dye: [142,142,134], cyan_dye: [21,137,145], purple_dye: [125,48,197], blue_dye: [45,60,184], brown_dye: [118,70,33], green_dye: [58,142,34], red_dye: [175,45,34], black_dye: [20,20,26] };
  for (const [n, col] of Object.entries(DYECOLS)) def(n, { type: 'item', color: col, icon: 'dye' });

  // ---------- Tools & weapons ----------
  const TIERS = { wooden: 0, stone: 1, copper: 1.5, iron: 2, golden: 3, diamond: 3, netherite: 4 };
  const TIERCOL = { wooden: [160, 120, 70], stone: [130, 130, 130], copper: [190, 110, 80], iron: [220, 220, 220], golden: [240, 210, 60], diamond: [110, 230, 230], netherite: [70, 60, 65] };
  const DUR = { wooden: 60, stone: 132, copper: 190, iron: 251, golden: 33, diamond: 1562, netherite: 2031 };
  const BASEDMG = { sword: 4, pickaxe: 2, axe: 3, shovel: 1, hoe: 1, spear: 5, mace: 6 };
  const SPEED = { sword: 1.6, pickaxe: 1.2, axe: 1.0, shovel: 1.0, hoe: 1.0, spear: 1.1, mace: 0.6 };
  const MINETIER = { wooden: 0, stone: 1, copper: 1, iron: 2, golden: 1, diamond: 3, netherite: 4 };

  for (const tier of Object.keys(TIERS)) {
    for (const kind of ['sword', 'pickaxe', 'axe', 'shovel', 'hoe']) {
      const name = `${tier}_${kind}`;
      def(name, {
        type: 'tool', stack: 1, durability: DUR[tier], tier: TIERS[tier],
        attack: BASEDMG[kind] + TIERS[tier], speed: SPEED[kind],
        toolKind: kind, minTier: MINETIER[tier], color: TIERCOL[tier], icon: kind,
        display: name.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase()),
      });
    }
    // Copper & special weapons per modern request: spear & mace in all metal tiers
    for (const kind of ['spear', 'mace']) {
      if (kind === 'mace' && !['iron', 'netherite', 'diamond'].includes(tier)) continue; // mace is endgame-ish but allow iron/diamond/netherite
      const name = `${tier}_${kind}`;
      def(name, {
        type: 'weapon', stack: 1, durability: DUR[tier], tier: TIERS[tier],
        attack: BASEDMG[kind] + TIERS[tier], speed: SPEED[kind],
        toolKind: kind, minTier: MINETIER[tier], color: TIERCOL[tier], icon: kind,
        display: name.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase()),
      });
    }
  }
  // Shears, flint&steel, fishing rod, carrot on stick, warped/fungus on stick
  def('shears', { type: 'tool', stack: 1, durability: 238, toolKind: 'shears', color: [210, 210, 210], icon: 'shears', attack: 2 });
  def('flint_and_steel', { type: 'tool', stack: 1, durability: 64, color: [150, 150, 160], icon: 'flintsteel' });
  def('fishing_rod', { type: 'tool', stack: 1, durability: 64, color: [140, 100, 60], icon: 'rod' });
  def('carrot_on_a_stick', { type: 'tool', stack: 1, durability: 25, color: [200, 120, 60], icon: 'rod' });
  def('warped_fungus_on_a_stick', { type: 'tool', stack: 1, durability: 100, color: [60, 140, 140], icon: 'rod' });
  def('brush_item', { type: 'tool', stack: 1, durability: 64, color: [180, 140, 90], icon: 'brush', name: 'brush' });
  // rename collision: 'brush' already defined as item; keep both keys distinct
  def('stick', {});
  def('blaze_rod', {});

  // ---------- Armor sets (helmet/chestplate/leggings/boots) ----------
  const ARMOR_TIERS = {
    leather:   { dur: 64,  pts: [1,2,3,1], tough: 0, col: [160,120,80] },
    copper:    { dur: 140, pts: [2,5,4,2], tough: 0.5, col: [190,110,80] },
    chainmail: { dur: 165, pts: [2,5,4,2], tough: 0, col: [150,150,140] },
    iron:      { dur: 195, pts: [2,6,5,2], tough: 0, col: [220,220,220] },
    golden:    { dur: 66,  pts: [2,5,3,1], tough: 0, col: [240,210,60] },
    diamond:   { dur: 364, pts: [3,8,6,3], tough: 2, col: [110,230,230] },
    netherite: { dur: 481, pts: [3,8,6,3], tough: 3, col: [70,60,65] },
    turtle:    { dur: 275, pts: [2,0,0,0], tough: 2, col: [90,150,90] },
  };
  const SLOTS = [['helmet', 'head'], ['chestplate', 'chest'], ['leggings', 'legs'], ['boots', 'feet']];
  for (const [mat, cfg] of Object.entries(ARMOR_TIERS)) {
    SLOTS.forEach(([part, slot], idx) => {
      if (mat === 'turtle' && part !== 'helmet') return;
      const name = `${mat}_${part}`;
      def(name, {
        type: 'armor', stack: 1, slot, armor: cfg.pts[idx], armorToughness: cfg.tough,
        durability: cfg.dur * [1, 2, 1.5, 1][idx], color: cfg.col, icon: part, tier: mat === 'netherite' ? 4 : 0,
        display: name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      });
    });
  }

  // ---------- Food ----------
  const FOODS = {
    apple: [4, 2.4], golden_apple: [4, 9.6, [{ name: 'regeneration', dur: 100 }, { name: 'absorption', dur: 60 }]],
    enchanted_golden_apple: [4, 9.6, [{ name: 'regenerationII', dur: 600 }, { name: 'resistance', dur: 6000 }, { name: 'absorption', dur: 6000 }]],
    bread: [5, 6], cooked_beef: [8, 12.8], beef: [3, 1.8], cooked_porkchop: [8, 12.8], porkchop: [3, 1.8],
    mutton: [2, 1.2], cooked_mutton: [6, 9.6], chicken: [2, 1.2, [{ name: 'hunger', dur: 200, chance: 0.3 }]],
    cooked_chicken: [6, 7.2], rabbit: [3, 2.4], cooked_rabbit: [5, 6], rotten_flesh: [4, 0.8, [{ name: 'hunger', dur: 600, chance: 0.8 }]],
    dried_kelp: [2, 0.4], sweet_berries: [2, 0.4], glow_berries: [2, 0.4], melon_slice: [2, 1.2], pumpkin_pie: [8, 4.8],
    carrot: [3, 3.6], potato: [1, 0.6], baked_potato: [5, 6], poisonous_potato: [2, 1.2, [{ name: 'poison', dur: 100, chance: 0.6 }]],
    beetroot: [1, 1.2], cookie: [2, 0.4], cocoa_beans: [1, 0.2], honey_bottle: [6, 0.6, [{ name: 'poison_clear' }]],
    mushroom_stew: [6, 7.2], rabbit_stew: [10, 12], beetroot_soup: [6, 7.2], suspicious_stew: [6, 0.6, [{ name: 'random_effect' }]],
    cod: [2, 0.4], salmon: [2, 0.4], tropical_fish: [1, 0.2], pufferfish: [1, 0.2, [{ name: 'poison', dur: 300 }, { name: 'nausea', dur: 300 }, { name: 'hungerIV', dur: 300 }]],
    cooked_cod: [5, 6], cooked_salmon: [6, 9.6], cake: [2, 4.2], donkey_food: [0, 0],
    chorus_fruit: [4, 1.5], popped_chorus_fruit: [5, 6],
  };
  for (const [n, v] of Object.entries(FOODS)) {
    if (!I[n]) def(n, {});
    const d = I[n];
    d.type = 'food'; d.food = v[0]; d.saturation = v[1]; d.effects = v[2] || []; d.stack = 64;
  }
  def('pumpkin_pie', { type: 'food', food: 8, saturation: 4.8, color: [220, 150, 60], icon: 'pie' });

  // ---------- Potions ----------
  const POTIONS = {
    water_bottle: ['water', []], awkward_potion: ['awkward', []], mundane_potion: ['mundane', []], thick_potion: ['thick', []],
    night_vision_potion: ['n', [['night_vision', 3600]]],
    invisibility_potion: ['n', [['invisibility', 3600]]],
    leaping_potion: ['n', [['jump_boost', 3600]]],
    fire_resistance_potion: ['n', [['fire_resistance', 3600]]],
    swiftness_potion: ['n', [['speed', 3600]]],
    slowness_potion: ['s', [['slowness', 1800]]],
    water_breathing_potion: ['n', [['water_breathing', 3600]]],
    healing_potion: ['n', [['instant_health', 1]]],
    harming_potion: ['s', [['instant_damage', 1]]],
    poison_potion: ['n', [['poison', 450]]],
    regeneration_potion: ['n', [['regeneration', 450]]],
    strength_potion: ['n', [['strength', 3600]]],
    weakness_potion: ['s', [['weakness', 1800]]],
    slow_falling_potion: ['n', [['slow_falling', 3600]]],
    turtle_master_potion: ['n', [['slowness', 4800], ['resistance', 4800]]],
    harming_potion_ii: ['s', [['instant_damage', 2]]],
    leaping_potion_ii: ['n', [['jump_boost', 1800, 1]]],
    swiftness_potion_ii: ['n', [['speed', 1800, 1]]],
    poison_potion_ii: ['n', [['poison', 900, 1]]],
    regeneration_potion_ii: ['n', [['regeneration', 200, 1]]],
    strength_potion_ii: ['n', [['strength', 1800, 1]]],
    long_night_vision: ['x', [['night_vision', 9600]]],
    long_invisibility: ['x', [['invisibility', 9600]]],
    long_leaping: ['x', [['jump_boost', 9600]]],
    long_fire_resistance: ['x', [['fire_resistance', 9600]]],
    long_swiftness: ['x', [['speed', 9600]]],
    long_slowness: ['x', [['slowness', 3600]]],
    long_water_breathing: ['x', [['water_breathing', 9600]]],
    long_poison: ['x', [['poison', 1200]]],
    long_regeneration: ['x', [['regeneration', 1200]]],
    long_strength: ['x', [['strength', 9600]]],
    long_slow_falling: ['x', [['slow_falling', 9600]]],
    long_weakness: ['x', [['weakness', 3600]]],
  };
  for (const [n, [style, effs]] of Object.entries(POTIONS)) {
    def(n, { type: 'potion', stack: 1, color: style === 's' ? [150, 60, 160] : style === 'x' ? [120, 90, 160] : [180, 100, 220], icon: 'potion', potionEffects: effs, display: n.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) });
  }
  // Tipped arrows reuse simple defs
  for (const pn of ['poison', 'slowness', 'strength', 'healing', 'night_vision', 'leaping', 'fire_resistance', 'swiftness', 'regeneration', 'water_breathing', 'invisibility', 'slow_falling', 'harming', 'luck']) {
    def('tipped_arrow_' + pn, { type: 'item', stack: 64, color: [180, 120, 220], icon: 'arrow', arrowEffect: pn, display: 'Arrow of ' + pn.replace(/_/g, ' ') });
  }

  // ---------- Spawn eggs ----------
  const MOB_EGGS = {
    allay: [116, 202, 199], armadillo: [142, 108, 82], axolotl: [230, 180, 220], bat: [110, 90, 70], bee: [230, 200, 60],
    blaze: [220, 180, 60], camel: [190, 150, 90], cat: [200, 160, 100], cave_spider: [100, 80, 120], chicken: [230, 230, 230],
    cod: [120, 170, 200], cow: [70, 50, 40], creeper: [80, 160, 70], dolphin: [130, 170, 200], donkey: [150, 130, 110],
    drowned: [60, 120, 110], elder_guardian: [120, 140, 150], enderman: [30, 30, 40], endermite: [200, 180, 160],
    fox: [220, 130, 50], frog: [150, 190, 90], ghast: [220, 220, 230], glow_squid: [80, 200, 200], goat: [180, 160, 130],
    guardian: [120, 150, 140], horse: [150, 110, 70], husk: [170, 150, 110], illusioner: [120, 140, 180], iron_golem: [220, 220, 220],
    llama: [190, 150, 100], magma_cube: [150, 60, 30], moobloom: [230, 200, 90], mule: [150, 120, 100], mushroom_cow: [200, 90, 80],
    ocelot: [220, 180, 100], panda: [230, 230, 230], parrot: [80, 200, 120], phantom: [180, 160, 200], pig: [240, 170, 160],
    piglin: [170, 100, 80], piglin_brute: [140, 60, 50], pillager: [180, 180, 160], polar_bear: [230, 230, 235],
    pufferfish: [220, 190, 90], rabbit: [200, 170, 140], ravager: [160, 150, 130], sheep: [230, 220, 210], shulker: [150, 90, 160],
    silverfish: [150, 150, 160], skeleton: [130, 130, 130], skeleton_horse: [200, 200, 200], slime: [110, 200, 110],
    sniffer: [150, 120, 90], snow_golem: [240, 245, 250], spider: [110, 80, 60], squid: [60, 60, 110], stray: [150, 180, 190],
    strider: [200, 90, 70], tadpole: [90, 140, 160], trader_llama: [200, 170, 130], tropical_fish: [240, 160, 60],
    turtle: [90, 150, 90], vex: [200, 220, 230], villager: [180, 140, 100], vindicator: [180, 160, 140], wandering_trader: [140, 120, 180],
    warden: [20, 40, 50], witch: [120, 80, 160], wither: [60, 60, 60], wither_skeleton: [60, 55, 55], wolf: [160, 160, 160],
    zoglin: [180, 120, 100], zombie: [70, 110, 70], zombie_horse: [90, 110, 70], zombie_villager: [70, 100, 80], zombified_piglin: [150, 120, 90],
    breeze: [180, 220, 230], bogged: [140, 150, 130], creaking: [120, 100, 80], happy_ghast: [240, 200, 210],
  };
  for (const [mob, col] of Object.entries(MOB_EGGS)) {
    def(mob + '_spawn_egg', { type: 'spawn_egg', mob, color: col, icon: 'egg', stack: 64, display: 'Spawn ' + mob.replace(/_/g, ' '), rare: true });
  }

  // Enchanted books & music discs
  def('enchanted_book', { type: 'item', stack: 1, color: [180, 120, 220], icon: 'book_ench', enchant: 'any' });
  for (const d of ['cat', 'blocks', 'chirp', 'far', 'mall', 'mellohi', 'stal', 'strad', 'ward', '11', '13', 'pigstep', 'otherside', 'five', 'relic']) {
    def('music_disc_' + d, { type: 'item', stack: 1, color: [60, 60, 70], icon: 'disc', disc: d });
  }

  // Music/painting/misc
  def('painting', {}); def('gold_carved_pumpkin', { type: 'item', color: [240, 210, 60], icon: 'pumpkin' });

  // ---------- Enchantments catalog ----------
  WC.enchantments = {
    sharpness: { max: 5, app: ['sword', 'axe', 'mace', 'spear'] }, smite: { max: 5, app: ['sword', 'axe'] },
    bane_of_arthropods: { max: 5, app: ['sword', 'axe'] }, knockback: { max: 2, app: ['sword'] },
    fire_aspect: { max: 2, app: ['sword'] }, looting: { max: 3, app: ['sword'] }, sweeping: { max: 3, app: ['sword'] },
    efficiency: { max: 5, app: ['pickaxe', 'axe', 'shovel', 'hoe'] }, silk_touch: { max: 1, app: ['pickaxe', 'axe', 'shovel'] },
    unbreaking: { max: 3, app: ['*'] }, fortune: { max: 3, app: ['pickaxe'] }, power: { max: 5, app: ['bow'] },
    punch: { max: 2, app: ['bow'] }, flame: { max: 1, app: ['bow'] }, infinity: { max: 1, app: ['bow'] },
    protection: { max: 4, app: ['armor'] }, projectile_protection: { max: 4, app: ['armor'] },
    fire_protection: { max: 4, app: ['armor'] }, blast_protection: { max: 4, app: ['armor'] },
    feather_falling: { max: 4, app: ['boots'] }, thorns: { max: 3, app: ['armor'] }, respiration: { max: 3, app: ['helmet'] },
    aqua_affinity: { max: 1, app: ['helmet'] }, depth_strider: { max: 3, app: ['boots'] }, frost_walker: { max: 2, app: ['boots'] },
    soul_speed: { max: 3, app: ['boots'] }, swift_sneak: { max: 3, app: ['leggings'] },
    mending: { max: 1, app: ['*'] }, vanishing: { max: 1, app: ['*'] },
    density: { max: 5, app: ['mace'] }, breach: { max: 4, app: ['mace'] }, wind_burst: { max: 3, app: ['mace'] },
    impaling: { max: 5, app: ['trident', 'spear'] }, riptide: { max: 3, app: ['trident'] }, loyalty: { max: 3, app: ['trident'] }, channeling: { max: 1, app: ['trident'] },
    multishot: { max: 1, app: ['crossbow'] }, quick_charge: { max: 3, app: ['crossbow'] }, piercing: { max: 4, app: ['crossbow'] },
    lure: { max: 3, app: ['rod'] }, luck_of_the_sea: { max: 3, app: ['rod'] },
    luck: { max: 3, app: ['bow'] },
  };

  // Lookup helpers
  WC.findToolForBlock = function (blockDef, inv) {
    // returns best matching tool item name from inventory hotbar selection handled by caller
    return blockDef.tool;
  };
})();
