# -*- coding: utf-8 -*-
"""Seção 22 — Página de carregamento do servidor (v4.5.2)."""
from pathlib import Path

from reportlab.lib.units import cm

TITULO = "22. Página de carregamento (v4.5.2)"
FIG = Path(__file__).resolve().parent.parent / "figuras"


def conteudo(e):
    M, P, B, T = e.M, e.P, e.B, e.table
    s = []
    s.append(P("O plano gratuito do Render desliga o servidor depois de alguns minutos sem visitas. Quem chegava nesse momento via a "
               "tela de “waking up” do próprio Render por cerca de um minuto. A versão 4.5.2 (27 de outubro de 2026) troca essa espera por "
               "uma <b>página de carregamento com o tema do site</b>, que acorda o servidor e só leva o visitante quando ele já responde.", e.callout))

    s.append(P("22.1  Por que não dá para trocar a tela do Render", e.h2))
    s.append(P("A tela de “waking up” é servida pelo proxy do Render enquanto a instância ainda está desligada: nesse momento nenhum código "
               "do site está rodando, então não há como alterá-la nem sobrepor algo a ela. A solução foi mudar a <b>porta de entrada</b>: o "
               "link público passa a ser uma página no GitHub Pages, que nunca dorme:"))
    s.append(P(M("https://alansouzadev7.github.io/Naval_Design-WEB-V.1/abrir.html"), e.small))

    s.append(P("22.2  Como funciona", e.h2))
    s.append(T([
        ["Passo", "O que acontece"],
        ["1. Espera com tema", "A página mostra céu estrelado, mar e uma fragata balançando (noite no tema escuro, crepúsculo no claro), uma rosa dos ventos de latão girando, mensagens de bordo (“Içando a âncora…”), barra de progresso e contador."],
        ["2. Acorda o servidor", "Pede ao Render, como imagem, o " + M("/sinal.svg") + ". Enquanto o servidor dorme o pedido falha ou demora; a página tenta de novo a cada 2,5 s (cada tentativa espera até 15 s)."],
        ["3. Entra no site", "Quando a imagem carrega, o servidor está no ar: “Porto à vista!”, a barra vai a 100% e a página abre o destino com " + M("location.replace") + "."],
        ["4. Plano B", "Depois de 2,5 minutos aparecem “Abrir o site mesmo assim” e “Ver a versão estática”."],
    ], [3.6 * cm, e.CW - 3.6 * cm], first_bold=True))
    s.append(e.shot(str(FIG / "v452_carregando.jpg"), "Figura 48 — A página de carregamento. Esquerda: tema escuro, no instante em que o servidor responde. "
                                                        "Direita: tema claro (crepúsculo náutico), esperando o servidor acordar."))

    s.append(P("22.3  Segurança", e.h2))
    s += B([
        "<b>Um só recurso aberto a outra origem.</b> O site envia " + M("Cross-Origin-Resource-Policy: same-origin") + " em tudo, o que impediria "
        "o GitHub Pages de usar qualquer arquivo dele. A rota nova " + M("/sinal.svg") + " é a única com " + M("cross-origin") + ": uma imagem SVG de "
        "1 px, sem dados, sem cache e sem tocar no banco.",
        "<b>Sem redirecionamento aberto.</b> O destino vem de uma lista fixa (" + M("?ir=consulta") + ", " + M("navegacao") + ", " + M("sugerir") + ", "
        + M("contato") + "); qualquer outro valor leva à página inicial.",
        "<b>CSP igual à das outras páginas.</b> O template usa a mesma política do servidor (um teste exige isso); só na versão do GitHub Pages o "
        + M("build_static.py") + " acrescenta o endereço do Render em " + M("img-src") + ", para o sinal.",
        "Sem estilos ou scripts inline: " + M("static/css/abrir.css") + " e " + M("static/js/abrir.js") + ". Com movimento reduzido, a cena é desenhada uma vez e a rosa não gira.",
    ])

    s.append(P("22.4  Verificação e operação", e.h2))
    s += B([
        "Testada no navegador com um servidor local nos dois casos: desligado (a página espera e tenta de novo) e ligado (entra direto no destino). "
        "Também no celular (375 px, sem rolagem lateral) e nos dois temas; um " + M("?ir=") + " malicioso foi ignorado.",
        "Três testes novos (198 no total): o modelo sem inline, o " + M("/sinal.svg") + " com os cabeçalhos certos e o resto do site ainda same-origin; a versão estática "
        "com a página, a CSP do sinal, os links “use a versão publicada” passando por ela e a lista fixa de destinos.",
        "<b>Para valer no ar:</b> publicar a versão no Render (Manual Deploy), para o " + M("/sinal.svg") + " existir no servidor, e trocar o "
        "<i>Website</i> do repositório no GitHub para o endereço do " + M("abrir.html") + ".",
    ])
    return s
