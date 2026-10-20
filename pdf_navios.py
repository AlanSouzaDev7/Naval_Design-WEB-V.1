"""
PDFs rapidos das informacoes dos navios (Royal Navy v4.4).

  * ficha_pdf(navio)                     -> ficha completa de um navio (A4 retrato)
  * lista_pdf(navios, total, filtros)    -> resultado de uma busca, em tabela (A4 paisagem)

Gerados em memoria com o ReportLab, com as fontes padrao do PDF (Helvetica): nao dependem de arquivos de
fonte no servidor e saem em milissegundos. Essas fontes cobrem o alfabeto latino (cp1252); um caractere
fora dele (ex.: o "o" com macron de "Soryu") vira a letra sem o sinal.

Seguranca: todo texto vindo do banco e escapado antes de entrar no layout (o ReportLab interpreta
marcacoes como <b> dentro dos paragrafos) e os dados chegam aqui ja lidos pelo papel somente-leitura.
"""

from __future__ import annotations

import io
import re
import unicodedata
from datetime import date, datetime, timezone
from html import escape as _escape_html

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

NAVY = colors.HexColor("#0A2A4A")
GOLD = colors.HexColor("#E8B21A")
AZUL = colors.HexColor("#1F5FA8")
CINZA = colors.HexColor("#5C6670")
LINHA = colors.HexColor("#D9E0E8")
ZEBRA = colors.HexColor("#F3F7FB")
TEXTO = colors.HexColor("#1F2630")
MAX_TEXTO = 4000                      # trava de seguranca por campo (o acervo nao tem textos tao longos)

_ST = {
    "tag": ParagraphStyle("tag", fontName="Helvetica-Bold", fontSize=8.5, leading=11, textColor=AZUL),
    "h1": ParagraphStyle("h1", fontName="Helvetica-Bold", fontSize=22, leading=26, textColor=NAVY, spaceBefore=2, spaceAfter=2),
    "sub": ParagraphStyle("sub", fontName="Helvetica", fontSize=10.5, leading=14, textColor=CINZA, spaceAfter=6),
    "h2": ParagraphStyle("h2", fontName="Helvetica-Bold", fontSize=12, leading=15, textColor=AZUL, spaceBefore=10, spaceAfter=4, keepWithNext=1),
    "p": ParagraphStyle("p", fontName="Helvetica", fontSize=10, leading=14, textColor=TEXTO),
    "li": ParagraphStyle("li", fontName="Helvetica", fontSize=10, leading=13.5, textColor=TEXTO, leftIndent=12, bulletIndent=2, spaceAfter=1.5),
    "th": ParagraphStyle("th", fontName="Helvetica-Bold", fontSize=9, leading=11.5, textColor=colors.white),
    "td": ParagraphStyle("td", fontName="Helvetica", fontSize=9, leading=11.5, textColor=TEXTO),
    "tdb": ParagraphStyle("tdb", fontName="Helvetica-Bold", fontSize=9, leading=11.5, textColor=TEXTO),
}


# ── texto seguro ────────────────────────────────────────────────────────────
def _cp1252(texto: str) -> str:
    """Mantem o que as fontes padrao do PDF desenham; o resto vira a letra sem acento (ou '?')."""
    saida = []
    for ch in texto:
        try:
            ch.encode("cp1252")
            saida.append(ch)
        except UnicodeEncodeError:
            base = "".join(c for c in unicodedata.normalize("NFKD", ch) if not unicodedata.combining(c))
            try:
                base.encode("cp1252")
                saida.append(base or "?")
            except UnicodeEncodeError:
                saida.append("?")
    return "".join(saida)


def limpo(valor, vazio="—") -> str:
    """Texto pronto para um Paragraph: sem caracteres de controle, no maximo MAX_TEXTO e ESCAPADO."""
    if valor is None or (isinstance(valor, str) and not valor.strip()):
        return vazio
    texto = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", "", str(valor)).strip()[:MAX_TEXTO]
    return _escape_html(_cp1252(texto), quote=False)      # so & < > (o ReportLab entende essas entidades)


