# Gerador do PDF de documentação técnica

Gera `documentacao/Royal_Navy_Documentacao_Tecnica.pdf`. Reconstruído em 27/10/2026, porque o script original
(até a v4.4) só existia em pastas temporárias que foram apagadas.

## Como funciona

As seções 1 a 19 já estão diagramadas no PDF publicado na tag `v4.4.0`. O gerador lê esse PDF direto do Git, por isso
não guarda uma segunda cópia no repositório. Sobre ele, o gerador:

1. **Apaga** de verdade o texto que vai ser refeito: cabeçalhos, rodapés, a versão na capa e o "Fim do documento". A
   busca de texto não encontra mais versões antigas escondidas.
2. **Redesenha** com a mesma identidade visual (`estilo.py`) a capa, o **sumário completo** e o cabeçalho e o rodapé de
   todas as páginas, com numeração refeita. Também acrescenta as **linhas novas do histórico de versões** (seção 11.5).
3. **Acrescenta** no fim as seções novas da edição (`secoes/`) e põe o "Fim do documento" na última página.
4. Refaz os **marcadores** do PDF e os metadados.

| Arquivo | Para que serve |
|---|---|
| `gerar_pdf.py` | Monta o PDF (rodar a partir da pasta `site/`) |
| `edicao.py` | **O que muda a cada versão:** número, data, tag, sumário, "o que mudou", histórico, seções novas |
| `estilo.py` | Fontes, cores, estilos, tabelas, figuras, cabeçalho e rodapé (medidos no próprio PDF v4.4) |
| `secoes/_modelo.py` | Modelo de seção nova |

## Uso

```bash
pip install -r requirements-docs.txt
python ferramentas/documentacao/gerar_pdf.py --saida conferir.pdf          # gera para conferir
python ferramentas/documentacao/gerar_pdf.py                               # grava em documentacao/
```

Precisa do Git (para ler a tag base) e das fontes Segoe UI e Consolas do Windows. Em outro sistema, aponte a variável
`RN_FONTES` para uma pasta com `segoeui.ttf`, `segoeuib.ttf`, `segoeuii.ttf`, `segoeuiz.ttf`, `consola.ttf` e
`consolab.ttf`.

## Nova versão (ex.: 4.5)

1. Em `edicao.py`: troque `VERSAO`, `DATA` e `TAG`. Depois acrescente o item no `SUMARIO`, a primeira posição em
   `MUDANCAS` e a linha em `HISTORICO`, e ajuste o `ASSUNTO`.
2. Copie `secoes/_modelo.py` para `secoes/secao_20.py`, escreva o conteúdo e ponha `"secao_20"` em `SECOES_NOVAS`.
3. Gere com `--saida` e confira. Quando estiver certo, gere em `documentacao/` e copie para a pasta `RoyalNavy_V1`.

A base continua sendo a `v4.4.0`. Se um dia as seções novas ficarem muitas, dá para trocar `BASE_TAG` para uma tag
mais nova. Nesse caso, as seções que já estiverem nela saem de `SECOES_NOVAS`.

## Verificação feita na reconstrução

Gerado sem seções novas, o resultado tem as mesmas 95 páginas do v4.4 publicado. A comparação pixel a pixel do miolo
(fora do cabeçalho e do rodapé) só mostrou as três diferenças pretendidas:

- **Página 48:** linhas 4.2.0, 4.3.0 e 4.4.0 no histórico de versões.
- **Página 84:** o "Fim do documento" saiu do meio do PDF.
- **Página 95:** o "Fim do documento" foi para o fim real.

Também foram corrigidas falhas do v4.4:

- **Sumário:** ia só até a seção 16 e agora vai até a 19.
- **Cabeçalhos:** tinham "v4.1" escondido sob "v4.4" e agora existe só um texto.
- **Seções 17 a 19:** o cabeçalho e o rodapé tinham outra medida e foram igualados aos demais.
