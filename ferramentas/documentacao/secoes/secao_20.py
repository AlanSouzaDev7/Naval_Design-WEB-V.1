# -*- coding: utf-8 -*-
"""Seção 20 — Navegação pelas Estrelas (v4.5)."""
from pathlib import Path

from reportlab.lib.units import cm

TITULO = "20. Navegação pelas Estrelas (v4.5)"
FIG = Path(__file__).resolve().parent.parent / "figuras"


def conteudo(e):
    M, P, B, T = e.M, e.P, e.B, e.table
    f = lambda nome: str(FIG / nome)
    s = []
    s.append(P("A versão 4.5 (27 de outubro de 2026) acrescenta a página <b>/navegacao</b>, sobre como as marinhas navegaram pelas "
               "estrelas, da bússola estelar polinésia ao sextante, ao cronômetro de Harrison e ao GPS, e sobre como os planetas eram "
               "conhecidos em cada época. A página <b>calcula o céu de verdade</b> no navegador: estrelas, Sol, Lua e planetas nas posições "
               "de qualquer data entre 1500 e 2100, vistas de onde o navio estava.", e.callout))
    s.append(e.shot(f("v45_topo.jpg"), "Figura 39 — O topo da página nos dois temas: o céu real desta noite sobre Greenwich, girando acelerado "
                                       "em torno da Polar (rastros como numa foto de longa exposição). Esquerda: noite em alto-mar; direita: crepúsculo náutico."))

    s.append(P("20.1  O que a página mostra", e.h2))
    s.append(T([
        ["Parte", "O que é", "Como funciona"],
        ["Topo", "O céu desta noite sobre o Observatório de Greenwich, 240× mais rápido, com uma fragata em silhueta",
         "Canvas 2D; projeção estereográfica centrada na Polar; os rastros vêm de apagar só um pouco do quadro anterior a cada quadro"],
        ["Cinco eras", "Linha do tempo: Polinésia, latitude, longitude, sextante, rádio e satélites", "Texto com instrumentos interativos dentro das eras I, II e III"],
        ["Bússola estelar", "As 32 casas da bússola havaiana e a estrela Hōkūleʻa (Arcturus) nascendo e se pondo", "SVG gerado em JavaScript; a trajetória é calculada para a latitude do Havaí"],
        ["Quadrante", "Alinhar a alidade com a Polar dá a latitude do porto escolhido", "Canvas; ao sul do equador explica a troca pelo Cruzeiro do Sul"],
        ["Cronômetro", "Hora local × hora de Greenwich = longitude; e o erro de um relógio ruim em 40 dias de viagem", "Canvas com dois mostradores em algarismos romanos"],
        ["Carta celeste", "2.309 estrelas, 88 constelações, Sol, Lua e planetas de 6 noites (hoje e históricas)", "Projeção estereográfica do zênite; dica ao passar o ponteiro"],
        ["Os errantes", "Os 7 planetas em 3D com a história de cada um", "Three.js r128 (o mesmo do site); texturas geradas no navegador"],
        ["Orrery", "Planetário mecânico com posições reais de 1500 a 2100 e marcos históricos", "Canvas; Urano e Netuno aparecem “fantasmas” antes da descoberta"],
    ], [2.7 * cm, 6.6 * cm, e.CW - 9.3 * cm], first_bold=True))

    s.append(P("20.2  Conteúdo histórico e de onde ele veio", e.h2))
    s.append(P("Cada fato foi conferido em fontes primárias ou institucionais antes de entrar na página (a lista completa está no "
               "rodapé da própria página):"))
    s.append(T([
        ["Era", "Fatos principais", "Fonte"],
        ["I · Polinésia", "Bússola estelar de 32 casas de 11,25°; Mau Piailug leva a Hōkūleʻa do Havaí ao Taiti em 1976", "Polynesian Voyaging Society (hokulea.com)"],
        ["II · Latitude", "Polar ≈ latitude; astrolábio e quadrante; <i>Almanach Perpetuum</i> de Zacuto (Leiria, 1496); Mestre João e o Cruzeiro do Sul (1500)", "Biblioteca Nacional de Portugal"],
        ["III · Longitude", "Desastre das Scilly (22/10/1707, 1.400 a 2.000 mortos); Longitude Act de 1714 (£20.000); H4 de Harrison (1761); Nautical Almanac de Maskelyne (1767)", "Linda Hall Library, Historic England, Royal Museums Greenwich, U.S. Naval Observatory"],
        ["IV · Precisão", "Octante de Hadley (1731) e Godfrey; sextante de Campbell (1757); linha de Sumner (1837); método de Saint-Hilaire (1875); meridiano de Greenwich (1884)", "U.S. Naval Institute, Britannica"],
        ["V · Satélites", "LORAN (2ª Guerra); Transit (1964–1996); 1º satélite GPS (1978); a Academia Naval dos EUA volta a ensinar navegação astronômica (2015)", "The Aerospace Corporation, U.S. Navy"],
        ["Planetas", "Galileu e as luas de Júpiter (1610) como relógio de longitude (1612); Cook e o trânsito de Vênus (1769); Urano (Herschel, 1781); Netuno (Le Verrier e Galle, 1846); o nome <i>orrery</i> (Conde de Orrery, c. 1713)", "Rice University (Galileo Project), NASA/JPL, Whipple Museum"],
    ], [2.6 * cm, 9.2 * cm, e.CW - 11.8 * cm], first_bold=True))
    s.append(P("Uma armadilha de calendário: a Inglaterra só adotou o calendário gregoriano em 1752. O desastre das Scilly aconteceu em "
               "22 de outubro de 1707 no calendário juliano, que corresponde a <b>2 de novembro</b> no gregoriano usado pelos cálculos; "
               "a carta celeste usa a data gregoriana e explica a diferença.", e.small))
    s.append(e.shot(f("v45_rosa.jpg"), "Figura 40 — Era I: a bússola estelar havaiana. Passando o ponteiro numa casa aparece o nome e o significado; "
                                       "a estrela dourada é Hōkūleʻa (Arcturus), que nasce na casa ʻĀina.", width=e.CW * 0.78))
    s.append(e.shot(f("v45_quadrante.jpg"), "Figura 41 — Era II: o quadrante. Escolhido o porto, a mira só “trava” quando a alidade está a menos "
                                            "de 0,6° da Polar; a leitura é a latitude.", width=e.CW * 0.78))
    s.append(e.shot(f("v45_cronometro.jpg"), "Figura 42 — Era III: o cronômetro. Cada hora de diferença para Greenwich é 15° de longitude; com erro "
                                             "de alguns segundos por dia, a posição se perde em dezenas de milhas.", width=e.CW * 0.78))

    s.append(P("20.3  Identidade visual: duas atmosferas", e.h2))
    s += B([
        "<b>Modo claro = crepúsculo náutico.</b> O topo fica no azul-anil com o horizonte ainda claro: é a hora (Sol entre 6° e 12° abaixo "
        "do horizonte) em que o navegador mede as estrelas. Por isso, no claro, só aparecem as estrelas mais brilhantes. As seções viram "
        "<b>papel de carta náutica</b>, com grade fina de meridianos, e a carta celeste parece um <b>atlas impresso</b> (tinta sobre papel, "
        "nomes em vermelho).",
        "<b>Modo escuro = noite em alto-mar.</b> Céu profundo, estrelas com a cor real (pelo índice B−V) e a carta celeste como o céu de verdade.",
        "<b>Latão de instrumento antigo</b> em todos os detalhes: marcadores das eras, controles deslizantes, aros da carta e do orrery e a rosa "
        "dos ventos que separa as seções. Títulos em Cinzel, como no resto do site.",
    ])
    s.append(e.shot(f("v45_carta.jpg"), "Figura 43 — A carta celeste. Esquerda: esta noite sobre Greenwich, modo escuro. Direita: a noite do desastre "
                                        "das Scilly (1707) no modo claro, com Saturno, Netuno e a Lua nas posições calculadas para aquela data."))

    s.append(P("20.4  Cálculos astronômicos (static/js/astro.js)", e.h2))
    s.append(P("Tudo é calculado no navegador, sem servidor, por isso a página funciona igual no GitHub Pages:"))
    s += B([
        "<b>Tempo sideral</b> (IAU 1982) e conversão para altura e azimute.",
        "<b>Precessão</b> de J2000 para a data (Meeus, cap. 21): o céu de 1707 sai no lugar de 1707, não no de hoje.",
        "<b>Planetas</b> pelos elementos keplerianos aproximados da NASA/JPL (E. M. Standish, tabelas 2a e 2b, válidas de 3000 a.C. a 3000 d.C.).",
        "<b>Lua</b> pela fórmula de baixa precisão do Astronomical Almanac (cerca de 0,3°).",
        "<b>Projeção estereográfica</b>, a mesma dos planisférios e astrolábios: círculos do céu viram círculos no mapa.",
    ])
    s.append(T([
        ["Conferência com Meeus, <i>Astronomical Algorithms</i>", "Resultado do site", "Livro"],
        ["Tempo sideral, 10/04/1987 0h (ex. 12.a)", "197,6932°", "197,6932°"],
        ["Vênus, 20/12/1992 (ex. 33.a)", "AR 316,178° · Dec −18,888°", "316,174° · −18,888° (aparente)"],
        ["Precessão de θ Persei até 2028 (ex. 21.b)", "41,5472° · 49,3485°", "41,5473° · 49,3485°"],
        ["Lua, 12/04/1992 (ex. 47.a)", "134,75° · 13,67°", "134,69° · 13,77° (dentro dos 0,3° da fórmula)"],
    ], [7.0 * cm, 4.4 * cm, e.CW - 11.4 * cm], first_bold=True))
    s.append(P("Esses quatro casos viraram teste automático (" + M("tests/test_navegacao.py") + ", roda com o Node.js).", e.small))

    s.append(P("20.5  Os dados do céu (static/data/ceu.json)", e.h2))
    s.append(T([
        ["Conteúdo", "Origem", "Tamanho"],
        ["2.251 estrelas até a magnitude 5,3, com cor (B−V)", "d3-celestial (Olaf Frohn, licença BSD-3-Clause), a partir do catálogo Hipparcos", "69 KB no total"],
        ["As 57 estrelas de navegação e a Polar, numeradas como no Nautical Almanac", "Lista da Wikipédia (Bowditch/Nautical Almanac), casada com o catálogo pela designação de Bayer", ""],
        ["Linhas das 88 constelações", "d3-celestial", ""],
    ], [6.4 * cm, 7.6 * cm, e.CW - 14.0 * cm], first_bold=True))
    s.append(P("O arquivo é baixado uma vez com " + M("fetch") + " (a CSP já permite " + M("connect-src 'self'") + ") e as posições "
               "precessadas ficam em cache por ano. A atribuição da licença está no próprio JSON e no rodapé da página.", e.small))

    s.append(P("20.6  Planetas em 3D e o orrery", e.h2))
    s.append(P("Os sete planetas usam um único renderer do Three.js, só desenham enquanto o painel está visível e podem ser girados com o "
               "mouse ou o dedo. As texturas são <b>geradas no navegador</b> (ruído fractal em canvas): faixas e a Grande Mancha Vermelha "
               "em Júpiter, calotas polares em Marte, crateras em Mercúrio, anéis de Saturno com a Divisão de Cassini e Urano deitado (98°). "
               "Assim nenhuma imagem é baixada, e a CSP continua só com " + M("'self'") + " e o cdnjs."))
    s.append(e.shot(f("v45_planetas.jpg"), "Figura 44 — Saturno (modo escuro) e Urano (modo claro), com a ficha de cada planeta: desde quando é "
                                           "conhecido, se serve ao navegador e a sua história."))
    s.append(e.shot(f("v45_orrery.jpg"), "Figura 45 — O orrery com as posições de hoje. Os botões levam a datas históricas; antes de 1781 e 1846, "
                                         "Urano e Netuno aparecem esmaecidos, como “ainda desconhecidos”.", width=e.CW * 0.85))

    s.append(P("20.7  Problemas encontrados e corrigidos", e.h3))
    s.append(T([
        ["#", "Problema", "Correção"],
        ["N1", "Desenho inicial dos instrumentos falhava (" + M("ReferenceError") + ": a função ainda não existia quando o canvas mediu o tamanho)", "O primeiro desenho passou a vir do " + M("ResizeObserver") + ", depois de todo o código carregar"],
        ["N2", "“Agora” às 12h mostrava estrelas em pleno dia", "O céu do topo e a carta pulam para a próxima noite de verdade (Sol abaixo de −12°)"],
        ["N3", "Uma “meia-lua” clara dentro dos planetas 3D", "Era a emenda da textura. O ruído passou a ser contínuo na volta completa do globo"],
        ["N4", "Os anéis de Saturno saíam do quadro", "Câmera mais afastada para Saturno e Urano"],
        ["N5", "Nomes de estrelas com restos de link da Wikipédia (“Capella \"Capella (star)\"”)", "Nomes limpos no JSON; um teste impede que voltem"],
        ["N6", "Com o 9º link, o botão de tema saía da tela entre 1281 e ~1450 px (o defeito da v4.1 voltando)", "Faixa compacta da barra estendida até 1480 px e uma faixa extra até 820 px (ver abaixo)"],
    ], [0.9 * cm, 7.6 * cm, e.CW - 8.5 * cm]))

    s.append(P("20.8  A barra de navegação com 9 links", e.h2))
    s.append(P("O link <b>Estrelas</b> entrou em todas as páginas. Medido no Edge, com as fontes carregadas, o último link sempre termina antes do "
               "botão de tema, e o botão sempre cabe na tela:"))
    s.append(T([
        ["Largura", "Fim do último link", "Botão de tema", "Largura", "Fim do último link", "Botão de tema"],
        ["769 px", "668", "675 – 739", "1.366 px", "1.094", "1.272 – 1.336"],
        ["800 px", "683", "706 – 770", "1.440 px", "1.131", "1.346 – 1.410"],
        ["1.024 px", "923", "930 – 994", "1.536 px", "1.170", "1.346 – 1.463"],
        ["1.481 px", "1.143", "1.319 – 1.436", "1.920 px", "1.362", "1.538 – 1.655"],
    ], [2.0 * cm, 3.0 * cm, 3.0 * cm, 2.0 * cm, 3.0 * cm, e.CW - 13.0 * cm]))
    s.append(e.shot(f("v45_celular.jpg"), "Figura 46 — No celular (390×844): topo, quadrante, carta celeste e planetas se reorganizam numa coluna."))

    s.append(P("20.9  Segurança, desempenho e testes", e.h2))
    s += B([
        "<b>CSP inalterada</b>: sem estilos ou scripts inline, sem " + M("innerHTML") + " (os textos com negrito são montados com nós de texto) e o Three.js com SRI.",
        "<b>Desempenho</b>: cada canvas só anima enquanto está visível e com a aba em primeiro plano; " + M("prefers-reduced-motion") + " desenha um quadro só; DPR limitado a 1,5.",
        "<b>Back-end</b>: a rota " + M("/navegacao") + " no Flask (mesmos cabeçalhos de segurança das outras páginas) e a versão estática gerada por " + M("build_static.py") + ".",
        "<b>6 testes novos</b> (" + M("tests/test_navegacao.py") + "): rota e CSP, link em todas as páginas, validade dos dados, JSON servido, cálculos contra Meeus e versão estática. "
        "Os testes de segurança que já existiam (templates sem inline, JavaScript sem " + M("innerHTML") + ", CSP igual em cabeçalho e meta) também cobrem a página nova.",
    ])

    s.append(P("20.10  O gerador deste PDF foi reconstruído", e.h2))
    s.append(P("O script que montava o PDF até a v4.4 só existia em pastas temporárias, que foram apagadas. Ele foi reconstruído em "
               + M("ferramentas/documentacao/") + " e agora fica no repositório. O gerador parte do PDF publicado na tag " + M("v4.4.0")
               + ", remove de verdade o texto antigo de capa, cabeçalhos e rodapés, redesenha tudo com a mesma identidade visual e "
               "acrescenta as seções novas. Gerado sem seções novas, o resultado tem as mesmas 95 páginas da v4.4, e a comparação pixel a "
               "pixel só mostrou as correções pretendidas:"))
    s += B(["o sumário passou a listar as seções 17 a 20 (ia só até a 16);",
            "o histórico de versões (11.5) ganhou as linhas 4.2.0 a 4.5.0;",
            "os cabeçalhos tinham “v4.1” escondido sob “v4.4” e agora têm um texto só;",
            "o “Fim do documento”, que estava no meio do PDF, foi para o fim."])

    s.append(P("20.11  Limites", e.h3))
    s += B([
        "As posições servem para <b>visualizar</b>, não para navegar: Lua com cerca de 0,3° de erro e sem refração, paralaxe ou nutação.",
        "As noites históricas usam horários aproximados (o relato das Scilly fala em “por volta das 20h”).",
        "Os dados do céu seguem o catálogo Hipparcos (J2000); o movimento próprio das estrelas não é aplicado (irrelevante na escala da carta).",
    ])

    s.append(P("Termos novos deste capítulo", e.h3))
    s.append(T([
        ["Termo", "Significado"],
        ["Crepúsculo náutico", "Período em que o Sol está entre 6° e 12° abaixo do horizonte: já há estrelas e o horizonte ainda se vê; é a hora de medir."],
        ["Projeção estereográfica", "Forma de achatar a esfera celeste num plano que preserva círculos e ângulos; usada em astrolábios e planisférios."],
        ["Precessão", "Lento giro do eixo da Terra (um ciclo em cerca de 26 mil anos) que desloca as coordenadas das estrelas com o tempo."],
        ["Tempo sideral", "Hora medida pelas estrelas, não pelo Sol: diz qual parte do céu está passando pelo meridiano do observador."],
        ["Elementos keplerianos", "Seis números (semieixo, excentricidade, inclinação etc.) que descrevem a órbita de um planeta."],
        ["Índice B−V", "Diferença de brilho entre a luz azul e a visível de uma estrela; indica a sua cor (azulada, branca, alaranjada)."],
        ["Orrery", "Modelo mecânico do Sistema Solar, batizado em homenagem a Charles Boyle, 4º Conde de Orrery."],
        ["Linha de posição", "Linha (Sumner, 1837) sobre a qual o navio está, obtida de uma só medida de altura; duas linhas se cruzam no ponto."],
    ], [4.4 * cm, e.CW - 4.4 * cm], first_bold=True))
    return s
