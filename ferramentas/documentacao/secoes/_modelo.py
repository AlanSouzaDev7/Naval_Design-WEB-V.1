# -*- coding: utf-8 -*-
"""MODELO de seção nova. Copie para secoes/secao_20.py (por exemplo), troque o conteúdo e acrescente
"secao_20" em edicao.SECOES_NOVAS. O gerador põe sozinho o título (h1), o cabeçalho e o marcador do PDF.

Ferramentas disponíveis em `e` (estilo.py): P(texto, estilo), B([itens]), CODE(texto), M(trecho_mono),
table(linhas, larguras, ...), shot(caminho_da_imagem, legenda), e os estilos body, small, h2, h3, callout,
callout_dark, cap. Larguras: use e.CW (largura útil) e reportlab.lib.units.cm.
"""
from reportlab.lib.units import cm

TITULO = "20. Título da seção (v4.5)"


def conteudo(e):
    s = []
    s.append(e.P("Parágrafo de abertura: o que esta versão entrega e por quê.", e.callout))
    s.append(e.P("20.1  Primeira parte", e.h2))
    s.append(e.P("Texto normal, com <b>negrito</b>, <i>itálico</i> e " + e.M("codigo") + "."))
    s += e.B(["Item de lista um.", "Item de lista dois."])
    s.append(e.table([
        ["Coluna A", "Coluna B"],
        ["valor", "explicação"],
    ], [4.0 * cm, e.CW - 4.0 * cm], first_bold=True))
    return s
