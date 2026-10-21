# Royal Navy Digital — apresentação institucional

Cópia de trabalho, neste computador, da apresentação publicada em
**<https://claude.ai/artifact/QCZM4XMi1ZYUEsDSxQKBDy>** (privada; só abre depois de compartilhada pelo menu *Share* da página).
43 slides, tela de 1920×1080, em português. Última atualização: 20/10/2026 (projeto na v4.4.0; versão 11 do artifact).

## Como pedir uma alteração

Basta pedir ao Claude, em linguagem comum: *"troque o título do slide 3"*, *"adicione um slide sobre X"*,
*"atualize os números do slide 14"*. Ele edita os arquivos desta pasta e republica no mesmo endereço, sem criar link novo.
Antes de editar, ele confere a versão da página, para não apagar mudanças que você tenha feito à mão no editor.

## O que tem aqui

```
apresentacao/
├─ project/                      ← ESPELHO do que está publicado (a fonte de verdade para editar)
│  ├─ deck.json                  título, ordem dos slides, seções do sumário e fontes tipográficas
│  └─ slides/<id>.html           um arquivo por slide (43) — texto, cores, layout e notas do apresentador
├─ codigo-img/                   "fotos" PNG do código (18), manifest.json e urls.json (endereços dos assets no artifact)
├─ ferramentas/
│  ├─ rebuild_embeds.py          regenera os gráficos 3D animados e o navio dentro dos slides
│  ├─ gerar_codigo.py            lê o código da branch main e gera as fotos (imagens) e os slides cod-* (slides)
│  ├─ previa.py · fotos_slides.py  pré-visualização local e fotos de todos os slides (Edge headless) em previa/
│  ├─ foto_navio.py              fotografa o navio 3D em 6 ângulos, para conferência
│  └─ engines/                   código dos motores: bars.js · donut.js · layers.js · ship.js
├─ previa/                       saída das conferências locais (pode apagar; é regenerada)
├─ FONTES.md                     de onde vem cada número da apresentação
└─ README.md                     este arquivo
```

| Ordem | id do slide | Conteúdo |
|---|---|---|
| 1 | `cover` | Capa, com o navio 3D animado |
| 2 | `resumo` | Resumo executivo (4 números) |
| 3 | `mercado` | O mar move o mundo (UNCTAD ≈ 80%) |
| 4 | `valor` | Proposta de valor: imersão, confiança, escala |
| 5 | `usos` | Aplicações possíveis |
| 6 | `jornada` | Linha do tempo v1.1 → v4.4 |
| 7 | `tres-d` | Experiência 3D |
| 8 | `temas` | Mar em Paz × Guerra em alto mar |
| 9 | `consulta` | Consulta de navios (fluxo do dado) |
| 10 | `seguranca` | Sete camadas (pilha 3D animada) |
| 11 | `sugestoes` | Sugestões de navios e painel (v4.3) |
| 12–13 | `cod-arquitetura` · `cod-linguagens` | Por dentro do código: 3 camadas e 6 linguagens |
| 14–22 | `cod-flask` … `cod-csrf` | Back-end e banco: Flask, validação, rotas, SQL (busca, estrutura, papel), PDFs, sugestões, CSRF |
| 23–29 | `cod-html` … `cod-consulta-js` | Front-end: HTML/Jinja, CSS, loop 3D, Three.js, Canvas 2D, temas, consulta |
| 30–31 | `cod-yaml` · `cod-testes` | Publicação (YAML/Render) e testes (pytest) |
| 32 | `rf-grafico` | Requisitos funcionais — gráfico 3D |
| 33 | `rf-matriz` | Requisitos funcionais — matriz (RF-01 a RF-20) |
| 34 | `rnf-visao` | Requisitos não funcionais — matriz |
| 35 | `rnf-desempenho` | RNF desempenho — gráfico de fps |
| 36 | `rnf-otimizacao` | RNF eficiência — 1,7 → 56,7 fps |
| 37 | `rnf-testes` | RNF segurança — 186 testes (rosca) |
| 38 | `rnf-resiliencia` | RNF disponibilidade — 503 → 200 |
| 39 | `rnf-manutencao` | RNF manutenibilidade — código por tecnologia |
| 40 | `transparencia` | Comprovado × limites declarados |
| 41 | `proximos` | Próximos passos |
| 42 | `declaracao` | Declaração de síntese |
| 43 | `encerramento` | Encerramento, links e contato |

**Fotos do código:** rode com o Python do `.venv` do projeto (tem Pillow e Pygments):
`..\.venv\Scripts\python.exe ferramentas\gerar_codigo.py imagens` → enviar os PNGs como assets → atualizar `codigo-img/urls.json` →
`... gerar_codigo.py slides` (gera os `cod-*`, coloca a ordem no `deck.json` e renumera todos os rodapés).

## Editar por conta própria

- **Textos, cores, posições:** edite o `.html` do slide em `project/slides/`. O formato é HTML com estilos inline em um
  subconjunto fechado do CSS (tela fixa de 1920×1080; nada de classes, `margin`, `em` ou `var()`).
- **Dados de um gráfico:** edite o bloco `EMBEDS` em `ferramentas/rebuild_embeds.py` e rode
  `python ferramentas/rebuild_embeds.py` (ou `... rf fps` para só alguns). Cada gráfico tem limite de 16 KB.
- **Paleta:** azul-marinho `#06172A`/`#0A2038`, latão `#D4AE5A`, mar `#5DB8C9`, marfim `#F2EEE3`. **Fontes:** Cormorant Garamond (títulos) e IBM Plex Sans (texto).
- Editar aqui **não** muda a página publicada; para publicar, peça ao Claude ("publique as alterações").

## Pendências conhecidas

- Slide 43: preencher `[nome do responsável · e-mail]`.
- Conferência: todos os slides foram fotografados localmente (`ferramentas/fotos_slides.py`) e o navio em 6 ângulos (`foto_navio.py`). A prévia local não carrega as fontes do Google nem os ícones; a página real pode variar um pouco.
- Navio 3D (`engines/ship.js`): em 20/10/2026 foi corrigido o defeito da proa, causado por um `NaN` na última estação do casco. Também foram refeitos o casco, o reflexo da lua, a esteira e a espuma.
- Os gráficos animados rodam na versão web; uma exportação para PDF ou PPTX os mostra como imagem estática.

## Cópia offline

Na página da apresentação, o menu *Share › Export* gera PDF, PPTX ou página web.
