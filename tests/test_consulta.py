"""Testes da consulta de navios: funcionamento e SEGURANCA (v3.0)."""
import os
import re
import subprocess
from pathlib import Path
from urllib.parse import quote

import psycopg
import pytest

import consulta_api

RAIZ = Path(__file__).resolve().parent.parent


def busca(client, **params):
    from urllib.parse import urlencode
    return client.get("/api/navios/busca?" + urlencode(params))


# ── Funcionamento ────────────────────────────────────────────────────────────
def test_saude(client):
    r = client.get("/api/saude")
    assert r.status_code == 200 and r.get_json() == {"ok": True, "banco": "ok"}


def test_busca_ignora_acento_e_maiuscula(client):
    a = busca(client, q="bismarck").get_json()["resultados"]
    b = busca(client, q="BÍSMARCK").get_json()["resultados"]
    assert a and a[0]["nome"] == "Bismarck"
    assert [x["id"] for x in a] == [x["id"] for x in b]


def test_busca_por_designacao_do_casco(client):
    r = busca(client, q="BB-39").get_json()["resultados"]
    assert r[0]["nome"] == "USS Arizona"


def test_busca_tolera_erro_de_digitacao(client):
    r = busca(client, q="arizonna").get_json()["resultados"]
    assert any(x["nome"] == "USS Arizona" for x in r)


def test_busca_por_filtro_e_paginacao(client):
    p1 = busca(client, marinha="Estados Unidos").get_json()
    assert p1["total"] >= 11 and len(p1["resultados"]) == 10
    assert all(x["marinha"] == "Estados Unidos" for x in p1["resultados"])
    p2 = busca(client, marinha="Estados Unidos", pagina="2").get_json()
    assert p2["pagina"] == 2 and p2["resultados"]
    ids1 = {x["id"] for x in p1["resultados"]}
    assert not ids1 & {x["id"] for x in p2["resultados"]}


def test_ficha_completa(client):
    n = client.get("/api/navios/60").get_json()
    for campo in ("nome", "marinha", "tipo", "classe", "guerra", "data_comissionamento", "primeiro_comandante",
                  "batalhas", "armamento", "estado_atual", "observacoes", "mesma_classe"):
        assert campo in n
    assert re.fullmatch(r"\d{4}-\d{2}-\d{2}", n["data_batismo"])
    assert "criado_em" not in n and "fonte_observacoes" not in n      # colunas internas nao saem


def test_filtros(client):
    f = client.get("/api/navios/filtros").get_json()
    assert {"marinhas", "guerras", "tipos"} <= set(f) and f["marinhas"]


# ── Validacao de entrada ─────────────────────────────────────────────────────
@pytest.mark.parametrize("qs", [
    "", "q=", "q=a", "q=%20%20%20", "q=" + "x" * 61, "pagina=1",
    "q=arizona&pagina=0", "q=arizona&pagina=21", "q=arizona&pagina=abc", "q=arizona&pagina=-1", "q=arizona&pagina=1.5",
    "q=arizona&limite=1000", "q=arizona&q=bismarck", "q=arizona&" + "z=1&" * 200,
])
def test_entradas_invalidas_dao_400(client, qs):
    r = client.get("/api/navios/busca?" + qs)
    assert r.status_code == 400 and r.get_json()["erro"] == "consulta_invalida"


def test_limite_de_60_caracteres_e_aceito(client):
    assert busca(client, q="x" * 60).status_code == 200


PAYLOADS = [
    "' OR 1=1 --", "'; DROP TABLE navios_historicos; --", '" OR ""="', "1; SELECT pg_sleep(5)",
    "<script>alert(1)</script>", "<img src=x onerror=alert(1)>", "%", "_", "\\", "a\x00b", "‮abc",
    "../../etc/passwd", "${jndi:ldap://x/a}", "{{7*7}}", "admin'--", "1 UNION SELECT usename, passwd FROM pg_shadow",
    "﻿bismarck", "bis​marck", "a" * 5000, "%27%20OR%201%3D1", "';--", "\n\r\nSet-Cookie: x=1",
]


