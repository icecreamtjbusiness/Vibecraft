// ============================================================
// WebCraft Main: bootstrap, game loop, canvas sizing, autosave.
// ============================================================
(function () {
  'use strict';
  const WC = window.WC;

  function surfaceY(wx, wz) {
    try {
      const w = WC.world('overworld');
      for (let y = WC.Y_MAX - 1; y > WC.Y_MIN; y--) {
        const id = w.blockAt(wx, y, wz);
        if (id && WC.blockIds[id] && WC.blockIds[id].solid) return y + 1;
      }
    } catch (e) { /* ignore */ }
    return 100;
  }

  function findSpawn() {
    const w = WC.world('overworld');
    for (let r = 0; r < 64; r++) {
      for (let i = 0; i < Math.max(1, r * 8); i++) {
        const ang = (i / Math.max(1, r * 8)) * Math.PI * 2;
        const x = Math.round(Math.cos(ang) * r), z = Math.round(Math.sin(ang) * r);
        w.ensureChunk(x >> 4, z >> 4);
        const y = surfaceY(x, z);
        if (y >= 60 && y <= 200) {
          // avoid spawning inside water/liquid surface blocks
          const above = w.blockAt(x, y, z);
          const def = WC.blockIds[above];
          if (def && def.liquid) continue;
          return { x: x + 0.5, y: y, z: z + 0.5 };
        }
      }
    }
    return { x: 8.5, y: 100, z: 8.5 };
  }

  let last = 0, accTime = 0, fpsAcc = 0, fpsN = 0, fpsT = 0;
  let started = false;

  function frame(now) {
    requestAnimationFrame(frame);
    const S = WC.state;
    let dt = (now - last) / 1000; last = now;
    if (!isFinite(dt) || dt < 0) dt = 0;
    if (dt > 0.1) dt = 0.1; // tab-switch clamp

    // FPS meter
    fpsAcc += dt; fpsN++;
    if (fpsAcc >= 0.5) { S.fps = Math.round(fpsN / fpsAcc); fpsAcc = 0; fpsN = 0; }

    if (!started) return;

    const active = !S.paused && !S.screen && !document.hidden;

    if (active) {
      S.frameTick++;
      // day/night cycle: 24000 ticks per 20 min -> 20 ticks/sec
      if (S.gamerules.dayLightCycle) {
        S.time = (S.time + dt * 20) % 24000;
      }
      // weather timer
      S.weatherT -= dt;
      if (S.weatherT <= 0) {
        const roll = Math.random();
        if (S.dim === 'overworld') {
          if (S.weather === 'clear') {
            if (roll < 0.3) { S.weather = roll < 0.08 ? 'thunder' : 'rain'; S.weatherT = 120 + Math.random() * 240; }
            else S.weatherT = 180 + Math.random() * 420;
          } else { S.weather = 'clear'; S.weatherT = 240 + Math.random() * 480; }
        } else S.weatherT = 600;
      }

      WC.updatePlayer(dt);
      WC.tickEntities(dt);
      WC.tickSpawning(dt);
      WC.tickPlayerStats(dt);
      WC.tickFurnaces(dt);
      WC.processDirtyChunks(7);
      if (WC.game.renderer) WC.game.renderer.particles.update(dt);
      if (WC.updateBossBar) WC.updateBossBar();

      // autosave every ~90s
      if (S.options.autosave && S.frameTick % (90 * 60) === 0) {
        try { WC.saveGame('main'); } catch (e) { }
      }
    }

    // render always (so menus show the world behind)
    try {
      WC.game.renderer.render(now);
    } catch (e) {
      console.error('render error', e);
    }

    if (WC.ui && WC.ui.updateHUD) WC.ui.updateHUD();
  }

  function resize() {
    const c = WC.game.canvas;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.floor(innerWidth * dpr), h = Math.floor(innerHeight * dpr);
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
  }

  window.startWebCraft = function (opts) {
    opts = opts || {};
    const S = WC.state;
    if (opts.seed !== undefined && opts.seed !== null && opts.seed !== '') {
      S.seed = typeof opts.seed === 'number' ? opts.seed : WC.hashString(String(opts.seed));
    }
    if (opts.mode) S.mode = opts.mode;
    if (opts.difficulty) S.difficulty = opts.difficulty;

    // registries (idempotent — loadGame may have run before this)
    WC.registerBlockItems();

    // atlas & renderer
    const atlas = WC.buildAtlas();
    WC.ensureAtlasCanvas();
    WC.game.renderer.setAtlas(atlas.pixels, atlas.size);

    // player spawn
    if (!opts.loaded) {
      const sp = findSpawn();
      S.player.x = sp.x; S.player.y = sp.y; S.player.z = sp.z;
      S.player.spawn.overworld = { x: sp.x, y: sp.y, z: sp.z };
      // starter hotbar like a fresh survival map (small gift so game is playable instantly)
      if (S.mode === 'survival' && !S.player.inv.some(s => s)) {
        WC.invAdd(S.player, 'wooden_pickaxe', 1);
        WC.invAdd(S.player, 'oak_log', 8);
        WC.invAdd(S.player, 'bread', 3);
      }
    } else {
      // loaded save: re-attach container block entities to worlds
      for (const [dim, w] of Object.entries(S.worlds)) {
        for (const [k, be] of S.containers) {
          if (!w.blockEntities.has(k)) w.blockEntities.set(k, be);
        }
      }
    }

    // pre-generate chunks around spawn synchronously so first frame shows terrain
    const w = WC.world(S.dim);
    const pcx = Math.floor(S.player.x) >> 4, pcz = Math.floor(S.player.z) >> 4;
    for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) w.ensureChunk(pcx + dx, pcz + dz);

    started = true;
    S.paused = false;
    document.getElementById('menu').style.display = 'none';
    WC.log('Welcome to WebCraft! Press F3 for debug, E for inventory.', '#8f8');
    WC.log('WASD move · Space jump · Shift sneak · LMB mine · RMB use · 1-9 hotbar · T chat', '#aaa');
  };

  window.loadWebCraft = function () {
    if (!WC.loadGame('main')) { alert('No saved game found.'); return false; }
    window.startWebCraft({ loaded: true });
    return true;
  };

  // ---------- boot ----------
  window.addEventListener('DOMContentLoaded', function () {
    const canvas = document.getElementById('game');
    WC.game = WC.game || {};
    WC.game.canvas = canvas;
    try {
      WC.game.renderer = new WC.Renderer(canvas);
    } catch (e) {
      document.getElementById('nogl').style.display = 'flex';
      document.getElementById('noglmsg').textContent = String(e && e.message || e);
      return;
    }
    WC.ui.init();
    WC.bindControls(canvas);
    window.addEventListener('resize', resize);
    resize();

    // menu buttons
    const $ = (id) => document.getElementById(id);
    $('playBtn').onclick = () => window.startWebCraft({
      seed: $('seedInput').value.trim(),
      mode: $('modeSel').value,
      difficulty: $('diffSel').value,
    });
    $('continueBtn').onclick = () => { if (!window.loadWebCraft()) alert('No saved game found.'); };
    if (!localStorage.getItem('webcraft_save_main')) $('continueBtn').disabled = true;

    requestAnimationFrame((t) => { last = t; requestAnimationFrame(frame); });
  });
})();
