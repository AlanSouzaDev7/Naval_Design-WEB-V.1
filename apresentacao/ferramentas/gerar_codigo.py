"""
Gera as "fotos" de código da seção "Por dentro do código" e os slides correspondentes.

Os trechos são lidos DIRETO do Git (branch `main`), por padrão de texto, então a imagem sempre mostra
o código real, com a numeração de linhas verdadeira. Quando o código mudar, rode de novo.

    <venv do projeto>\\Scripts\\python.exe ferramentas/gerar_codigo.py imagens
        -> apresentacao/codigo-img/<nome>.png  +  manifest.json
    (envie os PNGs como assets do artifact e salve {"nome": "/_blob/<id>", ...} em codigo-img/urls.json)
    <venv>\\Scripts\\python.exe ferramentas/gerar_codigo.py slides
        -> project/slides/cod-*.html, ordem/seção no deck.json e renumeração "NN / total" em todos os slides

Precisa de Pillow e Pygments (já estão no .venv do projeto) e das fontes do Windows (Cascadia Mono, Segoe UI).
"""
import html
import json
import pathlib
import re
import subprocess
import sys

RAIZ_APRES = pathlib.Path(__file__).resolve().parent.parent
RAIZ_REPO = RAIZ_APRES.parent
IMG = RAIZ_APRES / "codigo-img"
SLIDES = RAIZ_APRES / "project" / "slides"
DECK = RAIZ_APRES / "project" / "deck.json"
REF = "main"

FONTE_MONO = r"C:\Windows\Fonts\CascadiaMono.ttf"
FONTE_UI = r"C:\Windows\Fonts\seguisb.ttf"
TAM, LINHA = 32, 46                          # tamanho nativo da fonte e altura de linha (px)

