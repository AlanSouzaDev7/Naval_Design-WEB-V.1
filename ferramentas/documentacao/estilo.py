# -*- coding: utf-8 -*-
"""Identidade visual do PDF de documentação (a mesma das versões 1.1 a 4.4).

Tudo que desenha página nova — sumário, carimbos de cabeçalho/rodapé e seções novas — usa só o que está aqui,
para que as páginas geradas hoje fiquem idênticas às antigas. Medidas tiradas do próprio PDF v4.4 (A4, em pontos).
"""
import os

from PIL import Image as PILImage
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import cm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (BaseDocTemplate, Flowable, Frame, Image, KeepTogether, PageTemplate, Paragraph,
                                Preformatted, Spacer, Table, TableStyle)

# ── Fontes (Windows: Segoe UI e Consolas, as mesmas do PDF original) ──────────────────────────────
_F = os.environ.get("RN_FONTES", "C:/Windows/Fonts/")
for nome, arq in (("Sans", "segoeui.ttf"), ("Sans-B", "segoeuib.ttf"), ("Sans-I", "segoeuii.ttf"),
                  ("Sans-BI", "segoeuiz.ttf"), ("Mono", "consola.ttf"), ("Mono-B", "consolab.ttf")):
    pdfmetrics.registerFont(TTFont(nome, _F + arq))
pdfmetrics.registerFontFamily("Sans", normal="Sans", bold="Sans-B", italic="Sans-I", boldItalic="Sans-BI")
pdfmetrics.registerFontFamily("Mono", normal="Mono", bold="Mono-B", italic="Mono", boldItalic="Mono-B")

# ── Paleta (a mesma do site) ──────────────────────────────────────────────────────────────────────
NAVY = colors.HexColor("#0a2a4a")
NAVY2 = colors.HexColor("#164a7c")
SEA = colors.HexColor("#0a8795")
SEA_L = colors.HexColor("#e3f4fd")
SKY = colors.HexColor("#2a9bdc")
SUN = colors.HexColor("#ffc62e")
SUN_D = colors.HexColor("#a35700")
CORAL = colors.HexColor("#f2593a")
GREEN = colors.HexColor("#1b8a5a")
GREY = colors.HexColor("#3b5673")
LINE = colors.HexColor("#c4d9ea")
CODEBG = colors.HexColor("#f1f6fb")
NIGHT = colors.HexColor("#050b14")
STEEL = colors.HexColor("#0a1a2e")
EMBER = colors.HexColor("#ff8a3d")
CYAN = colors.HexColor("#54d1e4")

PW, PH = A4
MX = 2.0 * cm                      # margem lateral
CW = PW - 2 * MX                   # largura útil
REPO = "github.com/AlanSouzaDev7/Naval_Design-WEB-V.1"


# ── Estilos de texto ──────────────────────────────────────────────────────────────────────────────
def S(name, **kw):
    base = dict(fontName="Sans", fontSize=10, leading=14.6, textColor=colors.HexColor("#1c2b3a"))
    base.update(kw)
    return ParagraphStyle(name, **base)


body = S("body", spaceAfter=6, alignment=TA_LEFT)
small = S("small", fontSize=8.6, leading=11.6, textColor=GREY)
h1 = S("h1", keepWithNext=1, fontName="Sans-B", fontSize=20, leading=25, textColor=NAVY, spaceBefore=4, spaceAfter=10)
h2 = S("h2", keepWithNext=1, fontName="Sans-B", fontSize=13.5, leading=18, textColor=SEA, spaceBefore=12, spaceAfter=5)
h3 = S("h3", keepWithNext=1, fontName="Sans-B", fontSize=10.6, leading=14, textColor=NAVY2, spaceBefore=8, spaceAfter=3)
bullet = S("bullet", leftIndent=14, bulletIndent=3, spaceAfter=3)
cell = S("cell", fontSize=8.6, leading=11.4)
cellb = S("cellb", fontSize=8.6, leading=11.4, fontName="Sans-B", textColor=NAVY)
cellh = S("cellh", fontSize=8.6, leading=11.4, fontName="Sans-B", textColor=colors.white)
cap = S("cap", fontSize=8.4, leading=11, textColor=GREY, alignment=TA_CENTER, spaceAfter=10)
fim = S("fim", alignment=TA_CENTER, textColor=GREY, fontSize=9)
code = ParagraphStyle("code", fontName="Mono", fontSize=7.6, leading=10.2, textColor=colors.HexColor("#12304f"),
                      backColor=CODEBG, borderColor=LINE, borderWidth=0.6, borderPadding=(5, 6, 5, 6),
                      leftIndent=6, rightIndent=6, spaceBefore=4, spaceAfter=10)
callout = S("callout", fontSize=9.4, leading=13.4, textColor=NAVY, backColor=colors.HexColor("#fff6d9"),
            borderColor=SUN, borderWidth=0.8, borderPadding=(7, 9, 7, 9), leftIndent=8, rightIndent=8,
            spaceBefore=6, spaceAfter=12)
callout_dark = S("callout_dark", fontSize=9.4, leading=13.4, textColor=colors.HexColor("#e8f1fa"),
                 backColor=colors.HexColor("#0d2238"), borderColor=EMBER, borderWidth=0.8, borderPadding=(7, 9, 7, 9),
                 leftIndent=8, rightIndent=8, spaceBefore=6, spaceAfter=12)


