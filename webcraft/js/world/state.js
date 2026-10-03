// ============================================================
// Game state: inventory, player stats (health/hunger/xp),
// effects, game modes, time, dimensions, containers,
// enchantments, crafting book, achievements.
// ============================================================
(function () {
  'use strict';
  const WC = window.WC;

  const S = WC.state = {
    seed: (Math.random() * 1e9) | 0,
    mode: 'survival',           // survival|creative|hardcore|adventure
    dim: 'overworld',
    time: 1000,                 // ticks 0..24000 (day cycle)
    weather: 'clear',           // clear|rain|thunder
    weatherT: 0,
    difficulty: 'normal',       // peaceful|easy|normal|hard
    gamerules: { keepInventory: false, doMobSpawning: true, dayLightCycle: true, mobGriefing: true },
    player: {
      x: 8.5, y: 80, z: 8.5, vx: 0, vy: 0, vz: 0,
      yaw: 0, pitch: 0, onGround: false, inWater: false,
      health: 20, maxHealth: 20, food: 20, saturation: 5, exhaustion: 0,
      air: 300, maxAir: 300, xp: 0, level: 0, xpProgress: 0,
      fallStart: null, hurtT: 0, invulnT: 0, regenT: 0,
      effects: [],             // {name, dur, amp}
      hotbar: 0,
      inv: new Array(36).fill(null),   // 0..8 hotbar, 9..35 main
      armor: [null, null, null, null], // head chest legs feet
      offhand: null,
      spawn: { overworld: null, nether: null, end: null },
      deaths: 0, kills: {}, placed: {}, mined: {}, walked: 0,
      elytra: false, sprinting: false, sneaking: false, swimming: false,
      fishing: null,
      lastDamageSource: null,
      speedMult: 1,
      jumpBoost: 0,
      breaking: null,          // {x,y,z,progress,total}
      selectedSlot: 0,
      reach: 4.5,
      name: 'Steve',
      skin: 'steve',
      cape: false,
    },
    worlds: {},                // dim -> DimWorld
    entities: [],              // mobs/items/projectiles
    nextEid: 1,
    containers: new Map(),     // "x,y,z" -> {type, slots:[], customName}
    recipesSeen: new Set(['stick', 'planks']),
    advancements: new Set(),
    log: [],
    bossbar: null,             // {name, progress}
    scoreboard: {},
    statistics: {},
    options: { fov: 70, renderDist: 6, mouseSens: 0.002, soundVol: 0.7, musicVol: 0.4, bob: true, showFps: false, autosave: true },
    paused: false,
    frameTick: 0,              // global frame counter (used by chunk unload & UI)
    screen: null,              // open UI screen id
    fps: 0,
    chunksLoaded: 0,
    totalBlocksPlaced: 0,
    chatOpen: false,
    chatHistory: [],
    thirdPerson: 0,            // 0 first, 1 back, 2 front
    debug: false,
  };

  // ---------- World access ----------
  WC.world = function (dim) {
    dim = dim || S.dim;
    if (!S.worlds[dim]) S.worlds[dim] = new WC.DimWorld(dim, S.seed ^ (dim === 'nether' ? 0x4e45544 : dim === 'end' ? 0x454e440 : 0));
    return S.worlds[dim];
  };
  WC.blockAt = function (wx, wy, wz, dim) {
    const w = WC.world(dim);
    let id = w.blockAt(wx | 0, wy | 0, wz | 0);
    if (id === null) { w.ensureChunk(wx >> 4, wz >> 4); id = w.blockAt(wx | 0, wy | 0, wz | 0); }
    return id || 0;
  };
  WC.blockDefAt = function (wx, wy, wz, dim) { return WC.blockIds[WC.blockAt(wx, wy, wz, dim)]; };
  WC.setBlock = function (wx, wy, wz, nameOrId, meta) {
    const id = typeof nameOrId === 'number' ? nameOrId : WC.blockId(nameOrId);
    return WC.world().setBlock(wx | 0, wy | 0, wz | 0, id, meta);
  };
  WC.isSolidAt = function (wx, wy, wz, dim) { const d = WC.blockDefAt(wx, wy, wz, dim); return !!(d && d.solid); };

  // ---------- Inventory helpers ----------
  WC.itemStack = (name, count = 1, extra = {}) => Object.assign({ item: name, count, durability: WC.items[name] && WC.items[name].durability ? WC.items[name].durability : undefined, enchants: null, customName: null, nbt: {} }, extra);
  WC.invAdd = function (player, name, count = 1, extra = {}) {
    const def = WC.items[name];
    let stackMax = def ? def.stack : 64;
    if (def && (def.type === 'tool' || def.type === 'weapon' || def.type === 'armor' || def.type === 'potion')) stackMax = 1;
    // stack into existing
    const all = [...player.inv.map((s, i) => ({ s, i })), { s: player.offhand, i: -1 }];
    for (const { s, i } of all) {
      if (s && s.item === name && s.count < stackMax && !s.customName && !extra.customName) {
        const add = Math.min(stackMax - s.count, count);
        s.count += add; count -= add;
        if (count <= 0) return true;
      }
    }
    // empty slots
    for (let i = 0; i < 36 && count > 0; i++) {
      if (!player.inv[i]) {
        const put = Math.min(stackMax, count);
        player.inv[i] = WC.itemStack(name, put, extra);
        count -= put;
      }
    }
    if (count > 0) return false;
    return true;
  };
  WC.invCount = function (player, name) {
    let c = 0;
    for (const s of player.inv) if (s && s.item === name) c += s.count;
    if (player.offhand && player.offhand.item === name) c += player.offhand.count;
    return c;
  };
  WC.invRemove = function (player, name, count = 1) {
    for (let i = 0; i < 36 && count > 0; i++) {
      const s = player.inv[i];
      if (s && s.item === name) {
        const take = Math.min(s.count, count);
        s.count -= take; count -= take;
        if (s.count <= 0) player.inv[i] = null;
      }
    }
    return count <= 0;
  };
  WC.heldItem = function (player) { return player.inv[player.hotbar] || null; };
  WC.heldDef = function (player) { const h = WC.heldItem(player); return h ? WC.items[h.item] : null; };

  // ---------- Effects ----------
  WC.EFFECTS = {
    speed: { stat: 'speedMult', mul: 0.2 }, slowness: { stat: 'speedMult', mul: -0.15 },
    jump_boost: { stat: 'jumpBoost', add: 0.5 },
    regeneration: { healPerSec: 1 }, poison: { dmgPerSec: 1, bypassArmor: true },
    wither: { dmgPerSec: 1 }, weakness: { dmgMul: -0.2 }, strength: { dmgAdd: 3 },
    instant_health: { heal: 4 }, instant_damage: { dmg: 6 },
    water_breathing: { air: true }, fire_resistance: { fireImmune: true },
    night_vision: { nightVision: true }, invisibility: { invisible: true },
    absorption: { absorb: 4 }, resistance: { dmgMul: -0.4 },
    levitation: { levitate: true }, slow_falling: { slowFall: true },
    hunger: { exhaust: 0.5 }, blindness: { blind: true },
    luck: { luck: 1 }, bad_luck: { luck: -1 },
    mining_fatigue: { mineMul: -0.3 }, haste: { mineMul: 0.2 },
    nausea: { nausea: true }, dolphins_grace: { swim: 0.2 },
    hero_of_the_village: { hero: true }, dark_forest_cursed: {},
  };
  WC.addEffect = function (player, name, dur, amp = 0) {
    const ex = player.effects.find(e => e.name === name);
    if (ex) { ex.dur = Math.max(ex.dur, dur); ex.amp = Math.max(ex.amp, amp); }
    else player.effects.push({ name, dur, amp });
  };
  WC.hasEffect = (player, name) => player.effects.some(e => e.name === name);
  WC.clearEffects = (player) => { player.effects.length = 0; };

  // ---------- Damage / death ----------
  WC.damagePlayer = function (amount, source = 'generic') {
    const p = S.player;
    if (S.mode === 'creative' || S.difficulty === 'peaceful') amount = 0;
    if (p.invulnT > 0) return;
    // armor reduction
    let prot = 0, tough = 0;
    for (const a of p.armor) if (a) { const d = WC.items[a.item]; if (d) { prot += d.armor; tough += d.armorToughness || 0; } }
    const reduc = Math.min(20, prot * 0.25 + tough * 0.0);
    const afterArmor = amount * (1 - Math.min(0.8, reduc / (reduc + 5)));
    // effect modifiers
    let afterArmor2;
    if (WC.hasEffect(p, 'resistance')) afterArmor2 = afterArmor * 0.4; else afterArmor2 = afterArmor;
    if (WC.hasEffect(p, 'fire_resistance') && ['fire', 'lava'].includes(source)) afterArmor2 = 0;
    if (source === 'fall' && WC.hasEffect(p, 'slow_falling')) afterArmor2 = 0;
    let dmg = Math.max(0.5, afterArmor2);
    // absorption
    const abs = p.effects.find(e => e.name === 'absorption');
    if (abs) { const use = Math.min(dmg, abs.absorb || 4); dmg -= use; }
    p.health -= dmg;
    p.hurtT = 10; p.invulnT = 10;
    p.lastDamageSource = source;
    if (p.health <= 0) WC.killPlayer();
  };
  WC.killPlayer = function () {
    const p = S.player;
    p.deaths++;
    WC.log('You died. ' + deathMsg(p.lastDamageSource));
    if (S.mode === 'hardcore') { S.mode = 'spectator'; WC.log('Hardcore: you are now a spectator.'); }
    if (!S.gamerules.keepInventory && S.mode !== 'creative') {
      // drop items as entity piles
      for (let i = 0; i < 36; i++) if (p.inv[i]) { WC.spawnItemEntity(p.x, p.y, p.z, p.inv[i]); p.inv[i] = null; }
      for (let i = 0; i < 4; i++) if (p.armor[i]) { WC.spawnItemEntity(p.x, p.y, p.z, p.armor[i]); p.armor[i] = null; }
    }
    WC.respawnPlayer();
  };
  function deathMsg(src) {
    const msgs = { fall: 'You fell from a high place', lava: 'You tried to swim in lava', fire: 'You went up in flames',
      drowning: 'You drowned', void: 'You fell out of the world', creeper: 'You were blown up by a Creeper',
      zombie: 'You were slain by a Zombie', skeleton: 'You were shot by a Skeleton', spider: 'You were killed by a Spider',
      enderman: 'You were slain by an Enderman', dragon: 'You were slain by the End Dragon', wither: 'You were withered away',
      piglin: 'You were killed by a Piglin', blaze: 'You were burnt to a crisp', ghast: 'You were gunned down in the air',
      star: 'You were obliterated by a sonic boom', generic: 'You died' };
    return msgs[src] || ('You were killed by ' + src);
  }
  WC.respawnPlayer = function () {
    const p = S.player;
    const sp = p.spawn[S.dim] || (S.dim === 'overworld' ? null : null);
    p.health = p.maxHealth; p.food = 20; p.saturation = 5; p.air = p.maxAir;
    WC.clearEffects(p);
    const w = WC.world();
    let sx = 8.5, sy = 100, sz = 8.5;
    if (sp) { sx = sp.x; sy = sp.y; sz = sp.z; }
    else {
      // find surface
      for (let y = WC.Y_MAX - 80; y > WC.Y_MIN; y--) {
        if (WC.isSolidAt(sx, y, sz)) { sy = y + 2; break; }
      }
    }
    p.x = sx; p.y = sy; p.z = sz; p.vx = p.vy = p.vz = 0;
    p.invulnT = 60;
  };

  // ---------- Healing / hunger tick ----------
  WC.tickPlayerStats = function (dtSec) {
    const p = S.player;
    if (S.mode === 'creative') { p.health = p.maxHealth; p.food = 20; }
    // effects countdown
    for (let i = p.effects.length - 1; i >= 0; i--) {
      const e = p.effects[i];
      e.dur -= dtSec * 20;
      const cfg = WC.EFFECTS[e.name] || {};
      if (cfg.healPerSec) p.health = Math.min(p.maxHealth, p.health + cfg.healPerSec * dtSec * (1 + e.amp));
      if (cfg.dmgPerSec && p.hurtT <= 0) { p.health -= cfg.dmgPerSec * dtSec * (1 + e.amp); if (p.health <= 0) WC.killPlayer(); }
      if (cfg.exhaust) p.exhaustion += cfg.exhaust * dtSec;
      if (e.dur <= 0) p.effects.splice(i, 1);
    }
    p.hurtT--; p.invulnT--;
    // hunger drain
    const active = p.sprinting ? 0.1 : p.swimming ? 0.05 : 0.01;
    p.exhaustion += active * dtSec;
    if (p.exhaustion >= 1) {
      p.exhaustion -= 1;
      if (p.saturation > 0) p.saturation = Math.max(0, p.saturation - 1);
      else p.food = Math.max(0, p.food - 1);
    }
    // regen when well fed
    if (p.food >= 18 && p.health < p.maxHealth) {
      p.regenT += dtSec;
      if (p.regenT > 4) { p.regenT = 0; p.health = Math.min(p.maxHealth, p.health + 1); p.exhaustion += 3; }
    }
    // starving
    if (p.food <= 0) {
      p.regenT += dtSec;
      if (p.regenT > 4 && S.difficulty !== 'peaceful' && S.mode === 'survival') { p.regenT = 0; WC.damagePlayer(1, 'starvation'); }
    }
    // breath
    if (p.inWater && !WC.hasEffect(p, 'water_breathing')) {
      p.air -= dtSec * 20;
      if (p.air <= 0) { WC.damagePlayer(2, 'drowning'); p.air = -20; }
    } else p.air = Math.min(p.maxAir, p.air + dtSec * 40);
  };

  // ---------- XP ----------
  WC.addXp = function (n) {
    const p = S.player;
    p.xp += n;
    while (true) {
      const need = 2 * p.level + 7;
      if (p.xp >= need) { p.xp -= need; p.level++; } else break;
    }
  };

  // ---------- Log & chat ----------
  WC.log = function (msg, color) {
    S.log.push({ msg, color, t: Date.now() });
    if (S.log.length > 60) S.log.shift();
    if (WC.ui && WC.ui.refreshLog) WC.ui.refreshLog();
  };

  // ---------- Time ----------
  WC.dayPhase = function () {
    const t = S.time % 24000;
    return t / 24000; // 0=sunrise-ish; MC: 0 golden hour start, 6000 noon, 12000 sunset, 18000 midnight
  };
  WC.isNight = function () { const t = S.time % 24000; return t > 13000 || t < 1000; };

  // ---------- Advancements (subset but broad) ----------
  const ADV = {
    stone: { name: 'Getting Wood', desc: 'Punch a tree', icon: 'oak_log' },
    cobble: { name: 'Stone Age', desc: 'Mine stone', icon: 'cobblestone', req: 'stone' },
    craft_table: { name: 'Working at Bench', desc: 'Craft a crafting table', icon: 'crafting_table', req: 'cobble' },
    wood_pick: { name: 'Time to Mine!', desc: 'Craft a wooden pickaxe', icon: 'wooden_pickaxe', req: 'craft_table' },
    stone_tools: { name: 'Hot Topic', desc: 'Smelt items', icon: 'furnace', req: 'craft_table' },
    iron: { name: 'Acquire Hardware', desc: 'Smelt iron ingot', icon: 'iron_ingot', req: 'stone_tools' },
    iron_tools: { name: 'Not Today, Thank You', desc: 'Craft iron sword', icon: 'iron_sword', req: 'iron' },
    diamond: { name: 'DIAMONDS!', desc: 'Get a diamond', icon: 'diamond', req: 'iron_tools' },
    enchant: { name: 'Enchantment Table', desc: 'Build enchantment table', icon: 'enchanting_table', req: 'diamond' },
    copper: { name: 'Copper Age', desc: 'Use copper tools/armor', icon: 'copper_ingot', req: 'iron' },
    nether: { name: 'We Need to Go Deeper', desc: 'Build a Nether portal', icon: 'obsidian', req: 'diamond' },
    fortress: { name: 'A Seedy Place', desc: 'Enter the Nether', icon: 'netherrack', req: 'nether' },
    blaze: { name: 'Into Fire', desc: 'Obtain a Blaze Rod', icon: 'blaze_rod', req: 'fortress' },
    end: { name: 'The End?', desc: 'Enter the End portal', icon: 'ender_eye', req: 'blaze' },
    dragon: { name: 'Free the End', desc: 'Defeat the Ender Dragon', icon: 'dragon_egg', req: 'end' },
    beacon: { name: 'Return to Sender', desc: 'Restore the beacon', icon: 'beacon', req: 'dragon' },
    elytra: { name: 'Sky is the Limit', desc: 'Find elytra', icon: 'elytra', req: 'dragon' },
    mace: { name: 'Heavy Is the Head', desc: 'Craft the Mace', icon: 'netherite_mace', req: 'dragon' },
    spear: { name: 'Point Taken', desc: 'Craft a Spear', icon: 'iron_spear', req: 'iron_tools' },
    full_diamond: { name: 'Suit Up', desc: 'Wear diamond armor', icon: 'diamond_chestplate', req: 'diamond' },
    village: { name: 'Hired Help', desc: 'Trade with a villager', icon: 'emerald', req: 'iron_tools' },
    kill_wither: { name: 'Withering Heights', desc: 'Spawn & defeat Wither', icon: 'nether_star', req: 'fortress' },
    all_weapons: { name: 'Arsenal', desc: 'Own every weapon type', icon: 'trident', req: 'iron_tools' },
  };
  WC.ADVANCEMENTS = ADV;
  WC.grantAdv = function (id) {
    if (S.advancements.has(id)) return;
    const a = ADV[id];
    if (!a) return;
    if (a.req && !S.advancements.has(a.req)) return;
    S.advancements.add(id);
    WC.log('🏆 Advancement made: ' + a.name, '#ffdd55');
    if (WC.ui && WC.ui.toast) WC.ui.toast(a.name, a.desc, a.icon);
  };

  // ---------- Save / Load ----------
  WC.saveGame = function (slot = 'main') {
    try {
      const p = S.player;
      const data = {
        seed: S.seed, mode: S.mode, dim: S.dim, time: S.time, difficulty: S.difficulty, gamerules: S.gamerules,
        player: { ...p, breaking: null, fishing: null },
        edits: {}, blockEntities: {}, entities: [], advancements: [...S.advancements], recipesSeen: [...S.recipesSeen],
        version: 1,
      };
      for (const [dim, w] of Object.entries(S.worlds)) {
        data.edits[dim] = Object.fromEntries(w.edits);
        data.blockEntities[dim] = Object.fromEntries(w.blockEntities);
      }
      // serialize nearby entities
      data.entities = S.entities.filter(e => !e.dead && Math.hypot(e.x - p.x, e.z - p.z) < 128).map(e => ({
        type: e.type, x: e.x, y: e.y, z: e.z, yaw: e.yaw, hp: e.hp, age: e.age, name: e.name, pickupDelay: e.pickupDelay,
      }));
      localStorage.setItem('webcraft_save_' + slot, JSON.stringify(data));
      WC.log('Game saved.', '#8f8');
      return true;
    } catch (e) { console.warn('save failed', e); return false; }
  };
  WC.loadGame = function (slot = 'main') {
    const raw = localStorage.getItem('webcraft_save_' + slot);
    if (!raw) return false;
    try {
      const data = JSON.parse(raw);
      S.seed = data.seed; S.mode = data.mode; S.dim = data.dim || 'overworld';
      S.time = data.time; S.difficulty = data.difficulty || 'normal';
      Object.assign(S.gamerules, data.gamerules || {});
      Object.assign(S.player, data.player);
      S.worlds = {};
      for (const [dim, edits] of Object.entries(data.edits || {})) {
        const w = WC.world(dim);
        for (const [k, v] of Object.entries(edits)) w.edits.set(k, v);
      }
      for (const [dim, bes] of Object.entries(data.blockEntities || {})) {
        const w = WC.world(dim);
        for (const [k, v] of Object.entries(bes)) w.blockEntities.set(k, v);
      }
      S.advancements = new Set(data.advancements || []);
      S.recipesSeen = new Set(data.recipesSeen || ['stick']);
      for (const ed of data.entities || []) WC.spawnEntity(ed.type, ed.x, ed.y, ed.z, ed);
      WC.log('Game loaded.', '#8f8');
      return true;
    } catch (e) { console.warn('load failed', e); return false; }
  };
})();