# ───────────────────────────── trechos ─────────────────────────────
# trechos: lista de (padrão_inicial, padrão_final) — inclusivo; o final é procurado a partir do inicial.
CODIGOS = [
    dict(nome="cod-flask", arq="app.py", lex="python", ling="Python",
         trechos=[("@app.after_request", "    return resp")],
         hl=["Content-Security-Policy", "Strict-Transport"],
         eyebrow="Back-end · Python · Flask", titulo="Cada resposta sai blindada",
         itens=[("Cabeçalhos em tudo", "nosniff, DENY, Referrer, Permissions, COOP e CORP."),
                ("CSP rigorosa", "Sem unsafe-inline; frame-ancestors 'none'."),
                ("Servidor discreto", "Não revela versão de Python nem Werkzeug."),
                ("HTTPS obrigatório", "HSTS de um ano quando roda em HTTPS.")],
         nota="app.py é o servidor Flask. Um gancho after_request acrescenta cabeçalhos de segurança a toda resposta: impede que o navegador adivinhe tipos de arquivo, que o site seja embutido em iframes e limita câmera, microfone e localização. A política de conteúdo (CSP) não aceita scripts nem estilos inline. Antes disso, um before_request recusa qualquer Host que não esteja na lista permitida, contra DNS rebinding."),
    dict(nome="cod-validacao", arq="consulta_api.py", lex="python", ling="Python",
         trechos=[("def limpar_texto", "    return texto"), ("def validar_busca", "Parâmetros inválidos.")],
         hl=["EXTRAS_PERMITIDOS", "desconhecidas"],
         eyebrow="Back-end · Python · API", titulo="Nenhum texto entra sem validação",
         itens=[("Lista de permitidos", "Só letras, dígitos e . ' ( ) / -"),
                ("Tamanho limitado", "2 a 60 caracteres; URL de até 400 bytes."),
                ("Parâmetros conhecidos", "Chave estranha ou repetida vira HTTP 400."),
                ("Erro seguro", "A mensagem não revela nada do servidor.")],
         nota="consulta_api.py é a API somente-leitura. Todo texto vindo do navegador passa por limpar_texto: normaliza Unicode e espaços, limita o tamanho e aceita apenas letras, dígitos e alguns símbolos. validar_busca recusa a URL longa demais, parâmetros desconhecidos ou repetidos. Qualquer violação vira um erro 400 com mensagem genérica."),
    dict(nome="cod-rotas", arq="consulta_api.py", lex="python", ling="Python",
         trechos=[('@bp.get("/navios/busca")', 'return resposta({"total"'),
                  ('@bp.get("/navios/<int:navio_id>/pdf")', "gerador.nome_arquivo")],
         hl=["@limiter.limit"],
         eyebrow="Back-end · Python · Rotas", titulo="Rotas enxutas, com limite por IP",
         itens=[("Limite por IP", "30 buscas/min; 10 PDFs de ficha e 6 de busca."),
                ("Validar e só então ler", "Toda rota valida antes de tocar no banco."),
                ("Paginação no banco", "10 por página, com LIMIT e OFFSET."),
                ("JSON e PDF, mesma base", "A ficha usa a mesma consulta nos dois.")],
         nota="As rotas da API são curtas: validam a entrada, executam uma consulta parametrizada e devolvem JSON. O Flask-Limiter impõe limites por IP em cada rota. A rota de PDF da v4.4 reaproveita a mesma função que monta a ficha em JSON, então PDF e tela mostram exatamente os mesmos dados."),
    dict(nome="cod-sql-busca", arq="consulta_api.py", lex="postgresql", ling="SQL",
         titulo_arq="consulta_api.py · SQL_BUSCA",
         trechos=[("WITH p AS (", "LIMIT %(lim)s OFFSET %(off)s")],
         hl=["word_similarity(p.q, v.busca_norm) >= 0.5", "%(marinha)s::text IS NULL"],
         eyebrow="Banco de dados · SQL · Busca", titulo="SQL parametrizado e tolerante a erros",
         itens=[("Só parâmetros", "%(q)s chega como valor, nunca como SQL."),
                ("Sem acento", "rn_norm normaliza nome, classe e casco."),
                ("Tolera erro de digitação", "word_similarity do pg_trgm acha o navio."),
                ("Curingas escapados", "% e _ digitados não viram curingas.")],
         nota="Esta é a consulta de busca, em SQL do PostgreSQL. O texto do usuário entra como parâmetro (%(q)s), nunca concatenado, o que fecha a porta para SQL injection. A busca compara texto normalizado, sem acentos, e usa word_similarity da extensão pg_trgm para tolerar erros de digitação. A ordenação privilegia o nome exato, depois o prefixo, depois a similaridade."),
    dict(nome="cod-sql-objetos", arq="db/01_busca.sql", lex="postgresql", ling="SQL",
         trechos=[("CREATE OR REPLACE FUNCTION public.rn_norm", "$fn$;"),
                  ("CREATE INDEX IF NOT EXISTS idx_navios_busca_trgm", "gin_trgm_ops);"),
                  ("CREATE OR REPLACE VIEW public.v_navios AS", "  n.marinha,")],
         hl=["USING gin", "CREATE OR REPLACE VIEW"],
         eyebrow="Banco de dados · SQL · Estrutura", titulo="Busca indexada e uma view pública",
         itens=[("Extensões do PostgreSQL", "unaccent e pg_trgm, busca sem acento."),
                ("Índice trigrama GIN", "LIKE e similaridade usam o mesmo índice."),
                ("View como única porta", "Expõe só os campos da consulta."),
                ("Script idempotente", "Só acrescenta; pode rodar várias vezes.")],
         nota="db/01_busca.sql prepara o banco sem alterar dados. Cria a função rn_norm, que tira acentos e põe em minúsculas, um índice trigrama GIN que atende tanto o LIKE quanto a similaridade, e a view v_navios, a única coisa que a aplicação consegue ler. A view esconde colunas internas e normaliza valores como N/A."),
    dict(nome="cod-sql-papel", arq="db/02_papel_leitura.sql", lex="postgresql", ling="SQL",
         trechos=[("CREATE ROLE navios_leitura", "CONNECTION LIMIT 10"),
                  ("ALTER ROLE navios_leitura SET default_transaction_read_only", "idle_in_transaction_session_timeout"),
                  ("REVOKE ALL ON ALL TABLES", "GRANT  SELECT ON public.v_navios")],
         hl=["default_transaction_read_only", "GRANT  SELECT"],
         eyebrow="Banco de dados · SQL · Privilégios", titulo="Um papel que só sabe ler",
         itens=[("Sem superpoderes", "Não cria banco nem papel; até 10 conexões."),
                ("Sessão somente-leitura", "Toda transação já nasce read-only."),
                ("Consulta lenta cancelada", "statement_timeout de 3 segundos."),
                ("Só a view", "Nem a tabela original ele enxerga.")],
         nota="db/02_papel_leitura.sql cria o papel navios_leitura, o único usuário com que o site conversa com o banco. Ele não é superusuário, não cria nada, tem no máximo 10 conexões, toda sessão nasce somente-leitura e consultas acima de 3 segundos são canceladas. Por fim, perde acesso a todas as tabelas e recebe SELECT apenas na view. Os testes tentam 15 comandos proibidos com esse papel e todos falham."),
    dict(nome="cod-pdf", arq="pdf_navios.py", lex="python", ling="Python",
         trechos=[("def ficha_pdf", 'S.append(_p("  ·  ".join(s for s in sub if s), "sub"))')],
         hl=["io.BytesIO()"],
         eyebrow="Back-end · Python · PDFs (v4.4)", titulo="Ficha do navio em PDF, no servidor",
         itens=[("ReportLab no Flask", "PDF montado em memória, sem temporários."),
                ("Mesma fonte de dados", "Ficha validada, pelo papel de leitura."),
                ("Texto sempre limpo", "limpo() trata vazios e caracteres."),
                ("Rápido", "Ficha em ~108 ms; busca de 59 navios em 59 ms.")],
         nota="pdf_navios.py, da v4.4, monta com ReportLab o PDF da ficha de um navio e o da lista de resultados de uma busca. Tudo acontece em memória (BytesIO), sem arquivos temporários. Os dados vêm da mesma função validada que alimenta o JSON da API. Medido: a ficha do USS Arizona saiu em 108 ms na primeira chamada e a lista de 59 navios em 59 ms."),
    dict(nome="cod-sugestoes", arq="sugestoes.py", lex="python", ling="Python",
         trechos=[("if protecao.isca_preenchida()", 'return _resultado("registrada", nome=valores'),
                  ("chave, exatos, parecidos = comparar", "chave, exatos, parecidos = comparar"),
                  ("    if exatos:", "return _pagina(200, parecidos=parecidos")],
         hl=["isca_preenchida", "comparar(dados"],
         eyebrow="Back-end · Python · Sugestões (v4.3)", titulo="Sugestões do público, fora do banco",
         itens=[("Isca contra robôs", "Campo invisível: robô recebe ok, nada grava."),
                ("Confere o acervo", "Já existente avisa; parecido pede confirmação."),
                ("Fora do banco", "Vai para um JSON versionado no GitHub."),
                ("Limite e CSRF", "6 envios por minuto e token em todo POST.")],
         nota="sugestoes.py, da v4.3, trata a página Sugerir navio. Um campo-isca invisível descarta robôs fingindo sucesso. O nome é validado e comparado com o acervo, só por leitura: se o navio já existe, o visitante é avisado; se há nomes parecidos, a página pergunta Você quis dizer. A sugestão é gravada num arquivo JSON versionado em um repositório do GitHub, nunca no banco. O painel /admin avalia as sugestões."),
    dict(nome="cod-csrf", arq="protecao.py", lex="python", ling="Python",
         trechos=[("def _origem_ok", "return origem.rstrip"), ("def csrf_valido", "return bool(enviado)"),
                  ("def exige_csrf", "    return interno")],
         hl=["compare_digest", "abort(403)"],
         eyebrow="Back-end · Python · Formulários", titulo="Token CSRF e checagem de origem",
         itens=[("Token por sessão", "32 bytes aleatórios, em tempo constante."),
                ("Origem conferida", "POST vindo de outro site é recusado."),
                ("Decorador reutilizável", "Uma linha protege qualquer rota."),
                ("Recusa clara", "Sem token válido: HTTP 403.")],
         nota="protecao.py concentra a proteção dos formulários. Cada sessão recebe um token CSRF aleatório; em todo POST, o token enviado é comparado em tempo constante (hmac.compare_digest) e o cabeçalho Origin precisa ser o do próprio site. O decorador exige_csrf aplica a regra a qualquer rota com uma linha. O cookie de sessão é HttpOnly e SameSite."),
    dict(nome="cod-html", arq="templates/sugerir.html", lex="html+jinja", ling="HTML + Jinja",
         trechos=[('<input type="hidden" name="{{ CAMPO_CSRF }}"', 'placeholder="Ex.: HMS Ark Royal'),
                  ('<div class="campo-isca" aria-hidden="true">', 'tabindex="-1" autocomplete="off">')],
         hl=["csrf_token()", "campo-isca"],
         eyebrow="Front-end · HTML + Jinja", titulo="Templates que o servidor preenche",
         itens=[("Jinja2 do Flask", "{{ }} escapa o texto automaticamente."),
                ("Token no formulário", "Campo oculto com o CSRF da sessão."),
                ("Isca invisível", "Oculta para pessoas, tentadora para robôs."),
                ("Acessível", "label em cada campo, aria e role.")],
         nota="As páginas são HTML com o motor de templates Jinja2 do Flask. As chaves duplas inserem valores já escapados, o que impede injeção de HTML. O formulário de sugestão carrega o token CSRF num campo oculto e um campo-isca escondido de pessoas. Cada campo tem label, há atributos aria e limites de tamanho também no próprio HTML. O site tem 8 templates."),
    dict(nome="cod-css", arq="static/css/style.css", lex="css", ling="CSS",
         trechos=[("@media (prefers-reduced-motion: reduce)", "^}"),
                  ("::view-transition-old(root),", "::view-transition-new(root) { z-index: 2; }")],
         extra=[dict(arq="static/css/dark.css", trechos=[(':root[data-theme="dark"] {', "--grad-fire")])],
         hl=["prefers-reduced-motion", 'data-theme="dark"'],
         eyebrow="Front-end · CSS", titulo="Dois temas com variáveis CSS",
         itens=[("Variáveis CSS", "Paletas inteiras trocadas por data-theme."),
                ("Tema escuro isolado", "dark.css não altera nada do claro."),
                ("Menos movimento", "Respeita prefers-reduced-motion."),
                ("Transição de tema", "Camadas da View Transitions API.")],
         nota="O visual é CSS puro, sem framework: 6 folhas de estilo. As paletas são variáveis CSS (custom properties); o tema escuro redefine essas variáveis sob html[data-theme=dark], num arquivo próprio que não mexe no modo claro. Quem pede menos movimento no sistema operacional recebe a página sem animações. As regras ::view-transition preparam a revelação circular da troca de tema."),
    dict(nome="cod-3d", arq="static/js/ships-3d.js", lex="javascript", ling="JavaScript",
         trechos=[("function frame(now)", "if (!active && !initQueue.length) stop();")],
         hl=["if (!e.ready || !e.visible) continue;", "initEntry(initQueue.shift())"],
         eyebrow="Front-end · JavaScript · Motor 3D", titulo="Um único loop, só o que está visível",
         itens=[("Loop único", "Um requestAnimationFrame para tudo."),
                ("Só o visível desenha", "Cena fora da tela não custa nada."),
                ("Uma cena nova por quadro", "A rolagem nunca trava."),
                ("Para sozinho", "Sem cena ativa, o loop desliga.")],
         nota="ships-3d.js é o motor 3D, sobre Three.js. Em vez de um loop por cena, existe um único requestAnimationFrame. Ele cria no máximo uma cena nova por quadro, pula as que não estão visíveis (IntersectionObserver), aplica redimensionamento só quando o tamanho muda (ResizeObserver) e se desliga quando nada está na tela. Foi isso que levou de 13 contextos WebGL ativos ao carregar para zero."),
    dict(nome="cod-threejs", arq="static/js/ships-3d.js", lex="javascript", ling="JavaScript",
         trechos=[("function buildDestroyer()", "group.add(deck);")],
         hl=["new THREE.Mesh", "G.cyl(0, 0.45"],
         eyebrow="Front-end · JavaScript · Three.js", titulo="Navios modelados por código",
         itens=[("Modelos procedurais", "Casco, ponte e armas em primitivas 3D."),
                ("Sem arquivos 3D", "Nada de .obj ou .glb para baixar."),
                ("Cache de peças", "Geometrias e materiais reaproveitados."),
                ("InstancedMesh", "Peças repetidas em uma só chamada.")],
         nota="Os seis navios são modelados por código: cada um é um grupo Three.js montado com caixas, cilindros e cones posicionados à mão, como o destróier Type 45 deste trecho. Não há arquivos de modelo 3D para baixar. Geometrias e materiais ficam em cache e peças repetidas, como canhões e luzes, usam InstancedMesh."),
    dict(nome="cod-canvas", arq="static/js/war-hero.js", lex="javascript", ling="JavaScript",
         trechos=[("let pIdx = 0;", "      return null;")],
         hl=["const cap = CAP[level()];"],
         eyebrow="Front-end · JavaScript · Canvas 2D", titulo="Batalha naval com partículas em pool",
         itens=[("Canvas 2D", "Hero animado sem bibliotecas."),
                ("Pool de tamanho fixo", "Nada é criado durante a animação."),
                ("Teto adaptativo", "RNPerf reduz partículas em PC lento."),
                ("Pausa fora da tela", "Aba oculta ou rolada: não desenha.")],
         nota="Os heros animados (batalha naval no escuro, comboio no claro) e o mergulho são Canvas 2D em JavaScript puro. Partículas como fumaça, clarões e respingos vêm de pools de tamanho fixo, criados uma única vez, para não pressionar o coletor de lixo. O teto de partículas segue o nível do monitor de desempenho RNPerf, que cai em máquinas lentas."),
    dict(nome="cod-temas", arq="static/js/theme.js", lex="javascript", ling="JavaScript",
         trechos=[("if (typeof document.startViewTransition === 'function')", "vt.finished.then(finish, finish);")],
         hl=["startViewTransition", "duration: 900"],
         eyebrow="Front-end · JavaScript · Temas", titulo="Revelação circular ao trocar o tema",
         itens=[("API moderna", "View Transitions, com cortina de reserva."),
                ("A partir do botão", "Círculo de 900 ms, curva suave."),
                ("Acessível", "Movimento reduzido troca sem animar."),
                ("Desempenho adaptativo", "RNPerf corta efeitos abaixo de ~38 fps.")],
         nota="theme.js troca entre os temas claro e escuro. Onde o navegador suporta a View Transitions API, a nova página é revelada num círculo que cresce a partir do botão, em 900 ms; nos demais, uma cortina faz o mesmo efeito. O tema fica salvo e é aplicado antes da primeira pintura. O mesmo arquivo mede o tempo de quadro e expõe RNPerf, que reduz efeitos em máquinas lentas."),
    dict(nome="cod-consulta-js", arq="static/js/consulta.js", lex="javascript", ling="JavaScript",
         trechos=[("function cria(tag, classe, texto)", "    return e;"),
                  ("async function api(caminho, params, signal)", "throw new ErroApi(0,")],
         hl=["e.textContent = texto", "credentials: 'omit'"],
         eyebrow="Front-end · JavaScript · Consulta", titulo="JavaScript sem brechas para XSS",
         itens=[("Sempre textContent", "Nada da API vira HTML; zero innerHTML."),
                ("Sem cookies na API", "credentials 'omit' e cache no-store."),
                ("Busca cancelável", "AbortController descarta o que ficou velho."),
                ("Erros amigáveis", "Mensagem clara, sem detalhe técnico.")],
         nota="consulta.js é a página de busca. Todo elemento é criado com createElement e todo texto vindo da API entra por textContent, nunca por innerHTML: um teste garante que nenhum arquivo JavaScript do projeto usa innerHTML, eval ou document.write. As chamadas à API não enviam cookies, e uma busca nova cancela a anterior com AbortController."),
    dict(nome="cod-yaml", arq="deploy/render.yaml", lex="yaml", ling="YAML",
         trechos=[("services:", "startCommand"), ("      - key: DB_USER", "value: verify-full")],
         hl=["gunicorn", "sync: false"],
         eyebrow="Publicação · YAML · Render", titulo="Infraestrutura descrita em código",
         itens=[("Blueprint do Render", "Serviço, build e start em um arquivo."),
                ("gunicorn em produção", "1 worker, 4 threads, timeout de 20 s."),
                ("Segredos fora do Git", "sync: false: valor só no painel."),
                ("TLS completo", "verify-full até o banco Neon.")],
         nota="deploy/render.yaml descreve a publicação no Render: o serviço web em Python, o comando de build e o de start com gunicorn. As variáveis sensíveis, como a senha do banco, o host do Neon e o token do GitHub, aparecem com sync: false, ou seja, o valor fica só no painel do Render e nunca no repositório. A conexão com o banco usa TLS com verificação completa do certificado."),
    dict(nome="cod-testes", arq="tests/test_consulta.py", lex="python", ling="Python · pytest",
         trechos=[('@pytest.mark.parametrize("payload", PAYLOADS)', "assert n >= 64")],
         hl=["assert r.status_code != 500", "assert n >= 64"],
         eyebrow="Qualidade · Python · pytest", titulo="Ataques simulados a cada execução",
         itens=[("22 cargas hostis", "SQL injection, XSS, Log4Shell, CRLF…"),
                ("Nunca erro 500", "Nem pistas como Traceback ou SELECT."),
                ("Dados intactos", "Depois dos ataques, os navios continuam lá."),
                ("186 testes no total", "Consulta, banco, sugestões, painel e PDFs.")],
         nota="Os testes usam pytest e rodam contra um PostgreSQL descartável. Este trecho dispara 22 cargas hostis contra a busca e exige que nenhuma gere erro 500 nem devolva pistas internas; depois confere que nenhum dado foi apagado. Outros testes tentam 15 comandos proibidos com o papel de leitura, verificam cabeçalhos, CSRF, sugestões, o painel e o texto dos PDFs: 186 ao todo."),
]

