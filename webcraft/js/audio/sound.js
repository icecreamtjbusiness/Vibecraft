// ============================================================
// Procedural audio: WebAudio synth for all game sounds +
// simple generated music tracks (calm piano-ish loops).
// No external files needed.
// ============================================================
(function () {
  'use strict';
  const WC = window.WC;
  const A = WC.sound = { ctx: null, master: null, enabled: true, musicNode: null };

  function ctx() {
    if (!A.ctx) {
      A.ctx = new (window.AudioContext || window.webkitAudioContext)();
      A.master = A.ctx.createGain();
      A.master.gain.value = WC.state.options.soundVol * 0.6;
      A.master.connect(A.ctx.destination);
    }
    if (A.ctx.state === 'suspended') A.ctx.resume();
    return A.ctx;
  }

  function noiseBuf(c, dur = 0.2, brown = false) {
    const n = (c.sampleRate * dur) | 0;
    const b = c.createBuffer(1, n, c.sampleRate);
    const d = b.getChannelData(0);
    let last = 0;
    for (let i = 0; i < n; i++) {
      let v = Math.random() * 2 - 1;
      if (brown) { v = (last + 0.02 * v) / 1.02; last = v; d[i] = v * 3.5; } else d[i] = v;
    }
    return b;
  }
  function env(g, t0, a, d, peak = 1, sus = 0, rel = 0.1) {
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(peak, t0 + a);
    g.gain.exponentialRampToValueAtTime(Math.max(0.001, peak * 0.3), t0 + a + d);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d + rel);
  }
  function tone(freq, dur, type = 'square', vol = 0.4, slide = 0, delay = 0) {
    const c = ctx(); const t0 = c.currentTime + delay;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t0 + dur);
    env(g, t0, 0.005, dur * 0.6, vol, 0, dur * 0.5);
    o.connect(g); g.connect(A.master);
    o.start(t0); o.stop(t0 + dur + 0.1);
  }
  function burst(dur, filterFreq, q = 1, vol = 0.5, brown = false, sweep = 0) {
    const c = ctx(); const t0 = c.currentTime;
    const src = c.createBufferSource(); src.buffer = noiseBuf(c, dur, brown);
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.setValueAtTime(filterFreq, t0); f.Q.value = q;
    if (sweep) f.frequency.exponentialRampToValueAtTime(Math.max(60, filterFreq + sweep), t0 + dur);
    const g = c.createGain(); env(g, t0, 0.003, dur * 0.7, vol, 0, dur * 0.4);
    src.connect(f); f.connect(g); g.connect(A.master);
    src.start(t0);
  }

  const SND = {
    // footsteps per material
    step_grass: () => burst(0.09, 800, 0.8, 0.25, true),
    step_stone: () => burst(0.07, 2200, 2, 0.22),
    step_wood: () => burst(0.08, 1200, 1.5, 0.25),
    step_sand: () => burst(0.1, 500, 0.7, 0.25, true),
    step_dirt: () => burst(0.09, 700, 0.9, 0.25, true),
    step_snow: () => burst(0.1, 1500, 0.6, 0.2, true),
    break_block: () => { burst(0.15, 900, 1, 0.4, true); },
    place_block: () => { burst(0.08, 600, 1, 0.35, true); tone(220, 0.06, 'triangle', 0.15); },
    hurt: () => { tone(180, 0.15, 'sawtooth', 0.35, -80); },
    death: () => { tone(200, 0.6, 'sawtooth', 0.4, -150); },
    eat: () => { burst(0.06, 400, 1, 0.3, true); burst(0.06, 500, 1, 0.3, true); },
    drink: () => { tone(300, 0.1, 'sine', 0.2, 100); },
    pop: () => tone(880, 0.08, 'square', 0.2, 400),
    xp: () => { tone(1200, 0.08, 'sine', 0.18); tone(1600, 0.1, 'sine', 0.15, 0, 0.05); },
    craft: () => { burst(0.1, 1500, 1.2, 0.3); tone(500, 0.1, 'triangle', 0.2); },
    smelt_done: () => { tone(700, 0.1, 'sine', 0.2); tone(1000, 0.15, 'sine', 0.2, 0, 0.08); },
    bow: () => { burst(0.12, 2500, 2, 0.3, false, -1500); },
    arrow_hit: () => { tone(1400, 0.05, 'square', 0.2, -600); },
    sword_swing: () => burst(0.1, 1800, 1.5, 0.25, false, -1200),
    mace_smash: () => { burst(0.2, 300, 0.8, 0.6, true); tone(80, 0.25, 'sine', 0.5, -40); },
    spear_throw: () => burst(0.15, 2000, 2, 0.3, false, -1500),
    shield_block: () => { tone(300, 0.08, 'square', 0.3); burst(0.08, 1000, 2, 0.3); },
    explode: () => { burst(0.7, 120, 0.5, 0.9, true, -60); tone(60, 0.5, 'sine', 0.6, -30); },
    portal: () => { for (let i = 0; i < 6; i++) tone(200 + i * 60, 0.3, 'sine', 0.1, 100, i * 0.05); },
    portal_travel: () => { burst(0.8, 400, 0.5, 0.5, true, 800); },
    end_portal: () => { for (let i = 0; i < 8; i++) tone(100 + i * 40, 0.5, 'sine', 0.12, 50, i * 0.07); },
    splash: () => { burst(0.3, 800, 0.8, 0.4, true, 400); },
    swim: () => burst(0.15, 600, 0.7, 0.2, true),
    level_up: () => { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.15, 'sine', 0.25, 0, i * 0.08)); },
    anvil: () => { tone(150, 0.1, 'square', 0.3); burst(0.1, 2000, 3, 0.3); },
    chest_open: () => { burst(0.15, 900, 1, 0.25, true); tone(300, 0.1, 'triangle', 0.15, 100); },
    door: () => burst(0.12, 700, 1.2, 0.25, true),
    button: () => tone(600, 0.05, 'square', 0.2),
    lever: () => tone(400, 0.06, 'square', 0.2, 100),
    note_bass: () => tone(110, 0.3, 'sine', 0.4),
    ghast: () => { tone(400, 0.6, 'sawtooth', 0.2, -200); tone(300, 0.8, 'sawtooth', 0.15, -100, 0.2); },
    fireball: () => { burst(0.3, 900, 1, 0.4, false, -600); },
    wither_spawn: () => { for (let i = 0; i < 10; i++) tone(60 + i * 20, 0.4, 'sawtooth', 0.2, 0, i * 0.1); },
    dragon_roar: () => { tone(90, 1.2, 'sawtooth', 0.5, 60); burst(1.2, 200, 0.5, 0.4, true); },
    dragon_death: () => { for (let i = 0; i < 12; i++) { tone(300 - i * 20, 0.4, 'sawtooth', 0.25, -100, i * 0.15); burst(0.3, 500, 1, 0.2, true, i * 0.15); } },
    crystal_break: () => { burst(0.3, 3000, 2, 0.4, false, -2000); tone(1800, 0.2, 'sine', 0.3, -800); },
    zombie: () => { tone(140, 0.4, 'sawtooth', 0.2, -40); },
    skeleton: () => { burst(0.2, 1200, 3, 0.2); },
    creeper_hiss: () => { burst(0.8, 2500, 1, 0.3, false, -1500); },
    spider: () => { tone(500, 0.15, 'sawtooth', 0.15, 200); },
    enderman: () => { tone(200, 0.5, 'sine', 0.2, 300); },
    cow: () => { tone(200, 0.4, 'sawtooth', 0.2, -60); },
    pig: () => { tone(300, 0.2, 'sawtooth', 0.2, -100); tone(250, 0.2, 'sawtooth', 0.15, -50, 0.15); },
    sheep: () => { tone(400, 0.3, 'sawtooth', 0.15, -80); },
    chicken: () => { tone(900, 0.1, 'square', 0.12, 200); },
    wolf: () => { tone(300, 0.2, 'sawtooth', 0.2, 100); },
    villager: () => { tone(350, 0.15, 'square', 0.12, -50); },
    trade: () => { tone(600, 0.1, 'sine', 0.2); tone(800, 0.12, 'sine', 0.2, 0, 0.08); },
    click: () => tone(1000, 0.03, 'square', 0.15),
    achievement: () => { [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.2, 'triangle', 0.2, 0, i * 0.1)); },
    lightning: () => { burst(0.6, 150, 0.4, 0.7, true); },
    breathe: () => burst(0.2, 300, 0.5, 0.1, true),
    fish_hook: () => tone(500, 0.1, 'sine', 0.2, -200),
    fish_bite: () => { tone(700, 0.08, 'sine', 0.25); tone(700, 0.08, 'sine', 0.25, 0, 0.15); },
    equip: () => burst(0.08, 1200, 1.5, 0.25),
    cannon_fire: () => { burst(0.2, 400, 1, 0.5, true); tone(100, 0.2, 'square', 0.3, -50); },
  };
  A.play = function (name) {
    if (!A.enabled) return;
    try {
      const fn = SND[name];
      if (fn) fn();
    } catch (e) { /* ignore */ }
  };
  A.setVolume = function (v) { WC.state.options.soundVol = v; if (A.master) A.master.gain.value = v * 0.6; };

  // ---------- Music: procedural calm tracks ----------
  const SCALES = [[0, 2, 4, 7, 9, 12, 14, 16], [0, 3, 5, 7, 10, 12, 15, 17], [0, 2, 3, 5, 7, 9, 10, 12]];
  let musicTimer = null, curTrack = null;
  A.startMusic = function (trackName) {
    if (musicTimer) clearInterval(musicTimer);
    const c = ctx();
    curTrack = trackName || ['calm1', 'calm2', 'nether', 'end'][((Math.random() * 4) | 0)];
    const isDark = curTrack === 'nether' || curTrack === 'end';
    const base = isDark ? 110 : 220;
    const scale = SCALES[(Math.random() * 3) | 0];
    let step = 0;
    const tempo = isDark ? 900 : 650;
    musicTimer = setInterval(() => {
      if (!A.enabled || document.hidden) return;
      const mv = WC.state.options.musicVol;
      if (mv <= 0) return;
      const note = scale[(Math.random() * scale.length) | 0] + (Math.random() < 0.3 ? 12 : 0);
      const f = base * Math.pow(2, note / 12);
      const t0 = c.currentTime;
      const o = c.createOscillator(), g = c.createGain();
      o.type = isDark ? 'sine' : 'triangle';
      o.frequency.value = f;
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(0.12 * mv, t0 + 0.05);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.8);
      o.connect(g); g.connect(A.master || c.destination);
      o.start(t0); o.stop(t0 + 2);
      // occasional bass
      if (step % 8 === 0) {
        const ob = c.createOscillator(), gb = c.createGain();
        ob.type = 'sine'; ob.frequency.value = base / 2;
        gb.gain.setValueAtTime(0, t0); gb.gain.linearRampToValueAtTime(0.1 * mv, t0 + 0.1);
        gb.gain.exponentialRampToValueAtTime(0.0001, t0 + 3);
        ob.connect(gb); gb.connect(A.master); ob.start(t0); ob.stop(t0 + 3.2);
      }
      step++;
      if (step > 64 && Math.random() < 0.1) A.startMusic(); // re-pick track
    }, tempo);
  };
  A.stopMusic = function () { if (musicTimer) { clearInterval(musicTimer); musicTimer = null; } };
})();
