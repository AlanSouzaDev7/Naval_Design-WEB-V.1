"""Testes da v4.3: sugestoes de navios (pagina publica, armazenamento em arquivo/GitHub e painel admin)."""
import base64
import io
import json
import re
import urllib.error
from pathlib import Path

import pytest
from werkzeug.security import generate_password_hash

import app as site_app
import sugestoes

RAIZ = Path(__file__).resolve().parent.parent
SENHA = "senha-de-teste-bem-longa-123"
HASH = generate_password_hash(SENHA, method="scrypt")


# ── utilitarios ──────────────────────────────────────────────────────────────
@pytest.fixture()
def cli():
    """Cliente novo (sessao e cookies proprios) para cada teste."""
    return site_app.app.test_client()


@pytest.fixture()
def arquivo(tmp_path, monkeypatch):
    """Sugestoes num arquivo temporario (e nenhum GitHub configurado)."""
    caminho = tmp_path / "sugestoes.json"
    monkeypatch.setenv("SUGESTOES_ARQUIVO", str(caminho))
    for var in ("SUGESTOES_GITHUB_REPO", "SUGESTOES_GITHUB_TOKEN"):
        monkeypatch.delenv(var, raising=False)
    sugestoes._repos.clear()
    yield caminho
    sugestoes._repos.clear()


@pytest.fixture()
def admin_ligado(monkeypatch):
    monkeypatch.setenv("ADMIN_PASSWORD_HASH", HASH)
    sugestoes._falhas.clear()
    yield
    sugestoes._falhas.clear()


def token(cli, caminho="/sugerir"):
    html = cli.get(caminho).get_data(as_text=True)
    return re.search(r'name="csrf_token" value="([^"]+)"', html).group(1)


def sugerir(cli, **campos):
    dados = {"csrf_token": token(cli), **campos}
    return cli.post("/sugerir", data=dados)


def resultado(cli, resp):
    """Segue o redirecionamento (POST -> 303 -> GET) e devolve o HTML final."""
    assert resp.status_code == 303 and resp.headers["Location"].endswith("/sugerir")
    return cli.get("/sugerir").get_data(as_text=True)


def lidas(caminho):
    return json.loads(caminho.read_text(encoding="utf-8"))["sugestoes"] if caminho.exists() else []


# ── pagina publica ───────────────────────────────────────────────────────────
def test_pagina_de_sugestao(cli, arquivo):
    r = cli.get("/sugerir")
    html = r.get_data(as_text=True)
    assert r.status_code == 200 and 'name="csrf_token"' in html and 'name="website"' in html
    assert r.headers["Cache-Control"] == "no-store" and "frame-ancestors 'none'" in r.headers["Content-Security-Policy"]
    assert "HttpOnly" in r.headers["Set-Cookie"] and "SameSite=Strict" in r.headers["Set-Cookie"]


def test_nome_vindo_da_consulta_preenche_o_campo(cli, arquivo):
    assert 'value="Ark Royal"' in cli.get("/sugerir?nome=Ark%20Royal").get_data(as_text=True)
    assert 'value=""' in cli.get("/sugerir?nome=%3Cscript%3E").get_data(as_text=True)     # invalido: ignorado


@pytest.mark.parametrize("nome", ["USS Arizona", "arizona", "ARIZONA", "Arizona ", "uss  arizona", "BB-39",
                                  "Bismarck", "KMS Bismarck", "Blucher", "blücher", "HMS Hood"])
def test_navio_ja_existente(cli, arquivo, nome):
    html = resultado(cli, sugerir(cli, nome=nome))
    assert "Navio já existente" in html and re.search(r'href="consulta\?id=\d+"', html)
    assert lidas(arquivo) == []                                         # nada foi registrado


def test_nome_parecido_pergunta_antes_e_registra_se_confirmar(cli, arquivo):
    r = sugerir(cli, nome="Arizonna")
    html = r.get_data(as_text=True)
    assert r.status_code == 200 and "Você quis dizer" in html and "USS Arizona" in html
    assert 'name="confirmar" value="1"' in html and lidas(arquivo) == []
    html = resultado(cli, sugerir(cli, nome="Arizonna", confirmar="1"))
    assert "Sugestão registrada" in html and [s["nome"] for s in lidas(arquivo)] == ["Arizonna"]