# ───────────────────────────── leitura do código ─────────────────────────────
def ler_git(caminho):
    return subprocess.run(["git", "show", f"{REF}:{caminho}"], cwd=RAIZ_REPO, capture_output=True,
                          check=True).stdout.decode("utf-8").splitlines()


def achar(linhas, padrao, desde=0):
    for i in range(desde, len(linhas)):
        if (re.match(padrao[1:], linhas[i]) if padrao.startswith("^") else padrao in linhas[i]):
            return i
    raise SystemExit(f"padrão não encontrado: {padrao!r}")


def recortar(arq, trechos):
    """[(numero_da_linha | None, texto)], None = marcador de corte."""
    linhas = ler_git(arq)
    saida, ultimo = [], -1
    for ini, fim in trechos:
        a = achar(linhas, ini, ultimo + 1)
        b = achar(linhas, fim, a)
        if saida:
            saida.append((None, ""))
        saida.extend((n + 1, linhas[n].expandtabs(4)) for n in range(a, b + 1))
        ultimo = b
    return saida


# ───────────────────────────── desenho ─────────────────────────────
CORES = {
    "Keyword": "#E2BC63", "Keyword.Constant": "#EFA77A", "Name.Function": "#7CCBEA", "Name.Class": "#7CCBEA",
    "Name.Decorator": "#EFA77A", "Name.Builtin": "#C7A9F2", "Name.Tag": "#E2BC63", "Name.Attribute": "#7CCBEA",
    "Name.Variable": "#C7A9F2", "Literal.String": "#9ADBB8", "Literal.String.Doc": "#7F97B2",
    "Literal.Number": "#EFA77A", "Comment": "#6F88A5", "Operator": "#AFC1D4", "Punctuation": "#AFC1D4",
    "Comment.Preproc": "#C7A9F2",
}
PADRAO, FUNDO, BARRA, GUTTER = "#DCE6F1", "#0B1A2C", "#0F2238", "#4B6585"