def data_br(valor) -> str:
    if isinstance(valor, date):
        return valor.strftime("%d/%m/%Y")
    m = re.fullmatch(r"(\d{4})-(\d{2})-(\d{2})", str(valor or ""))
    return f"{m.group(3)}/{m.group(2)}/{m.group(1)}" if m else "não informado"


def itens(texto) -> list[str]:
    return [t.strip() for t in str(texto or "").split(";") if t.strip()]


def nome_arquivo(prefixo: str, nome: str | None = None) -> str:
    """Nome de arquivo so com [a-z0-9-] (nada de aspas, barras ou acentos no cabecalho HTTP)."""
    base = unicodedata.normalize("NFKD", nome or "")
    base = re.sub(r"[^a-z0-9]+", "-", base.encode("ascii", "ignore").decode().lower()).strip("-")[:60]
    return f"{prefixo}-{base}.pdf" if base else f"{prefixo}.pdf"


# ── moldura das paginas ─────────────────────────────────────────────────────
def _moldura(titulo: str):
    gerado = datetime.now(timezone.utc).strftime("%d/%m/%Y %H:%M UTC")

    def desenhar(c, doc):
        w, h = doc.pagesize
        c.saveState()
        c.setFillColor(NAVY); c.rect(0, h - 12 * mm, w, 12 * mm, stroke=0, fill=1)
        c.setFillColor(GOLD); c.rect(0, h - 12 * mm - 1, w, 1, stroke=0, fill=1)
        c.setFillColor(colors.white); c.setFont("Helvetica-Bold", 9)
        c.drawString(doc.leftMargin, h - 7.6 * mm, "ROYAL NAVY  ·  " + _cp1252(titulo))
        c.setFont("Helvetica", 8.5)
        c.drawRightString(w - doc.rightMargin, h - 7.6 * mm, "Arquivo naval")
        c.setStrokeColor(LINHA); c.setLineWidth(0.6); c.line(doc.leftMargin, 13 * mm, w - doc.rightMargin, 13 * mm)
        c.setFillColor(CINZA); c.setFont("Helvetica", 7.8)
        c.drawString(doc.leftMargin, 8.5 * mm, f"Gerado em {gerado} a partir do acervo (consulta somente leitura). Fins educativos.")
        c.drawRightString(w - doc.rightMargin, 8.5 * mm, f"Página {doc.page}")
        c.restoreState()
    return desenhar


def _documento(buf, titulo, tamanho=A4):
    return SimpleDocTemplate(buf, pagesize=tamanho, leftMargin=16 * mm, rightMargin=16 * mm, topMargin=20 * mm,
                             bottomMargin=19 * mm, title=_cp1252(titulo), author="Royal Navy - site educativo",
                             subject="Dados do acervo naval", creator="Royal Navy v4.4")


