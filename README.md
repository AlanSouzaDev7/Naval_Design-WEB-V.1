# ⚓ Royal Navy — Site Educativo

Site educativo sobre a Marinha Real Britânica: linha do tempo, navios lendários em **3D interativo** (Three.js),
batalhas, frota atual e galeria. Servido por Flask, com dois temas que são o **contraponto** um do outro: **“Mar em Paz”** (modo claro: comboio de navios
rumo ao horizonte, águas claras e recifes de coral) e **“Guerra em alto mar”** (modo escuro). A partir da **v3.0** tem uma página de **Consulta de Navios** ligada a um banco
PostgreSQL (somente leitura, com camadas de segurança) — e desde a **v4.0** essa consulta está publicada na internet,
acessível de qualquer aparelho, em **<https://royalnavy-consulta.onrender.com>**. Na **v4.3** o visitante pode **sugerir navios**
que ainda não estão no acervo, e um painel restrito permite avaliá-los. A **v4.5** acrescenta a página **Navegação pelas
Estrelas**, com o céu real calculado no navegador; a **v4.5.1** é o teste de qualidade dessa página.

## Como rodar

```bash
python -m venv .venv
.venv\Scripts\activate          # Windows  (Linux/macOS: source .venv/bin/activate)
pip install -r requirements.txt
python db/aplicar.py          # 1 vez: prepara o banco para a consulta (pede a senha do administrador do PostgreSQL)
python app.py
```

Abra <http://localhost:5000> (a consulta fica em <http://localhost:5000/consulta>).
Sem o banco configurado o site continua funcionando; só a consulta avisa que está indisponível.

| Variável      | Padrão      | Para que serve                                                                 |
|---------------|-------------|--------------------------------------------------------------------------------|
| `PORT`        | `5000`      | Porta do servidor                                                              |
| `HOST`        | `127.0.0.1` | Use `0.0.0.0` para expor na rede local (o modo debug é desligado sozinho)      |
| `FLASK_DEBUG` | `1`         | `0` desliga o recarregamento automático                                        |

## Modo claro: "Mar em Paz" (v4.1)

Contraponto direto do modo escuro: **o mesmo estilo de profundidade, só que pacífico**. Botão de tema no **canto superior direito** (o tema fica salvo no navegador).

| Trecho da página | O que acontece no modo claro |
|---|---|
| **Hero** | Um **comboio de navios de carga e de guerra** (porta-contêineres, petroleiro, graneleiro, transportador de carros, destróier Type 45, fragata Type 23, porta-aviões classe Queen Elizabeth) navega em direção ao horizonte, com **perspectiva real** (projeção 3D→2D com ponto de fuga, ordem do pintor, névoa atmosférica, nível de detalhe por distância e esteiras de Kelvin), costa com falésias e farol, sol, helicóptero e gaivotas. |
| **Ao descer** | Mergulho em águas claras, com raios de luz, bolhas, cardumes e golfinho. O **medidor de profundidade** vai de 0 a 40 m (Superfície · Águas rasas · Mar aberto · Recife de coral). |
| **Zona de patrulha** | Paz com elementos navais: **minas submarinas** inspecionadas por um **ROV** (cone de luz e cordão umbilical), **submarino** com pings de sonar, **tubarões**, cardumes, tartaruga e águas-vivas. |
| **Jardins de Coral** | **Naufrágios cobertos de recifes de coral**: galeão e cascos de navios de guerra, corais, anêmonas com peixe-palhaço, arraia e cardumes; piso de areia com cáusticas. |
| **Rodapé** | Areia clara, continuação do leito do recife. |

Arquivos: `light.css`, `convoy-hero.js` (hero), `calm-sea.js` (mergulho, patrulha, recife, medidor).

**Desempenho medido (v4.1):** Edge com GPU, 1366×768, monitor de 120 Hz, 3 rodadas de 6 s por ponto, após 15 s de aquecimento. O modo claro ficou entre **104 e 120 fps** em todos os sete pontos da página (hero, mergulho, navios 3D, patrulha, batalhas, recife e rodapé), com no máximo 1 quadro acima de 20 ms por ponto e o monitor adaptativo `RNPerf` sempre no nível máximo. Limites honestos: um único computador com GPU dedicada; o celular foi apenas emulado; uma rodada **sem** aquecimento mostrou travadas de 100–200 ms logo após carregar a página, nos dois temas (ainda não investigado). Detalhes e método na seção 15 do PDF de documentação.

**Barra de navegação corrigida (v4.1):** entre ≈ 770 e ≈ 1260 px a barra do topo não cabia e o botão de tema saía da tela; agora os links não quebram de linha, o texto do botão de tema e a etiqueta “Since 1546” somem abaixo de 1280 px e o espaçamento se ajusta em 1280, 960 e 768 px (conferido a 800, 900 e 1024 px).

