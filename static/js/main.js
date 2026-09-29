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


/* ═══════════════════ HERO (canvas 2D) — controlador + CENAS por tema ═══
   RNHero cuida do ciclo de vida: pausa fora da tela e com a aba oculta,
   resize e DPR. Cada tema registra uma cena { resize(ctx, W, H, dpr), render(ctx, dt) }:
     • claro  → comboio rumo ao horizonte num dia de sol (convoy-hero.js)
     • escuro → batalha naval (war-hero.js)                                       */
window.RNHero = (function initHero() {
  const canvas = document.getElementById('ocean-canvas');
  const hero   = document.getElementById('hero');
  const api = { register() {}, setMode() {}, reduced: REDUCED_MOTION };
  if (!canvas || !hero) return api;

  const ctx = canvas.getContext('2d', { alpha: false });
  const scenes = {};
  const dirty = { light: true, dark: true };          // cena precisa recalcular sprites/gradientes
  let mode = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  let W = 0, H = 0, dpr = 1, last = 0, raf = 0, inView = true;

  /** Recalcula a cena ativa se o tamanho mudou (as outras esperam a vez). */
  function ensure(name) {
    const s = scenes[name];
    if (s && dirty[name] && W) { s.resize(ctx, W, H, dpr); dirty[name] = false; }
    return s;
  }

  function tick(now) {
    raf = requestAnimationFrame(tick);
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    const s = ensure(mode);
    if (s) s.render(ctx, dt);
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

  function paintOnce() {                               // quadro estático (pausado / reduced-motion)
    const s = ensure(mode);
    if (s && !raf) s.render(ctx, 0);
    else if (!s && W) {                                 // cena ainda carregando: cor do tema em vez de preto
      ctx.fillStyle = mode === 'dark' ? '#050b14' : '#5db4ec';
      ctx.fillRect(0, 0, W, H);
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
    dirty.light = dirty.dark = true;
    paintOnce();
  }

  api.register = (name, scene) => {
    scenes[name] = scene;
    dirty[name] = true;
    if (name === mode) paintOnce();
  };
  api.setMode = m => {
    mode = m === 'dark' ? 'dark' : 'light';
    paintOnce();                                        // troca visível na hora, mesmo pausado
    sync();
  };

  new ResizeObserver(resize).observe(canvas);
  new IntersectionObserver(([entry]) => { inView = entry.isIntersecting; sync(); }).observe(hero);
  document.addEventListener('visibilitychange', sync);
  document.addEventListener('rn:themechange', e => api.setMode(e.detail.theme));
  // o mouse chegou perto do botão de tema: prepara a cena do outro tema para a troca ser instantânea
  document.addEventListener('rn:prewarm', () => ensure(mode === 'dark' ? 'light' : 'dark'));
  resize();
  sync();
  return api;
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
document.addEventListener('rn:themechange', e => window.ShipEngine.setTheme(e.detail.theme));
window.ShipEngine.setTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light');
