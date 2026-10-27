"""Testes da pagina Navegacao pelas Estrelas (/navegacao): rota, seguranca, dados do ceu e versao estatica."""
import json
import re
import shutil
import subprocess
from pathlib import Path

import pytest

RAIZ = Path(__file__).resolve().parent.parent
CEU = RAIZ / "static" / "data" / "ceu.json"


def test_pagina_abre_com_csp_e_sem_cache_de_html(client):
    r = client.get("/navegacao")
    assert r.status_code == 200 and r.mimetype == "text/html"
    html = r.get_data(as_text=True)
    assert "Navegar pelas" in html and 'id="carta-celeste"' in html and 'id="planetas-3d"' in html
    csp = r.headers["Content-Security-Policy"]
    assert "unsafe-inline" not in csp and "unsafe-eval" not in csp and "connect-src 'self'" in csp


def test_link_estrelas_em_todas_as_paginas(client):
    for rota in ("/", "/consulta", "/contato", "/sugerir", "/navegacao"):
        html = client.get(rota).get_data(as_text=True)
        assert re.search(r'<a href="navegacao"\s+class="nav-link[^"]*"[^>]*>Estrelas</a>', html), rota


def test_dados_do_ceu_sao_validos_e_servidos():
    dados = json.loads(CEU.read_text(encoding="utf-8"))
    nav = dados["navegacao"]
    assert [s[0] for s in nav] == list(range(58))                 # Polar (0) + as 57 estrelas de navegacao
    assert nav[0][1] == "Polaris" and nav[0][4] > 89               # declinacao da Polar perto do polo
    assert all(re.fullmatch(r"[A-Za-z' ]+", s[1]) for s in nav)    # nomes limpos (sem restos de wiki)
    assert {s[1] for s in nav} >= {"Sirius", "Canopus", "Arcturus", "Vega", "Acrux", "Rigil Kentaurus"}
    for ra, dec, mag, _ in dados["estrelas"]:
        assert 0 <= ra < 360 and -90 <= dec <= 90 and mag <= 5.3
    assert len(dados["estrelas"]) > 2000 and len(dados["linhas"]) == 88
    assert "BSD" in dados["fonte"]                                  # atribuicao da licenca do d3-celestial


def test_json_do_ceu_responde_como_json(client):
    r = client.get("/static/data/ceu.json")
    assert r.status_code == 200 and r.mimetype == "application/json"


@pytest.mark.skipif(not shutil.which("node"), reason="Node.js nao instalado")
def test_calculos_astronomicos_batem_com_meeus():
    """Confere astro.js contra exemplos resolvidos de Meeus, 'Astronomical Algorithms'."""
    script = r"""
    global.window = {}; require(process.argv[1]); const A = window.RNAstro;
    const J = s => A.jd(new Date(s));
    const v = A.geocentrico('venus', J('1992-12-20T00:00:00Z')), p = A.precessa(v[0], v[1], J('1992-12-20T00:00:00Z'));
    const m = A.lua(J('1992-04-12T00:00:00Z')), q = A.precessa(41.054063, 49.227750, 2462088.69);
    console.log(JSON.stringify({ gmst: A.gmst(J('1987-04-10T00:00:00Z')), venus: p, lua: m, prec: q }));
    """
    saida = subprocess.run(["node", "-e", script, str(RAIZ / "static" / "js" / "astro.js")],
                           capture_output=True, text=True, timeout=30, check=True).stdout
    r = json.loads(saida)
    assert abs(r["gmst"] - 197.6932) < 0.001                                   # Meeus, exemplo 12.a
    assert abs(r["venus"][0] - 316.174) < 0.05 and abs(r["venus"][1] + 18.888) < 0.05   # exemplo 33.a
    assert abs(r["lua"][0] - 134.688) < 0.3 and abs(r["lua"][1] - 13.768) < 0.3        # exemplo 47.a (baixa precisao)
    assert abs(r["prec"][0] - 41.5472) < 0.001 and abs(r["prec"][1] - 49.3485) < 0.001  # exemplo 21.b


def test_versao_estatica_inclui_a_pagina(tmp_path, monkeypatch):
    import build_static
    monkeypatch.setattr(build_static, "DOCS", tmp_path / "docs")
    build_static.main()
    html = (tmp_path / "docs" / "navegacao.html").read_text(encoding="utf-8")
    assert "../static/" not in html and 'src="static/js/navegacao.js"' in html
    assert 'href="consulta.html"' in html and (tmp_path / "docs" / "static" / "data" / "ceu.json").exists()
    assert 'href="navegacao.html"' in (tmp_path / "docs" / "index.html").read_text(encoding="utf-8")