def test_navio_novo_fica_em_analise(cli, arquivo):
    html = resultado(cli, sugerir(cli, nome="HMS Victory", marinha="Reino Unido", guerra="1ª Guerra Mundial",
                                  fonte="https://pt.wikipedia.org/wiki/HMS_Victory"))
    assert "Sugestão registrada" in html and "em análise" in html
    (s,) = lidas(arquivo)
    assert s["nome"] == "HMS Victory" and s["chave"] == "victory" and s["status"] == "em_analise"
    assert s["pedidos"] == 1 and s["lida"] is False and s["marinha"] == "Reino Unido"
    assert s["fonte"].startswith("https://") and re.fullmatch(r"[0-9a-f]{12}", s["id"])


def test_sugestao_repetida_soma_pedido_sem_duplicar(cli, arquivo):
    resultado(cli, sugerir(cli, nome="HMS Victory"))
    html = resultado(cli, sugerir(cli, nome="victory"))                 # mesmo navio, outra grafia
    assert "Já está em análise" in html and "2 no total" in html
    assert [(s["nome"], s["pedidos"]) for s in lidas(arquivo)] == [("HMS Victory", 2)]


def test_sugestao_ja_avaliada(cli, arquivo):
    resultado(cli, sugerir(cli, nome="HMS Victory"))
    dados = json.loads(arquivo.read_text(encoding="utf-8"))
    dados["sugestoes"][0]["status"] = "aprovado"
    arquivo.write_text(json.dumps(dados), encoding="utf-8")
    sugestoes._repos.clear()
    html = resultado(cli, sugerir(cli, nome="HMS Victory"))
    assert "já foi aprovado" in html and lidas(arquivo)[0]["pedidos"] == 1


@pytest.mark.parametrize("campos", [
    {"nome": ""}, {"nome": "a"}, {"nome": "x" * 61}, {"nome": "<script>alert(1)</script>"},
    {"nome": "Victory", "marinha": "<b>"}, {"nome": "Victory", "fonte": "javascript:alert(1)"},
    {"nome": "Victory", "fonte": "https://exemplo.com/a b"}, {"nome": "Victory", "fonte": "x" * 201},
    {"nome": "'; DROP TABLE navios_historicos; --"},
])
def test_entradas_invalidas(cli, arquivo, campos):
    r = sugerir(cli, **campos)
    assert r.status_code == 400 and 'class="contato-erro"' in r.get_data(as_text=True)
    assert lidas(arquivo) == []


def test_saida_e_escapada(cli, arquivo):
    """O nome volta para a pagina, mas sempre escapado (sem XSS refletido)."""
    r = sugerir(cli, nome="Victory", marinha='"><img src=x onerror=alert(1)>')
    html = r.get_data(as_text=True)
    assert r.status_code == 400 and "<img src=x" not in html and "&lt;img src=x" in html


def test_campo_isca_finge_sucesso_e_nao_grava(cli, arquivo):
    html = resultado(cli, sugerir(cli, nome="HMS Victory", website="http://spam.example"))
    assert "Sugestão registrada" in html and lidas(arquivo) == []


def test_sem_token_csrf_ou_de_outro_site_e_recusado(cli, arquivo):
    assert cli.post("/sugerir", data={"nome": "HMS Victory"}).status_code == 403
    assert cli.post("/sugerir", data={"nome": "HMS Victory", "csrf_token": "falso"}).status_code == 403
    t = token(cli)
    r = cli.post("/sugerir", data={"nome": "HMS Victory", "csrf_token": t}, headers={"Origin": "https://malvado.example"})
    assert r.status_code == 403 and lidas(arquivo) == []


def test_limite_de_envios(cli, arquivo):
    t = token(cli)
    codigos = [cli.post("/sugerir", data={"nome": "Bismarck", "csrf_token": t}).status_code for _ in range(7)]
    assert codigos[:6] == [303] * 6 and codigos[6] == 429


def test_sem_armazenamento_configurado(cli, monkeypatch):
    for var in ("SUGESTOES_ARQUIVO", "SUGESTOES_GITHUB_REPO", "SUGESTOES_GITHUB_TOKEN"):
        monkeypatch.delenv(var, raising=False)
    r = sugerir(cli, nome="HMS Victory")
    assert r.status_code == 503 and "não está disponível" in r.get_data(as_text=True)


def test_fila_cheia(cli, arquivo, monkeypatch):
    monkeypatch.setattr(sugestoes, "MAX_EM_ANALISE", 1)
    resultado(cli, sugerir(cli, nome="HMS Victory"))
    r = sugerir(cli, nome="HMS Warrior")
    assert r.status_code == 503 and "fila de sugestões está cheia" in r.get_data(as_text=True)
    assert len(lidas(arquivo)) == 1


