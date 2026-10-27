# -*- coding: utf-8 -*-
"""Seção 21 — Teste de qualidade da página Navegação pelas Estrelas (v4.5.1)."""
from pathlib import Path

from reportlab.lib.units import cm

TITULO = "21. Teste de qualidade (v4.5.1)"
FIG = Path(__file__).resolve().parent.parent / "figuras"


def conteudo(e):
    M, P, B, T = e.M, e.P, e.B, e.table
    s = []
    s.append(P("A versão 4.5.1 (27 de outubro de 2026) não acrescenta conteúdo: é o resultado de um <b>teste de qualidade (QA)</b> da página "
               "<b>/navegacao</b>, feito em rodadas de testar, corrigir e medir de novo até não sobrar falha. Foram corrigidos dois defeitos "
               "funcionais, um vazamento de layout no celular, rótulos sobrepostos, o carregamento do 3D e sete pontos de acessibilidade.", e.callout))

    s.append(P("21.1  Como foi testado", e.h2))
    s += B([
        "<b>Auditoria automática</b> no Edge sem janela (protocolo DevTools), em 5 cenários: computador 1366×860 nos dois temas, tablet "
        "820×1180 e celular 375×812 nos dois temas. Mede DOMContentLoaded, LCP, CLS, tarefas longas, bytes, quadros por segundo de cada "
        "animação, rolagem lateral, contraste de todo texto (WCAG), controles sem rótulo, alvos de toque e erros do console.",
        "<b>Perfil de CPU</b> do carregamento, para achar quais funções gastavam o tempo, e registro da origem de cada salto de layout.",
        "<b>61 verificações funcionais</b>, como um usuário, no computador e no celular (com toque): teclado na bússola e nas abas, quadrante, "
        "cronômetro, noites e camadas da carta, toque nas estrelas, 3D, orrery, troca de tema, ordem de Tab e movimento reduzido.",
        "<b>Inspeção visual</b> de capturas de todas as seções nas três larguras.",
    ])

    s.append(P("21.2  Resultado medido", e.h2))
    s.append(T([
        ["Medida", "Antes", "Depois"],
        ["DOMContentLoaded (página pronta para uso)", "até 6,0 s", "0,2 a 0,9 s (2,2 s na 1ª abertura, navegador frio)"],
        ["Maior tarefa longa no carregamento", "1,3 s", "≈ 0,2 s"],
        ["Salto de layout (CLS) no tablet", "0,37", "0,04 (computador 0,002; celular 0)"],
        ["Texto com contraste abaixo do WCAG AA", "2", "0"],
        ["Paradas de Tab só na bússola estelar", "32", "1 (as setas percorrem as casas)"],
        ["Verificações funcionais", "55 de 59", "61 de 61"],
        ["Erros no console", "0", "0"],
    ], [7.0 * cm, 3.4 * cm, e.CW - 10.4 * cm], first_bold=True))

    s.append(P("21.3  Defeitos e correções", e.h2))
    s.append(T([
        ["#", "Problema", "Causa e correção"],
        ["Q1", "“Girar o tempo” do orrery não saía do lugar em monitores de 120 Hz",
         "O ano era relido do controle deslizante, de passo 0,01; o avanço por quadro (≈0,003) era arredondado para zero. O ano agora corre numa variável própria."],
        ["Q2", "No celular, a dica da carta celeste vazava pela direita e criava rolagem lateral",
         "A dica abre para o lado que cabe e é limitada às bordas da tela; um toque também a mostra (antes só passando o mouse)."],
        ["Q3", "Nomes sobrepostos na carta (Urano/Aldebaran/Lua, Saturno/Netuno) e no orrery (Vênus/Terra/Mercúrio, ponto vernal fora da tela)",
         "Posicionador de rótulos comum aos dois: tenta 8 posições em volta do ponto, planetas primeiro, respeita o círculo ou a borda e põe contorno escuro no texto. Orrery quadrado no celular e Sol desenhado antes dos planetas."],
        ["Q4", "O Three.js compilava os shaders no carregamento (≈0,8 s de CPU) para um planeta ainda fora da tela; o script também atrasava o DOMContentLoaded",
         "O Three.js saiu do HTML: " + M("planetas-3d.js") + " o baixa (com SRI) e liga o WebGL só quando o painel chega a 600 px da tela."],
        ["Q5", "O topo “pulava” ao carregar (CLS 0,37)",
         "A legenda do céu crescia de 1 para 3 linhas e o título trocava de fonte. Legenda encurtada com linhas reservadas, título com 2 linhas reservadas e fontes de reserva com as mesmas medidas da Cinzel, Rajdhani e Inter (" + M("size-adjust") + ")."],
        ["Q6", "Formatar números criava um " + M("Intl.NumberFormat") + " por chamada dentro dos laços de animação",
         "Formatadores criados uma vez; o céu do topo também filtra as estrelas visíveis uma vez por tema, não a cada quadro."],
    ], [0.9 * cm, 6.4 * cm, e.CW - 7.3 * cm]))
    s.append(e.shot(str(FIG / "v451_celular.jpg"), "Figura 47 — No celular (390 px). Esquerda: o orrery antes, em 16:9, com nomes amontoados e o ponto "
                                                    "vernal cortado. Centro e direita: a carta celeste e o orrery depois, sem sobreposição."))

    s.append(P("21.4  Acessibilidade", e.h2))
    s += B([
        "As abas dos planetas apontam para um painel de verdade (" + M('role="tabpanel"') + ", " + M("aria-controls") + ") e aceitam Home e End além das setas.",
        "A bússola estava marcada como imagem (" + M('role="img"') + "), o que escondia as 32 casas do leitor de tela; virou um grupo com uma só parada de Tab.",
        "A legenda do céu muda a cada segundo e deixou de ser região viva (" + M("aria-live") + "): o leitor de tela não fica repetindo o texto.",
        "Aba ativa e botões selecionados passaram de 3,2:1 para mais de 4,5:1 de contraste (latão escuro no claro, latão claro com texto escuro no escuro).",
        "Foco visível nas casas da bússola e no painel do planeta; o resumo “Fontes” ganhou área de toque maior.",
    ])

    s.append(P("21.5  Testes", e.h2))
    s.append(P("Dois testes novos em " + M("tests/test_navegacao.py") + ": o Three.js fora do HTML e baixado sob demanda com SRI, e a "
               "acessibilidade das abas, da bússola e da legenda. A suíte tem <b>195 testes</b>; os 10 de " + M("test_sugestoes.py")
               + " precisam do banco descartável (Docker) e falham sem ele, como antes."))
    return s
