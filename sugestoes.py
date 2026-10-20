"""
Sugestoes de navios (Royal Navy v4.3).

O visitante sugere um navio que ainda nao esta no acervo:
  1. o nome e comparado com o banco (SOMENTE LEITURA, pelo mesmo papel navios_leitura da consulta),
     ignorando acentos, maiusculas e prefixos como USS/HMS/SMS;
  2. se ja existe -> "Navio ja existente"; se e so parecido -> "Voce quis dizer...?";
  3. se e novo -> fica registrado como "em analise" num ARQUIVO JSON (nao no banco).

Onde o arquivo fica (variaveis de ambiente):
  * SUGESTOES_GITHUB_REPO + SUGESTOES_GITHUB_TOKEN -> arquivo num repositorio do GitHub (API REST);
    recomendado em producao: o disco do Render gratuito e apagado a cada reinicio. Opcionais:
    SUGESTOES_GITHUB_ARQUIVO (padrao sugestoes.json) e SUGESTOES_GITHUB_BRANCH (padrao: a do repositorio).
  * SUGESTOES_ARQUIVO -> arquivo local (desenvolvimento e testes).
  * nenhum dos dois -> a pagina avisa que o registro esta indisponivel (nunca grava em lugar efemero sem querer).

Painel do administrador (/admin): login so com senha, guardada apenas como hash (ADMIN_PASSWORD_HASH,
gerado por ferramentas/gerar_hash_admin.py). Sem a variavel, o painel nao existe (404). Ao aprovar, o
painel gera o comando SQL para o administrador colar no banco: o site NUNCA escreve no PostgreSQL.
"""

from __future__ import annotations

import base64
import json
import logging
import os
import re
import secrets
import threading
import time
import urllib.error
import urllib.request
from collections import deque
from datetime import datetime, timezone
from functools import wraps
from pathlib import Path
from urllib.parse import quote, urlsplit

from flask import Blueprint, abort, redirect, render_template, request, session, url_for
from werkzeug.security import check_password_hash

import protecao
from consulta_api import BancoIndisponivel, ValorInvalido, consultar, limiter, limpar_texto

log = logging.getLogger("royalnavy.sugestoes")

bp = Blueprint("sugestoes", __name__)

STATUS = {"em_analise": "Em análise", "aprovado": "Aprovado", "rejeitado": "Rejeitado"}
MAX_EM_ANALISE = 500            # fila maxima: protege o arquivo contra enxurrada de sugestoes
MAX_TOTAL = 3000
MAX_HISTORICO = 20
LIMIAR_PARECIDO = 0.4           # similaridade de trigramas (pg_trgm) para "Voce quis dizer...?"

# Prefixos de navio ignorados na comparacao ("USS Arizona" == "Arizona"); mesmo texto no SQL e no Python
PREFIXOS_RE = r"^(uss|hms|sms|kms|hmas|hmcs|hmnzs|ijn|hnlms|orp)\.?\s+"


# ═════════════════════════════════════ armazenamento ══════════════════════════════════════════════
class ErroArmazem(Exception):
    """Falha ao ler/gravar o arquivo de sugestoes (rede, permissao, formato)."""


class Conflito(ErroArmazem):
    """O arquivo mudou entre a leitura e a gravacao (outra requisicao gravou antes)."""


def _vazio():
    return {"versao": 1, "sugestoes": []}


def _validar_estrutura(dados):
    if not isinstance(dados, dict) or not isinstance(dados.get("sugestoes"), list):
        raise ErroArmazem("arquivo de sugestoes em formato inesperado")
    return dados


class ArmazemArquivo:
    """Arquivo JSON local. Gravacao atomica (arquivo temporario + rename)."""

    tipo = "arquivo"

    def __init__(self, caminho):
        self.caminho = Path(caminho)

    def ler(self):
        try:
            texto = self.caminho.read_text(encoding="utf-8")
        except FileNotFoundError:
            return _vazio(), None
        except OSError as exc:
            raise ErroArmazem(f"nao foi possivel ler {self.caminho.name}: {exc.strerror}") from exc
        try:
            dados = json.loads(texto)
        except ValueError as exc:
            raise ErroArmazem("arquivo de sugestoes corrompido") from exc
        return _validar_estrutura(dados), str(self.caminho.stat().st_mtime_ns)

    def gravar(self, dados, versao, mensagem):
        atual = str(self.caminho.stat().st_mtime_ns) if self.caminho.exists() else None
        if atual != versao:
            raise Conflito("arquivo alterado por outra gravacao")
        self.caminho.parent.mkdir(parents=True, exist_ok=True)
        tmp = self.caminho.with_name(self.caminho.name + f".{secrets.token_hex(4)}.tmp")
        tmp.write_text(json.dumps(dados, ensure_ascii=False, indent=1), encoding="utf-8")
        os.replace(tmp, self.caminho)
        return str(self.caminho.stat().st_mtime_ns)