def test_pagina_estatica_so_avisa():
    from jinja2 import Environment
    html = Environment(autoescape=True).from_string((RAIZ / "templates" / "sugerir.html").read_text(encoding="utf-8")).render(estatico=True)
    assert "indisponíveis nesta versão" in html and "<form" not in html


# ── contato (corrigido na v4.3) ──────────────────────────────────────────────
def test_contato_exige_csrf_e_tem_isca(cli):
    assert cli.post("/contato", data={"email": "a@b.co", "message": "oi"}).status_code == 403
    t = token(cli, "/contato")
    r = cli.post("/contato", data={"email": "a@b.co", "message": "oi", "csrf_token": t})
    assert r.status_code == 200 and "Mensagem recebida" in r.get_data(as_text=True)
    assert 'name="website"' in cli.get("/contato").get_data(as_text=True)


# ── painel do administrador ──────────────────────────────────────────────────
def entrar(cli, senha=SENHA):
    return cli.post("/admin/entrar", data={"senha": senha, "csrf_token": token(cli, "/admin/entrar")})


def test_painel_desligado_sem_hash(cli, monkeypatch):
    monkeypatch.delenv("ADMIN_PASSWORD_HASH", raising=False)
    for caminho in ("/admin", "/admin/entrar"):
        assert cli.get(caminho).status_code == 404


def test_post_com_origem_nula_e_recusado_e_o_painel_nao_provoca_isso(cli, arquivo, admin_ligado):
    """Origin: null (sandbox, data:) e recusado; e o painel nao pode usar Referrer-Policy no-referrer,
    que faria o proprio navegador mandar Origin: null em todo POST (bug encontrado no navegador)."""
    t = token(cli, "/admin/entrar")
    r = cli.post("/admin/entrar", data={"senha": SENHA, "csrf_token": t}, headers={"Origin": "null"})
    assert r.status_code == 403
    r = cli.post("/admin/entrar", data={"senha": SENHA, "csrf_token": t}, headers={"Origin": "http://localhost"})
    assert r.status_code == 303                                         # Origin do proprio site: aceito
    for caminho in ("/admin/entrar", "/admin"):
        resp = cli.get(caminho)
        assert "no-referrer" not in resp.headers.get("Referrer-Policy", "")
        assert 'content="no-referrer"' not in resp.get_data(as_text=True)


def test_painel_exige_login(cli, arquivo, admin_ligado):
    r = cli.get("/admin")
    assert r.status_code == 302 and r.headers["Location"].endswith("/admin/entrar")
    p = cli.get("/admin/entrar")
    assert p.headers["Cache-Control"] == "no-store" and "noindex" in p.headers["X-Robots-Tag"]


def test_senha_errada_e_certa(cli, arquivo, admin_ligado):
    r = entrar(cli, "errada")
    assert r.status_code == 401 and "Senha incorreta" in r.get_data(as_text=True)
    r = entrar(cli)
    assert r.status_code == 303 and r.headers["Location"].endswith("/admin")
    assert cli.get("/admin").status_code == 200


def test_login_troca_a_sessao(cli, arquivo, admin_ligado):
    """Fixacao de sessao: o token CSRF de antes do login deixa de valer."""
    antes = token(cli, "/admin/entrar")
    cli.post("/admin/entrar", data={"senha": SENHA, "csrf_token": antes})
    with cli.session_transaction() as s:
        assert s["admin"] is True and s["csrf"] != antes


def test_forca_bruta_por_ip(cli, arquivo, admin_ligado):
    codigos = [entrar(cli, "errada").status_code for _ in range(6)]
    assert codigos[:5] == [401] * 5 and codigos[5] == 429


def test_trava_global_contra_forca_bruta_distribuida(cli, arquivo, admin_ligado, monkeypatch):
    monkeypatch.setattr(sugestoes, "FALHAS_MAX", 3)
    for _ in range(3):
        entrar(cli, "errada")                                           # (como se viessem de IPs diferentes)
    r = entrar(cli)                                                     # mesmo com a senha certa
    assert r.status_code == 429 and "Muitas tentativas" in r.get_data(as_text=True)


def test_sessao_expira_por_inatividade(cli, arquivo, admin_ligado):
    entrar(cli)
    with cli.session_transaction() as s:
        s["admin_atividade"] -= sugestoes.INATIVIDADE + 1
    assert cli.get("/admin").status_code == 302


