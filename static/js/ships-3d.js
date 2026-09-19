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
    window.ShipEngine = { init() {}, openModal() {}, closeModal() {} };
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

  const SKY_TOP = '#3d9fe4', SKY_MID = '#86cdf3', SKY_HORIZON = '#cdeefb';
  const FOG_COLOR = 0xcdeefb;
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
  let _sky = null;
  function skyTexture() {
    if (_sky) return _sky;
    const c = document.createElement('canvas');
    c.width = 2; c.height = 256;
    const g = c.getContext('2d');
    const grad = g.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, SKY_TOP);
    grad.addColorStop(0.5, SKY_MID);
    grad.addColorStop(0.72, SKY_HORIZON);
    grad.addColorStop(1, SKY_HORIZON);
    g.fillStyle = grad;
    g.fillRect(0, 0, 2, 256);
    _sky = new THREE.CanvasTexture(c);
    return _sky;
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
    const mesh = new THREE.Mesh(oceanGeometry(), mat(C.water, { r: 0.28, m: 0.05 }));
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
    scene.background = skyTexture();
    scene.fog = new THREE.FogExp2(FOG_COLOR, FOG_DENSITY);

    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 200);
    camera.position.set(camPos[0], camPos[1], camPos[2]);
    camera.lookAt(0, 0, 0);

    // Luz do céu + reflexo do mar, e um sol quente
    scene.add(new THREE.HemisphereLight(0xeaf6ff, 0xb4d2d6, 0.66));

    const sun = new THREE.DirectionalLight(0xfff0c2, 1.0);
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

    scene.add(buildOcean());
    return { scene, camera, renderer };
  }

  /* ═══════════════════════════════════════════════════════════════
     SHIP BUILDERS — modelos 3D procedurais
     ═══════════════════════════════════════════════════════════════ */

  /* ── PORTA-AVIÕES ───────────────────────────────────────────── */
  let _carrierHull = null;
  function carrierHullGeo() {
    if (_carrierHull) return _carrierHull;
    const shape = new THREE.Shape();
    shape.moveTo(-3.5, 0);
    shape.lineTo(-3.2, 0.5);
    shape.lineTo(3.0, 0.5);
    shape.lineTo(3.5, 0.2);
    shape.lineTo(3.5, -0.5);
    shape.lineTo(-3.5, -0.5);
    shape.lineTo(-3.5, 0);
    _carrierHull = new THREE.ExtrudeGeometry(shape, { depth: 1.4, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 2 });
    _carrierHull.center();
    return _carrierHull;
  }

  function buildCarrier() {
    const group = new THREE.Group();

    const hull = new THREE.Mesh(carrierHullGeo(), mat(C.hull_carrier));
    hull.castShadow = true;
    hull.position.y = 0.1;
    group.add(hull);

    const deck = new THREE.Mesh(G.box(7.5, 0.08, 1.6), mat(C.deck, { r: 0.8 }));
    deck.position.set(0, 0.7, 0);
    deck.castShadow = true;
    group.add(deck);

    const ramp = new THREE.Mesh(G.box(0.8, 0.04, 1.6), mat(C.deck));
    ramp.position.set(-3.35, 0.72, 0);
    ramp.rotation.z = 0.18;
    group.add(ramp);

    const island = new THREE.Mesh(G.box(1.0, 0.9, 0.5), mat(C.steel, { r: 0.5, m: 0.4 }));
    island.position.set(1.8, 1.15, -0.55);
    island.castShadow = true;
    group.add(island);

    for (let i = 0; i < 3; i++) {
      const lvl = new THREE.Mesh(G.box(0.9 - i * 0.12, 0.18, 0.45 - i * 0.06), mat(C.steel_dark, { r: 0.5 }));
      lvl.position.set(1.8, 1.6 + i * 0.2, -0.55);
      group.add(lvl);
    }

    const mast = new THREE.Mesh(G.cyl(0.02, 0.03, 0.9, 6), mat(C.steel_dark));
    mast.position.set(1.8, 2.3, -0.55);
    group.add(mast);

    const radar = new THREE.Mesh(G.cyl(0.2, 0.2, 0.03, 8), mat(C.steel, { m: 0.8 }));
    radar.position.set(1.8, 2.8, -0.55);
    group.add(radar);

    const line = new THREE.Mesh(G.box(6.5, 0.005, 0.04), mat(0xffffff, { r: 1, m: 0 }));
    line.position.set(0, 0.745, 0);
    group.add(line);

    // Luzes de borda do convés — 26 esferas em 1 draw call
    const lights = [];
    for (let k = 0; k <= 12; k++) {
      const x = -3 + k * 0.5;
      lights.push({ p: [x, 0.745, 0.76] }, { p: [x, 0.745, -0.76] });
    }
    group.add(instanced(G.sphere(0.025, 4, 4), mat(0x2f80e0, { r: 0.2, m: 0.8 }), lights));

    const wave = new THREE.Mesh(G.cone(0.15, 0.6, 6), mat(0xe8fbff, { r: 0.1, op: 0.7 }));
    wave.rotation.z = -Math.PI / 2;
    wave.position.set(-3.7, 0.2, 0);
    group.add(wave);

    group.scale.setScalar(0.95);
    return group;
  }

  /* ── DESTRÓIER ──────────────────────────────────────────────── */
  function buildDestroyer() {
    const group = new THREE.Group();

    const hull = new THREE.Mesh(G.box(6.0, 0.8, 0.9), mat(C.hull_destroyer));
    hull.castShadow = true;
    group.add(hull);

    const bow = new THREE.Mesh(G.cyl(0, 0.45, 0.9, 4), mat(C.hull_destroyer));
    bow.rotation.z = Math.PI / 2;
    bow.position.set(3.2, 0, 0);
    group.add(bow);

    const deck = new THREE.Mesh(G.box(5.8, 0.06, 0.85), mat(C.deck));
    deck.position.y = 0.43;
    group.add(deck);

    const super1 = new THREE.Mesh(G.box(1.4, 0.7, 0.65), mat(C.steel, { r: 0.4, m: 0.5 }));
    super1.position.set(0.8, 0.9, 0);
    group.add(super1);

    const bridge = new THREE.Mesh(G.box(0.9, 0.35, 0.6), mat(C.steel_dark, { r: 0.35, m: 0.5 }));
    bridge.position.set(0.8, 1.3, 0);
    group.add(bridge);

    const windows = new THREE.Mesh(G.box(0.85, 0.06, 0.02), mat(C.glass, { r: 0.05, m: 0.9 }));
    windows.position.set(0.8, 1.35, 0.32);
    group.add(windows);

    const super2 = new THREE.Mesh(G.box(1.0, 0.5, 0.6), mat(C.steel, { r: 0.4, m: 0.5 }));
    super2.position.set(-1.0, 0.76, 0);
    group.add(super2);

    const funnel = new THREE.Mesh(G.cyl(0.12, 0.16, 0.55, 8), mat(0x2a2f3c));
    funnel.position.set(-0.3, 1.35, 0);
    group.add(funnel);

    const gun = new THREE.Group();
    gun.add(new THREE.Mesh(G.cyl(0.14, 0.18, 0.2, 8), mat(C.steel_dark)));
    const barrel = new THREE.Mesh(G.cyl(0.035, 0.05, 0.9, 6), mat(0x232a38));
    barrel.rotation.z = Math.PI / 2;
    barrel.position.x = 0.45;
    gun.add(barrel);
    gun.position.set(2.2, 0.6, 0);
    group.add(gun);

    const vls = new THREE.Mesh(G.box(0.6, 0.12, 0.55), mat(C.deck_dark, { r: 0.9 }));
    vls.position.set(1.5, 0.5, 0);
    group.add(vls);

    const mast = new THREE.Mesh(G.cyl(0.02, 0.035, 1.5, 6), mat(C.steel_dark));
    mast.position.set(0.5, 2.0, 0);
    group.add(mast);

    const radar = new THREE.Mesh(G.box(0.35, 0.04, 0.28), mat(C.steel, { m: 0.8 }));
    radar.position.set(0.5, 2.8, 0);
    radar.rotation.y = 0.3;
    group.add(radar);

    const hpad = new THREE.Mesh(G.cyl(0.38, 0.38, 0.03, 12), mat(C.deck_dark, { r: 0.9 }));
    hpad.position.set(-2.5, 0.47, 0);
    group.add(hpad);

    const hmark = new THREE.Mesh(G.box(0.4, 0.005, 0.04), mat(0xffffff, { r: 1 }));
    hmark.position.set(-2.5, 0.50, 0);
    group.add(hmark);

    group.scale.setScalar(0.9);
    return group;
  }

  /* ── SUBMARINO ──────────────────────────────────────────────── */
  function buildSubmarine() {
    const group = new THREE.Group();

    const body = new THREE.Mesh(G.cyl(0.55, 0.55, 6.0, 16), mat(C.hull_sub, { r: 0.3, m: 0.6 }));
    body.rotation.z = Math.PI / 2;
    body.castShadow = true;
    group.add(body);

    const bowDome = new THREE.Mesh(G.sphere(0.55, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(C.hull_sub, { r: 0.25, m: 0.5 }));
    bowDome.rotation.z = -Math.PI / 2;
    bowDome.position.x = 3.0;
    group.add(bowDome);

    const sternCone = new THREE.Mesh(G.cone(0.55, 1.4, 12), mat(C.hull_sub, { r: 0.3 }));
    sternCone.rotation.z = Math.PI / 2;
    sternCone.position.x = -3.35;
    group.add(sternCone);

    const sail = new THREE.Mesh(G.box(0.6, 0.9, 0.3), mat(C.hull_sub, { r: 0.3, m: 0.5 }));
    sail.position.set(0.5, 0.7, 0);
    group.add(sail);

    const sailTop = new THREE.Mesh(G.box(0.5, 0.15, 0.28), mat(C.steel_dark, { r: 0.4 }));
    sailTop.position.set(0.5, 1.2, 0);
    group.add(sailTop);

    const scope = new THREE.Mesh(G.cyl(0.025, 0.025, 0.7, 5), mat(C.steel_dark));
    scope.position.set(0.55, 1.65, 0.05);
    group.add(scope);

    const scopeHead = new THREE.Mesh(G.box(0.06, 0.12, 0.06), mat(C.glass, { r: 0.1, m: 0.9 }));
    scopeHead.position.set(0.55, 2.0, 0.05);
    group.add(scopeHead);

    // Tubos de torpedo (4)
    const tubes = [];
    for (let i = -1; i <= 1; i += 2) {
      for (let j = 0; j < 2; j++) tubes.push({ p: [3.1, i * 0.18, j * 0.22 - 0.11], rz: Math.PI / 2 });
    }
    group.add(instanced(G.cyl(0.055, 0.055, 0.3, 8), mat(0x1a2230, { m: 0.8 }), tubes));

    // Lemes de mergulho (proa) e de popa
    const diving = [], rudders = [], hplanes = [];
    for (let side = -1; side <= 1; side += 2) {
      diving.push({ p: [2.0, 0, side * 0.65] });
      rudders.push({ p: [-3.5, side * 0.35, 0] });
      hplanes.push({ p: [-3.4, 0, side * 0.55] });
    }
    // (material distinto do cone de popa: não misturar InstancedMesh e Mesh no mesmo material)
    group.add(instanced(G.box(0.55, 0.04, 0.15), mat(C.hull_sub, { r: 0.32 }), diving));
    group.add(instanced(G.box(0.06, 0.5, 0.08), mat(C.hull_sub), rudders));
    group.add(instanced(G.box(0.5, 0.05, 0.12), mat(C.hull_sub), hplanes));

    // Hélice
    const blades = [];
    for (let b = 0; b < 4; b++) {
      const a = (b / 4) * Math.PI * 2;
      blades.push({ p: [-3.8, Math.sin(a) * 0.2, Math.cos(a) * 0.2], rx: a });
    }
    group.add(instanced(G.box(0.08, 0.32, 0.03), mat(C.brass, { r: 0.2, m: 0.7 }), blades));

    group.position.y = 0.1;
    group.scale.setScalar(0.85);
    return group;
  }

  /* ── GALEÃO (HMS Victory) ───────────────────────────────────── */
  function buildGalleon() {
    const group = new THREE.Group();

    const hull = new THREE.Mesh(G.box(5.2, 1.1, 1.3), mat(C.hull_galleon, { r: 0.85, m: 0.05 }));
    hull.castShadow = true;
    group.add(hull);

    const bottom = new THREE.Mesh(G.cyl(0.5, 0.3, 5.2, 8), mat(C.wood_dark, { r: 0.9 }));
    bottom.rotation.z = Math.PI / 2;
    bottom.position.y = -0.5;
    group.add(bottom);

    const bow = new THREE.Mesh(G.cone(0.65, 1.0, 5), mat(C.hull_galleon, { r: 0.85 }));
    bow.rotation.z = -Math.PI / 2;
    bow.position.set(2.9, 0.1, 0);
    group.add(bow);

    const stern = new THREE.Mesh(G.box(1.0, 1.4, 1.25), mat(C.hull_galleon, { r: 0.9 }));
    stern.position.set(-2.2, 0.7, 0);
    group.add(stern);

    const fore = new THREE.Mesh(G.box(0.8, 0.7, 1.1), mat(C.hull_galleon, { r: 0.9 }));
    fore.position.set(2.1, 0.5, 0);
    group.add(fore);

    const deck = new THREE.Mesh(G.box(5.0, 0.07, 1.2), mat(0x8a6238, { r: 0.95 }));
    deck.position.y = 0.57;
    group.add(deck);

    // Portinholas (16) e canhões (8): 2 draw calls no total
    const ports = [], cannons = [];
    for (let k = 0; k < 8; k++) {
      const x = -1.8 + k * 0.5;
      ports.push({ p: [x, 0.1, 0.67] }, { p: [x, 0.1, -0.67] });
    }
    for (let k = 0; k < 4; k++) {
      const x = -1.5 + k * 0.8;
      cannons.push({ p: [x, 0.1, 0.7], rz: Math.PI / 2 }, { p: [x, 0.1, -0.7], rz: Math.PI / 2 });
    }
    group.add(instanced(G.box(0.12, 0.09, 0.04), mat(0x2a1400), ports));
    group.add(instanced(G.cyl(0.045, 0.06, 0.35, 6), mat(C.brass, { r: 0.3, m: 0.6 }), cannons));

    const masts = [
      { x: 1.3,  height: 3.2 },
      { x: 0.0,  height: 3.8 },
      { x: -1.5, height: 2.8 },
    ];
    const ropeMat = mat(C.rope, { r: 0.95 });
    const sailMat = mat(C.canvas_sail, { r: 0.95, m: 0, extra: { side: THREE.DoubleSide } });

    masts.forEach(({ x, height }) => {
      const mast = new THREE.Mesh(G.cyl(0.04, 0.06, height, 6), ropeMat);
      mast.position.set(x, height / 2 + 0.6, 0);
      group.add(mast);

      [0.45, 0.7, 0.88].forEach(frac => {
        const yard = new THREE.Mesh(G.cyl(0.02, 0.025, height * 0.7 * (1 - frac * 0.3), 5), ropeMat);
        yard.rotation.z = Math.PI / 2;
        yard.position.set(x, height * frac + 0.6, 0);
        group.add(yard);

        const sail = new THREE.Mesh(G.plane(height * 0.65 * (1 - frac * 0.25), height * 0.28), sailMat);
        sail.position.set(x, height * (frac - 0.06) + 0.6, 0);
        group.add(sail);
      });
    });

    const bowsprit = new THREE.Mesh(G.cyl(0.025, 0.04, 2.5, 5), ropeMat);
    bowsprit.rotation.z = -Math.PI / 5;
    bowsprit.position.set(3.2, 1.4, 0);
    group.add(bowsprit);

    const flag = new THREE.Mesh(G.plane(0.5, 0.32), mat(C.flag, { r: 0.9, m: 0, extra: { side: THREE.DoubleSide } }));
    flag.position.set(0, 4.5, 0.05);
    group.add(flag);

    group.scale.setScalar(0.85);
    return group;
  }

  /* ── COURAÇADO (Dreadnought) ────────────────────────────────── */
  function buildBattleship() {
    const group = new THREE.Group();

    const hull = new THREE.Mesh(G.box(7.0, 1.0, 1.3), mat(C.hull_battle, { r: 0.55, m: 0.35 }));
    hull.castShadow = true;
    group.add(hull);

    const bow = new THREE.Mesh(G.cone(0.65, 1.2, 5), mat(C.hull_battle, { r: 0.55 }));
    bow.rotation.z = -Math.PI / 2;
    bow.position.set(3.7, 0.1, 0);
    group.add(bow);

    const belt = new THREE.Mesh(G.box(6.5, 0.3, 1.32), mat(0x566070, { r: 0.6, m: 0.4 }));
    belt.position.y = 0.2;
    group.add(belt);

    const deck = new THREE.Mesh(G.box(6.8, 0.08, 1.25), mat(0x7a7a86, { r: 0.7 }));
    deck.position.y = 0.54;
    group.add(deck);

    const ct = new THREE.Mesh(G.cyl(0.3, 0.35, 0.9, 8), mat(C.steel_dark, { r: 0.45, m: 0.5 }));
    ct.position.set(0.5, 1.15, 0);
    group.add(ct);

    const slit = new THREE.Mesh(G.box(0.62, 0.04, 0.04), mat(C.glass, { r: 0.05, m: 0.9 }));
    slit.position.set(0.5, 1.35, 0.33);
    group.add(slit);

    // 5 torres de canhões gêmeos
    [-2.8, -1.4, 0.2, 1.6, 2.8].forEach(x => {
      const turret = new THREE.Group();
      turret.add(new THREE.Mesh(G.cyl(0.28, 0.32, 0.26, 10), mat(C.steel_dark, { r: 0.4, m: 0.5 })));

      const house = new THREE.Mesh(G.box(0.6, 0.24, 0.5), mat(0x4a4a5c, { r: 0.45, m: 0.4 }));
      house.position.y = 0.22;
      turret.add(house);

      [-0.1, 0.1].forEach(oz => {
        const barrel = new THREE.Mesh(G.cyl(0.04, 0.055, 1.1, 6), mat(0x22222c, { m: 0.7 }));
        barrel.rotation.z = Math.PI / 2;
        barrel.position.set(0.55, 0.22, oz);
        turret.add(barrel);
      });

      turret.position.set(x, 0.66, 0);
      group.add(turret);
    });

    [0.0, -0.8].forEach(x => {
      const funnel = new THREE.Mesh(G.cyl(0.18, 0.22, 0.9, 8), mat(0x2c2c34));
      funnel.position.set(x, 1.4, 0);
      group.add(funnel);

      const top = new THREE.Mesh(G.cyl(0.18, 0.18, 0.1, 8), mat(0x0c0c10));
      top.position.set(x, 1.9, 0);
      group.add(top);
    });

    const mast1 = new THREE.Mesh(G.cyl(0.03, 0.04, 2.2, 6), mat(C.steel_dark));
    mast1.position.set(1.5, 1.75, 0);
    group.add(mast1);

    const top1 = new THREE.Mesh(G.cyl(0.2, 0.2, 0.12, 10), mat(C.steel_dark));
    top1.position.set(1.5, 2.5, 0);
    group.add(top1);

    const mast1top = new THREE.Mesh(G.cyl(0.015, 0.02, 1.2, 5), mat(C.steel_dark));
    mast1top.position.set(1.5, 3.3, 0);
    group.add(mast1top);

    group.scale.setScalar(0.82);
    return group;
  }

  /* ── FRAGATA (Type 23) ──────────────────────────────────────── */
  function buildFrigate() {
    const group = new THREE.Group();

    const hull = new THREE.Mesh(G.box(5.5, 0.85, 0.95), mat(C.hull_frigate, { r: 0.55 }));
    hull.castShadow = true;
    group.add(hull);

    const bow = new THREE.Mesh(G.cone(0.48, 0.8, 5), mat(C.hull_frigate));
    bow.rotation.z = -Math.PI / 2;
    bow.position.set(2.95, 0.05, 0);
    group.add(bow);

    const deck = new THREE.Mesh(G.box(5.3, 0.06, 0.9), mat(C.deck, { r: 0.75 }));
    deck.position.y = 0.46;
    group.add(deck);

    const super1 = new THREE.Mesh(G.box(1.5, 0.75, 0.72), mat(C.steel, { r: 0.4, m: 0.5 }));
    super1.position.set(0.5, 0.9, 0);
    group.add(super1);

    const bridge = new THREE.Mesh(G.box(0.9, 0.3, 0.65), mat(C.steel_dark, { r: 0.4 }));
    bridge.position.set(0.5, 1.35, 0);
    group.add(bridge);

    const aft = new THREE.Mesh(G.box(0.9, 0.5, 0.68), mat(C.steel, { r: 0.4, m: 0.45 }));
    aft.position.set(-1.2, 0.73, 0);
    group.add(aft);

    const vls = new THREE.Mesh(G.box(0.5, 0.1, 0.55), mat(C.deck_dark, { r: 0.9 }));
    vls.position.set(1.6, 0.51, 0);
    group.add(vls);

    const gunGrp = new THREE.Group();
    gunGrp.add(new THREE.Mesh(G.cyl(0.13, 0.16, 0.18, 8), mat(C.steel_dark)));
    const gBarrel = new THREE.Mesh(G.cyl(0.03, 0.045, 0.85, 6), mat(0x232a38));
    gBarrel.rotation.z = Math.PI / 2;
    gBarrel.position.x = 0.42;
    gunGrp.add(gBarrel);
    gunGrp.position.set(2.3, 0.58, 0);
    group.add(gunGrp);

    const mast = new THREE.Mesh(G.cyl(0.022, 0.03, 1.8, 6), mat(C.steel_dark));
    mast.position.set(0.3, 2.0, 0);
    group.add(mast);

    const hpad = new THREE.Mesh(G.cyl(0.35, 0.35, 0.03, 12), mat(0x4a5568, { r: 0.9 }));
    hpad.position.set(-2.3, 0.48, 0);
    group.add(hpad);

    group.scale.setScalar(0.88);
    return group;
  }

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
    e.scene.fog.density = FOG_DENSITY / k;      // névoa proporcional à distância
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
      e.ship.position.y = Math.sin(t * e.bobSpeed) * e.bobAmp;
    };
  }

  /* ── Vista da frota (formação) ──────────────────────────────── */
  function setupFleetView(e) {
    const formation = [
      { type: 'carrier',   pos: [0, 0, 0],      rot: 0 },
      { type: 'destroyer', pos: [-7, 0, -3],    rot: 0.15 },
      { type: 'destroyer', pos: [7, 0, -3],     rot: -0.15 },
      { type: 'submarine', pos: [-5, -0.5, 4],  rot: 0.1 },
      { type: 'frigate',   pos: [5, 0, 4],      rot: -0.1 },
    ];
    const ships = formation.map(({ type, pos, rot }) => {
      const s = buildShip(type);
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

  window.ShipEngine = { init, openModal, closeModal };
})();