class ArmazemGitHub:
    """Arquivo JSON num repositorio do GitHub (API REST 'contents'). Cada gravacao e um commit."""

    tipo = "github"
    API = "https://api.github.com"

    def __init__(self, repo, token, caminho="sugestoes.json", branch=""):
        if not re.fullmatch(r"[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+", repo):
            raise ValueError("SUGESTOES_GITHUB_REPO deve ser 'dono/repositorio'")
        if not re.fullmatch(r"[A-Za-z0-9_./-]{1,200}", caminho) or ".." in caminho:
            raise ValueError("SUGESTOES_GITHUB_ARQUIVO invalido")
        self.repo, self.token, self.caminho, self.branch = repo, token, caminho, branch

    def _url(self):
        url = f"{self.API}/repos/{self.repo}/contents/{quote(self.caminho)}"
        return url + (f"?ref={quote(self.branch)}" if self.branch else "")

    def _pedido(self, metodo, corpo=None):
        req = urllib.request.Request(
            self._url() if metodo == "GET" else self._url().split("?")[0], method=metodo,
            data=json.dumps(corpo).encode("utf-8") if corpo is not None else None,
            headers={"Authorization": f"Bearer {self.token}", "Accept": "application/vnd.github+json",
                     "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "royalnavy-sugestoes",
                     "Content-Type": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=8) as resp:            # nosec B310 - URL fixa https da API
                return resp.status, json.loads(resp.read() or b"{}")
        except urllib.error.HTTPError as exc:
            try:
                corpo_erro = json.loads(exc.read() or b"{}")
            except ValueError:
                corpo_erro = {}
            return exc.code, corpo_erro
        except (urllib.error.URLError, TimeoutError, OSError) as exc:
            raise ErroArmazem(f"GitHub inacessivel: {exc.__class__.__name__}") from exc

    def ler(self):
        status, corpo = self._pedido("GET")
        if status == 404:
            return _vazio(), None
        if status != 200:
            raise ErroArmazem(f"GitHub respondeu {status} ao ler ({corpo.get('message', '')[:80]})")
        if corpo.get("encoding") != "base64" or not corpo.get("content"):
            raise ErroArmazem("arquivo de sugestoes grande demais ou vazio no GitHub")
        try:
            dados = json.loads(base64.b64decode(corpo["content"]).decode("utf-8"))
        except ValueError as exc:
            raise ErroArmazem("arquivo de sugestoes corrompido no GitHub") from exc
        return _validar_estrutura(dados), corpo.get("sha")

    def gravar(self, dados, versao, mensagem):
        corpo = {"message": mensagem[:120],
                 "content": base64.b64encode(json.dumps(dados, ensure_ascii=False, indent=1).encode("utf-8")).decode("ascii")}
        if versao:
            corpo["sha"] = versao
        if self.branch:
            corpo["branch"] = self.branch
        status, resp = self._pedido("PUT", corpo)
        # 409 = sha desatualizado; 422 "sha" = o arquivo passou a existir depois da nossa leitura
        if status == 409 or (status == 422 and "sha" in str(resp.get("message", "")).lower()):
            raise Conflito("arquivo alterado por outra gravacao")
        if status not in (200, 201):
            raise ErroArmazem(f"GitHub respondeu {status} ao gravar ({str(resp.get('message', ''))[:80]})")
        return resp.get("content", {}).get("sha")


class Repositorio:
    """Leitura com cache curto e gravacao 'ler -> alterar -> gravar' com nova tentativa em conflito."""

    TTL = 20.0

    def __init__(self, armazem):
        self.armazem = armazem
        self._lock = threading.Lock()
        self._cache = None              # (instante, dados, versao)

    def ler(self, fresco=False):
        with self._lock:
            if not fresco and self._cache and time.monotonic() - self._cache[0] < self.TTL:
                return json.loads(json.dumps(self._cache[1]))       # copia: ninguem altera o cache por acidente
            dados, versao = self.armazem.ler()
            self._cache = (time.monotonic(), dados, versao)
            return json.loads(json.dumps(dados))

    def alterar(self, funcao, mensagem):
        """funcao(dados) altera 'dados' e devolve o resultado; None = nada a gravar."""
        for tentativa in range(3):
            with self._lock:
                dados, versao = self.armazem.ler()
                resultado = funcao(dados)
                if resultado is None:
                    self._cache = (time.monotonic(), dados, versao)
                    return None
                try:
                    nova = self.armazem.gravar(dados, versao, mensagem)
                except Conflito:
                    self._cache = None
                    time.sleep(0.15 * (tentativa + 1))
                    continue
                self._cache = (time.monotonic(), dados, nova)
                return resultado
        raise ErroArmazem("muitas gravacoes simultaneas; tente de novo")


_repos: dict = {}
_repos_lock = threading.Lock()


def repositorio():
    """Repositorio configurado pelas variaveis de ambiente, ou None se nao houver armazenamento."""
    repo_gh, token = os.environ.get("SUGESTOES_GITHUB_REPO", "").strip(), os.environ.get("SUGESTOES_GITHUB_TOKEN", "").strip()
    if repo_gh and token:
        chave = ("github", repo_gh, os.environ.get("SUGESTOES_GITHUB_ARQUIVO", "sugestoes.json"),
                 os.environ.get("SUGESTOES_GITHUB_BRANCH", ""), token)
        fabrica = lambda: ArmazemGitHub(repo_gh, token, chave[2], chave[3])      # noqa: E731
    elif os.environ.get("SUGESTOES_ARQUIVO", "").strip():
        chave = ("arquivo", os.environ["SUGESTOES_ARQUIVO"].strip())
        fabrica = lambda: ArmazemArquivo(chave[1])                              # noqa: E731
    else:
        return None
    with _repos_lock:
        if chave not in _repos:
            _repos[chave] = Repositorio(fabrica())
        return _repos[chave]


# ═════════════════════════════════════ comparacao com o banco (so leitura) ════════════════════════
SQL_ALVO = "SELECT regexp_replace(public.rn_norm(%(nome)s::text), %(re)s, '') AS alvo"

SQL_EXATO = """
SELECT id, nome, designacao_casco
FROM public.v_navios
WHERE regexp_replace(nome_norm, %(re)s, '') = %(alvo)s
   OR lower(coalesce(designacao_casco, '')) = %(alvo)s
ORDER BY nome
LIMIT 3
"""

SQL_PARECIDOS = """
SELECT id, nome, designacao_casco, similarity(regexp_replace(nome_norm, %(re)s, ''), %(alvo)s) AS sim
FROM public.v_navios
WHERE similarity(regexp_replace(nome_norm, %(re)s, ''), %(alvo)s) >= %(limiar)s
ORDER BY sim DESC, nome
LIMIT 3
"""

SQL_OPCOES = """
SELECT 'marinha' AS campo, marinha AS valor FROM public.v_navios GROUP BY marinha
UNION ALL
SELECT 'guerra', guerra FROM public.v_navios GROUP BY guerra
ORDER BY 1, 2
"""

_opcoes_cache = {"quando": 0.0, "dados": {"marinhas": [], "guerras": []}}


def opcoes():
    """Marinhas e guerras ja existentes (sugestoes no formulario). Falha silenciosa: sao so dicas."""
    if time.monotonic() - _opcoes_cache["quando"] > 300:
        try:
            dados = {"marinhas": [], "guerras": []}
            for r in consultar(SQL_OPCOES):
                dados["marinhas" if r["campo"] == "marinha" else "guerras"].append(r["valor"])
            _opcoes_cache.update(quando=time.monotonic(), dados=dados)
        except BancoIndisponivel:
            pass
    return _opcoes_cache["dados"]


def comparar(nome):
    """Devolve (chave_normalizada, existentes_exatos, parecidos) consultando o banco so para leitura."""
    alvo = consultar(SQL_ALVO, {"nome": nome, "re": PREFIXOS_RE})[0]["alvo"].strip()
    if not alvo:
        raise ValorInvalido("Nome do navio: digite o nome, não só o prefixo.")
    exatos = consultar(SQL_EXATO, {"re": PREFIXOS_RE, "alvo": alvo})
    parecidos = [] if exatos else consultar(SQL_PARECIDOS, {"re": PREFIXOS_RE, "alvo": alvo, "limiar": LIMIAR_PARECIDO})
    return alvo, exatos, parecidos


# ═════════════════════════════════════ validacao ══════════════════════════════════════════════════
def _fonte(bruta):
    """Fonte opcional: um endereco http(s) ou um texto curto."""
    texto = (bruta or "").strip()
    if not texto:
        return None
    if len(texto) > 200:
        raise ValorInvalido("Fonte: use até 200 caracteres.")
    if re.match(r"(?i)https?://", texto):
        partes = urlsplit(texto)
        if partes.scheme.lower() not in ("http", "https") or not partes.netloc or re.search(r"[\s<>\"'`\\]", texto):
            raise ValorInvalido("Fonte: endereço inválido.")
        return texto
    return limpar_texto(texto, 2, 200, "Fonte")


def validar_sugestao(form):
    nome = limpar_texto(form.get("nome"), 2, 60, "Nome do navio")
    if not nome:
        raise ValorInvalido("Digite o nome do navio (ao menos 2 letras).")
    return {
        "nome": nome,
        "marinha": limpar_texto(form.get("marinha"), 2, 40, "Marinha"),
        "guerra": limpar_texto(form.get("guerra"), 2, 40, "Guerra"),
        "fonte": _fonte(form.get("fonte")),
    }


def _agora():
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


# ═════════════════════════════════════ pagina publica ═════════════════════════════════════════════
def _resultado(tipo, **extra):
    """Guarda o resultado e redireciona (POST -> redirect -> GET): recarregar nao reenvia o formulario."""
    session["sug_resultado"] = {"tipo": tipo, **extra}
    return redirect(url_for("sugestoes.sugerir"), code=303)


def _pagina(status=200, **ctx):
    ctx.setdefault("opcoes", opcoes())
    ctx.setdefault("armazenamento", repositorio() is not None)
    return render_template("sugerir.html", **ctx), status


@bp.route("/sugerir", methods=["GET", "POST"])
@limiter.limit("6 per minute;40 per hour", methods=["POST"])
@protecao.exige_csrf
def sugerir():
    if request.method == "GET":
        resultado = session.pop("sug_resultado", None)
        inicial = {}
        try:                                            # ?nome=... vindo da consulta (opcional; ignora se invalido)
            inicial["nome"] = limpar_texto(request.args.get("nome"), 2, 60, "Nome") or ""
        except ValorInvalido:
            pass
        return _pagina(resultado=resultado, valores=inicial)

    valores = {k: (request.form.get(k) or "")[:200] for k in ("nome", "marinha", "guerra", "fonte")}
    if protecao.isca_preenchida():                      # robo: finge que deu certo e nao grava nada
        log.info("Sugestao descartada pelo campo-isca")
        return _resultado("registrada", nome=valores["nome"][:60])
    try:
        dados = validar_sugestao(request.form)
    except ValorInvalido as exc:
        return _pagina(400, erro=exc.mensagem, valores=valores)

    repo = repositorio()
    if repo is None:
        return _pagina(503, erro="O registro de sugestões não está disponível no momento.", valores=valores)
    try:
        chave, exatos, parecidos = comparar(dados["nome"])
    except ValorInvalido as exc:
        return _pagina(400, erro=exc.mensagem, valores=valores)
    except BancoIndisponivel:
        return _pagina(503, erro="Não foi possível consultar o acervo agora. Tente de novo em instantes.", valores=valores)

    if exatos:
        return _resultado("existente", nome=dados["nome"],
                          navios=[{"id": n["id"], "nome": n["nome"], "casco": n["designacao_casco"]} for n in exatos])

    confirmado = request.form.get("confirmar") == "1"
    if parecidos and not confirmado:
        return _pagina(200, parecidos=parecidos, valores=valores, confirmar=True)

    def registrar(arquivo):
        lista = arquivo["sugestoes"]
        for s in lista:
            if s.get("chave") == chave:
                if s.get("status") == "em_analise":
                    s["pedidos"] = int(s.get("pedidos", 1)) + 1
                    s["atualizada_em"] = _agora()
                    return {"tipo": "em_analise", "pedidos": s["pedidos"]}
                return {"tipo": "avaliada", "status": s.get("status")}
        if sum(1 for s in lista if s.get("status") == "em_analise") >= MAX_EM_ANALISE or len(lista) >= MAX_TOTAL:
            return {"tipo": "fila_cheia"}
        lista.append({
            "id": secrets.token_hex(6), "nome": dados["nome"], "chave": chave,
            "marinha": dados["marinha"], "guerra": dados["guerra"], "fonte": dados["fonte"],
            "status": "em_analise", "pedidos": 1, "lida": False,
            "criada_em": _agora(), "atualizada_em": _agora(),
            "dados": {}, "notas": "", "historico": [{"em": _agora(), "acao": "sugerida"}],
        })
        return {"tipo": "registrada"}

    try:
        r = repo.alterar(registrar, f"Sugestao: {dados['nome']}")
    except ErroArmazem as exc:
        log.error("Falha ao registrar sugestao: %s", exc)
        return _pagina(503, erro="Não foi possível registrar a sugestão agora. Tente de novo em instantes.", valores=valores)
    if r["tipo"] == "fila_cheia":
        return _pagina(503, erro="A fila de sugestões está cheia no momento. Tente de novo mais tarde.", valores=valores)
    return _resultado(r["tipo"], nome=dados["nome"], **{k: v for k, v in r.items() if k != "tipo"})


# ═════════════════════════════════════ painel do administrador ════════════════════════════════════
INATIVIDADE = 20 * 60           # sai sozinho apos 20 min sem uso
DURACAO_MAX = 2 * 60 * 60       # e no maximo 2 h apos o login
FALHAS_JANELA, FALHAS_MAX = 15 * 60, 20
_falhas = deque()               # instantes de logins errados (de qualquer IP): trava contra forca bruta distribuida
_falhas_lock = threading.Lock()


def _hash_admin():
    return os.environ.get("ADMIN_PASSWORD_HASH", "").strip()


def _travado():
    agora = time.monotonic()
    with _falhas_lock:
        while _falhas and agora - _falhas[0] > FALHAS_JANELA:
            _falhas.popleft()
        return len(_falhas) >= FALHAS_MAX


def _registrar_falha():
    with _falhas_lock:
        _falhas.append(time.monotonic())


def admin_logado():
    if not session.get("admin"):
        return False
    agora = time.time()
    if agora - session.get("admin_inicio", 0) > DURACAO_MAX or agora - session.get("admin_atividade", 0) > INATIVIDADE:
        session.clear()
        return False
    session["admin_atividade"] = agora
    return True


def exige_admin(view):
    @wraps(view)
    def interno(*args, **kwargs):
        if not _hash_admin():
            abort(404)                                  # painel desligado: nem revela que existe
        if not admin_logado():
            return redirect(url_for("sugestoes.entrar"))
        return view(*args, **kwargs)
    return interno


@bp.after_request
def _cabecalhos(resp):
    resp.headers["Cache-Control"] = "no-store"          # paginas com token CSRF e dados do painel
    if request.path.startswith("/admin"):
        resp.headers["X-Robots-Tag"] = "noindex, nofollow"
        # same-origin (e nao no-referrer): com no-referrer o navegador manda "Origin: null" nos POST,
        # o que a checagem de origem do CSRF recusa com razao
        resp.headers["Referrer-Policy"] = "same-origin"
    return resp


@bp.route("/admin/entrar", methods=["GET", "POST"])
@limiter.limit("5 per 15 minutes", methods=["POST"])
@protecao.exige_csrf
def entrar():
    if not _hash_admin():
        abort(404)
    if request.method == "GET":
        if admin_logado():
            return redirect(url_for("sugestoes.painel"))
        return render_template("admin_entrar.html"), 200
    if _travado():
        log.warning("Login do painel travado por excesso de tentativas")
        return render_template("admin_entrar.html", erro="Muitas tentativas. Aguarde alguns minutos."), 429
    senha = request.form.get("senha", "")
    try:
        ok = 0 < len(senha) <= 200 and check_password_hash(_hash_admin(), senha)
    except (ValueError, TypeError):
        log.error("ADMIN_PASSWORD_HASH em formato invalido")
        ok = False
    if not ok:
        _registrar_falha()
        log.warning("Senha do painel incorreta (ip=%s)", request.remote_addr)
        return render_template("admin_entrar.html", erro="Senha incorreta."), 401
    session.clear()                                     # nova sessao (evita fixacao de sessao)
    agora = time.time()
    session.update(admin=True, admin_inicio=agora, admin_atividade=agora)
    session.permanent = True
    protecao.renovar_csrf()
    log.info("Login no painel (ip=%s)", request.remote_addr)
    return redirect(url_for("sugestoes.painel"), code=303)


@bp.route("/admin/sair", methods=["POST"])
@protecao.exige_csrf
def sair():
    session.clear()
    return redirect(url_for("sugestoes.entrar"), code=303)


def _repo_admin():
    repo = repositorio()
    if repo is None:
        abort(503)
    return repo


@bp.route("/admin", methods=["GET"])
@exige_admin
def painel():
    filtro = request.args.get("status", "em_analise")
    if filtro not in (*STATUS, "todas"):
        filtro = "em_analise"
    erro = None
    try:
        itens = _repo_admin().ler()["sugestoes"]
    except ErroArmazem as exc:
        log.error("Painel: %s", exc)
        itens, erro = [], "Não foi possível ler o arquivo de sugestões."
    contagem = {s: sum(1 for i in itens if i.get("status") == s) for s in STATUS}
    novas = sum(1 for i in itens if not i.get("lida") and i.get("status") == "em_analise")
    lista = [i for i in itens if filtro == "todas" or i.get("status") == filtro]
    lista.sort(key=lambda i: (i.get("lida", False), -int(i.get("pedidos", 1)), i.get("criada_em", "")), reverse=False)
    return render_template("admin_lista.html", itens=lista, filtro=filtro, contagem=contagem, novas=novas,
                           STATUS=STATUS, erro=erro, aviso=session.pop("admin_aviso", None))


# Campos que o administrador completa (mesmas colunas da tabela navios_historicos)
CAMPOS_ADMIN = [
    ("nome", "Nome", 120, True), ("designacao_casco", "Designação do casco", 40, False),
    ("marinha", "Marinha", 60, True), ("tipo", "Tipo", 60, True), ("classe", "Classe", 80, False),
    ("guerra", "Guerra", 40, True), ("data_batismo", "Batismo (AAAA-MM-DD)", 10, False),
    ("data_comissionamento", "Comissionamento (AAAA-MM-DD)", 10, False), ("data_baixa", "Baixa (AAAA-MM-DD)", 10, False),
    ("primeiro_comandante", "Primeiro comandante", 120, False), ("ultimo_comandante", "Último comandante", 120, False),
    ("batalhas", "Batalhas (separadas por ;)", 2000, False), ("armamento", "Armamento (separado por ;)", 2000, False),
    ("estado_atual", "Situação atual", 120, False), ("fonte_observacoes", "Fontes e observações", 2000, False),
]
CAMPOS_DATA = {"data_batismo", "data_comissionamento", "data_baixa"}
_CONTROLE = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")


def _ler_campos_admin(form):
    dados, erros = {}, []
    for chave, rotulo, maximo, _obrig in CAMPOS_ADMIN:
        valor = _CONTROLE.sub("", form.get(chave) or "").strip()
        if len(valor) > maximo:
            erros.append(f"{rotulo}: no máximo {maximo} caracteres.")
        elif chave in CAMPOS_DATA and valor:
            try:
                datetime.strptime(valor, "%Y-%m-%d")
            except ValueError:
                erros.append(f"{rotulo}: use o formato AAAA-MM-DD.")
        dados[chave] = valor or None
    notas = _CONTROLE.sub("", form.get("notas") or "").strip()
    if len(notas) > 1000:
        erros.append("Notas internas: no máximo 1000 caracteres.")
    return dados, notas[:1000], erros


def _literal(valor, data=False):
    if valor is None:
        return "NULL"
    texto = "'" + str(valor).replace("'", "''") + "'"
    return f"DATE {texto}" if data else texto


def gerar_sql(dados):
    """INSERT para o administrador colar no banco (so insere se o navio ainda nao existir)."""
    colunas = [c for c, *_ in CAMPOS_ADMIN]
    valores = ", ".join(_literal(dados.get(c), c in CAMPOS_DATA) for c in colunas)
    # nosec B608: o site NAO executa este texto (so o exibe ao administrador); colunas sao constantes e
    # cada valor passa por _literal (aspas dobradas); testado contra o PostgreSQL em tests/test_sugestoes.py
    return (f"INSERT INTO public.navios_historicos ({', '.join(colunas)})\n"  # nosec B608
            f"SELECT {valores}\n"
            f"WHERE NOT EXISTS (SELECT 1 FROM public.navios_historicos\n"
            f"                  WHERE public.rn_norm(nome) = public.rn_norm({_literal(dados.get('nome'))}));")


def _achar(itens, item_id):
    for i in itens:
        if i.get("id") == item_id:
            return i
    abort(404)


def _dados_iniciais(item):
    base = {"nome": item.get("nome"), "marinha": item.get("marinha"), "guerra": item.get("guerra"),
            "fonte_observacoes": item.get("fonte")}
    base.update({k: v for k, v in (item.get("dados") or {}).items() if v})
    return base


@bp.route("/admin/sugestao/<item_id>", methods=["GET", "POST"])
@exige_admin
@protecao.exige_csrf
def item(item_id):
    if not re.fullmatch(r"[0-9a-f]{12}", item_id):
        abort(404)
    repo = _repo_admin()
    if request.method == "GET":
        try:
            atual = _achar(repo.ler()["sugestoes"], item_id)
            if not atual.get("lida"):                   # marca como lida (so na primeira abertura)
                def marcar(arquivo):
                    alvo = _achar(arquivo["sugestoes"], item_id)
                    if alvo.get("lida"):
                        return None
                    alvo["lida"] = True
                    return True
                repo.alterar(marcar, f"Painel: sugestao {item_id} lida")
        except ErroArmazem as exc:
            log.error("Painel: %s", exc)
            abort(503)
        dados = _dados_iniciais(atual)
        sql = gerar_sql(dados) if atual.get("status") == "aprovado" else None
        return render_template("admin_item.html", item=atual, dados=dados, campos=CAMPOS_ADMIN, STATUS=STATUS,
                               sql=sql, aviso=session.pop("admin_aviso", None))

    acao = request.form.get("acao")
    if acao not in ("salvar", "aprovar", "rejeitar", "reabrir"):
        abort(400)
    dados, notas, erros = _ler_campos_admin(request.form)
    if acao == "aprovar":
        faltando = [rot for c, rot, _m, obrig in CAMPOS_ADMIN if obrig and not dados.get(c)]
        if faltando:
            erros.append("Para aprovar, preencha: " + ", ".join(faltando) + ".")
    if erros:
        try:
            atual = _achar(repo.ler()["sugestoes"], item_id)
        except ErroArmazem:
            abort(503)
        return render_template("admin_item.html", item=atual, dados=dados, notas=notas, campos=CAMPOS_ADMIN,
                               STATUS=STATUS, sql=None, erros=erros), 400

    novo_status = {"aprovar": "aprovado", "rejeitar": "rejeitado", "reabrir": "em_analise"}.get(acao)

    def aplicar(arquivo):
        alvo = _achar(arquivo["sugestoes"], item_id)
        alvo["dados"], alvo["notas"], alvo["lida"] = dados, notas, True
        if novo_status:
            alvo["status"] = novo_status
        alvo["atualizada_em"] = _agora()
        alvo.setdefault("historico", []).append({"em": _agora(), "acao": acao})
        alvo["historico"] = alvo["historico"][-MAX_HISTORICO:]
        return True

    try:
        repo.alterar(aplicar, f"Painel: {acao} sugestao {item_id}")
    except ErroArmazem as exc:
        log.error("Painel: %s", exc)
        abort(503)
    session["admin_aviso"] = {"salvar": "Alterações salvas.", "aprovar": "Sugestão aprovada. Copie o SQL abaixo e execute no banco.",
                              "rejeitar": "Sugestão rejeitada.", "reabrir": "Sugestão reaberta para análise."}[acao]
    return redirect(url_for("sugestoes.item", item_id=item_id), code=303)


def init_app(app):
    app.register_blueprint(bp)
