// ============================================================
// WebCraft UI: HUD (health/hunger/armor/xp/hotbar/crosshair),
// inventory & crafting screens, container screens (chest,
// furnace, enchanting, anvil), recipe book, trading, signs,
// chat, pause/options, death screen, boss bar, toasts, debug.
// Pure DOM + canvas-drawn item icons from the texture atlas.
// ============================================================
(function () {
  'use strict';
  const WC = window.WC;

  // ---------- helpers ----------
  function el(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  }
  function $(id) { return document.getElementById(id); }

  const ui = WC.ui = {
    root: null, hud: null, screenEl: null, screenType: null,
    textInputActive() {
      const a = document.activeElement;
      return !!(a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA'));
    },
  };

  // ---------- build DOM skeleton ----------
  ui.init = function () {
    const root = ui.root = el('div', '');
    root.id = 'ui-root';
    Object.assign(root.style, { position: 'fixed', inset: '0', pointerEvents: 'none', fontFamily: "'Segoe UI',sans-serif", zIndex: '10' });
    document.body.appendChild(root);

    // HUD layer
    const hud = ui.hud = el('div', '');
    hud.id = 'hud';
    Object.assign(hud.style, { position: 'absolute', inset: '0' });
    root.appendChild(hud);

    hud.innerHTML = `
      <div id="crosshair" style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);font-size:22px;color:rgba(255,255,255,.85);text-shadow:0 0 2px #000;pointer-events:none;line-height:1">+</div>
      <div id="bossbar" style="display:none;position:absolute;top:38px;left:50%;transform:translateX(-50%);width:340px;text-align:center">
        <div id="bossname" style="color:#fff;font-size:13px;text-shadow:1px 1px 0 #000;margin-bottom:2px"></div>
        <div style="height:8px;background:#222;border:2px solid #000"><div id="bossfill" style="height:100%;background:linear-gradient(#f6c,#c3a);width:100%"></div></div>
      </div>
      <div id="vitals" style="position:absolute;bottom:64px;left:50%;transform:translateX(-50%);width:384px;display:flex;flex-direction:column;gap:1px">
        <div id="armorline" style="height:10px;display:flex;gap:0"></div>
        <div style="display:flex;justify-content:space-between">
          <div id="healline" style="height:10px;display:flex"></div>
          <div id="hungerline" style="height:10px;display:flex;flex-direction:row-reverse"></div>
        </div>
        <div id="airline" style="height:10px;display:flex;visibility:hidden"></div>
      </div>
      <div id="xpline" style="position:absolute;bottom:56px;left:50%;transform:translateX(-50%);width:364px;height:8px;background:#111;border:1px solid #000;display:none">
        <div id="xpfill" style="height:100%;background:linear-gradient(#7f7,#3c3);width:0%"></div>
        <div id="xplvl" style="position:absolute;left:50%;top:-14px;transform:translateX(-50%);color:#7f7;font-weight:bold;font-size:12px;text-shadow:1px 1px 0 #000"></div>
      </div>
      <div id="hotbar" style="position:absolute;bottom:8px;left:50%;transform:translateX(-50%);display:flex;gap:0;background:rgba(0,0,0,.35);border:2px solid #1a1a1a;pointer-events:auto"></div>
      <div id="toollabel" style="position:absolute;bottom:64px;left:50%;transform:translateX(-50%) translateY(46px);color:#fff;font-size:12px;text-shadow:1px 1px 0 #000;opacity:0;transition:opacity .3s"></div>
      <div id="chatlog" style="position:absolute;left:8px;bottom:80px;width:420px;max-height:170px;display:flex;flex-direction:column;justify-content:flex-end;font-size:12px;color:#eee;text-shadow:1px 1px 0 #000;overflow:hidden"></div>
      <div id="chatinputwrap" style="display:none;position:absolute;left:8px;bottom:60px;width:420px;pointer-events:auto">
        <input id="chatinput" style="width:100%;background:rgba(0,0,0,.7);border:1px solid #aaa;color:#fff;font-size:13px;padding:4px 6px;outline:none"/>
      </div>
      <div id="debuginfo" style="display:none;position:absolute;left:6px;top:6px;color:#fff;font-size:11px;text-shadow:1px 1px 0 #000;white-space:pre;font-family:monospace"></div>
      <div id="fpsbox" style="position:absolute;right:8px;top:8px;color:#fff;font-size:12px;text-shadow:1px 1px 0 #000"></div>
      <div id="totime" style="position:absolute;right:8px;top:26px;color:#fff;font-size:12px;text-shadow:1px 1px 0 #000"></div>
      <div id="damageflash" style="position:absolute;inset:0;background:radial-gradient(ellipse at center, transparent 40%, rgba(180,0,0,.55));opacity:0;transition:opacity .12s"></div>
      <div id="wateroverlay" style="position:absolute;inset:0;background:rgba(30,80,180,.35);display:none"></div>
      <div id="fireoverlay" style="position:absolute;inset:0;background:radial-gradient(ellipse at center bottom, rgba(255,120,0,.5), transparent 60%);display:none"></div>
      <div id="portaloverlay" style="position:absolute;inset:0;background:radial-gradient(ellipse at center, rgba(120,0,200,.45), rgba(40,0,80,.7));display:none;opacity:0;transition:opacity .6s"></div>
      <div id="toasts" style="position:absolute;right:8px;top:44px;display:flex;flex-direction:column;gap:6px"></div>
      <div id="screenhost" style="position:absolute;inset:0;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.55);pointer-events:auto"></div>
      <div id="deathscreen" style="display:none;position:absolute;inset:0;background:rgba(120,0,0,.55);align-items:center;justify-content:center;flex-direction:column;pointer-events:auto">
        <div style="color:#fff;font-size:34px;text-shadow:2px 2px 0 #000;margin-bottom:8px">You Died!</div>
        <div id="deathmsg" style="color:#fcc;font-size:14px;margin-bottom:22px;text-shadow:1px 1px 0 #000"></div>
        <button id="respawnbtn" class="mc-btn">Respawn</button>
      </div>
      <div id="titlefade" style="position:absolute;left:50%;top:22%;transform:translateX(-50%);color:#fff;font-size:26px;text-shadow:2px 2px 0 #000;opacity:0;transition:opacity 1s;letter-spacing:2px"></div>
    `;

    // hotbar slots
    const hb = $('hotbar');
    for (let i = 0; i < 9; i++) {
      const s = el('div', 'slot');
      s.dataset.hot = i;
      s.style.cssText = 'width:40px;height:40px;background:rgba(0,0,0,.5);border:2px solid #4a4a4a;position:relative;box-sizing:border-box;cursor:pointer';
      s.addEventListener('click', () => { WC.state.player.hotbar = i; WC.sound.play('click'); });
      hb.appendChild(s);
    }
    hb.addEventListener('contextmenu', ev => ev.preventDefault());

    // global keys for chat input handled in openChat
    ui.buildAtlasCanvas();
  };

  ui.buildAtlasCanvas = function () {
    try { WC.ensureAtlasCanvas(); } catch (e) { console.warn(e); }
  };

  // ---------- slot rendering ----------
  function iconFor(stack, px) {
    if (!stack) return null;
    try { return WC.itemIconCanvas(stack.item, px || 32); } catch (e) { return null; }
  }
  function paintSlot(slotEl, stack, opts) {
    opts = opts || {};
    slotEl.innerHTML = '';
    if (!stack) return;
    const ic = iconFor(stack, 32);
    if (ic) { ic.style.cssText = 'width:34px;height:34px;image-rendering:pixelated;position:absolute;left:3px;top:3px;pointer-events:none'; slotEl.appendChild(ic); }
    if (stack.count > 1) {
      const c = el('div', '', stack.count);
      c.style.cssText = 'position:absolute;right:2px;bottom:0;color:#fff;font-size:12px;font-weight:bold;text-shadow:1px 1px 0 #000;pointer-events:none';
      slotEl.appendChild(c);
    }
    const def = WC.items[stack.item];
    if (def && def.durability && stack.durability !== undefined && stack.durability < def.durability) {
      const frac = Math.max(0, stack.durability / def.durability);
      const bar = el('div', '');
      bar.style.cssText = `position:absolute;left:4px;right:4px;bottom:5px;height:3px;background:#000`;
      const fill = el('div', '');
      fill.style.cssText = `height:100%;width:${Math.round(frac * 100)}%;background:${frac > 0.5 ? '#4f4' : frac > 0.25 ? '#ff4' : '#f44'}`;
      bar.appendChild(fill); slotEl.appendChild(bar);
    }
    if (stack.enchants && Object.keys(stack.enchants).length) {
      slotEl.style.boxShadow = 'inset 0 0 8px 2px rgba(150,80,255,.75)';
    } else slotEl.style.boxShadow = '';
  }

  // ---------- tooltip ----------
  let tipEl = null;
  function showTip(stack, x, y) {
    hideTip();
    if (!stack) return;
    const def = WC.items[stack.item];
    if (!def) return;
    tipEl = el('div', '');
    tipEl.style.cssText = 'position:fixed;z-index:50;background:#100010;border:2px solid #2b0a3d;color:#fff;font-size:12px;padding:5px 8px;pointer-events:none;max-width:240px;box-shadow:2px 2px 0 rgba(0,0,0,.6)';
    let html = `<div style="color:${def.rare ? '#ffdd55' : '#fff'}">${esc(stack.customName || def.display)}</div>`;
    const lines = [];
    if (def.type === 'block') lines.push('Block');
    if (def.attack) lines.push(`Attack Damage: ${def.attack}`);
    if (def.speed && def.attack) lines.push(`Attack Speed: ${def.speed}`);
    if (def.toolKind === 'sword') lines.push('Weapon');
    if (def.tier >= 1 && def.toolKind) lines.push(['', 'Wood', 'Stone', 'Iron', 'Diamond', 'Netherite'][Math.min(5, def.tier)] + ' Tier');
    if (def.armor) lines.push(`Armor: ${def.armor}${def.armorToughness ? '  Toughness: ' + def.armorToughness : ''}`);
    if (def.food) lines.push(`Food: restores ${def.food} hunger`);
    if (def.durability) lines.push(`Durability: ${stack.durability}/${def.durability}`);
    if (stack.enchants) for (const [e, lv] of Object.entries(stack.enchants)) {
      const edef = WC.enchantments[e];
      lines.push(`<span style="color:#88f">${(edef && edef.display ? edef.display : e.replace(/_/g, ' '))} ${roman(lv)}</span>`);
    }
    if (def.description) lines.push(`<span style="color:#aaa;font-style:italic">${def.description}</span>`);
    html += lines.map(l => `<div style="color:#aaa;font-size:11px">${l}</div>`).join('');
    tipEl.innerHTML = html;
    document.body.appendChild(tipEl);
    moveTip(x, y);
  }
  function moveTip(x, y) {
    if (!tipEl) return;
    tipEl.style.left = (x + 14) + 'px';
    tipEl.style.top = (y + 10) + 'px';
  }
  function hideTip() { if (tipEl) { tipEl.remove(); tipEl = null; } }
  document.addEventListener('mousemove', ev => moveTip(ev.clientX, ev.clientY));
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
  function roman(n) { return ['', 'I', 'II', 'III', 'IV', 'V'][n] || n; }

  // ---------- cursor stack drag ----------
  ui.cursor = null;   // stack held by mouse while dragging
  function refreshCursor() {
    if (!ui.cursorEl) {
      ui.cursorEl = el('div', '');
      ui.cursorEl.style.cssText = 'position:fixed;z-index:60;pointer-events:none;width:34px;height:34px;display:none';
      document.body.appendChild(ui.cursorEl);
    }
    const c = ui.cursorEl;
    if (!ui.cursor) { c.style.display = 'none'; c.innerHTML = ''; return; }
    c.style.display = 'block';
    c.innerHTML = '';
    const ic = iconFor(ui.cursor, 32);
    if (ic) { ic.style.cssText = 'width:32px;height:32px;image-rendering:pixelated'; c.appendChild(ic); }
    if (ui.cursor.count > 1) {
      const t = el('div', '', ui.cursor.count);
      t.style.cssText = 'position:absolute;right:0;bottom:-2px;color:#fff;font-size:12px;font-weight:bold;text-shadow:1px 1px 0 #000';
      c.appendChild(t);
    }
  }
  document.addEventListener('mousemove', ev => {
    if (ui.cursorEl && ui.cursor) { ui.cursorEl.style.left = (ev.clientX - 16) + 'px'; ui.cursorEl.style.top = (ev.clientY - 16) + 'px'; }
  });
  document.addEventListener('mouseup', ev => {
    if (!ui.screenType && !ui.chatOpenFlag) return;
    if (ev.button !== 0) return;
    const target = document.elementFromPoint(ev.clientX, ev.clientY);
    const slot = target && target.closest ? target.closest('[data-slotkey]') : null;
    if (!slot) {
      // dropped outside: if cursor has stack, try give back to inventory or drop as entity
      if (ui.cursor) {
        const P = WC.state.player;
        if (!WC.invAdd(P, ui.cursor.item, ui.cursor.count, { durability: ui.cursor.durability, enchants: ui.cursor.enchants })) {
          WC.spawnItemEntity(P.x, P.y + 1, P.z, ui.cursor);
        }
        ui.cursor = null; refreshCursor(); ui.refreshScreen();
      }
      return;
    }
    handleSlotClick(slot, ev.shiftKey, false);
  });

  function slotGet(key) {
    const S = WC.state, P = S.player;
    if (key.startsWith('inv')) return { get: () => P.inv[+key.slice(3)], set: v => P.inv[+key.slice(3)] = v };
    if (key.startsWith('hot')) return { get: () => P.inv[+key.slice(3)], set: v => P.inv[+key.slice(3)] = v }; // hotbar is inv 0..8
    if (key.startsWith('arm')) return { get: () => P.armor[+key.slice(3)], set: v => P.armor[+key.slice(3)] = v };
    if (key.startsWith('off')) return { get: () => P.offhand, set: v => P.offhand = v };
    if (key.startsWith('con')) {
      const be = S.activeContainer;
      return { get: () => be && be.slots[+key.slice(3)], set: v => { if (be) be.slots[+key.slice(3)] = v; } };
    }
    if (key.startsWith('cra')) {
      ui.craftGrid = ui.craftGrid || new Array(9).fill(null);
      return { get: () => ui.craftGrid[+key.slice(3)], set: v => ui.craftGrid[+key.slice(3)] = v };
    }
    if (key === 'result') return { get: () => ui.craftResult, set: () => { } };
    return { get: () => null, set: () => { } };
  }
  function handleSlotClick(slotEl, shift, rightHalf) {
    const key = slotEl.dataset.slotkey;
    const acc = slotGet(key);
    const cur = ui.cursor, have = acc.get();
    if (key === 'result') {
      // craft take
      if (!have) return;
      if (!cur) { ui.cursor = { ...have }; }
      else if (cur.item === have.item) cur.count += have.count;
      else return;
      consumeCraftOnce();
      refreshCursor(); ui.refreshScreen(); updateHUD();
      return;
    }
    if (shift) {
      // quick move between inventory and container
      const isInv = key.startsWith('inv') || key.startsWith('hot');
      const S = WC.state;
      if (isInv && S.activeContainer) {
        if (have) {
          const to = firstEmpty(S.activeContainer.slots);
          if (to >= 0) { S.activeContainer.slots[to] = have; acc.set(null); }
        }
      } else if (!isInv && have) {
        const P = S.player;
        if (have) {
          const dest = findMergeOrEmpty(P.inv, have);
          if (dest >= 0) {
            if (P.inv[dest]) P.inv[dest].count += have.count; else P.inv[dest] = have;
            acc.set(null);
          }
        }
      } else if (key.startsWith('inv') && have) {
        // move between main and hotbar already same array; quick-move armor/offhand
      }
      ui.refreshScreen(); updateHUD();
      return;
    }
    if (!cur) {
      if (!have) return;
      if (rightHalf && have.count > 1) {
        ui.cursor = { ...have, count: Math.ceil(have.count / 2) };
        have.count -= ui.cursor.count;
        if (have.count <= 0) acc.set(null);
      } else { ui.cursor = have; acc.set(null); }
    } else {
      if (!have) { acc.set(cur); ui.cursor = null; }
      else if (have.item === cur.item) {
        const max = (WC.items[cur.item] && WC.items[cur.item].stack) || 64;
        const add = Math.min(max - have.count, cur.count);
        have.count += add; cur.count -= add;
        if (cur.count <= 0) ui.cursor = null;
      } else { acc.set(cur); ui.cursor = have; }
    }
    refreshCursor(); ui.refreshScreen(); updateHUD();
  }
  function firstEmpty(slots) { for (let i = 0; i < slots.length; i++) if (!slots[i]) return i; return -1; }
  function findMergeOrEmpty(arr, stack) {
    const max = (WC.items[stack.item] && WC.items[stack.item].stack) || 64;
    for (let i = 0; i < arr.length; i++) if (arr[i] && arr[i].item === stack.item && arr[i].count < max && !arr[i].customName) return i;
    for (let i = 0; i < arr.length; i++) if (!arr[i]) return i;
    return -1;
  }

  // ---------- generic slot element ----------
  function mkSlot(key, size, bg) {
    const s = el('div', '');
    s.dataset.slotkey = key;
    s.style.cssText = `width:${size}px;height:${size}px;background:${bg || 'rgba(80,80,80,.65)'};border:2px solid #2a2a2a;box-shadow:inset 1px 1px 0 #1a1a1a, inset -1px -1px 0 #6a6a6a;position:relative;box-sizing:border-box;cursor:pointer;display:inline-block`;
    s.addEventListener('mousedown', ev => {
      ev.preventDefault(); ev.stopPropagation();
      if (ev.button === 2) { handleSlotClick(s, ev.shiftKey, true); }
      else if (ev.button === 0) { /* handled on mouseup for drag feel */ }
    });
    s.addEventListener('mouseenter', ev => {
      const st = slotGet(key).get();
      if (st && !ui.cursor) showTip(st, ev.clientX, ev.clientY);
    });
    s.addEventListener('mouseleave', hideTip);
    return s;
  }
  function paintInto(container, slotsArr, prefix) {
    const kids = container.querySelectorAll('[data-slotkey]');
    kids.forEach(k => {
      const idx = +k.dataset.slotkey.replace(prefix, '');
      paintSlot(k, slotsArr[idx]);
    });
  }

  // ---------- screens ----------
  ui.openScreen = function (type, data) {
    const S = WC.state;
    if (S.player.health <= 0 && type !== 'pause' && type !== 'death') return;
    document.exitPointerLock && document.exitPointerLock();
    S.screen = type;
    ui.screenType = type;
    const host = $('screenhost');
    host.style.display = 'flex';
    host.innerHTML = '';
    const panel = el('div', '');
    panel.style.cssText = 'background:#c6c6c6;border:3px solid #565656;box-shadow:4px 4px 0 rgba(0,0,0,.4);padding:14px;color:#1a1a1a;position:relative;image-rendering:pixelated;max-height:92vh;overflow:auto';
    host.appendChild(panel);
    ui.currentPanel = panel;

    if (type === 'pause') buildPause(panel);
    else if (type === 'options') buildOptions(panel);
    else if (type === 'inventory') buildInventory(panel, false);
    else if (type === 'crafting') buildInventory(panel, true);
    else if (type === 'recipeBook') buildRecipeBook(panel);
    else if (type === 'stats') buildStats(panel);
    else if (type === 'advancements') buildAdvancements(panel);
    else if (type === 'death') buildDeath(panel);
    else if (type === 'sign') buildSign(panel, data);
    else if (type === 'trade') { ui.tradeMob = data; buildTrade(panel, data); }
    else if (type === 'enchanting') buildEnchanting(panel, data);
    else if (type === 'anvil') buildAnvil(panel, data);
    else if (type === 'chest') buildContainerGrid(panel, data, 27);
    else if (type === 'double_chest') buildContainerGrid(panel, data, 54);
    else if (type === 'furnace' || type === 'blast_furnace' || type === 'smoker' || type === 'campfire') buildFurnace(panel, data, type);
    else buildInventory(panel, true);

    ui.refreshScreen();
  };

  ui.closeScreen = function () {
    const S = WC.state;
    S.screen = null; ui.screenType = null;
    $('screenhost').style.display = 'none';
    $('screenhost').innerHTML = '';
    $('deathscreen').style.display = 'none';
    // return cursor & crafting grid items to inventory
    if (ui.cursor) { WC.invAdd(S.player, ui.cursor.item, ui.cursor.count, { durability: ui.cursor.durability, enchants: ui.cursor.enchants }); ui.cursor = null; refreshCursor(); }
    if (ui.craftGrid) for (let i = 0; i < 9; i++) { const s = ui.craftGrid[i]; if (s) { WC.invAdd(S.player, s.item, s.count); ui.craftGrid[i] = null; } }
    ui.craftResult = null;
    S.activeContainer = null;
    hideTip();
    if (WC.requestLock && !S.paused) WC.requestLock();
  };

  ui.refreshScreen = function () {
    const panel = ui.currentPanel;
    if (!panel || !ui.screenType) return;
    const S = WC.state, P = S.player;
    // repaint all slots present
    panel.querySelectorAll('[data-slotkey]').forEach(k => {
      const acc = slotGet(k.dataset.slotkey);
      paintSlot(k, acc.get());
    });
    // live result preview
    if (ui.craftPreviewFn) ui.craftPreviewFn();
    if (ui.tradeListEl) { /* static */ }
  };

  ui.onDimChange = function () {
    const t = $('titlefade');
    if (!t) return;
    const names = { overworld: 'Overworld', nether: 'The Nether', end: 'The End' };
    t.textContent = names[WC.state.dim] || '';
    t.style.opacity = 1;
    setTimeout(() => { t.style.opacity = 0; }, 2200);
  };

  // ---------- Inventory / Crafting ----------
  function buildInventory(panel, withCrafting) {
    panel.innerHTML = `<div style="font-size:15px;font-weight:bold;margin-bottom:8px">${withCrafting ? 'Crafting' : 'Inventory'} <span style="float:right;cursor:pointer;font-weight:normal" onclick="WC.ui.closeScreen()">✕</span></div>`;
    const wrap = el('div', '');
    wrap.style.cssText = 'display:flex;gap:22px;align-items:flex-start';
    panel.appendChild(wrap);

    // left column: armor + crafting
    const left = el('div', '');
    wrap.appendChild(left);
    const armTitle = el('div', '', 'Armor');
    armTitle.style.fontSize = '12px'; armTitle.style.marginBottom = '4px';
    left.appendChild(armTitle);
    const ARM_SLOTS = [['arm0', 'head'], ['arm1', 'chest'], ['arm2', 'legs'], ['arm3', 'feet']];
    const armRow = el('div', '');
    armRow.style.cssText = 'display:flex;flex-direction:column;gap:4px;margin-bottom:10px';
    for (const [key, label] of ARM_SLOTS) {
      const row = el('div', '');
      row.style.cssText = 'display:flex;align-items:center;gap:6px';
      row.appendChild(el('div', '', `<span style="font-size:11px;width:38px;color:#555">${label}</span>`));
      row.appendChild(mkSlot(key, 40));
      armRow.appendChild(row);
    }
    left.appendChild(armRow);

    if (withCrafting || true) {
      const ct = el('div', '', 'Crafting');
      ct.style.cssText = 'font-size:12px;margin:4px 0';
      left.appendChild(ct);
      const gridWrap = el('div', '');
      gridWrap.id = 'craftgridwrap';
      left.appendChild(gridWrap);
      renderCraftGrid(gridWrap, withCrafting ? 3 : 2, withCrafting ? 'crafting_table' : 'player');
    }

    // right column: main inv + hotbar + offhand
    const right = el('div', '');
    wrap.appendChild(right);
    const main = el('div', '');
    main.style.cssText = 'display:grid;grid-template-columns:repeat(9,40px);gap:4px;margin-bottom:14px';
    for (let r = 0; r < 3; r++) for (let c = 0; c < 9; c++) main.appendChild(mkSlot('inv' + (r * 9 + c + 9), 40));
    right.appendChild(main);
    const bot = el('div', '');
    bot.style.cssText = 'display:flex;gap:8px;align-items:flex-end';
    const hot = el('div', '');
    hot.style.cssText = 'display:grid;grid-template-columns:repeat(9,40px);gap:4px';
    for (let i = 0; i < 9; i++) hot.appendChild(mkSlot('inv' + i, 40));
    bot.appendChild(hot);
    const off = el('div', '');
    off.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:2px';
    off.appendChild(mkSlot('off0', 40));
    off.appendChild(el('div', '', '<span style="font-size:10px;color:#555">Offhand</span>'));
    bot.appendChild(off);
    right.appendChild(bot);
  }

  function renderCraftGrid(wrap, n, station) {
    ui.craftStation = station;
    wrap.innerHTML = '';
    const g = el('div', '');
    g.style.cssText = `display:grid;grid-template-columns:repeat(${n},40px);gap:4px`;
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) g.appendChild(mkSlot('cra' + (r * 3 + c), 40));
    const out = el('div', '');
    out.style.cssText = 'display:flex;align-items:center;gap:10px;margin-top:8px';
    out.appendChild(el('div', '', '<span style="font-size:18px">→</span>'));
    const res = mkSlot('result', 44, 'rgba(120,120,120,.8)');
    out.appendChild(res);
    const small = n === 2;
    ui.craftPreviewFn = function () {
      const grid = ui.craftGrid || new Array(9).fill(null);
      const items = [], counts = {};
      for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
        const s = grid[r * 3 + c];
        if (s) { items.push(s.item); counts[s.item] = (counts[s.item] || 0) + 1; }
      }
      let rec = null;
      if (items.length) {
        const full = new Array(9).fill(null);
        for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) full[r * 3 + c] = grid[r * 3 + c];
        const m = WC.craftMatch(WC.recipes, full, items, small ? null : 'crafting_table');
        rec = m.find(r => WC.canCraft(r, counts)) || null;
      }
      ui.craftResult = rec ? WC.itemStack(rec.out, rec.count || 1) : null;
      paintSlot(res, ui.craftResult);
      ui.craftRec = rec;
    };
    const btnRow = el('div', '');
    btnRow.style.cssText = 'display:flex;gap:6px;margin-top:6px';
    const clr = el('button', 'mc-btn', 'Clear');
    clr.onclick = () => {
      for (let i = 0; i < 9; i++) { const s = ui.craftGrid[i]; if (s) { WC.invAdd(WC.state.player, s.item, s.count); ui.craftGrid[i] = null; } }
      ui.craftPreviewFn(); ui.refreshScreen();
    };
    btnRow.appendChild(clr);
    const mk = el('button', 'mc-btn', 'All recipes → (F)');
    mk.onclick = () => { ui.closeScreen(); ui.openScreen('recipeBook'); };
    btnRow.appendChild(mk);
    const box = el('div', '');
    box.style.cssText = 'display:flex;gap:14px;align-items:flex-end';
    box.appendChild(g); box.appendChild(out);
    wrap.appendChild(box);
    wrap.appendChild(btnRow);
    ui.craftPreviewFn();
  }

  function consumeCraftOnce() {
    const rec = ui.craftRec;
    if (!rec) return;
    const grid = ui.craftGrid;
    const n = ui.craftStation === 'crafting_table' ? 3 : 2;
    // remove one of each ingredient cell used
    if (rec.kind === 'shaped') {
      let removed = false;
      outer:
      for (let or_ = 0; or_ + rec.pattern.length <= n && !removed; or_++)
        for (let oc = 0; oc + rec.pattern[0].length <= n && !removed; oc++) {
          let ok = true;
          for (let r = 0; r < n && ok; r++) for (let c = 0; c < n && ok; c++) {
            const inPat = r >= or_ && r < or_ + rec.pattern.length && c >= oc && c < oc + rec.pattern[0].length;
            const s = grid[r * 3 + c];
            const ch = inPat ? rec.pattern[r - or_][c - oc] : ' ';
            if (ch === ' ') { if (s) ok = false; }
            else if (!s) ok = false;
          }
          if (!ok) continue;
          for (let r = 0; r < rec.pattern.length; r++) for (let c = 0; c < rec.pattern[0].length; c++) {
            if (rec.pattern[r][c] === ' ') continue;
            const gi = (or_ + r) * 3 + (oc + c);
            const s = grid[gi];
            if (s) { s.count--; if (s.count <= 0) grid[gi] = null; }
          }
          removed = true;
        }
      if (!removed) for (let i = 0; i < 9; i++) if (grid[i]) { grid[i].count--; if (grid[i].count <= 0) grid[i] = null; break; }
    } else {
      let left = rec.ingredients.length;
      for (let i = 0; i < 9 && left > 0; i++) if (grid[i]) { grid[i].count--; left--; if (grid[i].count <= 0) grid[i] = null; }
    }
    WC.sound.play('craft');
    if (WC.grantCraftAdv) WC.grantCraftAdv(rec.out);
    WC.state.recipesSeen.add(rec.out);
    ui.craftPreviewFn();
  }

  // ---------- Containers ----------
  function buildContainerGrid(panel, be, count) {
    panel.innerHTML = `<div style="font-size:15px;font-weight:bold;margin-bottom:8px">${esc((be && be.customName) || (be && be.type ? be.type.replace(/_/g, ' ') : 'Chest')).replace(/\b\w/g, c => c.toUpperCase())} <span style="float:right;cursor:pointer;font-weight:normal" onclick="WC.ui.closeScreen()">✕</span></div>`;
    const rows = Math.ceil(count / 9);
    const top = el('div', '');
    top.style.cssText = `display:grid;grid-template-columns:repeat(9,40px);gap:4px;margin-bottom:16px`;
    for (let r = 0; r < rows; r++) for (let c = 0; c < 9; c++) top.appendChild(mkSlot('con' + (r * 9 + c), 40));
    panel.appendChild(top);
    buildInventoryBodyOnly(panel);
  }
  function buildInventoryBodyOnly(panel) {
    const S = WC.state;
    const title = el('div', '', 'Inventory');
    title.style.cssText = 'font-size:12px;margin-bottom:4px';
    panel.appendChild(title);
    const main = el('div', '');
    main.style.cssText = 'display:grid;grid-template-columns:repeat(9,40px);gap:4px;margin-bottom:10px';
    for (let r = 0; r < 3; r++) for (let c = 0; c < 9; c++) main.appendChild(mkSlot('inv' + (r * 9 + c + 9), 40));
    panel.appendChild(main);
    const hot = el('div', '');
    hot.style.cssText = 'display:grid;grid-template-columns:repeat(9,40px);gap:4px';
    for (let i = 0; i < 9; i++) hot.appendChild(mkSlot('inv' + i, 40));
    panel.appendChild(hot);
  }

  // ---------- Furnace ----------
  function buildFurnace(panel, be, kind) {
    const titles = { furnace: 'Furnace', blast_furnace: 'Blast Furnace', smoker: 'Smoker', campfire: 'Campfire' };
    panel.innerHTML = `<div style="font-size:15px;font-weight:bold;margin-bottom:10px">${titles[kind] || 'Furnace'} <span style="float:right;cursor:pointer;font-weight:normal" onclick="WC.ui.closeScreen()">✕</span></div>`;
    const mid = el('div', '');
    mid.style.cssText = 'display:flex;gap:10px;align-items:center;justify-content:center;margin-bottom:14px';
    const colIn = el('div', ''); colIn.style.cssText = 'display:flex;flex-direction:column;gap:6px;align-items:center';
    colIn.appendChild(mkSlot('con0', 40));
    const flame = el('div', ''); flame.id = 'furnflame'; flame.style.cssText = 'font-size:20px;height:24px'; flame.textContent = '🔥';
    colIn.appendChild(flame);
    colIn.appendChild(mkSlot('con1', 40));
    mid.appendChild(colIn);
    mid.appendChild(el('div', '', '<span style="font-size:22px">➜</span>'));
    const ar = el('div', ''); ar.style.cssText = 'position:relative;width:40px;height:40px';
    const prog = el('div', ''); prog.id = 'furnprog'; prog.style.cssText = 'position:absolute;inset:0;border:2px solid #555;background:rgba(0,0,0,.2)';
    const progFill = el('div', ''); progFill.id = 'furnprogfill'; progFill.style.cssText = 'position:absolute;left:0;bottom:0;height:100%;width:0%;background:#fd5';
    prog.appendChild(progFill);
    ar.appendChild(mkSlot('con2', 40)); ar.appendChild(prog);
    mid.appendChild(ar);
    panel.appendChild(mid);
    buildInventoryBodyOnly(panel);
    ui.furnaceTick = function () {
      const b = WC.state.activeContainer;
      if (!b || b !== be) return;
      const burnMax = 10, progressMax = 10;
      const burn = Math.max(0, Math.min(burnMax, (b.burnTime || 0)));
      const progv = Math.max(0, Math.min(progressMax, (b.progress || 0)));
      flame.style.opacity = burn > 0 ? 1 : 0.15;
      progFill.style.width = Math.round(progv / progressMax * 100) + '%';
    };
  }

  // ---------- Enchanting / Anvil ----------
  function buildEnchanting(panel, be) {
    panel.innerHTML = `<div style="font-size:15px;font-weight:bold;margin-bottom:10px">Enchanting Table <span style="float:right;cursor:pointer;font-weight:normal" onclick="WC.ui.closeScreen()">✕</span></div>`;
    const row = el('div', '');
    row.style.cssText = 'display:flex;gap:10px;align-items:center;justify-content:center;margin-bottom:12px';
    row.appendChild(mkSlot('con0', 48));
    row.appendChild(el('div', '', '<span style="font-size:22px">+</span>'));
    row.appendChild(mkSlot('con1', 48));
    panel.appendChild(row);
    const info = el('div', '', 'Cost: 3 levels + 1 lapis lazuli. Random enchantment applied.');
    info.style.cssText = 'font-size:12px;color:#555;text-align:center;margin-bottom:10px';
    panel.appendChild(info);
    const btn = el('button', 'mc-btn', '✨ Enchant');
    btn.style.cssText = 'display:block;margin:0 auto 14px';
    btn.onclick = () => { WC.doEnchant(WC.state.activeContainer); };
    panel.appendChild(btn);
    buildInventoryBodyOnly(panel);
  }
  function buildAnvil(panel, be) {
    panel.innerHTML = `<div style="font-size:15px;font-weight:bold;margin-bottom:10px">Anvil <span style="float:right;cursor:pointer;font-weight:normal" onclick="WC.ui.closeScreen()">✕</span></div>`;
    const row = el('div', '');
    row.style.cssText = 'display:flex;gap:8px;align-items:center;justify-content:center;margin-bottom:6px';
    row.appendChild(mkSlot('con0', 48));
    row.appendChild(el('div', '', '<span style="font-size:20px">+</span>'));
    row.appendChild(mkSlot('con1', 48));
    row.appendChild(el('div', '', '<span style="font-size:20px">=</span>'));
    row.appendChild(mkSlot('con2', 48));
    panel.appendChild(row);
    const nameIn = el('input', '');
    nameIn.placeholder = 'Rename item (optional)';
    nameIn.style.cssText = 'display:block;margin:6px auto;background:#fff;border:2px solid #555;padding:4px;font-size:12px';
    nameIn.addEventListener('keydown', ev => ev.stopPropagation());
    nameIn.onchange = () => { const a = be.slots[0]; if (a) a.customName = nameIn.value || null; };
    panel.appendChild(nameIn);
    const info = el('div', '', 'Combine same items to repair, or apply enchanted books. Cost: 2 levels.');
    info.style.cssText = 'font-size:12px;color:#555;text-align:center;margin-bottom:10px';
    panel.appendChild(info);
    const btn = el('button', 'mc-btn', '⚒ Apply (2 lvl)');
    btn.style.cssText = 'display:block;margin:0 auto 14px';
    btn.onclick = () => { WC.doAnvil(WC.state.activeContainer); };
    panel.appendChild(btn);
    buildInventoryBodyOnly(panel);
  }

  // ---------- Trade ----------
  function genTrades(mob) {
    if (mob._trades) return mob._trades;
    const job = (WC.MOBS[mob.type] && WC.MOBS[mob.type].job) || (mob.type === 'wandering_trader' ? 'wandering' : 'nitwit');
    const pools = {
      farmer: [[['emerald', 1], ['bread', 1]], [['wheat', 20], ['emerald', 1]], [['carrot', 15], ['emerald', 1]], [['emerald', 3], ['golden_carrot', 1]]],
      librarian: [[['book', 1], ['emerald', 1]], [['emerald', 5], ['enchanted_book', 1]], [['paper', 12], ['emerald', 1]]],
      toolsmith: [[['coal', 15], ['emerald', 1]], [['emerald', 6], ['iron_pickaxe', 1]], [['emerald', 4], ['stone_axe', 1]]],
      weaponsmith: [[['emerald', 7], ['iron_sword', 1]], [['charcoal', 15], ['emerald', 1]], [['emerald', 8], ['iron_axe', 1]]],
      armorer: [[['emerald', 8], ['iron_chestplate', 1]], [['emerald', 5], ['chainmail_helmet', 1]], [['coal_block', 1], ['emerald', 1]]],
      cleric: [[['rotten_flesh', 32], ['emerald', 1]], [['emerald', 2], ['ender_pearl', 1]], [['emerald', 3], ['redstone', 1]]],
      fisherman: [[['cod', 10], ['emerald', 1]], [['emerald', 3], ['bucket_cod', 1]], [['string', 16], ['emerald', 1]]],
      fletcher: [[['stick', 32], ['emerald', 1]], [['arrow', 12], ['emerald', 1]], [['emerald', 2], ['bow', 1]]],
      butcher: [[['mutton', 14], ['emerald', 1]], [['emerald', 6], ['cooked_mutton', 3]], [['rabbit_hide', 10], ['emerald', 1]]],
      leatherworker: [[['leather', 9], ['emerald', 1]], [['emerald', 5], ['leather_boots', 1]], [['flint', 12], ['emerald', 1]]],
      wandering: [[['emerald', 1], ['packed_ice', 3]], [['emerald', 3], ['melon_slice', 4]], [['emerald', 8], ['glow_berries', 8]], [['emerald', 5], ['potato', 6]]],
      nitwit: [],
    };
    mob._trades = pools[job] || pools.nitwit;
    return mob._trades;
  }
  function buildTrade(panel, mob) {
    panel.innerHTML = `<div style="font-size:15px;font-weight:bold;margin-bottom:10px">Trading with ${esc((WC.MOBS[mob.type] && WC.MOBS[mob.type].display) || mob.type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()))} <span style="float:right;cursor:pointer;font-weight:normal" onclick="WC.ui.closeScreen()">✕</span></div>`;
    const list = el('div', '');
    list.style.cssText = 'display:flex;flex-direction:column;gap:8px;margin-bottom:14px';
    const trades = genTrades(mob);
    if (!trades.length) list.appendChild(el('div', '', '<i>This villager has no trades.</i>'));
    for (const tr of trades) {
      const row = el('div', '');
      row.style.cssText = 'display:flex;align-items:center;gap:8px;background:rgba(0,0,0,.08);padding:6px;border-radius:2px';
      const gIc = iconFor({ item: tr[0][0] }, 32), rIc = iconFor({ item: tr[1][0] }, 32);
      if (gIc) { gIc.style.cssText = 'width:32px;height:32px;image-rendering:pixelated'; row.appendChild(gIc); }
      row.appendChild(el('div', '', `${tr[0][1]}×`));
      row.appendChild(el('div', '', '<span style="font-size:18px">→</span>'));
      if (rIc) { rIc.style.cssText = 'width:32px;height:32px;image-rendering:pixelated'; row.appendChild(rIc); }
      row.appendChild(el('div', '', `${tr[1][1]}× ${(WC.items[tr[1][0]] && WC.items[tr[1][0]].display) || tr[1][0]}`));
      const buy = el('button', 'mc-btn', 'Buy');
      buy.style.marginLeft = 'auto';
      buy.onclick = () => { WC.doTrade(mob, { give: tr[0], get: tr[1] }); ui.refreshScreen(); updateHUD(); };
      row.appendChild(buy);
      list.appendChild(row);
    }
    panel.appendChild(list);
    buildInventoryBodyOnly(panel);
  }

  // ---------- Sign ----------
  function buildSign(panel, pos) {
    panel.innerHTML = `<div style="font-size:15px;font-weight:bold;margin-bottom:10px">Edit Sign <span style="float:right;cursor:pointer;font-weight:normal" onclick="WC.ui.closeScreen()">✕</span></div>`;
    const w = WC.world();
    const be = w.blockEntities.get(pos.x + ',' + pos.y + ',' + pos.z) || { type: 'sign', text: ['', '', '', ''] };
    const card = el('div', '');
    card.style.cssText = 'background:#9c7f4e;border:3px solid #6b4a2b;padding:10px;width:220px;margin:0 auto 12px';
    const inputs = [];
    for (let i = 0; i < 4; i++) {
      const inp = el('input', '');
      inp.value = be.text ? be.text[i] || '' : '';
      inp.maxLength = 18;
      inp.style.cssText = 'display:block;width:100%;margin:4px 0;text-align:center;background:transparent;border:none;border-bottom:1px dashed rgba(0,0,0,.3);color:#222;font-size:14px;outline:none';
      inp.addEventListener('keydown', ev => ev.stopPropagation());
      card.appendChild(inp);
      inputs.push(inp);
    }
    panel.appendChild(card);
    const ok = el('button', 'mc-btn', 'Done');
    ok.style.cssText = 'display:block;margin:0 auto';
    ok.onclick = () => {
      be.text = inputs.map(i => i.value);
      w.blockEntities.set(pos.x + ',' + pos.y + ',' + pos.z, be);
      ui.closeScreen();
    };
    panel.appendChild(ok);
  }

  // ---------- Recipe Book ----------
  function buildRecipeBook(panel) {
    panel.innerHTML = `<div style="font-size:15px;font-weight:bold;margin-bottom:8px">Recipe Book <span style="float:right;cursor:pointer;font-weight:normal" onclick="WC.ui.closeScreen()">✕</span></div><div style="font-size:11px;color:#555;margin-bottom:8px">Click a recipe to craft it directly from your inventory. Grey = missing materials.</div>`;
    const search = el('input', '');
    search.placeholder = 'Search…';
    search.style.cssText = 'width:100%;box-sizing:border-box;padding:5px;margin-bottom:10px;border:2px solid #555;font-size:12px';
    search.addEventListener('keydown', ev => ev.stopPropagation());
    panel.appendChild(search);
    const grid = el('div', '');
    grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px;max-height:60vh;overflow:auto;padding-right:4px';
    panel.appendChild(grid);
    const draw = () => {
      grid.innerHTML = '';
      const q = search.value.toLowerCase();
      const P = WC.state.player;
      const counts = {};
      for (const s of P.inv) if (s) counts[s.item] = (counts[s.item] || 0) + s.count;
      const seen = WC.state.recipesSeen;
      const list = WC.recipes.filter(r => r.kind !== 'special')
        .filter(r => !q || r.out.includes(q))
        .sort((a, b) => (seen.has(b.out) ? 1 : 0) - (seen.has(a.out) ? 1 : 0))
        .slice(0, 260);
      for (const rec of list) {
        const can = WC.canCraft(rec, counts);
        const card = el('div', '');
        card.style.cssText = `background:rgba(255,255,255,.6);border:2px solid ${can ? '#3a3' : '#888'};padding:6px;cursor:pointer;display:flex;gap:6px;align-items:center;opacity:${can ? 1 : 0.55}`;
        const ic = iconFor({ item: rec.out }, 28);
        if (ic) { ic.style.cssText = 'width:28px;height:28px;image-rendering:pixelated'; card.appendChild(ic); }
        const txt = el('div', '');
        txt.innerHTML = `<div style="font-size:12px;font-weight:bold">${esc((WC.items[rec.out] && WC.items[rec.out].display) || rec.out)}${rec.count > 1 ? ' ×' + rec.count : ''}</div><div style="font-size:10px;color:#555">${esc(recipeSummary(rec))}</div>`;
        card.appendChild(txt);
        card.onclick = () => {
          if (WC.quickCraft(rec)) { ui.toast('Crafted!', ((WC.items[rec.out] && WC.items[rec.out].display) || rec.out), rec.out); draw(); updateHUD(); }
          else ui.toast('Missing materials', recipeSummary(rec), rec.out);
        };
        grid.appendChild(card);
      }
      if (!grid.children.length) grid.appendChild(el('div', '', '<i>No recipes found.</i>'));
    };
    search.oninput = draw;
    draw();
  }
  function recipeSummary(rec) {
    if (rec.kind === 'shaped') return rec.pattern.join('/').replace(/ /g, '.') + ' ' + JSON.stringify(rec.key).slice(0, 40);
    if (rec.kind === 'shapeless') return rec.ingredients.join(' + ');
    if (rec.ingredient) return rec.kind + ': ' + rec.ingredient;
    if (rec.kind === 'smithing') return rec.base + ' + ' + rec.add;
    return rec.kind;
  }

  // ---------- Stats / Advancements ----------
  function buildStats(panel) {
    const S = WC.state, P = S.player;
    panel.innerHTML = `<div style="font-size:15px;font-weight:bold;margin-bottom:10px">Statistics <span style="float:right;cursor:pointer;font-weight:normal" onclick="WC.ui.closeScreen()">✕</span></div>`;
    const rows = [
      ['Seed', S.seed], ['Game mode', S.mode], ['Difficulty', S.difficulty], ['Dimension', S.dim],
      ['Days played', Math.floor(S.time / 24000)], ['Deaths', P.deaths],
      ['Distance walked', Math.round(P.walked) + ' m'], ['Blocks mined', Object.values(P.mined).reduce((a, b) => a + b, 0)],
      ['Blocks placed', Object.values(P.placed).reduce((a, b) => a + b, 0)], ['Mobs killed', Object.values(P.kills).reduce((a, b) => a + b, 0)],
      ['XP level', P.level], ['Current health', Math.ceil(P.health) + '/' + P.maxHealth],
    ];
    const tbl = el('div', '');
    tbl.style.cssText = 'display:grid;grid-template-columns:auto auto;gap:4px 18px;font-size:13px;margin-bottom:14px';
    for (const [k, v] of rows) { tbl.appendChild(el('div', '', `<b>${k}</b>`)); tbl.appendChild(el('div', '', String(v))); }
    panel.appendChild(tbl);
    const close = el('button', 'mc-btn', 'Close'); close.onclick = () => ui.closeScreen();
    panel.appendChild(close);
  }
  function buildAdvancements(panel) {
    panel.innerHTML = `<div style="font-size:15px;font-weight:bold;margin-bottom:10px">Advancements <span style="float:right;cursor:pointer;font-weight:normal" onclick="WC.ui.closeScreen()">✕</span></div>`;
    const grid = el('div', '');
    grid.style.cssText = 'display:grid;grid-template-columns:repeat(4,1fr);gap:8px;max-height:60vh;overflow:auto';
    for (const [id, a] of Object.entries(WC.ADVANCEMENTS)) {
      const got = WC.state.advancements.has(id);
      const card = el('div', '');
      card.style.cssText = `background:${got ? 'rgba(255,230,120,.35)' : 'rgba(0,0,0,.15)'};border:2px solid ${got ? '#a80' : '#777'};padding:8px;display:flex;gap:8px;align-items:center;${got ? '' : 'filter:grayscale(1);opacity:.6'}`;
      const ic = iconFor({ item: a.icon }, 28);
      if (ic) { ic.style.cssText = 'width:28px;height:28px;image-rendering:pixelated'; card.appendChild(ic); }
      card.appendChild(el('div', '', `<div style="font-size:12px;font-weight:bold">${esc(a.name)}</div><div style="font-size:10px;color:#555">${esc(a.desc)}</div>`));
      grid.appendChild(card);
    }
    panel.appendChild(grid);
    const close = el('button', 'mc-btn', 'Close'); close.style.marginTop = '12px'; close.onclick = () => ui.closeScreen();
    panel.appendChild(close);
  }

  // ---------- Pause / Options ----------
  function buildPause(panel) {
    WC.state.paused = true;
    panel.innerHTML = `<div style="font-size:20px;font-weight:bold;margin-bottom:16px;text-align:center">Game Menu</div>`;
    const col = el('div', '');
    col.style.cssText = 'display:flex;flex-direction:column;gap:8px;width:260px;margin:0 auto';
    const mk = (label, fn) => { const b = el('button', 'mc-btn', label); b.onclick = fn; col.appendChild(b); };
    mk('Back to Game', () => { WC.state.paused = false; ui.closeScreen(); });
    mk('Options…', () => { ui.openScreen('options'); });
    mk('Statistics', () => ui.openScreen('stats'));
    mk('Advancements', () => ui.openScreen('advancements'));
    mk('Recipe Book', () => ui.openScreen('recipeBook'));
    mk('Save Game', () => { WC.saveGame(); ui.toast('Saved', 'World written to localStorage', 'oak_sign'); });
    mk('Creative Toggle', () => {
      WC.state.mode = WC.state.mode === 'creative' ? 'survival' : 'creative';
      WC.log('Game mode: ' + WC.state.mode, '#8cf');
      ui.closeScreen();
    });
    mk('New World (reload)', () => location.reload());
    panel.appendChild(col);
  }
  function buildOptions(panel) {
    const O = WC.state.options;
    panel.innerHTML = `<div style="font-size:18px;font-weight:bold;margin-bottom:14px;text-align:center">Options</div>`;
    const col = el('div', '');
    col.style.cssText = 'display:flex;flex-direction:column;gap:10px;width:300px;margin:0 auto;font-size:13px';
    const slider = (label, key, min, max, step, fmt, onchange) => {
      const row = el('div', '');
      row.innerHTML = `<div style="margin-bottom:2px">${label}: <b id="opt_${key}">${fmt(O[key])}</b></div>`;
      const inp = el('input', '');
      inp.type = 'range'; inp.min = min; inp.max = max; inp.step = step; inp.value = O[key];
      inp.style.width = '100%';
      inp.oninput = () => { O[key] = +inp.value; $('opt_' + key).textContent = fmt(O[key]); if (onchange) onchange(O[key]); };
      row.appendChild(inp); col.appendChild(row);
    };
    slider('Field of View', 'fov', 30, 110, 1, v => v + '°');
    slider('Render Distance', 'renderDist', 2, 12, 1, v => v + ' chunks');
    slider('Mouse Sensitivity', 'mouseSens', 0.0005, 0.006, 0.0001, v => (v * 1000).toFixed(1));
    slider('Sound Volume', 'soundVol', 0, 1, 0.05, v => Math.round(v * 100) + '%', v => { try { WC.sound.setVolume(v); } catch (e) { } });
    slider('Music Volume', 'musicVol', 0, 1, 0.05, v => Math.round(v * 100) + '%');
    const toggles = [['bob', 'View Bobbing'], ['showFps', 'Show FPS'], ['autosave', 'Autosave']];
    for (const [key, label] of toggles) {
      const row = el('div', '');
      row.style.cssText = 'display:flex;justify-content:space-between;align-items:center';
      row.innerHTML = `<span>${label}</span>`;
      const b = el('button', 'mc-btn', O[key] ? 'ON' : 'OFF');
      b.style.padding = '2px 14px';
      b.onclick = () => { O[key] = !O[key]; b.textContent = O[key] ? 'ON' : 'OFF'; };
      row.appendChild(b); col.appendChild(row);
    }
    const diffRow = el('div', '');
    diffRow.style.cssText = 'display:flex;justify-content:space-between;align-items:center';
    diffRow.innerHTML = '<span>Difficulty</span>';
    const db = el('button', 'mc-btn', WC.state.difficulty.toUpperCase());
    db.onclick = () => {
      const order = ['peaceful', 'easy', 'normal', 'hard'];
      WC.state.difficulty = order[(order.indexOf(WC.state.difficulty) + 1) % 4];
      db.textContent = WC.state.difficulty.toUpperCase();
    };
    diffRow.appendChild(db); col.appendChild(diffRow);
    panel.appendChild(col);
    const back = el('button', 'mc-btn', 'Done');
    back.style.cssText = 'display:block;margin:16px auto 0';
    back.onclick = () => ui.openScreen('pause');
    panel.appendChild(back);
  }

  function buildDeath(panel) { /* uses dedicated overlay instead */ }

  // ---------- Boss bar / toast / log ----------
  ui.showBoss = function (name, prog) {
    const bb = $('bossbar'); if (!bb) return;
    bb.style.display = 'block';
    $('bossname').textContent = name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    $('bossfill').style.width = Math.max(0, Math.min(100, prog * 100)) + '%';
  };
  ui.hideBoss = function () { const bb = $('bossbar'); if (bb) bb.style.display = 'none'; };
  ui.toast = function (title, desc, icon) {
    const host = $('toasts'); if (!host) return;
    const t = el('div', '');
    t.style.cssText = 'background:#100010;border:2px solid #2b0a3d;color:#fff;padding:6px 10px;font-size:12px;display:flex;gap:8px;align-items:center;box-shadow:2px 2px 0 rgba(0,0,0,.5);animation:toastin .3s';
    const ic = icon ? iconFor({ item: icon }, 24) : null;
    if (ic) { ic.style.cssText = 'width:24px;height:24px;image-rendering:pixelated'; t.appendChild(ic); }
    t.appendChild(el('div', '', `<div style="font-weight:bold;color:#ffdd55">${esc(title)}</div><div style="color:#ccc">${esc(desc || '')}</div>`));
    host.appendChild(t);
    setTimeout(() => { t.style.transition = 'opacity .5s'; t.style.opacity = 0; setTimeout(() => t.remove(), 500); }, 4000);
  };
  ui.refreshLog = function () {
    const box = $('chatlog'); if (!box) return;
    const logs = WC.state.log.slice(-6);
    box.innerHTML = logs.map(l => `<div style="color:${l.color || '#eee'};background:rgba(0,0,0,.35);margin:1px 0;padding:1px 4px;width:fit-content">${esc(l.msg)}</div>`).join('');
  };

  // ---------- Chat ----------
  ui.openChat = function () {
    const wrap = $('chatinputwrap');
    wrap.style.display = 'block';
    const inp = $('chatinput');
    inp.value = '';
    WC.state.chatOpen = true;
    setTimeout(() => inp.focus(), 0);
    inp.onkeydown = (ev) => {
      ev.stopPropagation();
      if (ev.key === 'Enter') {
        const msg = inp.value.trim();
        wrap.style.display = 'none';
        WC.state.chatOpen = false;
        inp.blur();
        if (msg) handleChat(msg);
      } else if (ev.key === 'Escape') {
        wrap.style.display = 'none';
        WC.state.chatOpen = false;
        inp.blur();
      }
    };
  };
  function handleChat(msg) {
    const S = WC.state;
    if (msg.startsWith('/')) {
      const parts = msg.slice(1).split(/\s+/);
      const cmd = parts[0].toLowerCase(), args = parts.slice(1);
      const p = S.player;
      switch (cmd) {
        case 'tp': {
          const dim = args[0];
          if (['nether', 'end', 'overworld'].includes(dim)) { S.dim = dim; WC.travelTo(dim); }
          else { p.x = +args[0] || p.x; p.y = +args[1] || p.y; p.z = +args[2] || p.z; WC.log('Teleported.', '#8cf'); }
          break;
        }
        case 'give': {
          const item = args[0], n = +args[1] || 1;
          if (WC.items[item]) { WC.invAdd(p, item, n); WC.log(`Gave ${n} ${item}.`, '#8cf'); }
          else WC.log('Unknown item: ' + item, '#f88');
          break;
        }
        case 'gamemode': case 'gm': {
          const m = args[0];
          if (['survival', 'creative', 'hardcore', 'adventure'].includes(m)) { S.mode = m; WC.log('Mode: ' + m, '#8cf'); }
          break;
        }
        case 'time': {
          if (args[0] === 'set') {
            const map = { day: 1000, noon: 6000, sunset: 12000, night: 14000, midnight: 18000, sunrise: 23000 };
            S.time = map[args[1]] !== undefined ? map[args[1]] : (+args[1] || 0);
          } else if (args[0] === 'add') S.time += (+args[1] || 1000);
          WC.log('Time set.', '#8cf');
          break;
        }
        case 'weather': { S.weather = ['clear', 'rain', 'thunder'].includes(args[0]) ? args[0] : 'clear'; S.weatherT = 600; WC.log('Weather: ' + S.weather, '#8cf'); break; }
        case 'kill': {
          if (args[0] === '@e') { for (const e of S.entities) if (!e.dead) { e.hp = 0; } WC.log('Killed all entities.', '#f88'); }
          else WC.killPlayer();
          break;
        }
        case 'difficulty': { if (['peaceful', 'easy', 'normal', 'hard'].includes(args[0])) { S.difficulty = args[0]; WC.log('Difficulty: ' + args[0], '#8cf'); } break; }
        case 'effect': {
          if (args[0] === 'clear') WC.clearEffects(p);
          else WC.addEffect(p, args[0], (+args[1] || 30) * 1000 / 50, +args[2] || 0);
          WC.log('Effect applied.', '#8cf');
          break;
        }
        case 'summon': { if (WC.MOBS[args[0]]) { WC.spawnEntity(args[0], p.x + 2, p.y, p.z); WC.log('Summoned ' + args[0], '#8cf'); } else WC.log('Unknown mob', '#f88'); break; }
        case 'heal': p.health = p.maxHealth; p.food = 20; WC.log('Healed.', '#8cf'); break;
        case 'xp': WC.addXp(+args[0] || 10); WC.log('XP given.', '#8cf'); break;
        case 'killdragon': case 'dragon': {
          const d = S.entities.find(e => e.type === 'ender_dragon' && !e.dead);
          if (cmd === 'dragon') { WC.spawnDragon(); WC.log('Dragon summoned!', '#cf8'); }
          else if (d) { WC.damageEntity(d, 9999, 'player'); }
          else WC.log('No dragon found', '#f88');
          break;
        }
        case 'day': S.time = 1000; break;
        case 'night': S.time = 15000; break;
        case 'help': WC.log('Commands: /tp /give /gamemode /time /weather /kill /difficulty /effect /summon /heal /xp /dragon /day /night', '#8cf'); break;
        default: WC.log('Unknown command: /' + cmd, '#f88');
      }
      WC.log('> ' + msg, '#fff');
    } else {
      WC.log('<Steve> ' + msg, '#ddd');
    }
  }

  // ---------- Death screen ----------
  ui.showDeath = function () {
    const ds = $('deathscreen');
    ds.style.display = 'flex';
    $('deathmsg').textContent = 'Slain by ' + (WC.state.player.lastDamageSource || 'the void');
    $('respawnbtn').onclick = () => {
      ds.style.display = 'none';
      WC.respawnPlayer();
      if (WC.requestLock) WC.requestLock();
    };
  };

  // ---------- HUD update (called every frame) ----------
  let lastHotbarSig = '';
  function heartIcon(full, half) {
    const s = el('div', '');
    s.style.cssText = 'width:10px;height:10px;font-size:10px;line-height:10px';
    s.textContent = full ? '❤' : half ? '♥' : '🖤';
    s.style.color = full ? '#e33' : half ? '#e33' : '#333';
    s.style.textShadow = '1px 1px 0 #000';
    s.style.fontSize = '15px';
    s.style.width = '16px';
    return s;
  }
  function lineIcons(box, value, max, iconFn) {
    box.innerHTML = '';
    const n = Math.ceil(max / 2);
    for (let i = 0; i < n; i++) {
      const v = value - i * 2;
      box.appendChild(iconFn(v >= 2, v === 1));
    }
  }
  function updateHUD() {
    const S = WC.state, P = S.player;
    if (!S || !P || !ui.hud) return;
    lineIcons($('healline'), P.health, 20, (full, half) => heartIcon(full, half));
    lineIcons($('hungerline'), P.food, 20, (full, half) => {
      const d = el('div', '');
      d.textContent = full ? '🍖' : half ? '🍗' : '🦴';
      d.style.cssText = 'font-size:15px;width:16px;text-shadow:1px 1px 0 #000';
      if (!full && !half) d.style.opacity = 0.35;
      return d;
    });
    // armor
    let ap = 0; for (const a of P.armor) { const d = a && WC.items[a.item]; if (d) ap += d.armor || 0; }
    const al = $('armorline'); al.innerHTML = '';
    for (let i = 0; i < 10; i++) {
      const d = el('div', '', i * 2 < ap ? '🛡' : '');
      d.style.cssText = 'font-size:13px;width:16px;opacity:' + (i * 2 < ap ? 1 : 0.15);
      d.style.textShadow = '1px 1px 0 #000';
      al.appendChild(d);
    }
    // air bubbles
    const airBox = $('airline');
    if (P.air < P.maxAir) {
      airBox.style.visibility = 'visible';
      airBox.innerHTML = '';
      const bubbles = Math.ceil(P.air / P.maxAir * 10);
      for (let i = 0; i < bubbles; i++) {
        const d = el('div', '', '○');
        d.style.cssText = 'color:#9df;font-size:13px;width:13px;text-shadow:1px 1px 0 #000';
        airBox.appendChild(d);
      }
    } else airBox.style.visibility = 'hidden';
    // xp
    const xl = $('xpline');
    if (S.mode === 'creative') xl.style.display = 'none';
    else {
      xl.style.display = 'block';
      const need = 2 * P.level + 7;
      $('xpfill').style.width = Math.min(100, P.xp / need * 100) + '%';
      $('xplvl').textContent = P.level > 0 ? P.level : '';
    }
    // hotbar
    const sig = P.hotbar + ':' + P.inv.map(s => s ? s.item + s.count + (s.durability || '') : '-').join(',');
    if (sig !== lastHotbarSig) {
      lastHotbarSig = sig;
      const hb = $('hotbar');
      const slots = hb.children;
      for (let i = 0; i < 9; i++) {
        const sl = slots[i];
        sl.style.borderColor = i === P.hotbar ? '#fff' : '#4a4a4a';
        sl.style.borderWidth = i === P.hotbar ? '3px' : '2px';
        paintSlot(sl, P.inv[i]);
      }
      const held = P.inv[P.hotbar];
      const lbl = $('toollabel');
      if (held && WC.items[held.item]) {
        lbl.textContent = WC.items[held.item].display;
        lbl.style.opacity = 1;
        clearTimeout(updateHUD._t);
        updateHUD._t = setTimeout(() => { lbl.style.opacity = 0; }, 2000);
      }
    }
    // overlays
    $('wateroverlay').style.display = P.inWater ? 'block' : 'none';
    $('fireoverlay').style.display = WC.hasEffect(P, 'fire_resistance') ? 'none' : (P.effects.some(e => e.name === 'fire') || P.onFire ? 'block' : 'none');
    // damage flash
    if (P.hurtT > 10) { $('damageflash').style.opacity = 1; }
    else if ($('damageflash').style.opacity !== '0') $('damageflash').style.opacity = 0;
    // time icon
    const tt = $('totime');
    if (tt) {
      const t = S.time % 24000;
      const day = Math.floor(t / 24000 + S.totalDays || 0);
      tt.textContent = (WC.isNight() ? '🌙 ' : '☀ ') + 'Day ' + (Math.floor(S.time / 24000) + 1) + ' · ' + S.weather;
    }
    // fps/debug
    const fb = $('fpsbox');
    if (fb) fb.textContent = S.options.showFps || S.debug ? 'FPS: ' + S.fps : '';
    const dbg = $('debuginfo');
    if (dbg) {
      if (S.debug) {
        const w = WC.world();
        dbg.style.display = 'block';
        dbg.textContent =
          `WebCraft ${S.mode} (${S.difficulty})\n` +
          `XYZ: ${P.x.toFixed(1)} / ${P.y.toFixed(1)} / ${P.z.toFixed(1)}\n` +
          `Chunk: ${Math.floor(P.x) >> 4},${Math.floor(P.z) >> 4} Dim: ${S.dim}\n` +
          `Biome: ${(() => { try { const g = WC.world().gen; return g && g.biomeAt ? g.biomeAt(Math.floor(P.x), Math.floor(P.z)).name : '?'; } catch (e) { return '?'; } })()}\n` +
          `Chunks: ${S.chunksLoaded} Ents: ${S.entities.length} Parts: ${WC.game && WC.game.renderer ? WC.game.renderer.particles.list.length : 0}\n` +
          `Time: ${S.time | 0} Light: sky ${Math.floor(P.y) >= 0 ? '?' : ''}\n` +
          `HP ${P.health.toFixed(1)} Food ${P.food} Air ${P.air} XP ${P.xp}/${2 * P.level + 7}`;
      } else dbg.style.display = 'none';
    }
    if (ui.furnaceTick) ui.furnaceTick();
  }
  ui.updateHUD = updateHUD;

  // ---------- CSS ----------
  const style = el('style', '');
  style.textContent = `
    .mc-btn { background:#6a6a6a; border:2px solid; border-color:#fff #2a2a2a #2a2a2a #fff; color:#fff; font-size:13px; padding:7px 14px; cursor:pointer; text-shadow:1px 1px 0 #3a3a3a; font-family:inherit }
    .mc-btn:hover { background:#7a8ac0; border-color:#c0d0ff #30308a #30308a #c0d0ff }
    .mc-btn:active { transform:translateY(1px) }
    @keyframes toastin { from { transform:translateX(60px); opacity:0 } to { transform:none; opacity:1 } }
    #ui-root input { font-family:inherit }
  `;
  document.head.appendChild(style);
})();