@pytest.mark.parametrize("payload", PAYLOADS)
def test_payloads_hostis_nunca_geram_erro_500_nem_vazam(client, payload):
    r = client.get("/api/navios/busca?q=" + quote(payload, safe=""))
    texto = r.get_data(as_text=True)
    assert r.status_code in (200, 400, 414)
    assert r.status_code != 500
    for pista in ("Traceback", "psycopg", "postgres", "SELECT", "pg_shadow", "File \""):
        assert pista not in texto
    assert "Set-Cookie" not in r.headers


def test_dados_intactos_apos_ataques(client, conexao):
    for p in PAYLOADS:
        client.get("/api/navios/busca?q=" + quote(p, safe=""))
    n = conexao.execute("SELECT count(*) FROM public.v_navios").fetchone()[0]
    assert n >= 64                                                     # nenhum dado foi apagado


def test_texto_com_apostrofo_e_permitido(client):
    r = busca(client, q="o'brien")
    assert r.status_code == 200 and r.get_json()["resultados"] == []


@pytest.mark.parametrize("caminho", ["/api/navios/0", "/api/navios/999999", "/api/navios/-1", "/api/navios/abc",
                                     "/api/navios/1e3", "/api/navios/99999999999999999999", "/api/naoexiste"])
def test_ficha_inexistente_da_404_json(client, caminho):
    r = client.get(caminho)
    assert r.status_code == 404 and r.is_json and r.get_json()["erro"] == "nao_encontrado"


def test_ficha_rejeita_parametros(client):
    assert client.get("/api/navios/60?x=1").status_code == 400


@pytest.mark.parametrize("metodo", ["post", "put", "delete", "patch"])
def test_somente_get(client, metodo):
    r = getattr(client, metodo)("/api/navios/busca?q=arizona", data="x=1")
    assert r.status_code == 405 and r.is_json


# ── Cabecalhos e rede ────────────────────────────────────────────────────────
def test_cabecalhos_da_api(client):
    h = client.get("/api/navios/60").headers
    assert h["Cache-Control"] == "no-store"
    assert h["X-Content-Type-Options"] == "nosniff"
    assert h["X-Frame-Options"] == "DENY"
    assert h["Cross-Origin-Resource-Policy"] == "same-origin"
    assert "Access-Control-Allow-Origin" not in h                      # sem CORS aberto
    assert h["Content-Type"].startswith("application/json")


def test_nao_revela_versao_do_servidor(client):
    assert client.get("/").headers["Server"] == "Royal Navy"
    assert "Werkzeug" not in client.get("/api/saude").headers["Server"]


def test_csp_no_cabecalho_das_paginas(client):
    for rota in ("/", "/consulta"):
        csp = client.get(rota).headers["Content-Security-Policy"]
        assert "frame-ancestors 'none'" in csp and "object-src 'none'" in csp and "connect-src 'self'" in csp
        assert "unsafe-eval" not in csp and "script-src 'self' https://cdnjs.cloudflare.com;" in csp


def test_csp_do_cabecalho_igual_a_meta_do_html(client):
    cab = client.get("/consulta").headers["Content-Security-Policy"].replace("; frame-ancestors 'none'", "")
    for arq in ("index.html", "consulta.html"):
        html = (RAIZ / "templates" / arq).read_text(encoding="utf-8")
        meta = re.search(r'http-equiv="Content-Security-Policy" content="([^"]+)"', html).group(1)
        assert meta == cab, arq


def test_host_forjado_e_barrado(client):
    r = client.get("/api/saude", headers={"Host": "evil.example"})
    assert r.status_code == 400 and r.get_json()["erro"] == "host_nao_permitido"
    assert client.get("/", headers={"Host": "evil.example:5000"}).status_code == 400


def test_cors_so_para_origem_autorizada(client, monkeypatch):
    monkeypatch.setenv("CORS_ORIGINS", "https://meusite.example")
    ok = client.get("/api/saude", headers={"Origin": "https://meusite.example"})
    assert ok.headers["Access-Control-Allow-Origin"] == "https://meusite.example"
    ruim = client.get("/api/saude", headers={"Origin": "https://malvado.example"})
    assert "Access-Control-Allow-Origin" not in ruim.headers


