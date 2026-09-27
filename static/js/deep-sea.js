/* ═══════════════════════════════════════════════════════════════
   ROYAL NAVY — MODO ESCURO: O MERGULHO (Canvas 2D)

   Conforme a página desce, o visitante afunda no oceano:
     1) DEEP     canvas FIXO (meia resolução) com a cor da água por profundidade,
                 raios de luz, neve marinha, bolhas, cardumes, submarinos e
                 clarões distantes, criaturas luminosas;
     2) SUBWAR   faixa "Guerra Submarina": torpedos, sonares, submarinos que
                 afundam, cargas de profundidade lançadas por navios na superfície;
     3) WRECKS   faixa "Navios Naufragados": destroieres partidos, um galeão,
                 um submarino e um porta-aviões no leito, algas, corais, cardumes;
     4) GAUGE    medidor de profundidade (m) e zona oceânica.

   Desempenho: os canvases só animam enquanto visíveis (IntersectionObserver),
   com a aba em primeiro plano e no modo escuro; o fundo fixo roda em 50% da
   resolução; partículas em pools; sprites pré-renderizados; RNPerf reduz efeitos.
   ═══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  const root    = document.documentElement;
  const $       = id => document.getElementById(id);
  const isDark  = () => root.getAttribute('data-theme') === 'dark';
  const level   = () => (window.RNPerf ? window.RNPerf.level : 2);
  const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const rnd     = (a, b) => a + Math.random() * (b - a);
  const clamp   = (v, a, b) => Math.max(a, Math.min(b, v));
  const mod     = (a, n) => ((a % n) + n) % n;
  const mk      = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

  function glow(rgb, size = 96) {
    const c = mk(size, size), g = c.getContext('2d');
    const gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gr.addColorStop(0,    `rgba(${rgb},1)`);
    gr.addColorStop(0.25, `rgba(${rgb},0.55)`);
    gr.addColorStop(1,    `rgba(${rgb},0)`);
    g.fillStyle = gr; g.fillRect(0, 0, size, size);
    return c;
  }
  const GL = {
    white:  glow('235,250,255'),
    cyan:   glow('90,225,240'),
    orange: glow('255,150,60'),
    red:    glow('255,70,50'),
    green:  glow('130,255,190'),
  };

  function fishSprite(dir, body = 'rgba(8,38,54,0.92)') {
    const c = mk(26, 12), g = c.getContext('2d');
    if (dir < 0) { g.translate(26, 0); g.scale(-1, 1); }
    g.fillStyle = body;
    g.beginPath(); g.ellipse(13, 6, 9, 3.8, 0, 0, 7); g.fill();
    g.beginPath(); g.moveTo(3, 6); g.lineTo(0, 1.5); g.lineTo(0, 10.5); g.closePath(); g.fill();
    g.fillStyle = 'rgba(160,230,240,0.55)'; g.fillRect(16, 4.6, 1.4, 1.4);
    return c;
  }
  const FISH = { r: fishSprite(1), l: fishSprite(-1) };

  /* Silhueta de submarino (proa à direita) — usada pela guerra submarina e pelo fundo */
  function subSprite(L, accent) {
    const pad = L * 0.06, w = Math.ceil(L + pad * 2), h = Math.ceil(L * 0.36), cy = h * 0.66;
    const c = mk(w, h), g = c.getContext('2d');
    const X = n => pad + n * L, Y = n => cy + n * L;

    // casco
    g.beginPath();
    g.moveTo(X(0), Y(0));
    g.bezierCurveTo(X(0.02), Y(-0.07), X(0.2), Y(-0.088), X(0.5), Y(-0.088));
    g.bezierCurveTo(X(0.82), Y(-0.088), X(0.97), Y(-0.05), X(1), Y(0));
    g.bezierCurveTo(X(0.97), Y(0.05), X(0.82), Y(0.078), X(0.5), Y(0.078));
    g.bezierCurveTo(X(0.2), Y(0.078), X(0.02), Y(0.05), X(0), Y(0));
    g.closePath();
    const hull = g.createLinearGradient(0, Y(-0.09), 0, Y(0.08));
    hull.addColorStop(0, '#3a5876'); hull.addColorStop(0.45, '#1a2c40'); hull.addColorStop(1, '#0a1520');
    g.fillStyle = hull; g.fill();

    // torre (vela), periscópio, lemes
    g.fillStyle = '#20364d';
    g.beginPath(); g.moveTo(X(0.4), Y(-0.08)); g.lineTo(X(0.42), Y(-0.16)); g.lineTo(X(0.53), Y(-0.16)); g.lineTo(X(0.56), Y(-0.08)); g.closePath(); g.fill();
    g.strokeStyle = '#2a425c'; g.lineWidth = Math.max(1.5, L * 0.006);
    g.beginPath(); g.moveTo(X(0.5), Y(-0.16)); g.lineTo(X(0.5), Y(-0.22)); g.lineTo(X(0.53), Y(-0.22)); g.stroke();
    g.fillStyle = '#1a2c40';
    g.fillRect(X(0.74), Y(-0.01), L * 0.07, L * 0.012);                                  // leme de proa
    g.beginPath(); g.moveTo(X(0.02), Y(-0.02)); g.lineTo(X(-0.03), Y(-0.1)); g.lineTo(X(0.06), Y(-0.06)); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(X(0.02), Y(0.02)); g.lineTo(X(-0.03), Y(0.1)); g.lineTo(X(0.06), Y(0.06)); g.closePath(); g.fill();
    for (let i = 0; i < 3; i++) {                                                          // hélice
      g.beginPath(); g.ellipse(X(-0.015), Y(-0.03 + i * 0.03), L * 0.008, L * 0.02, 0.3, 0, 7); g.fillStyle = '#3d556e'; g.fill();
    }

    // luar/reflexo no topo e luzes de navegação
    g.globalCompositeOperation = 'source-atop';
    const top = g.createLinearGradient(0, Y(-0.09), 0, Y(-0.02));
    top.addColorStop(0, `rgba(${accent},0.42)`); top.addColorStop(1, `rgba(${accent},0)`);
    g.fillStyle = top; g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = 'source-over';
    g.fillStyle = `rgba(${accent},0.95)`;
    for (let i = 0; i < 4; i++) g.fillRect(X(0.435 + i * 0.024), Y(-0.125), L * 0.009, L * 0.009);
    g.fillRect(X(0.955), Y(-0.008), L * 0.012, L * 0.012);
    return { c, w, h, cy, L };
  }

  /* ═════════════════════════ 1) MAR PROFUNDO (canvas fixo) ═════════════════════════ */
  const Gauge = (function () {
    const el = $('depth-gauge'), val = $('depth-value'), zone = $('depth-zone'), marker = $('depth-marker');
    const track = el && el.querySelector('.depth-gauge__track');
    if (!el) return { update() {}, measure() {} };
    const ZONES = [[0, 'Superfície'], [150, 'Zona fótica'], [900, 'Mesopelágica'], [2600, 'Batipelágica'], [3700, 'Abissal']];
    let lastM = -1, lastZone = '', trackW = 170, on = false;
    return {
      measure() { trackW = track ? track.clientWidth : 170; },
      update(d, show) {
        if (show !== on) { on = show; el.classList.toggle('is-on', show); }
        if (!show) return;
        const m = Math.round(d * 4200 / 10) * 10;
        if (m !== lastM) {
          lastM = m;
          val.textContent = m.toLocaleString('pt-BR') + ' m';
          let z = ZONES[0][1]; for (const zz of ZONES) if (m >= zz[0]) z = zz[1];
          if (z !== lastZone) { lastZone = z; zone.textContent = z; }
        }
        marker.style.transform = `translate3d(${(d * trackW).toFixed(1)}px, 0, 0)`;
      },
    };
  })();

  const Deep = (function () {
    const canvas = $('deep-canvas'), heroEl = $('hero');
    if (!canvas) return null;
    const ctx = canvas.getContext('2d', { alpha: false });
    const SC = 0.5;                                        // resolução do fundo (barato e suave)
    let cssW = 1, cssH = 1, docH = 1, heroH = 1, raf = 0, last = 0, t = 0;

    // cor da água por profundidade (0 = logo abaixo da superfície, 1 = leito)
    const STOPS = [[0, [14, 98, 118]], [0.12, [10, 76, 104]], [0.3, [8, 52, 84]], [0.55, [5, 31, 58]], [0.8, [3, 17, 32]], [1, [3, 12, 20]]];
    function colAt(d) {
      for (let i = 1; i < STOPS.length; i++) {
        if (d <= STOPS[i][0]) {
          const a = STOPS[i - 1], b = STOPS[i], k = (d - a[0]) / (b[0] - a[0] || 1);
          return `rgb(${(a[1][0] + (b[1][0] - a[1][0]) * k) | 0},${(a[1][1] + (b[1][1] - a[1][1]) * k) | 0},${(a[1][2] + (b[1][2] - a[1][2]) * k) | 0})`;
        }
      }
      return 'rgb(3,12,20)';
    }
    const dAt = y => clamp((y - heroH) / Math.max(1, docH - heroH), 0, 1);

    const shaft = (() => {
      const w = 180, h = 700, c = mk(w, h), g = c.getContext('2d');
      const gr = g.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, 'rgba(190,240,255,0.6)'); gr.addColorStop(1, 'rgba(190,240,255,0)');
      g.fillStyle = gr; g.beginPath(); g.moveTo(w * 0.42, 0); g.lineTo(w * 0.58, 0); g.lineTo(w, h); g.lineTo(0, h); g.closePath(); g.fill();
      return c;
    })();
    const distSub = subSprite(150, '120,235,255');

    const snow = Array.from({ length: 70 }, () => ({ x: Math.random(), y: Math.random(), s: 1 + Math.random() * 1.6, par: 0.15 + Math.random() * 0.7, v: 4 + Math.random() * 10 }));
    const bubbles = Array.from({ length: 28 }, () => ({ x: Math.random(), y: Math.random(), r: 1.5 + Math.random() * 3.2, par: 0.3 + Math.random() * 0.6, sp: 18 + Math.random() * 30, ph: Math.random() * 6.28 }));
    const shoals = [0.05, 0.13, 0.27].map((yf, i) => ({
      yf, dir: i % 2 ? -1 : 1, sp: 26 + i * 9, ph: Math.random() * 900,
      fish: Array.from({ length: 9 }, () => ({ ox: rnd(-70, 70), oy: rnd(-24, 24), w: rnd(0.8, 1.3), p: Math.random() * 6.28 })),
    }));
    const far = [0.22, 0.4, 0.6].map((yf, i) => ({ yf, dir: i % 2 ? -1 : 1, sp: 8 + i * 3, ph: Math.random() * 1000, fx: 0, fy: 0, ft: 9, next: rnd(2, 6) + i * 2 }));
    const creatures = Array.from({ length: 7 }, () => ({ yf: rnd(0.62, 0.96), x: Math.random(), sz: rnd(28, 60), ph: Math.random() * 6.28, sp: rnd(0.6, 1.4), c: Math.random() < 0.5 ? GL.cyan : GL.green }));

    function measure() {
      cssW = window.innerWidth; cssH = window.innerHeight;
      const W = Math.max(2, Math.round(cssW * SC)), H = Math.max(2, Math.round(cssH * SC));
      if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
      docH = Math.max(document.documentElement.scrollHeight, cssH + 1);
      heroH = heroEl ? heroEl.offsetHeight : cssH;
      Gauge.measure();
    }

    function draw(dt) {
      const sy = window.scrollY, d0 = dAt(sy), d1 = dAt(sy + cssH);
      const H = canvas.height, W = canvas.width;
      const g = ctx.createLinearGradient(0, 0, 0, H);
      for (let i = 0; i <= 4; i++) g.addColorStop(i / 4, colAt(d0 + (d1 - d0) * (i / 4)));
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

      ctx.save();
      ctx.scale(SC, SC);
      const q = level();

      // ── superfície (linha d'água) e raios de luz ──
      const top = heroH - sy;
      const lightK = Math.pow(1 - d0, 1.7);
      if (top < cssH + 40) {
        ctx.globalCompositeOperation = 'lighter';
        if (top > -60) {
          const wg = ctx.createLinearGradient(0, top, 0, top + 90);
          wg.addColorStop(0, 'rgba(160,235,245,0.4)'); wg.addColorStop(1, 'rgba(160,235,245,0)');
          ctx.fillStyle = wg;
          ctx.beginPath(); ctx.moveTo(0, top);
          for (let x = 0; x <= cssW + 20; x += 20) ctx.lineTo(x, top + Math.sin(x * 0.02 + t * 1.3) * 4 + Math.sin(x * 0.05 - t) * 2);
          ctx.lineTo(cssW, top + 90); ctx.lineTo(0, top + 90); ctx.closePath(); ctx.fill();
        }
        if (q > 0 && lightK > 0.02) {
          const sw = cssW * 0.3, sh = cssH * 1.5;
          [0.1, 0.36, 0.62, 0.88].forEach((fx, i) => {
            ctx.globalAlpha = 0.16 * lightK * (0.7 + 0.3 * Math.sin(t * 0.5 + i * 1.7));
            ctx.drawImage(shaft, cssW * fx - sw / 2 + Math.sin(t * 0.25 + i) * 30, top - 10, sw, sh);
          });
        }
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
      }

      // ── neve marinha (mais intensa com a profundidade) ──
      ctx.fillStyle = 'rgba(190,225,240,1)';
      const ns = Math.round(snow.length * [0.4, 0.7, 1][q]);
      ctx.globalAlpha = 0.28 + 0.4 * d0;
      for (let i = 0; i < ns; i++) {
        const p = snow[i];
        const y = mod(p.y * cssH - sy * p.par + t * p.v, cssH + 20) - 10;
        ctx.fillRect(mod(p.x * cssW + Math.sin(t * 0.4 + i) * 6, cssW), y, p.s, p.s);
      }
      ctx.globalAlpha = 1;

      // ── bolhas subindo ──
      ctx.strokeStyle = 'rgba(200,238,250,0.55)'; ctx.lineWidth = 0.9;
      ctx.beginPath();
      const nb = Math.round(bubbles.length * [0.4, 0.7, 1][q]);
      for (let i = 0; i < nb; i++) {
        const b = bubbles[i];
        const y = mod(b.y * cssH - sy * b.par - t * b.sp, cssH + 40) - 20;
        const x = b.x * cssW + Math.sin(t * 1.2 + b.ph) * 7;
        ctx.moveTo(x + b.r, y); ctx.arc(x, y, b.r, 0, 7);
      }
      ctx.stroke();

      // ── cardumes (perto da superfície) ──
      if (q > 0 && d0 < 0.55) {
        shoals.forEach(sh => {
          const yDoc = heroH + sh.yf * (docH - heroH), yy = yDoc - sy * 0.92;
          if (yy < -40 || yy > cssH + 40) return;
          const cx = mod(t * sh.sp * sh.dir + sh.ph, cssW + 320) - 160;
          ctx.globalAlpha = 0.55;
          const spr = sh.dir > 0 ? FISH.r : FISH.l;
          sh.fish.forEach(f => ctx.drawImage(spr, cx + f.ox, yy + f.oy + Math.sin(t * 3 + f.p) * 3, 26 * f.w, 12 * f.w));
        });
        ctx.globalAlpha = 1;
      }

      // ── submarinos distantes e clarões de batalha ao longe ──
      far.forEach(a => {
        const yDoc = heroH + a.yf * (docH - heroH), yy = yDoc - sy * 0.9;
        a.next -= dt;
        if (a.next <= 0) { a.next = rnd(5, 10); a.fx = rnd(0.1, 0.9) * cssW; a.fy = yy + rnd(-40, 40); a.ft = 0; }
        if (yy < -100 || yy > cssH + 100) return;
        const cx = mod(t * a.sp * a.dir + a.ph, cssW + 500) - 250;
        ctx.save();
        ctx.translate(cx, yy); ctx.scale(a.dir, 1);
        ctx.globalAlpha = 0.28;
        ctx.drawImage(distSub.c, -distSub.w / 2, -distSub.cy);
        ctx.restore();
        if (a.ft < 1.1) {                                   // explosão distante (clarão + onda)
          a.ft += dt;
          const u = a.ft / 1.1;
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = 0.5 * (1 - u);
          const R = 190 * (0.4 + u * 0.8);
          ctx.drawImage(GL.orange, a.fx - R / 2, (a.fy + (yy - a.fy) * 0) - R / 2, R, R);
          ctx.globalAlpha = 0.35 * (1 - u);
          ctx.strokeStyle = 'rgba(180,230,245,1)'; ctx.lineWidth = 1.4;
          ctx.beginPath(); ctx.arc(a.fx, a.fy, 20 + u * 120, 0, 7); ctx.stroke();
          ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
        }
      });

      // ── criaturas luminosas (só nas profundezas) ──
      if (d0 > 0.35) {
        ctx.globalCompositeOperation = 'lighter';
        creatures.forEach(cr => {
          const yy = heroH + cr.yf * (docH - heroH) - sy * 0.95;
          if (yy < -80 || yy > cssH + 80) return;
          const x = mod(cr.x * cssW + t * 6 * cr.sp, cssW + 120) - 60;
          ctx.globalAlpha = (0.16 + 0.16 * Math.sin(t * cr.sp + cr.ph)) * clamp((d0 - 0.3) * 3, 0, 1) * 1.6;
          ctx.drawImage(cr.c, x - cr.sz / 2, yy - cr.sz / 2, cr.sz, cr.sz);
        });
        ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      }

      ctx.restore();

      Gauge.update(clamp((sy + cssH * 0.5 - heroH) / Math.max(1, docH - heroH), 0, 1), sy > cssH * 0.4);
    }

    function frame(now) {
      raf = requestAnimationFrame(frame);
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now; t += dt;
      draw(dt);
    }

    let pendingStatic = 0;
    function staticDraw() { if (!pendingStatic) pendingStatic = requestAnimationFrame(() => { pendingStatic = 0; draw(0); }); }

    function sync() {
      const want = isDark() && !document.hidden && window.scrollY > 2;
      if (REDUCED) { if (isDark()) staticDraw(); return; }
      if (want && !raf) { last = performance.now(); raf = requestAnimationFrame(frame); }
      else if (!want && raf) { cancelAnimationFrame(raf); raf = 0; }
    }

    function remeasure() {
      if (!isDark()) { sync(); return; }                   // no modo claro este fundo nem mede o layout
      measure(); sync();
      if (REDUCED) staticDraw();
    }

    window.addEventListener('scroll', sync, { passive: true });
    window.addEventListener('resize', remeasure);
    new ResizeObserver(remeasure).observe(document.body);
    document.addEventListener('visibilitychange', sync);
    document.addEventListener('rn:themechange', () => requestAnimationFrame(remeasure));
    if (isDark()) measure();
    sync();
    return { remeasure };
  })();

  /* ═════════════════ utilitário: canvas de faixa com visibilidade ═════════════════ */
  function band(canvasId, onResize, onFrame) {
    const canvas = $(canvasId);
    if (!canvas) return null;
    const box = canvas.parentElement;
    const ctx = canvas.getContext('2d');
    let W = 0, H = 0, dpr = 1, raf = 0, last = 0, t = 0, visible = false;

    function resize() {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      if (!w || !h) return;
      dpr = Math.min(window.devicePixelRatio || 1, 1.25);
      W = w; H = h;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      onResize(ctx, W, H, dpr);
      if (!raf) { ctx.clearRect(0, 0, W, H); onFrame(ctx, 0, 0); }
    }
    function frame(now) {
      raf = requestAnimationFrame(frame);
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now; t += dt;
      onFrame(ctx, dt, t);
    }
    function sync() {
      const want = isDark() && visible && !document.hidden && !REDUCED;
      if (want && !raf) { last = performance.now(); raf = requestAnimationFrame(frame); }
      else if (!want && raf) { cancelAnimationFrame(raf); raf = 0; }
    }
    new ResizeObserver(resize).observe(canvas);
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; sync(); }, { rootMargin: '80px 0px' }).observe(box);
    document.addEventListener('visibilitychange', sync);
    document.addEventListener('rn:themechange', () => requestAnimationFrame(() => { resize(); sync(); }));
    resize(); sync();
    return { sync };
  }

  /* ═════════════════════════ 2) GUERRA SUBMARINA ═════════════════════════ */
  (function subWar() {
    const TEAL = '110,240,255', RED = '255,90,70';
    let W = 0, H = 0, S = 1, sprA = null, sprB = null, sprC = null;
    let shake = 0, chargeCool = 2;
    const subs = [];
    const TP = Array.from({ length: 8 },  () => ({ a: 0, x: 0, y: 0, dir: 1, tx: 0, ty: 0, hit: false, tgt: null, acc: 0, vy: 0 }));
    const BUB = Array.from({ length: 150 }, () => ({ a: 0, x: 0, y: 0, vx: 0, vy: 0, r: 2, life: 1, max: 1 }));
    const RG = Array.from({ length: 18 }, () => ({ a: 0, x: 0, y: 0, t: 0, max: 2, R: 100, col: TEAL, kind: 0 }));
    const FLS = Array.from({ length: 10 }, () => ({ a: 0, x: 0, y: 0, t: 0, max: 0.4, size: 100 }));
    const CH = Array.from({ length: 6 },  () => ({ a: 0, x: 0, y: 0, vy: 0, fuse: 0, acc: 0 }));
    const DB = Array.from({ length: 30 }, () => ({ a: 0, x: 0, y: 0, vx: 0, vy: 0, rot: 0, vr: 0, s: 3, life: 1, max: 1 }));
    let bi = 0;

    const bubble = (x, y, vx, vy, r, life) => {
      const cap = [60, 100, 150][level()];
      for (let k = 0; k < cap; k++) { bi = (bi + 1) % cap; const b = BUB[bi]; if (!b.a) { b.a = 1; b.x = x; b.y = y; b.vx = vx; b.vy = vy; b.r = r; b.life = b.max = life; return; } }
    };
    const ring = (x, y, R, max, col, kind) => { for (const r of RG) if (!r.a) { r.a = 1; r.x = x; r.y = y; r.t = 0; r.max = max; r.R = R; r.col = col; r.kind = kind; return; } };
    const flash = (x, y, size, max) => { for (const f of FLS) if (!f.a) { f.a = 1; f.x = x; f.y = y; f.t = 0; f.size = size; f.max = max; return; } };

    function boom(x, y, k) {
      flash(x, y, 240 * S * k, 0.55);
      ring(x, y, 190 * S * k, 0.85, '210,245,255', 1);
      ring(x, y, 120 * S * k, 0.6, '255,190,120', 1);
      const nb = Math.round(22 * [0.5, 0.8, 1][level()] * k);
      for (let i = 0; i < nb; i++) { const a = rnd(0, 6.28), v = rnd(30, 150) * S * k; bubble(x, y, Math.cos(a) * v, Math.sin(a) * v - 40, rnd(2, 6) * S, rnd(1.2, 2.4)); }
      for (const d of DB) { if (!d.a && Math.random() < 0.6) { const a = rnd(0, 6.28), v = rnd(40, 130) * S * k; d.a = 1; d.x = x; d.y = y; d.vx = Math.cos(a) * v; d.vy = Math.sin(a) * v; d.rot = 0; d.vr = rnd(-6, 6); d.s = rnd(2, 5) * S; d.life = d.max = rnd(1, 2); } }
      shake = Math.max(shake, 7 * k * S);
    }

    function makeSub(spr, dir, fx, fy, L, alpha, combatant) {
      return { spr, dir, bx: fx * W, by: fy * H, L, x: fx * W, y: fy * H, ph: Math.random() * 6.28, hp: 2, state: 'ok', alpha, baseAlpha: alpha, cool: rnd(1.4, 3), ping: rnd(0.5, 2.5), leak: 0, sinkT: 0, rot: 0, gone: 0, combatant, accent: dir > 0 ? TEAL : RED };
    }
    const enemyOf = s => subs.find(o => o.combatant && o.dir !== s.dir && o.state === 'ok');

    function fireTorp(s) {
      const tgt = enemyOf(s);
      if (!tgt) return;
      const p = TP.find(o => !o.a);
      if (!p) return;
      p.a = 1; p.x = s.x + s.dir * s.L * 0.5; p.y = s.y + 2 * S; p.dir = s.dir;
      p.hit = Math.random() < 0.55; p.tgt = tgt; p.acc = 0;
      p.tx = tgt.x; p.ty = p.hit ? tgt.y : tgt.y + rnd(0.09, 0.16) * H * (Math.random() < 0.5 ? 1 : -1);
      p.vy = (p.ty - p.y) / Math.max(0.5, Math.abs(p.tx - p.x) / (W * 0.55));
      flash(p.x, p.y, 70 * S, 0.3);
    }

    function dropCharge(x) {
      const c = CH.find(o => !o.a);
      if (!c) return;
      c.a = 1; c.x = x; c.y = 30 * S; c.vy = rnd(70, 100) * S; c.fuse = rnd(0.42, 0.74) * H; c.acc = 0;
    }

    band('sub-canvas', (ctx, w, h) => {
      W = w; H = h; S = clamp(W / 1366, 0.6, 1.3);
      const L = clamp(W * 0.27, 190, 420);
      sprA = subSprite(L, TEAL); sprB = subSprite(L, RED); sprC = subSprite(L * 0.62, '150,200,220');
      subs.length = 0;
      subs.push(makeSub(sprA, 1, 0.24, 0.66, L, 1, true));
      subs.push(makeSub(sprB, -1, 0.76, 0.74, L, 1, true));
      subs.push(makeSub(sprC, 1, 0.5, 0.9, L * 0.62, 0.42, false));
      for (const a of [TP, BUB, RG, FLS, CH, DB]) a.forEach(o => (o.a = 0));
    }, (ctx, dt, t) => {
      if (!W) return;
      const q = level();

      /* ── simulação ── */
      for (const s of subs) {
        s.x = s.bx + Math.sin(t * 0.25 + s.ph) * W * 0.05 * (s.combatant ? 1 : 3);
        s.y = s.by + Math.sin(t * 0.42 + s.ph) * H * 0.018 + (s.state === 'sinking' ? s.sinkT * 60 * S : 0);
        s.rot = Math.sin(t * 0.3 + s.ph) * 0.03 + (s.state === 'sinking' ? s.sinkT * 0.45 * s.dir : 0);

        if (s.state === 'ok') {
          if (s.combatant) {
            s.cool -= dt; if (s.cool <= 0) { s.cool = rnd(2.3, 3.8); fireTorp(s); }
            s.ping -= dt; if (s.ping <= 0) { s.ping = rnd(3.2, 4.4); ring(s.x, s.y, W * 0.42, 2.4, s.accent, 0); }
          }
          if (s.leak > 0) { s.leak -= dt; if (Math.random() < dt * 14) bubble(s.x + rnd(-0.2, 0.2) * s.L, s.y - 6 * S, rnd(-8, 8), rnd(-60, -30) * S, rnd(1.5, 3.4) * S, rnd(1.5, 2.4)); }
        } else if (s.state === 'sinking') {
          s.sinkT = Math.min(1, s.sinkT + dt / 3.4);
          s.alpha = s.baseAlpha * (1 - clamp((s.sinkT - 0.55) / 0.45, 0, 1));
          if (Math.random() < dt * 22) bubble(s.x + rnd(-0.3, 0.3) * s.L, s.y - 4 * S, rnd(-14, 14), rnd(-70, -30) * S, rnd(2, 5) * S, rnd(1.4, 2.4));
          if (s.sinkT >= 1) { s.state = 'gone'; s.gone = 2.6; }
        } else if (s.state === 'gone') {
          s.gone -= dt;
          if (s.gone <= 0) { s.state = 'ok'; s.hp = 2; s.sinkT = 0; s.alpha = 0; s.fade = 1; s.cool = rnd(1.2, 2); s.leak = 0; }
        }
        if (s.fade) { s.alpha = Math.min(s.baseAlpha, s.alpha + dt / 1.6); if (s.alpha >= s.baseAlpha) s.fade = 0; }
      }

      for (const p of TP) {
        if (!p.a) continue;
        const v = W * 0.55 * dt;
        p.x += p.dir * v; p.y += p.vy * dt + Math.sin(t * 14 + p.x * 0.05) * 0.25;
        p.acc += v;
        while (p.acc > 15 * S) { p.acc -= 15 * S; bubble(p.x - p.dir * 10 * S, p.y, rnd(-6, 6), rnd(-14, -4) * S, rnd(1.2, 2.4) * S, rnd(0.9, 1.5)); }
        if (p.dir * (p.x - p.tx) >= 0) {
          p.a = 0;
          if (p.hit && p.tgt && p.tgt.state === 'ok') {
            boom(p.x, p.y, 1);
            p.tgt.hp--; p.tgt.leak = 6;
            if (p.tgt.hp <= 0) { p.tgt.state = 'sinking'; p.tgt.sinkT = 0; boom(p.tgt.x, p.tgt.y, 1.2); }
          } else { flash(p.x, p.y, 90 * S, 0.3); ring(p.x, p.y, 70 * S, 0.7, '210,245,255', 1); }
        }
        if (p.x < -60 || p.x > W + 60) p.a = 0;
      }

      chargeCool -= dt;
      if (chargeCool <= 0) { chargeCool = rnd(3.2, 5.5); dropCharge(rnd(0.18, 0.82) * W); }
      for (const c of CH) {
        if (!c.a) continue;
        c.y += c.vy * dt; c.acc += c.vy * dt;
        while (c.acc > 14 * S) { c.acc -= 14 * S; bubble(c.x, c.y - 4 * S, rnd(-6, 6), rnd(-20, -6) * S, rnd(1.2, 2.2) * S, rnd(0.8, 1.3)); }
        if (c.y >= c.fuse) { c.a = 0; boom(c.x, c.y, 1.5); }
      }
      for (const b of BUB) if (b.a) { b.life -= dt; if (b.life <= 0) { b.a = 0; continue; } b.x += b.vx * dt; b.y += b.vy * dt; b.vx *= 1 - 0.8 * dt; b.vy -= 8 * S * dt; }
      for (const d of DB) if (d.a) { d.life -= dt; if (d.life <= 0) { d.a = 0; continue; } d.x += d.vx * dt; d.y += d.vy * dt; d.vy += 30 * S * dt; d.vx *= 1 - dt; d.rot += d.vr * dt; }
      for (const r of RG) if (r.a) { r.t += dt; if (r.t >= r.max) r.a = 0; }
      for (const f of FLS) if (f.a) { f.t += dt; if (f.t >= f.max) f.a = 0; }
      shake *= Math.pow(0.02, dt);

      /* ── desenho ── */
      ctx.clearRect(0, 0, W, H);
      ctx.save();
      if (shake > 0.2) ctx.translate(rnd(-shake, shake), rnd(-shake, shake));

      // cascos de navios na superfície (soltam as cargas de profundidade)
      ctx.fillStyle = 'rgba(6,16,26,0.92)';
      [0.32, 0.7].forEach((fx, i) => {
        const x = fx * W + Math.sin(t * 0.3 + i * 2) * 20 * S, k = S;
        ctx.beginPath();
        ctx.moveTo(x - 150 * k, -6); ctx.lineTo(x - 128 * k, 20 * k); ctx.lineTo(x + 120 * k, 24 * k); ctx.lineTo(x + 160 * k, -6); ctx.closePath(); ctx.fill();
        if (q > 0 && Math.random() < dt * 8) bubble(x - 125 * k, 24 * k, rnd(-10, 10), rnd(20, 40) * S, rnd(1.4, 2.8) * S, rnd(0.8, 1.4));   // esteira da hélice
      });

      // anéis de sonar e ondas de choque
      ctx.lineWidth = 1.6;
      for (const r of RG) {
        if (!r.a) continue;
        const u = r.t / r.max, rad = r.R * (r.kind ? Math.pow(u, 0.6) : u);
        ctx.strokeStyle = `rgba(${r.col},${((r.kind ? 0.7 : 0.5) * (1 - u)).toFixed(3)})`;
        ctx.lineWidth = r.kind ? 2.4 * (1 - u) + 0.6 : 1.5;
        ctx.beginPath(); ctx.arc(r.x, r.y, rad, 0, 7); ctx.stroke();
      }

      // submarinos
      for (const s of subs) {
        if (s.state === 'gone' || s.alpha <= 0.01) continue;
        ctx.save();
        ctx.globalAlpha = s.alpha;
        ctx.translate(s.x, s.y); ctx.rotate(s.rot); ctx.scale(s.dir, 1);
        ctx.drawImage(s.spr.c, -s.spr.w / 2, -s.spr.cy);
        ctx.restore();
        if (s.combatant && s.state === 'ok') {                 // brilho pulsante das luzes de bordo
          const k = (0.5 + 0.5 * Math.sin(t * 2.6 + s.ph)) * (s.leak > 0 && Math.sin(t * 22) > 0 ? 0.2 : 1);
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = 0.4 * k;
          const R = 46 * S, gx = s.x + s.dir * s.L * 0.02, gy = s.y - s.L * 0.13;
          ctx.drawImage(s.dir > 0 ? GL.cyan : GL.red, gx - R / 2, gy - R / 2, R, R);
          ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
        }
      }

      // torpedos e cargas de profundidade
      ctx.globalCompositeOperation = 'lighter';
      for (const p of TP) {
        if (!p.a) continue;
        const R = 34 * S;
        ctx.globalAlpha = 0.9; ctx.drawImage(GL.white, p.x - R / 2, p.y - R / 2, R, R);
        ctx.globalAlpha = 1; ctx.fillStyle = '#fff';
        ctx.fillRect(p.x - 7 * S, p.y - 1.4, 14 * S, 2.8);
      }
      ctx.globalCompositeOperation = 'source-over';
      for (const c of CH) {
        if (!c.a) continue;
        ctx.fillStyle = '#2b3a49'; ctx.fillRect(c.x - 4.5 * S, c.y - 7 * S, 9 * S, 14 * S);
        ctx.fillStyle = '#4c6072'; ctx.fillRect(c.x - 4.5 * S, c.y - 7 * S, 9 * S, 2.5 * S);
        if (Math.sin(t * 12 + c.x) > 0) { ctx.fillStyle = '#ff4a3a'; ctx.fillRect(c.x - 1.4 * S, c.y - 2 * S, 2.8 * S, 2.8 * S); }
      }

      // bolhas (um único traçado)
      ctx.strokeStyle = 'rgba(205,240,252,0.6)'; ctx.lineWidth = 1;
      ctx.beginPath();
      for (const b of BUB) { if (!b.a) continue; const r = b.r * (0.5 + 0.5 * (b.life / b.max)); ctx.moveTo(b.x + r, b.y); ctx.arc(b.x, b.y, r, 0, 7); }
      ctx.stroke();

      // destroços
      ctx.fillStyle = '#243444';
      for (const d of DB) {
        if (!d.a) continue;
        ctx.save(); ctx.globalAlpha = d.life / d.max; ctx.translate(d.x, d.y); ctx.rotate(d.rot); ctx.fillRect(-d.s, -d.s / 2, d.s * 2, d.s); ctx.restore();
      }

      // clarões
      ctx.globalCompositeOperation = 'lighter';
      for (const f of FLS) {
        if (!f.a) continue;
        const u = f.t / f.max, sz = f.size * (0.5 + u * 0.8);
        ctx.globalAlpha = Math.pow(1 - u, 1.3);
        ctx.drawImage(GL.orange, f.x - sz / 2, f.y - sz / 2, sz, sz);
        ctx.drawImage(GL.white, f.x - sz * 0.3, f.y - sz * 0.3, sz * 0.6, sz * 0.6);
      }
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      ctx.restore();
    });
  })();

  /* ═════════════════════════ 3) NAUFRÁGIOS ═════════════════════════ */
  (function wrecks() {
    let W = 0, H = 0, S = 1, floor = null, sprites = null, layout = [], weeds = [], floorY = 0;
    const snow = Array.from({ length: 46 }, () => ({ x: Math.random(), y: Math.random(), s: 1 + Math.random() * 1.5, v: 3 + Math.random() * 8, ph: Math.random() * 6.28 }));
    const BUB = Array.from({ length: 70 }, () => ({ a: 0, x: 0, y: 0, vx: 0, vy: 0, r: 2, life: 1, max: 1 }));
    const shoals = [0, 1].map(i => ({ dir: i ? -1 : 1, sp: 22 + i * 12, ph: Math.random() * 900, y: 0.36 + i * 0.16, fish: Array.from({ length: 10 }, () => ({ ox: rnd(-80, 80), oy: rnd(-26, 26), w: rnd(0.8, 1.3), p: Math.random() * 6.28 })) }));
    const emitters = [{ fx: 0.4, acc: 0 }, { fx: 0.62, acc: 0 }, { fx: 0.86, acc: 0 }];
    let bi = 0, beacon = { t: 0 }, rings = [];

    function seeded(seed) { let s = seed; return () => ((s = (s * 16807) % 2147483647) / 2147483647); }

    /* silhuetas dos naufrágios: polígonos quebrados, cavernas, corais e ferrugem */
    function wreckSprite(kind, Lw, seed) {
      const r = seeded(seed);
      const pad = Lw * 0.06, w = Math.ceil(Lw + pad * 2), h = Math.ceil(Lw * 0.62), by = h * 0.72;
      const c = mk(w, h), g = c.getContext('2d');
      const X = n => pad + n * Lw, Y = n => by + n * Lw - Lw * 0.3;
      const poly = (pts, fill) => { g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(X(p[0]), Y(p[1])) : g.moveTo(X(p[0]), Y(p[1])))); g.closePath(); g.fillStyle = fill; g.fill(); };
      const line = (x0, y0, x1, y1, wd, col) => { g.strokeStyle = col; g.lineWidth = Math.max(1.2, wd * Lw); g.lineCap = 'round'; g.beginPath(); g.moveTo(X(x0), Y(y0)); g.lineTo(X(x1), Y(y1)); g.stroke(); };
      const HULL = '#16303a', DARK = '#0c1d26', MID = '#1d3b47';
      let topEdge = [];

      if (kind === 'destroyerBow') {
        poly([[0, 0.2], [0.05, 0.14], [0.02, 0.08], [0.09, 0.04], [0.3, 0.04], [0.32, -0.03], [0.37, -0.03], [0.38, 0.04], [0.78, 0.04], [1, 0.16], [0.99, 0.22], [0.9, 0.3], [0.06, 0.3]], HULL);
        poly([[0.31, -0.03], [0.34, -0.09], [0.4, -0.06], [0.38, 0.04]], MID);
        g.fillStyle = DARK; g.fillRect(X(0.62), Y(-0.02), Lw * 0.1, Lw * 0.06);
        line(0.72, 0.0, 0.88, 0.1, 0.012, MID);                        // canhão tombado
        line(0.5, 0.04, 0.47, -0.16, 0.008, MID); line(0.47, -0.16, 0.56, -0.24, 0.006, MID);   // mastro quebrado
        for (let i = 0; i < 9; i++) { g.fillStyle = 'rgba(120,230,240,0.22)'; g.fillRect(X(0.12 + i * 0.07), Y(0.13), Lw * 0.014, Lw * 0.014); }
        topEdge = [0.1, 0.2, 0.45, 0.6, 0.72, 0.9];
      } else if (kind === 'destroyerStern') {
        poly([[0, 0.14], [0.2, 0.04], [0.64, 0.04], [0.7, -0.06], [0.82, -0.06], [0.84, 0.04], [0.95, 0.06], [1, 0.12], [0.96, 0.2], [0.99, 0.26], [0.9, 0.3], [0.05, 0.3]], HULL);
        poly([[0.69, -0.06], [0.76, -0.13], [0.83, -0.06]], MID);
        g.fillStyle = DARK; g.fillRect(X(0.12), Y(0.0), Lw * 0.1, Lw * 0.05);
        line(0.22, 0.02, 0.36, -0.06, 0.012, MID);
        line(0.02, 0.24, -0.02, 0.36, 0.01, MID);                       // eixo/hélice
        for (let i = 0; i < 7; i++) { g.fillStyle = 'rgba(120,230,240,0.2)'; g.fillRect(X(0.1 + i * 0.09), Y(0.13), Lw * 0.014, Lw * 0.014); }
        topEdge = [0.15, 0.3, 0.5, 0.75, 0.9];
      } else if (kind === 'galleon') {
        poly([[0, 0.22], [0.06, 0.32], [0.9, 0.32], [1, 0.14], [0.95, 0.04], [0.78, 0.02], [0.7, -0.05], [0.55, 0.0], [0.12, 0.02]], '#2a3a2c');
        g.strokeStyle = DARK; g.lineWidth = Math.max(1.2, Lw * 0.006);
        for (let i = 0; i < 12; i++) { const x = 0.1 + i * 0.07; g.beginPath(); g.moveTo(X(x), Y(0.03)); g.lineTo(X(x - 0.01), Y(0.16 + r() * 0.06)); g.stroke(); }
        for (let i = 0; i < 9; i++) { g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(X(0.12 + i * 0.09), Y(0.2), Lw * 0.024, Lw * 0.02); }   // portinholas
        line(0.25, 0.02, 0.2, -0.28, 0.01, '#3b4a3c'); line(0.2, -0.28, 0.27, -0.33, 0.006, '#3b4a3c');
        line(0.5, 0.0, 0.53, -0.2, 0.01, '#3b4a3c'); line(0.55, -0.24, 0.66, -0.16, 0.009, '#3b4a3c');
        line(0.78, 0.02, 0.88, -0.2, 0.008, '#3b4a3c'); line(1.0, 0.1, 1.12, 0.02, 0.008, '#3b4a3c');
        g.fillStyle = 'rgba(180,170,140,0.22)';                          // trapos de velas
        [[0.2, -0.24], [0.5, -0.16], [0.8, -0.16]].forEach(([sx, sy]) => { g.beginPath(); g.moveTo(X(sx), Y(sy)); g.lineTo(X(sx + 0.07), Y(sy + 0.06)); g.lineTo(X(sx + 0.02), Y(sy + 0.12)); g.lineTo(X(sx - 0.04), Y(sy + 0.07)); g.closePath(); g.fill(); });
        topEdge = [0.15, 0.3, 0.6, 0.85];
      } else if (kind === 'sub') {
        g.beginPath(); g.ellipse(X(0.5), Y(0.14), Lw * 0.5, Lw * 0.085, 0, 0, 7); g.fillStyle = HULL; g.fill();
        poly([[0.42, 0.08], [0.45, -0.03], [0.56, -0.03], [0.6, 0.08]], MID);
        line(0.5, -0.03, 0.5, -0.12, 0.006, MID); line(0.5, -0.12, 0.56, -0.12, 0.005, MID);
        g.fillStyle = MID; g.fillRect(X(0.72), Y(0.14), Lw * 0.09, Lw * 0.012);
        g.fillStyle = 'rgba(255,90,60,0.7)'; g.fillRect(X(0.95), Y(0.13), Lw * 0.012, Lw * 0.012);
        topEdge = [0.25, 0.5, 0.75];
      } else {                                                           // carrier (fundo)
        poly([[0, 0.14], [0.02, 0.3], [0.96, 0.3], [1, 0.18], [0.98, 0.1]], HULL);
        poly([[0.0, 0.05], [0.98, 0.05], [0.98, 0.11], [0.0, 0.11]], MID);
        poly([[0.62, -0.08], [0.7, -0.08], [0.71, 0.05], [0.61, 0.05]], MID);
        line(0.66, -0.08, 0.66, -0.2, 0.006, MID); line(0.6, -0.15, 0.72, -0.15, 0.004, MID);
        for (let i = 0; i < 4; i++) line(0.1 + i * 0.16, 0.05, 0.13 + i * 0.16, 0.0, 0.01, DARK);
        topEdge = [0.1, 0.35, 0.8];
      }

      // corais e ferrugem sobre o metal (só nos pixels já desenhados)
      g.globalCompositeOperation = 'source-atop';
      for (let i = 0; i < 26; i++) {
        const x = pad + r() * Lw, y = by - Lw * 0.3 + (r() * 0.34 - 0.06) * Lw;
        g.fillStyle = ['rgba(150,70,40,0.35)', 'rgba(60,40,28,0.5)', 'rgba(70,150,120,0.28)'][(r() * 3) | 0];
        g.beginPath(); g.ellipse(x, y, (0.01 + r() * 0.03) * Lw, (0.006 + r() * 0.014) * Lw, r() * 3, 0, 7); g.fill();
      }
      const fog = g.createLinearGradient(0, 0, 0, h);
      fog.addColorStop(0, 'rgba(90,190,210,0.18)'); fog.addColorStop(1, 'rgba(0,0,0,0.42)');
      g.fillStyle = fog; g.fillRect(0, 0, w, h);
      g.globalCompositeOperation = 'source-over';

      // corais vivos no alto do casco
      topEdge.forEach(tx => {
        const cx = X(tx), cy = Y(kind === 'galleon' ? 0.02 : 0.04);
        [['#d9694a', 1], ['#e8a24a', 0.7], ['#6ad0b0', 0.8]].forEach(([col, k], j) => {
          g.fillStyle = col; g.globalAlpha = 0.75;
          for (let n = 0; n < 3; n++) { g.beginPath(); g.ellipse(cx + (j * 7 + n * 5 - 10) * (Lw / 700), cy - (2 + n * 2) * (Lw / 700), 5 * k * (Lw / 700), 4 * k * (Lw / 700), 0, 0, 7); g.fill(); }
        });
        g.globalAlpha = 1;
      });
      return { c, w, h, by, Lw };
    }

    band('wreck-canvas', (ctx, w, h) => {
      W = w; H = h; S = clamp(W / 1366, 0.6, 1.3);
      floorY = H * 0.8;
      const Lw = k => W * k;
      sprites = {
        carrier: wreckSprite('carrier', Lw(0.5), 3),
        bow:     wreckSprite('destroyerBow', Lw(0.3), 11),
        stern:   wreckSprite('destroyerStern', Lw(0.27), 19),
        galleon: wreckSprite('galleon', Lw(0.22), 27),
        sub:     wreckSprite('sub', Lw(0.2), 35),
      };
      // [sprite, x central, y da quilha, rotação, alpha]
      layout = [
        [sprites.carrier, 0.24, floorY - H * 0.02, -0.06, 0.5],
        [sprites.bow,     0.42, floorY + H * 0.005, -0.1, 1],
        [sprites.galleon, 0.63, floorY + H * 0.01, 0.34, 1],
        [sprites.stern,   0.84, floorY + H * 0.01, 0.16, 1],
        [sprites.sub,     0.08, floorY + H * 0.03, -0.2, 1],
      ];

      // leito de areia (fica na frente da base dos naufrágios)
      floor = mk(Math.round(w * 1.25), Math.round(h * 1.25));
      const g = floor.getContext('2d'); g.scale(1.25, 1.25);
      const line = x => floorY + Math.sin(x * 0.004) * 9 * S + Math.sin(x * 0.011 + 1) * 5 * S;
      g.beginPath(); g.moveTo(0, h); g.lineTo(0, line(0));
      for (let x = 0; x <= w; x += 10) g.lineTo(x, line(x));
      g.lineTo(w, h); g.closePath();
      const sand = g.createLinearGradient(0, floorY - 10, 0, h);
      sand.addColorStop(0, '#1d3a44'); sand.addColorStop(0.35, '#0f2530'); sand.addColorStop(1, '#030b13');
      g.fillStyle = sand; g.fill();
      for (let i = 0; i < 40; i++) {                                     // pedras e conchas
        const x = Math.random() * w, y = line(x) + rnd(4, 60) * S;
        g.fillStyle = `rgba(${(60 + Math.random() * 50) | 0},${(90 + Math.random() * 50) | 0},${(100 + Math.random() * 50) | 0},0.35)`;
        g.beginPath(); g.ellipse(x, y, rnd(2, 8) * S, rnd(1.5, 4) * S, 0, 0, 7); g.fill();
      }
      // âncora e canhões espalhados
      g.strokeStyle = 'rgba(70,100,110,0.8)'; g.lineWidth = 2.5 * S; g.lineCap = 'round';
      const ax = W * 0.5, ay = line(ax) + 14 * S;
      g.beginPath(); g.moveTo(ax, ay - 18 * S); g.lineTo(ax, ay + 12 * S); g.moveTo(ax - 12 * S, ay - 8 * S); g.lineTo(ax + 12 * S, ay - 8 * S);
      g.arc(ax, ay + 4 * S, 12 * S, 0.2, Math.PI - 0.2); g.stroke();
      for (let i = 0; i < 4; i++) { const cx = W * (0.15 + i * 0.22) + rnd(-20, 20), cy = line(cx) + rnd(8, 30) * S; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + 26 * S, cy - 4 * S); g.stroke(); }

      // algas ancoradas no leito e nos cascos
      weeds = [];
      for (let i = 0; i < 20; i++) { const x = rnd(0.02, 0.98) * W; weeds.push({ x, y: line(x) + 4 * S, h: rnd(40, 110) * S, ph: Math.random() * 6.28, col: i % 2 }); }
      layout.forEach(([spr, fx, fy]) => { if (spr === sprites.carrier) return; for (let i = 0; i < 2; i++) weeds.push({ x: fx * W + rnd(-0.4, 0.4) * spr.Lw, y: fy - spr.Lw * 0.06, h: rnd(30, 70) * S, ph: Math.random() * 6.28, col: i % 2 }); });
      BUB.forEach(b => (b.a = 0));
    }, (ctx, dt, t) => {
      if (!W) return;
      const q = level();
      ctx.clearRect(0, 0, W, H);

      // raios de luz fracos vindos de cima
      if (q > 0) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = 'rgba(120,200,220,0.05)';
        [0.15, 0.5, 0.82].forEach((fx, i) => {
          const x = W * fx + Math.sin(t * 0.2 + i * 2) * 26, top = H * 0.05;
          ctx.beginPath(); ctx.moveTo(x - 16, top); ctx.lineTo(x + 16, top); ctx.lineTo(x + 130, floorY); ctx.lineTo(x - 130, floorY); ctx.closePath(); ctx.fill();
        });
        ctx.globalCompositeOperation = 'source-over';
      }

      // naufrágios (o de fundo é mais esmaecido)
      layout.forEach(([spr, fx, fy, rot, a]) => {
        ctx.save();
        ctx.globalAlpha = a;
        ctx.translate(fx * W, fy); ctx.rotate(rot);
        ctx.drawImage(spr.c, -spr.w / 2, -spr.by);
        ctx.restore();
      });

      // baliza de socorro piscando no destroier + anel de sonar
      beacon.t += dt;
      const bx = 0.42 * W - sprites.bow.Lw * 0.14, by = floorY - sprites.bow.Lw * 0.09;
      const bk = Math.max(0, Math.sin(beacon.t * 3.6)) ** 6;
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.25 + 0.75 * bk;
      const BR = 44 * S; ctx.drawImage(GL.red, bx - BR / 2, by - BR / 2, BR, BR);
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      if (beacon.t > 4.2) { beacon.t = 0; rings.push({ x: bx, y: by, t: 0 }); }
      rings = rings.filter(r => (r.t += dt) < 2.6);
      ctx.lineWidth = 1.3;
      rings.forEach(r => { const u = r.t / 2.6; ctx.strokeStyle = `rgba(255,110,90,${(0.5 * (1 - u)).toFixed(3)})`; ctx.beginPath(); ctx.arc(r.x, r.y, 12 + u * W * 0.16, 0, 7); ctx.stroke(); });

      // leito na frente
      ctx.drawImage(floor, 0, 0, W, H);

      // algas (2 traçados, um por cor)
      ctx.lineCap = 'round'; ctx.lineWidth = 3.2 * S;
      [['rgba(34,120,96,0.95)', 0], ['rgba(20,84,74,0.95)', 1]].forEach(([col, k]) => {
        ctx.strokeStyle = col; ctx.beginPath();
        weeds.forEach(w => {
          if (w.col !== k) return;
          const sw = Math.sin(t * 1.1 + w.ph) * 14 * S;
          ctx.moveTo(w.x, w.y); ctx.quadraticCurveTo(w.x + sw * 0.4, w.y - w.h * 0.55, w.x + sw, w.y - w.h);
        });
        ctx.stroke();
      });

      // cardumes
      if (q > 0) {
        shoals.forEach(sh => {
          const cx = mod(t * sh.sp * sh.dir + sh.ph, W + 320) - 160, cy = H * sh.y;
          ctx.globalAlpha = 0.65;
          const spr = sh.dir > 0 ? FISH.r : FISH.l;
          sh.fish.forEach(f => ctx.drawImage(spr, cx + f.ox, cy + f.oy + Math.sin(t * 3 + f.p) * 3, 26 * f.w, 12 * f.w));
        });
        ctx.globalAlpha = 1;
      }

      // bolhas dos cascos
      emitters.forEach(e => {
        e.acc += dt * 1.6 * [0.4, 0.7, 1][q];
        while (e.acc >= 1) {
          e.acc--;
          const cap = 70;
          for (let k = 0; k < cap; k++) { bi = (bi + 1) % cap; const b = BUB[bi]; if (!b.a) { b.a = 1; b.x = e.fx * W + rnd(-40, 40); b.y = floorY - 10; b.vx = rnd(-6, 6); b.vy = rnd(-45, -22) * S; b.r = rnd(1.5, 4) * S; b.life = b.max = rnd(3.5, 6); break; } }
        }
      });
      ctx.strokeStyle = 'rgba(205,240,252,0.55)'; ctx.lineWidth = 1; ctx.beginPath();
      BUB.forEach(b => {
        if (!b.a) return;
        b.life -= dt; if (b.life <= 0) { b.a = 0; return; }
        b.x += b.vx * dt + Math.sin(t * 2 + b.y * 0.04) * 0.2; b.y += b.vy * dt;
        ctx.moveTo(b.x + b.r, b.y); ctx.arc(b.x, b.y, b.r, 0, 7);
      });
      ctx.stroke();

      // neve marinha
      ctx.fillStyle = 'rgba(190,225,240,0.5)';
      const ns = Math.round(snow.length * [0.4, 0.7, 1][q]);
      for (let i = 0; i < ns; i++) { const p = snow[i]; ctx.fillRect(mod(p.x * W + Math.sin(t * 0.5 + p.ph) * 8, W), mod(p.y * H + t * p.v, H), p.s, p.s); }
    });
  })();
})();
