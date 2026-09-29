/* ═══════════════════════════════════════════════════════════════
   ROYAL NAVY — MODO CLARO: O MERGULHO EM MAR CALMO (Canvas 2D)

   Contraponto ao mergulho de guerra do modo escuro: a mesma descida ao rolar
   a página, só que num mar limpo, iluminado pelo sol e em paz:
     1) CALMO     canvas FIXO (meia resolução): cor da água por profundidade,
                  feixes de sol, plâncton, bolhas, cardumes, golfinhos,
                  águas-vivas, tartarugas, uma baleia ao longe, tubarões, um
                  submarino em patrulha, minas antigas ancoradas e uma raia;
     2) PATRULHA  faixa "Mar em Paz": submarino em patrulha silenciosa, campo
                  de minas antigas cobertas de vida, robô caça-minas, tubarões,
                  tartaruga e cardumes; os cascos do comboio passam lá em cima;
     3) RECIFE    faixa "Jardins de Coral": naufrágios cobertos de corais,
                  anêmonas com peixes-palhaço, peixes de recife, tartaruga,
                  raia e tubarão sobre a areia iluminada pelas cáusticas do sol;
     4) GAUGE     medidor de profundidade do mergulho (m).

   Desempenho (mesmas regras do modo escuro): os canvases só animam quando
   visíveis, com a aba em primeiro plano e no modo claro; o fundo fixo roda em
   50% da resolução; sprites pré-renderizados; partículas em pools; o que é
   estático (areia, corais do leito) vira uma imagem só; RNPerf reduz efeitos.
   ═══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  const root    = document.documentElement;
  const $       = id => document.getElementById(id);
  const isLight = () => root.getAttribute('data-theme') !== 'dark';
  const level   = () => (window.RNPerf ? window.RNPerf.level : 2);
  const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const rnd     = (a, b) => a + Math.random() * (b - a);
  const clamp   = (v, a, b) => Math.max(a, Math.min(b, v));
  const mod     = (a, n) => ((a % n) + n) % n;
  const mk      = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; };
  function seeded(seed) { let s = seed; return () => ((s = (s * 16807) % 2147483647) / 2147483647); }
  function flip(c) { const f = mk(c.width, c.height), g = f.getContext('2d'); g.translate(c.width, 0); g.scale(-1, 1); g.drawImage(c, 0, 0); return f; }
  const pair = c => ({ r: c, l: flip(c), w: c.width, h: c.height });   // voltado para a direita / esquerda
  function rrect(g, x, y, w, h, r) {
    g.beginPath(); g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }

  if (!$('calm-canvas')) return;

  /* ═════════════════════════ SPRITES (desenhados uma vez) ═════════════════════════ */
  function glow(rgb, size = 96) {
    const c = mk(size, size), g = c.getContext('2d');
    const gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gr.addColorStop(0, `rgba(${rgb},1)`); gr.addColorStop(0.3, `rgba(${rgb},0.45)`); gr.addColorStop(1, `rgba(${rgb},0)`);
    g.fillStyle = gr; g.fillRect(0, 0, size, size);
    return c;
  }
  const GL_GREEN = glow('120,255,160');                        // marca de "mina inspecionada"

  /* feixe de sol (bordas suaves) */
  const SHAFT = (() => {
    const w = 200, h = 800, c = mk(w, h), g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, 'rgba(255,252,232,0.8)'); gr.addColorStop(0.55, 'rgba(255,252,232,0.22)'); gr.addColorStop(1, 'rgba(255,252,232,0)');
    g.fillStyle = gr; g.beginPath(); g.moveTo(w * 0.4, 0); g.lineTo(w * 0.6, 0); g.lineTo(w, h); g.lineTo(0, h); g.closePath(); g.fill();
    g.globalCompositeOperation = 'destination-in';
    const hz = g.createLinearGradient(0, 0, w, 0);
    hz.addColorStop(0, 'rgba(0,0,0,0)'); hz.addColorStop(0.5, 'rgba(0,0,0,1)'); hz.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = hz; g.fillRect(0, 0, w, h);
    return c;
  })();

  /* peixinho de cardume (fuzileiro: dorso azul, faixa e cauda amarelas) */
  const FISH = pair((() => {
    const c = mk(32, 14), g = c.getContext('2d');
    g.fillStyle = '#f0c238';
    g.beginPath(); g.moveTo(8, 7); g.lineTo(1, 1.5); g.lineTo(4, 7); g.lineTo(1, 12.5); g.closePath(); g.fill();
    const b = g.createLinearGradient(0, 2.5, 0, 11.5);
    b.addColorStop(0, '#2f6ea5'); b.addColorStop(0.45, '#7fc3e2'); b.addColorStop(1, '#f2fbff');
    g.fillStyle = b; g.beginPath(); g.ellipse(17.5, 7, 11, 4.4, 0, 0, 7); g.fill();
    g.fillStyle = 'rgba(245,200,60,0.9)'; g.fillRect(9, 5.4, 13, 1.1);
    g.fillStyle = '#12273a'; g.beginPath(); g.arc(25, 6.3, 1.15, 0, 7); g.fill();
    return c;
  })());

  /* peixes de recife (34×26, voltados para a direita) */
  function reefFish(kind) {
    const c = mk(34, 26), g = c.getContext('2d');
    const body = (cx, cy, rx, ry, a, b) => {
      const gr = g.createLinearGradient(0, cy - ry, 0, cy + ry); gr.addColorStop(0, a); gr.addColorStop(1, b);
      g.fillStyle = gr; g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, 7); g.fill();
    };
    const tail = (col, x = 9) => { g.fillStyle = col; g.beginPath(); g.moveTo(x, 13); g.lineTo(2, 6); g.lineTo(4.5, 13); g.lineTo(2, 20); g.closePath(); g.fill(); };
    const eye = (x, y, r = 1.3) => { g.fillStyle = '#16181b'; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); };
    if (kind === 'tang') {                                       // cirurgião-amarelo
      g.fillStyle = '#f5b800';
      g.beginPath(); g.moveTo(10, 9); g.quadraticCurveTo(18, -1, 27, 6); g.lineTo(12, 13); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(10, 17); g.quadraticCurveTo(18, 27, 26, 20); g.lineTo(12, 13); g.closePath(); g.fill();
      tail('#f5b800');
      body(19, 13, 10.5, 8, '#ffe45c', '#f5b800');
      g.fillStyle = '#f5b800'; g.beginPath(); g.moveTo(28, 11); g.lineTo(32.5, 12.6); g.lineTo(28, 14.8); g.closePath(); g.fill();
      g.fillStyle = '#ffffff'; g.fillRect(9, 12.3, 2.4, 1.5);
      eye(25.3, 10.8);
    } else if (kind === 'blue') {                                // cirurgião-patela
      tail('#ffd21f');
      body(18.5, 13, 11, 7.6, '#2f7df2', '#1a4fb8');
      g.strokeStyle = '#0b1a3a'; g.lineWidth = 2.2; g.lineCap = 'round';
      g.beginPath(); g.moveTo(26, 9.5); g.quadraticCurveTo(17, 5.5, 11.5, 11); g.quadraticCurveTo(15, 16, 22, 14); g.stroke();
      eye(26.5, 11.5);
    } else if (kind === 'clown') {                               // peixe-palhaço
      g.fillStyle = '#f26100';
      g.beginPath(); g.moveTo(12, 8); g.quadraticCurveTo(19, 1.5, 26, 7); g.lineTo(14, 12); g.closePath(); g.fill();
      tail('#f26100');
      body(19, 13, 10.5, 6.8, '#ff9a3c', '#f26100');
      g.save(); g.beginPath(); g.ellipse(19, 13, 10.5, 6.8, 0, 0, 7); g.clip();
      [[24.5, 2.6], [18, 2.8], [11.5, 2.2]].forEach(([x, w]) => {
        g.fillStyle = '#1b1b1b'; g.fillRect(x - w / 2 - 0.9, 0, w + 1.8, 26);
        g.fillStyle = '#ffffff'; g.fillRect(x - w / 2, 0, w, 26);
      });
      g.restore();
      eye(26.8, 11.6, 1.2);
    } else if (kind === 'angel') {                               // peixe-anjo-imperador
      tail('#ffd84a');
      g.fillStyle = '#1d3f9a';
      g.beginPath(); g.moveTo(11, 8); g.quadraticCurveTo(18, -1, 26, 5); g.lineTo(13, 13); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(11, 18); g.quadraticCurveTo(18, 27, 25, 21); g.lineTo(13, 13); g.closePath(); g.fill();
      body(19, 13, 10, 8.4, '#2a55c4', '#16307a');
      g.save(); g.beginPath(); g.ellipse(19, 13, 10, 8.4, 0, 0, 7); g.clip();
      g.strokeStyle = '#ffd84a'; g.lineWidth = 1.2;
      for (let i = -3; i <= 3; i++) { g.beginPath(); g.moveTo(8, 13 + i * 3.4 - 3); g.lineTo(30, 13 + i * 3.4 + 3); g.stroke(); }
      g.fillStyle = '#10214d'; g.fillRect(24, 4, 3, 18);
      g.restore();
      eye(26.5, 11.5);
    } else {                                                     // peixe-borboleta
      tail('#ffd23f');
      g.fillStyle = '#ffd23f';
      g.beginPath(); g.moveTo(10, 9); g.quadraticCurveTo(18, 0, 26, 6); g.lineTo(12, 13); g.closePath(); g.fill();
      body(19, 13, 10, 8, '#fffbe6', '#ffe89a');
      g.fillStyle = '#1b1b1b'; g.fillRect(24.2, 5, 2.6, 16);
      g.beginPath(); g.arc(12.5, 14, 1.8, 0, 7); g.fill();
      g.fillStyle = '#ffd23f'; g.beginPath(); g.moveTo(28, 11.5); g.lineTo(33, 12.8); g.lineTo(28, 14.2); g.closePath(); g.fill();
      eye(25.5, 11.3, 1.1);
    }
    return c;
  }
  const REEF = {};
  ['tang', 'blue', 'clown', 'angel', 'butterfly'].forEach(k => { REEF[k] = pair(reefFish(k)); });

  /* tubarão (corpo + cauda separada para abanar), voltado para a direita */
  function sharkSprites(L) {
    const h = Math.ceil(L * 0.5), cy = h * 0.5, body = mk(L + 2, h), g = body.getContext('2d');
    const X = n => n * L, Y = n => cy + n * L;
    const FIN = '#57707f';
    g.fillStyle = '#6d8593';                                       // nadadeira peitoral do lado de lá
    g.beginPath(); g.moveTo(X(0.66), Y(0.05)); g.quadraticCurveTo(X(0.6), Y(0.12), X(0.56), Y(0.155)); g.quadraticCurveTo(X(0.6), Y(0.09), X(0.6), Y(0.055)); g.closePath(); g.fill();
    g.beginPath();                                                 // corpo fusiforme
    g.moveTo(X(0), Y(-0.018));
    g.bezierCurveTo(X(0.22), Y(-0.06), X(0.5), Y(-0.105), X(0.76), Y(-0.085));
    g.bezierCurveTo(X(0.9), Y(-0.07), X(0.98), Y(-0.035), X(1), Y(-0.005));
    g.bezierCurveTo(X(0.985), Y(0.03), X(0.93), Y(0.055), X(0.82), Y(0.065));
    g.bezierCurveTo(X(0.55), Y(0.085), X(0.25), Y(0.055), X(0), Y(0.018));
    g.closePath();
    const gr = g.createLinearGradient(0, Y(-0.105), 0, Y(0.085));
    gr.addColorStop(0, '#526b7b'); gr.addColorStop(0.5, '#8aa0ad'); gr.addColorStop(0.6, '#e2ebef'); gr.addColorStop(1, '#f5f9fa');
    g.fillStyle = gr; g.fill();
    g.fillStyle = FIN;
    g.beginPath(); g.moveTo(X(0.53), Y(-0.098)); g.quadraticCurveTo(X(0.5), Y(-0.2), X(0.4), Y(-0.245)); g.quadraticCurveTo(X(0.43), Y(-0.16), X(0.37), Y(-0.092)); g.closePath(); g.fill();   // dorsal
    g.beginPath(); g.moveTo(X(0.19), Y(-0.05)); g.quadraticCurveTo(X(0.17), Y(-0.09), X(0.13), Y(-0.1)); g.lineTo(X(0.14), Y(-0.045)); g.closePath(); g.fill();                  // 2ª dorsal
    g.beginPath(); g.moveTo(X(0.31), Y(0.06)); g.quadraticCurveTo(X(0.28), Y(0.1), X(0.25), Y(0.11)); g.lineTo(X(0.26), Y(0.055)); g.closePath(); g.fill();                     // pélvica
    g.fillStyle = '#627b8a';                                       // peitoral do lado de cá
    g.beginPath(); g.moveTo(X(0.7), Y(0.05)); g.quadraticCurveTo(X(0.62), Y(0.15), X(0.52), Y(0.2)); g.quadraticCurveTo(X(0.6), Y(0.1), X(0.61), Y(0.06)); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(60,80,92,0.5)'; g.lineWidth = Math.max(0.8, L * 0.004);
    for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(X(0.72 + i * 0.018), Y(-0.03)); g.quadraticCurveTo(X(0.715 + i * 0.018), Y(0), X(0.72 + i * 0.018), Y(0.03)); g.stroke(); }  // guelras
    g.fillStyle = '#1a2229'; g.beginPath(); g.arc(X(0.9), Y(-0.022), Math.max(1, L * 0.008), 0, 7); g.fill();
    g.strokeStyle = 'rgba(50,60,70,0.55)'; g.beginPath(); g.moveTo(X(0.97), Y(0.03)); g.quadraticCurveTo(X(0.9), Y(0.045), X(0.86), Y(0.035)); g.stroke();

    const tw = Math.ceil(L * 0.25), th = Math.ceil(L * 0.3), tail = mk(tw, th), tg = tail.getContext('2d');
    const px = L * 0.23, py = th * 0.52;                           // ponto de articulação (pedúnculo)
    tg.translate(px, py);
    const tgr = tg.createLinearGradient(0, -th * 0.5, 0, th * 0.4); tgr.addColorStop(0, '#526b7b'); tgr.addColorStop(1, '#7d93a0');
    tg.fillStyle = tgr;
    tg.beginPath(); tg.moveTo(L * 0.01, -L * 0.02);
    tg.quadraticCurveTo(-L * 0.1, -L * 0.07, -L * 0.21, -L * 0.15);
    tg.quadraticCurveTo(-L * 0.15, -L * 0.04, -L * 0.1, 0);
    tg.quadraticCurveTo(-L * 0.13, L * 0.05, -L * 0.14, L * 0.095);
    tg.quadraticCurveTo(-L * 0.06, L * 0.05, L * 0.01, L * 0.02);
    tg.closePath(); tg.fill();
    return { body, tail, L, h, px, py };
  }
  function drawShark(g, sp, x, y, dir, t, ph) {
    g.save();
    g.translate(x, y); g.scale(dir, 1); g.rotate(Math.sin(t * 0.8 + ph) * 0.025);
    g.drawImage(sp.body, -sp.L / 2, -sp.h / 2);
    g.translate(-sp.L / 2 + 1, 0); g.rotate(Math.sin(t * 3.2 + ph) * 0.2);
    g.drawImage(sp.tail, -sp.px, -sp.py);
    g.restore();
  }

  /* tartaruga-verde: casco + cabeça, nadadeiras separadas (batem devagar) */
  function turtleSprites(S) {
    const w = Math.ceil(S * 1.55), h = Math.ceil(S * 0.9), c = mk(w, h), g = c.getContext('2d');
    const cx = S * 0.66, cy = h * 0.5;
    g.fillStyle = '#e6d8a2'; g.beginPath(); g.ellipse(cx, cy + S * 0.16, S * 0.42, S * 0.13, 0, 0, 7); g.fill();     // plastrão
    g.fillStyle = '#8b9950'; g.beginPath(); g.ellipse(cx + S * 0.48, cy + S * 0.01, S * 0.13, S * 0.1, 0, 0, 7); g.fill();   // pescoço
    const hg = g.createLinearGradient(0, cy - S * 0.14, 0, cy + S * 0.1); hg.addColorStop(0, '#9aa75a'); hg.addColorStop(1, '#6f7c36');
    g.fillStyle = hg; g.beginPath(); g.ellipse(cx + S * 0.63, cy - S * 0.03, S * 0.17, S * 0.115, -0.12, 0, 7); g.fill();   // cabeça
    g.fillStyle = 'rgba(70,80,30,0.55)';
    [[0.6, -0.08], [0.66, -0.02], [0.56, 0.0], [0.7, -0.07]].forEach(([dx, dy]) => { g.beginPath(); g.ellipse(cx + dx * S, cy + dy * S, S * 0.03, S * 0.022, 0, 0, 7); g.fill(); });
    g.fillStyle = '#1b1d12'; g.beginPath(); g.arc(cx + S * 0.7, cy - S * 0.065, Math.max(1, S * 0.018), 0, 7); g.fill();
    const sg = g.createLinearGradient(0, cy - S * 0.34, 0, cy + S * 0.28);                                          // casco
    sg.addColorStop(0, '#a3824a'); sg.addColorStop(0.6, '#6e5631'); sg.addColorStop(1, '#4b3b22');
    g.fillStyle = sg; g.beginPath(); g.ellipse(cx, cy, S * 0.5, S * 0.3, -0.04, 0, 7); g.fill();
    g.save(); g.beginPath(); g.ellipse(cx, cy, S * 0.5, S * 0.3, -0.04, 0, 7); g.clip();
    g.strokeStyle = 'rgba(60,45,25,0.8)'; g.lineWidth = Math.max(1, S * 0.022);
    [[-0.3, -0.1], [-0.1, -0.16], [0.1, -0.16], [0.3, -0.1], [-0.2, 0.08], [0.02, 0.06], [0.24, 0.07]].forEach(([dx, dy]) => {
      const pg = g.createRadialGradient(cx + dx * S, cy + dy * S - S * 0.03, 0, cx + dx * S, cy + dy * S, S * 0.12);
      pg.addColorStop(0, '#c9a765'); pg.addColorStop(1, '#8a6c3b');
      g.fillStyle = pg; g.beginPath(); g.ellipse(cx + dx * S, cy + dy * S, S * 0.11, S * 0.085, 0, 0, 7); g.fill(); g.stroke();
    });
    g.restore();
    g.strokeStyle = '#3f3220'; g.lineWidth = Math.max(1, S * 0.03); g.beginPath(); g.ellipse(cx, cy, S * 0.5, S * 0.3, -0.04, 0, 7); g.stroke();

    const flipper = (len, col) => {
      const fw = Math.ceil(len * 1.1), fh = Math.ceil(len * 0.6), f = mk(fw, fh), fg = f.getContext('2d');
      fg.translate(fw - 2, fh * 0.18);
      const fgr = fg.createLinearGradient(0, 0, -len, len * 0.4); fgr.addColorStop(0, col[0]); fgr.addColorStop(1, col[1]);
      fg.fillStyle = fgr;
      fg.beginPath(); fg.moveTo(0, -len * 0.06); fg.quadraticCurveTo(-len * 0.3, -len * 0.02, -len, len * 0.42); fg.quadraticCurveTo(-len * 0.42, len * 0.26, 0, len * 0.08); fg.closePath(); fg.fill();
      return { c: f, px: fw - 2, py: fh * 0.18 };
    };
    return {
      c, w, h, cx, cy, S,
      front: flipper(S * 0.72, ['#8c9a4a', '#6c7a34']), frontFar: flipper(S * 0.72, ['#6a7636', '#525d27']),
      rear: flipper(S * 0.3, ['#8c9a4a', '#6c7a34']), rearFar: flipper(S * 0.3, ['#6a7636', '#525d27']),
    };
  }
  function drawTurtle(g, sp, x, y, dir, t, ph) {
    const S = sp.S, sw = Math.sin(t * 1.3 + ph);
    const fl = (f, fx, fy, a) => { g.save(); g.translate(fx, fy); g.rotate(a); g.drawImage(f.c, -f.px, -f.py); g.restore(); };
    g.save();
    g.translate(x, y); g.scale(dir, 1); g.rotate(Math.sin(t * 0.6 + ph) * 0.03);
    const ox = -sp.cx, oy = -sp.cy;
    fl(sp.frontFar, S * 0.3, -S * 0.02, -0.25 - sw * 0.45);
    fl(sp.rearFar, -S * 0.36, S * 0.08, -0.1 + sw * 0.2);
    g.drawImage(sp.c, ox, oy);
    fl(sp.rear, -S * 0.34, S * 0.15, 0.1 - sw * 0.25);
    fl(sp.front, S * 0.24, S * 0.12, 0.1 + sw * 0.5);
    g.restore();
  }

  /* água-viva: sino translúcido (sprite) que pulsa; tentáculos traçados na hora */
  function jellyBell(s) {
    const w = Math.ceil(s * 2.3), h = Math.ceil(s * 1.3), c = mk(w, h), g = c.getContext('2d'), cx = w / 2, by = h * 0.92;
    g.beginPath(); g.moveTo(cx - s, by); g.bezierCurveTo(cx - s, by - s * 1.15, cx + s, by - s * 1.15, cx + s, by); g.quadraticCurveTo(cx, by - s * 0.2, cx - s, by); g.closePath();
    const gr = g.createRadialGradient(cx, by - s * 0.7, s * 0.05, cx, by - s * 0.4, s * 1.1);
    gr.addColorStop(0, 'rgba(255,255,255,0.8)'); gr.addColorStop(0.6, 'rgba(228,236,255,0.45)'); gr.addColorStop(1, 'rgba(205,222,255,0.2)');
    g.fillStyle = gr; g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = Math.max(1, s * 0.05); g.stroke();
    g.strokeStyle = 'rgba(236,140,185,0.6)'; g.lineWidth = Math.max(1, s * 0.09);
    [-0.45, -0.15, 0.15, 0.45].forEach(k => { g.beginPath(); g.arc(cx + k * s, by - s * 0.45, s * 0.13, 0.3, Math.PI * 1.7); g.stroke(); });
    return { c, w, h, cx, by, s };
  }
  const JELLY = jellyBell(26);
  function drawJelly(g, x, y, k, t, ph) {                          // k = escala
    const p = Math.sin(t * 1.7 + ph), s = JELLY.s * k;
    g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 0.8;
    g.beginPath();
    for (let i = 0; i < 7; i++) {
      const tx = x - s * 0.85 + (i / 6) * s * 1.7;
      g.moveTo(tx, y);
      g.quadraticCurveTo(tx + Math.sin(t * 1.2 + i + ph) * s * 0.25, y + s * 0.9, tx + Math.sin(t * 0.9 + i * 1.7 + ph) * s * 0.35, y + s * (1.7 + 0.15 * p));
    }
    g.stroke();
    g.strokeStyle = 'rgba(240,170,205,0.5)'; g.lineWidth = Math.max(1.2, s * 0.1);
    g.beginPath();
    for (let i = 0; i < 4; i++) {
      const tx = x + (i - 1.5) * s * 0.18;
      g.moveTo(tx, y - s * 0.05);
      g.quadraticCurveTo(tx + Math.sin(t * 1.5 + i + ph) * s * 0.2, y + s * 0.5, tx + Math.sin(t + i * 2 + ph) * s * 0.18, y + s * 0.95);
    }
    g.stroke();
    const bw = JELLY.w * k * (1 + 0.07 * p), bh = JELLY.h * k * (1 - 0.09 * p);
    g.drawImage(JELLY.c, x - bw / 2, y - bh * 0.92, bw, bh);
  }

  /* golfinho (voltado para a direita) */
  function dolphinSprite(L) {
    const w = Math.ceil(L * 1.06), h = Math.ceil(L * 0.46), c = mk(w, h), g = c.getContext('2d');
    const X = n => L * 0.03 + n * L, Y = n => h * 0.52 + n * L;
    g.fillStyle = '#5d7182';
    g.beginPath(); g.moveTo(X(0.1), Y(0)); g.lineTo(X(-0.01), Y(-0.075)); g.lineTo(X(0.03), Y(0)); g.lineTo(X(-0.01), Y(0.075)); g.closePath(); g.fill();
    g.beginPath();
    g.moveTo(X(0.08), Y(-0.01));
    g.bezierCurveTo(X(0.3), Y(-0.06), X(0.55), Y(-0.115), X(0.78), Y(-0.09));
    g.bezierCurveTo(X(0.86), Y(-0.08), X(0.9), Y(-0.05), X(0.92), Y(-0.03));
    g.lineTo(X(1), Y(-0.01)); g.lineTo(X(0.99), Y(0.01));
    g.bezierCurveTo(X(0.9), Y(0.035), X(0.8), Y(0.065), X(0.62), Y(0.07));
    g.bezierCurveTo(X(0.4), Y(0.07), X(0.2), Y(0.035), X(0.08), Y(0.01));
    g.closePath();
    const gr = g.createLinearGradient(0, Y(-0.11), 0, Y(0.07));
    gr.addColorStop(0, '#5d7182'); gr.addColorStop(0.5, '#8ea2b1'); gr.addColorStop(0.62, '#dfe7ec'); gr.addColorStop(1, '#f1f5f7');
    g.fillStyle = gr; g.fill();
    g.fillStyle = '#5d7182';
    g.beginPath(); g.moveTo(X(0.52), Y(-0.1)); g.quadraticCurveTo(X(0.47), Y(-0.2), X(0.4), Y(-0.215)); g.quadraticCurveTo(X(0.44), Y(-0.15), X(0.4), Y(-0.085)); g.closePath(); g.fill();
    g.fillStyle = '#6d8292';
    g.beginPath(); g.moveTo(X(0.72), Y(0.05)); g.quadraticCurveTo(X(0.66), Y(0.12), X(0.6), Y(0.14)); g.quadraticCurveTo(X(0.64), Y(0.08), X(0.66), Y(0.055)); g.closePath(); g.fill();
    g.fillStyle = '#1d2830'; g.beginPath(); g.arc(X(0.87), Y(-0.025), Math.max(1, L * 0.009), 0, 7); g.fill();
    return { c, w, h };
  }

  /* baleia-jubarte (ao longe) */
  function whaleSprite(L) {
    const w = Math.ceil(L * 1.1), h = Math.ceil(L * 0.42), c = mk(w, h), g = c.getContext('2d');
    const X = n => L * 0.07 + n * L, Y = n => h * 0.38 + n * L;
    g.fillStyle = '#2b3d4c';                                       // peitoral do lado de lá
    g.beginPath(); g.moveTo(X(0.7), Y(0.06)); g.quadraticCurveTo(X(0.62), Y(0.2), X(0.5), Y(0.25)); g.quadraticCurveTo(X(0.6), Y(0.14), X(0.64), Y(0.07)); g.closePath(); g.fill();
    g.fillStyle = '#34495a';                                       // cauda
    g.beginPath(); g.moveTo(X(0.07), Y(0)); g.lineTo(X(-0.06), Y(-0.075)); g.quadraticCurveTo(X(0), Y(-0.01), X(0), Y(0)); g.quadraticCurveTo(X(0), Y(0.02), X(-0.06), Y(0.075)); g.closePath(); g.fill();
    g.beginPath();
    g.moveTo(X(0.04), Y(-0.01));
    g.bezierCurveTo(X(0.25), Y(-0.05), X(0.5), Y(-0.1), X(0.78), Y(-0.085));
    g.bezierCurveTo(X(0.9), Y(-0.078), X(0.98), Y(-0.05), X(1), Y(-0.015));
    g.bezierCurveTo(X(0.99), Y(0.04), X(0.9), Y(0.095), X(0.7), Y(0.1));
    g.bezierCurveTo(X(0.45), Y(0.1), X(0.2), Y(0.04), X(0.04), Y(0.012));
    g.closePath();
    const gr = g.createLinearGradient(0, Y(-0.1), 0, Y(0.1));
    gr.addColorStop(0, '#2c4052'); gr.addColorStop(0.55, '#4b6378'); gr.addColorStop(0.75, '#a9bcc8'); gr.addColorStop(1, '#cbd8e0');
    g.fillStyle = gr; g.fill();
    g.save(); g.clip();
    g.strokeStyle = 'rgba(60,80,95,0.35)'; g.lineWidth = Math.max(1, L * 0.003);             // pregas da garganta
    for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(X(0.97 - i * 0.004), Y(0.02 + i * 0.012)); g.quadraticCurveTo(X(0.8), Y(0.07 + i * 0.008), X(0.6 - i * 0.01), Y(0.085 + i * 0.004)); g.stroke(); }
    g.restore();
    g.fillStyle = '#2c4052';
    g.beginPath(); g.moveTo(X(0.32), Y(-0.068)); g.quadraticCurveTo(X(0.29), Y(-0.1), X(0.25), Y(-0.1)); g.quadraticCurveTo(X(0.27), Y(-0.08), X(0.24), Y(-0.06)); g.closePath(); g.fill();
    g.fillStyle = 'rgba(30,45,58,0.7)';
    for (let i = 0; i < 7; i++) { g.beginPath(); g.arc(X(0.86 + i * 0.018), Y(-0.07 + i * 0.008), Math.max(1, L * 0.004), 0, 7); g.fill(); }
    const pf = g.createLinearGradient(X(0.72), 0, X(0.42), 0); pf.addColorStop(0, '#5a7285'); pf.addColorStop(1, '#d6e1e8');
    g.fillStyle = pf;                                              // peitoral longa (marca da jubarte)
    g.beginPath(); g.moveTo(X(0.74), Y(0.05)); g.quadraticCurveTo(X(0.62), Y(0.19), X(0.42), Y(0.27)); g.quadraticCurveTo(X(0.58), Y(0.14), X(0.66), Y(0.055)); g.closePath(); g.fill();
    g.fillStyle = '#16222c'; g.beginPath(); g.arc(X(0.84), Y(0.02), Math.max(1, L * 0.006), 0, 7); g.fill();
    return { c, w, h };
  }

  /* submarino à luz do dia (voltado para a direita) */
  function subSprite(L) {
    const pad = L * 0.08, w = Math.ceil(L + pad * 2), h = Math.ceil(L * 0.34), cy = h * 0.64;
    const c = mk(w, h), g = c.getContext('2d');
    const X = n => pad + n * L, Y = n => cy + n * L;
    g.fillStyle = '#23313e';                                       // lemes em cruz
    g.beginPath(); g.moveTo(X(0.03), Y(-0.02)); g.lineTo(X(-0.035), Y(-0.1)); g.lineTo(X(0.07), Y(-0.05)); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(X(0.03), Y(0.02)); g.lineTo(X(-0.035), Y(0.1)); g.lineTo(X(0.07), Y(0.05)); g.closePath(); g.fill();
    g.beginPath();
    g.moveTo(X(0), Y(0));
    g.bezierCurveTo(X(0.02), Y(-0.06), X(0.18), Y(-0.085), X(0.5), Y(-0.085));
    g.bezierCurveTo(X(0.84), Y(-0.085), X(0.97), Y(-0.05), X(1), Y(0));
    g.bezierCurveTo(X(0.97), Y(0.05), X(0.84), Y(0.076), X(0.5), Y(0.076));
    g.bezierCurveTo(X(0.18), Y(0.076), X(0.02), Y(0.05), X(0), Y(0));
    g.closePath();
    const hull = g.createLinearGradient(0, Y(-0.09), 0, Y(0.08));
    hull.addColorStop(0, '#6a8196'); hull.addColorStop(0.35, '#3a4f63'); hull.addColorStop(1, '#17222d');
    g.fillStyle = hull; g.fill();
    g.fillStyle = '#1b2631'; g.fillRect(X(-0.015), Y(-0.032), L * 0.035, L * 0.064);        // pump-jet
    g.beginPath(); g.moveTo(X(0.58), Y(-0.08)); g.lineTo(X(0.6), Y(-0.165)); g.lineTo(X(0.7), Y(-0.165)); g.lineTo(X(0.73), Y(-0.08)); g.closePath();
    const sail = g.createLinearGradient(0, Y(-0.17), 0, Y(-0.08)); sail.addColorStop(0, '#7890a4'); sail.addColorStop(1, '#34485a');
    g.fillStyle = sail; g.fill();
    g.strokeStyle = '#51667a'; g.lineWidth = Math.max(1.2, L * 0.005);
    g.beginPath(); g.moveTo(X(0.64), Y(-0.165)); g.lineTo(X(0.64), Y(-0.205)); g.moveTo(X(0.67), Y(-0.165)); g.lineTo(X(0.67), Y(-0.19)); g.stroke();
    g.fillStyle = '#2c3d4d'; g.fillRect(X(0.82), Y(0), L * 0.06, L * 0.012);
    g.globalCompositeOperation = 'source-atop';                   // sol batendo no dorso
    const hi = g.createLinearGradient(0, Y(-0.09), 0, Y(-0.02));
    hi.addColorStop(0, 'rgba(215,242,255,0.5)'); hi.addColorStop(1, 'rgba(215,242,255,0)');
    g.fillStyle = hi; g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = 'source-over';
    return { c, w, h, cy, pad, L };
  }

  /* mina de contato antiga, tomada por cracas e algas */
  function mineSprite(R) {
    const s = Math.ceil(R * 3), c = mk(s, s), g = c.getContext('2d'), cx = s / 2, cy = s / 2;
    g.lineCap = 'round';
    [-2.7, -2.1, -1.57, -1.04, -0.44, 0.45, 2.7].forEach(a => {                  // chifres de contato
      const x0 = cx + Math.cos(a) * R * 0.8, y0 = cy + Math.sin(a) * R * 0.8, x1 = cx + Math.cos(a) * R * 1.3, y1 = cy + Math.sin(a) * R * 1.3;
      g.strokeStyle = '#4c4035'; g.lineWidth = R * 0.15; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
      g.fillStyle = '#6b5a48'; g.beginPath(); g.arc(x1, y1, R * 0.12, 0, 7); g.fill();
    });
    const gr = g.createRadialGradient(cx - R * 0.35, cy - R * 0.45, R * 0.08, cx, cy, R);
    gr.addColorStop(0, '#9a8468'); gr.addColorStop(0.5, '#5e4c3b'); gr.addColorStop(1, '#2f271f');
    g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, R, 0, 7); g.fill();
    g.strokeStyle = 'rgba(35,28,20,0.6)'; g.lineWidth = Math.max(1, R * 0.06);
    g.beginPath(); g.ellipse(cx, cy, R, R * 0.24, 0, 0, Math.PI); g.stroke();
    g.save(); g.beginPath(); g.arc(cx, cy, R, 0, 7); g.clip();
    const r = seeded(Math.round(R * 97));
    for (let i = 0; i < 16; i++) {                                               // algas e cracas
      const a = r() * 6.28, d = r() * R;
      g.fillStyle = i % 3 ? 'rgba(104,150,80,0.55)' : 'rgba(225,220,200,0.8)';
      g.beginPath(); g.ellipse(cx + Math.cos(a) * d, cy + Math.sin(a) * d, R * (i % 3 ? 0.18 : 0.06), R * (i % 3 ? 0.1 : 0.06), a, 0, 7); g.fill();
    }
    g.restore();
    g.fillStyle = '#3d342b'; g.fillRect(cx - R * 0.12, cy + R * 0.92, R * 0.24, R * 0.2);      // olhal da amarra
    return { c, s, R };
  }

  /* corrente de amarração: elos num sprite; ao desenhar, esmaece em trechos até sumir */
  const CHAIN = (() => {
    const w = 12, len = 900, c = mk(w, len), g = c.getContext('2d');
    for (let y = 0, i = 0; y < len; y += 7, i++) {
      if (i % 2) { g.strokeStyle = '#3f3b36'; g.lineWidth = 2; g.beginPath(); g.ellipse(w / 2, y + 3.5, 2.6, 4.2, 0, 0, 7); g.stroke(); }
      else { g.fillStyle = '#4f4a44'; g.fillRect(w / 2 - 1.1, y, 2.2, 7); }
    }
    return c;
  })();
  function drawChain(g, x, y, len, rot, k, alpha) {
    g.save(); g.translate(x, y); g.rotate(rot);
    const n = 4, sh = len / n, src = Math.min(CHAIN.height, sh / k);
    for (let i = 0; i < n; i++) {
      g.globalAlpha = alpha * Math.pow(1 - i / n, 1.3);
      g.drawImage(CHAIN, 0, 0, 12, src, -6 * k, i * sh, 12 * k, sh);
    }
    g.restore();
  }

  /* robô caça-minas (ROV), voltado para a direita */
  function rovSprite(L) {
    const w = Math.ceil(L * 1.2), h = Math.ceil(L * 0.75), c = mk(w, h), g = c.getContext('2d');
    const ox = L * 0.1, oy = h * 0.52;
    g.fillStyle = '#3a3f45'; rrect(g, ox - L * 0.08, oy - L * 0.1, L * 0.12, L * 0.2, L * 0.03); g.fill();          // propulsor
    const gr = g.createLinearGradient(0, oy - L * 0.24, 0, oy + L * 0.22); gr.addColorStop(0, '#ffdc55'); gr.addColorStop(1, '#df9500');
    g.fillStyle = gr; rrect(g, ox, oy - L * 0.22, L * 0.8, L * 0.42, L * 0.12); g.fill();                                // corpo
    g.fillStyle = '#2a2d31'; g.fillRect(ox + L * 0.06, oy + L * 0.1, L * 0.66, L * 0.05);
    g.fillStyle = '#f7f1dc'; rrect(g, ox + L * 0.12, oy - L * 0.3, L * 0.5, L * 0.1, L * 0.05); g.fill();              // flutuador
    g.fillStyle = '#1d2024'; g.beginPath(); g.arc(ox + L * 0.82, oy - L * 0.02, L * 0.12, 0, 7); g.fill();                // câmera/sonar
    g.fillStyle = 'rgba(120,205,255,0.9)'; g.beginPath(); g.arc(ox + L * 0.85, oy - L * 0.05, L * 0.04, 0, 7); g.fill();
    g.fillStyle = '#fffbe0'; g.beginPath(); g.arc(ox + L * 0.74, oy - L * 0.16, L * 0.045, 0, 7); g.fill();               // farol
    return { c, w, h, lx: ox + L * 0.74 - w / 2, ly: oy - L * 0.16 - h / 2, topY: oy - L * 0.3 - h / 2 };
  }

  /* casco de navio visto de baixo, na superfície */
  function keelSprite(len) {
    const h = Math.ceil(len * 0.1), c = mk(len, h), g = c.getContext('2d');
    g.beginPath(); g.moveTo(0, h * 0.15);
    g.quadraticCurveTo(len * 0.05, h * 0.95, len * 0.2, h * 0.92); g.lineTo(len * 0.82, h * 0.92);
    g.quadraticCurveTo(len * 0.97, h * 0.88, len, h * 0.15); g.closePath();
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(22,48,74,0.55)'); gr.addColorStop(1, 'rgba(22,48,74,0.85)');
    g.fillStyle = gr; g.fill();
    return c;
  }

  /* raia-manta (desenhada na hora: as asas batem) */
  function drawManta(g, x, y, L, dir, t, ph) {
    const f = Math.sin(t * 1.3 + ph), span = L * 0.55;
    g.save(); g.translate(x, y); g.scale(dir, 1);
    g.strokeStyle = '#2d3c48'; g.lineWidth = Math.max(1, L * 0.012);
    g.beginPath(); g.moveTo(-L * 0.28, 0); g.quadraticCurveTo(-L * 0.45, Math.sin(t * 1.3 + ph - 1) * L * 0.03, -L * 0.62, Math.sin(t * 1.3 + ph - 2) * L * 0.05); g.stroke();
    g.fillStyle = '#2f3f4c';
    g.beginPath();
    g.moveTo(L * 0.42, 0);
    g.quadraticCurveTo(L * 0.12, -span * (0.3 + 0.2 * f), -L * 0.04, -span * (0.85 + 0.35 * f));
    g.quadraticCurveTo(-L * 0.1, -span * 0.25, -L * 0.3, 0);
    g.quadraticCurveTo(-L * 0.1, span * 0.18, -L * 0.04, span * (0.4 - 0.15 * f));
    g.quadraticCurveTo(L * 0.12, span * 0.16, L * 0.42, 0);
    g.fill();
    g.fillStyle = 'rgba(235,240,242,0.85)';
    g.beginPath(); g.ellipse(L * 0.1, -span * 0.12, L * 0.08, span * 0.07, -0.4, 0, 7); g.fill();
    g.fillStyle = '#2f3f4c';
    g.beginPath(); g.moveTo(L * 0.4, -L * 0.03); g.lineTo(L * 0.5, -L * 0.06); g.lineTo(L * 0.42, 0); g.closePath(); g.fill();
    g.restore();
  }

  /* ── corais e habitantes do leito (sprites pequenos, reaproveitados) ── */
  function coralTuft(size, col, seed) {                       // colônia ramificada (chifre-de-veado)
    const c = mk(size * 1.3, size * 1.1), g = c.getContext('2d'), r = seeded(seed);
    g.lineCap = 'round';
    const br = (x, y, a, len, w, depth) => {
      const x2 = x + Math.cos(a) * len, y2 = y + Math.sin(a) * len;
      g.strokeStyle = col[0]; g.lineWidth = w; g.beginPath(); g.moveTo(x, y); g.lineTo(x2, y2); g.stroke();
      if (depth <= 0) { g.fillStyle = col[1]; g.beginPath(); g.arc(x2, y2, Math.max(1, w * 0.8), 0, 7); g.fill(); return; }
      const n = r() < 0.35 ? 3 : 2;
      for (let i = 0; i < n; i++) br(x2, y2, a + (i - (n - 1) / 2) * (0.5 + r() * 0.4), len * (0.66 + r() * 0.18), w * 0.74, depth - 1);
    };
    for (let i = 0; i < 3; i++) br(c.width / 2 + (r() - 0.5) * size * 0.35, c.height - 1, -Math.PI / 2 + (r() - 0.5) * 0.8, size * 0.26, Math.max(1.5, size * 0.075), 4);
    return c;
  }
  function brainCoral(size, col, seed) {                      // coral-cérebro
    const w = Math.ceil(size), h = Math.ceil(size * 0.6), c = mk(w, h), g = c.getContext('2d'), r = seeded(seed);
    g.beginPath(); g.ellipse(w / 2, h, w / 2, h, 0, Math.PI, 0); g.closePath();
    const gr = g.createRadialGradient(w * 0.42, h * 0.35, 1, w / 2, h * 0.8, w * 0.62);
    gr.addColorStop(0, col[0]); gr.addColorStop(1, col[1]);
    g.fillStyle = gr; g.fill();
    g.save(); g.clip();
    g.strokeStyle = col[2]; g.lineWidth = Math.max(1, size * 0.03);
    for (let i = 0; i < 11; i++) {
      let x = r() * w, y = h * (0.15 + r() * 0.85);
      g.beginPath(); g.moveTo(x, y);
      for (let k = 0; k < 6; k++) { const nx = x + (r() - 0.5) * size * 0.28, ny = y + (r() - 0.5) * size * 0.12; g.quadraticCurveTo((x + nx) / 2 + (r() - 0.5) * size * 0.1, (y + ny) / 2 - size * 0.05, nx, ny); x = nx; y = ny; }
      g.stroke();
    }
    g.restore();
    return c;
  }
  function seaFan(size, col, seed) {                          // gorgônia (leque-do-mar)
    const w = Math.ceil(size), c = mk(w, w), g = c.getContext('2d'), r = seeded(seed), bx = w / 2, by = w;
    g.strokeStyle = col; g.lineCap = 'round';
    for (let i = 0; i < 11; i++) {
      const a = -Math.PI / 2 + (i - 5) * 0.14 + (r() - 0.5) * 0.08, len = size * (0.72 + r() * 0.22);
      g.lineWidth = Math.max(1, size * 0.02);
      g.beginPath(); g.moveTo(bx, by);
      g.quadraticCurveTo(bx + Math.cos(a) * len * 0.5 + (r() - 0.5) * 6, by + Math.sin(a) * len * 0.5, bx + Math.cos(a) * len, by + Math.sin(a) * len);
      g.stroke();
    }
    g.lineWidth = Math.max(0.6, size * 0.009); g.globalAlpha = 0.85;
    for (let k = 2; k < 9; k++) { g.beginPath(); g.arc(bx, by, size * 0.1 * k, -Math.PI / 2 - 0.78, -Math.PI / 2 + 0.78); g.stroke(); }
    return c;
  }
  function sponge(size, col, seed) {                          // esponjas-tubo
    const w = Math.ceil(size), h = Math.ceil(size * 1.1), c = mk(w, h), g = c.getContext('2d'), r = seeded(seed);
    const n = 3 + ((r() * 3) | 0);
    for (let i = 0; i < n; i++) {
      const tw = size * (0.16 + r() * 0.08), th = size * (0.45 + r() * 0.55), x = size * 0.12 + r() * (size * 0.74 - tw), y = h - th;
      const gr = g.createLinearGradient(x, 0, x + tw, 0); gr.addColorStop(0, col[1]); gr.addColorStop(0.45, col[0]); gr.addColorStop(1, col[1]);
      g.fillStyle = gr; rrect(g, x, y, tw, th, tw * 0.45); g.fill();
      g.fillStyle = col[2]; g.beginPath(); g.ellipse(x + tw / 2, y + tw * 0.3, tw * 0.34, tw * 0.15, 0, 0, 7); g.fill();
    }
    return c;
  }
  function starfish(size, col) {
    const c = mk(size, size), g = c.getContext('2d'), cx = size / 2, cy = size / 2;
    g.beginPath();
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? size * 0.19 : size * 0.48; g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
    g.closePath(); g.fillStyle = col; g.fill();
    g.fillStyle = 'rgba(255,236,200,0.7)';
    for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * Math.PI * 0.4; g.beginPath(); g.arc(cx + Math.cos(a) * size * 0.25, cy + Math.sin(a) * size * 0.25, size * 0.04, 0, 7); g.fill(); }
    return c;
  }
  function urchin(size) {
    const c = mk(size, size), g = c.getContext('2d'), cx = size / 2, cy = size * 0.6;
    g.strokeStyle = '#2a1f33'; g.lineWidth = 1; g.beginPath();
    for (let i = 0; i < 22; i++) { const a = Math.PI + (i / 21) * Math.PI; g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * size * 0.5, cy + Math.sin(a) * size * 0.55); }
    g.stroke();
    g.fillStyle = '#3b2a48'; g.beginPath(); g.ellipse(cx, cy, size * 0.22, size * 0.17, 0, 0, 7); g.fill();
    return c;
  }

  const CORAL_COLS = [['#ef7f55', '#ffc9a3'], ['#e0607e', '#ffc0d0'], ['#9c6fd6', '#e5d4ff'], ['#e9b949', '#fff0b0'], ['#4fbf9b', '#c8f5e6']];
  const TUFTS   = CORAL_COLS.map((c, i) => coralTuft(64, c, 101 + i * 7)).concat(CORAL_COLS.map((c, i) => coralTuft(48, c, 303 + i * 11)));
  const BRAINS  = [brainCoral(70, ['#f3d98a', '#b98b3a', 'rgba(120,80,30,0.45)'], 7), brainCoral(58, ['#a8d98f', '#5a8f48', 'rgba(40,80,40,0.4)'], 9), brainCoral(64, ['#f0b0a0', '#b8645a', 'rgba(110,40,40,0.4)'], 13)];
  const FANS    = [seaFan(92, '#b8467e', 3), seaFan(80, '#7d4bb5', 5), seaFan(70, '#e0703f', 8)];
  const SPONGES = [sponge(60, ['#f28c38', '#c05f18', '#6b2f0a'], 1), sponge(54, ['#b066d6', '#7d3aa6', '#3e1a56'], 2), sponge(50, ['#f2d04a', '#c79d18', '#6b520a'], 3)];
  const STARS   = [starfish(28, '#f26b3a'), starfish(24, '#e84f6a'), starfish(22, '#f4a340')];
  const URCHIN  = urchin(26);

  /* cáusticas: rede de luz do sol no fundo (ruído celular, ladrilho contínuo) */
  const CAUSTIC = (() => {
    const N = 128, c = mk(N, N), g = c.getContext('2d'), img = g.createImageData(N, N), d = img.data;
    const r = seeded(4242), P = Array.from({ length: 16 }, () => [r() * N, r() * N]);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      let f1 = 1e9, f2 = 1e9;
      for (const [px, py] of P) {
        let dx = Math.abs(x - px), dy = Math.abs(y - py);
        if (dx > N / 2) dx = N - dx;
        if (dy > N / 2) dy = N - dy;
        const dd = dx * dx + dy * dy;
        if (dd < f1) { f2 = f1; f1 = dd; } else if (dd < f2) f2 = dd;
      }
      const v = Math.pow(clamp(1 - (Math.sqrt(f2) - Math.sqrt(f1)) / 7, 0, 1), 3);
      const i = (y * N + x) * 4;
      d[i] = 255; d[i + 1] = 252; d[i + 2] = 226; d[i + 3] = v * 255;
    }
    g.putImageData(img, 0, 0);
    return c;
  })();

  /* ═════════════════════════ 1) MAR CALMO (canvas fixo) ═════════════════════════ */
  const Gauge = (function () {
    const el = $('calm-gauge'), val = $('calm-value'), zone = $('calm-zone'), marker = $('calm-marker');
    const track = el && el.querySelector('.calm-gauge__track');
    if (!el) return { update() {}, measure() {} };
    // mergulho recreativo: até ~40 m, onde vivem os recifes de naufrágio iluminados pelo sol
    const MAX_M = 40;
    const ZONES = [[0, 'Superfície'], [2, 'Águas rasas'], [12, 'Mar aberto'], [30, 'Recife de coral']];
    let lastM = -1, lastZone = '', trackW = 170, on = false;
    return {
      measure() { trackW = track ? track.clientWidth : 170; },
      update(d, show) {
        if (show !== on) { on = show; el.classList.toggle('is-on', show); }
        if (!show) return;
        const m = Math.round(d * MAX_M);
        if (m !== lastM) {
          lastM = m;
          val.textContent = m + ' m';
          let z = ZONES[0][1]; for (const zz of ZONES) if (m >= zz[0]) z = zz[1];
          if (z !== lastZone) { lastZone = z; zone.textContent = z; }
        }
        marker.style.transform = `translate3d(${(d * trackW).toFixed(1)}px, 0, 0)`;
      },
    };
  })();

  (function calm() {
    const canvas = $('calm-canvas'), heroEl = $('hero');
    const ctx = canvas.getContext('2d', { alpha: false });
    const SC = 0.5;                                        // resolução do fundo (barato e suave)
    let cssW = 1, cssH = 1, docH = 1, heroH = 1, raf = 0, last = 0, t = 0;

    // cor da água por profundidade: sempre clara e ensolarada, só ganha azul ao descer
    const STOPS = [[0, [190, 238, 247]], [0.2, [150, 222, 240]], [0.45, [112, 202, 232]], [0.7, [86, 184, 224]], [0.9, [74, 172, 218]], [1, [70, 168, 214]]];
    function colAt(d) {
      for (let i = 1; i < STOPS.length; i++) {
        if (d <= STOPS[i][0]) {
          const a = STOPS[i - 1], b = STOPS[i], k = (d - a[0]) / (b[0] - a[0] || 1);
          return `rgb(${(a[1][0] + (b[1][0] - a[1][0]) * k) | 0},${(a[1][1] + (b[1][1] - a[1][1]) * k) | 0},${(a[1][2] + (b[1][2] - a[1][2]) * k) | 0})`;
        }
      }
      return 'rgb(70,168,214)';
    }
    const dAt = y => clamp((y - heroH) / Math.max(1, docH - heroH), 0, 1);

    const SHARK_S = sharkSprites(190), TURTLE_S = turtleSprites(74), WHALE_S = whaleSprite(560), DOLPHIN_S = dolphinSprite(120), SUB_S = subSprite(320), MINE_S = mineSprite(22);

    const motes = Array.from({ length: 80 }, () => ({ x: Math.random(), y: Math.random(), s: 1 + Math.random() * 1.8, par: 0.15 + Math.random() * 0.7, v: 3 + Math.random() * 7, ph: Math.random() * 6.28 }));
    const bubbles = Array.from({ length: 30 }, () => ({ x: Math.random(), y: Math.random(), r: 1.5 + Math.random() * 3.2, par: 0.3 + Math.random() * 0.6, sp: 18 + Math.random() * 30, ph: Math.random() * 6.28 }));
    const shoals = [0.05, 0.16, 0.31, 0.49, 0.67, 0.86].map((yf, i) => ({
      yf, dir: i % 2 ? -1 : 1, sp: 26 + (i % 3) * 9, ph: Math.random() * 900,
      fish: Array.from({ length: 10 }, () => ({ ox: rnd(-80, 80), oy: rnd(-26, 26), w: rnd(0.8, 1.3), p: Math.random() * 6.28 })),
    }));
    const jellies = [0.07, 0.11, 0.24, 0.37, 0.58, 0.8].map(yf => ({ yf, x: Math.random(), k: rnd(0.7, 1.25), ph: Math.random() * 6.28, sp: rnd(4, 9) }));
    const turtles = [{ yf: 0.13, dir: 1, sp: 24, ph: 1 }, { yf: 0.62, dir: -1, sp: 20, ph: 4 }];
    const sharks = [{ yf: 0.39, dir: 1, sp: 44, ph: 0.5, k: 0.9 }, { yf: 0.76, dir: -1, sp: 36, ph: 2.1, k: 1.1 }];
    const whale = { yf: 0.28, dir: -1, sp: 12, ph: 300 };
    const sub = { yf: 0.53, dir: 1, sp: 18, ph: 100 };
    const manta = { yf: 0.88, dir: 1, sp: 26, ph: 700 };
    const dolphins = { yf: 0.006, dir: -1, sp: 150, ph: 0 };
    const mines = [{ yf: 0.21, fx: 0.06, ph: 0 }, { yf: 0.45, fx: 0.94, ph: 2 }, { yf: 0.72, fx: 0.05, ph: 4 }];

    function measure() {
      cssW = window.innerWidth; cssH = window.innerHeight;
      const W = Math.max(2, Math.round(cssW * SC)), H = Math.max(2, Math.round(cssH * SC));
      if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
      docH = Math.max(document.documentElement.scrollHeight, cssH + 1);
      heroH = heroEl ? heroEl.offsetHeight : cssH;
      Gauge.measure();
    }

    const yOf = (yf, par) => heroH + yf * (docH - heroH) - window.scrollY * par;   // posição na tela (paralaxe)
    const xOf = (o, span) => mod(t * o.sp * o.dir + o.ph, cssW + span) - span / 2;

    function draw(dt) {
      const sy = window.scrollY, d0 = dAt(sy), d1 = dAt(sy + cssH);
      const H = canvas.height, W = canvas.width;
      const g = ctx.createLinearGradient(0, 0, 0, H);
      for (let i = 0; i <= 4; i++) g.addColorStop(i / 4, colAt(d0 + (d1 - d0) * (i / 4)));
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

      ctx.save();
      ctx.scale(SC, SC);
      const q = level();
      const top = heroH - sy;                               // linha d'água (base do hero) na tela

      // ── feixes de sol: presentes em todo o mergulho, mais fracos no fundo ──
      if (q > 0) {
        ctx.globalCompositeOperation = 'lighter';
        const sw = cssW * 0.32, sh = cssH * 1.6, y0 = Math.max(-40, top - 10);
        [0.12, 0.38, 0.63, 0.88].forEach((fx, i) => {
          ctx.globalAlpha = (0.2 - 0.1 * d0) * (0.7 + 0.3 * Math.sin(t * 0.45 + i * 1.7));
          ctx.drawImage(SHAFT, cssW * fx - sw / 2 + Math.sin(t * 0.22 + i) * 34, y0, sw, sh);
        });
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
      }

      // ── superfície vista de baixo: faixa clara ondulando ──
      if (top > -80 && top < cssH + 40) {
        const wg = ctx.createLinearGradient(0, top, 0, top + 110);
        wg.addColorStop(0, 'rgba(255,255,255,0.75)'); wg.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = wg;
        ctx.beginPath(); ctx.moveTo(0, top);
        for (let x = 0; x <= cssW + 20; x += 20) ctx.lineTo(x, top + 6 + Math.sin(x * 0.02 + t * 1.3) * 5 + Math.sin(x * 0.047 - t) * 3);
        ctx.lineTo(cssW, top + 110); ctx.lineTo(0, top + 110); ctx.closePath(); ctx.fill();
      }

      // ── ao longe (mais apagados pela água): baleia e submarino ──
      let yy = yOf(whale.yf, 0.85);
      if (yy > -200 && yy < cssH + 200) {
        const x = xOf(whale, WHALE_S.w + 300);
        ctx.save(); ctx.globalAlpha = 0.34; ctx.translate(x, yy); ctx.scale(whale.dir, 1); ctx.rotate(Math.sin(t * 0.3) * 0.02);
        ctx.drawImage(WHALE_S.c, -WHALE_S.w / 2, -WHALE_S.h / 2); ctx.restore();
      }
      yy = yOf(sub.yf, 0.87);
      if (yy > -120 && yy < cssH + 120) {
        const x = xOf(sub, SUB_S.w + 400);
        ctx.save(); ctx.globalAlpha = 0.4; ctx.translate(x, yy); ctx.scale(sub.dir, 1);
        ctx.drawImage(SUB_S.c, -SUB_S.w / 2, -SUB_S.cy); ctx.restore();
      }

      // ── minas antigas ancoradas (nas margens), com a corrente descendo ──
      mines.forEach(m => {
        const y = yOf(m.yf, 0.9) + Math.sin(t * 0.7 + m.ph) * 3;
        if (y < -120 || y > cssH + 60) return;
        const x = m.fx * cssW + Math.sin(t * 0.5 + m.ph) * 5, R = MINE_S.R;
        drawChain(ctx, x, y + R * 1.05, Math.min(900, cssH + 200 - y), Math.sin(t * 0.5 + m.ph) * 0.012, 1, 0.85);
        ctx.globalAlpha = 0.85;
        ctx.drawImage(MINE_S.c, x - MINE_S.s / 2, y - MINE_S.s / 2);
        ctx.globalAlpha = 1;
      });

      // ── tubarões e tartarugas ──
      sharks.forEach(s => {
        const y = yOf(s.yf, 0.9) + Math.sin(t * 0.4 + s.ph) * 10;
        if (y < -100 || y > cssH + 100) return;
        ctx.globalAlpha = 0.85;
        ctx.save(); ctx.translate(xOf(s, 460), y); ctx.scale(s.k, s.k);
        drawShark(ctx, SHARK_S, 0, 0, s.dir, t, s.ph); ctx.restore();
        ctx.globalAlpha = 1;
      });
      turtles.forEach(o => {
        const y = yOf(o.yf, 0.92) + Math.sin(t * 0.5 + o.ph) * 8;
        if (y < -90 || y > cssH + 90) return;
        drawTurtle(ctx, TURTLE_S, xOf(o, 300), y, o.dir, t, o.ph);
      });

      // ── golfinhos logo abaixo da superfície ──
      if (top > -260 && top < cssH) {
        const bx = xOf(dolphins, 900);
        for (let i = 0; i < 3; i++) {
          const x = bx + i * 70 * -dolphins.dir, ph = t * 2.2 + i * 1.3;
          const y = top + 70 + i * 16 + Math.sin(ph) * 14;
          ctx.save(); ctx.translate(x, y); ctx.scale(dolphins.dir, 1); ctx.rotate(-Math.cos(ph) * 0.18);
          ctx.drawImage(DOLPHIN_S.c, -DOLPHIN_S.w / 2, -DOLPHIN_S.h / 2); ctx.restore();
        }
      }

      // ── cardumes ──
      if (q > 0) {
        shoals.forEach(sh => {
          const y = yOf(sh.yf, 0.92);
          if (y < -50 || y > cssH + 50) return;
          const cx = mod(t * sh.sp * sh.dir + sh.ph, cssW + 340) - 170;
          const spr = sh.dir > 0 ? FISH.r : FISH.l;
          ctx.globalAlpha = 0.9;
          sh.fish.forEach(f => ctx.drawImage(spr, cx + f.ox, y + f.oy + Math.sin(t * 3 + f.p) * 3, 32 * f.w, 14 * f.w));
        });
        ctx.globalAlpha = 1;
      }

      // ── águas-vivas (sobem devagar, pulsando) ──
      jellies.forEach(j => {
        const y = yOf(j.yf, 0.95) - mod(t * j.sp, 160) + 80;
        if (y < -80 || y > cssH + 80) return;
        drawJelly(ctx, mod(j.x * cssW + Math.sin(t * 0.3 + j.ph) * 30, cssW), y, j.k, t, j.ph);
      });

      // ── raia-manta perto do fundo ──
      yy = yOf(manta.yf, 0.92) + Math.sin(t * 0.5) * 12;
      if (yy > -100 && yy < cssH + 100) { ctx.globalAlpha = 0.8; drawManta(ctx, xOf(manta, 400), yy, 170, manta.dir, t, 0); ctx.globalAlpha = 1; }

      // ── plâncton iluminado e bolhas ──
      ctx.fillStyle = 'rgba(255,255,255,1)';
      const ns = Math.round(motes.length * [0.4, 0.7, 1][q]);
      ctx.globalAlpha = 0.55;
      for (let i = 0; i < ns; i++) {
        const p = motes[i];
        const y = mod(p.y * cssH - sy * p.par + t * p.v, cssH + 20) - 10;
        ctx.fillRect(mod(p.x * cssW + Math.sin(t * 0.4 + p.ph) * 6, cssW), y, p.s, p.s);
      }
      ctx.globalAlpha = 1;
      ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1;
      ctx.beginPath();
      const nb = Math.round(bubbles.length * [0.4, 0.7, 1][q]);
      for (let i = 0; i < nb; i++) {
        const b = bubbles[i];
        const y = mod(b.y * cssH - sy * b.par - t * b.sp, cssH + 40) - 20;
        const x = b.x * cssW + Math.sin(t * 1.2 + b.ph) * 7;
        ctx.moveTo(x + b.r, y); ctx.arc(x, y, b.r, 0, 7);
      }
      ctx.stroke();

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
      const want = isLight() && !document.hidden && window.scrollY > 2;
      if (REDUCED) { if (isLight()) staticDraw(); return; }
      if (want && !raf) { last = performance.now(); raf = requestAnimationFrame(frame); }
      else if (!want && raf) { cancelAnimationFrame(raf); raf = 0; }
    }

    function remeasure() {
      if (!isLight()) { sync(); return; }                  // no modo escuro este fundo nem mede o layout
      measure(); sync();
      if (REDUCED) staticDraw();
    }

    window.addEventListener('scroll', sync, { passive: true });
    window.addEventListener('resize', remeasure);
    new ResizeObserver(remeasure).observe(document.body);
    document.addEventListener('visibilitychange', sync);
    document.addEventListener('rn:themechange', () => requestAnimationFrame(remeasure));
    if (isLight()) measure();
    sync();
  })();

  /* ═════════════════ utilitário: canvas de faixa com visibilidade ═════════════════ */
  function band(canvasId, onResize, onFrame) {
    const canvas = $(canvasId);
    if (!canvas) return null;
    const box = canvas.parentElement;
    const ctx = canvas.getContext('2d');
    let W = 0, H = 0, raf = 0, last = 0, t = 0, visible = false;

    function resize() {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      if (!w || !h) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 1.25);
      if (w !== W || h !== H || canvas.width !== Math.round(w * dpr)) {    // só remonta a cena se o tamanho mudou
        W = w; H = h;
        canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        onResize(ctx, W, H, dpr);
      }
      if (!raf) { ctx.clearRect(0, 0, W, H); onFrame(ctx, 0, t); }
    }
    function frame(now) {
      raf = requestAnimationFrame(frame);
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now; t += dt;
      onFrame(ctx, dt, t);
    }
    function sync() {
      const want = isLight() && visible && !document.hidden && !REDUCED;
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

  /* bolhas em pool (cada faixa tem o seu) */
  function bubblePool(n) {
    const P = Array.from({ length: n }, () => ({ a: 0, x: 0, y: 0, vx: 0, vy: 0, r: 2, life: 1, max: 1 }));
    let i = 0;
    return {
      add(x, y, vx, vy, r, life) {
        for (let k = 0; k < n; k++) { i = (i + 1) % n; const b = P[i]; if (!b.a) { b.a = 1; b.x = x; b.y = y; b.vx = vx; b.vy = vy; b.r = r; b.life = b.max = life; return; } }
      },
      step(g, dt, t) {
        g.strokeStyle = 'rgba(255,255,255,0.75)'; g.lineWidth = 1; g.beginPath();
        for (const b of P) {
          if (!b.a) continue;
          b.life -= dt; if (b.life <= 0) { b.a = 0; continue; }
          b.x += b.vx * dt + Math.sin(t * 2 + b.y * 0.04) * 0.2; b.y += b.vy * dt; b.vx *= 1 - 0.8 * dt;
          const r = b.r * (0.6 + 0.4 * (b.life / b.max));
          g.moveTo(b.x + r, b.y); g.arc(b.x, b.y, r, 0, 7);
        }
        g.stroke();
      },
      clear() { P.forEach(b => (b.a = 0)); },
    };
  }

  /* As faixas não desenham feixes de sol próprios: os do fundo fixo já passam por trás delas
     (desenhar de novo dobrava o custo e criava uma emenda clara na borda de cada faixa). */

  /* ═════════════════════════ 2) MAR EM PAZ (patrulha) ═════════════════════════ */
  (function patrol() {
    let W = 0, H = 0, S = 1;
    let SUB = null, SUB_FAR = null, MINE = null, ROV = null, KEEL = null, SHARK = null, SHARK_SM = null, TURTLE = null;
    let mines = [];
    const bub = bubblePool(150);
    const pings = Array.from({ length: 5 }, () => ({ a: 0, x: 0, y: 0, t: 0 }));
    const sub = { x: 0, ping: 2, acc: 0 };
    const rov = { i: 0, x: 0, y: 0, fx: 0, fy: 0, move: 0, hold: 0 };
    const hulls = [{ fx: 0.1, sp: 0.012, len: 0.34 }, { fx: 0.62, sp: 0.012, len: 0.26 }];
    const sharks = [{ y: 0.37, dir: -1, sp: 0.03, ph: 0.3 }, { y: 0.88, dir: 1, sp: 0.024, ph: 400 }];
    const turtle = { y: 0.47, dir: 1, sp: 0.016, ph: 120 };
    const shoals = [0.44, 0.6].map((y, i) => ({ y, dir: i ? -1 : 1, sp: 30 + i * 12, ph: Math.random() * 900, fish: Array.from({ length: 12 }, () => ({ ox: rnd(-90, 90), oy: rnd(-28, 28), w: rnd(0.85, 1.3), p: Math.random() * 6.28 })) }));
    const jellies = Array.from({ length: 3 }, (_, i) => ({ x: 0.2 + i * 0.3, y: Math.random(), k: rnd(0.8, 1.2), ph: i * 2 }));
    const motes = Array.from({ length: 50 }, () => ({ x: Math.random(), y: Math.random(), s: 1 + Math.random() * 1.6, v: 3 + Math.random() * 8, ph: Math.random() * 6.28 }));

    band('patrol-canvas', (ctx, w, h) => {
      W = w; H = h; S = clamp(W / 1366, 0.6, 1.3);
      const L = clamp(W * 0.3, 210, 440);
      SUB = subSprite(L); SUB_FAR = subSprite(L * 0.5);
      MINE = mineSprite(24 * S); ROV = rovSprite(64 * S); KEEL = keelSprite(Math.round(W * 0.34));
      SHARK = sharkSprites(250 * S); SHARK_SM = sharkSprites(160 * S); TURTLE = turtleSprites(82 * S);
      // minas antigas: posição (fração da faixa), fase do balanço e a marca do robô
      mines = [[0.09, 0.55], [0.29, 0.8], [0.52, 0.5], [0.74, 0.78], [0.93, 0.52]].map(([fx, fy], i) => ({ fx, fy, ph: i * 1.7, tag: 0 }));
      sub.x = W * 0.2;
      rov.i = 3; rov.x = mines[3].fx * W - 90 * S; rov.y = mines[3].fy * H - 40 * S; rov.hold = 3;
      bub.clear(); pings.forEach(p => (p.a = 0));
    }, (ctx, dt, t) => {
      if (!W) return;
      const q = level();
      ctx.clearRect(0, 0, W, H);

      // superfície: cascos do comboio passando lá em cima, com a esteira de bolhas das hélices
      const sg = ctx.createLinearGradient(0, 0, 0, H * 0.14);
      sg.addColorStop(0, 'rgba(255,255,255,0.55)'); sg.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = sg; ctx.fillRect(0, 0, W, H * 0.14);
      hulls.forEach((hl, i) => {
        const len = W * hl.len, x = mod(hl.fx * W + t * hl.sp * W, W + len * 2) - len;
        ctx.drawImage(KEEL, x, -KEEL.height * 0.25, len, KEEL.height);
        if (q > 0 && Math.random() < dt * 10) bub.add(x + rnd(0, 12), KEEL.height * 0.6, rnd(-20, -5), rnd(8, 24) * S, rnd(1.4, 3) * S, rnd(1, 2));
      });

      // submarino ao longe, no sentido oposto
      const fx = mod(W * 0.9 - t * W * 0.012, W + SUB_FAR.w * 2) - SUB_FAR.w;
      ctx.globalAlpha = 0.4; ctx.save(); ctx.translate(fx, H * 0.34); ctx.scale(-1, 1); ctx.drawImage(SUB_FAR.c, -SUB_FAR.w / 2, -SUB_FAR.cy); ctx.restore(); ctx.globalAlpha = 1;

      // tartaruga
      drawTurtle(ctx, TURTLE, mod(turtle.ph + t * turtle.sp * W, W + TURTLE.w * 2) - TURTLE.w, H * turtle.y + Math.sin(t * 0.5) * 8 * S, turtle.dir, t, 1);

      // minas: corrente até o fundo, balanço lento e a marca verde de "inspecionada"
      mines.forEach(m => {
        const x = m.fx * W + Math.sin(t * 0.5 + m.ph) * 5 * S, y = m.fy * H + Math.sin(t * 0.7 + m.ph) * 3 * S;
        m.x = x; m.y = y;
        const R = MINE.R;
        drawChain(ctx, x, y + R * 1.05, H - y - R * 1.05, Math.sin(t * 0.5 + m.ph) * 0.015, S, 1);
        ctx.globalAlpha = 1;
        ctx.drawImage(MINE.c, x - MINE.s / 2, y - MINE.s / 2);
        if (m.tag > 0) {
          m.tag -= dt;
          const k = Math.max(0, Math.sin(t * 4)) ** 4;
          ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.35 + 0.65 * k;
          const r = 26 * S; ctx.drawImage(GL_GREEN, x + R * 0.55 - r / 2, y - R * 0.7 - r / 2, r, r);
          ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
          ctx.fillStyle = '#9dffb8'; ctx.fillRect(x + R * 0.55 - 1.5, y - R * 0.7 - 1.5, 3, 3);
        }
      });

      // robô caça-minas: vai de mina em mina, ilumina e deixa a marca
      const tgt = mines[rov.i];
      const wantX = tgt.x - 95 * S, wantY = tgt.y - 30 * S;
      if (rov.hold > 0) {
        rov.hold -= dt;
        if (rov.hold < 1.2 && tgt.tag <= 0) tgt.tag = 14;
        if (rov.hold <= 0) { rov.i = (rov.i + 1 + ((Math.random() * 2) | 0)) % mines.length; rov.move = 1; }
      }
      const k = 1 - Math.exp(-(rov.move ? 0.9 : 3) * dt);
      rov.x += (wantX - rov.x) * k; rov.y += (wantY - rov.y) * k;
      if (rov.move && Math.abs(wantX - rov.x) < 6 && Math.abs(wantY - rov.y) < 6) { rov.move = 0; rov.hold = rnd(5, 7); }
      const bob = Math.sin(t * 1.6) * 3 * S, rx = rov.x, ry = rov.y + bob;
      const dir = tgt.x >= rx ? 1 : -1;
      ctx.strokeStyle = 'rgba(245,190,40,0.8)'; ctx.lineWidth = 1.4;                       // cabo umbilical até a superfície
      ctx.beginPath(); ctx.moveTo(rx, ry + ROV.topY); ctx.quadraticCurveTo(rx - 60 * S * dir, ry * 0.45, rx - 120 * S * dir, -10); ctx.stroke();
      if (!rov.move) {                                                                     // facho de luz na mina
        ctx.globalCompositeOperation = 'lighter';
        const lx = rx + ROV.lx * dir, ly = ry + ROV.ly;
        const lg = ctx.createLinearGradient(lx, ly, tgt.x, tgt.y);
        lg.addColorStop(0, 'rgba(255,250,215,0.5)'); lg.addColorStop(1, 'rgba(255,250,215,0.05)');
        ctx.fillStyle = lg;
        const ang = Math.atan2(tgt.y - ly, tgt.x - lx), len = Math.hypot(tgt.x - lx, tgt.y - ly) + MINE.R * 1.4, spread = 0.3;
        ctx.beginPath(); ctx.moveTo(lx, ly);
        ctx.lineTo(lx + Math.cos(ang - spread) * len, ly + Math.sin(ang - spread) * len);
        ctx.lineTo(lx + Math.cos(ang + spread) * len, ly + Math.sin(ang + spread) * len);
        ctx.closePath(); ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
      }
      ctx.save(); ctx.translate(rx, ry); ctx.scale(dir, 1); ctx.drawImage(ROV.c, -ROV.w / 2, -ROV.h / 2); ctx.restore();
      if (q > 0 && Math.random() < dt * 3) bub.add(rx - dir * ROV.w * 0.45, ry, -dir * rnd(4, 12), rnd(-30, -14) * S, rnd(1.2, 2.2) * S, rnd(1.2, 2));

      // submarino em patrulha silenciosa: sonar suave e bolhas da hélice
      sub.x += W * 0.02 * dt;
      if (sub.x > W + SUB.w * 0.6) sub.x = -SUB.w * 0.6;
      const syb = H * 0.66 + Math.sin(t * 0.3) * H * 0.015;
      sub.ping -= dt;
      if (sub.ping <= 0) { sub.ping = 5.5; const p = pings.find(o => !o.a); if (p) { p.a = 1; p.x = sub.x + SUB.L * 0.2; p.y = syb - SUB.L * 0.04; p.t = 0; } }
      ctx.lineWidth = 1.6;
      pings.forEach(p => {
        if (!p.a) return;
        p.t += dt; if (p.t > 3.2) { p.a = 0; return; }
        const u = p.t / 3.2;
        ctx.strokeStyle = `rgba(255,255,255,${(0.55 * (1 - u)).toFixed(3)})`;
        ctx.beginPath(); ctx.arc(p.x, p.y, 20 + u * W * 0.34, 0, 7); ctx.stroke();
      });
      sub.acc += dt * [6, 10, 14][q];
      while (sub.acc >= 1) { sub.acc--; bub.add(sub.x - SUB.L * 0.52, syb + rnd(-4, 4), rnd(-24, -8), rnd(-26, -8) * S, rnd(1.2, 2.6) * S, rnd(1.4, 2.4)); }
      ctx.drawImage(SUB.c, sub.x - SUB.w / 2, syb - SUB.cy);

      // tubarões
      sharks.forEach((s, i) => {
        const sp = i ? SHARK_SM : SHARK;
        const x = mod(s.ph + t * s.sp * W * s.dir, W + sp.L * 2) - sp.L;
        drawShark(ctx, sp, x, H * s.y + Math.sin(t * 0.45 + i) * 12 * S, s.dir, t, i * 2);
      });

      // cardumes
      if (q > 0) {
        shoals.forEach(sh => {
          const cx = mod(t * sh.sp * sh.dir + sh.ph, W + 360) - 180, cy = H * sh.y;
          const spr = sh.dir > 0 ? FISH.r : FISH.l;
          sh.fish.forEach(f => ctx.drawImage(spr, cx + f.ox, cy + f.oy + Math.sin(t * 3 + f.p) * 3, 32 * f.w, 14 * f.w));
        });
      }

      // águas-vivas subindo
      jellies.forEach(j => {
        const y = H + 60 - mod(j.y * (H + 160) + t * 9, H + 160);
        drawJelly(ctx, W * j.x + Math.sin(t * 0.3 + j.ph) * 30, y, j.k * S, t, j.ph);
      });

      bub.step(ctx, dt, t);

      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      const ns = Math.round(motes.length * [0.4, 0.7, 1][q]);
      for (let i = 0; i < ns; i++) { const p = motes[i]; ctx.fillRect(mod(p.x * W + Math.sin(t * 0.5 + p.ph) * 8, W), mod(p.y * H + t * p.v, H), p.s, p.s); }
    });
  })();

  /* ═════════════════════════ 3) JARDINS DE CORAL (naufrágios) ═════════════════════════ */
  (function reef() {
    let W = 0, H = 0, S = 1, floorY = 0, farTop = 0, floorTop = 0, farLayer = null, floor = null, causStrip = null, sprites = null, layout = [], weeds = [], anemones = [];
    let SHARK = null, TURTLE = null;
    const bub = bubblePool(80);
    const emitters = [{ fx: 0.4, acc: 0 }, { fx: 0.62, acc: 0.5 }, { fx: 0.86, acc: 0.2 }];
    const motes = Array.from({ length: 50 }, () => ({ x: Math.random(), y: Math.random(), s: 1 + Math.random() * 1.5, v: 3 + Math.random() * 7, ph: Math.random() * 6.28 }));
    const tangs = Array.from({ length: 8 }, (_, i) => ({ a: (i / 8) * 6.28, rr: rnd(0.6, 1.2), w: rnd(0.85, 1.15), yo: rnd(-0.4, 0.4) }));
    const blues = { y: 0.46, dir: -1, sp: 34, ph: 200, fish: Array.from({ length: 8 }, () => ({ ox: rnd(-70, 70), oy: rnd(-22, 22), w: rnd(0.85, 1.15), p: Math.random() * 6.28 })) };
    const school = { y: 0.3, dir: 1, sp: 40, ph: 0, fish: Array.from({ length: 14 }, () => ({ ox: rnd(-100, 100), oy: rnd(-26, 26), w: rnd(0.8, 1.2), p: Math.random() * 6.28 })) };
    const wanderers = [
      { kind: 'angel', fx: 0.46, fy: -0.16, rx: 70, ry: 18, sp: 0.35, ph: 0 },
      { kind: 'butterfly', fx: 0.28, fy: -0.07, rx: 50, ry: 12, sp: 0.5, ph: 2 },
      { kind: 'butterfly', fx: 0.3, fy: -0.09, rx: 46, ry: 10, sp: 0.5, ph: 2.5 },
      { kind: 'angel', fx: 0.8, fy: -0.14, rx: 60, ry: 16, sp: 0.3, ph: 4 },
    ];
    const ray = { dir: 1, sp: 0.018, ph: 300 };

    /* naufrágios à luz do dia, tomados por corais e esponjas */
    function wreckSprite(kind, Lw, seed) {
      const r = seeded(seed);
      const pad = Lw * 0.08, w = Math.ceil(Lw + pad * 2), h = Math.ceil(Lw * 0.66), by = h * 0.72;
      const c = mk(w, h), g = c.getContext('2d');
      const X = n => pad + n * Lw, Y = n => by + n * Lw - Lw * 0.3;
      const poly = (pts, fill) => { g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(X(p[0]), Y(p[1])) : g.moveTo(X(p[0]), Y(p[1])))); g.closePath(); g.fillStyle = fill; g.fill(); };
      const line = (x0, y0, x1, y1, wd, col) => { g.strokeStyle = col; g.lineWidth = Math.max(1.2, wd * Lw); g.lineCap = 'round'; g.beginPath(); g.moveTo(X(x0), Y(y0)); g.lineTo(X(x1), Y(y1)); g.stroke(); };
      const HULL = '#56645f', DARK = '#39443f', MID = '#707e77';
      let topEdge = [];

      if (kind === 'destroyerBow') {
        poly([[0, 0.2], [0.05, 0.14], [0.02, 0.08], [0.09, 0.04], [0.3, 0.04], [0.32, -0.03], [0.37, -0.03], [0.38, 0.04], [0.78, 0.04], [1, 0.16], [0.99, 0.22], [0.9, 0.3], [0.06, 0.3]], HULL);
        poly([[0.31, -0.03], [0.34, -0.09], [0.4, -0.06], [0.38, 0.04]], MID);
        g.fillStyle = DARK; g.fillRect(X(0.62), Y(-0.02), Lw * 0.1, Lw * 0.06);
        line(0.72, 0, 0.88, 0.1, 0.012, MID);
        line(0.5, 0.04, 0.47, -0.16, 0.008, MID); line(0.47, -0.16, 0.56, -0.24, 0.006, MID);
        for (let i = 0; i < 9; i++) { g.fillStyle = 'rgba(20,30,30,0.55)'; g.fillRect(X(0.12 + i * 0.07), Y(0.13), Lw * 0.016, Lw * 0.016); }
        topEdge = [0.08, 0.2, 0.34, 0.45, 0.6, 0.72, 0.9];
      } else if (kind === 'destroyerStern') {
        poly([[0, 0.14], [0.2, 0.04], [0.64, 0.04], [0.7, -0.06], [0.82, -0.06], [0.84, 0.04], [0.95, 0.06], [1, 0.12], [0.96, 0.2], [0.99, 0.26], [0.9, 0.3], [0.05, 0.3]], HULL);
        poly([[0.69, -0.06], [0.76, -0.13], [0.83, -0.06]], MID);
        g.fillStyle = DARK; g.fillRect(X(0.12), Y(0), Lw * 0.1, Lw * 0.05);
        line(0.22, 0.02, 0.36, -0.06, 0.012, MID);
        line(0.02, 0.24, -0.02, 0.36, 0.01, MID);
        for (let i = 0; i < 7; i++) { g.fillStyle = 'rgba(20,30,30,0.5)'; g.fillRect(X(0.1 + i * 0.09), Y(0.13), Lw * 0.016, Lw * 0.016); }
        topEdge = [0.12, 0.3, 0.5, 0.74, 0.9];
      } else if (kind === 'galleon') {
        poly([[0, 0.22], [0.06, 0.32], [0.9, 0.32], [1, 0.14], [0.95, 0.04], [0.78, 0.02], [0.7, -0.05], [0.55, 0], [0.12, 0.02]], '#7a6448');
        g.strokeStyle = '#5a4834'; g.lineWidth = Math.max(1.2, Lw * 0.006);
        for (let i = 0; i < 12; i++) { const x = 0.1 + i * 0.07; g.beginPath(); g.moveTo(X(x), Y(0.03)); g.lineTo(X(x - 0.01), Y(0.16 + r() * 0.06)); g.stroke(); }
        for (let i = 0; i < 9; i++) { g.fillStyle = 'rgba(30,20,10,0.55)'; g.fillRect(X(0.12 + i * 0.09), Y(0.2), Lw * 0.024, Lw * 0.02); }
        line(0.25, 0.02, 0.2, -0.28, 0.01, '#6b5a44'); line(0.2, -0.28, 0.27, -0.33, 0.006, '#6b5a44');
        line(0.5, 0, 0.53, -0.2, 0.01, '#6b5a44'); line(0.55, -0.24, 0.66, -0.16, 0.009, '#6b5a44');
        line(0.78, 0.02, 0.88, -0.2, 0.008, '#6b5a44'); line(1, 0.1, 1.12, 0.02, 0.008, '#6b5a44');
        topEdge = [0.1, 0.3, 0.45, 0.62, 0.85];
      } else if (kind === 'sub') {
        g.beginPath(); g.ellipse(X(0.5), Y(0.14), Lw * 0.5, Lw * 0.085, 0, 0, 7); g.fillStyle = HULL; g.fill();
        poly([[0.42, 0.08], [0.45, -0.03], [0.56, -0.03], [0.6, 0.08]], MID);
        line(0.5, -0.03, 0.5, -0.12, 0.006, MID); line(0.5, -0.12, 0.56, -0.12, 0.005, MID);
        g.fillStyle = MID; g.fillRect(X(0.72), Y(0.14), Lw * 0.09, Lw * 0.012);
        topEdge = [0.2, 0.36, 0.5, 0.66, 0.8];
      } else {                                                           // porta-aviões (ao fundo)
        poly([[0, 0.14], [0.02, 0.3], [0.96, 0.3], [1, 0.18], [0.98, 0.1]], HULL);
        poly([[0, 0.05], [0.98, 0.05], [0.98, 0.11], [0, 0.11]], MID);
        poly([[0.62, -0.08], [0.7, -0.08], [0.71, 0.05], [0.61, 0.05]], MID);
        line(0.66, -0.08, 0.66, -0.2, 0.006, MID); line(0.6, -0.15, 0.72, -0.15, 0.004, MID);
        topEdge = [0.1, 0.25, 0.4, 0.55, 0.8, 0.92];
      }

      // incrustações: coralinas rosadas, esponjas, algas e ferrugem (só no metal/madeira já desenhado)
      g.globalCompositeOperation = 'source-atop';
      const ENC = ['rgba(214,118,146,0.42)', 'rgba(160,96,60,0.38)', 'rgba(112,162,90,0.42)', 'rgba(150,118,196,0.36)', 'rgba(230,190,84,0.4)'];
      for (let i = 0; i < 22; i++) {
        const x = pad + r() * Lw, y = by - Lw * 0.3 + (r() * 0.36 - 0.08) * Lw;
        g.fillStyle = ENC[(r() * ENC.length) | 0];
        g.beginPath(); g.ellipse(x, y, (0.015 + r() * 0.04) * Lw, (0.008 + r() * 0.018) * Lw, r() * 3, 0, 7); g.fill();
      }
      const light = g.createLinearGradient(0, 0, 0, h);
      light.addColorStop(0, 'rgba(255,248,220,0.28)'); light.addColorStop(0.6, 'rgba(255,248,220,0)'); light.addColorStop(1, 'rgba(20,70,90,0.28)');
      g.fillStyle = light; g.fillRect(0, 0, w, h);
      g.globalCompositeOperation = 'source-over';

      // contorno escuro: o casco continua legível debaixo dos corais
      g.globalCompositeOperation = 'destination-over';
      g.shadowColor = 'rgba(16,40,52,0.55)'; g.shadowBlur = Math.max(2, Lw * 0.008);
      g.drawImage(c, 0, 0);
      g.shadowColor = 'transparent'; g.shadowBlur = 0;
      g.globalCompositeOperation = 'source-over';

      // colônias de coral crescendo por cima do casco (poucas e maiores)
      const k = Lw / 420;
      topEdge.forEach((tx, i) => {
        if (i % 2) return;
        const cx = X(tx), cy = Y(kind === 'galleon' ? 0.03 : kind === 'sub' ? 0.07 : 0.05);
        const pickR = () => (r() * 1e9) | 0;
        const tuft = TUFTS[pickR() % 5], s = (0.7 + r() * 0.4) * k;
        g.drawImage(tuft, cx - tuft.width * s / 2, cy - tuft.height * s + 3 * k, tuft.width * s, tuft.height * s);
        if (i % 4 === 0) { const b = BRAINS[pickR() % BRAINS.length], bs = (0.5 + r() * 0.3) * k; g.drawImage(b, cx + 14 * k, cy - b.height * bs + 2 * k, b.width * bs, b.height * bs); }
        else { const sp = SPONGES[pickR() % SPONGES.length], ss = (0.5 + r() * 0.3) * k; g.drawImage(sp, cx - 34 * k, cy - sp.height * ss + 2 * k, sp.width * ss, sp.height * ss); }
      });
      return { c, w, h, by, Lw };
    }

    function buildFloor() {
      const line = x => floorY + Math.sin(x * 0.004) * 9 * S + Math.sin(x * 0.011 + 1) * 5 * S;
      const r = seeded(77);

      // As duas camadas estáticas só cobrem a faixa perto do leito (farTop/floorTop até embaixo):
      // compor a altura inteira da faixa a cada quadro seria pintar à toa a parte vazia de cima.
      farTop = Math.floor(floorY - 150 * S); floorTop = Math.floor(floorY - 110 * S);

      // fundo distante: recife enevoado atrás dos naufrágios
      farLayer = mk(W, floorY + 12 * S - farTop);
      let g = farLayer.getContext('2d');
      g.translate(0, -farTop);
      g.fillStyle = 'rgba(70,150,170,0.28)';
      g.beginPath(); g.moveTo(0, floorY + 10 * S);
      for (let x = 0; x <= W; x += 16) g.lineTo(x, floorY - 24 * S - Math.abs(Math.sin(x * 0.012 + 1)) * 34 * S - Math.sin(x * 0.037) * 8 * S);
      g.lineTo(W, floorY + 10 * S); g.closePath(); g.fill();
      for (let i = 0; i < 7; i++) {
        const f = FANS[i % FANS.length], s = (0.8 + r() * 0.6) * S, x = r() * W;
        g.globalAlpha = 0.45; g.drawImage(f, x - f.width * s / 2, line(x) - f.height * s * 0.95, f.width * s, f.height * s);
      }
      g.globalAlpha = 1;

      // leito de areia clara (fica na frente da base dos naufrágios) com corais no primeiro plano
      floor = mk(W, H - floorTop);
      g = floor.getContext('2d');
      g.translate(0, -floorTop);
      g.beginPath(); g.moveTo(0, H); g.lineTo(0, line(0));
      for (let x = 0; x <= W; x += 10) g.lineTo(x, line(x));
      g.lineTo(W, H); g.closePath();
      const sand = g.createLinearGradient(0, floorY - 12, 0, H);
      sand.addColorStop(0, '#cfe3d4'); sand.addColorStop(0.1, '#eee0b8'); sand.addColorStop(0.55, '#e8d3a2'); sand.addColorStop(1, '#dcc28c');
      g.fillStyle = sand; g.fill();
      g.save(); g.clip();
      g.lineWidth = 1.3 * S;
      for (let k = 0; k < 16; k++) {                                    // marcas de ondulação na areia
        const y0 = floorY + 12 * S + k * (H - floorY) / 15;
        g.strokeStyle = k % 2 ? 'rgba(255,250,235,0.5)' : 'rgba(170,140,90,0.25)';
        g.beginPath();
        for (let x = 0; x <= W; x += 14) { const y = y0 + Math.sin(x * 0.028 + k * 1.7) * 3 * S; if (x) g.lineTo(x, y); else g.moveTo(x, y); }
        g.stroke();
      }
      for (let i = 0; i < 60; i++) {                                    // pedrinhas e conchas
        const x = r() * W, y = line(x) + (6 + r() * (H - floorY)) * 0.9;
        g.fillStyle = ['rgba(150,125,90,0.45)', 'rgba(255,245,225,0.8)', 'rgba(200,170,130,0.6)'][i % 3];
        g.beginPath(); g.ellipse(x, y, (2 + r() * 5) * S, (1.2 + r() * 2.4) * S, 0, 0, 7); g.fill();
      }
      g.restore();
      // âncora antiga
      g.strokeStyle = 'rgba(95,85,70,0.85)'; g.lineWidth = 3 * S; g.lineCap = 'round';
      const ax = W * 0.5, ay = line(ax) + 18 * S;
      g.beginPath(); g.moveTo(ax, ay - 18 * S); g.lineTo(ax, ay + 12 * S); g.moveTo(ax - 12 * S, ay - 8 * S); g.lineTo(ax + 12 * S, ay - 8 * S);
      g.arc(ax, ay + 4 * S, 12 * S, 0.2, Math.PI - 0.2); g.stroke();
      // corais e esponjas no primeiro plano, estrelas-do-mar e ouriços na areia
      [[0.02, 1.1], [0.16, 0.85], [0.31, 0.9], [0.52, 0.75], [0.72, 0.9], [0.97, 1.1]].forEach(([fx, s0], i) => {
        const x = fx * W, y = line(x) + 6 * S;
        if (i % 2 === 0) { const b = BRAINS[i % BRAINS.length], bs = s0 * 0.75 * S; g.drawImage(b, x - b.width * bs / 2 + 18 * S, y - b.height * bs + 4 * S, b.width * bs, b.height * bs); }
        const tf = TUFTS[(i * 3) % 5], ts = s0 * 0.9 * S;
        g.drawImage(tf, x - tf.width * ts / 2, y - tf.height * ts + 3 * S, tf.width * ts, tf.height * ts);
        if (i % 2) { const sp = SPONGES[i % SPONGES.length], ss = s0 * 0.85 * S; g.drawImage(sp, x - 36 * S, y - sp.height * ss + 3 * S, sp.width * ss, sp.height * ss); }
      });
      for (let i = 0; i < 9; i++) {
        const st = STARS[i % STARS.length], s = (0.8 + r() * 0.5) * S, x = r() * W, y = line(x) + (18 + r() * 60) * S;
        g.drawImage(st, x - st.width * s / 2, y - st.height * s * 0.25, st.width * s, st.height * s * 0.5);
      }
      for (let i = 0; i < 5; i++) { const s = (0.8 + r() * 0.4) * S, x = r() * W, y = line(x) + (14 + r() * 40) * S; g.drawImage(URCHIN, x - 13 * s, y - 18 * s, 26 * s, 26 * s); }

      // faixa de cáusticas já ladrilhada (achatada pela perspectiva), deslizando por cima da areia
      const cw = Math.ceil(W / 150) + 2, cellW = 150 * S, cellH = 60 * S;
      causStrip = mk((cw + 1) * cellW, Math.ceil(H - floorY + 40 * S));
      const cg = causStrip.getContext('2d');
      for (let yy = 0; yy < causStrip.height; yy += cellH) for (let xx = 0; xx < causStrip.width; xx += cellW) cg.drawImage(CAUSTIC, xx, yy, cellW, cellH);

      return line;
    }

    band('reef-canvas', (ctx, w, h) => {
      W = w; H = h; S = clamp(W / 1366, 0.6, 1.3);
      floorY = H * 0.78;
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
        [sprites.carrier, 0.24, floorY - H * 0.02, -0.06, 0.55],
        [sprites.bow,     0.42, floorY + H * 0.005, -0.1, 1],
        [sprites.galleon, 0.63, floorY + H * 0.01, 0.3, 1],
        [sprites.stern,   0.84, floorY + H * 0.01, 0.16, 1],
        [sprites.sub,     0.08, floorY + H * 0.03, -0.2, 1],
      ];
      const line = buildFloor();
      SHARK = sharkSprites(170 * S); TURTLE = turtleSprites(78 * S);

      weeds = [];                                                        // algas e capim-marinho
      for (let i = 0; i < 26; i++) { const x = rnd(0.01, 0.99) * W; weeds.push({ x, y: line(x) + 5 * S, h: rnd(36, 100) * S, ph: Math.random() * 6.28, col: i % 2 }); }
      anemones = [[0.35, '#f6a5c0', '#d0588a'], [0.53, '#ffd08a', '#e08a3a'], [0.91, '#b9f0d8', '#3fa383']].map(([fx, col, base], i) => {
        const x = fx * W;
        return { x, y: line(x) + 8 * S, s: 46 * S, col, base, ph: i * 2, n: 22 };
      });
      bub.clear();
    }, (ctx, dt, t) => {
      if (!W) return;
      const q = level();
      ctx.clearRect(0, 0, W, H);
      ctx.drawImage(farLayer, 0, farTop);

      layout.forEach(([spr, fx, fy, rot, a]) => {                         // naufrágios
        ctx.save(); ctx.globalAlpha = a; ctx.translate(fx * W, fy); ctx.rotate(rot);
        ctx.drawImage(spr.c, -spr.w / 2, -spr.by); ctx.restore();
      });
      ctx.globalAlpha = 1;

      // tartaruga planando sobre o recife
      drawTurtle(ctx, TURTLE, mod(80 + t * W * 0.014, W + TURTLE.w * 2) - TURTLE.w, H * 0.34 + Math.sin(t * 0.5) * 10 * S, 1, t, 3);

      // cirurgiões-amarelos circulando o galeão
      const gx = 0.63 * W, gy = floorY - H * 0.2;
      tangs.forEach((f, i) => {
        const a = f.a + t * 0.32, rx = 120 * S * f.rr, ry = 34 * S * f.rr;
        const x = gx + Math.cos(a) * rx, y = gy + Math.sin(a) * ry + f.yo * 30 * S;
        const spr = Math.sin(a) > 0 ? REEF.tang.l : REEF.tang.r;         // sentido anti-horário
        ctx.drawImage(spr, x - 17 * f.w * S, y - 13 * f.w * S, 34 * f.w * S, 26 * f.w * S);
      });

      // cardumes
      if (q > 0) {
        [[blues, REEF.blue, 34, 26], [school, FISH, 32, 14]].forEach(([sh, sp, fw, fh]) => {
          const cx = mod(t * sh.sp * sh.dir + sh.ph, W + 320) - 160, cy = H * sh.y;
          const img = sh.dir > 0 ? sp.r : sp.l;
          sh.fish.forEach(f => ctx.drawImage(img, cx + f.ox * S, cy + f.oy * S + Math.sin(t * 3 + f.p) * 3, fw * f.w * S, fh * f.w * S));
        });
      }
      // peixes de recife passeando perto dos corais
      wanderers.forEach(f => {
        const a = t * f.sp + f.ph, x = f.fx * W + Math.cos(a) * f.rx * S, y = floorY + f.fy * H + Math.sin(a * 2) * f.ry * S;
        const spr = Math.sin(a) > 0 ? REEF[f.kind].l : REEF[f.kind].r;
        ctx.drawImage(spr, x - 15 * S, y - 11 * S, 30 * S, 23 * S);
      });

      // tubarão-de-recife passando de vez em quando
      const shx = mod(t * W * 0.03, W * 2.4) - SHARK.L;
      if (shx < W + SHARK.L) drawShark(ctx, SHARK, shx, H * 0.52 + Math.sin(t * 0.4) * 10 * S, 1, t, 0);

      // bolhas que escapam dos cascos
      emitters.forEach(e => {
        e.acc += dt * 1.4 * [0.4, 0.7, 1][q];
        while (e.acc >= 1) { e.acc--; bub.add(e.fx * W + rnd(-40, 40) * S, floorY - 12 * S, rnd(-6, 6), rnd(-45, -22) * S, rnd(1.5, 4) * S, rnd(3.5, 6)); }
      });
      bub.step(ctx, dt, t);

      // leito de areia (com os corais do primeiro plano) e cáusticas dançando sobre ele
      ctx.drawImage(floor, 0, floorTop);
      if (q > 0) {
        ctx.save();
        ctx.beginPath(); ctx.rect(0, floorY - 14 * S, W, H - floorY + 14 * S); ctx.clip();
        ctx.globalCompositeOperation = 'lighter';
        const cellW = 150 * S;
        ctx.globalAlpha = 0.2;
        ctx.drawImage(causStrip, -mod(t * 9 * S, cellW), floorY - 6 * S + Math.sin(t * 0.7) * 4 * S);
        ctx.globalAlpha = 0.14;
        ctx.drawImage(causStrip, -cellW + mod(t * 6 * S, cellW), floorY - 26 * S + Math.cos(t * 0.5) * 5 * S);
        ctx.restore();
      }

      // raia deslizando rente à areia
      const rx = mod(ray.ph + t * ray.sp * W, W + 300 * S) - 150 * S, ryy = floorY + (H - floorY) * 0.45;
      ctx.save(); ctx.translate(rx, ryy); ctx.scale(1, 0.42);
      ctx.fillStyle = 'rgba(80,70,55,0.25)'; ctx.beginPath(); ctx.ellipse(6 * S, 26 * S, 60 * S, 40 * S, 0, 0, 7); ctx.fill();      // sombra
      const wave = Math.sin(t * 2.2) * 6 * S;
      ctx.fillStyle = '#8a7a62';
      ctx.beginPath(); ctx.moveTo(62 * S, 0); ctx.quadraticCurveTo(10 * S, -60 * S - wave, -40 * S, 0); ctx.quadraticCurveTo(10 * S, 60 * S + wave, 62 * S, 0); ctx.fill();
      ctx.strokeStyle = '#6d5f4b'; ctx.lineWidth = 3 * S; ctx.beginPath(); ctx.moveTo(-38 * S, 0); ctx.quadraticCurveTo(-80 * S, Math.sin(t * 2) * 8 * S, -118 * S, Math.sin(t * 2 - 1) * 12 * S); ctx.stroke();
      ctx.restore();

      // capim-marinho balançando (2 traçados, um por cor)
      ctx.lineCap = 'round'; ctx.lineWidth = 3 * S;
      [['rgba(78,154,82,0.95)', 0], ['rgba(54,124,70,0.95)', 1]].forEach(([col, k]) => {
        ctx.strokeStyle = col; ctx.beginPath();
        weeds.forEach(w => {
          if (w.col !== k) return;
          const sw = Math.sin(t * 1.1 + w.ph) * 12 * S;
          ctx.moveTo(w.x, w.y); ctx.quadraticCurveTo(w.x + sw * 0.4, w.y - w.h * 0.55, w.x + sw, w.y - w.h);
        });
        ctx.stroke();
      });

      // anêmonas com peixes-palhaço
      anemones.forEach((a, ai) => {
        ctx.fillStyle = a.base; ctx.beginPath(); ctx.ellipse(a.x, a.y, a.s * 0.42, a.s * 0.2, 0, Math.PI, 0); ctx.fill();
        ctx.strokeStyle = a.col; ctx.lineWidth = Math.max(1.5, a.s * 0.075); ctx.lineCap = 'round';
        ctx.beginPath();
        for (let i = 0; i < a.n; i++) {
          const kk = i / (a.n - 1) - 0.5, bx = a.x + kk * a.s * 0.7, ang = -Math.PI / 2 + kk * 1.9 + Math.sin(t * 1.5 + a.ph + i * 0.4) * 0.2;
          const len = a.s * (0.6 + 0.25 * Math.cos(i * 1.7)), yb = a.y - a.s * 0.1;
          ctx.moveTo(bx, yb);
          ctx.quadraticCurveTo(bx + Math.cos(ang) * len * 0.5 + Math.sin(t * 1.3 + i) * a.s * 0.05, yb + Math.sin(ang) * len * 0.5, bx + Math.cos(ang) * len, yb + Math.sin(ang) * len);
        }
        ctx.stroke();
        for (let i = 0; i < 2; i++) {
          const ph = t * (0.9 + i * 0.25) + ai * 2 + i * 3;
          const x = a.x + Math.cos(ph) * a.s * 0.55, y = a.y - a.s * 0.75 + Math.sin(ph * 1.7) * a.s * 0.18;
          const spr = Math.sin(ph) > 0 ? REEF.clown.l : REEF.clown.r;
          ctx.drawImage(spr, x - 12 * S, y - 9 * S, 24 * S, 18 * S);
        }
      });

      ctx.fillStyle = 'rgba(255,255,255,0.65)';
      const ns = Math.round(motes.length * [0.4, 0.7, 1][q]);
      for (let i = 0; i < ns; i++) { const p = motes[i]; ctx.fillRect(mod(p.x * W + Math.sin(t * 0.5 + p.ph) * 8, W), mod(p.y * floorY + t * p.v, floorY), p.s, p.s); }
    });
  })();
})();