def cor(tipo):
    t = tipo
    while t:
        nome = ".".join(t[1:]) if len(t) > 1 else ""
        nome = str(t).replace("Token.", "")
        if nome in CORES:
            return CORES[nome]
        t = t.parent
    return PADRAO


def tokens_por_linha(texto, lex):
    from pygments.lexers import get_lexer_by_name
    linhas, atual = [], []
    for tipo, valor in get_lexer_by_name(lex, stripnl=False, ensurenl=False).get_tokens(texto):
        partes = valor.split("\n")
        for k, parte in enumerate(partes):
            if k:
                linhas.append(atual)
                atual = []
            if parte:
                atual.append((parte, cor(tipo)))
    linhas.append(atual)
    return linhas


def desenhar(spec):
    from PIL import Image, ImageDraw, ImageFont
    blocos = [(spec.get("titulo_arq") or spec["arq"], recortar(spec["arq"], spec["trechos"]))]
    for ex in spec.get("extra", []):
        blocos.append((ex["arq"], recortar(ex["arq"], ex["trechos"])))
    mono = ImageFont.truetype(FONTE_MONO, TAM)
    ui = ImageFont.truetype(FONTE_UI, 28)
    cw = mono.getlength("M")
    todas = [t for _, b in blocos for t in b]
    larg_num = len(str(max(n for n, _ in todas if n))) * cw
    gutter = 36 + larg_num + 28
    max_c = max(len(t) for _, t in todas)
    W = int(gutter + max_c * cw + 48)
    titulo_h, sep_h = 68, 64
    H = titulo_h + 24 + sum(len(b) for _, b in blocos) * LINHA + (len(blocos) - 1) * sep_h + 28
    im = Image.new("RGB", (W, H), FUNDO)
    d = ImageDraw.Draw(im)
    d.rectangle([0, 0, W, titulo_h], fill=BARRA)
    d.line([0, titulo_h, W, titulo_h], fill="#1E3A5C", width=2)
    for i, c in enumerate(("#E5534B", "#D4AE5A", "#3FB27F")):
        d.ellipse([30 + i * 34, titulo_h / 2 - 10, 50 + i * 34, titulo_h / 2 + 10], fill=c)
    d.text((150, titulo_h / 2), blocos[0][0], font=ui, fill="#D7E1EC", anchor="lm")
    d.text((W - 30, titulo_h / 2), spec["ling"], font=ui, fill="#D4AE5A", anchor="rm")
    y = titulo_h + 24
    for bi, (nome_arq, linhas) in enumerate(blocos):
        if bi:
            d.line([24, y + sep_h / 2, W - 24, y + sep_h / 2], fill="#1E3A5C", width=2)
            d.rectangle([W / 2 - 230, y + 10, W / 2 + 230, y + sep_h - 10], fill=FUNDO)
            d.text((W / 2, y + sep_h / 2), nome_arq, font=ui, fill="#D7E1EC", anchor="mm")
            y += sep_h
        texto = "\n".join(t for _, t in linhas)
        toks = tokens_por_linha(texto, spec["lex"])
        for (num, bruto), tl in zip(linhas, toks):
            if num is None:
                d.text((gutter, y + LINHA / 2), "...", font=mono, fill=GUTTER, anchor="lm")
                for x in range(int(gutter + 2 * cw), W - 40, 18):
                    d.line([x, y + LINHA / 2, x + 8, y + LINHA / 2], fill="#1E3A5C", width=2)
                y += LINHA
                continue
            if any(h in bruto for h in spec.get("hl", [])):
                d.rectangle([0, y, W, y + LINHA], fill="#16304C")
                d.rectangle([0, y, 6, y + LINHA], fill="#D4AE5A")
            d.text((36 + larg_num, y + LINHA / 2), str(num), font=mono, fill=GUTTER, anchor="rm")
            x = gutter
            for parte, c in tl:
                d.text((x, y + LINHA / 2), parte, font=mono, fill=c, anchor="lm")
                x += mono.getlength(parte)
            y += LINHA
    IMG.mkdir(exist_ok=True)
    im.save(IMG / (spec["nome"] + ".png"), optimize=True)
    faixas = []
    for nome_arq, linhas in blocos:
        nums = [n for n, _ in linhas if n]
        faixas.append(f"{nome_arq} · linhas {nums[0]}–{nums[-1]}")
    return {"w": W, "h": H, "legenda": "  |  ".join(faixas)}


