# -*- coding: utf-8 -*-
"""Dados da edição atual do PDF. A cada versão nova: atualize VERSAO/DATA/TAG, acrescente uma linha em HISTORICO,
um item em SUMARIO, um parágrafo em MUDANCAS e (se houver seção nova) o módulo em secoes/ listado em SECOES_NOVAS.

As páginas das seções 1 a 19 vêm da BASE (o PDF publicado na tag v4.4.0); o gerador só refaz capa, sumário,
cabeçalhos, rodapés e o histórico de versões, e acrescenta as seções novas no fim.
"""

VERSAO = "4.7.0"
DATA = "29 de outubro de 2026"
TAG = "v4.7.0"
HOSPEDAGEM = "GitHub Pages + Render + Neon"
SUBTITULO = "Desempenho, dois temas, consulta segura ao banco e publicação online"

# PDF de partida: lido direto do Git (nada precisa ficar duplicado no repositório)
BASE_TAG = "v4.4.0"
BASE_ARQUIVO = "documentacao/Royal_Navy_Documentacao_Tecnica.pdf"

ASSUNTO = ("Auditoria, desempenho, paleta, modo escuro, consulta segura ao banco, publicação online e dossiê técnico; "
           "tema claro “Mar em Paz” (v4.1); revisão de segurança e robustez (v4.2); sugestões de navios e painel do "
           "administrador (v4.3); PDFs dos navios para download (v4.4); navegação pelas estrelas, carta celeste e planetas (v4.5); teste de qualidade da página (v4.5.1); página de carregamento do servidor (v4.5.2); rodada de QA (v4.5.3); animações, "
           "integração das páginas e modelos 3D fiéis aos navios reais (v4.6); navios 3D no topo da página inicial e foto do navio na ficha (v4.7)")

# (número, título, descrição) — o título tem de ser igual ao do cabeçalho da seção
SUMARIO = [
    ("1", "Resumo executivo", "resultados, métricas e o que foi entregue (v1.1, v2.0 e v3.0)"),
    ("2", "Dossiê técnico: como o site foi construído", "arquitetura, arquivos e o papel de cada linguagem"),
    ("3", "O motor 3D em detalhe", "Three.js, WebGL, ciclo de vida das cenas e temas"),
    ("4", "O hero animado e as demais animações", "Canvas 2D, controlador de cenas, reveal, contadores, modal"),
    ("5", "Modo escuro: guerra em alto mar (v2.0)", "botão, transição, batalha, mergulho, naufrágios e desempenho"),
    ("6", "Diagnóstico de desempenho", "o que deixava o site lento e como foi resolvido"),
    ("7", "Erros e bugs corrigidos", "catálogo completo com causa e solução"),
    ("8", "Paletas: dia ensolarado e noite de guerra", "cores, aplicação e acessibilidade"),
    ("9", "Como foi verificado", "metodologia, medições e limitações"),
    ("10", "Pendências e recomendações", "o que ficou de fora e próximos passos"),
    ("11", "Operação: executar, versionar e publicar", "comandos, variáveis, versões e GitHub"),
    ("12", "Publicação, domínio e segurança", "GitHub Pages, royalnavy.com.br, CSP e checklist"),
    ("13", "Consulta de navios: banco de dados e API (v3.0)", "PostgreSQL, API Flask, página de consulta, segurança e testes"),
    ("14", "Disponibilidade online (v4.0)", "Render + Neon, o certificado TLS, dados no ar e o que ficou pendente"),
    ("15", "Tema claro “Mar em Paz” (v4.1)", "hero em perspectiva, mergulho, recifes de coral, teste de fluidez e barra de navegação"),
    ("16", "Glossário", "termos técnicos usados neste documento"),
    ("17", "Revisão de segurança e robustez (v4.2)", "testes de ponta a ponta, 503 após inatividade, CSP sem 'unsafe-inline', segredos"),
    ("18", "Sugestões de navios e painel do administrador (v4.3)", "página Sugerir navio, armazenamento no GitHub, painel /admin e CSRF"),
    ("19", "PDFs dos navios para download (v4.4)", "ficha de cada navio e resultado da busca em PDF"),
    ("20", "Navegação pelas Estrelas (v4.5)", "das estrelas ao GPS, carta celeste, planetas em 3D, orrery e o gerador deste PDF"),
    ("21", "Teste de qualidade (v4.5.1)", "página Navegação pelas Estrelas: defeitos, desempenho e acessibilidade"),
    ("22", "Página de carregamento (v4.5.2)", "o site acorda o servidor do Render sem mostrar a tela de espera dele"),
    ("23", "Rodada de QA (v4.5.3)", "menu no celular, textos e números, URLs e Werkzeug 3.1.9"),
    ("24", "Movimento, integração e modelos 3D fiéis (v4.6)", "animações, degradês, páginas integradas e navios 3D"),
    ("25", "Navios 3D no topo e foto na ficha (v4.7)", "comboio e batalha em 3D, fotos do acervo e bateria de testes"),
]

COMO_LER = (
    "<b>Como ler este documento.</b> As seções 1 a 4 explicam <i>o que é o site e como ele funciona</i>; cada versão grande tem o "
    "seu dossiê (5, 13 a 15 e 17 a 25, na ordem das versões). As seções 6 e 7 registram <i>o que estava errado e o que foi feito</i>; "
    "a 8 documenta as identidades visuais; as 9 a 12 cobrem verificação, pendências, operação e publicação; a 16 é o glossário. "
    "Todos os números foram medidos ou extraídos do código-fonte — nada é estimativa sem indicação."
)

