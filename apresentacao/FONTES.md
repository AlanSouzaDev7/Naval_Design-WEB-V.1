# Fontes dos números da apresentação

Tudo vem do repositório (README, código, histórico do Git) e da documentação técnica
`documentacao/Royal_Navy_Documentacao_Tecnica.pdf` (v4.4, 95 páginas). Os números em **negrito** são medições registradas lá.

| Slide | Número | Origem |
|---|---|---|
| capa, 2, 4, 17, 19, 20 | **186 testes**; distribuição 52 / 29 / 28 / 23 / 17 / 10 / 8 / 7 / 10 / 2 | `pytest` (186 passed em 20/10/2026); PDF §13.7 (88 testes por grupo), §17 (+11 da v4.2), §18.5 (+58 da v4.3) e §19.4 (+29 da v4.4, `tests/test_pdf.py`). Grupos da v4.3: sugestões e painel = 52 (`tests/test_sugestoes.py`); front-end e CSP passou de 4 para 10 (a regra de modelos cobre os 8 templates) |
| 2, 10, 14 | **0 vulnerabilidades**, 7 pacotes | PDF §17.1 (consulta à base OSV; Flask 3.1.3, Werkzeug 3.1.8, psycopg 3.3.6, psycopg-pool 3.3.3, Flask-Limiter 4.1.1, python-dotenv 1.2.3, gunicorn 23.0.0) |
| 10, 14 | **Bandit: 0 achados**; **22 cargas hostis** sem erro 500 | PDF §13.7, §17.1 e §18.5 |
| 10 | 0 usos de innerHTML/eval | README (Navegador); teste `test_javascript_sem_sinks_de_xss` |
| 11 | fluxo das sugestões; respostas “Navio já existente”, “Você quis dizer…?”, “Em análise” | PDF §18.1–18.5; testado no site publicado em 20/10/2026: USS Arizona → já existente; HMS Victory → HMS Victorious (38) → confirmado e registrado; envio sem token → 403 |
| 2, 15 | **120 fps de pico; mínimo 104 fps** (tema claro) | PDF §15.6 (Edge com GPU, 1366×768, 120 Hz, mediana de 3 rodadas) |
| 15 | fps por ponto: claro 104,0 / 113,3 / 119,2 / 120,2 / 120,2 / 105,7 / 120,2; escuro 86,7 / 93,1 / 118,4 / 119,7 / 120,1 | PDF §15.6 (tabelas de fluidez; patrulha e recife só existem no claro) |
| 16 | **1,7 → 56,7 fps**; **13 → 0** contextos WebGL; **12 → 9** pesos de fonte; **17** draw calls com o modal | PDF §1 (resultados v1.0 → v1.1) e §9.1; medido com WebGL por software |
| 7 | 12 cenas 3D; 13 → 0 contextos; 0 draw calls só com o hero | README (Notas de desempenho); PDF §1 e §9.4 |
| 2, 4, 6 | 9 versões numeradas em um mês; 26 commits | `git tag` e `git rev-list --count main` (19/09 a 20/10/2026): v2.0.0, v2.0.1, v3.0.0, v3.0.1, v4.0.0, v4.1.0, v4.2.0, v4.3.0, v4.4.0 |
| 6 | datas das versões | `git log --format='%ad %s'` |
| 9 | **64 navios de 8 marinhas** | PDF §1 (resultados v3.0). Os 84 navios do `db/seed_teste.py` são sintéticos, só para teste |
| 9 | **8 ms** mediana da busca, p95 < 11 ms | PDF §1 (v3.0): Flask + PostgreSQL, medido localmente, sem rede |
| 9 | 10 resultados por página | `consulta_api.py` (`POR_PAGINA = 10`) |
| 10 | sete camadas da API | docstring de `consulta_api.py` |
| 18 | 503 → 200 após a v4.2; conexão 8 s, pool 5 s | PDF §17.3 |
| 19 | JS 5.536 · CSS 2.815 · Python 2.190 · HTML 1.244 · testes 940 · SQL 112 = **12.837 linhas** (v4.2: 10.480; v4.3: 12.433) | `wc -l` no commit 25c787a (v4.4): `static/js`, `static/css`, `templates/`, todos os `.py` exceto `tests/` e `enable_custom_domain.py`, `db/*.sql`, `tests/` (exclui `docs/`) |
| 3 | ≈ 80% do comércio internacional de bens por via marítima | UNCTAD, *Review of Maritime Transport* (edições 2023 e 2024) |
| 12, 13 | **20 requisitos funcionais** em 6 módulos (4 + 3 + 3 + 6 + 2 + 2) | Levantamento feito a partir do código (`templates/index.html`, `consulta_api.py`, `sugestoes.py`) e do PDF — não existe uma especificação formal. RF-18 e RF-19 (v4.3) são cobertos por `tests/test_sugestoes.py`; RF-20 (v4.4, PDFs) por `tests/test_pdf.py` |
| 14 | 9 requisitos não funcionais com resultado | PDF §9, §13.7, §15, §17, §18 |
| 9 | PDF da ficha e da busca: 60–110 ms | PDF §19.4 (ficha do USS Arizona 108 ms na 1ª chamada; busca de 59 navios 59 ms) |
| 20, 21 | limites declarados e próximos passos | PDF §9.2, §10, §15.9, §17.6, §18.7, §19.5 |

## Cuidados ao atualizar

- Se o projeto ganhar uma nova versão, atualizar: capa (versão e testes), slide 2 (testes, versões), 4 (selos), 6 (linha do tempo), 17 (rosca) e 19 (linhas de código — rode `wc -l` de novo com o mesmo critério).
- O slide 5 (aplicações) são **cenários propostos**, não clientes. Não apresentar como casos reais.
- A numeração de rodapé (`NN / 23`) é escrita à mão em cada slide: ao inserir ou remover slide, renumerar.