# ───────────────────────────── slides ─────────────────────────────
FUNDOS = ["radial-gradient(ellipse at 82% 8%, #153F68 0%, #06172A 62%)",
          "radial-gradient(ellipse at 15% 92%, #123658 0%, #081C33 70%)"]
E = lambda s: html.escape(s, quote=False)


def slide_codigo(spec, info, url, k):
    lado = min(1180 / info["w"], 590 / info["h"], 0.74)
    largo = min(1664 / info["w"], 470 / info["h"], 0.74)
    wide = largo > lado                        # linhas longas: código na largura toda, itens embaixo
    esc = largo if wide else lado
    dw, dh = round(info["w"] * esc), round(info["h"] * esc)
    if wide:
        painel = (f'<div data-build-in="rise 2" style="position:absolute;left:128px;top:{300 + dh + 58}px;width:1664px;'
                  f'display:grid;grid-template-columns:repeat(4, 1fr);gap:32px">')
    else:
        painel = ('<div data-build-in="rise 2" style="position:absolute;left:1352px;top:300px;width:440px;'
                  'display:flex;flex-direction:column;gap:24px">')
    for t, x in spec["itens"]:
        if len(t) > 26 or len(x) > 60:
            print("  aviso: item longo em", spec["nome"], "->", t)
    itens = "\n".join(
        f'<div style="display:flex;flex-direction:column;gap:6px"><div style="width:48px;height:3px;background:#D4AE5A;border-radius:2px"></div>'
        f'<h3 style="font-size:28px;font-weight:600;line-height:1.25;color:#F6F1E4">{E(t)}</h3>'
        f'<p style="font-size:24px;line-height:1.4;color:#B3C2D2">{E(x)}</p></div>' for t, x in spec["itens"])
    return f'''<section id="{spec["nome"]}" data-transition="fade" style="background:{FUNDOS[k % 2]};color:#E9E4D6;font-family:'IBM Plex Sans', Arial, sans-serif;padding:128px 128px 160px;display:flex;flex-direction:column;gap:16px">
<p style="font-size:24px;font-weight:600;letter-spacing:4px;color:#D4AE5A;text-transform:uppercase">{E(spec["eyebrow"])}</p>
<h2 style="font-family:'Cormorant Garamond', Georgia, serif;font-size:72px;font-weight:600;line-height:1.1;color:#F6F1E4">{E(spec["titulo"])}</h2>
<img data-build-in="rise 1" src="{url}" alt="Trecho de código real: {E(info["legenda"])}" style="position:absolute;left:128px;top:300px;width:{dw}px;height:{dh}px;object-fit:contain;border-radius:18px;border:1px solid #24496F;box-shadow:0px 40px 80px rgba(0,0,0,0.6)">
<p style="position:absolute;left:128px;top:{300 + dh + 16}px;width:{1664 if wide else 1180}px;font-family:'JetBrains Mono', 'Courier New', monospace;font-size:24px;color:#8196AE">{E(info["legenda"])}</p>
{painel}
{itens}
</div>
<p style="position:absolute;left:128px;bottom:64px;width:1400px;font-size:24px;color:#8196AE">Código-fonte real · branch main, v4.4.0 · linhas numeradas como no arquivo</p>
<p style="position:absolute;right:128px;bottom:64px;width:240px;text-align:right;font-size:24px;color:#8196AE">00 / 00</p>
<aside>{E(spec["nota"])}</aside>
</section>
'''


