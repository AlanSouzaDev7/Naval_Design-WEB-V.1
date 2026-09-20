/* ═══════════════════════════════════════════════════════════════
   ROYAL NAVY — MAIN JS
   Navegação, hero animado, contadores, revelação ao rolar, modal.

   Regras de desempenho seguidas aqui:
   • nada de leitura de layout dentro de handlers de scroll;
   • animações contínuas só rodam enquanto estão visíveis;
   • animações baseadas em tempo (dt), não em "por frame";
   • só transform/opacity são animados.
   ═══════════════════════════════════════════════════════════════ */

'use strict';

const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ═════════════════════════════ SCROLL: NAVBAR + PARALLAX (1 handler) ═══ */
(function initScroll() {
  const navbar      = document.getElementById('navbar');
  const heroContent = document.querySelector('.hero-content');
  let ticking = false;
  let scrolled = false;
  let parallaxOn = false;

  function update() {
    ticking = false;
    const y = window.scrollY;

    const isScrolled = y > 60;
    if (isScrolled !== scrolled) {
      scrolled = isScrolled;
      navbar.classList.toggle('scrolled', isScrolled);
    }

    if (heroContent && !REDUCED_MOTION) {
      if (y < window.innerHeight) {
        parallaxOn = true;
        heroContent.style.transform = `translate3d(0, ${(y * 0.3).toFixed(1)}px, 0)`;
        heroContent.style.opacity   = String(Math.max(0, 1 - y / (window.innerHeight * 0.7)));
      } else if (parallaxOn) {
        parallaxOn = false;
        heroContent.style.transform = '';
        heroContent.style.opacity   = '0';
      }
    }
  }

  window.addEventListener('scroll', () => {
    if (!ticking) { ticking = true; requestAnimationFrame(update); }
  }, { passive: true });
  update();
})();


/* ═══════════════════════════════ LINK ATIVO DA NAVBAR (sem scroll) ═══ */
(function initActiveLink() {
  const links    = document.querySelectorAll('.nav-link');
  const sections = document.querySelectorAll('section[id]');
  if (!('IntersectionObserver' in window)) return;

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      links.forEach(link => {
        const on = link.getAttribute('href') === '#' + entry.target.id;
        link.classList.toggle('active', on);
        if (on) link.setAttribute('aria-current', 'true'); else link.removeAttribute('aria-current');
      });
    });
  }, { rootMargin: '-45% 0px -50% 0px' });   // faixa fina no meio da tela

  sections.forEach(sec => observer.observe(sec));
})();