def test_sair(cli, arquivo, admin_ligado):
    entrar(cli)
    cli.post("/admin/sair", data={"csrf_token": token(cli, "/admin")})
    assert cli.get("/admin").status_code == 302


def _uma_sugestao(cli, nome="HMS Victory"):
    resultado(cli, sugerir(cli, nome=nome, marinha="Reino Unido"))
    return lidas(sugestoes.repositorio().armazem.caminho)[-1]["id"]


def test_fluxo_completo_de_aprovacao(cli, arquivo, admin_ligado):
    item_id = _uma_sugestao(cli, "O'Higgins")
    entrar(cli)
    lista = cli.get("/admin").get_data(as_text=True)
    assert "O&#39;Higgins" in lista and "nova" in lista

    pagina = cli.get(f"/admin/sugestao/{item_id}").get_data(as_text=True)
    assert 'value="Reino Unido"' in pagina and lidas(arquivo)[0]["lida"] is True

    t = token(cli, f"/admin/sugestao/{item_id}")
    r = cli.post(f"/admin/sugestao/{item_id}", data={"csrf_token": t, "acao": "aprovar", "nome": "O'Higgins"})
    assert r.status_code == 400 and "Para aprovar, preencha" in r.get_data(as_text=True)
    assert lidas(arquivo)[0]["status"] == "em_analise"

    campos = {"csrf_token": t, "acao": "aprovar", "nome": "O'Higgins", "marinha": "Chile", "tipo": "Cruzador",
              "guerra": "2ª Guerra Mundial", "data_batismo": "1897-05-17", "notas": "conferido"}
    r = cli.post(f"/admin/sugestao/{item_id}", data=campos)
    assert r.status_code == 303
    s = lidas(arquivo)[0]
    assert s["status"] == "aprovado" and s["dados"]["tipo"] == "Cruzador" and s["notas"] == "conferido"
    pagina = cli.get(f"/admin/sugestao/{item_id}").get_data(as_text=True)
    assert "INSERT INTO public.navios_historicos" in pagina and "O&#39;&#39;Higgins" in pagina   # aspas dobradas no SQL
    assert "DATE &#39;1897-05-17&#39;" in pagina and "WHERE NOT EXISTS" in pagina


def test_rejeitar_e_reabrir(cli, arquivo, admin_ligado):
    item_id = _uma_sugestao(cli)
    entrar(cli)
    t = token(cli, f"/admin/sugestao/{item_id}")
    cli.post(f"/admin/sugestao/{item_id}", data={"csrf_token": t, "acao": "rejeitar"})
    assert lidas(arquivo)[0]["status"] == "rejeitado"
    cli.post(f"/admin/sugestao/{item_id}", data={"csrf_token": t, "acao": "reabrir"})
    s = lidas(arquivo)[0]
    assert s["status"] == "em_analise" and [h["acao"] for h in s["historico"]] == ["sugerida", "rejeitar", "reabrir"]


def test_painel_valida_campos_e_acao(cli, arquivo, admin_ligado):
    item_id = _uma_sugestao(cli)
    entrar(cli)
    t = token(cli, f"/admin/sugestao/{item_id}")
    assert cli.post(f"/admin/sugestao/{item_id}", data={"csrf_token": t, "acao": "apagar_tudo"}).status_code == 400
    r = cli.post(f"/admin/sugestao/{item_id}", data={"csrf_token": t, "acao": "salvar", "data_baixa": "31/12/1945"})
    assert r.status_code == 400 and "AAAA-MM-DD" in r.get_data(as_text=True)
    assert cli.post(f"/admin/sugestao/{item_id}", data={"acao": "rejeitar"}).status_code == 403   # sem CSRF
    assert cli.get("/admin/sugestao/../../etc").status_code == 404
    assert cli.get("/admin/sugestao/000000000000").status_code == 404


def test_painel_bloqueia_acoes_sem_login(cli, arquivo, admin_ligado):
    item_id = _uma_sugestao(cli)
    r = cli.post(f"/admin/sugestao/{item_id}", data={"csrf_token": token(cli), "acao": "rejeitar"})
    assert r.status_code == 302 and lidas(arquivo)[0]["status"] == "em_analise"