## Modo escuro ("Guerra em alto mar")

O **modo escuro** transforma a página numa viagem da superfície ao leito do oceano:

| Trecho da página | O que acontece no modo escuro |
|---|---|
| **Hero** | Batalha naval noturna: duas frotas trocam disparos (projéteis com rastro, clarões, explosões, incêndios, fumaça, colunas d'água), com relâmpagos, holofotes, sinalizadores e navios que afundam e voltam ao combate. |
| **Ao descer** | O visitante mergulha: a cor da água escurece com a profundidade, com raios de luz, neve marinha, bolhas, cardumes, submarinos e clarões distantes. Um **medidor de profundidade** (m e zona oceânica) acompanha a rolagem. |
| **Guerra Submarina** | Submarinos trocam torpedos, emitem sonares, sofrem avarias, afundam e reaparecem; navios na superfície lançam cargas de profundidade. |
| **Navios Naufragados** | No leito: destroieres partidos, um galeão, um submarino e um porta-aviões afundados, algas, corais, cardumes, bolhas e uma baliza de socorro piscando. |
| **Modelos 3D e modal** | Cenário noturno (luar, reflexos dos incêndios) e painéis escuros. |

**Transição:** revelação circular a partir do botão (View Transitions API); navegadores sem suporte usam uma cortina circular;
`prefers-reduced-motion` troca o tema sem animação.

**Desempenho (mesmas regras do resto do site):** cada tema só existe quando ativo; cada canvas só anima enquanto está
visível (IntersectionObserver) e com a aba em primeiro plano; o fundo do mar profundo roda em meia resolução; partículas em
*pools* de tamanho fixo e brilhos como sprites; um monitor de FPS (`RNPerf`, nos **dois** temas desde a v4.1) reduz partículas e efeitos automaticamente em
máquinas lentas; a cena do outro tema é pré-aquecida quando o mouse chega ao botão.

Arquivos: `theme-init.js` (aplica o tema antes da 1ª pintura), `theme.js` (botão, transição, `RNPerf`), `dark.css`,
`war-hero.js` (batalha do hero), `deep-sea.js` (mergulho, guerra submarina, naufrágios, medidor).

## Navegação pelas Estrelas (v4.5)

Página **`/navegacao`** (link **Estrelas** na barra): como as marinhas navegaram pelas estrelas e como isso evoluiu até hoje,
e como os planetas eram conhecidos em cada época. Funciona igual no GitHub Pages, porque **todo o céu é calculado no navegador**.

| Trecho | O que mostra |
|---|---|
| **Topo** | O céu real desta noite sobre o Observatório de Greenwich, 240× mais rápido, girando em volta da Polar com rastros, e uma fragata em silhueta. |
| **Cinco eras** | Bússola estelar polinésia (Hōkūleʻa, 1976) · latitude pela Polar, Zacuto (1496) e o Cruzeiro do Sul · desastre das Scilly (1707), Longitude Act, H4 de Harrison e Nautical Almanac (1767) · sextante, linhas de posição e o meridiano de Greenwich (1884) · LORAN, Transit, GPS e a volta do sextante à Academia Naval dos EUA (2015). |
| **Instrumentos** | Bússola estelar havaiana (32 casas), quadrante (alinhar com a Polar dá a latitude) e cronômetro (diferença de horas = longitude, e o erro de um relógio ruim). |
| **Carta celeste** | 2.309 estrelas reais, 88 constelações, as **57 estrelas de navegação + Polar** em dourado, Sol, Lua e planetas. Noites históricas: Scilly 1707, H4 na Jamaica 1762, trânsito de Vênus no Taiti 1769, Trafalgar 1805, e esta noite sobre Greenwich ou o Rio. |
| **Os errantes** | Os 7 planetas em 3D (Three.js, texturas geradas no navegador) com a história de cada um: desde quando é conhecido e se serve ao navegador. |
| **Orrery** | Planetário mecânico com as posições reais de 1500 a 2100; Urano e Netuno aparecem “ainda desconhecidos” antes de 1781 e 1846. |

**Visual:** no modo claro, o **crepúsculo náutico** (a hora em que o navegador mede as estrelas) e as seções em papel de carta
náutica, com a carta celeste em estilo de atlas impresso; no modo escuro, a **noite em alto-mar**. Detalhes em latão de instrumento antigo.

**Como é calculado** (`static/js/astro.js`): tempo sideral, precessão (Meeus, cap. 21), planetas pelos elementos keplerianos da
NASA/JPL (Standish, válidos de 3000 a.C. a 3000 d.C.), Lua pela fórmula de baixa precisão do Astronomical Almanac e projeção
estereográfica. Conferido contra os exemplos resolvidos de Meeus (*Astronomical Algorithms*): tempo sideral exato e Vênus a 0,004°.
As estrelas e as constelações (`static/data/ceu.json`, 69 KB) vêm do [d3-celestial](https://github.com/ofrohn/d3-celestial)
(Olaf Frohn, licença BSD-3-Clause, catálogo Hipparcos). As fontes históricas estão listadas no rodapé da página e na **seção 20 do PDF**.

**Barra de navegação com 9 links:** para caber o link novo, a faixa compacta da barra foi estendida até 1480 px (some o texto do
botão de tema e a etiqueta “Since 1546”) e ganhou um ajuste extra até 820 px; medido de 769 a 1920 px, o botão de tema sempre cabe.

### Teste de qualidade (v4.5.1)

A página passou por um teste de QA em rodadas (auditoria automática no Edge em 5 cenários, perfil de CPU, 61 verificações
funcionais no computador e no celular e inspeção visual), até todas as verificações passarem. Detalhes na **seção 21 do PDF**.

| Medida | Antes | Depois |
|---|---|---|
| Página pronta para uso (DOMContentLoaded) | até 6,0 s | 0,2 a 0,9 s |
| Maior tarefa longa no carregamento | 1,3 s | ≈ 0,2 s |
| Salto de layout (CLS) no tablet | 0,37 | 0,04 |
| Contraste abaixo do WCAG AA | 2 | 0 |
| Verificações funcionais | 55 de 59 | 61 de 61 |

- **Orrery:** “Girar o tempo” travava em monitores de 120 Hz (o avanço por quadro era menor que o passo do controle e era
  arredondado para zero). O ano agora corre numa variável própria.
- **Carta celeste no celular:** a dica vazava pela direita e criava rolagem lateral; agora abre para o lado que cabe, e um toque
  também a mostra.
- **Rótulos:** um posicionador comum à carta e ao orrery evita nomes sobrepostos, respeita as bordas e põe contorno no texto;
  no celular o orrery ficou quadrado.
- **3D sob demanda:** o Three.js saiu do HTML. `planetas-3d.js` o baixa (com SRI) e liga o WebGL só quando o painel dos planetas
  chega perto da tela; antes, compilar os shaders custava ≈0,8 s no carregamento.
- **Topo sem salto:** legenda mais curta com linhas reservadas, título com 2 linhas reservadas e fontes de reserva com as mesmas
  medidas da Cinzel, Rajdhani e Inter (`size-adjust`).
- **Acessibilidade:** abas dos planetas com painel (`role="tabpanel"`, `aria-controls`, Home/End); a bússola estelar deixou de ser
  `role="img"` (escondia as casas) e tem uma só parada de Tab, com as setas percorrendo as 32 casas; a legenda que muda a cada
  segundo deixou de ser `aria-live`; aba ativa e botões selecionados com contraste acima de 4,5:1.

## Sugestões de navios (v4.3)

Detalhes completos (decisões, segurança, verificação e configuração) na **seção 18 do PDF** em [`documentacao/`](documentacao/).

Página **`/sugerir`**: o visitante digita o nome de um navio que sentiu falta (e, se quiser, marinha, guerra e uma fonte).
O site confere o acervo **só lendo o banco**, com o mesmo papel `navios_leitura` da consulta:

| O visitante digita | O site responde |
|---|---|
| um navio que já está no acervo (`USS Arizona`, `arizona`, `BB-39`, `KMS Bismarck`, `blücher`…) | **"Navio já existente"**, com link para a ficha. A comparação ignora acentos, maiúsculas e prefixos (USS, HMS, SMS, KMS, HMAS…) |
| um nome **parecido** com um do acervo (`Arizonna`) | **"Você quis dizer…?"** com os candidatos; só registra se a pessoa confirmar que é outro navio |
| um navio que **não** está no acervo | **"Sugestão registrada"**: entra na fila com a situação **em análise** |
| um navio que **já foi sugerido** | "Já está em análise" (soma +1 pedido, sem duplicar) ou "já avaliada" |

**As sugestões não ficam no banco.** Elas são gravadas num arquivo `sugestoes.json`, e o PostgreSQL continua somente leitura:

- **Em produção:** o arquivo fica num **repositório do GitHub** (de preferência **privado**, só para os dados), gravado pela
  API do GitHub com um token *fine-grained* que só acessa esse repositório (*Contents: Read and write*). Cada sugestão vira
  um commit, então o próprio GitHub guarda o histórico. O disco do Render gratuito é apagado a cada reinício, por isso o
  arquivo **não** fica no servidor.
- **Local/testes:** `SUGESTOES_ARQUIVO=caminho/sugestoes.json`.
- **Sem nenhum dos dois:** a página avisa que o registro está indisponível (nunca grava num lugar que se apaga sozinho).

O link para a página fica na **Consulta** (no texto de ajuda e quando a busca não encontra nada, já com o nome
preenchido) e nas seções de contato. O menu principal não ganhou um 9º item para não quebrar a barra de navegação.

### Painel do administrador (`/admin`)

Login só com senha, que fica **apenas como hash** (scrypt) na variável `ADMIN_PASSWORD_HASH`; sem ela o painel não existe
(404). No painel você vê as sugestões (novas destacadas, contagem de pedidos), completa as informações, **aprova**,
**rejeita** ou **reabre**. Ao aprovar, o painel mostra o comando `INSERT` pronto para colar no **SQL Editor do Neon**: o site
nunca escreve no banco, e o comando não duplica um navio que já exista.

```bash
python ferramentas/gerar_hash_admin.py   # pede a senha (não aparece na tela) e imprime ADMIN_PASSWORD_HASH=...
```

### Segurança dos formulários (sugestão, painel e contato)

| Camada | O que foi feito |
|---|---|
| **CSRF** | Token aleatório na sessão e em cada formulário (comparação em tempo constante) + recusa de `Origin` de outro site |
| **Sessão** | Cookie assinado (`SECRET_KEY`), `HttpOnly`, `SameSite=Strict` e `Secure` em HTTPS. O painel sai sozinho após 20 min sem uso (máx. 2 h), troca a sessão no login (contra fixação) e responde com `no-store` e `noindex` |
| **Robôs** | Campo-isca invisível (quem o preenche recebe "sucesso" e nada é gravado); limite por IP: 6 sugestões/min e 40/h; contato 5/min |
| **Força bruta** | Login: 5 tentativas a cada 15 min por IP **e** trava geral após 20 erros em 15 min (contra ataque distribuído) |
| **Entrada** | Mesma lista de caracteres da busca; tamanhos máximos; fonte só `http(s)://` válido; fila limitada a 500 sugestões em análise |
| **Saída** | Tudo escapado (sem XSS refletido); SQL do painel com aspas dobradas, testado contra o PostgreSQL |
| **Segredos** | Token do GitHub, hash da senha e `SECRET_KEY` só no ambiente (Render), nunca no Git; erros não mostram detalhes ao visitante |

Na versão estática (GitHub Pages) a página `/sugerir` apenas avisa que precisa do servidor.

## Consulta de navios (v3.0)

Página `/consulta`: o visitante digita o nome (ou a classe, ou a designação do casco, ex. `BB-39`) e recebe a **ficha
completa**: marinha, tipo, classe, guerra, batismo/comissionamento/baixa, comandantes, batalhas, armamento, situação atual
e observações. Também dá para explorar por marinha e filtrar por guerra e tipo. Funciona nos modos claro e escuro e no celular.

```
navegador ──GET──> Flask (/api/navios/...) ──papel navios_leitura──> PostgreSQL: VIEW v_navios ──> tabela navios_historicos
 (só JSON,           validação · limite · erros genéricos            (só SELECT na view; timeout 3 s;
  sem HTML)                                                          nem a tabela original ele enxerga)
```

| Rota | Função |
|---|---|
| `GET /api/navios/busca?q=&marinha=&guerra=&tipo=&pagina=` | busca (sem acento, tolera erro de digitação), 10 por página |
| `GET /api/navios/<id>` | ficha completa + outros navios da mesma classe |
| `GET /api/navios/filtros` | marinhas, guerras e tipos com contagem |
| `GET /api/navios/<id>/pdf` | ficha do navio em PDF, para download (v4.4) |
| `GET /api/navios/busca/pdf?q=&marinha=&guerra=&tipo=` | resultado da busca em PDF, para download (v4.4) |
| `GET /api/saude` | verificação de funcionamento |

### PDFs dos navios (v4.4)

Detalhes (decisões, segurança e verificação) na **seção 19 do PDF** em [`documentacao/`](documentacao/).

Na página de consulta há dois downloads, gerados na hora pelo próprio servidor:

| Botão | Rota | Conteúdo |
|---|---|---|
| **Baixar ficha (PDF)** (na ficha) | `GET /api/navios/<id>/pdf` | ficha completa: marinha, tipo, guerra, casco, classe, cronologia, comando, batalhas, armamento, situação, observações e navios da mesma classe |
| **Baixar resultados (PDF)** (acima da lista) | `GET /api/navios/busca/pdf?q=&marinha=&guerra=&tipo=` | a busca na tela, em tabela (A4 paisagem), com os filtros usados; até 200 navios por PDF |

- **Rápidos:** gerados em memória com o ReportLab e as fontes padrão do PDF (nenhum arquivo de fonte no servidor):
  cerca de 60–110 ms e poucos KB.
- **Mesma segurança da consulta:** os dados vêm do papel somente leitura e da view `v_navios`; a busca passa
  pela mesma validação estrita (parâmetros inválidos dão 400); limite de 10 fichas e 6 buscas em PDF por minuto
  por IP; `no-store`; nome do arquivo só com `[a-z0-9-]`.
- **Texto do banco:** escapado antes de entrar no PDF (uma marcação como `<b>` aparece literalmente).
  Caracteres fora do alfabeto latino viram a letra sem o sinal (ex.: “Sōryū” → “Soryu”).
- **Dependências:** `reportlab==5.0.1` e `pillow==13.0.0` (a 12.3.0 tem avisos na base OSV).

### Como o banco fica protegido

| Camada | O que foi feito |
|---|---|
| **Banco isolado** | A API usa o papel `navios_leitura` (sem superusuário, sem criar nada, no máximo 10 conexões, sessão somente-leitura, `statement_timeout` 3 s). Ele só enxerga a **view** `v_navios` — não a tabela original nem colunas internas (`criado_em`). O administrador `postgres` nunca é usado pelo site (a API se recusa a iniciar com ele). |
| **SQL injection** | Consultas **sempre parametrizadas**; o texto do usuário nunca é concatenado ao SQL. Além disso a entrada é validada por lista de caracteres permitidos (letras, números, espaço e `. ' ( ) / -`), tamanho (2–60) e parâmetros conhecidos. |
| **Abuso** | Limite por IP (30 buscas/min, 60 fichas/min, 120 req/min na API), `LIMIT` em toda consulta, no máximo 20 páginas, pool de 5 conexões. |
| **Vazamento de informação** | Erros genéricos para o cliente (o detalhe fica só no log); sem versão de servidor; `Cache-Control: no-store` na API. |
| **Navegador** | Tudo que vem da API ou dos dados entra na página por `textContent` — desde a v4.2 **nenhum** arquivo JS usa `innerHTML`, `eval` ou `document.write` (um teste garante); CSP **sem `unsafe-inline` e sem `unsafe-eval`** (nem scripts nem estilos inline), scripts externos com SRI e `frame-ancestors 'none'`. |
| **Rede** | Cabeçalho `Host` validado (`ALLOWED_HOSTS`, contra DNS rebinding), só `GET`, CORS por lista exata (nunca `*`), HSTS opcional (`RN_HTTPS=1`), proxy só é confiável se configurado (`TRUST_PROXY_HOPS`). |
| **Segredos** | Senha do papel gerada ao acaso (43 caracteres) e guardada **fora do Git e fora do OneDrive**: `~/.royalnavy/consulta.env` (Windows: `C:\Users\<você>\.royalnavy\consulta.env`), com permissão só para o seu usuário (`config_env.py`). Um teste garante que nenhum arquivo versionado contém a senha. |
| **Dependências** | Versões fixas (`requirements-lock.txt`), auditadas com `pip-audit` (0 vulnerabilidades conhecidas; o Flask foi atualizado para 3.1.3 por isso) e `bandit` (0 achados). |

Detalhes, passo a passo do banco e instruções do administrador: [`db/README.md`](db/README.md).

### Disponível online (v4.0)

A consulta está publicada em **<https://royalnavy-consulta.onrender.com>** — mesma segurança do modo local (papel
`navios_leitura`, view `v_navios`, TLS agora com verificação completa do certificado, `verify-full`). Arquitetura:
**[Render](https://render.com)** (aplicação, plano gratuito) + **[Neon](https://neon.tech)** (PostgreSQL gerenciado,
plano gratuito). Arquivos de implantação em [`deploy/`](deploy/).

> **Plano gratuito:** o Render "hiberna" depois de ≈ 15 min sem acessos e o Neon suspende o banco de forma parecida;
> o primeiro pedido depois disso demora alguns segundos a mais enquanto os dois acordam sozinhos — não é defeito. Desde a v4.2 o pool
> testa a conexão antes de usá-la e espera até 8 s pelo banco (`DB_CONNECT_TIMEOUT`), então esse primeiro pedido deixou de falhar com 503.

Duas pegadinhas reais encontradas ao publicar (documentadas em detalhe na seção 14 do PDF):

| Sintoma | Causa | Correção |
|---|---|---|
| O SQL Editor do Neon trava no meio de um script com `COPY ... FROM stdin` | `COPY` interativo é um recurso do **protocolo** do psql, não SQL padrão — o editor web não o suporta | Usar `INSERT INTO ... VALUES (...), (...);` (SQL padrão) |
| `certificate verify failed` / `root certificate file ... does not exist` com `DB_SSLMODE=verify-full` | O OpenSSL empacotado dentro do `psycopg[binary]` não localiza de forma confiável os certificados do sistema operacional do host | Raiz `ISRG Root X1` (Let's Encrypt, pública, válida até 2035) incluída no projeto em [`deploy/isrg-root-x1.pem`](deploy/isrg-root-x1.pem), referenciada direto em `sslrootcert` (ver `consulta_api.py`) |

### Solução de problemas: "O serviço de consulta está indisponível"

Em modo local (`python app.py`) a própria mensagem da página mostra o motivo entre parênteses. Causas mais comuns:

| Motivo | O que fazer |
|---|---|
| `No module named 'psycopg'` (ou Flask-Limiter) | As dependências não estão instaladas **no mesmo Python que roda o site**. Rode `python -m pip install -r requirements.txt` com esse Python (o do terminal do VS Code, por exemplo) e reinicie o servidor. |
| `DB_USER/DB_PASSWORD nao configurados` | O arquivo de segredos não foi encontrado. Rode `python db/aplicar.py` (ele lista os locais procurados). Não crie esse arquivo dentro de `AppData`: alguns aplicativos do Windows (os empacotados, como o app do Claude) **redirecionam** o `AppData` e o seu servidor não enxerga o arquivo. |
| Erro de conexão / autenticação | O PostgreSQL está parado (`Get-Service postgresql-x64-18`) ou a senha do papel foi trocada; rode `python db/aplicar.py` de novo. |

### Testes

```bash
pip install -r requirements-dev.txt
pytest tests                      # 195 testes: consulta, PDFs, sugestões, painel, CSRF, injeção de SQL, XSS, CSP, limite, privilégios do banco, segredos
bandit -r app.py consulta_api.py protecao.py sugestoes.py db build_static.py ferramentas
pip-audit -r requirements-lock.txt
```

Os testes precisam de um PostgreSQL com a tabela de navios; **sem banco, todos são ignorados (`skipped`)** — o que parece verde mas
não prova nada. Para rodá-los sem mexer no banco real, use um banco descartável (Docker) com dados **sintéticos** de teste
(PowerShell, na pasta do projeto):

```powershell
docker run -d --name rn-pg-teste -e POSTGRES_PASSWORD=<senha-aleatoria> `
    -p 127.0.0.1:55432:5432 postgres:16-alpine
$env:PGHOST="127.0.0.1"; $env:PGPORT="55432"; $env:PGPASSWORD="<senha-aleatoria>"
$env:RN_ENV_FILE="$env:TEMP\rn-teste.env"   # segredos de teste fora do ~/.royalnavy
python db/seed_teste.py                     # cria a tabela e 84 navios sintéticos (só roda em localhost)
python db/aplicar.py                        # extensões, view v_navios, papel navios_leitura e verificação
pytest tests                                # 195 passed
docker rm -f rn-pg-teste                    # descarta o banco
```

### Revisão de segurança e robustez (v4.2)

Revisão de 30/09/2026 (detalhes na **seção 17 do PDF**). Dependências (OSV), `bandit` e o histórico do Git (17 commits) não tinham
problemas; as quatro melhorias foram:

| | Achado | Correção |
|---|---|---|
| **A** | Os 88 testes estavam todos ignorados sem banco local | Banco descartável em Docker + `db/seed_teste.py` (84 navios sintéticos); suíte roda de ponta a ponta |
| **B** | `/api/saude` dava **503** depois de o banco ficar ocioso (Neon/pooler derruba conexões; tempo de 3 s era curto) | `check=ConnectionPool.check_connection`, `DB_CONNECT_TIMEOUT` (8 s) e `DB_POOL_TIMEOUT` (5 s); reproduzido: antes 503, depois 200 |
| **C** | CSP ainda aceitava estilos inline (`'unsafe-inline'`); restavam 2 `innerHTML` e 6 `style=""` | CSP sem `unsafe-inline`; `data-fill` + CSS nas barras; DOM com `textContent` no modal; 4 testes impedem a regressão; 0 violações de CSP no navegador |
| **D** | O hostname do Neon estava no `deploy/render.yaml` público | `DB_HOST` agora é `sync: false` (valor só no painel do Render) |

> **Ação sua:** antes do próximo *Sync* do blueprint no Render, confirme no painel que `DB_HOST` continua preenchido.

### Checklist para publicar (referência geral)

O GitHub Pages **não executa Python nem acessa banco**: a versão em `docs/` mostra a página de consulta em modo
estático, com um aviso. Isso já foi resolvido publicando em Render + Neon (seção acima); o checklist a seguir continua
útil como referência caso a hospedagem mude no futuro:

1. **Hospedagem com Python** (Render, Fly.io, Railway ou VPS) atrás de um servidor real (`gunicorn`/`waitress`) e de
   HTTPS (nginx/Caddy/Cloudflare). Nunca use `app.run` nem `FLASK_DEBUG=1` em produção.
2. **Banco**: um PostgreSQL dedicado (idealmente um banco só para o site), com `db/01_busca.sql` e `db/02_papel_leitura.sql`
   aplicados; conexão com `DB_SSLMODE=verify-full`; porta liberada **somente** para o servidor do site; senha forte; backups.
3. **Variáveis**: `ALLOWED_HOSTS=seudominio.com`, `TRUST_PROXY_HOPS=1`, `RN_HTTPS=1`, `FLASK_DEBUG=0`; limite de requisições
   em Redis (`RATELIMIT_STORAGE_URI`) se houver mais de um processo.
4. **Site estático em outro endereço** (ex.: Pages chamando a API): gere com `RN_API_ORIGIN=https://api.seudominio.com python build_static.py`
   e autorize a origem em `CORS_ORIGINS` no servidor da API.
5. **Privacidade/LGPD**: o texto pesquisado aparece na URL e, portanto, nos logs de acesso — defina o prazo de retenção.
6. Rodar `pytest`, `bandit` e `pip-audit` a cada atualização.

## Documentação em PDF

`documentacao/Royal_Navy_Documentacao_Tecnica.pdf` é gerado por `ferramentas/documentacao/gerar_pdf.py` (reconstruído na v4.5;
o script anterior só existia em pastas temporárias). Ele parte do PDF da tag `v4.4.0`, refaz capa, sumário, cabeçalhos, rodapés e
o histórico de versões com a mesma identidade visual e acrescenta as seções novas. Passo a passo em
[`ferramentas/documentacao/README.md`](ferramentas/documentacao/README.md):

```bash
pip install -r requirements-docs.txt
python ferramentas/documentacao/gerar_pdf.py
```

## Publicar na internet (GitHub Pages)

`http://localhost:5000` só existe **no computador de quem está rodando o `python app.py`**; o GitHub apenas guarda o código
e não executa Python. Como o site não tem lógica de servidor, ele é publicado como **site estático** na pasta `docs/`.

1. Depois de editar `templates/` ou `static/`, gere a versão estática e faça commit:
   ```bash
   python build_static.py
   git add -A && git commit -m "Atualiza site" && git push
   ```
2. No GitHub: **Settings → Pages → Build and deployment → Source: _Deploy from a branch_ → Branch: `main` / pasta `/docs` → Save**.
3. Em ~1 minuto o site fica em **https://alansouzadev7.github.io/Naval_Design-WEB-V.1/** (HTTPS automático).

### Segurança
- HTTPS fornecido pelo GitHub Pages; sem servidor, banco de dados, formulários ou credenciais para atacar.
- `Content-Security-Policy` (no `<meta>` da página) limita scripts, estilos, fontes e imagens às origens usadas (o próprio site, cdnjs e Google Fonts), sem `unsafe-inline` (v4.2).
- three.js carregado com verificação de integridade (SRI).
- No Flask local: cabeçalhos `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, CSP (com `frame-ancestors`) e isolamento de origem; debug só em `127.0.0.1`. Segurança da consulta ao banco: ver a seção "Consulta de navios (v3.0)".

## Domínio personalizado (royalnavy.com.br)

> **Situação em 20/09/2026:** o site já está no ar em <https://alansouzadev7.github.io/Naval_Design-WEB-V.1/>.
> O domínio `royalnavy.com.br` foi consultado no RDAP do Registro.br e **estava disponível (não registrado)**.
> O registro é uma compra que só o titular pode fazer (exige CPF/CNPJ e pagamento), por isso ainda não está ativo.

**Por que o domínio não foi apontado antes de existir:** o arquivo `CNAME` faz o endereço `github.io` redirecionar para o domínio.
Se o domínio não existir (ou não for seu), o site "cai" e, pior, o tráfego iria para quem o registrasse primeiro.
Por isso o script `enable_custom_domain.py` só grava o `CNAME` depois de conferir que o DNS já aponta para o GitHub.

### Passo a passo
1. **Registrar** `royalnavy.com.br` em <https://registro.br> (conta, CPF/CNPJ, pagamento da anuidade).
2. **Criar os registros DNS** (no Registro.br: *Editar zona* / DNS do próprio Registro.br):

   | Tipo    | Nome  | Valor                                                                                          |
   |---------|-------|------------------------------------------------------------------------------------------------|
   | `A`     | `@`   | `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153` (um registro por IP) |
   | `AAAA`  | `@`   | `2606:50c0:8000::153`, `2606:50c0:8001::153`, `2606:50c0:8002::153`, `2606:50c0:8003::153` (opcional) |
   | `CNAME` | `www` | `alansouzadev7.github.io`                                                                      |

   IPs conferidos na API oficial <https://api.github.com/meta> (campo `pages`).
3. **Esperar a propagação** (minutos a algumas horas) e conferir: `nslookup royalnavy.com.br`.
4. **Ativar no projeto** (o script recusa se o DNS ainda não estiver certo):
   ```bash
   python enable_custom_domain.py royalnavy.com.br
   git add -A && git commit -m "Ativa dominio royalnavy.com.br" && git push
   ```
5. No GitHub, em **Settings → Pages**, o campo *Custom domain* deve mostrar `royalnavy.com.br`. Quando o certificado ficar pronto
   (até ~1 h), marque **Enforce HTTPS**.
6. **Recomendado:** verifique o domínio em *Settings (da conta) → Pages → Add a domain* (registro TXT). Isso impede que outra pessoa
   use seu domínio em outro repositório do GitHub Pages.

Para desfazer: `python enable_custom_domain.py --remove`, commit e push.

## Estrutura

```
app.py                  servidor Flask (uso local)
build_static.py         gera a versão estática em docs/ (GitHub Pages)
enable_custom_domain.py ativa/remove domínio próprio (com checagem de DNS)
documentacao/           PDF com a documentação técnica completa
docs/                   site estático publicado
templates/index.html    página única
templates/consulta.html página de consulta de navios (v3.0)
templates/contato.html  página de contato (formulário só com o servidor; na versão estática apenas avisa)
templates/sugerir.html  página "Sugerir navio" (v4.3)
templates/navegacao.html página Navegação pelas Estrelas (v4.5)
templates/admin_*.html  painel do administrador das sugestões (v4.3)
static/css/style.css    estilos gerais do site (paleta "dia de sol no mar" em variáveis CSS) e regras da barra de navegação
static/css/light.css    estilos do modo claro "Mar em Paz" (v4.1)
static/css/dark.css     estilos do modo escuro (guerra em alto mar)
static/css/consulta.css estilos da página de consulta (claro e escuro)
static/css/contato.css  estilos da página de contato (claro e escuro)
static/css/sugerir.css  estilos da página de sugestão e do painel (claro e escuro)
static/css/navegacao.css estilos da página Navegação pelas Estrelas (crepúsculo náutico / noite em alto-mar)
static/js/main.js       navegação, controlador do hero (RNHero), contadores, modal
static/js/ships-3d.js   motor 3D (cenas sob demanda, loop único, modelos procedurais)
static/js/ships-data.js dados dos navios
static/js/theme-init.js aplica o tema salvo antes da primeira pintura
static/js/theme.js      botão de tema, transição e desempenho adaptativo
static/js/convoy-hero.js comboio em perspectiva do hero (modo claro, v4.1)
static/js/calm-sea.js   mergulho, patrulha, recife de coral e medidor (modo claro, v4.1)
static/js/war-hero.js   batalha naval do hero (modo escuro)
static/js/deep-sea.js   mergulho, guerra submarina e naufrágios (modo escuro)
static/js/consulta.js   página de consulta (busca, filtros, ficha; só textContent)
static/js/astro.js      cálculos astronômicos: tempo sideral, precessão, planetas (NASA/JPL), Lua, projeção (v4.5)
static/js/navegacao.js  céu do topo, bússola estelar, quadrante, cronômetro, carta celeste e orrery (v4.5)
static/js/planetas-3d.js planetas em 3D com texturas geradas no navegador (v4.5)
static/data/ceu.json    estrelas, 57 estrelas de navegação + Polar e linhas das 88 constelações (d3-celestial, BSD-3)
consulta_api.py         API de consulta (validação, limite, consultas parametrizadas) e rotas dos PDFs
pdf_navios.py           gera os PDFs da ficha e da busca (ReportLab, em memória)
sugestoes.py            sugestões de navios: comparação com o acervo, arquivo JSON (GitHub ou local) e painel /admin
protecao.py             CSRF, sessão segura e campo-isca dos formulários
ferramentas/            gerar_hash_admin.py (hash da senha do painel) e documentacao/ (gerador do PDF, v4.5)
config_env.py           onde ficam os segredos (fora do Git e do OneDrive)
db/                     SQL da busca e do papel de leitura, aplicar.py, seed_teste.py (dados sintéticos de teste) e README do banco
deploy/                 publicação online (v4.0): render.yaml, raiz TLS, dependências extras
tests/                  195 testes de funcionamento e segurança
```

## Notas de desempenho

- As 12 cenas 3D só são criadas quando chegam perto da tela e só renderizam enquanto estão visíveis;
  com o modal aberto, apenas o modal renderiza.
- Um único loop `requestAnimationFrame` para todo o 3D; animações baseadas em tempo (independem do monitor de 60/144 Hz).
- Geometrias e materiais em cache; peças repetidas em `InstancedMesh`.
- O hero (canvas 2D) pausa fora da tela e com a aba oculta; só `transform`/`opacity` são animados.
- Tema claro (v4.1): sprites, fundos, níveis de névoa e cáusticas são pré-renderizados; o mergulho usa um canvas fixo em meia resolução; as faixas de patrulha e de recife ligam e desligam por visibilidade; nos navios do comboio, o nível de detalhe cai com a distância.
- Página Navegação pelas Estrelas (v4.5.1): o Three.js só é baixado quando os planetas chegam perto da tela; cada canvas anima só quando visível.
- Respeita `prefers-reduced-motion`.
