# -*- coding: utf-8 -*-
"""Gera o PDF de documentação técnica (documentacao/Royal_Navy_Documentacao_Tecnica.pdf).

Como funciona
  1. Parte do PDF publicado numa tag do Git (edicao.BASE_TAG), com as seções 1 a 19 já diagramadas.
  2. Remove de verdade (redação do PyMuPDF, não só cobre) o texto dos cabeçalhos, rodapés, da linha de versão da capa
     e o "Fim do documento" antigo — assim a busca e a cópia de texto não encontram versões velhas escondidas.
  3. Redesenha com a identidade de estilo.py: capa (versão), sumário completo, cabeçalho/rodapé de todas as páginas
     (numeração refeita) e as linhas novas do histórico de versões (seção 11.5).
  4. Acrescenta no fim as seções novas listadas em edicao.SECOES_NOVAS (módulos em secoes/).
  5. Refaz os marcadores (outline) e os metadados.

Uso (na pasta site/):
    python ferramentas/documentacao/gerar_pdf.py                 # grava documentacao/Royal_Navy_Documentacao_Tecnica.pdf
    python ferramentas/documentacao/gerar_pdf.py --saida x.pdf   # grava em outro lugar (para conferir antes)

Requer: reportlab, pillow, pymupdf (requirements-docs.txt) e as fontes Segoe UI/Consolas do Windows.
"""
import argparse
import importlib
import io
import os
import subprocess
import sys
from pathlib import Path

import pymupdf
from reportlab.lib import colors
from reportlab.lib.units import cm
from reportlab.pdfgen import canvas as rl_canvas
from reportlab.platypus import Paragraph, Spacer, Table, TableStyle

AQUI = Path(__file__).resolve().parent
RAIZ = AQUI.parent.parent                                   # pasta site/
sys.path.insert(0, str(AQUI))

import edicao                                               # noqa: E402
import estilo as e                                          # noqa: E402

PW, PH = e.PW, e.PH
CAB = pymupdf.Rect(0, 0, PW, 40)                            # faixa do cabeçalho (coordenadas do PyMuPDF: y para baixo)
ROD = pymupdf.Rect(0, 795, PW, PH)                          # faixa do rodapé


# ═════════════════════════════════ leitura da base ═════════════════════════════════
def base_do_git():
    dados = subprocess.run(["git", "show", f"{edicao.BASE_TAG}:{edicao.BASE_ARQUIVO}"], cwd=RAIZ,
                           capture_output=True, check=True).stdout
    return pymupdf.open(stream=dados, filetype="pdf")


def spans(pagina, area=None):
    for b in pagina.get_text("dict", clip=area)["blocks"]:
        for linha in b.get("lines", []):
            for s in linha["spans"]:
                yield s


def titulo_do_cabecalho(pagina):
    """Título da seção à direita do cabeçalho antigo (o último carimbo é o que estava visível)."""
    textos = [s["text"].strip() for s in spans(pagina, CAB) if s["bbox"][0] > 300 and s["text"].strip()]
    return textos[-1] if textos else ""


def acha_texto(doc, trecho, inicio=0):
    for i in range(inicio, len(doc)):
        r = doc[i].search_for(trecho)
        if r:
            return i, r
    raise SystemExit(f"Não achei {trecho!r} na base.")


def remove_texto(pagina, *areas):
    for a in areas:
        pagina.add_redact_annot(a, fill=False)
    pagina.apply_redactions(images=pymupdf.PDF_REDACT_IMAGE_NONE, graphics=pymupdf.PDF_REDACT_LINE_ART_NONE)


