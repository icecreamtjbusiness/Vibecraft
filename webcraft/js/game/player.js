// ============================================================
// Player module: input, first-person physics, raycasting,
// mining/placing/attacking/interacting, crafting logic,
// furnaces, portals, beds, trading, potions, eating.
// ============================================================
(function () {
  'use strict';
  const WC = window.WC;
  const S = WC.state;
  const P = S.player;

  // ---------- Input ----------
  const keys = WC.keys = {};
  let mouseL = false, mouseR = false, locked = false;
  WC.inputPointerLocked = () => locked;

  // ---------- Particles bridge for mobs.js (WC.particles.burst) ----------
  WC.particles = {
    burst(x, y, z, kind, n) {
      if (!WC.game || !WC.game.renderer) return;
      const ps = WC.game.renderer.particles;
      const col = kind === 'smoke' ? [0.3, 0.3, 0.3] : kind === 'portal' ? [0.5, 0.15, 0.8] : [0.8, 0.5, 0.2];
      for (let i = 0; i < Math.min(n || 10, 60); i++) {
        ps.add(x + (Math.random() - .5), y + Math.random(), z + (Math.random() - .5),
          (Math.random() - .5) * 3, Math.random() * 3, (Math.random() - .5) * 3,
          0.6 + Math.random(), col, 0.08 + Math.random() * 0.08);
      }
    },
  };

  // ---------- Helpers ----------
  function blockDefAt(wx, wy, wz) { return WC.blockIds[WC.blockAt(wx, wy, wz)]; }
  function solidAt(wx, wy, wz) { const d = blockDefAt(wx, wy, wz); return !!(d && d.solid); }
  function liquidAt(wx, wy, wz) { const d = blockDefAt(wx, wy, wz); return !!(d && d.liquid); }

  const PW = 0.3, PH = 1.8, EYE = 1.62;

  function boxCollides(nx, ny, nz) {
    for (const ox of [-PW, PW]) for (const oz of [-PW, PW]) {
      for (let oy = 0.05; oy < PH; oy += 0.85) {
        if (solidAt(Math.floor(nx + ox), Math.floor(ny + oy), Math.floor(nz + oz))) return true;
      }
    }
    return false;
  }

  // ---------- Mining ----------
  function breakTime(def, held) {
    if (!def || def.hardness < 0) return Infinity;
    if (def.hardness === 0) return 0.05;
    let mult = 1;
    const hd = held ? WC.items[held.item] : null;
    let canHarvest = (def.tier || 0) === 0;
    if (hd && hd.type === 'tool' && hd.toolKind === def.tool) {
      mult = 2 + (hd.tier || 0) * 2.2;
      if ((hd.tier || 0) >= (def.tier || 0)) canHarvest = true;
      const ench = held.enchants && held.enchants.efficiency;
      if (ench) mult *= 1 + ench * 0.3;
    }
    if (WC.hasEffect(P, 'haste')) mult *= 1.2;
    if (WC.hasEffect(P, 'mining_fatigue')) mult *= 0.7;
    if (S.mode === 'creative') return 0.1;
    let t = def.hardness * 1.5 / mult;
    if (!canHarvest && def.tool) t *= 3.3;
    return Math.max(0.05, t);
  }

  function dropBlock(def, x, y, z) {
    const held = WC.heldItem(P);
    const hd = held ? WC.items[held.item] : null;
    let canHarvest = (def.tier || 0) === 0;
    if (hd && hd.type === 'tool' && hd.toolKind === def.tool && (hd.tier || 0) >= (def.tier || 0)) canHarvest = true;
    if (S.mode === 'creative') canHarvest = true;
    let drops;
    if (def.dropsFn) drops = def.dropsFn(Math.random);
    else if (def.drop) drops = [{ item: def.drop, count: 1 }];
    else drops = [{ item: def.name, count: 1 }];
    if (!drops) return;
    for (const dr of drops) {
      if (!dr || !dr.item) continue;
      if (!canHarvest && def.tool && def.tier > 0) continue;
      WC.spawnItemEntity(x + 0.5, y + 0.3, z + 0.5, WC.itemStack(dr.item, dr.count || 1));
    }
    P.mined[def.name] = (P.mined[def.name] || 0) + 1;
    if (def.name.endsWith('_log') || def.name.endsWith('_wood')) WC.grantAdv('stone');
    if (['stone', 'cobblestone', 'deepslate', 'granite', 'diorite', 'andesite'].includes(def.name)) WC.grantAdv('cobble');
    if (def.name.includes('diamond')) WC.grantAdv('diamond');
    if (def.name.includes('copper')) WC.grantAdv('copper');
  }

  // ---------- Raycast (DDA) ----------
  WC.target = { hit: false, x: 0, y: 0, z: 0, nx: 0, ny: 0, nz: 0, dist: 0, block: 0 };
  function rayTrace(maxDist) {
    const cy = Math.cos(P.yaw), sy = Math.sin(P.yaw), cp = Math.cos(P.pitch), sp = Math.sin(P.pitch);
    const dx = sy * cp, dy = sp, dz = -cy * cp;
    const x = P.x, y = P.y + EYE, z = P.z;
    let bx = Math.floor(x), by = Math.floor(y), bz = Math.floor(z);
    const stepX = dx > 0 ? 1 : -1, stepY = dy > 0 ? 1 : -1, stepZ = dz > 0 ? 1 : -1;
    const tDX = Math.abs(1 / (dx || 1e-9)), tDY = Math.abs(1 / (dy || 1e-9)), tDZ = Math.abs(1 / (dz || 1e-9));
    let tMX = (dx > 0 ? (bx + 1 - x) : (x - bx)) * tDX;
    let tMY = (dy > 0 ? (by + 1 - y) : (y - by)) * tDY;
    let tMZ = (dz > 0 ? (bz + 1 - z) : (z - bz)) * tDZ;
    let face = [0, 0, 0], t = 0;
    for (let i = 0; i < 200; i++) {
      const id = WC.blockAt(bx, by, bz);
      const def = WC.blockIds[id];
      if (def && def.id !== 0 && !def.replaceable && !def.liquid) {
        WC.target.hit = true; WC.target.x = bx; WC.target.y = by; WC.target.z = bz;
        WC.target.nx = face[0]; WC.target.ny = face[1]; WC.target.nz = face[2];
        WC.target.dist = t; WC.target.block = id;
        return WC.target;
      }
      if (tMX < tMY && tMX < tMZ) { bx += stepX; t = tMX; tMX += tDX; face = [-stepX, 0, 0]; }
      else if (tMY < tMZ) { by += stepY; t = tMY; tMY += tDY; face = [0, -stepY, 0]; }
      else { bz += stepZ; t = tMZ; tMZ += tDZ; face = [0, 0, -stepZ]; }
      if (t > maxDist) break;
    }
    WC.target.hit = false;
    return WC.target;
  }
  WC.rayTrace = rayTrace;

  // ---------- Entity ray hit ----------
  function entityInSight(maxDist) {
    const t = rayTrace(maxDist);
    let best = null, bt = t.hit ? t.dist : maxDist;
    const cy = Math.cos(P.yaw), sy = Math.sin(P.yaw), cp = Math.cos(P.pitch), sp = Math.sin(P.pitch);
    const dx = sy * cp, dy = sp, dz = -cy * cp;
    for (const e of S.entities) {
      if (e.dead || e.type === 'proj') continue;
      const def = WC.MOBS[e.type] || (e.type === 'item' ? { w: 0.4, h: 0.4 } : { w: 0.6, h: 1.8 });
      const hw = (def.w || 0.6) / 2 * (e.size || 1), hh = (def.h || 1.8) * (e.size || 1);
      const ox = P.x, oy = P.y + EYE, oz = P.z;
      const minB = [e.x - hw, e.y, e.z - hw], maxB = [e.x + hw, e.y + hh, e.z + hw];
      let t0 = 0, t1 = bt, ok = true;
      for (let ax = 0; ax < 3; ax++) {
        const o = [ox, oy, oz][ax], d = [dx, dy, dz][ax];
        if (Math.abs(d) < 1e-8) { if (o < minB[ax] || o > maxB[ax]) { ok = false; break; } continue; }
        let ta = (minB[ax] - o) / d, tb = (maxB[ax] - o) / d;
        if (ta > tb) { const tmp = ta; ta = tb; tb = tmp; }
        t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
        if (t0 > t1) { ok = false; break; }
      }
      if (ok && t0 >= 0 && t0 < bt) { bt = t0; best = e; }
    }
    return best;
  }
  WC.entityInSight = entityInSight;

  // ---------- Attack ----------
  let attackCooldown = 0;
  function tryAttack() {
    if (attackCooldown > 0) return;
    const e = entityInSight(P.reach);
    const held = WC.heldItem(P);
    const hd = held ? WC.items[held.item] : null;
    P.swingT = 0.25;
    if (!e) {
      if (hd && (hd.type === 'weapon' || hd.type === 'tool')) WC.sound.play('sword_swing');
      attackCooldown = 0.35;
      return;
    }
    if (e.type === 'item') { // quick-pickup
      if (WC.invAdd(P, e.stack.item, e.stack.count)) e.dead = true;
      return;
    }
    let dmg = hd && hd.attack ? hd.attack * 0.5 + 0.5 : 1;
    if (held && held.enchants && held.enchants.sharpness) dmg += held.enchants.sharpness * 0.5;
    if (WC.hasEffect(P, 'strength')) dmg += 3;
    if (WC.hasEffect(P, 'weakness')) dmg = Math.max(1, dmg - 2);
    if (hd && hd.toolKind === 'mace' && P.vy < -0.4) { dmg *= 1 + Math.min(4, -P.vy * 1.5); WC.sound.play('mace_smash'); }
    else WC.sound.play(hd && hd.toolKind === 'spear' ? 'spear_throw' : 'sword_swing');
    const cy = Math.cos(P.yaw), sy = Math.sin(P.yaw);
    WC.damageEntity(e, dmg, 'player', [sy * 0.35, 0.28, -cy * 0.35]);
    if (held && hd && hd.durability) damageDurability(held, 1);
    if (e.type === 'enderman') P._lookedAtEnderman = true;
    if (hd && hd.toolKind === 'shears' && e.type === 'sheep' && !e.sheared) {
      e.sheared = true; WC.spawnItemEntity(e.x, e.y, e.z, WC.itemStack('wool_white', 1)); damageDurability(held, 1);
    }
    // wolves assist
    for (const w of S.entities) if (w.type === 'wolf' && w.tame && Math.hypot(w.x - P.x, w.z - P.z) < 14) w.data.assistTarget = e;
    attackCooldown = hd ? Math.max(0.25, 1 / (hd.speed || 1.6)) : 0.4;
  }
  function damageDurability(stack, n) {
    const hd = WC.items[stack.item];
    if (!hd || !hd.durability) return;
    stack.durability = (stack.durability === undefined ? hd.durability : stack.durability) - n;
    if (stack.durability <= 0) {
      WC.log(hd.display + ' broke!', '#f88');
      const i = P.inv.indexOf(stack);
      if (i >= 0) P.inv[i] = null;
      else if (P.offhand === stack) P.offhand = null;
      WC.sound.play('break_block');
    }
  }
  WC.damageDurability = damageDurability;

  // ---------- Place / Use ----------
  function dirFromYaw() {
    const cy = Math.cos(P.yaw), sy = Math.sin(P.yaw);
    if (Math.abs(sy) > Math.abs(cy)) return sy > 0 ? 5 : 4; // east/west
    return cy > 0 ? 3 : 2; // south/north
  }

  function useHeld(onShift) {
    const held = WC.heldItem(P);
    const hd = held ? WC.items[held.item] : null;
    // interact with entity first (unless sneaking)
    if (!onShift) {
      const e = entityInSight(P.reach);
      if (e && e.type !== 'item' && tryInteractMob(e, held, hd)) return;
    }
    const t = rayTrace(P.reach);
    if (hd && hd.type === 'food') { eat(hd, held); return; }
    if (hd && hd.type === 'potion') { drinkPotion(hd, held); return; }
    if (hd && hd.type === 'spawn_egg') {
      WC.spawnEntity(hd.mob, (t.hit ? t.x : Math.floor(P.x)) + 0.5, (t.hit ? t.y + 1 : Math.floor(P.y)), (t.hit ? t.z : Math.floor(P.z)) + 0.5);
      if (S.mode !== 'creative') { held.count--; if (held.count <= 0) P.inv[P.hotbar] = null; }
      WC.sound.play('pop'); return;
    }
    if (!t.hit) return;
    const bdef = WC.blockIds[t.block];
    if (!bdef) return;
    if (!onShift) {
      if (bdef.container) { openContainer(bdef, t.x, t.y, t.z); return; }
      if (bdef.extra && bdef.extra.door) { toggleDoor(t.x, t.y, t.z, bdef); return; }
      if (bdef.extra && bdef.extra.bed) { useBed(t.x, t.y, t.z); return; }
      if (bdef.name === 'enchanting_table') { openEnchant(); return; }
      if (bdef.name === 'anvil') { openAnvil(); return; }
      if (bdef.name === 'end_portal_frame' && held && held.item === 'ender_eye') { placeEnderEye(t.x, t.y, t.z); return; }
      if (bdef.render === 'trapdoor') { flipMeta(t.x, t.y, t.z, 4); WC.sound.play('door'); return; }
      if (bdef.name === 'lever' || bdef.name.startsWith('button')) { flipMeta(t.x, t.y, t.z, 1); WC.sound.play(bdef.name === 'lever' ? 'lever' : 'button'); return; }
      if (bdef.crop && (bdef.grown === undefined || (WC.world().metaAt(t.x, t.y, t.z) || 0) >= 7)) { harvestCrop(t.x, t.y, t.z, bdef); return; }
      if (bdef.name === 'farmland' && held && ['wheat_seeds', 'carrot', 'potato', 'beetroot_seeds'].includes(held.item)) { plantCrop(t.x, t.y + 1, t.z, held.item === 'wheat_seeds' ? 'wheat_crop' : held.item === 'beetroot_seeds' ? 'beetroot_crop' : held.item + '_crop', held); return; }
      if (held && held.item === 'bone_meal') { bonemeal(t.x, t.y, t.z); return; }
      if (bdef.flammable && held && held.item === 'flint_and_steel') { igniteNear(t.x + t.nx, t.y + t.ny, t.z + t.nz); return; }
      if (bdef.name === 'water' && held && held.item === 'bucket') { pickupLiquid(t.x, t.y, t.z, 'water_bucket'); return; }
      if (bdef.name === 'lava' && held && held.item === 'bucket') { pickupLiquid(t.x, t.y, t.z, 'lava_bucket'); return; }
      if (bdef.name === 'fire' && held && held.item === 'water_bucket') { WC.setBlock(t.x, t.y, t.z, 'air'); return; }
      if (bdef.name === 'jukebox' && held && hd && hd.disc) { WC.sound.startMusic(hd.disc); WC.log('Now playing: ' + hd.disc, '#8cf'); if (S.mode !== 'creative') { held.count--; if (held.count <= 0) P.inv[P.hotbar] = null; } return; }
      if (bdef.name === 'note_block') { WC.sound.play('note_bass'); return; }
      if (bdef.render === 'sign' && WC.ui && WC.ui.openSign) { WC.ui.openSign(t.x, t.y, t.z); return; }
      if (hd && hd.toolKind === 'rod') { startFishing(); return; }
      if (hd && hd.toolKind === 'shovel' && ['grass_block', 'dirt'].includes(bdef.name)) { WC.setBlock(t.x, t.y, t.z, 'path'); damageDurability(held, 1); WC.sound.play('place_block'); return; }
      if (hd && hd.toolKind === 'axe' && bdef.extra && bdef.extra.log) { WC.setBlock(t.x, t.y, t.z, bdef.name.replace('_log', '_wood'), bdef.id); damageDurability(held, 3); WC.sound.play('place_block'); return; }
      if (bdef.name === 'respawn_anchor' && held && held.item === 'glowstone') { WC.log('Respawn anchor charged.', '#8ff'); return; }
      // flint & steel on obsidian -> light nether portal
      if (held && held.item === 'flint_and_steel' && tryLightNetherPortal()) return;
    }
    if (hd && hd.type === 'block') { placeBlock(t, hd, held); return; }
    if (held && ['water_bucket', 'lava_bucket'].includes(held.item)) {
      const px = t.x + t.nx, py = t.y + t.ny, pz = t.z + t.nz;
      const cur = blockDefAt(px, py, pz);
      if (!cur || !cur.solid) {
        WC.setBlock(px, py, pz, held.item === 'water_bucket' ? 'water' : 'lava');
        if (S.mode !== 'creative') held.item = 'bucket';
        WC.sound.play('splash');
      }
      return;
    }
    if (held && ['trident', 'iron_spear', 'golden_spear', 'diamond_spear', 'netherite_spear', 'wooden_spear', 'stone_spear', 'copper_spear'].includes(held.item)) {
      const cy = Math.cos(P.yaw), sy = Math.sin(P.yaw), cp = Math.cos(P.pitch), sp = Math.sin(P.pitch);
      const pr = WC.spawnProjectile('arrow', P.x, P.y + EYE, P.z, sy * cp, sp, -cy *cp, { owner: 'player', dmg: (WC.items[held.item].attack || 5) * 0.8 });
      pr.kind = 'trident'; pr.vx *= 1.4; pr.vy *= 1.4; pr.vz *= 1.4; pr.stickItem = held.item;
      if (S.mode !== 'creative') P.inv[P.hotbar] = null;
      WC.sound.play('spear_throw');
      return;
    }
    if (held && ['snowball', 'egg', 'ender_pearl'].includes(held.item)) {
      const cy = Math.cos(P.yaw), sy = Math.sin(P.yaw), cp = Math.cos(P.pitch), sp = Math.sin(P.pitch);
      WC.spawnProjectile(held.item, P.x, P.y + EYE, P.z, sy * cp, sp, -cy * cp, { owner: 'player' });
      if (S.mode !== 'creative') { held.count--; if (held.count <= 0) P.inv[P.hotbar] = null; }
      WC.sound.play('click');
      return;
    }
  }

  function tryInteractMob(e, held, hd) {
    const def = WC.MOBS[e.type];
    if (!def) return false;
    if (def.tameable && !e.tame && held && ((e.type === 'wolf' && held.item === 'bone') || (e.type === 'cat' && ['cod', 'raw_fish', 'salmon'].includes(held.item)))) {
      if (Math.random() < 0.35) { e.tame = true; e.named = true; WC.log('Tamed! ♥', '#f8a'); WC.addEffect(P, 'luck', 1); }
      else WC.log('*crunch* ...not yet.', '#ccc');
      if (S.mode !== 'creative') { held.count--; if (held.count <= 0) P.inv[P.hotbar] = null; }
      WC.sound.play('eat'); return true;
    }
    if (e.tame && (e.type === 'wolf' || e.type === 'cat') && hd && hd.type === 'food') {
      e.hp = Math.min(e.maxHp, e.hp + hd.food * 0.5);
      if (S.mode !== 'creative') { held.count--; if (held.count <= 0) P.inv[P.hotbar] = null; }
      WC.sound.play('eat'); return true;
    }
    if (def.saddleable && held && held.item === 'saddle' && !e.saddled) {
      e.saddled = true;
      if (S.mode !== 'creative') { held.count--; if (held.count <= 0) P.inv[P.hotbar] = null; }
      WC.log('Saddled the ' + e.type + '! Right-click to ride.', '#afa'); return true;
    }
    if ((e.saddled || e.tame) && (e.type === 'horse' || e.type === 'pig' || e.type === 'donkey' || e.type === 'llama' || e.type === 'camel' || e.type === 'strider')) {
      if (P.mount === e) { P.mount = null; WC.log('Dismounted.', '#ccc'); }
      else { P.mount = e; WC.log('Mounted ' + e.type + '!', '#afa'); }
      return true;
    }
    if (e.type === 'villager' && WC.ui && WC.ui.openTrade) { WC.ui.openTrade(e); return true; }
    if (e.type === 'mooshroom' && held && held.item === 'bowl') {
      if (S.mode !== 'creative') { held.count--; if (held.count <= 0) P.inv[P.hotbar] = null; }
      WC.invAdd(P, 'mushroom_stew', 1); WC.sound.play('eat'); return true;
    }
    if (e.type === 'sheep' && hd && hd.toolKind === 'shears' && !e.sheared) {
      e.sheared = true; WC.spawnItemEntity(e.x, e.y, e.z, WC.itemStack('wool_white', 1)); damageDurability(held, 1); WC.sound.play('craft'); return true;
    }
    if (e.type === 'cow' || e.type === 'mushroom_cow') {
      if (held && held.item === 'bucket') {
        if (S.mode !== 'creative') { held.item = 'milk_bucket'; }
        WC.sound.play('drink'); return true;
      }
    }
    if (e.type === 'bee' || e.type === 'parrot') { WC.log(e.type + ' buzzes around you.', '#cc8'); return true; }
    return false;
  }

  function placeBlock(t, hd, held) {
    const px = t.x + t.nx, py = t.y + t.ny, pz = t.z + t.nz;
    const cur = WC.blockIds[WC.blockAt(px, py, pz)];
    if (cur && cur.id !== 0 && !cur.replaceable) return;
    const bdef = WC.blocks[hd.block];
    if (!bdef) return;
    // don't place solid block inside player
    if (bdef.solid) {
      const ix = px + 1 > P.x - PW && px < P.x + PW, iz = pz + 1 > P.z - PW && pz < P.z + PW;
      const iy = py + 1 > P.y && py < P.y + PH;
      if (ix && iz && iy) return;
    }
    let meta = 0;
    if (bdef.render === 'torch' || bdef.render === 'sign' || bdef.render === 'pane' || bdef.render === 'ladder') meta = dirFromYaw();
    if (bdef.render === 'door' || bdef.render === 'stairs') meta = dirFromYaw() % 4;
    if (bdef.render === 'slab' && t.ny === -1) meta = 8;
    WC.setBlock(px, py, pz, bdef.id, meta);
    if (S.mode !== 'creative') {
      held.count--;
      if (held.count <= 0) P.inv[P.hotbar] = null;
    }
    P.placed[hd.block] = (P.placed[hd.block] || 0) + 1;
    S.totalBlocksPlaced++;
    WC.sound.play('place_block');
    applyGravityAt(px, py + 1, pz);
    if (hd.block === 'crafting_table') WC.grantAdv('craft_table');
  }

  function applyGravityAt(x, y, z) {
    const d = blockDefAt(x, y, z);
    if (d && d.gravity) {
      let yy = y;
      while (yy > WC.Y_MIN && !solidAt(x, yy - 1, z) && !liquidAt(x, yy - 1, z)) yy--;
      if (yy !== y) { WC.setBlock(x, y, z, 'air'); WC.setBlock(x, yy, z, d.id); }
    }
  }
  WC.applyGravityAt = applyGravityAt;

  function toggleDoor(x, y, z, bdef) {
    const m = WC.world().metaAt(x, y, z) || 0;
    WC.setBlock(x, y, z, bdef.id, m ^ 8);
    WC.sound.play('door');
  }
  function flipMeta(x, y, z, bit) {
    const w = WC.world();
    const m = w.metaAt(x, y, z) || 0;
    const id = w.blockAt(x, y, z);
    WC.setBlock(x, y, z, id, m ^ bit);
  }

  function useBed(x, y, z) {
    if (S.dim === 'overworld') {
      if (!WC.isNight()) { WC.log('You can only sleep at night.', '#faa'); return; }
      S.time = 23000;
      P.spawn.overworld = { x: Math.floor(P.x), y: Math.floor(P.y), z: Math.floor(P.z) };
      WC.log('You set your spawn point. Sweet dreams!', '#afa');
      WC.sound.play('door');
    } else {
      WC.log('This bed will explode here! (too far from home)', '#f55');
      setTimeout(() => WC.explode(x + 0.5, y + 0.5, z + 0.5, 5, 'bed'), 700);
    }
  }

  function eat(hd, held) {
    if (P.food >= 20) { WC.log("You're not hungry!", '#faa'); return; }
    P.food = Math.min(20, P.food + (hd.food || 1));
    P.saturation = Math.min(P.food, P.saturation + (hd.saturation || 1));
    for (const ef of (hd.effects || [])) WC.addEffect(P, ef[0] || ef.name, ef[1] || ef.dur || 100, ef[2] || ef.amp || 0);
    WC.sound.play('eat');
    if (S.mode !== 'creative') {
      held.count--;
      if (held.count <= 0) P.inv[P.hotbar] = null;
      if (hd.leftover) WC.invAdd(P, hd.leftover, 1);
    }
  }
  function drinkPotion(hd, held) {
    for (const ef of (hd.potionEffects || [])) {
      const [name, dur, amp] = Array.isArray(ef) ? ef : [ef.name, ef.dur, ef.amp];
      if (name === 'instant_damage') WC.damagePlayer(6, 'potion');
      else if (name === 'instant_health') P.health = Math.min(P.maxHealth, P.health + 4);
      else WC.addEffect(P, name, dur || 100, amp || 0);
    }
    WC.sound.play('drink');
    if (S.mode !== 'creative') {
      held.count--;
      if (held.count <= 0) P.inv[P.hotbar] = null;
      WC.invAdd(P, 'glass_bottle', 1);
    }
  }

  function igniteNear(x, y, z) {
    if (WC.blocks.fire) WC.setBlock(x, y, z, 'fire');
    WC.sound.play('portal');
    WC.particles.burst(x + 0.5, y + 0.5, z + 0.5, 'smoke', 8);
  }
  function pickupLiquid(x, y, z, bucketName) {
    WC.setBlock(x, y, z, 'air');
    const held = WC.heldItem(P);
    if (S.mode !== 'creative' && held && held.item === 'bucket') held.item = bucketName;
    WC.sound.play('splash');
  }
  function plantCrop(x, y, z, cropName, held) {
    if (WC.blockAt(x, y, z)) return;
    if (!WC.blocks[cropName]) cropName = 'wheat_crop';
    if (!WC.blocks[cropName]) { WC.log('Cannot plant here.', '#faa'); return; }
    WC.setBlock(x, y, z, cropName, 0);
    if (S.mode !== 'creative') { held.count--; if (held.count <= 0) P.inv[P.hotbar] = null; }
    WC.sound.play('place_block');
  }
  function harvestCrop(x, y, z, bdef) {
    const drops = bdef.cropDrops || [{ item: (bdef.drop || bdef.name.replace('_crop', '')), count: 1 }];
    for (const d of drops) if (d && d.item && WC.items[d.item]) WC.spawnItemEntity(x + 0.5, y + 0.5, z + 0.5, WC.itemStack(d.item, d.count));
    if (Math.random() < 0.5) WC.spawnItemEntity(x + 0.5, y + 0.5, z + 0.5, WC.itemStack('wheat_seeds', 1));
    WC.setBlock(x, y, z, 'farmland');
    WC.sound.play('break_block');
  }
  function bonemeal(x, y, z) {
    const above = blockDefAt(x, y + 1, z);
    if (above && above.crop) WC.setBlock(x, y + 1, z, above.id, 7);
    else if (above && above.extra && above.extra.sapling) growTree(x, y + 1, z);
    const held = WC.heldItem(P);
    if (S.mode !== 'creative') { held.count--; if (held.count <= 0) P.inv[P.hotbar] = null; }
    WC.particles.burst(x + 0.5, y + 1.2, z + 0.5, 'smoke', 12);
    WC.sound.play('pop');
  }
  function growTree(x, y, z) {
    // simple oak tree
    const h = 4 + ((Math.random() * 2) | 0);
    for (let i = 1; i <= h; i++) WC.setBlock(x, y + i, z, 'oak_log');
    for (let ox = -2; ox <= 2; ox++) for (let oz = -2; oz <= 2; oz++) for (let oy = h - 2; oy <= h + 1; oy++) {
      if (Math.abs(ox) === 2 && Math.abs(oz) === 2 && oy > h) continue;
      if (!WC.blockAt(x + ox, y + oy, z + oz)) WC.setBlock(x + ox, y + oy, z + oz, 'oak_leaves');
    }
    WC.setBlock(x, y, z, 'air');
  }
  function placeEnderEye(x, y, z) {
    const w = WC.world();
    const m = w.metaAt(x, y, z) || 0;
    WC.setBlock(x, y, z, 'end_portal_frame', m | 8);
    if (S.mode !== 'creative') { const h = WC.heldItem(P); h.count--; if (h.count <= 0) P.inv[P.hotbar] = null; }
    WC.log('The End portal stirs...', '#a8f');
    WC.sound.play('end_portal');
    for (let ix = -2; ix <= 2; ix++) for (let iz = -2; iz <= 2; iz++) if (Math.abs(ix) + Math.abs(iz) <= 3) WC.setBlock(x + ix, y, z + iz, 'end_portal_block');
  }

  // ---------- Containers ----------
  function containerSize(type) {
    switch (type) {
      case 'chest': case 'barrel': case 'ender': return 27;
      case 'crafting': return 9;
      case 'furnace': case 'blast_furnace': case 'smoker': case 'campfire': return 4; // in fuel out + recipe extra
      default: return 27;
    }
  }
  function openContainer(bdef, x, y, z) {
    const key = x + ',' + y + ',' + z;
    const w = WC.world();
    let be = w.blockEntities.get(key);
    if (!be) {
      be = { type: bdef.container, slots: new Array(containerSize(bdef.container)).fill(null) };
      w.blockEntities.set(key, be);
    }
    be.pos = { x, y, z };
    S.activeContainer = be;
    S.containerKey = key;
    WC.sound.play(bdef.container === 'crafting' ? 'craft' : 'chest_open');
    if (WC.ui) WC.ui.openScreen(bdef.container, be);
  }
  WC.openContainer = openContainer;

  function openEnchant() {
    S.activeContainer = { type: 'enchanting', slots: [null, null] };
    if (WC.ui) WC.ui.openScreen('enchanting', S.activeContainer);
  }
  function openAnvil() {
    S.activeContainer = { type: 'anvil', slots: [null, null, null] };
    if (WC.ui) WC.ui.openScreen('anvil', S.activeContainer);
  }

  // ---------- Furnace ticking (all worlds) ----------
  WC.tickFurnaces = function (dtSec) {
    for (const dim of Object.keys(S.worlds)) {
      const w = S.worlds[dim];
      for (const [, be] of w.blockEntities) {
        if (!be || !['furnace', 'blast_furnace', 'smoker', 'campfire'].includes(be.type)) continue;
        tickOneFurnace(be, dtSec);
      }
    }
  };
  function tickOneFurnace(be, dtSec) {
    const inp = be.slots[0], fuel = be.slots[1];
    const speed = be.type === 'blast_furnace' ? 2 : be.type === 'smoker' ? 2 : 1;
    be.fuelT = be.fuelT || 0; be.smeltT = be.smeltT || 0;
    const ft = getFuelTime(fuel && fuel.item);
    if (ft > 0 && be.fuelT <= 0) {
      be.fuelT = ft * 20;
      if (fuel) { fuel.count--; if (fuel.count <= 0) be.slots[1] = null; }
    }
    const rec = furnaceRecipe(inp && inp.item, be.type);
    if (inp && rec && be.fuelT > 0) {
      be.smeltT += dtSec * 20 * speed;
      be.fuelT -= dtSec * 20;
      if (be.smeltT >= (rec.time || 10) * 20) {
        be.smeltT = 0;
        const outMax = WC.items[rec.out]?.stack || 64;
        const outSlot = be.slots[2];
        if (!outSlot) be.slots[2] = WC.itemStack(rec.out, rec.count || 1);
        else if (outSlot.item === rec.out && outSlot.count < outMax) outSlot.count = Math.min(outMax, outSlot.count + (rec.count || 1));
        inp.count--; if (inp.count <= 0) be.slots[0] = null;
        WC.addXp(1);
        grantSmeltAdv(rec.out);
        if (S.activeContainer === be && WC.ui) WC.ui.refreshScreen();
        if (Math.random() < 0.4) WC.sound.play('smelt_done');
      }
    } else { be.smeltT = Math.max(0, be.smeltT - dtSec * 40); }
  }
  function grantSmeltAdv(out) {
    if (out === 'iron_ingot' || out === 'copper_ingot') WC.grantAdv('iron');
    if (out === 'glass') {}
    WC.grantAdv('stone_tools');
  }
  function getFuelTime(item) {
    if (!item) return 0;
    const F = { coal: 80, charcoal: 80, lava_bucket: 100, blaze_rod: 120, coal_block: 720, stick: 5, dried_kelp_block: 20 };
    if (F[item] !== undefined) return F[item];
    if (item.endsWith('_planks') || item.endsWith('_log') || item.endsWith('_wood') || item.endsWith('_door')) return 15;
    if (item === 'crafting_table' || item === 'bookshelf' || item === 'oak_fence') return 15;
    return 0;
  }
  function furnaceRecipe(ing, kind) {
    if (!ing) return null;
    const wanted = kind === 'blast_furnace' ? 'blasting' : kind === 'smoker' ? 'smoking' : kind === 'campfire' ? 'campfire' : 'smelting';
    for (const r of WC.recipes) {
      if (r.kind !== wanted && !(wanted === 'smelting' && r.kind === 'smelting')) continue;
      if (r.ingredient === ing) return r;
      if (r.ingredient === 'log' && (ing.endsWith('_log') || ing.endsWith('_wood'))) return r;
      if (r.ingredient === 'raw_iron' && ing === 'deepslate_iron_ore') return Object.assign({}, r, { ingredient: ing });
    }
    // ores in deepslate variants map to same outputs
    if (ing.startsWith('deepslate_')) {
      const base = ing.slice(10);
      for (const r of WC.recipes) if (r.kind === wanted && r.ingredient === base + '_ore') return Object.assign({}, r, { ingredient: ing });
    }
    if (kind === 'blast_furnace' || kind === 'smoker') return furnaceRecipe(ing, 'furnace');
    return null;
  }
  WC.furnaceRecipe = furnaceRecipe;
  WC.getFuelTime = getFuelTime;

  // ---------- Crafting ----------
  // grid: array of 9 stacks (row-major 3x3; for 2x2 player grid only [0,1,3,4] used)
  WC.craftFromGrid = function (grid, small /* 2x2? */) {
    const n = small ? 2 : 3;
    const positions = [];
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) positions.push(r * 3 + c);
    const items = [];
    const counts = {};
    for (const gi of positions) {
      const s = grid[gi];
      if (s) { items.push(s); counts[s.item] = (counts[s.item] || 0) + 1; }
    }
    if (!items.length) return null;
    // build full-3x3 grid view for the normGrid matcher (nulls outside n)
    const full = new Array(9).fill(null);
    for (const gi of positions) full[gi] = grid[gi];
    const station = small ? null : 'crafting_table';
    const matches = WC.craftMatch(WC.recipes, full, items.map(i => i.item), station);
    if (!matches.length) return null;
    const rec = matches[0];
    if (!WC.canCraft(rec, counts)) return null;
    consumeRecipe(rec, grid, n);
    WC.invAdd(P, rec.out, rec.count || 1);
    S.recipesSeen.add(rec.out);
    WC.sound.play('craft');
    grantCraftAdv(rec.out);
    return rec;
  };
  function expandOne(name) {
    switch (name) {
      case 'planks': return Object.keys(WC.blocks).filter(n => n.endsWith('_planks'));
      case 'log': return Object.keys(WC.blocks).filter(n => n.endsWith('_log') || n.endsWith('_wood'));
      case 'slab_any': return Object.keys(WC.blocks).filter(n => n.endsWith('_slab'));
      case 'dye_any': return Object.keys(WC.items).filter(n => n.endsWith('_dye'));
      default: return [name];
    }
  }
  function cellAccepts(ch, rec, itemName) {
    const key = rec.key && rec.key[ch];
    const opts = key ? (Array.isArray(key) ? key : [key]) : [ch];
    return opts.some(o => expandOne(o).includes(itemName));
  }
  function consumeRecipe(rec, grid, n) {
    if (rec.kind === 'shaped') {
      // locate pattern within the n×n area
      const pr = rec.pattern.length, pc = rec.pattern[0].length;
      outer:
      for (let or_ = 0; or_ + pr <= n; or_++) for (let oc = 0; oc + pc <= n; oc++) {
        let ok = true;
        for (let r = 0; r < n && ok; r++) for (let c = 0; c < n && ok; c++) {
          const inPat = r >= or_ && r < or_ + pr && c >= oc && c < oc + pc;
          const s = grid[r * 3 + c];
          const ch = inPat ? rec.pattern[r - or_][c - oc] : ' ';
          if (ch === ' ') { if (s) ok = false; }
          else if (!s || !cellAccepts(ch, rec, s.item)) ok = false;
        }
        if (!ok) continue;
        for (let r = 0; r < pr; r++) for (let c = 0; c < pc; c++) {
          if (rec.pattern[r][c] === ' ') continue;
          const gi = (or_ + r) * 3 + (oc + c);
          const s = grid[gi];
          if (s) { s.count--; if (s.count <= 0) grid[gi] = null; }
        }
        return;
      }
      // fallback: consume any occupied cells
      for (const gi of allCells(n)) takeOne(grid, gi);
    } else {
      let left = rec.ingredients.length;
      for (let i = 0; i < grid.length && left > 0; i++) {
        if (grid[i]) { grid[i].count--; left--; if (grid[i].count <= 0) grid[i] = null; }
      }
    }
  }
  function allCells(n) {
    const out = [];
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) out.push(r * 3 + c);
    return out;
  }
  function takeOne(grid, gi) { const s = grid[gi]; if (s) { s.count--; if (s.count <= 0) grid[gi] = null; } }
  function grantCraftAdv(out) {
    if (out === 'crafting_table') WC.grantAdv('craft_table');
    if (out === 'wooden_pickaxe') WC.grantAdv('wood_pick');
    if (out === 'furnace' || out === 'cooked_beef') WC.grantAdv('stone_tools');
    if (out === 'iron_ingot') WC.grantAdv('iron');
    if (out === 'iron_sword') WC.grantAdv('iron_tools');
    if (out === 'enchanting_table') WC.grantAdv('enchant');
    if (out === 'ender_eye') WC.grantAdv('end');
    if (out === 'netherite_mace' || out === 'mace') WC.grantAdv('mace');
    if (out.endsWith('_spear')) WC.grantAdv('spear');
    if (out === 'diamond_chestplate') WC.grantAdv('full_diamond');
    if (out === 'beacon') WC.grantAdv('beacon');
    if (out === 'copper_sword' || out === 'copper_pickaxe') WC.grantAdv('copper');
    if (out === 'obsidian') WC.grantAdv('nether');
    if (out === 'elytra') WC.grantAdv('elytra');
  }
  WC.grantCraftAdv = grantCraftAdv;

  // quick-craft from recipe book using inventory directly
  WC.quickCraft = function (rec) {
    const counts = {};
    for (const s of P.inv) if (s) counts[s.item] = (counts[s.item] || 0) + s.count;
    const needList = recipeNeeds(rec);
    for (const opt of needList) {
      const names = Array.isArray(opt) ? opt : [opt];
      const resolved = resolveIngredient(names, counts);
      if (!resolved) return false;
      counts[resolved]--;
    }
    if (!WC.canCraft(rec, counts)) return false;
    for (const opt of needList) {
      const resolved = resolveIngredient(Array.isArray(opt) ? opt : [opt], {});
      // recompute availability live
      const cand = pickFromInv(Array.isArray(opt) ? opt : [opt]);
      if (cand) WC.invRemove(P, cand, 1);
    }
    WC.invAdd(P, rec.out, rec.count || 1);
    S.recipesSeen.add(rec.out);
    WC.sound.play('craft');
    grantCraftAdv(rec.out);
    return true;
  };
  function recipeNeeds(rec) {
    const list = [];
    if (rec.kind === 'shaped') { for (const row of rec.pattern) for (const ch of row) if (ch !== ' ') list.push(rec.key[ch] || ch); }
    else if (rec.kind === 'shapeless') list.push(...rec.ingredients);
    else if (rec.ingredient) list.push(rec.ingredient);
    else if (rec.kind === 'smithing') list.push(rec.base, rec.add);
    return list;
  }
  WC.recipeNeeds = recipeNeeds;
  function expandName(name) {
    switch (name) {
      case 'planks': return Object.keys(WC.blocks).filter(n => n.endsWith('_planks'));
      case 'log': return Object.keys(WC.blocks).filter(n => n.endsWith('_log') || n.endsWith('_wood'));
      case 'slab_any': return Object.keys(WC.blocks).filter(n => n.endsWith('_slab'));
      case 'dye_any': return Object.keys(WC.items).filter(n => n.endsWith('_dye'));
      default: return [name];
    }
  }
  function resolveIngredient(opts, counts) {
    for (const o of opts) for (const cand of expandName(o)) if ((counts[cand] || 0) > 0) return cand;
    return null;
  }
  function pickFromInv(opts) {
    for (const o of opts) {
      for (const cand of expandName(o)) {
        if (WC.invCount(P, cand) > 0) return cand;
      }
    }
    return null;
  }

  // ---------- Enchanting / Anvil ----------
  WC.doEnchant = function (container) {
    const item = container.slots[0], lapis = container.slots[1];
    if (!item) return;
    const levelCost = 10 + ((Math.random() * 20) | 0);
    if (P.level < 3 || !lapis || lapis.count < 1) { WC.log('Need ≥3 levels and lapis lazuli.', '#faa'); return; }
    P.level -= 3; lapis.count--; if (lapis.count <= 0) container.slots[1] = null;
    const app = (WC.items[item.item] && (WC.items[item.item].toolKind || WC.items[item.item].armorSlot || WC.items[item.item].slot)) || '';
    const pool = Object.keys(WC.enchantments).filter(e => WC.enchantments[e].app.some(a => a === app || item.item.includes(a)));
    const ench = pool.length ? pool[(Math.random() * pool.length) | 0] : 'unbreaking';
    item.enchants = item.enchants || {};
    item.enchants[ench] = Math.min(WC.enchantments[ench].max, 1 + ((Math.random() * 2) | 0));
    item.customName = ench.replace(/_/g, ' ') + ' ' + WC.items[item.item].display;
    container.slots[0] = null;
    WC.invAdd(P, item.item, 1, { durability: item.durability, enchants: item.enchants, customName: item.customName });
    WC.sound.play('level_up');
    WC.grantAdv('enchant');
    if (WC.ui) WC.ui.refreshScreen();
  };
  WC.doAnvil = function (container) {
    const a = container.slots[0], b = container.slots[1];
    if (!a) return;
    const cost = 2;
    if (P.level < cost) { WC.log('Not enough levels (' + cost + ').', '#faa'); return; }
    P.level -= cost;
    if (b && b.item === a.item) {
      a.durability = Math.min(WC.items[a.item].durability, (a.durability || 0) + Math.ceil(WC.items[a.item].durability * 0.3));
      container.slots[1] = null;
    } else if (b && b.item === 'enchanted_book') {
      a.enchants = Object.assign({}, a.enchants || {}, b.enchants || {});
      container.slots[1] = null;
    }
    container.slots[0] = null;
    WC.invAdd(P, a.item, 1, { durability: a.durability, enchants: a.enchants, customName: a.customName });
    WC.sound.play('anvil');
    if (WC.ui) WC.ui.refreshScreen();
  };

  // ---------- Trading ----------
  WC.doTrade = function (mob, trade) {
    if (WC.invCount(P, trade.give[0]) < trade.give[1]) { WC.log('Missing ' + trade.give[0] + '.', '#faa'); return; }
    WC.invRemove(P, trade.give[0], trade.give[1]);
    WC.invAdd(P, trade.get[0], trade.get[1]);
    WC.sound.play('trade');
    WC.grantAdv('village');
  };

  // ---------- Fishing ----------
  function startFishing() {
    if (P.fishing) { finishFishing(); return; }
    P.fishing = { t: 0, state: 'cast' };
    WC.sound.play('fish_hook');
  }
  function finishFishing() {
    const f = P.fishing; P.fishing = null;
    if (f && f.state === 'bite') {
      const loot = [['cod', 0.45], ['salmon', 0.25], ['tropical_fish', 0.1], ['pufferfish', 0.05], ['bone', 0.05], ['bow', 0.03], ['name_tag', 0.02], ['saddle', 0.02], ['lily_pad', 0.03]];
      let r = Math.random(), chosen = 'cod';
      for (const [it, p] of loot) { r -= p; if (r <= 0) { chosen = it; break; } }
      if (WC.items[chosen]) WC.spawnItemEntity(P.x + Math.sin(P.yaw) * 2, P.y + 1, P.z - Math.cos(P.yaw) * 2, WC.itemStack(chosen, 1));
      WC.log('Caught: ' + chosen.replace(/_/g, ' '), '#8fc');
      WC.sound.play('xp');
    }
  }
  WC.finishFishing = finishFishing;

  // ---------- Bow ----------
  WC.bowCharge = 0;
  WC.bowCharging = false;
  function shootBow() {
    const held = WC.heldItem(P);
    WC.bowCharging = false;
    if (!held || !WC.items[held.item] || WC.items[held.item].toolKind !== 'bow') { WC.bowCharge = 0; return; }
    const power = Math.min(1, WC.bowCharge / 1.1);
    WC.bowCharge = 0;
    if (power < 0.2) return;
    let arrow = null, ai = -1;
    for (let i = 0; i < 36; i++) if (P.inv[i] && P.inv[i].item === 'arrow') { arrow = P.inv[i]; ai = i; break; }
    if (!arrow && S.mode !== 'creative') return;
    if (S.mode !== 'creative' && arrow) { arrow.count--; if (arrow.count <= 0) P.inv[ai] = null; }
    const cy = Math.cos(P.yaw), sy = Math.sin(P.yaw), cp = Math.cos(P.pitch), sp = Math.sin(P.pitch);
    const pr = WC.spawnProjectile('arrow', P.x + sy * 0.3, P.y + EYE, P.z - cy * 0.3, sy * cp, sp, -cy * cp, { owner: 'player', dmg: 2 + power * 7, pierce: (held.enchants && held.enchants.piercing) || 0 });
    const boost = 0.6 + power * 1.1;
    pr.vx *= boost; pr.vy *= boost; pr.vz *= boost;
    WC.sound.play('bow');
    damageDurability(held, 1);
  }

  // ---------- Portals ----------
  let portalCooldown = 0;
  function tryLightNetherPortal() {
    const px = Math.floor(P.x), py = Math.floor(P.y), pz = Math.floor(P.z);
    for (let ox = -6; ox <= 6; ox++) for (let oz = -6; oz <= 6; oz++) {
      for (const big of [false, true]) {
        const w = big ? 5 : 4, h = big ? 6 : 5;
        let ok = true;
        for (let x = 0; x < w && ok; x++) for (let y = 0; y < h && ok; y++) {
          const edge = x === 0 || x === w - 1 || y === 0 || y === h - 1;
          const nm = WC.blockIds[WC.blockAt(px + ox + x, py - 1 + y, pz + oz)]?.name;
          if (edge && nm !== 'obsidian') ok = false;
          if (!edge && nm !== 'air' && nm !== 'crying_obsidian') ok = false;
        }
        if (ok) {
          for (let x = 1; x < w - 1; x++) for (let y = 1; y < h - 1; y++) WC.setBlock(px + ox + x, py - 1 + y, pz + oz, 'portal');
          WC.sound.play('portal');
          WC.log('The nether portal shimmers to life!', '#a5f');
          WC.grantAdv('nether');
          return true;
        }
      }
    }
    return false;
  }
  WC.lightNetherPortal = tryLightNetherPortal;

  function checkPortals(dt) {
    portalCooldown = Math.max(0, portalCooldown - dt);
    const feet = blockDefAt(Math.floor(P.x), Math.floor(P.y), Math.floor(P.z));
    const head = blockDefAt(Math.floor(P.x), Math.floor(P.y + 1), Math.floor(P.z));
    const name = (feet && feet.name) || (head && head.name);
    if (name === 'portal' && portalCooldown <= 0) travelTo(S.dim === 'nether' ? 'overworld' : 'nether');
    if (name === 'end_portal_block' && portalCooldown <= 0) travelTo(S.dim === 'end' ? 'overworld' : 'end');
    // ambient particles in portals
    if ((name === 'portal' || name === 'end_portal_block') && WC.game && WC.game.renderer && Math.random() < dt * 10) {
      WC.game.renderer.particles.portal(P.x + (Math.random() - .5) * 2, P.y + Math.random() * 2, P.z + (Math.random() - .5) * 2);
    }
  }
  function travelTo(dim) {
    portalCooldown = 3;
    S.dim = dim;
    WC.clearChunkMeshes();
    const w = WC.world(dim);
    if (dim === 'nether') {
      P.x = Math.floor(P.x / 8) + 0.5; P.z = Math.floor(P.z / 8) + 0.5;
      w.ensureChunk(P.x >> 4, P.z >> 4);
      P.y = 90;
      for (let y = 110; y > 4; y--) if (WC.isSolidAt(Math.floor(P.x), y, Math.floor(P.z), 'nether')) { P.y = y + 1.2; break; }
      WC.sound.play('portal_travel');
      WC.grantAdv('fortress');
      WC.log('Welcome to the Nether.', '#f85');
    } else if (dim === 'end') {
      P.x = 0.5; P.z = 0.5; P.y = 100;
      w.ensureChunk(0, 0);
      for (let y = 120; y > 30; y--) if (WC.isSolidAt(0, y, 0, 'end')) { P.y = y + 1.2; break; }
      WC.sound.play('end_portal');
      WC.grantAdv('end');
      WC.log('The End. Something circles far above...', '#cf8');
      if (!S.entities.some(e => e.type === 'ender_dragon')) setTimeout(() => { try { WC.spawnDragon(); } catch (err) { console.warn(err); } }, 3000);
    } else {
      P.x = Math.floor(P.x * 8) + 0.5; P.z = Math.floor(P.z * 8) + 0.5;
      w.ensureChunk(P.x >> 4, P.z >> 4);
      P.y = 120;
      for (let y = 200; y > 0; y--) if (WC.isSolidAt(Math.floor(P.x), y, Math.floor(P.z))) { P.y = y + 1.2; break; }
      WC.sound.play('portal_travel');
      WC.log('Back to the Overworld.', '#8cf');
    }
    P.vx = P.vy = P.vz = 0;
    if (WC.ui) WC.ui.onDimChange();
  }
  WC.travelTo = travelTo;

  // ---------- Chunk pipeline ----------
  WC.clearChunkMeshes = function () { if (WC.game && WC.game.renderer) WC.game.renderer.clearAllMeshes(); };
  WC.processDirtyChunks = function (budgetMs) {
    const w = WC.world();
    const pcx = Math.floor(P.x) >> 4, pcz = Math.floor(P.z) >> 4;
    const dist = Math.max(2, S.options.renderDist | 0);
    const t0 = performance.now();
    // ensure chunks exist near player (few per frame)
    const jobs = [];
    for (let dx = -dist; dx <= dist; dx++) for (let dz = -dist; dz <= dist; dz++) {
      if (dx * dx + dz * dz > (dist + 1) * (dist + 1)) continue;
      if (!w.getChunk(pcx + dx, pcz + dz)) jobs.push([pcx + dx, pcz + dz, dx * dx + dz * dz]);
    }
    jobs.sort((a, b) => a[2] - b[2]);
    for (const [cx, cz] of jobs.slice(0, 2)) {
      w.ensureChunk(cx, cz);
      if (performance.now() - t0 > budgetMs) break;
    }
    // build meshes for dirty chunks nearest first
    const dirty = [...w.meshes];
    dirty.sort((a, b) => {
      const [ax, az] = a.split(',').map(Number), [bx, bz] = b.split(',').map(Number);
      return ((ax - pcx) ** 2 + (az - pcz) ** 2) - ((bx - pcx) ** 2 + (bz - pcz) ** 2);
    });
    for (const k of dirty) {
      if (performance.now() - t0 > budgetMs) break;
      const [cx, cz] = k.split(',').map(Number);
      const c = w.getChunk(cx, cz);
      if (!c) { w.meshes.delete(k); continue; }
      const nbReady = [[1, 0], [-1, 0], [0, 1], [0, -1]].every(([dx, dz]) => w.getChunk(cx + dx, cz + dz));
      if (!nbReady) continue;
      const mesh = WC.buildMesh(w, c);
      if (WC.game && WC.game.renderer) WC.game.renderer.uploadChunk(S.dim, c, mesh);
      w.meshes.delete(k);
    }
    S.chunksLoaded = w.chunks.size;
    // unload far meshes occasionally
    if (S.frameTick % 90 === 0 && WC.game && WC.game.renderer) {
      const rd = (dist + 2) * (dist + 2);
      for (const key of [...WC.game.renderer.meshes.keys()]) {
        const ci = key.indexOf(':');
        const dim = key.slice(0, ci), ck = key.slice(ci + 1);
        const [cx, cz] = ck.split(',').map(Number);
        if ((cx - pcx) ** 2 + (cz - pcz) ** 2 > rd) WC.game.renderer.removeChunkMesh(dim, cx, cz);
      }
    }
  };

  // ---------- Main update ----------
  let stepDist = 0;
  const _origUpdate = null;
  function updatePlayer(dt) {
    if (S.screen || S.paused || S.chatOpen) { P.vx = P.vz = 0; if (!(mouseL || mouseR)) return; }
    // riding
    if (P.mount) {
      const m = P.mount;
      if (m.dead) { P.mount = null; }
      else {
        const md = WC.MOBS[m.type] || {};
        let mx = 0, mz = 0;
        if (keys['KeyW']) mz += 1; if (keys['KeyS']) mz -= 1;
        if (keys['KeyA']) mx -= 1; if (keys['KeyD']) mx += 1;
        const cy = Math.cos(P.yaw), sy = Math.sin(P.yaw);
        const spd = (md.spd || 2) * 1.3;
        m.vx = (mx * cy + mz * sy) * spd * dt * 6;
        m.vz = (mz * cy - mx * sy) * spd * dt * 6;
        if (keys['Space'] && m.onGround) m.vy = 0.42;
        P.x = m.x; P.z = m.z; P.y = m.y + (md.h || 1.5) * 0.8;
        P.vy = 0;
        if (mouseR) { P.mount = null; mouseR = false; }
        return;
      }
    }
    const spectator = S.mode === 'spectator';
    const creative = S.mode === 'creative';
    let mx = 0, mz = 0;
    if (keys['KeyW']) mz += 1; if (keys['KeyS']) mz -= 1;
    if (keys['KeyA']) mx -= 1; if (keys['KeyD']) mx += 1;
    const moving = !!(mx || mz);
    P.movingRecently = moving;
    P.sprinting = !!keys['ControlLeft'] && mz > 0 && !P.sneaking;
    P.sneaking = !!keys['ShiftLeft'] && !P.creativeFly;
    const cy = Math.cos(P.yaw), sy = Math.sin(P.yaw);
    let wishX = mx * cy + mz * sy, wishZ = mz * cy - mx * sy;
    const l = Math.hypot(wishX, wishZ) || 1; wishX /= l; wishZ /= l;

    let speed = 4.317;
    if (WC.hasEffect(P, 'speed')) speed *= 1 + 0.2 * (1 + ((P.effects.find(e => e.name === 'speed') || {}).amp || 0));
    if (WC.hasEffect(P, 'slowness')) speed *= 0.65;
    if (P.sprinting && P.food > 6) speed *= 1.31;
    if (P.sneaking) speed *= 0.3;
    if (P.inWater) speed *= 0.55;
    if (spectator) speed *= 2.2;
    if (creative && P.creativeFly) speed *= 2;

    const controllable = P.onGround || spectator || (creative && P.creativeFly) || P.inWater;
    const accel = controllable ? 14 : 4;
    P.vx += (wishX * speed - P.vx) * Math.min(1, accel * dt);
    P.vz += (wishZ * speed - P.vz) * Math.min(1, accel * dt);
    if (!moving && (P.onGround || spectator || (creative && P.creativeFly))) { P.vx *= Math.pow(0.00001, dt); P.vz *= Math.pow(0.00001, dt); }

    // vertical
    if (spectator) {
      P.vy = (keys['Space'] ? 9 : 0) + (keys['ShiftLeft'] ? -9 : 0);
    } else if (creative && P.creativeFly) {
      P.vy = (keys['Space'] ? 7 : 0) + (keys['ShiftLeft'] ? -7 : 0);
      if (!keys['Space'] && !keys['ShiftLeft']) P.vy *= Math.pow(0.0001, dt);
    } else if (P.inWater) {
      P.vy -= 9 * dt;
      P.vy = Math.max(P.vy, -2.2);
      if (keys['Space']) P.vy = 3.1;
    } else {
      P.vy -= 26 * dt;
      if (WC.hasEffect(P, 'levitation')) P.vy = Math.max(P.vy, 2);
      if (WC.hasEffect(P, 'slow_falling') && P.vy < -1.2) P.vy = -1.2;
      if (keys['Space'] && P.onGround) { P.vy = P.sneaking ? 3 : 8.6; P.exhaustion += P.sprinting ? 1 : 0.2; }
    }
    if (P.elytra && !P.onGround && P.vy < -0.8 && moving) P.vy = Math.max(P.vy, -1.4);
    P.vy = Math.max(P.vy, -50);

    // integrate with collision
    const wasAir = !P.onGround;
    P.onGround = false;
    const ny = P.y + P.vy * dt;
    if (!boxCollides(P.x, ny, P.z)) P.y = ny;
    else {
      if (P.vy < 0) {
        P.onGround = true;
        if (wasAir && P.fallStart !== null) {
          const fall = P.fallStart - P.y;
          if (fall > 3.5 && !creative && !spectator && !P.inWater) WC.damagePlayer(fall - 3, 'fall');
        }
        P.fallStart = null;
      }
      P.vy = 0;
    }
    if (P.vy > 0) P.fallStart = Math.max(P.fallStart === null ? P.y : P.fallStart, P.y);
    else if (P.vy < 0 && P.fallStart === null && !P.onGround) P.fallStart = P.y;
    if (P.onGround) P.fallStart = null;

    const nx = P.x + P.vx * dt;
    if (!boxCollides(nx, P.y + 0.001, P.z)) P.x = nx;
    else if (P.onGround && !boxCollides(nx, P.y + 1.02, P.z) && moving) { P.x = nx; P.y += 1.02; } // auto step-up
    else P.vx = 0;
    const nz = P.z + P.vz * dt;
    if (!boxCollides(P.x, P.y + 0.001, nz)) P.z = nz;
    else if (P.onGround && !boxCollides(P.x, P.y + 1.02, nz) && moving) { P.z = nz; P.y += 1.02; }
    else P.vz = 0;

    // sneak: don't walk off edges
    if (P.sneaking && P.onGround) {
      const probeX = P.x + Math.sign(P.vx) * 0.45, probeZ = P.z + Math.sign(P.vz) * 0.45;
      if (!solidAt(Math.floor(probeX), Math.floor(P.y - 0.1), Math.floor(P.z)) && Math.abs(P.vx) > 0.1) P.vx = 0, P.x = Math.floor(P.x * 100) / 100;
      if (!solidAt(Math.floor(P.x), Math.floor(P.y - 0.1), Math.floor(probeZ)) && Math.abs(P.vz) > 0.1) P.vz = 0, P.z = Math.floor(P.z * 100) / 100;
    }

    // footsteps & walk stat
    if (moving && (P.onGround || P.inWater)) {
      const moved = Math.hypot(P.vx, P.vz) * dt;
      stepDist += moved; P.walked += moved;
      if (stepDist > 2.4) {
        stepDist = 0;
        const under = blockDefAt(Math.floor(P.x), Math.floor(P.y - 0.2), Math.floor(P.z));
        WC.sound.play('step_' + ((under && under.walkSound) || 'stone'));
      }
    }
    // void / lava / water
    if (P.y < WC.Y_MIN - 4 && !spectator) WC.damagePlayer(4.5, 'void');
    P.inWater = liquidAt(Math.floor(P.x), Math.floor(P.y + 0.9), Math.floor(P.z));
    const inLava = blockDefAt(Math.floor(P.x), Math.floor(P.y + 0.2), Math.floor(P.z))?.name === 'lava';
    if (inLava && !WC.hasEffect(P, 'fire_resistance') && !creative && !spectator) {
      P.lavaT = (P.lavaT || 0) + dt;
      if (P.lavaT > 0.5) { P.lavaT = 0; WC.damagePlayer(4, 'lava'); }
    } else P.lavaT = 0;
    if (P.inWater && moving && Math.random() < dt * 1.5) WC.sound.play('swim');

    // target & breaking
    rayTrace(P.reach);
    if (mouseL && !S.screen) {
      if (WC.target.hit) {
        const def = WC.blockIds[WC.target.block];
        if (def && def.hardness >= 0) {
          if (!P.breaking || P.breaking.x !== WC.target.x || P.breaking.y !== WC.target.y || P.breaking.z !== WC.target.z) {
            P.breaking = { x: WC.target.x, y: WC.target.y, z: WC.target.z, progress: 0, total: breakTime(def, WC.heldItem(P)) };
          }
          P.breaking.progress += dt;
          if (Math.random() < dt * 6 && WC.game.renderer && def.color) {
            WC.game.renderer.particles.add(WC.target.x + 0.5 + (Math.random() - .5) * 0.8, WC.target.y + 0.5 + (Math.random() - .5) * 0.8, WC.target.z + 0.5 + (Math.random() - .5) * 0.8,
              0, 0.5, 0, 0.35, def.color.map(v => v / 255), 0.04);
          }
          if (P.breaking.progress >= P.breaking.total) {
            mineBlock(WC.target.x, WC.target.y, WC.target.z, def);
            P.breaking = null;
          }
        } else P.breaking = null;
      } else P.breaking = null;
    } else P.breaking = null;

    // bow charge
    if (WC.bowCharging) {
      WC.bowCharge += dt;
      if (!mouseR) shootBow();
    }
    // fishing
    if (P.fishing) {
      P.fishing.t += dt;
      if (P.fishing.state === 'cast' && P.fishing.t > 1.2 + Math.random() * 0.4) {
        if (Math.random() < dt * 0.9) { P.fishing.state = 'bite'; P.fishing.t = 0; WC.sound.play('fish_bite'); }
      }
      if (P.fishing.state === 'bite' && P.fishing.t > 0.5) { P.fishing.state = 'cast'; P.fishing.t = 0; }
    }
    checkPortals(dt);
    attackCooldown = Math.max(0, attackCooldown - dt);
    if (P.swingT > 0) P.swingT -= dt;

    // enderman provocation reset when not looking
    if (P._lookedAtEnderman) {
      let seeing = false;
      const dxn = sy * Math.cos(P.pitch), dyn = Math.sin(P.pitch), dzn = -cy * Math.cos(P.pitch);
      for (const e of S.entities) {
        if (e.type !== 'enderman' || e.dead) continue;
        const dx = e.x - P.x, dy = e.y + 1.5 - (P.y + EYE), dz = e.z - P.z;
        const dd = Math.hypot(dx, dy, dz);
        if (dd > 20) continue;
        if ((dx * dxn + dy * dyn + dz * dzn) / dd > 0.985) seeing = true;
      }
      if (!seeing) P._lookedAtEnderman = false;
    }
  }

  function mineBlock(x, y, z, def) {
    dropBlock(def, x, y, z);
    WC.setBlock(x, y, z, 'air');
    WC.sound.play('break_block');
    if (WC.game && WC.game.renderer) WC.game.renderer.particles.blockBreak(x, y, z, def);
    applyGravityAt(x, y + 1, z);
    const above = blockDefAt(x, y + 1, z);
    if (above && (above.render === 'cross' || above.render === 'torch' || above.name === 'vine' || above.replaceable)) {
      if (above.id !== 0 && above.name !== 'air') { dropBlock(above, x, y + 1, z); WC.setBlock(x, y + 1, z, 'air'); }
    }
    if (def.container) {
      const w = WC.world();
      const be = w.blockEntities.get(x + ',' + y + ',' + z);
      if (be) for (const s of be.slots) if (s) WC.spawnItemEntity(x + 0.5, y + 0.5, z + 0.5, s);
      w.blockEntities.delete(x + ',' + y + ',' + z);
      if (S.activeContainer === be) { S.activeContainer = null; if (WC.ui) WC.ui.closeScreen(); }
    }
    if (def.name === 'obsidian' && WC.hasEffect(P, 'night_vision')) {}
  }
  WC.mineBlock = mineBlock;

  // ---------- Controls binding ----------
  WC.bindControls = function (canvas) {
    document.addEventListener('keydown', (ev) => {
      if (S.chatOpen || (WC.ui && WC.ui.textInputActive && WC.ui.textInputActive())) return;
      keys[ev.code] = true;
      if (ev.code === 'Escape') {
        ev.preventDefault();
        if (S.screen) WC.ui.closeScreen();
        else if (!document.pointerLockElement) WC.ui.openScreen('pause');
        return;
      }
      if (S.screen) return;
      if (ev.code === 'KeyE') { WC.ui.openScreen('inventory'); ev.preventDefault(); }
      if (ev.code === 'KeyF') { WC.ui.openScreen('recipeBook'); }
      if (ev.code === 'KeyG') { WC.ui.openScreen('stats'); }
      if (ev.code === 'KeyK') { WC.ui.openScreen('advancements'); }
      if (ev.code === 'F3') { S.debug = !S.debug; ev.preventDefault(); }
      if (ev.code === 'F5') { S.thirdPerson = (S.thirdPerson + 1) % 3; ev.preventDefault(); }
      if (/^Digit[1-9]$/.test(ev.code)) { P.hotbar = +ev.code.slice(5) - 1; WC.sound.play('click'); }
      if (ev.code === 'KeyQ') dropHeld();
      if (ev.code === 'Space' && S.mode === 'creative') {
        const now = performance.now();
        if (now - (P.lastSpace || 0) < 300) P.creativeFly = !P.creativeFly;
        P.lastSpace = now;
      }
      if (ev.code === 'Enter' || ev.code === 'KeyT') { WC.ui.openChat(); ev.preventDefault(); }
    });
    document.addEventListener('keyup', (ev) => { keys[ev.code] = false; });
    canvas.addEventListener('mousedown', (ev) => {
      if (!locked) { WC.requestLock(); return; }
      if (S.screen) return;
      if (ev.button === 0) { mouseL = true; tryAttack(); }
      if (ev.button === 2) {
        mouseR = true;
        const held = WC.heldItem(P);
        const hd = held ? WC.items[held.item] : null;
        if (hd && hd.toolKind === 'bow') { WC.bowCharging = true; WC.bowCharge = 0; }
        else if (P.fishing) { finishFishing(); }
        else useHeld(ev.shiftKey);
      }
      if (ev.button === 1) { pickBlock(); ev.preventDefault(); }
    });
    document.addEventListener('mouseup', (ev) => {
      if (ev.button === 0) mouseL = false;
      if (ev.button === 2) mouseR = false;
    });
    document.addEventListener('contextmenu', (ev) => ev.preventDefault());
    document.addEventListener('wheel', (ev) => {
      if (S.screen) return;
      P.hotbar = (P.hotbar + (ev.deltaY > 0 ? 1 : -1) + 9) % 9;
      WC.sound.play('click');
    }, { passive: true });
    document.addEventListener('mousemove', (ev) => {
      if (!locked || S.screen) return;
      const sens = S.options.mouseSens;
      P.yaw += ev.movementX * sens;
      P.pitch = WC.clamp(P.pitch - ev.movementY * sens, -Math.PI / 2 + 0.01, Math.PI / 2 - 0.01);
    });
    document.addEventListener('pointerlockchange', () => {
      locked = document.pointerLockElement === canvas;
      if (!locked && !S.screen && !S.chatOpen) WC.ui.openScreen('pause');
    });
    WC.requestLock = function () {
      if (canvas.requestPointerLock) canvas.requestPointerLock();
      // kick audio on first gesture
      try { WC.sound.play('click'); if (!WC.musicStarted) { WC.musicStarted = true; WC.sound.startMusic(); } } catch (e) { }
    };
  };

  function dropHeld() {
    const held = WC.heldItem(P);
    if (!held) return;
    const cy = Math.cos(P.yaw), sy = Math.sin(P.yaw);
    const one = { ...held, count: 1 };
    const e = WC.spawnItemEntity(P.x + sy * 0.6, P.y + 1.3, P.z - cy * 0.6, one, { delay: 14 });
    e.vx = sy * 3; e.vy = 1.5; e.vz = -cy * 3;
    held.count--;
    if (held.count <= 0) P.inv[P.hotbar] = null;
  }
  function pickBlock() {
    if (!WC.target.hit) return;
    const def = WC.blockIds[WC.target.block];
    if (!def) return;
    for (let i = 0; i < 36; i++) if (P.inv[i] && P.inv[i].item === def.name) { if (i < 9) P.hotbar = i; return; }
    if (S.mode === 'creative' && WC.items[def.name]) WC.invAdd(P, def.name, 1);
  }

  WC.updatePlayer = updatePlayer;
})();
