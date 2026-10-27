/* ═══════════════════════════════════════════════════════════════
   ROYAL NAVY — NAVEGAÇÃO PELAS ESTRELAS (/navegacao)
   ───────────────────────────────────────────────────────────────
   • Céu do topo: o céu real de Greenwich agora, acelerado, girando em
     torno da Polar com rastros (como uma foto de longa exposição).
   • Era I  — bússola estelar havaiana (SVG) com Hōkūleʻa (Arcturus) nascendo.
   • Era II — quadrante: alinhar a alidade com a Polar dá a latitude.
   • Era III — cronômetro: diferença de horas = longitude; e o efeito do erro.
   • Carta celeste: projeção estereográfica do céu de noites históricas.
   • Planetário mecânico (orrery) com posições reais de 1500 a 2100.
   Cálculos em astro.js (RNAstro). Cada canvas só anima enquanto visível.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const A = window.RNAstro;
  if (!A) return;
  const REDUZIDO = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const DPR = () => Math.min(window.devicePixelRatio || 1, 1.5);
  const escuro = () => document.documentElement.getAttribute('data-theme') === 'dark';
  const $ = id => document.getElementById(id);
  const fmt = (n, d = 1) => n.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
  const SCRIPT = document.currentScript && document.currentScript.src;
  /* Monta texto com **negrito** e _itálico_ usando só nós de texto (sem innerHTML) */
  function textoRico(el, txt) {
    el.textContent = '';
    for (const parte of txt.split(/(\*\*[^*]+\*\*|_[^_]+_)/)) {
      if (!parte) continue;
      if (parte.startsWith('**')) { const b = document.createElement('strong'); b.textContent = parte.slice(2, -2); el.append(b); }
      else if (parte.startsWith('_') && parte.endsWith('_')) { const i = document.createElement('em'); i.textContent = parte.slice(1, -1); el.append(i); }
      else el.append(parte);
    }
  }
  const URL_CEU = new URL('../data/ceu.json', SCRIPT || location.href).href;

  /* Liga um laço de animação só enquanto o elemento está na tela e a aba visível */
  function animarQuandoVisivel(el, quadro) {
    let visivel = false, id = 0, ultimo = 0;
    const laco = t => {
      const dt = Math.min(0.1, (t - (ultimo || t)) / 1000);
      ultimo = t;
      quadro(dt, t);
      id = requestAnimationFrame(laco);
    };
    const ligar = () => { if (!id && visivel && !document.hidden) { ultimo = 0; id = requestAnimationFrame(laco); } };
    const desligar = () => { if (id) { cancelAnimationFrame(id); id = 0; } };
    new IntersectionObserver(es => { visivel = es[0].isIntersecting; visivel ? ligar() : desligar(); }, { rootMargin: '80px' }).observe(el);
    document.addEventListener('visibilitychange', () => (document.hidden ? desligar() : ligar()));
  }

  /* Ajusta o tamanho real do canvas ao tamanho exibido */
  function encaixar(canvas, aoMudar) {
    const r = () => {
      const w = canvas.clientWidth, h = canvas.clientHeight, d = DPR();
      if (!w || !h) return;
      canvas.width = Math.round(w * d); canvas.height = Math.round(h * d);
      aoMudar(w, h, d);
    };
    new ResizeObserver(r).observe(canvas);   // o observador já dispara a primeira medida, depois do resto do código
  }

  /* ═══════════════════════ DADOS DO CÉU ═══════════════════════ */
  let CEU = null;
  const ceuPronto = fetch(URL_CEU, { credentials: 'same-origin' })
    .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(d => { CEU = d; return d; });

  /* Precessão em cache por ano (estrelas J2000 → data) */
  const cachePrec = new Map();
  function estrelasNaData(J) {
    const ano = Math.round((J - 2451545) / 365.25);
    if (cachePrec.has(ano)) return cachePrec.get(ano);
    const Jc = 2451545 + ano * 365.25;
    const est = CEU.estrelas.map(s => { const p = A.precessa(s[0], s[1], Jc); return [p[0], p[1], s[2], s[3]]; });
    const nav = CEU.navegacao.map(s => { const p = A.precessa(s[3], s[4], Jc); return { n: s[0], nome: s[1], bayer: s[2], ra: p[0], dec: p[1], mag: s[5], bv: s[6] }; });
    const linhas = {};
    for (const k in CEU.linhas) linhas[k] = CEU.linhas[k].map(seg => seg.map(p => A.precessa(p[0], p[1], Jc)));
    const r = { est, nav, linhas };
    if (cachePrec.size > 6) cachePrec.clear();
    cachePrec.set(ano, r);
    return r;
  }

  const PLANETAS = [
    { id: 'mercurio', nome: 'Mercúrio', s: '☿', cor: '#c9c2b8' },
    { id: 'venus', nome: 'Vênus', s: '♀', cor: '#fff1c4' },
    { id: 'marte', nome: 'Marte', s: '♂', cor: '#ff8a5c' },
    { id: 'jupiter', nome: 'Júpiter', s: '♃', cor: '#f3d9b1' },
    { id: 'saturno', nome: 'Saturno', s: '♄', cor: '#f0dc9a' },
    { id: 'urano', nome: 'Urano', s: '♅', cor: '#a8e6ef' },
    { id: 'netuno', nome: 'Netuno', s: '♆', cor: '#8fa8ff' }
  ];

  /* ═══════════════════════ CÉU DO TOPO ═══════════════════════ */
  (function heroCeu() {
    const cv = $('ceu-hero'), legenda = $('ceu-hero-legenda');
    if (!cv) return;
    const ctx = cv.getContext('2d');
    const LAT = 51.4769, LON = -0.0005;            // Observatório Real de Greenwich
    const ACEL = REDUZIDO ? 0 : 240;                // 240× : o céu dá uma volta em 6 minutos
    /* sempre um céu de noite: se o Sol estiver acima de −12° (fim do crepúsculo náutico), pula para a próxima noite */
    const alturaSol = t => { const J = A.jd(new Date(t)), g = A.geocentrico('sol', J), p = A.precessa(g[0], g[1], J); return A.horizontais(p[0], p[1], LAT, A.norm(A.gmst(J) + LON))[0]; };
    const proximaNoite = t => { for (let k = 0; k < 200 && alturaSol(t) > -12; k++) t += 10 * 60000; return t; };
    let W = 0, H = 0, d = 1, tSim = proximaNoite(Date.now()), cx = 0, cy = 0, R = 0, conferido = 0;
    let tema = escuro();

    encaixar(cv, (w, h, dd) => {
      W = w; H = h; d = dd;
      cx = W * (W > 760 ? 0.72 : 0.5); cy = H * 0.3; R = Math.max(W, H) * 0.95;
      mar = faixa ? faixa.offsetTop - 1 : H * 0.86;
      ctx.setTransform(d, 0, 0, d, 0, 0);
      ctx.clearRect(0, 0, W, H);
    });

    /* projeção estereográfica centrada na Polar (altura = latitude, azimute Norte) */
    const P = A.horizontais(0, 90, LAT, 0);           // direção do polo
    function projeta(alt, az) {
      const a0 = LAT * A.RAD;
      const x = Math.cos(alt * A.RAD) * Math.sin(az * A.RAD), y = Math.cos(alt * A.RAD) * Math.cos(az * A.RAD), z = Math.sin(alt * A.RAD);
      // gira o sistema para o centro (az 0, alt LAT) ficar no eixo de visão
      const yv = y * Math.cos(a0) + z * Math.sin(a0), zv = -y * Math.sin(a0) + z * Math.cos(a0);
      const k = 1 / (1 + yv);
      return [cx - x * k * R * 0.5, cy - zv * k * R * 0.5, yv];
    }
    void P;

    let mar = 0;                                     // altura do mar = linha da faixa de números
    const faixa = document.querySelector('.nav-hero__numeros');
    function navio(c) {                              // fragata de três mastros em silhueta
      const y0 = mar || H * 0.86;
      c.fillStyle = tema ? '#02050c' : '#0c1430';
      c.fillRect(0, y0, W, H - y0);
      c.strokeStyle = tema ? 'rgba(143,211,255,0.2)' : 'rgba(255,214,170,0.4)';
      c.lineWidth = 1; c.beginPath(); c.moveTo(0, y0 + 0.5); c.lineTo(W, y0 + 0.5); c.stroke();
      const s = Math.max(0.45, Math.min(0.9, W / 1500)), x0 = W * (W > 760 ? 0.86 : 0.8);
      const tinta = tema ? '#01030a' : '#0a0f22';
      c.save(); c.translate(x0, y0 + 2); c.scale(s, s);
      c.fillStyle = tinta; c.strokeStyle = tinta;
      // casco com tosado (sobe na proa e na popa)
      c.beginPath(); c.moveTo(-130, -22); c.quadraticCurveTo(0, -8, 120, -24); c.lineTo(104, 4); c.quadraticCurveTo(0, 12, -112, 4); c.closePath(); c.fill();
      c.fillRect(-130, -34, 22, 14);                 // castelo de popa
      // mastros com velas redondas (enfunadas) e gáveas
      const mastros = [[-62, 150], [4, 178], [64, 138]];
      c.lineWidth = 2.4;
      for (const [mx, mh] of mastros) {
        c.beginPath(); c.moveTo(mx, -16); c.lineTo(mx, -16 - mh); c.stroke();
        const panos = [[0.18, 0.36, 46], [0.40, 0.60, 40], [0.63, 0.80, 33], [0.83, 0.95, 24]];
        for (const [a0, a1, w] of panos) {
          const ya = -16 - mh * (1 - a0), yb = -16 - mh * (1 - a1);
          const wa = w, wb = w * 0.86;
          c.beginPath(); c.moveTo(mx - wa, ya); c.lineTo(mx + wa, ya);
          c.quadraticCurveTo(mx + wb + 6, (ya + yb) / 2, mx + wb, yb);
          c.quadraticCurveTo(mx, yb + 7, mx - wb, yb);
          c.quadraticCurveTo(mx - wb - 6, (ya + yb) / 2, mx - wa, ya); c.fill();
          c.lineWidth = 1.4; c.beginPath(); c.moveTo(mx - wa - 4, ya); c.lineTo(mx + wa + 4, ya); c.stroke(); c.lineWidth = 2.4;
        }
      }
      // gurupés e bujarronas
      c.lineWidth = 2; c.beginPath(); c.moveTo(116, -22); c.lineTo(190, -48); c.stroke();
      c.beginPath(); c.moveTo(186, -46); c.lineTo(70, -150); c.lineTo(112, -30); c.closePath(); c.fill();
      c.beginPath(); c.moveTo(160, -38); c.lineTo(68, -118); c.lineTo(96, -28); c.closePath(); c.globalAlpha = 0.85; c.fill(); c.globalAlpha = 1;
      // cordame
      c.lineWidth = 0.7; c.globalAlpha = 0.7;
      for (const [mx, mh] of mastros) { c.beginPath(); c.moveTo(mx, -16 - mh); c.lineTo(mx - 52, -18); c.moveTo(mx, -16 - mh); c.lineTo(mx + 46, -20); c.stroke(); }
      c.globalAlpha = 1;
      c.restore();
      c.fillStyle = tema ? 'rgba(255,215,106,0.9)' : 'rgba(255,224,170,0.95)';     // lanterna de popa
      c.beginPath(); c.arc(x0 - 128 * s, y0 - 36 * s, 2.2, 0, 7); c.fill();
    }

    function quadro(dt) {
      if (!CEU || !W) return;
      tSim += dt * 1000 * ACEL;
      if (tSim - conferido > 20 * 60000) { conferido = tSim; if (alturaSol(tSim) > -8) { tSim = proximaNoite(tSim + 6 * 3600000); conferido = tSim; ctx.clearRect(0, 0, W, H); } }
      const data = new Date(tSim), J = A.jd(data), lst = A.norm(A.gmst(J) + LON);
      const dados = estrelasNaData(J);
      // rastros: apaga um pouco do quadro anterior em vez de limpar tudo
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = ACEL ? 'rgba(0,0,0,0.09)' : 'rgba(0,0,0,1)';
      ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'source-over';
      const limite = tema ? 4.6 : 2.9;                // no crepúsculo só as mais brilhantes aparecem
      let n = 0;
      const pinta = (ra, dec, mag, bv, ouro, polar) => {
        if (mag > limite) return;
        const h = A.horizontais(ra, dec, LAT, lst);
        if (h[0] < -2) return;
        const p = projeta(h[0], h[1]);
        if (p[2] < -0.2 || p[0] < -10 || p[0] > W + 10 || p[1] < -10 || p[1] > (mar || H * 0.86) - 2) return;
        const r = Math.max(0.55, (limite + 0.6 - mag) * (ouro ? 0.62 : 0.5));
        const c = polar ? [143, 211, 255] : ouro ? [255, 215, 106] : A.corBV(bv);
        const extincao = Math.min(1, (h[0] + 2) / 12);       // estrelas baixas apagam junto ao horizonte
        ctx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},${(0.35 + 0.65 * Math.min(1, (limite - mag + 1) / 3)) * extincao})`;
        ctx.beginPath(); ctx.arc(p[0], p[1], r, 0, 6.2832); ctx.fill();
        n++;
      };
      for (const s of dados.est) pinta(s[0], s[1], s[2], s[3], false);
      for (const s of dados.nav) pinta(s.ra, s.dec, s.mag, s.bv, true, s.n === 0);
      navio(ctx);
      if (legenda && (!quadro.ultimaLegenda || performance.now() - quadro.ultimaLegenda > 900)) {
        quadro.ultimaLegenda = performance.now();
        const pol = dados.nav[0];
        const hp = A.horizontais(pol.ra, pol.dec, LAT, lst);
        legenda.textContent = `Céu real da noite sobre Greenwich · ${data.toLocaleString('pt-BR', { timeZone: 'UTC', dateStyle: 'short', timeStyle: 'short' })} UTC` +
          (ACEL ? ` (acelerado ${ACEL}×)` : '') + ` · a Polar está a ${fmt(hp[0])}° de altura, quase a latitude do observatório (51,5°) · ${n} estrelas`;
      }
    }

    document.addEventListener('rn:themechange', () => { tema = escuro(); ctx.clearRect(0, 0, W, H); });
    ceuPronto.then(() => (REDUZIDO ? quadro(0) : animarQuandoVisivel(cv, quadro))).catch(() => {
      if (legenda) legenda.textContent = 'Não foi possível carregar o catálogo de estrelas.';
    });
  })();

  /* ═══════════════════════ ERA I — BÚSSOLA ESTELAR ═══════════════════════ */
  (function rosaEstelar() {
    const svg = $('rosa-estelar'), leitura = $('rosa-leitura');
    if (!svg) return;
    const NS = 'http://www.w3.org/2000/svg';
    const el = (tag, at, pai) => { const e = document.createElementNS(NS, tag); for (const k in at) e.setAttribute(k, at[k]); (pai || svg).appendChild(e); return e; };
    const CASAS = [['Lā', 'Sol'], ['ʻĀina', 'Terra'], ['Noio', 'Andorinha-do-mar'], ['Manu', 'Pássaro'], ['Nālani', 'Os céus'], ['Nāleo', 'As vozes'], ['Haka', 'Vazio']];
    const QUAD = { 0: 'Koʻolau (NE, ventos alísios)', 1: 'Malanai (SE)', 2: 'Kona (SO)', 3: 'Hoʻolua (NO)' };
    const CARDEAIS = [['ʻĀkau', 'Norte (“direita”)', 0], ['Hikina', 'Leste (“chegar”: onde os astros nascem)', 90], ['Hema', 'Sul (“esquerda”)', 180], ['Komohana', 'Oeste (“entrar”: onde os astros se põem)', 270]];
    const R0 = 80, R1 = 182;
    const arco = (a0, a1, r0, r1) => {
      const p = (a, r) => [Math.sin(a * Math.PI / 180) * r, -Math.cos(a * Math.PI / 180) * r];
      const [x0, y0] = p(a0, r1), [x1, y1] = p(a1, r1), [x2, y2] = p(a1, r0), [x3, y3] = p(a0, r0);
      return `M${x0} ${y0}A${r1} ${r1} 0 0 1 ${x1} ${y1}L${x2} ${y2}A${r0} ${r0} 0 0 0 ${x3} ${y3}Z`;
    };
    const casas = [];
    for (let i = 0; i < 32; i++) {
      const centro = i * 11.25, a0 = centro - 5.625, a1 = centro + 5.625;
      let nome, sig;
      if (i % 8 === 0) { const c = CARDEAIS[i / 8]; nome = c[0]; sig = c[1]; }
      else {
        const q = Math.floor(i / 8), k = i % 8;                     // k = 1..7 a partir do cardeal
        const idx = (q % 2 === 0) ? 7 - k : k - 1;                  // Lā fica junto de Leste e Oeste
        nome = CASAS[idx][0];
        sig = `${CASAS[idx][1]} · quadrante ${QUAD[q]}`;
      }
      const p = el('path', { d: arco(a0, a1, R0, R1), class: 'rosa__casa', tabindex: '0', role: 'button', 'aria-label': `${nome}: ${sig}` });
      p.dataset.nome = nome; p.dataset.sig = sig;
      casas.push(p);
      el('line', { x1: Math.sin(a0 * Math.PI / 180) * R0, y1: -Math.cos(a0 * Math.PI / 180) * R0, x2: Math.sin(a0 * Math.PI / 180) * R1, y2: -Math.cos(a0 * Math.PI / 180) * R1, class: 'rosa__raio' });
      const rt = i % 8 === 0 ? 112 : 158;
      const t = el('text', { x: Math.sin(centro * Math.PI / 180) * rt, y: -Math.cos(centro * Math.PI / 180) * rt, class: i % 8 === 0 ? 'rosa__card' : 'rosa__texto' });
      t.textContent = nome;
    }
    el('circle', { r: R1, class: 'rosa__aro' }); el('circle', { r: R0, class: 'rosa__aro' }); el('circle', { r: 132, class: 'rosa__aro' });
    // Hōkūleʻa (Arcturus, dec +19,2°) vista do Havaí (lat 21,3°): trajetória acima do horizonte, de leste a oeste
    const LAT = 21.3, DEC = 19.18;
    const pontos = [];
    for (let H = -180; H <= 180; H += 2) {
      const h = A.horizontais(0, DEC, LAT, H);
      if (h[0] >= 0) { const r = (1 - h[0] / 90) * (R0 - 6); pontos.push([Math.sin(h[1] * Math.PI / 180) * r, -Math.cos(h[1] * Math.PI / 180) * r]); }
    }
    el('path', { d: 'M' + pontos.map(p => p.map(v => v.toFixed(1)).join(' ')).join('L'), class: 'rosa__trilha' });
    const canoa = el('path', { d: 'M-9 3 L9 3 L6 7 L-6 7 Z M0 3 L0 -10 L7 1 Z', class: 'rosa__canoa' });
    void canoa;
    const estrela = el('circle', { r: 5, class: 'rosa__estrela', cx: pontos[0][0], cy: pontos[0][1] });
    const nasc = A.horizontais(0, DEC, LAT, -90)[1];
    let ativa = null;
    const mostra = p => {
      if (ativa) ativa.classList.remove('ativa');
      ativa = p; p.classList.add('ativa');
      leitura.textContent = '';
      const b = document.createElement('strong'); b.textContent = p.dataset.nome;
      leitura.append('Casa ', b, ` — ${p.dataset.sig}.`);
    };
    casas.forEach(p => { p.addEventListener('pointerenter', () => mostra(p)); p.addEventListener('focus', () => mostra(p)); p.addEventListener('click', () => mostra(p)); });
    const notaHokulea = () => {
      leitura.textContent = '';
      const b = document.createElement('strong'); b.textContent = 'Hōkūleʻa';
      leitura.append(b, ` (Arcturus), a “estrela da alegria” que dá nome à canoa, passa pelo zênite do Havaí: nasce na casa ʻĀina, a ${Math.round(nasc)}° do norte, e se põe na casa ʻĀina do outro lado.`);
    };
    notaHokulea();
    svg.addEventListener('pointerleave', () => { if (ativa) ativa.classList.remove('ativa'); ativa = null; notaHokulea(); });
    let f = 0;
    const passo = dt => { f = (f + dt * 9) % pontos.length; const p = pontos[Math.floor(f)]; estrela.setAttribute('cx', p[0]); estrela.setAttribute('cy', p[1]); };
    if (!REDUZIDO) animarQuandoVisivel(svg, passo);
  })();

  /* ═══════════════════════ ERA II — QUADRANTE ═══════════════════════ */
  (function quadrante() {
    const cv = $('quadrante'), sel = $('quadrante-porto'), ali = $('quadrante-alidade'), out = $('quadrante-leitura');
    if (!cv) return;
    const ctx = cv.getContext('2d');
    let W = 0, H = 0;
    encaixar(cv, (w, h, d) => { W = w; H = h; ctx.setTransform(d, 0, 0, d, 0, 0); desenha(); });
    // A Polar não está exatamente no polo (≈0,6° em 2026); os pilotos corrigiam isso com o “Regimento do Norte”
    const alturaPolar = lat => lat;
    function desenha() {
      if (!W) return;
      const lat = parseFloat(sel.value), a = parseFloat(ali.value), dark = escuro();
      const alvo = alturaPolar(lat);
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, dark ? '#030814' : '#17204a'); g.addColorStop(0.78, dark ? '#0b1a34' : '#4a4f86'); g.addColorStop(0.8, '#0a1224'); g.addColorStop(1, '#050913');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      const hy = H * 0.8, ox = W * 0.18, oy = hy - 6;
      // estrelas de fundo (fixas, semente determinística)
      let s = 7; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      for (let i = 0; i < 70; i++) { ctx.beginPath(); ctx.arc(rnd() * W, rnd() * hy * 0.95, rnd() * 1.1 + 0.2, 0, 7); ctx.fill(); }
      ctx.strokeStyle = 'rgba(160,190,230,0.35)'; ctx.beginPath(); ctx.moveTo(0, hy); ctx.lineTo(W, hy); ctx.stroke();
      const L = Math.min(W * 0.75, (hy - 30) / Math.max(0.15, Math.sin(Math.max(alvo, 8) * Math.PI / 180)));
      const visivel = alvo > 0;
      if (visivel) {
        const px = ox + Math.cos(alvo * Math.PI / 180) * L, py = oy - Math.sin(alvo * Math.PI / 180) * L;
        const gl = ctx.createRadialGradient(px, py, 0, px, py, 16); gl.addColorStop(0, 'rgba(143,211,255,0.9)'); gl.addColorStop(1, 'rgba(143,211,255,0)');
        ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(px, py, 16, 0, 7); ctx.fill();
        ctx.fillStyle = '#eaf6ff'; ctx.beginPath(); ctx.arc(px, py, 3.2, 0, 7); ctx.fill();
        ctx.fillStyle = '#cfe8ff'; ctx.font = '600 12px Rajdhani, sans-serif'; ctx.fillText('POLAR', px + 10, py - 8);
      }
      // linha de mira da alidade
      ctx.strokeStyle = 'rgba(255,215,106,0.75)'; ctx.setLineDash([5, 5]); ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(ox + Math.cos(a * Math.PI / 180) * W, oy - Math.sin(a * Math.PI / 180) * W); ctx.stroke(); ctx.setLineDash([]);
      // quadrante de latão
      const r = Math.min(110, H * 0.42);
      ctx.save(); ctx.translate(ox, oy); ctx.rotate(-a * Math.PI / 180);
      ctx.fillStyle = 'rgba(184,134,43,0.22)'; ctx.strokeStyle = '#e2bd6a'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(r, 0); ctx.arc(0, 0, r, 0, Math.PI / 2); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.lineWidth = 1;
      for (let g2 = 0; g2 <= 90; g2 += 5) {
        const an = g2 * Math.PI / 180, t = g2 % 10 === 0 ? 10 : 5;
        ctx.beginPath(); ctx.moveTo(Math.cos(an) * r, Math.sin(an) * r); ctx.lineTo(Math.cos(an) * (r - t), Math.sin(an) * (r - t)); ctx.stroke();
      }
      ctx.restore();
      // fio de prumo: sempre vertical; marca no arco o ângulo de altura
      ctx.strokeStyle = '#f4f1e8'; ctx.lineWidth = 1;
      const pa = (90 - a) * Math.PI / 180;
      ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(ox, oy + 0.1); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(ox + Math.sin(0) * r, oy + r); ctx.stroke();
      ctx.fillStyle = '#e2bd6a'; ctx.beginPath(); ctx.arc(ox, oy + r, 3.5, 0, 7); ctx.fill();
      void pa;
      ctx.fillStyle = '#e2bd6a'; ctx.font = '700 13px Cinzel, serif';
      ctx.fillText(`${fmt(a)}°`, ox + 14, oy + r + 4);
      // leitura
      out.textContent = '';
      if (!visivel) {
        out.append('Abaixo do equador a Polar fica sob o horizonte: aqui os pilotos passaram a medir o ', strong('Cruzeiro do Sul'), ' e o Sol do meio-dia.');
      } else if (Math.abs(a - alvo) < 0.6) {
        out.append('Alinhado! A Polar está a ', strong(`${fmt(a)}°`), ' de altura: a latitude é ', strong(`${fmt(Math.abs(lat))}° ${lat >= 0 ? 'N' : 'S'}`), '.');
      } else {
        out.append(`A mira está ${a < alvo ? 'abaixo' : 'acima'} da Polar. Continue movendo a alidade.`);
      }
    }
    function strong(t) { const b = document.createElement('strong'); b.textContent = t; return b; }
    sel.addEventListener('change', desenha); ali.addEventListener('input', desenha);
    document.addEventListener('rn:themechange', desenha);
  })();

  /* ═══════════════════════ ERA III — CRONÔMETRO ═══════════════════════ */
  (function cronometro() {
    const cv = $('cronometro'), lon = $('cronometro-long'), erro = $('cronometro-erro'), out = $('cronometro-leitura');
    if (!cv) return;
    const ctx = cv.getContext('2d');
    let W = 0, H = 0;
    encaixar(cv, (w, h, d) => { W = w; H = h; ctx.setTransform(d, 0, 0, d, 0, 0); desenha(); });
    function relogio(x, y, r, horas, titulo, sub, cor) {
      const dark = escuro();
      const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
      g.addColorStop(0, dark ? '#20314d' : '#fffaf0'); g.addColorStop(1, dark ? '#0b1526' : '#efe3c3');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
      ctx.lineWidth = 5; ctx.strokeStyle = '#b8862b'; ctx.stroke();
      ctx.lineWidth = 1.5; ctx.strokeStyle = '#e2bd6a'; ctx.beginPath(); ctx.arc(x, y, r - 6, 0, 7); ctx.stroke();
      ctx.fillStyle = dark ? '#e6edf6' : '#2a2416'; ctx.font = `600 ${Math.round(r * 0.16)}px Cinzel, serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const ROM = ['XII', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
      for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; ctx.fillText(ROM[i], x + Math.sin(a) * r * 0.74, y - Math.cos(a) * r * 0.74); }
      const h = ((horas % 12) + 12) % 12, m = (horas * 60) % 60;
      const ponteiro = (ang, comp, larg, c) => { ctx.strokeStyle = c; ctx.lineWidth = larg; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.sin(ang) * comp, y - Math.cos(ang) * comp); ctx.stroke(); };
      ponteiro(h / 12 * Math.PI * 2, r * 0.48, 4, dark ? '#e6edf6' : '#2a2416');
      ponteiro(((m + 60) % 60) / 60 * Math.PI * 2, r * 0.66, 2.5, cor);
      ctx.fillStyle = '#b8862b'; ctx.beginPath(); ctx.arc(x, y, 4, 0, 7); ctx.fill();
      ctx.fillStyle = dark ? '#e2bd6a' : '#7a5615'; ctx.font = `700 ${Math.max(11, Math.round(r * 0.15))}px Rajdhani, sans-serif`;
      ctx.fillText(titulo, x, y + r + 18);
      ctx.fillStyle = dark ? '#a8b6c8' : '#5a5446'; ctx.font = `500 ${Math.max(11, Math.round(r * 0.14))}px Inter, sans-serif`;
      ctx.fillText(sub, x, y + r + 36);
    }
    const hhmm = h => { const t = ((h % 24) + 24) % 24, hh = Math.floor(t), mm = Math.round((t - hh) * 60); return `${String(hh + (mm === 60 ? 1 : 0)).padStart(2, '0')}:${String(mm % 60).padStart(2, '0')}`; };
    function desenha() {
      if (!W) return;
      const L = parseFloat(lon.value), e = parseFloat(erro.value);
      ctx.clearRect(0, 0, W, H);
      const r = Math.min(H * 0.33, W * 0.17), y = H * 0.4;
      const gmt = 12 - L / 15;                 // meio-dia local → hora de Greenwich
      const dias = 40, atraso = e * dias / 3600;  // horas que o relógio ruim perdeu
      relogio(W * 0.25, y, r, 12, 'HORA LOCAL', 'meio-dia: Sol no meridiano', '#f2593a');
      relogio(W * 0.75, y, r, gmt - atraso, 'CRONÔMETRO', `hora de Greenwich${e ? ' (com erro)' : ''}`, '#0a8795');
      const lido = (12 - (gmt - atraso)) * 15, errMin = Math.abs(lido - L) * 60;
      out.textContent = '';
      const dif = gmt - 12;
      out.append(`Diferença: ${hhmm(Math.abs(dif))} ${dif > 0 ? 'atrás de' : 'à frente de'} Greenwich → longitude `,
        b(`${fmt(Math.abs(L), 0)}° ${L < 0 ? 'O' : L > 0 ? 'L' : ''}`), '.');
      if (e) {
        out.append(` Com um relógio que erra ${e} s por dia, depois de ${dias} dias de viagem ele está ${Math.round(e * dias / 60)} min errado: a longitude sai errada em `,
          b(`${fmt(errMin / 60)}°`), ` — cerca de ${Math.round(errMin * Math.cos(0))} milhas náuticas no equador.`);
      } else {
        out.append(' O H4 de Harrison errou só alguns segundos em toda a travessia até a Jamaica.');
      }
    }
    function b(t) { const s = document.createElement('strong'); s.textContent = t; return s; }
    lon.addEventListener('input', desenha); erro.addEventListener('input', desenha);
    document.addEventListener('rn:themechange', desenha);
  })();

  /* ═══════════════════════ CARTA CELESTE ═══════════════════════ */
  (function carta() {
    const cv = $('carta-celeste');
    if (!cv) return;
    const ctx = cv.getContext('2d');
    const sel = $('carta-noite'), hora = $('carta-hora'), horaOut = $('carta-hora-saida'), nota = $('carta-nota'), dica = $('carta-dica');
    const chk = { const: $('carta-constelacoes'), nomes: $('carta-nomes'), plan: $('carta-planetas'), grade: $('carta-grade') };
    /* "agora" = a próxima noite de verdade no lugar (Sol abaixo de −12°) */
    const estaNoite = (lat, lon) => {
      let t = Date.now();
      const sol = tt => { const J = A.jd(new Date(tt)), g = A.geocentrico('sol', J), p = A.precessa(g[0], g[1], J); return A.horizontais(p[0], p[1], lat, A.norm(A.gmst(J) + lon))[0]; };
      for (let k = 0; k < 200 && sol(t) > -12; k++) t += 10 * 60000;
      return new Date(Math.round(t / 900000) * 900000 + 3600000);
    };
    const NOITES = {
      agora: { lat: 51.4769, lon: -0.0005, lugar: 'Greenwich', data: () => estaNoite(51.4769, -0.0005),
        nota: 'O céu desta noite sobre o Observatório Real de Greenwich, o meridiano zero desde 1884, uma hora depois do fim do crepúsculo náutico.' },
      scilly: { lat: 49.9, lon: -6.4, lugar: 'Ilhas Scilly', data: () => new Date(Date.UTC(1707, 10, 2, 20, 26)),
        nota: '**22 de outubro de 1707** no calendário juliano, ainda usado na Inglaterra (2 de novembro no gregoriano), por volta das 20h. Com tempo fechado e sem como saber a longitude, a esquadra de Shovell se julgava a oeste da Bretanha e estava entre as rochas das Scilly.' },
      h4: { lat: 17.93, lon: -76.84, lugar: 'Port Royal, Jamaica', data: () => new Date(Date.UTC(1762, 0, 20, 1, 7)),
        nota: '**19 de janeiro de 1762**, noite da chegada do HMS _Deptford_ à Jamaica. William Harrison levava o H4 do pai; comparado com a hora local, o relógio deu a longitude com erro de poucas milhas depois de dois meses de mar.' },
      endeavour: { lat: -17.495, lon: -149.495, lugar: 'Ponta Vênus, Taiti', data: () => new Date(Date.UTC(1769, 5, 3, 21, 58)),
        nota: '**3 de junho de 1769**, meio-dia no Taiti: a equipe de James Cook, do HMS _Endeavour_, observa Vênus passando diante do Sol. Repare no Sol e em Vênus no mesmo ponto da carta (de dia as estrelas não se veem; a carta mostra onde estariam).' },
      trafalgar: { lat: 36.18, lon: -6.03, lugar: 'Cabo Trafalgar', data: () => new Date(Date.UTC(1805, 9, 21, 19, 24)),
        nota: '**21 de outubro de 1805**, noite da Batalha de Trafalgar. Nelson morrera à tarde; uma tempestade se aproximava da frota vitoriosa.' },
      rio: { lat: -22.9, lon: -43.2, lugar: 'Rio de Janeiro', data: () => estaNoite(-22.9, -43.2),
        nota: 'O céu desta noite sobre o Rio de Janeiro: a Polar fica abaixo do horizonte, e o Cruzeiro do Sul aponta o polo sul celeste.' }
    };
    let W = 0, d = 1, alvos = [], pedido = 0;
    encaixar(cv, (w, h, dd) => { W = w; d = dd; agenda(); });
    const agenda = () => { if (!pedido) pedido = requestAnimationFrame(() => { pedido = 0; desenha(); }); };

    function estado() {
      const n = NOITES[sel.value];
      const data = new Date(n.data().getTime() + parseFloat(hora.value) * 3600000);
      return { n, data };
    }
    function desenha() {
      if (!CEU || !W) return;
      const { n, data } = estado(), J = A.jd(data), lst = A.norm(A.gmst(J) + n.lon);
      const dark = escuro(), atlas = !dark;          // claro: atlas impresso (tinta sobre papel); escuro: céu real
      const R = W / 2 - 18, cx = W / 2, cy = W / 2;
      ctx.setTransform(d, 0, 0, d, 0, 0);
      ctx.clearRect(0, 0, W, W);
      const fundo = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
      if (atlas) { fundo.addColorStop(0, '#fbf6e6'); fundo.addColorStop(1, '#efe3c2'); }
      else { fundo.addColorStop(0, '#0b1630'); fundo.addColorStop(1, '#030712'); }
      ctx.fillStyle = fundo; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.fill();
      ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.clip();
      const pj = (alt, az) => { const p = A.estereografica(alt, az); return [cx + p[0] * R, cy + p[1] * R]; };
      const dados = estrelasNaData(J);
      alvos = [];
      if (chk.grade.checked) {
        ctx.strokeStyle = atlas ? 'rgba(122,86,21,0.25)' : 'rgba(143,211,255,0.16)'; ctx.lineWidth = 1;
        for (const alt of [30, 60]) { const r = Math.tan((90 - alt) * A.RAD / 2) * R; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.stroke(); }
        for (let az = 0; az < 360; az += 30) { const p = pj(0, az); ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(p[0], p[1]); ctx.stroke(); }
      }
      if (chk.const.checked) {
        ctx.strokeStyle = atlas ? 'rgba(42,36,22,0.32)' : 'rgba(143,211,255,0.28)'; ctx.lineWidth = 0.9;
        for (const k in dados.linhas) for (const seg of dados.linhas[k]) {
          ctx.beginPath(); let on = false;
          for (const p of seg) {
            const h = A.horizontais(p[0], p[1], n.lat, lst);
            if (h[0] < -5) { on = false; continue; }
            const q = pj(h[0], h[1]);
            on ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); on = true;
          }
          ctx.stroke();
        }
      }
      for (const s of dados.est) {
        const h = A.horizontais(s[0], s[1], n.lat, lst);
        if (h[0] < 0) continue;
        const q = pj(h[0], h[1]), r = Math.max(0.5, (5.6 - s[2]) * 0.55);
        if (atlas) ctx.fillStyle = 'rgba(30,26,18,0.85)';
        else { const c = A.corBV(s[3]); ctx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},${Math.min(1, 0.35 + (5.6 - s[2]) * 0.18)})`; }
        ctx.beginPath(); ctx.arc(q[0], q[1], r, 0, 6.2832); ctx.fill();
        if (s[2] < 1.6) alvos.push({ x: q[0], y: q[1], tipo: 'estrela', mag: s[2], h });
      }
      ctx.font = '600 11px Rajdhani, sans-serif'; ctx.textBaseline = 'middle';
      for (const s of dados.nav) {
        const h = A.horizontais(s.ra, s.dec, n.lat, lst);
        if (h[0] < 0) continue;
        const q = pj(h[0], h[1]), polar = s.n === 0, r = Math.max(1.6, (5.6 - s.mag) * 0.62);
        const cor = polar ? '#8fd3ff' : (atlas ? '#a8730f' : '#ffd76a');
        if (!atlas) { const gl = ctx.createRadialGradient(q[0], q[1], 0, q[0], q[1], r * 4); gl.addColorStop(0, polar ? 'rgba(143,211,255,0.5)' : 'rgba(255,215,106,0.45)'); gl.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(q[0], q[1], r * 4, 0, 7); ctx.fill(); }
        ctx.fillStyle = cor; ctx.beginPath(); ctx.arc(q[0], q[1], r, 0, 6.2832); ctx.fill();
        if (atlas) { ctx.strokeStyle = '#5a3e0a'; ctx.lineWidth = 0.8; ctx.stroke(); }
        if (chk.nomes.checked) { ctx.fillStyle = atlas ? '#8a2c12' : 'rgba(255,231,170,0.9)'; ctx.fillText(s.nome, q[0] + r + 4, q[1]); }
        alvos.push({ x: q[0], y: q[1], tipo: 'nav', s, h });
      }
      if (chk.plan.checked) {
        const corpos = [{ id: 'sol', nome: 'Sol', s: '☉', cor: '#ffcf4a', r: 7 }, { id: 'lua', nome: 'Lua', s: '☾', cor: '#e9eef5', r: 6 }].concat(PLANETAS.map(p => Object.assign({ r: 3.6 }, p)));
        for (const c of corpos) {
          let ra, dec;
          if (c.id === 'lua') [ra, dec] = A.lua(J);
          else { const g = A.geocentrico(c.id, J); [ra, dec] = A.precessa(g[0], g[1], J); }
          const h = A.horizontais(ra, dec, n.lat, lst);
          if (h[0] < 0) continue;
          const q = pj(h[0], h[1]);
          ctx.fillStyle = c.cor; ctx.strokeStyle = atlas ? '#2a2416' : 'rgba(0,0,0,0.6)'; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.arc(q[0], q[1], c.r, 0, 7); ctx.fill(); ctx.stroke();
          ctx.fillStyle = atlas ? '#1f4a7c' : '#ffb38a'; ctx.font = '700 12px Inter, sans-serif';
          ctx.fillText(`${c.s} ${c.nome}`, q[0] + c.r + 4, q[1] - 9);
          alvos.push({ x: q[0], y: q[1], tipo: 'corpo', c, h });
        }
      }
      ctx.restore();
      // aro de latão com os pontos cardeais (Leste à esquerda: o mapa se lê olhando para cima)
      ctx.lineWidth = 3; ctx.strokeStyle = '#b8862b'; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.stroke();
      ctx.lineWidth = 1; ctx.strokeStyle = '#e2bd6a'; ctx.beginPath(); ctx.arc(cx, cy, R + 7, 0, 7); ctx.stroke();
      for (let az = 0; az < 360; az += 10) {
        const p0 = pj(0, az), k = az % 90 === 0 ? 11 : 5;
        const vx = (p0[0] - cx) / R, vy = (p0[1] - cy) / R;
        ctx.beginPath(); ctx.moveTo(p0[0], p0[1]); ctx.lineTo(p0[0] + vx * k, p0[1] + vy * k); ctx.stroke();
      }
      ctx.fillStyle = atlas ? '#7a5615' : '#e2bd6a'; ctx.font = '700 15px Cinzel, serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      [['N', 0], ['L', 90], ['S', 180], ['O', 270]].forEach(([t, az]) => { const p = pj(0, az); ctx.fillText(t, cx + (p[0] - cx) * 0.94, cy + (p[1] - cy) * 0.94); });
      ctx.textAlign = 'start';
      const local = data.toLocaleString('pt-BR', { timeZone: 'UTC', dateStyle: 'medium', timeStyle: 'short' });
      horaOut.textContent = `${local} UTC · ${n.lugar} (${fmt(Math.abs(n.lat))}° ${n.lat >= 0 ? 'N' : 'S'})`;
    }

    /* Dica ao passar o ponteiro */
    cv.addEventListener('pointermove', ev => {
      const r = cv.getBoundingClientRect(), x = ev.clientX - r.left, y = ev.clientY - r.top;
      let melhor = null, dmin = 14 * 14;
      for (const a of alvos) { const dd = (a.x - x) ** 2 + (a.y - y) ** 2; if (dd < dmin) { dmin = dd; melhor = a; } }
      if (!melhor) { dica.hidden = true; return; }
      dica.textContent = '';
      const b = document.createElement('b'), linha = t => { dica.append(document.createElement('br'), t); };
      const alt = `altura ${fmt(melhor.h[0])}° · azimute ${fmt(melhor.h[1], 0)}°`;
      if (melhor.tipo === 'nav') {
        b.textContent = melhor.s.nome; dica.append(b);
        linha(melhor.s.n === 0 ? 'Polar (α Ursae Minoris)' : `Estrela de navegação nº ${melhor.s.n} · ${melhor.s.bayer}`);
        linha(`magnitude ${fmt(melhor.s.mag)}`); linha(alt);
      } else if (melhor.tipo === 'corpo') {
        b.textContent = melhor.c.nome; dica.append(b); linha(alt);
      } else {
        b.textContent = 'Estrela brilhante'; dica.append(b); linha(`magnitude ${fmt(melhor.mag)}`); linha(alt);
      }
      dica.style.left = `${x}px`; dica.style.top = `${y}px`; dica.hidden = false;
    });
    cv.addEventListener('pointerleave', () => { dica.hidden = true; });

    const mudarNoite = () => { textoRico(nota, NOITES[sel.value].nota); hora.value = 0; agenda(); };
    sel.addEventListener('change', mudarNoite);
    hora.addEventListener('input', agenda);
    Object.values(chk).forEach(c => c.addEventListener('change', agenda));
    document.addEventListener('rn:themechange', agenda);
    ceuPronto.then(() => { mudarNoite(); }).catch(() => { nota.textContent = 'Não foi possível carregar o catálogo de estrelas.'; });
  })();

  /* ═══════════════════════ PLANETÁRIO MECÂNICO ═══════════════════════ */
  (function orrery() {
    const cv = $('orrery');
    if (!cv) return;
    const ctx = cv.getContext('2d');
    const ano = $('orrery-ano'), saida = $('orrery-data'), play = $('orrery-play'), marcos = $('orrery-marcos');
    const DESCOBERTA = { urano: 1781.2, netuno: 1846.7 };
    const MARCOS = [[1610.0, '1610 · Galileu vê as luas de Júpiter'], [1707.84, '1707 · Scilly'], [1762.05, '1762 · H4 na Jamaica'], [1769.42, '1769 · Trânsito de Vênus'],
      [1781.2, '1781 · Urano'], [1805.8, '1805 · Trafalgar'], [1846.73, '1846 · Netuno'], [1884.8, '1884 · Meridiano de Greenwich']];
    MARCOS.forEach(([a, t]) => {
      const bt = document.createElement('button'); bt.type = 'button'; bt.className = 'btn-mini'; bt.textContent = t;
      bt.addEventListener('click', () => { ano.value = a; parar(); desenha(); });
      marcos.appendChild(bt);
    });
    const agora = new Date(); ano.value = (agora.getUTCFullYear() + agora.getUTCMonth() / 12).toFixed(2);
    let W = 0, H = 0, girando = false;
    encaixar(cv, (w, h, d) => { W = w; H = h; ctx.setTransform(d, 0, 0, d, 0, 0); desenha(); });
    const dataDoAno = a => new Date(Date.UTC(Math.floor(a), 0, 1) + (a - Math.floor(a)) * 365.2425 * 86400000);

    function desenha() {
      if (!W) return;
      const dark = escuro(), a = parseFloat(ano.value), data = dataDoAno(a), J = A.jd(data);
      const g = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W * 0.6);
      if (dark) { g.addColorStop(0, '#0d1a33'); g.addColorStop(1, '#03070f'); } else { g.addColorStop(0, '#fbf6e6'); g.addColorStop(1, '#e9dcb8'); }
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      const cx = W / 2, cy = H / 2, K = Math.min(W, H) * 0.47 / Math.sqrt(30.1);
      // anel da eclíptica com graduação (latão)
      const Ra = K * Math.sqrt(30.1) + 10;
      ctx.strokeStyle = '#b8862b'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, Ra, 0, 7); ctx.stroke();
      ctx.lineWidth = 1;
      for (let l = 0; l < 360; l += 5) { const an = -l * A.RAD, k = l % 30 === 0 ? 9 : 4; ctx.beginPath(); ctx.moveTo(cx + Math.cos(an) * Ra, cy + Math.sin(an) * Ra); ctx.lineTo(cx + Math.cos(an) * (Ra - k), cy + Math.sin(an) * (Ra - k)); ctx.stroke(); }
      ctx.fillStyle = dark ? '#e2bd6a' : '#7a5615'; ctx.font = '700 12px Inter, sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText('♈︎ 0° · ponto vernal', cx + Ra + 6, cy);
      const corpos = [{ id: 'terra', nome: 'Terra', cor: '#5fb3ff', r: 5 }].concat(PLANETAS.map(p => Object.assign({ r: { mercurio: 3, venus: 4.5, marte: 3.8, jupiter: 9, saturno: 7.5, urano: 6, netuno: 6 }[p.id] }, p)));
      const orbitaA = { mercurio: 0.387, venus: 0.723, terra: 1, marte: 1.524, jupiter: 5.203, saturno: 9.537, urano: 19.19, netuno: 30.07 };
      for (const c of corpos) {
        const ro = K * Math.sqrt(orbitaA[c.id]);
        const futuro = DESCOBERTA[c.id] && a < DESCOBERTA[c.id];
        ctx.strokeStyle = dark ? 'rgba(226,189,106,0.28)' : 'rgba(122,86,21,0.35)'; ctx.setLineDash(futuro ? [3, 6] : []);
        ctx.beginPath(); ctx.arc(cx, cy, ro, 0, 7); ctx.stroke(); ctx.setLineDash([]);
        const p = A.helio(c.id, J), ang = Math.atan2(p[1], p[0]);
        const x = cx + Math.cos(-ang) * ro, y = cy + Math.sin(-ang) * ro;
        ctx.globalAlpha = futuro ? 0.28 : 1;
        // haste de latão, como num orrery de verdade
        ctx.strokeStyle = dark ? 'rgba(226,189,106,0.35)' : 'rgba(122,86,21,0.4)'; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(x, y); ctx.stroke();
        const gp = ctx.createRadialGradient(x - c.r * 0.4, y - c.r * 0.4, 0, x, y, c.r);
        gp.addColorStop(0, '#ffffff'); gp.addColorStop(0.35, c.cor); gp.addColorStop(1, dark ? '#1b2333' : '#5a5446');
        ctx.fillStyle = gp; ctx.beginPath(); ctx.arc(x, y, c.r, 0, 7); ctx.fill();
        if (c.id === 'saturno') { ctx.strokeStyle = 'rgba(240,220,154,0.8)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(x, y, c.r * 1.9, c.r * 0.7, -0.4, 0, 7); ctx.stroke(); ctx.lineWidth = 1; }
        ctx.fillStyle = dark ? '#e6edf6' : '#2a2416'; ctx.font = '600 11px Rajdhani, sans-serif';
        ctx.fillText(futuro ? `${c.nome} (ainda desconhecido)` : c.nome, x + c.r + 4, y - c.r - 3);
        ctx.globalAlpha = 1;
      }
      const sol = ctx.createRadialGradient(cx, cy, 0, cx, cy, 22);
      sol.addColorStop(0, '#fff6c8'); sol.addColorStop(0.4, '#ffcf4a'); sol.addColorStop(1, 'rgba(255,170,40,0)');
      ctx.fillStyle = sol; ctx.beginPath(); ctx.arc(cx, cy, 22, 0, 7); ctx.fill();
      saida.textContent = data.toLocaleDateString('pt-BR', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' });
    }
    let laco = 0, ultimo = 0;
    const girar = t => {
      const dt = Math.min(0.1, (t - (ultimo || t)) / 1000); ultimo = t;
      let a = parseFloat(ano.value) + dt * 0.35;
      if (a > 2100) a = 1500;
      ano.value = a; desenha();
      laco = requestAnimationFrame(girar);
    };
    function parar() { girando = false; cancelAnimationFrame(laco); laco = 0; play.setAttribute('aria-pressed', 'false'); play.textContent = '▶ Girar o tempo'; }
    play.addEventListener('click', () => {
      if (girando) return parar();
      girando = true; ultimo = 0; play.setAttribute('aria-pressed', 'true'); play.textContent = '❚❚ Parar';
      laco = requestAnimationFrame(girar);
    });
    ano.addEventListener('input', () => { parar(); desenha(); });
    document.addEventListener('rn:themechange', desenha);
    new IntersectionObserver(es => { if (!es[0].isIntersecting && girando) parar(); }).observe(cv);
  })();
})();