# ═════════════════════════════════ páginas novas (ReportLab) ═════════════════════════════════
def gerar_sumario():
    """Sumário completo (1 página ou mais) já com cabeçalho/rodapé; começa na página 2."""
    buf = io.BytesIO()
    doc = e.Documento(buf, edicao.VERSAO, 2, title="sumario")
    linhas = [[Paragraph("<b>%s</b>" % n, e.cellb), Paragraph("<b>%s</b>" % t, e.cell),
               Paragraph(d, e.S("d", fontSize=8.6, textColor=e.GREY))] for n, t, d in edicao.SUMARIO]
    tt = Table(linhas, colWidths=[1.0 * cm, 7.6 * cm, e.CW - 8.6 * cm])
    tt.setStyle(TableStyle([("LINEBELOW", (0, 0), (-1, -1), 0.4, e.LINE), ("TOPPADDING", (0, 0), (-1, -1), 1.2),
                            ("BOTTOMPADDING", (0, 0), (-1, -1), 1.2), ("VALIGN", (0, 0), (-1, -1), "MIDDLE")]))
    (v, txt, _), anteriores = edicao.MUDANCAS[0], edicao.MUDANCAS[1:]
    story = [e.P("Sumário", e.h1), tt, Spacer(1, 10), e.P(edicao.COMO_LER, e.callout),
             e.P("<b>O que mudou nesta edição (v%s).</b> %s" % (v, txt[0].upper() + txt[1:]), e.small)]
    # as edições anteriores já aparecem no "Como ler" e no histórico de versões (11.5); o sumário cabe numa página
    del anteriores
    doc.build(story)
    return pymupdf.open(stream=buf.getvalue(), filetype="pdf")


def gerar_secoes_novas(primeira_pagina):
    if not edicao.SECOES_NOVAS:
        return None, []
    story = []
    for nome in edicao.SECOES_NOVAS:
        mod = importlib.import_module("secoes." + nome)
        story.append(e.Secao(mod.TITULO))
        story.append(e.P(mod.TITULO, e.h1))
        story += mod.conteudo(e)
    buf = io.BytesIO()
    doc = e.Documento(buf, edicao.VERSAO, primeira_pagina)
    doc.build(story)
    return pymupdf.open(stream=buf.getvalue(), filetype="pdf"), doc.marcadores


class Carimbos:
    """PDF auxiliar com uma página por carimbo; cada página é sobreposta à página final correspondente."""

    def __init__(self):
        self.buf = io.BytesIO()
        self.c = rl_canvas.Canvas(self.buf, pagesize=(PW, PH))
        self.n = 0

    def nova(self):
        if self.n:
            self.c.showPage()
        self.n += 1
        return self.c, self.n - 1

    def pdf(self):
        self.c.showPage()
        self.c.save()
        return pymupdf.open(stream=self.buf.getvalue(), filetype="pdf")


def carimbo_capa(c):
    c.setFillColor(colors.white)
    c.setFont("Sans", 13.5)
    c.drawString(e.MX, PH - 10.3 * cm, edicao.SUBTITULO)
    c.drawString(e.MX, PH - 11.05 * cm, "— dossiê de construção do site, versão %s" % edicao.VERSAO)
    c.setFont("Sans", 9.5)
    c.drawString(e.MX, 2.0 * cm, "Versão %s  ·  %s  ·  tag %s  ·  %s" % (edicao.VERSAO, edicao.DATA, edicao.TAG, edicao.HOSPEDAGEM))


def carimbo_moldura(c, secao, pagina, faixa_extra):
    if faixa_extra:                     # páginas 85+ da base têm cabeçalho mais alto: limpa a sobra
        c.setFillColor(colors.white)
        c.rect(0, PH - 39.0, PW, 39.0, stroke=0, fill=1)
    c.setFillColor(colors.white)
    c.rect(0, 0, PW, PH - 795, stroke=0, fill=1)
    e.moldura(c, edicao.VERSAO, secao, pagina)


def carimbo_historico(c, topo):
    """Linhas novas logo abaixo da tabela 11.5 (mesmas colunas e listras)."""
    t = e.table(edicao.HISTORICO, [2.4 * cm, 2.4 * cm, 3.6 * cm, e.CW - 8.4 * cm], header=False, zebra_inicio=9)
    _, h = t.wrapOn(c, e.CW, PH)
    if topo + h > 780:
        raise SystemExit("As linhas novas do histórico não cabem na página da seção 11.5 — reduza o texto.")
    t.drawOn(c, e.MX, PH - topo - h)


def carimbo_fim(c, abaixo_de):
    c.setFillColor(e.GREY)
    c.setFont("Sans", 9)
    c.drawCentredString(PW / 2, PH - abaixo_de - 22, "— Fim do documento —")