# Do mais novo para o mais antigo: (versão, texto completo, resumo curto). O primeiro aparece em destaque no
# sumário; os demais, só pelo resumo curto.
MUDANCAS = [
    ("4.7", "os modelos 3D do site no topo da página inicial (comboio e batalha) e a foto de cada navio na ficha da Consulta; "
            "testes em PC, tablet e celular — seção 25.", "3D no topo e fotos na ficha, seção 25"),
    ("4.6", "animações refinadas, transição entre páginas, degradês em OKLab, páginas internas integradas e os seis navios em 3D "
            "refeitos a partir do perfil real de cada classe — seção 24.", "movimento e modelos 3D, seção 24"),
    ("4.5.3", "rodada de QA com o olhar do usuário: menu no celular, textos dos navios corrigidos, números da página inicial coerentes, "
              "barra final nas URLs, paginação mais restrita e Werkzeug 3.1.9 — seção 23.", "rodada de QA, seção 23"),
    ("4.5.2", "página de carregamento com o tema do site no GitHub Pages: acorda o servidor do Render em segundo plano e só "
              "leva o visitante quando ele responde, no lugar da tela de espera do Render — seção 22.", "página de carregamento, seção 22"),
    ("4.5.1", "teste de qualidade da página Navegação pelas Estrelas: orrery que travava em telas de 120 Hz, dica que vazava no "
              "celular, rótulos sobrepostos, 3D carregado só quando necessário (página pronta em menos de 1 s), topo sem salto de "
              "layout e sete melhorias de acessibilidade — seção 21.", "teste de qualidade, seção 21"),
    ("4.5", "nova página “Navegação pelas Estrelas”: das estrelas ao GPS em cinco eras, instrumentos interativos, carta celeste "
            "com o céu calculado para noites históricas, planetas em 3D e um orrery com posições reais — seção 20. O gerador deste "
            "PDF foi reconstruído, e o sumário e o histórico de versões foram completados.", "navegação pelas estrelas, seção 20"),
    ("4.4", "PDFs para download da ficha de cada navio e do resultado da busca — seção 19.", "PDFs dos navios, seção 19"),
    ("4.3", "página “Sugerir navio”, painel restrito do administrador e proteção CSRF nos formulários — seção 18; "
            "a página de contato passou a ficar no fim da página inicial.", "sugestões de navios e painel, seção 18"),
    ("4.2", "revisão de segurança e robustez: testes de ponta a ponta com banco descartável, 503 após inatividade "
            "corrigido, CSP sem 'unsafe-inline' — seção 17.", "revisão de segurança, seção 17"),
    ("4.1", "tema claro “Mar em Paz” e barra de navegação corrigida — seção 15.", "tema claro “Mar em Paz”, seção 15"),
    ("4.0", "consulta de navios publicada na internet (Render + Neon) — seção 14.", "consulta online, seção 14"),
]

# Linhas acrescentadas ao histórico de versões (11.5), depois da 4.1.0 que já está na base
HISTORICO = [
    ["<b>4.2.0</b>", "30/09/2026", "<font name='Mono'>cb592f1</font>, <font name='Mono'>157c738</font> · tag <font name='Mono'>v4.2.0</font>",
     "Revisão de segurança e robustez: banco descartável nos testes, fim do 503 após inatividade, CSP sem 'unsafe-inline' (seção 17)"],
    ["<b>4.3.0</b>", "06–20/10/2026", "<font name='Mono'>b211636</font>, <font name='Mono'>cba3b71</font> · tag <font name='Mono'>v4.3.0</font>",
     "Contato na página inicial; página “Sugerir navio”, painel /admin e CSRF nos formulários (seção 18)"],
    ["<b>4.4.0</b>", "20/10/2026", "<font name='Mono'>25c787a</font>, <font name='Mono'>8c6fc26</font> · tag <font name='Mono'>v4.4.0</font>",
     "PDFs da ficha de cada navio e do resultado da busca (seção 19)"],
    ["<b>4.5.0</b>", "27/10/2026", "tag <font name='Mono'>v4.5.0</font>", "Página Navegação pelas Estrelas e gerador do PDF reconstruído (seção 20)"],
    ["<b>4.5.1</b>", "27/10/2026", "tag <font name='Mono'>v4.5.1</font>", "Teste de qualidade da página Navegação pelas Estrelas (seção 21)"],
    ["<b>4.5.2</b>", "27/10/2026", "tag <font name='Mono'>v4.5.2</font>", "Página de carregamento que acorda o servidor do Render (seção 22)"],
    ["<b>4.5.3</b>", "28/10/2026", "<font name='Mono'>3e760fb</font>", "Rodada de QA, 226 testes (seção 23)"],
    ["<b>4.6.0</b>", "28/10/2026", "<font name='Mono'>d10c608</font>", "Animações, integração das páginas e modelos 3D fiéis (seção 24)"],
    ["<b>4.7.0</b>", "29/10/2026", "<font name='Mono'>eb3e362</font>", "Navios 3D no topo e foto do navio na ficha (seção 25)"],
]


# Módulos de secoes/ com as seções novas desta edição, na ordem (ex.: ["secao_20"])
SECOES_NOVAS = ["secao_20", "secao_21", "secao_22", "secao_23", "secao_24", "secao_25"]
