"""
API de consulta de navios - SOMENTE LEITURA (Royal Navy v3.0).

Camadas de seguranca (de fora para dentro):
  1. Host permitido, metodo GET, tamanho maximo da URL              (app.py / aqui)
  2. Limite de requisicoes por IP (Flask-Limiter)
  3. Validacao estrita: so caracteres permitidos, tamanhos e chaves conhecidas
  4. Consultas SEMPRE parametrizadas (nunca SQL montado com texto do usuario)
  5. Conexao com um papel do PostgreSQL que so le a VIEW v_navios (db/02_papel_leitura.sql)
  6. Timeouts, pool pequeno, LIMIT em todas as consultas
  7. Erros genericos para o cliente; detalhes so no log do servidor
"""

from __future__ import annotations

import atexit
import logging
import os
import re
import threading
import time
import unicodedata
from datetime import date
from pathlib import Path

import psycopg
from flask import Blueprint, current_app, g, jsonify, request
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from psycopg.conninfo import make_conninfo
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool, PoolTimeout

log = logging.getLogger("royalnavy.consulta")

# Raiz confiavel para "verify-full" em banco remoto (ISRG Root X1, Let's Encrypt - publica e estavel ate 2035).
# Um arquivo proprio evita depender de qual pacote de certificados do SO o libpq empacotado consegue achar.
_RAIZ_TLS = Path(__file__).resolve().parent / "deploy" / "isrg-root-x1.pem"

bp = Blueprint("consulta", __name__, url_prefix="/api")

limiter = Limiter(
    get_remote_address,
    default_limits=[],
    storage_uri=os.environ.get("RATELIMIT_STORAGE_URI", "memory://"),
    strategy="moving-window",
    headers_enabled=True,
)

POR_PAGINA = 10
MAX_PAGINA = 20
CHAVES_BUSCA = {"q", "marinha", "guerra", "tipo", "pagina"}
EXTRAS_PERMITIDOS = set(" .'’()/-")          # alem de letras e digitos
MAX_QUERY_STRING = 400                            # bytes


class ValorInvalido(Exception):
    """Entrada fora do permitido (vira HTTP 400 com mensagem segura)."""

    def __init__(self, mensagem="Consulta inválida."):
        super().__init__(mensagem)
        self.mensagem = mensagem


class BancoIndisponivel(Exception):
    """Banco nao configurado ou fora do ar (vira HTTP 503)."""


# ── Validacao de entrada ─────────────────────────────────────────────────────
def limpar_texto(bruto, minimo, maximo, rotulo):
    """Normaliza (NFC, espacos) e valida: so letras, digitos e  . ' ’ ( ) / -  ."""
    if bruto is None:
        return None
    texto = re.sub(r"\s+", " ", unicodedata.normalize("NFC", bruto)).strip()
    if not texto:
        return None
    if not (minimo <= len(texto) <= maximo):
        raise ValorInvalido(f"{rotulo}: use de {minimo} a {maximo} caracteres.")
    for ch in texto:
        if not (ch.isalnum() or ch in EXTRAS_PERMITIDOS):
            raise ValorInvalido(f"{rotulo}: caracteres não permitidos.")
    return texto


def validar_busca(args):
    if len(request.query_string) > MAX_QUERY_STRING:
        raise ValorInvalido("Consulta longa demais.")
    desconhecidas = set(args.keys()) - CHAVES_BUSCA
    if desconhecidas or any(len(args.getlist(k)) > 1 for k in args.keys()):
        raise ValorInvalido("Parâmetros inválidos.")

    q = limpar_texto(args.get("q"), 2, 60, "Busca")
    marinha = limpar_texto(args.get("marinha"), 2, 40, "Marinha")
    guerra = limpar_texto(args.get("guerra"), 2, 40, "Guerra")
    tipo = limpar_texto(args.get("tipo"), 2, 60, "Tipo")
    if q is None and not (marinha or guerra or tipo):
        raise ValorInvalido("Digite ao menos 2 letras ou escolha um filtro.")

    bruta = args.get("pagina", "1")
    if not re.fullmatch(r"\d{1,2}", bruta) or not (1 <= int(bruta) <= MAX_PAGINA):
        raise ValorInvalido(f"A página deve ser de 1 a {MAX_PAGINA}.")
    return q, marinha, guerra, tipo, int(bruta)


# ── Banco de dados ───────────────────────────────────────────────────────────
_pool = None
_pool_lock = threading.Lock()


def _segundos(nome, padrao):
    """Le um tempo limite em segundos do ambiente, limitado a 1-15 s (o gunicorn mata a requisicao em 20 s).

    O padrao de 8 s da conexao cobre o 'cold start' do Neon (banco suspenso por inatividade); o teto evita
    que um banco fora do ar prenda as threads do servidor.
    """
    try:
        valor = float(os.environ.get(nome, padrao))
    except ValueError:
        valor = padrao
    return max(1.0, min(15.0, valor))


