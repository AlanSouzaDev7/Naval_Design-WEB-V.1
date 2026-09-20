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

## Estrutura

```
app.py                  servidor Flask (uso local)
build_static.py         gera a versão estática em docs/ (GitHub Pages)
docs/                   site estático publicado
templates/index.html    página única
static/css/style.css    estilos (paleta "dia de sol no mar" em variáveis CSS)
static/js/main.js       navegação, hero animado, contadores, modal
static/js/ships-3d.js   motor 3D (cenas sob demanda, loop único, modelos procedurais)
static/js/ships-data.js dados dos navios
```

## Notas de desempenho

- As 12 cenas 3D só são criadas quando chegam perto da tela e só renderizam enquanto estão visíveis;
  com o modal aberto, apenas o modal renderiza.
- Um único loop `requestAnimationFrame` para todo o 3D; animações baseadas em tempo (independem do monitor de 60/144 Hz).
- Geometrias e materiais em cache; peças repetidas em `InstancedMesh`.
- O hero (canvas 2D) pausa fora da tela e com a aba oculta; só `transform`/`opacity` são animados.
- Respeita `prefers-reduced-motion`.