# ═════════════════════════════════ montagem ═════════════════════════════════
def gerar(saida):
    base = base_do_git()
    titulos = {i: titulo_do_cabecalho(base[i]) for i in range(len(base))}
    marcadores_base = base.get_toc()

    # posições na base, antes de mexer
    i_hist, _ = acha_texto(base, "Histórico de versões")
    rects = [d["rect"] for d in base[i_hist].get_drawings() if 60 < d["rect"].y0 < 790]
    topo_hist = max(r.y1 for r in rects)
    i_fim, r_fim = acha_texto(base, "— Fim do documento —")

    # 1) remove o texto que vai ser refeito
    remove_texto(base[0], pymupdf.Rect(40, 276, 560, 320), pymupdf.Rect(40, 772, 560, 792))
    for i in range(2, len(base)):
        areas = [CAB, ROD] + ([r_fim[0] + (-4, -4, 4, 4)] if i == i_fim else [])
        remove_texto(base[i], *areas)

    # 2) páginas novas
    sumario = gerar_sumario()
    k = len(sumario)
    desloc = k - 1                                       # o sumário antigo ocupava 1 página
    primeira_nova = len(base) + desloc + 1
    novas, marcadores_novos = gerar_secoes_novas(primeira_nova)

    # 3) documento final: capa + sumário + páginas 3..fim da base + seções novas
    final = pymupdf.open()
    final.insert_pdf(base, from_page=0, to_page=0)
    final.insert_pdf(sumario)
    final.insert_pdf(base, from_page=2, to_page=len(base) - 1)
    if novas:
        final.insert_pdf(novas)

    # 4) carimbos
    cb = Carimbos()
    alvos = []
    c, j = cb.nova(); carimbo_capa(c); alvos.append((0, j))
    for i in range(2, len(base)):
        c, j = cb.nova()
        num = i + 1 + desloc
        alto = any(d["rect"].y0 < 1 and d["rect"].y1 > 34 for d in base[i].get_drawings())
        carimbo_moldura(c, titulos[i], num, faixa_extra=alto)
        if i == i_hist:
            carimbo_historico(c, topo_hist)
        alvos.append((num - 1, j))
    ultima = len(final) - 1
    if not novas:                                        # sem seção nova: o "Fim" vai para o pé da última página da base
        fundo = max(s["bbox"][3] for s in spans(final[ultima]) if s["bbox"][3] < 790)
        c, j = cb.nova(); carimbo_fim(c, fundo); alvos.append((ultima, j))
    carimbos = cb.pdf()
    for pagina, j in alvos:
        final[pagina].show_pdf_page(final[pagina].rect, carimbos, j)

    if novas:                                            # "Fim" logo após o texto da última seção nova
        fundo = max(s["bbox"][3] for s in spans(final[ultima]) if 40 < s["bbox"][3] < 790)
        extra = Carimbos(); c, j = extra.nova(); carimbo_fim(c, fundo)
        final[ultima].show_pdf_page(final[ultima].rect, extra.pdf(), j)

    # 5) marcadores e metadados
    toc = [[1, "Sumário", 2]]
    for nivel, titulo, pag in marcadores_base:
        if titulo != "Sumário":
            toc.append([nivel, titulo, pag + desloc])
    toc += [[1, t, primeira_nova + p - 1] for t, p in marcadores_novos]
    final.set_toc(toc)
    final.set_metadata({"title": "Royal Navy — Documentação Técnica Completa (v%s)" % edicao.VERSAO,
                        "author": "Projeto Royal Navy", "subject": edicao.ASSUNTO,
                        "creator": "ferramentas/documentacao/gerar_pdf.py", "producer": "ReportLab + PyMuPDF"})
    final.save(saida, garbage=3, deflate=True)
    print(f"PDF gerado: {saida} — {len(final)} páginas (sumário com {k} página(s); "
          f"{len(edicao.SECOES_NOVAS)} seção(ões) nova(s))")


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--saida", default=str(RAIZ / "documentacao" / "Royal_Navy_Documentacao_Tecnica.pdf"))
    gerar(ap.parse_args().saida)
