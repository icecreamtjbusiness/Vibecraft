// ============================================================
// Entity system: all mobs with AI (passive/neutral/hostile),
// item entities, projectiles, bosses (Ender Dragon & Wither).
// Box-model rendering done by renderer using entity.type.
// ============================================================
(function () {
  'use strict';
  const WC = window.WC;
  const S = WC.state;

  // ---------- Mob catalog ----------
  // w/h hitbox, hp, dmg, speed, behavior flags, drops
  const MOBS = WC.MOBS = {
    // passive overworld
    cow:        { hp: 10, w: 0.9, h: 1.4, spd: 1.6, drops: [['beef', 1, 2], ['leather', 0, 2]], sound: 'cow', food: true },
    sheep:      { hp: 8, w: 0.9, h: 1.3, spd: 1.7, drops: [['mutton', 1, 2], ['wool_white', 1, 1]], shearable: true, food: true },
    pig:        { hp: 10, w: 0.9, h: 0.9, spd: 1.6, drops: [['porkchop', 1, 3]], food: true, saddleable: true },
    chicken:    { hp: 4, w: 0.4, h: 0.7, spd: 1.5, drops: [['feather', 0, 2], ['chicken', 1, 1], ['egg', 0, 1]], lay: true },
    rabbit:     { hp: 3, w: 0.4, h: 0.5, spd: 2.6, drops: [['rabbit', 1, 1], ['rabbit_hide', 0, 1], ['cooked_rabbit', 0, 1]] },
    horse:      { hp: 15, w: 1.4, h: 1.6, spd: 3.4, tameable: true, saddleable: true, drops: [['leather', 0, 2]] },
    donkey:     { hp: 15, w: 1.4, h: 1.5, spd: 2.6, tameable: true, chest: true },
    mule:       { hp: 15, w: 1.4, h: 1.6, spd: 2.8, tameable: true },
    llama:      { hp: 20, w: 0.9, h: 1.8, spd: 2.2, tameable: true, chest: true, spits: true },
    trader_llama:{ hp: 20, w: 0.9, h: 1.8, spd: 2.2 },
    wolf:       { hp: 8, w: 0.6, h: 0.85, spd: 2.2, tameable: true, drops: [] , pack: true},
    ocelot:     { hp: 10, w: 0.6, h: 0.7, spd: 2.2, shy: true, drops: [] },
    cat:        { hp: 10, w: 0.6, h: 0.5, spd: 2.2, tameable: true, drops: [['cod', 0, 1], ['raw_fish', 0, 1]] },
    fox:        { hp: 10, w: 0.7, h: 0.7, spd: 2.5, pickpocket: true, drops: [] },
    panda:      { hp: 20, w: 1.3, h: 1.25, spd: 1.5, drops: [['bamboo', 1, 4]] },
    polar_bear: { hp: 30, w: 1.4, h: 1.4, spd: 2.2, hostile_when_near: true, drops: [['cod', 1, 2], ['salmon', 1, 2]] },
    bee:        { hp: 6, w: 0.4, h: 0.4, spd: 2.5, flying: true, pollinates: true, drops: [], sting: 2 },
    parrot:     { hp: 6, w: 0.5, h: 0.9, spd: 2.0, flying: true, tameable: true, drops: [['feather', 1, 2]] },
    dolphin:    { hp: 10, w: 0.9, h: 0.6, spd: 3.0, aquatic: true, drops: [['cod', 1, 2]] },
    turtle:     { hp: 10, w: 0.9, h: 0.4, spd: 1.0, aquatic: true, land: true, drops: [['scute', 0, 1], ['seagrass', 2, 4]] },
    squid:      { hp: 3, w: 0.8, h: 0.8, spd: 1.0, aquatic: true, drops: [['ink_sac', 1, 3]] },
    glow_squid: { hp: 10, w: 0.9, h: 1.4, spd: 1.0, aquatic: true, light: 12, drops: [['glow_ink_sac', 1, 4]] },
    cod:        { hp: 3, w: 0.6, h: 0.3, spd: 1.2, aquatic: true, drops: [['cod', 1, 1]] },
    salmon:     { hp: 5, w: 0.7, h: 0.4, spd: 1.3, aquatic: true, drops: [['salmon', 1, 1]] },
    tropical_fish:{ hp: 3, w: 0.4, h: 0.3, spd: 1.0, aquatic: true, drops: [['tropical_fish', 1, 1]] },
    pufferfish: { hp: 3, w: 0.7, h: 0.7, spd: 1.0, aquatic: true, puff: true, drops: [['pufferfish', 1, 1]] },
    frog:       { hp: 10, w: 0.5, h: 0.5, spd: 1.6, jumps: true, eats_frog: ['small_slime'], drops: [['frog_legs', 1, 2]] },
    tadpole:    { hp: 3, w: 0.3, h: 0.2, spd: 1.0, aquatic: true },
    goat:       { hp: 10, w: 0.7, h: 1.4, spd: 2.0, rams: true, drops: [['goat_horn', 0, 1]] },
    axolotl:    { hp: 14, w: 0.8, h: 0.4, spd: 1.6, aquatic: true, helps: true, drops: [] },
    allay:      { hp: 3, w: 0.4, h: 0.5, spd: 2.2, flying: true, helper: true, drops: [] },
    moobloom:   { hp: 10, w: 0.9, h: 1.4, spd: 1.6, drops: [['dandelion', 1, 1], ['beef', 1, 2], ['mushroom_stew', 1, 1]] },
    mushroom_cow:{ hp: 10, w: 0.9, h: 1.4, spd: 1.6, drops: [['mushroom_stew', 1, 1], ['beef', 1, 2], ['brown_mushroom', 0, 2]] },
    sniffer:    { hp: 14, w: 1.9, h: 1.6, spd: 1.2, digs: true, drops: [['sniffer_egg', 0, 1]] },
    armadillo:  { hp: 4, w: 0.7, h: 0.5, spd: 1.4, rolls: true, drops: [['armadillo_shell', 0, 1]] },
    camel:      { hp: 35, w: 1.8, h: 2.4, spd: 3.0, tameable: true, saddleable: true, double: true, drops: [] },
    deer_wolf:  { hp: 12, w: 0.9, h: 1.4, spd: 2.4, drops: [['venison', 1, 2]] }, // deer-like
    // neutral
    iron_golem: { hp: 100, w: 1.4, h: 2.7, spd: 1.8, protects: true, attacks: ['zombie', 'skeleton', 'creeper', 'spider', 'witch', 'pillager', 'vindicator', 'ravager'], drops: [['poppy', 0, 2], ['iron_ingot', 3, 5]], smash: true },
    snow_golem:{ hp: 4, w: 0.9, h: 1.8, spd: 1.6, snowman: true, drops: [['snowball', 1, 15]] },
    enderman:   { hp: 40, w: 0.6, h: 2.9, spd: 2.4, teleports: true, provokes_on_look: true, carries: true, drops: [['ender_pearl', 0, 1]], hostile_when_proved: true },
    piglin:     { hp: 16, w: 0.6, h: 1.9, spd: 2.2, barter: true, attacks: ['zombie_piglin_hostile', 'wither_skeleton', 'zoglin', 'skeleton', 'stray'], drops: [['gold_ingot', 0, 1], ['crossbow', 0, 1]], melee: 5, ranged: true, nether_only: true },
    piglin_brute:{ hp: 20, w: 0.6, h: 2.0, spd: 2.2, melee: 10, nether_only: true, drops: [['gold_ingot', 0, 1]] },
    hoglin:     { hp: 40, w: 0.9, h: 0.9, spd: 2.2, attacks: ['piglin', 'player'], nether_only: true, drops: [['porkchop', 2, 4], ['leather', 0, 1]], melee: 7 },
    strider:    { hp: 20, w: 0.9, h: 1.7, spd: 1.6, lava_walk: true, saddleable: true, nether_only: true, drops: [['string', 2, 5]] },
    zoglin:     { hp: 20, w: 0.9, h: 0.9, spd: 2.2, hostile: true, nether_only: true, melee: 5, drops: [['rotten_flesh', 0, 2], ['leather', 0, 1]] },
    breeze:     { hp: 30, w: 0.8, h: 1.8, spd: 2.0, jumps_wind: true, drops: [['breeze_rod', 1, 2], ['wind_charge', 1, 3]] },
    creaking:   { hp: 1, w: 0.5, h: 2.0, spd: 1.5, freezes_when_watch: true, drops: [['creaking_heart', 1, 1]] },
    // hostile monsters
    zombie:     { hp: 20, w: 0.6, h: 1.95, spd: 1.9, melee: 3, burns_sun: true, breaks_door: true, drops: [['rotten_flesh', 0, 2], ['iron_ingot', 0, 1]], can_pickup: true },
    husk:       { hp: 20, w: 0.6, h: 1.95, spd: 1.9, melee: 3, desert: true, drops: [['rotten_flesh', 0, 2]], hunger_touch: true },
    drowned:    { hp: 20, w: 0.6, h: 1.95, spd: 1.9, aquatic: true, melee: 3, ranged: 'trident', drops: [['rotten_flesh', 0, 2], ['copper_ingot', 0, 2], ['nautilus_shell', 0, 1]] },
    zombie_villager:{ hp: 20, w: 0.6, h: 1.95, spd: 1.9, melee: 3, cures: true, drops: [['rotten_flesh', 0, 2]] },
    skeleton:   { hp: 20, w: 0.6, h: 1.99, spd: 2.0, bows: true, burns_sun: true, drops: [['arrow', 0, 2], ['bone', 0, 2], ['bow', 0, 1]] },
    stray:      { hp: 20, w: 0.6, h: 1.99, spd: 2.0, bows: 'slowness', cold: true, drops: [['arrow', 0, 2], ['bone', 0, 2]] },
    bogged:     { hp: 16, w: 0.6, h: 1.9, spd: 1.9, bows: 'poison', drops: [['arrow', 0, 2], ['bone', 0, 2], ['mushroom', 0, 1]] },
    wither_skeleton:{ hp: 20, w: 0.6, h: 2.4, spd: 1.8, melee: 4, witherTouch: true, nether_only: true, drops: [['coal', 0, 1], ['bone', 0, 1], ['skull_wither', 0, 1]] },
    creeper:    { hp: 20, w: 0.6, h: 1.7, spd: 1.8, explodes: true, charged: false, drops: [['gunpowder', 0, 2], ['music_disc', 0, 1]] },
    spider:     { hp: 16, w: 1.4, h: 0.9, spd: 2.4, melee: 2, climbs: true, night_hostile: true, drops: [['string', 0, 2], ['spider_eye', 0, 1]] },
    cave_spider:{ hp: 12, w: 1.4, h: 0.9, spd: 2.4, melee: 2, poisonTouch: true, dark_only: true, drops: [['string', 0, 2], ['spider_eye', 0, 1]] },
    silverfish: { hp: 8, w: 0.4, h: 0.3, spd: 2.0, melee: 1, hides_in_blocks: true, calls_friends: true, drops: [] },
    endermite:  { hp: 8, w: 0.6, h: 0.5, spd: 2.2, melee: 2, end_only: true, drops: [] },
    slime:      { hp: 3, w: 0.5, h: 0.5, spd: 1.8, melee: 1, splits: true, swarmlvl: 2, drops: [['slime_ball', 0, 2]] },
    magma_cube: { hp: 3, w: 0.5, h: 0.5, spd: 1.8, melee: 1, splits: true, fireImmune: true, nether_only: true, drops: [['magma_cream', 0, 1]] },
    ghast:      { hp: 10, w: 4, h: 4, spd: 1.6, flying: true, fireballs: true, nether_only: true, drops: [['ghast_tear', 0, 1], ['gunpowder', 0, 2]] },
    blaze:      { hp: 20, w: 0.6, h: 1.8, spd: 1.6, flying_hover: true, fireballs: true, nether_only: true, drops: [['blaze_rod', 0, 1]] },
    phantom:    { hp: 20, w: 0.9, h: 0.5, spd: 2.8, flying: true, swoops: true, night_sky: true, drops: [['phantom_membrane', 0, 1]] },
    vex:        { hp: 14, w: 0.4, h: 0.6, spd: 2.6, flying: true, melee: 2, phases: true, drops: [] },
    ravager:    { hp: 100, w: 2, h: 2.2, spd: 2.0, melee: 12, roars: true, destroys_blocks: true, drops: [['saddle', 1, 1]] },
    pillager:   { hp: 24, w: 0.6, h: 1.95, spd: 1.9, crossbows: true, raid_leader: false, drops: [['crossbow', 0, 1], ['arrow', 0, 4], ['ominous_bottle', 0, 1]] },
    vindicator: { hp: 24, w: 0.6, h: 1.95, spd: 2.0, axe_melee: 8, drops: [['iron_axe', 0, 1]] },
    evoker:     { hp: 24, w: 0.6, h: 1.95, spd: 1.8, summons_vex: true, fangs: true, drops: [['totem_of_undying', 1, 1]] },
    illusioner: { hp: 32, w: 0.6, h: 1.95, spd: 2.0, bows: true, clones: true, drops: [['bow', 0, 1], ['golden_apple', 0, 1]] },
    witch:      { hp: 26, w: 0.6, h: 1.95, spd: 1.8, throws_potions: true, heals_self: true, drops: [['glowstone_dust', 0, 1], ['gunpowder', 0, 1], ['redstone', 0, 1], ['stick', 0, 1], ['sugar', 0, 1], ['spider_eye', 0, 1], ['glass_bottle', 0, 1]] },
    guardian:   { hp: 40, w: 1.3, h: 1.3, spd: 1.2, aquatic: true, laser: true, spikes: true, drops: [['prismarine_shard', 0, 2], ['prismarine_crystals', 0, 1], ['cod', 0, 2]] },
    elder_guardian:{ hp: 100, w: 1.9, h: 1.9, spd: 1.0, aquatic: true, laser: true, miningFatigue: true, drops: [['prismarine_shard', 3, 6], ['prismarine_crystals', 0, 2], ['cod', 0, 2], ['wet_sponge', 1, 1], ['heart_of_the_sea', 1, 1]] },
    shulker:    { hp: 30, w: 1, h: 1, spd: 0, shoots_bullet: true, end_only: true, hides: true, drops: [['shulker_shell', 0, 1]] },
    husk_spawn: {},
    // villagers & traders
    villager:   { hp: 20, w: 0.6, h: 1.95, spd: 1.4, trades: true, villager: true, work: true },
    wandering_trader:{ hp: 20, w: 0.6, h: 1.95, spd: 1.4, trades: true, trader: true },
    farmer:     { hp: 20, w: 0.6, h: 1.95, spd: 1.4, villager: true, job: 'farmer' },
    librarian:  { hp: 20, w: 0.6, h: 1.95, spd: 1.4, villager: true, job: 'librarian' },
    toolsmith:  { hp: 20, w: 0.6, h: 1.95, spd: 1.4, villager: true, job: 'toolsmith' },
    weaponsmith:{ hp: 20, w: 0.6, h: 1.95, spd: 1.4, villager: true, job: 'weaponsmith' },
    armorer:    { hp: 20, w: 0.6, h: 1.95, spd: 1.4, villager: true, job: 'armorer' },
    cleric:     { hp: 20, w: 0.6, h: 1.95, spd: 1.4, villager: true, job: 'cleric' },
    fisherman:  { hp: 20, w: 0.6, h: 1.95, spd: 1.4, villager: true, job: 'fisherman' },
    fletcher:   { hp: 20, w: 0.6, h: 1.95, spd: 1.4, villager: true, job: 'fletcher' },
    butcher:    { hp: 20, w: 0.6, h: 1.95, spd: 1.4, villager: true, job: 'butcher' },
    leatherworker:{ hp: 20, w: 0.6, h: 1.95, spd: 1.4, villager: true, job: 'leatherworker' },
    mason:      { hp: 20, w: 0.6, h: 1.95, spd: 1.4, villager: true, job: 'mason' },
    cartographer:{ hp: 20, w: 0.6, h: 1.95, spd: 1.4, villager: true, job: 'cartographer' },
    nitwit:     { hp: 20, w: 0.6, h: 1.95, spd: 1.4, villager: true },
    baby_villager:{ hp: 10, w: 0.3, h: 1.0, spd: 1.6, villager: true, baby: true },
    zombie_villager_baby:{ hp: 10, w: 0.3, h: 1.0, spd: 2.0, melee: 2, baby: true },
    // bosses
    ender_dragon:{ hp: 200, boss: 'dragon', w: 8, h: 5, spd: 8, flying: true, invincible_until_crystals: true, phase: 'perch' },
    wither:     { hp: 300, boss: 'wither', w: 3, h: 4, spd: 3, flying: true, blocks: true, skull: true, spawns_witherskull: true },
    warden:     { hp: 500, w: 0.9, h: 2.9, spd: 1.9, melee: 30, sonic_boom: true, digs: true, angry: false, blind_smell: true, drops: [['sculk_catalyst', 1, 1]] },
    // pets/misc
    iron_golem_player: {},
  };
  // extra items referenced in drops
  for (const it of ['venison', 'scute', 'sniffer_egg', 'armadillo_shell', 'skull_wither', 'wet_sponge', 'poppy_item']) {
    if (!WC.items[it]) WC.items[it] = { name: it, display: it.replace(/_/g, ' '), stack: 64, type: 'item', color: [180, 160, 140], icon: 'misc' };
  }

  // ---------- Spawn table per biome/dim/time ----------
  WC.spawnTables = {
    overworld_day: [['cow', 10], ['sheep', 10], ['pig', 10], ['chicken', 10], ['rabbit', 3], ['horse', 2], ['donkey', 1], ['llama', 2], ['wolf', 2], ['fox', 2], ['deer_wolf', 3], ['turtle', 2], ['bee', 4], ['parrot', 3], ['panda', 3], ['ocelot', 2], ['cat', 2], ['moobloom', 2], ['mushroom_cow', 4], ['camel', 2], ['sniffer', 1], ['allay', 1], ['frog', 2], ['goat', 3], ['armadillo', 2], ['axolotl', 2], ['dolphin', 2], ['cod', 5], ['salmon', 5], ['squid', 3], ['glow_squid', 2], ['tropical_fish', 3], ['pufferfish', 2], ['iron_golem', 1]],
    overworld_night: [['zombie', 20], ['skeleton', 10], ['creeper', 10], ['spider', 10], ['enderman', 5], ['witch', 2], ['slime', 3], ['phantom', 4], ['husk', 4], ['drowned', 4], ['pillager', 3], ['vex', 1], ['breeze', 1], ['creaking', 2]],
    overworld_cave: [['bat', 10], ['spider', 6], ['cave_spider', 4], ['silverfish', 4], ['slime', 5], ['zombie', 8], ['skeleton', 6], ['drowned', 3], ['warden', 0.3], ['bogged', 2]],
    nether: [['zombified_piglin', 10], ['skeleton', 5], ['wither_skeleton', 8], ['breeze', 5], ['enderman', 4], ['magma_cube', 8], ['strider', 5], ['hoglin', 5], ['piglin', 6], ['ghast', 8], ['zoglin', 3], ['blaze', 6]],
    end: [['enderman', 10], ['shulker', 4], ['endermite', 2]],
  };
  // bat missing from catalog
  MOBS.bat = { hp: 6, w: 0.5, h: 0.6, spd: 2.2, flying: true, night: true, drops: [] };
  MOBS.zombified_piglin = { hp: 20, w: 0.6, h: 1.9, spd: 1.9, melee: 5, neutral_until_hit: true, nether_only: true, drops: [['rotten_flesh', 0, 1], ['gold_nugget', 0, 1], ['gold_ingot', 0, 1]] };

  // ---------- Entity base ----------
  function eid() { return S.nextEid++; }
  WC.spawnEntity = function (type, x, y, z, opts = {}) {
    const def = MOBS[type];
    const e = Object.assign({
      id: eid(), type, x, y, z, vx: 0, vy: 0, vz: 0, yaw: Math.random() * 6.28, pitch: 0,
      hp: def ? def.hp : 10, maxHp: def ? def.hp : 10, age: 0, hurtT: 0, dead: false,
      target: null, wanderT: 0, wx: 0, wz: 0, onGround: false, inWater: false,
      aiState: 'idle', fuse: -1, cooldown: 0, home: { x, z }, tame: false, anger: 0,
      variant: (Math.random() * 4) | 0, size: 1, data: {},
    }, opts);
    if (def && def.splits) e.size = opts.size || 2;
    S.entities.push(e);
    return e;
  };
  WC.spawnItemEntity = function (x, y, z, stack, opts = {}) {
    const e = { id: eid(), type: 'item', x, y, z, vx: (Math.random() - .5), vy: 2, vz: (Math.random() - .5),
      stack, age: 0, pickupDelay: opts.delay || 10, dead: false, bob: Math.random() * 6 };
    S.entities.push(e);
    return e;
  };
  WC.spawnProjectile = function (kind, x, y, z, dx, dy, dz, opts = {}) {
    const spd = kind === 'arrow' ? 3.2 : kind === 'snowball' || kind === 'egg' ? 1.6 : 1.2;
    const len = Math.hypot(dx, dy, dz) || 1;
    const e = { id: eid(), type: 'proj', kind, x, y, z, vx: dx / len * spd, vy: dy / len * spd, vz: dz / len * spd,
      age: 0, dead: false, dmg: opts.dmg || (kind === 'arrow' ? 2 : kind === 'fireball' ? 5 : kind === 'witherskull' ? 8 : kind === 'dragon_fireball' ? 6 : kind === 'trident' ? 9 : 0),
      owner: opts.owner || 'player', effect: opts.effect || null, gravity: kind !== 'dragon_fireball' && kind !== 'fireball', pierce: opts.pierce || 0 };
    S.entities.push(e);
    return e;
  };

  // ---------- Physics for entities ----------
  function collideMove(e, dtSec, w) {
    const def = MOBS[e.type] || {};
    const grav = def.flying || def.flying_hover ? 0 : (e.inWater ? 0.05 : 0.04);
    e.vy -= grav;
    if (def.flying && e.aiState !== 'idle') e.vy += Math.sin(e.age * 0.1) * 0.02 + (def.hoverY !== undefined ? 0 : 0);
    if (def.aquatic && !e.inWater) e.vy -= 0.02;
    if (e.type === 'item') e.vy = Math.max(e.vy, -0.3);
    const drag = e.inWater ? 0.8 : 0.98;
    e.vx *= drag; e.vz *= drag;
    const hw = (def.w || 0.3) * e.size / 2, hh = (def.h || 0.5) * e.size;
    // step move with simple collision
    let nx = e.x + e.vx, ny = e.y + e.vy, nz = e.z + e.vz;
    e.onGround = false;
    // vertical
    const feetSolid = (yy) => {
      for (let ox = -hw; ox <= hw; ox += hw) for (let oz = -hw; oz <= hw; oz += hw) {
        const b = WC.blockDefAt(e.x + ox, yy, e.z + oz);
        if (b && b.solid) return true;
      }
      return false;
    };
    if (e.vy <= 0) {
      if (feetSolid(ny - 0.01)) { ny = Math.ceil(ny * 100) / 100; while (feetSolid(ny - 0.001)) ny += 0.01; e.vy = 0; e.onGround = true; }
    } else {
      if (feetSolid(ny + hh)) { e.vy = 0; ny = e.y; }
    }
    // horizontal with auto-step-up
    const solidAt = (xx, yy, zz) => {
      for (let oy = 0.05; oy < hh; oy += 0.5) {
        const b = WC.blockDefAt(xx, yy + oy, zz);
        if (b && b.solid) return true;
      }
      return false;
    };
    let fx = e.x, fz = e.z;
    if (!solidAt(nx + Math.sign(e.vx) * hw, ny, e.z)) fx = nx; else {
      // try step up 1 block
      if (!solidAt(nx + Math.sign(e.vx) * hw, ny + 1, e.z) && e.onGround) { fx = nx; ny += 1; }
      else e.vx = 0;
    }
    if (!solidAt(fx, ny, nz + Math.sign(e.vz) * hw)) fz = nz; else {
      if (!solidAt(fx, ny + 1, nz + Math.sign(e.vz) * hw) && e.onGround) { fz = nz; ny += 1; }
      else e.vz = 0;
    }
    e.x = fx; e.y = ny; e.z = fz;
    // water check
    const wb = WC.blockDefAt(e.x, e.y + hh * 0.5, e.z);
    e.inWater = !!(wb && wb.liquid);
    // void death
    if (e.y < WC.Y_MIN - 4) damageEntity(e, 4, 'void');
    // lava
    const lb = WC.blockDefAt(e.x, e.y + 0.1, e.z);
    if (lb && lb.name === 'lava' && !def.fireImmune) damageEntity(e, e.type === 'item' ? 0 : 2, 'fire');
  }

  function damageEntity(e, amount, source, knock) {
    if (e.dead) return;
    if (e.invulnT > 0) return;
    e.hp -= amount;
    e.hurtT = 8; e.invulnT = 5;
    if (knock) { e.vx += knock[0]; e.vy += knock[1]; e.vz += knock[2]; }
    if (e.boss) WC.updateBossBar();
    if (e.hp <= 0) killEntity(e, source);
  }
  WC.damageEntity = damageEntity;

  function killEntity(e, source) {
    e.dead = true;
    const def = MOBS[e.type];
    const p = S.player;
    if (def && def.drops && source !== 'self') {
      const luck = WC.hasEffect(p, 'luck') ? 1 : 0;
      for (const [it, mn, mx] of def.drops) {
        let n = mn + ((Math.random() * (mx - mn + 1)) | 0);
        if (n <= 0 && Math.random() > 0.05 + luck * 0.1) continue;
        if (n > 0) WC.spawnItemEntity(e.x, e.y + 0.4, e.z, WC.itemStack(it, n));
      }
    }
    if (e.tame && e.type !== 'item') WC.log(e.type + ' died...', '#f88');
    // special deaths
    if (e.type === 'ender_dragon') WC.onDragonDeath(e);
    if (e.type === 'wither') { WC.grantAdv('kill_wither'); WC.spawnItemEntity(e.x, e.y, e.z, WC.itemStack('nether_star', 1)); WC.log('The Wither has been slain!', '#ff8'); }
    if (e.type === 'elder_guardian') WC.log('Elder Guardian defeated — mining fatigue lifted.', '#8ff');
    if (S.entities.filter(x => x.type === 'wither').length === 0 && WC.bossBars && WC.bossBars.wither) WC.bossBars.wither = null;
    // stats
    if (source === 'player' && e.type !== 'item') { p.kills[e.type] = (p.kills[e.type] || 0) + 1; WC.addXp(e.boss ? 500 : xpFor(e.type)); }
  }
  function xpFor(type) {
    const t = MOBS[type];
    if (!t) return 1;
    if (t.hostile || t.melee || t.bows || t.explodes) return 3 + ((Math.random() * 3) | 0);
    return 1 + ((Math.random() * 2) | 0);
  }

  // ---------- AI tick ----------
  const HOSTILES = ['zombie', 'husk', 'drowned', 'zombie_villager', 'skeleton', 'stray', 'bogged', 'creeper', 'spider', 'cave_spider', 'enderman', 'witch', 'slime', 'magma_cube', 'phantom', 'ravager', 'pillager', 'vindicator', 'evoker', 'illusioner', 'wither_skeleton', 'blaze', 'ghast', 'hoglin', 'zoglin', 'piglin', 'piglin_brute', 'warden', 'shulker', 'vex', 'breeze', 'creaking', 'silverfish', 'endermite'];
  WC.isHostileToPlayer = function (type) {
    const p = S.player;
    const d = MOBS[type];
    if (!d) return false;
    if (d.neutral_until_hit && p && d.data === undefined) { }
    switch (type) {
      case 'creeper': case 'zombie': case 'skeleton': case 'spider': case 'cave_spider': case 'witch': case 'slime':
      case 'phantom': case 'ravager': case 'pillager': case 'vindicator': case 'evoker': case 'illusioner':
      case 'husk': case 'drowned': case 'zombie_villager': case 'stray': case 'bogged': case 'wither_skeleton':
      case 'blaze': case 'ghast': case 'magma_cube': case 'shulker': case 'vex': case 'silverfish': case 'endermite':
      case 'warden': case 'breeze': case 'creaking':
        return S.difficulty !== 'peaceful';
      case 'enderman': return !!p && p._lookedAtEnderman;
      case 'piglin': case 'piglin_brute': case 'hoglin': case 'zoglin':
        return !(p && p.armor[0] && String(p.armor[0].item).includes('gold'));
      default: return false;
    }
  };

  function nearestPlayer(e, range) {
    const p = S.player;
    const d = Math.hypot(e.x - p.x, e.y - p.y, e.z - p.z);
    return d <= range ? { ent: p, isPlayer: true, d } : null;
  }
  function findTargetList(e, list, range) {
    let best = null, bd = range;
    for (const o of S.entities) {
      if (o === e || o.dead || o.type === 'item' || o.type === 'proj') continue;
      if (!list.includes(o.type)) continue;
      const d = Math.hypot(e.x - o.x, e.y - o.y, e.z - o.z);
      if (d < bd) { bd = d; best = o; }
    }
    return best ? { ent: best, d: bd } : null;
  }

  WC.tickEntities = function (dtSec) {
    const S2 = WC.state, p = S2.player;
    for (let i = S2.entities.length - 1; i >= 0; i--) {
      const e = S2.entities[i];
      if (e.dead) { S2.entities.splice(i, 1); continue; }
      e.age += dtSec * 20;
      if (e.hurtT > 0) e.hurtT--;
      if (e.invulnT > 0) e.invulnT--;
      if (e.cooldown > 0) e.cooldown--;
      // despawn far mobs (not named/tame/boss/item)
      const dp = Math.hypot(e.x - p.x, e.z - p.z);
      if (e.type !== 'item' && !e.boss && !e.named && !e.tame && !e.persistent && dp > 128) { S2.entities.splice(i, 1); continue; }
      if (e.type === 'item') {
        if (e.pickupDelay > 0) { e.pickupDelay -= dtSec * 20; }
        else if (dp < 1.8 && Math.abs(e.y - p.y) < 1.6) {
          if (WC.invAdd(p, e.stack.item, e.stack.count, { durability: e.stack.durability })) { e.dead = true; continue; }
        }
        if (e.age > 6000) { e.dead = true; }
        collideMove(e, dtSec);
        continue;
      }
      if (e.type === 'proj') { tickProjectile(e, dtSec); continue; }
      if (e.boss) { tickBoss(e, dtSec); continue; }
      const def = MOBS[e.type] || {};
      // burn in sun
      if (def.burns_sun && S2.dim === 'overworld' && !WC.isNight() && !e.inWater) {
        const sky = skyExposure(e);
        if (sky) { if (e.age % 20 < dtSec * 20) damageEntity(e, 1, 'fire'); if (!e.data.fireTicks) e.data.fireTicks = 0; }
      }
      // AI
      tickMobAI(e, def, dtSec);
      collideMove(e, dtSec);
    }
    // mob vs mob collisions skipped for perf
  };

  function skyExposure(e) {
    for (let y = (e.y | 0) + 1; y < WC.Y_MAX; y++) {
      const b = WC.blockDefAt(e.x, y, e.z);
      if (b && b.opaque) return false;
    }
    return true;
  }

  function tickMobAI(e, def, dtSec) {
    const p = S.player;
    const pd = Math.hypot(e.x - p.x, e.y - p.y, e.z - p.z);
    const hostileNow = WC.isHostileToPlayer(e.type) && pd < (def.sightRange || 16) && S.mode !== 'creative';
    // pick target
    let tgt = null;
    if (hostileNow) tgt = { ent: p, d: pd, isPlayer: true };
    if (def.protects || def.attacks) {
      const other = findTargetList(e, def.attacks || [], 12);
      if (other && (!tgt || other.d < tgt.d)) tgt = { ent: other.ent, d: other.d };
    }
    if (def.pack && e.type === 'wolf') {
      // wolves help attack whoever player hits
      if (e.data.assistTarget && !e.data.assistTarget.dead) tgt = { ent: e.data.assistTarget, d: Math.hypot(e.x - e.data.assistTarget.x, e.z - e.data.assistTarget.z) };
    }
    e.target = tgt ? tgt.ent : null;

    const spd = (def.spd || 1.5) * (e.inWater ? 0.6 : 1);
    if (tgt && tgt.d < 24) {
      e.aiState = 'chase';
      const dx = tgt.x - e.x, dz = tgt.z - e.z;
      const l = Math.hypot(dx, dz) || 1;
      e.yaw = Math.atan2(-dx, dz);
      if (def.bows || def.crossbows || def.ranged) {
        // keep distance ~8 and shoot arrows
        const want = 8;
        const mv = l > want + 1 ? 1 : l < want - 2 ? -0.7 : 0;
        e.vx = dx / l * spd * mv; e.vz = dz / l * spd * mv;
        if (e.cooldown <= 0 && l < 14) {
          const dy = (tgt.y + 1) - (e.y + 1.4);
          WC.spawnProjectile('arrow', e.x, e.y + 1.4, e.z, dx, dy, dz, { owner: e.id, dmg: def.crossbows ? 4 : 2, effect: def.bows === 'slowness' ? 'slowness' : def.bows === 'poison' ? 'poison' : null });
          e.cooldown = def.crossbows ? 40 : 30;
        }
      } else if (def.explodes) {
        e.vx = dx / l * spd; e.vz = dz / l * spd;
        if (pd < 2.6) { e.fuse = e.fuse < 0 ? 30 : e.fuse - 1; }
        if (e.fuse === 0) { explodeCreeper(e); e.dead = true; }
        if (e.fuse > 0 && pd > 4) e.fuse = -1;
      } else if (def.teleports && pd > 4 && Math.random() < 0.008 * dtSec * 20) {
        // enderman teleport near/away
        const ang = Math.random() * 6.28, dist = 4 + Math.random() * 8;
        const tx = p.x + Math.cos(ang) * dist, tz = p.z + Math.sin(ang) * dist;
        for (let y = WC.Y_MAX - 90; y > WC.Y_MIN; y--) if (WC.isSolidAt(tx, y, tz)) { e.x = tx; e.y = y + 1.1; e.z = tz; break; }
      } else if (def.laser) {
        e.vx = 0; e.vz = 0;
        if (e.cooldown <= 0 && pd < 12) {
          WC.addEffect(p, 'mining_fatigue', 200, 3);
          damageEntityFromMob(e, p, 6);
          e.cooldown = 100;
        }
      } else if (def.fireballs) {
        e.vx = dx / l * spd * 0.6; e.vz = dz / l * spd * 0.6;
        if (def.flying_hover) e.vy = Math.sin(e.age * 0.05) * 0.05;
        if (e.cooldown <= 0 && pd < 20) {
          const dy = (tgt.y + 1) - (e.y + 1);
          WC.spawnProjectile(def.nether_only && e.type === 'blaze' ? 'fireball_small' : 'fireball', e.x, e.y + 1.2, e.z, dx, dy, dz, { owner: e.id, dmg: e.type === 'ghast' ? 8 : 3 });
          e.cooldown = e.type === 'ghast' ? 60 : 40;
        }
      } else if (def.throws_potions) {
        e.vx = dx / l * spd * 0.5; e.vz = dz / l * spd * 0.5;
        if (e.cooldown <= 0 && pd < 10) {
          WC.spawnProjectile('potion_thrown', e.x, e.y + 1.4, e.z, dx, 2, dz, { owner: e.id });
          e.cooldown = 80;
        }
        if (e.hp < e.maxHp * 0.5 && Math.random() < 0.01) { e.hp = Math.min(e.maxHp, e.hp + 4); }
      } else if (def.summons_vex || def.fangs) {
        e.vx = dx / l * spd * 0.4; e.vz = dz / l * spd * 0.4;
        if (e.cooldown <= 0) {
          if (def.summons_vex && Math.random() < 0.5) { const v = WC.spawnEntity('vex', e.x, e.y + 1, e.z); v.data.life = 400; }
          else { damageEntityFromMob(e, p, 4); WC.spawnProjectile('fangs', e.x, e.y, e.z, dx, 0, dz, { owner: e.id, dmg: 6 }); }
          e.cooldown = 60;
        }
      } else if (def.clone) { } else if (def.swoops) {
        // phantom dive
        if (pd < 16 && e.data.circling === undefined) e.data.circling = 0;
        e.data.circling += dtSec;
        const cir = e.data.circling < 3;
        const ang = Math.atan2(dx, dz) + (cir ? 0.4 : 0);
        e.vx = Math.sin(ang) * spd * (cir ? 1 : 2); e.vz = Math.cos(ang) * spd * (cir ? 1 : 2);
        e.vy = cir ? 0.05 : (e.y > p.y + 4 ? -0.3 : 0);
        if (!cir && pd < 1.6) { damageEntityFromMob(e, p, 5); e.data.circling = 0; }
      } else {
        // melee chase
        e.vx = dx / l * spd; e.vz = dz / l * spd;
        if (def.jumps || def.jumps_wind) { if (Math.random() < 0.02) e.vy = 0.35; }
        if (pd < 1.8 + def.w * 0.4 && e.cooldown <= 0) {
          const dmg = def.melee || (def.w > 1.5 ? 6 : 2);
          damageEntityFromMob(e, p, dmg, [dx / l * 0.4, 0.25, dz / l * 0.4]);
          e.cooldown = 20;
          if (def.poisonTouch) WC.addEffect(p, 'poison', 100);
          if (def.witherTouch) WC.addEffect(p, 'wither', 100);
          if (def.hungerTouch) WC.addEffect(p, 'hunger', 200);
          if (def.sting) { damageEntityFromMob(e, p, def.sting); e.dead = true; }
        }
        // creeper hissing handled above; zombies break doors
        if (def.breaks_door && pd < 2 && Math.random() < 0.005) {
          for (let ox = -1; ox <= 1; ox++) for (let oz = -1; oz <= 1; oz++) {
            const b = WC.blockDefAt(e.x + ox, e.y, e.z + oz);
            if (b && b.render === 'door') WC.setBlock(Math.floor(e.x + ox), Math.floor(e.y), Math.floor(e.z + oz), 'air');
          }
        }
      }
    } else {
      // idle wander
      e.aiState = 'idle';
      if (def.flying) { e.vy = Math.sin(e.age * 0.06) * 0.02; }
      if (--e.wanderT <= 0) {
        e.wanderT = 40 + ((Math.random() * 80) | 0);
        if (Math.random() < 0.6) { const a = Math.random() * 6.28; e.wx = Math.sin(a); e.wz = Math.cos(a); } else { e.wx = 0; e.wz = 0; }
      }
      e.vx = e.wx * spd * 0.4; e.vz = e.wz * spd * 0.4;
      if (e.wx) e.yaw = Math.atan2(-e.wx, e.wz);
      // aquatic mobs seek water, land animals avoid deep water
      if (def.aquatic && !e.inWater) {
        for (let r = 1; r < 8; r++) {
          const a = Math.random() * 6.28;
          if (!WC.blockDefAt(e.x + Math.cos(a) * r, e.y, e.z + Math.sin(a) * r)?.liquid) continue;
          e.wx = Math.cos(a); e.wz = Math.sin(a); break;
        }
      }
      if (def.snowman && Math.random() < 0.02 && WC.blockDefAt(e.x, e.y - 1, e.z)?.name === 'snow_block') WC.spawnProjectile('snowball', e.x, e.y + 1, e.z, e.wx || 1, 0.3, e.wz || 0, { owner: e.id, dmg: 1.5 });
      if (def.lava_walk && WC.blockDefAt(e.x, e.y - 0.2, e.z)?.name !== 'lava') e.vy -= 0.01;
    }
    // slime bounce movement
    if (def.splits) { e.vy = Math.max(e.vy, Math.sin(e.age * 0.15) * 0.2); }
    // baby growth
    if (def.baby && e.age > 2400) def.baby = false;
    // enderman provocation timer
    if (e.type === 'enderman' && e.data.provokeT > 0) e.data.provokeT -= dtSec * 20;
    if (e.type === 'warden') {
      // anger builds when player vibrates nearby
      if (pd < 15 && p.movingRecently) e.anger += dtSec * 10;
      if (e.anger > 40 && !e.target) e.target = p;
    }
    if (e.type === 'vex' && e.data.life !== undefined && --e.data.life <= 0) e.dead = true;
  }

  function damageEntityFromMob(e, victim, dmg, knock) {
    if (victim === S.player) WC.damagePlayer(dmg, e.type);
    else damageEntity(victim, dmg, e.type, knock);
  }

  function explodeCreeper(e) {
    const charged = e.data.charged;
    const power = charged ? 4 : 3;
    WC.explode(e.x, e.y, e.z, power, 'creeper');
    WC.log('Creeper explodes!', '#f55');
  }

  // ---------- Projectiles ----------
  function tickProjectile(pr, dtSec) {
    pr.age++;
    if (pr.age > 200) { pr.dead = true; return; }
    if (pr.gravity) pr.vy -= 0.035;
    if (pr.kind === 'fangs') { pr.dead = true; if (Math.hypot(S.player.x - pr.x, S.player.z - pr.z) < 1.5) WC.damagePlayer(6, 'evoker_fangs'); return; }
    // substep
    const steps = 4;
    for (let s = 0; s < steps; s++) {
      pr.x += pr.vx / steps; pr.y += pr.vy / steps; pr.z += pr.vz / steps;
      const b = WC.blockDefAt(pr.x, pr.y, pr.z);
      if (b && b.solid) {
        if (pr.kind === 'ender_pearl') { teleportPlayerTo(pr); }
        else if (pr.kind === 'fireball' || pr.kind === 'fireball_small' || pr.kind === 'witherskull' || pr.kind === 'dragon_fireball') {
          WC.explode(pr.x, pr.y, pr.z, pr.kind === 'witherskull' ? 2 : pr.kind === 'dragon_fireball' ? 1.5 : 1, 'explosion');
        } else if (pr.kind === 'potion_thrown') splashPotion(pr);
        else if (pr.kind === 'trident') { pr.dead = true; WC.spawnItemEntity(pr.x, pr.y, pr.z, WC.itemStack('trident', 1)); }
        pr.dead = true; return;
      }
      // hit entities
      for (const e of S.entities) {
        if (e.dead || e === pr || e.id === pr.owner) continue;
        const def = MOBS[e.type] || { w: 0.3, h: 0.3 };
        if (Math.abs(e.x - pr.x) < def.w && Math.abs(e.z - pr.z) < def.w && pr.y > e.y - 0.2 && pr.y < e.y + def.h + 0.3) {
          if (pr.kind === 'arrow' || pr.kind === 'spectral_arrow' || pr.kind === 'trident' || pr.kind === 'fireball' || pr.kind === 'witherskull' || pr.kind === 'dragon_fireball' || pr.kind === 'snowball' || pr.kind === 'egg') {
            damageEntity(e, pr.dmg, pr.owner === 'player' ? 'player' : 'mob', [pr.vx * 0.15, 0.2, pr.vz * 0.15]);
            if (pr.effect) WC.addEffect(e, pr.effect, 100);
            if (pr.kind === 'trident') { pr.dead = true; WC.spawnItemEntity(pr.x, pr.y, pr.z, WC.itemStack('trident', 1)); }
            else if (!pr.pierce || --pr.pierce < 0) pr.dead = true;
          } else if (pr.kind === 'potion_thrown') { splashPotionOn(pr, e); pr.dead = true; }
          return;
        }
      }
      // hit player if mob-owned
      if (pr.owner !== 'player') {
        const p = S.player;
        if (Math.abs(p.x - pr.x) < 0.5 && Math.abs(p.z - pr.z) < 0.5 && pr.y > p.y - 0.2 && pr.y < p.y + 1.9) {
          if (pr.dmg) WC.damagePlayer(pr.dmg, pr.kind === 'witherskull' ? 'wither' : pr.kind === 'dragon_fireball' ? 'dragon' : 'projectile');
          if (pr.effect) WC.addEffect(p, pr.effect, 100);
          pr.dead = true; return;
        }
      }
    }
  }
  function teleportPlayerTo(pr) {
    const p = S.player;
    p.x = pr.x; p.y = pr.y; p.z = pr.z; p.vx = p.vy = p.vz = 0;
    WC.damagePlayer(2.5, 'ender_pearl');
    WC.log('Whoosh! Ender pearl teleport.', '#a8f');
  }
  const POTION_HITS = { poison_potion: ['poison', 100, 2], harming_potion: [null, 0, 6], healing_potion: [null, 0, -4], slowness_potion: ['slowness', 120, 0], strength_potion: ['strength', 120, 0], fire_resistance_potion: ['fire_resistance', 120, 0], instant_health: [null, 0, -4] };
  function splashPotion(pr) {
    WC.splashPotionAt(pr.x, pr.y, pr.z, pr.potionName || 'harming_potion');
  }
  function splashPotionOn(pr, e) { WC.splashPotionAt(pr.x, pr.y, pr.z, pr.potionName || 'harming_potion', e); }
  WC.splashPotionAt = function (x, y, z, potionName, specificEnt) {
    const eff = WC.items[potionName]?.potionEffects || [];
    for (const e of S.entities) {
      if (e.dead || (specificEnt && e !== specificEnt)) continue;
      if (Math.hypot(e.x - x, e.y - y, e.z - z) > 4) continue;
      for (const [name, dur, amp] of eff.map(a => Array.isArray(a) ? a : [a.name, a.dur, a.amp])) {
        if (name === 'instant_damage') damageEntity(e, 6, 'potion');
        else if (name === 'instant_health') e.hp = Math.min(e.maxHp, e.hp + 4);
        else WC.addEffect(e, name, dur, amp || 0);
      }
      break;
    }
    // also affect player
    const p = S.player;
    if (Math.hypot(p.x - x, p.y - y, p.z - z) < 4) {
      for (const a of eff) {
        const [name, dur, amp] = Array.isArray(a) ? a : [a.name, a.dur, a.amp];
        if (name === 'instant_damage') WC.damagePlayer(6, 'potion');
        else if (name === 'instant_health') p.health = Math.min(p.maxHealth, p.health + 4);
        else WC.addEffect(p, name, dur, amp || 0);
      }
    }
    WC.log('Splash! ' + potionName.replace(/_/g, ' '), '#caf');
  };

  // ---------- Explosions ----------
  WC.explode = function (x, y, z, power, source) {
    const R = power;
    const w = WC.world();
    for (let ox = -R; ox <= R; ox++) for (let oy = -R; oy <= R; oy++) for (let oz = -R; oz <= R; oz++) {
      const d = Math.hypot(ox, oy, oz);
      if (d > R * (0.7 + Math.random() * 0.3)) continue;
      const bx = Math.floor(x + ox), by = Math.floor(y + oy), bz = Math.floor(z + oz);
      const b = WC.blockDefAt(bx, by, bz);
      if (!b) continue;
      if (['obsidian', 'bedrock', 'water', 'lava', 'end_portal_block'].includes(b.name)) continue;
      if (b.hardness < 0) continue;
      if (Math.random() < 0.7) {
        if (Math.random() < 0.1 && b.drop) WC.spawnItemEntity(bx + 0.5, by, bz + 0.5, WC.itemStack(b.drop, 1));
        WC.setBlock(bx, by, bz, 'air');
      }
    }
    // damage entities
    for (const e of S.entities) {
      if (e.dead) continue;
      const d = Math.hypot(e.x - x, e.y - y, e.z - z);
      if (d < R * 2) {
        const dmg = Math.max(0, (1 - d / (R * 2)) * 12 * (power / 3));
        if (e === S.player || e.type === 'player') WC.damagePlayer(dmg, source === 'creeper' ? 'creeper' : 'explosion');
        else damageEntity(e, dmg, 'explosion', [(e.x - x) / d * 0.5, 0.4, (e.z - z) / d * 0.5]);
      }
    }
    // fire spread chance
    if (source === 'tnt' || Math.random() < 0.2) { /* ignite nearby creepers */ }
    for (const e of S.entities) {
      if (e.type === 'creeper' && !e.dead && Math.hypot(e.x - x, e.y - y, e.z - z) < R * 1.5) { e.fuse = 10; }
    }
    WC.fxExplosion(x, y, z, power);
  };
  WC.fxExplosion = function (x, y, z, power) {
    if (WC.particles) WC.particles.burst(x, y, z, 'smoke', 30 * power);
    if (WC.sound) WC.sound.play('explode');
  };

  // ---------- Bosses ----------
  WC.spawnDragon = function () {
    if (S.entities.some(e => e.type === 'ender_dragon')) return;
    const d = WC.spawnEntity('ender_dragon', 0, 100, 0, { boss: 'dragon', hp: 200, maxHp: 200 });
    d.crystals = [];
    // create end crystals around pillars
    for (let a = 0; a < 10; a++) {
      const ang = a / 10 * Math.PI * 2;
      const px = Math.cos(ang) * 40, pz = Math.sin(ang) * 40;
      d.crystals.push({ x: px, y: 80, z: pz, alive: true });
    }
    WC.setBossBar('ender_dragon', 1);
    WC.log('The End Crystal network hums... The dragon circles overhead.', '#f4f');
    return d;
  };
  WC.setBossBar = function (name, prog) { S.bossbar = { name, progress: prog }; if (WC.ui && WC.ui.showBoss) WC.ui.showBoss(name, prog); };
  WC.updateBossBar = function () {
    const b = S.entities.find(e => e.boss);
    if (b) { S.bossbar = { name: b.type, progress: b.hp / b.maxHp }; if (WC.ui && WC.ui.showBoss) WC.ui.showBoss(b.type, b.hp / b.maxHp); }
    else { S.bossbar = null; if (WC.ui && WC.ui.hideBoss) WC.ui.hideBoss(); }
  };
  function tickBoss(e, dtSec) {
    if (e.type === 'ender_dragon') tickDragon(e, dtSec);
    else if (e.type === 'wither') tickWither(e, dtSec);
  }
  function tickDragon(d, dtSec) {
    const p = S.player;
    d.phaseT = (d.phaseT || 0) + dtSec;
    // heal from crystals
    if (d.crystals && d.crystals.some(c => c.alive)) {
      d.healT = (d.healT || 0) + dtSec;
      if (d.healT > 1) { d.healT = 0; d.hp = Math.min(d.maxHp, d.hp + 1); }
    }
    const perch = d.crystals && !d.crystals.some(c => c.alive);
    if (perch) {
      // fly to center pillar then perch, breathe fire
      const tx = 0, tz = 0;
      if (d.phase === 'perch') {
        const dx = tx - d.x, dz = tz - d.z;
        const l = Math.hypot(dx, dz) || 1;
        d.vx = dx / l * 0.4; d.vz = dz / l * 0.4;
        d.vy = (72 - d.y) * 0.01;
        if (l < 3) { d.phase = 'breath'; d.breathT = 6; }
      } else if (d.phase === 'breath') {
        d.breathT -= dtSec; d.vx = d.vz = 0;
        d.yaw = Math.atan2(-(p.x - d.x), -(p.z - d.z)) + Math.PI;
        if (Math.random() < 0.3) WC.spawnProjectile('dragon_fireball', d.x, d.y, d.z, p.x - d.x, p.y - d.y, p.z - d.z, { owner: d.id, dmg: 6 });
        if (d.breathT <= 0) d.phase = 'heal_wait';
      } else {
        // circle & swoop
        orbit(d, dtSec);
        if (Math.random() < 0.005) d.phase = 'perch';
      }
    } else {
      orbit(d, dtSec);
      // shoot fireball at player occasionally
      if (e_cooldown(d, 120)) {
        WC.spawnProjectile('dragon_fireball', d.x, d.y, d.z, p.x - d.x, p.y - d.y, p.z - d.z, { owner: d.id, dmg: 6 });
      }
      // contact damage
      if (Math.hypot(d.x - p.x, d.y - p.y, d.z - p.z) < 4) WC.damagePlayer(10, 'dragon');
    }
    collideMove(d, dtSec);
    d.y = Math.max(60, Math.min(140, d.y));
    WC.updateBossBar();
  }
  function e_cooldown(e, t) { if (e.cooldown > 0) { e.cooldown--; return false; } e.cooldown = t; return true; }
  function orbit(d, dtSec) {
    d.orbitA = (d.orbitA || 0) + dtSec * 0.35;
    const r = 30 + Math.sin(d.orbitA * 0.7) * 12;
    const tx = Math.cos(d.orbitA) * r, tz = Math.sin(d.orbitA) * r;
    d.vx = (tx - d.x) * 0.08; d.vz = (tz - d.z) * 0.08;
    d.vy = (75 + Math.sin(d.orbitA * 2) * 12 - d.y) * 0.05;
    d.yaw = Math.atan2(-(d.vx), d.vz) + Math.PI;
  }
  WC.onDragonDeath = function (d) {
    WC.grantAdv('dragon');
    WC.log('🐉 THE ENDER DRAGON HAS BEEN SLAIN!', '#ff8');
    // exit portal
    const w = WC.world();
    for (let x = -1; x <= 1; x++) for (let z = -1; z <= 1; z++) WC.setBlock(x, 70, z, 'end_portal_block');
    for (let x = -2; x <= 2; x++) for (let z = -2; z <= 2; z++) if (Math.abs(x) === 2 || Math.abs(z) === 2) WC.setBlock(x, 69, z, 'bedrock');
    WC.setBlock(0, 71, 2, 'dragon_egg');
    // huge XP
    for (let i = 0; i < 12; i++) WC.spawnItemEntity(d.x, d.y, d.z, WC.itemStack('experience_bottle', 1));
    WC.addXp(500);
    if (WC.sound) WC.sound.play('dragon_death');
  };
  WC.spawnWither = function (x, y, z) {
    const w = WC.spawnEntity('wither', x, y, z, { boss: 'wither', hp: 300, maxHp: 300 });
    WC.setBossBar('wither', 1);
    WC.log('Wither summoned! It seeks destruction...', '#f88');
    return w;
  };
  function tickWither(w, dtSec) {
    const p = S.player;
    if (w.spawnAnim > 0) { w.spawnAnim -= dtSec; w.hp = Math.min(w.maxHp, w.hp + dtSec * 10); return; }
    w.vx = 0; w.vz = 0;
    w.vy = (p.y + 8 - w.y) * 0.02;
    w.yaw = Math.atan2(-(p.x - w.x), p.z - w.z);
    // shoot skulls
    if (e_cooldown(w, 40)) {
      const dx = p.x - w.x, dy = p.y + 1 - w.y, dz = p.z - w.z;
      WC.spawnProjectile('witherskull', w.x, w.y + 1, w.z, dx, dy, dz, { owner: w.id, dmg: 5 });
    }
    // break blocks below sometimes
    if (Math.random() < 0.02 && S.gamerules.mobGriefing) {
      const bx = Math.floor(w.x + (Math.random() - .5) * 4), by = Math.floor(w.y - 2), bz = Math.floor(w.z + (Math.random() - .5) * 4);
      const b = WC.blockDefAt(bx, by, bz);
      if (b && b.hardness >= 0 && b.name !== 'bedrock') WC.setBlock(bx, by, bz, 'air');
    }
    // wither aura damage
    if (Math.hypot(w.x - p.x, w.y - p.y, w.z - p.z) < 3.5) WC.addEffect(p, 'wither', 60);
    collideMove(w, dtSec);
    WC.updateBossBar();
  }

  // ---------- Natural spawning ----------
  let spawnTimer = 0;
  WC.tickSpawning = function (dtSec) {
    if (!S.gamerules.doMobSpawning || S.difficulty === 'peaceful') return;
    spawnTimer += dtSec;
    if (spawnTimer < 1.5) return;
    spawnTimer = 0;
    const p = S.player;
    const count = S.entities.filter(e => e.type !== 'item' && e.type !== 'proj' && !e.boss && !e.tame && !e.persistent).length;
    if (count > 60) return;
    // attempt a few spawns in 24..48 radius ring
    for (let tries = 0; tries < 6; tries++) {
      const ang = Math.random() * 6.28;
      const dist = 26 + Math.random() * 24;
      const sx = Math.floor(p.x + Math.cos(ang) * dist), sz = Math.floor(p.z + Math.sin(ang) * dist);
      // find ground
      let sy = null;
      for (let y = Math.min(WC.Y_MAX - 2, Math.floor(p.y) + 8); y > Math.max(WC.Y_MIN, Math.floor(p.y) - 16); y--) {
        if (WC.isSolidAt(sx, y, sz) && !WC.blockDefAt(sx, y + 1, sz)?.solid && !WC.blockDefAt(sx, y + 2, sz)?.solid) { sy = y + 1; break; }
      }
      if (sy === null) continue;
      const table = pickSpawnTable(sx, sy, sz);
      const total = table.reduce((a, [, w]) => a + w, 0);
      let r = Math.random() * total, chosen = table[0][0];
      for (const [m, w] of table) { r -= w; if (r <= 0) { chosen = m; break; } }
      const def = MOBS[chosen];
      if (!def) continue;
      // aquatic only in water etc
      if (def.aquatic && !WC.blockDefAt(sx, sy, sz)?.liquid) continue;
      if (!def.aquatic && WC.blockDefAt(sx, sy, sz)?.liquid && !def.canSwim) continue;
      const e = WC.spawnEntity(chosen, sx + 0.5, sy, sz + 0.5);
      if (chosen === 'slime' && Math.random() < 0.5) e.size = 1 + ((Math.random() * 3) | 0);
      if (S.dim === 'end' && chosen === 'enderman') e.persistent = false;
      break;
    }
  };
  function pickSpawnTable(x, y, z) {
    if (S.dim === 'nether') return WC.spawnTables.nether;
    if (S.dim === 'end') return WC.spawnTables.end;
    const inDark = lightLevelAt(x, y, z) < 8;
    const night = WC.isNight();
    if (night || inDark) {
      const t = [...WC.spawnTables.overworld_night];
      if (inDark && y < 40) t.push(...WC.spawnTables.overworld_cave);
      return t;
    }
    return WC.spawnTables.overworld_day;
  }
  function lightLevelAt(x, y, z) {
    const w = WC.world();
    const c = w.getChunk(x >> 4, z >> 4);
    if (!c || !c.light) return 15;
    if (y < WC.Y_MIN || y >= WC.Y_MAX) return 15;
    return (c.light[WC.idxL(x & 15, y, z & 15)] >> 4) & 15;
  }

  // ---------- Villager trading ----------
  WC.TRADES = [
    { give: ['emerald', 1], get: ['bread', 3], job: 'farmer' },
    { give: ['wheat', 20], get: ['emerald', 1], job: 'farmer' },
    { give: ['emerald', 1], get: ['cod', 6], job: 'fisherman' },
    { give: ['coal', 8], get: ['emerald', 1], job: 'toolsmith' },
    { give: ['emerald', 5], get: ['diamond', 1], job: 'toolsmith' },
    { give: ['emerald', 7], get: ['iron_sword', 1], job: 'weaponsmith' },
    { give: ['emerald', 8], get: ['iron_chestplate', 1], job: 'armorer' },
    { give: ['emerald', 6], get: ['chainmail_helmet', 1], job: 'armorer' },
    { give: ['book', 4], get: ['emerald', 1], job: 'librarian' },
    { give: ['emerald', 3], get: ['enchanted_book', 1], job: 'librarian' },
    { give: ['rotten_flesh', 4], get: ['emerald', 1], job: 'cleric' },
    { give: ['emerald', 2], get: ['healing_potion', 1], job: 'cleric' },
    { give: ['string', 10], get: ['emerald', 1], job: 'fletcher' },
    { give: ['emerald', 1], get: ['arrow', 12], job: 'fletcher' },
    { give: ['leather', 5], get: ['emerald', 1], job: 'leatherworker' },
    { give: ['emerald', 3], get: ['leather_chestplate', 1], job: 'leatherworker' },
    { give: ['clay_ball', 8], get: ['emerald', 1], job: 'mason' },
    { give: ['emerald', 4], get: ['polished_andesite', 8], job: 'mason' },
    { give: ['map_placeholder', 1], get: ['emerald', 1], job: 'cartographer' },
    { give: ['emerald', 1], get: ['cookie', 8], job: None_job() },
  ];
  function None_job() { return 'nitwit'; }
})();
