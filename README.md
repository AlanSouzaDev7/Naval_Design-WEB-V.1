# ⚓ Royal Navy — Site Educativo

Site educativo sobre a Marinha Real Britânica: linha do tempo, navios lendários em **3D interativo** (Three.js),
batalhas, frota atual e galeria. Servido por Flask, com visual de **dia ensolarado no mar** (modo claro) e de
**guerra em alto mar** (modo escuro). A partir da **v3.0** tem uma página de **Consulta de Navios** ligada a um banco
PostgreSQL (somente leitura, com camadas de segurança).

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

## Modos claro e escuro ("Guerra em alto mar")

Botão no **canto superior direito** (o tema fica salvo no navegador). O **modo claro** é o visual original do site;
o **modo escuro** transforma a página numa viagem da superfície ao leito do oceano:

| Trecho da página | O que acontece no modo escuro |
|---|---|
| **Hero** | Batalha naval noturna: duas frotas trocam disparos (projéteis com rastro, clarões, explosões, incêndios, fumaça, colunas d'água), com relâmpagos, holofotes, sinalizadores e navios que afundam e voltam ao combate. |
| **Ao descer** | O visitante mergulha: a cor da água escurece com a profundidade, com raios de luz, neve marinha, bolhas, cardumes, submarinos e clarões distantes. Um **medidor de profundidade** (m e zona oceânica) acompanha a rolagem. |
| **Guerra Submarina** | Submarinos trocam torpedos, emitem sonares, sofrem avarias, afundam e reaparecem; navios na superfície lançam cargas de profundidade. |
| **Navios Naufragados** | No leito: destroieres partidos, um galeão, um submarino e um porta-aviões afundados, algas, corais, cardumes, bolhas e uma baliza de socorro piscando. |
| **Modelos 3D e modal** | Cenário noturno (luar, reflexos dos incêndios) e painéis escuros. |

**Transição:** revelação circular a partir do botão (View Transitions API); navegadores sem suporte usam uma cortina circular;
`prefers-reduced-motion` troca o tema sem animação.

**Desempenho (mesmas regras do resto do site):** o modo escuro só existe quando ativo; cada canvas só anima enquanto está
visível (IntersectionObserver) e com a aba em primeiro plano; o fundo do mar profundo roda em meia resolução; partículas em
*pools* de tamanho fixo e brilhos como sprites; um monitor de FPS (`RNPerf`) reduz partículas e efeitos automaticamente em
máquinas lentas; a cena escura é pré-aquecida quando o mouse chega ao botão.

Arquivos: `theme-init.js` (aplica o tema antes da 1ª pintura), `theme.js` (botão, transição, `RNPerf`), `dark.css`,
`war-hero.js` (batalha do hero), `deep-sea.js` (mergulho, guerra submarina, naufrágios, medidor).

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
| `GET /api/saude` | verificação de funcionamento |

### Como o banco fica protegido

| Camada | O que foi feito |
|---|---|
| **Banco isolado** | A API usa o papel `navios_leitura` (sem superusuário, sem criar nada, no máximo 10 conexões, sessão somente-leitura, `statement_timeout` 3 s). Ele só enxerga a **view** `v_navios` — não a tabela original nem colunas internas (`criado_em`). O administrador `postgres` nunca é usado pelo site (a API se recusa a iniciar com ele). |
| **SQL injection** | Consultas **sempre parametrizadas**; o texto do usuário nunca é concatenado ao SQL. Além disso a entrada é validada por lista de caracteres permitidos (letras, números, espaço e `. ' ( ) / -`), tamanho (2–60) e parâmetros conhecidos. |
| **Abuso** | Limite por IP (30 buscas/min, 60 fichas/min, 120 req/min na API), `LIMIT` em toda consulta, no máximo 20 páginas, pool de 5 conexões. |
| **Vazamento de informação** | Erros genéricos para o cliente (o detalhe fica só no log); sem versão de servidor; `Cache-Control: no-store` na API. |
| **Navegador** | Tudo que vem da API entra na página por `textContent` (nunca `innerHTML`) — testado com resposta hostil; CSP sem `unsafe-eval` e sem scripts inline; `frame-ancestors 'none'`. |
| **Rede** | Cabeçalho `Host` validado (`ALLOWED_HOSTS`, contra DNS rebinding), só `GET`, CORS por lista exata (nunca `*`), HSTS opcional (`RN_HTTPS=1`), proxy só é confiável se configurado (`TRUST_PROXY_HOPS`). |
| **Segredos** | Senha do papel gerada ao acaso (43 caracteres) e guardada **fora do Git e fora do OneDrive**: `~/.royalnavy/consulta.env` (Windows: `C:\Users\<você>\.royalnavy\consulta.env`), com permissão só para o seu usuário (`config_env.py`). Um teste garante que nenhum arquivo versionado contém a senha. |
| **Dependências** | Versões fixas (`requirements-lock.txt`), auditadas com `pip-audit` (0 vulnerabilidades conhecidas; o Flask foi atualizado para 3.1.3 por isso) e `bandit` (0 achados). |

Detalhes, passo a passo do banco e instruções do administrador: [`db/README.md`](db/README.md).

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
pytest tests                      # 85 testes: funcionamento, injeção de SQL, XSS, limite, privilégios do banco, segredos
bandit -r app.py consulta_api.py db build_static.py
pip-audit -r requirements-lock.txt
```

### Antes de publicar de verdade (checklist)

O GitHub Pages **não executa Python nem acessa banco**: a versão em `docs/` mostra a página de consulta em modo
estático, com um aviso. Para a consulta funcionar na internet é preciso hospedar o servidor:

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
- `Content-Security-Policy` (no `<meta>` da página) limita scripts, estilos, fontes e imagens às origens usadas (o próprio site, cdnjs e Google Fonts).
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
static/css/style.css    estilos do modo claro (paleta "dia de sol no mar" em variáveis CSS)
static/css/dark.css     estilos do modo escuro (guerra em alto mar)
static/css/consulta.css estilos da página de consulta (claro e escuro)
static/js/main.js       navegação, hero animado, contadores, modal
static/js/ships-3d.js   motor 3D (cenas sob demanda, loop único, modelos procedurais)
static/js/ships-data.js dados dos navios
static/js/theme-init.js aplica o tema salvo antes da primeira pintura
static/js/theme.js      botão de tema, transição e desempenho adaptativo
static/js/war-hero.js   batalha naval do hero (modo escuro)
static/js/deep-sea.js   mergulho, guerra submarina e naufrágios (modo escuro)
static/js/consulta.js   página de consulta (busca, filtros, ficha; só textContent)
consulta_api.py         API de consulta (validação, limite, consultas parametrizadas)
config_env.py           onde ficam os segredos (fora do Git e do OneDrive)
db/                     SQL da busca e do papel de leitura, aplicar.py e README do banco
tests/                  85 testes de funcionamento e segurança
```

## Notas de desempenho

- As 12 cenas 3D só são criadas quando chegam perto da tela e só renderizam enquanto estão visíveis;
  com o modal aberto, apenas o modal renderiza.
- Um único loop `requestAnimationFrame` para todo o 3D; animações baseadas em tempo (independem do monitor de 60/144 Hz).
- Geometrias e materiais em cache; peças repetidas em `InstancedMesh`.
- O hero (canvas 2D) pausa fora da tela e com a aba oculta; só `transform`/`opacity` são animados.
- Respeita `prefers-reduced-motion`.