def _obter_pool():
    """Cria o pool na primeira chamada. Se o banco cair, tenta de novo na proxima."""
    global _pool
    if _pool is not None:
        return _pool
    with _pool_lock:
        if _pool is not None:
            return _pool
        senha = os.environ.get("DB_PASSWORD")
        usuario = os.environ.get("DB_USER")
        if not senha or not usuario:
            import config_env
            raise BancoIndisponivel("DB_USER/DB_PASSWORD nao configurados (" + config_env.resumo() + ")")
        if usuario in ("postgres", "root", "admin"):
            raise BancoIndisponivel("a API nao deve usar um usuario administrador")
        conninfo = make_conninfo(
            host=os.environ.get("DB_HOST", "localhost"),
            port=os.environ.get("DB_PORT", "5432"),
            dbname=os.environ.get("DB_NAME", "postgres"),
            user=usuario,
            password=senha,
            sslmode=os.environ.get("DB_SSLMODE", "prefer"),
            sslrootcert=str(_RAIZ_TLS),   # verify-full: raiz fixa do projeto (ver comentario acima)
            connect_timeout=_segundos("DB_CONNECT_TIMEOUT", 8),
            application_name="royalnavy-consulta",
        )
        pool = ConnectionPool(
            conninfo,
            min_size=1,
            max_size=int(os.environ.get("DB_POOL_MAX", "5")),
            timeout=_segundos("DB_POOL_TIMEOUT", 5),
            max_lifetime=1800,
            open=False,
            check=ConnectionPool.check_connection,     # testa a conexao antes de entrega-la: o Neon/pgbouncer derruba as ociosas
            kwargs={"autocommit": True, "row_factory": dict_row,
                    "options": "-c default_transaction_read_only=on"},
        )
        try:
            pool.open(wait=True, timeout=_segundos("DB_CONNECT_TIMEOUT", 8) + 2)
        except Exception as exc:
            pool.close()
            raise BancoIndisponivel(str(exc).splitlines()[0][:120]) from exc
        _pool = pool
        atexit.register(pool.close)                   # encerra as conexoes ao sair (sem avisos)
        return _pool


def consultar(sql, params=None):
    """Executa UMA consulta parametrizada e devolve as linhas (lista de dicts)."""
    try:
        with _obter_pool().connection() as conn:
            return conn.execute(sql, params or {}).fetchall()
    except PoolTimeout as exc:
        raise BancoIndisponivel("pool esgotado") from exc
    except psycopg.OperationalError as exc:
        raise BancoIndisponivel(str(exc).splitlines()[0][:120]) from exc


SQL_BUSCA = r"""
WITH p AS (
  SELECT public.rn_norm(%(q)s::text) AS q,
         replace(replace(replace(public.rn_norm(%(q)s::text), '\', '\\'), '%%', '\%%'), '_', '\_') AS qlike
)
SELECT v.id, v.nome, v.designacao_casco, v.marinha, v.tipo, v.classe, v.guerra,
       count(*) OVER () AS total
FROM public.v_navios v, p
WHERE (%(q)s::text IS NULL
       OR v.busca_norm LIKE '%%' || p.qlike || '%%'
       OR word_similarity(p.q, v.busca_norm) >= 0.5)
  AND (%(marinha)s::text IS NULL OR v.marinha = %(marinha)s::text)
  AND (%(guerra)s::text  IS NULL OR v.guerra  = %(guerra)s::text)
  AND (%(tipo)s::text    IS NULL OR v.tipo    = %(tipo)s::text)
ORDER BY coalesce(v.nome_norm = p.q, false) DESC,
         coalesce(v.nome_norm LIKE p.qlike || '%%', false) DESC,
         coalesce(word_similarity(p.q, v.busca_norm), 0) DESC,
         v.nome
LIMIT %(lim)s OFFSET %(off)s
"""

SQL_FICHA = """
SELECT id, nome, designacao_casco, marinha, tipo, classe, guerra,
       data_batismo, data_comissionamento, data_baixa,
       primeiro_comandante, ultimo_comandante,
       batalhas, armamento, estado_atual, observacoes
FROM public.v_navios
WHERE id = %(id)s
"""

SQL_MESMA_CLASSE = """
SELECT id, nome, designacao_casco
FROM public.v_navios
WHERE classe = %(classe)s AND marinha = %(marinha)s AND id <> %(id)s
ORDER BY nome
LIMIT 6
"""

SQL_FILTROS = """
SELECT 'marinha' AS campo, marinha AS valor, count(*) AS total FROM public.v_navios GROUP BY marinha
UNION ALL
SELECT 'guerra', guerra, count(*) FROM public.v_navios GROUP BY guerra
UNION ALL
SELECT 'tipo', tipo, count(*) FROM public.v_navios GROUP BY tipo
ORDER BY 1, 3 DESC, 2
"""

_cache_filtros = {"quando": 0.0, "dados": None}


def _iso(valor):
    return valor.isoformat() if isinstance(valor, date) else valor


# ── Respostas ────────────────────────────────────────────────────────────────
def resposta(dados, status=200):
    r = jsonify(dados)
    r.status_code = status
    return r


