"""Testes da v4.7: navios 3D no topo da página inicial e foto do navio na ficha da Consulta."""
import json
import re
from pathlib import Path

import pytest

RAIZ = Path(__file__).resolve().parent.parent
FOTOS = RAIZ / "static" / "data" / "fotos-navios.json"
PASTA = RAIZ / "static" / "img" / "navios"
LICENCAS_LIVRES = re.compile(r"^(domínio público|CC0( 1\.0)?|CC BY(-SA)? [1-4]\.0( [a-z]{2,3})?|Public domain)$", re.I)


def ler(rel):
    return (RAIZ / rel).read_text(encoding="utf-8")


def indice():
    return json.loads(FOTOS.read_text(encoding="utf-8"))


# ── fotos dos navios ─────────────────────────────────────────────────────────
def test_indice_de_fotos_cobre_os_navios_do_acervo():
    import importlib.util
    spec = importlib.util.spec_from_file_location("fotos_navios", RAIZ / "ferramentas" / "fotos_navios.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    faltando = sorted(set(mod.ARTIGOS) - set(indice()) - mod.SEM_FOTO)
    assert len(mod.ARTIGOS) == 70
    assert not faltando, f"sem foto: {faltando}"
    assert mod.SEM_FOTO == {"Mariz e Barros"} and not mod.SEM_FOTO & set(indice())     # sem foto de propósito (navio homônimo)


@pytest.mark.parametrize("nome,f", sorted(json.loads(FOTOS.read_text(encoding="utf-8")).items()))
def test_cada_foto_existe_tem_licenca_livre_e_credito(nome, f):
    for chave in ("arquivo", "arquivo_pequeno"):
        assert re.fullmatch(r"[a-z0-9-]+-\d+\.webp", f[chave])
        arq = PASTA / f[chave]
        assert arq.exists() and arq.read_bytes()[8:12] == b"WEBP"
        assert arq.stat().st_size < 400_000                       # página leve no celular
    assert f["fonte"].startswith("https://commons.wikimedia.org/wiki/File:")
    assert LICENCAS_LIVRES.match(f["licenca"]), f["licenca"]
    assert f["autor"] and "<" not in f["autor"] and len(f["autor"]) <= 90


def test_fotos_sao_servidas_pelo_site(client):
    r = client.get("/static/data/fotos-navios.json")
    assert r.status_code == 200 and r.is_json
    f = next(iter(r.get_json().values()))
    img = client.get("/static/img/navios/" + f["arquivo_pequeno"])
    assert img.status_code == 200 and img.mimetype == "image/webp"


def test_foto_continua_local_na_politica_de_seguranca(client):
    csp = client.get("/consulta").headers["Content-Security-Policy"]
    assert "img-src 'self' data:;" in csp                         # nenhuma imagem de fora: as fotos estão no próprio site
    assert "img-src 'self' data:;" in ler("templates/consulta.html")


def test_ficha_monta_a_foto_sem_innerhtml_e_com_link_so_para_o_commons():
    js = ler("static/js/consulta.js")
    assert not re.search(r"\.(innerHTML|outerHTML)\s*[+]?=|insertAdjacentHTML", js)     # o comentário do topo cita a regra
    corpo = js[js.index("function fotoNavio"):js.index("function renderFicha")]
    assert "startsWith('https://commons.wikimedia.org/')" in corpo
    assert "rel = 'noopener noreferrer'" in corpo
    assert "fig.remove()" in corpo                                 # imagem que falha some, a ficha continua
    assert re.search(r"/\^\[a-z0-9-\]\+-\\d\+\\\.webp\$/", corpo)  # só nomes de arquivo esperados


def test_foto_fica_no_topo_da_ficha():
    js = ler("static/js/consulta.js")
    topo = js[js.index("function renderFicha"):js.index("const tags = cria('div', 'ficha-tags')")]
    assert "fotoNavio(n, indice)" in topo and "topo.appendChild(foto)" in topo


# ── navios 3D no topo da página inicial ──────────────────────────────────────
def test_motor_3d_exporta_os_modelos_do_topo():
    js = ler("static/js/ships-3d.js")
    assert "window.ShipEngine = { init, openModal, closeModal, setTheme, heroGroup, heroModel };" in js
    for construtor in ("buildContainerShip", "buildTanker", "buildBulker", "buildCarCarrier"):
        assert f"function {construtor}(" in js


def test_comboio_usa_os_modelos_3d_e_mantem_a_versao_2d():
    js = ler("static/js/convoy-hero.js")
    assert "SE.heroModel(kind, seed)" in js
    assert "if (!window.THREE || !SE || !SE.heroModel) return null;" in js     # sem WebGL: prismas 2D
    assert "clippingPlanes" in js                                               # nada abaixo da linha d'água
    assert "requestIdleCallback" in js                                          # monta os modelos sem travar a página


def test_batalha_usa_os_modelos_3d_e_mantem_as_silhuetas():
    js = ler("static/js/war-hero.js")
    assert "SE.heroGroup(model)" in js
    assert "(Studio && Studio(kind, L, side === 1, dpr)) || shipSprite(kind, L)" in js


@pytest.mark.parametrize("arq", ["static/js/convoy-hero.js", "static/js/war-hero.js", "static/js/ships-3d.js"])
def test_sem_ganchos_de_depuracao(arq):
    js = ler(arq)
    assert "DEBUG" not in js and "__rnDbg" not in js and "console.log" not in js
