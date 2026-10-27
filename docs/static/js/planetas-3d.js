/* ═══════════════════════════════════════════════════════════════
   ROYAL NAVY — OS ERRANTES: planetas em 3D (Three.js r128)
   ───────────────────────────────────────────────────────────────
   Texturas geradas no próprio navegador (canvas + ruído), sem baixar
   imagens: a CSP do site continua só com 'self' e cdnjs. Um único
   renderer; só desenha enquanto o painel está visível. Arraste para girar.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const palco = document.getElementById('planetas-3d');
  const abas = document.getElementById('planetas-abas');
  if (!palco || !abas) return;
  const REDUZIDO = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = id => document.getElementById(id);

  /* ── Conteúdo histórico ─────────────────────────────────────── */
  const DADOS = [
    { id: 'mercurio', nome: 'Mercúrio', s: '☿', apelido: 'O mensageiro, sempre colado ao Sol',
      desde: 'Antiguidade: registrado pelos babilônios e por todos os povos que olhavam o céu.',
      nav: 'Não é usado: fica sempre perto do Sol e quase nunca sobe o bastante no céu escuro para uma boa medida.',
      hist: 'Por aparecer ora antes do nascer do Sol, ora depois do pôr do Sol, os gregos chegaram a tratá-lo como dois astros diferentes antes de perceber que era um só. É o mais rápido dos errantes: dá a volta ao Sol em 88 dias.' },
    { id: 'venus', nome: 'Vênus', s: '♀', apelido: 'Estrela-d’Alva, estrela da tarde',
      desde: 'Antiguidade: o astro mais brilhante depois do Sol e da Lua.',
      nav: 'Um dos quatro planetas do Nautical Almanac. Às vezes dá para medi-lo até com o Sol acima do horizonte.',
      hist: 'Em 1769 a Royal Navy mandou o tenente James Cook, no HMS Endeavour, ao Taiti para observar Vênus passando diante do Sol (3 de junho). Medido de pontos distantes da Terra, o trânsito servia para calcular a distância até o Sol. Escolha essa data na carta celeste e veja Vênus sobre o Sol.' },
    { id: 'marte', nome: 'Marte', s: '♂', apelido: 'O planeta vermelho',
      desde: 'Antiguidade: o seu “passo para trás” no céu (movimento retrógrado) intrigou astrônomos por séculos.',
      nav: 'Um dos quatro planetas do Nautical Almanac.',
      hist: 'Foi com as observações de Marte feitas por Tycho Brahe que Johannes Kepler descobriu, em 1609, que os planetas andam em elipses e não em círculos. São essas mesmas leis que este site usa para calcular onde cada planeta estava em cada data.' },
    { id: 'jupiter', nome: 'Júpiter', s: '♃', apelido: 'O gigante e o seu relógio de luas',
      desde: 'Antiguidade. Em 1610, Galileu viu pela luneta as quatro grandes luas.',
      nav: 'Um dos quatro planetas do Nautical Almanac.',
      hist: 'Em 1612 Galileu propôs usar os eclipses das luas de Júpiter como um relógio celeste para achar a longitude. Em terra funcionou e corrigiu os mapas da Europa; no convés de um navio jogando, apontar uma luneta para uma lua minúscula era quase impossível. Por isso o problema só foi resolvido no mar com o cronômetro e as distâncias lunares.' },
    { id: 'saturno', nome: 'Saturno', s: '♄', apelido: 'O mais distante dos errantes antigos',
      desde: 'Antiguidade: o limite do Sistema Solar conhecido até 1781.',
      nav: 'Um dos quatro planetas do Nautical Almanac.',
      hist: 'Em 1610 Galileu viu “orelhas” ao lado do planeta; em 1659 Christiaan Huygens explicou que eram um anel fino que não toca o planeta. Para os navegadores, Saturno era só mais um ponto amarelado e firme entre as estrelas.' },
    { id: 'urano', nome: 'Urano', s: '♅', apelido: 'A “Estrela de Jorge”',
      desde: '13 de março de 1781, por William Herschel, em Bath, na Inglaterra.',
      nav: 'Não é usado: fica no limite do que se vê a olho nu.',
      hist: 'Herschel achou que tinha encontrado um cometa. Era o primeiro planeta descoberto na história, e ele o batizou de Georgium Sidus em homenagem ao rei Jorge III; o nome Urano só se firmou no século XIX. Gira deitado, com o eixo inclinado em quase 98°.' },
    { id: 'netuno', nome: 'Netuno', s: '♆', apelido: 'Descoberto com a ponta da caneta',
      desde: 'Noite de 23 para 24 de setembro de 1846, por Johann Galle, em Berlim.',
      nav: 'Invisível a olho nu.',
      hist: 'Urbain Le Verrier calculou onde deveria estar um planeta que puxava Urano para fora do lugar. Galle apontou a luneta para o ponto previsto e o achou em menos de uma hora, a menos de 1° do cálculo: o triunfo da mesma mecânica celeste que os almanaques náuticos usavam.' }
  ];

  /* ── Ficha e abas (sempre funcionam, mesmo sem WebGL) ─────────── */
  let atual = 0, aoTrocar = null;
  DADOS.forEach((p, i) => {
    const b = document.createElement('button');
    b.type = 'button'; b.setAttribute('role', 'tab'); b.id = 'aba-' + p.id;
    const s = document.createElement('span'); s.className = 'simbolo'; s.textContent = p.s; s.setAttribute('aria-hidden', 'true');
    b.append(s, p.nome);
    b.addEventListener('click', () => escolher(i));
    b.addEventListener('keydown', ev => {
      if (ev.key === 'ArrowRight' || ev.key === 'ArrowLeft') {
        const j = (i + (ev.key === 'ArrowRight' ? 1 : DADOS.length - 1)) % DADOS.length;
        escolher(j); abas.children[j].focus(); ev.preventDefault();
      }
    });
    abas.appendChild(b);
  });
  function escolher(i) {
    atual = i;
    const p = DADOS[i];
    [...abas.children].forEach((b, k) => { b.setAttribute('aria-selected', String(k === i)); b.tabIndex = k === i ? 0 : -1; });
    $('planeta-nome').textContent = `${p.s} ${p.nome}`;
    $('planeta-apelido').textContent = p.apelido;
    $('planeta-desde').textContent = p.desde;
    $('planeta-nav').textContent = p.nav;
    $('planeta-historia').textContent = p.hist;
    if (aoTrocar) aoTrocar(p.id);
  }
  escolher(3);   // começa por Júpiter

  /* ── 3D ──────────────────────────────────────────────────────── */
  function iniciar3D() {
    const T = window.THREE;
    let renderer;
    try { renderer = new T.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' }); }
    catch (e) { palco.classList.add('errantes__palco--sem3d'); return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.outputEncoding = T.sRGBEncoding;
    palco.appendChild(renderer.domElement);
    const cena = new T.Scene();
    const cam = new T.PerspectiveCamera(32, 1, 0.1, 100);
    cam.position.set(0, 0.4, 7.2);
    cena.add(new T.AmbientLight(0x404a66, 0.55));
    const sol = new T.DirectionalLight(0xfff3dd, 1.35); sol.position.set(-5, 2.5, 4); cena.add(sol);

    /* fundo de estrelas (semente fixa) */
    let semente = 11; const rnd = () => (semente = (semente * 16807) % 2147483647) / 2147483647;
    const pos = new Float32Array(900 * 3);
    for (let i = 0; i < 900; i++) {
      const u = rnd() * 2 - 1, t = rnd() * Math.PI * 2, r = 30;
      pos[i * 3] = Math.sqrt(1 - u * u) * Math.cos(t) * r; pos[i * 3 + 1] = u * r; pos[i * 3 + 2] = Math.sqrt(1 - u * u) * Math.sin(t) * r;
    }
    const gEst = new T.BufferGeometry(); gEst.setAttribute('position', new T.BufferAttribute(pos, 3));
    cena.add(new T.Points(gEst, new T.PointsMaterial({ color: 0xcfd8ff, size: 0.06, sizeAttenuation: true, transparent: true, opacity: 0.85 })));

    /* ruído de valor suave (fBm) para as texturas */
    const perm = new Uint8Array(512); for (let i = 0; i < 256; i++) perm[i] = i;
    for (let i = 255; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [perm[i], perm[j]] = [perm[j], perm[i]]; }
    for (let i = 0; i < 256; i++) perm[i + 256] = perm[i];
    const fade = t => t * t * (3 - 2 * t);
    function ruido(x, y) {
      const xi = Math.floor(x) & 255, yi = Math.floor(y) & 255, xf = x - Math.floor(x), yf = y - Math.floor(y);
      const v = (a, b) => perm[perm[a] + b] / 255;
      const u = fade(xf), w = fade(yf);
      return (v(xi, yi) * (1 - u) + v(xi + 1, yi) * u) * (1 - w) + (v(xi, yi + 1) * (1 - u) + v(xi + 1, yi + 1) * u) * w;
    }
    const fbm = (x, y, o = 5) => { let s = 0, a = 0.5, f = 1; for (let i = 0; i < o; i++) { s += a * ruido(x * f, y * f); a *= 0.5; f *= 2.03; } return s; };
    const mistura = (c1, c2, t) => c1.map((c, i) => c + (c2[i] - c) * t);

    /* Gera a textura equiretangular de cada planeta */
    function textura(id) {
      const W = 512, H = 256, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
      const ctx = cv.getContext('2d'), img = ctx.createImageData(W, H), d = img.data;
      const faixas = (paleta, turb, freq) => (x, y) => {
        const v = y / H, n = fbm(x / W * 6, v * 8) - 0.5;
        const t = (Math.sin((v + n * turb) * Math.PI * freq) + 1) / 2;
        const idx = Math.min(paleta.length - 2, Math.floor(t * (paleta.length - 1)));
        return mistura(paleta[idx], paleta[idx + 1], t * (paleta.length - 1) - idx);
      };
      const f = {
        mercurio: (x, y) => { const n = fbm(x / W * 10, y / H * 5, 6); const c = 105 + n * 120; return [c, c * 0.96, c * 0.9]; },
        venus: (x, y) => { const n = fbm(x / W * 4 + fbm(x / W * 3, y / H * 3) * 2, y / H * 3, 5); return mistura([214, 178, 112], [255, 240, 205], n); },
        marte: (x, y) => {
          const v = y / H, n = fbm(x / W * 7, v * 4, 6), m = fbm(x / W * 3 + 9, v * 2 + 4, 4);
          let c = mistura([150, 62, 30], [222, 120, 70], n);
          if (m > 0.58) c = mistura(c, [92, 46, 30], (m - 0.58) * 3);
          if (v < 0.07 || v > 0.94) c = [246, 244, 240];
          return c;
        },
        jupiter: (x, y) => {
          let c = faixas([[160, 110, 72], [232, 210, 176], [196, 140, 92], [244, 230, 204], [178, 120, 80]], 0.06, 9)(x, y);
          const dx = ((((x % W) + W) % W) / W - 0.68) * 2.2, dy = (y / H - 0.62) * 6;    // a Grande Mancha Vermelha
          const r = dx * dx + dy * dy;
          if (r < 1) c = mistura(c, [186, 82, 52], (1 - r) * 0.85);
          return c;
        },
        saturno: faixas([[196, 170, 118], [236, 220, 170], [214, 190, 136], [240, 228, 186]], 0.03, 7),
        urano: (x, y) => { const v = y / H, n = fbm(x / W * 3, v * 6, 3); return mistura([150, 214, 222], [196, 240, 244], n * 0.6 + (1 - Math.abs(v - 0.5)) * 0.2); },
        netuno: (x, y) => {
          const v = y / H; let c = faixas([[40, 70, 170], [70, 110, 220], [52, 86, 196], [96, 140, 236]], 0.08, 6)(x, y);
          const dx = ((((x % W) + W) % W) / W - 0.3) * 3, dy = (v - 0.4) * 9, r = dx * dx + dy * dy;
          if (r < 1) c = mistura(c, [22, 34, 96], (1 - r) * 0.8);
          return c;
        }
      }[id];
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        // textura sem emenda: mistura o ruído com a sua cópia deslocada de uma volta inteira
        const t = x / W, c1 = f(x, y), c2 = f(x - W, y);
        const c = [c1[0] * (1 - t) + c2[0] * t, c1[1] * (1 - t) + c2[1] * t, c1[2] * (1 - t) + c2[2] * t], i = (y * W + x) * 4;
        d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255;
      }
      if (id === 'mercurio') {                                          // crateras
        ctx.putImageData(img, 0, 0);
        for (let k = 0; k < 140; k++) {
          const x = rnd() * W, y = H * 0.1 + rnd() * H * 0.8, r = 1 + rnd() * rnd() * 14;
          ctx.fillStyle = 'rgba(40,36,32,0.35)'; ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.9, 0, 0, 7); ctx.fill();
          ctx.strokeStyle = 'rgba(230,224,214,0.35)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x - r * 0.2, y - r * 0.2, r, 3.4, 5.6); ctx.stroke();
        }
      } else ctx.putImageData(img, 0, 0);
      const t = new T.CanvasTexture(cv); t.encoding = T.sRGBEncoding; t.anisotropy = 4;
      return t;
    }

    function texturaAnel(tons) {
      const cv = document.createElement('canvas'); cv.width = 512; cv.height = 8;
      const ctx = cv.getContext('2d');
      for (let x = 0; x < 512; x++) {
        const v = x / 511, n = ruido(v * 60, 0.5);
        let a = (0.25 + 0.75 * n) * (v > 0.04 ? 1 : 0) * (v < 0.97 ? 1 : 0);
        if (v > 0.58 && v < 0.63) a *= 0.12;                             // a Divisão de Cassini
        ctx.fillStyle = `rgba(${tons[0]},${tons[1]},${tons[2]},${a.toFixed(3)})`; ctx.fillRect(x, 0, 1, 8);
      }
      const t = new T.CanvasTexture(cv); t.encoding = T.sRGBEncoding; return t;
    }

    /* halo de atmosfera: sprite com degradê radial, mistura aditiva */
    function halo(cor, escala) {
      const cv = document.createElement('canvas'); cv.width = cv.height = 128;
      const ctx = cv.getContext('2d'), g = ctx.createRadialGradient(64, 64, 34, 64, 64, 64);
      g.addColorStop(0, `rgba(${cor},0.55)`); g.addColorStop(0.35, `rgba(${cor},0.18)`); g.addColorStop(1, `rgba(${cor},0)`);
      ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
      const sp = new T.Sprite(new T.SpriteMaterial({ map: new T.CanvasTexture(cv), blending: T.AdditiveBlending, depthWrite: false, transparent: true }));
      sp.scale.set(escala, escala, 1);
      sp.position.z = -2.2;                       // atrás do planeta: só a borda do halo aparece
      return sp;
    }

    const INCLINACAO = { mercurio: 0.03, venus: 3.1, marte: 25.2, jupiter: 3.1, saturno: 26.7, urano: 97.8, netuno: 28.3 };
    const ATMOS = { venus: '255,230,170', marte: '255,150,110', jupiter: '255,220,180', saturno: '255,230,170', urano: '170,240,255', netuno: '120,160,255' };
    const cache = {};
    function modelo(id) {
      if (cache[id]) return cache[id];
      const grupo = new T.Group();
      const eixo = new T.Group(); eixo.rotation.z = -INCLINACAO[id] * Math.PI / 180;
      const esfera = new T.Mesh(new T.SphereGeometry(1.35, 72, 48), new T.MeshStandardMaterial({ map: textura(id), roughness: 0.92, metalness: 0 }));
      eixo.add(esfera);
      if (id === 'saturno' || id === 'urano') {
        const ri = id === 'saturno' ? 1.75 : 1.9, re = id === 'saturno' ? 3.05 : 2.3;
        const g = new T.RingGeometry(ri, re, 128, 1);
        const p = g.attributes.position, uv = g.attributes.uv, v = new T.Vector3();
        for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); uv.setXY(i, (v.length() - ri) / (re - ri), 0.5); }
        const anel = new T.Mesh(g, new T.MeshBasicMaterial({ map: texturaAnel(id === 'saturno' ? [232, 214, 170] : [190, 230, 236]), side: T.DoubleSide, transparent: true, depthWrite: false, opacity: id === 'urano' ? 0.35 : 1 }));
        anel.rotation.x = Math.PI / 2;
        eixo.add(anel);
      }
      grupo.add(eixo);
      grupo.userData.halo = ATMOS[id] ? halo(ATMOS[id], 3.9) : null;   // fica na cena, fora do grupo que gira
      grupo.userData.esfera = esfera; grupo.userData.eixo = eixo;
      cache[id] = grupo;
      return grupo;
    }

    let ativo = null;
    aoTrocar = id => {
      if (ativo) { cena.remove(ativo); if (ativo.userData.halo) cena.remove(ativo.userData.halo); }
      ativo = modelo(id); ativo.rotation.set(0.25, 0, 0); cena.add(ativo);
      cam.position.z = id === 'saturno' ? 11.5 : id === 'urano' ? 8.2 : 7.2;   // os anéis de Saturno precisam de mais espaço
      if (ativo.userData.halo) cena.add(ativo.userData.halo);
      desenhar();
    };

    /* arrastar para girar */
    let arrasto = null, girY = 0, girX = 0.25;
    palco.addEventListener('pointerdown', ev => { arrasto = [ev.clientX, ev.clientY, girY, girX]; palco.setPointerCapture(ev.pointerId); });
    palco.addEventListener('pointermove', ev => {
      if (!arrasto) return;
      girY = arrasto[2] + (ev.clientX - arrasto[0]) * 0.01;
      girX = Math.max(-1.2, Math.min(1.2, arrasto[3] + (ev.clientY - arrasto[1]) * 0.01));
      desenhar();
    });
    const soltar = () => { arrasto = null; };
    palco.addEventListener('pointerup', soltar); palco.addEventListener('pointercancel', soltar);

    function tamanho() {
      const w = palco.clientWidth, h = palco.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); desenhar();
    }
    new ResizeObserver(tamanho).observe(palco);

    function desenhar() {
      if (ativo) { ativo.rotation.y = girY; ativo.rotation.x = girX; }
      renderer.render(cena, cam);
    }
    let id = 0, visivel = false, ultimo = 0;
    const laco = t => {
      const dt = Math.min(0.1, (t - (ultimo || t)) / 1000); ultimo = t;
      if (ativo && !arrasto) ativo.userData.esfera.rotation.y += dt * 0.25;
      desenhar();
      id = requestAnimationFrame(laco);
    };
    const ligar = () => { if (!id && visivel && !document.hidden && !REDUZIDO) { ultimo = 0; id = requestAnimationFrame(laco); } };
    const desligar = () => { cancelAnimationFrame(id); id = 0; };
    new IntersectionObserver(es => { visivel = es[0].isIntersecting; visivel ? ligar() : desligar(); }).observe(palco);
    document.addEventListener('visibilitychange', () => (document.hidden ? desligar() : ligar()));
    aoTrocar(DADOS[atual].id);
    tamanho();
  }

  /* O Three.js vem do cdnjs com defer; espera ele estar pronto */
  if (window.THREE) iniciar3D();
  else window.addEventListener('load', () => (window.THREE ? iniciar3D() : palco.classList.add('errantes__palco--sem3d')));
})();
