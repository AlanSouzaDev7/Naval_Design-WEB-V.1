/* ═══════════════════════════════════════════════════════════════
   ROYAL NAVY — CONSULTA DE NAVIOS (página /consulta)

   Fala SOMENTE com a API do próprio site (GET /api/navios/...).
   Segurança no navegador:
   • nada de innerHTML: todo texto vindo da API entra por textContent;
   • o id do navio só é aceito se for número inteiro;
   • cada nova busca cancela a anterior (AbortController) e há debounce;
   • sem cookies nem credenciais (credentials: 'omit').
   ═══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  const $ = id => document.getElementById(id);
  const meta = nome => { const m = document.querySelector('meta[name="' + nome + '"]'); return m ? (m.getAttribute('content') || '') : ''; };

  const MODE = meta('rn-mode') || 'server';               // "static" na versão publicada sem servidor
  const API  = meta('rn-api-base').replace(/\/+$/, '');   // vazio = mesma origem
  const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const el = {
    form: $('consulta-form'), q: $('q'), limpar: $('q-limpar'),
    marinha: $('f-marinha'), guerra: $('f-guerra'), tipo: $('f-tipo'),
    aviso: $('aviso'), grade: $('grade'), total: $('lista-total'), chips: $('chips'),
    lista: $('resultados'), pag: $('paginacao'), ant: $('pg-ant'), prox: $('pg-prox'), info: $('pg-info'),
    ficha: $('ficha'), status: $('status'),
  };

  const state = { q: '', marinha: '', guerra: '', tipo: '', pagina: 1, id: null };
  let ctrlBusca = null, ctrlFicha = null, timer = 0, totalPaginas = 1;

  /* ── utilidades ─────────────────────────────────────────── */
  function cria(tag, classe, texto) {
    const e = document.createElement(tag);
    if (classe) e.className = classe;
    if (texto !== undefined && texto !== null) e.textContent = texto;      // sempre textContent
    return e;
  }
  const limpaFilhos = no => { while (no.firstChild) no.removeChild(no.firstChild); };
  const anuncia = txt => { el.status.textContent = ''; setTimeout(() => { el.status.textContent = txt; }, 30); };

  function dataBR(iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
    if (!m) return null;
    const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    return new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric' }).format(d);
  }
  const itens = txt => (txt || '').split(';').map(s => s.trim()).filter(Boolean);

  class ErroApi extends Error {
    constructor(status, mensagem) { super(mensagem); this.status = status; }
  }

  async function api(caminho, params, signal) {
    const qs = new URLSearchParams(params || {}).toString();
    let resp;
    try {
      resp = await fetch(API + caminho + (qs ? '?' + qs : ''), {
        headers: { Accept: 'application/json' }, credentials: 'omit', cache: 'no-store',
        referrerPolicy: 'no-referrer', signal,
      });
    } catch (e) {
      if (e.name === 'AbortError') throw e;
      throw new ErroApi(0, 'Não foi possível falar com o servidor.');
    }
    const tipo = resp.headers.get('content-type') || '';
    if (!tipo.includes('application/json')) throw new ErroApi(resp.status, 'O serviço de consulta não respondeu como esperado.');
    const dados = await resp.json();
    if (!resp.ok) throw new ErroApi(resp.status, (dados && dados.mensagem) || 'Erro na consulta.');
    return dados;
  }

  function mostraAviso(texto, tipo) {
    el.aviso.hidden = !texto;
    el.aviso.className = 'consulta-aviso' + (tipo ? ' consulta-aviso--' + tipo : '');
    el.aviso.textContent = texto || '';
  }

  const mensagemErro = e => e.status === 429 ? 'Muitas consultas seguidas. Aguarde alguns segundos e tente de novo.'
    : e.status === 503 ? 'O serviço de consulta está indisponível no momento.'
    : e.status === 400 ? e.message : (e.message || 'Erro na consulta.');

  /* ── URL (permite compartilhar uma consulta) ────────────── */
  function gravaUrl() {
    const p = new URLSearchParams();
    if (state.q) p.set('q', state.q);
    if (state.marinha) p.set('marinha', state.marinha);
    if (state.guerra) p.set('guerra', state.guerra);
    if (state.tipo) p.set('tipo', state.tipo);
    if (state.id) p.set('id', String(state.id));
    const qs = p.toString();
    try { history.replaceState(null, '', location.pathname + (qs ? '?' + qs : '')); } catch (e) { /* ignora */ }
  }

  /* ── resultados ─────────────────────────────────────────── */
  function temFiltro() { return !!(state.q.length >= 2 || state.marinha || state.guerra || state.tipo); }

  function preencheSelect(select, dados, todos) {
    limpaFilhos(select);
    select.appendChild(new Option(todos, ''));
    (dados || []).forEach(d => select.appendChild(new Option(d.valor + ' (' + d.total + ')', d.valor)));
  }

  async function carregaFiltros() {
    try {
      const f = await api('/api/navios/filtros');
      preencheSelect(el.marinha, f.marinhas, 'Todas');
      preencheSelect(el.guerra, f.guerras, 'Todas');
      preencheSelect(el.tipo, f.tipos, 'Todos');
      el.marinha.value = state.marinha; el.guerra.value = state.guerra; el.tipo.value = state.tipo;
      limpaFilhos(el.chips);
      (f.marinhas || []).forEach(m => {
        const b = cria('button', 'chip', m.valor);
        b.type = 'button';
        b.appendChild(cria('span', 'chip__n', String(m.total)));
        b.addEventListener('click', () => { state.marinha = m.valor; el.marinha.value = m.valor; state.pagina = 1; buscar(); });
        el.chips.appendChild(b);
      });
    } catch (e) {
      if (e.name !== 'AbortError') mostraAviso(mensagemErro(e), 'erro');
    }
  }

  function renderResultados(dados) {
    limpaFilhos(el.lista);
    el.total.textContent = dados.total ? '(' + dados.total + ')' : '';
    if (!dados.resultados.length) {
      const li = cria('li', 'resultados__vazio', 'Nenhum navio encontrado. Tente outra grafia ou remova algum filtro.');
      el.lista.appendChild(li);
    }
    dados.resultados.forEach(n => {
      const li = cria('li');
      const b = cria('button', 'resultado' + (n.id === state.id ? ' resultado--ativo' : ''));
      b.type = 'button';
      b.dataset.id = String(n.id);
      b.appendChild(cria('span', 'resultado__nome', n.nome));
      const sub = [n.designacao_casco, n.classe ? 'Classe ' + n.classe : null].filter(Boolean).join(' · ');
      if (sub) b.appendChild(cria('span', 'resultado__sub', sub));
      const tags = cria('span', 'resultado__tags');
      [n.marinha, n.tipo].forEach(t => t && tags.appendChild(cria('span', 'tag', t)));
      b.appendChild(tags);
      b.addEventListener('click', () => abreFicha(n.id, true));
      li.appendChild(b);
      el.lista.appendChild(li);
    });
    totalPaginas = Math.max(1, Math.ceil(dados.total / dados.por_pagina));
    el.pag.hidden = totalPaginas <= 1;
    el.info.textContent = 'Página ' + dados.pagina + ' de ' + totalPaginas;
    el.ant.disabled = dados.pagina <= 1;
    el.prox.disabled = dados.pagina >= totalPaginas;
    anuncia(dados.total + (dados.total === 1 ? ' navio encontrado.' : ' navios encontrados.'));
  }

  // Mesma regra do servidor (que continua sendo a autoridade): letras, dígitos e  . ' ’ ( ) / -
  const TEXTO_OK = /^[\p{L}\p{N} .'’()/-]*$/u;

  async function buscar() {
    el.limpar.hidden = !el.q.value;
    gravaUrl();
    if (!TEXTO_OK.test(state.q)) {                          // evita uma requisição que o servidor recusaria
      if (ctrlBusca) ctrlBusca.abort();
      limpaFilhos(el.lista); el.total.textContent = ''; el.pag.hidden = true;
      mostraAviso("Use apenas letras, números, espaço e os símbolos . ' ( ) / -", 'info');
      return;
    }
    if (!temFiltro()) {                                     // nada para buscar: volta ao estado inicial
      if (ctrlBusca) ctrlBusca.abort();
      limpaFilhos(el.lista); el.total.textContent = ''; el.pag.hidden = true; mostraAviso('');
      if (state.q.length === 1) mostraAviso('Digite ao menos 2 letras.', 'info');
      return;
    }
    if (ctrlBusca) ctrlBusca.abort();
    ctrlBusca = new AbortController();
    const params = { pagina: String(state.pagina) };
    ['q', 'marinha', 'guerra', 'tipo'].forEach(k => { if (state[k]) params[k] = state[k]; });
    el.lista.setAttribute('aria-busy', 'true');
    try {
      const dados = await api('/api/navios/busca', params, ctrlBusca.signal);
      mostraAviso('');
      renderResultados(dados);
    } catch (e) {
      if (e.name === 'AbortError') return;
      mostraAviso(mensagemErro(e), 'erro');
    } finally {
      el.lista.removeAttribute('aria-busy');
    }
  }

  /* ── ficha ──────────────────────────────────────────────── */
  function secao(titulo) {
    const s = cria('section', 'ficha-secao');
    s.appendChild(cria('h3', 'ficha-secao__titulo', titulo));
    return s;
  }
  function par(dl, rotulo, valor) {
    if (!valor) return;
    const box = cria('div', 'ficha-par');
    box.appendChild(cria('dt', null, rotulo));
    box.appendChild(cria('dd', null, valor));
    dl.appendChild(box);
  }
  function listaTexto(titulo, texto) {
    const linhas = itens(texto);
    if (!linhas.length) return null;
    const s = secao(titulo);
    const ul = cria('ul', 'ficha-lista');
    linhas.forEach(l => ul.appendChild(cria('li', null, l)));
    s.appendChild(ul);
    return s;
  }

  function renderFicha(n) {
    limpaFilhos(el.ficha);
    const topo = cria('header', 'ficha-topo');
    const tags = cria('div', 'ficha-tags');
    [n.marinha, n.tipo, n.guerra].forEach(t => t && tags.appendChild(cria('span', 'tag tag--forte', t)));
    topo.appendChild(tags);
    topo.appendChild(cria('h2', 'ficha-nome', n.nome));
    const sub = [n.designacao_casco ? 'Casco ' + n.designacao_casco : null, n.classe ? 'Classe ' + n.classe : null].filter(Boolean).join(' · ');
    if (sub) topo.appendChild(cria('p', 'ficha-sub', sub));
    el.ficha.appendChild(topo);

    const cron = secao('Cronologia');
    const linha = cria('ol', 'ficha-tempo');
    [['Batismo', n.data_batismo], ['Comissionamento', n.data_comissionamento], ['Baixa', n.data_baixa]].forEach(([r, d]) => {
      const li = cria('li', 'ficha-tempo__item' + (dataBR(d) ? '' : ' ficha-tempo__item--vazio'));
      li.appendChild(cria('span', 'ficha-tempo__rotulo', r));
      li.appendChild(cria('span', 'ficha-tempo__data', dataBR(d) || 'não informado'));
      linha.appendChild(li);
    });
    cron.appendChild(linha);
    el.ficha.appendChild(cron);

    if (n.primeiro_comandante || n.ultimo_comandante) {
      const s = secao('Comando');
      const dl = cria('dl', 'ficha-pares');
      par(dl, 'Primeiro comandante', n.primeiro_comandante);
      par(dl, 'Último comandante', n.ultimo_comandante);
      s.appendChild(dl);
      el.ficha.appendChild(s);
    }
    [listaTexto('Batalhas e operações', n.batalhas), listaTexto('Armamento', n.armamento)].forEach(s => s && el.ficha.appendChild(s));

    [['Situação atual', n.estado_atual], ['Observações', n.observacoes]].forEach(([t, txt]) => {
      if (!txt) return;
      const s = secao(t);
      s.appendChild(cria('p', 'ficha-texto', txt));
      el.ficha.appendChild(s);
    });

    if (n.mesma_classe && n.mesma_classe.length) {
      const s = secao('Outros navios da classe ' + n.classe);
      const ul = cria('ul', 'ficha-relacionados');
      n.mesma_classe.forEach(o => {
        const li = cria('li');
        const b = cria('button', 'tag tag--botao', o.nome + (o.designacao_casco ? ' (' + o.designacao_casco + ')' : ''));
        b.type = 'button';
        b.addEventListener('click', () => abreFicha(o.id, true));
        li.appendChild(b);
        ul.appendChild(li);
      });
      s.appendChild(ul);
      el.ficha.appendChild(s);
    }
    el.ficha.classList.add('consulta-ficha--cheia');
  }

  async function abreFicha(id, rolar) {
    if (!Number.isInteger(id) || id < 1) return;             // só números inteiros positivos
    if (ctrlFicha) ctrlFicha.abort();
    ctrlFicha = new AbortController();
    state.id = id;
    gravaUrl();
    el.lista.querySelectorAll('.resultado').forEach(b => b.classList.toggle('resultado--ativo', b.dataset.id === String(id)));
    try {
      const n = await api('/api/navios/' + id, null, ctrlFicha.signal);
      mostraAviso('');
      renderFicha(n);
      anuncia('Ficha de ' + n.nome + ' carregada.');
      if (rolar) {
        el.ficha.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth', block: 'start' });
        el.ficha.focus({ preventScroll: true });
      }
    } catch (e) {
      if (e.name === 'AbortError') return;
      mostraAviso(e.status === 404 ? 'Navio não encontrado.' : mensagemErro(e), 'erro');
    }
  }

  /* ── eventos ────────────────────────────────────────────── */
  function agenda() {
    clearTimeout(timer);
    timer = setTimeout(() => { state.q = el.q.value.trim(); state.pagina = 1; buscar(); }, 260);
  }
  el.q.addEventListener('input', agenda);
  el.form.addEventListener('submit', e => { e.preventDefault(); clearTimeout(timer); state.q = el.q.value.trim(); state.pagina = 1; buscar(); });
  el.limpar.addEventListener('click', () => { el.q.value = ''; state.q = ''; state.pagina = 1; buscar(); el.q.focus(); });
  [['marinha', el.marinha], ['guerra', el.guerra], ['tipo', el.tipo]].forEach(([k, s]) => s.addEventListener('change', () => { state[k] = s.value; state.pagina = 1; buscar(); }));
  el.ant.addEventListener('click', () => { if (state.pagina > 1) { state.pagina--; buscar(); } });
  el.prox.addEventListener('click', () => { if (state.pagina < totalPaginas) { state.pagina++; buscar(); } });

  /* ── início ─────────────────────────────────────────────── */
  function iniciaEstatico() {
    // Versão publicada sem servidor (GitHub Pages): não existe API, então explicamos em vez de falhar.
    [el.q, el.marinha, el.guerra, el.tipo].forEach(c => { c.disabled = true; });
    el.grade.hidden = true;
    mostraAviso('A consulta ao banco de dados só funciona quando o site roda com o servidor (Flask + PostgreSQL). ' +
                'Esta é a versão estática publicada no GitHub Pages: rode o site localmente ou em uma hospedagem com servidor para consultar os navios (veja o README).', 'info');
  }

  async function inicia() {
    if (MODE === 'static' && !API) { iniciaEstatico(); return; }
    const p = new URLSearchParams(location.search);
    state.q = (p.get('q') || '').slice(0, 60);
    state.marinha = (p.get('marinha') || '').slice(0, 40);
    state.guerra = (p.get('guerra') || '').slice(0, 40);
    state.tipo = (p.get('tipo') || '').slice(0, 60);
    el.q.value = state.q;
    await carregaFiltros();
    if (temFiltro()) await buscar();
    const id = /^\d{1,9}$/.test(p.get('id') || '') ? parseInt(p.get('id'), 10) : null;
    if (id) abreFicha(id, false);
  }
  inicia();
})();
