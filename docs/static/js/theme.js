/* ═══════════════════════════════════════════════════════════════
   ROYAL NAVY — TEMA (modo claro / modo escuro "guerra no mar")

   • window.RNTheme  { get(), set(modo, {origin, instant}), toggle() }
   • evento          document 'rn:themechange'  (detail.theme)
   • window.RNPerf   nível de qualidade adaptativo (2 alto · 1 médio · 0 baixo)

   Animação de troca: View Transitions API com revelação circular a partir
   do botão. Sem suporte (ou com prefers-reduced-motion) cai numa cortina
   circular simples / troca instantânea.
   ═══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  const root    = document.documentElement;
  const KEY     = 'rn-theme';
  const COLORS  = { light: '#2a9bdc', dark: '#050b14' };
  const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const btn   = document.getElementById('theme-toggle');
  const label = document.getElementById('theme-label');
  const meta  = document.querySelector('meta[name="theme-color"]');
  let busy = false;

  const get = () => (root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light');

  /** Aplica o tema (síncrono) e avisa o resto do site. */
  function apply(mode) {
    root.setAttribute('data-theme', mode);
    if (meta) meta.setAttribute('content', COLORS[mode]);
    if (btn) {
      btn.setAttribute('aria-checked', String(mode === 'dark'));
      btn.title = mode === 'dark' ? 'Voltar ao modo claro' : 'Ativar o modo escuro (guerra no mar)';
    }
    if (label) label.textContent = mode === 'dark' ? 'Escuro' : 'Claro';
    try { localStorage.setItem(KEY, mode); } catch (e) { /* ignora */ }
    document.dispatchEvent(new CustomEvent('rn:themechange', { detail: { theme: mode } }));
  }

  /** Cortina circular (navegadores sem View Transitions). */
  function veilTransition(mode, x, y, radius, done) {
    const veil = document.createElement('div');
    veil.className = 'theme-veil';
    veil.style.background = mode === 'dark' ? '#050b14' : '#f3fbff';
    veil.style.clipPath = `circle(0px at ${x}px ${y}px)`;
    document.body.appendChild(veil);

    const grow = veil.animate(
      { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
      { duration: 520, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' });
    grow.onfinish = () => {
      apply(mode);
      const fade = veil.animate({ opacity: [1, 0] }, { duration: 380, easing: 'ease-out', fill: 'forwards' });
      fade.onfinish = () => { veil.remove(); done(); };
    };
  }

  function set(mode, opts = {}) {
    if (mode !== 'dark' && mode !== 'light') return;
    if (mode === get() || busy) return;

    if (opts.instant || REDUCED || !btn) { apply(mode); return; }

    const r  = btn.getBoundingClientRect();
    const x  = opts.origin ? opts.origin.x : r.left + r.width / 2;
    const y  = opts.origin ? opts.origin.y : r.top + r.height / 2;
    const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));

    busy = true;
    const finish = () => { busy = false; root.classList.remove('theme-switching'); };

    if (typeof document.startViewTransition === 'function') {
      root.classList.add('theme-switching');
      let vt;
      try {
        vt = document.startViewTransition(() => apply(mode));
      } catch (e) { apply(mode); finish(); return; }

      vt.ready.then(() => {
        root.animate(
          { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
          { duration: 900, easing: 'cubic-bezier(.4,0,.2,1)', pseudoElement: '::view-transition-new(root)' });
      }).catch(() => { /* transição pulada: o tema já foi aplicado */ });
      vt.finished.then(finish, finish);
    } else {
      veilTransition(mode, x, y, radius, finish);
    }
  }

  const toggle = () => set(get() === 'dark' ? 'light' : 'dark');

  if (btn) {
    const prewarm = () => document.dispatchEvent(new Event('rn:prewarm'));
    ['pointerenter', 'focus', 'touchstart'].forEach(ev => btn.addEventListener(ev, prewarm, { once: true, passive: true }));
    btn.addEventListener('click', () => toggle());
    apply(get());                                  // sincroniza o botão com o tema inicial
  }

  window.RNTheme = { get, set, toggle };


  /* ═════════════ MENU NO CELULAR ═══
     Até 768 px a barra esconde os links; o botão ☰ abre a lista como um painel sob a barra.
     Criado aqui (e não em cada página) para valer em todas as páginas com a mesma barra. */
  (function menuCelular() {
    const nav = document.getElementById('navbar');
    const lista = nav && nav.querySelector('.nav-links');
    const dentro = nav && nav.querySelector('.nav-inner');
    if (!lista || !dentro) return;

    lista.id = lista.id || 'nav-links';
    const bt = document.createElement('button');
    bt.type = 'button';
    bt.className = 'nav-menu';
    bt.setAttribute('aria-controls', lista.id);
    bt.setAttribute('aria-expanded', 'false');
    bt.setAttribute('aria-label', 'Abrir o menu');
    for (let i = 0; i < 3; i++) bt.appendChild(document.createElement('span'));
    dentro.appendChild(bt);

    const estreita = window.matchMedia('(max-width: 768px)');
    function abre(sim, devolveFoco) {
      nav.classList.toggle('nav-open', sim);
      bt.setAttribute('aria-expanded', String(sim));
      bt.setAttribute('aria-label', sim ? 'Fechar o menu' : 'Abrir o menu');
      if (!sim && devolveFoco) bt.focus();
    }
    bt.addEventListener('click', () => abre(!nav.classList.contains('nav-open')));
    lista.addEventListener('click', e => { if (e.target.closest('a')) abre(false); });       // link de âncora: fecha e rola
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && nav.classList.contains('nav-open')) abre(false, true); });
    document.addEventListener('click', e => { if (nav.classList.contains('nav-open') && !nav.contains(e.target)) abre(false); });
    const largou = () => { if (!estreita.matches) abre(false); };                              // girou o aparelho / alargou a janela
    if (estreita.addEventListener) estreita.addEventListener('change', largou); else estreita.addListener(largou);
  })();


  /* ═════════════ DESEMPENHO ADAPTATIVO (nos dois temas: ambos têm cenas animadas) ═══
     Mede o tempo médio de frame. Se ficar lento, reduz a quantidade de partículas
     e efeitos das cenas; se ficar folgado por bastante tempo, sobe de novo. */
  const Perf = window.RNPerf = { level: 2 };
  let raf = 0, last = 0, acc = 0, n = 0, calmMs = 0, cooldown = 0;

  function sample(now) {
    raf = requestAnimationFrame(sample);
    const dt = now - last;
    last = now;
    if (dt > 250) return;                          // aba voltou do segundo plano: ignora
    acc += dt; n++;
    if (n < 45) return;

    const avg = acc / n;
    acc = 0; n = 0;
    cooldown = Math.max(0, cooldown - 45 * avg);

    if (avg > 26 && Perf.level > 0 && cooldown === 0) {          // < ~38 fps
      Perf.level--; cooldown = 2500; calmMs = 0;
    } else if (avg < 18.5) {                                     // ~54+ fps
      calmMs += 45 * avg;
      if (calmMs > 14000 && Perf.level < 2 && cooldown === 0) { Perf.level++; cooldown = 4000; calmMs = 0; }
    } else {
      calmMs = 0;
    }
  }

  function syncPerf() {
    const on = !document.hidden;
    if (on && !raf) { last = performance.now(); acc = n = 0; raf = requestAnimationFrame(sample); }
    else if (!on && raf) { cancelAnimationFrame(raf); raf = 0; }
  }

  document.addEventListener('rn:themechange', syncPerf);
  document.addEventListener('visibilitychange', syncPerf);
  syncPerf();
})();