def test_sql_gerado_e_seguro():
    sql = sugestoes.gerar_sql({"nome": "X'); DROP TABLE navios_historicos; --", "marinha": "Brasil", "tipo": "T",
                               "guerra": "G", "data_baixa": "1950-01-02", "classe": None})
    assert "'X''); DROP TABLE navios_historicos; --'" in sql             # tudo dentro de um literal
    fora_das_aspas = re.sub(r"'(?:[^']|'')*'", "''", sql)
    assert fora_das_aspas.count(";") == 1 and sql.rstrip().endswith(";")   # o ';' do texto fica dentro das aspas
    assert "DATE '1950-01-02'" in sql and ", NULL," in sql


# ── armazenamento no GitHub (API simulada) ───────────────────────────────────
class GitHubFalso:
    def __init__(self):
        self.conteudo, self.sha, self.pedidos, self.conflitos = None, None, [], 0

    def __call__(self, req, timeout=0):
        self.pedidos.append(req)
        assert req.full_url.startswith("https://api.github.com/repos/dono/dados/contents/sugestoes.json")
        assert req.headers["Authorization"] == "Bearer tok-123"

        def erro(codigo, corpo):
            raise urllib.error.HTTPError(req.full_url, codigo, "x", {}, io.BytesIO(json.dumps(corpo).encode()))

        if req.get_method() == "GET":
            if self.conteudo is None:
                erro(404, {"message": "Not Found"})
            return Resposta(200, {"encoding": "base64", "sha": self.sha,
                                  "content": base64.b64encode(self.conteudo.encode()).decode()})
        corpo = json.loads(req.data)
        if self.conflitos:
            self.conflitos -= 1
            self.sha = f"sha-externo-{self.conflitos}"
            erro(409, {"message": "sugestoes.json does not match"})
        if corpo.get("sha") != self.sha:
            erro(409, {"message": "does not match"})
        self.conteudo = base64.b64decode(corpo["content"]).decode()
        self.sha = f"sha-{len(self.pedidos)}"
        return Resposta(201 if "sha" not in corpo else 200, {"content": {"sha": self.sha}})


class Resposta:
    def __init__(self, status, corpo):
        self.status, self._corpo = status, json.dumps(corpo).encode()

    def read(self):
        return self._corpo

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False


@pytest.fixture()
def github(monkeypatch):
    falso = GitHubFalso()
    monkeypatch.setattr(sugestoes.urllib.request, "urlopen", falso)
    monkeypatch.setenv("SUGESTOES_GITHUB_REPO", "dono/dados")
    monkeypatch.setenv("SUGESTOES_GITHUB_TOKEN", "tok-123")
    monkeypatch.delenv("SUGESTOES_ARQUIVO", raising=False)
    sugestoes._repos.clear()
    yield falso
    sugestoes._repos.clear()


def test_github_cria_o_arquivo_e_depois_atualiza(cli, github):
    resultado(cli, sugerir(cli, nome="HMS Victory"))
    resultado(cli, sugerir(cli, nome="HMS Warrior"))
    dados = json.loads(github.conteudo)
    assert [s["nome"] for s in dados["sugestoes"]] == ["HMS Victory", "HMS Warrior"]
    puts = [json.loads(p.data) for p in github.pedidos if p.get_method() == "PUT"]
    assert "sha" not in puts[0] and puts[1]["sha"] and puts[0]["message"] == "Sugestao: HMS Victory"


def test_github_tenta_de_novo_em_conflito(cli, github):
    resultado(cli, sugerir(cli, nome="HMS Victory"))
    github.conflitos = 2                                                # duas gravacoes "de outra pessoa" no meio
    html = resultado(cli, sugerir(cli, nome="HMS Warrior"))
    assert "Sugestão registrada" in html and len(json.loads(github.conteudo)["sugestoes"]) == 2


def test_github_fora_do_ar_nao_vaza_detalhes(cli, monkeypatch, github):
    def quebrado(req, timeout=0):
        raise urllib.error.URLError("sem rede")
    monkeypatch.setattr(sugestoes.urllib.request, "urlopen", quebrado)
    r = sugerir(cli, nome="HMS Victory")
    html = r.get_data(as_text=True)
    assert r.status_code == 503 and "Não foi possível registrar" in html and "tok-123" not in html


def test_github_config_invalida_e_recusada():
    with pytest.raises(ValueError):
        sugestoes.ArmazemGitHub("dono/repo/../x", "t")
    with pytest.raises(ValueError):
        sugestoes.ArmazemGitHub("dono/repo", "t", caminho="../segredo")