/* ════════════════════════════ HERO — DIA ENSOLARADO NO MAR (canvas 2D) ═══ */
(function initHeroSea() {
  const canvas = document.getElementById('ocean-canvas');
  const hero   = document.getElementById('hero');
  if (!canvas || !hero) return;

  const ctx = canvas.getContext('2d', { alpha: false });

  const HORIZON = 0.5;                 // fração da altura onde o mar começa
  const SUN     = { x: 0.78, y: 0.24 };

  let W = 0, H = 0, dpr = 1;
  let t = 0, last = 0, raf = 0, inView = true;
  let bg = null, sunSprite = null;

  /* Ondas (de trás para frente). Cada uma vira um gradiente pré-calculado. */
  const waves = [
    { y: 0.515, amp: 3,  freq: 0.022, speed: 0.55, phase: 0.0, rgb: '255,255,255', a: 0.20, crest: 0.30 },
    { y: 0.560, amp: 6,  freq: 0.015, speed: 0.75, phase: 1.5, rgb: '8,110,160',   a: 0.34, crest: 0 },
    { y: 0.625, amp: 9,  freq: 0.010, speed: 0.95, phase: 3.0, rgb: '255,255,255', a: 0.16, crest: 0.28 },
    { y: 0.705, amp: 13, freq: 0.007, speed: 0.65, phase: 0.8, rgb: '6,86,138',    a: 0.36, crest: 0 },
    { y: 0.800, amp: 18, freq: 0.005, speed: 0.50, phase: 2.2, rgb: '255,255,255', a: 0.14, crest: 0.24 },
  ];

  /* Brilhos do sol na água */
  const sparkles = Array.from({ length: 34 }, () => ({
    u: Math.random() * 2 - 1,
    v: Math.pow(Math.random(), 0.8),
    len: 6 + Math.random() * 16,
    ph: Math.random() * Math.PI * 2,
    sp: 1.2 + Math.random() * 2.2,
  }));

  /* Nuvens (sprites pré-renderizados) e gaivotas */
  function makeCloudSprite(seed, w = 380, h = 130) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    let s = seed;
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    const puffs = 9;
    for (let i = 0; i < puffs; i++) {
      const k  = i / (puffs - 1);
      const px = w * 0.12 + w * 0.76 * k + (rnd() - 0.5) * 20;
      const r  = h * (0.28 + rnd() * 0.22) * (1 - Math.abs(k - 0.5) * 0.7);
      const py = h * 0.62 - r * 0.35 + (rnd() - 0.5) * 8;
      const grad = g.createRadialGradient(px, py, 0, px, py, r);
      grad.addColorStop(0,   'rgba(255,255,255,0.95)');
      grad.addColorStop(0.6, 'rgba(255,255,255,0.55)');
      grad.addColorStop(1,   'rgba(255,255,255,0)');
      g.fillStyle = grad;
      g.beginPath();
      g.arc(px, py, r, 0, Math.PI * 2);
      g.fill();
    }
    return c;
  }

  const cloudSprites = [makeCloudSprite(11), makeCloudSprite(23), makeCloudSprite(37)];
  const clouds = Array.from({ length: 7 }, (_, i) => ({
    s: i % cloudSprites.length,
    x: Math.random(),
    y: 0.05 + Math.random() * 0.32,
    scale: 0.6 + Math.random() * 0.8,
    speed: 0.006 + Math.random() * 0.010,      // fração da largura por segundo
    a: 0.55 + Math.random() * 0.4,
  }));

  const gulls = [
    { x: 0.30, y: 0.20, s: 1.00, sp: 0.014, ph: 0.0 },
    { x: 0.35, y: 0.25, s: 0.75, sp: 0.014, ph: 1.4 },
    { x: 0.58, y: 0.13, s: 0.85, sp: 0.010, ph: 2.6 },
    { x: 0.12, y: 0.31, s: 0.65, sp: 0.012, ph: 4.0 },
  ];

  /* ── Pré-renderização (só quando redimensiona) ─────────────── */
  function buildBackground() {
    bg = document.createElement('canvas');
    bg.width = canvas.width; bg.height = canvas.height;
    const g = bg.getContext('2d');
    g.scale(dpr, dpr);

    const hy = H * HORIZON;
    const sky = g.createLinearGradient(0, 0, 0, hy);
    sky.addColorStop(0,    '#1b7cc6');
    sky.addColorStop(0.55, '#3f9fe0');
    sky.addColorStop(1,    '#8fd0f2');
    g.fillStyle = sky;
    g.fillRect(0, 0, W, hy + 1);

    const sea = g.createLinearGradient(0, hy, 0, H);
    sea.addColorStop(0,    '#26c0d0');
    sea.addColorStop(0.45, '#0f90b6');
    sea.addColorStop(1,    '#0a5f8c');
    g.fillStyle = sea;
    g.fillRect(0, hy, W, H - hy);

    const haze = g.createLinearGradient(0, hy - 30, 0, hy + 14);
    haze.addColorStop(0,   'rgba(255,255,255,0)');
    haze.addColorStop(0.7, 'rgba(255,255,255,0.35)');
    haze.addColorStop(1,   'rgba(255,255,255,0)');
    g.fillStyle = haze;
    g.fillRect(0, hy - 30, W, 44);
  }

  function buildSun() {
    const size = 320;
    sunSprite = document.createElement('canvas');
    sunSprite.width = sunSprite.height = size;
    const g = sunSprite.getContext('2d');
    const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0,    'rgba(255,255,255,1)');
    grad.addColorStop(0.07, 'rgba(255,251,222,1)');
    grad.addColorStop(0.14, 'rgba(255,236,150,0.88)');
    grad.addColorStop(0.38, 'rgba(255,216,96,0.30)');
    grad.addColorStop(1,    'rgba(255,216,96,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, size, size);
  }

  function buildWaveGradients() {
    waves.forEach(w => {
      const top = w.y * H - w.amp * 1.4;
      const grad = ctx.createLinearGradient(0, top, 0, top + 190);
      grad.addColorStop(0, `rgba(${w.rgb},${w.a})`);
      grad.addColorStop(1, `rgba(${w.rgb},0)`);
      w.grad = grad;
    });
  }

  /* ── Desenho ────────────────────────────────────────────────── */
  function drawClouds(dt) {
    clouds.forEach(c => {
      c.x += c.speed * dt;
      if (c.x > 1) c.x -= 1;
      const sp = cloudSprites[c.s];
      const w = sp.width * c.scale, h = sp.height * c.scale;
      const x = c.x * (W + w * 2) - w;
      ctx.globalAlpha = c.a;
      ctx.drawImage(sp, x, c.y * H, w, h);
    });
    ctx.globalAlpha = 1;
  }

  function drawGulls(dt) {
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(255,255,255,0.92)';
    gulls.forEach(gl => {
      gl.x += gl.sp * dt;
      if (gl.x > 1.05) gl.x = -0.05;
      const s = 14 * gl.s * Math.min(W / 1000, 1.4);
      const flap = Math.sin(t * 5 + gl.ph) * s * 0.4;
      ctx.lineWidth = 2 * gl.s;
      ctx.beginPath();
      ctx.moveTo(gl.x * W - s, gl.y * H + flap);
      ctx.quadraticCurveTo(gl.x * W - s * 0.5, gl.y * H - s * 0.35 - flap * 0.5, gl.x * W, gl.y * H);
      ctx.quadraticCurveTo(gl.x * W + s * 0.5, gl.y * H - s * 0.35 - flap * 0.5, gl.x * W + s, gl.y * H + flap);
      ctx.stroke();
    });
  }

  function drawWarship() {
    const scale = Math.max(W / 1100, 0.5);
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = '#16406b';
    ctx.translate(W * 0.74, H * HORIZON + 3 + Math.sin(t * 0.6) * 1.2 * scale);
    ctx.scale(scale, scale);
    ctx.beginPath();                                   // casco
    ctx.moveTo(-120, 0); ctx.lineTo(-100, -25); ctx.lineTo(100, -25); ctx.lineTo(120, 0);
    ctx.closePath(); ctx.fill();
    ctx.fillRect(-30, -55, 60, 30);                    // superestrutura
    ctx.fillRect(-3, -90, 6, 35);                      // mastro
    ctx.fillRect(-15, -70, 14, 20);                    // chaminé
    ctx.restore();
  }

  function drawSailboat() {
    const scale = Math.min(Math.max(W / 1100, 0.6), 1.3);
    ctx.save();
    ctx.translate(W * 0.17, H * 0.585 + Math.sin(t * 0.9) * 2 * scale);
    ctx.rotate(Math.sin(t * 0.7) * 0.03);
    ctx.scale(scale, scale);
    ctx.fillStyle = '#12395f';                         // casco
    ctx.beginPath();
    ctx.moveTo(-34, 0); ctx.lineTo(34, 0); ctx.lineTo(24, 12); ctx.lineTo(-26, 12);
    ctx.closePath(); ctx.fill();
    ctx.fillRect(-1, -72, 2, 70);                      // mastro
    ctx.fillStyle = '#ffffff';                         // vela grande
    ctx.beginPath();
    ctx.moveTo(-3, -70); ctx.lineTo(-3, -5); ctx.lineTo(-30, -5);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#fff3cf';                         // genoa
    ctx.beginPath();
    ctx.moveTo(3, -62); ctx.lineTo(3, -5); ctx.lineTo(32, -5);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  function drawWave(w) {
    const base = w.y * H;
    ctx.beginPath();
    for (let x = 0; x <= W + 6; x += 6) {
      const y = base
        + Math.sin(x * w.freq + t * w.speed + w.phase) * w.amp
        + Math.sin(x * w.freq * 1.7 + t * w.speed * 0.8) * (w.amp * 0.4);
      if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    if (w.crest) {                                     // brilho na crista
      ctx.strokeStyle = `rgba(255,255,255,${w.crest})`;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    ctx.lineTo(W, H);
    ctx.lineTo(0, H);
    ctx.closePath();
    ctx.fillStyle = w.grad;
    ctx.fill();
  }

  function drawSparkles() {
    const sx = W * SUN.x;
    const seaTop = H * HORIZON;
    const seaH = H * 0.42;
    sparkles.forEach(s => {
      const tw = 0.5 + 0.5 * Math.sin(t * s.sp + s.ph);
      const a = tw * (0.85 - s.v * 0.35);
      if (a < 0.05) return;
      const x = sx + s.u * (26 + s.v * W * 0.17);
      const y = seaTop + 6 + s.v * seaH;
      ctx.fillStyle = `rgba(255,252,225,${a.toFixed(2)})`;
      ctx.fillRect(x, y, s.len * (0.6 + s.v), 1.5 + s.v * 1.5);
    });
  }

  function render(dt) {
    t += dt;
    ctx.drawImage(bg, 0, 0, W, H);

    // Sol (com leve pulsar)
    const size = Math.min(W, H * 1.1) * 0.75 * (1 + 0.025 * Math.sin(t * 0.7));
    ctx.drawImage(sunSprite, W * SUN.x - size / 2, H * SUN.y - size / 2, size, size);

    drawClouds(dt);
    drawGulls(dt);
    drawWarship();

    drawWave(waves[0]);
    drawWave(waves[1]);
    drawSailboat();
    drawWave(waves[2]);
    drawWave(waves[3]);
    drawWave(waves[4]);
    drawSparkles();
  }

  /* ── Ciclo de vida ──────────────────────────────────────────── */
  function tick(now) {
    raf = requestAnimationFrame(tick);
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    render(dt);
  }

  function sync() {
    const shouldRun = inView && !document.hidden && !REDUCED_MOTION;
    if (shouldRun && !raf) {
      last = performance.now();
      raf = requestAnimationFrame(tick);
    } else if (!shouldRun && raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
  }

  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    const newDpr = Math.min(window.devicePixelRatio || 1, 1.5);
    if (w === W && h === H && newDpr === dpr) return;
    W = w; H = h; dpr = newDpr;
    canvas.width  = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    buildBackground();
    buildSun();
    buildWaveGradients();
    if (!raf) render(0);                               // quadro estático (pausado / reduced-motion)
  }

  new ResizeObserver(resize).observe(canvas);
  new IntersectionObserver(([entry]) => { inView = entry.isIntersecting; sync(); }).observe(hero);
  document.addEventListener('visibilitychange', sync);
  resize();
  sync();
})();


/* ═════════════════════════════════════════ ANIMAÇÃO DOS CONTADORES ═══ */
(function initCounters() {
  const counters = document.querySelectorAll('.stat-number[data-target]');
  const statsBar = document.querySelector('.hero-stats');
  if (!statsBar) return;

  function animateCount(el) {
    const target = parseInt(el.dataset.target, 10);
    if (REDUCED_MOTION) { el.textContent = target.toLocaleString('pt-BR'); return; }

    const duration = 1800;
    const t0 = performance.now();
    (function step(now) {
      const p = Math.min((now - t0) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);              // easeOutCubic
      el.textContent = Math.round(target * eased).toLocaleString('pt-BR');
      if (p < 1) {
        requestAnimationFrame(step);
      } else {
        el.classList.add('counting');
        setTimeout(() => el.classList.remove('counting'), 400);
      }
    })(t0);
  }

  const observer = new IntersectionObserver(entries => {
    if (entries.some(e => e.isIntersecting)) {
      counters.forEach(animateCount);
      observer.disconnect();
    }
  }, { threshold: 0.3 });
  observer.observe(statsBar);
})();


/* ═════════════════════════════ REVELAÇÃO AO ROLAR (sem brigar com o hover) ═══
   As classes .reveal/.is-visible são REMOVIDAS quando a transição termina,
   devolvendo o elemento aos estilos normais (hover, transições próprias). */
(function initReveal() {
  if (REDUCED_MOTION || !('IntersectionObserver' in window)) return;

  const groups = [
    ['.section-header',      ''],
    ['.timeline-item.left',  'reveal--left'],
    ['.timeline-item.right', 'reveal--right'],
    ['.ship-card',           ''],
    ['.battle-card',         ''],
    ['.fleet-cat',           ''],
    ['.gallery-item',        ''],
  ];

  const observer = new IntersectionObserver(entries => {
    let i = 0;
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      observer.unobserve(el);

      el.style.setProperty('--reveal-delay', Math.min(i++, 5) * 70 + 'ms');
      el.classList.add('is-visible');

      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        el.classList.remove('reveal', 'reveal--left', 'reveal--right', 'is-visible');
        el.style.removeProperty('--reveal-delay');
      };
      el.addEventListener('transitionend', ev => {
        if (ev.target === el && ev.propertyName === 'transform') finish();
      });
      setTimeout(finish, 1200);                            // rede de segurança
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

  groups.forEach(([selector, variant]) => {
    document.querySelectorAll(selector).forEach(el => {
      el.classList.add('reveal');
      if (variant) el.classList.add(variant);
      observer.observe(el);
    });
  });
})();


/* ═══════════════════════════════════════════════ FILTRO DE NAVIOS ═══ */
(function initShipFilter() {
  const buttons = document.querySelectorAll('.filter-btn');
  const cards   = document.querySelectorAll('.ship-card');

  buttons.forEach(btn => {
    btn.setAttribute('aria-pressed', String(btn.classList.contains('active')));
    btn.addEventListener('click', () => {
      buttons.forEach(b => {
        const on = b === btn;
        b.classList.toggle('active', on);
        b.setAttribute('aria-pressed', String(on));
      });

      const filter = btn.dataset.filter;
      cards.forEach(card => {
        const match = filter === 'all' || card.dataset.category === filter;
        card.classList.toggle('is-dimmed', !match);   // CSS cuida da animação
        card.inert = !match;                          // fora do foco e do teclado
      });
    });
  });
})();


/* ═════════════════════════════════════════ BARRAS DA FROTA ═══
   A largura de cada barra vem de --fill no HTML; aqui só disparamos a classe. */
(function initFleetBars() {
  const fleet = document.querySelector('.fleet-categories');
  if (!fleet) return;
  if (REDUCED_MOTION || !('IntersectionObserver' in window)) { fleet.classList.add('is-visible'); return; }

  const observer = new IntersectionObserver(([entry]) => {
    if (!entry.isIntersecting) return;
    fleet.classList.add('is-visible');
    observer.disconnect();
  }, { threshold: 0.3 });
  observer.observe(fleet);
})();


/* ═══════════════════════════════════════════════ MODAL DO NAVIO ═══ */
const modal = document.getElementById('ship-modal');
let modalReturnFocus = null;

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

function openShipModal(shipId) {
  const data = SHIPS_DATA[shipId];
  if (!data) return;

  modalReturnFocus = document.activeElement;

  document.getElementById('modal-class').textContent        = data.class;
  document.getElementById('modal-ship-name').textContent    = data.name;
  document.getElementById('modal-desc').textContent         = data.desc;
  document.getElementById('modal-history-text').textContent = data.history;

  document.getElementById('modal-specs').innerHTML = data.specs.map(s => `
    <div class="spec-item">
      <div class="spec-label">${escapeHtml(s.label)}</div>
      <div class="spec-value">${escapeHtml(s.value)}</div>
    </div>
  `).join('');

  document.getElementById('modal-armament').innerHTML =
    data.armament.map(a => `<li>${escapeHtml(a)}</li>`).join('');

  modal.classList.add('open');
  document.body.classList.add('modal-open');
  window.ShipEngine.openModal(data.type);          // pausa o fundo e renderiza só o modal
  modal.querySelector('.modal-close').focus({ preventScroll: true });
}

function closeShipModal() {
  if (!modal.classList.contains('open')) return;
  modal.classList.remove('open');
  document.body.classList.remove('modal-open');
  window.ShipEngine.closeModal();                  // para o render do modal e retoma o fundo
  if (modalReturnFocus && modalReturnFocus.focus) modalReturnFocus.focus({ preventScroll: true });
}

modal.addEventListener('click', e => {
  if (e.target === modal || e.target.closest('.modal-close')) closeShipModal();
});

document.addEventListener('keydown', e => {
  if (!modal.classList.contains('open')) return;

  if (e.key === 'Escape') { closeShipModal(); return; }

  if (e.key === 'Tab') {                           // mantém o foco dentro do modal
    const focusable = Array.from(modal.querySelectorAll('button, [href], [tabindex]:not([tabindex="-1"])'))
      .filter(el => !el.disabled && el.offsetParent !== null);
    if (!focusable.length) return;
    const first = focusable[0], last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
});

// Abrir o modal: botões, links do rodapé e o corpo do card (delegado)
document.addEventListener('click', e => {
  const trigger = e.target.closest('[data-open-ship]');
  if (trigger) {
    e.preventDefault();
    openShipModal(trigger.dataset.openShip);
    return;
  }
  const card = e.target.closest('.ship-card');
  if (card && !e.target.closest('.ship-3d-wrapper') && card.dataset.ship) {
    openShipModal(card.dataset.ship);
  }
});

document.querySelectorAll('.ship-card[tabindex]').forEach(card => {
  card.addEventListener('keydown', e => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target === card) {
      e.preventDefault();
      openShipModal(card.dataset.ship);
    }
  });
});


/* ═════════════════════════════ BRILHO DO SOL SEGUINDO O CURSOR ═══
   Só com mouse; usa transform (compositor) e o loop para sozinho ao alcançar o cursor. */
(function initSunGlow() {
  if (REDUCED_MOTION || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

  const glow = document.createElement('div');
  glow.className = 'sun-glow';
  glow.setAttribute('aria-hidden', 'true');
  document.body.appendChild(glow);

  let mx = 0, my = 0, cx = 0, cy = 0, raf = 0;

  function tick() {
    cx += (mx - cx) * 0.14;
    cy += (my - cy) * 0.14;
    glow.style.transform = `translate3d(${cx.toFixed(1)}px, ${cy.toFixed(1)}px, 0)`;
    raf = (Math.abs(mx - cx) > 0.4 || Math.abs(my - cy) > 0.4) ? requestAnimationFrame(tick) : 0;
  }

  window.addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse') return;
    mx = e.clientX; my = e.clientY;
    if (!glow.classList.contains('is-on')) { cx = mx; cy = my; glow.classList.add('is-on'); }
    if (!raf) raf = requestAnimationFrame(tick);
  }, { passive: true });

  document.documentElement.addEventListener('mouseleave', () => glow.classList.remove('is-on'));
})();


/* ═════════════════════════════════════════════════ MODELOS 3D ═══
   Nada é criado aqui: o motor cria cada cena só quando ela chega perto da tela. */
window.ShipEngine.init();
