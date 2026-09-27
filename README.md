# ⚓ Royal Navy — Site Educativo

Site educativo sobre a Marinha Real Britânica: linha do tempo, navios lendários em **3D interativo** (Three.js),
batalhas, frota atual e galeria. Servido por Flask, com visual de **dia ensolarado no mar**.

## Como rodar

```bash
python -m venv .venv
.venv\Scripts\activate          # Windows  (Linux/macOS: source .venv/bin/activate)
pip install -r requirements.txt
python app.py
```

Abra <http://localhost:5000>.

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
- No Flask local: cabeçalhos `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` e `Permissions-Policy`; debug só em `127.0.0.1`.

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
static/css/style.css    estilos do modo claro (paleta "dia de sol no mar" em variáveis CSS)
static/css/dark.css     estilos do modo escuro (guerra em alto mar)
static/js/main.js       navegação, hero animado, contadores, modal
static/js/ships-3d.js   motor 3D (cenas sob demanda, loop único, modelos procedurais)
static/js/ships-data.js dados dos navios
static/js/theme-init.js aplica o tema salvo antes da primeira pintura
static/js/theme.js      botão de tema, transição e desempenho adaptativo
static/js/war-hero.js   batalha naval do hero (modo escuro)
static/js/deep-sea.js   mergulho, guerra submarina e naufrágios (modo escuro)
```

## Notas de desempenho

- As 12 cenas 3D só são criadas quando chegam perto da tela e só renderizam enquanto estão visíveis;
  com o modal aberto, apenas o modal renderiza.
- Um único loop `requestAnimationFrame` para todo o 3D; animações baseadas em tempo (independem do monitor de 60/144 Hz).
- Geometrias e materiais em cache; peças repetidas em `InstancedMesh`.
- O hero (canvas 2D) pausa fora da tela e com a aba oculta; só `transform`/`opacity` são animados.
- Respeita `prefers-reduced-motion`.
