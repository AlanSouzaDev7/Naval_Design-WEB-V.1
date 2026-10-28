"""Testes da rodada de QA (v4.5.3): navegacao no celular, barra final nas URLs, paginas e textos do site."""
import re
from pathlib import Path

import pytest

RAIZ = Path(__file__).resolve().parent.parent


def ler(rel):
    return (RAIZ / rel).read_text(encoding="utf-8")


# ── barra final nas URLs ─────────────────────────────────────────────────────
@pytest.mark.parametrize("caminho", ["/consulta/", "/navegacao/", "/contato/", "/sugerir/"])
def test_barra_final_redireciona_para_a_pagina(client, caminho):
    r = client.get(caminho)
    assert r.status_code == 308
    assert r.headers["Location"] == caminho.rstrip("/")


def test_barra_final_preserva_a_consulta(client):
    r = client.get("/consulta/?q=bismarck&id=2")
    assert r.status_code == 308
    assert r.headers["Location"] == "/consulta?q=bismarck&id=2"


@pytest.mark.parametrize("caminho", ["//evil.com/", "//consulta/", "/nao-existe/", "/static/css/", "/api/nao-existe/"])
def test_barra_final_nunca_vira_redirecionamento_aberto(client, caminho):
    r = client.get(caminho)
    loc = r.headers.get("Location", "")
    assert not loc.startswith("//") and "evil" not in loc
    assert r.status_code in (400, 404, 308)       # 400: o cliente de teste le "//host/" como Host e o site o barra


def test_pagina_inexistente_continua_voltando_para_a_inicial(client):
    r = client.get("/nao-existe")
    assert r.status_code == 404 and b"SENHORES" in r.data


# ── paginacao ────────────────────────────────────────────────────────────────
@pytest.mark.parametrize("pagina", ["٣", "１", "²", "1 ", "+1"])
def test_pagina_so_aceita_algarismos_ascii(client, pagina):
    assert client.get("/api/navios/busca", query_string={"q": "bis", "pagina": pagina}).status_code == 400


def test_pagina_ascii_continua_valida(client):
    assert client.get("/api/navios/busca", query_string={"q": "bis", "pagina": "1"}).status_code == 200


# ── menu do celular ──────────────────────────────────────────────────────────
PAGINAS_COM_BARRA = ["templates/index.html", "templates/consulta.html", "templates/navegacao.html",
                     "templates/sugerir.html", "templates/contato.html"]


@pytest.mark.parametrize("arq", PAGINAS_COM_BARRA)
def test_paginas_com_barra_carregam_o_menu_do_celular(arq):
    html = ler(arq)
    assert 'id="navbar"' in html and 'class="nav-links"' in html
    assert "static/js/theme.js" in html          # o botao do menu e criado por theme.js


def test_menu_do_celular_tem_css_e_acessibilidade():
    js, css = ler("static/js/theme.js"), ler("static/css/style.css")
    assert "aria-expanded" in js and "aria-controls" in js and "'Escape'" in js
    assert ".navbar.nav-open .nav-links" in css and ".nav-menu" in css
    assert ".navbar.nav-open .nav-links" in ler("static/css/dark.css") or '.navbar.nav-open .nav-links' in ler("static/css/dark.css")


def test_menu_do_celular_nao_usa_innerhtml():
    assert "innerHTML" not in ler("static/js/theme.js")


# ── textos e numeros do site ─────────────────────────────────────────────────
def test_numeros_da_faixa_inicial_batem_com_a_frota():
    html = ler("templates/index.html")
    ativos = int(re.search(r'data-target="(\d+)">0</span>\s*<span class="stat-label">Navios Ativos', html).group(1))
    frota = sum(int(n) for n in re.findall(r'<span class="fleet-count">(\d+)</span>', html))
    assert ativos == frota


def test_anos_de_historia_saem_da_fundacao_em_1546():
    html = ler("templates/index.html")
    assert re.search(r'data-target="\d+" data-since="1546">0</span>\s*<span class="stat-label">Anos de Hist', html)
    assert "dataset.since" in ler("static/js/main.js")


def test_cada_filtro_de_navios_tem_ao_menos_um_navio():
    html = ler("templates/index.html")
    filtros = set(re.findall(r'data-filter="(\w+)"', html)) - {"all"}
    categorias = set(re.findall(r'data-category="(\w+)"', html))
    assert filtros == categorias


def test_textos_dos_navios_estao_acentuados():
    texto = ler("static/js/ships-data.js")
    for ruim in ("Tripulacao", "Porta-Avioes", "Propulsao", "Velocidade Max", "Destroier", "Couracado", "e o maior navio",
                 "Comissionamento', value: '13 mai 1993'"):
        assert ruim not in texto, ruim
    assert "Tripulação" in texto and "Propulsão" in texto
