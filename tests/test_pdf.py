"""Testes da v4.4: PDFs da ficha de um navio e do resultado de uma busca."""
import io
import re
import time

import pypdf
import pytest

import pdf_navios


def texto_pdf(dados: bytes) -> str:
    leitor = pypdf.PdfReader(io.BytesIO(dados))
    return "\n".join(p.extract_text() or "" for p in leitor.pages)


def _id_por_nome(client, nome):
    r = client.get("/api/navios/busca?q=" + nome).get_json()["resultados"]
    return next(x["id"] for x in r if x["nome"] == nome)


# ── ficha ────────────────────────────────────────────────────────────────────
def test_pdf_da_ficha(client):
    navio_id = _id_por_nome(client, "USS Arizona")
    r = client.get(f"/api/navios/{navio_id}/pdf")
    assert r.status_code == 200 and r.mimetype == "application/pdf"
    assert r.data.startswith(b"%PDF-")
    disp = r.headers["Content-Disposition"]
    assert disp == f'attachment; filename="navio-{navio_id}-uss-arizona.pdf"'
    assert r.headers["Cache-Control"] == "no-store" and r.headers["X-Content-Type-Options"] == "nosniff"
    txt = texto_pdf(r.data)
    for trecho in ("USS Arizona", "Casco BB-39", "Classe Pennsylvania", "Cronologia", "Batismo", "Ficha do navio"):
        assert trecho in txt, trecho
    assert re.search(r"\d{2}/\d{2}/\d{4}", txt)                      # datas no formato brasileiro


def test_pdf_da_ficha_e_rapido(client):
    navio_id = _id_por_nome(client, "Bismarck")
    client.get(f"/api/navios/{navio_id}/pdf")                         # aquece (importa o ReportLab)
    t0 = time.perf_counter()
    r = client.get(f"/api/navios/{navio_id}/pdf")
    assert r.status_code == 200 and time.perf_counter() - t0 < 1.0


@pytest.mark.parametrize("caminho", ["/api/navios/0/pdf", "/api/navios/999999/pdf", "/api/navios/abc/pdf",
                                     "/api/navios/-1/pdf", "/api/navios/1e3/pdf"])
def test_pdf_de_navio_inexistente(client, caminho):
    r = client.get(caminho)
    assert r.status_code == 404 and r.is_json


def test_pdf_da_ficha_rejeita_parametros(client):
    navio_id = _id_por_nome(client, "Bismarck")
    assert client.get(f"/api/navios/{navio_id}/pdf?x=1").status_code == 400


@pytest.mark.parametrize("metodo", ["post", "put", "delete"])
def test_pdf_somente_get(client, metodo):
    assert getattr(client, metodo)("/api/navios/1/pdf").status_code == 405


def test_limite_de_pdfs_por_minuto(client):
    navio_id = _id_por_nome(client, "Bismarck")
    codigos = [client.get(f"/api/navios/{navio_id}/pdf").status_code for _ in range(11)]
    assert codigos[:10] == [200] * 10 and codigos[10] == 429


# ── busca ────────────────────────────────────────────────────────────────────
def test_pdf_da_busca_com_filtro(client):
    r = client.get("/api/navios/busca/pdf?marinha=Estados%20Unidos")
    assert r.status_code == 200 and r.mimetype == "application/pdf"
    assert r.headers["Content-Disposition"] == 'attachment; filename="busca-estados-unidos.pdf"'
    txt = texto_pdf(r.data)
    total = client.get("/api/navios/busca?marinha=Estados%20Unidos").get_json()["total"]
    assert f"{total} navios encontrados" in txt and "USS Arizona" in txt and "Marinha: Estados Unidos" in txt
    assert "Bismarck" not in txt                                       # so o que o filtro pediu


def test_pdf_da_busca_sem_resultado(client):
    txt = texto_pdf(client.get("/api/navios/busca/pdf?q=o'brien").data)
    assert "0 navios encontrados" in txt and "Nenhum navio encontrado" in txt


@pytest.mark.parametrize("qs", ["", "q=a", "q=<script>", "q=arizona&limite=999", "q=" + "x" * 61, "q=arizona&q=bismarck"])
def test_pdf_da_busca_valida_como_a_busca(client, qs):
    r = client.get("/api/navios/busca/pdf?" + qs)
    assert r.status_code == 400 and r.is_json and r.get_json()["erro"] == "consulta_invalida"


def test_pdf_da_busca_respeita_o_limite(client, monkeypatch):
    import consulta_api
    monkeypatch.setattr(consulta_api, "MAX_PDF", 3)
    txt = texto_pdf(client.get("/api/navios/busca/pdf?marinha=Estados%20Unidos").data)
    assert "este PDF traz os 3 primeiros (limite de 3)" in txt


# ── gerador (direto, com dados hostis) ───────────────────────────────────────
def test_texto_hostil_nao_quebra_nem_vira_marcacao():
    navio = {"nome": "<b>X</b> & <font size=90>Y</font>", "marinha": "A<br/>B", "tipo": "T", "guerra": "G",
             "classe": "C", "designacao_casco": "\x00Z\x07", "data_batismo": "1900-01-02", "data_comissionamento": None,
             "data_baixa": "data-ruim", "primeiro_comandante": None, "ultimo_comandante": None,
             "batalhas": "a; <img src=x>; " + "z" * 9000, "armamento": None, "estado_atual": None, "observacoes": None,
             "mesma_classe": [{"nome": "Irmão <i>", "designacao_casco": None}]}
    txt = texto_pdf(pdf_navios.ficha_pdf(navio))
    assert "<b>X</b> & <font size=90>Y</font>" in txt                  # aparece LITERALMENTE, nao formatado
    assert "02/01/1900" in txt and "não informado" in txt and "<img src=x>" in txt


def test_caracteres_fora_do_latim_viram_letra_sem_sinal():
    txt = texto_pdf(pdf_navios.ficha_pdf({"nome": "Sōryū 蒼龍", "mesma_classe": []}))
    assert "Soryu" in txt and "??" in txt


@pytest.mark.parametrize("nome, esperado", [
    ("USS Arizona", "navio-1-uss-arizona.pdf"), ('a"b/../c\\d', "navio-1-a-b-c-d.pdf"),
    ("Blücher", "navio-1-blucher.pdf"), ("", "navio-1.pdf"), ("蒼龍", "navio-1.pdf"), ("x" * 200, "navio-1-" + "x" * 60 + ".pdf"),
])
def test_nome_de_arquivo_seguro(nome, esperado):
    assert pdf_navios.nome_arquivo("navio-1", nome) == esperado