def erro(codigo, mensagem, status):
    return resposta({"erro": codigo, "mensagem": mensagem}, status)


@bp.errorhandler(ValorInvalido)
def _invalido(e):
    return erro("consulta_invalida", e.mensagem, 400)


@bp.errorhandler(BancoIndisponivel)
def _indisponivel(e):
    log.error("Banco indisponivel: %s", e)              # detalhe so no log do servidor
    msg = "O serviço de consulta está indisponível no momento."
    if current_app.debug:                               # debug so liga em localhost: aqui a dica nao vaza nada
        msg += f" (Desenvolvimento: verifique se o PostgreSQL está rodando e se o arquivo de segredos existe — motivo: {e})"
    return erro("servico_indisponivel", msg, 503)


@bp.errorhandler(404)
def _nao_encontrado(_e):
    return erro("nao_encontrado", "Recurso não encontrado.", 404)


@bp.errorhandler(405)
def _metodo(_e):
    return erro("metodo_nao_permitido", "Método não permitido.", 405)


@bp.errorhandler(429)
def _limite(_e):
    return erro("muitas_requisicoes", "Muitas requisições. Aguarde um instante e tente de novo.", 429)


@bp.errorhandler(Exception)
def _inesperado(e):
    from werkzeug.exceptions import HTTPException
    if isinstance(e, HTTPException):
        return erro("erro_http", e.name, e.code or 500)
    log.exception("Erro inesperado na API")             # traceback completo so no servidor
    return erro("erro_interno", "Erro interno. Tente novamente.", 500)


@bp.before_request
def _inicio():
    g.t0 = time.perf_counter()


@bp.after_request
def _fim(resp):
    resp.headers["Cache-Control"] = "no-store"
    resp.headers["X-Content-Type-Options"] = "nosniff"
    resp.headers["X-Robots-Tag"] = "noindex"                # a API nao deve aparecer em buscadores
    origem = request.headers.get("Origin")
    permitidas = {o.strip() for o in os.environ.get("CORS_ORIGINS", "").split(",") if o.strip()}
    if origem and origem in permitidas:                 # CORS por lista exata; nunca '*'
        resp.headers["Access-Control-Allow-Origin"] = origem
        resp.headers["Vary"] = "Origin"
    log.info("%s %s -> %s (%.0f ms)", request.method, request.path, resp.status_code,
             (time.perf_counter() - g.get("t0", time.perf_counter())) * 1000)
    return resp


# ── Rotas ────────────────────────────────────────────────────────────────────
@bp.get("/saude")
def saude():
    try:
        consultar("SELECT 1 AS ok")
        return resposta({"ok": True, "banco": "ok"})
    except BancoIndisponivel:
        return resposta({"ok": False, "banco": "indisponivel"}, 503)


@bp.get("/navios/busca")
@limiter.limit("30 per minute")
def busca():
    q, marinha, guerra, tipo, pagina = validar_busca(request.args)
    linhas = consultar(SQL_BUSCA, {"q": q, "marinha": marinha, "guerra": guerra, "tipo": tipo,
                                   "lim": POR_PAGINA, "off": (pagina - 1) * POR_PAGINA})
    total = linhas[0]["total"] if linhas else 0
    for r in linhas:
        r.pop("total", None)
    return resposta({"total": total, "pagina": pagina, "por_pagina": POR_PAGINA, "resultados": linhas})


@bp.get("/navios/filtros")
@limiter.limit("30 per minute")
def filtros():
    agora = time.monotonic()
    if _cache_filtros["dados"] is None or agora - _cache_filtros["quando"] > 60:
        dados = {"marinhas": [], "guerras": [], "tipos": []}
        chave = {"marinha": "marinhas", "guerra": "guerras", "tipo": "tipos"}
        for r in consultar(SQL_FILTROS):
            dados[chave[r["campo"]]].append({"valor": r["valor"], "total": r["total"]})
        _cache_filtros.update(quando=agora, dados=dados)
    return resposta(_cache_filtros["dados"])


@bp.get("/navios/<int:navio_id>")
@limiter.limit("60 per minute")
def ficha(navio_id):
    if request.args:
        raise ValorInvalido("Parâmetros inválidos.")
    if not (1 <= navio_id <= 2_147_483_647):
        return erro("nao_encontrado", "Navio não encontrado.", 404)
    linhas = consultar(SQL_FICHA, {"id": navio_id})
    if not linhas:
        return erro("nao_encontrado", "Navio não encontrado.", 404)
    navio = linhas[0]
    for campo in ("data_batismo", "data_comissionamento", "data_baixa"):
        navio[campo] = _iso(navio[campo])
    navio["mesma_classe"] = (consultar(SQL_MESMA_CLASSE, {"classe": navio["classe"], "marinha": navio["marinha"],
                                                          "id": navio_id}) if navio["classe"] else [])
    return resposta(navio)


def init_app(app):
    """Liga o limitador e registra a API. Limite geral por IP + limites por rota."""
    limiter.limit("120 per minute")(bp)
    limiter.init_app(app)
    app.register_blueprint(bp)
