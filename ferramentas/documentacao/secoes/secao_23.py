# -*- coding: utf-8 -*-
"""Seção 23 — Rodada de QA (v4.5.3)."""
from reportlab.lib.units import cm

TITULO = "23. Rodada de QA (v4.5.3)"


def conteudo(e):
    M, P, B, T = e.M, e.P, e.B, e.table
    s = []
    s.append(P("A versão 4.5.3 (28 de outubro de 2026, commit " + M("3e760fb") + ") é uma rodada de teste de qualidade feita com o olhar do "
               "usuário final: navegar pelo site inteiro no computador e no celular, procurar falhas, vulnerabilidades, textos errados e "
               "números incoerentes, e corrigir o que fosse encontrado. Nenhuma injeção de SQL, XSS, CSRF ou redirecionamento aberto foi "
               "encontrada; os problemas eram de uso, conteúdo e responsividade.", e.callout))

    s.append(P("23.1  O que foi corrigido", e.h2))
    s.append(T([
        ["Área", "Problema", "Correção"],
        ["Menu no celular", "Abaixo de 768 px os links sumiam e não havia como chegar a Estrelas, Contato e às seções.",
         "Botão de menu criado por " + M("theme.js") + " em todas as páginas: " + M("aria-expanded") + ", fecha com Esc, com clique fora e ao alargar a janela."],
        ["Página inicial", "“700 anos de história” e “Navios ativos” que não batiam com a soma da frota.",
         "Anos calculados a partir de 1546 (" + M("data-since") + "); “Navios ativos” = soma das categorias da Frota (56)."],
        ["Navios", "Filtro sem a categoria do HMS Westminster; textos sem acento e com dados errados.",
         "Botão Fragata; textos de " + M("ships-data.js") + " revistos (comissionamento do Westminster, propulsão do Queen Elizabeth, Audacious, nome do Victory)."],
        ["URLs", "Endereços com barra final (" + M("/consulta/") + ") davam 404.",
         "Redirecionamento 308 para a forma sem barra, só para rotas que existem e sem redirecionamento aberto."],
        ["Consulta", "O número da página aceitava dígitos não ASCII e valores enormes.", "Só algarismos ASCII, até 2 dígitos; no navegador, no máximo 20 páginas."],
        ["Contato", "A mensagem de sucesso dava a entender que algo era enviado.", "“Mensagem validada!” e aviso de que é uma versão de demonstração."],
        ["Celular", "Grades e campos que alargavam a página em 320 px; links do rodapé com 18–23 px de altura.",
         "Colunas com " + M("minmax(0, 1fr)") + "; alvos de toque de cerca de 40 px."],
        ["Dependências", "A base OSV acusava um aviso no Werkzeug 3.1.8 (só no Windows).", "Atualizado para o Werkzeug 3.1.9: zero avisos nas 11 dependências."],
    ], [2.6 * cm, 6.4 * cm, e.CW - 9.0 * cm], first_bold=True))

    s.append(P("23.2  Verificação", e.h2))
    s += B([
        "28 testes novos (226 no total): barra final sem redirecionamento aberto, paginação só com algarismos ASCII, menu do celular sem "
        + M("innerHTML") + ", números da página inicial iguais à soma da frota, cada filtro com ao menos um navio e textos acentuados.",
        "Todas as páginas conferidas de 320 a 390 px nos dois temas; Bandit sem achados.",
        "<b>Ficou em aberto:</b> os números da frota (13 fragatas Type 23, “LPH” entre os anfíbios, o Westminster já em retirada) parecem "
        "desatualizados, mas as fontes divergem; não foram alterados sem uma fonte oficial.",
    ])
    return s
