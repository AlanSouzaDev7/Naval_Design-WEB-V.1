# -*- coding: utf-8 -*-
"""Seção 25 — Navios 3D no topo da página inicial e foto do navio na ficha da Consulta (v4.7)."""
from pathlib import Path

from reportlab.lib.units import cm

TITULO = "25. Navios 3D no topo e foto na ficha (v4.7)"
FIG = Path(__file__).resolve().parent.parent / "figuras"


def conteudo(e):
    M, P, B, T = e.M, e.P, e.B, e.table
    f = lambda nome: str(FIG / nome)
    s = []
    s.append(P("A versão 4.7.0 (29 de outubro de 2026, commit " + M("eb3e362") + ") leva os modelos 3D das outras páginas para o "
               "topo da página inicial, onde os navios eram blocos desenhados à mão, e coloca a fotografia de cada navio no topo da "
               "ficha da Consulta. Depois veio uma bateria de testes no navegador, no computador, no tablet e no celular, nos dois temas.",
               e.callout))

    # ── 25.1 ───────────────────────────────────────────────────────────────────
    s.append(P("25.1  Comboio em 3D (modo claro)", e.h2))
    s.append(P("O comboio do topo continua sendo desenhado no canvas 2D do hero, mas os navios agora são os mesmos modelos de " +
               M("static/js/ships-3d.js") + ", renderizados numa camada WebGL fora da tela e copiados para o canvas entre a esteira e o "
               "helicóptero. A câmera 3D reproduz exatamente a projeção da cena 2D (mesma altura de 70 m, mesma distância focal e o "
               "mesmo ponto de fuga), então a esteira, a espuma e o casco coincidem."))
    s.append(T([
        ["Navio", "Medidas", "O que o modelo mostra"],
        ["Escoltas", "QE 284 m · Type 45 152 m · Type 23 133 m",
         "Os mesmos modelos dos cards, da galeria e da Frota Atual (seção 24), em escala real"],
        ["Porta-contêineres", "280 × 40 m",
         "Baias de 40 pés com pilhas de duas fileiras, alturas e cores sortidas, mais baixas perto da proa; tampas dos porões; pontes de "
         "peação; castelo com quebra-mar; acomodações à ré com janelas por convés, asas do passadiço, mastro e radar"],
        ["Petroleiro (Aframax)", "250 × 44 m",
         "Convés colorido com quatro tubulações de carga, passarela sobre pilares, manifold a meia-nau com dois guindastes e as "
         "escotilhas dos tanques"],
        ["Graneleiro (Supramax)", "225 × 32 m", "Cinco porões com tampas e quatro guindastes amarelos entre eles"],
        ["Transportador de veículos", "200 × 32 m",
         "Casco alto e fechado, faixa da companhia, passadiço na proa, aberturas de ventilação e rampa de popa recolhida"],
    ], [3.4 * cm, 3.6 * cm, e.CW - 7.0 * cm], first_bold=True))
    s += B([
        "<b>Uma chamada de desenho por navio.</b> " + M("ShipEngine.heroModel") + " monta o modelo e funde todas as peças numa só "
        "geometria com cor por vértice, já sem o que fica debaixo d'água (o porta-contêineres, o mais pesado, tem cerca de 8 mil "
        "triângulos). São 12 variantes montadas uma por vez em momentos ociosos (" + M("requestIdleCallback") + "); enquanto isso, a "
        "cena mostra os prismas antigos, que dão lugar aos modelos 3D com um esmaecimento de 0,9 s.",
        "<b>Linha d'água e névoa.</b> Um plano de recorte corta tudo abaixo da superfície; a névoa do horizonte é a mesma da cena 2D; "
        "a espuma em volta do casco segue o contorno real de cada modelo na linha d'água.",
        "<b>Entrada pela lateral.</b> Os navios novos nascem atrás da câmera e entram pela borda da tela, em vez de aparecer na frente "
        "dela; quando um navio chega ao horizonte, a malha é reaproveitada para o próximo.",
        "<b>Sem WebGL</b> (ou se algum modelo falhar), o hero continua com os prismas em 2D. Com movimento reduzido, o quadro parado é "
        "redesenhado quando os modelos ficam prontos.",
    ])
    s.append(e.shot(f("v47_comboio.jpg"), "Figura 53 — O comboio do topo de perto. Em cima: porta-contêineres, petroleiro e graneleiro. "
                                          "Embaixo: transportador de veículos, HMS Queen Elizabeth e Type 23."))

    # ── 25.2 ───────────────────────────────────────────────────────────────────
    s.append(P("25.2  Batalha com os navios reais (modo escuro)", e.h2))
    s.append(P("No modo escuro, as silhuetas genéricas deram lugar ao Type 45, ao Dreadnought, ao Queen Elizabeth e ao Type 23. Cada "
               "modelo é “fotografado” uma vez por redimensionamento, numa câmera ortográfica 6° acima do costado, sob luar azulado e "
               "o brilho alaranjado dos incêndios, e a imagem vira o sprite do navio. A cena de batalha continua igual: as bocas dos "
               "canhões, as janelas acesas e o topo do mastro (luz de navegação e holofote) saem do próprio modelo. A frota da direita é "
               "fotografada pelo bombordo e espelhada, para o número de casco não sair invertido."))
    s.append(e.shot(f("v47_topo.jpg"), "Figura 54 — O topo da página inicial no computador. Esquerda: o comboio em 3D (modo claro). "
                                       "Direita: a batalha com os modelos 3D (modo escuro)."))

    # ── 25.3 ───────────────────────────────────────────────────────────────────
    s.append(P("25.3  Foto do navio na ficha da Consulta", e.h2))
    s += B([
        "<b>Origem.</b> " + M("ferramentas/fotos_navios.py") + " pega a imagem principal do artigo de cada navio na Wikipedia em "
        "inglês, só quando ela tem licença livre no Wikimedia Commons, e grava duas larguras em WebP (1200 e 600 px) em "
        + M("static/img/navios/") + ". Autor, licença e página de origem ficam em " + M("static/data/fotos-navios.json") + ". "
        "Resultado: fotos de 69 dos 70 navios (7,2 MB no total), 59 em domínio público e 10 com licenças Creative Commons (CC BY-SA, CC BY "
        "e CC0). Cinco vieram de arquivos do Commons escolhidos à mão, porque a imagem do artigo não tinha licença livre; o Mariz e "
        "Barros (D28) ficou sem foto de propósito, porque as imagens livres encontradas são de outro navio com o mesmo nome.",
        "<b>Na página.</b> A ficha procura a foto pelo nome do navio e a coloca no topo, sangrando até as bordas do cartão, com o "
        "crédito (autor e licença, com link para o Commons) no canto. Sem foto, ou se a imagem não carregar, a ficha aparece como antes.",
        "<b>Fusão com o topo.</b> A foto e um véu nas cores do topo somem juntos por uma máscara em curva suave; o fim do esmaecimento "
        "passa por trás das etiquetas, então não existe uma linha onde a foto termina, nos dois temas e no celular.",
        "<b>Segurança.</b> As fotos estão no próprio site: a política de conteúdo continua " + M("img-src 'self' data:") + ". O crédito "
        "entra por " + M("textContent") + ", o link só é criado para endereços do Commons e só nomes de arquivo no formato esperado "
        "são aceitos.",
    ])
    s.append(e.shot(f("v47_ficha.jpg"), "Figura 55 — Ficha com a foto do navio. Esquerda: USS Arizona (modo claro). Centro: HMS Warspite "
                                        "(modo escuro). Direita: no celular."))

    # ── 25.4 ───────────────────────────────────────────────────────────────────
    s.append(P("25.4  Bateria de testes", e.h2))
    s += B([
        "<b>Testes automatizados:</b> 306 no total. Os 80 novos conferem que cada foto existe, é WebP, tem licença livre, "
        "crédito e origem no Commons; que as fotos são servidas pelo site; que a política de conteúdo não mudou; que a ficha monta a "
        "foto sem " + M("innerHTML") + "; e que o topo usa os modelos 3D sem perder a versão 2D.",
        "<b>No navegador</b> (Edge sem interface, banco de teste): as cinco páginas em 1366 × 800 (computador), 820 × 1180 (tablet, "
        "com toque) e 390 × 844 (celular, com toque), nos dois temas, mais o formulário de contato no computador e no celular. "
        "Resultado: 32 de 32 verificações aprovadas. Em cada página: sem erro no console, sem rolagem lateral e sem imagem quebrada; na inicial, o topo "
        "desenhado, o filtro de navios, o modal 3D (abre e fecha com Esc), as cenas 3D dos cards e o menu do celular; na Consulta, a "
        "busca, a ficha, a foto no topo e o PDF.",
        "<b>Limites.</b> Os créditos vêm dos metadados do Commons; quando o autor é desconhecido, a ficha diz isso. O navegador sem "
        "interface não mede fluidez: o desempenho dos modelos foi conferido pela contagem de triângulos e de chamadas de desenho.",
    ])
    return s
