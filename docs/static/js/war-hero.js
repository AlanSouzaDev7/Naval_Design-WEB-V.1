/* ═══════════════════════════════════════════════════════════════
   ROYAL NAVY — HERO DO MODO ESCURO: BATALHA NAVAL EM ALTO MAR (Canvas 2D)

   Duas frotas frente a frente trocam disparos numa noite de tempestade:
   projéteis com rastro, clarões de boca, explosões, incêndios, fumaça,
   colunas d'água, relâmpagos, holofotes, sinalizadores de iluminação e
   navios que afundam (e voltam ao combate).

   Desempenho:
   • tudo que é estático (céu, estrelas, lua, mar, navios) é pré-renderizado;
   • partículas em POOL de tamanho fixo (nenhuma alocação por frame);
   • brilhos são sprites (drawImage), não gradientes criados a cada frame;
   • o teto de partículas e alguns efeitos seguem o nível de RNPerf;
   • animação por tempo (dt); pausa fora da tela é feita pelo RNHero.
   ═══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';
  if (!window.RNHero) return;

  const rnd  = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const level = () => (window.RNPerf ? window.RNPerf.level : 2);
  const CAP   = [44, 84, 150];                 // partículas ativas por nível de qualidade
  const POOL  = 150;

  /* ── sprites de brilho / fumaça / feixe (criados uma vez) ───── */
  function mk(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

  function glowSprite(rgb, size = 128) {
    const c = mk(size, size), g = c.getContext('2d');
    const gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gr.addColorStop(0,    `rgba(${rgb},1)`);
    gr.addColorStop(0.22, `rgba(${rgb},0.6)`);
    gr.addColorStop(0.55, `rgba(${rgb},0.14)`);
    gr.addColorStop(1,    `rgba(${rgb},0)`);
    g.fillStyle = gr; g.fillRect(0, 0, size, size);
    return c;
  }

  function smokeSprite(size = 96) {
    const c = mk(size, size), g = c.getContext('2d');
    const gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gr.addColorStop(0,   'rgba(38,40,48,0.85)');
    gr.addColorStop(0.6, 'rgba(24,26,34,0.4)');
    gr.addColorStop(1,   'rgba(18,20,28,0)');
    g.fillStyle = gr; g.fillRect(0, 0, size, size);
    return c;
  }

  function beamSprite() {                      // cone de luz com o vértice no topo
    const w = 240, h = 560, c = mk(w, h), g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, 'rgba(210,235,255,0.75)');
    gr.addColorStop(1, 'rgba(210,235,255,0)');
    g.fillStyle = gr;
    g.beginPath(); g.moveTo(w / 2 - 7, 0); g.lineTo(w / 2 + 7, 0); g.lineTo(w, h); g.lineTo(0, h); g.closePath(); g.fill();
    return c;
  }

  function stormCloud(seed, w = 420, h = 150) {
    const c = mk(w, h), g = c.getContext('2d');
    let s = seed;
    const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 10; i++) {
      const k = i / 9, px = w * 0.1 + w * 0.8 * k + (r() - 0.5) * 24;
      const rad = h * (0.3 + r() * 0.22) * (1 - Math.abs(k - 0.5) * 0.6);
      const py = h * 0.6 - rad * 0.3 + (r() - 0.5) * 10;
      const gr = g.createRadialGradient(px, py, 0, px, py, rad);
      gr.addColorStop(0,   'rgba(16,24,40,0.95)');
      gr.addColorStop(0.65, 'rgba(12,18,32,0.6)');
      gr.addColorStop(1,   'rgba(10,15,28,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(px, py, rad, 0, 7); g.fill();
    }
    return c;
  }

  const GLOW = {
    white:  glowSprite('255,244,222'),
    orange: glowSprite('255,150,60'),
    yellow: glowSprite('255,214,120'),
    blue:   glowSprite('160,196,255'),
    red:    glowSprite('255,70,40'),
  };
  const SMOKE = smokeSprite();
  const BEAM  = beamSprite();
  const CLOUDS = [stormCloud(5), stormCloud(17), stormCloud(29)];

  /* ── silhuetas dos navios (uma vez por resize) ──────────────── */
  function shipSprite(kind, L) {
    const pad = L * 0.04, w = Math.ceil(L + pad * 2), h = Math.ceil(L * 0.46), wl = L * 0.42;
    const c = mk(w, h), g = c.getContext('2d');
    const X = nx => pad + nx * L, Y = ny => wl + ny * L;
    const poly = (pts, fill) => {
      g.beginPath();
      pts.forEach((p, i) => (i ? g.lineTo(X(p[0]), Y(p[1])) : g.moveTo(X(p[0]), Y(p[1]))));
      g.closePath(); g.fillStyle = fill; g.fill();
    };
    const rect = (x0, y0, x1, y1, fill) => { g.fillStyle = fill; g.fillRect(X(x0), Y(y0), (x1 - x0) * L, (y1 - y0) * L); };
    const line = (x0, y0, x1, y1, wd, col) => {
      g.strokeStyle = col; g.lineWidth = Math.max(1, wd * L);
      g.beginPath(); g.moveTo(X(x0), Y(y0)); g.lineTo(X(x1), Y(y1)); g.stroke();
    };
    const dot = (nx, ny, r, col) => { g.fillStyle = col; g.beginPath(); g.arc(X(nx), Y(ny), Math.max(1, r * L), 0, 7); g.fill(); };

    const HULL = '#1b2d45', SUP = '#243a56';
    const muz = [];
    let mastTop = [0.5, -0.29];

    if (kind === 'destroyer' || kind === 'cruiser') {
      const big = kind === 'cruiser';
      poly([[0, -0.055], [0.02, 0], [0.86, 0], [1, -0.052], [0.965, -0.078], [0.03, -0.078]], HULL);
      poly([[0.37, -0.078], [0.4, -0.128], [0.6, -0.128], [0.63, -0.078]], SUP);
      rect(0.44, -0.165, 0.56, -0.128, SUP);
      line(0.5, -0.165, 0.5, big ? -0.32 : -0.29, 0.004, SUP);
      line(0.46, big ? -0.27 : -0.24, 0.54, big ? -0.27 : -0.24, 0.003, SUP);
      rect(0.61, -0.175, 0.665, -0.128, SUP);
      const turrets = big ? [0.74, 0.62, 0.17] : [0.73, 0.17];
      turrets.forEach(x => {
        rect(x, -0.108, x + 0.07, -0.078, SUP);
        line(x + 0.07, -0.094, x + 0.17, -0.094, 0.008, SUP);
        muz.push([x + 0.17, -0.094]);
      });
      for (let i = 0; i < 4; i++) rect(0.455 + i * 0.03, -0.152, 0.47 + i * 0.03, -0.146, '#ffb04a');
      mastTop = [0.5, big ? -0.32 : -0.29];
    } else if (kind === 'battleship') {
      poly([[0, -0.06], [0.015, 0], [0.9, 0], [1, -0.06], [0.97, -0.088], [0.02, -0.088]], HULL);
      [0.7, 0.56, 0.16].forEach(x => {
        rect(x, -0.122, x + 0.08, -0.088, SUP);
        line(x + 0.08, -0.112, x + 0.21, -0.112, 0.008, SUP);
        line(x + 0.08, -0.103, x + 0.21, -0.103, 0.008, SUP);
        muz.push([x + 0.21, -0.108]);
      });
      poly([[0.34, -0.088], [0.36, -0.16], [0.52, -0.16], [0.54, -0.088]], SUP);
      rect(0.38, -0.22, 0.5, -0.16, SUP);
      rect(0.41, -0.28, 0.47, -0.22, SUP);
      line(0.44, -0.4, 0.44, -0.28, 0.005, SUP);
      line(0.4, -0.34, 0.48, -0.34, 0.003, SUP);
      rect(0.24, -0.17, 0.3, -0.088, SUP);
      rect(0.6, -0.18, 0.66, -0.088, SUP);
      for (let i = 0; i < 5; i++) rect(0.385 + i * 0.022, -0.192, 0.394 + i * 0.022, -0.185, '#ffb04a');
      mastTop = [0.44, -0.4];
    } else {                                                        // carrier
      poly([[0, -0.05], [0.02, 0], [0.94, 0], [1, -0.03], [0.985, -0.06], [0.02, -0.06]], HULL);
      rect(0.02, -0.078, 0.98, -0.06, SUP);
      rect(0.62, -0.15, 0.7, -0.078, SUP);
      line(0.66, -0.26, 0.66, -0.15, 0.004, SUP);
      for (let i = 0; i < 5; i++) rect(0.12 + i * 0.14, -0.1, 0.145 + i * 0.14, -0.078, '#0b1421');
      muz.push([0.15, -0.085], [0.85, -0.085]);
      mastTop = [0.66, -0.26];
    }

    // luar por cima, brilho de incêndio por baixo (só nos pixels já desenhados)
    g.globalCompositeOperation = 'source-atop';
    const top = g.createLinearGradient(0, 0, 0, wl);
    top.addColorStop(0, 'rgba(150,190,240,0.5)');
    top.addColorStop(1, 'rgba(130,170,225,0)');
    g.fillStyle = top; g.fillRect(0, 0, w, wl);
    const low = g.createLinearGradient(0, wl - L * 0.08, 0, wl + L * 0.01);
    low.addColorStop(0, 'rgba(255,120,40,0)');
    low.addColorStop(1, 'rgba(255,120,40,0.22)');
    g.fillStyle = low; g.fillRect(0, wl - L * 0.08, w, L * 0.1);
    g.globalCompositeOperation = 'source-over';
    g.fillStyle = 'rgba(190,215,240,0.38)';                    // espuma na linha d'água
    g.fillRect(X(0.02), wl - Math.max(1, L * 0.004), (0.9) * L, Math.max(1.5, L * 0.006));

    return { c, w, h, wl, pad, muz, mastTop };
  }

  function createWarScene() {
    const HZ = 0.56;

    let ctx = null, cvs = null;
    let W = 0, H = 0, dpr = 1, S = 1, t = 0;
    let bg = null;
    let ships = [];
    let light = 0;                                       // "iluminação" dos clarões (decai)

    /* ── ondas (de trás para frente) ─────────────────────────── */
    const waves = [
      { y: 0.575, amp: 3,  freq: 0.022, speed: 0.6,  ph: 0.0, rgb: '70,110,150', a: 0.25, crest: 0.16 },
      { y: 0.615, amp: 6,  freq: 0.015, speed: 0.85, ph: 1.4, rgb: '4,14,26',    a: 0.55, crest: 0 },
      { y: 0.665, amp: 9,  freq: 0.010, speed: 1.0,  ph: 3.0, rgb: '70,110,150', a: 0.16, crest: 0.12 },
      { y: 0.735, amp: 13, freq: 0.007, speed: 0.7,  ph: 0.7, rgb: '2,9,18',     a: 0.62, crest: 0 },
      { y: 0.850, amp: 18, freq: 0.005, speed: 0.5,  ph: 2.2, rgb: '1,5,10',     a: 0.86, crest: 0.08 },
    ];

    const clouds = Array.from({ length: 5 }, (_, i) => ({
      s: i % 3, x: Math.random(), y: 0.02 + Math.random() * 0.26,
      scale: 0.9 + Math.random() * 1.0, speed: 0.004 + Math.random() * 0.008, a: 0.7 + Math.random() * 0.3,
    }));
    const moonGlints = Array.from({ length: 16 }, () => ({
      u: Math.random() * 2 - 1, v: Math.pow(Math.random(), 0.9), len: 5 + Math.random() * 14,
      ph: Math.random() * 6.28, sp: 1 + Math.random() * 2,
    }));

    /* ── pools ───────────────────────────────────────────────── */
    const P = Array.from({ length: POOL }, () => ({ a: 0, type: 0, x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, size: 10, y0: 0 }));
    let pIdx = 0;
    function spawn(type, x, y, vx, vy, life, size, y0) {
      const cap = CAP[level()];
      for (let k = 0; k < cap; k++) {
        pIdx = (pIdx + 1) % cap;
        const p = P[pIdx];
        if (!p.a) {
          p.a = 1; p.type = type; p.x = x; p.y = y; p.vx = vx; p.vy = vy;
          p.life = p.max = life; p.size = size; p.y0 = y0 || 0;
          return p;
        }
      }
      return null;
    }
    const FL = Array.from({ length: 28 }, () => ({ a: 0, x: 0, y: 0, t: 0, max: 0.3, size: 80, spr: GLOW.white }));
    const RG = Array.from({ length: 10 }, () => ({ a: 0, x: 0, y: 0, t: 0, max: 0.9 }));
    const PR = Array.from({ length: 26 }, () => ({ a: 0, delay: 0, x0: 0, y0: 0, x1: 0, y1: 0, u: 0, dur: 1, arc: 0, hit: false, target: null, hx: 0, hy: 0 }));
    const TR = Array.from({ length: 18 }, () => ({ a: 0, x: 0, y: 0, vx: 0, vy: 0, t: 0, max: 0.6 }));

    const flash = (x, y, max, size, spr) => {
      for (const f of FL) if (!f.a) { f.a = 1; f.x = x; f.y = y; f.t = 0; f.max = max; f.size = size; f.spr = spr; return; }
    };
    const ring = (x, y) => { for (const r of RG) if (!r.a) { r.a = 1; r.x = x; r.y = y; r.t = 0; return; } };

    /* ── navios ──────────────────────────────────────────────── */
    function makeShip(kind, side, fx, L, dyFrac, rate, dmgMax) {
      const spr = shipSprite(kind, L);
      return {
        kind, side, dir: side === 0 ? 1 : -1, x: fx * W, y: H * HZ + dyFrac * H, L, spr,
        rate, cool: rnd(0.4, rate[1]), hits: 0, dmgMax, state: 'ok', sinkT: 0, sinkY: 0, gone: 0,
        alpha: 1, ph: Math.random() * 6.28, bob: 0, roll: 0, burns: [], tracerCool: rnd(1, 3),
        far: dyFrac < 0.05,
      };
    }

    function buildShips() {
      const nar = W < 600 ? 1.34 : 1;                     // telas estreitas: navios proporcionalmente maiores
      ships = [
        makeShip('carrier',    0, 0.075, W * 0.22 * nar, 0.018, [6, 9],     9),
        makeShip('destroyer',  0, 0.265, W * 0.33 * nar, 0.082, [1.2, 2.2], 7),
        makeShip('battleship', 1, 0.735, W * 0.35 * nar, 0.086, [1.4, 2.4], 8),
        makeShip('cruiser',    1, 0.925, W * 0.21 * nar, 0.024, [2.4, 4],   6),
      ];
    }

    function shipPoint(s, nx, ny) {                    // ponto do casco (normalizado) -> tela
      const lx = (nx - 0.5) * s.L * s.dir, ly = ny * s.L;
      const cs = Math.cos(s.roll), sn = Math.sin(s.roll);
      return { x: s.x + lx * cs - ly * sn, y: s.y + s.bob + s.sinkY + lx * sn + ly * cs };
    }

    const enemyOf = s => {
      const list = ships.filter(o => o.side !== s.side && o.state === 'ok');
      return list.length ? list[(Math.random() * list.length) | 0] : null;
    };

    /* ── pré-renderização (só no resize) ─────────────────────── */
    function buildBg() {
      bg = mk(cvs.width, cvs.height);
      const g = bg.getContext('2d');
      g.scale(dpr, dpr);
      const hz = H * HZ;

      const sky = g.createLinearGradient(0, 0, 0, hz);
      sky.addColorStop(0,    '#02050b');
      sky.addColorStop(0.45, '#071228');
      sky.addColorStop(0.8,  '#182b4a');
      sky.addColorStop(1,    '#43261a');
      g.fillStyle = sky; g.fillRect(0, 0, W, hz + 1);

      // estrelas
      for (let i = 0; i < 90; i++) {
        const y = Math.pow(Math.random(), 1.6) * hz * 0.7;
        g.fillStyle = `rgba(210,225,255,${(0.18 + Math.random() * 0.6).toFixed(2)})`;
        g.fillRect(Math.random() * W, y, Math.random() < 0.15 ? 2 : 1, 1);
      }

      // lua
      const mx = W * 0.16, my = H * 0.15, mr = 24 * S;
      const halo = g.createRadialGradient(mx, my, 0, mx, my, mr * 7);
      halo.addColorStop(0, 'rgba(190,215,255,0.35)'); halo.addColorStop(1, 'rgba(190,215,255,0)');
      g.fillStyle = halo; g.fillRect(mx - mr * 7, my - mr * 7, mr * 14, mr * 14);
      g.fillStyle = '#dbe6f7'; g.beginPath(); g.arc(mx, my, mr, 0, 7); g.fill();
      g.fillStyle = 'rgba(120,140,175,0.35)';
      [[-0.3, -0.2, 0.28], [0.25, 0.1, 0.2], [-0.05, 0.4, 0.16]].forEach(([dx, dy, r]) => { g.beginPath(); g.arc(mx + dx * mr, my + dy * mr, r * mr, 0, 7); g.fill(); });

      // incêndios no horizonte
      [[0.05, 0.34], [0.5, 0.2], [0.95, 0.34]].forEach(([fx, k]) => {
        g.save(); g.translate(W * fx, hz); g.scale(1, 0.34);
        const r = W * k;
        const gr = g.createRadialGradient(0, 0, 0, 0, 0, r);
        gr.addColorStop(0, 'rgba(255,120,45,0.5)'); gr.addColorStop(1, 'rgba(255,90,30,0)');
        g.fillStyle = gr; g.beginPath(); g.arc(0, 0, r, 0, 7); g.fill(); g.restore();
      });

      const sea = g.createLinearGradient(0, hz, 0, H);
      sea.addColorStop(0,    '#5a3524');
      sea.addColorStop(0.09, '#3a2c34');
      sea.addColorStop(0.24, '#14283f');
      sea.addColorStop(0.5,  '#061626');
      sea.addColorStop(1,    '#02090f');
      g.fillStyle = sea; g.fillRect(0, hz, W, H - hz);
      g.fillStyle = 'rgba(255,170,90,0.35)'; g.fillRect(0, hz - 1, W, 2.5);
    }

    function buildWaveGradients() {
      waves.forEach(w => {
        const top = w.y * H - w.amp * 1.4;
        const gr = ctx.createLinearGradient(0, top, 0, top + 190);
        gr.addColorStop(0, `rgba(${w.rgb},${w.a})`);
        gr.addColorStop(1, `rgba(${w.rgb},0)`);
        w.grad = gr;
      });
    }

    /* ── combate ─────────────────────────────────────────────── */
    function explode(x, y, big) {
      const q = [0.5, 0.8, 1][level()];
      flash(x, y, big ? 0.6 : 0.42, (big ? 330 : 200) * S, GLOW.orange);
      flash(x, y, big ? 0.28 : 0.2, (big ? 170 : 110) * S, GLOW.white);
      const nf = Math.round((big ? 18 : 12) * q);
      for (let i = 0; i < nf; i++) spawn(0, x + rnd(-10, 10) * S, y, rnd(-60, 60) * S, rnd(-130, -35) * S, rnd(0.55, 1.2), rnd(48, 96) * S);
      const ns = Math.round(8 * q);
      for (let i = 0; i < ns; i++) spawn(2, x, y, rnd(-170, 170) * S, rnd(-220, -40) * S, rnd(0.5, 0.9), 2);
      for (let i = 0; i < Math.round(3 * q); i++) spawn(1, x, y - 6 * S, rnd(-25, 25) * S, rnd(-40, -15) * S, rnd(1.6, 2.6), rnd(56, 96) * S);
      light = Math.min(0.3, light + (big ? 0.24 : 0.14));
    }

    function splash(x, y) {
      ring(x, y);
      const q = [0.5, 0.8, 1][level()];
      for (let i = 0; i < Math.round(7 * q); i++) spawn(3, x, y, rnd(-55, 55) * S, rnd(-230, -110) * S, 0.9, rnd(1.5, 3) * S, y);
      flash(x, y - 6 * S, 0.22, 60 * S, GLOW.blue);
    }

    function fire(s) {
      const target = enemyOf(s);
      if (!target) return;
      const isCarrier = s.kind === 'carrier';
      const n = isCarrier ? 1 : Math.min(2, s.spr.muz.length);
      for (let k = 0; k < n; k++) {
        const m = s.spr.muz[(Math.random() * s.spr.muz.length) | 0];
        const mp = shipPoint(s, m[0], m[1]);
        // clarão de boca + fumaça
        flash(mp.x, mp.y, 0.18, (isCarrier ? 60 : 130) * S, GLOW.white);
        flash(mp.x, mp.y, 0.3, (isCarrier ? 90 : 220) * S, GLOW.orange);
        for (let i = 0; i < 2; i++) spawn(1, mp.x + s.dir * 6 * S, mp.y, s.dir * rnd(10, 40) * S, rnd(-24, -6) * S, rnd(1.2, 2), rnd(30, 56) * S);
        light = Math.min(0.3, light + 0.07);

        const hit = Math.random() < 0.55;
        const hx = rnd(0.16, 0.84), hy = -rnd(0.07, 0.13);
        const tp = shipPoint(target, hx, hy);
        const p = PR.find(o => !o.a);
        if (!p) continue;
        p.a = 1; p.delay = k * 0.13; p.u = 0; p.dur = rnd(0.85, 1.35);
        p.x0 = mp.x; p.y0 = mp.y;
        p.hit = hit; p.target = target; p.hx = hx; p.hy = hy;
        if (hit) { p.x1 = tp.x; p.y1 = tp.y; }
        else {                                            // erra: cai na água perto do alvo
          p.x1 = target.x + rnd(-0.75, 0.75) * target.L * (Math.random() < 0.5 ? 1 : -1) * 0.7;
          p.y1 = target.y + rnd(2, 14) * S;
        }
        p.arc = Math.abs(p.x1 - p.x0) * rnd(0.18, 0.3) + 30 * S;
      }
    }

    function shipTracers(s, dt) {
      if (level() < 1 || s.state !== 'ok') return;
      s.tracerCool -= dt;
      if (s.tracerCool > 0) return;
      s.tracerCool = rnd(2.5, 5);
      const m = s.spr.muz[(Math.random() * s.spr.muz.length) | 0];
      const mp = shipPoint(s, m[0], m[1] - 0.02);
      for (let i = 0; i < 3; i++) {
        const tr = TR.find(o => !o.a);
        if (!tr) break;
        const ang = -Math.PI / 2 + rnd(-0.55, 0.55) + s.dir * 0.25;
        const v = rnd(520, 760) * S;
        tr.a = 1; tr.x = mp.x; tr.y = mp.y; tr.vx = Math.cos(ang) * v; tr.vy = Math.sin(ang) * v;
        tr.t = 0; tr.max = rnd(0.45, 0.8);
      }
    }

    /* ── relâmpago e sinalizador ─────────────────────────────── */
    const bolt = { a: 0, t: 0, pts: [], next: rnd(3, 6) };
    function newBolt() {
      const pts = [];
      let x = rnd(0.2, 0.8) * W, y = 0;
      const end = H * HZ * rnd(0.72, 0.95);
      pts.push([x, y]);
      while (y < end) { y += rnd(22, 46) * S; x += rnd(-26, 26) * S; pts.push([x, y]); }
      bolt.pts = pts; bolt.a = 1; bolt.t = 0;
      bolt.branch = pts.slice(Math.floor(pts.length * 0.4), Math.floor(pts.length * 0.4) + 4)
        .map((p, i) => [p[0] + i * rnd(10, 22) * S * (Math.random() < 0.5 ? 1 : -1), p[1] + i * 10 * S]);
      light = Math.min(0.3, light + 0.2);
    }
    const flare = { a: 0, x: 0, y: 0, t: 0, next: rnd(3, 5) };

    /* ── atualização ─────────────────────────────────────────── */
    function update(dt) {
      // navios
      for (const s of ships) {
        s.bob  = Math.sin(t * 0.9 + s.ph) * 2.2 * S;
        let sinkRoll = 0;
        if (s.state === 'ok') {
          s.cool -= dt;
          if (s.cool <= 0) { s.cool = rnd(s.rate[0], s.rate[1]); fire(s); }
          shipTracers(s, dt);
          if (s.hits >= s.dmgMax) { s.state = 'sinking'; s.sinkT = 0; }
        } else if (s.state === 'sinking') {
          s.sinkT = Math.min(1, s.sinkT + dt / 9);
          s.sinkY = s.sinkT * s.L * 0.15;
          sinkRoll = s.sinkT * 0.4 * s.dir;
          s.alpha = 1 - clamp((s.sinkT - 0.78) / 0.22, 0, 1);
          if (Math.random() < dt * 5 * [0.4, 0.7, 1][level()]) {
            const b = shipPoint(s, rnd(0.2, 0.8), -0.09);
            spawn(1, b.x, b.y, rnd(-15, 15) * S, rnd(-45, -20) * S, rnd(1.6, 2.4), rnd(50, 90) * S);
          }
          if (s.sinkT >= 1) { s.state = 'gone'; s.gone = 4.5; s.burns.length = 0; ring(s.x, s.y); }
        } else if (s.state === 'gone') {
          s.gone -= dt;
          if (s.gone <= 0) { s.state = 'ok'; s.hits = 0; s.sinkT = 0; s.sinkY = 0; s.alpha = 0; s.fade = 1; s.cool = rnd(1, 2); }
        }
        if (s.fade) { s.alpha = Math.min(1, s.alpha + dt / 2); if (s.alpha >= 1) s.fade = 0; }
        s.roll = Math.sin(t * 0.7 + s.ph) * 0.018 + sinkRoll;

        // incêndios a bordo
        for (let i = s.burns.length - 1; i >= 0; i--) {
          const b = s.burns[i];
          b.life -= dt;
          if (b.life <= 0) { s.burns.splice(i, 1); continue; }
          const q = [0.35, 0.65, 1][level()];
          b.acc += dt * 20 * q;
          b.accS += dt * 4 * q;
          const bp = shipPoint(s, b.nx, b.ny);
          while (b.acc >= 1) { b.acc--; spawn(0, bp.x + rnd(-5, 5) * S, bp.y, rnd(-16, 16) * S, rnd(-80, -40) * S, rnd(0.5, 0.95), rnd(34, 66) * S); }
          while (b.accS >= 1) { b.accS--; spawn(1, bp.x, bp.y - 8 * S, rnd(-10, 22) * S, rnd(-42, -22) * S, rnd(1.6, 2.6), rnd(36, 70) * S); }
        }
      }

      // projéteis
      for (const p of PR) {
        if (!p.a) continue;
        if (p.delay > 0) { p.delay -= dt; continue; }
        p.u += dt / p.dur;
        if (p.u >= 1) {
          p.a = 0;
          if (p.hit && p.target && p.target.state !== 'gone') {
            const big = Math.random() < 0.35;
            explode(p.x1, p.y1, big);
            p.target.hits++;
            if (p.target.burns.length < 4) p.target.burns.push({ nx: p.hx, ny: p.hy, life: rnd(7, 12), acc: 0, accS: 0 });
          } else {
            splash(p.x1, p.y1);
          }
        }
      }

      // partículas
      for (const p of P) {
        if (!p.a) continue;
        p.life -= dt;
        if (p.life <= 0) { p.a = 0; continue; }
        p.x += p.vx * dt; p.y += p.vy * dt;
        if (p.type === 0) p.vy -= 26 * S * dt;
        else if (p.type === 1) { p.vy -= 6 * S * dt; p.vx *= 1 - 0.3 * dt; }
        else if (p.type === 2) p.vy += 300 * S * dt;
        else { p.vy += 560 * S * dt; if (p.y > p.y0) p.a = 0; }
      }
      for (const f of FL) if (f.a) { f.t += dt; if (f.t >= f.max) f.a = 0; }
      for (const r of RG) if (r.a) { r.t += dt; if (r.t >= r.max) r.a = 0; }
      for (const tr of TR) if (tr.a) { tr.t += dt; tr.x += tr.vx * dt; tr.y += tr.vy * dt; if (tr.t >= tr.max) tr.a = 0; }

      // relâmpago, sinalizador, clarões distantes
      bolt.next -= dt;
      if (bolt.next <= 0) { bolt.next = rnd(4, 9); newBolt(); }
      if (bolt.a) { bolt.t += dt; if (bolt.t > 0.5) bolt.a = 0; }

      flare.next -= dt;
      if (!flare.a && flare.next <= 0 && level() >= 1) {
        flare.a = 1; flare.t = 0; flare.x = rnd(0.3, 0.7) * W; flare.y = H * HZ; flare.next = rnd(7, 11);
      }
      if (flare.a) { flare.t += dt; if (flare.t > 8) flare.a = 0; }

      if (Math.random() < dt * 0.55) flash(rnd(0.05, 0.95) * W, H * HZ - rnd(0, 8) * S, rnd(0.3, 0.6), rnd(50, 110) * S, GLOW.orange);
      light = Math.max(0, light - dt * 1.4);
    }

    /* ── desenho ─────────────────────────────────────────────── */
    function drawWave(w) {
      const base = w.y * H;
      ctx.beginPath();
      for (let x = 0; x <= W + 6; x += 6) {
        const y = base + Math.sin(x * w.freq + t * w.speed + w.ph) * w.amp
          + Math.sin(x * w.freq * 1.7 + t * w.speed * 0.8) * (w.amp * 0.4);
        if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      if (w.crest) { ctx.strokeStyle = `rgba(190,215,245,${w.crest})`; ctx.lineWidth = 1.4; ctx.stroke(); }
      ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath();
      ctx.fillStyle = w.grad; ctx.fill();
    }

    function drawShip(s) {
      if (s.state === 'gone' || s.alpha <= 0.01) return;
      ctx.save();
      ctx.globalAlpha = s.alpha;
      ctx.translate(s.x, s.y + s.bob + s.sinkY);
      ctx.rotate(s.roll);
      ctx.scale(s.dir, 1);
      ctx.drawImage(s.spr.c, -s.spr.w / 2, -s.spr.wl);
      ctx.restore();

      // luzes de navegação (esquerda: ciano; direita: vermelho)
      const mp = shipPoint(s, s.spr.mastTop[0], s.spr.mastTop[1]);
      const blink = 0.55 + 0.45 * Math.sin(t * 3 + s.ph);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = blink * s.alpha;
      const sp = s.side === 0 ? GLOW.blue : GLOW.red, r = 16 * S;
      ctx.drawImage(sp, mp.x - r / 2, mp.y - r / 2, r, r);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
    }

    function drawReflection(s) {                       // brilho dos incêndios refletido na água
      if (!s.burns.length || s.state === 'gone') return;
      const k = 0.16 + 0.07 * Math.sin(t * 9 + s.ph) + Math.min(0.14, s.burns.length * 0.04);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = k * s.alpha;
      ctx.drawImage(GLOW.orange, s.x - s.L * 0.4, s.y + 2 * S + s.sinkY, s.L * 0.8, s.L * 0.14);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
    }

    function drawClouds(dt) {
      const nc = level() === 0 ? 3 : 5;
      for (let i = 0; i < nc; i++) {
        const c = clouds[i];
        c.x += c.speed * dt; if (c.x > 1) c.x -= 1;
        const sp = CLOUDS[c.s], w = sp.width * c.scale, h = sp.height * c.scale;
        ctx.globalAlpha = c.a;
        ctx.drawImage(sp, c.x * (W + w * 2) - w, c.y * H, w, h);
      }
      ctx.globalAlpha = 1;
    }

    function drawBolt() {
      if (!bolt.a) return;
      const k = bolt.t < 0.08 ? 1 : bolt.t < 0.16 ? 0.25 : bolt.t < 0.24 ? 0.9 : Math.max(0, 1 - (bolt.t - 0.24) / 0.26);
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = `rgba(120,150,255,${(0.2 * k).toFixed(3)})`;
      ctx.fillRect(0, 0, W, H * HZ);
      ctx.lineJoin = 'round';
      const trace = pts => { ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.stroke(); };
      ctx.strokeStyle = `rgba(150,180,255,${(0.35 * k).toFixed(3)})`; ctx.lineWidth = 7 * S; trace(bolt.pts);
      ctx.strokeStyle = `rgba(255,255,255,${k.toFixed(3)})`;          ctx.lineWidth = 2 * S; trace(bolt.pts);
      if (bolt.branch && bolt.branch.length > 1) { ctx.lineWidth = 1.2 * S; trace(bolt.branch); }
      ctx.globalCompositeOperation = 'source-over';
    }

    function drawBeams() {
      if (level() === 0) return;
      const near = ships.filter(s => !s.far && s.state === 'ok');
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.16;
      near.forEach((s, i) => {
        const bp = shipPoint(s, s.kind === 'battleship' ? 0.44 : 0.5, s.kind === 'battleship' ? -0.24 : -0.17);
        const ang = -Math.PI / 2 + Math.sin(t * 0.42 + i * 2.1 + s.ph) * 0.65;
        ctx.save();
        ctx.translate(bp.x, bp.y);
        ctx.rotate(ang - Math.PI / 2);
        const len = H * 0.75, wd = len * 0.36;
        ctx.drawImage(BEAM, -wd / 2, 0, wd, len);
        ctx.restore();
      });
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }

    function drawProjectiles() {
      ctx.globalCompositeOperation = 'lighter';
      for (const p of PR) {
        if (!p.a || p.delay > 0) continue;
        const pos = u => ({ x: p.x0 + (p.x1 - p.x0) * u, y: p.y0 + (p.y1 - p.y0) * u - p.arc * 4 * u * (1 - u) });
        const a = pos(p.u), b = pos(Math.max(0, p.u - 0.06));
        ctx.strokeStyle = 'rgba(255,190,110,0.55)'; ctx.lineWidth = 2 * S;
        ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(a.x, a.y); ctx.stroke();
        const r = 22 * S;
        ctx.globalAlpha = 0.9; ctx.drawImage(GLOW.yellow, a.x - r / 2, a.y - r / 2, r, r);
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#fff'; ctx.fillRect(a.x - 1.2, a.y - 1.2, 2.4, 2.4);
      }
      ctx.globalCompositeOperation = 'source-over';
    }

    function drawParticles() {
      // passe 1: fumaça e gotas (composição normal)
      for (const p of P) {
        if (!p.a) continue;
        const k = p.life / p.max;
        if (p.type === 1) {
          const sz = p.size * (1.7 - k * 0.7);
          ctx.globalAlpha = 0.5 * k;
          ctx.drawImage(SMOKE, p.x - sz / 2, p.y - sz / 2, sz, sz);
        } else if (p.type === 3) {
          ctx.globalAlpha = 0.85;
          ctx.fillStyle = '#cfe4f7';
          ctx.fillRect(p.x, p.y, p.size, p.size * 1.6);
        }
      }
      // passe 2: chamas e faíscas (aditivo)
      ctx.globalCompositeOperation = 'lighter';
      for (const p of P) {
        if (!p.a) continue;
        const k = p.life / p.max;
        if (p.type === 0) {
          const sz = p.size * (0.55 + 0.6 * k);
          ctx.globalAlpha = Math.min(1, k * 1.3) * 0.9;
          ctx.drawImage(k > 0.55 ? GLOW.yellow : GLOW.orange, p.x - sz / 2, p.y - sz / 2, sz, sz);
        } else if (p.type === 2) {
          ctx.globalAlpha = k;
          ctx.fillStyle = '#ffd08a';
          ctx.fillRect(p.x, p.y, 2, 2);
        }
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }

    function drawFlashes() {
      ctx.globalCompositeOperation = 'lighter';
      for (const f of FL) {
        if (!f.a) continue;
        const u = f.t / f.max;
        const sz = f.size * (0.55 + u * 0.75);
        ctx.globalAlpha = Math.pow(1 - u, 1.4);
        ctx.drawImage(f.spr, f.x - sz / 2, f.y - sz / 2, sz, sz);
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }

    function drawRings() {
      ctx.lineWidth = 1.4;
      for (const r of RG) {
        if (!r.a) continue;
        const u = r.t / r.max, rad = (10 + u * 46) * S;
        ctx.strokeStyle = `rgba(190,215,240,${(0.55 * (1 - u)).toFixed(3)})`;
        ctx.beginPath(); ctx.ellipse(r.x, r.y, rad, rad * 0.26, 0, 0, 7); ctx.stroke();
      }
    }

    function drawTracers() {
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineWidth = 1.6;
      for (const tr of TR) {
        if (!tr.a) continue;
        ctx.strokeStyle = `rgba(255,${tr.t < 0.2 ? 190 : 110},70,${(1 - tr.t / tr.max).toFixed(2)})`;
        ctx.beginPath(); ctx.moveTo(tr.x - tr.vx * 0.045, tr.y - tr.vy * 0.045); ctx.lineTo(tr.x, tr.y); ctx.stroke();
      }
      ctx.globalCompositeOperation = 'source-over';
    }

    function drawFlare() {
      if (!flare.a) return;
      const up = 1.0;
      let y;
      if (flare.t < up) y = flare.y - (flare.y - H * 0.16) * (1 - Math.pow(1 - flare.t / up, 2));
      else y = H * 0.16 + (flare.t - up) * H * 0.028;
      const x = flare.x + Math.sin(flare.t * 0.9) * 14 * S;
      const fade = flare.t < up ? 1 : clamp(1 - (flare.t - 6.2) / 1.8, 0, 1);
      const fl = 0.85 + 0.15 * Math.sin(t * 23);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.5 * fade * fl;
      const R = 300 * S;
      ctx.drawImage(GLOW.white, x - R / 2, y - R / 2, R, R);
      ctx.globalAlpha = 0.16 * fade;                    // reflexo comprido no mar
      ctx.drawImage(GLOW.white, x - 90 * S, H * HZ + 4, 180 * S, H * 0.32);
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#fff'; ctx.fillRect(x - 1.5, y - 1.5, 3, 3);
      ctx.globalCompositeOperation = 'source-over';
      light = Math.max(light, 0.1 * fade);
    }

    function drawGlints() {
      if (level() === 0) return;
      const mx = W * 0.16, top = H * HZ, h = H * 0.3;
      ctx.fillStyle = 'rgba(200,220,255,0.8)';
      moonGlints.forEach(g => {
        const a = (0.5 + 0.5 * Math.sin(t * g.sp + g.ph)) * (0.55 - g.v * 0.3);
        if (a < 0.05) return;
        ctx.globalAlpha = a;
        ctx.fillRect(mx + g.u * (12 + g.v * W * 0.09), top + 8 + g.v * h, g.len * (0.6 + g.v), 1.4);
      });
      ctx.globalAlpha = 1;
    }

    return {
      resize(c, w, h, d) {
        ctx = c; cvs = c.canvas; W = w; H = h; dpr = d;
        S = clamp(W / 1366, 0.6, 1.35);
        buildBg();
        buildWaveGradients();
        buildShips();
        for (const p of P) p.a = 0;
        for (const p of PR) p.a = 0;
      },
      render(c, dt) {
        if (!bg) return;
        ctx = c;
        t += dt;
        update(dt);

        ctx.drawImage(bg, 0, 0, W, H);
        drawClouds(dt);
        drawGlints();
        drawBolt();
        drawBeams();

        ships.forEach(s => { if (s.far) { drawShip(s); drawReflection(s); } });
        drawWave(waves[0]); drawWave(waves[1]);
        ships.forEach(s => { if (!s.far) { drawShip(s); drawReflection(s); } });
        drawWave(waves[2]); drawWave(waves[3]);

        drawProjectiles();
        drawParticles();
        drawFlashes();
        drawRings();
        drawTracers();
        drawWave(waves[4]);
        drawFlare();

        if (light > 0.01 && level() > 0) {                // clarão geral do combate sobre a cena
          ctx.globalCompositeOperation = 'lighter';
          ctx.fillStyle = `rgba(255,140,70,${(light * 0.16).toFixed(3)})`;
          ctx.fillRect(0, 0, W, H);
          ctx.globalCompositeOperation = 'source-over';
        }
      },
    };
  }

  window.RNHero.register('dark', createWarScene());
})();