ORDEM_COD = ["cod-arquitetura", "cod-linguagens"] + [c["nome"] for c in CODIGOS]


def renumerar_e_deck():
    deck = json.loads(DECK.read_text(encoding="utf-8"))
    ordem = [s for s in deck["order"] if s not in ORDEM_COD]
    pos = ordem.index("sugestoes") + 1
    deck["order"] = ordem[:pos] + ORDEM_COD + ordem[pos:]
    deck["sections"]["s2c"] = {"description": "Por dentro do código: back-end, banco, front-end, publicação e testes",
                               "start": "cod-arquitetura"}
    deck["faces"]["jetbrains-mono"] = {"family": "JetBrains Mono",
                                       "href": "https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600&display=swap"}
    DECK.write_text(json.dumps(deck, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    total = len(deck["order"])
    for i, sid in enumerate(deck["order"], 1):
        f = SLIDES / f"{sid}.html"
        t = f.read_text(encoding="utf-8")
        t2 = re.sub(r">\d{2} / \d{2}</p>", f">{i:02d} / {total}</p>", t)
        if t2 != t:
            f.write_text(t2, encoding="utf-8")
    print("deck com", total, "slides")


def main(modo):
    if modo == "imagens":
        man = {c["nome"]: desenhar(c) for c in CODIGOS}
        (IMG / "manifest.json").write_text(json.dumps(man, ensure_ascii=False, indent=1), encoding="utf-8")
        for n, v in man.items():
            print(f"{n:18} {v['w']}x{v['h']}  {v['legenda']}")
    elif modo == "slides":
        man = json.loads((IMG / "manifest.json").read_text(encoding="utf-8"))
        urls = json.loads((IMG / "urls.json").read_text(encoding="utf-8"))
        for k, c in enumerate(CODIGOS):
            (SLIDES / f"{c['nome']}.html").write_text(slide_codigo(c, man[c["nome"]], urls[c["nome"]], k), encoding="utf-8")
        renumerar_e_deck()
    else:
        sys.exit(__doc__)


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "")
