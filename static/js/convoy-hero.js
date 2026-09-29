/* ═══════════════════════════════════════════════════════════════
   ROYAL NAVY — HERO DO MODO CLARO: COMBOIO RUMO AO HORIZONTE (Canvas 2D)

   Contraponto à batalha noturna do modo escuro: num dia de sol, navios de
   carga seguem em colunas para o horizonte, escoltados por navios de guerra.
   Cada navio é um conjunto de sólidos simples (prismas) projetados em
   perspectiva por uma câmera alta e parada: quanto mais longe, menor e mais
   perto do ponto de fuga; as esteiras em V reforçam a profundidade.

   Desempenho:
   • céu, sol, costa e mar são pré-renderizados no resize;
   • cada modelo é montado uma vez por navio; por quadro só se projetam os
     vértices (buffers fixos, sem alocação);
   • as cores já vêm sombreadas e com a névoa da distância (níveis prontos);
   • navios distantes usam o modelo simplificado (LOD);
   • animação por tempo (dt); a pausa fora da tela é feita pelo RNHero.
   ═══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';
  if (!window.RNHero) return;

  const rnd   = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const level = () => (window.RNPerf ? window.RNPerf.level : 2);
  const mk    = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  const pick  = (list, r) => list[(r() * list.length) | 0];
  function seeded(seed) { let s = seed % 2147483646 + 1; return () => ((s = (s * 16807) % 2147483647) / 2147483647); }

  /* ── câmera e cena ─────────────────────────────────────────── */
  const HZ     = 0.55;                   // linha do horizonte (fração da altura)
  const VPX    = 0.74;                   // ponto de fuga do comboio (fração da largura)
  const SUN    = { x: 0.78, y: 0.24 };   // mesma posição dos raios do CSS (.hero::before)
  const CAM_H  = 70;                     // altura da câmera acima do mar (m)
  const Z_NEAR = 30;                     // nada é projetado mais perto que isto (m)
  const Z_END  = 9500;                   // o navio some na névoa e volta ao fim da coluna
  const SPEED  = 34;                     // velocidade do comboio (m/s, acelerada para a cena)

  // colunas do comboio: posição lateral (m), espaçamento (m) e tipos possíveis
  const LANES = [
    { x: -560, gap: 2600, kinds: ['destroyer', 'frigate'] },                                // escolta, flanco esquerdo
    { x: -320, gap: 1300, kinds: ['container', 'container', 'tanker', 'bulker', 'carCarrier'] },
    { x: -115, gap: 1300, kinds: ['container', 'tanker', 'bulker', 'container', 'carCarrier'] },
    { x:  150, gap: 2300, kinds: ['frigate', 'carrier', 'destroyer'] },                     // escolta, flanco direito
  ];

  /* ── cores, luz e névoa ────────────────────────────────────── */
  const HAZE = [205, 231, 242];          // cor da névoa do horizonte
  const NH = 8;                          // níveis de névoa pré-calculados
  const SUN_DIR = (() => { const v = [0.3, 0.8, 0.52], m = Math.hypot(v[0], v[1], v[2]); return v.map(x => x / m); })();
  const AMB = 0.62, DIF = 0.42;

  const WHITE = '#eef1f3', GREY = '#a3adb6', DECK = '#6f7881', DARK = '#394048';
  const HULLS  = ['#1d3d5e', '#7a2b24', '#26292e', '#2d5a42', '#34506e'];
  const BOXES  = ['#c8342b', '#2a6fb0', '#e08a2c', '#2f8f5b', '#8a96a1', '#ece8dd', '#1f4e79', '#d4a93a', '#7a4a8c', '#3c8f9e', '#b5382f'];
  const FUNNEL = ['#c43b2e', '#1e4f8a', '#e0a020', '#2d6b4f', '#26292e'];

  const lit = (nx, ny, nz) => AMB + DIF * Math.max(0, nx * SUN_DIR[0] + ny * SUN_DIR[1] + nz * SUN_DIR[2]);

  /** Uma cor por nível de névoa: tom base × luz k, misturado à névoa conforme a distância. */
  function tones(hex, k) {
    const c = [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
    const out = new Array(NH);
    for (let i = 0; i < NH; i++) {
      const h = (i / (NH - 1)) * 0.88;
      const r = Math.min(255, c[0] * k), g = Math.min(255, c[1] * k), b = Math.min(255, c[2] * k);
      out[i] = `rgb(${(r + (HAZE[0] - r) * h) | 0},${(g + (HAZE[1] - g) * h) | 0},${(b + (HAZE[2] - b) * h) | 0})`;
    }
    return out;
  }

  /* ── peças dos modelos (medidas em metros; x = través, y = altura, z = da popa para a proa) ── */

  /** Prisma: planta convexa em (x, z), sentido anti-horário visto de cima, extrudada de y0 a y1. */
  function prism(poly, y0, y1, col, o = {}) {
    const n = poly.length;
    const xs = new Float32Array(n), zs = new Float32Array(n), nx = new Float32Array(n), nz = new Float32Array(n);
    const side = new Array(n);
    for (let i = 0; i < n; i++) { xs[i] = poly[i][0]; zs[i] = poly[i][1]; }
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n, dx = xs[j] - xs[i], dz = zs[j] - zs[i], m = Math.hypot(dx, dz) || 1;
      nx[i] = dz / m; nz[i] = -dx / m;                             // normal para fora da face
      side[i] = tones(col, lit(nx[i], 0, nz[i]));
    }
    return { k: 0, n, xs, zs, nx, nz, y0, y1, side, top: o.noTop ? null : tones(o.top || col, lit(0, 1, 0)), lod: o.lod || 0, max: o.max ?? 2, foam: !!o.foam };
  }
  const box = (x0, x1, z0, z1, y0, y1, col, o) => prism([[x0, z0], [x1, z0], [x1, z1], [x0, z1]], y0, y1, col, o);

  /** Casco: popa reta, costado paralelo e proa afilada. */
  function hull(L, B, y0, y1, bow, col, o = {}) {
    const b = B / 2, zb = L * (1 - bow), zs = L * (1 - bow * 0.4);
    return prism([[-b * 0.9, 0], [b * 0.9, 0], [b, L * 0.05], [b, zb], [b * 0.62, zs], [0, L], [-b * 0.62, zs], [-b, zb], [-b, L * 0.05]], y0, y1, col, o);
  }
  /** Faixa pintada no costado (sem tampa): um casco um pouco mais largo só entre y0 e y1. */
  const stripe = (L, B, bow, y0, y1, col) => hull(L, B + 0.6, y0, y1, bow, col, { noTop: true, lod: 1 });

  const seg  = (a, b, w, col, lod = 1) => ({ k: 1, a, b, w, c: tones(col, 0.92), lod });            // mastro, lança, cano
  const ball = (x, y, z, r, col, lod = 1) => ({ k: 2, x, y, z, r, c: tones(col, 0.9), hi: tones(col, 1.1), lod });
  const flag = (z, y0, y1, kind) => ({ k: 3, z, y0, y1, kind, lod: 2 });                             // bandeira na popa
  const marks = (list, y, w) => ({ k: 4, list, y, w, lod: 2 });                                    // pintura do convés

  /** Uma fileira de peças lado a lado: a mais distante da câmera precisa ser desenhada primeiro. */
  const row = (items, camRight) => (camRight ? items : items.slice().reverse());

  /* ── modelos (listas já na ordem de desenho: da proa para a popa, de baixo para cima) ── */
  const MODELS = {
    container(r, camRight) {
      const L = 280, B = 40, D = 14, b = 19;
      const hc = pick(HULLS, r), fc = pick(FUNNEL, r);
      const parts = [hull(L, B, 0, D, 0.14, hc, { top: '#8d7a66', foam: true }), stripe(L, B, 0.14, 0, 2.4, '#a33a2c')];
      for (let k = 7; k >= 0; k--) {                                 // baias de contêineres, 2 pilhas cada (só de perto)
        const z0 = 42 + k * 24.5, z1 = z0 + 22.5;
        parts.push(...row([[-b, 0], [0, b]].map(([x0, x1]) =>
          box(x0, x1, z0, z1, D, D + 2.6 * (((r() * 4) | 0) + 4), pick(BOXES, r), { lod: 2 })), camRight));
      }
      for (let k = 3; k >= 0; k--) {                                 // distância média: um bloco colorido a cada 2 baias
        parts.push(box(-b, b, 42 + k * 49, 42 + k * 49 + 47, D, D + 2.6 * (5 + ((r() * 3) | 0)), pick(BOXES, r), { lod: 1, max: 1 }));
      }
      parts.push(box(-14, 14, 10, 32, D, 40, WHITE));                // acomodações e passadiço
      parts.push(box(-20, 20, 24, 32, 40, 42.6, WHITE, { lod: 1 }));  // asas do passadiço
      parts.push(seg([0, 42.6, 28], [0, 54, 28], 0.7, WHITE));
      parts.push(box(-4.2, 4.2, 14, 22, 40, 48, fc, { lod: 1 }));     // chaminé sobre a superestrutura
      parts.push(box(-4.25, 4.25, 13.95, 22.05, 46, 48, '#232629', { lod: 2 }));
      for (let y = 20; y < 38; y += 5) parts.push(box(-11, 11, 9.4, 10, y, y + 1.3, '#3b566e', { lod: 2 }));   // janelas
      parts.push(flag(1.5, D, D + 7, 'red'));
      const far = [parts[0], box(-b, b, 42, 236, D, D + 13, '#8a6f62'), box(-14, 14, 10, 32, D, 40, WHITE)];
      return { L, B, parts, far };
    },

    tanker(r) {
      const L = 250, B = 44, D = 10;
      const hc = pick(['#26292e', '#6b2320', '#1d3d5e'], r), deck = pick(['#9e3b33', '#3f6e4d', '#8c4f36'], r), fc = pick(FUNNEL, r);
      const parts = [hull(L, B, 0, D, 0.16, hc, { top: deck, foam: true }), stripe(L, B, 0.16, 0, 2.2, '#a33a2c')];
      parts.push(box(-1.4, 1.4, 126, 206, D, D + 2, '#cfd4d8', { lod: 2 }));      // tubulação (lado da proa)
      parts.push(box(-17, 17, 120, 126, D, D + 3.2, '#d8d9cf', { lod: 2 }));      // manifold
      parts.push(box(-1.4, 1.4, 36, 120, D, D + 2, '#cfd4d8', { lod: 2 }));       // tubulação (lado da popa)
      parts.push(box(-15, 15, 8, 30, D, 32, WHITE));
      parts.push(box(-21, 21, 22, 30, 32, 34.5, WHITE, { lod: 1 }));
      parts.push(seg([0, 34.5, 26], [0, 46, 26], 0.7, WHITE));
      parts.push(box(-4, 4, 12, 20, 32, 41, fc, { lod: 1 }));
      parts.push(box(-4.05, 4.05, 11.95, 20.05, 38.6, 41, '#232629', { lod: 2 }));
      for (let y = 15; y < 30; y += 5) parts.push(box(-11, 11, 7.4, 8, y, y + 1.3, '#3b566e', { lod: 2 }));
      parts.push(flag(1.5, D, D + 7, 'red'));
      return { L, B, parts, far: [parts[0], box(-15, 15, 8, 30, D, 32, WHITE)] };
    },

    bulker(r) {
      const L = 225, B = 32, D = 12;
      const hc = pick(HULLS, r), hatch = pick(['#b94a2f', '#3c6e91', '#5b7f4a'], r), fc = pick(FUNNEL, r);
      const parts = [hull(L, B, 0, D, 0.15, hc, { top: '#7c756a', foam: true }), stripe(L, B, 0.15, 0, 2.3, '#a33a2c')];
      for (let k = 6; k >= 0; k--) {                                 // tampas dos porões e guindastes entre elas
        const z0 = 40 + k * 25;
        parts.push(box(-11, 11, z0, z0 + 17, D, D + 2.6, hatch, { lod: 1 }));
        if (k >= 1 && k <= 4) {
          const zc = z0 - 4, s = k % 2 ? 1 : -1;
          parts.push(seg([0, D, zc], [0, D + 17, zc], 1.3, '#d8b43a'));
          parts.push(seg([0, D + 15, zc], [7 * s, D + 22, zc + 13], 0.6, '#d8b43a', 2));
        }
      }
      parts.push(box(-13, 13, 8, 28, D, 32, WHITE));
      parts.push(box(-16.5, 16.5, 20, 27, 32, 34.5, WHITE, { lod: 1 }));
      parts.push(seg([0, 34.5, 23], [0, 45, 23], 0.7, WHITE));
      parts.push(box(-3.4, 3.4, 11, 18, 32, 39, fc, { lod: 1 }));
      for (let y = 17; y < 30; y += 5) parts.push(box(-9, 9, 7.4, 8, y, y + 1.2, '#3b566e', { lod: 2 }));
      parts.push(flag(1.5, D, D + 7, 'red'));
      return { L, B, parts, far: [parts[0], box(-11, 11, 40, 207, D, D + 2.6, hatch), box(-13, 13, 8, 28, D, 32, WHITE)] };
    },

    carCarrier(r) {
      const L = 200, B = 32, D = 32;
      const col = pick(['#e9edf1', '#e9edf1', '#2f5f8f', '#b8392f'], r), band = pick(['#1e4f8a', '#c43b2e', '#2d6b4f'], r);
      const parts = [hull(L, B, 0, D, 0.09, col, { top: '#d5dade', foam: true })];
      parts.push(stripe(L, B, 0.09, 0, 2.2, '#a33a2c'));
      parts.push(stripe(L, B, 0.09, 21, 24, col === '#e9edf1' ? band : '#e9edf1'));
      parts.push(box(-15.5, 15.5, 170, 182, D, D + 4.5, WHITE, { lod: 1 }));      // passadiço na proa
      parts.push(box(-3.2, 3.2, 20, 28, D, D + 6.5, band, { lod: 1 }));
      parts.push(box(-9, 9, -1, 0, 2.5, 17, '#99a2aa', { lod: 1 }));                // rampa de popa recolhida
      parts.push(flag(2, D, D + 6, 'red'));
      return { L, B, parts, far: [parts[0]] };
    },

    destroyer(r) {                                                   // Type 45
      const L = 152, B = 21, D = 8;
      const parts = [hull(L, B, 0, D, 0.25, GREY, { top: DECK, foam: true })];
      parts.push(box(-2.2, 2.2, 117, 123, D, D + 2.6, GREY, { lod: 1 }));
      parts.push(seg([0, D + 1.6, 123], [0, D + 2.2, 131], 0.45, GREY, 2));
      parts.push(box(-5, 5, 100, 111, D, D + 1.3, DECK, { lod: 2 }));
      parts.push(box(-7.5, 7.5, 84, 97, D, D + 13, GREY));                         // passadiço
      parts.push(box(-9, 9, 44, 84, D, D + 9, GREY));                               // superestrutura
      parts.push(box(-3, 3, 76, 83, D + 9, D + 22, GREY));                          // mastro do radar Sampson
      parts.push(ball(0, D + 25.4, 79.5, 3.4, '#e4e8ec'));
      parts.push(box(-3.8, 3.8, 52, 64, D + 9, D + 18, GREY, { lod: 1 }));          // chaminé
      parts.push(box(-3.85, 3.85, 51.95, 64.05, D + 16.6, D + 18, DARK, { lod: 2 }));
      parts.push(seg([0, D + 9, 47], [0, D + 22, 47], 0.6, GREY));
      parts.push(box(-8.5, 8.5, 26, 44, D, D + 8, GREY));                           // hangar
      parts.push(marks([[[-5, 13], [5, 13]], [[0, 3], [0, 24]]], D, 0.35));        // convoo
      parts.push(flag(1.2, D, D + 6.5, 'white'));
      return { L, B, parts, far: [parts[0], box(-9, 9, 26, 97, D, D + 11, GREY), box(-3, 3, 76, 83, D + 11, D + 25, GREY)] };
    },

    frigate(r) {                                                     // Type 23
      const L = 133, B = 16, D = 7.5;
      const parts = [hull(L, B, 0, D, 0.25, GREY, { top: DECK, foam: true })];
      parts.push(box(-2, 2, 104, 109, D, D + 2.4, GREY, { lod: 1 }));
      parts.push(seg([0, D + 1.5, 109], [0, D + 2, 116], 0.4, GREY, 2));
      parts.push(box(-3, 3, 94, 100, D, D + 1.1, DECK, { lod: 2 }));
      parts.push(box(-6, 6, 78, 90, D, D + 11, GREY));
      parts.push(box(-6.5, 6.5, 36, 78, D, D + 8, GREY));
      parts.push(seg([0, D + 8, 66], [0, D + 23, 68], 1.2, GREY));
      parts.push(box(-2.4, 2.4, 66.5, 69.5, D + 21, D + 24, GREY, { lod: 1 }));
      parts.push(box(-2.8, 2.8, 46, 56, D + 8, D + 14, GREY, { lod: 1 }));
      parts.push(box(-2.85, 2.85, 45.95, 56.05, D + 12.8, D + 14, DARK, { lod: 2 }));
      parts.push(box(-6.5, 6.5, 22, 36, D, D + 8.5, GREY));
      parts.push(marks([[[-4, 11], [4, 11]], [[0, 3], [0, 20]]], D, 0.3));
      parts.push(flag(1.2, D, D + 6, 'white'));
      return { L, B, parts, far: [parts[0], box(-6.5, 6.5, 22, 90, D, D + 10, GREY)] };
    },

    carrier(r, camRight) {                                           // classe Queen Elizabeth
      const L = 270, B = 39, D = 20, FD = D + 3;
      const TOP = '#5d666f';
      const jet = (x, z) => prism([[x - 5.5, z], [x + 5.5, z], [x, z + 15.5]], FD, FD + 1.4, DARK, { lod: 2 });
      const parts = [hull(L, B, 0, D, 0.17, GREY, { top: DECK, foam: true })];
      parts.push(prism([[-28, -2], [28, -2], [37, 40], [37, 232], [20, 276], [-18, 276], [-33, 228], [-33, 30]], D, FD, GREY, { top: TOP }));
      const dash = [];
      for (let z = 8; z < 250; z += 17) dash.push([[-4, z], [-4, z + 9]]);
      dash.push([[-29, 8], [-29, 222]]);
      parts.push(marks(dash, FD, 0.6));
      parts.push(prism([[-17, 256], [17, 256], [15, 276], [-15, 276]], FD, FD + 3.5, GREY, { top: TOP, lod: 1 }));   // rampa (ski-jump)
      parts.push(...row([jet(-14, 208), jet(-1, 208)], camRight));
      parts.push(box(23, 34.5, 150, 178, FD, FD + 19, GREY));                       // ilha de vante
      parts.push(box(24, 33.5, 156, 172, FD + 19, FD + 27, GREY));
      parts.push(seg([28.8, FD + 27, 164], [28.8, FD + 37, 164], 0.8, GREY));
      parts.push(ball(28.8, FD + 29.5, 164, 2.4, '#dde3e8'));
      parts.push(...row([jet(-17, 128), jet(-4, 128)], camRight));
      parts.push(box(23, 34.5, 96, 120, FD, FD + 17, GREY));                        // ilha de ré
      parts.push(box(24, 33.5, 100, 115, FD + 17, FD + 24, GREY));
      parts.push(box(25.5, 31.5, 104, 110, FD + 24, FD + 26.5, DARK, { lod: 1 }));
      parts.push(seg([28.5, FD + 26.5, 107], [28.5, FD + 33, 107], 0.6, GREY));
      parts.push(...row([jet(-12, 40), jet(2, 40)], camRight));
      parts.push(flag(0, FD, FD + 8, 'white'));
      return { L, B, parts, far: [parts[0], parts[1], box(23, 34.5, 96, 178, FD, FD + 22, GREY)] };
    },
  };

  /* ═════════════════════════════════ CENA ═════════════════════════════════ */
  function createConvoyScene() {
    let ctx = null, cvs = null;
    let W = 0, H = 0, dpr = 1, t = 0;
    let F = 1, VX = 0, HY = 0, SX = 0, SY = 0;          // focal (px), ponto de fuga, sol
    let bg = null, sunSprite = null;
    let ships = [], started = false;

    // buffers de projeção (um prisma tem no máximo 9 vértices)
    const PX = new Float32Array(16), PT = new Float32Array(16), PB = new Float32Array(16);

    /* ── navios ─────────────────────────────────────────────── */
    function makeShip(lane, z) {
      const r = seeded((Math.random() * 2147483646) | 0);
      const kind = pick(lane.kinds, r);
      const m = MODELS[kind](r, lane.x < 0);
      return { kind, lane, x: lane.x, z, L: m.L, B: m.B, parts: m.parts, far: m.far, spawn: z, alpha: 1, ph: Math.random() * 6.28 };
    }

    function fillLanes() {
      ships = [];
      LANES.forEach(lane => {
        for (let z = rnd(60, 60 + lane.gap); z < Z_END - 200; z += lane.gap * rnd(0.9, 1.1)) {
          const s = makeShip(lane, z);
          s.spawn = -1e9;                                // já estava no mar: sem esmaecer na entrada
          ships.push(s);
        }
      });
      ships.sort((a, b) => b.z - a.z);
    }

    function update(dt) {
      let resort = false;
      for (let i = 0; i < ships.length; i++) {
        const s = ships[i];
        s.z += SPEED * dt;
        if (s.z > Z_END) {                               // chegou ao horizonte: volta ao fim da coluna
          ships[i] = makeShip(s.lane, rnd(40, 70));
          resort = true;
          continue;
        }
        const fadeIn = clamp((s.z - s.spawn) / 260, 0, 1);
        const fadeOut = 1 - clamp((s.z - (Z_END - 1700)) / 1700, 0, 1);
        s.alpha = fadeIn * fadeOut;
      }
      if (resort) ships.sort((a, b) => b.z - a.z);
    }

    const hazeLevel = z => clamp(Math.round(Math.pow(clamp((z - 350) / 7600, 0, 1), 0.75) * (NH - 1)), 0, NH - 1);

    function drawPrism(p, X, Z, cx, cz, hl, foam) {
      const n = p.n, xs = p.xs, zs = p.zs;
      for (let i = 0; i < n; i++) {
        const iz = F / (Z + zs[i]);
        PX[i] = VX + (X + xs[i]) * iz;
        PT[i] = HY + (CAM_H - p.y1) * iz;
        PB[i] = HY + (CAM_H - p.y0) * iz;
      }
      // faces laterais voltadas para a câmera; as de mesma cor viram um só preenchimento
      // (num prisma convexo elas nunca se sobrepõem, então a ordem entre elas não importa)
      let col = null;
      for (let i = 0; i < n; i++) {
        if (p.nx[i] * (cx - xs[i]) + p.nz[i] * (cz - zs[i]) <= 0) continue;
        const j = i + 1 === n ? 0 : i + 1;
        if (Math.abs(PX[j] - PX[i]) < 0.3 && Math.abs(PB[j] - PB[i]) < 0.3) continue;   // face vista de perfil
        const c = p.side[i][hl];
        if (c !== col) { if (col) { ctx.fillStyle = col; ctx.fill(); } col = c; ctx.beginPath(); }
        ctx.moveTo(PX[i], PB[i]); ctx.lineTo(PX[j], PB[j]); ctx.lineTo(PX[j], PT[j]); ctx.lineTo(PX[i], PT[i]); ctx.closePath();
      }
      if (col) { ctx.fillStyle = col; ctx.fill(); }
      if (p.top && CAM_H > p.y1) {                       // tampa (convés, teto)
        ctx.beginPath(); ctx.moveTo(PX[0], PT[0]);
        for (let i = 1; i < n; i++) ctx.lineTo(PX[i], PT[i]);
        ctx.closePath();
        ctx.fillStyle = p.top[hl]; ctx.fill();
      }
      if (foam && p.foam) {                              // espuma na linha d'água
        ctx.strokeStyle = 'rgba(255,255,255,0.75)';
        ctx.beginPath();
        for (let i = 0; i < n; i++) {
          if (p.nx[i] * (cx - xs[i]) + p.nz[i] * (cz - zs[i]) <= 0) continue;
          const j = i + 1 === n ? 0 : i + 1;
          ctx.moveTo(PX[i], PB[i]); ctx.lineTo(PX[j], PB[j]);
        }
        const lw = ctx.lineWidth; ctx.lineWidth = Math.max(1, F * 0.9 / Z); ctx.stroke(); ctx.lineWidth = lw;
      }
    }

    function drawFlag(p, s, iz, hl) {
      const x = VX + s.x * iz, yb = HY + (CAM_H - p.y0) * iz, yt = HY + (CAM_H - p.y1) * iz;
      const fw = 5.5 * iz, fh = 3 * iz, wave = Math.sin(t * 5 + s.ph) * fh * 0.25;
      ctx.strokeStyle = '#d9dde0'; ctx.lineWidth = Math.max(0.6, 0.25 * iz);
      ctx.beginPath(); ctx.moveTo(x, yb); ctx.lineTo(x, yt); ctx.stroke();
      const quad = (x0, x1, y0, y1) => {
        ctx.beginPath();
        ctx.moveTo(x + x0 * fw, yt + y0 * fh + wave * x0); ctx.lineTo(x + x1 * fw, yt + y0 * fh + wave * x1);
        ctx.lineTo(x + x1 * fw, yt + y1 * fh + wave * x1); ctx.lineTo(x + x0 * fw, yt + y1 * fh + wave * x0);
        ctx.closePath(); ctx.fill();
      };
      if (p.kind === 'white') {                          // White Ensign: cruz vermelha e canto azul
        ctx.fillStyle = '#f4f6f8'; quad(0, 1, 0, 1);
        ctx.fillStyle = '#c8202f'; quad(0, 1, 0.42, 0.58); quad(0.45, 0.55, 0, 1);
        ctx.fillStyle = '#233a8c'; quad(0, 0.45, 0, 0.42);
      } else {                                           // Red Ensign (marinha mercante)
        ctx.fillStyle = '#c8202f'; quad(0, 1, 0, 1);
        ctx.fillStyle = '#233a8c'; quad(0, 0.45, 0, 0.45);
      }
    }

    function drawShip(s) {
      const X = s.x, Z = s.z, beamPx = F * s.B / Z;
      if (beamPx < 1.2 || s.alpha <= 0.01) return;
      const hl = hazeLevel(Z), cx = -X, cz = -Z;          // câmera no referencial do navio
      ctx.globalAlpha = s.alpha;
      if (beamPx < 4) {                                  // quase no horizonte: só o vulto (2 preenchimentos)
        const h = s.far[0], i0 = F / Z, i1 = F / (Z + s.L), y0 = HY + CAM_H * i0, y1 = HY + CAM_H * i1;
        ctx.fillStyle = h.side[1][hl];
        ctx.beginPath();
        ctx.moveTo(VX + X * i0, y0); ctx.lineTo(VX + X * i1, y1); ctx.lineTo(VX + X * i1, y1 - h.y1 * i1); ctx.lineTo(VX + X * i0, y0 - h.y1 * i0);
        ctx.fill();
        const b = s.far[s.far.length - 1];
        ctx.fillStyle = b.side[0][hl];
        ctx.fillRect(VX + X * i0 - beamPx * 0.3, HY + (CAM_H - b.y1) * i0, beamPx * 0.6, (b.y1 - h.y1) * i0);
        ctx.globalAlpha = 1;
        return;
      }
      const detail = beamPx < 11 ? -1 : beamPx < 34 ? 1 : 2;
      const parts = detail < 0 ? s.far : s.parts;
      ctx.lineWidth = 0.7;
      for (let i = 0; i < parts.length; i++) {
        const p = parts[i];
        if (detail >= 0 && (p.lod > detail || p.max < detail)) continue;
        if (p.k === 0) drawPrism(p, X, Z, cx, cz, hl, detail >= 1);
        else if (p.k === 1) {
          const ia = F / (Z + p.a[2]), ib = F / (Z + p.b[2]);
          ctx.strokeStyle = p.c[hl];
          ctx.lineWidth = Math.max(0.7, p.w * (ia + ib) * 0.5);
          ctx.beginPath();
          ctx.moveTo(VX + (X + p.a[0]) * ia, HY + (CAM_H - p.a[1]) * ia);
          ctx.lineTo(VX + (X + p.b[0]) * ib, HY + (CAM_H - p.b[1]) * ib);
          ctx.stroke();
          ctx.lineWidth = 0.7;
        } else if (p.k === 2) {
          const iz = F / (Z + p.z), r = Math.max(0.8, p.r * iz), x = VX + (X + p.x) * iz, y = HY + (CAM_H - p.y) * iz;
          ctx.fillStyle = p.c[hl]; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
          ctx.fillStyle = p.hi[hl]; ctx.beginPath(); ctx.arc(x + r * 0.25, y - r * 0.3, r * 0.55, 0, 7); ctx.fill();
        } else if (p.k === 3) {
          if (detail === 2) drawFlag(p, s, F / (Z + p.z), hl);
        } else if (p.k === 4) {
          ctx.strokeStyle = 'rgba(240,244,247,0.85)';
          ctx.beginPath();
          for (const [a, b] of p.list) {
            const ia = F / (Z + a[1]), ib = F / (Z + b[1]);
            ctx.moveTo(VX + (X + a[0]) * ia, HY + (CAM_H - p.y) * ia);
            ctx.lineTo(VX + (X + b[0]) * ib, HY + (CAM_H - p.y) * ib);
          }
          ctx.lineWidth = Math.max(0.6, p.w * F / (Z + 60)); ctx.stroke(); ctx.lineWidth = 0.7;
        }
      }
      ctx.globalAlpha = 1;
    }

    /** Esteira: faixa de espuma da hélice que alarga e desbota + os dois braços de Kelvin (~19,5°). */
    function drawWake(s) {
      const X = s.x, Z = s.z, beamPx = F * s.B / Z;
      if (beamPx < 3 || s.alpha <= 0.01) return;
      const near = beamPx >= 12;                          // longe: só a espuma, em menos trechos
      const LW = s.L * 1.3, n = near ? 5 : 2, k0 = s.B * 0.24;
      ctx.fillStyle = '#e9fbff';
      for (let k = 0; k < n; k++) {
        const z0 = Z - LW * k / n, z1 = Math.max(Z_NEAR, Z - LW * (k + 1) / n);
        if (z0 <= Z_NEAR) break;
        const w0 = k0 + s.B * 0.3 * k / n, w1 = k0 + s.B * 0.3 * (k + 1) / n;
        const i0 = F / z0, i1 = F / z1;
        ctx.globalAlpha = s.alpha * 0.26 * Math.pow(1 - k / n, 1.8);
        ctx.beginPath();
        ctx.moveTo(VX + (X - w0) * i0, HY + CAM_H * i0); ctx.lineTo(VX + (X + w0) * i0, HY + CAM_H * i0);
        ctx.lineTo(VX + (X + w1) * i1, HY + CAM_H * i1); ctx.lineTo(VX + (X - w1) * i1, HY + CAM_H * i1);
        ctx.closePath(); ctx.fill();
      }
      if (!near) { ctx.globalAlpha = 1; return; }
      const LK = s.L * 1.6, TAN = 0.354, m = 3;
      ctx.strokeStyle = '#ffffff';
      for (let side = -1; side <= 1; side += 2) {
        for (let k = 0; k < m; k++) {
          let z0 = Z - LK * k / m, z1 = Z - LK * (k + 1) / m;
          if (z0 <= Z_NEAR) break;
          z1 = Math.max(Z_NEAR, z1);
          const x0 = X + side * (s.B * 0.45 + (Z - z0) * TAN), x1 = X + side * (s.B * 0.45 + (Z - z1) * TAN);
          const i0 = F / z0, i1 = F / z1;
          ctx.globalAlpha = s.alpha * 0.14 * Math.pow(1 - k / m, 1.4);
          ctx.lineWidth = Math.max(0.7, Math.min(1.8, 1.4 * (i0 + i1) * 0.5));
          ctx.beginPath(); ctx.moveTo(VX + x0 * i0, HY + CAM_H * i0); ctx.lineTo(VX + x1 * i1, HY + CAM_H * i1); ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
    }

    /* ── céu e mar ──────────────────────────────────────────── */
    function cloudSprite(seed, w = 380, h = 130) {
      const c = mk(w, h), g = c.getContext('2d');
      const r = seeded(seed);
      for (let i = 0; i < 9; i++) {
        const k = i / 8, px = w * 0.12 + w * 0.76 * k + (r() - 0.5) * 20;
        const rad = h * (0.28 + r() * 0.22) * (1 - Math.abs(k - 0.5) * 0.7);
        const py = h * 0.62 - rad * 0.35 + (r() - 0.5) * 8;
        const gr = g.createRadialGradient(px, py - rad * 0.2, 0, px, py, rad);
        gr.addColorStop(0, 'rgba(255,255,255,0.98)');
        gr.addColorStop(0.6, 'rgba(250,252,255,0.6)');
        gr.addColorStop(1, 'rgba(240,247,252,0)');
        g.fillStyle = gr; g.beginPath(); g.arc(px, py, rad, 0, 7); g.fill();
      }
      g.globalCompositeOperation = 'source-atop';                // base levemente sombreada (volume)
      const sh = g.createLinearGradient(0, h * 0.45, 0, h);
      sh.addColorStop(0, 'rgba(160,190,215,0)'); sh.addColorStop(1, 'rgba(160,190,215,0.45)');
      g.fillStyle = sh; g.fillRect(0, 0, w, h);
      return c;
    }
    const CLOUDS = [cloudSprite(11), cloudSprite(23), cloudSprite(37)];
    const clouds = Array.from({ length: 8 }, (_, i) => {
      const low = i >= 5;                                        // nuvens baixas, perto do horizonte
      return { s: i % 3, x: Math.random(), low, y: low ? rnd(0.035, 0.07) : rnd(0.05, 0.3), scale: low ? rnd(0.3, 0.5) : rnd(0.6, 1.3),
        speed: low ? rnd(0.002, 0.004) : rnd(0.005, 0.011), a: low ? rnd(0.45, 0.6) : rnd(0.6, 0.95) };
    });
    const gulls = [
      { x: 0.2, y: 0.2, s: 1.0, sp: 0.013, ph: 0.0 },
      { x: 0.25, y: 0.25, s: 0.75, sp: 0.013, ph: 1.4 },
      { x: 0.55, y: 0.12, s: 0.85, sp: 0.01, ph: 2.6 },
      { x: 0.06, y: 0.33, s: 0.62, sp: 0.012, ph: 4.0 },
    ];
    const glitter = Array.from({ length: 70 }, () => ({ u: rnd(-1, 1), v: Math.pow(Math.random(), 0.8), len: rnd(5, 15), ph: rnd(0, 6.28), sp: rnd(1.4, 3.2) }));
    const ripples = Array.from({ length: 130 }, () => ({ x: rnd(-2600, 2600), z: 90 + Math.pow(Math.random(), 1.9) * 3600, len: rnd(7, 17), ph: rnd(0, 6.28), sp: rnd(0.7, 1.8) }));
    const SWELL_GAP = 180;
    const swell = Array.from({ length: 14 }, (_, i) => ({ z0: SWELL_GAP * i }));
    const heli = { x: 70, y: 105, z: 380, v: 44, wait: 0 };

    function buildBg() {
      bg = mk(cvs.width, cvs.height);
      const g = bg.getContext('2d');
      g.scale(dpr, dpr);

      const sky = g.createLinearGradient(0, 0, 0, HY);
      sky.addColorStop(0, '#2388d6'); sky.addColorStop(0.55, '#5db4ec'); sky.addColorStop(0.88, '#acdbf5'); sky.addColorStop(1, '#d9f0fa');
      g.fillStyle = sky; g.fillRect(0, 0, W, HY + 1);

      // costa distante à esquerda: morros enevoados, falésias de giz e um farol
      const r = seeded(7), cw = W * 0.3, top = [];
      for (let i = 0; i <= 30; i++) {
        const u = i / 30, k = Math.pow(1 - u, 1.4);
        top.push([u * cw, HY - (H * 0.034 * k + Math.sin(i * 1.1) * H * 0.003 * k + r() * H * 0.002 * k) - 1]);
      }
      g.beginPath(); g.moveTo(0, HY + 1); top.forEach(([x, y]) => g.lineTo(x, y)); g.lineTo(cw, HY + 1); g.closePath();
      const land = g.createLinearGradient(0, HY - H * 0.04, 0, HY);
      land.addColorStop(0, '#94b9a7'); land.addColorStop(1, '#b3d1d3');
      g.fillStyle = land; g.fill();
      g.beginPath();                                            // falésias brancas voltadas para o mar
      g.moveTo(cw * 0.42, HY + 1);
      for (let i = 12; i <= 26; i++) g.lineTo(top[i][0], top[i][1] + H * 0.004);
      g.lineTo(top[26][0], HY + 1); g.closePath();
      g.fillStyle = 'rgba(236,242,238,0.8)'; g.fill();
      const lx = top[18][0], ly = top[18][1] + H * 0.003, lh = H * 0.024, lw = Math.max(2, W * 0.0028);
      g.fillStyle = '#f5f7f6'; g.fillRect(lx - lw / 2, ly - lh, lw, lh);                  // farol
      g.fillStyle = '#c8392f'; g.fillRect(lx - lw / 2, ly - lh * 0.62, lw, lh * 0.16); g.fillRect(lx - lw * 0.7, ly - lh - lw, lw * 1.4, lw);

      const sea = g.createLinearGradient(0, HY, 0, H);
      sea.addColorStop(0, '#a5daeb'); sea.addColorStop(0.07, '#72c4df'); sea.addColorStop(0.3, '#2ea0cd'); sea.addColorStop(0.7, '#1583bb'); sea.addColorStop(1, '#0d6aa3');
      g.fillStyle = sea; g.fillRect(0, HY, W, H - HY);

      g.save();                                                 // brilho do sol na água: elipse suave sob o sol
      g.beginPath(); g.rect(0, HY, W, H - HY); g.clip();
      g.globalCompositeOperation = 'lighter';
      g.translate(SX, HY); g.scale(1, 4.2);
      const gr = W * 0.075, gl = g.createRadialGradient(0, 0, 0, 0, 0, gr);
      gl.addColorStop(0, 'rgba(255,246,212,0.42)'); gl.addColorStop(0.45, 'rgba(255,246,212,0.12)'); gl.addColorStop(1, 'rgba(255,246,212,0)');
      g.fillStyle = gl; g.fillRect(-gr, 0, gr * 2, gr);
      g.restore();

      const haze = g.createLinearGradient(0, HY - 28, 0, HY + 12);  // bruma na linha do horizonte
      haze.addColorStop(0, 'rgba(255,255,255,0)'); haze.addColorStop(0.7, 'rgba(255,255,255,0.5)'); haze.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = haze; g.fillRect(0, HY - 28, W, 40);
    }

    function buildSun() {
      const size = 320;
      sunSprite = mk(size, size);
      const g = sunSprite.getContext('2d');
      const gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
      gr.addColorStop(0, 'rgba(255,255,255,1)');
      gr.addColorStop(0.07, 'rgba(255,251,222,1)');
      gr.addColorStop(0.14, 'rgba(255,236,150,0.88)');
      gr.addColorStop(0.38, 'rgba(255,216,96,0.3)');
      gr.addColorStop(1, 'rgba(255,216,96,0)');
      g.fillStyle = gr; g.fillRect(0, 0, size, size);
    }

    function drawClouds(dt) {
      for (const c of clouds) {
        c.x += c.speed * dt; if (c.x > 1) c.x -= 1;
        const sp = CLOUDS[c.s], w = sp.width * c.scale * Math.max(0.7, W / 1400), h = sp.height * c.scale * (c.low ? 0.55 : 1) * Math.max(0.7, W / 1400);
        ctx.globalAlpha = c.a;
        ctx.drawImage(sp, c.x * (W + w * 2) - w, c.low ? HY - c.y * H - h * 0.8 : c.y * H, w, h);
      }
      ctx.globalAlpha = 1;
    }

    function drawGulls(dt) {
      ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(255,255,255,0.92)';
      for (const gl of gulls) {
        gl.x += gl.sp * dt; if (gl.x > 1.05) gl.x = -0.05;
        const s = 13 * gl.s * Math.min(W / 1000, 1.4), flap = Math.sin(t * 5 + gl.ph) * s * 0.4;
        const x = gl.x * W, y = gl.y * H;
        ctx.lineWidth = 2 * gl.s;
        ctx.beginPath();
        ctx.moveTo(x - s, y + flap);
        ctx.quadraticCurveTo(x - s * 0.5, y - s * 0.35 - flap * 0.5, x, y);
        ctx.quadraticCurveTo(x + s * 0.5, y - s * 0.35 - flap * 0.5, x + s, y + flap);
        ctx.stroke();
      }
    }

    function drawSea() {
      const q = level();
      // ondulação: cristas paralelas que chegam à câmera (mais juntas perto do horizonte);
      // retas e agrupadas por intensidade: 3 traçados por quadro
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      const span = SWELL_GAP * swell.length;
      for (let band = 0; band < 3; band++) {
        ctx.globalAlpha = [0.1, 0.065, 0.035][band];
        ctx.beginPath();
        for (const sw of swell) {
          const z = 130 + ((sw.z0 - t * 6) % span + span) % span;
          if (Math.min(2, Math.floor((z - 130) / span * 3)) !== band) continue;
          const y = HY + CAM_H * F / z;
          if (y > H + 2) continue;
          ctx.moveTo(0, y); ctx.lineTo(W, y);
        }
        ctx.stroke();
      }
      // reflexos espalhados (projetados em perspectiva)
      ctx.fillStyle = '#ffffff';
      const nr = Math.round(ripples.length * [0.4, 0.7, 1][q]);
      for (let i = 0; i < nr; i++) {
        const p = ripples[i], iz = F / p.z, w = p.len * iz;
        if (w < 1.2) continue;
        const x = VX + p.x * iz;
        if (x < -w || x > W + w) continue;
        const a = 0.28 * (0.5 + 0.5 * Math.sin(t * p.sp + p.ph));
        if (a < 0.03) continue;
        ctx.globalAlpha = a;
        ctx.fillRect(x - w / 2, HY + CAM_H * iz, w, Math.max(1, w * 0.07));
      }
      // brilho do sol na água
      ctx.fillStyle = '#fffbe6';
      for (const s of glitter) {
        const a = (0.5 + 0.5 * Math.sin(t * s.sp + s.ph)) * (0.9 - s.v * 0.4);
        if (a < 0.06) continue;
        ctx.globalAlpha = a;
        const y = HY + 2 + Math.pow(s.v, 1.7) * (H - HY);
        ctx.fillRect(SX + s.u * (6 + s.v * W * 0.15), y, s.len * (0.4 + s.v), 1.2 + s.v * 1.6);
      }
      ctx.globalAlpha = 1;
    }

    /** Helicóptero da escolta sobrevoando o comboio rumo ao horizonte. */
    function drawHeli(dt) {
      if (heli.wait > 0) { heli.wait -= dt; return; }
      heli.z += heli.v * dt;
      if (heli.z > 5200) { heli.z = 380; heli.x = rnd(40, 120); heli.wait = rnd(5, 12); return; }
      const iz = F / heli.z, x = VX + heli.x * iz, y = HY + (CAM_H - heli.y) * iz;
      const a = clamp((heli.z - 380) / 400, 0, 1) * (1 - clamp((heli.z - 4200) / 1000, 0, 1));
      if (a <= 0.01) return;
      ctx.globalAlpha = a;
      ctx.fillStyle = '#4a545e';
      ctx.beginPath(); ctx.ellipse(x, y, 2.2 * iz, 1.9 * iz, 0, 0, 7); ctx.fill();            // cabine vista de trás
      ctx.fillRect(x - 0.35 * iz, y, 0.7 * iz, 3.2 * iz);                                   // cauda (encurtada)
      ctx.globalAlpha = a * 0.35;
      ctx.strokeStyle = '#2d343b'; ctx.lineWidth = Math.max(0.7, 0.35 * iz);
      const rw = 9 * iz, flick = 0.8 + 0.2 * Math.sin(t * 40);
      ctx.beginPath(); ctx.ellipse(x, y - 2 * iz, rw * flick, rw * 0.12 + 0.6, 0, 0, 7); ctx.stroke();  // rotor
      ctx.globalAlpha = 1;
    }

    return {
      resize(c, w, h, d) {
        ctx = c; cvs = c.canvas; W = w; H = h; dpr = d;
        F = Math.max(W, H * 1.25) * 0.82;
        VX = W * VPX; HY = H * HZ; SX = W * SUN.x; SY = H * SUN.y;
        buildBg();
        buildSun();
        if (!started) { fillLanes(); started = true; }
      },
      render(c, dt) {
        if (!bg) return;
        ctx = c;
        t += dt;
        update(dt);

        ctx.drawImage(bg, 0, 0, W, H);
        const size = Math.min(W, H * 1.1) * 0.72 * (1 + 0.025 * Math.sin(t * 0.7));
        ctx.drawImage(sunSprite, SX - size / 2, SY - size / 2, size, size);
        drawClouds(dt);
        drawSea();

        for (let i = 0; i < ships.length; i++) drawWake(ships[i]);
        for (let i = 0; i < ships.length; i++) drawShip(ships[i]);

        drawHeli(dt);
        drawGulls(dt);
      },
    };
  }

  window.RNHero.register('light', createConvoyScene());
})();
