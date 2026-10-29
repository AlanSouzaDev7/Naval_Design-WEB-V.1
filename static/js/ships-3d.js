/* ═══════════════════════════════════════════════════════════════
   ROYAL NAVY — 3D ENGINE (Three.js)
   Modelos procedurais + gerenciador de cenas.

   Desempenho:
   • Um único loop de animação para todas as cenas.
   • Cada cena só é criada quando chega perto da tela (lazy) e só é
     renderizada enquanto está visível (IntersectionObserver).
   • Pausa total com a aba oculta e com o modal aberto.
   • Geometrias/materiais em cache e compartilhados entre cenas.
   • Peças repetidas (luzes, canhões) em InstancedMesh.
   • Resize via ResizeObserver (nada de setSize a cada frame).
   ═══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  if (!window.THREE) {
    console.warn('[3D] three.js indisponível — modelos 3D desativados.');
    window.ShipEngine = { init() {}, openModal() {}, closeModal() {}, setTheme() {} };
    return;
  }

  /* ── Paleta: dia de sol no mar ─────────────────────────────── */
  const C = {
    hull_carrier:   0x8a97a5,
    hull_destroyer: 0x8593a3,
    hull_frigate:   0x8290a0,
    hull_sub:       0x33475c,
    hull_galleon:   0x9a6a35,
    hull_battle:    0x7d8896,
    deck:           0x6b7683,
    deck_dark:      0x3f4855,
    steel:          0xaab6c2,
    steel_dark:     0x5b6773,
    glass:          0x5fb3e6,
    water:          0x0e8aa8,
    canvas_sail:    0xfaf1d6,
    wood_dark:      0x5c3d1c,
    rope:           0x9a7f45,
    brass:          0xc59a3a,
    flag:           0xd9392b,
  };

  /* Cenários: claro (dia de sol) e escuro (noite de guerra: luar, incêndios no horizonte). */
  const THEMES = {
    light: {
      sky: ['#3d9fe4', '#86cdf3', '#cdeefb', '#cdeefb'],
      fog: 0xcdeefb, fogK: 1,
      water: 0x0e8aa8, waterR: 0.28, waterM: 0.05,
      hemiSky: 0xeaf6ff, hemiGround: 0xb4d2d6, hemiI: 0.66,
      sun: 0xfff0c2, sunI: 1.0,
    },
    dark: {
      sky: ['#02050b', '#0b1c33', '#5a2a14', '#1a0d08'],
      fog: 0x140c10, fogK: 1.25,
      water: 0x082733, waterR: 0.22, waterM: 0.25,
      hemiSky: 0x5f80b0, hemiGround: 0x8a3a14, hemiI: 0.95,      // o "chão" alaranjado imita o reflexo dos incêndios
      sun: 0xb4ceff, sunI: 1.15,                                  // luar
    },
  };
  let currentTheme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  const WATER_Y = -0.32;
  const FIT_ASPECT = 1.6;            // proporção (largura/altura) em que o navio cabe sem afastar a câmera
  const DEFAULT_CAM = [0, 3.0, 9.5];
  const FOG_DENSITY = 0.026;

  /* ── Caches compartilhados ──────────────────────────────────── */
  const _geoCache = new Map();
  const _matCache = new Map();

  function cached(cache, key, make) {
    let v = cache.get(key);
    if (!v) { v = make(); cache.set(key, v); }
    return v;
  }

  const G = {
    box:    (w, h, d)     => cached(_geoCache, `b${w},${h},${d}`,     () => new THREE.BoxGeometry(w, h, d)),
    cyl:    (t, b, h, s)  => cached(_geoCache, `c${t},${b},${h},${s}`, () => new THREE.CylinderGeometry(t, b, h, s)),
    cone:   (r, h, s)     => cached(_geoCache, `n${r},${h},${s}`,     () => new THREE.ConeGeometry(r, h, s)),
    sphere: (...a)        => cached(_geoCache, `s${a.join(',')}`,     () => new THREE.SphereGeometry(...a)),
    plane:  (w, h)        => cached(_geoCache, `p${w},${h}`,          () => new THREE.PlaneGeometry(w, h)),
  };

  function mat(color, opts = {}) {
    const r = opts.r ?? 0.65, m = opts.m ?? 0.25, op = opts.op ?? 1;
    const side = opts.extra?.side ?? 0;
    return cached(_matCache, `${color}|${r}|${m}|${op}|${side}`, () => new THREE.MeshStandardMaterial({
      color, roughness: r, metalness: m, opacity: op, transparent: op < 1, ...opts.extra,
    }));
  }

  /** Várias cópias de uma mesma peça em UMA chamada de desenho. */
  function instanced(geometry, material, items) {
    const mesh = new THREE.InstancedMesh(geometry, material, items.length);
    const o = new THREE.Object3D();
    items.forEach((it, i) => {
      o.position.set(it.p[0], it.p[1], it.p[2]);
      o.rotation.set(it.rx || 0, it.ry || 0, it.rz || 0);
      o.updateMatrix();
      mesh.setMatrixAt(i, o.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.frustumCulled = false;
    return mesh;
  }

  /* ── Céu (gradiente) e oceano compartilhados ────────────────── */
  const _skies = {};
  function skyTexture(mode) {
    if (_skies[mode]) return _skies[mode];
    const stops = THEMES[mode].sky;
    const c = document.createElement('canvas');
    c.width = 2; c.height = 256;
    const g = c.getContext('2d');
    const grad = g.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, stops[0]);
    grad.addColorStop(0.5, stops[1]);
    grad.addColorStop(0.72, stops[2]);
    grad.addColorStop(1, stops[3]);
    g.fillStyle = grad;
    g.fillRect(0, 0, 2, 256);
    return (_skies[mode] = new THREE.CanvasTexture(c));
  }

  let _oceanGeo = null;
  function oceanGeometry() {
    if (_oceanGeo) return _oceanGeo;
    const geo = new THREE.PlaneGeometry(80, 80, 30, 30);
    const pos = geo.attributes.position;
    let seed = 7;                                   // ondulação determinística
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < pos.count; i++) pos.setZ(i, (rnd() - 0.5) * 0.12);
    geo.computeVertexNormals();
    _oceanGeo = geo;
    return geo;
  }

  function buildOcean() {
    const T = THEMES[currentTheme];
    const mesh = new THREE.Mesh(oceanGeometry(), mat(T.water, { r: T.waterR, m: T.waterM }));
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = WATER_Y;
    mesh.receiveShadow = true;
    return mesh;
  }

  /* ── Bootstrap de uma cena ──────────────────────────────────── */
  function createScene(canvas, { shadows = false, maxDpr = 1.5, camera: camPos = DEFAULT_CAM } = {}) {
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxDpr));
    renderer.toneMapping = THREE.NoToneMapping;
    if (shadows) {
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    }

    const scene = new THREE.Scene();
    scene.background = skyTexture(currentTheme);
    scene.fog = new THREE.FogExp2(THEMES[currentTheme].fog, FOG_DENSITY);

    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 200);
    camera.position.set(camPos[0], camPos[1], camPos[2]);
    camera.lookAt(0, 0, 0);

    // Luz do céu + reflexo do mar, e o sol (no modo escuro: luar)
    const T = THEMES[currentTheme];
    const hemi = new THREE.HemisphereLight(T.hemiSky, T.hemiGround, T.hemiI);
    scene.add(hemi);

    const sun = new THREE.DirectionalLight(T.sun, T.sunI);
    sun.position.set(10, 20, 14);
    if (shadows) {
      sun.castShadow = true;
      sun.shadow.mapSize.set(1024, 1024);
      sun.shadow.camera.near = 0.5;
      sun.shadow.camera.far = 60;
      sun.shadow.camera.left = sun.shadow.camera.bottom = -14;
      sun.shadow.camera.right = sun.shadow.camera.top = 14;
    }
    scene.add(sun);

    const ocean = buildOcean();
    scene.add(ocean);
    return { scene, camera, renderer, hemi, sun, ocean };
  }

  /** Troca céu, névoa, luzes e água de uma cena já criada (modo claro <-> escuro). */
  function applyTheme(e, mode) {
    const T = THEMES[mode];
    e.scene.background = skyTexture(mode);
    e.scene.fog.color.setHex(T.fog);
    e.hemi.color.setHex(T.hemiSky);
    e.hemi.groundColor.setHex(T.hemiGround);
    e.hemi.intensity = T.hemiI;
    e.sun.color.setHex(T.sun);
    e.sun.intensity = T.sunI;
    e.ocean.material = mat(T.water, { r: T.waterR, m: T.waterM });
    e.fogBase = FOG_DENSITY * T.fogK;
    e.scene.fog.density = e.fogBase / (e.fogScale || 1);
  }

  /* ═══════════════════════════════════════════════════════════════
     SHIP BUILDERS — modelos 3D procedurais (v4.6: cascos reais)
     Cada navio segue o perfil da classe real (pesquisa em fontes
     públicas: Wikipedia, Navy Lookout, Navypedia, naval-technology).
     Eixos: +x = proa, +y = cima, +z = estibordo. Linha d'água em WATER_Y.
     ═══════════════════════════════════════════════════════════════ */

  const WL = WATER_Y;
  const HC = {                                   // cores de cada marinha/época
    rnGrey:   0x8e98a2,  rnGreyDk: 0x6c757f,  nonSkid: 0x4a5159,
    boot:     0x1b1e22,  antifoul: 0x7a2c24,  radome:  0xd3d8dd,
    glass:    0x1f3447,  white:    0xe8ebee,  black:   0x15181c,
    yellow:   0xe2c044,  rhib:     0xd8642a,  jet:     0x6b737d,
    edGrey:   0x737a83,  teak:     0xb59c74,  boat:    0xdedad0,
    subBlack: 0x23282e,
    vicBlack: 0x1d1a17,  ochre:    0xc89a45,  copper:  0xa8673d,  vicRed: 0x8f2a1e,
    mast:     0x8a6a3e,  sailC:    0xeee5cc,  rigging: 0x2b2118,
  };

  /** Peça simples: cria a malha, posiciona e adiciona ao grupo. */
  function add(group, geo, material, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
    const m = new THREE.Mesh(geo, material);
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, rz);
    group.add(m);
    return m;
  }

  /** Caixa com o topo afinado/deslocado: superestruturas de faces inclinadas (furtivas). */
  function taperBox(w, h, d, tx = 1, tz = 1, sx = 0) {
    return cached(_geoCache, `tb${w},${h},${d},${tx},${tz},${sx}`, () => {
      const g = new THREE.BoxGeometry(w, h, d);
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) {
        if (p.getY(i) > 0) { p.setX(i, p.getX(i) * tx + sx); p.setZ(i, p.getZ(i) * tz); }
      }
      g.computeVertexNormals();
      return g;
    });
  }

  /** Perfil de meia-boca: popa larga (espelho), meio-navio cheio, proa afinando. */
  function halfFn(B, sternHalf, bowStart, bowPow, sternLen = 0.12) {
    return t => {
      if (t >= bowStart) return (B / 2) * Math.max(0, 1 - Math.pow((t - bowStart) / (1 - bowStart), bowPow));
      if (t < sternLen) return (B / 2) * (sternHalf + (1 - sternHalf) * Math.pow(t / sternLen, 0.6));
      return B / 2;
    };
  }
  const smooth = (a, b, t) => { const k = Math.min(1, Math.max(0, (t - a) / (b - a))); return k * k * (3 - 2 * k); };

  const _hullMats = {};
  function hullMat(r = 0.62, m = 0.18) {
    const k = r + '|' + m;
    return _hullMats[k] || (_hullMats[k] = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: r, metalness: m, side: THREE.DoubleSide }));
  }

  /**
   * Casco "lofted": seções transversais ao longo do comprimento, ligadas em malha.
   * o.half(t) meia-boca na linha d'água · o.deck(t) altura do convés · o.flare(t) abertura do costado
   * o.keel(t) fração do calado na quilha · o.rake inclinação da roda de proa · o.color(y, t) cor por altura.
   * Devolve { geo, halfAt(t, y), deckAt(t), L }.
   */
  function loftHull(key, o) {
    return cached(_geoCache, 'hull:' + key, () => {
      const N = o.sections || 64, L = o.L, T = o.T;
      const fl = typeof o.flare === 'function' ? o.flare : () => (o.flare || 1);
      const keelF = o.keel || (() => 1);
      const rake = o.rake || 0, bowStart = o.rakeStart ?? 0.8;
      const tumble = o.tumble || 0;
      const col = new THREE.Color();
      const pos = [], clr = [], idx = [];
      const R = 13;                                   // pontos por seção

      function profile(t) {
        const hb = o.half(t), yd = o.deck(t), f = fl(t), kl = -T * keelF(t);
        const side = [
          [hb * f, yd],
          [hb * ((1 + f) / 2 + tumble), yd * 0.5],
          [hb, 0],
          [hb * 0.95, kl * 0.45],
          [hb * 0.66, kl * 0.86],
          [hb * 0.18, kl * 0.99],
        ];
        const ring = side.map(([z, y]) => [z, y]);
        ring.push([0, kl]);
        for (let j = side.length - 1; j >= 0; j--) ring.push([-side[j][0], side[j][1]]);
        return ring;
      }
      const xAt = (t, y) => -L / 2 + t * L + rake * y * smooth(bowStart, 1, t);

      for (let i = 0; i < N; i++) {
        const t = i / (N - 1);
        profile(t).forEach(([z, y]) => {
          pos.push(xAt(t, y), y, z);
          col.setHex(o.color(y, t)); clr.push(col.r, col.g, col.b);
        });
      }
      for (let i = 0; i < N - 1; i++) {
        for (let j = 0; j < R - 1; j++) {
          const a = i * R + j, b = a + 1, c = a + R, d = c + 1;
          idx.push(a, c, b, b, c, d);
        }
      }
      // convés: vértices próprios (aresta viva com o costado)
      const base = pos.length / 3;
      col.setHex(o.deckColor);
      for (let i = 0; i < N; i++) {
        const t = i / (N - 1), r = profile(t), yd = r[0][1];
        pos.push(xAt(t, yd), yd, r[0][0], xAt(t, yd), yd, -r[0][0]);
        clr.push(col.r, col.g, col.b, col.r, col.g, col.b);
      }
      for (let i = 0; i < N - 1; i++) {
        const a = base + i * 2;
        idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
      }
      // espelho de popa
      const tb = pos.length / 3, r0 = profile(0);
      const yMid = r0.reduce((s, p) => s + p[1], 0) / r0.length;
      pos.push(xAt(0, yMid), yMid, 0);
      col.setHex(o.color(yMid, 0)); clr.push(col.r, col.g, col.b);
      r0.forEach(([z, y]) => { pos.push(xAt(0, y), y, z); col.setHex(o.color(y, 0)); clr.push(col.r, col.g, col.b); });
      for (let j = 0; j < R; j++) idx.push(tb, tb + 1 + j, tb + 1 + ((j + 1) % R));

      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(clr, 3));
      geo.setIndex(idx);
      geo.computeVertexNormals();
      return {
        geo, L,
        deckAt: t => o.deck(t),
        halfAt: (t, y) => {                           // meia-boca do costado na altura y (acima d'água)
          const hb = o.half(t), yd = o.deck(t), f = fl(t);
          const k = Math.max(0, Math.min(1, y / yd));
          const mid = hb * ((1 + f) / 2 + tumble);
          return k < 0.5 ? hb + (mid - hb) * (k / 0.5) : mid + (hb * f - mid) * ((k - 0.5) / 0.5);
        },
        xAt,
      };
    });
  }

  /** Faixa pintada sobre o costado (tira nítida que segue a curva do casco), nos dois bordos. */
  function hullBand(group, hull, y0, y1, color, t0 = 0.03, t1 = 0.97, eps = 0.004) {
    const n = 40, pos = [], idx = [];
    [1, -1].forEach(sd => {
      const base = pos.length / 3;
      for (let i = 0; i <= n; i++) {
        const t = t0 + (t1 - t0) * (i / n);
        for (const y of [y0, y1]) pos.push(hull.xAt(t, y), WL + y, sd * (hull.halfAt(t, y) + eps));
      }
      for (let i = 0; i < n; i++) { const a = base + i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return add(group, g, mat(color, { r: 0.75, m: 0.05, extra: { side: THREE.DoubleSide } }));
  }

  /** Cor de navio moderno: obras vivas vermelhas, faixa preta na linha d'água, costado cinza. */
  const modernColor = (grey = HC.rnGrey) => y => (y < -0.035 ? HC.antifoul : y < 0.03 ? HC.boot : grey);

  /** Número de casco (D32, F237) em textura de canvas, pintado nos dois bordos. */
  function textTexture(txt, color = '#f3f5f7') {
    return cached(_matCache, 'tx:' + txt + color, () => {
      const c = document.createElement('canvas');
      c.width = 256; c.height = 128;
      const g = c.getContext('2d');
      g.fillStyle = color;
      g.font = 'bold 96px Arial, sans-serif';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(txt, 128, 70);
      const tex = new THREE.CanvasTexture(c);
      return new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.8, metalness: 0, depthWrite: false });
    });
  }
  function pennant(group, hull, txt, t, y, h = 0.13) {
    const z = hull.halfAt(t, y) + 0.014, x = -hull.L / 2 + t * hull.L;
    const dt = 0.01, slope = (hull.halfAt(t - dt, y) - hull.halfAt(t + dt, y)) / (2 * dt * hull.L);
    const ry = Math.atan(slope);                      // o plano encosta no costado que afina para a proa
    const m = textTexture(txt);
    add(group, G.plane(h * 2, h), m, x, WL + y, z, 0, ry, 0);
    add(group, G.plane(h * 2, h), m, x, WL + y, -z, 0, Math.PI - ry, 0);
  }

  /** Radar que gira: o laço de animação gira tudo o que estiver em ship.userData.spin. */
  function spinner(group, obj, vel) {
    obj.userData.vel = vel;
    (group.userData.spin || (group.userData.spin = [])).push(obj);
    return obj;
  }

  /** Canhão Mk 8 de 4,5" com escudo furtivo (Type 45 e Type 23). */
  function mk8Gun(group, x, y, s = 1) {
    const g = new THREE.Group();
    add(g, G.cyl(0.12 * s, 0.14 * s, 0.05, 12), mat(HC.rnGreyDk, { r: 0.5 }), 0, 0.025, 0);
    add(g, taperBox(0.34 * s, 0.13 * s, 0.25 * s, 0.62, 0.72, -0.03 * s), mat(HC.rnGrey, { r: 0.5, m: 0.3 }), -0.02 * s, 0.11 * s, 0);
    add(g, G.cyl(0.014 * s, 0.02 * s, 0.5 * s, 8), mat(0x3a4048, { r: 0.4, m: 0.5 }), 0.37 * s, 0.11 * s, 0, 0, 0, -(Math.PI / 2 - 0.06));
    g.position.set(x, y, 0);
    group.add(g);
  }

  /** Phalanx CIWS: base, cúpula branca do radar e o canhão rotativo. */
  function phalanx(group, x, y, z, ry = 0) {
    const g = new THREE.Group();
    add(g, G.cyl(0.045, 0.05, 0.06, 10), mat(HC.rnGreyDk), 0, 0.03, 0);
    add(g, G.cyl(0.04, 0.04, 0.07, 10), mat(HC.white, { r: 0.5 }), 0, 0.1, 0);
    add(g, G.sphere(0.04, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), mat(HC.white, { r: 0.5 }), 0, 0.135, 0);
    add(g, G.cyl(0.008, 0.01, 0.12, 6), mat(0x30353c), 0.08, 0.07, 0, 0, 0, Math.PI / 2);
    g.position.set(x, y, z);
    g.rotation.y = ry;
    group.add(g);
  }

  /** Grade de células de lançamento vertical (Sylver / Sea Ceptor). */
  function vlsBlock(group, x, y, w, d, nx, nz, color = HC.rnGreyDk) {
    add(group, G.box(w, 0.05, d), mat(color, { r: 0.7 }), x, y + 0.025, 0);
    const cells = [];
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
      cells.push({ p: [x - w / 2 + (i + 0.5) * (w / nx), y + 0.052, -d / 2 + (j + 0.5) * (d / nz)] });
    }
    group.add(instanced(G.box((w / nx) * 0.78, 0.006, (d / nz) * 0.78), mat(0x3b4148, { r: 0.8 }), cells));
  }

  /** Marcações do convoo: círculo de pouso e linha de aproximação. */
  function helideck(group, x, y, r) {
    add(group, cached(_geoCache, `ring${r}`, () => new THREE.RingGeometry(r * 0.82, r * 0.9, 28)), mat(HC.white, { r: 0.9, m: 0, extra: { side: THREE.DoubleSide } }), x, y + 0.004, 0, -Math.PI / 2);
    add(group, G.box(r * 2.4, 0.004, 0.018), mat(HC.white, { r: 0.9, m: 0 }), x - r * 0.2, y + 0.004, 0);
  }

  /** F-35B estacionado (fuselagem, asas trapezoidais, dois estabilizadores). */
  function f35(group, x, y, z, ry) {
    const g = new THREE.Group();
    const m = mat(HC.jet, { r: 0.55, m: 0.35 });
    add(g, taperBox(0.30, 0.04, 0.06, 0.9, 0.7), m, 0, 0.02, 0);
    add(g, G.cone(0.028, 0.08, 6), m, 0.19, 0.02, 0, 0, 0, -Math.PI / 2);
    const wing = cached(_geoCache, 'f35wing', () => {
      const s = new THREE.Shape();
      s.moveTo(0.06, 0); s.lineTo(-0.06, 0.11); s.lineTo(-0.1, 0.11); s.lineTo(-0.08, 0); s.lineTo(-0.1, -0.11); s.lineTo(-0.06, -0.11); s.closePath();
      const g2 = new THREE.ShapeGeometry(s); g2.rotateX(Math.PI / 2); return g2;
    });
    add(g, wing, mat(HC.jet, { r: 0.55, m: 0.35, extra: { side: THREE.DoubleSide } }), 0, 0.022, 0);
    add(g, G.box(0.05, 0.05, 0.005), m, -0.12, 0.05, 0.03, 0.35);
    add(g, G.box(0.05, 0.05, 0.005), m, -0.12, 0.05, -0.03, -0.35);
    add(g, G.box(0.05, 0.018, 0.04), mat(0x2a4a63, { r: 0.1, m: 0.6 }), 0.09, 0.045, 0);   // canopy
    g.position.set(x, y, z);
    g.rotation.y = ry;
    group.add(g);
  }

  /** Helicóptero Merlin: fuselagem, cauda e disco do rotor. */
  function merlin(group, x, y, z, ry) {
    const g = new THREE.Group();
    const m = mat(0x5f6670, { r: 0.6, m: 0.3 });
    add(g, taperBox(0.26, 0.07, 0.07, 0.85, 0.8), m, 0, 0.04, 0);
    add(g, G.box(0.16, 0.025, 0.025), m, -0.2, 0.07, 0);
    add(g, G.box(0.03, 0.06, 0.005), m, -0.28, 0.09, 0);
    add(g, G.cyl(0.19, 0.19, 0.003, 20), mat(0x22262b, { r: 0.8, op: 0.45 }), 0.01, 0.1, 0);
    g.position.set(x, y, z);
    g.rotation.y = ry;
    group.add(g);
  }

  /* ── PORTA-AVIÕES: HMS Queen Elizabeth (R08) ─────────────────────
     284 m · convés de voo de 73 m · duas ilhas a estibordo (vante: navegação
     e radar S1850M; ré: controle de voo e radar Type 997 Artisan) · rampa de
     12° na proa, a bombordo · dois elevadores na borda de estibordo. */
  function buildCarrier() {
    const group = new THREE.Group();
    const hull = loftHull('qe', {
      L: 7.0, T: 0.3, rake: 0.55, rakeStart: 0.72,
      half: halfFn(1.0, 0.86, 0.6, 1.8),
      deck: () => 0.5, flare: t => 1.32 - 0.1 * smooth(0.85, 1, t),
      color: modernColor(), deckColor: HC.rnGreyDk,
    });
    add(group, hull.geo, hullMat(), 0, WL, 0);

    // Convés de voo (contorno real: proa cortada em diagonal a estibordo, rampa a bombordo)
    const FD = WL + 0.66;                                            // topo do convés de voo
    const deckGeo = cached(_geoCache, 'qeDeck', () => {
      const s = new THREE.Shape();
      const P = [[-3.55, -0.78], [2.75, -0.82], [3.62, -0.6], [3.66, 0.12], [3.2, 0.36], [2.3, 0.62], [1.45, 0.94],
                 [-1.55, 0.94], [-2.6, 0.88], [-3.55, 0.82]];
      s.moveTo(P[0][0], P[0][1]); P.slice(1).forEach(p => s.lineTo(p[0], p[1])); s.closePath();
      const g = new THREE.ExtrudeGeometry(s, { depth: 0.2, bevelEnabled: false });
      g.rotateX(Math.PI / 2);
      return g;
    });
    add(group, deckGeo, [mat(HC.nonSkid, { r: 0.85 }), mat(HC.rnGrey, { r: 0.6, m: 0.2 })], 0, FD, 0);

    // Rampa de salto (ski-jump) de 12°
    const ramp = cached(_geoCache, 'qeRamp', () => {
      const s = new THREE.Shape();
      s.moveTo(2.55, 0); s.quadraticCurveTo(3.25, 0.01, 3.64, 0.17); s.lineTo(3.64, 0); s.closePath();
      return new THREE.ExtrudeGeometry(s, { depth: 0.72, bevelEnabled: false });
    });
    add(group, ramp, [mat(HC.rnGrey, { r: 0.55, m: 0.2 }), mat(0x5b636c, { r: 0.85 })], 0, FD, -0.6);
    add(group, G.box(0.02, 0.02, 0.72), mat(HC.yellow, { r: 0.8, m: 0 }), 3.64, FD + 0.16, -0.24);   // borda da rampa

    // Marcações: linha de decolagem até a rampa e pontos de pouso a bombordo
    add(group, G.box(6.0, 0.004, 0.02), mat(HC.white, { r: 0.9, m: 0 }), -0.5, FD + 0.002, -0.25);
    add(group, G.box(6.0, 0.004, 0.012), mat(HC.yellow, { r: 0.9, m: 0 }), -0.5, FD + 0.002, 0.3);
    const spots = [];
    for (let k = 0; k < 6; k++) spots.push({ p: [-3.1 + k * 0.62, FD + 0.003, -0.48], rx: -Math.PI / 2 });
    group.add(instanced(cached(_geoCache, 'spot', () => new THREE.RingGeometry(0.1, 0.12, 20)), mat(HC.white, { r: 0.9, m: 0, extra: { side: THREE.DoubleSide } }), spots));

    // Elevadores na borda de estibordo (um entre as ilhas, outro à ré)
    [-0.12, -2.2].forEach(x => add(group, G.box(0.66, 0.006, 0.36), mat(0x5a626b, { r: 0.8 }), x, FD + 0.003, 0.74));

    // Ilha de vante (navegação)
    const island = (x, h) => {
      add(group, taperBox(0.74, h, 0.3, 0.9, 0.78), mat(HC.rnGrey, { r: 0.5, m: 0.25 }), x, FD + h / 2, 0.76);
      add(group, taperBox(0.6, 0.15, 0.34, 0.92, 0.9), mat(HC.rnGrey, { r: 0.5, m: 0.25 }), x + 0.02, FD + h + 0.075, 0.75);
      add(group, G.box(0.6, 0.05, 0.345), mat(HC.glass, { r: 0.1, m: 0.7 }), x + 0.02, FD + h + 0.09, 0.75);
      add(group, taperBox(0.2, 0.16, 0.2, 0.85, 0.85), mat(HC.rnGreyDk), x - 0.25, FD + h + 0.08, 0.78);   // chaminé
      add(group, G.box(0.17, 0.02, 0.17), mat(HC.black), x - 0.25, FD + h + 0.165, 0.78);
    };
    island(0.72, 0.6);
    island(-0.98, 0.52);
    // controle de voo (Flyco): vidraça projetada sobre o convés, na ilha de ré
    add(group, taperBox(0.34, 0.1, 0.12, 1, 1.3), mat(HC.glass, { r: 0.1, m: 0.7 }), -0.98, FD + 0.62, 0.56);

    // Mastros e radares que giram
    add(group, taperBox(0.12, 0.34, 0.12, 0.5, 0.5), mat(HC.rnGrey), 0.72, FD + 0.92, 0.76);
    const s1850 = new THREE.Group();
    add(s1850, G.box(0.05, 0.13, 0.36), mat(HC.rnGreyDk, { r: 0.5, m: 0.4 }));
    s1850.position.set(0.72, FD + 1.15, 0.76);
    group.add(spinner(group, s1850, 1.6));
    add(group, G.cyl(0.012, 0.016, 0.42, 6), mat(HC.rnGreyDk), -0.98, FD + 0.86, 0.76);
    const artisan = new THREE.Group();
    add(artisan, G.box(0.04, 0.11, 0.24), mat(HC.rnGreyDk, { r: 0.5, m: 0.4 }));
    artisan.position.set(-0.98, FD + 1.04, 0.76);
    group.add(spinner(group, artisan, 3.2));

    // Phalanx: proa, popa e ilha
    phalanx(group, 3.05, FD, 0.28);
    phalanx(group, -3.45, FD, 0.62);
    phalanx(group, -3.45, FD, -0.6);

    // Ala aérea: F-35B estacionados à ré e um na corrida para a rampa; Merlin a bombordo
    [[-2.95, 0.55], [-2.6, 0.55], [-2.25, 0.55], [-1.9, 0.55]].forEach(([x, z]) => f35(group, x, FD, z, 0.75));
    f35(group, 1.3, FD, -0.25, 0);
    merlin(group, -1.25, FD, -0.45, 0.4);

    group.scale.setScalar(0.95);
    return group;
  }

  /* ── DESTRÓIER: HMS Daring (D32), Type 45 ───────────────────────
     152 m · canhão Mk 8 · 48 células Sylver · mastro de vante em pirâmide com a
     esfera do radar SAMPSON · mastro de ré com o S1850M · duas chaminés · hangar
     e convoo para Merlin/Wildcat · Phalanx nos dois bordos. */
  function buildDestroyer() {
    const group = new THREE.Group();
    const hull = loftHull('t45', {
      L: 6.4, T: 0.24, rake: 0.55,
      half: halfFn(0.86, 0.8, 0.55, 1.7),
      deck: t => 0.27 + 0.1 * smooth(0.12, 0.2, t) + 0.04 * smooth(0.75, 1, t),
      flare: 1.14, color: modernColor(), deckColor: HC.nonSkid,
    });
    add(group, hull.geo, hullMat(), 0, WL, 0);
    const D = WL + 0.37;                                       // convés principal
    const G1 = mat(HC.rnGrey, { r: 0.5, m: 0.25 });

    mk8Gun(group, 2.15, D + 0.04);
    vlsBlock(group, 1.58, D, 0.44, 0.5, 6, 8);

    // Bloco da ponte e superestrutura contínua até o hangar (faces inclinadas)
    add(group, taperBox(1.05, 0.36, 0.74, 0.94, 0.86), G1, 0.82, D + 0.18, 0);
    add(group, taperBox(0.62, 0.15, 0.66, 0.86, 0.88, -0.02), G1, 0.98, D + 0.43, 0);
    add(group, G.box(0.03, 0.055, 0.56), mat(HC.glass, { r: 0.1, m: 0.7 }), 1.27, D + 0.44, 0, 0, 0, -0.45);
    add(group, taperBox(1.55, 0.32, 0.72, 0.97, 0.88), G1, -0.47, D + 0.16, 0);
    add(group, taperBox(0.74, 0.34, 0.72, 1, 0.9), G1, -1.62, D + 0.17, 0);         // hangar
    add(group, G.box(0.01, 0.26, 0.42), mat(HC.rnGreyDk, { r: 0.7 }), -1.995, D + 0.14, 0);

    // Mastro de vante (pirâmide) + SAMPSON
    add(group, taperBox(0.4, 0.78, 0.4, 0.34, 0.34), G1, 0.6, D + 0.5 + 0.39, 0);
    add(group, G.sphere(0.155, 18, 12), mat(HC.radome, { r: 0.45, m: 0.1 }), 0.6, D + 1.42, 0);
    add(group, G.cyl(0.01, 0.014, 0.32, 6), mat(HC.rnGreyDk), 0.6, D + 1.72, 0);
    add(group, G.box(0.02, 0.02, 0.2), mat(HC.rnGreyDk), 0.6, D + 1.78, 0);

    // Chaminés (antes e depois do mastro de ré) e mastro de ré com o S1850M
    [[-0.05, 0.3], [-1.0, 0.26]].forEach(([x, w]) => {
      add(group, taperBox(w, 0.3, 0.32, 0.86, 0.82, -0.03), G1, x, D + 0.32 + 0.15, 0);
      add(group, G.box(w * 0.82, 0.025, 0.25), mat(HC.black), x - 0.03, D + 0.635, 0);
    });
    add(group, taperBox(0.22, 0.44, 0.24, 0.56, 0.56), G1, -0.55, D + 0.32 + 0.22, 0);
    const s1850 = new THREE.Group();
    add(s1850, G.box(0.05, 0.16, 0.42), mat(HC.rnGreyDk, { r: 0.5, m: 0.4 }));
    s1850.position.set(-0.55, D + 0.88, 0);
    group.add(spinner(group, s1850, 1.4));

    // Phalanx a meia-nau (um por bordo), botes (RHIB laranja) nos recessos
    phalanx(group, -0.75, D + 0.32, 0.27);
    phalanx(group, -0.75, D + 0.32, -0.27, Math.PI);
    [0.36, -0.36].forEach(z => add(group, taperBox(0.26, 0.05, 0.08, 0.9, 0.8), mat(HC.rhib, { r: 0.7, m: 0 }), -0.15, D + 0.08, z));

    // Convoo (mais baixo) com marcações
    helideck(group, -2.6, WL + 0.27, 0.32);
    pennant(group, hull, 'D32', 0.88, 0.2);

    group.scale.setScalar(1.0);
    return group;
  }

  /* ── SUBMARINO: HMS Astute (S119) ───────────────────────────────
     97 m × 11,3 m · torre (vela) bem a vante · lemes de profundidade no casco,
     a vante · popa em cruz com placas nas pontas · propulsor pump-jet com duto ·
     casco preto revestido de placas acústicas. */
  let _tileTex = null;
  function tileTexture() {
    if (_tileTex) return _tileTex;
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    g.fillStyle = '#3a424c'; g.fillRect(0, 0, 64, 64);
    g.strokeStyle = 'rgba(0,0,0,0.55)'; g.lineWidth = 2;
    for (let i = 0; i <= 64; i += 16) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 64); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(64, i); g.stroke(); }
    _tileTex = new THREE.CanvasTexture(c);
    _tileTex.wrapS = _tileTex.wrapT = THREE.RepeatWrapping;
    _tileTex.repeat.set(10, 26);
    return _tileTex;
  }

  function buildSubmarine() {
    const group = new THREE.Group();
    const R = 0.37, Y = WL + 0.14;                            // navegando na superfície
    const skin = cached(_matCache, 'subSkin', () => new THREE.MeshStandardMaterial({ color: 0x9aa3ad, map: tileTexture(), roughness: 0.85, metalness: 0.15 }));
    const dark = mat(HC.subBlack, { r: 0.8, m: 0.2 });

    const body = cached(_geoCache, 'astuteHull', () => {
      const prof = [[0, -3.2], [0.1, -3.12], [0.17, -2.95], [0.25, -2.6], [0.32, -2.1], [0.36, -1.5], [R, -0.9],
                    [R, 2.3], [0.36, 2.6], [0.33, 2.82], [0.27, 3.0], [0.18, 3.13], [0.08, 3.19], [0, 3.2]];
      const g = new THREE.LatheGeometry(prof.map(([r, x]) => new THREE.Vector2(r, x)), 32);
      g.rotateZ(-Math.PI / 2);
      return g;
    });
    add(group, body, skin, 0, Y, 0);

    // Casco de proteção (casing) chato em cima
    add(group, G.box(4.3, 0.025, 0.24), dark, 0.25, Y + R - 0.008, 0);

    // Torre: bordo de ataque arredondado e filete na base
    const fin = cached(_geoCache, 'astuteFin', () => {
      const s = new THREE.Shape();
      s.moveTo(0.7, 0); s.lineTo(0.82, 0.52); s.lineTo(1.5, 0.56);
      s.quadraticCurveTo(1.68, 0.5, 1.7, 0.2); s.quadraticCurveTo(1.74, 0.02, 1.98, 0); s.closePath();
      const g = new THREE.ExtrudeGeometry(s, { depth: 0.1, bevelEnabled: true, bevelThickness: 0.035, bevelSize: 0.03, bevelSegments: 3 });
      g.translate(0, 0, -0.05);
      return g;
    });
    add(group, fin, dark, 0, Y + R - 0.03, 0);
    // mastros optrônicos e de comunicações
    [[1.15, 0.26], [1.3, 0.2], [1.42, 0.16]].forEach(([x, h]) => add(group, G.cyl(0.018, 0.022, h, 8), mat(0x30363d, { r: 0.6 }), x, Y + R + 0.53 + h / 2, 0));

    // Lemes de profundidade de vante (no casco)
    [1, -1].forEach(sd => add(group, taperBox(0.3, 0.02, 0.22, 0.6, 1), dark, 2.35, Y + 0.12, sd * (R + 0.1)));

    // Popa em cruz com placas nas pontas
    const fins = [];
    add(group, taperBox(0.4, 0.28, 0.035, 0.55, 1, -0.06), dark, -2.55, Y + 0.33, 0);
    add(group, taperBox(0.4, 0.28, 0.035, 0.55, 1, -0.06), dark, -2.55, Y - 0.33, 0, Math.PI);
    [1, -1].forEach(sd => {
      add(group, G.box(0.36, 0.03, 0.26), dark, -2.55, Y, sd * 0.33);
      fins.push({ p: [-2.58, Y, sd * 0.46] });
    });
    group.add(instanced(G.box(0.22, 0.12, 0.02), mat(HC.subBlack, { r: 0.78 }), fins));

    // Pump-jet: duto aberto e cubo
    add(group, cached(_geoCache, 'pumpjet', () => new THREE.CylinderGeometry(0.17, 0.15, 0.26, 24, 1, true)), mat(HC.subBlack, { r: 0.7, m: 0.3, extra: { side: THREE.DoubleSide } }), -3.08, Y, 0, 0, 0, Math.PI / 2);
    add(group, G.cone(0.06, 0.16, 12), mat(0x3a3f45, { r: 0.4, m: 0.6 }), -3.22, Y, 0, 0, 0, Math.PI / 2);

    group.scale.setScalar(0.95);
    return group;
  }

  /* ── NAU: HMS Victory (1765), configuração de Trafalgar ────────
     104 canhões em três cobertas · costado preto com faixas ocre ao longo de
     cada fila de portinholas (o "xadrez de Nelson") · fundo forrado de cobre ·
     castelo de popa com galerias · três mastros com velas redondas, gurupés com
     bujarronas e a vela de ré (spanker) · White Ensign na popa. */
  function sailGeo(wTop, wBot, h, bulge) {
    return cached(_geoCache, `sail${wTop},${wBot},${h},${bulge}`, () => {
      const g = new THREE.PlaneGeometry(1, 1, 6, 4);
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const u = p.getX(i) + 0.5, v = p.getY(i) + 0.5;              // u: largura, v: altura (1 = topo)
        const w = wBot + (wTop - wBot) * v;
        p.setXYZ(i, Math.sin(Math.PI * u) * Math.sin(Math.PI * (0.15 + 0.7 * (1 - v))) * bulge, (v - 1) * h, (u - 0.5) * w);
      }
      g.computeVertexNormals();
      return g;
    });
  }

  function ensignTexture() {
    return cached(_matCache, 'ensign', () => {
      const c = document.createElement('canvas');
      c.width = 120; c.height = 60;
      const g = c.getContext('2d');
      g.fillStyle = '#f4f2ee'; g.fillRect(0, 0, 120, 60);
      g.fillStyle = '#c8202a'; g.fillRect(0, 25, 120, 10); g.fillRect(55, 0, 10, 60);
      // cantão com a Union Flag
      g.fillStyle = '#1d2f6b'; g.fillRect(0, 0, 54, 26);
      g.strokeStyle = '#fff'; g.lineWidth = 5;
      g.beginPath(); g.moveTo(0, 0); g.lineTo(54, 26); g.moveTo(54, 0); g.lineTo(0, 26); g.stroke();
      g.strokeStyle = '#c8202a'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(0, 0); g.lineTo(54, 26); g.moveTo(54, 0); g.lineTo(0, 26); g.stroke();
      g.fillStyle = '#fff'; g.fillRect(0, 9, 54, 8); g.fillRect(22, 0, 10, 26);
      g.fillStyle = '#c8202a'; g.fillRect(0, 11, 54, 4); g.fillRect(25, 0, 4, 26);
      return new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(c), roughness: 0.9, metalness: 0, side: THREE.DoubleSide });
    });
  }

  function sternTexture() {
    return cached(_matCache, 'vicStern', () => {
      const c = document.createElement('canvas');
      c.width = 128; c.height = 96;
      const g = c.getContext('2d');
      g.fillStyle = '#c89a45'; g.fillRect(0, 0, 128, 96);
      g.fillStyle = '#1d1a17';
      for (let row = 0; row < 3; row++) for (let k = 0; k < 7; k++) g.fillRect(8 + k * 16.5, 10 + row * 28, 10, 16);
      g.fillRect(0, 34, 128, 3); g.fillRect(0, 62, 128, 3);
      return new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(c), roughness: 0.85, metalness: 0, side: THREE.DoubleSide });
    });
  }

  function buildGalleon() {
    const ship = new THREE.Group();
    const L = 5.0;
    // faixas: copper abaixo d'água; preto; ocre em cada fila de portinholas
    const ROWS = [0.15, 0.31, 0.47];                          // altura (acima d'água) do centro de cada fila
    const vColor = y => (y < -0.02 ? HC.copper : HC.vicBlack);
    const deck = t => 0.6 + 0.09 * Math.pow(2 * t - 1, 2) + 0.2 * (1 - smooth(0.24, 0.3, t)) + 0.1 * (1 - smooth(0.1, 0.14, t)) + 0.08 * smooth(0.84, 0.88, t);
    const hull = loftHull('victory', {
      L, T: 0.72, rake: 0.42, rakeStart: 0.7, tumble: 0.06,
      half: halfFn(1.36, 0.74, 0.72, 2.2, 0.1),
      keel: t => 1 - 0.25 * smooth(0.85, 1, t),
      deck, flare: 0.8, color: vColor, deckColor: 0xa98a5c,
    });
    add(ship, hull.geo, hullMat(0.8, 0.05), 0, WL, 0);
    // o "xadrez de Nelson": uma faixa ocre ao longo de cada fila de portinholas
    ROWS.forEach(y => hullBand(ship, hull, y - 0.045, y + 0.045, HC.ochre, 0.1, 0.9));

    // Portinholas abertas (quadrados escuros) e bocas de fogo: 15 + 14 + 15 por bordo
    const ports = [], guns = [];
    ROWS.forEach((y, r) => {
      const n = r === 1 ? 14 : 15;
      for (let k = 0; k < n; k++) {
        const t = 0.17 + (k + (r === 1 ? 0.5 : 0)) * (0.66 / 14);
        const x = -L / 2 + t * L, z = hull.halfAt(t, y);
        ports.push({ p: [x, WL + y, z + 0.008] }, { p: [x, WL + y, -z - 0.008], ry: Math.PI });
        guns.push({ p: [x, WL + y, z + 0.03], rx: Math.PI / 2 }, { p: [x, WL + y, -z - 0.03], rx: Math.PI / 2 });
      }
    });
    ship.add(instanced(G.plane(0.06, 0.055), mat(0x0d0b09, { r: 1, m: 0, extra: { side: THREE.DoubleSide } }), ports));
    ship.add(instanced(G.cyl(0.011, 0.013, 0.07, 6), mat(0x2b2b2b, { r: 0.5, m: 0.6 }), guns));

    // Popa: galerias envidraçadas em ocre; lanternas
    add(ship, G.plane(1.0, 0.62), sternTexture(), -L / 2 - 0.02, WL + 0.86, 0, 0, -Math.PI / 2, 0);
    [-0.25, 0, 0.25].forEach(z => add(ship, G.sphere(0.035, 8, 6), mat(HC.ochre, { r: 0.4, m: 0.5 }), -L / 2 - 0.05, WL + 1.3, z));
    // Proa: beque com figura de proa
    add(ship, taperBox(0.3, 0.12, 0.22, 0.6, 0.6), mat(HC.vicBlack, { r: 0.8 }), L / 2 + 0.05, WL + 0.62, 0);
    add(ship, G.sphere(0.06, 8, 6), mat(HC.ochre, { r: 0.5, m: 0.3 }), L / 2 + 0.2, WL + 0.6, 0);

    // Mastros: alturas acima d'água ~62 m (grande), ~56 m (traquete), ~44 m (mezena)
    const woodM = mat(HC.mast, { r: 0.85, m: 0.05 });
    const sailM = mat(HC.sailC, { r: 0.95, m: 0, extra: { side: THREE.DoubleSide } });
    const lines = [];
    const MASTS = [{ x: 1.45, H: 4.9, t: 0.79 }, { x: 0.15, H: 5.45, t: 0.53 }, { x: -1.35, H: 3.85, t: 0.23 }];
    MASTS.forEach(({ x, H, t }, mi) => {
      const y0 = WL + deck(t);
      const top = y => WL + y;
      // mastro real, mastaréu e mastaréu do joanete
      add(ship, G.cyl(0.045, 0.06, H * 0.5 - deck(t), 8), woodM, x, (y0 + top(H * 0.5)) / 2, 0);
      add(ship, G.cyl(0.03, 0.04, H * 0.3, 8), woodM, x, top(H * 0.62), 0);
      add(ship, G.cyl(0.015, 0.025, H * 0.24, 6), woodM, x, top(H * 0.87), 0);
      add(ship, G.box(0.26, 0.025, 0.34), woodM, x, top(H * 0.48), 0);            // cesto da gávea
      add(ship, G.box(0.14, 0.015, 0.22), woodM, x, top(H * 0.76), 0);            // vaus
      // vergas e velas: grande (curso), gávea, joanete e sobrejoanete
      const yards = [[0.42, 0.5], [0.66, 0.42], [0.84, 0.29], [0.95, 0.2]];
      yards.forEach(([f, wf], k) => {
        const w = H * wf * (mi === 2 ? 0.78 : 1);
        add(ship, G.cyl(0.012, 0.018, w, 6), woodM, x, top(H * f), 0, Math.PI / 2, 0, 0);
        if (mi === 2 && k === 0) return;                    // a mezena não arma vela grande (tem a spanker)
        const below = k === 0 ? deck(t) + 0.35 : H * yards[k - 1][0] + 0.03;
        const h = H * f - below - 0.02;
        add(ship, sailGeo(w * 0.94, w * (k === 0 ? 1.05 : 1.08), h, 0.12 + 0.02 * k), sailM, x + 0.04, top(H * f) - 0.01, 0);
      });
      // ovéns (enxárcias) até as mesas de enxárcia nos costados
      for (let k = 0; k < 5; k++) {
        const xx = x - 0.14 + k * 0.07, z = hull.halfAt(t, deck(t)) + 0.04;
        lines.push(x, top(H * 0.47), 0.15, xx, y0, z, x, top(H * 0.47), -0.15, xx, y0, -z);
      }
      lines.push(x, top(H * 0.75), 0.1, x - 0.05, top(H * 0.48), 0.17, x, top(H * 0.75), -0.1, x - 0.05, top(H * 0.48), -0.17);
      // brandais para ré
      lines.push(x, top(H * 0.96), 0, x - 0.55, y0, hull.halfAt(t, deck(t)), x, top(H * 0.96), 0, x - 0.55, y0, -hull.halfAt(t, deck(t)));
    });

    // Gurupés e pau da bujarrona
    const bsA = 0.4, bsX = L / 2 - 0.15, bsY = WL + 0.72;
    add(ship, G.cyl(0.03, 0.05, 1.7, 8), woodM, bsX + Math.cos(bsA) * 0.85, bsY + Math.sin(bsA) * 0.85, 0, 0, 0, -(Math.PI / 2 - bsA));
    add(ship, G.cyl(0.015, 0.025, 1.1, 6), woodM, bsX + Math.cos(bsA) * 2.1, bsY + Math.sin(bsA) * 2.1, 0, 0, 0, -(Math.PI / 2 - bsA));
    const tip = [bsX + Math.cos(bsA) * 2.6, bsY + Math.sin(bsA) * 2.6];
    // estais: traquete -> gurupés; grande -> traquete; mezena -> grande
    const F = MASTS[0], M = MASTS[1], Z = MASTS[2];
    lines.push(F.x, WL + F.H * 0.48, 0, bsX + Math.cos(bsA) * 1.5, bsY + Math.sin(bsA) * 1.5, 0);
    lines.push(F.x, WL + F.H * 0.95, 0, tip[0], tip[1], 0);
    lines.push(M.x, WL + M.H * 0.48, 0, F.x, WL + deck(F.t) + 0.2, 0);
    lines.push(M.x, WL + M.H * 0.95, 0, F.x, WL + F.H * 0.76, 0);
    lines.push(Z.x, WL + Z.H * 0.48, 0, M.x, WL + deck(M.t) + 0.3, 0);
    lines.push(Z.x, WL + Z.H * 0.95, 0, M.x, WL + M.H * 0.6, 0);

    // Bujarronas (triangulares) do gurupés até o traquete
    const jib = cached(_geoCache, 'vicJibs', () => {
      const p = [];
      [[1.2, 0.75], [1.8, 0.86], [2.5, 0.94]].forEach(([d, f]) => {
        const ax = bsX + Math.cos(bsA) * d, ay = bsY + Math.sin(bsA) * d;
        p.push(ax, ay, 0, F.x + 0.05, WL + F.H * f * 0.62 + 0.4, 0, F.x + 0.35 + d * 0.25, WL + deck(F.t) + 0.35 + d * 0.12, 0);
      });
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
      g.computeVertexNormals();
      return g;
    });
    add(ship, jib, sailM);

    // Spanker (vela latina de ré) na mezena, com carangueja e retranca
    const sp = cached(_geoCache, 'vicSpanker', () => {
      const y0 = WL + deck(Z.t) + 0.32, y1 = WL + Z.H * 0.5;
      const p = [Z.x, y0, 0, Z.x - 1.2, y0 + 0.05, 0, Z.x, y1, 0, Z.x - 1.2, y0 + 0.05, 0, Z.x - 0.85, y1 + 0.35, 0, Z.x, y1, 0];
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
      g.computeVertexNormals();
      return g;
    });
    add(ship, sp, sailM);
    lines.push(Z.x, WL + Z.H * 0.5, 0, Z.x - 0.85, WL + Z.H * 0.5 + 0.35, 0, Z.x, WL + deck(Z.t) + 0.32, 0, Z.x - 1.2, WL + deck(Z.t) + 0.37, 0);

    // Cordame: um único desenho de linhas para todos os cabos
    const rig = new THREE.BufferGeometry();
    rig.setAttribute('position', new THREE.Float32BufferAttribute(lines, 3));
    ship.add(new THREE.LineSegments(rig, cached(_matCache, 'rigging', () => new THREE.LineBasicMaterial({ color: HC.rigging, transparent: true, opacity: 0.75 }))));

    // White Ensign no pique da carangueja
    add(ship, G.plane(0.5, 0.25), ensignTexture(), Z.x - 0.95, WL + Z.H * 0.5 + 0.22, 0);

    // centraliza (o gurupés estende o navio para vante) e reduz: os mastros são altos
    ship.position.x = -1.0;
    const group = new THREE.Group();
    group.add(ship);
    group.scale.setScalar(0.64);
    group.position.y = 0;
    return group;
  }

  /* ── COURAÇADO: HMS Dreadnought (1906) ──────────────────────────
     160,6 m × 25 m · cinco torres duplas de 12": A (vante), P e Q (alas, junto à
     superestrutura de vante), X e Y (ré) · mastro tripé logo atrás da chaminé de
     vante · duas chaminés · mastro de controle de torpedos entre X e Y · convés
     de madeira · redes antitorpedo nos costados · proa de aríete. */
  function dnTurret(group, x, y, z, dir) {
    const g = new THREE.Group();
    add(g, G.cyl(0.19, 0.2, 0.08, 16), mat(HC.edGrey, { r: 0.55, m: 0.3 }), 0, 0.04, 0);
    add(g, taperBox(0.44, 0.17, 0.4, 0.86, 0.9, -0.03), mat(0x6b727b, { r: 0.5, m: 0.35 }), -0.02, 0.165, 0);
    [-0.075, 0.075].forEach(oz => add(g, G.cyl(0.018, 0.026, 0.72, 8), mat(0x2a2d31, { r: 0.4, m: 0.6 }), 0.52, 0.15, oz, 0, 0, -(Math.PI / 2 - 0.02)));
    [-0.1, 0.1].forEach(oz => add(g, G.cyl(0.007, 0.009, 0.16, 6), mat(0x2a2d31), 0.02, 0.27, oz, 0, 0, Math.PI / 2));   // 12-pdr no teto
    g.position.set(x, y, z);
    g.rotation.y = dir;
    group.add(g);
  }

  function buildBattleship() {
    const group = new THREE.Group();
    const hull = loftHull('dread', {
      L: 6.8, T: 0.38, rake: -0.32, rakeStart: 0.9,
      half: halfFn(1.06, 0.42, 0.62, 1.6, 0.16),
      deck: t => 0.25 + 0.11 * smooth(0.26, 0.3, t) + 0.03 * smooth(0.85, 1, t),
      flare: 1.0, color: modernColor(HC.edGrey), deckColor: HC.teak,
    });
    add(group, hull.geo, hullMat(0.6, 0.2), 0, WL, 0);
    const D = WL + 0.36, Dq = WL + 0.25;                      // castelo / tombadilho
    const grey = mat(HC.edGrey, { r: 0.55, m: 0.3 });

    dnTurret(group, 2.35, D, 0, 0);
    dnTurret(group, 0.72, D, 0.37, 0.1);
    dnTurret(group, 0.72, D, -0.37, -0.1);
    dnTurret(group, -1.2, D, 0, Math.PI);
    dnTurret(group, -2.55, Dq, 0, Math.PI);

    // Torre de comando, ponte e casa de navegação
    add(group, G.cyl(0.11, 0.12, 0.24, 12), grey, 1.82, D + 0.12, 0);
    add(group, taperBox(0.36, 0.2, 0.46, 0.95, 0.9), grey, 1.62, D + 0.1, 0);
    add(group, G.box(0.3, 0.025, 0.86), mat(0x5c636b, { r: 0.6 }), 1.66, D + 0.42, 0);
    add(group, G.box(0.16, 0.12, 0.26), grey, 1.62, D + 0.5, 0);

    // Chaminés (ovais) com faixa preta no topo
    [1.32, 0.12].forEach(x => {
      const f = add(group, G.cyl(0.13, 0.14, 0.82, 16), grey, x, D + 0.41, 0);
      f.scale.set(1, 1, 0.78);
      const c = add(group, G.cyl(0.133, 0.133, 0.07, 16), mat(HC.black), x, D + 0.79, 0);
      c.scale.set(1, 1, 0.78);
    });

    // Mastro tripé atrás da chaminé de vante, com o cesto de direção de tiro
    const leg = mat(0x5f666e, { r: 0.6, m: 0.3 });
    add(group, G.cyl(0.025, 0.03, 1.7, 8), leg, 0.98, D + 0.85, 0);
    [0.2, -0.2].forEach(z => add(group, G.cyl(0.016, 0.02, 1.62, 6), leg, 0.84, D + 0.8, z * 0.5, -z, 0, -0.17));
    add(group, G.box(0.28, 0.14, 0.24), grey, 0.98, D + 1.72, 0);
    add(group, G.cyl(0.012, 0.016, 0.7, 6), leg, 0.98, D + 2.14, 0);
    add(group, G.box(0.02, 0.015, 0.36), leg, 0.98, D + 2.0, 0);

    // Botes nos picadeiros entre as chaminés e o mastro grande, com o pau de carga
    [[-0.32, 0.18], [-0.32, -0.18], [-0.66, 0]].forEach(([x, z]) => add(group, taperBox(0.38, 0.07, 0.13, 1.08, 1.18), mat(HC.boat, { r: 0.7, m: 0 }), x, D + 0.1, z));
    add(group, G.cyl(0.02, 0.025, 1.3, 8), leg, -0.5, D + 0.65, 0);
    add(group, G.cyl(0.01, 0.012, 0.9, 6), leg, -0.25, D + 0.62, 0, 0, 0, 0.9);
    add(group, G.box(0.02, 0.015, 0.4), leg, -0.5, D + 1.1, 0);

    // Superestrutura de ré e o tripé baixo de controle de torpedos entre X e Y
    add(group, taperBox(0.3, 0.16, 0.34, 0.9, 0.9), grey, -1.75, D + 0.08, 0);
    add(group, G.cyl(0.018, 0.022, 0.7, 6), leg, -1.75, D + 0.5, 0);
    [0.12, -0.12].forEach(z => add(group, G.cyl(0.012, 0.015, 0.68, 6), leg, -1.81, D + 0.48, z * 0.5, -z, 0, -0.17));
    add(group, G.box(0.16, 0.08, 0.16), grey, -1.75, D + 0.86, 0);

    // Canhões de 12-pdr antitorpedeiro no convés e prateleiras das redes antitorpedo
    const atg = [];
    [2.9, 1.95, -0.05, -0.85, -2.1, -2.95].forEach(x => [1, -1].forEach(sd => {
      const t = (x + 3.4) / 6.8;
      atg.push({ p: [x, (t > 0.3 ? D : Dq) + 0.03, sd * (hull.halfAt(t, 0.3) - 0.06)], ry: sd > 0 ? -Math.PI / 2 : Math.PI / 2, rz: Math.PI / 2 });
    }));
    group.add(instanced(G.cyl(0.007, 0.009, 0.14, 6), mat(0x2a2d31, { r: 0.5, m: 0.5 }), atg));
    [1, -1].forEach(sd => add(group, G.box(4.6, 0.03, 0.035), mat(0x3a3e43, { r: 0.8 }), -0.1, WL + 0.2, sd * (hull.halfAt(0.48, 0.2) + 0.015)));

    // White Ensign no pau da bandeira, na popa
    add(group, G.cyl(0.006, 0.008, 0.4, 5), leg, -3.33, Dq + 0.2, 0);
    add(group, G.plane(0.32, 0.16), ensignTexture(), -3.5, Dq + 0.33, 0);

    group.scale.setScalar(0.95);
    return group;
  }

  /* ── FRAGATA: HMS Westminster (F237), Type 23 ───────────────────
     133 m · casco e superestrutura com faces inclinadas (assinatura radar baixa) ·
     canhão Mk 8 · silo de 32 células (Sea Wolf → Sea Ceptor) · lançadores Harpoon ·
     mastro de vante com o radar Type 997 Artisan · chaminé inclinada · hangar e
     convoo para Merlin/Wildcat. */
  function buildFrigate() {
    const group = new THREE.Group();
    const hull = loftHull('t23', {
      L: 6.0, T: 0.22, rake: 0.5,
      half: halfFn(0.72, 0.74, 0.55, 1.7),
      deck: t => 0.25 + 0.08 * smooth(0.17, 0.24, t) + 0.04 * smooth(0.78, 1, t),
      flare: 1.15, color: modernColor(), deckColor: HC.nonSkid,
    });
    add(group, hull.geo, hullMat(), 0, WL, 0);
    const D = WL + 0.33;
    const G1 = mat(HC.rnGrey, { r: 0.5, m: 0.25 });

    mk8Gun(group, 2.05, D + 0.04, 0.92);
    vlsBlock(group, 1.55, D, 0.3, 0.38, 4, 8);
    // Harpoon: dois lançadores quádruplos cruzados no convés
    [[1.18, 0.5], [1.06, -0.5]].forEach(([x, ry]) => {
      const h = new THREE.Group();
      for (let k = 0; k < 4; k++) add(h, G.box(0.3, 0.045, 0.045), mat(0x7b858f, { r: 0.6 }), 0, 0.03 + (k > 1 ? 0.05 : 0), (k % 2 ? 0.026 : -0.026));
      h.position.set(x, D + 0.02, 0);
      h.rotation.set(0, ry, 0.12);
      group.add(h);
    });

    // Ponte e superestrutura (faces inclinadas ~7°)
    add(group, taperBox(0.82, 0.38, 0.62, 0.9, 0.84), G1, 0.55, D + 0.19, 0);
    add(group, taperBox(0.5, 0.13, 0.56, 0.86, 0.86, -0.02), G1, 0.7, D + 0.44, 0);
    add(group, G.box(0.03, 0.05, 0.48), mat(HC.glass, { r: 0.1, m: 0.7 }), 0.93, D + 0.44, 0, 0, 0, -0.45);
    add(group, taperBox(1.2, 0.3, 0.6, 0.95, 0.86), G1, -0.42, D + 0.15, 0);
    add(group, taperBox(0.66, 0.33, 0.6, 1, 0.9), G1, -1.33, D + 0.165, 0);        // hangar
    add(group, G.box(0.01, 0.25, 0.36), mat(HC.rnGreyDk, { r: 0.7 }), -1.665, D + 0.13, 0);

    // Mastro de vante (pirâmide fechada) com o Type 997 Artisan girando
    add(group, taperBox(0.28, 0.62, 0.28, 0.4, 0.4), G1, 0.38, D + 0.5 + 0.31, 0);
    const artisan = new THREE.Group();
    add(artisan, G.box(0.05, 0.12, 0.3), mat(HC.rnGreyDk, { r: 0.5, m: 0.4 }));
    artisan.position.set(0.38, D + 1.2, 0);
    group.add(spinner(group, artisan, 3.0));
    add(group, G.cyl(0.008, 0.012, 0.3, 6), mat(HC.rnGreyDk), 0.38, D + 1.4, 0);

    // Chaminé inclinada para ré, com o topo preto
    add(group, taperBox(0.36, 0.34, 0.3, 0.74, 0.72, -0.07), G1, -0.5, D + 0.3 + 0.17, 0);
    add(group, G.box(0.22, 0.02, 0.2), mat(HC.black), -0.57, D + 0.645, 0);
    // mastro de comunicações a ré
    add(group, G.cyl(0.01, 0.014, 0.5, 6), mat(HC.rnGreyDk), -0.95, D + 0.55, 0);
    add(group, G.box(0.02, 0.012, 0.22), mat(HC.rnGreyDk), -0.95, D + 0.7, 0);
    // canhões de 30 mm a meia-nau
    [0.24, -0.24].forEach(z => add(group, G.cyl(0.006, 0.008, 0.14, 6), mat(0x30353c), -0.1, D + 0.33, z, 0, 0, Math.PI / 2));

    helideck(group, -2.35, WL + 0.25, 0.28);
    pennant(group, hull, 'F237', 0.86, 0.18, 0.12);

    group.scale.setScalar(1.05);
    return group;
  }

  /* ── MERCANTES do comboio (topo da página inicial, modo claro) ──────
     Navios de carga em escala real (1 unidade = 40 m): porta-contêineres
     (280 × 40 m), petroleiro Aframax (250 × 44 m), graneleiro Supramax
     (225 × 32 m) e transportador de veículos PCTC (200 × 32 m). Só aparecem
     fundidos numa malha (heroModel), então podem ter centenas de peças. */
  const MERCH = {
    hulls:  [0x1d3d5e, 0x7a2b24, 0x26292e, 0x2d5a42, 0x34506e],
    boxes:  [0xc8342b, 0x2a6fb0, 0xe08a2c, 0x2f8f5b, 0x8a96a1, 0xece8dd, 0x1f4e79, 0xd4a93a, 0x7a4a8c, 0x3c8f9e, 0xb5382f],
    funnel: [0xc43b2e, 0x1e4f8a, 0xe0a020, 0x2d6b4f, 0x26292e],
    red: 0x9c3328, white: 0xeef1f3, deck: 0x6f6a64, pipe: 0xcfd4d8, steel: 0x3a4048,
  };
  const pickR = (list, r) => list[(r() * list.length) | 0];
  function seededRand(seed) { let s = seed % 2147483646 + 1; return () => ((s = (s * 16807) % 2147483647) / 2147483647); }

  /** Casco mercante: obras vivas vermelhas com uma faixa à mostra (navio leve) e o costado na cor da companhia. */
  function merchantHull(group, key, o, hullColor) {
    const hull = loftHull(key, { sections: 72, ...o, color: y => (y < -0.001 ? MERCH.red : hullColor) });
    add(group, hull.geo, hullMat(0.7, 0.1), 0, WL, 0);
    hullBand(group, hull, -0.01, 0.06, MERCH.red, 0.02, 0.985);
    return hull;
  }

  /** Superestrutura de acomodações (popa): blocos brancos, janelas por convés, asas do passadiço, mastro e radar. */
  function accommodation(group, x, D, len, h, w, B) {
    const white = mat(MERCH.white, { r: 0.6, m: 0.1 }), glass = mat(HC.glass, { r: 0.15, m: 0.6 });
    add(group, taperBox(len, h, w, 1, 0.97), white, x, D + h / 2, 0);
    add(group, G.box(len * 0.42, 0.03, B * 1.02), white, x + len * 0.29, D + h - 0.015, 0);       // asas do passadiço
    const decks = Math.max(3, Math.round(h / 0.11));
    for (let k = 0; k < decks; k++) {
      const y = D + 0.08 + k * (h - 0.12) / (decks - 1);
      add(group, G.box(0.005, 0.02, w * 0.84), glass, x + len / 2 + 0.002, y, 0);                // janelas de vante
      [1, -1].forEach(sd => add(group, G.box(len * 0.8, 0.018, 0.005), glass, x, y, sd * (w / 2 + 0.002)));
    }
    add(group, G.box(0.005, 0.028, B * 0.9), glass, x + len * 0.5 + 0.002, D + h - 0.045, 0);        // passadiço
    add(group, G.cyl(0.007, 0.011, 0.24, 6), white, x - len * 0.15, D + h + 0.12, 0);
    add(group, G.box(0.012, 0.012, 0.18), mat(MERCH.steel), x - len * 0.15, D + h + 0.17, 0);       // radar
    add(group, G.box(0.012, 0.008, 0.12), mat(MERCH.steel), x - len * 0.15, D + h + 0.21, 0);
  }

  /** Chaminé com a cor da companhia, faixa branca e topo preto. */
  function merchantFunnel(group, x, y0, h, w, d, color) {
    add(group, taperBox(w, h, d, 0.94, 0.9, -0.01), mat(color, { r: 0.55, m: 0.15 }), x, y0 + h / 2, 0);
    add(group, G.box(w * 0.97, h * 0.12, d * 0.95), mat(MERCH.white, { r: 0.6 }), x - 0.003, y0 + h * 0.62, 0);
    add(group, G.box(w * 0.9, 0.025, d * 0.86), mat(HC.black), x - 0.008, y0 + h + 0.006, 0);
  }

  /** Baleeira de queda livre (laranja) na rampa da popa. */
  const freeFall = (group, x, y) => add(group, taperBox(0.15, 0.045, 0.055, 0.82, 0.8), mat(HC.rhib, { r: 0.7, m: 0 }), x, y, 0, 0, 0, 0.42);

  function buildContainerShip(r) {
    const group = new THREE.Group();
    const hc = pickR(MERCH.hulls, r), fc = pickR(MERCH.funnel, r);
    const L = 7, B = 1.0;
    const hull = merchantHull(group, 'cont' + hc, {
      L, T: 0.33, rake: 0.35, rakeStart: 0.86,
      half: halfFn(B, 0.88, 0.68, 1.9, 0.1),
      deck: t => 0.3 + 0.1 * smooth(0.86, 0.9, t),
      flare: t => 1 + 0.1 * smooth(0.72, 1, t),
      deckColor: MERCH.deck,
    }, hc);
    const D = WL + 0.3;

    // Contêineres: baias de 40 pés, pilhas de duas fileiras, alturas e cores sortidas (mais baixas perto da proa)
    const CW = 0.061, CH = 0.065, BAY = 0.305, lash = mat(0xd5d9dc, { r: 0.6, m: 0.3 });
    for (let x = -2.3; x + BAY < 2.55; x += BAY + 0.025) {
      const t0 = (x + L / 2) / L, t1 = (x + BAY + L / 2) / L;
      const hw = Math.min(hull.halfAt(t0, 0.3), hull.halfAt(t1, 0.3)) - 0.03;
      const groups = Math.floor(hw / CW);
      if (groups < 1) continue;
      const maxT = x > 1.9 ? 4 : x < -1.9 ? 6 : 8;
      for (let gI = 0; gI < groups; gI++) {
        const z = -groups * CW + (gI + 0.5) * CW * 2;
        const tiers = 3 + ((r() * (maxT - 2)) | 0);
        for (let k = 0; k < tiers; k++) {
          add(group, G.box(BAY - 0.008, CH - 0.007, CW * 2 - 0.007), mat(pickR(MERCH.boxes, r), { r: 0.75, m: 0.15 }),
            x + BAY / 2, D + 0.025 + k * CH + CH / 2, z);
        }
      }
      add(group, G.box(BAY, 0.025, groups * CW * 2), mat(MERCH.deck, { r: 0.8 }), x + BAY / 2, D + 0.012, 0);   // tampa do porão
      add(group, G.box(0.012, 0.14, groups * CW * 2 + 0.02), lash, x - 0.0125, D + 0.07, 0);                   // ponte de peação
    }

    accommodation(group, -2.62, D, 0.36, 0.84, 0.76, B);
    merchantFunnel(group, -3.02, D, 0.92, 0.2, 0.26, fc);
    freeFall(group, -3.3, D + 0.12);
    add(group, G.box(0.02, 0.07, 0.62), mat(hc, { r: 0.6 }), 2.62, D + 0.13, 0, 0, 0, 0.25);    // quebra-mar do castelo
    add(group, G.cyl(0.007, 0.01, 0.26, 6), mat(MERCH.white), 3.12, D + 0.23, 0);             // mastro de proa
    return group;
  }

  function buildTanker(r) {
    const group = new THREE.Group();
    const hc = pickR([0x26292e, 0x6b2320, 0x1d3d5e], r), deckC = pickR([0x9e3b33, 0x3f6e4d, 0x8c4f36], r), fc = pickR(MERCH.funnel, r);
    const L = 6.25, B = 1.1;
    merchantHull(group, 'tank' + hc + deckC, {
      L, T: 0.36, rake: 0.3, rakeStart: 0.88,
      half: halfFn(B, 0.9, 0.74, 2.0, 0.08),
      deck: t => 0.22 + 0.09 * smooth(0.88, 0.92, t),
      flare: 1.02, deckColor: deckC,
    }, hc);
    const D = WL + 0.22, pipe = mat(MERCH.pipe, { r: 0.5, m: 0.3 });

    // Tubulação de carga ao longo do convés, passarela sobre pilares e o manifold a meia-nau com dois guindastes
    [-0.075, -0.035, 0.035, 0.075].forEach(z => add(group, G.cyl(0.009, 0.009, 4.6, 6), pipe, 0.05, D + 0.02, z, 0, 0, Math.PI / 2));
    add(group, G.box(4.8, 0.008, 0.035), pipe, 0.05, D + 0.075, 0.16);
    const posts = [];
    for (let x = -2.3; x <= 2.4; x += 0.24) posts.push({ p: [x, D + 0.037, 0.16] });
    group.add(instanced(G.box(0.008, 0.075, 0.008), pipe, posts));
    add(group, G.box(0.07, 0.04, 0.98), mat(0xd8d9cf, { r: 0.6 }), 0.12, D + 0.03, 0);
    [0.42, -0.42].forEach(z => {
      add(group, G.cyl(0.02, 0.025, 0.22, 8), pipe, 0.28, D + 0.11, z);
      add(group, G.cyl(0.009, 0.012, 0.42, 6), pipe, 0.28 - 0.17, D + 0.27, z * 0.85, 0, 0, 1.0);
    });
    const hatches = [];
    for (let k = 0; k < 12; k++) [0.3, -0.3].forEach(z => hatches.push({ p: [-2.1 + k * 0.38, D + 0.012, z] }));
    group.add(instanced(G.cyl(0.035, 0.035, 0.025, 10), mat(deckC === 0x3f6e4d ? 0xcfd4d8 : 0xd8d0c0, { r: 0.6 }), hatches));

    accommodation(group, -2.38, D, 0.36, 0.66, 0.84, B);
    merchantFunnel(group, -2.74, D, 0.8, 0.18, 0.24, fc);
    freeFall(group, -3.0, D + 0.12);
    add(group, G.cyl(0.007, 0.01, 0.24, 6), mat(MERCH.white), 2.95, D + 0.21, 0);
    return group;
  }

  function buildBulker(r) {
    const group = new THREE.Group();
    const hc = pickR(MERCH.hulls, r), hatchC = pickR([0xb94a2f, 0x3c6e91, 0x5b7f4a], r), fc = pickR(MERCH.funnel, r);
    const L = 5.6, B = 0.8;
    merchantHull(group, 'bulk' + hc, {
      L, T: 0.3, rake: 0.3, rakeStart: 0.88,
      half: halfFn(B, 0.88, 0.74, 2.0, 0.09),
      deck: t => 0.24 + 0.08 * smooth(0.89, 0.93, t),
      flare: 1.02, deckColor: 0x7c756a,
    }, hc);
    const D = WL + 0.24, crane = mat(0xd8b43a, { r: 0.55, m: 0.25 });

    // Cinco porões com tampas e quatro guindastes entre eles
    for (let k = 0; k < 5; k++) {
      const x = -1.62 + k * 0.82;
      add(group, G.box(0.6, 0.04, 0.6), mat(0x6e675d, { r: 0.8 }), x, D + 0.02, 0);
      add(group, taperBox(0.56, 0.06, 0.56, 0.97, 0.86), mat(hatchC, { r: 0.6, m: 0.15 }), x, D + 0.07, 0);
      if (k < 4) {
        const xc = x + 0.41, sd = k % 2 ? 1 : -1;
        add(group, G.cyl(0.04, 0.05, 0.26, 10), crane, xc, D + 0.13, 0);
        add(group, G.box(0.1, 0.07, 0.09), crane, xc, D + 0.3, 0.03 * sd);
        add(group, G.cyl(0.011, 0.018, 0.78, 6), crane, xc + 0.3, D + 0.42, 0.1 * sd, 0.12 * sd, 0, -1.2);
      }
    }
    accommodation(group, -2.26, D, 0.34, 0.66, 0.66, B);
    merchantFunnel(group, -2.56, D, 0.78, 0.16, 0.2, fc);
    freeFall(group, -2.78, D + 0.12);
    add(group, G.cyl(0.007, 0.01, 0.22, 6), mat(MERCH.white), 2.5, D + 0.19, 0);
    return group;
  }

  function buildCarCarrier(r) {
    const group = new THREE.Group();
    const col = pickR([MERCH.white, MERCH.white, 0x2f5f8f, 0xb8392f], r), band = pickR([0x1e4f8a, 0xc43b2e, 0x2d6b4f], r);
    const L = 5.0, B = 0.8, H = 0.78;
    const hull = merchantHull(group, 'pctc' + col, {
      L, T: 0.24, rake: 0.1, rakeStart: 0.8,
      half: halfFn(B, 0.95, 0.8, 2.6, 0.05),
      deck: t => H - 0.07 * smooth(0.94, 1, t),
      flare: 1.0, deckColor: 0xc9cdd1,
    }, col);
    hullBand(group, hull, 0.52, 0.58, col === MERCH.white ? band : MERCH.white, 0.03, 0.97);
    const D = WL + H;

    add(group, G.box(0.24, 0.075, B * 0.98), mat(MERCH.white, { r: 0.6 }), 1.98, D + 0.037, 0);       // passadiço na proa
    add(group, G.box(0.005, 0.026, B * 0.9), mat(HC.glass, { r: 0.15, m: 0.6 }), 2.102, D + 0.04, 0);
    add(group, G.cyl(0.006, 0.009, 0.2, 6), mat(MERCH.white), 1.9, D + 0.17, 0);
    merchantFunnel(group, -2.12, D, 0.13, 0.22, 0.16, band);
    add(group, G.box(0.02, 0.5, 0.34), mat(0x8f979e, { r: 0.7 }), -2.505, WL + 0.3, 0.16, 0, 0, -0.08);  // rampa de popa recolhida
    // aberturas de ventilação ao longo do costado
    const vents = [];
    for (let k = 0; k < 14; k++) {
      const x = -2.1 + k * 0.3, t = (x + L / 2) / L;
      [1, -1].forEach(sd => vents.push({ p: [x, WL + 0.68, sd * (hull.halfAt(t, 0.68) + 0.004)] }));
    }
    group.add(instanced(G.box(0.07, 0.04, 0.006), mat(0x6f7882, { r: 0.7 }), vents));
    freeFall(group, -2.3, D + 0.04);
    return group;
  }

  /* ── Topo da página inicial: os mesmos navios numa malha só ───────
     heroGroup devolve o modelo com os materiais de sempre (o modo escuro
     o fotografa de lado); heroModel funde todas as peças numa geometria com
     cor por vértice (1 chamada de desenho por navio), já com a linha d'água
     em y = 0, o centro em x = 0 e sem o que fica debaixo d'água. */
  const MERCHANTS = { container: buildContainerShip, tanker: buildTanker, bulker: buildBulker, carCarrier: buildCarCarrier };
  // bocas dos canhões e janelas iluminadas (coordenadas do modelo, antes da escala do grupo)
  const HERO_POINTS = {
    destroyer:  { guns: [[2.77, WL + 0.535, 0], [-0.67, WL + 0.76, 0.27]],                         lights: [[0.75, WL + 0.8, 0.34], [0.9, WL + 0.8, 0.34], [1.05, WL + 0.8, 0.33]] },
    frigate:    { guns: [[2.62, WL + 0.485, 0], [-0.03, WL + 0.66, 0.24]],                         lights: [[0.5, WL + 0.77, 0.27], [0.65, WL + 0.77, 0.26], [0.8, WL + 0.77, 0.25]] },
    battleship: { guns: [[3.23, WL + 0.517, 0], [1.6, WL + 0.517, 0.28], [-2.08, WL + 0.517, 0]], lights: [[1.55, WL + 0.62, 0.24], [1.7, WL + 0.62, 0.24], [-1.75, WL + 0.45, 0.17]] },
    carrier:    { guns: [[3.13, WL + 0.73, 0.28], [-3.37, WL + 0.73, 0.62]],                       lights: [[0.6, WL + 1.33, 0.93], [0.8, WL + 1.33, 0.93], [-1.0, WL + 1.25, 0.93]] },
  };

  function heroGroup(kind, seed = 1) {
    const group = MERCHANTS[kind] ? MERCHANTS[kind](seededRand(seed)) : buildShip(kind);
    group.userData.wl = WL * group.scale.y;
    const pts = HERO_POINTS[kind];
    if (pts) Object.assign(group.userData, pts);
    return group;
  }

  function mergeGroup(group) {
    group.updateMatrixWorld(true);
    const wl = group.userData.wl;
    const pos = [], nor = [], col = [];
    const m4 = new THREE.Matrix4(), nm = new THREE.Matrix3(), c = new THREE.Color();
    const v = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()], n = new THREE.Vector3();
    group.traverse(o => {
      if (!o.isMesh || o.visible === false) return;
      const g = o.geometry;
      if (!g.attributes.normal) g.computeVertexNormals();
      const P = g.attributes.position, N = g.attributes.normal, CC = g.attributes.color, I = g.index;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      const total = I ? I.count : P.count;
      const groups = g.groups.length ? g.groups : [{ start: 0, count: total, materialIndex: 0 }];
      for (let k = 0; k < (o.isInstancedMesh ? o.count : 1); k++) {
        if (o.isInstancedMesh) { o.getMatrixAt(k, m4); m4.premultiply(o.matrixWorld); } else m4.copy(o.matrixWorld);
        nm.getNormalMatrix(m4);
        for (const gr of groups) {
          const mt = mats[gr.materialIndex] || mats[0];
          if (!mt || mt.map || (mt.transparent && mt.opacity < 0.9)) continue;   // números, bandeiras e o disco do rotor ficam de fora
          const end = Math.min(gr.start + gr.count, total);
          for (let i = gr.start; i + 2 < end; i += 3) {
            const ids = I ? [I.getX(i), I.getX(i + 1), I.getX(i + 2)] : [i, i + 1, i + 2];
            for (let j = 0; j < 3; j++) v[j].fromBufferAttribute(P, ids[j]).applyMatrix4(m4);
            if (v[0].y < wl - 0.002 && v[1].y < wl - 0.002 && v[2].y < wl - 0.002) continue;   // debaixo d'água
            for (let j = 0; j < 3; j++) {
              pos.push(v[j].x, v[j].y - wl, v[j].z);
              n.fromBufferAttribute(N, ids[j]).applyMatrix3(nm).normalize();
              nor.push(n.x, n.y, n.z);
              if (mt.vertexColors && CC) c.fromBufferAttribute(CC, ids[j]); else c.copy(mt.color);
              col.push(c.r, c.g, c.b);
            }
          }
        }
      }
    });
    let x0 = Infinity, x1 = -Infinity;
    for (let i = 0; i < pos.length; i += 3) { x0 = Math.min(x0, pos[i]); x1 = Math.max(x1, pos[i]); }
    const cx = (x0 + x1) / 2;
    for (let i = 0; i < pos.length; i += 3) pos[i] -= cx;
    // contorno do casco na linha d'água (meia-boca por faixa de comprimento): a espuma em volta do casco
    const NB = 28, len = x1 - x0, half = new Array(NB + 1).fill(0);
    for (let i = 0; i < pos.length; i += 3) {
      if (Math.abs(pos[i + 1]) > 0.004) continue;
      const b = Math.round(((pos[i] + len / 2) / len) * NB);
      half[b] = Math.max(half[b], Math.abs(pos[i + 2]));
    }
    for (let b = 1; b < NB; b++) if (!half[b]) half[b] = (half[b - 1] + (half[b + 1] || half[b - 1])) / 2;
    const waterline = half.map((h, b) => [b / NB - 0.5, h / len]);    // [x, meia-boca] em frações do comprimento
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.computeBoundingSphere();
    return { geo, len, waterline };
  }

  const heroModel = (kind, seed) => mergeGroup(heroGroup(kind, seed));

  function buildShip(type) {
    switch (type) {
      case 'carrier':
      case 'carrier-detail':    return buildCarrier();
      case 'destroyer':
      case 'destroyer-detail':  return buildDestroyer();
      case 'submarine':
      case 'submarine-detail':  return buildSubmarine();
      case 'galleon':
      case 'galleon-detail':    return buildGalleon();
      case 'battleship':
      case 'battleship-detail': return buildBattleship();
      case 'frigate':
      case 'frigate-detail':    return buildFrigate();
      default:                  return buildDestroyer();
    }
  }

  /* ═══════════════════════════════════════════════════════════════
     GERENCIADOR DE CENAS — um loop, só o que está visível
     ═══════════════════════════════════════════════════════════════ */
  const entries = [];
  const byCanvas = new WeakMap();
  const initQueue = [];
  let modalEntry = null;
  let rafId = 0;
  let lastTime = 0;
  let backgroundPaused = false;

  function start() {
    if (rafId || document.hidden) return;
    lastTime = performance.now();
    rafId = requestAnimationFrame(frame);
  }

  function stop() {
    if (!rafId) return;
    cancelAnimationFrame(rafId);
    rafId = 0;
  }

  function frame(now) {
    rafId = requestAnimationFrame(frame);
    const dt = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;

    // No máximo UMA cena nova por frame, para não travar a rolagem
    if (initQueue.length) initEntry(initQueue.shift());

    let active = 0;
    for (const e of entries) {
      if (!e.ready || !e.visible) continue;
      if (backgroundPaused && !e.isModal) continue;
      if (e.card && e.card.classList.contains('is-dimmed')) continue;

      if (e.resizePending && !applyResize(e)) continue;
      e.update(dt);
      e.renderer.render(e.scene, e.camera);
      active++;
    }

    if (!active && !initQueue.length) stop();
  }

  function applyResize(e) {
    const w = e.canvas.clientWidth, h = e.canvas.clientHeight;
    if (!w || !h) return false;
    e.renderer.setSize(w, h, false);
    e.camera.aspect = w / h;
    // Quadros mais "em pé" que FIT_ASPECT (modal, galeria): afasta a câmera para o navio caber
    const k = Math.max(1, Math.sqrt(FIT_ASPECT / e.camera.aspect));
    e.camera.position.set(e.baseCam[0] * k, e.baseCam[1] * k, e.baseCam[2] * k);
    e.camera.lookAt(0, 0, 0);
    e.fogScale = k;
    e.scene.fog.density = (e.fogBase || FOG_DENSITY) / k;      // névoa proporcional à distância
    e.camera.updateProjectionMatrix();
    e.resizePending = false;
    return true;
  }

  const ro = new ResizeObserver(list => {
    for (const r of list) {
      const e = byCanvas.get(r.target);
      if (e) e.resizePending = true;
    }
    start();
  });

  const io = new IntersectionObserver(list => {
    for (const it of list) {
      const e = byCanvas.get(it.target);
      if (!e) continue;
      e.visible = it.isIntersecting;
      if (e.visible && !e.ready && !e.failed && !e.queued) {
        e.queued = true;
        initQueue.push(e);
      }
    }
    if (entries.some(e => e.visible)) start();
  }, { rootMargin: '120px 0px' });

  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));

  /* ── Interação: arrastar para girar ─────────────────────────── */
  function attachDrag(canvas, d) {
    canvas.addEventListener('pointerdown', ev => {
      if (ev.pointerType === 'mouse' && ev.button !== 0) return;
      d.dragging = true;
      d.auto = false;
      d.lastX = ev.clientX;
      d.lastY = ev.clientY;
      clearTimeout(d.idle);
      canvas.setPointerCapture(ev.pointerId);
      canvas.classList.add('is-dragging');
    });

    canvas.addEventListener('pointermove', ev => {
      if (!d.dragging) return;
      d.targetY += (ev.clientX - d.lastX) * 0.012;
      if (d.tilt) d.targetX = Math.max(-0.5, Math.min(0.6, d.targetX + (ev.clientY - d.lastY) * 0.008));
      d.lastX = ev.clientX;
      d.lastY = ev.clientY;
    });

    const end = () => {
      if (!d.dragging) return;
      d.dragging = false;
      canvas.classList.remove('is-dragging');
      clearTimeout(d.idle);
      d.idle = setTimeout(() => { d.auto = true; }, 2500);
    };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);
    canvas.addEventListener('lostpointercapture', end);
  }

  /* ── Vista de um navio (cards, galeria e modal) ─────────────── */
  function setupShipView(e) {
    const d = e.drag = {
      dragging: false, auto: true, tilt: e.tilt,
      targetY: 0.4, targetX: 0.1, rotY: 0.4, rotX: 0.1,
      lastX: 0, lastY: 0, idle: 0,
    };
    let t = 0;

    e.setShip = type => {
      if (e.ship) e.scene.remove(e.ship);
      e.ship = buildShip(type);
      e.scene.add(e.ship);
    };
    e.setShip(e.type);
    attachDrag(e.canvas, d);

    e.update = dt => {
      t += dt;
      if (d.auto) d.targetY += e.spin * dt;
      const k = 1 - Math.exp(-5 * dt);          // suavização independente do FPS
      d.rotY += (d.targetY - d.rotY) * k;
      d.rotX += (d.targetX - d.rotX) * k;
      e.ship.rotation.y = d.rotY;
      e.ship.rotation.x = d.rotX;
      const spin = e.ship.userData.spin;
      if (spin) for (const r of spin) r.rotation.y += r.userData.vel * dt;      // radares girando
      e.ship.position.y = Math.sin(t * e.bobSpeed) * e.bobAmp;
    };
  }

  /* ── Vista da frota (formação) ──────────────────────────────── */
  function setupFleetView(e) {
    // escala relativa real (comprimentos: QE 284 m · Type 45 152 m · Type 23 133 m · Astute 97 m)
    const formation = [
      { type: 'carrier',   pos: [0, 0, 0],       rot: 0,     k: 1 },
      { type: 'destroyer', pos: [-6, 0, -3],     rot: 0.15,  k: 0.57 },
      { type: 'destroyer', pos: [6, 0, -3],      rot: -0.15, k: 0.57 },
      { type: 'submarine', pos: [-4.5, 0, 3.6],  rot: 0.1,   k: 0.4 },
      { type: 'frigate',   pos: [4.5, 0, 3.6],   rot: -0.1,  k: 0.51 },
    ];
    const ships = formation.map(({ type, pos, rot, k }) => {
      const s = buildShip(type);
      s.scale.multiplyScalar(k);
      s.position.set(...pos);
      s.rotation.y = rot;
      s.userData.baseY = pos[1];
      e.scene.add(s);
      return s;
    });

    let t = 0;
    e.update = dt => {
      t += 0.6 * dt;
      ships.forEach((s, i) => {
        s.position.y = s.userData.baseY + Math.sin(t * 0.7 + i * 1.2) * 0.04;
        s.rotation.y += 0.12 * dt;
        if (s.userData.spin) for (const r of s.userData.spin) r.rotation.y += r.userData.vel * dt;
      });
    };
  }

  function initEntry(e) {
    e.queued = false;
    try {
      const env = createScene(e.canvas, e.sceneOpts);
      e.scene = env.scene;
      e.camera = env.camera;
      e.renderer = env.renderer;
      e.hemi = env.hemi;
      e.sun = env.sun;
      e.ocean = env.ocean;
      e.fogBase = FOG_DENSITY * THEMES[currentTheme].fogK;
      e.baseCam = (e.sceneOpts.camera || DEFAULT_CAM).slice();
      if (e.kind === 'fleet') setupFleetView(e); else setupShipView(e);
      e.ready = true;
      e.resizePending = true;
    } catch (err) {
      e.failed = true;
      console.warn('[3D] não foi possível iniciar', e.canvas.id || e.canvas.className, err);
      e.canvas.parentElement && e.canvas.parentElement.classList.add('no-webgl');
    }
  }

  function register(canvas, kind, extra) {
    const e = Object.assign({
      canvas, kind,
      type: canvas.dataset.type || 'destroyer',
      card: canvas.closest('.ship-card'),
      sceneOpts: { shadows: false, maxDpr: 1.5 },
      tilt: true, spin: 0.24, bobAmp: 0.06, bobSpeed: 0.8,
      visible: false, ready: false, failed: false, queued: false, resizePending: true,
    }, extra);
    entries.push(e);
    byCanvas.set(canvas, e);
    return e;
  }

  /* ── API pública ────────────────────────────────────────────── */
  function init() {
    document.querySelectorAll('.ship-canvas').forEach(c => io.observe(register(c, 'ship').canvas));

    document.querySelectorAll('.gallery-canvas').forEach((c, i) => {
      const large = i === 0;                      // só a imagem grande projeta sombras
      io.observe(register(c, 'ship', { sceneOpts: { shadows: large, maxDpr: large ? 1.75 : 1.5 } }).canvas);
    });

    const fleet = document.getElementById('fleet-canvas');
    if (fleet) {
      io.observe(register(fleet, 'fleet', { sceneOpts: { shadows: false, maxDpr: 1.5, camera: [0, 6, 18] } }).canvas);
    }

    // Observa o resize de todos (ResizeObserver dispara ao observar)
    entries.forEach(e => ro.observe(e.canvas));
  }

  function openModal(type) {
    const canvas = document.getElementById('modal-canvas');
    if (!canvas) return;

    if (!modalEntry) {
      modalEntry = register(canvas, 'ship', {
        type, isModal: true, card: null, tilt: false, spin: 0.3, bobAmp: 0.08, bobSpeed: 0.9,
        sceneOpts: { shadows: true, maxDpr: 2, camera: [0, 3, 10] },
      });
      initEntry(modalEntry);                      // cria o renderer UMA vez e reutiliza
      ro.observe(canvas);
    } else if (modalEntry.ready) {
      modalEntry.setShip(type);
      modalEntry.drag.targetY = modalEntry.drag.rotY = 0.4;
    }

    modalEntry.visible = true;
    modalEntry.resizePending = true;
    backgroundPaused = true;                      // o fundo está coberto: não renderiza
    start();
  }

  function closeModal() {
    if (modalEntry) modalEntry.visible = false;
    backgroundPaused = false;
    start();
  }

  /** Troca o tema de TODAS as cenas (as que ainda não existem já nascem no tema certo). */
  function setTheme(mode) {
    if (!THEMES[mode] || mode === currentTheme) return;
    currentTheme = mode;
    entries.forEach(e => { if (e.ready) applyTheme(e, mode); });
    start();                                          // redesenha as cenas visíveis com o novo visual
  }

  window.ShipEngine = { init, openModal, closeModal, setTheme, heroGroup, heroModel };
})();