def test_limite_de_requisicoes(client):
    codigos = [busca(client, q="bismarck").status_code for _ in range(35)]
    assert 429 in codigos and codigos[:30] == [200] * 30
    r = busca(client, q="bismarck")
    assert r.status_code == 429 and r.get_json()["erro"] == "muitas_requisicoes" and "Retry-After" in r.headers


def test_api_recusa_usuario_administrador(client, monkeypatch):
    """Mesmo que alguem coloque o 'postgres' no .env, a API se recusa a usa-lo."""
    antigo = consulta_api._pool
    consulta_api._pool = None
    monkeypatch.setenv("DB_USER", "postgres")
    try:
        r = client.get("/api/navios/60")
        assert r.status_code == 503 and r.get_json()["erro"] == "servico_indisponivel"
    finally:
        consulta_api._pool = antigo


# ── Banco: o papel de leitura e realmente so de leitura ──────────────────────
@pytest.mark.parametrize("comando", [
    "INSERT INTO public.navios_historicos (nome, marinha, tipo, guerra) VALUES ('x','Brasil','x','Ambas')",
    "UPDATE public.navios_historicos SET nome = 'x'",
    "DELETE FROM public.navios_historicos",
    "TRUNCATE public.navios_historicos",
    "DROP TABLE public.navios_historicos",
    "DROP VIEW public.v_navios",
    "CREATE TABLE public.invasor (i int)",
    "CREATE FUNCTION public.f() RETURNS int LANGUAGE sql AS 'SELECT 1'",
    "SELECT * FROM public.navios_historicos",
    "SELECT * FROM pg_shadow",
    "SELECT pg_read_file('postgresql.conf')",
    "COPY public.v_navios TO PROGRAM 'cmd /c whoami'",
    "ALTER ROLE navios_leitura SUPERUSER",
    "CREATE ROLE intruso LOGIN SUPERUSER",
    "GRANT ALL ON public.navios_historicos TO navios_leitura",
])
def test_papel_de_leitura_nao_faz_nada_alem_de_ler(conexao, comando):
    with pytest.raises(psycopg.Error):
        conexao.execute(comando)


def test_papel_e_view(conexao):
    assert conexao.execute("SELECT rolsuper OR rolcreaterole OR rolcreatedb OR rolreplication FROM pg_roles WHERE rolname = current_user").fetchone()[0] is False
    assert conexao.execute("SHOW default_transaction_read_only").fetchone()[0] == "on"
    colunas = {r[0] for r in conexao.execute("SELECT column_name FROM information_schema.columns WHERE table_name = 'v_navios'")}
    assert "criado_em" not in colunas and {"nome", "armamento", "batalhas"} <= colunas


def test_consulta_lenta_e_cancelada_pelo_timeout(conexao):
    with pytest.raises(psycopg.errors.QueryCanceled):
        conexao.execute("SELECT pg_sleep(6)")


# ── Segredos ─────────────────────────────────────────────────────────────────
def _arquivos_versionados():
    try:
        saida = subprocess.run(["git", "ls-files"], cwd=RAIZ, capture_output=True, text=True, check=True).stdout
    except Exception:
        pytest.skip("git indisponivel")
    return [RAIZ / p for p in saida.splitlines() if (RAIZ / p).is_file()]


def test_env_esta_no_gitignore():
    r = subprocess.run(["git", "check-ignore", ".env"], cwd=RAIZ, capture_output=True, text=True)
    assert r.returncode == 0


def test_senha_do_banco_nao_esta_em_nenhum_arquivo_versionado():
    senha = os.environ.get("DB_PASSWORD", "")
    assert len(senha) >= 24                                            # senha forte gerada pelo aplicar.py
    for arq in _arquivos_versionados():
        dados = arq.read_bytes()
        assert senha.encode() not in dados, f"senha encontrada em {arq.name}"
        assert not re.search(rb"postgres(ql)?://[^:\s/]+:[^@\s]+@", dados), f"URI com senha em {arq.name}"