def _tabela(dados, larguras, cabecalho=True, zebra=True):
    t = Table(dados, colWidths=larguras, repeatRows=1 if cabecalho else 0)
    est = [("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 5), ("RIGHTPADDING", (0, 0), (-1, -1), 5),
           ("TOPPADDING", (0, 0), (-1, -1), 3.5), ("BOTTOMPADDING", (0, 0), (-1, -1), 3.5),
           ("LINEBELOW", (0, 0), (-1, -1), 0.4, LINHA)]
    if cabecalho:
        est.append(("BACKGROUND", (0, 0), (-1, 0), NAVY))
    if zebra:
        for i in range(2 if cabecalho else 1, len(dados), 2):
            est.append(("BACKGROUND", (0, i), (-1, i), ZEBRA))
    t.setStyle(TableStyle(est))
    return t


def _p(texto, estilo="p"):
    return Paragraph(texto, _ST[estilo])


# ── ficha de um navio ───────────────────────────────────────────────────────
def ficha_pdf(n: dict) -> bytes:
    buf = io.BytesIO()
    doc = _documento(buf, f"Ficha · {n.get('nome') or 'navio'}")
    largura = A4[0] - doc.leftMargin - doc.rightMargin
    S = []

    tags = "  ·  ".join(limpo(n.get(k), "") for k in ("marinha", "tipo", "guerra") if n.get(k))
    if tags:
        S.append(_p(tags.upper(), "tag"))
    S.append(_p(limpo(n.get("nome"), "Navio sem nome"), "h1"))
    sub = [f"Casco {limpo(n['designacao_casco'])}" if n.get("designacao_casco") else "",
           f"Classe {limpo(n['classe'])}" if n.get("classe") else ""]
    if any(sub):
        S.append(_p("  ·  ".join(s for s in sub if s), "sub"))

    S.append(_p("Cronologia", "h2"))
    S.append(_tabela([[_p("Batismo", "th"), _p("Comissionamento", "th"), _p("Baixa", "th")],
                      [_p(data_br(n.get(k)), "td") for k in ("data_batismo", "data_comissionamento", "data_baixa")]],
                     [largura / 3] * 3, zebra=False))

    if n.get("primeiro_comandante") or n.get("ultimo_comandante"):
        S.append(_p("Comando", "h2"))
        S.append(_tabela([[_p("Primeiro comandante", "tdb"), _p(limpo(n.get("primeiro_comandante")), "td")],
                          [_p("Último comandante", "tdb"), _p(limpo(n.get("ultimo_comandante")), "td")]],
                         [largura * 0.32, largura * 0.68], cabecalho=False))

    for titulo, campo in (("Batalhas e operações", "batalhas"), ("Armamento", "armamento")):
        linhas = itens(n.get(campo))
        if linhas:
            S.append(_p(titulo, "h2"))
            S.extend(Paragraph(limpo(l), _ST["li"], bulletText="•") for l in linhas[:200])

    for titulo, campo in (("Situação atual", "estado_atual"), ("Observações", "observacoes")):
        if n.get(campo):
            S.append(_p(titulo, "h2"))
            S.append(_p(limpo(n[campo])))

    outros = n.get("mesma_classe") or []
    if outros:
        S.append(_p(f"Outros navios da classe {limpo(n.get('classe'))}", "h2"))
        S.extend(Paragraph(limpo(o.get("nome")) + (f" ({limpo(o['designacao_casco'])})" if o.get("designacao_casco") else ""),
                           _ST["li"], bulletText="•") for o in outros)

    doc.build(S, onFirstPage=_moldura("Ficha do navio"), onLaterPages=_moldura("Ficha do navio"))
    return buf.getvalue()


# ── resultado de uma busca ──────────────────────────────────────────────────
def lista_pdf(navios: list[dict], total: int, filtros: dict, limite: int) -> bytes:
    buf = io.BytesIO()
    doc = _documento(buf, "Resultado da busca", landscape(A4))
    largura = landscape(A4)[0] - doc.leftMargin - doc.rightMargin
    S = [_p("RESULTADO DA BUSCA", "tag"), _p("Navios do acervo", "h1")]

    rotulos = {"q": "Busca", "marinha": "Marinha", "guerra": "Guerra", "tipo": "Tipo"}
    criterios = "  ·  ".join(f"{rotulos[k]}: <b>{limpo(v)}</b>" for k, v in filtros.items() if v)
    S.append(_p(criterios or "Sem filtros", "sub"))
    resumo = f"{total} navio{'s' if total != 1 else ''} encontrado{'s' if total != 1 else ''}"
    if total > len(navios):
        resumo += f"; este PDF traz os {len(navios)} primeiros (limite de {limite}). Refine a busca para ver os demais."
    S.append(_p(resumo, "p"))
    S.append(Spacer(1, 6))

    if navios:
        cab = ["Nome", "Casco", "Classe", "Marinha", "Tipo", "Guerra"]
        dados = [[_p(c, "th") for c in cab]]
        for n in navios:
            dados.append([_p(limpo(n.get("nome")), "tdb")] + [_p(limpo(n.get(k)), "td") for k in
                                                              ("designacao_casco", "classe", "marinha", "tipo", "guerra")])
        S.append(_tabela(dados, [largura * f for f in (0.24, 0.10, 0.17, 0.17, 0.16, 0.16)]))
    else:
        S.append(_p("Nenhum navio encontrado com esses critérios."))

    doc.build(S, onFirstPage=_moldura("Resultado da busca"), onLaterPages=_moldura("Resultado da busca"))
    return buf.getvalue()