def P(t, s=body): return Paragraph(t, s)
def B(items): return [Paragraph(t, bullet, bulletText="•") for t in items]
def CODE(t): return Preformatted(t.strip("\n"), code)
def M(t): return "<font name='Mono'>%s</font>" % t          # trecho em fonte monoespaçada


def table(rows, widths, header=True, zebra=True, first_bold=False, head_bg=None, zebra_inicio=0):
    """Tabela no padrão do documento. zebra_inicio desloca as listras (para continuar uma tabela já existente)."""
    data = []
    for r, row in enumerate(rows):
        line = []
        for c, v in enumerate(row):
            if isinstance(v, str):
                st = cellh if (header and r == 0) else (cellb if (first_bold and c == 0) else cell)
                v = Paragraph(v, st)
            line.append(v)
        data.append(line)
    t = Table(data, colWidths=widths, repeatRows=1 if header else 0)
    st = [("VALIGN", (0, 0), (-1, -1), "TOP"),
          ("LEFTPADDING", (0, 0), (-1, -1), 5), ("RIGHTPADDING", (0, 0), (-1, -1), 5),
          ("TOPPADDING", (0, 0), (-1, -1), 4), ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
          ("LINEBELOW", (0, 0), (-1, -1), 0.4, LINE)]
    if header:
        st += [("BACKGROUND", (0, 0), (-1, 0), head_bg or NAVY)]
    if zebra:
        for i in range(1 if header else 0, len(rows)):
            if (i + zebra_inicio) % 2 == 0:
                st.append(("BACKGROUND", (0, i), (-1, i), colors.HexColor("#f5f9fd")))
    t.setStyle(TableStyle(st))
    return t


def shot(path, caption, width=CW):
    """Figura com borda fina e legenda centralizada."""
    w, h = PILImage.open(path).size
    img = Image(path, width=width, height=width * h / w)
    t = Table([[img]], colWidths=[width])
    t.setStyle(TableStyle([("BOX", (0, 0), (-1, -1), 0.6, LINE), ("LEFTPADDING", (0, 0), (-1, -1), 0),
                           ("RIGHTPADDING", (0, 0), (-1, -1), 0), ("TOPPADDING", (0, 0), (-1, -1), 0),
                           ("BOTTOMPADDING", (0, 0), (-1, -1), 0)]))
    return KeepTogether([t, Spacer(1, 3), Paragraph(caption, cap)])


# ── Moldura da página: cabeçalho e rodapé ─────────────────────────────────────────────────────────
def moldura(canv, versao, secao, pagina):
    """Cabeçalho azul-marinho com filete amarelo e rodapé com filete e número da página (geometria da v4.1)."""
    canv.saveState()
    canv.setFillColor(NAVY)
    canv.rect(0, PH - 30.0, PW, 30.0, stroke=0, fill=1)
    canv.setFillColor(SUN)
    canv.rect(0, PH - 32.6, PW, 2.6, stroke=0, fill=1)
    canv.setFillColor(colors.white)
    canv.setFont("Sans-B", 8.5)
    canv.drawString(MX, PH - 0.75 * cm, "ROYAL NAVY  —  Documentação Técnica  ·  v%s" % versao)
    if secao:
        canv.setFont("Sans", 8.5)
        canv.drawRightString(PW - MX, PH - 0.75 * cm, secao)
    canv.setStrokeColor(LINE)
    canv.setLineWidth(0.5)
    canv.line(MX, 43.9, PW - MX, 43.9)
    canv.setFillColor(GREY)
    canv.setFont("Sans", 8.5)
    canv.drawString(MX, 28.4, REPO)
    canv.drawRightString(PW - MX, 28.4, "Página %d" % pagina)
    canv.restoreState()


class Secao(Flowable):
    """Marca o início de uma seção: atualiza o título do cabeçalho e cria o marcador (outline) do PDF."""

    def __init__(self, titulo):
        super().__init__()
        self.titulo = titulo
        self.width = self.height = 0

    def draw(self):
        doc = self.canv._doctemplate
        doc.secao_atual = self.titulo
        chave = "s%d" % id(self)
        self.canv.bookmarkPage(chave)
        self.canv.addOutlineEntry(self.titulo, chave, level=0)
        doc.marcadores.append((self.titulo, self.canv.getPageNumber()))


class Documento(BaseDocTemplate):
    """Páginas no padrão do documento. primeira_pagina = número que a 1ª página gerada terá no PDF final."""

    def __init__(self, caminho, versao, primeira_pagina, secao_inicial="", **kw):
        super().__init__(caminho, pagesize=A4, leftMargin=MX, rightMargin=MX, topMargin=2.0 * cm,
                         bottomMargin=2.0 * cm, **kw)
        self.versao, self.primeira, self.secao_atual, self.marcadores = versao, primeira_pagina, secao_inicial, []
        frame = Frame(MX, 2.0 * cm, CW, PH - 4.0 * cm, id="n")    # mesmas folgas (6 pt) do original
        # o cabeçalho é desenhado no FIM da página: assim mostra a seção que começou nela
        self.addPageTemplates([PageTemplate(id="normal", frames=[frame], onPageEnd=self._moldura)])

    def _moldura(self, canv, doc):
        moldura(canv, self.versao, self.secao_atual, self.primeira + canv.getPageNumber() - 1)
