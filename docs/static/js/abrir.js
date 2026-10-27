/* ═══════════════════════════════════════════════════════════════
   ROYAL NAVY — PÁGINA DE CARREGAMENTO (abrir.html, no GitHub Pages)
   ───────────────────────────────────────────────────────────────
   O plano gratuito do Render dorme depois de alguns minutos sem visitas, e quem
   chega nesse momento vê a tela de "waking up" do próprio Render. Esta página fica
   no GitHub Pages (sempre no ar): ela acorda o servidor em segundo plano, pedindo
   como imagem o /sinal.svg, e só leva o visitante quando o site já responde.
   • Destinos só de uma lista fixa (?ir=consulta) — nada de redirecionamento aberto.
   • Céu, mar e fragata em canvas; com movimento reduzido, um quadro só.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const meta = document.querySelector('meta[name="rn-servidor"]');
  const SERVIDOR = meta && /^https:\/\/[a-z0-9.-]+$/.test(meta.content) ? meta.content : 'https://royalnavy-consulta.onrender.com';
  const DESTINOS = { inicio: '/', consulta: '/consulta', navegacao: '/navegacao', sugerir: '/sugerir', contato: '/contato' };
  const ir = new URLSearchParams(location.search).get('ir');
  const destino = SERVIDOR + (Object.prototype.hasOwnProperty.call(DESTINOS, ir) ? DESTINOS[ir] : '/');
  const REDUZIDO = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const estado = $('abrir-estado'), barra = $('abrir-barra'), fill = $('abrir-barra-fill'), tempo = $('abrir-tempo'), acoes = $('abrir-acoes');
  $('abrir-direto').href = destino;

  /* ── Mensagens de bordo e barra de progresso (estimada pelo tempo; 100% só quando o servidor responde) ── */
  const FALAS = ['Içando a âncora…', 'Acendendo as caldeiras…', 'Tomando a altura da Polar…', 'Acertando o cronômetro…',
    'Traçando o rumo na carta…', 'Desfraldando as velas…', 'Sinalizando ao porto…', 'Quase lá: o porto está à vista…'];
  const t0 = performance.now();
  let pronto = false, fala = 0;
  function progresso(p) {
    fill.style.transform = `scaleX(${p / 100})`;
    barra.setAttribute('aria-valuenow', String(Math.round(p)));
  }
  const relogio = setInterval(() => {
    if (pronto) return;
    const s = (performance.now() - t0) / 1000;
    tempo.textContent = `${Math.floor(s)} s`;
    progresso(92 * (1 - Math.exp(-s / 30)));                 // ~60% em 30 s, ~80% em 1 min; nunca chega a 100 sozinha
    const k = Math.min(FALAS.length - 1, Math.floor(s / 7));
    if (k !== fala) { fala = k; estado.textContent = FALAS[k]; }
    if (s > 150) acoes.hidden = false;                       // mais de 2,5 min: oferece entrar direto ou ver a versão estática
  }, 250);

  /* ── O sinal: tenta carregar /sinal.svg até o servidor responder ── */
  function sondar() {
    if (pronto) return;
    const img = new Image();
    let feito = false;
    const fim = ok => {
      if (feito) return; feito = true; clearTimeout(limite);
      if (ok) chegou(); else setTimeout(sondar, 2500);
    };
    const limite = setTimeout(() => { img.src = ''; fim(false); }, 15000);   // o Render pode segurar o pedido enquanto acorda
    img.onload = () => fim(img.naturalWidth > 0 || img.width > 0);
    img.onerror = () => fim(false);
    img.src = `${SERVIDOR}/sinal.svg?t=${Date.now()}`;
  }
  function chegou() {
    pronto = true; clearInterval(relogio);
    progresso(100);
    estado.textContent = 'Porto à vista! Entrando no site…';
    document.body.classList.add('abrir--pronto');
    setTimeout(() => location.replace(destino), REDUZIDO ? 150 : 700);
  }
  sondar();

  /* ── Cena: céu estrelado, mar e uma fragata balançando ── */
  const cv = $('abrir-mar'), ctx = cv.getContext('2d');
  const escuro = () => document.documentElement.getAttribute('data-theme') !== 'light';
  let W = 0, H = 0, estrelas = [];
  function medir() {
    const d = Math.min(window.devicePixelRatio || 1, 1.5);
    W = cv.clientWidth; H = cv.clientHeight;
    cv.width = Math.round(W * d); cv.height = Math.round(H * d);
    ctx.setTransform(d, 0, 0, d, 0, 0);
    let s = 7; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
    estrelas = Array.from({ length: Math.round(W * H / 5200) }, () => [rnd() * W, rnd() * H * 0.7, rnd() * 1.2 + 0.3, rnd() * 6.28]);
    if (REDUZIDO) desenhar(0);
  }
  function fragata(x, y, s, cor) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.fillStyle = cor; ctx.strokeStyle = cor;
    ctx.beginPath(); ctx.moveTo(-130, -22); ctx.quadraticCurveTo(0, -8, 120, -24); ctx.lineTo(104, 4); ctx.quadraticCurveTo(0, 12, -112, 4); ctx.closePath(); ctx.fill();
    ctx.fillRect(-130, -34, 22, 14);
    ctx.lineWidth = 2.4;
    for (const [mx, mh] of [[-62, 150], [4, 178], [64, 138]]) {
      ctx.beginPath(); ctx.moveTo(mx, -16); ctx.lineTo(mx, -16 - mh); ctx.stroke();
      for (const [a0, a1, w] of [[0.18, 0.36, 46], [0.4, 0.6, 40], [0.63, 0.8, 33], [0.83, 0.95, 24]]) {
        const ya = -16 - mh * (1 - a0), yb = -16 - mh * (1 - a1), wb = w * 0.86;
        ctx.beginPath(); ctx.moveTo(mx - w, ya); ctx.lineTo(mx + w, ya);
        ctx.quadraticCurveTo(mx + wb + 6, (ya + yb) / 2, mx + wb, yb); ctx.quadraticCurveTo(mx, yb + 7, mx - wb, yb);
        ctx.quadraticCurveTo(mx - wb - 6, (ya + yb) / 2, mx - w, ya); ctx.fill();
      }
    }
    ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(116, -22); ctx.lineTo(190, -48); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(186, -46); ctx.lineTo(70, -150); ctx.lineTo(112, -30); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  function desenhar(t) {
    if (!W) return;
    const noite = escuro(), mar = H * 0.78;
    const ceu = ctx.createLinearGradient(0, 0, 0, mar);
    if (noite) { ceu.addColorStop(0, '#030814'); ceu.addColorStop(1, '#0d2244'); }
    else { ceu.addColorStop(0, '#1b2557'); ceu.addColorStop(0.7, '#5a5d98'); ceu.addColorStop(1, '#e9a27a'); }   // crepúsculo náutico
    ctx.fillStyle = ceu; ctx.fillRect(0, 0, W, mar);
    for (const [x, y, r, f] of estrelas) {
      if (!noite && y > mar * 0.55) continue;                   // no crepúsculo só as estrelas altas aparecem
      ctx.globalAlpha = 0.45 + 0.55 * Math.abs(Math.sin(t * 0.0012 + f));
      ctx.fillStyle = '#eaf2ff'; ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.fill();
    }
    ctx.globalAlpha = 1;
    const agua = ctx.createLinearGradient(0, mar, 0, H);
    agua.addColorStop(0, noite ? '#08162b' : '#2b3566'); agua.addColorStop(1, noite ? '#02060e' : '#141a3a');
    ctx.fillStyle = agua; ctx.fillRect(0, mar, W, H - mar);
    ctx.strokeStyle = noite ? 'rgba(143,211,255,0.16)' : 'rgba(255,214,170,0.28)'; ctx.lineWidth = 1;
    for (let k = 0; k < 7; k++) {                                // ondas em faixas, mais lentas ao longe
      const y = mar + 8 + k * k * 4.2;
      ctx.beginPath();
      for (let x = 0; x <= W; x += 16) { const yy = y + Math.sin(x * 0.02 + t * 0.0009 * (1 + k * 0.3) + k) * (1 + k * 0.5); x ? ctx.lineTo(x, yy) : ctx.moveTo(x, yy); }
      ctx.stroke();
    }
    const s = Math.max(0.42, Math.min(0.8, W / 1700));
    const bx = W * (W > 760 ? 0.8 : 0.72), by = mar + 4 + Math.sin(t * 0.0016) * 3;
    ctx.save(); ctx.translate(bx, by); ctx.rotate(Math.sin(t * 0.0011) * 0.02);
    fragata(0, 0, s, noite ? '#01040b' : '#0b1030');
    ctx.restore();
    ctx.fillStyle = noite ? 'rgba(255,215,106,0.9)' : 'rgba(255,224,170,0.95)';   // lanterna de popa
    ctx.beginPath(); ctx.arc(bx - 128 * s, by - 34 * s, 2.2, 0, 6.2832); ctx.fill();
  }
  new ResizeObserver(medir).observe(cv);
  if (!REDUZIDO) {
    const laco = t => { if (!document.hidden) desenhar(t); requestAnimationFrame(laco); };
    requestAnimationFrame(laco);
  }
  document.addEventListener('rn:themechange', () => desenhar(performance.now()));
})();
